import { describe, expect, it } from "vitest";
import { buildFreeMoneyProvenance } from "./free-money-provenance";
import type { MoneyDashboardResponse } from "@/shared/api/money-types";

function dashboard(overrides: Partial<MoneyDashboardResponse> = {}): MoneyDashboardResponse {
  return {
    base_currency: "PEN",
    currency_layers: {
      PEN: {
        total_balance: 1140,
        separated_in_boxes: 500,
        free_in_accounts: 640,
        upcoming_uncovered_commitments: 89,
        operational_free_money: 551,
      },
      USD: {
        total_balance: 0,
        separated_in_boxes: 0,
        free_in_accounts: 0,
        upcoming_uncovered_commitments: 0,
        operational_free_money: 0,
      },
    },
    total_balance: 1140,
    free_in_accounts: 640,
    operational_free_money: 551,
    separated_in_boxes: 500,
    upcoming_uncovered_commitments: 89,
    accounts: [
      { id: "acc-1", user_id: "u1", name: "BCP", institution: null, type: "banco", currency: "PEN", initial_balance: 0, current_balance: 800, is_default: true, color: null, icon: null, created_at: "", updated_at: "", deleted_at: null, boxes_total: 300, free_balance: 500, box_count: 1, balance_status: "ok" },
    ],
    boxes: [
      { id: "box-1", user_id: "u1", account_id: "acc-1", name: "Alquiler", type: "compromiso", current_balance: 500, target_amount: null, target_date: null, linked_debt_id: null, linked_recurring_id: null, created_at: "", updated_at: "", deleted_at: null, account_name: "BCP", currency: "PEN" },
    ],
    commitments: [
      { id: "c-1", title: "Cuota laptop", amount: 89, currency: "PEN", due_at: "2026-08-10", kind: "recurring", linked_box_id: null },
    ],
    data_quality: { has_accounts: true, has_boxes: true, message: "x", warnings: [] },
    empty_state: null,
    ...overrides,
  };
}

describe("buildFreeMoneyProvenance — 48 RUL-AYUDA-02: qué conté y qué no conté, con el ejemplo de 48 §4", () => {
  it("el título usa exactamente operational_free_money, el mismo número que muestra el Inicio", () => {
    const result = buildFreeMoneyProvenance(dashboard());
    expect(result.title).toBe("De dónde sale este S/551.00");
  });

  it("qué conté: total en cuentas, cajas restadas, y compromisos sin cubrir restados", () => {
    const result = buildFreeMoneyProvenance(dashboard());
    expect(result.countedLines).toEqual([
      "S/1,140.00 en tus 1 cuenta",
      "− S/500.00 apartados en 1 caja",
      "− S/89.00 en compromisos que vienen sin una caja que los cubra",
    ]);
  });

  it("sin compromisos sin cubrir, esa línea no aparece", () => {
    const result = buildFreeMoneyProvenance(
      dashboard({ upcoming_uncovered_commitments: 0 }),
    );
    expect(result.countedLines).toHaveLength(2);
  });

  it("con saldo en dólares, qué-no-conté explica que no se convierte", () => {
    const result = buildFreeMoneyProvenance(
      dashboard({
        currency_layers: {
          PEN: dashboard().currency_layers.PEN,
          USD: { total_balance: 200, separated_in_boxes: 0, free_in_accounts: 200, upcoming_uncovered_commitments: 0, operational_free_money: 200 },
        },
      }),
    );
    expect(result.notCounted).toEqual([
      { text: "Tus cuentas en dólares no se suman aquí: no convierto monedas sin un tipo de cambio explícito." },
    ]);
  });

  it("sin dólares, qué-no-conté queda vacío", () => {
    const result = buildFreeMoneyProvenance(dashboard());
    expect(result.notCounted).toEqual([]);
  });

  it("las filas navegables incluyen la cuenta, la caja y el compromiso sin cubrir, con sus enlaces reales", () => {
    const result = buildFreeMoneyProvenance(dashboard());
    expect(result.rows).toEqual([
      { id: "account-acc-1", label: "BCP", detail: "Cuenta", amount: 500, href: "/mi-dinero/cuentas/acc-1" },
      { id: "box-box-1", label: "Alquiler", detail: "Caja en BCP", amount: 500, href: "/mi-dinero/cajas/box-1" },
      { id: "commitment-c-1", label: "Cuota laptop", detail: "Compromiso sin caja que lo cubra", amount: 89, href: "/pagos-que-vienen" },
    ]);
  });

  it("un compromiso ya vinculado a una caja no aparece como fila sin cubrir", () => {
    const result = buildFreeMoneyProvenance(
      dashboard({
        commitments: [
          { id: "c-1", title: "Cuota laptop", amount: 89, currency: "PEN", due_at: "2026-08-10", kind: "recurring", linked_box_id: "box-1" },
        ],
        upcoming_uncovered_commitments: 89,
      }),
    );
    expect(result.rows.find((row) => row.id === "commitment-c-1")).toBeUndefined();
  });

  it("RUL-HECHO-02: si se usara free_in_accounts en vez de operational_free_money, el título del primer test fallaría (640 != 551)", () => {
    const result = buildFreeMoneyProvenance(dashboard());
    expect(result.title).not.toContain("640");
  });
});
