import { z } from "zod";
import {
  MovementInputSchema,
  type MovementInput,
} from "@/shared/schemas/money";

export const ActorSchema = z.object({
  type: z.enum(["user", "agent", "system", "worker"]),
  id: z.string().uuid().nullable(),
});

export type Actor = z.infer<typeof ActorSchema>;

export const CommandEnvelopeBaseSchema = z.object({
  command_id: z.string().uuid(),
  user_id: z.string().uuid(),
  actor: ActorSchema,
  source: z.string().trim().min(1).max(120),
  trace_id: z.string().uuid(),
});

export type CommandEnvelope<TPayload> = z.infer<
  typeof CommandEnvelopeBaseSchema
> & {
  payload: TPayload;
};

export const CreateMovementCommandSchema = CommandEnvelopeBaseSchema.extend({
  type: z.literal("CreateMovementCommand"),
  payload: z.object({
    movement: MovementInputSchema,
    idempotency_key: z.string().trim().min(8).max(180),
  }),
});

export const UpdateMovementCommandSchema = CommandEnvelopeBaseSchema.extend({
  type: z.literal("UpdateMovementCommand"),
  payload: z.object({
    movement_id: z.string().uuid(),
    patch: MovementInputSchema.partial().refine(
      (patch) => Object.keys(patch).length > 0,
      "Patch vacio"
    ),
    reason: z.string().trim().min(1).max(240),
  }),
});

export const CorrectMovementCommandSchema = CommandEnvelopeBaseSchema.extend({
  type: z.literal("CorrectMovementCommand"),
  payload: z.object({
    movement_id: z.string().uuid(),
    corrected_fields: MovementInputSchema.partial().refine(
      (patch) => Object.keys(patch).length > 0,
      "Correccion vacia"
    ),
    user_correction_text: z.string().trim().min(1).max(500).nullable(),
    reason: z.enum([
      "user_correction",
      "classification_fix",
      "account_fix",
      "system_reconciliation",
    ]),
  }),
});

export const DeleteMovementCommandSchema = CommandEnvelopeBaseSchema.extend({
  type: z.literal("DeleteMovementCommand"),
  payload: z.object({
    movement_id: z.string().uuid(),
    mode: z.enum(["soft_delete", "reverse"]),
    reason: z.string().trim().min(1).max(240),
  }),
});

export const RestoreMovementCommandSchema = CommandEnvelopeBaseSchema.extend({
  type: z.literal("RestoreMovementCommand"),
  payload: z.object({
    movement_id: z.string().uuid(),
    reason: z.string().trim().min(1).max(240),
  }),
});

const PositiveMoneySchema = z
  .number()
  .finite()
  .positive("El monto debe ser mayor a cero")
  .max(999_999_999.99, "Monto demasiado alto")
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8,
    "El monto acepta maximo dos decimales"
  );

export const RecordDebtPaymentCommandSchema = CommandEnvelopeBaseSchema.extend({
  type: z.literal("RecordDebtPaymentCommand"),
  payload: z
    .object({
      debt_id: z.string().uuid(),
      amount: PositiveMoneySchema,
      currency: z.enum(["PEN", "USD"]).nullable(),
      account_id: z.string().uuid().nullable(),
      installment_id: z.string().uuid().nullable(),
      installment_number: z.number().int().positive().nullable(),
      paid_at: z.string().datetime({ offset: true }),
      note: z.string().trim().min(1).max(180).nullable(),
      idempotency_key: z.string().trim().min(8).max(180),
      payment_source: z.enum([
        "whatsapp",
        "dashboard_manual",
        "email_confirmed",
      ]),
    })
    .strict(),
});

export const CreateDebtCommandSchema = CommandEnvelopeBaseSchema.extend({
  type: z.literal("CreateDebtCommand"),
  payload: z
    .object({
      direction: z.enum(["i_owe", "they_owe_me"]),
      kind: z.enum([
        "personal",
        "bank_loan",
        "credit_card",
        "installment_purchase",
        "service_or_bill",
        "other",
      ]),
      name: z.string().trim().min(1).max(120),
      related_person_name: z.string().trim().min(1).max(60).nullable(),
      principal_amount: PositiveMoneySchema,
      currency: z.enum(["PEN", "USD"]),
      opened_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      due_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .optional(),
      first_due_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable(),
      installment_count: z.number().int().min(1).max(360).nullable(),
      installment_amount: PositiveMoneySchema.nullable(),
      interest_notes: z.string().trim().min(1).max(300).nullable(),
      account_id: z.string().uuid().nullable(),
      movement_type: z.enum([
        "prestamo_recibido",
        "prestamo_dado",
        "deuda_adquirida",
      ]),
      idempotency_key: z.string().trim().min(8).max(180),
      creation_source: z.enum(["whatsapp", "dashboard_manual"]),
    })
    .strict()
    .superRefine((payload, ctx) => {
      if (payload.installment_count && !payload.first_due_date) {
        ctx.addIssue({
          code: "custom",
          path: ["first_due_date"],
          message: "La deuda en cuotas necesita fecha de primera cuota.",
        });
      }
      // WEB-D198: direction "i_owe" admite dos tipos ("recibi efectivo" vs
      // "adquiri una deuda sin movimiento de efectivo"); "they_owe_me" solo
      // tiene un caso porque no hay un "deuda_adquirida" simetrico para
      // cuando soy yo quien presta.
      const expectedTypes =
        payload.direction === "i_owe"
          ? (["prestamo_recibido", "deuda_adquirida"] as const)
          : (["prestamo_dado"] as const);
      if (!expectedTypes.includes(payload.movement_type as never)) {
        ctx.addIssue({
          code: "custom",
          path: ["movement_type"],
          message: "El tipo de movimiento no coincide con la direccion.",
        });
      }
      if (payload.movement_type === "deuda_adquirida" && payload.account_id) {
        ctx.addIssue({
          code: "custom",
          path: ["account_id"],
          message:
            "Una deuda adquirida no lleva cuenta: no hay movimiento de efectivo.",
        });
      }
    }),
});

export const CoreCommandSchema = z.discriminatedUnion("type", [
  CreateMovementCommandSchema,
  UpdateMovementCommandSchema,
  CorrectMovementCommandSchema,
  DeleteMovementCommandSchema,
  RestoreMovementCommandSchema,
  RecordDebtPaymentCommandSchema,
  CreateDebtCommandSchema,
]);

export type CreateMovementCommand = z.infer<
  typeof CreateMovementCommandSchema
>;
export type UpdateMovementCommand = z.infer<
  typeof UpdateMovementCommandSchema
>;
export type CorrectMovementCommand = z.infer<
  typeof CorrectMovementCommandSchema
>;
export type DeleteMovementCommand = z.infer<
  typeof DeleteMovementCommandSchema
>;
export type RestoreMovementCommand = z.infer<
  typeof RestoreMovementCommandSchema
>;
export type RecordDebtPaymentCommand = z.infer<
  typeof RecordDebtPaymentCommandSchema
>;
export type CreateDebtCommand = z.infer<typeof CreateDebtCommandSchema>;
export type CoreCommand = z.infer<typeof CoreCommandSchema>;

export type MovementPatch = Partial<MovementInput>;
