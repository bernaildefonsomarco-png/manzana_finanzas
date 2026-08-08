import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/agents/runtime/openai-embeddings", async () => {
  const actual = await vi.importActual<
    typeof import("@/agents/runtime/openai-embeddings")
  >("@/agents/runtime/openai-embeddings");
  return { ...actual, createMemoryEmbedding: vi.fn() };
});

import { createMemoryEmbedding } from "@/agents/runtime/openai-embeddings";
import {
  buildEmbeddingInput,
  isFinancialMemorySemanticRecallAvailable,
  rememberFinancialMemoryEmbedding,
  resetFinancialMemorySemanticRecallCache,
  searchConfirmedFinancialMemory,
  withoutEmbeddingColumns,
  type FinancialMemoryItem,
} from "./financial-memory.repository";

/**
 * `RUL-MEM-15`: la memoria se recupera por significado. Lo que estas pruebas
 * cuidan no es el ranking en si, sino sus dos bordes: que el turno siga
 * funcionando cuando el vector no esta disponible —`070` sin aplicar,
 * recuerdos sin embeber, API caida— y que el consentimiento siga cortando
 * antes que cualquier similitud.
 */

const mockedEmbedding = vi.mocked(createMemoryEmbedding);

const VECTOR = Array.from({ length: 1536 }, () => 0.01);

const PREFERENCES = {
  user_id: "user-1",
  enabled: true,
  allow_narrative_memory: true,
  allow_sensitive_memory: false,
  consent_version: "learning_v1",
  updated_by: "user",
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  metadata: {},
};

function memoryRow(overrides: Record<string, unknown>) {
  return {
    id: "memory-corto",
    user_id: "user-1",
    kind: "preference",
    canonical_key: "preference:response_length",
    summary: "el usuario prefiere respuestas cortas",
    search_terms: ["brevedad"],
    evidence_source: "conversation",
    evidence_ref: "trace-1",
    confidence: 0.9,
    confirmation_status: "confirmed",
    lifecycle_status: "confirmed",
    sensitivity: "normal",
    valid_until: null,
    superseded_at: null,
    positive_evidence_refs: ["trace-1"],
    negative_evidence_refs: [],
    positive_evidence_count: 1,
    negative_evidence_count: 0,
    explanation: null,
    review_at: null,
    last_used_at: null,
    suspended_at: null,
    revoked_at: null,
    revoked_reason: null,
    sensitive_confirmed_at: null,
    source_candidate_id: null,
    supersedes_memory_id: null,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    metadata: {},
    ...overrides,
  };
}

type ClientOptions = {
  preferences?: Record<string, unknown>;
  rows: Array<Record<string, unknown>>;
  rpcResult?: { data: unknown; error: unknown };
};

/**
 * Cliente minimo: registra si la consulta gobernada se acoto por `in("id")`
 * (camino semantico) o cayo a la ventana por `updated_at` (camino degradado).
 */
function createClient(options: ClientOptions) {
  const calls = {
    rpc: [] as Array<Record<string, unknown>>,
    restrictedIds: null as string[] | null,
    orderedByUpdatedAt: false,
    filters: [] as Array<[string, unknown]>,
  };

  const memoryQuery = () => {
    const result = {
      select: () => result,
      eq(column: string, value: unknown) {
        calls.filters.push([column, value]);
        return result;
      },
      is(column: string, value: unknown) {
        calls.filters.push([column, value]);
        return result;
      },
      or(expression: string) {
        calls.filters.push(["or", expression]);
        return result;
      },
      in(_column: string, ids: string[]) {
        calls.restrictedIds = ids;
        return Promise.resolve({
          data: options.rows.filter((row) => ids.includes(row.id as string)),
          error: null,
        });
      },
      order() {
        calls.orderedByUpdatedAt = true;
        return result;
      },
      limit: () =>
        Promise.resolve({ data: options.rows, error: null }),
    };
    return result;
  };

  const client = {
    from(table: string) {
      if (table === "learning_preferences") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { ...PREFERENCES, ...(options.preferences ?? {}) },
                error: null,
              }),
            }),
          }),
        };
      }
      return memoryQuery();
    },
    async rpc(name: string, args: Record<string, unknown>) {
      calls.rpc.push({ name, ...args });
      return options.rpcResult ?? { data: [], error: null };
    },
  };

  return { client, calls };
}

beforeEach(() => {
  resetFinancialMemorySemanticRecallCache();
  mockedEmbedding.mockReset();
  mockedEmbedding.mockResolvedValue({
    vector: VECTOR,
    model: "text-embedding-3-small",
  });
});

afterEach(() => {
  resetFinancialMemorySemanticRecallCache();
});

describe("RUL-MEM-15: recuperación con vector", () => {
  it("encuentra un recuerdo que no comparte ni una palabra con la pregunta", async () => {
    const { client, calls } = createClient({
      rows: [memoryRow({})],
      rpcResult: {
        data: [{ id: "memory-corto", similarity: 0.71 }],
        error: null,
      },
    });

    const found = await searchConfirmedFinancialMemory(client as never, {
      userId: "user-1",
      queryText: "no te enrolles tanto",
    });

    expect(found.map((item) => item.id)).toEqual(["memory-corto"]);
    expect(calls.restrictedIds).toEqual(["memory-corto"]);
    expect(calls.orderedByUpdatedAt).toBe(false);
  });

  it("ordena por similitud y no por confianza ni por fecha", async () => {
    const { client } = createClient({
      rows: [
        memoryRow({ id: "menos-parecido", confidence: 0.99 }),
        memoryRow({ id: "mas-parecido", confidence: 0.4 }),
      ],
      rpcResult: {
        data: [
          { id: "menos-parecido", similarity: 0.31 },
          { id: "mas-parecido", similarity: 0.88 },
        ],
        error: null,
      },
    });

    const found = await searchConfirmedFinancialMemory(client as never, {
      userId: "user-1",
      queryText: "se breve",
    });

    expect(found.map((item) => item.id)).toEqual([
      "mas-parecido",
      "menos-parecido",
    ]);
  });

  it("descarta al vecino más cercano cuando no se parece de verdad", async () => {
    const { client, calls } = createClient({
      rows: [memoryRow({ id: "sin-relacion" })],
      rpcResult: {
        data: [{ id: "sin-relacion", similarity: 0.04 }],
        error: null,
      },
    });

    await searchConfirmedFinancialMemory(client as never, {
      userId: "user-1",
      queryText: "cuanto gaste ayer",
    });

    // Por debajo del piso de similitud vuelve al camino por tokens.
    expect(calls.restrictedIds).toBeNull();
    expect(calls.orderedByUpdatedAt).toBe(true);
  });

  it("no pide embedding cuando no hay texto que parecerse", async () => {
    const { client } = createClient({ rows: [memoryRow({})] });

    const found = await searchConfirmedFinancialMemory(client as never, {
      userId: "user-1",
      queryText: "",
      limit: 20,
    });

    expect(mockedEmbedding).not.toHaveBeenCalled();
    expect(found).toHaveLength(1);
  });
});

describe("RUL-MEM-15: degradación cuando no hay vector", () => {
  it("sigue buscando por tokens si 070 todavía no está aplicada", async () => {
    const { client, calls } = createClient({
      rows: [memoryRow({})],
      rpcResult: {
        data: null,
        error: {
          code: "PGRST202",
          message:
            "Could not find the function public.search_financial_memory_semantic in the schema cache",
        },
      },
    });

    const found = await searchConfirmedFinancialMemory(client as never, {
      userId: "user-1",
      queryText: "prefiere respuestas cortas",
    });

    expect(found.map((item) => item.id)).toEqual(["memory-corto"]);
    expect(calls.orderedByUpdatedAt).toBe(true);
    expect(isFinancialMemorySemanticRecallAvailable()).toBe(false);
  });

  it("deja de preguntar por la función que no existe", async () => {
    const { client, calls } = createClient({
      rows: [memoryRow({})],
      rpcResult: {
        data: null,
        error: { code: "42883", message: "function does not exist" },
      },
    });

    await searchConfirmedFinancialMemory(client as never, {
      userId: "user-1",
      queryText: "respuestas cortas",
    });
    await searchConfirmedFinancialMemory(client as never, {
      userId: "user-1",
      queryText: "respuestas cortas",
    });

    expect(calls.rpc).toHaveLength(1);
  });

  it("sigue buscando por tokens si la API de embeddings falla", async () => {
    mockedEmbedding.mockResolvedValue(null);
    const { client, calls } = createClient({ rows: [memoryRow({})] });

    const found = await searchConfirmedFinancialMemory(client as never, {
      userId: "user-1",
      queryText: "prefiere respuestas cortas",
    });

    expect(calls.rpc).toHaveLength(0);
    expect(found.map((item) => item.id)).toEqual(["memory-corto"]);
  });

  it("sigue buscando por tokens si ningún recuerdo tiene vector todavía", async () => {
    const { client, calls } = createClient({
      rows: [memoryRow({})],
      rpcResult: { data: [], error: null },
    });

    const found = await searchConfirmedFinancialMemory(client as never, {
      userId: "user-1",
      queryText: "prefiere respuestas cortas",
    });

    expect(calls.orderedByUpdatedAt).toBe(true);
    expect(found.map((item) => item.id)).toEqual(["memory-corto"]);
  });

  /**
   * El camino degradado se conserva tal cual estaba, incluido su sesgo: como
   * `scoreItem` suma la confianza al conteo de tokens, el puntaje nunca llega a
   * cero y devuelve los recuerdos mas confiables aunque no coincida ni una
   * palabra. Es lo que sostiene la llamada de contexto general (`queryText`
   * vacio) y no se toca aqui: sin `070` aplicada, esta linea es la unica red.
   */
  it("el camino degradado sigue devolviendo contexto aunque no haya coincidencia literal", async () => {
    const { client } = createClient({
      rows: [memoryRow({})],
      rpcResult: { data: [], error: null },
    });

    const found = await searchConfirmedFinancialMemory(client as never, {
      userId: "user-1",
      queryText: "helicoptero submarino",
    });

    expect(found.map((item) => item.id)).toEqual(["memory-corto"]);
  });
});

describe("RUL-MEM-15: el gobierno corta antes que la similitud", () => {
  it("no recupera nada si el usuario desactivó el aprendizaje", async () => {
    const { client, calls } = createClient({
      preferences: { enabled: false },
      rows: [memoryRow({})],
      rpcResult: {
        data: [{ id: "memory-corto", similarity: 0.99 }],
        error: null,
      },
    });

    const found = await searchConfirmedFinancialMemory(client as never, {
      userId: "user-1",
      queryText: "no te enrolles tanto",
    });

    expect(found).toEqual([]);
    expect(calls.rpc).toHaveLength(0);
    expect(mockedEmbedding).not.toHaveBeenCalled();
  });

  it("un recuerdo sensible no entra por parecerse mucho", async () => {
    const { client } = createClient({
      preferences: { allow_sensitive_memory: false },
      rows: [
        memoryRow({ id: "sensible", sensitivity: "sensitive" }),
        memoryRow({ id: "normal" }),
      ],
      rpcResult: {
        data: [
          { id: "sensible", similarity: 0.97 },
          { id: "normal", similarity: 0.42 },
        ],
        error: null,
      },
    });

    const found = await searchConfirmedFinancialMemory(client as never, {
      userId: "user-1",
      queryText: "que sabes de mi",
    });

    expect(found.map((item) => item.id)).toEqual(["normal"]);
  });

  it("un hecho narrativo no entra si el usuario no lo permite", async () => {
    const { client } = createClient({
      preferences: { allow_narrative_memory: false },
      rows: [
        memoryRow({ id: "narrativo", kind: "narrative_fact" }),
        memoryRow({ id: "preferencia" }),
      ],
      rpcResult: {
        data: [
          { id: "narrativo", similarity: 0.95 },
          { id: "preferencia", similarity: 0.44 },
        ],
        error: null,
      },
    });

    const found = await searchConfirmedFinancialMemory(client as never, {
      userId: "user-1",
      queryText: "que sabes de mi",
    });

    expect(found.map((item) => item.id)).toEqual(["preferencia"]);
  });

  it("la consulta gobernada conserva sus cuatro filtros con vector", async () => {
    const { client, calls } = createClient({
      rows: [memoryRow({})],
      rpcResult: {
        data: [{ id: "memory-corto", similarity: 0.8 }],
        error: null,
      },
    });

    await searchConfirmedFinancialMemory(client as never, {
      userId: "user-1",
      queryText: "no te enrolles tanto",
      now: "2026-08-07T12:00:00.000Z",
    });

    expect(calls.filters).toEqual([
      ["user_id", "user-1"],
      ["confirmation_status", "confirmed"],
      ["lifecycle_status", "confirmed"],
      ["superseded_at", null],
      ["or", "valid_until.is.null,valid_until.gt.2026-08-07T12:00:00.000Z"],
    ]);
    expect(calls.rpc[0]).toMatchObject({
      name: "search_financial_memory_semantic",
      p_user_id: "user-1",
      p_now: "2026-08-07T12:00:00.000Z",
    });
  });
});

/** Cliente que solo sabe actualizar `financial_memory_items`. */
function createWriteClient(result: { data: unknown; error: unknown }) {
  const updates: Array<Record<string, unknown>> = [];
  const client = {
    from() {
      return {
        update(payload: Record<string, unknown>) {
          updates.push(payload);
          return {
            eq() {
              return this;
            },
            select: async () => result,
          };
        },
      };
    },
  };
  return { client, updates };
}

describe("RUL-MEM-15: el recuerdo recibe su vector al escribirse", () => {
  const memory = memoryRow({}) as unknown as FinancialMemoryItem;

  it("guarda vector, modelo y hash del texto exacto", async () => {
    const { client, updates } = createWriteClient({
      data: [{ id: "memory-corto" }],
      error: null,
    });

    expect(
      await rememberFinancialMemoryEmbedding(client as never, memory),
    ).toBe(true);
    expect(updates[0].embedding_model).toBe("text-embedding-3-small");
    expect(String(updates[0].embedding).startsWith("[0.01,")).toBe(true);
    expect(updates[0].embedding_input_hash).toEqual(expect.any(String));
    expect(mockedEmbedding).toHaveBeenCalledWith(buildEmbeddingInput(memory));
  });

  it("el texto embebido lleva resumen, clave canónica y términos", () => {
    expect(buildEmbeddingInput(memory)).toBe(
      "el usuario prefiere respuestas cortas\npreference:response_length\nbrevedad",
    );
  });

  it("no escribe ni rompe si la API de embeddings falla", async () => {
    mockedEmbedding.mockResolvedValue(null);
    const { client, updates } = createWriteClient({ data: [], error: null });

    expect(
      await rememberFinancialMemoryEmbedding(client as never, memory),
    ).toBe(false);
    expect(updates).toHaveLength(0);
  });

  it("deja de intentar escribir si 070 todavía no está aplicada", async () => {
    const { client } = createWriteClient({
      data: null,
      error: {
        code: "PGRST204",
        message: "Could not find the 'embedding' column in the schema cache",
      },
    });

    expect(
      await rememberFinancialMemoryEmbedding(client as never, memory),
    ).toBe(false);
    expect(isFinancialMemorySemanticRecallAvailable()).toBe(false);
    // Y una vez marcado ausente ya no gasta una llamada de embeddings.
    mockedEmbedding.mockClear();
    await rememberFinancialMemoryEmbedding(client as never, memory);
    expect(mockedEmbedding).not.toHaveBeenCalled();
  });

  it("el vector nunca viaja en un recuerdo del proceso", () => {
    const withVector = {
      ...memory,
      embedding: "[0.1,0.2]",
      embedding_model: "text-embedding-3-small",
      embedding_input_hash: "abc",
      embedding_generated_at: "2026-08-07T00:00:00.000Z",
    };

    expect(withoutEmbeddingColumns(withVector)).not.toHaveProperty("embedding");
    expect(withoutEmbeddingColumns(withVector)).not.toHaveProperty(
      "embedding_model",
    );
    expect(withoutEmbeddingColumns(withVector).summary).toBe(memory.summary);
  });
});
