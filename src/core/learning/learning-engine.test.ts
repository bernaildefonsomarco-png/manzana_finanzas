import { beforeEach, describe, expect, it, vi } from "vitest";
import { LearningEngine } from "./learning-engine";
import {
  listLearningCandidates,
  promoteLearningCandidate,
  recordLearningCandidate,
  recordLearningEvidence,
  updateLearningCandidateDecision,
  type LearningCandidate,
} from "@/data/repositories/learning-candidates.repository";
import type { Movement } from "@/shared/types/domain";

vi.mock("@/data/repositories/learning-candidates.repository", () => ({
  listLearningCandidates: vi.fn(),
  promoteLearningCandidate: vi.fn(),
  recordLearningCandidate: vi.fn(),
  recordLearningEvidence: vi.fn(),
  updateLearningCandidateDecision: vi.fn(),
}));

const mockedList = vi.mocked(listLearningCandidates);
const mockedPromote = vi.mocked(promoteLearningCandidate);
const mockedRecord = vi.mocked(recordLearningCandidate);
const mockedRecordEvidence = vi.mocked(recordLearningEvidence);
const mockedDecision = vi.mocked(updateLearningCandidateDecision);

describe("LearningEngine", () => {
  beforeEach(() => {
    mockedList.mockReset().mockResolvedValue([]);
    mockedPromote.mockReset();
    mockedRecord.mockReset();
    mockedRecordEvidence.mockReset();
    mockedDecision.mockReset();
  });

  it("promueve una correccion confirmada solo despues del gate deterministico", async () => {
    const observed = candidate();
    mockedRecord.mockResolvedValue(observed);
    mockedDecision.mockResolvedValue({
      ...observed,
      status: "accepted",
    });
    mockedPromote.mockResolvedValue({ id: "memory-1" } as never);
    const engine = new LearningEngine({} as never, {
      learningSignalAgent: {
        propose: vi.fn().mockRejectedValue(new Error("runtime offline")),
      } as never,
    });

    const outcomes = await engine.learnFromConfirmedCorrection({
      userId: "user-1",
      command: {
        kind: "category",
        command_id: "corr:category:movement-1:alimentacion",
        movement_id: "movement-1",
        category_id: "alimentacion",
      },
      movement: movement(),
      traceId: "trace-1",
    });

    expect(mockedRecord).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: "user-1",
        evidenceSource: "confirmed_correction",
        evidenceRef: "corr:category:movement-1:alimentacion",
      }),
    );
    expect(mockedDecision).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorType: "user",
        status: "accepted",
      }),
    );
    expect(mockedPromote).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        candidateId: "candidate-1",
        actorType: "user",
      }),
    );
    expect(outcomes[0]).toMatchObject({
      status: "accepted",
      promoted_to_memory: true,
      source: "deterministic_extractor",
    });
  });

  it("no escribe memoria estable si el candidate store no esta disponible", async () => {
    mockedRecord.mockResolvedValue(null);
    const engine = new LearningEngine({} as never, {
      learningSignalAgent: {
        propose: vi.fn().mockResolvedValue({
          output: { candidates: [] },
        }),
      } as never,
    });

    const outcomes = await engine.learnExplicitPreference({
      userId: "user-1",
      canonicalKey: "preference:conversation_style:brief",
      summary: "El usuario prefiere respuestas breves.",
      searchTerms: ["respuestas", "breves"],
      evidenceRef: "turn-1",
      claimValue: { style: "brief" },
    });

    expect(mockedPromote).not.toHaveBeenCalled();
    expect(outcomes[0]).toMatchObject({
      candidate_id: null,
      promoted_to_memory: false,
      reason: "candidate_store_unavailable_no_memory_written",
    });
  });

  it("registra contradiccion como evidencia negativa trazable", async () => {
    mockedRecord.mockResolvedValue({
      ...candidate(),
      status: "suspended",
      negative_evidence_count: 1,
      negative_evidence_refs: ["correction-2"],
    });
    mockedDecision.mockResolvedValue({
      ...candidate(),
      status: "suspended",
    });
    const engine = new LearningEngine({} as never);

    await engine.recordContradiction({
      userId: "user-1",
      candidate: candidate(),
      evidenceRef: "correction-2",
      evidenceSource: "confirmed_correction",
    });

    expect(mockedRecord).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        polarity: "negative",
        evidenceRef: "correction-2",
      }),
    );
    expect(mockedPromote).not.toHaveBeenCalled();
  });

  it("no convierte una eliminacion en preferencia del usuario", async () => {
    const engine = new LearningEngine({} as never);

    const outcomes = await engine.learnFromConfirmedCorrection({
      userId: "user-1",
      command: {
        kind: "delete",
        command_id: "corr:delete:movement-1",
        movement_id: "movement-1",
        delete_mode: "soft_delete",
      },
      movement: movement(),
    });

    expect(outcomes).toEqual([]);
    expect(mockedRecord).not.toHaveBeenCalled();
    expect(mockedPromote).not.toHaveBeenCalled();
  });
});

function candidate(
  patch: Partial<LearningCandidate> = {},
): LearningCandidate {
  return {
    id: "candidate-1",
    user_id: "user-1",
    kind: "correction_pattern",
    canonical_key: "classification:desayuno:alimentacion",
    proposal_summary: "Desayuno corresponde a alimentacion.",
    search_terms: ["desayuno", "alimentacion"],
    basis: "confirmed_correction",
    evidence_sources: ["confirmed_correction"],
    evidence_refs: ["corr:category:movement-1:alimentacion"],
    evidence_count: 1,
    positive_evidence_refs: ["corr:category:movement-1:alimentacion"],
    negative_evidence_refs: [],
    positive_evidence_count: 1,
    negative_evidence_count: 0,
    positive_evidence_weight: 1,
    negative_evidence_weight: 0,
    confidence: 1,
    sensitivity: "normal",
    requires_user_confirmation: false,
    status: "observed",
    decision_reason: null,
    valid_until: null,
    review_at: null,
    last_evidence_at: "2026-07-18T10:00:00.000Z",
    last_conflict_at: null,
    promoted_memory_id: null,
    decided_at: null,
    created_at: "2026-07-18T10:00:00.000Z",
    updated_at: "2026-07-18T10:00:00.000Z",
    metadata: {},
    ...patch,
  };
}

function movement(): Movement {
  return {
    id: "00000000-0000-4000-8000-000000000010",
    user_id: "00000000-0000-4000-8000-000000000002",
    type: "gasto",
    amount: 20,
    currency: "PEN",
    description: "desayuno",
    merchant: null,
    category_id: "otros",
    account_origin_id: null,
    account_destination_id: null,
    box_origin_id: null,
    box_destination_id: null,
    related_person_id: null,
    debt_id: null,
    recurring_rule_id: null,
    recurring_occurrence_id: null,
    subcategory_id: null,
    idempotency_key: "movement-1",
    affects_total_balance: true,
    affects_account_balance: false,
    occurred_at: "2026-07-16T10:00:00.000Z",
    created_at: "2026-07-16T10:00:00.000Z",
    updated_at: "2026-07-16T10:00:00.000Z",
    status: "corrected",
    source: "whatsapp",
    source_ref: "whatsapp:event-1",
    confidence: 1,
    requires_review: false,
    deleted_at: null,
    metadata: {},
  };
}
