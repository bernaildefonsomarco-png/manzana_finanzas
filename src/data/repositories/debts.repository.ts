import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Debt,
  DebtInstallment,
  DebtPayment,
  DebtPaymentAllocation,
  DebtDirection,
  DebtKind,
  DebtStatus,
  InstallmentStatus,
  Movement,
  PendingItem,
  RelatedPerson,
} from "@/shared/types/domain";
import type { Database, Json } from "@/data/supabase/types";
import { logger } from "@/shared/telemetry/logger";
import type { OutboxEventDraft } from "@/core/events/domain-events";
import type { MovementCommitPayload } from "@/core/finance/repository";

type Client = SupabaseClient<Database>;

export type DebtWithPerson = Debt & {
  related_person: RelatedPerson | null;
};

export type DebtPaymentWithMovement = DebtPayment & {
  movement: Movement | null;
  allocations: DebtPaymentAllocation[];
};

export type DebtInstallmentWithMovement = DebtInstallment & {
  movement: Movement | null;
  allocations: DebtPaymentAllocation[];
};

export type DebtDetailWithPayments = DebtWithPerson & {
  payments: DebtPaymentWithMovement[];
  installments: DebtInstallmentWithMovement[];
};

export type DebtPaymentCommitResult = {
  movement: Movement;
  debt: Debt;
  payment: DebtPayment;
  installment_allocations: DebtPaymentAllocation[];
  allocation_policy: "oldest_open_due_date_first_v1";
  idempotent: boolean;
};

export type DebtLifecycleTransition = {
  entity_type: "debt" | "debt_installment";
  entity_id: string;
  debt_id?: string;
  previous_status: DebtStatus | InstallmentStatus;
  status: DebtStatus | InstallmentStatus;
};

export type DebtLifecycleRefreshResult = {
  as_of_date: string;
  due_soon_days: number;
  installments_scanned: number;
  installments_updated: number;
  debts_scanned: number;
  debts_updated: number;
  events_created: number;
  transitions: DebtLifecycleTransition[];
};

export type DebtInstallmentCommitmentSummary = {
  id: string;
  title: string;
  amount: number;
  currency: "PEN" | "USD";
  direction: DebtDirection;
  due_at: string;
  kind: "debt";
  linked_box_id: null;
  debt_id: string;
  debt_name: string;
  installment_id: string;
  installment_number: number;
};

type DebtInstallmentDraft = {
  user_id: string;
  debt_id: string;
  number: number;
  due_date: string;
  expected_amount: number;
  paid_amount: number;
  status: InstallmentStatus;
  metadata: Json;
};

export async function listDebts(
  client: Client,
  userId: string,
  statuses: DebtStatus[] = ["active", "due_soon", "overdue"]
): Promise<DebtWithPerson[]> {
  const { data, error } = await client
    .from("debts")
    .select(
      `
        *,
        related_persons (*)
      `
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("status", statuses)
    .order("next_payment_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("debts.list_failed", { error, user_id: userId });
    throw error;
  }

  return (data ?? []).map((row) => {
    const debt = row as Debt & { related_persons?: RelatedPerson | null };
    const { related_persons: relatedPerson, ...plainDebt } = debt;

    return {
      ...(plainDebt as Debt),
      related_person: relatedPerson ?? null,
    };
  });
}

export async function createDebt(
  client: Client,
  params: {
    userId: string;
    direction: DebtDirection;
    kind: DebtKind;
    name: string;
    principalAmount: number;
    currency?: "PEN" | "USD";
    relatedPersonName?: string | null;
    openedAt?: string;
    dueDate?: string | null;
    nextPaymentDate?: string | null;
    installmentCount?: number | null;
    installmentAmount?: number | null;
    interestNotes?: string | null;
    source?: string;
    metadata?: Json;
  }
): Promise<DebtWithPerson> {
  const relatedPerson = params.relatedPersonName
    ? await getOrCreateRelatedPerson(client, params.userId, params.relatedPersonName)
    : null;

  const { data, error } = await client
    .from("debts")
    .insert({
      user_id: params.userId,
      direction: params.direction,
      kind: params.kind,
      status: "active",
      related_person_id: relatedPerson?.id ?? null,
      name: params.name,
      principal_amount: params.principalAmount,
      current_balance: params.principalAmount,
      currency: params.currency ?? "PEN",
      opened_at: params.openedAt ?? todayIsoDate(),
      due_date: params.dueDate ?? null,
      next_payment_date: params.nextPaymentDate ?? null,
      installment_count: params.installmentCount ?? null,
      installment_amount: params.installmentAmount ?? null,
      interest_notes: params.interestNotes ?? null,
      source: params.source ?? "dashboard_manual",
      confidence: 1,
      metadata: params.metadata ?? {},
    })
    .select()
    .single();

  if (error) {
    logger.error("debts.create_failed", { error, user_id: params.userId });
    throw error;
  }

  const debt = data as Debt;
  await createInstallmentsForDebt(client, debt, params);

  return {
    ...debt,
    related_person: relatedPerson,
  };
}

export async function getDebtById(
  client: Client,
  userId: string,
  debtId: string
): Promise<DebtWithPerson | null> {
  const { data, error } = await client
    .from("debts")
    .select(
      `
        *,
        related_persons (*)
      `
    )
    .eq("user_id", userId)
    .eq("id", debtId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    logger.error("debts.get_failed", {
      error,
      user_id: userId,
      debt_id: debtId,
    });
    throw error;
  }

  if (!data) return null;

  const debt = data as Debt & { related_persons?: RelatedPerson | null };
  const { related_persons: relatedPerson, ...plainDebt } = debt;

  return {
    ...(plainDebt as Debt),
    related_person: relatedPerson ?? null,
  };
}

export async function getDebtDetailById(
  client: Client,
  userId: string,
  debtId: string
): Promise<DebtDetailWithPayments | null> {
  const debt = await getDebtById(client, userId, debtId);
  if (!debt) return null;

  const payments = await listDebtPaymentsForDebt(client, userId, debtId);
  const installments = await listDebtInstallmentsForDebt(client, userId, debtId);
  return {
    ...debt,
    payments,
    installments,
  };
}

export async function listDebtPaymentsForDebt(
  client: Client,
  userId: string,
  debtId: string
): Promise<DebtPaymentWithMovement[]> {
  const { data, error } = await client
    .from("debt_payments")
    .select(
      `
        *,
        movements (*),
        debt_payment_allocations (*)
      `
    )
    .eq("user_id", userId)
    .eq("debt_id", debtId)
    .order("paid_at", { ascending: false })
    .limit(80);

  if (error) {
    logger.error("debts.payments_list_failed", {
      error,
      user_id: userId,
      debt_id: debtId,
    });
    throw error;
  }

  return (data ?? []).map((row) => {
    const payment = row as DebtPayment & {
      movements?: Movement | null;
      debt_payment_allocations?: DebtPaymentAllocation[];
    };
    const {
      movements: movement,
      debt_payment_allocations: allocations,
      ...plainPayment
    } = payment;

    return {
      ...(plainPayment as DebtPayment),
      movement: movement ?? null,
      allocations: (allocations ?? []).sort(
        (left, right) => left.allocation_order - right.allocation_order
      ),
    };
  });
}

export async function getDebtPaymentByMovementId(
  client: Client,
  userId: string,
  movementId: string
): Promise<DebtPaymentWithMovement | null> {
  const { data, error } = await client
    .from("debt_payments")
    .select(
      `
        *,
        movements (*),
        debt_payment_allocations (*)
      `
    )
    .eq("user_id", userId)
    .eq("movement_id", movementId)
    .maybeSingle();

  if (error) {
    logger.error("debts.payment_get_by_movement_failed", {
      error,
      user_id: userId,
      movement_id: movementId,
    });
    throw error;
  }
  if (!data) return null;

  const payment = data as DebtPayment & {
    movements?: Movement | null;
    debt_payment_allocations?: DebtPaymentAllocation[];
  };
  const {
    movements: movement,
    debt_payment_allocations: allocations,
    ...plainPayment
  } = payment;
  return {
    ...(plainPayment as DebtPayment),
    movement: movement ?? null,
    allocations: (allocations ?? []).sort(
      (left, right) => left.allocation_order - right.allocation_order
    ),
  };
}

export async function listDebtInstallmentsForDebt(
  client: Client,
  userId: string,
  debtId: string
): Promise<DebtInstallmentWithMovement[]> {
  const { data, error } = await client
    .from("debt_installments")
    .select(
      `
        *,
        movements (*),
        debt_payment_allocations (*)
      `
    )
    .eq("user_id", userId)
    .eq("debt_id", debtId)
    .order("number", { ascending: true });

  if (error) {
    logger.error("debts.installments_list_failed", {
      error,
      user_id: userId,
      debt_id: debtId,
    });
    throw error;
  }

  return (data ?? []).map((row) => {
    const installment = row as DebtInstallment & {
      movements?: Movement | null;
      debt_payment_allocations?: DebtPaymentAllocation[];
    };
    const {
      movements: movement,
      debt_payment_allocations: allocations,
      ...plainInstallment
    } = installment;

    return {
      ...(plainInstallment as DebtInstallment),
      movement: movement ?? null,
      allocations: (allocations ?? []).sort((left, right) =>
        left.created_at.localeCompare(right.created_at)
      ),
    };
  });
}

export async function listDebtInstallmentCommitments(
  client: Client,
  userId: string,
  horizonDays = 31,
  now = new Date()
): Promise<DebtInstallmentCommitmentSummary[]> {
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + horizonDays);

  const { data, error } = await client
    .from("debt_installments")
    .select(
      `
        *,
        debts!inner (
          id,
          user_id,
          name,
          currency,
          direction,
          status,
          deleted_at
        )
      `
    )
    .eq("user_id", userId)
    .in("status", ["pending", "due_soon", "overdue"])
    .eq("debts.user_id", userId)
    .is("debts.deleted_at", null)
    .in("debts.status", ["active", "due_soon", "overdue"])
    .lte("due_date", toIsoDate(horizon))
    .order("due_date", { ascending: true })
    .limit(40);

  if (error) {
    logger.error("debts.installment_commitments_failed", {
      error,
      user_id: userId,
    });
    throw error;
  }

  return (data ?? []).map((row) => {
    const installment = row as DebtInstallment & {
      debts?: {
        id: string;
        name: string;
        currency: "PEN" | "USD";
        direction: DebtDirection;
      } | null;
    };

    return {
      id: installment.id,
      title: `Cuota ${installment.number}: ${installment.debts?.name ?? "Deuda"}`,
      amount: roundMoney(
        Number(installment.expected_amount) - Number(installment.paid_amount)
      ),
      currency: installment.debts?.currency ?? "PEN",
      direction: installment.debts?.direction ?? "i_owe",
      due_at: installment.due_date,
      kind: "debt",
      linked_box_id: null,
      debt_id: installment.debt_id,
      debt_name: installment.debts?.name ?? "Deuda",
      installment_id: installment.id,
      installment_number: installment.number,
    };
  });
}

export async function commitDebtPayment(
  client: Client,
  params: {
    debtId: string;
    payment: Omit<DebtPayment, "created_at">;
    movementCommit: MovementCommitPayload;
    debtOutboxEvents: OutboxEventDraft[];
  }
): Promise<DebtPaymentCommitResult> {
  const { data, error } = await client.rpc("commit_debt_payment", {
    p_debt_id: params.debtId,
    p_payment: toJson(params.payment),
    p_movement: toJson(params.movementCommit.movement),
    p_audit_logs: toJson(params.movementCommit.auditLogs),
    p_account_deltas: toJson(params.movementCommit.accountDeltas),
    p_box_deltas: toJson(params.movementCommit.boxDeltas),
    p_movement_outbox_events: toJson(params.movementCommit.outboxEvents),
    p_debt_outbox_events: toJson(params.debtOutboxEvents),
  });

  if (error || !data) {
    logger.error("debts.payment_commit_failed", {
      error,
      debt_id: params.debtId,
    });
    throw error;
  }

  return data as unknown as DebtPaymentCommitResult;
}

export async function commitPendingDebtPayment(
  client: Client,
  params: {
    pendingItemId: string;
    actorId: string;
    traceId: string;
    debtId: string;
    payment: Omit<DebtPayment, "created_at">;
    movementCommit: MovementCommitPayload;
    debtOutboxEvents: OutboxEventDraft[];
  },
): Promise<DebtPaymentCommitResult & { pending_item: PendingItem }> {
  const { data, error } = await client.rpc("commit_pending_debt_payment", {
    p_pending_id: params.pendingItemId,
    p_actor_id: params.actorId,
    p_trace_id: params.traceId,
    p_debt_id: params.debtId,
    p_payment: toJson(params.payment),
    p_movement: toJson(params.movementCommit.movement),
    p_audit_logs: toJson(params.movementCommit.auditLogs),
    p_account_deltas: toJson(params.movementCommit.accountDeltas),
    p_box_deltas: toJson(params.movementCommit.boxDeltas),
    p_movement_outbox_events: toJson(params.movementCommit.outboxEvents),
    p_debt_outbox_events: toJson(params.debtOutboxEvents),
  });

  if (error || !data) {
    logger.error("debts.pending_payment_commit_failed", {
      error,
      debt_id: params.debtId,
      pending_item_id: params.pendingItemId,
    });
    throw error;
  }

  return data as unknown as DebtPaymentCommitResult & {
    pending_item: PendingItem;
  };
}

export async function refreshDebtInstallmentLifecycle(
  client: Client,
  params: {
    userId: string;
    asOfDate: string;
    dueSoonDays: number;
    traceId: string;
  }
): Promise<DebtLifecycleRefreshResult> {
  const { data, error } = await client.rpc(
    "refresh_debt_installment_lifecycle",
    {
      p_user_id: params.userId,
      p_as_of_date: params.asOfDate,
      p_due_soon_days: params.dueSoonDays,
      p_trace_id: params.traceId,
    }
  );

  if (error || !data) {
    logger.error("debts.lifecycle_refresh_failed", {
      error,
      user_id: params.userId,
      trace_id: params.traceId,
    });
    throw error ?? new Error("No se pudo actualizar el ciclo de vencimientos.");
  }

  return data as unknown as DebtLifecycleRefreshResult;
}

export async function listDebtLifecycleUserIds(
  client: Client,
  maxUsers = 50
): Promise<string[]> {
  const limit = Math.min(Math.max(Math.trunc(maxUsers), 1), 200);
  const scanLimit = Math.min(limit * 20, 5000);
  const { data, error } = await client
    .from("debt_installments")
    .select("user_id")
    .in("status", ["pending", "due_soon", "overdue"])
    .order("updated_at", { ascending: true })
    .limit(scanLimit);

  if (error) {
    logger.error("debts.lifecycle_users_list_failed", { error });
    throw error;
  }

  return [...new Set((data ?? []).map((row) => row.user_id))].slice(0, limit);
}

async function getOrCreateRelatedPerson(
  client: Client,
  userId: string,
  displayName: string
): Promise<RelatedPerson> {
  const normalizedName = normalizePersonName(displayName);

  const existing = await getRelatedPersonByNormalized(
    client,
    userId,
    normalizedName
  );
  if (existing) return existing;

  const { data, error } = await client
    .from("related_persons")
    .insert({
      user_id: userId,
      display_name: displayName.trim(),
      normalized_name: normalizedName,
      kind: "person_or_entity",
      metadata: {},
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      const raced = await getRelatedPersonByNormalized(
        client,
        userId,
        normalizedName
      );
      if (raced) return raced;
    }

    logger.error("debts.related_person_create_failed", { error, user_id: userId });
    throw error;
  }

  return data as RelatedPerson;
}

async function getRelatedPersonByNormalized(
  client: Client,
  userId: string,
  normalizedName: string
): Promise<RelatedPerson | null> {
  const { data, error } = await client
    .from("related_persons")
    .select("*")
    .eq("user_id", userId)
    .eq("normalized_name", normalizedName)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    logger.error("debts.related_person_get_failed", { error, user_id: userId });
    throw error;
  }

  return data ? (data as RelatedPerson) : null;
}

function normalizePersonName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function createInstallmentsForDebt(
  client: Client,
  debt: Debt,
  params: {
    userId: string;
    installmentCount?: number | null;
    installmentAmount?: number | null;
    nextPaymentDate?: string | null;
    dueDate?: string | null;
  }
): Promise<DebtInstallment[]> {
  const installments = buildDebtInstallmentDrafts({
    userId: params.userId,
    debt,
    installmentCount: params.installmentCount ?? null,
    installmentAmount: params.installmentAmount ?? null,
    firstDueDate: params.nextPaymentDate ?? params.dueDate ?? null,
  });

  if (installments.length === 0) return [];

  const { data, error } = await client
    .from("debt_installments")
    .insert(installments)
    .select();

  if (error) {
    logger.error("debts.installments_create_failed", {
      error,
      user_id: params.userId,
      debt_id: debt.id,
    });
    throw error;
  }

  return (data ?? []) as DebtInstallment[];
}

export function buildDebtInstallmentDrafts(params: {
  userId: string;
  debt: Debt;
  installmentCount: number | null;
  installmentAmount: number | null;
  firstDueDate: string | null;
}): DebtInstallmentDraft[] {
  const count = params.installmentCount;
  if (!count || count < 1 || !params.firstDueDate) return [];

  const baseAmount =
    params.installmentAmount && params.installmentAmount > 0
      ? roundMoney(params.installmentAmount)
      : roundMoney(params.debt.principal_amount / count);

  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const isLast = number === count && !params.installmentAmount;
    const previousTotal = roundMoney(baseAmount * index);
    const expectedAmount = isLast
      ? roundMoney(params.debt.principal_amount - previousTotal)
      : baseAmount;

    return {
      user_id: params.userId,
      debt_id: params.debt.id,
      number,
      due_date: addMonthsIsoDate(params.firstDueDate!, index),
      expected_amount: expectedAmount,
      paid_amount: 0,
      status: "pending" as const,
      metadata: {
        created_from: "dashboard_debt_create",
        schedule: "monthly_v1",
      },
    };
  });
}

function addMonthsIsoDate(value: string, monthsToAdd: number): string {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) return value;

  const target = new Date(Date.UTC(year, month - 1 + monthsToAdd, 1));
  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth();
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDay);

  return toIsoDate(new Date(Date.UTC(targetYear, targetMonth, targetDay)));
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function toJson(value: unknown): Json {
  return value as Json;
}
