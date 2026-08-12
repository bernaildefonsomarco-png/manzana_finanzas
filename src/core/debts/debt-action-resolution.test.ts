import { describe, expect, it } from "vitest";
import type { ConversationWorkingSet } from "@/agents/conversation-agent/types";
import {
  buildDebtActionCommandFromProposal,
  buildDebtActionCommandText,
  DEBT_ACTION_CANCEL_COMMAND_ID,
  parseDebtActionCommandText,
  type DebtActionProposal,
} from "./debt-action-proposal";
import {
  isDebtActionConfirmationText,
  isDebtActionDiscardText,
  resolveAwaitingDebtAction,
} from "./debt-action-resolution";

const PROPOSAL_ID = "00000000-0000-4000-8000-0000000000c1";
const DEBT_ID = "00000000-0000-4000-8000-0000000000a1";
const NOW = "2026-08-12T10:00:00.000Z";
const DENTRO_DE_VIGENCIA = "2026-08-12T10:14:00.000Z";
const FUERA_DE_VIGENCIA = "2026-08-12T10:16:00.000Z";
const EXPIRA = "2026-08-12T10:15:00.000Z";

function proposal(
  overrides: Partial<DebtActionProposal> = {},
): DebtActionProposal {
  return {
    proposal_id: PROPOSAL_ID,
    operation: "close",
    catalog_command: "cerrar_deuda",
    payload: { debt_id: DEBT_ID, reason: "forgiven", balance_at_proposal: 600 },
    summary: "¿La cierro como condonada?",
    confirm_label: "Sí, dala por perdonada",
    proposed_at: NOW,
    ...overrides,
  };
}

function workingSet(
  overrides: Partial<ConversationWorkingSet> = {},
): ConversationWorkingSet {
  return {
    version: "v1",
    topic: "debt",
    goal: "confirm",
    last_user_message_summary: null,
    last_assistant_result_summary: null,
    last_action: {
      kind: "debt_action_proposed",
      status: "awaiting_confirmation",
      source_ref: null,
      movement_ids: [],
      pending_item_ids: [],
      command_ids: [buildDebtActionCommandText(PROPOSAL_ID)],
      thread_key: "hilo-1",
      confirmation_expires_at: EXPIRA,
    },
    unresolved_slots: [],
    movement_referents: [],
    entity_referents: [],
    active_read_operation: null,
    focus_set: null,
    debt_action_proposal: proposal() as unknown as Record<string, unknown>,
    conversation_style: null,
    updated_at: NOW,
    ...overrides,
  } as ConversationWorkingSet;
}

describe("el asa del boton y el borrador", () => {
  it("el `id` es un asa, no el payload: nada de la deuda viaja por el canal", () => {
    const texto = buildDebtActionCommandText(PROPOSAL_ID);
    expect(texto).toBe(`deuda:${PROPOSAL_ID}`);
    // Ni el id de la deuda, ni el motivo del cierre, ni la cifra. Si viajaran,
    // bastaria con retocar el `id` para convertir una condonacion en un pago.
    expect(texto).not.toContain(DEBT_ID);
    expect(texto).not.toContain("forgiven");
    expect(texto).not.toContain("600");
  });

  it("un asa mal formada no se acepta", () => {
    expect(parseDebtActionCommandText("deuda:no-es-uuid")).toBeNull();
    expect(parseDebtActionCommandText(`deuda:${PROPOSAL_ID}:extra`)).toBeNull();
    expect(parseDebtActionCommandText("estr:" + PROPOSAL_ID)).toBeNull();
    expect(parseDebtActionCommandText(DEBT_ACTION_CANCEL_COMMAND_ID)).toEqual({
      kind: "cancel",
      command_id: DEBT_ACTION_CANCEL_COMMAND_ID,
    });
  });

  it("la clave de idempotencia sale de la propuesta, no del turno", () => {
    // Pulsar el boton dos veces, o pulsarlo y ademas escribir "si", repite
    // exactamente la misma clave, y `commit_debt_operation` devuelve su recibo.
    const primera = buildDebtActionCommandFromProposal(proposal());
    const segunda = buildDebtActionCommandFromProposal(proposal());
    expect(primera?.idempotency_key).toBe(`debt_action:${PROPOSAL_ID}`);
    expect(segunda?.idempotency_key).toBe(primera?.idempotency_key);
  });

  it("dos propuestas distintas no comparten clave", () => {
    const otra = buildDebtActionCommandFromProposal(
      proposal({ proposal_id: "00000000-0000-4000-8000-0000000000c2" }),
    );
    expect(otra?.idempotency_key).not.toBe(`debt_action:${PROPOSAL_ID}`);
  });

  it("un borrador corrupto no se convierte en escritura", () => {
    expect(
      buildDebtActionCommandFromProposal(
        proposal({ payload: { debt_id: DEBT_ID, reason: "regalada" } }),
      ),
    ).toBeNull();
    // Un cierre sin motivo tampoco: `RUL-DEUDAS-13` no admite un cierre neutro.
    expect(
      buildDebtActionCommandFromProposal(
        proposal({ payload: { debt_id: DEBT_ID } }),
      ),
    ).toBeNull();
  });
});

describe("vocabulario propio de deudas, probado en las dos direcciones", () => {
  it.each([
    "sí",
    "si",
    "dale",
    "listo",
    "ya está",
    "correcto",
    "sí, ciérrala",
    "dale, hazlo",
    "ciérrala",
    "confirmo",
  ])("«%s» confirma", (texto) => {
    expect(isDebtActionConfirmationText(texto)).toBe(true);
    expect(isDebtActionDiscardText(texto)).toBe(false);
  });

  it.each([
    "no",
    "no la cierres",
    "mejor no",
    "cancela",
    "déjalo",
    "olvídalo",
    "todavía no",
    "espera",
  ])("«%s» descarta", (texto) => {
    expect(isDebtActionDiscardText(texto)).toBe(true);
    expect(isDebtActionConfirmationText(texto)).toBe(false);
  });

  it("nombrar la OTRA opcion no confirma la que esta sobre la mesa", () => {
    // El error caro de este dominio: "sí, pero como pagada" sobre una propuesta
    // de condonacion. Si esto confirmara, el historial diria que un dinero se
    // pagó cuando la persona acababa de decir lo contrario (`RUL-DEUDAS-13`).
    const condonar = proposal();
    expect(isDebtActionConfirmationText("sí, pero como pagada", condonar)).toBe(
      false,
    );
    expect(isDebtActionConfirmationText("sí, la pagué", condonar)).toBe(false);
    expect(isDebtActionConfirmationText("sí, dala por perdonada", condonar)).toBe(
      true,
    );

    const pagar = proposal({
      payload: { debt_id: DEBT_ID, reason: "paid", balance_at_proposal: 0 },
    });
    expect(isDebtActionConfirmationText("sí, me la perdonaron", pagar)).toBe(
      false,
    );
    expect(isDebtActionConfirmationText("sí, ciérrala", pagar)).toBe(true);
  });

  it("no hereda el vocabulario de otro dominio", () => {
    // El de estructura acepta "créala"; el de preferencias lee "no me avises"
    // como un si. Ninguno de los dos significa nada en un cierre de deuda, y
    // reutilizarlos es como se colaron tres bugs antes.
    expect(isDebtActionConfirmationText("créala")).toBe(false);
    expect(isDebtActionConfirmationText("no me avises")).toBe(false);
    expect(isDebtActionDiscardText("no me avises")).toBe(true);
  });

  it("un mensaje de otro tema no responde a la propuesta", () => {
    expect(isDebtActionConfirmationText("¿cuánto gasté este mes?")).toBe(false);
    expect(isDebtActionDiscardText("¿cuánto gasté este mes?")).toBe(false);
  });
});

describe("resolveAwaitingDebtAction: hilo, vigencia y cambio de tema", () => {
  it("un «si» del mismo hilo y dentro de la vigencia es ejecutable", () => {
    const resultado = resolveAwaitingDebtAction({
      text: "sí",
      workingSet: workingSet(),
      threadKey: "hilo-1",
      now: DENTRO_DE_VIGENCIA,
    });
    expect(resultado.kind).toBe("confirmable");
    if (resultado.kind !== "confirmable") return;
    expect(resultado.commandText).toBe(`deuda:${PROPOSAL_ID}`);
  });

  it("un «si» de OTRO hilo no la toca ni la caduca", () => {
    // Aislamiento conversacional: la propuesta es de un hilo concreto.
    const resultado = resolveAwaitingDebtAction({
      text: "sí",
      workingSet: workingSet(),
      threadKey: "hilo-2",
      now: DENTRO_DE_VIGENCIA,
    });
    expect(resultado.kind).toBe("other_thread");
  });

  it("un «si» tardio se responde, no se ejecuta (`AC-RT-13`)", () => {
    const resultado = resolveAwaitingDebtAction({
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
    const resultado = resolveAwaitingDebtAction({
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
    const resultado = resolveAwaitingDebtAction({
      text: "¿cuánto gasté en comida?",
      workingSet: workingSet(),
      threadKey: "hilo-1",
      now: DENTRO_DE_VIGENCIA,
    });
    expect(resultado.kind).toBe("lapsed_by_topic_change");
  });

  it("un «no» descarta por el asa de cancelacion", () => {
    const resultado = resolveAwaitingDebtAction({
      text: "no, mejor no",
      workingSet: workingSet(),
      threadKey: "hilo-1",
      now: DENTRO_DE_VIGENCIA,
    });
    expect(resultado.kind).toBe("confirmable");
    if (resultado.kind !== "confirmable") return;
    expect(resultado.commandText).toBe(DEBT_ACTION_CANCEL_COMMAND_ID);
  });

  it("sin borrador vivo no hay nada que confirmar", () => {
    expect(
      resolveAwaitingDebtAction({
        text: "sí",
        workingSet: workingSet({ debt_action_proposal: null }),
        threadKey: "hilo-1",
        now: DENTRO_DE_VIGENCIA,
      }).kind,
    ).toBe("none");

    // Y una propuesta de OTRO dominio tampoco la dispara: un "si" a una caja no
    // puede cerrar una deuda.
    const otroDominio = workingSet();
    expect(
      resolveAwaitingDebtAction({
        text: "sí",
        workingSet: {
          ...otroDominio,
          last_action: {
            ...otroDominio.last_action!,
            kind: "structure_proposed",
          },
        },
        threadKey: "hilo-1",
        now: DENTRO_DE_VIGENCIA,
      }).kind,
    ).toBe("none");
  });

  it("un borrador corrupto en el estado no arma una confirmacion", () => {
    expect(
      resolveAwaitingDebtAction({
        text: "sí",
        workingSet: workingSet({
          debt_action_proposal: { proposal_id: "roto" },
        }),
        threadKey: "hilo-1",
        now: DENTRO_DE_VIGENCIA,
      }).kind,
    ).toBe("none");
  });
});
