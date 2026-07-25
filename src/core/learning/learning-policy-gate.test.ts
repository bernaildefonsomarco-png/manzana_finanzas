import { describe, expect, it } from "vitest";
import type { LearningCandidate } from "@/data/repositories/learning-candidates.repository";
import { evaluateLearningCandidate } from "./learning-policy-gate";

describe("LearningPolicyGate", () => {
  it("acepta una correccion confirmada sin exigir repeticion artificial", () => {
    expect(evaluateLearningCandidate(candidate())).toMatchObject({
      status: "accepted",
      may_promote_to_confirmed_memory: true,
    });
  });

  it("retiene toda inferencia sensible hasta confirmacion explicita", () => {
    expect(
      evaluateLearningCandidate(
        candidate({ sensitivity: "sensitive", evidence_count: 10 }),
      ),
    ).toMatchObject({
      status: "pending_confirmation",
      may_promote_to_confirmed_memory: false,
    });
  });

  it("exige evidencia repetida para preferencias inferidas", () => {
    const observed = evaluateLearningCandidate(
      candidate({
        kind: "preference",
        basis: "repeated_behavior",
        evidence_sources: ["behavior"],
        evidence_count: 2,
        confidence: 0.95,
      }),
    );
    const accepted = evaluateLearningCandidate(
      candidate({
        kind: "preference",
        basis: "repeated_behavior",
        evidence_sources: ["behavior"],
        evidence_count: 3,
        confidence: 0.9,
      }),
    );

    expect(observed.status).toBe("observed");
    expect(accepted.status).toBe("accepted");
  });
});

function candidate(
  patch: Partial<LearningCandidate> = {},
): LearningCandidate {
  return {
    id: "candidate-1",
    user_id: "user-1",
    kind: "correction_pattern",
    canonical_key: "correction:loan_to:desayuno",
    proposal_summary: "Correccion confirmada.",
    search_terms: ["desayuno"],
    basis: "confirmed_correction",
    evidence_sources: ["confirmed_correction"],
    evidence_refs: ["correction-1"],
    evidence_count: 1,
    positive_evidence_refs: ["correction-1"],
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
