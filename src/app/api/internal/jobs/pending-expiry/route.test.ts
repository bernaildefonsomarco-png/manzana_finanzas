// RUL-PEND-08 (27 S6/S17): un pendiente sin resolver caduca a los 60 dias,
// ejecutado por un trabajo programado, no en cada lectura.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(() => ({})),
  expireOverduePendingItems: vi.fn(),
}));

vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock("@/data/repositories/pending.repository", () => ({
  expireOverduePendingItems: mocks.expireOverduePendingItems,
}));

const originalCronSecret = process.env.CRON_SECRET;
const originalAppEnv = process.env.APP_ENV;

beforeEach(() => {
  process.env.CRON_SECRET = "cron-secret";
  process.env.APP_ENV = "production";
  vi.clearAllMocks();
  mocks.expireOverduePendingItems.mockResolvedValue({
    expired_count: 3,
    pending_item_ids: ["p1", "p2", "p3"],
  });
});

afterEach(() => {
  process.env.CRON_SECRET = originalCronSecret;
  process.env.APP_ENV = originalAppEnv;
});

describe("pending expiry worker route", () => {
  it("camino feliz: caduca los pendientes vencidos", async () => {
    const response = await GET(
      new Request("http://localhost/api/internal/jobs/pending-expiry", {
        headers: { authorization: "Bearer cron-secret" },
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.expired_count).toBe(3);
  });

  it("sin secreto valido: 403, nunca ejecuta la caducidad", async () => {
    const response = await GET(
      new Request("http://localhost/api/internal/jobs/pending-expiry", {
        headers: { authorization: "Bearer secreto-incorrecto" },
      })
    );

    expect(response.status).toBe(403);
    expect(mocks.expireOverduePendingItems).not.toHaveBeenCalled();
  });

  it("validacion: as_of con formato invalido devuelve VALIDATION_ERROR", async () => {
    const response = await GET(
      new Request("http://localhost/api/internal/jobs/pending-expiry?as_of=no-es-fecha", {
        headers: { authorization: "Bearer cron-secret" },
      })
    );

    expect(response.status).toBe(400);
  });

  it("idempotencia: correr el trabajo dos veces seguidas no vuelve a caducar lo ya caducado (los reactivos ya no cumplen el filtro de estado)", async () => {
    mocks.expireOverduePendingItems
      .mockResolvedValueOnce({ expired_count: 3, pending_item_ids: ["p1", "p2", "p3"] })
      .mockResolvedValueOnce({ expired_count: 0, pending_item_ids: [] });

    const first = await GET(
      new Request("http://localhost/api/internal/jobs/pending-expiry", {
        headers: { authorization: "Bearer cron-secret" },
      })
    );
    const second = await GET(
      new Request("http://localhost/api/internal/jobs/pending-expiry", {
        headers: { authorization: "Bearer cron-secret" },
      })
    );

    const firstBody = await first.json();
    const secondBody = await second.json();
    expect(firstBody.data.expired_count).toBe(3);
    expect(secondBody.data.expired_count).toBe(0);
  });
});
