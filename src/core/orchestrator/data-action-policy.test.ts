import { describe, expect, it } from "vitest";
import type { DataAgentOutput, ProposedAction } from "@/agents/data-agent";
import { planDataAgentFinancialActions } from "./data-action-policy";

const accountId = "00000000-0000-4000-8000-0000000000aa";

const categories = [
  { id: "alimentacion" as const, is_sensitive: false },
  { id: "salud" as const, is_sensitive: true },
];

function action(overrides: Partial<ProposedAction> = {}): ProposedAction {
  return {
    action_id: "action_1",
    command_id: null,
    movement_type: "gasto",
    amount: 8,
    currency: "PEN",
    occurred_at: "2026-06-08T10:00:00.000-05:00",
    description: "cafe",
    category_id: "alimentacion",
    subcategory_id: null,
    tags: [],
    account_origin_id: null,
    account_destination_id: null,
    box_origin_id: null,
    box_destination_id: null,
    debt_hint: null,
    recurring_hint: null,
    related_person_hint: null,
    source_evidence: [
      {
        field: "amount_description",
        value: "8 cafe",
        source: "user_text",
      },
    ],
    confidence: 0.98,
    ...overrides,
  };
}

function output(overrides: Partial<DataAgentOutput> = {}): DataAgentOutput {
  return {
    intent: "record_movement",
    confidence: 0.98,
    result: [action()],
    ambiguities: [],
    requires_confirmation: false,
    evidence_signals: [],
    safe_explanation: "Se detecto un movimiento.",
    ...overrides,
  };
}

function plan(
  params: Partial<Parameters<typeof planDataAgentFinancialActions>[0]> = {},
) {
  return planDataAgentFinancialActions({
    dataAgentOutput: output(),
    accounts: [{ id: accountId, is_default: true, name: "Cuenta principal" }],
    categories,
    sourceRef: "whatsapp:external-event-1",
    receivedAt: "2026-06-08T10:00:00.000-05:00",
    channel: "whatsapp",
    ...params,
  });
}

describe("planDataAgentFinancialActions", () => {
  it("deja listo para Core un gasto claro y con cuenta resuelta", () => {
    const result = plan();

    expect(result.kind).toBe("ready_for_core");
    expect(result.ready_count).toBe(1);
    expect(result.actions[0].decision).toBe("ready_for_core");
    expect(result.actions[0].movement_input?.account_origin_id).toBe(accountId);
    expect(result.actions[0].movement_input?.source).toBe("whatsapp");
    expect(result.actions[0].movement_input?.requires_review).toBe(false);
  });

  it("deja listo para Core un gasto claro aunque no tenga cuenta", () => {
    const result = plan({ accounts: [] });

    expect(result.kind).toBe("ready_for_core");
    expect(result.actions[0].decision).toBe("ready_for_core");
    expect(result.actions[0].reasons).toContain("account_origin_null_allowed");
    expect(result.actions[0].movement_input?.account_origin_id).toBeNull();
    expect(result.actions[0].movement_input?.requires_review).toBe(false);
  });

  it("deja listo para Core un ingreso claro aunque no tenga cuenta", () => {
    const result = plan({
      accounts: [],
      dataAgentOutput: output({
        result: [
          action({
            movement_type: "ingreso",
            account_origin_id: null,
            account_destination_id: null,
            description: "pago recibido",
          }),
        ],
      }),
    });

    expect(result.kind).toBe("ready_for_core");
    expect(result.actions[0].decision).toBe("ready_for_core");
    expect(result.actions[0].reasons).toContain(
      "account_destination_null_allowed",
    );
    expect(result.actions[0].movement_input?.account_destination_id).toBeNull();
    expect(result.actions[0].movement_input?.requires_review).toBe(false);
  });

  it("bloquea una cuenta explicitamente invalida", () => {
    const result = plan({
      dataAgentOutput: output({
        result: [
          action({
            account_origin_id: "00000000-0000-4000-8000-0000000000ff",
          }),
        ],
      }),
    });

    expect(result.kind).toBe("blocked");
    expect(result.actions[0].decision).toBe("blocked");
    expect(result.actions[0].reasons).toContain("account_origin_not_found");
    expect(result.actions[0].movement_input).toBeNull();
  });

  it("pide confirmacion cuando el DataAgent declara ambiguedad", () => {
    const result = plan({
      dataAgentOutput: output({
        requires_confirmation: true,
        ambiguities: [
          {
            field: "category_id",
            reason: "Categoria dudosa",
            risk_level: "low",
          },
        ],
      }),
    });

    expect(result.kind).toBe("requires_confirmation");
    expect(result.actions[0].reasons).toContain(
      "agent_output_requires_confirmation",
    );
    expect(result.actions[0].movement_input?.requires_review).toBe(true);
    expect(result.actions[0].movement_input?.metadata.policy_reasons).toContain(
      "agent_output_requires_confirmation",
    );
  });

  it("no bloquea una accion clara por dudas de cuenta opcional o consulta adicional", () => {
    const result = plan({
      accounts: [],
      dataAgentOutput: output({
        requires_confirmation: false,
        ambiguities: [
          {
            field: "account_origin_id",
            reason: "No se indico cuenta.",
            scope: "financial_action",
            action_id: "action_1",
            risk_level: "low",
          },
          {
            field: "weekly_summary",
            reason: "El resumen requiere una consulta read-only.",
            scope: "conversation_follow_up",
            action_id: null,
            risk_level: "low",
          },
        ],
      }),
    });

    expect(result.kind).toBe("ready_for_core");
    expect(result.actions[0].decision).toBe("ready_for_core");
    expect(result.actions[0].reasons).toContain("account_origin_null_allowed");
  });

  it("mantiene la confirmacion para una ambiguedad que afecta la categoria", () => {
    const result = plan({
      dataAgentOutput: output({
        requires_confirmation: true,
        ambiguities: [
          {
            field: "category_id",
            reason: "Puede ser alimentacion u otros.",
            scope: "financial_action",
            action_id: "action_1",
            risk_level: "medium",
          },
        ],
      }),
    });

    expect(result.kind).toBe("requires_confirmation");
    expect(result.actions[0].decision).toBe("requires_confirmation");
  });

  it("decide cada accion por separado en un lote claro mas ambiguo", () => {
    const result = plan({
      dataAgentOutput: output({
        requires_confirmation: true,
        result: [
          action({
            action_id: "clear_breakfast",
            description: "desayuno",
            amount: 20,
            category_id: "alimentacion",
            confidence: 0.99,
          }),
          action({
            action_id: "ambiguous_second",
            description: "otra compra",
            amount: 15,
            category_id: null,
            confidence: 0.82,
          }),
        ],
        ambiguities: [
          {
            field: "category_id",
            reason: "Falta precisar la categoria de la segunda compra.",
            scope: "financial_action",
            action_id: "ambiguous_second",
            risk_level: "medium",
          },
        ],
      }),
    });

    expect(result).toMatchObject({
      kind: "requires_confirmation",
      ready_count: 1,
      requires_confirmation_count: 1,
      blocked_count: 0,
    });
    expect(result.actions).toEqual([
      expect.objectContaining({
        action_id: "clear_breakfast",
        decision: "ready_for_core",
      }),
      expect.objectContaining({
        action_id: "ambiguous_second",
        decision: "requires_confirmation",
      }),
    ]);
  });

  it("pide confirmacion para categorias sensibles", () => {
    const result = plan({
      dataAgentOutput: output({
        result: [
          action({
            category_id: "salud",
            description: "farmacia",
          }),
        ],
      }),
    });

    expect(result.kind).toBe("requires_confirmation");
    expect(result.actions[0].reasons).toContain("sensitive_category");
  });

  it("bloquea un pago de deuda sin referencia y no crea confirmacion generica", () => {
    const result = plan({
      dataAgentOutput: output({
        result: [
          action({
            movement_type: "pago_deuda",
            category_id: "deudas",
            description: "cuota tarjeta",
          }),
        ],
      }),
    });

    expect(result.kind).toBe("blocked");
    expect(result.actions[0].reasons).toContain(
      "debt_reference_missing",
    );
  });

  it("deja listo un pago cuando deuda, persona y cuota resuelven exactamente", () => {
    const result = plan({
      debts: [debtContext()],
      dataAgentOutput: output({
        result: [
          action({
            movement_type: "pago_deuda",
            amount: 30,
            currency: "PEN",
            category_id: null,
            description: "primera cuota de Pedro",
            debt_hint: {
              debt_id: debtId,
              person_name: "Pedro",
              installment_id: installmentId,
              installment_number: 1,
            },
          }),
        ],
      }),
    });

    expect(result.kind).toBe("ready_for_core");
    expect(result.actions[0].movement_input).toBeNull();
    expect(result.actions[0].debt_payment_input).toMatchObject({
      debt_id: debtId,
      debt_name: "Prestamo Pedro",
      amount: 30,
      installment_id: installmentId,
      installment_number: 1,
    });
  });

  it("ignora la cuenta sugerida si el usuario no la menciono", () => {
    const result = plan({
      debts: [debtContext()],
      sourceText: "Pague 10 soles de Dolares prueba",
      dataAgentOutput: output({
        result: [
          action({
            movement_type: "pago_deuda",
            amount: 30,
            category_id: null,
            description: "pago a Pedro",
            account_origin_id: accountId,
            debt_hint: { debt_id: debtId },
            source_evidence: [
              {
                field: "account_origin_id",
                value: "Cuenta principal",
                source: "user_text",
              },
            ],
          }),
        ],
      }),
    });

    expect(result.kind).toBe("ready_for_core");
    expect(result.actions[0].debt_payment_input?.account_id).toBeNull();
    expect(result.actions[0].reasons).toContain(
      "debt_payment_account_ignored_without_user_evidence",
    );
  });

  it("conserva la cuenta cuando existe evidencia explicita del usuario", () => {
    const result = plan({
      debts: [debtContext()],
      sourceText: "Pague 30 a Pedro desde mi cuenta principal",
      dataAgentOutput: output({
        result: [
          action({
            movement_type: "pago_deuda",
            amount: 30,
            category_id: null,
            description: "pago a Pedro desde mi cuenta principal",
            account_origin_id: accountId,
            debt_hint: { debt_id: debtId },
            source_evidence: [
              {
                field: "account_origin_id",
                value: "mi cuenta principal",
                source: "user_text",
              },
            ],
          }),
        ],
      }),
    });

    expect(result.kind).toBe("ready_for_core");
    expect(result.actions[0].debt_payment_input?.account_id).toBe(accountId);
    expect(result.actions[0].reasons).not.toContain(
      "debt_payment_account_ignored_without_user_evidence",
    );
  });

  it("bloquea una referencia de persona que coincide con varias deudas", () => {
    const result = plan({
      debts: [
        debtContext(),
        debtContext({
          id: "00000000-0000-4000-8000-0000000000d2",
          name: "Tarjeta Pedro",
          installments: [],
        }),
      ],
      dataAgentOutput: output({
        result: [
          action({
            movement_type: "pago_deuda",
            amount: 30,
            category_id: null,
            description: "pago a Pedro",
            debt_hint: { person_name: "Pedro" },
          }),
        ],
      }),
    });

    expect(result.kind).toBe("blocked");
    expect(result.actions[0].reasons).toContain("debt_reference_ambiguous");
  });

  it("bloquea un pago que supera el saldo conocido", () => {
    const result = plan({
      debts: [debtContext()],
      dataAgentOutput: output({
        result: [
          action({
            movement_type: "pago_deuda",
            amount: 101,
            category_id: null,
            description: "pago a Pedro",
            debt_hint: { debt_id: debtId },
          }),
        ],
      }),
    });

    expect(result.kind).toBe("blocked");
    expect(result.actions[0].reasons).toContain(
      "debt_payment_exceeds_balance",
    );
  });

  it("no bloquea un pago exacto solo porque deuda sea dato sensible", () => {
    const result = plan({
      debts: [debtContext()],
      riskAssessments: [
        {
          action_id: "action_1",
          semantic_level: "sensitive",
          signals: ["sensitive_category"],
          confidence: 0.99,
          requires_confirmation_advisory: true,
          safe_explanation: "La deuda es informacion sensible.",
        },
      ],
      dataAgentOutput: output({
        result: [
          action({
            movement_type: "pago_deuda",
            amount: 30,
            category_id: null,
            description: "pago a Pedro",
            debt_hint: { debt_id: debtId },
          }),
        ],
      }),
    });

    expect(result.kind).toBe("ready_for_core");
    expect(result.actions[0].reasons).toContain("debt_payment_sensitive_data");
    expect(result.actions[0].reasons).not.toContain(
      "semantic_confirmation_advisory",
    );
  });

  it("no convierte una sugerencia semantica en una regla recurrente", () => {
    const result = plan({
      dataAgentOutput: output({
        result: [
          action({
            description: "Netflix",
            category_id: "servicios_suscripciones",
            recurring_hint: {
              frequency: "monthly",
              source: "agent_inference",
            },
          }),
        ],
      }),
    });

    expect(result.kind).toBe("requires_confirmation");
    expect(result.actions[0].decision).toBe("requires_confirmation");
    expect(result.actions[0].reasons).toContain(
      "recurring_hint_requires_recurring_engine",
    );
    expect(result.actions[0].movement_input?.recurring_rule_id).toBeNull();
    expect(result.actions[0].movement_input?.recurring_occurrence_id).toBeNull();
  });

  it("bloquea una deuda en cuotas hasta conocer la fecha de la primera cuota", () => {
    const result = plan({
      accounts: [],
      dataAgentOutput: output({
        requires_confirmation: true,
        result: [
          action({
            movement_type: "prestamo_recibido",
            amount: 100,
            occurred_at: null,
            description: "Deuda con Juan",
            category_id: null,
            debt_hint: {
              operation: "create_debt",
              direction: "i_owe",
              kind: "personal",
              person_name: "Juan",
              installment_count: 5,
              installment_amount: 20,
              first_due_date: null,
            },
            related_person_hint: { display_name: "Juan" },
          }),
        ],
        ambiguities: [
          {
            field: "first_due_date",
            reason: "Falta la primera fecha.",
            scope: "financial_action",
            action_id: "action_1",
            risk_level: "medium",
          },
        ],
      }),
    });

    expect(result.kind).toBe("blocked");
    expect(result.actions[0]).toMatchObject({
      decision: "blocked",
      movement_input: null,
      debt_payment_input: null,
      debt_creation_input: null,
    });
    expect(result.actions[0].reasons).toEqual([
      "debt_creation_first_due_date_missing",
    ]);
  });

  it("mantiene como borrador tipado una deuda completa hasta confirmacion humana", () => {
    const result = plan({
      accounts: [],
      receivedAt: "2026-07-24T12:00:00.000-05:00",
      dataAgentOutput: output({
        requires_confirmation: true,
        result: [
          action({
            movement_type: "prestamo_recibido",
            amount: 100,
            occurred_at: null,
            description: "Deuda con Juan",
            category_id: null,
            debt_hint: {
              operation: "create_debt",
              direction: "i_owe",
              kind: "personal",
              debt_name: "Deuda con Juan",
              person_name: "Juan",
              installment_count: 5,
              installment_amount: 20,
              first_due_date: "2026-07-30",
            },
            related_person_hint: { display_name: "Juan" },
          }),
        ],
        ambiguities: [],
      }),
    });

    expect(result.kind).toBe("blocked");
    expect(result.actions[0]).toMatchObject({
      decision: "blocked",
      reasons: ["debt_creation_confirmation_required"],
      movement_input: null,
      debt_payment_input: null,
      debt_creation_input: {
        direction: "i_owe",
        kind: "personal",
        name: "Deuda con Juan",
        related_person_name: "Juan",
        principal_amount: 100,
        opened_at: "2026-07-24",
        first_due_date: "2026-07-30",
        installment_count: 5,
        installment_amount: 20,
        account_id: null,
        movement_type: "prestamo_recibido",
      },
    });
  });

  it("solo despues de confirmacion entrega la deuda al comando especializado", () => {
    const result = plan({
      accounts: [],
      confirmedByUser: true,
      receivedAt: "2026-07-24T12:00:00.000-05:00",
      dataAgentOutput: output({
        requires_confirmation: true,
        result: [
          action({
            movement_type: "prestamo_recibido",
            amount: 100,
            occurred_at: null,
            description: "Deuda con Juan",
            category_id: null,
            debt_hint: {
              operation: "create_debt",
              direction: "i_owe",
              kind: "personal",
              person_name: "Juan",
              installment_count: 5,
              installment_amount: 20,
              first_due_date: "2026-07-30",
            },
            related_person_hint: { display_name: "Juan" },
          }),
        ],
        ambiguities: [],
      }),
    });

    expect(result.kind).toBe("ready_for_core");
    expect(result.actions[0]).toMatchObject({
      decision: "ready_for_core",
      reasons: [
        "safe_specialized_debt_creation",
        "user_confirmation_evidenced",
        "confirmation_consumed_by_debt_creation_policy",
      ],
      movement_input: null,
      debt_payment_input: null,
      debt_creation_input: {
        direction: "i_owe",
        principal_amount: 100,
        first_due_date: "2026-07-30",
        installment_count: 5,
      },
    });
  });

  it("no acciona si el DataAgent no propone movimientos", () => {
    const result = plan({
      dataAgentOutput: output({
        intent: "conversation",
        confidence: 0.2,
        result: [],
        requires_confirmation: true,
      }),
    });

    expect(result.kind).toBe("no_action");
    expect(result.actions).toEqual([]);
  });
});

const debtId = "00000000-0000-4000-8000-0000000000d1";
const installmentId = "00000000-0000-4000-8000-0000000000e1";

function debtContext(
  overrides: Partial<
    NonNullable<
      Parameters<typeof planDataAgentFinancialActions>[0]["debts"]
    >[number]
  > = {},
) {
  return {
    id: debtId,
    name: "Prestamo Pedro",
    direction: "i_owe" as const,
    status: "active" as const,
    current_balance: 100,
    currency: "PEN" as const,
    due_date: "2026-08-01",
    next_payment_date: "2026-08-01",
    related_person_id: "00000000-0000-4000-8000-0000000000f1",
    related_person_name: "Pedro",
    related_person_aliases: ["Pedrito"],
    installments: [
      {
        id: installmentId,
        number: 1,
        due_date: "2026-08-01",
        expected_amount: 50,
        paid_amount: 0,
        status: "pending" as const,
      },
    ],
    ...overrides,
  };
}
