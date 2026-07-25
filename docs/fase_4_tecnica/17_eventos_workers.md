# 17 - Eventos Y Workers V1

**Estado:** V1.6 - Outbox y workers híbridos sincronizados  
**Ultima actualizacion:** 19 de julio, 2026  
**Depende de:** `06_arquitectura_sistema.md`, `16_modelo_datos.md`, `20_decisiones_tecnicas.md`, `21_decision_whatsapp_provider.md`, `22_decision_email_provider.md`  

---

## 1. Tesis

Manzana necesita procesos asincronos, pero el dinero no puede depender de eventos fragiles.

Por eso:

- eventos externos entran por `External Event Gateway`,
- escrituras financieras pasan por Core,
- eventos internos se escriben en `transactional_outbox`,
- workers publican y procesan de forma idempotente,
- ningun agente ni adapter publica eventos internos directamente.

---

## 2. Separacion Principal

| Tipo | Significado | Ejemplo | Fuente |
|---|---|---|---|
| External Input Event | Algo llego desde fuera. Todavia no es hecho financiero. | WhatsApp message, Gmail Pub/Sub, Dashboard submit | Adapter/Gateway |
| Internal Domain Event | Algo ya fue persistido por Core. Es hecho del dominio. | `movement_created`, `debt_payment_recorded` | transactional_outbox |

Regla:

> External events pueden iniciar workflows. Internal events representan hechos ya confirmados.

---

## 3. External Event Gateway

Responsabilidades:

- validar firma/token del proveedor,
- normalizar payload,
- asignar `trace_id`,
- calcular `idempotency_key`,
- guardar en `external_event_log`,
- rechazar duplicados,
- enviar al `FinancialOrchestrator`.

Eventos externos V1:

```text
whatsapp.message_received
whatsapp.delivery_status_received
dashboard.command_submitted
dashboard.search_submitted
gmail.pubsub_notification_received
gmail.watch_renewal_requested
scheduler.tick
worker.retry_requested
```

Campos normalizados:

```ts
type ExternalInputEvent = {
  source: "whatsapp" | "dashboard" | "gmail" | "scheduler" | "worker";
  type: string;
  user_id?: string;
  idempotency_key: string;
  trace_id: string;
  received_at: string;
  payload_ref?: string;
  payload_hash: string;
  metadata: Record<string, unknown>;
};
```

---

## 4. Transactional Outbox

### 4.1 Regla

Todo evento interno que dependa de una escritura financiera se guarda en la misma transaccion:

```text
begin
  Core valida comando
  Core escribe movimiento/deuda/recurrente
  Core escribe audit_log
  Core escribe transactional_outbox
commit
```

Luego:

```text
Outbox Worker
  -> lee pending
  -> publica al Internal Domain Event Bus
  -> marca published
```

### 4.2 Estados

```text
pending
processing
published
failed
dead_letter
```

### 4.3 Reintentos

| Intento | Delay sugerido |
|---|---|
| 1 | inmediato |
| 2 | 30 segundos |
| 3 | 2 minutos |
| 4 | 10 minutos |
| 5 | 1 hora |
| 6+ | dead_letter o revision |

Reglas:

- No duplicar consumidores.
- `event_id` estable.
- Consumidores idempotentes por `(event_id, consumer_name)`.
- Error no bloquea escritura ya confirmada.

### 4.4 Operacion V1

El publisher de outbox debe ser operable sin entrar a la base de datos a mano.

Implementacion actual:

- `GET/POST /api/internal/workers/outbox` ejecuta `outbox_publisher`.
- `GET` existe para scheduler autenticado; `POST` para ejecucion interna/manual.
- Ambas variantes requieren `CRON_SECRET` o `WORKER_SECRET`.
- Cada corrida escribe `worker_job_runs` con estado, duracion, conteos, resultado y `trace_id`.
- La respuesta incluye snapshot operativo de outbox: pendientes, processing, failed, dead letter y lag.
- `POST /api/internal/workers/outbox/replay` permite reencolar eventos `failed`, `dead_letter` o `processing`.
- El replay no permite reejecutar eventos `published`.
- El replay no modifica movimientos, cuentas, cajas, deudas, importes ni saldos.

### 4.5 Scheduler Externo V1

Decision V1:

```text
Scheduler externo
  -> GET /api/internal/workers/outbox?limit=25&include_snapshot=true
  -> Authorization: Bearer <CRON_SECRET>
  -> frecuencia: 1 minuto
```

Vercel Hobby no debe usarse como scheduler frecuente de outbox. Vercel Cron se
mantiene para jobs diarios/lentos. Una cola dedicada queda como evolucion futura
si el backlog, latencia o volumen lo justifican.

El contrato completo vive en `25_scheduler_externo_v1.md`.

---

## 5. Internal Domain Event Bus

Puede implementarse inicialmente como:

- tabla `transactional_outbox` + worker + handlers internos,
- o sistema de colas/event bus externo si escala lo requiere.

En V1, la fuente de verdad sigue siendo Postgres/outbox.

### Naming

Usar pasado:

```text
movement_created
movement_corrected
pending_confirmed
debt_payment_recorded
recurring_candidate_detected
insight_validated
nudge_sent
```

No usar comandos como eventos:

```text
create_movement
send_nudge
```

Eso son comandos, no hechos.

---

## 6. Eventos Internos V1

### Movements

```text
movement_created
movement_updated
movement_corrected
movement_deleted
movement_reversed
movement_account_assigned
```

Consumidores:

- Balance Engine,
- Dedup Engine,
- Insight Worker,
- Recurring Worker,
- Learning Worker,
- Dashboard projections.

### Pending

```text
pending_created
pending_sent_for_confirmation
pending_confirmed
pending_edited
pending_discarded
pending_expired
pending_archived
pending_auto_resolved_duplicate
pending_confirmation_delivery_requested
```

Consumidores:

- Dashboard,
- NudgePolicyEngine,
- `email_pending_confirmation_sender`,
- Learning,
- Metrics.

Para `source=email_pending`, `pending_created` solo puede nacer de una fuente
usuario + buzon + institucion + remitente exacto activa y verificada. El
handler de confirmacion:

- excluye siempre `source=backfill_pending` del envio WhatsApp,
- envia botones interactivos dentro de la ventana de 24 horas,
- difiere con `pending_confirmation_delivery_requested` durante horario
  silencioso,
- usa Utility aprobada fuera de ventana solo con opt-in, caps y kill switch,
- acumula en Dashboard si ya existe una confirmacion sin respuesta,
- y nunca confirma ni ejecuta el movimiento por cuenta propia.

Si el Pendiente conserva `action=review_specialized`, la accion primaria dentro
de ventana es `Revisar`, no `Confirmar`. La revision vuelve al Orquestador y debe:

- mostrar solo cuentas activas compatibles y las pistas extraidas del correo,
- aceptar los nombres reales definidos por el usuario,
- permitir completar una transferencia, reclasificar como gasto/ingreso con
  cuenta opcional o descartar,
- mantener cualquier cambio como `user_edited` sin tocar saldos,
- aprender una pista bancaria enmascarada solo por asociacion explicita,
- y pedir una confirmacion final antes de invocar Core.

El agente de planificacion puede interpretar la intencion y seleccionar
candidatos presentes en su Context Pack. La capa deterministica valida que
cuentas y categorias existan, pertenezcan al usuario y sean compatibles; un ID
propuesto por el agente nunca se usa sin esa validacion.

### Accounts And Boxes

```text
account_created
account_updated
account_archived
box_created
box_updated
box_archived
box_allocation_changed
```

Consumidores:

- Balance Engine,
- Dashboard projections,
- Insight Worker,
- Metrics.

### Balances

```text
balance_recalculation_requested
balance_recalculated
available_money_updated
```

Consumidores:

- Dashboard projections,
- Insight Worker,
- NudgePolicyEngine,
- Metrics.

### Debt

```text
debt_created
debt_updated
debt_payment_recorded
debt_paid_off
debt_cancelled
debt_installment_due_soon
debt_installment_overdue
```

Nombres implementados en el corte de deuda V1:

```text
debt_payment_registered
debt_paid
debt_installment_pending
debt_installment_due_soon
debt_installment_overdue
debt_active
debt_due_soon
debt_overdue
```

`debt_installment_*` y `debt_*` de ciclo solo nacen dentro de
`refresh_debt_installment_lifecycle`, en la misma transaccion que persiste el
nuevo estado. `debt_payment_registered` dispara una reevaluacion idempotente;
el cron diario actua como recuperacion durable.

Consumidores:

- Balance,
- Insights,
- Nudges,
- Dashboard.

### Recurring

```text
recurring_candidate_detected
recurring_confirmed
recurring_updated
recurring_cancelled
recurring_occurrence_created
recurring_payment_confirmed
recurring_amount_changed
recurring_overdue
```

### Insights

```text
insight_candidate_created
insight_validated
insight_ranked
insight_displayed
insight_sent
insight_seen
insight_updated
insight_outdated
insight_acted
insight_dismissed
insight_expired
```

### Nudges

```text
nudge_candidate_created
nudge_policy_approved
nudge_policy_rejected
nudge_deferred
nudge_scheduled
nudge_sent
nudge_delivered
nudge_responded
nudge_acted
nudge_dismissed
nudge_paused
nudge_resumed
nudge_rate_limited
nudge_quiet_hours_hit
nudge_dashboard_only
whatsapp_window_opened
whatsapp_window_closing_soon
whatsapp_window_expired
whatsapp_paid_template_sent
whatsapp_paid_template_no_response
whatsapp_window_continuation_prompt_sent
whatsapp_window_final_prompt_sent
```

### Preferences / Learning

```text
preferences_updated
learning_signal_recorded
user_discreet_mode_enabled
user_discreet_mode_disabled
email_connected
email_disconnected
email_connection_consent_updated
email_source_configured
email_source_updated
email_source_removed
```

---

## 7. Worker Catalog

| Worker | Trigger | Funcion |
|---|---|---|
| `outbox_publisher` | Cada 5-15s, queue trigger o manual protegido | Publica eventos pending y registra ejecucion operativa. |
| `outbox_replay` | Manual protegido | Reencola eventos fallidos/dead-letter/processing sin duplicar publicados. |
| `balance_recalculator` | Eventos de movimiento/deuda/caja | Recalcula snapshots afectados. |
| `pending_lifecycle` | Scheduler cada hora | Expira, archiva y prepara batch. |
| `pending_batch_sender` | Diario, default 21:00 local | Agrupa pendientes por WhatsApp/Dashboard segun ventana, respuesta y politica. |
| `whatsapp_window_maintainer` | WhatsApp inbound/status + scheduler | Actualiza estado de ventana 24h y guardrails de templates. |
| `email_ingestion` | Gmail Pub/Sub + recovery polling | Normaliza `historyId`, resuelve el buzon y la fuente configurada, exige remitente exacto + DKIM/DMARC antes del cuerpo, ejecuta extraccion transitoria y crea Pending solo con fuente/template activos y verificados. |
| `email_watch_renewal` | Diario | Renueva Gmail watch antes de expirar y marca conexiones que requieren reconexion. |
| `email_pending_confirmation_sender` | `pending_created` de email + `pending_confirmation_delivery_requested` | Aplica ventana, horario silencioso, opt-in, caps, privacidad e idempotencia; entrega WhatsApp o deja Dashboard-only sin ejecutar Core. |
| `dedup_checker` | movement/pending created | Vincula duplicados o marca probable. |
| `recurring_detector` | Diario/semanal + movement events | Detecta candidatos. |
| `recurring_occurrence_generator` | Diario | Crea ocurrencias esperadas. |
| `debt_lifecycle` | Diario + `debt_payment_registered` | Persiste `due_soon`/`overdue`, emite outbox y reevalua `debt_due` sin tocar dinero. |
| `insight_generator` | Diario + eventos relevantes | Crea candidatos. |
| `insight_mutation_checker` | Correcciones/confirmaciones | Actualiza/outdate insights. |
| `nudge_evaluator` | Cada hora + eventos | Evalua candidatos. |
| `nudge_sender` | Scheduled | Envia si PolicyGate permite. |
| `learning_processor` | Correcciones/outcomes | Actualiza learning signals. |

---

## 8. Schedules V1

| Job | Frecuencia | Notas |
|---|---|---|
| Outbox publish | Cada 1 minuto por scheduler externo V1 | Endpoint `GET/POST` implementado; contrato en `25_scheduler_externo_v1.md`. No se declara cron frecuente en Vercel Hobby. |
| Pending lifecycle | Cada hora | Respeta timezone usuario. |
| Batch nocturno | 21:00 local default | Configurable. |
| Email watch renewal | Diario | Renovar antes de expiracion. |
| Recurring detection | Diario | Tambien por evento. |
| Debt lifecycle | Diario, 08:10 `America/Lima` | Umbral V1 de tres dias; corrida por usuario e idempotente. |
| Insight generation | Diario | No recalcular todo siempre. |
| Nudge evaluation | Objetivo cada hora; cron actual diario 08:15 `America/Lima` | Evalua Dashboard y planifica/entrega WhatsApp solo si opt-in, ventana/template, Risk y Disclosure lo permiten. El envio proactivo queda desactivable por entorno. |
| Recalculation audit | Diario | Detecta inconsistencias. |

---

## 9. Idempotencia

### External events

| Fuente | Idempotency key |
|---|---|
| WhatsApp | provider message id |
| Dashboard | client generated command id |
| Gmail Pub/Sub | message id + history id |
| Scheduler | job name + scheduled timestamp |
| Worker retry | original trace/job id |

### Internal events

Consumidor guarda:

```text
event_id
consumer_name
status
processed_at
```

Si recibe el mismo evento:

- si ya esta `processed`, ignora,
- si esta `failed`, puede reintentar segun politica,
- si esta `processing` demasiado tiempo, desbloquea con timeout.

---

## 10. Contrato De Evento Interno

```ts
type InternalDomainEvent<TPayload> = {
  event_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  user_id: string;
  occurred_at: string;
  payload_version: number;
  trace_id: string;
  payload: TPayload;
};
```

Reglas:

- Payload contiene solo lo necesario.
- Consumidores pueden consultar DB si necesitan estado actual.
- No incluir secrets ni chain-of-thought.
- Versionar payload si cambia forma.

---

## 11. Loops Y Supresion

Riesgo:

```text
event -> orchestrator -> event -> orchestrator -> ...
```

Reglas:

- Internal events no vuelven al External Event Gateway.
- Workers que generan comandos deben marcar `causation_event_id`.
- Un mismo evento no puede generar indefinidamente el mismo comando.
- Nudges se suprimen si el usuario ya resolvio el dato.
- Insights se actualizan o expiran si los datos cambian.

---

## 12. Dead Letter

Un evento/job pasa a `dead_letter` si:

- supera intentos maximos,
- falla por payload invalido,
- falta entidad base,
- viola constraint,
- proveedor externo responde error permanente.

Accion:

- registrar alerta,
- no borrar,
- permitir replay manual controlado,
- no duplicar efectos financieros.
- registrar el replay en `worker_job_runs` y en metadata del evento.

---

## 13. Observabilidad

Cada worker registra:

- `job_run_id`,
- `trace_id`,
- `event_id`,
- `user_id`,
- intentos,
- latencia,
- estado,
- error resumido,
- consumer,
- output count,
- costo si invoca AI/API.

Tabla operativa:

```text
worker_job_runs
  job_name
  trigger
  status
  trace_id
  started_at / finished_at / duration_ms
  claimed_count / processed_count / failed_count / skipped_count
  metadata
  result
  last_error
```

Metricas:

- outbox lag,
- failed jobs,
- dead letters,
- duplicate event rate,
- pending resolution time,
- nudge send/response/action,
- insight freshness,
- Gmail push delay,
- WhatsApp delivery delay.

---

## 14. Criterios De Aceptacion

- Eventos externos e internos estan separados.
- Outbox se escribe dentro de transaccion Core.
- Todos los workers son idempotentes.
- Hay retry/backoff y dead letter.
- Hay registro operativo de ejecuciones en `worker_job_runs`.
- Outbox expone lag y replay interno protegido para eventos recuperables.
- Gmail, WhatsApp y Dashboard tienen idempotency keys.
- Pendientes, recurrentes, insights y nudges tienen workers definidos.
- Nudge Worker respeta opt-in, quiet hours, frecuencia y modo discreto.
- Email Worker nunca registra movimiento sin confirmacion.
- Email Worker usa APIs oficiales/OAuth, no passwords ni scraping.
- Gmail watch se renueva antes de expirar y Pub/Sub se complementa con polling de recuperacion si hace falta.
- Outbox Worker no pierde eventos ni duplica consumidores.

---

## 15. Resumen

La regla:

```text
Si algo ya paso en el dominio, sale por outbox.
Si algo viene de fuera, entra por gateway.
Si algo se reintenta, debe ser idempotente.
```

*Fase 4 Tecnica - Documento 17 - V1.2*
