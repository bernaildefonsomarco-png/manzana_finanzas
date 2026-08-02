import { describe, expect, it, vi } from "vitest";
import {
  getHomeHiddenBlocks,
  recordHomeUsageProfile,
  setHomeBlockHidden,
} from "./home.repository";

type Row = { id: string; observation_count: number; value?: unknown } | null;

function chainableClient(existing: Row) {
  const inserted: unknown[] = [];
  const updated: Array<{ id: string; payload: unknown }> = [];

  function selectBuilder() {
    const builder = {
      eq: () => builder,
      maybeSingle: async () => ({ data: existing, error: null }),
    };
    return builder;
  }

  const from = vi.fn((_table: string) => ({
    select: () => selectBuilder(),
    update: (payload: unknown) => ({
      eq: async (_column: string, id: string) => {
        updated.push({ id, payload });
        return { error: null };
      },
    }),
    insert: async (payload: unknown) => {
      inserted.push(payload);
      return { error: null };
    },
  }));

  const client = { from } as unknown as Parameters<typeof getHomeHiddenBlocks>[0];
  return { client, inserted, updated };
}

describe("home.repository: preferencias del Inicio", () => {
  it("sin fila previa, no hay bloques ocultos", async () => {
    const { client } = chainableClient(null);
    expect(await getHomeHiddenBlocks(client, "user-1")).toEqual([]);
  });

  it("filtra valores desconocidos y no-string del value persistido", async () => {
    const { client } = chainableClient({ id: "p1", observation_count: 1, value: ["movements", "no_existe", 42] });
    expect(await getHomeHiddenBlocks(client, "user-1")).toEqual(["movements"]);
  });

  it("ocultar un bloque nuevo inserta una fila con status activa", async () => {
    const { client, inserted } = chainableClient(null);
    const next = await setHomeBlockHidden(client, "user-1", "movements", true);
    expect(next).toEqual(["movements"]);
    expect(inserted).toEqual([
      {
        user_id: "user-1",
        source_module: "home",
        key: "home.bloques_ocultos",
        value: ["movements"],
        status: "activa",
      },
    ]);
  });

  it("ocultar un bloque cuando ya existe una fila activa actualiza en vez de insertar", async () => {
    const { client, inserted, updated } = chainableClient({
      id: "p1",
      observation_count: 3,
      value: ["free_money"],
    });
    const next = await setHomeBlockHidden(client, "user-1", "movements", true);
    expect(next.sort()).toEqual(["free_money", "movements"].sort());
    expect(inserted).toEqual([]);
    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe("p1");
    expect((updated[0].payload as { observation_count: number }).observation_count).toBe(4);
  });

  it("ocultar dos veces el mismo bloque es idempotente: no vuelve a escribir", async () => {
    const { client, inserted, updated } = chainableClient({
      id: "p1",
      observation_count: 1,
      value: ["movements"],
    });
    const next = await setHomeBlockHidden(client, "user-1", "movements", true);
    expect(next).toEqual(["movements"]);
    expect(inserted).toEqual([]);
    expect(updated).toEqual([]);
  });

  it("WEB-D064: mostrar un bloque antes oculto lo quita de la lista", async () => {
    const { client, updated } = chainableClient({
      id: "p1",
      observation_count: 2,
      value: ["movements", "insight"],
    });
    const next = await setHomeBlockHidden(client, "user-1", "movements", false);
    expect(next).toEqual(["insight"]);
    expect((updated[0].payload as { value: string[] }).value).toEqual(["insight"]);
  });

  it("registra el perfil de uso como una preferencia mas, sin leerla de vuelta en el compositor", async () => {
    const { client, inserted } = chainableClient(null);
    await recordHomeUsageProfile(client, "user-1", ["gastos", "cajas"]);
    expect(inserted).toEqual([
      {
        user_id: "user-1",
        source_module: "home",
        key: "home.uso_detectado",
        value: ["gastos", "cajas"],
        status: "activa",
      },
    ]);
  });
});
