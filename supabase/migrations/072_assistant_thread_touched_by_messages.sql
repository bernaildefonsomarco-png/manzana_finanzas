-- =============================================================
-- Migration 072: assistant_threads.updated_at refleja la actividad real
-- Corte fix/hilo-activo-por-actividad - SCR-ASI-04
-- Depends on: 001-071
-- =============================================================
--
-- `065_w17_assistant_threads.sql` creo el trigger `assistant_threads_set_
-- updated_at`, pero solo dispara `before update on assistant_threads`.
-- Agregar un mensaje no actualiza la fila del hilo, asi que `updated_at`
-- se quedaba clavado en la fecha de creacion por mas que la conversacion
-- siguiera viva.
--
-- Eso rompe el orden que declara `SCR-ASI-04` ("historial, mas reciente
-- primero"): `listAssistantThreads` ordena por `updated_at desc`, y
-- `useAssistantConversation` abre `threadsQuery.data[0]` cuando no hay hilo
-- fijado. Un hilo vacio creado despues podia quedar por encima del hilo con
-- la conversacion real y abrirse en su lugar. En produccion los tres hilos
-- tenian `updated_at = created_at` pese a tener 107, 59 y 7 mensajes.
--
-- El trigger toca el hilo padre al insertar un mensaje. Es `security
-- definer` porque el insert tambien llega desde el cliente autenticado y la
-- politica de update exige ser dueno; el guard por `user_id` lo compensa de
-- forma explicita: solo se toca el hilo cuyo dueno coincide con el del
-- mensaje, nunca uno ajeno.
--
-- Reejecutable: `create or replace` mas `drop trigger if exists`.

create or replace function manzana.touch_assistant_thread()
returns trigger
language plpgsql
security definer
set search_path = public, manzana
as $$
begin
  update public.assistant_threads
     set updated_at = greatest(updated_at, new.created_at)
   where id = new.thread_id
     and user_id = new.user_id;

  return new;
end;
$$;

comment on function manzana.touch_assistant_thread() is
  'SCR-ASI-04: un mensaje nuevo vuelve reciente a su hilo, para que el orden por updated_at refleje la conversacion viva y no la fecha de creacion.';

drop trigger if exists assistant_messages_touch_thread on public.assistant_messages;

create trigger assistant_messages_touch_thread
  after insert on public.assistant_messages
  for each row execute function manzana.touch_assistant_thread();

-- Los hilos existentes arrastran la fecha de creacion. Se corrige con la
-- fecha del ultimo mensaje de cada uno; los que nunca tuvieron mensajes
-- conservan la suya, que en su caso si es la verdad.
update public.assistant_threads as thread
   set updated_at = ultimo.ultimo_mensaje
  from (
    select thread_id, max(created_at) as ultimo_mensaje
      from public.assistant_messages
     group by thread_id
  ) as ultimo
 where thread.id = ultimo.thread_id
   and thread.updated_at < ultimo.ultimo_mensaje;
