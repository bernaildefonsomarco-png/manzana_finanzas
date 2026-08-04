import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/data/supabase/client", () => ({
  createClient: () => ({ auth: { signOut: mocks.signOut } }),
}));

import { signOutAllDevices } from "./sign-out";

beforeEach(() => {
  mocks.signOut.mockReset().mockResolvedValue({ error: null });
  mocks.fetch.mockReset().mockResolvedValue({ json: async () => ({ ok: true, data: {} }) });
  vi.stubGlobal("fetch", mocks.fetch);
});

describe("signOutAllDevices — ACT-AUTH-10", () => {
  it("registra sesiones_cerradas ANTES de cerrar sesión (RUL-HECHO-02: si el orden se invirtiera, el evento no tendría sesión con qué autenticarse)", async () => {
    const calls: string[] = [];
    mocks.fetch.mockImplementation(() => {
      calls.push("fetch");
      return Promise.resolve({ json: async () => ({ ok: true, data: {} }) });
    });
    mocks.signOut.mockImplementation(() => {
      calls.push("signOut");
      return Promise.resolve({ error: null });
    });

    await signOutAllDevices();

    expect(calls).toEqual(["fetch", "signOut"]);
    expect(mocks.fetch).toHaveBeenCalledWith(
      "/api/v1/auth/events",
      expect.objectContaining({ body: JSON.stringify({ kind: "sesiones_cerradas" }) }),
    );
  });

  it("camino feliz: ok:true, sin scope explícito (global por defecto — incluye la sesión actual)", async () => {
    const result = await signOutAllDevices();
    expect(result).toEqual({ ok: true });
    expect(mocks.signOut).toHaveBeenCalledWith();
  });

  it("un fallo al cerrar sesión se dice en español", async () => {
    mocks.signOut.mockResolvedValue({ error: { message: "network error" } });
    const result = await signOutAllDevices();
    expect(result).toEqual({
      ok: false,
      message: "No pude cerrar las demás sesiones. Inténtalo de nuevo.",
    });
  });

  it("un fallo al registrar el evento no impide cerrar sesión", async () => {
    mocks.fetch.mockRejectedValue(new Error("network down"));
    const result = await signOutAllDevices();
    expect(result).toEqual({ ok: true });
    expect(mocks.signOut).toHaveBeenCalled();
  });
});
