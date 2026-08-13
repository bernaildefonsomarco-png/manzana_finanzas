-- =============================================================
-- Migration 077: Semantic recall for assistant thread messages
-- Corte feat/memoria-semantica-de-hilo
-- Depends on: 001-076 (065 crea assistant_messages, 070 trae `vector`)
-- =============================================================
--
-- `065_w17_assistant_threads.sql` persiste el hilo entero, pero al modelo solo
-- le llegan los ultimos 20 turnos (`conversation-history.ts`): mas alla de esa
-- ventana la conversacion existe en la base y no existe para el asistente. Un
-- hilo largo se comporta como si la persona nunca hubiera dicho nada antes —
-- "ya te expliqué que la caja Viaje es para diciembre" contra un asistente que
-- no tiene forma de haberlo leido.
--
-- La ventana no se agranda: mandar el hilo entero es caro, lento y ademas peor
-- (el modelo se pierde). Lo que se agrega es **recuperacion por significado**
-- de lo que quedo fuera, exactamente el mismo mecanismo que `070` le dio a la
-- memoria confirmada, sobre la misma extension y el mismo modelo de embeddings.
--
-- Reejecutable y desacoplada del despliegue: mientras no exista, el codigo
-- degrada a "solo los ultimos 20 turnos", que es el comportamiento actual;
-- recien aplicada todos los `embedding` son null y la recuperacion no devuelve
-- nada hasta que corra el backfill
-- (`scripts/backfill-assistant-message-embeddings.ts`).

-- Misma nota que `070`: las extensiones de este proyecto viven en `extensions`.
create extension if not exists vector with schema extensions;
set search_path = public, extensions;

-- `vector(1536)` es la dimension nativa de `text-embedding-3-small` y la que
-- fija `MEMORY_EMBEDDING_DIMENSIONS`. Es el mismo contrato que `070`: un solo
-- modelo de embeddings para toda la app, y `embedding_model` permite reconocer
-- las filas viejas si algun dia cambia.
alter table public.assistant_messages
  add column if not exists embedding extensions.vector(1536),
  add column if not exists embedding_model text,
  add column if not exists embedding_input_hash text,
  add column if not exists embedding_generated_at timestamptz;

comment on column public.assistant_messages.embedding is
  'Vector semantico del texto legible del mensaje. Es un indice de recuperacion del propio hilo, nunca evidencia ni autorizacion: ningun bloque recuperado habilita una escritura que el turno no autorizara por su cuenta.';
comment on column public.assistant_messages.embedding_input_hash is
  'Hash del texto exacto que produjo el vector. Permite saltar el reembebido de un mensaje ya vectorizado sin volver a leer su contenido.';

-- HNSW por el mismo motivo que en `070`: el indice nace sobre una tabla donde
-- todos los embeddings son null (el backfill corre despues), asi que IVFFlat
-- quedaria entrenado sobre la nada. Metrica coseno: interesa la cercania de
-- significado, no el largo del mensaje.
--
-- Indice parcial y por hilo: la recuperacion **siempre** ocurre dentro de un
-- hilo, nunca a traves de toda la tabla del usuario.
create index if not exists assistant_messages_embedding_hnsw_idx
  on public.assistant_messages
  using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;

-- Vecinos mas cercanos dentro de un hilo y anteriores a un corte. Devuelve solo
-- `(id, similarity)`: el repositorio vuelve a leer los mensajes con su propia
-- consulta, asi que ni el vector ni ninguna columna de otro hilo puede colarse
-- por esta puerta.
--
-- `p_before` es la clave del contrato: el llamador pasa la fecha del mensaje
-- mas viejo que ya viaja textual en la ventana reciente, y esta funcion solo
-- mira lo que quedo **antes**. Sin ese corte, la recuperacion devolveria los
-- mismos turnos que el modelo ya esta leyendo y gastaria contexto en repetirse.
--
-- Los mensajes de `sistema` no son conversacion de nadie: se excluyen aqui
-- ademas de en la aplicacion.
--
-- `security invoker`: bajo un cliente `authenticated` sigue mandando la RLS de
-- `assistant_messages` ademas del filtro explicito por `user_id`.
-- `p_query_embedding` entra como `text` y se convierte adentro, igual que en
-- `070`, porque PostgREST serializa el vector como cadena JSON.
create or replace function public.search_assistant_messages_semantic(
  p_user_id uuid,
  p_thread_id uuid,
  p_query_embedding text,
  p_before timestamptz default null,
  p_limit integer default 8
)
returns table (id uuid, similarity real)
language sql
stable
security invoker
set search_path = public, extensions, pg_temp
as $$
  select
    message.id,
    (1 - (message.embedding <=> p_query_embedding::vector(1536)))::real
      as similarity
  from public.assistant_messages as message
  where message.user_id = p_user_id
    and message.thread_id = p_thread_id
    and message.embedding is not null
    and message.role in ('usuario', 'asistente')
    and (p_before is null or message.created_at < p_before)
  order by message.embedding <=> p_query_embedding::vector(1536)
  limit greatest(least(coalesce(p_limit, 8), 50), 1);
$$;

comment on function public.search_assistant_messages_semantic(uuid, uuid, text, timestamptz, integer) is
  'Ranking semantico de mensajes anteriores del mismo hilo, previos a p_before. Recupera contexto de conversacion, no autoriza nada: las escrituras siguen exigiendo su propia confirmacion en el turno.';

revoke all on function public.search_assistant_messages_semantic(uuid, uuid, text, timestamptz, integer)
  from public, anon;
grant execute on function public.search_assistant_messages_semantic(uuid, uuid, text, timestamptz, integer)
  to authenticated, service_role;
