import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/data/supabase/types";

type Client = SupabaseClient<Database>;

export type ExperiencePreferences = {
  discreet_mode_enabled: boolean;
  insights_whatsapp_opt_in: boolean;
  weekly_summary_enabled: boolean;
  weekly_summary_channel: "dashboard" | "whatsapp";
  theme_preference: "system" | "light" | "dark";
};

export async function getExperiencePreferences(
  client: Client,
  userId: string,
): Promise<ExperiencePreferences> {
  const { data, error } = await client
    .from("user_preferences")
    .select("discreet_mode_enabled,nudge_opt_in,metadata")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const nudges = asRecord(data?.nudge_opt_in);
  const metadata = asRecord(data?.metadata);
  return {
    discreet_mode_enabled: data?.discreet_mode_enabled === true,
    insights_whatsapp_opt_in:
      nudges.insight_prompt === true &&
      nudges.anomaly_alert === true &&
      nudges.progress_positive === true,
    weekly_summary_enabled: metadata.weekly_summary_enabled === true,
    weekly_summary_channel:
      metadata.weekly_summary_channel === "whatsapp"
        ? "whatsapp"
        : "dashboard",
    theme_preference: asThemePreference(metadata.theme_preference),
  };
}

export async function setExperiencePreferences(
  client: Client,
  input: {
    userId: string;
    preferences: ExperiencePreferences;
    idempotencyKey: string;
  },
): Promise<ExperiencePreferences> {
  const { data, error } = await client.rpc("set_experience_preferences", {
    p_user_id: input.userId,
    p_discreet_mode_enabled:
      input.preferences.discreet_mode_enabled,
    p_insights_whatsapp_opt_in:
      input.preferences.insights_whatsapp_opt_in,
    p_weekly_summary_enabled:
      input.preferences.weekly_summary_enabled,
    p_weekly_summary_channel:
      input.preferences.weekly_summary_channel,
    p_idempotency_key: input.idempotencyKey,
    p_theme_preference: input.preferences.theme_preference,
  });
  if (error) throw error;
  const value = asRecord(data);
  return {
    discreet_mode_enabled: value.discreet_mode_enabled === true,
    insights_whatsapp_opt_in:
      value.insights_whatsapp_opt_in === true,
    weekly_summary_enabled: value.weekly_summary_enabled === true,
    weekly_summary_channel:
      value.weekly_summary_channel === "whatsapp"
        ? "whatsapp"
        : "dashboard",
    theme_preference: asThemePreference(value.theme_preference),
  };
}

function asRecord(value: Json | undefined): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function asThemePreference(value: Json | undefined): "system" | "light" | "dark" {
  return value === "light" || value === "dark" ? value : "system";
}
