import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  getRecurringRuleById: vi.fn(),
  listRecurringOccurrences: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/recurring.repository", () => ({
  getRecurringRuleById: mocks.getRecurringRuleById,
  listRecurringOccurrences: mocks.listRecurringOccurrences,
}));

const id = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "user-1" });
  mocks.getRecurringRuleById.mockResolvedValue({ id });
  mocks.listRecurringOccurrences.mockResolvedValue([
    {
      id: "22222222-2222-4222-8222-222222222222",
      expected_date: "2026-07-15",
      status: "expected",
    },
  ]);
});

describe("GET /api/v1/recurring/:id/occurrences", () => {
  it("camino feliz lista historial paginado y filtrable", async () => {
    const response = await GET(
      request("?status=expected&from=2026-07-01&to=2026-07-31&limit=10"),
      context(id)
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.occurrences).toHaveLength(1);
    expect(mocks.listRecurringOccurrences).toHaveBeenCalledWith(
      {},
      "user-1",
      id,
      expect.objectContaining({
        statuses: ["expected"],
        fromDate: "2026-07-01",
        toDate: "2026-07-31",
        limit: 11,
      })
    );
  });

  it("sin sesión devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await GET(request(), context(id));

    expect(response.status).toBe(401);
    expect(mocks.getRecurringRuleById).not.toHaveBeenCalled();
  });

  it("regla de otro usuario se oculta como 404", async () => {
    mocks.getRecurringRuleById.mockResolvedValue(null);

    const response = await GET(request(), context(id));

    expect(response.status).toBe(404);
    expect(mocks.listRecurringOccurrences).not.toHaveBeenCalled();
  });

  it("validación rechaza rango invertido", async () => {
    const response = await GET(
      request("?from=2026-08-01&to=2026-07-01"),
      context(id)
    );

    expect(response.status).toBe(400);
    expect(mocks.listRecurringOccurrences).not.toHaveBeenCalled();
  });

  it("idempotencia no escribe: repetir el GET devuelve la misma lectura", async () => {
    const first = await GET(request(), context(id));
    const second = await GET(request(), context(id));
    const firstPayload = await first.json();
    const secondPayload = await second.json();

    expect(firstPayload.data).toEqual(secondPayload.data);
    expect(mocks.listRecurringOccurrences).toHaveBeenCalledTimes(2);
  });
});

function request(query = "") {
  return new Request(
    `http://localhost/api/v1/recurring/${id}/occurrences${query}`
  );
}

function context(value: string) {
  return { params: Promise.resolve({ id: value }) };
}
