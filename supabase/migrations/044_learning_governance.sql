-- =============================================================
-- Migration 044: governed, reversible and explainable learning
-- Depends on: 024, 025, 043
-- =============================================================

alter table public.learning_candidates
  drop constraint if exists learning_candidates_status_known;
alter table public.learning_candidates
  add constraint learning_candidates_status_known check (
    status in (
      'observed',
      'pending_confirmation',
      'accepted',
      'rejected',
      'superseded',
      'suspended',
      'expired'
    )
  );

alter table public.learning_candidates
  add column if not exists positive_evidence_refs text[] not null default '{}',
  add column if not exists negative_evidence_refs text[] not null default '{}',
  add column if not exists positive_evidence_count integer not null default 0,
  add column if not exists negative_evidence_count integer not null default 0,
  add column if not exists positive_evidence_weight numeric(10,4) not null default 0,
  add column if not exists negative_evidence_weight numeric(10,4) not null default 0,
  add column if not exists last_evidence_at timestamptz,
  add column if not exists last_conflict_at timestamptz,
  add column if not exists review_at timestamptz,
  add column if not exists promoted_memory_id uuid;

update public.learning_candidates
set
  positive_evidence_refs = case
    when cardinality(positive_evidence_refs) = 0 then evidence_refs
    else positive_evidence_refs
  end,
  positive_evidence_count = greatest(
    positive_evidence_count,
    evidence_count,
    cardinality(evidence_refs)
  ),
  positive_evidence_weight = greatest(
    positive_evidence_weight,
    confidence * greatest(evidence_count, 1)
  ),
  last_evidence_at = coalesce(last_evidence_at, updated_at);

alter table public.learning_candidates
  add constraint learning_candidates_evidence_counts_non_negative check (
    positive_evidence_count >= 0
    and negative_evidence_count >= 0
    and positive_evidence_weight >= 0
    and negative_evidence_weight >= 0
  );

alter table public.financial_memory_items
  add column if not exists lifecycle_status text not null default 'confirmed',
  add column if not exists positive_evidence_refs text[] not null default '{}',
  add column if not exists negative_evidence_refs text[] not null default '{}',
  add column if not exists positive_evidence_count integer not null default 0,
  add column if not exists negative_evidence_count integer not null default 0,
  add column if not exists explanation text,
  add column if not exists review_at timestamptz,
  add column if not exists last_used_at timestamptz,
  add column if not exists suspended_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_reason text,
  add column if not exists sensitive_confirmed_at timestamptz,
  add column if not exists source_candidate_id uuid,
  add column if not exists supersedes_memory_id uuid;

alter table public.financial_memory_items
  drop constraint if exists financial_memory_items_lifecycle_known;
alter table public.financial_memory_items
  add constraint financial_memory_items_lifecycle_known check (
    lifecycle_status in (
      'confirmed',
      'suspended',
      'revoked',
      'expired',
      'superseded'
    )
  );
alter table public.financial_memory_items
  add constraint financial_memory_items_evidence_counts_non_negative check (
    positive_evidence_count >= 0
    and negative_evidence_count >= 0
  );

update public.financial_memory_items
set
  lifecycle_status = case
    when confirmation_status = 'revoked' then 'revoked'
    when superseded_at is not null then 'superseded'
    when valid_until is not null and valid_until <= now() then 'expired'
    else 'confirmed'
  end,
  positive_evidence_refs = case
    when cardinality(positive_evidence_refs) = 0 then array[evidence_ref]
    else positive_evidence_refs
  end,
  positive_evidence_count = greatest(positive_evidence_count, 1),
  explanation = coalesce(
    explanation,
    'Aprendido desde evidencia confirmada: ' || evidence_source || '.'
  );

alter table public.learning_candidates
  drop constraint if exists learning_candidates_promoted_memory_id_fkey;
alter table public.learning_candidates
  add constraint learning_candidates_promoted_memory_id_fkey
  foreign key (promoted_memory_id)
  references public.financial_memory_items(id)
  on delete set null;

alter table public.financial_memory_items
  drop constraint if exists financial_memory_source_candidate_id_fkey;
alter table public.financial_memory_items
  add constraint financial_memory_source_candidate_id_fkey
  foreign key (source_candidate_id)
  references public.learning_candidates(id)
  on delete set null;

alter table public.financial_memory_items
  drop constraint if exists financial_memory_supersedes_id_fkey;
alter table public.financial_memory_items
  add constraint financial_memory_supersedes_id_fkey
  foreign key (supersedes_memory_id)
  references public.financial_memory_items(id)
  on delete set null;

drop index if exists financial_memory_items_user_active_idx;
create index financial_memory_items_user_active_idx
  on public.financial_memory_items (user_id, updated_at desc)
  where lifecycle_status = 'confirmed'
    and confirmation_status = 'confirmed'
    and superseded_at is null;

create index if not exists learning_candidates_user_review_idx
  on public.learning_candidates (user_id, review_at, updated_at desc)
  where status in ('observed', 'pending_confirmation', 'suspended');

create table if not exists public.learning_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid references public.learning_candidates(id) on delete cascade,
  memory_id uuid references public.financial_memory_items(id) on delete cascade,
  evidence_ref text not null,
  polarity text not null,
  source_type text not null,
  source_entity_type text,
  source_entity_id text,
  weight numeric(6,4) not null,
  observed_at timestamptz not null,
  claim_value jsonb,
  sensitivity text not null default 'normal',
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint learning_evidence_target_present check (
    candidate_id is not null or memory_id is not null
  ),
  constraint learning_evidence_polarity_known check (
    polarity in ('positive', 'negative')
  ),
  constraint learning_evidence_weight_range check (
    weight > 0 and weight <= 1
  ),
  constraint learning_evidence_sensitivity_known check (
    sensitivity in ('normal', 'sensitive')
  )
);

create unique index if not exists learning_evidence_candidate_ref_unique
  on public.learning_evidence (user_id, candidate_id, evidence_ref, polarity)
  where candidate_id is not null;
create unique index if not exists learning_evidence_memory_ref_unique
  on public.learning_evidence (user_id, memory_id, evidence_ref, polarity)
  where memory_id is not null;
create index if not exists learning_evidence_user_created_idx
  on public.learning_evidence (user_id, created_at desc);

create table if not exists public.learning_memory_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid references public.learning_candidates(id) on delete set null,
  memory_id uuid references public.financial_memory_items(id) on delete set null,
  event_type text not null,
  actor_type text not null,
  reason text not null,
  source_ref text,
  idempotency_key text not null,
  previous_state jsonb,
  next_state jsonb,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint learning_memory_events_type_known check (
    event_type in (
      'candidate_observed',
      'evidence_added',
      'contradiction_detected',
      'candidate_pending_confirmation',
      'candidate_accepted',
      'candidate_rejected',
      'candidate_expired',
      'memory_confirmed',
      'memory_suspended',
      'memory_corrected',
      'memory_revoked',
      'memory_expired',
      'memory_superseded',
      'learning_enabled',
      'learning_disabled'
    )
  ),
  constraint learning_memory_events_actor_known check (
    actor_type in ('user', 'policy', 'system', 'worker')
  )
);

create unique index if not exists learning_memory_events_idempotency_unique
  on public.learning_memory_events (user_id, idempotency_key);
create index if not exists learning_memory_events_user_created_idx
  on public.learning_memory_events (user_id, created_at desc);

create table if not exists public.learning_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  allow_narrative_memory boolean not null default true,
  allow_sensitive_memory boolean not null default false,
  consent_version text not null default 'learning_v1',
  updated_by text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint learning_preferences_updated_by_known check (
    updated_by in ('user', 'system', 'migration')
  )
);

drop trigger if exists learning_preferences_set_updated_at
  on public.learning_preferences;
create trigger learning_preferences_set_updated_at
  before update on public.learning_preferences
  for each row execute function manzana.set_updated_at();

alter table public.learning_evidence enable row level security;
alter table public.learning_memory_events enable row level security;
alter table public.learning_preferences enable row level security;

drop policy if exists "learning_evidence: select own"
  on public.learning_evidence;
create policy "learning_evidence: select own"
  on public.learning_evidence for select
  using (auth.uid() = user_id);
drop policy if exists "learning_evidence: no client write"
  on public.learning_evidence;
create policy "learning_evidence: no client write"
  on public.learning_evidence for all
  using (false) with check (false);

drop policy if exists "learning_memory_events: select own"
  on public.learning_memory_events;
create policy "learning_memory_events: select own"
  on public.learning_memory_events for select
  using (auth.uid() = user_id);
drop policy if exists "learning_memory_events: no client write"
  on public.learning_memory_events;
create policy "learning_memory_events: no client write"
  on public.learning_memory_events for all
  using (false) with check (false);

drop policy if exists "learning_preferences: select own"
  on public.learning_preferences;
create policy "learning_preferences: select own"
  on public.learning_preferences for select
  using (auth.uid() = user_id);
drop policy if exists "learning_preferences: no client write"
  on public.learning_preferences;
create policy "learning_preferences: no client write"
  on public.learning_preferences for all
  using (false) with check (false);

revoke all on public.learning_evidence from public, anon, authenticated;
revoke all on public.learning_memory_events from public, anon, authenticated;
revoke all on public.learning_preferences from public, anon, authenticated;
grant select on public.learning_evidence to authenticated;
grant select on public.learning_memory_events to authenticated;
grant select on public.learning_preferences to authenticated;
grant select, insert, update, delete on public.learning_evidence to service_role;
grant select, insert, update, delete on public.learning_memory_events to service_role;
grant select, insert, update on public.learning_preferences to service_role;

create or replace function public.record_learning_evidence(
  p_user_id uuid,
  p_kind text,
  p_canonical_key text,
  p_proposal_summary text,
  p_search_terms text[],
  p_basis text,
  p_evidence_source text,
  p_evidence_ref text,
  p_polarity text,
  p_evidence_weight numeric,
  p_sensitivity text,
  p_requires_user_confirmation boolean,
  p_valid_until timestamptz,
  p_source_entity_type text,
  p_source_entity_id text,
  p_claim_value jsonb,
  p_observed_at timestamptz,
  p_metadata jsonb
)
returns public.learning_candidates
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_candidate public.learning_candidates;
  v_evidence_id uuid;
  v_positive_refs text[];
  v_negative_refs text[];
  v_positive_count integer;
  v_negative_count integer;
  v_positive_weight numeric;
  v_negative_weight numeric;
  v_confidence numeric;
  v_learning_enabled boolean;
begin
  if p_polarity not in ('positive', 'negative') then
    raise exception 'LEARNING_EVIDENCE_POLARITY_INVALID';
  end if;
  if p_evidence_weight <= 0 or p_evidence_weight > 1 then
    raise exception 'LEARNING_EVIDENCE_WEIGHT_INVALID';
  end if;

  select coalesce(enabled, true)
    into v_learning_enabled
    from public.learning_preferences
   where user_id = p_user_id;
  if found and not v_learning_enabled then
    raise exception 'LEARNING_DISABLED';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_user_id::text || ':' || p_kind || ':' || p_canonical_key,
      0
    )
  );

  select *
    into v_candidate
    from public.learning_candidates
   where user_id = p_user_id
     and kind = p_kind
     and canonical_key = p_canonical_key
   for update;

  if not found then
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
      status,
      valid_until,
      review_at,
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
      p_evidence_weight,
      p_sensitivity,
      p_requires_user_confirmation,
      case when p_polarity = 'negative' then 'suspended' else 'observed' end,
      p_valid_until,
      case
        when p_valid_until is null then now() + interval '180 days'
        else least(p_valid_until, now() + interval '180 days')
      end,
      coalesce(p_metadata, '{}'::jsonb)
    )
    returning * into v_candidate;
  end if;

  insert into public.learning_evidence (
    user_id,
    candidate_id,
    evidence_ref,
    polarity,
    source_type,
    source_entity_type,
    source_entity_id,
    weight,
    observed_at,
    claim_value,
    sensitivity,
    metadata
  )
  values (
    p_user_id,
    v_candidate.id,
    p_evidence_ref,
    p_polarity,
    p_evidence_source,
    p_source_entity_type,
    p_source_entity_id,
    p_evidence_weight,
    coalesce(p_observed_at, now()),
    p_claim_value,
    p_sensitivity,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (user_id, candidate_id, evidence_ref, polarity)
    where candidate_id is not null
  do nothing
  returning id into v_evidence_id;

  if v_evidence_id is null then
    return v_candidate;
  end if;

  select
    coalesce(
      array_agg(evidence_ref order by observed_at, id)
        filter (where polarity = 'positive'),
      '{}'
    ),
    coalesce(
      array_agg(evidence_ref order by observed_at, id)
        filter (where polarity = 'negative'),
      '{}'
    ),
    count(*) filter (where polarity = 'positive'),
    count(*) filter (where polarity = 'negative'),
    coalesce(sum(weight) filter (where polarity = 'positive'), 0),
    coalesce(sum(weight) filter (where polarity = 'negative'), 0)
  into
    v_positive_refs,
    v_negative_refs,
    v_positive_count,
    v_negative_count,
    v_positive_weight,
    v_negative_weight
  from public.learning_evidence
  where candidate_id = v_candidate.id
    and user_id = p_user_id;

  v_confidence := case
    when v_positive_weight + v_negative_weight = 0 then 0
    else round(
      v_positive_weight / (v_positive_weight + v_negative_weight),
      3
    )
  end;

  update public.learning_candidates
     set proposal_summary = case
           when p_polarity = 'positive' then p_proposal_summary
           else proposal_summary
         end,
         search_terms = (
           select coalesce(array_agg(distinct term), '{}')
           from unnest(search_terms || coalesce(p_search_terms, '{}')) term
         ),
         evidence_sources = (
           select coalesce(array_agg(distinct source), '{}')
           from unnest(evidence_sources || array[p_evidence_source]) source
         ),
         evidence_refs = (
           select coalesce(array_agg(distinct ref), '{}')
           from unnest(
             v_positive_refs || v_negative_refs
           ) ref
         ),
         evidence_count = v_positive_count + v_negative_count,
         positive_evidence_refs = v_positive_refs,
         negative_evidence_refs = v_negative_refs,
         positive_evidence_count = v_positive_count,
         negative_evidence_count = v_negative_count,
         positive_evidence_weight = v_positive_weight,
         negative_evidence_weight = v_negative_weight,
         confidence = v_confidence,
         sensitivity = case
           when sensitivity = 'sensitive' or p_sensitivity = 'sensitive'
             then 'sensitive'
           else 'normal'
         end,
         requires_user_confirmation =
           requires_user_confirmation
           or p_requires_user_confirmation
           or p_sensitivity = 'sensitive',
         status = case
           when status in ('rejected', 'superseded', 'expired') then status
           when p_polarity = 'negative' then 'suspended'
           when status = 'suspended' then status
           else status
         end,
         decision_reason = case
           when p_polarity = 'negative'
             then 'contradictory_evidence_requires_resolution'
           else decision_reason
         end,
         valid_until = coalesce(p_valid_until, valid_until),
         last_evidence_at = coalesce(p_observed_at, now()),
         last_conflict_at = case
           when p_polarity = 'negative' then coalesce(p_observed_at, now())
           else last_conflict_at
         end,
         metadata = metadata || coalesce(p_metadata, '{}'::jsonb)
   where id = v_candidate.id
     and user_id = p_user_id
  returning * into v_candidate;

  insert into public.learning_memory_events (
    user_id,
    candidate_id,
    event_type,
    actor_type,
    reason,
    source_ref,
    idempotency_key,
    next_state,
    metadata
  )
  values (
    p_user_id,
    v_candidate.id,
    case
      when p_polarity = 'negative' then 'contradiction_detected'
      else 'evidence_added'
    end,
    'policy',
    case
      when p_polarity = 'negative'
        then 'Evidencia contradictoria suspendio el aprendizaje.'
      else 'Se agrego evidencia unica y trazable.'
    end,
    p_evidence_ref,
    'evidence:' || v_candidate.id::text || ':' || p_polarity || ':' ||
      encode(extensions.digest(p_evidence_ref, 'sha256'), 'hex'),
    to_jsonb(v_candidate),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (user_id, idempotency_key) do nothing;

  if p_polarity = 'negative' then
    update public.financial_memory_items
       set lifecycle_status = 'suspended',
           suspended_at = coalesce(p_observed_at, now()),
           negative_evidence_refs = (
             select coalesce(array_agg(distinct ref), '{}')
             from unnest(
               negative_evidence_refs || array[p_evidence_ref]
             ) ref
           ),
           negative_evidence_count =
             negative_evidence_count +
             case
               when p_evidence_ref = any(negative_evidence_refs) then 0
               else 1
             end,
           confidence = v_confidence,
           explanation =
             'Suspendido porque aparecio evidencia contradictoria.',
           metadata = metadata || jsonb_build_object(
             'last_contradiction_ref',
             p_evidence_ref
           )
     where user_id = p_user_id
       and kind = p_kind
       and canonical_key = p_canonical_key
       and lifecycle_status = 'confirmed';
  end if;

  return v_candidate;
end;
$$;

create or replace function public.decide_learning_candidate(
  p_user_id uuid,
  p_candidate_id uuid,
  p_status text,
  p_reason text,
  p_actor_type text,
  p_idempotency_key text
)
returns public.learning_candidates
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_candidate public.learning_candidates;
  v_previous jsonb;
begin
  if p_status not in (
    'observed',
    'pending_confirmation',
    'accepted',
    'rejected',
    'superseded',
    'suspended',
    'expired'
  ) then
    raise exception 'LEARNING_CANDIDATE_STATUS_INVALID';
  end if;
  if p_actor_type not in ('user', 'policy', 'system', 'worker') then
    raise exception 'LEARNING_ACTOR_INVALID';
  end if;

  select *
    into v_candidate
    from public.learning_candidates
   where id = p_candidate_id
     and user_id = p_user_id
   for update;
  if not found then
    raise exception 'LEARNING_CANDIDATE_NOT_FOUND';
  end if;
  v_previous := to_jsonb(v_candidate);

  if
    p_status = 'accepted'
    and (
      v_candidate.sensitivity = 'sensitive'
      or v_candidate.status = 'suspended'
    )
    and p_actor_type <> 'user'
  then
    raise exception 'LEARNING_EXPLICIT_USER_CONFIRMATION_REQUIRED';
  end if;

  if
    v_candidate.status in ('rejected', 'superseded', 'expired')
    and p_status not in ('rejected', 'superseded', 'expired')
  then
    raise exception 'LEARNING_TERMINAL_CANDIDATE_IMMUTABLE';
  end if;

  update public.learning_candidates
     set status = p_status,
         decision_reason = p_reason,
         decided_at = now()
   where id = p_candidate_id
     and user_id = p_user_id
  returning * into v_candidate;

  insert into public.learning_memory_events (
    user_id,
    candidate_id,
    event_type,
    actor_type,
    reason,
    idempotency_key,
    previous_state,
    next_state
  )
  values (
    p_user_id,
    p_candidate_id,
    case p_status
      when 'pending_confirmation' then 'candidate_pending_confirmation'
      when 'accepted' then 'candidate_accepted'
      when 'rejected' then 'candidate_rejected'
      when 'suspended' then 'contradiction_detected'
      else 'candidate_observed'
    end,
    p_actor_type,
    p_reason,
    p_idempotency_key,
    v_previous,
    to_jsonb(v_candidate)
  )
  on conflict (user_id, idempotency_key) do nothing;

  return v_candidate;
end;
$$;

create or replace function public.promote_learning_candidate(
  p_user_id uuid,
  p_candidate_id uuid,
  p_actor_type text,
  p_idempotency_key text
)
returns public.financial_memory_items
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_candidate public.learning_candidates;
  v_memory public.financial_memory_items;
  v_learning_enabled boolean := true;
  v_allow_narrative boolean := true;
  v_allow_sensitive boolean := false;
begin
  select *
    into v_candidate
    from public.learning_candidates
   where id = p_candidate_id
     and user_id = p_user_id
   for update;
  if not found then
    raise exception 'LEARNING_CANDIDATE_NOT_FOUND';
  end if;
  if v_candidate.status <> 'accepted' then
    raise exception 'LEARNING_CANDIDATE_NOT_ACCEPTED';
  end if;
  if v_candidate.positive_evidence_count < 1 then
    raise exception 'LEARNING_POSITIVE_EVIDENCE_REQUIRED';
  end if;
  select
    enabled,
    allow_narrative_memory,
    allow_sensitive_memory
    into
      v_learning_enabled,
      v_allow_narrative,
      v_allow_sensitive
    from public.learning_preferences
   where user_id = p_user_id;
  if not found then
    v_learning_enabled := true;
    v_allow_narrative := true;
    v_allow_sensitive := false;
  end if;
  if not v_learning_enabled then
    raise exception 'LEARNING_DISABLED';
  end if;
  if v_candidate.kind = 'narrative_fact' and not v_allow_narrative then
    raise exception 'LEARNING_NARRATIVE_MEMORY_DISABLED';
  end if;
  if v_candidate.sensitivity = 'sensitive' and not v_allow_sensitive then
    raise exception 'LEARNING_SENSITIVE_MEMORY_CONSENT_REQUIRED';
  end if;
  if
    (
      v_candidate.sensitivity = 'sensitive'
      or v_candidate.negative_evidence_count > 0
    )
    and p_actor_type <> 'user'
  then
    raise exception 'LEARNING_EXPLICIT_USER_CONFIRMATION_REQUIRED';
  end if;

  select *
    into v_memory
    from public.financial_memory_items
   where user_id = p_user_id
     and kind = v_candidate.kind
     and canonical_key = v_candidate.canonical_key
   for update;

  if found and v_memory.lifecycle_status in (
    'revoked',
    'superseded',
    'expired'
  ) and p_actor_type <> 'user' then
    raise exception 'LEARNING_TERMINAL_MEMORY_IMMUTABLE';
  end if;

  insert into public.financial_memory_items (
    user_id,
    kind,
    canonical_key,
    summary,
    search_terms,
    evidence_source,
    evidence_ref,
    confidence,
    confirmation_status,
    lifecycle_status,
    sensitivity,
    valid_until,
    superseded_at,
    positive_evidence_refs,
    negative_evidence_refs,
    positive_evidence_count,
    negative_evidence_count,
    explanation,
    review_at,
    suspended_at,
    revoked_at,
    revoked_reason,
    sensitive_confirmed_at,
    source_candidate_id,
    metadata
  )
  values (
    p_user_id,
    v_candidate.kind,
    v_candidate.canonical_key,
    v_candidate.proposal_summary,
    v_candidate.search_terms,
    v_candidate.basis,
    v_candidate.positive_evidence_refs[1],
    v_candidate.confidence,
    'confirmed',
    'confirmed',
    v_candidate.sensitivity,
    v_candidate.valid_until,
    null,
    v_candidate.positive_evidence_refs,
    v_candidate.negative_evidence_refs,
    v_candidate.positive_evidence_count,
    v_candidate.negative_evidence_count,
    case
      when p_actor_type = 'user'
        then 'Confirmado explicitamente por el usuario.'
      else 'Promovido por politica desde evidencia confirmada.'
    end,
    v_candidate.review_at,
    null,
    null,
    null,
    case
      when v_candidate.sensitivity = 'sensitive' then now()
      else null
    end,
    v_candidate.id,
    jsonb_build_object(
      'learning_candidate_id',
      v_candidate.id,
      'policy_reason',
      v_candidate.decision_reason
    )
  )
  on conflict (user_id, kind, canonical_key)
  do update set
    summary = excluded.summary,
    search_terms = excluded.search_terms,
    evidence_source = excluded.evidence_source,
    evidence_ref = excluded.evidence_ref,
    confidence = excluded.confidence,
    confirmation_status = 'confirmed',
    lifecycle_status = 'confirmed',
    sensitivity = excluded.sensitivity,
    valid_until = excluded.valid_until,
    superseded_at = null,
    positive_evidence_refs = excluded.positive_evidence_refs,
    negative_evidence_refs = excluded.negative_evidence_refs,
    positive_evidence_count = excluded.positive_evidence_count,
    negative_evidence_count = excluded.negative_evidence_count,
    explanation = excluded.explanation,
    review_at = excluded.review_at,
    suspended_at = null,
    revoked_at = null,
    revoked_reason = null,
    sensitive_confirmed_at = excluded.sensitive_confirmed_at,
    source_candidate_id = excluded.source_candidate_id,
    metadata = public.financial_memory_items.metadata || excluded.metadata
  returning * into v_memory;

  update public.learning_candidates
     set promoted_memory_id = v_memory.id
   where id = v_candidate.id;

  insert into public.learning_memory_events (
    user_id,
    candidate_id,
    memory_id,
    event_type,
    actor_type,
    reason,
    idempotency_key,
    next_state
  )
  values (
    p_user_id,
    v_candidate.id,
    v_memory.id,
    'memory_confirmed',
    p_actor_type,
    coalesce(
      v_candidate.decision_reason,
      'Evidencia suficiente para memoria confirmada.'
    ),
    p_idempotency_key,
    to_jsonb(v_memory)
  )
  on conflict (user_id, idempotency_key) do nothing;

  return v_memory;
end;
$$;

create or replace function public.manage_financial_memory(
  p_user_id uuid,
  p_memory_id uuid,
  p_action text,
  p_summary text,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_memory public.financial_memory_items;
  v_previous jsonb;
  v_replacement public.financial_memory_items;
  v_revision_key text;
begin
  if p_action not in ('forget', 'correct', 'suspend', 'confirm') then
    raise exception 'LEARNING_MEMORY_ACTION_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || p_memory_id::text, 0)
  );

  select *
    into v_memory
    from public.financial_memory_items
   where id = p_memory_id
     and user_id = p_user_id
   for update;
  if not found then
    raise exception 'LEARNING_MEMORY_NOT_FOUND';
  end if;
  v_previous := to_jsonb(v_memory);

  if p_action = 'forget' then
    update public.financial_memory_items
       set lifecycle_status = 'revoked',
           confirmation_status = 'revoked',
           revoked_at = now(),
           revoked_reason = coalesce(nullif(trim(p_reason), ''), 'user_forget'),
           explanation = 'Olvidado por solicitud del usuario.'
     where id = v_memory.id
    returning * into v_memory;
  elsif p_action = 'suspend' then
    update public.financial_memory_items
       set lifecycle_status = 'suspended',
           suspended_at = now(),
           explanation = coalesce(
             nullif(trim(p_reason), ''),
             'Suspendido por el usuario.'
           )
     where id = v_memory.id
    returning * into v_memory;
  elsif p_action = 'confirm' then
    if v_memory.lifecycle_status in ('revoked', 'superseded') then
      raise exception 'LEARNING_TERMINAL_MEMORY_IMMUTABLE';
    end if;
    if
      v_memory.sensitivity = 'sensitive'
      and not exists (
        select 1
          from public.learning_preferences
         where user_id = p_user_id
           and enabled
           and allow_sensitive_memory
      )
    then
      raise exception 'LEARNING_SENSITIVE_MEMORY_CONSENT_REQUIRED';
    end if;
    update public.financial_memory_items
       set lifecycle_status = 'confirmed',
           confirmation_status = 'confirmed',
           suspended_at = null,
           sensitive_confirmed_at = case
             when sensitivity = 'sensitive' then now()
             else sensitive_confirmed_at
           end,
           explanation = 'Confirmado explicitamente por el usuario.'
     where id = v_memory.id
    returning * into v_memory;
  else
    if nullif(trim(p_summary), '') is null then
      raise exception 'LEARNING_CORRECTION_SUMMARY_REQUIRED';
    end if;
    update public.financial_memory_items
       set lifecycle_status = 'superseded',
           superseded_at = now(),
           explanation = 'Sustituido por una correccion del usuario.'
     where id = v_memory.id
    returning * into v_memory;

    v_revision_key :=
      v_memory.canonical_key || ':revision:' ||
      left(
        encode(extensions.digest(p_idempotency_key, 'sha256'), 'hex'),
        16
      );
    insert into public.financial_memory_items (
      user_id,
      kind,
      canonical_key,
      summary,
      search_terms,
      evidence_source,
      evidence_ref,
      confidence,
      confirmation_status,
      lifecycle_status,
      sensitivity,
      valid_until,
      positive_evidence_refs,
      negative_evidence_refs,
      positive_evidence_count,
      negative_evidence_count,
      explanation,
      review_at,
      sensitive_confirmed_at,
      supersedes_memory_id,
      metadata
    )
    values (
      p_user_id,
      v_memory.kind,
      v_revision_key,
      trim(p_summary),
      v_memory.search_terms,
      'explicit_feedback',
      'memory-correction:' || p_idempotency_key,
      1,
      'confirmed',
      'confirmed',
      v_memory.sensitivity,
      v_memory.valid_until,
      array['memory-correction:' || p_idempotency_key],
      '{}',
      1,
      0,
      'Corregido y confirmado explicitamente por el usuario.',
      v_memory.review_at,
      case
        when v_memory.sensitivity = 'sensitive' then now()
        else null
      end,
      v_memory.id,
      jsonb_build_object(
        'corrected_from_memory_id',
        v_memory.id,
        'user_reason',
        p_reason
      )
    )
    returning * into v_replacement;

    insert into public.learning_evidence (
      user_id,
      memory_id,
      evidence_ref,
      polarity,
      source_type,
      source_entity_type,
      source_entity_id,
      weight,
      observed_at,
      claim_value,
      sensitivity,
      metadata
    )
    values (
      p_user_id,
      v_replacement.id,
      'memory-correction:' || p_idempotency_key,
      'positive',
      'explicit_feedback',
      'financial_memory_item',
      v_memory.id::text,
      1,
      now(),
      jsonb_build_object('summary', trim(p_summary)),
      v_memory.sensitivity,
      jsonb_build_object('reason', p_reason)
    )
    on conflict do nothing;
  end if;

  insert into public.learning_memory_events (
    user_id,
    memory_id,
    event_type,
    actor_type,
    reason,
    idempotency_key,
    previous_state,
    next_state,
    metadata
  )
  values (
    p_user_id,
    v_memory.id,
    case p_action
      when 'forget' then 'memory_revoked'
      when 'correct' then 'memory_corrected'
      when 'suspend' then 'memory_suspended'
      else 'memory_confirmed'
    end,
    'user',
    coalesce(nullif(trim(p_reason), ''), 'user_memory_control'),
    p_idempotency_key,
    v_previous,
    case
      when p_action = 'correct' then to_jsonb(v_replacement)
      else to_jsonb(v_memory)
    end,
    case
      when p_action = 'correct'
        then jsonb_build_object('replacement_memory_id', v_replacement.id)
      else '{}'::jsonb
    end
  )
  on conflict (user_id, idempotency_key) do nothing;

  return jsonb_build_object(
    'memory',
    to_jsonb(v_memory),
    'replacement',
    case
      when v_replacement.id is null then null
      else to_jsonb(v_replacement)
    end
  );
end;
$$;

create or replace function public.set_learning_preferences(
  p_user_id uuid,
  p_enabled boolean,
  p_allow_narrative_memory boolean,
  p_allow_sensitive_memory boolean,
  p_consent_version text,
  p_idempotency_key text
)
returns public.learning_preferences
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_preference public.learning_preferences;
begin
  insert into public.learning_preferences (
    user_id,
    enabled,
    allow_narrative_memory,
    allow_sensitive_memory,
    consent_version,
    updated_by,
    metadata
  )
  values (
    p_user_id,
    p_enabled,
    p_allow_narrative_memory,
    p_allow_sensitive_memory,
    p_consent_version,
    'user',
    jsonb_build_object('last_idempotency_key', p_idempotency_key)
  )
  on conflict (user_id)
  do update set
    enabled = excluded.enabled,
    allow_narrative_memory = excluded.allow_narrative_memory,
    allow_sensitive_memory = excluded.allow_sensitive_memory,
    consent_version = excluded.consent_version,
    updated_by = 'user',
    metadata = public.learning_preferences.metadata || excluded.metadata
  returning * into v_preference;

  if not p_enabled or not p_allow_narrative_memory or not p_allow_sensitive_memory then
    update public.financial_memory_items
       set lifecycle_status = 'suspended',
           suspended_at = now(),
           explanation =
             case
               when not p_enabled
                 then 'Suspendido porque el usuario desactivo el aprendizaje.'
               when sensitivity = 'sensitive' and not p_allow_sensitive_memory
                 then 'Suspendido porque el usuario retiro el permiso para memoria sensible.'
               when kind = 'narrative_fact' and not p_allow_narrative_memory
                 then 'Suspendido porque el usuario retiro el permiso para contexto narrativo.'
               else explanation
             end
     where user_id = p_user_id
       and lifecycle_status = 'confirmed'
       and (
         not p_enabled
         or (sensitivity = 'sensitive' and not p_allow_sensitive_memory)
         or (kind = 'narrative_fact' and not p_allow_narrative_memory)
       );
  end if;

  insert into public.learning_memory_events (
    user_id,
    event_type,
    actor_type,
    reason,
    idempotency_key,
    next_state
  )
  values (
    p_user_id,
    case when p_enabled then 'learning_enabled' else 'learning_disabled' end,
    'user',
    case
      when p_enabled then 'El usuario activo el aprendizaje.'
      else 'El usuario desactivo el aprendizaje y suspendio su uso.'
    end,
    p_idempotency_key,
    to_jsonb(v_preference)
  )
  on conflict (user_id, idempotency_key) do nothing;

  return v_preference;
end;
$$;

create or replace function public.expire_financial_learning(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_candidates integer := 0;
  v_memories integer := 0;
begin
  with expired as (
    update public.learning_candidates
       set status = 'expired',
           decision_reason = 'valid_until_elapsed',
           decided_at = p_now
     where valid_until is not null
       and valid_until <= p_now
       and status in ('observed', 'pending_confirmation', 'accepted', 'suspended')
    returning *
  ),
  events as (
    insert into public.learning_memory_events (
      user_id,
      candidate_id,
      event_type,
      actor_type,
      reason,
      idempotency_key,
      next_state
    )
    select
      user_id,
      id,
      'candidate_expired',
      'worker',
      'El candidato expiro por politica de vigencia.',
      'candidate-expired:' || id::text || ':' || p_now::text,
      to_jsonb(expired)
    from expired
    on conflict (user_id, idempotency_key) do nothing
  )
  select count(*) into v_candidates from expired;

  with expired as (
    update public.financial_memory_items
       set lifecycle_status = 'expired',
           explanation = 'Expiro por politica de vigencia.'
     where valid_until is not null
       and valid_until <= p_now
       and lifecycle_status in ('confirmed', 'suspended')
    returning *
  ),
  events as (
    insert into public.learning_memory_events (
      user_id,
      memory_id,
      event_type,
      actor_type,
      reason,
      idempotency_key,
      next_state
    )
    select
      user_id,
      id,
      'memory_expired',
      'worker',
      'La memoria llego a su fecha de expiracion.',
      'memory-expired:' || id::text || ':' || p_now::text,
      to_jsonb(expired)
    from expired
    on conflict (user_id, idempotency_key) do nothing
  )
  select count(*) into v_memories from expired;

  return jsonb_build_object(
    'expired_candidates',
    v_candidates,
    'expired_memories',
    v_memories,
    'processed_at',
    p_now
  );
end;
$$;

create or replace function public.get_learning_governance_metrics(
  p_days integer default 30
)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'window_days', greatest(1, least(coalesce(p_days, 30), 365)),
    'candidates_by_status', (
      select coalesce(jsonb_object_agg(status, total), '{}'::jsonb)
      from (
        select status, count(*)::integer as total
        from public.learning_candidates
        where created_at >= now() -
          make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)))
        group by status
      ) grouped
    ),
    'memories_by_status', (
      select coalesce(jsonb_object_agg(lifecycle_status, total), '{}'::jsonb)
      from (
        select lifecycle_status, count(*)::integer as total
        from public.financial_memory_items
        group by lifecycle_status
      ) grouped
    ),
    'events_by_type', (
      select coalesce(jsonb_object_agg(event_type, total), '{}'::jsonb)
      from (
        select event_type, count(*)::integer as total
        from public.learning_memory_events
        where created_at >= now() -
          make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)))
        group by event_type
      ) grouped
    ),
    'duplicate_evidence_rejected', (
      select greatest(
        0,
        coalesce(sum(evidence_count), 0) -
        coalesce(sum(
          positive_evidence_count + negative_evidence_count
        ), 0)
      )::integer
      from public.learning_candidates
    ),
    'generated_at', now()
  );
$$;

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
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.record_learning_evidence(
    p_user_id,
    p_kind,
    p_canonical_key,
    p_proposal_summary,
    p_search_terms,
    p_basis,
    p_evidence_source,
    p_evidence_ref,
    'positive',
    greatest(0.001, least(coalesce(p_confidence, 0.5), 1)),
    p_sensitivity,
    p_requires_user_confirmation,
    p_valid_until,
    null,
    null,
    null,
    now(),
    p_metadata
  );
$$;

revoke all on function public.record_learning_evidence(
  uuid, text, text, text, text[], text, text, text, text, numeric, text,
  boolean, timestamptz, text, text, jsonb, timestamptz, jsonb
) from public, anon, authenticated;
revoke all on function public.decide_learning_candidate(
  uuid, uuid, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.promote_learning_candidate(
  uuid, uuid, text, text
) from public, anon, authenticated;
revoke all on function public.manage_financial_memory(
  uuid, uuid, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.set_learning_preferences(
  uuid, boolean, boolean, boolean, text, text
) from public, anon, authenticated;
revoke all on function public.expire_financial_learning(timestamptz)
  from public, anon, authenticated;
revoke all on function public.get_learning_governance_metrics(integer)
  from public, anon, authenticated;

grant execute on function public.record_learning_evidence(
  uuid, text, text, text, text[], text, text, text, text, numeric, text,
  boolean, timestamptz, text, text, jsonb, timestamptz, jsonb
) to service_role;
grant execute on function public.decide_learning_candidate(
  uuid, uuid, text, text, text, text
) to service_role;
grant execute on function public.promote_learning_candidate(
  uuid, uuid, text, text
) to service_role;
grant execute on function public.manage_financial_memory(
  uuid, uuid, text, text, text, text
) to service_role;
grant execute on function public.set_learning_preferences(
  uuid, boolean, boolean, boolean, text, text
) to service_role;
grant execute on function public.expire_financial_learning(timestamptz)
  to service_role;
grant execute on function public.get_learning_governance_metrics(integer)
  to service_role;

comment on table public.learning_evidence is
  'Evidencia positiva o contradictoria, deduplicada y trazable por aprendizaje.';
comment on table public.learning_memory_events is
  'Historial append-only de decisiones, correcciones, suspensiones y olvidos.';
comment on table public.learning_preferences is
  'Control explicito del usuario sobre aprendizaje, narrativa y sensibilidad.';
comment on function public.manage_financial_memory(
  uuid, uuid, text, text, text, text
) is
  'Permite al usuario confirmar, suspender, corregir u olvidar una memoria sin borrar su historial.';
