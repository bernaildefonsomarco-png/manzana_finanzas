import { randomUUID } from "node:crypto";
import { z } from "zod";
import { CoreError } from "@/core/finance/errors";
import {
  confirmPendingItemWithCore,
  PendingConfirmationValidationError,
  PendingDuplicateConfirmationRequiredError,
} from "@/core/pending/confirm-pending";
import { assertSystemActionAllowed } from "@/core/risk/system-action-gate";
import {
  getPendingItemById,
  isTerminalPendingStatus,
  markPendingBatchConfirmId,
  PendingRepositoryError,
} from "@/data/repositories/pending.repository";
import { createServiceClient } from "@/data/supabase/server";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { readIdempotencyKey } from "@/app/api/_lib/idempotency";

export const dynamic = "force-dynamic";

// ERR-PEND-08: "puedo confirmar hasta 50 a la vez" (27 S7).
const BodySchema = z
  .object({
    pending_item_ids: z
      .array(z.string().uuid())
      .min(1)
      .max(50)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "No repitas pendientes en el lote",
      ),
    // RUL-PEND-07: preview:true solo cuenta y excluye, no ejecuta nada.
    preview: z.boolean().optional(),
  })
  .strict();

export async function POST(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const body = BodySchema.parse(await readJsonBody(request));
    const preview = body.preview === true;
    const idempotencyKey = readIdempotencyKey(request);
    if (!preview && !idempotencyKey) {
      return errorJson(
        "VALIDATION_ERROR",
        "Falta Idempotency-Key para confirmar el lote de pendientes.",
        meta,
        400
      );
    }

    const client = createServiceClient();

    // RUL-PEND-11: riesgo alto nunca entra en un lote — se excluye antes
    // de intentar nada, con la razon visible.
    const eligible: string[] = [];
    const excluded: Array<{ pending_item_id: string; reason: string }> = [];
    for (const pendingItemId of body.pending_item_ids) {
      const item = await getPendingItemById(client, auth.userId, pendingItemId);
      if (!item) {
        excluded.push({ pending_item_id: pendingItemId, reason: "not_found" });
      } else if (item.risk_level === "high" || item.risk_level === "sensitive") {
        excluded.push({ pending_item_id: pendingItemId, reason: "high_risk" });
      } else if (isTerminalPendingStatus(item.status)) {
        excluded.push({ pending_item_id: pendingItemId, reason: "already_resolved" });
      } else if (!item.confirmable) {
        excluded.push({ pending_item_id: pendingItemId, reason: "not_confirmable" });
      } else {
        eligible.push(pendingItemId);
      }
    }

    if (preview) {
      return okJson(
        {
          requested: body.pending_item_ids.length,
          would_confirm: eligible.length,
          excluded,
        },
        meta,
      );
    }

    assertSystemActionAllowed({
      actionKind: "pending_resolution",
      authenticatedSession: true,
      explicitUserConfirmation: true,
      reversible: true,
    });

    // RUL-PEND-07/ACT-PEND-07: agrupador para poder deshacer el lote
    // completo (POST /pending/batch/[batch_id]/undo, 24h).
    const batchId = randomUUID();
    const results: Array<Record<string, unknown>> = excluded.map((item) => ({
      ...item,
      status: "excluded" as const,
    }));
    for (const pendingItemId of eligible) {
      try {
        const result = await confirmPendingItemWithCore({
          client,
          userId: auth.userId,
          pendingItemId,
          actor: { type: "user", id: auth.userId },
          source: "api.v1.pending.batch-confirm",
          traceId: trace_id,
          channel: "dashboard",
        });
        await markPendingBatchConfirmId(client, auth.userId, pendingItemId, batchId);
        results.push({
          pending_item_id: pendingItemId,
          status: "confirmed" as const,
          movement_id: result.movement.id,
          idempotent: result.idempotent,
          auto_resolved_duplicate: result.autoResolvedDuplicate,
        });
      } catch (error) {
        results.push({
          pending_item_id: pendingItemId,
          status: "failed" as const,
          code: batchErrorCode(error),
          requires_duplicate_confirmation:
            error instanceof PendingDuplicateConfirmationRequiredError,
        });
      }
    }
    const confirmed = results.filter(
      (result) => result.status === "confirmed",
    ).length;
    return okJson(
      {
        batch_id: batchId,
        requested: body.pending_item_ids.length,
        confirmed,
        failed: results.filter((r) => r.status === "failed").length,
        excluded: excluded.length,
        results,
      },
      meta,
    );
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function batchErrorCode(error: unknown): string {
  if (error instanceof PendingDuplicateConfirmationRequiredError) {
    return "DUPLICATE_CONFIRMATION_REQUIRED";
  }
  if (error instanceof PendingConfirmationValidationError) {
    return "PENDING_INCOMPLETE";
  }
  if (error instanceof PendingRepositoryError) return error.code;
  if (error instanceof CoreError) return error.code;
  return "PENDING_CONFIRM_FAILED";
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues),
  );
}
