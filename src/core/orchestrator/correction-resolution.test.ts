import { describe, expect, it } from "vitest";
import type { ConversationWorkingSet } from "@/agents/conversation-agent/types";
import {
  CORRECTION_CANCEL_COMMAND_ID,
  parseCorrectionCommandText,
  resolveAwaitingCorrectionCommandText,
} from "./correction-resolution";

const MOVEMENT_ID = "00000000-0000-4000-8000-000000000010";
const ACCOUNT_ID = "00000000-0000-4000-8000-000000000021";
const OTHER_MOVEMENT_ID = "00000000-0000-4000-8000-000000000011";

function workingSet(
  lastAction: ConversationWorkingSet["last_action"],
): ConversationWorkingSet {
  return {
    version: "v1",
    topic: "movement",
    goal: "correct",
    last_user_message_summary: "elimine al gasto de pan porfa",
    last_assistant_result_summary:
      "Creo que te refieres a Pan S/5.00. ¿Lo elimino?",
    last_action: lastAction,
    unresolved_slots: [],
    movement_referents: [MOVEMENT_ID],
    entity_referents: [],
    active_read_operation: null,
    focus_set: null,
    conversation_style: null,
    updated_at: "2026-08-06T10:00:00.000-05:00",
  };
}

function proposedDeleteAction(
  overrides: Partial<NonNullable<ConversationWorkingSet["last_action"]>> = {},
): ConversationWorkingSet["last_action"] {
  return {
    kind: "correction_proposed",
    status: "awaiting_confirmation",
    source_ref: "event-1",
    movement_ids: [MOVEMENT_ID],
    pending_item_ids: [],
    command_ids: [`corr:delete:${MOVEMENT_ID}`],
    ...overrides,
  };
}

describe("correction command parser", () => {
  it("parsea correccion de monto", () => {
    expect(parseCorrectionCommandText(`corr:amount:${MOVEMENT_ID}:25_50`)).toEqual({
      kind: "amount",
      command_id: `corr:amount:${MOVEMENT_ID}:25_50`,
      movement_id: MOVEMENT_ID,
      amount: 25.5,
    });
  });

  it("parsea correccion de categoria canonica", () => {
    expect(
      parseCorrectionCommandText(`corr:category:${MOVEMENT_ID}:transporte`)
    ).toEqual({
      kind: "category",
      command_id: `corr:category:${MOVEMENT_ID}:transporte`,
      movement_id: MOVEMENT_ID,
      category_id: "transporte",
    });
  });

  it("parsea correccion de cuenta origen", () => {
    expect(
      parseCorrectionCommandText(`corr:acct_origin:${MOVEMENT_ID}:${ACCOUNT_ID}`)
    ).toEqual({
      kind: "account_origin",
      command_id: `corr:acct_origin:${MOVEMENT_ID}:${ACCOUNT_ID}`,
      movement_id: MOVEMENT_ID,
      account_id: ACCOUNT_ID,
      account_field: "account_origin_id",
    });
  });

  it("parsea eliminacion segura", () => {
    expect(parseCorrectionCommandText(`corr:delete:${MOVEMENT_ID}`)).toEqual({
      kind: "delete",
      command_id: `corr:delete:${MOVEMENT_ID}`,
      movement_id: MOVEMENT_ID,
      delete_mode: "soft_delete",
    });
  });

  it("rechaza categoria no canonica", () => {
    expect(parseCorrectionCommandText(`corr:category:${MOVEMENT_ID}:cafes`)).toBeNull();
  });
});

describe("confirmacion escrita de una correccion propuesta", () => {
  it("confirma con texto libre la eliminacion que quedo esperando", () => {
    expect(
      resolveAwaitingCorrectionCommandText({
        text: "si te confirmo eliminalo",
        workingSet: workingSet(proposedDeleteAction()),
      }),
    ).toBe(`corr:delete:${MOVEMENT_ID}`);
  });

  it("confirma con un si suelto", () => {
    expect(
      resolveAwaitingCorrectionCommandText({
        text: "si",
        workingSet: workingSet(proposedDeleteAction()),
      }),
    ).toBe(`corr:delete:${MOVEMENT_ID}`);
  });

  it("cancela la correccion propuesta cuando el usuario la descarta", () => {
    expect(
      resolveAwaitingCorrectionCommandText({
        text: "cancelar",
        workingSet: workingSet(proposedDeleteAction()),
      }),
    ).toBe(CORRECTION_CANCEL_COMMAND_ID);
  });

  it("no resuelve varios candidatos con un si ambiguo (`16` §10.3)", () => {
    expect(
      resolveAwaitingCorrectionCommandText({
        text: "si",
        workingSet: workingSet(
          proposedDeleteAction({
            command_ids: [
              `corr:delete:${MOVEMENT_ID}`,
              `corr:delete:${OTHER_MOVEMENT_ID}`,
            ],
          }),
        ),
      }),
    ).toBeNull();
  });

  it("no confirma una correccion ya resuelta", () => {
    expect(
      resolveAwaitingCorrectionCommandText({
        text: "si",
        workingSet: workingSet(
          proposedDeleteAction({
            kind: "correction_applied",
            status: "completed",
          }),
        ),
      }),
    ).toBeNull();
  });

  it("no confirma cuando la ultima accion no fue una correccion", () => {
    expect(
      resolveAwaitingCorrectionCommandText({
        text: "si",
        workingSet: workingSet(
          proposedDeleteAction({
            kind: "pending_created",
            command_ids: [],
          }),
        ),
      }),
    ).toBeNull();
  });

  it("no confirma un texto que no es confirmacion ni descarte", () => {
    expect(
      resolveAwaitingCorrectionCommandText({
        text: "cuanto gaste este mes",
        workingSet: workingSet(proposedDeleteAction()),
      }),
    ).toBeNull();
  });

  it("no confirma sin memoria conversacional activa", () => {
    expect(
      resolveAwaitingCorrectionCommandText({
        text: "si te confirmo eliminalo",
        workingSet: null,
      }),
    ).toBeNull();
  });
});
