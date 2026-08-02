-- =============================================================
-- Migration 064: W-14 - Reportes, graficos y exportacion
-- Corte 14 (35_modulo_reportes_graficos_y_exportacion.md)
-- Depends on: 001-063
-- WEB-D246: numero real; la reserva documental "051" de 13 §7.4
-- colisionaba con 051_movement_adjustment_negative_amount.sql (W-09).
-- =============================================================

do $$ begin
  create type public.export_kind as enum ('movimientos', 'datos_completos', 'reporte');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.export_format as enum ('csv', 'xlsx', 'pdf', 'json');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.export_status as enum ('pendiente', 'procesando', 'listo', 'expirado', 'fallido');
exception when duplicate_object then null;
end $$;

-- =============================================================
-- saved_reports (35 §4.1)
-- =============================================================

create table if not exists public.saved_reports (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  config     jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint saved_reports_name_length check (length(name) between 1 and 60),
  constraint saved_reports_config_object check (jsonb_typeof(config) = 'object')
);

create trigger saved_reports_set_updated_at
  before update on public.saved_reports
  for each row execute function manzana.set_updated_at();

create unique index if not exists saved_reports_user_name_active_idx
  on public.saved_reports (user_id, name)
  where deleted_at is null;

create index if not exists saved_reports_user_active_idx
  on public.saved_reports (user_id, created_at desc)
  where deleted_at is null;

alter table public.saved_reports enable row level security;

create policy "saved_reports: select own"
  on public.saved_reports for select
  using (auth.uid() = user_id);

create policy "saved_reports: insert own"
  on public.saved_reports for insert
  with check (auth.uid() = user_id);

create policy "saved_reports: update own"
  on public.saved_reports for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "saved_reports: delete own"
  on public.saved_reports for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.saved_reports to authenticated;
grant select, insert, update, delete on public.saved_reports to service_role;

-- =============================================================
-- export_jobs (35 §4.2). Trazabilidad de descargas: obligacion de
-- auditoria de privacidad, no telemetria (RUL-REP-11).
-- =============================================================

create table if not exists public.export_jobs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  kind           public.export_kind not null,
  format         public.export_format not null,
  status         public.export_status not null default 'pendiente',
  row_count      integer,
  idempotency_key text,
  storage_path   text,
  requested_at   timestamptz not null default now(),
  completed_at   timestamptz,
  expires_at     timestamptz,
  failure_reason text,
  metadata       jsonb not null default '{}'::jsonb,

  constraint export_jobs_row_count_non_negative check (row_count is null or row_count >= 0),
  constraint export_jobs_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint export_jobs_idempotency_length
    check (idempotency_key is null or length(idempotency_key) between 8 and 180)
);

create index if not exists export_jobs_user_requested_idx
  on public.export_jobs (user_id, requested_at desc);

create index if not exists export_jobs_status_expires_idx
  on public.export_jobs (status, expires_at)
  where status = 'listo';

create unique index if not exists export_jobs_user_idempotency_idx
  on public.export_jobs (user_id, idempotency_key)
  where idempotency_key is not null;

-- RUL-REP-12: como mucho una exportacion completa vigente ("pendiente"
-- o "procesando" o "listo" sin caducar) cada 24h se aplica en la capa
-- de API leyendo esta tabla, no aqui: el limite depende de la hora del
-- pedido anterior, no de un estado exclusivo.

alter table public.export_jobs enable row level security;

create policy "export_jobs: select own"
  on public.export_jobs for select
  using (auth.uid() = user_id);

create policy "export_jobs: no client write"
  on public.export_jobs for all
  using (false)
  with check (false);

grant select on public.export_jobs to authenticated;
grant select, insert, update, delete on public.export_jobs to service_role;

comment on table public.export_jobs is
  'Trabajos de exportacion (35). Se crean via create_export_job (RPC) para reservar la idempotencia dentro de la misma transaccion; el archivo lo produce el worker service-role.';

-- =============================================================
-- RPC: creacion idempotente de un export_job (POST /exports)
-- =============================================================

create or replace function public.create_export_job(
  p_user_id uuid,
  p_kind public.export_kind,
  p_format public.export_format,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
) returns public.export_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.export_jobs;
  v_new public.export_jobs;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'EXPORT_FORBIDDEN';
  end if;

  if length(coalesce(p_idempotency_key, '')) < 8 then
    raise exception 'EXPORT_IDEMPOTENCY_KEY_INVALID';
  end if;

  select * into v_existing
  from public.export_jobs
  where user_id = p_user_id and idempotency_key = p_idempotency_key;

  if found then
    return v_existing;
  end if;

  insert into public.export_jobs (
    user_id, kind, format, status, idempotency_key, metadata
  ) values (
    p_user_id, p_kind, p_format, 'pendiente', p_idempotency_key, coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_new;

  return v_new;
end;
$$;

revoke all on function public.create_export_job(uuid, public.export_kind, public.export_format, text, jsonb) from public;
grant execute on function public.create_export_job(uuid, public.export_kind, public.export_format, text, jsonb) to authenticated;
