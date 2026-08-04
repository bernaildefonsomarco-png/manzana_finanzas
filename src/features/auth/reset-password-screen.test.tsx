import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/data/supabase/client", () => ({
  createClient: () => ({ auth: { updateUser: mocks.updateUser, signOut: mocks.signOut } }),
}));

import { ResetPasswordScreen } from "./reset-password-screen";

beforeEach(() => {
  mocks.push.mockReset();
  mocks.updateUser.mockReset();
  mocks.signOut.mockReset().mockResolvedValue({ error: null });
  mocks.fetch.mockReset().mockResolvedValue({ json: async () => ({ ok: true, data: {} }) });
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubGlobal("navigator", { onLine: true });
});

function fill(password: string, confirm: string) {
  fireEvent.change(screen.getByLabelText("Contraseña nueva"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Repite la contraseña"), { target: { value: confirm } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar contraseña nueva" }));
}

describe("ResetPasswordScreen — RUL-AUTH-07: recuperar la contraseña cierra las demás sesiones", () => {
  it("camino feliz: guarda, cierra otras sesiones y lo dice", async () => {
    mocks.updateUser.mockResolvedValue({ error: null });
    render(<ResetPasswordScreen />);

    fill("unacontrasenalarga", "unacontrasenalarga");

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Cerré las sesiones abiertas en otros dispositivos",
      ),
    );
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "others" });
  });

  it("las dos contraseñas deben coincidir antes de llamar a Supabase", async () => {
    render(<ResetPasswordScreen />);
    fill("unacontrasenalarga", "otradistinta");

    await screen.findByRole("alert");
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("same_password se traduce (ERR-AUTH-09), no el texto del proveedor", async () => {
    mocks.updateUser.mockResolvedValue({
      error: { code: "same_password", message: "New password should be different" },
    });
    render(<ResetPasswordScreen />);
    fill("unacontrasenalarga", "unacontrasenalarga");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Esa es la contraseña que ya tienes");
    expect(alert.textContent).not.toContain("New password should be different");
  });

  it("RUL-HECHO-02: si signOut(others) no se llamara, el aserto de arriba fallaría", async () => {
    mocks.updateUser.mockResolvedValue({ error: null });
    render(<ResetPasswordScreen />);
    fill("unacontrasenalarga", "unacontrasenalarga");
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1));
  });
});
