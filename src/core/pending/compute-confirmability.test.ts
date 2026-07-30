// RUL-PEND-01/AC-PEND-01: "todo pendiente nace confirmable o no nace" — este
// modulo es el verificador que se corre ANTES de persistir el pendiente
// (email-ingestion.ts) y antes de mostrar el boton de confirmar.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAccountById: vi.fn(),
  getDebtById: vi.fn(),
  getRecurringRuleById: vi.fn(),
  getRecurringOccurrenceById: vi.fn(),
}));

vi.mock("@/data/repositories/accounts.repository", () => ({
  getAccountById: mocks.getAccountById,
}));
vi.mock("@/data/repositories/debts.repository", () => ({
  getDebtById: mocks.getDebtById,
}));
vi.mock("@/data/repositories/recurring.repository", () => ({
  getRecurringRuleById: mocks.getRecurringRuleById,
  getRecurringOccurrenceById: mocks.getRecurringOccurrenceById,
}));

import { computeConfirmability } from "./compute-confirmability";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";
const DEBT_ID = "33333333-3333-4333-8333-333333333333";
const RULE_ID = "44444444-4444-4444-8444-444444444444";
const OCCURRENCE_ID = "55555555-5555-4555-8555-555555555555";

const client = {} as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("computeConfirmability: movimiento generico (create_movement)", () => {
  it("confirmable cuando nombre, monto y categoria estan completos", async () => {
    const result = await computeConfirmability({
      client,
      userId: USER_ID,
      proposedAction: { action: "create_movement", movement_input: {} },
      normalizedSummary: {
        title: "Netflix",
        amount: 44.9,
        category_id: "servicios_suscripciones",
      },
    });

    expect(result.confirmable).toBe(true);
    expect(result.confirmCommand).not.toBeNull();
    expect(result.missingFields).toEqual([]);
  });

  it("AC-PEND-01: no confirmable cuando falta la categoria (el bug real que motiva el modulo 27)", async () => {
    const result = await computeConfirmability({
      client,
      userId: USER_ID,
      proposedAction: { action: "create_movement", movement_input: {} },
      normalizedSummary: {
        title: "Netflix",
        amount: 44.9,
        category_id: null,
      },
    });

    expect(result.confirmable).toBe(false);
    expect(result.confirmCommand).toBeNull();
    expect(result.missingFields).toContain("categoria");
  });

  it("no confirmable cuando la cuenta mencionada ya no existe", async () => {
    mocks.getAccountById.mockResolvedValue(null);
    const result = await computeConfirmability({
      client,
      userId: USER_ID,
      proposedAction: {
        action: "create_movement",
        movement_input: { account_origin_id: ACCOUNT_ID },
      },
      normalizedSummary: { title: "Taxi", amount: 15, category_id: "transporte" },
    });

    expect(result.confirmable).toBe(false);
    expect(result.missingFields).toContain("cuenta");
  });
});

describe("computeConfirmability: review_specialized", () => {
  it("nunca es confirmable: necesita que el usuario elija el tipo primero", async () => {
    const result = await computeConfirmability({
      client,
      userId: USER_ID,
      proposedAction: { action: "review_specialized" },
      normalizedSummary: { title: "Pago ambiguo", amount: 50 },
    });

    expect(result.confirmable).toBe(false);
    expect(result.confirmCommand).toBeNull();
  });
});

describe("computeConfirmability: record_debt_payment", () => {
  it("confirmable cuando la deuda esta activa", async () => {
    mocks.getDebtById.mockResolvedValue({ id: DEBT_ID, status: "active" });
    const result = await computeConfirmability({
      client,
      userId: USER_ID,
      proposedAction: { action: "record_debt_payment", debt_id: DEBT_ID },
      normalizedSummary: { amount: 100 },
    });

    expect(result.confirmable).toBe(true);
  });

  it("no confirmable cuando la deuda ya esta pagada o cerrada", async () => {
    mocks.getDebtById.mockResolvedValue({ id: DEBT_ID, status: "paid" });
    const result = await computeConfirmability({
      client,
      userId: USER_ID,
      proposedAction: { action: "record_debt_payment", debt_id: DEBT_ID },
      normalizedSummary: { amount: 100 },
    });

    expect(result.confirmable).toBe(false);
    expect(result.missingFields).toContain("deuda");
  });
});

describe("computeConfirmability: record_recurring_payment", () => {
  it("no confirmable cuando la ocurrencia ya se pago", async () => {
    mocks.getRecurringRuleById.mockResolvedValue({
      id: RULE_ID,
      status: "active",
      linked_debt_id: null,
      currency: "PEN",
    });
    mocks.getRecurringOccurrenceById.mockResolvedValue({
      id: OCCURRENCE_ID,
      recurring_rule_id: RULE_ID,
      status: "paid",
    });

    const result = await computeConfirmability({
      client,
      userId: USER_ID,
      proposedAction: {
        action: "record_recurring_payment",
        recurring_rule_id: RULE_ID,
        recurring_occurrence_id: OCCURRENCE_ID,
      },
      normalizedSummary: { amount: 30 },
    });

    expect(result.confirmable).toBe(false);
    expect(result.missingFields).toContain("ocurrencia");
  });
});

describe("computeConfirmability: record_transfer", () => {
  it("no confirmable cuando las cuentas no comparten moneda", async () => {
    const originId = "66666666-6666-4666-8666-666666666666";
    const destinationId = "77777777-7777-4777-8777-777777777777";
    mocks.getAccountById
      .mockResolvedValueOnce({ id: originId, currency: "PEN" })
      .mockResolvedValueOnce({ id: destinationId, currency: "USD" });

    const result = await computeConfirmability({
      client,
      userId: USER_ID,
      proposedAction: {
        action: "record_transfer",
        account_origin_id: originId,
        account_destination_id: destinationId,
      },
      normalizedSummary: { title: "Transferencia", amount: 50, currency: "PEN" },
    });

    expect(result.confirmable).toBe(false);
    expect(result.missingFields).toContain("moneda");
  });
});
