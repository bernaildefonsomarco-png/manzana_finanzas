-- =============================================================
-- Migration 024: Evidence-backed financial memory and learning
-- Corte 22L - Semantic/narrative memory without raw reasoning
-- Depends on: 001-023
-- =============================================================

create table if not exists public.financial_memory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  canonical_key text not null,
  summary text not null,
  search_terms text[] not null default '{}',
  evidence_source text not null,
  evidence_ref text not null,
  confidence numeric(4,3) not null,
  confirmation_status text not null default 'confirmed',
  sensitivity text not null default 'normal',
  valid_until timestamptz,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint financial_memory_items_kind_known check (
    kind in ('preference', 'alias', 'person_context', 'correction_pattern', 'narrative_fact')
  ),
  constraint financial_memory_items_confirmation_known check (
    confirmation_status in ('confirmed', 'revoked')
  ),
  constraint financial_memory_items_sensitivity_known check (
    sensitivity in ('normal', 'sensitive')
  ),
  constraint financial_memory_items_confidence_range check (
    confidence >= 0 and confidence <= 1
  )
);

create trigger financial_memory_items_set_updated_at
  before update on public.financial_memory_items
  for each row execute function manzana.set_updated_at();

create unique index if not exists financial_memory_items_user_kind_key_unique
  on public.financial_memory_items (user_id, kind, canonical_key);

create index if not exists financial_memory_items_user_active_idx
  on public.financial_memory_items (user_id, updated_at desc)
  where confirmation_status = 'confirmed' and superseded_at is null;

create index if not exists financial_memory_items_search_terms_gin_idx
  on public.financial_memory_items using gin (search_terms);

comment on table public.financial_memory_items is
  'Memoria financiera confirmada y trazable. No contiene historial crudo, chain-of-thought ni inferencias no confirmadas.';

alter table public.financial_memory_items enable row level security;

drop policy if exists "financial_memory_items: select own"
  on public.financial_memory_items;
create policy "financial_memory_items: select own"
  on public.financial_memory_items for select
  using (auth.uid() = user_id);

drop policy if exists "financial_memory_items: no client write"
  on public.financial_memory_items;
create policy "financial_memory_items: no client write"
  on public.financial_memory_items for all
  using (false)
  with check (false);

revoke all on public.financial_memory_items from anon, authenticated;
grant select on public.financial_memory_items to authenticated;
grant select, insert, update on public.financial_memory_items to service_role;
