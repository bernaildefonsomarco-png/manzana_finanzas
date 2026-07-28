// `AC-API-06` (límite) y `AC-API-07` (CSRF), aplicados en `src/proxy.ts`
// (`WEB-D180`). Se prueba el gate real, no solo los helpers que envuelve
// (`csrf.test.ts`, `rate-limit.test.ts` ya cubren esos por separado).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: mocks.getUser },
  }),
}));

vi.mock("@/data/supabase/server", () => ({
  createServiceClient: () => ({ rpc: mocks.rpc }),
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://manzana-test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-de-prueba";
process.env.MANZANA_APP_URL = "https://manzana.app";

const { proxy } = await import("./proxy");

function apiRequest(input: {
  method?: string;
  origin?: string;
  authorization?: string;
}): NextRequest {
  const headers = new Headers();
  if (input.origin) headers.set("origin", input.origin);
  if (input.authorization) headers.set("authorization", input.authorization);
  return new NextRequest("https://manzana.app/api/v1/movements", {
    method: input.method ?? "POST",
    headers,
  });
}

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: null }, error: null });
  mocks.rpc.mockReset().mockResolvedValue({
    data: { allowed: true, retry_after_seconds: 0 },
    error: null,
  });
});

describe("proxy: CSRF (AC-API-07)", () => {
  it("rechaza una escritura por cookie desde otro origen con 403", async () => {
    const response = await proxy(apiRequest({ origin: "https://evil.com" }));
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("permite una escritura por cookie con Origin propio", async () => {
    const response = await proxy(apiRequest({ origin: "https://manzana.app" }));
    expect(response.status).not.toBe(403);
  });

  it("Authorization: Bearer nunca se bloquea por origen, aunque venga de otro sitio", async () => {
    const response = await proxy(
      apiRequest({ origin: "https://evil.com", authorization: "Bearer x" })
    );
    expect(response.status).not.toBe(403);
  });

  it("las lecturas (GET) nunca se bloquean por origen", async () => {
    const response = await proxy(
      apiRequest({ method: "GET", origin: "https://evil.com" })
    );
    expect(response.status).not.toBe(403);
  });
});

describe("proxy: limite de peticiones (AC-API-06)", () => {
  it("devuelve 429 con Retry-After y mensaje en español cuando el RPC bloquea", async () => {
    mocks.rpc.mockResolvedValue({
      data: { allowed: false, retry_after_seconds: 37 },
      error: null,
    });

    const response = await proxy(apiRequest({ origin: "https://manzana.app" }));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("37");
    const body = await response.json();
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(body.error.message).toContain("37 segundos");
  });

  it("dentro del limite, la peticion continua normalmente", async () => {
    const response = await proxy(apiRequest({ origin: "https://manzana.app" }));
    expect(response.status).not.toBe(429);
  });

  it("cabeceras de seguridad se aplican tambien a la respuesta bloqueada", async () => {
    mocks.rpc.mockResolvedValue({
      data: { allowed: false, retry_after_seconds: 10 },
      error: null,
    });
    const response = await proxy(apiRequest({ origin: "https://manzana.app" }));
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
  });
});
