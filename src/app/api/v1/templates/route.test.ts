import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  listMovementTemplates: vi.fn(),
  createMovementTemplate: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/movement-templates.repository", async (original) => ({
  ...(await original()),
  listMovementTemplates: mocks.listMovementTemplates,
  createMovementTemplate: mocks.createMovementTemplate,
}));

import { GET, POST } from "./route";
import { MovementTemplateRepositoryError } from "@/data/repositories/movement-templates.repository";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ userId: "11111111-1111-4111-8111-111111111111", client: {} });
});

function postRequest(body: unknown) {
  return new Request("http://localhost/api/v1/templates", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/v1/templates", () => {
  it("camino feliz: lista ordenada por uso", async () => {
    mocks.listMovementTemplates.mockResolvedValue([{ id: "t1", name: "Almuerzo menu", use_count: 5 }]);

    const response = await GET(new Request("http://localhost/api/v1/templates"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.templates).toHaveLength(1);
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/v1/templates"));

    expect(response.status).toBe(401);
  });
});

describe("POST /api/v1/templates", () => {
  it("camino feliz: crea una plantilla", async () => {
    mocks.createMovementTemplate.mockResolvedValue({ id: "t1", name: "Almuerzo menu" });

    const response = await POST(postRequest({ name: "Almuerzo menu", type: "gasto" }));

    expect(response.status).toBe(201);
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await POST(postRequest({ name: "Almuerzo menu", type: "gasto" }));

    expect(response.status).toBe(401);
  });

  it("validacion: nombre vacio devuelve VALIDATION_ERROR", async () => {
    const response = await POST(postRequest({ name: "", type: "gasto" }));

    expect(response.status).toBe(400);
  });

  it("ERR-CAP-06: nombre duplicado devuelve CONFLICT", async () => {
    mocks.createMovementTemplate.mockRejectedValue(
      new MovementTemplateRepositoryError(
        "TEMPLATE_ALREADY_EXISTS",
        "Ya tienes una plantilla con ese nombre.",
      ),
    );

    const response = await POST(postRequest({ name: "Almuerzo menu", type: "gasto" }));

    expect(response.status).toBe(409);
  });

  it("plantilla sin monto es valida (se pide al usar, 29 S4.1)", async () => {
    mocks.createMovementTemplate.mockResolvedValue({ id: "t1", name: "Almuerzo menu", amount: null });

    const response = await POST(postRequest({ name: "Almuerzo menu", type: "gasto", amount: null }));

    expect(response.status).toBe(201);
  });
});
