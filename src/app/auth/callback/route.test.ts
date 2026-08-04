import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("@/data/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import { GET } from "./route";

beforeEach(() => {
  mocks.exchangeCodeForSession.mockReset();
  mocks.createClient.mockReset().mockResolvedValue({
    auth: { exchangeCodeForSession: mocks.exchangeCodeForSession },
  });
});

function callbackRequest(query: string) {
  return new Request(`http://localhost/auth/callback${query}`);
}

describe("GET /auth/callback — SCR-AUTH-06: intercambio en servidor, next validado", () => {
  it("AC-AUTH-05: éxito con next interno válido redirige ahí", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: { session: { access_token: "t" } },
      error: null,
    });

    const response = await GET(callbackRequest("?code=abc123&next=%2Fmovimientos"));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/movimientos");
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("abc123");
  });

  it("éxito sin next va a /inicio", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: { session: { access_token: "t" } },
      error: null,
    });

    const response = await GET(callbackRequest("?code=abc123"));

    expect(new URL(response.headers.get("location")!).pathname).toBe("/inicio");
  });

  it("caso borde 12 de 43 §19: next apuntando fuera del dominio se ignora y va a /inicio", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: { session: { access_token: "t" } },
      error: null,
    });

    const response = await GET(
      callbackRequest("?code=abc123&next=" + encodeURIComponent("https://evil.example.com")),
    );

    expect(new URL(response.headers.get("location")!).pathname).toBe("/inicio");
  });

  it("next con esquema javascript: se ignora (redirección abierta)", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: { session: { access_token: "t" } },
      error: null,
    });

    const response = await GET(
      callbackRequest("?code=abc123&next=" + encodeURIComponent("javascript:alert(1)")),
    );

    expect(new URL(response.headers.get("location")!).pathname).toBe("/inicio");
  });

  it("error del proveedor redirige a /entrar con el ERR-AUTH mapeado, nunca ejecuta el intercambio dos veces", async () => {
    const response = await GET(callbackRequest("?error=access_denied"));

    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/entrar");
    expect(location.searchParams.get("error")).toMatch(/^ERR-AUTH-/);
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("sin code y sin error también redirige a /entrar con error", async () => {
    const response = await GET(callbackRequest(""));

    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/entrar");
    expect(location.searchParams.has("error")).toBe(true);
  });

  it("AC-AUTH-05: un code inválido (flow_state_not_found) redirige a /entrar sin sesión", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: { code: "flow_state_not_found", message: "flow state not found" },
    });

    const response = await GET(callbackRequest("?code=usado-ya"));

    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/entrar");
    expect(location.searchParams.get("error")).toBe("ERR-AUTH-07");
  });

  it("RUL-HECHO-02: si el intercambio no se llamara nunca, el aserto del código pasado fallaría", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: { session: { access_token: "t" } },
      error: null,
    });
    await GET(callbackRequest("?code=xyz"));
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("xyz");
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalledWith("otro");
  });
});
