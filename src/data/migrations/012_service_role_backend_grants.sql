-- =============================================================
-- Migration 012: Service role backend grants
-- Corte 5 hardening - Supabase Cloud/PostgREST service access
-- Depends on: 001-011
-- =============================================================

-- Supabase Cloud/PostgREST only exposes objects to roles with explicit grants.
-- The service role is used exclusively by trusted backend routes, workers and
-- adapters. This does not grant additional access to anon/authenticated clients.

grant usage on schema public to service_role;
grant usage on schema manzana to service_role;

grant select, insert, update, delete on all tables in schema public to service_role;

grant execute on all functions in schema public to service_role;
grant execute on all functions in schema manzana to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant execute on functions to service_role;

alter default privileges in schema manzana
  grant execute on functions to service_role;
