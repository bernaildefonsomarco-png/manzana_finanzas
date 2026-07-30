import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DebtsScreen } from "./debts-screen";

const privacy = vi.hoisted(() => ({
  discreet: false,
}));

const mocks = vi.hoisted(() => ({
  closeDebt: vi.fn(),
  createClientIdempotencyKey: vi.fn(() => "ui-idempotency-key-123"),
  createDebt: vi.fn(),
  createDebtPayment: vi.fn(),
  getDebtDetail: vi.fn(),
  listDebtPaymentAccounts: vi.fn(),
  listDebts: vi.fn(),
  previewDebtPayment: vi.fn(),
  reopenDebt: vi.fn(),
  rescheduleInstallment: vi.fn(),
  skipInstallment: vi.fn(),
  updateDebt: vi.fn(),
}));

vi.mock("./debts-api", () => mocks);
vi.mock("@/shared/privacy/discreet-mode-context", () => ({
  useDiscreetMode: () => ({
    discreet: privacy.discreet,
    saving: false,
    setDiscreet: vi.fn(),
  }),
}));

beforeEach(() => {
  privacy.discreet = false;
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.createClientIdempotencyKey.mockReturnValue(
    "ui-idempotency-key-123"
  );
  mocks.listDebtPaymentAccounts.mockResolvedValue({ accounts: [] });
  mocks.previewDebtPayment.mockResolvedValue({
    amount: 200,
    previous_balance: 1100,
    projected_balance: 900,
    allocations: [
      {
        installment_id: "installment-1",
        installment_number: 1,
        due_date: "2026-08-01",
        previous_paid_amount: 100,
        allocated_amount: 200,
        projected_paid_amount: 300,
        projected_status: "paid",
      },
    ],
    unallocated_amount: 0,
    allocation_policy: "oldest_open_due_date_first_v1",
  });
});

describe("DebtsScreen W-11", () => {
  it("muestra Debo y Me deben como cifras brutas separadas, sin neto primario", async () => {
    mocks.listDebts.mockResolvedValue({
      debts: [
        debtFixture({ current_balance: 100 }),
        debtFixture({
          id: "debt-2",
          direction: "they_owe_me",
          current_balance: 40,
          name: "Préstamo a Ana",
        }),
      ],
    });

    render(<DebtsScreen />);

    expect((await screen.findAllByText("S/100.00")).length).toBeGreaterThan(0);
    expect(screen.getByText("S/40.00")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Debo \(1\)/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Me deben \(1\)/ })).toBeTruthy();
    expect(screen.queryByText(/^Neto$/)).toBeNull();
  });

  it("el modo discreto retira nombres y montos también del árbol accesible", async () => {
    privacy.discreet = true;
    mocks.listDebts.mockResolvedValue({
      debts: [
        debtFixture({
          name: "Préstamo privado",
          related_person: {
            id: "person-1",
            user_id: "user-1",
            display_name: "Persona confidencial",
            normalized_name: "persona confidencial",
            kind: "person",
            relationship_label: "amistad",
            metadata: {},
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
            deleted_at: null,
          },
        }),
      ],
    });

    render(<DebtsScreen />);
    await screen.findByRole("tab", { name: /Debo \(1\)/ });
    expect(screen.queryByText("Préstamo privado")).toBeNull();
    expect(screen.queryByText("Persona confidencial")).toBeNull();
    expect(
      screen.getAllByLabelText("Información oculta por modo discreto").length
    ).toBeGreaterThan(0);
  });

  it("si solo hay deuda a favor abre directamente Me deben", async () => {
    mocks.listDebts.mockResolvedValue({
      debts: [
        debtFixture({
          direction: "they_owe_me",
          name: "Préstamo a Ana",
        }),
      ],
    });
    render(<DebtsScreen />);

    const tab = await screen.findByRole("tab", { name: /Me deben \(1\)/ });
    expect(tab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Préstamo a Ana")).toBeTruthy();
  });

  it("deep-link de pago precarga la cuota oldest-first y muestra preview antes de confirmar", async () => {
    const debt = detailFixture();
    mocks.listDebts.mockResolvedValue({ debts: [debt] });
    mocks.getDebtDetail.mockResolvedValue(debt);

    render(
      <DebtsScreen
        debtIntent={{
          debtId: debt.id,
          installmentId: "installment-1",
          action: "pay",
        }}
      />
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Registrar pago",
    });
    const input = within(dialog).getByLabelText(/^Monto pagado/);
    expect((input as HTMLInputElement).value).toBe("200");
    await waitFor(() =>
      expect(mocks.previewDebtPayment).toHaveBeenCalledWith(debt.id, 200)
    );
    expect(await screen.findByText("S/900.00")).toBeTruthy();
    expect(screen.getByText(/Quedará/)).toBeTruthy();
    expect(
      within(dialog).getByRole("button", { name: "Registrar pago" })
    ).not.toBeDisabled();
  });

  it("rechaza el sobrepago y ofrece las dos salidas sin encadenar commits", async () => {
    const debt = detailFixture();
    mocks.listDebts.mockResolvedValue({ debts: [debt] });
    mocks.getDebtDetail.mockResolvedValue(debt);

    render(
      <DebtsScreen
        debtIntent={{
          debtId: debt.id,
          installmentId: "installment-1",
          action: "pay",
        }}
      />
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Registrar pago",
    });
    fireEvent.change(within(dialog).getByLabelText(/^Monto pagado/), {
      target: { value: "1200" },
    });

    expect(
      within(dialog).getByText(/No aceptamos sobrepago/)
    ).toBeTruthy();
    expect(
      within(dialog).getByRole("button", { name: "Usar saldo exacto" })
    ).toBeTruthy();
    expect(
      within(dialog)
        .getByRole("link", { name: "Registrar diferencia aparte" })
        .getAttribute("href")
    ).toBe("/movimientos/nuevo");
    expect(
      within(dialog).getByRole("button", { name: "Registrar pago" })
    ).toBeDisabled();
  });

  it("un detalle inexistente muestra error y salida al listado", async () => {
    const onDebtDetailClose = vi.fn();
    mocks.listDebts.mockResolvedValue({ debts: [] });
    mocks.getDebtDetail.mockRejectedValue(
      new Error("No encontré esa deuda.")
    );

    render(
      <DebtsScreen
        debtIntent={{
          debtId: "missing-debt",
          action: "detail",
        }}
        onDebtDetailClose={onDebtDetailClose}
      />
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No encontré esa deuda."
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Volver al listado" })
    );
    expect(onDebtDetailClose).toHaveBeenCalledOnce();
  });

  it("usa el Dialog accesible y previsualiza cuotas antes de crear", async () => {
    mocks.listDebts.mockResolvedValue({ debts: [] });
    render(<DebtsScreen />);

    const buttons = await screen.findAllByRole("button", {
      name: "Agregar deuda",
    });
    fireEvent.click(buttons[0]);

    const dialog = screen.getByRole("dialog", { name: "Crear deuda" });
    await waitFor(() =>
      expect(mocks.listDebtPaymentAccounts).toHaveBeenCalledOnce()
    );
    fireEvent.change(within(dialog).getByLabelText(/^Nombre/), {
      target: { value: "Laptop" },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Monto en soles/), {
      target: { value: "900" },
    });
    fireEvent.change(
      within(dialog).getByLabelText(/^Primera fecha o vencimiento/),
      {
      target: { value: "2026-08-31" },
      }
    );
    fireEvent.change(within(dialog).getByLabelText(/^Número de cuotas/), {
      target: { value: "3" },
    });

    expect(screen.getByText("Vista previa: 3 cuotas")).toBeTruthy();
    expect(screen.getByText(/Cuota 2 · 2026-09-30/)).toBeTruthy();
  });

  it("al editar conserva el vencimiento final y no lo reemplaza por la próxima cuota", async () => {
    const debt = detailFixture({
      due_date: "2026-11-01",
      next_payment_date: "2026-08-01",
    });
    mocks.listDebts.mockResolvedValue({ debts: [debt] });
    mocks.getDebtDetail.mockResolvedValue(debt);
    mocks.updateDebt.mockResolvedValue(debt);
    render(<DebtsScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Ver detalle" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Editar datos" })
    );

    const dialog = screen.getByRole("dialog", { name: "Editar deuda" });
    const dueDate = within(dialog).getByLabelText("Vencimiento");
    expect((dueDate as HTMLInputElement).value).toBe("2026-11-01");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Guardar cambios" })
    );

    await waitFor(() =>
      expect(mocks.updateDebt).toHaveBeenCalledWith(debt.id, {
        name: debt.name,
        kind: debt.kind,
        due_date: "2026-11-01",
        interest_notes: null,
      })
    );
  });

  it("muestra caja vinculada pero declara que no la consume automáticamente", async () => {
    const debt = detailFixture({
      linked_box: {
        id: "box-1",
        user_id: "user-1",
        account_id: "account-1",
        name: "Cuota laptop",
        type: "compromiso",
        current_balance: 60,
        target_amount: null,
        target_date: null,
        linked_debt_id: "debt-1",
        linked_recurring_id: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        deleted_at: null,
      },
    });
    mocks.listDebts.mockResolvedValue({ debts: [debt] });
    mocks.getDebtDetail.mockResolvedValue(debt);
    render(<DebtsScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Ver detalle" }));
    expect(await screen.findByText("Caja vinculada")).toBeTruthy();
    expect(screen.getByText(/no se consume automáticamente/i)).toBeTruthy();
  });

  it("con saldo obliga a condonar; no permite fingir un cierre pagado", async () => {
    const debt = detailFixture();
    mocks.listDebts.mockResolvedValue({ debts: [debt] });
    mocks.getDebtDetail.mockResolvedValue(debt);
    mocks.closeDebt.mockResolvedValue({
      ...debt,
      status: "cancelled",
      current_balance: 0,
    });

    render(<DebtsScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Ver detalle" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Cerrar deuda" })
    );

    const dialog = screen.getByRole("dialog", { name: "Cerrar deuda" });
    expect(
      within(dialog).getByLabelText(/Ya está pagada/)
    ).toBeDisabled();
    fireEvent.click(within(dialog).getByLabelText(/Me la perdonaron/));
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Condonar deuda" })
    );

    await waitFor(() =>
      expect(mocks.closeDebt).toHaveBeenCalledWith(
        debt.id,
        "forgiven",
        "ui-idempotency-key-123"
      )
    );
  });

  it("solo ofrece reapertura a una deuda condonada, nunca a una pagada", async () => {
    const paid = detailFixture({
      status: "paid",
      current_balance: 0,
      closed_at: "2026-07-01T12:00:00.000Z",
    });
    mocks.listDebts.mockResolvedValue({ debts: [paid] });
    mocks.getDebtDetail.mockResolvedValue(paid);
    const rendered = render(<DebtsScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Ver detalle" }));
    expect(
      await screen.findByText(/Una deuda pagada requiere un ajuste/)
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Reabrir condonada" })
    ).toBeNull();

    rendered.unmount();
    const forgiven = detailFixture({
      status: "cancelled",
      current_balance: 0,
      metadata: { forgiven_balance: 1100 },
      closed_at: "2026-07-01T12:00:00.000Z",
    });
    mocks.listDebts.mockResolvedValue({ debts: [forgiven] });
    mocks.getDebtDetail.mockResolvedValue(forgiven);
    render(<DebtsScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Ver detalle" }));
    expect(
      await screen.findByRole("button", { name: "Reabrir condonada" })
    ).toBeTruthy();
  });

  it("reprograma y omite cuotas por sus rutas especializadas y con motivo", async () => {
    const debt = detailFixture();
    const firstInstallment = debt.installments[0]!;
    mocks.listDebts.mockResolvedValue({ debts: [debt] });
    mocks.getDebtDetail.mockResolvedValue(debt);
    mocks.rescheduleInstallment.mockResolvedValue(firstInstallment);
    mocks.skipInstallment.mockResolvedValue(firstInstallment);
    render(<DebtsScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Ver detalle" }));
    fireEvent.click(
      (await screen.findAllByRole("button", { name: "Reprogramar" }))[0]!
    );
    const rescheduleDialog = screen.getByRole("dialog", {
      name: "Reprogramar cuota 1",
    });
    fireEvent.change(
      within(rescheduleDialog).getByLabelText(/^Nueva fecha/),
      { target: { value: "2026-08-15" } }
    );
    fireEvent.change(within(rescheduleDialog).getByLabelText("Motivo"), {
      target: { value: "Acuerdo explícito" },
    });
    fireEvent.click(
      within(rescheduleDialog).getByRole("button", {
        name: "Reprogramar cuota",
      })
    );
    await waitFor(() =>
      expect(mocks.rescheduleInstallment).toHaveBeenCalledWith(
        debt.id,
        firstInstallment.id,
        {
          due_date: "2026-08-15",
          reason: "Acuerdo explícito",
        },
        "ui-idempotency-key-123"
      )
    );

    fireEvent.click(
      (await screen.findAllByRole("button", { name: "Omitir" }))[0]!
    );
    const skipDialog = screen.getByRole("dialog", {
      name: "Omitir cuota 1",
    });
    fireEvent.change(within(skipDialog).getByLabelText(/^Motivo/), {
      target: { value: "No aplica este periodo" },
    });
    fireEvent.click(
      within(skipDialog).getByRole("button", {
        name: "Omitir esta cuota",
      })
    );
    await waitFor(() =>
      expect(mocks.skipInstallment).toHaveBeenCalledWith(
        debt.id,
        firstInstallment.id,
        "No aplica este periodo",
        "ui-idempotency-key-123"
      )
    );
  });
});

function debtFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "debt-1",
    user_id: "user-1",
    direction: "i_owe",
    kind: "installment_purchase",
    status: "active",
    related_person_id: null,
    related_person: null,
    linked_box: null,
    name: "Laptop",
    principal_amount: 1200,
    current_balance: 1100,
    currency: "PEN",
    opened_at: "2026-06-01",
    due_date: "2026-11-01",
    next_payment_date: "2026-08-01",
    installment_count: 4,
    installment_amount: 300,
    interest_notes: null,
    source: "dashboard_manual",
    confidence: 1,
    metadata: {},
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    deleted_at: null,
    last_payment_at: null,
    closed_at: null,
    ...overrides,
  };
}

function detailFixture(overrides: Record<string, unknown> = {}) {
  const debt = debtFixture(overrides);
  return {
    ...debt,
    payments: [],
    installments: [
      {
        id: "installment-1",
        user_id: "user-1",
        debt_id: debt.id,
        number: 1,
        due_date: "2026-08-01",
        expected_amount: 300,
        paid_amount: 100,
        status: "pending",
        movement_id: null,
        metadata: {},
        created_at: "2026-06-01T00:00:00.000Z",
        updated_at: "2026-06-01T00:00:00.000Z",
        movement: null,
        allocations: [],
      },
      {
        id: "installment-2",
        user_id: "user-1",
        debt_id: debt.id,
        number: 2,
        due_date: "2026-09-01",
        expected_amount: 300,
        paid_amount: 0,
        status: "pending",
        movement_id: null,
        metadata: {},
        created_at: "2026-06-01T00:00:00.000Z",
        updated_at: "2026-06-01T00:00:00.000Z",
        movement: null,
        allocations: [],
      },
    ],
  };
}
