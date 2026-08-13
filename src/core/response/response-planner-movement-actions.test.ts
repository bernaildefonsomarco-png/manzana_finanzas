import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TurnInput } from "@/core/channel/types";
import type { MovementActionProposal } from "@/core/movement-actions/movement-action-proposal";
import type { MovementActionResolutionResult } from "@/core/movement-actions/movement-action-resolution";
import { planTurnBlocks, type PlanTurnBlocksResult } from "./response-planner";

const USER_ID = "00000000-0000-4000-8000-000000000002";
const PROPOSAL_ID = "00000000-0000-4000-8000-0000000000c1";
const originalAppUrl = process.env.MANZANA_APP_URL;

function turnInput(): TurnInput {
  return {
    actor: "user",
    text: "duplica ese gasto",
    choice: null,
    confirmation: null,
    attachments: [],
    context: { where: null, filters: null, selected: null, visible: [] },
    channel: "whatsapp",
  };
}

function proposal(
  overrides: Partial<MovementActionProposal> = {},
): MovementActionProposal {
  return {
    proposal_id: PROPOSAL_ID,
    operation: "duplicate",
    catalog_command: "duplicar_movimiento",
    payload: {
      source_movement_id: "mv-1",
      occurred_at: null,
      amount: 40,
    },
    summary:
      "Vas a duplicar el movimiento (Súper) como uno nuevo de S/40.00, fechado ahora. El original no cambia. ¿Lo duplico?",
    confirm_label: "Sí, duplícalo",
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

describe("26 S14.2: el turno de movimientos nunca se queda mudo", () => {
  beforeEach(() => {
    process.env.MANZANA_APP_URL = "http://127.0.0.1:3100";
  });
  afterEach(() => {
    if (originalAppUrl) process.env.MANZANA_APP_URL = originalAppUrl;
    else delete process.env.MANZANA_APP_URL;
  });

  it("una propuesta de duplicar sale como tarjeta con las dos salidas", () => {
    const result = plan({ movementActionProposal: proposal() });

    expect(result.reason).toBe("movement_action_needs_confirmation");
    expect(result.blocks).toHaveLength(1);
    const bloque = result.blocks[0];
    expect(bloque.kind).toBe("propuesta");
    if (bloque.kind !== "propuesta") return;
    expect(bloque.commandId).toBe(`mov:${PROPOSAL_ID}`);
    expect(bloque.options.map((opcion) => opcion.label)).toEqual([
      "Sí, duplícalo",
      "No, cancelar",
    ]);
    expect(bloque.text).toContain("S/40.00");
  });

  it("una propuesta de restaurar tambien sale como tarjeta", () => {
    const result = plan({
      movementActionProposal: proposal({
        operation: "restore",
        catalog_command: "restaurar_movimiento",
        payload: { movement_id: "mv-1", reason: "Restaurado desde el asistente." },
        summary: "Vas a restaurar el movimiento de S/40.00 (Súper). ¿Lo restauro?",
        confirm_label: "Sí, restáuralo",
      }),
    });
    expect(result.reason).toBe("movement_action_needs_confirmation");
    const bloque = result.blocks[0];
    expect(bloque.kind).toBe("propuesta");
    if (bloque.kind !== "propuesta") return;
    expect(bloque.options.map((opcion) => opcion.label)).toEqual([
      "Sí, restáuralo",
      "No, cancelar",
    ]);
  });

  it("una duda sale como pregunta", () => {
    const result = plan({
      movementActionQuestion: "¿Cuál movimiento?",
    });
    expect(result.reason).toBe("movement_action_needs_clarification");
    expect(result.blocks[0]?.kind).toBe("pregunta");
  });

  it("un borrador que no paso su propio esquema sale como limite, no en silencio", () => {
    const result = plan({
      movementActionUnavailableText:
        "Entendí lo que pedías sobre ese movimiento, pero no lo pude preparar ahora mismo. No cambié nada.",
    });
    expect(result.reason).toBe("movement_action_unavailable");
    expect(result.blocks.length).toBeGreaterThan(0);
    expect(result.blocks[0]?.kind).toBe("limite");
    expect(textOf(result)).toContain("No cambié nada");
  });

  it.each([
    ["restore", "el movimiento de S/40.00 (Súper)", "Restauré"],
    ["duplicate", "S/40.00 (Súper)", "Duplicué"],
  ] as const)(
    "aplicar %s se confirma diciendo lo que pasó de verdad",
    (operation, summary, esperado) => {
      const result = plan({
        movementActionResolution: {
          kind: "applied",
          reason: "movement_action_applied",
          operation,
          catalog_command:
            operation === "restore" ? "restaurar_movimiento" : "duplicar_movimiento",
          entity_id: "mv-1",
          summary,
          idempotent: false,
        } satisfies MovementActionResolutionResult,
      });

      expect(result.reason).toBe("movement_action_applied");
      expect(textOf(result)).toContain(esperado);
      expect(textOf(result)).toContain(summary);
    },
  );

  it("un doble envio se cuenta como ya hecho, no como una segunda escritura", () => {
    const result = plan({
      movementActionResolution: {
        kind: "applied",
        reason: "already_applied",
        operation: "duplicate",
        catalog_command: "duplicar_movimiento",
        entity_id: "mv-1",
        summary: "S/40.00 (Súper)",
        idempotent: true,
      },
    });
    expect(textOf(result)).toContain("ya estaba hecho");
    expect(textOf(result)).toContain("No lo repetí");
  });

  it("un descarte de restaurar dice que sigue eliminado", () => {
    const result = plan({
      movementActionResolution: {
        kind: "cancelled",
        reason: "user_cancelled_movement_action",
        operation: "restore",
        catalog_command: "restaurar_movimiento",
        summary: "eso",
      },
    });
    expect(result.reason).toBe("movement_action_cancelled");
    expect(textOf(result)).toContain("Sigue eliminado");
  });

  it("un descarte de duplicar dice que no dupliqué nada", () => {
    const result = plan({
      movementActionResolution: {
        kind: "cancelled",
        reason: "user_cancelled_movement_action",
        operation: "duplicate",
        catalog_command: "duplicar_movimiento",
        summary: "eso",
      },
    });
    expect(textOf(result)).toContain("no lo dupliqué");
  });

  it("una confirmacion vencida se responde en vez de ejecutarse", () => {
    const result = plan({
      movementActionResolution: {
        kind: "failed",
        reason: "proposal_lapsed",
        operation: null,
        catalog_command: null,
        error_code: "MOVEMENT_ACTION_PROPOSAL_EXPIRED",
        detail: null,
      },
    });
    expect(result.reason).toBe("movement_action_failed");
    expect(textOf(result)).toContain("venció");
  });

  it("un fallo con detalle del nucleo dice el invariante concreto", () => {
    const result = plan({
      movementActionResolution: {
        kind: "failed",
        reason: "execution_failed",
        operation: "restore",
        catalog_command: "restaurar_movimiento",
        error_code: "MOVEMENT_REVERSED_NOT_RESTORABLE",
        detail:
          "Un movimiento revertido no puede restaurarse como si nunca hubiera ocurrido.",
      },
    });
    expect(textOf(result)).toContain("no puede restaurarse");
  });

  it("un fallo sin detalle sigue diciendo que no cambió nada", () => {
    const result = plan({
      movementActionResolution: {
        kind: "failed",
        reason: "execution_failed",
        operation: "duplicate",
        catalog_command: "duplicar_movimiento",
        error_code: "MOVEMENT_ACTION_CORE_ERROR",
        detail: null,
      },
    });
    expect(result.blocks.length).toBeGreaterThan(0);
    expect(textOf(result)).toContain("no cambié nada");
  });

  it("sin nada de movimientos en el turno, la rama no dice nada", () => {
    const result = plan({});
    expect(result.reason).not.toMatch(/^movement_action/);
  });
});
