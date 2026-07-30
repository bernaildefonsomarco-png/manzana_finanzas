import { describe, expect, it } from "vitest";
import type {
  RecurringCandidate,
  RecurringOccurrence,
  RecurringRule,
} from "@/shared/types/domain";
import type {
  RecurringRuleWithOccurrences,
  UpcomingApiResponse,
  UpcomingCommitment,
} from "./upcoming-types";
import {
  buildUpcomingViewModel,
  formatUpcomingMoney,
  frequencyLabels,
  toSuggestedCandidateViewModel,
} from "./upcoming-view-model";

const TODAY = "2026-07-29";

function occurrence(
  overrides: Partial<RecurringOccurrence> = {}
): RecurringOccurrence {
  return {
    id: "occ-1",
    user_id: "user-1",
    recurring_rule_id: "rule-1",
    expected_date: "2026-07-30",
    expected_amount: 49.9,
    status: "due_soon",
    paid_at: null,
    paid_movement_id: null,
    metadata: {},
    created_at: "2026-07-01T05:00:00.000Z",
    updated_at: "2026-07-01T05:00:00.000Z",
    ...overrides,
  };
}

function rule(
  overrides: Partial<RecurringRule> & {
    occurrences?: RecurringOccurrence[];
  } = {}
): RecurringRuleWithOccurrences {
  const { occurrences = [occurrence()], ...ruleOverrides } = overrides;
  return {
    id: "rule-1",
    user_id: "user-1",
    status: "active",
    name: "Internet hogar",
    merchant_pattern: "internet",
    expected_amount: 49.9,
    amount_variability: "fixed",
    currency: "PEN",
    frequency: "monthly",
    day_of_month: 30,
    date_window_start_day: null,
    date_window_end_day: null,
    next_expected_date: "2026-07-30",
    category_id: "servicios_suscripciones",
    subcategory_id: null,
    default_account_id: "account-1",
    linked_box_id: null,
    linked_debt_id: null,
    source: "manual",
    confidence: null,
    requires_confirmation_for_payment: true,
    last_paid_at: null,
    last_paid_amount: null,
    metadata: {},
    created_at: "2026-07-01T05:00:00.000Z",
    updated_at: "2026-07-01T05:00:00.000Z",
    deleted_at: null,
    cancelled_at: null,
    ...ruleOverrides,
    occurrences,
  };
}

function commitment(
  overrides: Partial<UpcomingCommitment> = {}
): UpcomingCommitment {
  return {
    id: "commitment-1",
    title: "Internet hogar",
    amount: 49.9,
    currency: "PEN",
    due_at: "2026-07-30",
    kind: "recurring",
    linked_box_id: null,
    recurring_rule_id: "rule-1",
    occurrence_id: "occ-1",
    presentation_state: "upcoming",
    presentation_label: "Próximo",
    days_late: -1,
    ...overrides,
  };
}

function candidate(
  overrides: Partial<RecurringCandidate> = {}
): RecurringCandidate {
  return {
    id: "candidate-1",
    user_id: "user-1",
    merchant_key: "netflix",
    category_id: "servicios_suscripciones",
    evidence: {
      display_name: "Netflix",
      movement_count: 3,
      dates: ["2026-05-12", "2026-06-12", "2026-07-12"],
      amounts: [44.9, 44.9, 44.9],
      inferred_amount: 44.9,
      inferred_frequency: "monthly",
      amount_variability: "fixed",
      currency: "PEN",
      next_expected_date: "2026-08-12",
    },
    confidence: 0.97,
    status: "ready_to_suggest",
    metadata: {},
    created_at: "2026-07-29T05:00:00.000Z",
    updated_at: "2026-07-29T05:00:00.000Z",
    ...overrides,
  };
}

function response(
  overrides: Partial<UpcomingApiResponse> = {}
): UpcomingApiResponse {
  return {
    commitments: [commitment()],
    recurring_rules: [rule()],
    candidates: [],
    horizon_days: 30,
    timezone: "America/Lima",
    ...overrides,
  };
}

describe("buildUpcomingViewModel", () => {
  it("agrupa los próximos siete días en Esta semana y el resto en Más adelante", () => {
    const view = buildUpcomingViewModel(
      response({
        commitments: [
          commitment({ id: "tomorrow", due_at: "2026-07-30" }),
          commitment({
            id: "later",
            due_at: "2026-08-10",
            occurrence_id: "occ-2",
          }),
        ],
      }),
      TODAY
    );

    expect(view.sections.this_week.map((item) => item.id)).toEqual([
      "tomorrow",
    ]);
    expect(view.sections.later.map((item) => item.id)).toEqual(["later"]);
  });

  it("mantiene 0–2 días de atraso como Pendiente y alerta recién desde el día 3", () => {
    const view = buildUpcomingViewModel(
      response({
        commitments: [
          commitment({
            id: "two-days",
            due_at: "2026-07-27",
            presentation_state: "pending_confirmation",
          }),
          commitment({
            id: "three-days",
            due_at: "2026-07-26",
            occurrence_id: "occ-2",
            presentation_state: "overdue",
          }),
        ],
      }),
      TODAY
    );

    expect(view.sections.pending).toEqual([
      expect.objectContaining({
        id: "three-days",
        status_label: "Vencido",
        alert: true,
      }),
      expect.objectContaining({
        id: "two-days",
        status_label: "Pendiente",
        alert: false,
      }),
    ]);
  });

  it("no llama vencida a una fecha aproximada aunque lleve tres días", () => {
    const approximateRule = rule({
      metadata: { date_is_approximate: true },
    });
    const view = buildUpcomingViewModel(
      response({
        recurring_rules: [approximateRule],
        commitments: [
          commitment({
            due_at: "2026-07-20",
            presentation_state: "overdue",
          }),
        ],
      }),
      TODAY
    );

    expect(view.sections.pending[0]).toMatchObject({
      status_label: "Pendiente",
      alert: false,
    });
  });

  it("usa lenguaje prudente para deuda y excluye they_owe_me defensivamente", () => {
    const view = buildUpcomingViewModel(
      response({
        recurring_rules: [],
        commitments: [
          commitment({
            id: "debt-i-owe",
            title: "Cuota préstamo",
            kind: "debt",
            direction: "i_owe",
            debt_id: "debt-1",
            installment_id: "installment-1",
            recurring_rule_id: undefined,
            occurrence_id: undefined,
            due_at: "2026-07-01",
          }),
          commitment({
            id: "debt-they-owe",
            kind: "debt",
            direction: "they_owe_me",
            debt_id: "debt-2",
            recurring_rule_id: undefined,
            occurrence_id: undefined,
          }),
        ],
      }),
      TODAY
    );

    expect(view.sections.pending).toEqual([
      expect.objectContaining({
        id: "debt-i-owe",
        status_label: "Pendiente",
        alert: false,
        can_mark_paid: false,
      }),
    ]);
    expect(view.calendar_items).toHaveLength(1);
  });

  it("WEB-D207: deuda bancaria vence al día 3, pero acuerdo personal o fecha aproximada siguen pendientes", () => {
    const view = buildUpcomingViewModel(
      response({
        recurring_rules: [],
        commitments: [
          commitment({
            id: "bank-two-days",
            kind: "debt",
            direction: "i_owe",
            debt_id: "debt-bank-two",
            installment_id: "installment-bank-two",
            recurring_rule_id: undefined,
            occurrence_id: undefined,
            due_at: "2026-07-27",
            debt_kind: "bank_loan",
            date_is_approximate: false,
          } as Partial<UpcomingCommitment>),
          commitment({
            id: "bank-three-days",
            kind: "debt",
            direction: "i_owe",
            debt_id: "debt-bank-three",
            installment_id: "installment-bank-three",
            recurring_rule_id: undefined,
            occurrence_id: undefined,
            due_at: "2026-07-26",
            debt_kind: "bank_loan",
            date_is_approximate: false,
          } as Partial<UpcomingCommitment>),
          commitment({
            id: "personal-nine-days",
            kind: "debt",
            direction: "i_owe",
            debt_id: "debt-personal",
            installment_id: "installment-personal",
            recurring_rule_id: undefined,
            occurrence_id: undefined,
            due_at: "2026-07-20",
            debt_kind: "personal",
            date_is_approximate: false,
          } as Partial<UpcomingCommitment>),
          commitment({
            id: "approximate-nine-days",
            kind: "debt",
            direction: "i_owe",
            debt_id: "debt-approximate",
            installment_id: "installment-approximate",
            recurring_rule_id: undefined,
            occurrence_id: undefined,
            due_at: "2026-07-20",
            debt_kind: "installment_purchase",
            date_is_approximate: true,
          } as Partial<UpcomingCommitment>),
        ],
      }),
      TODAY
    );

    expect(view.sections.pending).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "bank-two-days",
          status_label: "Pendiente",
          alert: false,
        }),
        expect.objectContaining({
          id: "bank-three-days",
          status_label: "Vencido",
          alert: true,
        }),
        expect.objectContaining({
          id: "personal-nine-days",
          status_label: "Pendiente",
          alert: false,
        }),
        expect.objectContaining({
          id: "approximate-nine-days",
          status_label: "Pendiente",
          alert: false,
        }),
      ])
    );
  });

  it("muestra la vinculación a caja sin inventar cobertura", () => {
    const view = buildUpcomingViewModel(
      response({
        commitments: [
          commitment({ linked_box_id: "box-1", amount: 100 }),
        ],
      }),
      TODAY
    );

    expect(view.sections.this_week[0].linked_box_label).toBe(
      "Vinculado a una caja"
    );
    expect(
      JSON.stringify(view.sections.this_week[0]).toLowerCase()
    ).not.toContain("cubiert");
    expect(view.summary.linked_box_count).toBe(1);
  });

  it("mantiene visibles las reglas pausadas sin volverlas pendientes", () => {
    const paused = rule({
      id: "rule-paused",
      name: "Gimnasio",
      status: "paused",
      occurrences: [
        occurrence({
          id: "occ-paused",
          recurring_rule_id: "rule-paused",
        }),
      ],
    });
    const view = buildUpcomingViewModel(
      response({
        commitments: [],
        recurring_rules: [paused],
      }),
      TODAY
    );

    expect(view.sections.later[0]).toMatchObject({
      title: "Gimnasio",
      status_label: "Pausado",
      can_resume: true,
      can_mark_paid: false,
    });
  });

  it("muestra un pago variable sin estimación sin descontarlo ni inventar monto", () => {
    const variableRule = rule({
      id: "rule-variable",
      name: "Luz",
      expected_amount: null,
      amount_variability: "variable",
      next_expected_date: "2026-08-02",
      occurrences: [
        occurrence({
          id: "occ-variable",
          recurring_rule_id: "rule-variable",
          expected_date: "2026-08-02",
          expected_amount: null,
        }),
      ],
    });
    const view = buildUpcomingViewModel(
      response({
        commitments: [],
        recurring_rules: [variableRule],
      }),
      TODAY
    );

    expect(view.sections.this_week[0]).toMatchObject({
      title: "Luz",
      amount: null,
      status_label: "Monto por revisar",
      can_mark_paid: true,
    });
    expect(view.summary.month_totals.PEN).toBe(0);
  });

  it("no suma dólares y soles como si fueran la misma moneda", () => {
    const view = buildUpcomingViewModel(
      response({
        commitments: [
          commitment({ id: "pen", amount: 100, currency: "PEN" }),
          commitment({
            id: "usd",
            amount: 20,
            currency: "USD",
            occurrence_id: "occ-usd",
          }),
        ],
      }),
      TODAY
    );

    expect(view.summary.month_totals).toEqual({ PEN: 100, USD: 20 });
  });
});

describe("sugerencias recurrentes", () => {
  it("explica fechas y montos concretos sin exponer confidence", () => {
    const view = toSuggestedCandidateViewModel(candidate(), TODAY);

    expect(view.evidence_label).toContain("12 may");
    expect(view.evidence_label).toContain("12 jun");
    expect(view.evidence_label).toContain("12 jul");
    expect(view.evidence_label).toContain("S/44.90");
    expect(JSON.stringify(view)).not.toContain("confidence");
    expect(JSON.stringify(view)).not.toContain("0.97");
  });

  it("presenta biweekly como una cadencia exacta de 14 días", () => {
    expect(frequencyLabels.biweekly).toBe("Cada 14 días");
  });
});

describe("formato monetario", () => {
  it("formatea PEN y USD desde montos decimales", () => {
    expect(formatUpcomingMoney(1250.5, "PEN")).toBe("S/1,250.50");
    expect(formatUpcomingMoney(12.5, "USD")).toBe("$12.50");
  });
});
