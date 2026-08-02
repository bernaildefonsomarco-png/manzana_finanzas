import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClassificationOperationError } from "@/data/repositories/classification.repository";
import { PATCH } from "./route";

const MOVEMENT_ID = "11111111-1111-4111-8111-111111111111";
const mocks = vi.hoisted(() => ({ getApiAuth: vi.fn(), classifyMovement: vi.fn() }));
vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/classification.repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/data/repositories/classification.repository")>()),
  classifyMovement: mocks.classifyMovement,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
  mocks.classifyMovement.mockResolvedValue({
    movement: { id: MOVEMENT_ID, category_id: "transporte", subcategory_id: null },
    idempotent: false,
  });
});

describe("PATCH /api/v1/movements/[id]/classification", () => {
  it("camino feliz: corrige la categoria por el RPC auditable", async () => {
    const body = await (await PATCH(request(validBody()), context(MOVEMENT_ID))).json();
    expect(body.data.movement.category_id).toBe("transporte");
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await PATCH(request(validBody()), context(MOVEMENT_ID))).status).toBe(401);
  });

  it("movimiento de otro usuario: 404, nunca 403", async () => {
    mocks.classifyMovement.mockRejectedValue(
      new ClassificationOperationError("MOVEMENT_NOT_FOUND", "No encontre ese movimiento."),
    );
    expect((await PATCH(request(validBody()), context(MOVEMENT_ID))).status).toBe(404);
  });

  it("validacion: una subcategoria no puede ir sin categoria", async () => {
    const response = await PATCH(request({
      category_id: null,
      subcategory_id: "22222222-2222-4222-8222-222222222222",
    }), context(MOVEMENT_ID));
    expect(response.status).toBe(400);
    expect(mocks.classifyMovement).not.toHaveBeenCalled();
  });

  it("idempotencia: repetir la correccion se marca como replay", async () => {
    mocks.classifyMovement.mockResolvedValue({
      movement: { id: MOVEMENT_ID, category_id: "transporte" },
      idempotent: true,
    });
    const body = await (await PATCH(request(validBody()), context(MOVEMENT_ID))).json();
    expect(body.meta.idempotent_replay).toBe(true);
  });
});

function validBody() {
  return { category_id: "transporte", subcategory_id: null };
}

function request(body: unknown) {
  return new Request(`http://localhost/api/v1/movements/${MOVEMENT_ID}/classification`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "idempotency-key": "movement-classification-1",
    },
    body: JSON.stringify(body),
  });
}

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}
