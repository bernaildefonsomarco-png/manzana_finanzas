-- =============================================================
-- Migration 031: Onboarding activation initial state machine
-- Corte 27 - not_started -> started -> first_value_reached
-- =============================================================

create or replace function public.advance_onboarding_stage(
  p_user_id uuid,
  p_target_status public.onboarding_status,
  p_trigger text,
  p_source text,
  p_trace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_previous public.onboarding_status;
  v_previous_rank integer;
  v_target_rank integer;
  v_now timestamptz := now();
begin
  if p_user_id is null or p_trace_id is null then
    raise exception 'ONBOARDING_IDENTITY_REQUIRED';
  end if;
  if nullif(trim(p_trigger), '') is null or length(p_trigger) > 120 then
    raise exception 'ONBOARDING_TRIGGER_INVALID';
  end if;
  if nullif(trim(p_source), '') is null or length(p_source) > 80 then
    raise exception 'ONBOARDING_SOURCE_INVALID';
  end if;
  if p_target_status not in ('started', 'first_value_reached') then
    raise exception 'ONBOARDING_TARGET_NOT_ALLOWED';
  end if;

  select onboarding_status
    into v_previous
    from public.profiles
   where id = p_user_id
   for update;

  if not found then
    raise exception 'ONBOARDING_PROFILE_NOT_FOUND';
  end if;

  if v_previous = 'paused' then
    return jsonb_build_object(
      'changed', false,
      'previous_status', v_previous,
      'current_status', v_previous,
      'reason', 'paused'
    );
  end if;

  v_previous_rank := case v_previous
    when 'not_started' then 0
    when 'started' then 1
    when 'first_value_reached' then 2
    when 'activated_light' then 3
    when 'activated_strong' then 4
    when 'completed' then 5
    else 0
  end;
  v_target_rank := case p_target_status
    when 'started' then 1
    when 'first_value_reached' then 2
    else 0
  end;

  if v_target_rank <= v_previous_rank then
    return jsonb_build_object(
      'changed', false,
      'previous_status', v_previous,
      'current_status', v_previous,
      'reason', 'already_at_or_beyond_target'
    );
  end if;

  update public.profiles
     set onboarding_status = p_target_status
   where id = p_user_id;

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
  values (
    p_user_id,
    'onboarding_stage_changed',
    'profile',
    p_user_id,
    jsonb_build_object(
      'previous_status', v_previous,
      'current_status', p_target_status,
      'trigger', trim(p_trigger),
      'source', trim(p_source),
      'changed_at', v_now
    ),
    1,
    'pending',
    p_trace_id,
    jsonb_build_object(
      'financial_write', false,
      'onboarding_cut', 27
    )
  );

  return jsonb_build_object(
    'changed', true,
    'previous_status', v_previous,
    'current_status', p_target_status,
    'reason', 'advanced',
    'changed_at', v_now
  );
end;
$$;

revoke all on function public.advance_onboarding_stage(
  uuid,
  public.onboarding_status,
  text,
  text,
  uuid
) from public, anon, authenticated;

grant execute on function public.advance_onboarding_stage(
  uuid,
  public.onboarding_status,
  text,
  text,
  uuid
) to service_role;

comment on function public.advance_onboarding_stage(
  uuid,
  public.onboarding_status,
  text,
  text,
  uuid
) is
  'Avanza onboarding inicial de forma monotona y escribe onboarding_stage_changed en el mismo commit. Nunca toca entidades financieras.';
