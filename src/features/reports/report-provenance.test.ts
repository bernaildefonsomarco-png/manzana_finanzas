import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Movement } from "@/shared/types/domain";
import type { ReportPeriod } from "./reports-api";

const mocks = vi.hoisted(() => ({ listMovementsFiltered: vi.fn() }));
vi.mock("@/features/movements/movements-api", () => mocks);

const { loadReportTotalProvenance, loadReportCategoryProvenance } = await import("./report-provenance");

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

function period(overrides: Partial<ReportPeriod> = {}): ReportPeriod {
  return {
    from: "2026-07-01",
    to: "2026-07-31",
    gastoTotal: 90,
    ingresoTotal: 0,
    gastoMovementCount: 2,
    ingresoMovementCount: 0,
    byCategory: [{ category_id: "alimentacion", total: 90, movement_count: 2 }],
    exclusions: [{ reason: "transferencia", count: 2 }],
    countedMovementIds: ["m1", "m2"],
    ...overrides,
  };
}

beforeEach(() => {
  mocks.listMovementsFiltered.mockReset();
});

describe("loadReportTotalProvenance — SCR-AYUDA-01 sobre el total de gasto del mes", () => {
  it("filtra las filas a los IDs que el motor ya contó, nunca recalcula", async () => {
    mocks.listMovementsFiltered.mockResolvedValue([
      movement({ id: "m1", merchant: "Rappi", amount: 32 }),
      movement({ id: "m2", merchant: "Mercado", amount: 58 }),
      movement({ id: "m3", merchant: "Fuera del conteo", amount: 999 }),
    ]);

    const data = await loadReportTotalProvenance(period());

    expect(data.title).toBe("De dónde sale este gasto de S/90.00");
    expect(data.rows.map((r) => r.id)).toEqual(["m1", "m2"]);
    expect(data.rows.find((r) => r.id === "m3")).toBeUndefined();
    expect(data.notCounted).toEqual([{ text: "2 transferencias entre tus cuentas" }]);
    expect(data.rowsTitle).toBe("Los 2 movimientos");
  });

  it("un pendiente sin confirmar trae la acción de resolverlo (RUL-REP-02)", async () => {
    mocks.listMovementsFiltered.mockResolvedValue([]);
    const data = await loadReportTotalProvenance(
      period({ exclusions: [{ reason: "pendiente_sin_confirmar", count: 1 }], countedMovementIds: [] }),
    );
    expect(data.notCounted).toEqual([
      { text: "1 pendientes que no has confirmado", actionLabel: "Revisar pendientes", actionHref: "/pendientes" },
    ]);
  });
});

describe("loadReportCategoryProvenance — la fila de una categoría en la tabla", () => {
  it("solo trae las filas de esa categoría y ya contadas", async () => {
    mocks.listMovementsFiltered.mockResolvedValue([
      movement({ id: "m1", category_id: "alimentacion", merchant: "Rappi", amount: 32 }),
      movement({ id: "m2", category_id: "alimentacion", merchant: "Mercado", amount: 58 }),
      movement({ id: "m4", category_id: "transporte", merchant: "Uber", amount: 20 }),
    ]);

    const p = period();
    const data = await loadReportCategoryProvenance(p, p.byCategory[0]);

    expect(data.title).toBe("De dónde sale este S/90.00 de Alimentación");
    expect(data.rows.map((r) => r.id)).toEqual(["m1", "m2"]);
    expect(mocks.listMovementsFiltered).toHaveBeenCalledWith(
      expect.objectContaining({ category_id: "alimentacion" }),
    );
  });
});
