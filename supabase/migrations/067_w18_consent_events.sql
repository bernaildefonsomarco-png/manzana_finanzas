-- =============================================================
-- Migración 067: Consentimientos y categorías sensibles por usuario
-- Corte W-18 — Configuración, privacidad y control de datos
-- Depende de: 001_extensions_enums.sql, 002_profiles_preferences.sql,
--             003_categories_tags.sql
-- =============================================================
--
-- `45` §4.2 declara esta tabla como migración `065`; ese número ya lo tomó
-- `w17_assistant_threads`. Se corrige al número real, `067` (mismo tipo de
-- drift que la nota de `066`).
--
-- `45` §5 `RUL-CONF-04` pide una categoría sensible elegida **por usuario**,
-- por defecto "salud y farmacia". `public.categories.is_sensitive`
-- (migración `003`) ya existe pero es una bandera **global de sistema**
-- consumida por `src/core/profile/sensitive-topics.ts` para
-- `AC-PERF-10`/`RUL-MEM-11` (salud, familia_apoyo, deudas) — cambiarla a
-- nivel de usuario movería una fuente de verdad que el orquestador ya
-- consume, cerrado desde `W-16`. Este corte añade una selección **aparte**,
-- por usuario, sin tocar la bandeja global: `user_preferences
-- .sensitive_category_ids`. Además no existe una categoría propia
-- "farmacia" entre las 12 canónicas (vive dentro de la descripción de
-- "salud", `003` línea 84): el default de este corte es `{salud}`, y se
-- corrige la prosa de `45` en el cierre de este corte, con la decisión
-- registrada en `03_decisiones_producto_web.md`.

begin;

alter table public.user_preferences
  add column if not exists sensitive_category_ids text[] not null default array['salud'];

comment on column public.user_preferences.sensitive_category_ids is
  'Categorias que el usuario marco como discretas (45 RUL-CONF-04). '
  'Independiente de categories.is_sensitive, que es la bandera global que '
  'ya consume sensitive-topics.ts.';

do $$ begin
  create type public.consent_kind as enum (
    'correo_gmail',
    'correo_saliente_recordatorio',
    'correo_saliente_resumen',
    'terminos',
    'privacidad'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind consent_kind not null,
  granted boolean not null,
  version text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.consent_events is
  'Registro de eventos de consentimiento (45 §4.2). El estado vigente de un '
  'consentimiento es su ultimo evento por (user_id, kind); no se guarda '
  'como estado mutable para no perder la historia.';

create index if not exists consent_events_user_kind_created_at_idx
  on public.consent_events (user_id, kind, created_at desc);

alter table public.consent_events enable row level security;

drop policy if exists "consent_events: select own" on public.consent_events;
create policy "consent_events: select own"
  on public.consent_events for select
  using (user_id = auth.uid());

drop policy if exists "consent_events: insert own" on public.consent_events;
create policy "consent_events: insert own"
  on public.consent_events for insert
  with check (user_id = auth.uid());

grant select, insert on public.consent_events to authenticated;
grant all on public.consent_events to service_role;

commit;
