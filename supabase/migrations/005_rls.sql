-- =============================================================
-- Migración 005: RLS Policies — Corte 1
-- Corte 1 — Datos, Auth y RLS inicial
-- Depende de: 002, 003, 004
-- Regla: cada tabla de usuario tiene RLS activado y
--        solo el dueño (auth.uid() = user_id) puede acceder.
--        El cliente puede leer datos propios.
--        Mutaciones financieras pasan por backend/Core.
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

-- El usuario puede leer su propio perfil
create policy "profiles: select own"
  on public.profiles for select
  using (auth.uid() = id);

-- El usuario puede actualizar su propio perfil
-- (campos financieros/sensibles se protegen en backend)
create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Solo el backend (service role) puede insertar profiles
-- (se crea automáticamente al registrarse vía trigger en auth)
create policy "profiles: insert backend only"
  on public.profiles for insert
  with check (false); -- cliente no puede insertar directo

-- ─────────────────────────────────────────────────────────────
-- user_preferences
-- ─────────────────────────────────────────────────────────────
alter table public.user_preferences enable row level security;

create policy "user_preferences: select own"
  on public.user_preferences for select
  using (auth.uid() = user_id);

create policy "user_preferences: upsert own"
  on public.user_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- categories (tabla global, solo lectura para todos)
-- ─────────────────────────────────────────────────────────────
alter table public.categories enable row level security;

-- Cualquier usuario autenticado puede leer categorías
create policy "categories: select authenticated"
  on public.categories for select
  using (auth.role() = 'authenticated');

-- Nadie puede modificar desde cliente
create policy "categories: no write from client"
  on public.categories for all
  using (false)
  with check (false);

-- ─────────────────────────────────────────────────────────────
-- user_subcategories
-- ─────────────────────────────────────────────────────────────
alter table public.user_subcategories enable row level security;

create policy "user_subcategories: select own"
  on public.user_subcategories for select
  using (auth.uid() = user_id);

create policy "user_subcategories: insert own"
  on public.user_subcategories for insert
  with check (auth.uid() = user_id);

create policy "user_subcategories: update own"
  on public.user_subcategories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No hay delete físico — se usa deleted_at (soft delete)

-- ─────────────────────────────────────────────────────────────
-- tags
-- ─────────────────────────────────────────────────────────────
alter table public.tags enable row level security;

-- Leer tags de sistema (user_id null) + los propios
create policy "tags: select own and system"
  on public.tags for select
  using (user_id is null or auth.uid() = user_id);

-- Solo puede crear tags personalizados propios
create policy "tags: insert own"
  on public.tags for insert
  with check (auth.uid() = user_id and is_system = false);

-- ─────────────────────────────────────────────────────────────
-- accounts
-- ─────────────────────────────────────────────────────────────
alter table public.accounts enable row level security;

create policy "accounts: select own"
  on public.accounts for select
  using (auth.uid() = user_id);

-- El cliente puede crear cuentas con datos no financieros.
-- Saldos iniciales/current_balance se registran por backend/Core.
create policy "accounts: insert own"
  on public.accounts for insert
  with check (auth.uid() = user_id);

-- El cliente puede editar metadatos de sus cuentas (nombre, icono, color, etc.)
-- current_balance lo actualiza solo el Balance Engine.
create policy "accounts: update own"
  on public.accounts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No hay delete físico — se usa deleted_at

-- ─────────────────────────────────────────────────────────────
-- boxes
-- ─────────────────────────────────────────────────────────────
alter table public.boxes enable row level security;

create policy "boxes: select own"
  on public.boxes for select
  using (auth.uid() = user_id);

create policy "boxes: insert own"
  on public.boxes for insert
  with check (auth.uid() = user_id);

create policy "boxes: update own"
  on public.boxes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Privilegios por columna.
-- RLS filtra filas; los grants limitan que columnas puede mutar el cliente.
-- Saldos y efectos financieros quedan para backend/Core con service role.
revoke all on public.profiles from anon, authenticated;
revoke all on public.user_preferences from anon, authenticated;
revoke all on public.categories from anon, authenticated;
revoke all on public.user_subcategories from anon, authenticated;
revoke all on public.tags from anon, authenticated;
revoke all on public.accounts from anon, authenticated;
revoke all on public.boxes from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, phone_e164, timezone, locale)
  on public.profiles to authenticated;

grant select, insert on public.user_preferences to authenticated;
grant update (
  tone_style,
  discreet_mode_enabled,
  quiet_hours_start,
  quiet_hours_end,
  whatsapp_opt_in,
  email_opt_in,
  nudge_opt_in,
  default_account_id,
  metadata
) on public.user_preferences to authenticated;

grant select on public.categories to authenticated;

grant select, insert on public.user_subcategories to authenticated;
grant update (label, normalized_label, metadata, deleted_at)
  on public.user_subcategories to authenticated;

grant select, insert on public.tags to authenticated;

grant select on public.accounts to authenticated;
grant insert (
  user_id,
  name,
  institution,
  type,
  currency,
  is_default,
  color,
  icon,
  metadata
) on public.accounts to authenticated;
grant update (
  name,
  institution,
  type,
  currency,
  is_default,
  color,
  icon,
  metadata
) on public.accounts to authenticated;

grant select on public.boxes to authenticated;
grant insert (
  user_id,
  account_id,
  name,
  type,
  target_amount,
  target_date,
  metadata
) on public.boxes to authenticated;
grant update (
  name,
  type,
  target_amount,
  target_date,
  metadata
) on public.boxes to authenticated;

-- ─────────────────────────────────────────────────────────────
-- NOTA: RLS para las tablas de Cortes 2-11 se agrega en sus
--       respectivas migraciones (movements, pending_items, etc.)
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- Trigger: crear profile automáticamente al registrar usuario
-- ─────────────────────────────────────────────────────────────
create or replace function manzana.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  -- Crear profile con valores por defecto
  insert into public.profiles (id, created_at, updated_at)
  values (new.id, now(), now())
  on conflict (id) do nothing;

  -- Crear preferencias por defecto
  insert into public.user_preferences (user_id, created_at, updated_at)
  values (new.id, now(), now())
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Trigger en auth.users
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function manzana.handle_new_user();

comment on function manzana.handle_new_user() is
  'Crea profile y user_preferences automáticamente al registrar un usuario en Supabase Auth.';
