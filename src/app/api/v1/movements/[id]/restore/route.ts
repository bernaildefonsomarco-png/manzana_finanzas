import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  coreError,
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { CommandDispatcher } from "@/core/finance";
import { CoreError } from "@/core/finance/errors";
import { SupabaseFinancialCoreRepository } from "@/data/repositories/movements.repository";
import { createServiceClient } from "@/data/supabase/server";

export const dynamic = "force-dynamic";

const ParamsSchema = z.object({ id: z.string().uuid() });
const BodySchema = z.object({
  reason: z.string().trim().min(1).max(240),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesión.", meta, 401);
    }
    const params = ParamsSchema.parse(await context.params);
    const body = BodySchema.parse(await readJsonBody(request));
    const dispatcher = new CommandDispatcher(
      new SupabaseFinancialCoreRepository(createServiceClient()),
    );
    const result = await dispatcher.dispatch({
      type: "RestoreMovementCommand",
      command_id: randomUUID(),
      user_id: auth.userId,
      actor: { type: "user", id: auth.userId },
      source: "api.v1.movements.restore",
      trace_id: meta.trace_id,
      payload: {
        movement_id: params.id,
        reason: body.reason,
      },
    });
    return okJson(result, meta);
  } catch (error) {
    if (error instanceof CoreError) return coreError(error, meta);
    if (
      error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues)
    ) {
      return validationError(error, meta);
    }
    return unexpectedError(error, meta);
  }
}
