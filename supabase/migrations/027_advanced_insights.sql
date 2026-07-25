-- =============================================================
-- Migration 027: Advanced insights lifecycle
-- Deterministic signals and quality/rank, agentic framing only
-- Depends on: 001-026
-- =============================================================

create table if not exists public.insight_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.insight_type not null,
  fingerprint text not null,
  status public.insight_status not null default 'candidate',
  period_start date not null,
  period_end date not null,
  confidence numeric(5,4) not null,
  quality_score integer not null,
  rank_score integer not null,
  risk_level public.risk_level not null default 'low',
  title text not null,
  body text not null,
  evidence_text text not null,
  evidence jsonb not null default '{}'::jsonb,
  source_facts jsonb not null default '{}'::jsonb,
  source_entity_ids text[] not null default '{}'::text[],
  action jsonb,
  expires_at timestamptz,
  narrated_at timestamptz,
  displayed_at timestamptz,
  outdated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint insight_candidates_fingerprint_present
    check (length(trim(fingerprint)) > 0),
  constraint insight_candidates_period_valid
    check (period_end >= period_start),
  constraint insight_candidates_confidence_range
    check (confidence between 0 and 1),
  constraint insight_candidates_quality_range
    check (quality_score between 0 and 100),
  constraint insight_candidates_rank_range
    check (rank_score between 0 and 100),
  constraint insight_candidates_evidence_object
    check (jsonb_typeof(evidence) = 'object'),
  constraint insight_candidates_source_facts_object
    check (jsonb_typeof(source_facts) = 'object'),
  constraint insight_candidates_action_object
    check (action is null or jsonb_typeof(action) = 'object'),
  constraint insight_candidates_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create trigger insight_candidates_set_updated_at
  before update on public.insight_candidates
  for each row execute function manzana.set_updated_at();

create index if not exists insight_candidates_user_rank_idx
  on public.insight_candidates (user_id, rank_score desc, quality_score desc, created_at desc);

create index if not exists insight_candidates_user_status_expiry_idx
  on public.insight_candidates (user_id, status, expires_at);

create unique index if not exists insight_candidates_user_active_fingerprint_idx
  on public.insight_candidates (user_id, type, fingerprint)
  where status in (
    'candidate'::public.insight_status,
    'validated'::public.insight_status,
    'ranked'::public.insight_status,
    'narrated'::public.insight_status,
    'displayed'::public.insight_status
  );

create table if not exists public.insight_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  insight_candidate_id uuid references public.insight_candidates(id) on delete set null,
  channel text not null,
  status text not null,
  delivered_at timestamptz,
  seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint insight_deliveries_channel_known
    check (channel in ('dashboard', 'whatsapp')),
  constraint insight_deliveries_status_known
    check (status in ('planned', 'sent', 'delivered', 'seen', 'failed')),
  constraint insight_deliveries_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists insight_deliveries_user_created_idx
  on public.insight_deliveries (user_id, created_at desc);

create index if not exists insight_deliveries_candidate_channel_idx
  on public.insight_deliveries (insight_candidate_id, channel, created_at desc);

alter table public.insight_candidates enable row level security;
alter table public.insight_deliveries enable row level security;

create policy "insight_candidates: select own"
  on public.insight_candidates for select
  using (auth.uid() = user_id);

create policy "insight_candidates: no client write"
  on public.insight_candidates for all
  using (false)
  with check (false);

create policy "insight_deliveries: select own"
  on public.insight_deliveries for select
  using (auth.uid() = user_id);

create policy "insight_deliveries: no client write"
  on public.insight_deliveries for all
  using (false)
  with check (false);

grant select on public.insight_candidates to authenticated;
grant select on public.insight_deliveries to authenticated;

grant select, insert, update on public.insight_candidates to service_role;
grant select, insert, update on public.insight_deliveries to service_role;

comment on table public.insight_candidates is
  'Descubrimientos calculados y validados por motores deterministas. Los agentes solo pueden proponer framing y copy sobre source_facts ya filtrados.';

comment on table public.insight_deliveries is
  'Trazabilidad por canal para no repetir un descubrimiento visto o enviado y respetar limites de entrega.';

