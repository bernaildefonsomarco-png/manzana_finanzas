-- =============================================================
-- Migration 008: External events, transactional outbox and internal event log
-- Corte 4 - Eventos y workers base
-- Depends on: 001, 005, 006, 007
-- =============================================================

create table if not exists public.external_event_log (
  id                 uuid primary key default gen_random_uuid(),
  source             text not null,
  event_type         text not null,
  idempotency_key    text not null,
  user_id            uuid references auth.users(id) on delete set null,
  received_at        timestamptz not null default now(),
  status             text not null default 'received',
  payload_hash       text not null,
  payload_ref        text,
  trace_id           uuid not null,
  metadata           jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint external_event_source_known
    check (source in ('whatsapp', 'dashboard', 'gmail', 'scheduler', 'worker')),
  constraint external_event_status_known
    check (status in ('received', 'duplicate', 'accepted', 'processed', 'failed', 'dead_letter')),
  constraint external_event_idempotency_length
    check (length(idempotency_key) between 8 and 240),
  constraint external_event_payload_hash_length
    check (length(payload_hash) between 32 and 160),
  constraint external_event_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint external_event_unique_idempotency
    unique (source, idempotency_key)
);

create trigger external_event_log_updated_at
  before update on public.external_event_log
  for each row execute function manzana.set_updated_at();

create index if not exists external_event_log_user_received_idx
  on public.external_event_log (user_id, received_at desc);

create index if not exists external_event_log_status_received_idx
  on public.external_event_log (status, received_at desc);

comment on table public.external_event_log is
  'Eventos externos normalizados. No representan hechos financieros confirmados.';

create table if not exists public.transactional_outbox (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  event_type            text not null,
  aggregate_type        text not null,
  aggregate_id          uuid not null,
  payload               jsonb not null,
  payload_version       int not null default 1,
  status                text not null default 'pending',
  attempt_count         int not null default 0,
  max_attempts          int not null default 6,
  next_attempt_at       timestamptz not null default now(),
  processing_started_at timestamptz,
  published_at          timestamptz,
  trace_id              uuid not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  last_error            text,
  metadata              jsonb not null default '{}'::jsonb,

  constraint transactional_outbox_event_type_length
    check (length(event_type) between 3 and 120),
  constraint transactional_outbox_aggregate_type_length
    check (length(aggregate_type) between 3 and 80),
  constraint transactional_outbox_status_known
    check (status in ('pending', 'processing', 'published', 'failed', 'dead_letter')),
  constraint transactional_outbox_attempts_valid
    check (attempt_count >= 0 and max_attempts >= 1),
  constraint transactional_outbox_payload_object
    check (jsonb_typeof(payload) = 'object'),
  constraint transactional_outbox_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create trigger transactional_outbox_updated_at
  before update on public.transactional_outbox
  for each row execute function manzana.set_updated_at();

create index if not exists transactional_outbox_status_next_attempt_idx
  on public.transactional_outbox (status, next_attempt_at, created_at);

create index if not exists transactional_outbox_user_created_idx
  on public.transactional_outbox (user_id, created_at desc);

create index if not exists transactional_outbox_aggregate_idx
  on public.transactional_outbox (aggregate_type, aggregate_id, created_at desc);

comment on table public.transactional_outbox is
  'Outbox transaccional de hechos internos del dominio. Workers lo publican de forma idempotente.';

create table if not exists public.internal_event_log (
  id              uuid primary key default gen_random_uuid(),
  outbox_id       uuid not null references public.transactional_outbox(id) on delete cascade,
  event_type      text not null,
  consumer_name   text not null,
  status          text not null default 'processed',
  processed_at    timestamptz,
  attempt_count   int not null default 0,
  last_error      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  metadata        jsonb not null default '{}'::jsonb,

  constraint internal_event_log_consumer_length
    check (length(consumer_name) between 3 and 120),
  constraint internal_event_log_status_known
    check (status in ('processing', 'processed', 'failed', 'skipped')),
  constraint internal_event_log_attempts_valid
    check (attempt_count >= 0),
  constraint internal_event_log_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint internal_event_log_unique_consumer
    unique (outbox_id, consumer_name)
);

create trigger internal_event_log_updated_at
  before update on public.internal_event_log
  for each row execute function manzana.set_updated_at();

create index if not exists internal_event_log_consumer_status_idx
  on public.internal_event_log (consumer_name, status, created_at desc);

create index if not exists internal_event_log_event_type_idx
  on public.internal_event_log (event_type, created_at desc);

comment on table public.internal_event_log is
  'Registro idempotente de consumidores de eventos internos.';

alter table public.external_event_log enable row level security;
alter table public.transactional_outbox enable row level security;
alter table public.internal_event_log enable row level security;

revoke all on public.external_event_log from anon, authenticated;
revoke all on public.transactional_outbox from anon, authenticated;
revoke all on public.internal_event_log from anon, authenticated;

grant select, insert, update on public.external_event_log to service_role;
grant select, insert, update on public.transactional_outbox to service_role;
grant select, insert, update on public.internal_event_log to service_role;

create or replace function manzana.insert_transactional_outbox_events(
  p_events jsonb
)
returns void
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  item jsonb;
begin
  for item in
    select value from jsonb_array_elements(coalesce(p_events, '[]'::jsonb))
  loop
    insert into public.transactional_outbox (
      id,
      user_id,
      event_type,
      aggregate_type,
      aggregate_id,
      payload,
      payload_version,
      status,
      trace_id,
      metadata
    )
    values (
      coalesce((item->>'id')::uuid, gen_random_uuid()),
      (item->>'user_id')::uuid,
      item->>'event_type',
      item->>'aggregate_type',
      (item->>'aggregate_id')::uuid,
      coalesce(item->'payload', '{}'::jsonb),
      coalesce((item->>'payload_version')::int, 1),
      coalesce(item->>'status', 'pending'),
      (item->>'trace_id')::uuid,
      coalesce(item->'metadata', '{}'::jsonb)
    );
  end loop;
end;
$$;

create or replace function manzana.core_commit_movement_create(
  p_movement jsonb,
  p_audit_logs jsonb,
  p_account_deltas jsonb,
  p_box_deltas jsonb,
  p_outbox_events jsonb
)
returns public.movements
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_movement public.movements;
  v_user_id uuid := (p_movement->>'user_id')::uuid;
begin
  select *
    into v_movement
    from public.movements
   where user_id = v_user_id
     and idempotency_key = p_movement->>'idempotency_key';

  if found then
    return v_movement;
  end if;

  insert into public.movements (
    id,
    user_id,
    type,
    status,
    amount,
    currency,
    occurred_at,
    description,
    merchant,
    category_id,
    subcategory_id,
    source,
    source_ref,
    idempotency_key,
    confidence,
    requires_review,
    account_origin_id,
    account_destination_id,
    box_origin_id,
    box_destination_id,
    debt_id,
    recurring_rule_id,
    recurring_occurrence_id,
    related_person_id,
    affects_total_balance,
    affects_account_balance,
    metadata
  )
  values (
    coalesce((p_movement->>'id')::uuid, gen_random_uuid()),
    v_user_id,
    (p_movement->>'type')::public.movement_type,
    (p_movement->>'status')::public.movement_status,
    (p_movement->>'amount')::numeric,
    p_movement->>'currency',
    (p_movement->>'occurred_at')::timestamptz,
    nullif(p_movement->>'description', ''),
    nullif(p_movement->>'merchant', ''),
    nullif(p_movement->>'category_id', ''),
    nullif(p_movement->>'subcategory_id', '')::uuid,
    (p_movement->>'source')::public.movement_source,
    nullif(p_movement->>'source_ref', ''),
    p_movement->>'idempotency_key',
    nullif(p_movement->>'confidence', '')::numeric,
    coalesce((p_movement->>'requires_review')::boolean, false),
    nullif(p_movement->>'account_origin_id', '')::uuid,
    nullif(p_movement->>'account_destination_id', '')::uuid,
    nullif(p_movement->>'box_origin_id', '')::uuid,
    nullif(p_movement->>'box_destination_id', '')::uuid,
    nullif(p_movement->>'debt_id', '')::uuid,
    nullif(p_movement->>'recurring_rule_id', '')::uuid,
    nullif(p_movement->>'recurring_occurrence_id', '')::uuid,
    nullif(p_movement->>'related_person_id', '')::uuid,
    (p_movement->>'affects_total_balance')::boolean,
    (p_movement->>'affects_account_balance')::boolean,
    coalesce(p_movement->'metadata', '{}'::jsonb)
  )
  returning * into v_movement;

  perform manzana.apply_account_balance_deltas(v_user_id, p_account_deltas);
  perform manzana.apply_box_balance_deltas(v_user_id, p_box_deltas);
  perform manzana.insert_movement_audit_logs(p_audit_logs);
  perform manzana.insert_transactional_outbox_events(p_outbox_events);

  return v_movement;
exception
  when unique_violation then
    select *
      into v_movement
      from public.movements
     where user_id = v_user_id
       and idempotency_key = p_movement->>'idempotency_key';
    if not found then
      raise;
    end if;
    return v_movement;
end;
$$;

create or replace function manzana.core_commit_movement_update(
  p_movement jsonb,
  p_audit_logs jsonb,
  p_account_deltas jsonb,
  p_box_deltas jsonb,
  p_outbox_events jsonb
)
returns public.movements
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_movement public.movements;
  v_user_id uuid := (p_movement->>'user_id')::uuid;
begin
  update public.movements
     set type = (p_movement->>'type')::public.movement_type,
         status = (p_movement->>'status')::public.movement_status,
         amount = (p_movement->>'amount')::numeric,
         currency = p_movement->>'currency',
         occurred_at = (p_movement->>'occurred_at')::timestamptz,
         description = nullif(p_movement->>'description', ''),
         merchant = nullif(p_movement->>'merchant', ''),
         category_id = nullif(p_movement->>'category_id', ''),
         subcategory_id = nullif(p_movement->>'subcategory_id', '')::uuid,
         source = (p_movement->>'source')::public.movement_source,
         source_ref = nullif(p_movement->>'source_ref', ''),
         confidence = nullif(p_movement->>'confidence', '')::numeric,
         requires_review = coalesce((p_movement->>'requires_review')::boolean, false),
         account_origin_id = nullif(p_movement->>'account_origin_id', '')::uuid,
         account_destination_id = nullif(p_movement->>'account_destination_id', '')::uuid,
         box_origin_id = nullif(p_movement->>'box_origin_id', '')::uuid,
         box_destination_id = nullif(p_movement->>'box_destination_id', '')::uuid,
         debt_id = nullif(p_movement->>'debt_id', '')::uuid,
         recurring_rule_id = nullif(p_movement->>'recurring_rule_id', '')::uuid,
         recurring_occurrence_id = nullif(p_movement->>'recurring_occurrence_id', '')::uuid,
         related_person_id = nullif(p_movement->>'related_person_id', '')::uuid,
         affects_total_balance = (p_movement->>'affects_total_balance')::boolean,
         affects_account_balance = (p_movement->>'affects_account_balance')::boolean,
         deleted_at = nullif(p_movement->>'deleted_at', '')::timestamptz,
         metadata = coalesce(p_movement->'metadata', '{}'::jsonb)
   where id = (p_movement->>'id')::uuid
     and user_id = v_user_id
   returning * into v_movement;

  if not found then
    raise exception 'MOVEMENT_NOT_FOUND';
  end if;

  perform manzana.apply_account_balance_deltas(v_user_id, p_account_deltas);
  perform manzana.apply_box_balance_deltas(v_user_id, p_box_deltas);
  perform manzana.insert_movement_audit_logs(p_audit_logs);
  perform manzana.insert_transactional_outbox_events(p_outbox_events);

  return v_movement;
end;
$$;

create or replace function public.core_commit_movement_create(
  p_movement jsonb,
  p_audit_logs jsonb,
  p_account_deltas jsonb,
  p_box_deltas jsonb,
  p_outbox_events jsonb
)
returns public.movements
language sql
security definer
set search_path = public, manzana
as $$
  select * from manzana.core_commit_movement_create(
    p_movement,
    p_audit_logs,
    p_account_deltas,
    p_box_deltas,
    p_outbox_events
  );
$$;

create or replace function public.core_commit_movement_update(
  p_movement jsonb,
  p_audit_logs jsonb,
  p_account_deltas jsonb,
  p_box_deltas jsonb,
  p_outbox_events jsonb
)
returns public.movements
language sql
security definer
set search_path = public, manzana
as $$
  select * from manzana.core_commit_movement_update(
    p_movement,
    p_audit_logs,
    p_account_deltas,
    p_box_deltas,
    p_outbox_events
  );
$$;

create or replace function public.claim_outbox_events(
  p_limit int default 25
)
returns setof public.transactional_outbox
language sql
security definer
set search_path = public, manzana
as $$
  with candidates as (
    select id
      from public.transactional_outbox
     where status in ('pending', 'failed')
       and next_attempt_at <= now()
       and attempt_count < max_attempts
     order by next_attempt_at asc, created_at asc
     limit least(greatest(p_limit, 1), 100)
     for update skip locked
  )
  update public.transactional_outbox o
     set status = 'processing',
         attempt_count = o.attempt_count + 1,
         processing_started_at = now(),
         last_error = null
    from candidates
   where o.id = candidates.id
  returning o.*;
$$;

create or replace function public.mark_outbox_published(
  p_outbox_id uuid
)
returns public.transactional_outbox
language sql
security definer
set search_path = public, manzana
as $$
  update public.transactional_outbox
     set status = 'published',
         published_at = now(),
         processing_started_at = null,
         last_error = null
   where id = p_outbox_id
  returning *;
$$;

create or replace function public.mark_outbox_failed(
  p_outbox_id uuid,
  p_error text,
  p_next_attempt_at timestamptz,
  p_dead_letter boolean default false
)
returns public.transactional_outbox
language sql
security definer
set search_path = public, manzana
as $$
  update public.transactional_outbox
     set status = case when p_dead_letter then 'dead_letter' else 'failed' end,
         next_attempt_at = case when p_dead_letter then next_attempt_at else p_next_attempt_at end,
         processing_started_at = null,
         last_error = left(coalesce(p_error, 'unknown_error'), 1000)
   where id = p_outbox_id
  returning *;
$$;

create or replace function public.record_internal_event_processing(
  p_outbox_id uuid,
  p_event_type text,
  p_consumer_name text,
  p_status text,
  p_last_error text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.internal_event_log
language sql
security definer
set search_path = public, manzana
as $$
  insert into public.internal_event_log (
    outbox_id,
    event_type,
    consumer_name,
    status,
    processed_at,
    attempt_count,
    last_error,
    metadata
  )
  values (
    p_outbox_id,
    p_event_type,
    p_consumer_name,
    p_status,
    case when p_status in ('processed', 'failed', 'skipped') then now() else null end,
    1,
    p_last_error,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (outbox_id, consumer_name)
  do update
     set status = excluded.status,
         processed_at = excluded.processed_at,
         attempt_count = public.internal_event_log.attempt_count + 1,
         last_error = excluded.last_error,
         metadata = public.internal_event_log.metadata || excluded.metadata
  returning *;
$$;

revoke all on function manzana.insert_transactional_outbox_events(jsonb) from public, anon, authenticated;
revoke all on function manzana.core_commit_movement_create(jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function manzana.core_commit_movement_update(jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.core_commit_movement_create(jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.core_commit_movement_update(jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.claim_outbox_events(int) from public, anon, authenticated;
revoke all on function public.mark_outbox_published(uuid) from public, anon, authenticated;
revoke all on function public.mark_outbox_failed(uuid, text, timestamptz, boolean) from public, anon, authenticated;
revoke all on function public.record_internal_event_processing(uuid, text, text, text, text, jsonb) from public, anon, authenticated;

grant execute on function manzana.core_commit_movement_create(jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function manzana.core_commit_movement_update(jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.core_commit_movement_create(jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.core_commit_movement_update(jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.claim_outbox_events(int) to service_role;
grant execute on function public.mark_outbox_published(uuid) to service_role;
grant execute on function public.mark_outbox_failed(uuid, text, timestamptz, boolean) to service_role;
grant execute on function public.record_internal_event_processing(uuid, text, text, text, text, jsonb) to service_role;
