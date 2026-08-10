import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  executeMemoryControlProposal,
  handleMemoryControlFromText,
  parseMemoryControlFromText,
  resolveMemoryControl,
} from "./memory-control-from-text";
import { compileMemoryControlRequest } from "./memory-control-request";
import {
  isMemoryConfirmationText,
  isMemoryDiscardText,
  resolveAwaitingMemoryControl,
  type MemoryControlProposal,
} from "./memory-control-proposal";
import {
  getLearningPreferences,
  listFinancialMemory,
  manageFinancialMemory,
  setLearningPreferences,
} from "@/data/repositories/financial-memory.repository";

vi.mock("@/data/repositories/financial-memory.repository", () => ({
  getLearningPreferences: vi.fn(),
  listFinancialMemory: vi.fn(),
  manageFinancialMemory: vi.fn(),
  setLearningPreferences: vi.fn(),
}));

const mockedList = vi.mocked(listFinancialMemory);
const mockedManage = vi.mocked(manageFinancialMemory);
const mockedPreferences = vi.mocked(getLearningPreferences);
const mockedSetPreferences = vi.mocked(setLearningPreferences);

const OTHER_ID = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  vi.clearAllMocks();
  mockedPreferences.mockResolvedValue({
    enabled: true,
    allow_narrative_memory: true,
    allow_sensitive_memory: false,
  } as never);
  mockedList.mockResolvedValue([memory()]);
  mockedManage.mockResolvedValue({} as never);
  mockedSetPreferences.mockResolvedValue({} as never);
});

/**
 * `RUL-MEM-16`: la intencion la decide el modelo. Lo unico que sigue leyendo
 * texto es el comando con codigo que el propio asistente imprime.
 */
describe("el detector de texto ya no interpreta lenguaje", () => {
  it("no reconoce ninguna frase natural, ni las que antes acertaba", () => {
    expect(parseMemoryControlFromText("¿Qué recuerdas de mí?")).toBeNull();
    expect(parseMemoryControlFromText("Deja de aprender de mí")).toBeNull();
    expect(parseMemoryControlFromText("che, olvidate de eso")).toBeNull();
    expect(parseMemoryControlFromText("Olvídalo, elimínalo")).toBeNull();
  });

  it("sigue leyendo el comando con codigo que el asistente ensena", () => {
    expect(parseMemoryControlFromText("Olvida M-22222222")).toEqual({
      action: "forget",
      query: "m-22222222",
    });
    expect(
      parseMemoryControlFromText("Corrige M-22222222: ahora prefiero detalle"),
    ).toEqual({
      action: "correct",
      query: "m-22222222",
      summary: "ahora prefiero detalle",
    });
  });
});

/** Las cinco acciones, mas el rechazo, entrando por el juicio del modelo. */
describe("compileMemoryControlRequest", () => {
  it("traduce cada intencion del ejecutivo a una orden tipada", () => {
    expect(compileMemoryControlRequest(request({ intent: "list" }))).toEqual({
      action: "list",
    });
    expect(compileMemoryControlRequest(request({ intent: "disable" }))).toEqual({
      action: "disable",
    });
    expect(compileMemoryControlRequest(request({ intent: "enable" }))).toEqual({
      action: "enable",
    });
    expect(
      compileMemoryControlRequest(
        request({ intent: "forget", target: "lo del gimnasio" }),
      ),
    ).toEqual({ action: "forget", query: "lo del gimnasio" });
    expect(
      compileMemoryControlRequest(
        request({
          intent: "correct",
          target: "mi alias",
          replacement: "ahora me dicen Marco",
        }),
      ),
    ).toEqual({
      action: "correct",
      query: "mi alias",
      summary: "ahora me dicen Marco",
    });
    expect(
      compileMemoryControlRequest(request({ intent: "forget_all" })),
    ).toEqual({ action: "forget_all" });
    expect(compileMemoryControlRequest(request({ intent: "none" }))).toBeNull();
    expect(compileMemoryControlRequest(null)).toBeNull();
  });

  it("una duda declarada pregunta en vez de actuar", () => {
    expect(
      compileMemoryControlRequest(
        request({ intent: "forget", ambiguities: ["¿cuál de los dos?"] }),
      ),
    ).toEqual({ action: "clarify" });
  });

  it("olvidar, corregir y reactivar exigen mas confianza que ver o apagar", () => {
    expect(
      compileMemoryControlRequest(
        request({ intent: "forget", confidence: 0.7 }),
      ),
    ).toEqual({ action: "clarify" });
    expect(
      compileMemoryControlRequest(
        request({ intent: "enable", confidence: 0.7 }),
      ),
    ).toEqual({ action: "clarify" });
    // Apagar de mas solo cuesta que recuerde menos: el umbral es el bajo.
    expect(
      compileMemoryControlRequest(
        request({ intent: "disable", confidence: 0.7 }),
      ),
    ).toEqual({ action: "disable" });
  });
});

describe("resolver una orden de memoria", () => {
  it("lista memoria sensible sin exponer el contenido", async () => {
    mockedList.mockResolvedValue([
      memory({ sensitivity: "sensitive", summary: "Deuda personal con Luis" }),
    ]);
    const result = await resolve({ action: "list" });
    expect(result.action).toBe("list");
    expect(result.response_text).toContain("Contexto sensible");
    expect(result.response_text).not.toContain("Luis");
  });

  it("olvidar propone y no ejecuta: el catalogo lo marca `tarjeta`", async () => {
    const result = await resolve({ action: "forget", query: "breves" });

    expect(result.action).toBe("forget");
    expect(mockedManage).not.toHaveBeenCalled();
    expect(result.proposal?.action).toBe("forget");
    expect(result.proposal?.memory_id).toBe(memory().id);
    // `40` §7.13: el detalle obligatorio de la tarjeta es "que se conserva".
    expect(result.proposal?.summary).toContain("No cambia ningún movimiento");
    expect(result.proposal?.confirm_label).toBe("Sí, olvídalo");
  });

  it("corregir muestra lo anterior y lo nuevo antes de pedir el sí", async () => {
    const result = await resolve({
      action: "correct",
      query: "breves",
      summary: "ahora prefiero respuestas detalladas",
    });

    expect(mockedManage).not.toHaveBeenCalled();
    expect(result.proposal?.summary).toContain("Prefiero respuestas breves");
    expect(result.proposal?.summary).toContain(
      "ahora prefiero respuestas detalladas",
    );
  });

  it("un recuerdo sensible tampoco se expone en la tarjeta", async () => {
    mockedList.mockResolvedValue([
      memory({ sensitivity: "sensitive", summary: "Deuda personal con Luis" }),
    ]);
    const result = await resolve({ action: "forget", query: "" });
    expect(result.proposal?.summary).toContain("Contexto sensible");
    expect(result.proposal?.summary).not.toContain("Luis");
  });

  it("con varios candidatos pregunta con los códigos y no toca nada", async () => {
    mockedList.mockResolvedValue([
      memory(),
      memory({ id: OTHER_ID, summary: "Prefiero respuestas breves por la mañana" }),
    ]);

    const result = await resolve({ action: "forget", query: "" });

    expect(result.action).toBe("clarify");
    expect(result.proposal).toBeNull();
    expect(mockedManage).not.toHaveBeenCalled();
    expect(result.response_text).toContain("M-22222222");
    expect(result.response_text).toContain("M-33333333");
  });

  it("sin ningún candidato lo dice y explica cómo verlos", async () => {
    mockedList.mockResolvedValue([]);
    const result = await resolve({ action: "forget", query: "el gimnasio" });

    expect(result.action).toBe("clarify");
    expect(result.proposal).toBeNull();
    expect(result.response_text).toContain("No encontré");
    expect(mockedManage).not.toHaveBeenCalled();
  });

  it("desactiva aprendizaje conservando los permisos granulares", async () => {
    mockedPreferences.mockResolvedValue({
      enabled: true,
      allow_narrative_memory: false,
      allow_sensitive_memory: true,
    } as never);

    const result = await resolve({ action: "disable" });

    expect(result.action).toBe("disable");
    expect(mockedSetPreferences).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        enabled: false,
        allowNarrativeMemory: false,
        allowSensitiveMemory: true,
      }),
    );
  });

  it("reactivar el aprendizaje se ejecuta directo: el catalogo lo marca `ninguna`", async () => {
    const result = await resolve({ action: "enable" });
    expect(result.action).toBe("enable");
    expect(mockedSetPreferences).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: true }),
    );
  });

  it("con el aprendizaje apagado sigue mostrando y sigue dejando olvidar", async () => {
    mockedPreferences.mockResolvedValue({
      enabled: false,
      allow_narrative_memory: true,
      allow_sensitive_memory: false,
    } as never);

    const listed = await resolve({ action: "list" });
    expect(listed.response_text).toContain("aprendizaje está desactivado");
    expect(listed.response_text).toContain("M-22222222");

    // Borrar lo propio nunca depende del consentimiento de aprender.
    const forgotten = await resolve({ action: "forget", query: "breves" });
    expect(forgotten.proposal?.action).toBe("forget");
  });

  it("`olvidar_todo` se rechaza con su vía de pantalla y no lee nada", async () => {
    const result = await resolve({ action: "forget_all" });

    expect(result.action).toBe("blocked");
    expect(result.response_text).toContain("pantalla de Memoria");
    expect(mockedManage).not.toHaveBeenCalled();
    expect(mockedList).not.toHaveBeenCalled();
  });

  it("el comando con código llega al mismo ejecutor y también propone", async () => {
    const result = await handleMemoryControlFromText({
      client: {} as never,
      userId: "user-1",
      text: "Olvida M-22222222",
      traceId: "trace-2",
    });

    expect(result.handled).toBe(true);
    expect(result.proposal?.memory_id).toBe(memory().id);
    expect(mockedManage).not.toHaveBeenCalled();
  });
});

describe("aplicar la orden confirmada", () => {
  it("olvida por el servicio gobernado con la clave de la propuesta", async () => {
    const execution = await executeMemoryControlProposal({
      client: {} as never,
      userId: "user-1",
      proposal: proposal(),
      traceId: "trace-3",
    });

    expect(execution.kind).toBe("applied");
    expect(mockedManage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "forget",
        memoryId: memory().id,
        idempotencyKey: `memory-control:memory:${proposal().proposal_id}`,
      }),
    );
  });

  it("un fallo de la memoria no rompe el turno: devuelve texto y no lanza", async () => {
    mockedManage.mockRejectedValue(new Error("supabase caida"));

    const execution = await executeMemoryControlProposal({
      client: {} as never,
      userId: "user-1",
      proposal: proposal(),
      traceId: "trace-4",
    });

    expect(execution.kind).toBe("failed");
    expect(execution.response_text.length).toBeGreaterThan(0);
  });
});

/**
 * El matcher de estructura trata "olvidalo" como descarte. Aqui significa lo
 * contrario, y confundirlo cancelaria en silencio justo lo que el usuario pide.
 */
describe("confirmar o descartar una orden de memoria", () => {
  it("“sí, olvidalo” confirma y no cancela", () => {
    expect(isMemoryConfirmationText("sí, olvídalo")).toBe(true);
    expect(isMemoryDiscardText("sí, olvídalo")).toBe(false);
    expect(isMemoryConfirmationText("olvídalo")).toBe(true);
  });

  it("“no, déjalo así” descarta", () => {
    expect(isMemoryDiscardText("no, déjalo así")).toBe(true);
    expect(isMemoryConfirmationText("no, déjalo así")).toBe(false);
  });

  it("un “sí” de otro hilo no ejecuta la propuesta", () => {
    const awaiting = resolveAwaitingMemoryControl({
      text: "sí",
      workingSet: workingSetWithProposal(),
      threadKey: "hilo:otro",
      now: "2026-08-09T10:01:00.000-05:00",
    });
    expect(awaiting.kind).toBe("other_thread");
  });

  it("un “sí” fuera de la vigencia se responde, no se ejecuta", () => {
    const awaiting = resolveAwaitingMemoryControl({
      text: "sí",
      workingSet: workingSetWithProposal(),
      threadKey: "hilo:uno",
      now: "2026-08-09T11:00:00.000-05:00",
    });
    expect(awaiting.kind).toBe("lapsed_confirmation");
  });

  it("dentro del hilo y de la vigencia, es confirmable", () => {
    const awaiting = resolveAwaitingMemoryControl({
      text: "sí, olvídalo",
      workingSet: workingSetWithProposal(),
      threadKey: "hilo:uno",
      now: "2026-08-09T10:01:00.000-05:00",
    });
    expect(awaiting.kind).toBe("confirmable");
  });
});

function resolve(command: Parameters<typeof resolveMemoryControl>[0]["command"]) {
  return resolveMemoryControl({
    client: {} as never,
    userId: "user-1",
    command,
    traceId: "trace-1",
    now: "2026-08-09T10:00:00.000-05:00",
  });
}

function request(
  patch: Partial<
    NonNullable<Parameters<typeof compileMemoryControlRequest>[0]>
  > = {},
) {
  return {
    intent: "none" as const,
    target: "",
    replacement: "",
    confidence: 0.9,
    ambiguities: [],
    ...patch,
  };
}

function proposal(): MemoryControlProposal {
  return {
    proposal_id: "44444444-4444-4444-8444-444444444444",
    action: "forget",
    memory_id: memory().id,
    memory_code: "M-22222222",
    summary: "¿Olvido M-22222222?",
    confirm_label: "Sí, olvídalo",
    replacement: null,
    proposed_at: "2026-08-09T10:00:00.000-05:00",
  };
}

function workingSetWithProposal() {
  return {
    version: "v1" as const,
    topic: "memory" as const,
    goal: "confirm" as const,
    last_user_message_summary: "olvidate de eso",
    last_assistant_result_summary: "¿Olvido M-22222222?",
    last_action: {
      kind: "memory_proposed" as const,
      status: "awaiting_confirmation" as const,
      source_ref: "event-1",
      movement_ids: [],
      pending_item_ids: [],
      command_ids: [`mem:${proposal().proposal_id}`],
      thread_key: "hilo:uno",
      confirmation_expires_at: "2026-08-09T10:15:00.000-05:00",
    },
    unresolved_slots: [],
    movement_referents: [],
    entity_referents: [],
    active_read_operation: null,
    focus_set: null,
    structure_proposal: null,
    memory_proposal: proposal() as unknown as Record<string, unknown>,
    conversation_style: null,
    updated_at: "2026-08-09T10:00:00.000-05:00",
  };
}

function memory(
  patch: Partial<Awaited<ReturnType<typeof listFinancialMemory>>[number]> = {},
) {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    user_id: "user-1",
    kind: "preference" as const,
    canonical_key: "preference:conversation_style",
    summary: "Prefiero respuestas breves",
    search_terms: ["respuestas", "breves"],
    evidence_source: "explicit_user_statement",
    evidence_ref: "turn-1",
    confidence: 1,
    confirmation_status: "confirmed" as const,
    lifecycle_status: "confirmed" as const,
    sensitivity: "normal" as const,
    valid_until: null,
    superseded_at: null,
    positive_evidence_refs: ["turn-1"],
    negative_evidence_refs: [],
    positive_evidence_count: 1,
    negative_evidence_count: 0,
    explanation: "Confirmado por el usuario.",
    review_at: null,
    last_used_at: null,
    suspended_at: null,
    revoked_at: null,
    revoked_reason: null,
    sensitive_confirmed_at: null,
    source_candidate_id: "candidate-1",
    supersedes_memory_id: null,
    created_at: "2026-07-24T10:00:00.000Z",
    updated_at: "2026-07-24T10:00:00.000Z",
    metadata: {},
    ...patch,
  };
}
