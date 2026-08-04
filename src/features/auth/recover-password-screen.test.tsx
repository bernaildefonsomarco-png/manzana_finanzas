import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/data/supabase/client", () => ({
  createClient: () => ({ auth: { resetPasswordForEmail: mocks.resetPasswordForEmail } }),
}));

import { RecoverPasswordScreen } from "./recover-password-screen";

beforeEach(() => {
  mocks.resetPasswordForEmail.mockReset();
  mocks.fetch.mockReset().mockResolvedValue({
    json: async () => ({ ok: true, data: { allowed: true, retry_after_seconds: 0 } }),
  });
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubGlobal("navigator", { onLine: true });
});

describe("RecoverPasswordScreen — AC-AUTH-04/RUL-AUTH-01: nunca revela si el correo tiene cuenta", () => {
  it("correo con cuenta: mensaje genérico de 'enviado'", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    render(<RecoverPasswordScreen />);

    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "tiene@cuenta.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Mandar enlace" }));

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Si ese correo tiene una cuenta, te mandé el enlace",
      ),
    );
  });

  it("Supabase no distingue correo inexistente: mismo mensaje genérico (sin error)", async () => {
    // resetPasswordForEmail no devuelve error por "no existe" — es el
    // comportamiento real del proveedor, no algo que esta pantalla decida.
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    render(<RecoverPasswordScreen />);

    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "no@existe.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Mandar enlace" }));

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Si ese correo tiene una cuenta, te mandé el enlace",
      ),
    );
  });

  it("RUL-AUTH-06: bloqueado por límite de intentos, no llega a llamar a Supabase", async () => {
    mocks.fetch.mockResolvedValue({
      json: async () => ({ ok: true, data: { allowed: false, retry_after_seconds: 1800 } }),
    });
    render(<RecoverPasswordScreen />);

    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Mandar enlace" }));

    await screen.findByRole("alert");
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("redirectTo apunta a /auth/callback con next=/restablecer-clave", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    render(<RecoverPasswordScreen />);

    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Mandar enlace" }));

    await waitFor(() => expect(mocks.resetPasswordForEmail).toHaveBeenCalled());
    const [, options] = mocks.resetPasswordForEmail.mock.calls[0];
    expect(options.redirectTo).toContain("/auth/callback?next=%2Frestablecer-clave");
  });
});
