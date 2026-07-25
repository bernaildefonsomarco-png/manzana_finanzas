-- =============================================================
-- Migración 004: Accounts y Boxes
-- Corte 1 — Datos, Auth y RLS inicial
-- Depende de: 001_extensions_enums.sql, 002_profiles_preferences.sql
-- =============================================================

-- ── accounts ────────────────────────────────────────────────
-- Representa dónde está el dinero: Yape, BCP, efectivo, etc.
create table if not exists public.accounts (
  id               uuid         primary key default gen_random_uuid(),
  user_id          uuid         not null references auth.users(id) on delete cascade,
  name             text         not null,
  institution      text,
  type             account_type not null,
  currency         text         not null default 'PEN',
  initial_balance  numeric(14,2) not null default 0,
  current_balance  numeric(14,2) not null default 0,
  is_default       boolean      not null default false,
  color            text,
  icon             text,
  created_at       timestamptz  not null default now(),
  updated_at       timestamptz  not null default now(),
  deleted_at       timestamptz,
  metadata         jsonb        not null default '{}'::jsonb,

  -- Solo una cuenta por defecto activa por usuario
  constraint accounts_one_default_per_user
    exclude using btree (user_id with =)
    where (is_default = true and deleted_at is null),

  -- Nombre único por usuario (sin contar eliminadas)
  constraint accounts_unique_name_per_user
    unique nulls not distinct (user_id, name, deleted_at)
);

create trigger accounts_updated_at
  before update on public.accounts
  for each row execute function manzana.set_updated_at();

-- Índice para búsquedas frecuentes
create index if not exists accounts_user_active_idx
  on public.accounts (user_id, deleted_at)
  where deleted_at is null;

comment on table public.accounts is
  'Dónde está el dinero del usuario: Yape, BCP, efectivo, etc. balance lo actualiza el Balance Engine, no el cliente.';

comment on column public.accounts.current_balance is
  'Saldo calculado por el Balance Engine. No escribir directo desde cliente.';

comment on column public.accounts.is_default is
  'Solo puede haber una cuenta default activa por usuario.';

-- ── FK diferida: user_preferences.default_account_id → accounts ─
-- Se agrega aquí porque accounts no existía en migración 002
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_preferences_default_account_fk'
      and conrelid = 'public.user_preferences'::regclass
  ) then
    alter table public.user_preferences
      add constraint user_preferences_default_account_fk
      foreign key (default_account_id) references public.accounts(id)
      on delete set null;
  end if;
end $$;

-- ── boxes ───────────────────────────────────────────────────
-- Representa para qué es el dinero dentro de una cuenta.
-- Caja libre NO es tabla — es cálculo: account.current_balance - sum(active boxes).
create table if not exists public.boxes (
  id                  uuid      primary key default gen_random_uuid(),
  user_id             uuid      not null references auth.users(id) on delete cascade,
  account_id          uuid      not null references public.accounts(id) on delete restrict,
  name                text      not null,
  type                box_type  not null,
  current_balance     numeric(14,2) not null default 0,
  target_amount       numeric(14,2),
  target_date         date,
  -- FKs a debts y recurring_rules se agregan en sus respectivas migraciones
  linked_debt_id      uuid,
  linked_recurring_id uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  metadata            jsonb       not null default '{}'::jsonb,

  -- Nombre único por cuenta activa
  constraint boxes_unique_name_per_account
    unique nulls not distinct (account_id, name, deleted_at),

  -- target_amount solo positivo si existe
  constraint boxes_target_amount_positive
    check (target_amount is null or target_amount > 0)
);

create trigger boxes_updated_at
  before update on public.boxes
  for each row execute function manzana.set_updated_at();

-- Índice para búsquedas frecuentes
create index if not exists boxes_account_active_idx
  on public.boxes (user_id, account_id, deleted_at)
  where deleted_at is null;

comment on table public.boxes is
  'Para qué es el dinero dentro de una cuenta. Caja libre es cálculo: account.balance - sum(boxes). Una caja siempre pertenece a una cuenta.';

comment on column public.boxes.linked_debt_id is
  'FK opcional a debts. Se activa en migración de deudas (Corte 8).';

comment on column public.boxes.linked_recurring_id is
  'FK opcional a recurring_rules. Se activa en migración de recurrentes (Corte 8).';
