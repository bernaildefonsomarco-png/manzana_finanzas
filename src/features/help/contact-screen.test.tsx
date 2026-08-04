import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), pathname: "/mi-dinero" }));

vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));

import { ContactScreen } from "./contact-screen";

beforeEach(() => {
  mocks.fetch.mockReset().mockResolvedValue({ json: async () => ({ ok: true, data: { sent: true } }) });
  vi.stubGlobal("fetch", mocks.fetch);
});

describe("ContactScreen — RUL-AYUDA-09: el usuario ve qué se adjunta antes de enviar", () => {
  it("muestra las tres piezas de contexto y la garantía de qué no se envía", () => {
    render(<ContactScreen />);
    expect(screen.getByText("La pantalla en la que estabas")).toBeInTheDocument();
    expect(
      screen.getByText("No envío tus movimientos, tus montos ni tus conversaciones."),
    ).toBeInTheDocument();
  });

  it("ACT-AYUDA-07: quitar un elemento de contexto lo excluye del envío", async () => {
    render(<ContactScreen />);
    fireEvent.change(screen.getByLabelText("Cuéntame qué pasó"), { target: { value: "No carga la pantalla." } });

    const quitarButtons = screen.getAllByText("Quitar");
    fireEvent.click(quitarButtons[0]); // quita "La pantalla en la que estabas"

    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith("/api/v1/support/contact", expect.anything()),
    );
    const call = mocks.fetch.mock.calls.find(([url]) => url === "/api/v1/support/contact")!;
    const sentBody = JSON.parse(call[1].body);
    expect(sentBody.context.route).toBeUndefined();
  });

  it("el botón enviar está deshabilitado sin mensaje", () => {
    render(<ContactScreen />);
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
  });

  it("camino feliz: envía y muestra confirmación", async () => {
    render(<ContactScreen />);
    fireEvent.change(screen.getByLabelText("Cuéntame qué pasó"), { target: { value: "Ayuda por favor." } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Listo"));
  });

  it("un fallo de red conserva el mensaje escrito (RUL-AUTH-09-style: nunca se pierde lo escrito)", async () => {
    mocks.fetch.mockRejectedValue(new Error("network down"));
    render(<ContactScreen />);
    fireEvent.change(screen.getByLabelText("Cuéntame qué pasó"), { target: { value: "Mi mensaje importante." } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await screen.findByRole("alert");
    expect(screen.getByLabelText("Cuéntame qué pasó")).toHaveValue("Mi mensaje importante.");
  });
});
