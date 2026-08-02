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
import {
  MemoryRepositoryError,
  resolveProfileCandidate,
} from "@/data/repositories/memory.repository";
import { isZodLike, memoryOperationError } from "../../../operation-http";

const ParamsSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["confirm", "reject", "never-ask"]),
});
const BodySchema = z.object({ statement: z.string().trim().min(3).max(500).optional() }).strict();
type Context = { params: Promise<{ id: string; action: string }> };

export async function POST(request: Request, context: Context) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesión.", meta, 401);
    const { id, action } = ParamsSchema.parse(await context.params);
    const body = BodySchema.parse(await readJsonBody(request));
    const idempotencyKey = readIdempotencyKey(request);
    if (!idempotencyKey) return errorJson("VALIDATION_ERROR", "Falta Idempotency-Key.", meta, 400);
    const result = await resolveProfileCandidate(auth.client, {
      userId: auth.userId,
      candidateId: id,
      resolution: action === "never-ask" ? "never_ask" : action,
      statement: body.statement,
      idempotencyKey,
    });
    return okJson(result, { ...meta, ...(result.idempotent ? { idempotent_replay: true } : {}) });
  } catch (error) {
    if (error instanceof MemoryRepositoryError) return memoryOperationError(error, meta);
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}
