// AC-DINERO-01/02/03, AC-CUENTAS-01/02/03 (`09` §4, `24` §6): las cuatro
// capas del dinero, sin doble conteo y con cobertura parcial.
import { describe, expect, it } from "vitest";
import { calculateMoneyLayers } from "./money-layers";

describe("calculateMoneyLayers", () => {
  it("AC-DINERO-01 / AC-CUENTAS-01: el ejemplo canonico de 09 §4 produce 800/580/220/170", () => {
    const result = calculateMoneyLayers({
      accounts: [
        { current_balance: 630 }, // BCP
        { current_balance: 120 }, // Yape
        { current_balance: 50 }, // Efectivo
      ],
      boxes: [
        { id: "emergencia", current_balance: 100 },
        { id: "cuota-laptop", current_balance: 180 },
        { id: "alquiler", current_balance: 300 },
      ],
      commitments: [
        { amount: 50, linked_box_id: null }, // Internet, sin caja
        { amount: 180, linked_box_id: "cuota-laptop" }, // cubierto por completo
      ],
    });

    expect(result.total_balance).toBe(800);
    expect(result.separated_in_boxes).toBe(580);
    expect(result.free_in_accounts).toBe(220);
    expect(result.upcoming_uncovered_commitments).toBe(50);
    expect(result.operational_free_money).toBe(170);
  });

  it("AC-DINERO-02 / AC-CUENTAS-02 (RUL-CUENTAS-04): una caja que cubre el compromiso completo no lo descuenta dos veces", () => {
    // Si se descontara igual, el dinero libre daria -10 en vez de 170
    // (09 §4): es la verificacion explicita que el documento pide.
    const result = calculateMoneyLayers({
      accounts: [{ current_balance: 630 }, { current_balance: 120 }, { current_balance: 50 }],
      boxes: [
        { id: "emergencia", current_balance: 100 },
        { id: "cuota-laptop", current_balance: 180 },
        { id: "alquiler", current_balance: 300 },
      ],
      commitments: [
        { amount: 50, linked_box_id: null },
        { amount: 180, linked_box_id: "cuota-laptop" },
      ],
    });

    expect(result.operational_free_money).not.toBe(-10);
    expect(result.operational_free_money).toBe(170);
  });

  it("AC-CUENTAS-03 (RUL-CUENTAS-04, cobertura parcial): descuenta solo la diferencia", () => {
    // 24 §6: caja con 120, compromiso de 180 -> descuenta 60.
    const result = calculateMoneyLayers({
      accounts: [{ current_balance: 500 }],
      boxes: [{ id: "caja", current_balance: 120 }],
      commitments: [{ amount: 180, linked_box_id: "caja" }],
    });

    expect(result.upcoming_uncovered_commitments).toBe(60);
    expect(result.operational_free_money).toBe(500 - 120 - 60);
  });

  it("AC-REC-03 (RUL-REC-04): caja 60 y pago 89 dejan exactamente 29 sin cubrir", () => {
    const result = calculateMoneyLayers({
      accounts: [{ current_balance: 200 }],
      boxes: [{ id: "internet", current_balance: 60 }],
      commitments: [
        {
          id: "internet-julio",
          amount: 89,
          linked_box_id: "internet",
          due_at: "2026-07-31",
        },
      ],
    });

    expect(result.upcoming_uncovered_commitments).toBe(29);
    expect(result.operational_free_money).toBe(111);
  });

  it("WEB-D206: una misma caja se consume una sola vez por vencimiento", () => {
    const result = calculateMoneyLayers({
      accounts: [{ current_balance: 300 }],
      boxes: [{ id: "servicios", current_balance: 100 }],
      commitments: [
        {
          id: "segundo",
          amount: 100,
          linked_box_id: "servicios",
          due_at: "2026-08-20",
        },
        {
          id: "primero",
          amount: 100,
          linked_box_id: "servicios",
          due_at: "2026-08-10",
        },
      ],
    });

    expect(result.upcoming_uncovered_commitments).toBe(100);
    expect(result.operational_free_money).toBe(100);
  });

  it("un compromiso vinculado a una caja que ya no existe en la lista cuenta como no cubierto", () => {
    const result = calculateMoneyLayers({
      accounts: [{ current_balance: 100 }],
      boxes: [],
      commitments: [{ amount: 40, linked_box_id: "caja-archivada" }],
    });

    expect(result.upcoming_uncovered_commitments).toBe(40);
  });

  it("sin cajas ni compromisos, libre en cuentas y dinero libre coinciden (09 §9)", () => {
    const result = calculateMoneyLayers({
      accounts: [{ current_balance: 300 }],
      boxes: [],
      commitments: [],
    });

    expect(result.free_in_accounts).toBe(300);
    expect(result.operational_free_money).toBe(300);
  });

  it("redondea solo al final, al centimo (RUL-CUENTAS-15)", () => {
    const result = calculateMoneyLayers({
      accounts: [{ current_balance: 10.005 }],
      boxes: [{ id: "a", current_balance: 3.001 }],
      commitments: [],
    });

    expect(result.total_balance).toBe(10.01);
    expect(result.separated_in_boxes).toBe(3);
    expect(result.free_in_accounts).toBe(7);
  });
});
