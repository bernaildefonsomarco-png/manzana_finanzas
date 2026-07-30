-- =============================================================
-- Migration 054: Gestion de remitentes y sugerencias (28 S4.2/S4.6)
-- Corte W-10 - Correo y deteccion bancaria
-- Depends on: 041
-- =============================================================

alter table public.email_institutions
  add column if not exists default_senders text[] not null default '{}'::text[];

alter table public.user_email_sources
  add column if not exists origin text not null default 'catalogo',
  add column if not exists last_matched_at timestamptz;

alter table public.user_email_sources
  drop constraint if exists user_email_sources_origin_known;
alter table public.user_email_sources
  add constraint user_email_sources_origin_known
  check (origin in ('catalogo', 'usuario', 'sugerido'));

comment on column public.user_email_sources.origin is
  '28 S4.3: de donde vino el remitente — catalogo, lo agrego el usuario, o lo sugirio el sistema.';
comment on column public.user_email_sources.last_matched_at is
  'RUL-EMAIL-09: ultima vez que este remitente produjo una deteccion. Null = nunca.';

-- RUL-EMAIL-05: sugerencia de remitente nuevo, solo por metadatos (nunca
-- el cuerpo). "signal" guarda cuantos correos, con que frecuencia, y que
-- patron del asunto coincidio -- nunca el asunto en claro ni el cuerpo.
create table if not exists public.sender_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_connection_id uuid not null references public.email_connections(id) on delete cascade,
  sender text not null,
  suggested_institution text references public.email_institutions(institution_key),
  signal jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,

  constraint sender_suggestions_sender_valid
    check (
      length(sender) between 3 and 320
      and sender = lower(sender)
    ),
  constraint sender_suggestions_status_known
    check (status in ('pending', 'accepted', 'rejected', 'silenced'))
);

create unique index if not exists sender_suggestions_active_unique
  on public.sender_suggestions (user_id, email_connection_id, sender)
  where status = 'pending';

create index if not exists sender_suggestions_user_created_idx
  on public.sender_suggestions (user_id, created_at desc);

comment on table public.sender_suggestions is
  'RUL-EMAIL-05: remitentes no vigilados que parecen financieros por metadatos, en espera de que el usuario decida.';
comment on column public.sender_suggestions.signal is
  'Solo metadatos que sustentan la sugerencia (conteo, frecuencia, patron del asunto). Nunca asunto en claro ni cuerpo.';

alter table public.sender_suggestions enable row level security;

drop policy if exists "sender_suggestions: select own" on public.sender_suggestions;
create policy "sender_suggestions: select own"
  on public.sender_suggestions for select
  using (auth.uid() = user_id);

-- Las escrituras (crear la sugerencia, aceptar/rechazar/silenciar) pasan
-- por el backend con service-role, igual que el resto del pipeline de
-- correo (15 S4).
revoke all on public.sender_suggestions from anon, authenticated;
grant select on public.sender_suggestions to authenticated;

-- RUL-EMAIL-04: quien configura el remitente a mano (esta funcion, ya
-- existente desde 041) es "usuario", no el "catalogo" que el default de
-- la columna asume. El resto del cuerpo es identico a 041 (shadow al
-- editar, activo directo solo si ya hay una plantilla verificada).
create or replace function public.upsert_user_email_source(
  p_user_id uuid,
  p_institution_key text,
  p_connection_id uuid,
  p_notification_sender text,
  p_trace_id uuid
)
returns public.user_email_sources
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_source public.user_email_sources%rowtype;
  v_sender text := lower(trim(p_notification_sender));
  v_verified boolean := false;
begin
  if p_user_id is null or p_connection_id is null or p_trace_id is null then
    raise exception 'EMAIL_SOURCE_IDENTITY_REQUIRED';
  end if;
  if nullif(trim(p_institution_key), '') is null then
    raise exception 'EMAIL_SOURCE_INSTITUTION_REQUIRED';
  end if;
  if length(v_sender) not between 3 and 320
     or v_sender !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'EMAIL_SOURCE_SENDER_INVALID';
  end if;
  if not exists (
    select 1
      from public.email_institutions
     where institution_key = p_institution_key and enabled = true
  ) then
    raise exception 'EMAIL_SOURCE_INSTITUTION_NOT_FOUND';
  end if;
  if not exists (
    select 1
      from public.email_connections
     where id = p_connection_id
       and user_id = p_user_id
       and provider = 'gmail'
       and deleted_at is null
       and status <> 'disconnected'
  ) then
    raise exception 'EMAIL_SOURCE_CONNECTION_NOT_FOUND';
  end if;
  if exists (
    select 1
      from public.user_email_sources
     where email_connection_id = p_connection_id
       and notification_sender = v_sender
       and institution_key <> p_institution_key
       and deleted_at is null
       and status <> 'disabled'
  ) then
    raise exception 'EMAIL_SOURCE_SENDER_ALREADY_ASSIGNED';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || p_institution_key, 0)
  );

  select exists (
    select 1
      from public.email_parse_templates
     where provider = 'gmail'
       and institution_key = p_institution_key
       and sender_pattern = v_sender
       and enabled = true
       and activation_mode = 'active'
       and verification_status = 'verified'
  ) into v_verified;

  select * into v_source
    from public.user_email_sources
   where user_id = p_user_id
     and institution_key = p_institution_key
     and deleted_at is null
     and status <> 'disabled'
   for update;

  if found then
    update public.user_email_sources
       set email_connection_id = p_connection_id,
           notification_sender = v_sender,
           status = case when v_verified then 'active' else 'shadow' end,
           verification_status =
             case when v_verified then 'verified' else 'pending' end,
           verified_at = case when v_verified then now() else null end,
           origin = 'usuario',
           deleted_at = null,
           metadata = metadata || jsonb_build_object(
             'configured_by', 'user',
             'configured_at', now(),
             'sender_hash',
               encode(extensions.digest(v_sender, 'sha256'), 'hex')
           )
     where id = v_source.id
     returning * into v_source;
  else
    insert into public.user_email_sources (
      user_id,
      institution_key,
      email_connection_id,
      notification_sender,
      status,
      verification_status,
      verified_at,
      origin,
      metadata
    ) values (
      p_user_id,
      p_institution_key,
      p_connection_id,
      v_sender,
      case when v_verified then 'active' else 'shadow' end,
      case when v_verified then 'verified' else 'pending' end,
      case when v_verified then now() else null end,
      'usuario',
      jsonb_build_object(
        'configured_by', 'user',
        'configured_at', now(),
        'sender_hash', encode(extensions.digest(v_sender, 'sha256'), 'hex')
      )
    )
    returning * into v_source;
  end if;

  insert into public.transactional_outbox (
    user_id,
    event_type,
    aggregate_type,
    aggregate_id,
    payload,
    payload_version,
    status,
    trace_id,
    metadata
  ) values (
    p_user_id,
    'email_source_configured',
    'user_email_source',
    v_source.id,
    jsonb_build_object(
      'source_id', v_source.id,
      'institution_key', v_source.institution_key,
      'connection_id', v_source.email_connection_id,
      'status', v_source.status,
      'verification_status', v_source.verification_status
    ),
    1,
    'pending',
    p_trace_id,
    jsonb_build_object(
      'financial_write', false,
      'email_cut', 32,
      'sender_exposed', false
    )
  );

  return v_source;
end;
$$;

revoke all on function public.upsert_user_email_source(
  uuid, text, uuid, text, uuid
) from public, anon, authenticated;
grant execute on function public.upsert_user_email_source(
  uuid, text, uuid, text, uuid
) to service_role;
