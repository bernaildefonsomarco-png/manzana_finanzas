-- =============================================================
-- Migration 043: atomic and idempotent debt creation
-- Depends on: 006, 008, 013, 042
-- =============================================================

alter table public.debts
  add column if not exists idempotency_key text;

create unique index if not exists debts_user_idempotency_unique_idx
  on public.debts (user_id, idempotency_key)
  where idempotency_key is not null;

create or replace function manzana.commit_debt_creation(
  p_debt jsonb,
  p_related_person_normalized_name text,
  p_installments jsonb,
  p_movement jsonb,
  p_movement_audit_logs jsonb,
  p_account_deltas jsonb,
  p_box_deltas jsonb,
  p_movement_outbox_events jsonb,
  p_debt_outbox_events jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_user_id uuid := (p_debt->>'user_id')::uuid;
  v_debt_id uuid := (p_debt->>'id')::uuid;
  v_direction public.debt_direction := (p_debt->>'direction')::public.debt_direction;
  v_existing public.debts;
  v_debt public.debts;
  v_person public.related_persons;
  v_movement public.movements;
  v_installments jsonb;
  v_existing_person_name text;
  v_installment_count integer :=
    nullif(p_debt->>'installment_count', '')::integer;
  v_schedule_count integer;
  v_schedule_distinct_numbers integer;
  v_schedule_min_number integer;
  v_schedule_max_number integer;
  v_schedule_total numeric;
  v_schedule_first_due date;
  v_schedule_last_due date;
begin
  if nullif(trim(p_debt->>'idempotency_key'), '') is null then
    raise exception 'DEBT_CREATION_IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if round((p_debt->>'principal_amount')::numeric, 2) <= 0 then
    raise exception 'DEBT_CREATION_INVALID_AMOUNT';
  end if;
  if p_debt->>'currency' not in ('PEN', 'USD') then
    raise exception 'DEBT_CREATION_INVALID_CURRENCY';
  end if;
  if
    v_installment_count is not null
    and (
      v_installment_count < 1
      or nullif(p_debt->>'first_due_date', '') is null
    )
  then
    raise exception 'DEBT_CREATION_INVALID_INSTALLMENTS';
  end if;
  if jsonb_typeof(coalesce(p_installments, '[]'::jsonb)) <> 'array' then
    raise exception 'DEBT_CREATION_INVALID_INSTALLMENTS';
  end if;

  select
    count(*)::integer,
    count(distinct (item->>'number')::integer)::integer,
    min((item->>'number')::integer),
    max((item->>'number')::integer),
    coalesce(sum(round((item->>'expected_amount')::numeric, 2)), 0),
    min((item->>'due_date')::date)
      filter (where (item->>'number')::integer = 1),
    max((item->>'due_date')::date)
      filter (
        where (item->>'number')::integer = v_installment_count
      )
  into
    v_schedule_count,
    v_schedule_distinct_numbers,
    v_schedule_min_number,
    v_schedule_max_number,
    v_schedule_total,
    v_schedule_first_due,
    v_schedule_last_due
  from jsonb_array_elements(coalesce(p_installments, '[]'::jsonb)) item;

  if
    (v_installment_count is null and v_schedule_count <> 0)
    or (
      v_installment_count is not null
      and (
        v_schedule_count <> v_installment_count
        or v_schedule_distinct_numbers <> v_installment_count
        or v_schedule_min_number <> 1
        or v_schedule_max_number <> v_installment_count
        or round(v_schedule_total, 2) <>
          round((p_debt->>'principal_amount')::numeric, 2)
        or v_schedule_first_due <>
          (p_debt->>'first_due_date')::date
        or v_schedule_last_due <>
          nullif(p_debt->>'due_date', '')::date
      )
    )
  then
    raise exception 'DEBT_CREATION_INVALID_INSTALLMENTS';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      v_user_id::text || ':' || (p_debt->>'idempotency_key'),
      0
    )
  );

  select *
    into v_existing
    from public.debts
   where user_id = v_user_id
     and idempotency_key = p_debt->>'idempotency_key'
   for update;

  if found then
    select normalized_name
      into v_existing_person_name
      from public.related_persons
     where id = v_existing.related_person_id
       and user_id = v_user_id;

    if
      v_existing.direction <> v_direction
      or v_existing.kind <>
        coalesce(
          nullif(p_debt->>'kind', '')::public.debt_kind,
          'personal'::public.debt_kind
        )
      or v_existing.name <> trim(p_debt->>'name')
      or v_existing.principal_amount <> round((p_debt->>'principal_amount')::numeric, 2)
      or v_existing.currency <> p_debt->>'currency'
      or v_existing.opened_at <> (p_debt->>'opened_at')::date
      or v_existing.installment_count is distinct from v_installment_count
      or v_existing.installment_amount is distinct from
        nullif(p_debt->>'installment_amount', '')::numeric
      or v_existing.next_payment_date is distinct from
        nullif(p_debt->>'first_due_date', '')::date
      or v_existing_person_name is distinct from
        p_related_person_normalized_name
    then
      raise exception 'DEBT_CREATION_IDEMPOTENCY_CONFLICT';
    end if;

    select *
      into v_movement
      from public.movements
     where user_id = v_user_id
       and debt_id = v_existing.id
     order by created_at asc
     limit 1;

    select coalesce(jsonb_agg(to_jsonb(item) order by item.number), '[]'::jsonb)
      into v_installments
      from public.debt_installments item
     where item.user_id = v_user_id
       and item.debt_id = v_existing.id;

    if exists (
      with requested_item as (
        select
          (candidate->>'number')::integer as number,
          (candidate->>'due_date')::date as due_date,
          round((candidate->>'expected_amount')::numeric, 2) as expected_amount
        from jsonb_array_elements(coalesce(p_installments, '[]'::jsonb))
          candidate
      ),
      existing_item as (
        select number, due_date, expected_amount
        from public.debt_installments
        where user_id = v_user_id
          and debt_id = v_existing.id
      )
      select 1
      from existing_item
      full outer join requested_item using (number)
      where requested_item.number is null
        or existing_item.number is null
        or existing_item.due_date <> requested_item.due_date
        or existing_item.expected_amount <> requested_item.expected_amount
    ) then
      raise exception 'DEBT_CREATION_IDEMPOTENCY_CONFLICT';
    end if;

    return jsonb_build_object(
      'debt', to_jsonb(v_existing),
      'installments', v_installments,
      'movement', case when v_movement.id is null then null else to_jsonb(v_movement) end,
      'idempotent', true
    );
  end if;

  select *
    into v_person
    from public.related_persons
   where user_id = v_user_id
     and normalized_name = p_related_person_normalized_name
     and deleted_at is null
   for update;

  if not found then
    insert into public.related_persons (
      user_id,
      display_name,
      normalized_name,
      kind,
      metadata
    )
    values (
      v_user_id,
      trim(p_debt->>'related_person_name'),
      p_related_person_normalized_name,
      'person_or_entity',
      jsonb_build_object('created_from', p_debt->>'source')
    )
    on conflict (user_id, normalized_name) where deleted_at is null
    do update set updated_at = now()
    returning * into v_person;
  end if;

  insert into public.debts (
    id,
    user_id,
    direction,
    kind,
    status,
    related_person_id,
    name,
    principal_amount,
    current_balance,
    currency,
    opened_at,
    due_date,
    next_payment_date,
    installment_count,
    installment_amount,
    interest_notes,
    source,
    confidence,
    idempotency_key,
    metadata
  )
  values (
    v_debt_id,
    v_user_id,
    v_direction,
    coalesce(nullif(p_debt->>'kind', '')::public.debt_kind, 'personal'::public.debt_kind),
    'active',
    v_person.id,
    trim(p_debt->>'name'),
    round((p_debt->>'principal_amount')::numeric, 2),
    round((p_debt->>'principal_amount')::numeric, 2),
    p_debt->>'currency',
    (p_debt->>'opened_at')::date,
    nullif(p_debt->>'due_date', '')::date,
    nullif(p_debt->>'first_due_date', '')::date,
    nullif(p_debt->>'installment_count', '')::integer,
    nullif(p_debt->>'installment_amount', '')::numeric,
    nullif(p_debt->>'interest_notes', ''),
    coalesce(nullif(p_debt->>'source', ''), 'whatsapp'),
    1,
    p_debt->>'idempotency_key',
    coalesce(p_debt->'metadata', '{}'::jsonb)
  )
  returning * into v_debt;

  insert into public.debt_installments (
    id,
    user_id,
    debt_id,
    number,
    due_date,
    expected_amount,
    paid_amount,
    status,
    metadata
  )
  select
    (item->>'id')::uuid,
    v_user_id,
    v_debt.id,
    (item->>'number')::integer,
    (item->>'due_date')::date,
    round((item->>'expected_amount')::numeric, 2),
    0,
    'pending'::public.installment_status,
    coalesce(item->'metadata', '{}'::jsonb)
  from jsonb_array_elements(coalesce(p_installments, '[]'::jsonb)) item;

  if p_movement is not null and p_movement <> 'null'::jsonb then
    if
      (p_movement->>'user_id')::uuid <> v_user_id
      or nullif(p_movement->>'debt_id', '')::uuid <> v_debt.id
      or round((p_movement->>'amount')::numeric, 2) <>
        v_debt.principal_amount
      or p_movement->>'currency' <> v_debt.currency
      or (
        v_direction = 'i_owe'::public.debt_direction
        and p_movement->>'type' <> 'prestamo_recibido'
      )
      or (
        v_direction = 'they_owe_me'::public.debt_direction
        and p_movement->>'type' <> 'prestamo_dado'
      )
    then
      raise exception 'DEBT_CREATION_INVALID_DIRECTION';
    end if;

    v_movement := manzana.core_commit_movement_create(
      p_movement,
      p_movement_audit_logs,
      p_account_deltas,
      p_box_deltas,
      p_movement_outbox_events
    );
  end if;

  perform manzana.insert_transactional_outbox_events(p_debt_outbox_events);

  select coalesce(jsonb_agg(to_jsonb(item) order by item.number), '[]'::jsonb)
    into v_installments
    from public.debt_installments item
   where item.user_id = v_user_id
     and item.debt_id = v_debt.id;

  return jsonb_build_object(
    'debt', to_jsonb(v_debt),
    'installments', v_installments,
    'movement', case when v_movement.id is null then null else to_jsonb(v_movement) end,
    'idempotent', false
  );
end;
$$;

create or replace function public.commit_debt_creation(
  p_debt jsonb,
  p_related_person_normalized_name text,
  p_installments jsonb,
  p_movement jsonb,
  p_movement_audit_logs jsonb,
  p_account_deltas jsonb,
  p_box_deltas jsonb,
  p_movement_outbox_events jsonb,
  p_debt_outbox_events jsonb
)
returns jsonb
language sql
security definer
set search_path = public, manzana
as $$
  select manzana.commit_debt_creation(
    p_debt,
    p_related_person_normalized_name,
    p_installments,
    p_movement,
    p_movement_audit_logs,
    p_account_deltas,
    p_box_deltas,
    p_movement_outbox_events,
    p_debt_outbox_events
  );
$$;

revoke all on function manzana.commit_debt_creation(
  jsonb, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function public.commit_debt_creation(
  jsonb, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.commit_debt_creation(
  jsonb, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) to service_role;

comment on function public.commit_debt_creation(
  jsonb, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) is
  'Crea deuda, persona, calendario, movimiento opcional y outbox de forma atomica e idempotente.';
