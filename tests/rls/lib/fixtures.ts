// Una fila mínima por tabla, sembrada con el cliente de servicio (que
// ignora RLS) para el usuario dueño. El orden respeta las dependencias de
// clave foránea del esquema (`13` §5, medido en `supabase/migrations/`).

import { randomUUID } from "node:crypto";
import { admin, RUN_ID } from "./entorno";

async function insertar(tabla: string, fila: Record<string, unknown>): Promise<{ id: string }> {
  const { data, error } = await admin.from(tabla).insert(fila).select("id").single();
  if (error || !data) {
    throw new Error(`No pude sembrar ${tabla}: ${error?.message}`);
  }
  return data as { id: string };
}

/** `profiles` y `user_preferences` los crea el trigger `on_auth_user_created`; no se insertan. */
export async function sembrarPerfilYPreferencias(userId: string) {
  const perfil = await admin.from("profiles").select("id").eq("id", userId).single();
  const preferencias = await admin.from("user_preferences").select("user_id").eq("user_id", userId).single();
  if (perfil.error || preferencias.error) {
    throw new Error("profiles/user_preferences no se crearon por el trigger on_auth_user_created");
  }
  return { profileId: userId, preferencesUserId: userId };
}

export async function sembrarCuenta(userId: string) {
  return insertar("accounts", {
    user_id: userId,
    name: `Cuenta ${RUN_ID}`,
    type: "banco",
    currency: "PEN",
  });
}

export async function sembrarCaja(userId: string, accountId: string) {
  return insertar("boxes", {
    user_id: userId,
    account_id: accountId,
    name: `Caja ${RUN_ID}`,
    type: "objetivo",
  });
}

export async function sembrarSubcategoria(userId: string) {
  return insertar("user_subcategories", {
    user_id: userId,
    category_id: "alimentacion",
    label: `Sub ${RUN_ID}`,
    normalized_label: `sub_${RUN_ID}`,
    created_by: "user",
  });
}

export async function sembrarEtiqueta(userId: string) {
  return insertar("tags", {
    user_id: userId,
    key: `tag_${RUN_ID}`,
    label: `Etiqueta ${RUN_ID}`,
    type: "custom",
  });
}

export async function sembrarMovimiento(userId: string, accountId: string) {
  return insertar("movements", {
    user_id: userId,
    type: "gasto",
    status: "confirmed",
    amount: 10,
    currency: "PEN",
    occurred_at: new Date().toISOString(),
    category_id: "alimentacion",
    source: "dashboard_manual",
    idempotency_key: `${RUN_ID}-${randomUUID()}`,
    account_origin_id: accountId,
  });
}

export async function sembrarEtiquetaDeMovimiento(movementId: string, tagId: string) {
  const { data, error } = await admin
    .from("movement_tags")
    .insert({ movement_id: movementId, tag_id: tagId, source: "user" })
    .select("movement_id")
    .single();
  if (error || !data) throw new Error(`No pude sembrar movement_tags: ${error?.message}`);
  return { id: movementId }; // clave compuesta: se filtra por movement_id en el test
}

export async function sembrarAuditoriaDeMovimiento(userId: string, movementId: string) {
  return insertar("movement_audit_log", {
    user_id: userId,
    movement_id: movementId,
    entity_type: "movement",
    entity_id: movementId,
    action: "created",
    source: "test_rls",
    actor_type: "system",
  });
}

export async function sembrarPendiente(userId: string) {
  // source: "ambiguous_movement" — "email_pending" y "backfill_pending"
  // exigen una plantilla de correo activa (guard_email_pending_template_
  // activation, migración 034) que este fixture no necesita provisionar.
  return insertar("pending_items", {
    user_id: userId,
    type: "ambiguous_movement",
    status: "pending",
    source: "ambiguous_movement",
    proposed_action: { intent: "create_movement" },
  });
}

export async function sembrarPersonaRelacionada(userId: string) {
  return insertar("related_persons", {
    user_id: userId,
    display_name: `Persona ${RUN_ID}`,
    normalized_name: `persona_${RUN_ID}`,
  });
}

export async function sembrarDeuda(userId: string, relatedPersonId: string) {
  return insertar("debts", {
    user_id: userId,
    direction: "they_owe_me",
    related_person_id: relatedPersonId,
    name: `Deuda ${RUN_ID}`,
    principal_amount: 100,
    current_balance: 100,
  });
}

export async function sembrarCuotaDeDeuda(userId: string, debtId: string) {
  return insertar("debt_installments", {
    user_id: userId,
    debt_id: debtId,
    number: 1,
    due_date: new Date().toISOString().slice(0, 10),
    expected_amount: 50,
  });
}

export async function sembrarPagoDeDeuda(userId: string, debtId: string) {
  return insertar("debt_payments", {
    user_id: userId,
    debt_id: debtId,
    amount: 25,
  });
}

export async function sembrarAsignacionDePago(
  userId: string,
  debtId: string,
  paymentId: string,
  installmentId: string,
  movementId: string
) {
  return insertar("debt_payment_allocations", {
    user_id: userId,
    debt_id: debtId,
    debt_payment_id: paymentId,
    debt_installment_id: installmentId,
    movement_id: movementId,
    allocated_amount: 25,
    allocation_order: 1,
  });
}

export async function sembrarReglaRecurrente(userId: string) {
  return insertar("recurring_rules", {
    user_id: userId,
    name: `Recurrente ${RUN_ID}`,
    category_id: "servicios_suscripciones",
  });
}

export async function sembrarOcurrenciaRecurrente(userId: string, ruleId: string) {
  return insertar("recurring_occurrences", {
    user_id: userId,
    recurring_rule_id: ruleId,
    expected_date: new Date().toISOString().slice(0, 10),
  });
}

export async function sembrarCandidatoRecurrente(userId: string) {
  return insertar("recurring_candidates", {
    user_id: userId,
    merchant_key: `merchant_${RUN_ID}`,
    confidence: 0.9,
  });
}

export async function sembrarDescubrimiento(userId: string) {
  return insertar("insight_candidates", {
    user_id: userId,
    type: "anomaly",
    fingerprint: `fp_${RUN_ID}`,
    period_start: new Date().toISOString().slice(0, 10),
    period_end: new Date().toISOString().slice(0, 10),
    confidence: 0.9,
    quality_score: 80,
    rank_score: 80,
    title: "t",
    body: "b",
    evidence_text: "e",
  });
}

export async function sembrarEntregaDeDescubrimiento(userId: string, insightId: string) {
  return insertar("insight_deliveries", {
    user_id: userId,
    insight_candidate_id: insightId,
    channel: "dashboard",
    status: "sent",
  });
}

export async function sembrarCandidatoDeAviso(userId: string) {
  return insertar("nudge_candidates", {
    user_id: userId,
    type: "debt_due",
    source_entity_type: "debt",
    source_entity_id: randomUUID(),
    priority: 50,
  });
}

export async function sembrarEntregaDeAviso(userId: string, nudgeCandidateId: string) {
  return insertar("nudge_deliveries", {
    user_id: userId,
    nudge_candidate_id: nudgeCandidateId,
    channel: "dashboard",
    status: "candidate",
  });
}

export async function sembrarPreferenciaDeAviso(userId: string) {
  return insertar("nudge_preferences", {
    user_id: userId,
    nudge_type: "debt_due",
    channel: "dashboard",
  });
}

export async function sembrarCandidatoDeAprendizaje(userId: string) {
  return insertar("learning_candidates", {
    user_id: userId,
    kind: "preference",
    canonical_key: `key_${RUN_ID}`,
    proposal_summary: "s",
    basis: "explicit_user_statement",
    confidence: 0.9,
  });
}

export async function sembrarEvidenciaDeAprendizaje(userId: string, candidateId: string) {
  return insertar("learning_evidence", {
    user_id: userId,
    candidate_id: candidateId,
    evidence_ref: `ref_${RUN_ID}`,
    polarity: "positive",
    source_type: "test",
    weight: 0.5,
    observed_at: new Date().toISOString(),
  });
}

export async function sembrarEventoDeMemoria(userId: string) {
  return insertar("learning_memory_events", {
    user_id: userId,
    event_type: "candidate_observed",
    actor_type: "system",
    reason: "test",
    idempotency_key: `${RUN_ID}-${randomUUID()}`,
  });
}

export async function sembrarPreferenciaDeAprendizaje(userId: string) {
  const { data, error } = await admin
    .from("learning_preferences")
    .insert({ user_id: userId })
    .select("user_id")
    .single();
  if (error || !data) throw new Error(`No pude sembrar learning_preferences: ${error?.message}`);
  return { id: userId };
}

export async function sembrarMemoriaFinanciera(userId: string) {
  return insertar("financial_memory_items", {
    user_id: userId,
    kind: "preference",
    canonical_key: `key_${RUN_ID}`,
    summary: "s",
    evidence_source: "test",
    evidence_ref: `ref_${RUN_ID}`,
    confidence: 0.9,
  });
}

export async function sembrarEstadoDeConversacion(userId: string) {
  return insertar("conversation_memory_states", {
    user_id: userId,
    channel: "dashboard",
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  });
}

export async function sembrarConexionDeCorreo(userId: string) {
  return insertar("email_connections", {
    user_id: userId,
    email_address: `${RUN_ID}@example.com`,
  });
}

export async function sembrarMensajeDeCorreo(userId: string, connectionId: string) {
  return insertar("email_messages", {
    user_id: userId,
    email_connection_id: connectionId,
    provider_message_id: `msg_${RUN_ID}`,
    received_at: new Date().toISOString(),
    parsed_status: "parsed",
  });
}

export async function sembrarFuenteDeCorreo(userId: string, connectionId: string) {
  return insertar("user_email_sources", {
    user_id: userId,
    institution_key: "bcp",
    email_connection_id: connectionId,
    notification_sender: `alertas-${RUN_ID}@bcp.com.pe`,
  });
}

export async function sembrarEstadoDeVentanaWhatsapp(userId: string) {
  return insertar("whatsapp_window_states", {
    user_id: userId,
    phone: `51999${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`,
  });
}

export async function sembrarIntentoDeEntregaWhatsapp(userId: string) {
  return insertar("whatsapp_delivery_attempts", {
    user_id: userId,
    message_kind: "freeform",
    to_phone: `51999${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`,
    idempotency_key: `${RUN_ID}-${randomUUID()}`,
    trace_id: randomUUID(),
  });
}

export async function sembrarEventoDeOutbox(userId: string) {
  return insertar("transactional_outbox", {
    user_id: userId,
    event_type: "test_event",
    aggregate_type: "test",
    aggregate_id: randomUUID(),
    payload: { test: true },
    trace_id: randomUUID(),
  });
}

export async function sembrarDecisionDeDeduplicacion(userId: string) {
  return insertar("dedup_decisions", {
    user_id: userId,
    incoming_reference_id: `ref_${RUN_ID}`,
    incoming_source: "dashboard_manual",
    fingerprint: "a".repeat(64),
    status: "distinct",
  });
}

export async function sembrarEventoDePreferenciaDeExperiencia(userId: string) {
  return insertar("experience_preference_events", {
    user_id: userId,
    idempotency_key: `${RUN_ID}-${randomUUID()}`,
  });
}
