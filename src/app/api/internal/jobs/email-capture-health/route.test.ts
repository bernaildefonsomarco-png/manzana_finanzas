import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(() => ({})),
  getEmailCaptureHealth: vi.fn(),
  getEmailExtractionAgentHealth: vi.fn(),
  getEmailSenderAuthenticationHealth: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock("@/data/repositories/email.repository", async (original) => ({
  ...(await original()),
  getEmailCaptureHealth: mocks.getEmailCaptureHealth,
  getEmailExtractionAgentHealth: mocks.getEmailExtractionAgentHealth,
  getEmailSenderAuthenticationHealth:
    mocks.getEmailSenderAuthenticationHealth,
}));
vi.mock("@/shared/telemetry/logger", () => ({
  logger: { warn: mocks.warn },
}));

import { GET } from "./route";

const originalCronSecret = process.env.CRON_SECRET;
const originalWorkerSecret = process.env.WORKER_SECRET;
const originalAppEnv = process.env.APP_ENV;

beforeEach(() => {
  process.env.CRON_SECRET = "cron-secret";
  delete process.env.WORKER_SECRET;
  process.env.APP_ENV = "production";
  mocks.getEmailCaptureHealth.mockReset();
  mocks.getEmailExtractionAgentHealth.mockReset();
  mocks.getEmailSenderAuthenticationHealth.mockReset();
  mocks.warn.mockReset();
  mocks.getEmailCaptureHealth.mockResolvedValue(healthyResult());
  mocks.getEmailExtractionAgentHealth.mockResolvedValue(
    healthyExtractionAgentResult(),
  );
  mocks.getEmailSenderAuthenticationHealth.mockResolvedValue(
    healthySenderAuthenticationResult(),
  );
});

afterEach(() => {
  process.env.CRON_SECRET = originalCronSecret;
  process.env.WORKER_SECRET = originalWorkerSecret;
  process.env.APP_ENV = originalAppEnv;
});

describe("email capture health route", () => {
  it("expone salud agregada sin PII con secreto de cron", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/internal/jobs/email-capture-health?days=14",
        { headers: { authorization: "Bearer cron-secret" } },
      ),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data).toMatchObject({
      worker: "email_capture_health",
      healthy: true,
      failed_targets: [],
    });
    expect(mocks.getEmailCaptureHealth).toHaveBeenCalledWith({}, 14);
    expect(mocks.getEmailExtractionAgentHealth).toHaveBeenCalledWith({}, 14);
    expect(mocks.getEmailSenderAuthenticationHealth).toHaveBeenCalledWith(
      {},
      14,
    );
  });

  it("devuelve 503 y telemetria cuando falla un objetivo", async () => {
    mocks.getEmailCaptureHealth.mockResolvedValue({
      ...healthyResult(),
      parse_failures: 2,
      targets: {
        active_parse_rate_gte_95: false,
        fallback_rate_lt_10: true,
        p95_latency_lte_120000: true,
        silent_failures_zero: true,
      },
    });

    const response = await GET(
      new Request(
        "http://localhost/api/internal/jobs/email-capture-health",
        { headers: { authorization: "Bearer cron-secret" } },
      ),
    );

    expect(response.status).toBe(503);
    const payload = await response.json();
    expect(payload.data.failed_targets).toEqual([
      "active_parse_rate_gte_95",
    ]);
    expect(mocks.warn).toHaveBeenCalledWith(
      "email.capture_health_degraded",
      expect.objectContaining({ parse_failures: 2 }),
    );
  });

  it("incluye los objetivos fallidos del agente con namespace propio", async () => {
    mocks.getEmailExtractionAgentHealth.mockResolvedValue({
      ...healthyExtractionAgentResult(),
      agent_fallbacks: 3,
      targets: {
        agent_fallback_rate_lt_10: false,
        agent_grounding_failure_rate_lt_1: true,
        p95_agent_latency_lte_10000: true,
      },
    });

    const response = await GET(
      new Request(
        "http://localhost/api/internal/jobs/email-capture-health",
        { headers: { authorization: "Bearer cron-secret" } },
      ),
    );

    expect(response.status).toBe(503);
    const payload = await response.json();
    expect(payload.data.failed_targets).toEqual([
      "email_extraction_agent.agent_fallback_rate_lt_10",
    ]);
    expect(payload.data.extraction_agent_health.agent_fallbacks).toBe(3);
  });

  it("degrada si se descargo contenido despues de rechazar autenticacion", async () => {
    mocks.getEmailSenderAuthenticationHealth.mockResolvedValue({
      ...healthySenderAuthenticationResult(),
      content_fetch_violations: 1,
      targets: {
        body_fetch_after_auth_rejection_zero: false,
        auth_rejection_reason_known: true,
      },
    });

    const response = await GET(
      new Request(
        "http://localhost/api/internal/jobs/email-capture-health",
        { headers: { authorization: "Bearer cron-secret" } },
      ),
    );

    expect(response.status).toBe(503);
    const payload = await response.json();
    expect(payload.data.failed_targets).toEqual([
      "sender_authentication.body_fetch_after_auth_rejection_zero",
    ]);
  });

  it("rechaza acceso sin secreto fuera de local", async () => {
    const response = await GET(
      new Request("http://localhost/api/internal/jobs/email-capture-health"),
    );

    expect(response.status).toBe(403);
    expect(mocks.getEmailCaptureHealth).not.toHaveBeenCalled();
    expect(mocks.getEmailExtractionAgentHealth).not.toHaveBeenCalled();
    expect(mocks.getEmailSenderAuthenticationHealth).not.toHaveBeenCalled();
  });
});

function healthyResult() {
  return {
    window_days: 7,
    denominator: "persisted_allowlisted_messages" as const,
    allowed_messages_persisted: 10,
    successful_active_parses: 10,
    parse_failures: 0,
    generic_fallbacks: 0,
    failed_external_events: 0,
    stuck_external_events: 0,
    gmail_external_events: 10,
    processed_external_events: 10,
    gmail_api_calls: 31,
    watch_connections_unhealthy: 0,
    connections_missing_token: 0,
    stale_active_templates: 0,
    pending_items_created: 4,
    pending_items_confirmed: 2,
    pending_items_ignored: 1,
    active_parse_rate: 1,
    fallback_rate: 0,
    external_event_processed_rate: 1,
    pending_confirmation_rate: 0.5,
    p95_processing_latency_ms: 500,
    cost_instrumentation: {
      pricing_snapshot_id: null,
      estimated_cost_usd: null,
      estimated_cost_pen: null,
      gmail_api_calls: 31,
      emails_processed: 10,
      pending_items_confirmed: 2,
    },
    targets: {
      active_parse_rate_gte_95: true,
      fallback_rate_lt_10: true,
      p95_latency_lte_120000: true,
      external_event_processed_rate_gte_98: true,
      silent_failures_zero: true,
      watch_connections_healthy: true,
      tokens_present_for_connected_accounts: true,
      active_templates_matched_within_14d: true,
    },
    templates: [],
  };
}

function healthyExtractionAgentResult() {
  return {
    window_days: 7,
    agent_attempts: 10,
    grounded_agent_extractions: 10,
    agent_fallbacks: 0,
    agent_grounding_failures: 0,
    ignored_non_movement_notices: 1,
    api_agent_extractions: 10,
    agent_evidence_repaired_attempts: 0,
    agent_value_normalized_attempts: 0,
    p95_agent_latency_ms: 800,
    agent_success_rate: 1,
    agent_fallback_rate: 0,
    agent_grounding_failure_rate: 0,
    agent_evidence_repair_rate: 0,
    agent_value_normalization_rate: 0,
    targets: {
      agent_fallback_rate_lt_10: true,
      agent_grounding_failure_rate_lt_1: true,
      agent_evidence_repair_rate_lt_20: true,
      agent_value_normalization_rate_lt_10: true,
      p95_agent_latency_lte_10000: true,
    },
  };
}

function healthySenderAuthenticationResult() {
  return {
    window_days: 7,
    sender_authentication_rejections: 1,
    content_fetch_violations: 0,
    unknown_reason_count: 0,
    reasons: { dkim_pass_missing: 1 },
    targets: {
      body_fetch_after_auth_rejection_zero: true,
      auth_rejection_reason_known: true,
    },
  };
}
