import { z } from "zod";
import {
  CATEGORY_IDS,
  RECURRING_AMOUNT_VARIABILITIES,
  RECURRING_CANDIDATE_STATUSES,
  RECURRING_FREQUENCIES,
  RECURRING_OCCURRENCE_STATUSES,
  RECURRING_STATUSES,
} from "@/shared/types/domain";

const PositiveMoneySchema = z
  .number()
  .finite()
  .positive("El monto debe ser mayor a cero")
  .max(999_999_999.99, "Monto demasiado alto")
  .refine(hasAtMostTwoDecimals, "El monto acepta maximo dos decimales");

const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha invalida")
  .refine(isRealIsoDate, "Fecha invalida");

const OptionalUuidSchema = z.string().uuid().nullable().optional();
const RecurringNameSchema = z.string().trim().min(1).max(60);

export const ListRecurringQuerySchema = z
  .object({
    status: z
      .string()
      .optional()
      .transform((value) => {
        if (!value) return ["active", "suggested", "paused"] as const;
        return value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      })
      .pipe(z.array(z.enum(RECURRING_STATUSES)).min(1).max(5)),
    limit: z.coerce.number().int().positive().optional(),
    cursor: z.string().optional(),
  })
  .strict();

export const CreateRecurringRuleRequestSchema = z
  .object({
    name: RecurringNameSchema,
    expected_amount: PositiveMoneySchema.nullable().optional(),
    amount_variability: z.enum(RECURRING_AMOUNT_VARIABILITIES).default("fixed"),
    currency: z.enum(["PEN", "USD"]).default("PEN"),
    frequency: z.enum(RECURRING_FREQUENCIES).default("monthly"),
    next_expected_date: IsoDateSchema,
    category_id: z.enum(CATEGORY_IDS).nullable().optional(),
    default_account_id: OptionalUuidSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.amount_variability === "fixed" && value.expected_amount == null) {
      context.addIssue({
        code: "custom",
        path: ["expected_amount"],
        message: "El monto es obligatorio para un pago fijo",
      });
    }
  });

export const UpdateRecurringRuleRequestSchema = z
  .object({
    name: RecurringNameSchema.optional(),
    expected_amount: PositiveMoneySchema.nullable().optional(),
    amount_variability: z.enum(RECURRING_AMOUNT_VARIABILITIES).optional(),
    frequency: z.enum(RECURRING_FREQUENCIES).optional(),
    next_expected_date: IsoDateSchema.optional(),
    category_id: z.enum(CATEGORY_IDS).nullable().optional(),
    default_account_id: OptionalUuidSchema,
    status: z.enum(["active", "paused"]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Patch vacio");

export const DetectRecurringCandidatesRequestSchema = z
  .object({
    lookback_days: z.number().int().min(30).max(730).optional(),
    limit: z.number().int().min(20).max(1000).optional(),
  })
  .strict();

export const ListRecurringOccurrencesQuerySchema = z
  .object({
    status: z
      .string()
      .optional()
      .transform((value) =>
        value
          ? value
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
          : [...RECURRING_OCCURRENCE_STATUSES]
      )
      .pipe(z.array(z.enum(RECURRING_OCCURRENCE_STATUSES)).min(1)),
    from: IsoDateSchema.optional(),
    to: IsoDateSchema.optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    cursor: z.string().optional(),
  })
  .strict()
  .refine(
    (value) => !value.from || !value.to || value.from <= value.to,
    { message: "El rango de fechas es invalido", path: ["to"] }
  );

export const ListRecurringCandidatesQuerySchema = z
  .object({
    status: z
      .string()
      .optional()
      .transform((value) =>
        value
          ? value
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
          : ["candidate", "ready_to_suggest", "suggested"]
      )
      .pipe(z.array(z.enum(RECURRING_CANDIDATE_STATUSES)).min(1)),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
  .strict();

export const ConfirmRecurringCandidateRequestSchema = z
  .object({
    name: RecurringNameSchema.optional(),
    expected_amount: PositiveMoneySchema.nullable().optional(),
    amount_variability: z.enum(RECURRING_AMOUNT_VARIABILITIES).optional(),
    currency: z.enum(["PEN", "USD"]).optional(),
    frequency: z.enum(RECURRING_FREQUENCIES).optional(),
    next_expected_date: IsoDateSchema.optional(),
    category_id: z.enum(CATEGORY_IDS).nullable().optional(),
    default_account_id: OptionalUuidSchema,
  })
  .strict();

export type CreateRecurringRuleRequest = z.infer<
  typeof CreateRecurringRuleRequestSchema
>;
export type UpdateRecurringRuleRequest = z.infer<
  typeof UpdateRecurringRuleRequestSchema
>;
export type DetectRecurringCandidatesRequest = z.infer<
  typeof DetectRecurringCandidatesRequestSchema
>;
export type ConfirmRecurringCandidateRequest = z.infer<
  typeof ConfirmRecurringCandidateRequestSchema
>;

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
