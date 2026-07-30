import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BudgetsScreen } from "./budgets-screen";

const navigation = vi.hoisted(() => ({
  pathname: "/presupuestos",
  replace: vi.fn(),
  search: "periodo=quincenal",
}));

const mocks = vi.hoisted(() => ({
  archiveBudget: vi.fn(),
  archiveGoal: vi.fn(),
  budgetAction: vi.fn(),
  copyPreviousBudgets: vi.fn(),
  createBudget: vi.fn(),
  createGoal: vi.fn(),
  goalAction: vi.fn(),
  listBudgets: vi.fn(),
  listBudgetSuggestions: vi.fn(),
  listGoals: vi.fn(),
  resolveBudgetSuggestion: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

vi.mock("@/shared/dates/lima", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/shared/dates/lima")>();
  return {
    ...actual,
    isoDateInLima: () => "2026-07-30",
  };
});

vi.mock("./budgets-api", () => mocks);

vi.mock("@/features/app-shell/app-shell", () => ({
  AppShell: ({
    title,
    primaryAction,
    children,
  }: {
    title: string;
    primaryAction?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <main>
      <h1>{title}</h1>
      {primaryAction}
      {children}
    </main>
  ),
}));

beforeEach(() => {
  navigation.search = "periodo=quincenal";
  navigation.replace.mockReset();
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.listBudgets.mockImplementation(
    (_periodKind: string, date?: string) =>
      Promise.resolve({
        budgets: date ? previousBudgets() : currentBudgets(),
        timezone: "America/Lima",
      })
  );
  mocks.listGoals.mockResolvedValue({ goals: [] });
  mocks.listBudgetSuggestions.mockResolvedValue({ suggestions: [] });
  mocks.copyPreviousBudgets.mockResolvedValue(previousBudgets());
  mocks.createBudget.mockResolvedValue(currentBudgets()[0]);
});

describe("BudgetsScreen W-12", () => {
  it("sincroniza el selector con la URL y agrega exactamente el periodo listado", async () => {
    renderBudgets();

    await waitFor(() =>
      expect(mocks.listBudgets).toHaveBeenCalledWith("quincenal")
    );
    expect(mocks.listBudgetSuggestions).toHaveBeenCalledWith("quincenal");
    expect(
      await screen.findByText("Quincena actual · 2 presupuestos")
    ).toBeTruthy();

    const summary = screen
      .getByRole("heading", { name: "Resumen del periodo" })
      .closest("section");
    expect(summary).not.toBeNull();
    expect(within(summary as HTMLElement).getByText("S/200.00")).toBeTruthy();
    expect(within(summary as HTMLElement).getByText("S/900.00")).toBeTruthy();

    const selector = screen.getByLabelText("Periodo");
    expect((selector as HTMLSelectElement).value).toBe("quincenal");
    fireEvent.change(selector, { target: { value: "semanal" } });
    expect(navigation.replace).toHaveBeenCalledWith(
      "/presupuestos?periodo=semanal",
      { scroll: false }
    );
  });

  it("resume el periodo anterior antes de copiarlo y usa la fecha Lima", async () => {
    renderBudgets();

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Copiar periodo anterior",
      })
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Copiar periodo anterior",
    });

    await waitFor(() =>
      expect(mocks.listBudgets).toHaveBeenCalledWith(
        "quincenal",
        "2026-07-15"
      )
    );
    await waitFor(() =>
      expect(
        within(dialog).getByText(
          (_content, element) =>
            element?.tagName === "P" &&
            element.textContent === "Se copiarán 2 presupuestos."
        )
      ).toBeTruthy()
    );
    expect(within(dialog).getByText("S/500.00")).toBeTruthy();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Copiar presupuestos" })
    );
    await waitFor(() =>
      expect(mocks.copyPreviousBudgets).toHaveBeenCalledWith(
        "quincenal",
        "2026-07-30"
      )
    );
  });

  it("crea el presupuesto con el periodo visible, no con mensual fijo", async () => {
    renderBudgets();

    fireEvent.click(
      await screen.findByRole("button", { name: "Nuevo presupuesto" })
    );
    const dialog = screen.getByRole("dialog", {
      name: "Nuevo presupuesto",
    });
    expect(within(dialog).getByLabelText(/^Monto quincenal/)).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText(/^Monto quincenal/), {
      target: { value: "640.50" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Crear presupuesto" })
    );

    await waitFor(() => expect(mocks.createBudget).toHaveBeenCalledTimes(1));
    expect(mocks.createBudget.mock.calls[0][0]).toEqual({
      amount: 640.5,
      category_id: "alimentacion",
      period_kind: "quincenal",
      kind: "presupuesto",
      rollover: false,
      auto_renew: true,
    });
  });
});

function renderBudgets() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BudgetsScreen />
    </QueryClientProvider>
  );
}

function currentBudgets() {
  return [
    budgetFixture({
      id: "budget-food",
      category_name: "Alimentación",
      base_amount: 500,
      rollover_amount: 50,
      amount: 550,
      spent: 125,
      remaining: 425,
    }),
    budgetFixture({
      id: "budget-transport",
      category_id: "transporte",
      category_name: "Transporte",
      base_amount: 350,
      rollover_amount: 0,
      amount: 350,
      spent: 75,
      remaining: 275,
    }),
  ];
}

function previousBudgets() {
  return [
    budgetFixture({
      id: "previous-food",
      base_amount: 300,
      amount: 300,
      period_start: "2026-07-01",
      period_end: "2026-07-15",
    }),
    budgetFixture({
      id: "previous-transport",
      category_id: "transporte",
      category_name: "Transporte",
      base_amount: 200,
      amount: 200,
      period_start: "2026-07-01",
      period_end: "2026-07-15",
    }),
  ];
}

function budgetFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "budget-1",
    category_id: "alimentacion",
    category_name: "Alimentación",
    currency: "PEN",
    period_kind: "quincenal",
    period_start: "2026-07-16",
    period_end: "2026-07-31",
    base_amount: 500,
    rollover_amount: 0,
    amount: 500,
    kind: "presupuesto",
    rollover: false,
    auto_renew: true,
    alerted_thresholds: [],
    source: "manual",
    status: "activo",
    spent: 0,
    remaining: 500,
    pct: 0,
    percentage: 0,
    percentage_exact: 0,
    band: "holgado",
    movement_ids: [],
    created_at: "2026-07-16T05:00:00.000Z",
    ...overrides,
  };
}
