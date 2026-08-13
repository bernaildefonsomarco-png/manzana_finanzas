import { describe, expect, it } from "vitest";
import {
  compileMovementAction,
  type MovementActionContext,
  type MovementActionRequest,
} from "./movement-action-request";

const NOW = "2026-08-12T10:00:00.000Z";
const MOVEMENT_A = "00000000-0000-4000-8000-000000000d01";
const MOVEMENT_B = "00000000-0000-4000-8000-000000000d02";

const movements: MovementActionContext[] = [
  {
    id: MOVEMENT_A,
    type: "gasto",
    amount: 40,
    currency: "PEN",
    description: "Súper",
    merchant: "Plaza Vea",
    occurred_at: "2026-08-11T18:00:00.000Z",
  },
  {
    id: MOVEMENT_B,
    type: "gasto",
    amount: 18,
    currency: "PEN",
    description: "Taxi",
    merchant: null,
    occurred_at: "2026-08-10T09:00:00.000Z",
  },
];

function request(
  overrides: Partial<MovementActionRequest> = {},
): MovementActionRequest {
  return {
    intent: "none",
    movement_id: "",
    new_occurred_at: "",
    new_amount: 0,
    confidence: 0.9,
    ambiguities: [],
    ...overrides,
  };
}

describe("compileMovementAction: contrato y silencio correcto", () => {
  it("sin request, no se pidio nada", () => {
    expect(
      compileMovementAction({ request: null, userText: "", now: NOW, movements: [] }),
    ).toEqual({ kind: "not_requested" });
  });

  it("intent none, no se pidio nada", () => {
    const result = compileMovementAction({
      request: request({ intent: "none" }),
      userText: "hola",
      now: NOW,
      movements,
    });
    expect(result).toEqual({ kind: "not_requested" });
  });

  it("una ambiguedad declarada por el modelo se pregunta primero", () => {
    const result = compileMovementAction({
      request: request({
        intent: "duplicar_movimiento",
        ambiguities: ["¿Cuál movimiento?"],
      }),
      userText: "duplica eso",
      now: NOW,
      movements,
    });
    expect(result).toEqual({
      kind: "needs_clarification",
      question: "¿Cuál movimiento?",
    });
  });

  it("bajo el umbral de confianza, se pregunta en vez de proponer", () => {
    const result = compileMovementAction({
      request: request({
        intent: "duplicar_movimiento",
        movement_id: MOVEMENT_A,
        confidence: 0.3,
      }),
      userText: "capaz duplico algo",
      now: NOW,
      movements,
    });
    expect(result.kind).toBe("needs_clarification");
  });
});

describe("restaurar_movimiento", () => {
  it("resuelve por id exacto entre los eliminados", () => {
    const result = compileMovementAction({
      request: request({
        intent: "restaurar_movimiento",
        movement_id: MOVEMENT_A,
      }),
      userText: "restaura ese",
      now: NOW,
      movements: [],
      deletedMovements: movements,
    });
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.command.operation).toBe("restore");
    expect(result.command.catalog_command).toBe("restaurar_movimiento");
    expect(result.command.payload).toMatchObject({ movement_id: MOVEMENT_A });
    expect(result.command.summary).toContain("S/40.00");
  });

  it("«el ultimo» resuelve al mas reciente de los eliminados", () => {
    const result = compileMovementAction({
      request: request({ intent: "restaurar_movimiento" }),
      userText: "eso que borré, devuélvelo, el ultimo",
      now: NOW,
      movements: [],
      deletedMovements: movements,
    });
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.command.payload.movement_id).toBe(MOVEMENT_A);
  });

  it("con un solo eliminado no hace falta desambiguar", () => {
    const result = compileMovementAction({
      request: request({ intent: "restaurar_movimiento" }),
      userText: "restaura lo que borré",
      now: NOW,
      movements: [],
      deletedMovements: [movements[1]],
    });
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.command.payload.movement_id).toBe(MOVEMENT_B);
  });

  it("sin eliminados no hay nada que restaurar: se pregunta, no se inventa", () => {
    const result = compileMovementAction({
      request: request({ intent: "restaurar_movimiento" }),
      userText: "restaura lo que borré",
      now: NOW,
      movements,
      deletedMovements: [],
    });
    expect(result.kind).toBe("needs_clarification");
  });

  it("con mas de un eliminado y sin pista, pregunta cual", () => {
    const result = compileMovementAction({
      request: request({ intent: "restaurar_movimiento" }),
      userText: "restaura el que borré",
      now: NOW,
      movements: [],
      deletedMovements: movements,
    });
    expect(result.kind).toBe("needs_clarification");
    if (result.kind === "needs_clarification") {
      expect(result.question).toContain("S/40.00");
      expect(result.question).toContain("S/18.00");
    }
  });

  it("un id inventado no se usa para escribir", () => {
    const result = compileMovementAction({
      request: request({
        intent: "restaurar_movimiento",
        movement_id: "id-inventado",
      }),
      userText: "restaura ese",
      now: NOW,
      movements: [],
      deletedMovements: movements,
    });
    expect(result.kind).toBe("needs_clarification");
  });
});

describe("duplicar_movimiento", () => {
  it("resuelve por id y usa el monto original si no piden cambiarlo", () => {
    const result = compileMovementAction({
      request: request({
        intent: "duplicar_movimiento",
        movement_id: MOVEMENT_A,
      }),
      userText: "duplica ese gasto",
      now: NOW,
      movements,
    });
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.command.operation).toBe("duplicate");
    expect(result.command.payload).toMatchObject({
      source_movement_id: MOVEMENT_A,
      amount: 40,
      occurred_at: null,
    });
    expect(result.command.summary).toContain("ahora");
  });

  it("con fecha nueva la guarda en el payload y en el resumen", () => {
    const result = compileMovementAction({
      request: request({
        intent: "duplicar_movimiento",
        movement_id: MOVEMENT_A,
        new_occurred_at: "2026-08-15",
      }),
      userText: "duplica ese pero para el 15",
      now: NOW,
      movements,
    });
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.command.payload.occurred_at).toBe(
      "2026-08-15T00:00:00.000Z",
    );
    expect(result.command.summary).toContain("2026-08-15");
  });

  it("con monto nuevo lo usa en vez del original", () => {
    const result = compileMovementAction({
      request: request({
        intent: "duplicar_movimiento",
        movement_id: MOVEMENT_A,
        new_amount: 60,
      }),
      userText: "duplicalo pero con 60",
      now: NOW,
      movements,
    });
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.command.payload.amount).toBe(60);
  });

  it("una fecha invalida pregunta en vez de proponer", () => {
    const result = compileMovementAction({
      request: request({
        intent: "duplicar_movimiento",
        movement_id: MOVEMENT_A,
        new_occurred_at: "15 de agosto",
      }),
      userText: "duplica ese para el 15 de agosto",
      now: NOW,
      movements,
    });
    expect(result.kind).toBe("needs_clarification");
  });

  it("«el ultimo» resuelve al mas reciente de los activos", () => {
    const result = compileMovementAction({
      request: request({ intent: "duplicar_movimiento" }),
      userText: "duplica el ultimo",
      now: NOW,
      movements,
    });
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.command.payload.source_movement_id).toBe(MOVEMENT_A);
  });
});
