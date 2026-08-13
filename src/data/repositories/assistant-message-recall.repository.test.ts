import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/agents/runtime/openai-embeddings", async () => {
  const actual = await vi.importActual<
    typeof import("@/agents/runtime/openai-embeddings")
  >("@/agents/runtime/openai-embeddings");
  return { ...actual, createMemoryEmbedding: vi.fn() };
});

import type { SupabaseClient } from "@supabase/supabase-js";
import { createMemoryEmbedding } from "@/agents/runtime/openai-embeddings";
import type { Database } from "@/data/supabase/types";
import {
  isAssistantMessageRecallAvailable,
  recallOlderThreadMessages,
  rememberThreadTurnEmbeddings,
  resetAssistantMessageRecallCache,
} from "./assistant-message-recall.repository";

/**
 * `077`: el hilo se recuerda mas alla de la ventana textual. Lo que cuidan
 * estas pruebas no es el ranking en si —eso lo decide el vector— sino sus
 * bordes: que un turno siga funcionando cuando la migracion no esta aplicada o
 * los embeddings no se pueden calcular, y que nada de otro hilo ni de otra
 * persona pueda entrar por esta puerta.
 */

const mockedEmbedding = vi.mocked(createMemoryEmbedding);

const VECTOR = Array.from({ length: 1536 }, () => 0.01);
const userId = "00000000-0000-4000-8000-000000000001";
const threadId = "00000000-0000-4000-8000-0000000000aa";

const MISSING_FUNCTION_ERROR = {
  code: "PGRST202",
  message:
    "Could not find the function public.search_assistant_messages_semantic in the schema cache",
};

type ClientOptions = {
  rows?: Array<Record<string, unknown>>;
  rpcResult?: { data: unknown; error: unknown };
  updateResult?: { data: unknown; error: unknown };
};

function createClient(options: ClientOptions) {
  const calls = {
    rpc: [] as Array<Record<string, unknown>>,
    filters: [] as Array<[string, unknown]>,
    readIds: null as string[] | null,
    updates: [] as Array<Record<string, unknown>>,
  };

  const query = () => {
    const result = {
      select: () => result,
      update(values: Record<string, unknown>) {
        calls.updates.push(values);
        return result;
      },
      eq(column: string, value: unknown) {
        calls.filters.push([column, value]);
        return result;
      },
      is(column: string, value: unknown) {
        calls.filters.push([column, value]);
        // `.is("embedding", null)` cierra la lectura de los mensajes del turno.
        return Promise.resolve({ data: options.rows ?? [], error: null });
      },
      in(_column: string, ids: string[]) {
        calls.readIds = ids;
        return Promise.resolve({
          data: (options.rows ?? []).filter((row) =>
            ids.includes(row.id as string),
          ),
          error: null,
        });
      },
      then(resolve: (value: unknown) => unknown) {
        // La escritura termina en `.select("id")`, sin `in` ni `is`.
        return Promise.resolve(
          options.updateResult ?? { data: [{ id: "msg-1" }], error: null },
        ).then(resolve);
      },
    };
    return result;
  };

  const client = {
    from: () => query(),
    async rpc(name: string, args: Record<string, unknown>) {
      calls.rpc.push({ name, ...args });
      return options.rpcResult ?? { data: [], error: null };
    },
  } as unknown as SupabaseClient<Database>;

  return { client, calls };
}

function textMessage(input: {
  id: string;
  role: string;
  text: string;
  createdAt: string;
}) {
  return {
    id: input.id,
    role: input.role,
    content: [{ kind: "texto", text: input.text }],
    created_at: input.createdAt,
  };
}

beforeEach(() => {
  resetAssistantMessageRecallCache();
  mockedEmbedding.mockReset();
  mockedEmbedding.mockResolvedValue({
    vector: VECTOR,
    model: "text-embedding-3-small",
  });
});

afterEach(() => {
  resetAssistantMessageRecallCache();
});

describe("recallOlderThreadMessages", () => {
  it("devuelve los fragmentos en el orden en que se dijeron, no por similitud", async () => {
    const { client, calls } = createClient({
      rows: [
        textMessage({
          id: "msg-viejo",
          role: "usuario",
          text: "la caja Viaje es para diciembre",
          createdAt: "2026-07-01T10:00:00.000Z",
        }),
        textMessage({
          id: "msg-medio",
          role: "asistente",
          text: "Anotado: la caja Viaje queda para diciembre.",
          createdAt: "2026-07-01T10:01:00.000Z",
        }),
      ],
      rpcResult: {
        data: [
          { id: "msg-medio", similarity: 0.62 },
          { id: "msg-viejo", similarity: 0.81 },
        ],
        error: null,
      },
    });

    const recalled = await recallOlderThreadMessages(client, {
      userId,
      threadId,
      queryText: "cuanto tengo en la caja Viaje?",
      before: "2026-08-01T00:00:00.000Z",
    });

    expect(recalled.map((message) => message.id)).toEqual([
      "msg-viejo",
      "msg-medio",
    ]);
    expect(recalled[0]).toMatchObject({
      role: "usuario",
      text: "la caja Viaje es para diciembre",
      similarity: 0.81,
    });
    // El corte viaja a la funcion: sin el, devolveria lo que ya viaja textual.
    expect(calls.rpc[0]).toMatchObject({
      name: "search_assistant_messages_semantic",
      p_user_id: userId,
      p_thread_id: threadId,
      p_before: "2026-08-01T00:00:00.000Z",
    });
    // Y los mensajes se releen con usuario e hilo repetidos: el ranking da ids,
    // nunca filas.
    expect(calls.readIds).toEqual(["msg-medio", "msg-viejo"]);
    expect(calls.filters).toContainEqual(["user_id", userId]);
    expect(calls.filters).toContainEqual(["thread_id", threadId]);
  });

  it("descarta lo que apenas se parece en vez de arrastrar charla vieja", async () => {
    const { client } = createClient({
      rows: [
        textMessage({
          id: "msg-lejano",
          role: "usuario",
          text: "buenas, como andas",
          createdAt: "2026-07-01T10:00:00.000Z",
        }),
      ],
      rpcResult: { data: [{ id: "msg-lejano", similarity: 0.21 }], error: null },
    });

    await expect(
      recallOlderThreadMessages(client, {
        userId,
        threadId,
        queryText: "cuanto tengo en la caja Viaje?",
        before: "2026-08-01T00:00:00.000Z",
      }),
    ).resolves.toEqual([]);
  });

  it("degrada a vacio y deja de preguntar cuando `077` no esta aplicada", async () => {
    const { client, calls } = createClient({
      rpcResult: { data: null, error: MISSING_FUNCTION_ERROR },
    });

    await expect(
      recallOlderThreadMessages(client, {
        userId,
        threadId,
        queryText: "cuanto tengo en la caja Viaje?",
        before: "2026-08-01T00:00:00.000Z",
      }),
    ).resolves.toEqual([]);
    expect(isAssistantMessageRecallAvailable()).toBe(false);

    // La segunda llamada ni siquiera calcula el vector: no se le cobra a la
    // persona un embedding por una funcion que no existe.
    mockedEmbedding.mockClear();
    await recallOlderThreadMessages(client, {
      userId,
      threadId,
      queryText: "otra pregunta",
      before: "2026-08-01T00:00:00.000Z",
    });
    expect(mockedEmbedding).not.toHaveBeenCalled();
    expect(calls.rpc).toHaveLength(1);
  });

  it("degrada a vacio cuando no hay embedding que calcular", async () => {
    mockedEmbedding.mockResolvedValue(null);
    const { client, calls } = createClient({});

    await expect(
      recallOlderThreadMessages(client, {
        userId,
        threadId,
        queryText: "cuanto tengo en la caja Viaje?",
        before: "2026-08-01T00:00:00.000Z",
      }),
    ).resolves.toEqual([]);
    expect(calls.rpc).toHaveLength(0);
    // Un fallo de la API de embeddings no es una migracion ausente: se sigue
    // intentando en el proximo turno.
    expect(isAssistantMessageRecallAvailable()).toBe(true);
  });
});

describe("rememberThreadTurnEmbeddings", () => {
  it("vectoriza los dos mensajes del turno y no toca los de sistema", async () => {
    const { client, calls } = createClient({
      rows: [
        textMessage({
          id: "msg-usuario",
          role: "usuario",
          text: "cuanto tengo en la caja Viaje?",
          createdAt: "2026-08-07T10:00:00.000Z",
        }),
        textMessage({
          id: "msg-asistente",
          role: "asistente",
          text: "En la caja Viaje tienes S/300.00.",
          createdAt: "2026-08-07T10:00:01.000Z",
        }),
        textMessage({
          id: "msg-sistema",
          role: "sistema",
          text: "nota interna",
          createdAt: "2026-08-07T10:00:02.000Z",
        }),
      ],
    });

    await expect(
      rememberThreadTurnEmbeddings(client, {
        userId,
        threadId,
        traceId: "trace-1",
      }),
    ).resolves.toBe(2);

    expect(calls.updates).toHaveLength(2);
    expect(calls.updates[0]).toMatchObject({
      embedding_model: "text-embedding-3-small",
    });
    expect(String(calls.updates[0].embedding)).toMatch(/^\[0\.01,/);
    // El hash es del texto de cada mensaje: dos textos distintos, dos hashes.
    expect(calls.updates[0].embedding_input_hash).not.toBe(
      calls.updates[1].embedding_input_hash,
    );
  });

  it("no rompe el turno cuando la escritura del vector no toca ninguna fila", async () => {
    const { client } = createClient({
      rows: [
        textMessage({
          id: "msg-usuario",
          role: "usuario",
          text: "cuanto tengo en la caja Viaje?",
          createdAt: "2026-08-07T10:00:00.000Z",
        }),
      ],
      updateResult: { data: [], error: null },
    });

    await expect(
      rememberThreadTurnEmbeddings(client, {
        userId,
        threadId,
        traceId: "trace-1",
      }),
    ).resolves.toBe(0);
  });

  it("no intenta escribir cuando `077` no esta aplicada", async () => {
    const { client, calls } = createClient({
      rows: [
        textMessage({
          id: "msg-usuario",
          role: "usuario",
          text: "cuanto tengo en la caja Viaje?",
          createdAt: "2026-08-07T10:00:00.000Z",
        }),
      ],
      updateResult: { data: null, error: MISSING_FUNCTION_ERROR },
    });

    await expect(
      rememberThreadTurnEmbeddings(client, {
        userId,
        threadId,
        traceId: "trace-1",
      }),
    ).resolves.toBe(0);
    expect(isAssistantMessageRecallAvailable()).toBe(false);

    await rememberThreadTurnEmbeddings(client, {
      userId,
      threadId,
      traceId: "trace-2",
    });
    expect(calls.updates).toHaveLength(1);
  });
});
