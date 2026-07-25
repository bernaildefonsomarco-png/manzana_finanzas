import {
  createDefaultAgentRuntime,
  getAgentRuntimeProvider,
  getAgentRuntimeTimeoutMs,
  type AgentRuntime,
  type AgentRuntimeResponse,
} from "@/agents/runtime";
import {
  EmailExtractionContextPackSchema,
  EmailExtractionOutputSchema,
  type EmailExtractionContextPack,
  type EmailExtractionField,
  type EmailExtractionGrounding,
  type EmailExtractionOutput,
} from "./types";

export type EmailExtractionAgentResult =
  AgentRuntimeResponse<EmailExtractionOutput> & {
    grounding: EmailExtractionGrounding;
    repairs: {
      evidence_fields: EmailExtractionField[];
      normalized_value_fields: EmailExtractionField[];
    };
  };

export class EmailExtractionAgent {
  constructor(
    private readonly runtime: AgentRuntime = createDefaultAgentRuntime(),
  ) {}

  async extract(
    contextPack: EmailExtractionContextPack,
    traceId: string,
  ): Promise<EmailExtractionAgentResult> {
    const context = EmailExtractionContextPackSchema.parse(contextPack);
    const response = await this.runtime.run<
      EmailExtractionContextPack,
      EmailExtractionOutput
    >({
      agent_name: "email_extraction_agent",
      provider: getAgentRuntimeProvider("email_extraction_agent"),
      model_hint: "cheap",
      context_pack: context,
      tools: [],
      output_schema: "EmailExtractionOutputSchema@v1",
      trace_id: traceId,
      timeout_ms: getAgentRuntimeTimeoutMs(
        "email_extraction_agent",
        20_000,
      ),
    });
    const repaired = repairEmailExtractionEvidence(
      context,
      EmailExtractionOutputSchema.parse(response.output),
    );
    return {
      ...response,
      output: repaired.output,
      grounding: validateEmailExtractionGrounding(
        context,
        repaired.output,
      ),
      repairs: repaired.repairs,
    };
  }
}

export function validateEmailExtractionGrounding(
  context: EmailExtractionContextPack,
  output: EmailExtractionOutput,
): EmailExtractionGrounding {
  const errors: string[] = [];
  const content = normalizeEvidenceText(
    `${context.subject}\n${context.body_text}`,
  );
  const evidence = new Map<EmailExtractionField, string[]>();

  for (const item of output.field_evidence) {
    const quote = normalizeEvidenceText(item.quote);
    if (!content.includes(quote)) {
      errors.push(`quote_not_grounded:${item.field}`);
      continue;
    }
    const current = evidence.get(item.field) ?? [];
    current.push(item.quote);
    evidence.set(item.field, current);
  }

  const rejectionPattern =
    /(?:rechaz|denegad|fondos insuficientes|no se pudo (?:completar|procesar)|operacion fallida)/;
  if (
    output.operation_status === "completed" &&
    rejectionPattern.test(content)
  ) {
    errors.push("status_conflicts_with_rejection_notice");
  }
  if (
    output.operation_status === "rejected" &&
    !(evidence.get("operation_status") ?? []).some((quote) =>
      rejectionPattern.test(normalizeEvidenceText(quote)),
    )
  ) {
    errors.push("rejected_status_evidence_missing");
  }

  requireEvidence(evidence, "notice_kind", errors);
  requireEvidence(evidence, "operation_status", errors);
  requireEvidence(evidence, "direction", errors);

  if (
    output.operation_status === "completed" &&
    !["informational", "unknown"].includes(output.notice_kind)
  ) {
    if (output.amount === null) errors.push("completed_amount_missing");
    if (output.currency === null) errors.push("completed_currency_missing");
    if (output.occurred_at === null) errors.push("completed_date_missing");
    if (output.direction === "unknown") {
      errors.push("completed_direction_missing");
    }
  }

  validateGroundedValue(
    evidence,
    "amount",
    output.amount,
    (quotes, value) =>
      quotes.some((quote) =>
        extractAmounts(quote).some(
          (candidate) => Math.abs(candidate - value) < 0.005,
        ),
      ),
    errors,
  );
  validateGroundedValue(
    evidence,
    "currency",
    output.currency,
    (quotes, value) =>
      quotes.some((quote) => {
        const normalized = normalizeEvidenceText(quote);
        return value === "PEN"
          ? /(?:s\s*\/|pen|sol(?:es)?)/i.test(normalized)
          : /(?:usd|us\s*\$|\bdolar(?:es)?\b)/i.test(normalized);
      }),
    errors,
  );
  validateGroundedValue(
    evidence,
    "occurred_at",
    output.occurred_at,
    (quotes, value) =>
      quotes.some((quote) => dateEvidenceMatchesValue(quote, value)),
    errors,
  );
  validateGroundedValue(
    evidence,
    "merchant",
    output.merchant,
    (quotes, value) =>
      quotes.some((quote) =>
        normalizeEvidenceText(quote).includes(normalizeEvidenceText(value)),
      ),
    errors,
  );
  for (const field of [
    "account_hint",
    "account_origin_hint",
    "account_destination_hint",
  ] as const) {
    validateGroundedValue(
      evidence,
      field,
      output[field],
      (quotes, value) =>
        quotes.some((quote) => accountEvidenceMatchesValue(quote, value)),
      errors,
    );
  }
  validateGroundedValue(
    evidence,
    "operation_identifier",
    output.operation_identifier,
    (quotes, value) => {
      const normalizedValue = normalizeIdentifier(value);
      return quotes.some((quote) =>
        normalizeIdentifier(quote).includes(normalizedValue),
      );
    },
    errors,
  );

  return { grounded: errors.length === 0, errors };
}

function requireEvidence(
  evidence: Map<EmailExtractionField, string[]>,
  field: EmailExtractionField,
  errors: string[],
) {
  if (!evidence.has(field)) errors.push(`evidence_missing:${field}`);
}

function validateGroundedValue<T>(
  evidence: Map<EmailExtractionField, string[]>,
  field: EmailExtractionField,
  value: T | null,
  validate: (quotes: string[], value: T) => boolean,
  errors: string[],
) {
  if (value === null) return;
  const quotes = evidence.get(field);
  if (!quotes || quotes.length === 0) {
    errors.push(`evidence_missing:${field}`);
    return;
  }
  if (!validate(quotes, value)) errors.push(`value_not_grounded:${field}`);
}

function normalizeEvidenceText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeIdentifier(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function repairEmailExtractionEvidence(
  context: EmailExtractionContextPack,
  output: EmailExtractionOutput,
): {
  output: EmailExtractionOutput;
  repairs: {
    evidence_fields: EmailExtractionField[];
    normalized_value_fields: EmailExtractionField[];
  };
} {
  const segments = buildEvidenceSegments(
    `${context.subject}\n${context.body_text}`,
  );
  const normalizedContent = normalizeEvidenceText(
    `${context.subject}\n${context.body_text}`,
  );
  const uniqueAmounts = uniqueNumbers(
    segments.flatMap((segment) => extractAmounts(segment)),
  );
  const amountNeedsCorrection =
    output.amount !== null &&
    !uniqueAmounts.some(
      (candidate) => Math.abs(candidate - output.amount!) < 0.005,
    ) &&
    uniqueAmounts.length === 1;
  const effectiveOutput = amountNeedsCorrection
    ? { ...output, amount: uniqueAmounts[0] ?? output.amount }
    : output;
  let fieldEvidence = [...effectiveOutput.field_evidence];
  const evidenceFields = new Set<EmailExtractionField>();
  const normalizedValueFields = new Set<EmailExtractionField>();
  if (amountNeedsCorrection) normalizedValueFields.add("amount");

  const repair = (
    field: EmailExtractionField,
    value: unknown,
    validates: (quote: string) => boolean,
  ) => {
    if (value === null) return;
    const current = fieldEvidence
      .filter((item) => item.field === field)
      .map((item) => item.quote);
    if (
      current.some(
        (quote) =>
          normalizedContent.includes(normalizeEvidenceText(quote)) &&
          validates(quote),
      )
    ) {
      return;
    }
    const quote = segments.find(validates);
    if (!quote) return;
    fieldEvidence = [
      ...fieldEvidence.filter((item) => item.field !== field),
      { field, quote },
    ];
    evidenceFields.add(field);
  };

  for (const field of [
    "notice_kind",
    "operation_status",
    "direction",
  ] as const) {
    repair(field, effectiveOutput[field], () => true);
  }
  repair(
    "amount",
    effectiveOutput.amount,
    (quote) =>
      effectiveOutput.amount !== null &&
      extractAmounts(quote).some(
        (candidate) =>
          Math.abs(candidate - effectiveOutput.amount!) < 0.005,
      ),
  );
  repair(
    "currency",
    effectiveOutput.currency,
    (quote) =>
      effectiveOutput.currency !== null &&
      currencyEvidenceMatchesValue(quote, effectiveOutput.currency),
  );
  repair(
    "occurred_at",
    effectiveOutput.occurred_at,
    (quote) =>
      effectiveOutput.occurred_at !== null &&
      dateEvidenceMatchesValue(quote, effectiveOutput.occurred_at),
  );
  repair(
    "merchant",
    effectiveOutput.merchant,
    (quote) =>
      effectiveOutput.merchant !== null &&
      normalizeEvidenceText(quote).includes(
        normalizeEvidenceText(effectiveOutput.merchant),
      ),
  );
  for (const field of [
    "account_hint",
    "account_origin_hint",
    "account_destination_hint",
  ] as const) {
    repair(
      field,
      effectiveOutput[field],
      (quote) =>
        effectiveOutput[field] !== null &&
        accountEvidenceMatchesValue(quote, effectiveOutput[field]),
    );
  }
  repair(
    "operation_identifier",
    effectiveOutput.operation_identifier,
    (quote) =>
      effectiveOutput.operation_identifier !== null &&
      normalizeIdentifier(quote).includes(
        normalizeIdentifier(effectiveOutput.operation_identifier),
      ),
  );

  const amountGrounded =
    effectiveOutput.amount === null ||
    fieldEvidence
      .filter((item) => item.field === "amount")
      .some(
        (item) =>
          normalizedContent.includes(
            normalizeEvidenceText(item.quote),
          ) &&
          extractAmounts(item.quote).some(
            (candidate) =>
              Math.abs(candidate - effectiveOutput.amount!) < 0.005,
          ),
      );
  const shouldDropUngroundedOptionalAmount =
    effectiveOutput.operation_status !== "completed" &&
    effectiveOutput.amount !== null &&
    !amountGrounded;
  let finalOutput: EmailExtractionOutput =
    shouldDropUngroundedOptionalAmount
      ? {
        ...effectiveOutput,
        amount: null,
        missing_fields: [
          ...new Set([...effectiveOutput.missing_fields, "amount" as const]),
        ],
      }
      : effectiveOutput;
  if (shouldDropUngroundedOptionalAmount) {
    fieldEvidence = fieldEvidence.filter(
      (item) => item.field !== "amount",
    );
    normalizedValueFields.add("amount");
  }
  const occurredAtGrounded =
    effectiveOutput.occurred_at === null ||
    fieldEvidence
      .filter((item) => item.field === "occurred_at")
      .some(
        (item) =>
          normalizedContent.includes(
            normalizeEvidenceText(item.quote),
          ) &&
          dateEvidenceMatchesValue(
            item.quote,
            effectiveOutput.occurred_at!,
          ),
      );
  const shouldDropUngroundedOptionalDate =
    effectiveOutput.operation_status !== "completed" &&
    effectiveOutput.occurred_at !== null &&
    !occurredAtGrounded;
  if (shouldDropUngroundedOptionalDate) {
    finalOutput = {
      ...finalOutput,
      occurred_at: null,
      missing_fields: [
        ...new Set([...finalOutput.missing_fields, "occurred_at" as const]),
      ],
    };
    fieldEvidence = fieldEvidence.filter(
      (item) => item.field !== "occurred_at",
    );
    normalizedValueFields.add("occurred_at");
  }

  return {
    output: {
      ...finalOutput,
      field_evidence: fieldEvidence.slice(0, 24),
    },
    repairs: {
      evidence_fields: [...evidenceFields],
      normalized_value_fields: [...normalizedValueFields],
    },
  };
}

function buildEvidenceSegments(content: string): string[] {
  const segments: string[] = [];
  for (const raw of content.split(/\r?\n+/)) {
    const clean = raw.replace(/\s+/g, " ").trim();
    if (!clean) continue;
    if (clean.length <= 240) {
      segments.push(clean);
      continue;
    }
    for (let start = 0; start < clean.length; start += 160) {
      segments.push(clean.slice(start, start + 240).trim());
    }
  }
  return segments;
}

function currencyEvidenceMatchesValue(
  quote: string,
  value: "PEN" | "USD",
): boolean {
  const normalized = normalizeEvidenceText(quote);
  return value === "PEN"
    ? /(?:s\s*\/|pen|\bsol(?:es)?\b)/i.test(normalized)
    : /(?:usd|us\s*\$|\bdolar(?:es)?\b)/i.test(normalized);
}

function accountEvidenceMatchesValue(
  quote: string,
  value: string,
): boolean {
  const normalizedValue = normalizeIdentifier(value);
  const normalizedQuote = normalizeIdentifier(quote);
  if (normalizedQuote.includes(normalizedValue)) return true;
  const valueDigits = value.replace(/\D/g, "");
  const quoteDigits = quote.replace(/\D/g, "");
  return valueDigits.length >= 4 && quoteDigits.includes(valueDigits);
}

function extractAmounts(value: string): number[] {
  const normalized = normalizeEvidenceText(value);
  const before = [
    ...normalized.matchAll(
      /(?:s\s*\/|pen|usd|us\s*\$|\$|sol(?:es)?|dolar(?:es)?)\s*([\d.,]+)/gi,
    ),
  ].map((match) => match[1] ?? "");
  const after = [
    ...normalized.matchAll(
      /([\d.,]+)\s*(?:pen|usd|sol(?:es)?|dolar(?:es)?)\b/gi,
    ),
  ].map((match) => match[1] ?? "");
  return [...before, ...after]
    .map(parseAmount)
    .filter((amount): amount is number => amount !== null);
}

function uniqueNumbers(values: number[]): number[] {
  const unique: number[] = [];
  for (const value of values) {
    if (
      !unique.some((candidate) => Math.abs(candidate - value) < 0.005)
    ) {
      unique.push(value);
    }
  }
  return unique;
}

function dateEvidenceMatchesValue(quote: string, value: string): boolean {
  const target = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!target) return false;
  const targetYear = Number(target[1]);
  const targetMonth = Number(target[2]);
  const targetDay = Number(target[3]);
  const normalized = normalizeEvidenceText(quote);

  for (const match of normalized.matchAll(
    /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/g,
  )) {
    if (
      Number(match[1]) === targetDay &&
      Number(match[2]) === targetMonth &&
      normalizeYear(Number(match[3])) === targetYear
    ) {
      return true;
    }
  }

  for (const match of normalized.matchAll(
    /\b(20\d{2})-(\d{2})-(\d{2})\b/g,
  )) {
    if (
      Number(match[1]) === targetYear &&
      Number(match[2]) === targetMonth &&
      Number(match[3]) === targetDay
    ) {
      return true;
    }
  }

  for (const match of normalized.matchAll(
    /\b(\d{1,2})\s+(?:de(?:l)?\s+)?([a-z]{3,12})\.?\s+(?:de(?:l)?\s+)?(\d{4})\b/g,
  )) {
    if (
      Number(match[1]) === targetDay &&
      MONTH_NUMBERS[match[2] ?? ""] === targetMonth &&
      Number(match[3]) === targetYear
    ) {
      return true;
    }
  }

  return false;
}

function normalizeYear(value: number): number {
  return value < 100 ? 2000 + value : value;
}

const MONTH_NUMBERS: Record<string, number> = {
  ene: 1,
  enero: 1,
  jan: 1,
  january: 1,
  feb: 2,
  febrero: 2,
  february: 2,
  mar: 3,
  marzo: 3,
  march: 3,
  abr: 4,
  abril: 4,
  apr: 4,
  april: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  junio: 6,
  june: 6,
  jul: 7,
  julio: 7,
  july: 7,
  ago: 8,
  agosto: 8,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  septiembre: 9,
  september: 9,
  oct: 10,
  octubre: 10,
  october: 10,
  nov: 11,
  noviembre: 11,
  november: 11,
  dic: 12,
  diciembre: 12,
  dec: 12,
  december: 12,
};

function parseAmount(value: string): number | null {
  const compact = value.replace(/\s/g, "");
  if (!compact) return null;
  const decimalSeparator =
    compact.includes(",") && compact.includes(".")
      ? compact.lastIndexOf(",") > compact.lastIndexOf(".")
        ? ","
        : "."
      : compact.includes(",")
        ? ","
        : ".";
  const normalized =
    decimalSeparator === ","
      ? compact.replace(/\./g, "").replace(",", ".")
      : compact.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
