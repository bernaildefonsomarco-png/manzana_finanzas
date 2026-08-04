-- =============================================================
-- Migración 066: Auditoría de cuenta (account_events)
-- Corte W-18 — Autenticación y cuenta
-- Depende de: 001_extensions_enums.sql, 002_profiles_preferences.sql
-- =============================================================
--
-- `43` §4.3 declara esta tabla como migración `064`; ese número ya lo tomó
-- `w14_reports_and_exports` antes de que este corte empezara (`WEB-D153`-style
-- drift de numeración, no una decisión de producto). Se corrige aquí al
-- número real, `066`.
--
-- `43` §4.3 también declara la columna `user_id` como
-- `not null references auth.users(id) on delete cascade`, y en el mismo
-- párrafo dice que el evento de eliminación "sobrevive al borrado en
-- cascada" anonimizando `user_id` a nulo. Las dos frases no pueden ser
-- ciertas a la vez: una columna `not null` no admite ponerse a `null`, y
-- `on delete cascade` borra la fila entera en vez de anonimizarla. Se
-- corrige la columna a nullable con `on delete set null`, que es el
-- comportamiento que la prosa describe y el que `RUL-AUTH-10`/`43` §4.3
-- necesitan para poder responder "esta cuenta se eliminó el <fecha>"
-- después de que `auth.users` ya no tenga la fila.

begin;

do $$ begin
  create type public.account_event_kind as enum (
    'creada',
    'verificada',
    'clave_cambiada',
    'clave_recuperada',
    'correo_cambiado',
    'sesiones_cerradas',
    'eliminacion_solicitada'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.account_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  kind account_event_kind not null,
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz not null default now()
);

comment on table public.account_events is
  'Auditoria de cuenta (43 §4.3). Registro de "esto fui yo", no memoria: '
  'no alimenta ninguna respuesta del motor.';

comment on column public.account_events.user_id is
  'Nulo tras eliminar la cuenta: el evento eliminacion_solicitada sobrevive '
  'anonimizado (RUL-AUTH-10).';

comment on column public.account_events.ip_hash is
  'Hash de la IP, nunca la IP en claro (AC-AUTH-19).';

create index if not exists account_events_user_id_created_at_idx
  on public.account_events (user_id, created_at desc);

alter table public.account_events enable row level security;

drop policy if exists "account_events: select own" on public.account_events;
create policy "account_events: select own"
  on public.account_events for select
  using (user_id = auth.uid());

-- Cada evento lo escribe la ruta de servidor que ejecuta la accion, con la
-- sesion del propio usuario (`43` §11: sin excepcion de service-role salvo
-- la eliminacion de cuenta, que ya usa service client en otro paso).
drop policy if exists "account_events: insert own" on public.account_events;
create policy "account_events: insert own"
  on public.account_events for insert
  with check (user_id = auth.uid());

-- La anonimizacion previa al borrado en cascada (RUL-AUTH-10) la hace el
-- servidor con service_role, unico camino que puede escribir user_id = null
-- (la politica de insert exige que coincida con auth.uid(), y no hay
-- politica de update para el cliente).
grant select, insert on public.account_events to authenticated;
grant all on public.account_events to service_role;

commit;
