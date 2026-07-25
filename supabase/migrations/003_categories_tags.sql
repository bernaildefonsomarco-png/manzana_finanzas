-- =============================================================
-- Migración 003: Categories, User Subcategories, Tags + Seeds
-- Corte 1 — Datos, Auth y RLS inicial
-- Depende de: 001_extensions_enums.sql
-- =============================================================

-- ── categories ──────────────────────────────────────────────
-- Tabla seed global. Las 12 categorías canónicas son inmutables.
-- id es text (clave semántica, no UUID) — ejemplo: 'alimentacion'.
create table if not exists public.categories (
  id          text    primary key,
  label       text    not null,
  description text,
  is_system   boolean not null default true,
  sort_order  int     not null,
  -- Categorías con datos financieros sensibles (salud, deudas, etc.)
  is_sensitive boolean not null default false
);

comment on table public.categories is
  '12 categorías canónicas de Manzana V1. Seed global, no se crean por usuario.';

comment on column public.categories.id is
  'ID semántico. Ejemplo: alimentacion, transporte, salud.';

comment on column public.categories.is_sensitive is
  'Si true, el modo discreto puede ocultar esta categoría en canales externos.';

-- ── user_subcategories ──────────────────────────────────────
-- Subcategorías personalizadas por usuario. Pertenecen a una categoría base.
create table if not exists public.user_subcategories (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  category_id       text        not null references public.categories(id),
  label             text        not null,
  normalized_label  text        not null,
  created_by        text        not null, -- 'user' | 'llm' | 'learning' | 'import'
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  metadata          jsonb       not null default '{}'::jsonb,

  -- Un usuario no puede tener dos subcategorías activas con el mismo label normalizado en la misma categoría
  constraint user_subcategories_unique_label
    unique nulls not distinct (user_id, category_id, normalized_label, deleted_at)
);

create trigger user_subcategories_updated_at
  before update on public.user_subcategories
  for each row execute function manzana.set_updated_at();

comment on table public.user_subcategories is
  'Subcategorías personales del usuario. No se comparten entre usuarios.';

-- ── tags ────────────────────────────────────────────────────
-- Etiquetas contextuales. Sistema (user_id null) y personalizadas.
create table if not exists public.tags (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references auth.users(id) on delete cascade,
  key         text        not null,
  label       text        not null,
  type        text        not null, -- 'contextual' | 'custom'
  is_system   boolean     not null default false,
  created_at  timestamptz not null default now(),
  metadata    jsonb       not null default '{}'::jsonb,

  -- Tags de sistema son únicos por key; tags de usuario son únicos por (user_id, key)
  constraint tags_unique_system_key  unique nulls not distinct (key, user_id)
);

comment on table public.tags is
  'Etiquetas contextuales. is_system=true son globales (user_id null). Las custom son por usuario.';

-- ─────────────────────────────────────────────────────────────
-- SEEDS
-- ─────────────────────────────────────────────────────────────

-- ── Seed: 12 categorías canónicas ───────────────────────────
insert into public.categories (id, label, description, is_system, sort_order, is_sensitive)
values
  ('alimentacion',            'Alimentación',              'Café, delivery, restaurante, mercado, snacks.',                             true,  1,  false),
  ('transporte',              'Transporte',                'Taxi, Uber, bus, gasolina, peajes, estacionamiento.',                       true,  2,  false),
  ('vivienda_hogar',          'Vivienda / Hogar',          'Alquiler, mantenimiento, limpieza, muebles básicos.',                       true,  3,  false),
  ('servicios_suscripciones', 'Servicios / Suscripciones', 'Netflix, Spotify, internet, luz, agua, celular, software mensual.',         true,  4,  false),
  ('salud',                   'Salud',                     'Farmacia, doctor, terapia, exámenes, seguro médico.',                       true,  5,  true),
  ('educacion',               'Educación',                 'Universidad, cursos, libros, materiales, certificaciones.',                 true,  6,  false),
  ('ocio_salidas',            'Ocio / Salidas',            'Cine, bares, videojuegos, eventos, hobbies.',                              true,  7,  false),
  ('compras_personales',      'Compras personales',        'Ropa, tecnología personal, belleza, accesorios.',                          true,  8,  false),
  ('familia_apoyo',           'Familia / Apoyo',           'Regalos, apoyo a padres, ayuda familiar, aportes.',                        true,  9,  true),
  ('deudas',                  'Deudas',                    'Cuotas, intereses, pagos de préstamo, pagos de tarjeta.',                   true, 10,  true),
  ('trabajo_productividad',   'Trabajo / Productividad',   'Herramientas, coworking, SaaS laboral, materiales de trabajo.',            true, 11,  false),
  ('otros',                   'Otros',                     'Movimientos claros que no encajan en ninguna categoría base.',              true, 12,  false)
on conflict (id) do update set
  label       = excluded.label,
  description = excluded.description,
  sort_order  = excluded.sort_order,
  is_sensitive = excluded.is_sensitive;

-- ── Seed: 8 etiquetas contextuales de sistema ───────────────
insert into public.tags (id, user_id, key, label, type, is_system)
values
  (gen_random_uuid(), null, 'necesario',    'Necesario',    'contextual', true),
  (gen_random_uuid(), null, 'gusto',        'Gusto',        'contextual', true),
  (gen_random_uuid(), null, 'impulso',      'Impulso',      'contextual', true),
  (gen_random_uuid(), null, 'recurrente',   'Recurrente',   'contextual', true),
  (gen_random_uuid(), null, 'social',       'Social',       'contextual', true),
  (gen_random_uuid(), null, 'trabajo',      'Trabajo',      'contextual', true),
  (gen_random_uuid(), null, 'estres',       'Estrés',       'contextual', true),
  (gen_random_uuid(), null, 'fin_de_semana','Fin de semana','contextual', true)
on conflict (key, user_id) do update set
  label = excluded.label;
