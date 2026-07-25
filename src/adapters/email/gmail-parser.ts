import { createHash } from "node:crypto";
import { z } from "zod";
import type { GmailMessage, GmailMessagePart } from "./contracts";

export type GmailParserTemplate = {
  id: string;
  institutionKey: string;
  templateVersion: string;
  sender: string;
  parserConfig?: Record<string, unknown>;
};

export type ParsedGmailMovement = {
  movementType: "gasto" | "ingreso";
  direction: "out" | "in";
  amount: number;
  currency: "PEN" | "USD";
  occurredAt: string;
  description: string;
  merchant: string | null;
  accountHint: string | null;
  accountOriginHint?: string | null;
  accountDestinationHint?: string | null;
  operationIdentifier?: string | null;
  operationHint:
    | "purchase"
    | "income"
    | "transfer"
    | "refund"
    | "debt_installment"
    | "unknown";
  institutionKey: string;
  institutionAliases: string[];
  sender: string;
  subjectHash: string;
  contentHash: string;
  templateId: string;
  templateVersion: string;
  parseMode: "agent" | "template" | "generic_fallback";
  matchedSubjectPattern: string | null;
  confidence: number;
};

export type GmailParseFailureCode =
  | "invalid_template_config"
  | "subject_not_matched"
  | "required_fields_missing"
  | "generic_fallback_failed";

export type GmailParseOutcome =
  | {
      status: "parsed";
      movement: ParsedGmailMovement;
      invalidTemplateIds: string[];
    }
  | {
      status: "failed";
      failureCode: GmailParseFailureCode;
      templateId: string | null;
      institutionKey: string | null;
      subjectHash: string;
      contentHash: string;
      invalidTemplateIds: string[];
    };

const ExtractionRuleSchema = z
  .object({
    pattern: z.string().min(1).max(240),
    type: z.enum(["number", "string", "datetime"]),
    group: z.number().int().min(1).max(10).default(1),
    format: z
      .enum([
        "DD/MM/YYYY HH:mm",
        "DD/MM/YYYY",
        "YYYY-MM-DD HH:mm",
        "YYYY-MM-DD",
        "ISO",
      ])
      .optional(),
  })
  .strict();

export const GmailParserConfigSchema = z
  .object({
    schema_version: z.literal("gmail_parser_v1"),
    subject_patterns: z.array(z.string().trim().min(2).max(160)).min(1).max(30),
    extraction_rules: z
      .object({
        amount: ExtractionRuleSchema,
        merchant: ExtractionRuleSchema.optional(),
        occurred_at: ExtractionRuleSchema.optional(),
        account_hint: ExtractionRuleSchema.optional(),
        direction: z.enum(["out", "in"]),
        currency: z.enum(["PEN", "USD"]).optional(),
        operation_hint: z
          .enum([
            "purchase",
            "income",
            "transfer",
            "refund",
            "debt_installment",
            "unknown",
          ])
          .default("unknown"),
      })
      .strict(),
    allow_generic_fallback: z.boolean().default(true),
    confidence: z
      .object({
        template: z.number().min(0.5).max(1).default(0.93),
        fallback: z.number().min(0.3).max(0.79).default(0.55),
      })
      .strict()
      .default({ template: 0.93, fallback: 0.55 }),
    institution_aliases: z
      .array(z.string().trim().min(1).max(80))
      .max(20)
      .default([]),
  })
  .strict()
  .superRefine((config, context) => {
    for (const [field, rule] of Object.entries(config.extraction_rules)) {
      if (
        typeof rule === "object" &&
        rule !== null &&
        "pattern" in rule &&
        !isSafeConfiguredPattern(rule.pattern)
      ) {
        context.addIssue({
          code: "custom",
          path: ["extraction_rules", field, "pattern"],
          message: "Patron regex no permitido o potencialmente inseguro",
        });
      }
    }
  });

export type GmailParserConfig = z.infer<typeof GmailParserConfigSchema>;

export type GmailExtractionTemplateSelection = {
  template: GmailParserTemplate;
  config: GmailParserConfig;
  matchedSubjectPattern: string | null;
  invalidTemplateIds: string[];
};

export function selectGmailTemplateForExtraction(
  message: GmailMessage,
  templates: GmailParserTemplate[],
): GmailExtractionTemplateSelection | null {
  const sender = normalizeEmailAddress(getGmailHeader(message, "From"));
  if (!sender) return null;
  const subject = getGmailHeader(message, "Subject") ?? "";
  const parsedConfigs = templates
    .filter(
      (template) => template.sender.trim().toLowerCase() === sender,
    )
    .map((template) => ({
      template,
      config: GmailParserConfigSchema.safeParse(template.parserConfig),
    }));
  const invalidTemplateIds = parsedConfigs
    .filter((entry) => !entry.config.success)
    .map((entry) => entry.template.id);
  const validTemplates = parsedConfigs.flatMap((entry) =>
    entry.config.success
      ? [{ template: entry.template, config: entry.config.data }]
      : [],
  );
  const subjectMatch = validTemplates.find(({ config }) =>
    config.subject_patterns.some((pattern) =>
      subjectIncludes(subject, pattern),
    ),
  );
  const selected =
    subjectMatch ??
    validTemplates.find(({ config }) => config.allow_generic_fallback);
  if (!selected) return null;
  return {
    ...selected,
    matchedSubjectPattern:
      selected.config.subject_patterns.find((pattern) =>
        subjectIncludes(subject, pattern),
      ) ?? null,
    invalidTemplateIds,
  };
}

export function getGmailHeader(
  message: GmailMessage,
  name: string,
): string | null {
  const header = message.payload?.headers.find(
    (item) => item.name.toLowerCase() === name.toLowerCase(),
  );
  return header?.value.trim() || null;
}

export function normalizeEmailAddress(value: string | null): string | null {
  if (!value) return null;
  const angle = /<([^<>\s]+@[^<>\s]+)>/.exec(value);
  const raw = angle?.[1] ?? value.match(/[^\s<>,;]+@[^\s<>,;]+/)?.[0];
  return raw?.trim().toLowerCase() ?? null;
}

export function matchesVerifiedSender(
  message: GmailMessage,
  expectedSender: string,
): boolean {
  return normalizeEmailAddress(getGmailHeader(message, "From")) ===
    expectedSender.trim().toLowerCase();
}

export function parseGmailMovement(
  message: GmailMessage,
  template: GmailParserTemplate,
): ParsedGmailMovement | null {
  const outcome = parseGmailMovementWithTemplates(message, [template]);
  return outcome.status === "parsed" ? outcome.movement : null;
}

export function parseGmailMovementWithTemplates(
  message: GmailMessage,
  templates: GmailParserTemplate[],
): GmailParseOutcome {
  const sender = normalizeEmailAddress(getGmailHeader(message, "From"));
  const subject = getGmailHeader(message, "Subject") ?? "";
  const body = extractMessageText(message);
  const content = `${subject}\n${body}`.replace(/\s+/g, " ").trim();
  const subjectHash = sha256(subject);
  const contentHash = sha256(content);
  const candidateTemplates = sender
    ? templates.filter(
        (template) => template.sender.trim().toLowerCase() === sender,
      )
    : [];
  const parsedConfigs = candidateTemplates.map((template) => ({
    template,
    config: GmailParserConfigSchema.safeParse(template.parserConfig),
  }));
  const invalidTemplateIds = parsedConfigs
    .filter((entry) => !entry.config.success)
    .map((entry) => entry.template.id);
  const validTemplates = parsedConfigs.flatMap((entry) =>
    entry.config.success
      ? [{ template: entry.template, config: entry.config.data }]
      : [],
  );

  if (!sender || !content || candidateTemplates.length === 0) {
    return failure(
      "required_fields_missing",
      null,
      subjectHash,
      contentHash,
      invalidTemplateIds,
    );
  }
  if (validTemplates.length === 0) {
    return failure(
      "invalid_template_config",
      candidateTemplates[0] ?? null,
      subjectHash,
      contentHash,
      invalidTemplateIds,
    );
  }

  const subjectMatch = validTemplates.find(({ config }) =>
    config.subject_patterns.some((pattern) => subjectIncludes(subject, pattern)),
  );
  if (subjectMatch) {
    const matchedSubjectPattern =
      subjectMatch.config.subject_patterns.find((pattern) =>
        subjectIncludes(subject, pattern),
      ) ?? null;
    const parsed = parseWithConfiguredTemplate({
      message,
      content,
      subject,
      sender,
      template: subjectMatch.template,
      config: subjectMatch.config,
      matchedSubjectPattern,
    });
    if (parsed) {
      return { status: "parsed", movement: parsed, invalidTemplateIds };
    }
  }

  const fallbackTemplate = validTemplates.find(
    ({ config }) => config.allow_generic_fallback,
  );
  if (fallbackTemplate) {
    const parsed = parseWithGenericFallback({
      message,
      content,
      subject,
      sender,
      template: fallbackTemplate.template,
      config: fallbackTemplate.config,
    });
    if (parsed) {
      return { status: "parsed", movement: parsed, invalidTemplateIds };
    }
  }

  return failure(
    subjectMatch ? "required_fields_missing" : fallbackTemplate
      ? "generic_fallback_failed"
      : "subject_not_matched",
    subjectMatch?.template ?? fallbackTemplate?.template ?? validTemplates[0]?.template ?? null,
    subjectHash,
    contentHash,
    invalidTemplateIds,
  );
}

export function extractMessageText(message: GmailMessage): string {
  if (!message.payload) return "";
  const plain: string[] = [];
  const html: string[] = [];
  collectText(message.payload, plain, html);
  const selected = plain.length > 0 ? plain.join("\n") : html.join("\n");
  return stripHtml(selected).replace(/\s+/g, " ").trim();
}

function collectText(
  part: GmailMessagePart | NonNullable<GmailMessage["payload"]>,
  plain: string[],
  html: string[],
) {
  const decoded = decodeBase64Url(part.body?.data ?? null);
  if (decoded && part.mimeType?.toLowerCase().startsWith("text/plain")) {
    plain.push(decoded);
  } else if (decoded && part.mimeType?.toLowerCase().startsWith("text/html")) {
    html.push(decoded);
  }
  for (const child of part.parts) collectText(child, plain, html);
}

function decodeBase64Url(value: string | null): string {
  if (!value || !/^[A-Za-z0-9_-]+={0,2}$/.test(value)) return "";
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return "";
  }
}

function stripHtml(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function parseWithConfiguredTemplate(input: {
  message: GmailMessage;
  content: string;
  subject: string;
  sender: string;
  template: GmailParserTemplate;
  config: GmailParserConfig;
  matchedSubjectPattern: string | null;
}): ParsedGmailMovement | null {
  const amountValue = extractConfiguredValue(
    input.content,
    input.config.extraction_rules.amount,
  );
  const amount = amountValue ? parseFinancialAmount(amountValue) : null;
  if (!amount) return null;

  const direction = input.config.extraction_rules.direction;
  const movementType = direction === "out" ? "gasto" : "ingreso";
  const merchantRule = input.config.extraction_rules.merchant;
  const merchant = merchantRule
    ? cleanExtractedText(extractConfiguredValue(input.content, merchantRule), 160)
    : extractMerchant(input.content);
  const dateRule = input.config.extraction_rules.occurred_at;
  const occurredAt = dateRule
    ? parseConfiguredDate(
        extractConfiguredValue(input.content, dateRule),
        dateRule.format,
      )
    : extractOccurredAt(input.message, input.content);
  if (!occurredAt) return null;
  const accountRule = input.config.extraction_rules.account_hint;
  const accountHint = accountRule
    ? cleanExtractedText(
        extractConfiguredValue(input.content, accountRule),
        120,
      )
    : extractAccountHint(input.content);
  const currency =
    input.config.extraction_rules.currency ?? extractCurrency(input.content);

  return buildParsedMovement({
    ...input,
    direction,
    movementType,
    amount,
    currency,
    occurredAt,
    merchant,
    accountHint,
    operationHint: input.config.extraction_rules.operation_hint,
    parseMode: "template",
    matchedSubjectPattern: input.matchedSubjectPattern,
    confidence: input.config.confidence.template,
  });
}

function parseWithGenericFallback(input: {
  message: GmailMessage;
  content: string;
  subject: string;
  sender: string;
  template: GmailParserTemplate;
  config: GmailParserConfig;
}): ParsedGmailMovement | null {
  const amount = extractAmount(input.content);
  const movementType = extractDirection(input.content);
  const occurredAt = extractOccurredAt(input.message, input.content);
  if (!amount || !movementType || !occurredAt) return null;
  const direction = movementType === "gasto" ? "out" : "in";

  return buildParsedMovement({
    ...input,
    direction,
    movementType,
    amount,
    currency: extractCurrency(input.content),
    occurredAt,
    merchant: extractMerchant(input.content),
    accountHint: extractAccountHint(input.content),
    operationHint: inferOperationHint(input.content, direction),
    parseMode: "generic_fallback",
    matchedSubjectPattern: null,
    confidence: input.config.confidence.fallback,
  });
}

function buildParsedMovement(input: {
  content: string;
  subject: string;
  sender: string;
  template: GmailParserTemplate;
  config: GmailParserConfig;
  direction: "out" | "in";
  movementType: "gasto" | "ingreso";
  amount: number;
  currency: "PEN" | "USD";
  occurredAt: string;
  merchant: string | null;
  accountHint: string | null;
  operationHint: ParsedGmailMovement["operationHint"];
  parseMode: "template" | "generic_fallback";
  matchedSubjectPattern: string | null;
  confidence: number;
}): ParsedGmailMovement {
  const institutionLabel = humanizeInstitutionKey(input.template.institutionKey);
  const description = input.merchant
    ? `${input.movementType === "gasto" ? "Compra" : "Ingreso"} - ${input.merchant}`
    : `${input.movementType === "gasto" ? "Salida" : "Ingreso"} detectado - ${institutionLabel}`;
  return {
    movementType: input.movementType,
    direction: input.direction,
    amount: input.amount,
    currency: input.currency,
    occurredAt: input.occurredAt,
    description,
    merchant: input.merchant,
    accountHint: input.accountHint,
    operationHint: input.operationHint,
    institutionKey: input.template.institutionKey,
    institutionAliases: input.config.institution_aliases,
    sender: input.sender,
    subjectHash: sha256(input.subject),
    contentHash: sha256(input.content),
    templateId: input.template.id,
    templateVersion: input.template.templateVersion,
    parseMode: input.parseMode,
    matchedSubjectPattern: input.matchedSubjectPattern,
    confidence: input.confidence,
  };
}

function failure(
  failureCode: GmailParseFailureCode,
  template: GmailParserTemplate | null,
  subjectHash: string,
  contentHash: string,
  invalidTemplateIds: string[],
): GmailParseOutcome {
  return {
    status: "failed",
    failureCode,
    templateId: template?.id ?? null,
    institutionKey: template?.institutionKey ?? null,
    subjectHash,
    contentHash,
    invalidTemplateIds,
  };
}

function subjectIncludes(subject: string, pattern: string): boolean {
  return normalizeComparableText(subject).includes(normalizeComparableText(pattern));
}

function extractConfiguredValue(
  content: string,
  rule: z.infer<typeof ExtractionRuleSchema>,
): string | null {
  const regex = compileConfiguredPattern(rule.pattern);
  if (!regex) return null;
  const match = regex.exec(content);
  return match?.[rule.group]?.trim() || null;
}

function compileConfiguredPattern(pattern: string): RegExp | null {
  if (!isSafeConfiguredPattern(pattern)) return null;
  try {
    return new RegExp(pattern, "iu");
  } catch {
    return null;
  }
}

function isSafeConfiguredPattern(pattern: string): boolean {
  if (
    pattern.length === 0 ||
    pattern.length > 240 ||
    /[\u0000-\u001f]/.test(pattern) ||
    /\\[1-9]/.test(pattern) ||
    /\(\?(?:[=!]|<[=!])/.test(pattern)
  ) {
    return false;
  }
  // Bloquea el caso comun de catastrophic backtracking: un grupo con
  // cuantificador interno seguido por otro cuantificador.
  if (/\((?:[^()]|\\.)*[+*}](?:[^()]|\\.)*\)\s*(?:[+*]|\{\d)/.test(pattern)) {
    return false;
  }
  try {
    void new RegExp(pattern, "iu");
    return true;
  } catch {
    return false;
  }
}

function parseFinancialAmount(value: string): number | null {
  const compact = value.replace(/[^\d.,-]/g, "");
  if (!compact || compact.startsWith("-")) return null;
  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  const decimalIndex = Math.max(lastComma, lastDot);
  let normalized: string;
  if (decimalIndex >= 0 && compact.length - decimalIndex - 1 === 2) {
    normalized =
      compact.slice(0, decimalIndex).replace(/[.,]/g, "") +
      "." +
      compact.slice(decimalIndex + 1);
  } else {
    normalized = compact.replace(/[.,]/g, "");
  }
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 && amount <= 999_999_999.99
    ? Math.round(amount * 100) / 100
    : null;
}

function parseConfiguredDate(
  value: string | null,
  format: z.infer<typeof ExtractionRuleSchema>["format"],
): string | null {
  if (!value) return null;
  if (!format || format === "ISO") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (format === "DD/MM/YYYY HH:mm" || format === "DD/MM/YYYY") {
    const match =
      /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/.exec(value);
    if (!match) return null;
    return localPeruDate(
      Number(match[3]),
      Number(match[2]),
      Number(match[1]),
      Number(match[4] ?? 12),
      Number(match[5] ?? 0),
    );
  }
  const match =
    /^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?$/.exec(value);
  if (!match) return null;
  return localPeruDate(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4] ?? 12),
    Number(match[5] ?? 0),
  );
}

function localPeruDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): string | null {
  if (
    year < 2000 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  const date = new Date(
    `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-05:00`,
  );
  if (Number.isNaN(date.getTime())) return null;
  const peruParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const parts = Object.fromEntries(
    peruParts.map((part) => [part.type, part.value]),
  );
  if (
    Number(parts.year) !== year ||
    Number(parts.month) !== month ||
    Number(parts.day) !== day ||
    Number(parts.hour) !== hour ||
    Number(parts.minute) !== minute
  ) {
    return null;
  }
  return date.toISOString();
}

function cleanExtractedText(
  value: string | null,
  maxLength: number,
): string | null {
  return value?.replace(/\s+/g, " ").trim().slice(0, maxLength) || null;
}

function humanizeInstitutionKey(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())
    .slice(0, 80);
}

function normalizeComparableText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function extractAmount(content: string): number | null {
  const matches = content.matchAll(
    /(?:S\/?|PEN|US\$|USD|\$)\s*([0-9]{1,9}(?:[.,][0-9]{2})?)/gi,
  );
  for (const match of matches) {
    const normalized = match[1]?.replace(",", ".");
    const amount = normalized ? Number(normalized) : Number.NaN;
    if (Number.isFinite(amount) && amount > 0 && amount <= 999_999_999.99) {
      return Math.round(amount * 100) / 100;
    }
  }
  return null;
}

function extractCurrency(content: string): "PEN" | "USD" {
  return /(?:US\$|USD|d[oó]lares?)/i.test(content) ? "USD" : "PEN";
}

function extractDirection(content: string): "gasto" | "ingreso" | null {
  if (
    /\b(compra|consumo|pagaste|pago realizado|cargo|d[eé]bito|retiro)\b/i.test(
      content,
    )
  ) {
    return "gasto";
  }
  if (
    /\b(dep[oó]sito|abono|recibiste|transferencia recibida|ingreso)\b/i.test(
      content,
    )
  ) {
    return "ingreso";
  }
  return null;
}

function extractOccurredAt(message: GmailMessage, content: string): string | null {
  const iso = /\b(20\d{2}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2})(?::\d{2})?)?\b/.exec(
    content,
  );
  if (iso?.[1]) {
    const date = new Date(`${iso[1]}T${iso[2] ?? "12:00"}:00-05:00`);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  const internalDate = Number(message.internalDate);
  if (Number.isFinite(internalDate) && internalDate > 0) {
    return new Date(internalDate).toISOString();
  }
  const headerDate = getGmailHeader(message, "Date");
  if (headerDate) {
    const date = new Date(headerDate);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

function extractMerchant(content: string): string | null {
  const match =
    /\b(?:comercio|establecimiento|en)\b\s*[:\-]?\s*([\p{L}\p{N}][\p{L}\p{N} .&'_-]{1,60}?)(?=\s+(?:por|el|fecha|monto|S\/?|PEN|US\$|USD)|[.,;]|$)/iu.exec(
      content,
    );
  return match?.[1]?.trim().replace(/\s+/g, " ").slice(0, 160) || null;
}

function extractAccountHint(content: string): string | null {
  const match =
    /\b(?:cuenta|tarjeta|cta\.?|card)\b[^\d]{0,24}(?:\*{2,}|x{2,})?\s*(\d{4})\b/iu.exec(
      content,
    );
  return match?.[1] ?? null;
}

function inferOperationHint(
  content: string,
  direction: "out" | "in",
): ParsedGmailMovement["operationHint"] {
  if (
    /\b(recarga|entre tus cuentas|transferencia interna|cuenta propia)\b/iu.test(
      content,
    )
  ) {
    return "transfer";
  }
  if (
    /\b(devoluci[oó]n|reembolso|reversa de compra|extorno)\b/iu.test(content)
  ) {
    return "refund";
  }
  if (
    /\b(cuota|cr[eé]dito|pr[eé]stamo|pago de tarjeta)\b/iu.test(content)
  ) {
    return "debt_installment";
  }
  if (/\b(transferencia|traspaso)\b/iu.test(content)) return "transfer";
  return direction === "out" ? "purchase" : "income";
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
