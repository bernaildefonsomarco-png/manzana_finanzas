import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  getAccountDeletionImpact: vi.fn(),
  deleteUserAccount: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/features/settings/settings-api", () => ({
  getAccountDeletionImpact: mocks.getAccountDeletionImpact,
  deleteUserAccount: mocks.deleteUserAccount,
}));

import { DeleteAccountSection } from "./delete-account-section";

const impact = {
  movements: 1847,
  debts: 3,
  email_connections: 2,
  learned_things: 37,
  conversations: 5,
};

beforeEach(() => {
  mocks.push.mockReset();
  mocks.getAccountDeletionImpact.mockReset().mockResolvedValue(impact);
  mocks.deleteUserAccount.mockReset().mockResolvedValue(undefined);
});

describe("DeleteAccountSection — SCR-AUTH-08/RUL-AUTH-10", () => {
  it("no calcula el impacto hasta que se abre la sección (evita consultas innecesarias)", () => {
    render(<DeleteAccountSection />);
    expect(mocks.getAccountDeletionImpact).not.toHaveBeenCalled();
  });

  it("al abrir, muestra cifras reales, no un texto genérico", async () => {
    render(<DeleteAccountSection />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar mi cuenta" }));

    await screen.findByText("1,847 movimientos");
    expect(screen.getByText("3 deudas y su historial")).toBeInTheDocument();
    expect(screen.getByText("37 cosas que aprendí sobre tu dinero")).toBeInTheDocument();
  });

  it("el botón de eliminar está deshabilitado hasta escribir la frase exacta", async () => {
    render(<DeleteAccountSection />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar mi cuenta" }));
    await screen.findByLabelText(/Escribe ELIMINAR MI CUENTA/);

    const buttons = screen.getAllByRole("button", { name: "Eliminar mi cuenta" });
    const confirmButton = buttons[buttons.length - 1];
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Escribe ELIMINAR MI CUENTA/), {
      target: { value: "ELIMINAR MI CUENTA" },
    });
    expect(confirmButton).toBeEnabled();
  });

  it("WEB-D099: 'Cancelar' es el botón primario, 'Eliminar' es secundario/danger", async () => {
    render(<DeleteAccountSection />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar mi cuenta" }));
    await screen.findByLabelText(/Escribe ELIMINAR MI CUENTA/);

    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveAttribute(
      "class",
      expect.stringContaining("bg-brand"),
    );
  });

  it("camino feliz: confirma con la frase exacta y navega a /cuenta-eliminada", async () => {
    render(<DeleteAccountSection />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar mi cuenta" }));
    await screen.findByLabelText(/Escribe ELIMINAR MI CUENTA/);

    fireEvent.change(screen.getByLabelText(/Escribe ELIMINAR MI CUENTA/), {
      target: { value: "ELIMINAR MI CUENTA" },
    });
    const buttons = screen.getAllByRole("button", { name: "Eliminar mi cuenta" });
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => expect(mocks.deleteUserAccount).toHaveBeenCalledWith("ELIMINAR MI CUENTA"));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/cuenta-eliminada"));
  });

  it("RUL-HECHO-02: una frase casi correcta no habilita el botón ni llama al API", async () => {
    render(<DeleteAccountSection />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar mi cuenta" }));
    await screen.findByLabelText(/Escribe ELIMINAR MI CUENTA/);

    fireEvent.change(screen.getByLabelText(/Escribe ELIMINAR MI CUENTA/), {
      target: { value: "eliminar mi cuenta" },
    });
    const buttons = screen.getAllByRole("button", { name: "Eliminar mi cuenta" });
    expect(buttons[buttons.length - 1]).toBeDisabled();
    expect(mocks.deleteUserAccount).not.toHaveBeenCalled();
  });
});
