import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));

import { WelcomeScreen } from "./welcome-screen";

beforeEach(() => {
  mocks.push.mockReset();
  mocks.fetch.mockReset().mockResolvedValue({ json: async () => ({ ok: true, data: {} }) });
  vi.stubGlobal("fetch", mocks.fetch);
});

describe("WelcomeScreen — 44 SCR-ONB-02: tres frases, una decisión", () => {
  it("elegir 'Registrar un gasto' avanza el onboarding y navega a /movimientos/nuevo", async () => {
    render(<WelcomeScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar un gasto" }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/movimientos/nuevo"));
    expect(mocks.fetch).toHaveBeenCalledWith(
      "/api/v1/onboarding",
      expect.objectContaining({
        body: JSON.stringify({ action: "start", source: "welcome_movement" }),
      }),
    );
  });

  it("elegir 'Decirte cuánto tengo' navega a /mi-dinero", async () => {
    render(<WelcomeScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Decirte cuánto tengo" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/mi-dinero"));
  });

  it("elegir 'Conectar mi correo' navega al explicador antes de Google (SCR-ONB-04)", async () => {
    render(<WelcomeScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Conectar mi correo" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/bienvenida/correo"));
  });

  it("RUL-ONB-05/AC-ONB-07: 'Prefiero mirar primero' también avanza el estado, para que la bienvenida no reaparezca", async () => {
    render(<WelcomeScreen />);
    fireEvent.click(screen.getByText("Prefiero mirar primero →"));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/inicio"));
    expect(mocks.fetch).toHaveBeenCalledWith(
      "/api/v1/onboarding",
      expect.objectContaining({
        body: JSON.stringify({ action: "start", source: "welcome_skip" }),
      }),
    );
  });

  it("RUL-HECHO-02: si el fetch de avance no se llamara, el aserto de arriba fallaría", async () => {
    render(<WelcomeScreen />);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
