-- =============================================================
-- Migration 026: Cross-channel dedup decisions
-- Depends on: 006, 025
-- =============================================================

create table if not exists public.dedup_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  incoming_reference_id text not null,
  incoming_source public.movement_source not null,
  fingerprint text not null,
  status text not null,
  matched_movement_id uuid references public.movements(id) on delete set null,
  score numeric(4,3) not null default 0,
  reasons text[] not null default '{}',
  requires_confirmation boolean not null default false,
  semantic_agent_used boolean not null default false,
  semantic_agent_provider text,
  semantic_agent_model text,
  trace_id uuid,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint dedup_decisions_status_known check (
    status in ('distinct', 'possible_duplicate', 'probable_duplicate', 'exact_duplicate')
  ),
  constraint dedup_decisions_score_range check (score >= 0 and score <= 1),
  constraint dedup_decisions_fingerprint_nonempty check (length(fingerprint) = 64)
);

create unique index if not exists dedup_decisions_user_incoming_unique
  on public.dedup_decisions (user_id, incoming_reference_id);

create index if not exists dedup_decisions_user_created_idx
  on public.dedup_decisions (user_id, created_at desc);

create index if not exists dedup_decisions_fingerprint_idx
  on public.dedup_decisions (user_id, fingerprint);

comment on table public.dedup_decisions is
  'Auditable outcomes from deterministic cross-channel dedup preflight. Semantic agents can add evidence but cannot merge or delete movements.';

alter table public.dedup_decisions enable row level security;

drop policy if exists "dedup_decisions: select own"
  on public.dedup_decisions;
create policy "dedup_decisions: select own"
  on public.dedup_decisions for select
  using (auth.uid() = user_id);

drop policy if exists "dedup_decisions: no client write"
  on public.dedup_decisions;
create policy "dedup_decisions: no client write"
  on public.dedup_decisions for all
  using (false)
  with check (false);

revoke all on public.dedup_decisions from anon, authenticated;
grant select on public.dedup_decisions to authenticated;
grant select, insert, update on public.dedup_decisions to service_role;

