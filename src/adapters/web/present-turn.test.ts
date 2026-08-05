import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listPendingItemsBySourceRefPrefix: vi.fn(),
}));

vi.mock("@/data/repositories/pending.repository", () => ({
  listPendingItemsBySourceRefPrefix: mocks.listPendingItemsBySourceRefPrefix,
}));

import { buildWebPresentTurn } from "./present-turn";
import type { ExternalEventLog } from "@/core/events/domain-events";
import type { PresentTurnContext } from "@/core/orchestrator/financial-orchestrator";
import type { ConversationTurnState } from "@/agents/conversation-agent";
import { ResponseAgent, type ResponseAgentOutput } from "@/agents/response-agent";
import type {
  AgentRuntime,
  AgentRuntimeRequest,
  AgentRuntimeResponse,
} from "@/agents/runtime/types";

const externalEvent: ExternalEventLog = {
  id: "event-1",
  source: "dashboard",
  event_type: "assistant.turn_received",
  idempotency_key: "key-1",
  user_id: "00000000-0000-4000-8000-000000000001",
  received_at: "2026-08-03T10:00:00.000Z",
  status: "accepted",
  payload_hash: "hash",
  payload_ref: null,
  trace_id: "trace-1",
  metadata: {},
  created_at: "2026-08-03T10:00:00.000Z",
  updated_at: "2026-08-03T10:00:00.000Z",
};

const turnState: ConversationTurnState = {
  act: "financial_capture",
  continuity: "new_topic",
  emotional_state: "neutral",
  experience_mode: "quick_capture",
  should_use_active_memory: false,
  should_route_to_conversation_agent: false,
  should_ask_clarification_first: false,
  response_guidance: [],
  personalization_cues: [],
  risk_notes: [],
};

const context: PresentTurnContext = {
  turnInput: {
    actor: "user",
    text: "gaste 20 en desayuno",
    choice: null,
    confirmation: null,
    attachments: [],
    context: { where: null, filters: null, selected: null, visible: [] },
    channel: "dashboard",
  },
  externalEventId: externalEvent.id,
  traceId: "trace-1",
  conversationTurnState: turnState,
};

function fakeClient(insertResult: { error: { code: string } | null } = { error: null }) {
  const insert = vi.fn(() => Promise.resolve({ data: null, ...insertResult }));
  return { from: vi.fn(() => ({ insert })), _insert: insert };
}

// Cliente que ademas soporta las tablas que `enhanceTextoBlockForWeb` lee
// antes de invocar `ResponseAgent` (`conversation_memory_states`,
// `user_preferences`), con la misma forma "thenable" que usa el SDK real
// de Supabase para que `await client.from(...).select()...maybeSingle()`
// resuelva sin necesitar mockear el modulo del repositorio.
function fakeEnhancementClient(
  options: {
    insertResult?: { error: { code: string } | null };
    memoryState?: Record<string, unknown> | null;
    preferences?: { data: Record<string, unknown> | null; error: { code: string } | null };
  } = {}
) {
  const insert = vi.fn(() =>
    Promise.resolve({ data: null, error: null, ...(options.insertResult ?? {}) })
  );
  const memoryQuery = thenableQuery({ data: options.memoryState ?? null, error: null });
  const preferencesQuery = thenableQuery(options.preferences ?? { data: null, error: null });

  const from = vi.fn((table: string) => {
    if (table === "assistant_messages") return { insert };
    if (table === "conversation_memory_states") return memoryQuery;
    if (table === "user_preferences") return preferencesQuery;
    throw new Error(`fakeEnhancementClient: tabla inesperada "${table}"`);
  });

  return { from, _insert: insert };
}

function thenableQuery(result: { data: unknown; error: unknown }) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    eq: vi.fn(),
    gt: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  for (const key of ["select", "eq", "gt", "order", "limit"]) {
    query[key].mockReturnValue(query);
  }
  return query;
}

class FixedResponseRuntime implements AgentRuntime {
  constructor(private readonly text: string) {}

  async run<TContext, TOutput>(
    request: AgentRuntimeRequest<TContext>
  ): Promise<AgentRuntimeResponse<TOutput>> {
    const context =
      request.context_pack as import("@/agents/response-agent").ResponseContextPack;
    const styleContract = context.style_contract;

    const output: ResponseAgentOutput = {
      response_text: this.text,
      confidence: 0.9,
      preserved_facts: [],
      safety_flags: ["test_runtime"],
      style_notes: [],
      style_adherence: styleContract.must_apply
        ? "applied"
        : styleContract.active
          ? "blocked_for_safety"
          : "not_applicable",
      applied_style_dimensions: styleContract.must_apply
        ? styleContract.allowed_dimensions
        : [],
      style_evidence: styleContract.must_apply
        ? styleContract.allowed_dimensions.map((dimension) => ({
            dimension,
            evidence: this.text.slice(0, 160),
          }))
        : [],
      style_exceptions: styleContract.blocked_reasons,
    };

    return {
      output: output as TOutput,
      confidence: 0.9,
      tool_calls: [],
      runtime: {
        provider: "local_fixture",
        model_name: "fixed-response-runtime",
        latency_ms: 1,
      },
      safety: {
        policy_flags: ["test_runtime"],
        redaction_applied: false,
      },
    };
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listPendingItemsBySourceRefPrefix.mockResolvedValue([]);
});

describe("buildWebPresentTurn", () => {
  it("persiste los bloques neutrales tal cual, sin traducirlos", async () => {
    const client = fakeClient();
    const present = await buildWebPresentTurn({
      client: client as never,
      externalEvent,
      threadId: "thread-1",
      useResponseAgent: false,
    });

    const result = await present(
      {
        blocks: [{ kind: "texto", text: "Registrado. Gasto de S/20 en Alimentación." }],
        intent: "direct_response",
        reason: "movement_created",
      },
      context,
    );

    expect(client._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "asistente",
        thread_id: "thread-1",
        content: [{ kind: "texto", text: "Registrado. Gasto de S/20 en Alimentación." }],
      }),
    );
    expect(result.sendStatus).toBe("sent");
    expect(result.text).toBe("Registrado. Gasto de S/20 en Alimentación.");
  });

  it("recoge las referencias de evidencia de bloques cifra y hallazgo", async () => {
    const client = fakeClient();
    const present = await buildWebPresentTurn({
      client: client as never,
      externalEvent,
      threadId: "thread-1",
      useResponseAgent: false,
    });

    await present(
      {
        blocks: [
          {
            kind: "cifra",
            text: "S/318 en Alimentación",
            amount: 318,
            currency: "PEN",
            references: [{ kind: "movement", id: "m1" }, { kind: "movement", id: "m2" }],
          },
          {
            kind: "hallazgo",
            text: "sueles gastar mas los viernes",
            level: "impresion",
            references: [{ kind: "movement", id: "m3" }],
          },
        ],
        intent: "direct_response",
        reason: "movement_created",
      },
      context,
    );

    expect(client._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        evidence_refs: ["movement:m1", "movement:m2", "movement:m3"],
      }),
    );
  });

  it("enlaza un bloque propuesta con el pendiente real creado en el mismo turno", async () => {
    mocks.listPendingItemsBySourceRefPrefix.mockResolvedValue([
      { id: "pending-1" },
      { id: "pending-2" },
    ]);
    const client = fakeClient();
    const present = await buildWebPresentTurn({
      client: client as never,
      externalEvent,
      threadId: "thread-1",
      useResponseAgent: false,
    });

    await present(
      {
        blocks: [
          { kind: "propuesta", text: "Voy a registrar un gasto", commandId: "", options: [] },
        ],
        intent: "pending_confirmation",
        reason: "pending_created",
      },
      context,
    );

    expect(mocks.listPendingItemsBySourceRefPrefix).toHaveBeenCalledWith(
      client,
      externalEvent.user_id,
      `dashboard:${externalEvent.id}:`,
    );
    expect(client._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action_status: "propuesta",
        proposed_action: expect.objectContaining({
          pending_item_ids: ["pending-1", "pending-2"],
        }),
      }),
    );
  });

  it("no enlaza un pendiente cuando el bloque no es una propuesta", async () => {
    mocks.listPendingItemsBySourceRefPrefix.mockResolvedValue([{ id: "pending-1" }]);
    const client = fakeClient();
    const present = await buildWebPresentTurn({
      client: client as never,
      externalEvent,
      threadId: "thread-1",
      useResponseAgent: false,
    });

    await present(
      {
        blocks: [{ kind: "texto", text: "Este mes llevas S/318 en Alimentación." }],
        intent: "direct_response",
        reason: "movement_created",
      },
      context,
    );

    expect(client._insert).toHaveBeenCalledWith(
      expect.objectContaining({ action_status: null, proposed_action: null }),
    );
  });

  it("un reintento exacto (idempotencia) no se trata como fallo de presentacion", async () => {
    const client = fakeClient({ error: { code: "23505" } });
    const present = await buildWebPresentTurn({
      client: client as never,
      externalEvent,
      threadId: "thread-1",
      useResponseAgent: false,
    });

    const result = await present(
      { blocks: [{ kind: "texto", text: "hola" }], intent: "direct_response", reason: "movement_created" },
      context,
    );

    expect(result.sendStatus).toBe("not_sent");
    expect(result.sendReason).toBe("duplicate");
  });

  it("mejora el texto del bloque texto cuando useResponseAgent esta activo y no hay skip", async () => {
    const client = fakeEnhancementClient();
    const runtime = new FixedResponseRuntime(
      "Listo. Registramos tu gasto de S/20 en Alimentacion, con un toque mas calido."
    );
    const present = await buildWebPresentTurn({
      client: client as never,
      externalEvent,
      threadId: "thread-1",
      responseAgent: new ResponseAgent(runtime),
      useResponseAgent: true,
    });

    const result = await present(
      {
        blocks: [{ kind: "texto", text: "Registrado. Gasto de S/20 en Alimentacion." }],
        intent: "direct_response",
        reason: "movement_created",
      },
      context,
    );

    expect(client._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        content: [
          {
            kind: "texto",
            text: "Listo. Registramos tu gasto de S/20 en Alimentacion, con un toque mas calido.",
          },
        ],
      }),
    );
    expect(result.text).toBe(
      "Listo. Registramos tu gasto de S/20 en Alimentacion, con un toque mas calido.",
    );
    expect(result.enhancement.status).toBe("completed");
  });

  it("no toca un bloque propuesta aunque useResponseAgent este activo", async () => {
    const client = fakeEnhancementClient();
    const runtime = new FixedResponseRuntime("Nunca deberia llamarse: no hay bloque texto.");
    const present = await buildWebPresentTurn({
      client: client as never,
      externalEvent,
      threadId: "thread-1",
      responseAgent: new ResponseAgent(runtime),
      useResponseAgent: true,
    });

    const result = await present(
      {
        blocks: [
          { kind: "propuesta", text: "Voy a registrar un gasto", commandId: "", options: [] },
        ],
        intent: "pending_confirmation",
        reason: "pending_created",
      },
      context,
    );

    expect(client._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        content: [
          { kind: "propuesta", text: "Voy a registrar un gasto", commandId: "", options: [] },
        ],
      }),
    );
    expect(result.enhancement).toMatchObject({
      status: "not_applicable",
      reason: "web_channel_no_enhancement",
    });
  });

  it("no mejora el texto cuando context.skipEnhancement es true", async () => {
    const client = fakeEnhancementClient();
    const runtime = new FixedResponseRuntime("Nunca deberia llamarse: skipEnhancement activo.");
    const present = await buildWebPresentTurn({
      client: client as never,
      externalEvent,
      threadId: "thread-1",
      responseAgent: new ResponseAgent(runtime),
      useResponseAgent: true,
    });

    const result = await present(
      {
        blocks: [{ kind: "texto", text: "Ya quedo. Nada que confirmar." }],
        intent: "direct_response",
        reason: "conversation_answer",
      },
      { ...context, skipEnhancement: true },
    );

    expect(client._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        content: [{ kind: "texto", text: "Ya quedo. Nada que confirmar." }],
      }),
    );
    expect(result.enhancement).toMatchObject({
      status: "not_applicable",
      reason: "web_channel_no_enhancement",
    });
  });

  it("si el guardrail rechaza la mejora, conserva el texto original", async () => {
    const client = fakeEnhancementClient();
    const runtime = new FixedResponseRuntime("Listo."); // pierde el monto S/20
    const present = await buildWebPresentTurn({
      client: client as never,
      externalEvent,
      threadId: "thread-1",
      responseAgent: new ResponseAgent(runtime),
      useResponseAgent: true,
    });

    const result = await present(
      {
        blocks: [{ kind: "texto", text: "Registrado. Gasto de S/20 en Alimentacion." }],
        intent: "direct_response",
        reason: "movement_created",
      },
      context,
    );

    expect(client._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        content: [{ kind: "texto", text: "Registrado. Gasto de S/20 en Alimentacion." }],
      }),
    );
    expect(result.text).toBe("Registrado. Gasto de S/20 en Alimentacion.");
    expect(result.enhancement).toMatchObject({
      status: "rejected",
      reason: "missing_amount",
    });
  });
});
