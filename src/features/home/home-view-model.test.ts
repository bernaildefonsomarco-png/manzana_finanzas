import { describe, expect, it } from "vitest";
import type { HomeDashboardSummary } from "./home-types";
import {
  getHomePrimaryState,
  getMoneyExplanation,
  getPendingTone,
  getSuggestedAction,
} from "./home-view-model";

const baseSummary: HomeDashboardSummary = {
  money_summary: null,
  pending_summary: {
    active_count: 0,
    needs_completion_count: 0,
    high_risk_count: 0,
  },
  recent_movements: [],
  next_commitments: [],
  dashboard_nudges: [],
  featured_insight: null,
  suggested_action: null,
  data_quality: {
    confirmed_movements_count: 0,
    movements_without_account_count: 0,
    has_accounts: false,
    message: "Sin cuentas configuradas.",
  },
  onboarding: {
    persisted_status: "not_started",
    effective_status: "not_started",
    stage: "registered_without_use",
    first_value_kind: null,
    show_initial_prompt: true,
    show_first_value_tip: false,
  },
};

describe("home view model", () => {
  it("prioriza el primer registro sin exigir una cuenta", () => {
    expect(getHomePrimaryState(baseSummary)).toBe("initial_action");
    expect(getMoneyExplanation(baseSummary.money_summary)).toContain(
      "falta crear al menos una cuenta"
    );
    expect(getSuggestedAction(baseSummary)).toMatchObject({
      target_view: "movements",
      label: "Registrar primer movimiento",
    });
  });

  it("prioritizes pending review when financial context exists", () => {
    const summary: HomeDashboardSummary = {
      ...baseSummary,
      money_summary: {
        total_balance: 800,
        separated_balance: 580,
        free_balance: 220,
        currency: "PEN",
        account_count: 1,
        box_count: 2,
      },
      pending_summary: {
        active_count: 2,
        needs_completion_count: 1,
        high_risk_count: 0,
      },
    };

    expect(getHomePrimaryState(summary)).toBe("needs_pending_review");
    expect(getPendingTone(summary.pending_summary).title).toBe("2 por revisar");
    expect(getSuggestedAction(summary)?.target_view).toBe("pending");
  });
});
