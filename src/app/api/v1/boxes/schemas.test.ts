import { describe, expect, it } from "vitest";
import {
  CreateBoxRequestSchema,
  DeleteBoxRequestSchema,
  ListBoxesQuerySchema,
  UpdateBoxRequestSchema,
} from "./schemas";

const accountId = "00000000-0000-4000-8000-000000000001";

describe("box API schemas", () => {
  it("normaliza una caja minima", () => {
    const parsed = CreateBoxRequestSchema.parse({
      account_id: accountId,
      name: " Emergencia ",
    });

    expect(parsed).toEqual({
      account_id: accountId,
      name: "Emergencia",
      type: "objetivo",
      initial_balance: 0,
    });
  });

  it("permite meta y fecha objetivo", () => {
    const parsed = CreateBoxRequestSchema.parse({
      account_id: accountId,
      name: "Alquiler",
      type: "compromiso",
      initial_balance: 250,
      target_amount: 1200,
      target_date: "2026-07-01",
    });

    expect(parsed.type).toBe("compromiso");
    expect(parsed.target_amount).toBe(1200);
    expect(parsed.target_date).toBe("2026-07-01");
  });

  it("rechaza monto inicial mayor que la meta", () => {
    expect(() =>
      CreateBoxRequestSchema.parse({
        account_id: accountId,
        name: "Viaje",
        initial_balance: 800,
        target_amount: 500,
      })
    ).toThrow();
  });

  it("acepta filtro opcional por cuenta", () => {
    expect(ListBoxesQuerySchema.parse({ account_id: accountId })).toEqual({
      account_id: accountId,
    });
  });

  it("normaliza edicion parcial de caja", () => {
    const parsed = UpdateBoxRequestSchema.parse({
      name: " Alquiler ",
      target_amount: null,
    });

    expect(parsed).toEqual({
      name: "Alquiler",
      target_amount: null,
    });
  });

  it("rechaza edicion vacia de caja", () => {
    expect(() => UpdateBoxRequestSchema.parse({})).toThrow();
  });

  it("acepta eliminacion con razon opcional", () => {
    expect(DeleteBoxRequestSchema.parse({ reason: "duplicada" })).toEqual({
      reason: "duplicada",
    });
    expect(DeleteBoxRequestSchema.parse({})).toEqual({});
  });
});
