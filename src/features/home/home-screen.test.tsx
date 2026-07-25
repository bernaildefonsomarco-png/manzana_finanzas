import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeScreen } from "./home-screen";

const mocks = vi.hoisted(() => ({
  dismissHomeNudge: vi.fn(),
  getHomeDashboard: vi.fn(),
  startDashboardOnboarding: vi.fn(),
}));

vi.mock("./home-api", () => ({
  dismissHomeNudge: mocks.dismissHomeNudge,
  getHomeDashboard: mocks.getHomeDashboard,
}));
vi.mock("@/features/onboarding/onboarding-api", () => ({
  startDashboardOnboarding: mocks.startDashboardOnboarding,
}));

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getHomeDashboard.mockResolvedValue({
    money_summary: null,
    pending_summary: {
      active_count: 0,
      needs_completion_count: 0,
      high_risk_count: 0,
    },
    recent_movements: [],
    next_commitments: [],
    dashboard_nudges: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        type: "debt_due",
        title: "Tienes una cuota proxima",
        body: "Puedes revisar la cuota y registrar el pago cuando ocurra.",
        evidence: "Es hoy",
        action_label: "Ver cuota",
        target_view: "debts",
        priority: 84,
        scheduled_for: "2026-07-01T13:15:00.000Z",
        debt_id: "11111111-1111-4111-8111-111111111111",
        installment_id: "22222222-2222-4222-8222-222222222222",
      },
    ],
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
  });
  mocks.startDashboardOnboarding.mockResolvedValue({
    transition: {
      changed: true,
      previous_status: "not_started",
      current_status: "started",
      reason: "advanced",
    },
    onboarding: {
      persisted_status: "started",
      effective_status: "started",
      stage: "onboarding_started",
      first_value_kind: null,
      show_initial_prompt: true,
      show_first_value_tip: false,
    },
  });
});

describe("home debt nudge", () => {
  it("abre la cuota exacta mediante el intent seguro de Deudas", async () => {
    const onOpenDebt = vi.fn();
    render(<HomeScreen onOpenDebt={onOpenDebt} />);

    fireEvent.click(await screen.findByRole("button", { name: "Ver cuota" }));

    expect(onOpenDebt).toHaveBeenCalledWith({
      debtId: "11111111-1111-4111-8111-111111111111",
      installmentId: "22222222-2222-4222-8222-222222222222",
      action: "detail",
    });
  });
});

describe("home onboarding inicial", () => {
  it("prioriza una accion real y persiste started antes de navegar", async () => {
    const onNavigate = vi.fn();
    render(<HomeScreen onNavigate={onNavigate} />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Registrar primer movimiento",
      })
    );

    await waitFor(() => {
      expect(mocks.startDashboardOnboarding).toHaveBeenCalledTimes(1);
      expect(onNavigate).toHaveBeenCalledWith("movements");
    });
    expect(screen.queryByText("Crear primera cuenta")).not.toBeInTheDocument();
  });
});
