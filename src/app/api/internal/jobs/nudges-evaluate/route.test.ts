import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, selectNudgeEligibleUserIds } from "./route";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(() => ({})),
  evaluateDashboardNudges: vi.fn(),
  deliverProactiveNudgesForUser: vi.fn(),
}));

vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("@/data/repositories/nudges.repository", () => ({
  evaluateDashboardNudges: mocks.evaluateDashboardNudges,
}));

vi.mock("@/workers/nudges/proactive-nudge-worker", () => ({
  deliverProactiveNudgesForUser: mocks.deliverProactiveNudgesForUser,
}));

const originalCronSecret = process.env.CRON_SECRET;
const originalWorkerSecret = process.env.WORKER_SECRET;
const originalAppEnv = process.env.APP_ENV;

beforeEach(() => {
  process.env.CRON_SECRET = "cron-secret";
  delete process.env.WORKER_SECRET;
  process.env.APP_ENV = "production";
  mocks.createServiceClient.mockClear();
  mocks.evaluateDashboardNudges.mockReset();
  mocks.evaluateDashboardNudges.mockResolvedValue({
    generated: 1,
    inserted: 1,
    updated: 0,
    skipped: 0,
    expired: 0,
    candidates: [],
  });
  mocks.deliverProactiveNudgesForUser.mockReset();
  mocks.deliverProactiveNudgesForUser.mockResolvedValue({
    evaluated: 0,
    sent: 0,
    planned: 0,
    deferred: 0,
    dashboard_only: 0,
    rejected: 0,
    failed: 0,
    outcomes: [],
  });
});

afterEach(() => {
  process.env.CRON_SECRET = originalCronSecret;
  process.env.WORKER_SECRET = originalWorkerSecret;
  process.env.APP_ENV = originalAppEnv;
});

describe("nudges evaluate worker route", () => {
  it("permite ejecucion GET autenticada por CRON_SECRET", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/internal/jobs/nudges-evaluate?user_id=11111111-1111-4111-8111-111111111111&horizon_days=5",
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
    expect(payload.data.channels).toEqual(["dashboard", "whatsapp"]);
    expect(payload.data.users).toBe(1);
    expect(mocks.evaluateDashboardNudges).toHaveBeenCalledWith(
      {},
      "11111111-1111-4111-8111-111111111111",
      {
        horizonDays: 5,
        traceId: expect.any(String),
      }
    );
    expect(mocks.deliverProactiveNudgesForUser).toHaveBeenCalledWith(
      {},
      "11111111-1111-4111-8111-111111111111",
      { traceId: expect.any(String) },
    );
  });

  it("rechaza GET sin secreto fuera de local", async () => {
    const response = await GET(
      new Request("http://localhost/api/internal/jobs/nudges-evaluate")
    );

    expect(response.status).toBe(403);
    expect(mocks.evaluateDashboardNudges).not.toHaveBeenCalled();
  });

  it("declara el cron diario de Vercel para evaluar avisos dashboard", () => {
    const config = JSON.parse(
      readFileSync(join(process.cwd(), "vercel.json"), "utf8")
    ) as { crons?: Array<{ path: string; schedule: string }> };

    expect(config.crons).toContainEqual({
      path: "/api/internal/jobs/nudges-evaluate",
      schedule: "15 13 * * *",
    });
  });

  it("incluye usuarios con cuotas aunque no tengan recurrentes", () => {
    expect(
      selectNudgeEligibleUserIds(
        ["11111111-1111-4111-8111-111111111111"],
        [
          "22222222-2222-4222-8222-222222222222",
          "11111111-1111-4111-8111-111111111111",
        ],
        10
      )
    ).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ]);
  });

  it("incluye actividad, pendientes y ventanas para evaluar lifecycle", () => {
    expect(
      selectNudgeEligibleUserIds(
        [],
        [],
        10,
        [],
        ["33333333-3333-4333-8333-333333333333"],
        ["44444444-4444-4444-8444-444444444444"],
        ["55555555-5555-4555-8555-555555555555"],
      ),
    ).toEqual([
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
      "55555555-5555-4555-8555-555555555555",
    ]);
  });
});
