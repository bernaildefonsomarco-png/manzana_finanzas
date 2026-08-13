import { describe, expect, it } from "vitest";
import type { ConversationWorkingSet } from "@/agents/conversation-agent/types";
import {
  buildMovementActionCommandFromProposal,
  buildMovementActionCommandText,
  MOVEMENT_ACTION_CANCEL_COMMAND_ID,
  parseMovementActionCommandText,
  type MovementActionProposal,
} from "./movement-action-proposal";
import {
  isMovementActionConfirmationText,
  isMovementActionDiscardText,
  resolveAwaitingMovementAction,
} from "./movement-action-resolution";

const PROPOSAL_ID = "00000000-0000-4000-8000-0000000000c1";
const MOVEMENT_ID = "00000000-0000-4000-8000-000000000d01";
const NOW = "2026-08-12T10:00:00.000Z";
const DENTRO_DE_VIGENCIA = "2026-08-12T10:14:00.000Z";
const FUERA_DE_VIGENCIA = "2026-08-12T10:16:00.000Z";
const EXPIRA = "2026-08-12T10:15:00.000Z";

function proposal(
  overrides: Partial<MovementActionProposal> = {},
): MovementActionProposal {
  return {
    proposal_id: PROPOSAL_ID,
    operation: "duplicate",
    catalog_command: "duplicar_movimiento",
    payload: {
      source_movement_id: MOVEMENT_ID,
      occurred_at: null,
      amount: 40,
    },
    summary: "Vas a duplicar el movimiento como uno nuevo. ¿Lo duplico?",
    confirm_label: "Sí, duplícalo",
    proposed_at: NOW,
    ...overrides,
  };
}

function workingSet(
  overrides: Partial<ConversationWorkingSet> = {},
): ConversationWorkingSet {
  return {
    version: "v1",
    topic: "movement",
    goal: "confirm",
    last_user_message_summary: null,
    last_assistant_result_summary: null,
    last_action: {
      kind: "movement_action_proposed",
      status: "awaiting_confirmation",
      source_ref: null,
      movement_ids: [],
      pending_item_ids: [],
      command_ids: [buildMovementActionCommandText(PROPOSAL_ID)],
      thread_key: "hilo-1",
      confirmation_expires_at: EXPIRA,
    },
    unresolved_slots: [],
    movement_referents: [],
    entity_referents: [],
    active_read_operation: null,
    focus_set: null,
    movement_action_proposal: proposal() as unknown as Record<string, unknown>,
    conversation_style: null,
    updated_at: NOW,
    ...overrides,
  } as ConversationWorkingSet;
}

describe("el asa del boton y el borrador", () => {
  it("el `id` es un asa, no el payload", () => {
    const texto = buildMovementActionCommandText(PROPOSAL_ID);
    expect(texto).toBe(`mov:${PROPOSAL_ID}`);
    expect(texto).not.toContain(MOVEMENT_ID);
  });

  it("un asa mal formada no se acepta", () => {
    expect(parseMovementActionCommandText("mov:no-es-uuid")).toBeNull();
    expect(
      parseMovementActionCommandText(`mov:${PROPOSAL_ID}:extra`),
    ).toBeNull();
    expect(parseMovementActionCommandText("dinero:" + PROPOSAL_ID)).toBeNull();
    expect(
      parseMovementActionCommandText(MOVEMENT_ACTION_CANCEL_COMMAND_ID),
    ).toEqual({
      kind: "cancel",
      command_id: MOVEMENT_ACTION_CANCEL_COMMAND_ID,
    });
  });

  it("la clave de idempotencia sale de la propuesta, no del turno", () => {
    const primera = buildMovementActionCommandFromProposal(proposal());
    const segunda = buildMovementActionCommandFromProposal(proposal());
    expect(primera?.idempotency_key).toBe(`movement_action:${PROPOSAL_ID}`);
    expect(segunda?.idempotency_key).toBe(primera?.idempotency_key);
  });

  it("un borrador corrupto no se convierte en escritura", () => {
    expect(
      buildMovementActionCommandFromProposal(
        proposal({ payload: { source_movement_id: MOVEMENT_ID } }),
      ),
    ).toBeNull();
    expect(
      buildMovementActionCommandFromProposal(
        proposal({
          operation: "restore",
          payload: { movement_id: MOVEMENT_ID },
        }),
      ),
    ).toBeNull();
  });
});

describe("vocabulario propio de movimientos", () => {
  it.each([
    "sí",
    "si",
    "dale",
    "listo",
    "correcto",
    "sí, duplicalo",
    "duplicalo",
    "restauralo",
    "confirmo",
  ])("«%s» confirma", (texto) => {
    expect(isMovementActionConfirmationText(texto)).toBe(true);
    expect(isMovementActionDiscardText(texto)).toBe(false);
  });

  it.each(["no", "mejor no", "cancela", "déjalo", "olvídalo", "espera"])(
    "«%s» descarta",
    (texto) => {
      expect(isMovementActionDiscardText(texto)).toBe(true);
      expect(isMovementActionConfirmationText(texto)).toBe(false);
    },
  );

  it("un mensaje de otro tema no responde a la propuesta", () => {
    expect(isMovementActionConfirmationText("¿cuánto gasté este mes?")).toBe(
      false,
    );
  });
});

describe("resolveAwaitingMovementAction: hilo, vigencia y cambio de tema", () => {
  it("un «si» del mismo hilo y dentro de la vigencia es ejecutable", () => {
    const resultado = resolveAwaitingMovementAction({
      text: "sí",
      workingSet: workingSet(),
      threadKey: "hilo-1",
      now: DENTRO_DE_VIGENCIA,
    });
    expect(resultado.kind).toBe("confirmable");
    if (resultado.kind !== "confirmable") return;
    expect(resultado.commandText).toBe(`mov:${PROPOSAL_ID}`);
  });

  it("un «si» de OTRO hilo no la toca ni la caduca", () => {
    const resultado = resolveAwaitingMovementAction({
      text: "sí",
      workingSet: workingSet(),
      threadKey: "hilo-2",
      now: DENTRO_DE_VIGENCIA,
    });
    expect(resultado.kind).toBe("other_thread");
  });

  it("un «si» tardio se responde, no se ejecuta", () => {
    const resultado = resolveAwaitingMovementAction({
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

  it("un cambio de tema caduca la propuesta en vez de dejarla armada", () => {
    const resultado = resolveAwaitingMovementAction({
      text: "¿cuánto gasté en comida?",
      workingSet: workingSet(),
      threadKey: "hilo-1",
      now: DENTRO_DE_VIGENCIA,
    });
    expect(resultado.kind).toBe("lapsed_by_topic_change");
  });

  it("un «no» descarta por el asa de cancelacion", () => {
    const resultado = resolveAwaitingMovementAction({
      text: "no",
      workingSet: workingSet(),
      threadKey: "hilo-1",
      now: DENTRO_DE_VIGENCIA,
    });
    expect(resultado.kind).toBe("confirmable");
    if (resultado.kind !== "confirmable") return;
    expect(resultado.commandText).toBe(MOVEMENT_ACTION_CANCEL_COMMAND_ID);
  });

  it("sin borrador vivo no hay nada que confirmar", () => {
    expect(
      resolveAwaitingMovementAction({
        text: "sí",
        workingSet: workingSet({ movement_action_proposal: null }),
        threadKey: "hilo-1",
        now: DENTRO_DE_VIGENCIA,
      }).kind,
    ).toBe("none");

    const otroDominio = workingSet();
    expect(
      resolveAwaitingMovementAction({
        text: "sí",
        workingSet: {
          ...otroDominio,
          last_action: {
            ...otroDominio.last_action!,
            kind: "money_action_proposed",
          },
        },
        threadKey: "hilo-1",
        now: DENTRO_DE_VIGENCIA,
      }).kind,
    ).toBe("none");
  });

  it("un borrador corrupto en el estado no arma una confirmacion", () => {
    expect(
      resolveAwaitingMovementAction({
        text: "sí",
        workingSet: workingSet({
          movement_action_proposal: { proposal_id: "roto" },
        }),
        threadKey: "hilo-1",
        now: DENTRO_DE_VIGENCIA,
      }).kind,
    ).toBe("none");
  });
});
