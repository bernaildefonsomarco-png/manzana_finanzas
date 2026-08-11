-- =============================================================
-- Migration 076: Conversational writes for reminder preferences
-- Corte feat/preferencias-y-entidades-semanticas - RUL-PREF-04
-- Depends on: 001-075
-- =============================================================
--
-- `063_w14_reminders_and_search.sql` dejo montadas las tres escrituras de
-- preferencias de recordatorio: `set_reminder_preference`, `pause_reminders` y
-- `resume_reminders`. Estan bien hechas y esta migracion **no las toca**: la
-- primera incluso registra el evento de consentimiento de `AC-NOTIF-03` cuando
-- se activa el correo de un tipo, que es justo lo que `40` §3 exige del nivel
-- `consentimiento`.
--
-- El problema es de quien las llama. Las tres abortan con `REMINDER_FORBIDDEN`
-- si `auth.uid()` no coincide con `p_user_id`, asi que solo sirven cuando la
-- peticion trae la sesion del usuario. El motor conversacional no la tiene:
-- `FinancialOrchestrator` corre siempre con el cliente de servicio —lo hace el
-- asistente web (`handle-web-turn.ts`) y lo hace el canal de mensajeria, cuyo
-- webhook ni siquiera tiene usuario autenticado— y filtra por `user_id` en sus
-- propias consultas. Sin esta migracion, "no me avises de los presupuestos" se
-- cae con `REMINDER_FORBIDDEN` por construccion, no por un error del usuario.
--
-- La solucion es la misma que ya usaron `071` (presupuestos y metas) y `075`
-- (candidatos de perfil): una variante concedida **solo a `service_role`** que
-- recibe el `user_id` explicito, fija la reclamacion `sub` del JWT de forma
-- local a la transaccion y **delega en la funcion de siempre**. No duplica ni
-- una linea de logica ni de politica de consentimiento: si manana cambia la
-- regla, cambia en un solo lugar.
--
-- El aislamiento por usuario no se debilita: pasa de venir de un token a venir
-- de un parametro obligatorio que el motor toma del `external_event_log` ya
-- autenticado. Y sigue cerrado para todos los demas: `authenticated` y `anon`
-- no pueden ejecutar estas variantes, asi que ningun cliente puede pasar el
-- `user_id` de otra persona. La pantalla sigue usando las funciones originales,
-- que siguen resolviendo el dueno con su propio token.
--
-- La cuarta funcion, `set_quiet_hours_for_user`, si es nueva y no delega en
-- nadie, porque **no habia** en quien delegar: hasta hoy la unica escritura que
-- tocaba `user_preferences.quiet_hours_start/end` era
-- `set_whatsapp_nudge_consent`, que ademas sella un evento de consentimiento de
-- un canal externo con `source: 'dashboard_settings'`. Reutilizarla para
-- cambiar solo el horario habria registrado un consentimiento que el usuario
-- nunca dio, y diciendo ademas que se dio en una pantalla en la que no estuvo.
-- Escribe solo las dos columnas del horario y nada mas.
--
-- Reejecutable: solo `create or replace` mas permisos.

set search_path = public;

-- -------------------------------------------------------------
-- 1. Preferencia por tipo y canal (bandeja o correo)
-- -------------------------------------------------------------

create or replace function public.set_reminder_preference_for_user(
  p_user_id uuid,
  p_nudge_type public.nudge_type,
  p_channel text,
  p_enabled boolean
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- `auth.uid()` lee `request.jwt.claims`. Fijarla con `is_local = true` la
  -- deja valida solo dentro de esta transaccion y la revierte al terminar,
  -- aunque la funcion delegada falle.
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_user_id::text)::text,
    true
  );

  -- `AC-NOTIF-03`: el evento de consentimiento al activar el correo de un tipo
  -- lo escribe la funcion delegada, no esta. Por eso se delega en vez de
  -- reimplementar: la via conversacional deja exactamente la misma huella que
  -- la pantalla.
  perform public.set_reminder_preference(
    p_user_id,
    p_nudge_type,
    p_channel,
    p_enabled
  );
end;
$$;

-- -------------------------------------------------------------
-- 2. Pausa y reanudacion de todos los recordatorios
-- -------------------------------------------------------------

create or replace function public.pause_reminders_for_user(
  p_user_id uuid,
  p_until timestamptz
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_user_id::text)::text,
    true
  );

  perform public.pause_reminders(p_user_id, p_until);
end;
$$;

create or replace function public.resume_reminders_for_user(
  p_user_id uuid
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_user_id::text)::text,
    true
  );

  perform public.resume_reminders(p_user_id);
end;
$$;

-- -------------------------------------------------------------
-- 3. Horario silencioso, y solo el horario silencioso
-- -------------------------------------------------------------

create or replace function public.set_quiet_hours_for_user(
  p_user_id uuid,
  p_start time,
  p_end time
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_start is null or p_end is null then
    raise exception 'REMINDER_QUIET_HOURS_INVALID';
  end if;

  -- Una franja que empieza y termina a la misma hora no es una franja. Cruzar
  -- la medianoche (22:00 -> 08:00) si es legitimo y no se rechaza.
  if p_start = p_end then
    raise exception 'REMINDER_QUIET_HOURS_INVALID';
  end if;

  insert into public.user_preferences (user_id, quiet_hours_start, quiet_hours_end)
  values (p_user_id, p_start, p_end)
  on conflict (user_id)
  do update
     set quiet_hours_start = excluded.quiet_hours_start,
         quiet_hours_end = excluded.quiet_hours_end;
end;
$$;

-- -------------------------------------------------------------
-- 4. Permisos: solo el rol de servicio
-- -------------------------------------------------------------

revoke all on function public.set_reminder_preference_for_user(
  uuid, public.nudge_type, text, boolean
) from public, anon, authenticated;
revoke all on function public.pause_reminders_for_user(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.resume_reminders_for_user(uuid)
  from public, anon, authenticated;
revoke all on function public.set_quiet_hours_for_user(uuid, time, time)
  from public, anon, authenticated;

grant execute on function public.set_reminder_preference_for_user(
  uuid, public.nudge_type, text, boolean
) to service_role;
grant execute on function public.pause_reminders_for_user(uuid, timestamptz)
  to service_role;
grant execute on function public.resume_reminders_for_user(uuid)
  to service_role;
grant execute on function public.set_quiet_hours_for_user(uuid, time, time)
  to service_role;

comment on function public.set_reminder_preference_for_user(
  uuid, public.nudge_type, text, boolean
) is 'RUL-PREF-04: variante para el motor conversacional. Delega en set_reminder_preference, que es quien registra el consentimiento de AC-NOTIF-03.';
comment on function public.pause_reminders_for_user(uuid, timestamptz)
  is 'RUL-PREF-04: variante para el motor conversacional de pause_reminders.';
comment on function public.resume_reminders_for_user(uuid)
  is 'RUL-PREF-04: variante para el motor conversacional de resume_reminders.';
comment on function public.set_quiet_hours_for_user(uuid, time, time)
  is 'RUL-PREF-04: escribe solo el horario silencioso, sin tocar el consentimiento de ningun canal.';
