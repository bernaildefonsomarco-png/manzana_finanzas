import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(() => ({})),
  expireFinancialLearning: vi.fn(),
  getLearningGovernanceMetrics: vi.fn(),
}));

vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock("@/data/repositories/financial-memory.repository", () => ({
  expireFinancialLearning: mocks.expireFinancialLearning,
  getLearningGovernanceMetrics: mocks.getLearningGovernanceMetrics,
}));

import { GET } from "./route";

const originalCronSecret = process.env.CRON_SECRET;
const originalWorkerSecret = process.env.WORKER_SECRET;
const originalAppEnv = process.env.APP_ENV;

beforeEach(() => {
  process.env.CRON_SECRET = "cron-secret";
  delete process.env.WORKER_SECRET;
  process.env.APP_ENV = "production";
  mocks.expireFinancialLearning.mockReset().mockResolvedValue({
    expired_candidates: 2,
    expired_memories: 1,
    processed_at: "2026-07-24T13:00:00.000Z",
  });
  mocks.getLearningGovernanceMetrics.mockReset().mockResolvedValue({
    candidates_by_status: { observed: 3 },
  });
});

afterEach(() => {
  process.env.CRON_SECRET = originalCronSecret;
  process.env.WORKER_SECRET = originalWorkerSecret;
  process.env.APP_ENV = originalAppEnv;
});

describe("learning maintenance worker", () => {
  it("expira por politica y devuelve metricas gobernadas", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/internal/jobs/learning-maintenance?days=14&now=2026-07-24T13%3A00%3A00.000Z",
        { headers: { authorization: "Bearer cron-secret" } },
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.expireFinancialLearning).toHaveBeenCalledWith(
      {},
      "2026-07-24T13:00:00.000Z",
    );
    expect(mocks.getLearningGovernanceMetrics).toHaveBeenCalledWith({}, 14);
  });

  it("rechaza ejecucion sin secreto fuera de local", async () => {
    const response = await GET(
      new Request("http://localhost/api/internal/jobs/learning-maintenance"),
    );
    expect(response.status).toBe(403);
    expect(mocks.expireFinancialLearning).not.toHaveBeenCalled();
  });
});
