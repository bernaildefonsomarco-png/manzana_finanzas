import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { assertSystemActionAllowed } from "@/core/risk/system-action-gate";
import {
  markPendingDiscarded,
  PendingRepositoryError,
} from "@/data/repositories/pending.repository";
import { createServiceClient } from "@/data/supabase/server";

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
    reason: z.string().trim().min(1).max(240).default("dashboard_batch_discard"),
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
        await markPendingDiscarded(
          client,
          auth.userId,
          pendingItemId,
          body.reason,
          auth.userId,
          trace_id,
        );
        results.push({
          pending_item_id: pendingItemId,
          status: "discarded" as const,
        });
      } catch (error) {
        results.push({
          pending_item_id: pendingItemId,
          status: "failed" as const,
          code:
            error instanceof PendingRepositoryError
              ? error.code
              : "PENDING_DISCARD_FAILED",
        });
      }
    }
    const discarded = results.filter(
      (result) => result.status === "discarded",
    ).length;
    return okJson(
      {
        requested: body.pending_item_ids.length,
        discarded,
        failed: body.pending_item_ids.length - discarded,
        results,
      },
      meta,
    );
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues),
  );
}
