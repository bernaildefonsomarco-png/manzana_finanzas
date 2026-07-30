import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { getProjectionSnapshot } from "@/data/repositories/projections.repository";
import { presentProjectionBreakdown } from "../../presenter";
import { EmptyProjectionQuerySchema } from "../../schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    EmptyProjectionQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries())
    );
    const snapshot = await getProjectionSnapshot(auth.client, auth.userId);
    return okJson(
      {
        breakdown: presentProjectionBreakdown(
          snapshot.breakdown,
          snapshot.projection,
          snapshot.has_pen_accounts
        ),
      },
      meta
    );
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "issues" in error);
}
