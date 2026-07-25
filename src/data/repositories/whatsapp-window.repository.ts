import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/data/supabase/types";
import {
  buildPhoneLookupCandidates,
  maskPhoneForLog,
} from "@/shared/phone";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;

export type WhatsAppWindowStatus = "open" | "closing_soon" | "closed";
export type WhatsAppWindowPromptMilestone =
  | "continuation_12h"
  | "final_20h";

export type WhatsAppWindowState = {
  id: string;
  user_id: string;
  phone: string;
  last_user_message_at: string | null;
  window_expires_at: string | null;
  status: WhatsAppWindowStatus;
  paid_templates_today: number;
  paid_templates_this_month: number;
  last_paid_template_at: string | null;
  last_window_continuation_prompt_at: string | null;
  last_window_final_prompt_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
};

export async function findUserIdByWhatsAppPhone(
  client: Client,
  phone: string
): Promise<string | null> {
  const candidates = buildPhoneLookupCandidates(phone);
  if (candidates.length === 0) return null;

  const { data, error } = await client
    .from("profiles")
    .select("id")
    .in("phone_e164", candidates)
    .limit(2);

  if (error) {
    logger.error("whatsapp.find_user_by_phone_failed", { error });
    throw error;
  }

  if ((data?.length ?? 0) > 1) {
    logger.error("whatsapp.find_user_by_phone_ambiguous", {
      phone: maskPhoneForLog(phone),
      matches: data?.length,
    });
    return null;
  }

  return data?.[0]?.id ?? null;
}

export async function touchWhatsAppWindowFromInbound(
  client: Client,
  input: {
    userId: string;
    phone: string;
    receivedAt: string;
    traceId: string;
    providerMessageId: string;
  }
): Promise<WhatsAppWindowState> {
  const receivedAt = new Date(input.receivedAt);
  const windowExpiresAt = new Date(
    receivedAt.getTime() + 24 * 60 * 60 * 1000
  ).toISOString();

  const existing = await getWhatsAppWindowByUserAndPhone(
    client,
    input.userId,
    input.phone
  );
  const metadata = {
    ...(existing?.metadata ?? {}),
    last_inbound_trace_id: input.traceId,
    last_provider_message_id: input.providerMessageId,
  };

  if (!existing) {
    const { data, error } = await client
      .from("whatsapp_window_states")
      .insert({
        user_id: input.userId,
        phone: input.phone,
        last_user_message_at: input.receivedAt,
        window_expires_at: windowExpiresAt,
        status: "open",
        metadata: metadata as Json,
      })
      .select("*")
      .single();

    if (error || !data) {
      logger.error("whatsapp.window_insert_failed", {
        error,
        user_id: input.userId,
      });
      throw error;
    }

    return data as WhatsAppWindowState;
  }

  const { data, error } = await client
    .from("whatsapp_window_states")
    .update({
      last_user_message_at: input.receivedAt,
      window_expires_at: windowExpiresAt,
      status: "open",
      metadata: metadata as Json,
    })
    .eq("id", existing.id)
    .select("*")
    .single();

  if (error || !data) {
    logger.error("whatsapp.window_update_failed", {
      error,
      user_id: input.userId,
    });
    throw error;
  }

  return data as WhatsAppWindowState;
}

export async function getWhatsAppWindowByUserAndPhone(
  client: Client,
  userId: string,
  phone: string
): Promise<WhatsAppWindowState | null> {
  const { data, error } = await client
    .from("whatsapp_window_states")
    .select("*")
    .eq("user_id", userId)
    .eq("phone", phone)
    .maybeSingle();

  if (error) {
    logger.error("whatsapp.window_get_failed", { error, user_id: userId });
    throw error;
  }

  return (data as WhatsAppWindowState | null) ?? null;
}

export async function updateWhatsAppWindowStatus(
  client: Client,
  input: {
    userId: string;
    phone: string;
    status: WhatsAppWindowStatus;
    windowExpiresAt?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<WhatsAppWindowState> {
  const existing = await getWhatsAppWindowByUserAndPhone(
    client,
    input.userId,
    input.phone
  );
  const metadata = {
    ...(existing?.metadata ?? {}),
    ...(input.metadata ?? {}),
  };

  const { data, error } = await client
    .from("whatsapp_window_states")
    .update({
      status: input.status,
      window_expires_at: input.windowExpiresAt ?? existing?.window_expires_at ?? null,
      metadata: metadata as Json,
    })
    .eq("user_id", input.userId)
    .eq("phone", input.phone)
    .select("*")
    .single();

  if (error || !data) {
    logger.error("whatsapp.window_status_update_failed", {
      error,
      user_id: input.userId,
    });
    throw error;
  }

  return data as WhatsAppWindowState;
}

export async function recordWhatsAppPaidTemplateSent(
  client: Client,
  input: {
    userId: string;
    phone: string;
    sentAt: string;
    traceId: string;
    providerMessageId?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<WhatsAppWindowState> {
  const existing = await getWhatsAppWindowByUserAndPhone(
    client,
    input.userId,
    input.phone
  );
  const counters = nextPaidTemplateCounters(existing, input.sentAt);
  const metadata = {
    ...(existing?.metadata ?? {}),
    ...(input.metadata ?? {}),
    last_template_trace_id: input.traceId,
    last_template_provider_message_id: input.providerMessageId ?? null,
  };

  if (!existing) {
    const { data, error } = await client
      .from("whatsapp_window_states")
      .insert({
        user_id: input.userId,
        phone: input.phone,
        status: "closed",
        paid_templates_today: counters.paidTemplatesToday,
        paid_templates_this_month: counters.paidTemplatesThisMonth,
        last_paid_template_at: input.sentAt,
        metadata: metadata as Json,
      })
      .select("*")
      .single();

    if (error || !data) {
      logger.error("whatsapp.window_template_insert_failed", {
        error,
        user_id: input.userId,
      });
      throw error;
    }

    return data as WhatsAppWindowState;
  }

  const { data, error } = await client
    .from("whatsapp_window_states")
    .update({
      paid_templates_today: counters.paidTemplatesToday,
      paid_templates_this_month: counters.paidTemplatesThisMonth,
      last_paid_template_at: input.sentAt,
      metadata: metadata as Json,
    })
    .eq("id", existing.id)
    .select("*")
    .single();

  if (error || !data) {
    logger.error("whatsapp.window_template_update_failed", {
      error,
      user_id: input.userId,
    });
    throw error;
  }

  return data as WhatsAppWindowState;
}

export async function markWhatsAppWindowPromptSent(
  client: Client,
  input: {
    userId: string;
    phone: string;
    milestone: WhatsAppWindowPromptMilestone;
    sentAt: string;
    traceId: string;
    metadata?: Record<string, unknown>;
  }
): Promise<WhatsAppWindowState> {
  const existing = await getWhatsAppWindowByUserAndPhone(
    client,
    input.userId,
    input.phone
  );

  if (!existing) {
    logger.error("whatsapp.window_prompt_missing_window", {
      user_id: input.userId,
      milestone: input.milestone,
    });
    throw new Error("No existe ventana WhatsApp para marcar prompt.");
  }

  const metadata = {
    ...existing.metadata,
    ...(input.metadata ?? {}),
    last_prompt_trace_id: input.traceId,
    last_prompt_milestone: input.milestone,
  };
  const patch: Database["public"]["Tables"]["whatsapp_window_states"]["Update"] =
    {
      metadata: metadata as Json,
    };

  if (input.milestone === "continuation_12h") {
    patch.last_window_continuation_prompt_at = input.sentAt;
  } else {
    patch.last_window_final_prompt_at = input.sentAt;
  }

  const { data, error } = await client
    .from("whatsapp_window_states")
    .update(patch)
    .eq("id", existing.id)
    .select("*")
    .single();

  if (error || !data) {
    logger.error("whatsapp.window_prompt_update_failed", {
      error,
      user_id: input.userId,
      milestone: input.milestone,
    });
    throw error;
  }

  return data as WhatsAppWindowState;
}

function nextPaidTemplateCounters(
  existing: WhatsAppWindowState | null,
  sentAt: string
): {
  paidTemplatesToday: number;
  paidTemplatesThisMonth: number;
} {
  const previous = existing?.last_paid_template_at;
  const sameDay = previous ? utcDateKey(previous) === utcDateKey(sentAt) : false;
  const sameMonth = previous
    ? utcMonthKey(previous) === utcMonthKey(sentAt)
    : false;

  return {
    paidTemplatesToday:
      sameDay && existing ? existing.paid_templates_today + 1 : 1,
    paidTemplatesThisMonth:
      sameMonth && existing ? existing.paid_templates_this_month + 1 : 1,
  };
}

function utcDateKey(date: string): string {
  return new Date(date).toISOString().slice(0, 10);
}

function utcMonthKey(date: string): string {
  return new Date(date).toISOString().slice(0, 7);
}
