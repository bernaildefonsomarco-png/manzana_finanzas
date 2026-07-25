import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import type { OutboxEvent } from "@/core/events/domain-events";
import {
  claimOutboxEvents,
  markOutboxFailed,
  markOutboxPublished,
  recordInternalEventProcessing,
} from "@/data/repositories/events.repository";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;

export type OutboxHandler = {
  consumerName: string;
  canHandle: (event: OutboxEvent) => boolean;
  handle: (event: OutboxEvent) => Promise<void>;
};

export type OutboxPublisherResult = {
  claimed: number;
  published: number;
  failed: number;
  skipped: number;
};

export async function publishOutboxBatch(
  client: Client,
  options: {
    limit?: number;
    handlers?: OutboxHandler[];
  } = {}
): Promise<OutboxPublisherResult> {
  const events = await claimOutboxEvents(client, options.limit ?? 25);
  const result: OutboxPublisherResult = {
    claimed: events.length,
    published: 0,
    failed: 0,
    skipped: 0,
  };

  for (const event of events) {
    try {
      const handled = await publishSingleEvent(client, event, options.handlers ?? []);

      if (handled === 0) {
        result.skipped += 1;
      }

      await markOutboxPublished(client, event.id);
      result.published += 1;
    } catch (error) {
      result.failed += 1;
      const message = readSafeErrorMessage(error);
      logger.error("outbox_publisher.event_failed", {
        outbox_id: event.id,
        event_type: event.event_type,
        error: message,
      });
      await markOutboxFailed(client, event, message);
    }
  }

  return result;
}

async function publishSingleEvent(
  client: Client,
  event: OutboxEvent,
  handlers: OutboxHandler[]
): Promise<number> {
  const matchingHandlers = handlers.filter((handler) => handler.canHandle(event));

  if (matchingHandlers.length === 0) {
    await recordInternalEventProcessing(client, {
      outbox_id: event.id,
      event_type: event.event_type,
      consumer_name: "internal_domain_event_bus",
      status: "skipped",
      metadata: {
        reason: "no_handler_registered",
      },
    });
    return 0;
  }

  for (const handler of matchingHandlers) {
    await handler.handle(event);
    await recordInternalEventProcessing(client, {
      outbox_id: event.id,
      event_type: event.event_type,
      consumer_name: handler.consumerName,
      status: "processed",
      metadata: {
        aggregate_type: event.aggregate_type,
        aggregate_id: event.aggregate_id,
      },
    });
  }

  return matchingHandlers.length;
}

function readSafeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.slice(0, 500);
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message.slice(0, 500);
  }

  return "unknown_error";
}
