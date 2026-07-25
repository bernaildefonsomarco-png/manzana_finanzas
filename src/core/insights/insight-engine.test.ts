import { describe, expect, it } from "vitest";
import { buildAdvancedInsightDrafts } from "./insight-engine";
import type {
  Account,
  Box,
  Debt,
  DebtPayment,
  Movement,
  MovementTag,
  RecurringCandidate,
  Tag,
} from "@/shared/types/domain";

const now = new Date("2026-07-18T17:00:00.000Z");

describe("buildAdvancedInsightDrafts", () => {
  it("no inventa insights con menos de cinco movimientos confirmados", () => {
    const drafts = buildAdvancedInsightDrafts({
      movements: [1, 2, 3, 4].map((day) => movement(day, 10, "alimentacion")),
      now,
    });

    expect(drafts).toEqual([]);
  });

  it("crea el primer learning_progress seguro al llegar a cinco", () => {
    const drafts = buildAdvancedInsightDrafts({
      movements: [1, 2, 3, 4, 5].map((day) =>
        movement(day, 10, day % 2 ? "alimentacion" : "transporte", {
          account_origin_id: "account-1",
        }),
      ),
      now,
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      type: "learning_progress",
      fingerprint: "learning_progress:first_value",
      riskLevel: "low",
    });
    expect(drafts[0].evidence).toMatchObject({ movement_count: 5 });
  });

  it("detecta concentracion solo con evidencia suficiente", () => {
    const movements = [
      ...Array.from({ length: 7 }, (_, index) =>
        movement(10 + index, 20, "alimentacion", { account_origin_id: "a" }),
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        movement(10 + index, 10, "transporte", { account_origin_id: "a" }),
      ),
    ];

    const drafts = buildAdvancedInsightDrafts({ movements, now });
    const concentration = drafts.find(
      (draft) => draft.type === "category_concentration",
    );

    expect(concentration).toBeDefined();
    expect(concentration?.sourceFacts).toMatchObject({
      category_id: "alimentacion",
      category_amount: 140,
      total_amount: 170,
    });
    expect(drafts.some((draft) => draft.type === "learning_progress")).toBe(false);
  });

  it("genera refuerzo positivo con dos semanas comparables", () => {
    const current = Array.from({ length: 10 }, (_, index) =>
      movement(12 + (index % 7), 8, "alimentacion", { account_origin_id: "a" }),
    );
    const previous = Array.from({ length: 10 }, (_, index) =>
      movement(5 + (index % 7), 14, "alimentacion", { account_origin_id: "a" }),
    );

    const drafts = buildAdvancedInsightDrafts({
      movements: [...current, ...previous],
      now,
    });
    const progress = drafts.find((draft) => draft.type === "progress");

    expect(progress).toBeDefined();
    expect(progress?.sourceFacts).toMatchObject({
      current_total: 80,
      baseline_total: 140,
      direction: "down",
    });
  });

  it("excluye transferencias y pendientes de los patrones de gasto", () => {
    const confirmedTransfers = Array.from({ length: 20 }, (_, index) =>
      movement(1 + (index % 18), 500, null, {
        type: "transferencia",
        account_origin_id: "a",
        account_destination_id: "b",
      }),
    );
    const pendingSpend = Array.from({ length: 20 }, (_, index) =>
      movement(1 + (index % 18), 100, "alimentacion", {
        status: "needs_review",
      }),
    );

    const drafts = buildAdvancedInsightDrafts({
      movements: [...confirmedTransfers, ...pendingSpend],
      now,
    });

    expect(
      drafts.some((draft) =>
        ["comparative", "category_concentration", "anomaly"].includes(draft.type),
      ),
    ).toBe(false);
  });

  it("da valor a un usuario que solo usa deudas", () => {
    const drafts = buildAdvancedInsightDrafts({
      movements: [],
      debts: [debt()],
      debtPayments: [debtPayment()],
      now,
    });

    expect(new Set(drafts.map((draft) => draft.type))).toEqual(
      new Set(["debt", "progress"]),
    );
    expect(drafts.find((draft) => draft.type === "progress")?.sourceFacts).toMatchObject({
      principal_amount: 100,
      paid_amount: 40,
      current_balance: 60,
      progress_percent: 40,
      payment_count: 1,
    });
    expect(
      drafts.some((draft) =>
        ["comparative", "category_concentration", "temporal_pattern", "anomaly"].includes(
          draft.type,
        ),
      ),
    ).toBe(false);
  });

  it("sugiere un recurrente sin crear la regla financiera", () => {
    const drafts = buildAdvancedInsightDrafts({
      movements: [],
      recurringCandidates: [recurringCandidate()],
      now,
    });
    const recurring = drafts.find((draft) => draft.type === "recurring");

    expect(recurring).toMatchObject({
      fingerprint: "recurring:candidate:recurring-candidate-1",
      action: {
        type: "confirm_recurring",
        target_view: "upcoming",
      },
    });
    expect(recurring?.sourceFacts).toMatchObject({
      display_name: "Netflix",
      movement_count: 3,
      inferred_amount: 44.9,
      inferred_frequency: "monthly",
      currency: "PEN",
    });
  });

  it("no afirma dinero libre sin una cuenta configurada", () => {
    const drafts = buildAdvancedInsightDrafts({
      movements: [],
      boxes: [box()],
      commitments: [
        {
          id: "commitment-1",
          title: "Internet",
          amount: 80,
          currency: "PEN",
          due_at: "2026-07-25",
          kind: "recurring",
          linked_box_id: null,
        },
      ],
      now,
    });

    expect(drafts.some((draft) => draft.type === "free_money")).toBe(false);
  });

  it("calcula dinero libre operativo y progreso de caja con hechos exactos", () => {
    const drafts = buildAdvancedInsightDrafts({
      movements: [],
      accounts: [account()],
      boxes: [box()],
      commitments: [
        {
          id: "commitment-1",
          title: "Internet",
          amount: 80,
          currency: "PEN",
          due_at: "2026-07-25",
          kind: "recurring",
          linked_box_id: null,
        },
      ],
      now,
    });
    const freeMoney = drafts.find((draft) => draft.type === "free_money");
    const boxProgress = drafts.find((draft) => draft.type === "box_saving");

    expect(freeMoney?.sourceFacts).toEqual({
      currency: "PEN",
      total_balance: 800,
      separated_in_boxes: 500,
      free_in_accounts: 300,
      upcoming_uncovered_commitments: 80,
      operational_free_money: 220,
    });
    expect(boxProgress?.sourceFacts).toMatchObject({
      box_name: "Emergencias",
      current_balance: 500,
      target_amount: 1000,
      progress_percent: 50,
      currency: "PEN",
    });
  });

  it("proyecta el cierre mensual solo con historia suficiente y origen confiable", () => {
    const historical = Array.from({ length: 20 }, (_, index) =>
      movement(1, 12, "alimentacion", {
        occurred_at: new Date(
          Date.UTC(2026, 4, 24 + Math.floor((index * 37) / 19), 15),
        ).toISOString(),
        account_origin_id: "account-1",
        affects_account_balance: true,
      }),
    );
    const current = Array.from({ length: 10 }, (_, index) =>
      movement(index === 9 ? 18 : 2 + index, 10, "alimentacion", {
        account_origin_id: "account-1",
        affects_account_balance: true,
      }),
    );

    const drafts = buildAdvancedInsightDrafts({
      movements: [...historical, ...current],
      accounts: [account()],
      activePendingCount: 0,
      now,
    });
    const projection = drafts.find((draft) => draft.type === "projection");

    expect(projection).toBeDefined();
    expect(projection?.sourceFacts).toMatchObject({
      currency: "PEN",
      current_spend: 100,
      historical_56_day_spend: 240,
      operational_free_money: 800,
    });
    expect(projection?.expiresAt).toBe("2026-07-19T17:00:00.000Z");
  });

  it("no proyecta si hay pendientes activos o gastos sin cuenta", () => {
    const movements = [
      movement(1, 20, "alimentacion", {
        occurred_at: "2026-05-24T15:00:00.000Z",
        account_origin_id: "account-1",
        affects_account_balance: true,
      }),
      ...Array.from({ length: 18 }, (_, index) =>
        movement(1, 10, "alimentacion", {
          occurred_at: new Date(Date.UTC(2026, 4, 26 + index * 2, 15)).toISOString(),
          account_origin_id: "account-1",
          affects_account_balance: true,
        }),
      ),
      ...Array.from({ length: 8 }, (_, index) =>
        movement(2 + index, 10, "alimentacion", {
          account_origin_id: "account-1",
          affects_account_balance: true,
        }),
      ),
    ];

    expect(
      buildAdvancedInsightDrafts({
        movements,
        accounts: [account()],
        activePendingCount: 2,
        now,
      }).some((draft) => draft.type === "projection"),
    ).toBe(false);

    movements[movements.length - 1] = {
      ...movements[movements.length - 1],
      account_origin_id: null,
    };
    expect(
      buildAdvancedInsightDrafts({
        movements,
        accounts: [account()],
        activePendingCount: 0,
        now,
      }).some((draft) => draft.type === "projection"),
    ).toBe(false);
  });

  it("encuentra contexto etiquetado sin convertirlo en diagnostico", () => {
    const contextualMovements = [
      ...Array.from({ length: 4 }, () =>
        movement(6, 15, "alimentacion", { account_origin_id: "account-1" }),
      ),
      ...Array.from({ length: 4 }, () =>
        movement(13, 15, "alimentacion", { account_origin_id: "account-1" }),
      ),
    ];
    const tag = contextualTag();
    const movementTags = contextualMovements.map(
      (item): MovementTag => ({
        movement_id: item.id,
        tag_id: tag.id,
        confidence: 0.9,
        source: "agent_suggested_user_confirmed",
        created_at: item.created_at,
        metadata: {},
      }),
    );

    const drafts = buildAdvancedInsightDrafts({
      movements: contextualMovements,
      movementTags,
      tags: [tag],
      now,
    });
    const contextual = drafts.find((draft) => draft.type === "contextual");

    expect(contextual).toBeDefined();
    expect(contextual?.body).toContain("no un diagnostico");
    expect(contextual?.sourceFacts).toMatchObject({
      tag_label: "Trabajo",
      movement_count: 8,
      top_weekday_label: "lunes",
    });
  });

  it("mantiene patrones temporales durante treinta dias", () => {
    const dates = [
      "2026-06-14",
      "2026-06-21",
      "2026-06-28",
      "2026-07-05",
      "2026-07-12",
    ];
    const movements = dates.flatMap((date) =>
      Array.from({ length: 8 }, () =>
        movement(1, 8, "alimentacion", {
          occurred_at: `${date}T15:00:00.000Z`,
          account_origin_id: "account-1",
        }),
      ),
    );

    const temporal = buildAdvancedInsightDrafts({ movements, now }).find(
      (draft) => draft.type === "temporal_pattern",
    );

    expect(temporal).toBeDefined();
    expect(temporal?.expiresAt).toBe("2026-08-17T17:00:00.000Z");
  });
});

let sequence = 0;

function movement(
  day: number,
  amount: number,
  categoryId: Movement["category_id"],
  overrides: Partial<Movement> = {},
): Movement {
  sequence += 1;
  return {
    id: `movement-${sequence}`,
    user_id: "11111111-1111-4111-8111-111111111111",
    type: "gasto",
    status: "confirmed",
    amount,
    currency: "PEN",
    occurred_at: `2026-07-${String(day).padStart(2, "0")}T15:00:00.000Z`,
    description: "Compra",
    merchant: null,
    category_id: categoryId,
    subcategory_id: null,
    source: "whatsapp",
    source_ref: null,
    idempotency_key: `key-${sequence}`,
    confidence: 1,
    requires_review: false,
    account_origin_id: null,
    account_destination_id: null,
    box_origin_id: null,
    box_destination_id: null,
    related_person_id: null,
    debt_id: null,
    recurring_rule_id: null,
    recurring_occurrence_id: null,
    affects_total_balance: true,
    affects_account_balance: false,
    metadata: {},
    created_at: `2026-07-${String(day).padStart(2, "0")}T15:00:00.000Z`,
    updated_at: `2026-07-${String(day).padStart(2, "0")}T15:00:00.000Z`,
    deleted_at: null,
    ...overrides,
  };
}

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: "account-1",
    user_id: "11111111-1111-4111-8111-111111111111",
    name: "Cuenta principal",
    institution: null,
    type: "banco",
    currency: "PEN",
    initial_balance: 800,
    current_balance: 800,
    is_default: true,
    color: null,
    icon: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-18T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function box(overrides: Partial<Box> = {}): Box {
  return {
    id: "box-1",
    user_id: "11111111-1111-4111-8111-111111111111",
    account_id: "account-1",
    name: "Emergencias",
    type: "emergencia",
    current_balance: 500,
    target_amount: 1000,
    target_date: null,
    linked_debt_id: null,
    linked_recurring_id: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-18T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function contextualTag(): Tag {
  return {
    id: "tag-work",
    user_id: null,
    key: "trabajo",
    label: "Trabajo",
    type: "contextual",
    is_system: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
    metadata: {},
  };
}

function debt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: "debt-1",
    user_id: "11111111-1111-4111-8111-111111111111",
    direction: "i_owe",
    kind: "personal",
    status: "active",
    related_person_id: null,
    name: "Prestamo personal",
    principal_amount: 100,
    current_balance: 60,
    currency: "PEN",
    opened_at: "2026-07-01T00:00:00.000Z",
    due_date: null,
    next_payment_date: null,
    installment_count: null,
    installment_amount: null,
    interest_notes: null,
    source: "dashboard",
    confidence: 1,
    metadata: {},
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-18T00:00:00.000Z",
    deleted_at: null,
    last_payment_at: "2026-07-10T00:00:00.000Z",
    closed_at: null,
    ...overrides,
  };
}

function debtPayment(overrides: Partial<DebtPayment> = {}): DebtPayment {
  return {
    id: "debt-payment-1",
    user_id: "11111111-1111-4111-8111-111111111111",
    debt_id: "debt-1",
    movement_id: "movement-debt-payment-1",
    amount: 40,
    currency: "PEN",
    paid_at: "2026-07-10T00:00:00.000Z",
    source: "whatsapp",
    metadata: {},
    created_at: "2026-07-10T00:00:00.000Z",
    ...overrides,
  };
}

function recurringCandidate(
  overrides: Partial<RecurringCandidate> = {},
): RecurringCandidate {
  return {
    id: "recurring-candidate-1",
    user_id: "11111111-1111-4111-8111-111111111111",
    merchant_key: "netflix",
    category_id: "servicios_suscripciones",
    evidence: {
      display_name: "Netflix",
      movement_count: 3,
      inferred_amount: 44.9,
      inferred_frequency: "monthly",
      currency: "PEN",
      movement_ids: ["movement-1", "movement-2", "movement-3"],
      first_seen: "2026-05-15",
      next_expected_date: "2026-08-15",
    },
    confidence: 0.9,
    status: "ready_to_suggest",
    metadata: {},
    created_at: "2026-05-15T00:00:00.000Z",
    updated_at: "2026-07-15T00:00:00.000Z",
    ...overrides,
  };
}
