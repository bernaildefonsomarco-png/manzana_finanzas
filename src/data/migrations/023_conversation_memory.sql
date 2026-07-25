-- =============================================================
-- Migration 023: Conversation memory state
-- Corte 22L - Memoria conversacional consultable
-- Depends on: 001-022
-- =============================================================

create table if not exists public.conversation_memory_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null,
  scope text not null default 'default',
  last_intent text,
  last_query_kind text,
  last_query_text text,
  last_query_date_range jsonb,
  last_tool_name text,
  last_result_summary text,
  referenced_movements jsonb not null default '[]'::jsonb,
  referenced_entities jsonb not null default '[]'::jsonb,
  continuity_hint text,
  source_ref text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint conversation_memory_states_channel_known
    check (channel in ('whatsapp', 'dashboard')),
  constraint conversation_memory_states_referenced_movements_array
    check (jsonb_typeof(referenced_movements) = 'array'),
  constraint conversation_memory_states_referenced_entities_array
    check (jsonb_typeof(referenced_entities) = 'array')
);

create trigger conversation_memory_states_set_updated_at
  before update on public.conversation_memory_states
  for each row execute function manzana.set_updated_at();

create unique index if not exists conversation_memory_states_user_channel_scope_unique
  on public.conversation_memory_states (user_id, channel, scope);

create index if not exists conversation_memory_states_user_active_idx
  on public.conversation_memory_states (user_id, channel, expires_at desc);

comment on table public.conversation_memory_states is
  'Estado conversacional activo y seguro. Guarda resúmenes y referencias, no historial crudo ni razonamiento interno.';

comment on column public.conversation_memory_states.referenced_movements is
  'Lista limitada de movimientos referenciados por la última respuesta para resolver frases como cada uno, eso o el anterior.';

alter table public.conversation_memory_states enable row level security;

drop policy if exists "conversation_memory_states: select own"
  on public.conversation_memory_states;
create policy "conversation_memory_states: select own"
  on public.conversation_memory_states for select
  using (auth.uid() = user_id);

drop policy if exists "conversation_memory_states: no client write"
  on public.conversation_memory_states;
create policy "conversation_memory_states: no client write"
  on public.conversation_memory_states for all
  using (false)
  with check (false);

revoke all on public.conversation_memory_states from anon, authenticated;
grant select on public.conversation_memory_states to authenticated;
grant select, insert, update on public.conversation_memory_states to service_role;
