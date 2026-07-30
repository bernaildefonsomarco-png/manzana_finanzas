// RUL-PEND-07/ACT-PEND-07 (27 S19 caso 7): deshacer un lote de pendientes
// confirmados dentro de 24h.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  createServiceClient: vi.fn(() => ({})),
  listPendingItemsByBatchId: vi.fn(),
  reopenPendingAfterBatchUndo: vi.fn(),
  getMovementById: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock("@/data/repositories/pending.repository", async (original) => ({
  ...(await original()),
  listPendingItemsByBatchId: mocks.listPendingItemsByBatchId,
  reopenPendingAfterBatchUndo: mocks.reopenPendingAfterBatchUndo,
}));
vi.mock("@/data/repositories/movements.repository", () => ({
  SupabaseFinancialCoreRepository: vi.fn().mockImplementation(function (
    this: { getMovementById: typeof mocks.getMovementById }
  ) {
    this.getMovementById = mocks.getMovementById;
  }),
}));
vi.mock("@/core/finance", () => ({
  CommandDispatcher: vi.fn().mockImplementation(function (
    this: { dispatch: typeof mocks.dispatch }
  ) {
    this.dispatch = mocks.dispatch;
  }),
}));

import { POST } from "./route";

const BATCH_ID = "44444444-4444-4444-8444-444444444444";
const PENDING_ID = "55555555-5555-4555-8555-555555555555";
const MOVEMENT_ID = "66666666-6666-4666-8666-666666666666";

function request() {
  return new Request(`http://localhost/api/v1/pending/batch/${BATCH_ID}/undo`, {
    method: "POST",
  });
}

function context() {
  return { params: Promise.resolve({ batch_id: BATCH_ID }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ userId: "11111111-1111-4111-8111-111111111111", client: {} });
  mocks.dispatch.mockResolvedValue({});
});

describe("POST /api/v1/pending/batch/[batch_id]/undo", () => {
  it("camino feliz: deshace un movimiento generico creado hace menos de 24h", async () => {
    mocks.listPendingItemsByBatchId.mockResolvedValue([
      { id: PENDING_ID, metadata: { confirmed_movement_id: MOVEMENT_ID } },
    ]);
    mocks.getMovementById.mockResolvedValue({
      id: MOVEMENT_ID,
      created_at: new Date().toISOString(),
      debt_id: null,
      recurring_rule_id: null,
    });
    mocks.reopenPendingAfterBatchUndo.mockResolvedValue({ id: PENDING_ID, status: "pending" });

    const response = await POST(request(), context());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.undone).toBe(1);
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "DeleteMovementCommand" })
    );
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await POST(request(), context());

    expect(response.status).toBe(401);
  });

  it("lote de otro usuario o inexistente: 404, nunca 403", async () => {
    mocks.listPendingItemsByBatchId.mockResolvedValue([]);

    const response = await POST(request(), context());

    expect(response.status).toBe(404);
  });

  it("validacion: batch_id invalido devuelve VALIDATION_ERROR", async () => {
    const response = await POST(request(), {
      params: Promise.resolve({ batch_id: "no-es-uuid" }),
    });

    expect(response.status).toBe(400);
  });

  it("fuera del plazo de 24h: se omite, no se intenta deshacer", async () => {
    mocks.listPendingItemsByBatchId.mockResolvedValue([
      { id: PENDING_ID, metadata: { confirmed_movement_id: MOVEMENT_ID } },
    ]);
    mocks.getMovementById.mockResolvedValue({
      id: MOVEMENT_ID,
      created_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      debt_id: null,
      recurring_rule_id: null,
    });

    const response = await POST(request(), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.undone).toBe(0);
    expect(body.data.results[0].reason).toBe("expired_24h");
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
});
