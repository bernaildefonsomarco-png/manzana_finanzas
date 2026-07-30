import { describe, expect, it } from "vitest";
import {
  detectRecurringCandidates,
  normalizeRecurringMerchantKey,
  type RecurringDetectorMovement,
} from "./recurring-detector";

describe("recurring detector", () => {
  it("detecta un patron mensual listo para sugerir con tres pagos confirmados", () => {
    const candidates = detectRecurringCandidates({
      now: new Date("2026-06-29T12:00:00Z"),
      movements: [
        movement({ id: "m1", occurred_at: "2026-04-05T12:00:00Z" }),
        movement({ id: "m2", occurred_at: "2026-05-05T12:00:00Z" }),
        movement({ id: "m3", occurred_at: "2026-06-05T12:00:00Z" }),
      ],
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].merchant_key).toBe("netflix");
    expect(candidates[0].status).toBe("ready_to_suggest");
    expect(candidates[0].confidence).toBeGreaterThanOrEqual(0.75);
    expect(candidates[0].evidence.inferred_frequency).toBe("monthly");
    expect(candidates[0].evidence.inferred_amount).toBe(15);
    expect(candidates[0].evidence.next_expected_date).toBe("2026-07-05");
  });

  it("RUL-REC-02: Netflix 14 may/14 jun/13 jul cumple la cadencia mensual", () => {
    const candidates = detectRecurringCandidates({
      now: new Date("2026-07-14T05:00:00Z"),
      movements: [
        movement({ id: "m1", occurred_at: "2026-05-14T12:00:00Z", amount: 39.9 }),
        movement({ id: "m2", occurred_at: "2026-06-14T12:00:00Z", amount: 40 }),
        movement({ id: "m3", occurred_at: "2026-07-13T12:00:00Z", amount: 40.1 }),
      ],
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].status).toBe("ready_to_suggest");
    expect(candidates[0].evidence.inferred_frequency).toBe("monthly");
    expect(candidates[0].evidence.amount_variability).not.toBe("variable");
    expect(candidates[0].evidence.date_window_start_day).toBe(13);
    expect(candidates[0].evidence.date_window_end_day).toBe(14);
  });

  it("guarda evidencia silenciosa con dos ocurrencias compatibles", () => {
    const candidates = detectRecurringCandidates({
      now: new Date("2026-06-29T12:00:00Z"),
      movements: [
        movement({ id: "m1", occurred_at: "2026-05-10T12:00:00Z" }),
        movement({ id: "m2", occurred_at: "2026-06-10T12:00:00Z" }),
      ],
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].status).toBe("candidate");
  });

  it("sugiere patrones claros aunque el monto sea variable para revisarlos en UI", () => {
    const candidates = detectRecurringCandidates({
      now: new Date("2026-06-29T12:00:00Z"),
      movements: [
        movement({ id: "m1", occurred_at: "2026-03-30T12:00:00Z", amount: 13 }),
        movement({ id: "m2", occurred_at: "2026-04-30T12:00:00Z", amount: 13 }),
        movement({ id: "m3", occurred_at: "2026-05-30T12:00:00Z", amount: 20 }),
        movement({ id: "m4", occurred_at: "2026-06-29T12:00:00Z", amount: 13 }),
      ],
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].status).toBe("ready_to_suggest");
    expect(candidates[0].evidence.amount_variability).toBe("variable");
  });

  it("RUL-REC-02: 40/120/85 supera 15% y se clasifica variable", () => {
    const candidates = detectRecurringCandidates({
      now: new Date("2026-07-14T05:00:00Z"),
      movements: [
        movement({ id: "m1", occurred_at: "2026-05-14T12:00:00Z", amount: 40 }),
        movement({ id: "m2", occurred_at: "2026-06-14T12:00:00Z", amount: 120 }),
        movement({ id: "m3", occurred_at: "2026-07-13T12:00:00Z", amount: 85 }),
      ],
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].evidence.amount_variation_ratio).toBeGreaterThan(0.15);
    expect(candidates[0].evidence.amount_variability).toBe("variable");
  });

  it("RUL-REC-02: una variación de 12% no se clasifica variable", () => {
    const candidates = detectRecurringCandidates({
      now: new Date("2026-07-14T05:00:00Z"),
      movements: [
        movement({ id: "m1", occurred_at: "2026-05-14T12:00:00Z", amount: 100 }),
        movement({ id: "m2", occurred_at: "2026-06-14T12:00:00Z", amount: 112 }),
        movement({ id: "m3", occurred_at: "2026-07-13T12:00:00Z", amount: 100 }),
      ],
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].evidence.amount_variation_ratio).toBe(0.12);
    expect(candidates[0].evidence.amount_variability).toBe("estimated");
  });

  it("ignora movimientos vinculados a reglas ya existentes", () => {
    const candidates = detectRecurringCandidates({
      existingMerchantKeys: ["Netflix"],
      now: new Date("2026-06-29T12:00:00Z"),
      movements: [
        movement({ id: "m1", occurred_at: "2026-04-05T12:00:00Z" }),
        movement({ id: "m2", occurred_at: "2026-05-05T12:00:00Z" }),
        movement({ id: "m3", occurred_at: "2026-06-05T12:00:00Z" }),
      ],
    });

    expect(candidates).toHaveLength(0);
  });

  it("RUL-REC-09: excluye pagos vinculados a deuda para no contar dos veces", () => {
    const candidates = detectRecurringCandidates({
      now: new Date("2026-07-14T05:00:00Z"),
      movements: [
        movement({
          id: "m1",
          occurred_at: "2026-05-14T12:00:00Z",
          debt_id: "11111111-1111-4111-8111-111111111111",
        }),
        movement({
          id: "m2",
          occurred_at: "2026-06-14T12:00:00Z",
          debt_id: "11111111-1111-4111-8111-111111111111",
        }),
        movement({
          id: "m3",
          occurred_at: "2026-07-13T12:00:00Z",
          debt_id: "11111111-1111-4111-8111-111111111111",
        }),
      ],
    });

    expect(candidates).toHaveLength(0);
  });

  it("normaliza nombres comunes de pago", () => {
    expect(normalizeRecurringMerchantKey("Pago de Netflix S/ 15.00")).toBe("netflix");
  });
});

function movement(
  overrides: Partial<RecurringDetectorMovement> = {}
): RecurringDetectorMovement {
  return {
    id: overrides.id ?? "m1",
    type: overrides.type ?? "gasto",
    status: overrides.status ?? "confirmed",
    amount: overrides.amount ?? 15,
    currency: overrides.currency ?? "PEN",
    occurred_at: overrides.occurred_at ?? "2026-06-05T12:00:00Z",
    description: overrides.description ?? "Pago de Netflix",
    merchant: overrides.merchant ?? "Netflix",
    category_id: overrides.category_id ?? "servicios_suscripciones",
    debt_id: overrides.debt_id ?? null,
    recurring_rule_id: overrides.recurring_rule_id ?? null,
    recurring_occurrence_id: overrides.recurring_occurrence_id ?? null,
    deleted_at: overrides.deleted_at ?? null,
  };
}
