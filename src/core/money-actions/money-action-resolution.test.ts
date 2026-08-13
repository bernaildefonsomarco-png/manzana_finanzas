import { describe, expect, it } from "vitest";
import type { ConversationWorkingSet } from "@/agents/conversation-agent/types";
import {
  buildMoneyActionCommandFromProposal,
  buildMoneyActionCommandText,
  MONEY_ACTION_CANCEL_COMMAND_ID,
  parseMoneyActionCommandText,
  type MoneyActionProposal,
} from "./money-action-proposal";
import {
  isMoneyActionConfirmationText,
  isMoneyActionDiscardText,
  resolveAwaitingMoneyAction,
} from "./money-action-resolution";

const PROPOSAL_ID = "00000000-0000-4000-8000-0000000000c1";
const BCP_ID = "00000000-0000-4000-8000-000000000a01";
const YAPE_ID = "00000000-0000-4000-8000-000000000a02";
const NOW = "2026-08-12T10:00:00.000Z";
const DENTRO_DE_VIGENCIA = "2026-08-12T10:14:00.000Z";
const FUERA_DE_VIGENCIA = "2026-08-12T10:16:00.000Z";
const EXPIRA = "2026-08-12T10:15:00.000Z";

function proposal(
  overrides: Partial<MoneyActionProposal> = {},
): MoneyActionProposal {
  return {
    proposal_id: PROPOSAL_ID,
    operation: "transfer",
    catalog_command: "transferir",
    payload: {
      from_account_id: BCP_ID,
      to_account_id: YAPE_ID,
      amount: 100,
      description: null,
    },
    summary: "Vas a transferir S/100.00 de BCP a Yape. ¿La hago?",
    confirm_label: "Sí, transfiere",
    proposed_at: NOW,
    ...overrides,
  };
}

function workingSet(
  overrides: Partial<ConversationWorkingSet> = {},
): ConversationWorkingSet {
  return {
    version: "v1",
    topic: "balance",
    goal: "confirm",
    last_user_message_summary: null,
    last_assistant_result_summary: null,
    last_action: {
      kind: "money_action_proposed",
      status: "awaiting_confirmation",
      source_ref: null,
      movement_ids: [],
      pending_item_ids: [],
      command_ids: [buildMoneyActionCommandText(PROPOSAL_ID)],
      thread_key: "hilo-1",
      confirmation_expires_at: EXPIRA,
    },
    unresolved_slots: [],
    movement_referents: [],
    entity_referents: [],
    active_read_operation: null,
    focus_set: null,
    money_action_proposal: proposal() as unknown as Record<string, unknown>,
    conversation_style: null,
    updated_at: NOW,
    ...overrides,
  } as ConversationWorkingSet;
}

describe("el asa del boton y el borrador", () => {
  it("el `id` es un asa, no el payload: nada del movimiento viaja por el canal", () => {
    const texto = buildMoneyActionCommandText(PROPOSAL_ID);
    expect(texto).toBe(`dinero:${PROPOSAL_ID}`);
    expect(texto).not.toContain(BCP_ID);
    expect(texto).not.toContain("100");
  });

  it("un asa mal formada no se acepta", () => {
    expect(parseMoneyActionCommandText("dinero:no-es-uuid")).toBeNull();
    expect(
      parseMoneyActionCommandText(`dinero:${PROPOSAL_ID}:extra`),
    ).toBeNull();
    expect(parseMoneyActionCommandText("deuda:" + PROPOSAL_ID)).toBeNull();
    expect(parseMoneyActionCommandText(MONEY_ACTION_CANCEL_COMMAND_ID)).toEqual(
      {
        kind: "cancel",
        command_id: MONEY_ACTION_CANCEL_COMMAND_ID,
      },
    );
  });

  it("la clave de idempotencia sale de la propuesta, no del turno", () => {
    const primera = buildMoneyActionCommandFromProposal(proposal());
    const segunda = buildMoneyActionCommandFromProposal(proposal());
    expect(primera?.idempotency_key).toBe(`money_action:${PROPOSAL_ID}`);
    expect(segunda?.idempotency_key).toBe(primera?.idempotency_key);
  });

  it("dos propuestas distintas no comparten clave", () => {
    const otra = buildMoneyActionCommandFromProposal(
      proposal({ proposal_id: "00000000-0000-4000-8000-0000000000c2" }),
    );
    expect(otra?.idempotency_key).not.toBe(`money_action:${PROPOSAL_ID}`);
  });

  it("un borrador corrupto no se convierte en escritura", () => {
    expect(
      buildMoneyActionCommandFromProposal(
        proposal({ payload: { from_account_id: BCP_ID } }),
      ),
    ).toBeNull();
    expect(
      buildMoneyActionCommandFromProposal(
        proposal({ payload: { amount: -5 } }),
      ),
    ).toBeNull();
  });
});

describe("vocabulario propio de dinero", () => {
  it.each([
    "sí",
    "si",
    "dale",
    "listo",
    "correcto",
    "sí, transfierelo",
    "dale, hazlo",
    "transfierelo",
    "confirmo",
  ])("«%s» confirma", (texto) => {
    expect(isMoneyActionConfirmationText(texto)).toBe(true);
    expect(isMoneyActionDiscardText(texto)).toBe(false);
  });

  it.each([
    "no",
    "mejor no",
    "cancela",
    "déjalo",
    "olvídalo",
    "todavía no",
    "espera",
  ])("«%s» descarta", (texto) => {
    expect(isMoneyActionDiscardText(texto)).toBe(true);
    expect(isMoneyActionConfirmationText(texto)).toBe(false);
  });

  it("no hereda el vocabulario de otro dominio", () => {
    expect(isMoneyActionConfirmationText("créala")).toBe(false);
    expect(isMoneyActionConfirmationText("ciérrala")).toBe(false);
  });

  it("un mensaje de otro tema no responde a la propuesta", () => {
    expect(isMoneyActionConfirmationText("¿cuánto gasté este mes?")).toBe(
      false,
    );
    expect(isMoneyActionDiscardText("¿cuánto gasté este mes?")).toBe(false);
  });
});

describe("resolveAwaitingMoneyAction: hilo, vigencia y cambio de tema", () => {
  it("un «si» del mismo hilo y dentro de la vigencia es ejecutable", () => {
    const resultado = resolveAwaitingMoneyAction({
      text: "sí",
      workingSet: workingSet(),
      threadKey: "hilo-1",
      now: DENTRO_DE_VIGENCIA,
    });
    expect(resultado.kind).toBe("confirmable");
    if (resultado.kind !== "confirmable") return;
    expect(resultado.commandText).toBe(`dinero:${PROPOSAL_ID}`);
  });

  it("un «si» de OTRO hilo no la toca ni la caduca", () => {
    const resultado = resolveAwaitingMoneyAction({
      text: "sí",
      workingSet: workingSet(),
      threadKey: "hilo-2",
      now: DENTRO_DE_VIGENCIA,
    });
    expect(resultado.kind).toBe("other_thread");
  });

  it("un «si» tardio se responde, no se ejecuta", () => {
    const resultado = resolveAwaitingMoneyAction({
      text: "sí",
      workingSet: workingSet(),
      threadKey: "hilo-1",
      now: FUERA_DE_VIGENCIA,
    });
    expect(resultado).toEqual({
      kind: "lapsed_confirmation",
      reason: "confirmation_window_expired",
    });
  });

  it("sin sello de hilo se considera vencida: el lado seguro", () => {
    const sinSello = workingSet();
    const resultado = resolveAwaitingMoneyAction({
      text: "sí",
      workingSet: {
        ...sinSello,
        last_action: { ...sinSello.last_action!, thread_key: null },
      },
      threadKey: "hilo-1",
      now: DENTRO_DE_VIGENCIA,
    });
    expect(resultado).toEqual({
      kind: "lapsed_confirmation",
      reason: "thread_unknown",
    });
  });

  it("un cambio de tema caduca la propuesta en vez de dejarla armada", () => {
    const resultado = resolveAwaitingMoneyAction({
      text: "¿cuánto gasté en comida?",
      workingSet: workingSet(),
      threadKey: "hilo-1",
      now: DENTRO_DE_VIGENCIA,
    });
    expect(resultado.kind).toBe("lapsed_by_topic_change");
  });

  it("un «no» descarta por el asa de cancelacion", () => {
    const resultado = resolveAwaitingMoneyAction({
      text: "no, mejor no",
      workingSet: workingSet(),
      threadKey: "hilo-1",
      now: DENTRO_DE_VIGENCIA,
    });
    expect(resultado.kind).toBe("confirmable");
    if (resultado.kind !== "confirmable") return;
    expect(resultado.commandText).toBe(MONEY_ACTION_CANCEL_COMMAND_ID);
  });

  it("sin borrador vivo no hay nada que confirmar", () => {
    expect(
      resolveAwaitingMoneyAction({
        text: "sí",
        workingSet: workingSet({ money_action_proposal: null }),
        threadKey: "hilo-1",
        now: DENTRO_DE_VIGENCIA,
      }).kind,
    ).toBe("none");

    const otroDominio = workingSet();
    expect(
      resolveAwaitingMoneyAction({
        text: "sí",
        workingSet: {
          ...otroDominio,
          last_action: {
            ...otroDominio.last_action!,
            kind: "debt_action_proposed",
          },
        },
        threadKey: "hilo-1",
        now: DENTRO_DE_VIGENCIA,
      }).kind,
    ).toBe("none");
  });

  it("un borrador corrupto en el estado no arma una confirmacion", () => {
    expect(
      resolveAwaitingMoneyAction({
        text: "sí",
        workingSet: workingSet({
          money_action_proposal: { proposal_id: "roto" },
        }),
        threadKey: "hilo-1",
        now: DENTRO_DE_VIGENCIA,
      }).kind,
    ).toBe("none");
  });
});
