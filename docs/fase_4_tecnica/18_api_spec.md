# 18 - API Spec V1

**Estado:** V1.7 - REST + Core Commands + Insights y scheduler externo  
**Ultima actualizacion:** 19 de julio, 2026  
**Depende de:** `06_arquitectura_sistema.md`, `16_modelo_datos.md`, `17_eventos_workers.md`, `20_decisiones_tecnicas.md`, `21_decision_whatsapp_provider.md`, `22_decision_email_provider.md`  

---

## 1. Tesis

La API de Manzana no es el lugar donde vive la logica financiera. La API recibe, valida, autentica y delega.

Decision V1:

```text
Dashboard/API externa: REST simple.
Escrituras financieras: Core Commands internos.
```

Regla:

```text
API -> Application Service -> Orchestrator/Core -> Repositories
```

Nunca:

```text
API -> SQL directo con reglas financieras ad hoc
```

---

## 2. Tipos De API

| Tipo | Uso | Publica |
|---|---|---|
| Dashboard API | Datos y acciones del usuario autenticado. | Si, con auth. |
| Webhook API | WhatsApp, Gmail/PubSub y proveedores. | Si, con firma/token. |
| Internal API | Workers, cron, admin tecnico. | No publica; protegida. |
| Core Commands | Contrato interno de escritura financiera. | No HTTP necesariamente. |
| Agent Tools | Herramientas read-only para agentes. | No expuestas al cliente. |

---

## 3. Convenciones

### 3.1 Versionado

Prefijo:

```text
/api/v1
```

Webhooks pueden vivir fuera:

```text
/api/webhooks/whatsapp
/api/webhooks/gmail-pubsub
```

### 3.2 Response Envelope

Exito:

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "trace_id": "uuid"
  }
}
```

Error:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "No pude guardar ese movimiento.",
    "details": {}
  },
  "meta": {
    "trace_id": "uuid"
  }
}
```

### 3.3 Headers

| Header | Uso |
|---|---|
| `Authorization: Bearer <jwt>` | Dashboard/user API. |
| `Idempotency-Key` | Mutaciones del Dashboard. |
| `X-Trace-Id` | Debug/propagacion opcional. |
| `X-Cron-Secret` | Cron interno. |
| Provider signature headers | Webhooks. |

---

## 4. Auth Y Seguridad

| Endpoint | Auth |
|---|---|
| Dashboard API | Supabase JWT. |
| Webhook WhatsApp | Verify token + signature si proveedor la ofrece. |
| Gmail Pub/Sub | Token/verificacion de Pub/Sub + payload validation. |
| Internal worker endpoints | Secret + allowlist + idempotency. |
| Agent tools | Solo backend, no cliente. |

Reglas:

- Service role nunca llega al navegador.
- RLS siempre activado.
- Mutaciones financieras requieren backend.
- Acciones peligrosas requieren confirmacion explicita.

---

## 5. Dashboard API

### 5.1 Home

```http
GET /api/v1/dashboard/home
```

Devuelve:

```ts
type DashboardHomeResponse = {
  money_summary: MoneySummary | null;
  pending_summary: PendingSummary;
  recent_movements: MovementListItem[];
  next_commitments: CommitmentSummary[];
  featured_insight: InsightCard | null;
  suggested_action: SuggestedAction | null;
  data_quality: DataQualitySummary;
};
```

Reglas:

- No inventar saldos si faltan cuentas.
- Pendientes se muestran separado de confirmados.

### 5.1.1 Mi Dinero

```http
GET /api/v1/money
```

Endpoint dedicado para la pantalla Mi Dinero. Home puede consumir un resumen, pero Mi Dinero necesita desglose completo.

Devuelve:

```ts
type MoneyResponse = {
  total_balance: MoneyAmount;
  free_in_accounts: MoneyAmount;
  operational_free_money: MoneyAmount;
  separated_in_boxes: MoneyAmount;
  upcoming_uncovered_commitments: MoneyAmount;
  accounts: AccountMoneySummary[];
  boxes: BoxMoneySummary[];
  commitments: CommitmentSummary[];
  data_quality: DataQualitySummary;
};
```

Reglas:

- `free_in_accounts` es saldo de cuentas menos cajas.
- `operational_free_money` descuenta compromisos proximos no cubiertos por cajas.
- Si no hay cuentas, responder estado vacio util; no fabricar saldos.
- Pendientes de email no afectan ninguno de estos numeros hasta confirmacion.

### 5.1.2 Pagos que vienen

```http
GET /api/v1/dashboard/upcoming
```

Proyeccion autenticada para la pantalla `Pagos que vienen`. Combina lectura de
Recurrentes con cuotas abiertas de Debt Engine sin transferir propiedad entre
dominios.

Devuelve:

```ts
type UpcomingDashboardResponse = RecurringDashboardData & {
  debt_installments: DebtInstallmentCommitmentSummary[];
};
```

Reglas:

- Es read-only y no crea movimientos ni modifica saldos.
- Las cuotas de deuda no exponen pago directo desde esta proyeccion.
- El pago/cobro de una deuda sigue pasando por `/api/v1/debts/:id/payments` y Core.

### 5.2 Movimientos

```http
GET /api/v1/movements
POST /api/v1/movements
GET /api/v1/movements/:id
PATCH /api/v1/movements/:id
DELETE /api/v1/movements/:id
```

`POST /movements` es registro manual estructurado desde Dashboard.

Reglas:

- Usa `Idempotency-Key`.
- Pasa por validadores/Core.
- No usa DataAgent si los campos ya son estructurados.
- Fuente: `dashboard_manual`.

Request minimo:

```ts
type CreateMovementRequest = {
  type: MovementType;
  amount: number;
  currency?: "PEN" | "USD";
  occurred_at: string;
  description?: string;
  category_id?: string | null;
  subcategory_id?: string | null;
  account_origin_id?: string | null;
  account_destination_id?: string | null;
  box_origin_id?: string | null;
  box_destination_id?: string | null;
  debt_id?: string | null;
  recurring_rule_id?: string | null;
  related_person_id?: string | null;
};
```

### 5.3 Pendientes

```http
GET /api/v1/pending
GET /api/v1/pending/confirmation-center
GET /api/v1/pending/:id
POST /api/v1/pending/:id/confirm
POST /api/v1/pending/:id/edit-and-confirm
POST /api/v1/pending/:id/discard
POST /api/v1/pending/batch-confirm
POST /api/v1/pending/batch-discard
```

Reglas:

- Confirmar pendiente crea movimiento/entidad via Core.
- Batch grande puede requerir confirmacion de riesgo.
- Pendiente archivado no afecta saldo.
- Centro de Confirmaciones muestra lotes visibles para WhatsApp/app.
- `batch-confirm` solo aplica al lote visible o ids explicitos; no confirma historicos ocultos.
- Un Pendiente incompleto se puede revisar conversacionalmente por WhatsApp:
  proponer cuentas existentes, completar origen/destino, reclasificar como
  gasto/ingreso o descartar.
- Elegir una cuenta por su nombre solo edita la propuesta; no crea una cuenta,
  no aprende un alias silenciosamente y no toca saldo.
- Gasto e ingreso admiten cuenta opcional. Una transferencia propia exige dos
  cuentas distintas, existentes, del usuario y de la misma moneda.
- La asociacion persistente entre una pista bancaria enmascarada y una cuenta
  requiere instruccion explicita del usuario y queda en metadata auditable.
- Tras editar o reclasificar se exige una nueva confirmacion; la escritura sigue
  pasando por el comando Core correspondiente e idempotencia del Pendiente.

### 5.4 Cuentas Y Cajas

```http
GET /api/v1/accounts
POST /api/v1/accounts
PATCH /api/v1/accounts/:id
DELETE /api/v1/accounts/:id

GET /api/v1/boxes
POST /api/v1/boxes
PATCH /api/v1/boxes/:id
DELETE /api/v1/boxes/:id
```

Reglas:

- Eliminar cuenta con cajas activas se bloquea o guia.
- Eliminar caja con saldo crea asignacion interna controlada.

### 5.4.1 Categorias, Etiquetas Y Personas Relacionadas

```http
GET /api/v1/categories
GET /api/v1/subcategories
POST /api/v1/subcategories
PATCH /api/v1/subcategories/:id
DELETE /api/v1/subcategories/:id

GET /api/v1/tags
POST /api/v1/tags
PATCH /api/v1/tags/:id
DELETE /api/v1/tags/:id

GET /api/v1/related-persons
POST /api/v1/related-persons
PATCH /api/v1/related-persons/:id
DELETE /api/v1/related-persons/:id
```

Reglas:

- Categorias base son read-only para el usuario.
- Subcategorias y tags de usuario no cambian la taxonomia canonica.
- Personas relacionadas se usan para deudas/prestamos y deben poder archivarse sin borrar historial.
- Cambios de categoria/tag/persona en movimientos existentes pasan por Core cuando afectan auditoria.

### 5.5 Deudas

```http
GET /api/v1/debts
POST /api/v1/debts
GET /api/v1/debts/:id
PATCH /api/v1/debts/:id
POST /api/v1/debts/:id/payments
POST /api/v1/debts/:id/cancel
POST /api/v1/debts/:id/mark-paid
```

Reglas:

- Pago mayor a saldo se bloquea en V1 antes de llegar al RPC.
- Cerrar deuda con saldo requiere motivo.
- Pago de deuda no es gasto generico.
- `POST /api/v1/debts/:id/payments` aplica el pago a la cuota abierta mas
  antigua y distribuye excedente entre las siguientes.
- La respuesta incluye `installment_allocations` y
  `allocation_policy: "oldest_open_due_date_first_v1"`.
- La conciliacion ocurre dentro de `commit_debt_payment` junto al movimiento,
  saldos opcionales, deuda y outbox.
- Tras crear una deuda o confirmar un pago, backend ejecuta una proyeccion
  inmediata de vencimientos. Si esa proyeccion secundaria falla, no revierte
  el hecho ya confirmado: outbox y cron diario la recuperan.
- Los estados `due_soon`/`overdue` se persisten mediante
  `refresh_debt_installment_lifecycle`, RPC exclusivo de Core/service role.

### 5.6 Pagos Que Vienen

```http
GET /api/v1/recurring
POST /api/v1/recurring
PATCH /api/v1/recurring/:id
POST /api/v1/recurring/:id/cancel
POST /api/v1/recurring/:id/occurrences/:occurrence_id/mark-paid
POST /api/v1/recurring/candidates/:id/confirm
POST /api/v1/recurring/candidates/:id/discard
```

Reglas:

- Candidato no activa recurrente sin confirmacion.
- Ocurrencia esperada no afecta saldo.
- Pago confirmado crea movimiento.

### 5.7 Descubrimientos

```http
GET /api/v1/insights
GET /api/v1/insights/:id
POST /api/v1/insights/:id/seen
POST /api/v1/insights/:id/dismiss
POST /api/v1/insights/:id/action
GET /api/v1/insights/:id/evidence
```

Reglas:

- Evidencia explica sin exponer razonamiento interno.
- Insights outdated se muestran como actualizados o expirados.
- `seen`, `dismiss` y `action` requieren sesion autenticada y pasan por la
  politica de acciones de experiencia.
- `action` registra la interaccion con el CTA; no ejecuta dinero ni reemplaza el
  endpoint de dominio/Core de la accion sugerida.
- Descartar o actuar cierra cualquier nudge activo ligado al insight sin borrar
  el historial de entregas.

Estado de implementacion al 19 de julio de 2026: las seis rutas existen y pasan
tests locales. Falta deployment y QA de integracion con la UI de
Descubrimientos.

### 5.8 Busqueda Natural

```http
POST /api/v1/search/natural
```

Request:

```ts
type NaturalSearchRequest = {
  query: string;
  scope?: "movements" | "money" | "debts" | "recurring" | "all";
};
```

Reglas:

- Read-only.
- Usa ConversationAgent + ToolGateway.
- No crea movimientos.
- Si el usuario intenta registrar desde busqueda, redirigir a flujo correcto.

### 5.9 Configuracion

```http
GET /api/v1/preferences
PATCH /api/v1/preferences
POST /api/v1/preferences/discreet-mode
GET /api/v1/preferences/nudges
POST /api/v1/preferences/nudges
POST /api/v1/nudges/{id}/dismiss
GET /api/v1/email/status
POST /api/v1/email/oauth/start
GET /api/v1/email/oauth/callback
POST /api/v1/email/connect
POST /api/v1/email/disconnect
PUT /api/v1/email/sources
DELETE /api/v1/email/sources
```

Reglas:

- Opt-in granular.
- `GET /preferences/nudges` devuelve preferencias efectivas Dashboard para `payment_due` y `debt_due`.
- `POST /preferences/nudges` acepta `{ nudge_type, enabled }`; solo cambia avisos internos y nunca habilita WhatsApp/email.
- Desactivar una preferencia retira candidatos abiertos de ese tipo; reactivarla puede reevaluar fuentes vigentes.
- `status` devuelve el catalogo de instituciones, todas las conexiones Gmail y
  sus vinculos por banco.
- `PUT /email/sources` crea o cambia `{ institution_key,
  email_connection_id, notification_sender }`.
- Un remitente nuevo puede guardarse, pero queda `shadow` hasta que exista un
  template exacto activo/verificado; la API nunca permite que la seleccion del
  usuario salte el Gate institucional.
- `DELETE /email/sources` desactiva solo el vinculo indicado.
- Desconectar una conexion elimina su token y archiva solo los pendientes no
  confirmados originados en ese buzon.
- Email V1 conecta Gmail via OAuth oficial; no passwords, app passwords ni scraping.
- `connect` puede quedar como alias de producto; la implementacion tecnica debe pasar por OAuth start/callback.

---

## 6. Webhook API

### 6.1 WhatsApp

```http
GET /api/webhooks/whatsapp
POST /api/webhooks/whatsapp
```

`GET` verifica webhook.  
`POST` recibe mensajes/status.

Flujo:

```text
Webhook
  -> verificar proveedor
  -> External Event Gateway
  -> external_event_log
  -> FinancialOrchestrator
```

Respuesta:

- 200 rapido si fue recibido,
- procesar async si el flujo es largo,
- nunca bloquear webhook por insight/nudge pesado.

### 6.2 Gmail Pub/Sub

```http
POST /api/webhooks/gmail-pubsub
```

Flujo:

```text
Pub/Sub notification
  -> validar origen/token
  -> external_event_log
  -> Email Worker
  -> Email Adapter obtiene mensajes necesarios
  -> Orchestrator/Pending Inbox
```

Regla:

- Notificacion de Gmail no contiene necesariamente todos los datos; puede requerir fetch posterior.
- El payload se interpreta como aviso con `historyId`; el worker consulta Gmail History API desde `last_history_id`.
- El webhook responde 200 rapido y deja el parsing en worker async.
- Duplicados se controlan por Pub/Sub message id, Gmail history id y provider message id.
- Email no crea movimiento confirmado.

---

## 7. Internal API

Endpoints internos protegidos:

```http
POST /api/internal/jobs/outbox-publish
GET /api/internal/workers/outbox
POST /api/internal/workers/outbox
POST /api/internal/workers/outbox/replay
POST /api/internal/jobs/pending-lifecycle
POST /api/internal/jobs/pending-batch-send
POST /api/internal/jobs/recurring-detect
GET /api/internal/jobs/recurring-detect
POST /api/internal/jobs/insights-generate
POST /api/internal/jobs/insights-mutation-check
POST /api/internal/jobs/nudges-evaluate
GET /api/internal/jobs/nudges-evaluate
POST /api/internal/jobs/debt-lifecycle
GET /api/internal/jobs/debt-lifecycle
POST /api/internal/jobs/email-watch-renew
POST /api/internal/jobs/email-ingest
POST /api/internal/jobs/whatsapp-window-maintain
POST /api/internal/jobs/dedup-check
```

Reglas:

- Requieren secret.
- Idempotentes.
- Pueden disparar worker durable.
- No devuelven datos financieros al cliente.
- Las variantes `GET` existen solo para cron autenticado; conservan el mismo secreto y no deben abrirse al cliente.
- `GET/POST /api/internal/workers/outbox` publica eventos pendientes y registra
  `worker_job_runs` con lag, conteos y resultado.
- Para V1, el scheduler externo debe llamar
  `GET /api/internal/workers/outbox?limit=25&include_snapshot=true` cada minuto
  con `Authorization: Bearer <CRON_SECRET>`.
- `POST /api/internal/workers/outbox/replay` exige `WORKER_SECRET`, recibe
  `outbox_id`, `reason` y `requested_by` opcional, y solo reencola eventos
  recuperables (`failed`, `dead_letter`, `processing`). No reejecuta
  `published`.
- `debt-lifecycle` acepta opcionalmente `user_id`, `as_of_date`,
  `due_soon_days` (1-14) y `max_users` (1-200). Su default V1 es tres dias.
- `debt-lifecycle` persiste estados y reevalua avisos Dashboard, pero no escribe
  movimientos, pagos, importes ni saldos.

---

## 8. Core Commands

Contratos internos, no necesariamente HTTP:

```ts
type CoreCommand =
  | CreateMovementCommand
  | UpdateMovementCommand
  | DeleteMovementCommand
  | CorrectMovementCommand
  | ConfirmPendingCommand
  | CreateAccountCommand
  | CreateBoxCommand
  | CreateDebtCommand
  | RecordDebtPaymentCommand
  | CreateRecurringRuleCommand
  | ConfirmRecurringPaymentCommand
  | ApplyAdjustmentCommand;
```

Todo comando incluye:

```ts
type CommandEnvelope<T> = {
  command_id: string;
  user_id: string;
  actor: Actor;
  source: string;
  trace_id: string;
  payload: T;
};
```

### 8.1 Payloads minimos de Core Commands

Los schemas finales pueden vivir en codigo como Zod/Valibot, pero estos campos son el contrato minimo para no inventar comandos durante implementacion.

```ts
type MovementInput = {
  type: MovementType;
  amount: number | null;
  currency: "PEN" | "USD";
  occurred_at: string;
  description: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  account_origin_id: string | null;
  account_destination_id: string | null;
  box_origin_id: string | null;
  box_destination_id: string | null;
  related_person_id: string | null;
  debt_id: string | null;
  recurring_rule_id: string | null;
  source: MovementSource;
  source_ref: string | null;
  metadata: Record<string, unknown>;
};

type CreateMovementCommand = CommandEnvelope<{
  movement: MovementInput;
  idempotency_key: string;
}>;

type UpdateMovementCommand = CommandEnvelope<{
  movement_id: string;
  patch: Partial<MovementInput>;
  reason: string;
}>;

type CorrectMovementCommand = CommandEnvelope<{
  movement_id: string;
  corrected_fields: Partial<MovementInput>;
  user_correction_text: string | null;
  reason: "user_correction" | "classification_fix" | "account_fix" | "system_reconciliation";
}>;

type DeleteMovementCommand = CommandEnvelope<{
  movement_id: string;
  mode: "soft_delete" | "reverse";
  reason: string;
}>;

type ConfirmPendingCommand = CommandEnvelope<{
  pending_item_id: string;
  decision: "confirm" | "edit_and_confirm" | "discard";
  edited_action: Record<string, unknown> | null;
}>;
```

Reglas:

- `CorrectMovementCommand` debe crear audit log y recalculos derivados.
- `DeleteMovementCommand` no borra trazabilidad financiera.
- `ConfirmPendingCommand` es la unica via para convertir un pendiente en movimiento/entidad confirmada.

---

## 9. Error Codes

| Code | Significado |
|---|---|
| `VALIDATION_ERROR` | Campos invalidos o incompletos. |
| `AUTH_REQUIRED` | Falta autenticacion. |
| `FORBIDDEN` | RLS/policy no permite accion. |
| `NOT_FOUND` | Recurso no existe o no pertenece al usuario. |
| `CONFLICT` | Duplicado o idempotencia conflictiva. |
| `RISK_CONFIRMATION_REQUIRED` | Accion de alto riesgo necesita confirmacion. |
| `AMBIGUOUS_ACTION` | El sistema necesita aclaracion. |
| `CORE_REJECTED` | Core rechazo por regla financiera. |
| `PROVIDER_ERROR` | Error de proveedor externo. |
| `RATE_LIMITED` | Limite de frecuencia. |
| `INTERNAL_ERROR` | Error no esperado. |

---

## 10. Paginacion Y Filtros

Usar cursor pagination en listas grandes:

```text
?limit=25&cursor=...
```

Filtros de movimientos:

```text
type
category_id
subcategory_id
tag
account_id
box_id
source
status
date_from
date_to
search
```

---

## 11. Idempotencia

Mutaciones criticas requieren `Idempotency-Key`:

- crear movimiento,
- confirmar pendiente,
- pago de deuda,
- pago recurrente,
- batch confirm,
- eliminar/cerrar entidades,
- webhooks.

Respuesta duplicada:

- si payload igual: devolver resultado original,
- si payload distinto con misma key: `CONFLICT`.

---

## 12. Criterios De Aceptacion

- Dashboard API cubre Home, Movimientos, Pendientes, Mi Dinero, Deudas, Recurrentes, Insights, Configuracion.
- Webhooks WhatsApp/Gmail entran por gateway.
- Gmail OAuth tiene start/callback/status/desconexion sin pedir passwords.
- Gmail Pub/Sub se procesa como `historyId` + worker async, no como email completo.
- Mutaciones financieras usan Core Commands.
- Search natural es read-only.
- Confirmar pendiente es idempotente.
- Batch grande puede exigir confirmacion.
- Error codes estan definidos.
- Service role no se expone.
- Endpoints internos estan protegidos.

---

## 13. Resumen

La API debe ser delgada, validada y trazable.

```text
API recibe.
Orchestrator decide.
Core ejecuta.
Outbox publica.
```

*Fase 4 Tecnica - Documento 18 - V1.3*
