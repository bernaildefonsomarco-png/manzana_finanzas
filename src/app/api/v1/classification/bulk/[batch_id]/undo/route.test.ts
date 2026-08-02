import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClassificationOperationError } from "@/data/repositories/classification.repository";
import { POST } from "./route";

const BATCH_ID = "33333333-3333-4333-8333-333333333333";
const mocks = vi.hoisted(() => ({ getApiAuth: vi.fn(), undoClassificationBatch: vi.fn() }));
vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/classification.repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/data/repositories/classification.repository")>()),
  undoClassificationBatch: mocks.undoClassificationBatch,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
  mocks.undoClassificationBatch.mockResolvedValue({
    batch: { id: BATCH_ID, status: "undone", movement_count: 3 },
    idempotent: false,
  });
});

describe("POST /api/v1/classification/bulk/[batch_id]/undo", () => {
  it("camino feliz: deshace el lote completo", async () => {
    const body = await (await POST(request(), context(BATCH_ID))).json();
    expect(body.data.batch).toMatchObject({ status: "undone", movement_count: 3 });
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await POST(request(), context(BATCH_ID))).status).toBe(401);
  });

  it("lote de otro usuario: 404, nunca 403", async () => {
    mocks.undoClassificationBatch.mockRejectedValue(
      new ClassificationOperationError("CLASSIFICATION_BATCH_NOT_FOUND", "No encontre ese lote."),
    );
    expect((await POST(request(), context(BATCH_ID))).status).toBe(404);
  });

  it("validacion: batch_id invalido devuelve VALIDATION_ERROR", async () => {
    const response = await POST(request(), context("no-es-uuid"));
    expect(response.status).toBe(400);
    expect(mocks.undoClassificationBatch).not.toHaveBeenCalled();
  });

  it("idempotencia: repetir el undo devuelve replay", async () => {
    mocks.undoClassificationBatch.mockResolvedValue({
      batch: { id: BATCH_ID, status: "undone" },
      idempotent: true,
    });
    const body = await (await POST(request(), context(BATCH_ID))).json();
    expect(body.meta.idempotent_replay).toBe(true);
  });
});

function request() {
  return new Request(`http://localhost/api/v1/classification/bulk/${BATCH_ID}/undo`, {
    method: "POST",
    headers: { "idempotency-key": "classification-undo-1" },
  });
}

function context(batch_id: string) {
  return { params: Promise.resolve({ batch_id }) };
}
