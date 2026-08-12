import { describe, expect, it } from "vitest";
import { DebtActionRequestSchema } from "@/agents/conversational-executive-agent/types";
import {
  compileDebtAction,
  describeUnavailableDebtAction,
  type DebtActionDebtContext,
  type DebtActionPersonContext,
  type DebtActionRequest,
} from "./debt-action-request";

const NOW = "2026-08-12T10:00:00.000Z";
const DEUDA_MARCO = "00000000-0000-4000-8000-0000000000a1";
const DEUDA_LUIS = "00000000-0000-4000-8000-0000000000a2";
const CUOTA_1 = "00000000-0000-4000-8000-0000000000b1";
const CUOTA_2 = "00000000-0000-4000-8000-0000000000b2";

function request(overrides: Partial<DebtActionRequest> = {}): DebtActionRequest {
  return {
    intent: "none",
    debt_id: "",
    installment_id: "",
    close_reason: "sin_decidir",
    due_date: "",
    reason: "",
    person_name: "",
    person_relationship: "",
    confidence: 0.9,
    ambiguities: [],
    ...overrides,
  };
}

function deuda(
  overrides: Partial<DebtActionDebtContext> = {},
): DebtActionDebtContext {
  return {
    id: DEUDA_MARCO,
    name: "Préstamo de Marco",
    direction: "i_owe",
    status: "active",
    current_balance: 600,
    currency: "PEN",
    related_person_id: null,
    related_person_name: "Marco",
    related_person_aliases: [],
    installments: [],
    ...overrides,
  };
}

function compile(
  overrides: Partial<DebtActionRequest>,
  extra: {
    userText?: string;
    debts?: DebtActionDebtContext[];
    closedDebts?: DebtActionDebtContext[];
    relatedPeople?: DebtActionPersonContext[];
  } = {},
) {
  return compileDebtAction({
    request: request(overrides),
    userText: extra.userText ?? "",
    now: NOW,
    debts: extra.debts ?? [deuda()],
    closedDebts: extra.closedDebts ?? [],
    relatedPeople: extra.relatedPeople ?? [],
  });
}

describe("compileDebtAction: el contrato con el modelo", () => {
  it("un turno que no habla de deudas no pide nada", () => {
    expect(compile({ intent: "none" })).toEqual({ kind: "not_requested" });
    expect(
      compileDebtAction({
        request: null,
        userText: "hola",
        now: NOW,
        debts: [],
        relatedPeople: [],
      }),
    ).toEqual({ kind: "not_requested" });
  });

  it("lo que el modelo emite valida contra el esquema que lee el nucleo", () => {
    // Los dos tipos viven en modulos distintos —el esquema en el agente, el
    // contrato en el nucleo— y podrian separarse en silencio. Esto lo ata: si
    // alguien cambia uno, el `parse` deja de encajar en `compileDebtAction`.
    const parsed = DebtActionRequestSchema.parse({
      intent: "cerrar_deuda",
      debt_id: DEUDA_MARCO,
      installment_id: "",
      close_reason: "condonada",
      due_date: "",
      reason: "",
      person_name: "",
      person_relationship: "",
      confidence: 0.9,
      ambiguities: [],
    });
    const resultado = compileDebtAction({
      request: parsed,
      userText: "me perdonó la deuda",
      now: NOW,
      debts: [deuda()],
      relatedPeople: [],
    });
    expect(resultado.kind).toBe("ready");
  });
});

describe("compileDebtAction: lo que este motor no hace (`WEB-D205`)", () => {
  it.each([
    ["registrar_interes", "web_d205_interest_adjustment_deferred"],
    ["renegociar_deuda", "web_d205_renegotiation_deferred"],
    ["vincular_caja_a_deuda", "no_executor_for_box_debt_link"],
  ] as const)(
    "%s no se propone ni se calla: se declara `unavailable` con su motivo",
    (intent, reason) => {
      const resultado = compile({ intent });
      // `WEB-D298`: `unavailable` es un final distinto de `not_requested`. Si
      // los dos volvieran a colapsar en `null`, el turno callaria y la persona
      // se quedaria creyendo que su saldo cambio.
      expect(resultado).toEqual({ kind: "unavailable", reason });
      expect(resultado.kind).not.toBe("not_requested");
    },
  );

  it("cada motivo diferido tiene texto con via manual, para que el turno no quede mudo", () => {
    for (const reason of [
      "web_d205_interest_adjustment_deferred",
      "web_d205_renegotiation_deferred",
      "no_executor_for_box_debt_link",
    ]) {
      const texto = describeUnavailableDebtAction(reason);
      expect(texto).toBeTruthy();
      expect(texto!.length).toBeGreaterThan(40);
    }
  });

  it("un motivo desconocido devuelve null en vez de inventar texto", () => {
    expect(describeUnavailableDebtAction("lo_que_sea")).toBeNull();
  });
});

describe("cerrar_deuda: pagada y condonada no se confunden (`RUL-DEUDAS-13`)", () => {
  it("con saldo vivo y sin que la persona lo diga, PREGUNTA (`ERR-DEUDAS-06`)", () => {
    const resultado = compile(
      { intent: "cerrar_deuda", close_reason: "sin_decidir" },
      { userText: "ya le pagué todo a Marco" },
    );
    expect(resultado.kind).toBe("needs_clarification");
    if (resultado.kind !== "needs_clarification") return;
    // La pregunta lleva la cifra: sin ella no se puede elegir.
    expect(resultado.question).toContain("S/600.00");
    expect(resultado.question).toContain("perdonaron");
    expect(resultado.question).toContain("no cuentan como pago");
  });

  it("con saldo vivo y `pagada`, NO cierra: dice que falta saldo", () => {
    const resultado = compile({
      intent: "cerrar_deuda",
      close_reason: "pagada",
    });
    // Cerrarla como pagada con S/600 vivos seria una etiqueta que oculta saldo,
    // que es exactamente lo que `RUL-DEUDAS-13` prohibe.
    expect(resultado.kind).toBe("needs_clarification");
    if (resultado.kind !== "needs_clarification") return;
    expect(resultado.question).toContain("cero");
    expect(resultado.question).toContain("S/600.00");
  });

  it("con saldo vivo y `condonada`, propone `forgiven` con la cifra a la vista", () => {
    const resultado = compile({
      intent: "cerrar_deuda",
      close_reason: "condonada",
    });
    expect(resultado.kind).toBe("ready");
    if (resultado.kind !== "ready") return;
    expect(resultado.command.payload).toMatchObject({
      debt_id: DEUDA_MARCO,
      reason: "forgiven",
      balance_at_proposal: 600,
    });
    expect(resultado.command.summary).toContain("S/600.00");
    expect(resultado.command.summary).toContain("no se pagaron");
    expect(resultado.command.confirm_label).toBe("Sí, dala por perdonada");
  });

  it("con saldo cero propone `paid`, que es la unica legal, sin preguntar de mas", () => {
    const resultado = compile(
      { intent: "cerrar_deuda", close_reason: "sin_decidir" },
      { debts: [deuda({ current_balance: 0 })] },
    );
    expect(resultado.kind).toBe("ready");
    if (resultado.kind !== "ready") return;
    expect(resultado.command.payload).toMatchObject({ reason: "paid" });
    expect(resultado.command.confirm_label).toBe("Sí, ciérrala como pagada");
  });

  it("con saldo cero y `condonada`, no perdona nada: lo explica", () => {
    const resultado = compile(
      { intent: "cerrar_deuda", close_reason: "condonada" },
      { debts: [deuda({ current_balance: 0 })] },
    );
    expect(resultado.kind).toBe("needs_clarification");
    if (resultado.kind !== "needs_clarification") return;
    expect(resultado.question).toContain("nada que perdonar");
  });

  it("el nivel `riesgo` exige mas confianza que una tarjeta", () => {
    // 0.7 basta para mover una cuota y no para cerrar una deuda.
    expect(
      compile({
        intent: "cerrar_deuda",
        close_reason: "condonada",
        confidence: 0.7,
      }).kind,
    ).toBe("needs_clarification");
    expect(
      compile(
        {
          intent: "saltar_cuota",
          confidence: 0.7,
          reason: "este mes no me alcanza",
        },
        { debts: [conCuotas()] },
      ).kind,
    ).toBe("ready");
  });

  it("una sola duda del modelo basta para no proponer", () => {
    const resultado = compile({
      intent: "cerrar_deuda",
      close_reason: "condonada",
      ambiguities: ["¿La de Marco o la del banco?"],
    });
    expect(resultado).toEqual({
      kind: "needs_clarification",
      question: "¿La de Marco o la del banco?",
    });
  });
});

describe("resolver cual deuda", () => {
  it("con una sola deuda viva no hay nada que desambiguar", () => {
    const resultado = compile({
      intent: "cerrar_deuda",
      close_reason: "condonada",
    });
    expect(resultado.kind).toBe("ready");
  });

  it("con varias, el nombre de la persona la elige", () => {
    const resultado = compile(
      { intent: "cerrar_deuda", close_reason: "condonada" },
      {
        userText: "la de Luis me la perdonó",
        debts: [
          deuda(),
          deuda({
            id: DEUDA_LUIS,
            name: "Lo de Luis",
            related_person_name: "Luis",
          }),
        ],
      },
    );
    expect(resultado.kind).toBe("ready");
    if (resultado.kind !== "ready") return;
    expect(resultado.command.payload).toMatchObject({ debt_id: DEUDA_LUIS });
  });

  it("con varias y sin pista, pregunta en vez de acertar", () => {
    const resultado = compile(
      { intent: "cerrar_deuda", close_reason: "condonada" },
      {
        userText: "cierra esa deuda",
        debts: [deuda(), deuda({ id: DEUDA_LUIS, name: "Lo de Luis" })],
      },
    );
    expect(resultado.kind).toBe("needs_clarification");
    if (resultado.kind !== "needs_clarification") return;
    expect(resultado.question).toContain("Préstamo de Marco");
    expect(resultado.question).toContain("Lo de Luis");
  });

  it("un `debt_id` que no existe entre las del usuario se descarta, no se ejecuta", () => {
    // Aislamiento: un identificador inventado —o de otro usuario— nunca escribe,
    // porque el universo de deudas es siempre el del propio turno.
    const resultado = compile(
      {
        intent: "cerrar_deuda",
        close_reason: "condonada",
        debt_id: "00000000-0000-4000-8000-00000000ffff",
      },
      { userText: "ciérrala", debts: [deuda(), deuda({ id: DEUDA_LUIS })] },
    );
    expect(resultado.kind).toBe("needs_clarification");
  });

  it("sin deudas vivas se dice, no se calla", () => {
    const resultado = compile(
      { intent: "cerrar_deuda", close_reason: "condonada" },
      { debts: [] },
    );
    expect(resultado.kind).toBe("needs_clarification");
    if (resultado.kind !== "needs_clarification") return;
    expect(resultado.question).toContain("No veo ninguna deuda activa");
  });

  it("reabrir busca solo entre las condonadas y lo dice si no hay", () => {
    const sinCondonadas = compile(
      { intent: "reabrir_deuda" },
      { debts: [deuda()], closedDebts: [] },
    );
    expect(sinCondonadas.kind).toBe("needs_clarification");
    if (sinCondonadas.kind !== "needs_clarification") return;
    // `DEBT_OPERATION_PAID_CANNOT_REOPEN`: el limite se dice antes de intentarlo.
    expect(sinCondonadas.question).toContain("pagada no se reabre");

    const conCondonada = compile(
      { intent: "reabrir_deuda" },
      {
        debts: [],
        closedDebts: [deuda({ status: "cancelled", current_balance: 0 })],
      },
    );
    expect(conCondonada.kind).toBe("ready");
  });
});

function conCuotas(): DebtActionDebtContext {
  return deuda({
    installments: [
      { id: CUOTA_1, number: 1, due_date: "2026-09-01", status: "pending" },
    ],
  });
}

describe("cuotas: reprogramar y saltar", () => {
  it("saltar sin motivo pregunta, y avisa de que no reduce la deuda", () => {
    const resultado = compile(
      { intent: "saltar_cuota", reason: "" },
      { debts: [conCuotas()] },
    );
    expect(resultado.kind).toBe("needs_clarification");
    if (resultado.kind !== "needs_clarification") return;
    expect(resultado.question).toContain("no reduce lo que debes");
  });

  it("saltar con motivo propone, y la frase dice que el dinero sigue debiendose", () => {
    const resultado = compile(
      { intent: "saltar_cuota", reason: "este mes no me alcanza" },
      { debts: [conCuotas()] },
    );
    expect(resultado.kind).toBe("ready");
    if (resultado.kind !== "ready") return;
    expect(resultado.command.payload).toMatchObject({
      installment_id: CUOTA_1,
      reason: "este mes no me alcanza",
    });
    expect(resultado.command.summary).toContain("no reduce lo que debes");
  });

  it("reprogramar sin fecha pregunta, y con fecha muestra el antes y el despues", () => {
    expect(
      compile({ intent: "reprogramar_cuota" }, { debts: [conCuotas()] }).kind,
    ).toBe("needs_clarification");

    const resultado = compile(
      { intent: "reprogramar_cuota", due_date: "2026-09-15" },
      { debts: [conCuotas()] },
    );
    expect(resultado.kind).toBe("ready");
    if (resultado.kind !== "ready") return;
    expect(resultado.command.summary).toContain("2026-09-01");
    expect(resultado.command.summary).toContain("2026-09-15");
    expect(resultado.command.summary).toContain("importe");
  });

  it("una fecha que no existe no se propone", () => {
    expect(
      compile(
        { intent: "reprogramar_cuota", due_date: "2026-02-30" },
        { debts: [conCuotas()] },
      ).kind,
    ).toBe("needs_clarification");
  });

  it("con dos cuotas abiertas y sin id, pregunta cual", () => {
    const resultado = compile(
      { intent: "saltar_cuota", reason: "no me alcanza" },
      {
        debts: [
          deuda({
            installments: [
              {
                id: CUOTA_1,
                number: 1,
                due_date: "2026-09-01",
                status: "pending",
              },
              {
                id: CUOTA_2,
                number: 2,
                due_date: "2026-10-01",
                status: "pending",
              },
            ],
          }),
        ],
      },
    );
    expect(resultado.kind).toBe("needs_clarification");
    if (resultado.kind !== "needs_clarification") return;
    expect(resultado.question).toContain("la 1");
    expect(resultado.question).toContain("la 2");
  });

  it("una cuota ya pagada no cuenta como abierta", () => {
    const resultado = compile(
      { intent: "saltar_cuota", reason: "no me alcanza" },
      {
        debts: [
          deuda({
            installments: [
              { id: CUOTA_1, number: 1, due_date: "2026-09-01", status: "paid" },
            ],
          }),
        ],
      },
    );
    expect(resultado.kind).toBe("needs_clarification");
    if (resultado.kind !== "needs_clarification") return;
    expect(resultado.question).toContain("no tiene cuotas abiertas");
  });
});

describe("crear_persona: nombrar a alguien no es pedir que se le dé de alta", () => {
  it("propone cuando la persona no existe todavia", () => {
    const resultado = compile(
      {
        intent: "crear_persona",
        person_name: "Fabrizio",
        person_relationship: "mi primo",
      },
      { userText: "agrega a Fabrizio, mi primo" },
    );
    expect(resultado.kind).toBe("ready");
    if (resultado.kind !== "ready") return;
    expect(resultado.command.payload).toMatchObject({
      display_name: "Fabrizio",
      relationship_label: "mi primo",
    });
    // `RUL-DEUDAS-15`: la tarjeta dice el limite de privacidad, no solo el alta.
    expect(resultado.command.summary).toContain("nunca sale del producto");
  });

  it("si ya existe, no la duplica: lo dice (`ERR-DEUDAS-08`)", () => {
    const resultado = compile(
      { intent: "crear_persona", person_name: "marco" },
      {
        relatedPeople: [
          { id: "p1", display_name: "Marco", aliases: ["Marquito"] },
        ],
      },
    );
    expect(resultado.kind).toBe("needs_clarification");
    if (resultado.kind !== "needs_clarification") return;
    expect(resultado.question).toContain("Ya tienes a Marco");
  });

  it("un alias tambien cuenta como la misma persona", () => {
    const resultado = compile(
      { intent: "crear_persona", person_name: "Marquito" },
      {
        relatedPeople: [
          { id: "p1", display_name: "Marco", aliases: ["Marquito"] },
        ],
      },
    );
    expect(resultado.kind).toBe("needs_clarification");
  });

  it("una frase que solo NOMBRA a alguien no llega aqui como alta", () => {
    // "vincula la caja Carro a la deuda de Marco" habla de vincular, no de
    // crear a Marco. Quien lee el verbo es el ejecutivo; lo que este test fija
    // es que el nucleo no convierte esa frase en un alta por su cuenta: con
    // `intent` de vinculacion, el resultado es el limite, nunca `crear_persona`.
    const resultado = compile(
      { intent: "vincular_caja_a_deuda", person_name: "Marco" },
      { userText: "vincula la caja Carro a la deuda de Marco" },
    );
    expect(resultado.kind).toBe("unavailable");
  });

  it("sin nombre no se inventa uno", () => {
    expect(compile({ intent: "crear_persona", person_name: "" }).kind).toBe(
      "needs_clarification",
    );
  });
});
