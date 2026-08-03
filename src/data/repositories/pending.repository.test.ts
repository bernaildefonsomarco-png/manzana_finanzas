import { describe, expect, it, vi } from "vitest";
import {
  listPendingItemsBySourceRefPrefix,
  PendingRepositoryError,
} from "./pending.repository";

const userId = "00000000-0000-4000-8000-000000000001";

function fakeClient(result: { data: unknown[] | null; error: { message: string } | null }) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "like"]) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    });
  }
  builder.order = vi.fn((...args: unknown[]) => {
    calls.push({ method: "order", args });
    return Promise.resolve(result);
  });
  return { client: { from: vi.fn(() => builder) }, calls };
}

describe("listPendingItemsBySourceRefPrefix (41 fase 2, WEB-D263)", () => {
  it("filtra por user_id y por el prefijo real de source_ref del turno", async () => {
    const pendingRow = { id: "pending-1", source_ref: "dashboard:event-1:action_1" };
    const { client, calls } = fakeClient({ data: [pendingRow], error: null });

    const result = await listPendingItemsBySourceRefPrefix(
      client as never,
      userId,
      "dashboard:event-1:",
    );

    expect(result).toEqual([pendingRow]);
    expect(calls).toContainEqual({ method: "eq", args: ["user_id", userId] });
    expect(calls).toContainEqual({
      method: "like",
      args: ["source_ref", "dashboard:event-1:%"],
    });
  });

  it("devuelve un arreglo vacio cuando no hay pendientes para el prefijo", async () => {
    const { client } = fakeClient({ data: [], error: null });

    const result = await listPendingItemsBySourceRefPrefix(
      client as never,
      userId,
      "dashboard:event-sin-pendientes:",
    );

    expect(result).toEqual([]);
  });

  it("lanza PendingRepositoryError si la consulta falla", async () => {
    const { client } = fakeClient({ data: null, error: { message: "boom" } });

    await expect(
      listPendingItemsBySourceRefPrefix(client as never, userId, "dashboard:event-1:"),
    ).rejects.toBeInstanceOf(PendingRepositoryError);
  });
});
