-- =============================================================
-- Migration 019: Dashboard nudge preferences
-- Corte 19 - Preferencias reversibles y deuda proxima
-- Depends on: 017, 018
-- =============================================================

alter table public.nudge_preferences
  add column if not exists paused_until timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'nudge_preferences_metadata_object'
       and conrelid = 'public.nudge_preferences'::regclass
  ) then
    alter table public.nudge_preferences
      add constraint nudge_preferences_metadata_object
      check (jsonb_typeof(metadata) = 'object');
  end if;
end $$;

create index if not exists nudge_preferences_user_channel_enabled_idx
  on public.nudge_preferences (user_id, channel, enabled);

create or replace function public.set_dashboard_nudge_preference(
  p_user_id uuid,
  p_nudge_type public.nudge_type,
  p_enabled boolean
)
returns public.nudge_preferences
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_preference public.nudge_preferences;
  v_now timestamptz := now();
begin
  if p_nudge_type not in (
    'payment_due'::public.nudge_type,
    'debt_due'::public.nudge_type
  ) then
    raise exception 'DASHBOARD_NUDGE_PREFERENCE_TYPE_NOT_SUPPORTED';
  end if;

  insert into public.nudge_preferences (
    user_id,
    nudge_type,
    enabled,
    channel,
    paused_until,
    metadata
  )
  values (
    p_user_id,
    p_nudge_type,
    p_enabled,
    'dashboard',
    null,
    jsonb_build_object(
      'configured_by', 'user',
      'configured_at', v_now
    )
  )
  on conflict (user_id, nudge_type, channel)
  do update
     set enabled = excluded.enabled,
         paused_until = null,
         metadata = coalesce(nudge_preferences.metadata, '{}'::jsonb)
           || excluded.metadata
  returning * into v_preference;

  if not p_enabled then
    update public.nudge_candidates
       set status = 'expired'::public.nudge_status,
           metadata = coalesce(metadata, '{}'::jsonb)
             || jsonb_build_object(
               'expired_at', v_now,
               'expired_reason', 'dashboard_preference_disabled'
             )
     where user_id = p_user_id
       and status in (
         'candidate'::public.nudge_status,
         'approved'::public.nudge_status,
         'deferred'::public.nudge_status,
         'scheduled'::public.nudge_status
       )
       and (
         (
           p_nudge_type = 'payment_due'::public.nudge_type
           and source_entity_type = 'recurring_occurrence'
           and type in (
             'payment_due'::public.nudge_type,
             'overdue_payment'::public.nudge_type
           )
         )
         or (
           p_nudge_type = 'debt_due'::public.nudge_type
           and source_entity_type = 'debt_installment'
           and type = 'debt_due'::public.nudge_type
         )
       );
  end if;

  return v_preference;
end;
$$;

revoke all on function public.set_dashboard_nudge_preference(
  uuid,
  public.nudge_type,
  boolean
) from public, anon, authenticated;

grant execute on function public.set_dashboard_nudge_preference(
  uuid,
  public.nudge_type,
  boolean
) to service_role;

comment on function public.set_dashboard_nudge_preference(
  uuid,
  public.nudge_type,
  boolean
) is
  'Guarda una preferencia dashboard y expira sus avisos abiertos al desactivarla. No envia mensajes ni escribe entidades financieras.';
