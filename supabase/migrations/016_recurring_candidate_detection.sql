-- =============================================================
-- Migration 016: Recurring candidate detection hardening
-- Corte 11 - Sugeridos deterministas para Pagos que vienen
-- Depends on: 001-015
-- =============================================================

with ranked_open_candidates as (
  select
    id,
    row_number() over (
      partition by user_id, merchant_key
      order by confidence desc, updated_at desc, created_at desc, id
    ) as rn
  from public.recurring_candidates
  where status in (
    'candidate'::public.recurring_candidate_status,
    'ready_to_suggest'::public.recurring_candidate_status,
    'suggested'::public.recurring_candidate_status
  )
)
update public.recurring_candidates candidate
   set status = 'expired'::public.recurring_candidate_status,
       metadata = coalesce(candidate.metadata, '{}'::jsonb)
         || jsonb_build_object(
           'expired_from', '016_recurring_candidate_detection',
           'expired_reason', 'duplicate_open_candidate'
         )
  from ranked_open_candidates ranked
 where candidate.id = ranked.id
   and ranked.rn > 1;

create unique index if not exists recurring_candidates_user_open_merchant_unique_idx
  on public.recurring_candidates (user_id, merchant_key)
  where status in (
    'candidate'::public.recurring_candidate_status,
    'ready_to_suggest'::public.recurring_candidate_status,
    'suggested'::public.recurring_candidate_status
  );

create index if not exists recurring_candidates_user_created_idx
  on public.recurring_candidates (user_id, created_at desc);

comment on index recurring_candidates_user_open_merchant_unique_idx is
  'Garantiza una sola sugerencia recurrente abierta por comercio normalizado y usuario.';
