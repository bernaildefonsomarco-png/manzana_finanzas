import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { verificarRamaUnicaDeMigraciones } from "../../scripts/gates/rama-unica-migraciones.ts";

function migration(name: string): string {
  return readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");
}

describe("migraciones: una sola rama (WEB-D163)", () => {
  it("AC-INV-07: supabase/migrations/ es la única rama, sin un segundo árbol en src/data/migrations/", () => {
    expect(verificarRamaUnicaDeMigraciones()).toEqual({ ok: true });
  });
});

describe("migrations hardening", () => {
  it("crea el schema manzana antes de crear funciones en ese schema", () => {
    const sql = migration("001_extensions_enums.sql");

    expect(sql.indexOf("create schema if not exists manzana")).toBeGreaterThan(-1);
    expect(sql.indexOf("create schema if not exists manzana")).toBeLessThan(
      sql.indexOf("create or replace function manzana.set_updated_at")
    );
  });

  it("no usa add constraint if not exists", () => {
    const sql = migration("004_accounts_boxes.sql").toLowerCase();

    expect(sql).not.toContain("add constraint if not exists");
    expect(sql).toContain("from pg_constraint");
    expect(sql).toContain("user_preferences_default_account_fk");
  });

  it("no concede mutacion de saldos financieros al rol authenticated", () => {
    const sql = migration("005_rls.sql").toLowerCase();

    expect(sql).not.toMatch(/grant\s+update\s*\([^)]*current_balance/);
    expect(sql).not.toMatch(/grant\s+update\s*\([^)]*initial_balance/);
    expect(sql).not.toMatch(/grant\s+insert\s*\([^)]*current_balance/);
  });

  it("permite saldos negativos en cajas para soportar overspend con warning", () => {
    const sql = migration("004_accounts_boxes.sql").toLowerCase();

    expect(sql).not.toContain("boxes_balance_non_negative");
    expect(sql).not.toContain("check (current_balance >= 0)");
  });

  it("crea movimientos, auditoria y tags sin conceder escritura directa al cliente", () => {
    const sql = migration("006_movements_core.sql").toLowerCase();

    expect(sql).toContain("create table if not exists public.movements");
    expect(sql).toContain("create table if not exists public.movement_audit_log");
    expect(sql).toContain("create table if not exists public.movement_tags");
    expect(sql).toContain("movements_unique_idempotency");
    expect(sql).toContain("core_commit_movement_create");
    expect(sql).toContain("core_commit_movement_update");
    expect(sql).not.toMatch(/grant\s+insert\s+on\s+public\.movements\s+to\s+authenticated/);
    expect(sql).not.toMatch(/grant\s+update\s+on\s+public\.movements\s+to\s+authenticated/);
  });

  it("crea pending_items como bandeja protegida sin tocar saldos", () => {
    const sql = migration("007_pending_items.sql").toLowerCase();

    expect(sql).toContain("create table if not exists public.pending_items");
    expect(sql).toContain("public.pending_type");
    expect(sql).toContain("public.pending_status");
    expect(sql).toContain("public.pending_source");
    expect(sql).toContain("public.risk_level");
    expect(sql).toContain("pending_items_user_status_created_idx");
    expect(sql).toContain("pending_items_user_source_ref_idx");
    expect(sql).toContain("where source_ref is not null");
    expect(sql).toContain("alter table public.pending_items enable row level security");
    expect(sql).toContain("pending_items: select own");
    expect(sql).toContain("grant select on public.pending_items to authenticated");
    expect(sql).not.toMatch(/grant\s+insert\s+on\s+public\.pending_items\s+to\s+authenticated/);
    expect(sql).not.toMatch(/grant\s+update\s+on\s+public\.pending_items\s+to\s+authenticated/);
    expect(sql).not.toMatch(/grant\s+delete\s+on\s+public\.pending_items\s+to\s+authenticated/);
  });

  it("crea outbox y logs de eventos sin acceso directo del cliente", () => {
    const sql = migration("008_events_outbox.sql").toLowerCase();

    expect(sql).toContain("create table if not exists public.external_event_log");
    expect(sql).toContain("create table if not exists public.transactional_outbox");
    expect(sql).toContain("create table if not exists public.internal_event_log");
    expect(sql).toContain("external_event_unique_idempotency");
    expect(sql).toContain("transactional_outbox_status_next_attempt_idx");
    expect(sql).toContain("internal_event_log_unique_consumer");
    expect(sql).toContain("alter table public.external_event_log enable row level security");
    expect(sql).toContain("alter table public.transactional_outbox enable row level security");
    expect(sql).toContain("alter table public.internal_event_log enable row level security");
    expect(sql).toContain("insert_transactional_outbox_events");
    expect(sql).toContain("claim_outbox_events");
    expect(sql).toContain("mark_outbox_published");
    expect(sql).toContain("record_internal_event_processing");
    expect(sql).not.toMatch(/grant\s+(select|insert|update|delete|all)[^;]+public\.transactional_outbox[^;]+authenticated/);
    expect(sql).not.toMatch(/grant\s+(select|insert|update|delete|all)[^;]+public\.external_event_log[^;]+authenticated/);
    expect(sql).not.toMatch(/grant\s+(select|insert|update|delete|all)[^;]+public\.internal_event_log[^;]+authenticated/);
  });

  it("confirma pendientes de forma atomica con movimiento y outbox", () => {
    const sql = migration("009_pending_confirmation_atomic.sql").toLowerCase();

    expect(sql).toContain("confirm_pending_with_movement");
    expect(sql).toContain("for update");
    expect(sql).toContain("core_commit_movement_create");
    expect(sql).toContain("transactional_outbox");
    expect(sql).toContain("'pending_confirmed'");
    expect(sql).toContain("'movement_id', v_movement.id");
    expect(sql).toContain("'user_confirmed'");
    expect(sql).toContain("'pending_item_already_resolved'");
    expect(sql).toContain("grant execute on function public.confirm_pending_with_movement");
    expect(sql).not.toMatch(/grant\s+execute[^;]+confirm_pending_with_movement[^;]+authenticated/);
  });

  it("crea whatsapp_window_states sin acceso directo del cliente", () => {
    const sql = migration("010_whatsapp_windows.sql").toLowerCase();

    expect(sql).toContain("create table if not exists public.whatsapp_window_states");
    expect(sql).toContain("whatsapp_window_states_user_phone_unique");
    expect(sql).toContain("last_user_message_at");
    expect(sql).toContain("window_expires_at");
    expect(sql).toContain("paid_templates_today");
    expect(sql).toContain("last_window_continuation_prompt_at");
    expect(sql).toContain("alter table public.whatsapp_window_states enable row level security");
    expect(sql).toContain("grant select, insert, update on public.whatsapp_window_states to service_role");
    expect(sql).not.toMatch(/grant\s+(select|insert|update|delete|all)[^;]+public\.whatsapp_window_states[^;]+authenticated/);
  });

  it("crea whatsapp_delivery_attempts para trazabilidad outbound sin acceso cliente", () => {
    const sql = migration("011_whatsapp_delivery_attempts.sql").toLowerCase();

    expect(sql).toContain("create table if not exists public.whatsapp_delivery_attempts");
    expect(sql).toContain("whatsapp_delivery_idempotency_unique");
    expect(sql).toContain("provider_message_id");
    expect(sql).toContain("provider              text not null default 'kapso'");
    expect(sql).toContain("provider in ('kapso', 'ycloud', 'meta_cloud')");
    expect(sql).toContain("message_kind in ('freeform', 'template', 'interactive')");
    expect(sql).toContain("alter table public.whatsapp_delivery_attempts enable row level security");
    expect(sql).toContain("grant select, insert, update on public.whatsapp_delivery_attempts to service_role");
    expect(sql).not.toMatch(/grant\s+(select|insert|update|delete|all)[^;]+public\.whatsapp_delivery_attempts[^;]+authenticated/);
  });

  it("crea deudas como entidad propia sin escritura directa del cliente", () => {
    const sql = migration("013_debts.sql").toLowerCase();

    expect(sql).toContain("create table if not exists public.related_persons");
    expect(sql).toContain("create table if not exists public.debts");
    expect(sql).toContain("create table if not exists public.debt_payments");
    expect(sql).toContain("create table if not exists public.debt_installments");
    expect(sql).toContain("current_balance numeric(14,2) not null");
    expect(sql).toContain("debts_current_balance_non_negative");
    expect(sql).toContain("from pg_constraint");
    expect(sql).toContain("boxes_linked_debt_id_fkey");
    expect(sql).toContain("movements_debt_id_fkey");
    expect(sql).toContain("alter table public.debts enable row level security");
    expect(sql).toContain("debts: select own");
    expect(sql).toContain("grant select on public.debts to authenticated");
    expect(sql).not.toMatch(/add\s+constraint\s+if\s+not\s+exists/);
    expect(sql).not.toMatch(/grant\s+insert\s+on\s+public\.debts\s+to\s+authenticated/);
    expect(sql).not.toMatch(/grant\s+update\s+on\s+public\.debts\s+to\s+authenticated/);
  });

  it("registra pagos de deuda de forma transaccional via Core", () => {
    const sql = migration("014_debt_payments_core.sql").toLowerCase();

    expect(sql).toContain("commit_debt_payment");
    expect(sql).toContain("add column if not exists last_payment_at");
    expect(sql).toContain("add column if not exists currency");
    expect(sql).toContain("core_commit_movement_create");
    expect(sql).toContain("insert into public.debt_payments");
    expect(sql).toContain("update public.debts");
    expect(sql).toContain("debt_payment_exceeds_balance");
    expect(sql).toContain("debt_payments_movement_unique_idx");
    expect(sql).toContain("insert_transactional_outbox_events");
    expect(sql).toContain("grant execute on function public.commit_debt_payment");
    expect(sql).not.toMatch(/grant\s+execute[^;]+commit_debt_payment[^;]+authenticated/);
  });

  it("crea recurrentes y confirma pagos recurrentes via Core", () => {
    const sql = migration("015_recurring_payments.sql").toLowerCase();

    expect(sql).toContain("create table if not exists public.recurring_rules");
    expect(sql).toContain("create table if not exists public.recurring_occurrences");
    expect(sql).toContain("create table if not exists public.recurring_candidates");
    expect(sql).toContain("recurring_occurrences_unique_rule_date");
    expect(sql).toContain("boxes_linked_recurring_id_fkey");
    expect(sql).toContain("movements_recurring_rule_id_fkey");
    expect(sql).toContain("movements_recurring_occurrence_id_fkey");
    expect(sql).toContain("alter table public.recurring_rules enable row level security");
    expect(sql).toContain("recurring_rules: select own");
    expect(sql).toContain("recurring_rules: no client write");
    expect(sql).toContain("commit_recurring_payment");
    expect(sql).toContain("core_commit_movement_create");
    expect(sql).toContain("insert_transactional_outbox_events");
    expect(sql).toContain("recurring_rule_linked_debt_requires_debt_flow");
    expect(sql).toContain("grant execute on function public.commit_recurring_payment");
    const commitFunction = sql.slice(
      sql.indexOf("create or replace function manzana.commit_recurring_payment"),
      sql.indexOf("create or replace function public.commit_recurring_payment")
    );
    expect(commitFunction).not.toContain(
      "insert into public.recurring_occurrences"
    );
    expect(sql).not.toMatch(/add\s+constraint\s+if\s+not\s+exists/);
    expect(sql).not.toMatch(/grant\s+insert\s+on\s+public\.recurring_rules\s+to\s+authenticated/);
    expect(sql).not.toMatch(/grant\s+update\s+on\s+public\.recurring_rules\s+to\s+authenticated/);
    expect(sql).not.toMatch(/grant\s+execute[^;]+commit_recurring_payment[^;]+authenticated/);
  });

  it("deduplica candidatos recurrentes abiertos sin abrir escritura cliente", () => {
    const sql = migration("016_recurring_candidate_detection.sql").toLowerCase();

    expect(sql).toContain("ranked_open_candidates");
    expect(sql).toContain("duplicate_open_candidate");
    expect(sql).toContain("recurring_candidates_user_open_merchant_unique_idx");
    expect(sql).toContain("recurring_candidates_user_created_idx");
    expect(sql).toContain("'candidate'::public.recurring_candidate_status");
    expect(sql).toContain("'ready_to_suggest'::public.recurring_candidate_status");
    expect(sql).toContain("'suggested'::public.recurring_candidate_status");
    expect(sql).not.toMatch(/grant\s+insert\s+on\s+public\.recurring_candidates\s+to\s+authenticated/);
    expect(sql).not.toMatch(/grant\s+update\s+on\s+public\.recurring_candidates\s+to\s+authenticated/);
    expect(sql).not.toMatch(/grant\s+delete\s+on\s+public\.recurring_candidates\s+to\s+authenticated/);
  });

  it("crea nudges dashboard-only sin escritura cliente ni envio externo", () => {
    const sql = migration("017_dashboard_nudges.sql").toLowerCase();

    expect(sql).toContain("create table if not exists public.nudge_preferences");
    expect(sql).toContain("create table if not exists public.nudge_candidates");
    expect(sql).toContain("create table if not exists public.nudge_deliveries");
    expect(sql).toContain("nudge_candidates_user_active_source_unique_idx");
    expect(sql).toContain("nudge_candidates: select own");
    expect(sql).toContain("nudge_candidates: no client write");
    expect(sql).toContain("grant select on public.nudge_candidates to authenticated");
    expect(sql).toContain("grant select, insert, update on public.nudge_candidates to service_role");
    expect(sql).toContain("dashboard-only");
    expect(sql).not.toMatch(/grant\s+insert\s+on\s+public\.nudge_candidates\s+to\s+authenticated/);
    expect(sql).not.toMatch(/grant\s+update\s+on\s+public\.nudge_candidates\s+to\s+authenticated/);
    expect(sql).not.toMatch(/grant\s+delete\s+on\s+public\.nudge_candidates\s+to\s+authenticated/);
  });

  it("guarda preferencias dashboard y expira avisos sin abrir escritura cliente", () => {
    const sql = migration("019_dashboard_nudge_preferences.sql").toLowerCase();

    expect(sql).toContain("add column if not exists paused_until");
    expect(sql).toContain("add column if not exists metadata");
    expect(sql).toContain("set_dashboard_nudge_preference");
    expect(sql).toContain("dashboard_preference_disabled");
    expect(sql).toContain("source_entity_type = 'debt_installment'");
    expect(sql).toContain("grant execute on function public.set_dashboard_nudge_preference");
    expect(sql).not.toMatch(
      /grant\s+execute[^;]+set_dashboard_nudge_preference[^;]+authenticated/
    );
    expect(sql).not.toMatch(
      /update\s+public\.(movements|accounts|boxes|debts|debt_installments)/
    );
  });

  it("refresca vencimientos de deuda via Core sin tocar importes ni saldos", () => {
    const sql = migration("020_debt_installment_lifecycle.sql").toLowerCase();

    expect(sql).toContain("refresh_debt_installment_lifecycle");
    expect(sql).toContain("for update of installment");
    expect(sql).toContain("for update of debt");
    expect(sql).toContain("debt_installment_due_soon");
    expect(sql).toContain("debt_installment_overdue");
    expect(sql).toContain("insert_transactional_outbox_events");
    expect(sql).toContain(
      "grant execute on function public.refresh_debt_installment_lifecycle"
    );
    expect(sql).not.toMatch(
      /grant\s+execute[^;]+refresh_debt_installment_lifecycle[^;]+authenticated/
    );
    expect(sql).not.toMatch(/update\s+public\.(movements|accounts|boxes)/);
    expect(sql).not.toMatch(
      /set\s+(current_balance|initial_balance|principal_amount|expected_amount|paid_amount)\s*=/
    );
  });

  it("mantiene el orden deuda antes que cuotas para evitar deadlocks", () => {
    const sql = migration("021_debt_lifecycle_lock_order.sql").toLowerCase();
    const debtLock = sql.indexOf("for update of debt");
    const lifecycleCall = sql.indexOf(
      "return manzana.refresh_debt_installment_lifecycle"
    );

    expect(debtLock).toBeGreaterThan(-1);
    expect(lifecycleCall).toBeGreaterThan(debtLock);
    expect(sql).toContain("p_due_soon_days is null");
    expect(sql).toContain("p_trace_id is null");
    expect(sql).not.toMatch(
      /grant\s+execute[^;]+refresh_debt_installment_lifecycle[^;]+authenticated/
    );
  });

  it("crea operaciones de workers sin acceso cliente y replay controlado de outbox", () => {
    const sql = migration("022_worker_job_operations.sql").toLowerCase();

    expect(sql).toContain("create table if not exists public.worker_job_runs");
    expect(sql).toContain("worker_job_runs_status_known");
    expect(sql).toContain("alter table public.worker_job_runs enable row level security");
    expect(sql).toContain("grant select, insert, update on public.worker_job_runs to service_role");
    expect(sql).toContain("requeue_outbox_event");
    expect(sql).toContain("v_event.status not in ('failed', 'dead_letter', 'processing')");
    expect(sql).toContain("status = 'pending'");
    expect(sql).not.toMatch(
      /grant\s+(select|insert|update|delete|all)[^;]+public\.worker_job_runs[^;]+authenticated/
    );
    expect(sql).not.toMatch(
      /grant\s+execute[^;]+requeue_outbox_event[^;]+authenticated/
    );
    expect(sql).not.toMatch(/update\s+public\.(movements|accounts|boxes|debts)/);
  });

  it("crea memoria conversacional activa sin historial crudo ni escritura cliente", () => {
    const sql = migration("023_conversation_memory.sql").toLowerCase();

    expect(sql).toContain("create table if not exists public.conversation_memory_states");
    expect(sql).toContain("referenced_movements jsonb not null default '[]'::jsonb");
    expect(sql).toContain("last_result_summary text");
    expect(sql).toContain("expires_at timestamptz not null");
    expect(sql).toContain("conversation_memory_states_user_channel_scope_unique");
    expect(sql).toContain("alter table public.conversation_memory_states enable row level security");
    expect(sql).toContain("conversation_memory_states: select own");
    expect(sql).toContain("conversation_memory_states: no client write");
    expect(sql).toContain("grant select on public.conversation_memory_states to authenticated");
    expect(sql).toContain("grant select, insert, update on public.conversation_memory_states to service_role");
    expect(sql).not.toMatch(
      /grant\s+(insert|update|delete|all)[^;]+public\.conversation_memory_states[^;]+authenticated/
    );
  });

  it("unifica el foco conversacional por usuario y scope entre canales", () => {
    const sql = migration("042_conversation_focus_set.sql").toLowerCase();

    expect(sql).toContain("partition by user_id, scope");
    expect(sql).toContain(
      "drop index if exists public.conversation_memory_states_user_channel_scope_unique"
    );
    expect(sql).toContain(
      "conversation_memory_states_user_scope_unique"
    );
    expect(sql).toContain(
      "on public.conversation_memory_states (user_id, scope)"
    );
    expect(sql).toContain("focus_set tipado");
    expect(sql).not.toMatch(
      /grant\s+(insert|update|delete|all)[^;]+public\.conversation_memory_states[^;]+authenticated/
    );
  });

  it("separa memoria confirmada de inferencias y no permite escritura cliente", () => {
    const sql = migration("024_financial_memory_learning.sql").toLowerCase();

    expect(sql).toContain("create table if not exists public.financial_memory_items");
    expect(sql).toContain("evidence_source text not null");
    expect(sql).toContain("confirmation_status text not null default 'confirmed'");
    expect(sql).toContain("financial_memory_items: no client write");
    expect(sql).toContain("grant select on public.financial_memory_items to authenticated");
    expect(sql).not.toMatch(
      /grant\s+(insert|update|delete|all)[^;]+public\.financial_memory_items[^;]+authenticated/
    );
  });

  it("persiste candidatos de aprendizaje sin promoverlos desde el cliente", () => {
    const sql = migration("025_hybrid_learning_candidates.sql").toLowerCase();

    expect(sql).toContain("create table if not exists public.learning_candidates");
    expect(sql).toContain("record_learning_candidate");
    expect(sql).toContain("evidence_count");
    expect(sql).toContain("requires_user_confirmation");
    expect(sql).toContain("learning_candidates: no client write");
    expect(sql).toContain("grant execute on function public.record_learning_candidate");
    expect(sql).not.toMatch(
      /grant\s+(insert|update|delete|all)[^;]+public\.learning_candidates[^;]+authenticated/
    );
    expect(sql).not.toMatch(
      /grant\s+execute[^;]+record_learning_candidate[^;]+authenticated/
    );
  });

  it("persiste decisiones de deduplicacion sin permitir escritura cliente", () => {
    const sql = migration("026_cross_channel_dedup_decisions.sql").toLowerCase();

    expect(sql).toContain("create table if not exists public.dedup_decisions");
    expect(sql).toContain("incoming_reference_id");
    expect(sql).toContain("matched_movement_id");
    expect(sql).toContain("dedup_decisions: no client write");
    expect(sql).toContain("grant select, insert, update on public.dedup_decisions to service_role");
    expect(sql).not.toMatch(
      /grant\s+(insert|update|delete|all)[^;]+public\.dedup_decisions[^;]+authenticated/
    );
  });

  it("crea el ciclo de vida de insights avanzados sin escritura cliente", () => {
    const sql = migration("027_advanced_insights.sql").toLowerCase();

    expect(sql).toContain("create table if not exists public.insight_candidates");
    expect(sql).toContain("evidence jsonb");
    expect(sql).toContain("expires_at");
    expect(sql).toContain("insight_candidates: no client write");
    expect(sql).toContain("grant select, insert, update on public.insight_candidates to service_role");
    expect(sql).not.toMatch(
      /grant\s+(insert|update|delete|all)[^;]+public\.insight_candidates[^;]+authenticated/
    );
  });

  it("habilita entregas proactivas trazables sin abrir escritura cliente", () => {
    const sql = migration("028_proactive_nudges.sql").toLowerCase();

    expect(sql).toContain("alter type public.nudge_status add value if not exists 'failed'");
    expect(sql).toContain("nudge_candidates_proactive_due_idx");
    expect(sql).toContain("nudge_deliveries_candidate_channel_created_idx");
    expect(sql).toContain("fallos se conservan para reintentos idempotentes");
    expect(sql).not.toMatch(
      /grant\s+(insert|update|delete|all)[^;]+public\.nudge_(candidates|deliveries)[^;]+authenticated/
    );
  });

  it("registra consentimiento proactivo de WhatsApp sin abrir escritura cliente", () => {
    const sql = migration("029_whatsapp_nudge_consent.sql").toLowerCase();

    expect(sql).toContain("set_whatsapp_nudge_consent");
    expect(sql).toContain("whatsapp_nudge_type_consent_required");
    expect(sql).toContain("'overdue_payment', p_payment_due");
    expect(sql).toContain("'dashboard_settings'");
    expect(sql).toContain("grant execute on function public.set_whatsapp_nudge_consent");
    expect(sql).not.toMatch(
      /grant\s+execute[^;]+set_whatsapp_nudge_consent[^;]+authenticated/
    );
    expect(sql).not.toMatch(
      /update\s+public\.(movements|accounts|boxes|debts|debt_installments)/
    );
  });

  it("gobierna activacion y salud de parsers financieros externos", () => {
    const sql = migration("034_email_capture_quality.sql").toLowerCase();

    expect(sql).toContain("activation_mode in ('disabled', 'shadow', 'active')");
    expect(sql).toContain("verification_status = 'verified'");
    expect(sql).toContain("cardinality(sample_hashes) >= 5");
    expect(sql).toContain("parser_config->>'schema_version' = 'gmail_parser_v1'");
    expect(sql).toContain("guard_email_pending_template_activation");
    expect(sql).toContain("email_pending_template_not_active");
    expect(sql).toContain("email_messages_template_health");
    expect(sql).toContain("resolve_pending_specialized_commit");
    expect(sql).toContain("commit_pending_debt_payment");
    expect(sql).toContain("commit_pending_recurring_payment");
    expect(sql).toContain("'specialized_resolution'");
    expect(sql).toContain("get_email_capture_health");
    expect(sql).toContain("'persisted_allowlisted_messages'");
    expect(sql).toContain("'p95_latency_lte_120000'");
    expect(sql).toContain("'external_event_processed_rate_gte_98'");
    expect(sql).toContain("'watch_connections_healthy'");
    expect(sql).toContain("'tokens_present_for_connected_accounts'");
    expect(sql).toContain("'active_templates_matched_within_14d'");
    expect(sql).toContain("'cost_instrumentation'");
    expect(sql).toContain("prepare_user_account_deletion");
    expect(sql).toContain("gmail_must_be_disconnected_before_account_deletion");
    expect(sql).toContain("payload_ref = null");
    expect(sql).toContain("grant execute on function public.get_email_capture_health(int)");
    expect(sql).not.toMatch(
      /grant\s+execute[^;]+get_email_capture_health[^;]+authenticated/,
    );
    expect(sql).not.toMatch(
      /grant\s+execute[^;]+commit_pending_(debt|recurring)_payment[^;]+authenticated/,
    );
    expect(sql).not.toMatch(
      /grant\s+execute[^;]+prepare_user_account_deletion[^;]+authenticated/,
    );
    expect(sql).not.toMatch(
      /update\s+public\.(movements|accounts|boxes|debts|debt_installments)/,
    );
  });

  it("deduplica contenido email y mantiene backfill solo en Dashboard", () => {
    const sql = migration("035_email_content_dedup_backfill.sql").toLowerCase();

    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("'content_hash_24h'");
    expect(sql).toContain(
      "abs(extract(epoch from (received_at - p_received_at))) <= 86400",
    );
    expect(sql).toContain("v_pending_source := 'backfill_pending'");
    expect(sql).toContain("v_pending_type := 'backfill_item'");
    expect(sql).toContain("'dashboard_only'");
    expect(sql).not.toMatch(
      /grant\s+execute[^;]+commit_email_message_outcome[^;]+authenticated/,
    );
  });

  it("trata dead letters de email como fallos operativos visibles", () => {
    const sql = migration("036_email_health_dead_letters.sql").toLowerCase();

    expect(sql).toContain("status in ('failed', 'dead_letter')");
    expect(sql).toContain("'silent_failures_zero'");
    expect(sql).toContain("v_external_failed = 0 and v_external_stuck = 0");
    expect(sql).toContain(
      "grant execute on function public.get_email_capture_health(int)",
    );
    expect(sql).not.toMatch(
      /grant\s+execute[^;]+get_email_capture_health[^;]+authenticated/,
    );
  });

  it("mide el extractor IA sin persistir evidencia financiera", () => {
    const sql = migration(
      "037_email_extraction_agent_health.sql",
    ).toLowerCase();

    expect(sql).toContain("get_email_extraction_agent_health");
    expect(sql).toContain("'agent_grounding_failure_rate_lt_1'");
    expect(sql).toContain("'agent_fallback_rate_lt_10'");
    expect(sql).toContain("'ignored_non_movement_notices'");
    expect(sql).not.toContain("field_evidence");
    expect(sql).not.toMatch(
      /grant\s+execute[^;]+get_email_extraction_agent_health[^;]+authenticated/,
    );
  });

  it("activa shadow por autenticidad y metricas, no por cuota de muestras", () => {
    const sql = migration(
      "038_email_sender_auth_shadow_policy.sql",
    ).toLowerCase();

    expect(sql).toContain("dkim_dmarc_required");
    expect(sql).toContain("'shadow_metrics_v2'");
    expect(sql).toContain("'grounding_rate'");
    expect(sql).toContain("'critical_error_count' = '0'");
    expect(sql).toContain("'bcp-agent-shadow-v1'");
    expect(sql).toContain("'shadow'");
    expect(sql).not.toContain("cardinality(sample_hashes) >= 5");
    expect(sql).not.toContain("field_evidence");
  });

  it("separa rechazos de autenticacion de fallos del parser", () => {
    const sql = migration(
      "039_email_sender_auth_health.sql",
    ).toLowerCase();

    expect(sql).toContain("sender_auth_rejected");
    expect(sql).toContain("get_email_sender_authentication_health");
    expect(sql).toContain("'body_fetch_after_auth_rejection_zero'");
    expect(sql).toContain("'auth_rejection_reason_known'");
    expect(sql).toContain(
      "not in ('shadow', 'sender_auth_rejected')",
    );
    expect(sql).toContain("set parse_failure_count = (");
    expect(sql).not.toMatch(
      /grant\s+execute[^;]+get_email_sender_authentication_health[^;]+authenticated/,
    );
  });

  it("mide reparaciones del extractor y endurece la activacion", () => {
    const sql = migration(
      "040_email_extraction_repair_health.sql",
    ).toLowerCase();

    expect(sql).toContain("agent_evidence_repaired_attempts");
    expect(sql).toContain("agent_value_normalized_attempts");
    expect(sql).toContain("'agent_evidence_repair_rate_lt_20'");
    expect(sql).toContain("'agent_value_normalization_rate_lt_10'");
    expect(sql).toContain("'authorized_real_backfill_count', 4");
    expect(sql).toContain(
      "'authorized_real_backfill_content_persisted', false",
    );
    expect(sql).toContain("'evidence_repair_rate'");
    expect(sql).toContain("'value_normalization_rate'");
    expect(sql).not.toContain("field_evidence");
    expect(sql).not.toMatch(
      /grant\s+execute[^;]+get_email_extraction_agent_health[^;]+authenticated/,
    );
  });

  it("separa institucion, buzon y remitente exacto sin escritura cliente", () => {
    const sql = migration(
      "041_email_multi_mailbox_sources.sql",
    ).toLowerCase();

    expect(sql).toContain("create table if not exists public.email_institutions");
    expect(sql).toContain("create table if not exists public.user_email_sources");
    expect(sql).toContain("email_connections_user_provider_email_idx");
    expect(sql).toContain("user_email_sources_user_institution_idx");
    expect(sql).toContain("user_email_sources_connection_sender_idx");
    expect(sql).toContain("upsert_user_email_source");
    expect(sql).toContain("delete_user_email_source");
    expect(sql).toContain("notification_sender = lower(notification_sender)");
    expect(sql).toContain("status <> 'active'");
    expect(sql).toContain("verification_status = 'verified'");
    expect(sql).toContain("activation_mode = 'active'");
    expect(sql).toContain("p_connection_id uuid default null");
    expect(sql).toContain(
      "'gmail:' || p_connection_id::text || ':' || p_provider_message_id",
    );
    expect(sql).toContain("'dashboard_only'");
    expect(sql).toContain("'policy_controlled'");
    expect(sql).not.toMatch(
      /grant\s+(insert|update|delete|all)[^;]+public\.user_email_sources[^;]+authenticated/,
    );
    expect(sql).not.toMatch(
      /grant\s+execute[^;]+(upsert|delete)_user_email_source[^;]+authenticated/,
    );
  });

  it("crea deudas, cuotas, movimiento opcional y outbox en un solo commit Core", () => {
    const sql = migration("043_debt_creation_core.sql").toLowerCase();

    expect(sql).toContain("commit_debt_creation");
    expect(sql).toContain("add column if not exists idempotency_key");
    expect(sql).toContain("debts_user_idempotency_unique_idx");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("insert into public.related_persons");
    expect(sql).toContain("insert into public.debts");
    expect(sql).toContain("insert into public.debt_installments");
    expect(sql).toContain("core_commit_movement_create");
    expect(sql).toContain("insert_transactional_outbox_events");
    expect(sql).toContain("debt_creation_idempotency_conflict");
    expect(sql).toContain(
      "grant execute on function public.commit_debt_creation",
    );
    expect(sql).not.toMatch(
      /grant\s+execute[^;]+commit_debt_creation[^;]+authenticated/,
    );
    expect(sql).not.toMatch(
      /grant\s+(insert|update|delete|all)[^;]+public\.debts[^;]+authenticated/,
    );
  });

  it("gobierna aprendizaje con evidencia, contradiccion y control del usuario", () => {
    const sql = migration("044_learning_governance.sql").toLowerCase();

    expect(sql).toContain("create table if not exists public.learning_evidence");
    expect(sql).toContain("create table if not exists public.learning_memory_events");
    expect(sql).toContain("create table if not exists public.learning_preferences");
    expect(sql).toContain("record_learning_evidence");
    expect(sql).toContain("decide_learning_candidate");
    expect(sql).toContain("promote_learning_candidate");
    expect(sql).toContain("manage_financial_memory");
    expect(sql).toContain("expire_financial_learning");
    expect(sql).toContain("get_learning_governance_metrics");
    expect(sql).toContain("'candidate_expired'");
    expect(sql).toContain("negative_evidence_weight");
    expect(sql).toContain("contradictory_evidence_requires_resolution");
    expect(sql).toContain("learning_sensitive_memory_consent_required");
    expect(sql).toContain("lifecycle_status = 'suspended'");
    expect(sql).toContain("extensions.digest");
    expect(sql).not.toMatch(
      /grant\s+execute[^;]+(record_learning_evidence|decide_learning_candidate|promote_learning_candidate|manage_financial_memory)[^;]+authenticated/,
    );
  });

  it("revierte pagos especializados sin borrar evidencia ni abrir el RPC al cliente", () => {
    const sql = migration(
      "056_w11_specialized_payment_reversal.sql"
    ).toLowerCase();

    expect(sql).toContain("reverse_debt_payment");
    expect(sql).toContain("reverse_recurring_payment");
    expect(sql).toContain("reversed_at");
    expect(sql).toContain("core_commit_movement_update");
    expect(sql).toContain("v_audit");
    expect(sql).toContain("v_events");
    expect(sql).not.toMatch(
      /grant\s+execute[^;]+reverse_(debt|recurring)_payment[^;]+authenticated/
    );
  });

  it("lleva lifecycle de deuda por un RPC atomico, idempotente y con outbox", () => {
    const sql = migration(
      "057_w11_debt_operations_core.sql"
    ).toLowerCase();
    const debtLock = sql.indexOf("from public.debts");
    const installmentLock = sql.indexOf(
      "from public.debt_installments",
      debtLock
    );

    expect(sql).toContain("commit_debt_operation");
    expect(sql).toContain("debt_operation_receipts_user_key_unique");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("debt_operation_idempotency_conflict");
    expect(sql).toContain("insert into public.transactional_outbox");
    expect(debtLock).toBeGreaterThan(-1);
    expect(installmentLock).toBeGreaterThan(debtLock);
    expect(sql).not.toMatch(
      /grant\s+execute[^;]+commit_debt_operation[^;]+authenticated/
    );
  });

  it("impone creación recurrente idempotente y permite variable sin estimación", () => {
    const sql = migration(
      "058_w11_recurring_creation_contract.sql"
    ).toLowerCase();

    expect(sql).toContain("creation_idempotency_key");
    expect(sql).toContain("creation_request_hash");
    expect(sql).toContain("recurring_rules_user_creation_key_unique");
    expect(sql).toContain("recurring_rules_fixed_amount_required");
    expect(sql).toContain("amount_variability <> 'fixed'");
    expect(sql).toContain("recurring_rules_name_length");
  });

  it("salta ocurrencia y avanza la regla en un solo RPC especializado", () => {
    const sql = migration(
      "059_w11_recurring_skip_core.sql"
    ).toLowerCase();
    const ruleLock = sql.indexOf("from public.recurring_rules");
    const occurrenceLock = sql.indexOf(
      "from public.recurring_occurrences",
      ruleLock
    );

    expect(sql).toContain("commit_recurring_occurrence_skip");
    expect(sql).toContain("recurring_occurrence_skipped");
    expect(sql).toContain("insert into public.transactional_outbox");
    expect(ruleLock).toBeGreaterThan(-1);
    expect(occurrenceLock).toBeGreaterThan(ruleLock);
    expect(sql).not.toMatch(
      /grant\s+execute[^;]+commit_recurring_occurrence_skip[^;]+authenticated/
    );
  });
});
