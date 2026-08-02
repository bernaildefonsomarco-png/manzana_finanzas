-- =============================================================
-- Migration 063: W-14 - Recordatorios in-app + busqueda global
-- Corte 14 (37_modulo_recordatorios_in_app.md, 38_modulo_busqueda_y_navegacion_rapida.md)
-- Depends on: 001-062
-- WEB-D246: numero real; las reservas documentales 053/062 estaban
-- obsoletas (colisionaban con W-10 y W-13). WEB-D247: no se reutiliza
-- nudge_candidates. WEB-D249: no se duplica el indice de texto de 052.
-- =============================================================

-- ── nudge_type: los diez tipos de RUL-NOTIF-01 ─────────────────
alter type public.nudge_type add value if not exists 'pago_proximo';
alter type public.nudge_type add value if not exists 'pago_vencido';
alter type public.nudge_type add value if not exists 'cuota_proxima';
alter type public.nudge_type add value if not exists 'cuota_vencida';
alter type public.nudge_type add value if not exists 'presupuesto_umbral';
alter type public.nudge_type add value if not exists 'pendientes_acumulados';
alter type public.nudge_type add value if not exists 'sin_registrar';
alter type public.nudge_type add value if not exists 'correo_desconectado';
alter type public.nudge_type add value if not exists 'descarga_lista';
alter type public.nudge_type add value if not exists 'confirmar_hecho';

-- =============================================================
-- in_app_notifications: la bandeja visible (WEB-D247)
-- =============================================================

create table if not exists public.in_app_notifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  kind           public.nudge_type not null,
  subject_key    text not null,
  title          text not null,
  body           text not null,
  action_url     text,
  read_at        timestamptz,
  dismissed_at   timestamptz,
  resolved_at    timestamptz,
  snoozed_until  timestamptz,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null,

  constraint in_app_notifications_title_length
    check (length(title) between 1 and 80),
  constraint in_app_notifications_title_no_exclamation
    check (title !~ '!'),
  constraint in_app_notifications_body_length
    check (length(body) between 1 and 200),
  constraint in_app_notifications_subject_key_present
    check (length(trim(subject_key)) > 0),
  constraint in_app_notifications_action_url_internal
    check (action_url is null or (action_url ~ '^/' and action_url !~ '^//' and action_url !~ ':')),
  constraint in_app_notifications_expires_after_created
    check (expires_at > created_at),
  constraint in_app_notifications_snoozed_future
    check (snoozed_until is null or snoozed_until > created_at)
);

-- AC-NOTIF-09 / RUL-NOTIF-09: badge = abierto y sin leer.
create index if not exists in_app_notifications_open_idx
  on public.in_app_notifications (user_id, created_at desc)
  where dismissed_at is null and resolved_at is null;

-- RUL-NOTIF-06: la resolucion automatica busca por sujeto.
create index if not exists in_app_notifications_subject_idx
  on public.in_app_notifications (user_id, subject_key)
  where resolved_at is null;

-- AC-NOTIF-07: un sujeto, un recordatorio abierto (RUL-NOTIF-07).
create unique index if not exists in_app_notifications_open_subject_unique_idx
  on public.in_app_notifications (user_id, subject_key)
  where resolved_at is null and dismissed_at is null;

create index if not exists in_app_notifications_user_kind_idx
  on public.in_app_notifications (user_id, kind, created_at desc);

alter table public.in_app_notifications enable row level security;

create policy "in_app_notifications: select own"
  on public.in_app_notifications for select
  using (auth.uid() = user_id);

create policy "in_app_notifications: no client write"
  on public.in_app_notifications for all
  using (false)
  with check (false);

grant select on public.in_app_notifications to authenticated;
grant select, insert, update, delete on public.in_app_notifications to service_role;

comment on table public.in_app_notifications is
  'La bandeja de recordatorios (37). No se escribe directo: se crea via el evaluador diario o las funciones RPC de esta migracion, y se muta via las RPC de accion (leer/posponer/descartar).';

-- =============================================================
-- Funciones de resolucion automatica (RUL-NOTIF-06, AC-NOTIF-06)
-- Deben ejecutarse en la MISMA transaccion que la escritura que
-- resuelve la causa: se implementan como funciones llamadas desde
-- triggers AFTER en las tablas fuente, nunca desde un job posterior.
-- =============================================================

create or replace function manzana.resolve_in_app_notification(
  p_user_id uuid,
  p_subject_key text
) returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.in_app_notifications
  set resolved_at = now()
  where user_id = p_user_id
    and subject_key = p_subject_key
    and resolved_at is null;
$$;

create or replace function manzana.resolve_in_app_notifications_by_prefix(
  p_user_id uuid,
  p_subject_prefix text
) returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.in_app_notifications
  set resolved_at = now()
  where user_id = p_user_id
    and subject_key like (p_subject_prefix || '%')
    and resolved_at is null;
$$;

revoke all on function manzana.resolve_in_app_notification(uuid, text) from public;
revoke all on function manzana.resolve_in_app_notifications_by_prefix(uuid, text) from public;
grant execute on function manzana.resolve_in_app_notification(uuid, text) to service_role;
grant execute on function manzana.resolve_in_app_notifications_by_prefix(uuid, text) to service_role;

-- ── Cuotas de deuda: cuota_proxima / cuota_vencida ──────────────
-- subject_key = 'cuota:<debt_id>#<numero>'

create or replace function manzana.trg_debt_installments_resolve_reminder()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'paid' and (old.status is distinct from 'paid') then
    perform manzana.resolve_in_app_notification(
      new.user_id,
      'cuota:' || new.debt_id::text || '#' || new.number::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists debt_installments_resolve_reminder on public.debt_installments;
create trigger debt_installments_resolve_reminder
  after update of status on public.debt_installments
  for each row execute function manzana.trg_debt_installments_resolve_reminder();

-- Una deuda que se cierra entera (pagada, cancelada o archivada)
-- resuelve cualquier cuota abierta que le quede.
create or replace function manzana.trg_debts_resolve_reminder()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status in ('paid', 'cancelled', 'archived')
     and (old.status is distinct from new.status) then
    perform manzana.resolve_in_app_notifications_by_prefix(
      new.user_id,
      'cuota:' || new.id::text || '#'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists debts_resolve_reminder on public.debts;
create trigger debts_resolve_reminder
  after update of status on public.debts
  for each row execute function manzana.trg_debts_resolve_reminder();

-- ── Ocurrencias recurrentes: pago_proximo / pago_vencido ────────
-- subject_key = 'compromiso:<recurring_rule_id>'

create or replace function manzana.trg_recurring_occurrences_resolve_reminder()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'paid' and (old.status is distinct from 'paid') then
    perform manzana.resolve_in_app_notification(
      new.user_id,
      'compromiso:' || new.recurring_rule_id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists recurring_occurrences_resolve_reminder on public.recurring_occurrences;
create trigger recurring_occurrences_resolve_reminder
  after update of status on public.recurring_occurrences
  for each row execute function manzana.trg_recurring_occurrences_resolve_reminder();

-- Cancelar la regla misma tambien resuelve el aviso.
create or replace function manzana.trg_recurring_rules_resolve_reminder()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.cancelled_at is not null and old.cancelled_at is null then
    perform manzana.resolve_in_app_notification(
      new.user_id,
      'compromiso:' || new.id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists recurring_rules_resolve_reminder on public.recurring_rules;
create trigger recurring_rules_resolve_reminder
  after update of cancelled_at on public.recurring_rules
  for each row execute function manzana.trg_recurring_rules_resolve_reminder();

-- ── Presupuestos: presupuesto_umbral ─────────────────────────────
-- subject_key = 'presupuesto:<budget_id>#<umbral>' (varios por presupuesto)

create or replace function manzana.trg_budgets_resolve_reminder()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'archivado' and (old.status is distinct from 'archivado') then
    perform manzana.resolve_in_app_notifications_by_prefix(
      new.user_id,
      'presupuesto:' || new.id::text || '#'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists budgets_resolve_reminder on public.budgets;
create trigger budgets_resolve_reminder
  after update of status on public.budgets
  for each row execute function manzana.trg_budgets_resolve_reminder();

-- ── Pendientes: pendientes_acumulados ─────────────────────────────
-- subject_key = 'pendientes' (uno por usuario). Se resuelve cuando
-- quedan menos de 5 sin resolver (RUL-NOTIF-06).

create or replace function manzana.trg_pending_items_resolve_reminder()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_open_count integer;
begin
  select count(*) into v_open_count
  from public.pending_items
  where user_id = new.user_id
    and status in ('pending', 'sent_for_confirmation', 'user_edited');

  if v_open_count < 5 then
    perform manzana.resolve_in_app_notification(new.user_id, 'pendientes');
  end if;
  return new;
end;
$$;

drop trigger if exists pending_items_resolve_reminder on public.pending_items;
create trigger pending_items_resolve_reminder
  after insert or update of status on public.pending_items
  for each row execute function manzana.trg_pending_items_resolve_reminder();

-- ── Correo: correo_desconectado ──────────────────────────────────
-- subject_key = 'buzon:<user_email_source_id>'

create or replace function manzana.trg_email_sources_resolve_reminder()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'active' and (old.status is distinct from 'active') then
    perform manzana.resolve_in_app_notification(
      new.user_id,
      'buzon:' || new.id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists email_sources_resolve_reminder on public.user_email_sources;
create trigger email_sources_resolve_reminder
  after update of status on public.user_email_sources
  for each row execute function manzana.trg_email_sources_resolve_reminder();

-- ── Movimientos: sin_registrar ────────────────────────────────────
-- subject_key = 'ausencia' (uno por usuario, RUL-NOTIF-07).

create or replace function manzana.trg_movements_resolve_ausencia_reminder()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform manzana.resolve_in_app_notification(new.user_id, 'ausencia');
  return new;
end;
$$;

drop trigger if exists movements_resolve_ausencia_reminder on public.movements;
create trigger movements_resolve_ausencia_reminder
  after insert on public.movements
  for each row execute function manzana.trg_movements_resolve_ausencia_reminder();

-- ── Perfil: confirmar_hecho (WEB-D247, clase T) ───────────────────
-- subject_key = 'perfil:<user_profile_candidates.subject_key>'
-- Se crea al proponerse, se resuelve al decidirse (RUL-NOTIF-06).

create or replace function manzana.trg_profile_candidates_reminder()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'pending_confirmation'
     and (tg_op = 'INSERT' or old.status is distinct from 'pending_confirmation') then
    insert into public.in_app_notifications (
      user_id, kind, subject_key, title, body, action_url, expires_at
    )
    values (
      new.user_id,
      'confirmar_hecho',
      'perfil:' || new.subject_key,
      left(new.statement, 80),
      '¿Es correcto? Puedes confirmarlo o decir que no.',
      '/configuracion/memoria/' || new.id::text,
      now() + interval '30 days'
    )
    on conflict (user_id, subject_key)
      where resolved_at is null and dismissed_at is null
      do nothing;
  elsif new.status in ('accepted', 'rejected', 'never_ask')
        and (old.status is distinct from new.status) then
    perform manzana.resolve_in_app_notification(
      new.user_id,
      'perfil:' || new.subject_key
    );
  end if;
  return new;
end;
$$;

drop trigger if exists profile_candidates_reminder on public.user_profile_candidates;
create trigger profile_candidates_reminder
  after insert or update of status on public.user_profile_candidates
  for each row execute function manzana.trg_profile_candidates_reminder();

-- =============================================================
-- saved_searches (38 §4.1)
-- =============================================================

create table if not exists public.saved_searches (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  query      text not null,
  filters    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint saved_searches_name_length check (length(name) between 1 and 60),
  constraint saved_searches_query_length check (length(query) between 1 and 200),
  constraint saved_searches_filters_object check (jsonb_typeof(filters) = 'object')
);

create trigger saved_searches_set_updated_at
  before update on public.saved_searches
  for each row execute function manzana.set_updated_at();

create unique index if not exists saved_searches_user_name_active_idx
  on public.saved_searches (user_id, name)
  where deleted_at is null;

create index if not exists saved_searches_user_active_idx
  on public.saved_searches (user_id, created_at desc)
  where deleted_at is null;

alter table public.saved_searches enable row level security;

create policy "saved_searches: select own"
  on public.saved_searches for select
  using (auth.uid() = user_id);

create policy "saved_searches: insert own"
  on public.saved_searches for insert
  with check (auth.uid() = user_id);

create policy "saved_searches: update own"
  on public.saved_searches for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "saved_searches: delete own"
  on public.saved_searches for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.saved_searches to authenticated;
grant select, insert, update, delete on public.saved_searches to service_role;

-- =============================================================
-- Indices de busqueda (38 §4.2). WEB-D249: movements ya tiene
-- search_vector + GIN desde la migracion 052 (W-09); solo hace
-- falta pg_trgm para el prefijo de comercio en la paleta.
-- =============================================================

create extension if not exists pg_trgm;

create index if not exists movements_merchant_trgm_idx
  on public.movements using gin (merchant gin_trgm_ops);

-- =============================================================
-- reminder_pauses: "Pausar todo durante una semana" (ACT-NOTIF-08)
-- =============================================================

create table if not exists public.reminder_pauses (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  paused_until timestamptz not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint reminder_pauses_future check (paused_until > created_at)
);

create trigger reminder_pauses_set_updated_at
  before update on public.reminder_pauses
  for each row execute function manzana.set_updated_at();

alter table public.reminder_pauses enable row level security;

create policy "reminder_pauses: select own"
  on public.reminder_pauses for select
  using (auth.uid() = user_id);

create policy "reminder_pauses: no client write"
  on public.reminder_pauses for all
  using (false)
  with check (false);

grant select on public.reminder_pauses to authenticated;
grant select, insert, update, delete on public.reminder_pauses to service_role;

-- =============================================================
-- RPC de accion del usuario (37 §10). Todas security definer,
-- todas verifican auth.uid() = p_user_id, todas idempotentes
-- salvo lo que el propio documento marca como error (ERR-NOTIF-04).
-- =============================================================

create or replace function public.mark_reminder_read(
  p_user_id uuid,
  p_id uuid
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'REMINDER_FORBIDDEN';
  end if;

  update public.in_app_notifications
  set read_at = coalesce(read_at, now())
  where id = p_id and user_id = p_user_id and dismissed_at is null;

  if not found then
    raise exception 'REMINDER_NOT_FOUND';
  end if;
end;
$$;

create or replace function public.mark_all_reminders_read(
  p_user_id uuid
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'REMINDER_FORBIDDEN';
  end if;

  update public.in_app_notifications
  set read_at = now()
  where user_id = p_user_id
    and read_at is null
    and dismissed_at is null
    and resolved_at is null;
end;
$$;

create or replace function public.snooze_reminder(
  p_user_id uuid,
  p_id uuid,
  p_until timestamptz
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'REMINDER_FORBIDDEN';
  end if;

  if p_until <= now() or p_until > now() + interval '30 days' then
    raise exception 'REMINDER_SNOOZE_OUT_OF_RANGE';
  end if;

  update public.in_app_notifications
  set snoozed_until = p_until
  where id = p_id
    and user_id = p_user_id
    and dismissed_at is null
    and resolved_at is null;

  if not found then
    raise exception 'REMINDER_NOT_FOUND';
  end if;
end;
$$;

create or replace function public.dismiss_reminder(
  p_user_id uuid,
  p_id uuid
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_resolved_at timestamptz;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'REMINDER_FORBIDDEN';
  end if;

  select resolved_at into v_resolved_at
  from public.in_app_notifications
  where id = p_id and user_id = p_user_id;

  if not found then
    raise exception 'REMINDER_NOT_FOUND';
  end if;

  if v_resolved_at is not null then
    raise exception 'REMINDER_ALREADY_RESOLVED';
  end if;

  update public.in_app_notifications
  set dismissed_at = coalesce(dismissed_at, now())
  where id = p_id and user_id = p_user_id;
end;
$$;

create or replace function public.set_reminder_preference(
  p_user_id uuid,
  p_nudge_type public.nudge_type,
  p_channel text,
  p_enabled boolean
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_was_enabled boolean;
  v_trace_id uuid := gen_random_uuid();
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'REMINDER_FORBIDDEN';
  end if;

  if p_channel not in ('dashboard', 'email') then
    raise exception 'REMINDER_CHANNEL_UNKNOWN';
  end if;

  select enabled into v_was_enabled
  from public.nudge_preferences
  where user_id = p_user_id and nudge_type = p_nudge_type and channel = p_channel;

  insert into public.nudge_preferences (user_id, nudge_type, channel, enabled)
  values (p_user_id, p_nudge_type, p_channel, p_enabled)
  on conflict (user_id, nudge_type, channel)
    do update set enabled = excluded.enabled, updated_at = now();

  -- AC-NOTIF-03: activar el correo de un tipo registra un evento de
  -- consentimiento explicito. Se encola en el outbox porque el modulo
  -- de privacidad (45, W-19) todavia no tiene tabla de consentimientos propia.
  if p_channel = 'email' and p_enabled and coalesce(v_was_enabled, false) = false then
    insert into public.transactional_outbox (
      user_id, event_type, aggregate_type, aggregate_id, payload, trace_id
    ) values (
      p_user_id,
      'reminder_email_consent_granted',
      'nudge_preference',
      gen_random_uuid(),
      jsonb_build_object('nudge_type', p_nudge_type, 'channel', p_channel),
      v_trace_id
    );
  end if;
end;
$$;

create or replace function public.pause_reminders(
  p_user_id uuid,
  p_until timestamptz
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'REMINDER_FORBIDDEN';
  end if;

  if p_until <= now() then
    raise exception 'REMINDER_PAUSE_OUT_OF_RANGE';
  end if;

  insert into public.reminder_pauses (user_id, paused_until)
  values (p_user_id, p_until)
  on conflict (user_id) do update set paused_until = excluded.paused_until;
end;
$$;

create or replace function public.resume_reminders(
  p_user_id uuid
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'REMINDER_FORBIDDEN';
  end if;

  delete from public.reminder_pauses where user_id = p_user_id;
end;
$$;

revoke all on function public.mark_reminder_read(uuid, uuid) from public;
revoke all on function public.mark_all_reminders_read(uuid) from public;
revoke all on function public.snooze_reminder(uuid, uuid, timestamptz) from public;
revoke all on function public.dismiss_reminder(uuid, uuid) from public;
revoke all on function public.set_reminder_preference(uuid, public.nudge_type, text, boolean) from public;
revoke all on function public.pause_reminders(uuid, timestamptz) from public;
revoke all on function public.resume_reminders(uuid) from public;

grant execute on function public.mark_reminder_read(uuid, uuid) to authenticated;
grant execute on function public.mark_all_reminders_read(uuid) to authenticated;
grant execute on function public.snooze_reminder(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.dismiss_reminder(uuid, uuid) to authenticated;
grant execute on function public.set_reminder_preference(uuid, public.nudge_type, text, boolean) to authenticated;
grant execute on function public.pause_reminders(uuid, timestamptz) to authenticated;
grant execute on function public.resume_reminders(uuid) to authenticated;
