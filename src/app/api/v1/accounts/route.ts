import { createServiceClient } from "@/data/supabase/server";
import {
  createAccount,
  getActiveAccounts,
} from "@/data/repositories/accounts.repository";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { CreateAccountRequestSchema } from "./schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const accounts = await getActiveAccounts(auth.client, auth.userId);
    return okJson({ accounts }, meta);
  } catch (error) {
    return unexpectedError(error, meta);
  }
}

export async function POST(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const body = await readJsonBody(request);
    const parsed = CreateAccountRequestSchema.parse(body);
    const existingAccounts = await getActiveAccounts(auth.client, auth.userId);
    const isFirstAccount = existingAccounts.length === 0;

    if (parsed.is_default && !isFirstAccount) {
      return errorJson(
        "CONFLICT",
        "Cambiar la cuenta por defecto vendra en un corte dedicado.",
        meta,
        409
      );
    }

    const serviceClient = createServiceClient();
    const account = await createAccount(serviceClient, {
      userId: auth.userId,
      name: parsed.name,
      type: parsed.type,
      institution: parsed.institution ?? undefined,
      currency: parsed.currency,
      initialBalance: parsed.initial_balance,
      isDefault: isFirstAccount || parsed.is_default === true,
      color: parsed.color ?? undefined,
      icon: parsed.icon ?? undefined,
      metadata: {
        created_from: "dashboard_money",
        trace_id,
        initial_balance_source: "user_declared",
      },
    });

    return okJson({ account }, meta, { status: 201 });
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);

    if (isConflictError(error)) {
      return errorJson(
        "CONFLICT",
        "Ya existe una cuenta activa con ese nombre.",
        meta,
        409
      );
    }

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

function isConflictError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const code = (error as { code?: unknown }).code;
  return code === "23505" || code === "23P01";
}
