import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import { HOME_BLOCK_KINDS, type HomeBlockKind } from "@/core/home/home-composer";

type Client = SupabaseClient<Database>;

const SOURCE_MODULE = "home";
const HIDDEN_BLOCKS_KEY = "home.bloques_ocultos";
const USAGE_PROFILE_KEY = "home.uso_detectado";

function parseHiddenBlocks(value: unknown): HomeBlockKind[] {
  if (!Array.isArray(value)) return [];
  const known = new Set<string>(HOME_BLOCK_KINDS);
  return value.filter((entry): entry is HomeBlockKind => typeof entry === "string" && known.has(entry));
}

/**
 * `39` §4.2: la única persistencia propia del Inicio. `learned_preferences`
 * (migración `061`) tiene RLS "no client write" — solo lectura para el
 * dueño, escritura únicamente con `service_role` (igual que
 * `insight_deliveries` en `recordDashboardInsightsDisplayed`). El `userId`
 * se toma siempre del cliente autenticado antes de escribir.
 */
export async function getHomeHiddenBlocks(client: Client, userId: string): Promise<HomeBlockKind[]> {
  const { data, error } = await client
    .from("learned_preferences")
    .select("value")
    .eq("user_id", userId)
    .eq("key", HIDDEN_BLOCKS_KEY)
    .eq("status", "activa")
    .maybeSingle();
  if (error) throw error;
  return parseHiddenBlocks(data?.value);
}

async function upsertPreference(
  serviceClient: Client,
  userId: string,
  key: string,
  value: unknown,
): Promise<void> {
  const { data: existing, error: readError } = await serviceClient
    .from("learned_preferences")
    .select("id, observation_count")
    .eq("user_id", userId)
    .eq("key", key)
    .eq("status", "activa")
    .maybeSingle();
  if (readError) throw readError;

  const now = new Date().toISOString();

  if (existing) {
    const { error } = await serviceClient
      .from("learned_preferences")
      .update({
        value: value as never,
        observation_count: existing.observation_count + 1,
        last_observed_at: now,
        updated_at: now,
      })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await serviceClient.from("learned_preferences").insert({
    user_id: userId,
    source_module: SOURCE_MODULE,
    key,
    value: value as never,
    status: "activa",
  });
  if (error) throw error;
}

/**
 * `RUL-HOME-06`/`RUL-MEM-01`: una preferencia declarada (ocultar un bloque a
 * mano) no se confirma, se aplica directo, y `WEB-D064` exige que ninguna
 * observación posterior la revierta — como el compositor lee este conjunto
 * como fuente de verdad y nunca lo recalcula solo, la garantía se cumple
 * porque nada más escribe esta clave.
 */
export async function setHomeBlockHidden(
  serviceClient: Client,
  userId: string,
  block: HomeBlockKind,
  hidden: boolean,
): Promise<HomeBlockKind[]> {
  const current = await getHomeHiddenBlocks(serviceClient, userId);
  const next = hidden
    ? current.includes(block)
      ? current
      : [...current, block]
    : current.filter((entry) => entry !== block);

  if (next.length === current.length && next.every((entry, index) => entry === current[index])) {
    return current;
  }

  await upsertPreference(serviceClient, userId, HIDDEN_BLOCKS_KEY, next);
  return next;
}

/**
 * Foto de observación del perfil de uso (`RUL-HOME-06`), solo para
 * auditoría en `/configuracion/memoria`: el compositor nunca la relee, la
 * detección es siempre en vivo por existencia de datos (`39` §6, literal).
 */
export async function recordHomeUsageProfile(
  serviceClient: Client,
  userId: string,
  profile: string[],
): Promise<void> {
  await upsertPreference(serviceClient, userId, USAGE_PROFILE_KEY, profile);
}
