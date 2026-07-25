-- Corte 31: calidad operativa y activacion segura de captura financiera externa.
-- Los templates pueden observar en shadow, pero solo escriben Pendientes al estar
-- verificados con al menos cinco muestras consentidas.

alter table public.email_parse_templates
  add column if not exists activation_mode text not null default 'disabled',
  add column if not exists verification_status text not null default 'draft',
  add column if not exists verified_at timestamptz,
  add column if not exists last_matched_at timestamptz,
  add column if not exists last_shadow_at timestamptz,
  add column if not exists last_failure_at timestamptz,
  add column if not exists match_count bigint not null default 0,
  add column if not exists shadow_match_count bigint not null default 0,
  add column if not exists fallback_count bigint not null default 0,
  add column if not exists parse_failure_count bigint not null default 0;

-- Una instalacion previa nunca se eleva automaticamente a escritura activa.
-- Si tenia enabled=true, queda en shadow hasta completar la nueva verificacion.
update public.email_parse_templates
   set activation_mode = case when enabled then 'shadow' else 'disabled' end
 where activation_mode = 'disabled';

alter table public.email_parse_templates
  drop constraint if exists email_parse_templates_activation_mode_known,
  add constraint email_parse_templates_activation_mode_known
    check (activation_mode in ('disabled', 'shadow', 'active')),
  drop constraint if exists email_parse_templates_verification_status_known,
  add constraint email_parse_templates_verification_status_known
    check (verification_status in ('draft', 'verified', 'rejected')),
  drop constraint if exists email_parse_templates_activation_matches_enabled,
  add constraint email_parse_templates_activation_matches_enabled
    check (enabled = (activation_mode in ('shadow', 'active'))),
  drop constraint if exists email_parse_templates_active_verified,
  add constraint email_parse_templates_active_verified
    check (
      activation_mode <> 'active'
      or (
        verification_status = 'verified'
        and verified_at is not null
        and cardinality(sample_hashes) >= 5
      )
    ),
  drop constraint if exists email_parse_templates_sample_hashes_valid,
  add constraint email_parse_templates_sample_hashes_valid
    check (
      cardinality(sample_hashes) <= 50
      and array_to_string(sample_hashes, '') ~ '^[0-9a-f]*$'
      and length(array_to_string(sample_hashes, '')) = 64 * cardinality(sample_hashes)
    ),
  drop constraint if exists email_parse_templates_metrics_non_negative,
  add constraint email_parse_templates_metrics_non_negative
    check (
      match_count >= 0
      and shadow_match_count >= 0
      and fallback_count >= 0
      and parse_failure_count >= 0
    ),
  drop constraint if exists email_parse_templates_enabled_schema_version,
  add constraint email_parse_templates_enabled_schema_version
    check (
      activation_mode = 'disabled'
      or parser_config->>'schema_version' = 'gmail_parser_v1'
    );

drop index if exists public.email_parse_templates_enabled_sender_idx;
create index email_parse_templates_enabled_sender_idx
  on public.email_parse_templates (provider, sender_pattern, activation_mode, priority)
  where enabled = true;

comment on column public.email_parse_templates.activation_mode is
  'disabled=no procesa, shadow=mide sin crear Pendiente, active=puede crear Pendiente.';
comment on column public.email_parse_templates.verification_status is
  'Solo verified con >=5 sample_hashes consentidos puede pasar a active.';

create or replace function manzana.guard_email_pending_template_activation()
returns trigger
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_template_id uuid;
begin
  if new.source not in ('email_pending', 'backfill_pending') then
    return new;
  end if;

  if coalesce(new.metadata->>'template_id', '') !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    raise exception 'EMAIL_PENDING_TEMPLATE_REQUIRED';
  end if;
  v_template_id := (new.metadata->>'template_id')::uuid;

  if not exists (
    select 1
      from public.email_parse_templates
     where id = v_template_id
       and enabled = true
       and activation_mode = 'active'
       and verification_status = 'verified'
       and verified_at is not null
       and cardinality(sample_hashes) >= 5
  ) then
    raise exception 'EMAIL_PENDING_TEMPLATE_NOT_ACTIVE';
  end if;

  return new;
end;
$$;

drop trigger if exists pending_items_email_template_activation
  on public.pending_items;
create trigger pending_items_email_template_activation
  before insert on public.pending_items
  for each row execute function manzana.guard_email_pending_template_activation();

create or replace function manzana.update_email_template_health()
returns trigger
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_template_id uuid;
  v_shadow_template_id uuid;
  v_parse_mode text := coalesce(new.metadata->>'parse_mode', '');
begin
  if coalesce(new.metadata->>'template_id', '') !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    return new;
  end if;

  v_template_id := (new.metadata->>'template_id')::uuid;

  update public.email_parse_templates
     set match_count = match_count
           + case
               when v_parse_mode <> 'shadow'
                and new.parsed_status in ('parsed', 'pending_created', 'deduplicated')
               then 1 else 0
             end,
         shadow_match_count = shadow_match_count
           + case when v_parse_mode = 'shadow' then 1 else 0 end,
         fallback_count = fallback_count
           + case when v_parse_mode = 'generic_fallback' then 1 else 0 end,
         parse_failure_count = parse_failure_count
           + case
               when v_parse_mode <> 'shadow'
                and new.parsed_status = 'parse_failed'
               then 1 else 0
             end,
         last_matched_at = case
           when v_parse_mode <> 'shadow'
            and new.parsed_status in ('parsed', 'pending_created', 'deduplicated')
           then now() else last_matched_at
         end,
         last_shadow_at = case
           when v_parse_mode = 'shadow' then now() else last_shadow_at
         end,
         last_failure_at = case
           when v_parse_mode <> 'shadow' and new.parsed_status = 'parse_failed'
           then now() else last_failure_at
         end
   where id = v_template_id;

  if coalesce(new.metadata->>'shadow_template_id', '') ~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    v_shadow_template_id := (new.metadata->>'shadow_template_id')::uuid;
    if v_shadow_template_id <> v_template_id then
      update public.email_parse_templates
         set shadow_match_count = shadow_match_count + 1,
             last_shadow_at = now()
       where id = v_shadow_template_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists email_messages_template_health on public.email_messages;
create trigger email_messages_template_health
  after insert on public.email_messages
  for each row execute function manzana.update_email_template_health();

create or replace function manzana.resolve_pending_specialized_commit(
  p_pending_id uuid,
  p_user_id uuid,
  p_movement_id uuid,
  p_actor_id uuid,
  p_trace_id uuid,
  p_resolution_kind text
)
returns public.pending_items
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_pending public.pending_items;
begin
  select * into v_pending
    from public.pending_items
   where id = p_pending_id and user_id = p_user_id
   for update;

  if not found then raise exception 'PENDING_ITEM_NOT_FOUND'; end if;
  if v_pending.status = 'user_confirmed' then
    if nullif(v_pending.metadata->>'confirmed_movement_id', '')::uuid =
      p_movement_id
    then return v_pending; end if;
    raise exception 'PENDING_ITEM_CONFIRMATION_CONFLICT';
  end if;
  if v_pending.status not in ('pending', 'sent_for_confirmation', 'user_edited') then
    raise exception 'PENDING_ITEM_ALREADY_RESOLVED';
  end if;

  update public.pending_items
     set status = 'user_confirmed',
         resolved_at = now(),
         resolved_by = coalesce(p_actor_id::text, 'system'),
         metadata = metadata || jsonb_build_object(
           'confirmed_movement_id', p_movement_id,
           'specialized_resolution', p_resolution_kind,
           'specialized_confirmed_at', now()
         )
   where id = v_pending.id
   returning * into v_pending;

  insert into public.transactional_outbox (
    user_id, event_type, aggregate_type, aggregate_id, payload,
    payload_version, status, trace_id, metadata
  ) values (
    p_user_id,
    'pending_confirmed',
    'pending_item',
    v_pending.id,
    jsonb_build_object(
      'pending_item_id', v_pending.id,
      'movement_id', p_movement_id,
      'source', v_pending.source,
      'resolution_kind', p_resolution_kind
    ),
    1,
    'pending',
    p_trace_id,
    jsonb_build_object(
      'financial_write', true,
      'specialized_resolution', p_resolution_kind
    )
  );

  return v_pending;
end;
$$;

create or replace function public.commit_pending_debt_payment(
  p_pending_id uuid,
  p_actor_id uuid,
  p_trace_id uuid,
  p_debt_id uuid,
  p_payment jsonb,
  p_movement jsonb,
  p_audit_logs jsonb,
  p_account_deltas jsonb,
  p_box_deltas jsonb,
  p_movement_outbox_events jsonb,
  p_debt_outbox_events jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_result jsonb;
  v_pending public.pending_items;
  v_user_id uuid := (p_movement->>'user_id')::uuid;
  v_movement_id uuid;
begin
  v_result := manzana.commit_debt_payment(
    p_debt_id, p_payment, p_movement, p_audit_logs, p_account_deltas,
    p_box_deltas, p_movement_outbox_events, p_debt_outbox_events
  );
  v_movement_id := (v_result->'movement'->>'id')::uuid;
  v_pending := manzana.resolve_pending_specialized_commit(
    p_pending_id, v_user_id, v_movement_id, p_actor_id, p_trace_id,
    'debt_payment'
  );
  return v_result || jsonb_build_object('pending_item', to_jsonb(v_pending));
end;
$$;

create or replace function public.commit_pending_recurring_payment(
  p_pending_id uuid,
  p_actor_id uuid,
  p_trace_id uuid,
  p_recurring_rule_id uuid,
  p_occurrence_id uuid,
  p_movement jsonb,
  p_audit_logs jsonb,
  p_account_deltas jsonb,
  p_box_deltas jsonb,
  p_movement_outbox_events jsonb,
  p_recurring_outbox_events jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_result jsonb;
  v_pending public.pending_items;
  v_user_id uuid := (p_movement->>'user_id')::uuid;
  v_movement_id uuid;
begin
  v_result := manzana.commit_recurring_payment(
    p_recurring_rule_id, p_occurrence_id, p_movement, p_audit_logs,
    p_account_deltas, p_box_deltas, p_movement_outbox_events,
    p_recurring_outbox_events
  );
  v_movement_id := (v_result->'movement'->>'id')::uuid;
  v_pending := manzana.resolve_pending_specialized_commit(
    p_pending_id, v_user_id, v_movement_id, p_actor_id, p_trace_id,
    'recurring_payment'
  );
  return v_result || jsonb_build_object('pending_item', to_jsonb(v_pending));
end;
$$;

revoke all on function public.commit_pending_debt_payment(
  uuid, uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function public.commit_pending_recurring_payment(
  uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.commit_pending_debt_payment(
  uuid, uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) to service_role;
grant execute on function public.commit_pending_recurring_payment(
  uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) to service_role;

create or replace function public.get_email_capture_health(
  p_days int default 7
)
returns jsonb
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_days int;
  v_total bigint;
  v_success bigint;
  v_failures bigint;
  v_fallback bigint;
  v_p95_latency numeric;
  v_external_total bigint;
  v_external_processed bigint;
  v_external_failed bigint;
  v_external_stuck bigint;
  v_watch_unhealthy bigint;
  v_token_missing bigint;
  v_stale_active_templates bigint;
  v_pending_created bigint;
  v_pending_confirmed bigint;
  v_pending_ignored bigint;
  v_gmail_api_calls bigint;
  v_templates jsonb;
begin
  v_days := greatest(1, least(coalesce(p_days, 7), 90));

  select
    count(*),
    count(*) filter (
      where parsed_status in ('parsed', 'pending_created', 'deduplicated')
    ),
    count(*) filter (where parsed_status = 'parse_failed'),
    count(*) filter (where metadata->>'parse_mode' = 'generic_fallback'),
    percentile_cont(0.95) within group (
      order by (metadata->>'processing_latency_ms')::numeric
    ) filter (
      where coalesce(metadata->>'processing_latency_ms', '') ~ '^[0-9]+(?:\.[0-9]+)?$'
    )
  into v_total, v_success, v_failures, v_fallback, v_p95_latency
  from public.email_messages
  where received_at >= now() - make_interval(days => v_days);

  select
    count(*) filter (where status <> 'duplicate'),
    count(*) filter (where status = 'processed'),
    count(*) filter (where status in ('failed', 'dead_letter')),
    count(*) filter (
      where status in ('received', 'accepted')
        and received_at < now() - interval '5 minutes'
    ),
    coalesce(sum(
      case
        when coalesce(metadata #>> '{gmail_result,gmailApiCalls}', '') ~ '^[0-9]+$'
          then (metadata #>> '{gmail_result,gmailApiCalls}')::bigint
        else 0
      end
    ), 0)
  into
    v_external_total,
    v_external_processed,
    v_external_failed,
    v_external_stuck,
    v_gmail_api_calls
  from public.external_event_log
  where source = 'gmail'
    and received_at >= now() - make_interval(days => v_days);

  select
    count(*) filter (
      where encrypted_refresh_token is not null
        and (
          status <> 'watch_active'
          or watch_status <> 'active'
          or watch_expiration is null
          or watch_expiration <= now() + interval '24 hours'
        )
    ),
    count(*) filter (where encrypted_refresh_token is null)
  into v_watch_unhealthy, v_token_missing
  from public.email_connections
  where status <> 'disconnected'
    and deleted_at is null;

  select count(*)
  into v_stale_active_templates
  from public.email_parse_templates
  where activation_mode = 'active'
    and created_at <= now() - interval '14 days'
    and (
      last_matched_at is null
      or last_matched_at <= now() - interval '14 days'
    );

  select
    count(*),
    count(*) filter (where status = 'user_confirmed'),
    count(*) filter (where status in ('discarded', 'expired', 'archived'))
  into v_pending_created, v_pending_confirmed, v_pending_ignored
  from public.pending_items
  where source in ('email_pending', 'backfill_pending')
    and created_at >= now() - make_interval(days => v_days);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'institution_key', institution_key,
        'template_version', template_version,
        'activation_mode', activation_mode,
        'verification_status', verification_status,
        'sample_count', cardinality(sample_hashes),
        'match_count', match_count,
        'shadow_match_count', shadow_match_count,
        'fallback_count', fallback_count,
        'parse_failure_count', parse_failure_count,
        'last_matched_at', last_matched_at,
        'last_shadow_at', last_shadow_at,
        'last_failure_at', last_failure_at,
        'stale_14d', (
          activation_mode = 'active'
          and created_at <= now() - interval '14 days'
          and (
            last_matched_at is null
            or last_matched_at <= now() - interval '14 days'
          )
        )
      )
      order by institution_key, priority, template_version
    ),
    '[]'::jsonb
  )
  into v_templates
  from public.email_parse_templates;

  return jsonb_build_object(
    'window_days', v_days,
    'denominator', 'persisted_allowlisted_messages',
    'allowed_messages_persisted', v_total,
    'successful_active_parses', v_success,
    'parse_failures', v_failures,
    'generic_fallbacks', v_fallback,
    'failed_external_events', v_external_failed,
    'stuck_external_events', v_external_stuck,
    'gmail_external_events', v_external_total,
    'processed_external_events', v_external_processed,
    'gmail_api_calls', v_gmail_api_calls,
    'watch_connections_unhealthy', v_watch_unhealthy,
    'connections_missing_token', v_token_missing,
    'stale_active_templates', v_stale_active_templates,
    'pending_items_created', v_pending_created,
    'pending_items_confirmed', v_pending_confirmed,
    'pending_items_ignored', v_pending_ignored,
    'active_parse_rate', case
      when v_total = 0 then null
      else round(v_success::numeric / v_total::numeric, 4)
    end,
    'fallback_rate', case
      when v_total = 0 then null
      else round(v_fallback::numeric / v_total::numeric, 4)
    end,
    'external_event_processed_rate', case
      when v_external_total = 0 then null
      else round(v_external_processed::numeric / v_external_total::numeric, 4)
    end,
    'pending_confirmation_rate', case
      when v_pending_created = 0 then null
      else round(v_pending_confirmed::numeric / v_pending_created::numeric, 4)
    end,
    'p95_processing_latency_ms', v_p95_latency,
    'cost_instrumentation', jsonb_build_object(
      'pricing_snapshot_id', null,
      'estimated_cost_usd', null,
      'estimated_cost_pen', null,
      'gmail_api_calls', v_gmail_api_calls,
      'emails_processed', v_total,
      'pending_items_confirmed', v_pending_confirmed,
      'gmail_api_calls_per_email', case
        when v_total = 0 then null
        else round(v_gmail_api_calls::numeric / v_total::numeric, 4)
      end,
      'gmail_api_calls_per_confirmed_pending', case
        when v_pending_confirmed = 0 then null
        else round(v_gmail_api_calls::numeric / v_pending_confirmed::numeric, 4)
      end
    ),
    'targets', jsonb_build_object(
      'active_parse_rate_gte_95', case
        when v_total = 0 then null
        else v_success::numeric / v_total::numeric >= 0.95
      end,
      'fallback_rate_lt_10', case
        when v_total = 0 then null
        else v_fallback::numeric / v_total::numeric < 0.10
      end,
      'p95_latency_lte_120000', case
        when v_p95_latency is null then null
        else v_p95_latency <= 120000
      end,
      'external_event_processed_rate_gte_98', case
        when v_external_total = 0 then null
        else v_external_processed::numeric / v_external_total::numeric >= 0.98
      end,
      'silent_failures_zero', (
        v_external_failed = 0 and v_external_stuck = 0
      ),
      'watch_connections_healthy', v_watch_unhealthy = 0,
      'tokens_present_for_connected_accounts', v_token_missing = 0,
      'active_templates_matched_within_14d', v_stale_active_templates = 0
    ),
    'templates', v_templates
  );
end;
$$;

revoke all on function public.get_email_capture_health(int)
  from public, anon, authenticated;
grant execute on function public.get_email_capture_health(int)
  to service_role;

create or replace function public.prepare_user_account_deletion(
  p_user_id uuid,
  p_trace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_external_events bigint;
begin
  if p_user_id is null or p_trace_id is null then
    raise exception 'ACCOUNT_DELETION_INPUT_REQUIRED';
  end if;

  if exists (
    select 1
    from public.email_connections
    where user_id = p_user_id
      and status <> 'disconnected'
      and encrypted_refresh_token is not null
  ) then
    raise exception 'GMAIL_MUST_BE_DISCONNECTED_BEFORE_ACCOUNT_DELETION';
  end if;

  update public.user_preferences
  set whatsapp_opt_in = false,
      email_opt_in = false,
      nudge_opt_in = '{}'::jsonb,
      updated_at = now()
  where user_id = p_user_id;

  update public.nudge_preferences
  set enabled = false,
      paused_until = null,
      updated_at = now()
  where user_id = p_user_id;

  update public.external_event_log
  set user_id = null,
      payload_ref = null,
      metadata = jsonb_build_object(
        'account_deleted', true,
        'content_persisted', false,
        'deletion_trace_id', p_trace_id
      ),
      updated_at = now()
  where user_id = p_user_id;

  get diagnostics v_external_events = row_count;

  return jsonb_build_object(
    'prepared', true,
    'external_events_minimized', v_external_events
  );
end;
$$;

revoke all on function public.prepare_user_account_deletion(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_user_account_deletion(uuid, uuid)
  to service_role;
