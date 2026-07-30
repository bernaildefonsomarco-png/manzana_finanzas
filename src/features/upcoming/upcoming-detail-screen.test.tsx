import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpcomingDetailScreen } from "./upcoming-detail-screen";

const mocks = vi.hoisted(() => ({
  getRecurringRule: vi.fn(),
  listRecurringOccurrences: vi.fn(),
}));

vi.mock("./upcoming-api", () => mocks);
vi.mock("@/features/app-shell/app-shell", () => ({
  AppShell: ({
    title,
    children,
  }: {
    title: string;
    children: ReactNode;
  }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}));
vi.mock("@/shared/privacy/discreet-mode-context", () => ({
  useDiscreetMode: () => ({ discreet: false }),
}));
vi.mock("@/shared/dates/lima", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/shared/dates/lima")>();
  return {
    ...actual,
    todayInLima: () => ({ year: 2026, month: 6, day: 29 }),
  };
});

beforeEach(() => {
  mocks.getRecurringRule.mockReset();
  mocks.listRecurringOccurrences.mockReset();
  mocks.getRecurringRule.mockResolvedValue(ruleFixture());
  mocks.listRecurringOccurrences.mockResolvedValue({
    occurrences: [occurrenceFixture()],
  });
});

describe("UpcomingDetailScreen SCR-REC-02", () => {
  it("integra regla e historial sin inventar cobertura ni monto real", async () => {
    renderDetail();

    expect(await screen.findByText("Internet hogar")).toBeTruthy();
    expect(screen.getByText("Monto fijo")).toBeTruthy();
    expect(screen.getByText("Cada mes")).toBeTruthy();
    expect(screen.getByText("30 de julio de 2026")).toBeTruthy();
    expect(
      screen.getByText(/Está vinculado a una caja/)
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Historial de ocurrencias" })
    ).toBeTruthy();
    expect(screen.getByText("Pagado")).toBeTruthy();
    expect(screen.queryByText(/\bcubierto\b/i)).toBeNull();
    expect(
      screen.getByText(/todavía no distingue aquí el monto real/)
    ).toBeTruthy();
    expect(mocks.getRecurringRule).toHaveBeenCalledWith("rule-1");
    expect(mocks.listRecurringOccurrences).toHaveBeenCalledWith("rule-1");
  });
});

function renderDetail() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <UpcomingDetailScreen ruleId="rule-1" onBack={vi.fn()} />
    </QueryClientProvider>
  );
}

function ruleFixture() {
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
    default_account_id: null,
    linked_box_id: "box-1",
    linked_debt_id: null,
    source: "manual",
    confidence: null,
    requires_confirmation_for_payment: true,
    last_paid_at: "2026-06-30T05:00:00.000Z",
    last_paid_amount: 49.9,
    metadata: {},
    created_at: "2026-01-01T05:00:00.000Z",
    updated_at: "2026-07-01T05:00:00.000Z",
    deleted_at: null,
    cancelled_at: null,
    occurrences: [],
  };
}

function occurrenceFixture() {
  return {
    id: "occ-1",
    user_id: "user-1",
    recurring_rule_id: "rule-1",
    expected_date: "2026-06-30",
    expected_amount: 49.9,
    status: "paid",
    paid_at: "2026-06-30T15:00:00.000Z",
    paid_movement_id: "movement-1",
    metadata: {},
    created_at: "2026-06-01T05:00:00.000Z",
    updated_at: "2026-06-30T15:00:00.000Z",
  };
}
