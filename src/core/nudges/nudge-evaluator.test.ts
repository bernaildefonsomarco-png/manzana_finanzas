import { describe, expect, it } from "vitest";
import {
  buildDebtDashboardNudgeDrafts,
  buildLifecycleNudgeDrafts,
  buildRecurringDashboardNudgeDrafts,
} from "./nudge-evaluator";
import type { NudgeEvaluationRule } from "./nudge-evaluator";

const baseRule: NudgeEvaluationRule = {
  id: "rule-1",
  user_id: "user-1",
  status: "active",
  name: "Internet",
  merchant_pattern: "internet",
  expected_amount: 100,
  amount_variability: "fixed",
  currency: "PEN",
  frequency: "monthly",
  day_of_month: 29,
  date_window_start_day: null,
  date_window_end_day: null,
  next_expected_date: "2026-06-29",
  category_id: "servicios_suscripciones",
  subcategory_id: null,
  default_account_id: null,
  linked_box_id: null,
  linked_debt_id: null,
  source: "dashboard_manual",
  confidence: 1,
  requires_confirmation_for_payment: true,
  last_paid_at: null,
  last_paid_amount: null,
  metadata: {},
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-01T00:00:00.000Z",
  deleted_at: null,
  cancelled_at: null,
  occurrences: [
    {
      id: "occ-1",
      user_id: "user-1",
      recurring_rule_id: "rule-1",
      expected_date: "2026-06-29",
      expected_amount: 100,
      status: "expected",
      paid_at: null,
      paid_movement_id: null,
      metadata: {},
      created_at: "2026-06-01T00:00:00.000Z",
      updated_at: "2026-06-01T00:00:00.000Z",
    },
  ],
};

describe("dashboard nudge evaluator", () => {
  it("crea aviso dashboard para pago recurrente proximo", () => {
    const drafts = buildRecurringDashboardNudgeDrafts({
      rules: [baseRule],
      now: new Date("2026-06-27T15:00:00.000Z"),
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      type: "payment_due",
      sourceEntityType: "recurring_occurrence",
      sourceEntityId: "occ-1",
      riskLevel: "low",
    });
    expect(drafts[0].metadata.title).toBe("Internet vence pronto");
    expect(drafts[0].metadata.target_view).toBe("upcoming");
  });

  it("prioriza pagos vencidos sin tocar ocurrencias pagadas", () => {
    const drafts = buildRecurringDashboardNudgeDrafts({
      rules: [
        {
          ...baseRule,
          occurrences: [
            {
              ...baseRule.occurrences[0],
              id: "occ-overdue",
              expected_date: "2026-06-20",
              status: "expected",
            },
            {
              ...baseRule.occurrences[0],
              id: "occ-paid",
              expected_date: "2026-06-29",
              status: "paid",
              paid_at: "2026-06-28T12:00:00.000Z",
              paid_movement_id: "11111111-1111-4111-8111-111111111111",
            },
          ],
        },
      ],
      now: new Date("2026-06-29T15:00:00.000Z"),
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0].type).toBe("overdue_payment");
    expect(drafts[0].sourceEntityId).toBe("occ-overdue");
    expect(drafts[0].riskLevel).toBe("medium");
  });

  it("omite deuda vinculada y fechas fuera del horizonte", () => {
    const drafts = buildRecurringDashboardNudgeDrafts({
      rules: [
        {
          ...baseRule,
          linked_debt_id: "22222222-2222-4222-8222-222222222222",
        },
        {
          ...baseRule,
          id: "rule-later",
          occurrences: [
            {
              ...baseRule.occurrences[0],
              id: "occ-later",
              recurring_rule_id: "rule-later",
              expected_date: "2026-07-20",
            },
          ],
        },
      ],
      now: new Date("2026-06-29T15:00:00.000Z"),
    });

    expect(drafts).toHaveLength(0);
  });

  it("crea un aviso sensible para la cuota abierta mas antigua de cada deuda", () => {
    const drafts = buildDebtDashboardNudgeDrafts({
      installments: [
        {
          id: "installment-2",
          debt_id: "debt-1",
          debt_name: "Laptop",
          installment_number: 2,
          amount: 50,
          currency: "PEN",
          direction: "i_owe",
          due_date: "2026-07-02",
        },
        {
          id: "installment-1",
          debt_id: "debt-1",
          debt_name: "Laptop",
          installment_number: 1,
          amount: 50,
          currency: "PEN",
          direction: "i_owe",
          due_date: "2026-07-01",
        },
      ],
      now: new Date("2026-07-01T15:00:00.000Z"),
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      type: "debt_due",
      sourceEntityType: "debt_installment",
      sourceEntityId: "installment-1",
      riskLevel: "sensitive",
    });
    expect(drafts[0].metadata).toMatchObject({
      title: "Tienes una cuota proxima",
      evidence: "Es hoy",
      target_view: "debts",
      debt_id: "debt-1",
    });
  });

  it("adapta el aviso de cobro y prioriza cuotas vencidas", () => {
    const drafts = buildDebtDashboardNudgeDrafts({
      installments: [
        {
          id: "installment-overdue",
          debt_id: "debt-2",
          debt_name: "Prestamo a Juan",
          installment_number: 1,
          amount: 80,
          currency: "PEN",
          direction: "they_owe_me",
          due_date: "2026-06-28",
        },
      ],
      now: new Date("2026-07-01T15:00:00.000Z"),
    });

    expect(drafts[0].priority).toBeGreaterThanOrEqual(92);
    expect(drafts[0].metadata.title).toBe("Hay un cobro pendiente");
    expect(drafts[0].metadata.action_label).toBe("Ver cobro");
  });

  it("agrupa varios pendientes en un solo candidato sin tocar saldos", () => {
    const drafts = buildLifecycleNudgeDrafts({
      signals: lifecycleSignals({
        pendingCount: 3,
        emailPendingCount: 2,
        oldestPendingId: "11111111-1111-4111-8111-111111111111",
      }),
      now: new Date("2026-07-18T15:00:00.000Z"),
    });

    expect(drafts.filter((draft) => draft.type === "pending_review")).toHaveLength(1);
    expect(drafts.find((draft) => draft.type === "pending_review")).toMatchObject({
      sourceEntityType: "pending_batch",
      priority: 88,
      metadata: {
        pending_count: 3,
        email_pending_count: 2,
        target_view: "pending",
      },
    });
  });

  it("marca lotes con backfill como exclusivos de Dashboard", () => {
    const draft = buildLifecycleNudgeDrafts({
      signals: lifecycleSignals({
        pendingCount: 2,
        backfillPendingCount: 1,
        oldestPendingId: "11111111-1111-4111-8111-111111111111",
      }),
      now: new Date("2026-07-18T15:00:00.000Z"),
    }).find((item) => item.type === "pending_review");

    expect(draft?.metadata).toMatchObject({
      backfill_pending_count: 1,
      delivery_channel: "dashboard_only",
    });
  });

  it("crea resumen semanal solo con actividad suficiente", () => {
    const drafts = buildLifecycleNudgeDrafts({
      signals: lifecycleSignals({ movementCountLast7Days: 5 }),
      now: new Date("2026-07-18T15:00:00.000Z"),
    });

    expect(drafts.find((draft) => draft.type === "weekly_review")).toMatchObject({
      sourceEntityType: "lifecycle_weekly",
      metadata: { movement_count: 5, minimum_movement_count: 5 },
    });
  });

  it.each([
    ["actividad suficiente", { movementCountToday: 2 }],
    ["pendientes abiertos", { pendingCount: 1 }],
    ["mensaje del usuario hoy", { lastUserMessageAt: "2026-07-19T00:15:00.000Z" }],
  ])("suprime reconstruccion diaria por %s", (_reason, overrides) => {
    const drafts = buildLifecycleNudgeDrafts({
      signals: lifecycleSignals({
        movementCountLast7Days: 3,
        ...overrides,
      }),
      now: new Date("2026-07-19T01:00:00.000Z"),
      timezone: "America/Lima",
    });

    expect(drafts.some((draft) => draft.type === "daily_reconstruction")).toBe(false);
  });

  it("mantiene inactividad corta en dashboard y habilita una reentrada posterior", () => {
    const quietDrafts = buildLifecycleNudgeDrafts({
      signals: lifecycleSignals({ lastActivityAt: "2026-07-15T15:00:00.000Z" }),
      now: new Date("2026-07-18T15:00:00.000Z"),
    });
    const atRiskDrafts = buildLifecycleNudgeDrafts({
      signals: lifecycleSignals({ lastActivityAt: "2026-07-08T15:00:00.000Z" }),
      now: new Date("2026-07-18T15:00:00.000Z"),
    });
    const dormantDrafts = buildLifecycleNudgeDrafts({
      signals: lifecycleSignals({ lastActivityAt: "2026-06-28T15:00:00.000Z" }),
      now: new Date("2026-07-18T15:00:00.000Z"),
    });

    expect(quietDrafts.find((draft) => draft.type === "missing_activity")?.priority).toBe(42);
    expect(atRiskDrafts.find((draft) => draft.type === "reengagement")).toMatchObject({
      priority: 60,
      metadata: { lifecycle_state: "at_risk", inactivity_days: 10 },
    });
    expect(dormantDrafts.find((draft) => draft.type === "reengagement")).toMatchObject({
      priority: 45,
      metadata: { lifecycle_state: "dormant", inactivity_days: 20 },
    });
  });
});

function lifecycleSignals(
  overrides: Partial<Parameters<typeof buildLifecycleNudgeDrafts>[0]["signals"]> = {},
): Parameters<typeof buildLifecycleNudgeDrafts>[0]["signals"] {
  return {
    userId: "11111111-1111-4111-8111-111111111111",
    movementCountToday: 0,
    movementCountLast7Days: 0,
    pendingCount: 0,
    emailPendingCount: 0,
    backfillPendingCount: 0,
    oldestPendingId: null,
    lastActivityAt: null,
    lastUserMessageAt: null,
    sourceIds: {
      daily: "22222222-2222-4222-8222-222222222222",
      weekly: "33333333-3333-4333-8333-333333333333",
      inactivity: "44444444-4444-4444-8444-444444444444",
    },
    ...overrides,
  };
}
