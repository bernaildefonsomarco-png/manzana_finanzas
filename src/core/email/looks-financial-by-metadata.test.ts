// RUL-EMAIL-05: la sugerencia de remitente nuevo evalua solo remitente y
// patron de asunto (nunca el cuerpo, que ni siquiera se descarga).
import { describe, expect, it } from "vitest";
import { looksFinancialByMetadata } from "./email-ingestion";

describe("looksFinancialByMetadata", () => {
  it.each([
    "notificaciones@bcp.com.pe",
    "alertas@interbank.pe",
    "no-reply@yape.com.pe",
    "avisos@bbva.com",
  ])("%s parece financiero por el remitente", (sender) => {
    expect(looksFinancialByMetadata(sender, null)).toBe(true);
  });

  it("un remitente generico con asunto de movimiento parece financiero", () => {
    expect(looksFinancialByMetadata("info@tienda.com", "Cargo aprobado en tu cuenta")).toBe(true);
  });

  it("un remitente y asunto sin ninguna senal financiera no lo parece", () => {
    expect(looksFinancialByMetadata("newsletter@revista.com", "Tu resumen semanal de noticias")).toBe(false);
  });
});
