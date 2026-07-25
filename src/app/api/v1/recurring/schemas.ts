import { z } from "zod";
import {
  CATEGORY_IDS,
  RECURRING_AMOUNT_VARIABILITIES,
  RECURRING_FREQUENCIES,
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
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha invalida");

const OptionalUuidSchema = z.string().uuid().nullable().optional();

export const ListRecurringQuerySchema = z.object({
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
});

export const CreateRecurringRuleRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    expected_amount: PositiveMoneySchema,
    amount_variability: z.enum(RECURRING_AMOUNT_VARIABILITIES).default("fixed"),
    currency: z.enum(["PEN", "USD"]).default("PEN"),
    frequency: z.enum(RECURRING_FREQUENCIES).default("monthly"),
    next_expected_date: IsoDateSchema,
    category_id: z.enum(CATEGORY_IDS).nullable().optional(),
    default_account_id: OptionalUuidSchema,
  })
  .strict();

export const UpdateRecurringRuleRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    expected_amount: PositiveMoneySchema.optional(),
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

export const ConfirmRecurringCandidateRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    expected_amount: PositiveMoneySchema.optional(),
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
