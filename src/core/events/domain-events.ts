import type { Json } from "@/data/supabase/types";

export type OutboxStatus =
  | "pending"
  | "processing"
  | "published"
  | "failed"
  | "dead_letter";

export type InternalEventConsumerStatus =
  | "processing"
  | "processed"
  | "failed"
  | "skipped";

export type OutboxEventDraft = {
  id: string;
  user_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  payload_version: number;
  status?: OutboxStatus;
  trace_id: string;
  metadata: Record<string, unknown>;
};

export type OutboxEvent = OutboxEventDraft & {
  status: OutboxStatus;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: string;
  processing_started_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  last_error: string | null;
};

export type InternalEventLog = {
  id: string;
  outbox_id: string;
  event_type: string;
  consumer_name: string;
  status: InternalEventConsumerStatus;
  processed_at: string | null;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
};

export type ExternalEventLog = {
  id: string;
  source: "whatsapp" | "dashboard" | "gmail" | "scheduler" | "worker";
  event_type: string;
  idempotency_key: string;
  user_id: string | null;
  received_at: string;
  status: "received" | "duplicate" | "accepted" | "processed" | "failed" | "dead_letter";
  payload_hash: string;
  payload_ref: string | null;
  trace_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export function toJson(value: unknown): Json {
  return value as Json;
}
