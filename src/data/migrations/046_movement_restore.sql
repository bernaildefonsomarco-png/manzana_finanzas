alter table public.movement_audit_log
  drop constraint if exists movement_audit_action_known;

alter table public.movement_audit_log
  add constraint movement_audit_action_known
  check (action in ('created', 'updated', 'corrected', 'deleted', 'reversed', 'restored'));

comment on constraint movement_audit_action_known
  on public.movement_audit_log is
  'Acciones financieras auditables, incluida la restauracion explicita de un soft delete.';
