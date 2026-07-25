# 06 - Arquitectura Del Sistema - Manzana

**Ultima actualizacion:** 1 de julio, 2026  
**Estado:** V3.5 - Sincronizada con Core de deuda, workers, Fase 4 Tecnica y Fase 6 visual V1  
**Tipo:** Arquitectura tecnica transversal  

---

## 0. Decision Ejecutiva

Manzana V1 se implementa como una arquitectura financiera agentic controlada:

- WhatsApp es la interfaz principal de captura, conversacion, correccion y confirmacion.
- Dashboard es la superficie de claridad, revision, registro manual estructurado y control.
- Email Parsing captura senales pasivas, pero nunca registra movimientos sin aprobacion del usuario en V1.
- Motor IA entiende lenguaje, intencion, contexto, tono y explicacion.
- Core Financiero y Domain Engines deterministas ejecutan dinero, saldos, cajas, deudas, recurrentes, dedup, riesgo y reglas de negocio.
- Los agentes no escriben directo en la base de datos ni en el Core. Proponen, consultan con herramientas controladas y redactan.
- `CommandDispatcher` es la unica via de escritura hacia Core.
- `Transactional Outbox` protege consistencia entre movimiento, auditoria y eventos internos.
- La experiencia no se trata como una capa decorativa: Fase 3 es contrato de experiencia; Fase 6 visual es contrato de identidad, tokens, componentes, estados y handoff.

Regla base:

```text
La IA entiende y propone.
El Orchestrator decide y controla.
El dominio valida.
El Core ejecuta.
La base persiste.
El outbox publica.
La experiencia responde.
```

---

## 1. Alcance De Este Documento

Este documento define la columna vertebral tecnica de Manzana V1. No reemplaza los documentos por feature; los integra.

### 1.1 Fuentes de verdad

| Area | Fuente principal |
|---|---|
| Producto V1 | `especificacion_producto_finanzas_personales_ia.md` |
| Alcance V1 | `docs/fase_2_estrategia/alcance_v1/indice.md` |
| WhatsApp | `05a_whatsapp.md` |
| Motor IA | `05b_motor_ia.md` |
| Dashboard | `05c_dashboard.md`, `17_dashboard_ux.md`, `18_wireframes_prototipo.md`; Fase 6 para identidad visual, tokens, componentes y handoff |
| Email Parsing | `05d_email_parsing.md` |
| Cuentas/Cajas | `05e_cuentas_cajas.md` |
| Categorias | `05f_categorias.md` |
| Insights | `05g_insights.md` |
| Deudas | `05h_deudas.md` |
| Recurrentes | `05i_recurrentes.md` |
| Nudges | `05j_nudges.md` |
| Experiencia | `docs/fase_3_producto/10` a `18` |
| Identidad visual y UI | `docs/fase_6_visual/indice.md` y documentos 28-33 |
| Stack | `docs/fase_4_tecnica/15_stack_tecnologico.md` |
| Decisiones tecnicas | `docs/fase_4_tecnica/20_decisiones_tecnicas.md` |
| Decision WhatsApp Provider | `docs/fase_4_tecnica/21_decision_whatsapp_provider.md` |
| Decision Email Provider | `docs/fase_4_tecnica/22_decision_email_provider.md` |
| Modelo de datos | `docs/fase_4_tecnica/16_modelo_datos.md` |
| Eventos y workers | `docs/fase_4_tecnica/17_eventos_workers.md` |
| API | `docs/fase_4_tecnica/18_api_spec.md` |
| Agent Runtime y Tools | `docs/fase_4_tecnica/19_agent_runtime_tools.md` |
| Plan de implementacion | `docs/fase_4_tecnica/23_plan_implementacion_v1.md` |

### 1.2 Que resuelve

- Como entran eventos desde WhatsApp, Dashboard, Email y automatizaciones.
- Como se orquestan agentes, motores deterministas, politicas y Core.
- Como se separan eventos externos de eventos internos.
- Como se protege consistencia financiera con outbox y auditoria.
- Como los agentes consultan memoria sin cargar todo el historial.
- Como se preserva experiencia premium: claridad, cero culpa, modo discreto, confianza, identidad visual y uso progresivo.

### 1.3 Que resuelve en documentos companeros

Este documento es el mapa transversal. Los detalles implementables viven en documentos companeros de Fase 4:

- Stack tecnologico: `15_stack_tecnologico.md`.
- Decision log tecnico: `20_decisiones_tecnicas.md`.
- Decision WhatsApp Provider: `21_decision_whatsapp_provider.md`.
- Decision Email Provider: `22_decision_email_provider.md`.
- Modelo de datos y SQL contract: `16_modelo_datos.md`.
- Eventos, outbox y workers: `17_eventos_workers.md`.
- API y webhooks: `18_api_spec.md`.
- AgentRuntime, Context Packs tecnicos y ToolGateway: `19_agent_runtime_tools.md`.
- Orden de construccion por cortes: `23_plan_implementacion_v1.md`.
- Identidad visual, design system, prototipo/handoff y UX psicologica visual: Fase 6 visual V1.

Quedan fuera de Fase 4 V1:

- Multi-moneda UI completa.
- Integraciones bancarias directas.
- Shareables.
- Metas/limites como feature formal.
- Logo final profesional y manual de marca extendido.

---

## 2. Principios Arquitectonicos

| # | Principio | Regla operativa |
|---|---|---|
| 1 | Core primero | Todo cambio financiero pasa por Core Financiero. |
| 2 | IA sin autoridad financiera | Agentes proponen o explican; no mutan dinero. |
| 3 | Determinismo donde importa | Saldos, deudas, recurrentes, dedup, riesgo y permisos son reglas/motores, no conversacion libre. |
| 4 | Contexto minimo | Agentes reciben Context Packs por tarea, no un JSON global pesado. |
| 5 | Memoria consultable | La memoria vive en DB/Core y se recupera con herramientas read-only. Supabase/PostgreSQL/Auth/RLS es stack base aprobado. |
| 6 | Eventos seguros | Eventos internos salen de `transactional_outbox`, no directo de adaptadores ni agentes. |
| 7 | Entrada y dominio separados | Eventos externos de entrada no son el mismo bus que eventos internos de dominio. |
| 8 | Experiencia progresiva | El usuario puede empezar sin cuentas, cajas, email, deudas ni configuracion pesada. |
| 9 | Privacidad transversal | Modo discreto, opt-in, horario silencioso y sensibilidad pasan por Policy/Risk. |
| 10 | Observabilidad por defecto | Cada decision importante deja traza segura, sin guardar razonamiento sensible. |

---

## 3. Vista General: Grafo Orquestado

La arquitectura no es una tuberia lineal. Es un grafo controlado por `FinancialOrchestrator`.

```text
External Channels
  WhatsApp | Dashboard | Email | Scheduler | Workers
        |
        v
External Event Gateway
  idempotency | auth | source validation | rate limit
        |
        v
FinancialOrchestrator
  IntakeRouter
  ConversationKernel
  IntentRouter
  ExperienceModeRouter
  WorkflowPlanner
  AgentPlanner
  RuntimeRouter
  ContextPackBuilder
  ToolGateway
  PolicyGate
  ExecutionEngine
  CommandDispatcher
  ResponsePlanner
  TraceCollector
        |
        +--> AgentRuntime / ModelRuntime
        |      DataAgent
        |      ConversationAgent
        |      CorrectionAgent
        |      ResponseAgent
        |      InsightExperienceAgent
        |      InsightNarratorAgent
        |
        +--> Domain Engines
        |      Balance Engine
        |      Debt Engine
        |      Recurring Engine
        |      Dedup Engine
        |      Pending Inbox
        |      Insight Engines
        |      Nudge Policy Engine
        |      Risk Policy
        |      Disclosure Engine
        |      Learning Engine
        |      BudgetGoalReactor hook
        |
        +--> Core Financiero
               movimientos | cuentas | cajas | deudas | recurrentes
               audit_log | transactional_outbox
                         |
                         v
                  Outbox Worker
                         |
                         v
              Internal Domain Event Bus
                         |
                         v
      Dashboard projections | Insights | Nudges | Learning | Metrics
```

### 3.1 Regla de activacion

No trabajan todos los agentes siempre. El orquestador activa lo minimo necesario segun intencion, riesgo, confianza y canal.

| Caso | Agentes posibles | Motores obligatorios |
|---|---|---|
| "Gaste 8 en cafe" | `DataAgent`, plantilla o `ResponseAgent` | Core, Balance, audit, outbox |
| "Gaste 8 cafe, 15 taxi y 20 almuerzo" | `DataAgent`, plantilla o `ResponseAgent` | Core, Balance, Dedup |
| "Eso no fue gasto, fue prestamo a Luis" | `CorrectionAgent`, `ResponseAgent` | Core, Debt Engine, Learning |
| "Puedo gastar S/50 hoy?" | `ConversationAgent` | Balance, Debt, Recurring, tools read-only |
| Email bancario detectado | `DataAgent`, plantilla o `ResponseAgent` | Email Adapter, Dedup, Pending Inbox |
| Recurrente detectado | Ninguno o `ResponseAgent` | Recurring Engine, Pending/Confirmation |
| Cuota proxima | Plantilla o `ResponseAgent` | Debt Engine, Nudge Policy, Risk |
| Insight sensible | `InsightExperienceAgent`, `InsightNarratorAgent` | Insight QualityGate, Risk, Nudge Policy |
| Dashboard manual estructurado | Ninguno por defecto | Validadores, Core, PolicyGate |

---

## 4. Capas Logicas

Manzana se organiza en 7 capas logicas. La numeracion mantiene compatibilidad con referencias previas en otros documentos.

```text
Capa 6 - Experiencia
Capa 5 - Canales
Capa 4 - Automatizacion y workers
Capa 3 - Inteligencia agentic
Capa 2 - Orquestacion
Capa 1 - Core Financiero y Domain Engines
Capa 0 - Datos, seguridad y persistencia

Transversal - External Event Gateway, Transactional Outbox, Internal Domain Event Bus, Observabilidad
```

---

## Capa 0: Datos, Seguridad Y Persistencia

### Responsabilidad

Persistir informacion, proteger datos, garantizar multi-tenant seguro, registrar auditoria y soportar consultas.

### Componentes

| Componente | Responsabilidad |
|---|---|
| Supabase/PostgreSQL | Base principal de datos aprobada para V1. |
| Auth | Usuarios, sesiones y tokens. |
| RLS | Cada usuario solo accede a sus datos. |
| Repositories | Acceso controlado a tablas; no exponer DB cruda a agentes. |
| Audit Log | Historial inmutable de cambios financieros. |
| Transactional Outbox | Eventos internos escritos en la misma transaccion que cambia dinero. |
| External Event Log | Idempotencia y trazabilidad de eventos externos. |
| Secrets/Vault | OAuth tokens, claves y credenciales. |
| Backups | Recuperacion ante fallos. |
| Consent Store | Opt-ins, modo discreto, email, nudges y preferencias. |

### Entidades principales V1

```text
users
user_preferences
accounts
boxes
movements
movement_audit_log
pending_items
categories
user_subcategories
tags
debts
debt_payments
debt_installments
related_persons
recurring_rules
recurring_occurrences
recurring_candidates
insights
insight_events
nudge_preferences
nudge_candidates
nudge_deliveries
conversations
conversation_states
learning_signals
email_connections
external_event_log
transactional_outbox
internal_event_log
agent_traces
```

### Separacion de nombres

| Nombre | Que es | Que no es |
|---|---|---|
| Core Financiero | Capa de dominio que valida y ejecuta comandos financieros. | No es la base de datos. |
| Persistence Layer | Repositories y transacciones contra PostgreSQL. | No decide reglas financieras. |
| Supabase/PostgreSQL | Almacenamiento aprobado para V1. | No contiene logica de producto por si sola. |
| Domain Engines | Motores deterministas especializados. | No son agentes LLM. |

### Auditoria financiera

Toda escritura financiera debe producir auditoria:

```json
{
  "entity_type": "movement",
  "entity_id": "mov_001",
  "action": "update",
  "field": "amount",
  "old_value": 15,
  "new_value": 18,
  "source": "whatsapp_correction",
  "actor": "user",
  "created_at": "2026-05-26T10:00:00Z"
}
```

No se guarda chain-of-thought. Se guardan decisiones, inputs relevantes, version de prompt/modelo, confianza, politicas aplicadas y resultado.

---

## Capa 1: Core Financiero Y Domain Engines

### Responsabilidad

Mantener la verdad financiera. Esta capa debe seguir funcionando aunque se apague IA, WhatsApp o Dashboard.

### Core Financiero

Core ejecuta comandos transaccionales:

- crear movimiento,
- confirmar pendiente,
- editar movimiento,
- soft delete,
- crear/editar cuenta,
- crear/editar caja,
- crear/actualizar deuda,
- registrar pago/devolucion,
- crear/confirmar recurrente,
- registrar ajuste,
- guardar auditoria,
- escribir eventos en `transactional_outbox`.

### Tipos canonicos de movimiento V1

```text
gasto
ingreso
transferencia
asignacion_interna
deuda_adquirida
pago_deuda
prestamo_dado
prestamo_recibido
devolucion_recibida
pago_recurrente
ajuste
```

### Reglas de negocio no negociables

| Regla | Duenio |
|---|---|
| Transferencia entre cuentas propias no es gasto. | Core + Balance Engine |
| Asignacion interna no es gasto. | Core + Balance Engine |
| Pendiente no afecta saldo hasta confirmacion. | Pending Inbox + Core |
| Email no confirmado no crea movimiento real. | Email Adapter + Pending Inbox + Core |
| Recurrente esperado no modifica saldo de cuenta. | Recurring Engine + Balance |
| Pago recurrente solo existe si hay pago real/confirmado. | Core + Recurring |
| `pago_deuda` no es gasto generico. | Core + Debt Engine |
| Cuenta `null` es valida cuando falta informacion. | Core + Balance |
| Cuenta `null` no afecta saldo de cuentas ni dinero libre financiero. | Balance Engine |
| Cuenta `null` si alimenta analitica de gastos/ingresos con calidad marcada. | Insights + Dashboard |
| Saldo negativo se permite con advertencia. | Core + Balance |
| Soft delete siempre. | Core |
| Acciones de alto riesgo requieren confirmacion explicita. | PolicyGate + Core |

### Cuentas y cajas

- Una cuenta representa donde esta el dinero: Yape, BCP, efectivo, etc.
- Una caja representa para que es el dinero.
- Una caja pertenece a una cuenta especifica (`cuenta_id` obligatorio).
- El Dashboard puede agregar visualmente cajas de varias cuentas.
- Caja libre no es entidad en DB; es calculo.

```text
libre_en_cuenta = saldo_cuenta - suma(cajas_en_cuenta)
libre_en_cuentas_global = suma(libre_en_cuenta)
dinero_libre_operativo =
  libre_en_cuentas_global
  - deudas/cuotas/pagos_que_vienen_no_cubiertos_por_caja
```

### Domain Engines deterministas

| Motor | Responsabilidad |
|---|---|
| Balance Engine | Saldos por cuenta, cajas, libre en cuentas, dinero libre operativo, advertencias. |
| Debt Engine | Deudas, cuotas, pagos, devoluciones, progreso, vencimientos, personas relacionadas. |
| Recurring Engine | Reglas recurrentes, ocurrencias, candidatos, pagos que vienen, cambios de monto. |
| Dedup Engine | Duplicados entre WhatsApp, Email, Dashboard y recurrentes. |
| Pending Inbox | Pendientes por confirmar, TTL, batch, estados y resolucion. |
| InsightSignalEngine | Detecta candidatos a descubrimientos. |
| InsightQualityGate | Valida evidencia, privacidad y calidad de insight. |
| InsightRanker | Prioriza descubrimientos por utilidad, evidencia y momento. |
| NudgePolicyEngine | Decide si/cuando/como enviar recordatorios. |
| RiskPolicy | Sensibilidad, modo discreto, confirmaciones y privacidad. |
| DisclosureEngine | Decide que mostrar segun datos, plan, canal y estado de usuario. |
| Learning Engine | Aprende correcciones, patrones y preferencias sin saltarse consentimiento. |
| BudgetGoalReactor | Hook opcional para metas/limites si existen configurados. |

### Motores de experiencia

Los motores de experiencia pueden ejecutarse antes, durante o despues de agentes:

| Momento | Motores |
|---|---|
| Antes del agente | ExperienceIntelligenceEngine, ClarificationStrategyEngine, PolicyGate. |
| Durante consulta | FinancialQueryTools, PatternMemory, MicroReconstructionEngine. |
| Despues del Core | TrustExperienceLayer, ResponsePlanner, ActionableInsightEngine. |
| Async | DailyWeeklyReviewEngine, PersonalizationLoopEngine, Learning Engine. |

---

## Capa 2: Orquestacion

### FinancialOrchestrator

El `FinancialOrchestrator` coordina. No reemplaza al Core, no contiene toda la logica financiera y no debe convertirse en una funcion gigante.

```text
FinancialOrchestrator
  IntakeRouter
  ConversationKernel
  IntentRouter
  ExperienceModeRouter
  WorkflowPlanner
  AgentPlanner
  RuntimeRouter
  ContextPackBuilder
  ToolGateway
  PolicyGate
  ExecutionEngine
  CommandDispatcher
  ResponsePlanner
  TraceCollector
```

| Modulo | Responsabilidad |
|---|---|
| IntakeRouter | Normaliza entrada por canal y crea un evento de trabajo. |
| ConversationKernel | Estado, continuidad, cancelaciones, cambio de intencion y expiracion suave. |
| IntentRouter | Detecta si es registro, consulta, correccion, deuda, recurrente, configuracion, ayuda, etc. |
| ExperienceModeRouter | Decide modo: captura rapida, analisis profundo, reconstruccion, deuda, revision, onboarding. |
| WorkflowPlanner | Crea plan de pasos: agente, motor, politica, comando, respuesta. |
| AgentPlanner | Decide que agente se invoca y cuando se salta. |
| RuntimeRouter | Decide Codex/API/hibrido por tarea, costo, riesgo y calidad. |
| ContextPackBuilder | Construye el contexto minimo para agente/herramienta/respuesta. |
| ToolGateway | Expone herramientas read-only para agentes; los comandos de escritura pasan por `CommandDispatcher`. |
| PolicyGate | Veta, pausa o exige confirmacion por riesgo, privacidad, plan, opt-in o modo discreto. |
| ExecutionEngine | Ejecuta el plan con idempotencia, retry controlado y timeouts. |
| CommandDispatcher | Traduce acciones aprobadas a comandos Core. |
| ResponsePlanner | Decide plantilla, ResponseAgent, ConversationAgent o respuesta mixta. |
| TraceCollector | Guarda trazas seguras: latencia, calidad, costo, confianza y outcome. |

### Orden base de ejecucion

```text
External event
  -> IntakeRouter
  -> ConversationKernel
  -> IntentRouter
  -> ExperienceModeRouter
  -> WorkflowPlanner
  -> ContextPackBuilder
  -> AgentPlanner / Domain Engine
  -> PolicyGate pre-execution
  -> ExecutionEngine
  -> CommandDispatcher
  -> Core / Domain Engines
  -> PolicyGate post-execution
  -> ResponsePlanner
  -> TraceCollector
```

### Conversation State Machine

Los estados conversacionales viven en persistencia, no en memoria del proceso.

Estados V1:

```text
idle
processing
awaiting_clarification
awaiting_confirmation
awaiting_risk_confirmation
editing_movement
creating_debt
creating_pocket
reviewing_pending
onboarding
help
error_recovery
cancelled
completed
expired
```

Reglas:

- Todo estado que espera respuesta tiene expiracion.
- El usuario puede cancelar desde cualquier estado.
- El usuario puede cambiar de tema; el estado anterior se pausa.
- Acciones peligrosas exigen confirmacion explicita.
- Un estado nunca bloquea al usuario para hacer otra cosa.

### Acciones de alto riesgo

| Accion | Confirmacion |
|---|---|
| Borrar multiples movimientos | Frase explicita tipo "si, borrar". |
| Eliminar cuenta | Confirmar impacto y conservar historial. |
| Cerrar/cancelar deuda | Confirmar saldo y consecuencia. |
| Mover dinero de emergencia a libre | Confirmar salida de caja sensible. |
| Confirmar batch grande | Preguntar si confirma todos o revisa uno por uno. |
| Desconectar email | Confirmar que se detiene captura pasiva. |

---

## Capa 3: Inteligencia Agentic

### Responsabilidad

Entender lenguaje, contexto, intencion, correcciones, preguntas y tono. No calcular saldos finales ni mutar dinero.

### Agentes V1

| Agente | Hace | No hace |
|---|---|---|
| DataAgent | Extrae intencion, tipo financiero y acciones propuestas. | No escribe al Core, no inventa cuentas/categorias. |
| ConversationAgent | Responde consultas con herramientas read-only. | No ejecuta mutaciones. |
| CorrectionAgent | Interpreta correcciones y propone cambios. | No aplica cambios directo. |
| ResponseAgent | Redacta respuesta final en tono Manzana. | No decide politicas ni envio proactivo. |
| InsightExperienceAgent | Decide framing y timing de descubrimientos validados. | No calcula insights. |
| InsightNarratorAgent | Narra descubrimientos con evidencia y tono. | No inventa patrones. |

### AgentRuntime / ModelRuntime

V1 es Codex-first, API-ready:

```ts
type RuntimeProvider = "codex" | "api";

type AgentRuntimeRequest<TContext> = {
  agent: string;
  provider: RuntimeProvider;
  model_hint?: "cheap" | "balanced" | "strong";
  context_pack: TContext;
  tools: string[];
  output_schema: string;
  trace_id: string;
};
```

La migracion futura a API no elimina agentes. Significa que el mismo agente deja de usar el LLM de Codex como runtime y pasa a usar un modelo via API detras de `AgentRuntime`.

Candidatos tempranos a API barata:

- `DataAgent`,
- `CorrectionAgent`,
- `ResponseAgent` simple.

`ConversationAgent` puede quedarse mas tiempo en Codex o modelo fuerte si requiere mejor razonamiento, memoria consultable y explicacion financiera.

### ToolGateway

Los agentes pueden consultar datos solo mediante herramientas con permisos:

```text
get_recent_movements(user_id, filters)
query_movements_by_date(user_id, date_range)
get_balance_snapshot(user_id)
get_debt_summary(user_id)
get_recurring_summary(user_id)
get_pending_summary(user_id)
search_financial_memory(user_id, query)
explain_insight_evidence(insight_id)
```

Reglas:

- No hay conexion cruda de agente a DB.
- Herramientas read-only para agentes.
- Si una consulta deriva en accion, vuelve al Orchestrator y pasa por PolicyGate/Core.
- Las herramientas devuelven datos filtrados, paginados y con limites por plan/riesgo.

---

## 5. Contexto, Memoria Y Context Packs

### Tesis

El contexto del usuario crece indefinidamente, pero el prompt no. La memoria vive en base/Core; cada tarea recibe solo un Context Pack.

### Context Packs V1

| Context Pack | Uso |
|---|---|
| DataContextPack | Registro y extraccion de movimientos. |
| ConversationContextPack | Preguntas financieras y busqueda natural. |
| CorrectionContextPack | Correcciones. |
| InsightContextPack | Descubrimientos y narrativa. |
| NudgeContextPack | Recordatorios y avisos. |
| RiskContextPack | Privacidad, sensibilidad y confirmaciones. |
| DebtContextPack | Deudas, cuotas y personas relacionadas. |
| RecurringContextPack | Pagos que vienen, ocurrencias y candidatos. |

### Memoria completa

Vive en persistencia:

- movimientos confirmados,
- pendientes,
- cuentas/cajas,
- deudas,
- recurrentes,
- categorias/subcategorias/tags,
- correcciones,
- learning signals,
- preferencias de tono,
- opt-ins,
- modo discreto,
- historial de nudges,
- conversaciones activas/archivadas,
- insights vistos/ignorados/actuados.

### Preguntas historicas

Consultas como "que gastos hice el ultimo viernes de hace 4 meses" no se resuelven metiendo todo el historial al prompt.

Flujo:

```text
Usuario pregunta
  -> ConversationAgent recibe ConversationContextPack minimo
  -> ToolGateway ejecuta query por fecha/rango
  -> herramienta devuelve movimientos relevantes
  -> ConversationAgent sintetiza
  -> ResponsePlanner aplica tono, privacidad y fuente
```

Respuesta debe separar:

- movimientos confirmados,
- pendientes,
- movimientos sin cuenta,
- datos incompletos,
- limite de busqueda si aplica.

---

## Capa 4: Automatizacion Y Workers

### Responsabilidad

Ejecutar procesos asincronos, deteccion y mantenimiento sin bloquear al usuario.

| Worker/Motor | Funcion |
|---|---|
| Email Ingestion Worker | Recibe push/webhook, filtra y parsea email. |
| Pending Worker | Maneja TTL, batch nocturno y archivo. |
| Outbox Worker | Publica eventos internos desde `transactional_outbox`. |
| Recurring Detection Worker | Detecta patrones de pagos que vuelven. |
| Insight Worker | Genera candidatos, valida, rankea y actualiza descubrimientos. |
| Nudge Scheduler | Evalua candidatos de recordatorio y agenda/envia si pasa politica. |
| Learning Worker | Procesa correcciones y outcomes. |
| Recalculation Worker | Recalcula balances/proyecciones cuando hay cambios relevantes. |

### Bandeja de Pendientes

Principio:

```text
Pendiente no es movimiento confirmado.
Pendiente no afecta saldo.
Pendiente existe para no perder informacion sin quitar control.
```

Tipos de pendientes:

- email detectado,
- movimiento ambiguo,
- candidato recurrente,
- batch de backfill,
- clasificacion dudosa,
- dato incompleto de alto impacto.

Estados:

```text
pending
sent_for_confirmation
user_confirmed
user_edited
discarded
auto_resolved_duplicate
expired
archived
```

Email V1:

- Confirmacion individual por WhatsApp si politica lo permite.
- Batch nocturno o Dashboard si hay demasiados pendientes.
- Backfill inicial siempre va a Dashboard agrupado.
- Nada de email registra sin aprobacion del usuario.

---

## Capa 5: Canales

### Principio

Canales son adaptadores. No deciden reglas financieras.

| Canal | Direccion | Rol |
|---|---|---|
| WhatsApp | Entrada y salida | Captura, consultas, correcciones, confirmaciones, recordatorios. |
| Dashboard/Web App | Entrada y salida | Revision, control, registro manual, busqueda natural, pendientes, configuracion. |
| Email | Solo entrada | Captura pasiva de senales financieras. |
| Scheduler/Workers | Entrada tecnica | Eventos programados, vencimientos, revisiones, recalculos. |

### WhatsApp Adapter

Hace:

- valida webhook,
- identifica usuario,
- normaliza texto,
- registra evento externo,
- envia mensajes aprobados por ResponsePlanner,
- maneja delivery/retry tecnico.

No hace:

- clasificar movimientos,
- calcular saldos,
- decidir nudges,
- escribir Core.

### WhatsApp Window Manager

Controla calidad/costo sin degradar la experiencia:

- conoce si la ventana de 24h esta abierta, por cerrar o cerrada,
- permite resolver por WhatsApp cuando la ventana esta abierta,
- permite prompts de continuidad a las 12h y, solo si politica lo aprueba, un prompt opcional a las 20h,
- puede abrir WhatsApp Flow cuando hay varios pendientes o una accion estructurada,
- evita templates pagados repetidos cuando el usuario no responde,
- deriva acumulados al Centro de Confirmaciones/Dashboard/app,
- mantiene WhatsApp como canal principal para claridad, confirmaciones e insights de alto valor.

Regla:

```text
Pagar WhatsApp cuando abre claridad.
No pagar WhatsApp para insistir sin respuesta.
No esconder valor real en Dashboard solo por costo.
```

### Dashboard/Web Adapter

Hace:

- auth,
- render de datos,
- filtros/paginacion,
- formularios estructurados,
- busqueda natural read-only,
- acciones de confirmar/editar/descartar pendientes.

Reglas:

- Registro manual estructurado desde Dashboard va a validadores/Core sin DataAgent por defecto.
- Si hay texto libre de ayuda, puede invocar Motor IA, pero guardar siempre pasa por Core.
- Busqueda natural es read-only; no crea movimientos desde la barra de busqueda.

### Email Adapter

Hace:

- OAuth,
- Gmail API + Pub/Sub como proveedor V1,
- renovacion de watch y manejo de `historyId`,
- filtrado de remitentes,
- templates/parsing,
- extraccion minima,
- idempotencia de emails,
- envio al Orchestrator como evento externo.

No hace:

- registrar movimientos,
- decidir categoria final,
- actualizar deuda/recurrente sin confirmacion.
- pedir contrasenas, usar scraping o automatizar inbox fuera de APIs oficiales.

---

## Capa 6: Experiencia

### Responsabilidad

Convertir el sistema correcto en una experiencia que el usuario sienta clara, tranquila y util.

Fase 3 es contrato:

- claridad antes que densidad,
- cero culpa,
- uso parcial valido,
- primer valor rapido,
- privacidad como experiencia,
- correcciones sin friccion,
- estados vacios cuidados,
- busqueda natural sin parecer chatbot generico,
- dashboard como control, no tabla fria.

### Componentes de experiencia

| Componente | Funcion |
|---|---|
| Disclosure Engine | Decide que mostrar segun madurez, datos y uso parcial. |
| TrustExperienceLayer | Fuente, confianza, explicacion y corregibilidad. |
| Empty State System | Estados vacios con accion pequena. |
| ResponsePlanner | Selecciona plantilla/agente/canal. |
| Tone Adapter | Aplica personalidad, longitud y sensibilidad. |
| Discreet Mode Presenter | Oculta detalles sensibles en canales externos. |
| Onboarding/Activation Engine | Primer uso, primer registro, primer valor. |
| Lifecycle Engine | D1, D3, D7, D14, D30, reactivacion y supresion. |

### Naming visible

| Interno | Visible |
|---|---|
| Insights | Descubrimientos, Lo que Manzana noto |
| Pending Inbox | Pendientes, Por revisar |
| Recurrentes | Pagos que vienen |
| Nudges | Recordatorios, Avisos |
| Operational free money | Dinero libre operativo |
| Tags | Etiquetas |

---

## 6. Eventos: Entrada Externa Vs Dominio Interno

### Problema que se evita

Si el mismo Event Bus recibe eventos externos e internos sin separacion, aparecen loops:

```text
evento -> orchestrator -> evento -> orchestrator -> ...
```

### Separacion obligatoria

| Tipo | Donde vive | Ejemplos | Puede escribir Core? |
|---|---|---|---|
| External Input Event | External Event Gateway / external_event_log | WhatsApp message, email push, dashboard action, scheduler tick | Solo despues de orquestacion y politicas |
| Internal Domain Event | transactional_outbox -> Internal Domain Event Bus | movement_created, debt_paid, insight_validated | Ya representa un hecho persistido |

### External Input Event

```json
{
  "event_id": "ext_001",
  "source": "whatsapp",
  "type": "message_received",
  "user_id": "usr_123",
  "idempotency_key": "wa_msg_abc",
  "received_at": "2026-05-26T10:00:00Z"
}
```

### Internal Domain Event

```json
{
  "event_id": "evt_001",
  "event_type": "movement_created",
  "aggregate_type": "movement",
  "aggregate_id": "mov_123",
  "user_id": "usr_123",
  "occurred_at": "2026-05-26T10:00:01Z",
  "payload_version": 1
}
```

### Transactional Outbox

Flujo correcto:

```text
Core ejecuta transaccion
  -> guarda movimiento/deuda/recurrente
  -> guarda audit_log
  -> guarda evento en transactional_outbox
  -> commit

Outbox Worker
  -> lee eventos pending
  -> publica al Internal Domain Event Bus
  -> marca published o retry
```

Esto evita:

- movimiento guardado pero evento no publicado,
- evento publicado pero transaccion fallida,
- duplicados sin idempotencia,
- consumidores leyendo hechos que no existen.

### Eventos internos V1

El catalogo canonico de eventos internos vive en `17_eventos_workers.md`.
Esta arquitectura no mantiene un segundo enum para evitar drift entre
outbox, workers y proyecciones.

Familias V1:

```text
movement_*
pending_*
account_*
box_*
balance_*
debt_*
recurring_*
insight_*
nudge_*
learning_*
email_*
system_*
```

Reglas:

- Si un worker, comando o motor necesita un evento nuevo, primero se agrega al catalogo canonico de `17_eventos_workers.md`.
- `06_arquitectura_sistema.md` describe la arquitectura y las familias de eventos, no el enum operativo.

---

## 7. Flujos Tecnicos Principales

### 7.1 Registro simple por WhatsApp

```text
WhatsApp message: "Gaste 8 en cafe"
  -> WhatsApp Adapter
  -> External Event Gateway
  -> FinancialOrchestrator
  -> ContextPackBuilder: DataContextPack
  -> DataAgent: proposed_action gasto S/8 cafe
  -> PolicyGate pre-execution
  -> CommandDispatcher
  -> Core crea movimiento
  -> audit_log + transactional_outbox
  -> ResponsePlanner: plantilla breve
  -> WhatsApp Adapter envia confirmacion
```

No se invoca `ConversationAgent` porque no hay pregunta.

### 7.2 Registro multiple

```text
"Hoy gaste 8 cafe, 15 taxi y 20 almuerzo"
  -> DataAgent devuelve 3 proposed_actions
  -> validadores revisan cada accion
  -> Core crea movimientos separados en transaccion logica
  -> outbox publica eventos
  -> ResponsePlanner confirma compacto
```

### 7.3 Correccion

```text
"Eso no fue gasto, fue prestamo a Luis"
  -> ConversationKernel busca contexto activo o ultimo movimiento candidato
  -> CorrectionAgent propone cambio
  -> PolicyGate revisa riesgo
  -> Core edita movimiento / crea-vincula deuda segun corresponda
  -> Learning Engine guarda patron
  -> ResponsePlanner confirma sin culpar
```

### 7.4 Dashboard manual estructurado

```text
Dashboard Form
  -> Web Adapter
  -> External Event Gateway
  -> FinancialOrchestrator
  -> PolicyGate / validadores
  -> CommandDispatcher
  -> Core
  -> outbox
  -> Dashboard actualiza estado
```

No se invoca DataAgent si el formulario entrega campos estructurados. Puede haber sugerencias de categoria/cuenta, pero el usuario ve y confirma.

### 7.5 Busqueda natural en Dashboard

```text
"gastos del ultimo viernes de hace 4 meses"
  -> Web Adapter
  -> Orchestrator
  -> ConversationContextPack
  -> ConversationAgent
  -> ToolGateway query por fecha
  -> respuesta read-only
```

No crea ni modifica datos.

### 7.6 Email detectado

```text
Email push
  -> Email Adapter parsea datos minimos
  -> External Event Gateway
  -> DataAgent normaliza tipo/cuenta/categoria sugerida
  -> Dedup Engine
  -> Pending Inbox crea pendiente
  -> PolicyGate decide canal/momento
  -> WhatsApp o Dashboard pide confirmacion
  -> Usuario confirma
  -> Core crea movimiento
```

Regla V1: email nunca registra sin aprobacion.

### 7.7 Pago recurrente

```text
Recurring Engine detecta ocurrencia esperada
  -> no modifica saldo
  -> NudgePolicy puede crear recordatorio si hay opt-in

Usuario confirma pago
  -> Core crea movimiento pago_recurrente
  -> Balance Engine actualiza cuenta/caja si existe
  -> Recurring Engine marca ocurrencia pagada
  -> outbox publica eventos
```

### 7.8 Deuda y cuota

```text
"Pague la cuota de la tarjeta"
  -> DataAgent detecta posible pago_deuda
  -> Debt Engine busca deuda/cuotavinculada
  -> si hay ambiguedad, preguntar
  -> Core registra pago_deuda
  -> Debt Engine asigna primero a la cuota abierta mas antigua
  -> si sobra monto, continua con las siguientes cuotas abiertas
  -> Debt Engine reduce saldo/progreso y actualiza paid_amount/status
  -> Balance Engine actualiza cuenta si se conoce
  -> asignaciones, deuda, movimiento, saldos y outbox confirman atomicamente
  -> Debt Lifecycle reevalua estados de fecha y aviso debt_due
  -> si la proyeccion inmediata falla, outbox/cron diario la recuperan
```

El refresco de ciclo de deuda es una operacion deterministica de Core:

- bloquea cuotas/deudas abiertas antes de cambiar estado,
- persiste solo `status` y metadata de transicion,
- escribe sus eventos en outbox dentro de la misma transaccion,
- no modifica saldos, importes, pagos ni movimientos,
- puede repetirse sin duplicar transiciones ni eventos.

### 7.9 Insight / Descubrimiento

```text
movement_created / batch diario
  -> InsightSignalEngine crea candidato
  -> InsightQualityGate valida evidencia
  -> InsightRanker prioriza
  -> InsightExperienceAgent si es sensible, diferencial o va por WhatsApp
  -> InsightNarratorAgent o plantilla redacta
  -> DeliveryPlanner decide Dashboard/WhatsApp
  -> NudgePolicy si WhatsApp
```

### 7.10 Nudge / Recordatorio

```text
Debt Engine / Recurring Engine / Pending Inbox / Insight
  -> crea NudgeCandidate
  -> NudgePolicyEngine valida opt-in, frecuencia, horario, supresion
  -> RiskPolicy aplica sensibilidad y modo discreto
  -> ResponseAgent o plantilla redacta
  -> Delivery Adapter envia
```

El LLM no decide interrumpir al usuario.

---

## 8. Privacidad, Riesgo Y Modo Discreto

### Modo discreto

Modo discreto es una politica transversal de salida, no una feature de WhatsApp solamente.

| Canal | Regla V1 |
|---|---|
| WhatsApp | Ocultar monto/comercio/persona/categoria sensible en mensajes proactivos o confirmaciones sensibles. |
| Dashboard autenticado | Puede mostrar datos completos; debe tener base para previews sensibles y futuros blur. |
| Email | No envia datos al usuario; protege tokens y logs. |
| Event Bus | No cambia datos internos; afecta solo salida externa. |

### Datos sensibles

Categorias o entidades potencialmente sensibles:

- salud,
- farmacia sensible,
- apuestas/casino,
- deuda,
- banco/persona vinculada a deuda,
- ingresos,
- comercio sensible,
- tags emocionales o personales,
- montos altos,
- informacion de cuentas.

### PolicyGate

`PolicyGate` corre antes y despues de ejecutar:

- pre-execution: bloquear, pedir confirmacion, diferir o permitir.
- post-execution: revisar respuesta, modo discreto, canal, tono, datos sensibles.

Si una respuesta generada viola politica, se bloquea o se re-redacta.

---

## 9. Observabilidad, Calidad Y Costos

### TraceCollector

Cada flujo relevante guarda:

- `trace_id`,
- canal,
- intencion detectada,
- workflow elegido,
- agentes invocados,
- runtime usado,
- Context Pack version,
- herramientas usadas,
- politicas aplicadas,
- confianza,
- resultado,
- latencia,
- costo estimado,
- si hubo confirmacion/correccion,
- errores y retries.

No guardar:

- chain-of-thought,
- contenido financiero innecesario en logs tecnicos,
- tokens OAuth,
- datos sensibles fuera de tablas protegidas.

### Metricas tecnicas V1

| Metrica | Objetivo |
|---|---|
| WhatsApp p95 response time | < 3s para registro simple. |
| Email push a pendiente | < 60s p50. |
| Accuracy tipo/monto | Tipo >= 95%, monto >= 99%. |
| Duplicados confirmados | Tendencia a bajar. |
| Pendientes confirmados vs archivados | > 70% confirmados. |
| Agent invocation rate | Medir por agente y flujo. |
| Cost per active user | Medir, no asumir cero. |
| Policy violations | 0 salidas sensibles no permitidas. |
| Outbox lag | Bajo y monitoreado. |

### Costos y runtime

Fase actual:

- Codex-first.
- Medir invocaciones, latencia, calidad y tareas por agente.
- No asumir costo marginal cero como verdad de produccion.

Fase siguiente:

- Migrar agentes uno por uno via `AgentRuntime`.
- Mantener contratos, schemas y Context Packs.
- Decidir por metrica, no por gusto tecnico.

---

## 10. Errores, Idempotencia Y Modo Degradado

### Idempotencia

Obligatoria en:

- webhooks WhatsApp,
- email push,
- dashboard submit,
- confirmaciones de pendientes,
- outbox publish,
- pagos/deudas/recurrentes.

### Reglas de error

| Error | Respuesta del sistema |
|---|---|
| IA baja confianza | Preguntar o dejar pendiente. |
| Core rechaza accion | No registrar; explicar simple. |
| WhatsApp falla | Retry con backoff; si falla, dejar en Dashboard/Pendientes. |
| Email parsing incompleto | Crear pendiente con datos faltantes o descartar si no hay monto/fecha. |
| Outbox falla | Retry; no perder evento. |
| Balance inconsistente | Marcar recalculo y advertir visualmente. |
| Dashboard offline/parcial | Mostrar estado de carga/error sin inventar datos. |

### Recalculo

Balance, insights, recurrentes y nudges deben recalcular selectivamente:

- cambio de monto -> balance, insight, dinero libre,
- cambio de categoria -> insights/filtros,
- pago de deuda -> deuda, dinero libre, nudges,
- confirmacion de email -> movimientos, insight, dedup,
- recurrente confirmado -> ocurrencias, dinero libre, nudges.

---

## 11. Implementacion Recomendada V1

### Orden tecnico sugerido

1. Base aprobada: Supabase/Auth/RLS, usuarios, preferencias.
2. Core Financiero minimo: movimientos, cuentas, cajas, audit_log.
3. Transactional Outbox + Outbox Worker.
4. WhatsApp Adapter + FinancialOrchestrator basico.
5. DataAgent con schema estructurado.
6. Balance Engine + cuenta `null` + dinero libre basico.
7. Pending Inbox.
8. Email Adapter con confirmacion.
9. Dashboard Home/Movimientos/Pendientes/Mi Dinero.
10. CorrectionAgent + Learning signals.
11. Debt Engine.
12. Recurring Engine.
13. Insights + InsightNarrator/Experience.
14. NudgePolicyEngine.
15. Observabilidad, costos y evaluacion continua.

### No construir primero

- Integraciones bancarias directas.
- Multi-moneda UI completa.
- Shareables.
- Voz/OCR.
- Metas/limites completas.
- Agentes que escriben directo en DB.
- Automatizaciones que saltan confirmacion del usuario.

---

## 12. Criterios De Aceptacion De Arquitectura

La arquitectura esta lista para guiar implementacion si:

- WhatsApp, Dashboard, Email y Scheduler entran por adaptadores y External Event Gateway.
- `FinancialOrchestrator` esta descompuesto y no es un god object.
- Agentes y motores deterministas estan separados.
- `CommandDispatcher` es la unica via de escritura a Core.
- Core Financiero no se confunde con PostgreSQL.
- `Transactional Outbox` existe para movimientos, deudas, recurrentes, pendientes y eventos relevantes.
- Eventos externos e internos estan separados.
- Pendientes no afectan saldo.
- Email no registra sin confirmacion en V1.
- Cuenta `null` es valida y no rompe saldos.
- Cajas pertenecen a cuentas; caja libre es calculo.
- Los 11 tipos canonicos de movimiento estan cubiertos.
- Busqueda natural es read-only por defecto.
- Modo discreto y Risk Policy afectan salidas externas.
- Nudges pasan por opt-in, horario, frecuencia, Risk y modo discreto.
- Fase 3 se respeta como contrato de experiencia.
- Observabilidad mide calidad, costo, latencia y outcomes.
- La migracion Codex -> API se puede hacer por agente sin reescribir workflows.

---

## 13. Escenarios De Validacion

| Escenario | Resultado esperado |
|---|---|
| "Gaste 8 en cafe" | Movimiento `gasto`, categoria alimentacion/cafe, Core registra si confianza suficiente. |
| "Hoy gaste 8 cafe, 15 taxi y 20 almuerzo" | Tres movimientos separados, confirmacion compacta. |
| "Eso no fue gasto, fue prestamo a Luis" | CorrectionAgent propone, Debt Engine valida, Core actualiza. |
| "Me pagaron lo que me debia Ana" | `devolucion_recibida`, deuda a favor baja si existe. |
| "Pague la cuota de la tarjeta" | `pago_deuda`, deuda/tarjeta se actualiza si hay vinculo claro. |
| "Puedo gastar S/50 hoy?" | ConversationAgent consulta Balance/Debt/Recurring read-only y responde con limites de datos. |
| "Creo que ayer gaste en taxi y comida pero no recuerdo cuanto" | Micro-reconstruccion; sugiere pendientes o pregunta sin inventar montos. |
| Email de Yape/banco | Crea pendiente y pide confirmacion; no registra solo. |
| Netflix repetido | Recurring Engine crea candidato; usuario confirma antes de activar. |
| Cuota proxima | Nudge solo si opt-in, horario y riesgo permiten. |
| Modo discreto activo | Respuestas externas ocultan monto/comercio/persona sensible. |
| Dashboard manual | Formulario estructurado guarda via Core, no via DataAgent libre. |
| Busqueda natural dashboard | Devuelve resultados read-only, no crea datos. |
| Cuenta no especificada | Movimiento puede quedar con cuenta `null`; analitica si, saldo por cuenta no. |

---

## 14. Resumen Final

Manzana V1 debe implementarse como un sistema financiero conversacional con arquitectura de control, no como un chatbot conectado a una base de datos.

El valor diferencial no viene de usar mas agentes, sino de activar el agente correcto, con el contexto justo, protegido por politicas, validado por motores deterministas y expresado con una experiencia que entiende a la persona.

Arquitectura final:

```text
Canales
  -> External Event Gateway
  -> FinancialOrchestrator
  -> AgentRuntime + ToolGateway + Context Packs
  -> PolicyGate
  -> Domain Engines
  -> Core Financiero
  -> Data Layer + Audit + Transactional Outbox
  -> Internal Domain Event Bus
  -> Experiencia, Dashboard, Nudges, Insights, Learning y Metricas
```

*Fase 4 Tecnica - Documento 06 - V3.2*
