import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  createServiceClient: vi.fn(() => ({})),
  listSenderSuggestions: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/supabase/server", () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock("@/data/repositories/email.repository", () => ({
  listSenderSuggestions: mocks.listSenderSuggestions,
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ userId: "11111111-1111-4111-8111-111111111111", client: {} });
});

describe("GET /api/v1/email/suggestions", () => {
  it("camino feliz: lista las sugerencias pendientes", async () => {
    mocks.listSenderSuggestions.mockResolvedValue([{ id: "s1", sender: "notificaciones@bcp.com.pe" }]);

    const response = await GET(new Request("http://localhost/api/v1/email/suggestions"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.suggestions).toHaveLength(1);
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/v1/email/suggestions"));

    expect(response.status).toBe(401);
  });
});
