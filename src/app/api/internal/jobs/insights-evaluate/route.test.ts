import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, selectInsightEligibleUserIds } from "./route";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(() => ({})),
  evaluateAdvancedInsights: vi.fn(),
}));

vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("@/data/repositories/insights.repository", () => ({
  evaluateAdvancedInsights: mocks.evaluateAdvancedInsights,
}));

const originalCronSecret = process.env.CRON_SECRET;
const originalWorkerSecret = process.env.WORKER_SECRET;
const originalAppEnv = process.env.APP_ENV;

beforeEach(() => {
  process.env.CRON_SECRET = "cron-secret";
  delete process.env.WORKER_SECRET;
  process.env.APP_ENV = "production";
  mocks.createServiceClient.mockClear();
  mocks.evaluateAdvancedInsights.mockReset();
  mocks.evaluateAdvancedInsights.mockResolvedValue({
    generated: 1,
    inserted: 1,
    updated: 0,
    skipped: 0,
    expired: 0,
    outdated: 0,
    candidates: [],
  });
});

afterEach(() => {
  process.env.CRON_SECRET = originalCronSecret;
  process.env.WORKER_SECRET = originalWorkerSecret;
  process.env.APP_ENV = originalAppEnv;
});

describe("insights evaluate worker route", () => {
  it("permite reconciliacion autenticada para un usuario", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/internal/jobs/insights-evaluate?user_id=11111111-1111-4111-8111-111111111111",
        { headers: { authorization: "Bearer cron-secret" } },
      ),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data.worker).toBe("insights_evaluate");
    expect(payload.data.users).toBe(1);
    expect(mocks.evaluateAdvancedInsights).toHaveBeenCalledWith(
      {},
      "11111111-1111-4111-8111-111111111111",
      { traceId: expect.any(String) },
    );
  });

  it("rechaza una ejecucion sin secreto fuera de local", async () => {
    const response = await GET(
      new Request("http://localhost/api/internal/jobs/insights-evaluate"),
    );

    expect(response.status).toBe(403);
    expect(mocks.evaluateAdvancedInsights).not.toHaveBeenCalled();
  });

  it("deduplica usuarios elegibles conservando recencia", () => {
    expect(
      selectInsightEligibleUserIds(
        [
          {
            user_id: "11111111-1111-4111-8111-111111111111",
            updated_at: "2026-07-18T10:00:00.000Z",
          },
          {
            user_id: "11111111-1111-4111-8111-111111111111",
            updated_at: "2026-07-18T08:00:00.000Z",
          },
          {
            user_id: "22222222-2222-4222-8222-222222222222",
            updated_at: "2026-07-18T09:00:00.000Z",
          },
        ],
        10,
      ),
    ).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ]);
  });
});
