-- =============================================================
-- Migración 002: Profiles y User Preferences
-- Corte 1 — Datos, Auth y RLS inicial
-- Depende de: 001_extensions_enums.sql
-- =============================================================

-- ── profiles ────────────────────────────────────────────────
-- Extiende auth.users con datos de producto.
-- id = auth.users.id (no genera propio)
create table if not exists public.profiles (
  id               uuid        primary key references auth.users(id) on delete cascade,
  display_name     text,
  phone_e164       text        unique,
  timezone         text        not null default 'America/Lima',
  locale           text        not null default 'es-PE',
  default_currency text        not null default 'PEN',
  onboarding_status onboarding_status not null default 'not_started',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Trigger: updated_at automático
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function manzana.set_updated_at();

comment on table public.profiles is
  'Perfil de producto del usuario. Extiende auth.users. id = auth.users.id.';

comment on column public.profiles.phone_e164 is
  'Número de teléfono en formato E.164 para WhatsApp. Ejemplo: +51987654321.';

comment on column public.profiles.onboarding_status is
  'Estado de activación del usuario. No se escribe directo desde cliente.';

-- ── user_preferences ────────────────────────────────────────
-- Preferencias de experiencia, privacidad y notificaciones.
create table if not exists public.user_preferences (
  user_id                  uuid        primary key references auth.users(id) on delete cascade,
  tone_style               text,
  discreet_mode_enabled    boolean     not null default false,
  quiet_hours_start        time,
  quiet_hours_end          time,
  whatsapp_opt_in          boolean     not null default false,
  email_opt_in             boolean     not null default false,
  nudge_opt_in             jsonb       not null default '{}'::jsonb,
  default_account_id       uuid,       -- FK a accounts se agrega en migración 004
  metadata                 jsonb       not null default '{}'::jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- Trigger: updated_at automático
create trigger user_preferences_updated_at
  before update on public.user_preferences
  for each row execute function manzana.set_updated_at();

comment on table public.user_preferences is
  'Preferencias de experiencia del usuario. Opt-ins solo se activan con consentimiento explícito.';

comment on column public.user_preferences.discreet_mode_enabled is
  'Oculta montos y datos sensibles en canales externos cuando está activo.';

comment on column public.user_preferences.whatsapp_opt_in is
  'Permite recibir mensajes proactivos por WhatsApp (nudges, resúmenes). Default false.';

comment on column public.user_preferences.nudge_opt_in is
  'JSONB con preferencias por tipo de nudge. Ejemplo: {"payment_due": true, "daily_reconstruction": false}.';
