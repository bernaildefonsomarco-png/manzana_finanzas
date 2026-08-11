-- =============================================================
-- Migration 075: Candidatos de perfil desde la conversacion
-- Corte feat/perfil-de-usuario-cableado - AC-PERF-02, AC-PERF-10, AC-PERF-14
-- Depends on: 001-074
-- =============================================================
--
-- `062_w13_insights_memory.sql` dejo montado todo el lado de datos del perfil:
-- `user_profile_candidates`, `user_profile_facts`, la lapida, el rechazo de
-- atributos protegidos y `resolve_profile_candidate`. Lo que no existia es la
-- via por la que el **motor conversacional** entra a esas tablas, y ese hueco
-- tiene dos partes distintas:
--
--  1. **Crear el candidato.** El motor podria insertar directo con el cliente
--     de servicio, pero "observar un hecho" no es un insert: hay que mirar si
--     ya existe el hecho vigente (no se pregunta lo que ya se sabe), si el
--     candidato ya se decidio (`accepted`/`rejected`/`never_ask` no se
--     reabren), y si hay lapida (`RUL-MEM-09`). Hacer esas cuatro cosas en
--     cuatro viajes desde TypeScript es una carrera con el propio usuario
--     resolviendo el candidato desde `/configuracion/memoria`.
--
--  2. **Resolverlo conversando.** `public.resolve_profile_candidate` aborta
--     con `MEMORY_CANDIDATE_NOT_FOUND` si `auth.uid()` no es el dueno, y
--     `FinancialOrchestrator` corre siempre con el cliente de servicio
--     (`handle-web-turn.ts`, y el webhook de mensajeria que ni siquiera tiene
--     sesion). Sin esta migracion, "si, es asi" en una conversacion no puede
--     promover nada: el usuario tendria que ir a la pantalla a confirmar lo
--     que acaba de confirmar hablando.
--
-- La segunda se resuelve con el mismo patron que ya uso `071` para
-- presupuestos y metas: una variante concedida **solo a `service_role`** que
-- recibe el `user_id` explicito, fija la reclamacion `sub` del JWT de forma
-- local a la transaccion y **delega en la funcion de siempre**. No duplica ni
-- una linea de la logica de confirmacion, y el aislamiento por usuario pasa de
-- venir de un token a venir de un parametro que el motor toma del
-- `external_event_log` ya autenticado.
--
-- Lo que esta migracion NO hace, a proposito:
--
-- - No escribe nunca en `user_profile_facts` desde el motor. Un hecho de perfil
--   solo nace confirmado (`AC-MEM-03`, `WEB-D023`), y la unica funcion que lo
--   crea sigue siendo `resolve_profile_candidate`.
-- - No decide la sensibilidad. `AC-PERF-10` se aplica en el nucleo con
--   `categories[].is_sensitive`, que es donde ya vive esa verdad; aqui solo
--   queda la barrera dura de atributos protegidos, que ya era un trigger de
--   `062` y sigue siendo suya.
-- - No levanta lapidas. Una lapida vigente devuelve `null` en vez de reventar:
--   olvidar significa algo (`RUL-MEM-09`) y un turno no se rompe por eso.
--
-- Reejecutable: solo `create or replace` mas permisos.

set search_path = public;

-- -------------------------------------------------------------
-- 1. Observar un hecho: crear o reforzar el candidato
-- -------------------------------------------------------------

create or replace function public.record_profile_candidate_observation(
  p_user_id uuid,
  p_subject_key text,
  p_statement text,
  p_evidence_ref text,
  p_metadata jsonb,
  p_now timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := coalesce(p_now, now());
  v_candidate public.user_profile_candidates;
  v_statement text := nullif(trim(p_statement), '');
  v_evidence text := nullif(trim(p_evidence_ref), '');
begin
  if p_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if v_statement is null or v_evidence is null then
    raise exception 'PROFILE_CANDIDATE_INCOMPLETE';
  end if;

  -- `RUL-MEM-09`: lo olvidado no se reaprende solo. Se devuelve `null`, no una
  -- excepcion: el turno del usuario no se cae porque el motor observe algo.
  if exists (
    select 1 from public.memory_tombstones t
     where t.user_id = p_user_id
       and t.scope = 'perfil'
       and t.subject_key = p_subject_key
       and t.lifted_at is null
  ) then
    return jsonb_build_object('candidate', null, 'reason', 'tombstoned');
  end if;

  -- `20c` §3: "No se pregunta lo que no se va a usar" — y menos lo que ya se
  -- sabe. Con el hecho vigente o en duda, la observacion no abre candidato.
  if exists (
    select 1 from public.user_profile_facts f
     where f.user_id = p_user_id
       and f.subject_key = p_subject_key
       and f.status in ('vigente', 'en_duda')
  ) then
    return jsonb_build_object('candidate', null, 'reason', 'fact_already_known');
  end if;

  select * into v_candidate from public.user_profile_candidates
   where user_id = p_user_id and subject_key = p_subject_key
   for update;

  if found then
    -- Ya decidido es ya decidido. `never_ask` sobre todo: reabrirlo convertiria
    -- "no me preguntes esto" en una molestia recurrente (`20c` §3).
    if v_candidate.status in ('accepted', 'rejected', 'never_ask') then
      return jsonb_build_object('candidate', null, 'reason', 'already_resolved');
    end if;

    update public.user_profile_candidates set
      statement = v_statement,
      -- La evidencia se acumula sin repetirse: dos turnos que dicen lo mismo
      -- son una sola referencia, no dos.
      evidence_refs = case
        when v_evidence = any (evidence_refs) then evidence_refs
        else (evidence_refs || v_evidence)
      end,
      metadata = metadata || coalesce(p_metadata, '{}'::jsonb),
      updated_at = v_now
    where id = v_candidate.id
    returning * into v_candidate;

    return jsonb_build_object(
      'candidate', to_jsonb(v_candidate), 'reason', 'reinforced'
    );
  end if;

  insert into public.user_profile_candidates (
    user_id, subject_key, statement, status, ask_count,
    evidence_refs, metadata, created_at, updated_at
  ) values (
    p_user_id, p_subject_key, v_statement, 'observado', 0,
    array[v_evidence], coalesce(p_metadata, '{}'::jsonb), v_now, v_now
  )
  returning * into v_candidate;

  -- Sin `memory_events` aqui, y a proposito: `memory_events_action_known`
  -- (`062`) no admite "observado", y las acciones que audita §16 son las que
  -- el usuario ejerce sobre su memoria (visto, corregido, olvidado,
  -- confirmado, rechazado). Ampliar ese check para anotar una observacion
  -- automatica seria cambiar el contrato de auditoria por telemetria; la fila
  -- del candidato ya es el registro de que se observo, con su evidencia.

  return jsonb_build_object(
    'candidate', to_jsonb(v_candidate), 'reason', 'created'
  );
end;
$$;

comment on function public.record_profile_candidate_observation(
  uuid, text, text, text, jsonb, timestamptz
) is
  'AC-PERF-14: registra en el momento un hecho de perfil observado en una conversacion, como candidato. Nunca crea un hecho vigente (AC-MEM-03) y respeta lapida, hecho ya conocido y candidato ya decidido.';

-- -------------------------------------------------------------
-- 2. Anotar que se pregunto por el
-- -------------------------------------------------------------
--
-- `20c` §3 cuenta los intentos ignorados, no las veces que se mostro la
-- tarjeta: `ask_count` sube aqui, en el turno en que se pregunta, y quien
-- responde lo resuelve por otra via. Pasar a `pending_confirmation` es ademas
-- lo que dispara la notificacion `confirmar_hecho` de `063`, para que la misma
-- pregunta este en la app y no solo en el hilo.

create or replace function public.mark_profile_candidate_asked(
  p_user_id uuid,
  p_candidate_id uuid,
  p_conversation_state_id text,
  p_now timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := coalesce(p_now, now());
  v_candidate public.user_profile_candidates;
begin
  if p_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_candidate from public.user_profile_candidates
   where id = p_candidate_id and user_id = p_user_id
   for update;
  if not found then
    return jsonb_build_object('candidate', null, 'reason', 'not_found');
  end if;
  if v_candidate.status in ('accepted', 'rejected', 'never_ask') then
    return jsonb_build_object('candidate', null, 'reason', 'already_resolved');
  end if;

  update public.user_profile_candidates set
    status = 'pending_confirmation',
    ask_count = ask_count + 1,
    last_asked_at = v_now,
    -- El id del estado conversacional es lo que hace cumplible
    -- "una sola vez por conversacion" (`AC-PERF-02`) sin inventar un contador
    -- aparte: la conversacion **es** esa fila.
    metadata = metadata || jsonb_build_object(
      'asked_conversation_state_id', p_conversation_state_id
    ),
    updated_at = v_now
  where id = v_candidate.id
  returning * into v_candidate;

  return jsonb_build_object(
    'candidate', to_jsonb(v_candidate), 'reason', 'asked'
  );
end;
$$;

comment on function public.mark_profile_candidate_asked(
  uuid, uuid, text, timestamptz
) is
  'AC-PERF-02: anota que este turno pregunto por un candidato de perfil. Sube ask_count y sella la conversacion en que se pregunto.';

-- -------------------------------------------------------------
-- 3. Resolverlo conversando
-- -------------------------------------------------------------

create or replace function public.resolve_profile_candidate_for_user(
  p_user_id uuid,
  p_candidate_id uuid,
  p_resolution text,
  p_statement text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp, extensions
as $$
declare
  v_result jsonb;
begin
  if p_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- Mismo mecanismo que `071`: `auth.uid()` lee `request.jwt.claims`, y
  -- fijarla con `is_local = true` la deja valida solo dentro de esta
  -- transaccion y la revierte al terminar, aunque la delegada falle.
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_user_id::text)::text,
    true
  );

  v_result := public.resolve_profile_candidate(
    p_user_id,
    p_candidate_id,
    p_resolution,
    p_statement,
    p_idempotency_key
  );

  return v_result;
end;
$$;

comment on function public.resolve_profile_candidate_for_user(
  uuid, uuid, text, text, text
) is
  'AC-PERF-02: variante de service_role de resolve_profile_candidate para el motor conversacional, que no tiene sesion de usuario. Delega sin duplicar la logica de confirmacion.';

-- -------------------------------------------------------------
-- Permisos: solo service_role. Nadie mas puede declarar un user_id.
-- -------------------------------------------------------------

revoke all on function public.record_profile_candidate_observation(
  uuid, text, text, text, jsonb, timestamptz
) from public, anon, authenticated;
revoke all on function public.mark_profile_candidate_asked(
  uuid, uuid, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.resolve_profile_candidate_for_user(
  uuid, uuid, text, text, text
) from public, anon, authenticated;

grant execute on function public.record_profile_candidate_observation(
  uuid, text, text, text, jsonb, timestamptz
) to service_role;
grant execute on function public.mark_profile_candidate_asked(
  uuid, uuid, text, timestamptz
) to service_role;
grant execute on function public.resolve_profile_candidate_for_user(
  uuid, uuid, text, text, text
) to service_role;
