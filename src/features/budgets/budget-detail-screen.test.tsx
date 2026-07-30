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
import { BudgetDetailScreen } from "./budget-detail-screen";

const navigation = vi.hoisted(() => ({
  pathname: "/presupuestos/budget-1",
  replace: vi.fn(),
  search: "",
}));

const mocks = vi.hoisted(() => ({
  budgetAction: vi.fn(),
  getBudget: vi.fn(),
  getGoal: vi.fn(),
  goalAction: vi.fn(),
  linkGoalBox: vi.fn(),
  listGoalBoxes: vi.fn(),
  updateBudget: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

vi.mock("./budgets-api", () => mocks);

vi.mock("@/features/app-shell/app-shell", () => ({
  AppShell: ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}));

beforeEach(() => {
  navigation.pathname = "/presupuestos/budget-1";
  navigation.search = "";
  navigation.replace.mockReset();
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getBudget.mockResolvedValue(budgetFixture());
  mocks.getGoal.mockResolvedValue(goalFixture());
  mocks.updateBudget.mockResolvedValue(budgetFixture());
  mocks.linkGoalBox.mockResolvedValue(goalFixture({ box_id: "box-objective" }));
  mocks.listGoalBoxes.mockResolvedValue([boxFixture()]);
});

describe("BudgetDetailScreen W-12", () => {
  it("AC-PRES-11: una meta sin caja no muestra barra de progreso", async () => {
    navigation.pathname = "/presupuestos/goal-1";
    renderDetail("goal", "goal-1");

    expect(await screen.findByText("Sin caja")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Vincular caja existente" }),
    ).toBeInTheDocument();
  });

  it("abre ?accion=ajustar y guarda la base real por el contrato PATCH", async () => {
    navigation.search = "accion=ajustar";
    renderDetail("budget");

    const dialog = await screen.findByRole("dialog", {
      name: "Ajustar presupuesto",
    });
    const amount = within(dialog).getByLabelText(/^Monto base del periodo/);
    expect((amount as HTMLInputElement).value).toBe("500");

    fireEvent.change(amount, { target: { value: "780.50" } });
    fireEvent.change(within(dialog).getByLabelText(/^Tipo/), {
      target: { value: "limite_blando" },
    });
    fireEvent.click(
      within(dialog).getByLabelText(
        "Renovar este presupuesto al comenzar el siguiente periodo."
      )
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Guardar ajuste" })
    );

    await waitFor(() =>
      expect(mocks.updateBudget).toHaveBeenCalledWith("budget-1", {
        amount: 780.5,
        kind: "limite_blando",
        rollover: true,
        auto_renew: false,
      })
    );
  });

  it("vincula una meta solo a una caja objetivo elegida del contrato existente", async () => {
    navigation.pathname = "/presupuestos/goal-1";
    renderDetail("goal", "goal-1");

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Vincular caja existente",
      })
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Vincular caja a la meta",
    });
    await waitFor(() => expect(mocks.listGoalBoxes).toHaveBeenCalledTimes(1));
    expect(
      within(dialog).getByRole("option", { name: "Viaje — S/250.00" })
    ).toBeTruthy();
    expect(within(dialog).queryByLabelText(/Cuenta/)).toBeNull();

    fireEvent.change(within(dialog).getByLabelText(/^Caja objetivo/), {
      target: { value: "box-objective" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Vincular caja" })
    );

    await waitFor(() =>
      expect(mocks.linkGoalBox).toHaveBeenCalledWith(
        "goal-1",
        "box-objective"
      )
    );
  });
});

function renderDetail(entity: "budget" | "goal", id = "budget-1") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BudgetDetailScreen id={id} entity={entity} />
    </QueryClientProvider>
  );
}

function budgetFixture() {
  return {
    id: "budget-1",
    category_id: "alimentacion",
    category_name: "Alimentación",
    currency: "PEN",
    period_kind: "mensual",
    period_start: "2026-07-01",
    period_end: "2026-07-31",
    base_amount: 500,
    rollover_amount: 50,
    amount: 550,
    kind: "presupuesto",
    rollover: true,
    auto_renew: true,
    alerted_thresholds: [],
    source: "manual",
    status: "activo",
    spent: 125,
    remaining: 425,
    pct: 22.73,
    percentage: 22,
    percentage_exact: 22.73,
    band: "holgado",
    movement_ids: [],
    movements: [],
    snapshots: [],
    created_at: "2026-07-01T05:00:00.000Z",
  };
}

function goalFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "goal-1",
    name: "Viaje",
    target_amount: 2_000,
    target_date: "2026-12-31",
    box_id: null,
    currency: "PEN",
    status: "activa",
    box: null,
    current_balance: null,
    progress_pct: null,
    monthly_pace: 350,
    created_at: "2026-07-01T05:00:00.000Z",
    ...overrides,
  };
}

function boxFixture() {
  return {
    id: "box-objective",
    user_id: "user-1",
    account_id: "account-1",
    name: "Viaje",
    type: "objetivo",
    current_balance: 250,
    target_amount: 2_000,
    target_date: "2026-12-31",
    linked_debt_id: null,
    linked_recurring_id: null,
    created_at: "2026-07-01T05:00:00.000Z",
    updated_at: "2026-07-01T05:00:00.000Z",
    deleted_at: null,
  };
}
