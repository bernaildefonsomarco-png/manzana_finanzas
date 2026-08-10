import { randomUUID } from "node:crypto";
import type { StructureProposalRequest } from "@/agents/conversational-executive-agent/types";
import {
  CreateBoxPayloadSchema,
  CreateBudgetPayloadSchema,
  CreateGoalPayloadSchema,
  UpdateBoxPayloadSchema,
  UpdateBudgetPayloadSchema,
  UpdateGoalPayloadSchema,
  type StructureCommandType,
  type StructureEntity,
  type StructureOperation,
} from "./structure-commands";
import type { StructureProposal } from "./structure-proposal";
import {
  composeStructureAmbiguityQuestion,
  readStructureIntent,
  structureProposalConflictsWithIntent,
} from "./structure-intent";

/**
 * Convierte lo que el ejecutivo entendio en un borrador tipado y confirmable,
 * o en una pregunta.
 *
 * Aqui vive el criterio duro que el modelo no decide solo (`RUL-PRES-01`):
 *
 *  - si el mensaje admite mas de una lectura entre caja, meta y presupuesto,
 *    el turno **pregunta**;
 *  - si la propuesta contradice lo que el usuario dijo —clasico: pide apartar
 *    dinero y el modelo propone un presupuesto, que no aparta nada— tambien
 *    pregunta;
 *  - si falta un dato obligatorio de la entidad, tampoco se propone: sin
 *    cuenta no hay caja, sin monto no hay presupuesto.
 *
 * Nada de esto escribe: un borrador solo se ejecuta cuando el usuario lo
 * confirma en el turno siguiente.
 */
export type CompiledStructureProposal =
  /** No hay nada de estructura en este turno. */
  | { kind: "none" }
  /** Borrador listo, esperando el "si" del usuario. */
  | { kind: "proposal"; proposal: StructureProposal }
  /** Hay que preguntar antes de escribir. */
  | { kind: "needs_clarification"; question: string };

/** Bajo esta confianza, la propuesta no se presenta como accion. */
const MIN_STRUCTURE_CONFIDENCE = 0.6;

export function compileStructureProposal(input: {
  request: StructureProposalRequest | null | undefined;
  /** Texto original del usuario, para el guardarrail deterministico. */
  userText: string;
  now: string;
}): CompiledStructureProposal {
  const request = input.request ?? null;
  const reading = readStructureIntent(input.userText);

  if (!request || request.intent === "none" || !request.entity) {
    // El modelo no propuso nada, pero el mensaje si pedia estructura de forma
    // ambigua: preguntar sigue siendo mejor que callar.
    if (reading.kind === "ambiguous") {
      return {
        kind: "needs_clarification",
        question: composeStructureAmbiguityQuestion(reading.candidates),
      };
    }
    return { kind: "none" };
  }

  if (request.ambiguities.length > 0) {
    return {
      kind: "needs_clarification",
      question: composeStructureQuestionFromAmbiguities(request),
    };
  }

  if (request.confidence < MIN_STRUCTURE_CONFIDENCE) {
    return {
      kind: "needs_clarification",
      question: composeStructureQuestionFromAmbiguities(request),
    };
  }

  if (
    structureProposalConflictsWithIntent({
      proposedEntity: request.entity,
      reading,
    })
  ) {
    return {
      kind: "needs_clarification",
      question:
        reading.kind === "ambiguous"
          ? composeStructureAmbiguityQuestion(reading.candidates)
          : composeStructureAmbiguityQuestion([
              request.entity,
              ...(reading.kind === "unambiguous" ? [reading.entity] : []),
            ]),
    };
  }

  const operation: StructureOperation =
    request.intent === "update" ? "update" : "create";
  const built = buildPayload({ request, operation });
  if (!built) {
    return {
      kind: "needs_clarification",
      question: composeMissingDataQuestion(request.entity, operation),
    };
  }

  return {
    kind: "proposal",
    proposal: {
      proposal_id: randomUUID(),
      entity: request.entity,
      operation,
      command_type: built.commandType,
      payload: built.payload,
      summary: request.summary.trim() || defaultSummary(request.entity, operation),
      confirm_label: request.confirm_label.trim() || "Sí, hazlo",
      proposed_at: input.now,
    },
  };
}

function buildPayload(input: {
  request: StructureProposalRequest;
  operation: StructureOperation;
}): {
  commandType: StructureCommandType;
  payload: Record<string, unknown>;
} | null {
  const { request, operation } = input;

  if (request.entity === "caja") {
    if (operation === "create") {
      const parsed = CreateBoxPayloadSchema.safeParse({
        name: request.name,
        account_id: request.account_id,
        type: request.box_type ?? "objetivo",
        initial_balance: request.amount ?? 0,
        target_amount: request.target_amount,
        target_date: request.target_date,
      });
      return parsed.success
        ? { commandType: "CreateBoxCommand", payload: parsed.data }
        : null;
    }
    const parsed = UpdateBoxPayloadSchema.safeParse(
      dropUndefined({
        box_id: request.target_id,
        name: request.name ?? undefined,
        type: request.box_type ?? undefined,
        target_amount: request.target_amount ?? undefined,
        target_date: request.target_date ?? undefined,
      }),
    );
    return parsed.success
      ? { commandType: "UpdateBoxCommand", payload: parsed.data }
      : null;
  }

  if (request.entity === "meta") {
    if (operation === "create") {
      const parsed = CreateGoalPayloadSchema.safeParse({
        name: request.name,
        target_amount: request.target_amount ?? request.amount,
        target_date: request.target_date,
        box_id: request.box_id,
      });
      return parsed.success
        ? { commandType: "CreateGoalCommand", payload: parsed.data }
        : null;
    }
    const parsed = UpdateGoalPayloadSchema.safeParse(
      dropUndefined({
        goal_id: request.target_id,
        name: request.name ?? undefined,
        target_amount: request.target_amount ?? request.amount ?? undefined,
        target_date: request.target_date ?? undefined,
      }),
    );
    return parsed.success
      ? { commandType: "UpdateGoalCommand", payload: parsed.data }
      : null;
  }

  if (operation === "create") {
    const parsed = CreateBudgetPayloadSchema.safeParse({
      amount: request.amount ?? request.target_amount,
      category_id: request.category_id,
      period_kind: request.period_kind ?? "mensual",
      kind: request.budget_kind ?? "presupuesto",
      rollover: false,
      auto_renew: true,
    });
    return parsed.success
      ? { commandType: "CreateBudgetCommand", payload: parsed.data }
      : null;
  }

  const parsed = UpdateBudgetPayloadSchema.safeParse(
    dropUndefined({
      budget_id: request.target_id,
      amount: request.amount ?? request.target_amount ?? undefined,
      kind: request.budget_kind ?? undefined,
    }),
  );
  return parsed.success
    ? { commandType: "UpdateBudgetCommand", payload: parsed.data }
    : null;
}

function composeStructureQuestionFromAmbiguities(
  request: StructureProposalRequest,
): string {
  const primera = request.ambiguities[0];
  if (primera) return primera;
  return request.entity
    ? composeMissingDataQuestion(
        request.entity,
        request.intent === "update" ? "update" : "create",
      )
    : "¿Me confirmas qué quieres que cree?";
}

function composeMissingDataQuestion(
  entity: StructureEntity,
  operation: StructureOperation,
): string {
  if (operation === "update") {
    if (entity === "caja") return "¿Cuál caja quieres cambiar, y qué le cambio?";
    if (entity === "meta") return "¿Cuál meta quieres cambiar, y qué le cambio?";
    return "¿Cuál presupuesto quieres cambiar, y a cuánto lo dejo?";
  }

  if (entity === "caja") {
    return "Para crear la caja necesito el nombre y de qué cuenta sale el dinero. ¿Me los dices?";
  }
  if (entity === "meta") {
    return "Para crear la meta necesito el nombre y cuánto quieres juntar. ¿Me los dices?";
  }
  return "Para crear el presupuesto necesito el monto y de qué categoría es. ¿Me los dices?";
}

function defaultSummary(
  entity: StructureEntity,
  operation: StructureOperation,
): string {
  const verbo = operation === "create" ? "creo" : "cambio";
  if (entity === "caja") return `¿${capitalize(verbo)} esa caja?`;
  if (entity === "meta") return `¿${capitalize(verbo)} esa meta?`;
  return `¿${capitalize(verbo)} ese presupuesto?`;
}

function dropUndefined(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
