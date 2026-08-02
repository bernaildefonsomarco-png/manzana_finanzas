import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClassificationOperationError } from "@/data/repositories/classification.repository";
import { POST } from "./route";

const SOURCE_ID = "11111111-1111-4111-8111-111111111111";
const TARGET_ID = "22222222-2222-4222-8222-222222222222";
const BATCH_ID = "33333333-3333-4333-8333-333333333333";
const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  mergeSubcategories: vi.fn(),
  undoClassificationBatch: vi.fn(),
}));
vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/classification.repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/data/repositories/classification.repository")>()),
  mergeSubcategories: mocks.mergeSubcategories,
  undoClassificationBatch: mocks.undoClassificationBatch,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
  mocks.mergeSubcategories.mockResolvedValue({
    preview: true,
    count: 47,
    target_count_before: 89,
    target_count_after: 136,
    movements: [{ id: "m1" }],
    idempotent: false,
  });
  mocks.undoClassificationBatch.mockResolvedValue({
    batch: { id: BATCH_ID, kind: "merge", status: "undone", movement_count: 47 },
    idempotent: false,
  });
});

describe("POST /api/v1/subcategories/[id]/merge", () => {
  it("RUL-CAT-07: preview de 47 sobre 89 muestra que el destino quedara con 136", async () => {
    const response = await POST(request({ target_subcategory_id: TARGET_ID, preview: true }), context(SOURCE_ID));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.preview).toMatchObject({
      count: 47,
      target_count_before: 89,
      target_count_after: 136,
    });
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await POST(request({ target_subcategory_id: TARGET_ID, preview: false }), context(SOURCE_ID))).status).toBe(401);
  });

  it("subcategoria de otro usuario: 404, nunca 403", async () => {
    mocks.mergeSubcategories.mockRejectedValue(
      new ClassificationOperationError("SUBCATEGORY_NOT_FOUND", "No encontre esa subcategoria."),
    );
    expect((await POST(request({ target_subcategory_id: TARGET_ID, preview: false }), context(SOURCE_ID))).status).toBe(404);
  });

  it("validacion: target invalido devuelve VALIDATION_ERROR", async () => {
    const response = await POST(request({ target_subcategory_id: "no-es-uuid", preview: false }), context(SOURCE_ID));
    expect(response.status).toBe(400);
    expect(mocks.mergeSubcategories).not.toHaveBeenCalled();
  });

  it("idempotencia: repetir commit devuelve replay", async () => {
    mocks.mergeSubcategories.mockResolvedValue({
      batch: { id: BATCH_ID, kind: "merge", movement_count: 47 },
      idempotent: true,
    });
    const body = await (await POST(
      request({ target_subcategory_id: TARGET_ID, preview: false }),
      context(SOURCE_ID),
    )).json();
    expect(body.meta.idempotent_replay).toBe(true);
  });

  it("deshacer usa el mismo contrato y limita el batch al origen de la URL", async () => {
    const body = await (await POST(request({ undo_batch_id: BATCH_ID }), context(SOURCE_ID))).json();
    expect(body.data.batch.status).toBe("undone");
    expect(mocks.undoClassificationBatch).toHaveBeenCalledWith({}, expect.objectContaining({
      expectedKind: "merge",
      expectedSourceId: SOURCE_ID,
    }));
  });
});

function request(body: unknown) {
  return new Request(`http://localhost/api/v1/subcategories/${SOURCE_ID}/merge`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": "subcategory-merge-1",
    },
    body: JSON.stringify(body),
  });
}

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}
