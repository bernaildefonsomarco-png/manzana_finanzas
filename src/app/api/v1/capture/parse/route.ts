import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, readJsonBody, unexpectedError, validationError } from "@/app/api/_lib/http";
import { parseQuickAddLine } from "@/core/capture/quick-add-parser";
import { getActiveAccounts } from "@/data/repositories/accounts.repository";
import { todayInLima, toIsoDate } from "@/shared/dates/lima";

export const dynamic = "force-dynamic";

// 29 S7: 1-140 caracteres; vacia no hace nada.
const ParseRequestSchema = z
  .object({
    line: z.string().trim().min(1).max(140),
  })
  .strict();

/**
 * 29 S10: interpreta una linea de registro rapido. No escribe nada — ni
 * siquiera requiere idempotencia por eso mismo (29 S11). Sin excepciones
 * de service-role (AC-CAP-15): el cliente autenticado solo lee sus cuentas.
 */
export async function POST(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const parsed = ParseRequestSchema.parse(await readJsonBody(request));
    const accounts = await getActiveAccounts(auth.client, auth.userId);
    const today = todayInLima();

    const result = parseQuickAddLine(parsed.line, {
      knownAccounts: accounts.map((account) => ({ id: account.id, name: account.name })),
      todayIso: toIsoDate(today.year, today.month, today.day),
    });

    return okJson(result, meta);
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
