import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Movement } from "@/shared/types/domain";
import type { BudgetDetailView, BudgetView } from "./budgets-types";

const mocks = vi.hoisted(() => ({ listMovementsFiltered: vi.fn() }));
vi.mock("@/features/movements/movements-api", () => mocks);

const { buildBudgetDetailProvenance, loadBudgetSpentProvenance, buildBudgetPeriodSummaryProvenance } = await import(
  "./budget-provenance"
);

function budget(overrides: Partial<BudgetView> = {}): BudgetView {
  return {
    id: "b1",
    category_id: "alimentacion",
    category_name: "Alimentación",
    currency: "PEN",
    period_kind: "mensual",
    period_start: "2026-07-01",
    period_end: "2026-07-31",
    base_amount: 100,
    rollover_amount: 0,
    amount: 100,
    kind: "presupuesto",
    rollover: false,
    auto_renew: true,
    alerted_thresholds: [],
    source: "manual",
    status: "activo",
    spent: 50,
    remaining: 50,
    pct: 0.5,
    percentage: 50,
    percentage_exact: 50,
    band: "holgado",
    movement_ids: ["m1"],
    created_at: "2026-07-01T05:00:00.000Z",
    ...overrides,
  };
}

function movement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: "m1",
    user_id: "u1",
    type: "gasto",
    status: "confirmed",
    amount: 32,
    currency: "PEN",
    occurred_at: "2026-07-26T15:00:00Z",
    description: null,
    merchant: "Rappi",
    category_id: "alimentacion",
    subcategory_id: null,
    source: "dashboard_manual",
    source_ref: null,
    idempotency_key: "k1",
    confidence: null,
    requires_review: false,
    account_origin_id: null,
    account_destination_id: null,
    box_origin_id: null,
    box_destination_id: null,
    debt_id: null,
    recurring_rule_id: null,
    recurring_occurrence_id: null,
    related_person_id: null,
    affects_total_balance: true,
    ...overrides,
  } as Movement;
}

beforeEach(() => {
  mocks.listMovementsFiltered.mockReset();
});

describe("buildBudgetDetailProvenance — usa las movements ya cargadas, sin fetch", () => {
  it("lista las filas y el total tal como están en el registro", () => {
    const detail: BudgetDetailView = {
      ...budget(),
      movements: [movement({ id: "m1", merchant: "Rappi", amount: 32 })],
      snapshots: [],
    };
    const data = buildBudgetDetailProvenance(detail);
    expect(data.title).toBe("De dónde sale este gastado de S/50.00");
    expect(data.rows).toEqual([
      expect.objectContaining({ id: "m1", label: "Rappi", amount: 32, href: "/movimientos/m1" }),
    ]);
  });
});

describe("loadBudgetSpentProvenance — la tarjeta de la lista, sin movements cargadas", () => {
  it("va a buscar solo los movement_ids del presupuesto", async () => {
    mocks.listMovementsFiltered.mockResolvedValue([
      movement({ id: "m1", merchant: "Rappi" }),
      movement({ id: "m2", merchant: "Fuera del presupuesto" }),
    ]);
    const data = await loadBudgetSpentProvenance(budget({ movement_ids: ["m1"] }));
    expect(data.rows.map((r) => r.id)).toEqual(["m1"]);
    expect(mocks.listMovementsFiltered).toHaveBeenCalledWith(
      expect.objectContaining({ category_id: "alimentacion" }),
    );
  });

  it("sin movement_ids, no llama a la API", async () => {
    const data = await loadBudgetSpentProvenance(budget({ movement_ids: [] }));
    expect(mocks.listMovementsFiltered).not.toHaveBeenCalled();
    expect(data.rows).toEqual([]);
  });
});

describe("buildBudgetPeriodSummaryProvenance — cifra compuesta de presupuestos, no de movimientos", () => {
  it("cada fila es un presupuesto, navegable a su detalle", () => {
    const data = buildBudgetPeriodSummaryProvenance(
      [budget({ id: "b1", category_name: "Alimentación", spent: 50 }), budget({ id: "b2", category_name: "Transporte", spent: 30 })],
      "mensual",
    );
    expect(data.title).toBe("De dónde sale este gastado de S/80.00");
    expect(data.rows).toEqual([
      { id: "b1", label: "Alimentación", detail: "50% usado", amount: 50, href: "/presupuestos/b1" },
      { id: "b2", label: "Transporte", detail: "50% usado", amount: 30, href: "/presupuestos/b2" },
    ]);
  });
});
