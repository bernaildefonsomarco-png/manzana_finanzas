import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnsubscribeAllButton } from "./unsubscribe-all-button";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

describe("UnsubscribeAllButton — ACT-MAIL-04: confirma antes de dar de baja todo", () => {
  it("no llama a la API hasta confirmar (evita una baja total por un clic accidental)", () => {
    render(<UnsubscribeAllButton token="tok" />);
    fireEvent.click(screen.getByText("Dejar de recibir todos"));
    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.getByText(/Seguro/)).toBeInTheDocument();
  });

  it("camino feliz: confirma y muestra el mensaje final", async () => {
    mockFetch.mockResolvedValue({ json: async () => ({ ok: true }) });
    render(<UnsubscribeAllButton token="tok-1" />);

    fireEvent.click(screen.getByText("Dejar de recibir todos"));
    fireEvent.click(screen.getByText("Sí, dejar de recibir todos"));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Listo"));
    expect(mockFetch).toHaveBeenCalledWith(
      "/baja/todos",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ token: "tok-1" }) }),
    );
  });

  it("un fallo ofrece reintentar, sin fingir éxito", async () => {
    mockFetch.mockResolvedValue({ json: async () => ({ ok: false }) });
    render(<UnsubscribeAllButton token="tok-1" />);

    fireEvent.click(screen.getByText("Dejar de recibir todos"));
    fireEvent.click(screen.getByText("Sí, dejar de recibir todos"));

    await screen.findByRole("alert");
  });
});
