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
  commitMemoryOperation,
  getMemoryDetail,
  MemoryRepositoryError,
} from "@/data/repositories/memory.repository";
import { CorrectMemorySchema, ForgetMemorySchema } from "../schemas";
import { isZodLike, memoryOperationError } from "../operation-http";

export const dynamic = "force-dynamic";
const ParamsSchema = z.object({ id: z.string().uuid() });
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesión.", meta, 401);
    const { id } = ParamsSchema.parse(await context.params);
    const detail = await getMemoryDetail(auth.client, auth.userId, id);
    if (!detail) return errorJson("NOT_FOUND", "Eso ya no está en mi memoria.", meta, 404);
    return okJson(detail, meta, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

export async function PATCH(request: Request, context: Context) {
  return mutate(request, context, "correct");
}

export async function DELETE(request: Request, context: Context) {
  return mutate(request, context, "forget");
}

async function mutate(request: Request, context: Context, operation: "correct" | "forget") {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesión.", meta, 401);
    const { id } = ParamsSchema.parse(await context.params);
    const idempotencyKey = readIdempotencyKey(request);
    if (!idempotencyKey) {
      return errorJson("VALIDATION_ERROR", "Falta Idempotency-Key para cambiar la memoria.", meta, 400);
    }
    const body = operation === "correct"
      ? CorrectMemorySchema.parse(await readJsonBody(request))
      : ForgetMemorySchema.parse(await readJsonBody(request));
    assertSystemActionAllowed({
      actionKind: "preference_change",
      authenticatedSession: true,
      explicitUserConfirmation: true,
      reversible: true,
    });
    const result = await commitMemoryOperation(auth.client, {
      userId: auth.userId,
      memoryId: id,
      scope: body.scope,
      operation,
      statement:
        "statement" in body && typeof body.statement === "string"
          ? body.statement
          : undefined,
      value: "value" in body ? (body.value as never) : undefined,
      reason: body.reason,
      idempotencyKey,
    });
    return okJson(
      result,
      { ...meta, ...(result.idempotent ? { idempotent_replay: true } : {}) },
    );
  } catch (error) {
    if (error instanceof MemoryRepositoryError) return memoryOperationError(error, meta);
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}
