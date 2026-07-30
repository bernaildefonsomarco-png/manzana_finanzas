import { z } from "zod";
import { hasAtMostTwoDecimals } from "@/shared/schemas/money";

const MoneySchema = z.coerce
  .number()
  .finite()
  .positive()
  .max(99_999_999_999.99)
  .refine(hasAtMostTwoDecimals, {
    message: "El monto admite como máximo dos decimales.",
  });

const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe usar YYYY-MM-DD.");

export const GoalStatusSchema = z.enum([
  "activa",
  "alcanzada",
  "pausada",
  "archivada",
]);

export const ListGoalsQuerySchema = z
  .object({
    status: z
      .string()
      .transform((value) => value.split(","))
      .pipe(z.array(GoalStatusSchema).min(1))
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().min(1).optional(),
  })
  .strict();

export const CreateGoalRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    target_amount: MoneySchema,
    target_date: IsoDateSchema.nullable().optional(),
    box_id: z.string().uuid().nullable().optional(),
  })
  .strict();

export const UpdateGoalRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    target_amount: MoneySchema.optional(),
    target_date: IsoDateSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Indica al menos un cambio.",
  });

export const LinkGoalBoxRequestSchema = z
  .object({
    box_id: z.string().uuid(),
  })
  .strict();

export const EmptyGoalRequestSchema = z.object({}).strict();

export type CreateGoalRequest = z.infer<typeof CreateGoalRequestSchema>;
export type UpdateGoalRequest = z.infer<typeof UpdateGoalRequestSchema>;
