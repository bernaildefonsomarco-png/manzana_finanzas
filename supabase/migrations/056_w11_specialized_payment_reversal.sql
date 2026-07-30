-- =============================================================
-- Migration 056: W-11 specialized payment reversal invariants
-- Depends on: 001-055
-- =============================================================

-- A payment that was reversed remains as immutable evidence. Queries that
-- calculate balances/allocations must ignore rows with reversed_at.
alter table public.debt_payments
  add column if not exists reversed_at timestamptz,
  add column if not exists reversal_reason text;

alter table public.debt_payment_allocations
  add column if not exists reversed_at timestamptz;

create index if not exists debt_payments_active_movement_idx
  on public.debt_payments (user_id, movement_id)
  where reversed_at is null;

create index if not exists debt_allocations_active_payment_idx
  on public.debt_payment_allocations (debt_payment_id, debt_installment_id)
  where reversed_at is null;

-- `requires_confirmation_for_payment` is an invariant, not a client default.
-- Expected occurrences never become money without an explicit confirmation.
alter table public.recurring_rules
  drop constraint if exists recurring_rules_payment_requires_confirmation;

alter table public.recurring_rules
  add constraint recurring_rules_payment_requires_confirmation
  check (requires_confirmation_for_payment is true);

create or replace function manzana.reverse_recurring_payment(
  p_user_id uuid,
  p_movement_id uuid,
  p_reason text,
  p_mode text,
  p_trace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_movement public.movements;
  v_saved_movement public.movements;
  v_occurrence public.recurring_occurrences;
  v_rule public.recurring_rules;
  v_latest_paid public.recurring_occurrences;
  v_status public.movement_status;
  v_deleted_at timestamptz;
  v_account_deltas jsonb := '[]'::jsonb;
  v_box_deltas jsonb := '[]'::jsonb;
  v_audit jsonb;
  v_events jsonb;
begin
  if nullif(trim(p_reason), '') is null then
    raise exception 'SPECIALIZED_REVERSAL_REASON_REQUIRED';
  end if;
  if p_mode not in ('soft_delete', 'reverse') then
    raise exception 'SPECIALIZED_REVERSAL_MODE_INVALID';
  end if;

  select *
    into v_movement
    from public.movements
   where id = p_movement_id
     and user_id = p_user_id
   for update;

  if not found then
    raise exception 'MOVEMENT_NOT_FOUND';
  end if;
  if v_movement.type <> 'pago_recurrente'
     or v_movement.recurring_rule_id is null
     or v_movement.recurring_occurrence_id is null then
    raise exception 'RECURRING_PAYMENT_MOVEMENT_REQUIRED';
  end if;

  select *
    into v_occurrence
    from public.recurring_occurrences
   where id = v_movement.recurring_occurrence_id
     and recurring_rule_id = v_movement.recurring_rule_id
     and user_id = p_user_id
   for update;

  if not found then
    raise exception 'RECURRING_OCCURRENCE_NOT_FOUND';
  end if;

  select *
    into v_rule
    from public.recurring_rules
   where id = v_movement.recurring_rule_id
     and user_id = p_user_id
     and deleted_at is null
   for update;

  if not found then
    raise exception 'RECURRING_RULE_NOT_FOUND';
  end if;

  if v_movement.status in ('deleted', 'reversed') then
    if v_occurrence.status = 'paid' then
      raise exception 'SPECIALIZED_REVERSAL_INCONSISTENT_STATE';
    end if;
    return jsonb_build_object(
      'movement', to_jsonb(v_movement),
      'recurring_rule', to_jsonb(v_rule),
      'occurrence', to_jsonb(v_occurrence),
      'idempotent', true
    );
  end if;

  if v_occurrence.status <> 'paid'
     or v_occurrence.paid_movement_id is distinct from v_movement.id then
    raise exception 'RECURRING_OCCURRENCE_NOT_PAID_BY_MOVEMENT';
  end if;

  if v_movement.account_origin_id is not null then
    v_account_deltas := v_account_deltas || jsonb_build_array(
      jsonb_build_object(
        'account_id', v_movement.account_origin_id,
        'delta', round(v_movement.amount, 2)
      )
    );
  end if;
  if v_movement.account_destination_id is not null then
    v_account_deltas := v_account_deltas || jsonb_build_array(
      jsonb_build_object(
        'account_id', v_movement.account_destination_id,
        'delta', -round(v_movement.amount, 2)
      )
    );
  end if;
  if v_movement.box_origin_id is not null then
    v_box_deltas := v_box_deltas || jsonb_build_array(
      jsonb_build_object(
        'box_id', v_movement.box_origin_id,
        'delta', round(v_movement.amount, 2)
      )
    );
  end if;
  if v_movement.box_destination_id is not null then
    v_box_deltas := v_box_deltas || jsonb_build_array(
      jsonb_build_object(
        'box_id', v_movement.box_destination_id,
        'delta', -round(v_movement.amount, 2)
      )
    );
  end if;

  v_status := case
    when p_mode = 'reverse' then 'reversed'::public.movement_status
    else 'deleted'::public.movement_status
  end;
  v_deleted_at := case when p_mode = 'soft_delete' then now() else null end;
  v_audit := jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid(),
      'user_id', p_user_id,
      'movement_id', v_movement.id,
      'entity_type', 'movement',
      'entity_id', v_movement.id,
      'action', v_status::text,
      'field_name', 'status',
      'old_value', to_jsonb(v_movement.status::text),
      'new_value', to_jsonb(v_status::text),
      'source', 'w11.specialized_recurring_reversal',
      'actor_type', 'user',
      'actor_id', p_user_id,
      'trace_id', p_trace_id,
      'metadata', jsonb_build_object(
        'reason', p_reason,
        'recurring_rule_id', v_rule.id,
        'recurring_occurrence_id', v_occurrence.id
      )
    )
  );
  v_events := jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid(),
      'user_id', p_user_id,
      'event_type', case
        when p_mode = 'reverse' then 'movement_reversed'
        else 'movement_deleted'
      end,
      'aggregate_type', 'movement',
      'aggregate_id', v_movement.id,
      'payload', jsonb_build_object(
        'movement_id', v_movement.id,
        'reason', p_reason,
        'specialized_engine', 'recurring'
      ),
      'payload_version', 1,
      'trace_id', p_trace_id,
      'metadata', jsonb_build_object('source', 'api.v1.movements.delete')
    ),
    jsonb_build_object(
      'id', gen_random_uuid(),
      'user_id', p_user_id,
      'event_type', 'recurring_payment_reversed',
      'aggregate_type', 'recurring_rule',
      'aggregate_id', v_rule.id,
      'payload', jsonb_build_object(
        'movement_id', v_movement.id,
        'recurring_occurrence_id', v_occurrence.id,
        'reason', p_reason
      ),
      'payload_version', 1,
      'trace_id', p_trace_id,
      'metadata', jsonb_build_object('source', 'api.v1.movements.delete')
    )
  );

  v_saved_movement := manzana.core_commit_movement_update(
    to_jsonb(v_movement)
      || jsonb_build_object(
        'status', v_status::text,
        'deleted_at', v_deleted_at,
        'metadata', coalesce(v_movement.metadata, '{}'::jsonb)
          || jsonb_build_object(
            'delete_reason', p_reason,
            'delete_mode', p_mode,
            'status_before_delete', v_movement.status::text,
            'specialized_engine', 'recurring'
          )
      ),
    v_audit,
    v_account_deltas,
    v_box_deltas,
    v_events
  );

  update public.recurring_occurrences
     set status = 'expected'::public.recurring_occurrence_status,
         paid_at = null,
         paid_movement_id = null,
         metadata = coalesce(metadata, '{}'::jsonb)
           || jsonb_build_object(
             'reversed_movement_id', v_movement.id,
             'reversal_reason', p_reason,
             'reversed_at', now()
           )
   where id = v_occurrence.id
   returning * into v_occurrence;

  select occurrence.*
    into v_latest_paid
    from public.recurring_occurrences occurrence
   where occurrence.user_id = p_user_id
     and occurrence.recurring_rule_id = v_rule.id
     and occurrence.status = 'paid'
   order by occurrence.paid_at desc nulls last, occurrence.expected_date desc
   limit 1;

  update public.recurring_rules
     set next_expected_date = least(
           coalesce(next_expected_date, v_occurrence.expected_date),
           v_occurrence.expected_date
         ),
         last_paid_at = v_latest_paid.paid_at,
         last_paid_amount = case
           when v_latest_paid.id is null then null
           else nullif(v_latest_paid.metadata->>'last_paid_amount', '')::numeric
         end,
         metadata = coalesce(metadata, '{}'::jsonb)
           || jsonb_build_object(
             'last_reversed_movement_id', v_movement.id,
             'last_reversal_at', now()
           )
   where id = v_rule.id
   returning * into v_rule;

  return jsonb_build_object(
    'movement', to_jsonb(v_saved_movement),
    'recurring_rule', to_jsonb(v_rule),
    'occurrence', to_jsonb(v_occurrence),
    'idempotent', false
  );
end;
$$;

create or replace function manzana.reverse_debt_payment(
  p_user_id uuid,
  p_movement_id uuid,
  p_reason text,
  p_mode text,
  p_trace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_movement public.movements;
  v_saved_movement public.movements;
  v_payment public.debt_payments;
  v_debt public.debts;
  v_status public.movement_status;
  v_deleted_at timestamptz;
  v_account_deltas jsonb := '[]'::jsonb;
  v_box_deltas jsonb := '[]'::jsonb;
  v_audit jsonb;
  v_events jsonb;
  v_new_balance numeric;
begin
  if nullif(trim(p_reason), '') is null then
    raise exception 'SPECIALIZED_REVERSAL_REASON_REQUIRED';
  end if;
  if p_mode not in ('soft_delete', 'reverse') then
    raise exception 'SPECIALIZED_REVERSAL_MODE_INVALID';
  end if;

  select *
    into v_movement
    from public.movements
   where id = p_movement_id
     and user_id = p_user_id
   for update;

  if not found then
    raise exception 'MOVEMENT_NOT_FOUND';
  end if;
  if v_movement.type not in ('pago_deuda', 'devolucion_recibida')
     or v_movement.debt_id is null then
    raise exception 'DEBT_PAYMENT_MOVEMENT_REQUIRED';
  end if;

  select *
    into v_payment
    from public.debt_payments
   where movement_id = v_movement.id
     and debt_id = v_movement.debt_id
     and user_id = p_user_id
   for update;

  if not found then
    raise exception 'DEBT_PAYMENT_NOT_FOUND';
  end if;

  select *
    into v_debt
    from public.debts
   where id = v_payment.debt_id
     and user_id = p_user_id
     and deleted_at is null
   for update;

  if not found then
    raise exception 'DEBT_NOT_FOUND';
  end if;

  if v_movement.status in ('deleted', 'reversed') then
    if v_payment.reversed_at is null then
      raise exception 'SPECIALIZED_REVERSAL_INCONSISTENT_STATE';
    end if;
    return jsonb_build_object(
      'movement', to_jsonb(v_movement),
      'debt', to_jsonb(v_debt),
      'payment', to_jsonb(v_payment),
      'idempotent', true
    );
  end if;
  if v_payment.reversed_at is not null then
    raise exception 'DEBT_PAYMENT_ALREADY_REVERSED';
  end if;
  if v_debt.status = 'cancelled'::public.debt_status then
    raise exception 'DEBT_REVERSAL_CLOSED_DEBT_REOPEN_REQUIRED';
  end if;

  v_new_balance := round(v_debt.current_balance + v_payment.amount, 2);
  if v_new_balance > v_debt.principal_amount then
    raise exception 'DEBT_REVERSAL_EXCEEDS_PRINCIPAL';
  end if;

  if v_movement.account_origin_id is not null then
    v_account_deltas := v_account_deltas || jsonb_build_array(
      jsonb_build_object(
        'account_id', v_movement.account_origin_id,
        'delta', round(v_movement.amount, 2)
      )
    );
  end if;
  if v_movement.account_destination_id is not null then
    v_account_deltas := v_account_deltas || jsonb_build_array(
      jsonb_build_object(
        'account_id', v_movement.account_destination_id,
        'delta', -round(v_movement.amount, 2)
      )
    );
  end if;
  if v_movement.box_origin_id is not null then
    v_box_deltas := v_box_deltas || jsonb_build_array(
      jsonb_build_object(
        'box_id', v_movement.box_origin_id,
        'delta', round(v_movement.amount, 2)
      )
    );
  end if;
  if v_movement.box_destination_id is not null then
    v_box_deltas := v_box_deltas || jsonb_build_array(
      jsonb_build_object(
        'box_id', v_movement.box_destination_id,
        'delta', -round(v_movement.amount, 2)
      )
    );
  end if;

  v_status := case
    when p_mode = 'reverse' then 'reversed'::public.movement_status
    else 'deleted'::public.movement_status
  end;
  v_deleted_at := case when p_mode = 'soft_delete' then now() else null end;
  v_audit := jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid(),
      'user_id', p_user_id,
      'movement_id', v_movement.id,
      'entity_type', 'movement',
      'entity_id', v_movement.id,
      'action', v_status::text,
      'field_name', 'status',
      'old_value', to_jsonb(v_movement.status::text),
      'new_value', to_jsonb(v_status::text),
      'source', 'w11.specialized_debt_reversal',
      'actor_type', 'user',
      'actor_id', p_user_id,
      'trace_id', p_trace_id,
      'metadata', jsonb_build_object(
        'reason', p_reason,
        'debt_id', v_debt.id,
        'debt_payment_id', v_payment.id
      )
    )
  );
  v_events := jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid(),
      'user_id', p_user_id,
      'event_type', case
        when p_mode = 'reverse' then 'movement_reversed'
        else 'movement_deleted'
      end,
      'aggregate_type', 'movement',
      'aggregate_id', v_movement.id,
      'payload', jsonb_build_object(
        'movement_id', v_movement.id,
        'reason', p_reason,
        'specialized_engine', 'debt'
      ),
      'payload_version', 1,
      'trace_id', p_trace_id,
      'metadata', jsonb_build_object('source', 'api.v1.movements.delete')
    ),
    jsonb_build_object(
      'id', gen_random_uuid(),
      'user_id', p_user_id,
      'event_type', 'debt_payment_reversed',
      'aggregate_type', 'debt',
      'aggregate_id', v_debt.id,
      'payload', jsonb_build_object(
        'movement_id', v_movement.id,
        'debt_payment_id', v_payment.id,
        'reason', p_reason
      ),
      'payload_version', 1,
      'trace_id', p_trace_id,
      'metadata', jsonb_build_object('source', 'api.v1.movements.delete')
    )
  );

  v_saved_movement := manzana.core_commit_movement_update(
    to_jsonb(v_movement)
      || jsonb_build_object(
        'status', v_status::text,
        'deleted_at', v_deleted_at,
        'metadata', coalesce(v_movement.metadata, '{}'::jsonb)
          || jsonb_build_object(
            'delete_reason', p_reason,
            'delete_mode', p_mode,
            'status_before_delete', v_movement.status::text,
            'specialized_engine', 'debt'
          )
      ),
    v_audit,
    v_account_deltas,
    v_box_deltas,
    v_events
  );

  update public.debt_payments
     set reversed_at = now(),
         reversal_reason = p_reason,
         metadata = coalesce(metadata, '{}'::jsonb)
           || jsonb_build_object(
             'reversed_movement_id', v_movement.id,
             'reversed_at', now()
           )
   where id = v_payment.id
   returning * into v_payment;

  update public.debt_payment_allocations
     set reversed_at = now(),
         metadata = coalesce(metadata, '{}'::jsonb)
           || jsonb_build_object(
             'reversed_movement_id', v_movement.id,
             'reversed_at', now()
           )
   where debt_payment_id = v_payment.id
     and user_id = p_user_id
     and reversed_at is null;

  update public.debt_installments installment
     set paid_amount = active.paid_amount,
         movement_id = active.latest_movement_id,
         status = case
           -- Skipped/rescheduled are terminal decisions unrelated to this
           -- payment. Reversing another installment must not reopen them
           -- (`AC-DEUDAS-15`).
           when installment.status in (
             'skipped'::public.installment_status,
             'rescheduled'::public.installment_status
           )
             then installment.status
           when active.paid_amount >= installment.expected_amount
             then 'paid'::public.installment_status
           else 'pending'::public.installment_status
         end,
         metadata = coalesce(installment.metadata, '{}'::jsonb)
           || jsonb_build_object(
             'last_reversed_movement_id', v_movement.id,
             'last_reversal_at', now()
           )
    from (
      select target.id,
             coalesce(sum(allocation.allocated_amount)
               filter (where allocation.reversed_at is null), 0) as paid_amount,
             (
               array_agg(allocation.movement_id order by allocation.created_at desc)
                 filter (where allocation.reversed_at is null)
             )[1] as latest_movement_id
        from public.debt_installments target
        left join public.debt_payment_allocations allocation
          on allocation.debt_installment_id = target.id
       where target.debt_id = v_debt.id
         and target.user_id = p_user_id
       group by target.id
    ) active
   where installment.id = active.id;

  update public.debts
     set current_balance = v_new_balance,
         status = 'active'::public.debt_status,
         closed_at = null,
         last_payment_at = (
           select max(payment.paid_at)
             from public.debt_payments payment
            where payment.debt_id = v_debt.id
              and payment.user_id = p_user_id
              and payment.reversed_at is null
         ),
         metadata = coalesce(metadata, '{}'::jsonb)
           || jsonb_build_object(
             'last_reversed_payment_id', v_payment.id,
             'last_reversed_movement_id', v_movement.id,
             'last_reversal_at', now()
           )
   where id = v_debt.id
   returning * into v_debt;

  return jsonb_build_object(
    'movement', to_jsonb(v_saved_movement),
    'debt', to_jsonb(v_debt),
    'payment', to_jsonb(v_payment),
    'idempotent', false
  );
end;
$$;

create or replace function public.reverse_recurring_payment(
  p_user_id uuid,
  p_movement_id uuid,
  p_reason text,
  p_mode text,
  p_trace_id uuid
)
returns jsonb
language sql
security definer
set search_path = public, manzana
as $$
  select manzana.reverse_recurring_payment(
    p_user_id,
    p_movement_id,
    p_reason,
    p_mode,
    p_trace_id
  );
$$;

create or replace function public.reverse_debt_payment(
  p_user_id uuid,
  p_movement_id uuid,
  p_reason text,
  p_mode text,
  p_trace_id uuid
)
returns jsonb
language sql
security definer
set search_path = public, manzana
as $$
  select manzana.reverse_debt_payment(
    p_user_id,
    p_movement_id,
    p_reason,
    p_mode,
    p_trace_id
  );
$$;

revoke all on function manzana.reverse_recurring_payment(uuid, uuid, text, text, uuid)
  from public, anon, authenticated;
revoke all on function manzana.reverse_debt_payment(uuid, uuid, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.reverse_recurring_payment(uuid, uuid, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.reverse_debt_payment(uuid, uuid, text, text, uuid)
  from public, anon, authenticated;

grant execute on function public.reverse_recurring_payment(uuid, uuid, text, text, uuid)
  to service_role;
grant execute on function public.reverse_debt_payment(uuid, uuid, text, text, uuid)
  to service_role;

comment on function public.reverse_recurring_payment(uuid, uuid, text, text, uuid) is
  'W-11: atomically reverses a recurring payment movement, balances, occurrence, rule, audit and outbox.';

comment on function public.reverse_debt_payment(uuid, uuid, text, text, uuid) is
  'W-11: atomically reverses a debt payment movement, balances, payment, allocations, installments, debt, audit and outbox.';
