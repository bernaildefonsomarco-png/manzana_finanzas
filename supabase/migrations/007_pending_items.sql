-- =============================================================
-- Migration 007: Pending items
-- Corte 7 - Pendientes y confirmaciones reales
-- Depends on: 001, 002, 005, 006
-- =============================================================

create table if not exists public.pending_items (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references auth.users(id) on delete cascade,
  type                       public.pending_type not null,
  status                     public.pending_status not null default 'pending',
  source                     public.pending_source not null,
  source_ref                 text,
  proposed_action            jsonb not null,
  normalized_summary         jsonb not null default '{}'::jsonb,
  dedup_status               text,
  risk_level                 public.risk_level not null default 'low',
  expires_at                 timestamptz,
  sent_for_confirmation_at   timestamptz,
  resolved_at                timestamptz,
  resolved_by                text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  metadata                   jsonb not null default '{}'::jsonb,

  constraint pending_items_source_ref_length
    check (source_ref is null or length(source_ref) <= 240),
  constraint pending_items_dedup_status_length
    check (dedup_status is null or length(dedup_status) <= 80),
  constraint pending_items_resolved_by_length
    check (resolved_by is null or length(resolved_by) <= 120)
);

create trigger pending_items_updated_at
  before update on public.pending_items
  for each row execute function manzana.set_updated_at();

create index if not exists pending_items_user_status_created_idx
  on public.pending_items (user_id, status, created_at desc);

create index if not exists pending_items_user_created_idx
  on public.pending_items (user_id, created_at desc);

create unique index if not exists pending_items_user_source_ref_idx
  on public.pending_items (user_id, source, source_ref)
  where source_ref is not null;

comment on table public.pending_items is
  'Bandeja de elementos detectados que requieren confirmacion. No afectan saldos hasta que el Core cree una entidad confirmada.';

comment on column public.pending_items.proposed_action is
  'Accion estructurada propuesta por agente/motor/adapter. No se ejecuta sin confirmacion.';

comment on column public.pending_items.normalized_summary is
  'Resumen seguro para UI: titulo, monto sugerido, categoria, fecha y evidencia resumida.';

comment on column public.pending_items.status is
  'Estado de vida del pendiente. Solo user_confirmed crea movimiento/entidad confirmada via Core.';

alter table public.pending_items enable row level security;

create policy "pending_items: select own"
  on public.pending_items for select
  using (auth.uid() = user_id);

-- Las escrituras de pending_items pasan por backend, adapters o workers con service_role.
-- El cliente autenticado solo lee; confirmar/editar/descartar usa API controlada.
revoke all on public.pending_items from anon, authenticated;
grant select on public.pending_items to authenticated;
