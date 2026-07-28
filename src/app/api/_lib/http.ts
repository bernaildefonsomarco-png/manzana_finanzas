import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { CoreError } from "@/core/finance/errors";
import type { PageMeta } from "./pagination";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "NOT_CONFIGURED"
  | "CONFLICT"
  | "CORE_REJECTED"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "INTERNAL_ERROR";

export type ApiMeta = {
  trace_id: string;
  // Solo en listados (`14` §3, `AC-API-01`).
  page?: PageMeta;
  // Solo en la respuesta a una escritura repetida con la misma
  // `Idempotency-Key` (`14` §7, `AC-API-05`).
  idempotent_replay?: boolean;
};

export function getTraceId(request: Request): string {
  const incoming = request.headers.get("x-trace-id");
  if (incoming && isUuid(incoming)) return incoming;
  return randomUUID();
}

export function okJson<T>(
  data: T,
  meta: ApiMeta,
  init: ResponseInit = {}
) {
  return NextResponse.json(
    {
      ok: true,
      data,
      meta,
    },
    init
  );
}

export function errorJson(
  code: ApiErrorCode,
  message: string,
  meta: ApiMeta,
  status = 400,
  details: Record<string, unknown> = {}
) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        details,
      },
      meta,
    },
    { status }
  );
}

export function validationError(
  error: unknown,
  meta: ApiMeta,
  message = "Campos invalidos o incompletos."
) {
  if (error instanceof ZodError) {
    return errorJson("VALIDATION_ERROR", message, meta, 400, {
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  return errorJson("VALIDATION_ERROR", message, meta, 400);
}

export function coreError(error: CoreError, meta: ApiMeta) {
  const notFoundCodes = new Set([
    "MOVEMENT_NOT_FOUND",
    "DEBT_NOT_FOUND",
    "DEBT_PAYMENT_ACCOUNT_NOT_FOUND",
    "DEBT_INSTALLMENT_NOT_FOUND",
  ]);
  const conflictCodes = new Set([
    "MOVEMENT_ALREADY_INACTIVE",
    "MOVEMENT_NOT_DELETED",
    "MOVEMENT_REVERSED_NOT_RESTORABLE",
    "DEBT_NOT_ACTIVE",
    "DEBT_PAYMENT_IDEMPOTENCY_CONFLICT",
  ]);
  const status = notFoundCodes.has(error.code)
    ? 404
    : conflictCodes.has(error.code)
      ? 409
      : 422;

  const code: ApiErrorCode = notFoundCodes.has(error.code)
    ? "NOT_FOUND"
    : conflictCodes.has(error.code)
      ? "CONFLICT"
      : "CORE_REJECTED";

  return errorJson(code, error.message, meta, status, error.details);
}

export function unexpectedError(error: unknown, meta: ApiMeta) {
  const message =
    process.env.APP_ENV === "local" && error instanceof Error
      ? error.message
      : "Ocurrio un error inesperado.";

  return errorJson("INTERNAL_ERROR", message, meta, 500);
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
