-- Corte 31: un dead letter tambien es un fallo visible del pipeline externo.
-- Esta migracion reemplaza el RPC ya desplegado por 034 sin cambiar su contrato.

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
