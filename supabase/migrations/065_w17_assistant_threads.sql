-- =============================================================
-- Migration 065: W-17 - El asistente en la app (hilos y mensajes)
-- Corte 17 (41_asistente_ia_en_la_app.md)
-- Depends on: 001-064
-- WEB-D262: numero real; la reserva documental "052" de 13 S7.5
-- colisionaba con 052_movements_search_vector.sql (W-09, AC-MOV-05).
-- =============================================================

do $$ begin
  create type public.thread_status as enum ('activo', 'archivado');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.assistant_message_role as enum ('usuario', 'asistente', 'sistema');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.assistant_action_status as enum ('propuesta', 'confirmada', 'descartada', 'expirada');
exception when duplicate_object then null;
end $$;

-- =============================================================
-- assistant_threads (13 S7.5, 41 SS12/15)
-- =============================================================

create table if not exists public.assistant_threads (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text,
  channel    text not null default 'web',
  status     public.thread_status not null default 'activo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint assistant_threads_title_length check (title is null or length(title) between 1 and 160),
  constraint assistant_threads_channel_known check (channel in ('web', 'whatsapp'))
);

create trigger assistant_threads_set_updated_at
  before update on public.assistant_threads
  for each row execute function manzana.set_updated_at();

create index if not exists assistant_threads_user_active_idx
  on public.assistant_threads (user_id, updated_at desc)
  where deleted_at is null;

alter table public.assistant_threads enable row level security;

create policy "assistant_threads: select own"
  on public.assistant_threads for select
  using (auth.uid() = user_id);

create policy "assistant_threads: insert own"
  on public.assistant_threads for insert
  with check (auth.uid() = user_id);

create policy "assistant_threads: update own"
  on public.assistant_threads for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.assistant_threads to authenticated;
grant select, insert, update, delete on public.assistant_threads to service_role;

-- =============================================================
-- assistant_messages (13 S7.5, 22 evidencia, WEB-D013 proponer/ejecutar)
-- =============================================================

create table if not exists public.assistant_messages (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  thread_id              uuid not null references public.assistant_threads(id) on delete cascade,
  role                   public.assistant_message_role not null,
  -- Bloques neutrales de canal (21 S5), no texto renderizado: el mismo
  -- hilo se presenta en la web hoy y en WhatsApp cuando exista su
  -- presentador (21 S9).
  content                jsonb not null default '[]'::jsonb,
  evidence_refs          text[] not null default '{}',
  proposed_action        jsonb,
  action_status          public.assistant_action_status,
  resulting_movement_id  uuid references public.movements(id),
  trace_id               text,
  -- Idempotencia del envio (41 S14): un reintento de red del mismo turno
  -- no debe crear un segundo mensaje. No existia en 13 S7.5 original.
  idempotency_key        text not null,
  created_at             timestamptz not null default now(),

  constraint assistant_messages_content_array check (jsonb_typeof(content) = 'array'),
  constraint assistant_messages_action_requires_proposal
    check (action_status is null or proposed_action is not null),
  constraint assistant_messages_unique_idempotency unique (user_id, idempotency_key)
);

create index if not exists assistant_messages_thread_created_idx
  on public.assistant_messages (thread_id, created_at);

create index if not exists assistant_messages_user_updated_idx
  on public.assistant_messages (user_id, created_at desc);

-- Una propuesta pendiente por hilo: localizarla para vigencia (23 S5b.1)
-- y para RUL-ASI-07 sin recorrer todo el mensaje.
create index if not exists assistant_messages_pending_proposal_idx
  on public.assistant_messages (thread_id, created_at desc)
  where action_status = 'propuesta';

alter table public.assistant_messages enable row level security;

create policy "assistant_messages: select own"
  on public.assistant_messages for select
  using (auth.uid() = user_id);

create policy "assistant_messages: insert own"
  on public.assistant_messages for insert
  with check (auth.uid() = user_id);

create policy "assistant_messages: update own"
  on public.assistant_messages for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.assistant_messages to authenticated;
grant select, insert, update, delete on public.assistant_messages to service_role;
