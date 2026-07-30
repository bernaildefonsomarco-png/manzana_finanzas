import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/data/supabase/types";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;
export type EmailConnection = Database["public"]["Tables"]["email_connections"]["Row"];
type EmailTemplateRow = Database["public"]["Tables"]["email_parse_templates"]["Row"];
export type EmailInstitution =
  Database["public"]["Tables"]["email_institutions"]["Row"];
export type UserEmailSource =
  Database["public"]["Tables"]["user_email_sources"]["Row"];

export type EmailParseTemplate = {
  id: string;
  institutionKey: string;
  sender: string;
  templateVersion: string;
  priority: number;
  activationMode: "shadow" | "active";
  verificationStatus: "draft" | "verified" | "rejected";
  parserConfig: Record<string, unknown>;
};

export type EmailCaptureHealth = {
  window_days: number;
  denominator: "persisted_allowlisted_messages";
  allowed_messages_persisted: number;
  successful_active_parses: number;
  parse_failures: number;
  generic_fallbacks: number;
  failed_external_events: number;
  stuck_external_events: number;
  gmail_external_events: number;
  processed_external_events: number;
  gmail_api_calls: number;
  watch_connections_unhealthy: number;
  connections_missing_token: number;
  stale_active_templates: number;
  pending_items_created: number;
  pending_items_confirmed: number;
  pending_items_ignored: number;
  active_parse_rate: number | null;
  fallback_rate: number | null;
  external_event_processed_rate: number | null;
  pending_confirmation_rate: number | null;
  p95_processing_latency_ms: number | null;
  cost_instrumentation: Record<string, unknown>;
  targets: Record<string, boolean | null>;
  templates: Array<Record<string, unknown>>;
};

export type EmailExtractionAgentHealth = {
  window_days: number;
  agent_attempts: number;
  grounded_agent_extractions: number;
  agent_fallbacks: number;
  agent_grounding_failures: number;
  ignored_non_movement_notices: number;
  api_agent_extractions: number;
  agent_evidence_repaired_attempts: number;
  agent_value_normalized_attempts: number;
  p95_agent_latency_ms: number | null;
  agent_success_rate: number | null;
  agent_fallback_rate: number | null;
  agent_grounding_failure_rate: number | null;
  agent_evidence_repair_rate: number | null;
  agent_value_normalization_rate: number | null;
  targets: Record<string, boolean | null>;
};

export type EmailSenderAuthenticationHealth = {
  window_days: number;
  sender_authentication_rejections: number;
  content_fetch_violations: number;
  unknown_reason_count: number;
  reasons: Record<string, number>;
  targets: Record<string, boolean | null>;
};

export const EMAIL_AI_EXTRACTION_CONSENT_VERSION =
  "email_ai_extraction_v1";

export type EmailAiExtractionConsent = {
  enabled: boolean;
  version: string;
  updated_at: string | null;
};
export type EmailCaptureHistoryItem = {
  id: string;
  received_at: string;
  institution_key: string | null;
  parse_mode: string | null;
  parsed_status: string;
  pending_status: string | null;
};

export type GmailNotificationResult = {
  accepted: boolean;
  duplicate: boolean;
  connection_id?: string;
  external_event_id?: string;
  reason: string;
};

export class EmailRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailRepositoryError";
  }
}

export async function getEmailConnectionForUser(
  client: Client,
  userId: string,
): Promise<EmailConnection | null> {
  const { data, error } = await client
    .from("email_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "gmail")
    .neq("status", "disconnected")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw repositoryError("leer la conexion Gmail", error);
  return data ?? null;
}

export async function listEmailConnectionsForUser(
  client: Client,
  userId: string,
  options: { includeDisconnected?: boolean } = {},
): Promise<EmailConnection[]> {
  let query = client
    .from("email_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "gmail")
    .order("created_at", { ascending: true });
  if (!options.includeDisconnected) {
    query = query.neq("status", "disconnected").is("deleted_at", null);
  }
  const { data, error } = await query;
  if (error) throw repositoryError("leer las conexiones Gmail", error);
  return data ?? [];
}

export async function listEmailInstitutions(
  client: Client,
): Promise<EmailInstitution[]> {
  const { data, error } = await client
    .from("email_institutions")
    .select("*")
    .eq("enabled", true)
    .order("sort_order", { ascending: true })
    .order("display_name", { ascending: true });
  if (error) throw repositoryError("leer las instituciones de email", error);
  return data ?? [];
}

export async function listUserEmailSources(
  client: Client,
  userId: string,
): Promise<UserEmailSource[]> {
  const { data, error } = await client
    .from("user_email_sources")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .neq("status", "disabled")
    .order("created_at", { ascending: true });
  if (error) throw repositoryError("leer las fuentes bancarias", error);
  return data ?? [];
}

export async function getUserEmailSourceForSender(
  client: Client,
  input: {
    userId: string;
    connectionId: string;
    sender: string;
  },
): Promise<UserEmailSource | null> {
  const { data, error } = await client
    .from("user_email_sources")
    .select("*")
    .eq("user_id", input.userId)
    .eq("email_connection_id", input.connectionId)
    .eq("notification_sender", input.sender.trim().toLowerCase())
    .is("deleted_at", null)
    .neq("status", "disabled")
    .maybeSingle();
  if (error) throw repositoryError("resolver la fuente bancaria", error);
  return data ?? null;
}

export async function upsertUserEmailSource(
  client: Client,
  input: {
    userId: string;
    institutionKey: string;
    connectionId: string;
    notificationSender: string;
    traceId: string;
  },
): Promise<UserEmailSource> {
  const { data, error } = await client.rpc("upsert_user_email_source", {
    p_user_id: input.userId,
    p_institution_key: input.institutionKey,
    p_connection_id: input.connectionId,
    p_notification_sender: input.notificationSender,
    p_trace_id: input.traceId,
  });
  if (error || !data) {
    throw repositoryError("guardar la fuente bancaria", error);
  }
  return data;
}

export async function deleteUserEmailSource(
  client: Client,
  input: {
    userId: string;
    sourceId: string;
    traceId: string;
  },
): Promise<{
  changed: boolean;
  archived_pending_count: number;
  reason: string;
}> {
  const { data, error } = await client.rpc("delete_user_email_source", {
    p_user_id: input.userId,
    p_source_id: input.sourceId,
    p_trace_id: input.traceId,
  });
  if (error) throw repositoryError("eliminar la fuente bancaria", error);
  const value = asRecord(data);
  return {
    changed: value.changed === true,
    archived_pending_count:
      typeof value.archived_pending_count === "number"
        ? value.archived_pending_count
        : 0,
    reason: typeof value.reason === "string" ? value.reason : "unknown",
  };
}

export function readEmailAiExtractionConsent(
  connection: Pick<EmailConnection, "metadata"> | null,
): EmailAiExtractionConsent {
  const metadata = asRecord(connection?.metadata);
  const version =
    typeof metadata.ai_extraction_consent_version === "string"
      ? metadata.ai_extraction_consent_version
      : EMAIL_AI_EXTRACTION_CONSENT_VERSION;
  return {
    enabled:
      metadata.ai_extraction_consent_enabled === true &&
      version === EMAIL_AI_EXTRACTION_CONSENT_VERSION,
    version,
    updated_at:
      typeof metadata.ai_extraction_consent_updated_at === "string"
        ? metadata.ai_extraction_consent_updated_at
        : null,
  };
}

export async function updateEmailAiExtractionConsent(
  client: Client,
  input: {
    userId: string;
    connectionId?: string;
    enabled: boolean;
  },
): Promise<EmailAiExtractionConsent> {
  const connection = input.connectionId
    ? await getEmailConnectionById(client, input.connectionId)
    : await getEmailConnectionForUser(client, input.userId);
  if (connection?.user_id !== input.userId) {
    throw new EmailRepositoryError("Conexion Gmail no encontrada");
  }
  if (!connection) {
    throw new EmailRepositoryError("Conexion Gmail no encontrada");
  }
  const updatedAt = new Date().toISOString();
  const consent = {
    enabled: input.enabled,
    version: EMAIL_AI_EXTRACTION_CONSENT_VERSION,
    updated_at: updatedAt,
  };
  const { error } = await client
    .from("email_connections")
    .update({
      metadata: {
        ...asRecord(connection.metadata),
        ai_extraction_consent_enabled: input.enabled,
        ai_extraction_consent_version:
          EMAIL_AI_EXTRACTION_CONSENT_VERSION,
        ai_extraction_consent_updated_at: updatedAt,
      } as Json,
    })
    .eq("id", connection.id)
    .eq("user_id", input.userId);
  if (error) {
    throw repositoryError(
      "actualizar el consentimiento de extraccion IA",
      error,
    );
  }
  return consent;
}

export async function getEmailConnectionById(
  client: Client,
  connectionId: string,
): Promise<EmailConnection | null> {
  const { data, error } = await client
    .from("email_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("provider", "gmail")
    .maybeSingle();
  if (error) throw repositoryError("leer la conexion Gmail", error);
  return data ?? null;
}

export async function commitGmailConnection(
  client: Client,
  input: {
    userId: string;
    emailAddress: string;
    scopes: string[];
    encryptedRefreshToken: string;
    historyId: string;
    watchExpiration: string;
    traceId: string;
  },
): Promise<EmailConnection> {
  const { data, error } = await client.rpc("commit_gmail_connection", {
    p_user_id: input.userId,
    p_email_address: input.emailAddress,
    p_scopes: input.scopes,
    p_encrypted_refresh_token: input.encryptedRefreshToken,
    p_history_id: input.historyId,
    p_watch_expiration: input.watchExpiration,
    p_trace_id: input.traceId,
  });
  if (error || !data) throw repositoryError("guardar la conexion Gmail", error);
  return data;
}

export async function enqueueGmailHistoryNotification(
  client: Client,
  input: {
    emailAddress: string;
    pubsubMessageId: string;
    historyId: string;
    publishTime: string | null;
    subscription: string | null;
    payloadHash: string;
    traceId: string;
  },
): Promise<GmailNotificationResult> {
  const { data, error } = await client.rpc(
    "enqueue_gmail_history_notification",
    {
      p_email_address: input.emailAddress,
      p_pubsub_message_id: input.pubsubMessageId,
      p_history_id: input.historyId,
      p_publish_time: input.publishTime ?? "",
      p_subscription: input.subscription ?? "",
      p_payload_hash: input.payloadHash,
      p_trace_id: input.traceId,
    },
  );
  if (error) throw repositoryError("registrar la notificacion Gmail", error);
  return asNotificationResult(data);
}

export async function listEnabledEmailTemplatesForSender(
  client: Client,
  sender: string,
): Promise<EmailParseTemplate[]> {
  const { data, error } = await client
    .from("email_parse_templates")
    .select("*")
    .eq("provider", "gmail")
    .eq("enabled", true)
    .eq("sender_pattern", sender.trim().toLowerCase())
    .order("priority", { ascending: true });
  if (error) throw repositoryError("leer los parsers Gmail", error);
  return (data ?? []).map(toTemplate);
}

export async function listEnabledEmailTemplatesForInstitution(
  client: Client,
  institutionKey: string,
): Promise<EmailParseTemplate[]> {
  const { data, error } = await client
    .from("email_parse_templates")
    .select("*")
    .eq("provider", "gmail")
    .eq("enabled", true)
    .eq("institution_key", institutionKey)
    .order("priority", { ascending: true });
  if (error) {
    throw repositoryError("leer los parsers Gmail por institucion", error);
  }
  return (data ?? []).map(toTemplate);
}

export async function commitEmailMessageOutcome(
  client: Client,
  input: {
    userId: string;
    connectionId: string;
    providerMessageId: string;
    providerThreadId: string | null;
    receivedAt: string;
    sender: string | null;
    subjectHash: string | null;
    contentHash: string | null;
    parsedStatus: "parsed" | "pending_created" | "deduplicated" | "parse_failed";
    pending: Record<string, unknown> | null;
    metadata: Record<string, unknown>;
    traceId: string;
  },
): Promise<{
  idempotent: boolean;
  dedup_reason: "provider_message_id" | "content_hash_24h" | null;
  email_message_id: string;
  pending_item_id: string | null;
}> {
  const { data, error } = await client.rpc("commit_email_message_outcome", {
    p_user_id: input.userId,
    p_connection_id: input.connectionId,
    p_provider_message_id: input.providerMessageId,
    p_provider_thread_id: input.providerThreadId ?? "",
    p_received_at: input.receivedAt,
    p_sender: input.sender ?? "",
    p_subject_hash: input.subjectHash ?? "",
    p_content_hash: input.contentHash ?? "",
    p_parsed_status: input.parsedStatus,
    p_pending: input.pending as Json | null,
    p_metadata: input.metadata as Json,
    p_trace_id: input.traceId,
  });
  if (error) throw repositoryError("guardar el resultado Gmail", error);
  const value = asRecord(data);
  if (typeof value.email_message_id !== "string") {
    throw new EmailRepositoryError("Gmail devolvio un resultado invalido");
  }
  return {
    idempotent: value.idempotent === true,
    dedup_reason:
      value.dedup_reason === "provider_message_id" ||
      value.dedup_reason === "content_hash_24h"
        ? value.dedup_reason
        : null,
    email_message_id: value.email_message_id,
    pending_item_id:
      typeof value.pending_item_id === "string" ? value.pending_item_id : null,
  };
}

export async function getEmailCaptureHealth(
  client: Client,
  days = 7,
): Promise<EmailCaptureHealth> {
  const { data, error } = await client.rpc("get_email_capture_health", {
    p_days: Math.min(Math.max(Math.trunc(days), 1), 90),
  });
  if (error) throw repositoryError("leer la salud de captura por email", error);
  return asEmailCaptureHealth(data);
}

export async function getEmailExtractionAgentHealth(
  client: Client,
  days = 7,
): Promise<EmailExtractionAgentHealth> {
  const { data, error } = await client.rpc(
    "get_email_extraction_agent_health",
    {
      p_days: Math.min(Math.max(Math.trunc(days), 1), 90),
    },
  );
  if (error) {
    throw repositoryError(
      "leer la salud del agente extractor de email",
      error,
    );
  }
  return asEmailExtractionAgentHealth(data);
}

export async function getEmailSenderAuthenticationHealth(
  client: Client,
  days = 7,
): Promise<EmailSenderAuthenticationHealth> {
  const { data, error } = await client.rpc(
    "get_email_sender_authentication_health",
    {
      p_days: Math.min(Math.max(Math.trunc(days), 1), 90),
    },
  );
  if (error) {
    throw repositoryError(
      "leer la salud de autenticacion de remitentes email",
      error,
    );
  }
  return asEmailSenderAuthenticationHealth(data);
}

export async function listEmailCaptureHistoryForUser(
  client: Client,
  userId: string,
  limit = 20,
): Promise<EmailCaptureHistoryItem[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  const { data: messages, error } = await client
    .from("email_messages")
    .select(
      "id,email_connection_id,provider_message_id,received_at,parsed_status,metadata",
    )
    .eq("user_id", userId)
    .order("received_at", { ascending: false })
    .limit(safeLimit);
  if (error) throw repositoryError("leer el historial de captura por email", error);
  const sourceRefs = (messages ?? []).map(
    (message) => `gmail:${message.provider_message_id}`,
  );
  const scopedSourceRefs = (messages ?? []).map(
    (message) =>
      `gmail:${message.email_connection_id}:${message.provider_message_id}`,
  );
  const allSourceRefs = [
    ...sourceRefs,
    ...scopedSourceRefs,
  ];
  const pendingBySourceRef = new Map<string, string>();
  if (allSourceRefs.length > 0) {
    const { data: pending, error: pendingError } = await client
      .from("pending_items")
      .select("source_ref,status")
      .eq("user_id", userId)
      .in("source_ref", allSourceRefs);
    if (pendingError) {
      throw repositoryError(
        "leer el estado de Pendientes de email",
        pendingError,
      );
    }
    for (const item of pending ?? []) {
      if (item.source_ref) pendingBySourceRef.set(item.source_ref, item.status);
    }
  }
  return (messages ?? []).map((message) => {
    const metadata = asRecord(message.metadata);
    return {
      id: message.id,
      received_at: message.received_at,
      institution_key:
        typeof metadata.institution_key === "string"
          ? metadata.institution_key
          : null,
      parse_mode:
        typeof metadata.parse_mode === "string" ? metadata.parse_mode : null,
      parsed_status: message.parsed_status,
      pending_status:
        pendingBySourceRef.get(
          `gmail:${message.email_connection_id}:${message.provider_message_id}`,
        ) ??
        pendingBySourceRef.get(`gmail:${message.provider_message_id}`) ??
        null,
    };
  });
}

export async function updateEmailSyncCheckpoint(
  client: Client,
  input: {
    connectionId: string;
    historyId: string;
    status?: string;
    watchStatus?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const current = await getEmailConnectionById(client, input.connectionId);
  if (!current) throw new EmailRepositoryError("Conexion Gmail no encontrada");
  const { error } = await client
    .from("email_connections")
    .update({
      last_history_id: input.historyId,
      status: input.status ?? "watch_active",
      watch_status: input.watchStatus ?? "active",
      metadata: {
        ...asRecord(current.metadata),
        ...(input.metadata ?? {}),
      } as Json,
    })
    .eq("id", input.connectionId);
  if (error) throw repositoryError("actualizar el checkpoint Gmail", error);
}

export async function updateEmailConnectionState(
  client: Client,
  input: {
    connectionId: string;
    status: string;
    watchStatus: string;
    watchExpiration?: string | null;
    historyId?: string | null;
    renewedAt?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const current = await getEmailConnectionById(client, input.connectionId);
  if (!current) throw new EmailRepositoryError("Conexion Gmail no encontrada");
  const { error } = await client
    .from("email_connections")
    .update({
      status: input.status,
      watch_status: input.watchStatus,
      ...(input.watchExpiration !== undefined
        ? { watch_expiration: input.watchExpiration }
        : {}),
      ...(input.historyId !== undefined
        ? { last_history_id: input.historyId }
        : {}),
      ...(input.renewedAt !== undefined
        ? { last_watch_renewed_at: input.renewedAt }
        : {}),
      metadata: {
        ...asRecord(current.metadata),
        ...(input.metadata ?? {}),
      } as Json,
    })
    .eq("id", input.connectionId);
  if (error) throw repositoryError("actualizar la conexion Gmail", error);
}

export async function listEmailConnectionsDueForWatchRenewal(
  client: Client,
  before: string,
  limit = 50,
): Promise<EmailConnection[]> {
  const { data, error } = await client
    .from("email_connections")
    .select("*")
    .in("status", ["connected", "watch_active", "watch_expired"])
    .not("encrypted_refresh_token", "is", null)
    .lte("watch_expiration", before)
    .order("watch_expiration", { ascending: true })
    .limit(limit);
  if (error) throw repositoryError("leer watches Gmail", error);
  return data ?? [];
}

export async function disconnectGmailConnection(
  client: Client,
  userId: string,
  traceId: string,
  connectionId?: string | null,
): Promise<{
  changed: boolean;
  connection_ids: string[];
  archived_pending_count: number;
  reason: string;
}> {
  const { data, error } = await client.rpc("disconnect_gmail_connection", {
    p_user_id: userId,
    p_trace_id: traceId,
    p_connection_id: connectionId ?? undefined,
  });
  if (error) throw repositoryError("desconectar Gmail", error);
  const value = asRecord(data);
  return {
    changed: value.changed === true,
    connection_ids: Array.isArray(value.connection_ids)
      ? value.connection_ids.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    archived_pending_count:
      typeof value.archived_pending_count === "number"
        ? value.archived_pending_count
        : 0,
    reason: typeof value.reason === "string" ? value.reason : "unknown",
  };
}

function toTemplate(row: EmailTemplateRow): EmailParseTemplate {
  return {
    id: row.id,
    institutionKey: row.institution_key,
    sender: row.sender_pattern,
    templateVersion: row.template_version,
    priority: row.priority,
    activationMode: row.activation_mode === "active" ? "active" : "shadow",
    verificationStatus:
      row.verification_status === "verified" ||
      row.verification_status === "rejected"
        ? row.verification_status
        : "draft",
    parserConfig: asRecord(row.parser_config),
  };
}

function asEmailCaptureHealth(value: Json): EmailCaptureHealth {
  const record = asRecord(value);
  const targets = asRecord(record.targets);
  return {
    window_days: asFiniteNumber(record.window_days) ?? 7,
    denominator: "persisted_allowlisted_messages",
    allowed_messages_persisted:
      asFiniteNumber(record.allowed_messages_persisted) ?? 0,
    successful_active_parses:
      asFiniteNumber(record.successful_active_parses) ?? 0,
    parse_failures: asFiniteNumber(record.parse_failures) ?? 0,
    generic_fallbacks: asFiniteNumber(record.generic_fallbacks) ?? 0,
    failed_external_events:
      asFiniteNumber(record.failed_external_events) ?? 0,
    stuck_external_events:
      asFiniteNumber(record.stuck_external_events) ?? 0,
    gmail_external_events:
      asFiniteNumber(record.gmail_external_events) ?? 0,
    processed_external_events:
      asFiniteNumber(record.processed_external_events) ?? 0,
    gmail_api_calls: asFiniteNumber(record.gmail_api_calls) ?? 0,
    watch_connections_unhealthy:
      asFiniteNumber(record.watch_connections_unhealthy) ?? 0,
    connections_missing_token:
      asFiniteNumber(record.connections_missing_token) ?? 0,
    stale_active_templates:
      asFiniteNumber(record.stale_active_templates) ?? 0,
    pending_items_created:
      asFiniteNumber(record.pending_items_created) ?? 0,
    pending_items_confirmed:
      asFiniteNumber(record.pending_items_confirmed) ?? 0,
    pending_items_ignored:
      asFiniteNumber(record.pending_items_ignored) ?? 0,
    active_parse_rate: asFiniteNumber(record.active_parse_rate),
    fallback_rate: asFiniteNumber(record.fallback_rate),
    external_event_processed_rate: asFiniteNumber(
      record.external_event_processed_rate,
    ),
    pending_confirmation_rate: asFiniteNumber(
      record.pending_confirmation_rate,
    ),
    p95_processing_latency_ms: asFiniteNumber(
      record.p95_processing_latency_ms,
    ),
    cost_instrumentation: asRecord(record.cost_instrumentation),
    targets: Object.fromEntries(
      Object.entries(targets).map(([key, target]) => [
        key,
        typeof target === "boolean" ? target : null,
      ]),
    ),
    templates: Array.isArray(record.templates)
      ? record.templates.map(asRecord)
      : [],
  };
}

function asEmailExtractionAgentHealth(
  value: Json,
): EmailExtractionAgentHealth {
  const record = asRecord(value);
  const targets = asRecord(record.targets);
  return {
    window_days: asFiniteNumber(record.window_days) ?? 7,
    agent_attempts: asFiniteNumber(record.agent_attempts) ?? 0,
    grounded_agent_extractions:
      asFiniteNumber(record.grounded_agent_extractions) ?? 0,
    agent_fallbacks: asFiniteNumber(record.agent_fallbacks) ?? 0,
    agent_grounding_failures:
      asFiniteNumber(record.agent_grounding_failures) ?? 0,
    ignored_non_movement_notices:
      asFiniteNumber(record.ignored_non_movement_notices) ?? 0,
    api_agent_extractions:
      asFiniteNumber(record.api_agent_extractions) ?? 0,
    agent_evidence_repaired_attempts:
      asFiniteNumber(record.agent_evidence_repaired_attempts) ?? 0,
    agent_value_normalized_attempts:
      asFiniteNumber(record.agent_value_normalized_attempts) ?? 0,
    p95_agent_latency_ms: asFiniteNumber(record.p95_agent_latency_ms),
    agent_success_rate: asFiniteNumber(record.agent_success_rate),
    agent_fallback_rate: asFiniteNumber(record.agent_fallback_rate),
    agent_grounding_failure_rate: asFiniteNumber(
      record.agent_grounding_failure_rate,
    ),
    agent_evidence_repair_rate: asFiniteNumber(
      record.agent_evidence_repair_rate,
    ),
    agent_value_normalization_rate: asFiniteNumber(
      record.agent_value_normalization_rate,
    ),
    targets: Object.fromEntries(
      Object.entries(targets).map(([key, target]) => [
        key,
        typeof target === "boolean" ? target : null,
      ]),
    ),
  };
}

function asEmailSenderAuthenticationHealth(
  value: Json,
): EmailSenderAuthenticationHealth {
  const record = asRecord(value);
  const targets = asRecord(record.targets);
  const reasons = asRecord(record.reasons);
  return {
    window_days: asFiniteNumber(record.window_days) ?? 7,
    sender_authentication_rejections:
      asFiniteNumber(record.sender_authentication_rejections) ?? 0,
    content_fetch_violations:
      asFiniteNumber(record.content_fetch_violations) ?? 0,
    unknown_reason_count:
      asFiniteNumber(record.unknown_reason_count) ?? 0,
    reasons: Object.fromEntries(
      Object.entries(reasons).map(([reason, total]) => [
        reason,
        asFiniteNumber(total) ?? 0,
      ]),
    ),
    targets: Object.fromEntries(
      Object.entries(targets).map(([key, target]) => [
        key,
        typeof target === "boolean" ? target : null,
      ]),
    ),
  };
}

function asNotificationResult(value: Json): GmailNotificationResult {
  const record = asRecord(value);
  return {
    accepted: record.accepted === true,
    duplicate: record.duplicate === true,
    ...(typeof record.connection_id === "string"
      ? { connection_id: record.connection_id }
      : {}),
    ...(typeof record.external_event_id === "string"
      ? { external_event_id: record.external_event_id }
      : {}),
    reason: typeof record.reason === "string" ? record.reason : "unknown",
  };
}

export type SenderSuggestion =
  Database["public"]["Tables"]["sender_suggestions"]["Row"];

/** RUL-EMAIL-06: maximo una sugerencia por semana, por buzon. */
export async function countRecentSenderSuggestions(
  client: Client,
  input: { userId: string; connectionId: string; sinceDays: number },
): Promise<number> {
  const since = new Date(Date.now() - input.sinceDays * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await client
    .from("sender_suggestions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId)
    .eq("email_connection_id", input.connectionId)
    .gte("created_at", since);
  if (error) throw repositoryError("contar sugerencias recientes", error);
  return count ?? 0;
}

/** RUL-EMAIL-05: solo metadatos — nunca cuerpo ni asunto en claro. */
export async function getPendingSenderSuggestion(
  client: Client,
  input: { userId: string; connectionId: string; sender: string },
): Promise<SenderSuggestion | null> {
  const { data, error } = await client
    .from("sender_suggestions")
    .select("*")
    .eq("user_id", input.userId)
    .eq("email_connection_id", input.connectionId)
    .eq("sender", input.sender)
    .eq("status", "pending")
    .maybeSingle();
  if (error) throw repositoryError("leer la sugerencia de remitente", error);
  return data ?? null;
}

/** Un remitente "silenciado" (silenced) nunca se vuelve a sugerir (RUL-EMAIL-09). */
export async function isSenderSilenced(
  client: Client,
  input: { userId: string; connectionId: string; sender: string },
): Promise<boolean> {
  const { count, error } = await client
    .from("sender_suggestions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId)
    .eq("email_connection_id", input.connectionId)
    .eq("sender", input.sender)
    .eq("status", "silenced");
  if (error) throw repositoryError("comprobar si el remitente esta silenciado", error);
  return (count ?? 0) > 0;
}

export async function bumpOrCreateSenderSuggestion(
  client: Client,
  input: {
    userId: string;
    connectionId: string;
    sender: string;
    suggestedInstitution: string | null;
  },
): Promise<SenderSuggestion> {
  const existing = await getPendingSenderSuggestion(client, input);
  if (existing) {
    const signal = existing.signal as Record<string, unknown>;
    const seenCount = typeof signal.seen_count === "number" ? signal.seen_count : 1;
    const { data, error } = await client
      .from("sender_suggestions")
      .update({
        signal: { ...signal, seen_count: seenCount + 1, last_seen_at: new Date().toISOString() } as Json,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error || !data) throw repositoryError("actualizar la sugerencia de remitente", error);
    return data;
  }

  const { data, error } = await client
    .from("sender_suggestions")
    .insert({
      user_id: input.userId,
      email_connection_id: input.connectionId,
      sender: input.sender,
      suggested_institution: input.suggestedInstitution,
      signal: { seen_count: 1, first_seen_at: new Date().toISOString() } as Json,
    })
    .select("*")
    .single();
  if (error || !data) throw repositoryError("crear la sugerencia de remitente", error);
  return data;
}

/** RUL-EMAIL-05: solo se muestra al usuario tras al menos 2 correos. */
export const SENDER_SUGGESTION_MIN_OCCURRENCES = 2;

export async function getSenderSuggestionById(
  client: Client,
  userId: string,
  suggestionId: string,
): Promise<SenderSuggestion | null> {
  const { data, error } = await client
    .from("sender_suggestions")
    .select("*")
    .eq("user_id", userId)
    .eq("id", suggestionId)
    .eq("status", "pending")
    .maybeSingle();
  if (error) throw repositoryError("leer la sugerencia de remitente", error);
  return data ?? null;
}

export async function listSenderSuggestions(
  client: Client,
  userId: string,
): Promise<SenderSuggestion[]> {
  const { data, error } = await client
    .from("sender_suggestions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw repositoryError("leer las sugerencias de remitente", error);
  return (data ?? []).filter((row) => {
    const seenCount = (row.signal as Record<string, unknown>)?.seen_count;
    return typeof seenCount === "number" && seenCount >= SENDER_SUGGESTION_MIN_OCCURRENCES;
  });
}

export async function resolveSenderSuggestion(
  client: Client,
  input: { userId: string; suggestionId: string; status: "accepted" | "rejected" | "silenced" },
): Promise<SenderSuggestion | null> {
  const { data, error } = await client
    .from("sender_suggestions")
    .update({ status: input.status, resolved_at: new Date().toISOString() })
    .eq("user_id", input.userId)
    .eq("id", input.suggestionId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (error) throw repositoryError("resolver la sugerencia de remitente", error);
  return data ?? null;
}

export async function touchUserEmailSourceLastMatched(
  client: Client,
  sourceId: string,
): Promise<void> {
  const { error } = await client
    .from("user_email_sources")
    .update({ last_matched_at: new Date().toISOString() })
    .eq("id", sourceId);
  if (error) {
    logger.error("email.touch_last_matched_failed", { error, source_id: sourceId });
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function repositoryError(operation: string, error: unknown) {
  logger.error("email.repository_failed", { operation, error });
  return new EmailRepositoryError(`No se pudo ${operation}`);
}
