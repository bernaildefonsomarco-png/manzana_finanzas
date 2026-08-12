import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TurnInput } from "@/core/channel/types";
import type { DebtActionProposal } from "@/core/debts/debt-action-proposal";
import type { DebtActionResolutionResult } from "@/core/debts/debt-action-resolution";
import { planTurnBlocks, type PlanTurnBlocksResult } from "./response-planner";

const USER_ID = "00000000-0000-4000-8000-000000000002";
const PROPOSAL_ID = "00000000-0000-4000-8000-0000000000c1";
const DEBT_ID = "00000000-0000-4000-8000-0000000000a1";
const originalAppUrl = process.env.MANZANA_APP_URL;

function turnInput(): TurnInput {
  return {
    actor: "user",
    text: "ya le pagué todo a Marco",
    choice: null,
    confirmation: null,
    attachments: [],
    context: { where: null, filters: null, selected: null, visible: [] },
    channel: "whatsapp",
  };
}

function proposal(
  overrides: Partial<DebtActionProposal> = {},
): DebtActionProposal {
  return {
    proposal_id: PROPOSAL_ID,
    operation: "close",
    catalog_command: "cerrar_deuda",
    payload: { debt_id: DEBT_ID, reason: "forgiven", balance_at_proposal: 600 },
    summary:
      "Ojo con esto: cerrar «Préstamo de Marco» como condonada dice que esos S/600.00 no se pagaron. ¿La cierro como condonada?",
    confirm_label: "Sí, dala por perdonada",
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

describe("RUL-DEUDAS-13: el turno de deudas nunca se queda mudo", () => {
  beforeEach(() => {
    process.env.MANZANA_APP_URL = "http://127.0.0.1:3100";
  });
  afterEach(() => {
    if (originalAppUrl) process.env.MANZANA_APP_URL = originalAppUrl;
    else delete process.env.MANZANA_APP_URL;
  });

  it("una propuesta sale como tarjeta con las dos salidas", () => {
    const result = plan({
      debtActionProposal: proposal(),
    });

    expect(result.reason).toBe("debt_action_needs_confirmation");
    expect(result.blocks).toHaveLength(1);
    const bloque = result.blocks[0];
    expect(bloque.kind).toBe("propuesta");
    if (bloque.kind !== "propuesta") return;
    expect(bloque.commandId).toBe(`deuda:${PROPOSAL_ID}`);
    // El boton nombra la accion: "Sí, hazlo" al lado de una condonacion no dice
    // que se esta dando un dinero por perdido.
    expect(bloque.options.map((opcion) => opcion.label)).toEqual([
      "Sí, dala por perdonada",
      "No, cancelar",
    ]);
    expect(bloque.text).toContain("S/600.00");
  });

  it("un comando diferido sale como limite con via manual, no en silencio", () => {
    // `WEB-D205`: la persona pidio sumar intereses. Si este turno callara, se
    // quedaria creyendo que su saldo cambio.
    const result = plan({
      debtActionUnavailableText:
        "No puedo sumar intereses ni mora al saldo de una deuda.",
    });

    expect(result.reason).toBe("debt_action_unavailable");
    expect(result.blocks.length).toBeGreaterThan(0);
    const bloque = result.blocks[0];
    expect(bloque.kind).toBe("limite");
    expect(textOf(result)).toContain("intereses");
  });

  it("una duda sale como pregunta", () => {
    const result = plan({
      debtActionQuestion: "¿Ya los pagaste o te la perdonaron?",
    });
    expect(result.reason).toBe("debt_action_needs_clarification");
    expect(result.blocks[0]?.kind).toBe("pregunta");
  });

  it.each([
    [
      "close",
      "cerrar_deuda",
      "«Préstamo de Marco», dada por perdonada con S/600.00 sin pagar",
      "perdonada",
    ],
    [
      "reopen",
      "reabrir_deuda",
      "«Préstamo de Marco», reabierta con S/600.00 de saldo",
      "deuda viva",
    ],
    [
      "skip_installment",
      "saltar_cuota",
      "la cuota 1 de «Préstamo de Marco», marcada como omitida",
      "no reduce lo que debes",
    ],
    [
      "reschedule_installment",
      "reprogramar_cuota",
      "la cuota 1 de «Préstamo de Marco», movida al 2026-09-15",
      "importe no cambió",
    ],
  ] as const)(
    "aplicar %s se confirma diciendo lo que pasó de verdad",
    (operation, catalogCommand, summary, esperado) => {
      const result = plan({
        debtActionResolution: {
          kind: "applied",
          reason: "debt_action_applied",
          operation,
          catalog_command: catalogCommand,
          entity_id: DEBT_ID,
          summary,
          idempotent: false,
        } satisfies DebtActionResolutionResult,
      });

      expect(result.reason).toBe("debt_action_applied");
      expect(textOf(result)).toContain(esperado);
    },
  );

  it("un doble envio se cuenta como ya hecho, no como una segunda escritura", () => {
    const result = plan({
      debtActionResolution: {
        kind: "applied",
        reason: "already_applied",
        operation: "close",
        catalog_command: "cerrar_deuda",
        entity_id: DEBT_ID,
        summary: "«Préstamo de Marco», dada por perdonada",
        idempotent: true,
      },
    });
    expect(textOf(result)).toContain("ya estaba hecho");
    expect(textOf(result)).toContain("No lo repetí");
  });

  it("un descarte NIEGA lo que se iba a hacer, no dice «no hice nada»", () => {
    // "No hice nada" tras proponer una condonacion deja a la persona sin saber
    // si su deuda sigue viva, que es justo el dato que le importa.
    const result = plan({
      debtActionResolution: {
        kind: "cancelled",
        reason: "user_cancelled_debt_action",
        operation: "close",
        catalog_command: "cerrar_deuda",
        summary: "eso",
      },
    });
    expect(result.reason).toBe("debt_action_cancelled");
    expect(textOf(result)).toContain("no la cerré");
    expect(textOf(result)).toContain("sigue igual");
  });

  it("una confirmacion vencida se responde y dice que la deuda sigue igual", () => {
    const result = plan({
      debtActionResolution: {
        kind: "failed",
        reason: "proposal_lapsed",
        operation: null,
        catalog_command: null,
        error_code: "DEBT_ACTION_PROPOSAL_EXPIRED",
        detail: null,
      },
    });
    expect(result.reason).toBe("debt_action_failed");
    expect(textOf(result)).toContain("venció");
    expect(textOf(result)).toContain("tu deuda sigue igual");
  });

  it("un fallo con detalle del nucleo dice el invariante concreto", () => {
    const result = plan({
      debtActionResolution: {
        kind: "failed",
        reason: "execution_failed",
        operation: "close",
        catalog_command: "cerrar_deuda",
        error_code: "DEBT_ACTION_BALANCE_CHANGED",
        detail: "El saldo de «Préstamo de Marco» cambió: ahora son S/100.00.",
      },
    });
    expect(textOf(result)).toContain("S/100.00");
  });

  it("un fallo sin detalle sigue diciendo que no cambió nada", () => {
    const result = plan({
      debtActionResolution: {
        kind: "failed",
        reason: "execution_failed",
        operation: "close",
        catalog_command: "cerrar_deuda",
        error_code: "DEBT_ACTION_CORE_ERROR",
        detail: null,
      },
    });
    expect(result.blocks.length).toBeGreaterThan(0);
    expect(textOf(result)).toContain("no cambié nada");
  });
});
