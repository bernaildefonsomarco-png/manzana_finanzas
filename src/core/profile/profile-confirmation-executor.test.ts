import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  resolveProfileCandidateForUser,
  type ProfileCandidateRow,
} from "@/data/repositories/profile-candidates.repository";
import { applyProfileConfirmation } from "./profile-confirmation-executor";

vi.mock("@/data/repositories/profile-candidates.repository", () => ({
  resolveProfileCandidateForUser: vi.fn(),
}));

const mockedResolve = vi.mocked(resolveProfileCandidateForUser);
const CLIENT = {} as never;

const CANDIDATO: ProfileCandidateRow = {
  id: "22222222-2222-4222-8222-222222222222",
  subject_key: "vida:cobro",
  statement: "Cobras el 15 y el último día del mes",
  status: "pending_confirmation",
  ask_count: 1,
  evidence_refs: ["evento:evt-1"],
  last_asked_at: "2026-08-11T14:58:00.000Z",
  metadata: {},
  created_at: "2026-08-01T00:00:00.000Z",
};

describe("applyProfileConfirmation (`ACT-MEM-03`/`04`/`05`)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedResolve.mockResolvedValue({ resolved: true, promotedFactId: "f1" });
  });

  it("confirmar promueve el candidato a hecho y lo dice", async () => {
    const resultado = await applyProfileConfirmation({
      client: CLIENT,
      userId: "u1",
      candidato: CANDIDATO,
      answer: "confirm",
      traceId: "trace-1",
    });

    expect(mockedResolve).toHaveBeenCalledWith(
      CLIENT,
      expect.objectContaining({
        userId: "u1",
        candidateId: CANDIDATO.id,
        resolution: "confirm",
        statement: CANDIDATO.statement,
      }),
    );
    expect(resultado.kind).toBe("applied");
    expect(resultado.promotedFactId).toBe("f1");
    expect(resultado.text.length).toBeGreaterThan(0);
  });

  it("rechazar y silenciar no promueven nada", async () => {
    mockedResolve.mockResolvedValue({ resolved: true, promotedFactId: null });

    for (const answer of ["reject", "never_ask"] as const) {
      const resultado = await applyProfileConfirmation({
        client: CLIENT,
        userId: "u1",
        candidato: CANDIDATO,
        answer,
        traceId: "trace-1",
      });
      expect(resultado.promotedFactId).toBeNull();
      expect(resultado.text.length).toBeGreaterThan(0);
    }
  });

  it("un fallo de la base no deja el turno mudo", async () => {
    mockedResolve.mockRejectedValue(new Error("MEMORY_CANDIDATE_NOT_FOUND"));

    const resultado = await applyProfileConfirmation({
      client: CLIENT,
      userId: "u1",
      candidato: CANDIDATO,
      answer: "confirm",
      traceId: "trace-1",
    });

    expect(resultado.kind).toBe("failed");
    expect(resultado.text).toContain("no cambié nada");
  });

  it("la clave de idempotencia sale del turno y del candidato, no del reloj", async () => {
    await applyProfileConfirmation({
      client: CLIENT,
      userId: "u1",
      candidato: CANDIDATO,
      answer: "confirm",
      traceId: "trace-1",
    });
    await applyProfileConfirmation({
      client: CLIENT,
      userId: "u1",
      candidato: CANDIDATO,
      answer: "confirm",
      traceId: "trace-1",
    });

    const [primera, segunda] = mockedResolve.mock.calls.map(
      (call) => call[1].idempotencyKey,
    );
    expect(primera).toBe(segunda);
  });
});
