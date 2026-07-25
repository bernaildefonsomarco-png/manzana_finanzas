import { describe, expect, it } from "vitest";
import {
  MOVEMENT_SOURCES,
  MOVEMENT_STATUSES,
  MOVEMENT_TYPES,
  PENDING_SOURCES,
  PENDING_STATUSES,
  PENDING_TYPES,
  RISK_LEVELS,
} from "@/shared/types/domain";
import {
  CurrencySchema,
  MoneyAmountSchema,
  MoneySchema,
  MovementSourceSchema,
  MovementStatusSchema,
  MovementTypeSchema,
  MovementDecimalAmountSchema,
  MovementInputSchema,
  PendingItemStatusSchema,
  PendingSourceSchema,
  PendingStatusSchema,
  PendingTypeSchema,
  RiskLevelSchema,
} from "./money";

describe("MoneyAmountSchema", () => {
  it("acepta enteros no negativos validos", () => {
    expect(MoneyAmountSchema.parse(0)).toBe(0);
    expect(MoneyAmountSchema.parse(100)).toBe(100);
    expect(MoneyAmountSchema.parse(99_999_999)).toBe(99_999_999);
  });

  it("rechaza montos negativos", () => {
    expect(() => MoneyAmountSchema.parse(-1)).toThrow();
  });

  it("rechaza decimales", () => {
    expect(() => MoneyAmountSchema.parse(12.5)).toThrow();
  });

  it("rechaza montos excesivamente grandes", () => {
    expect(() => MoneyAmountSchema.parse(999_999_999_999)).toThrow();
  });
});

describe("MoneySchema", () => {
  it("acepta monto y moneda validos", () => {
    expect(MoneySchema.parse({ amount: 1500, currency: "PEN" })).toEqual({
      amount: 1500,
      currency: "PEN",
    });
  });

  it("aplica currency PEN por defecto", () => {
    expect(MoneySchema.parse({ amount: 100 }).currency).toBe("PEN");
  });

  it("rechaza moneda invalida", () => {
    expect(() => MoneySchema.parse({ amount: 100, currency: "EUR" })).toThrow();
  });
});

describe("schemas canonicos", () => {
  it("MovementTypeSchema usa exactamente los tipos canonicos", () => {
    expect(MovementTypeSchema.options).toEqual([...MOVEMENT_TYPES]);
  });

  it("MovementStatusSchema usa exactamente los estados canonicos", () => {
    expect(MovementStatusSchema.options).toEqual([...MOVEMENT_STATUSES]);
  });

  it("MovementSourceSchema usa solo fuentes de movimientos confirmados", () => {
    expect(MovementSourceSchema.options).toEqual([...MOVEMENT_SOURCES]);
    expect(() => MovementSourceSchema.parse("email")).toThrow();
    expect(() => MovementSourceSchema.parse("dashboard")).toThrow();
  });

  it("PendingStatusSchema usa exactamente los estados canonicos", () => {
    expect(PendingStatusSchema.options).toEqual([...PENDING_STATUSES]);
  });

  it("PendingSourceSchema usa exactamente las fuentes pendientes", () => {
    expect(PendingSourceSchema.options).toEqual([...PENDING_SOURCES]);
  });

  it("PendingTypeSchema usa exactamente los tipos pendientes", () => {
    expect(PendingTypeSchema.options).toEqual([...PENDING_TYPES]);
  });

  it("RiskLevelSchema usa exactamente los niveles de riesgo canonicos", () => {
    expect(RiskLevelSchema.options).toEqual([...RISK_LEVELS]);
  });

  it("PendingItemStatusSchema queda como alias compatible", () => {
    expect(PendingItemStatusSchema).toBe(PendingStatusSchema);
  });
});

describe("CurrencySchema", () => {
  it("aplica PEN por defecto", () => {
    expect(CurrencySchema.parse(undefined)).toBe("PEN");
  });

  it("acepta USD", () => {
    expect(CurrencySchema.parse("USD")).toBe("USD");
  });

  it("rechaza monedas no soportadas", () => {
    expect(() => CurrencySchema.parse("EUR")).toThrow();
    expect(() => CurrencySchema.parse("BTC")).toThrow();
  });
});

describe("MovementDecimalAmountSchema", () => {
  it("acepta montos positivos con maximo dos decimales", () => {
    expect(MovementDecimalAmountSchema.parse(8)).toBe(8);
    expect(MovementDecimalAmountSchema.parse(8.5)).toBe(8.5);
    expect(MovementDecimalAmountSchema.parse(8.55)).toBe(8.55);
  });

  it("rechaza cero, negativos y mas de dos decimales", () => {
    expect(() => MovementDecimalAmountSchema.parse(0)).toThrow();
    expect(() => MovementDecimalAmountSchema.parse(-1)).toThrow();
    expect(() => MovementDecimalAmountSchema.parse(8.555)).toThrow();
  });
});

describe("MovementInputSchema", () => {
  it("permite cuenta null para movimientos confirmados por Core", () => {
    const parsed = MovementInputSchema.parse({
      type: "gasto",
      amount: 8,
      currency: "PEN",
      occurred_at: "2026-06-06T10:00:00.000Z",
      description: "Cafe",
      category_id: "alimentacion",
      subcategory_id: null,
      account_origin_id: null,
      account_destination_id: null,
      box_origin_id: null,
      box_destination_id: null,
      related_person_id: null,
      debt_id: null,
      recurring_rule_id: null,
      source: "dashboard_manual",
      source_ref: null,
    });

    expect(parsed.account_origin_id).toBeNull();
    expect(parsed.recurring_occurrence_id).toBeNull();
    expect(parsed.metadata).toEqual({});
  });
});
