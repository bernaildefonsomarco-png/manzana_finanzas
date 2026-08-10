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

describe("cuentas y pagos recurrentes entran sin volver ambiguo lo que ya funcionaba", () => {
  it("crear una cuenta se lee como cuenta", () => {
    expect(readStructureIntent("crea una cuenta nueva en BCP")).toMatchObject({
      kind: "unambiguous",
      entity: "cuenta",
    });
  });

  // El caso caro de meter `cuenta` en el vocabulario: es la palabra con la que
  // se nombra DE DONDE sale el dinero de una caja. Si contara como candidata,
  // la frase mas natural para crear una caja pasaria a preguntar.
  it.each([
    "crea una caja Viaje en mi cuenta BCP",
    "aparta 500 en la caja del carro desde mi cuenta de ahorros",
    "abre una caja para el viaje con el dinero de esa cuenta",
  ])("«%s» pide una caja: la cuenta solo dice de donde sale", (frase) => {
    expect(readStructureIntent(frase)).toMatchObject({
      kind: "unambiguous",
      entity: "caja",
    });
  });

  it("una suscripcion es un pago recurrente", () => {
    expect(
      readStructureIntent("agrega la suscripcion de Netflix, me cobran el 5"),
    ).toMatchObject({ kind: "unambiguous", entity: "recurrente" });
  });

  // La periodicidad a secas NO es senal de recurrente a proposito: un
  // presupuesto tambien es mensual, y contarla volveria ambigua —y por tanto
  // repreguntable— la frase mas normal para crear un presupuesto.
  it("un presupuesto mensual no se vuelve ambiguo con el recurrente", () => {
    expect(
      readStructureIntent("ponme un presupuesto de 500 cada mes en comida"),
    ).toMatchObject({ kind: "unambiguous", entity: "presupuesto" });
  });

  it("nombrar la cuenta al cancelar un recurrente no lo vuelve ambiguo", () => {
    expect(
      readStructureIntent("cancela la mensualidad del gimnasio de esa cuenta"),
    ).toMatchObject({ kind: "unambiguous", entity: "recurrente" });
  });

  it("pedir una cuenta y una caja de verdad sigue siendo ambiguo", () => {
    expect(
      readStructureIntent("crea una cuenta y una caja"),
    ).toMatchObject({ kind: "ambiguous" });
  });

  it("preguntar por las cuentas no es pedir crear una", () => {
    expect(readStructureIntent("cuanto tengo en mi cuenta de BCP")).toEqual({
      kind: "none",
    });
  });
});

describe("el ciclo de vida tambien es una escritura", () => {
  it.each([
    ["archiva esa caja", "caja"],
    ["cierra el presupuesto de comida", "presupuesto"],
    ["cancela la suscripcion de Spotify", "recurrente"],
    ["pausa esa meta un tiempo", "meta"],
    ["reanuda la meta del carro", "meta"],
  ])("«%s» se lee como %s", (frase, entity) => {
    expect(readStructureIntent(frase)).toMatchObject({
      kind: "unambiguous",
      entity,
    });
  });

  it("dudar en voz alta no es pedir cerrar nada", () => {
    // Sin verbo de escritura no hay lectura de estructura: el modelo tiene que
    // resolverlo con contexto, y el guardarrail no le impone una entidad.
    expect(readStructureIntent("me sirve todavia esa caja?")).toEqual({
      kind: "none",
    });
  });
});

describe("la pregunta enumera cuando hay mas de dos lecturas", () => {
  it("nombra las tres y explica cada una", () => {
    const pregunta = composeStructureAmbiguityQuestion([
      "caja",
      "cuenta",
      "recurrente",
    ]);
    expect(pregunta).toContain("una caja");
    expect(pregunta).toContain("una cuenta");
    expect(pregunta).toContain("un pago recurrente");
    expect(pregunta).toContain("tampoco aparta");
  });
});
