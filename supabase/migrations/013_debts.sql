-- =============================================================
-- Migration 013: Debts base
-- Corte 8 - Deudas V1 base
-- Depends on: 001-012
-- =============================================================

create table if not exists public.related_persons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  normalized_name text not null,
  kind text not null default 'person',
  relationship_label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger related_persons_set_updated_at
  before update on public.related_persons
  for each row execute function manzana.set_updated_at();

create unique index if not exists related_persons_user_normalized_active_unique
  on public.related_persons (user_id, normalized_name)
  where deleted_at is null;

create index if not exists related_persons_user_active_idx
  on public.related_persons (user_id, created_at desc)
  where deleted_at is null;

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  direction public.debt_direction not null,
  kind public.debt_kind not null default 'personal',
  status public.debt_status not null default 'active',
  related_person_id uuid references public.related_persons(id),
  name text not null,
  principal_amount numeric(14,2) not null,
  current_balance numeric(14,2) not null,
  currency text not null default 'PEN',
  opened_at date not null default current_date,
  due_date date,
  next_payment_date date,
  installment_count integer,
  installment_amount numeric(14,2),
  interest_notes text,
  source text not null default 'dashboard_manual',
  confidence numeric(4,3),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  closed_at timestamptz,
  constraint debts_principal_non_negative check (principal_amount >= 0),
  constraint debts_current_balance_non_negative check (current_balance >= 0),
  constraint debts_balance_not_above_principal check (current_balance <= principal_amount),
  constraint debts_currency_supported check (currency in ('PEN', 'USD')),
  constraint debts_installment_count_positive check (
    installment_count is null or installment_count > 0
  ),
  constraint debts_installment_amount_non_negative check (
    installment_amount is null or installment_amount >= 0
  ),
  constraint debts_confidence_range check (
    confidence is null or (confidence >= 0 and confidence <= 1)
  )
);

create trigger debts_set_updated_at
  before update on public.debts
  for each row execute function manzana.set_updated_at();

create index if not exists debts_user_status_idx
  on public.debts (user_id, status, created_at desc)
  where deleted_at is null;

create index if not exists debts_user_due_idx
  on public.debts (user_id, next_payment_date, due_date)
  where deleted_at is null and status in ('active', 'due_soon', 'overdue');

create index if not exists debts_related_person_idx
  on public.debts (related_person_id)
  where related_person_id is not null;

create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debt_id uuid not null references public.debts(id) on delete cascade,
  movement_id uuid references public.movements(id),
  amount numeric(14,2) not null,
  paid_at timestamptz not null default now(),
  source text not null default 'dashboard_manual',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint debt_payments_amount_positive check (amount > 0)
);

create index if not exists debt_payments_user_debt_paid_idx
  on public.debt_payments (user_id, debt_id, paid_at desc);

create table if not exists public.debt_installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debt_id uuid not null references public.debts(id) on delete cascade,
  number integer not null,
  due_date date not null,
  expected_amount numeric(14,2) not null,
  paid_amount numeric(14,2) not null default 0,
  status public.installment_status not null default 'pending',
  movement_id uuid references public.movements(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint debt_installments_number_positive check (number > 0),
  constraint debt_installments_expected_amount_positive check (expected_amount > 0),
  constraint debt_installments_paid_amount_non_negative check (paid_amount >= 0),
  constraint debt_installments_paid_not_above_expected check (paid_amount <= expected_amount),
  constraint debt_installments_unique_number unique (debt_id, number)
);

create trigger debt_installments_set_updated_at
  before update on public.debt_installments
  for each row execute function manzana.set_updated_at();

create index if not exists debt_installments_user_due_idx
  on public.debt_installments (user_id, status, due_date);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'boxes_linked_debt_id_fkey'
      and conrelid = 'public.boxes'::regclass
  ) then
    alter table public.boxes
      add constraint boxes_linked_debt_id_fkey
      foreign key (linked_debt_id) references public.debts(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'movements_debt_id_fkey'
      and conrelid = 'public.movements'::regclass
  ) then
    alter table public.movements
      add constraint movements_debt_id_fkey
      foreign key (debt_id) references public.debts(id);
  end if;
end $$;

alter table public.related_persons enable row level security;
alter table public.debts enable row level security;
alter table public.debt_payments enable row level security;
alter table public.debt_installments enable row level security;

create policy "related_persons: select own"
  on public.related_persons for select
  using (auth.uid() = user_id);

create policy "related_persons: no client write"
  on public.related_persons for all
  using (false)
  with check (false);

create policy "debts: select own"
  on public.debts for select
  using (auth.uid() = user_id);

create policy "debts: no client write"
  on public.debts for all
  using (false)
  with check (false);

create policy "debt_payments: select own"
  on public.debt_payments for select
  using (auth.uid() = user_id);

create policy "debt_payments: no client write"
  on public.debt_payments for all
  using (false)
  with check (false);

create policy "debt_installments: select own"
  on public.debt_installments for select
  using (auth.uid() = user_id);

create policy "debt_installments: no client write"
  on public.debt_installments for all
  using (false)
  with check (false);

grant select on public.related_persons to authenticated;
grant select on public.debts to authenticated;
grant select on public.debt_payments to authenticated;
grant select on public.debt_installments to authenticated;

grant select, insert, update on public.related_persons to service_role;
grant select, insert, update on public.debts to service_role;
grant select, insert, update on public.debt_payments to service_role;
grant select, insert, update on public.debt_installments to service_role;

comment on table public.debts is
  'Deudas V1. Crear una deuda no mueve saldos; pagos y cobros pasan por Core/Debt Engine.';

comment on column public.debts.current_balance is
  'Saldo pendiente de la deuda. No debe actualizarse desde cliente directo.';
