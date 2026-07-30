-- =============================================================
-- Migration 015: Recurring payments / Pagos que vienen
-- Corte 10 - Recurrentes V1 base + pagos via Core
-- Depends on: 001-014
-- =============================================================

create table if not exists public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.recurring_status not null default 'active',
  name text not null,
  merchant_pattern text,
  expected_amount numeric(14,2),
  amount_variability text not null default 'fixed',
  currency text not null default 'PEN',
  frequency text not null default 'monthly',
  day_of_month integer,
  date_window_start_day integer,
  date_window_end_day integer,
  next_expected_date date,
  category_id text references public.categories(id),
  subcategory_id uuid references public.user_subcategories(id),
  default_account_id uuid references public.accounts(id),
  linked_box_id uuid references public.boxes(id),
  linked_debt_id uuid references public.debts(id),
  source text not null default 'dashboard_manual',
  confidence numeric(4,3),
  requires_confirmation_for_payment boolean not null default true,
  last_paid_at timestamptz,
  last_paid_amount numeric(14,2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  cancelled_at timestamptz,

  constraint recurring_rules_expected_amount_positive
    check (expected_amount is null or expected_amount > 0),
  constraint recurring_rules_last_paid_amount_positive
    check (last_paid_amount is null or last_paid_amount > 0),
  constraint recurring_rules_currency_supported
    check (currency in ('PEN', 'USD')),
  constraint recurring_rules_amount_variability_known
    check (amount_variability in ('fixed', 'variable', 'estimated')),
  constraint recurring_rules_frequency_known
    check (frequency in ('weekly', 'biweekly', 'monthly', 'yearly', 'custom_window')),
  constraint recurring_rules_day_of_month_valid
    check (day_of_month is null or (day_of_month between 1 and 31)),
  constraint recurring_rules_window_start_valid
    check (date_window_start_day is null or (date_window_start_day between 1 and 31)),
  constraint recurring_rules_window_end_valid
    check (date_window_end_day is null or (date_window_end_day between 1 and 31)),
  constraint recurring_rules_window_order
    check (
      date_window_start_day is null
      or date_window_end_day is null
      or date_window_start_day <= date_window_end_day
    ),
  constraint recurring_rules_confidence_range
    check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create trigger recurring_rules_set_updated_at
  before update on public.recurring_rules
  for each row execute function manzana.set_updated_at();

create index if not exists recurring_rules_user_status_next_idx
  on public.recurring_rules (user_id, status, next_expected_date)
  where deleted_at is null;

create index if not exists recurring_rules_user_linked_box_idx
  on public.recurring_rules (user_id, linked_box_id)
  where linked_box_id is not null and deleted_at is null;

create table if not exists public.recurring_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recurring_rule_id uuid not null references public.recurring_rules(id) on delete cascade,
  expected_date date not null,
  expected_amount numeric(14,2),
  status public.recurring_occurrence_status not null default 'expected',
  paid_at timestamptz,
  paid_movement_id uuid references public.movements(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint recurring_occurrences_expected_amount_positive
    check (expected_amount is null or expected_amount > 0),
  constraint recurring_occurrences_paid_consistency
    check (
      (status = 'paid' and paid_at is not null and paid_movement_id is not null)
      or status <> 'paid'
    ),
  constraint recurring_occurrences_unique_rule_date
    unique (recurring_rule_id, expected_date)
);

create trigger recurring_occurrences_set_updated_at
  before update on public.recurring_occurrences
  for each row execute function manzana.set_updated_at();

create index if not exists recurring_occurrences_user_status_due_idx
  on public.recurring_occurrences (user_id, status, expected_date);

create unique index if not exists recurring_occurrences_paid_movement_unique_idx
  on public.recurring_occurrences (paid_movement_id)
  where paid_movement_id is not null;

create table if not exists public.recurring_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_key text not null,
  category_id text references public.categories(id),
  evidence jsonb not null default '{}'::jsonb,
  confidence numeric(5,4) not null,
  status public.recurring_candidate_status not null default 'candidate',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint recurring_candidates_confidence_range
    check (confidence >= 0 and confidence <= 1),
  constraint recurring_candidates_evidence_object
    check (jsonb_typeof(evidence) = 'object')
);

create trigger recurring_candidates_set_updated_at
  before update on public.recurring_candidates
  for each row execute function manzana.set_updated_at();

create index if not exists recurring_candidates_user_status_idx
  on public.recurring_candidates (user_id, status, confidence desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'boxes_linked_recurring_id_fkey'
      and conrelid = 'public.boxes'::regclass
  ) then
    alter table public.boxes
      add constraint boxes_linked_recurring_id_fkey
      foreign key (linked_recurring_id) references public.recurring_rules(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'movements_recurring_rule_id_fkey'
      and conrelid = 'public.movements'::regclass
  ) then
    alter table public.movements
      add constraint movements_recurring_rule_id_fkey
      foreign key (recurring_rule_id) references public.recurring_rules(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'movements_recurring_occurrence_id_fkey'
      and conrelid = 'public.movements'::regclass
  ) then
    alter table public.movements
      add constraint movements_recurring_occurrence_id_fkey
      foreign key (recurring_occurrence_id) references public.recurring_occurrences(id);
  end if;
end $$;

alter table public.recurring_rules enable row level security;
alter table public.recurring_occurrences enable row level security;
alter table public.recurring_candidates enable row level security;

create policy "recurring_rules: select own"
  on public.recurring_rules for select
  using (auth.uid() = user_id);

create policy "recurring_rules: no client write"
  on public.recurring_rules for all
  using (false)
  with check (false);

create policy "recurring_occurrences: select own"
  on public.recurring_occurrences for select
  using (auth.uid() = user_id);

create policy "recurring_occurrences: no client write"
  on public.recurring_occurrences for all
  using (false)
  with check (false);

create policy "recurring_candidates: select own"
  on public.recurring_candidates for select
  using (auth.uid() = user_id);

create policy "recurring_candidates: no client write"
  on public.recurring_candidates for all
  using (false)
  with check (false);

grant select on public.recurring_rules to authenticated;
grant select on public.recurring_occurrences to authenticated;
grant select on public.recurring_candidates to authenticated;

grant select, insert, update on public.recurring_rules to service_role;
grant select, insert, update on public.recurring_occurrences to service_role;
grant select, insert, update on public.recurring_candidates to service_role;

create or replace function manzana.next_recurring_date(
  p_base_date date,
  p_frequency text,
  p_day_of_month integer
)
returns date
language plpgsql
immutable
as $$
declare
  v_next_month date;
  v_target_day integer;
  v_last_day integer;
begin
  if p_frequency = 'weekly' then
    return p_base_date + 7;
  end if;

  if p_frequency = 'biweekly' then
    return p_base_date + 14;
  end if;

  if p_frequency = 'yearly' then
    return (p_base_date + interval '1 year')::date;
  end if;

  v_next_month := (date_trunc('month', p_base_date)::date + interval '1 month')::date;
  v_last_day := extract(day from (v_next_month + interval '1 month - 1 day'))::integer;
  v_target_day := least(coalesce(p_day_of_month, extract(day from p_base_date)::integer), v_last_day);

  return v_next_month + (v_target_day - 1);
end;
$$;

create or replace function manzana.commit_recurring_payment(
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
  v_rule public.recurring_rules;
  v_occurrence public.recurring_occurrences;
  v_existing_occurrence public.recurring_occurrences;
  v_movement public.movements;
  v_user_id uuid := (p_movement->>'user_id')::uuid;
  v_amount numeric := round((p_movement->>'amount')::numeric, 2);
  v_paid_at timestamptz := coalesce((p_movement->>'occurred_at')::timestamptz, now());
  v_next_date date;
begin
  select *
    into v_rule
    from public.recurring_rules
   where id = p_recurring_rule_id
     and user_id = v_user_id
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
     and user_id = v_user_id
   for update;

  if not found then
    raise exception 'RECURRING_OCCURRENCE_NOT_FOUND';
  end if;

  select *
    into v_movement
    from public.movements
   where user_id = v_user_id
     and idempotency_key = p_movement->>'idempotency_key';

  if found then
    select *
      into v_existing_occurrence
      from public.recurring_occurrences
     where user_id = v_user_id
       and paid_movement_id = v_movement.id;

    if not found
       or v_existing_occurrence.id <> v_occurrence.id
       or v_existing_occurrence.recurring_rule_id <> v_rule.id
       or (v_movement.metadata->'idempotency_payload')
            is distinct from
          (p_movement->'metadata'->'idempotency_payload') then
      raise exception 'RECURRING_PAYMENT_IDEMPOTENCY_CONFLICT';
    end if;

    return jsonb_build_object(
      'movement', to_jsonb(v_movement),
      'recurring_rule', to_jsonb(v_rule),
      'occurrence', to_jsonb(v_existing_occurrence),
      'idempotent', true
    );
  end if;

  if v_rule.status <> 'active' then
    raise exception 'RECURRING_RULE_NOT_ACTIVE';
  end if;

  if v_rule.linked_debt_id is not null then
    raise exception 'RECURRING_RULE_LINKED_DEBT_REQUIRES_DEBT_FLOW';
  end if;

  if v_occurrence.status = 'paid' then
    raise exception 'RECURRING_OCCURRENCE_ALREADY_PAID';
  end if;

  if v_occurrence.status in ('skipped', 'rejected') then
    raise exception 'RECURRING_OCCURRENCE_NOT_PAYABLE';
  end if;

  if v_amount <= 0 then
    raise exception 'RECURRING_PAYMENT_INVALID_AMOUNT';
  end if;

  if p_movement->>'type' <> 'pago_recurrente' then
    raise exception 'RECURRING_PAYMENT_MOVEMENT_TYPE_MISMATCH';
  end if;

  if p_movement->>'source' <> 'recurring_confirmed' then
    raise exception 'RECURRING_PAYMENT_SOURCE_MISMATCH';
  end if;

  if nullif(p_movement->>'recurring_rule_id', '')::uuid <> v_rule.id then
    raise exception 'RECURRING_PAYMENT_RULE_MISMATCH';
  end if;

  if nullif(p_movement->>'recurring_occurrence_id', '')::uuid <> v_occurrence.id then
    raise exception 'RECURRING_PAYMENT_OCCURRENCE_MISMATCH';
  end if;

  if p_movement->>'currency' <> v_rule.currency then
    raise exception 'RECURRING_PAYMENT_CURRENCY_MISMATCH';
  end if;

  v_movement := manzana.core_commit_movement_create(
    p_movement,
    p_audit_logs,
    p_account_deltas,
    p_box_deltas,
    p_movement_outbox_events
  );

  update public.recurring_occurrences
     set status = 'paid'::public.recurring_occurrence_status,
         paid_at = v_paid_at,
         paid_movement_id = v_movement.id,
         expected_amount = coalesce(expected_amount, v_amount),
         metadata = coalesce(metadata, '{}'::jsonb)
           || jsonb_build_object(
             'last_paid_amount', v_amount,
             'last_paid_movement_id', v_movement.id
           )
   where id = v_occurrence.id
     and user_id = v_user_id
   returning * into v_occurrence;

  v_next_date := manzana.next_recurring_date(
    greatest(v_occurrence.expected_date, v_paid_at::date),
    v_rule.frequency,
    v_rule.day_of_month
  );

  update public.recurring_rules
     set next_expected_date = v_next_date,
         last_paid_at = v_paid_at,
         last_paid_amount = v_amount,
         metadata = coalesce(metadata, '{}'::jsonb)
           || jsonb_build_object(
             'last_payment_movement_id', v_movement.id,
             'last_payment_occurrence_id', v_occurrence.id
           )
   where id = v_rule.id
     and user_id = v_user_id
   returning * into v_rule;

  perform manzana.insert_transactional_outbox_events(p_recurring_outbox_events);

  return jsonb_build_object(
    'movement', to_jsonb(v_movement),
    'recurring_rule', to_jsonb(v_rule),
    'occurrence', to_jsonb(v_occurrence),
    'idempotent', false
  );
end;
$$;

create or replace function public.commit_recurring_payment(
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
language sql
security definer
set search_path = public, manzana
as $$
  select manzana.commit_recurring_payment(
    p_recurring_rule_id,
    p_occurrence_id,
    p_movement,
    p_audit_logs,
    p_account_deltas,
    p_box_deltas,
    p_movement_outbox_events,
    p_recurring_outbox_events
  );
$$;

revoke all on function manzana.next_recurring_date(date, text, integer) from public, anon, authenticated;
revoke all on function manzana.commit_recurring_payment(
  uuid,
  uuid,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) from public, anon, authenticated;

revoke all on function public.commit_recurring_payment(
  uuid,
  uuid,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) from public, anon, authenticated;

grant execute on function public.commit_recurring_payment(
  uuid,
  uuid,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) to service_role;

comment on table public.recurring_rules is
  'Reglas de pagos recurrentes. Lo esperado anticipa compromisos, no mueve saldos.';

comment on table public.recurring_occurrences is
  'Ocurrencias esperadas de recurrentes. Solo paid con movimiento confirmado representa pago real.';

comment on function public.commit_recurring_payment(
  uuid,
  uuid,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) is
  'Marca una ocurrencia recurrente como pagada en una transaccion: movimiento Core, saldos opcionales, ocurrencia, regla y outbox.';
