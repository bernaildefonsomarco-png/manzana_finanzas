import type { LearningCandidate } from "@/data/repositories/learning-candidates.repository";

export type LearningPolicyDecision = {
  status:
    | "observed"
    | "pending_confirmation"
    | "accepted"
    | "rejected"
    | "superseded"
    | "suspended"
    | "expired";
  reason: string;
  may_promote_to_confirmed_memory: boolean;
};

export function evaluateLearningCandidate(
  candidate: LearningCandidate,
): LearningPolicyDecision {
  if (
    candidate.status === "rejected" ||
    candidate.status === "superseded" ||
    candidate.status === "expired"
  ) {
    return decision(
      candidate.status,
      "terminal_learning_state_is_not_resurrected",
    );
  }

  if (
    candidate.valid_until &&
    new Date(candidate.valid_until).getTime() <= Date.now()
  ) {
    return decision("expired", "learning_validity_elapsed");
  }

  if (
    candidate.status === "suspended" ||
    candidate.negative_evidence_count > 0
  ) {
    return decision(
      "suspended",
      "contradictory_evidence_requires_user_resolution",
    );
  }

  if (candidate.sensitivity === "sensitive") {
    return decision(
      "pending_confirmation",
      "sensitive_learning_requires_explicit_confirmation",
    );
  }

  if (candidate.requires_user_confirmation) {
    return decision(
      "pending_confirmation",
      "agent_marked_confirmation_required",
    );
  }

  if (
    candidate.kind === "correction_pattern" &&
    candidate.basis === "confirmed_correction" &&
    candidate.evidence_sources.includes("confirmed_correction") &&
    candidate.confidence >= 0.75
  ) {
    return decision("accepted", "confirmed_correction_is_direct_evidence");
  }

  if (
    candidate.basis === "explicit_user_statement" ||
    candidate.basis === "explicit_feedback"
  ) {
    if (candidate.confidence >= 0.85) {
      return decision("accepted", "explicit_user_evidence_above_threshold");
    }
    return decision("observed", "explicit_evidence_below_confidence_threshold");
  }

  const threshold = minimumEvidence(candidate.kind);
  if (
    candidate.basis === "repeated_behavior" &&
    candidate.evidence_count >= threshold &&
    candidate.confidence >= 0.85
  ) {
    return decision("accepted", "repeated_evidence_above_policy_threshold");
  }

  return decision("observed", "insufficient_confirmed_evidence");
}

function minimumEvidence(kind: LearningCandidate["kind"]): number {
  if (kind === "preference") return 3;
  if (kind === "alias" || kind === "person_context") return 2;
  if (kind === "narrative_fact") return 3;
  return 2;
}

function decision(
  status: LearningPolicyDecision["status"],
  reason: string,
): LearningPolicyDecision {
  return {
    status,
    reason,
    may_promote_to_confirmed_memory: status === "accepted",
  };
}
