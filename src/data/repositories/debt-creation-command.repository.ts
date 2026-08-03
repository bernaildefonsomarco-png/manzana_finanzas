import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  DebtCreationCommitInput,
  DebtCreationCommandResult,
  DebtCreationExecutionPort,
} from "@/core/debts/debt-creation-command";
import { CoreError } from "@/core/finance/errors";
import type { Database, Json } from "@/data/supabase/types";
import type {
  Debt,
  DebtInstallment,
  Movement,
} from "@/shared/types/domain";
import { getAccountById } from "./accounts.repository";

type Client = SupabaseClient<Database>;

export class SupabaseDebtCreationExecutionPort
  implements DebtCreationExecutionPort
{
  constructor(private readonly client: Client) {}

  getAccount(userId: string, accountId: string) {
    return getAccountById(this.client, userId, accountId);
  }

  async commit(
    input: DebtCreationCommitInput,
  ): Promise<Omit<DebtCreationCommandResult, "type">> {
    const { command, movementCommit } = input;
    const { data, error } = await this.client.rpc("commit_debt_creation", {
      p_debt: toJson({
        id: input.debtId,
        user_id: command.user_id,
        direction: command.payload.direction,
        kind: command.payload.kind,
        name: command.payload.name,
        related_person_name: command.payload.related_person_name,
        principal_amount: command.payload.principal_amount,
        currency: command.payload.currency,
        opened_at: command.payload.opened_at,
        due_date:
          input.installments.at(-1)?.due_date ??
          command.payload.due_date ??
          null,
        first_due_date: command.payload.first_due_date,
        installment_count: command.payload.installment_count,
        installment_amount: command.payload.installment_amount,
        interest_notes: command.payload.interest_notes,
        source: command.payload.creation_source,
        idempotency_key: command.payload.idempotency_key,
        metadata: {
          created_from: command.payload.creation_source,
          trace_id: command.trace_id,
          command_id: command.command_id,
          actor: command.actor,
          account_id: command.payload.account_id,
          movement_type: command.payload.movement_type,
        },
      }),
      // El generador de tipos no refleja que Postgres acepta NULL aqui
      // (el parametro no tiene NOT NULL, solo carece de DEFAULT).
      p_related_person_normalized_name:
        input.normalizedRelatedPersonName as string,
      p_installments: toJson(input.installments),
      p_movement: movementCommit
        ? toJson(movementCommit.movement)
        : null,
      p_movement_audit_logs: toJson(
        movementCommit?.auditLogs ?? [],
      ),
      p_account_deltas: toJson(
        movementCommit?.accountDeltas ?? [],
      ),
      p_box_deltas: toJson(movementCommit?.boxDeltas ?? []),
      p_movement_outbox_events: toJson(
        movementCommit?.outboxEvents ?? [],
      ),
      p_debt_outbox_events: toJson(input.outboxEvents),
    });
    if (error) throw error;
    if (!isDebtCreationRpcResult(data)) {
      throw new CoreError(
        "DEBT_CREATION_INVALID_RESULT",
        "El Core de deudas devolvio un resultado invalido.",
      );
    }
    return {
      debt: data.debt as Debt,
      installments: data.installments as DebtInstallment[],
      loan_movement: (data.movement as Movement | null) ?? null,
      idempotent: data.idempotent,
    };
  }
}

function isDebtCreationRpcResult(value: unknown): value is {
  debt: Record<string, unknown>;
  installments: Array<Record<string, unknown>>;
  movement: Record<string, unknown> | null;
  idempotent: boolean;
} {
  return Boolean(
    value &&
      typeof value === "object" &&
      "debt" in value &&
      "installments" in value &&
      Array.isArray(
        (value as { installments?: unknown }).installments,
      ) &&
      "idempotent" in value &&
      typeof (value as { idempotent?: unknown }).idempotent ===
        "boolean",
  );
}

function toJson(value: unknown): Json {
  return value as Json;
}
