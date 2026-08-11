import { beforeEach, describe, expect, it, vi } from "vitest";

import { getLearningPreferences } from "@/data/repositories/financial-memory.repository";
import { recordProfileCandidateObservation } from "@/data/repositories/profile-candidates.repository";
import { captureProfileCandidate } from "./profile-candidate-capture";
import type { ProfileCandidateDraft } from "./profile-signal";

vi.mock("@/data/repositories/financial-memory.repository", () => ({
  getLearningPreferences: vi.fn(),
}));

vi.mock("@/data/repositories/profile-candidates.repository", () => ({
  recordProfileCandidateObservation: vi.fn(),
}));

const mockedPreferences = vi.mocked(getLearningPreferences);
const mockedRecord = vi.mocked(recordProfileCandidateObservation);

const CLIENT = {} as never;

function draft(overrides: Partial<ProfileCandidateDraft> = {}): ProfileCandidateDraft {
  return {
    subjectKey: "vida:cobro",
    capa: "vida",
    statement: "Cobras el 15 y el último día del mes",
    origin: "dicho",
    desbloquea: "poder decirte si llegas a fin de mes",
    ...overrides,
  };
}

function preferencias(overrides: Record<string, unknown> = {}) {
  return {
    user_id: "u1",
    enabled: true,
    allow_narrative_memory: true,
    allow_sensitive_memory: false,
    consent_version: "learning_v1",
    updated_by: "user" as const,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    metadata: {},
    ...overrides,
  };
}

function capturar(draftOverride: ProfileCandidateDraft | null = draft()) {
  return captureProfileCandidate({
    client: CLIENT,
    userId: "u1",
    draft: draftOverride,
    evidenceRef: "evt-1",
    observedAt: "2026-08-11T15:00:00.000Z",
    traceId: "trace-1",
  });
}

describe("captureProfileCandidate (`20c` §6b.1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPreferences.mockResolvedValue(preferencias());
    mockedRecord.mockResolvedValue({
      candidate: {
        id: "c1",
        subject_key: "vida:cobro",
        statement: "Cobras el 15 y el último día del mes",
        status: "observado",
        ask_count: 0,
        evidence_refs: ["evento:evt-1"],
        last_asked_at: null,
        metadata: {},
        created_at: "2026-08-11T15:00:00.000Z",
      },
      reason: "created",
    });
  });

  it("registra el candidato con su evidencia y lo que desbloquea", async () => {
    const resultado = await capturar();

    expect(resultado.captured).toBe(true);
    expect(mockedRecord).toHaveBeenCalledWith(
      CLIENT,
      expect.objectContaining({
        userId: "u1",
        subjectKey: "vida:cobro",
        evidenceRef: "evento:evt-1",
        metadata: expect.objectContaining({
          capa: "vida",
          origin: "dicho",
          desbloquea: "poder decirte si llegas a fin de mes",
        }),
      }),
    );
  });

  it("con el aprendizaje apagado no se genera ni un candidato", async () => {
    mockedPreferences.mockResolvedValue(preferencias({ enabled: false }));

    const resultado = await capturar();

    expect(resultado).toEqual({
      captured: false,
      reason: "learning_disabled_by_user",
      candidate: null,
    });
    expect(mockedRecord).not.toHaveBeenCalled();
  });

  it("sin permiso de memoria narrativa, la capa vínculo no se captura", async () => {
    mockedPreferences.mockResolvedValue(
      preferencias({ allow_narrative_memory: false }),
    );

    const resultado = await capturar(
      draft({ subjectKey: "vinculo:preocupacion", capa: "vinculo" }),
    );

    expect(resultado.reason).toBe("narrative_memory_not_allowed");
    expect(mockedRecord).not.toHaveBeenCalled();
  });

  it("sin señal no consulta ni el consentimiento", async () => {
    const resultado = await capturar(null);

    expect(resultado.reason).toBe("no_signal");
    expect(mockedPreferences).not.toHaveBeenCalled();
  });

  it("un fallo de la base no rompe el turno", async () => {
    mockedRecord.mockRejectedValue(new Error("PROFILE_WRITE_FAILED"));

    await expect(capturar()).resolves.toEqual({
      captured: false,
      reason: "capture_failed",
      candidate: null,
    });
  });

  it("un fallo leyendo el consentimiento tampoco rompe el turno", async () => {
    mockedPreferences.mockRejectedValue(new Error("NETWORK"));

    await expect(capturar()).resolves.toEqual({
      captured: false,
      reason: "capture_failed",
      candidate: null,
    });
  });
});
