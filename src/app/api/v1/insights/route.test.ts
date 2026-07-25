import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  listInsights: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/insights.repository", () => ({
  listInsights: mocks.listInsights,
}));

beforeEach(() => {
  mocks.getApiAuth.mockReset();
  mocks.listInsights.mockReset();
});

describe("insights list route", () => {
  it("requiere sesion", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/v1/insights"));
    expect(response.status).toBe(401);
    expect(mocks.listInsights).not.toHaveBeenCalled();
  });

  it("aplica filtros validos al repositorio", async () => {
    const client = {};
    mocks.getApiAuth.mockResolvedValue({ client, userId: "user-1" });
    mocks.listInsights.mockResolvedValue([{ id: "insight-1" }]);

    const response = await GET(
      new Request(
        "http://localhost/api/v1/insights?limit=5&type=projection&status=narrated",
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.insights).toHaveLength(1);
    expect(mocks.listInsights).toHaveBeenCalledWith(client, "user-1", {
      limit: 5,
      type: "projection",
      status: "narrated",
    });
  });
});
