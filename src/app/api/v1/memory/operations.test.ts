import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  commitMemoryOperation: vi.fn(),
  listProfileCandidates: vi.fn(),
  resolveProfileCandidate: vi.fn(),
  listMemoryEvents: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/memory.repository", async (original) => ({
  ...(await original()),
  commitMemoryOperation: mocks.commitMemoryOperation,
  listProfileCandidates: mocks.listProfileCandidates,
  resolveProfileCandidate: mocks.resolveProfileCandidate,
  listMemoryEvents: mocks.listMemoryEvents,
}));

import { MemoryRepositoryError } from "@/data/repositories/memory.repository";
import { GET as getCandidates } from "./candidates/route";
import { POST as resolveCandidate } from "./candidates/[id]/[action]/route";
import { GET as getEvents } from "./events/route";
import { POST as reactivate } from "./[id]/reactivate/route";
import { POST as undo } from "./[id]/undo/route";
import { POST as view } from "./[id]/view/route";

const id = "11111111-1111-4111-8111-111111111111";
const client = { rls: true };
const context = { params: Promise.resolve({ id }) };
const actionContext = (action = "confirm", value = id) => ({
  params: Promise.resolve({ id: value, action }),
});

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getApiAuth.mockResolvedValue({ userId: "user-1", client });
  mocks.commitMemoryOperation.mockResolvedValue({ memory: { id }, replacement: null, idempotent: false });
  mocks.listProfileCandidates.mockResolvedValue([{ id, statement: "Cobras el 15" }]);
  mocks.resolveProfileCandidate.mockResolvedValue({ candidate: { id }, fact: { id: "fact-1" }, idempotent: false });
  mocks.listMemoryEvents.mockResolvedValue([{ id: "event-1", created_at: "2026-08-01T00:00:00Z" }]);
});

function operationRequest(path: string, scope: unknown = "classification", key = "operation-1") {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": key },
    body: JSON.stringify({ scope }),
  });
}

describe.each([
  ["undo", undo],
  ["reactivate", reactivate],
  ["view", view],
] as const)("POST /memory/[id]/%s — cinco casos", (operation, handler) => {
  it("camino feliz", async () => {
    expect((await handler(operationRequest(`/api/v1/memory/${id}/${operation}`), context)).status).toBe(200);
    expect(mocks.commitMemoryOperation).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ operation, userId: "user-1" }),
    );
  });
  it("sin sesión devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await handler(operationRequest(`/api/v1/memory/${id}/${operation}`), context)).status).toBe(401);
  });
  it("recurso ajeno devuelve 404", async () => {
    mocks.commitMemoryOperation.mockRejectedValue(new MemoryRepositoryError("NOT_FOUND", "No encontrado"));
    expect((await handler(operationRequest(`/api/v1/memory/${id}/${operation}`), context)).status).toBe(404);
  });
  it("rechaza alcance inválido y clave ausente", async () => {
    expect((await handler(operationRequest(`/api/v1/memory/${id}/${operation}`, "otro"), context)).status).toBe(400);
    expect((await handler(operationRequest(`/api/v1/memory/${id}/${operation}`, "profile", ""), context)).status).toBe(400);
  });
  it("marca replay idempotente", async () => {
    mocks.commitMemoryOperation.mockResolvedValue({ memory: { id }, replacement: null, idempotent: true });
    const payload = await (await handler(operationRequest(`/api/v1/memory/${id}/${operation}`), context)).json();
    expect(payload.meta.idempotent_replay).toBe(true);
  });
});

describe("GET /memory/candidates — cinco casos", () => {
  it("muestra como máximo un candidato pendiente", async () => {
    const response = await getCandidates(new Request("http://localhost/api/v1/memory/candidates"));
    expect(response.status).toBe(200);
    expect(mocks.listProfileCandidates).toHaveBeenCalledWith(client, expect.objectContaining({ userId: "user-1", limit: 1 }));
  });
  it("sin sesión devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await getCandidates(new Request("http://localhost/api/v1/memory/candidates"))).status).toBe(401);
  });
  it("aisla por el usuario autenticado", async () => {
    await getCandidates(new Request("http://localhost/api/v1/memory/candidates"));
    expect(mocks.listProfileCandidates).toHaveBeenCalledWith(client, expect.objectContaining({ userId: "user-1" }));
  });
  it("rechaza filtros de otro usuario", async () => {
    expect((await getCandidates(new Request("http://localhost/api/v1/memory/candidates?user_id=user-2"))).status).toBe(400);
  });
  it("repetir lectura no resuelve candidatos", async () => {
    await getCandidates(new Request("http://localhost/api/v1/memory/candidates"));
    await getCandidates(new Request("http://localhost/api/v1/memory/candidates"));
    expect(mocks.resolveProfileCandidate).not.toHaveBeenCalled();
  });
});

describe("POST /memory/candidates/[id]/[action] — cinco casos", () => {
  const request = (key = "candidate-1", body: unknown = {}) => new Request(
    `http://localhost/api/v1/memory/candidates/${id}/confirm`,
    { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(body) },
  );
  it("confirma explícitamente antes de crear el hecho", async () => {
    expect((await resolveCandidate(request(), actionContext())).status).toBe(200);
  });
  it("sin sesión devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await resolveCandidate(request(), actionContext())).status).toBe(401);
  });
  it("candidato ajeno devuelve 404", async () => {
    mocks.resolveProfileCandidate.mockRejectedValue(new MemoryRepositoryError("NOT_FOUND", "No encontrado"));
    expect((await resolveCandidate(request(), actionContext())).status).toBe(404);
  });
  it("rechaza acción desconocida y body desconocido", async () => {
    expect((await resolveCandidate(request(), actionContext("accept"))).status).toBe(400);
    expect((await resolveCandidate(request("candidate-2", { extra: true }), actionContext())).status).toBe(400);
  });
  it("marca replay y conflicto idempotente", async () => {
    mocks.resolveProfileCandidate.mockResolvedValue({ candidate: { id }, fact: null, idempotent: true });
    expect((await (await resolveCandidate(request(), actionContext())).json()).meta.idempotent_replay).toBe(true);
    mocks.resolveProfileCandidate.mockRejectedValue(new MemoryRepositoryError("CONFLICT", "Conflicto"));
    expect((await resolveCandidate(request(), actionContext())).status).toBe(409);
  });
});

describe("GET /memory/events — cinco casos", () => {
  it("lista auditoría paginada", async () => {
    expect((await getEvents(new Request("http://localhost/api/v1/memory/events?limit=1"))).status).toBe(200);
  });
  it("sin sesión devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await getEvents(new Request("http://localhost/api/v1/memory/events"))).status).toBe(401);
  });
  it("aisla por usuario autenticado", async () => {
    await getEvents(new Request("http://localhost/api/v1/memory/events"));
    expect(mocks.listMemoryEvents).toHaveBeenCalledWith(client, expect.objectContaining({ userId: "user-1" }));
  });
  it("rechaza cursor y filtros inválidos", async () => {
    expect((await getEvents(new Request("http://localhost/api/v1/memory/events?cursor=no"))).status).toBe(400);
    expect((await getEvents(new Request("http://localhost/api/v1/memory/events?user_id=user-2"))).status).toBe(400);
  });
  it("repetir lectura no ejecuta mutaciones", async () => {
    await getEvents(new Request("http://localhost/api/v1/memory/events"));
    await getEvents(new Request("http://localhost/api/v1/memory/events"));
    expect(mocks.commitMemoryOperation).not.toHaveBeenCalled();
  });
});
