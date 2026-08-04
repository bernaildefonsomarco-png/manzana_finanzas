// `43` §4.3 — auditoría de cuenta. Un evento es "esto fui yo", no memoria:
// no alimenta ninguna respuesta del motor (`43` §15).

import { createHash } from "node:crypto";
import type { Database } from "@/data/supabase/types";

export type AccountEventKind = Database["public"]["Enums"]["account_event_kind"];

type InsertClient = {
  from(table: "account_events"): {
    insert(row: {
      user_id: string;
      kind: AccountEventKind;
      ip_hash: string | null;
      user_agent_hash: string | null;
    }): PromiseLike<{ error: { message: string } | null }>;
  };
};

/** `AC-AUTH-19`: nunca se guarda la IP en claro, solo su hash. */
export function hashForAudit(value: string | null | undefined): string | null {
  if (!value) return null;
  return createHash("sha256").update(value).digest("hex");
}

export async function recordAccountEvent(
  client: InsertClient,
  input: {
    userId: string;
    kind: AccountEventKind;
    ip: string | null;
    userAgent: string | null;
  }
): Promise<void> {
  const { error } = await client.from("account_events").insert({
    user_id: input.userId,
    kind: input.kind,
    ip_hash: hashForAudit(input.ip),
    user_agent_hash: hashForAudit(input.userAgent),
  });
  // Un fallo al auditar no debe tumbar la acción real que ya ocurrió
  // (cambiar la clave, cerrar sesión, etc.): se relega a un warning.
  if (error) {
    const { logger } = await import("@/shared/telemetry/logger");
    logger.warn("cuenta.evento_no_registrado", {
      operation: "account_events.insert",
      kind: input.kind,
      error: error.message,
    });
  }
}

export function requestMeta(request: Request): { ip: string | null; userAgent: string | null } {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0]?.trim() || null : request.headers.get("x-real-ip");
  return { ip, userAgent: request.headers.get("user-agent") };
}
