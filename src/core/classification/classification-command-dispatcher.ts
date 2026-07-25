import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { appendOutboxEvent } from "@/data/repositories/events.repository";
import type { Database } from "@/data/supabase/types";
import {
  appendClassificationAudit,
  insertRelatedPerson,
  insertSubcategory,
  insertTag,
  setMovementTags,
  updateRelatedPerson,
  updateSubcategory,
  updateTag,
} from "@/data/repositories/classification.repository";
import {
  ClassificationCommandSchema,
  type ClassificationCommand,
} from "./commands";

type Client = SupabaseClient<Database>;

export class ClassificationCommandDispatcher {
  constructor(private readonly client: Client) {}

  async dispatch(raw: ClassificationCommand) {
    const command = ClassificationCommandSchema.parse(raw);
    enforceConfirmation(command);

    const entity = await this.execute(command);
    const action = command.type.startsWith("Create")
      ? "created"
      : command.type.startsWith("Archive")
        ? "deleted"
        : "updated";
    const entityType = command.type === "SetMovementTagsCommand"
      ? "movement_tags"
      : command.type.includes("Subcategory")
      ? "user_subcategory"
      : command.type.includes("Tag")
        ? "tag"
        : "related_person";

    await appendClassificationAudit(this.client, {
      userId: command.user_id,
      entityType,
      entityId: entity.id,
      action,
      actorType: command.actor.type,
      actorId: command.actor.id,
      source: command.source,
      traceId: command.trace_id,
      commandId: command.command_id,
      newValue: entity,
      movementId:
        command.type === "SetMovementTagsCommand"
          ? command.payload.movement_id
          : null,
    });
    await appendOutboxEvent(this.client, {
      id: randomUUID(),
      user_id: command.user_id,
      event_type: `${entityType}_${action}`,
      aggregate_type: entityType,
      aggregate_id: entity.id,
      payload_version: 1,
      trace_id: command.trace_id,
      payload: { entity_id: entity.id, command_id: command.command_id },
      metadata: { source: command.source, actor_type: command.actor.type },
    });

    return { type: `${entityType}_${action}`, entity };
  }

  private execute(command: ClassificationCommand) {
    switch (command.type) {
      case "CreateUserSubcategoryCommand":
        return insertSubcategory(this.client, {
          userId: command.user_id,
          categoryId: command.payload.category_id,
          label: command.payload.label,
          createdBy: command.payload.created_by,
        });
      case "UpdateUserSubcategoryCommand":
        return updateSubcategory(this.client, {
          userId: command.user_id,
          id: command.payload.subcategory_id,
          label: command.payload.label,
        });
      case "ArchiveUserSubcategoryCommand":
        return updateSubcategory(this.client, {
          userId: command.user_id,
          id: command.payload.subcategory_id,
          archive: true,
        });
      case "CreateUserTagCommand":
        return insertTag(this.client, {
          userId: command.user_id,
          label: command.payload.label,
        });
      case "UpdateUserTagCommand":
        return updateTag(this.client, {
          userId: command.user_id,
          id: command.payload.tag_id,
          label: command.payload.label,
        });
      case "ArchiveUserTagCommand":
        return updateTag(this.client, {
          userId: command.user_id,
          id: command.payload.tag_id,
          archive: true,
        });
      case "CreateRelatedPersonCommand":
        return insertRelatedPerson(this.client, {
          userId: command.user_id,
          displayName: command.payload.display_name,
          kind: command.payload.kind,
          relationshipLabel: command.payload.relationship_label,
        });
      case "UpdateRelatedPersonCommand":
        return updateRelatedPerson(this.client, {
          userId: command.user_id,
          id: command.payload.related_person_id,
          displayName: command.payload.display_name,
          kind: command.payload.kind,
          relationshipLabel: command.payload.relationship_label,
        });
      case "ArchiveRelatedPersonCommand":
        return updateRelatedPerson(this.client, {
          userId: command.user_id,
          id: command.payload.related_person_id,
          archive: true,
        });
      case "SetMovementTagsCommand":
        return setMovementTags(this.client, {
          userId: command.user_id,
          movementId: command.payload.movement_id,
          tagIds: command.payload.tag_ids,
          source: command.payload.assignment_source,
        });
    }
  }
}

function enforceConfirmation(command: ClassificationCommand) {
  if (
    command.type === "CreateUserSubcategoryCommand" &&
    command.payload.created_by !== "user" &&
    !command.payload.confirmed_by_user
  ) {
    throw new Error("Las subcategorias inferidas requieren confirmacion del usuario.");
  }
  if (
    (command.type === "CreateUserTagCommand" ||
      command.type === "CreateRelatedPersonCommand") &&
    !command.payload.confirmed_by_user
  ) {
    throw new Error("La nueva clasificacion requiere confirmacion del usuario.");
  }
  if (
    command.type === "SetMovementTagsCommand" &&
    command.payload.assignment_source !== "user" &&
    !command.payload.confirmed_by_user
  ) {
    throw new Error("Las etiquetas inferidas requieren confirmacion del usuario.");
  }
}
