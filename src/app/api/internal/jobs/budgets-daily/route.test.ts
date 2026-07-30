import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(() => ({})),
  runBudgetDailyLifecycle: vi.fn(),
}));

vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock("@/data/repositories/budgets.repository", () => ({
  runBudgetDailyLifecycle: mocks.runBudgetDailyLifecycle,
}));

const originalCronSecret = process.env.CRON_SECRET;
const originalAppEnv = process.env.APP_ENV;

beforeEach(() => {
  process.env.CRON_SECRET = "cron-secret";
  process.env.APP_ENV = "production";
  vi.clearAllMocks();
  mocks.runBudgetDailyLifecycle.mockResolvedValue({
    renewed: 1,
    snapshots: 2,
    threshold_events: 0,
  });
});

afterEach(() => {
  process.env.CRON_SECRET = originalCronSecret;
  process.env.APP_ENV = originalAppEnv;
});

describe("budget daily worker", () => {
  it("camino feliz: ejecuta lifecycle y snapshots", async () => {
    const response = await GET(request(`?user_id=${USER_ID}&as_of=2026-08-01`));
    expect(response.status).toBe(200);
    expect(mocks.runBudgetDailyLifecycle).toHaveBeenCalledWith({}, {
      asOf: "2026-08-01",
      userId: USER_ID,
    });
  });

  it("sin secreto: 403", async () => {
    expect(
      (
        await GET(
          new Request("http://localhost/api/internal/jobs/budgets-daily")
        )
      ).status
    ).toBe(403);
  });

  it("recurso/usuario ajeno no es consultable: solo acepta UUID de operación", async () => {
    expect((await GET(request("?user_id=ajeno"))).status).toBe(400);
  });

  it("validación: fecha inválida devuelve 400", async () => {
    expect((await GET(request("?as_of=30-07-2026"))).status).toBe(400);
  });

  it("idempotencia: repetir delega al RPC idempotente sin estado en la ruta", async () => {
    await GET(request(`?user_id=${USER_ID}&as_of=2026-08-01`));
    await GET(request(`?user_id=${USER_ID}&as_of=2026-08-01`));
    expect(mocks.runBudgetDailyLifecycle).toHaveBeenCalledTimes(2);
  });

  it("el cron diario está declarado", () => {
    const config = JSON.parse(
      readFileSync(join(process.cwd(), "vercel.json"), "utf8")
    ) as { crons: Array<{ path: string; schedule: string }> };
    expect(config.crons).toContainEqual({
      path: "/api/internal/jobs/budgets-daily",
      schedule: "12 13 * * *",
    });
  });
});

describe("POST budget daily worker", () => {
  it("ejecuta el mismo lifecycle con un body autenticado", async () => {
    const response = await POST(
      postRequest({ user_id: USER_ID, as_of: "2026-08-01" }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).data.trigger).toBe("worker_post");
    expect(mocks.runBudgetDailyLifecycle).toHaveBeenCalledWith(
      {},
      {
        asOf: "2026-08-01",
        userId: USER_ID,
      },
    );
  });

  it("rechaza el body sin secreto", async () => {
    expect(
      (
        await POST(
          new Request("http://localhost/api/internal/jobs/budgets-daily", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{}",
          }),
        )
      ).status,
    ).toBe(403);
  });

  it("rechaza un body desconocido con validación", async () => {
    const response = await POST(postRequest({ ajeno: true }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("repetir delega dos veces al RPC idempotente", async () => {
    await POST(postRequest({ as_of: "2026-08-01" }));
    await POST(postRequest({ as_of: "2026-08-01" }));
    expect(mocks.runBudgetDailyLifecycle).toHaveBeenCalledTimes(2);
  });
});

function request(query = "") {
  return new Request(
    `http://localhost/api/internal/jobs/budgets-daily${query}`,
    { headers: { authorization: "Bearer cron-secret" } }
  );
}

function postRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/internal/jobs/budgets-daily", {
    method: "POST",
    headers: {
      authorization: "Bearer cron-secret",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
