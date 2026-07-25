import { describe, expect, it } from "vitest";
import { classifyConversationQuery } from "./conversation-router";

describe("ConversationRouter", () => {
  it("clasifica preguntas de dinero libre y extrae monto solicitado", () => {
    const query = classifyConversationQuery({
      text: "puedo gastar S/50 hoy?",
      receivedAt: "2026-07-15T12:00:00.000Z",
      timezone: "America/Lima",
    });

    expect(query).toMatchObject({
      kind: "balance_snapshot",
      requested_amount: 50,
      date_range: null,
    });
  });

  it("resuelve busquedas historicas como ultimo viernes de hace 4 meses", () => {
    const query = classifyConversationQuery({
      text: "que gaste el ultimo viernes de hace 4 meses",
      receivedAt: "2026-07-15T12:00:00.000Z",
      timezone: "America/Lima",
    });

    expect(query.kind).toBe("movement_search");
    expect(query.date_range).toEqual({
      start: "2026-03-13T00:00:00.000-05:00",
      end: "2026-03-13T23:59:59.999-05:00",
      label: "el ultimo viernes de hace 4 meses",
    });
  });

  it("clasifica consultas de pendientes como resumen read-only", () => {
    const query = classifyConversationQuery({
      text: "tengo pendientes por revisar?",
      receivedAt: "2026-07-15T12:00:00.000Z",
      timezone: "America/Lima",
    });

    expect(query).toMatchObject({
      kind: "pending_summary",
      requested_amount: null,
      date_range: null,
    });
  });

  it("clasifica deudas y prestamos como resumen read-only", () => {
    const query = classifyConversationQuery({
      text: "cuanto le debo a Luis?",
      receivedAt: "2026-07-15T12:00:00.000Z",
      timezone: "America/Lima",
    });

    expect(query).toMatchObject({
      kind: "debt_summary",
      requested_amount: null,
      date_range: null,
    });
  });

  it("clasifica pagos que vienen con rango mensual", () => {
    const query = classifyConversationQuery({
      text: "que pagos vienen este mes?",
      receivedAt: "2026-07-15T12:00:00.000Z",
      timezone: "America/Lima",
    });

    expect(query).toMatchObject({
      kind: "recurring_summary",
      requested_amount: null,
      date_range: {
        label: "este mes",
      },
    });
  });

  it("clasifica preguntas sobre memoria financiera resumida", () => {
    const query = classifyConversationQuery({
      text: "que recuerdas de mis preferencias?",
      receivedAt: "2026-07-15T12:00:00.000Z",
      timezone: "America/Lima",
    });

    expect(query).toMatchObject({
      kind: "financial_memory_search",
      requested_amount: null,
      date_range: null,
    });
  });

  it("clasifica memoria amplia y patrones sin tratarlo como registro", () => {
    const query = classifyConversationQuery({
      text: "que sabes de mi forma de gastar?",
      receivedAt: "2026-07-15T12:00:00.000Z",
      timezone: "America/Lima",
    });

    expect(query).toMatchObject({
      kind: "financial_memory_search",
      requested_amount: null,
      date_range: null,
    });
  });

  it("no trata referencias colgantes como busqueda si no hay memoria activa", () => {
    const query = classifyConversationQuery({
      text: "me puedes decir la hora de cada uno?",
      receivedAt: "2026-07-15T12:00:00.000Z",
      timezone: "America/Lima",
    });

    expect(query).toMatchObject({
      kind: "unsupported",
      requested_amount: null,
      date_range: null,
    });
  });

  it("resuelve preguntas historicas sobre pagos recurrentes como memoria de movimientos", () => {
    const query = classifyConversationQuery({
      text: "cuando fue la ultima vez que pague Netflix?",
      receivedAt: "2026-07-15T12:00:00.000Z",
      timezone: "America/Lima",
    });

    expect(query).toMatchObject({
      kind: "movement_search",
      requested_amount: null,
      date_range: null,
    });
    expect(query.confidence).toBeGreaterThanOrEqual(0.78);
  });

  it("resuelve busquedas semanticas de movimientos sin depender de categoria exacta", () => {
    const query = classifyConversationQuery({
      text: "que gastos hice el dia que fui al medico?",
      receivedAt: "2026-07-15T12:00:00.000Z",
      timezone: "America/Lima",
    });

    expect(query).toMatchObject({
      kind: "movement_search",
      requested_amount: null,
      date_range: null,
    });
  });

  it("clasifica reconstrucciones financieras como busquedas prudentes", () => {
    const query = classifyConversationQuery({
      text: "creo que ayer gaste en taxi y comida pero no recuerdo cuanto",
      receivedAt: "2026-07-15T12:00:00.000Z",
      timezone: "America/Lima",
    });

    expect(query).toMatchObject({
      kind: "movement_search",
      requested_amount: null,
      date_range: {
        label: "ayer",
      },
    });
  });

  it("resuelve referencias cortas usando memoria conversacional activa", () => {
    const query = classifyConversationQuery({
      text: "y la hora?",
      receivedAt: "2026-07-15T12:00:00.000Z",
      timezone: "America/Lima",
      activeState: {
        last_query_kind: "movement_search",
        last_query_date_range: {
          start: "2026-07-15T00:00:00.000-05:00",
          end: "2026-07-15T23:59:59.999-05:00",
          label: "hoy",
        },
        referenced_movements: [
          {
            id: "mov-1",
            type: "gasto",
            amount: 8,
            currency: "PEN",
            description: "Cafe",
            category_id: "alimentacion",
            occurred_at: "2026-07-15T09:30:00.000-05:00",
          },
        ],
        continuity_hint: "El usuario puede referirse a 1 movimiento de hoy.",
      },
    });

    expect(query).toMatchObject({
      kind: "movement_search",
      date_range: {
        label: "hoy",
      },
      confidence: 0.88,
    });
  });

  it("resuelve referencias a un movimiento mencionado en la respuesta anterior", () => {
    const query = classifyConversationQuery({
      text: "y el detalle del taxi?",
      receivedAt: "2026-07-15T12:00:00.000Z",
      timezone: "America/Lima",
      activeState: {
        last_query_kind: "movement_search",
        last_query_date_range: {
          start: "2026-07-15T00:00:00.000-05:00",
          end: "2026-07-15T23:59:59.999-05:00",
          label: "hoy",
        },
        referenced_movements: [
          {
            id: "mov-1",
            type: "gasto",
            amount: 15,
            currency: "PEN",
            description: "Taxi",
            category_id: "transporte",
            occurred_at: "2026-07-15T11:15:00.000-05:00",
          },
        ],
        continuity_hint: "El usuario puede referirse a 1 movimiento de hoy.",
      },
    });

    expect(query).toMatchObject({
      kind: "movement_search",
      date_range: {
        label: "hoy",
      },
      confidence: 0.88,
    });
  });

  it("resuelve referencias ordinales sobre resultados anteriores", () => {
    const query = classifyConversationQuery({
      text: "el primero en que cuenta fue?",
      receivedAt: "2026-07-15T12:00:00.000Z",
      timezone: "America/Lima",
      activeState: {
        last_query_kind: "movement_search",
        last_query_date_range: {
          start: "2026-07-15T00:00:00.000-05:00",
          end: "2026-07-15T23:59:59.999-05:00",
          label: "hoy",
        },
        referenced_movements: [
          {
            id: "mov-1",
            type: "gasto",
            amount: 15,
            currency: "PEN",
            description: "Taxi",
            category_id: "transporte",
            occurred_at: "2026-07-15T11:15:00.000-05:00",
          },
        ],
        continuity_hint: "El usuario puede referirse a 1 movimiento de hoy.",
      },
    });

    expect(query).toMatchObject({
      kind: "movement_search",
      date_range: {
        label: "hoy",
      },
      confidence: 0.88,
    });
  });

  it("mantiene continuidad sobre deudas usando entidades referenciadas", () => {
    const query = classifyConversationQuery({
      text: "y cuando vence?",
      receivedAt: "2026-07-15T12:00:00.000Z",
      timezone: "America/Lima",
      activeState: {
        last_query_kind: "debt_summary",
        last_query_date_range: null,
        referenced_movements: [],
        referenced_entities: [
          {
            type: "debt",
            id: "debt-1",
            name: "Prestamo Luis",
            person_name: "Luis",
          },
        ],
        continuity_hint:
          "El usuario puede referirse a 1 deuda, cuota o persona mencionada.",
      },
    });

    expect(query).toMatchObject({
      kind: "debt_summary",
      confidence: 0.88,
    });
  });

  it("permite cambiar de periodo aunque haya memoria activa", () => {
    const query = classifyConversationQuery({
      text: "y ayer que gaste?",
      receivedAt: "2026-07-15T12:00:00.000Z",
      timezone: "America/Lima",
      activeState: {
        last_query_kind: "movement_search",
        last_query_date_range: {
          start: "2026-07-15T00:00:00.000-05:00",
          end: "2026-07-15T23:59:59.999-05:00",
          label: "hoy",
        },
        referenced_movements: [
          {
            id: "mov-1",
            type: "gasto",
            amount: 15,
            currency: "PEN",
            description: "Taxi",
            category_id: "transporte",
            occurred_at: "2026-07-15T11:15:00.000-05:00",
          },
        ],
        continuity_hint: "El usuario puede referirse a 1 movimiento de hoy.",
      },
    });

    expect(query).toMatchObject({
      kind: "movement_search",
      date_range: {
        label: "ayer",
      },
    });
  });
});
