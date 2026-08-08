-- =============================================================
-- Migration 069: Conversation memory state scoped by thread
-- Corte fix/estado-correccion-por-hilo - WEB-D289
-- Depends on: 001-068
-- =============================================================
--
-- `023` creo el estado conversacional con clave `(user_id, channel, scope)` y
-- `042` la redujo a `(user_id, scope)` para que el foco fuera compartido entre
-- canales. Con hilos de asistente web (`065_w17_assistant_threads.sql`) esa
-- clave quedo corta: **todas** las conversaciones de un usuario comparten un
-- unico estado, asi que una propuesta hecha en un hilo sigue "esperando
-- confirmacion" en cualquier otro y un "si" sobre un tema distinto podia
-- ejecutar una eliminacion vieja (`23` §5b.1, `AC-RT-13`).
--
-- `thread_key` la escribe `resolveTurnThreadKey` (`src/core/conversation/
-- thread-scope.ts`): `hilo:<uuid>` cuando el turno trae hilo, `canal:<canal>`
-- cuando el canal aun no tiene hilos. El `default ''` es la clave heredada:
-- las filas anteriores a esta migracion la conservan y ningun turno real la
-- vuelve a usar, asi que dejan de resolver confirmaciones escritas en cuanto
-- caducan por su propio TTL.

alter table public.conversation_memory_states
  add column if not exists thread_key text not null default '';

-- La clave nueva incluye el hilo. Se borra primero cualquier duplicado que la
-- clave vieja no permitia (no puede haberlo hoy, pero la migracion tiene que
-- ser reejecutable sin fallar).
with ranked_states as (
  select
    id,
    row_number() over (
      partition by user_id, scope, thread_key
      order by updated_at desc, id desc
    ) as row_number
  from public.conversation_memory_states
)
delete from public.conversation_memory_states as state
using ranked_states as ranked
where state.id = ranked.id
  and ranked.row_number > 1;

drop index if exists public.conversation_memory_states_user_scope_unique;

create unique index if not exists conversation_memory_states_user_scope_thread_unique
  on public.conversation_memory_states (user_id, scope, thread_key);

drop index if exists public.conversation_memory_states_user_active_idx;

create index if not exists conversation_memory_states_user_active_idx
  on public.conversation_memory_states (user_id, scope, thread_key, expires_at desc);

comment on column public.conversation_memory_states.thread_key is
  'Hilo dueño del estado: hilo:<thread_id> o canal:<canal> cuando el canal no tiene hilos. La cadena vacia es el estado heredado anterior a esta migracion y nunca coincide con un turno real.';
