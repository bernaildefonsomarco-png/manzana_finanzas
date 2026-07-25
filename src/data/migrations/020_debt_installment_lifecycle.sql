-- =============================================================
-- Migration 020: Durable debt installment lifecycle
-- Corte 20 - Estados de vencimiento persistentes e idempotentes
-- Depends on: 008, 013, 018, 019
-- =============================================================

create or replace function manzana.refresh_debt_installment_lifecycle(
  p_user_id uuid,
  p_as_of_date date,
  p_due_soon_days integer,
  p_trace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_installment public.debt_installments;
  v_debt public.debts;
  v_installment_status public.installment_status;
  v_debt_status public.debt_status;
  v_event_type text;
  v_now timestamptz := now();
  v_events jsonb := '[]'::jsonb;
  v_transitions jsonb := '[]'::jsonb;
  v_installments_scanned integer := 0;
  v_installments_updated integer := 0;
  v_debts_scanned integer := 0;
  v_debts_updated integer := 0;
begin
  if p_user_id is null then
    raise exception 'DEBT_LIFECYCLE_USER_REQUIRED';
  end if;

  if p_as_of_date is null then
    raise exception 'DEBT_LIFECYCLE_DATE_REQUIRED';
  end if;

  if p_due_soon_days < 1 or p_due_soon_days > 14 then
    raise exception 'DEBT_LIFECYCLE_DUE_SOON_DAYS_OUT_OF_RANGE';
  end if;

  for v_installment in
    select installment.*
      from public.debt_installments installment
      join public.debts debt
        on debt.id = installment.debt_id
       and debt.user_id = installment.user_id
     where installment.user_id = p_user_id
       and installment.status in (
         'pending'::public.installment_status,
         'due_soon'::public.installment_status,
         'overdue'::public.installment_status
       )
       and installment.paid_amount < installment.expected_amount
       and debt.status in (
         'active'::public.debt_status,
         'due_soon'::public.debt_status,
         'overdue'::public.debt_status
       )
       and debt.current_balance > 0
       and debt.deleted_at is null
     order by installment.due_date, installment.number
     for update of installment
  loop
    v_installments_scanned := v_installments_scanned + 1;
    v_installment_status := case
      when v_installment.due_date < p_as_of_date
        then 'overdue'::public.installment_status
      when v_installment.due_date <= p_as_of_date + p_due_soon_days
        then 'due_soon'::public.installment_status
      else 'pending'::public.installment_status
    end;

    if v_installment_status = v_installment.status then
      continue;
    end if;

    update public.debt_installments
       set status = v_installment_status,
           metadata = coalesce(metadata, '{}'::jsonb)
             || jsonb_build_object(
               'lifecycle_source', 'debt_engine_v1',
               'lifecycle_previous_status', v_installment.status,
               'lifecycle_transitioned_at', v_now,
               'lifecycle_as_of_date', p_as_of_date,
               'lifecycle_due_soon_days', p_due_soon_days
             )
     where id = v_installment.id
       and user_id = p_user_id;

    v_installments_updated := v_installments_updated + 1;
    v_event_type := case v_installment_status
      when 'due_soon'::public.installment_status
        then 'debt_installment_due_soon'
      when 'overdue'::public.installment_status
        then 'debt_installment_overdue'
      else 'debt_installment_pending'
    end;

    v_transitions := v_transitions || jsonb_build_array(
      jsonb_build_object(
        'entity_type', 'debt_installment',
        'entity_id', v_installment.id,
        'debt_id', v_installment.debt_id,
        'previous_status', v_installment.status,
        'status', v_installment_status
      )
    );
    v_events := v_events || jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid(),
        'user_id', p_user_id,
        'event_type', v_event_type,
        'aggregate_type', 'debt_installment',
        'aggregate_id', v_installment.id,
        'payload', jsonb_build_object(
          'debt_id', v_installment.debt_id,
          'installment_id', v_installment.id,
          'installment_number', v_installment.number,
          'due_date', v_installment.due_date,
          'previous_status', v_installment.status,
          'status', v_installment_status,
          'as_of_date', p_as_of_date,
          'due_soon_days', p_due_soon_days
        ),
        'payload_version', 1,
        'trace_id', p_trace_id,
        'metadata', jsonb_build_object(
          'source', 'debt_engine.lifecycle_v1'
        )
      )
    );
  end loop;

  for v_debt in
    select debt.*
      from public.debts debt
     where debt.user_id = p_user_id
       and debt.status in (
         'active'::public.debt_status,
         'due_soon'::public.debt_status,
         'overdue'::public.debt_status
       )
       and debt.current_balance > 0
       and debt.deleted_at is null
       and exists (
         select 1
           from public.debt_installments installment
          where installment.user_id = p_user_id
            and installment.debt_id = debt.id
       )
     order by debt.id
     for update of debt
  loop
    v_debts_scanned := v_debts_scanned + 1;

    select case
      when exists (
        select 1
          from public.debt_installments installment
         where installment.user_id = p_user_id
           and installment.debt_id = v_debt.id
           and installment.status = 'overdue'::public.installment_status
           and installment.paid_amount < installment.expected_amount
      ) then 'overdue'::public.debt_status
      when exists (
        select 1
          from public.debt_installments installment
         where installment.user_id = p_user_id
           and installment.debt_id = v_debt.id
           and installment.status = 'due_soon'::public.installment_status
           and installment.paid_amount < installment.expected_amount
      ) then 'due_soon'::public.debt_status
      else 'active'::public.debt_status
    end
    into v_debt_status;

    if v_debt_status = v_debt.status then
      continue;
    end if;

    update public.debts
       set status = v_debt_status,
           metadata = coalesce(metadata, '{}'::jsonb)
             || jsonb_build_object(
               'lifecycle_source', 'debt_engine_v1',
               'lifecycle_previous_status', v_debt.status,
               'lifecycle_transitioned_at', v_now,
               'lifecycle_as_of_date', p_as_of_date,
               'lifecycle_due_soon_days', p_due_soon_days
             )
     where id = v_debt.id
       and user_id = p_user_id;

    v_debts_updated := v_debts_updated + 1;
    v_event_type := case v_debt_status
      when 'due_soon'::public.debt_status then 'debt_due_soon'
      when 'overdue'::public.debt_status then 'debt_overdue'
      else 'debt_active'
    end;

    v_transitions := v_transitions || jsonb_build_array(
      jsonb_build_object(
        'entity_type', 'debt',
        'entity_id', v_debt.id,
        'previous_status', v_debt.status,
        'status', v_debt_status
      )
    );
    v_events := v_events || jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid(),
        'user_id', p_user_id,
        'event_type', v_event_type,
        'aggregate_type', 'debt',
        'aggregate_id', v_debt.id,
        'payload', jsonb_build_object(
          'debt_id', v_debt.id,
          'previous_status', v_debt.status,
          'status', v_debt_status,
          'as_of_date', p_as_of_date,
          'due_soon_days', p_due_soon_days
        ),
        'payload_version', 1,
        'trace_id', p_trace_id,
        'metadata', jsonb_build_object(
          'source', 'debt_engine.lifecycle_v1'
        )
      )
    );
  end loop;

  perform manzana.insert_transactional_outbox_events(v_events);

  return jsonb_build_object(
    'as_of_date', p_as_of_date,
    'due_soon_days', p_due_soon_days,
    'installments_scanned', v_installments_scanned,
    'installments_updated', v_installments_updated,
    'debts_scanned', v_debts_scanned,
    'debts_updated', v_debts_updated,
    'events_created', jsonb_array_length(v_events),
    'transitions', v_transitions
  );
end;
$$;

create or replace function public.refresh_debt_installment_lifecycle(
  p_user_id uuid,
  p_as_of_date date,
  p_due_soon_days integer,
  p_trace_id uuid
)
returns jsonb
language sql
security definer
set search_path = public, manzana
as $$
  select manzana.refresh_debt_installment_lifecycle(
    p_user_id,
    p_as_of_date,
    p_due_soon_days,
    p_trace_id
  );
$$;

revoke all on function manzana.refresh_debt_installment_lifecycle(
  uuid,
  date,
  integer,
  uuid
) from public, anon, authenticated;

revoke all on function public.refresh_debt_installment_lifecycle(
  uuid,
  date,
  integer,
  uuid
) from public, anon, authenticated;

grant execute on function public.refresh_debt_installment_lifecycle(
  uuid,
  date,
  integer,
  uuid
) to service_role;

comment on function public.refresh_debt_installment_lifecycle(
  uuid,
  date,
  integer,
  uuid
) is
  'Debt Engine: persiste estados de vencimiento y outbox de forma idempotente. No modifica importes, pagos, movimientos, cuentas, cajas ni saldos.';
