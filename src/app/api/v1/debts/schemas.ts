import { z } from "zod";
import {
  DEBT_DIRECTIONS,
  DEBT_KINDS,
  DEBT_STATUSES,
} from "@/shared/types/domain";

export const DebtDirectionSchema = z.enum(DEBT_DIRECTIONS);
export const DebtKindSchema = z.enum(DEBT_KINDS);
export const DebtStatusSchema = z.enum(DEBT_STATUSES);

const MoneyAmountSchema = z
  .number()
  .finite()
  .min(0.01, "El monto debe ser mayor a 0")
  .max(999_999_999.99, "Monto demasiado alto")
  .refine(hasAtMostTwoDecimals, "El monto acepta maximo dos decimales");

const OptionalDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Usa fecha YYYY-MM-DD")
  .nullable()
  .optional();

export const ListDebtsQuerySchema = z
  .object({
    status: z
      .string()
      .trim()
      .optional()
      .transform((value) =>
        value
          ? value
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
          : ["active", "due_soon", "overdue"]
      )
      .pipe(z.array(DebtStatusSchema).min(1)),
    limit: z.coerce.number().int().positive().optional(),
    cursor: z.string().optional(),
  })
  .strict();

export const CreateDebtRequestSchema = z
  .object({
    direction: DebtDirectionSchema,
    kind: DebtKindSchema.default("personal"),
    name: z.string().trim().min(1).max(120),
    related_person_name: z.string().trim().min(1).max(120).nullable().optional(),
    principal_amount: MoneyAmountSchema,
    currency: z.enum(["PEN", "USD"]).default("PEN"),
    opened_at: OptionalDateSchema,
    due_date: OptionalDateSchema,
    next_payment_date: OptionalDateSchema,
    installment_count: z.number().int().min(1).max(240).nullable().optional(),
    installment_amount: MoneyAmountSchema.nullable().optional(),
    interest_notes: z.string().trim().max(300).nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.kind === "installment_purchase" && !value.installment_count) {
      ctx.addIssue({
        code: "custom",
        path: ["installment_count"],
        message: "Indica cuantas cuotas tiene esta deuda.",
      });
    }

    if (value.installment_count && !value.next_payment_date && !value.due_date) {
      ctx.addIssue({
        code: "custom",
        path: ["next_payment_date"],
        message: "Indica la primera fecha de cuota.",
      });
    }
  });

export type CreateDebtRequest = z.infer<typeof CreateDebtRequestSchema>;

function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;
}
