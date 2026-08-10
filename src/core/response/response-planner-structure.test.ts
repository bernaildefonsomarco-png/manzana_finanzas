import { describe, expect, it } from "vitest";
import type { TurnInput } from "@/core/channel/types";
import type { StructureProposal } from "@/core/structure/structure-proposal";
import type { StructureResolutionResult } from "@/core/structure/structure-resolution";
import { planTurnBlocks } from "./response-planner";

const USER_ID = "00000000-0000-4000-8000-0000000000f1";
const PROPOSAL_ID = "00000000-0000-4000-8000-0000000000c1";

const turnInput: TurnInput = {
  actor: "user",
  text: "apartame 500 para el viaje",
  choice: null,
  confirmation: null,
  attachments: [],
  context: { where: null, filters: null, selected: null, visible: [] },
  channel: "dashboard",
};

function proposal(): StructureProposal {
  return {
    proposal_id: PROPOSAL_ID,
    entity: "caja",
    operation: "create",
    command_type: "CreateBoxCommand",
    payload: {},
    summary: "¿Creo la caja Viaje en BCP y aparto S/500 de tu saldo libre?",
    confirm_label: "Sí, crear la caja",
    proposed_at: "2026-08-09T10:00:00.000-05:00",
  };
}

function plan(
  extra: Parameters<typeof planTurnBlocks>[0] extends infer T
    ? Partial<T>
    : never,
) {
  return planTurnBlocks({
    turnInput,
    userId: USER_ID,
    ...extra,
  } as Parameters<typeof planTurnBlocks>[0]);
}

describe("RUL-ESTR-03: la propuesta sale como bloque confirmable en los dos canales", () => {
  it("dibuja una propuesta con el comando como id de opción", () => {
    const result = plan({ structureProposal: proposal() });

    expect(result.reason).toBe("structure_needs_confirmation");
    expect(result.blocks).toEqual([
      {
        kind: "propuesta",
        text: "¿Creo la caja Viaje en BCP y aparto S/500 de tu saldo libre?",
        commandId: `estr:${PROPOSAL_ID}`,
        options: [
          { id: `estr:${PROPOSAL_ID}`, label: "Sí, crear la caja" },
          { id: "estr:cancel", label: "No, cancelar" },
        ],
      },
    ]);
  });

  it("la propuesta nunca afirma que algo quedó creado", () => {
    const [block] = plan({ structureProposal: proposal() }).blocks;
    if (!("text" in block)) throw new Error("se esperaba un bloque con texto");
    expect(block.text).not.toMatch(/list[oa]|cre[eé]|guard[eé]/i);
  });
});

describe("RUL-PRES-01: la ambigüedad se responde preguntando", () => {
  it("una pregunta de desambiguación no lleva opciones de acción", () => {
    const result = plan({
      structureAmbiguityQuestion:
        "¿Quieres apartar ese dinero de verdad o solo ponerte una referencia?",
    });

    expect(result.reason).toBe("structure_needs_clarification");
    expect(result.blocks).toEqual([
      {
        kind: "texto",
        text: "¿Quieres apartar ese dinero de verdad o solo ponerte una referencia?",
      },
    ]);
  });
});

describe("el resultado de la escritura se cuenta sin ambigüedad", () => {
  it("una caja creada avisa que ese dinero deja de estar libre", () => {
    const resolution: StructureResolutionResult = {
      kind: "applied",
      reason: "structure_applied",
      entity: "caja",
      operation: "create",
      entity_id: "b1",
      summary: "la caja Viaje con S/500.00 apartados",
      idempotent: false,
    };
    const [block] = plan({ structureResolution: resolution }).blocks;
    if (!("text" in block)) throw new Error("se esperaba un bloque con texto");
    expect(block.text).toContain("deja de contar como libre");
  });

  it("un presupuesto creado aclara que no aparta dinero", () => {
    const resolution: StructureResolutionResult = {
      kind: "applied",
      reason: "structure_applied",
      entity: "presupuesto",
      operation: "create",
      entity_id: "p1",
      summary: "un presupuesto de S/500.00 al mes",
      idempotent: false,
    };
    const [block] = plan({ structureResolution: resolution }).blocks;
    if (!("text" in block)) throw new Error("se esperaba un bloque con texto");
    expect(block.text).toContain("no aparta ni bloquea tu dinero");
  });

  it("un replay idempotente dice que no duplicó nada", () => {
    const resolution: StructureResolutionResult = {
      kind: "applied",
      reason: "already_applied",
      entity: "caja",
      operation: "create",
      entity_id: "b1",
      summary: "la caja Viaje con S/500.00 apartados",
      idempotent: true,
    };
    const [block] = plan({ structureResolution: resolution }).blocks;
    if (!("text" in block)) throw new Error("se esperaba un bloque con texto");
    expect(block.text).toContain("No lo dupliqué");
  });

  it("cancelar deja claro que no se creó nada", () => {
    const resolution: StructureResolutionResult = {
      kind: "cancelled",
      reason: "user_cancelled_structure",
      entity: "caja",
      operation: "create",
      summary: "la caja Viaje",
    };
    const result = plan({ structureResolution: resolution });
    expect(result.reason).toBe("structure_cancelled");
    expect(result.blocks).toEqual([
      { kind: "texto", text: "Listo, no creé nada." },
    ]);
  });

  it("una propuesta vencida se dice, no se ejecuta en silencio", () => {
    const resolution: StructureResolutionResult = {
      kind: "failed",
      reason: "proposal_lapsed",
      entity: null,
      operation: null,
      error_code: "STRUCTURE_PROPOSAL_EXPIRED",
      detail: null,
    };
    const [block] = plan({ structureResolution: resolution }).blocks;
    if (!("text" in block)) throw new Error("se esperaba un bloque con texto");
    expect(block.text).toContain("venció");
  });

  it("un fallo con detalle del usuario se cuenta con ese detalle", () => {
    const resolution: StructureResolutionResult = {
      kind: "failed",
      reason: "execution_failed",
      entity: "caja",
      operation: "create",
      error_code: "INSUFFICIENT_FREE_BALANCE",
      detail: "Solo tienes S/120.00 libres en BCP.",
    };
    const [block] = plan({ structureResolution: resolution }).blocks;
    if (!("text" in block)) throw new Error("se esperaba un bloque con texto");
    expect(block.text).toBe("Solo tienes S/120.00 libres en BCP.");
  });
});
