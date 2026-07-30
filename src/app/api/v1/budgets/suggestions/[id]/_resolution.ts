import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
} from "@/app/api/_lib/http";
import { readIdempotencyKey } from "@/app/api/_lib/idempotency";
import { resolveBudgetSuggestion } from "@/data/repositories/budgets.repository";
import { budgetRouteError } from "../../operation-http";
import {
  AcceptBudgetSuggestionRequestSchema,
  EmptyObjectSchema,
} from "../../schemas";

type Context = { params: Promise<{ id: string }> };

export function createSuggestionResolutionHandler(
  resolution: "accepted" | "dismissed"
) {
  return async function POST(request: Request, context: Context) {
    const meta = { trace_id: getTraceId(request) };
    try {
      const auth = await getApiAuth(request);
      if (!auth) {
        return errorJson(
          "AUTH_REQUIRED",
          "Necesitas iniciar sesion.",
          meta,
          401
        );
      }
      const idempotencyKey = readIdempotencyKey(request);
      if (!idempotencyKey) {
        return errorJson(
          "VALIDATION_ERROR",
          "Falta Idempotency-Key para resolver la sugerencia.",
          meta,
          400
        );
      }
      const { id } = await context.params;
      if (!id || id.length > 240) {
        return errorJson(
          "VALIDATION_ERROR",
          "La sugerencia no es valida.",
          meta,
          400
        );
      }
      const payload =
        resolution === "accepted"
          ? AcceptBudgetSuggestionRequestSchema.parse(
              await readJsonBody(request)
            )
          : EmptyObjectSchema.parse(await readJsonBody(request));
      const result = await resolveBudgetSuggestion(auth.client, auth.userId, {
        suggestionKey: decodeURIComponent(id),
        resolution,
        payload,
        idempotencyKey,
        traceId: meta.trace_id,
      });
      return okJson(
        {
          decision: result.decision,
          budget: result.budget ?? null,
        },
        { ...meta, idempotent_replay: result.idempotent || undefined },
        {
          status:
            resolution === "accepted" && !result.idempotent ? 201 : 200,
        }
      );
    } catch (error) {
      return budgetRouteError(error, meta);
    }
  };
}
