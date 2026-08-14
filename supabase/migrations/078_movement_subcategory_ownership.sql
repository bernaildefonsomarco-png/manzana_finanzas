-- =============================================================
-- Migration 078: la subcategoria de un movimiento es siempre del dueno
-- Corte feat/mover-un-gasto-a-una-subcategoria
-- Depends on: 001-077 (003 crea user_subcategories, 006 la columna del movimiento)
-- =============================================================
--
-- `SEG-04`: nadie ve ni toca lo de otro. Hasta ahora esa frontera vivia entera
-- en las funciones que clasifican desde la pantalla:
-- `commit_movement_classification` (062) comprueba `auth.uid()` y ademas exige
-- que la subcategoria sea del usuario y cuelgue de la categoria del
-- movimiento. La columna en si, en cambio, nunca tuvo esa red: la clave
-- foranea de `006` apunta a `user_subcategories(id)` **sin mirar de quien es**.
--
-- Mientras nadie escribiera `subcategory_id` fuera de esas funciones, el hueco
-- era teorico. Deja de serlo cuando el asistente aprende a mover un movimiento
-- a una subcategoria: ese camino escribe por `core_commit_movement_update`
-- (008), que copia el `jsonb` que le llega tal cual y solo comprueba que el
-- movimiento sea del usuario. Un id de subcategoria equivocado —o inyectado—
-- habria enlazado un gasto con la etiqueta privada de otra persona, y el
-- nombre de esa etiqueta se lee despues en pantalla y en el propio asistente.
--
-- Por eso el invariante baja a la tabla: cualquiera que escriba la columna,
-- hoy o manana, con clave de servicio o autenticado, queda cubierto. Es la
-- misma decision que ya toma `user_subcategories_unique_label` en `003`: lo
-- que no puede ser cierto jamas se defiende en la base, no en cada llamador.
--
-- **Solo pertenencia, no coherencia.** El disparador no exige que la
-- subcategoria cuelgue de la categoria del movimiento, aunque
-- `commit_movement_classification` si lo haga: esa es una regla de producto
-- que hoy `POST /api/v1/movements` no aplica (`validateMovementClassificationReferences`
-- valida el dueno y nada mas), y convertirla en invariante duro rechazaria de
-- golpe escrituras que el resto de la aplicacion considera validas. La
-- pertenencia, en cambio, no admite excepcion legitima ninguna.
--
-- **Tampoco exige que este activa.** Archivar una subcategoria no desengancha
-- los movimientos que ya la usan (`SCR-CAT-02`), y `undo_classification_batch`
-- (062) devuelve los movimientos a la subcategoria de origen **antes** de
-- desarchivarla. Un disparador que pidiera `deleted_at is null` romperia ese
-- deshacer.
--
-- Reejecutable: `create or replace` mas `drop trigger if exists`.

set search_path = public, manzana;

-- `security definer`: el invariante se evalua contra la tabla de verdad y no
-- contra lo que el llamador alcanza a ver. Con RLS de por medio, la fila de
-- otro usuario es invisible; sin esto, "no la veo" y "no existe" darian el
-- mismo resultado y el error diria lo que no es.
create or replace function manzana.assert_movement_subcategory_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.subcategory_id is null then
    return new;
  end if;

  -- Una actualizacion que no toca el enlace no se revalida: si la fila ya
  -- estaba asi, revisarla ahora convertiria cualquier correccion de monto en
  -- un fallo por algo que no cambio.
  if tg_op = 'UPDATE'
     and new.subcategory_id is not distinct from old.subcategory_id
     and new.user_id is not distinct from old.user_id then
    return new;
  end if;

  if not exists (
    select 1
      from public.user_subcategories s
     where s.id = new.subcategory_id
       and s.user_id = new.user_id
  ) then
    raise exception 'SUBCATEGORY_NOT_FOUND'
      using errcode = 'check_violation',
            detail = 'La subcategoria no pertenece al dueno del movimiento (SEG-04).';
  end if;

  return new;
end;
$$;

comment on function manzana.assert_movement_subcategory_owner() is
  'SEG-04: impide que un movimiento apunte a la subcategoria de otra persona. La clave foranea de 006 solo garantiza que el id exista, no de quien es.';

drop trigger if exists movements_subcategory_owner on public.movements;
create trigger movements_subcategory_owner
  before insert or update of subcategory_id, user_id on public.movements
  for each row execute function manzana.assert_movement_subcategory_owner();

-- El disparador corre siempre con los privilegios de su dueno; ningun rol
-- necesita `execute` sobre el, y concederselo a `authenticated` solo abriria
-- una funcion `security definer` mas de lo necesario.
revoke all on function manzana.assert_movement_subcategory_owner() from public, anon, authenticated;
