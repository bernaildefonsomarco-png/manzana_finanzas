-- =============================================================
-- Migration 041: multi-mailbox institutional email sources
-- Corte 32 - bank -> Gmail mailbox -> verified sender -> Pending
-- =============================================================

alter table public.email_connections
  drop constraint if exists email_connections_one_provider_per_user;

create unique index if not exists email_connections_user_provider_email_idx
  on public.email_connections (user_id, provider, email_address);

create table if not exists public.email_institutions (
  institution_key text primary key,
  display_name text not null,
  aliases text[] not null default '{}'::text[],
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,

  constraint email_institutions_key_valid
    check (institution_key ~ '^[a-z0-9][a-z0-9_-]{1,79}$'),
  constraint email_institutions_display_name_valid
    check (length(trim(display_name)) between 2 and 80),
  constraint email_institutions_sort_order_valid
    check (sort_order between 1 and 10000),
  constraint email_institutions_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create trigger email_institutions_updated_at
  before update on public.email_institutions
  for each row execute function manzana.set_updated_at();

insert into public.email_institutions (
  institution_key,
  display_name,
  aliases,
  enabled,
  sort_order,
  metadata
) values
  (
    'bcp',
    'BCP',
    array['BCP', 'Banco de Credito del Peru'],
    true,
    10,
    jsonb_build_object('tier', 'P0', 'catalog_version', 1)
  ),
  (
    'yape',
    'Yape',
    array['Yape'],
    true,
    20,
    jsonb_build_object('tier', 'P0', 'catalog_version', 1)
  ),
  (
    'interbank',
    'Interbank',
    array['Interbank'],
    true,
    30,
    jsonb_build_object('tier', 'P1', 'catalog_version', 1)
  ),
  (
    'bbva',
    'BBVA',
    array['BBVA', 'BBVA Peru'],
    true,
    40,
    jsonb_build_object('tier', 'P1', 'catalog_version', 1)
  ),
  (
    'plin',
    'Plin',
    array['Plin'],
    true,
    50,
    jsonb_build_object('tier', 'P1', 'catalog_version', 1)
  ),
  (
    'scotiabank',
    'Scotiabank',
    array['Scotiabank', 'Scotiabank Peru'],
    true,
    60,
    jsonb_build_object('tier', 'P2', 'catalog_version', 1)
  )
on conflict (institution_key) do update set
  display_name = excluded.display_name,
  aliases = excluded.aliases,
  enabled = excluded.enabled,
  sort_order = excluded.sort_order,
  metadata = public.email_institutions.metadata || excluded.metadata;

create table if not exists public.user_email_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  institution_key text not null
    references public.email_institutions(institution_key),
  email_connection_id uuid not null
    references public.email_connections(id) on delete cascade,
  notification_sender text not null,
  status text not null default 'shadow',
  verification_status text not null default 'pending',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,

  constraint user_email_sources_sender_valid
    check (
      length(notification_sender) between 3 and 320
      and notification_sender = lower(notification_sender)
      and notification_sender ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ),
  constraint user_email_sources_status_known
    check (status in ('shadow', 'active', 'paused', 'disabled')),
  constraint user_email_sources_verification_known
    check (verification_status in ('pending', 'verified', 'rejected')),
  constraint user_email_sources_active_verified
    check (
      status <> 'active'
      or (verification_status = 'verified' and verified_at is not null)
    ),
  constraint user_email_sources_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create trigger user_email_sources_updated_at
  before update on public.user_email_sources
  for each row execute function manzana.set_updated_at();

create unique index if not exists user_email_sources_user_institution_idx
  on public.user_email_sources (user_id, institution_key)
  where deleted_at is null and status <> 'disabled';

create unique index if not exists user_email_sources_connection_sender_idx
  on public.user_email_sources (email_connection_id, notification_sender)
  where deleted_at is null and status <> 'disabled';

create index if not exists user_email_sources_user_status_idx
  on public.user_email_sources (user_id, status, institution_key)
  where deleted_at is null;

comment on table public.email_institutions is
  'Catalogo operativo de instituciones configurables por email. Se actualiza sin deploy.';
comment on table public.user_email_sources is
  'Vinculo por usuario entre institucion, Gmail conectado y remitente exacto. Shadow nunca crea Pending.';

alter table public.email_institutions enable row level security;
alter table public.user_email_sources enable row level security;

revoke all on public.email_institutions from public, anon, authenticated;
revoke all on public.user_email_sources from public, anon, authenticated;
grant select, insert, update, delete on public.email_institutions to service_role;
grant select, insert, update, delete on public.user_email_sources to service_role;

-- Los ejemplos documentales nacen en shadow/draft. Permiten evaluar al agente
-- sin convertir remitentes no verificados en una ruta de escritura.
insert into public.email_parse_templates (
  id,
  provider,
  institution_key,
  sender_pattern,
  template_version,
  priority,
  enabled,
  parser_config,
  sample_hashes,
  metadata,
  activation_mode,
  verification_status
) values
  (
    '04100000-0000-4000-8000-000000000001',
    'gmail',
    'yape',
    'notificaciones@yape.com.pe',
    'institution-agent-shadow-v1',
    100,
    true,
    jsonb_build_object(
      'schema_version', 'gmail_parser_v1',
      'subject_patterns', jsonb_build_array('Yape'),
      'extraction_rules', jsonb_build_object(
        'amount', jsonb_build_object(
          'pattern', '(?:S/|PEN|USD|US\$)\s*([\d.,]+)',
          'type', 'number'
        ),
        'direction', 'out',
        'operation_hint', 'unknown'
      ),
      'allow_generic_fallback', true,
      'confidence', jsonb_build_object('template', 0.80, 'fallback', 0.40),
      'institution_aliases', jsonb_build_array('Yape')
    ),
    '{}'::text[],
    jsonb_build_object(
      'activation_policy', 'institutional_gate',
      'documented_sender_unverified', true,
      'sender_authentication', 'dkim_dmarc_required',
      'contains_user_content', false
    ),
    'shadow',
    'draft'
  ),
  (
    '04100000-0000-4000-8000-000000000002',
    'gmail',
    'interbank',
    'alertas@interbank.pe',
    'institution-agent-shadow-v1',
    100,
    true,
    jsonb_build_object(
      'schema_version', 'gmail_parser_v1',
      'subject_patterns', jsonb_build_array('Interbank'),
      'extraction_rules', jsonb_build_object(
        'amount', jsonb_build_object(
          'pattern', '(?:S/|PEN|USD|US\$)\s*([\d.,]+)',
          'type', 'number'
        ),
        'direction', 'out',
        'operation_hint', 'unknown'
      ),
      'allow_generic_fallback', true,
      'confidence', jsonb_build_object('template', 0.80, 'fallback', 0.40),
      'institution_aliases', jsonb_build_array('Interbank')
    ),
    '{}'::text[],
    jsonb_build_object(
      'activation_policy', 'institutional_gate',
      'documented_sender_unverified', true,
      'sender_authentication', 'dkim_dmarc_required',
      'contains_user_content', false
    ),
    'shadow',
    'draft'
  ),
  (
    '04100000-0000-4000-8000-000000000003',
    'gmail',
    'bbva',
    'notificaciones@bbva.pe',
    'institution-agent-shadow-v1',
    100,
    true,
    jsonb_build_object(
      'schema_version', 'gmail_parser_v1',
      'subject_patterns', jsonb_build_array('BBVA'),
      'extraction_rules', jsonb_build_object(
        'amount', jsonb_build_object(
          'pattern', '(?:S/|PEN|USD|US\$)\s*([\d.,]+)',
          'type', 'number'
        ),
        'direction', 'out',
        'operation_hint', 'unknown'
      ),
      'allow_generic_fallback', true,
      'confidence', jsonb_build_object('template', 0.80, 'fallback', 0.40),
      'institution_aliases', jsonb_build_array('BBVA', 'BBVA Peru')
    ),
    '{}'::text[],
    jsonb_build_object(
      'activation_policy', 'institutional_gate',
      'documented_sender_unverified', true,
      'sender_authentication', 'dkim_dmarc_required',
      'contains_user_content', false
    ),
    'shadow',
    'draft'
  ),
  (
    '04100000-0000-4000-8000-000000000004',
    'gmail',
    'plin',
    'notificaciones@plin.pe',
    'institution-agent-shadow-v1',
    100,
    true,
    jsonb_build_object(
      'schema_version', 'gmail_parser_v1',
      'subject_patterns', jsonb_build_array('Plin'),
      'extraction_rules', jsonb_build_object(
        'amount', jsonb_build_object(
          'pattern', '(?:S/|PEN|USD|US\$)\s*([\d.,]+)',
          'type', 'number'
        ),
        'direction', 'out',
        'operation_hint', 'unknown'
      ),
      'allow_generic_fallback', true,
      'confidence', jsonb_build_object('template', 0.80, 'fallback', 0.40),
      'institution_aliases', jsonb_build_array('Plin')
    ),
    '{}'::text[],
    jsonb_build_object(
      'activation_policy', 'institutional_gate',
      'documented_sender_unverified', true,
      'sender_authentication', 'dkim_dmarc_required',
      'contains_user_content', false
    ),
    'shadow',
    'draft'
  ),
  (
    '04100000-0000-4000-8000-000000000005',
    'gmail',
    'scotiabank',
    'alertas@scotiabank.com.pe',
    'institution-agent-shadow-v1',
    100,
    true,
    jsonb_build_object(
      'schema_version', 'gmail_parser_v1',
      'subject_patterns', jsonb_build_array('Scotiabank'),
      'extraction_rules', jsonb_build_object(
        'amount', jsonb_build_object(
          'pattern', '(?:S/|PEN|USD|US\$)\s*([\d.,]+)',
          'type', 'number'
        ),
        'direction', 'out',
        'operation_hint', 'unknown'
      ),
      'allow_generic_fallback', true,
      'confidence', jsonb_build_object('template', 0.80, 'fallback', 0.40),
      'institution_aliases', jsonb_build_array('Scotiabank', 'Scotiabank Peru')
    ),
    '{}'::text[],
    jsonb_build_object(
      'activation_policy', 'institutional_gate',
      'documented_sender_unverified', true,
      'sender_authentication', 'dkim_dmarc_required',
      'contains_user_content', false
    ),
    'shadow',
    'draft'
  )
on conflict (provider, sender_pattern, template_version) do update set
  institution_key = excluded.institution_key,
  parser_config = excluded.parser_config,
  metadata = public.email_parse_templates.metadata || excluded.metadata,
  updated_at = now();

create or replace function public.sync_user_email_source_verification()
returns trigger
language plpgsql
security definer
set search_path = public, manzana
as $$
begin
  update public.user_email_sources as source
     set status = case
           when source.status in ('paused', 'disabled') then source.status
           when exists (
             select 1
               from public.email_parse_templates as template
              where template.provider = 'gmail'
                and template.institution_key = source.institution_key
                and template.sender_pattern = source.notification_sender
                and template.enabled = true
                and template.activation_mode = 'active'
                and template.verification_status = 'verified'
           ) then 'active'
           else 'shadow'
         end,
         verification_status = case
           when source.status = 'disabled' then source.verification_status
           when exists (
             select 1
               from public.email_parse_templates as template
              where template.provider = 'gmail'
                and template.institution_key = source.institution_key
                and template.sender_pattern = source.notification_sender
                and template.enabled = true
                and template.activation_mode = 'active'
                and template.verification_status = 'verified'
           ) then 'verified'
           else 'pending'
         end,
         verified_at = case
           when exists (
             select 1
               from public.email_parse_templates as template
              where template.provider = 'gmail'
                and template.institution_key = source.institution_key
                and template.sender_pattern = source.notification_sender
                and template.enabled = true
                and template.activation_mode = 'active'
                and template.verification_status = 'verified'
           ) then coalesce(source.verified_at, now())
           else null
         end,
         metadata = source.metadata || jsonb_build_object(
           'verification_recomputed_at', now()
         )
   where source.deleted_at is null;
  return null;
end;
$$;

drop trigger if exists email_templates_sync_user_sources
  on public.email_parse_templates;
create trigger email_templates_sync_user_sources
  after insert or update or delete on public.email_parse_templates
  for each statement execute function public.sync_user_email_source_verification();

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
      metadata
    ) values (
      p_user_id,
      p_institution_key,
      p_connection_id,
      v_sender,
      case when v_verified then 'active' else 'shadow' end,
      case when v_verified then 'verified' else 'pending' end,
      case when v_verified then now() else null end,
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

create or replace function public.delete_user_email_source(
  p_user_id uuid,
  p_source_id uuid,
  p_trace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_source public.user_email_sources%rowtype;
  v_archived integer := 0;
begin
  select * into v_source
    from public.user_email_sources
   where id = p_source_id
     and user_id = p_user_id
     and deleted_at is null
     and status <> 'disabled'
   for update;

  if not found then
    return jsonb_build_object(
      'changed', false,
      'archived_pending_count', 0,
      'reason', 'source_not_found'
    );
  end if;

  update public.user_email_sources
     set status = 'disabled',
         deleted_at = now(),
         metadata = metadata || jsonb_build_object(
           'disabled_at', now(),
           'disabled_by', 'user'
         )
   where id = v_source.id;

  update public.pending_items
     set status = 'archived',
         resolved_at = now(),
         resolved_by = 'email_source_removed',
         metadata = metadata || jsonb_build_object(
           'archived_on_email_source_remove', true
         )
   where user_id = p_user_id
     and source in ('email_pending', 'backfill_pending')
     and status in ('pending', 'sent_for_confirmation', 'user_edited')
     and metadata->>'email_source_id' = v_source.id::text;
  get diagnostics v_archived = row_count;

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
    'email_source_removed',
    'user_email_source',
    v_source.id,
    jsonb_build_object(
      'source_id', v_source.id,
      'institution_key', v_source.institution_key,
      'archived_pending_count', v_archived
    ),
    1,
    'pending',
    p_trace_id,
    jsonb_build_object('financial_write', false, 'email_cut', 32)
  );

  return jsonb_build_object(
    'changed', true,
    'source_id', v_source.id,
    'archived_pending_count', v_archived,
    'reason', 'removed'
  );
end;
$$;

create or replace function public.commit_gmail_connection(
  p_user_id uuid,
  p_email_address text,
  p_scopes text[],
  p_encrypted_refresh_token text,
  p_history_id text,
  p_watch_expiration timestamptz,
  p_trace_id uuid
)
returns public.email_connections
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_connection public.email_connections%rowtype;
  v_email text := lower(trim(p_email_address));
begin
  if p_user_id is null or p_trace_id is null then
    raise exception 'GMAIL_IDENTITY_REQUIRED';
  end if;
  if v_email = '' or length(v_email) > 320 then
    raise exception 'GMAIL_EMAIL_INVALID';
  end if;
  if nullif(trim(p_encrypted_refresh_token), '') is null then
    raise exception 'GMAIL_REFRESH_TOKEN_REQUIRED';
  end if;
  if p_history_id !~ '^[0-9]{1,40}$' then
    raise exception 'GMAIL_HISTORY_ID_INVALID';
  end if;
  if p_watch_expiration is null or p_watch_expiration <= now() then
    raise exception 'GMAIL_WATCH_EXPIRATION_INVALID';
  end if;

  insert into public.email_connections (
    user_id,
    provider,
    email_address,
    status,
    scopes,
    encrypted_refresh_token,
    watch_expiration,
    last_history_id,
    last_watch_renewed_at,
    watch_status,
    provider_account_id,
    deleted_at,
    metadata
  ) values (
    p_user_id,
    'gmail',
    v_email,
    'watch_active',
    coalesce(p_scopes, '{}'::text[]),
    p_encrypted_refresh_token,
    p_watch_expiration,
    p_history_id,
    now(),
    'active',
    v_email,
    null,
    jsonb_build_object('gmail_body_persisted', false)
  )
  on conflict (user_id, provider, email_address) do update set
    status = excluded.status,
    scopes = excluded.scopes,
    encrypted_refresh_token = excluded.encrypted_refresh_token,
    watch_expiration = excluded.watch_expiration,
    last_history_id = excluded.last_history_id,
    last_watch_renewed_at = excluded.last_watch_renewed_at,
    watch_status = excluded.watch_status,
    provider_account_id = excluded.provider_account_id,
    deleted_at = null,
    metadata = public.email_connections.metadata || excluded.metadata
  returning * into v_connection;

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
    'email_connected',
    'email_connection',
    v_connection.id,
    jsonb_build_object(
      'provider', 'gmail',
      'email_address_hash',
        encode(extensions.digest(v_email, 'sha256'), 'hex'),
      'watch_expiration', p_watch_expiration
    ),
    1,
    'pending',
    p_trace_id,
    jsonb_build_object('financial_write', false, 'email_cut', 32)
  );

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
    'gmail_backfill_requested',
    'email_connection',
    v_connection.id,
    jsonb_build_object(
      'connection_id', v_connection.id,
      'newer_than_days', 30,
      'max_messages', 500
    ),
    1,
    'pending',
    p_trace_id,
    jsonb_build_object(
      'financial_write', false,
      'email_cut', 32,
      'delivery_channel', 'dashboard_only'
    )
  );

  return v_connection;
end;
$$;

drop function if exists public.disconnect_gmail_connection(uuid, uuid);

create or replace function public.disconnect_gmail_connection(
  p_user_id uuid,
  p_trace_id uuid,
  p_connection_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_connection_ids uuid[];
  v_archived integer := 0;
begin
  select array_agg(id order by created_at)
    into v_connection_ids
    from public.email_connections
   where user_id = p_user_id
     and provider = 'gmail'
     and (p_connection_id is null or id = p_connection_id)
     and not (
       status = 'disconnected'
       and encrypted_refresh_token is null
     );

  if coalesce(array_length(v_connection_ids, 1), 0) = 0 then
    return jsonb_build_object(
      'changed', false,
      'connection_ids', '[]'::jsonb,
      'archived_pending_count', 0,
      'reason', 'not_connected'
    );
  end if;

  update public.email_connections
     set status = 'disconnected',
         encrypted_refresh_token = null,
         watch_expiration = null,
         watch_status = 'inactive',
         last_watch_renewed_at = null,
         metadata = metadata || jsonb_build_object('disconnected_at', now())
   where id = any(v_connection_ids);

  update public.user_email_sources
     set status = 'disabled',
         deleted_at = now(),
         metadata = metadata || jsonb_build_object(
           'disabled_on_connection_disconnect', true,
           'disabled_at', now()
         )
   where email_connection_id = any(v_connection_ids)
     and deleted_at is null
     and status <> 'disabled';

  update public.pending_items as pending
     set status = 'archived',
         resolved_at = now(),
         resolved_by = 'gmail_disconnect',
         metadata = pending.metadata || jsonb_build_object(
           'archived_on_email_disconnect', true
         )
   where pending.user_id = p_user_id
     and pending.source in ('email_pending', 'backfill_pending')
     and pending.status in ('pending', 'sent_for_confirmation', 'user_edited')
     and (
       pending.metadata->>'email_connection_id' in (
         select value::text from unnest(v_connection_ids) as value
       )
       or exists (
         select 1
           from public.email_messages as message
          where message.id::text = pending.metadata->>'email_message_id'
            and message.email_connection_id = any(v_connection_ids)
       )
     );
  get diagnostics v_archived = row_count;

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
  )
  select
    p_user_id,
    'email_disconnected',
    'email_connection',
    connection_id,
    jsonb_build_object(
      'provider', 'gmail',
      'connection_id', connection_id,
      'archived_pending_count', v_archived
    ),
    1,
    'pending',
    p_trace_id,
    jsonb_build_object('financial_write', false, 'email_cut', 32)
  from unnest(v_connection_ids) as connection_id;

  return jsonb_build_object(
    'changed', true,
    'connection_ids', to_jsonb(v_connection_ids),
    'archived_pending_count', v_archived,
    'reason', 'disconnected'
  );
end;
$$;

create or replace function public.commit_email_message_outcome(
  p_user_id uuid,
  p_connection_id uuid,
  p_provider_message_id text,
  p_provider_thread_id text,
  p_received_at timestamptz,
  p_sender text,
  p_subject_hash text,
  p_content_hash text,
  p_parsed_status text,
  p_pending jsonb,
  p_metadata jsonb,
  p_trace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_message_id uuid;
  v_pending_id uuid;
  v_source_ref text;
  v_pending_source public.pending_source;
  v_pending_type public.pending_type;
begin
  if p_user_id is null or p_connection_id is null or p_trace_id is null then
    raise exception 'GMAIL_MESSAGE_IDENTITY_REQUIRED';
  end if;
  if not exists (
    select 1 from public.email_connections
     where id = p_connection_id and user_id = p_user_id and provider = 'gmail'
  ) then
    raise exception 'GMAIL_CONNECTION_NOT_FOUND';
  end if;
  if p_parsed_status not in (
    'parsed',
    'pending_created',
    'deduplicated',
    'parse_failed'
  ) then
    raise exception 'GMAIL_PARSED_STATUS_INVALID';
  end if;
  if p_subject_hash is not null and p_subject_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'GMAIL_SUBJECT_HASH_INVALID';
  end if;
  if p_content_hash is not null and p_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'GMAIL_CONTENT_HASH_INVALID';
  end if;
  if jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object' then
    raise exception 'GMAIL_MESSAGE_METADATA_INVALID';
  end if;

  select id into v_message_id
    from public.email_messages
   where email_connection_id = p_connection_id
     and provider_message_id = p_provider_message_id;
  if found then
    return jsonb_build_object(
      'idempotent', true,
      'dedup_reason', 'provider_message_id',
      'email_message_id', v_message_id,
      'pending_item_id', null
    );
  end if;

  if p_content_hash is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(p_user_id::text || ':' || p_content_hash, 0)
    );
    select id into v_message_id
      from public.email_messages
     where user_id = p_user_id
       and content_hash = p_content_hash
       and abs(extract(epoch from (received_at - p_received_at))) <= 86400
     order by received_at desc
     limit 1;
    if found then
      return jsonb_build_object(
        'idempotent', true,
        'dedup_reason', 'content_hash_24h',
        'email_message_id', v_message_id,
        'pending_item_id', null
      );
    end if;
  end if;

  insert into public.email_messages (
    user_id,
    email_connection_id,
    provider_message_id,
    provider_thread_id,
    received_at,
    sender,
    subject_hash,
    content_hash,
    parsed_status,
    metadata
  ) values (
    p_user_id,
    p_connection_id,
    p_provider_message_id,
    p_provider_thread_id,
    p_received_at,
    lower(p_sender),
    p_subject_hash,
    p_content_hash,
    p_parsed_status,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (email_connection_id, provider_message_id) do nothing
  returning id into v_message_id;

  if v_message_id is null then
    select id into v_message_id
      from public.email_messages
     where email_connection_id = p_connection_id
       and provider_message_id = p_provider_message_id;
    return jsonb_build_object(
      'idempotent', true,
      'dedup_reason', 'provider_message_id',
      'email_message_id', v_message_id,
      'pending_item_id', null
    );
  end if;

  if p_pending is not null then
    if jsonb_typeof(p_pending) <> 'object' then
      raise exception 'GMAIL_PENDING_INVALID';
    end if;
    if p_sender is null
       or coalesce(p_metadata->>'email_source_id', '') !~
         '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then
      raise exception 'EMAIL_PENDING_ACTIVE_SOURCE_REQUIRED';
    end if;
    if not exists (
      select 1
        from public.user_email_sources as source
       where source.id = (p_metadata->>'email_source_id')::uuid
         and source.user_id = p_user_id
         and source.email_connection_id = p_connection_id
         and source.institution_key = p_metadata->>'institution_key'
         and source.notification_sender = lower(p_sender)
         and source.status = 'active'
         and source.verification_status = 'verified'
         and source.verified_at is not null
         and source.deleted_at is null
    ) then
      raise exception 'EMAIL_PENDING_ACTIVE_SOURCE_REQUIRED';
    end if;
    if coalesce(p_pending->'metadata'->>'template_id', '') !~
         '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or not exists (
         select 1
           from public.email_parse_templates as template
          where template.id =
            (p_pending->'metadata'->>'template_id')::uuid
            and template.provider = 'gmail'
            and template.institution_key = p_metadata->>'institution_key'
            and template.sender_pattern = lower(p_sender)
            and template.enabled = true
            and template.activation_mode = 'active'
            and template.verification_status = 'verified'
            and template.verified_at is not null
       )
    then
      raise exception 'EMAIL_PENDING_EXACT_TEMPLATE_REQUIRED';
    end if;
    v_source_ref :=
      'gmail:' || p_connection_id::text || ':' || p_provider_message_id;
    if p_metadata->>'entry_surface' = 'gmail_backfill_30d' then
      v_pending_source := 'backfill_pending';
      v_pending_type := 'backfill_item';
    else
      v_pending_source := 'email_pending';
      v_pending_type := 'email_detected';
    end if;

    insert into public.pending_items (
      user_id,
      type,
      status,
      source,
      source_ref,
      proposed_action,
      normalized_summary,
      dedup_status,
      risk_level,
      expires_at,
      metadata
    ) values (
      p_user_id,
      v_pending_type,
      'pending',
      v_pending_source,
      v_source_ref,
      coalesce(p_pending->'proposed_action', '{}'::jsonb),
      coalesce(p_pending->'normalized_summary', '{}'::jsonb),
      nullif(p_pending->>'dedup_status', ''),
      coalesce(
        nullif(p_pending->>'risk_level', ''),
        'low'
      )::public.risk_level,
      case
        when nullif(p_pending->>'expires_at', '') is null
          then now() + interval '14 days'
        else (p_pending->>'expires_at')::timestamptz
      end,
      coalesce(p_pending->'metadata', '{}'::jsonb)
        || jsonb_build_object(
          'email_message_id', v_message_id,
          'email_connection_id', p_connection_id,
          'email_source_id', p_metadata->>'email_source_id',
          'institution_key', p_metadata->>'institution_key',
          'content_persisted', false,
          'delivery_channel',
            case
              when v_pending_source = 'backfill_pending'
                then 'dashboard_only'
              else 'policy_controlled'
            end
        )
    )
    on conflict (user_id, source, source_ref)
      where source_ref is not null do nothing
    returning id into v_pending_id;

    if v_pending_id is not null then
      update public.email_messages
         set parsed_status = 'pending_created'
       where id = v_message_id;

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
        'pending_created',
        'pending_item',
        v_pending_id,
        jsonb_build_object(
          'pending_item_id', v_pending_id,
          'source', v_pending_source,
          'created_from', 'gmail',
          'email_connection_id', p_connection_id,
          'email_source_id', p_metadata->>'email_source_id'
        ),
        1,
        'pending',
        p_trace_id,
        jsonb_build_object(
          'financial_write', false,
          'email_message_id', v_message_id,
          'delivery_channel',
            case
              when v_pending_source = 'backfill_pending'
                then 'dashboard_only'
              else 'policy_controlled'
            end
        )
      );
    end if;
  end if;

  return jsonb_build_object(
    'idempotent', false,
    'dedup_reason', null,
    'email_message_id', v_message_id,
    'pending_item_id', v_pending_id
  );
end;
$$;

-- Reconoce configuraciones observadas antes del corte sin activarlas si el
-- template exacto aun no supero el Gate institucional.
insert into public.user_email_sources (
  user_id,
  institution_key,
  email_connection_id,
  notification_sender,
  status,
  verification_status,
  verified_at,
  metadata
)
select distinct on (message.user_id, message.metadata->>'institution_key')
  message.user_id,
  message.metadata->>'institution_key',
  message.email_connection_id,
  lower(message.sender),
  case
    when exists (
      select 1
        from public.email_parse_templates as template
       where template.provider = 'gmail'
         and template.institution_key =
           message.metadata->>'institution_key'
         and template.sender_pattern = lower(message.sender)
         and template.enabled = true
         and template.activation_mode = 'active'
         and template.verification_status = 'verified'
    ) then 'active'
    else 'shadow'
  end,
  case
    when exists (
      select 1
        from public.email_parse_templates as template
       where template.provider = 'gmail'
         and template.institution_key =
           message.metadata->>'institution_key'
         and template.sender_pattern = lower(message.sender)
         and template.enabled = true
         and template.activation_mode = 'active'
         and template.verification_status = 'verified'
    ) then 'verified'
    else 'pending'
  end,
  case
    when exists (
      select 1
        from public.email_parse_templates as template
       where template.provider = 'gmail'
         and template.institution_key =
           message.metadata->>'institution_key'
         and template.sender_pattern = lower(message.sender)
         and template.enabled = true
         and template.activation_mode = 'active'
         and template.verification_status = 'verified'
    ) then now()
    else null
  end,
  jsonb_build_object(
    'configured_by', 'migration_041_observed_history',
    'configured_at', now(),
    'sender_hash',
      encode(extensions.digest(lower(message.sender), 'sha256'), 'hex')
  )
from public.email_messages as message
join public.email_institutions as institution
  on institution.institution_key = message.metadata->>'institution_key'
where message.sender is not null
  and message.sender <> ''
  and institution.enabled = true
order by
  message.user_id,
  message.metadata->>'institution_key',
  message.received_at desc
on conflict do nothing;

revoke all on function public.sync_user_email_source_verification()
  from public, anon, authenticated;
revoke all on function public.upsert_user_email_source(
  uuid, text, uuid, text, uuid
) from public, anon, authenticated;
revoke all on function public.delete_user_email_source(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.commit_gmail_connection(
  uuid, text, text[], text, text, timestamptz, uuid
) from public, anon, authenticated;
revoke all on function public.disconnect_gmail_connection(
  uuid, uuid, uuid
) from public, anon, authenticated;
revoke all on function public.commit_email_message_outcome(
  uuid, uuid, text, text, timestamptz, text, text, text, text, jsonb, jsonb, uuid
) from public, anon, authenticated;

grant execute on function public.upsert_user_email_source(
  uuid, text, uuid, text, uuid
) to service_role;
grant execute on function public.delete_user_email_source(uuid, uuid, uuid)
  to service_role;
grant execute on function public.commit_gmail_connection(
  uuid, text, text[], text, text, timestamptz, uuid
) to service_role;
grant execute on function public.disconnect_gmail_connection(
  uuid, uuid, uuid
) to service_role;
grant execute on function public.commit_email_message_outcome(
  uuid, uuid, text, text, timestamptz, text, text, text, text, jsonb, jsonb, uuid
) to service_role;
