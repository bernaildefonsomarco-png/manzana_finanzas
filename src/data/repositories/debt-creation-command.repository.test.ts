import { describe, expect, it, vi } from "vitest";
import type { DebtCreationCommitInput } from "@/core/debts/debt-creation-command";
import { SupabaseDebtCreationExecutionPort } from "./debt-creation-command.repository";

describe("SupabaseDebtCreationExecutionPort", () => {
  it("conserva due_date en una deuda sin cuotas y no inventa persona", async () => {
    const rpc = vi.fn(async () => ({
      data: {
        debt: { id: "11111111-1111-4111-8111-111111111111" },
        installments: [],
        movement: null,
        idempotent: false,
      },
      error: null,
    }));
    const client = { rpc } as unknown as ConstructorParameters<
      typeof SupabaseDebtCreationExecutionPort
    >[0];
    const port = new SupabaseDebtCreationExecutionPort(client);

    await port.commit({
      debtId: "11111111-1111-4111-8111-111111111111",
      command: {
        type: "CreateDebtCommand",
        command_id: "22222222-2222-4222-8222-222222222222",
        user_id: "33333333-3333-4333-8333-333333333333",
        actor: { type: "user", id: "33333333-3333-4333-8333-333333333333" },
        source: "api.v1.debts.post",
        trace_id: "44444444-4444-4444-8444-444444444444",
        payload: {
          direction: "i_owe",
          kind: "credit_card",
          name: "Tarjeta simple",
          related_person_name: null,
          principal_amount: 500,
          currency: "PEN",
          opened_at: "2026-07-01",
          due_date: "2026-08-15",
          first_due_date: null,
          installment_count: null,
          installment_amount: null,
          interest_notes: null,
          account_id: null,
          movement_type: "deuda_adquirida",
          idempotency_key: "create-card-123",
          creation_source: "dashboard_manual",
        },
      },
      normalizedRelatedPersonName: null,
      installments: [],
      movementCommit: null,
      outboxEvents: [],
    } satisfies DebtCreationCommitInput);

    expect(rpc).toHaveBeenCalledWith(
      "commit_debt_creation",
      expect.objectContaining({
        p_related_person_normalized_name: null,
        p_debt: expect.objectContaining({
          due_date: "2026-08-15",
          related_person_name: null,
        }),
      })
    );
  });
});
