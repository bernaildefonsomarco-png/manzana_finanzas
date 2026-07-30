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
import { UpcomingScreen } from "./upcoming-screen";

const state = vi.hoisted(() => ({
  discreet: false,
}));

const mocks = vi.hoisted(() => ({
  cancelRecurringRule: vi.fn(),
  confirmRecurringCandidate: vi.fn(),
  createRecurringRule: vi.fn(),
  discardRecurringCandidate: vi.fn(),
  listRecurringAccounts: vi.fn(),
  listRecurringOccurrences: vi.fn(),
  listUpcomingPayments: vi.fn(),
  markRecurringPaid: vi.fn(),
  pauseRecurringRule: vi.fn(),
  resumeRecurringRule: vi.fn(),
  skipRecurringOccurrence: vi.fn(),
  updateRecurringRule: vi.fn(),
}));

vi.mock("./upcoming-api", () => mocks);

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

vi.mock("@/shared/privacy/discreet-mode-context", () => ({
  useDiscreetMode: () => ({
    discreet: state.discreet,
    saving: false,
  }),
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
  state.discreet = false;
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.listRecurringAccounts.mockResolvedValue({ accounts: [] });
  mocks.listRecurringOccurrences.mockResolvedValue({
    occurrences: [occurrenceFixture()],
  });
  mocks.listUpcomingPayments.mockResolvedValue(upcomingFixture());
  mocks.pauseRecurringRule.mockResolvedValue({ idempotent: false });
  mocks.resumeRecurringRule.mockResolvedValue({ idempotent: false });
  mocks.cancelRecurringRule.mockResolvedValue({});
  mocks.skipRecurringOccurrence.mockResolvedValue({ idempotent: false });
  mocks.discardRecurringCandidate.mockResolvedValue({});
  mocks.confirmRecurringCandidate.mockResolvedValue({});
  mocks.createRecurringRule.mockResolvedValue({});
  mocks.updateRecurringRule.mockResolvedValue({});
  mocks.markRecurringPaid.mockResolvedValue({});
});

describe("UpcomingScreen W-11", () => {
  it("muestra los cuatro bloques y unifica la cuota sin crear una quinta sección de deudas", async () => {
    renderScreen();

    expect(
      await screen.findByRole("heading", { name: "Esta semana" })
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Más adelante" })
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Pendientes" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Sugerencias" })).toBeTruthy();
    expect(screen.getByText("Cuota laptop")).toBeTruthy();
    expect(screen.getByText("Cuota de deuda")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Deudas" })).toBeNull();
  });

  it("expone evidencia concreta de la sugerencia y nunca confidence", async () => {
    renderScreen();

    expect(
      await screen.findByText(/Lo vi 12 may, 12 jun y 12 jul/)
    ).toBeTruthy();
    expect(screen.getAllByText("S/44.90").length).toBeGreaterThan(0);
    expect(screen.queryByText(/97%/)).toBeNull();
    expect(screen.queryByText(/confianza|coincidencia/i)).toBeNull();
  });

  it("en modo discreto oculta nombre, monto y evidencia proactiva", async () => {
    state.discreet = true;
    renderScreen();

    expect(
      (await screen.findAllByText("Tienes un compromiso próximo")).length
    ).toBeGreaterThan(0);
    expect(screen.getByText("Evidencia oculta por modo discreto.")).toBeTruthy();
    expect(screen.queryByText("Internet hogar")).toBeNull();
    expect(screen.queryByText("Netflix")).toBeNull();
    expect(screen.queryByText("S/49.90")).toBeNull();
  });

  it("pausa y salta mediante las rutas especializadas", async () => {
    renderScreen();

    fireEvent.click(await screen.findByRole("button", { name: "Pausar" }));
    await waitFor(() =>
      expect(mocks.pauseRecurringRule).toHaveBeenCalledWith("rule-1")
    );

    fireEvent.click(screen.getByRole("button", { name: "Saltar" }));
    expect(
      screen.getByRole("dialog", { name: "¿Saltar este periodo?" })
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Saltar este periodo" })
    );
    await waitFor(() =>
      expect(mocks.skipRecurringOccurrence).toHaveBeenCalledWith(
        "rule-1",
        "occ-1"
      )
    );
  });

  it("precarga la sugerencia editable y solo la activa tras confirmación", async () => {
    renderScreen();

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Sí, es un pago que viene",
      })
    );
    const dialog = screen.getByRole("dialog", {
      name: "Confirmar sugerencia",
    });
    expect(within(dialog).getByText("Evidencia")).toBeTruthy();
    expect(
      (within(dialog).getByLabelText(/Nombre/) as HTMLInputElement).value
    ).toBe("Netflix");

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Activar pago que viene",
      })
    );
    await waitFor(() =>
      expect(mocks.confirmRecurringCandidate).toHaveBeenCalledWith(
        "candidate-1",
        expect.objectContaining({
          name: "Netflix",
          expected_amount: 44.9,
          frequency: "monthly",
        })
      )
    );
  });

  it("obliga a decidir qué hacer cuando el monto pagado cambió", async () => {
    renderScreen();

    fireEvent.click(await screen.findByRole("button", { name: "Pagué" }));
    const dialog = screen.getByRole("dialog", {
      name: "Marcar pago como realizado",
    });
    fireEvent.change(within(dialog).getByLabelText(/Monto pagado/), {
      target: { value: "59.90" },
    });

    expect(within(dialog).getByText("El monto cambió")).toBeTruthy();
    expect(
      within(dialog).getByLabelText("Actualizar lo que suele ser")
    ).toBeTruthy();
    expect(within(dialog).getByLabelText("Fue algo puntual")).toBeTruthy();

    fireEvent.click(within(dialog).getByLabelText("Fue algo puntual"));
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Registrar este pago" })
    );
    await waitFor(() => expect(mocks.markRecurringPaid).toHaveBeenCalled());
    expect(mocks.updateRecurringRule).not.toHaveBeenCalled();
  });

  it("no invita a repetir el pago si falla solo la actualización descriptiva del monto", async () => {
    mocks.updateRecurringRule.mockRejectedValueOnce(
      new Error("descriptive update failed")
    );
    renderScreen();

    fireEvent.click(await screen.findByRole("button", { name: "Pagué" }));
    const dialog = screen.getByRole("dialog", {
      name: "Marcar pago como realizado",
    });
    fireEvent.change(within(dialog).getByLabelText(/Monto pagado/), {
      target: { value: "59.90" },
    });
    fireEvent.click(
      within(dialog).getByLabelText("Actualizar lo que suele ser")
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Registrar este pago" })
    );

    expect(
      await screen.findByText(/El pago sí quedó registrado/)
    ).toBeTruthy();
    expect(mocks.markRecurringPaid).toHaveBeenCalledTimes(1);
    expect(mocks.updateRecurringRule).toHaveBeenCalledWith("rule-1", {
      expected_amount: 59.9,
    });
    expect(
      screen.queryByRole("dialog", { name: "Marcar pago como realizado" })
    ).toBeNull();
  });

  it("muestra solo sugerencias sin un estado vacío encima", async () => {
    mocks.listUpcomingPayments.mockResolvedValue(
      upcomingFixture({ commitments: [], recurring_rules: [] })
    );
    renderScreen();

    expect(
      await screen.findByRole("heading", { name: "Sugerencias" })
    ).toBeTruthy();
    expect(
      screen.queryByText("No tienes pagos que vienen registrados")
    ).toBeNull();
    expect(screen.queryByRole("heading", { name: "Esta semana" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Calendario" })).toBeNull();
  });

  it("ofrece una tabla equivalente en la vista calendario", async () => {
    renderScreen();

    fireEvent.click(await screen.findByRole("button", { name: "Calendario" }));
    expect(
      screen.getByRole("table", {
        name: /Calendario accesible de compromisos/,
      })
    ).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Fecha" })).toBeTruthy();
    expect(
      screen.getByRole("columnheader", { name: "Compromiso" })
    ).toBeTruthy();
  });
});

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <UpcomingScreen />
    </QueryClientProvider>
  );
}

function recurringRuleFixture(overrides: Record<string, unknown> = {}) {
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
    occurrences: [occurrenceFixture()],
    ...overrides,
  };
}

function occurrenceFixture(overrides: Record<string, unknown> = {}) {
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

function upcomingFixture(overrides: Record<string, unknown> = {}) {
  return {
    commitments: [
      {
        id: "commitment-recurring",
        title: "Internet hogar",
        amount: 49.9,
        currency: "PEN",
        due_at: "2026-07-30",
        kind: "recurring",
        linked_box_id: null,
        recurring_rule_id: "rule-1",
        occurrence_id: "occ-1",
        presentation_state: "upcoming",
      },
      {
        id: "commitment-debt",
        title: "Cuota laptop",
        amount: 180,
        currency: "PEN",
        due_at: "2026-08-05",
        kind: "debt",
        direction: "i_owe",
        linked_box_id: "box-1",
        debt_id: "debt-1",
        installment_id: "installment-1",
      },
    ],
    recurring_rules: [recurringRuleFixture()],
    candidates: [
      {
        id: "candidate-1",
        user_id: "user-1",
        merchant_key: "netflix",
        category_id: "servicios_suscripciones",
        evidence: {
          display_name: "Netflix",
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
      },
    ],
    horizon_days: 30,
    timezone: "America/Lima",
    ...overrides,
  };
}
