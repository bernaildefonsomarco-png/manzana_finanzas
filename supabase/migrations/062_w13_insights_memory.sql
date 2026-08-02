-- =============================================================
-- Migration 062: W-13 Descubrimientos, Memoria y aprendizaje
-- Depends on: 027, 044, 061
-- WEB-D234..WEB-D241
-- =============================================================

-- ── Descubrimientos ───────────────────────────────────────────

alter type public.insight_type add value if not exists 'budget_risk';
alter type public.insight_type add value if not exists 'goal_pace';
alter type public.insight_type add value if not exists 'commitment_uncovered';
alter type public.insight_type add value if not exists 'merchant_pattern';

do $$ begin
  create type public.insight_feedback as enum ('util', 'no_util');
exception when duplicate_object then null;
end $$;

alter table public.insight_candidates
  add column if not exists feedback public.insight_feedback,
  add column if not exists feedback_at timestamptz;

alter table public.insight_candidates
  drop constraint if exists insight_candidates_feedback_timestamp;
alter table public.insight_candidates
  add constraint insight_candidates_feedback_timestamp check (
    (feedback is null and feedback_at is null)
    or (feedback is not null and feedback_at is not null)
  );

create index if not exists insight_candidates_user_type_feedback_idx
  on public.insight_candidates (user_id, type, feedback);

create table if not exists public.insight_feedback_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  insight_candidate_id uuid not null references public.insight_candidates(id) on delete cascade,
  insight_type public.insight_type not null,
  value public.insight_feedback not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint insight_feedback_events_idempotency_unique
    unique (user_id, idempotency_key)
);

create index if not exists insight_feedback_events_user_type_value_idx
  on public.insight_feedback_events (user_id, insight_type, value, created_at desc);

create table if not exists public.insight_type_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  insight_type public.insight_type not null,
  muted boolean not null default true,
  last_idempotency_key text not null,
  muted_at timestamptz,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key (user_id, insight_type)
);

create table if not exists public.insight_action_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  insight_candidate_id uuid references public.insight_candidates(id) on delete cascade,
  operation text not null,
  idempotency_key text not null,
  request_fingerprint text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  constraint insight_action_receipts_operation_known check (
    operation in ('seen', 'feedback', 'dismiss', 'acted', 'mute', 'unmute')
  ),
  constraint insight_action_receipts_idempotency_unique
    unique (user_id, idempotency_key)
);

-- ── Memoria en tres clases ────────────────────────────────────

do $$ begin
  create type public.memory_scope as enum ('clasificacion', 'perfil', 'preferencia');
exception when duplicate_object then null;
end $$;

create table if not exists public.user_profile_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_key text not null,
  statement text not null,
  origin text not null,
  status text not null default 'vigente',
  validity text not null default 'revisable',
  last_confirmed_at timestamptz,
  expires_at timestamptz,
  positive_evidence_refs text[] not null default '{}',
  negative_evidence_refs text[] not null default '{}',
  positive_evidence_count integer not null default 0,
  negative_evidence_count integer not null default 0,
  supersedes_fact_id uuid references public.user_profile_facts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint user_profile_facts_subject_key_present check (
    subject_key ~ '^[a-z0-9_]+:[^:[:space:]].+$'
  ),
  constraint user_profile_facts_origin_known check (
    origin in ('dicho', 'observado_confirmado')
  ),
  constraint user_profile_facts_status_known check (
    status in ('vigente', 'en_duda', 'suspendido', 'olvidado', 'caducado', 'reemplazado')
  ),
  constraint user_profile_facts_validity_known check (
    validity in ('permanente', 'revisable', 'volatil')
  ),
  constraint user_profile_facts_evidence_counts check (
    positive_evidence_count >= 0 and negative_evidence_count >= 0
    and positive_evidence_count = cardinality(positive_evidence_refs)
    and negative_evidence_count = cardinality(negative_evidence_refs)
  ),
  constraint user_profile_facts_observed_confirmed check (
    origin <> 'observado_confirmado' or last_confirmed_at is not null
  )
);

create unique index if not exists user_profile_facts_user_active_subject_idx
  on public.user_profile_facts (user_id, subject_key)
  where status in ('vigente', 'en_duda');

create table if not exists public.user_profile_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_key text not null,
  statement text not null,
  status text not null default 'observado',
  ask_count integer not null default 0,
  evidence_refs text[] not null default '{}',
  last_asked_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint user_profile_candidates_subject_key_present check (
    subject_key ~ '^[a-z0-9_]+:[^:[:space:]].+$'
  ),
  constraint user_profile_candidates_status_known check (
    status in ('observado', 'pending_confirmation', 'accepted', 'rejected', 'never_ask')
  ),
  constraint user_profile_candidates_ask_count_non_negative check (ask_count >= 0),
  constraint user_profile_candidates_evidence_present check (cardinality(evidence_refs) > 0),
  constraint user_profile_candidates_user_subject_unique unique (user_id, subject_key)
);

create table if not exists public.learned_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_module text not null,
  key text not null,
  value jsonb not null,
  status text not null default 'activa',
  observation_count integer not null default 1,
  last_observed_at timestamptz not null default now(),
  positive_evidence_refs text[] not null default '{}',
  negative_evidence_refs text[] not null default '{}',
  positive_evidence_count integer not null default 0,
  negative_evidence_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  supersedes_preference_id uuid references public.learned_preferences(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  constraint learned_preferences_status_known check (
    status in ('activa', 'olvidada', 'reemplazada')
  ),
  constraint learned_preferences_observation_positive check (observation_count > 0),
  constraint learned_preferences_evidence_counts check (
    positive_evidence_count >= 0 and negative_evidence_count >= 0
    and positive_evidence_count = cardinality(positive_evidence_refs)
    and negative_evidence_count = cardinality(negative_evidence_refs)
  )
);

create unique index if not exists learned_preferences_user_active_key_idx
  on public.learned_preferences (user_id, key)
  where status = 'activa';

create table if not exists public.memory_tombstones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope public.memory_scope not null,
  subject_key text not null,
  reason text,
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by text,
  metadata jsonb not null default '{}'::jsonb,
  constraint memory_tombstones_subject_key_present check (length(trim(subject_key)) > 2),
  constraint memory_tombstones_lift_pair check (
    (lifted_at is null and lifted_by is null)
    or (lifted_at is not null and lifted_by is not null)
  )
);

create unique index if not exists memory_tombstones_user_active_subject_idx
  on public.memory_tombstones (user_id, scope, subject_key)
  where lifted_at is null;

create table if not exists public.memory_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope public.memory_scope not null,
  subject_id uuid not null,
  subject_key text not null,
  action text not null,
  previous jsonb,
  next jsonb,
  actor text not null,
  idempotency_key text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint memory_events_action_known check (
    action in ('visto', 'corregido', 'deshecho', 'olvidado', 'suspendido', 'restaurado', 'aplicado', 'confirmado', 'rechazado', 'caducado')
  ),
  constraint memory_events_actor_known check (actor in ('usuario', 'sistema'))
);

create unique index if not exists memory_events_user_idempotency_idx
  on public.memory_events (user_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists memory_events_user_created_idx
  on public.memory_events (user_id, created_at desc);

create table if not exists public.memory_operation_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  request_fingerprint text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  constraint memory_operation_receipts_user_key_unique unique (user_id, idempotency_key)
);

-- ── Operaciones masivas de clasificación heredadas por W-13 ──

create table if not exists public.classification_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  status text not null default 'committed',
  source_subcategory_id uuid references public.user_subcategories(id) on delete set null,
  target_subcategory_id uuid references public.user_subcategories(id) on delete set null,
  target_category_id text references public.categories(id),
  movement_changes jsonb not null,
  movement_count integer not null,
  idempotency_key text not null,
  undo_until timestamptz not null,
  created_at timestamptz not null default now(),
  undone_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint classification_batches_kind_known check (kind in ('bulk', 'merge')),
  constraint classification_batches_status_known check (status in ('committed', 'undone')),
  constraint classification_batches_count_non_negative check (movement_count >= 0),
  constraint classification_batches_changes_array check (jsonb_typeof(movement_changes) = 'array'),
  constraint classification_batches_user_key_unique unique (user_id, idempotency_key)
);

create table if not exists public.classification_action_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  movement_id uuid references public.movements(id) on delete set null,
  operation text not null,
  idempotency_key text not null,
  request_fingerprint text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  constraint classification_action_receipts_operation_known check (
    operation in ('classify_movement')
  ),
  constraint classification_action_receipts_key_present check (
    length(trim(idempotency_key)) between 8 and 180
  ),
  constraint classification_action_receipts_user_key_unique unique (user_id, idempotency_key)
);

-- ── RLS ──────────────────────────────────────────────────────

alter table public.insight_feedback_events enable row level security;
alter table public.insight_type_preferences enable row level security;
alter table public.insight_action_receipts enable row level security;
alter table public.user_profile_facts enable row level security;
alter table public.user_profile_candidates enable row level security;
alter table public.learned_preferences enable row level security;
alter table public.memory_tombstones enable row level security;
alter table public.memory_events enable row level security;
alter table public.memory_operation_receipts enable row level security;
alter table public.classification_batches enable row level security;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'insight_feedback_events', 'insight_type_preferences', 'insight_action_receipts',
    'user_profile_facts', 'user_profile_candidates', 'learned_preferences',
    'memory_tombstones', 'memory_events', 'memory_operation_receipts',
    'classification_batches', 'classification_action_receipts'
  ] loop
    execute format('drop policy if exists %I on public.%I', v_table || ': select own', v_table);
    execute format(
      'create policy %I on public.%I for select using (auth.uid() = user_id)',
      v_table || ': select own', v_table
    );
    execute format('drop policy if exists %I on public.%I', v_table || ': no client write', v_table);
    execute format(
      'create policy %I on public.%I for all using (false) with check (false)',
      v_table || ': no client write', v_table
    );
    execute format('revoke all on public.%I from public, anon, authenticated', v_table);
    execute format('grant select on public.%I to authenticated', v_table);
    execute format('grant select, insert, update, delete on public.%I to service_role', v_table);
  end loop;
end $$;

-- ── Validación de atributos protegidos ───────────────────────

create or replace function public.reject_protected_profile_subject()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if lower(new.subject_key) ~ '^(salud|ideologia|religion|orientacion)(:|_)' then
    raise exception 'MEMORY_PROTECTED_ATTRIBUTE_REJECTED';
  end if;
  return new;
end;
$$;

drop trigger if exists user_profile_facts_reject_protected on public.user_profile_facts;
create trigger user_profile_facts_reject_protected
  before insert or update on public.user_profile_facts
  for each row execute function public.reject_protected_profile_subject();

drop trigger if exists user_profile_candidates_reject_protected on public.user_profile_candidates;
create trigger user_profile_candidates_reject_protected
  before insert or update on public.user_profile_candidates
  for each row execute function public.reject_protected_profile_subject();

-- Una lápida solo se levanta desde una corrección confirmada explícita.
create or replace function public.guard_learning_candidate_tombstone()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.memory_tombstones t
     where t.user_id = new.user_id
       and t.scope = 'clasificacion'
       and t.subject_key = new.canonical_key
       and t.lifted_at is null
  ) then
    if new.basis = 'confirmed_correction' then
      update public.memory_tombstones
         set lifted_at = now(), lifted_by = 'accion_explicita_del_usuario'
       where user_id = new.user_id
         and scope = 'clasificacion'
         and subject_key = new.canonical_key
         and lifted_at is null;
    else
      raise exception 'MEMORY_TOMBSTONED';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists learning_candidates_guard_tombstone on public.learning_candidates;
create trigger learning_candidates_guard_tombstone
  before insert or update on public.learning_candidates
  for each row execute function public.guard_learning_candidate_tombstone();

create or replace function public.guard_profile_candidate_tombstone()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.memory_tombstones t
     where t.user_id = new.user_id and t.scope = 'perfil'
       and t.subject_key = new.subject_key and t.lifted_at is null
  ) then
    raise exception 'MEMORY_TOMBSTONED';
  end if;
  return new;
end;
$$;

drop trigger if exists user_profile_candidates_guard_tombstone on public.user_profile_candidates;
create trigger user_profile_candidates_guard_tombstone
  before insert on public.user_profile_candidates
  for each row execute function public.guard_profile_candidate_tombstone();

create or replace function public.guard_profile_fact_tombstone()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.memory_tombstones t
     where t.user_id = new.user_id and t.scope = 'perfil'
       and t.subject_key = new.subject_key and t.lifted_at is null
  ) then
    if new.origin = 'dicho' and coalesce((new.metadata->>'explicit_user_action')::boolean, false) then
      update public.memory_tombstones set
        lifted_at = now(), lifted_by = 'accion_explicita_del_usuario'
       where user_id = new.user_id and scope = 'perfil'
         and subject_key = new.subject_key and lifted_at is null;
    else
      raise exception 'MEMORY_TOMBSTONED';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists user_profile_facts_guard_tombstone on public.user_profile_facts;
create trigger user_profile_facts_guard_tombstone
  before insert on public.user_profile_facts
  for each row execute function public.guard_profile_fact_tombstone();

create or replace function public.guard_learned_preference_tombstone()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'activa' and exists (
    select 1 from public.memory_tombstones t
     where t.user_id = new.user_id and t.scope = 'preferencia'
       and t.subject_key = new.key and t.lifted_at is null
  ) then
    if coalesce((new.metadata->>'explicit_user_action')::boolean, false) then
      update public.memory_tombstones set
        lifted_at = now(), lifted_by = 'accion_explicita_del_usuario'
       where user_id = new.user_id and scope = 'preferencia'
         and subject_key = new.key and lifted_at is null;
    else
      raise exception 'MEMORY_TOMBSTONED';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists learned_preferences_guard_tombstone on public.learned_preferences;
create trigger learned_preferences_guard_tombstone
  before insert on public.learned_preferences
  for each row execute function public.guard_learned_preference_tombstone();

-- ── RPC atómico de interacciones de Descubrimientos ──────────

create or replace function public.commit_insight_action(
  p_user_id uuid,
  p_insight_id uuid,
  p_operation text,
  p_value text,
  p_idempotency_key text,
  p_trace_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_insight public.insight_candidates;
  v_receipt jsonb;
  v_existing_fingerprint text;
  v_request_fingerprint text;
  v_now timestamptz := now();
  v_delivery_id uuid;
  v_result jsonb;
begin
  if p_operation not in ('seen', 'feedback', 'dismiss', 'acted') then
    raise exception 'INSIGHT_OPERATION_INVALID';
  end if;
  if auth.uid() is distinct from p_user_id then
    raise exception 'INSIGHT_NOT_FOUND';
  end if;
  if nullif(trim(p_idempotency_key), '') is null then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  v_request_fingerprint := encode(extensions.digest(
    p_insight_id::text || ':' || p_operation || ':' || coalesce(p_value, ''),
    'sha256'
  ), 'hex');

  select response, request_fingerprint into v_receipt, v_existing_fingerprint
    from public.insight_action_receipts
   where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing_fingerprint <> v_request_fingerprint then
      raise exception 'INSIGHT_IDEMPOTENCY_CONFLICT';
    end if;
    return v_receipt || jsonb_build_object('idempotent', true);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_insight_id::text, 0));
  select * into v_insight
    from public.insight_candidates
   where id = p_insight_id and user_id = p_user_id
   for update;
  if not found then
    raise exception 'INSIGHT_NOT_FOUND';
  end if;

  if p_operation = 'seen' then
    update public.insight_candidates
       set status = case when status = 'narrated' then 'displayed' else status end,
           displayed_at = coalesce(displayed_at, v_now),
           metadata = metadata || jsonb_build_object('last_seen_at', v_now, 'trace_id', p_trace_id)
     where id = v_insight.id
     returning * into v_insight;

    select id into v_delivery_id
      from public.insight_deliveries
     where user_id = p_user_id
       and insight_candidate_id = p_insight_id
       and channel = 'dashboard'
     order by created_at desc limit 1
     for update;
    if v_delivery_id is null then
      insert into public.insight_deliveries (
        user_id, insight_candidate_id, channel, status,
        delivered_at, seen_at, metadata
      ) values (
        p_user_id, p_insight_id, 'dashboard', 'seen',
        v_now, v_now, jsonb_build_object('surface', 'descubrimientos', 'trace_id', p_trace_id)
      );
    else
      update public.insight_deliveries
         set status = 'seen', delivered_at = coalesce(delivered_at, v_now),
             seen_at = coalesce(seen_at, v_now),
             metadata = metadata || jsonb_build_object('trace_id', p_trace_id)
       where id = v_delivery_id;
    end if;
  elsif p_operation = 'feedback' then
    if p_value not in ('util', 'no_util') then
      raise exception 'INSIGHT_FEEDBACK_INVALID';
    end if;
    update public.insight_candidates
       set feedback = p_value::public.insight_feedback,
           feedback_at = v_now,
           metadata = metadata || jsonb_build_object('trace_id', p_trace_id)
     where id = v_insight.id
     returning * into v_insight;
    insert into public.insight_feedback_events (
      user_id, insight_candidate_id, insight_type, value,
      idempotency_key, metadata
    ) values (
      p_user_id, p_insight_id, v_insight.type,
      p_value::public.insight_feedback, p_idempotency_key,
      jsonb_build_object('trace_id', p_trace_id)
    );
  elsif p_operation = 'dismiss' then
    update public.insight_candidates
       set status = case when status in ('expired', 'dismissed') then status else 'dismissed' end,
           metadata = metadata || jsonb_build_object(
             'dismissed_at', v_now, 'dismiss_reason', nullif(trim(p_value), ''), 'trace_id', p_trace_id
           )
     where id = v_insight.id
     returning * into v_insight;
  else
    update public.insight_candidates
       set status = case when status in ('expired', 'dismissed') then status else 'acted' end,
           metadata = metadata || jsonb_build_object(
             'acted_at', v_now, 'action_key', nullif(trim(p_value), ''), 'trace_id', p_trace_id
           )
     where id = v_insight.id
     returning * into v_insight;
  end if;

  v_result := jsonb_build_object(
    'insight', to_jsonb(v_insight),
    'idempotent', false
  );
  insert into public.insight_action_receipts (
    user_id, insight_candidate_id, operation, idempotency_key,
    request_fingerprint, response
  ) values (
    p_user_id, p_insight_id, p_operation, p_idempotency_key,
    v_request_fingerprint, v_result
  );
  return v_result;
end;
$$;

create or replace function public.set_insight_type_muted(
  p_user_id uuid,
  p_insight_type public.insight_type,
  p_muted boolean,
  p_idempotency_key text,
  p_trace_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_receipt jsonb;
  v_request_fingerprint text;
  v_existing_fingerprint text;
  v_row public.insight_type_preferences;
  v_operation text := case when p_muted then 'mute' else 'unmute' end;
  v_result jsonb;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'INSIGHT_NOT_FOUND';
  end if;
  if nullif(trim(p_idempotency_key), '') is null then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  v_request_fingerprint := encode(extensions.digest(
    p_insight_type::text || ':' || p_muted::text,
    'sha256'
  ), 'hex');
  select response, request_fingerprint into v_receipt, v_existing_fingerprint
    from public.insight_action_receipts
   where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing_fingerprint <> v_request_fingerprint then
      raise exception 'INSIGHT_IDEMPOTENCY_CONFLICT';
    end if;
    return v_receipt || jsonb_build_object('idempotent', true);
  end if;

  insert into public.insight_type_preferences (
    user_id, insight_type, muted, last_idempotency_key, muted_at, updated_at, metadata
  ) values (
    p_user_id, p_insight_type, p_muted, p_idempotency_key,
    case when p_muted then now() else null end, now(),
    jsonb_build_object('trace_id', p_trace_id)
  )
  on conflict (user_id, insight_type) do update set
    muted = excluded.muted,
    last_idempotency_key = excluded.last_idempotency_key,
    muted_at = excluded.muted_at,
    updated_at = excluded.updated_at,
    metadata = public.insight_type_preferences.metadata || excluded.metadata
  returning * into v_row;

  v_result := jsonb_build_object('preference', to_jsonb(v_row), 'idempotent', false);
  insert into public.insight_action_receipts (
    user_id, insight_candidate_id, operation, idempotency_key,
    request_fingerprint, response
  ) values (
    p_user_id, null, v_operation, p_idempotency_key,
    v_request_fingerprint, v_result
  );
  return v_result;
end;
$$;

-- ── RPC atómico de Memoria clasificatoria ────────────────────

create or replace function public.commit_financial_memory_operation(
  p_user_id uuid,
  p_memory_id uuid,
  p_operation text,
  p_summary text,
  p_reason text,
  p_idempotency_key text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_receipt jsonb;
  v_existing_fingerprint text;
  v_request_fingerprint text;
  v_memory public.financial_memory_items;
  v_previous jsonb;
  v_replacement public.financial_memory_items;
  v_event public.memory_events;
  v_original_id uuid;
  v_revision_key text;
  v_result jsonb;
begin
  if p_operation not in ('forget', 'correct', 'undo', 'reactivate', 'view') then
    raise exception 'MEMORY_OPERATION_INVALID';
  end if;
  if auth.uid() is distinct from p_user_id then
    raise exception 'MEMORY_NOT_FOUND';
  end if;
  if nullif(trim(p_idempotency_key), '') is null then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  v_request_fingerprint := encode(extensions.digest(
    p_memory_id::text || ':' || p_operation || ':' || coalesce(p_summary, '') || ':' || coalesce(p_reason, ''),
    'sha256'
  ), 'hex');
  select response, request_fingerprint into v_receipt, v_existing_fingerprint
    from public.memory_operation_receipts
   where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing_fingerprint <> v_request_fingerprint then raise exception 'MEMORY_IDEMPOTENCY_CONFLICT'; end if;
    return v_receipt || jsonb_build_object('idempotent', true);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_memory_id::text, 0));
  select * into v_memory
    from public.financial_memory_items
   where id = p_memory_id and user_id = p_user_id
   for update;
  if not found then raise exception 'MEMORY_NOT_FOUND'; end if;
  v_previous := to_jsonb(v_memory);

  if p_operation = 'view' then
    insert into public.memory_events (
      user_id, scope, subject_id, subject_key, action, previous, next,
      actor, idempotency_key, metadata
    ) values (
      p_user_id, 'clasificacion', v_memory.id, v_memory.canonical_key,
      'visto', v_previous, v_previous, 'usuario', p_idempotency_key, '{}'::jsonb
    ) returning * into v_event;
  elsif p_operation = 'forget' then
    update public.financial_memory_items set
      lifecycle_status = 'revoked', confirmation_status = 'revoked',
      revoked_at = p_now,
      revoked_reason = coalesce(nullif(trim(p_reason), ''), 'user_forget'),
      explanation = 'Olvidado por solicitud del usuario.'
    where id = v_memory.id returning * into v_memory;

    insert into public.memory_tombstones (user_id, scope, subject_key, reason)
    values (
      p_user_id, 'clasificacion', v_memory.canonical_key,
      coalesce(nullif(trim(p_reason), ''), 'user_forget')
    ) on conflict (user_id, scope, subject_key) where lifted_at is null
      do update set reason = excluded.reason;

    insert into public.memory_events (
      user_id, scope, subject_id, subject_key, action, previous, next,
      actor, idempotency_key, metadata
    ) values (
      p_user_id, 'clasificacion', v_memory.id, v_memory.canonical_key,
      'olvidado', v_previous, to_jsonb(v_memory), 'usuario', p_idempotency_key,
      jsonb_build_object('undo_until', p_now + interval '30 days')
    ) returning * into v_event;
  elsif p_operation = 'correct' then
    if nullif(trim(p_summary), '') is null then
      raise exception 'MEMORY_CORRECTION_SUMMARY_REQUIRED';
    end if;
    if v_memory.lifecycle_status = 'revoked' then
      raise exception 'MEMORY_REVOKED_IMMUTABLE';
    end if;
    v_revision_key := v_memory.canonical_key || ':superseded:' ||
      left(encode(extensions.digest(p_idempotency_key, 'sha256'), 'hex'), 16);
    update public.financial_memory_items set
      canonical_key = v_revision_key,
      lifecycle_status = 'superseded', superseded_at = p_now,
      explanation = 'Sustituido por una corrección del usuario.'
    where id = v_memory.id returning * into v_memory;

    insert into public.financial_memory_items (
      user_id, kind, canonical_key, summary, search_terms,
      evidence_source, evidence_ref, confidence, confirmation_status,
      lifecycle_status, sensitivity, valid_until,
      positive_evidence_refs, negative_evidence_refs,
      positive_evidence_count, negative_evidence_count,
      explanation, review_at, sensitive_confirmed_at,
      supersedes_memory_id, metadata
    ) values (
      p_user_id, v_memory.kind, v_previous->>'canonical_key', trim(p_summary), v_memory.search_terms,
      'explicit_feedback', 'memory-correction:' || p_idempotency_key, 1,
      'confirmed', 'confirmed', v_memory.sensitivity, v_memory.valid_until,
      array['memory-correction:' || p_idempotency_key], '{}', 1, 0,
      'Corregido y confirmado explícitamente por el usuario.', v_memory.review_at,
      case when v_memory.sensitivity = 'sensitive' then p_now else null end,
      v_memory.id, jsonb_build_object('corrected_from_memory_id', v_memory.id)
    ) returning * into v_replacement;

    insert into public.memory_events (
      user_id, scope, subject_id, subject_key, action, previous, next,
      actor, idempotency_key, metadata
    ) values (
      p_user_id, 'clasificacion', v_replacement.id, v_previous->>'canonical_key',
      'corregido', v_previous, to_jsonb(v_replacement), 'usuario', p_idempotency_key,
      jsonb_build_object(
        'original_memory_id', v_memory.id,
        'replacement_memory_id', v_replacement.id,
        'undo_until', p_now + interval '30 days'
      )
    ) returning * into v_event;
  elsif p_operation = 'reactivate' then
    if v_memory.lifecycle_status not in ('suspended', 'expired') then
      raise exception 'MEMORY_NOT_REACTIVATABLE';
    end if;
    update public.financial_memory_items set
      lifecycle_status = 'confirmed', confirmation_status = 'confirmed',
      suspended_at = null, explanation = 'Restaurado por el usuario.'
    where id = v_memory.id returning * into v_memory;
    insert into public.memory_events (
      user_id, scope, subject_id, subject_key, action, previous, next,
      actor, idempotency_key, metadata
    ) values (
      p_user_id, 'clasificacion', v_memory.id, v_memory.canonical_key,
      'restaurado', v_previous, to_jsonb(v_memory), 'usuario', p_idempotency_key, '{}'::jsonb
    ) returning * into v_event;
  else
    select * into v_event
      from public.memory_events
     where user_id = p_user_id
       and subject_id = p_memory_id
       and action in ('olvidado', 'corregido')
     order by created_at desc limit 1
     for update;
    if not found then raise exception 'MEMORY_UNDO_NOT_FOUND'; end if;
    if coalesce(
      nullif(v_event.metadata->>'undo_until', '')::timestamptz,
      v_event.created_at + interval '30 days'
    ) < p_now then
      raise exception 'MEMORY_UNDO_WINDOW_EXPIRED';
    end if;

    if v_event.action = 'olvidado' then
      update public.financial_memory_items set
        lifecycle_status = coalesce(v_event.previous->>'lifecycle_status', 'confirmed'),
        confirmation_status = coalesce(v_event.previous->>'confirmation_status', 'confirmed'),
        revoked_at = null, revoked_reason = null,
        explanation = v_event.previous->>'explanation'
      where id = p_memory_id returning * into v_memory;
      update public.memory_tombstones set
        lifted_at = p_now, lifted_by = 'deshacer_del_usuario'
      where user_id = p_user_id and scope = 'clasificacion'
        and subject_key = v_event.subject_key and lifted_at is null;
    else
      v_original_id := nullif(v_event.metadata->>'original_memory_id', '')::uuid;
      if v_original_id is null then raise exception 'MEMORY_UNDO_STATE_INVALID'; end if;
      update public.financial_memory_items set
        canonical_key = canonical_key || ':undone:' ||
          left(encode(extensions.digest(p_idempotency_key, 'sha256'), 'hex'), 16),
        lifecycle_status = 'superseded', superseded_at = p_now
      where id = p_memory_id;
      update public.financial_memory_items set
        canonical_key = v_event.subject_key,
        lifecycle_status = 'confirmed', confirmation_status = 'confirmed',
        superseded_at = null, explanation = v_event.previous->>'explanation'
      where id = v_original_id and user_id = p_user_id returning * into v_memory;
    end if;
    insert into public.memory_events (
      user_id, scope, subject_id, subject_key, action, previous, next,
      actor, idempotency_key, metadata
    ) values (
      p_user_id, 'clasificacion', v_memory.id, v_event.subject_key,
      'deshecho', to_jsonb(v_event), to_jsonb(v_memory), 'usuario',
      p_idempotency_key, jsonb_build_object('undid_event_id', v_event.id)
    ) returning * into v_event;
  end if;

  v_result := jsonb_build_object(
    'memory', to_jsonb(v_memory),
    'replacement', case when v_replacement.id is null then null else to_jsonb(v_replacement) end,
    'event', to_jsonb(v_event),
    'idempotent', false
  );
  insert into public.memory_operation_receipts (user_id, idempotency_key, request_fingerprint, response)
  values (p_user_id, p_idempotency_key, v_request_fingerprint, v_result);
  return v_result;
end;
$$;

-- Perfil y preferencias usan comandos separados porque sus estados y datos
-- no son intercambiables con una regla clasificatoria (WEB-D235/D240).
create or replace function public.commit_profile_memory_operation(
  p_user_id uuid,
  p_fact_id uuid,
  p_operation text,
  p_statement text,
  p_reason text,
  p_idempotency_key text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_receipt jsonb;
  v_existing_fingerprint text;
  v_request_fingerprint text;
  v_fact public.user_profile_facts;
  v_previous jsonb;
  v_replacement public.user_profile_facts;
  v_event public.memory_events;
  v_original_id uuid;
  v_result jsonb;
begin
  if p_operation not in ('forget', 'correct', 'undo', 'reactivate', 'view') then
    raise exception 'MEMORY_OPERATION_INVALID';
  end if;
  if auth.uid() is distinct from p_user_id then raise exception 'MEMORY_NOT_FOUND'; end if;
  if nullif(trim(p_idempotency_key), '') is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  v_request_fingerprint := encode(extensions.digest(
    p_fact_id::text || ':' || p_operation || ':' || coalesce(p_statement, '') || ':' || coalesce(p_reason, ''),
    'sha256'
  ), 'hex');
  select response, request_fingerprint into v_receipt, v_existing_fingerprint from public.memory_operation_receipts
   where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing_fingerprint <> v_request_fingerprint then raise exception 'MEMORY_IDEMPOTENCY_CONFLICT'; end if;
    return v_receipt || jsonb_build_object('idempotent', true);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_fact_id::text, 0));
  select * into v_fact from public.user_profile_facts
   where id = p_fact_id and user_id = p_user_id for update;
  if not found then raise exception 'MEMORY_NOT_FOUND'; end if;
  v_previous := to_jsonb(v_fact);

  if p_operation = 'view' then
    insert into public.memory_events (
      user_id, scope, subject_id, subject_key, action, previous, next,
      actor, idempotency_key, metadata
    ) values (
      p_user_id, 'perfil', v_fact.id, v_fact.subject_key, 'visto',
      v_previous, v_previous, 'usuario', p_idempotency_key, '{}'::jsonb
    ) returning * into v_event;
  elsif p_operation = 'forget' then
    if v_fact.status = 'olvidado' then raise exception 'MEMORY_REVOKED_IMMUTABLE'; end if;
    update public.user_profile_facts set
      status = 'olvidado', updated_at = p_now,
      metadata = metadata || jsonb_build_object(
        'forgotten_at', p_now,
        'forgotten_reason', coalesce(nullif(trim(p_reason), ''), 'user_forget')
      )
    where id = v_fact.id returning * into v_fact;
    insert into public.memory_tombstones (user_id, scope, subject_key, reason)
    values (
      p_user_id, 'perfil', v_fact.subject_key,
      coalesce(nullif(trim(p_reason), ''), 'user_forget')
    ) on conflict (user_id, scope, subject_key) where lifted_at is null
      do update set reason = excluded.reason;
    insert into public.memory_events (
      user_id, scope, subject_id, subject_key, action, previous, next,
      actor, idempotency_key, metadata
    ) values (
      p_user_id, 'perfil', v_fact.id, v_fact.subject_key, 'olvidado',
      v_previous, to_jsonb(v_fact), 'usuario', p_idempotency_key,
      jsonb_build_object('undo_until', p_now + interval '30 days')
    ) returning * into v_event;
  elsif p_operation = 'correct' then
    if nullif(trim(p_statement), '') is null then raise exception 'MEMORY_CORRECTION_SUMMARY_REQUIRED'; end if;
    if v_fact.status = 'olvidado' then raise exception 'MEMORY_REVOKED_IMMUTABLE'; end if;
    update public.user_profile_facts set
      status = 'reemplazado', updated_at = p_now
    where id = v_fact.id returning * into v_fact;
    insert into public.user_profile_facts (
      user_id, subject_key, statement, origin, status, validity,
      last_confirmed_at, expires_at,
      positive_evidence_refs, negative_evidence_refs,
      positive_evidence_count, negative_evidence_count,
      supersedes_fact_id, metadata
    ) values (
      p_user_id, v_fact.subject_key, trim(p_statement), 'dicho', 'vigente',
      v_fact.validity, p_now, v_fact.expires_at,
      array['memory-correction:' || p_idempotency_key], '{}', 1, 0, v_fact.id,
      v_fact.metadata || jsonb_build_object(
        'corrected_from_fact_id', v_fact.id,
        'explicit_user_action', true
      )
    ) returning * into v_replacement;
    insert into public.memory_events (
      user_id, scope, subject_id, subject_key, action, previous, next,
      actor, idempotency_key, metadata
    ) values (
      p_user_id, 'perfil', v_replacement.id, v_fact.subject_key, 'corregido',
      v_previous, to_jsonb(v_replacement), 'usuario', p_idempotency_key,
      jsonb_build_object(
        'original_memory_id', v_fact.id,
        'replacement_memory_id', v_replacement.id,
        'undo_until', p_now + interval '30 days'
      )
    ) returning * into v_event;
  elsif p_operation = 'reactivate' then
    if v_fact.status not in ('suspendido', 'caducado') then raise exception 'MEMORY_NOT_REACTIVATABLE'; end if;
    update public.user_profile_facts set status = 'vigente', updated_at = p_now
     where id = v_fact.id returning * into v_fact;
    insert into public.memory_events (
      user_id, scope, subject_id, subject_key, action, previous, next,
      actor, idempotency_key, metadata
    ) values (
      p_user_id, 'perfil', v_fact.id, v_fact.subject_key, 'restaurado',
      v_previous, to_jsonb(v_fact), 'usuario', p_idempotency_key, '{}'::jsonb
    ) returning * into v_event;
  else
    select * into v_event from public.memory_events
     where user_id = p_user_id and scope = 'perfil' and subject_id = p_fact_id
       and action in ('olvidado', 'corregido')
     order by created_at desc limit 1 for update;
    if not found then raise exception 'MEMORY_UNDO_NOT_FOUND'; end if;
    if coalesce(
      nullif(v_event.metadata->>'undo_until', '')::timestamptz,
      v_event.created_at + interval '30 days'
    ) < p_now then raise exception 'MEMORY_UNDO_WINDOW_EXPIRED'; end if;
    if v_event.action = 'olvidado' then
      update public.user_profile_facts set
        status = coalesce(v_event.previous->>'status', 'vigente'),
        updated_at = p_now,
        metadata = coalesce(v_event.previous->'metadata', '{}'::jsonb)
      where id = p_fact_id returning * into v_fact;
      update public.memory_tombstones set lifted_at = p_now, lifted_by = 'deshacer_del_usuario'
       where user_id = p_user_id and scope = 'perfil'
         and subject_key = v_event.subject_key and lifted_at is null;
    else
      v_original_id := nullif(v_event.metadata->>'original_memory_id', '')::uuid;
      if v_original_id is null then raise exception 'MEMORY_UNDO_STATE_INVALID'; end if;
      update public.user_profile_facts set status = 'reemplazado', updated_at = p_now
       where id = p_fact_id;
      update public.user_profile_facts set
        status = coalesce(v_event.previous->>'status', 'vigente'),
        updated_at = p_now,
        metadata = coalesce(v_event.previous->'metadata', '{}'::jsonb)
      where id = v_original_id and user_id = p_user_id returning * into v_fact;
    end if;
    insert into public.memory_events (
      user_id, scope, subject_id, subject_key, action, previous, next,
      actor, idempotency_key, metadata
    ) values (
      p_user_id, 'perfil', v_fact.id, v_event.subject_key, 'deshecho',
      to_jsonb(v_event), to_jsonb(v_fact), 'usuario', p_idempotency_key,
      jsonb_build_object('undid_event_id', v_event.id)
    ) returning * into v_event;
  end if;

  v_result := jsonb_build_object(
    'memory', to_jsonb(v_fact),
    'replacement', case when v_replacement.id is null then null else to_jsonb(v_replacement) end,
    'event', to_jsonb(v_event), 'scope', 'perfil', 'idempotent', false
  );
  insert into public.memory_operation_receipts (user_id, idempotency_key, request_fingerprint, response)
  values (p_user_id, p_idempotency_key, v_request_fingerprint, v_result);
  return v_result;
end;
$$;

create or replace function public.commit_preference_memory_operation(
  p_user_id uuid,
  p_preference_id uuid,
  p_operation text,
  p_value jsonb,
  p_reason text,
  p_idempotency_key text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_receipt jsonb;
  v_existing_fingerprint text;
  v_request_fingerprint text;
  v_preference public.learned_preferences;
  v_previous jsonb;
  v_replacement public.learned_preferences;
  v_event public.memory_events;
  v_original_id uuid;
  v_result jsonb;
begin
  if p_operation not in ('forget', 'correct', 'undo', 'reactivate', 'view') then
    raise exception 'MEMORY_OPERATION_INVALID';
  end if;
  if auth.uid() is distinct from p_user_id then raise exception 'MEMORY_NOT_FOUND'; end if;
  if nullif(trim(p_idempotency_key), '') is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  v_request_fingerprint := encode(extensions.digest(
    p_preference_id::text || ':' || p_operation || ':' || coalesce(p_value::text, 'null') || ':' || coalesce(p_reason, ''),
    'sha256'
  ), 'hex');
  select response, request_fingerprint into v_receipt, v_existing_fingerprint from public.memory_operation_receipts
   where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing_fingerprint <> v_request_fingerprint then raise exception 'MEMORY_IDEMPOTENCY_CONFLICT'; end if;
    return v_receipt || jsonb_build_object('idempotent', true);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_preference_id::text, 0));
  select * into v_preference from public.learned_preferences
   where id = p_preference_id and user_id = p_user_id for update;
  if not found then raise exception 'MEMORY_NOT_FOUND'; end if;
  v_previous := to_jsonb(v_preference);

  if p_operation = 'view' then
    insert into public.memory_events (
      user_id, scope, subject_id, subject_key, action, previous, next,
      actor, idempotency_key, metadata
    ) values (
      p_user_id, 'preferencia', v_preference.id, v_preference.key, 'visto',
      v_previous, v_previous, 'usuario', p_idempotency_key, '{}'::jsonb
    ) returning * into v_event;
  elsif p_operation = 'forget' then
    if v_preference.status = 'olvidada' then raise exception 'MEMORY_REVOKED_IMMUTABLE'; end if;
    update public.learned_preferences set
      status = 'olvidada', updated_at = p_now,
      metadata = metadata || jsonb_build_object(
        'forgotten_at', p_now,
        'forgotten_reason', coalesce(nullif(trim(p_reason), ''), 'user_forget')
      )
    where id = v_preference.id returning * into v_preference;
    insert into public.memory_tombstones (user_id, scope, subject_key, reason)
    values (
      p_user_id, 'preferencia', v_preference.key,
      coalesce(nullif(trim(p_reason), ''), 'user_forget')
    ) on conflict (user_id, scope, subject_key) where lifted_at is null
      do update set reason = excluded.reason;
    insert into public.memory_events (
      user_id, scope, subject_id, subject_key, action, previous, next,
      actor, idempotency_key, metadata
    ) values (
      p_user_id, 'preferencia', v_preference.id, v_preference.key, 'olvidado',
      v_previous, to_jsonb(v_preference), 'usuario', p_idempotency_key,
      jsonb_build_object('undo_until', p_now + interval '30 days')
    ) returning * into v_event;
  elsif p_operation = 'correct' then
    if p_value is null then raise exception 'MEMORY_CORRECTION_VALUE_REQUIRED'; end if;
    if v_preference.status = 'olvidada' then raise exception 'MEMORY_REVOKED_IMMUTABLE'; end if;
    update public.learned_preferences set status = 'reemplazada', updated_at = p_now
     where id = v_preference.id returning * into v_preference;
    insert into public.learned_preferences (
      user_id, source_module, key, value, status, observation_count,
      last_observed_at, positive_evidence_refs, negative_evidence_refs,
      positive_evidence_count, negative_evidence_count,
      supersedes_preference_id, metadata
    ) values (
      p_user_id, v_preference.source_module, v_preference.key, p_value, 'activa', 1,
      p_now, array['memory-correction:' || p_idempotency_key], '{}', 1, 0,
      v_preference.id,
      v_preference.metadata || jsonb_build_object(
        'corrected_from_preference_id', v_preference.id,
        'explicit_user_action', true
      )
    ) returning * into v_replacement;
    insert into public.memory_events (
      user_id, scope, subject_id, subject_key, action, previous, next,
      actor, idempotency_key, metadata
    ) values (
      p_user_id, 'preferencia', v_replacement.id, v_preference.key, 'corregido',
      v_previous, to_jsonb(v_replacement), 'usuario', p_idempotency_key,
      jsonb_build_object(
        'original_memory_id', v_preference.id,
        'replacement_memory_id', v_replacement.id,
        'undo_until', p_now + interval '30 days'
      )
    ) returning * into v_event;
  elsif p_operation = 'reactivate' then
    raise exception 'MEMORY_NOT_REACTIVATABLE';
  else
    select * into v_event from public.memory_events
     where user_id = p_user_id and scope = 'preferencia' and subject_id = p_preference_id
       and action in ('olvidado', 'corregido')
     order by created_at desc limit 1 for update;
    if not found then raise exception 'MEMORY_UNDO_NOT_FOUND'; end if;
    if coalesce(
      nullif(v_event.metadata->>'undo_until', '')::timestamptz,
      v_event.created_at + interval '30 days'
    ) < p_now then raise exception 'MEMORY_UNDO_WINDOW_EXPIRED'; end if;
    if v_event.action = 'olvidado' then
      update public.learned_preferences set
        status = coalesce(v_event.previous->>'status', 'activa'),
        updated_at = p_now,
        metadata = coalesce(v_event.previous->'metadata', '{}'::jsonb)
      where id = p_preference_id returning * into v_preference;
      update public.memory_tombstones set lifted_at = p_now, lifted_by = 'deshacer_del_usuario'
       where user_id = p_user_id and scope = 'preferencia'
         and subject_key = v_event.subject_key and lifted_at is null;
    else
      v_original_id := nullif(v_event.metadata->>'original_memory_id', '')::uuid;
      if v_original_id is null then raise exception 'MEMORY_UNDO_STATE_INVALID'; end if;
      update public.learned_preferences set status = 'reemplazada', updated_at = p_now
       where id = p_preference_id;
      update public.learned_preferences set
        status = coalesce(v_event.previous->>'status', 'activa'),
        updated_at = p_now,
        metadata = coalesce(v_event.previous->'metadata', '{}'::jsonb)
      where id = v_original_id and user_id = p_user_id returning * into v_preference;
    end if;
    insert into public.memory_events (
      user_id, scope, subject_id, subject_key, action, previous, next,
      actor, idempotency_key, metadata
    ) values (
      p_user_id, 'preferencia', v_preference.id, v_event.subject_key, 'deshecho',
      to_jsonb(v_event), to_jsonb(v_preference), 'usuario', p_idempotency_key,
      jsonb_build_object('undid_event_id', v_event.id)
    ) returning * into v_event;
  end if;

  v_result := jsonb_build_object(
    'memory', to_jsonb(v_preference),
    'replacement', case when v_replacement.id is null then null else to_jsonb(v_replacement) end,
    'event', to_jsonb(v_event), 'scope', 'preferencia', 'idempotent', false
  );
  insert into public.memory_operation_receipts (user_id, idempotency_key, request_fingerprint, response)
  values (p_user_id, p_idempotency_key, v_request_fingerprint, v_result);
  return v_result;
end;
$$;

create or replace function public.resolve_profile_candidate(
  p_user_id uuid,
  p_candidate_id uuid,
  p_resolution text,
  p_statement text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_receipt jsonb;
  v_existing_fingerprint text;
  v_request_fingerprint text;
  v_candidate public.user_profile_candidates;
  v_fact public.user_profile_facts;
  v_result jsonb;
begin
  if p_resolution not in ('confirm', 'reject', 'never_ask') then
    raise exception 'PROFILE_CANDIDATE_RESOLUTION_INVALID';
  end if;
  if auth.uid() is distinct from p_user_id then
    raise exception 'MEMORY_CANDIDATE_NOT_FOUND';
  end if;
  if nullif(trim(p_idempotency_key), '') is null then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  v_request_fingerprint := encode(extensions.digest(
    p_candidate_id::text || ':' || p_resolution || ':' || coalesce(p_statement, ''),
    'sha256'
  ), 'hex');
  select response, request_fingerprint into v_receipt, v_existing_fingerprint from public.memory_operation_receipts
   where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing_fingerprint <> v_request_fingerprint then raise exception 'MEMORY_IDEMPOTENCY_CONFLICT'; end if;
    return v_receipt || jsonb_build_object('idempotent', true);
  end if;

  select * into v_candidate from public.user_profile_candidates
   where id = p_candidate_id and user_id = p_user_id for update;
  if not found then raise exception 'MEMORY_CANDIDATE_NOT_FOUND'; end if;
  if v_candidate.status in ('accepted', 'rejected', 'never_ask') then
    raise exception 'MEMORY_CANDIDATE_ALREADY_RESOLVED';
  end if;

  if p_resolution = 'confirm' then
    update public.user_profile_candidates set
      status = 'accepted', decided_at = now(), updated_at = now()
    where id = v_candidate.id returning * into v_candidate;
    insert into public.user_profile_facts (
      user_id, subject_key, statement, origin, status,
      validity, last_confirmed_at,
      positive_evidence_refs, positive_evidence_count, metadata
    ) values (
      p_user_id, v_candidate.subject_key,
      coalesce(nullif(trim(p_statement), ''), v_candidate.statement),
      'observado_confirmado', 'vigente', 'revisable', now(),
      v_candidate.evidence_refs, cardinality(v_candidate.evidence_refs),
      jsonb_build_object('source_candidate_id', v_candidate.id)
    )
    on conflict (user_id, subject_key) where status in ('vigente', 'en_duda')
    do update set
      statement = excluded.statement,
      origin = 'observado_confirmado', status = 'vigente',
      last_confirmed_at = excluded.last_confirmed_at,
      positive_evidence_refs = excluded.positive_evidence_refs,
      positive_evidence_count = excluded.positive_evidence_count,
      updated_at = now(),
      metadata = public.user_profile_facts.metadata || excluded.metadata
    returning * into v_fact;
    insert into public.memory_events (
      user_id, scope, subject_id, subject_key, action, previous, next,
      actor, idempotency_key, metadata
    ) values (
      p_user_id, 'perfil', v_fact.id, v_fact.subject_key, 'confirmado',
      to_jsonb(v_candidate), to_jsonb(v_fact), 'usuario', p_idempotency_key, '{}'::jsonb
    );
  else
    update public.user_profile_candidates set
      status = case when p_resolution = 'reject' then 'rejected' else 'never_ask' end,
      ask_count = case when p_resolution = 'never_ask' then greatest(ask_count, 2) else ask_count end,
      decided_at = now(), updated_at = now()
    where id = v_candidate.id returning * into v_candidate;
    insert into public.memory_events (
      user_id, scope, subject_id, subject_key, action, previous, next,
      actor, idempotency_key, metadata
    ) values (
      p_user_id, 'perfil', v_candidate.id, v_candidate.subject_key, 'rechazado',
      null, to_jsonb(v_candidate), 'usuario', p_idempotency_key,
      jsonb_build_object('resolution', p_resolution)
    );
  end if;

  v_result := jsonb_build_object(
    'candidate', to_jsonb(v_candidate),
    'fact', case when v_fact.id is null then null else to_jsonb(v_fact) end,
    'idempotent', false
  );
  insert into public.memory_operation_receipts (user_id, idempotency_key, request_fingerprint, response)
  values (p_user_id, p_idempotency_key, v_request_fingerprint, v_result);
  return v_result;
end;
$$;

create or replace function public.forget_all_user_memory(
  p_user_id uuid,
  p_confirmation text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_receipt jsonb;
  v_existing_fingerprint text;
  v_request_fingerprint text;
  v_counts jsonb;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'MEMORY_NOT_FOUND';
  end if;
  if nullif(trim(p_idempotency_key), '') is null then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  v_request_fingerprint := encode(extensions.digest(
    'forget-all:' || p_confirmation,
    'sha256'
  ), 'hex');
  select response, request_fingerprint into v_receipt, v_existing_fingerprint from public.memory_operation_receipts
   where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing_fingerprint <> v_request_fingerprint then raise exception 'MEMORY_IDEMPOTENCY_CONFLICT'; end if;
    return v_receipt || jsonb_build_object('idempotent', true);
  end if;
  if p_confirmation <> 'OLVIDAR' then raise exception 'MEMORY_CONFIRMATION_REQUIRED'; end if;

  select jsonb_build_object(
    'classification', (select count(*) from public.financial_memory_items where user_id = p_user_id),
    'candidates', (select count(*) from public.learning_candidates where user_id = p_user_id),
    'profile', (select count(*) from public.user_profile_facts where user_id = p_user_id),
    'profile_candidates', (select count(*) from public.user_profile_candidates where user_id = p_user_id),
    'preferences', (select count(*) from public.learned_preferences where user_id = p_user_id)
  ) into v_counts;

  delete from public.learning_evidence where user_id = p_user_id;
  delete from public.learning_memory_events where user_id = p_user_id;
  delete from public.financial_memory_items where user_id = p_user_id;
  delete from public.learning_candidates where user_id = p_user_id;
  delete from public.user_profile_facts where user_id = p_user_id;
  delete from public.user_profile_candidates where user_id = p_user_id;
  delete from public.learned_preferences where user_id = p_user_id;
  delete from public.memory_tombstones where user_id = p_user_id;
  delete from public.memory_events where user_id = p_user_id;

  v_counts := jsonb_build_object('deleted', v_counts, 'idempotent', false);
  insert into public.memory_operation_receipts (user_id, idempotency_key, request_fingerprint, response)
  values (p_user_id, p_idempotency_key, v_request_fingerprint, v_counts);
  return v_counts;
end;
$$;

-- RUL-MEM-13 se evalúa dentro de la sesión del propio usuario. No existe un
-- worker con service-role que recorra memoria de varias personas.
create or replace function public.apply_user_memory_lifecycle(
  p_user_id uuid,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_classification integer := 0;
  v_profile_expired integer := 0;
  v_profile_review integer := 0;
begin
  if auth.uid() is distinct from p_user_id then raise exception 'MEMORY_NOT_FOUND'; end if;

  with changed as (
    update public.financial_memory_items
       set lifecycle_status = 'expired',
           explanation = 'Caducó tras 12 meses sin aplicarse.',
           updated_at = p_now
     where user_id = p_user_id
       and lifecycle_status = 'confirmed'
       and last_used_at is not null
       and last_used_at <= p_now - interval '12 months'
    returning *
  ), events as (
    insert into public.memory_events (
      user_id, scope, subject_id, subject_key, action, previous, next,
      actor, idempotency_key, metadata
    )
    select user_id, 'clasificacion', id, canonical_key, 'caducado', null,
      to_jsonb(changed), 'sistema', 'classification-expired:' || id::text,
      jsonb_build_object('rule', 'RUL-MEM-13')
    from changed
    on conflict (user_id, idempotency_key) where idempotency_key is not null do nothing
  )
  select count(*) into v_classification from changed;

  with changed as (
    update public.user_profile_facts
       set status = 'caducado', updated_at = p_now
     where user_id = p_user_id and status = 'vigente'
       and validity = 'volatil' and expires_at is not null and expires_at <= p_now
    returning *
  ), events as (
    insert into public.memory_events (
      user_id, scope, subject_id, subject_key, action, previous, next,
      actor, idempotency_key, metadata
    )
    select user_id, 'perfil', id, subject_key, 'caducado', null,
      to_jsonb(changed), 'sistema', 'profile-expired:' || id::text,
      jsonb_build_object('rule', 'RUL-MEM-13')
    from changed
    on conflict (user_id, idempotency_key) where idempotency_key is not null do nothing
  )
  select count(*) into v_profile_expired from changed;

  with changed as (
    update public.user_profile_facts
       set status = 'en_duda', updated_at = p_now,
           metadata = metadata || jsonb_build_object('reconfirm_required_at', p_now)
     where user_id = p_user_id and status = 'vigente'
       and validity = 'revisable' and last_confirmed_at is not null
       and last_confirmed_at <= p_now - interval '6 months'
    returning *
  ), events as (
    insert into public.memory_events (
      user_id, scope, subject_id, subject_key, action, previous, next,
      actor, idempotency_key, metadata
    )
    select user_id, 'perfil', id, subject_key, 'suspendido', null,
      to_jsonb(changed), 'sistema', 'profile-review:' || id::text,
      jsonb_build_object('rule', 'RUL-MEM-13', 'needs_reconfirmation', true)
    from changed
    on conflict (user_id, idempotency_key) where idempotency_key is not null do nothing
  )
  select count(*) into v_profile_review from changed;

  return jsonb_build_object(
    'classification_expired', v_classification,
    'profile_expired', v_profile_expired,
    'profile_needs_reconfirmation', v_profile_review,
    'processed_at', p_now
  );
end;
$$;

-- ── Lotes de clasificación y fusión ──────────────────────────

-- AC-CAT-09: una correccion confirmada contradice la clasificacion anterior
-- y confirma la nueva. Al desactivar aprendizaje la mutacion sigue siendo
-- valida, pero no se crea memoria nueva.
create or replace function public.record_classification_correction_evidence(
  p_user_id uuid,
  p_movement public.movements,
  p_previous_category_id text,
  p_previous_subcategory_id uuid,
  p_next_category_id text,
  p_next_subcategory_id uuid,
  p_evidence_ref text,
  p_observed_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_subject text;
  v_previous_key text;
  v_next_key text;
  v_previous_label text;
  v_next_label text;
  v_learning_enabled boolean;
begin
  select coalesce(enabled, true) into v_learning_enabled
    from public.learning_preferences where user_id = p_user_id;
  if found and not v_learning_enabled then return; end if;

  v_subject := left(trim(regexp_replace(
    translate(lower(coalesce(nullif(p_movement.merchant, ''), nullif(p_movement.description, ''), p_movement.id::text)),
      'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun'),
    '[^a-z0-9]+', ' ', 'g'
  )), 120);
  v_previous_label := coalesce(p_previous_subcategory_id::text, p_previous_category_id, 'sin_clasificar');
  v_next_label := coalesce(p_next_subcategory_id::text, p_next_category_id, 'sin_clasificar');
  v_previous_key := 'classification:' || v_subject || ':' || v_previous_label;
  v_next_key := 'classification:' || v_subject || ':' || v_next_label;

  if p_previous_category_id is not null or p_previous_subcategory_id is not null then
    perform public.record_learning_evidence(
      p_user_id, 'correction_pattern', v_previous_key,
      'La clasificacion anterior de ' || v_subject || ' fue corregida.',
      array[v_subject, v_previous_label], 'confirmed_correction',
      'confirmed_correction', p_evidence_ref || ':previous', 'negative', 1,
      'normal', false, null, 'movement', p_movement.id::text,
      jsonb_build_object(
        'category_id', p_previous_category_id,
        'subcategory_id', p_previous_subcategory_id,
        'corrected_to_category_id', p_next_category_id,
        'corrected_to_subcategory_id', p_next_subcategory_id
      ), p_observed_at,
      jsonb_build_object('movement_id', p_movement.id, 'classification_change', true)
    );
  end if;

  if p_next_category_id is not null or p_next_subcategory_id is not null then
    perform public.record_learning_evidence(
      p_user_id, 'correction_pattern', v_next_key,
      'Elegiste esta clasificacion para ' || v_subject || '.',
      array[v_subject, v_next_label], 'confirmed_correction',
      'confirmed_correction', p_evidence_ref || ':next', 'positive', 1,
      'normal', false, null, 'movement', p_movement.id::text,
      jsonb_build_object(
        'category_id', p_next_category_id,
        'subcategory_id', p_next_subcategory_id,
        'previous_category_id', p_previous_category_id,
        'previous_subcategory_id', p_previous_subcategory_id
      ), p_observed_at,
      jsonb_build_object('movement_id', p_movement.id, 'classification_change', true)
    );
  end if;
end;
$$;

create or replace function public.commit_movement_classification(
  p_user_id uuid,
  p_movement_id uuid,
  p_category_id text,
  p_subcategory_id uuid,
  p_idempotency_key text,
  p_trace_id uuid,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_previous public.movements;
  v_movement public.movements;
  v_response jsonb;
  v_fingerprint text;
  v_existing_fingerprint text;
begin
  if auth.uid() is distinct from p_user_id then raise exception 'MOVEMENT_NOT_FOUND'; end if;
  if nullif(trim(p_idempotency_key), '') is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  v_fingerprint := encode(extensions.digest(
    coalesce(p_movement_id::text, '') || ':' || coalesce(p_category_id, '') || ':' || coalesce(p_subcategory_id::text, ''),
    'sha256'
  ), 'hex');
  select response, request_fingerprint into v_response, v_existing_fingerprint
    from public.classification_action_receipts
   where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing_fingerprint <> v_fingerprint then
      raise exception 'CLASSIFICATION_IDEMPOTENCY_CONFLICT';
    end if;
    return v_response || jsonb_build_object('idempotent', true);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_movement_id::text, 0));
  select * into v_previous from public.movements
   where id = p_movement_id and user_id = p_user_id and deleted_at is null
   for update;
  if not found then raise exception 'MOVEMENT_NOT_FOUND'; end if;
  if v_previous.type not in ('gasto', 'ingreso', 'pago_recurrente') then
    raise exception 'MOVEMENT_TYPE_NOT_CLASSIFIABLE';
  end if;
  if p_category_id is not null and not exists (
    select 1 from public.categories where id = p_category_id
  ) then raise exception 'CATEGORY_NOT_FOUND'; end if;
  if p_subcategory_id is not null and not exists (
    select 1 from public.user_subcategories
     where id = p_subcategory_id and user_id = p_user_id and deleted_at is null
       and category_id = p_category_id
  ) then raise exception 'SUBCATEGORY_NOT_FOUND'; end if;

  update public.movements set
    category_id = p_category_id,
    subcategory_id = p_subcategory_id,
    metadata = metadata || jsonb_build_object(
      'correction_target_type', 'category',
      'corrected_category_id', p_category_id,
      'classification_source', 'user'
    ),
    updated_at = p_now
  where id = v_previous.id
  returning * into v_movement;

  insert into public.movement_audit_log (
    user_id, movement_id, entity_type, entity_id, action, field_name,
    old_value, new_value, source, actor_type, actor_id, trace_id, metadata
  ) values (
    p_user_id, v_movement.id, 'movement', v_movement.id, 'corrected', 'classification',
    jsonb_build_object('category_id', v_previous.category_id, 'subcategory_id', v_previous.subcategory_id),
    jsonb_build_object('category_id', p_category_id, 'subcategory_id', p_subcategory_id),
    'api.v1.movements.classification.patch', 'user', p_user_id, p_trace_id,
    jsonb_build_object('idempotency_key', p_idempotency_key)
  );

  if v_previous.category_id is distinct from p_category_id
     or v_previous.subcategory_id is distinct from p_subcategory_id then
    perform public.record_classification_correction_evidence(
      p_user_id, v_movement, v_previous.category_id, v_previous.subcategory_id,
      p_category_id, p_subcategory_id,
      'classification:' || p_idempotency_key || ':' || v_movement.id::text, p_now
    );
  end if;

  v_response := jsonb_build_object('movement', to_jsonb(v_movement), 'idempotent', false);
  insert into public.classification_action_receipts (
    user_id, movement_id, operation, idempotency_key, request_fingerprint, response
  ) values (
    p_user_id, v_movement.id, 'classify_movement', p_idempotency_key, v_fingerprint, v_response
  );
  return v_response;
end;
$$;

create or replace function public.commit_classification_bulk(
  p_user_id uuid,
  p_movement_ids uuid[],
  p_excluded_ids uuid[],
  p_category_id text,
  p_subcategory_id uuid,
  p_include_manually_corrected boolean,
  p_preview boolean,
  p_idempotency_key text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rows jsonb;
  v_count integer;
  v_requested_count integer;
  v_owned_count integer;
  v_auto_excluded_count integer := 0;
  v_batch public.classification_batches;
  v_existing public.classification_batches;
  v_fingerprint text;
  v_movement public.movements;
  v_change jsonb;
begin
  if auth.uid() is distinct from p_user_id then raise exception 'CLASSIFICATION_RESOURCE_NOT_FOUND'; end if;
  if nullif(trim(p_idempotency_key), '') is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  v_fingerprint := encode(extensions.digest(
    coalesce(to_jsonb(p_movement_ids)::text, '[]') || ':' ||
    coalesce(to_jsonb(p_excluded_ids)::text, '[]') || ':' ||
    coalesce(p_category_id, '') || ':' || coalesce(p_subcategory_id::text, '') || ':' ||
    coalesce(p_include_manually_corrected::text, 'false'),
    'sha256'
  ), 'hex');
  if not p_preview then
    select * into v_existing from public.classification_batches
     where user_id = p_user_id and idempotency_key = p_idempotency_key;
    if found then
      if v_existing.kind <> 'bulk' or coalesce(v_existing.metadata->>'request_fingerprint', '') <> v_fingerprint then
        raise exception 'CLASSIFICATION_IDEMPOTENCY_CONFLICT';
      end if;
      return jsonb_build_object('batch', to_jsonb(v_existing), 'idempotent', true);
    end if;
  end if;
  if p_category_id is not null and not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'CATEGORY_NOT_FOUND';
  end if;
  if p_subcategory_id is not null and not exists (
    select 1 from public.user_subcategories
     where id = p_subcategory_id and user_id = p_user_id and deleted_at is null
       and category_id = p_category_id
  ) then raise exception 'SUBCATEGORY_NOT_FOUND'; end if;

  select count(*) into v_requested_count from (
    select distinct movement_id
      from unnest(coalesce(p_movement_ids, '{}')) movement_id
     where not (movement_id = any(coalesce(p_excluded_ids, '{}')))
  ) selected;
  if v_requested_count = 0 then raise exception 'CLASSIFICATION_BATCH_EMPTY'; end if;
  select count(*) into v_owned_count from public.movements m
   where m.user_id = p_user_id
     and m.id in (
       select distinct movement_id
         from unnest(coalesce(p_movement_ids, '{}')) movement_id
        where not (movement_id = any(coalesce(p_excluded_ids, '{}')))
     )
     and m.deleted_at is null;
  if v_owned_count <> v_requested_count then raise exception 'CLASSIFICATION_RESOURCE_NOT_FOUND'; end if;
  if exists (
    select 1 from public.movements m
     where m.user_id = p_user_id
       and m.id in (
         select distinct movement_id
           from unnest(coalesce(p_movement_ids, '{}')) movement_id
          where not (movement_id = any(coalesce(p_excluded_ids, '{}')))
       )
       and m.type not in ('gasto', 'ingreso', 'pago_recurrente')
  ) then raise exception 'MOVEMENT_TYPE_NOT_CLASSIFIABLE'; end if;

  if not p_include_manually_corrected then
    select count(*) into v_auto_excluded_count
      from public.movements m
     where m.user_id = p_user_id
       and m.id = any(coalesce(p_movement_ids, '{}'))
       and not (m.id = any(coalesce(p_excluded_ids, '{}')))
       and coalesce(m.metadata->>'classification_source', '') = 'user';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'category_id', m.category_id,
    'subcategory_id', m.subcategory_id,
    'description', m.description,
    'merchant', m.merchant,
    'amount', m.amount,
    'occurred_at', m.occurred_at
  ) order by m.occurred_at desc), '[]'::jsonb), count(*)
  into v_rows, v_count
  from public.movements m
  where m.user_id = p_user_id
    and m.id = any(coalesce(p_movement_ids, '{}'))
    and not (m.id = any(coalesce(p_excluded_ids, '{}')))
    and (
      p_include_manually_corrected
      or coalesce(m.metadata->>'classification_source', '') <> 'user'
    )
    and m.deleted_at is null
    and m.type in ('gasto', 'ingreso', 'pago_recurrente');
  if v_count = 0 then raise exception 'CLASSIFICATION_BATCH_EMPTY'; end if;

  if p_preview then
    return jsonb_build_object(
      'preview', true, 'count', v_count, 'sample', v_rows->0,
      'movements', (select jsonb_agg(value) from jsonb_array_elements(v_rows) with ordinality x(value, n) where n <= 5),
      'excluded_count', cardinality(coalesce(p_excluded_ids, '{}')) + v_auto_excluded_count,
      'idempotent', false
    );
  end if;

  update public.movements set
    category_id = p_category_id,
    subcategory_id = p_subcategory_id,
    metadata = metadata || jsonb_build_object(
      'classification_batch_key', p_idempotency_key,
      'correction_target_type', 'category',
      'corrected_category_id', p_category_id,
      'classification_source', 'user'
    ),
    updated_at = p_now
  where user_id = p_user_id
    and id = any(coalesce(p_movement_ids, '{}'))
    and not (id = any(coalesce(p_excluded_ids, '{}')))
    and (
      p_include_manually_corrected
      or coalesce(metadata->>'classification_source', '') <> 'user'
    )
    and deleted_at is null
    and type in ('gasto', 'ingreso', 'pago_recurrente');

  insert into public.classification_batches (
    user_id, kind, target_subcategory_id, target_category_id,
    movement_changes, movement_count, idempotency_key, undo_until
  ) values (
    p_user_id, 'bulk', p_subcategory_id, p_category_id,
    v_rows, v_count, p_idempotency_key, p_now + interval '30 days'
  ) returning * into v_batch;
  update public.classification_batches
     set metadata = jsonb_build_object('request_fingerprint', v_fingerprint)
   where id = v_batch.id returning * into v_batch;

  for v_change in select value from jsonb_array_elements(v_rows)
  loop
    select * into v_movement from public.movements
     where id = (v_change->>'id')::uuid and user_id = p_user_id;
    if nullif(v_change->>'category_id', '') is distinct from p_category_id
       or nullif(v_change->>'subcategory_id', '')::uuid is distinct from p_subcategory_id then
      perform public.record_classification_correction_evidence(
        p_user_id, v_movement,
        nullif(v_change->>'category_id', ''), nullif(v_change->>'subcategory_id', '')::uuid,
        p_category_id, p_subcategory_id,
        'classification-bulk:' || v_batch.id::text || ':' || v_movement.id::text, p_now
      );
    end if;
    insert into public.movement_audit_log (
      user_id, movement_id, entity_type, entity_id, action, field_name,
      old_value, new_value, source, actor_type, actor_id, metadata
    ) values (
      p_user_id, v_movement.id, 'movement', v_movement.id, 'corrected', 'classification',
      jsonb_build_object('category_id', v_change->>'category_id', 'subcategory_id', v_change->>'subcategory_id'),
      jsonb_build_object('category_id', p_category_id, 'subcategory_id', p_subcategory_id),
      'api.v1.classification.bulk', 'user', p_user_id,
      jsonb_build_object('batch_id', v_batch.id, 'idempotency_key', p_idempotency_key)
    );
  end loop;
  return jsonb_build_object('batch', to_jsonb(v_batch), 'idempotent', false);
end;
$$;

create or replace function public.undo_classification_batch(
  p_user_id uuid,
  p_batch_id uuid,
  p_expected_kind text,
  p_expected_source_id uuid,
  p_idempotency_key text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch public.classification_batches;
  v_change jsonb;
  v_current public.movements;
begin
  if auth.uid() is distinct from p_user_id then raise exception 'CLASSIFICATION_BATCH_NOT_FOUND'; end if;
  if p_expected_kind not in ('bulk', 'merge') then raise exception 'CLASSIFICATION_BATCH_KIND_INVALID'; end if;
  if nullif(trim(p_idempotency_key), '') is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  select * into v_batch from public.classification_batches
   where id = p_batch_id and user_id = p_user_id for update;
  if not found then raise exception 'CLASSIFICATION_BATCH_NOT_FOUND'; end if;
  if v_batch.kind <> p_expected_kind then raise exception 'CLASSIFICATION_BATCH_NOT_FOUND'; end if;
  if p_expected_kind = 'merge' and v_batch.source_subcategory_id is distinct from p_expected_source_id then
    raise exception 'CLASSIFICATION_BATCH_NOT_FOUND';
  end if;
  if v_batch.status = 'undone' then
    if coalesce(v_batch.metadata->>'undo_idempotency_key', '') <> p_idempotency_key then
      raise exception 'CLASSIFICATION_UNDO_ALREADY_APPLIED';
    end if;
    return jsonb_build_object('batch', to_jsonb(v_batch), 'idempotent', true);
  end if;
  if v_batch.undo_until < p_now then raise exception 'CLASSIFICATION_UNDO_EXPIRED'; end if;
  if v_batch.kind = 'merge' and exists (
    select 1
      from public.user_subcategories source
      join public.user_subcategories duplicate
        on duplicate.user_id = source.user_id
       and duplicate.category_id = source.category_id
       and duplicate.normalized_label = source.normalized_label
       and duplicate.deleted_at is null
       and duplicate.id <> source.id
     where source.id = v_batch.source_subcategory_id
       and source.user_id = p_user_id
  ) then
    raise exception 'SUBCATEGORY_UNDO_NAME_CONFLICT';
  end if;

  for v_change in select value from jsonb_array_elements(v_batch.movement_changes)
  loop
    select * into v_current from public.movements
     where id = (v_change->>'id')::uuid and user_id = p_user_id and deleted_at is null
     for update;
    if not found then raise exception 'CLASSIFICATION_RESOURCE_NOT_FOUND'; end if;
    update public.movements set
      category_id = nullif(v_change->>'category_id', ''),
      subcategory_id = nullif(v_change->>'subcategory_id', '')::uuid,
      updated_at = p_now,
      metadata = metadata || jsonb_build_object('classification_undo_batch_id', v_batch.id)
    where id = (v_change->>'id')::uuid and user_id = p_user_id;
    if v_batch.kind = 'bulk' then
      perform public.record_classification_correction_evidence(
        p_user_id, v_current,
        v_current.category_id, v_current.subcategory_id,
        nullif(v_change->>'category_id', ''), nullif(v_change->>'subcategory_id', '')::uuid,
        'classification-undo:' || p_idempotency_key || ':' || v_current.id::text, p_now
      );
      insert into public.movement_audit_log (
        user_id, movement_id, entity_type, entity_id, action, field_name,
        old_value, new_value, source, actor_type, actor_id, metadata
      ) values (
        p_user_id, v_current.id, 'movement', v_current.id, 'corrected', 'classification',
        jsonb_build_object('category_id', v_current.category_id, 'subcategory_id', v_current.subcategory_id),
        jsonb_build_object('category_id', v_change->>'category_id', 'subcategory_id', v_change->>'subcategory_id'),
        'api.v1.classification.undo', 'user', p_user_id,
        jsonb_build_object('batch_id', v_batch.id, 'idempotency_key', p_idempotency_key)
      );
    else
      insert into public.movement_audit_log (
        user_id, movement_id, entity_type, entity_id, action, field_name,
        old_value, new_value, source, actor_type, actor_id, metadata
      ) values (
        p_user_id, v_current.id, 'movement', v_current.id, 'corrected', 'subcategory_id',
        to_jsonb(v_current.subcategory_id::text), to_jsonb(v_change->>'subcategory_id'),
        'api.v1.subcategories.merge.undo', 'user', p_user_id,
        jsonb_build_object('batch_id', v_batch.id, 'idempotency_key', p_idempotency_key)
      );
    end if;
  end loop;
  if v_batch.kind = 'merge' and v_batch.source_subcategory_id is not null then
    update public.user_subcategories set deleted_at = null
     where id = v_batch.source_subcategory_id and user_id = p_user_id;
  end if;
  update public.classification_batches set status = 'undone', undone_at = p_now,
    metadata = metadata || jsonb_build_object('undo_idempotency_key', p_idempotency_key)
  where id = v_batch.id returning * into v_batch;
  return jsonb_build_object('batch', to_jsonb(v_batch), 'idempotent', false);
end;
$$;

create or replace function public.commit_subcategory_merge(
  p_user_id uuid,
  p_source_id uuid,
  p_target_id uuid,
  p_preview boolean,
  p_idempotency_key text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_source public.user_subcategories;
  v_target public.user_subcategories;
  v_rows jsonb;
  v_count integer;
  v_target_count integer;
  v_batch public.classification_batches;
  v_existing public.classification_batches;
  v_fingerprint text;
  v_change jsonb;
begin
  if auth.uid() is distinct from p_user_id then raise exception 'SUBCATEGORY_NOT_FOUND'; end if;
  if nullif(trim(p_idempotency_key), '') is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  if p_source_id = p_target_id then raise exception 'SUBCATEGORY_MERGE_SELF'; end if;
  v_fingerprint := encode(extensions.digest(
    p_source_id::text || ':' || p_target_id::text,
    'sha256'
  ), 'hex');
  if not p_preview then
    select * into v_existing from public.classification_batches
     where user_id = p_user_id and idempotency_key = p_idempotency_key;
    if found then
      if v_existing.kind <> 'merge' or coalesce(v_existing.metadata->>'request_fingerprint', '') <> v_fingerprint then
        raise exception 'CLASSIFICATION_IDEMPOTENCY_CONFLICT';
      end if;
      return jsonb_build_object('batch', to_jsonb(v_existing), 'idempotent', true);
    end if;
  end if;
  select * into v_source from public.user_subcategories
   where id = p_source_id and user_id = p_user_id and deleted_at is null for update;
  if not found then raise exception 'SUBCATEGORY_NOT_FOUND'; end if;
  select * into v_target from public.user_subcategories
   where id = p_target_id and user_id = p_user_id and deleted_at is null for update;
  if not found then raise exception 'SUBCATEGORY_NOT_FOUND'; end if;
  if v_source.category_id <> v_target.category_id then raise exception 'SUBCATEGORY_MERGE_CATEGORY_MISMATCH'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'category_id', category_id, 'subcategory_id', subcategory_id,
    'description', description, 'amount', amount, 'occurred_at', occurred_at
  ) order by occurred_at desc), '[]'::jsonb), count(*)
  into v_rows, v_count from public.movements
  where user_id = p_user_id and subcategory_id = p_source_id and deleted_at is null;
  select count(*) into v_target_count from public.movements
   where user_id = p_user_id and subcategory_id = p_target_id and deleted_at is null;
  if p_preview then
    return jsonb_build_object(
      'preview', true, 'count', v_count,
      'target_count_before', v_target_count,
      'target_count_after', v_target_count + v_count,
      'source', to_jsonb(v_source), 'target', to_jsonb(v_target),
      'movements', (select jsonb_agg(value) from jsonb_array_elements(v_rows) with ordinality x(value, n) where n <= 5),
      'idempotent', false
    );
  end if;

  update public.movements set
    subcategory_id = p_target_id,
    metadata = metadata || jsonb_build_object('subcategory_merge_key', p_idempotency_key),
    updated_at = p_now
   where user_id = p_user_id and subcategory_id = p_source_id and deleted_at is null;
  update public.user_subcategories set deleted_at = p_now
   where id = p_source_id and user_id = p_user_id;
  insert into public.classification_batches (
    user_id, kind, source_subcategory_id, target_subcategory_id,
    target_category_id, movement_changes, movement_count,
    idempotency_key, undo_until
  ) values (
    p_user_id, 'merge', p_source_id, p_target_id, v_target.category_id,
    v_rows, v_count, p_idempotency_key, p_now + interval '7 days'
  ) returning * into v_batch;
  update public.classification_batches
     set metadata = jsonb_build_object(
       'request_fingerprint', v_fingerprint,
       'target_count_before', v_target_count,
       'target_count_after', v_target_count + v_count
     )
   where id = v_batch.id returning * into v_batch;
  for v_change in select value from jsonb_array_elements(v_rows)
  loop
    insert into public.movement_audit_log (
      user_id, movement_id, entity_type, entity_id, action, field_name,
      old_value, new_value, source, actor_type, actor_id, metadata
    ) values (
      p_user_id, (v_change->>'id')::uuid, 'movement', (v_change->>'id')::uuid,
      'corrected', 'subcategory_id', to_jsonb(v_change->>'subcategory_id'),
      to_jsonb(p_target_id::text), 'api.v1.subcategories.merge', 'user', p_user_id,
      jsonb_build_object('batch_id', v_batch.id, 'idempotency_key', p_idempotency_key)
    );
  end loop;
  return jsonb_build_object('batch', to_jsonb(v_batch), 'idempotent', false);
end;
$$;

-- ── Grants de funciones ──────────────────────────────────────

revoke all on function public.commit_insight_action(uuid, uuid, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.set_insight_type_muted(uuid, public.insight_type, boolean, text, text)
  from public, anon, authenticated;
revoke all on function public.commit_financial_memory_operation(uuid, uuid, text, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.commit_profile_memory_operation(uuid, uuid, text, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.commit_preference_memory_operation(uuid, uuid, text, jsonb, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.resolve_profile_candidate(uuid, uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.forget_all_user_memory(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.apply_user_memory_lifecycle(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.record_classification_correction_evidence(uuid, public.movements, text, uuid, text, uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.commit_movement_classification(uuid, uuid, text, uuid, text, uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.commit_classification_bulk(uuid, uuid[], uuid[], text, uuid, boolean, boolean, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.undo_classification_batch(uuid, uuid, text, uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.commit_subcategory_merge(uuid, uuid, uuid, boolean, text, timestamptz)
  from public, anon, authenticated;

grant execute on function public.commit_insight_action(uuid, uuid, text, text, text, text) to authenticated;
grant execute on function public.set_insight_type_muted(uuid, public.insight_type, boolean, text, text) to authenticated;
grant execute on function public.commit_financial_memory_operation(uuid, uuid, text, text, text, text, timestamptz) to authenticated;
grant execute on function public.commit_profile_memory_operation(uuid, uuid, text, text, text, text, timestamptz) to authenticated;
grant execute on function public.commit_preference_memory_operation(uuid, uuid, text, jsonb, text, text, timestamptz) to authenticated;
grant execute on function public.resolve_profile_candidate(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.forget_all_user_memory(uuid, text, text) to authenticated;
grant execute on function public.apply_user_memory_lifecycle(uuid, timestamptz) to authenticated;
grant execute on function public.commit_movement_classification(uuid, uuid, text, uuid, text, uuid, timestamptz) to authenticated;
grant execute on function public.commit_classification_bulk(uuid, uuid[], uuid[], text, uuid, boolean, boolean, text, timestamptz) to authenticated;
grant execute on function public.undo_classification_batch(uuid, uuid, text, uuid, text, timestamptz) to authenticated;
grant execute on function public.commit_subcategory_merge(uuid, uuid, uuid, boolean, text, timestamptz) to authenticated;
