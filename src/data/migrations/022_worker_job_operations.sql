-- Migration 022: Worker job operation, outbox replay and lag visibility
-- Corte 21 - Operacion durable de outbox/jobs

create table if not exists public.worker_job_runs (
  id              uuid primary key default gen_random_uuid(),
  job_name        text not null,
  trigger         text not null,
  status          text not null default 'running',
  trace_id        uuid not null,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  duration_ms     integer,
  claimed_count   integer not null default 0,
  processed_count integer not null default 0,
  failed_count    integer not null default 0,
  skipped_count   integer not null default 0,
  metadata        jsonb not null default '{}'::jsonb,
  result          jsonb not null default '{}'::jsonb,
  last_error      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint worker_job_runs_job_name_length
    check (char_length(job_name) between 3 and 80),
  constraint worker_job_runs_trigger_length
    check (char_length(trigger) between 3 and 80),
  constraint worker_job_runs_status_known
    check (status in ('running', 'succeeded', 'partial', 'failed')),
  constraint worker_job_runs_counts_non_negative
    check (
      claimed_count >= 0
      and processed_count >= 0
      and failed_count >= 0
      and skipped_count >= 0
    ),
  constraint worker_job_runs_duration_non_negative
    check (duration_ms is null or duration_ms >= 0),
  constraint worker_job_runs_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint worker_job_runs_result_object
    check (jsonb_typeof(result) = 'object')
);

create trigger worker_job_runs_updated_at
  before update on public.worker_job_runs
  for each row execute function manzana.set_updated_at();

create index if not exists worker_job_runs_job_started_idx
  on public.worker_job_runs (job_name, started_at desc);

create index if not exists worker_job_runs_status_started_idx
  on public.worker_job_runs (status, started_at desc);

comment on table public.worker_job_runs is
  'Registro operativo de ejecuciones internas: workers, crons y replays. No contiene datos financieros sensibles ni reemplaza audit_log del Core.';

alter table public.worker_job_runs enable row level security;
revoke all on public.worker_job_runs from anon, authenticated;
grant select, insert, update on public.worker_job_runs to service_role;

create or replace function public.requeue_outbox_event(
  p_outbox_id uuid,
  p_reason text,
  p_trace_id uuid,
  p_requested_by text default 'operator'
)
returns public.transactional_outbox
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_event public.transactional_outbox%rowtype;
begin
  if nullif(trim(p_reason), '') is null then
    raise exception 'requeue_reason_required';
  end if;

  select *
    into v_event
    from public.transactional_outbox
   where id = p_outbox_id
   for update;

  if not found then
    raise exception 'outbox_event_not_found';
  end if;

  if v_event.status not in ('failed', 'dead_letter', 'processing') then
    raise exception 'outbox_event_status_not_replayable:%', v_event.status;
  end if;

  update public.transactional_outbox
     set status = 'pending',
         attempt_count = 0,
         next_attempt_at = now(),
         processing_started_at = null,
         published_at = null,
         last_error = null,
         metadata = coalesce(metadata, '{}'::jsonb)
           || jsonb_build_object(
                'last_requeue',
                jsonb_build_object(
                  'reason', p_reason,
                  'trace_id', p_trace_id,
                  'requested_by', p_requested_by,
                  'requested_at', now()
                )
              )
   where id = p_outbox_id
   returning *
    into v_event;

  return v_event;
end;
$$;

revoke all on function public.requeue_outbox_event(uuid, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.requeue_outbox_event(uuid, text, uuid, text)
  to service_role;

comment on function public.requeue_outbox_event(uuid, text, uuid, text) is
  'Rehabilita un evento outbox fallido/dead_letter/processing para replay controlado. No reejecuta eventos published ni modifica dinero.';
