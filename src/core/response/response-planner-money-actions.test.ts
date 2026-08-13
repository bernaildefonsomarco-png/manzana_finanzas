import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TurnInput } from "@/core/channel/types";
import type { MoneyActionProposal } from "@/core/money-actions/money-action-proposal";
import type { MoneyActionResolutionResult } from "@/core/money-actions/money-action-resolution";
import { planTurnBlocks, type PlanTurnBlocksResult } from "./response-planner";

const USER_ID = "00000000-0000-4000-8000-000000000002";
const PROPOSAL_ID = "00000000-0000-4000-8000-0000000000c1";
const originalAppUrl = process.env.MANZANA_APP_URL;

function turnInput(): TurnInput {
  return {
    actor: "user",
    text: "pasa 100 de BCP a Yape",
    choice: null,
    confirmation: null,
    attachments: [],
    context: { where: null, filters: null, selected: null, visible: [] },
    channel: "whatsapp",
  };
}

function proposal(
  overrides: Partial<MoneyActionProposal> = {},
): MoneyActionProposal {
  return {
    proposal_id: PROPOSAL_ID,
    operation: "transfer",
    catalog_command: "transferir",
    payload: {
      from_account_id: "acc-1",
      to_account_id: "acc-2",
      amount: 100,
      description: null,
    },
    summary: "Vas a transferir S/100.00 de BCP a Yape. ¿La hago?",
    confirm_label: "Sí, transfiere",
    proposed_at: "2026-08-12T10:00:00.000Z",
    ...overrides,
  };
}

function plan(
  extra: Omit<Parameters<typeof planTurnBlocks>[0], "turnInput" | "userId">,
): PlanTurnBlocksResult {
  return planTurnBlocks({ turnInput: turnInput(), userId: USER_ID, ...extra });
}

function textOf(result: PlanTurnBlocksResult, index = 0): string {
  const block = result.blocks[index];
  if (!block) return "";
  return "text" in block ? block.text : "";
}

describe("24 S9: el turno de dinero nunca se queda mudo", () => {
  beforeEach(() => {
    process.env.MANZANA_APP_URL = "http://127.0.0.1:3100";
  });
  afterEach(() => {
    if (originalAppUrl) process.env.MANZANA_APP_URL = originalAppUrl;
    else delete process.env.MANZANA_APP_URL;
  });

  it("una propuesta sale como tarjeta con las dos salidas", () => {
    const result = plan({ moneyActionProposal: proposal() });

    expect(result.reason).toBe("money_action_needs_confirmation");
    expect(result.blocks).toHaveLength(1);
    const bloque = result.blocks[0];
    expect(bloque.kind).toBe("propuesta");
    if (bloque.kind !== "propuesta") return;
    expect(bloque.commandId).toBe(`dinero:${PROPOSAL_ID}`);
    expect(bloque.options.map((opcion) => opcion.label)).toEqual([
      "Sí, transfiere",
      "No, cancelar",
    ]);
    expect(bloque.text).toContain("S/100.00");
  });

  it("una duda sale como pregunta", () => {
    const result = plan({
      moneyActionQuestion: "¿Entre cuáles cuentas?",
    });
    expect(result.reason).toBe("money_action_needs_clarification");
    expect(result.blocks[0]?.kind).toBe("pregunta");
  });

  it("un borrador que no paso su propio esquema sale como limite, no en silencio", () => {
    const result = plan({
      moneyActionUnavailableText:
        "Entendí lo que pedías sobre tu dinero, pero no lo pude preparar ahora mismo. No cambié nada.",
    });
    expect(result.reason).toBe("money_action_unavailable");
    expect(result.blocks.length).toBeGreaterThan(0);
    expect(result.blocks[0]?.kind).toBe("limite");
    expect(textOf(result)).toContain("No cambié nada");
  });

  it.each([
    ["transfer", "S/100.00 de BCP a Yape", "Transferí"],
    ["separate_to_box", "S/200.00 separados en Viaje", "Separé"],
    ["release_from_box", "S/50.00 devueltos de Emergencia a libre", "Devolví"],
    ["box_to_box", "S/30.00 de Viaje a Emergencia", "Moví"],
  ] as const)(
    "aplicar %s se confirma diciendo lo que pasó de verdad",
    (operation, summary, esperado) => {
      const result = plan({
        moneyActionResolution: {
          kind: "applied",
          reason: "money_action_applied",
          operation,
          catalog_command: "transferir",
          entity_id: "mv-1",
          summary,
          idempotent: false,
        } satisfies MoneyActionResolutionResult,
      });

      expect(result.reason).toBe("money_action_applied");
      expect(textOf(result)).toContain(esperado);
      expect(textOf(result)).toContain(summary);
    },
  );

  it("un doble envio se cuenta como ya hecho, no como una segunda escritura", () => {
    const result = plan({
      moneyActionResolution: {
        kind: "applied",
        reason: "already_applied",
        operation: "transfer",
        catalog_command: "transferir",
        entity_id: "mv-1",
        summary: "S/100.00 de BCP a Yape",
        idempotent: true,
      },
    });
    expect(textOf(result)).toContain("ya estaba hecho");
    expect(textOf(result)).toContain("No lo repetí");
  });

  it("un descarte dice que los saldos siguen igual", () => {
    const result = plan({
      moneyActionResolution: {
        kind: "cancelled",
        reason: "user_cancelled_money_action",
        operation: "transfer",
        catalog_command: "transferir",
        summary: "eso",
      },
    });
    expect(result.reason).toBe("money_action_cancelled");
    expect(textOf(result)).toContain("no moví nada");
  });

  it("una confirmacion vencida se responde y dice que los saldos siguen igual", () => {
    const result = plan({
      moneyActionResolution: {
        kind: "failed",
        reason: "proposal_lapsed",
        operation: null,
        catalog_command: null,
        error_code: "MONEY_ACTION_PROPOSAL_EXPIRED",
        detail: null,
      },
    });
    expect(result.reason).toBe("money_action_failed");
    expect(textOf(result)).toContain("venció");
    expect(textOf(result)).toContain("saldos siguen igual");
  });

  it("un fallo con detalle del nucleo dice el invariante concreto", () => {
    const result = plan({
      moneyActionResolution: {
        kind: "failed",
        reason: "execution_failed",
        operation: "separate_to_box",
        catalog_command: "separar_en_caja",
        error_code: "INVALID_MOVEMENT_BOXES",
        detail: "Solo tienes S/20.00 libres en BCP.",
      },
    });
    expect(textOf(result)).toContain("S/20.00 libres");
  });

  it("un fallo sin detalle sigue diciendo que no cambió nada", () => {
    const result = plan({
      moneyActionResolution: {
        kind: "failed",
        reason: "execution_failed",
        operation: "transfer",
        catalog_command: "transferir",
        error_code: "MONEY_ACTION_CORE_ERROR",
        detail: null,
      },
    });
    expect(result.blocks.length).toBeGreaterThan(0);
    expect(textOf(result)).toContain("no cambié nada");
  });

  it("sin nada de dinero en el turno, la rama no dice nada", () => {
    const result = plan({});
    expect(result.reason).not.toMatch(/^money_action/);
  });
});
