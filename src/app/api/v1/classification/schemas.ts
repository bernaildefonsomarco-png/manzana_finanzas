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

export const MovementClassificationRequestSchema = z
  .object({
    category_id: z.enum(CATEGORY_IDS).nullable(),
    subcategory_id: z.string().uuid().nullable().default(null),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.subcategory_id && !value.category_id) {
      context.addIssue({
        code: "custom",
        path: ["subcategory_id"],
        message: "Una subcategoria necesita su categoria.",
      });
    }
  });

export const BulkClassificationRequestSchema = z
  .object({
    movement_ids: z.array(z.string().uuid()).min(1),
    excluded_ids: z.array(z.string().uuid()).default([]),
    category_id: z.enum(CATEGORY_IDS).nullable(),
    subcategory_id: z.string().uuid().nullable().default(null),
    include_manually_corrected: z.boolean().default(false),
    preview: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.subcategory_id && !value.category_id) {
      context.addIssue({
        code: "custom",
        path: ["subcategory_id"],
        message: "Una subcategoria necesita su categoria.",
      });
    }
    const selected = new Set(value.movement_ids);
    for (const excludedId of value.excluded_ids) {
      if (!selected.has(excludedId)) {
        context.addIssue({
          code: "custom",
          path: ["excluded_ids"],
          message: "Solo puedes excluir movimientos de la seleccion.",
        });
        break;
      }
    }
  });

export const MergeSubcategoryRequestSchema = z.union([
  z.object({
    target_subcategory_id: z.string().uuid(),
    preview: z.boolean(),
  }).strict(),
  z.object({
    undo_batch_id: z.string().uuid(),
  }).strict(),
]);

export const ClassificationBatchIdParamsSchema = z.object({
  batch_id: z.string().uuid(),
});

// `categories`, `subcategories`, `tags` (`14` §10) comparten esta forma de
// listado: catalogo pequeno y acotado por usuario, paginado en memoria
// (`pagination.ts`, `paginateInMemory`).
export const ListClassificationQuerySchema = z
  .object({
    limit: z.coerce.number().int().positive().optional(),
    cursor: z.string().optional(),
    // `25` §10: `GET /subcategories` filtra por `category_id` (SCR-CAT-02).
    category_id: z.enum(CATEGORY_IDS).optional(),
  })
  .strict();
