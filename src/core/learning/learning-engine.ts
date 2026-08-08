import type { SupabaseClient } from "@supabase/supabase-js";

import {
  LearningCandidateProposalSchema,
  LearningSignalAgent,
  type LearningCandidateProposal,
  type LearningSignalContextPack,
} from "@/agents/learning-signal-agent";
import type { ParsedCorrectionCommand } from "@/core/orchestrator/correction-resolution";
import type { Database } from "@/data/supabase/types";
import {
  listLearningCandidates,
  promoteLearningCandidate,
  recordLearningCandidate,
  recordLearningEvidence,
  updateLearningCandidateDecision,
  type LearningCandidate,
  type LearningCandidateStatus,
  type LearningEvidencePolarity,
} from "@/data/repositories/learning-candidates.repository";
import { logger } from "@/shared/telemetry/logger";
import type { Movement } from "@/shared/types/domain";
import { resolveLearningValidUntil } from "./learning-expiration-policy";
import { evaluateLearningCandidate } from "./learning-policy-gate";

type Client = SupabaseClient<Database>;
type ConfirmedCorrectionCommand = Exclude<
  ParsedCorrectionCommand,
  { kind: "cancel" }
>;
type ConfirmedMovementLearningSignal = Pick<
  Movement,
  | "id"
  | "type"
  | "description"
  | "merchant"
  | "category_id"
  | "status"
  | "updated_at"
>;

export type LearningOutcome = {
  candidate_id: string | null;
  memory_id: string | null;
  kind: LearningCandidateProposal["kind"];
  canonical_key: string;
  status: LearningCandidateStatus;
  reason: string;
  promoted_to_memory: boolean;
  source:
    | "deterministic_extractor"
    | "learning_signal_agent"
    | "explicit_user_input"
    | "confirmed_domain_event";
};

type ProposedLearning = {
  userId: string;
  proposal: LearningCandidateProposal;
  source: LearningOutcome["source"];
  evidenceSource: string;
  evidenceRef: string;
  polarity: LearningEvidencePolarity;
  evidenceWeight: number;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  claimValue: Record<string, unknown> | null;
  observedAt: string;
  confirmedByUser: boolean;
  metadata: Record<string, unknown>;
};

export class LearningEngine {
  constructor(
    private readonly client: Client,
    private readonly options: {
      learningSignalAgent?: LearningSignalAgent;
      timezone?: string;
    } = {},
  ) {}

  async learnFromConfirmedCorrection(input: {
    userId: string;
    command: ConfirmedCorrectionCommand;
    movement: Movement;
    traceId?: string;
  }): Promise<LearningOutcome[]> {
    if (
      input.command.kind === "delete" ||
      input.command.kind === "amount" ||
      input.command.kind === "account_origin" ||
      input.command.kind === "account_destination"
    ) {
      return [];
    }

    const evidenceRef = input.command.command_id;
    const traceId = input.traceId ?? evidenceRef;
    const deterministic = buildConfirmedCorrectionProposals(input);
    const contextPack = buildLearningContextPack(
      input,
      evidenceRef,
      this.options.timezone ?? "America/Lima",
    );
    const agentProposals = await this.proposeWithAgent(contextPack, traceId);
    const proposals = mergeProposals(
      deterministic,
      normalizeAgentCorrectionProposals(agentProposals, input.command),
    );

    if (input.command.kind === "category") {
      await this.recordContradictionsForPreviousClassifications({
        userId: input.userId,
        subject: normalizeSubject(
          input.movement.description ??
            input.movement.merchant ??
            "movimiento",
        ),
        acceptedKey: `classification:${normalizeSubject(
          input.movement.description ??
            input.movement.merchant ??
            "movimiento",
        )}:${input.command.category_id}`,
        evidenceRef,
        traceId,
        observedAt: input.movement.updated_at,
      });
    }

    return this.processProposals(
      proposals.map((entry) => ({
        ...entry,
        userId: input.userId,
        evidenceSource: "confirmed_correction",
        evidenceRef,
        polarity: "positive" as const,
        evidenceWeight: 1,
        sourceEntityType: "movement",
        sourceEntityId: input.movement.id,
        claimValue: {
          correction_kind: input.command.kind,
          target_value: correctionTargetValue(input.command),
        },
        observedAt: input.movement.updated_at,
        confirmedByUser: true,
        metadata: {
          movement_id: input.movement.id,
          correction_kind: input.command.kind,
          trace_id: traceId,
        },
      })),
      traceId,
    );
  }

  async learnFromConfirmedMovement(input: {
    userId: string;
    movement: ConfirmedMovementLearningSignal;
    traceId?: string;
  }): Promise<LearningOutcome[]> {
    const subject = normalizeSubject(
      input.movement.merchant ??
        input.movement.description ??
        "",
    );
    if (
      !subject ||
      !input.movement.category_id ||
      !["confirmed", "corrected"].includes(input.movement.status)
    ) {
      return [];
    }
    const observedAt = input.movement.updated_at;
    const proposal = withPolicyExpiry(
      LearningCandidateProposalSchema.parse({
        kind: "correction_pattern",
        canonical_key:
          `classification:${subject}:${input.movement.category_id}`,
        summary:
          `${subject} suele corresponder a ${input.movement.category_id}.`,
        search_terms: [
          subject,
          input.movement.category_id,
          input.movement.type,
        ],
        basis: "repeated_behavior",
        confidence: 0.85,
        sensitivity: "normal",
        requires_user_confirmation: false,
        valid_until: null,
        evidence_signals: [
          "confirmed_movement",
          input.movement.id,
        ],
      }),
      observedAt,
    );

    return this.processProposals(
      [
        {
          userId: input.userId,
          proposal,
          source: "confirmed_domain_event",
          evidenceSource: "confirmed_movement",
          evidenceRef: `movement:${input.movement.id}`,
          polarity: "positive",
          evidenceWeight: 0.85,
          sourceEntityType: "movement",
          sourceEntityId: input.movement.id,
          claimValue: {
            subject,
            category_id: input.movement.category_id,
          },
          observedAt,
          confirmedByUser: false,
          metadata: {
            movement_id: input.movement.id,
            trace_id: input.traceId ?? input.movement.id,
          },
        },
      ],
      input.traceId ?? input.movement.id,
    );
  }

  async learnExplicitPreference(input: {
    userId: string;
    canonicalKey: string;
    summary: string;
    searchTerms: string[];
    evidenceRef: string;
    claimValue: Record<string, unknown>;
    traceId?: string;
    observedAt?: string;
    /**
     * Confianza de quien interpreto la declaracion. Se propaga al candidato
     * para que `evaluateLearningCandidate` decida de verdad: con el `1` fijo
     * de antes toda frase quedaba aceptada y el umbral de 0.85 no filtraba
     * nada. Por omision se conserva la certeza absoluta para los llamadores
     * que ya venian con evidencia confirmada.
     */
    confidence?: number;
  }): Promise<LearningOutcome[]> {
    const observedAt = input.observedAt ?? new Date().toISOString();
    const confidence = Number.isFinite(input.confidence)
      ? Math.min(1, Math.max(0, input.confidence as number))
      : 1;
    const proposal = withPolicyExpiry(
      LearningCandidateProposalSchema.parse({
        kind: "preference",
        canonical_key: input.canonicalKey,
        summary: input.summary,
        search_terms: input.searchTerms,
        basis: "explicit_user_statement",
        confidence,
        sensitivity: "normal",
        requires_user_confirmation: false,
        valid_until: null,
        evidence_signals: ["explicit_user_statement", input.evidenceRef],
      }),
      observedAt,
    );
    return this.processProposals(
      [
        {
          userId: input.userId,
          proposal,
          source: "explicit_user_input",
          evidenceSource: "explicit_user_statement",
          evidenceRef: input.evidenceRef,
          polarity: "positive",
          evidenceWeight: 1,
          sourceEntityType: "conversation_turn",
          sourceEntityId: input.evidenceRef,
          claimValue: input.claimValue,
          observedAt,
          confirmedByUser: true,
          metadata: { trace_id: input.traceId ?? input.evidenceRef },
        },
      ],
      input.traceId ?? input.evidenceRef,
    );
  }

  async recordContradiction(input: {
    userId: string;
    candidate: LearningCandidate;
    evidenceRef: string;
    evidenceSource: string;
    sourceEntityType?: string | null;
    sourceEntityId?: string | null;
    claimValue?: Record<string, unknown> | null;
    observedAt?: string;
    traceId?: string;
  }): Promise<LearningOutcome[]> {
    const proposal = proposalFromCandidate(input.candidate);
    return this.processProposals(
      [
        {
          userId: input.userId,
          proposal,
          source: "deterministic_extractor",
          evidenceSource: input.evidenceSource,
          evidenceRef: input.evidenceRef,
          polarity: "negative",
          evidenceWeight: 1,
          sourceEntityType: input.sourceEntityType ?? null,
          sourceEntityId: input.sourceEntityId ?? null,
          claimValue: input.claimValue ?? null,
          observedAt: input.observedAt ?? new Date().toISOString(),
          confirmedByUser: true,
          metadata: { trace_id: input.traceId ?? input.evidenceRef },
        },
      ],
      input.traceId ?? input.evidenceRef,
    );
  }

  private async processProposals(
    entries: ProposedLearning[],
    traceId: string,
  ): Promise<LearningOutcome[]> {
    const outcomes: LearningOutcome[] = [];

    for (const entry of entries) {
      const proposal = withPolicyExpiry(
        entry.proposal,
        entry.observedAt,
      );
      const candidate = await recordLearningCandidate(this.client, {
        userId: entry.userId,
        proposal,
        evidenceSource: entry.evidenceSource,
        evidenceRef: entry.evidenceRef,
        polarity: entry.polarity,
        evidenceWeight: entry.evidenceWeight,
        sourceEntityType: entry.sourceEntityType,
        sourceEntityId: entry.sourceEntityId,
        claimValue: entry.claimValue,
        observedAt: entry.observedAt,
        metadata: entry.metadata,
      });

      if (!candidate) {
        outcomes.push({
          candidate_id: null,
          memory_id: null,
          kind: proposal.kind,
          canonical_key: proposal.canonical_key,
          status: "observed",
          reason: "candidate_store_unavailable_no_memory_written",
          promoted_to_memory: false,
          source: entry.source,
        });
        continue;
      }

      const decision = evaluateLearningCandidate(candidate);
      const actorType =
        decision.status === "accepted" && entry.confirmedByUser
          ? "user"
          : "policy";
      const decided = await updateLearningCandidateDecision(this.client, {
        candidateId: candidate.id,
        userId: candidate.user_id,
        status: decision.status,
        reason: decision.reason,
        actorType,
        idempotencyKey:
          `candidate:${candidate.id}:${decision.status}:` +
          entry.evidenceRef,
      });
      let memoryId: string | null = null;

      if (decision.may_promote_to_confirmed_memory) {
        const memory = await promoteLearningCandidate(this.client, {
          userId: candidate.user_id,
          candidateId: candidate.id,
          actorType: entry.confirmedByUser ? "user" : "policy",
          idempotencyKey:
            `promote:${candidate.id}:${entry.evidenceRef}`,
        });
        memoryId = memory?.id ?? null;
      }

      outcomes.push({
        candidate_id: candidate.id,
        memory_id: memoryId,
        kind: candidate.kind,
        canonical_key: candidate.canonical_key,
        status: decided?.status ?? decision.status,
        reason: decision.reason,
        promoted_to_memory: memoryId !== null,
        source: entry.source,
      });
    }

    logger.info("learning.evidence_processed", {
      trace_id: traceId,
      operation: "learning",
      candidate_count: outcomes.length,
      promoted_count: outcomes.filter(
        (item) => item.promoted_to_memory,
      ).length,
      suspended_count: outcomes.filter(
        (item) => item.status === "suspended",
      ).length,
    });
    return outcomes;
  }

  private async recordContradictionsForPreviousClassifications(input: {
    userId: string;
    subject: string;
    acceptedKey: string;
    evidenceRef: string;
    traceId: string;
    observedAt: string;
  }): Promise<void> {
    try {
      const candidates = await listLearningCandidates(this.client, {
        userId: input.userId,
        statuses: [
          "observed",
          "pending_confirmation",
          "accepted",
          "suspended",
        ],
        limit: 200,
      });
      const prefix = `classification:${input.subject}:`;
      for (const candidate of candidates) {
        if (
          candidate.kind !== "correction_pattern" ||
          !candidate.canonical_key.startsWith(prefix) ||
          candidate.canonical_key === input.acceptedKey
        ) {
          continue;
        }
        await recordLearningEvidence(this.client, {
          userId: input.userId,
          proposal: proposalFromCandidate(candidate),
          evidenceSource: "confirmed_correction",
          evidenceRef: `${input.evidenceRef}:contradicts:${candidate.id}`,
          polarity: "negative",
          evidenceWeight: 1,
          sourceEntityType: "learning_candidate",
          sourceEntityId: candidate.id,
          claimValue: { corrected_to: input.acceptedKey },
          observedAt: input.observedAt,
          metadata: { trace_id: input.traceId },
        });
      }
    } catch (error) {
      logger.warn("learning.contradiction_scan_failed", {
        error,
        user_id: input.userId,
        trace_id: input.traceId,
      });
    }
  }

  private async proposeWithAgent(
    contextPack: LearningSignalContextPack,
    traceId: string,
  ): Promise<LearningCandidateProposal[]> {
    try {
      const agent =
        this.options.learningSignalAgent ?? new LearningSignalAgent();
      const result = await agent.propose(contextPack, traceId);
      return result.output.candidates;
    } catch (error) {
      logger.warn("learning.signal_agent_failed", {
        error,
        trace_id: traceId,
        user_id: contextPack.user_id,
        operation: "learning",
      });
      return [];
    }
  }
}

function buildConfirmedCorrectionProposals(input: {
  command: ConfirmedCorrectionCommand;
  movement: Movement;
}): LearningCandidateProposal[] {
  const subject = normalizeSubject(
    input.movement.description ??
      input.movement.merchant ??
      "movimiento",
  );
  if (input.command.kind === "category") {
    return [
      LearningCandidateProposalSchema.parse({
        kind: "correction_pattern",
        canonical_key:
          `classification:${subject}:${input.command.category_id}`,
        summary:
          `${subject} corresponde a ${input.command.category_id} ` +
          "segun una correccion confirmada.",
        search_terms: [
          subject,
          input.command.category_id,
          input.movement.type,
        ],
        basis: "confirmed_correction",
        confidence: 1,
        sensitivity: "normal",
        requires_user_confirmation: false,
        valid_until: null,
        evidence_signals: [
          "confirmed_correction",
          input.command.command_id,
        ],
      }),
    ];
  }
  if (
    input.command.kind === "loan_to" ||
    input.command.kind === "loan_from"
  ) {
    const person = input.command.related_person_name;
    return [
      LearningCandidateProposalSchema.parse({
        kind: "person_context",
        canonical_key:
          `person:${normalizeSubject(person)}:${input.command.kind}`,
        summary:
          input.command.kind === "loan_to"
            ? `El usuario presto dinero a ${person}.`
            : `El usuario recibio un prestamo de ${person}.`,
        search_terms: [
          person,
          input.command.kind,
          subject,
        ],
        basis: "confirmed_correction",
        confidence: 1,
        sensitivity: "sensitive",
        requires_user_confirmation: true,
        valid_until: null,
        evidence_signals: [
          "confirmed_correction",
          input.command.command_id,
        ],
      }),
    ];
  }
  return [];
}

function normalizeAgentCorrectionProposals(
  proposals: LearningCandidateProposal[],
  command: ConfirmedCorrectionCommand,
): LearningCandidateProposal[] {
  if (command.kind === "category") {
    return proposals
      .filter((proposal) => proposal.kind === "correction_pattern")
      .map((proposal) => ({
        ...proposal,
        basis: "confirmed_correction" as const,
        sensitivity: "normal" as const,
        requires_user_confirmation: false,
      }));
  }
  if (command.kind === "loan_to" || command.kind === "loan_from") {
    return proposals
      .filter(
        (proposal) =>
          proposal.kind === "person_context" ||
          proposal.kind === "correction_pattern",
      )
      .map((proposal) => ({
        ...proposal,
        basis: "confirmed_correction" as const,
        sensitivity: "sensitive" as const,
        requires_user_confirmation: true,
      }));
  }
  return [];
}

function buildLearningContextPack(
  input: {
    userId: string;
    command: ConfirmedCorrectionCommand;
    movement: Movement;
  },
  evidenceRef: string,
  timezone: string,
): LearningSignalContextPack {
  return {
    context_pack_type: "learning_signal_context",
    version: "v1",
    user_id: input.userId,
    locale: "es-PE",
    timezone,
    signal_type: "confirmed_correction",
    event_confirmed: true,
    evidence_source: "confirmed_correction",
    evidence_ref: evidenceRef,
    movement: {
      id: input.movement.id,
      type: input.movement.type,
      description: input.movement.description,
      merchant: input.movement.merchant,
      category_id: input.movement.category_id,
      source: input.movement.source,
      occurred_at: input.movement.occurred_at,
    },
    correction: {
      kind: input.command.kind,
      related_person_name: relatedPersonName(input.command),
      target_value: correctionTargetValue(input.command),
    },
  };
}

function mergeProposals(
  deterministic: LearningCandidateProposal[],
  agentProposals: LearningCandidateProposal[],
): Array<{
  proposal: LearningCandidateProposal;
  source: LearningOutcome["source"];
}> {
  const merged = new Map<
    string,
    {
      proposal: LearningCandidateProposal;
      source: LearningOutcome["source"];
    }
  >();
  for (const proposal of deterministic) {
    merged.set(proposalKey(proposal), {
      proposal,
      source: "deterministic_extractor",
    });
  }
  for (const proposal of agentProposals) {
    const parsed = LearningCandidateProposalSchema.safeParse(proposal);
    if (!parsed.success) continue;
    const key = proposalKey(parsed.data);
    if (!merged.has(key)) {
      merged.set(key, {
        proposal: parsed.data,
        source: "learning_signal_agent",
      });
    }
  }
  return [...merged.values()];
}

function proposalFromCandidate(
  candidate: LearningCandidate,
): LearningCandidateProposal {
  return LearningCandidateProposalSchema.parse({
    kind: candidate.kind,
    canonical_key: candidate.canonical_key,
    summary: candidate.proposal_summary,
    search_terms: candidate.search_terms,
    basis: candidate.basis,
    confidence: Math.max(candidate.confidence, 0.001),
    sensitivity: candidate.sensitivity,
    requires_user_confirmation:
      candidate.requires_user_confirmation,
    valid_until: candidate.valid_until,
    evidence_signals: candidate.evidence_refs.slice(0, 10),
  });
}

function withPolicyExpiry(
  proposal: LearningCandidateProposal,
  observedAt: string,
): LearningCandidateProposal {
  return {
    ...proposal,
    valid_until: resolveLearningValidUntil({
      kind: proposal.kind,
      basis: proposal.basis,
      sensitivity: proposal.sensitivity,
      observedAt,
      proposedValidUntil: proposal.valid_until,
    }),
  };
}

function proposalKey(proposal: LearningCandidateProposal): string {
  return `${proposal.kind}:${proposal.canonical_key}`;
}

function relatedPersonName(
  command: ConfirmedCorrectionCommand,
): string | null {
  return command.kind === "loan_to" || command.kind === "loan_from"
    ? command.related_person_name
    : null;
}

function correctionTargetValue(
  command: ConfirmedCorrectionCommand,
): string | number | null {
  if (command.kind === "amount") return command.amount;
  if (command.kind === "category") return command.category_id;
  if (
    command.kind === "account_origin" ||
    command.kind === "account_destination"
  ) {
    return command.account_id;
  }
  if (command.kind === "loan_to" || command.kind === "loan_from") {
    return command.related_person_name;
  }
  return null;
}

function normalizeSubject(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.length > 120
    ? normalized.slice(0, 120)
    : normalized;
}
