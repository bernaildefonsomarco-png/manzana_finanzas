import { describe, expect, it } from "vitest";
import { commandTextLabel } from "./command-text-label";

describe("commandTextLabel", () => {
  it("traduce las correcciones a lo que decia el boton que se pulso", () => {
    expect(commandTextLabel("corr:delete:mov-1")).toBe("Si, eliminar");
    expect(commandTextLabel("corr:amount:mov-1:20_00")).toBe("Si, cambiar el monto");
    expect(commandTextLabel("corr:category:mov-1:alimentacion")).toBe(
      "Si, cambiar la categoria"
    );
    expect(commandTextLabel("corr:acct_origin:mov-1:acct-1")).toBe("Si, cambiar la cuenta");
    expect(commandTextLabel("corr:cancel")).toBe("No cambiar");
  });

  it("traduce las estructuras, cuyo id no dice nada por si mismo", () => {
    expect(commandTextLabel("estr:94411df8-74be-4365-9c9f-d84346a1c484")).toBe(
      "Si, confirmar"
    );
    expect(commandTextLabel("estr:cancel")).toBe("No, cancelar");
  });

  it("traduce las ordenes de memoria, cuyo id tampoco dice nada", () => {
    expect(commandTextLabel("mem:44444444-4444-4444-8444-444444444444")).toBe(
      "Si, confirmar"
    );
    expect(commandTextLabel("mem:cancel")).toBe("No, dejalo");
  });

  it("traduce los cambios de preferencia, cuyo id tampoco dice nada", () => {
    expect(commandTextLabel("pref:55555555-5555-4555-8555-555555555555")).toBe(
      "Si, confirmar"
    );
    expect(commandTextLabel("pref:cancel")).toBe("No, dejalo asi");
  });

  it("RUL-DEUDAS-13: la tarjeta de deuda tampoco deja el asa cruda en el historial", () => {
    // Sin esto, el turno siguiente le muestra al modelo a la persona "diciendo"
    // `deuda:<uuid>` justo despues de dar una deuda por perdonada.
    expect(commandTextLabel("deuda:66666666-6666-4666-8666-666666666666")).toBe(
      "Si, confirmar",
    );
    expect(commandTextLabel("deuda:cancel")).toBe("No, cancelar");
  });

  it("una correccion desconocida sigue siendo una confirmacion, no un identificador crudo", () => {
    expect(commandTextLabel("corr:futuro:mov-1")).toBe("Si, confirmar");
  });

  it("deja intacto lo que el usuario escribio de verdad", () => {
    expect(commandTextLabel("dale eliminalo")).toBeNull();
    expect(commandTextLabel("gaste 20 en desayuno")).toBeNull();
    expect(commandTextLabel("corrige mi presupuesto")).toBeNull();
    expect(commandTextLabel("hola")).toBeNull();
  });
});
