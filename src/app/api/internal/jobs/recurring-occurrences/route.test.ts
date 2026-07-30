import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(() => ({})),
  listRecurringOccurrenceGenerationUserIds: vi.fn(),
  materializeRecurringOccurrenceHorizon: vi.fn(),
}));

vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("@/data/repositories/recurring.repository", () => ({
  listRecurringOccurrenceGenerationUserIds:
    mocks.listRecurringOccurrenceGenerationUserIds,
  materializeRecurringOccurrenceHorizon:
    mocks.materializeRecurringOccurrenceHorizon,
}));

const originalCronSecret = process.env.CRON_SECRET;
const originalWorkerSecret = process.env.WORKER_SECRET;
const originalAppEnv = process.env.APP_ENV;
const userId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  process.env.CRON_SECRET = "cron-secret";
  delete process.env.WORKER_SECRET;
  process.env.APP_ENV = "production";
  vi.clearAllMocks();
  mocks.listRecurringOccurrenceGenerationUserIds.mockResolvedValue([]);
  mocks.materializeRecurringOccurrenceHorizon.mockResolvedValue(result(4));
});

afterEach(() => {
  process.env.CRON_SECRET = originalCronSecret;
  process.env.WORKER_SECRET = originalWorkerSecret;
  process.env.APP_ENV = originalAppEnv;
});

describe("recurring occurrences worker route", () => {
  it("camino feliz: materializa 60 días para un usuario concreto", async () => {
    const response = await GET(
      request(
        `?user_id=${userId}&as_of_date=2026-07-01&horizon_days=60`
      )
    );

    expect(response.status).toBe(200);
    expect(mocks.materializeRecurringOccurrenceHorizon).toHaveBeenCalledWith(
      {},
      userId,
      { asOfDate: "2026-07-01", horizonDays: 60 }
    );
  });

  it("sin secreto: rechaza con 403; un worker no usa sesión de usuario", async () => {
    const response = await GET(
      new Request("http://localhost/api/internal/jobs/recurring-occurrences")
    );

    expect(response.status).toBe(403);
    expect(mocks.materializeRecurringOccurrenceHorizon).not.toHaveBeenCalled();
  });

  it("validación: rechaza horizonte fuera del límite", async () => {
    const response = await GET(request("?horizon_days=91"));

    expect(response.status).toBe(400);
    expect(mocks.materializeRecurringOccurrenceHorizon).not.toHaveBeenCalled();
  });

  it("usuario sin reglas: es un éxito vacío, no un recurso ajeno consultable", async () => {
    mocks.materializeRecurringOccurrenceHorizon.mockResolvedValue(result(0));

    const response = await GET(request(`?user_id=${userId}`));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.results[0].result.occurrences_inserted).toBe(0);
  });

  it("el cron sin max_users pide todos los usuarios y no repite siempre los primeros 50", async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(
      mocks.listRecurringOccurrenceGenerationUserIds
    ).toHaveBeenCalledWith({}, undefined);
  });

  it("idempotencia: una repetición puede insertar cero sin duplicar", async () => {
    mocks.materializeRecurringOccurrenceHorizon
      .mockResolvedValueOnce(result(4))
      .mockResolvedValueOnce(result(0));

    const first = await GET(request(`?user_id=${userId}`));
    const second = await GET(request(`?user_id=${userId}`));
    const secondPayload = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(secondPayload.data.results[0].result.occurrences_inserted).toBe(0);
    expect(mocks.materializeRecurringOccurrenceHorizon).toHaveBeenCalledTimes(2);
  });

  it("declara el cron diario fuera de los requests de usuario", () => {
    const config = JSON.parse(
      readFileSync(join(process.cwd(), "vercel.json"), "utf8")
    ) as { crons?: Array<{ path: string; schedule: string }> };

    expect(config.crons).toContainEqual({
      path: "/api/internal/jobs/recurring-occurrences",
      schedule: "5 13 * * *",
    });
  });
});

function request(query = "") {
  return new Request(
    `http://localhost/api/internal/jobs/recurring-occurrences${query}`,
    { headers: { authorization: "Bearer cron-secret" } }
  );
}

function result(inserted: number) {
  return {
    as_of_date: "2026-07-01",
    horizon_days: 60,
    rules_scanned: 1,
    occurrences_scanned: 0,
    occurrences_planned: inserted,
    occurrences_inserted: inserted,
    statuses_updated: 0,
  };
}
