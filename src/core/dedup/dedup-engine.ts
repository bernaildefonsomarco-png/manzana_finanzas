import { createHash } from "node:crypto";
import type { DedupSignalOutput } from "@/agents/dedup-signal-agent";
import type { MovementInput } from "@/shared/schemas/money";
import type { MovementSource, MovementType } from "@/shared/types/domain";

export type DedupComparableMovement = {
  reference_id: string;
  movement_type: MovementType;
  amount: number;
  currency: "PEN" | "USD";
  occurred_at: string;
  description: string | null;
  merchant: string | null;
  source: MovementSource;
  source_ref: string | null;
  account_origin_id?: string | null;
  account_destination_id?: string | null;
};

export type DedupCandidate = DedupComparableMovement & {
  deterministic_score: number;
  deterministic_reasons: string[];
  time_distance_seconds: number;
};

export type DedupDecision = {
  status: "distinct" | "possible_duplicate" | "probable_duplicate" | "exact_duplicate";
  fingerprint: string;
  matched_reference_id: string | null;
  score: number;
  reasons: string[];
  requires_confirmation: boolean;
};

export function buildDedupFingerprint(input: DedupComparableMovement): string {
  const bucket = Math.floor(new Date(input.occurred_at).getTime() / 300_000);
  const canonical = [
    input.movement_type,
    input.currency,
    input.amount.toFixed(2),
    bucket,
    normalizeText(input.merchant ?? input.description ?? ""),
  ].join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

export function movementInputToDedupComparable(
  referenceId: string,
  input: MovementInput,
): DedupComparableMovement | null {
  if (input.amount === null) return null;
  return {
    reference_id: referenceId,
    movement_type: input.type,
    amount: input.amount,
    currency: input.currency,
    occurred_at: input.occurred_at,
    description: input.description,
    merchant: input.merchant,
    source: input.source,
    source_ref: input.source_ref,
    account_origin_id: input.account_origin_id,
    account_destination_id: input.account_destination_id,
  };
}

export function prefilterDedupCandidates(
  incoming: DedupComparableMovement,
  recent: DedupComparableMovement[],
): DedupCandidate[] {
  return recent
    .map((candidate) => scoreCandidate(incoming, candidate))
    .filter((candidate) => candidate.deterministic_score >= 0.62)
    .sort((left, right) => right.deterministic_score - left.deterministic_score)
    .slice(0, 8);
}

export function decideDedup(input: {
  incoming: DedupComparableMovement;
  candidates: DedupCandidate[];
  semantic?: DedupSignalOutput | null;
}): DedupDecision {
  const fingerprint = buildDedupFingerprint(input.incoming);
  const best = input.candidates[0];
  if (!best) return distinct(fingerprint);

  if (
    input.incoming.source_ref &&
    best.source_ref &&
    input.incoming.source === best.source &&
    input.incoming.source_ref === best.source_ref
  ) {
    return {
      status: "exact_duplicate",
      fingerprint,
      matched_reference_id: best.reference_id,
      score: 1,
      reasons: ["same_source_reference"],
      requires_confirmation: false,
    };
  }

  if (isStrictCrossChannelMatch(input.incoming, best)) {
    return {
      status: "exact_duplicate",
      fingerprint,
      matched_reference_id: best.reference_id,
      score: best.deterministic_score,
      reasons: unique([
        ...best.deterministic_reasons,
        "strict_cross_channel_match",
      ]),
      requires_confirmation: false,
    };
  }

  const semantic = input.semantic?.assessments.find(
    (assessment) => assessment.candidate_reference_id === best.reference_id,
  );
  const semanticSame =
    semantic?.relation === "same_transaction" && semantic.confidence >= 0.85;
  const semanticPossible =
    semantic?.relation === "possibly_same" && semantic.confidence >= 0.65;

  if (best.deterministic_score >= 0.92 || semanticSame) {
    return {
      status: "probable_duplicate",
      fingerprint,
      matched_reference_id: best.reference_id,
      score: Math.max(best.deterministic_score, semantic?.confidence ?? 0),
      reasons: unique([
        ...best.deterministic_reasons,
        ...(semantic?.evidence_signals.map((signal) => `semantic:${signal}`) ?? []),
      ]),
      requires_confirmation: true,
    };
  }

  if (best.deterministic_score >= 0.76 || semanticPossible) {
    return {
      status: "possible_duplicate",
      fingerprint,
      matched_reference_id: best.reference_id,
      score: Math.max(best.deterministic_score, semantic?.confidence ?? 0),
      reasons: unique(best.deterministic_reasons),
      requires_confirmation: true,
    };
  }

  return distinct(fingerprint);
}

function scoreCandidate(
  incoming: DedupComparableMovement,
  candidate: DedupComparableMovement,
): DedupCandidate {
  const reasons: string[] = [];
  let score = 0;
  if (incoming.amount === candidate.amount) {
    score += 0.4;
    reasons.push("same_amount");
  }
  if (incoming.currency === candidate.currency) {
    score += 0.1;
    reasons.push("same_currency");
  }
  if (incoming.movement_type === candidate.movement_type) {
    score += 0.15;
    reasons.push("same_movement_type");
  }
  const distance = Math.abs(
    new Date(incoming.occurred_at).getTime() - new Date(candidate.occurred_at).getTime(),
  ) / 1_000;
  if (distance <= 300) {
    score += 0.15;
    reasons.push("within_five_minutes");
  } else if (distance <= 86_400) {
    score += 0.06;
    reasons.push("same_day_window");
  }
  const textScore = tokenSimilarity(
    incoming.merchant ?? incoming.description ?? "",
    candidate.merchant ?? candidate.description ?? "",
  );
  if (textScore >= 0.8) reasons.push("matching_description_or_merchant");
  score += textScore * 0.2;

  const crossChannelEmail = isEmailCrossChannelPair(incoming, candidate);
  const sameDirection =
    movementDirection(incoming.movement_type) ===
    movementDirection(candidate.movement_type);
  const sameAccount = sharesKnownAccount(incoming, candidate);
  if (crossChannelEmail) reasons.push("email_cross_channel_pair");
  if (sameDirection) reasons.push("same_financial_direction");
  if (sameAccount) reasons.push("same_account");

  if (
    crossChannelEmail &&
    incoming.amount === candidate.amount &&
    incoming.currency === candidate.currency &&
    sameDirection &&
    distance <= 1_800
  ) {
    score = Math.max(score, textScore >= 0.8 || sameAccount ? 0.96 : 0.86);
    reasons.push("within_thirty_minutes");
    reasons.push(
      textScore >= 0.8 || sameAccount
        ? "cross_channel_additional_evidence"
        : "cross_channel_base_evidence_only",
    );
  }

  return {
    ...candidate,
    deterministic_score: Math.min(1, round(score)),
    deterministic_reasons: reasons,
    time_distance_seconds: Math.round(distance),
  };
}

function isStrictCrossChannelMatch(
  incoming: DedupComparableMovement,
  candidate: DedupCandidate,
): boolean {
  return (
    isEmailCrossChannelPair(incoming, candidate) &&
    incoming.amount === candidate.amount &&
    incoming.currency === candidate.currency &&
    movementDirection(incoming.movement_type) ===
      movementDirection(candidate.movement_type) &&
    candidate.time_distance_seconds <= 1_800 &&
    candidate.deterministic_reasons.includes(
      "cross_channel_additional_evidence",
    )
  );
}

function isEmailCrossChannelPair(
  left: DedupComparableMovement,
  right: DedupComparableMovement,
): boolean {
  return (
    (left.source === "email_confirmed") !==
    (right.source === "email_confirmed")
  );
}

function sharesKnownAccount(
  left: DedupComparableMovement,
  right: DedupComparableMovement,
): boolean {
  const leftAccounts = new Set(
    [left.account_origin_id, left.account_destination_id].filter(
      (value): value is string => Boolean(value),
    ),
  );
  return [right.account_origin_id, right.account_destination_id].some(
    (value) => Boolean(value && leftAccounts.has(value)),
  );
}

function movementDirection(
  movementType: MovementType,
): "outflow" | "inflow" | "internal" | "state" {
  if (
    ["gasto", "pago_deuda", "prestamo_dado", "pago_recurrente"].includes(
      movementType,
    )
  ) {
    return "outflow";
  }
  if (
    ["ingreso", "prestamo_recibido", "devolucion_recibida"].includes(
      movementType,
    )
  ) {
    return "inflow";
  }
  if (["transferencia", "asignacion_interna"].includes(movementType)) {
    return "internal";
  }
  return "state";
}

function tokenSimilarity(left: string, right: string): number {
  const a = new Set(normalizeText(left).split(" ").filter(Boolean));
  const b = new Set(normalizeText(right).split(" ").filter(Boolean));
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function distinct(fingerprint: string): DedupDecision {
  return {
    status: "distinct",
    fingerprint,
    matched_reference_id: null,
    score: 0,
    reasons: ["no_duplicate_evidence"],
    requires_confirmation: false,
  };
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
