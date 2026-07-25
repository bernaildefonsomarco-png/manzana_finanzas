import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  processGmailHistoryNotification: vi.fn(),
  processGmailBackfill: vi.fn(),
}));

vi.mock("@/core/email/email-ingestion", () => mocks);

import { createGmailIngestionHandler } from "./gmail-ingestion-handler";

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
});

describe("gmail ingestion outbox handler", () => {
  it("despacha notificacion incremental", async () => {
    const handler = createGmailIngestionHandler({} as never);
    const event = outboxEvent("gmail_history_notification", {
      connection_id: "connection-1",
      external_event_id: "event-1",
    });
    expect(handler.canHandle(event)).toBe(true);
    await handler.handle(event);
    expect(mocks.processGmailHistoryNotification).toHaveBeenCalledWith({
      client: {},
      connectionId: "connection-1",
      externalEventId: "event-1",
      traceId: "trace-1",
    });
  });

  it("despacha backfill acotado", async () => {
    const handler = createGmailIngestionHandler({} as never);
    await handler.handle(
      outboxEvent("gmail_backfill_requested", {
        connection_id: "connection-1",
        newer_than_days: 30,
        max_messages: 500,
      }),
    );
    expect(mocks.processGmailBackfill).toHaveBeenCalledWith({
      client: {},
      connectionId: "connection-1",
      traceId: "trace-1",
      newerThanDays: 30,
      maxMessages: 500,
    });
  });
});

function outboxEvent(eventType: string, payload: Record<string, unknown>) {
  return {
    id: "outbox-1",
    user_id: "user-1",
    event_type: eventType,
    aggregate_type: "email_connection",
    aggregate_id: "connection-1",
    payload,
    payload_version: 1,
    status: "pending" as const,
    trace_id: "trace-1",
    metadata: {},
    attempt_count: 0,
    max_attempts: 5,
    next_attempt_at: "2026-07-22T00:00:00Z",
    processing_started_at: null,
    published_at: null,
    created_at: "2026-07-22T00:00:00Z",
    updated_at: "2026-07-22T00:00:00Z",
    last_error: null,
  };
}
