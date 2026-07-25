import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  createServiceClient: vi.fn(() => ({ service: true })),
  getLearningPreferences: vi.fn(),
  listFinancialMemory: vi.fn(),
  listLearningCandidates: vi.fn(),
  manageFinancialMemory: vi.fn(),
  promoteLearningCandidate: vi.fn(),
  setLearningPreferences: vi.fn(),
  updateLearningCandidateDecision: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock("@/data/repositories/financial-memory.repository", () => ({
  getLearningPreferences: mocks.getLearningPreferences,
  listFinancialMemory: mocks.listFinancialMemory,
  manageFinancialMemory: mocks.manageFinancialMemory,
  setLearningPreferences: mocks.setLearningPreferences,
}));
vi.mock("@/data/repositories/learning-candidates.repository", () => ({
  listLearningCandidates: mocks.listLearningCandidates,
  promoteLearningCandidate: mocks.promoteLearningCandidate,
  updateLearningCandidateDecision: mocks.updateLearningCandidateDecision,
}));

import { GET, PATCH, PUT } from "./route";

const candidateId = "11111111-1111-4111-8111-111111111111";
const memoryId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.createServiceClient.mockReturnValue({ service: true });
  mocks.getApiAuth.mockResolvedValue({ userId: "user-1", client: { rls: true } });
  mocks.listFinancialMemory.mockResolvedValue([]);
  mocks.listLearningCandidates.mockResolvedValue([]);
  mocks.getLearningPreferences.mockResolvedValue({ enabled: true });
});

describe("memory governance route", () => {
  it("lista memoria, candidatos y consentimiento del usuario", async () => {
    const response = await GET(new Request("http://localhost/api/v1/memory"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.listFinancialMemory).toHaveBeenCalledWith(
      { rls: true },
      expect.objectContaining({ userId: "user-1" }),
    );
  });

  it("confirma un candidato sensible con actor usuario antes de promover", async () => {
    mocks.updateLearningCandidateDecision.mockResolvedValue({
      id: candidateId,
      status: "accepted",
    });
    mocks.promoteLearningCandidate.mockResolvedValue({ id: memoryId });

    const response = await PATCH(
      new Request("http://localhost/api/v1/memory", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          target: "candidate",
          target_id: candidateId,
          action: "confirm",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateLearningCandidateDecision).toHaveBeenCalledWith(
      { service: true },
      expect.objectContaining({ actorType: "user", status: "accepted" }),
    );
    expect(mocks.promoteLearningCandidate).toHaveBeenCalledWith(
      { service: true },
      expect.objectContaining({ actorType: "user" }),
    );
  });

  it("corrige una memoria dejando la operacion en la ruta gobernada", async () => {
    mocks.manageFinancialMemory.mockResolvedValue({
      memory: { id: memoryId, lifecycle_status: "superseded" },
      replacement: { id: candidateId, lifecycle_status: "confirmed" },
    });
    const response = await PATCH(
      new Request("http://localhost/api/v1/memory", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          target: "memory",
          target_id: memoryId,
          action: "correct",
          summary: "Ahora prefiero respuestas detalladas.",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.manageFinancialMemory).toHaveBeenCalledWith(
      { service: true },
      expect.objectContaining({
        userId: "user-1",
        memoryId,
        action: "correct",
      }),
    );
  });

  it("permite apagar aprendizaje y memoria sensible por separado", async () => {
    mocks.setLearningPreferences.mockResolvedValue({
      enabled: false,
      allow_narrative_memory: false,
      allow_sensitive_memory: false,
    });
    const response = await PUT(
      new Request("http://localhost/api/v1/memory", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled: false,
          allow_narrative_memory: false,
          allow_sensitive_memory: false,
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.setLearningPreferences).toHaveBeenCalledWith(
      { service: true },
      expect.objectContaining({ enabled: false, allowSensitiveMemory: false }),
    );
  });

  it("rechaza lectura sin sesion", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect(
      (await GET(new Request("http://localhost/api/v1/memory"))).status,
    ).toBe(401);
  });
});
