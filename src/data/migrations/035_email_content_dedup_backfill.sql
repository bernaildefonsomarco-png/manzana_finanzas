-- Corte 31: dedup intra-email atomico y separacion estricta del backfill.

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
    user_id, email_connection_id, provider_message_id, provider_thread_id,
    received_at, sender, subject_hash, content_hash, parsed_status, metadata
  ) values (
    p_user_id, p_connection_id, p_provider_message_id, p_provider_thread_id,
    p_received_at, lower(p_sender), p_subject_hash, p_content_hash,
    p_parsed_status, coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (email_connection_id, provider_message_id) do nothing
  returning id into v_message_id;

  if v_message_id is null then
    select id into v_message_id from public.email_messages
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
    v_source_ref := 'gmail:' || p_provider_message_id;
    if p_metadata->>'entry_surface' = 'gmail_backfill_30d' then
      v_pending_source := 'backfill_pending';
      v_pending_type := 'backfill_item';
    else
      v_pending_source := 'email_pending';
      v_pending_type := 'email_detected';
    end if;

    insert into public.pending_items (
      user_id, type, status, source, source_ref, proposed_action,
      normalized_summary, dedup_status, risk_level, expires_at, metadata
    ) values (
      p_user_id,
      v_pending_type,
      'pending',
      v_pending_source,
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
        || jsonb_build_object(
          'email_message_id', v_message_id,
          'content_persisted', false,
          'delivery_channel',
            case when v_pending_source = 'backfill_pending'
              then 'dashboard_only' else 'policy_controlled' end
        )
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
          'source', v_pending_source,
          'created_from', 'gmail'
        ),
        1,
        'pending',
        p_trace_id,
        jsonb_build_object(
          'financial_write', false,
          'email_message_id', v_message_id,
          'delivery_channel',
            case when v_pending_source = 'backfill_pending'
              then 'dashboard_only' else 'policy_controlled' end
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

revoke all on function public.commit_email_message_outcome(
  uuid, uuid, text, text, timestamptz, text, text, text, text, jsonb, jsonb, uuid
) from public, anon, authenticated;
grant execute on function public.commit_email_message_outcome(
  uuid, uuid, text, text, timestamptz, text, text, text, text, jsonb, jsonb, uuid
) to service_role;
