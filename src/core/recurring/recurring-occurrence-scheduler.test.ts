import { describe, expect, it } from "vitest";
import type {
  RecurringOccurrence,
  RecurringRule,
} from "@/shared/types/domain";
import {
  isoDateInLima,
  planRecurringOccurrenceHorizon,
  recurringDuePresentation,
} from "./recurring-occurrence-scheduler";

describe("recurring occurrence scheduler", () => {
  it("RUL-REC-12: genera hasta 60 días y biweekly significa cada 14 días", () => {
    const plan = planRecurringOccurrenceHorizon({
      rules: [rule({ frequency: "biweekly", next_expected_date: "2026-07-01" })],
      occurrences: [],
      asOfDate: "2026-07-01",
    });

    expect(plan.inserts.map((item) => item.expected_date)).toEqual([
      "2026-07-01",
      "2026-07-15",
      "2026-07-29",
      "2026-08-12",
      "2026-08-26",
    ]);
  });

  it("RUL-REC-12: una segunda corrida con lo ya generado no inserta duplicados", () => {
    const first = planRecurringOccurrenceHorizon({
      rules: [rule({ next_expected_date: "2026-07-31", day_of_month: 31 })],
      occurrences: [],
      asOfDate: "2026-07-02",
    });
    const second = planRecurringOccurrenceHorizon({
      rules: [rule({ next_expected_date: "2026-07-31", day_of_month: 31 })],
      occurrences: first.inserts.map((draft, index) =>
        occurrence({
          id: `occ-${index}`,
          expected_date: draft.expected_date,
          status: draft.status,
        })
      ),
      asOfDate: "2026-07-02",
    });

    expect(first.inserts.map((item) => item.expected_date)).toEqual([
      "2026-07-31",
      "2026-08-31",
    ]);
    expect(second.inserts).toEqual([]);
  });

  it("RUL-REC-10: 0 a 2 días usa pendiente y desde 3 usa vencido", () => {
    expect(recurringDuePresentation("2026-07-10", "2026-07-10")).toMatchObject({
      state: "pending_confirmation",
      label: "Pago pendiente",
    });
    expect(recurringDuePresentation("2026-07-10", "2026-07-12")).toMatchObject({
      state: "pending_confirmation",
      label: "Pago pendiente",
    });
    expect(recurringDuePresentation("2026-07-10", "2026-07-13")).toMatchObject({
      state: "overdue",
      label: "Vencido",
    });
  });

  it("RUL-REC-11: el día se resuelve en America/Lima", () => {
    expect(isoDateInLima(new Date("2026-07-02T04:30:00Z"))).toBe("2026-07-01");
    expect(isoDateInLima(new Date("2026-07-02T05:30:00Z"))).toBe("2026-07-02");
  });
});

function rule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: overrides.id ?? "rule-1",
    user_id: overrides.user_id ?? "user-1",
    status: overrides.status ?? "active",
    name: overrides.name ?? "Internet",
    merchant_pattern: overrides.merchant_pattern ?? null,
    expected_amount: overrides.expected_amount ?? 89,
    amount_variability: overrides.amount_variability ?? "fixed",
    currency: overrides.currency ?? "PEN",
    frequency: overrides.frequency ?? "monthly",
    day_of_month: overrides.day_of_month ?? 1,
    date_window_start_day: overrides.date_window_start_day ?? null,
    date_window_end_day: overrides.date_window_end_day ?? null,
    next_expected_date: overrides.next_expected_date ?? "2026-07-01",
    category_id: overrides.category_id ?? null,
    subcategory_id: overrides.subcategory_id ?? null,
    default_account_id: overrides.default_account_id ?? null,
    linked_box_id: overrides.linked_box_id ?? null,
    linked_debt_id: overrides.linked_debt_id ?? null,
    source: overrides.source ?? "dashboard_manual",
    confidence: overrides.confidence ?? 1,
    requires_confirmation_for_payment:
      overrides.requires_confirmation_for_payment ?? true,
    last_paid_at: overrides.last_paid_at ?? null,
    last_paid_amount: overrides.last_paid_amount ?? null,
    metadata: overrides.metadata ?? {},
    created_at: overrides.created_at ?? "2026-07-01T00:00:00Z",
    updated_at: overrides.updated_at ?? "2026-07-01T00:00:00Z",
    deleted_at: overrides.deleted_at ?? null,
    cancelled_at: overrides.cancelled_at ?? null,
  };
}

function occurrence(
  overrides: Partial<RecurringOccurrence> = {}
): RecurringOccurrence {
  return {
    id: overrides.id ?? "occ-1",
    user_id: overrides.user_id ?? "user-1",
    recurring_rule_id: overrides.recurring_rule_id ?? "rule-1",
    expected_date: overrides.expected_date ?? "2026-07-01",
    expected_amount: overrides.expected_amount ?? 89,
    status: overrides.status ?? "expected",
    paid_at: overrides.paid_at ?? null,
    paid_movement_id: overrides.paid_movement_id ?? null,
    metadata: overrides.metadata ?? {},
    created_at: overrides.created_at ?? "2026-07-01T00:00:00Z",
    updated_at: overrides.updated_at ?? "2026-07-01T00:00:00Z",
  };
}
