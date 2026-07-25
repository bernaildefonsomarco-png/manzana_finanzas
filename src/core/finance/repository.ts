import type { Movement, MovementAuditLog } from "@/shared/types/domain";
import type { OutboxEventDraft } from "@/core/events/domain-events";
import type { BalanceDelta, BoxBalanceDelta } from "./balance-engine";

export type MovementDraft = Omit<Movement, "created_at" | "updated_at"> & {
  created_at?: string;
  updated_at?: string;
};

export type AuditLogDraft = Omit<MovementAuditLog, "created_at"> & {
  created_at?: string;
};

export type MovementCommitPayload = {
  movement: MovementDraft;
  auditLogs: AuditLogDraft[];
  accountDeltas: BalanceDelta[];
  boxDeltas: BoxBalanceDelta[];
  outboxEvents: OutboxEventDraft[];
};

export interface FinancialCoreRepository {
  findMovementByIdempotencyKey(
    userId: string,
    idempotencyKey: string
  ): Promise<Movement | null>;

  getMovementById(userId: string, movementId: string): Promise<Movement | null>;

  commitCreateMovement(payload: MovementCommitPayload): Promise<Movement>;

  commitUpdateMovement(payload: MovementCommitPayload): Promise<Movement>;
}
