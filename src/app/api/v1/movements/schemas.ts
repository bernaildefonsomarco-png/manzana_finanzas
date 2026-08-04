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

// WEB-D195: los 11 tipos de movimiento no comparten un solo camino de
// escritura. Estos tres grupos determinan que esquema y que comando del
// Core atiende una creacion, segun `type`.
export const GENERIC_MOVEMENT_TYPES = [
  "gasto",
  "ingreso",
  "transferencia",
  "asignacion_interna",
  "ajuste",
  "pago_recurrente",
] as const;

export const DEBT_ORIGINATION_MOVEMENT_TYPES = [
  "deuda_adquirida",
  "prestamo_dado",
  "prestamo_recibido",
] as const;

export const DEBT_PAYMENT_MOVEMENT_TYPES = [
  "pago_deuda",
  "devolucion_recibida",
] as const;

export type GenericMovementType = (typeof GENERIC_MOVEMENT_TYPES)[number];
export type DebtOriginationMovementType =
  (typeof DEBT_ORIGINATION_MOVEMENT_TYPES)[number];
export type DebtPaymentMovementType =
  (typeof DEBT_PAYMENT_MOVEMENT_TYPES)[number];

function isDebtOriginationType(
  value: unknown,
): value is DebtOriginationMovementType {
  return (DEBT_ORIGINATION_MOVEMENT_TYPES as readonly unknown[]).includes(
    value,
  );
}

function isDebtPaymentType(value: unknown): value is DebtPaymentMovementType {
  return (DEBT_PAYMENT_MOVEMENT_TYPES as readonly unknown[]).includes(value);
}

/** `ERR-MOV-06`: un campo prohibido para el tipo no se ignora, se rechaza. */
function rejectProhibitedField(
  ctx: z.RefinementCtx,
  present: boolean,
  path: string,
  message: string,
): void {
  if (present) ctx.addIssue({ code: "custom", path: [path], message });
}

const CreateMovementRequestObjectSchema = z
  .object({
    type: z.enum(GENERIC_MOVEMENT_TYPES),
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
    recurring_rule_id: OptionalNullableUuidSchema,
    related_person_id: OptionalNullableUuidSchema,
    // RUL-CAT §7 / ERR-CAT-05: maximo 6 etiquetas por movimiento.
    tag_ids: z.array(z.string().uuid()).max(6, "Un movimiento puede tener hasta 6 etiquetas.").optional(),
    confidence: z.number().min(0).max(1).nullable().optional(),
    requires_review: z.boolean().optional(),
    confirm_duplicate: z.boolean().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

function genericMovementSuperRefine(
  value: z.infer<typeof CreateMovementRequestObjectSchema>,
  ctx: z.RefinementCtx,
): void {
    // `26` §4.3 — campos prohibidos por tipo, entre los seis genericos.
    switch (value.type) {
      case "gasto":
        rejectProhibitedField(
          ctx,
          Boolean(value.account_destination_id),
          "account_destination_id",
          "Un gasto no lleva cuenta destino.",
        );
        break;
      case "ingreso":
        rejectProhibitedField(
          ctx,
          Boolean(value.account_origin_id),
          "account_origin_id",
          "Un ingreso no lleva cuenta origen.",
        );
        rejectProhibitedField(
          ctx,
          Boolean(value.box_origin_id),
          "box_origin_id",
          "Un ingreso no lleva caja origen.",
        );
        break;
      case "transferencia":
        rejectProhibitedField(
          ctx,
          Boolean(value.category_id),
          "category_id",
          "Las transferencias no llevan categoria: no son un gasto.",
        );
        rejectProhibitedField(
          ctx,
          Boolean(value.box_origin_id) || Boolean(value.box_destination_id),
          "box_origin_id",
          "Las transferencias no llevan cajas: son entre cuentas.",
        );
        break;
      case "asignacion_interna":
        rejectProhibitedField(
          ctx,
          Boolean(value.category_id),
          "category_id",
          "Una asignacion interna no lleva categoria.",
        );
        break;
      case "ajuste":
        rejectProhibitedField(
          ctx,
          Boolean(value.category_id),
          "category_id",
          "Un ajuste no lleva categoria.",
        );
        // WEB-D197: la cuenta de un ajuste siempre es el destino.
        rejectProhibitedField(
          ctx,
          Boolean(value.account_origin_id),
          "account_origin_id",
          "Un ajuste solo usa la cuenta como destino.",
        );
        if (
          typeof value.metadata?.["reason"] !== "string" ||
          (value.metadata["reason"] as string).trim().length === 0
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["metadata", "reason"],
            message: "Un ajuste necesita un motivo.",
          });
        }
        break;
      case "pago_recurrente":
        rejectProhibitedField(
          ctx,
          Boolean(value.account_destination_id),
          "account_destination_id",
          "Un pago recurrente no lleva cuenta destino.",
        );
        if (!value.recurring_rule_id) {
          ctx.addIssue({
            code: "custom",
            path: ["recurring_rule_id"],
            message: "Un pago recurrente necesita su regla recurrente.",
          });
        }
        break;
    }
}

export const CreateMovementRequestSchema =
  CreateMovementRequestObjectSchema.superRefine(genericMovementSuperRefine);

export const MovementPatchRequestSchema = CreateMovementRequestObjectSchema
  .partial()
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

export const ListMovementsQuerySchema = z
  .object({
    type: MovementTypeSchema.optional(),
    status: z
      .enum(["confirmed", "needs_review", "corrected", "deleted", "reversed"])
      .optional(),
    category_id: CategoryIdSchema.optional(),
    account_id: z.string().uuid().optional(),
    box_id: z.string().uuid().optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    // `AC-MOV-05`: la busqueda de texto libre siempre esta disponible.
    q: z.string().trim().min(1).max(120).optional(),
    include_deleted: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
    // `AC-API-02`: se recorta al maximo, no se rechaza (`clampLimit`).
    limit: z.coerce.number().int().positive().optional(),
    // `AC-API-01`: opaco, `pagination.ts` lo codifica/decodifica.
    cursor: z.string().optional(),
  })
  .strict();

/**
 * `deuda_adquirida`, `prestamo_dado`, `prestamo_recibido` (WEB-D195,
 * WEB-D198): crean una deuda -y opcionalmente un movimiento vinculado si hay
 * cuenta- via `CreateDebtCommand`, nunca escribiendo `movements` crudo.
 */
export const CreateDebtOriginationMovementRequestSchema = z
  .object({
    type: z.enum(DEBT_ORIGINATION_MOVEMENT_TYPES),
    amount: z.number().finite().positive().max(999_999_999.99),
    currency: CurrencyCodeSchema.optional(),
    occurred_at: z.string().datetime({ offset: true }),
    description: OptionalNullableTextSchema,
    related_person_name: z.string().trim().min(1).max(120),
    account_id: OptionalNullableUuidSchema,
    installment_count: z.number().int().min(1).max(240).nullable().optional(),
    first_due_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    installment_amount: z
      .number()
      .finite()
      .positive()
      .max(999_999_999.99)
      .nullable()
      .optional(),
    interest_notes: OptionalNullableTextSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    // `26` §4.3: "deuda_adquirida" no lleva cuenta, no hay efectivo de por
    // medio (ver WEB-D198).
    if (value.type === "deuda_adquirida" && value.account_id) {
      ctx.addIssue({
        code: "custom",
        path: ["account_id"],
        message:
          "Una deuda adquirida no lleva cuenta: no hay movimiento de efectivo.",
      });
    }
    if (value.installment_count && !value.first_due_date) {
      ctx.addIssue({
        code: "custom",
        path: ["first_due_date"],
        message: "Indica la primera fecha de cuota.",
      });
    }
  });

export type CreateDebtOriginationMovementRequest = z.infer<
  typeof CreateDebtOriginationMovementRequestSchema
>;

/**
 * `pago_deuda`, `devolucion_recibida` (WEB-D195): exigen una deuda existente
 * y se despachan via `RecordDebtPaymentCommand`, que deriva el tipo real del
 * `direction` de la deuda.
 */
export const CreateDebtPaymentMovementRequestSchema = z
  .object({
    type: z.enum(DEBT_PAYMENT_MOVEMENT_TYPES),
    debt_id: z.string().uuid(),
    amount: z.number().finite().positive().max(999_999_999.99),
    currency: CurrencyCodeSchema.nullable().optional(),
    occurred_at: z.string().datetime({ offset: true }),
    description: OptionalNullableTextSchema,
    account_origin_id: OptionalNullableUuidSchema,
    account_destination_id: OptionalNullableUuidSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    // `26` §4.3: "pago_deuda" solo admite cuenta origen; "devolucion_recibida"
    // solo cuenta destino (WEB-D195: sin soporte de caja en este corte).
    if (value.type === "pago_deuda" && value.account_destination_id) {
      ctx.addIssue({
        code: "custom",
        path: ["account_destination_id"],
        message: "Un pago de deuda no lleva cuenta destino.",
      });
    }
    if (value.type === "devolucion_recibida" && value.account_origin_id) {
      ctx.addIssue({
        code: "custom",
        path: ["account_origin_id"],
        message: "Una devolucion recibida no lleva cuenta origen.",
      });
    }
  });

export type CreateDebtPaymentMovementRequest = z.infer<
  typeof CreateDebtPaymentMovementRequestSchema
>;

export function detectMovementCreationKind(
  body: unknown,
): "debt_origination" | "debt_payment" | "generic" {
  const type =
    body && typeof body === "object" && "type" in body
      ? (body as { type: unknown }).type
      : undefined;
  if (isDebtOriginationType(type)) return "debt_origination";
  if (isDebtPaymentType(type)) return "debt_payment";
  return "generic";
}

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
    debt_id: null,
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
