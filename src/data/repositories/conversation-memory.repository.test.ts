import { beforeEach, describe, expect, it } from "vitest";
import {
  getActiveConversationMemoryState,
  isConversationMemoryThreadScopeEnforced,
  resetConversationMemoryThreadScopeCache,
  upsertConversationMemoryState,
} from "./conversation-memory.repository";

/**
 * `069_conversation_memory_thread_scope.sql` todavia puede no estar aplicada
 * cuando el codigo ya esta desplegado. El repositorio tiene que seguir leyendo
 * y escribiendo memoria conversacional en ese caso —degradado al
 * comportamiento heredado— en vez de quedarse mudo, porque la barrera que
 * impide ejecutar una correccion vieja no vive aqui sino en el `working_set`.
 */

type Call = {
  filters: Array<[string, unknown]>;
  onConflict: string | null;
  payload: Record<string, unknown> | null;
};

const MISSING_COLUMN_ERROR = {
  code: "42703",
  message: 'column conversation_memory_states.thread_key does not exist',
};

const ROW = {
  id: "state-1",
  user_id: "user-1",
  channel: "dashboard",
  scope: "default",
  last_intent: null,
  last_query_kind: null,
  last_query_text: null,
  last_query_date_range: null,
  last_tool_name: null,
  last_result_summary: null,
  referenced_movements: [],
  referenced_entities: [],
  continuity_hint: null,
  source_ref: null,
  expires_at: "2026-08-06T12:00:00.000-05:00",
  created_at: "2026-08-06T10:00:00.000-05:00",
  updated_at: "2026-08-06T10:00:00.000-05:00",
  metadata: {},
};

/** Cliente que rechaza cualquier operacion que mencione la columna nueva. */
function createClientWithoutThreadColumn() {
  const calls: Call[] = [];

  const builder = (call: Call) => {
    const result = {
      eq(column: string, value: unknown) {
        call.filters.push([column, value]);
        return result;
      },
      gt() {
        return result;
      },
      order() {
        return result;
      },
      limit() {
        return result;
      },
      select() {
        return result;
      },
      maybeSingle: async () => resolve(call),
      single: async () => resolve(call),
    };
    return result;
  };

  const mentionsThread = (call: Call) =>
    call.filters.some(([column]) => column === "thread_key") ||
    call.onConflict?.includes("thread_key") === true ||
    (call.payload !== null && "thread_key" in call.payload);

  const resolve = async (call: Call) =>
    mentionsThread(call)
      ? { data: null, error: MISSING_COLUMN_ERROR }
      : { data: ROW, error: null };

  const client = {
    from() {
      return {
        select() {
          const call: Call = { filters: [], onConflict: null, payload: null };
          calls.push(call);
          return builder(call);
        },
        upsert(payload: Record<string, unknown>, options: { onConflict: string }) {
          const call: Call = {
            filters: [],
            onConflict: options.onConflict,
            payload,
          };
          calls.push(call);
          return builder(call);
        },
      };
    },
  } as never;

  return { client, calls };
}

describe("memoria conversacional sin la migracion 069 aplicada", () => {
  beforeEach(() => {
    resetConversationMemoryThreadScopeCache();
  });

  it("lee el estado heredado en vez de devolver null", async () => {
    const { client, calls } = createClientWithoutThreadColumn();

    const state = await getActiveConversationMemoryState(client, {
      userId: "user-1",
      channel: "dashboard",
      threadKey: "hilo:1",
    });

    expect(state?.id).toBe("state-1");
    // Sin columna, el estado se presenta como heredado (nunca coincide con la
    // clave de un turno real, asi que no confirma correcciones por texto).
    expect(state?.thread_key).toBe("");
    expect(calls[0]?.filters).toContainEqual(["thread_key", "hilo:1"]);
    expect(calls[1]?.filters).not.toContainEqual(["thread_key", "hilo:1"]);
    expect(isConversationMemoryThreadScopeEnforced()).toBe(false);
  });

  it("escribe con la clave vieja en vez de perder la memoria del turno", async () => {
    const { client, calls } = createClientWithoutThreadColumn();

    const written = await upsertConversationMemoryState(client, {
      userId: "user-1",
      channel: "dashboard",
      threadKey: "hilo:1",
      lastIntent: null,
      lastQueryKind: null,
      lastQueryText: null,
      lastQueryDateRange: null,
      lastToolName: null,
      lastResultSummary: null,
      referencedMovements: [],
      continuityHint: null,
    });

    expect(written?.id).toBe("state-1");
    expect(calls[0]?.onConflict).toBe("user_id,scope,thread_key");
    expect(calls[1]?.onConflict).toBe("user_id,scope");
    expect(calls[1]?.payload).not.toHaveProperty("thread_key");
  });

  it("deja de reintentar la columna una vez que sabe que no existe", async () => {
    const { client, calls } = createClientWithoutThreadColumn();

    await getActiveConversationMemoryState(client, {
      userId: "user-1",
      channel: "dashboard",
      threadKey: "hilo:1",
    });
    const afterFirst = calls.length;

    await getActiveConversationMemoryState(client, {
      userId: "user-1",
      channel: "dashboard",
      threadKey: "hilo:1",
    });

    expect(calls.length).toBe(afterFirst + 1);
  });
});
