import { z } from "zod";
import { hasAtMostTwoDecimals } from "@/shared/schemas/money";

export const BudgetPeriodSchema = z.enum([
  "semanal",
  "quincenal",
  "mensual",
]);
export const BudgetKindSchema = z.enum([
  "presupuesto",
  "limite_blando",
  "limite_duro",
]);
export const BudgetStatusSchema = z.enum(["activo", "pausado", "archivado"]);

const MoneySchema = z.coerce
  .number()
  .finite()
  .positive()
  .max(99_999_999_999.99)
  .refine(hasAtMostTwoDecimals, {
    message: "El monto admite como máximo dos decimales.",
  });

const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe usar YYYY-MM-DD.");

export const ListBudgetsQuerySchema = z
  .object({
    period_kind: BudgetPeriodSchema.default("mensual"),
    date: IsoDateSchema.optional(),
    status: z
      .string()
      .transform((value) => value.split(","))
      .pipe(z.array(BudgetStatusSchema).min(1))
      .optional(),
    kind: BudgetKindSchema.optional(),
    category_id: z.string().min(1).max(80).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().min(1).optional(),
  })
  .strict();

export const CreateBudgetRequestSchema = z
  .object({
    amount: MoneySchema,
    category_id: z.string().min(1).max(80).nullable().optional(),
    period_kind: BudgetPeriodSchema.default("mensual"),
    kind: BudgetKindSchema.default("presupuesto"),
    rollover: z.boolean().default(false),
    auto_renew: z.boolean().default(true),
    date: IsoDateSchema.optional(),
    source: z.enum(["manual", "sugerido"]).default("manual"),
  })
  .strict();

export const UpdateBudgetRequestSchema = z
  .object({
    amount: MoneySchema.optional(),
    kind: BudgetKindSchema.optional(),
    rollover: z.boolean().optional(),
    auto_renew: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Indica al menos un cambio.",
  });

export const CopyPreviousBudgetRequestSchema = z
  .object({
    period_kind: BudgetPeriodSchema.default("mensual"),
    date: IsoDateSchema.optional(),
  })
  .strict();

export const AcceptBudgetSuggestionRequestSchema = z
  .object({
    amount: MoneySchema.optional(),
    rollover: z.boolean().default(false),
    auto_renew: z.boolean().default(true),
  })
  .strict();

export const EmptyObjectSchema = z.object({}).strict();

export type BudgetPeriodInput = z.infer<typeof BudgetPeriodSchema>;
export type BudgetKindInput = z.infer<typeof BudgetKindSchema>;
export type BudgetStatusInput = z.infer<typeof BudgetStatusSchema>;
export type CreateBudgetRequest = z.infer<typeof CreateBudgetRequestSchema>;
export type UpdateBudgetRequest = z.infer<typeof UpdateBudgetRequestSchema>;
