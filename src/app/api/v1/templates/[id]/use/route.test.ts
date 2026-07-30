import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  bumpMovementTemplateUse: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/movement-templates.repository", async (original) => ({
  ...(await original()),
  bumpMovementTemplateUse: mocks.bumpMovementTemplateUse,
}));

import { POST } from "./route";
import { MovementTemplateRepositoryError } from "@/data/repositories/movement-templates.repository";

const TEMPLATE_ID = "22222222-2222-4222-8222-222222222222";

function request() {
  return new Request(`http://localhost/api/v1/templates/${TEMPLATE_ID}/use`, { method: "POST" });
}
function context() {
  return { params: Promise.resolve({ id: TEMPLATE_ID }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ userId: "11111111-1111-4111-8111-111111111111", client: {} });
});

describe("POST /api/v1/templates/[id]/use", () => {
  it("camino feliz: bumpea el uso y devuelve la plantilla precargada", async () => {
    mocks.bumpMovementTemplateUse.mockResolvedValue({ id: TEMPLATE_ID, use_count: 4 });

    const response = await POST(request(), context());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.template.use_count).toBe(4);
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await POST(request(), context());

    expect(response.status).toBe(401);
  });

  it("plantilla de otro usuario: 404, nunca 403", async () => {
    mocks.bumpMovementTemplateUse.mockRejectedValue(
      new MovementTemplateRepositoryError("TEMPLATE_NOT_FOUND", "No encontre esa plantilla."),
    );

    const response = await POST(request(), context());

    expect(response.status).toBe(404);
  });

  it("validacion: id invalido devuelve VALIDATION_ERROR", async () => {
    const response = await POST(request(), { params: Promise.resolve({ id: "no-es-uuid" }) });

    expect(response.status).toBe(400);
  });

  it("usar la plantilla no escribe ningun movimiento (solo devuelve la previsualizacion)", async () => {
    mocks.bumpMovementTemplateUse.mockResolvedValue({ id: TEMPLATE_ID, use_count: 1 });

    await POST(request(), context());

    expect(mocks.bumpMovementTemplateUse).toHaveBeenCalledTimes(1);
  });
});
