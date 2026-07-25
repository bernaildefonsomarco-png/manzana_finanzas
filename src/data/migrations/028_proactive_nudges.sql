-- =============================================================
-- Migration 028: Proactive multichannel nudges
-- Deterministic policy/disclosure gates with tracked delivery
-- Depends on: 001-027
-- =============================================================

alter type public.nudge_status add value if not exists 'failed';

create index if not exists nudge_candidates_proactive_due_idx
  on public.nudge_candidates (status, scheduled_for, priority desc)
  where status in (
    'candidate'::public.nudge_status,
    'approved'::public.nudge_status,
    'deferred'::public.nudge_status,
    'scheduled'::public.nudge_status
  );

create index if not exists nudge_deliveries_candidate_channel_created_idx
  on public.nudge_deliveries (nudge_candidate_id, channel, created_at desc);

comment on table public.nudge_candidates is
  'Avisos multicanal evaluados por NudgePolicy, RiskPolicy y DisclosureEngine. Un candidato no autoriza por si solo un envio externo ni una escritura financiera.';

comment on table public.nudge_deliveries is
  'Trazabilidad de intentos y estados de entrega por canal. Los fallos se conservan para reintentos idempotentes y auditoria.';
