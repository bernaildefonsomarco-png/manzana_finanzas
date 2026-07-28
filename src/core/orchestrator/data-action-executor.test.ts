import { describe, expect, it, vi } from "vitest";
import { CommandDispatcher, type CommandResult } from "@/core/finance";
import { InMemoryFinancialCoreRepository } from "@/core/finance/in-memory-repository";
import type { DataAgentOutput, ProposedAction } from "@/agents/data-agent";
import { planDataAgentFinancialActions } from "./data-action-policy";
import {
  buildDataActionIdempotencyKey,
  executeReadyDataActionPlan,
} from "./data-action-executor";

const userId = "00000000-0000-4000-8000-000000000001";
const accountId = "00000000-0000-4000-8000-0000000000aa";
const externalEventId = "00000000-0000-4000-8000-0000000000ee";
const traceId = "00000000-0000-4000-8000-0000000000ff";

function action(overrides: Partial<ProposedAction> = {}): ProposedAction {
  return {
    action_id: "action_1",
    movement_type: "gasto",
    amount: 8,
    currency: "PEN",
    occurred_at: "2026-06-08T10:00:00.000-05:00",
    description: "cafe",
    category_id: "alimentacion",
    subcategory_id: null,
    tags: [],
    account_origin_id: null,
    account_destination_id: null,
    box_origin_id: null,
    box_destination_id: null,
    debt_hint: null,
    recurring_hint: null,
    related_person_hint: null,
    source_evidence: [
      {
        field: "amount_description",
        value: "8 cafe",
        source: "user_text",
      },
    ],
    confidence: 0.98,
    ...overrides,
  };
}

function output(overrides: Partial<DataAgentOutput> = {}): DataAgentOutput {
  return {
    intent: "record_movement",
    confidence: 0.98,
    result: [action()],
    ambiguities: [],
    requires_confirmation: false,
    evidence_signals: [],
    safe_explanation: "Se detecto un movimiento.",
    ...overrides,
  };
}

function readyPlan(dataAgentOutput: DataAgentOutput = output()) {
  return planDataAgentFinancialActions({
    dataAgentOutput,
    accounts: [{ id: accountId, is_default: true }],
    categories: [{ id: "alimentacion", is_sensitive: false }],
    sourceRef: `whatsapp:${externalEventId}`,
    receivedAt: "2026-06-08T10:00:00.000-05:00",
  channel: "whatsapp" as const,
});
}

describe("executeReadyDataActionPlan", () => {
  it("ejecuta un plan listo usando CommandDispatcher y afecta la cuenta", async () => {
    const repository = new InMemoryFinancialCoreRepository({
      accountBalances: { [accountId]: 100 },
    });
    const result = await executeReadyDataActionPlan({
      plan: readyPlan(),
      dispatcher: new CommandDispatcher(repository),
      userId,
      traceId,
      externalEventId,
      channel: "whatsapp" as const,
    });

    expect(result.kind).toBe("executed");
    expect(result.created_count).toBe(1);
    expect(result.idempotent_count).toBe(0);
    expect(result.movements[0].movement_type).toBe("gasto");
    expect(result.movements[0].amount).toBe(8);
    expect(result.movements[0].occurred_at).toBe(
      "2026-06-08T10:00:00.000-05:00"
    );
    expect(repository.accountBalances.get(accountId)).toBe(92);
    expect(repository.auditLogs).toHaveLength(1);
    expect(repository.outboxEvents[0].event_type).toBe("movement_created");
  });

  it("ejecuta un registro claro sin cuenta sin afectar saldos de cuenta", async () => {
    const repository = new InMemoryFinancialCoreRepository({
      accountBalances: { [accountId]: 100 },
    });
    const result = await executeReadyDataActionPlan({
      plan: planDataAgentFinancialActions({
        dataAgentOutput: output(),
        accounts: [],
        categories: [{ id: "alimentacion", is_sensitive: false }],
        sourceRef: `whatsapp:${externalEventId}`,
        receivedAt: "2026-06-08T10:00:00.000-05:00",
      channel: "whatsapp" as const,
    }),
      dispatcher: new CommandDispatcher(repository),
      userId,
      traceId,
      externalEventId,
      channel: "whatsapp" as const,
    });

    expect(result.kind).toBe("executed");
    expect(result.created_count).toBe(1);
    expect(result.movements[0].account_origin_id).toBeNull();
    expect(repository.accountBalances.get(accountId)).toBe(100);
    expect(repository.outboxEvents[0].event_type).toBe("movement_created");
  });

  it("hace idempotente el retry por external_event_id + action_id", async () => {
    const repository = new InMemoryFinancialCoreRepository({
      accountBalances: { [accountId]: 100 },
    });
    const dispatcher = new CommandDispatcher(repository);
    const plan = readyPlan();

    const first = await executeReadyDataActionPlan({
      plan,
      dispatcher,
      userId,
      traceId,
      externalEventId,
      channel: "whatsapp" as const,
    });
    const second = await executeReadyDataActionPlan({
      plan,
      dispatcher,
      userId,
      traceId,
      externalEventId,
      channel: "whatsapp" as const,
    });

    expect(first.kind).toBe("executed");
    expect(second.kind).toBe("executed");
    expect(second.idempotent_count).toBe(1);
    expect(repository.movements.size).toBe(1);
    expect(repository.accountBalances.get(accountId)).toBe(92);
  });

  it("no ejecuta cuando ninguna accion del plan esta lista", async () => {
    const repository = new InMemoryFinancialCoreRepository({
      accountBalances: { [accountId]: 100 },
    });
    const plan = readyPlan(
      output({
        requires_confirmation: true,
        ambiguities: [
          {
            field: "category_id",
            reason: "Categoria dudosa",
            risk_level: "low",
          },
        ],
      })
    );

    const result = await executeReadyDataActionPlan({
      plan,
      dispatcher: new CommandDispatcher(repository),
      userId,
      traceId,
      externalEventId,
      channel: "whatsapp" as const,
    });

    expect(result.kind).toBe("not_executed");
    expect(result.reason).toBe("no_ready_actions");
    expect(repository.movements.size).toBe(0);
    expect(repository.accountBalances.get(accountId)).toBe(100);
  });

  it("ejecuta solo la accion clara de un lote mixto y mantiene retry idempotente", async () => {
    const repository = new InMemoryFinancialCoreRepository({
      accountBalances: { [accountId]: 100 },
    });
    const dispatcher = new CommandDispatcher(repository);
    const plan = readyPlan(
      output({
        requires_confirmation: true,
        result: [
          action({
            action_id: "clear_action",
            description: "desayuno",
            amount: 20,
            confidence: 0.99,
          }),
          action({
            action_id: "ambiguous_action",
            description: "otra compra",
            amount: 15,
            category_id: null,
            confidence: 0.82,
          }),
        ],
        ambiguities: [
          {
            field: "category_id",
            reason: "Categoria de la segunda compra no resuelta.",
            scope: "financial_action",
            action_id: "ambiguous_action",
            risk_level: "medium",
          },
        ],
      })
    );

    expect(plan).toMatchObject({
      kind: "requires_confirmation",
      ready_count: 1,
      requires_confirmation_count: 1,
    });

    const first = await executeReadyDataActionPlan({
      plan,
      dispatcher,
      userId,
      traceId,
      externalEventId,
      channel: "whatsapp" as const,
    });
    const retry = await executeReadyDataActionPlan({
      plan,
      dispatcher,
      userId,
      traceId,
      externalEventId,
      channel: "whatsapp" as const,
    });

    expect(first).toMatchObject({
      kind: "executed",
      created_count: 1,
      movements: [expect.objectContaining({ action_id: "clear_action" })],
    });
    expect(retry).toMatchObject({
      kind: "executed",
      created_count: 1,
      idempotent_count: 1,
    });
    expect(repository.movements.size).toBe(1);
    expect(repository.accountBalances.get(accountId)).toBe(80);
  });

  it("despacha una deuda confirmada solo por CreateDebtCommand", async () => {
    const debtId = "00000000-0000-4000-8000-0000000000d9";
    const dispatch = vi.fn(async (command) => {
      expect(command.type).toBe("CreateDebtCommand");
      return {
        type: "debt_created",
        debt: {
          id: debtId,
          user_id: userId,
          direction: "i_owe",
          kind: "personal",
          status: "active",
          related_person_id: "00000000-0000-4000-8000-0000000000b9",
          name: "Deuda con Juan",
          principal_amount: 100,
          current_balance: 100,
          currency: "PEN",
          opened_at: "2026-07-24",
          due_date: "2026-11-30",
          next_payment_date: "2026-07-30",
          installment_count: 5,
          installment_amount: 20,
          interest_notes: null,
          source: "whatsapp",
          confidence: 1,
          metadata: {},
          created_at: "2026-07-24T17:00:00.000Z",
          updated_at: "2026-07-24T17:00:00.000Z",
          deleted_at: null,
          last_payment_at: null,
          closed_at: null,
        },
        installments: Array.from({ length: 5 }, (_, index) => ({
          id: `00000000-0000-4000-8000-0000000000${index + 10}`,
          user_id: userId,
          debt_id: debtId,
          number: index + 1,
          due_date: `2026-${String(7 + index).padStart(2, "0")}-30`,
          expected_amount: 20,
          paid_amount: 0,
          status: "pending",
          movement_id: null,
          metadata: {},
          created_at: "2026-07-24T17:00:00.000Z",
          updated_at: "2026-07-24T17:00:00.000Z",
        })),
        loan_movement: null,
        idempotent: false,
      } as unknown as CommandResult;
    });
    const debtPlan = planDataAgentFinancialActions({
      confirmedByUser: true,
      dataAgentOutput: output({
        requires_confirmation: true,
        result: [
          action({
            movement_type: "prestamo_recibido",
            amount: 100,
            occurred_at: null,
            description: "Deuda con Juan",
            category_id: null,
            debt_hint: {
              operation: "create_debt",
              direction: "i_owe",
              kind: "personal",
              person_name: "Juan",
              installment_count: 5,
              installment_amount: 20,
              first_due_date: "2026-07-30",
            },
            related_person_hint: { display_name: "Juan" },
          }),
        ],
        ambiguities: [],
      }),
      accounts: [],
      categories: [],
      sourceRef: `whatsapp:${externalEventId}`,
      receivedAt: "2026-07-24T12:00:00.000-05:00",
    channel: "whatsapp" as const,
  });

    const result = await executeReadyDataActionPlan({
      plan: debtPlan,
      dispatcher: { dispatch },
      userId,
      traceId,
      externalEventId,
      channel: "whatsapp" as const,
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CreateDebtCommand",
        payload: expect.objectContaining({
          direction: "i_owe",
          principal_amount: 100,
          related_person_name: "Juan",
          installment_count: 5,
          first_due_date: "2026-07-30",
          account_id: null,
          idempotency_key: `whatsapp:${externalEventId}:action_1`,
        }),
      }),
    );
    expect(result).toMatchObject({
      kind: "executed",
      created_count: 1,
      movements: [],
      debts: [
        {
          action_id: "action_1",
          debt_id: debtId,
          name: "Deuda con Juan",
          direction: "i_owe",
          principal_amount: 100,
          installment_count: 5,
          first_due_date: "2026-07-30",
          movement_id: null,
        },
      ],
    });
  });

  it("construye una llave de idempotencia estable y trazable", () => {
    expect(
      buildDataActionIdempotencyKey({
        channel: "whatsapp",
        externalEventId,
        actionId: "action_1",
      })
    ).toBe(`whatsapp:${externalEventId}:action_1`);
  });

  it("despacha pago_deuda por el comando especializado", async () => {
    const debtId = "00000000-0000-4000-8000-0000000000d1";
    const dispatch = vi.fn(async () =>
      ({
        type: "debt_payment_recorded",
        movement: {
          id: "00000000-0000-4000-8000-0000000000a1",
          type: "pago_deuda",
          amount: 30,
          currency: "PEN",
          occurred_at: "2026-07-22T10:00:00.000-05:00",
          description: "Pago a Pedro",
          category_id: null,
          account_origin_id: null,
          account_destination_id: null,
          status: "confirmed",
          debt_id: debtId,
        },
        debt: { id: debtId, name: "Prestamo Pedro", current_balance: 70 },
        payment: { id: "00000000-0000-4000-8000-0000000000b1" },
        installment_allocations: [],
        allocation_policy: "oldest_open_due_date_first_v1",
        idempotent: false,
      }) as unknown as CommandResult,
    );
    const debtPlan = planDataAgentFinancialActions({
      dataAgentOutput: output({
        result: [
          action({
            movement_type: "pago_deuda",
            amount: 30,
            category_id: null,
            description: "Pago a Pedro",
            debt_hint: { debt_id: debtId },
          }),
        ],
      }),
      accounts: [],
      categories: [],
      debts: [
        {
          id: debtId,
          name: "Prestamo Pedro",
          direction: "i_owe",
          status: "active",
          current_balance: 100,
          currency: "PEN",
          due_date: null,
          next_payment_date: null,
          related_person_id: null,
          related_person_name: "Pedro",
          related_person_aliases: [],
          installments: [],
        },
      ],
      sourceRef: `whatsapp:${externalEventId}`,
      receivedAt: "2026-07-22T10:00:00.000-05:00",
    channel: "whatsapp" as const,
  });

    const result = await executeReadyDataActionPlan({
      plan: debtPlan,
      dispatcher: { dispatch },
      userId,
      traceId,
      externalEventId,
      channel: "whatsapp" as const,
    });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "RecordDebtPaymentCommand",
        payload: expect.objectContaining({ debt_id: debtId, amount: 30 }),
      }),
    );
    expect(result.kind).toBe("executed");
    expect(result.movements[0]).toMatchObject({
      movement_type: "pago_deuda",
      debt_name: "Prestamo Pedro",
      debt_remaining_balance: 70,
    });
  });
});
