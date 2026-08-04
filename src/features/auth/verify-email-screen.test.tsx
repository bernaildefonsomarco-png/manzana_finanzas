import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resend: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/data/supabase/client", () => ({
  createClient: () => ({ auth: { resend: mocks.resend } }),
}));

import { VerifyEmailScreen } from "./verify-email-screen";

beforeEach(() => {
  mocks.resend.mockReset();
  mocks.fetch.mockReset().mockResolvedValue({
    json: async () => ({ ok: true, data: { allowed: true, retry_after_seconds: 0 } }),
  });
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubGlobal("navigator", { onLine: true });
});

describe("VerifyEmailScreen — RUL-AUTH-03: no bloquea el uso, solo reenvía", () => {
  it("camino feliz: reenvía y confirma", async () => {
    mocks.resend.mockResolvedValue({ error: null });
    render(<VerifyEmailScreen initialEmail="marco@ejemplo.com" />);

    fireEvent.click(screen.getByRole("button", { name: "Reenviar confirmación" }));

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain("Te mandé el enlace"),
    );
    expect(mocks.resend).toHaveBeenCalledWith({ type: "signup", email: "marco@ejemplo.com" });
  });

  it("precarga el correo desde ?correo= (RUL-AUTH-04: sin volver a escribirlo)", () => {
    render(<VerifyEmailScreen initialEmail="marco@ejemplo.com" />);
    expect(screen.getByLabelText("Correo")).toHaveValue("marco@ejemplo.com");
  });

  it("AC-AUTH-15: el precheck propio (con hora exacta) bloquea antes de que Supabase intervenga", async () => {
    // La hora exacta de reintento (AC-AUTH-15) la da nuestro propio límite
    // (`/api/v1/auth/attempt`, con retry_after_seconds real); el límite
    // nativo de Supabase no expone ese número, así que si llegara a
    // dispararse él solo, el mensaje cae al genérico — nunca bloquea la
    // cuenta en ningún caso (RUL-AUTH-06).
    mocks.fetch.mockResolvedValue({
      json: async () => ({ ok: true, data: { allowed: false, retry_after_seconds: 900 } }),
    });
    render(<VerifyEmailScreen initialEmail="a@b.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Reenviar confirmación" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/Prueba otra vez a las \d{2}:\d{2}\./);
    expect(mocks.resend).not.toHaveBeenCalled();
  });
});
