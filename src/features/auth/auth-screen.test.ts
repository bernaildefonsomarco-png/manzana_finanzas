import { describe, expect, it } from "vitest";
import { toAuthErrorMessage } from "./auth-screen";

describe("auth error language", () => {
  it("no expone el mensaje tecnico en ingles del proveedor", () => {
    expect(
      toAuthErrorMessage(new Error("Invalid login credentials"), "login"),
    ).toBe(
      "El correo o la contraseña no coinciden. Revísalos o crea una cuenta si aún no tienes una.",
    );
  });

  it("ofrece recuperacion contextual sin filtrar detalles", () => {
    expect(
      toAuthErrorMessage(new Error("provider internal stack"), "signup"),
    ).toBe("No pude crear la cuenta ahora. Inténtalo nuevamente.");
  });
});
