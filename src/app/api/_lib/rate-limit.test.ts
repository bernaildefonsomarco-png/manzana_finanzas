import { describe, expect, it, vi } from "vitest";
import {
  RATE_LIMIT_RULES,
  checkRateLimit,
  classifyRateLimitFamily,
  type RateLimitClient,
} from "./rate-limit";

describe("classifyRateLimitFamily (AC-API-06)", () => {
  it("clasifica un GET generico como lecturas", () => {
    expect(classifyRateLimitFamily("/api/v1/movements", "GET")).toBe("reads");
    expect(classifyRateLimitFamily("/api/v1/debts", "GET")).toBe("reads");
  });

  it("clasifica escrituras genericas como escrituras financieras", () => {
    expect(classifyRateLimitFamily("/api/v1/movements", "POST")).toBe(
      "financial_writes"
    );
    expect(classifyRateLimitFamily("/api/v1/pending/abc/confirm", "POST")).toBe(
      "financial_writes"
    );
    expect(classifyRateLimitFamily("/api/v1/accounts/abc", "DELETE")).toBe(
      "financial_writes"
    );
  });

  it("familias dedicadas mandan sin importar el metodo", () => {
    expect(classifyRateLimitFamily("/api/v1/assistant/turns", "POST")).toBe(
      "assistant"
    );
    expect(classifyRateLimitFamily("/api/v1/assistant/turns", "GET")).toBe(
      "assistant"
    );
    expect(classifyRateLimitFamily("/api/v1/imports/preview", "GET")).toBe(
      "imports"
    );
    expect(classifyRateLimitFamily("/api/v1/exports/full", "GET")).toBe(
      "exports"
    );
  });

  it("los limites por familia coinciden con 14 S8", () => {
    expect(RATE_LIMIT_RULES.reads).toEqual({ windowSeconds: 60, maxCount: 300 });
    expect(RATE_LIMIT_RULES.financial_writes).toEqual({
      windowSeconds: 60,
      maxCount: 60,
    });
    expect(RATE_LIMIT_RULES.assistant).toEqual({ windowSeconds: 60, maxCount: 20 });
    expect(RATE_LIMIT_RULES.imports).toEqual({ windowSeconds: 3600, maxCount: 5 });
    expect(RATE_LIMIT_RULES.exports).toEqual({ windowSeconds: 3600, maxCount: 3 });
  });
});

function fakeClient(
  response: { allowed: boolean; retry_after_seconds: number } | null,
  error: { message: string } | null = null
): RateLimitClient {
  return { rpc: vi.fn().mockResolvedValue({ data: response, error }) };
}

describe("checkRateLimit", () => {
  it("permite cuando el RPC dice allowed:true", async () => {
    const client = fakeClient({ allowed: true, retry_after_seconds: 0 });
    const result = await checkRateLimit(client, { key: "user:1", family: "reads" });
    expect(result).toEqual({ allowed: true });
  });

  it("bloquea y propaga retry_after_seconds cuando el RPC dice allowed:false", async () => {
    const client = fakeClient({ allowed: false, retry_after_seconds: 42 });
    const result = await checkRateLimit(client, { key: "user:1", family: "reads" });
    expect(result).toEqual({ allowed: false, retryAfterSeconds: 42 });
  });

  it("compone la clave con el prefijo de familia", async () => {
    const client = fakeClient({ allowed: true, retry_after_seconds: 0 });
    await checkRateLimit(client, { key: "user:abc", family: "financial_writes" });
    expect(client.rpc).toHaveBeenCalledWith(
      "check_and_increment_rate_limit",
      expect.objectContaining({ p_key: "financial_writes:user:abc" })
    );
  });

  it("deja pasar (fail-open) si el RPC devuelve error", async () => {
    const client = fakeClient(null, { message: "conexion caida" });
    const result = await checkRateLimit(client, { key: "user:1", family: "reads" });
    expect(result).toEqual({ allowed: true });
  });
});
