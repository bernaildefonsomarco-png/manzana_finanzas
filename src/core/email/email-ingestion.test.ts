import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailAdapter, GmailMessage } from "@/adapters/email/contracts";
import { GmailClientError } from "@/adapters/email/gmail-client";
import { encryptEmailToken } from "@/adapters/email/token-crypto";
import type { Account } from "@/shared/types/domain";

const mocks = vi.hoisted(() => ({
  commitEmailMessageOutcome: vi.fn(),
  getEmailConnectionById: vi.fn(),
  getUserEmailSourceForSender: vi.fn(),
  listEnabledEmailTemplatesForInstitution: vi.fn(),
  updateEmailConnectionState: vi.fn(),
  updateEmailSyncCheckpoint: vi.fn(),
  updateExternalEventStatus: vi.fn(),
  evaluateCrossChannelDedup: vi.fn(),
  getActiveAccounts: vi.fn(),
  listDebts: vi.fn(),
  listRecurringDashboard: vi.fn(),
  touchUserEmailSourceLastMatched: vi.fn(),
  isSenderSilenced: vi.fn(),
  bumpOrCreateSenderSuggestion: vi.fn(),
  countRecentSenderSuggestions: vi.fn(),
  getPendingSenderSuggestion: vi.fn(),
  computeConfirmability: vi.fn(),
}));

vi.mock("@/data/repositories/email.repository", async (original) => ({
  ...(await original()),
  commitEmailMessageOutcome: mocks.commitEmailMessageOutcome,
  getEmailConnectionById: mocks.getEmailConnectionById,
  getUserEmailSourceForSender: mocks.getUserEmailSourceForSender,
  listEnabledEmailTemplatesForInstitution:
    mocks.listEnabledEmailTemplatesForInstitution,
  updateEmailConnectionState: mocks.updateEmailConnectionState,
  updateEmailSyncCheckpoint: mocks.updateEmailSyncCheckpoint,
  touchUserEmailSourceLastMatched: mocks.touchUserEmailSourceLastMatched,
  isSenderSilenced: mocks.isSenderSilenced,
  bumpOrCreateSenderSuggestion: mocks.bumpOrCreateSenderSuggestion,
  countRecentSenderSuggestions: mocks.countRecentSenderSuggestions,
  getPendingSenderSuggestion: mocks.getPendingSenderSuggestion,
}));
// La confirmabilidad tiene su propia suite (compute-confirmability.test.ts);
// aqui solo importa que email-ingestion.ts la llame y use el resultado.
vi.mock("@/core/pending/compute-confirmability", () => ({
  computeConfirmability: mocks.computeConfirmability,
}));
vi.mock("@/data/repositories/events.repository", async (original) => ({
  ...(await original()),
  updateExternalEventStatus: mocks.updateExternalEventStatus,
}));
vi.mock("@/core/dedup/cross-channel-preflight", () => ({
  evaluateCrossChannelDedup: mocks.evaluateCrossChannelDedup,
}));
vi.mock("@/data/repositories/accounts.repository", async (original) => ({
  ...(await original()),
  getActiveAccounts: mocks.getActiveAccounts,
}));
vi.mock("@/data/repositories/debts.repository", async (original) => ({
  ...(await original()),
  listDebts: mocks.listDebts,
}));
vi.mock("@/data/repositories/recurring.repository", async (original) => ({
  ...(await original()),
  listRecurringDashboard: mocks.listRecurringDashboard,
}));

import {
  processGmailBackfill,
  processGmailHistoryNotification,
} from "./email-ingestion";

const key = Buffer.alloc(32, 9).toString("base64");
const configuration = {
  clientId: "client",
  clientSecret: "secret",
  redirectUri: "https://manzana.website/api/v1/email/oauth/callback",
  topicName: "projects/manzana/topics/gmail",
  tokenEncryptionKey: key,
  pubsubAudience: "https://manzana.website/api/webhooks/gmail-pubsub",
  pubsubServiceAccount: "push@project.iam.gserviceaccount.com",
};
const originalEmailExtractionProvider =
  process.env.AGENT_RUNTIME_EMAIL_EXTRACTION_AGENT_PROVIDER;

beforeEach(() => {
  process.env.AGENT_RUNTIME_EMAIL_EXTRACTION_AGENT_PROVIDER =
    "local_fixture";
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getEmailConnectionById.mockResolvedValue({
    id: "connection-1",
    user_id: "user-1",
    encrypted_refresh_token: encryptEmailToken("refresh", key),
    last_history_id: "100",
    status: "watch_active",
    metadata: {
      ai_extraction_consent_enabled: true,
      ai_extraction_consent_version: "email_ai_extraction_v1",
      ai_extraction_consent_updated_at:
        "2026-07-23T08:00:00.000Z",
    },
  });
  mocks.getUserEmailSourceForSender.mockImplementation(
    async (_client: unknown, input: { sender: string }) =>
      input.sender === "alertas@banco.test"
        ? {
            id: "source-1",
            user_id: "user-1",
            institution_key: "bank",
            email_connection_id: "connection-1",
            notification_sender: input.sender,
            status: "active",
            verification_status: "verified",
          }
        : null,
  );
  mocks.listEnabledEmailTemplatesForInstitution.mockResolvedValue([
    {
      id: "template-1",
      institutionKey: "bank",
      sender: "alertas@banco.test",
      templateVersion: "v1",
      priority: 1,
      activationMode: "active",
      verificationStatus: "verified",
      parserConfig: parserConfig(),
    },
  ]);
  mocks.commitEmailMessageOutcome.mockResolvedValue({
    idempotent: false,
    email_message_id: "email-message-1",
    pending_item_id: "pending-1",
  });
  mocks.evaluateCrossChannelDedup.mockResolvedValue({
    decision: { status: "unique", matched_reference_id: null },
  });
  mocks.getActiveAccounts.mockResolvedValue([]);
  mocks.listDebts.mockResolvedValue([]);
  mocks.listRecurringDashboard.mockResolvedValue({
    rules: [],
    candidates: [],
  });
  mocks.touchUserEmailSourceLastMatched.mockResolvedValue(undefined);
  mocks.isSenderSilenced.mockResolvedValue(false);
  mocks.bumpOrCreateSenderSuggestion.mockResolvedValue({
    id: "suggestion-1",
    signal: { seen_count: 1 },
  });
  mocks.countRecentSenderSuggestions.mockResolvedValue(0);
  mocks.getPendingSenderSuggestion.mockResolvedValue(null);
  mocks.computeConfirmability.mockResolvedValue({
    confirmable: false,
    confirmCommand: null,
    missingFields: ["categoria"],
  });
});

afterEach(() => {
  if (originalEmailExtractionProvider === undefined) {
    delete process.env.AGENT_RUNTIME_EMAIL_EXTRACTION_AGENT_PROVIDER;
  } else {
    process.env.AGENT_RUNTIME_EMAIL_EXTRACTION_AGENT_PROVIDER =
      originalEmailExtractionProvider;
  }
});

describe("Gmail ingestion", () => {
  it("filtra metadata antes del cuerpo y solo crea Pendiente", async () => {
    const adapter = fakeAdapter();
    vi.mocked(adapter.listHistory).mockResolvedValue({
      messageIds: [
        { id: "untrusted", threadId: null },
        { id: "trusted", threadId: "thread" },
      ],
      historyId: "200",
      nextPageToken: null,
    });
    vi.mocked(adapter.getMessageMetadata).mockImplementation(async (_token, id) =>
      gmailMessage(
        id,
        id === "trusted" ? "alertas@banco.test" : "spam@attacker.test",
        "",
      ),
    );
    vi.mocked(adapter.getMessageContent).mockResolvedValue(
      gmailMessage(
        "trusted",
        "alertas@banco.test",
        "Compra en MERCADO por S/ 20.00 el 2026-07-20",
      ),
    );

    const result = await processGmailHistoryNotification({
      client: {} as never,
      connectionId: "connection-1",
      externalEventId: "event-1",
      traceId: "trace-1",
      adapter,
      configuration,
    });

    expect(result).toMatchObject({
      discovered: 2,
      trusted: 1,
      pendingCreated: 1,
      templateParsed: 1,
      fallbackParsed: 0,
      checkpoint: "200",
    });
    expect(adapter.getMessageContent).toHaveBeenCalledOnce();
    const outcome = mocks.commitEmailMessageOutcome.mock.calls[0]?.[1];
    expect(outcome.pending.proposed_action.action).toBe("create_movement");
    expect(outcome.pending.proposed_action.movement_input.requires_review).toBe(true);
    expect(outcome.metadata.content_persisted).toBe(false);
    expect(outcome.metadata).toMatchObject({
      institution_key: "bank",
      parse_mode: "template",
      subject_pattern_matched: true,
    });
    expect(mocks.updateEmailSyncCheckpoint).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ historyId: "200" }),
    );
  });

  it("RUL-EMAIL-05: un remitente no vigilado que parece financiero por metadatos genera una sugerencia, sin descargar el cuerpo", async () => {
    const adapter = fakeAdapter();
    vi.mocked(adapter.listHistory).mockResolvedValue({
      messageIds: [{ id: "unknown", threadId: null }],
      historyId: "200",
      nextPageToken: null,
    });
    vi.mocked(adapter.getMessageMetadata).mockResolvedValue(
      gmailMessage("unknown", "notificaciones@bcp.com.pe", ""),
    );

    await processGmailHistoryNotification({
      client: {} as never,
      connectionId: "connection-1",
      externalEventId: "event-1",
      traceId: "trace-1",
      adapter,
      configuration,
    });

    expect(adapter.getMessageContent).not.toHaveBeenCalled();
    expect(mocks.bumpOrCreateSenderSuggestion).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        connectionId: "connection-1",
        sender: "notificaciones@bcp.com.pe",
      }),
    );
  });

  it("RUL-EMAIL-09: cada deteccion real actualiza last_matched_at de la fuente", async () => {
    const adapter = fakeAdapterWithTrustedHistory();

    await processGmailHistoryNotification({
      client: {} as never,
      connectionId: "connection-1",
      externalEventId: "event-1",
      traceId: "trace-1",
      adapter,
      configuration,
    });

    expect(mocks.touchUserEmailSourceLastMatched).toHaveBeenCalledWith({}, "source-1");
  });

  it("rechaza sender sin autenticacion Gmail antes de descargar el cuerpo", async () => {
    const adapter = fakeAdapterWithTrustedHistory();
    const unauthenticated = gmailMessage(
      "trusted",
      "alertas@banco.test",
      "",
    );
    unauthenticated.payload!.headers =
      unauthenticated.payload!.headers.filter(
        (header) => header.name !== "Authentication-Results",
      );
    vi.mocked(adapter.getMessageMetadata).mockResolvedValue(
      unauthenticated,
    );

    const result = await processGmailHistoryNotification({
      client: {} as never,
      connectionId: "connection-1",
      externalEventId: "event-1",
      traceId: "trace-sender-auth-rejected",
      adapter,
      configuration,
    });

    expect(result).toMatchObject({
      trusted: 0,
      senderAuthRejected: 1,
      parseFailed: 1,
      pendingCreated: 0,
    });
    expect(adapter.getMessageContent).not.toHaveBeenCalled();
    expect(mocks.commitEmailMessageOutcome).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        parsedStatus: "parse_failed",
        pending: null,
        metadata: expect.objectContaining({
          content_fetched: false,
          failure_code: "sender_authentication_failed",
          sender_auth_reason:
            "google_authentication_results_missing",
        }),
      }),
    );
  });

  it("no descarga el cuerpo sin consentimiento IA versionado", async () => {
    const adapter = fakeAdapterWithTrustedHistory();
    mocks.getEmailConnectionById.mockResolvedValue({
      id: "connection-1",
      user_id: "user-1",
      encrypted_refresh_token: encryptEmailToken("refresh", key),
      last_history_id: "100",
      status: "watch_active",
      metadata: {},
    });

    const result = await processGmailHistoryNotification({
      client: {} as never,
      connectionId: "connection-1",
      externalEventId: "event-1",
      traceId: "trace-ai-consent-required",
      adapter,
      configuration,
    });

    expect(result).toMatchObject({
      aiConsentSkipped: 1,
      trusted: 0,
      pendingCreated: 0,
    });
    expect(adapter.getMessageContent).not.toHaveBeenCalled();
    expect(mocks.commitEmailMessageOutcome).not.toHaveBeenCalled();
  });

  it("usa EmailExtractionAgent como extractor primario cuando la evidencia esta grounded", async () => {
    const adapter = fakeAdapterWithTrustedHistory();
    vi.mocked(adapter.getMessageContent).mockResolvedValue(
      gmailMessage(
        "trusted",
        "alertas@banco.test",
        "Compra en MERCADO por S/ 20.00 el 20/07/2026 10:30",
      ),
    );

    const result = await processGmailHistoryNotification({
      client: {} as never,
      connectionId: "connection-1",
      externalEventId: "event-1",
      traceId: "trace-agent-email",
      adapter,
      configuration,
    });

    expect(result).toMatchObject({
      agentExtracted: 1,
      agentFallbacks: 0,
      pendingCreated: 1,
    });
    expect(mocks.commitEmailMessageOutcome.mock.calls[0]?.[1]).toMatchObject({
      pending: {
        proposed_action: {
          action: "create_movement",
        },
      },
      metadata: {
        parse_mode: "agent",
        extraction_grounded: true,
        agent_provider: "local_fixture",
      },
    });
  });

  it("lleva un consumo completado a un Pendiente de gasto con la cuenta resuelta", async () => {
    const adapter = fakeAdapterWithTrustedHistory();
    mocks.getActiveAccounts.mockResolvedValue([
      account({
        id: "account-card",
        name: "Tarjeta Banco Test 9876",
        metadata: { last_four: "9876" },
      }),
    ]);
    vi.mocked(adapter.getMessageContent).mockResolvedValue(
      gmailMessage(
        "trusted",
        "alertas@banco.test",
        [
          "Realizaste un consumo.",
          "Comercio: MERCADO PRUEBA",
          "Monto: S/ 20.00",
          "Tarjeta: ****9876",
          "Fecha y hora: 23/07/2026 13:00",
        ].join("\n"),
      ),
    );

    const result = await processGmailHistoryNotification({
      client: {} as never,
      connectionId: "connection-1",
      externalEventId: "event-consumption",
      traceId: "trace-consumption",
      adapter,
      configuration,
    });

    expect(result).toMatchObject({
      agentExtracted: 1,
      pendingCreated: 1,
      specializedSuggested: 0,
    });
    expect(mocks.commitEmailMessageOutcome.mock.calls[0]?.[1]).toMatchObject({
      pending: {
        proposed_action: {
          action: "create_movement",
          movement_type: "gasto",
          movement_input: {
            type: "gasto",
            account_origin_id: "account-card",
            account_destination_id: null,
            requires_review: true,
          },
        },
        metadata: {
          money_sign: "negative",
          specialized_engine_required: false,
        },
      },
      metadata: {
        agent_notice_kind: "purchase",
        agent_operation_status: "completed",
        extraction_grounded: true,
      },
    });
  });

  it("lleva un deposito completado a un Pendiente de ingreso con la cuenta destino", async () => {
    const adapter = fakeAdapterWithTrustedHistory();
    mocks.getActiveAccounts.mockResolvedValue([
      account({
        id: "account-deposit",
        name: "Cuenta Banco Test 2222",
        metadata: { last_four: "2222" },
      }),
    ]);
    vi.mocked(adapter.getMessageContent).mockResolvedValue(
      gmailMessage(
        "trusted",
        "alertas@banco.test",
        [
          "Deposito recibido.",
          "Abono a tu cuenta ****2222",
          "Monto: S/ 50.00",
          "Fecha y hora: 23/07/2026 13:05",
        ].join("\n"),
      ),
    );

    const result = await processGmailHistoryNotification({
      client: {} as never,
      connectionId: "connection-1",
      externalEventId: "event-deposit",
      traceId: "trace-deposit",
      adapter,
      configuration,
    });

    expect(result).toMatchObject({
      agentExtracted: 1,
      pendingCreated: 1,
      specializedSuggested: 0,
    });
    expect(mocks.commitEmailMessageOutcome.mock.calls[0]?.[1]).toMatchObject({
      pending: {
        proposed_action: {
          action: "create_movement",
          movement_type: "ingreso",
          movement_input: {
            type: "ingreso",
            account_origin_id: null,
            account_destination_id: "account-deposit",
            requires_review: true,
          },
        },
        metadata: {
          money_sign: "positive",
          specialized_engine_required: false,
        },
      },
      metadata: {
        agent_notice_kind: "deposit",
        agent_operation_status: "completed",
        extraction_grounded: true,
      },
    });
  });

  it("lleva una transferencia propia a la accion especializada con ambas cuentas", async () => {
    const adapter = fakeAdapterWithTrustedHistory();
    mocks.getActiveAccounts.mockResolvedValue([
      account({
        id: "account-origin",
        name: "Cuenta Banco Test 1111",
        metadata: { last_four: "1111" },
      }),
      account({
        id: "account-destination",
        name: "Cuenta Banco Test 2222",
        metadata: { last_four: "2222" },
      }),
    ]);
    vi.mocked(adapter.getMessageContent).mockResolvedValue(
      gmailMessage(
        "trusted",
        "alertas@banco.test",
        [
          "Transferencia entre mis cuentas.",
          "Cuenta origen: ****1111",
          "Cuenta destino: ****2222",
          "Monto: S/ 30.00",
          "Fecha y hora: 23/07/2026 13:10",
          "Operacion: ABC123",
        ].join("\n"),
      ),
    );

    const result = await processGmailHistoryNotification({
      client: {} as never,
      connectionId: "connection-1",
      externalEventId: "event-transfer",
      traceId: "trace-transfer",
      adapter,
      configuration,
    });

    expect(result).toMatchObject({
      agentExtracted: 1,
      pendingCreated: 1,
      specializedSuggested: 1,
      ambiguousSpecialized: 0,
    });
    expect(mocks.commitEmailMessageOutcome.mock.calls[0]?.[1]).toMatchObject({
      pending: {
        proposed_action: {
          action: "record_transfer",
          movement_type: "transferencia",
          account_origin_id: "account-origin",
          account_destination_id: "account-destination",
          movement_input: {
            type: "transferencia",
            account_origin_id: "account-origin",
            account_destination_id: "account-destination",
            requires_review: true,
          },
        },
        metadata: {
          specialized_engine_required: true,
        },
      },
      metadata: {
        agent_notice_kind: "transfer",
        agent_operation_status: "completed",
        extraction_grounded: true,
        suggested_action: "record_transfer",
      },
    });
  });

  it("no crea Pendiente si el agente extrae un intento rechazado", async () => {
    const adapter = fakeAdapterWithTrustedHistory();
    const rejected = gmailMessage(
      "trusted",
      "alertas@banco.test",
      [
        "Se rechazó tu compra por fondos insuficientes.",
        "Fecha y hora: 20/07/2026 12:15",
        "Comercio: COMERCIO PRUEBA",
        "Monto: S/ 25.00",
        "Tarjeta: ****9876",
      ].join("\n"),
    );
    rejected.payload!.headers = rejected.payload!.headers.map((header) =>
      header.name === "Subject"
        ? {
            ...header,
            value: "Se rechazó tu compra por fondos insuficientes",
          }
        : header,
    );
    vi.mocked(adapter.getMessageContent).mockResolvedValue(rejected);

    const result = await processGmailHistoryNotification({
      client: {} as never,
      connectionId: "connection-1",
      externalEventId: "event-1",
      traceId: "trace-agent-rejected",
      adapter,
      configuration,
    });

    expect(result).toMatchObject({
      agentExtracted: 1,
      ignoredNonMovement: 1,
      pendingCreated: 0,
    });
    expect(mocks.evaluateCrossChannelDedup).not.toHaveBeenCalled();
    expect(mocks.commitEmailMessageOutcome.mock.calls[0]?.[1]).toMatchObject({
      parsedStatus: "parsed",
      pending: null,
      metadata: {
        parse_mode: "agent",
        agent_notice_kind: "rejected_attempt",
        agent_operation_status: "rejected",
        ignored_reason: "non_completed_financial_notice",
      },
    });
  });

  it("propone deuda resuelta sin degradarla a movimiento generico", async () => {
    const adapter = fakeAdapterWithTrustedHistory();
    mocks.listEnabledEmailTemplatesForInstitution.mockResolvedValue([
      {
        id: "template-debt",
        institutionKey: "bank",
        sender: "alertas@banco.test",
        templateVersion: "debt-v1",
        priority: 1,
        activationMode: "active",
        verificationStatus: "verified",
        parserConfig: {
          ...parserConfig(),
          extraction_rules: {
            ...parserConfig().extraction_rules,
            operation_hint: "debt_installment",
          },
        },
      },
    ]);
    mocks.listDebts.mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        user_id: "user-1",
        direction: "i_owe",
        kind: "bank_loan",
        status: "active",
        related_person_id: null,
        name: "MERCADO",
        principal_amount: 100,
        current_balance: 80,
        currency: "PEN",
        opened_at: "2026-01-01",
        due_date: null,
        next_payment_date: null,
        installment_count: 4,
        installment_amount: 20,
        interest_notes: null,
        source: "dashboard_manual",
        confidence: 1,
        metadata: {},
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        deleted_at: null,
        last_payment_at: null,
        closed_at: null,
      },
    ]);

    const result = await processGmailHistoryNotification({
      client: {} as never,
      connectionId: "connection-1",
      externalEventId: "event-1",
      traceId: "trace-1",
      adapter,
      configuration,
    });

    expect(result.specializedSuggested).toBe(1);
    const pending = mocks.commitEmailMessageOutcome.mock.calls[0]?.[1].pending;
    expect(pending.proposed_action).toMatchObject({
      action: "record_debt_payment",
      movement_type: "pago_deuda",
      debt_id: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("no crea Pendiente para duplicado exacto", async () => {
    const adapter = fakeAdapterWithTrustedHistory();
    mocks.evaluateCrossChannelDedup.mockResolvedValue({
      decision: { status: "exact_duplicate", matched_reference_id: "movement-1" },
    });

    const result = await processGmailHistoryNotification({
      client: {} as never,
      connectionId: "connection-1",
      externalEventId: "event-1",
      traceId: "trace-1",
      adapter,
      configuration,
    });

    expect(result.deduplicated).toBe(1);
    expect(mocks.commitEmailMessageOutcome.mock.calls[0]?.[1]).toMatchObject({
      parsedStatus: "deduplicated",
      pending: null,
    });
  });

  it("mide fallback generico con baja confianza", async () => {
    const adapter = fakeAdapterWithTrustedHistory();
    const originalMessage = await vi.mocked(adapter.getMessageContent)(
      "access",
      "trusted",
    );
    originalMessage.payload!.headers = originalMessage.payload!.headers.map(
      (header) =>
        header.name === "Subject"
          ? { ...header, value: "Formato aun no versionado" }
          : header,
    );
    vi.mocked(adapter.getMessageContent).mockResolvedValue(originalMessage);

    const result = await processGmailHistoryNotification({
      client: {} as never,
      connectionId: "connection-1",
      externalEventId: "event-1",
      traceId: "trace-1",
      adapter,
      configuration,
    });

    expect(result).toMatchObject({
      pendingCreated: 1,
      templateParsed: 0,
      fallbackParsed: 1,
    });
    const outcome = mocks.commitEmailMessageOutcome.mock.calls[0]?.[1];
    expect(outcome.metadata.parse_mode).toBe("generic_fallback");
    expect(
      outcome.pending.proposed_action.movement_input.confidence,
    ).toBe(0.55);
  });

  it("ejecuta shadow sin crear Pendiente ni promoverlo a parse activo", async () => {
    const adapter = fakeAdapterWithTrustedHistory();
    vi.mocked(adapter.getMessageContent).mockResolvedValue(
      gmailMessage(
        "trusted",
        "alertas@banco.test",
        "Compra en MERCADO por S/ 20.00 el 20/07/2026 10:30",
      ),
    );
    mocks.listEnabledEmailTemplatesForInstitution.mockResolvedValue([
      {
        id: "template-shadow",
        institutionKey: "bank",
        sender: "alertas@banco.test",
        templateVersion: "v2-shadow",
        priority: 1,
        activationMode: "shadow",
        verificationStatus: "draft",
        parserConfig: parserConfig(),
      },
    ]);

    const result = await processGmailHistoryNotification({
      client: {} as never,
      connectionId: "connection-1",
      externalEventId: "event-1",
      traceId: "trace-1",
      adapter,
      configuration,
    });

    expect(result).toMatchObject({
      pendingCreated: 0,
      parseFailed: 1,
      shadowParsed: 1,
      shadowAgentExtracted: 1,
      shadowAgentFallbacks: 0,
    });
    expect(mocks.evaluateCrossChannelDedup).not.toHaveBeenCalled();
    expect(mocks.commitEmailMessageOutcome.mock.calls[0]?.[1]).toMatchObject({
      parsedStatus: "parse_failed",
      pending: null,
      metadata: {
        parse_mode: "shadow",
        failure_code: "no_active_template",
        shadow_template_id: "template-shadow",
        shadow_agent_outcome: "parsed",
        shadow_extraction_grounded: true,
        shadow_agent_provider: "local_fixture",
      },
    });
  });

  it("registra configuracion invalida como fallo visible", async () => {
    const adapter = fakeAdapterWithTrustedHistory();
    mocks.listEnabledEmailTemplatesForInstitution.mockResolvedValue([
      {
        id: "template-invalid",
        institutionKey: "bank",
        sender: "alertas@banco.test",
        templateVersion: "broken",
        priority: 1,
        activationMode: "active",
        verificationStatus: "verified",
        parserConfig: {},
      },
    ]);

    const result = await processGmailHistoryNotification({
      client: {} as never,
      connectionId: "connection-1",
      externalEventId: "event-1",
      traceId: "trace-1",
      adapter,
      configuration,
    });

    expect(result).toMatchObject({
      pendingCreated: 0,
      parseFailed: 1,
      invalidTemplateConfigs: 1,
    });
    expect(mocks.commitEmailMessageOutcome.mock.calls[0]?.[1]).toMatchObject({
      parsedStatus: "parse_failed",
      metadata: {
        failure_code: "invalid_template_config",
        invalid_template_ids: ["template-invalid"],
      },
    });
  });

  it("omite mensajes que desaparecieron y continua el checkpoint", async () => {
    const adapter = fakeAdapter();
    vi.mocked(adapter.listHistory).mockResolvedValue({
      messageIds: [
        { id: "deleted", threadId: null },
        { id: "trusted", threadId: "thread" },
      ],
      historyId: "201",
      nextPageToken: null,
    });
    vi.mocked(adapter.getMessageMetadata).mockImplementation(
      async (_token, id) => {
        if (id === "deleted") {
          throw new GmailClientError(
            "GMAIL_API_FAILED",
            "Mensaje ya no disponible",
            404,
          );
        }
        return gmailMessage(id, "alertas@banco.test", "");
      },
    );
    vi.mocked(adapter.getMessageContent).mockResolvedValue(
      gmailMessage(
        "trusted",
        "alertas@banco.test",
        "Compra en MERCADO por S/ 20.00 el 2026-07-20",
      ),
    );

    const result = await processGmailHistoryNotification({
      client: {} as never,
      connectionId: "connection-1",
      externalEventId: "event-1",
      traceId: "trace-1",
      adapter,
      configuration,
    });

    expect(result).toMatchObject({
      discovered: 2,
      trusted: 1,
      pendingCreated: 1,
      parseFailed: 1,
      checkpoint: "201",
    });
    expect(mocks.updateEmailSyncCheckpoint).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ historyId: "201" }),
    );
    expect(mocks.updateExternalEventStatus).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ status: "processed" }),
    );
  });

  it("acota backfill a 30 dias y 500 mensajes", async () => {
    const adapter = fakeAdapter();
    vi.mocked(adapter.listRecentMessages).mockResolvedValue({
      messageIds: [],
      nextPageToken: null,
    });

    await processGmailBackfill({
      client: {} as never,
      connectionId: "connection-1",
      traceId: "trace-1",
      newerThanDays: 90,
      maxMessages: 900,
      adapter,
      configuration,
    });

    expect(adapter.listRecentMessages).toHaveBeenCalledWith({
      accessToken: "access",
      newerThanDays: 30,
      pageToken: null,
    });
    expect(mocks.updateEmailConnectionState).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        metadata: expect.objectContaining({
          backfill_days: 30,
          delivery_channel: "dashboard_only",
        }),
      }),
    );
  });
});

function fakeAdapterWithTrustedHistory() {
  const adapter = fakeAdapter();
  vi.mocked(adapter.listHistory).mockResolvedValue({
    messageIds: [{ id: "trusted", threadId: "thread" }],
    historyId: "200",
    nextPageToken: null,
  });
  vi.mocked(adapter.getMessageMetadata).mockResolvedValue(
    gmailMessage("trusted", "alertas@banco.test", ""),
  );
  vi.mocked(adapter.getMessageContent).mockResolvedValue(
    gmailMessage(
      "trusted",
      "alertas@banco.test",
      "Compra en MERCADO por S/ 20.00 el 2026-07-20",
    ),
  );
  return adapter;
}

function fakeAdapter(): EmailAdapter {
  return {
    buildAuthorizationUrl: vi.fn(),
    exchangeAuthorizationCode: vi.fn(),
    refreshAccessToken: vi.fn(async () => "access"),
    getProfile: vi.fn(),
    startWatch: vi.fn(),
    stopWatch: vi.fn(),
    revokeToken: vi.fn(),
    listHistory: vi.fn(),
    listRecentMessages: vi.fn(),
    getMessageMetadata: vi.fn(),
    getMessageContent: vi.fn(),
  };
}

function gmailMessage(id: string, sender: string, body: string): GmailMessage {
  const senderDomain = sender.split("@").at(-1) ?? "invalid";
  return {
    id,
    threadId: "thread",
    internalDate: String(new Date("2026-07-20T10:00:00Z").getTime()),
    snippet: null,
    payload: {
      mimeType: "text/plain",
      headers: [
        { name: "From", value: `Banco <${sender}>` },
        { name: "Subject", value: "Alerta financiera" },
        {
          name: "Authentication-Results",
          value:
            `mx.google.com; dkim=pass header.d=${senderDomain}; ` +
            `spf=pass smtp.mailfrom=${senderDomain}; ` +
            `dmarc=pass header.from=${senderDomain}`,
        },
      ],
      body: { data: Buffer.from(body).toString("base64url") },
      parts: [],
    },
  };
}

function parserConfig() {
  return {
    schema_version: "gmail_parser_v1",
    subject_patterns: ["Alerta financiera"],
    extraction_rules: {
      amount: {
        pattern: "(?:S/|PEN)\\s*([\\d.,]+)",
        type: "number",
      },
      merchant: {
        pattern: "en\\s+(.+?)\\s+por\\s+(?:S/|PEN)",
        type: "string",
      },
      occurred_at: {
        pattern: "(20\\d{2}-\\d{2}-\\d{2})",
        type: "datetime",
        format: "YYYY-MM-DD",
      },
      direction: "out",
      currency: "PEN",
    },
    allow_generic_fallback: true,
    confidence: { template: 0.93, fallback: 0.55 },
    institution_aliases: ["Banco Test"],
  };
}

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: "account-1",
    user_id: "user-1",
    name: "Cuenta Banco Test 4521",
    institution: "Banco Test",
    type: "banco",
    currency: "PEN",
    initial_balance: 0,
    current_balance: 1000,
    is_default: false,
    color: null,
    icon: null,
    metadata: { last_four: "4521" },
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}
