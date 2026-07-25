import { z } from "zod";
import {
  getAccountById,
  getActiveBoxes,
  softDeleteAccount,
  updateAccountMeta,
} from "@/data/repositories/accounts.repository";
import { createServiceClient } from "@/data/supabase/server";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { DeleteAccountRequestSchema, UpdateAccountRequestSchema } from "../schemas";

export const dynamic = "force-dynamic";

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const params = ParamsSchema.parse(await context.params);
    const body = await readJsonBody(request);
    const parsed = UpdateAccountRequestSchema.parse(body);
    const current = await getAccountById(auth.client, auth.userId, params.id);

    if (!current) {
      return errorJson("NOT_FOUND", "Cuenta no encontrada.", meta, 404);
    }

    const account = await updateAccountMeta(auth.client, auth.userId, params.id, {
      ...(parsed.name !== undefined ? { name: parsed.name } : {}),
      ...(parsed.type !== undefined ? { type: parsed.type } : {}),
      ...(parsed.institution !== undefined
        ? { institution: parsed.institution }
        : {}),
      ...(parsed.color !== undefined ? { color: parsed.color } : {}),
      ...(parsed.icon !== undefined ? { icon: parsed.icon } : {}),
    });

    return okJson({ account }, meta);
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

export async function DELETE(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const params = ParamsSchema.parse(await context.params);
    const body = await readJsonBody(request);
    DeleteAccountRequestSchema.parse(body);

    const serviceClient = createServiceClient();
    const account = await getAccountById(serviceClient, auth.userId, params.id);

    if (!account) {
      return errorJson("NOT_FOUND", "Cuenta no encontrada.", meta, 404);
    }

    const boxes = await getActiveBoxes(serviceClient, auth.userId, account.id);
    if (boxes.length > 0) {
      return errorJson(
        "CONFLICT",
        "No puedo eliminar una cuenta con cajas activas. Vacialas o eliminalas primero.",
        meta,
        409
      );
    }

    if (Math.abs(account.current_balance) > 0.00001) {
      return errorJson(
        "CONFLICT",
        "No puedo eliminar una cuenta con saldo. Primero transfiere, ajusta o deja su saldo en cero.",
        meta,
        409
      );
    }

    await softDeleteAccount(serviceClient, auth.userId, account.id);

    return okJson({ account_id: account.id }, meta);
  } catch (error) {
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

function isConflictError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const code = (error as { code?: unknown }).code;
  return code === "23505" || code === "23P01";
}
