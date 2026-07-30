import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  updateMovementTemplate: vi.fn(),
  archiveMovementTemplate: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/movement-templates.repository", async (original) => ({
  ...(await original()),
  updateMovementTemplate: mocks.updateMovementTemplate,
  archiveMovementTemplate: mocks.archiveMovementTemplate,
}));

import { DELETE, PATCH } from "./route";
import { MovementTemplateRepositoryError } from "@/data/repositories/movement-templates.repository";

const TEMPLATE_ID = "22222222-2222-4222-8222-222222222222";

function context() {
  return { params: Promise.resolve({ id: TEMPLATE_ID }) };
}

function patchRequest(body: unknown) {
  return new Request(`http://localhost/api/v1/templates/${TEMPLATE_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ userId: "11111111-1111-4111-8111-111111111111", client: {} });
});

describe("PATCH /api/v1/templates/[id]", () => {
  it("camino feliz: edita la plantilla", async () => {
    mocks.updateMovementTemplate.mockResolvedValue({ id: TEMPLATE_ID, name: "Nuevo nombre" });

    const response = await PATCH(patchRequest({ name: "Nuevo nombre" }), context());

    expect(response.status).toBe(200);
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ name: "Nuevo nombre" }), context());

    expect(response.status).toBe(401);
  });

  it("plantilla de otro usuario: 404, nunca 403", async () => {
    mocks.updateMovementTemplate.mockRejectedValue(
      new MovementTemplateRepositoryError("TEMPLATE_NOT_FOUND", "No encontre esa plantilla."),
    );

    const response = await PATCH(patchRequest({ name: "Nuevo nombre" }), context());

    expect(response.status).toBe(404);
  });

  it("validacion: cuerpo vacio devuelve VALIDATION_ERROR", async () => {
    const response = await PATCH(patchRequest({}), context());

    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/v1/templates/[id]", () => {
  it("camino feliz: archiva la plantilla", async () => {
    mocks.archiveMovementTemplate.mockResolvedValue(undefined);

    const response = await DELETE(
      new Request(`http://localhost/api/v1/templates/${TEMPLATE_ID}`, { method: "DELETE" }),
      context(),
    );

    expect(response.status).toBe(200);
  });

  it("idempotencia: archivar dos veces la segunda devuelve 404, no un doble efecto", async () => {
    mocks.archiveMovementTemplate
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(
        new MovementTemplateRepositoryError("TEMPLATE_NOT_FOUND", "No encontre esa plantilla."),
      );

    const first = await DELETE(
      new Request(`http://localhost/api/v1/templates/${TEMPLATE_ID}`, { method: "DELETE" }),
      context(),
    );
    const second = await DELETE(
      new Request(`http://localhost/api/v1/templates/${TEMPLATE_ID}`, { method: "DELETE" }),
      context(),
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(404);
  });
});
