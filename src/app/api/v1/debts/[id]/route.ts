import { z } from "zod";
import {
  DebtOperationError,
  getDebtById,
  getDebtDetailById,
  updateDebtBasics,
} from "@/data/repositories/debts.repository";
import { createServiceClient } from "@/data/supabase/server";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  unexpectedError,
  validationError,
  readJsonBody,
} from "@/app/api/_lib/http";
import { debtOperationErrorJson } from "../operation-http";
import { UpdateDebtRequestSchema } from "./schemas";

export const dynamic = "force-dynamic";

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const params = ParamsSchema.parse(await context.params);
    const debt = await getDebtDetailById(auth.client, auth.userId, params.id);

    if (!debt) {
      return errorJson("NOT_FOUND", "No encontre esa deuda.", meta, 404);
    }

    return okJson({ debt }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const params = ParamsSchema.parse(await context.params);
    const parsed = UpdateDebtRequestSchema.parse(await readJsonBody(request));
    const current = await getDebtById(auth.client, auth.userId, params.id);
    if (!current) {
      return errorJson("NOT_FOUND", "No encontre esa deuda.", meta, 404);
    }

    const debt = await updateDebtBasics(
      createServiceClient(),
      auth.userId,
      current.id,
      parsed
    );
    return okJson({ debt }, meta);
  } catch (error) {
    if (error instanceof DebtOperationError) {
      return debtOperationErrorJson(error, meta);
    }
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues)
  );
}
