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
  .refine(isValidIsoDate, "Usa una fecha valida")
  .nullable()
  .optional();

export const ListDebtsQuerySchema = z
  .object({
    direction: DebtDirectionSchema.optional(),
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
    name: z.string().trim().min(1).max(60),
    related_person_name: z.string().trim().min(1).max(60).nullable().optional(),
    principal_amount: MoneyAmountSchema,
    currency: z.enum(["PEN", "USD"]).default("PEN"),
    opened_at: OptionalDateSchema,
    due_date: OptionalDateSchema,
    next_payment_date: OptionalDateSchema,
    installment_count: z.number().int().min(1).max(360).nullable().optional(),
    installment_amount: MoneyAmountSchema.nullable().optional(),
    interest_notes: z.string().trim().max(300).nullable().optional(),
    account_id: z.string().uuid().nullable().optional(),
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

    const openedAt = value.opened_at ?? limaIsoDate();
    if (openedAt > limaIsoDate()) {
      ctx.addIssue({
        code: "custom",
        path: ["opened_at"],
        message: "La fecha de apertura no puede estar en el futuro.",
      });
    }

    const firstDueDate = value.next_payment_date ?? value.due_date;
    if (firstDueDate && firstDueDate <= openedAt) {
      ctx.addIssue({
        code: "custom",
        path: ["next_payment_date"],
        message: "La primera fecha de pago debe ser posterior a la apertura.",
      });
    }

    if (
      value.installment_count &&
      value.installment_amount &&
      Math.abs(
        value.installment_count * value.installment_amount -
          value.principal_amount
      ) /
        value.principal_amount >
        0.01
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["installment_amount"],
        message:
          "El total de cuotas debe aproximarse al monto de la deuda con tolerancia de 1%.",
      });
    }
  });

export type CreateDebtRequest = z.infer<typeof CreateDebtRequestSchema>;

function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;
}

function isValidIsoDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function limaIsoDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
