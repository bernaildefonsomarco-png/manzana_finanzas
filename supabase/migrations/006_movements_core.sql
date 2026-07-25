-- =============================================================
-- Migration 006: Movements, movement audit log and Core commits
-- Corte 2 - Core Financiero inicial
-- Depends on: 001, 002, 003, 004, 005
-- =============================================================

create table if not exists public.movements (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references auth.users(id) on delete cascade,
  type                       public.movement_type not null,
  status                     public.movement_status not null default 'confirmed',
  amount                     numeric(14,2) not null,
  currency                   text not null default 'PEN',
  occurred_at                timestamptz not null,
  description                text,
  merchant                   text,
  category_id                text references public.categories(id),
  subcategory_id             uuid references public.user_subcategories(id),
  source                     public.movement_source not null,
  source_ref                 text,
  idempotency_key            text not null,
  confidence                 numeric(5,4),
  requires_review            boolean not null default false,

  account_origin_id          uuid references public.accounts(id),
  account_destination_id     uuid references public.accounts(id),
  box_origin_id              uuid references public.boxes(id),
  box_destination_id         uuid references public.boxes(id),

  debt_id                    uuid,
  recurring_rule_id          uuid,
  recurring_occurrence_id    uuid,
  related_person_id          uuid,

  affects_total_balance      boolean not null default false,
  affects_account_balance    boolean not null default false,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  deleted_at                 timestamptz,
  metadata                   jsonb not null default '{}'::jsonb,

  constraint movements_amount_non_negative
    check (amount >= 0),
  constraint movements_currency_supported
    check (currency in ('PEN', 'USD')),
  constraint movements_confidence_range
    check (confidence is null or (confidence >= 0 and confidence <= 1)),
  constraint movements_unique_idempotency
    unique (user_id, idempotency_key)
);

create trigger movements_updated_at
  before update on public.movements
  for each row execute function manzana.set_updated_at();

create index if not exists movements_user_occurred_at_idx
  on public.movements (user_id, occurred_at desc);

create index if not exists movements_user_type_idx
  on public.movements (user_id, type);

create index if not exists movements_user_category_idx
  on public.movements (user_id, category_id);

create index if not exists movements_user_account_origin_idx
  on public.movements (user_id, account_origin_id);

create unique index if not exists movements_user_source_ref_idx
  on public.movements (user_id, source, source_ref)
  where source_ref is not null and deleted_at is null;

comment on table public.movements is
  'Movimientos financieros confirmados. Pending items viven en otra tabla y no afectan saldos.';

comment on column public.movements.account_origin_id is
  'Puede ser null cuando el usuario no especifica cuenta; en ese caso no afecta saldos de cuentas.';

comment on column public.movements.idempotency_key is
  'Clave de idempotencia por usuario para evitar registros duplicados del Core.';

create table if not exists public.movement_audit_log (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  movement_id     uuid references public.movements(id),
  entity_type     text not null,
  entity_id       uuid not null,
  action          text not null,
  field_name      text,
  old_value       jsonb,
  new_value       jsonb,
  source          text not null,
  actor_type      text not null,
  actor_id        uuid,
  trace_id        uuid,
  created_at      timestamptz not null default now(),
  metadata        jsonb not null default '{}'::jsonb,

  constraint movement_audit_action_known
    check (action in ('created', 'updated', 'corrected', 'deleted', 'reversed')),
  constraint movement_audit_actor_known
    check (actor_type in ('user', 'agent', 'system', 'worker'))
);

create index if not exists movement_audit_user_created_idx
  on public.movement_audit_log (user_id, created_at desc);

create index if not exists movement_audit_movement_idx
  on public.movement_audit_log (movement_id, created_at desc);

comment on table public.movement_audit_log is
  'Audit log de cambios financieros relevantes. No se borra aunque el movimiento sea eliminado logicamente.';

create table if not exists public.movement_tags (
  movement_id   uuid not null references public.movements(id) on delete cascade,
  tag_id        uuid not null references public.tags(id),
  confidence    numeric(5,4),
  source        text not null,
  created_at    timestamptz not null default now(),
  metadata      jsonb not null default '{}'::jsonb,

  primary key (movement_id, tag_id),
  constraint movement_tags_confidence_range
    check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create index if not exists movement_tags_tag_idx
  on public.movement_tags (tag_id);

comment on table public.movement_tags is
  'Tags contextuales aplicados a movimientos confirmados.';

-- RLS: los clientes autenticados solo leen. Las escrituras financieras pasan por Core.
alter table public.movements enable row level security;
alter table public.movement_audit_log enable row level security;
alter table public.movement_tags enable row level security;

create policy "movements: select own"
  on public.movements for select
  using (auth.uid() = user_id);

create policy "movement_audit_log: select own"
  on public.movement_audit_log for select
  using (auth.uid() = user_id);

create policy "movement_tags: select own"
  on public.movement_tags for select
  using (
    exists (
      select 1
      from public.movements m
      where m.id = movement_tags.movement_id
        and m.user_id = auth.uid()
    )
  );

revoke all on public.movements from anon, authenticated;
revoke all on public.movement_audit_log from anon, authenticated;
revoke all on public.movement_tags from anon, authenticated;

grant select on public.movements to authenticated;
grant select on public.movement_audit_log to authenticated;
grant select on public.movement_tags to authenticated;

create or replace function manzana.apply_account_balance_deltas(
  p_user_id uuid,
  p_deltas jsonb
)
returns void
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  item jsonb;
  affected int;
begin
  for item in
    select value from jsonb_array_elements(coalesce(p_deltas, '[]'::jsonb))
  loop
    update public.accounts
       set current_balance = current_balance + (item->>'delta')::numeric
     where id = (item->>'account_id')::uuid
       and user_id = p_user_id
       and deleted_at is null;

    get diagnostics affected = row_count;
    if affected <> 1 then
      raise exception 'ACCOUNT_DELTA_TARGET_NOT_FOUND';
    end if;
  end loop;
end;
$$;

create or replace function manzana.apply_box_balance_deltas(
  p_user_id uuid,
  p_deltas jsonb
)
returns void
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  item jsonb;
  affected int;
begin
  for item in
    select value from jsonb_array_elements(coalesce(p_deltas, '[]'::jsonb))
  loop
    update public.boxes
       set current_balance = current_balance + (item->>'delta')::numeric
     where id = (item->>'box_id')::uuid
       and user_id = p_user_id
       and deleted_at is null;

    get diagnostics affected = row_count;
    if affected <> 1 then
      raise exception 'BOX_DELTA_TARGET_NOT_FOUND';
    end if;
  end loop;
end;
$$;

create or replace function manzana.insert_movement_audit_logs(
  p_audit_logs jsonb
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
    select value from jsonb_array_elements(coalesce(p_audit_logs, '[]'::jsonb))
  loop
    insert into public.movement_audit_log (
      id,
      user_id,
      movement_id,
      entity_type,
      entity_id,
      action,
      field_name,
      old_value,
      new_value,
      source,
      actor_type,
      actor_id,
      trace_id,
      metadata
    )
    values (
      coalesce((item->>'id')::uuid, gen_random_uuid()),
      (item->>'user_id')::uuid,
      nullif(item->>'movement_id', '')::uuid,
      item->>'entity_type',
      (item->>'entity_id')::uuid,
      item->>'action',
      nullif(item->>'field_name', ''),
      item->'old_value',
      item->'new_value',
      item->>'source',
      item->>'actor_type',
      nullif(item->>'actor_id', '')::uuid,
      nullif(item->>'trace_id', '')::uuid,
      coalesce(item->'metadata', '{}'::jsonb)
    );
  end loop;
end;
$$;

create or replace function manzana.core_commit_movement_create(
  p_movement jsonb,
  p_audit_logs jsonb,
  p_account_deltas jsonb,
  p_box_deltas jsonb
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
  p_box_deltas jsonb
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

  return v_movement;
end;
$$;

revoke all on function manzana.apply_account_balance_deltas(uuid, jsonb) from public, anon, authenticated;
revoke all on function manzana.apply_box_balance_deltas(uuid, jsonb) from public, anon, authenticated;
revoke all on function manzana.insert_movement_audit_logs(jsonb) from public, anon, authenticated;
revoke all on function manzana.core_commit_movement_create(jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function manzana.core_commit_movement_update(jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;

grant execute on function manzana.core_commit_movement_create(jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function manzana.core_commit_movement_update(jsonb, jsonb, jsonb, jsonb) to service_role;

-- Public REST wrappers for Supabase RPC.
-- The internal implementation stays in schema manzana; only service_role can execute.
create or replace function public.core_commit_movement_create(
  p_movement jsonb,
  p_audit_logs jsonb,
  p_account_deltas jsonb,
  p_box_deltas jsonb
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
    p_box_deltas
  );
$$;

create or replace function public.core_commit_movement_update(
  p_movement jsonb,
  p_audit_logs jsonb,
  p_account_deltas jsonb,
  p_box_deltas jsonb
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
    p_box_deltas
  );
$$;

revoke all on function public.core_commit_movement_create(jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.core_commit_movement_update(jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;

grant execute on function public.core_commit_movement_create(jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.core_commit_movement_update(jsonb, jsonb, jsonb, jsonb) to service_role;
