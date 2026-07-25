import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Account, PendingItem } from "@/shared/types/domain";
import { reviewOrUpdatePendingAccounts } from "./pending-account-review";

const mocks = vi.hoisted(() => ({
  getActiveAccounts: vi.fn(),
  linkEmailAccountHint: vi.fn(),
  updatePendingSummary: vi.fn(),
}));

vi.mock("@/data/repositories/accounts.repository", () => ({
  getActiveAccounts: mocks.getActiveAccounts,
  linkEmailAccountHint: mocks.linkEmailAccountHint,
}));

vi.mock("@/data/repositories/pending.repository", () => ({
  updatePendingSummary: mocks.updatePendingSummary,
}));

const userId = "11111111-1111-4111-8111-111111111111";
const originId = "22222222-2222-4222-8222-222222222222";
const destinationId = "33333333-3333-4333-8333-333333333333";

describe("pending account conversational review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActiveAccounts.mockResolvedValue([
      account(originId, "Tarjeta BCP"),
      account(destinationId, "Efectivo"),
      account(
        "44444444-4444-4444-8444-444444444444",
        "Cuenta dólares",
        "USD",
      ),
    ]);
    mocks.updatePendingSummary.mockImplementation(
      async (
        _client,
        _userId,
        _pendingId,
        summary,
        _traceId,
        proposedAction,
      ) => ({
        ...pending(),
        normalized_summary: summary,
        proposed_action: proposedAction,
        status: "user_edited",
      }),
    );
    mocks.linkEmailAccountHint.mockResolvedValue({
      account: account(originId, "Tarjeta BCP"),
      idempotent: false,
    });
  });

  it("propone solo cuentas existentes y compatibles sin editar", async () => {
    const result = await reviewOrUpdatePendingAccounts({
      client: {} as never,
      userId,
      pendingItem: pending(),
      action: "review",
      traceId: "trace-review",
    });

    expect(result).toMatchObject({
      kind: "reviewed",
      readyForConfirmation: false,
      accountOptions: [
        { id: originId, name: "Tarjeta BCP", currency: "PEN" },
        { id: destinationId, name: "Efectivo", currency: "PEN" },
      ],
    });
    expect(mocks.updatePendingSummary).not.toHaveBeenCalled();
  });

  it("asigna cuentas por sus nombres reales y deja una confirmacion pendiente", async () => {
    const result = await reviewOrUpdatePendingAccounts({
      client: {} as never,
      userId,
      pendingItem: pending(),
      action: "assign_transfer",
      userText: "P-ABC12345 fue de Tarjeta BCP a Efectivo",
      traceId: "trace-assign",
    });

    expect(result).toMatchObject({
      kind: "updated",
      reason: "pending_ready_for_confirmation",
      readyForConfirmation: true,
    });
    expect(mocks.updatePendingSummary).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      expect.any(String),
      expect.objectContaining({
        category_id: null,
      }),
      "trace-assign",
      expect.objectContaining({
        action: "record_transfer",
        movement_type: "transferencia",
        account_origin_id: originId,
        account_destination_id: destinationId,
        movement_input: expect.objectContaining({
          type: "transferencia",
          account_origin_id: originId,
          account_destination_id: destinationId,
        }),
      }),
    );
  });

  it("permite reclasificar un pago externo como gasto sin crear cuenta", async () => {
    const result = await reviewOrUpdatePendingAccounts({
      client: {} as never,
      userId,
      pendingItem: pending(),
      action: "classify_expense",
      accountOriginId: null,
      categoryId: null,
      userText: "P-ABC12345 fue un gasto sin cuenta",
      traceId: "trace-expense",
    });

    expect(result).toMatchObject({
      kind: "updated",
      readyForConfirmation: true,
      pendingItem: {
        normalized_summary: { category_id: "otros" },
        proposed_action: {
          action: "create_movement",
          movement_type: "gasto",
          account_id: null,
          movement_input: {
            type: "gasto",
            category_id: "otros",
            account_origin_id: null,
          },
        },
      },
    });
  });

  it("aprende una pista solo cuando la asociacion es explicita", async () => {
    const result = await reviewOrUpdatePendingAccounts({
      client: {} as never,
      userId,
      pendingItem: pending(),
      action: "assign_transfer",
      accountOriginId: originId,
      accountDestinationId: destinationId,
      learnAccountAliases: true,
      userText:
        "Recuerda que la 3087 es Tarjeta BCP y la 9039 es Efectivo",
      traceId: "trace-learn",
    });

    expect(result.learnedHints).toEqual([
      "Clásica ****3087",
      "Clásica ****9039",
    ]);
    expect(mocks.linkEmailAccountHint).toHaveBeenCalledTimes(2);
  });

  it("no persiste alias por una seleccion puntual", async () => {
    await reviewOrUpdatePendingAccounts({
      client: {} as never,
      userId,
      pendingItem: pending(),
      action: "assign_transfer",
      accountOriginId: originId,
      accountDestinationId: destinationId,
      learnAccountAliases: true,
      userText: "Fue de Tarjeta BCP a Efectivo",
      traceId: "trace-no-learn",
    });

    expect(mocks.linkEmailAccountHint).not.toHaveBeenCalled();
  });

  it("rechaza usar la misma cuenta como origen y destino", async () => {
    const result = await reviewOrUpdatePendingAccounts({
      client: {} as never,
      userId,
      pendingItem: pending(),
      action: "assign_transfer",
      accountOriginId: originId,
      accountDestinationId: originId,
      traceId: "trace-same-account",
    });

    expect(result).toMatchObject({
      kind: "needs_clarification",
      reason: "transfer_accounts_must_differ",
    });
    expect(mocks.updatePendingSummary).not.toHaveBeenCalled();
  });
});

function account(
  id: string,
  name: string,
  currency = "PEN",
): Account {
  return {
    id,
    user_id: userId,
    name,
    institution: name === "Efectivo" ? null : "BCP",
    type: name === "Efectivo" ? "fisico" : "tarjeta",
    currency,
    initial_balance: 0,
    current_balance: 100,
    is_default: name === "Tarjeta BCP",
    color: null,
    icon: null,
    metadata: {},
    created_at: "2026-07-23T10:00:00.000Z",
    updated_at: "2026-07-23T10:00:00.000Z",
    deleted_at: null,
  };
}

function pending(): PendingItem {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    user_id: userId,
    type: "email_detected",
    status: "sent_for_confirmation",
    source: "email_pending",
    source_ref: "gmail:message",
    proposed_action: {
      action: "review_specialized",
      movement_type: "transferencia",
      movement_input: {
        type: "transferencia",
        amount: 10,
        currency: "PEN",
        occurred_at: "2026-07-23T12:00:00.000Z",
        description: "Transferencia",
        merchant: null,
        category_id: null,
        subcategory_id: null,
        account_origin_id: null,
        account_destination_id: null,
        box_origin_id: null,
        box_destination_id: null,
        related_person_id: null,
        debt_id: null,
        recurring_rule_id: null,
        recurring_occurrence_id: null,
        source: "email_confirmed",
        source_ref: "gmail:message",
        confidence: 0.99,
        requires_review: true,
        metadata: {},
      },
    },
    normalized_summary: {
      title: "Transferencia entre cuentas",
      amount: 10,
      currency: "PEN",
      occurred_at: "2026-07-23T12:00:00.000Z",
      category_id: null,
    },
    dedup_status: null,
    risk_level: "low",
    expires_at: null,
    sent_for_confirmation_at: "2026-07-23T12:01:00.000Z",
    resolved_at: null,
    resolved_by: null,
    created_at: "2026-07-23T12:00:30.000Z",
    updated_at: "2026-07-23T12:01:00.000Z",
    metadata: {
      suggested_movement_type: "transferencia",
      account_origin_hint: "Clásica ****3087",
      account_destination_hint: "Clásica ****9039",
    },
  };
}
