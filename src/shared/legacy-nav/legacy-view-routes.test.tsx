import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }) }));
vi.mock("@/data/supabase/client", () => ({ createClient: () => ({ auth: { signOut: mocks.signOut } }) }));

import { useLegacySignOut } from "./legacy-view-routes";

beforeEach(() => {
  mocks.refresh.mockReset();
  mocks.signOut.mockReset().mockResolvedValue({ error: null });
});

describe("useLegacySignOut — ACT-AUTH-09: cierra sesión solo en este dispositivo", () => {
  it("llama a signOut con scope 'local', nunca el global por defecto", async () => {
    const { result } = renderHook(() => useLegacySignOut());
    await result.current();

    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("RUL-HECHO-02: sin la corrección, signOut() se llamaría sin argumentos (scope 'global' por defecto de @supabase/auth-js) — este aserto lo distingue", async () => {
    const { result } = renderHook(() => useLegacySignOut());
    await result.current();

    expect(mocks.signOut).not.toHaveBeenCalledWith();
    expect(mocks.signOut).not.toHaveBeenCalledWith({});
  });
});
