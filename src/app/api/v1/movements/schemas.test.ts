import { describe, expect, it } from "vitest";
import {
  CreateMovementRequestSchema,
  MovementPatchRequestSchema,
  toMovementInput,
  toMovementPatch,
} from "./schemas";

describe("movement API schemas", () => {
  it("ERR-CAT-05 / AC-CAT-13: acepta hasta 6 etiquetas por movimiento", () => {
    const sixTags = Array.from({ length: 6 }, (_, i) => `1111111${i}-1111-4111-8111-111111111111`);

    expect(() =>
      CreateMovementRequestSchema.parse({
        type: "gasto",
        amount: 8,
        occurred_at: "2026-06-06T12:00:00.000Z",
        description: "Cafe",
        category_id: "alimentacion",
        tag_ids: sixTags,
      })
    ).not.toThrow();
  });

  it("ERR-CAT-05 / AC-CAT-13: rechaza mas de 6 etiquetas por movimiento", () => {
    const sevenTags = Array.from({ length: 7 }, (_, i) => `1111111${i}-1111-4111-8111-111111111111`);

    expect(() =>
      CreateMovementRequestSchema.parse({
        type: "gasto",
        amount: 8,
        occurred_at: "2026-06-06T12:00:00.000Z",
        description: "Cafe",
        category_id: "alimentacion",
        tag_ids: sevenTags,
      })
    ).toThrow(/hasta 6 etiquetas/);
  });

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
