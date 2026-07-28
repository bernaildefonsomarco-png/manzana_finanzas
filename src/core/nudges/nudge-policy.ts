import type { Channel } from "@/core/channel/types";
import type {
  NudgeCandidate,
  NudgeDelivery,
  NudgeType,
  UserPreferences,
} from "@/shared/types/domain";

const activeCandidateStatuses = new Set([
  "candidate",
  "approved",
  "deferred",
  "scheduled",
]);
const deliveredStatuses = new Set([
  "sent",
  "delivered",
  "responded",
  "acted",
]);
const insightTypes = new Set<NudgeType>([
  "insight_prompt",
  "anomaly_alert",
  "progress_positive",
]);

export type NudgePolicyDecision = {
  decision: "send" | "defer" | "dashboard_only" | "reject";
  channel: Channel;
  delivery_mode: string;
  scheduled_for: string | null;
  reasons: string[];
  requires_disclosure: boolean;
};

// El adaptador de canal decide como (y si) se puede entregar: el nucleo solo
// declara que quiere mandar algo accionable, sensible o no, y deja que quien
// conoce la ventana de mensajeria / plantillas responda. Esto reemplaza el
// import directo del adaptador de canal (21 S6).
export type ChannelDeliveryCheck = (input: {
  intent: "insight" | "nudge";
  hasActionableValue: boolean;
  isSensitive: boolean;
  discreetCopyPrepared: boolean;
  now: Date;
}) =>
  | { eligible: true; mode: string; reason: string }
  | { eligible: false; reason: string };

export function evaluateNudgePolicy(input: {
  candidate: NudgeCandidate;
  preferences: UserPreferences | null;
  explicitTypeOptIn: boolean;
  pausedUntil?: string | null;
  recentDeliveries: NudgeDelivery[];
  sensitiveCopyPrepared?: boolean;
  now?: Date;
  timezone?: string;
  channel: Channel;
  checkChannelDelivery: ChannelDeliveryCheck;
}): NudgePolicyDecision {
  const now = input.now ?? new Date();
  const timezone = input.timezone ?? "America/Lima";
  const candidate = input.candidate;

  if (!activeCandidateStatuses.has(candidate.status)) {
    return reject("candidate_not_active");
  }
  const candidateMetadata = asRecord(candidate.metadata);
  if (
    candidateMetadata.delivery_channel === "dashboard_only" ||
    positiveNumber(candidateMetadata.backfill_pending_count) > 0
  ) {
    return dashboardOnly("backfill_dashboard_only");
  }
  if (
    candidate.scheduled_for &&
    new Date(candidate.scheduled_for).getTime() > now.getTime()
  ) {
    return defer(candidate.scheduled_for, "candidate_not_due_yet");
  }
  if (
    input.pausedUntil &&
    new Date(input.pausedUntil).getTime() > now.getTime()
  ) {
    return defer(input.pausedUntil, "nudge_type_paused");
  }
  if (!input.preferences?.whatsapp_opt_in || !input.explicitTypeOptIn) {
    return dashboardOnly("whatsapp_opt_in_missing");
  }

  const quietHours = resolveQuietHours(input.preferences);
  if (isQuietHoursActive(now, timezone, quietHours.start, quietHours.end)) {
    return defer(
      nextQuietHoursEnd(now, timezone, quietHours.end),
      "quiet_hours",
    );
  }

  const deliveries = input.recentDeliveries.filter((delivery) =>
    deliveredStatuses.has(delivery.status),
  );
  if (
    deliveries.some(
      (delivery) => delivery.nudge_candidate_id === candidate.id,
    )
  ) {
    return reject("candidate_already_delivered");
  }

  const todayDeliveries = deliveries.filter((delivery) =>
    isSameLocalDay(delivery.sent_at ?? delivery.created_at, now, timezone),
  );
  if (todayDeliveries.length >= 2) {
    return defer(nextLocalDayStart(now, timezone, 8), "daily_global_cap_reached");
  }
  if (
    candidate.risk_level === "sensitive" &&
    todayDeliveries.some((delivery) =>
      isSensitiveDelivery(delivery),
    )
  ) {
    return defer(nextLocalDayStart(now, timezone, 8), "daily_sensitive_cap_reached");
  }
  if (
    insightTypes.has(candidate.type) &&
    todayDeliveries.some((delivery) => isInsightDelivery(delivery))
  ) {
    return defer(nextLocalDayStart(now, timezone, 8), "daily_insight_cap_reached");
  }
  if (
    candidate.type === "weekly_review" &&
    deliveries.some(
      (delivery) =>
        deliveryType(delivery) === "weekly_review" &&
        isWithinDays(delivery.sent_at ?? delivery.created_at, now, 7),
    )
  ) {
    return defer(
      nextAllowedAfterMatchingDelivery(deliveries, "weekly_review", 7, now),
      "weekly_review_cap_reached",
    );
  }
  if (candidate.type === "reengagement") {
    const reengagementDeliveries = deliveries.filter(
      (delivery) => deliveryType(delivery) === "reengagement",
    );
    const recentReengagement = reengagementDeliveries.some((delivery) =>
      isWithinDays(delivery.sent_at ?? delivery.created_at, now, 7),
    );
    if (recentReengagement) {
      return defer(
        nextAllowedAfterMatchingDelivery(
          reengagementDeliveries,
          "reengagement",
          7,
          now,
        ),
        "reengagement_cap_reached",
      );
    }
    const unanswered = reengagementDeliveries.some(
      (delivery) =>
        ["sent", "delivered"].includes(delivery.status) &&
        isWithinDays(delivery.sent_at ?? delivery.created_at, now, 14),
    );
    if (unanswered) {
      return defer(
        nextAllowedAfterMatchingDelivery(
          reengagementDeliveries,
          "reengagement",
          14,
          now,
        ),
        "reengagement_unanswered_cooldown",
      );
    }
  }
  if (countSameSourceDeliveries(candidate, deliveries) >= 2) {
    return reject("same_source_delivery_cap_reached");
  }

  const delivery = input.checkChannelDelivery({
    intent: insightTypes.has(candidate.type) ? "insight" : "nudge",
    hasActionableValue: candidate.priority >= 60,
    isSensitive: candidate.risk_level === "sensitive",
    discreetCopyPrepared:
      candidate.risk_level !== "sensitive" ||
      input.sensitiveCopyPrepared === true,
    now,
  });

  if (!delivery.eligible) {
    return dashboardOnly(delivery.reason);
  }

  return {
    decision: "send",
    channel: input.channel,
    delivery_mode: delivery.mode,
    scheduled_for: now.toISOString(),
    reasons: [delivery.reason, "all_policy_gates_passed"],
    requires_disclosure: true,
  };
}

export function resolveNudgeTypeOptIn(input: {
  candidateType: NudgeType;
  preferences: UserPreferences | null;
  explicitPreferenceEnabled?: boolean | null;
}): boolean {
  const preferenceKey =
    input.candidateType === "overdue_payment"
      ? "payment_due"
      : input.candidateType;
  const canonicalOptIn =
    input.preferences?.nudge_opt_in?.[preferenceKey] === true;

  if (typeof input.explicitPreferenceEnabled === "boolean") {
    return canonicalOptIn && input.explicitPreferenceEnabled;
  }
  return canonicalOptIn;
}

export function isQuietHoursActive(
  now: Date,
  timezone: string,
  start: string,
  end: string,
): boolean {
  const minutes = localMinutes(now, timezone);
  const startMinutes = parseClock(start, 22 * 60);
  const endMinutes = parseClock(end, 8 * 60);
  if (startMinutes === endMinutes) return false;
  return startMinutes < endMinutes
    ? minutes >= startMinutes && minutes < endMinutes
    : minutes >= startMinutes || minutes < endMinutes;
}

function resolveQuietHours(preferences: UserPreferences): {
  start: string;
  end: string;
} {
  return {
    start: preferences.quiet_hours_start ?? "22:00",
    end: preferences.quiet_hours_end ?? "08:00",
  };
}

function countSameSourceDeliveries(
  candidate: NudgeCandidate,
  deliveries: NudgeDelivery[],
): number {
  return deliveries.filter((delivery) => {
    const metadata = asRecord(delivery.metadata);
    return (
      metadata.source_entity_type === candidate.source_entity_type &&
      metadata.source_entity_id === candidate.source_entity_id
    );
  }).length;
}

function isSensitiveDelivery(delivery: NudgeDelivery): boolean {
  return asRecord(delivery.metadata).risk_level === "sensitive";
}

function isInsightDelivery(delivery: NudgeDelivery): boolean {
  const type = deliveryType(delivery);
  return typeof type === "string" && insightTypes.has(type as NudgeType);
}

function deliveryType(delivery: NudgeDelivery): NudgeType | null {
  const type = asRecord(delivery.metadata).nudge_type;
  return typeof type === "string" ? (type as NudgeType) : null;
}

function nextAllowedAfterMatchingDelivery(
  deliveries: NudgeDelivery[],
  type: NudgeType,
  days: number,
  now: Date,
): string {
  const latest = deliveries
    .filter((delivery) => deliveryType(delivery) === type)
    .map((delivery) =>
      new Date(delivery.sent_at ?? delivery.created_at).getTime(),
    )
    .filter(Number.isFinite)
    .sort((left, right) => right - left)[0];
  return addDays(new Date(latest ?? now.getTime()), days).toISOString();
}

export function nextQuietHoursEnd(
  now: Date,
  timezone: string,
  end: string,
): string {
  const targetMinutes = parseClock(end, 8 * 60);
  const currentMinutes = localMinutes(now, timezone);
  const minutesToEnd =
    targetMinutes > currentMinutes
      ? targetMinutes - currentMinutes
      : 24 * 60 - currentMinutes + targetMinutes;
  return new Date(now.getTime() + minutesToEnd * 60_000).toISOString();
}

function nextLocalDayStart(now: Date, timezone: string, hour: number): string {
  const currentMinutes = localMinutes(now, timezone);
  const targetMinutes = hour * 60;
  const minutesUntil =
    targetMinutes > currentMinutes
      ? targetMinutes - currentMinutes
      : 24 * 60 - currentMinutes + targetMinutes;
  return new Date(now.getTime() + minutesUntil * 60_000).toISOString();
}

function localMinutes(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );
  return hour * 60 + minute;
}

function isSameLocalDay(value: string, now: Date, timezone: string): boolean {
  return localDateKey(new Date(value), timezone) === localDateKey(now, timezone);
}

function localDateKey(value: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function isWithinDays(value: string, now: Date, days: number): boolean {
  const time = new Date(value).getTime();
  return Number.isFinite(time) && now.getTime() - time < days * 86_400_000;
}

function parseClock(value: string, fallback: number): number {
  const match =
    /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value.trim());
  if (!match) return fallback;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return fallback;
  return hour * 60 + minute;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function reject(reason: string): NudgePolicyDecision {
  return {
    decision: "reject",
    channel: "dashboard",
    delivery_mode: "dashboard",
    scheduled_for: null,
    reasons: [reason],
    requires_disclosure: false,
  };
}

function defer(scheduledFor: string, reason: string): NudgePolicyDecision {
  return {
    decision: "defer",
    channel: "dashboard",
    delivery_mode: "dashboard",
    scheduled_for: scheduledFor,
    reasons: [reason],
    requires_disclosure: false,
  };
}

function dashboardOnly(reason: string): NudgePolicyDecision {
  return {
    decision: "dashboard_only",
    channel: "dashboard",
    delivery_mode: "dashboard",
    scheduled_for: null,
    reasons: [reason],
    requires_disclosure: false,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function positiveNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}
