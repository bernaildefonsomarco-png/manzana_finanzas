import { z } from "zod";
import { BOX_TYPES, CATEGORY_IDS } from "@/shared/types/domain";
import { BUDGET_KINDS, BUDGET_PERIOD_KINDS } from "@/core/budgets";

/**
 * `RUL-ESTR-01`: la estructura financiera —cajas, metas y presupuestos— se
 * puede crear y modificar conversando, con el mismo rigor con el que hoy se
 * crea un movimiento: comando tipado, confirmacion explicita, idempotencia y
 * rastro de auditoria.
 *
 * Estos comandos **no** viven en `CommandDispatcher` a proposito. Ese
 * despachador es el motor de movimientos y saldos: sus payloads son
 * `MovementInput`, su idempotencia es `movements.idempotency_key`, su
 * auditoria cuelga de `movement_id` y su puerto es `FinancialCoreRepository`
 * (movimientos + deltas de cuenta y caja). Cajas, metas y presupuestos no son
 * movimientos y ya tienen ejecutores transaccionales propios
 * (`commit_budget_operation`, `commit_goal_operation`, la tabla `boxes` con su
 * unicidad por cuenta). Meterlos dentro del despachador financiero crearia una
 * segunda fuente de verdad sobre operaciones que la base ya sabe ejecutar de
 * forma atomica e idempotente.
 *
 * El precedente esta dentro del propio despachador: los pagos y las altas de
 * deuda **se delegan** a `DebtPaymentCommandHandler` y
 * `DebtCreationCommandHandler` en lugar de absorberse. La estructura sigue esa
 * misma regla, un nivel mas afuera.
 *
 * Lo unico que si vuelve al motor de movimientos es el dinero: apartar saldo al
 * crear una caja es una `CreateMovementCommand` de tipo `asignacion_interna`,
 * igual que en `POST /api/v1/boxes`. El motor de saldos sigue siendo el unico
 * que mueve plata.
 */

/** Las tres entidades de estructura que el asistente puede escribir. */
export const STRUCTURE_ENTITIES = ["caja", "meta", "presupuesto"] as const;
export type StructureEntity = (typeof STRUCTURE_ENTITIES)[number];

export const STRUCTURE_OPERATIONS = ["create", "update"] as const;
export type StructureOperation = (typeof STRUCTURE_OPERATIONS)[number];

const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe usar YYYY-MM-DD.");

const MoneySchema = z
  .number()
  .finite()
  .positive()
  .max(99_999_999_999.99)
  .refine(hasAtMostTwoDecimals, "El monto admite como maximo dos decimales.");

const NonNegativeMoneySchema = z
  .number()
  .finite()
  .min(0)
  .max(99_999_999_999.99)
  .refine(hasAtMostTwoDecimals, "El monto admite como maximo dos decimales.");

const ActorSchema = z.object({
  type: z.enum(["user", "agent", "system", "worker"]),
  id: z.string().uuid().nullable(),
});

// --- Caja -----------------------------------------------------------------

export const CreateBoxPayloadSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    account_id: z.string().uuid(),
    type: z.enum(BOX_TYPES).default("objetivo"),
    /** Dinero que se aparta de inmediato. Cero es una caja sin saldo. */
    initial_balance: NonNegativeMoneySchema.default(0),
    target_amount: MoneySchema.nullable().default(null),
    target_date: IsoDateSchema.nullable().default(null),
  })
  .refine(
    (value) =>
      value.target_amount == null ||
      value.initial_balance <= value.target_amount,
    {
      path: ["initial_balance"],
      message: "El monto separado no debe superar la meta de la caja.",
    },
  );
export type CreateBoxPayload = z.infer<typeof CreateBoxPayloadSchema>;

export const UpdateBoxPayloadSchema = z
  .object({
    box_id: z.string().uuid(),
    name: z.string().trim().min(1).max(80).optional(),
    type: z.enum(BOX_TYPES).optional(),
    target_amount: MoneySchema.nullable().optional(),
    target_date: IsoDateSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 1, {
    message: "Indica al menos un cambio para la caja.",
  });
export type UpdateBoxPayload = z.infer<typeof UpdateBoxPayloadSchema>;

// --- Meta -----------------------------------------------------------------

export const CreateGoalPayloadSchema = z.object({
  name: z.string().trim().min(1).max(60),
  target_amount: MoneySchema,
  target_date: IsoDateSchema.nullable().default(null),
  /** Caja que respalda la meta. Sin caja, la meta solo mide un objetivo. */
  box_id: z.string().uuid().nullable().default(null),
});
export type CreateGoalPayload = z.infer<typeof CreateGoalPayloadSchema>;

export const UpdateGoalPayloadSchema = z
  .object({
    goal_id: z.string().uuid(),
    name: z.string().trim().min(1).max(60).optional(),
    target_amount: MoneySchema.optional(),
    target_date: IsoDateSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 1, {
    message: "Indica al menos un cambio para la meta.",
  });
export type UpdateGoalPayload = z.infer<typeof UpdateGoalPayloadSchema>;

// --- Presupuesto ----------------------------------------------------------

export const CreateBudgetPayloadSchema = z.object({
  amount: MoneySchema,
  /** `null` es el presupuesto general del periodo, sin categoria. */
  category_id: z.enum(CATEGORY_IDS).nullable().default(null),
  period_kind: z.enum(BUDGET_PERIOD_KINDS).default("mensual"),
  kind: z.enum(BUDGET_KINDS).default("presupuesto"),
  rollover: z.boolean().default(false),
  auto_renew: z.boolean().default(true),
});
export type CreateBudgetPayload = z.infer<typeof CreateBudgetPayloadSchema>;

export const UpdateBudgetPayloadSchema = z
  .object({
    budget_id: z.string().uuid(),
    amount: MoneySchema.optional(),
    kind: z.enum(BUDGET_KINDS).optional(),
    rollover: z.boolean().optional(),
    auto_renew: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 1, {
    message: "Indica al menos un cambio para el presupuesto.",
  });
export type UpdateBudgetPayload = z.infer<typeof UpdateBudgetPayloadSchema>;

// --- Comando --------------------------------------------------------------

const CommandEnvelopeShape = {
  command_id: z.string().uuid(),
  user_id: z.string().uuid(),
  actor: ActorSchema,
  source: z.string().trim().min(1).max(120),
  trace_id: z.string().trim().min(1).max(120),
  /**
   * Idempotencia por usuario: dos envios del mismo comando no crean dos cajas.
   * Se deriva del identificador de la propuesta, asi que reenviar el mismo
   * boton siempre repite la misma clave (`RUL-ESTR-03`).
   */
  idempotency_key: z.string().trim().min(8).max(180),
} as const;

export const CreateBoxCommandSchema = z.object({
  ...CommandEnvelopeShape,
  type: z.literal("CreateBoxCommand"),
  payload: CreateBoxPayloadSchema,
});

export const UpdateBoxCommandSchema = z.object({
  ...CommandEnvelopeShape,
  type: z.literal("UpdateBoxCommand"),
  payload: UpdateBoxPayloadSchema,
});

export const CreateGoalCommandSchema = z.object({
  ...CommandEnvelopeShape,
  type: z.literal("CreateGoalCommand"),
  payload: CreateGoalPayloadSchema,
});

export const UpdateGoalCommandSchema = z.object({
  ...CommandEnvelopeShape,
  type: z.literal("UpdateGoalCommand"),
  payload: UpdateGoalPayloadSchema,
});

export const CreateBudgetCommandSchema = z.object({
  ...CommandEnvelopeShape,
  type: z.literal("CreateBudgetCommand"),
  payload: CreateBudgetPayloadSchema,
});

export const UpdateBudgetCommandSchema = z.object({
  ...CommandEnvelopeShape,
  type: z.literal("UpdateBudgetCommand"),
  payload: UpdateBudgetPayloadSchema,
});

export const StructureCommandSchema = z.discriminatedUnion("type", [
  CreateBoxCommandSchema,
  UpdateBoxCommandSchema,
  CreateGoalCommandSchema,
  UpdateGoalCommandSchema,
  CreateBudgetCommandSchema,
  UpdateBudgetCommandSchema,
]);
export type StructureCommand = z.infer<typeof StructureCommandSchema>;

export type StructureCommandType = StructureCommand["type"];

/** Entidad de dominio a la que pertenece cada comando. */
export function entityForCommandType(
  type: StructureCommandType,
): StructureEntity {
  if (type === "CreateBoxCommand" || type === "UpdateBoxCommand") return "caja";
  if (type === "CreateGoalCommand" || type === "UpdateGoalCommand") {
    return "meta";
  }
  return "presupuesto";
}

export function operationForCommandType(
  type: StructureCommandType,
): StructureOperation {
  return type.startsWith("Create") ? "create" : "update";
}

function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;
}
