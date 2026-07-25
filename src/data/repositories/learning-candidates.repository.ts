import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  LearningCandidateProposal,
  LearningEvidenceBasis,
  LearningMemoryKind,
} from "@/agents/learning-signal-agent";
import type { Database, Json } from "@/data/supabase/types";
import { logger } from "@/shared/telemetry/logger";
import type { FinancialMemoryItem } from "./financial-memory.repository";

type Client = SupabaseClient<Database>;

export type LearningCandidateStatus =
  | "observed"
  | "pending_confirmation"
  | "accepted"
  | "rejected"
  | "superseded"
  | "suspended"
  | "expired";

export type LearningEvidencePolarity = "positive" | "negative";

export type LearningCandidate = {
  id: string;
  user_id: string;
  kind: LearningMemoryKind;
  canonical_key: string;
  proposal_summary: string;
  search_terms: string[];
  basis: LearningEvidenceBasis;
  evidence_sources: string[];
  evidence_refs: string[];
  evidence_count: number;
  positive_evidence_refs: string[];
  negative_evidence_refs: string[];
  positive_evidence_count: number;
  negative_evidence_count: number;
  positive_evidence_weight: number;
  negative_evidence_weight: number;
  confidence: number;
  sensitivity: "normal" | "sensitive";
  requires_user_confirmation: boolean;
  status: LearningCandidateStatus;
  decision_reason: string | null;
  valid_until: string | null;
  review_at: string | null;
  last_evidence_at: string | null;
  last_conflict_at: string | null;
  promoted_memory_id: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
};

export type RecordLearningEvidenceInput = {
  userId: string;
  proposal: LearningCandidateProposal;
  evidenceSource: string;
  evidenceRef: string;
  polarity?: LearningEvidencePolarity;
  evidenceWeight?: number;
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
  claimValue?: Record<string, unknown> | null;
  observedAt?: string;
  metadata?: Record<string, unknown>;
};

export async function recordLearningCandidate(
  client: Client,
  input: RecordLearningEvidenceInput,
): Promise<LearningCandidate | null> {
  return recordLearningEvidence(client, {
    ...input,
    polarity: input.polarity ?? "positive",
  });
}

export async function recordLearningEvidence(
  client: Client,
  input: RecordLearningEvidenceInput,
): Promise<LearningCandidate | null> {
  try {
    const { data, error } = await client.rpc("record_learning_evidence", {
      p_user_id: input.userId,
      p_kind: input.proposal.kind,
      p_canonical_key: normalizeKey(input.proposal.canonical_key),
      p_proposal_summary: input.proposal.summary,
      p_search_terms: normalizeTerms(input.proposal.search_terms),
      p_basis: input.proposal.basis,
      p_evidence_source: input.evidenceSource,
      p_evidence_ref: input.evidenceRef,
      p_polarity: input.polarity ?? "positive",
      p_evidence_weight:
        input.evidenceWeight ?? input.proposal.confidence,
      p_sensitivity: input.proposal.sensitivity,
      p_requires_user_confirmation:
        input.proposal.requires_user_confirmation,
      p_valid_until: input.proposal.valid_until ?? "",
      p_source_entity_type: input.sourceEntityType ?? "",
      p_source_entity_id: input.sourceEntityId ?? "",
      p_claim_value: (input.claimValue ?? {}) as Json,
      p_observed_at: input.observedAt ?? new Date().toISOString(),
      p_metadata: (input.metadata ?? {}) as Json,
    });

    if (error) throw error;
    return data ? normalizeCandidate(data) : null;
  } catch (error) {
    logger.warn("learning.evidence_record_failed", {
      error,
      user_id: input.userId,
      kind: input.proposal.kind,
      polarity: input.polarity ?? "positive",
    });
    return null;
  }
}

export async function updateLearningCandidateDecision(
  client: Client,
  input: {
    candidateId: string;
    userId: string;
    status: LearningCandidateStatus;
    reason: string;
    actorType?: "user" | "policy" | "system" | "worker";
    idempotencyKey?: string;
  },
): Promise<LearningCandidate | null> {
  try {
    const actorType = input.actorType ?? "policy";
    const { data, error } = await client.rpc(
      "decide_learning_candidate",
      {
        p_user_id: input.userId,
        p_candidate_id: input.candidateId,
        p_status: input.status,
        p_reason: input.reason,
        p_actor_type: actorType,
        p_idempotency_key:
          input.idempotencyKey ??
          `candidate-decision:${input.candidateId}:${input.status}`,
      },
    );

    if (error) throw error;
    return data ? normalizeCandidate(data) : null;
  } catch (error) {
    logger.warn("learning.candidate_decision_failed", {
      error,
      user_id: input.userId,
      candidate_id: input.candidateId,
    });
    return null;
  }
}

export async function promoteLearningCandidate(
  client: Client,
  input: {
    candidateId: string;
    userId: string;
    actorType?: "user" | "policy";
    idempotencyKey: string;
  },
): Promise<FinancialMemoryItem | null> {
  try {
    const { data, error } = await client.rpc(
      "promote_learning_candidate",
      {
        p_user_id: input.userId,
        p_candidate_id: input.candidateId,
        p_actor_type: input.actorType ?? "policy",
        p_idempotency_key: input.idempotencyKey,
      },
    );
    if (error) throw error;
    return data ? normalizeMemoryItem(data) : null;
  } catch (error) {
    logger.warn("learning.candidate_promotion_failed", {
      error,
      user_id: input.userId,
      candidate_id: input.candidateId,
    });
    return null;
  }
}

export async function listLearningCandidates(
  client: Client,
  input: {
    userId: string;
    statuses?: LearningCandidateStatus[];
    limit?: number;
  },
): Promise<LearningCandidate[]> {
  let query = client
    .from("learning_candidates")
    .select("*")
    .eq("user_id", input.userId)
    .order("updated_at", { ascending: false })
    .limit(Math.min(Math.max(input.limit ?? 100, 1), 200));
  if (input.statuses?.length) {
    query = query.in("status", input.statuses);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(normalizeCandidate);
}

function normalizeCandidate(
  row: Database["public"]["Tables"]["learning_candidates"]["Row"],
): LearningCandidate {
  return {
    ...row,
    kind: row.kind as LearningMemoryKind,
    basis: row.basis as LearningEvidenceBasis,
    confidence: Number(row.confidence),
    positive_evidence_weight: Number(row.positive_evidence_weight),
    negative_evidence_weight: Number(row.negative_evidence_weight),
    sensitivity: row.sensitivity as "normal" | "sensitive",
    status: row.status as LearningCandidateStatus,
    metadata: normalizeObject(row.metadata),
  };
}

function normalizeMemoryItem(
  row: Database["public"]["Tables"]["financial_memory_items"]["Row"],
): FinancialMemoryItem {
  return {
    ...row,
    kind: row.kind as FinancialMemoryItem["kind"],
    confidence: Number(row.confidence),
    confirmation_status:
      row.confirmation_status as FinancialMemoryItem["confirmation_status"],
    lifecycle_status:
      row.lifecycle_status as FinancialMemoryItem["lifecycle_status"],
    sensitivity: row.sensitivity as FinancialMemoryItem["sensitivity"],
    metadata: normalizeObject(row.metadata),
  };
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180);
}

function normalizeTerms(values: string[]): string[] {
  return [
    ...new Set(
      values
        .map((value) =>
          value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .trim(),
        )
        .filter((value) => value.length > 1),
    ),
  ].slice(0, 30);
}

function normalizeObject(value: Json): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}
