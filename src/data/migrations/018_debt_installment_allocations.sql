-- =============================================================
-- Migration 018: Atomic debt payment to installment allocation
-- Corte 17 - Conciliacion pago-cuota dentro de Core
-- Depends on: 013, 014
-- =============================================================

create table if not exists public.debt_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debt_id uuid not null references public.debts(id) on delete cascade,
  debt_payment_id uuid not null references public.debt_payments(id) on delete cascade,
  debt_installment_id uuid not null references public.debt_installments(id) on delete cascade,
  movement_id uuid not null references public.movements(id),
  allocated_amount numeric(14,2) not null,
  allocation_order integer not null,
  policy text not null default 'oldest_open_due_date_first_v1',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint debt_payment_allocations_amount_positive
    check (allocated_amount > 0),
  constraint debt_payment_allocations_order_positive
    check (allocation_order > 0),
  constraint debt_payment_allocations_payment_installment_unique
    unique (debt_payment_id, debt_installment_id)
);

create index if not exists debt_payment_allocations_user_debt_idx
  on public.debt_payment_allocations (user_id, debt_id, created_at desc);

create index if not exists debt_payment_allocations_installment_idx
  on public.debt_payment_allocations (debt_installment_id, created_at);

alter table public.debt_payment_allocations enable row level security;

create policy "debt_payment_allocations: select own"
  on public.debt_payment_allocations for select
  using (auth.uid() = user_id);

create policy "debt_payment_allocations: no client write"
  on public.debt_payment_allocations for all
  using (false)
  with check (false);

grant select on public.debt_payment_allocations to authenticated;
grant select, insert on public.debt_payment_allocations to service_role;

create or replace function manzana.commit_debt_payment(
  p_debt_id uuid,
  p_payment jsonb,
  p_movement jsonb,
  p_audit_logs jsonb,
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
  v_debt public.debts;
  v_movement public.movements;
  v_existing_payment public.debt_payments;
  v_payment public.debt_payments;
  v_installment public.debt_installments;
  v_allocation public.debt_payment_allocations;
  v_user_id uuid := (p_movement->>'user_id')::uuid;
  v_amount numeric := round((p_payment->>'amount')::numeric, 2);
  v_new_balance numeric;
  v_expected_type text;
  v_remaining numeric;
  v_allocate numeric;
  v_new_installment_paid numeric;
  v_allocation_order integer := 0;
  v_allocations jsonb := '[]'::jsonb;
  v_existing_allocations jsonb := '[]'::jsonb;
  v_has_installments boolean := false;
  v_next_payment_date date;
begin
  select *
    into v_debt
    from public.debts
   where id = p_debt_id
     and user_id = v_user_id
     and deleted_at is null
   for update;

  if not found then
    raise exception 'DEBT_NOT_FOUND';
  end if;

  select *
    into v_movement
    from public.movements
   where user_id = v_user_id
     and idempotency_key = p_movement->>'idempotency_key';

  if found then
    select *
      into v_existing_payment
      from public.debt_payments
     where user_id = v_user_id
       and movement_id = v_movement.id;

    if not found then
      raise exception 'DEBT_PAYMENT_IDEMPOTENCY_CONFLICT';
    end if;

    select coalesce(
      jsonb_agg(to_jsonb(allocation) order by allocation.allocation_order),
      '[]'::jsonb
    )
      into v_existing_allocations
      from public.debt_payment_allocations allocation
     where allocation.user_id = v_user_id
       and allocation.debt_payment_id = v_existing_payment.id;

    return jsonb_build_object(
      'movement', to_jsonb(v_movement),
      'debt', to_jsonb(v_debt),
      'payment', to_jsonb(v_existing_payment),
      'installment_allocations', v_existing_allocations,
      'allocation_policy', 'oldest_open_due_date_first_v1',
      'idempotent', true
    );
  end if;

  if v_debt.status in ('paid', 'cancelled', 'archived') then
    raise exception 'DEBT_NOT_ACTIVE';
  end if;

  if v_amount <= 0 then
    raise exception 'DEBT_PAYMENT_INVALID_AMOUNT';
  end if;

  if v_amount > v_debt.current_balance then
    raise exception 'DEBT_PAYMENT_EXCEEDS_BALANCE';
  end if;

  v_expected_type := case
    when v_debt.direction = 'i_owe' then 'pago_deuda'
    else 'devolucion_recibida'
  end;

  if p_movement->>'type' <> v_expected_type then
    raise exception 'DEBT_PAYMENT_MOVEMENT_TYPE_MISMATCH';
  end if;

  if nullif(p_movement->>'debt_id', '')::uuid <> v_debt.id then
    raise exception 'DEBT_PAYMENT_DEBT_MISMATCH';
  end if;

  if (p_movement->>'amount')::numeric <> v_amount then
    raise exception 'DEBT_PAYMENT_AMOUNT_MISMATCH';
  end if;

  if p_movement->>'currency' <> v_debt.currency then
    raise exception 'DEBT_PAYMENT_CURRENCY_MISMATCH';
  end if;

  v_movement := manzana.core_commit_movement_create(
    p_movement,
    p_audit_logs,
    p_account_deltas,
    p_box_deltas,
    p_movement_outbox_events
  );

  insert into public.debt_payments (
    id,
    user_id,
    debt_id,
    movement_id,
    amount,
    currency,
    paid_at,
    source,
    metadata
  )
  values (
    coalesce((p_payment->>'id')::uuid, gen_random_uuid()),
    v_user_id,
    v_debt.id,
    v_movement.id,
    v_amount,
    v_debt.currency,
    coalesce((p_payment->>'paid_at')::timestamptz, now()),
    coalesce(nullif(p_payment->>'source', ''), 'dashboard_manual'),
    coalesce(p_payment->'metadata', '{}'::jsonb)
  )
  returning * into v_payment;

  select exists (
    select 1
      from public.debt_installments
     where user_id = v_user_id
       and debt_id = v_debt.id
  ) into v_has_installments;

  v_remaining := v_amount;

  for v_installment in
    select *
      from public.debt_installments
     where user_id = v_user_id
       and debt_id = v_debt.id
       and status in ('pending', 'due_soon', 'overdue')
       and paid_amount < expected_amount
     order by due_date asc, number asc
     for update
  loop
    exit when v_remaining <= 0;

    v_allocate := round(
      least(
        v_remaining,
        v_installment.expected_amount - v_installment.paid_amount
      ),
      2
    );

    if v_allocate <= 0 then
      continue;
    end if;

    v_allocation_order := v_allocation_order + 1;

    insert into public.debt_payment_allocations (
      user_id,
      debt_id,
      debt_payment_id,
      debt_installment_id,
      movement_id,
      allocated_amount,
      allocation_order,
      policy,
      metadata
    )
    values (
      v_user_id,
      v_debt.id,
      v_payment.id,
      v_installment.id,
      v_movement.id,
      v_allocate,
      v_allocation_order,
      'oldest_open_due_date_first_v1',
      jsonb_build_object(
        'installment_number', v_installment.number,
        'installment_due_date', v_installment.due_date
      )
    )
    returning * into v_allocation;

    v_new_installment_paid := round(
      v_installment.paid_amount + v_allocate,
      2
    );

    update public.debt_installments
       set paid_amount = v_new_installment_paid,
           status = case
             when v_new_installment_paid = expected_amount
               then 'paid'::public.installment_status
             else status
           end,
           movement_id = v_movement.id,
           metadata = coalesce(metadata, '{}'::jsonb)
             || jsonb_build_object(
               'last_allocation_id', v_allocation.id,
               'last_payment_id', v_payment.id,
               'last_payment_movement_id', v_movement.id,
               'allocation_policy', 'oldest_open_due_date_first_v1'
             )
     where id = v_installment.id
       and user_id = v_user_id;

    v_allocations := v_allocations || jsonb_build_array(to_jsonb(v_allocation));
    v_remaining := round(v_remaining - v_allocate, 2);
  end loop;

  v_new_balance := round(v_debt.current_balance - v_amount, 2);

  if v_new_balance = 0 and v_has_installments then
    update public.debt_installments
       set status = 'skipped'::public.installment_status,
           metadata = coalesce(metadata, '{}'::jsonb)
             || jsonb_build_object(
               'skipped_reason', 'debt_closed_before_schedule_exhausted',
               'closed_by_payment_id', v_payment.id,
               'closed_by_movement_id', v_movement.id
             )
     where user_id = v_user_id
       and debt_id = v_debt.id
       and status in ('pending', 'due_soon', 'overdue')
       and paid_amount < expected_amount;
  end if;

  if v_has_installments and v_new_balance > 0 then
    select min(due_date)
      into v_next_payment_date
      from public.debt_installments
     where user_id = v_user_id
       and debt_id = v_debt.id
       and status in ('pending', 'due_soon', 'overdue')
       and paid_amount < expected_amount;
  else
    v_next_payment_date := case
      when v_has_installments then null
      else v_debt.next_payment_date
    end;
  end if;

  update public.debt_payments
     set metadata = coalesce(metadata, '{}'::jsonb)
       || jsonb_build_object(
         'allocation_policy', 'oldest_open_due_date_first_v1',
         'allocated_to_installments', round(v_amount - v_remaining, 2),
         'unallocated_to_installments', v_remaining,
         'schedule_present', v_has_installments
       )
   where id = v_payment.id
     and user_id = v_user_id
   returning * into v_payment;

  update public.debts
     set current_balance = v_new_balance,
         status = case
           when v_new_balance = 0
             then 'paid'::public.debt_status
           else 'active'::public.debt_status
         end,
         next_payment_date = v_next_payment_date,
         last_payment_at = v_payment.paid_at,
         closed_at = case
           when v_new_balance = 0 then v_payment.paid_at
           else closed_at
         end,
         metadata = coalesce(metadata, '{}'::jsonb)
           || jsonb_build_object(
             'last_payment_movement_id', v_movement.id,
             'last_payment_amount', v_amount,
             'last_payment_allocation_policy', 'oldest_open_due_date_first_v1'
           )
   where id = v_debt.id
     and user_id = v_user_id
   returning * into v_debt;

  perform manzana.insert_transactional_outbox_events(p_debt_outbox_events);

  return jsonb_build_object(
    'movement', to_jsonb(v_movement),
    'debt', to_jsonb(v_debt),
    'payment', to_jsonb(v_payment),
    'installment_allocations', v_allocations,
    'allocation_policy', 'oldest_open_due_date_first_v1',
    'idempotent', false
  );
end;
$$;

create or replace function public.commit_debt_payment(
  p_debt_id uuid,
  p_payment jsonb,
  p_movement jsonb,
  p_audit_logs jsonb,
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
  select manzana.commit_debt_payment(
    p_debt_id,
    p_payment,
    p_movement,
    p_audit_logs,
    p_account_deltas,
    p_box_deltas,
    p_movement_outbox_events,
    p_debt_outbox_events
  );
$$;

revoke all on function manzana.commit_debt_payment(
  uuid,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) from public, anon, authenticated;

revoke all on function public.commit_debt_payment(
  uuid,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) from public, anon, authenticated;

grant execute on function public.commit_debt_payment(
  uuid,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) to service_role;

comment on table public.debt_payment_allocations is
  'Asignaciones auditables entre un pago de deuda y una o varias cuotas.';

comment on function public.commit_debt_payment(
  uuid,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) is
  'Registra movimiento, saldos, deuda, pago, asignaciones a cuotas y outbox en una sola transaccion Core.';
