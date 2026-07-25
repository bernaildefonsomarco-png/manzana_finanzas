import { describe, expect, it } from "vitest";
import type { RecurringCandidate } from "@/shared/types/domain";
import type {
  DebtInstallmentCommitment,
  RecurringRuleWithOccurrences,
} from "./upcoming-types";
import {
  filterRulesCoveredByDebtInstallments,
  formatUpcomingMoney,
  summarizeUpcoming,
  toDebtInstallmentViewItem,
  toDebtInstallmentViewItems,
  toRecurringDetailViewModel,
  toSuggestedCandidateViewModel,
  toUpcomingViewItem,
  toUpcomingViewItems,
} from "./upcoming-view-model";

describe("upcoming view model", () => {
  it("marca como vencido un pago activo con fecha pasada sin tocar su regla", () => {
    const item = toUpcomingViewItem(
      recurringRule({
        next_expected_date: "2026-06-10",
        occurrences: [
          {
            ...occurrence("2026-06-10"),
            status: "expected",
          },
        ],
      }),
      new Date("2026-06-29T12:00:00Z")
    );

    expect(item.group).toBe("overdue");
    expect(item.status_label).toBe("Vencido");
    expect(item.can_mark_paid).toBe(true);
  });

  it("calcula el estimado mensual equivalente por frecuencia", () => {
    const summary = summarizeUpcoming({
      rules: [
        recurringRule({ expected_amount: 100, frequency: "monthly" }),
        recurringRule({ expected_amount: 10, frequency: "weekly" }),
        recurringRule({ expected_amount: 120, frequency: "yearly" }),
        recurringRule({ expected_amount: 200, status: "paused" }),
      ],
      candidates: [],
      today: new Date("2026-06-30T12:00:00Z"),
    });

    expect(summary.active_count).toBe(3);
    expect(summary.paused_count).toBe(1);
    expect(summary.monthly_estimate).toBe(153.3);
  });

  it("suma cuotas de deuda a compromisos y evita duplicar una regla vinculada", () => {
    const debtInstallment = installmentCommitment();
    const linkedRule = recurringRule({
      id: "99999999-9999-4999-8999-999999999999",
      linked_debt_id: debtInstallment.debt_id,
      expected_amount: 100,
    });
    const rules = [recurringRule({ expected_amount: 80 }), linkedRule];

    const visibleRules = filterRulesCoveredByDebtInstallments(rules, [
      debtInstallment,
    ]);
    const summary = summarizeUpcoming({
      rules,
      candidates: [],
      debt_installments: [debtInstallment],
      today: new Date("2026-06-30T12:00:00Z"),
    });

    expect(visibleRules.map((rule) => rule.id)).toEqual([
      "11111111-1111-4111-8111-111111111111",
    ]);
    expect(summary.active_count).toBe(2);
    expect(summary.monthly_estimate).toBe(180);
  });

  it("presenta una cuota vencida como lectura y no como pago directo", () => {
    const item = toDebtInstallmentViewItem(
      installmentCommitment({ due_at: "2026-06-29" }),
      new Date("2026-06-30T12:00:00Z")
    );

    expect(item.title).toBe("Cuota 1: Juan");
    expect(item.status_label).toBe("Vencida");
    expect(item.status_tone).toBe("warning");
    expect(item.due_label).toBe("Ayer");
    expect(item.debt_id).toBe("66666666-6666-4666-8666-666666666666");
    expect(item.can_register_payment).toBe(false);
    expect(item.payment_action_label).toBe("Registrar pago");
    expect(
      toDebtInstallmentViewItem(
        installmentCommitment({ direction: "they_owe_me" })
      ).payment_action_label
    ).toBe("Registrar cobro");
  });

  it("solo permite registrar pago en la cuota abierta mas antigua de cada deuda", () => {
    const items = toDebtInstallmentViewItems([
      installmentCommitment({
        id: "installment-2",
        installment_id: "installment-2",
        due_at: "2026-08-15",
        title: "Cuota 2: Juan",
      }),
      installmentCommitment({
        id: "installment-1",
        installment_id: "installment-1",
        due_at: "2026-07-15",
        title: "Cuota 1: Juan",
      }),
    ]);

    expect(items.map((item) => item.installment_id)).toEqual([
      "installment-1",
      "installment-2",
    ]);
    expect(items.map((item) => item.can_register_payment)).toEqual([
      true,
      false,
    ]);
  });

  it("muestra una ocurrencia pagada y conserva la proxima abierta", () => {
    const items = toUpcomingViewItems(
      recurringRule({
        next_expected_date: "2026-07-29",
        occurrences: [
          {
            ...occurrence("2026-06-29"),
            status: "paid",
            paid_at: "2026-06-29T15:00:00.000Z",
            paid_movement_id: "44444444-4444-4444-8444-444444444444",
          },
          occurrence("2026-07-29"),
        ],
      }),
      new Date("2026-06-29T16:00:00Z")
    );

    expect(items.map((item) => item.group)).toEqual(["paid", "active"]);
    expect(items[0].status_label).toBe("Pagado");
    expect(items[0].can_mark_paid).toBe(false);
    expect(items[0].payment_action_label).toBe("Pagado");
    expect(items[1].due_at).toBe("2026-07-29");
    expect(items[1].is_future).toBe(true);
    expect(items[1].can_mark_paid).toBe(true);
    expect(items[1].payment_action_label).toBe("Pagar adelantado");
  });

  it("prepara detalle con proxima ocurrencia e historial pagado", () => {
    const detail = toRecurringDetailViewModel(
      recurringRule({
        next_expected_date: "2026-07-29",
        occurrences: [
          {
            ...occurrence("2026-06-29"),
            status: "paid",
            paid_at: "2026-06-29T15:00:00.000Z",
            paid_movement_id: "44444444-4444-4444-8444-444444444444",
          },
          {
            ...occurrence("2026-07-29"),
            id: "77777777-7777-4777-8777-777777777777",
            status: "expected",
          },
        ],
      }),
      new Date("2026-06-29T16:00:00Z")
    );

    expect(detail.title).toBe("Internet");
    expect(detail.status_label).toBe("Activo");
    expect(detail.next_due_at).toBe("2026-07-29");
    expect(detail.last_paid_label).toBe("Pagado hoy");
    expect(detail.timeline.map((item) => item.status_label)).toEqual([
      "Esperado",
      "Pagado",
    ]);
    expect(detail.timeline[0].can_mark_paid).toBe(true);
    expect(detail.timeline[1].can_mark_paid).toBe(false);
  });

  it("bloquea pago desde recurrentes cuando la regla esta ligada a deuda", () => {
    const item = toUpcomingViewItem(
      recurringRule({
        linked_debt_id: "88888888-8888-4888-8888-888888888888",
      }),
      new Date("2026-06-29T16:00:00Z")
    );
    const detail = toRecurringDetailViewModel(
      item.rule,
      new Date("2026-06-29T16:00:00Z")
    );

    expect(item.can_mark_paid).toBe(false);
    expect(detail.linked_debt).toBe(true);
    expect(detail.timeline[0].can_mark_paid).toBe(false);
  });

  it("formatea montos con simbolo local", () => {
    expect(formatUpcomingMoney(45, "PEN")).toBe("S/ 45");
    expect(formatUpcomingMoney(12.5, "USD")).toBe("$ 12.50");
  });

  it("prepara una sugerencia desde evidence del detector", () => {
    const view = toSuggestedCandidateViewModel(
      recurringCandidate(),
      new Date("2026-06-29T12:00:00Z")
    );

    expect(view.title).toBe("Netflix");
    expect(view.amount_label).toBe("S/ 15");
    expect(view.frequency_label).toBe("Cada mes");
    expect(view.next_expected_date).toBe("2026-07-05");
    expect(view.category_label).toBe("Servicios / Suscripciones");
    expect(view.confidence_label).toBe("Coincidencia sólida");
  });
});

function recurringRule(
  overrides: Partial<RecurringRuleWithOccurrences> = {}
): RecurringRuleWithOccurrences {
  return {
    id: overrides.id ?? "11111111-1111-4111-8111-111111111111",
    user_id: "22222222-2222-4222-8222-222222222222",
    status: overrides.status ?? "active",
    name: overrides.name ?? "Internet",
    merchant_pattern: null,
    expected_amount: overrides.expected_amount ?? 80,
    amount_variability: overrides.amount_variability ?? "fixed",
    currency: overrides.currency ?? "PEN",
    frequency: overrides.frequency ?? "monthly",
    day_of_month: 15,
    date_window_start_day: null,
    date_window_end_day: null,
    next_expected_date: overrides.next_expected_date ?? "2026-07-15",
    category_id: overrides.category_id ?? "servicios_suscripciones",
    subcategory_id: null,
    default_account_id: null,
    linked_box_id: overrides.linked_box_id ?? null,
    linked_debt_id: overrides.linked_debt_id ?? null,
    source: "dashboard_manual",
    confidence: 1,
    requires_confirmation_for_payment: true,
    last_paid_at: null,
    last_paid_amount: null,
    metadata: {},
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    deleted_at: null,
    cancelled_at: null,
    occurrences: overrides.occurrences ?? [occurrence(overrides.next_expected_date ?? "2026-07-15")],
  };
}

function occurrence(expectedDate: string) {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    user_id: "22222222-2222-4222-8222-222222222222",
    recurring_rule_id: "11111111-1111-4111-8111-111111111111",
    expected_date: expectedDate,
    expected_amount: 80,
    status: "expected" as const,
    paid_at: null,
    paid_movement_id: null,
    metadata: {},
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
  };
}

function recurringCandidate(): RecurringCandidate {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    user_id: "22222222-2222-4222-8222-222222222222",
    merchant_key: "netflix",
    category_id: "servicios_suscripciones",
    evidence: {
      display_name: "Netflix",
      inferred_amount: 15,
      currency: "PEN",
      inferred_frequency: "monthly",
      amount_variability: "fixed",
      next_expected_date: "2026-07-05",
      movement_count: 3,
      category_id: "servicios_suscripciones",
    },
    confidence: 0.9,
    status: "ready_to_suggest",
    metadata: {},
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
  };
}

function installmentCommitment(
  overrides: Partial<DebtInstallmentCommitment> = {}
): DebtInstallmentCommitment {
  return {
    id: overrides.id ?? "77777777-7777-4777-8777-777777777777",
    title: overrides.title ?? "Cuota 1: Juan",
    amount: overrides.amount ?? 100,
    currency: overrides.currency ?? "PEN",
    direction: overrides.direction ?? "i_owe",
    due_at: overrides.due_at ?? "2026-07-15",
    kind: "debt",
    linked_box_id: null,
    debt_id:
      overrides.debt_id ?? "66666666-6666-4666-8666-666666666666",
    installment_id:
      overrides.installment_id ?? "77777777-7777-4777-8777-777777777777",
  };
}
