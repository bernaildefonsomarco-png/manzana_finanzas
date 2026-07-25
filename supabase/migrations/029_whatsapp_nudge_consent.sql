-- =============================================================
-- Migration 029: WhatsApp proactive nudge consent
-- Controlled proactive activation cut
-- Depends on: 002, 017, 019, 028
-- =============================================================

create or replace function public.set_whatsapp_nudge_consent(
  p_user_id uuid,
  p_enabled boolean,
  p_payment_due boolean,
  p_debt_due boolean,
  p_quiet_hours_start time,
  p_quiet_hours_end time,
  p_trace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_now timestamptz := now();
  v_type record;
begin
  if p_enabled and not (p_payment_due or p_debt_due) then
    raise exception 'WHATSAPP_NUDGE_TYPE_CONSENT_REQUIRED';
  end if;

  insert into public.user_preferences (
    user_id,
    whatsapp_opt_in,
    quiet_hours_start,
    quiet_hours_end,
    nudge_opt_in,
    metadata
  )
  values (
    p_user_id,
    p_enabled,
    p_quiet_hours_start,
    p_quiet_hours_end,
    jsonb_build_object(
      'payment_due', p_payment_due,
      'overdue_payment', p_payment_due,
      'debt_due', p_debt_due
    ),
    jsonb_build_object(
      'whatsapp_nudge_consent', jsonb_build_object(
        'enabled', p_enabled,
        'recorded_at', v_now,
        'trace_id', p_trace_id,
        'source', 'dashboard_settings'
      )
    )
  )
  on conflict (user_id)
  do update
     set whatsapp_opt_in = excluded.whatsapp_opt_in,
         quiet_hours_start = excluded.quiet_hours_start,
         quiet_hours_end = excluded.quiet_hours_end,
         nudge_opt_in = coalesce(user_preferences.nudge_opt_in, '{}'::jsonb)
           || excluded.nudge_opt_in,
         metadata = coalesce(user_preferences.metadata, '{}'::jsonb)
           || excluded.metadata;

  for v_type in
    select *
      from (
        values
          ('payment_due'::public.nudge_type, p_payment_due),
          ('debt_due'::public.nudge_type, p_debt_due)
      ) as consent(nudge_type, type_enabled)
  loop
    insert into public.nudge_preferences (
      user_id,
      nudge_type,
      enabled,
      channel,
      quiet_hours_override,
      paused_until,
      metadata
    )
    values (
      p_user_id,
      v_type.nudge_type,
      p_enabled and v_type.type_enabled,
      'whatsapp',
      jsonb_build_object(
        'start', p_quiet_hours_start,
        'end', p_quiet_hours_end
      ),
      null,
      jsonb_build_object(
        'consent_recorded_at', v_now,
        'consent_trace_id', p_trace_id,
        'consent_source', 'dashboard_settings',
        'master_enabled', p_enabled
      )
    )
    on conflict (user_id, nudge_type, channel)
    do update
       set enabled = excluded.enabled,
           quiet_hours_override = excluded.quiet_hours_override,
           paused_until = null,
           metadata = coalesce(nudge_preferences.metadata, '{}'::jsonb)
             || excluded.metadata;
  end loop;

  return jsonb_build_object(
    'whatsapp_opt_in', p_enabled,
    'payment_due', p_payment_due,
    'debt_due', p_debt_due,
    'quiet_hours_start', p_quiet_hours_start,
    'quiet_hours_end', p_quiet_hours_end,
    'recorded_at', v_now
  );
end;
$$;

revoke all on function public.set_whatsapp_nudge_consent(
  uuid,
  boolean,
  boolean,
  boolean,
  time,
  time,
  uuid
) from public, anon, authenticated;

grant execute on function public.set_whatsapp_nudge_consent(
  uuid,
  boolean,
  boolean,
  boolean,
  time,
  time,
  uuid
) to service_role;

comment on function public.set_whatsapp_nudge_consent(
  uuid,
  boolean,
  boolean,
  boolean,
  time,
  time,
  uuid
) is
  'Registra o revoca consentimiento proactivo de WhatsApp y sus tipos de forma atomica. No envia mensajes ni escribe entidades financieras.';
