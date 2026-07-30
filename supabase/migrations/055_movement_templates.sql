-- =============================================================
-- Migration 055: Plantillas de movimientos (29 S4.1)
-- Corte W-10 - Captura sin friccion
-- Depends on: 006 (movement_type), 003 (categorias/subcategorias)
-- =============================================================

do $$ begin
  create type public.template_origin as enum ('usuario', 'sugerida');
exception when duplicate_object then null;
end $$;

create table if not exists public.movement_templates (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  type            public.movement_type not null,
  amount          numeric(14,2),
  merchant        text,
  description     text,
  category_id     text,
  subcategory_id  uuid,
  account_id      uuid references public.accounts(id) on delete set null,
  box_id          uuid references public.boxes(id) on delete set null,
  origin          public.template_origin not null default 'usuario',
  use_count       integer not null default 0,
  last_used_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  metadata        jsonb not null default '{}'::jsonb,

  constraint movement_templates_name_valid
    check (length(trim(name)) between 1 and 40),
  constraint movement_templates_amount_valid
    check (amount is null or amount > 0),
  constraint movement_templates_use_count_valid
    check (use_count >= 0)
);

-- 29 S4.1: unico parcial (user_id, lower(name)) entre activas.
create unique index if not exists movement_templates_user_name_unique
  on public.movement_templates (user_id, lower(name))
  where deleted_at is null;

-- 29 S4.2: se muestran siempre por frecuencia de uso.
create index if not exists movement_templates_user_use_idx
  on public.movement_templates (user_id, use_count desc, last_used_at desc)
  where deleted_at is null;

create trigger movement_templates_updated_at
  before update on public.movement_templates
  for each row execute function manzana.set_updated_at();

comment on table public.movement_templates is
  'Movimientos frecuentes reutilizables (29). El registro final usa POST /movements, sin endpoint privilegiado.';
comment on column public.movement_templates.amount is
  'Nulo es deliberado: al usar la plantilla se pide solo el monto si falta (29 S4.1).';

alter table public.movement_templates enable row level security;

drop policy if exists "movement_templates: select own" on public.movement_templates;
create policy "movement_templates: select own"
  on public.movement_templates for select
  using (auth.uid() = user_id);

drop policy if exists "movement_templates: write own" on public.movement_templates;
create policy "movement_templates: write own"
  on public.movement_templates for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.movement_templates to authenticated;
