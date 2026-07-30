import { z } from "zod";
import { DebtKindSchema } from "../schemas";

const OptionalDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Usa fecha YYYY-MM-DD")
  .refine(isValidIsoDate, "Usa una fecha valida")
  .nullable();

export const UpdateDebtRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    kind: DebtKindSchema.optional(),
    due_date: OptionalDateSchema.optional(),
    interest_notes: z.string().trim().max(300).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Indica al menos un dato para actualizar.",
  });

export const CloseDebtRequestSchema = z
  .object({
    reason: z.enum(["paid", "forgiven"]),
  })
  .strict();

export const RescheduleDebtInstallmentRequestSchema = z
  .object({
    due_date: OptionalDateSchema.unwrap(),
    reason: z.string().trim().min(1).max(180).nullable().optional(),
  })
  .strict();

export const SkipDebtInstallmentRequestSchema = z
  .object({
    reason: z.string().trim().min(1).max(180),
  })
  .strict();

function isValidIsoDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
