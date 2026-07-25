import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(() => ({})),
  listDebtLifecycleUserIds: vi.fn(),
  refreshDebtLifecycle: vi.fn(),
}));

vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("@/data/repositories/debts.repository", () => ({
  listDebtLifecycleUserIds: mocks.listDebtLifecycleUserIds,
}));

vi.mock("@/core/debts/debt-lifecycle-service", () => ({
  refreshDebtLifecycle: mocks.refreshDebtLifecycle,
}));

const originalCronSecret = process.env.CRON_SECRET;
const originalWorkerSecret = process.env.WORKER_SECRET;
const originalAppEnv = process.env.APP_ENV;

beforeEach(() => {
  process.env.CRON_SECRET = "cron-secret";
  delete process.env.WORKER_SECRET;
  process.env.APP_ENV = "production";
  vi.clearAllMocks();
  mocks.listDebtLifecycleUserIds.mockResolvedValue([]);
  mocks.refreshDebtLifecycle.mockResolvedValue({
    lifecycle: {
      as_of_date: "2026-07-01",
      due_soon_days: 3,
      installments_scanned: 1,
      installments_updated: 1,
      debts_scanned: 1,
      debts_updated: 1,
      events_created: 2,
      transitions: [],
    },
    nudges: null,
    timezone: "America/Lima",
  });
});

afterEach(() => {
  process.env.CRON_SECRET = originalCronSecret;
  process.env.WORKER_SECRET = originalWorkerSecret;
  process.env.APP_ENV = originalAppEnv;
});

describe("debt lifecycle worker route", () => {
  it("ejecuta un usuario concreto con fecha y horizonte controlados", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/internal/jobs/debt-lifecycle?user_id=11111111-1111-4111-8111-111111111111&as_of_date=2026-07-01&due_soon_days=4",
        {
          headers: {
            authorization: "Bearer cron-secret",
          },
        }
      )
    );

    expect(response.status).toBe(200);
    expect(mocks.refreshDebtLifecycle).toHaveBeenCalledWith(
      {},
      "11111111-1111-4111-8111-111111111111",
      {
        asOfDate: "2026-07-01",
        dueSoonDays: 4,
        traceId: expect.any(String),
      }
    );
  });

  it("selecciona usuarios elegibles para la corrida diaria", async () => {
    mocks.listDebtLifecycleUserIds.mockResolvedValue([
      "22222222-2222-4222-8222-222222222222",
    ]);

    const response = await GET(
      new Request(
        "http://localhost/api/internal/jobs/debt-lifecycle?max_users=75",
        {
          headers: {
            authorization: "Bearer cron-secret",
          },
        }
      )
    );

    expect(response.status).toBe(200);
    expect(mocks.listDebtLifecycleUserIds).toHaveBeenCalledWith({}, 75);
    expect(mocks.refreshDebtLifecycle).toHaveBeenCalledTimes(1);
  });

  it("rechaza ejecucion sin secreto fuera de local", async () => {
    const response = await GET(
      new Request("http://localhost/api/internal/jobs/debt-lifecycle")
    );

    expect(response.status).toBe(403);
    expect(mocks.refreshDebtLifecycle).not.toHaveBeenCalled();
  });

  it("declara el cron antes de la evaluacion general de avisos", () => {
    const config = JSON.parse(
      readFileSync(join(process.cwd(), "vercel.json"), "utf8")
    ) as { crons?: Array<{ path: string; schedule: string }> };

    expect(config.crons).toContainEqual({
      path: "/api/internal/jobs/debt-lifecycle",
      schedule: "10 13 * * *",
    });
  });
});
