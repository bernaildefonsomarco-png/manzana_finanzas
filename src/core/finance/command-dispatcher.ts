import { randomUUID } from "node:crypto";
import type { Movement } from "@/shared/types/domain";
import {
  CreateMovementCommandSchema,
  CoreCommandSchema,
  type CoreCommand,
  type CreateDebtCommand,
  type CreateMovementCommand,
  type MovementPatch,
} from "./commands";
import {
  calculateMovementBalanceEffect,
  combineBalanceEffects,
  normalizeMovementAmount,
  reverseBalanceEffect,
} from "./balance-engine";
import { CoreError } from "./errors";
import type {
  AuditLogDraft,
  FinancialCoreRepository,
  MovementCommitPayload,
  MovementDraft,
} from "./repository";
import type { MovementInput } from "@/shared/schemas/money";
import type { OutboxEventDraft } from "@/core/events/domain-events";
import type {
  DebtPaymentCommandResult,
  DebtPaymentCommandHandler,
} from "@/core/debts/debt-payment-command";
import type {
  DebtCreationCommandHandler,
  DebtCreationCommandResult,
} from "@/core/debts/debt-creation-command";

export type CommandResult =
  | {
      type: "movement_created";
      movement: Movement;
      idempotent: boolean;
    }
  | {
      type:
        | "movement_updated"
        | "movement_corrected"
        | "movement_deleted"
        | "movement_restored";
      movement: Movement;
    }
  | DebtPaymentCommandResult
  | DebtCreationCommandResult;

export type NonDebtCreationCommand = Exclude<
  CoreCommand,
  { type: "CreateDebtCommand" }
>;
export type NonDebtCreationCommandResult = Exclude<
  CommandResult,
  DebtCreationCommandResult
>;

export class CommandDispatcher {
  private readonly debtPaymentHandler: Pick<DebtPaymentCommandHandler, "execute"> | null;
  private readonly debtCreationHandler: Pick<
    DebtCreationCommandHandler,
    "execute"
  > | null;

  constructor(
    private readonly repository: FinancialCoreRepository,
    options: {
      debtPaymentHandler?: Pick<DebtPaymentCommandHandler, "execute">;
      debtCreationHandler?: Pick<DebtCreationCommandHandler, "execute">;
    } = {}
  ) {
    this.debtPaymentHandler = options.debtPaymentHandler ?? null;
    this.debtCreationHandler = options.debtCreationHandler ?? null;
  }

  async dispatch(
    rawCommand: CreateDebtCommand,
  ): Promise<DebtCreationCommandResult>;
  async dispatch(
    rawCommand: NonDebtCreationCommand,
  ): Promise<NonDebtCreationCommandResult>;
  async dispatch(rawCommand: CoreCommand): Promise<CommandResult>;
  async dispatch(rawCommand: CoreCommand): Promise<CommandResult> {
    const command = CoreCommandSchema.parse(rawCommand);

    switch (command.type) {
      case "CreateMovementCommand":
        return this.createMovement(command);
      case "UpdateMovementCommand":
        return this.updateMovement(command, "updated");
      case "CorrectMovementCommand":
        return this.correctMovement(command);
      case "DeleteMovementCommand":
        return this.deleteMovement(command);
      case "RestoreMovementCommand":
        return this.restoreMovement(command);
      case "RecordDebtPaymentCommand":
        if (!this.debtPaymentHandler) {
          throw new CoreError(
            "DEBT_PAYMENT_HANDLER_UNAVAILABLE",
            "El ejecutor especializado de pagos de deuda no esta configurado."
          );
        }
        return this.debtPaymentHandler.execute(command);
      case "CreateDebtCommand":
        if (!this.debtCreationHandler) {
          throw new CoreError(
            "DEBT_CREATION_HANDLER_UNAVAILABLE",
            "El ejecutor especializado de creacion de deudas no esta configurado.",
          );
        }
        return this.debtCreationHandler.execute(command);
    }
  }

  private async createMovement(
    command: Extract<CoreCommand, { type: "CreateMovementCommand" }>
  ): Promise<CommandResult> {
    const existing = await this.repository.findMovementByIdempotencyKey(
      command.user_id,
      command.payload.idempotency_key
    );

    if (existing) {
      return {
        type: "movement_created",
        movement: existing,
        idempotent: true,
      };
    }

    const payload = buildCreateMovementCommitPayload(command);

    const saved = await this.repository.commitCreateMovement(payload);

    return { type: "movement_created", movement: saved, idempotent: false };
  }

  private async updateMovement(
    command: Extract<CoreCommand, { type: "UpdateMovementCommand" }>,
    action: "updated"
  ): Promise<CommandResult> {
    const previous = await this.requireActiveMovement(
      command.user_id,
      command.payload.movement_id
    );
    this.assertStandaloneMovementMutation(previous);
    const nextInput = mergeMovementInput(previous, command.payload.patch);
    const previousEffect = calculateMovementBalanceEffect(
      movementToInput(previous)
    );
    const nextEffect = calculateMovementBalanceEffect(nextInput);
    const combinedEffect = combineBalanceEffects(
      reverseBalanceEffect(previousEffect),
      nextEffect
    );
    const nextMovement = movementDraftFromExisting(previous, nextInput, {
      status: previous.status,
      affectsTotalBalance: nextEffect.affectsTotalBalance,
      affectsAccountBalance: nextEffect.affectsAccountBalance,
      metadata: {
        ...nextInput.metadata,
        last_update_reason: command.payload.reason,
      },
    });
    const auditLogs = buildDiffAuditLogs({
      command,
      previous,
      next: nextMovement,
      action,
    });

    const saved = await this.repository.commitUpdateMovement({
      movement: nextMovement,
      auditLogs,
      accountDeltas: combinedEffect.accountDeltas,
      boxDeltas: combinedEffect.boxDeltas,
      outboxEvents: [
        buildMovementOutboxEvent({
          command,
          movement: nextMovement,
          eventType: "movement_updated",
        }),
      ],
    });

    return { type: "movement_updated", movement: saved };
  }

  private async correctMovement(
    command: Extract<CoreCommand, { type: "CorrectMovementCommand" }>
  ): Promise<CommandResult> {
    const previous = await this.requireActiveMovement(
      command.user_id,
      command.payload.movement_id
    );
    this.assertStandaloneMovementMutation(previous);
    const nextInput = mergeMovementInput(
      previous,
      command.payload.corrected_fields
    );
    const previousEffect = calculateMovementBalanceEffect(
      movementToInput(previous)
    );
    const nextEffect = calculateMovementBalanceEffect(nextInput);
    const combinedEffect = combineBalanceEffects(
      reverseBalanceEffect(previousEffect),
      nextEffect
    );
    const nextMovement = movementDraftFromExisting(previous, nextInput, {
      status: "corrected",
      affectsTotalBalance: nextEffect.affectsTotalBalance,
      affectsAccountBalance: nextEffect.affectsAccountBalance,
      metadata: {
        ...nextInput.metadata,
        correction_reason: command.payload.reason,
        user_correction_text: command.payload.user_correction_text,
      },
    });
    const auditLogs = buildDiffAuditLogs({
      command,
      previous,
      next: nextMovement,
      action: "corrected",
    });

    const saved = await this.repository.commitUpdateMovement({
      movement: nextMovement,
      auditLogs,
      accountDeltas: combinedEffect.accountDeltas,
      boxDeltas: combinedEffect.boxDeltas,
      outboxEvents: [
        buildMovementOutboxEvent({
          command,
          movement: nextMovement,
          eventType: "movement_corrected",
        }),
      ],
    });

    return { type: "movement_corrected", movement: saved };
  }

  private async deleteMovement(
    command: Extract<CoreCommand, { type: "DeleteMovementCommand" }>
  ): Promise<CommandResult> {
    const previous = await this.requireActiveMovement(
      command.user_id,
      command.payload.movement_id
    );
    this.assertStandaloneMovementMutation(previous);
    const previousEffect = calculateMovementBalanceEffect(
      movementToInput(previous)
    );
    const reversedEffect = reverseBalanceEffect(previousEffect);
    const now = new Date().toISOString();
    const status = command.payload.mode === "reverse" ? "reversed" : "deleted";
    const nextMovement: MovementDraft = {
      ...previous,
      status,
      deleted_at: command.payload.mode === "soft_delete" ? now : previous.deleted_at,
      metadata: {
        ...previous.metadata,
        delete_reason: command.payload.reason,
        delete_mode: command.payload.mode,
        status_before_delete: previous.status,
      },
    };
    const auditLogs = [
      buildAuditLog({
        command,
        movement: nextMovement,
        action: status,
        fieldName: "status",
        oldValue: previous.status,
        newValue: status,
      }),
    ];

    const saved = await this.repository.commitUpdateMovement({
      movement: nextMovement,
      auditLogs,
      accountDeltas: reversedEffect.accountDeltas,
      boxDeltas: reversedEffect.boxDeltas,
      outboxEvents: [
        buildMovementOutboxEvent({
          command,
          movement: nextMovement,
          eventType:
            command.payload.mode === "reverse"
              ? "movement_reversed"
              : "movement_deleted",
        }),
      ],
    });

    return { type: "movement_deleted", movement: saved };
  }

  private async restoreMovement(
    command: Extract<CoreCommand, { type: "RestoreMovementCommand" }>,
  ): Promise<CommandResult> {
    const previous = await this.repository.getMovementById(
      command.user_id,
      command.payload.movement_id,
    );
    if (!previous) {
      throw new CoreError("MOVEMENT_NOT_FOUND", "Movimiento no encontrado", {
        movement_id: command.payload.movement_id,
      });
    }
    if (previous.status === "reversed") {
      throw new CoreError(
        "MOVEMENT_REVERSED_NOT_RESTORABLE",
        "Un movimiento revertido no puede restaurarse como si nunca hubiera ocurrido.",
        { movement_id: previous.id },
      );
    }
    if (previous.status !== "deleted" || !previous.deleted_at) {
      throw new CoreError(
        "MOVEMENT_NOT_DELETED",
        "El movimiento no está eliminado.",
        { movement_id: previous.id, status: previous.status },
      );
    }
    this.assertStandaloneMovementMutation(previous);

    const input = movementToInput(previous);
    const effect = calculateMovementBalanceEffect(input);
    const priorStatus = previous.metadata.status_before_delete;
    const restoredStatus =
      priorStatus === "corrected" || priorStatus === "needs_review"
        ? priorStatus
        : "confirmed";
    const nextMovement: MovementDraft = {
      ...previous,
      status: restoredStatus,
      deleted_at: null,
      metadata: {
        ...previous.metadata,
        restore_reason: command.payload.reason,
        restored_at: new Date().toISOString(),
      },
    };
    const auditLogs = [
      buildAuditLog({
        command,
        movement: nextMovement,
        action: "restored",
        fieldName: "status",
        oldValue: previous.status,
        newValue: restoredStatus,
      }),
    ];
    const saved = await this.repository.commitUpdateMovement({
      movement: nextMovement,
      auditLogs,
      accountDeltas: effect.accountDeltas,
      boxDeltas: effect.boxDeltas,
      outboxEvents: [
        buildMovementOutboxEvent({
          command,
          movement: nextMovement,
          eventType: "movement_restored",
        }),
      ],
    });
    return { type: "movement_restored", movement: saved };
  }

  private async requireActiveMovement(
    userId: string,
    movementId: string
  ): Promise<Movement> {
    const movement = await this.repository.getMovementById(userId, movementId);

    if (!movement) {
      throw new CoreError("MOVEMENT_NOT_FOUND", "Movimiento no encontrado", {
        movement_id: movementId,
      });
    }

    if (movement.deleted_at || ["deleted", "reversed"].includes(movement.status)) {
      throw new CoreError(
        "MOVEMENT_ALREADY_INACTIVE",
        "El movimiento ya no esta activo",
        { movement_id: movementId, status: movement.status }
      );
    }

    return movement;
  }

  private assertStandaloneMovementMutation(movement: Movement): void {
    if (
      movement.debt_id ||
      movement.recurring_rule_id ||
      movement.recurring_occurrence_id
    ) {
      throw new CoreError(
        "MOVEMENT_REQUIRES_SPECIALIZED_ENGINE",
        "Este movimiento está vinculado a una deuda o pago recurrente y debe modificarse desde su flujo especializado.",
        {
          movement_id: movement.id,
          debt_id: movement.debt_id,
          recurring_rule_id: movement.recurring_rule_id,
          recurring_occurrence_id: movement.recurring_occurrence_id,
        },
      );
    }
  }
}

export function buildCreateMovementCommitPayload(
  rawCommand: CreateMovementCommand
): MovementCommitPayload {
  const command = CreateMovementCommandSchema.parse(rawCommand);
  const input = command.payload.movement;
  const effect = calculateMovementBalanceEffect(input);
  const movement = buildMovementDraft({
    command,
    input,
    idempotencyKey: command.payload.idempotency_key,
    status: input.requires_review ? "needs_review" : "confirmed",
    affectsTotalBalance: effect.affectsTotalBalance,
    affectsAccountBalance: effect.affectsAccountBalance,
  });

  const auditLogs = [
    buildAuditLog({
      command,
      movement,
      action: "created",
      fieldName: null,
      oldValue: null,
      newValue: movement,
    }),
  ];

  return {
    movement,
    auditLogs,
    accountDeltas: effect.accountDeltas,
    boxDeltas: effect.boxDeltas,
    outboxEvents: [
      buildMovementOutboxEvent({
        command,
        movement,
        eventType: "movement_created",
      }),
    ],
  };
}

function buildMovementDraft(params: {
  command: Extract<CoreCommand, { type: "CreateMovementCommand" }>;
  input: MovementInput;
  idempotencyKey: string;
  status: Movement["status"];
  affectsTotalBalance: boolean;
  affectsAccountBalance: boolean;
}): MovementDraft {
  const { command, input } = params;

  if (input.amount == null) {
    throw new CoreError(
      "INVALID_MOVEMENT_AMOUNT",
      "El movimiento confirmado necesita monto"
    );
  }

  return {
    id: randomUUID(),
    user_id: command.user_id,
    type: input.type,
    status: params.status,
    amount: normalizeMovementAmount(input.amount),
    currency: input.currency,
    occurred_at: input.occurred_at,
    description: input.description,
    merchant: input.merchant,
    category_id: input.category_id,
    subcategory_id: input.subcategory_id,
    source: input.source,
    source_ref: input.source_ref,
    idempotency_key: params.idempotencyKey,
    confidence: input.confidence,
    requires_review: input.requires_review,
    account_origin_id: input.account_origin_id,
    account_destination_id: input.account_destination_id,
    box_origin_id: input.box_origin_id,
    box_destination_id: input.box_destination_id,
    debt_id: input.debt_id,
    recurring_rule_id: input.recurring_rule_id,
    recurring_occurrence_id: input.recurring_occurrence_id,
    related_person_id: input.related_person_id,
    affects_total_balance: params.affectsTotalBalance,
    affects_account_balance: params.affectsAccountBalance,
    deleted_at: null,
    metadata: input.metadata,
  };
}

function movementDraftFromExisting(
  previous: Movement,
  input: MovementInput,
  overrides: {
    status: Movement["status"];
    affectsTotalBalance: boolean;
    affectsAccountBalance: boolean;
    metadata: Record<string, unknown>;
  }
): MovementDraft {
  if (input.amount == null) {
    throw new CoreError(
      "INVALID_MOVEMENT_AMOUNT",
      "El movimiento confirmado necesita monto"
    );
  }

  return {
    ...previous,
    type: input.type,
    status: overrides.status,
    amount: normalizeMovementAmount(input.amount),
    currency: input.currency,
    occurred_at: input.occurred_at,
    description: input.description,
    merchant: input.merchant,
    category_id: input.category_id,
    subcategory_id: input.subcategory_id,
    source: input.source,
    source_ref: input.source_ref,
    confidence: input.confidence,
    requires_review: input.requires_review,
    account_origin_id: input.account_origin_id,
    account_destination_id: input.account_destination_id,
    box_origin_id: input.box_origin_id,
    box_destination_id: input.box_destination_id,
    debt_id: input.debt_id,
    recurring_rule_id: input.recurring_rule_id,
    recurring_occurrence_id: input.recurring_occurrence_id,
    related_person_id: input.related_person_id,
    affects_total_balance: overrides.affectsTotalBalance,
    affects_account_balance: overrides.affectsAccountBalance,
    metadata: overrides.metadata,
  };
}

function movementToInput(movement: Movement): MovementInput {
  return {
    type: movement.type,
    amount: movement.amount,
    currency: movement.currency,
    occurred_at: movement.occurred_at,
    description: movement.description,
    merchant: movement.merchant,
    category_id: movement.category_id,
    subcategory_id: movement.subcategory_id,
    account_origin_id: movement.account_origin_id,
    account_destination_id: movement.account_destination_id,
    box_origin_id: movement.box_origin_id,
    box_destination_id: movement.box_destination_id,
    related_person_id: movement.related_person_id,
    debt_id: movement.debt_id,
    recurring_rule_id: movement.recurring_rule_id,
    recurring_occurrence_id: movement.recurring_occurrence_id,
    source: movement.source,
    source_ref: movement.source_ref,
    confidence: movement.confidence,
    requires_review: movement.requires_review,
    metadata: movement.metadata,
  };
}

function mergeMovementInput(
  previous: Movement,
  patch: MovementPatch
): MovementInput {
  return {
    ...movementToInput(previous),
    ...patch,
    metadata: {
      ...previous.metadata,
      ...(patch.metadata ?? {}),
    },
  };
}

function buildAuditLog(params: {
  command: CoreCommand;
  movement: MovementDraft;
  action: AuditLogDraft["action"];
  fieldName: string | null;
  oldValue: unknown;
  newValue: unknown;
}): AuditLogDraft {
  const { command, movement } = params;

  return {
    id: randomUUID(),
    user_id: command.user_id,
    movement_id: movement.id,
    entity_type: "movement",
    entity_id: movement.id,
    action: params.action,
    field_name: params.fieldName,
    old_value: params.oldValue,
    new_value: params.newValue,
    source: command.source,
    actor_type: command.actor.type,
    actor_id: command.actor.id,
    trace_id: command.trace_id,
    metadata: {
      command_id: command.command_id,
    },
  };
}

function buildMovementOutboxEvent(params: {
  command: CoreCommand;
  movement: MovementDraft;
  eventType: string;
}): OutboxEventDraft {
  const { command, movement } = params;

  return {
    id: randomUUID(),
    user_id: command.user_id,
    event_type: params.eventType,
    aggregate_type: "movement",
    aggregate_id: movement.id,
    payload_version: 1,
    trace_id: command.trace_id,
    payload: {
      movement_id: movement.id,
      movement_type: movement.type,
      movement_status: movement.status,
      amount: movement.amount,
      currency: movement.currency,
      occurred_at: movement.occurred_at,
      category_id: movement.category_id,
      source: movement.source,
      affects_total_balance: movement.affects_total_balance,
      affects_account_balance: movement.affects_account_balance,
      command_id: command.command_id,
    },
    metadata: {
      source: command.source,
      actor_type: command.actor.type,
      actor_id: command.actor.id,
    },
  };
}

function buildDiffAuditLogs(params: {
  command: CoreCommand;
  previous: Movement;
  next: MovementDraft;
  action: AuditLogDraft["action"];
}): AuditLogDraft[] {
  const fields: Array<keyof MovementDraft> = [
    "type",
    "status",
    "amount",
    "currency",
    "occurred_at",
    "description",
    "merchant",
    "category_id",
    "subcategory_id",
    "source",
    "source_ref",
    "confidence",
    "requires_review",
    "account_origin_id",
    "account_destination_id",
    "box_origin_id",
    "box_destination_id",
    "debt_id",
    "recurring_rule_id",
    "recurring_occurrence_id",
    "related_person_id",
    "affects_total_balance",
    "affects_account_balance",
    "deleted_at",
    "metadata",
  ];

  return fields
    .filter((field) => !sameValue(params.previous[field], params.next[field]))
    .map((field) =>
      buildAuditLog({
        command: params.command,
        movement: params.next,
        action: params.action,
        fieldName: field,
        oldValue: params.previous[field],
        newValue: params.next[field],
      })
    );
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
