-- =============================================================
-- Migration 010: WhatsApp window states
-- Corte 5 - WhatsApp Adapter + 24h window state
-- Depends on: 001, 002, 005, 008
-- =============================================================

create table if not exists public.whatsapp_window_states (
  id                                      uuid primary key default gen_random_uuid(),
  user_id                                 uuid not null references auth.users(id) on delete cascade,
  phone                                   text not null,
  last_user_message_at                    timestamptz,
  window_expires_at                       timestamptz,
  status                                  text not null default 'closed',
  paid_templates_today                    int not null default 0,
  paid_templates_this_month               int not null default 0,
  last_paid_template_at                   timestamptz,
  last_window_continuation_prompt_at      timestamptz,
  last_window_final_prompt_at             timestamptz,
  created_at                              timestamptz not null default now(),
  updated_at                              timestamptz not null default now(),
  metadata                                jsonb not null default '{}'::jsonb,

  constraint whatsapp_window_states_status_known
    check (status in ('open', 'closing_soon', 'closed')),
  constraint whatsapp_window_states_phone_length
    check (length(phone) between 8 and 32),
  constraint whatsapp_window_states_paid_counts_valid
    check (paid_templates_today >= 0 and paid_templates_this_month >= 0),
  constraint whatsapp_window_states_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint whatsapp_window_states_user_phone_unique
    unique (user_id, phone)
);

create trigger whatsapp_window_states_updated_at
  before update on public.whatsapp_window_states
  for each row execute function manzana.set_updated_at();

create index if not exists whatsapp_window_states_user_phone_idx
  on public.whatsapp_window_states (user_id, phone);

create index if not exists whatsapp_window_states_status_expires_idx
  on public.whatsapp_window_states (status, window_expires_at);

comment on table public.whatsapp_window_states is
  'Estado persistible de ventana de servicio WhatsApp. No autoriza envios por si mismo; PolicyGate/NudgePolicy deciden.';

alter table public.whatsapp_window_states enable row level security;

revoke all on public.whatsapp_window_states from anon, authenticated;
grant select, insert, update on public.whatsapp_window_states to service_role;
