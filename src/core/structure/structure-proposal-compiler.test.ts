import { describe, expect, it } from "vitest";
import type { StructureProposalRequest } from "@/agents/conversational-executive-agent/types";
import { compileStructureProposal } from "./structure-proposal-compiler";
import { StructureProposalSchema } from "./structure-proposal";

const NOW = "2026-08-09T10:00:00.000-05:00";
const ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";
const BOX_ID = "00000000-0000-4000-8000-000000000002";

function request(
  overrides: Partial<StructureProposalRequest> = {},
): StructureProposalRequest {
  return {
    intent: "create",
    entity: "caja",
    summary: "¿Creo la caja Viaje en BCP y aparto S/500?",
    confirm_label: "Sí, crear la caja",
    confidence: 0.9,
    ambiguities: [],
    target_id: null,
    name: "Viaje",
    amount: 500,
    target_amount: null,
    target_date: null,
    account_id: ACCOUNT_ID,
    box_id: null,
    box_type: "objetivo",
    category_id: null,
    period_kind: null,
    budget_kind: null,
    frequency: null,
    next_expected_date: null,
    amount_variability: null,
    currency: null,
    account_type: null,
    institution: null,
    ...overrides,
  };
}

describe("compilar una propuesta de estructura", () => {
  it("una caja completa se convierte en borrador confirmable", () => {
    const compiled = compileStructureProposal({
      request: request(),
      userText: "apartame 500 en una caja para el viaje, sale de BCP",
      now: NOW,
    });

    expect(compiled.kind).toBe("proposal");
    if (compiled.kind !== "proposal") return;
    expect(compiled.proposal).toMatchObject({
      entity: "caja",
      operation: "create",
      command_type: "CreateBoxCommand",
      summary: "¿Creo la caja Viaje en BCP y aparto S/500?",
      confirm_label: "Sí, crear la caja",
      proposed_at: NOW,
    });
    expect(compiled.proposal.payload).toMatchObject({
      name: "Viaje",
      account_id: ACCOUNT_ID,
      initial_balance: 500,
      type: "objetivo",
    });
  });

  it("el texto del botón llega entero: el límite de un canal no es de la respuesta", () => {
    // Antes se cortaba aquí por el límite de 20 caracteres de los botones del
    // proveedor de mensajería, y la pantalla web —que no tiene ese límite—
    // heredaba el recorte: mostraba "Sí, actualizar la..." perdiendo justo la
    // parte que dice qué hace. El recorte vive ahora en el adaptador que lo
    // necesita (`response-shaper`).
    const compiled = compileStructureProposal({
      request: request({
        confirm_label: "Sí, crea la caja del viaje a Cusco de una vez",
      }),
      userText: "crea una caja Viaje en BCP",
      now: NOW,
    });

    expect(compiled.kind).toBe("proposal");
    if (compiled.kind !== "proposal") return;
    expect(compiled.proposal.confirm_label).toBe(
      "Sí, crea la caja del viaje a Cusco de una vez",
    );
  });

  it("cada borrador nace con su propio identificador", () => {
    const primero = compileStructureProposal({
      request: request(),
      userText: "crea una caja Viaje en BCP",
      now: NOW,
    });
    const segundo = compileStructureProposal({
      request: request(),
      userText: "crea una caja Viaje en BCP",
      now: NOW,
    });
    if (primero.kind !== "proposal" || segundo.kind !== "proposal") {
      throw new Error("se esperaban dos borradores");
    }
    expect(primero.proposal.proposal_id).not.toBe(
      segundo.proposal.proposal_id,
    );
  });

  it("un presupuesto se compila con su categoria y periodo", () => {
    const compiled = compileStructureProposal({
      request: request({
        entity: "presupuesto",
        name: null,
        account_id: null,
        box_type: null,
        amount: 500,
        category_id: "alimentacion",
        period_kind: "mensual",
        budget_kind: "presupuesto",
        summary: "¿Te pongo un presupuesto de S/500 al mes en alimentación?",
      }),
      userText: "ponme un limite de 500 al mes en comida",
      now: NOW,
    });

    expect(compiled.kind).toBe("proposal");
    if (compiled.kind !== "proposal") return;
    expect(compiled.proposal.command_type).toBe("CreateBudgetCommand");
    expect(compiled.proposal.payload).toMatchObject({
      amount: 500,
      category_id: "alimentacion",
      period_kind: "mensual",
    });
  });
});

describe("RUL-PRES-01: ante la ambigüedad se pregunta, no se escribe", () => {
  it("no propone un presupuesto cuando el usuario pidió apartar dinero", () => {
    const compiled = compileStructureProposal({
      request: request({
        entity: "presupuesto",
        category_id: "otros",
        period_kind: "mensual",
        budget_kind: "presupuesto",
      }),
      userText: "apartame 500 para el viaje",
      now: NOW,
    });

    expect(compiled.kind).toBe("needs_clarification");
    if (compiled.kind !== "needs_clarification") return;
    expect(compiled.question).toContain("apartar");
  });

  it("una frase que mezcla apartar y limitar acaba en pregunta", () => {
    const compiled = compileStructureProposal({
      request: request({ entity: "caja" }),
      userText: "quiero separar un presupuesto de 500 para comida",
      now: NOW,
    });
    expect(compiled.kind).toBe("needs_clarification");
  });

  it("una duda declarada por el modelo bloquea la propuesta", () => {
    const compiled = compileStructureProposal({
      request: request({
        ambiguities: ["¿De qué cuenta sale el dinero?"],
      }),
      userText: "crea una caja para el viaje",
      now: NOW,
    });

    expect(compiled).toEqual({
      kind: "needs_clarification",
      question: "¿De qué cuenta sale el dinero?",
    });
  });

  it("poca confianza no se presenta como acción", () => {
    const compiled = compileStructureProposal({
      request: request({ confidence: 0.3 }),
      userText: "crea una caja para el viaje",
      now: NOW,
    });
    expect(compiled.kind).toBe("needs_clarification");
  });

  it("una caja sin cuenta pregunta en vez de proponer", () => {
    const compiled = compileStructureProposal({
      request: request({ account_id: null }),
      userText: "crea una caja para el viaje",
      now: NOW,
    });

    expect(compiled.kind).toBe("needs_clarification");
    if (compiled.kind !== "needs_clarification") return;
    expect(compiled.question).toContain("cuenta");
  });

  it("un mensaje ambiguo pregunta aunque el modelo no proponga nada", () => {
    const compiled = compileStructureProposal({
      request: null,
      userText: "quiero separar un presupuesto de 500 para comida",
      now: NOW,
    });
    expect(compiled.kind).toBe("needs_clarification");
  });
});

describe("turnos que no son de estructura", () => {
  it("sin propuesta ni señales, no hay nada que compilar", () => {
    expect(
      compileStructureProposal({
        request: request({ intent: "none", entity: null }),
        userText: "gaste 20 en desayuno",
        now: NOW,
      }),
    ).toEqual({ kind: "none" });
  });
});

describe("modificar estructura existente", () => {
  it("una caja se modifica con su id y solo los campos que cambian", () => {
    const compiled = compileStructureProposal({
      request: request({
        intent: "update",
        target_id: BOX_ID,
        name: "Viaje a Cusco",
        amount: null,
        account_id: null,
        box_type: null,
        summary: "¿Le cambio el nombre a Viaje a Cusco?",
      }),
      userText: "renombra la caja del viaje a Viaje a Cusco",
      now: NOW,
    });

    expect(compiled.kind).toBe("proposal");
    if (compiled.kind !== "proposal") return;
    expect(compiled.proposal.command_type).toBe("UpdateBoxCommand");
    expect(compiled.proposal.payload).toEqual({
      box_id: BOX_ID,
      name: "Viaje a Cusco",
    });
  });
});

describe("pagos recurrentes", () => {
  it("un pago fijo se compila con su monto, frecuencia y próxima fecha", () => {
    const compiled = compileStructureProposal({
      request: request({
        entity: "recurrente",
        name: "Netflix",
        amount: 44.9,
        account_id: null,
        box_type: null,
        frequency: "monthly",
        next_expected_date: "2026-09-05",
        amount_variability: "fixed",
        summary: "¿Anoto Netflix de S/44.90 cada mes, el 5?",
      }),
      userText: "agrega la suscripcion de Netflix, me cobran 44.90 el 5",
      now: NOW,
    });

    expect(compiled.kind).toBe("proposal");
    if (compiled.kind !== "proposal") return;
    expect(compiled.proposal.command_type).toBe("CreateRecurringCommand");
    expect(compiled.proposal.payload).toMatchObject({
      name: "Netflix",
      expected_amount: 44.9,
      amount_variability: "fixed",
      frequency: "monthly",
      next_expected_date: "2026-09-05",
    });
  });

  it("sin monto se anota como variable, no se inventa un importe", () => {
    const compiled = compileStructureProposal({
      request: request({
        entity: "recurrente",
        name: "Luz",
        amount: null,
        account_id: null,
        box_type: null,
        next_expected_date: "2026-09-10",
        summary: "¿Anoto el recibo de luz para el 10?",
      }),
      userText: "agrega el recibo de luz, me cobran cada mes",
      now: NOW,
    });

    expect(compiled.kind).toBe("proposal");
    if (compiled.kind !== "proposal") return;
    expect(compiled.proposal.payload).toMatchObject({
      expected_amount: null,
      amount_variability: "variable",
    });
  });

  it("sin próxima fecha pregunta en vez de proponer", () => {
    const compiled = compileStructureProposal({
      request: request({
        entity: "recurrente",
        name: "Gimnasio",
        amount: 120,
        account_id: null,
        box_type: null,
        next_expected_date: null,
        summary: "¿Anoto la mensualidad del gimnasio?",
      }),
      userText: "agrega la mensualidad del gimnasio, son 120",
      now: NOW,
    });

    expect(compiled.kind).toBe("needs_clarification");
    if (compiled.kind !== "needs_clarification") return;
    expect(compiled.question).toContain("cuándo");
  });
});

describe("cuentas", () => {
  it("una cuenta se compila con su tipo, moneda y saldo declarado", () => {
    const compiled = compileStructureProposal({
      request: request({
        entity: "cuenta",
        name: "BCP Ahorros",
        amount: 1200,
        account_id: null,
        box_type: null,
        account_type: "banco",
        institution: "BCP",
        currency: "PEN",
        summary: "¿Creo la cuenta BCP Ahorros con S/1200?",
      }),
      userText: "crea una cuenta nueva de BCP con 1200",
      now: NOW,
    });

    expect(compiled.kind).toBe("proposal");
    if (compiled.kind !== "proposal") return;
    expect(compiled.proposal.command_type).toBe("CreateAccountCommand");
    expect(compiled.proposal.payload).toMatchObject({
      name: "BCP Ahorros",
      type: "banco",
      institution: "BCP",
      currency: "PEN",
      initial_balance: 1200,
    });
  });
});

describe("subcategorías: lo que sí se puede crear dentro de una categoría", () => {
  const SUBCATEGORY_ID = "00000000-0000-4000-8000-00000000000b";

  function subcategoryRequest(
    overrides: Partial<StructureProposalRequest> = {},
  ): StructureProposalRequest {
    return request({
      entity: "subcategoria",
      name: "Animales",
      category_id: "vivienda_hogar",
      amount: null,
      account_id: null,
      box_type: null,
      summary: "¿Creo la subcategoría Animales dentro de Vivienda / Hogar?",
      confirm_label: "Sí, créala",
      ...overrides,
    });
  }

  it("crear una subcategoría dentro de una categoría se convierte en borrador confirmable", () => {
    const compiled = compileStructureProposal({
      request: subcategoryRequest(),
      userText:
        "ese gasto de comida de gatos ponlo dentro de una nueva subcategoria llamada Animales dentro de Vivienda",
      now: NOW,
    });

    expect(compiled.kind).toBe("proposal");
    if (compiled.kind !== "proposal") return;
    expect(compiled.proposal).toMatchObject({
      entity: "subcategoria",
      operation: "create",
      command_type: "CreateSubcategoryCommand",
    });
    expect(compiled.proposal.payload).toEqual({
      category_id: "vivienda_hogar",
      label: "Animales",
    });
  });

  it("sin decir dentro de cuál va, pregunta en vez de crear una suelta", () => {
    // Una subcategoría sin categoría madre no existe en el dominio: la
    // columna `category_id` de `user_subcategories` no admite nulos.
    const compiled = compileStructureProposal({
      request: subcategoryRequest({ category_id: null }),
      userText: "crea una subcategoria Animales",
      now: NOW,
    });

    expect(compiled.kind).toBe("needs_clarification");
    if (compiled.kind !== "needs_clarification") return;
    expect(compiled.question).toContain("dentro de cuál de las 12 categorías");
  });

  it("una categoría inventada no se propone: no está entre las 12", () => {
    const compiled = compileStructureProposal({
      request: subcategoryRequest({ category_id: "mascotas" }),
      userText: "crea una subcategoria Animales en mascotas",
      now: NOW,
    });

    expect(compiled.kind).toBe("needs_clarification");
  });

  it("renombrar una subcategoría necesita su id y el nombre nuevo", () => {
    const compiled = compileStructureProposal({
      request: subcategoryRequest({
        intent: "update",
        target_id: SUBCATEGORY_ID,
        name: "Mascotas",
        category_id: null,
        summary: "¿Le cambio el nombre a Mascotas?",
      }),
      userText: "renombra la subcategoria Animales a Mascotas",
      now: NOW,
    });

    expect(compiled.kind).toBe("proposal");
    if (compiled.kind !== "proposal") return;
    expect(compiled.proposal.command_type).toBe("UpdateSubcategoryCommand");
    expect(compiled.proposal.payload).toEqual({
      subcategory_id: SUBCATEGORY_ID,
      label: "Mascotas",
    });
  });

  it("archivarla avisa de que los movimientos que ya la usan no cambian", () => {
    const compiled = compileStructureProposal({
      request: subcategoryRequest({
        intent: "archive",
        target_id: SUBCATEGORY_ID,
        confidence: 0.95,
        summary: "¿Archivo la subcategoría Animales?",
      }),
      userText: "archiva la subcategoria Animales",
      now: NOW,
    });

    expect(compiled.kind).toBe("proposal");
    if (compiled.kind !== "proposal") return;
    expect(compiled.proposal.command_type).toBe("ArchiveSubcategoryCommand");
    expect(compiled.proposal.payload).toEqual({
      subcategory_id: SUBCATEGORY_ID,
    });
    expect(compiled.proposal.summary).toContain("conservan su referencia");
  });

  it("una subcategoría no se pausa, y se dice en vez de traducirlo a otra cosa", () => {
    const compiled = compileStructureProposal({
      request: subcategoryRequest({
        intent: "pause",
        target_id: SUBCATEGORY_ID,
        summary: "¿Pauso esa subcategoría?",
      }),
      userText: "pausa la subcategoria Animales",
      now: NOW,
    });

    expect(compiled.kind).toBe("needs_clarification");
    if (compiled.kind !== "needs_clarification") return;
    expect(compiled.question).toContain("no se pausa");
  });
});

describe("ERR-ASI-01: pedir una categoría nueva se contesta, nunca se calla", () => {
  it("dice que son fijas, las nombra y ofrece la subcategoría", () => {
    // El peor final posible de este turno no es equivocar la entidad: es que
    // la persona se quede creyendo que se creó algo que no existe.
    const compiled = compileStructureProposal({
      request: request({ intent: "none", entity: null }),
      userText: "crea una categoria nueva que se llame Mascotas",
      now: NOW,
    });

    expect(compiled.kind).toBe("needs_clarification");
    if (compiled.kind !== "needs_clarification") return;
    expect(compiled.question).toContain("No puedo crear categorías");
    expect(compiled.question).toContain("Vivienda / Hogar");
    expect(compiled.question).toContain("subcategoría");
  });

  it("contesta igual aunque el modelo proponga una subcategoría sin categoría madre", () => {
    // Sin `category_id` no hay nada que crear, y la respuesta honesta no es
    // "¿dentro de cuál?" sino explicar por qué la de primer nivel no existe.
    const compiled = compileStructureProposal({
      request: request({
        entity: "subcategoria",
        name: "Mascotas",
        category_id: null,
        amount: null,
        account_id: null,
        box_type: null,
      }),
      userText: "quiero una categoria nueva para Mascotas",
      now: NOW,
    });

    expect(compiled.kind).toBe("needs_clarification");
    if (compiled.kind !== "needs_clarification") return;
    expect(compiled.question).toContain("No puedo crear categorías");
  });

  it("cuando la persona dijo dentro de cuál, se propone la subcategoría en vez del «no»", () => {
    // "una categoría nueva llamada Animales dentro de Vivienda" es, en el
    // modelo de dominio, una subcategoría. Negarlo sería negar algo que sí se
    // puede hacer.
    const compiled = compileStructureProposal({
      request: request({
        entity: "subcategoria",
        name: "Animales",
        category_id: "vivienda_hogar",
        amount: null,
        account_id: null,
        box_type: null,
        summary: "¿Creo la subcategoría Animales dentro de Vivienda / Hogar?",
      }),
      userText: "crea una categoria nueva llamada Animales dentro de Vivienda",
      now: NOW,
    });

    expect(compiled.kind).toBe("proposal");
    if (compiled.kind !== "proposal") return;
    expect(compiled.proposal.command_type).toBe("CreateSubcategoryCommand");
  });

  it("cambiar la categoría de un gasto no es pedir una categoría nueva", () => {
    // Eso es una corrección de movimiento y tiene su propio camino. Contestar
    // aquí que las categorías son fijas negaría algo que el motor sí hace.
    const compiled = compileStructureProposal({
      request: request({ intent: "none", entity: null }),
      userText: "cambia la categoria de ese gasto a transporte",
      now: NOW,
    });

    expect(compiled).toEqual({ kind: "none" });
  });

  it("clasificar un gasto dentro de una categoría existente tampoco lo es", () => {
    const compiled = compileStructureProposal({
      request: request({ intent: "none", entity: null }),
      userText: "pon ese gasto en la categoria transporte",
      now: NOW,
    });

    expect(compiled).toEqual({ kind: "none" });
  });
});

describe("RUL-ESTR-05: cerrar algo se confirma diciendo qué se pierde", () => {
  const CAJA_ID = "00000000-0000-4000-8000-000000000009";

  function archiveRequest(entity: "caja" | "cuenta" | "recurrente") {
    return request({
      intent: "archive",
      entity,
      target_id: CAJA_ID,
      name: null,
      amount: null,
      account_id: null,
      box_type: null,
      confidence: 0.95,
      summary: "¿Cierro la caja Viaje?",
    });
  }

  it("el resumen lleva la consecuencia aunque el modelo no la escriba", () => {
    const compiled = compileStructureProposal({
      request: archiveRequest("caja"),
      userText: "archiva la caja del viaje",
      now: NOW,
    });

    expect(compiled.kind).toBe("proposal");
    if (compiled.kind !== "proposal") return;
    // Lo que se pierde no lo redacta el modelo: lo pone el núcleo, siempre.
    expect(compiled.proposal.summary).toContain("vuelve a tu saldo libre");
    expect(compiled.proposal.summary).toContain("¿Cierro la caja Viaje?");
    expect(compiled.proposal.operation).toBe("archive");
    expect(compiled.proposal.command_type).toBe("ArchiveBoxCommand");
  });

  it("el botón nombra que se está cerrando, no un «sí» genérico", () => {
    const compiled = compileStructureProposal({
      request: archiveRequest("cuenta"),
      userText: "archiva esa cuenta",
      now: NOW,
    });

    if (compiled.kind !== "proposal") throw new Error("se esperaba borrador");
    expect(compiled.proposal.confirm_label).toBe("Sí, archívalo");
    expect(compiled.proposal.summary).toContain("sus cajas se archivan también");
  });

  it("cancelar un recurrente avisa de que se deja de esperar el cobro", () => {
    const compiled = compileStructureProposal({
      request: archiveRequest("recurrente"),
      userText: "cancela la suscripcion de Netflix",
      now: NOW,
    });

    if (compiled.kind !== "proposal") throw new Error("se esperaba borrador");
    expect(compiled.proposal.summary).toContain("dejo de avisarte");
  });

  it.each(["caja", "cuenta", "recurrente"] as const)(
    "el borrador de cierre de %s sigue validando al leerlo del hilo",
    (entity) => {
      // El borrador se guarda en el working set y se vuelve a validar con
      // `StructureProposalSchema` al confirmarlo. Con el límite de 320 que
      // tenía `summary`, la consecuencia determinística más la frase del
      // modelo lo pasaban: el borrador se guardaba, y el "sí" del turno
      // siguiente moría como `unknown_proposal` sin decir nada.
      const compiled = compileStructureProposal({
        request: {
          ...archiveRequest(entity),
          summary: "A".repeat(280),
        },
        userText: "archiva eso",
        now: NOW,
      });

      if (compiled.kind !== "proposal") throw new Error("se esperaba borrador");
      expect(
        StructureProposalSchema.safeParse(compiled.proposal).success,
      ).toBe(true);
    },
  );

  it("cerrar exige más confianza que crear", () => {
    // 0.7 alcanzaba para crear; para cerrar, no. Crear de más se deshace
    // cerrando; cerrar de más puede costar dinero movido.
    const compiled = compileStructureProposal({
      request: { ...archiveRequest("caja"), confidence: 0.7 },
      userText: "archiva la caja del viaje",
      now: NOW,
    });
    expect(compiled.kind).toBe("needs_clarification");
  });

  it("sin saber qué se cierra, se pregunta antes de tocar nada", () => {
    const compiled = compileStructureProposal({
      request: { ...archiveRequest("caja"), target_id: null },
      userText: "archiva esa caja",
      now: NOW,
    });

    expect(compiled.kind).toBe("needs_clarification");
    if (compiled.kind !== "needs_clarification") return;
    expect(compiled.question).toContain("qué pasa con lo que tiene");
  });
});

describe("pausar y reanudar", () => {
  const META_ID = "00000000-0000-4000-8000-00000000000a";

  it("una meta se pausa con su id y nada más", () => {
    const compiled = compileStructureProposal({
      request: request({
        intent: "pause",
        entity: "meta",
        target_id: META_ID,
        name: "Carro",
        amount: 9999,
        account_id: null,
        box_type: null,
        summary: "¿Pauso la meta del carro?",
      }),
      userText: "pausa la meta del carro",
      now: NOW,
    });

    expect(compiled.kind).toBe("proposal");
    if (compiled.kind !== "proposal") return;
    expect(compiled.proposal.command_type).toBe("PauseGoalCommand");
    // Un pausado no cambia campos de paso: el resto de lo que el modelo
    // rellenó se descarta.
    expect(compiled.proposal.payload).toEqual({ goal_id: META_ID });
  });

  it("una caja no se pausa: se dice, no se traduce a otra cosa", () => {
    const compiled = compileStructureProposal({
      request: request({
        intent: "pause",
        entity: "caja",
        target_id: BOX_ID,
        name: null,
        amount: null,
        account_id: null,
        box_type: null,
        summary: "¿Pauso esa caja?",
      }),
      userText: "pausa esa caja",
      now: NOW,
    });

    expect(compiled.kind).toBe("needs_clarification");
    if (compiled.kind !== "needs_clarification") return;
    expect(compiled.question).toContain("no se puede pausar");
  });
});
