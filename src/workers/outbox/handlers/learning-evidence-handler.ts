import type { SupabaseClient } from "@supabase/supabase-js";
import { LearningEngine } from "@/core/learning";
import { SupabaseFinancialCoreRepository } from "@/data/repositories/movements.repository";
import type { Database } from "@/data/supabase/types";
import {
  CATEGORY_IDS,
  type CategoryId,
  type Movement,
} from "@/shared/types/domain";
import type { OutboxHandler } from "@/workers/outbox/outbox-publisher";

type Client = SupabaseClient<Database>;

export function createLearningEvidenceHandler(client: Client): OutboxHandler {
  return {
    consumerName: "learning_evidence.confirmed_core_v1",
    canHandle: (event) =>
      event.aggregate_type === "movement" &&
      ["movement_created", "movement_corrected"].includes(event.event_type),
    handle: async (event) => {
      const movement = await new SupabaseFinancialCoreRepository(
        client,
      ).getMovementById(event.user_id, event.aggregate_id);
      if (!movement || !["confirmed", "corrected"].includes(movement.status)) {
        return;
      }
      const engine = new LearningEngine(client);
      if (event.event_type === "movement_corrected") {
        const command = correctionCommandFromMovement(
          movement,
          readString(event.payload.command_id) ??
            `outbox:${event.id}:movement-correction`,
        );
        if (command) {
          await engine.learnFromConfirmedCorrection({
            userId: event.user_id,
            command,
            movement,
            traceId: event.trace_id,
          });
        }
        return;
      }
      await engine.learnFromConfirmedMovement({
        userId: event.user_id,
        movement,
        traceId: event.trace_id,
      });
    },
  };
}

function correctionCommandFromMovement(
  movement: Movement,
  commandId: string,
) {
  const target = readString(movement.metadata.correction_target_type);
  const categoryId = readString(movement.metadata.corrected_category_id);
  if (
    target === "category" &&
    categoryId &&
    CATEGORY_IDS.includes(categoryId as CategoryId)
  ) {
    return {
      kind: "category" as const,
      command_id: commandId,
      movement_id: movement.id,
      category_id: categoryId as CategoryId,
    };
  }
  if (target === "prestamo_dado" || target === "prestamo_recibido") {
    const person = readString(movement.metadata.related_person_name);
    if (!person) return null;
    const targetType =
      target === "prestamo_dado"
        ? ("prestamo_dado" as const)
        : ("prestamo_recibido" as const);
    return {
      kind: targetType === "prestamo_dado" ? ("loan_to" as const) : ("loan_from" as const),
      command_id: commandId,
      movement_id: movement.id,
      target_type: targetType,
      related_person_name: person,
    };
  }
  return null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
