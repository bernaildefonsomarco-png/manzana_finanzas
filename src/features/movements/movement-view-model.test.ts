import { describe, expect, it } from "vitest";
import type { Movement } from "@/shared/types/domain";
import {
  isIncomeType,
  isTransferType,
  movementMatchesSearchQuery,
  toMovementViewItem,
} from "./movement-view-model";

const baseMovement: Movement = {
  id: "7c5541d0-5a56-4561-94df-f9283b3fd601",
  user_id: "f7293f8f-e963-4e3e-95db-2a6dfc7aee82",
  type: "gasto",
  status: "confirmed",
  amount: 12.5,
  currency: "PEN",
  occurred_at: "2026-06-07T14:30:00.000Z",
  description: "Cafe de prueba",
  merchant: null,
  category_id: "alimentacion",
  subcategory_id: null,
  source: "dashboard_manual",
  source_ref: null,
  idempotency_key: "manual-test-key",
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
  affects_total_balance: false,
  affects_account_balance: false,
  created_at: "2026-06-07T14:30:01.000Z",
  updated_at: "2026-06-07T14:30:01.000Z",
  deleted_at: null,
  metadata: {},
};

describe("movement view model", () => {
  it("maps raw movement rows to UI-safe labels", () => {
    const view = toMovementViewItem(baseMovement);

    expect(view.title).toBe("Cafe de prueba");
    expect(view.categoryLabel).toBe("Alimentación");
    expect(view.sourceLabel).toBe("Dashboard");
    expect(view.accountLabel).toBe("Sin cuenta");
    expect(view.typeLabel).toBe("Gasto");
    expect(view.amount).toBe(12.5);
  });

  it("uses merchant as title when present", () => {
    const view = toMovementViewItem({
      ...baseMovement,
      merchant: "Panaderia central",
      description: "Compra rapida",
    });

    expect(view.title).toBe("Panaderia central");
  });

  it("classifies income and transfer-like movement types", () => {
    expect(isIncomeType("ingreso")).toBe(true);
    expect(isIncomeType("devolucion_recibida")).toBe(true);
    expect(isIncomeType("gasto")).toBe(false);

    expect(isTransferType("transferencia")).toBe(true);
    expect(isTransferType("asignacion_interna")).toBe(true);
    expect(isTransferType("pago_deuda")).toBe(false);
  });

  it("filters natural movement queries by useful tokens instead of exact phrases", () => {
    const cafeteria = toMovementViewItem({
      ...baseMovement,
      merchant: "Cafeteria Central",
      category_id: "alimentacion",
    });
    const taxi = toMovementViewItem({
      ...baseMovement,
      id: "97b28166-a86f-4596-9a8e-f95329540f21",
      merchant: "Taxi Uber",
      category_id: "transporte",
    });

    expect(movementMatchesSearchQuery(cafeteria, "gastos de cafeteria")).toBe(
      true
    );
    expect(movementMatchesSearchQuery(taxi, "gastos de cafeteria")).toBe(false);
    expect(movementMatchesSearchQuery(cafeteria, "gastos")).toBe(true);
  });
});
