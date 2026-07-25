-- =============================================================
-- Migration 017: Dashboard nudges V1
-- Corte 12 - Avisos internos sin envio proactivo
-- Depends on: 001-016
-- =============================================================

create table if not exists public.nudge_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nudge_type public.nudge_type not null,
  enabled boolean not null default false,
  channel text not null default 'dashboard',
  quiet_hours_override jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint nudge_preferences_channel_known
    check (channel in ('dashboard', 'whatsapp', 'email')),
  constraint nudge_preferences_quiet_hours_object
    check (
      quiet_hours_override is null
      or jsonb_typeof(quiet_hours_override) = 'object'
    ),
  constraint nudge_preferences_unique_channel
    unique (user_id, nudge_type, channel)
);

create trigger nudge_preferences_set_updated_at
  before update on public.nudge_preferences
  for each row execute function manzana.set_updated_at();

create table if not exists public.nudge_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.nudge_type not null,
  source_entity_type text not null,
  source_entity_id uuid not null,
  priority integer not null,
  risk_level public.risk_level not null default 'low',
  status public.nudge_status not null default 'candidate',
  scheduled_for timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,

  constraint nudge_candidates_priority_range
    check (priority between 0 and 100),
  constraint nudge_candidates_source_entity_type_present
    check (length(trim(source_entity_type)) > 0),
  constraint nudge_candidates_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create trigger nudge_candidates_set_updated_at
  before update on public.nudge_candidates
  for each row execute function manzana.set_updated_at();

create index if not exists nudge_candidates_user_status_scheduled_idx
  on public.nudge_candidates (user_id, status, scheduled_for);

create index if not exists nudge_candidates_user_priority_idx
  on public.nudge_candidates (user_id, priority desc, created_at desc);

create unique index if not exists nudge_candidates_user_active_source_unique_idx
  on public.nudge_candidates (user_id, type, source_entity_type, source_entity_id)
  where status in (
    'candidate'::public.nudge_status,
    'approved'::public.nudge_status,
    'deferred'::public.nudge_status,
    'scheduled'::public.nudge_status
  );

create table if not exists public.nudge_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nudge_candidate_id uuid references public.nudge_candidates(id) on delete set null,
  channel text not null,
  status public.nudge_status not null,
  sent_at timestamptz,
  delivered_at timestamptz,
  responded_at timestamptz,
  response_summary text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,

  constraint nudge_deliveries_channel_known
    check (channel in ('dashboard', 'whatsapp', 'email')),
  constraint nudge_deliveries_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists nudge_deliveries_user_created_idx
  on public.nudge_deliveries (user_id, created_at desc);

create index if not exists nudge_deliveries_candidate_idx
  on public.nudge_deliveries (nudge_candidate_id);

alter table public.nudge_preferences enable row level security;
alter table public.nudge_candidates enable row level security;
alter table public.nudge_deliveries enable row level security;

create policy "nudge_preferences: select own"
  on public.nudge_preferences for select
  using (auth.uid() = user_id);

create policy "nudge_preferences: no client write"
  on public.nudge_preferences for all
  using (false)
  with check (false);

create policy "nudge_candidates: select own"
  on public.nudge_candidates for select
  using (auth.uid() = user_id);

create policy "nudge_candidates: no client write"
  on public.nudge_candidates for all
  using (false)
  with check (false);

create policy "nudge_deliveries: select own"
  on public.nudge_deliveries for select
  using (auth.uid() = user_id);

create policy "nudge_deliveries: no client write"
  on public.nudge_deliveries for all
  using (false)
  with check (false);

grant select on public.nudge_preferences to authenticated;
grant select on public.nudge_candidates to authenticated;
grant select on public.nudge_deliveries to authenticated;

grant select, insert, update on public.nudge_preferences to service_role;
grant select, insert, update on public.nudge_candidates to service_role;
grant select, insert, update on public.nudge_deliveries to service_role;

comment on table public.nudge_candidates is
  'Avisos evaluados por politica. En V1 dashboard-only no autorizan envio externo ni escritura financiera.';

comment on index nudge_candidates_user_active_source_unique_idx is
  'Evita avisos abiertos duplicados para la misma fuente de dominio.';
