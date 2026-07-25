import type { SupabaseClient } from "@supabase/supabase-js";
import {
  processGmailBackfill,
  processGmailHistoryNotification,
} from "@/core/email/email-ingestion";
import type { Database } from "@/data/supabase/types";
import type { OutboxHandler } from "@/workers/outbox/outbox-publisher";

type Client = SupabaseClient<Database>;

export function createGmailIngestionHandler(client: Client): OutboxHandler {
  return {
    consumerName: "gmail_ingestion.history_v1",
    canHandle: (event) =>
      (event.event_type === "gmail_history_notification" ||
        event.event_type === "gmail_backfill_requested") &&
      event.aggregate_type === "email_connection",
    handle: async (event) => {
      const connectionId = readString(event.payload.connection_id) ?? event.aggregate_id;
      if (!connectionId) {
        throw new Error("Evento Gmail sin referencias de ingestion");
      }
      if (event.event_type === "gmail_backfill_requested") {
        await processGmailBackfill({
          client,
          connectionId,
          traceId: event.trace_id,
          newerThanDays: readInteger(event.payload.newer_than_days) ?? 30,
          maxMessages: readInteger(event.payload.max_messages) ?? 500,
        });
        return;
      }
      const externalEventId = readString(event.payload.external_event_id);
      if (!externalEventId) {
        throw new Error("Evento Gmail sin external_event_id");
      }
      await processGmailHistoryNotification({
        client,
        connectionId,
        externalEventId,
        traceId: event.trace_id,
      });
    },
  };
}

function readInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
