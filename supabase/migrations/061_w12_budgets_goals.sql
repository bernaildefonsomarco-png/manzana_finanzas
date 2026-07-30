-- =============================================================
-- Migration 061: W-12 budgets, goals and deterministic suggestions
-- WEB-D218..WEB-D223
-- Depends on: 001, 003, 004, 006, 008, 049
-- =============================================================

begin;

-- Domain enums -------------------------------------------------

do $$ begin
  create type public.budget_period as enum (
    'semanal',
    'quincenal',
    'mensual'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.budget_kind as enum (
    'presupuesto',
    'limite_blando',
    'limite_duro'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.budget_source as enum (
    'manual',
    'sugerido'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.budget_status as enum (
    'activo',
    'pausado',
    'archivado'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.goal_status as enum (
    'activa',
    'alcanzada',
    'pausada',
    'archivada'
  );
exception when duplicate_object then null;
end $$;

-- Immutable helpers used by checks and Core operations ----------

create or replace function manzana.valid_budget_thresholds(
  p_thresholds smallint[]
)
returns boolean
language sql
immutable
parallel safe
as $$
  select
    p_thresholds is not null
    and array_position(p_thresholds, null) is null
    and p_thresholds <@ array[70, 90, 100]::smallint[]
    and cardinality(p_thresholds) = (
      select count(distinct threshold_value)
      from unnest(p_thresholds) as threshold_value
    );
$$;

create or replace function manzana.budget_period_bounds(
  p_period_kind public.budget_period,
  p_date date
)
returns table (
  period_start date,
  period_end date
)
language sql
immutable
parallel safe
as $$
  select
    case p_period_kind
      when 'semanal'::public.budget_period then
        p_date - (extract(isodow from p_date)::integer - 1)
      when 'quincenal'::public.budget_period then
        case
          when extract(day from p_date)::integer <= 15
            then date_trunc('month', p_date)::date
          else date_trunc('month', p_date)::date + 15
        end
      when 'mensual'::public.budget_period then
        date_trunc('month', p_date)::date
    end,
    case p_period_kind
      when 'semanal'::public.budget_period then
        p_date - (extract(isodow from p_date)::integer - 1) + 6
      when 'quincenal'::public.budget_period then
        case
          when extract(day from p_date)::integer <= 15
            then date_trunc('month', p_date)::date + 14
          else (
            date_trunc('month', p_date)
            + interval '1 month'
            - interval '1 day'
          )::date
        end
      when 'mensual'::public.budget_period then
        (
          date_trunc('month', p_date)
          + interval '1 month'
          - interval '1 day'
        )::date
    end;
$$;

create or replace function manzana.valid_budget_period(
  p_period_kind public.budget_period,
  p_period_start date,
  p_period_end date
)
returns boolean
language sql
immutable
parallel safe
as $$
  select exists (
    select 1
    from manzana.budget_period_bounds(p_period_kind, p_period_start) bounds
    where bounds.period_start = p_period_start
      and bounds.period_end = p_period_end
  );
$$;

-- Tables --------------------------------------------------------

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id text references public.categories(id),
  currency text not null default 'PEN',
  period_kind public.budget_period not null,
  period_start date not null,
  period_end date not null,
  base_amount numeric(14,2) not null,
  rollover_amount numeric(14,2) not null default 0,
  amount numeric(14,2) not null,
  kind public.budget_kind not null,
  rollover boolean not null default false,
  auto_renew boolean not null default true,
  alerted_thresholds smallint[] not null default '{}'::smallint[],
  source public.budget_source not null default 'manual',
  status public.budget_status not null default 'activo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint budgets_currency_pen check (currency = 'PEN'),
  constraint budgets_base_amount_positive check (base_amount > 0),
  constraint budgets_rollover_amount_non_negative check (rollover_amount >= 0),
  constraint budgets_amount_is_base_plus_rollover check (
    amount = base_amount + rollover_amount
  ),
  constraint budgets_period_order check (period_end > period_start),
  constraint budgets_period_coherent check (
    manzana.valid_budget_period(period_kind, period_start, period_end)
  ),
  constraint budgets_alerted_thresholds_valid check (
    manzana.valid_budget_thresholds(alerted_thresholds)
  ),
  constraint budgets_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create trigger budgets_updated_at
  before update on public.budgets
  for each row execute function manzana.set_updated_at();

create unique index if not exists budgets_one_active_per_scope_idx
  on public.budgets (user_id, category_id, period_start, kind)
  nulls not distinct
  where status = 'activo';

create index if not exists budgets_user_period_category_idx
  on public.budgets (user_id, period_start desc, category_id);

create index if not exists budgets_user_status_idx
  on public.budgets (user_id, status);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null,
  target_date date,
  box_id uuid references public.boxes(id) on delete set null,
  currency text not null default 'PEN',
  status public.goal_status not null default 'activa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint goals_name_length check (
    length(btrim(name)) between 1 and 60
  ),
  constraint goals_name_trimmed check (name = btrim(name)),
  constraint goals_target_amount_positive check (target_amount > 0),
  constraint goals_currency_pen check (currency = 'PEN'),
  constraint goals_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create trigger goals_updated_at
  before update on public.goals
  for each row execute function manzana.set_updated_at();

create unique index if not exists goals_active_name_unique_idx
  on public.goals (user_id, lower(name))
  where status <> 'archivada';

create unique index if not exists goals_one_active_per_box_idx
  on public.goals (box_id)
  where box_id is not null
    and status <> 'archivada';

create index if not exists goals_user_status_idx
  on public.goals (user_id, status);

create table if not exists public.budget_progress_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  budget_id uuid not null references public.budgets(id) on delete cascade,
  as_of date not null,
  spent numeric(14,2) not null,
  remaining numeric(14,2) not null,
  pct numeric not null,
  created_at timestamptz not null default now(),
  constraint budget_progress_snapshots_spent_non_negative check (spent >= 0),
  constraint budget_progress_snapshots_pct_non_negative check (pct >= 0),
  constraint budget_progress_snapshots_user_day_unique unique (
    budget_id,
    as_of
  )
);

create index if not exists budget_progress_snapshots_budget_as_of_idx
  on public.budget_progress_snapshots (budget_id, as_of desc);

create index if not exists budget_progress_snapshots_user_as_of_idx
  on public.budget_progress_snapshots (user_id, as_of desc);

create table if not exists public.budget_suggestion_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  suggestion_key text not null,
  category_id text not null references public.categories(id),
  period_kind public.budget_period not null,
  evidence_start date not null,
  evidence_end date not null,
  evidence jsonb not null,
  proposed_amount numeric(14,2) not null,
  resolution text not null,
  idempotency_key text not null,
  request_hash text not null,
  budget_id uuid references public.budgets(id) on delete set null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  constraint budget_suggestion_decisions_key_length check (
    length(suggestion_key) between 16 and 180
  ),
  constraint budget_suggestion_decisions_resolution_known check (
    resolution in ('accepted', 'dismissed')
  ),
  constraint budget_suggestion_decisions_idempotency_key_length check (
    length(idempotency_key) between 8 and 180
  ),
  constraint budget_suggestion_decisions_evidence_window check (
    evidence_end >= evidence_start
  ),
  constraint budget_suggestion_decisions_evidence_array check (
    jsonb_typeof(evidence) = 'array'
  ),
  constraint budget_suggestion_decisions_amount_positive check (
    proposed_amount > 0
  ),
  constraint budget_suggestion_decisions_result_object check (
    jsonb_typeof(result) = 'object'
  ),
  constraint budget_suggestion_decisions_budget_matches_resolution check (
    (resolution = 'accepted' and budget_id is not null)
    or (resolution = 'dismissed' and budget_id is null)
  ),
  constraint budget_suggestion_decisions_user_suggestion_unique unique (
    user_id,
    suggestion_key
  ),
  constraint budget_suggestion_decisions_user_idempotency_unique unique (
    user_id,
    idempotency_key
  )
);

create index if not exists budget_suggestion_decisions_user_created_idx
  on public.budget_suggestion_decisions (user_id, created_at desc);

-- Receipts keep retries deterministic without turning entity metadata
-- into an idempotency store.

create table if not exists public.budget_operation_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  budget_id uuid references public.budgets(id) on delete set null,
  operation text not null,
  idempotency_key text not null,
  request_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  constraint budget_operation_receipts_operation_known check (
    operation in (
      'create',
      'update',
      'archive',
      'pause',
      'resume',
      'restore',
      'copy_previous'
    )
  ),
  constraint budget_operation_receipts_key_length check (
    length(idempotency_key) between 8 and 180
  ),
  constraint budget_operation_receipts_result_object check (
    jsonb_typeof(result) = 'object'
  ),
  constraint budget_operation_receipts_user_key_unique unique (
    user_id,
    idempotency_key
  )
);

create index if not exists budget_operation_receipts_entity_idx
  on public.budget_operation_receipts (user_id, budget_id, created_at desc);

create table if not exists public.goal_operation_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete set null,
  operation text not null,
  idempotency_key text not null,
  request_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  constraint goal_operation_receipts_operation_known check (
    operation in (
      'create',
      'update',
      'archive',
      'pause',
      'resume',
      'restore',
      'link_box',
      'unlink_box'
    )
  ),
  constraint goal_operation_receipts_key_length check (
    length(idempotency_key) between 8 and 180
  ),
  constraint goal_operation_receipts_result_object check (
    jsonb_typeof(result) = 'object'
  ),
  constraint goal_operation_receipts_user_key_unique unique (
    user_id,
    idempotency_key
  )
);

create index if not exists goal_operation_receipts_entity_idx
  on public.goal_operation_receipts (user_id, goal_id, created_at desc);

-- RLS and grants -----------------------------------------------

alter table public.budgets enable row level security;
alter table public.goals enable row level security;
alter table public.budget_progress_snapshots enable row level security;
alter table public.budget_suggestion_decisions enable row level security;
alter table public.budget_operation_receipts enable row level security;
alter table public.goal_operation_receipts enable row level security;

create policy "budgets: select own"
  on public.budgets for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "goals: select own"
  on public.goals for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "budget_progress_snapshots: select own"
  on public.budget_progress_snapshots for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "budget_suggestion_decisions: select own"
  on public.budget_suggestion_decisions for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.budgets from anon, authenticated;
revoke all on public.goals from anon, authenticated;
revoke all on public.budget_progress_snapshots from anon, authenticated;
revoke all on public.budget_suggestion_decisions from anon, authenticated;
revoke all on public.budget_operation_receipts from anon, authenticated;
revoke all on public.goal_operation_receipts from anon, authenticated;

grant select on public.budgets to authenticated;
grant select on public.goals to authenticated;
grant select on public.budget_progress_snapshots to authenticated;
grant select on public.budget_suggestion_decisions to authenticated;

grant select, insert, update, delete on public.budgets to service_role;
grant select, insert, update, delete on public.goals to service_role;
grant select, insert, update, delete on public.budget_progress_snapshots
  to service_role;
grant select, insert, update, delete on public.budget_suggestion_decisions
  to service_role;
grant select, insert, update, delete on public.budget_operation_receipts
  to service_role;
grant select, insert, update, delete on public.goal_operation_receipts
  to service_role;

-- Progress and suggestion calculation -------------------------

create or replace function manzana.calculate_budget_spent(
  p_user_id uuid,
  p_category_id text,
  p_period_start date,
  p_period_end date
)
returns numeric
language sql
stable
security definer
set search_path = public, manzana
as $$
  select coalesce(round(sum(m.amount), 2), 0)::numeric(14,2)
  from public.movements m
  where m.user_id = p_user_id
    and m.currency = 'PEN'
    and m.status in (
      'confirmed'::public.movement_status,
      'needs_review'::public.movement_status,
      'corrected'::public.movement_status
    )
    and m.deleted_at is null
    and (m.occurred_at at time zone 'America/Lima')::date
      between p_period_start and p_period_end
    and (
      m.type in (
        'gasto'::public.movement_type,
        'pago_recurrente'::public.movement_type
      )
      or (
        m.type = 'pago_deuda'::public.movement_type
        and m.category_id = 'deudas'
        and (p_category_id is null or p_category_id = 'deudas')
      )
    )
    and (p_category_id is null or m.category_id = p_category_id);
$$;

create or replace function manzana.compute_budget_suggestion(
  p_user_id uuid,
  p_category_id text,
  p_period_kind public.budget_period,
  p_as_of date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, manzana, extensions
as $$
declare
  v_evidence jsonb;
  v_spent_cents bigint[];
  v_count integer;
  v_median_cents bigint;
  v_evidence_start date;
  v_evidence_end date;
  v_suggestion_key text;
begin
  if p_user_id is null
     or p_category_id is null
     or p_period_kind is null
     or p_as_of is null then
    return null;
  end if;

  with recursive complete_periods as (
    select
      1 as position,
      previous.period_start,
      previous.period_end
    from manzana.budget_period_bounds(p_period_kind, p_as_of) current_period
    cross join lateral manzana.budget_period_bounds(
      p_period_kind,
      current_period.period_start - 1
    ) previous

    union all

    select
      complete_periods.position + 1,
      previous.period_start,
      previous.period_end
    from complete_periods
    cross join lateral manzana.budget_period_bounds(
      p_period_kind,
      complete_periods.period_start - 1
    ) previous
    where complete_periods.position < 6
  ),
  samples as (
    select
      periods.period_start,
      periods.period_end,
      manzana.calculate_budget_spent(
        p_user_id,
        p_category_id,
        periods.period_start,
        periods.period_end
      ) as spent
    from complete_periods periods
  ),
  usable as (
    select *
    from samples
    where spent > 0
  )
  select
    jsonb_agg(
      jsonb_build_object(
        'period_start', period_start,
        'period_end', period_end,
        'spent', spent
      )
      order by period_start
    ),
    array_agg(round(spent * 100)::bigint order by spent),
    count(*)::integer,
    min(period_start),
    max(period_end)
  into
    v_evidence,
    v_spent_cents,
    v_count,
    v_evidence_start,
    v_evidence_end
  from usable;

  if coalesce(v_count, 0) < 2 then
    return null;
  end if;

  if v_count % 2 = 1 then
    v_median_cents := v_spent_cents[(v_count + 1) / 2];
  else
    v_median_cents := round(
      (
        v_spent_cents[v_count / 2]
        + v_spent_cents[v_count / 2 + 1]
      )::numeric / 2
    )::bigint;
  end if;

  v_suggestion_key := concat(
    'bs_',
    p_category_id,
    '_',
    p_period_kind::text,
    '_',
    v_evidence_start::text,
    '_',
    v_evidence_end::text
  );

  return jsonb_build_object(
    'suggestion_key', v_suggestion_key,
    'category_id', p_category_id,
    'period_kind', p_period_kind,
    'proposed_amount', (v_median_cents::numeric / 100)::numeric(14,2),
    'sample_count', v_count,
    'evidence_start', v_evidence_start,
    'evidence_end', v_evidence_end,
    'evidence', v_evidence
  );
end;
$$;

create or replace function manzana.get_budget_suggestions(
  p_user_id uuid,
  p_period_kind public.budget_period,
  p_as_of date
)
returns jsonb
language sql
stable
security definer
set search_path = public, manzana
as $$
  select coalesce(jsonb_agg(candidate order by category.sort_order), '[]'::jsonb)
  from public.categories category
  cross join lateral (
    select manzana.compute_budget_suggestion(
      p_user_id,
      category.id,
      p_period_kind,
      p_as_of
    ) as candidate
  ) computed
  where computed.candidate is not null
    and not exists (
      select 1
      from public.budget_suggestion_decisions decision
      where decision.user_id = p_user_id
        and decision.suggestion_key = computed.candidate->>'suggestion_key'
    );
$$;

-- Budget Core --------------------------------------------------

create or replace function manzana.commit_budget_operation(
  p_operation text,
  p_budget_id uuid,
  p_payload jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, manzana, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.budget_operation_receipts;
  v_budget public.budgets;
  v_previous public.budgets;
  v_created public.budgets;
  v_request_hash text;
  v_trace_id uuid;
  v_today date := (now() at time zone 'America/Lima')::date;
  v_date date;
  v_period_kind public.budget_period;
  v_new_period_kind public.budget_period;
  v_kind public.budget_kind;
  v_source public.budget_source;
  v_period_start date;
  v_period_end date;
  v_previous_start date;
  v_previous_end date;
  v_category_id text;
  v_base_amount numeric(14,2);
  v_rollover_amount numeric(14,2);
  v_spent numeric(14,2);
  v_rollover boolean;
  v_auto_renew boolean;
  v_event_type text;
  v_result jsonb;
  v_copied jsonb := '[]'::jsonb;
  v_previous_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_operation is null or p_operation not in (
    'create',
    'update',
    'archive',
    'pause',
    'resume',
    'restore',
    'copy_previous'
  ) then
    raise exception 'BUDGET_OPERATION_INVALID';
  end if;

  if coalesce(jsonb_typeof(p_payload), 'null') <> 'object' then
    raise exception 'BUDGET_OPERATION_INVALID';
  end if;

  if nullif(btrim(p_idempotency_key), '') is null
     or length(p_idempotency_key) not between 8 and 180 then
    raise exception 'BUDGET_IDEMPOTENCY_KEY_REQUIRED';
  end if;

  if p_operation in ('create', 'copy_previous') and p_budget_id is not null then
    raise exception 'BUDGET_OPERATION_INVALID';
  end if;

  if p_operation not in ('create', 'copy_previous') and p_budget_id is null then
    raise exception 'BUDGET_OPERATION_INVALID';
  end if;

  begin
    v_trace_id := coalesce(
      nullif(p_payload->>'trace_id', '')::uuid,
      gen_random_uuid()
    );
  exception when invalid_text_representation then
    raise exception 'BUDGET_OPERATION_INVALID';
  end;

  v_request_hash := encode(
    extensions.digest(
      jsonb_build_object(
        'operation', p_operation,
        'budget_id', p_budget_id,
        'payload', p_payload - 'trace_id'
      )::text,
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || p_idempotency_key, 0)
  );

  select *
    into v_existing
    from public.budget_operation_receipts
   where user_id = v_user_id
     and idempotency_key = p_idempotency_key
   for update;

  if found then
    if v_existing.operation <> p_operation
       or v_existing.budget_id is distinct from p_budget_id
       or v_existing.request_hash <> v_request_hash then
      raise exception 'BUDGET_IDEMPOTENCY_CONFLICT';
    end if;
    return v_existing.result || jsonb_build_object('idempotent', true);
  end if;

  if p_operation = 'create' then
    begin
      v_base_amount := nullif(p_payload->>'amount', '')::numeric;
      v_period_kind := coalesce(
        nullif(p_payload->>'period_kind', '')::public.budget_period,
        'mensual'::public.budget_period
      );
      v_kind := coalesce(
        nullif(p_payload->>'kind', '')::public.budget_kind,
        'presupuesto'::public.budget_kind
      );
      v_source := coalesce(
        nullif(p_payload->>'source', '')::public.budget_source,
        'manual'::public.budget_source
      );
      v_date := coalesce(nullif(p_payload->>'date', '')::date, v_today);
      v_rollover := coalesce((p_payload->>'rollover')::boolean, false);
      v_auto_renew := coalesce((p_payload->>'auto_renew')::boolean, true);
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'BUDGET_OPERATION_INVALID';
    end;

    if v_base_amount is null or v_base_amount <= 0 then
      raise exception 'BUDGET_AMOUNT_INVALID';
    end if;
    if coalesce(p_payload->>'currency', 'PEN') <> 'PEN' then
      raise exception 'BUDGET_CURRENCY_UNSUPPORTED';
    end if;

    v_category_id := nullif(btrim(p_payload->>'category_id'), '');
    if v_category_id is not null
       and not exists (
         select 1 from public.categories where id = v_category_id
       ) then
      raise exception 'BUDGET_CATEGORY_NOT_FOUND';
    end if;

    select bounds.period_start, bounds.period_end
      into v_period_start, v_period_end
      from manzana.budget_period_bounds(v_period_kind, v_date) bounds;

    begin
      insert into public.budgets (
        user_id,
        category_id,
        currency,
        period_kind,
        period_start,
        period_end,
        base_amount,
        rollover_amount,
        amount,
        kind,
        rollover,
        auto_renew,
        source,
        status,
        metadata
      )
      values (
        v_user_id,
        v_category_id,
        'PEN',
        v_period_kind,
        v_period_start,
        v_period_end,
        round(v_base_amount, 2),
        0,
        round(v_base_amount, 2),
        v_kind,
        v_rollover,
        v_auto_renew,
        v_source,
        'activo',
        coalesce(p_payload->'metadata', '{}'::jsonb)
      )
      returning * into v_budget;
    exception when unique_violation then
      raise exception 'BUDGET_DUPLICATE';
    end;

    v_event_type := 'budget_created';
    v_result := jsonb_build_object(
      'budget', to_jsonb(v_budget),
      'idempotent', false
    );

  elsif p_operation = 'copy_previous' then
    begin
      v_period_kind := coalesce(
        nullif(p_payload->>'period_kind', '')::public.budget_period,
        'mensual'::public.budget_period
      );
      v_date := coalesce(nullif(p_payload->>'date', '')::date, v_today);
    exception when invalid_text_representation then
      raise exception 'BUDGET_OPERATION_INVALID';
    end;

    select bounds.period_start, bounds.period_end
      into v_period_start, v_period_end
      from manzana.budget_period_bounds(v_period_kind, v_date) bounds;

    select bounds.period_start, bounds.period_end
      into v_previous_start, v_previous_end
      from manzana.budget_period_bounds(
        v_period_kind,
        v_period_start - 1
      ) bounds;

    for v_previous in
      select distinct on (budget.category_id, budget.kind) budget.*
      from public.budgets budget
      where budget.user_id = v_user_id
        and budget.period_kind = v_period_kind
        and budget.period_start = v_previous_start
        and budget.period_end = v_previous_end
      order by
        budget.category_id,
        budget.kind,
        budget.updated_at desc,
        budget.created_at desc
    loop
      v_previous_count := v_previous_count + 1;
      v_spent := manzana.calculate_budget_spent(
        v_user_id,
        v_previous.category_id,
        v_previous.period_start,
        v_previous.period_end
      );
      v_rollover_amount := case
        when v_previous.rollover then greatest(
          v_previous.base_amount
          - greatest(v_spent - v_previous.rollover_amount, 0),
          0
        )
        else 0
      end;

      v_created := null;
      insert into public.budgets (
        user_id,
        category_id,
        currency,
        period_kind,
        period_start,
        period_end,
        base_amount,
        rollover_amount,
        amount,
        kind,
        rollover,
        auto_renew,
        source,
        status,
        metadata
      )
      values (
        v_user_id,
        v_previous.category_id,
        'PEN',
        v_period_kind,
        v_period_start,
        v_period_end,
        v_previous.base_amount,
        round(v_rollover_amount, 2),
        round(v_previous.base_amount + v_rollover_amount, 2),
        v_previous.kind,
        v_previous.rollover,
        v_previous.auto_renew,
        'manual',
        'activo',
        coalesce(v_previous.metadata, '{}'::jsonb)
          || jsonb_build_object(
            'copied_from_budget_id', v_previous.id,
            'copied_at', now()
          )
      )
      on conflict do nothing
      returning * into v_created;

      if v_created.id is not null then
        v_copied := v_copied || jsonb_build_array(to_jsonb(v_created));

        insert into public.transactional_outbox (
          user_id,
          event_type,
          aggregate_type,
          aggregate_id,
          payload,
          trace_id,
          metadata
        )
        values (
          v_user_id,
          'budget_copied',
          'budget',
          v_created.id,
          jsonb_build_object(
            'budget_id', v_created.id,
            'copied_from_budget_id', v_previous.id,
            'idempotency_key', p_idempotency_key
          ),
          v_trace_id,
          jsonb_build_object('source', 'budget_core.operation_v1')
        );

        insert into public.transactional_outbox (
          user_id,
          event_type,
          aggregate_type,
          aggregate_id,
          payload,
          trace_id,
          metadata
        )
        values (
          v_user_id,
          'budget_recalculation_requested',
          'budget',
          v_created.id,
          jsonb_build_object(
            'budget_id', v_created.id,
            'reason', 'copied'
          ),
          v_trace_id,
          jsonb_build_object('source', 'budget_core.operation_v1')
        );
      end if;
    end loop;

    if v_previous_count = 0 then
      raise exception 'BUDGET_PREVIOUS_PERIOD_NOT_FOUND';
    end if;

    v_result := jsonb_build_object(
      'budgets', v_copied,
      'idempotent', false
    );

  else
    select *
      into v_budget
      from public.budgets
     where id = p_budget_id
       and user_id = v_user_id
     for update;

    if not found then
      raise exception 'BUDGET_NOT_FOUND';
    end if;

    if p_operation = 'update' then
      if v_budget.status = 'archivado'
         or v_budget.period_end < v_today then
        raise exception 'BUDGET_PERIOD_CLOSED';
      end if;

      v_base_amount := v_budget.base_amount;
      v_kind := v_budget.kind;
      v_rollover := v_budget.rollover;
      v_auto_renew := v_budget.auto_renew;
      v_new_period_kind := v_budget.period_kind;

      begin
        if p_payload ? 'amount' then
          v_base_amount := nullif(p_payload->>'amount', '')::numeric;
        end if;
        if p_payload ? 'kind' then
          v_kind := nullif(p_payload->>'kind', '')::public.budget_kind;
        end if;
        if p_payload ? 'rollover' then
          v_rollover := (p_payload->>'rollover')::boolean;
        end if;
        if p_payload ? 'auto_renew' then
          v_auto_renew := (p_payload->>'auto_renew')::boolean;
        end if;
        if p_payload ? 'period_kind' then
          v_new_period_kind :=
            nullif(p_payload->>'period_kind', '')::public.budget_period;
        end if;
      exception
        when invalid_text_representation or numeric_value_out_of_range then
          raise exception 'BUDGET_OPERATION_INVALID';
      end;

      if v_base_amount is null or v_base_amount <= 0 then
        raise exception 'BUDGET_AMOUNT_INVALID';
      end if;

      if v_new_period_kind <> v_budget.period_kind then
        v_date := coalesce(
          nullif(p_payload->>'date', '')::date,
          v_today
        );
        select bounds.period_start, bounds.period_end
          into v_period_start, v_period_end
          from manzana.budget_period_bounds(v_new_period_kind, v_date) bounds;

        update public.budgets
           set status = 'archivado',
               deleted_at = now(),
               metadata = metadata || jsonb_build_object(
                 'period_kind_replaced_at', now()
               )
         where id = v_budget.id;

        begin
          insert into public.budgets (
            user_id,
            category_id,
            currency,
            period_kind,
            period_start,
            period_end,
            base_amount,
            rollover_amount,
            amount,
            kind,
            rollover,
            auto_renew,
            source,
            status,
            metadata
          )
          values (
            v_user_id,
            v_budget.category_id,
            'PEN',
            v_new_period_kind,
            v_period_start,
            v_period_end,
            round(v_base_amount, 2),
            0,
            round(v_base_amount, 2),
            v_kind,
            v_rollover,
            v_auto_renew,
            v_budget.source,
            'activo',
            v_budget.metadata || jsonb_build_object(
              'replaces_budget_id', v_budget.id,
              'period_kind_replaced_at', now()
            )
          )
          returning * into v_created;
        exception when unique_violation then
          raise exception 'BUDGET_DUPLICATE';
        end;

        update public.budgets
           set metadata = metadata || jsonb_build_object(
             'replaced_by_budget_id', v_created.id
           )
         where id = v_budget.id;

        v_budget := v_created;
        v_event_type := 'budget_period_replaced';
      else
        begin
          update public.budgets
             set base_amount = round(v_base_amount, 2),
                 amount = round(v_base_amount + rollover_amount, 2),
                 kind = v_kind,
                 rollover = v_rollover,
                 auto_renew = v_auto_renew
           where id = v_budget.id
             and user_id = v_user_id
           returning * into v_budget;
        exception when unique_violation then
          raise exception 'BUDGET_DUPLICATE';
        end;
        v_event_type := 'budget_updated';
      end if;

    elsif p_operation = 'archive' then
      if v_budget.status = 'archivado' then
        raise exception 'BUDGET_STATE_CONFLICT';
      end if;
      update public.budgets
         set status = 'archivado',
             deleted_at = now()
       where id = v_budget.id
       returning * into v_budget;
      v_event_type := 'budget_archived';

    elsif p_operation = 'pause' then
      if v_budget.status <> 'activo' then
        raise exception 'BUDGET_STATE_CONFLICT';
      end if;
      update public.budgets
         set status = 'pausado'
       where id = v_budget.id
       returning * into v_budget;
      v_event_type := 'budget_paused';

    elsif p_operation = 'resume' then
      if v_budget.status <> 'pausado' then
        raise exception 'BUDGET_STATE_CONFLICT';
      end if;
      begin
        update public.budgets
           set status = 'activo'
         where id = v_budget.id
         returning * into v_budget;
      exception when unique_violation then
        raise exception 'BUDGET_DUPLICATE';
      end;
      v_event_type := 'budget_resumed';

    elsif p_operation = 'restore' then
      if v_budget.status <> 'archivado' then
        raise exception 'BUDGET_STATE_CONFLICT';
      end if;
      if v_budget.period_end < v_today then
        raise exception 'BUDGET_PERIOD_CLOSED';
      end if;
      begin
        update public.budgets
           set status = 'activo',
               deleted_at = null
         where id = v_budget.id
         returning * into v_budget;
      exception when unique_violation then
        raise exception 'BUDGET_DUPLICATE';
      end;
      v_event_type := 'budget_restored';
    end if;

    v_result := jsonb_build_object(
      'budget', to_jsonb(v_budget),
      'idempotent', false
    );
  end if;

  if p_operation <> 'copy_previous' then
    insert into public.transactional_outbox (
      user_id,
      event_type,
      aggregate_type,
      aggregate_id,
      payload,
      trace_id,
      metadata
    )
    values (
      v_user_id,
      v_event_type,
      'budget',
      v_budget.id,
      jsonb_build_object(
        'budget_id', v_budget.id,
        'operation', p_operation,
        'idempotency_key', p_idempotency_key
      ),
      v_trace_id,
      jsonb_build_object('source', 'budget_core.operation_v1')
    );

    if v_budget.status = 'activo' then
      insert into public.transactional_outbox (
        user_id,
        event_type,
        aggregate_type,
        aggregate_id,
        payload,
        trace_id,
        metadata
      )
      values (
        v_user_id,
        'budget_recalculation_requested',
        'budget',
        v_budget.id,
        jsonb_build_object(
          'budget_id', v_budget.id,
          'reason', p_operation
        ),
        v_trace_id,
        jsonb_build_object('source', 'budget_core.operation_v1')
      );
    end if;
  end if;

  insert into public.budget_operation_receipts (
    user_id,
    budget_id,
    operation,
    idempotency_key,
    request_hash,
    result
  )
  values (
    v_user_id,
    p_budget_id,
    p_operation,
    p_idempotency_key,
    v_request_hash,
    v_result
  );

  return v_result;
end;
$$;

-- Goal Core ----------------------------------------------------

create or replace function manzana.commit_goal_operation(
  p_operation text,
  p_goal_id uuid,
  p_payload jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, manzana, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.goal_operation_receipts;
  v_goal public.goals;
  v_box public.boxes;
  v_request_hash text;
  v_trace_id uuid;
  v_today date := (now() at time zone 'America/Lima')::date;
  v_name text;
  v_target_amount numeric(14,2);
  v_target_date date;
  v_box_id uuid;
  v_box_currency text;
  v_event_type text;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_operation is null or p_operation not in (
    'create',
    'update',
    'archive',
    'pause',
    'resume',
    'restore',
    'link_box',
    'unlink_box'
  ) then
    raise exception 'GOAL_OPERATION_INVALID';
  end if;

  if coalesce(jsonb_typeof(p_payload), 'null') <> 'object' then
    raise exception 'GOAL_OPERATION_INVALID';
  end if;

  if nullif(btrim(p_idempotency_key), '') is null
     or length(p_idempotency_key) not between 8 and 180 then
    raise exception 'GOAL_IDEMPOTENCY_KEY_REQUIRED';
  end if;

  if p_operation = 'create' and p_goal_id is not null then
    raise exception 'GOAL_OPERATION_INVALID';
  end if;
  if p_operation <> 'create' and p_goal_id is null then
    raise exception 'GOAL_OPERATION_INVALID';
  end if;

  begin
    v_trace_id := coalesce(
      nullif(p_payload->>'trace_id', '')::uuid,
      gen_random_uuid()
    );
  exception when invalid_text_representation then
    raise exception 'GOAL_OPERATION_INVALID';
  end;

  v_request_hash := encode(
    extensions.digest(
      jsonb_build_object(
        'operation', p_operation,
        'goal_id', p_goal_id,
        'payload', p_payload - 'trace_id'
      )::text,
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || p_idempotency_key, 0)
  );

  select *
    into v_existing
    from public.goal_operation_receipts
   where user_id = v_user_id
     and idempotency_key = p_idempotency_key
   for update;

  if found then
    if v_existing.operation <> p_operation
       or v_existing.goal_id is distinct from p_goal_id
       or v_existing.request_hash <> v_request_hash then
      raise exception 'GOAL_IDEMPOTENCY_CONFLICT';
    end if;
    return v_existing.result || jsonb_build_object('idempotent', true);
  end if;

  if p_operation = 'create' then
    v_name := btrim(coalesce(p_payload->>'name', ''));
    begin
      v_target_amount := nullif(p_payload->>'target_amount', '')::numeric;
      v_target_date := nullif(p_payload->>'target_date', '')::date;
      v_box_id := nullif(p_payload->>'box_id', '')::uuid;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'GOAL_OPERATION_INVALID';
    end;

    if length(v_name) not between 1 and 60 then
      raise exception 'GOAL_NAME_INVALID';
    end if;
    if v_target_amount is null or v_target_amount <= 0 then
      raise exception 'GOAL_AMOUNT_INVALID';
    end if;
    if v_target_date is not null and v_target_date <= v_today then
      raise exception 'GOAL_TARGET_DATE_INVALID';
    end if;
    if coalesce(p_payload->>'currency', 'PEN') <> 'PEN' then
      raise exception 'GOAL_CURRENCY_UNSUPPORTED';
    end if;

    begin
      insert into public.goals (
        user_id,
        name,
        target_amount,
        target_date,
        box_id,
        currency,
        status,
        metadata
      )
      values (
        v_user_id,
        v_name,
        round(v_target_amount, 2),
        v_target_date,
        null,
        'PEN',
        'activa',
        coalesce(p_payload->'metadata', '{}'::jsonb)
      )
      returning * into v_goal;
    exception when unique_violation then
      raise exception 'GOAL_DUPLICATE';
    end;

    if v_box_id is not null then
      select box_row.*
        into v_box
        from public.boxes box_row
        join public.accounts account on account.id = box_row.account_id
       where box_row.id = v_box_id
         and box_row.user_id = v_user_id
         and box_row.deleted_at is null
         and account.user_id = v_user_id
         and account.deleted_at is null
       for update of box_row;

      if not found then
        raise exception 'GOAL_BOX_NOT_FOUND';
      end if;
      select currency
        into v_box_currency
        from public.accounts
       where id = v_box.account_id;
      if v_box.type <> 'objetivo'::public.box_type
         or v_box_currency <> 'PEN' then
        raise exception 'GOAL_BOX_INVALID';
      end if;
      if exists (
        select 1
        from public.goals other_goal
        where other_goal.box_id = v_box_id
          and other_goal.status <> 'archivada'
          and other_goal.id <> v_goal.id
      ) then
        raise exception 'GOAL_BOX_ALREADY_LINKED';
      end if;

      update public.boxes
         set target_amount = round(v_target_amount, 2),
             target_date = v_target_date
       where id = v_box_id
         and user_id = v_user_id;

      update public.goals
         set box_id = v_box_id
       where id = v_goal.id
       returning * into v_goal;
    end if;

    v_event_type := 'goal_created';

  else
    select *
      into v_goal
      from public.goals
     where id = p_goal_id
       and user_id = v_user_id
     for update;

    if not found then
      raise exception 'GOAL_NOT_FOUND';
    end if;

    if p_operation = 'update' then
      if v_goal.status = 'archivada' then
        raise exception 'GOAL_STATE_CONFLICT';
      end if;

      v_name := v_goal.name;
      v_target_amount := v_goal.target_amount;
      v_target_date := v_goal.target_date;

      begin
        if p_payload ? 'name' then
          v_name := btrim(coalesce(p_payload->>'name', ''));
        end if;
        if p_payload ? 'target_amount' then
          v_target_amount :=
            nullif(p_payload->>'target_amount', '')::numeric;
        end if;
        if p_payload ? 'target_date' then
          v_target_date := nullif(p_payload->>'target_date', '')::date;
        end if;
      exception
        when invalid_text_representation or numeric_value_out_of_range then
          raise exception 'GOAL_OPERATION_INVALID';
      end;

      if length(v_name) not between 1 and 60 then
        raise exception 'GOAL_NAME_INVALID';
      end if;
      if v_target_amount is null or v_target_amount <= 0 then
        raise exception 'GOAL_AMOUNT_INVALID';
      end if;
      if p_payload ? 'target_date'
         and v_target_date is not null
         and v_target_date <= v_today then
        raise exception 'GOAL_TARGET_DATE_INVALID';
      end if;

      if v_goal.box_id is not null then
        select box_row.*
          into v_box
          from public.boxes box_row
          join public.accounts account on account.id = box_row.account_id
         where box_row.id = v_goal.box_id
           and box_row.user_id = v_user_id
           and box_row.deleted_at is null
           and account.user_id = v_user_id
           and account.deleted_at is null
         for update of box_row;

        if not found then
          update public.goals
             set box_id = null
           where id = v_goal.id
           returning * into v_goal;
        else
          select currency
            into v_box_currency
            from public.accounts
           where id = v_box.account_id;
          update public.boxes
             set target_amount = round(v_target_amount, 2),
                 target_date = v_target_date
           where id = v_box.id
             and user_id = v_user_id;
        end if;
      end if;

      begin
        update public.goals
           set name = v_name,
               target_amount = round(v_target_amount, 2),
               target_date = v_target_date
         where id = v_goal.id
           and user_id = v_user_id
         returning * into v_goal;
      exception when unique_violation then
        raise exception 'GOAL_DUPLICATE';
      end;

      v_event_type := 'goal_updated';

    elsif p_operation = 'archive' then
      if v_goal.status = 'archivada' then
        raise exception 'GOAL_STATE_CONFLICT';
      end if;
      update public.goals
         set status = 'archivada',
             deleted_at = now()
       where id = v_goal.id
       returning * into v_goal;
      v_event_type := 'goal_archived';

    elsif p_operation = 'pause' then
      if v_goal.status not in ('activa', 'alcanzada') then
        raise exception 'GOAL_STATE_CONFLICT';
      end if;
      update public.goals
         set status = 'pausada'
       where id = v_goal.id
       returning * into v_goal;
      v_event_type := 'goal_paused';

    elsif p_operation = 'resume' then
      if v_goal.status <> 'pausada' then
        raise exception 'GOAL_STATE_CONFLICT';
      end if;
      begin
        update public.goals
           set status = case
             when v_goal.box_id is not null
              and exists (
                select 1
                from public.boxes linked_box
                where linked_box.id = v_goal.box_id
                  and linked_box.user_id = v_user_id
                  and linked_box.deleted_at is null
                  and linked_box.current_balance >= v_goal.target_amount
              )
               then 'alcanzada'::public.goal_status
             else 'activa'::public.goal_status
           end
         where id = v_goal.id
         returning * into v_goal;
      exception when unique_violation then
        if v_goal.box_id is not null then
          raise exception 'GOAL_BOX_ALREADY_LINKED';
        end if;
        raise exception 'GOAL_DUPLICATE';
      end;
      v_event_type := 'goal_resumed';

    elsif p_operation = 'restore' then
      if v_goal.status <> 'archivada' then
        raise exception 'GOAL_STATE_CONFLICT';
      end if;
      if exists (
        select 1
        from public.goals other_goal
        where other_goal.user_id = v_user_id
          and lower(other_goal.name) = lower(v_goal.name)
          and other_goal.status <> 'archivada'
          and other_goal.id <> v_goal.id
      ) then
        raise exception 'GOAL_DUPLICATE';
      end if;
      if v_goal.box_id is not null
         and exists (
           select 1
           from public.goals other_goal
           where other_goal.box_id = v_goal.box_id
             and other_goal.status <> 'archivada'
             and other_goal.id <> v_goal.id
         ) then
        raise exception 'GOAL_BOX_ALREADY_LINKED';
      end if;
      update public.goals
         set status = 'activa',
             deleted_at = null
       where id = v_goal.id
       returning * into v_goal;
      v_event_type := 'goal_restored';

    elsif p_operation = 'link_box' then
      if v_goal.status = 'archivada' then
        raise exception 'GOAL_STATE_CONFLICT';
      end if;
      begin
        v_box_id := nullif(p_payload->>'box_id', '')::uuid;
      exception when invalid_text_representation then
        raise exception 'GOAL_OPERATION_INVALID';
      end;
      if v_box_id is null then
        raise exception 'GOAL_BOX_NOT_FOUND';
      end if;

      select box_row.*
        into v_box
        from public.boxes box_row
        join public.accounts account on account.id = box_row.account_id
       where box_row.id = v_box_id
         and box_row.user_id = v_user_id
         and box_row.deleted_at is null
         and account.user_id = v_user_id
         and account.deleted_at is null
       for update of box_row;

      if not found then
        raise exception 'GOAL_BOX_NOT_FOUND';
      end if;
      select currency
        into v_box_currency
        from public.accounts
       where id = v_box.account_id;
      if v_box.type <> 'objetivo'::public.box_type
         or v_box_currency <> 'PEN' then
        raise exception 'GOAL_BOX_INVALID';
      end if;
      if exists (
        select 1
        from public.goals other_goal
        where other_goal.box_id = v_box_id
          and other_goal.status <> 'archivada'
          and other_goal.id <> v_goal.id
      ) then
        raise exception 'GOAL_BOX_ALREADY_LINKED';
      end if;

      update public.boxes
         set target_amount = v_goal.target_amount,
             target_date = v_goal.target_date
       where id = v_box_id
         and user_id = v_user_id;

      begin
        update public.goals
           set box_id = v_box_id
         where id = v_goal.id
         returning * into v_goal;
      exception when unique_violation then
        raise exception 'GOAL_BOX_ALREADY_LINKED';
      end;
      v_event_type := 'goal_box_linked';

    elsif p_operation = 'unlink_box' then
      if v_goal.status = 'archivada' or v_goal.box_id is null then
        raise exception 'GOAL_STATE_CONFLICT';
      end if;
      update public.goals
         set box_id = null
       where id = v_goal.id
       returning * into v_goal;
      v_event_type := 'goal_box_unlinked';
    end if;
  end if;

  v_result := jsonb_build_object(
    'goal', to_jsonb(v_goal),
    'idempotent', false
  );

  insert into public.transactional_outbox (
    user_id,
    event_type,
    aggregate_type,
    aggregate_id,
    payload,
    trace_id,
    metadata
  )
  values (
    v_user_id,
    v_event_type,
    'goal',
    v_goal.id,
    jsonb_strip_nulls(
      jsonb_build_object(
        'goal_id', v_goal.id,
        'box_id', v_goal.box_id,
        'operation', p_operation,
        'idempotency_key', p_idempotency_key
      )
    ),
    v_trace_id,
    jsonb_build_object('source', 'goal_core.operation_v1')
  );

  insert into public.goal_operation_receipts (
    user_id,
    goal_id,
    operation,
    idempotency_key,
    request_hash,
    result
  )
  values (
    v_user_id,
    p_goal_id,
    p_operation,
    p_idempotency_key,
    v_request_hash,
    v_result
  );

  return v_result;
end;
$$;

-- Deterministic suggestion resolution -------------------------

create or replace function manzana.resolve_budget_suggestion(
  p_suggestion_key text,
  p_resolution text,
  p_payload jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, manzana, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.budget_suggestion_decisions;
  v_candidate jsonb;
  v_budget_result jsonb;
  v_budget_id uuid;
  v_decision_id uuid := gen_random_uuid();
  v_request_hash text;
  v_trace_id uuid;
  v_as_of date;
  v_category_id text;
  v_period_kind public.budget_period;
  v_amount numeric(14,2);
  v_result jsonb;
  v_key_parts text[];
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_resolution not in ('accepted', 'dismissed') then
    raise exception 'BUDGET_SUGGESTION_RESOLUTION_INVALID';
  end if;
  if coalesce(jsonb_typeof(p_payload), 'null') <> 'object' then
    raise exception 'BUDGET_SUGGESTION_INVALID';
  end if;
  if nullif(btrim(p_suggestion_key), '') is null then
    raise exception 'BUDGET_SUGGESTION_NOT_FOUND';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null
     or length(p_idempotency_key) not between 8 and 180 then
    raise exception 'BUDGET_IDEMPOTENCY_KEY_REQUIRED';
  end if;

  begin
    v_trace_id := coalesce(
      nullif(p_payload->>'trace_id', '')::uuid,
      gen_random_uuid()
    );
    v_as_of := coalesce(
      nullif(p_payload->>'date', '')::date,
      (now() at time zone 'America/Lima')::date
    );
    v_period_kind :=
      nullif(p_payload->>'period_kind', '')::public.budget_period;
    v_amount := nullif(p_payload->>'amount', '')::numeric;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'BUDGET_SUGGESTION_INVALID';
  end;

  v_category_id := nullif(btrim(p_payload->>'category_id'), '');
  if v_category_id is null or v_period_kind is null then
    select regexp_matches(
      p_suggestion_key,
      '^bs_(.+)_(semanal|quincenal|mensual)_([0-9]{4}-[0-9]{2}-[0-9]{2})_([0-9]{4}-[0-9]{2}-[0-9]{2})$'
    )
      into v_key_parts;

    if v_key_parts is not null then
      v_category_id := coalesce(v_category_id, v_key_parts[1]);
      v_period_kind := coalesce(
        v_period_kind,
        v_key_parts[2]::public.budget_period
      );
    end if;
  end if;
  if v_category_id is null or v_period_kind is null then
    raise exception 'BUDGET_SUGGESTION_INVALID';
  end if;

  v_request_hash := encode(
    extensions.digest(
      jsonb_build_object(
        'suggestion_key', p_suggestion_key,
        'resolution', p_resolution,
        'payload', p_payload - 'trace_id'
      )::text,
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || p_idempotency_key, 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || p_suggestion_key, 0)
  );

  select *
    into v_existing
    from public.budget_suggestion_decisions
   where user_id = v_user_id
     and idempotency_key = p_idempotency_key
   for update;

  if found then
    if v_existing.suggestion_key <> p_suggestion_key
       or v_existing.resolution <> p_resolution
       or v_existing.request_hash <> v_request_hash then
      raise exception 'BUDGET_SUGGESTION_IDEMPOTENCY_CONFLICT';
    end if;
    return v_existing.result || jsonb_build_object('idempotent', true);
  end if;

  select *
    into v_existing
    from public.budget_suggestion_decisions
   where user_id = v_user_id
     and suggestion_key = p_suggestion_key
   for update;

  if found then
    if v_existing.resolution <> p_resolution then
      raise exception 'BUDGET_SUGGESTION_ALREADY_RESOLVED';
    end if;
    return v_existing.result || jsonb_build_object('idempotent', true);
  end if;

  v_candidate := manzana.compute_budget_suggestion(
    v_user_id,
    v_category_id,
    v_period_kind,
    v_as_of
  );

  if v_candidate is null
     or v_candidate->>'suggestion_key' <> p_suggestion_key then
    raise exception 'BUDGET_SUGGESTION_NOT_FOUND';
  end if;

  if p_resolution = 'accepted' then
    v_amount := coalesce(
      v_amount,
      (v_candidate->>'proposed_amount')::numeric
    );
    if v_amount <= 0 then
      raise exception 'BUDGET_AMOUNT_INVALID';
    end if;

    v_budget_result := manzana.commit_budget_operation(
      'create',
      null,
      jsonb_strip_nulls(
        jsonb_build_object(
          'amount', round(v_amount, 2),
          'category_id', v_category_id,
          'period_kind', v_period_kind,
          'kind', coalesce(p_payload->>'kind', 'presupuesto'),
          'rollover', coalesce((p_payload->>'rollover')::boolean, false),
          'auto_renew', coalesce((p_payload->>'auto_renew')::boolean, true),
          'date', v_as_of,
          'currency', 'PEN',
          'source', 'sugerido',
          'trace_id', v_trace_id,
          'metadata', jsonb_build_object(
            'suggestion_key', p_suggestion_key,
            'suggestion_evidence', v_candidate->'evidence'
          )
        )
      ),
      p_idempotency_key
    );
    v_budget_id := (v_budget_result->'budget'->>'id')::uuid;
  end if;

  v_result := jsonb_strip_nulls(
    jsonb_build_object(
      'decision',
      jsonb_build_object(
        'id', v_decision_id,
        'suggestion_key', p_suggestion_key,
        'category_id', v_category_id,
        'period_kind', v_period_kind,
        'evidence_start', v_candidate->>'evidence_start',
        'evidence_end', v_candidate->>'evidence_end',
        'evidence', v_candidate->'evidence',
        'proposed_amount', v_candidate->'proposed_amount',
        'resolution', p_resolution,
        'budget_id', v_budget_id
      ),
      'budget', v_budget_result->'budget',
      'idempotent', false
    )
  );

  insert into public.budget_suggestion_decisions (
    id,
    user_id,
    suggestion_key,
    category_id,
    period_kind,
    evidence_start,
    evidence_end,
    evidence,
    proposed_amount,
    resolution,
    idempotency_key,
    request_hash,
    budget_id,
    result
  )
  values (
    v_decision_id,
    v_user_id,
    p_suggestion_key,
    v_category_id,
    v_period_kind,
    (v_candidate->>'evidence_start')::date,
    (v_candidate->>'evidence_end')::date,
    v_candidate->'evidence',
    (v_candidate->>'proposed_amount')::numeric,
    p_resolution,
    p_idempotency_key,
    v_request_hash,
    v_budget_id,
    v_result
  );

  insert into public.transactional_outbox (
    user_id,
    event_type,
    aggregate_type,
    aggregate_id,
    payload,
    trace_id,
    metadata
  )
  values (
    v_user_id,
    case
      when p_resolution = 'accepted' then 'budget_suggestion_accepted'
      else 'budget_suggestion_dismissed'
    end,
    'budget_suggestion',
    v_decision_id,
    jsonb_strip_nulls(
      jsonb_build_object(
        'decision_id', v_decision_id,
        'suggestion_key', p_suggestion_key,
        'category_id', v_category_id,
        'period_kind', v_period_kind,
        'resolution', p_resolution,
        'budget_id', v_budget_id
      )
    ),
    v_trace_id,
    jsonb_build_object('source', 'budget_core.suggestion_v1')
  );

  return v_result;
end;
$$;

-- Threshold worker primitives and daily lifecycle --------------

create or replace function manzana.refresh_budget_progress(
  p_budget_id uuid,
  p_as_of date,
  p_write_snapshot boolean,
  p_trace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_budget public.budgets;
  v_existing_snapshot public.budget_progress_snapshots;
  v_effective_as_of date;
  v_spent numeric(14,2);
  v_remaining numeric(14,2);
  v_pct numeric;
  v_threshold smallint;
  v_thresholds smallint[];
  v_new_thresholds smallint[] := '{}'::smallint[];
  v_snapshot_changed boolean := false;
begin
  select *
    into v_budget
    from public.budgets
   where id = p_budget_id
     and status = 'activo'
   for update;

  if not found or p_as_of is null or p_as_of < v_budget.period_start then
    return null;
  end if;

  v_effective_as_of := least(p_as_of, v_budget.period_end);
  v_spent := manzana.calculate_budget_spent(
    v_budget.user_id,
    v_budget.category_id,
    v_budget.period_start,
    v_budget.period_end
  );
  v_remaining := round(v_budget.amount - v_spent, 2);
  v_pct := round(v_spent / v_budget.amount, 4);

  if p_write_snapshot then
    select *
      into v_existing_snapshot
      from public.budget_progress_snapshots
     where budget_id = v_budget.id
       and as_of = v_effective_as_of
     for update;

    v_snapshot_changed :=
      not found
      or v_existing_snapshot.user_id <> v_budget.user_id
      or v_existing_snapshot.spent <> v_spent
      or v_existing_snapshot.remaining <> v_remaining
      or v_existing_snapshot.pct <> v_pct;

    insert into public.budget_progress_snapshots (
      user_id,
      budget_id,
      as_of,
      spent,
      remaining,
      pct
    )
    values (
      v_budget.user_id,
      v_budget.id,
      v_effective_as_of,
      v_spent,
      v_remaining,
      v_pct
    )
    on conflict (budget_id, as_of)
    do update
       set user_id = excluded.user_id,
           spent = excluded.spent,
           remaining = excluded.remaining,
           pct = excluded.pct;
  end if;

  v_thresholds := case v_budget.kind
    when 'presupuesto'::public.budget_kind
      then array[100]::smallint[]
    when 'limite_blando'::public.budget_kind
      then array[90, 100]::smallint[]
    when 'limite_duro'::public.budget_kind
      then array[70, 90, 100]::smallint[]
  end;

  foreach v_threshold in array v_thresholds
  loop
    if v_pct * 100 >= v_threshold
       and not (v_threshold = any(v_budget.alerted_thresholds)) then
      v_budget.alerted_thresholds :=
        array_append(v_budget.alerted_thresholds, v_threshold);
      v_new_thresholds := array_append(v_new_thresholds, v_threshold);

      insert into public.transactional_outbox (
        user_id,
        event_type,
        aggregate_type,
        aggregate_id,
        payload,
        trace_id,
        metadata
      )
      values (
        v_budget.user_id,
        'budget_threshold_crossed',
        'budget',
        v_budget.id,
        jsonb_build_object(
          'budget_id', v_budget.id,
          'threshold', v_threshold,
          'period_start', v_budget.period_start,
          'period_end', v_budget.period_end,
          'spent', v_spent,
          'amount', v_budget.amount,
          'pct', v_pct
        ),
        coalesce(p_trace_id, gen_random_uuid()),
        jsonb_build_object('source', 'budget_worker.threshold_v1')
      );
    end if;
  end loop;

  if cardinality(v_new_thresholds) > 0 then
    update public.budgets
       set alerted_thresholds = v_budget.alerted_thresholds
     where id = v_budget.id;
  end if;

  return jsonb_build_object(
    'budget_id', v_budget.id,
    'spent', v_spent,
    'remaining', v_remaining,
    'pct', v_pct,
    'as_of', v_effective_as_of,
    'snapshot_changed', v_snapshot_changed,
    'new_thresholds', to_jsonb(v_new_thresholds)
  );
end;
$$;

create or replace function manzana.run_budget_daily_lifecycle(
  p_as_of date,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_claim_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif((
      nullif(current_setting('request.jwt.claims', true), '')::jsonb
    )->>'role', ''),
    ''
  );
  v_as_of date := coalesce(
    p_as_of,
    (now() at time zone 'America/Lima')::date
  );
  v_budget public.budgets;
  v_new_budget public.budgets;
  v_goal public.goals;
  v_box public.boxes;
  v_progress jsonb;
  v_trace_id uuid;
  v_spent numeric(14,2);
  v_rollover_amount numeric(14,2);
  v_next_start date;
  v_next_end date;
  v_snapshot_changes integer := 0;
  v_threshold_events integer := 0;
  v_archived integer := 0;
  v_renewed integer := 0;
  v_goal_transitions integer := 0;
begin
  if v_claim_role <> 'service_role' then
    raise exception 'BUDGET_LIFECYCLE_SERVICE_ROLE_REQUIRED';
  end if;
  for v_budget in
    select budget.*
    from public.budgets budget
    where budget.status = 'activo'
      and budget.period_start <= v_as_of
      and (p_user_id is null or budget.user_id = p_user_id)
    order by budget.user_id, budget.period_start, budget.id
    for update skip locked
  loop
    v_trace_id := gen_random_uuid();
    v_progress := manzana.refresh_budget_progress(
      v_budget.id,
      v_as_of,
      true,
      v_trace_id
    );

    if coalesce((v_progress->>'snapshot_changed')::boolean, false) then
      v_snapshot_changes := v_snapshot_changes + 1;
    end if;
    v_threshold_events := v_threshold_events
      + coalesce(jsonb_array_length(v_progress->'new_thresholds'), 0);

    if v_budget.period_end < v_as_of then
      v_spent := (v_progress->>'spent')::numeric;

      update public.budgets
         set status = 'archivado',
             deleted_at = now(),
             metadata = metadata || jsonb_build_object(
               'closed_at', now(),
               'closed_spent', v_spent
             )
       where id = v_budget.id;
      v_archived := v_archived + 1;

      insert into public.transactional_outbox (
        user_id,
        event_type,
        aggregate_type,
        aggregate_id,
        payload,
        trace_id,
        metadata
      )
      values (
        v_budget.user_id,
        'budget_period_closed',
        'budget',
        v_budget.id,
        jsonb_build_object(
          'budget_id', v_budget.id,
          'period_start', v_budget.period_start,
          'period_end', v_budget.period_end,
          'spent', v_spent,
          'amount', v_budget.amount
        ),
        v_trace_id,
        jsonb_build_object('source', 'budget_worker.lifecycle_v1')
      );

      if v_budget.auto_renew then
        select bounds.period_start, bounds.period_end
          into v_next_start, v_next_end
          from manzana.budget_period_bounds(
            v_budget.period_kind,
            v_budget.period_end + 1
          ) bounds;

        v_rollover_amount := case
          when v_budget.rollover then greatest(
            v_budget.base_amount
            - greatest(v_spent - v_budget.rollover_amount, 0),
            0
          )
          else 0
        end;

        v_new_budget := null;
        insert into public.budgets (
          user_id,
          category_id,
          currency,
          period_kind,
          period_start,
          period_end,
          base_amount,
          rollover_amount,
          amount,
          kind,
          rollover,
          auto_renew,
          alerted_thresholds,
          source,
          status,
          metadata
        )
        values (
          v_budget.user_id,
          v_budget.category_id,
          'PEN',
          v_budget.period_kind,
          v_next_start,
          v_next_end,
          v_budget.base_amount,
          round(v_rollover_amount, 2),
          round(v_budget.base_amount + v_rollover_amount, 2),
          v_budget.kind,
          v_budget.rollover,
          v_budget.auto_renew,
          '{}'::smallint[],
          v_budget.source,
          'activo',
          coalesce(v_budget.metadata, '{}'::jsonb)
            - 'closed_at'
            - 'closed_spent'
            || jsonb_build_object(
              'renewed_from_budget_id', v_budget.id,
              'renewed_at', now()
            )
        )
        on conflict do nothing
        returning * into v_new_budget;

        if v_new_budget.id is not null then
          v_renewed := v_renewed + 1;

          insert into public.transactional_outbox (
            user_id,
            event_type,
            aggregate_type,
            aggregate_id,
            payload,
            trace_id,
            metadata
          )
          values (
            v_budget.user_id,
            'budget_period_renewed',
            'budget',
            v_new_budget.id,
            jsonb_build_object(
              'budget_id', v_new_budget.id,
              'renewed_from_budget_id', v_budget.id,
              'period_start', v_new_budget.period_start,
              'period_end', v_new_budget.period_end,
              'base_amount', v_new_budget.base_amount,
              'rollover_amount', v_new_budget.rollover_amount
            ),
            v_trace_id,
            jsonb_build_object('source', 'budget_worker.lifecycle_v1')
          );

          insert into public.transactional_outbox (
            user_id,
            event_type,
            aggregate_type,
            aggregate_id,
            payload,
            trace_id,
            metadata
          )
          values (
            v_budget.user_id,
            'budget_recalculation_requested',
            'budget',
            v_new_budget.id,
            jsonb_build_object(
              'budget_id', v_new_budget.id,
              'reason', 'renewed'
            ),
            v_trace_id,
            jsonb_build_object('source', 'budget_worker.lifecycle_v1')
          );
        end if;
      end if;
    end if;
  end loop;

  -- A linked goal consumes the target and target date of its objective box
  -- as canonical values. Only active/reached goals transition automatically.
  for v_goal in
    select goal.*
    from public.goals goal
    where goal.box_id is not null
      and goal.status in ('activa', 'alcanzada')
      and (p_user_id is null or goal.user_id = p_user_id)
    order by goal.user_id, goal.id
    for update skip locked
  loop
    select *
      into v_box
      from public.boxes
     where id = v_goal.box_id
       and user_id = v_goal.user_id
       and deleted_at is null
     for update;

    if not found then
      update public.goals
         set box_id = null,
             metadata = metadata || jsonb_build_object(
               'box_unlinked_at', now(),
               'box_unlinked_reason', 'box_not_active'
             )
       where id = v_goal.id;
      continue;
    end if;

    if v_box.target_amount is not null then
      update public.goals
         set target_amount = v_box.target_amount,
             target_date = v_box.target_date
       where id = v_goal.id;
      v_goal.target_amount := v_box.target_amount;
      v_goal.target_date := v_box.target_date;
    end if;

    if v_goal.status = 'activa'
       and v_box.current_balance >= v_goal.target_amount then
      update public.goals
         set status = 'alcanzada'
       where id = v_goal.id;
      v_goal_transitions := v_goal_transitions + 1;

      insert into public.transactional_outbox (
        user_id,
        event_type,
        aggregate_type,
        aggregate_id,
        payload,
        trace_id,
        metadata
      )
      values (
        v_goal.user_id,
        'goal_reached',
        'goal',
        v_goal.id,
        jsonb_build_object(
          'goal_id', v_goal.id,
          'box_id', v_box.id
        ),
        gen_random_uuid(),
        jsonb_build_object('source', 'budget_worker.lifecycle_v1')
      );

    elsif v_goal.status = 'alcanzada'
          and v_box.current_balance < v_goal.target_amount then
      update public.goals
         set status = 'activa'
       where id = v_goal.id;
      v_goal_transitions := v_goal_transitions + 1;

      insert into public.transactional_outbox (
        user_id,
        event_type,
        aggregate_type,
        aggregate_id,
        payload,
        trace_id,
        metadata
      )
      values (
        v_goal.user_id,
        'goal_reopened',
        'goal',
        v_goal.id,
        jsonb_build_object(
          'goal_id', v_goal.id,
          'box_id', v_box.id
        ),
        gen_random_uuid(),
        jsonb_build_object('source', 'budget_worker.lifecycle_v1')
      );
    end if;
  end loop;

  return jsonb_build_object(
    'as_of', v_as_of,
    'user_id', p_user_id,
    'snapshot_changes', v_snapshot_changes,
    'threshold_events', v_threshold_events,
    'archived', v_archived,
    'renewed', v_renewed,
    'goal_transitions', v_goal_transitions,
    'idempotent',
      v_snapshot_changes = 0
      and v_threshold_events = 0
      and v_archived = 0
      and v_renewed = 0
      and v_goal_transitions = 0
  );
end;
$$;

-- Every relevant movement mutation requests a budget recalculation. The
-- outbox event is a producer only; W-14 owns user-visible notifications.

create or replace function manzana.enqueue_budget_recalculation()
returns trigger
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_old_relevant boolean := false;
  v_new_relevant boolean := false;
begin
  if tg_op = 'UPDATE'
     and (
       new.type,
       new.status,
       new.amount,
       new.currency,
       new.occurred_at,
       new.category_id,
       new.deleted_at
     ) is not distinct from (
       old.type,
       old.status,
       old.amount,
       old.currency,
       old.occurred_at,
       old.category_id,
       old.deleted_at
     ) then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_old_relevant :=
      old.currency = 'PEN'
      and old.deleted_at is null
      and old.status in (
        'confirmed'::public.movement_status,
        'needs_review'::public.movement_status,
        'corrected'::public.movement_status
      )
      and old.type in (
        'gasto'::public.movement_type,
        'pago_recurrente'::public.movement_type,
        'pago_deuda'::public.movement_type
      );
  end if;

  v_new_relevant :=
    new.currency = 'PEN'
    and new.deleted_at is null
    and new.status in (
      'confirmed'::public.movement_status,
      'needs_review'::public.movement_status,
      'corrected'::public.movement_status
    )
    and new.type in (
      'gasto'::public.movement_type,
      'pago_recurrente'::public.movement_type,
      'pago_deuda'::public.movement_type
    );

  if not v_old_relevant and not v_new_relevant then
    return new;
  end if;

  insert into public.transactional_outbox (
    user_id,
    event_type,
    aggregate_type,
    aggregate_id,
    payload,
    trace_id,
    metadata
  )
  values (
    new.user_id,
    'budget_recalculation_requested',
    'movement',
    new.id,
    jsonb_strip_nulls(
      jsonb_build_object(
        'movement_id', new.id,
        'reason', lower(tg_op),
        'old_category_id',
          case when tg_op = 'UPDATE' then old.category_id else null end,
        'new_category_id', new.category_id,
        'occurred_at', new.occurred_at
      )
    ),
    gen_random_uuid(),
    jsonb_build_object('source', 'movements.budget_recalculation_v1')
  );

  return new;
end;
$$;

create trigger movements_enqueue_budget_recalculation
  after insert
  or update of type, status, amount, currency, occurred_at, category_id,
    deleted_at
  on public.movements
  for each row execute function manzana.enqueue_budget_recalculation();

-- Logical deletion of an objective box unlinks, but never deletes, goals.

create or replace function manzana.unlink_goals_from_deleted_box()
returns trigger
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_goal public.goals;
  v_trace_id uuid;
begin
  if old.deleted_at is null and new.deleted_at is not null then
    for v_goal in
      update public.goals
         set box_id = null,
             metadata = metadata || jsonb_build_object(
               'box_unlinked_at', now(),
               'box_unlinked_reason', 'box_deleted',
               'unlinked_box_id', new.id
             )
       where box_id = new.id
       returning *
    loop
      v_trace_id := gen_random_uuid();
      insert into public.transactional_outbox (
        user_id,
        event_type,
        aggregate_type,
        aggregate_id,
        payload,
        trace_id,
        metadata
      )
      values (
        v_goal.user_id,
        'goal_box_unlinked',
        'goal',
        v_goal.id,
        jsonb_build_object(
          'goal_id', v_goal.id,
          'box_id', new.id,
          'reason', 'box_deleted'
        ),
        v_trace_id,
        jsonb_build_object('source', 'boxes.goal_unlink_v1')
      );
    end loop;
  end if;
  return new;
end;
$$;

create trigger boxes_unlink_goals_after_soft_delete
  after update of deleted_at on public.boxes
  for each row
  when (old.deleted_at is null and new.deleted_at is not null)
  execute function manzana.unlink_goals_from_deleted_box();

-- Public PostgREST wrappers ------------------------------------
-- Local Supabase exposes `public`, not `manzana`; the internal functions
-- keep the requested domain names while these wrappers make them callable.

create or replace function public.commit_budget_operation(
  p_operation text,
  p_budget_id uuid,
  p_payload jsonb,
  p_idempotency_key text
)
returns jsonb
language sql
security definer
set search_path = public, manzana
as $$
  select manzana.commit_budget_operation(
    p_operation,
    p_budget_id,
    p_payload,
    p_idempotency_key
  );
$$;

create or replace function public.commit_goal_operation(
  p_operation text,
  p_goal_id uuid,
  p_payload jsonb,
  p_idempotency_key text
)
returns jsonb
language sql
security definer
set search_path = public, manzana
as $$
  select manzana.commit_goal_operation(
    p_operation,
    p_goal_id,
    p_payload,
    p_idempotency_key
  );
$$;

create or replace function public.run_budget_daily_lifecycle(
  p_as_of date,
  p_user_id uuid default null
)
returns jsonb
language sql
security definer
set search_path = public, manzana
as $$
  select manzana.run_budget_daily_lifecycle(p_as_of, p_user_id);
$$;

create or replace function public.resolve_budget_suggestion(
  p_suggestion_key text,
  p_resolution text,
  p_payload jsonb,
  p_idempotency_key text
)
returns jsonb
language sql
security definer
set search_path = public, manzana
as $$
  select manzana.resolve_budget_suggestion(
    p_suggestion_key,
    p_resolution,
    p_payload,
    p_idempotency_key
  );
$$;

create or replace function public.get_budget_suggestions(
  p_period_kind public.budget_period default 'mensual',
  p_as_of date default ((now() at time zone 'America/Lima')::date)
)
returns jsonb
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  return manzana.get_budget_suggestions(
    v_user_id,
    p_period_kind,
    p_as_of
  );
end;
$$;

revoke all on function manzana.valid_budget_thresholds(smallint[])
  from public, anon, authenticated;
revoke all on function manzana.budget_period_bounds(public.budget_period, date)
  from public, anon, authenticated;
revoke all on function manzana.valid_budget_period(
  public.budget_period,
  date,
  date
) from public, anon, authenticated;
revoke all on function manzana.calculate_budget_spent(uuid, text, date, date)
  from public, anon, authenticated;
revoke all on function manzana.compute_budget_suggestion(
  uuid,
  text,
  public.budget_period,
  date
) from public, anon, authenticated;
revoke all on function manzana.get_budget_suggestions(
  uuid,
  public.budget_period,
  date
) from public, anon, authenticated;
revoke all on function manzana.refresh_budget_progress(
  uuid,
  date,
  boolean,
  uuid
) from public, anon, authenticated;
revoke all on function manzana.enqueue_budget_recalculation()
  from public, anon, authenticated;
revoke all on function manzana.unlink_goals_from_deleted_box()
  from public, anon, authenticated;

revoke all on function manzana.commit_budget_operation(
  text,
  uuid,
  jsonb,
  text
) from public, anon, authenticated;
revoke all on function manzana.commit_goal_operation(
  text,
  uuid,
  jsonb,
  text
) from public, anon, authenticated;
revoke all on function manzana.run_budget_daily_lifecycle(date, uuid)
  from public, anon, authenticated;
revoke all on function manzana.resolve_budget_suggestion(
  text,
  text,
  jsonb,
  text
) from public, anon, authenticated;

revoke all on function public.commit_budget_operation(
  text,
  uuid,
  jsonb,
  text
) from public, anon, authenticated;
revoke all on function public.commit_goal_operation(
  text,
  uuid,
  jsonb,
  text
) from public, anon, authenticated;
revoke all on function public.run_budget_daily_lifecycle(date, uuid)
  from public, anon, authenticated;
revoke all on function public.resolve_budget_suggestion(
  text,
  text,
  jsonb,
  text
) from public, anon, authenticated;
revoke all on function public.get_budget_suggestions(
  public.budget_period,
  date
) from public, anon, authenticated;

grant usage on schema manzana to authenticated, service_role;

grant execute on function manzana.commit_budget_operation(
  text,
  uuid,
  jsonb,
  text
) to authenticated, service_role;
grant execute on function manzana.commit_goal_operation(
  text,
  uuid,
  jsonb,
  text
) to authenticated, service_role;
grant execute on function manzana.resolve_budget_suggestion(
  text,
  text,
  jsonb,
  text
) to authenticated, service_role;
grant execute on function manzana.run_budget_daily_lifecycle(date, uuid)
  to service_role;

grant execute on function public.commit_budget_operation(
  text,
  uuid,
  jsonb,
  text
) to authenticated, service_role;
grant execute on function public.commit_goal_operation(
  text,
  uuid,
  jsonb,
  text
) to authenticated, service_role;
grant execute on function public.resolve_budget_suggestion(
  text,
  text,
  jsonb,
  text
) to authenticated, service_role;
grant execute on function public.get_budget_suggestions(
  public.budget_period,
  date
) to authenticated, service_role;
grant execute on function public.run_budget_daily_lifecycle(date, uuid)
  to service_role;

comment on table public.budgets is
  'PEN budget references. They never reserve money or mutate balances.';
comment on table public.goals is
  'PEN savings intentions, optionally backed by one active objective box.';
comment on table public.budget_progress_snapshots is
  'Idempotent daily budget progress snapshots.';
comment on table public.budget_suggestion_decisions is
  'Persisted accepted/dismissed decisions for deterministic evidence windows.';
comment on function public.commit_budget_operation(text, uuid, jsonb, text) is
  'Authenticated, atomic and idempotent budget CRUD/lifecycle/copy Core.';
comment on function public.commit_goal_operation(text, uuid, jsonb, text) is
  'Authenticated, atomic and idempotent goal CRUD/lifecycle/link Core.';
comment on function public.run_budget_daily_lifecycle(date, uuid) is
  'Service-only daily snapshots, threshold producer, rollover and goal lifecycle.';
comment on function public.resolve_budget_suggestion(text, text, jsonb, text) is
  'Authenticated deterministic suggestion decision; acceptance reuses budget Core.';

commit;
