import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshDebtLifecycle } from "@/core/debts/debt-lifecycle-service";
import { CoreError } from "@/core/finance/errors";
import type {
  DebtPaymentCommitInput,
  DebtPaymentCommitResult,
  DebtPaymentExecutionPort,
} from "@/core/debts/debt-payment-command";
import type { Database } from "@/data/supabase/types";
import { getAccountById } from "./accounts.repository";
import {
  commitDebtPayment,
  commitPendingDebtPayment,
  getDebtPaymentByMovementId,
  getDebtById,
  listDebtInstallmentsForDebt,
} from "./debts.repository";
import { SupabaseFinancialCoreRepository } from "./movements.repository";

type Client = SupabaseClient<Database>;

export type PendingDebtPaymentResolution = {
  pendingItemId: string;
  actorId: string;
  traceId: string;
};

export class SupabaseDebtPaymentExecutionPort
  implements DebtPaymentExecutionPort
{
  private readonly movements: SupabaseFinancialCoreRepository;

  constructor(
    private readonly readClient: Client,
    private readonly writeClient: Client = readClient,
    private readonly pendingResolution: PendingDebtPaymentResolution | null = null,
  ) {
    this.movements = new SupabaseFinancialCoreRepository(readClient);
  }

  async findByIdempotencyKey(
    userId: string,
    idempotencyKey: string
  ): Promise<DebtPaymentCommitResult | null> {
    const movement = await this.movements.findMovementByIdempotencyKey(
      userId,
      idempotencyKey
    );
    if (!movement) return null;
    if (!movement.debt_id) {
      throw new CoreError(
        "DEBT_PAYMENT_IDEMPOTENCY_CONFLICT",
        "La llave de idempotencia ya pertenece a otra operacion."
      );
    }

    const [debt, payment] = await Promise.all([
      getDebtById(this.readClient, userId, movement.debt_id),
      getDebtPaymentByMovementId(this.readClient, userId, movement.id),
    ]);
    if (!debt || !payment) {
      throw new CoreError(
        "DEBT_PAYMENT_IDEMPOTENCY_CONFLICT",
        "La llave de idempotencia no corresponde a un pago de deuda valido."
      );
    }

    return {
      movement,
      debt,
      payment,
      installment_allocations: payment.allocations,
      allocation_policy: "oldest_open_due_date_first_v1",
      idempotent: true,
    };
  }

  getDebt(userId: string, debtId: string) {
    return getDebtById(this.readClient, userId, debtId);
  }

  getAccount(userId: string, accountId: string) {
    return getAccountById(this.readClient, userId, accountId);
  }

  async listInstallments(userId: string, debtId: string) {
    const installments = await listDebtInstallmentsForDebt(
      this.readClient,
      userId,
      debtId
    );
    return installments.map((item) => ({
      id: item.id,
      user_id: item.user_id,
      debt_id: item.debt_id,
      number: item.number,
      due_date: item.due_date,
      expected_amount: item.expected_amount,
      paid_amount: item.paid_amount,
      status: item.status,
      movement_id: item.movement_id,
      metadata: item.metadata,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));
  }

  commit(input: DebtPaymentCommitInput) {
    if (this.pendingResolution) {
      return commitPendingDebtPayment(this.writeClient, {
        pendingItemId: this.pendingResolution.pendingItemId,
        actorId: this.pendingResolution.actorId,
        traceId: this.pendingResolution.traceId,
        ...input,
      });
    }
    return commitDebtPayment(this.writeClient, input);
  }

  async refreshLifecycle(userId: string, traceId: string): Promise<void> {
    await refreshDebtLifecycle(this.writeClient, userId, { traceId });
  }
}
