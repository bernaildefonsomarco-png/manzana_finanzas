import { z } from "zod";

const PositiveMoneySchema = z
  .number()
  .finite()
  .positive("El monto debe ser mayor a cero")
  .max(999_999_999.99, "Monto demasiado alto")
  .refine(hasAtMostTwoDecimals, "El monto acepta maximo dos decimales");

export const MarkRecurringPaidRequestSchema = z
  .object({
    amount: PositiveMoneySchema,
    account_id: z.string().uuid().nullable().optional(),
    paid_at: z.string().datetime({ offset: true }).optional(),
    note: z.string().trim().min(1).max(180).nullable().optional(),
  })
  .strict();

export type MarkRecurringPaidRequest = z.infer<
  typeof MarkRecurringPaidRequestSchema
>;

function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;
}
