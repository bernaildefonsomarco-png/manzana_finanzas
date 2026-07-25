import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EmailExtractionAgent,
  type EmailExtractionAgentResult,
  type EmailExtractionOutput,
} from "@/agents/email-extraction-agent";
import {
  GmailClientError,
  GmailEmailAdapter,
} from "@/adapters/email/gmail-client";
import { authenticateGmailSender } from "@/adapters/email/gmail-sender-auth";
import type { EmailAdapter, GmailMessage } from "@/adapters/email/contracts";
import { getGmailConfiguration, type GmailConfiguration } from "@/adapters/email/config";
import {
  getGmailHeader,
  extractMessageText,
  normalizeEmailAddress,
  parseGmailMovementWithTemplates,
  selectGmailTemplateForExtraction,
  type GmailExtractionTemplateSelection,
  type GmailParseOutcome,
  type GmailParserTemplate,
  type ParsedGmailMovement,
} from "@/adapters/email/gmail-parser";
import { decryptEmailToken } from "@/adapters/email/token-crypto";
import { evaluateCrossChannelDedup } from "@/core/dedup/cross-channel-preflight";
import {
  enrichEmailFinancialMovement,
  type EmailFinancialContext,
  type EmailFinancialEnrichment,
} from "@/core/email/email-financial-enricher";
import { getActiveAccounts } from "@/data/repositories/accounts.repository";
import { listDebts } from "@/data/repositories/debts.repository";
import {
  commitEmailMessageOutcome,
  getEmailConnectionById,
  getUserEmailSourceForSender,
  listEnabledEmailTemplatesForInstitution,
  readEmailAiExtractionConsent,
  updateEmailConnectionState,
  updateEmailSyncCheckpoint,
  type EmailConnection,
  type EmailParseTemplate,
} from "@/data/repositories/email.repository";
import { updateExternalEventStatus } from "@/data/repositories/events.repository";
import { listRecurringDashboard } from "@/data/repositories/recurring.repository";
import type { Database } from "@/data/supabase/types";
import type { MovementInput } from "@/shared/schemas/money";

type Client = SupabaseClient<Database>;

export type GmailIngestionResult = {
  discovered: number;
  trusted: number;
  gmailApiCalls: number;
  historyPageCalls: number;
  messageListPageCalls: number;
  metadataFetches: number;
  contentFetches: number;
  pendingCreated: number;
  deduplicated: number;
  parseFailed: number;
  templateParsed: number;
  fallbackParsed: number;
  shadowParsed: number;
  invalidTemplateConfigs: number;
  specializedSuggested: number;
  ambiguousSpecialized: number;
  agentExtracted: number;
  agentFallbacks: number;
  agentGroundingFailed: number;
  ignoredNonMovement: number;
  shadowAgentExtracted: number;
  shadowAgentFallbacks: number;
  shadowAgentGroundingFailed: number;
  shadowIgnoredNonMovement: number;
  senderAuthRejected: number;
  aiConsentSkipped: number;
  checkpoint: string;
};

type EmailExtractionPort = Pick<EmailExtractionAgent, "extract">;

export async function processGmailHistoryNotification(input: {
  client: Client;
  connectionId: string;
  externalEventId: string;
  traceId: string;
  adapter?: EmailAdapter;
  configuration?: GmailConfiguration;
  extractionAgent?: EmailExtractionPort;
}): Promise<GmailIngestionResult> {
  const configuration = input.configuration ?? getGmailConfiguration();
  const adapter = input.adapter ?? new GmailEmailAdapter(configuration);
  const connection = await getEmailConnectionById(
    input.client,
    input.connectionId,
  );
  if (
    !connection ||
    !connection.encrypted_refresh_token ||
    !connection.last_history_id ||
    connection.status === "disconnected"
  ) {
    throw new Error("Conexion Gmail no disponible para sincronizacion");
  }

  const refreshToken = decryptEmailToken(
    connection.encrypted_refresh_token,
    configuration.tokenEncryptionKey,
  );
  const result: GmailIngestionResult = {
    discovered: 0,
    trusted: 0,
    gmailApiCalls: 0,
    historyPageCalls: 0,
    messageListPageCalls: 0,
    metadataFetches: 0,
    contentFetches: 0,
    pendingCreated: 0,
    deduplicated: 0,
    parseFailed: 0,
    templateParsed: 0,
    fallbackParsed: 0,
    shadowParsed: 0,
    invalidTemplateConfigs: 0,
    specializedSuggested: 0,
    ambiguousSpecialized: 0,
    agentExtracted: 0,
    agentFallbacks: 0,
    agentGroundingFailed: 0,
    ignoredNonMovement: 0,
    shadowAgentExtracted: 0,
    shadowAgentFallbacks: 0,
    shadowAgentGroundingFailed: 0,
    shadowIgnoredNonMovement: 0,
    senderAuthRejected: 0,
    aiConsentSkipped: 0,
    checkpoint: connection.last_history_id,
  };
  const extractionAgent =
    input.extractionAgent ?? new EmailExtractionAgent();

  try {
    const accessToken = await adapter.refreshAccessToken(refreshToken);
    const messages: Array<{ id: string; threadId: string | null }> = [];
    const seen = new Set<string>();
    let pageToken: string | null = null;
    do {
      result.gmailApiCalls += 1;
      result.historyPageCalls += 1;
      const page = await adapter.listHistory({
        accessToken,
        startHistoryId: connection.last_history_id,
        pageToken,
      });
      result.checkpoint = page.historyId;
      pageToken = page.nextPageToken;
      for (const message of page.messageIds) {
        if (seen.has(message.id)) continue;
        seen.add(message.id);
        messages.push(message);
      }
    } while (pageToken);
    result.discovered = messages.length;

    await processMessageIds({
      client: input.client,
      connection,
      adapter,
      accessToken,
      messages,
      traceId: input.traceId,
      result,
      entrySurface: "gmail_history",
      extractionAgent,
    });

    await updateEmailSyncCheckpoint(input.client, {
      connectionId: connection.id,
      historyId: result.checkpoint,
      metadata: {
        last_sync_at: new Date().toISOString(),
        last_sync_discovered: result.discovered,
      },
    });
    await updateExternalEventStatus(input.client, {
      external_event_id: input.externalEventId,
      status: "processed",
      metadata: {
        gmail_result: result,
        content_persisted: false,
      },
    });
    return result;
  } catch (error) {
    if (
      error instanceof GmailClientError &&
      error.code === "GMAIL_HISTORY_EXPIRED"
    ) {
      await updateEmailConnectionState(input.client, {
        connectionId: connection.id,
        status: "watch_expired",
        watchStatus: "expired",
        metadata: { history_checkpoint_expired: true },
      });
    }
    await updateExternalEventStatus(input.client, {
      external_event_id: input.externalEventId,
      status: "failed",
      metadata: {
        gmail_result: result,
        gmail_error: safeErrorCode(error),
        gmail_status: safeErrorStatus(error),
        content_persisted: false,
      },
    });
    throw error;
  }
}

export async function processGmailBackfill(input: {
  client: Client;
  connectionId: string;
  traceId: string;
  newerThanDays?: number;
  maxMessages?: number;
  adapter?: EmailAdapter;
  configuration?: GmailConfiguration;
  extractionAgent?: EmailExtractionPort;
}): Promise<GmailIngestionResult & { truncated: boolean }> {
  const configuration = input.configuration ?? getGmailConfiguration();
  const adapter = input.adapter ?? new GmailEmailAdapter(configuration);
  const connection = await getEmailConnectionById(input.client, input.connectionId);
  if (
    !connection ||
    !connection.encrypted_refresh_token ||
    !connection.last_history_id ||
    connection.status === "disconnected"
  ) {
    throw new Error("Conexion Gmail no disponible para backfill");
  }
  const refreshToken = decryptEmailToken(
    connection.encrypted_refresh_token,
    configuration.tokenEncryptionKey,
  );
  const accessToken = await adapter.refreshAccessToken(refreshToken);
  const maxMessages = Math.min(Math.max(input.maxMessages ?? 500, 1), 500);
  const messages: Array<{ id: string; threadId: string | null }> = [];
  const seen = new Set<string>();
  let pageToken: string | null = null;
  let truncated = false;
  const result: GmailIngestionResult = {
    discovered: 0,
    trusted: 0,
    gmailApiCalls: 0,
    historyPageCalls: 0,
    messageListPageCalls: 0,
    metadataFetches: 0,
    contentFetches: 0,
    pendingCreated: 0,
    deduplicated: 0,
    parseFailed: 0,
    templateParsed: 0,
    fallbackParsed: 0,
    shadowParsed: 0,
    invalidTemplateConfigs: 0,
    specializedSuggested: 0,
    ambiguousSpecialized: 0,
    agentExtracted: 0,
    agentFallbacks: 0,
    agentGroundingFailed: 0,
    ignoredNonMovement: 0,
    shadowAgentExtracted: 0,
    shadowAgentFallbacks: 0,
    shadowAgentGroundingFailed: 0,
    shadowIgnoredNonMovement: 0,
    senderAuthRejected: 0,
    aiConsentSkipped: 0,
    checkpoint: connection.last_history_id,
  };
  const extractionAgent =
    input.extractionAgent ?? new EmailExtractionAgent();

  do {
    result.gmailApiCalls += 1;
    result.messageListPageCalls += 1;
    const page = await adapter.listRecentMessages({
      accessToken,
      newerThanDays: Math.min(Math.max(input.newerThanDays ?? 30, 1), 30),
      pageToken,
    });
    pageToken = page.nextPageToken;
    for (const message of page.messageIds) {
      if (seen.has(message.id)) continue;
      seen.add(message.id);
      messages.push(message);
      if (messages.length >= maxMessages) break;
    }
    if (messages.length >= maxMessages && pageToken) truncated = true;
  } while (pageToken && messages.length < maxMessages);

  result.discovered = messages.length;
  await processMessageIds({
    client: input.client,
    connection,
    adapter,
    accessToken,
    messages,
    traceId: input.traceId,
    result,
    entrySurface: "gmail_backfill_30d",
    extractionAgent,
  });
  await updateEmailConnectionState(input.client, {
    connectionId: connection.id,
    status: "watch_active",
    watchStatus: "active",
    metadata: {
      backfill_completed_at: new Date().toISOString(),
      backfill_days: Math.min(Math.max(input.newerThanDays ?? 30, 1), 30),
      backfill_discovered: result.discovered,
      backfill_truncated: truncated,
      backfill_gmail_result: result,
      delivery_channel: "dashboard_only",
    },
  });
  return { ...result, truncated };
}

async function processMessageIds(input: {
  client: Client;
  connection: EmailConnection;
  adapter: EmailAdapter;
  accessToken: string;
  messages: Array<{ id: string; threadId: string | null }>;
  traceId: string;
  result: GmailIngestionResult;
  entrySurface: "gmail_history" | "gmail_backfill_30d";
  extractionAgent: EmailExtractionPort;
}) {
  let financialContextPromise: Promise<EmailFinancialContext> | null = null;
  for (const item of input.messages) {
    let metadata: GmailMessage;
    try {
      input.result.gmailApiCalls += 1;
      input.result.metadataFetches += 1;
      metadata = await input.adapter.getMessageMetadata(
        input.accessToken,
        item.id,
      );
    } catch (error) {
      if (!isUnavailableGmailMessage(error)) throw error;
      input.result.parseFailed += 1;
      continue;
    }
    const sender = normalizeEmailAddress(getGmailHeader(metadata, "From"));
    if (!sender) continue;
    const emailSource = await getUserEmailSourceForSender(input.client, {
      userId: input.connection.user_id,
      connectionId: input.connection.id,
      sender,
    });
    if (
      !emailSource ||
      emailSource.status === "paused" ||
      emailSource.status === "disabled"
    ) {
      continue;
    }
    const institutionTemplates =
      await listEnabledEmailTemplatesForInstitution(
        input.client,
        emailSource.institution_key,
      );
    const sourceIsActive =
      emailSource.status === "active" &&
      emailSource.verification_status === "verified";
    const templates = sourceIsActive
      ? institutionTemplates.filter(
          (template) => template.sender === sender,
        )
      : institutionTemplates.map((template) => ({
          ...template,
          activationMode: "shadow" as const,
          verificationStatus: "draft" as const,
        }));
    if (templates.length === 0) continue;
    if (!readEmailAiExtractionConsent(input.connection).enabled) {
      input.result.aiConsentSkipped += 1;
      continue;
    }
    const senderAuthentication = authenticateGmailSender(metadata, sender);
    if (!senderAuthentication.authenticated) {
      input.result.senderAuthRejected += 1;
      input.result.parseFailed += 1;
      const representativeTemplate = templates[0] ?? null;
      await commitEmailMessageOutcome(input.client, {
        userId: input.connection.user_id,
        connectionId: input.connection.id,
        providerMessageId: metadata.id,
        providerThreadId: metadata.threadId,
        receivedAt: readReceivedAt(metadata),
        sender,
        subjectHash: null,
        contentHash: null,
        parsedStatus: "parse_failed",
        pending: null,
        metadata: {
          content_fetched: false,
          content_persisted: false,
          parser_match: false,
          template_id: representativeTemplate?.id ?? null,
          institution_key:
            representativeTemplate?.institutionKey ?? null,
          email_source_id: emailSource.id,
          email_source_status: emailSource.status,
          email_source_verification_status:
            emailSource.verification_status,
          parse_mode: "sender_auth_rejected",
          failure_code: "sender_authentication_failed",
          sender_authentication: "rejected",
          sender_auth_reason: senderAuthentication.reason,
          processing_latency_ms: processingLatencyMs(
            readReceivedAt(metadata),
          ),
          entry_surface: input.entrySurface,
        },
        traceId: input.traceId,
      });
      continue;
    }
    input.result.trusted += 1;

    let message: GmailMessage;
    try {
      input.result.gmailApiCalls += 1;
      input.result.contentFetches += 1;
      message = await input.adapter.getMessageContent(
        input.accessToken,
        item.id,
      );
    } catch (error) {
      if (!isUnavailableGmailMessage(error)) throw error;
      input.result.parseFailed += 1;
      continue;
    }
    const receivedAt = readReceivedAt(message);
    const activeTemplates = templates.filter(
      (template) => template.activationMode === "active",
    );
    const shadowTemplates = templates.filter(
      (template) => template.activationMode === "shadow",
    );
    const activeParserTemplates = activeTemplates.map((template) =>
      toParserTemplate(template, sender),
    );
    const shadowParserTemplates = shadowTemplates.map((template) =>
      toParserTemplate(template, sender),
    );
    const activeOutcome =
      activeTemplates.length > 0
        ? parseGmailMovementWithTemplates(
            message,
            activeParserTemplates,
          )
        : null;
    const shadowOutcome =
      shadowTemplates.length > 0
        ? parseGmailMovementWithTemplates(
            message,
            shadowParserTemplates,
          )
        : null;
    const invalidTemplateIds = [
      ...new Set([
        ...(activeOutcome?.invalidTemplateIds ?? []),
        ...(shadowOutcome?.invalidTemplateIds ?? []),
      ]),
    ];
    input.result.invalidTemplateConfigs += invalidTemplateIds.length;
    const shadowParsed =
      shadowOutcome?.status === "parsed" ? shadowOutcome.movement : null;
    if (shadowParsed) input.result.shadowParsed += 1;
    const extractionSelection = selectGmailTemplateForExtraction(
      message,
      activeParserTemplates,
    );
    const agentAttempt = extractionSelection
      ? await attemptAgentExtraction({
          agent: input.extractionAgent,
          message,
          receivedAt,
          sender,
          selection: extractionSelection,
          parserOutcome: activeOutcome,
          traceId: input.traceId,
        })
      : null;
    const shadowExtractionSelection = extractionSelection
      ? null
      : selectGmailTemplateForExtraction(
          message,
          shadowParserTemplates,
        );
    const shadowAgentAttempt = shadowExtractionSelection
      ? await attemptAgentExtraction({
          agent: input.extractionAgent,
          message,
          receivedAt,
          sender,
          selection: shadowExtractionSelection,
          parserOutcome: shadowOutcome,
          traceId: input.traceId,
        })
      : null;
    if (agentAttempt?.kind === "parsed" || agentAttempt?.kind === "ignored") {
      input.result.agentExtracted += 1;
    } else if (agentAttempt?.kind === "fallback") {
      input.result.agentFallbacks += 1;
      if (
        agentAttempt.result &&
        !agentAttempt.result.grounding.grounded
      ) {
        input.result.agentGroundingFailed += 1;
      }
    }
    if (
      shadowAgentAttempt?.kind === "parsed" ||
      shadowAgentAttempt?.kind === "ignored"
    ) {
      input.result.shadowAgentExtracted += 1;
      if (shadowAgentAttempt.kind === "ignored") {
        input.result.shadowIgnoredNonMovement += 1;
      }
    } else if (shadowAgentAttempt?.kind === "fallback") {
      input.result.shadowAgentFallbacks += 1;
      if (
        shadowAgentAttempt.result &&
        !shadowAgentAttempt.result.grounding.grounded
      ) {
        input.result.shadowAgentGroundingFailed += 1;
      }
    }

    if (agentAttempt?.kind === "ignored") {
      input.result.ignoredNonMovement += 1;
      await commitEmailMessageOutcome(input.client, {
        userId: input.connection.user_id,
        connectionId: input.connection.id,
        providerMessageId: message.id,
        providerThreadId: message.threadId,
        receivedAt,
        sender,
        subjectHash: readOutcomeSubjectHash(activeOutcome),
        contentHash: readOutcomeContentHash(activeOutcome),
        parsedStatus: "parsed",
        pending: null,
        metadata: {
          content_persisted: false,
          parser_match: true,
          template_id: extractionSelection?.template.id ?? null,
          template_version:
            extractionSelection?.template.templateVersion ?? null,
          institution_key:
            extractionSelection?.template.institutionKey ?? null,
          email_source_id: emailSource.id,
          email_source_status: emailSource.status,
          email_source_verification_status:
            emailSource.verification_status,
          parse_mode: "agent",
          subject_pattern_matched:
            extractionSelection?.matchedSubjectPattern !== null,
          agent_notice_kind: agentAttempt.result.output.notice_kind,
          agent_operation_status:
            agentAttempt.result.output.operation_status,
          agent_confidence: agentAttempt.result.output.confidence,
          agent_provider: agentAttempt.result.runtime.provider,
          agent_model: agentAttempt.result.runtime.model_name ?? null,
          agent_latency_ms: agentAttempt.result.runtime.latency_ms,
          extraction_grounded: true,
          sender_authentication: "authenticated",
          sender_auth_method: senderAuthentication.method,
          ignored_reason: "non_completed_financial_notice",
          invalid_template_ids: invalidTemplateIds,
          processing_latency_ms: processingLatencyMs(receivedAt),
          entry_surface: input.entrySurface,
        },
        traceId: input.traceId,
      });
      continue;
    }

    const parsed =
      agentAttempt?.kind === "parsed"
        ? agentAttempt.parsed
        : activeOutcome?.status === "parsed"
          ? activeOutcome.movement
          : null;

    if (!parsed) {
      const failedOutcome =
        activeOutcome?.status === "failed" ? activeOutcome : null;
      const representativeOutcome = failedOutcome ?? shadowOutcome;
      await commitEmailMessageOutcome(input.client, {
        userId: input.connection.user_id,
        connectionId: input.connection.id,
        providerMessageId: message.id,
        providerThreadId: message.threadId,
        receivedAt,
        sender,
        subjectHash:
          representativeOutcome?.status === "parsed"
            ? representativeOutcome.movement.subjectHash
            : representativeOutcome?.subjectHash ?? null,
        contentHash:
          representativeOutcome?.status === "parsed"
            ? representativeOutcome.movement.contentHash
            : representativeOutcome?.contentHash ?? null,
        parsedStatus: "parse_failed",
        pending: null,
        metadata: {
          content_persisted: false,
          parser_match: false,
          template_id:
            failedOutcome?.templateId ?? shadowParsed?.templateId ?? null,
          institution_key:
            failedOutcome?.institutionKey ??
            shadowParsed?.institutionKey ??
            null,
          email_source_id: emailSource.id,
          email_source_status: emailSource.status,
          email_source_verification_status:
            emailSource.verification_status,
          parse_mode: failedOutcome ? "parse_failed" : "shadow",
          failure_code:
            failedOutcome?.failureCode ??
            (shadowParsed ? "no_active_template" : "no_matching_template"),
          shadow_template_id: shadowParsed?.templateId ?? null,
          shadow_parse_mode: shadowParsed?.parseMode ?? null,
          shadow_agent_outcome: shadowAgentAttempt?.kind ?? null,
          shadow_agent_notice_kind:
            shadowAgentAttempt?.result?.output.notice_kind ?? null,
          shadow_agent_operation_status:
            shadowAgentAttempt?.result?.output.operation_status ?? null,
          shadow_agent_confidence:
            shadowAgentAttempt?.result?.output.confidence ?? null,
          shadow_agent_provider:
            shadowAgentAttempt?.result?.runtime.provider ?? null,
          shadow_agent_model:
            shadowAgentAttempt?.result?.runtime.model_name ?? null,
          shadow_agent_latency_ms:
            shadowAgentAttempt?.result?.runtime.latency_ms ?? null,
          shadow_extraction_grounded:
            shadowAgentAttempt?.result?.grounding.grounded ?? null,
          shadow_agent_evidence_repair_count:
            shadowAgentAttempt?.result?.repairs.evidence_fields.length ??
            null,
          shadow_agent_value_normalization_count:
            shadowAgentAttempt?.result?.repairs.normalized_value_fields
              .length ?? null,
          shadow_agent_fallback_reason:
            shadowAgentAttempt?.kind === "fallback"
              ? shadowAgentAttempt.reason
              : null,
          invalid_template_ids: invalidTemplateIds,
        agent_fallback_reason:
          agentAttempt?.kind === "fallback"
            ? agentAttempt.reason
            : null,
        agent_notice_kind:
          agentAttempt?.result?.output.notice_kind ?? null,
        agent_operation_status:
          agentAttempt?.result?.output.operation_status ?? null,
        agent_confidence:
          agentAttempt?.result?.output.confidence ?? null,
        extraction_grounded:
          agentAttempt?.result?.grounding.grounded ?? null,
          agent_evidence_repair_count:
            agentAttempt?.result?.repairs.evidence_fields.length ?? null,
          agent_value_normalization_count:
            agentAttempt?.result?.repairs.normalized_value_fields.length ??
            null,
          agent_provider:
            agentAttempt?.result?.runtime.provider ?? null,
          agent_model:
            agentAttempt?.result?.runtime.model_name ?? null,
          agent_latency_ms:
            agentAttempt?.result?.runtime.latency_ms ?? null,
          sender_authentication: "authenticated",
          sender_auth_method: senderAuthentication.method,
          processing_latency_ms: processingLatencyMs(receivedAt),
          entry_surface: input.entrySurface,
        },
        traceId: input.traceId,
      });
      input.result.parseFailed += 1;
      continue;
    }

    if (parsed.parseMode === "template") input.result.templateParsed += 1;
    else if (parsed.parseMode === "generic_fallback") {
      input.result.fallbackParsed += 1;
    }
    financialContextPromise ??= loadEmailFinancialContext(
      input.client,
      input.connection.user_id,
    );
    const enrichment = enrichEmailFinancialMovement(
      parsed,
      await financialContextPromise,
    );
    if (enrichment.requiresSpecializedEngine) {
      input.result.specializedSuggested += 1;
    }
    if (enrichment.suggestedAction === "review_specialized") {
      input.result.ambiguousSpecialized += 1;
    }
    const movementInput = toMovementInput(parsed, message.id, enrichment);
    const dedup = await evaluateCrossChannelDedup({
      client: input.client,
      userId: input.connection.user_id,
      traceId: input.traceId,
      referenceId: `gmail:${input.connection.id}:${message.id}`,
      movementInput,
      metadata: {
        entry_surface: input.entrySurface,
        email_connection_id: input.connection.id,
      },
    });
    const exactDuplicate = dedup.decision?.status === "exact_duplicate";
    const outcome = await commitEmailMessageOutcome(input.client, {
      userId: input.connection.user_id,
      connectionId: input.connection.id,
      providerMessageId: message.id,
      providerThreadId: message.threadId,
      receivedAt,
      sender: parsed.sender,
      subjectHash: parsed.subjectHash,
      contentHash: parsed.contentHash,
      parsedStatus: exactDuplicate ? "deduplicated" : "parsed",
      pending: exactDuplicate
        ? null
        : buildPendingPayload(
            parsed,
            movementInput,
            enrichment,
            dedup.decision?.status ?? null,
          ),
      metadata: {
        content_persisted: false,
        template_id: parsed.templateId,
        template_version: parsed.templateVersion,
        institution_key: parsed.institutionKey,
        email_source_id: emailSource.id,
        email_source_status: emailSource.status,
        email_source_verification_status:
          emailSource.verification_status,
        parse_mode: parsed.parseMode,
        subject_pattern_matched: parsed.matchedSubjectPattern !== null,
        suggested_action: enrichment.suggestedAction,
        suggested_movement_type: enrichment.suggestedMovementType,
        account_match_confidence: enrichment.account.confidence,
        ambiguity_reasons: enrichment.ambiguityReasons,
        shadow_template_id: shadowParsed?.templateId ?? null,
        shadow_parse_mode: shadowParsed?.parseMode ?? null,
        shadow_agent_outcome: shadowAgentAttempt?.kind ?? null,
        shadow_agent_notice_kind:
          shadowAgentAttempt?.result?.output.notice_kind ?? null,
        shadow_agent_operation_status:
          shadowAgentAttempt?.result?.output.operation_status ?? null,
        shadow_agent_confidence:
          shadowAgentAttempt?.result?.output.confidence ?? null,
        shadow_agent_provider:
          shadowAgentAttempt?.result?.runtime.provider ?? null,
        shadow_agent_model:
          shadowAgentAttempt?.result?.runtime.model_name ?? null,
        shadow_agent_latency_ms:
          shadowAgentAttempt?.result?.runtime.latency_ms ?? null,
        shadow_extraction_grounded:
          shadowAgentAttempt?.result?.grounding.grounded ?? null,
        shadow_agent_evidence_repair_count:
          shadowAgentAttempt?.result?.repairs.evidence_fields.length ??
          null,
        shadow_agent_value_normalization_count:
          shadowAgentAttempt?.result?.repairs.normalized_value_fields
            .length ?? null,
        shadow_agent_fallback_reason:
          shadowAgentAttempt?.kind === "fallback"
            ? shadowAgentAttempt.reason
            : null,
        invalid_template_ids: invalidTemplateIds,
        agent_provider:
          agentAttempt?.result?.runtime.provider ?? null,
        agent_model:
          agentAttempt?.result?.runtime.model_name ?? null,
        agent_confidence:
          agentAttempt?.result?.output.confidence ?? null,
        agent_notice_kind:
          agentAttempt?.result?.output.notice_kind ?? null,
        agent_operation_status:
          agentAttempt?.result?.output.operation_status ?? null,
        agent_latency_ms:
          agentAttempt?.result?.runtime.latency_ms ?? null,
        extraction_grounded:
          agentAttempt?.result?.grounding.grounded ?? null,
        agent_evidence_repair_count:
          agentAttempt?.result?.repairs.evidence_fields.length ?? null,
        agent_value_normalization_count:
          agentAttempt?.result?.repairs.normalized_value_fields.length ??
          null,
        agent_fallback_reason:
          agentAttempt?.kind === "fallback"
            ? agentAttempt.reason
            : null,
        sender_authentication: "authenticated",
        sender_auth_method: senderAuthentication.method,
        processing_latency_ms: processingLatencyMs(receivedAt),
        dedup_status: dedup.decision?.status ?? null,
        matched_reference_id: dedup.decision?.matched_reference_id ?? null,
        entry_surface: input.entrySurface,
      },
      traceId: input.traceId,
    });
    if (exactDuplicate || outcome.dedup_reason === "content_hash_24h") {
      input.result.deduplicated += 1;
    } else if (outcome.pending_item_id) input.result.pendingCreated += 1;
  }
}

type EmailAgentAttempt =
  | {
      kind: "parsed";
      parsed: ParsedGmailMovement;
      result: EmailExtractionAgentResult;
    }
  | {
      kind: "ignored";
      result: EmailExtractionAgentResult;
    }
  | {
      kind: "fallback";
      reason:
        | "runtime_failed"
        | "evidence_not_grounded"
        | "unknown_notice"
        | "required_fields_missing";
      result?: EmailExtractionAgentResult;
    };

async function attemptAgentExtraction(input: {
  agent: EmailExtractionPort;
  message: GmailMessage;
  receivedAt: string;
  sender: string;
  selection: GmailExtractionTemplateSelection;
  parserOutcome: GmailParseOutcome | null;
  traceId: string;
}): Promise<EmailAgentAttempt> {
  let result: EmailExtractionAgentResult;
  try {
    result = await input.agent.extract(
      {
        context_pack_type: "email_extraction_context",
        version: "v1",
        institution_key: input.selection.template.institutionKey,
        institution_aliases:
          input.selection.config.institution_aliases,
        verified_sender: input.sender,
        subject: getGmailHeader(input.message, "Subject") ?? "",
        body_text: extractMessageText(input.message),
        received_at: input.receivedAt,
        timezone: "America/Lima",
        template: {
          id: input.selection.template.id,
          version: input.selection.template.templateVersion,
          matched_subject_pattern:
            input.selection.matchedSubjectPattern,
        },
      },
      input.traceId,
    );
  } catch {
    return { kind: "fallback", reason: "runtime_failed" };
  }

  if (!result.grounding.grounded) {
    return {
      kind: "fallback",
      reason: "evidence_not_grounded",
      result,
    };
  }

  if (
    ["rejected", "pending", "informational"].includes(
      result.output.operation_status,
    ) ||
    ["rejected_attempt", "informational"].includes(
      result.output.notice_kind,
    )
  ) {
    return { kind: "ignored", result };
  }

  if (
    result.output.operation_status === "unknown" ||
    result.output.notice_kind === "unknown"
  ) {
    return { kind: "fallback", reason: "unknown_notice", result };
  }

  const parsed = toParsedGmailMovementFromAgent({
    output: result.output,
    sender: input.sender,
    subject: getGmailHeader(input.message, "Subject") ?? "",
    selection: input.selection,
    parserOutcome: input.parserOutcome,
  });
  return parsed
    ? { kind: "parsed", parsed, result }
    : {
        kind: "fallback",
        reason: "required_fields_missing",
        result,
      };
}

function toParsedGmailMovementFromAgent(input: {
  output: EmailExtractionOutput;
  sender: string;
  subject: string;
  selection: GmailExtractionTemplateSelection;
  parserOutcome: GmailParseOutcome | null;
}): ParsedGmailMovement | null {
  const { output } = input;
  const subjectHash = readOutcomeSubjectHash(input.parserOutcome);
  const contentHash = readOutcomeContentHash(input.parserOutcome);
  if (
    output.operation_status !== "completed" ||
    output.amount === null ||
    output.currency === null ||
    output.occurred_at === null ||
    output.direction === "unknown" ||
    !subjectHash ||
    !contentHash
  ) {
    return null;
  }
  const direction = output.direction === "in" ? "in" : "out";
  const operationHint = toOperationHint(output.notice_kind);
  return {
    movementType: direction === "out" ? "gasto" : "ingreso",
    direction,
    amount: output.amount,
    currency: output.currency,
    occurredAt: output.occurred_at,
    description:
      input.subject.trim().slice(0, 240) ||
      `Aviso ${input.selection.template.institutionKey}`,
    merchant: output.merchant,
    accountHint:
      output.account_hint ??
      (direction === "out"
        ? output.account_origin_hint
        : output.account_destination_hint),
    accountOriginHint: output.account_origin_hint,
    accountDestinationHint: output.account_destination_hint,
    operationIdentifier: output.operation_identifier,
    operationHint,
    institutionKey: input.selection.template.institutionKey,
    institutionAliases:
      input.selection.config.institution_aliases,
    sender: input.sender,
    subjectHash,
    contentHash,
    templateId: input.selection.template.id,
    templateVersion: input.selection.template.templateVersion,
    parseMode: "agent",
    matchedSubjectPattern:
      input.selection.matchedSubjectPattern,
    confidence: output.confidence,
  };
}

function toOperationHint(
  noticeKind: EmailExtractionOutput["notice_kind"],
): ParsedGmailMovement["operationHint"] {
  if (noticeKind === "transfer") return "transfer";
  if (noticeKind === "refund") return "refund";
  if (noticeKind === "debt_payment") return "debt_installment";
  if (noticeKind === "deposit") return "income";
  if (noticeKind === "purchase" || noticeKind === "cash_withdrawal") {
    return "purchase";
  }
  return "unknown";
}

function readOutcomeSubjectHash(
  outcome: GmailParseOutcome | null,
): string | null {
  if (!outcome) return null;
  return outcome.status === "parsed"
    ? outcome.movement.subjectHash
    : outcome.subjectHash;
}

function readOutcomeContentHash(
  outcome: GmailParseOutcome | null,
): string | null {
  if (!outcome) return null;
  return outcome.status === "parsed"
    ? outcome.movement.contentHash
    : outcome.contentHash;
}

function isUnavailableGmailMessage(error: unknown): boolean {
  return error instanceof GmailClientError && error.status === 404;
}

function toMovementInput(
  parsed: ParsedGmailMovement,
  messageId: string,
  enrichment: EmailFinancialEnrichment,
): MovementInput {
  const accountId = enrichment.account.accountId;
  return {
    type: enrichment.suggestedMovementType,
    amount: parsed.amount,
    currency: parsed.currency,
    occurred_at: parsed.occurredAt,
    description: parsed.description,
    merchant: parsed.merchant,
    category_id: null,
    subcategory_id: null,
    account_origin_id:
      enrichment.transferOriginAccountId ??
      (parsed.direction === "out" ? accountId : null),
    account_destination_id:
      enrichment.transferDestinationAccountId ??
      (parsed.direction === "in" ? accountId : null),
    box_origin_id: null,
    box_destination_id: null,
    related_person_id: null,
    debt_id: enrichment.debtId,
    recurring_rule_id: enrichment.recurringRuleId,
    recurring_occurrence_id: enrichment.recurringOccurrenceId,
    source: "email_confirmed",
    source_ref: `gmail:${messageId}`,
    confidence: parsed.confidence,
    requires_review: true,
    metadata: {
      template_id: parsed.templateId,
      template_version: parsed.templateVersion,
      institution_key: parsed.institutionKey,
      parse_mode: parsed.parseMode,
      account_hint: parsed.accountHint,
      account_origin_hint: parsed.accountOriginHint ?? null,
      account_destination_hint:
        parsed.accountDestinationHint ?? null,
      operation_identifier: parsed.operationIdentifier ?? null,
      suggested_action: enrichment.suggestedAction,
      account_match_confidence: enrichment.account.confidence,
      ambiguity_reasons: enrichment.ambiguityReasons,
      content_persisted: false,
    },
  };
}

function buildPendingPayload(
  parsed: ParsedGmailMovement,
  movementInput: MovementInput,
  enrichment: EmailFinancialEnrichment,
  dedupStatus: string | null,
) {
  return {
    proposed_action: buildProposedAction(
      parsed,
      movementInput,
      enrichment,
    ),
    normalized_summary: {
      title: parsed.description,
      subtitle: "Detectado por Gmail; confirma antes de registrar",
      amount: parsed.amount,
      currency: parsed.currency,
      occurred_at: parsed.occurredAt,
      account_hint: parsed.accountHint,
      institution_key: parsed.institutionKey,
      account_id: enrichment.account.accountId,
      suggested_action: enrichment.suggestedAction,
      ambiguity_reasons: enrichment.ambiguityReasons,
      category_id: null,
      confidence_label:
        parsed.parseMode === "agent"
          ? "alta - extracción IA validada"
          : parsed.parseMode === "template"
            ? "alta"
            : "baja - parser generico",
    },
    dedup_status: dedupStatus,
    risk_level: "low",
    metadata: {
      money_sign: parsed.direction === "in" ? "positive" : "negative",
      template_id: parsed.templateId,
      template_version: parsed.templateVersion,
      institution_key: parsed.institutionKey,
      parse_mode: parsed.parseMode,
      account_hint: parsed.accountHint,
      account_origin_hint: parsed.accountOriginHint ?? null,
      account_destination_hint:
        parsed.accountDestinationHint ?? null,
      operation_identifier: parsed.operationIdentifier ?? null,
      account_id: enrichment.account.accountId,
      suggested_action: enrichment.suggestedAction,
      suggested_movement_type: enrichment.suggestedMovementType,
      specialized_engine_required: enrichment.requiresSpecializedEngine,
      ambiguity_reasons: enrichment.ambiguityReasons,
      content_persisted: false,
    },
  };
}

function buildProposedAction(
  parsed: ParsedGmailMovement,
  movementInput: MovementInput,
  enrichment: EmailFinancialEnrichment,
): Record<string, unknown> {
  const common = {
    action: enrichment.suggestedAction,
    movement_type: enrichment.suggestedMovementType,
    movement_input: movementInput,
  };
  if (
    enrichment.suggestedAction === "record_debt_payment" &&
    enrichment.debtId
  ) {
    return {
      ...common,
      debt_id: enrichment.debtId,
      amount: parsed.amount,
      currency: parsed.currency,
      account_id: enrichment.account.accountId,
      paid_at: parsed.occurredAt,
    };
  }
  if (
    enrichment.suggestedAction === "record_recurring_payment" &&
    enrichment.recurringRuleId &&
    enrichment.recurringOccurrenceId
  ) {
    return {
      ...common,
      recurring_rule_id: enrichment.recurringRuleId,
      recurring_occurrence_id: enrichment.recurringOccurrenceId,
      amount: parsed.amount,
      currency: parsed.currency,
      account_id: enrichment.account.accountId,
      paid_at: parsed.occurredAt,
    };
  }
  if (enrichment.suggestedAction === "record_transfer") {
    return {
      ...common,
      account_origin_id: enrichment.transferOriginAccountId,
      account_destination_id: enrichment.transferDestinationAccountId,
      amount: parsed.amount,
      currency: parsed.currency,
      occurred_at: parsed.occurredAt,
    };
  }
  return common;
}

async function loadEmailFinancialContext(
  client: Client,
  userId: string,
): Promise<EmailFinancialContext> {
  const [accounts, debts, recurring] = await Promise.all([
    getActiveAccounts(client, userId),
    listDebts(client, userId),
    listRecurringDashboard(client, userId, ["active"]),
  ]);
  return {
    accounts,
    debts,
    recurringRules: recurring.rules,
  };
}

function toParserTemplate(
  template: EmailParseTemplate,
  sender: string = template.sender,
): GmailParserTemplate {
  return {
    id: template.id,
    institutionKey: template.institutionKey,
    templateVersion: template.templateVersion,
    sender,
    parserConfig: template.parserConfig,
  };
}

function processingLatencyMs(receivedAt: string): number {
  const receivedAtMs = new Date(receivedAt).getTime();
  return Number.isFinite(receivedAtMs)
    ? Math.max(0, Date.now() - receivedAtMs)
    : 0;
}

function readReceivedAt(message: GmailMessage): string {
  const milliseconds = Number(message.internalDate);
  if (Number.isFinite(milliseconds) && milliseconds > 0) {
    return new Date(milliseconds).toISOString();
  }
  const dateHeader = getGmailHeader(message, "Date");
  const parsed = dateHeader ? new Date(dateHeader) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function safeErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String(error.code).slice(0, 80);
  }
  return "gmail_ingestion_failed";
}

function safeErrorStatus(error: unknown): number | null {
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof error.status === "number" &&
    Number.isInteger(error.status)
  ) {
    return error.status;
  }
  return null;
}
