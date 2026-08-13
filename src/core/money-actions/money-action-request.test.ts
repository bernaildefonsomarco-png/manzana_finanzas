import { describe, expect, it } from "vitest";
import {
  compileMoneyAction,
  type MoneyActionAccountContext,
  type MoneyActionBoxContext,
  type MoneyActionRequest,
} from "./money-action-request";

const NOW = "2026-08-12T10:00:00.000Z";
const BCP_ID = "00000000-0000-4000-8000-000000000a01";
const YAPE_ID = "00000000-0000-4000-8000-000000000a02";
const BOX_VIAJE_ID = "00000000-0000-4000-8000-000000000b01";
const BOX_EMERGENCIA_ID = "00000000-0000-4000-8000-000000000b02";
const BOX_OTRA_CUENTA_ID = "00000000-0000-4000-8000-000000000b03";
const OTRA_CUENTA_ID = "00000000-0000-4000-8000-000000000a03";

const accounts: MoneyActionAccountContext[] = [
  { id: BCP_ID, name: "BCP", currency: "PEN" },
  { id: YAPE_ID, name: "Yape", currency: "PEN" },
  { id: OTRA_CUENTA_ID, name: "Interbank USD", currency: "USD" },
];

const boxes: MoneyActionBoxContext[] = [
  { id: BOX_VIAJE_ID, account_id: BCP_ID, name: "Viaje", current_balance: 300 },
  {
    id: BOX_EMERGENCIA_ID,
    account_id: BCP_ID,
    name: "Emergencia",
    current_balance: 120,
  },
  {
    id: BOX_OTRA_CUENTA_ID,
    account_id: OTRA_CUENTA_ID,
    name: "Otra cuenta",
    current_balance: 50,
  },
];

function request(overrides: Partial<MoneyActionRequest> = {}): MoneyActionRequest {
  return {
    intent: "none",
    from_account_id: "",
    to_account_id: "",
    box_origin_id: "",
    box_destination_id: "",
    amount: 0,
    description: "",
    confidence: 0.9,
    ambiguities: [],
    ...overrides,
  };
}

describe("compileMoneyAction: contrato y silencio correcto", () => {
  it("sin request, no se pidio nada", () => {
    expect(compileMoneyAction({ request: null, userText: "", now: NOW, accounts, boxes })).toEqual({
      kind: "not_requested",
    });
  });

  it("intent none, no se pidio nada", () => {
    const result = compileMoneyAction({
      request: request({ intent: "none" }),
      userText: "hola",
      now: NOW,
      accounts,
      boxes,
    });
    expect(result).toEqual({ kind: "not_requested" });
  });

  it("una ambiguedad declarada por el modelo se pregunta primero", () => {
    const result = compileMoneyAction({
      request: request({
        intent: "transferir",
        ambiguities: ["¿De qué cuenta a qué cuenta?"],
      }),
      userText: "transfiere 100",
      now: NOW,
      accounts,
      boxes,
    });
    expect(result).toEqual({
      kind: "needs_clarification",
      question: "¿De qué cuenta a qué cuenta?",
    });
  });

  it("bajo el umbral de confianza, se pregunta en vez de proponer", () => {
    const result = compileMoneyAction({
      request: request({
        intent: "transferir",
        from_account_id: BCP_ID,
        to_account_id: YAPE_ID,
        amount: 100,
        confidence: 0.4,
      }),
      userText: "capaz transfiero algo",
      now: NOW,
      accounts,
      boxes,
    });
    expect(result.kind).toBe("needs_clarification");
  });

  it("ERR-CUENTAS-08: monto cero o negativo no propone nada", () => {
    const result = compileMoneyAction({
      request: request({
        intent: "transferir",
        from_account_id: BCP_ID,
        to_account_id: YAPE_ID,
        amount: 0,
      }),
      userText: "transfiere de BCP a Yape",
      now: NOW,
      accounts,
      boxes,
    });
    expect(result.kind).toBe("needs_clarification");
    if (result.kind === "needs_clarification") {
      expect(result.question).toContain("mayor que cero");
    }
  });
});

describe("transferir", () => {
  it("con los dos ids exactos arma la propuesta con el efecto previo", () => {
    const result = compileMoneyAction({
      request: request({
        intent: "transferir",
        from_account_id: BCP_ID,
        to_account_id: YAPE_ID,
        amount: 100,
      }),
      userText: "pasa 100 de BCP a Yape",
      now: NOW,
      accounts,
      boxes,
      freeBalanceByAccountId: { [BCP_ID]: 500 },
    });
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.command.operation).toBe("transfer");
    expect(result.command.catalog_command).toBe("transferir");
    expect(result.command.payload).toMatchObject({
      from_account_id: BCP_ID,
      to_account_id: YAPE_ID,
      amount: 100,
    });
    expect(result.command.summary).toContain("S/100.00");
    expect(result.command.summary).toContain("BCP");
    expect(result.command.summary).toContain("Yape");
    expect(result.command.summary).toContain("S/400.00");
  });

  it("sin el libre cargado, la frase no inventa una cifra", () => {
    const result = compileMoneyAction({
      request: request({
        intent: "transferir",
        from_account_id: BCP_ID,
        to_account_id: YAPE_ID,
        amount: 100,
      }),
      userText: "pasa 100 de BCP a Yape",
      now: NOW,
      accounts,
      boxes,
    });
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.command.summary).not.toContain("quedará con");
  });

  it("ERR-CUENTAS-06: mismo origen y destino pregunta, no propone", () => {
    const result = compileMoneyAction({
      request: request({
        intent: "transferir",
        from_account_id: BCP_ID,
        to_account_id: BCP_ID,
        amount: 100,
      }),
      userText: "transfiere 100 de BCP a BCP",
      now: NOW,
      accounts,
      boxes,
    });
    expect(result.kind).toBe("needs_clarification");
    if (result.kind === "needs_clarification") {
      expect(result.question).toContain("misma cuenta");
    }
  });

  it("dos cuentas mencionadas sin id exacto no se resuelven por texto: se pregunta", () => {
    // Nombrar dos cuentas en la misma frase no dice cual es origen y cual
    // destino: aqui NO hay fallback de texto, a diferencia de una sola caja.
    const result = compileMoneyAction({
      request: request({
        intent: "transferir",
        from_account_id: "",
        to_account_id: "",
        amount: 100,
      }),
      userText: "pasa 100 de BCP a Yape",
      now: NOW,
      accounts,
      boxes,
    });
    expect(result.kind).toBe("needs_clarification");
  });

  it("un id inventado no se usa para escribir", () => {
    const result = compileMoneyAction({
      request: request({
        intent: "transferir",
        from_account_id: "id-que-no-existe",
        to_account_id: YAPE_ID,
        amount: 100,
      }),
      userText: "transfiere 100",
      now: NOW,
      accounts,
      boxes,
    });
    expect(result.kind).toBe("needs_clarification");
  });
});

describe("separar_en_caja", () => {
  it("resuelve la caja por id y muestra el efecto en el libre", () => {
    const result = compileMoneyAction({
      request: request({
        intent: "separar_en_caja",
        box_destination_id: BOX_VIAJE_ID,
        amount: 200,
      }),
      userText: "aparta 200 en Viaje",
      now: NOW,
      accounts,
      boxes,
      freeBalanceByAccountId: { [BCP_ID]: 500 },
    });
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.command.operation).toBe("separate_to_box");
    expect(result.command.payload).toMatchObject({
      box_destination_id: BOX_VIAJE_ID,
      amount: 200,
    });
    expect(result.command.summary).toContain("Viaje");
    expect(result.command.summary).toContain("S/300.00");
  });

  it("resuelve la caja por nombre cuando el modelo no trajo id", () => {
    const result = compileMoneyAction({
      request: request({ intent: "separar_en_caja", amount: 50 }),
      userText: "separa 50 en la caja Emergencia",
      now: NOW,
      accounts,
      boxes,
    });
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.command.payload.box_destination_id).toBe(BOX_EMERGENCIA_ID);
  });

  it("sin cajas del usuario, pregunta en vez de fallar en silencio", () => {
    const result = compileMoneyAction({
      request: request({ intent: "separar_en_caja", amount: 50 }),
      userText: "separa 50",
      now: NOW,
      accounts,
      boxes: [],
    });
    expect(result.kind).toBe("needs_clarification");
  });
});

describe("devolver_a_libre", () => {
  it("usa el saldo de la caja ya cargado para el efecto previo, sin IO extra", () => {
    const result = compileMoneyAction({
      request: request({
        intent: "devolver_a_libre",
        box_origin_id: BOX_EMERGENCIA_ID,
        amount: 20,
      }),
      userText: "devuelve 20 de Emergencia",
      now: NOW,
      accounts,
      boxes,
    });
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.command.operation).toBe("release_from_box");
    expect(result.command.summary).toContain("Emergencia");
    // 120 - 20 = 100, y no hizo falta `freeBalanceByAccountId`.
    expect(result.command.summary).toContain("S/100.00");
  });
});

describe("mover_entre_cajas", () => {
  it("con los dos ids exactos arma la propuesta", () => {
    const result = compileMoneyAction({
      request: request({
        intent: "mover_entre_cajas",
        box_origin_id: BOX_VIAJE_ID,
        box_destination_id: BOX_EMERGENCIA_ID,
        amount: 30,
      }),
      userText: "mueve 30 de Viaje a Emergencia",
      now: NOW,
      accounts,
      boxes,
    });
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.command.operation).toBe("box_to_box");
    expect(result.command.payload).toMatchObject({
      box_origin_id: BOX_VIAJE_ID,
      box_destination_id: BOX_EMERGENCIA_ID,
      amount: 30,
    });
    // 300 - 30 = 270
    expect(result.command.summary).toContain("S/270.00");
  });

  it("dos cajas sin id exacto no se resuelven por texto: se pregunta", () => {
    const result = compileMoneyAction({
      request: request({
        intent: "mover_entre_cajas",
        box_origin_id: "",
        box_destination_id: "",
        amount: 30,
      }),
      userText: "mueve 30 de Viaje a Emergencia",
      now: NOW,
      accounts,
      boxes,
    });
    expect(result.kind).toBe("needs_clarification");
  });

  it("la misma caja como origen y destino no se propone", () => {
    const result = compileMoneyAction({
      request: request({
        intent: "mover_entre_cajas",
        box_origin_id: BOX_VIAJE_ID,
        box_destination_id: BOX_VIAJE_ID,
        amount: 30,
      }),
      userText: "mueve 30 de Viaje a Viaje",
      now: NOW,
      accounts,
      boxes,
    });
    expect(result.kind).toBe("needs_clarification");
  });
});
