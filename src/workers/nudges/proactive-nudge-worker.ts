import type { SupabaseClient } from "@supabase/supabase-js";
import { DisclosureExperienceAgent } from "@/agents/disclosure-experience-agent";
import { NudgeExperienceAgent } from "@/agents/nudge-experience-agent";
import {
  getWhatsAppSendConfigFromEnv,
  isWhatsAppSendConfigReady,
} from "@/adapters/whatsapp/send-config";
import { sendTrackedWhatsAppMessage } from "@/adapters/whatsapp/outbound-service";
import {
  evaluateOutputGuard,
  type OutputGuardDecision,
} from "@/core/disclosure/output-guard";
import {
  evaluateWhatsAppNudgePolicy,
  resolveNudgeTypeOptIn,
  type NudgePolicyDecision,
} from "@/core/nudges/nudge-policy";
import {
  evaluateProactiveNudgeActivation,
  getProactiveNudgeActivationConfig,
} from "@/core/nudges/proactive-activation";
import {
  getWhatsAppWindowByUserAndPhone,
  recordWhatsAppPaidTemplateSent,
} from "@/data/repositories/whatsapp-window.repository";
import {
  buildCommitmentUtilityTemplateContract,
  renderCommitmentUtilityTemplatePreview,
} from "@/core/nudges/proactive-utility-template";
import type { Database, Json } from "@/data/supabase/types";
import type {
  NudgeCandidate,
  NudgeDelivery,
  NudgePreference,
  Profile,
  UserPreferences,
} from "@/shared/types/domain";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;

type ProactiveNudgeOutcome = {
  candidate_id: string;
  outcome:
    | "sent"
    | "planned"
    | "deferred"
    | "dashboard_only"
    | "rejected"
    | "failed";
  reasons: string[];
  delivery_mode: string;
};

export type ProactiveNudgeWorkerResult = {
  evaluated: number;
  sent: number;
  planned: number;
  deferred: number;
  dashboard_only: number;
  rejected: number;
  failed: number;
  outcomes: ProactiveNudgeOutcome[];
};

export async function deliverProactiveNudgesForUser(
  client: Client,
  userId: string,
  options: {
    now?: Date;
    traceId: string;
    env?: NodeJS.ProcessEnv;
    disclosureAgent?: DisclosureExperienceAgent;
    nudgeExperienceAgent?: NudgeExperienceAgent;
  },
): Promise<ProactiveNudgeWorkerResult> {
  const now = options.now ?? new Date();
  const env = options.env ?? process.env;
  const context = await loadProactiveContext(client, userId, now);
  const result = emptyResult();

  if (!context.profile?.phone_e164 || !context.preferences) {
    return result;
  }

  const sendConfig = getWhatsAppSendConfigFromEnv(env);
  const sendReady = isWhatsAppSendConfigReady(sendConfig);
  const activationConfig = getProactiveNudgeActivationConfig(env);
  const templateName = activationConfig.templateName;
  const templateLanguage = activationConfig.templateLanguage;
  const appUrl = resolveAppUrl(env);
  const windowState = await getWhatsAppWindowByUserAndPhone(
    client,
    userId,
    context.profile.phone_e164,
  );
  const disclosureAgent =
    options.disclosureAgent ?? new DisclosureExperienceAgent();
  const nudgeExperienceAgent =
    options.nudgeExperienceAgent ?? new NudgeExperienceAgent();

  for (const candidate of context.candidates) {
    result.evaluated += 1;
    if (!(await isSourceStillEligible(client, candidate, now))) {
      await persistCandidateDecision(client, candidate, {
        decision: "reject",
        channel: "dashboard",
        delivery_mode: "dashboard",
        scheduled_for: null,
        reasons: ["source_no_longer_eligible"],
        requires_disclosure: false,
      }, options.traceId, now);
      result.rejected += 1;
      result.outcomes.push(outcome(candidate, "rejected", ["source_no_longer_eligible"]));
      continue;
    }

    const utilityTemplate = buildCommitmentUtilityTemplateContract(candidate);

    const typePreference = context.typePreferences.find(
      (preference) =>
        preference.nudge_type ===
        (candidate.type === "overdue_payment" ? "payment_due" : candidate.type),
    );
    const explicitTypeOptIn = resolveNudgeTypeOptIn({
      candidateType: candidate.type,
      preferences: context.preferences,
      explicitPreferenceEnabled: typePreference?.enabled ?? null,
    });
    const outputGuard = evaluateOutputGuard({
      channel: "whatsapp",
      initiatedBySystem: true,
      authenticatedSession: false,
      verifiedRecipient: true,
      discreetMode: context.preferences.discreet_mode_enabled,
      riskLevel: candidate.risk_level,
      applicableOptIn:
        Boolean(context.preferences.whatsapp_opt_in) && explicitTypeOptIn,
      facts: disclosureFacts(candidate),
      sensitiveFactKeys:
        candidate.risk_level === "sensitive"
          ? ["title", "body", "evidence"]
          : [],
    });
    const disclosure = outputGuard.disclosure;
    const disclosureSafe = outputGuard.allowed;
    const policy = evaluateWhatsAppNudgePolicy({
      candidate,
      preferences: context.preferences,
      explicitTypeOptIn,
      pausedUntil: typePreference?.paused_until ?? null,
      windowState,
      recentDeliveries: context.recentDeliveries,
      templateAvailable: Boolean(
        templateName &&
        utilityTemplate &&
        templateName === utilityTemplate.name &&
        templateLanguage === utilityTemplate.language,
      ),
      sensitiveCopyPrepared: disclosureSafe,
      now,
      timezone: context.profile.timezone,
    });
    const risk = outputGuard.risk;

    if (risk.decision === "block") {
      const blocked = {
        ...policy,
        decision: "dashboard_only" as const,
        channel: "dashboard" as const,
        delivery_mode: "dashboard" as const,
        scheduled_for: null,
        reasons: [...policy.reasons, ...risk.reasons],
      };
      await persistCandidateDecision(client, candidate, blocked, options.traceId, now);
      result.dashboard_only += 1;
      result.outcomes.push(outcome(candidate, "dashboard_only", blocked.reasons));
      continue;
    }

    if (policy.decision !== "send") {
      await persistCandidateDecision(client, candidate, policy, options.traceId, now);
      const key = policy.decision === "defer" ? "deferred" : policy.decision === "reject" ? "rejected" : "dashboard_only";
      result[key] += 1;
      result.outcomes.push(outcome(candidate, key, policy.reasons));
      continue;
    }

    if (policy.delivery_mode === "template" && !utilityTemplate) {
      const reasons = [
        ...policy.reasons,
        "utility_template_contract_not_supported",
      ];
      await persistCandidateDecision(
        client,
        candidate,
        {
          ...policy,
          decision: "dashboard_only",
          channel: "dashboard",
          delivery_mode: "dashboard",
          scheduled_for: null,
          reasons,
        },
        options.traceId,
        now,
      );
      result.dashboard_only += 1;
      result.outcomes.push(outcome(candidate, "dashboard_only", reasons));
      continue;
    }

    let framedText: string;
    if (policy.delivery_mode === "template" && utilityTemplate) {
      framedText = renderCommitmentUtilityTemplatePreview(utilityTemplate);
    } else {
      const deepLink = buildDeepLink(appUrl, candidate);
      const baseText = buildSafeBaseText(
        candidate,
        disclosure.redaction_applied,
        deepLink,
      );
      const experiencedText = await frameNudgeSafeCopy({
        agent: nudgeExperienceAgent,
        candidate,
        disclosure,
        policy,
        preferences: context.preferences,
        baseText,
        traceId: options.traceId,
      });
      framedText = await frameSafeCopy({
        agent: disclosureAgent,
        candidate,
        disclosure,
        baseText: experiencedText,
        traceId: options.traceId,
      });
    }

    const activation = evaluateProactiveNudgeActivation({
      config: activationConfig,
      userId,
      providerReady: sendReady,
      phoneLinked: Boolean(context.profile.phone_e164),
      whatsappOptIn: Boolean(context.preferences.whatsapp_opt_in),
      explicitTypeOptIn,
      deliveryMode: policy.delivery_mode,
    });

    if (!activation.canSend) {
      const reasons = [
        ...policy.reasons,
        ...activation.reasons,
      ];
      await persistCandidateDecision(
        client,
        candidate,
        { ...policy, reasons },
        options.traceId,
        now,
        {
          planned_only: true,
          planned_copy_length: framedText.length,
          proactive_activation_mode: activation.mode,
          proactive_pilot_user: activation.pilotUser,
        },
      );
      result.planned += 1;
      result.outcomes.push(outcome(candidate, "planned", reasons, policy.delivery_mode));
      continue;
    }

    const attemptNumber =
      context.recentDeliveries.filter(
        (delivery) =>
          delivery.nudge_candidate_id === candidate.id &&
          delivery.channel === "whatsapp",
      ).length + 1;
    const delivery = await createNudgeDelivery(client, candidate, {
      traceId: options.traceId,
      attemptNumber,
      deliveryMode: policy.delivery_mode,
    });

    try {
      const sendResult = await sendTrackedWhatsAppMessage(
        client,
        {
          provider: sendConfig.provider,
          userId,
          toPhone: context.profile.phone_e164,
          messageKind: policy.delivery_mode === "template" ? "template" : "freeform",
          ...(policy.delivery_mode === "template"
            ? {
                templateName: utilityTemplate?.name,
                templateLanguage: utilityTemplate?.language,
                templateParams: utilityTemplate?.params,
              }
            : { text: framedText }),
          idempotencyKey: `nudge:${candidate.id}:whatsapp:v${attemptNumber}`,
          traceId: options.traceId,
          metadata: {
            delivery_domain: "nudge",
            nudge_candidate_id: candidate.id,
            nudge_delivery_id: delivery.id,
            insight_candidate_id:
              candidate.source_entity_type === "insight_candidate"
                ? candidate.source_entity_id
                : null,
            risk_level: candidate.risk_level,
          },
        },
        sendConfig,
      );
      const sentAt = now.toISOString();
      await markNudgeSent(client, candidate, delivery.id, {
        sentAt,
        traceId: options.traceId,
        providerMessageId: sendResult.attempt.provider_message_id,
        idempotent: sendResult.idempotent,
      });
      if (candidate.source_entity_type === "insight_candidate") {
        await recordInsightWhatsAppDelivery(client, candidate, {
          status: "sent",
          traceId: options.traceId,
          providerMessageId: sendResult.attempt.provider_message_id,
          deliveredAt: null,
        });
      }
      if (policy.delivery_mode === "template") {
        await recordWhatsAppPaidTemplateSent(client, {
          userId,
          phone: context.profile.phone_e164,
          sentAt,
          traceId: options.traceId,
          providerMessageId: sendResult.attempt.provider_message_id,
          metadata: { nudge_candidate_id: candidate.id },
        });
      }
      result.sent += 1;
      result.outcomes.push(outcome(candidate, "sent", policy.reasons, policy.delivery_mode));
      break;
    } catch (error) {
      await markNudgeFailed(client, candidate, delivery.id, {
        traceId: options.traceId,
        now,
        error,
      });
      if (candidate.source_entity_type === "insight_candidate") {
        await recordInsightWhatsAppDelivery(client, candidate, {
          status: "failed",
          traceId: options.traceId,
          providerMessageId: null,
          deliveredAt: null,
        });
      }
      logger.error("nudges.proactive_send_failed", {
        error,
        user_id: userId,
        nudge_candidate_id: candidate.id,
      });
      result.failed += 1;
      result.outcomes.push(outcome(candidate, "failed", ["provider_send_failed"], policy.delivery_mode));
    }
  }

  return result;
}

async function loadProactiveContext(client: Client, userId: string, now: Date) {
  const since = new Date(now.getTime() - 31 * 86_400_000).toISOString();
  const [profileResult, preferenceResult, candidateResult, deliveryResult, typePreferenceResult] =
    await Promise.all([
      client.from("profiles").select("*").eq("id", userId).maybeSingle(),
      client.from("user_preferences").select("*").eq("user_id", userId).maybeSingle(),
      client
        .from("nudge_candidates")
        .select("*")
        .eq("user_id", userId)
        .in("status", ["candidate", "approved", "deferred", "scheduled"])
        .order("priority", { ascending: false })
        .order("scheduled_for", { ascending: true, nullsFirst: true })
        .limit(50),
      client
        .from("nudge_deliveries")
        .select("*")
        .eq("user_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200),
      client
        .from("nudge_preferences")
        .select("*")
        .eq("user_id", userId)
        .eq("channel", "whatsapp"),
    ]);
  for (const result of [profileResult, preferenceResult, candidateResult, deliveryResult, typePreferenceResult]) {
    if (result.error) throw result.error;
  }
  return {
    profile: (profileResult.data as Profile | null) ?? null,
    preferences: (preferenceResult.data as UserPreferences | null) ?? null,
    candidates: ((candidateResult.data ?? []) as NudgeCandidate[]).filter(
      (candidate) =>
        !candidate.scheduled_for ||
        new Date(candidate.scheduled_for).getTime() <= now.getTime(),
    ),
    recentDeliveries: (deliveryResult.data ?? []) as NudgeDelivery[],
    typePreferences: (typePreferenceResult.data ?? []) as NudgePreference[],
  };
}

async function isSourceStillEligible(
  client: Client,
  candidate: NudgeCandidate,
  now: Date,
): Promise<boolean> {
  const metadata = asRecord(candidate.metadata);

  if (candidate.source_entity_type === "insight_candidate") {
    const { data, error } = await client
      .from("insight_candidates")
      .select("status")
      .eq("id", candidate.source_entity_id)
      .eq("user_id", candidate.user_id)
      .maybeSingle();
    if (error) throw error;
    if (!data || ["outdated", "expired", "dismissed", "acted"].includes(data.status)) {
      return false;
    }
    return data.status !== "displayed" || candidate.type === "anomaly_alert";
  }

  if (candidate.source_entity_type === "recurring_occurrence") {
    const { data, error } = await client
      .from("recurring_occurrences")
      .select("status")
      .eq("id", candidate.source_entity_id)
      .eq("user_id", candidate.user_id)
      .maybeSingle();
    if (error) throw error;
    return Boolean(
      data &&
        ["expected", "due_soon", "pending_confirmation", "overdue"].includes(
          data.status,
        ),
    );
  }

  if (candidate.source_entity_type === "debt_installment") {
    const { data, error } = await client
      .from("debt_installments")
      .select("status")
      .eq("id", candidate.source_entity_id)
      .eq("user_id", candidate.user_id)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data && ["pending", "due_soon", "overdue"].includes(data.status));
  }

  if (candidate.source_entity_type === "pending_batch") {
    const minimumCount = positiveInteger(metadata.minimum_pending_count, 2);
    const { data, error } = await client
      .from("pending_items")
      .select("id")
      .eq("user_id", candidate.user_id)
      .in("status", ["pending", "sent_for_confirmation", "user_edited"])
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw error;
    const pendingIds = (data ?? []).map((item) => item.id);
    return (
      pendingIds.length >= minimumCount &&
      pendingIds[0] === candidate.source_entity_id
    );
  }

  if (candidate.source_entity_type === "lifecycle_daily") {
    return dailyLifecycleSourceStillEligible(client, candidate, metadata, now);
  }

  if (candidate.source_entity_type === "lifecycle_weekly") {
    return weeklyLifecycleSourceStillEligible(client, candidate, metadata, now);
  }

  if (candidate.source_entity_type === "lifecycle_inactivity") {
    return inactivitySourceStillEligible(client, candidate, metadata, now);
  }

  return false;
}

async function dailyLifecycleSourceStillEligible(
  client: Client,
  candidate: NudgeCandidate,
  metadata: Record<string, unknown>,
  now: Date,
): Promise<boolean> {
  const timezone = cleanString(metadata.timezone) ?? "America/Lima";
  const localDate = cleanString(metadata.local_date);
  if (!localDate || localIsoDate(now, timezone) !== localDate) return false;

  const roughStart = new Date(`${localDate}T00:00:00.000Z`);
  roughStart.setUTCHours(roughStart.getUTCHours() - 14);
  const roughEnd = new Date(`${localDate}T23:59:59.999Z`);
  roughEnd.setUTCHours(roughEnd.getUTCHours() + 14);
  const [movementResult, pendingResult, windowResult] = await Promise.all([
    client
      .from("movements")
      .select("occurred_at")
      .eq("user_id", candidate.user_id)
      .in("status", ["confirmed", "corrected"])
      .is("deleted_at", null)
      .gte("occurred_at", roughStart.toISOString())
      .lte("occurred_at", roughEnd.toISOString())
      .limit(500),
    client
      .from("pending_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", candidate.user_id)
      .in("status", ["pending", "sent_for_confirmation", "user_edited"]),
    client
      .from("whatsapp_window_states")
      .select("last_user_message_at")
      .eq("user_id", candidate.user_id)
      .not("last_user_message_at", "is", null)
      .order("last_user_message_at", { ascending: false })
      .limit(1),
  ]);
  for (const result of [movementResult, pendingResult, windowResult]) {
    if (result.error) throw result.error;
  }
  const movementCount = (movementResult.data ?? []).filter(
    (movement) =>
      localIsoDate(new Date(movement.occurred_at), timezone) === localDate,
  ).length;
  const lastUserMessageAt = windowResult.data?.[0]?.last_user_message_at ?? null;
  const userMessagedToday = lastUserMessageAt
    ? localIsoDate(new Date(lastUserMessageAt), timezone) === localDate
    : false;
  return movementCount < 2 && (pendingResult.count ?? 0) === 0 && !userMessagedToday;
}

async function weeklyLifecycleSourceStillEligible(
  client: Client,
  candidate: NudgeCandidate,
  metadata: Record<string, unknown>,
  now: Date,
): Promise<boolean> {
  const timezone = cleanString(metadata.timezone) ?? "America/Lima";
  const periodKey = cleanString(metadata.period_key);
  if (!periodKey || periodKey !== isoWeekKey(now, timezone)) return false;
  const minimumCount = positiveInteger(metadata.minimum_movement_count, 5);
  const since = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const { count, error } = await client
    .from("movements")
    .select("id", { count: "exact", head: true })
    .eq("user_id", candidate.user_id)
    .in("status", ["confirmed", "corrected"])
    .is("deleted_at", null)
    .gte("occurred_at", since);
  if (error) throw error;
  return (count ?? 0) >= minimumCount;
}

async function inactivitySourceStillEligible(
  client: Client,
  candidate: NudgeCandidate,
  metadata: Record<string, unknown>,
  now: Date,
): Promise<boolean> {
  const expectedLastActivityAt = cleanString(metadata.last_activity_at);
  if (!expectedLastActivityAt) return false;
  const [movementResult, windowResult] = await Promise.all([
    client
      .from("movements")
      .select("created_at")
      .eq("user_id", candidate.user_id)
      .in("status", ["confirmed", "corrected"])
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("whatsapp_window_states")
      .select("last_user_message_at")
      .eq("user_id", candidate.user_id)
      .not("last_user_message_at", "is", null)
      .order("last_user_message_at", { ascending: false })
      .limit(1),
  ]);
  if (movementResult.error) throw movementResult.error;
  if (windowResult.error) throw windowResult.error;
  const currentLastActivityAt = latestIsoTimestamp(
    movementResult.data?.created_at ?? null,
    windowResult.data?.[0]?.last_user_message_at ?? null,
  );
  if (!currentLastActivityAt) return false;
  const expectedTime = new Date(expectedLastActivityAt).getTime();
  const currentTime = new Date(currentLastActivityAt).getTime();
  const inactivityDays = Math.floor((now.getTime() - currentTime) / 86_400_000);
  return (
    Number.isFinite(expectedTime) &&
    Number.isFinite(currentTime) &&
    currentTime <= expectedTime &&
    inactivityDays >= 2
  );
}

function disclosureFacts(candidate: NudgeCandidate): Record<string, unknown> {
  const metadata = asRecord(candidate.metadata);
  return {
    title: cleanString(metadata.title),
    body: cleanString(metadata.body),
    evidence: cleanString(metadata.evidence),
    target_view: cleanString(metadata.target_view),
    action_label: cleanString(metadata.action_label),
    amount: metadata.amount ?? null,
    debt_name: metadata.debt_name ?? null,
  };
}

function buildSafeBaseText(
  candidate: NudgeCandidate,
  redactionApplied: boolean,
  deepLink: string,
): string {
  if (redactionApplied || candidate.risk_level === "sensitive") {
    return `Hay algo importante para revisar en Manzana. Puedes verlo con privacidad desde la app:\n${deepLink}`;
  }
  const metadata = asRecord(candidate.metadata);
  const text = [
    cleanString(metadata.title),
    cleanString(metadata.body),
    cleanString(metadata.evidence),
  ].filter((value): value is string => Boolean(value));
  return `${text.join(" ")}\n${deepLink}`.trim().slice(0, 1_000);
}

async function frameSafeCopy(input: {
  agent: DisclosureExperienceAgent;
  candidate: NudgeCandidate;
  disclosure: OutputGuardDecision["disclosure"];
  baseText: string;
  traceId: string;
}): Promise<string> {
  try {
    const response = await input.agent.frame(
      {
        context_pack_type: "disclosure_experience_context",
        version: "v1",
        locale: "es-PE",
        channel: "whatsapp",
        disclosure_level: input.disclosure.level,
        redaction_applied: input.disclosure.redaction_applied,
        safe_facts: input.disclosure.safe_facts,
        base_text: input.baseText,
      },
      input.traceId,
    );
    return isFramingSafe(response.output, input.disclosure.safe_facts, input.baseText)
      ? response.output.response_text
      : input.baseText;
  } catch (error) {
    logger.warn("nudges.disclosure_agent_fallback", {
      error,
      nudge_candidate_id: input.candidate.id,
      trace_id: input.traceId,
    });
    return input.baseText;
  }
}

async function frameNudgeSafeCopy(input: {
  agent: NudgeExperienceAgent;
  candidate: NudgeCandidate;
  disclosure: OutputGuardDecision["disclosure"];
  policy: NudgePolicyDecision;
  preferences: UserPreferences;
  baseText: string;
  traceId: string;
}): Promise<string> {
  try {
    const response = await input.agent.frame(
      {
        context_pack_type: "nudge_experience_context",
        version: "v1",
        locale: "es-PE",
        candidate: {
          type: input.candidate.type,
          risk_level: input.candidate.risk_level,
          priority: input.candidate.priority,
        },
        approved_delivery: {
          channel: input.policy.channel,
          delivery_mode: input.policy.delivery_mode,
          disclosure_level: input.disclosure.level,
          redaction_applied: input.disclosure.redaction_applied,
        },
        user_context: {
          tone_style: input.preferences.tone_style,
          discreet_mode_enabled: input.preferences.discreet_mode_enabled,
        },
        safe_facts: input.disclosure.safe_facts,
        deterministic_base_text: input.baseText,
      },
      input.traceId,
    );
    return isFramingSafe(response.output, input.disclosure.safe_facts, input.baseText)
      ? response.output.response_text
      : input.baseText;
  } catch (error) {
    logger.warn("nudges.experience_agent_fallback", {
      error,
      nudge_candidate_id: input.candidate.id,
      trace_id: input.traceId,
    });
    return input.baseText;
  }
}

export function isFramingSafe(
  output: {
    response_text: string;
    preserved_fact_keys: string[];
  },
  safeFacts: Record<string, unknown>,
  baseText: string,
): boolean {
  const keys = new Set(Object.keys(safeFacts));
  if (output.preserved_fact_keys.some((key) => !keys.has(key))) return false;
  const allowedNumbers = new Set(extractNumbers(`${baseText} ${JSON.stringify(safeFacts)}`));
  return extractNumbers(output.response_text).every((value) => allowedNumbers.has(value));
}

async function createNudgeDelivery(
  client: Client,
  candidate: NudgeCandidate,
  input: { traceId: string; attemptNumber: number; deliveryMode: string },
): Promise<NudgeDelivery> {
  const { data, error } = await client
    .from("nudge_deliveries")
    .insert({
      user_id: candidate.user_id,
      nudge_candidate_id: candidate.id,
      channel: "whatsapp",
      status: "scheduled",
      metadata: toJson({
        trace_id: input.traceId,
        attempt_number: input.attemptNumber,
        delivery_mode: input.deliveryMode,
        nudge_type: candidate.type,
        source_entity_type: candidate.source_entity_type,
        source_entity_id: candidate.source_entity_id,
        risk_level: candidate.risk_level,
      }),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as NudgeDelivery;
}

async function markNudgeSent(
  client: Client,
  candidate: NudgeCandidate,
  deliveryId: string,
  input: {
    sentAt: string;
    traceId: string;
    providerMessageId: string | null;
    idempotent: boolean;
  },
) {
  const { error: deliveryError } = await client
    .from("nudge_deliveries")
    .update({
      status: "sent",
      sent_at: input.sentAt,
      metadata: toJson({
        trace_id: input.traceId,
        provider_message_id: input.providerMessageId,
        idempotent: input.idempotent,
        nudge_type: candidate.type,
        source_entity_type: candidate.source_entity_type,
        source_entity_id: candidate.source_entity_id,
        risk_level: candidate.risk_level,
      }),
    })
    .eq("id", deliveryId)
    .eq("user_id", candidate.user_id);
  if (deliveryError) throw deliveryError;

  const { error: candidateError } = await client
    .from("nudge_candidates")
    .update({
      status: "sent",
      metadata: toJson({
        ...asRecord(candidate.metadata),
        sent_at: input.sentAt,
        provider_message_id: input.providerMessageId,
        last_delivery_trace_id: input.traceId,
      }),
    })
    .eq("id", candidate.id)
    .eq("user_id", candidate.user_id);
  if (candidateError) throw candidateError;
}

async function markNudgeFailed(
  client: Client,
  candidate: NudgeCandidate,
  deliveryId: string,
  input: { traceId: string; now: Date; error: unknown },
) {
  const message = input.error instanceof Error ? input.error.message : "Error inesperado";
  const retryAt = new Date(input.now.getTime() + 60 * 60_000).toISOString();
  const { error: deliveryError } = await client
    .from("nudge_deliveries")
    .update({
      status: "failed",
      metadata: toJson({
        trace_id: input.traceId,
        error_message: message.slice(0, 300),
        retry_at: retryAt,
        nudge_type: candidate.type,
        source_entity_type: candidate.source_entity_type,
        source_entity_id: candidate.source_entity_id,
        risk_level: candidate.risk_level,
      }),
    })
    .eq("id", deliveryId)
    .eq("user_id", candidate.user_id);
  if (deliveryError) throw deliveryError;
  const { error: candidateError } = await client
    .from("nudge_candidates")
    .update({
      status: "deferred",
      scheduled_for: retryAt,
      metadata: toJson({
        ...asRecord(candidate.metadata),
        last_delivery_error: message.slice(0, 300),
        last_delivery_trace_id: input.traceId,
        retry_at: retryAt,
      }),
    })
    .eq("id", candidate.id)
    .eq("user_id", candidate.user_id);
  if (candidateError) throw candidateError;
}

async function persistCandidateDecision(
  client: Client,
  candidate: NudgeCandidate,
  decision: NudgePolicyDecision,
  traceId: string,
  now: Date,
  extraMetadata: Record<string, unknown> = {},
) {
  const status =
    decision.decision === "defer"
      ? "deferred"
      : decision.decision === "reject"
        ? "rejected"
        : candidate.status;
  const { error } = await client
    .from("nudge_candidates")
    .update({
      status,
      scheduled_for:
        decision.decision === "defer"
          ? decision.scheduled_for
          : candidate.scheduled_for,
      metadata: toJson({
        ...asRecord(candidate.metadata),
        last_policy_decision: decision.decision,
        last_policy_reasons: decision.reasons,
        last_policy_at: now.toISOString(),
        last_policy_trace_id: traceId,
        ...extraMetadata,
      }),
    })
    .eq("id", candidate.id)
    .eq("user_id", candidate.user_id);
  if (error) throw error;
}

async function recordInsightWhatsAppDelivery(
  client: Client,
  candidate: NudgeCandidate,
  input: {
    status: "sent" | "failed";
    traceId: string;
    providerMessageId: string | null;
    deliveredAt: string | null;
  },
) {
  const { error } = await client.from("insight_deliveries").insert({
    user_id: candidate.user_id,
    insight_candidate_id: candidate.source_entity_id,
    channel: "whatsapp",
    status: input.status,
    delivered_at: input.deliveredAt,
    metadata: toJson({
      trace_id: input.traceId,
      nudge_candidate_id: candidate.id,
      provider_message_id: input.providerMessageId,
    }),
  });
  if (error) throw error;
  if (input.status === "sent") {
    const { error: candidateError } = await client
      .from("insight_candidates")
      .update({ status: "sent" })
      .eq("id", candidate.source_entity_id)
      .eq("user_id", candidate.user_id)
      .in("status", ["narrated", "displayed"]);
    if (candidateError) throw candidateError;
  }
}

function outcome(
  candidate: NudgeCandidate,
  value: ProactiveNudgeOutcome["outcome"],
  reasons: string[],
  deliveryMode = "dashboard",
): ProactiveNudgeOutcome {
  return {
    candidate_id: candidate.id,
    outcome: value,
    reasons: [...new Set(reasons)],
    delivery_mode: deliveryMode,
  };
}

function emptyResult(): ProactiveNudgeWorkerResult {
  return {
    evaluated: 0,
    sent: 0,
    planned: 0,
    deferred: 0,
    dashboard_only: 0,
    rejected: 0,
    failed: 0,
    outcomes: [],
  };
}

function resolveAppUrl(env: NodeJS.ProcessEnv): string {
  return (
    cleanString(env.NEXT_PUBLIC_MANZANA_APP_URL) ??
    "https://manzana.website"
  ).replace(/\/$/, "");
}

function buildDeepLink(appUrl: string, candidate: NudgeCandidate): string {
  const view = cleanString(asRecord(candidate.metadata).target_view) ?? "home";
  return `${appUrl}/?view=${encodeURIComponent(view)}`;
}

function extractNumbers(value: string): string[] {
  return (value.match(/-?\d+(?:[.,]\d+)?/g) ?? []).map((number) =>
    number.replace(",", ".").replace(/\.0+$/, ""),
  );
}

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function localIsoDate(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function isoWeekKey(date: Date, timezone: string): string {
  const localDate = localIsoDate(date, timezone);
  const value = new Date(`${localDate}T00:00:00.000Z`);
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((value.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${value.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function latestIsoTimestamp(...values: Array<string | null>): string | null {
  return values
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value, time: new Date(value).getTime() }))
    .filter((entry) => Number.isFinite(entry.time))
    .sort((left, right) => right.time - left.time)[0]?.value ?? null;
}

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toJson(value: Record<string, unknown>): Json {
  return value as Json;
}
