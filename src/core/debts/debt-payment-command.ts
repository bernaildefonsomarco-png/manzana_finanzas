import { randomUUID } from "node:crypto";
import type { OutboxEventDraft } from "@/core/events/domain-events";
import {
  buildCreateMovementCommitPayload,
  type RecordDebtPaymentCommand,
} from "@/core/finance";
import { CoreError } from "@/core/finance/errors";
import type { MovementCommitPayload } from "@/core/finance/repository";
import type { MovementInput } from "@/shared/schemas/money";
import type {
  Account,
  Debt,
  DebtInstallment,
  DebtPayment,
  DebtPaymentAllocation,
  Movement,
} from "@/shared/types/domain";

export type DebtPaymentCommandResult = {
  type: "debt_payment_recorded";
  movement: Movement;
  debt: Debt;
  payment: DebtPayment;
  installment_allocations: DebtPaymentAllocation[];
  allocation_policy: "oldest_open_due_date_first_v1";
  idempotent: boolean;
};

export type DebtPaymentCommitInput = {
  debtId: string;
  payment: Omit<DebtPayment, "created_at">;
  movementCommit: MovementCommitPayload;
  debtOutboxEvents: OutboxEventDraft[];
};

export type DebtPaymentCommitResult = Omit<DebtPaymentCommandResult, "type">;

export interface DebtPaymentExecutionPort {
  findByIdempotencyKey(
    userId: string,
    idempotencyKey: string
  ): Promise<DebtPaymentCommitResult | null>;
  getDebt(userId: string, debtId: string): Promise<Debt | null>;
  getAccount(userId: string, accountId: string): Promise<Account | null>;
  listInstallments(userId: string, debtId: string): Promise<DebtInstallment[]>;
  commit(input: DebtPaymentCommitInput): Promise<DebtPaymentCommitResult>;
  refreshLifecycle(userId: string, traceId: string): Promise<void>;
}

export class DebtPaymentCommandHandler {
  constructor(private readonly port: DebtPaymentExecutionPort) {}

  async execute(
    command: RecordDebtPaymentCommand
  ): Promise<DebtPaymentCommandResult> {
    const existing = await this.port.findByIdempotencyKey(
      command.user_id,
      command.payload.idempotency_key
    );
    if (existing) {
      if (existing.debt.id !== command.payload.debt_id) {
        throw new CoreError(
          "DEBT_PAYMENT_IDEMPOTENCY_CONFLICT",
          "La llave de idempotencia ya pertenece a otro pago de deuda."
        );
      }
      return { type: "debt_payment_recorded", ...existing, idempotent: true };
    }

    const debt = await this.port.getDebt(
      command.user_id,
      command.payload.debt_id
    );
    if (!debt) {
      throw new CoreError("DEBT_NOT_FOUND", "No encontre esa deuda.", {
        debt_id: command.payload.debt_id,
      });
    }
    if (!isActiveDebt(debt)) {
      throw new CoreError("DEBT_NOT_ACTIVE", "Esa deuda ya no esta activa.", {
        debt_id: debt.id,
        status: debt.status,
      });
    }
    if (command.payload.amount > debt.current_balance) {
      throw new CoreError(
        "DEBT_PAYMENT_EXCEEDS_BALANCE",
        "El pago supera el saldo pendiente de la deuda.",
        { debt_id: debt.id, current_balance: debt.current_balance }
      );
    }
    if (
      command.payload.currency !== null &&
      command.payload.currency !== debt.currency
    ) {
      throw new CoreError(
        "DEBT_PAYMENT_CURRENCY_MISMATCH",
        "La moneda del pago no coincide con la deuda.",
        {
          debt_id: debt.id,
          debt_currency: debt.currency,
          payment_currency: command.payload.currency,
        }
      );
    }

    const account = command.payload.account_id
      ? await this.port.getAccount(command.user_id, command.payload.account_id)
      : null;
    if (command.payload.account_id && !account) {
      throw new CoreError(
        "DEBT_PAYMENT_ACCOUNT_NOT_FOUND",
        "No encontre esa cuenta.",
        { account_id: command.payload.account_id }
      );
    }
    if (account && account.currency !== debt.currency) {
      throw new CoreError(
        "DEBT_PAYMENT_ACCOUNT_CURRENCY_MISMATCH",
        "La cuenta y la deuda deben tener la misma moneda en V1.",
        {
          account_id: account.id,
          account_currency: account.currency,
          debt_currency: debt.currency,
        }
      );
    }

    await this.validateInstallment(command, debt);

    const movementCommand = buildDebtPaymentMovementCommand({
      command,
      debt,
      account,
    });
    const movementCommit = buildCreateMovementCommitPayload(movementCommand);
    const paymentId = randomUUID();
    const debtOutboxEvents = buildDebtPaymentOutboxEvents({
      command,
      debt,
      movement: movementCommit.movement,
      paymentId,
    });
    let result: DebtPaymentCommitResult;
    try {
      result = await this.port.commit({
        debtId: debt.id,
        payment: {
        id: paymentId,
        user_id: command.user_id,
        debt_id: debt.id,
        movement_id: movementCommit.movement.id,
        amount: command.payload.amount,
        currency: debt.currency,
        paid_at: command.payload.paid_at,
        source: command.payload.payment_source,
        metadata: {
          note: command.payload.note,
          idempotency_key: command.payload.idempotency_key,
          previous_balance: debt.current_balance,
          projected_balance: roundMoney(
            debt.current_balance - command.payload.amount
          ),
          installment_id: command.payload.installment_id,
          installment_number: command.payload.installment_number,
        },
        },
        movementCommit,
        debtOutboxEvents,
      });
    } catch (error) {
      throw mapDebtPaymentCommitError(error);
    }

    try {
      await this.port.refreshLifecycle(command.user_id, command.trace_id);
    } catch {
      // El commit financiero ya termino. El worker/outbox puede reintentar el refresh.
    }

    return { type: "debt_payment_recorded", ...result };
  }

  private async validateInstallment(
    command: RecordDebtPaymentCommand,
    debt: Debt
  ): Promise<void> {
    const { installment_id: installmentId, installment_number: installmentNumber } =
      command.payload;
    if (!installmentId && !installmentNumber) return;

    const installments = await this.port.listInstallments(
      command.user_id,
      debt.id
    );
    const target = installments.find(
      (installment) =>
        (!installmentId || installment.id === installmentId) &&
        (!installmentNumber || installment.number === installmentNumber)
    );
    if (!target) {
      throw new CoreError(
        "DEBT_INSTALLMENT_NOT_FOUND",
        "No encontre esa cuota dentro de la deuda.",
        {
          debt_id: debt.id,
          installment_id: installmentId,
          installment_number: installmentNumber,
        }
      );
    }

    const oldestOpen = installments
      .filter((installment) =>
        ["pending", "due_soon", "overdue"].includes(installment.status)
      )
      .sort((left, right) =>
        left.due_date === right.due_date
          ? left.number - right.number
          : left.due_date.localeCompare(right.due_date)
      )[0];
    if (!oldestOpen || oldestOpen.id !== target.id) {
      throw new CoreError(
        "DEBT_INSTALLMENT_NOT_ACTIONABLE",
        "Ese pago debe aplicarse primero a la cuota abierta mas antigua.",
        {
          debt_id: debt.id,
          installment_id: target.id,
          oldest_open_installment_id: oldestOpen?.id ?? null,
        }
      );
    }
  }
}

function buildDebtPaymentMovementCommand(params: {
  command: RecordDebtPaymentCommand;
  debt: Debt;
  account: Account | null;
}) {
  const { command, debt, account } = params;
  const movementType =
    debt.direction === "i_owe" ? "pago_deuda" : "devolucion_recibida";
  const description =
    command.payload.note ||
    (debt.direction === "i_owe"
      ? `Pago de ${debt.name}`
      : `Devolucion de ${debt.name}`);
  const movement: MovementInput = {
    type: movementType,
    amount: command.payload.amount,
    currency: debt.currency,
    occurred_at: command.payload.paid_at,
    description,
    merchant: null,
    category_id: null,
    subcategory_id: null,
    account_origin_id: debt.direction === "i_owe" ? account?.id ?? null : null,
    account_destination_id:
      debt.direction === "they_owe_me" ? account?.id ?? null : null,
    box_origin_id: null,
    box_destination_id: null,
    related_person_id: debt.related_person_id,
    debt_id: debt.id,
    recurring_rule_id: null,
    recurring_occurrence_id: null,
    source: command.payload.payment_source,
    source_ref: `${command.payload.payment_source}-debt-payment:${command.payload.idempotency_key}`,
    confidence: 1,
    requires_review: false,
    metadata: {
      reason: "specialized_debt_payment",
      debt_id: debt.id,
      debt_direction: debt.direction,
      account_id: account?.id ?? null,
      installment_id: command.payload.installment_id,
      installment_number: command.payload.installment_number,
      trace_id: command.trace_id,
    },
  };

  return {
    type: "CreateMovementCommand" as const,
    command_id: command.command_id,
    user_id: command.user_id,
    actor: command.actor,
    source: command.source,
    trace_id: command.trace_id,
    payload: {
      movement,
      idempotency_key: command.payload.idempotency_key,
    },
  };
}

function buildDebtPaymentOutboxEvents(params: {
  command: RecordDebtPaymentCommand;
  debt: Debt;
  movement: MovementCommitPayload["movement"];
  paymentId: string;
}): OutboxEventDraft[] {
  const { command, debt, movement, paymentId } = params;
  const projectedBalance = roundMoney(
    debt.current_balance - command.payload.amount
  );
  const basePayload = {
    debt_id: debt.id,
    movement_id: movement.id,
    payment_id: paymentId,
    amount: command.payload.amount,
    currency: debt.currency,
    paid_at: command.payload.paid_at,
    previous_balance: debt.current_balance,
    projected_balance: projectedBalance,
    direction: debt.direction,
    idempotency_key: command.payload.idempotency_key,
    installment_id: command.payload.installment_id,
    installment_number: command.payload.installment_number,
    allocation_policy: "oldest_open_due_date_first_v1",
  };
  const events: OutboxEventDraft[] = [
    {
      id: randomUUID(),
      user_id: command.user_id,
      event_type: "debt_payment_registered",
      aggregate_type: "debt",
      aggregate_id: debt.id,
      payload: basePayload,
      payload_version: 1,
      trace_id: command.trace_id,
      metadata: { source: command.source, movement_type: movement.type },
    },
  ];
  if (projectedBalance === 0) {
    events.push({
      id: randomUUID(),
      user_id: command.user_id,
      event_type: "debt_paid",
      aggregate_type: "debt",
      aggregate_id: debt.id,
      payload: basePayload,
      payload_version: 1,
      trace_id: command.trace_id,
      metadata: { source: command.source },
    });
  }
  return events;
}

export function isActiveDebt(debt: Debt): boolean {
  return ["active", "due_soon", "overdue"].includes(debt.status);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function mapDebtPaymentCommitError(error: unknown): unknown {
  if (error instanceof CoreError) return error;
  const message =
    error instanceof Error ? error.message : JSON.stringify(error) || String(error);
  const mappings: Array<{
    marker: string;
    code: ConstructorParameters<typeof CoreError>[0];
    message: string;
  }> = [
    {
      marker: "DEBT_PAYMENT_EXCEEDS_BALANCE",
      code: "DEBT_PAYMENT_EXCEEDS_BALANCE",
      message: "El pago supera el saldo pendiente de la deuda.",
    },
    {
      marker: "DEBT_NOT_ACTIVE",
      code: "DEBT_NOT_ACTIVE",
      message: "Esa deuda ya no esta activa.",
    },
    {
      marker: "DEBT_NOT_FOUND",
      code: "DEBT_NOT_FOUND",
      message: "No encontre esa deuda.",
    },
    {
      marker: "DEBT_PAYMENT_CURRENCY_MISMATCH",
      code: "DEBT_PAYMENT_CURRENCY_MISMATCH",
      message: "La moneda del pago no coincide con la deuda.",
    },
    {
      marker: "DEBT_PAYMENT_IDEMPOTENCY_CONFLICT",
      code: "DEBT_PAYMENT_IDEMPOTENCY_CONFLICT",
      message: "La llave de idempotencia ya pertenece a otra operacion.",
    },
  ];
  const mapping = mappings.find((candidate) => message.includes(candidate.marker));
  return mapping ? new CoreError(mapping.code, mapping.message) : error;
}
