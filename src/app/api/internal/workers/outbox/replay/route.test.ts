import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(() => ({ id: "service-client" })),
  startWorkerJobRun: vi.fn(),
  finishWorkerJobRun: vi.fn(),
  requeueOutboxEvent: vi.fn(),
}));

vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("@/data/repositories/worker-operations.repository", () => ({
  startWorkerJobRun: mocks.startWorkerJobRun,
  finishWorkerJobRun: mocks.finishWorkerJobRun,
  requeueOutboxEvent: mocks.requeueOutboxEvent,
}));

const originalWorkerSecret = process.env.WORKER_SECRET;
const originalAppEnv = process.env.APP_ENV;

beforeEach(() => {
  process.env.WORKER_SECRET = "worker-secret";
  process.env.APP_ENV = "production";
  vi.clearAllMocks();
  mocks.startWorkerJobRun.mockResolvedValue({
    id: "44444444-4444-4444-8444-444444444444",
    started_at: "2026-07-01T00:00:00.000Z",
  });
  mocks.finishWorkerJobRun.mockResolvedValue({
    id: "44444444-4444-4444-8444-444444444444",
  });
  mocks.requeueOutboxEvent.mockResolvedValue({
    id: "55555555-5555-4555-8555-555555555555",
    event_type: "pending_created",
    status: "pending",
  });
});

afterEach(() => {
  process.env.WORKER_SECRET = originalWorkerSecret;
  process.env.APP_ENV = originalAppEnv;
});

describe("outbox replay route", () => {
  it("reencola un evento con WORKER_SECRET y registra ejecucion", async () => {
    const response = await POST(
      new Request("http://localhost/api/internal/workers/outbox/replay", {
        method: "POST",
        headers: { authorization: "Bearer worker-secret" },
        body: JSON.stringify({
          outbox_id: "55555555-5555-4555-8555-555555555555",
          reason: "reintento operativo controlado",
          requested_by: "codex",
        }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.startWorkerJobRun).toHaveBeenCalledWith(
      { id: "service-client" },
      expect.objectContaining({
        job_name: "outbox_replay",
        trigger: "manual_replay",
      })
    );
    expect(mocks.requeueOutboxEvent).toHaveBeenCalledWith(
      { id: "service-client" },
      {
        outbox_id: "55555555-5555-4555-8555-555555555555",
        reason: "reintento operativo controlado",
        trace_id: expect.any(String),
        requested_by: "codex",
      }
    );
    expect(payload.data.event.status).toBe("pending");
  });

  it("rechaza replay sin secreto fuera de local", async () => {
    const response = await POST(
      new Request("http://localhost/api/internal/workers/outbox/replay", {
        method: "POST",
        body: JSON.stringify({
          outbox_id: "55555555-5555-4555-8555-555555555555",
          reason: "reintento operativo controlado",
        }),
      })
    );

    expect(response.status).toBe(403);
    expect(mocks.requeueOutboxEvent).not.toHaveBeenCalled();
  });
});
