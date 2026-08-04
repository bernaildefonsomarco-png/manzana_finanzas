import type { ApiResponse } from "@/features/movements/movements-api";
import { ApiClientError } from "@/features/movements/movements-api";
import type { Profile } from "@/shared/types/domain";

export type ProfileResponse = {
  profile: Profile;
};

export type UpdateProfilePayload = {
  display_name?: string | null;
  phone_e164?: string | null;
};

export type DashboardNudgePreferenceType = "payment_due" | "debt_due";

export type DashboardNudgePreference = {
  nudge_type: DashboardNudgePreferenceType;
  enabled: boolean;
  configured: boolean;
  channel: "dashboard";
  paused_until: string | null;
};

type DashboardNudgePreferencesResponse = {
  preferences: DashboardNudgePreference[];
  refreshed?: boolean;
};

export type WhatsAppNudgeConsent = {
  whatsapp_opt_in: boolean;
  payment_due: boolean;
  debt_due: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  configured: boolean;
};

export type UpdateWhatsAppNudgeConsentPayload = Omit<
  WhatsAppNudgeConsent,
  "configured"
>;

type WhatsAppNudgeConsentResponse = {
  consent: WhatsAppNudgeConsent;
};

export type GmailStatus = {
  configured: boolean;
  missing: string[];
  connections: GmailConnectionStatus[];
  connection: GmailConnectionStatus | null;
  institutions: Array<{
    institution_key: string;
    display_name: string;
    aliases: string[];
    sort_order: number;
  }>;
  sources: GmailInstitutionSource[];
};

export type GmailConnectionStatus = {
  id: string;
    email_address: string;
    status: string;
    watch_status: string;
    watch_expiration: string | null;
    last_watch_renewed_at: string | null;
    connected: boolean;
    ai_extraction_consent: {
      enabled: boolean;
      version: string;
      updated_at: string | null;
    };
};

export type GmailInstitutionSource = {
  id: string;
  institution_key: string;
  email_connection_id: string;
  notification_sender: string;
  status: string;
  verification_status: string;
  verified_at: string | null;
};
export type GmailHistoryItem = {
  id: string;
  received_at: string;
  institution_key: string | null;
  parse_mode: string | null;
  parsed_status: string;
  pending_status: string | null;
};

export type LearningPreferences = {
  user_id: string;
  enabled: boolean;
  allow_narrative_memory: boolean;
  allow_sensitive_memory: boolean;
  consent_version: string;
  updated_by: "user" | "system" | "migration";
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
};

export type LearningMemoryItem = {
  id: string;
  kind:
    | "preference"
    | "alias"
    | "person_context"
    | "correction_pattern"
    | "narrative_fact";
  canonical_key: string;
  summary: string;
  evidence_source: string;
  confidence: number;
  lifecycle_status:
    | "confirmed"
    | "suspended"
    | "revoked"
    | "expired"
    | "superseded";
  sensitivity: "normal" | "sensitive";
  positive_evidence_count: number;
  negative_evidence_count: number;
  explanation: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
};

export type LearningCandidateItem = {
  id: string;
  kind: LearningMemoryItem["kind"];
  canonical_key: string;
  proposal_summary: string;
  basis: string;
  status:
    | "observed"
    | "pending_confirmation"
    | "accepted"
    | "rejected"
    | "superseded"
    | "suspended"
    | "expired";
  sensitivity: "normal" | "sensitive";
  requires_user_confirmation: boolean;
  positive_evidence_count: number;
  negative_evidence_count: number;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
};

export type LearningSnapshot = {
  memories: LearningMemoryItem[];
  candidates: LearningCandidateItem[];
  preferences: LearningPreferences;
};

export async function getProfileSettings(): Promise<Profile> {
  const response = await fetch("/api/v1/profile", {
    credentials: "same-origin",
  });

  const payload = (await response.json()) as ApiResponse<ProfileResponse>;

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null
    );
  }

  return payload.data.profile;
}

export async function updateProfileSettings(
  profile: UpdateProfilePayload
): Promise<Profile> {
  const response = await fetch("/api/v1/profile", {
    method: "PATCH",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(profile),
  });

  const payload = (await response.json()) as ApiResponse<ProfileResponse>;

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null
    );
  }

  return payload.data.profile;
}

export async function getDashboardNudgePreferences(): Promise<
  DashboardNudgePreference[]
> {
  const response = await fetch("/api/v1/preferences/nudges", {
    credentials: "same-origin",
  });
  const payload =
    (await response.json()) as ApiResponse<DashboardNudgePreferencesResponse>;

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null
    );
  }

  return payload.data.preferences;
}

export async function updateDashboardNudgePreference(
  nudgeType: DashboardNudgePreferenceType,
  enabled: boolean
): Promise<DashboardNudgePreference[]> {
  const response = await fetch("/api/v1/preferences/nudges", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      nudge_type: nudgeType,
      enabled,
    }),
  });
  const payload =
    (await response.json()) as ApiResponse<DashboardNudgePreferencesResponse>;

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null
    );
  }

  return payload.data.preferences;
}

export async function getWhatsAppNudgeConsent(): Promise<WhatsAppNudgeConsent> {
  const response = await fetch("/api/v1/preferences/nudges/whatsapp", {
    credentials: "same-origin",
  });
  const payload =
    (await response.json()) as ApiResponse<WhatsAppNudgeConsentResponse>;

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null,
    );
  }

  return payload.data.consent;
}

export async function updateWhatsAppNudgeConsent(
  consent: UpdateWhatsAppNudgeConsentPayload,
): Promise<WhatsAppNudgeConsent> {
  const response = await fetch("/api/v1/preferences/nudges/whatsapp", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(consent),
  });
  const payload =
    (await response.json()) as ApiResponse<WhatsAppNudgeConsentResponse>;

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null,
    );
  }

  return payload.data.consent;
}

export async function getGmailStatus(): Promise<GmailStatus> {
  return requestSettings<GmailStatus>("/api/v1/email/status");
}

export async function getGmailHistory(): Promise<GmailHistoryItem[]> {
  const result = await requestSettings<{
    items: GmailHistoryItem[];
    content_persisted: false;
    sender_exposed: false;
  }>("/api/v1/email/history?limit=10");
  return result.items;
}

export async function startGmailOAuth(): Promise<string> {
  const result = await requestSettings<{ authorization_url: string }>(
    "/api/v1/email/oauth/start",
    { method: "POST" },
  );
  return result.authorization_url;
}

export async function disconnectGmail(connectionId: string): Promise<void> {
  await requestSettings<Record<string, unknown>>(
    "/api/v1/email/disconnect",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connection_id: connectionId }),
    },
  );
}

export async function updateGmailAiExtractionConsent(
  connectionId: string,
  enabled: boolean,
): Promise<GmailConnectionStatus["ai_extraction_consent"]> {
  const result = await requestSettings<{
    consent: GmailConnectionStatus["ai_extraction_consent"];
  }>("/api/v1/email/ai-consent", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ connection_id: connectionId, enabled }),
  });
  return result.consent;
}

export async function upsertGmailInstitutionSource(input: {
  institution_key: string;
  email_connection_id: string;
  notification_sender: string;
}): Promise<GmailInstitutionSource> {
  const result = await requestSettings<{ source: GmailInstitutionSource }>(
    "/api/v1/email/sources",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return result.source;
}

export async function deleteGmailInstitutionSource(
  sourceId: string,
): Promise<void> {
  await requestSettings<Record<string, unknown>>("/api/v1/email/sources", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source_id: sourceId }),
  });
}

export async function downloadUserDataExport(): Promise<void> {
  const response = await fetch("/api/v1/privacy/export", {
    credentials: "same-origin",
  });
  if (!response.ok) {
    const payload = (await response.json()) as ApiResponse<never>;
    if (!payload.ok) {
      throw new ApiClientError(
        payload.error.code,
        payload.error.message,
        response.status,
        payload.meta?.trace_id ?? null,
      );
    }
    throw new ApiClientError(
      "INTERNAL_ERROR",
      "No se pudo descargar la exportacion.",
      response.status,
      response.headers.get("x-trace-id"),
    );
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const filename =
    disposition.match(/filename="([^"]+)"/)?.[1] ?? "manzana-datos.json";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function deleteUserAccount(
  confirmation: string,
): Promise<void> {
  await requestSettings<Record<string, unknown>>("/api/v1/privacy/account", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmation }),
  });
}

export type AccountDeletionImpact = {
  movements: number;
  debts: number;
  email_connections: number;
  learned_things: number;
  conversations: number;
};

// `43` `SCR-AUTH-08` — cifras reales antes de confirmar el borrado.
export async function getAccountDeletionImpact(): Promise<AccountDeletionImpact> {
  const result = await requestSettings<{ impact: AccountDeletionImpact }>(
    "/api/v1/privacy/account",
  );
  return result.impact;
}

export async function getLearningSnapshot(): Promise<LearningSnapshot> {
  return requestSettings<LearningSnapshot>("/api/v1/memory");
}

export async function updateLearningPreferences(
  preferences: Pick<
    LearningPreferences,
    "enabled" | "allow_narrative_memory" | "allow_sensitive_memory"
  >,
): Promise<LearningPreferences> {
  const result = await requestSettings<{ preferences: LearningPreferences }>(
    "/api/v1/memory",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preferences),
    },
  );
  return result.preferences;
}

export async function manageLearningMemory(input: {
  target: "memory";
  target_id: string;
  action: "forget" | "correct" | "suspend" | "confirm";
  summary?: string;
  reason?: string;
}): Promise<void> {
  await requestSettings<Record<string, unknown>>("/api/v1/memory", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function manageLearningCandidate(input: {
  target: "candidate";
  target_id: string;
  action: "confirm" | "reject";
  reason?: string;
}): Promise<void> {
  await requestSettings<Record<string, unknown>>("/api/v1/memory", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

async function requestSettings<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...init,
  });
  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null,
    );
  }
  return payload.data;
}
