import { randomUUID } from "node:crypto";
import type {
  CommandResult,
  CoreCommand,
} from "@/core/finance";
import type { Movement } from "@/shared/types/domain";
import type { DataActionPlan } from "./data-action-policy";

export type DataActionExecutionResult =
  | {
      kind: "not_executed";
      reason:
        | "core_execution_disabled"
        | "plan_not_ready_for_core"
        | "no_ready_actions";
      created_count: 0;
      idempotent_count: 0;
      movements: [];
    }
  | {
      kind: "executed";
      reason: "all_ready_actions_executed";
      created_count: number;
      idempotent_count: number;
      movements: ExecutedDataActionMovement[];
      debts?: ExecutedDataActionDebt[];
    };

export type ExecutedDataActionMovement = {
  action_id: string;
  movement_id: string;
  idempotent: boolean;
  movement_type: Movement["type"];
  amount: Movement["amount"];
  currency: Movement["currency"];
  occurred_at: Movement["occurred_at"];
  description: Movement["description"];
  category_id: Movement["category_id"];
  account_origin_id: Movement["account_origin_id"];
  account_destination_id: Movement["account_destination_id"];
  status: Movement["status"];
  debt_id?: Movement["debt_id"];
  debt_name?: string | null;
  debt_remaining_balance?: number | null;
  debt_payment_id?: string | null;
};

export type ExecutedDataActionDebt = {
  action_id: string;
  debt_id: string;
  idempotent: boolean;
  name: string;
  direction: "i_owe" | "they_owe_me";
  principal_amount: number;
  current_balance: number;
  currency: "PEN" | "USD";
  installment_count: number;
  first_due_date: string | null;
  movement_id: string | null;
};

export async function executeReadyDataActionPlan(params: {
  plan: DataActionPlan;
  dispatcher: {
    dispatch(command: CoreCommand): Promise<CommandResult>;
  };
  userId: string;
  traceId: string;
  externalEventId: string;
}): Promise<DataActionExecutionResult> {
  const readyActions = params.plan.actions.filter(
    (action) =>
      action.decision === "ready_for_core" &&
      (action.movement_input ||
        action.debt_payment_input ||
        action.debt_creation_input)
  );

  if (readyActions.length === 0) {
    return {
      kind: "not_executed",
      reason: "no_ready_actions",
      created_count: 0,
      idempotent_count: 0,
      movements: [],
    };
  }

  const movements: ExecutedDataActionMovement[] = [];
  const debts: ExecutedDataActionDebt[] = [];
  let idempotentCount = 0;

  for (const action of readyActions) {
    const idempotencyKey = buildDataActionIdempotencyKey({
      externalEventId: params.externalEventId,
      actionId: action.action_id,
    });
    const result = action.debt_creation_input
      ? await params.dispatcher.dispatch({
          type: "CreateDebtCommand",
          command_id: randomUUID(),
          user_id: params.userId,
          actor: { type: "agent", id: null },
          source: "orchestrator.whatsapp.data_agent.debt_creation",
          trace_id: params.traceId,
          payload: {
            ...action.debt_creation_input,
            idempotency_key: idempotencyKey,
            creation_source: "whatsapp",
          },
        })
      : action.debt_payment_input
        ? await params.dispatcher.dispatch({
          type: "RecordDebtPaymentCommand",
          command_id: randomUUID(),
          user_id: params.userId,
          actor: { type: "agent", id: null },
          source: "orchestrator.whatsapp.data_agent.debt_payment",
          trace_id: params.traceId,
          payload: {
            debt_id: action.debt_payment_input.debt_id,
            amount: action.debt_payment_input.amount,
            currency: action.debt_payment_input.currency,
            account_id: action.debt_payment_input.account_id,
            installment_id: action.debt_payment_input.installment_id,
            installment_number: action.debt_payment_input.installment_number,
            paid_at: action.debt_payment_input.paid_at,
            note: action.debt_payment_input.note,
            idempotency_key: idempotencyKey,
            payment_source: "whatsapp",
          },
          })
        : await params.dispatcher.dispatch({
          type: "CreateMovementCommand",
          command_id: randomUUID(),
          user_id: params.userId,
          actor: { type: "agent", id: null },
          source: "orchestrator.whatsapp.data_agent",
          trace_id: params.traceId,
          payload: {
            movement: action.movement_input!,
            idempotency_key: idempotencyKey,
          },
          });

    if (result.type === "debt_created") {
      if (result.idempotent) idempotentCount += 1;
      debts.push({
        action_id: action.action_id,
        debt_id: result.debt.id,
        idempotent: result.idempotent,
        name: result.debt.name,
        direction: result.debt.direction,
        principal_amount: result.debt.principal_amount,
        current_balance: result.debt.current_balance,
        currency: result.debt.currency,
        installment_count: result.installments.length,
        first_due_date: result.installments[0]?.due_date ?? null,
        movement_id: result.loan_movement?.id ?? null,
      });
      if (result.loan_movement) {
        movements.push(
          executedMovement(
            action.action_id,
            result.loan_movement,
            result.idempotent,
          ),
        );
      }
      continue;
    }

    const movement = requireExecutedMovement(result);
    if (movement.idempotent) idempotentCount += 1;

    movements.push({
      action_id: action.action_id,
      movement_id: movement.movement.id,
      idempotent: movement.idempotent,
      movement_type: movement.movement.type,
      amount: movement.movement.amount,
      currency: movement.movement.currency,
      occurred_at: movement.movement.occurred_at,
      description: movement.movement.description,
      category_id: movement.movement.category_id,
      account_origin_id: movement.movement.account_origin_id,
      account_destination_id: movement.movement.account_destination_id,
      status: movement.movement.status,
      debt_id: movement.movement.debt_id,
      debt_name:
        result.type === "debt_payment_recorded" ? result.debt.name : null,
      debt_remaining_balance:
        result.type === "debt_payment_recorded"
          ? result.debt.current_balance
          : null,
      debt_payment_id:
        result.type === "debt_payment_recorded" ? result.payment.id : null,
    });
  }

  return {
    kind: "executed",
    reason: "all_ready_actions_executed",
    created_count: readyActions.length,
    idempotent_count: idempotentCount,
    movements,
    debts,
  };
}

export function buildDataActionIdempotencyKey(params: {
  externalEventId: string;
  actionId: string;
}): string {
  return `whatsapp:${params.externalEventId}:${params.actionId}`;
}

function requireExecutedMovement(
  result: CommandResult
): {
  movement: Movement;
  idempotent: boolean;
} {
  if (
    result.type !== "movement_created" &&
    result.type !== "debt_payment_recorded"
  ) {
    throw new Error("DataActionExecutor esperaba una escritura financiera creada");
  }

  return result;
}

function executedMovement(
  actionId: string,
  movement: Movement,
  idempotent: boolean,
): ExecutedDataActionMovement {
  return {
    action_id: actionId,
    movement_id: movement.id,
    idempotent,
    movement_type: movement.type,
    amount: movement.amount,
    currency: movement.currency,
    occurred_at: movement.occurred_at,
    description: movement.description,
    category_id: movement.category_id,
    account_origin_id: movement.account_origin_id,
    account_destination_id: movement.account_destination_id,
    status: movement.status,
    debt_id: movement.debt_id,
  };
}
