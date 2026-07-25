import { randomUUID } from "node:crypto";

import type { OutboxEventDraft } from "@/core/events/domain-events";
import {
  buildCreateMovementCommitPayload,
  type CreateDebtCommand,
} from "@/core/finance";
import {
  CoreError,
  type CoreErrorCode,
} from "@/core/finance/errors";
import type { MovementCommitPayload } from "@/core/finance/repository";
import type { MovementInput } from "@/shared/schemas/money";
import type {
  Account,
  Debt,
  DebtInstallment,
  Movement,
} from "@/shared/types/domain";

export type DebtCreationCommandResult = {
  type: "debt_created";
  debt: Debt;
  installments: DebtInstallment[];
  loan_movement: Movement | null;
  idempotent: boolean;
};

export type DebtCreationCommitInput = {
  debtId: string;
  command: CreateDebtCommand;
  normalizedRelatedPersonName: string;
  installments: Array<{
    id: string;
    user_id: string;
    debt_id: string;
    number: number;
    due_date: string;
    expected_amount: number;
    paid_amount: 0;
    status: "pending";
    metadata: Record<string, unknown>;
  }>;
  movementCommit: MovementCommitPayload | null;
  outboxEvents: OutboxEventDraft[];
};

export interface DebtCreationExecutionPort {
  getAccount(userId: string, accountId: string): Promise<Account | null>;
  commit(input: DebtCreationCommitInput): Promise<
    Omit<DebtCreationCommandResult, "type">
  >;
}

export class DebtCreationCommandHandler {
  constructor(private readonly port: DebtCreationExecutionPort) {}

  async execute(
    command: CreateDebtCommand,
  ): Promise<DebtCreationCommandResult> {
    const account = command.payload.account_id
      ? await this.port.getAccount(
          command.user_id,
          command.payload.account_id,
        )
      : null;
    if (command.payload.account_id && !account) {
      throw new CoreError(
        "DEBT_CREATION_ACCOUNT_NOT_FOUND",
        "No encontre la cuenta vinculada a la deuda.",
      );
    }
    if (account && account.currency !== command.payload.currency) {
      throw new CoreError(
        "DEBT_CREATION_ACCOUNT_CURRENCY_MISMATCH",
        "La cuenta y la deuda deben tener la misma moneda.",
      );
    }

    const debtId = randomUUID();
    const installments = buildInstallments(command, debtId);
    const movementCommit = account
      ? buildCreateMovementCommitPayload(
          buildDebtCreationMovementCommand(command, debtId, account),
        )
      : null;
    const outboxEvents = buildDebtCreationOutboxEvents({
      command,
      debtId,
      movementId: movementCommit?.movement.id ?? null,
    });

    try {
      const result = await this.port.commit({
        debtId,
        command,
        normalizedRelatedPersonName: normalizePersonName(
          command.payload.related_person_name,
        ),
        installments,
        movementCommit,
        outboxEvents,
      });
      return { type: "debt_created", ...result };
    } catch (error) {
      throw mapDebtCreationCommitError(error);
    }
  }
}

function buildInstallments(
  command: CreateDebtCommand,
  debtId: string,
): DebtCreationCommitInput["installments"] {
  const count = command.payload.installment_count;
  const firstDueDate = command.payload.first_due_date;
  if (!count || !firstDueDate) return [];
  const baseAmount =
    command.payload.installment_amount ??
    roundMoney(command.payload.principal_amount / count);

  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const expectedAmount =
      number === count && command.payload.installment_amount === null
        ? roundMoney(
            command.payload.principal_amount - baseAmount * (count - 1),
          )
        : roundMoney(baseAmount);
    return {
      id: randomUUID(),
      user_id: command.user_id,
      debt_id: debtId,
      number,
      due_date: addMonthsIsoDate(firstDueDate, index),
      expected_amount: expectedAmount,
      paid_amount: 0,
      status: "pending",
      metadata: {
        created_from: command.payload.creation_source,
        schedule: "monthly_v1",
        trace_id: command.trace_id,
      },
    };
  });
}

function addMonthsIsoDate(value: string, monthsToAdd: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const target = new Date(Date.UTC(year!, month! - 1 + monthsToAdd, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return `${target.getUTCFullYear()}-${String(
    target.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(Math.min(day!, lastDay)).padStart(2, "0")}`;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildDebtCreationMovementCommand(
  command: CreateDebtCommand,
  debtId: string,
  account: Account,
) {
  const movement: MovementInput = {
    type: command.payload.movement_type,
    amount: command.payload.principal_amount,
    currency: command.payload.currency,
    occurred_at: `${command.payload.opened_at}T12:00:00-05:00`,
    description: command.payload.name,
    merchant: null,
    category_id: null,
    subcategory_id: null,
    account_origin_id:
      command.payload.direction === "they_owe_me" ? account.id : null,
    account_destination_id:
      command.payload.direction === "i_owe" ? account.id : null,
    box_origin_id: null,
    box_destination_id: null,
    related_person_id: null,
    debt_id: debtId,
    recurring_rule_id: null,
    recurring_occurrence_id: null,
    source: command.payload.creation_source,
    source_ref: `${command.payload.creation_source}-debt-creation:${command.payload.idempotency_key}`,
    confidence: 1,
    requires_review: false,
    metadata: {
      reason: "specialized_debt_creation",
      debt_direction: command.payload.direction,
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
      idempotency_key: `${command.payload.idempotency_key}:movement`,
    },
  };
}

function buildDebtCreationOutboxEvents(input: {
  command: CreateDebtCommand;
  debtId: string;
  movementId: string | null;
}): OutboxEventDraft[] {
  return [
    {
      id: randomUUID(),
      user_id: input.command.user_id,
      event_type: "debt_created",
      aggregate_type: "debt",
      aggregate_id: input.debtId,
      payload: {
        debt_id: input.debtId,
        movement_id: input.movementId,
        direction: input.command.payload.direction,
        principal_amount: input.command.payload.principal_amount,
        currency: input.command.payload.currency,
        installment_count: input.command.payload.installment_count,
        first_due_date: input.command.payload.first_due_date,
        idempotency_key: input.command.payload.idempotency_key,
      },
      payload_version: 1,
      trace_id: input.command.trace_id,
      metadata: {
        source: input.command.source,
        specialized_command: "CreateDebtCommand",
      },
    },
  ];
}

function normalizePersonName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function mapDebtCreationCommitError(error: unknown): unknown {
  if (error instanceof CoreError) return error;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message: unknown }).message)
        : "";
  const codes = [
    "DEBT_CREATION_IDEMPOTENCY_KEY_REQUIRED",
    "DEBT_CREATION_IDEMPOTENCY_CONFLICT",
    "DEBT_CREATION_INVALID_AMOUNT",
    "DEBT_CREATION_INVALID_CURRENCY",
    "DEBT_CREATION_INVALID_INSTALLMENTS",
    "DEBT_CREATION_INVALID_DIRECTION",
  ] satisfies CoreErrorCode[];
  for (const code of codes) {
    if (message.includes(code)) {
      return new CoreError(code, "No pude crear la deuda de forma segura.");
    }
  }
  return error;
}
