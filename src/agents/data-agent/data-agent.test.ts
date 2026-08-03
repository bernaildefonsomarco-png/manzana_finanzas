import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DataAgent } from "./data-agent";
import type { DataAgentOutput, DataContextPack } from "./types";

const baseContext: DataContextPack = {
  context_pack_type: "data_context",
  version: "v2",
  user_id: "00000000-0000-4000-8000-000000000001",
  locale: "es-PE",
  timezone: "America/Lima",
  discreet_mode: false,
  preferences_summary: {},
  risk_context: {},
  original_message: "gaste 8 cafe",
  received_at: "2026-06-08T12:00:00.000Z",
  categories: [
    { id: "alimentacion", label: "Alimentacion", is_sensitive: false },
    { id: "transporte", label: "Transporte", is_sensitive: false },
  ],
  accounts: [],
  boxes: [],
  subcategories: [],
  tags: [],
  related_people: [],
  recent_movements: [],
  recent_corrections: [],
  learned_vocabulary: [],
};

const activeDebts: NonNullable<DataContextPack["active_debts"]> = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Prestamo QA c46eca11",
    direction: "i_owe",
    status: "active",
    current_balance: 100,
    currency: "PEN",
    due_date: "2026-07-22",
    next_payment_date: "2026-07-22",
    related_person_id: "20000000-0000-4000-8000-000000000001",
    related_person_name: "Pedro QA c46eca11",
    related_person_aliases: [],
    installments: [
      {
        id: "30000000-0000-4000-8000-000000000001",
        number: 1,
        due_date: "2026-07-22",
        expected_amount: 50,
        paid_amount: 0,
        status: "pending",
      },
      {
        id: "30000000-0000-4000-8000-000000000002",
        number: 2,
        due_date: "2026-08-22",
        expected_amount: 50,
        paid_amount: 0,
        status: "pending",
      },
    ],
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    name: "Tarjeta QA c46eca11",
    direction: "i_owe",
    status: "active",
    current_balance: 60,
    currency: "PEN",
    due_date: "2026-07-22",
    next_payment_date: "2026-07-22",
    related_person_id: "20000000-0000-4000-8000-000000000001",
    related_person_name: "Pedro QA c46eca11",
    related_person_aliases: [],
    installments: [],
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    name: "Dolares QA c46eca11",
    direction: "i_owe",
    status: "active",
    current_balance: 40,
    currency: "USD",
    due_date: "2026-07-22",
    next_payment_date: "2026-07-22",
    related_person_id: "20000000-0000-4000-8000-000000000002",
    related_person_name: "Dollar QA c46eca11",
    related_person_aliases: [],
    installments: [],
  },
];

describe("DataAgent", () => {
  beforeEach(() => {
    delete process.env.AGENT_RUNTIME_DATA_AGENT_PROVIDER;
    delete process.env.AGENT_RUNTIME_API_KIND;
    delete process.env.AGENT_RUNTIME_API_URL;
    delete process.env.AGENT_RUNTIME_API_MODEL;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    delete process.env.AGENT_RUNTIME_DATA_AGENT_PROVIDER;
    delete process.env.AGENT_RUNTIME_API_KIND;
    delete process.env.AGENT_RUNTIME_API_URL;
    delete process.env.AGENT_RUNTIME_API_MODEL;
    delete process.env.OPENAI_API_KEY;
  });

  it("extrae un gasto simple sin escribir Core", async () => {
    const result = await new DataAgent().extract(baseContext, "trace-1");

    expect(result.output).toMatchObject({
      intent: "record_movement",
      requires_confirmation: false,
      result: [
        {
          movement_type: "gasto",
          amount: 8,
          currency: "PEN",
          description: "cafe",
          category_id: "alimentacion",
          account_origin_id: null,
        },
      ],
    });
    expect(result.runtime.provider).toBe("local_fixture");
    expect(result.safety.policy_flags).toContain("local_fixture_not_production_llm");
  });

  it.each([
    ["Hice un gasto de 20 soles comprando desayuno", 20, "desayuno"],
    ["Registra 20 en desayuno", 20, "desayuno"],
    ["Compre desayuno por 20", 20, "desayuno"],
    ["Me salio 15 el taxi", 15, "taxi"],
    ["Anota 8 cafe", 8, "cafe"],
  ])(
    "entiende captura financiera natural: %s",
    async (message, amount, description) => {
      const result = await new DataAgent().extract(
        {
          ...baseContext,
          original_message: message,
        },
        "trace-natural-capture"
      );

      expect(result.output).toMatchObject({
        intent: "record_movement",
        requires_confirmation: false,
        result: [
          {
            movement_type: "gasto",
            amount,
            description,
            account_origin_id: null,
          },
        ],
      });
      expect(result.output.confidence).toBeGreaterThanOrEqual(0.85);
    }
  );

  it("completa un borrador de pago de deuda cuando el siguiente turno aporta el monto", async () => {
    const draftOutput: DataAgentOutput = {
      intent: "record_movement",
      confidence: 0.9,
      result: [
        {
          action_id: "action_1",
          command_id: null,
          movement_type: "pago_deuda",
          amount: null,
          currency: "PEN",
          occurred_at: null,
          description: "primera cuota de Pedro",
          category_id: null,
          subcategory_id: null,
          tags: [],
          account_origin_id: null,
          account_destination_id: null,
          box_origin_id: null,
          box_destination_id: null,
          debt_hint: { person_name: "Pedro" },
          recurring_hint: null,
          related_person_hint: { display_name: "Pedro" },
          source_evidence: [
            {
              field: "debt_reference",
              value: "primera cuota de Pedro",
              source: "user_text",
            },
          ],
          confidence: 0.9,
        },
      ],
      ambiguities: [
        {
          field: "amount",
          reason: "Falta el monto del pago.",
          scope: "financial_action",
          action_id: "action_1",
          question: "Cuanto pagaste?",
          risk_level: "medium",
        },
      ],
      requires_confirmation: true,
      evidence_signals: [],
      safe_explanation: "Falta el monto del pago.",
    };

    const result = await new DataAgent().extract(
      {
        ...baseContext,
        original_message: "30 soles por la primera cuota de Pedro",
        active_capture_draft: {
          state_id: "draft-1",
          reason: "financial_action_blocked",
          original_message: "quiero registrar el pago de la primera cuota",
          created_at: "2026-07-16T15:45:00.000Z",
          data_agent_output: draftOutput,
          financial_plan: {
            kind: "blocked",
            reason: "missing_amount",
            blocked_reasons: ["missing_amount"],
            proposed_actions_count: 1,
          },
        },
      },
      "trace-debt-payment-draft"
    );

    expect(result.output.intent).toBe("record_movement");
    expect(result.output.result).toMatchObject([
      {
        movement_type: "pago_deuda",
        amount: 30,
        description: "primera cuota de Pedro",
        debt_hint: { person_name: "Pedro" },
      },
    ]);
    expect(result.output.ambiguities).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "amount" })])
    );
  });

  it("interpreta un prestamo personal como borrador de deuda y pregunta solo la primera fecha", async () => {
    const result = await new DataAgent().extract(
      {
        ...baseContext,
        original_message:
          "Juan me presto 100 soles, le voy a pagar en 5 cuotas",
        received_at: "2026-07-24T12:00:00.000Z",
      },
      "trace-debt-creation-draft",
    );

    expect(result.output).toMatchObject({
      intent: "record_movement",
      requires_confirmation: true,
      result: [
        {
          movement_type: "prestamo_recibido",
          amount: 100,
          currency: "PEN",
          occurred_at: null,
          account_destination_id: null,
          debt_hint: {
            operation: "create_debt",
            direction: "i_owe",
            kind: "personal",
            person_name: "Juan",
            installment_count: 5,
            installment_amount: 20,
            first_due_date: null,
          },
        },
      ],
      ambiguities: [
        {
          field: "first_due_date",
          action_id: "action_1",
          question: "Cuando vence la primera cuota?",
        },
      ],
    });
    expect(result.output.ambiguities).toHaveLength(1);
  });

  it("completa la primera fecha de una deuda sin inventar cuenta ni crearla", async () => {
    const initial = await new DataAgent().extract(
      {
        ...baseContext,
        original_message:
          "Juan me presto 100 soles, le voy a pagar en 5 cuotas",
        received_at: "2026-07-24T12:00:00.000Z",
      },
      "trace-debt-creation-initial",
    );
    const result = await new DataAgent().extract(
      {
        ...baseContext,
        original_message: "el 30 de julio",
        received_at: "2026-07-24T12:01:00.000Z",
        active_capture_draft: {
          state_id: "draft-debt-1",
          reason: "financial_action_blocked",
          original_message:
            "Juan me presto 100 soles, le voy a pagar en 5 cuotas",
          created_at: "2026-07-24T12:00:00.000Z",
          data_agent_output: initial.output,
          financial_plan: {
            kind: "blocked",
            reason: "all_actions_blocked",
            blocked_reasons: ["debt_creation_first_due_date_missing"],
            proposed_actions_count: 1,
          },
        },
      },
      "trace-debt-creation-completed",
    );

    expect(result.output.result[0]).toMatchObject({
      movement_type: "prestamo_recibido",
      amount: 100,
      account_destination_id: null,
      debt_hint: {
        operation: "create_debt",
        first_due_date: "2026-07-30",
        installment_count: 5,
      },
    });
    expect(result.output.ambiguities).toHaveLength(0);
    expect(result.output.requires_confirmation).toBe(true);
    expect(result.output.safe_explanation).toContain("requiere confirmacion");
  });

  it("preserva pago_deuda en el fallback local cuando coincide una deuda activa", async () => {
    const result = await new DataAgent().extract(
      {
        ...baseContext,
        original_message:
          "Pago nuevo independiente: pague 110 soles de Prestamo QA c46eca11",
        active_debts: activeDebts,
      },
      "trace-local-debt-overpayment"
    );

    expect(result.runtime.provider).toBe("local_fixture");
    expect(result.output).toMatchObject({
      intent: "record_movement",
      requires_confirmation: false,
      result: [
        {
          movement_type: "pago_deuda",
          amount: 110,
          currency: "PEN",
          debt_hint: {
            debt_id: "10000000-0000-4000-8000-000000000001",
            debt_name: "Prestamo QA c46eca11",
          },
        },
      ],
    });
    expect(result.output.result[0]?.movement_type).not.toBe("gasto");
  });

  it("deja al Core bloquear una referencia personal ambigua sin degradarla a gasto", async () => {
    const result = await new DataAgent().extract(
      {
        ...baseContext,
        original_message: "Pague 10 soles a Pedro QA c46eca11",
        active_debts: activeDebts,
      },
      "trace-local-debt-ambiguous"
    );

    expect(result.output.result).toMatchObject([
      {
        movement_type: "pago_deuda",
        amount: 10,
        debt_hint: { person_name: "Pedro QA c46eca11" },
      },
    ]);
  });

  it("conserva moneda explicita y cuota al proponer el pago especializado", async () => {
    const currencyMismatch = await new DataAgent().extract(
      {
        ...baseContext,
        original_message: "Pague 10 soles de Dolares QA c46eca11",
        active_debts: activeDebts,
      },
      "trace-local-debt-currency"
    );
    const installment = await new DataAgent().extract(
      {
        ...baseContext,
        original_message:
          "Pague 30 soles de la primera cuota de Prestamo QA c46eca11",
        active_debts: activeDebts,
      },
      "trace-local-debt-installment"
    );

    expect(currencyMismatch.output.result[0]).toMatchObject({
      movement_type: "pago_deuda",
      amount: 10,
      currency: "PEN",
      debt_hint: {
        debt_id: "10000000-0000-4000-8000-000000000003",
      },
    });
    expect(installment.output.result[0]).toMatchObject({
      movement_type: "pago_deuda",
      amount: 30,
      debt_hint: {
        installment_id: "30000000-0000-4000-8000-000000000001",
        installment_number: 1,
      },
    });
  });

  it("no convierte una referencia de deuda desconocida en movimiento generico", async () => {
    const result = await new DataAgent().extract(
      {
        ...baseContext,
        original_message: "Pague 20 soles de un prestamo desconocido",
        active_debts: activeDebts,
      },
      "trace-local-debt-unknown"
    );

    expect(result.output.intent).toBe("unknown");
    expect(result.output.result).toHaveLength(0);
    expect(result.output.safe_explanation).toContain("movimiento generico");
  });

  it("no convierte una consulta con monto en registro financiero", async () => {
    const result = await new DataAgent().extract(
      {
        ...baseContext,
        original_message: "puedo gastar 50 hoy?",
      },
      "trace-question-with-amount"
    );

    expect(result.output.intent).toBe("conversation");
    expect(result.output.requires_confirmation).toBe(true);
    expect(result.output.result).toHaveLength(0);
  });

  it("puede pedirse por API y caer a fixture local si el endpoint no esta configurado", async () => {
    process.env.AGENT_RUNTIME_DATA_AGENT_PROVIDER = "api";
    delete process.env.AGENT_RUNTIME_API_URL;

    const result = await new DataAgent().extract(baseContext, "trace-api");

    expect(result.runtime.provider).toBe("local_fixture");
    expect(result.safety.policy_flags).toContain("runtime_fallback_from_api");
  });

  it("cae a fixture local si OpenAI API esta elegida pero falta modelo", async () => {
    process.env.AGENT_RUNTIME_DATA_AGENT_PROVIDER = "api";
    process.env.AGENT_RUNTIME_API_KIND = "openai";
    process.env.OPENAI_API_KEY = "sk-test";
    delete process.env.AGENT_RUNTIME_API_MODEL;

    const result = await new DataAgent().extract(baseContext, "trace-openai");

    expect(result.runtime.provider).toBe("local_fixture");
    expect(result.safety.policy_flags).toContain("runtime_fallback_from_api");
    expect(result.safety.policy_flags).toContain(
      "runtime_fallback_reason_RUNTIME_PROVIDER_UNAVAILABLE"
    );

  });

  it("extrae multiples movimientos en un solo mensaje", async () => {
    const result = await new DataAgent().extract(
      {
        ...baseContext,
        original_message: "Hoy gaste 8 cafe, 15 taxi y 20 almuerzo",
      },
      "trace-2"
    );

    expect(result.output.intent).toBe("record_multiple_movements");
    expect(result.output.result).toHaveLength(3);
    expect(result.output.result.map((action) => action.amount)).toEqual([
      8,
      15,
      20,
    ]);
    expect(result.output.result.map((action) => action.category_id)).toEqual([
      "alimentacion",
      "transporte",
      "alimentacion",
    ]);
  });

  it("devuelve ambiguedad si no hay evidencia suficiente", async () => {
    const result = await new DataAgent().extract(
      {
        ...baseContext,
        original_message: "creo que ayer gaste en taxi pero no recuerdo cuanto",
      },
      "trace-3"
    );

    expect(result.output.intent).toBe("unknown");
    expect(result.output.requires_confirmation).toBe(true);
    expect(result.output.result).toHaveLength(0);
    expect(result.output.ambiguities[0]?.field).toBe("intent");
  });
});
