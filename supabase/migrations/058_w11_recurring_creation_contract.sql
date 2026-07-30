-- =============================================================
-- Migration 058: W-11 recurring-rule creation contract
-- Variable rules may omit an estimate; manual creation is idempotent.
-- Depends on: 015, 056
-- =============================================================

alter table public.recurring_rules
  add column if not exists creation_idempotency_key text,
  add column if not exists creation_request_hash text;

alter table public.recurring_rules
  drop constraint if exists recurring_rules_name_length,
  drop constraint if exists recurring_rules_fixed_amount_required,
  drop constraint if exists recurring_rules_creation_idempotency_pair;

alter table public.recurring_rules
  add constraint recurring_rules_name_length
    check (char_length(trim(name)) between 1 and 60),
  add constraint recurring_rules_fixed_amount_required
    check (amount_variability <> 'fixed' or expected_amount is not null),
  add constraint recurring_rules_creation_idempotency_pair
    check (
      (creation_idempotency_key is null and creation_request_hash is null)
      or (
        creation_idempotency_key is not null
        and creation_request_hash is not null
        and length(creation_idempotency_key) between 8 and 180
        and creation_request_hash ~ '^[0-9a-f]{64}$'
      )
    );

create unique index if not exists recurring_rules_user_creation_key_unique
  on public.recurring_rules (user_id, creation_idempotency_key)
  where creation_idempotency_key is not null;

create unique index if not exists recurring_rules_user_active_name_unique
  on public.recurring_rules (user_id, lower(trim(name)))
  where status = 'active' and deleted_at is null;

comment on column public.recurring_rules.creation_idempotency_key is
  'Idempotency-Key used by POST /api/v1/recurring; null for non-HTTP legacy creation.';

comment on column public.recurring_rules.creation_request_hash is
  'SHA-256 of the canonical recurring-rule creation payload; detects key reuse with different input.';
