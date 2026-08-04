import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock("@/data/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp,
    },
  }),
}));

import { AuthScreen } from "./auth-screen";

function attemptAllowedResponse() {
  return {
    json: async () => ({ ok: true, data: { allowed: true, retry_after_seconds: 0 } }),
  };
}

beforeEach(() => {
  mocks.push.mockReset();
  mocks.refresh.mockReset();
  mocks.signInWithPassword.mockReset();
  mocks.signUp.mockReset();
  mocks.fetch.mockReset().mockImplementation((url: string) => {
    if (url.includes("/api/v1/auth/attempt")) return Promise.resolve(attemptAllowedResponse());
    return Promise.resolve({ json: async () => ({ ok: true, data: { recorded: true } }) });
  });
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubGlobal("navigator", { onLine: true });
});

async function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Correo"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar a Manzana" }));
}

describe("AuthScreen — AC-AUTH-01/RUL-AUTH-05: nunca propaga el mensaje del proveedor", () => {
  it("invalid_credentials en español, sin el texto en inglés del proveedor", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      error: { code: "invalid_credentials", message: "Invalid login credentials" },
    });

    render(<AuthScreen initialMode="login" />);
    await fillAndSubmit("marco@ejemplo.com", "unacontrasenalarga");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("El correo o la contraseña no coinciden");
    expect(alert.textContent).not.toContain("Invalid login credentials");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("email_not_confirmed ofrece reenviar verificación", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      error: { code: "email_not_confirmed", message: "Email not confirmed" },
    });

    render(<AuthScreen initialMode="login" />);
    await fillAndSubmit("marco@ejemplo.com", "unacontrasenalarga");

    await screen.findByRole("alert");
    expect(screen.getByText("Reenviar verificación")).toBeInTheDocument();
  });

  it("un código desconocido nunca expone el texto crudo", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      error: { code: "some_future_code", message: "raw internal provider detail" },
    });

    render(<AuthScreen initialMode="login" />);
    await fillAndSubmit("marco@ejemplo.com", "unacontrasenalarga");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).not.toContain("raw internal provider detail");
  });

  it("camino feliz: entra y navega a /inicio por defecto", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: null });

    render(<AuthScreen initialMode="login" />);
    await fillAndSubmit("marco@ejemplo.com", "unacontrasenalarga");

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/inicio"));
  });

  it("RUL-AUTH-06: si el límite de intentos no permite, no llega a llamar a Supabase", async () => {
    mocks.fetch.mockImplementation((url: string) => {
      if (url.includes("/api/v1/auth/attempt")) {
        return Promise.resolve({
          json: async () => ({ ok: true, data: { allowed: false, retry_after_seconds: 300 } }),
        });
      }
      return Promise.resolve({ json: async () => ({ ok: true }) });
    });

    render(<AuthScreen initialMode="login" />);
    await fillAndSubmit("marco@ejemplo.com", "unacontrasenalarga");

    await screen.findByRole("alert");
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it("RUL-HECHO-02: si el error no trajera 'code', el mapeo caería al genérico, no a ERR-AUTH-01", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" }, // sin `code`, como el código anterior a RUL-AUTH-05
    });

    render(<AuthScreen initialMode="login" />);
    await fillAndSubmit("marco@ejemplo.com", "unacontrasenalarga");

    const alert = await screen.findByRole("alert");
    // El mensaje genérico de login, no el específico de credenciales:
    // confirma que el mapeo depende del código y no de adivinar por texto.
    expect(alert.textContent).toContain("No pude iniciar sesión ahora");
  });

  it("AC-AUTH-17: correo y contraseña llevan autocomplete y <label> visible", () => {
    render(<AuthScreen initialMode="login" />);
    expect(screen.getByLabelText("Correo")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
  });

  it("la contraseña exige mínimo 8 caracteres (RUL-AUTH-02), no 6", () => {
    render(<AuthScreen initialMode="login" />);
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("minlength", "8");
  });

  it("'¿Olvidaste tu contraseña?' está visible desde el principio, no tras fallar", () => {
    render(<AuthScreen initialMode="login" />);
    expect(screen.getByText("¿Olvidaste tu contraseña?")).toBeInTheDocument();
  });
});
