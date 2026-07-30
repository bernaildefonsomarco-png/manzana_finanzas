-- =============================================================
-- Migration 059: W-11 atomic recurring occurrence skip
-- RUL-REC-08: skip the occurrence and advance the owning rule together.
-- Depends on: 008, 015, 058
-- =============================================================

create or replace function manzana.commit_recurring_occurrence_skip(
  p_user_id uuid,
  p_recurring_rule_id uuid,
  p_occurrence_id uuid,
  p_trace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_rule public.recurring_rules;
  v_occurrence public.recurring_occurrences;
  v_next_date date;
  v_month_start date;
  v_month_last date;
  v_preferred_day integer;
  v_idempotent boolean := false;
begin
  if p_user_id is null
     or p_recurring_rule_id is null
     or p_occurrence_id is null
     or p_trace_id is null then
    raise exception 'RECURRING_SKIP_REQUIRED_IDENTIFIER';
  end if;

  -- Lock order shared by recurring operations: rule, then occurrence.
  select *
    into v_rule
    from public.recurring_rules
   where id = p_recurring_rule_id
     and user_id = p_user_id
     and deleted_at is null
   for update;

  if not found then
    raise exception 'RECURRING_RULE_NOT_FOUND';
  end if;

  select *
    into v_occurrence
    from public.recurring_occurrences
   where id = p_occurrence_id
     and recurring_rule_id = v_rule.id
     and user_id = p_user_id
   for update;

  if not found then
    raise exception 'RECURRING_OCCURRENCE_NOT_FOUND';
  end if;

  if v_occurrence.status = 'skipped'::public.recurring_occurrence_status then
    v_idempotent := true;
  elsif v_occurrence.status not in (
    'expected'::public.recurring_occurrence_status,
    'due_soon'::public.recurring_occurrence_status,
    'pending_confirmation'::public.recurring_occurrence_status,
    'overdue'::public.recurring_occurrence_status
  ) then
    raise exception 'RECURRING_OCCURRENCE_NOT_SKIPPABLE';
  else
    update public.recurring_occurrences
       set status = 'skipped'::public.recurring_occurrence_status,
           metadata = coalesce(metadata, '{}'::jsonb)
             || jsonb_build_object(
               'skipped_from', 'dashboard_upcoming',
               'trace_id', p_trace_id,
               'skipped_at', now()
             )
     where id = v_occurrence.id
     returning * into v_occurrence;
  end if;

  select min(expected_date)
    into v_next_date
    from public.recurring_occurrences
   where recurring_rule_id = v_rule.id
     and user_id = p_user_id
     and expected_date > v_occurrence.expected_date
     and status in (
       'expected'::public.recurring_occurrence_status,
       'due_soon'::public.recurring_occurrence_status,
       'pending_confirmation'::public.recurring_occurrence_status,
       'overdue'::public.recurring_occurrence_status
     );

  if v_next_date is null then
    if v_rule.frequency = 'weekly' then
      v_next_date := v_occurrence.expected_date + 7;
    elsif v_rule.frequency = 'biweekly' then
      v_next_date := v_occurrence.expected_date + 14;
    elsif v_rule.frequency = 'yearly' then
      v_next_date := (v_occurrence.expected_date + interval '1 year')::date;
    else
      -- monthly and custom_window follow the same month cadence used by
      -- recurring-occurrence-scheduler.ts, clamped at month end.
      v_preferred_day := coalesce(
        v_rule.day_of_month,
        extract(day from v_occurrence.expected_date)::integer
      );
      v_month_start := (
        date_trunc('month', v_occurrence.expected_date)
        + interval '1 month'
      )::date;
      v_month_last := (
        v_month_start + interval '1 month' - interval '1 day'
      )::date;
      v_next_date := (
        v_month_start
        + (
          least(
            greatest(v_preferred_day, 1),
            extract(day from v_month_last)::integer
          ) - 1
        )
      )::date;
    end if;
  end if;

  -- Skipping an old overdue occurrence must not move a rule backwards when
  -- another action already advanced it further.
  if v_rule.next_expected_date is not null
     and v_rule.next_expected_date > v_occurrence.expected_date then
    v_next_date := v_rule.next_expected_date;
  end if;

  update public.recurring_rules
     set next_expected_date = v_next_date,
         metadata = coalesce(metadata, '{}'::jsonb)
           || jsonb_build_object(
             'last_skipped_occurrence_id', v_occurrence.id,
             'last_skip_trace_id', p_trace_id,
             'last_skip_at', now()
           )
   where id = v_rule.id
     and (
       next_expected_date is null
       or next_expected_date <= v_occurrence.expected_date
     )
   returning * into v_rule;

  if not found then
    select *
      into v_rule
      from public.recurring_rules
     where id = p_recurring_rule_id
       and user_id = p_user_id;
  end if;

  if not v_idempotent then
    insert into public.transactional_outbox (
      id,
      user_id,
      event_type,
      aggregate_type,
      aggregate_id,
      payload,
      payload_version,
      trace_id,
      metadata
    )
    values (
      gen_random_uuid(),
      p_user_id,
      'recurring_occurrence_skipped',
      'recurring_occurrence',
      v_occurrence.id,
      jsonb_build_object(
        'recurring_rule_id', v_rule.id,
        'occurrence_id', v_occurrence.id,
        'next_expected_date', v_next_date
      ),
      1,
      p_trace_id,
      jsonb_build_object('source', 'recurring_engine.skip_v1')
    );
  end if;

  return jsonb_build_object(
    'recurring_rule', to_jsonb(v_rule),
    'occurrence', to_jsonb(v_occurrence),
    'idempotent', v_idempotent
  );
end;
$$;

create or replace function public.commit_recurring_occurrence_skip(
  p_user_id uuid,
  p_recurring_rule_id uuid,
  p_occurrence_id uuid,
  p_trace_id uuid
)
returns jsonb
language sql
security definer
set search_path = public, manzana
as $$
  select manzana.commit_recurring_occurrence_skip(
    p_user_id,
    p_recurring_rule_id,
    p_occurrence_id,
    p_trace_id
  );
$$;

revoke all on function manzana.commit_recurring_occurrence_skip(
  uuid,
  uuid,
  uuid,
  uuid
) from public, anon, authenticated;

revoke all on function public.commit_recurring_occurrence_skip(
  uuid,
  uuid,
  uuid,
  uuid
) from public, anon, authenticated;

grant execute on function public.commit_recurring_occurrence_skip(
  uuid,
  uuid,
  uuid,
  uuid
) to service_role;

comment on function public.commit_recurring_occurrence_skip(
  uuid,
  uuid,
  uuid,
  uuid
) is
  'Recurring Engine: atomically skips one occurrence, advances the rule and emits one outbox event.';
