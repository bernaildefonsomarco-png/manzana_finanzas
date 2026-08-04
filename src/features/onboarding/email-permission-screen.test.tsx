import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  startGmailOAuth: vi.fn(),
  assign: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/features/settings/settings-api", () => ({ startGmailOAuth: mocks.startGmailOAuth }));

import { EmailPermissionScreen } from "./email-permission-screen";

beforeEach(() => {
  mocks.push.mockReset();
  mocks.startGmailOAuth.mockReset();
  mocks.assign.mockReset();
  vi.stubGlobal("location", { assign: mocks.assign });
});

describe("EmailPermissionScreen — 44 SCR-ONB-04: se explica antes de la pantalla de Google", () => {
  it("declara 'lo que hago' y 'lo que no hago' como dos secciones reales, con encabezado", () => {
    render(<EmailPermissionScreen />);
    expect(screen.getByRole("heading", { name: "Lo que hago" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Lo que no hago" })).toBeInTheDocument();
    expect(screen.getByText("No guardo el contenido de tus correos.")).toBeInTheDocument();
  });

  it("Continuar empieza el OAuth de Gmail y redirige a la URL de autorización", async () => {
    mocks.startGmailOAuth.mockResolvedValue("https://accounts.google.com/authorize?x=1");
    render(<EmailPermissionScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() =>
      expect(mocks.assign).toHaveBeenCalledWith("https://accounts.google.com/authorize?x=1"),
    );
  });

  it("Ahora no lleva a /inicio sin iniciar el OAuth", () => {
    render(<EmailPermissionScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Ahora no" }));

    expect(mocks.push).toHaveBeenCalledWith("/inicio");
    expect(mocks.startGmailOAuth).not.toHaveBeenCalled();
  });

  it("un fallo al iniciar el OAuth se dice en español, no se queda en blanco", async () => {
    mocks.startGmailOAuth.mockRejectedValue(new Error("network"));
    render(<EmailPermissionScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByRole("alert");
    expect(mocks.assign).not.toHaveBeenCalled();
  });
});
