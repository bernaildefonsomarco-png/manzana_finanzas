import { z } from "zod";
import {
  CategoryIdSchema,
  MovementDecimalAmountSchema,
  PendingSourceSchema,
  PendingStatusSchema,
  PendingTypeSchema,
} from "@/shared/schemas/money";

export const ListPendingQuerySchema = z
  .object({
    status: PendingStatusSchema.optional(),
    source: PendingSourceSchema.optional(),
    type: PendingTypeSchema.optional(),
    include_resolved: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
    limit: z.coerce.number().int().positive().optional(),
    cursor: z.string().optional(),
  })
  .strict();

export const PendingSummaryPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    subtitle: z.string().trim().min(1).max(240).optional(),
    amount: MovementDecimalAmountSchema.optional(),
    currency: z.enum(["PEN", "USD"]).optional(),
    occurred_at: z.string().datetime({ offset: true }).optional(),
    category_id: CategoryIdSchema.nullable().optional(),
    account_hint: z.string().trim().min(1).max(120).nullable().optional(),
    confidence_label: z.string().trim().min(1).max(80).nullable().optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, "Resumen vacio");

export const UpdatePendingRequestSchema = z
  .object({
    normalized_summary: PendingSummaryPatchSchema,
    proposed_action: z
      .object({
        action: z
          .enum([
            "create_movement",
            "record_transfer",
            "record_debt_payment",
            "record_recurring_payment",
            "review_specialized",
          ])
          .optional(),
        account_id: z.string().uuid().nullable().optional(),
        account_origin_id: z.string().uuid().nullable().optional(),
        account_destination_id: z.string().uuid().nullable().optional(),
        debt_id: z.string().uuid().nullable().optional(),
        recurring_rule_id: z.string().uuid().nullable().optional(),
        recurring_occurrence_id: z.string().uuid().nullable().optional(),
      })
      .strict()
      .refine(
        (patch) => Object.keys(patch).length > 0,
        "Accion propuesta vacia",
      )
      .optional(),
    reason: z.string().trim().min(1).max(240).optional(),
  })
  .strict();

export const DiscardPendingRequestSchema = z
  .object({
    reason: z.string().trim().min(1).max(240).default("user_discarded"),
  })
  .strict();

/** RUL-PEND-05: distinguir "ya lo registré" de "no era eso" (discard). */
export const AlreadyRegisteredRequestSchema = z
  .object({
    movement_id: z.string().uuid().nullable().optional(),
  })
  .strict();

/** RUL-EMAIL-11/ACT-PEND-09: máximo 280 caracteres (`28` §7). */
export const PendingContextRequestSchema = z
  .object({
    context: z.string().trim().min(1).max(280),
  })
  .strict();

export type ListPendingQuery = z.infer<typeof ListPendingQuerySchema>;
export type PendingSummaryPatch = z.infer<typeof PendingSummaryPatchSchema>;
export type UpdatePendingRequest = z.infer<typeof UpdatePendingRequestSchema>;
export type DiscardPendingRequest = z.infer<typeof DiscardPendingRequestSchema>;
export type AlreadyRegisteredRequest = z.infer<typeof AlreadyRegisteredRequestSchema>;
export type PendingContextRequest = z.infer<typeof PendingContextRequestSchema>;
