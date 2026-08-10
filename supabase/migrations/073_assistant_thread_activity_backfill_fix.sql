-- =============================================================
-- Migration 073: corrige el backfill de actividad de los hilos
-- Corte fix/hilo-activo-por-actividad - SCR-ASI-04
-- Depends on: 001-072
-- =============================================================
--
-- La `072` fallo en un detalle que solo se ve ejecutandola: el trigger
-- `assistant_threads_set_updated_at` de la `065` corre `before update` y
-- ejecuta `manzana.set_updated_at()`, que hace `new.updated_at = now()` sin
-- mirar el valor entrante. Cualquier `update` sobre la tabla termina con
-- `now()`, venga de donde venga.
--
-- Consecuencia: el backfill de la `072` puso `now()` en todos los hilos que
-- tocaba en vez de la fecha de su ultimo mensaje, y los dos hilos activos
-- quedaron empatados al milisegundo. El empate deja el orden en manos del
-- desempate por `id`, que es justo la arbitrariedad que la `072` venia a
-- eliminar.
--
-- Aqui se corrige de verdad: se desactiva el trigger durante la correccion,
-- se escribe la fecha real del ultimo mensaje y se vuelve a activar. La tabla
-- tiene un punado de filas por usuario, asi que el bloqueo es momentaneo.
--
-- Ademas se simplifica `touch_assistant_thread`. Su `greatest(updated_at,
-- new.created_at)` era codigo muerto —el otro trigger lo pisaba igual— y un
-- calculo que no puede cambiar el resultado confunde a quien lo lea. Para el
-- camino en vivo `now()` es ademas la respuesta correcta: el mensaje se acaba
-- de insertar, asi que la ultima actividad del hilo es ahora.
--
-- Reejecutable.

alter table public.assistant_threads disable trigger assistant_threads_set_updated_at;

update public.assistant_threads as thread
   set updated_at = ultimo.ultimo_mensaje
  from (
    select thread_id, max(created_at) as ultimo_mensaje
      from public.assistant_messages
     group by thread_id
  ) as ultimo
 where thread.id = ultimo.thread_id
   and thread.updated_at is distinct from ultimo.ultimo_mensaje;

alter table public.assistant_threads enable trigger assistant_threads_set_updated_at;

create or replace function manzana.touch_assistant_thread()
returns trigger
language plpgsql
security definer
set search_path = public, manzana
as $$
begin
  -- `assistant_threads_set_updated_at` va a forzar `now()` en este mismo
  -- update, asi que aqui no se calcula ninguna fecha: se toca el hilo y esa
  -- es toda la intencion. El guard por `user_id` es lo que importa, porque
  -- esta funcion es `security definer` y no puede tocar un hilo ajeno.
  update public.assistant_threads
     set updated_at = new.created_at
   where id = new.thread_id
     and user_id = new.user_id;

  return new;
end;
$$;

comment on function manzana.touch_assistant_thread() is
  'SCR-ASI-04: un mensaje nuevo vuelve reciente a su hilo. El trigger de updated_at de la tabla fija now() sobre este update; el valor escrito aqui solo documenta la intencion.';
