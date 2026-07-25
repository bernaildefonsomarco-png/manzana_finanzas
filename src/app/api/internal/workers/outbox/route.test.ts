import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { GET, POST } from "./route";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(() => ({ id: "service-client" })),
  createDefaultOutboxHandlers: vi.fn(() => [{ consumerName: "test" }]),
  publishOutboxBatch: vi.fn(),
  startWorkerJobRun: vi.fn(),
  finishWorkerJobRun: vi.fn(),
  getOutboxOperationalSnapshot: vi.fn(),
}));

vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("@/workers/outbox/default-handlers", () => ({
  createDefaultOutboxHandlers: mocks.createDefaultOutboxHandlers,
}));

vi.mock("@/workers/outbox/outbox-publisher", () => ({
  publishOutboxBatch: mocks.publishOutboxBatch,
}));

vi.mock("@/data/repositories/worker-operations.repository", () => ({
  startWorkerJobRun: mocks.startWorkerJobRun,
  finishWorkerJobRun: mocks.finishWorkerJobRun,
  getOutboxOperationalSnapshot: mocks.getOutboxOperationalSnapshot,
}));

const originalCronSecret = process.env.CRON_SECRET;
const originalWorkerSecret = process.env.WORKER_SECRET;
const originalAppEnv = process.env.APP_ENV;

beforeEach(() => {
  process.env.CRON_SECRET = "cron-secret";
  process.env.WORKER_SECRET = "worker-secret";
  process.env.APP_ENV = "production";
  vi.clearAllMocks();
  mocks.publishOutboxBatch.mockResolvedValue({
    claimed: 2,
    published: 2,
    failed: 0,
    skipped: 0,
  });
  mocks.startWorkerJobRun.mockResolvedValue({
    id: "33333333-3333-4333-8333-333333333333",
    started_at: "2026-07-01T00:00:00.000Z",
  });
  mocks.finishWorkerJobRun.mockResolvedValue({
    id: "33333333-3333-4333-8333-333333333333",
  });
  mocks.getOutboxOperationalSnapshot.mockResolvedValue({
    counts: { pending: 0, processing: 0, failed: 0, dead_letter: 0 },
  });
});

afterEach(() => {
  process.env.CRON_SECRET = originalCronSecret;
  process.env.WORKER_SECRET = originalWorkerSecret;
  process.env.APP_ENV = originalAppEnv;
});

describe("outbox worker route", () => {
  it("ejecuta por GET para scheduler con CRON_SECRET y registra job run", async () => {
    const response = await GET(
      new Request("http://localhost/api/internal/workers/outbox?limit=10", {
        headers: { authorization: "Bearer cron-secret" },
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.startWorkerJobRun).toHaveBeenCalledWith(
      { id: "service-client" },
      {
        job_name: "outbox_publisher",
        trigger: "cron_get",
        trace_id: expect.any(String),
        metadata: {
          limit: 10,
          include_snapshot: true,
        },
      }
    );
    expect(mocks.publishOutboxBatch).toHaveBeenCalledWith(
      { id: "service-client" },
      {
        limit: 10,
        handlers: [{ consumerName: "test" }],
      }
    );
    expect(mocks.finishWorkerJobRun).toHaveBeenCalledWith(
      { id: "service-client" },
      expect.objectContaining({
        status: "succeeded",
        claimed_count: 2,
        processed_count: 2,
      })
    );
    expect(payload.data.trigger).toBe("cron_get");
  });

  it("marca la ejecucion como parcial si algun evento falla", async () => {
    mocks.publishOutboxBatch.mockResolvedValue({
      claimed: 2,
      published: 1,
      failed: 1,
      skipped: 0,
    });

    const response = await POST(
      new Request("http://localhost/api/internal/workers/outbox", {
        method: "POST",
        headers: { authorization: "Bearer worker-secret" },
        body: JSON.stringify({ limit: 25, include_snapshot: false }),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.getOutboxOperationalSnapshot).not.toHaveBeenCalled();
    expect(mocks.finishWorkerJobRun).toHaveBeenCalledWith(
      { id: "service-client" },
      expect.objectContaining({
        status: "partial",
        failed_count: 1,
      })
    );
  });

  it("rechaza ejecucion sin secreto fuera de local", async () => {
    const response = await GET(
      new Request("http://localhost/api/internal/workers/outbox")
    );

    expect(response.status).toBe(403);
    expect(mocks.publishOutboxBatch).not.toHaveBeenCalled();
  });
});
