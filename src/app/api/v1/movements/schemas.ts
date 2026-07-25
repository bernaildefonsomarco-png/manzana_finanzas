import { z } from "zod";
import {
  CategoryIdSchema,
  MovementDecimalAmountSchema,
  MovementTypeSchema,
  type MovementInput,
} from "@/shared/schemas/money";
import type { MovementPatch } from "@/core/finance/commands";

const OptionalNullableUuidSchema = z.string().uuid().nullable().optional();
const OptionalNullableTextSchema = z.string().trim().min(1).nullable().optional();
const CurrencyCodeSchema = z.enum(["PEN", "USD"]);

export const CreateMovementRequestSchema = z
  .object({
    type: MovementTypeSchema,
    amount: MovementDecimalAmountSchema,
    currency: CurrencyCodeSchema.optional(),
    occurred_at: z.string().datetime({ offset: true }),
    description: OptionalNullableTextSchema,
    merchant: OptionalNullableTextSchema,
    category_id: CategoryIdSchema.nullable().optional(),
    subcategory_id: OptionalNullableUuidSchema,
    account_origin_id: OptionalNullableUuidSchema,
    account_destination_id: OptionalNullableUuidSchema,
    box_origin_id: OptionalNullableUuidSchema,
    box_destination_id: OptionalNullableUuidSchema,
    debt_id: OptionalNullableUuidSchema,
    recurring_rule_id: OptionalNullableUuidSchema,
    related_person_id: OptionalNullableUuidSchema,
    tag_ids: z.array(z.string().uuid()).max(12).optional(),
    confidence: z.number().min(0).max(1).nullable().optional(),
    requires_review: z.boolean().optional(),
    confirm_duplicate: z.boolean().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const MovementPatchRequestSchema = CreateMovementRequestSchema.partial()
  .omit({
    confidence: true,
    confirm_duplicate: true,
    tag_ids: true,
  })
  .extend({
    confidence: z.number().min(0).max(1).nullable().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, "Patch vacio");

export const UpdateMovementRequestSchema = z
  .object({
    patch: MovementPatchRequestSchema,
    reason: z.string().trim().min(1).max(240),
  })
  .strict();

export const DeleteMovementRequestSchema = z
  .object({
    mode: z.enum(["soft_delete", "reverse"]).default("soft_delete"),
    reason: z.string().trim().min(1).max(240),
  })
  .strict();

export const ListMovementsQuerySchema = z.object({
  type: MovementTypeSchema.optional(),
  status: z
    .enum(["confirmed", "needs_review", "corrected", "deleted", "reversed"])
    .optional(),
  category_id: CategoryIdSchema.optional(),
  account_id: z.string().uuid().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  include_deleted: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateMovementRequest = z.infer<
  typeof CreateMovementRequestSchema
>;
export type UpdateMovementRequest = z.infer<
  typeof UpdateMovementRequestSchema
>;
export type DeleteMovementRequest = z.infer<
  typeof DeleteMovementRequestSchema
>;
export type ListMovementsQuery = z.infer<typeof ListMovementsQuerySchema>;

export function toMovementInput(
  request: CreateMovementRequest
): MovementInput {
  return {
    type: request.type,
    amount: request.amount,
    currency: request.currency ?? "PEN",
    occurred_at: request.occurred_at,
    description: request.description ?? null,
    merchant: request.merchant ?? null,
    category_id: request.category_id ?? null,
    subcategory_id: request.subcategory_id ?? null,
    account_origin_id: request.account_origin_id ?? null,
    account_destination_id: request.account_destination_id ?? null,
    box_origin_id: request.box_origin_id ?? null,
    box_destination_id: request.box_destination_id ?? null,
    related_person_id: request.related_person_id ?? null,
    debt_id: request.debt_id ?? null,
    recurring_rule_id: request.recurring_rule_id ?? null,
    recurring_occurrence_id: null,
    source: "dashboard_manual",
    source_ref: null,
    confidence: request.confidence ?? null,
    requires_review: request.requires_review ?? false,
    metadata: request.metadata ?? {},
  };
}

export function toMovementPatch(
  request: Partial<CreateMovementRequest>
): MovementPatch {
  const patch: MovementPatch = {};

  if ("type" in request) patch.type = request.type;
  if ("amount" in request) patch.amount = request.amount;
  if ("currency" in request) patch.currency = request.currency ?? "PEN";
  if ("occurred_at" in request) patch.occurred_at = request.occurred_at;
  if ("description" in request) patch.description = request.description ?? null;
  if ("merchant" in request) patch.merchant = request.merchant ?? null;
  if ("category_id" in request) patch.category_id = request.category_id ?? null;
  if ("subcategory_id" in request) {
    patch.subcategory_id = request.subcategory_id ?? null;
  }
  if ("account_origin_id" in request) {
    patch.account_origin_id = request.account_origin_id ?? null;
  }
  if ("account_destination_id" in request) {
    patch.account_destination_id = request.account_destination_id ?? null;
  }
  if ("box_origin_id" in request) patch.box_origin_id = request.box_origin_id ?? null;
  if ("box_destination_id" in request) {
    patch.box_destination_id = request.box_destination_id ?? null;
  }
  if ("related_person_id" in request) {
    patch.related_person_id = request.related_person_id ?? null;
  }
  if ("debt_id" in request) patch.debt_id = request.debt_id ?? null;
  if ("recurring_rule_id" in request) {
    patch.recurring_rule_id = request.recurring_rule_id ?? null;
  }
  if ("confidence" in request) patch.confidence = request.confidence ?? null;
  if ("requires_review" in request) {
    patch.requires_review = request.requires_review ?? false;
  }
  if ("metadata" in request) patch.metadata = request.metadata ?? {};

  return patch;
}
