import { z } from "zod";
import { CATEGORY_IDS } from "@/shared/types/domain";

const LabelSchema = z.string().trim().min(2).max(80);

export const CreateSubcategoryRequestSchema = z.object({
  category_id: z.enum(CATEGORY_IDS),
  label: LabelSchema,
});

export const UpdateSubcategoryRequestSchema = z.object({
  label: LabelSchema,
});

export const CreateTagRequestSchema = z.object({ label: LabelSchema });
export const UpdateTagRequestSchema = CreateTagRequestSchema;

export const CreateRelatedPersonRequestSchema = z.object({
  display_name: LabelSchema,
  kind: z.string().trim().min(1).max(40).default("person"),
  relationship_label: z.string().trim().min(1).max(80).nullable().optional(),
});

export const UpdateRelatedPersonRequestSchema = z.object({
  display_name: LabelSchema,
  kind: z.string().trim().min(1).max(40).default("person"),
  relationship_label: z.string().trim().min(1).max(80).nullable().optional(),
});

export const ClassificationIdParamsSchema = z.object({
  id: z.string().uuid(),
});

// `categories`, `subcategories`, `tags` (`14` §10) comparten esta forma de
// listado: catalogo pequeno y acotado por usuario, paginado en memoria
// (`pagination.ts`, `paginateInMemory`).
export const ListClassificationQuerySchema = z
  .object({
    limit: z.coerce.number().int().positive().optional(),
    cursor: z.string().optional(),
  })
  .strict();

