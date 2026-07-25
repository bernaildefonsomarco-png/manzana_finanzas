-- =============================================================
-- Migration 032: Gmail V1 secure foundation
-- Corte 28 - OAuth connection, Pub/Sub ingestion and email pending
-- =============================================================

create table if not exists public.email_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'gmail',
  email_address text not null,
  status text not null default 'connected',
  scopes text[] not null default '{}'::text[],
  encrypted_refresh_token text,
  watch_expiration timestamptz,
  last_history_id text,
  last_watch_renewed_at timestamptz,
  watch_status text not null default 'inactive',
  provider_account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,

  constraint email_connections_provider_known
    check (provider = 'gmail'),
  constraint email_connections_email_length
    check (length(email_address) between 3 and 320 and email_address = lower(email_address)),
  constraint email_connections_status_known
    check (status in ('connected', 'watch_active', 'watch_expired', 'syncing', 'needs_reconnect', 'revoked', 'disconnected', 'error')),
  constraint email_connections_watch_status_known
    check (watch_status in ('inactive', 'active', 'expired', 'error')),
  constraint email_connections_history_id_valid
    check (last_history_id is null or last_history_id ~ '^[0-9]{1,40}$'),
  constraint email_connections_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint email_connections_token_state
    check (
      (status = 'disconnected' and encrypted_refresh_token is null)
      or status <> 'disconnected'
    ),
  constraint email_connections_one_provider_per_user
    unique (user_id, provider)
);

create unique index if not exists email_connections_provider_account_idx
  on public.email_connections (provider, provider_account_id)
  where provider_account_id is not null and deleted_at is null and status <> 'disconnected';

create index if not exists email_connections_watch_due_idx
  on public.email_connections (status, watch_expiration)
  where status in ('connected', 'watch_active', 'watch_expired');

create trigger email_connections_updated_at
  before update on public.email_connections
  for each row execute function manzana.set_updated_at();

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_connection_id uuid not null references public.email_connections(id) on delete cascade,
  provider_message_id text not null,
  provider_thread_id text,
  received_at timestamptz not null,
  sender text,
  subject_hash text,
  content_hash text,
  parsed_status text not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,

  constraint email_messages_provider_message_length
    check (length(provider_message_id) between 1 and 240),
  constraint email_messages_parsed_status_known
    check (parsed_status in ('parsed', 'pending_created', 'deduplicated', 'parse_failed')),
  constraint email_messages_hash_length
    check (subject_hash is null or length(subject_hash) = 64),
  constraint email_messages_content_hash_length
    check (content_hash is null or length(content_hash) = 64),
  constraint email_messages_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint email_messages_unique_provider_message
    unique (email_connection_id, provider_message_id)
);

create index if not exists email_messages_user_received_idx
  on public.email_messages (user_id, received_at desc);

create index if not exists email_messages_connection_status_idx
  on public.email_messages (email_connection_id, parsed_status, received_at desc);

create table if not exists public.email_parse_templates (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'gmail',
  institution_key text not null,
  sender_pattern text not null,
  template_version text not null,
  priority int not null default 100,
  enabled boolean not null default false,
  parser_config jsonb not null default '{}'::jsonb,
  sample_hashes text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,

  constraint email_parse_templates_provider_known
    check (provider = 'gmail'),
  constraint email_parse_templates_institution_length
    check (length(institution_key) between 2 and 80),
  constraint email_parse_templates_sender_length
    check (length(sender_pattern) between 3 and 320 and sender_pattern = lower(sender_pattern)),
  constraint email_parse_templates_version_length
    check (length(template_version) between 1 and 40),
  constraint email_parse_templates_priority_valid
    check (priority between 1 and 1000),
  constraint email_parse_templates_config_object
    check (jsonb_typeof(parser_config) = 'object'),
  constraint email_parse_templates_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint email_parse_templates_unique_version
    unique (provider, sender_pattern, template_version)
);

create index if not exists email_parse_templates_enabled_sender_idx
  on public.email_parse_templates (provider, sender_pattern, priority)
  where enabled = true;

create trigger email_parse_templates_updated_at
  before update on public.email_parse_templates
  for each row execute function manzana.set_updated_at();

comment on table public.email_connections is
  'Conexion Gmail V1. El refresh token solo se persiste cifrado y se elimina al desconectar.';
comment on table public.email_messages is
  'Metadata minima y hashes de emails financieros allowlisted. Nunca contiene cuerpo completo.';
comment on table public.email_parse_templates is
  'Allowlist y configuracion versionada de parsers Gmail. Templates nuevos nacen deshabilitados hasta verificar muestras.';

alter table public.email_connections enable row level security;
alter table public.email_messages enable row level security;
alter table public.email_parse_templates enable row level security;

revoke all on public.email_connections from public, anon, authenticated;
revoke all on public.email_messages from public, anon, authenticated;
revoke all on public.email_parse_templates from public, anon, authenticated;

grant select, insert, update, delete on public.email_connections to service_role;
grant select, insert, update, delete on public.email_messages to service_role;
grant select, insert, update, delete on public.email_parse_templates to service_role;

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
  on conflict (user_id, provider) do update set
    email_address = excluded.email_address,
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
    user_id, event_type, aggregate_type, aggregate_id, payload,
    payload_version, status, trace_id, metadata
  ) values (
    p_user_id,
    'email_connected',
    'email_connection',
    v_connection.id,
    jsonb_build_object(
      'provider', 'gmail',
      'email_address_hash', encode(digest(v_email, 'sha256'), 'hex'),
      'watch_expiration', p_watch_expiration
    ),
    1,
    'pending',
    p_trace_id,
    jsonb_build_object('financial_write', false, 'email_cut', 28)
  );

  insert into public.transactional_outbox (
    user_id, event_type, aggregate_type, aggregate_id, payload,
    payload_version, status, trace_id, metadata
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
      'email_cut', 28,
      'delivery_channel', 'dashboard_only'
    )
  );

  return v_connection;
end;
$$;

create or replace function public.enqueue_gmail_history_notification(
  p_email_address text,
  p_pubsub_message_id text,
  p_history_id text,
  p_publish_time timestamptz,
  p_subscription text,
  p_payload_hash text,
  p_trace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_connection public.email_connections%rowtype;
  v_external_event_id uuid;
  v_idempotency_key text;
begin
  if p_trace_id is null then raise exception 'GMAIL_TRACE_REQUIRED'; end if;
  if p_history_id !~ '^[0-9]{1,40}$' then raise exception 'GMAIL_HISTORY_ID_INVALID'; end if;
  if nullif(trim(p_pubsub_message_id), '') is null or length(p_pubsub_message_id) > 160 then
    raise exception 'GMAIL_PUBSUB_MESSAGE_ID_INVALID';
  end if;
  if p_payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'GMAIL_PAYLOAD_HASH_INVALID'; end if;

  select * into v_connection
    from public.email_connections
   where provider = 'gmail'
     and email_address = lower(trim(p_email_address))
     and status in ('connected', 'watch_active', 'watch_expired', 'syncing')
     and deleted_at is null
   for update;

  if not found then
    return jsonb_build_object('accepted', false, 'duplicate', false, 'reason', 'connection_not_found');
  end if;

  v_idempotency_key := 'gmail:' || trim(p_pubsub_message_id) || ':' || p_history_id;

  insert into public.external_event_log (
    source, event_type, idempotency_key, user_id, received_at, status,
    payload_hash, payload_ref, trace_id, metadata
  ) values (
    'gmail',
    'gmail_history_notification',
    v_idempotency_key,
    v_connection.user_id,
    now(),
    'accepted',
    p_payload_hash,
    null,
    p_trace_id,
    jsonb_build_object(
      'pubsub_message_id', trim(p_pubsub_message_id),
      'history_id', p_history_id,
      'publish_time', p_publish_time,
      'subscription', left(coalesce(p_subscription, ''), 500),
      'content_persisted', false
    )
  )
  on conflict (source, idempotency_key) do nothing
  returning id into v_external_event_id;

  if v_external_event_id is null then
    return jsonb_build_object(
      'accepted', true,
      'duplicate', true,
      'connection_id', v_connection.id,
      'reason', 'already_enqueued'
    );
  end if;

  insert into public.transactional_outbox (
    user_id, event_type, aggregate_type, aggregate_id, payload,
    payload_version, status, trace_id, metadata
  ) values (
    v_connection.user_id,
    'gmail_history_notification',
    'email_connection',
    v_connection.id,
    jsonb_build_object(
      'connection_id', v_connection.id,
      'external_event_id', v_external_event_id,
      'history_id', p_history_id,
      'pubsub_message_id', trim(p_pubsub_message_id)
    ),
    1,
    'pending',
    p_trace_id,
    jsonb_build_object('financial_write', false, 'email_cut', 28)
  );

  return jsonb_build_object(
    'accepted', true,
    'duplicate', false,
    'connection_id', v_connection.id,
    'external_event_id', v_external_event_id,
    'reason', 'enqueued'
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
begin
  if p_user_id is null or p_connection_id is null or p_trace_id is null then
    raise exception 'GMAIL_MESSAGE_IDENTITY_REQUIRED';
  end if;
  if not exists (
    select 1 from public.email_connections
     where id = p_connection_id and user_id = p_user_id and provider = 'gmail'
  ) then raise exception 'GMAIL_CONNECTION_NOT_FOUND'; end if;
  if p_parsed_status not in ('parsed', 'pending_created', 'deduplicated', 'parse_failed') then
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

  insert into public.email_messages (
    user_id, email_connection_id, provider_message_id, provider_thread_id,
    received_at, sender, subject_hash, content_hash, parsed_status, metadata
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
    select id into v_message_id from public.email_messages
     where email_connection_id = p_connection_id
       and provider_message_id = p_provider_message_id;
    return jsonb_build_object(
      'idempotent', true,
      'email_message_id', v_message_id,
      'pending_item_id', null
    );
  end if;

  if p_pending is not null then
    if jsonb_typeof(p_pending) <> 'object' then raise exception 'GMAIL_PENDING_INVALID'; end if;
    v_source_ref := 'gmail:' || p_provider_message_id;

    insert into public.pending_items (
      user_id, type, status, source, source_ref, proposed_action,
      normalized_summary, dedup_status, risk_level, expires_at, metadata
    ) values (
      p_user_id,
      'email_detected',
      'pending',
      'email_pending',
      v_source_ref,
      coalesce(p_pending->'proposed_action', '{}'::jsonb),
      coalesce(p_pending->'normalized_summary', '{}'::jsonb),
      nullif(p_pending->>'dedup_status', ''),
      coalesce(nullif(p_pending->>'risk_level', ''), 'low')::public.risk_level,
      case when nullif(p_pending->>'expires_at', '') is null
        then now() + interval '14 days'
        else (p_pending->>'expires_at')::timestamptz
      end,
      coalesce(p_pending->'metadata', '{}'::jsonb)
        || jsonb_build_object('email_message_id', v_message_id, 'content_persisted', false)
    )
    on conflict (user_id, source, source_ref) where source_ref is not null do nothing
    returning id into v_pending_id;

    if v_pending_id is not null then
      update public.email_messages
         set parsed_status = 'pending_created'
       where id = v_message_id;

      insert into public.transactional_outbox (
        user_id, event_type, aggregate_type, aggregate_id, payload,
        payload_version, status, trace_id, metadata
      ) values (
        p_user_id,
        'pending_created',
        'pending_item',
        v_pending_id,
        jsonb_build_object(
          'pending_item_id', v_pending_id,
          'source', 'email_pending',
          'created_from', 'gmail'
        ),
        1,
        'pending',
        p_trace_id,
        jsonb_build_object('financial_write', false, 'email_message_id', v_message_id)
      );
    end if;
  end if;

  return jsonb_build_object(
    'idempotent', false,
    'email_message_id', v_message_id,
    'pending_item_id', v_pending_id
  );
end;
$$;

create or replace function public.disconnect_gmail_connection(
  p_user_id uuid,
  p_trace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_connection public.email_connections%rowtype;
  v_archived integer := 0;
begin
  select * into v_connection
    from public.email_connections
   where user_id = p_user_id and provider = 'gmail'
   for update;

  if not found then
    return jsonb_build_object('changed', false, 'archived_pending_count', 0, 'reason', 'not_connected');
  end if;

  if v_connection.status = 'disconnected' and v_connection.encrypted_refresh_token is null then
    return jsonb_build_object('changed', false, 'archived_pending_count', 0, 'reason', 'already_disconnected');
  end if;

  update public.email_connections set
    status = 'disconnected',
    encrypted_refresh_token = null,
    watch_expiration = null,
    watch_status = 'inactive',
    last_watch_renewed_at = null,
    metadata = metadata || jsonb_build_object('disconnected_at', now())
  where id = v_connection.id;

  update public.pending_items set
    status = 'archived',
    resolved_at = now(),
    resolved_by = 'gmail_disconnect',
    metadata = metadata || jsonb_build_object('archived_on_email_disconnect', true)
  where user_id = p_user_id
    and source in ('email_pending', 'backfill_pending')
    and status in ('pending', 'sent_for_confirmation', 'user_edited');
  get diagnostics v_archived = row_count;

  insert into public.transactional_outbox (
    user_id, event_type, aggregate_type, aggregate_id, payload,
    payload_version, status, trace_id, metadata
  ) values (
    p_user_id,
    'email_disconnected',
    'email_connection',
    v_connection.id,
    jsonb_build_object('provider', 'gmail', 'archived_pending_count', v_archived),
    1,
    'pending',
    p_trace_id,
    jsonb_build_object('financial_write', false, 'email_cut', 28)
  );

  return jsonb_build_object(
    'changed', true,
    'connection_id', v_connection.id,
    'archived_pending_count', v_archived,
    'reason', 'disconnected'
  );
end;
$$;

revoke all on function public.commit_gmail_connection(uuid, text, text[], text, text, timestamptz, uuid)
  from public, anon, authenticated;
revoke all on function public.enqueue_gmail_history_notification(text, text, text, timestamptz, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.commit_email_message_outcome(uuid, uuid, text, text, timestamptz, text, text, text, text, jsonb, jsonb, uuid)
  from public, anon, authenticated;
revoke all on function public.disconnect_gmail_connection(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.commit_gmail_connection(uuid, text, text[], text, text, timestamptz, uuid)
  to service_role;
grant execute on function public.enqueue_gmail_history_notification(text, text, text, timestamptz, text, text, uuid)
  to service_role;
grant execute on function public.commit_email_message_outcome(uuid, uuid, text, text, timestamptz, text, text, text, text, jsonb, jsonb, uuid)
  to service_role;
grant execute on function public.disconnect_gmail_connection(uuid, uuid)
  to service_role;
