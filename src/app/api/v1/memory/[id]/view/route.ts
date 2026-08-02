import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, readJsonBody, unexpectedError, validationError } from "@/app/api/_lib/http";
import { readIdempotencyKey } from "@/app/api/_lib/idempotency";
import { commitMemoryOperation, MemoryRepositoryError } from "@/data/repositories/memory.repository";
import { isZodLike, memoryOperationError } from "../../operation-http";
import { ScopedMemorySchema } from "../../schemas";

const ParamsSchema = z.object({ id: z.string().uuid() });
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesión.", meta, 401);
    const { id } = ParamsSchema.parse(await context.params);
    const body = ScopedMemorySchema.parse(await readJsonBody(request));
    const idempotencyKey = readIdempotencyKey(request);
    if (!idempotencyKey) return errorJson("VALIDATION_ERROR", "Falta Idempotency-Key.", meta, 400);
    const result = await commitMemoryOperation(auth.client, {
      userId: auth.userId,
      memoryId: id,
      scope: body.scope,
      operation: "view",
      idempotencyKey,
    });
    return okJson(result, { ...meta, ...(result.idempotent ? { idempotent_replay: true } : {}) });
  } catch (error) {
    if (error instanceof MemoryRepositoryError) return memoryOperationError(error, meta);
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}
