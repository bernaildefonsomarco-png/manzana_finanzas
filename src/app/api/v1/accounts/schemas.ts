import { z } from "zod";
import { ACCOUNT_TYPES } from "@/shared/types/domain";

export const AccountTypeSchema = z.enum(ACCOUNT_TYPES);

const DecimalBalanceSchema = z
  .number()
  .finite()
  .min(-999_999_999.99, "Saldo demasiado bajo")
  .max(999_999_999.99, "Saldo demasiado alto")
  .refine(hasAtMostTwoDecimals, "El saldo acepta maximo dos decimales");

export const CreateAccountRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    type: AccountTypeSchema.default("digital"),
    institution: z.string().trim().min(1).max(80).nullable().optional(),
    currency: z.enum(["PEN", "USD"]).default("PEN"),
    initial_balance: DecimalBalanceSchema.default(0),
    is_default: z.boolean().optional(),
    color: z.string().trim().min(1).max(40).nullable().optional(),
    icon: z.string().trim().min(1).max(40).nullable().optional(),
  })
  .strict();

export type CreateAccountRequest = z.infer<typeof CreateAccountRequestSchema>;

export const ListAccountsQuerySchema = z
  .object({
    limit: z.coerce.number().int().positive().optional(),
    cursor: z.string().optional(),
  })
  .strict();

export const UpdateAccountRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    type: AccountTypeSchema.optional(),
    institution: z.string().trim().min(1).max(80).nullable().optional(),
    color: z.string().trim().min(1).max(40).nullable().optional(),
    icon: z.string().trim().min(1).max(40).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Envia al menos un campo para actualizar.",
  });

export const DeleteAccountRequestSchema = z
  .object({
    reason: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

export type UpdateAccountRequest = z.infer<typeof UpdateAccountRequestSchema>;
export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequestSchema>;

function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;
}
