-- =============================================================
-- Migración 001: Extensions y Enums
-- Corte 1 — Datos, Auth y RLS inicial
-- Orden: debe ejecutarse primero, antes de crear tablas
-- =============================================================

-- ── Extensions ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

create schema if not exists manzana;

-- ── Helper: updated_at automático ───────────────────────────
create or replace function manzana.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Enum: movement_type ─────────────────────────────────────
do $$ begin
  create type public.movement_type as enum (
    'gasto',
    'ingreso',
    'transferencia',
    'asignacion_interna',
    'deuda_adquirida',
    'pago_deuda',
    'prestamo_dado',
    'prestamo_recibido',
    'devolucion_recibida',
    'pago_recurrente',
    'ajuste'
  );
exception when duplicate_object then null;
end $$;

-- ── Enum: movement_status ───────────────────────────────────
do $$ begin
  create type public.movement_status as enum (
    'confirmed',
    'needs_review',
    'corrected',
    'deleted',
    'reversed'
  );
exception when duplicate_object then null;
end $$;

-- ── Enum: movement_source ───────────────────────────────────
do $$ begin
  create type public.movement_source as enum (
    'whatsapp',
    'dashboard_manual',
    'email_confirmed',
    'recurring_confirmed',
    'backfill_confirmed',
    'system_adjustment'
  );
exception when duplicate_object then null;
end $$;

-- ── Enum: pending_source ────────────────────────────────────
do $$ begin
  create type public.pending_source as enum (
    'email_pending',
    'backfill_pending',
    'recurring_candidate',
    'ambiguous_movement',
    'risk_confirmation'
  );
exception when duplicate_object then null;
end $$;

-- ── Enum: pending_type ──────────────────────────────────────
do $$ begin
  create type public.pending_type as enum (
    'email_detected',
    'ambiguous_movement',
    'recurring_candidate',
    'backfill_item',
    'data_quality',
    'risk_confirmation'
  );
exception when duplicate_object then null;
end $$;

-- ── Enum: pending_status ────────────────────────────────────
do $$ begin
  create type public.pending_status as enum (
    'pending',
    'sent_for_confirmation',
    'user_confirmed',
    'user_edited',
    'discarded',
    'auto_resolved_duplicate',
    'expired',
    'archived'
  );
exception when duplicate_object then null;
end $$;

-- ── Enum: risk_level ────────────────────────────────────────
do $$ begin
  create type public.risk_level as enum (
    'low',
    'medium',
    'high',
    'sensitive'
  );
exception when duplicate_object then null;
end $$;

-- ── Enum: account_type ──────────────────────────────────────
do $$ begin
  create type public.account_type as enum (
    'digital',
    'banco',
    'fisico',
    'tarjeta'
  );
exception when duplicate_object then null;
end $$;

-- ── Enum: box_type ──────────────────────────────────────────
do $$ begin
  create type public.box_type as enum (
    'compromiso',
    'objetivo',
    'emergencia'
  );
exception when duplicate_object then null;
end $$;

-- ── Enum: debt_direction ────────────────────────────────────
do $$ begin
  create type public.debt_direction as enum (
    'i_owe',
    'they_owe_me'
  );
exception when duplicate_object then null;
end $$;

-- ── Enum: debt_kind ─────────────────────────────────────────
do $$ begin
  create type public.debt_kind as enum (
    'personal',
    'bank_loan',
    'credit_card',
    'installment_purchase',
    'service_or_bill',
    'other'
  );
exception when duplicate_object then null;
end $$;

-- ── Enum: debt_status ───────────────────────────────────────
do $$ begin
  create type public.debt_status as enum (
    'draft',
    'active',
    'due_soon',
    'overdue',
    'paid',
    'cancelled',
    'archived'
  );
exception when duplicate_object then null;
end $$;

-- ── Enum: installment_status ────────────────────────────────
do $$ begin
  create type public.installment_status as enum (
    'pending',
    'due_soon',
    'overdue',
    'paid',
    'rescheduled',
    'skipped'
  );
exception when duplicate_object then null;
end $$;

-- ── Enum: recurring_status ──────────────────────────────────
do $$ begin
  create type public.recurring_status as enum (
    'suggested',
    'active',
    'paused',
    'cancelled',
    'archived'
  );
exception when duplicate_object then null;
end $$;

-- ── Enum: recurring_occurrence_status ───────────────────────
do $$ begin
  create type public.recurring_occurrence_status as enum (
    'expected',
    'due_soon',
    'pending_confirmation',
    'paid',
    'skipped',
    'overdue',
    'rejected'
  );
exception when duplicate_object then null;
end $$;

-- ── Enum: recurring_candidate_status ────────────────────────
do $$ begin
  create type public.recurring_candidate_status as enum (
    'candidate',
    'ready_to_suggest',
    'suggested',
    'confirmed',
    'dismissed',
    'expired'
  );
exception when duplicate_object then null;
end $$;

-- ── Enum: insight_type ──────────────────────────────────────
do $$ begin
  create type public.insight_type as enum (
    'learning_progress',
    'comparative',
    'category_concentration',
    'temporal_pattern',
    'anomaly',
    'projection',
    'free_money',
    'recurring',
    'debt',
    'box_saving',
    'contextual',
    'progress',
    'data_quality'
  );
exception when duplicate_object then null;
end $$;

-- ── Enum: insight_status ────────────────────────────────────
do $$ begin
  create type public.insight_status as enum (
    'candidate',
    'validated',
    'ranked',
    'narrated',
    'displayed',
    'sent',
    'acted',
    'dismissed',
    'ignored',
    'outdated',
    'expired'
  );
exception when duplicate_object then null;
end $$;

-- ── Enum: nudge_type ────────────────────────────────────────
do $$ begin
  create type public.nudge_type as enum (
    'daily_reconstruction',
    'missing_activity',
    'payment_due',
    'debt_due',
    'overdue_payment',
    'pending_review',
    'weekly_review',
    'insight_prompt',
    'anomaly_alert',
    'progress_positive',
    'budget_goal',
    'reengagement'
  );
exception when duplicate_object then null;
end $$;

-- ── Enum: nudge_status ──────────────────────────────────────
do $$ begin
  create type public.nudge_status as enum (
    'candidate',
    'approved',
    'deferred',
    'rejected',
    'scheduled',
    'sent',
    'delivered',
    'responded',
    'acted',
    'dismissed',
    'expired'
  );
exception when duplicate_object then null;
end $$;

-- ── Enum: onboarding_status ─────────────────────────────────
do $$ begin
  create type public.onboarding_status as enum (
    'not_started',
    'started',
    'first_value_reached',
    'activated_light',
    'activated_strong',
    'completed',
    'paused'
  );
exception when duplicate_object then null;
end $$;
