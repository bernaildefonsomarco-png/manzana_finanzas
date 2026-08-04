-- =============================================================
-- Migración 068: Cola de correo saliente y supresiones
-- Corte W-19 — Notificaciones y correo saliente
-- Depende de: 001_extensions_enums.sql, 002_profiles_preferences.sql
-- =============================================================
--
-- `46` §4.2/§4.3 declara las dos tablas de esta migración como `066`; ese
-- número ya lo tomó `066_w18_account_events.sql` (`W-18`, corte anterior).
-- Se corrige al número real, `068` (mismo drift que `WEB-D274`).

begin;

do $$ begin
  create type public.email_kind as enum ('transaccional', 'notificacion');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.email_status as enum (
    'pendiente',
    'enviado',
    'rebotado',
    'fallido',
    'descartado'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.suppression_reason as enum (
    'rebote_duro',
    'queja',
    'baja_total'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind email_kind not null,
  template text not null,
  subject text not null,
  idempotency_key text not null,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  status email_status not null default 'pendiente',
  attempts smallint not null default 0,
  last_error text,
  discard_reason text,
  created_at timestamptz not null default now()
);

comment on table public.email_outbox is
  '46 §4.2. No guarda el cuerpo del mensaje, solo la plantilla y sus datos '
  'minimos (fuera de esta tabla, resueltos por el trabajador al enviar).';

create unique index if not exists email_outbox_idem_idx
  on public.email_outbox (user_id, idempotency_key);

create index if not exists email_outbox_pending_idx
  on public.email_outbox (scheduled_for)
  where status = 'pendiente';

alter table public.email_outbox enable row level security;

drop policy if exists "email_outbox: select own" on public.email_outbox;
create policy "email_outbox: select own"
  on public.email_outbox for select
  using (user_id = auth.uid());

-- `46` §9: "el trabajador compone el cuerpo en el momento del envío" — solo
-- service-role encola y actualiza estado; el cliente nunca escribe aquí
-- directo (RLS "no client write", mismo patrón que nudge_candidates).
drop policy if exists "email_outbox: no client write" on public.email_outbox;
create policy "email_outbox: no client write"
  on public.email_outbox for all
  using (false)
  with check (false);

grant select on public.email_outbox to authenticated;
grant select, insert, update on public.email_outbox to service_role;

create table if not exists public.email_suppressions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason suppression_reason not null,
  detail text,
  created_at timestamptz not null default now()
);

comment on table public.email_suppressions is
  '46 §4.3. Una direccion suprimida deja de recibir correo (RUL-MAIL-08).';

alter table public.email_suppressions enable row level security;

drop policy if exists "email_suppressions: select own" on public.email_suppressions;
create policy "email_suppressions: select own"
  on public.email_suppressions for select
  using (user_id = auth.uid());

drop policy if exists "email_suppressions: no client write" on public.email_suppressions;
create policy "email_suppressions: no client write"
  on public.email_suppressions for all
  using (false)
  with check (false);

grant select on public.email_suppressions to authenticated;
grant select, insert, update, delete on public.email_suppressions to service_role;

commit;
