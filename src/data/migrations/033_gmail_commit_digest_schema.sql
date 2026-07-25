-- Corte 28 hotfix: pgcrypto vive en extensions en Supabase administrado.
-- Mantiene search_path restringido y califica digest explicitamente.

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
    user_id, provider, email_address, status, scopes,
    encrypted_refresh_token, watch_expiration, last_history_id,
    last_watch_renewed_at, watch_status, provider_account_id,
    deleted_at, metadata
  ) values (
    p_user_id, 'gmail', v_email, 'watch_active',
    coalesce(p_scopes, '{}'::text[]), p_encrypted_refresh_token,
    p_watch_expiration, p_history_id, now(), 'active', v_email,
    null, jsonb_build_object('gmail_body_persisted', false)
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
    p_user_id, 'email_connected', 'email_connection', v_connection.id,
    jsonb_build_object(
      'provider', 'gmail',
      'email_address_hash', encode(extensions.digest(v_email, 'sha256'), 'hex'),
      'watch_expiration', p_watch_expiration
    ),
    1, 'pending', p_trace_id,
    jsonb_build_object('financial_write', false, 'email_cut', 28)
  );

  insert into public.transactional_outbox (
    user_id, event_type, aggregate_type, aggregate_id, payload,
    payload_version, status, trace_id, metadata
  ) values (
    p_user_id, 'gmail_backfill_requested', 'email_connection', v_connection.id,
    jsonb_build_object(
      'connection_id', v_connection.id,
      'newer_than_days', 30,
      'max_messages', 500
    ),
    1, 'pending', p_trace_id,
    jsonb_build_object(
      'financial_write', false,
      'email_cut', 28,
      'delivery_channel', 'dashboard_only'
    )
  );

  return v_connection;
end;
$$;

revoke all on function public.commit_gmail_connection(uuid, text, text[], text, text, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.commit_gmail_connection(uuid, text, text[], text, text, timestamptz, uuid)
  to service_role;
