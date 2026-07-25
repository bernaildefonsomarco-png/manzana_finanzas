-- =============================================================
-- Migration 042: Authoritative cross-channel conversation focus
-- Corte A - Exact focus_set and shared semantic session
-- Depends on: 001-041
-- =============================================================

-- Keep only the newest state when the same scope was used independently from
-- WhatsApp and dashboard before focus became cross-channel.
with ranked_states as (
  select
    id,
    row_number() over (
      partition by user_id, scope
      order by updated_at desc, id desc
    ) as row_number
  from public.conversation_memory_states
)
delete from public.conversation_memory_states as state
using ranked_states as ranked
where state.id = ranked.id
  and ranked.row_number > 1;

drop index if exists public.conversation_memory_states_user_channel_scope_unique;

create unique index if not exists conversation_memory_states_user_scope_unique
  on public.conversation_memory_states (user_id, scope);

drop index if exists public.conversation_memory_states_user_active_idx;

create index if not exists conversation_memory_states_user_active_idx
  on public.conversation_memory_states (user_id, scope, expires_at desc);

comment on column public.conversation_memory_states.channel is
  'Canal del ultimo turno que actualizo este estado. El foco es compartido entre canales por user_id y scope.';

comment on column public.conversation_memory_states.metadata is
  'Incluye working_set y su focus_set tipado: IDs en orden visible, consulta/filtros, procedencia, revision, hash y expiracion.';
