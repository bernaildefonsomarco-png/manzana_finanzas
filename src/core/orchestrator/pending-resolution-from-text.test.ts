import { describe, expect, it } from "vitest";
import {
  buildPendingReferenceCode,
  extractPendingReferenceCode,
} from "@/core/pending/reference-code";
import {
  getPendingResolutionAction,
  isConfirmationText,
  isDiscardText,
  isPendingListText,
  isPendingReviewText,
  isStructuredPendingResolutionText,
} from "./pending-resolution-from-text";

describe("pending resolution intent from text", () => {
  it("detecta confirmaciones claras", () => {
    expect(isConfirmationText("confirmo")).toBe(true);
    expect(isConfirmationText("Confirmar")).toBe(true);
    expect(isConfirmationText("si confirmo")).toBe(true);
    expect(isConfirmationText("dale confirma")).toBe(true);
    expect(isConfirmationText("confirmo eso")).toBe(true);
    expect(isConfirmationText("registra ese gasto")).toBe(true);
    expect(isConfirmationText("registralo")).toBe(true);
    expect(isConfirmationText("guarda eso")).toBe(true);
    expect(isConfirmationText("si")).toBe(true);
    expect(isConfirmationText("si lo confirmo")).toBe(true);
  });

  it("detecta afirmaciones sueltas genericas (unificadas con estructura)", () => {
    expect(isConfirmationText("dale")).toBe(true);
    expect(isConfirmationText("sip")).toBe(true);
    expect(isConfirmationText("listo")).toBe(true);
    expect(isConfirmationText("hazlo")).toBe(true);
    expect(isConfirmationText("adelante")).toBe(true);
  });

  it("no suma verbos correctivos (eliminalo, cambialo) salvo que se pidan explicitamente", () => {
    // La resolucion generica de pendientes NO activa `includeCorrectiveVerbs`:
    // ahi "confirmar" significa aceptar una clasificacion, no borrar el
    // registro, asi que "eliminalo" solo no cuenta como confirmacion.
    expect(isConfirmationText("eliminalo")).toBe(false);
    expect(getPendingResolutionAction("eliminalo")).toBeNull();

    // Con la opcion activada (como hace `correction-resolution.ts`) si cuenta,
    // incluida la frase exacta reportada en produccion.
    expect(isConfirmationText("eliminalo", { includeCorrectiveVerbs: true })).toBe(
      true,
    );
    expect(
      isConfirmationText("dale eliminalo", { includeCorrectiveVerbs: true }),
    ).toBe(true);
  });

  it("detecta negativas sueltas genericas para el descarte", () => {
    expect(isDiscardText("no")).toBe(true);
    expect(isDiscardText("mejor no")).toBe(true);
    expect(isDiscardText("dejalo")).toBe(true);
    expect(isDiscardText("olvidalo")).toBe(true);
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
    const code = buildPendingReferenceCode({
      userId: "00000000-0000-4000-8000-000000000002",
      pendingItemId: "00000000-0000-4000-8000-000000000020",
    });

    expect(code).toMatch(/^P-[A-F0-9]{8}$/);
    expect(
      buildPendingReferenceCode({
        userId: "00000000-0000-4000-8000-000000000002",
        pendingItemId: "00000000-0000-4000-8000-000000000020",
      })
    ).toBe(code);
    expect(extractPendingReferenceCode(`confirmar ${code.toLowerCase()}`)).toBe(
      code
    );
    expect(extractPendingReferenceCode(code.replace("-", " "))).toBe(code);
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
