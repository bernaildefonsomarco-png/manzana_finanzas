-- =============================================================
-- Migration 057: Debt lifecycle operations through the Core
-- W-11 - close/reopen/reschedule/skip, atomic and idempotent
-- Depends on: 008, 013, 018, 021, 043, 056
-- =============================================================

create table if not exists public.debt_operation_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debt_id uuid not null references public.debts(id) on delete cascade,
  installment_id uuid references public.debt_installments(id) on delete cascade,
  operation text not null,
  idempotency_key text not null,
  request_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  constraint debt_operation_receipts_operation_known check (
    operation in ('close', 'reopen', 'reschedule_installment', 'skip_installment')
  ),
  constraint debt_operation_receipts_key_length check (
    length(idempotency_key) between 8 and 180
  ),
  constraint debt_operation_receipts_result_object check (
    jsonb_typeof(result) = 'object'
  ),
  constraint debt_operation_receipts_user_key_unique unique (
    user_id,
    idempotency_key
  )
);

create index if not exists debt_operation_receipts_debt_created_idx
  on public.debt_operation_receipts (user_id, debt_id, created_at desc);

alter table public.debt_operation_receipts enable row level security;

grant select, insert on public.debt_operation_receipts to service_role;

create or replace function manzana.commit_debt_operation(
  p_user_id uuid,
  p_debt_id uuid,
  p_operation text,
  p_payload jsonb,
  p_idempotency_key text,
  p_trace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_debt public.debts;
  v_installment public.debt_installments;
  v_existing public.debt_operation_receipts;
  v_request_hash text;
  v_reason text;
  v_due_date date;
  v_installment_id uuid;
  v_balance numeric(14,2);
  v_forgiven_balance numeric(14,2);
  v_now timestamptz := now();
  v_history jsonb;
  v_event_type text;
  v_result jsonb;
begin
  if p_user_id is null or p_debt_id is null or p_trace_id is null then
    raise exception 'DEBT_OPERATION_REQUIRED_IDENTIFIER';
  end if;
  if p_operation is null or p_operation not in (
    'close',
    'reopen',
    'reschedule_installment',
    'skip_installment'
  ) then
    raise exception 'DEBT_OPERATION_INVALID';
  end if;
  if nullif(trim(p_idempotency_key), '') is null
     or length(p_idempotency_key) not between 8 and 180 then
    raise exception 'DEBT_OPERATION_IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if coalesce(jsonb_typeof(p_payload), 'null') <> 'object' then
    raise exception 'DEBT_OPERATION_INVALID';
  end if;

  v_request_hash := encode(
    extensions.digest(
      jsonb_build_object(
        'debt_id', p_debt_id,
        'operation', p_operation,
        'payload', p_payload
      )::text,
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || p_idempotency_key, 0)
  );

  select *
    into v_existing
    from public.debt_operation_receipts
   where user_id = p_user_id
     and idempotency_key = p_idempotency_key
   for update;

  if found then
    if v_existing.debt_id <> p_debt_id
       or v_existing.operation <> p_operation
       or v_existing.request_hash <> v_request_hash then
      raise exception 'DEBT_OPERATION_IDEMPOTENCY_CONFLICT';
    end if;
    return v_existing.result || jsonb_build_object('idempotent', true);
  end if;

  -- Orden de bloqueo compartido con commit_debt_payment/lifecycle:
  -- primero deuda; después, si aplica, cuota.
  select *
    into v_debt
    from public.debts
   where id = p_debt_id
     and user_id = p_user_id
     and deleted_at is null
   for update;

  if not found then
    raise exception 'DEBT_OPERATION_NOT_FOUND';
  end if;

  if p_operation = 'close' then
    v_reason := p_payload->>'reason';
    if v_reason not in ('paid', 'forgiven') then
      raise exception 'DEBT_OPERATION_INVALID';
    end if;
    if v_debt.status not in (
      'active'::public.debt_status,
      'due_soon'::public.debt_status,
      'overdue'::public.debt_status
    ) then
      raise exception 'DEBT_OPERATION_CONFLICT';
    end if;

    v_balance := round(v_debt.current_balance, 2);
    if v_reason = 'paid' and v_balance <> 0 then
      raise exception 'DEBT_OPERATION_PAID_WITH_BALANCE';
    end if;
    if v_reason = 'forgiven' and v_balance <= 0 then
      raise exception 'DEBT_OPERATION_FORGIVEN_WITHOUT_BALANCE';
    end if;

    update public.debts
       set status = case
             when v_reason = 'paid' then 'paid'::public.debt_status
             else 'cancelled'::public.debt_status
           end,
           current_balance = case
             when v_reason = 'forgiven' then 0
             else v_balance
           end,
           closed_at = v_now,
           metadata = coalesce(metadata, '{}'::jsonb)
             || jsonb_strip_nulls(
               jsonb_build_object(
                 'forgiven_balance',
                   case when v_reason = 'forgiven' then v_balance else null end,
                 'last_close_reason', v_reason,
                 'last_close_idempotency_key', p_idempotency_key,
                 'last_close_trace_id', p_trace_id,
                 'last_close_at', v_now
               )
             )
     where id = v_debt.id
       and user_id = p_user_id
     returning * into v_debt;

    v_event_type := case
      when v_reason = 'paid' then 'debt_closed_paid'
      else 'debt_closed_forgiven'
    end;
    v_result := jsonb_build_object(
      'debt', to_jsonb(v_debt),
      'idempotent', false
    );

  elsif p_operation = 'reopen' then
    if v_debt.status = 'paid'::public.debt_status then
      raise exception 'DEBT_OPERATION_PAID_CANNOT_REOPEN';
    end if;
    if v_debt.status <> 'cancelled'::public.debt_status then
      raise exception 'DEBT_OPERATION_CONFLICT';
    end if;

    v_forgiven_balance :=
      nullif(v_debt.metadata->>'forgiven_balance', '')::numeric;
    if v_forgiven_balance is null or v_forgiven_balance <= 0 then
      raise exception 'DEBT_OPERATION_MISSING_FORGIVEN_BALANCE';
    end if;

    update public.debts
       set status = 'active'::public.debt_status,
           current_balance = round(v_forgiven_balance, 2),
           closed_at = null,
           metadata = coalesce(metadata, '{}'::jsonb)
             || jsonb_build_object(
               'last_reopen_idempotency_key', p_idempotency_key,
               'last_reopen_trace_id', p_trace_id,
               'last_reopen_at', v_now
             )
     where id = v_debt.id
       and user_id = p_user_id
     returning * into v_debt;

    v_event_type := 'debt_reopened';
    v_result := jsonb_build_object(
      'debt', to_jsonb(v_debt),
      'idempotent', false
    );

  else
    v_installment_id :=
      nullif(p_payload->>'installment_id', '')::uuid;
    if v_installment_id is null then
      raise exception 'DEBT_OPERATION_INSTALLMENT_REQUIRED';
    end if;

    select *
      into v_installment
      from public.debt_installments
     where id = v_installment_id
       and debt_id = v_debt.id
       and user_id = p_user_id
     for update;

    if not found then
      raise exception 'DEBT_OPERATION_NOT_FOUND';
    end if;
    if v_debt.status not in (
      'active'::public.debt_status,
      'due_soon'::public.debt_status,
      'overdue'::public.debt_status
    ) then
      raise exception 'DEBT_OPERATION_CONFLICT';
    end if;
    if v_installment.status not in (
      'pending'::public.installment_status,
      'due_soon'::public.installment_status,
      'overdue'::public.installment_status
    ) then
      raise exception 'DEBT_OPERATION_CONFLICT';
    end if;

    if p_operation = 'reschedule_installment' then
      v_due_date := nullif(p_payload->>'due_date', '')::date;
      if v_due_date is null then
        raise exception 'DEBT_OPERATION_INVALID';
      end if;
      v_reason := nullif(trim(p_payload->>'reason'), '');
      v_history := case
        when jsonb_typeof(v_installment.metadata->'reschedule_history') = 'array'
          then v_installment.metadata->'reschedule_history'
        else '[]'::jsonb
      end;

      update public.debt_installments
         set due_date = v_due_date,
             status = 'pending'::public.installment_status,
             metadata = coalesce(metadata, '{}'::jsonb)
               || jsonb_build_object(
                 'reschedule_history',
                 v_history || jsonb_build_array(
                   jsonb_strip_nulls(
                     jsonb_build_object(
                       'from', v_installment.due_date,
                       'to', v_due_date,
                       'reason', v_reason,
                       'changed_at', v_now,
                       'idempotency_key', p_idempotency_key,
                       'trace_id', p_trace_id
                     )
                   )
                 ),
                 'last_reschedule_idempotency_key', p_idempotency_key,
                 'last_reschedule_trace_id', p_trace_id,
                 'last_reschedule_at', v_now
               )
       where id = v_installment.id
         and debt_id = v_debt.id
         and user_id = p_user_id
       returning * into v_installment;

      update public.debts
         set next_payment_date = (
               select min(due_date)
                 from public.debt_installments
                where debt_id = v_debt.id
                  and user_id = p_user_id
                  and status in (
                    'pending'::public.installment_status,
                    'due_soon'::public.installment_status,
                    'overdue'::public.installment_status
                  )
             ),
             due_date = (
               select max(due_date)
                 from public.debt_installments
                where debt_id = v_debt.id
                  and user_id = p_user_id
             )
       where id = v_debt.id
         and user_id = p_user_id
       returning * into v_debt;

      v_event_type := 'debt_installment_rescheduled';
    else
      v_reason := nullif(trim(p_payload->>'reason'), '');
      if v_reason is null then
        raise exception 'DEBT_OPERATION_REASON_REQUIRED';
      end if;

      update public.debt_installments
         set status = 'skipped'::public.installment_status,
             metadata = coalesce(metadata, '{}'::jsonb)
               || jsonb_build_object(
                 'skip_reason', v_reason,
                 'last_skip_idempotency_key', p_idempotency_key,
                 'last_skip_trace_id', p_trace_id,
                 'last_skip_at', v_now
               )
       where id = v_installment.id
         and debt_id = v_debt.id
         and user_id = p_user_id
       returning * into v_installment;

      update public.debts
         set next_payment_date = (
               select min(due_date)
                 from public.debt_installments
                where debt_id = v_debt.id
                  and user_id = p_user_id
                  and status in (
                    'pending'::public.installment_status,
                    'due_soon'::public.installment_status,
                    'overdue'::public.installment_status
                  )
             )
       where id = v_debt.id
         and user_id = p_user_id
       returning * into v_debt;

      v_event_type := 'debt_installment_skipped';
    end if;

    v_result := jsonb_build_object(
      'debt', to_jsonb(v_debt),
      'installment', to_jsonb(v_installment),
      'idempotent', false
    );
  end if;

  insert into public.transactional_outbox (
    id,
    user_id,
    event_type,
    aggregate_type,
    aggregate_id,
    payload,
    payload_version,
    trace_id,
    metadata
  )
  values (
    gen_random_uuid(),
    p_user_id,
    v_event_type,
    case
      when v_installment_id is null then 'debt'
      else 'debt_installment'
    end,
    coalesce(v_installment_id, p_debt_id),
    jsonb_strip_nulls(
      jsonb_build_object(
        'debt_id', p_debt_id,
        'installment_id', v_installment_id,
        'operation', p_operation,
        'reason', v_reason,
        'due_date', v_due_date,
        'idempotency_key', p_idempotency_key
      )
    ),
    1,
    p_trace_id,
    jsonb_build_object(
      'source', 'debt_engine.operation_v1'
    )
  );

  insert into public.debt_operation_receipts (
    user_id,
    debt_id,
    installment_id,
    operation,
    idempotency_key,
    request_hash,
    result
  )
  values (
    p_user_id,
    p_debt_id,
    v_installment_id,
    p_operation,
    p_idempotency_key,
    v_request_hash,
    v_result
  );

  return v_result;
end;
$$;

create or replace function public.commit_debt_operation(
  p_user_id uuid,
  p_debt_id uuid,
  p_operation text,
  p_payload jsonb,
  p_idempotency_key text,
  p_trace_id uuid
)
returns jsonb
language sql
security definer
set search_path = public, manzana
as $$
  select manzana.commit_debt_operation(
    p_user_id,
    p_debt_id,
    p_operation,
    p_payload,
    p_idempotency_key,
    p_trace_id
  );
$$;

revoke all on function manzana.commit_debt_operation(
  uuid,
  uuid,
  text,
  jsonb,
  text,
  uuid
) from public, anon, authenticated;

revoke all on function public.commit_debt_operation(
  uuid,
  uuid,
  text,
  jsonb,
  text,
  uuid
) from public, anon, authenticated;

grant execute on function public.commit_debt_operation(
  uuid,
  uuid,
  text,
  jsonb,
  text,
  uuid
) to service_role;

comment on table public.debt_operation_receipts is
  'Recibos idempotentes de operaciones especializadas de lifecycle de deuda.';

comment on function public.commit_debt_operation(
  uuid,
  uuid,
  text,
  jsonb,
  text,
  uuid
) is
  'Debt Engine: cierre, reapertura y cambios de cuota atomicos, con lock deuda-cuota, idempotencia y outbox.';
