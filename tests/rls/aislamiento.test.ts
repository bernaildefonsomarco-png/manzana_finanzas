// `AC-SEG-02`, `AC-SEG-03`, `AC-PRUEBA-05` (`WEB-D156`, `51` §8, `53` D-03).
//
// Contra el stack local de Supabase (`supabase start`), no contra
// producción. No corre en `npm test` por defecto (`WEB-D158`): vive en su
// propio proyecto de Vitest, `npm run test:rls`.
//
// Patrón: el usuario B es dueño de una fila en cada una de las tablas con
// datos de usuario; el usuario A —el "intruso"— nunca debería poder leerla,
// actualizarla, ni crear una fila que reclame ser de B.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, crearUsuarioDePrueba, limpiarUsuariosDePrueba, type UsuarioDePrueba } from "./lib/entorno";
import { verificarAislamientoDeTabla, verificarEscrituraDirectaBloqueada } from "./lib/aserciones";
import * as fixtures from "./lib/fixtures";

let userA: UsuarioDePrueba;
let userB: UsuarioDePrueba;
const filas: Record<string, { id: string }> = {};

beforeAll(async () => {
  userA = await crearUsuarioDePrueba("a");
  userB = await crearUsuarioDePrueba("b");

  await fixtures.sembrarPerfilYPreferencias(userB.id);

  const cuenta = await fixtures.sembrarCuenta(userB.id);
  filas.accounts = cuenta;
  filas.boxes = await fixtures.sembrarCaja(userB.id, cuenta.id);
  filas.user_subcategories = await fixtures.sembrarSubcategoria(userB.id);
  filas.tags = await fixtures.sembrarEtiqueta(userB.id);

  const movimiento = await fixtures.sembrarMovimiento(userB.id, cuenta.id);
  filas.movements = movimiento;
  await fixtures.sembrarEtiquetaDeMovimiento(movimiento.id, filas.tags.id);
  filas.movement_audit_log = await fixtures.sembrarAuditoriaDeMovimiento(userB.id, movimiento.id);

  filas.pending_items = await fixtures.sembrarPendiente(userB.id);
  filas.related_persons = await fixtures.sembrarPersonaRelacionada(userB.id);

  const deuda = await fixtures.sembrarDeuda(userB.id, filas.related_persons.id);
  filas.debts = deuda;
  const cuota = await fixtures.sembrarCuotaDeDeuda(userB.id, deuda.id);
  filas.debt_installments = cuota;
  const pago = await fixtures.sembrarPagoDeDeuda(userB.id, deuda.id);
  filas.debt_payments = pago;
  const movimientoParaAsignacion = await fixtures.sembrarMovimiento(userB.id, cuenta.id);
  filas.debt_payment_allocations = await fixtures.sembrarAsignacionDePago(
    userB.id,
    deuda.id,
    pago.id,
    cuota.id,
    movimientoParaAsignacion.id
  );

  const regla = await fixtures.sembrarReglaRecurrente(userB.id);
  filas.recurring_rules = regla;
  filas.recurring_occurrences = await fixtures.sembrarOcurrenciaRecurrente(userB.id, regla.id);
  filas.recurring_candidates = await fixtures.sembrarCandidatoRecurrente(userB.id);

  const descubrimiento = await fixtures.sembrarDescubrimiento(userB.id);
  filas.insight_candidates = descubrimiento;
  filas.insight_deliveries = await fixtures.sembrarEntregaDeDescubrimiento(userB.id, descubrimiento.id);

  const avisoCandidato = await fixtures.sembrarCandidatoDeAviso(userB.id);
  filas.nudge_candidates = avisoCandidato;
  filas.nudge_deliveries = await fixtures.sembrarEntregaDeAviso(userB.id, avisoCandidato.id);
  filas.nudge_preferences = await fixtures.sembrarPreferenciaDeAviso(userB.id);

  const candidatoAprendizaje = await fixtures.sembrarCandidatoDeAprendizaje(userB.id);
  filas.learning_candidates = candidatoAprendizaje;
  filas.learning_evidence = await fixtures.sembrarEvidenciaDeAprendizaje(userB.id, candidatoAprendizaje.id);
  filas.learning_memory_events = await fixtures.sembrarEventoDeMemoria(userB.id);
  filas.learning_preferences = await fixtures.sembrarPreferenciaDeAprendizaje(userB.id);
  filas.financial_memory_items = await fixtures.sembrarMemoriaFinanciera(userB.id);

  filas.conversation_memory_states = await fixtures.sembrarEstadoDeConversacion(userB.id);

  const conexion = await fixtures.sembrarConexionDeCorreo(userB.id);
  filas.email_connections = conexion;
  filas.email_messages = await fixtures.sembrarMensajeDeCorreo(userB.id, conexion.id);
  filas.user_email_sources = await fixtures.sembrarFuenteDeCorreo(userB.id, conexion.id);

  filas.whatsapp_window_states = await fixtures.sembrarEstadoDeVentanaWhatsapp(userB.id);
  filas.whatsapp_delivery_attempts = await fixtures.sembrarIntentoDeEntregaWhatsapp(userB.id);
  filas.transactional_outbox = await fixtures.sembrarEventoDeOutbox(userB.id);
  filas.dedup_decisions = await fixtures.sembrarDecisionDeDeduplicacion(userB.id);
  filas.experience_preference_events = await fixtures.sembrarEventoDePreferenciaDeExperiencia(userB.id);
}, 60_000);

afterAll(async () => {
  await limpiarUsuariosDePrueba();
});

/** Las tablas con datos de usuario y fila `id` propia (`51` §8, asertos 1-3). */
const TABLAS_CON_AISLAMIENTO = [
  "accounts",
  "boxes",
  "user_subcategories",
  "tags",
  "movements",
  "movement_audit_log",
  "pending_items",
  "related_persons",
  "debts",
  "debt_installments",
  "debt_payments",
  "debt_payment_allocations",
  "recurring_rules",
  "recurring_occurrences",
  "recurring_candidates",
  "insight_candidates",
  "insight_deliveries",
  "nudge_candidates",
  "nudge_deliveries",
  "nudge_preferences",
  "learning_candidates",
  "learning_evidence",
  "learning_memory_events",
  "financial_memory_items",
  "conversation_memory_states",
  "dedup_decisions",
  "experience_preference_events",
] as const;

describe("AC-SEG-02 / AC-PRUEBA-05: aislamiento por tabla — el usuario A no ve ni toca filas de B", () => {
  it.each(TABLAS_CON_AISLAMIENTO)("%s", async (tabla) => {
    const fila = filas[tabla];
    expect(fila, `falta fixture de ${tabla}`).toBeTruthy();
    await verificarAislamientoDeTabla({
      tabla,
      clienteIntruso: userA.client,
      filaId: fila.id,
      filaDueñoId: userB.id,
    });
  });

  it("movement_tags: A no ve la etiqueta que B puso en su movimiento", async () => {
    const lectura = await userA.client
      .from("movement_tags")
      .select("*")
      .eq("movement_id", filas.movements.id);
    expect(lectura.error).toBeNull();
    expect(lectura.data?.length ?? -1).toBe(0);
  });

  it("profiles: A no ve el perfil de B (fila con id = user_id)", async () => {
    await verificarAislamientoDeTabla({
      tabla: "profiles",
      clienteIntruso: userA.client,
      filaId: userB.id,
      filaDueñoId: userB.id,
    });
  });

  it("user_preferences: A no ve las preferencias de B (fila con user_id como PK)", async () => {
    const lectura = await userA.client.from("user_preferences").select("*").eq("user_id", userB.id);
    expect(lectura.error).toBeNull();
    expect(lectura.data?.length ?? -1).toBe(0);
  });

  it("learning_preferences: A no ve las preferencias de aprendizaje de B (fila con user_id como PK)", async () => {
    const lectura = await userA.client.from("learning_preferences").select("*").eq("user_id", userB.id);
    expect(lectura.error).toBeNull();
    expect(lectura.data?.length ?? -1).toBe(0);
  });
});

describe("AC-SEG-03: el rol authenticated no escribe columnas de dinero directamente", () => {
  it("movements: inserción directa rechazada", async () => {
    await verificarEscrituraDirectaBloqueada({
      tabla: "movements",
      cliente: userB.client,
      fila: {
        user_id: userB.id,
        type: "gasto",
        status: "confirmed",
        amount: 5,
        occurred_at: new Date().toISOString(),
        source: "dashboard_manual",
        idempotency_key: `directo-${Date.now()}`,
      },
    });
  });

  it("accounts: current_balance no se puede actualizar directamente", async () => {
    const { error } = await userB.client
      .from("accounts")
      .update({ current_balance: 999999 })
      .eq("id", filas.accounts.id);
    expect(error, "actualizar current_balance debería rechazarse").not.toBeNull();
  });

  it("boxes: current_balance no se puede actualizar directamente", async () => {
    const { error } = await userB.client
      .from("boxes")
      .update({ current_balance: 999999 })
      .eq("id", filas.boxes.id);
    expect(error, "actualizar current_balance debería rechazarse").not.toBeNull();
  });

  it("debts: inserción directa rechazada", async () => {
    await verificarEscrituraDirectaBloqueada({
      tabla: "debts",
      cliente: userB.client,
      fila: {
        user_id: userB.id,
        direction: "they_owe_me",
        name: "directo",
        principal_amount: 10,
        current_balance: 10,
      },
    });
  });
});

describe("Tablas de infraestructura con RLS: sin datos de usuario que aislar, pero sin escritura de authenticated", () => {
  it("categories: catálogo global, de lectura para cualquier autenticado", async () => {
    const { data, error } = await userA.client.from("categories").select("id").limit(1);
    expect(error).toBeNull();
    expect((data?.length ?? 0) > 0).toBe(true);
  });

  it("categories: authenticated no puede insertar una categoría nueva", async () => {
    const { error } = await userA.client
      .from("categories")
      .insert({ id: `test_${Date.now()}`, label: "x", sort_order: 999 });
    expect(error).not.toBeNull();
  });

  it("email_institutions: authenticated no puede insertar una institución nueva", async () => {
    const { error } = await userA.client
      .from("email_institutions")
      .insert({ institution_key: `test_${Date.now()}`, display_name: "Test Bank" });
    expect(error).not.toBeNull();
  });

  it("worker_job_runs: authenticated no puede insertar (tabla operativa, sin user_id)", async () => {
    const { error } = await userA.client
      .from("worker_job_runs")
      .insert({ job_name: "test", trigger: "manual", trace_id: crypto.randomUUID() });
    expect(error).not.toBeNull();
  });

  it("internal_event_log: authenticated no puede insertar (tabla operativa, sin user_id)", async () => {
    const { error } = await admin.from("transactional_outbox").select("id").limit(1);
    expect(error).toBeNull(); // solo confirma que hay tabla disponible para el siguiente aserto
    const { error: insertError } = await userA.client
      .from("internal_event_log")
      .insert({ outbox_id: crypto.randomUUID(), event_type: "test", consumer_name: "test" });
    expect(insertError).not.toBeNull();
  });

  it("email_parse_templates: authenticated no puede insertar (configuración operativa, sin user_id)", async () => {
    const { error } = await userA.client
      .from("email_parse_templates")
      .insert({
        institution_key: "bcp",
        sender_pattern: `test-${Date.now()}@bcp.com.pe`,
        template_version: "v1",
      });
    expect(error).not.toBeNull();
  });

  it("external_event_log: authenticated no puede insertar directamente (webhooks, sin sesión de usuario)", async () => {
    const { error } = await userA.client.from("external_event_log").insert({
      source: "gmail",
      event_type: "test",
      idempotency_key: `test-${Date.now()}`,
      payload_hash: "a".repeat(64),
      trace_id: crypto.randomUUID(),
    });
    expect(error).not.toBeNull();
  });
});

describe("Tablas solo para service_role: ni el propio dueño lee por el cliente autenticado", () => {
  // whatsapp_window_states, whatsapp_delivery_attempts y transactional_outbox
  // no conceden ningún privilegio a `authenticated` (ni siquiera SELECT):
  // son enteramente responsabilidad del servidor. Aquí "permiso denegado"
  // para el propio B es la garantía correcta, no un fallo de aislamiento —
  // por eso no comparten aserto con las tablas de datos de usuario.
  it("whatsapp_window_states: authenticated (dueño o no) no puede leer", async () => {
    const { error } = await userB.client.from("whatsapp_window_states").select("*").limit(1);
    expect(error).not.toBeNull();
  });

  it("whatsapp_delivery_attempts: authenticated (dueño o no) no puede leer", async () => {
    const { error } = await userB.client.from("whatsapp_delivery_attempts").select("*").limit(1);
    expect(error).not.toBeNull();
  });

  it("transactional_outbox: authenticated (dueño o no) no puede leer", async () => {
    const { error } = await userB.client.from("transactional_outbox").select("*").limit(1);
    expect(error).not.toBeNull();
  });

  // email_connections, email_messages y user_email_sources sí tienen datos
  // de un usuario concreto, pero su protección es la misma que las tres de
  // arriba: ningún grant a authenticated, ni para el propio dueño. La app
  // los expone a través de rutas server-side con service-role, nunca
  // directo desde el navegador.
  it("email_connections: authenticated (dueño o no) no puede leer", async () => {
    const { error } = await userB.client.from("email_connections").select("*").limit(1);
    expect(error).not.toBeNull();
  });

  it("email_messages: authenticated (dueño o no) no puede leer", async () => {
    const { error } = await userB.client.from("email_messages").select("*").limit(1);
    expect(error).not.toBeNull();
  });

  it("user_email_sources: authenticated (dueño o no) no puede leer", async () => {
    const { error } = await userB.client.from("user_email_sources").select("*").limit(1);
    expect(error).not.toBeNull();
  });
});
