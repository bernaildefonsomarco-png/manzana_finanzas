import { z } from "zod";

export const EmailNoticeKindSchema = z.enum([
  "purchase",
  "transfer",
  "refund",
  "cash_withdrawal",
  "deposit",
  "debt_payment",
  "recurring_payment",
  "rejected_attempt",
  "informational",
  "unknown",
]);

export const EmailOperationStatusSchema = z.enum([
  "completed",
  "rejected",
  "pending",
  "informational",
  "unknown",
]);

export const EmailExtractionFieldSchema = z.enum([
  "notice_kind",
  "operation_status",
  "direction",
  "amount",
  "currency",
  "occurred_at",
  "merchant",
  "account_hint",
  "account_origin_hint",
  "account_destination_hint",
  "operation_identifier",
]);

export const EmailExtractionContextPackSchema = z
  .object({
    context_pack_type: z.literal("email_extraction_context"),
    version: z.literal("v1"),
    institution_key: z.string().trim().min(1).max(120),
    institution_aliases: z.array(z.string().trim().min(1).max(120)).max(20),
    verified_sender: z.string().email().max(320),
    subject: z.string().max(500),
    body_text: z.string().min(1).max(60_000),
    received_at: z.string().datetime({ offset: true }),
    timezone: z.string().trim().min(1).max(80),
    template: z
      .object({
        id: z.string().trim().min(1).max(120),
        version: z.string().trim().min(1).max(80),
        matched_subject_pattern: z.string().max(160).nullable(),
      })
      .strict(),
  })
  .strict();

export const EmailExtractionEvidenceSchema = z
  .object({
    field: EmailExtractionFieldSchema,
    quote: z.string().trim().min(1).max(240),
  })
  .strict();

export const EmailExtractionOutputSchema = z
  .object({
    notice_kind: EmailNoticeKindSchema,
    operation_status: EmailOperationStatusSchema,
    direction: z.enum(["out", "in", "internal", "unknown"]),
    amount: z.number().positive().finite().max(999_999_999.99).nullable(),
    currency: z.enum(["PEN", "USD"]).nullable(),
    occurred_at: z.string().datetime({ offset: true }).nullable(),
    merchant: z.string().trim().min(1).max(180).nullable(),
    account_hint: z.string().trim().min(1).max(120).nullable(),
    account_origin_hint: z.string().trim().min(1).max(120).nullable(),
    account_destination_hint: z.string().trim().min(1).max(120).nullable(),
    operation_identifier: z.string().trim().min(1).max(160).nullable(),
    confidence: z.number().min(0).max(1),
    missing_fields: z.array(EmailExtractionFieldSchema).max(12),
    field_evidence: z.array(EmailExtractionEvidenceSchema).max(24),
    safe_explanation: z.string().trim().min(1).max(400),
  })
  .strict();

export type EmailExtractionContextPack = z.infer<
  typeof EmailExtractionContextPackSchema
>;
export type EmailExtractionOutput = z.infer<
  typeof EmailExtractionOutputSchema
>;
export type EmailExtractionField = z.infer<
  typeof EmailExtractionFieldSchema
>;

export type EmailExtractionGrounding = {
  grounded: boolean;
  errors: string[];
};
