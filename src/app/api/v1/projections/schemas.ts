import { z } from "zod";
import { hasAtMostTwoDecimals } from "@/shared/schemas/money";

export const EmptyProjectionQuerySchema = z.object({}).strict();

export const SimulateExpenseRequestSchema = z
  .object({
    amount: z.coerce
      .number()
      .finite()
      .positive()
      .max(99_999_999_999.99)
      .refine(hasAtMostTwoDecimals, {
        message: "El monto admite como máximo dos decimales.",
      }),
    category_id: z.string().min(1).max(80).nullable().optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe usar YYYY-MM-DD.")
      .optional(),
  })
  .strict();
