import { describe, expect, it } from "vitest";
import type { ParsedGmailMovement } from "@/adapters/email/gmail-parser";
import type {
  Account,
  Debt,
  RecurringOccurrence,
  RecurringRule,
} from "@/shared/types/domain";
import {
  enrichEmailFinancialMovement,
  resolveEmailAccount,
} from "./email-financial-enricher";

describe("email financial enricher", () => {
  it("resuelve cuenta solo con institucion, moneda y ultimos cuatro unicos", () => {
    expect(
      resolveEmailAccount(parsed({ accountHint: "4521" }), [
        account({
          id: "a1",
          institution: "Banco Test",
          metadata: { last_four: "4521" },
        }),
        account({
          id: "a2",
          currency: "USD",
          metadata: { last_four: "4521" },
        }),
      ]),
    ).toEqual({
      accountId: "a1",
      confidence: "high",
      candidateIds: ["a1"],
    });
  });

  it("no elige cuenta cuando la pista es ambigua", () => {
    const result = resolveEmailAccount(parsed({ accountHint: "4521" }), [
      account({ id: "a1", metadata: { last_four: "4521" } }),
      account({ id: "a2", metadata: { last_four: "4521" } }),
    ]);

    expect(result).toMatchObject({
      accountId: null,
      confidence: "ambiguous",
      candidateIds: ["a1", "a2"],
    });
  });

  it("reutiliza una pista bancaria aprendida explicitamente", () => {
    expect(
      resolveEmailAccount(
        parsed({
          institutionKey: "bcp",
          institutionAliases: ["BCP"],
          accountHint: "Clásica ****3087",
        }),
        [
          account({
            id: "tarjeta-bcp",
            name: "Mi tarjeta diaria",
            institution: "BCP",
            metadata: {
              email_account_hints: ["Clásica ****3087"],
            },
          }),
        ],
      ),
    ).toEqual({
      accountId: "tarjeta-bcp",
      confidence: "high",
      candidateIds: ["tarjeta-bcp"],
    });
  });

  it("vincula cuota unica a deuda y exige motor especializado", () => {
    const result = enrichEmailFinancialMovement(
      parsed({
        operationHint: "debt_installment",
        merchant: "Credito Auto",
        amount: 300,
      }),
      {
        accounts: [account()],
        debts: [
          debt({
            id: "debt-1",
            name: "Credito Auto",
            installment_amount: 300,
          }),
        ],
        recurringRules: [],
      },
    );

    expect(result).toMatchObject({
      suggestedAction: "record_debt_payment",
      suggestedMovementType: "pago_deuda",
      debtId: "debt-1",
      requiresSpecializedEngine: true,
    });
  });

  it("vincula comercio y monto a una ocurrencia recurrente", () => {
    const rule = recurringRule();
    const occurrence = recurringOccurrence();
    const result = enrichEmailFinancialMovement(
      parsed({ merchant: "NETFLIX", amount: 25.9 }),
      {
        accounts: [account()],
        debts: [],
        recurringRules: [{ ...rule, occurrences: [occurrence] }],
      },
    );

    expect(result).toMatchObject({
      suggestedAction: "record_recurring_payment",
      recurringRuleId: "rule-1",
      recurringOccurrenceId: "occurrence-1",
      suggestedMovementType: "pago_recurrente",
    });
  });

  it("no convierte una transferencia de entrada generica en ingreso", () => {
    const result = enrichEmailFinancialMovement(
      parsed({
        direction: "in",
        movementType: "ingreso",
        operationHint: "income",
        parseMode: "generic_fallback",
      }),
      { accounts: [account()], debts: [], recurringRules: [] },
    );

    expect(result).toMatchObject({
      suggestedAction: "review_specialized",
      suggestedMovementType: "transferencia",
      transferDestinationAccountId: "account-1",
      transferOriginAccountId: null,
      requiresSpecializedEngine: true,
    });
    expect(result.ambiguityReasons).toContain("transfer_origin_missing");
  });

  it("resuelve ambas cuentas extraidas para una transferencia propia", () => {
    const result = enrichEmailFinancialMovement(
      parsed({
        operationHint: "transfer",
        parseMode: "agent",
        accountOriginHint: "1111",
        accountDestinationHint: "2222",
      }),
      {
        accounts: [
          account({
            id: "origin",
            name: "Cuenta BCP 1111",
            institution: "BCP",
            metadata: { last_four: "1111" },
          }),
          account({
            id: "destination",
            name: "Cuenta BCP 2222",
            institution: "BCP",
            metadata: { last_four: "2222" },
          }),
        ],
        debts: [],
        recurringRules: [],
      },
    );

    expect(result).toMatchObject({
      suggestedAction: "record_transfer",
      suggestedMovementType: "transferencia",
      transferOriginAccountId: "origin",
      transferDestinationAccountId: "destination",
      requiresSpecializedEngine: true,
    });
  });

  it("no confunde un destino textual Yape con la cuenta BCP emisora", () => {
    const result = enrichEmailFinancialMovement(
      parsed({
        operationHint: "transfer",
        parseMode: "agent",
        accountHint: "Cuenta de ahorro **** 5019",
        accountOriginHint: "Cuenta de ahorro **** 5019",
        accountDestinationHint: "Yape",
      }),
      {
        accounts: [
          account({
            id: "bcp-card",
            name: "Tarjeta BCP",
            institution: "BCP",
            metadata: {},
          }),
        ],
        debts: [],
        recurringRules: [],
      },
    );

    expect(result).toMatchObject({
      suggestedAction: "review_specialized",
      transferOriginAccountId: null,
      transferDestinationAccountId: null,
      requiresSpecializedEngine: true,
    });
    expect(result.ambiguityReasons).toEqual(
      expect.arrayContaining([
        "transfer_origin_missing",
        "transfer_destination_missing",
      ]),
    );
  });

  it("clasifica devolucion sin llamarla ingreso", () => {
    const result = enrichEmailFinancialMovement(
      parsed({
        direction: "in",
        movementType: "ingreso",
        operationHint: "refund",
      }),
      { accounts: [account()], debts: [], recurringRules: [] },
    );

    expect(result).toMatchObject({
      suggestedAction: "create_movement",
      suggestedMovementType: "devolucion_recibida",
    });
  });
});

function parsed(
  overrides: Partial<ParsedGmailMovement> = {},
): ParsedGmailMovement {
  return {
    movementType: "gasto",
    direction: "out",
    amount: 45,
    currency: "PEN",
    occurredAt: "2026-07-20T17:00:00.000Z",
    description: "Compra - MERCADO",
    merchant: "MERCADO",
    accountHint: null,
    operationHint: "purchase",
    institutionKey: "bank_test",
    institutionAliases: ["Banco Test"],
    sender: "alerts@bank.test",
    subjectHash: "a".repeat(64),
    contentHash: "b".repeat(64),
    templateId: "template-1",
    templateVersion: "v1",
    parseMode: "template",
    matchedSubjectPattern: "Alerta",
    confidence: 0.93,
    ...overrides,
  };
}

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: "account-1",
    user_id: "user-1",
    name: "Cuenta Banco Test 4521",
    institution: "Banco Test",
    type: "banco",
    currency: "PEN",
    initial_balance: 0,
    current_balance: 1000,
    is_default: true,
    color: null,
    icon: null,
    metadata: { last_four: "4521" },
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function debt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: "debt-1",
    user_id: "user-1",
    direction: "i_owe",
    kind: "bank_loan",
    status: "active",
    related_person_id: null,
    name: "Credito Auto",
    principal_amount: 1200,
    current_balance: 900,
    currency: "PEN",
    opened_at: "2026-01-01",
    due_date: null,
    next_payment_date: null,
    installment_count: 4,
    installment_amount: 300,
    interest_notes: null,
    source: "dashboard_manual",
    confidence: 1,
    metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
    last_payment_at: null,
    closed_at: null,
    ...overrides,
  };
}

function recurringRule(): RecurringRule {
  return {
    id: "rule-1",
    user_id: "user-1",
    status: "active",
    name: "Netflix",
    merchant_pattern: "NETFLIX",
    expected_amount: 25.9,
    amount_variability: "fixed",
    currency: "PEN",
    frequency: "monthly",
    day_of_month: 20,
    date_window_start_day: null,
    date_window_end_day: null,
    next_expected_date: "2026-07-20",
    category_id: null,
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
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
    cancelled_at: null,
  };
}

function recurringOccurrence(): RecurringOccurrence {
  return {
    id: "occurrence-1",
    user_id: "user-1",
    recurring_rule_id: "rule-1",
    expected_date: "2026-07-20",
    expected_amount: 25.9,
    status: "due_soon",
    paid_at: null,
    paid_movement_id: null,
    metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}
