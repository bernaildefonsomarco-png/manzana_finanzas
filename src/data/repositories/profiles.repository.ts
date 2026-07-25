import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, OnboardingStatus } from "@/shared/types/domain";
import type { Database } from "@/data/supabase/types";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;

export async function getProfile(
  client: Client,
  userId: string
): Promise<Profile | null> {
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    logger.error("profiles.get_failed", { error, user_id: userId });
    throw error;
  }

  return data as Profile;
}

export async function upsertProfile(
  client: Client,
  userId: string,
  updates: Partial<Omit<Profile, "id" | "created_at" | "updated_at">>
): Promise<Profile> {
  const { data, error } = await client
    .from("profiles")
    .upsert({ id: userId, ...updates }, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    logger.error("profiles.upsert_failed", { error, user_id: userId });
    throw error;
  }

  return data as Profile;
}

export async function updateOnboardingStatus(
  client: Client,
  userId: string,
  status: OnboardingStatus
): Promise<void> {
  const { error } = await client
    .from("profiles")
    .update({ onboarding_status: status })
    .eq("id", userId);

  if (error) {
    logger.error("profiles.onboarding_status_update_failed", {
      error,
      user_id: userId,
      status,
    });
    throw error;
  }
}
