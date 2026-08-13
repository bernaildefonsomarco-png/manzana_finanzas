import { randomUUID } from "node:crypto";
import type { ActionRequestOutcome } from "@/core/actions/action-request-outcome";
import { NOT_REQUESTED } from "@/core/actions/action-request-outcome";
import {
  describeDuplicateConsequence,
  describeRestoreConsequence,
} from "./movement-action-consequences";
import {
  MovementActionProposalSchema,
  type MovementActionProposal,
} from "./movement-action-proposal";

/**
 * `26` §14.2: los dos comandos de movimientos que este modulo sabe leer del
 * turno. `restaurar_movimiento` es `tarjeta` simple; `duplicar_movimiento` es
 * `tarjeta_editable` porque el usuario tiene que poder cambiar fecha o monto
 * antes de confirmar.
 */
export const MOVEMENT_ACTION_INTENTS = [
  "none",
  "restaurar_movimiento",
  "duplicar_movimiento",
] as const;
export type MovementActionIntent = (typeof MOVEMENT_ACTION_INTENTS)[number];

/** Lo que el ejecutivo entendio del turno, plano y sin comandos. */
export type MovementActionRequest = {
  intent: MovementActionIntent;
  /** El `id` exacto del movimiento, si lo leyo de una consulta de este turno. */
  movement_id: string;
  /**
   * Solo `duplicar_movimiento`: fecha nueva que pidio la persona, en
   * `YYYY-MM-DD`. Vacio significa "ahora", que resuelve el ejecutor al
   * confirmar (no aqui: pueden pasar minutos entre proponer y confirmar).
   */
  new_occurred_at: string;
  /**
   * Solo `duplicar_movimiento`: monto nuevo si la persona pidio cambiarlo.
   * `0` o vacio significa "el mismo monto del original".
   */
  new_amount: number;
  confidence: number;
  ambiguities: string[];
};

/** Movimiento real del usuario, tal y como lo carga el turno. */
export type MovementActionContext = {
  id: string;
  type: string;
  amount: number;
  currency: "PEN" | "USD";
  description: string | null;
  merchant: string | null;
  occurred_at: string;
};

export type MovementActionCompilation = ActionRequestOutcome<MovementActionProposal>;

const MIN_MOVEMENT_ACTION_CONFIDENCE = 0.6;

export function compileMovementAction(input: {
  request: MovementActionRequest | null | undefined;
  userText: string;
  now: string;
  /** Movimientos activos recientes, para `duplicar_movimiento`. */
  movements: MovementActionContext[];
  /**
   * Movimientos eliminados recientes, solo para `restaurar_movimiento`. Se
   * carga condicionalmente fuera de esta funcion (mismo patron que
   * `closedDebts` en `debt-action-request.ts`): la mayoria de los turnos no
   * pide restaurar nada.
   */
  deletedMovements?: MovementActionContext[];
}): MovementActionCompilation {
  const request = input.request ?? null;
  if (!request || request.intent === "none") return NOT_REQUESTED;

  if (request.ambiguities.length > 0) {
    return { kind: "needs_clarification", question: request.ambiguities[0] };
  }

  if (request.confidence < MIN_MOVEMENT_ACTION_CONFIDENCE) {
    return {
      kind: "needs_clarification",
      question: preguntaPorFaltaDeDatos(request.intent),
    };
  }

  if (request.intent === "restaurar_movimiento") {
    return compileRestore(request, input);
  }
  return compileDuplicate(request, input);
}

function compileRestore(
  request: MovementActionRequest,
  input: {
    userText: string;
    now: string;
    deletedMovements?: MovementActionContext[];
  },
): MovementActionCompilation {
  const deleted = input.deletedMovements ?? [];
  const resolved = resolveMovement({
    movementId: request.movement_id,
    userText: input.userText,
    movements: deleted,
    emptyQuestion:
      "No veo ningún movimiento eliminado tuyo que pueda restaurar.",
  });
  if (resolved.kind !== "found") {
    return { kind: "needs_clarification", question: resolved.question };
  }
  const movement = resolved.movement;

  return draft({
    operation: "restore",
    catalogCommand: "restaurar_movimiento",
    payload: {
      movement_id: movement.id,
      reason: "Restaurado desde el asistente conversacional.",
    },
    summary: `${describeRestoreConsequence({
      description: movement.description,
      amount: movement.amount,
      currency: movement.currency,
    })} ¿Lo restauro?`,
    confirmLabel: "Sí, restáuralo",
    now: input.now,
  });
}

function compileDuplicate(
  request: MovementActionRequest,
  input: {
    userText: string;
    now: string;
    movements: MovementActionContext[];
  },
): MovementActionCompilation {
  const resolved = resolveMovement({
    movementId: request.movement_id,
    userText: input.userText,
    movements: input.movements,
    emptyQuestion: "No veo ningún movimiento reciente que pueda duplicar.",
  });
  if (resolved.kind !== "found") {
    return { kind: "needs_clarification", question: resolved.question };
  }
  const movement = resolved.movement;

  const newDate = request.new_occurred_at.trim();
  if (newDate && !esFechaIso(newDate)) {
    return {
      kind: "needs_clarification",
      question: "¿Para qué día quieres el duplicado? Usa una fecha como 2026-08-12.",
    };
  }

  const newAmount = redondear(request.new_amount);
  const amount =
    Number.isFinite(newAmount) && newAmount > 0 ? newAmount : movement.amount;

  return draft({
    operation: "duplicate",
    catalogCommand: "duplicar_movimiento",
    payload: {
      source_movement_id: movement.id,
      // `null` es "ahora", resuelto al confirmar por el ejecutor.
      occurred_at: newDate ? `${newDate}T00:00:00.000Z` : null,
      amount,
    },
    summary: `${describeDuplicateConsequence({
      description: movement.description,
      amount,
      currency: movement.currency,
      whenLabel: newDate ? newDate : "ahora",
    })} ¿Lo duplico?`,
    confirmLabel: "Sí, duplícalo",
    now: input.now,
  });
}

function draft(input: {
  operation: MovementActionProposal["operation"];
  catalogCommand: string;
  payload: Record<string, unknown>;
  summary: string;
  confirmLabel: string;
  now: string;
}): MovementActionCompilation {
  const parsed = MovementActionProposalSchema.safeParse({
    proposal_id: randomUUID(),
    operation: input.operation,
    catalog_command: input.catalogCommand,
    payload: input.payload,
    summary: input.summary,
    confirm_label: input.confirmLabel,
    proposed_at: input.now,
  });

  if (!parsed.success) {
    return {
      kind: "unavailable",
      reason: `movement_action_draft_invalid:${input.catalogCommand}`,
    };
  }
  return { kind: "ready", command: parsed.data };
}

type MovementResolution =
  | { kind: "found"; movement: MovementActionContext }
  | { kind: "unresolved"; question: string };

/**
 * Resuelve cual movimiento, en este orden: el id exacto que trae el turno
 * (solo si existe de verdad en la lista), "el ultimo" dicho con esas
 * palabras (la lista ya llega ordenada por recencia), o —si solo hay uno— ese
 * mismo. Cualquier otro caso pregunta: un identificador inventado no se usa
 * nunca para escribir.
 */
function resolveMovement(input: {
  movementId: string;
  userText: string;
  movements: MovementActionContext[];
  emptyQuestion: string;
}): MovementResolution {
  const { movements } = input;
  if (movements.length === 0) {
    return { kind: "unresolved", question: input.emptyQuestion };
  }

  const porId = movements.find((movement) => movement.id === input.movementId.trim());
  if (porId) return { kind: "found", movement: porId };

  const texto = normalizar(input.userText);
  if (/\b(ultimo|ultima|el de recien|recien)\b/.test(texto)) {
    return { kind: "found", movement: movements[0] };
  }

  if (movements.length === 1) return { kind: "found", movement: movements[0] };

  return {
    kind: "unresolved",
    question: `¿Cuál movimiento? Los más recientes son ${enumerar(
      movements
        .slice(0, 5)
        .map((movement) => describeMovementForQuestion(movement)),
    )}.`,
  };
}

function describeMovementForQuestion(movement: MovementActionContext): string {
  const cifra = formatMoney(movement.amount, movement.currency);
  const detalle = movement.description || movement.merchant || movement.type;
  return `${cifra} (${detalle})`;
}

function preguntaPorFaltaDeDatos(intent: MovementActionIntent): string {
  if (intent === "restaurar_movimiento") {
    return "¿Cuál movimiento eliminado quieres que restaure?";
  }
  return "¿Cuál movimiento quieres que duplique?";
}

function esFechaIso(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const instante = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(instante.getTime()) &&
    instante.toISOString().slice(0, 10) === value
  );
}

function enumerar(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

function normalizar(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function redondear(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatMoney(amount: number, currency: "PEN" | "USD"): string {
  const symbol = currency === "USD" ? "$" : "S/";
  return `${symbol}${amount.toFixed(2)}`;
}
