import { describe, expect, it } from "vitest";
import { buildOutboxOperationalSnapshot } from "./worker-operations.repository";

describe("worker operations repository", () => {
  it("calcula lag, conteos y tipos fallidos del outbox", () => {
    const snapshot = buildOutboxOperationalSnapshot([
      {
        status: "pending",
        created_at: "2026-07-01T10:00:00.000Z",
        processing_started_at: null,
        event_type: "movement_created",
      },
      {
        status: "pending",
        created_at: "2026-07-01T10:05:00.000Z",
        processing_started_at: null,
        event_type: "pending_created",
      },
      {
        status: "processing",
        created_at: "2026-07-01T10:06:00.000Z",
        processing_started_at: "2026-07-01T10:07:00.000Z",
        event_type: "debt_payment_registered",
      },
      {
        status: "failed",
        created_at: "2026-07-01T10:08:00.000Z",
        processing_started_at: null,
        event_type: "pending_created",
      },
      {
        status: "dead_letter",
        created_at: "2026-07-01T10:09:00.000Z",
        processing_started_at: null,
        event_type: "pending_created",
      },
    ]);

    expect(snapshot.scanned).toBe(5);
    expect(snapshot.counts).toEqual({
      pending: 2,
      processing: 1,
      failed: 1,
      dead_letter: 1,
    });
    expect(snapshot.oldest_pending_created_at).toBe("2026-07-01T10:00:00.000Z");
    expect(snapshot.oldest_processing_started_at).toBe(
      "2026-07-01T10:07:00.000Z"
    );
    expect(snapshot.failed_event_types).toEqual([
      { event_type: "pending_created", count: 2 },
    ]);
  });
});
