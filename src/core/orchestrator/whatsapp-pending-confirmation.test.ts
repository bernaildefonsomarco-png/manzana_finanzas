import { describe, expect, it } from "vitest";
import {
  buildPendingWhatsAppCode,
  extractPendingWhatsAppCode,
} from "@/core/pending/whatsapp-pending-code";
import {
  getPendingResolutionAction,
  isConfirmationText,
  isDiscardText,
  isPendingListText,
  isPendingReviewText,
  isStructuredPendingResolutionText,
} from "./whatsapp-pending-confirmation";

describe("WhatsApp pending resolution intent", () => {
  it("detecta confirmaciones claras", () => {
    expect(isConfirmationText("confirmo")).toBe(true);
    expect(isConfirmationText("Confirmar")).toBe(true);
    expect(isConfirmationText("si confirmo")).toBe(true);
    expect(isConfirmationText("dale confirma")).toBe(true);
    expect(isConfirmationText("confirmo eso")).toBe(true);
    expect(isConfirmationText("registra ese gasto")).toBe(true);
    expect(isConfirmationText("registralo")).toBe(true);
    expect(isConfirmationText("guarda eso")).toBe(true);
  });

  it("no confirma si el usuario niega o descarta", () => {
    expect(isConfirmationText("no confirmo")).toBe(false);
    expect(isConfirmationText("no lo registres")).toBe(false);
    expect(isConfirmationText("nunca guardar")).toBe(false);
    expect(isConfirmationText("cancelar")).toBe(false);
    expect(isConfirmationText("descarta eso")).toBe(false);
  });

  it("detecta descartes claros", () => {
    expect(isDiscardText("cancelar")).toBe(true);
    expect(isDiscardText("Descartar")).toBe(true);
    expect(isDiscardText("descarta eso")).toBe(true);
    expect(isDiscardText("borra pendiente")).toBe(true);
    expect(isDiscardText("no descartes")).toBe(false);
  });

  it("detecta pedidos claros para listar pendientes", () => {
    expect(isPendingListText("ver pendientes")).toBe(true);
    expect(isPendingListText("muestrame pendientes")).toBe(true);
    expect(isPendingListText("que pendientes tengo")).toBe(true);
    expect(isPendingListText("gaste 8 cafe")).toBe(false);
  });

  it("crea y extrae codigos estables de pendientes", () => {
    const code = buildPendingWhatsAppCode({
      userId: "00000000-0000-4000-8000-000000000002",
      pendingItemId: "00000000-0000-4000-8000-000000000020",
    });

    expect(code).toMatch(/^P-[A-F0-9]{8}$/);
    expect(
      buildPendingWhatsAppCode({
        userId: "00000000-0000-4000-8000-000000000002",
        pendingItemId: "00000000-0000-4000-8000-000000000020",
      })
    ).toBe(code);
    expect(extractPendingWhatsAppCode(`confirmar ${code.toLowerCase()}`)).toBe(
      code
    );
    expect(extractPendingWhatsAppCode(code.replace("-", " "))).toBe(code);
    expect(isConfirmationText(`confirmar ${code}`)).toBe(true);
    expect(isDiscardText(`cancelar ${code}`)).toBe(true);
  });

  it("clasifica primero descartes y luego confirmaciones", () => {
    expect(getPendingResolutionAction("ver pendientes")).toBe("list");
    expect(getPendingResolutionAction("descarta eso")).toBe("discard");
    expect(getPendingResolutionAction("confirmo")).toBe("confirm");
    expect(getPendingResolutionAction("revisar P-ABC12345")).toBe("review");
    expect(
      getPendingResolutionAction(
        "P-ABC12345 fue de Tarjeta BCP a Efectivo",
      ),
    ).toBe("assign_transfer");
    expect(
      getPendingResolutionAction("P-ABC12345 fue un gasto sin cuenta"),
    ).toBe("classify_expense");
    expect(getPendingResolutionAction("gaste 8 cafe")).toBeNull();
  });

  it("revisa solo un pendiente identificado, no una frase vaga", () => {
    expect(isPendingReviewText("revisar P-ABC12345")).toBe(true);
    expect(isPendingReviewText("quiero revisar eso")).toBe(false);
  });

  it("solo considera estructurado un comando con codigo emitido por un boton", () => {
    expect(isStructuredPendingResolutionText("confirmar P-ABC12345")).toBe(
      true,
    );
    expect(isStructuredPendingResolutionText("descartar P-ABC12345")).toBe(
      true,
    );
    expect(isStructuredPendingResolutionText("revisar P-ABC12345")).toBe(
      true,
    );
    expect(isStructuredPendingResolutionText("descarta ese gasto")).toBe(
      false,
    );
    expect(isStructuredPendingResolutionText("si, hazlo")).toBe(false);
  });

  it("no trata mensajes financieros comunes como resolucion", () => {
    expect(getPendingResolutionAction("gaste 8 cafe")).toBeNull();
    expect(getPendingResolutionAction("registra 20 en desayuno")).toBeNull();
    expect(getPendingResolutionAction("cuanto tengo libre")).toBeNull();
  });
});
