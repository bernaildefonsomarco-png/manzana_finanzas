import { randomUUID } from "node:crypto";
import { z } from "zod";
import { CommandDispatcher } from "@/core/finance";
import { CoreError } from "@/core/finance/errors";
import { assertSystemActionAllowed } from "@/core/risk/system-action-gate";
import { SupabaseFinancialCoreRepository } from "@/data/repositories/movements.repository";
import {
  listPendingItemsByBatchId,
  reopenPendingAfterBatchUndo,
} from "@/data/repositories/pending.repository";
import { createServiceClient } from "@/data/supabase/server";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";

export const dynamic = "force-dynamic";

const ParamsSchema = z.object({
  batch_id: z.string().uuid(),
});

const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

type RouteContext = {
  params: Promise<{ batch_id: string }>;
};

/**
 * RUL-PEND-07/ACT-PEND-07 (27 S19 caso 7): deshace un lote de pendientes
 * confirmados dentro de 24h — elimina (soft delete) los movimientos que
 * el lote creo y reabre esos pendientes. No recompone pagos de deuda ni
 * recurrentes revertidos a medias (WEB-D202): esos casos se reportan como
 * "no revertido", no se fuerza una reversion parcial.
 */
export async function POST(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const params = ParamsSchema.parse(await context.params);
    assertSystemActionAllowed({
      actionKind: "pending_resolution",
      authenticatedSession: true,
      explicitUserConfirmation: true,
      reversible: true,
    });

    const serviceClient = createServiceClient();
    const items = await listPendingItemsByBatchId(
      serviceClient,
      auth.userId,
      params.batch_id
    );

    if (items.length === 0) {
      return errorJson(
        "NOT_FOUND",
        "No encontre ese lote, o ya se deshizo.",
        meta,
        404
      );
    }

    const movementRepository = new SupabaseFinancialCoreRepository(serviceClient);
    const dispatcher = new CommandDispatcher(movementRepository);
    const now = Date.now();
    const results: Array<Record<string, unknown>> = [];

    for (const item of items) {
      const movementId = readMovementId(item.metadata.confirmed_movement_id);
      if (!movementId) {
        results.push({ pending_item_id: item.id, status: "skipped", reason: "no_movement" });
        continue;
      }
      const movement = await movementRepository.getMovementById(auth.userId, movementId);
      if (!movement) {
        results.push({ pending_item_id: item.id, status: "skipped", reason: "movement_not_found" });
        continue;
      }
      if (now - new Date(movement.created_at).getTime() > UNDO_WINDOW_MS) {
        results.push({ pending_item_id: item.id, status: "skipped", reason: "expired_24h" });
        continue;
      }
      // ERR-PEND-09: solo el camino generico se deshace completo aqui;
      // un pago de deuda o recurrente que ya afecto otra entidad se
      // reporta como no revertido en vez de forzar una reversion parcial.
      if (movement.debt_id || movement.recurring_rule_id) {
        results.push({ pending_item_id: item.id, status: "skipped", reason: "specialized_effect" });
        continue;
      }

      try {
        await dispatcher.dispatch({
          type: "DeleteMovementCommand",
          command_id: randomUUID(),
          user_id: auth.userId,
          actor: { type: "user", id: auth.userId },
          source: "api.v1.pending.batch-undo",
          trace_id,
          payload: {
            movement_id: movementId,
            mode: "soft_delete",
            reason: "Deshacer confirmacion en lote",
          },
        });
        await reopenPendingAfterBatchUndo(serviceClient, auth.userId, item.id, trace_id);
        results.push({ pending_item_id: item.id, status: "undone", movement_id: movementId });
      } catch (error) {
        results.push({
          pending_item_id: item.id,
          status: "failed",
          reason: error instanceof CoreError ? error.code : "UNDO_FAILED",
        });
      }
    }

    const undone = results.filter((r) => r.status === "undone").length;
    return okJson(
      {
        batch_id: params.batch_id,
        requested: items.length,
        undone,
        skipped: results.filter((r) => r.status === "skipped").length,
        results,
      },
      meta
    );
  } catch (error) {
    return validationOrUnexpected(error, meta);
  }
}

function readMovementId(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function validationOrUnexpected(error: unknown, meta: { trace_id: string }) {
  if (error instanceof CoreError) {
    return errorJson("CORE_REJECTED", error.message, meta, 422);
  }
  if (isZodLike(error)) return validationError(error, meta);
  return unexpectedError(error, meta);
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues)
  );
}
