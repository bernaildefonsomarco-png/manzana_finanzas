import { z } from "zod";
import { BOX_TYPES } from "@/shared/types/domain";

export const BoxTypeSchema = z.enum(BOX_TYPES);

const DecimalMoneySchema = z
  .number()
  .finite()
  .min(0, "El monto no puede ser negativo")
  .max(999_999_999.99, "Monto demasiado alto")
  .refine(hasAtMostTwoDecimals, "El monto acepta maximo dos decimales");

const OptionalDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Usa formato YYYY-MM-DD")
  .nullable()
  .optional();

export const ListBoxesQuerySchema = z
  .object({
    account_id: z.string().uuid().optional(),
  })
  .strict();

export const CreateBoxRequestSchema = z
  .object({
    account_id: z.string().uuid(),
    name: z.string().trim().min(1).max(80),
    type: BoxTypeSchema.default("objetivo"),
    initial_balance: DecimalMoneySchema.default(0),
    target_amount: DecimalMoneySchema.nullable().optional(),
    target_date: OptionalDateSchema,
  })
  .strict()
  .refine(
    (value) =>
      value.target_amount == null ||
      value.initial_balance <= value.target_amount,
    {
      path: ["initial_balance"],
      message: "El monto separado no debe superar la meta de la caja.",
    }
  );

export type CreateBoxRequest = z.infer<typeof CreateBoxRequestSchema>;

export const UpdateBoxRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    type: BoxTypeSchema.optional(),
    target_amount: DecimalMoneySchema.nullable().optional(),
    target_date: OptionalDateSchema,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Envia al menos un campo para actualizar.",
  });

export const DeleteBoxRequestSchema = z
  .object({
    reason: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

export type UpdateBoxRequest = z.infer<typeof UpdateBoxRequestSchema>;
export type DeleteBoxRequest = z.infer<typeof DeleteBoxRequestSchema>;

function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;
}
