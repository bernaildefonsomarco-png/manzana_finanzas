import { describe, expect, it } from "vitest";
import {
  CreateAccountRequestSchema,
  DeleteAccountRequestSchema,
  UpdateAccountRequestSchema,
} from "./schemas";

describe("account API schemas", () => {
  it("normaliza una cuenta inicial minima", () => {
    const parsed = CreateAccountRequestSchema.parse({
      name: " Yape ",
      initial_balance: 120.5,
    });

    expect(parsed).toEqual({
      name: "Yape",
      type: "digital",
      currency: "PEN",
      initial_balance: 120.5,
    });
  });

  it("permite saldo inicial negativo para datos imperfectos", () => {
    const parsed = CreateAccountRequestSchema.parse({
      name: "Efectivo",
      type: "fisico",
      initial_balance: -20,
    });

    expect(parsed.initial_balance).toBe(-20);
  });

  it("rechaza saldos con mas de dos decimales", () => {
    expect(() =>
      CreateAccountRequestSchema.parse({
        name: "BCP",
        initial_balance: 10.123,
      })
    ).toThrow();
  });

  it("normaliza edicion parcial de cuenta", () => {
    const parsed = UpdateAccountRequestSchema.parse({
      name: " BCP ",
      institution: null,
    });

    expect(parsed).toEqual({
      name: "BCP",
      institution: null,
    });
  });

  it("rechaza edicion vacia de cuenta", () => {
    expect(() => UpdateAccountRequestSchema.parse({})).toThrow();
  });

  it("acepta eliminacion con razon opcional", () => {
    expect(DeleteAccountRequestSchema.parse({ reason: "duplicada" })).toEqual({
      reason: "duplicada",
    });
    expect(DeleteAccountRequestSchema.parse({})).toEqual({});
  });
});
