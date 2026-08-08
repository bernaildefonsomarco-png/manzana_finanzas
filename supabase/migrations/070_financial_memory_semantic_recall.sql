-- =============================================================
-- Migration 070: Semantic recall for confirmed financial memory
-- Corte feat/memoria-semantica - RUL-MEM-15
-- Depends on: 001-069
-- =============================================================
--
-- `024_financial_memory_learning.sql` creo la memoria confirmada y `044` le
-- puso ciclo de vida, evidencia y gobierno. Lo que nunca existio es una forma
-- de **encontrarla**: `searchConfirmedFinancialMemory` puntuaba por coincidencia
-- literal de tokens sobre `summary + canonical_key + search_terms`, asi que un
-- recuerdo guardado como "el usuario prefiere respuestas cortas" no se
-- recuperaba nunca ante "no te enrolles tanto" —cero tokens compartidos—. La
-- memoria estaba bien construida y mal recuperada, y el usuario lo vivia como
-- "no aprende de mi".
--
-- Esta migracion agrega el vector semantico del recuerdo y una funcion de
-- vecinos mas cercanos. **No cambia el gobierno**: la funcion repite
-- exactamente los mismos predicados que ya aplicaba el repositorio
-- (`confirmation_status`, `lifecycle_status`, `superseded_at`, `valid_until`) y
-- el consentimiento (`learning_preferences`) se sigue evaluando antes, en la
-- aplicacion, porque decide si se recupera algo o nada.
--
-- Reejecutable y desacoplada del despliegue: mientras no exista, el repositorio
-- degrada al emparejamiento por tokens; recien aplicada todos los `embedding`
-- son null y la busqueda semantica no devuelve nada, asi que el codigo nuevo
-- sigue degradando hasta que corra el backfill
-- (`scripts/backfill-financial-memory-embeddings.ts`).

-- `extensions` es donde este proyecto tiene sus extensiones: `044` y `062` ya
-- llaman `extensions.digest`, aunque `001` escribiera `create extension` sin
-- esquema (Supabase ya la traia instalada ahi). Se agrega `extensions` al
-- `search_path` de esta sesion para poder nombrar `vector` y
-- `vector_cosine_ops` sin calificar y sin romper si la extension ya existia.
create extension if not exists vector with schema extensions;
set search_path = public, extensions;

-- `vector(1536)` es la dimension nativa de `text-embedding-3-small` y la que
-- pide explicitamente el cliente de embeddings. Es un contrato fijo: si algun
-- dia cambia el modelo, `embedding_model` permite reconocer las filas viejas y
-- reembeberlas sin adivinar.
alter table public.financial_memory_items
  add column if not exists embedding extensions.vector(1536),
  add column if not exists embedding_model text,
  add column if not exists embedding_input_hash text,
  add column if not exists embedding_generated_at timestamptz;

comment on column public.financial_memory_items.embedding is
  'Vector semantico de summary + canonical_key + search_terms. Es un indice de recuperacion, nunca evidencia ni autorizacion: el gobierno de RUL-MEM sigue viviendo en lifecycle_status, confirmation_status y learning_preferences.';
comment on column public.financial_memory_items.embedding_input_hash is
  'Hash del texto exacto que produjo el vector. Permite saltar el reembebido cuando el recuerdo no cambio y detectar los que quedaron obsoletos tras una correccion.';

-- HNSW y no IVFFlat a proposito: IVFFlat necesita entrenar sus listas contra
-- filas ya existentes y aqui el indice se crea sobre una tabla donde **todos**
-- los embeddings son null (el backfill corre despues), asi que quedaria
-- entrenado sobre la nada y habria que reconstruirlo. HNSW se construye
-- incremental, no necesita entrenamiento ni tuning de `lists`, y su costo mayor
-- de escritura es irrelevante en una tabla que crece de a un recuerdo
-- confirmado por vez.
--
-- Metrica coseno (`vector_cosine_ops`, operador `<=>`): los embeddings de
-- OpenAI vienen normalizados y lo que interesa es la cercania de significado,
-- no la magnitud del texto. Un recuerdo de una linea y uno de un parrafo sobre
-- lo mismo tienen que quedar cerca.
--
-- Indice parcial: las filas sin vector no entran al indice ni al plan.
create index if not exists financial_memory_items_embedding_hnsw_idx
  on public.financial_memory_items
  using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;

-- Vecinos mas cercanos **dentro de lo que el gobierno ya permitia**. Devuelve
-- solo `(id, similarity)`: el repositorio vuelve a leer las filas con su propia
-- consulta gobernada, asi que ningun recuerdo suspendido, revocado, superseded
-- ni caducado puede entrar por esta puerta aunque esta funcion se equivocara.
-- Tampoco devuelve el vector: es un ranking, no una carga util.
--
-- `security invoker`: bajo un cliente `authenticated` sigue mandando la RLS de
-- `financial_memory_items` ademas del filtro explicito por `user_id`. Nunca
-- puede leer memoria de otro usuario.
-- `p_query_embedding` entra como `text` y se convierte adentro, no como
-- `vector` en la firma: PostgREST recibe el vector como una cadena JSON y asi
-- la conversion es explicita y no depende de como decida serializar el driver.
create or replace function public.search_financial_memory_semantic(
  p_user_id uuid,
  p_query_embedding text,
  p_now timestamptz default now(),
  p_limit integer default 24
)
returns table (id uuid, similarity real)
language sql
stable
security invoker
set search_path = public, extensions, pg_temp
as $$
  select
    item.id,
    (1 - (item.embedding <=> p_query_embedding::vector(1536)))::real
      as similarity
  from public.financial_memory_items as item
  where item.user_id = p_user_id
    and item.embedding is not null
    and item.confirmation_status = 'confirmed'
    and item.lifecycle_status = 'confirmed'
    and item.superseded_at is null
    and (item.valid_until is null or item.valid_until > p_now)
  order by item.embedding <=> p_query_embedding::vector(1536)
  limit greatest(least(coalesce(p_limit, 24), 100), 1);
$$;

comment on function public.search_financial_memory_semantic(uuid, text, timestamptz, integer) is
  'Ranking semantico de memoria confirmada. Repite los predicados de gobierno de RUL-MEM-04/05 y no sustituye el consentimiento de learning_preferences, que se evalua antes en la aplicacion.';

revoke all on function public.search_financial_memory_semantic(uuid, text, timestamptz, integer)
  from public, anon;
grant execute on function public.search_financial_memory_semantic(uuid, text, timestamptz, integer)
  to authenticated, service_role;
