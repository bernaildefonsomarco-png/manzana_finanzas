-- =============================================================
-- Migration 021: Debt lifecycle lock order hardening
-- Corte 20 - Evita inversion con commit_debt_payment
-- Depends on: 020
-- =============================================================

create or replace function public.refresh_debt_installment_lifecycle(
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
  v_debt_id uuid;
begin
  if p_user_id is null then
    raise exception 'DEBT_LIFECYCLE_USER_REQUIRED';
  end if;

  if p_as_of_date is null then
    raise exception 'DEBT_LIFECYCLE_DATE_REQUIRED';
  end if;

  if p_due_soon_days is null
     or p_due_soon_days < 1
     or p_due_soon_days > 14 then
    raise exception 'DEBT_LIFECYCLE_DUE_SOON_DAYS_OUT_OF_RANGE';
  end if;

  if p_trace_id is null then
    raise exception 'DEBT_LIFECYCLE_TRACE_REQUIRED';
  end if;

  -- commit_debt_payment bloquea deuda antes que cuotas. Mantener el mismo
  -- orden evita deadlocks cuando un pago coincide con el cron.
  for v_debt_id in
    select debt.id
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
    null;
  end loop;

  return manzana.refresh_debt_installment_lifecycle(
    p_user_id,
    p_as_of_date,
    p_due_soon_days,
    p_trace_id
  );
end;
$$;

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
  'Debt Engine: bloquea deuda antes que cuotas, persiste vencimientos y outbox idempotente sin modificar importes ni saldos.';
