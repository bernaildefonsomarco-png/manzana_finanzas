import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConversationAgent } from "@/agents/conversation-agent";
import type {
  ConversationContextPack,
  ConversationReferencedMovement,
  ConversationWorkingSet,
} from "@/agents/conversation-agent";
import { CorrectionAgent } from "@/agents/correction-agent";
import type { CorrectionContextPack } from "@/agents/correction-agent";
import { DataAgent } from "@/agents/data-agent";
import type { DataContextPack } from "@/agents/data-agent";
import { OrchestrationPlanningAgent } from "@/agents/orchestration-planning-agent/orchestration-planning-agent";
import {
  buildSafePlanningContext,
  type OrchestrationPlanningContextPack,
} from "@/agents/orchestration-planning-agent/types";
import { analyzeConversationTurn } from "@/core/conversation/conversation-kernel";
import { compileOrchestrationPlan } from "@/core/orchestrator/orchestration-plan";

const shouldRun = process.env.RUN_CONVERSATION_AGENTIC_FLOW_API === "true";
const describeIf = shouldRun ? describe : describe.skip;
const originalEnv = new Map<string, string | undefined>();

const movements: ConversationReferencedMovement[] = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    type: "gasto",
    amount: 20,
    currency: "PEN",
    description: "Desayuno",
    merchant: null,
    category_id: "alimentacion",
    category_label: "Alimentacion",
    occurred_at: "2026-07-17T08:15:00.000-05:00",
    source: "whatsapp",
    source_ref: "event-breakfast",
    account_origin_id: null,
    account_origin_name: null,
    account_destination_id: null,
    account_destination_name: null,
    confidence: 0.97,
    requires_review: false,
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    type: "gasto",
    amount: 15,
    currency: "PEN",
    description: "Taxi",
    merchant: null,
    category_id: "transporte",
    category_label: "Transporte",
    occurred_at: "2026-07-17T09:40:00.000-05:00",
    source: "whatsapp",
    source_ref: "event-taxi",
    account_origin_id: null,
    account_origin_name: null,
    account_destination_id: null,
    account_destination_name: null,
    confidence: 0.95,
    requires_review: false,
  },
];

const workingSet: ConversationWorkingSet = {
  version: "v1",
  topic: "movement",
  goal: "query",
  last_user_message_summary: "Que movimientos hice hoy",
  last_assistant_result_summary: "Se encontraron dos movimientos confirmados.",
  last_action: {
    kind: "query_answered",
    status: "completed",
    source_ref: "event-query",
    movement_ids: movements.map((movement) => movement.id),
    pending_item_ids: [],
    command_ids: [],
  },
  unresolved_slots: [],
  movement_referents: movements.map((movement) => movement.id),
  entity_referents: [],
  active_read_operation: null,
  conversation_style: null,
  updated_at: "2026-07-17T10:01:00.000-05:00",
};

describeIf("agentic conversational flow through OpenAI API", () => {
  beforeAll(() => {
    loadEnvLocalIfNeeded();
    setEnv("AGENT_RUNTIME_DEFAULT_PROVIDER", "local_fixture");
    setEnv("AGENT_RUNTIME_API_KIND", "openai");
    setEnv("AGENT_RUNTIME_FALLBACK_LOCAL", "false");
    setEnv("AGENT_RUNTIME_DATA_AGENT_PROVIDER", "api");
    setEnv("AGENT_RUNTIME_CONVERSATION_AGENT_PROVIDER", "api");
    setEnv("AGENT_RUNTIME_CORRECTION_AGENT_PROVIDER", "api");
    setEnv("AGENT_RUNTIME_ORCHESTRATION_PLANNING_AGENT_PROVIDER", "api");

    if (!process.env.OPENAI_API_KEY && !process.env.AGENT_RUNTIME_API_TOKEN) {
      throw new Error("La prueba requiere OPENAI_API_KEY o AGENT_RUNTIME_API_TOKEN.");
    }
    if (!process.env.AGENT_RUNTIME_API_MODEL) {
      throw new Error("La prueba requiere AGENT_RUNTIME_API_MODEL.");
    }
  });

  afterAll(() => {
    for (const [key, value] of originalEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it(
    "mantiene continuidad, planea un turno mixto y propone correccion sin escribir Core",
    async () => {
      const firstTurn = analyzeConversationTurn({
        text: "Que movimientos hice hoy",
        receivedAt: "2026-07-17T10:00:00.000-05:00",
        timezone: "America/Lima",
        activeState: null,
      });
      const firstPlan = await planTurn({
        message: "Que movimientos hice hoy",
        receivedAt: "2026-07-17T10:00:00.000-05:00",
        analysis: firstTurn,
        active: null,
        traceId: "agentic-flow-query",
      });
      expect(firstPlan.route).toBe("conversation_agent");
      expect(firstPlan.selectedTools).toContain("query_movements");

      const firstAnswer = await new ConversationAgent().answer(
        conversationContext({
          message: "Que movimientos hice hoy",
          receivedAt: "2026-07-17T10:00:00.000-05:00",
          turnState: firstTurn.turn_state,
          workingSet: null,
        }),
        "agentic-flow-answer"
      );
      expect(firstAnswer.runtime.provider).toBe("api");
      expect(firstAnswer.output.used_tools).toContain("query_movements");
      expect(firstAnswer.tool_calls).toContainEqual({
        tool_name: "query_movements",
        status: "called",
      });
      expect(firstAnswer.output.cited_facts.length).toBeGreaterThan(0);

      const followUp = analyzeConversationTurn({
        text: "Y a que hora fue cada uno?",
        receivedAt: "2026-07-17T10:02:00.000-05:00",
        timezone: "America/Lima",
        activeState: activeState(),
      });
      const followUpPlan = await planTurn({
        message: "Y a que hora fue cada uno?",
        receivedAt: "2026-07-17T10:02:00.000-05:00",
        analysis: followUp,
        active: activeState(),
        traceId: "agentic-flow-follow-up",
      });
      expect(followUpPlan.route).toBe("conversation_agent");
      expect(followUpPlan.selectedTools).toContain("query_movements");

      const followUpAnswer = await new ConversationAgent().answer(
        conversationContext({
          message: "Y a que hora fue cada uno?",
          receivedAt: "2026-07-17T10:02:00.000-05:00",
          turnState: followUp.turn_state,
          workingSet,
        }),
        "agentic-flow-follow-up-answer"
      );
      expect(followUpAnswer.runtime.provider).toBe("api");
      expect(followUpAnswer.output.used_tools).toContain("query_movements");
      expect(followUpAnswer.tool_calls).toContainEqual({
        tool_name: "query_movements",
        status: "called",
      });
      expect(followUpAnswer.output.answer_kind).toBe("movement_summary");
      expect(followUpAnswer.output.response_text).toMatch(/8:15|08:15/);
      expect(followUpAnswer.output.response_text).toMatch(/9:40|09:40/);

      const mixedMessage = "Gaste 20 en desayuno y dime como voy esta semana";
      const mixedTurn = analyzeConversationTurn({
        text: mixedMessage,
        receivedAt: "2026-07-17T10:05:00.000-05:00",
        timezone: "America/Lima",
        activeState: activeState(),
      });
      const mixedPlan = await planTurn({
        message: mixedMessage,
        receivedAt: "2026-07-17T10:05:00.000-05:00",
        analysis: mixedTurn,
        active: activeState(),
        traceId: "agentic-flow-mixed",
      });
      expect(mixedPlan.goal).toBe("mixed");
      expect(mixedPlan.runConversationAfterFinancialAction).toBe(true);
      expect(mixedPlan.selectedTools.length).toBeGreaterThan(0);

      const extraction = await new DataAgent().extract(
        dataContext(mixedMessage),
        "agentic-flow-data"
      );
      expect(extraction.runtime.provider).toBe("api");
      expect(extraction.output.result.length).toBeGreaterThan(0);
      expect(extraction.output.result[0]).toMatchObject({
        movement_type: "gasto",
        amount: 20,
      });
      expect(extraction.output.result[0]?.occurred_at).toSatisfy(
        (value: string | null) =>
          value === null ||
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
      );

      const correction = await new CorrectionAgent().propose(
        correctionContext("Descarta el ultimo gasto porfa"),
        "agentic-flow-correction"
      );
      expect(correction.runtime.provider).toBe("api");
      expect(correction.output.kind).toBe("requires_confirmation");
      if (correction.output.kind !== "requires_confirmation") {
        throw new Error(`Correccion no resolvio un candidato: ${JSON.stringify(correction.output)}`);
      }
      expect(correction.output.command.operation).toBe("delete");
      expect(correction.output.command.movement_id).toBe(movements[1].id);
    },
    240_000
  );

  it(
    "interpreta fechas, estilo libre y referencias financieras sin lexicos de frases",
    async () => {
      const yesterdayMessage = "Ayer tuve movimientos?";
      const yesterdayTurn = analyzeConversationTurn({
        text: yesterdayMessage,
        receivedAt: "2026-07-17T22:41:00.000-05:00",
        timezone: "America/Lima",
        activeState: activeState(),
      });
      const yesterdayPlan = await planTurn({
        message: yesterdayMessage,
        receivedAt: "2026-07-17T22:41:00.000-05:00",
        analysis: yesterdayTurn,
        active: activeState(),
        traceId: "agentic-flow-relative-date",
      });
      expect(yesterdayPlan.route).toBe("conversation_agent");
      expect(yesterdayPlan.selectedTools).toContain("query_movements");
      expect(yesterdayPlan.conversationQuery.date_range).toMatchObject({
        label: expect.any(String),
      });
      expect(
        localCalendarDate(
          yesterdayPlan.conversationQuery.date_range?.start ?? ""
        )
      ).toBe("2026-07-16");
      expect(
        localCalendarDate(
          yesterdayPlan.conversationQuery.date_range?.end ?? ""
        )
      ).toBe("2026-07-16");
      expect(yesterdayPlan.conversationQuery.movement_filters).toEqual({
        search_terms: [],
        movement_types: [],
        category_ids: [],
        sources: [],
        account_terms: [],
        subcategory_terms: [],
        person_terms: [],
        tag_terms: [],
        uncategorized_only: false,
      });

      const absoluteDateMessage = "Y el 14 de julio?";
      const absoluteDateTurn = analyzeConversationTurn({
        text: absoluteDateMessage,
        receivedAt: "2026-07-18T12:35:00.000-05:00",
        timezone: "America/Lima",
        activeState: activeState(),
      });
      const absoluteDatePlan = await planTurn({
        message: absoluteDateMessage,
        receivedAt: "2026-07-18T12:35:00.000-05:00",
        analysis: absoluteDateTurn,
        active: activeState(),
        traceId: "agentic-flow-absolute-date-no-content-filter",
      });
      expect(absoluteDatePlan.selectedTools).toContain("query_movements");
      expect(
        localCalendarDate(
          absoluteDatePlan.conversationQuery.date_range?.start ?? ""
        )
      ).toBe("2026-07-14");
      expect(absoluteDatePlan.conversationQuery.movement_filters).toEqual({
        search_terms: [],
        movement_types: [],
        category_ids: [],
        sources: [],
        account_terms: [],
        subcategory_terms: [],
        person_terms: [],
        tag_terms: [],
        uncategorized_only: false,
      });

      const styleMessage =
        "A partir de ahora explicame las cosas como si las revisaramos juntos: calido, con comparaciones simples y sin sonar infantil.";
      const styleTurn = analyzeConversationTurn({
        text: styleMessage,
        receivedAt: "2026-07-17T22:42:00.000-05:00",
        timezone: "America/Lima",
        activeState: activeState(),
      });
      const stylePlan = await planTurn({
        message: styleMessage,
        receivedAt: "2026-07-17T22:42:00.000-05:00",
        analysis: styleTurn,
        active: activeState(),
        traceId: "agentic-flow-free-style",
      });
      expect(stylePlan.styleUpdate).toEqual(
        expect.objectContaining({
          instruction: expect.any(String),
          source: "explicit_user_request",
        })
      );
      expect(stylePlan.styleUpdate?.instruction.length).toBeGreaterThan(20);

      const pendingMessage =
        "Mejor no guardes el desayuno que quedo esperando mi confirmacion.";
      const pendingTurn = analyzeConversationTurn({
        text: pendingMessage,
        receivedAt: "2026-07-17T22:43:00.000-05:00",
        timezone: "America/Lima",
        activeState: activeState(),
      });
      const pendingPlan = await planTurn({
        message: pendingMessage,
        receivedAt: "2026-07-17T22:43:00.000-05:00",
        analysis: pendingTurn,
        active: activeState(),
        traceId: "agentic-flow-pending-discard",
        activeFinancialState: {
          capture_draft: null,
          pending_candidates: [
            {
              pending_code: "P-AB12CD34",
              title: "Desayuno",
              subtitle: "Gasto por confirmar",
              amount: 20,
              currency: "PEN",
              occurred_at: "2026-07-17T08:15:00.000-05:00",
              created_at: "2026-07-17T08:16:00.000-05:00",
              proposed_action: "create_movement",
              movement_type: "gasto",
              account_hint: null,
              account_origin_hint: null,
              account_destination_hint: null,
              account_origin_id: null,
              account_destination_id: null,
            },
          ],
          account_options: [],
          category_options: [],
        },
      });
      expect(pendingPlan.financialResolution).toMatchObject({
        action: "discard",
        target: "pending_item",
        pending_code: "P-AB12CD34",
      });

      const accountClarificationMessage =
        "La 3087 es mi Tarjeta BCP y la 9039 la tengo como Efectivo. Usa esas dos para la transferencia P-CD34EF56 y recuerdalo.";
      const accountClarificationTurn = analyzeConversationTurn({
        text: accountClarificationMessage,
        receivedAt: "2026-07-17T22:43:30.000-05:00",
        timezone: "America/Lima",
        activeState: activeState(),
      });
      const accountClarificationPlan = await planTurn({
        message: accountClarificationMessage,
        receivedAt: "2026-07-17T22:43:30.000-05:00",
        analysis: accountClarificationTurn,
        active: activeState(),
        traceId: "agentic-flow-pending-account-assignment",
        activeFinancialState: {
          capture_draft: null,
          pending_candidates: [
            {
              pending_code: "P-CD34EF56",
              title: "Transferencia entre mis cuentas",
              subtitle: "Faltan cuentas",
              amount: 10,
              currency: "PEN",
              occurred_at: "2026-07-17T20:15:00.000-05:00",
              created_at: "2026-07-17T20:16:00.000-05:00",
              proposed_action: "review_specialized",
              movement_type: "transferencia",
              account_hint: "Clásica ****3087",
              account_origin_hint: "Clásica ****3087",
              account_destination_hint: "Clásica ****9039",
              account_origin_id: null,
              account_destination_id: null,
            },
          ],
          account_options: [
            {
              account_id:
                "11111111-1111-4111-8111-111111111111",
              name: "Tarjeta BCP",
              institution: "BCP",
              currency: "PEN",
              is_default: true,
            },
            {
              account_id:
                "22222222-2222-4222-8222-222222222222",
              name: "Efectivo",
              institution: null,
              currency: "PEN",
              is_default: false,
            },
          ],
          category_options: [
            { category_id: "otros", label: "Otros" },
          ],
        },
      });
      expect(accountClarificationPlan.financialResolution).toMatchObject({
        action: "assign_transfer",
        target: "pending_item",
        pending_code: "P-CD34EF56",
        account_origin_id:
          "11111111-1111-4111-8111-111111111111",
        account_destination_id:
          "22222222-2222-4222-8222-222222222222",
        learn_account_aliases: true,
      });

      const draftMessage = "Si, registra eso que te acabo de contar.";
      const draftTurn = analyzeConversationTurn({
        text: draftMessage,
        receivedAt: "2026-07-17T22:44:00.000-05:00",
        timezone: "America/Lima",
        activeState: activeState(),
      });
      const draftPlan = await planTurn({
        message: draftMessage,
        receivedAt: "2026-07-17T22:44:00.000-05:00",
        analysis: draftTurn,
        active: activeState(),
        traceId: "agentic-flow-draft-confirm",
        activeFinancialState: {
          capture_draft: {
            state_id: "capture-draft-1",
            reason: "financial_action_blocked",
            original_message: "Hice un gasto de 20 soles comprando desayuno",
            created_at: "2026-07-17T22:43:30.000-05:00",
            proposed_actions_count: 1,
            missing_facts: [],
          },
          pending_candidates: [],
          account_options: [],
          category_options: [],
        },
      });
      expect(draftPlan.financialResolution).toMatchObject({
        action: "confirm",
        target: "capture_draft",
        pending_code: null,
      });
    },
    240_000
  );
});

async function planTurn(input: {
  message: string;
  receivedAt: string;
  analysis: ReturnType<typeof analyzeConversationTurn>;
  active: ReturnType<typeof activeState> | null;
  traceId: string;
  activeFinancialState?: OrchestrationPlanningContextPack["active_financial_state"];
}) {
  const result = await new OrchestrationPlanningAgent().plan(
    buildSafePlanningContext({
      userId: "agentic-flow-user",
      timezone: "America/Lima",
      channel: "whatsapp",
      originalMessage: input.message,
      receivedAt: input.receivedAt,
      query: input.analysis.query,
      turnState: input.analysis.turn_state,
      activeMemoryState: input.active
        ? {
            state_id: input.active.id,
            last_intent: input.active.last_intent,
            last_query_kind: input.active.last_query_kind,
            last_query_text: input.active.last_query_text,
            last_result_summary: input.active.last_result_summary,
            referenced_movement_count: input.active.referenced_movements.length,
            referenced_entity_count: input.active.referenced_entities.length,
            continuity_hint: input.active.continuity_hint,
            expires_at: input.active.expires_at,
            working_set: input.active.working_set,
          }
        : undefined,
      activeFinancialState: input.activeFinancialState,
    }),
    input.traceId
  );
  expect(result.runtime.provider).toBe("api");
  return compileOrchestrationPlan({
    plan: result.output,
    fallbackQuery: input.analysis.query,
    fallbackTurnState: input.analysis.turn_state,
    workingSet: input.active?.working_set ?? null,
    receivedAt: input.receivedAt,
  });
}

function activeState() {
  return {
    id: "agentic-flow-state",
    last_intent: "movement_search",
    last_query_kind: "movement_search" as const,
    last_query_text: "Que movimientos hice hoy",
    last_query_date_range: null,
    last_result_summary: "Se encontraron dos movimientos confirmados.",
    referenced_movements: movements,
    referenced_entities: [],
    continuity_hint: "La respuesta anterior enumero dos movimientos de hoy.",
    expires_at: "2026-07-17T12:00:00.000-05:00",
    working_set: workingSet,
  };
}

function conversationContext(input: {
  message: string;
  receivedAt: string;
  turnState: ReturnType<typeof analyzeConversationTurn>["turn_state"];
  workingSet: ConversationWorkingSet | null;
}): ConversationContextPack {
  return {
    context_pack_type: "conversation_context",
    version: "v1",
    user_id: "agentic-flow-user",
    locale: "es-PE",
    timezone: "America/Lima",
    original_message: input.message,
    received_at: input.receivedAt,
    query: {
      kind: "movement_search",
      normalized_text: input.message.toLowerCase(),
      requested_amount: null,
      date_range: {
        start: "2026-07-17T00:00:00.000-05:00",
        end: "2026-07-17T23:59:59.999-05:00",
        label: "hoy",
      },
      confidence: 0.94,
    },
    turn_state: input.turnState,
    active_conversation_state: {
      state_id: input.workingSet ? "agentic-flow-state" : null,
      last_intent: input.workingSet ? "movement_search" : null,
      last_query_kind: input.workingSet ? "movement_search" : null,
      last_query_text: input.workingSet ? "Que movimientos hice hoy" : null,
      last_query_date_range: input.workingSet
        ? {
            start: "2026-07-17T00:00:00.000-05:00",
            end: "2026-07-17T23:59:59.999-05:00",
            label: "hoy",
          }
        : null,
      last_result_summary: input.workingSet
        ? "Se encontraron dos movimientos confirmados."
        : null,
      referenced_movements: input.workingSet ? movements : [],
      referenced_entities: [],
      continuity_hint: input.workingSet
        ? "Continua sobre los dos movimientos enumerados."
        : null,
      expires_at: input.workingSet
        ? "2026-07-17T12:00:00.000-05:00"
        : null,
      working_set: input.workingSet,
    },
    preferences_summary: {
      tone_style: "cercano y breve",
      conversation_style: null,
      discreet_mode: false,
      whatsapp_opt_in: true,
      email_opt_in: false,
      quiet_hours: null,
      default_account_id: null,
    },
    memory_summary: {
      frequent_people: [],
      recent_corrections: [],
    },
    permissions: {
      read_only: true,
      can_mutate_financial_data: false,
    },
    tool_results: [
      {
        tool_name: "query_movements",
        status: "called",
        facts: ["movement_count=2", "date_label=hoy", "net_amount=-35"],
        warnings: [],
        data: {
          movements,
          movement_count: movements.length,
          total_income: 0,
          total_expense: 35,
          net_amount: -35,
          date_label: "hoy",
        },
      },
    ],
    data_limits: [
      "Solo usa movimientos confirmados y las fuentes incluidas en tool_results.",
      "No puede crear, editar ni eliminar movimientos.",
    ],
  };
}

function dataContext(message: string): DataContextPack {
  return {
    context_pack_type: "data_context",
    version: "v2",
    user_id: "agentic-flow-user",
    locale: "es-PE",
    timezone: "America/Lima",
    discreet_mode: false,
    preferences_summary: {},
    risk_context: {},
    original_message: message,
    received_at: "2026-07-17T10:05:00.000-05:00",
    categories: [
      { id: "alimentacion", label: "Alimentacion", is_sensitive: false },
      { id: "transporte", label: "Transporte", is_sensitive: false },
      { id: "otros", label: "Otros", is_sensitive: false },
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
}

function correctionContext(message: string): CorrectionContextPack {
  return {
    context_pack_type: "correction_context",
    version: "v1",
    user_id: "agentic-flow-user",
    locale: "es-PE",
    timezone: "America/Lima",
    channel: "whatsapp",
    original_message: message,
    received_at: "2026-07-17T10:07:00.000-05:00",
    recent_movements: movements.map((movement, index) => ({
      id: movement.id,
      type: movement.type as "gasto",
      amount: movement.amount,
      currency: movement.currency,
      description: movement.description,
      merchant: movement.merchant ?? null,
      category_id: movement.category_id as "alimentacion" | "transporte",
      occurred_at: movement.occurred_at ?? "2026-07-17T10:00:00.000-05:00",
      created_at:
        index === 0
          ? "2026-07-17T08:16:00.000-05:00"
          : "2026-07-17T09:41:00.000-05:00",
      status: "confirmed",
      account_origin_id: null,
      account_destination_id: null,
      metadata: {},
    })),
    accounts: [],
    categories: [
      { id: "alimentacion", label: "Alimentacion", is_sensitive: false },
      { id: "transporte", label: "Transporte", is_sensitive: false },
      { id: "otros", label: "Otros", is_sensitive: false },
    ],
    active_conversation_state: {
      last_response_summary: "Se enumeraron desayuno y taxi.",
      continuity_hint: "El taxi fue el ultimo movimiento mencionado y creado.",
      referenced_movement_ids: movements.map((movement) => movement.id),
      working_set: workingSet,
    },
    recent_changes: [],
    undo_rules: [
      "Toda eliminacion requiere confirmacion explicita.",
      "El agente solo propone; CommandDispatcher ejecuta despues de confirmar.",
    ],
  };
}

function loadEnvLocalIfNeeded() {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    if (process.env[key] !== undefined) continue;
    setEnv(
      key,
      line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "")
    );
  }
}

function setEnv(key: string, value: string) {
  if (!originalEnv.has(key)) originalEnv.set(key, process.env[key]);
  process.env[key] = value;
}

function localCalendarDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
