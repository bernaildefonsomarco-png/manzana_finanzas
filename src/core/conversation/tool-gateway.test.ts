import { describe, expect, it } from "vitest";
import type { ConversationQuery } from "@/agents/conversation-agent";
import type { ConversationMemoryState } from "@/data/repositories/conversation-memory.repository";
import {
  filterMovementsForConversationQuery,
  shouldUseActiveReferencedMovements,
} from "./tool-gateway";

const followUpQuery: ConversationQuery = {
  kind: "movement_search",
  normalized_text: "y a que hora fue ese?",
  requested_amount: null,
  date_range: null,
  confidence: 0.96,
};

describe("shouldUseActiveReferencedMovements", () => {
  it("continua una referencia creada por una captura aunque no haya consulta previa", () => {
    expect(
      shouldUseActiveReferencedMovements(
        followUpQuery,
        activeCaptureMemory(),
        true
      )
    ).toBe(true);
  });

  it("respeta un cambio explicito de periodo y no arrastra el movimiento anterior", () => {
    expect(
      shouldUseActiveReferencedMovements(
        {
          ...followUpQuery,
          normalized_text: "y que movimientos hice hoy?",
        },
        activeCaptureMemory(),
        true
      )
    ).toBe(false);
  });

  it("no usa referencias si el ConversationKernel no autorizo continuidad", () => {
    expect(
      shouldUseActiveReferencedMovements(
        followUpQuery,
        activeCaptureMemory(),
        false
      )
    ).toBe(false);
  });

  it("usa focus_set aunque la lista legada de referencias este vacia", () => {
    const state = activeCaptureMemory();
    state.referenced_movements = [];
    state.working_set = {
      ...state.working_set!,
      focus_set: {
        version: "v1",
        revision: 3,
        focus_id: "focus-food",
        subject: "movements",
        ordered_ids: ["food-1", "food-2", "food-3", "food-4", "food-5"],
        visible_order: "tool_result_order",
        query: followUpQuery,
        tool_provenance: [],
        slot_provenance: [],
        state_hash: "fnv1a32:12345678",
        created_at: "2026-07-24T10:00:00.000-05:00",
        updated_at: "2026-07-24T10:00:00.000-05:00",
        expires_at: "2099-07-24T12:00:00.000-05:00",
      },
    };

    expect(
      shouldUseActiveReferencedMovements(followUpQuery, state, true)
    ).toBe(true);
  });
});

describe("filterMovementsForConversationQuery", () => {
  it("no convierte una expresion temporal en un filtro de contenido", () => {
    const movements = [movement({ description: "Desayuno" })];

    expect(
      filterMovementsForConversationQuery(movements, {
        kind: "movement_search",
        normalized_text: "y antes de ayer?",
        requested_amount: null,
        date_range: {
          start: "2026-07-16T05:00:00.000Z",
          end: "2026-07-17T04:59:59.999Z",
          label: "antes de ayer, 16 de julio de 2026",
        },
        movement_filters: emptyMovementFilters(),
        confidence: 0.98,
      }),
    ).toEqual(movements);
  });

  it("no trata el nombre del mes como comercio o categoria", () => {
    const movements = [
      movement({ id: "movement-14", description: "Prestamo a Luis" }),
      movement({ id: "movement-15", description: "Almuerzo" }),
    ];

    expect(
      filterMovementsForConversationQuery(movements, {
        kind: "movement_search",
        normalized_text: "y el 14 de julio?",
        requested_amount: null,
        date_range: {
          start: "2026-07-14T05:00:00.000Z",
          end: "2026-07-15T04:59:59.999Z",
          label: "14 de julio de 2026",
        },
        movement_filters: emptyMovementFilters(),
        confidence: 0.98,
      }),
    ).toEqual(movements);
  });

  it("aplica solo los filtros financieros declarados semanticamente", () => {
    const taxi = movement({ id: "taxi", description: "Taxi" });
    const desayuno = movement({ id: "desayuno", description: "Desayuno" });

    expect(
      filterMovementsForConversationQuery([taxi, desayuno], {
        kind: "movement_search",
        normalized_text: "que gaste en taxi antes de ayer?",
        requested_amount: null,
        date_range: {
          start: "2026-07-16T05:00:00.000Z",
          end: "2026-07-17T04:59:59.999Z",
          label: "antes de ayer, 16 de julio de 2026",
        },
        movement_filters: {
          ...emptyMovementFilters(),
          search_terms: ["taxi"],
        },
        confidence: 0.98,
      }),
    ).toEqual([taxi]);
  });

  it("combina subcategoria, persona y tags sin depender del texto literal del mensaje", () => {
    const desayuno = movement({
      id: "desayuno",
      description: "Compra de la manana",
      subcategory_label: "Desayuno",
      related_person_name: "Luis",
      tag_labels: ["trabajo"],
    });
    const almuerzo = movement({
      id: "almuerzo",
      description: "Menu ejecutivo",
      subcategory_label: "Almuerzo",
      related_person_name: "Ana",
      tag_labels: ["personal"],
    });

    expect(
      filterMovementsForConversationQuery([desayuno, almuerzo], {
        kind: "movement_search",
        normalized_text: "lo de Luis del trabajo",
        requested_amount: null,
        date_range: null,
        movement_filters: {
          ...emptyMovementFilters(),
          subcategory_terms: ["desayuno"],
          person_terms: ["luis"],
          tag_terms: ["trabajo"],
        },
        confidence: 0.98,
      }),
    ).toEqual([desayuno]);
  });

  it("conserva el parser legado solo para el fallback sin plan semantico", () => {
    const taxi = movement({ id: "taxi", description: "Taxi" });
    const desayuno = movement({ id: "desayuno", description: "Desayuno" });

    expect(
      filterMovementsForConversationQuery([taxi, desayuno], {
        kind: "movement_search",
        normalized_text: "gastos de taxi ayer",
        requested_amount: null,
        date_range: null,
        confidence: 0.6,
      }),
    ).toEqual([taxi]);
  });
});

function emptyMovementFilters(): NonNullable<
  ConversationQuery["movement_filters"]
> {
  return {
    search_terms: [],
    movement_types: [],
    category_ids: [],
    sources: [],
    account_terms: [],
    uncategorized_only: false,
  };
}

function movement(overrides: Record<string, unknown> = {}) {
  return {
    id: "movement-1",
    type: "gasto" as const,
    amount: 20,
    currency: "PEN" as const,
    description: "Desayuno",
    merchant: null,
    category_id: "alimentacion" as const,
    category_label: "Alimentacion",
    occurred_at: "2026-07-16T19:14:00.000-05:00",
    created_at: "2026-07-16T19:14:00.000-05:00",
    status: "confirmed" as const,
    source: "whatsapp" as const,
    source_ref: "event-1",
    confidence: 0.98,
    requires_review: false,
    account_origin_id: null,
    account_origin_name: "Efectivo",
    account_destination_id: null,
    account_destination_name: null,
    ...overrides,
  };
}

function activeCaptureMemory(): ConversationMemoryState {
  return {
    id: "memory-1",
    user_id: "user-1",
    channel: "whatsapp",
    scope: "default",
    last_intent: "record_movement",
    last_query_kind: null,
    last_query_text: "gaste 20 en desayuno y dime como voy esta semana",
    last_query_date_range: null,
    last_tool_name: null,
    last_result_summary: "Desayuno por S/20.00 registrado.",
    referenced_movements: [
      {
        id: "movement-1",
        type: "gasto",
        amount: 20,
        currency: "PEN",
        description: "Desayuno",
        merchant: null,
        category_id: "alimentacion",
        category_label: "Alimentacion",
        occurred_at: "2026-07-17T17:07:29.657-05:00",
        source: "whatsapp",
        source_ref: "event-1",
        account_origin_id: null,
        account_origin_name: null,
        account_destination_id: null,
        account_destination_name: null,
        confidence: 0.98,
        requires_review: false,
      },
    ],
    referenced_entities: [],
    continuity_hint: null,
    source_ref: "event-1",
    expires_at: "2026-07-18T17:07:29.657-05:00",
    updated_at: "2026-07-17T17:07:29.657-05:00",
    metadata: {},
    working_set: {
      version: "v1",
      topic: "movement",
      goal: "capture",
      last_user_message_summary:
        "Gaste 20 en desayuno y dime como voy esta semana",
      last_assistant_result_summary: "Desayuno por S/20.00 registrado.",
      last_action: {
        kind: "movement_created",
        status: "completed",
        source_ref: "event-1",
        movement_ids: ["movement-1"],
        pending_item_ids: [],
        command_ids: [],
      },
      unresolved_slots: [],
      movement_referents: ["movement-1"],
      entity_referents: [],
      active_read_operation: null,
      conversation_style: null,
      updated_at: "2026-07-17T17:07:29.657-05:00",
    },
  };
}
