import type {
  AgentRuntimeRequest,
  AgentRuntimeResponse,
} from "@/agents/runtime";
import {
  EmailExtractionContextPackSchema,
  EmailExtractionOutputSchema,
  type EmailExtractionField,
  type EmailExtractionOutput,
} from "./types";

export class LocalFixtureEmailExtractionAgentRuntime {
  async run<TContext, TOutput>(
    request: AgentRuntimeRequest<TContext>,
  ): Promise<AgentRuntimeResponse<TOutput>> {
    const context = EmailExtractionContextPackSchema.parse(
      request.context_pack,
    );
    const output = EmailExtractionOutputSchema.parse(
      extractFixtureEmail(context.subject, context.body_text),
    );
    return {
      output: output as TOutput,
      confidence: output.confidence,
      tool_calls: [],
      runtime: {
        provider: "local_fixture",
        model_name: "email-extraction-fixture-v1",
        latency_ms: 0,
      },
      safety: {
        policy_flags: [
          "extraction_only",
          "untrusted_email_content",
          "no_financial_decision",
          "no_persistence",
        ],
        redaction_applied: false,
      },
    };
  }
}

function extractFixtureEmail(
  subject: string,
  body: string,
): EmailExtractionOutput {
  const content = `${subject}\n${body}`;
  const normalized = normalize(content);
  const rejected =
    /rechaz|fondos insuficientes|denegad|no se pudo completar/.test(
      normalized,
    );
  const transfer =
    /transferencia entre (?:tus|mis) cuentas|cuenta origen|cuenta destino/.test(
      normalized,
    );
  const refund = /devolucion|reembolso|extorno/.test(normalized);
  const withdrawal = /retiro|cajero/.test(normalized);
  const deposit = /abono|deposito/.test(normalized);
  const purchase = /consumo|compra|comercio|establecimiento/.test(normalized);
  const noticeKind = rejected
    ? "rejected_attempt"
    : transfer
      ? "transfer"
      : refund
        ? "refund"
        : withdrawal
          ? "cash_withdrawal"
          : deposit
            ? "deposit"
            : purchase
              ? "purchase"
              : "unknown";
  const operationStatus = rejected
    ? "rejected"
    : noticeKind === "unknown"
      ? "unknown"
      : "completed";
  const direction = transfer
    ? "internal"
    : refund || deposit
      ? "in"
      : purchase || withdrawal || rejected
        ? "out"
        : "unknown";
  const amountMatch =
    /(?:s\/|pen|usd|us\$|\$)\s*([\d.,]+)/i.exec(content);
  const amount = amountMatch ? parseAmount(amountMatch[1] ?? "") : null;
  const amountQuote = amountMatch?.[0] ?? null;
  const currency = amountQuote
    ? /usd|us\$|\$/i.test(amountQuote)
      ? "USD"
      : "PEN"
    : null;
  const dateMatch =
    /\b(\d{1,2}[/-]\d{1,2}[/-]\d{4})[^\d]{0,24}(\d{1,2}:\d{2})\b/.exec(
      content,
    ) ??
    /\b(20\d{2}-\d{2}-\d{2})[^\d]{0,8}(\d{1,2}:\d{2})\b/.exec(
      content,
    );
  const occurredAt = dateMatch
    ? parseLimaDate(dateMatch[1]!, dateMatch[2]!)
    : null;
  const merchantMatch =
    /(?:comercio|establecimiento)\s*[:\-]\s*([^\n|]{2,120})/i.exec(body) ??
    /(?:consumo|compra)\s+(?:en|a)\s+([^\n|]{2,120}?)(?=\s+(?:por|de)\s+(?:s\/|pen|usd|us\$|\$))/i.exec(
      body,
    );
  const merchant = cleanText(merchantMatch?.[1] ?? null);
  const originMatch = findHint(
    body,
    /(?:cuenta\s+origen|desde\s+(?:tu\s+)?cuenta)[^\n]{0,80}?(\d{4})/i,
  );
  const destinationMatch = findHint(
    body,
    /(?:cuenta\s+destino|hacia\s+(?:tu\s+)?cuenta|a\s+(?:tu\s+)?cuenta)[^\n]{0,80}?(\d{4})/i,
  );
  const accountMatch = findHint(
    body,
    /(?:tarjeta|cuenta)[^\n]{0,80}?(?:\*{2,}|x{2,})?(\d{4})/i,
  );
  const operationMatch =
    /(?:operacion|constancia|codigo|numero|nro\.?)\s*[:#-]?\s*([a-z0-9-]{4,40})/i.exec(
      normalize(body),
    );
  const operationIdentifier = cleanText(operationMatch?.[1] ?? null);
  const evidence: EmailExtractionOutput["field_evidence"] = [];
  const classificationQuote =
    cleanText(subject) ??
    cleanText(content.slice(0, 200)) ??
    "Aviso financiero";
  pushEvidence(evidence, "notice_kind", classificationQuote);
  pushEvidence(evidence, "operation_status", classificationQuote);
  pushEvidence(evidence, "direction", classificationQuote);
  if (amountQuote) {
    pushEvidence(evidence, "amount", amountQuote);
    pushEvidence(evidence, "currency", amountQuote);
  }
  if (dateMatch?.[0]) pushEvidence(evidence, "occurred_at", dateMatch[0]);
  if (merchant && merchantMatch?.[0]) {
    pushEvidence(evidence, "merchant", merchantMatch[0]);
  }
  if (accountMatch) {
    pushEvidence(evidence, "account_hint", accountMatch.quote);
  }
  if (originMatch) {
    pushEvidence(evidence, "account_origin_hint", originMatch.quote);
  }
  if (destinationMatch) {
    pushEvidence(
      evidence,
      "account_destination_hint",
      destinationMatch.quote,
    );
  }
  if (operationIdentifier && operationMatch?.[0]) {
    pushEvidence(evidence, "operation_identifier", operationMatch[0]);
  }
  const missingFields: EmailExtractionField[] = [];
  if (amount === null) missingFields.push("amount");
  if (currency === null) missingFields.push("currency");
  if (occurredAt === null) missingFields.push("occurred_at");
  if (direction === "unknown") missingFields.push("direction");

  return {
    notice_kind: noticeKind,
    operation_status: operationStatus,
    direction,
    amount,
    currency,
    occurred_at: occurredAt,
    merchant,
    account_hint: accountMatch?.value ?? null,
    account_origin_hint: originMatch?.value ?? null,
    account_destination_hint: destinationMatch?.value ?? null,
    operation_identifier: operationIdentifier,
    confidence:
      operationStatus !== "unknown" && missingFields.length === 0 ? 0.93 : 0.6,
    missing_fields: missingFields,
    field_evidence: evidence,
    safe_explanation:
      operationStatus === "rejected"
        ? "El aviso describe un intento rechazado; solo se extrajeron campos."
        : "Se extrajeron campos del aviso sin decidir ni registrar la operacion.",
  };
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseAmount(value: string): number | null {
  const compact = value.replace(/\s/g, "");
  const normalized =
    compact.includes(",") && !compact.includes(".")
      ? compact.replace(",", ".")
      : compact.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseLimaDate(date: string, time: string): string | null {
  const isoDate = date.includes("/")
    ? date.split("/").reverse().join("-")
    : date;
  const value = `${isoDate}T${time.padStart(5, "0")}:00-05:00`;
  return Number.isNaN(new Date(value).getTime()) ? null : value;
}

function findHint(
  body: string,
  pattern: RegExp,
): { value: string; quote: string } | null {
  const match = pattern.exec(body);
  return match?.[1] && match[0]
    ? { value: match[1], quote: match[0] }
    : null;
}

function cleanText(value: string | null): string | null {
  const text = value?.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 180) : null;
}

function pushEvidence(
  evidence: EmailExtractionOutput["field_evidence"],
  field: EmailExtractionField,
  quote: string,
) {
  evidence.push({ field, quote: quote.replace(/\s+/g, " ").trim().slice(0, 240) });
}
