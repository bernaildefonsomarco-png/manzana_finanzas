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
  listLearningCandidates,
  promoteLearningCandidate,
  updateLearningCandidateDecision,
} from "@/data/repositories/learning-candidates.repository";
import {
  getLearningPreferences,
  listFinancialMemory,
  manageFinancialMemory,
  setLearningPreferences,
} from "@/data/repositories/financial-memory.repository";
import { createServiceClient } from "@/data/supabase/server";
import { readIdempotencyKey } from "@/app/api/_lib/idempotency";
import { ManageLearningSchema, LearningPreferencesSchema } from "./schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const [memories, candidates, preferences] = await Promise.all([
      listFinancialMemory(auth.client, {
        userId: auth.userId,
        limit: 200,
      }),
      listLearningCandidates(auth.client, {
        userId: auth.userId,
        statuses: [
          "observed",
          "pending_confirmation",
          "accepted",
          "suspended",
        ],
        limit: 200,
      }),
      getLearningPreferences(auth.client, auth.userId),
    ]);

    return okJson({ memories, candidates, preferences }, meta, {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    return unexpectedError(error, meta);
  }
}

export async function PATCH(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const idempotencyKey = readIdempotencyKey(request);
    if (!idempotencyKey) {
      return errorJson(
        "VALIDATION_ERROR",
        "Falta Idempotency-Key para actualizar la memoria.",
        meta,
        400,
      );
    }

    const parsed = ManageLearningSchema.parse(await readJsonBody(request));
    assertSystemActionAllowed({
      actionKind: "preference_change",
      authenticatedSession: true,
      explicitUserConfirmation: true,
      reversible: parsed.action !== "forget",
    });
    const client = createServiceClient();

    if (parsed.target === "memory") {
      const result = await manageFinancialMemory(client, {
        userId: auth.userId,
        memoryId: parsed.target_id,
        action: parsed.action,
        summary: parsed.summary,
        reason: parsed.reason ?? `dashboard_${parsed.action}`,
        idempotencyKey: `${idempotencyKey}:memory:${parsed.target_id}:${parsed.action}`,
      });
      return okJson({ result }, meta);
    }

    const status = parsed.action === "confirm" ? "accepted" : "rejected";
    const candidate = await updateLearningCandidateDecision(client, {
      userId: auth.userId,
      candidateId: parsed.target_id,
      status,
      reason: parsed.reason ?? `dashboard_${parsed.action}`,
      actorType: "user",
      idempotencyKey: `${idempotencyKey}:candidate:${parsed.target_id}:${status}`,
    });
    if (!candidate) {
      return errorJson(
        "NOT_FOUND",
        "No encontre ese aprendizaje.",
        meta,
        404,
      );
    }
    const memory =
      parsed.action === "confirm"
        ? await promoteLearningCandidate(client, {
            userId: auth.userId,
            candidateId: parsed.target_id,
            actorType: "user",
            idempotencyKey: `${idempotencyKey}:promote:${parsed.target_id}`,
          })
        : null;
    if (parsed.action === "confirm" && !memory) {
      throw new Error("LEARNING_CANDIDATE_PROMOTION_FAILED");
    }
    return okJson({ candidate, memory }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

export async function PUT(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const idempotencyKey = readIdempotencyKey(request);
    if (!idempotencyKey) {
      return errorJson(
        "VALIDATION_ERROR",
        "Falta Idempotency-Key para guardar las preferencias.",
        meta,
        400,
      );
    }

    const parsed = LearningPreferencesSchema.parse(await readJsonBody(request));
    assertSystemActionAllowed({
      actionKind: "preference_change",
      authenticatedSession: true,
      explicitUserConfirmation: true,
      reversible: true,
    });
    const preferences = await setLearningPreferences(createServiceClient(), {
      userId: auth.userId,
      enabled: parsed.enabled,
      allowNarrativeMemory: parsed.allow_narrative_memory,
      allowSensitiveMemory: parsed.allow_sensitive_memory,
      idempotencyKey: `${idempotencyKey}:learning-preferences`,
    });
    return okJson({ preferences }, meta);
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
