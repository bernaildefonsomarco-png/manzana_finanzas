import type {
  LearningEvidenceBasis,
  LearningMemoryKind,
} from "@/agents/learning-signal-agent";

const DAY_MS = 24 * 60 * 60 * 1000;

const VALIDITY_DAYS: Record<LearningMemoryKind, number | null> = {
  preference: null,
  alias: 365,
  person_context: 180,
  correction_pattern: 180,
  narrative_fact: 120,
};

export function resolveLearningValidUntil(input: {
  kind: LearningMemoryKind;
  basis: LearningEvidenceBasis;
  sensitivity: "normal" | "sensitive";
  observedAt?: string;
  proposedValidUntil?: string | null;
}): string | null {
  const observedAt = new Date(input.observedAt ?? new Date().toISOString());
  const baseDays =
    input.sensitivity === "sensitive" &&
    input.basis !== "explicit_user_statement" &&
    input.basis !== "explicit_feedback"
      ? 30
      : input.basis === "repeated_behavior"
        ? Math.min(VALIDITY_DAYS[input.kind] ?? 90, 90)
        : VALIDITY_DAYS[input.kind];
  const policyDate =
    baseDays === null
      ? null
      : new Date(observedAt.getTime() + baseDays * DAY_MS);
  const proposedDate = input.proposedValidUntil
    ? new Date(input.proposedValidUntil)
    : null;

  if (policyDate === null) {
    return proposedDate?.toISOString() ?? null;
  }
  if (!proposedDate || proposedDate > policyDate) {
    return policyDate.toISOString();
  }
  return proposedDate.toISOString();
}
