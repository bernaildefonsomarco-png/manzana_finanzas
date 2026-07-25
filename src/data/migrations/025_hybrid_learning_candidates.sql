-- =============================================================
-- Migration 025: Hybrid learning candidates and deterministic gate
-- Depends on: 024
-- =============================================================

create table if not exists public.learning_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  canonical_key text not null,
  proposal_summary text not null,
  search_terms text[] not null default '{}',
  basis text not null,
  evidence_sources text[] not null default '{}',
  evidence_refs text[] not null default '{}',
  evidence_count integer not null default 1,
  confidence numeric(4,3) not null,
  sensitivity text not null default 'normal',
  requires_user_confirmation boolean not null default false,
  status text not null default 'observed',
  decision_reason text,
  valid_until timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint learning_candidates_kind_known check (
    kind in ('preference', 'alias', 'person_context', 'correction_pattern', 'narrative_fact')
  ),
  constraint learning_candidates_basis_known check (
    basis in ('explicit_user_statement', 'confirmed_correction', 'repeated_behavior', 'explicit_feedback')
  ),
  constraint learning_candidates_sensitivity_known check (
    sensitivity in ('normal', 'sensitive')
  ),
  constraint learning_candidates_status_known check (
    status in ('observed', 'pending_confirmation', 'accepted', 'rejected', 'superseded')
  ),
  constraint learning_candidates_confidence_range check (
    confidence >= 0 and confidence <= 1
  ),
  constraint learning_candidates_evidence_positive check (evidence_count > 0)
);

drop trigger if exists learning_candidates_set_updated_at
  on public.learning_candidates;
create trigger learning_candidates_set_updated_at
  before update on public.learning_candidates
  for each row execute function manzana.set_updated_at();

create unique index if not exists learning_candidates_user_kind_key_unique
  on public.learning_candidates (user_id, kind, canonical_key);

create index if not exists learning_candidates_user_status_updated_idx
  on public.learning_candidates (user_id, status, updated_at desc);

comment on table public.learning_candidates is
  'Candidate signals proposed by agents or deterministic detectors. Only the deterministic LearningPolicyGate can promote them to confirmed financial memory.';

alter table public.learning_candidates enable row level security;

drop policy if exists "learning_candidates: select own"
  on public.learning_candidates;
create policy "learning_candidates: select own"
  on public.learning_candidates for select
  using (auth.uid() = user_id);

drop policy if exists "learning_candidates: no client write"
  on public.learning_candidates;
create policy "learning_candidates: no client write"
  on public.learning_candidates for all
  using (false)
  with check (false);

create or replace function public.record_learning_candidate(
  p_user_id uuid,
  p_kind text,
  p_canonical_key text,
  p_proposal_summary text,
  p_search_terms text[],
  p_basis text,
  p_evidence_source text,
  p_evidence_ref text,
  p_confidence numeric,
  p_sensitivity text,
  p_requires_user_confirmation boolean,
  p_valid_until timestamptz,
  p_metadata jsonb
)
returns public.learning_candidates
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_candidate public.learning_candidates;
begin
  insert into public.learning_candidates (
    user_id,
    kind,
    canonical_key,
    proposal_summary,
    search_terms,
    basis,
    evidence_sources,
    evidence_refs,
    evidence_count,
    confidence,
    sensitivity,
    requires_user_confirmation,
    valid_until,
    metadata
  )
  values (
    p_user_id,
    p_kind,
    p_canonical_key,
    p_proposal_summary,
    coalesce(p_search_terms, '{}'),
    p_basis,
    array[p_evidence_source],
    array[p_evidence_ref],
    1,
    p_confidence,
    p_sensitivity,
    p_requires_user_confirmation,
    p_valid_until,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (user_id, kind, canonical_key)
  do update set
    proposal_summary = excluded.proposal_summary,
    search_terms = (
      select array_agg(distinct term)
      from unnest(public.learning_candidates.search_terms || excluded.search_terms) term
    ),
    evidence_sources = (
      select array_agg(distinct source)
      from unnest(public.learning_candidates.evidence_sources || excluded.evidence_sources) source
    ),
    evidence_refs = (
      select array_agg(distinct ref)
      from unnest(public.learning_candidates.evidence_refs || excluded.evidence_refs) ref
    ),
    evidence_count = case
      when excluded.evidence_refs[1] = any(public.learning_candidates.evidence_refs)
        then public.learning_candidates.evidence_count
      else public.learning_candidates.evidence_count + 1
    end,
    confidence = greatest(public.learning_candidates.confidence, excluded.confidence),
    sensitivity = case
      when public.learning_candidates.sensitivity = 'sensitive'
        or excluded.sensitivity = 'sensitive'
      then 'sensitive'
      else 'normal'
    end,
    requires_user_confirmation =
      public.learning_candidates.requires_user_confirmation
      or excluded.requires_user_confirmation,
    status = case
      when public.learning_candidates.status in ('rejected', 'superseded')
        then 'observed'
      else public.learning_candidates.status
    end,
    decision_reason = null,
    decided_at = null,
    valid_until = coalesce(excluded.valid_until, public.learning_candidates.valid_until),
    metadata = public.learning_candidates.metadata || excluded.metadata
  returning * into v_candidate;

  return v_candidate;
end;
$$;

revoke all on public.learning_candidates from anon, authenticated;
grant select on public.learning_candidates to authenticated;
grant select, insert, update on public.learning_candidates to service_role;

revoke all on function public.record_learning_candidate(
  uuid, text, text, text, text[], text, text, text, numeric, text, boolean, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.record_learning_candidate(
  uuid, text, text, text, text[], text, text, text, numeric, text, boolean, timestamptz, jsonb
) to service_role;

