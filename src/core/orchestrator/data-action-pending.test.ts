import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DataAgentOutput, ProposedAction } from "@/agents/data-agent";
import { planDataAgentFinancialActions } from "./data-action-policy";
import {
  buildPendingInputFromDataAction,
  buildPendingSourceRef,
  createPendingItemsForDataActionPlan,
} from "./data-action-pending";
import { createPendingItem } from "@/data/repositories/pending.repository";

vi.mock("@/data/repositories/pending.repository", () => ({
  createPendingItem: vi.fn(),
}));

const mockedCreatePendingItem = vi.mocked(createPendingItem);

const userId = "00000000-0000-4000-8000-000000000001";
const externalEventId = "00000000-0000-4000-8000-0000000000ee";

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

describe("buildPendingInputFromDataAction", () => {
  beforeEach(() => mockedCreatePendingItem.mockReset());
  it("crea un pending compatible para un gasto de baja confianza", () => {
    const plan = planDataAgentFinancialActions({
      dataAgentOutput: output({
        confidence: 0.72,
        requires_confirmation: true,
        result: [action({ confidence: 0.72 })],
      }),
      accounts: [],
      categories: [{ id: "alimentacion", is_sensitive: false }],
      sourceRef: `whatsapp:${externalEventId}`,
      receivedAt: "2026-06-08T10:00:00.000-05:00",
    channel: "whatsapp" as const,
  });
    const plannedAction = plan.actions[0];

    const pending = buildPendingInputFromDataAction({
      action: plannedAction,
      userId,
      externalEventId,
      originalMessage: "gaste 8 cafe",
    channel: "whatsapp" as const,
    });

    expect(pending.type).toBe("ambiguous_movement");
    expect(pending.source).toBe("ambiguous_movement");
    expect(pending.riskLevel).toBe("medium");
    expect(pending.normalizedSummary.title).toBe("cafe");
    expect(pending.normalizedSummary.amount).toBe(8);
    expect(pending.normalizedSummary.account_hint).toBeNull();
    expect(pending.normalizedSummary.confidence_label).toBe("Confianza baja");
    expect(pending.metadata.money_sign).toBe("negative");
    expect(pending.proposedAction.movement_type).toBe("gasto");
  });

  it("eleva categorias sensibles a risk_confirmation", () => {
    const plan = planDataAgentFinancialActions({
      dataAgentOutput: output({
        result: [action({ category_id: "salud", description: "farmacia" })],
      }),
      accounts: [{ id: "00000000-0000-4000-8000-0000000000aa", is_default: true }],
      categories: [{ id: "salud", is_sensitive: true }],
      sourceRef: `whatsapp:${externalEventId}`,
      receivedAt: "2026-06-08T10:00:00.000-05:00",
    channel: "whatsapp" as const,
  });
    const pending = buildPendingInputFromDataAction({
      action: plan.actions[0],
      userId,
      externalEventId,
      originalMessage: "gaste 8 farmacia",
    channel: "whatsapp" as const,
    });

    expect(pending.type).toBe("risk_confirmation");
    expect(pending.source).toBe("risk_confirmation");
    expect(pending.riskLevel).toBe("sensitive");
    expect(pending.normalizedSummary.confidence_label).toBe(
      "Revisar con cuidado"
    );
  });

  it("usa source_ref estable por evento y accion", () => {
    expect(
      buildPendingSourceRef({
        channel: "whatsapp",
        externalEventId,
        actionId: "action_1",
      })
    ).toBe(`whatsapp:${externalEventId}:action_1`);
  });

  it("crea Pending solo para la accion ambigua de un lote mixto", async () => {
    const plan = planDataAgentFinancialActions({
      dataAgentOutput: output({
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
      }),
      accounts: [],
      categories: [{ id: "alimentacion", is_sensitive: false }],
      sourceRef: `whatsapp:${externalEventId}`,
      receivedAt: "2026-06-08T10:00:00.000-05:00",
    channel: "whatsapp" as const,
  });
    mockedCreatePendingItem.mockResolvedValue({
      idempotent: false,
      pendingItem: {
        id: "pending-ambiguous",
        user_id: userId,
        type: "ambiguous_movement",
        status: "pending",
        source: "ambiguous_movement",
        source_ref: `whatsapp:${externalEventId}:ambiguous_action`,
        proposed_action: {},
        normalized_summary: { title: "otra compra" },
        dedup_status: null,
        risk_level: "medium",
        expires_at: null,
        sent_for_confirmation_at: null,
        resolved_at: null,
        resolved_by: null,
        created_at: "2026-06-08T10:00:00.000-05:00",
        updated_at: "2026-06-08T10:00:00.000-05:00",
        metadata: {},
      },
    });

    const result = await createPendingItemsForDataActionPlan({
      client: {} as never,
      plan,
      userId,
      traceId: "trace-mixed",
      externalEventId,
      originalMessage: "20 desayuno y 15 otra compra",
    channel: "whatsapp" as const,
    });

    expect(result).toMatchObject({
      kind: "created",
      created_count: 1,
      pending_items: [
        expect.objectContaining({ action_id: "ambiguous_action" }),
      ],
    });
    expect(mockedCreatePendingItem).toHaveBeenCalledTimes(1);
    expect(mockedCreatePendingItem).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        sourceRef: `whatsapp:${externalEventId}:ambiguous_action`,
      })
    );
  });

  it("nunca degrada un borrador de deuda a Pending de movimiento generico", async () => {
    const plan = planDataAgentFinancialActions({
      confirmedByUser: false,
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

    const result = await createPendingItemsForDataActionPlan({
      client: {} as never,
      plan,
      userId,
      traceId: "trace-debt-draft",
      externalEventId,
      originalMessage:
        "Juan me presto 100 soles, le voy a pagar en 5 cuotas",
    channel: "whatsapp" as const,
    });

    expect(plan.actions[0]).toMatchObject({
      decision: "blocked",
      movement_input: null,
      debt_creation_input: expect.any(Object),
    });
    expect(result).toEqual({
      kind: "not_created",
      reason: "no_confirmable_actions",
      created_count: 0,
      idempotent_count: 0,
      pending_items: [],
    });
    expect(mockedCreatePendingItem).not.toHaveBeenCalled();
  });
});
