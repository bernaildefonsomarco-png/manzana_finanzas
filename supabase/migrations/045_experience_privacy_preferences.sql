begin;

create table if not exists public.experience_preference_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_type text not null default 'user',
  event_type text not null default 'experience_preferences_updated',
  idempotency_key text not null,
  previous_state jsonb not null default '{}'::jsonb,
  next_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint experience_preference_events_actor_known
    check (actor_type in ('user', 'system', 'worker')),
  constraint experience_preference_events_type_known
    check (event_type in ('experience_preferences_updated'))
);

create unique index if not exists experience_preference_events_idempotency_idx
  on public.experience_preference_events (user_id, idempotency_key);
create index if not exists experience_preference_events_user_created_idx
  on public.experience_preference_events (user_id, created_at desc);

alter table public.experience_preference_events enable row level security;
drop policy if exists "experience_preference_events: select own"
  on public.experience_preference_events;
create policy "experience_preference_events: select own"
  on public.experience_preference_events for select
  using (auth.uid() = user_id);
drop policy if exists "experience_preference_events: no client write"
  on public.experience_preference_events;
create policy "experience_preference_events: no client write"
  on public.experience_preference_events for all
  using (false)
  with check (false);

revoke all on public.experience_preference_events
  from public, anon, authenticated;
grant select on public.experience_preference_events to authenticated;
grant select, insert on public.experience_preference_events to service_role;

create or replace function public.set_experience_preferences(
  p_user_id uuid,
  p_discreet_mode_enabled boolean,
  p_insights_whatsapp_opt_in boolean,
  p_weekly_summary_enabled boolean,
  p_weekly_summary_channel text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_previous jsonb := '{}'::jsonb;
  v_preferences public.user_preferences;
  v_next jsonb;
begin
  if p_weekly_summary_channel not in ('dashboard', 'whatsapp') then
    raise exception 'EXPERIENCE_WEEKLY_CHANNEL_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select to_jsonb(preferences)
    into v_previous
    from public.user_preferences preferences
   where user_id = p_user_id
   for update;

  insert into public.user_preferences (
    user_id,
    discreet_mode_enabled,
    nudge_opt_in,
    metadata
  )
  values (
    p_user_id,
    p_discreet_mode_enabled,
    jsonb_build_object(
      'insight_prompt', p_insights_whatsapp_opt_in,
      'anomaly_alert', p_insights_whatsapp_opt_in,
      'progress_positive', p_insights_whatsapp_opt_in,
      'weekly_review',
        p_weekly_summary_enabled
        and p_weekly_summary_channel = 'whatsapp'
    ),
    jsonb_build_object(
      'weekly_summary_enabled', p_weekly_summary_enabled,
      'weekly_summary_channel', p_weekly_summary_channel,
      'experience_preferences_version', 'experience_v1'
    )
  )
  on conflict (user_id)
  do update set
    discreet_mode_enabled = excluded.discreet_mode_enabled,
    nudge_opt_in =
      coalesce(public.user_preferences.nudge_opt_in, '{}'::jsonb)
      || excluded.nudge_opt_in,
    metadata =
      coalesce(public.user_preferences.metadata, '{}'::jsonb)
      || excluded.metadata
  returning * into v_preferences;

  insert into public.nudge_preferences (
    user_id,
    nudge_type,
    enabled,
    channel,
    metadata
  )
  values
    (
      p_user_id,
      'weekly_review',
      p_weekly_summary_enabled
        and p_weekly_summary_channel = 'dashboard',
      'dashboard',
      jsonb_build_object('source', 'experience_preferences')
    ),
    (
      p_user_id,
      'weekly_review',
      p_weekly_summary_enabled
        and p_weekly_summary_channel = 'whatsapp',
      'whatsapp',
      jsonb_build_object('source', 'experience_preferences')
    )
  on conflict (user_id, nudge_type, channel)
  do update set
    enabled = excluded.enabled,
    paused_until = null,
    metadata =
      coalesce(public.nudge_preferences.metadata, '{}'::jsonb)
      || excluded.metadata;

  if not p_insights_whatsapp_opt_in then
    update public.nudge_candidates
       set status = 'rejected',
           metadata = metadata || jsonb_build_object(
             'rejection_reason', 'insights_whatsapp_opt_out'
           )
     where user_id = p_user_id
       and type in ('insight_prompt', 'anomaly_alert', 'progress_positive')
       and status in ('candidate', 'approved', 'deferred', 'scheduled');
  end if;

  if not p_weekly_summary_enabled then
    update public.nudge_candidates
       set status = 'rejected',
           metadata = metadata || jsonb_build_object(
             'rejection_reason', 'weekly_summary_opt_out'
           )
     where user_id = p_user_id
       and type = 'weekly_review'
       and status in ('candidate', 'approved', 'deferred', 'scheduled');
  end if;

  v_next := jsonb_build_object(
    'discreet_mode_enabled', v_preferences.discreet_mode_enabled,
    'insights_whatsapp_opt_in',
      coalesce(
        (v_preferences.nudge_opt_in ->> 'insight_prompt')::boolean,
        false
      ),
    'weekly_summary_enabled',
      coalesce(
        (v_preferences.metadata ->> 'weekly_summary_enabled')::boolean,
        false
      ),
    'weekly_summary_channel',
      coalesce(
        v_preferences.metadata ->> 'weekly_summary_channel',
        'dashboard'
      )
  );

  insert into public.experience_preference_events (
    user_id,
    actor_type,
    event_type,
    idempotency_key,
    previous_state,
    next_state
  )
  values (
    p_user_id,
    'user',
    'experience_preferences_updated',
    p_idempotency_key,
    coalesce(v_previous, '{}'::jsonb),
    v_next
  )
  on conflict (user_id, idempotency_key) do nothing;

  return v_next;
end;
$$;

revoke all on function public.set_experience_preferences(
  uuid,
  boolean,
  boolean,
  boolean,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.set_experience_preferences(
  uuid,
  boolean,
  boolean,
  boolean,
  text,
  text
) to service_role;

commit;
