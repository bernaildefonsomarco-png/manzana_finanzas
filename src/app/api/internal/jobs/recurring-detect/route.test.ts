import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(() => ({})),
  runRecurringCandidateDetection: vi.fn(),
}));

vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("@/data/repositories/recurring.repository", () => ({
  runRecurringCandidateDetection: mocks.runRecurringCandidateDetection,
}));

const originalCronSecret = process.env.CRON_SECRET;
const originalWorkerSecret = process.env.WORKER_SECRET;
const originalAppEnv = process.env.APP_ENV;

beforeEach(() => {
  process.env.CRON_SECRET = "cron-secret";
  delete process.env.WORKER_SECRET;
  process.env.APP_ENV = "production";
  mocks.createServiceClient.mockClear();
  mocks.runRecurringCandidateDetection.mockReset();
  mocks.runRecurringCandidateDetection.mockResolvedValue({
    detected: 1,
    ready_to_suggest: 1,
    inserted: 0,
    updated: 1,
    stored: 1,
    candidates: [],
  });
});

afterEach(() => {
  process.env.CRON_SECRET = originalCronSecret;
  process.env.WORKER_SECRET = originalWorkerSecret;
  process.env.APP_ENV = originalAppEnv;
});

describe("recurring detect worker route", () => {
  it("permite ejecucion GET autenticada por CRON_SECRET", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/internal/jobs/recurring-detect?user_id=11111111-1111-4111-8111-111111111111&lookback_days=365",
        {
          headers: {
            authorization: "Bearer cron-secret",
          },
        }
      )
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.data.trigger).toBe("cron_get");
    expect(payload.data.users).toBe(1);
    expect(mocks.runRecurringCandidateDetection).toHaveBeenCalledWith(
      {},
      "11111111-1111-4111-8111-111111111111",
      {
        lookbackDays: 365,
        limit: undefined,
        traceId: expect.any(String),
      }
    );
  });

  it("rechaza GET sin secreto fuera de local", async () => {
    const response = await GET(
      new Request("http://localhost/api/internal/jobs/recurring-detect")
    );

    expect(response.status).toBe(403);
    expect(mocks.runRecurringCandidateDetection).not.toHaveBeenCalled();
  });

  it("declara el cron diario de Vercel para deteccion recurrente", () => {
    const config = JSON.parse(
      readFileSync(join(process.cwd(), "vercel.json"), "utf8")
    ) as { crons?: Array<{ path: string; schedule: string }> };

    expect(config.crons).toContainEqual({
      path: "/api/internal/jobs/recurring-detect",
      schedule: "0 13 * * *",
    });
  });
});
