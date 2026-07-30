import { z } from "zod";
import { CategoryIdSchema, MovementTypeSchema } from "@/shared/schemas/money";

// 29 S7: nombre 1-40 caracteres, unico por usuario (impuesto por la base).
const NameSchema = z.string().trim().min(1).max(40);

export const CreateTemplateRequestSchema = z
  .object({
    name: NameSchema,
    type: MovementTypeSchema,
    amount: z.number().positive().nullable().optional(),
    merchant: z.string().trim().min(1).max(160).nullable().optional(),
    description: z.string().trim().min(1).max(240).nullable().optional(),
    category_id: CategoryIdSchema.nullable().optional(),
    subcategory_id: z.string().uuid().nullable().optional(),
    account_id: z.string().uuid().nullable().optional(),
    box_id: z.string().uuid().nullable().optional(),
  })
  .strict();

export const UpdateTemplateRequestSchema = CreateTemplateRequestSchema.partial()
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, "Nada que actualizar");

export type CreateTemplateRequest = z.infer<typeof CreateTemplateRequestSchema>;
export type UpdateTemplateRequest = z.infer<typeof UpdateTemplateRequestSchema>;
