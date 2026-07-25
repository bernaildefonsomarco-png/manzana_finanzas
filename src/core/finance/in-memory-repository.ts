import type { Movement } from "@/shared/types/domain";
import type { OutboxEventDraft } from "@/core/events/domain-events";
import { CoreError } from "./errors";
import type {
  AuditLogDraft,
  FinancialCoreRepository,
  MovementCommitPayload,
  MovementDraft,
} from "./repository";

type InMemoryState = {
  movements?: Movement[];
  auditLogs?: AuditLogDraft[];
  outboxEvents?: OutboxEventDraft[];
  accountBalances?: Record<string, number>;
  boxBalances?: Record<string, number>;
};

export class InMemoryFinancialCoreRepository
  implements FinancialCoreRepository
{
  readonly movements = new Map<string, Movement>();
  readonly auditLogs: AuditLogDraft[] = [];
  readonly outboxEvents: OutboxEventDraft[] = [];
  readonly accountBalances = new Map<string, number>();
  readonly boxBalances = new Map<string, number>();

  constructor(state: InMemoryState = {}) {
    for (const movement of state.movements ?? []) {
      this.movements.set(movement.id, movement);
    }
    this.auditLogs.push(...(state.auditLogs ?? []));
    this.outboxEvents.push(...(state.outboxEvents ?? []));
    Object.entries(state.accountBalances ?? {}).forEach(([id, balance]) => {
      this.accountBalances.set(id, balance);
    });
    Object.entries(state.boxBalances ?? {}).forEach(([id, balance]) => {
      this.boxBalances.set(id, balance);
    });
  }

  async findMovementByIdempotencyKey(
    userId: string,
    idempotencyKey: string
  ): Promise<Movement | null> {
    return (
      [...this.movements.values()].find(
        (movement) =>
          movement.user_id === userId &&
          movement.idempotency_key === idempotencyKey
      ) ?? null
    );
  }

  async getMovementById(
    userId: string,
    movementId: string
  ): Promise<Movement | null> {
    const movement = this.movements.get(movementId);
    if (!movement || movement.user_id !== userId) return null;
    return movement;
  }

  async commitCreateMovement(
    payload: MovementCommitPayload
  ): Promise<Movement> {
    const existing = await this.findMovementByIdempotencyKey(
      payload.movement.user_id,
      payload.movement.idempotency_key
    );

    if (existing) return existing;

    const movement = hydrateMovement(payload.movement);
    this.applyDeltas(payload);
    this.movements.set(movement.id, movement);
    this.auditLogs.push(...payload.auditLogs);
    this.outboxEvents.push(...payload.outboxEvents);
    return movement;
  }

  async commitUpdateMovement(
    payload: MovementCommitPayload
  ): Promise<Movement> {
    if (!this.movements.has(payload.movement.id)) {
      throw new CoreError("MOVEMENT_NOT_FOUND", "Movimiento no encontrado");
    }

    const movement = hydrateMovement(payload.movement);
    this.applyDeltas(payload);
    this.movements.set(movement.id, movement);
    this.auditLogs.push(...payload.auditLogs);
    this.outboxEvents.push(...payload.outboxEvents);
    return movement;
  }

  private applyDeltas(payload: MovementCommitPayload): void {
    for (const delta of payload.accountDeltas) {
      if (!this.accountBalances.has(delta.account_id)) {
        throw new CoreError("CORE_REPOSITORY_ERROR", "Cuenta no encontrada", {
          account_id: delta.account_id,
        });
      }
      this.accountBalances.set(
        delta.account_id,
        roundMoney(this.accountBalances.get(delta.account_id)! + delta.delta)
      );
    }

    for (const delta of payload.boxDeltas) {
      if (!this.boxBalances.has(delta.box_id)) {
        throw new CoreError("CORE_REPOSITORY_ERROR", "Caja no encontrada", {
          box_id: delta.box_id,
        });
      }
      this.boxBalances.set(
        delta.box_id,
        roundMoney(this.boxBalances.get(delta.box_id)! + delta.delta)
      );
    }
  }
}

function hydrateMovement(draft: MovementDraft): Movement {
  const now = new Date().toISOString();
  return {
    ...draft,
    created_at: draft.created_at ?? now,
    updated_at: draft.updated_at ?? now,
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
