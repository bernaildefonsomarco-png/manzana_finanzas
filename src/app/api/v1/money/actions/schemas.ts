import { z } from "zod";

const UuidSchema = z.string().uuid();

const PositiveMoneySchema = z
  .number()
  .finite()
  .positive("El monto debe ser mayor a cero")
  .max(999_999_999.99, "Monto demasiado alto")
  .refine(hasAtMostTwoDecimals, "El monto acepta maximo dos decimales");

const BalanceSchema = z
  .number()
  .finite()
  .min(-999_999_999.99, "Saldo demasiado bajo")
  .max(999_999_999.99, "Saldo demasiado alto")
  .refine(hasAtMostTwoDecimals, "El saldo acepta maximo dos decimales");

const OptionalReasonSchema = z.string().trim().min(1).max(180).optional();
const OptionalDescriptionSchema = z.string().trim().min(1).max(180).optional();

export const AdjustAccountBalanceRequestSchema = z
  .object({
    action: z.literal("adjust_account_balance"),
    account_id: UuidSchema,
    target_balance: BalanceSchema,
    reason: OptionalReasonSchema,
  })
  .strict();

export const TransferBetweenAccountsRequestSchema = z
  .object({
    action: z.literal("transfer_between_accounts"),
    from_account_id: UuidSchema,
    to_account_id: UuidSchema,
    amount: PositiveMoneySchema,
    description: OptionalDescriptionSchema,
  })
  .strict()
  .refine((value) => value.from_account_id !== value.to_account_id, {
    path: ["to_account_id"],
    message: "La cuenta destino debe ser distinta.",
  });

export const MoveBoxMoneyRequestSchema = z
  .object({
    action: z.literal("move_box_money"),
    mode: z.enum(["separate_to_box", "release_from_box", "box_to_box"]),
    amount: PositiveMoneySchema,
    box_origin_id: UuidSchema.nullable().optional(),
    box_destination_id: UuidSchema.nullable().optional(),
    description: OptionalDescriptionSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      (value.mode === "release_from_box" || value.mode === "box_to_box") &&
      !value.box_origin_id
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["box_origin_id"],
        message: "Elige la caja origen.",
      });
    }

    if (
      (value.mode === "separate_to_box" || value.mode === "box_to_box") &&
      !value.box_destination_id
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["box_destination_id"],
        message: "Elige la caja destino.",
      });
    }

    if (
      value.mode === "box_to_box" &&
      value.box_origin_id &&
      value.box_destination_id &&
      value.box_origin_id === value.box_destination_id
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["box_destination_id"],
        message: "La caja destino debe ser distinta.",
      });
    }
  });

export const MoneyActionRequestSchema = z.discriminatedUnion("action", [
  AdjustAccountBalanceRequestSchema,
  TransferBetweenAccountsRequestSchema,
  MoveBoxMoneyRequestSchema,
]);

export type MoneyActionRequest = z.infer<typeof MoneyActionRequestSchema>;

function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;
}
