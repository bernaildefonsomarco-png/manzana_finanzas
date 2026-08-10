import { describe, expect, it } from "vitest";
import type { StructureProposalRequest } from "@/agents/conversational-executive-agent/types";
import { compileStructureProposal } from "./structure-proposal-compiler";

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
