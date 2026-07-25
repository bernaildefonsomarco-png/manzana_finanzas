-- =============================================================
-- Migration 030: Classification governance
-- Completes lifecycle and backend-only writes for personal tags.
-- =============================================================

alter table public.tags
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

drop trigger if exists tags_set_updated_at on public.tags;
create trigger tags_set_updated_at
  before update on public.tags
  for each row execute function manzana.set_updated_at();

drop policy if exists "tags: select own and system" on public.tags;
create policy "tags: select own and system"
  on public.tags for select
  using (deleted_at is null and (user_id is null or auth.uid() = user_id));

drop policy if exists "tags: insert own" on public.tags;
drop policy if exists "tags: update own" on public.tags;

-- Classification writes are configuration mutations. They go through the
-- authenticated API and its service-role ClassificationCommandDispatcher.
revoke insert, update, delete on public.tags from authenticated;
grant select on public.tags to authenticated;
grant select, insert, update on public.tags to service_role;

grant select, insert, update on public.user_subcategories to service_role;
grant select, insert, update on public.related_persons to service_role;

comment on column public.tags.deleted_at is
  'Soft-delete marker. System tags cannot be archived by user commands.';
