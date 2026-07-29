import { z } from "zod";
import {
  archiveBoxesForAccount,
  getAccountById,
  getActiveBoxes,
  getFreeBalanceForAccount,
  setDefaultAccount,
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

/** 24 §10: `GET /accounts/[id]` — detalle con libre calculado y sus cajas. */
export async function GET(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const params = ParamsSchema.parse(await context.params);
    const account = await getAccountById(auth.client, auth.userId, params.id);

    if (!account) {
      return errorJson("NOT_FOUND", "Cuenta no encontrada.", meta, 404);
    }

    const [boxes, freeBalance] = await Promise.all([
      getActiveBoxes(auth.client, auth.userId, account.id),
      getFreeBalanceForAccount(auth.client, auth.userId, account.id),
    ]);

    return okJson({ account, free_balance: freeBalance, boxes }, meta);
  } catch (error) {
    if (isZodLike(error)) {
      return errorJson("VALIDATION_ERROR", "Id de cuenta invalido.", meta, 400);
    }
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
    const body = await readJsonBody(request);
    const parsed = UpdateAccountRequestSchema.parse(body);
    const current = await getAccountById(auth.client, auth.userId, params.id);

    if (!current) {
      return errorJson("NOT_FOUND", "Cuenta no encontrada.", meta, 404);
    }

    const metaFields = {
      ...(parsed.name !== undefined ? { name: parsed.name } : {}),
      ...(parsed.type !== undefined ? { type: parsed.type } : {}),
      ...(parsed.institution !== undefined
        ? { institution: parsed.institution }
        : {}),
      ...(parsed.color !== undefined ? { color: parsed.color } : {}),
      ...(parsed.icon !== undefined ? { icon: parsed.icon } : {}),
    };

    const account =
      Object.keys(metaFields).length > 0
        ? await updateAccountMeta(auth.client, auth.userId, params.id, metaFields)
        : current;

    const finalAccount = parsed.is_default
      ? await setDefaultAccount(auth.client, auth.userId, params.id)
      : account;

    return okJson({ account: finalAccount }, meta);
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

    // 24 S5.1: archivar no es borrar. Las cajas se archivan en cascada, los
    // movimientos se conservan, y el saldo permanece contabilizado en la
    // cuenta archivada — que deja de sumar al total (S19 caso borde 6).
    const archivedBoxes = await archiveBoxesForAccount(
      serviceClient,
      auth.userId,
      account.id
    );
    await softDeleteAccount(serviceClient, auth.userId, account.id);

    return okJson(
      {
        account_id: account.id,
        archived_box_count: archivedBoxes.length,
        released_balance: account.current_balance,
      },
      meta
    );
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
