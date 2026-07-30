import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Box,
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
import { addCalendarDays, isoDateInLima } from "@/shared/dates/lima";

type Client = SupabaseClient<Database>;

export type DebtWithPerson = Debt & {
  related_person: RelatedPerson | null;
  linked_box?: Box | null;
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
  linked_box_id: string | null;
  debt_id: string;
  debt_name: string;
  installment_id: string;
  installment_number: number;
  debt_kind: DebtKind;
  date_is_approximate: boolean;
  informal_agreement: boolean;
};

export type DebtPaymentAllocationPreview = {
  installment_id: string;
  installment_number: number;
  due_date: string;
  previous_paid_amount: number;
  allocated_amount: number;
  projected_paid_amount: number;
  projected_status: InstallmentStatus;
};

export type DebtPaymentPreview = {
  amount: number;
  previous_balance: number;
  projected_balance: number;
  allocations: DebtPaymentAllocationPreview[];
  unallocated_amount: number;
  allocation_policy: "oldest_open_due_date_first_v1";
};

export class DebtOperationError extends Error {
  constructor(
    readonly code:
      | "DEBT_OPERATION_CONFLICT"
      | "DEBT_OPERATION_INVALID"
      | "DEBT_OPERATION_NOT_FOUND",
    message: string
  ) {
    super(message);
    this.name = "DebtOperationError";
  }
}

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
  statuses: DebtStatus[] = ["active", "due_soon", "overdue"],
  options: {
    limit?: number;
    cursorFilter?: string;
    direction?: DebtDirection;
  } = {}
): Promise<DebtWithPerson[]> {
  // Clave de paginacion: `created_at desc, id desc` (no `next_payment_date`,
  // que admite null y no puede compararse de forma estable con un cursor,
  // `14` §5: "orden estable obligatorio"). El orden de negocio (vencimiento
  // mas proximo primero) se reaplica abajo sobre la pagina ya traida.
  let builder = client
    .from("debts")
    .select(
      `
        *,
        related_persons (*),
        boxes (*)
      `
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("status", statuses)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (options.direction) {
    builder = builder.eq("direction", options.direction);
  }
  if (options.cursorFilter) builder = builder.or(options.cursorFilter);
  if (options.limit !== undefined) builder = builder.limit(options.limit);

  const { data, error } = await builder;

  if (error) {
    logger.error("debts.list_failed", { error, user_id: userId });
    throw error;
  }

  // Se devuelve en orden `created_at desc, id desc` (el de paginacion), sin
  // ordenar aqui por `next_payment_date`: quien pagina (`route.ts`) debe
  // aplicar `sortDebtsByNextPaymentDate` DESPUES de recortar la pagina con
  // `paginate()`, no antes — si se ordenara aqui, la ultima fila de la
  // pagina ya no seria la ultima del fetch real, y el cursor codificaria la
  // fila equivocada. Los demas llamadores (`tool-gateway`, `email-ingestion`,
  // `insights.repository`) no dependen del orden: solo filtran/agrupan.
  return (data ?? []).map((row) => {
    const debt = row as Debt & {
      related_persons?: RelatedPerson | null;
      boxes?: Box[] | null;
    };
    const {
      related_persons: relatedPerson,
      boxes,
      ...plainDebt
    } = debt;

    return {
      ...(plainDebt as Debt),
      related_person: relatedPerson ?? null,
      linked_box: findCanonicalDebtBox(boxes),
    };
  });
}

export function sortDebtsByNextPaymentDate(debts: DebtWithPerson[]): DebtWithPerson[] {
  return [...debts].sort((left, right) => {
    if (!left.next_payment_date && !right.next_payment_date) return 0;
    if (!left.next_payment_date) return 1;
    if (!right.next_payment_date) return -1;
    return left.next_payment_date.localeCompare(right.next_payment_date);
  });
}

export type CreateDebtResult = { debt: DebtWithPerson; idempotent: boolean };

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
    /** `AC-API-05`: si ya existe una deuda de este usuario con esta clave
     * (columna e indice unico de la migracion `043`), se devuelve esa en
     * vez de crear una duplicada. */
    idempotencyKey?: string | null;
  }
): Promise<CreateDebtResult> {
  if (params.idempotencyKey) {
    const existing = await findDebtByIdempotencyKey(
      client,
      params.userId,
      params.idempotencyKey
    );
    if (existing) return { debt: existing, idempotent: true };
  }

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
      idempotency_key: params.idempotencyKey ?? null,
    })
    .select()
    .single();

  if (error) {
    // 23505 = unique_violation: dos peticiones concurrentes con la misma
    // clave se cruzaron; la que pierde la carrera devuelve la que gano,
    // no un error, para cumplir `AC-API-05` bajo concurrencia real.
    if (isUniqueViolation(error) && params.idempotencyKey) {
      const existing = await findDebtByIdempotencyKey(
        client,
        params.userId,
        params.idempotencyKey
      );
      if (existing) return { debt: existing, idempotent: true };
    }
    logger.error("debts.create_failed", { error, user_id: params.userId });
    throw error;
  }

  const debt = data as Debt;
  await createInstallmentsForDebt(client, debt, params);

  return {
    debt: { ...debt, related_person: relatedPerson },
    idempotent: false,
  };
}

async function findDebtByIdempotencyKey(
  client: Client,
  userId: string,
  idempotencyKey: string
): Promise<DebtWithPerson | null> {
  const { data, error } = await client
    .from("debts")
    .select("*, related_persons (*)")
    .eq("user_id", userId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const debt = data as Debt & { related_persons?: RelatedPerson | null };
  const { related_persons: relatedPerson, ...plainDebt } = debt;
  return { ...(plainDebt as Debt), related_person: relatedPerson ?? null };
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "23505"
  );
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
        related_persons (*),
        boxes (*)
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

  const debt = data as Debt & {
    related_persons?: RelatedPerson | null;
    boxes?: Box[] | null;
  };
  const {
    related_persons: relatedPerson,
    boxes,
    ...plainDebt
  } = debt;

  return {
    ...(plainDebt as Debt),
    related_person: relatedPerson ?? null,
    linked_box: findCanonicalDebtBox(boxes),
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
    .order("paid_at", { ascending: false });

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
  const horizonDate = addCalendarDays(isoDateInLima(now), horizonDays);

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
          kind,
          metadata,
          status,
          deleted_at,
          boxes (
            id,
            linked_debt_id,
            deleted_at
          )
        )
      `
    )
    .eq("user_id", userId)
    .in("status", ["pending", "due_soon", "overdue"])
    .eq("debts.user_id", userId)
    .eq("debts.direction", "i_owe")
    .is("debts.deleted_at", null)
    .in("debts.status", ["active", "due_soon", "overdue"])
    .lte("due_date", horizonDate)
    .order("due_date", { ascending: true });

  if (error) {
    logger.error("debts.installment_commitments_failed", {
      error,
      user_id: userId,
    });
    throw error;
  }

  return buildDebtInstallmentCommitments(data ?? []);
}

type DebtInstallmentCommitmentRow = DebtInstallment & {
  debts?: {
    id: string;
    name: string;
    currency: "PEN" | "USD";
    direction: DebtDirection;
    kind: DebtKind;
    metadata?: Record<string, unknown> | null;
    boxes?: Array<{
      id: string;
      linked_debt_id: string | null;
      deleted_at: string | null;
    }> | null;
  } | null;
};

export function buildDebtInstallmentCommitments(
  rows: unknown[]
): DebtInstallmentCommitmentSummary[] {
  return rows
    .map((row) => row as DebtInstallmentCommitmentRow)
    .filter((installment) => installment.debts?.direction === "i_owe")
    .map((installment) => {
      const debt = installment.debts!;
      const linkedBox =
        debt.boxes?.find(
          (box) =>
            box.deleted_at === null && box.linked_debt_id === installment.debt_id
        ) ?? null;
      return {
        id: installment.id,
        title: `Cuota ${installment.number}: ${debt.name}`,
        amount: roundMoney(
          Number(installment.expected_amount) - Number(installment.paid_amount)
        ),
        currency: debt.currency,
        direction: debt.direction,
        due_at: installment.due_date,
        kind: "debt" as const,
        linked_box_id: linkedBox?.id ?? null,
        debt_id: installment.debt_id,
        debt_name: debt.name,
        installment_id: installment.id,
        installment_number: installment.number,
        debt_kind: debt.kind,
        date_is_approximate: debt.metadata?.date_is_approximate === true,
        informal_agreement: debt.metadata?.informal_agreement === true,
      };
    });
}

export function previewDebtPaymentAllocation(params: {
  amount: number;
  currentBalance: number;
  installments: DebtInstallment[];
}): DebtPaymentPreview {
  const amount = roundMoney(params.amount);
  const currentBalance = roundMoney(params.currentBalance);
  if (amount <= 0) {
    throw new DebtOperationError(
      "DEBT_OPERATION_INVALID",
      "El monto debe ser mayor a cero."
    );
  }
  if (amount > currentBalance) {
    throw new DebtOperationError(
      "DEBT_OPERATION_INVALID",
      "El pago supera el saldo. Paga exactamente el saldo o registra la diferencia como otro movimiento."
    );
  }

  let remaining = amount;
  const allocations: DebtPaymentAllocationPreview[] = [];
  const openStatuses = new Set<InstallmentStatus>([
    "pending",
    "due_soon",
    "overdue",
  ]);
  const openInstallments = [...params.installments]
    .filter((item) => openStatuses.has(item.status))
    .sort((left, right) =>
      left.due_date === right.due_date
        ? left.number - right.number
        : left.due_date.localeCompare(right.due_date)
    );

  for (const installment of openInstallments) {
    if (remaining <= 0) break;
    const unpaid = roundMoney(
      Number(installment.expected_amount) - Number(installment.paid_amount)
    );
    if (unpaid <= 0) continue;
    const allocated = roundMoney(Math.min(unpaid, remaining));
    const projectedPaid = roundMoney(
      Number(installment.paid_amount) + allocated
    );
    allocations.push({
      installment_id: installment.id,
      installment_number: installment.number,
      due_date: installment.due_date,
      previous_paid_amount: roundMoney(Number(installment.paid_amount)),
      allocated_amount: allocated,
      projected_paid_amount: projectedPaid,
      projected_status:
        projectedPaid === roundMoney(Number(installment.expected_amount))
          ? "paid"
          : installment.status,
    });
    remaining = roundMoney(remaining - allocated);
  }

  return {
    amount,
    previous_balance: currentBalance,
    projected_balance: roundMoney(currentBalance - amount),
    allocations,
    unallocated_amount: remaining,
    allocation_policy: "oldest_open_due_date_first_v1",
  };
}

export async function updateDebtBasics(
  client: Client,
  userId: string,
  debtId: string,
  patch: {
    name?: string;
    kind?: DebtKind;
    due_date?: string | null;
    interest_notes?: string | null;
    related_person_id?: string | null;
  }
): Promise<Debt> {
  const { data, error } = await client
    .from("debts")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", debtId)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new DebtOperationError(
      "DEBT_OPERATION_NOT_FOUND",
      "No encontre esa deuda."
    );
  }
  return data as Debt;
}

export async function closeDebt(
  client: Client,
  params: {
    userId: string;
    debt: Debt;
    reason: "paid" | "forgiven";
    idempotencyKey: string;
    traceId: string;
  }
): Promise<{ debt: Debt; idempotent: boolean }> {
  const result = await commitDebtOperation(client, {
    userId: params.userId,
    debtId: params.debt.id,
    operation: "close",
    payload: { reason: params.reason },
    idempotencyKey: params.idempotencyKey,
    traceId: params.traceId,
  });
  return { debt: result.debt, idempotent: result.idempotent };
}

export async function reopenDebt(
  client: Client,
  params: {
    userId: string;
    debt: Debt;
    idempotencyKey: string;
    traceId: string;
  }
): Promise<{ debt: Debt; idempotent: boolean }> {
  const result = await commitDebtOperation(client, {
    userId: params.userId,
    debtId: params.debt.id,
    operation: "reopen",
    payload: {},
    idempotencyKey: params.idempotencyKey,
    traceId: params.traceId,
  });
  return { debt: result.debt, idempotent: result.idempotent };
}

export async function rescheduleDebtInstallment(
  client: Client,
  params: {
    userId: string;
    installment: DebtInstallment;
    dueDate: string;
    reason: string | null;
    idempotencyKey: string;
    traceId: string;
  }
): Promise<{ installment: DebtInstallment; idempotent: boolean }> {
  const result = await commitDebtOperation(client, {
    userId: params.userId,
    debtId: params.installment.debt_id,
    operation: "reschedule_installment",
    payload: {
      installment_id: params.installment.id,
      due_date: params.dueDate,
      reason: params.reason,
    },
    idempotencyKey: params.idempotencyKey,
    traceId: params.traceId,
  });
  if (!result.installment) {
    throw new DebtOperationError(
      "DEBT_OPERATION_INVALID",
      "El Core no devolvio la cuota reprogramada."
    );
  }
  return {
    installment: result.installment,
    idempotent: result.idempotent,
  };
}

export async function skipDebtInstallment(
  client: Client,
  params: {
    userId: string;
    installment: DebtInstallment;
    reason: string;
    idempotencyKey: string;
    traceId: string;
  }
): Promise<{ installment: DebtInstallment; idempotent: boolean }> {
  const result = await commitDebtOperation(client, {
    userId: params.userId,
    debtId: params.installment.debt_id,
    operation: "skip_installment",
    payload: {
      installment_id: params.installment.id,
      reason: params.reason,
    },
    idempotencyKey: params.idempotencyKey,
    traceId: params.traceId,
  });
  if (!result.installment) {
    throw new DebtOperationError(
      "DEBT_OPERATION_INVALID",
      "El Core no devolvio la cuota omitida."
    );
  }
  return {
    installment: result.installment,
    idempotent: result.idempotent,
  };
}

type DebtOperationName =
  | "close"
  | "reopen"
  | "reschedule_installment"
  | "skip_installment";

type DebtOperationRpcResult = {
  debt: Debt;
  installment?: DebtInstallment;
  idempotent: boolean;
};

async function commitDebtOperation(
  client: Client,
  params: {
    userId: string;
    debtId: string;
    operation: DebtOperationName;
    payload: Record<string, unknown>;
    idempotencyKey: string;
    traceId: string;
  }
): Promise<DebtOperationRpcResult> {
  const { data, error } = await client.rpc("commit_debt_operation", {
    p_user_id: params.userId,
    p_debt_id: params.debtId,
    p_operation: params.operation,
    p_payload: toJson(params.payload),
    p_idempotency_key: params.idempotencyKey,
    p_trace_id: params.traceId,
  });

  if (error) throw mapDebtOperationRpcError(error);
  if (!isDebtOperationRpcResult(data)) {
    throw new DebtOperationError(
      "DEBT_OPERATION_INVALID",
      "El Core devolvio una operacion de deuda invalida."
    );
  }
  return {
    debt: data.debt as unknown as Debt,
    installment: data.installment
      ? (data.installment as unknown as DebtInstallment)
      : undefined,
    idempotent: data.idempotent,
  };
}

function isDebtOperationRpcResult(value: Json): value is Json & {
  debt: Record<string, Json | undefined>;
  installment?: Record<string, Json | undefined>;
  idempotent: boolean;
} {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      "debt" in value &&
      value.debt &&
      typeof value.debt === "object" &&
      !Array.isArray(value.debt) &&
      "idempotent" in value &&
      typeof value.idempotent === "boolean"
  );
}

function mapDebtOperationRpcError(error: unknown): DebtOperationError | unknown {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : error instanceof Error
        ? error.message
        : "";

  if (message.includes("DEBT_OPERATION_NOT_FOUND")) {
    return new DebtOperationError(
      "DEBT_OPERATION_NOT_FOUND",
      "No encontre esa deuda o cuota."
    );
  }
  if (
    message.includes("DEBT_OPERATION_CONFLICT") ||
    message.includes("DEBT_OPERATION_IDEMPOTENCY_CONFLICT") ||
    message.includes("DEBT_OPERATION_PAID_CANNOT_REOPEN") ||
    message.includes("DEBT_OPERATION_MISSING_FORGIVEN_BALANCE")
  ) {
    return new DebtOperationError(
      "DEBT_OPERATION_CONFLICT",
      message.includes("PAID_CANNOT_REOPEN")
        ? "Una deuda pagada no se reabre en silencio; registra un ajuste nuevo."
        : "La deuda o cuota ya no admite esa operacion."
    );
  }
  if (
    message.includes("DEBT_OPERATION_PAID_WITH_BALANCE") ||
    message.includes("DEBT_OPERATION_FORGIVEN_WITHOUT_BALANCE") ||
    message.includes("DEBT_OPERATION_INVALID") ||
    message.includes("DEBT_OPERATION_REQUIRED") ||
    message.includes("DEBT_OPERATION_REASON_REQUIRED")
  ) {
    return new DebtOperationError(
      "DEBT_OPERATION_INVALID",
      message.includes("PAID_WITH_BALANCE")
        ? "Para cerrarla como pagada, primero registra el saldo pendiente."
        : message.includes("FORGIVEN_WITHOUT_BALANCE")
          ? "Una deuda sin saldo se cierra como pagada, no como condonada."
          : "Revisa los datos de la operacion de deuda."
    );
  }
  return error;
}

export async function getDebtInstallmentById(
  client: Client,
  userId: string,
  debtId: string,
  installmentId: string
): Promise<DebtInstallment | null> {
  const { data, error } = await client
    .from("debt_installments")
    .select("*")
    .eq("user_id", userId)
    .eq("debt_id", debtId)
    .eq("id", installmentId)
    .maybeSingle();
  if (error) throw error;
  return data ? (data as DebtInstallment) : null;
}

function findCanonicalDebtBox(boxes: Box[] | null | undefined): Box | null {
  return (
    (boxes ?? [])
      .filter((box) => box.deleted_at === null)
      .sort((left, right) => {
        const byCreatedAt = left.created_at.localeCompare(right.created_at);
        return byCreatedAt !== 0 ? byCreatedAt : left.id.localeCompare(right.id);
      })[0] ?? null
  );
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
