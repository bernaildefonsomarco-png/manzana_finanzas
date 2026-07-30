-- =============================================================
-- Migration 060: W-11 recurring occurrence worker coverage
-- The daily run must not starve every user after an implicit top-50 cutoff.
-- Depends on: 059
-- =============================================================

create or replace function public.list_recurring_generation_user_ids(
  p_limit integer default null
)
returns table (user_id uuid)
language sql
security definer
set search_path = public, manzana
as $$
  select rule.user_id
    from public.recurring_rules rule
   where rule.status = 'active'
     and rule.deleted_at is null
   group by rule.user_id
   order by max(rule.updated_at) desc, rule.user_id
   limit p_limit;
$$;

revoke all on function public.list_recurring_generation_user_ids(integer)
  from public, anon, authenticated;

grant execute on function public.list_recurring_generation_user_ids(integer)
  to service_role;

comment on function public.list_recurring_generation_user_ids(integer) is
  'Service-only distinct user queue for the recurring occurrence worker. NULL means every active user.';
