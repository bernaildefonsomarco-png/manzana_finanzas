import { z } from "zod";
import { CoreError } from "@/core/finance/errors";
import {
  confirmPendingItemWithCore,
  PendingConfirmationValidationError,
  PendingDuplicateConfirmationRequiredError,
} from "@/core/pending/confirm-pending";
import { assertSystemActionAllowed } from "@/core/risk/system-action-gate";
import {
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

export const dynamic = "force-dynamic";

const BodySchema = z
  .object({
    pending_item_ids: z
      .array(z.string().uuid())
      .min(1)
      .max(20)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "No repitas pendientes en el lote",
      ),
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
    assertSystemActionAllowed({
      actionKind: "pending_resolution",
      authenticatedSession: true,
      explicitUserConfirmation: true,
      reversible: true,
    });
    const client = createServiceClient();
    const results = [];
    for (const pendingItemId of body.pending_item_ids) {
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
        requested: body.pending_item_ids.length,
        confirmed,
        failed: body.pending_item_ids.length - confirmed,
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
