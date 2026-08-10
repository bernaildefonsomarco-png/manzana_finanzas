import { describe, expect, it } from "vitest";
import {
  composeStructureAmbiguityQuestion,
  readStructureIntent,
  structureProposalConflictsWithIntent,
} from "./structure-intent";

describe("RUL-PRES-01: caja, meta y presupuesto no se confunden", () => {
  it("apartar dinero es una caja, nunca un presupuesto", () => {
    const lectura = readStructureIntent("apartame 500 para el viaje");
    expect(lectura).toMatchObject({ kind: "unambiguous", entity: "caja" });
  });

  it("un tope de gasto es un presupuesto, nunca una caja", () => {
    const lectura = readStructureIntent(
      "ponme un limite de 500 al mes en comida",
    );
    expect(lectura).toMatchObject({ kind: "unambiguous", entity: "presupuesto" });
  });

  it("un objetivo con nombre propio es una meta", () => {
    const lectura = readStructureIntent("quiero crear una meta de 3000 soles");
    expect(lectura).toMatchObject({ kind: "unambiguous", entity: "meta" });
  });

  it("una frase que mezcla apartar y limite es ambigua: no elige", () => {
    const lectura = readStructureIntent(
      "quiero separar un presupuesto de 500 para comida",
    );
    expect(lectura.kind).toBe("ambiguous");
    if (lectura.kind !== "ambiguous") return;
    expect(lectura.candidates).toEqual(
      expect.arrayContaining(["caja", "presupuesto"]),
    );
  });

  it("nombrar la entidad sin pedir escribir no es una intencion de escritura", () => {
    expect(readStructureIntent("cuanto me queda del presupuesto de comida")).toEqual({
      kind: "none",
    });
  });

  it("un gasto normal no dispara ninguna lectura de estructura", () => {
    expect(readStructureIntent("gaste 20 en desayuno")).toEqual({ kind: "none" });
  });
});

describe("guardarrail sobre la propuesta del modelo", () => {
  it("veta un presupuesto cuando el usuario pidio apartar dinero", () => {
    const conflicto = structureProposalConflictsWithIntent({
      proposedEntity: "presupuesto",
      reading: readStructureIntent("apartame 500 para el viaje"),
    });
    expect(conflicto).toBe(true);
  });

  it("acepta la caja cuando el usuario pidio apartar dinero", () => {
    const conflicto = structureProposalConflictsWithIntent({
      proposedEntity: "caja",
      reading: readStructureIntent("apartame 500 para el viaje"),
    });
    expect(conflicto).toBe(false);
  });

  it("veta cualquier propuesta cuando la lectura es ambigua", () => {
    const reading = readStructureIntent(
      "quiero separar un presupuesto de 500 para comida",
    );
    expect(
      structureProposalConflictsWithIntent({
        proposedEntity: "caja",
        reading,
      }),
    ).toBe(true);
    expect(
      structureProposalConflictsWithIntent({
        proposedEntity: "presupuesto",
        reading,
      }),
    ).toBe(true);
  });

  it("no opina cuando el texto no habla de estructura", () => {
    expect(
      structureProposalConflictsWithIntent({
        proposedEntity: "caja",
        reading: readStructureIntent("gaste 20 en desayuno"),
      }),
    ).toBe(false);
  });
});

describe("la pregunta explica la diferencia, no solo pide elegir", () => {
  it("caja contra presupuesto nombra que uno aparta y el otro no", () => {
    const pregunta = composeStructureAmbiguityQuestion(["caja", "presupuesto"]);
    expect(pregunta).toContain("apartar");
    expect(pregunta).toContain("no toca tu saldo");
  });
});

describe("nombrar una entidad no es pedirla", () => {
  // Reproduccion literal de la sesion del dueno: cada intento nombraba caja y
  // meta, la lectura las contaba como dos candidatas y el turno repreguntaba
  // lo mismo. Cinco turnos para crear una caja que habia pedido en el primero.
  it.each([
    "ahora crea una caja para es meta",
    "crea una caja para esa meta",
    "osea que crees una caja para la meta que acabo de crear",
    "crea una caja para mi meta del carro",
  ])("«%s» pide una caja: la meta solo dice para que", (frase) => {
    expect(readStructureIntent(frase)).toMatchObject({
      kind: "unambiguous",
      entity: "caja",
    });
  });

  it("al reves tambien: una meta para una caja existente sigue siendo una meta", () => {
    expect(readStructureIntent("crea una meta para esa caja")).toMatchObject({
      kind: "unambiguous",
      entity: "meta",
    });
  });

  it("un presupuesto mencionado como referencia no vuelve ambigua la caja", () => {
    expect(
      readStructureIntent("aparta 300 de mi presupuesto de comida"),
    ).toMatchObject({ kind: "unambiguous", entity: "caja" });
  });

  it("pedir las dos de verdad sigue siendo ambiguo", () => {
    expect(readStructureIntent("crea una meta y una caja")).toMatchObject({
      kind: "ambiguous",
    });
  });

  it("la ambiguedad real que este modulo existe para atajar no se pierde", () => {
    expect(
      readStructureIntent("quiero guardar 500 al mes como tope para comida"),
    ).toMatchObject({ kind: "ambiguous" });
  });
});
