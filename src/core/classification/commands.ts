import { z } from "zod";
import { CATEGORY_IDS } from "@/shared/types/domain";
import { ActorSchema, CommandEnvelopeBaseSchema } from "@/core/finance/commands";

export const ClassificationActorSchema = ActorSchema;

const LabelSchema = z.string().trim().min(2).max(80);
const OptionalRelationshipSchema = z.string().trim().min(1).max(80).nullable();

export const ClassificationCommandSchema = z.discriminatedUnion("type", [
  CommandEnvelopeBaseSchema.extend({
    type: z.literal("CreateUserSubcategoryCommand"),
    payload: z.object({
      category_id: z.enum(CATEGORY_IDS),
      label: LabelSchema,
      created_by: z.enum(["user", "llm", "learning", "import"]),
      confirmed_by_user: z.boolean(),
    }),
  }),
  CommandEnvelopeBaseSchema.extend({
    type: z.literal("UpdateUserSubcategoryCommand"),
    payload: z.object({
      subcategory_id: z.string().uuid(),
      label: LabelSchema,
    }),
  }),
  CommandEnvelopeBaseSchema.extend({
    type: z.literal("ArchiveUserSubcategoryCommand"),
    payload: z.object({ subcategory_id: z.string().uuid() }),
  }),
  CommandEnvelopeBaseSchema.extend({
    type: z.literal("CreateUserTagCommand"),
    payload: z.object({
      label: LabelSchema,
      confirmed_by_user: z.boolean(),
    }),
  }),
  CommandEnvelopeBaseSchema.extend({
    type: z.literal("UpdateUserTagCommand"),
    payload: z.object({ tag_id: z.string().uuid(), label: LabelSchema }),
  }),
  CommandEnvelopeBaseSchema.extend({
    type: z.literal("ArchiveUserTagCommand"),
    payload: z.object({ tag_id: z.string().uuid() }),
  }),
  CommandEnvelopeBaseSchema.extend({
    type: z.literal("CreateRelatedPersonCommand"),
    payload: z.object({
      display_name: LabelSchema,
      kind: z.string().trim().min(1).max(40).default("person"),
      relationship_label: OptionalRelationshipSchema,
      confirmed_by_user: z.boolean(),
    }),
  }),
  CommandEnvelopeBaseSchema.extend({
    type: z.literal("UpdateRelatedPersonCommand"),
    payload: z.object({
      related_person_id: z.string().uuid(),
      display_name: LabelSchema,
      kind: z.string().trim().min(1).max(40),
      relationship_label: OptionalRelationshipSchema,
    }),
  }),
  CommandEnvelopeBaseSchema.extend({
    type: z.literal("ArchiveRelatedPersonCommand"),
    payload: z.object({ related_person_id: z.string().uuid() }),
  }),
  CommandEnvelopeBaseSchema.extend({
    type: z.literal("SetMovementTagsCommand"),
    payload: z.object({
      movement_id: z.string().uuid(),
      // RUL-CAT §7 / ERR-CAT-05: maximo 6 etiquetas por movimiento.
      tag_ids: z.array(z.string().uuid()).max(6, "Un movimiento puede tener hasta 6 etiquetas."),
      assignment_source: z.enum(["user", "agent", "learning", "import"]),
      confirmed_by_user: z.boolean(),
    }),
  }),
]);

export type ClassificationCommand = z.infer<typeof ClassificationCommandSchema>;
