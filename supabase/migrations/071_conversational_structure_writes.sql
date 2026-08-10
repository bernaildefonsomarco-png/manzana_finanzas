-- =============================================================
-- Migration 071: Conversational writes for boxes, goals and budgets
-- Corte feat/escritura-cajas-metas-presupuestos - RUL-ESTR-04
-- Depends on: 001-070
-- =============================================================
--
-- `061_w12_budgets_goals.sql` creo `manzana.commit_budget_operation` y
-- `manzana.commit_goal_operation` como ejecutores transaccionales completos:
-- validan, escriben, emiten outbox y guardan recibo de idempotencia. Estan
-- bien hechos y esta migracion **no los toca**.
--
-- El problema es de quien los llama. Los dos resuelven el dueno con
-- `auth.uid()` y abortan con `AUTH_REQUIRED` si es null, asi que solo sirven
-- cuando la peticion trae la sesion del usuario. El motor conversacional no la
-- tiene: `FinancialOrchestrator` corre siempre con el cliente de servicio —lo
-- hace el asistente web (`handle-web-turn.ts`) y lo hace el canal de
-- mensajeria, cuyo webhook ni siquiera tiene usuario autenticado— y filtra por
-- `user_id` en sus propias consultas. Sin esta migracion, "creame un
-- presupuesto de 500 en comida" se cae con `AUTH_REQUIRED` por construccion, no
-- por un error del usuario.
--
-- La solucion es la misma que ya usa el nucleo de movimientos: una variante
-- concedida **solo a `service_role`** que recibe el `user_id` de forma
-- explicita (`manzana.core_commit_movement_create` lleva el `user_id` dentro
-- del payload y esta revocada de `authenticated`). Aqui el `user_id` viaja como
-- primer parametro obligatorio.
--
-- No duplica ni una linea de logica: fija la reclamacion `sub` del JWT de la
-- transaccion —local, se descarta al terminar— y delega en la funcion de
-- siempre, que sigue siendo la unica que sabe validar, escribir y sellar el
-- recibo. Si manana cambia la regla de negocio, cambia en un solo lugar.
--
-- El aislamiento por usuario no se debilita: pasa de venir de un token a venir
-- de un parametro que el motor toma del `external_event_log` ya autenticado.
-- Y sigue cerrado para todos los demas: `authenticated` y `anon` no pueden
-- ejecutar estas variantes, asi que ningun cliente puede pasar el `user_id` de
-- otra persona. El cliente autenticado sigue usando las funciones originales,
-- que siguen resolviendo el dueno con su propio token.
--
-- Reejecutable: solo son `create or replace` mas sus permisos.

set search_path = public, manzana;

-- -------------------------------------------------------------
-- Presupuestos
-- -------------------------------------------------------------

create or replace function manzana.commit_budget_operation_for_user(
  p_user_id uuid,
  p_operation text,
  p_budget_id uuid,
  p_payload jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, manzana, extensions
as $$
declare
  v_result jsonb;
begin
  if p_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- `auth.uid()` lee `request.jwt.claims`. Fijarla `is_local = true` la deja
  -- valida solo dentro de esta transaccion y la revierte al terminar, aunque
  -- la funcion delegada falle.
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_user_id::text)::text,
    true
  );

  v_result := manzana.commit_budget_operation(
    p_operation,
    p_budget_id,
    p_payload,
    p_idempotency_key
  );

  return v_result;
end;
$$;

comment on function manzana.commit_budget_operation_for_user(
  uuid, text, uuid, jsonb, text
) is
  'RUL-ESTR-04: variante de service_role de commit_budget_operation para el motor conversacional, que no tiene sesion de usuario. Recibe el user_id explicito y delega sin duplicar logica.';

-- -------------------------------------------------------------
-- Metas
-- -------------------------------------------------------------

create or replace function manzana.commit_goal_operation_for_user(
  p_user_id uuid,
  p_operation text,
  p_goal_id uuid,
  p_payload jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, manzana, extensions
as $$
declare
  v_result jsonb;
begin
  if p_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_user_id::text)::text,
    true
  );

  v_result := manzana.commit_goal_operation(
    p_operation,
    p_goal_id,
    p_payload,
    p_idempotency_key
  );

  return v_result;
end;
$$;

comment on function manzana.commit_goal_operation_for_user(
  uuid, text, uuid, jsonb, text
) is
  'RUL-ESTR-04: variante de service_role de commit_goal_operation para el motor conversacional, que no tiene sesion de usuario. Recibe el user_id explicito y delega sin duplicar logica.';

-- -------------------------------------------------------------
-- Envoltorios publicos (el cliente llama `public.<nombre>`)
-- -------------------------------------------------------------

create or replace function public.commit_budget_operation_for_user(
  p_user_id uuid,
  p_operation text,
  p_budget_id uuid,
  p_payload jsonb,
  p_idempotency_key text
)
returns jsonb
language sql
security definer
set search_path = public, manzana, extensions
as $$
  select manzana.commit_budget_operation_for_user(
    p_user_id,
    p_operation,
    p_budget_id,
    p_payload,
    p_idempotency_key
  );
$$;

create or replace function public.commit_goal_operation_for_user(
  p_user_id uuid,
  p_operation text,
  p_goal_id uuid,
  p_payload jsonb,
  p_idempotency_key text
)
returns jsonb
language sql
security definer
set search_path = public, manzana, extensions
as $$
  select manzana.commit_goal_operation_for_user(
    p_user_id,
    p_operation,
    p_goal_id,
    p_payload,
    p_idempotency_key
  );
$$;

-- -------------------------------------------------------------
-- Permisos: solo service_role. Nadie mas puede declarar un user_id.
-- -------------------------------------------------------------

revoke all on function manzana.commit_budget_operation_for_user(
  uuid, text, uuid, jsonb, text
) from public, anon, authenticated;
revoke all on function manzana.commit_goal_operation_for_user(
  uuid, text, uuid, jsonb, text
) from public, anon, authenticated;
revoke all on function public.commit_budget_operation_for_user(
  uuid, text, uuid, jsonb, text
) from public, anon, authenticated;
revoke all on function public.commit_goal_operation_for_user(
  uuid, text, uuid, jsonb, text
) from public, anon, authenticated;

grant execute on function manzana.commit_budget_operation_for_user(
  uuid, text, uuid, jsonb, text
) to service_role;
grant execute on function manzana.commit_goal_operation_for_user(
  uuid, text, uuid, jsonb, text
) to service_role;
grant execute on function public.commit_budget_operation_for_user(
  uuid, text, uuid, jsonb, text
) to service_role;
grant execute on function public.commit_goal_operation_for_user(
  uuid, text, uuid, jsonb, text
) to service_role;

-- -------------------------------------------------------------
-- Cajas: sin RPC nuevo a proposito
-- -------------------------------------------------------------
--
-- Una caja se escribe sobre `public.boxes`, que ya trae
-- `boxes_unique_name_per_account` como red dura contra duplicados, y su dinero
-- apartado sigue pasando por `manzana.core_commit_movement_create` (el motor de
-- saldos es el unico que mueve plata). La idempotencia de la creacion
-- conversacional se sella en `boxes.metadata->>'structure_idempotency_key'`, y
-- el rastro va a `movement_audit_log` con `entity_type = 'box'`, igual que ya
-- hacen las escrituras de clasificacion. Nada de eso necesita esquema nuevo.

create index if not exists boxes_structure_idempotency_idx
  on public.boxes ((metadata->>'structure_idempotency_key'))
  where metadata ? 'structure_idempotency_key';

comment on index public.boxes_structure_idempotency_idx is
  'RUL-ESTR-03: busqueda por clave de idempotencia de una caja creada conversando, para que un doble envio encuentre la de la primera vez en vez de crear otra.';
