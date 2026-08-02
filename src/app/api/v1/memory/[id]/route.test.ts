import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  getMemoryDetail: vi.fn(),
  commitMemoryOperation: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/memory.repository", async (original) => ({
  ...(await original()),
  getMemoryDetail: mocks.getMemoryDetail,
  commitMemoryOperation: mocks.commitMemoryOperation,
}));

import { MemoryRepositoryError } from "@/data/repositories/memory.repository";
import { DELETE, GET, PATCH } from "./route";

const id = "11111111-1111-4111-8111-111111111111";
const context = (value = id) => ({ params: Promise.resolve({ id: value }) });
const auth = { userId: "user-1", client: { rls: true } };
const item = {
  id, scope: "classification", subject_key: "merchant:rappi",
  statement: "Rappi va en Alimentación", status: "confirmed", active: true,
  positive_evidence_refs: ["movement:1"], negative_evidence_refs: [],
  positive_evidence_count: 1, negative_evidence_count: 0,
  created_at: "2026-07-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z",
  last_used_at: null, can_reactivate: false,
};

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getApiAuth.mockResolvedValue(auth);
  mocks.getMemoryDetail.mockResolvedValue({ memory: item, events: [] });
  mocks.commitMemoryOperation.mockResolvedValue({ memory: item, replacement: null, idempotent: false });
});

describe("GET /memory/[id] — cinco casos", () => {
  it("devuelve detalle e historial", async () => {
    expect((await GET(new Request(`http://localhost/api/v1/memory/${id}`), context())).status).toBe(200);
  });
  it("sin sesión devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await GET(new Request(`http://localhost/api/v1/memory/${id}`), context())).status).toBe(401);
  });
  it("un recurso ajeno o inexistente devuelve 404, nunca 403", async () => {
    mocks.getMemoryDetail.mockResolvedValue(null);
    expect((await GET(new Request(`http://localhost/api/v1/memory/${id}`), context())).status).toBe(404);
  });
  it("rechaza un id inválido", async () => {
    expect((await GET(new Request("http://localhost/api/v1/memory/no"), context("no"))).status).toBe(400);
  });
  it("repetir la lectura no ejecuta mutaciones", async () => {
    await GET(new Request(`http://localhost/api/v1/memory/${id}`), context());
    await GET(new Request(`http://localhost/api/v1/memory/${id}`), context());
    expect(mocks.commitMemoryOperation).not.toHaveBeenCalled();
  });
});

describe("PATCH /memory/[id] — cinco casos", () => {
  const request = (body: unknown = { scope: "classification", statement: "Ahora va en Ocio" }, key = "correct-1") =>
    new Request(`http://localhost/api/v1/memory/${id}`, {
      method: "PATCH", headers: { "content-type": "application/json", "idempotency-key": key },
      body: JSON.stringify(body),
    });
  it("corrige encadenando por el RPC del alcance", async () => {
    expect((await PATCH(request(), context())).status).toBe(200);
  });
  it("sin sesión devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await PATCH(request(), context())).status).toBe(401);
  });
  it("un recurso ajeno devuelve 404", async () => {
    mocks.commitMemoryOperation.mockRejectedValue(new MemoryRepositoryError("NOT_FOUND", "No encontrado"));
    expect((await PATCH(request(), context())).status).toBe(404);
  });
  it("rechaza body incompleto y ausencia de clave", async () => {
    expect((await PATCH(request({ scope: "classification" }), context())).status).toBe(400);
    expect((await PATCH(request(undefined, ""), context())).status).toBe(400);
  });
  it("marca replay y conflicto idempotente", async () => {
    mocks.commitMemoryOperation.mockResolvedValue({ memory: item, replacement: null, idempotent: true });
    expect((await (await PATCH(request(), context())).json()).meta.idempotent_replay).toBe(true);
    mocks.commitMemoryOperation.mockRejectedValue(new MemoryRepositoryError("CONFLICT", "Conflicto"));
    expect((await PATCH(request(), context())).status).toBe(409);
  });
});

describe("DELETE /memory/[id] — cinco casos", () => {
  const request = (body: unknown = { scope: "classification" }, key = "forget-1") =>
    new Request(`http://localhost/api/v1/memory/${id}`, {
      method: "DELETE", headers: { "content-type": "application/json", "idempotency-key": key },
      body: JSON.stringify(body),
    });
  it("olvida con lápida a través del comando", async () => {
    expect((await DELETE(request(), context())).status).toBe(200);
    expect(mocks.commitMemoryOperation).toHaveBeenCalledWith(
      { rls: true }, expect.objectContaining({ operation: "forget", userId: "user-1" }),
    );
  });
  it("sin sesión devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await DELETE(request(), context())).status).toBe(401);
  });
  it("un recurso ajeno devuelve 404", async () => {
    mocks.commitMemoryOperation.mockRejectedValue(new MemoryRepositoryError("NOT_FOUND", "No encontrado"));
    expect((await DELETE(request(), context())).status).toBe(404);
  });
  it("rechaza alcance inválido", async () => {
    expect((await DELETE(request({ scope: "todo" }), context())).status).toBe(400);
  });
  it("replay no repite efectos y queda declarado", async () => {
    mocks.commitMemoryOperation.mockResolvedValue({ memory: item, replacement: null, idempotent: true });
    expect((await (await DELETE(request(), context())).json()).meta.idempotent_replay).toBe(true);
  });
});
