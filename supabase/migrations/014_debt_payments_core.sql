-- =============================================================
-- Migration 014: Debt payments through Core
-- Corte 9 - Pagos/cobros de deuda transaccionales
-- Depends on: 006, 008, 013
-- =============================================================

create unique index if not exists debt_payments_movement_unique_idx
  on public.debt_payments (movement_id)
  where movement_id is not null;

alter table public.debts
  add column if not exists last_payment_at timestamptz;

alter table public.debt_payments
  add column if not exists currency text not null default 'PEN';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'debt_payments_currency_supported'
      and conrelid = 'public.debt_payments'::regclass
  ) then
    alter table public.debt_payments
      add constraint debt_payments_currency_supported
      check (currency in ('PEN', 'USD'));
  end if;
end $$;

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
  v_user_id uuid := (p_movement->>'user_id')::uuid;
  v_amount numeric := round((p_payment->>'amount')::numeric, 2);
  v_new_balance numeric;
  v_expected_type text;
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

    return jsonb_build_object(
      'movement', to_jsonb(v_movement),
      'debt', to_jsonb(v_debt),
      'payment', to_jsonb(v_existing_payment),
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

  v_new_balance := round(v_debt.current_balance - v_amount, 2);

  update public.debts
     set current_balance = v_new_balance,
         status = case when v_new_balance = 0 then 'paid'::public.debt_status else 'active'::public.debt_status end,
         last_payment_at = v_payment.paid_at,
         closed_at = case when v_new_balance = 0 then v_payment.paid_at else closed_at end,
         metadata = coalesce(metadata, '{}'::jsonb)
           || jsonb_build_object(
             'last_payment_movement_id', v_movement.id,
             'last_payment_amount', v_amount
           )
   where id = v_debt.id
     and user_id = v_user_id
   returning * into v_debt;

  perform manzana.insert_transactional_outbox_events(p_debt_outbox_events);

  return jsonb_build_object(
    'movement', to_jsonb(v_movement),
    'debt', to_jsonb(v_debt),
    'payment', to_jsonb(v_payment),
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
  'Registra un pago/cobro de deuda en una transaccion: movimiento Core, saldos, debt_payment, debt balance y outbox.';
