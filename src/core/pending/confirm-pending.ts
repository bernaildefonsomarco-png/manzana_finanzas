import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  evaluateCrossChannelDedup,
  type DedupDecision,
} from "@/core/dedup";
import {
  DebtPaymentCommandHandler,
} from "@/core/debts/debt-payment-command";
import {
  buildCreateMovementCommitPayload,
  CommandDispatcher,
} from "@/core/finance";
import type { OutboxEventDraft } from "@/core/events/domain-events";
import type { Actor } from "@/core/finance/commands";
import { CoreError } from "@/core/finance/errors";
import { SupabaseFinancialCoreRepository } from "@/data/repositories/movements.repository";
import { SupabaseDebtPaymentExecutionPort } from "@/data/repositories/debt-payment-command.repository";
import { getAccountById } from "@/data/repositories/accounts.repository";
import {
  commitPendingRecurringPayment,
  getRecurringOccurrenceById,
  getRecurringRuleById,
} from "@/data/repositories/recurring.repository";
import { SupabasePendingConfirmationRepository } from "@/data/repositories/pending-confirmation.repository";
import {
  getPendingItemById,
  markPendingAutoResolvedDuplicate,
  markPendingDuplicateConfirmationRequested,
  isTerminalPendingStatus,
  PendingRepositoryError,
} from "@/data/repositories/pending.repository";
import type { Database } from "@/data/supabase/types";
import {
  MovementInputSchema,
  type MovementInput,
} from "@/shared/schemas/money";
import {
  MOVEMENT_TYPES,
  type Movement,
  type MovementSource,
  type MovementType,
  type PendingItem,
  type PendingSource,
} from "@/shared/types/domain";

type Client = SupabaseClient<Database>;

export type ConfirmPendingInput = {
  client: Client;
  userId: string;
  pendingItemId: string;
  actor: Actor;
  traceId: string;
  source: string;
  confirmDuplicate?: boolean;
};

export type ConfirmPendingResult = {
  pendingItem: PendingItem;
  movement: Movement;
  idempotent: boolean;
  autoResolvedDuplicate: boolean;
};

export class PendingConfirmationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PendingConfirmationValidationError";
  }
}

export class PendingDuplicateConfirmationRequiredError extends Error {
  constructor(
    readonly decision: DedupDecision,
    readonly pendingItem: PendingItem
  ) {
    super("Encontré un movimiento parecido. Confirma si realmente quieres registrarlo otra vez.");
    this.name = "PendingDuplicateConfirmationRequiredError";
  }
}

export type PendingDedupResolution =
  | "commit"
  | "require_confirmation"
  | "auto_resolve_exact";

export function decidePendingDedupResolution(
  decision: DedupDecision | null,
  confirmDuplicate: boolean,
): PendingDedupResolution {
  if (decision?.status === "exact_duplicate" && decision.matched_reference_id) {
    return "auto_resolve_exact";
  }

  if (decision?.requires_confirmation && !confirmDuplicate) {
    return "require_confirmation";
  }

  return "commit";
}

export async function confirmPendingItemWithCore(
  input: ConfirmPendingInput
): Promise<ConfirmPendingResult> {
  const pendingItem = await getPendingItemById(
    input.client,
    input.userId,
    input.pendingItemId
  );

  if (!pendingItem) {
    throw new PendingRepositoryError(
      "PENDING_ITEM_NOT_FOUND",
      "Pendiente no encontrado"
    );
  }

  if (pendingItem.status === "user_confirmed") {
    const confirmedMovementId = getConfirmedMovementId(pendingItem);

    if (confirmedMovementId) {
      const movement = await new SupabaseFinancialCoreRepository(
        input.client
      ).getMovementById(input.userId, confirmedMovementId);

      if (movement) {
        return {
          pendingItem,
          movement,
          idempotent: true,
          autoResolvedDuplicate: false,
        };
      }
    }
  }

  if (
    pendingItem.status !== "user_confirmed" &&
    isTerminalPendingStatus(pendingItem.status)
  ) {
    throw new PendingRepositoryError(
      "PENDING_ITEM_ALREADY_RESOLVED",
      "Este pendiente ya fue resuelto"
    );
  }

  const proposedAction = getProposedAction(pendingItem);
  if (proposedAction === "review_specialized") {
    throw new PendingConfirmationValidationError(
      "Este pendiente necesita que completes su deuda, recurrente o cuentas antes de confirmarlo.",
    );
  }
  if (
    proposedAction === "record_debt_payment" ||
    proposedAction === "record_recurring_payment" ||
    proposedAction === "record_transfer"
  ) {
    const duplicateResolution = await resolveSpecializedPendingDedup(
      input,
      pendingItem,
      proposedAction,
    );
    if (duplicateResolution) return duplicateResolution;
  }
  if (proposedAction === "record_debt_payment") {
    return confirmPendingDebtPayment(input, pendingItem);
  }
  if (proposedAction === "record_recurring_payment") {
    return confirmPendingRecurringPayment(input, pendingItem);
  }
  if (proposedAction === "record_transfer") {
    return confirmPendingTransfer(input, pendingItem);
  }

  let movementInput = toMovementInputFromPending(pendingItem);
  const coreRepository = new SupabaseFinancialCoreRepository(input.client);
  const dedup = await evaluateCrossChannelDedup({
    client: input.client,
    userId: input.userId,
    traceId: input.traceId,
    referenceId: `pending:${pendingItem.id}`,
    movementInput,
    metadata: {
      entry_surface: "pending_confirmation",
      pending_item_id: pendingItem.id,
      pending_source: pendingItem.source,
    },
  });
  const decision = dedup.decision;
  const dedupResolution = decidePendingDedupResolution(
    decision,
    input.confirmDuplicate === true,
  );

  if (dedupResolution === "auto_resolve_exact" && decision?.matched_reference_id) {
    const movement = await coreRepository.getMovementById(
      input.userId,
      decision.matched_reference_id
    );

    if (movement) {
      const resolvedPending = await markPendingAutoResolvedDuplicate(
        input.client,
        input.userId,
        pendingItem.id,
        movement.id,
        input.actor.id ?? input.userId,
        input.traceId
      );
      return {
        pendingItem: resolvedPending,
        movement,
        idempotent: true,
        autoResolvedDuplicate: true,
      };
    }
  }

  if (dedupResolution === "require_confirmation" && decision) {
    const updatedPending = await markPendingDuplicateConfirmationRequested(
      input.client,
      input.userId,
      pendingItem.id,
      decision,
      input.traceId
    );
    throw new PendingDuplicateConfirmationRequiredError(
      decision,
      updatedPending
    );
  }

  if (decision && decision.status !== "distinct") {
    movementInput = {
      ...movementInput,
      metadata: {
        ...movementInput.metadata,
        dedup_override_confirmed: true,
        dedup_status: decision.status,
        dedup_matched_reference_id: decision.matched_reference_id,
        dedup_score: decision.score,
      },
    };
  }
  const pendingConfirmationRepository = new SupabasePendingConfirmationRepository(
    input.client,
    {
      pendingItem,
      actorId: input.actor.id ?? input.userId,
      traceId: input.traceId,
    }
  );
  const dispatcher = new CommandDispatcher(pendingConfirmationRepository);
  const result = await dispatcher.dispatch({
    type: "CreateMovementCommand",
    command_id: randomUUID(),
    user_id: input.userId,
    actor: input.actor,
    source: input.source,
    trace_id: input.traceId,
    payload: {
      movement: movementInput,
      idempotency_key: `pending-confirm:${pendingItem.id}`,
    },
  });

  if (result.type !== "movement_created") {
    throw new CoreError(
      "CORE_REPOSITORY_ERROR",
      "El Core no devolvio el movimiento creado"
    );
  }

  const confirmation = pendingConfirmationRepository.lastResult;
  if (!confirmation) {
    throw new CoreError(
      "CORE_REPOSITORY_ERROR",
      "La confirmacion no devolvio el pendiente resuelto"
    );
  }

  return {
    pendingItem: confirmation.pendingItem,
    movement: confirmation.movement,
    idempotent: confirmation.idempotent || result.idempotent,
    autoResolvedDuplicate: false,
  };
}

async function resolveSpecializedPendingDedup(
  input: ConfirmPendingInput,
  pendingItem: PendingItem,
  action:
    | "record_debt_payment"
    | "record_recurring_payment"
    | "record_transfer",
): Promise<ConfirmPendingResult | null> {
  const movementInput = specializedDedupMovementInput(pendingItem);
  if (!movementInput) return null;
  const coreRepository = new SupabaseFinancialCoreRepository(input.client);
  const dedup = await evaluateCrossChannelDedup({
    client: input.client,
    userId: input.userId,
    traceId: input.traceId,
    referenceId: `pending:${pendingItem.id}`,
    movementInput,
    metadata: {
      entry_surface: "pending_specialized_confirmation",
      pending_item_id: pendingItem.id,
      specialized_action: action,
    },
  });
  const decision = dedup.decision;
  if (!decision || decision.status === "distinct") return null;

  if (
    decision.status === "exact_duplicate" &&
    decision.matched_reference_id
  ) {
    const movement = await coreRepository.getMovementById(
      input.userId,
      decision.matched_reference_id,
    );
    if (movement && sameSpecializedEffect(action, pendingItem, movement)) {
      const resolvedPending = await markPendingAutoResolvedDuplicate(
        input.client,
        input.userId,
        pendingItem.id,
        movement.id,
        input.actor.id ?? input.userId,
        input.traceId,
      );
      return {
        pendingItem: resolvedPending,
        movement,
        idempotent: true,
        autoResolvedDuplicate: true,
      };
    }
  }

  if (decision.requires_confirmation && input.confirmDuplicate !== true) {
    const updatedPending = await markPendingDuplicateConfirmationRequested(
      input.client,
      input.userId,
      pendingItem.id,
      decision,
      input.traceId,
    );
    throw new PendingDuplicateConfirmationRequiredError(
      decision,
      updatedPending,
    );
  }
  return null;
}

function specializedDedupMovementInput(
  pendingItem: PendingItem,
): MovementInput | null {
  const proposed = readProposedMovementInput(pendingItem);
  const summary = pendingItem.normalized_summary;
  if (
    !proposed ||
    typeof summary.amount !== "number" ||
    !Number.isFinite(summary.amount)
  ) {
    return null;
  }
  return {
    ...proposed,
    amount: summary.amount,
    currency: summary.currency ?? proposed.currency,
    occurred_at: summary.occurred_at ?? proposed.occurred_at,
    description: summary.title?.trim() || proposed.description,
    source: mapPendingSource(pendingItem.source),
    source_ref: `pending:${pendingItem.id}`,
    requires_review: false,
  };
}

function sameSpecializedEffect(
  action: "record_debt_payment" | "record_recurring_payment" | "record_transfer",
  pendingItem: PendingItem,
  movement: Movement,
): boolean {
  if (action === "record_debt_payment") {
    return (
      readUuid(pendingItem.proposed_action.debt_id) === movement.debt_id &&
      ["pago_deuda", "devolucion_recibida"].includes(movement.type)
    );
  }
  if (action === "record_recurring_payment") {
    return (
      readUuid(pendingItem.proposed_action.recurring_rule_id) ===
        movement.recurring_rule_id &&
      readUuid(pendingItem.proposed_action.recurring_occurrence_id) ===
        movement.recurring_occurrence_id
    );
  }
  return (
    movement.type === "transferencia" &&
    readUuid(pendingItem.proposed_action.account_origin_id) ===
      movement.account_origin_id &&
    readUuid(pendingItem.proposed_action.account_destination_id) ===
      movement.account_destination_id
  );
}

async function confirmPendingTransfer(
  input: ConfirmPendingInput,
  pendingItem: PendingItem,
): Promise<ConfirmPendingResult> {
  const action = pendingItem.proposed_action;
  const originAccountId = readUuid(action.account_origin_id);
  const destinationAccountId = readUuid(action.account_destination_id);
  const amount = pendingItem.normalized_summary.amount;
  const title = pendingItem.normalized_summary.title?.trim();

  if (!originAccountId || !destinationAccountId) {
    throw new PendingConfirmationValidationError(
      "Selecciona la cuenta de origen y destino antes de confirmar la transferencia.",
    );
  }
  if (originAccountId === destinationAccountId) {
    throw new PendingConfirmationValidationError(
      "La cuenta de origen y destino deben ser distintas.",
    );
  }
  if (!title) {
    throw new PendingConfirmationValidationError(
      "Completa el nombre antes de confirmar.",
    );
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new PendingConfirmationValidationError(
      "Completa el monto antes de confirmar.",
    );
  }

  const [origin, destination] = await Promise.all([
    getAccountById(input.client, input.userId, originAccountId),
    getAccountById(input.client, input.userId, destinationAccountId),
  ]);
  if (!origin || !destination) {
    throw new PendingConfirmationValidationError(
      "Una de las cuentas seleccionadas ya no existe.",
    );
  }
  const currency = pendingItem.normalized_summary.currency ?? "PEN";
  if (origin.currency !== currency || destination.currency !== currency) {
    throw new PendingConfirmationValidationError(
      "Ambas cuentas y la transferencia deben tener la misma moneda.",
    );
  }

  const pendingConfirmationRepository =
    new SupabasePendingConfirmationRepository(input.client, {
      pendingItem,
      actorId: input.actor.id ?? input.userId,
      traceId: input.traceId,
    });
  const dispatcher = new CommandDispatcher(pendingConfirmationRepository);
  const result = await dispatcher.dispatch({
    type: "CreateMovementCommand",
    command_id: randomUUID(),
    user_id: input.userId,
    actor: input.actor,
    source: input.source,
    trace_id: input.traceId,
    payload: {
      idempotency_key: `pending-confirm:${pendingItem.id}`,
      movement: {
        type: "transferencia",
        amount,
        currency,
        occurred_at:
          pendingItem.normalized_summary.occurred_at ??
          new Date().toISOString(),
        description: title,
        merchant: null,
        category_id: null,
        subcategory_id: null,
        account_origin_id: origin.id,
        account_destination_id: destination.id,
        box_origin_id: null,
        box_destination_id: null,
        related_person_id: null,
        debt_id: null,
        recurring_rule_id: null,
        recurring_occurrence_id: null,
        source: mapPendingSource(pendingItem.source),
        source_ref: `pending:${pendingItem.id}`,
        confidence: confidenceFromLabel(
          pendingItem.normalized_summary.confidence_label,
        ),
        requires_review: false,
        metadata: {
          pending_item_id: pendingItem.id,
          specialized_resolution: "transfer",
          confirmed_from_pending: true,
        },
      },
    },
  });
  if (result.type !== "movement_created") {
    throw new CoreError(
      "CORE_REPOSITORY_ERROR",
      "El Core no devolvio la transferencia creada.",
    );
  }
  const confirmation = pendingConfirmationRepository.lastResult;
  if (!confirmation) {
    throw new CoreError(
      "CORE_REPOSITORY_ERROR",
      "La transferencia no resolvio el pendiente.",
    );
  }
  return {
    pendingItem: confirmation.pendingItem,
    movement: confirmation.movement,
    idempotent: confirmation.idempotent || result.idempotent,
    autoResolvedDuplicate: false,
  };
}

async function confirmPendingRecurringPayment(
  input: ConfirmPendingInput,
  pendingItem: PendingItem,
): Promise<ConfirmPendingResult> {
  const action = pendingItem.proposed_action;
  const recurringRuleId = readUuid(action.recurring_rule_id);
  const occurrenceId = readUuid(action.recurring_occurrence_id);
  const accountId = readNullableUuid(action.account_id);
  const amount = pendingItem.normalized_summary.amount;
  const paidAt =
    pendingItem.normalized_summary.occurred_at ??
    readString(action.paid_at) ??
    new Date().toISOString();
  const note = pendingItem.normalized_summary.title?.trim() || null;

  if (!recurringRuleId || !occurrenceId) {
    throw new PendingConfirmationValidationError(
      "Selecciona el recurrente y su ocurrencia antes de confirmar.",
    );
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new PendingConfirmationValidationError(
      "Completa el monto antes de confirmar.",
    );
  }

  const [rule, occurrence, account] = await Promise.all([
    getRecurringRuleById(input.client, input.userId, recurringRuleId),
    getRecurringOccurrenceById(input.client, input.userId, occurrenceId),
    accountId
      ? getAccountById(input.client, input.userId, accountId)
      : Promise.resolve(null),
  ]);
  if (!rule || rule.status !== "active") {
    throw new PendingConfirmationValidationError(
      "El recurrente ya no esta activo.",
    );
  }
  if (
    !occurrence ||
    occurrence.recurring_rule_id !== rule.id ||
    ["paid", "skipped", "rejected"].includes(occurrence.status)
  ) {
    throw new PendingConfirmationValidationError(
      "La ocurrencia recurrente ya no se puede confirmar.",
    );
  }
  if (rule.linked_debt_id) {
    throw new PendingConfirmationValidationError(
      "Este recurrente esta vinculado a una deuda y debe confirmarse como pago de deuda.",
    );
  }
  if (accountId && !account) {
    throw new PendingConfirmationValidationError(
      "La cuenta sugerida ya no existe.",
    );
  }
  if (account && account.currency !== rule.currency) {
    throw new PendingConfirmationValidationError(
      "La cuenta y el recurrente deben tener la misma moneda.",
    );
  }

  const idempotencyKey = `pending-confirm:${pendingItem.id}`;
  const movementCommit = buildCreateMovementCommitPayload({
    type: "CreateMovementCommand",
    command_id: randomUUID(),
    user_id: input.userId,
    actor: input.actor,
    source: input.source,
    trace_id: input.traceId,
    payload: {
      idempotency_key: idempotencyKey,
      movement: {
        type: "pago_recurrente",
        amount,
        currency: rule.currency,
        occurred_at: paidAt,
        description: note ?? `Pago de ${rule.name}`,
        merchant: rule.merchant_pattern,
        category_id: rule.category_id,
        subcategory_id: rule.subcategory_id,
        account_origin_id: account?.id ?? null,
        account_destination_id: null,
        box_origin_id: null,
        box_destination_id: null,
        related_person_id: null,
        debt_id: null,
        recurring_rule_id: rule.id,
        recurring_occurrence_id: occurrence.id,
        source: "recurring_confirmed",
        source_ref: `pending-recurring-payment:${pendingItem.id}`,
        confidence: 1,
        requires_review: false,
        metadata: {
          reason: "specialized_pending_recurring_payment",
          pending_item_id: pendingItem.id,
          email_source:
            pendingItem.source === "email_pending" ||
            pendingItem.source === "backfill_pending",
        },
      },
    },
  });
  const recurringOutboxEvents = buildPendingRecurringOutboxEvents({
    userId: input.userId,
    traceId: input.traceId,
    pendingItemId: pendingItem.id,
    ruleId: rule.id,
    occurrenceId: occurrence.id,
    movementId: movementCommit.movement.id,
    amount,
    currency: rule.currency,
    paidAt,
  });
  const result = await commitPendingRecurringPayment(input.client, {
    pendingItemId: pendingItem.id,
    actorId: input.actor.id ?? input.userId,
    traceId: input.traceId,
    recurringRuleId: rule.id,
    occurrenceId: occurrence.id,
    movementCommit,
    recurringOutboxEvents,
  });
  return {
    pendingItem: result.pending_item,
    movement: result.movement,
    idempotent: result.idempotent,
    autoResolvedDuplicate: false,
  };
}

function buildPendingRecurringOutboxEvents(input: {
  userId: string;
  traceId: string;
  pendingItemId: string;
  ruleId: string;
  occurrenceId: string;
  movementId: string;
  amount: number;
  currency: "PEN" | "USD";
  paidAt: string;
}): OutboxEventDraft[] {
  return [
    {
      id: randomUUID(),
      user_id: input.userId,
      event_type: "recurring_payment_confirmed",
      aggregate_type: "recurring_rule",
      aggregate_id: input.ruleId,
      payload: {
        recurring_rule_id: input.ruleId,
        recurring_occurrence_id: input.occurrenceId,
        movement_id: input.movementId,
        pending_item_id: input.pendingItemId,
        amount: input.amount,
        currency: input.currency,
        paid_at: input.paidAt,
      },
      payload_version: 1,
      trace_id: input.traceId,
      metadata: {
        source: "pending_confirmation",
        specialized_resolution: "recurring_payment",
      },
    },
  ];
}

async function confirmPendingDebtPayment(
  input: ConfirmPendingInput,
  pendingItem: PendingItem,
): Promise<ConfirmPendingResult> {
  const action = pendingItem.proposed_action;
  const debtId = readUuid(action.debt_id);
  const accountId = readNullableUuid(action.account_id);
  const installmentId = readNullableUuid(action.installment_id);
  const installmentNumber =
    typeof action.installment_number === "number" &&
    Number.isInteger(action.installment_number) &&
    action.installment_number > 0
      ? action.installment_number
      : null;
  const amount = pendingItem.normalized_summary.amount;
  const title = pendingItem.normalized_summary.title?.trim() || null;
  const currency = pendingItem.normalized_summary.currency ?? null;
  const paidAt =
    pendingItem.normalized_summary.occurred_at ??
    readString(action.paid_at) ??
    new Date().toISOString();

  if (!debtId) {
    throw new PendingConfirmationValidationError(
      "Selecciona la deuda antes de confirmar este pago.",
    );
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new PendingConfirmationValidationError(
      "Completa el monto antes de confirmar.",
    );
  }

  const actorId = input.actor.id ?? input.userId;
  const handler = new DebtPaymentCommandHandler(
    new SupabaseDebtPaymentExecutionPort(input.client, input.client, {
      pendingItemId: pendingItem.id,
      actorId,
      traceId: input.traceId,
    }),
  );
  const result = await handler.execute({
    type: "RecordDebtPaymentCommand",
    command_id: randomUUID(),
    user_id: input.userId,
    actor: input.actor,
    source: input.source,
    trace_id: input.traceId,
    payload: {
      debt_id: debtId,
      amount,
      currency,
      account_id: accountId,
      installment_id: installmentId,
      installment_number: installmentNumber,
      paid_at: paidAt,
      note: title,
      idempotency_key: `pending-confirm:${pendingItem.id}`,
      payment_source:
        pendingItem.source === "email_pending" ||
        pendingItem.source === "backfill_pending"
          ? "email_confirmed"
          : "dashboard_manual",
    },
  });
  const resolvedPending = await getPendingItemById(
    input.client,
    input.userId,
    pendingItem.id,
  );
  if (!resolvedPending || resolvedPending.status !== "user_confirmed") {
    throw new CoreError(
      "CORE_REPOSITORY_ERROR",
      "El pago actualizo la deuda pero no resolvio el pendiente.",
    );
  }
  return {
    pendingItem: resolvedPending,
    movement: result.movement,
    idempotent: result.idempotent,
    autoResolvedDuplicate: false,
  };
}

export function toMovementInputFromPending(
  pendingItem: PendingItem
): MovementInput {
  const summary = pendingItem.normalized_summary;
  const title = summary.title?.trim();

  if (!title) {
    throw new PendingConfirmationValidationError(
      "Completa el nombre antes de confirmar."
    );
  }

  if (typeof summary.amount !== "number" || !Number.isFinite(summary.amount)) {
    throw new PendingConfirmationValidationError(
      "Completa el monto antes de confirmar."
    );
  }

  if (!summary.category_id) {
    throw new PendingConfirmationValidationError(
      "Completa la categoria antes de confirmar."
    );
  }

  const movementType = getMovementType(pendingItem);
  if (
    movementType !== "gasto" &&
    movementType !== "ingreso" &&
    movementType !== "devolucion_recibida"
  ) {
    throw new PendingConfirmationValidationError(
      "Ese pendiente necesita su motor financiero especializado; no se puede confirmar como movimiento generico."
    );
  }

  const proposedMovement = readProposedMovementInput(pendingItem);
  const accountId =
    readNullableUuid(pendingItem.metadata.account_id) ??
    readNullableUuid(
      pendingItem.proposed_action.account_id,
    );
  return {
    ...(proposedMovement ?? emptyMovementInput(pendingItem)),
    type: movementType,
    amount: summary.amount,
    currency: summary.currency ?? "PEN",
    occurred_at: summary.occurred_at ?? new Date().toISOString(),
    description: title,
    merchant: title,
    category_id: summary.category_id,
    account_origin_id:
      proposedMovement?.account_origin_id ??
      (movementType === "gasto" ? accountId : null),
    account_destination_id:
      proposedMovement?.account_destination_id ??
      (movementType === "ingreso" || movementType === "devolucion_recibida"
        ? accountId
        : null),
    debt_id: null,
    recurring_rule_id: null,
    recurring_occurrence_id: null,
    source: mapPendingSource(pendingItem.source),
    source_ref: `pending:${pendingItem.id}`,
    confidence: confidenceFromLabel(summary.confidence_label),
    requires_review: false,
    metadata: {
      ...(proposedMovement?.metadata ?? {}),
      pending_item_id: pendingItem.id,
      pending_source: pendingItem.source,
      pending_source_ref: pendingItem.source_ref,
      pending_type: pendingItem.type,
      confirmed_from_pending: true,
      institution_key: pendingItem.metadata.institution_key ?? null,
    },
  };
}

function readProposedMovementInput(
  pendingItem: PendingItem,
): MovementInput | null {
  const parsed = MovementInputSchema.safeParse(
    pendingItem.proposed_action.movement_input,
  );
  return parsed.success ? parsed.data : null;
}

function emptyMovementInput(pendingItem: PendingItem): MovementInput {
  return {
    type: "gasto",
    amount: null,
    currency: "PEN",
    occurred_at: new Date().toISOString(),
    description: null,
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
    source: mapPendingSource(pendingItem.source),
    source_ref: `pending:${pendingItem.id}`,
    confidence: null,
    requires_review: false,
    metadata: {},
  };
}

function getProposedAction(pendingItem: PendingItem): string {
  return readString(pendingItem.proposed_action.action) ?? "create_movement";
}

function readUuid(value: unknown): string | null {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : null;
}

function readNullableUuid(value: unknown): string | null {
  return value === null || value === undefined ? null : readUuid(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getConfirmedMovementId(pendingItem: PendingItem): string | null {
  const value = pendingItem.metadata.confirmed_movement_id;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getMovementType(pendingItem: PendingItem): MovementType {
  const proposed = pendingItem.proposed_action;
  const movementType =
    proposed && typeof proposed === "object"
      ? (proposed as { movement_type?: unknown }).movement_type
      : null;

  if (
    typeof movementType === "string" &&
    MOVEMENT_TYPES.includes(movementType as MovementType)
  ) {
    return movementType as MovementType;
  }

  return pendingItem.metadata.money_sign === "positive" ? "ingreso" : "gasto";
}

function mapPendingSource(source: PendingSource): MovementSource {
  const map: Record<PendingSource, MovementSource> = {
    email_pending: "email_confirmed",
    backfill_pending: "backfill_confirmed",
    recurring_candidate: "recurring_confirmed",
    ambiguous_movement: "whatsapp",
    risk_confirmation: "dashboard_manual",
  };

  return map[source];
}

function confidenceFromLabel(value: string | null | undefined): number | null {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized.includes("alta")) return 0.9;
  if (normalized.includes("media") || normalized.includes("normal")) return 0.7;
  if (normalized.includes("baja") || normalized.includes("falta")) return 0.45;
  return null;
}
