import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  answer: vi.fn(),
  buildConversationContextPack: vi.fn(),
  createServiceClient: vi.fn(),
  getActiveConversationMemoryState: vi.fn(),
  getApiAuth: vi.fn(),
  getProfile: vi.fn(),
  rememberConversationTurn: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({
  getApiAuth: mocks.getApiAuth,
}));

vi.mock("@/data/repositories/profiles.repository", () => ({
  getProfile: mocks.getProfile,
}));

vi.mock("@/data/repositories/conversation-memory.repository", () => ({
  getActiveConversationMemoryState: mocks.getActiveConversationMemoryState,
}));

vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("@/core/conversation/conversation-memory", () => ({
  rememberConversationTurn: mocks.rememberConversationTurn,
}));

vi.mock("@/core/conversation/tool-gateway", () => ({
  ToolGateway: vi.fn(function ToolGatewayMock() {
    return {
      buildConversationContextPack: mocks.buildConversationContextPack,
    };
  }),
}));

vi.mock("@/agents/conversation-agent", () => ({
  ConversationAgent: vi.fn(function ConversationAgentMock() {
    return {
      answer: mocks.answer,
    };
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({
    client: { from: vi.fn() },
    userId: "11111111-1111-4111-8111-111111111111",
  });
  mocks.getProfile.mockResolvedValue({
    timezone: "America/Lima",
  });
  mocks.getActiveConversationMemoryState.mockResolvedValue(null);
  mocks.createServiceClient.mockReturnValue({ service: true });
  mocks.rememberConversationTurn.mockResolvedValue(undefined);
  mocks.buildConversationContextPack.mockImplementation((input) =>
    contextPackFor(input.query.kind, input)
  );
  mocks.answer.mockImplementation((contextPack) =>
    Promise.resolve({
      output: answerFor(contextPack.query.kind),
      runtime: { provider: "local_fixture", latency_ms: 1 },
      tool_calls: [],
      safety: { policy_flags: [], redaction_applied: false },
    })
  );
});

describe("natural search route", () => {
  it("rechaza busqueda sin sesion antes de consultar herramientas", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await POST(searchRequest("Que movimientos hice hoy?"));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(mocks.buildConversationContextPack).not.toHaveBeenCalled();
    expect(mocks.answer).not.toHaveBeenCalled();
  });

  it("bloquea intentos de escritura y no invoca agentes ni ToolGateway", async () => {
    const response = await POST(searchRequest("Registra gasto 10 cafe"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.mode).toBe("action_redirect");
    expect(payload.data.answer.safety_flags).toContain("read_only");
    expect(payload.data.answer.safety_flags).toContain(
      "write_attempt_redirected"
    );
    expect(mocks.getProfile).not.toHaveBeenCalled();
    expect(mocks.buildConversationContextPack).not.toHaveBeenCalled();
    expect(mocks.answer).not.toHaveBeenCalled();
  });

  it("usa memoria consultable read-only cuando el scope es memoria", async () => {
    const response = await POST(
      searchRequest("Que recuerdas de mis preferencias?", "memory")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(mocks.buildConversationContextPack).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "dashboard",
        query: expect.objectContaining({ kind: "financial_memory_search" }),
      })
    );
    expect(payload.data.sources[0]).toMatchObject({
      type: "memory",
      id: "memory-preference-1",
      label: "Prefiere respuestas cortas",
    });
    expect(payload.data.tool_results[0]).toMatchObject({
      tool_name: "search_financial_memory",
      status: "called",
    });
  });

  it("degrada una consulta textual no interpretada a busqueda de movimientos con fuentes", async () => {
    const response = await POST(searchRequest("cafeteria central"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(mocks.buildConversationContextPack).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ kind: "movement_search" }),
        turnState: expect.objectContaining({
          response_guidance: expect.arrayContaining([
            "usar solo herramientas read-only y fuentes disponibles",
          ]),
        }),
      })
    );
    expect(payload.data.query_interpretation.kind).toBe("movement_search");
    expect(payload.data.sources[0]).toMatchObject({
      type: "movement",
      id: "movement-1",
      label: "Cafeteria Central",
      amount: 15,
    });
  });

  it("respeta el scope de dinero y limita la respuesta a balance snapshot", async () => {
    const response = await POST(searchRequest("Que tengo?", "money"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(mocks.buildConversationContextPack).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ kind: "balance_snapshot" }),
      })
    );
    expect(payload.data.sources[0]).toMatchObject({
      type: "balance",
      label: "Dinero libre",
      amount: 220,
    });
  });
});

function searchRequest(query: string, scope = "all") {
  return new Request("http://localhost/api/v1/search/natural", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, scope }),
  });
}

function contextPackFor(kind: string, input: Record<string, unknown>) {
  return {
    context_pack_type: "conversation_context",
    version: "v1",
    user_id: "11111111-1111-4111-8111-111111111111",
    locale: "es-PE",
    timezone: "America/Lima",
    channel: "dashboard",
    original_message: input.originalMessage,
    received_at: input.receivedAt,
    query: input.query,
    turn_state: input.turnState,
    active_conversation_state: {
      state_id: null,
      last_intent: null,
      last_query_kind: null,
      last_query_text: null,
      last_query_date_range: null,
      last_result_summary: null,
      referenced_movements: [],
      referenced_entities: [],
      continuity_hint: null,
      expires_at: null,
    },
    preferences_summary: {
      tone_style: null,
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
    tool_results: toolResultsFor(kind),
    data_limits: ["Solo lectura desde busqueda natural."],
  };
}

function toolResultsFor(kind: string) {
  if (kind === "financial_memory_search") {
    return [
      {
        tool_name: "search_financial_memory",
        status: "called",
        facts: ["memory_source_count=1"],
        warnings: [],
        data: {
          sources: [
            {
              id: "memory-preference-1",
              label: "Prefiere respuestas cortas",
              detail: "preferencia conversacional",
              status: "active",
            },
          ],
        },
      },
    ];
  }

  if (kind === "balance_snapshot") {
    return [
      {
        tool_name: "get_balance_snapshot",
        status: "called",
        facts: ["operational_free_money=S/220.00"],
        warnings: [],
        data: {
          operational_free_money: 220,
        },
      },
    ];
  }

  return [
    {
      tool_name: "query_movements",
      status: "called",
      facts: ["movement_count=1"],
      warnings: [],
      data: {
        movements: [
          {
            id: "movement-1",
            description: "Cafeteria Central",
            amount: 15,
            currency: "PEN",
            occurred_at: "2026-07-15T08:30:00.000Z",
            status: "confirmed",
            source: "whatsapp",
          },
        ],
      },
    },
  ];
}

function answerFor(kind: string) {
  const answerKindByQuery: Record<string, string> = {
    financial_memory_search: "memory_summary",
    balance_snapshot: "balance_snapshot",
    movement_search: "movement_summary",
  };

  return {
    response_text:
      kind === "financial_memory_search"
        ? "Recuerdo que prefieres respuestas cortas."
        : kind === "balance_snapshot"
          ? "Tienes S/220.00 libres."
          : "Encontre 1 movimiento: Cafeteria Central.",
    answer_kind: answerKindByQuery[kind] ?? "movement_summary",
    confidence: 0.86,
    cited_facts: [],
    used_tools: [],
    follow_up_question: null,
    safety_flags: ["read_only"],
  };
}
