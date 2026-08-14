import { z } from "zod";
import {
  ACCOUNT_TYPES,
  BOX_TYPES,
  CATEGORY_IDS,
  RECURRING_AMOUNT_VARIABILITIES,
  RECURRING_FREQUENCIES,
} from "@/shared/types/domain";
import { BUDGET_KINDS, BUDGET_PERIOD_KINDS } from "@/core/budgets";

/**
 * `RUL-ESTR-01`: la estructura financiera —cajas, metas, presupuestos, pagos
 * recurrentes y cuentas— se puede crear, modificar y cerrar conversando, con el
 * mismo rigor con el que hoy se crea un movimiento: comando tipado,
 * confirmacion explicita, idempotencia y rastro de auditoria.
 *
 * Estos comandos **no** viven en `CommandDispatcher` a proposito. Ese
 * despachador es el motor de movimientos y saldos: sus payloads son
 * `MovementInput`, su idempotencia es `movements.idempotency_key`, su
 * auditoria cuelga de `movement_id` y su puerto es `FinancialCoreRepository`
 * (movimientos + deltas de cuenta y caja). Cajas, metas, presupuestos, reglas
 * recurrentes y cuentas no son movimientos y ya tienen ejecutores propios
 * (`commit_budget_operation`, `commit_goal_operation`, la tabla `boxes` con su
 * unicidad por cuenta, `recurring_rules` con su contrato de creacion
 * idempotente de `058`, y `accounts` con su cascada de archivado). Meterlos
 * dentro del despachador financiero crearia una segunda fuente de verdad sobre
 * operaciones que la base ya sabe ejecutar de forma atomica.
 *
 * El precedente esta dentro del propio despachador: los pagos y las altas de
 * deuda **se delegan** a `DebtPaymentCommandHandler` y
 * `DebtCreationCommandHandler` en lugar de absorberse. La estructura sigue esa
 * misma regla, un nivel mas afuera.
 *
 * Lo unico que si vuelve al motor de movimientos es el dinero: apartar saldo al
 * crear una caja, y devolverlo al archivarla, son `CreateMovementCommand` de
 * tipo `asignacion_interna`, igual que en `POST /api/v1/boxes` y
 * `DELETE /api/v1/boxes/[id]`. El motor de saldos sigue siendo el unico que
 * mueve plata.
 */

/**
 * Las entidades de estructura que el asistente puede escribir.
 *
 * `subcategoria` entra aqui y **no** como superficie nueva a proposito. Crear
 * una subcategoria hablando necesita exactamente lo que esta tuberia ya
 * resuelve —propuesta, confirmacion explicita, idempotencia, caducidad y
 * deshacer (`RUL-ESTR-01`, `RUL-ESTR-03`)— y montarla aparte habria duplicado
 * las cuatro. Ademas hereda gratis los avisos de `ERR-ASI-01`: el "no pude" y
 * el "eso no lo hice en este turno" que `response-planner` ya compone para
 * `structure_proposal`.
 *
 * La **categoria** no esta ni lo estara: las 12 son un enum fijo del dominio
 * (`CATEGORY_IDS`, sembradas en `003_categories_tags.sql`) y ni la pantalla ni
 * la API dejan crear una. Lo que la persona si crea es la subcategoria que
 * cuelga de una de ellas (`user_subcategories`).
 */
export const STRUCTURE_ENTITIES = [
  "caja",
  "meta",
  "presupuesto",
  "recurrente",
  "cuenta",
  "subcategoria",
] as const;
export type StructureEntity = (typeof STRUCTURE_ENTITIES)[number];

/**
 * Ciclo de vida completo. `archive` es destructivo —cierra la estructura y, en
 * el caso de una caja o una cuenta, mueve o libera dinero— y por eso se trata
 * aparte en el gate de riesgo y en el texto de confirmacion (`RUL-ESTR-05`).
 */
export const STRUCTURE_OPERATIONS = [
  "create",
  "update",
  "archive",
  "pause",
  "resume",
] as const;
export type StructureOperation = (typeof STRUCTURE_OPERATIONS)[number];

/** Operaciones que cierran o dan de baja algo. Nunca son silenciosas. */
export const DESTRUCTIVE_STRUCTURE_OPERATIONS = ["archive"] as const;

export function isDestructiveStructureOperation(
  operation: StructureOperation,
): boolean {
  return (DESTRUCTIVE_STRUCTURE_OPERATIONS as readonly string[]).includes(
    operation,
  );
}

const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe usar YYYY-MM-DD.")
  .refine(isRealIsoDate, "Esa fecha no existe.");

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

/** El saldo declarado de una cuenta si admite negativo (una tarjeta lo esta). */
const AccountBalanceSchema = z
  .number()
  .finite()
  .min(-999_999_999.99)
  .max(999_999_999.99)
  .refine(hasAtMostTwoDecimals, "El saldo admite como maximo dos decimales.");

const CurrencySchema = z.enum(["PEN", "USD"]);

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

export const ArchiveBoxPayloadSchema = z.object({
  box_id: z.string().uuid(),
});
export type ArchiveBoxPayload = z.infer<typeof ArchiveBoxPayloadSchema>;

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

/** Archivar, pausar y reanudar una meta solo necesitan saber cual. */
export const GoalLifecyclePayloadSchema = z.object({
  goal_id: z.string().uuid(),
});
export type GoalLifecyclePayload = z.infer<typeof GoalLifecyclePayloadSchema>;

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

export const BudgetLifecyclePayloadSchema = z.object({
  budget_id: z.string().uuid(),
});
export type BudgetLifecyclePayload = z.infer<
  typeof BudgetLifecyclePayloadSchema
>;

// --- Recurrente -----------------------------------------------------------

/**
 * `RUL-REC-01`: una regla recurrente **no mueve dinero**. Describe lo que se
 * espera pagar y cuando; el saldo solo cambia cuando la ocurrencia se marca
 * pagada por el motor (`commit_recurring_payment`). Por eso el monto aqui es
 * `expected_amount` y no un importe: es una expectativa, no un cargo.
 */
export const CreateRecurringPayloadSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    expected_amount: MoneySchema.nullable().default(null),
    amount_variability: z
      .enum(RECURRING_AMOUNT_VARIABILITIES)
      .default("fixed"),
    currency: CurrencySchema.default("PEN"),
    frequency: z.enum(RECURRING_FREQUENCIES).default("monthly"),
    next_expected_date: IsoDateSchema,
    category_id: z.enum(CATEGORY_IDS).nullable().default(null),
    /** Cuenta sugerida al pagar. No aparta ni bloquea nada de ella. */
    default_account_id: z.string().uuid().nullable().default(null),
  })
  // Misma regla dura que `recurring_rules_fixed_amount_required` en la base:
  // un pago fijo sin monto no es una expectativa, es un hueco.
  .refine(
    (value) =>
      value.amount_variability !== "fixed" || value.expected_amount != null,
    {
      path: ["expected_amount"],
      message: "Un pago fijo necesita su monto.",
    },
  );
export type CreateRecurringPayload = z.infer<
  typeof CreateRecurringPayloadSchema
>;

export const UpdateRecurringPayloadSchema = z
  .object({
    recurring_rule_id: z.string().uuid(),
    name: z.string().trim().min(1).max(60).optional(),
    expected_amount: MoneySchema.nullable().optional(),
    amount_variability: z.enum(RECURRING_AMOUNT_VARIABILITIES).optional(),
    frequency: z.enum(RECURRING_FREQUENCIES).optional(),
    next_expected_date: IsoDateSchema.optional(),
    category_id: z.enum(CATEGORY_IDS).nullable().optional(),
    default_account_id: z.string().uuid().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 1, {
    message: "Indica al menos un cambio para el pago recurrente.",
  });
export type UpdateRecurringPayload = z.infer<
  typeof UpdateRecurringPayloadSchema
>;

export const RecurringLifecyclePayloadSchema = z.object({
  recurring_rule_id: z.string().uuid(),
});
export type RecurringLifecyclePayload = z.infer<
  typeof RecurringLifecyclePayloadSchema
>;

// --- Cuenta ---------------------------------------------------------------

/**
 * `RUL-CUENTAS-01`: el saldo inicial de una cuenta es una **declaracion** del
 * usuario, no un movimiento. Se escribe en `initial_balance`/`current_balance`
 * igual que en `POST /api/v1/accounts`, sin pasar por el motor de saldos, que
 * solo registra dinero que se movio de verdad.
 */
export const CreateAccountPayloadSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(ACCOUNT_TYPES).default("digital"),
  institution: z.string().trim().min(1).max(80).nullable().default(null),
  currency: CurrencySchema.default("PEN"),
  initial_balance: AccountBalanceSchema.default(0),
});
export type CreateAccountPayload = z.infer<typeof CreateAccountPayloadSchema>;

export const UpdateAccountPayloadSchema = z
  .object({
    account_id: z.string().uuid(),
    name: z.string().trim().min(1).max(80).optional(),
    type: z.enum(ACCOUNT_TYPES).optional(),
    institution: z.string().trim().min(1).max(80).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 1, {
    message: "Indica al menos un cambio para la cuenta.",
  });
export type UpdateAccountPayload = z.infer<typeof UpdateAccountPayloadSchema>;

export const AccountLifecyclePayloadSchema = z.object({
  account_id: z.string().uuid(),
});
export type AccountLifecyclePayload = z.infer<
  typeof AccountLifecyclePayloadSchema
>;

// --- Subcategoria ---------------------------------------------------------

/**
 * `RUL-CAT`: una subcategoria cuelga siempre de una de las 12 categorias
 * canonicas. No hay subcategoria suelta ni subcategoria de subcategoria, y por
 * eso `category_id` es obligatorio y sale del enum, no de texto libre.
 *
 * El minimo de dos caracteres no es decorativo: es el mismo `LabelSchema` que
 * exige `ClassificationCommandSchema`, el esquema con el que la escritura se
 * valida de verdad. Con un minimo mas laxo aqui, el borrador se propondria, el
 * usuario lo confirmaria y la escritura moriria despues del "si".
 */
export const SubcategoryLabelSchema = z.string().trim().min(2).max(80);

export const CreateSubcategoryPayloadSchema = z.object({
  category_id: z.enum(CATEGORY_IDS),
  label: SubcategoryLabelSchema,
});
export type CreateSubcategoryPayload = z.infer<
  typeof CreateSubcategoryPayloadSchema
>;

/** Lo unico que se cambia de una subcategoria es como se llama. */
export const UpdateSubcategoryPayloadSchema = z.object({
  subcategory_id: z.string().uuid(),
  label: SubcategoryLabelSchema,
});
export type UpdateSubcategoryPayload = z.infer<
  typeof UpdateSubcategoryPayloadSchema
>;

export const SubcategoryLifecyclePayloadSchema = z.object({
  subcategory_id: z.string().uuid(),
});
export type SubcategoryLifecyclePayload = z.infer<
  typeof SubcategoryLifecyclePayloadSchema
>;

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

function structureCommand<
  const Type extends string,
  Payload extends z.ZodType,
>(type: Type, payload: Payload) {
  return z.object({
    ...CommandEnvelopeShape,
    type: z.literal(type),
    payload,
  });
}

export const CreateBoxCommandSchema = structureCommand(
  "CreateBoxCommand",
  CreateBoxPayloadSchema,
);
export const UpdateBoxCommandSchema = structureCommand(
  "UpdateBoxCommand",
  UpdateBoxPayloadSchema,
);
export const ArchiveBoxCommandSchema = structureCommand(
  "ArchiveBoxCommand",
  ArchiveBoxPayloadSchema,
);

export const CreateGoalCommandSchema = structureCommand(
  "CreateGoalCommand",
  CreateGoalPayloadSchema,
);
export const UpdateGoalCommandSchema = structureCommand(
  "UpdateGoalCommand",
  UpdateGoalPayloadSchema,
);
export const ArchiveGoalCommandSchema = structureCommand(
  "ArchiveGoalCommand",
  GoalLifecyclePayloadSchema,
);
export const PauseGoalCommandSchema = structureCommand(
  "PauseGoalCommand",
  GoalLifecyclePayloadSchema,
);
export const ResumeGoalCommandSchema = structureCommand(
  "ResumeGoalCommand",
  GoalLifecyclePayloadSchema,
);

export const CreateBudgetCommandSchema = structureCommand(
  "CreateBudgetCommand",
  CreateBudgetPayloadSchema,
);
export const UpdateBudgetCommandSchema = structureCommand(
  "UpdateBudgetCommand",
  UpdateBudgetPayloadSchema,
);
export const ArchiveBudgetCommandSchema = structureCommand(
  "ArchiveBudgetCommand",
  BudgetLifecyclePayloadSchema,
);
export const PauseBudgetCommandSchema = structureCommand(
  "PauseBudgetCommand",
  BudgetLifecyclePayloadSchema,
);
export const ResumeBudgetCommandSchema = structureCommand(
  "ResumeBudgetCommand",
  BudgetLifecyclePayloadSchema,
);

export const CreateRecurringCommandSchema = structureCommand(
  "CreateRecurringCommand",
  CreateRecurringPayloadSchema,
);
export const UpdateRecurringCommandSchema = structureCommand(
  "UpdateRecurringCommand",
  UpdateRecurringPayloadSchema,
);
export const ArchiveRecurringCommandSchema = structureCommand(
  "ArchiveRecurringCommand",
  RecurringLifecyclePayloadSchema,
);
export const PauseRecurringCommandSchema = structureCommand(
  "PauseRecurringCommand",
  RecurringLifecyclePayloadSchema,
);
export const ResumeRecurringCommandSchema = structureCommand(
  "ResumeRecurringCommand",
  RecurringLifecyclePayloadSchema,
);

export const CreateAccountCommandSchema = structureCommand(
  "CreateAccountCommand",
  CreateAccountPayloadSchema,
);
export const UpdateAccountCommandSchema = structureCommand(
  "UpdateAccountCommand",
  UpdateAccountPayloadSchema,
);
export const ArchiveAccountCommandSchema = structureCommand(
  "ArchiveAccountCommand",
  AccountLifecyclePayloadSchema,
);

export const CreateSubcategoryCommandSchema = structureCommand(
  "CreateSubcategoryCommand",
  CreateSubcategoryPayloadSchema,
);
export const UpdateSubcategoryCommandSchema = structureCommand(
  "UpdateSubcategoryCommand",
  UpdateSubcategoryPayloadSchema,
);
export const ArchiveSubcategoryCommandSchema = structureCommand(
  "ArchiveSubcategoryCommand",
  SubcategoryLifecyclePayloadSchema,
);

export const StructureCommandSchema = z.discriminatedUnion("type", [
  CreateBoxCommandSchema,
  UpdateBoxCommandSchema,
  ArchiveBoxCommandSchema,
  CreateGoalCommandSchema,
  UpdateGoalCommandSchema,
  ArchiveGoalCommandSchema,
  PauseGoalCommandSchema,
  ResumeGoalCommandSchema,
  CreateBudgetCommandSchema,
  UpdateBudgetCommandSchema,
  ArchiveBudgetCommandSchema,
  PauseBudgetCommandSchema,
  ResumeBudgetCommandSchema,
  CreateRecurringCommandSchema,
  UpdateRecurringCommandSchema,
  ArchiveRecurringCommandSchema,
  PauseRecurringCommandSchema,
  ResumeRecurringCommandSchema,
  CreateAccountCommandSchema,
  UpdateAccountCommandSchema,
  ArchiveAccountCommandSchema,
  CreateSubcategoryCommandSchema,
  UpdateSubcategoryCommandSchema,
  ArchiveSubcategoryCommandSchema,
]);
export type StructureCommand = z.infer<typeof StructureCommandSchema>;

export type StructureCommandType = StructureCommand["type"];

/**
 * Un solo mapa manda: entidad y operacion de cada comando. Derivarlas de
 * prefijos y sufijos del nombre parecia barato con seis comandos; con
 * veintiuno, un nombre que no encaje volveria a la entidad equivocada en
 * silencio, y la entidad equivocada elige el ejecutor equivocado.
 */
const COMMAND_SHAPE: Record<
  StructureCommandType,
  { entity: StructureEntity; operation: StructureOperation }
> = {
  CreateBoxCommand: { entity: "caja", operation: "create" },
  UpdateBoxCommand: { entity: "caja", operation: "update" },
  ArchiveBoxCommand: { entity: "caja", operation: "archive" },
  CreateGoalCommand: { entity: "meta", operation: "create" },
  UpdateGoalCommand: { entity: "meta", operation: "update" },
  ArchiveGoalCommand: { entity: "meta", operation: "archive" },
  PauseGoalCommand: { entity: "meta", operation: "pause" },
  ResumeGoalCommand: { entity: "meta", operation: "resume" },
  CreateBudgetCommand: { entity: "presupuesto", operation: "create" },
  UpdateBudgetCommand: { entity: "presupuesto", operation: "update" },
  ArchiveBudgetCommand: { entity: "presupuesto", operation: "archive" },
  PauseBudgetCommand: { entity: "presupuesto", operation: "pause" },
  ResumeBudgetCommand: { entity: "presupuesto", operation: "resume" },
  CreateRecurringCommand: { entity: "recurrente", operation: "create" },
  UpdateRecurringCommand: { entity: "recurrente", operation: "update" },
  ArchiveRecurringCommand: { entity: "recurrente", operation: "archive" },
  PauseRecurringCommand: { entity: "recurrente", operation: "pause" },
  ResumeRecurringCommand: { entity: "recurrente", operation: "resume" },
  CreateAccountCommand: { entity: "cuenta", operation: "create" },
  UpdateAccountCommand: { entity: "cuenta", operation: "update" },
  ArchiveAccountCommand: { entity: "cuenta", operation: "archive" },
  CreateSubcategoryCommand: { entity: "subcategoria", operation: "create" },
  UpdateSubcategoryCommand: { entity: "subcategoria", operation: "update" },
  ArchiveSubcategoryCommand: { entity: "subcategoria", operation: "archive" },
};

export const STRUCTURE_COMMAND_TYPES = Object.keys(COMMAND_SHAPE) as [
  StructureCommandType,
  ...StructureCommandType[],
];

/** Enum reutilizable: el borrador guardado valida contra la misma lista. */
export const StructureCommandTypeSchema = z.enum(STRUCTURE_COMMAND_TYPES);

/** Entidad de dominio a la que pertenece cada comando. */
export function entityForCommandType(
  type: StructureCommandType,
): StructureEntity {
  return COMMAND_SHAPE[type].entity;
}

export function operationForCommandType(
  type: StructureCommandType,
): StructureOperation {
  return COMMAND_SHAPE[type].operation;
}

/** El comando que escribe esta entidad con esta operacion, si existe. */
export function commandTypeFor(
  entity: StructureEntity,
  operation: StructureOperation,
): StructureCommandType | null {
  const match = STRUCTURE_COMMAND_TYPES.find(
    (type) =>
      COMMAND_SHAPE[type].entity === entity &&
      COMMAND_SHAPE[type].operation === operation,
  );
  return match ?? null;
}

function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;
}

function isRealIsoDate(value: string): boolean {
  const instant = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(instant.getTime()) &&
    instant.toISOString().slice(0, 10) === value
  );
}
