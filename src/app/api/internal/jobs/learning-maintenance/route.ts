import { z } from "zod";
import {
  errorJson,
  getTraceId,
  okJson,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import {
  expireFinancialLearning,
  getLearningGovernanceMetrics,
} from "@/data/repositories/financial-memory.repository";
import { createServiceClient } from "@/data/supabase/server";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  now: z.string().datetime({ offset: true }).optional(),
});

export async function GET(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const authError = authorize(request, meta);
    if (authError) return authError;
    const query = QuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    const client = createServiceClient();
    const expiration = await expireFinancialLearning(client, query.now);
    const metrics = await getLearningGovernanceMetrics(client, query.days);
    return okJson(
      {
        worker: "learning_maintenance",
        expiration,
        metrics,
      },
      meta,
    );
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function authorize(request: Request, meta: { trace_id: string }) {
  const authorization = request.headers.get("authorization");
  const allowedSecrets = [
    process.env.CRON_SECRET,
    process.env.WORKER_SECRET,
  ].filter((secret): secret is string => Boolean(secret));
  if (allowedSecrets.length > 0) {
    return allowedSecrets.some(
      (secret) => authorization === `Bearer ${secret}`,
    )
      ? null
      : errorJson("FORBIDDEN", "Worker no autorizado.", meta, 403);
  }
  return process.env.APP_ENV === "local"
    ? null
    : errorJson(
        "FORBIDDEN",
        "CRON_SECRET o WORKER_SECRET no configurado para ejecutar workers.",
        meta,
        403,
      );
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues),
  );
}
