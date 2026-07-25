import { describe, expect, it } from "vitest";
import {
  CreateMovementRequestSchema,
  MovementPatchRequestSchema,
  toMovementInput,
  toMovementPatch,
} from "./schemas";

describe("movement API schemas", () => {
  it("fuerza movimientos manuales como dashboard_manual", () => {
    const parsed = CreateMovementRequestSchema.parse({
      type: "gasto",
      amount: 8,
      occurred_at: "2026-06-06T12:00:00.000Z",
      description: "Cafe",
      category_id: "alimentacion",
    });

    const input = toMovementInput(parsed);

    expect(input.source).toBe("dashboard_manual");
    expect(input.account_origin_id).toBeNull();
    expect(input.source_ref).toBeNull();
  });

  it("rechaza que el cliente inyecte source en el request", () => {
    expect(() =>
      CreateMovementRequestSchema.parse({
        type: "gasto",
        amount: 8,
        occurred_at: "2026-06-06T12:00:00.000Z",
        description: "Cafe",
        category_id: "alimentacion",
        source: "email_confirmed",
      })
    ).toThrow();
  });

  it("rechaza que el cliente inyecte user_id en el request", () => {
    expect(() =>
      CreateMovementRequestSchema.parse({
        type: "gasto",
        amount: 8,
        occurred_at: "2026-06-06T12:00:00.000Z",
        description: "Cafe",
        category_id: "alimentacion",
        user_id: "00000000-0000-4000-8000-000000000001",
      })
    ).toThrow();
  });

  it("convierte patches parciales a MovementPatch sin inventar campos", () => {
    const parsed = MovementPatchRequestSchema.parse({
      amount: 10,
      category_id: "transporte",
      account_origin_id: null,
    });

    expect(toMovementPatch(parsed)).toEqual({
      amount: 10,
      category_id: "transporte",
      account_origin_id: null,
    });
  });

  it("no permite inyectar la confirmacion de duplicado en un patch", () => {
    expect(() =>
      MovementPatchRequestSchema.parse({
        description: "Cafe corregido",
        confirm_duplicate: true,
      })
    ).toThrow();
  });
});
