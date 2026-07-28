import { describe, expect, it } from "vitest";
import { normalizeWhatsAppFormatting } from "./formatting";

describe("normalizeWhatsAppFormatting", () => {
  it("convierte negrita e italica Markdown al formato nativo de WhatsApp", () => {
    expect(
      normalizeWhatsAppFormatting(
        "Hoy gastaste **S/20.00** en __Alimentacion__.",
      ),
    ).toBe("Hoy gastaste *S/20.00* en _Alimentacion_.");
  });

  it("no altera el formato nativo ni el contenido financiero", () => {
    expect(normalizeWhatsAppFormatting("Total: *S/8.00*."))
      .toBe("Total: *S/8.00*.");
  });
});
