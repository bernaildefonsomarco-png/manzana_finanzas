-- Corte 31: observa reparaciones deterministicas del extractor sin persistir
-- valores, citas, cuerpos ni hashes de los EML autorizados.

create or replace function public.get_email_extraction_agent_health(
  p_days int default 7
)
returns jsonb
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_days int;
  v_attempts bigint;
  v_success bigint;
  v_fallbacks bigint;
  v_grounding_failures bigint;
  v_ignored bigint;
  v_api_extractions bigint;
  v_evidence_repaired_attempts bigint;
  v_value_normalized_attempts bigint;
  v_p95_latency numeric;
begin
  v_days := greatest(1, least(coalesce(p_days, 7), 90));

  select
    count(*) filter (
      where metadata ? 'agent_provider'
         or metadata ? 'agent_fallback_reason'
         or metadata ? 'shadow_agent_provider'
         or metadata ? 'shadow_agent_fallback_reason'
    ),
    count(*) filter (
      where metadata->>'parse_mode' = 'agent'
         or metadata->>'shadow_agent_outcome' in ('parsed', 'ignored')
    ),
    count(*) filter (
      where nullif(metadata->>'agent_fallback_reason', '') is not null
         or nullif(metadata->>'shadow_agent_fallback_reason', '') is not null
    ),
    count(*) filter (
      where metadata->>'extraction_grounded' = 'false'
         or metadata->>'shadow_extraction_grounded' = 'false'
    ),
    count(*) filter (
      where metadata->>'ignored_reason' = 'non_completed_financial_notice'
         or metadata->>'shadow_agent_outcome' = 'ignored'
    ),
    count(*) filter (
      where (
          metadata->>'parse_mode' = 'agent'
          and metadata->>'agent_provider' = 'api'
        ) or (
          metadata->>'shadow_agent_outcome' in ('parsed', 'ignored')
          and metadata->>'shadow_agent_provider' = 'api'
        )
    ),
    count(*) filter (
      where (
        case
          when coalesce(metadata->>'agent_evidence_repair_count', '') ~ '^[0-9]+$'
          then (metadata->>'agent_evidence_repair_count')::int
          else 0
        end
      ) > 0 or (
        case
          when coalesce(metadata->>'shadow_agent_evidence_repair_count', '') ~ '^[0-9]+$'
          then (metadata->>'shadow_agent_evidence_repair_count')::int
          else 0
        end
      ) > 0
    ),
    count(*) filter (
      where (
        case
          when coalesce(metadata->>'agent_value_normalization_count', '') ~ '^[0-9]+$'
          then (metadata->>'agent_value_normalization_count')::int
          else 0
        end
      ) > 0 or (
        case
          when coalesce(metadata->>'shadow_agent_value_normalization_count', '') ~ '^[0-9]+$'
          then (metadata->>'shadow_agent_value_normalization_count')::int
          else 0
        end
      ) > 0
    ),
    percentile_cont(0.95) within group (
      order by coalesce(
        nullif(metadata->>'agent_latency_ms', '')::numeric,
        nullif(metadata->>'shadow_agent_latency_ms', '')::numeric
      )
    ) filter (
      where coalesce(
        metadata->>'agent_latency_ms',
        metadata->>'shadow_agent_latency_ms',
        ''
      ) ~ '^[0-9]+(?:\.[0-9]+)?$'
    )
  into
    v_attempts,
    v_success,
    v_fallbacks,
    v_grounding_failures,
    v_ignored,
    v_api_extractions,
    v_evidence_repaired_attempts,
    v_value_normalized_attempts,
    v_p95_latency
  from public.email_messages
  where received_at >= now() - make_interval(days => v_days);

  return jsonb_build_object(
    'window_days', v_days,
    'agent_attempts', v_attempts,
    'grounded_agent_extractions', v_success,
    'agent_fallbacks', v_fallbacks,
    'agent_grounding_failures', v_grounding_failures,
    'ignored_non_movement_notices', v_ignored,
    'api_agent_extractions', v_api_extractions,
    'agent_evidence_repaired_attempts', v_evidence_repaired_attempts,
    'agent_value_normalized_attempts', v_value_normalized_attempts,
    'p95_agent_latency_ms', v_p95_latency,
    'agent_success_rate', case
      when v_attempts = 0 then null
      else round(v_success::numeric / v_attempts::numeric, 4)
    end,
    'agent_fallback_rate', case
      when v_attempts = 0 then null
      else round(v_fallbacks::numeric / v_attempts::numeric, 4)
    end,
    'agent_grounding_failure_rate', case
      when v_attempts = 0 then null
      else round(v_grounding_failures::numeric / v_attempts::numeric, 4)
    end,
    'agent_evidence_repair_rate', case
      when v_attempts = 0 then null
      else round(v_evidence_repaired_attempts::numeric / v_attempts::numeric, 4)
    end,
    'agent_value_normalization_rate', case
      when v_attempts = 0 then null
      else round(v_value_normalized_attempts::numeric / v_attempts::numeric, 4)
    end,
    'targets', jsonb_build_object(
      'agent_fallback_rate_lt_10', case
        when v_attempts = 0 then null
        else v_fallbacks::numeric / v_attempts::numeric < 0.10
      end,
      'agent_grounding_failure_rate_lt_1', case
        when v_attempts = 0 then null
        else v_grounding_failures::numeric / v_attempts::numeric < 0.01
      end,
      'agent_evidence_repair_rate_lt_20', case
        when v_attempts = 0 then null
        else v_evidence_repaired_attempts::numeric / v_attempts::numeric < 0.20
      end,
      'agent_value_normalization_rate_lt_10', case
        when v_attempts = 0 then null
        else v_value_normalized_attempts::numeric / v_attempts::numeric < 0.10
      end,
      'p95_agent_latency_lte_10000', case
        when v_p95_latency is null then null
        else v_p95_latency <= 10000
      end
    )
  );
end;
$$;

revoke all on function public.get_email_extraction_agent_health(int)
  from public, anon, authenticated;
grant execute on function public.get_email_extraction_agent_health(int)
  to service_role;

alter table public.email_parse_templates
  drop constraint if exists email_parse_templates_active_verified,
  add constraint email_parse_templates_active_verified
    check (
      activation_mode <> 'active'
      or (
        verification_status = 'verified'
        and verified_at is not null
        and metadata->>'sender_authentication' = 'dkim_dmarc_required'
        and metadata->>'shadow_reviewed' = 'true'
        and metadata->>'critical_error_count' = '0'
        and metadata->>'rollback_ready' = 'true'
        and case
          when coalesce(metadata->>'grounding_rate', '') ~
            '^(0(\.[0-9]+)?|1(\.0+)?)$'
          then (metadata->>'grounding_rate')::numeric >= 0.99
          else false
        end
        and case
          when coalesce(metadata->>'fallback_rate', '') ~
            '^(0(\.[0-9]+)?|1(\.0+)?)$'
          then (metadata->>'fallback_rate')::numeric < 0.10
          else false
        end
        and case
          when coalesce(metadata->>'evidence_repair_rate', '') ~
            '^(0(\.[0-9]+)?|1(\.0+)?)$'
          then (metadata->>'evidence_repair_rate')::numeric < 0.20
          else false
        end
        and case
          when coalesce(metadata->>'value_normalization_rate', '') ~
            '^(0(\.[0-9]+)?|1(\.0+)?)$'
          then (metadata->>'value_normalization_rate')::numeric < 0.10
          else false
        end
      )
    );

update public.email_parse_templates
   set metadata = metadata || jsonb_build_object(
         'authorized_real_backfill_count', 4,
         'authorized_real_backfill_semantic_success_count', 4,
         'authorized_real_backfill_sender_auth_count', 4,
         'authorized_real_backfill_content_persisted', false,
         'authorized_real_backfill_agent_tool_calls', 0,
         'authorized_real_backfill_retry_occurred', true,
         'authorized_real_backfill_reviewed_at', now()
       ),
       updated_at = now()
 where id = '03800000-0000-4000-8000-000000000001'
   and institution_key = 'bcp'
   and activation_mode = 'shadow';
