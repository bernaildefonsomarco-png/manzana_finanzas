import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClassificationOperationError } from "@/data/repositories/classification.repository";
import { POST } from "./route";

const MOVEMENT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  classifyMovementsInBulk: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/classification.repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/data/repositories/classification.repository")>()),
  classifyMovementsInBulk: mocks.classifyMovementsInBulk,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
  mocks.classifyMovementsInBulk.mockResolvedValue({
    preview: true,
    count: 1,
    sample: { id: MOVEMENT_ID, amount: 25.5 },
    movements: [{ id: MOVEMENT_ID, amount: 25.5 }],
    excluded_count: 0,
    idempotent: false,
  });
});

describe("POST /api/v1/classification/bulk", () => {
  it("camino feliz: preview devuelve conteo y muestra sin confirmar", async () => {
    const response = await POST(request({
      movement_ids: [MOVEMENT_ID],
      excluded_ids: [],
      category_id: "alimentacion",
      subcategory_id: null,
      preview: true,
    }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.preview).toMatchObject({ count: 1, sample: { id: MOVEMENT_ID } });
    expect(mocks.classifyMovementsInBulk).toHaveBeenCalledWith({}, expect.objectContaining({ preview: true }));
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await POST(request(validBody()))).status).toBe(401);
  });

  it("movimiento de otro usuario: 404, nunca 403", async () => {
    mocks.classifyMovementsInBulk.mockRejectedValue(
      new ClassificationOperationError("MOVEMENT_NOT_FOUND", "No encontre ese movimiento."),
    );
    expect((await POST(request(validBody()))).status).toBe(404);
  });

  it("validacion: no permite excluir un id fuera de la seleccion", async () => {
    const response = await POST(request({ ...validBody(), excluded_ids: [OTHER_ID] }));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mocks.classifyMovementsInBulk).not.toHaveBeenCalled();
  });

  it("idempotencia: el retry del commit se marca como replay", async () => {
    mocks.classifyMovementsInBulk.mockResolvedValue({
      batch: { id: "33333333-3333-4333-8333-333333333333", movement_count: 1 },
      idempotent: true,
    });
    const body = await (await POST(request(validBody()))).json();
    expect(body.meta.idempotent_replay).toBe(true);
  });
});

function validBody() {
  return {
    movement_ids: [MOVEMENT_ID],
    excluded_ids: [],
    category_id: "alimentacion",
    subcategory_id: null,
    preview: false,
  };
}

function request(body: unknown) {
  return new Request("http://localhost/api/v1/classification/bulk", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": "classification-bulk-1",
    },
    body: JSON.stringify(body),
  });
}
