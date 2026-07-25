-- =============================================================
-- Migration 011: WhatsApp delivery attempts
-- Corte 5 - WhatsApp outbound observability
-- Depends on: 001, 002, 005, 010
-- =============================================================

create table if not exists public.whatsapp_delivery_attempts (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  provider              text not null default 'kapso',
  direction             text not null default 'outbound',
  message_kind          text not null,
  to_phone              text not null,
  template_name         text,
  idempotency_key       text not null,
  trace_id              uuid not null,
  provider_message_id   text,
  status                text not null default 'attempted',
  http_status           int,
  latency_ms            int,
  error_code            text,
  error_message         text,
  request_summary       jsonb not null default '{}'::jsonb,
  response_summary      jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  metadata              jsonb not null default '{}'::jsonb,

  constraint whatsapp_delivery_provider_known
    check (provider in ('kapso', 'ycloud', 'meta_cloud')),
  constraint whatsapp_delivery_direction_known
    check (direction in ('outbound')),
  constraint whatsapp_delivery_message_kind_known
    check (message_kind in ('freeform', 'template', 'interactive')),
  constraint whatsapp_delivery_status_known
    check (status in ('attempted', 'accepted', 'failed')),
  constraint whatsapp_delivery_phone_length
    check (length(to_phone) between 8 and 32),
  constraint whatsapp_delivery_latency_valid
    check (latency_ms is null or latency_ms >= 0),
  constraint whatsapp_delivery_http_status_valid
    check (http_status is null or http_status between 100 and 599),
  constraint whatsapp_delivery_request_summary_object
    check (jsonb_typeof(request_summary) = 'object'),
  constraint whatsapp_delivery_response_summary_object
    check (jsonb_typeof(response_summary) = 'object'),
  constraint whatsapp_delivery_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint whatsapp_delivery_idempotency_unique
    unique (user_id, idempotency_key)
);

create trigger whatsapp_delivery_attempts_updated_at
  before update on public.whatsapp_delivery_attempts
  for each row execute function manzana.set_updated_at();

create index if not exists whatsapp_delivery_user_created_idx
  on public.whatsapp_delivery_attempts (user_id, created_at desc);

create index if not exists whatsapp_delivery_provider_message_idx
  on public.whatsapp_delivery_attempts (provider_message_id)
  where provider_message_id is not null;

create index if not exists whatsapp_delivery_status_created_idx
  on public.whatsapp_delivery_attempts (status, created_at desc);

comment on table public.whatsapp_delivery_attempts is
  'Intentos outbound de WhatsApp. Status webhooks siguen entrando por external_event_log.';

alter table public.whatsapp_delivery_attempts enable row level security;

revoke all on public.whatsapp_delivery_attempts from anon, authenticated;
grant select, insert, update on public.whatsapp_delivery_attempts to service_role;
