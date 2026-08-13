import { randomUUID } from "node:crypto";
import type { ActionRequestOutcome } from "@/core/actions/action-request-outcome";
import { NOT_REQUESTED } from "@/core/actions/action-request-outcome";
import {
  describeMoveBoxToBoxConsequence,
  describeReleaseFromBoxConsequence,
  describeSeparateToBoxConsequence,
  describeTransferConsequence,
} from "./money-action-consequences";
import {
  MoneyActionProposalSchema,
  type MoneyActionProposal,
} from "./money-action-proposal";

/**
 * `24` §7.17 / `40` §7.1: los cuatro comandos que mueven dinero real entre
 * cuentas y cajas del propio usuario, sin crear ni destruir saldo.
 * `ajustar_saldo` queda fuera de esta tanda a proposito: no tiene camino
 * conversacional todavia.
 */
export const MONEY_ACTION_INTENTS = [
  "none",
  "transferir",
  "separar_en_caja",
  "devolver_a_libre",
  "mover_entre_cajas",
] as const;
export type MoneyActionIntent = (typeof MONEY_ACTION_INTENTS)[number];

/** Lo que el ejecutivo entendio del turno, plano y sin comandos. */
export type MoneyActionRequest = {
  intent: MoneyActionIntent;
  /** Solo `transferir`: cuenta origen exacta, leida de una consulta de este turno. */
  from_account_id: string;
  /** Solo `transferir`: cuenta destino exacta. */
  to_account_id: string;
  /** Solo `devolver_a_libre` y `mover_entre_cajas`: caja origen exacta. */
  box_origin_id: string;
  /** Solo `separar_en_caja` y `mover_entre_cajas`: caja destino exacta. */
  box_destination_id: string;
  amount: number;
  description: string;
  confidence: number;
  ambiguities: string[];
};

/** Cuenta real del usuario, tal y como la carga el turno (`DataContextPack.accounts`). */
export type MoneyActionAccountContext = {
  id: string;
  name: string;
  currency: "PEN" | "USD";
};

/** Caja real del usuario (`DataContextPack.boxes`). Trae su saldo: ya viene cargado. */
export type MoneyActionBoxContext = {
  id: string;
  account_id: string;
  name: string;
  current_balance: number;
};

export type MoneyActionCompilation = ActionRequestOutcome<MoneyActionProposal>;

const MIN_MONEY_ACTION_CONFIDENCE = 0.6;

export function compileMoneyAction(input: {
  request: MoneyActionRequest | null | undefined;
  userText: string;
  now: string;
  accounts: MoneyActionAccountContext[];
  boxes: MoneyActionBoxContext[];
  /**
   * Libre disponible de la(s) cuenta(s) que este comando necesite, cargado
   * solo cuando hace falta (`transferir` y `separar_en_caja`): mismo patron
   * que `closedDebts` en `debt-action-request.ts`, la lectura vive fuera de
   * esta funcion pura y aqui solo se consume.
   */
  freeBalanceByAccountId?: Record<string, number>;
}): MoneyActionCompilation {
  const request = input.request ?? null;
  if (!request || request.intent === "none") return NOT_REQUESTED;

  if (request.ambiguities.length > 0) {
    return { kind: "needs_clarification", question: request.ambiguities[0] };
  }

  if (request.confidence < MIN_MONEY_ACTION_CONFIDENCE) {
    return {
      kind: "needs_clarification",
      question: preguntaPorFaltaDeDatos(request.intent),
    };
  }

  const amount = redondear(request.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    // `ERR-CUENTAS-08`.
    return {
      kind: "needs_clarification",
      question: "¿Cuánto quieres mover? El monto tiene que ser mayor que cero.",
    };
  }

  if (request.intent === "transferir") {
    return compileTransfer(request, amount, input);
  }
  if (request.intent === "separar_en_caja") {
    return compileSeparateToBox(request, amount, input);
  }
  if (request.intent === "devolver_a_libre") {
    return compileReleaseFromBox(request, amount, input);
  }
  return compileMoveBetweenBoxes(request, amount, input);
}

function currencyOfAccount(
  accountId: string | undefined,
  accounts: MoneyActionAccountContext[],
): "PEN" | "USD" {
  return (
    accounts.find((account) => account.id === accountId)?.currency ?? "PEN"
  );
}

function compileTransfer(
  request: MoneyActionRequest,
  amount: number,
  input: {
    now: string;
    accounts: MoneyActionAccountContext[];
    freeBalanceByAccountId?: Record<string, number>;
  },
): MoneyActionCompilation {
  const fromAccount = resolveAccountById(
    request.from_account_id,
    input.accounts,
  );
  const toAccount = resolveAccountById(request.to_account_id, input.accounts);

  if (!fromAccount || !toAccount) {
    return {
      kind: "needs_clarification",
      question: cuentaPreguntaDeCual(input.accounts),
    };
  }

  // `ERR-CUENTAS-06`: el mismo id de origen y destino no es una transferencia.
  if (fromAccount.id === toAccount.id) {
    return {
      kind: "needs_clarification",
      question:
        "El origen y el destino son la misma cuenta. ¿A cuál otra cuenta la transfiero?",
    };
  }

  const freeBalance = input.freeBalanceByAccountId?.[fromAccount.id] ?? null;

  return draft({
    operation: "transfer",
    catalogCommand: "transferir",
    payload: {
      from_account_id: fromAccount.id,
      to_account_id: toAccount.id,
      amount,
      description: request.description.trim() || null,
    },
    summary: `${describeTransferConsequence({
      fromAccountName: fromAccount.name,
      toAccountName: toAccount.name,
      amount,
      currency: fromAccount.currency,
      freeBalanceAfter:
        freeBalance !== null ? redondear(freeBalance - amount) : null,
    })} ¿La hago?`,
    confirmLabel: "Sí, transfiere",
    now: input.now,
  });
}

function compileSeparateToBox(
  request: MoneyActionRequest,
  amount: number,
  input: {
    userText: string;
    now: string;
    accounts: MoneyActionAccountContext[];
    boxes: MoneyActionBoxContext[];
    freeBalanceByAccountId?: Record<string, number>;
  },
): MoneyActionCompilation {
  const box = resolveSingleBox({
    boxId: request.box_destination_id,
    userText: input.userText,
    boxes: input.boxes,
  });
  if (box.kind !== "found") {
    return { kind: "needs_clarification", question: box.question };
  }

  const account = input.accounts.find(
    (candidate) => candidate.id === box.box.account_id,
  );
  const freeBalance = input.freeBalanceByAccountId?.[box.box.account_id] ?? null;

  return draft({
    operation: "separate_to_box",
    catalogCommand: "separar_en_caja",
    payload: {
      box_destination_id: box.box.id,
      amount,
      description: request.description.trim() || null,
    },
    summary: `${describeSeparateToBoxConsequence({
      boxName: box.box.name,
      accountName: account?.name ?? "tu cuenta",
      amount,
      currency: account?.currency ?? "PEN",
      freeBalanceAfter:
        freeBalance !== null ? redondear(freeBalance - amount) : null,
    })} ¿Lo separo?`,
    confirmLabel: "Sí, sepáralo",
    now: input.now,
  });
}

function compileReleaseFromBox(
  request: MoneyActionRequest,
  amount: number,
  input: {
    userText: string;
    now: string;
    accounts: MoneyActionAccountContext[];
    boxes: MoneyActionBoxContext[];
  },
): MoneyActionCompilation {
  const box = resolveSingleBox({
    boxId: request.box_origin_id,
    userText: input.userText,
    boxes: input.boxes,
  });
  if (box.kind !== "found") {
    return { kind: "needs_clarification", question: box.question };
  }

  const account = input.accounts.find(
    (candidate) => candidate.id === box.box.account_id,
  );

  return draft({
    operation: "release_from_box",
    catalogCommand: "devolver_a_libre",
    payload: {
      box_origin_id: box.box.id,
      amount,
      description: request.description.trim() || null,
    },
    summary: `${describeReleaseFromBoxConsequence({
      boxName: box.box.name,
      accountName: account?.name ?? "tu cuenta",
      amount,
      currency: account?.currency ?? "PEN",
      boxBalanceAfter: redondear(box.box.current_balance - amount),
    })} ¿Lo devuelvo?`,
    confirmLabel: "Sí, devuélvelo",
    now: input.now,
  });
}

function compileMoveBetweenBoxes(
  request: MoneyActionRequest,
  amount: number,
  input: {
    now: string;
    accounts: MoneyActionAccountContext[];
    boxes: MoneyActionBoxContext[];
  },
): MoneyActionCompilation {
  // Dos cajas a la vez no se resuelven por texto: nombrar dos cajas en la
  // misma frase no dice cual es origen y cual destino, asi que aqui se exige
  // el id exacto que ya trae el contexto del turno (`DataContextPack.boxes`
  // siempre esta cargado, no hace falta ninguna tool).
  const originBox = input.boxes.find(
    (box) => box.id === request.box_origin_id.trim(),
  );
  const destinationBox = input.boxes.find(
    (box) => box.id === request.box_destination_id.trim(),
  );

  if (!originBox || !destinationBox) {
    return {
      kind: "needs_clarification",
      question: cajaPreguntaDeCual(input.boxes),
    };
  }

  if (originBox.id === destinationBox.id) {
    return {
      kind: "needs_clarification",
      question:
        "El origen y el destino son la misma caja. ¿A cuál otra caja la muevo?",
    };
  }

  return draft({
    operation: "box_to_box",
    catalogCommand: "mover_entre_cajas",
    payload: {
      box_origin_id: originBox.id,
      box_destination_id: destinationBox.id,
      amount,
      description: request.description.trim() || null,
    },
    summary: `${describeMoveBoxToBoxConsequence({
      originBoxName: originBox.name,
      destinationBoxName: destinationBox.name,
      amount,
      currency: currencyOfAccount(originBox.account_id, input.accounts),
      originBoxBalanceAfter: redondear(originBox.current_balance - amount),
    })} ¿La muevo?`,
    confirmLabel: "Sí, muévela",
    now: input.now,
  });
}

/**
 * Construye el borrador y lo valida con el mismo esquema con el que se va a
 * leer al confirmarlo. Si no valida aqui, el turno siguiente lo rechazaria
 * como propuesta desconocida sin explicar por que.
 */
function draft(input: {
  operation: MoneyActionProposal["operation"];
  catalogCommand: string;
  payload: Record<string, unknown>;
  summary: string;
  confirmLabel: string;
  now: string;
}): MoneyActionCompilation {
  const parsed = MoneyActionProposalSchema.safeParse({
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
      reason: `money_action_draft_invalid:${input.catalogCommand}`,
    };
  }
  return { kind: "ready", command: parsed.data };
}

function resolveAccountById(
  id: string,
  accounts: MoneyActionAccountContext[],
): MoneyActionAccountContext | null {
  const trimmed = id.trim();
  if (!trimmed) return null;
  return accounts.find((account) => account.id === trimmed) ?? null;
}

type BoxResolution =
  | { kind: "found"; box: MoneyActionBoxContext }
  | { kind: "unresolved"; question: string };

/**
 * Resuelve una sola caja, en este orden: el id exacto (si existe de verdad
 * entre las del usuario) y, si no, lo que el propio texto nombra. Una caja no
 * tiene ambiguedad de direccion como las dos cuentas de `transferir`, asi que
 * aqui si vale el mismo fallback de texto que usa `debt-action-request.ts`
 * para resolver una deuda.
 */
function resolveSingleBox(input: {
  boxId: string;
  userText: string;
  boxes: MoneyActionBoxContext[];
}): BoxResolution {
  const { boxes } = input;
  if (boxes.length === 0) {
    return {
      kind: "unresolved",
      question: "No veo ninguna caja tuya. ¿Quieres que te ayude a crear una?",
    };
  }

  const porId = boxes.find((box) => box.id === input.boxId.trim());
  if (porId) return { kind: "found", box: porId };

  const texto = normalizar(input.userText);
  const candidatos = boxes.filter((box) =>
    texto.includes(normalizar(box.name)),
  );

  if (candidatos.length === 1) return { kind: "found", box: candidatos[0] };
  if (candidatos.length === 0 && boxes.length === 1) {
    return { kind: "found", box: boxes[0] };
  }

  return { kind: "unresolved", question: cajaPreguntaDeCual(boxes) };
}

function cuentaPreguntaDeCual(accounts: MoneyActionAccountContext[]): string {
  if (accounts.length === 0) {
    return "No veo ninguna cuenta tuya. ¿Quieres que te ayude a crear una?";
  }
  return `¿Entre cuáles cuentas? Tienes ${enumerar(
    accounts.slice(0, 5).map((account) => `«${account.name}»`),
  )}.`;
}

function cajaPreguntaDeCual(boxes: MoneyActionBoxContext[]): string {
  if (boxes.length === 0) {
    return "No veo ninguna caja tuya. ¿Quieres que te ayude a crear una?";
  }
  return `¿Cuál caja? Tienes ${enumerar(
    boxes.slice(0, 5).map((box) => `«${box.name}»`),
  )}.`;
}

function preguntaPorFaltaDeDatos(intent: MoneyActionIntent): string {
  if (intent === "transferir") {
    return "¿De qué cuenta a qué cuenta transfiero, y cuánto?";
  }
  if (intent === "separar_en_caja") return "¿En qué caja separo, y cuánto?";
  if (intent === "devolver_a_libre") {
    return "¿De qué caja devuelvo a libre, y cuánto?";
  }
  return "¿De qué caja a qué caja muevo, y cuánto?";
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
