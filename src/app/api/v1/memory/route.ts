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
import { readIdempotencyKey } from "@/app/api/_lib/idempotency";
import { assertSystemActionAllowed } from "@/core/risk/system-action-gate";
import {
  forgetAllMemory,
  listMemory,
  MemoryRepositoryError,
} from "@/data/repositories/memory.repository";

export const dynamic = "force-dynamic";

const QuerySchema = z
  .object({
    scope: z.enum(["classification", "profile", "preference"]).optional(),
    include_inactive: z.enum(["true", "false"]).default("false"),
  })
  .strict();
const ForgetAllSchema = z.object({ confirmation: z.literal("OLVIDAR") }).strict();

export async function GET(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesión.", meta, 401);
    const query = QuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    const memory = await listMemory(auth.client, {
      userId: auth.userId,
      scope: query.scope,
      includeInactive: query.include_inactive === "true",
    });
    return okJson(memory, meta, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

export async function DELETE(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesión.", meta, 401);
    const idempotencyKey = readIdempotencyKey(request);
    if (!idempotencyKey) {
      return errorJson("VALIDATION_ERROR", "Falta Idempotency-Key para olvidar la memoria.", meta, 400);
    }
    const body = ForgetAllSchema.parse(await readJsonBody(request));
    assertSystemActionAllowed({
      actionKind: "preference_change",
      authenticatedSession: true,
      explicitUserConfirmation: true,
      reversible: false,
    });
    const result = await forgetAllMemory(auth.client, {
      userId: auth.userId,
      confirmation: body.confirmation,
      idempotencyKey,
    });
    return okJson(
      result,
      { ...meta, ...(result.idempotent ? { idempotent_replay: true } : {}) },
    );
  } catch (error) {
    if (error instanceof MemoryRepositoryError) return memoryError(error, meta);
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function memoryError(error: MemoryRepositoryError, meta: { trace_id: string }) {
  if (error.code === "NOT_FOUND") return errorJson("NOT_FOUND", error.message, meta, 404);
  if (error.code === "CONFLICT") return errorJson("CONFLICT", error.message, meta, 409);
  return errorJson("CORE_REJECTED", error.message, meta, 422);
}

function isZodLike(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "issues" in error);
}
