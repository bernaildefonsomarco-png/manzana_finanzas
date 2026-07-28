// `AC-API-06` (`14` §8, `WEB-D179`, `WEB-D180`). Prueba el RPC
// `check_and_increment_rate_limit` contra Postgres real (no una tabla
// simulada): la ventana deslizante, el `pg_advisory_xact_lock` y el
// `on conflict` solo se comprueban de verdad con SQL ejecutandose. Clase:
// `integracion`, mismo patron que `aislamiento.test.ts` (`51` §8).
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { admin } from "./lib/entorno";

type RateLimitResult = {
  allowed: boolean;
  retry_after_seconds: number;
  remaining: number;
};

async function checkAndIncrement(
  key: string,
  windowSeconds: number,
  maxCount: number,
  now: Date
): Promise<RateLimitResult> {
  const { data, error } = await admin.rpc("check_and_increment_rate_limit", {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_max_count: maxCount,
    p_now: now.toISOString(),
  });
  if (error) throw new Error(`RPC fallo: ${error.message}`);
  return data as RateLimitResult;
}

describe("check_and_increment_rate_limit (AC-API-06)", () => {
  it("permite peticiones mientras no se supere el limite", async () => {
    const key = `test:${randomUUID()}`;
    const now = new Date("2026-07-28T10:00:00.000Z");

    for (let i = 0; i < 5; i++) {
      const result = await checkAndIncrement(key, 60, 5, now);
      expect(result.allowed).toBe(true);
    }
  });

  it("rechaza al superar el limite dentro de la misma ventana, con retry_after > 0", async () => {
    const key = `test:${randomUUID()}`;
    const now = new Date("2026-07-28T10:00:00.000Z");

    for (let i = 0; i < 3; i++) {
      await checkAndIncrement(key, 60, 3, now);
    }

    const blocked = await checkAndIncrement(key, 60, 3, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retry_after_seconds).toBeGreaterThan(0);
    expect(blocked.remaining).toBe(0);
  });

  it("aisla contadores por clave: una clave llena no bloquea otra", async () => {
    const keyA = `test:${randomUUID()}`;
    const keyB = `test:${randomUUID()}`;
    const now = new Date("2026-07-28T10:00:00.000Z");

    for (let i = 0; i < 3; i++) {
      await checkAndIncrement(keyA, 60, 3, now);
    }
    const aBlocked = await checkAndIncrement(keyA, 60, 3, now);
    const bAllowed = await checkAndIncrement(keyB, 60, 3, now);

    expect(aBlocked.allowed).toBe(false);
    expect(bAllowed.allowed).toBe(true);
  });

  it("la ventana deslizante deja pasar peticiones tras avanzar el tiempo lo suficiente", async () => {
    const key = `test:${randomUUID()}`;
    const windowStart = new Date("2026-07-28T10:00:00.000Z");

    for (let i = 0; i < 3; i++) {
      await checkAndIncrement(key, 60, 3, windowStart);
    }
    const stillBlocked = await checkAndIncrement(key, 60, 3, windowStart);
    expect(stillBlocked.allowed).toBe(false);

    // Dos ventanas completas despues: el peso de la ventana anterior ya no
    // pesa nada sobre la estimacion.
    const muchLater = new Date(windowStart.getTime() + 130_000);
    const afterWindow = await checkAndIncrement(key, 60, 3, muchLater);
    expect(afterWindow.allowed).toBe(true);
  });

  it("no confia en el cliente para el rol: solo service_role puede ejecutar el RPC", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const { RLS_API_URL } = await import("./lib/entorno");
    const anonClient = createClient(
      RLS_API_URL,
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
    );
    const { error } = await anonClient.rpc("check_and_increment_rate_limit", {
      p_key: `test:${randomUUID()}`,
      p_window_seconds: 60,
      p_max_count: 5,
      p_now: new Date().toISOString(),
    });
    expect(error).not.toBeNull();
  });
});
