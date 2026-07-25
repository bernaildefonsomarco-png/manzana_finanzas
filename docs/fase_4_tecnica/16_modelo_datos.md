# 16 - Modelo De Datos V1

**Estado:** V1.5 - Contrato logico con ciclo durable de cuotas sincronizado  
**Ultima actualizacion:** 1 de julio, 2026  
**Depende de:** `06_arquitectura_sistema.md`, `15_stack_tecnologico.md`, `20_decisiones_tecnicas.md`, `21_decision_whatsapp_provider.md`, `22_decision_email_provider.md`  

---

## 1. Tesis

El modelo de datos de Manzana debe proteger dinero, permitir datos imperfectos y soportar experiencia progresiva.

No debe forzar al usuario a tener todo perfecto desde el dia 1. Pero tampoco debe permitir inconsistencias que rompan saldos, deudas, recurrentes, auditoria o confianza.

Este documento define el contrato logico V1: tablas, campos, enums, relaciones, constraints esperadas, RLS e indices recomendados. Las migraciones SQL reales se generan al iniciar implementacion.

---

## 2. Principios

| # | Principio | Implicacion |
|---|---|---|
| 1 | Usuario aislado | Toda tabla de datos del usuario tiene `user_id` y RLS. |
| 2 | Soft delete | Datos financieros no se borran fisicamente por defecto. |
| 3 | Auditoria | Cambios financieros relevantes tienen audit log. |
| 4 | Pendiente no es movimiento | Pendientes viven separado y no afectan saldo. |
| 5 | Cuenta `null` es valida | Registro valido, saldo financiero incompleto. |
| 6 | Outbox obligatorio | Eventos internos nacen dentro de la transaccion. |
| 7 | SQL al implementar | Las migrations SQL implementan este contrato logico con constraints, enums, indices y RLS. |
| 8 | JSONB con cuidado | Metadata flexible, pero campos de negocio importantes son columnas. |

---

## 3. Convenciones

### 3.1 Campos comunes

Tablas principales:

```sql
id uuid primary key default gen_random_uuid()
user_id uuid not null references auth.users(id)
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
deleted_at timestamptz null
metadata jsonb not null default '{}'::jsonb
```

### 3.2 Dinero

```sql
amount numeric(14,2) not null
currency text not null default 'PEN'
```

Reglas:

- PEN es moneda principal V1.
- USD puede existir en modelo, pero UI multi-moneda completa queda fuera de V1.
- No usar `float` para dinero.
- Montos negativos solo en `ajuste` o campos especificos permitidos.

### 3.3 Estados

Estados se modelan con enums SQL cuando son cerrados y de negocio:

- `movement_type`,
- `movement_status`,
- `movement_source`,
- `pending_source`,
- `risk_level`,
- `account_type`,
- `box_type`,
- `pending_type`,
- `pending_status`,
- `debt_direction`,
- `debt_kind`,
- `debt_status`,
- `installment_status`,
- `recurring_status`,
- `recurring_occurrence_status`,
- `recurring_candidate_status`,
- `nudge_type`,
- `nudge_status`,
- `insight_type`,
- `insight_status`,
- `onboarding_status`.

Usar `text` solo si el set cambia por proveedor externo.

---

## 4. Enums Principales

### 4.1 MovementType

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

### 4.2 MovementStatus

```text
confirmed
needs_review
corrected
deleted
reversed
```

Pendientes no usan `movement_status`; viven en `pending_items`.

### 4.3 MovementSource

Este enum aplica solo a movimientos ya confirmados en `movements`.

```text
whatsapp
dashboard_manual
email_confirmed
recurring_confirmed
backfill_confirmed
system_adjustment
```

Pendientes, candidatos y detecciones sin confirmacion no usan `movement_source`; usan `pending_source` y viven en `pending_items`.

### 4.3.1 PendingSource

```text
email_pending
backfill_pending
recurring_candidate
ambiguous_movement
risk_confirmation
```

### 4.4 RiskLevel

```text
low
medium
high
sensitive
```

### 4.5 AccountType

Valores alineados con `05e_cuentas_cajas.md`:

```text
digital
banco
fisico
tarjeta
```

Regla: tarjeta de credito no vive aqui como dinero disponible; se modela como deuda/pasivo.

### 4.6 BoxType

```text
compromiso
objetivo
emergencia
```

Caja libre no es enum ni fila. Es calculo.

### 4.7 PendingType

```text
email_detected
ambiguous_movement
recurring_candidate
backfill_item
data_quality
risk_confirmation
```

### 4.8 PendingStatus

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

### 4.9 DebtDirection

```text
i_owe
they_owe_me
```

### 4.10 DebtKind

```text
personal
bank_loan
credit_card
installment_purchase
service_or_bill
other
```

### 4.11 DebtStatus

```text
draft
active
due_soon
overdue
paid
cancelled
archived
```

`partially_paid` no es estado: se calcula desde saldo/progreso.

### 4.12 InstallmentStatus

```text
pending
due_soon
overdue
paid
rescheduled
skipped
```

### 4.13 RecurringStatus

```text
suggested
active
paused
cancelled
archived
```

### 4.14 RecurringOccurrenceStatus

```text
expected
due_soon
pending_confirmation
paid
skipped
overdue
rejected
```

### 4.15 RecurringCandidateStatus

```text
candidate
ready_to_suggest
suggested
confirmed
dismissed
expired
```

### 4.16 InsightType

```text
learning_progress
comparative
category_concentration
temporal_pattern
anomaly
projection
free_money
recurring
debt
box_saving
contextual
progress
data_quality
```

### 4.17 InsightStatus

```text
candidate
validated
ranked
narrated
displayed
sent
acted
dismissed
ignored
outdated
expired
```

### 4.18 NudgeType

```text
daily_reconstruction
missing_activity
payment_due
debt_due
overdue_payment
pending_review
weekly_review
insight_prompt
anomaly_alert
progress_positive
budget_goal
reengagement
```

### 4.19 NudgeStatus

```text
candidate
approved
deferred
rejected
scheduled
sent
delivered
responded
acted
dismissed
expired
```

### 4.20 OnboardingStatus

```text
not_started
started
first_value_reached
activated_light
activated_strong
completed
paused
```

Regla: onboarding puede evolucionar por producto, pero estos valores son la base V1 para migraciones iniciales y analitica.

---

## 5. Usuarios Y Preferencias

### 5.1 `profiles`

Extiende `auth.users`.

Campos:

```text
id uuid pk -> auth.users.id
display_name text null
phone_e164 text unique null
timezone text not null default 'America/Lima'
locale text not null default 'es-PE'
default_currency text not null default 'PEN'
onboarding_status onboarding_status not null default 'not_started'
created_at
updated_at
```

### 5.2 `user_preferences`

Campos:

```text
user_id uuid pk
tone_style text null
discreet_mode_enabled boolean not null default false
quiet_hours_start time null
quiet_hours_end time null
whatsapp_opt_in boolean not null default false
email_opt_in boolean not null default false
nudge_opt_in jsonb not null default '{}'::jsonb
default_account_id uuid null references accounts(id)
metadata jsonb
```

Reglas:

- Learning puede sugerir cambios, no activar opt-ins sin usuario.
- Modo discreto se aplica en salidas externas.

---

## 6. Cuentas Y Cajas

### 6.1 `accounts`

Campos:

```text
id uuid pk
user_id uuid not null
name text not null
institution text null
type account_type not null
currency text not null default 'PEN'
initial_balance numeric(14,2) not null default 0
current_balance numeric(14,2) not null default 0
is_default boolean not null default false
color text null
icon text null
created_at
updated_at
deleted_at
metadata jsonb
```

Constraints:

- unique parcial: una cuenta default activa por usuario.
- nombre/institucion no duplicado por usuario activo.

### 6.2 `boxes`

Campos:

```text
id uuid pk
user_id uuid not null
account_id uuid not null references accounts(id)
name text not null
type box_type not null
current_balance numeric(14,2) not null default 0
target_amount numeric(14,2) null
target_date date null
linked_debt_id uuid null
linked_recurring_id uuid null
created_at
updated_at
deleted_at
metadata jsonb
```

Reglas:

- Caja siempre pertenece a cuenta.
- Caja libre no es fila. Es calculo: `account.current_balance - sum(active boxes)`.
- Eliminar caja con saldo crea `asignacion_interna` hacia libre antes de soft delete.

---

## 7. Movimientos

### 7.1 `movements`

Campos:

```text
id uuid pk
user_id uuid not null
type movement_type not null
status movement_status not null default 'confirmed'
amount numeric(14,2) not null
currency text not null default 'PEN'
occurred_at timestamptz not null
description text null
merchant text null
category_id text null
subcategory_id uuid null
source movement_source not null
source_ref text null
confidence numeric(5,4) null
requires_review boolean not null default false

account_origin_id uuid null references accounts(id)
account_destination_id uuid null references accounts(id)
box_origin_id uuid null references boxes(id)
box_destination_id uuid null references boxes(id)

debt_id uuid null references debts(id)
recurring_rule_id uuid null references recurring_rules(id)
recurring_occurrence_id uuid null references recurring_occurrences(id)
related_person_id uuid null references related_persons(id)

affects_total_balance boolean not null
affects_account_balance boolean not null
created_at
updated_at
deleted_at
metadata jsonb
```

Reglas:

- `gasto`: salida si hay `account_origin_id`; puede ser null.
- `ingreso`: entrada si hay `account_destination_id`; puede ser null.
- `transferencia`: requiere origen/destino si afecta cuentas; no es gasto.
- `asignacion_interna`: mueve entre libre/caja/caja; no cambia saldo total.
- `pago_deuda`: vincula deuda si existe; no es gasto generico.
- `pago_recurrente`: solo si hubo pago real/confirmado.
- `deuda_adquirida`: puede no afectar cuenta.
- `prestamo_dado`: deuda a favor + salida si cuenta conocida.
- `prestamo_recibido`: deuda propia + entrada si cuenta conocida.
- `devolucion_recibida`: reduce deuda a favor + entrada si cuenta conocida.
- `ajuste`: requiere motivo.

### 7.2 `movement_audit_log`

Campos:

```text
id uuid pk
user_id uuid not null
movement_id uuid null references movements(id)
entity_type text not null
entity_id uuid not null
action text not null
field_name text null
old_value jsonb null
new_value jsonb null
source text not null
actor_type text not null
actor_id uuid null
trace_id uuid null
created_at timestamptz not null default now()
metadata jsonb
```

Regla:

> Si cambia dinero, categoria, cuenta, caja, deuda, recurrente o estado, debe quedar auditado.

### 7.3 `movement_tags`

Campos:

```text
movement_id uuid references movements(id)
tag_id uuid references tags(id)
confidence numeric(5,4) null
source text not null
primary key (movement_id, tag_id)
```

---

## 8. Pendientes

### 8.1 `pending_items`

Campos:

```text
id uuid pk
user_id uuid not null
type pending_type not null
status pending_status not null default 'pending'
source pending_source not null
source_ref text null
proposed_action jsonb not null
normalized_summary jsonb not null default '{}'::jsonb
dedup_status text null
risk_level risk_level not null default 'low'
expires_at timestamptz null
sent_for_confirmation_at timestamptz null
resolved_at timestamptz null
resolved_by text null
created_at
updated_at
metadata jsonb
```

Tipos:

```text
email_detected
ambiguous_movement
recurring_candidate
backfill_item
data_quality
risk_confirmation
```

Reglas:

- Pendiente no afecta saldo.
- Confirmar pendiente crea movimiento/entidad via Core.
- Descartar pendiente no borra evidencia minima.
- Backfill va a Dashboard agrupado.

---

## 9. Categorias, Subcategorias Y Tags

### 9.1 `categories`

Tabla seed global con 12 categorias canonicas.

Campos:

```text
id text primary key
label text not null
description text null
is_system boolean not null default true
sort_order int not null
```

Regla:

- No se crean categorias base nuevas por usuario.

### 9.2 `user_subcategories`

Campos:

```text
id uuid pk
user_id uuid not null
category_id text not null references categories(id)
label text not null
normalized_label text not null
created_by text not null
created_at
updated_at
deleted_at
metadata jsonb
```

### 9.3 `tags`

Campos:

```text
id uuid pk
user_id uuid null
key text not null
label text not null
type text not null
is_system boolean not null default false
created_at
metadata jsonb
```

Regla:

- Tags system pueden compartirse.
- Tags custom viven por usuario.

---

## 10. Deudas

### 10.1 `related_persons`

Campos:

```text
id uuid pk
user_id uuid not null
display_name text not null
normalized_name text not null
kind text not null default 'person'
relationship_label text null
created_at
updated_at
deleted_at
metadata jsonb
```

### 10.2 `debts`

Campos:

```text
id uuid pk
user_id uuid not null
direction debt_direction not null
kind debt_kind not null
status debt_status not null
related_person_id uuid null references related_persons(id)
name text not null
principal_amount numeric(14,2) not null
current_balance numeric(14,2) not null
currency text not null default 'PEN'
opened_at date not null
due_date date null
next_payment_date date null
installment_count int null
installment_amount numeric(14,2) null
interest_notes text null
last_payment_at timestamptz null
created_at
updated_at
deleted_at
metadata jsonb
```

Reglas:

- `current_balance >= 0`.
- Cerrar con saldo pendiente requiere confirmacion o condonacion.
- Pago mayor al saldo se bloquea en V1.

### 10.3 `debt_payments`

Campos:

```text
id uuid pk
user_id uuid not null
debt_id uuid not null references debts(id)
movement_id uuid null references movements(id)
amount numeric(14,2) not null
currency text not null default 'PEN'
paid_at timestamptz not null
source text not null
created_at
metadata jsonb
```

### 10.4 `debt_installments`

Campos:

```text
id uuid pk
user_id uuid not null
debt_id uuid not null references debts(id)
number int not null
due_date date not null
expected_amount numeric(14,2) not null
paid_amount numeric(14,2) not null default 0
status installment_status not null
movement_id uuid null references movements(id)
created_at
updated_at
metadata jsonb
```

Reglas de ciclo de vencimiento V1:

- Estados abiertos: `pending`, `due_soon`, `overdue`.
- Una cuota queda `due_soon` desde tres dias antes de `due_date`, incluyendo el
  dia de vencimiento.
- Una cuota queda `overdue` cuando `due_date` es anterior a la fecha local del
  usuario.
- `paid`, `rescheduled` y `skipped` son estados terminales para el refresco
  automatico y nunca se reabren.
- El estado padre de una deuda abierta es `overdue` si alguna cuota abierta esta
  vencida; si no, es `due_soon` cuando alguna vence pronto; en otro caso es
  `active`.
- `refresh_debt_installment_lifecycle` es un RPC exclusivo de `service_role`.
  Solo modifica `status`, metadata de trazabilidad y outbox; no modifica
  `expected_amount`, `paid_amount`, `principal_amount`, `current_balance`,
  movimientos, cuentas ni cajas.
- El RPC bloquea las filas evaluadas y solo emite eventos cuando existe una
  transicion real, por lo que repetir la misma corrida es idempotente.

### 10.5 `debt_payment_allocations`

Tabla puente auditable para soportar varios abonos por cuota y un pago repartido
entre varias cuotas.

Campos:

```text
id uuid pk
user_id uuid not null
debt_id uuid not null references debts(id)
debt_payment_id uuid not null references debt_payments(id)
debt_installment_id uuid not null references debt_installments(id)
movement_id uuid not null references movements(id)
allocated_amount numeric(14,2) not null
allocation_order int not null
policy text not null
metadata jsonb
created_at
```

Reglas:

- `allocated_amount > 0`.
- Un pago solo puede tener una asignacion por cuota.
- La politica V1 es `oldest_open_due_date_first_v1`.
- Un abono parcial aumenta `debt_installments.paid_amount`.
- El excedente dentro del saldo de deuda continua por las siguientes cuotas.
- Movimiento, saldos opcionales, deuda, pago, asignaciones, cuotas y outbox se
  confirman en la misma transaccion Core.
- Si la deuda no tiene calendario, el pago sigue siendo valido y no crea
  asignaciones.
- Si la deuda queda en cero antes de agotar un calendario inconsistente, las
  cuotas abiertas restantes se marcan `skipped` con razon auditable.

---

## 11. Recurrentes

### 11.1 `recurring_rules`

Campos:

```text
id uuid pk
user_id uuid not null
status recurring_status not null
name text not null
merchant_pattern text null
expected_amount numeric(14,2) null
amount_variability text not null
currency text not null default 'PEN'
frequency text not null
day_of_month int null
next_expected_date date null
category_id text null
subcategory_id uuid null
linked_box_id uuid null references boxes(id)
linked_debt_id uuid null references debts(id)
source text not null
requires_confirmation_for_payment boolean not null default true
created_at
updated_at
deleted_at
metadata jsonb
```

### 11.2 `recurring_occurrences`

Campos:

```text
id uuid pk
user_id uuid not null
recurring_rule_id uuid not null references recurring_rules(id)
expected_date date not null
expected_amount numeric(14,2) null
status recurring_occurrence_status not null
paid_at timestamptz null
paid_movement_id uuid null references movements(id)
created_at
updated_at
metadata jsonb
```

### 11.3 `recurring_candidates`

Campos:

```text
id uuid pk
user_id uuid not null
merchant_key text null
category_id text null
evidence jsonb not null
confidence numeric(5,4) not null
status recurring_candidate_status not null default 'candidate'
created_at
updated_at
metadata jsonb
```

Reglas:

- Candidato no es recurrente activo.
- Recurrente esperado no afecta saldo de cuenta.
- Pago recurrente confirmado crea movimiento.

---

## 12. Insights Y Nudges

### 12.1 `insights`

Campos:

```text
id uuid pk
user_id uuid not null
type insight_type not null
status insight_status not null
title text not null
body text not null
evidence_summary jsonb not null
action_type text null
rank_score numeric(8,4) null
risk_level risk_level not null default 'low'
valid_from timestamptz not null
expires_at timestamptz null
displayed_at timestamptz null
delivered_channels text[] not null default '{}'
outdated_at timestamptz null
created_at
updated_at
metadata jsonb
```

### 12.2 `insight_events`

Eventos de entrega, visualizacion, accion y mutacion de descubrimientos. No reemplaza `insights`; deja trazabilidad de lo que el usuario vio o hizo.

Campos:

```text
id uuid pk
user_id uuid not null
insight_id uuid not null references insights(id)
event_type text not null
channel text null
occurred_at timestamptz not null
trace_id uuid null
metadata jsonb
```

Eventos V1:

```text
displayed
sent
seen
acted
dismissed
ignored
outdated
expired
```

Regla: si un insight fue enviado por WhatsApp y luego se recalcula, no se borra el historial; se marca `outdated` y el Dashboard muestra la version actualizada.

### 12.3 `nudge_preferences`

Campos:

```text
id uuid pk
user_id uuid not null
nudge_type nudge_type not null
enabled boolean not null default false
channel text not null default 'dashboard'
quiet_hours_override jsonb null
paused_until timestamptz null
metadata jsonb not null default '{}'
created_at
updated_at
```

Regla V1:

- El default seguro es `dashboard`; WhatsApp/email proactivos requieren opt-in, politica de envio y canal explicito.
- En el Dashboard V1, ausencia de fila equivale a aviso interno habilitado; una fila explicita con `enabled = false` lo suprime. Esto no autoriza ningun canal externo.
- Desactivar una preferencia expira sus candidatos abiertos sin tocar movimientos, cuentas, cajas, deudas ni cuotas.
- `paused_until` queda preparado para pausa temporal; mientras siga vigente, la preferencia efectiva se considera desactivada.

### 12.4 `nudge_candidates`

Campos:

```text
id uuid pk
user_id uuid not null
type nudge_type not null
source_entity_type text not null
source_entity_id uuid not null
priority int not null
risk_level risk_level not null
status nudge_status not null default 'candidate'
scheduled_for timestamptz null
created_at
updated_at
metadata jsonb
```

Reglas V1:

- Un candidato puede mostrarse en Dashboard sin autorizar envio externo.
- El estado por si solo no envia nada; `NudgePolicy`/worker deciden canal y momento.
- Descartar un candidato no debe tocar movimientos, saldos, deudas ni recurrentes.

### 12.5 `nudge_deliveries`

Campos:

```text
id uuid pk
user_id uuid not null
nudge_candidate_id uuid null references nudge_candidates(id)
channel text not null
status nudge_status not null
sent_at timestamptz null
delivered_at timestamptz null
responded_at timestamptz null
response_summary text null
created_at
metadata jsonb
```

---

## 13. Conversacion Y Agentes

### 13.1 `conversations`

Campos:

```text
id uuid pk
user_id uuid not null
channel text not null
external_thread_id text null
status text not null
created_at
updated_at
metadata jsonb
```

### 13.2 `conversation_states`

Campos:

```text
id uuid pk
user_id uuid not null
conversation_id uuid not null references conversations(id)
state text not null
reason text null
context jsonb not null default '{}'::jsonb
active_until timestamptz null
soft_until timestamptz null
archive_until timestamptz null
created_at
updated_at
```

### 13.3 `whatsapp_window_states`

Estado calculable/persistible para manejar la ventana de servicio de WhatsApp sin perder calidad ni disparar costo.

Campos:

```text
id uuid pk
user_id uuid not null
phone text not null
last_user_message_at timestamptz null
window_expires_at timestamptz null
status text not null -- open | closing_soon | closed
paid_templates_today int not null default 0
paid_templates_this_month int not null default 0
last_paid_template_at timestamptz null
last_window_continuation_prompt_at timestamptz null
last_window_final_prompt_at timestamptz null
created_at
updated_at
metadata jsonb
```

Reglas:

- La ventana se renueva solo con mensaje del usuario.
- El estado no autoriza envios por si mismo; `NudgePolicy`/`DeliveryPlanner` deciden.
- `paid_templates_*` es observabilidad/guardrail, no limite rigido que degrade calidad.

### 13.4 `agent_traces`

Campos:

```text
id uuid pk
user_id uuid not null
trace_id uuid not null
agent_name text not null
runtime_provider text not null
model_name text null
context_pack_type text not null
context_pack_version text not null
tool_calls jsonb not null default '[]'
input_summary jsonb not null default '{}'::jsonb
output_summary jsonb not null default '{}'::jsonb
confidence numeric(5,4) null
latency_ms int null
cost_estimate numeric(12,6) null
status text not null
created_at
metadata jsonb
```

Regla:

- No guardar chain-of-thought.

---

## 14. Email

### 14.1 `email_connections`

Campos:

```text
id uuid pk
user_id uuid not null
provider text not null
email_address text not null
status text not null
scopes text[] not null
encrypted_refresh_token text null
watch_expiration timestamptz null
last_history_id text null
last_watch_renewed_at timestamptz null
watch_status text null
provider_account_id text null
created_at
updated_at
deleted_at
metadata jsonb
```

Reglas:

- `encrypted_refresh_token` es obligatorio solo para una conexion Gmail activa que requiere refresh token.
- Al desconectar email, el token se elimina o se deja `null`; la fila puede quedar para auditoria/estado sin conservar secreto.
- `watch_status` debe usar los estados definidos en `22_decision_email_provider.md`.
- La unicidad es por `(user_id, provider, email_address)`, no por
  `(user_id, provider)`: un usuario puede conectar varios Gmail.

### 14.1.1 `email_institutions`

Catalogo operativo, editable sin deploy, de bancos/apps que pueden configurarse.

Campos:

```text
institution_key text pk
display_name text not null
aliases text[] not null
enabled boolean not null default true
sort_order int not null
metadata jsonb not null
created_at
updated_at
```

### 14.1.2 `user_email_sources`

Vinculo explicito entre institucion, buzon Gmail y remitente de notificaciones.

Campos:

```text
id uuid pk
user_id uuid not null
institution_key text not null references email_institutions(institution_key)
email_connection_id uuid not null references email_connections(id)
notification_sender text not null
status text not null -- shadow | active | paused | disabled
verification_status text not null -- pending | verified | rejected
verified_at timestamptz null
created_at
updated_at
deleted_at
metadata jsonb not null
```

Reglas:

- una configuracion vigente por `user_id + institution_key`;
- una combinacion vigente `email_connection_id + notification_sender` no puede
  pertenecer a dos instituciones;
- editar buzon/remitente recalcula la verificacion;
- solo un template exacto `active + verified` activa la fuente;
- fuentes `shadow`, `paused`, `disabled` o `rejected` nunca crean `Pending`;
- el worker filtra por fuente antes de descargar el cuerpo.

### 14.2 `email_messages`

Campos:

```text
id uuid pk
user_id uuid not null
email_connection_id uuid not null references email_connections(id)
provider_message_id text not null
provider_thread_id text null
received_at timestamptz not null
sender text null
subject_hash text null
content_hash text null
parsed_status text not null
created_at
metadata jsonb
```

Regla:

- No guardar contenido completo del email si no es necesario.
- Guardar metadata y extracciones minimas.
- `provider_message_id` debe ser unico por `email_connection_id`.
- `content_hash` permite dedup sin persistir cuerpo completo.

### 14.3 `email_parse_templates`

Templates/versiones de parsing para remitentes financieros soportados. Evita hardcodear reglas en workers y permite auditar cambios.

Campos:

```text
id uuid pk
provider text not null default 'gmail'
institution_key text not null
sender_pattern text not null
template_version text not null
priority int not null default 100
enabled boolean not null default true
parser_config jsonb not null
sample_hashes text[] not null default '{}'
created_at
updated_at
metadata jsonb
```

Seeds V1 esperados:

```text
yape
bcp
bbva
interbank
```

Regla: un template solo produce `pending_items`; nunca registra movimiento confirmado desde email.

---

## 15. Eventos Y Outbox

### 15.1 `external_event_log`

Campos:

```text
id uuid pk
source text not null
event_type text not null
idempotency_key text not null
user_id uuid null
received_at timestamptz not null default now()
status text not null
payload_hash text not null
payload_ref text null
trace_id uuid not null
metadata jsonb
unique (source, idempotency_key)
```

Reglas:

- `payload_hash` siempre existe para idempotencia y auditoria.
- `payload_ref` es opcional y solo puede apuntar a storage cifrado de corta retencion cuando el evento necesita replay/debug controlado.
- Si `payload_ref` es null, el evento debe incluir metadata suficiente para auditoria operativa, pero no promete reprocesamiento completo.

### 15.2 `transactional_outbox`

Campos:

```text
id uuid pk
user_id uuid not null
event_type text not null
aggregate_type text not null
aggregate_id uuid not null
payload jsonb not null
payload_version int not null default 1
status text not null default 'pending'
attempt_count int not null default 0
next_attempt_at timestamptz not null default now()
published_at timestamptz null
trace_id uuid not null
created_at timestamptz not null default now()
last_error text null
```

### 15.3 `internal_event_log`

Campos:

```text
id uuid pk
outbox_id uuid not null references transactional_outbox(id)
event_type text not null
consumer_name text not null
status text not null
processed_at timestamptz null
attempt_count int not null default 0
last_error text null
created_at
metadata jsonb
```

### 15.4 `worker_job_runs`

Registro operativo de ejecuciones internas. No reemplaza auditoria financiera
del Core; sirve para saber que corrio, cuanto demoro, que fallo y que se puede
reintentar.

Campos:

```text
id uuid pk
job_name text not null
trigger text not null
status text not null -- running | succeeded | partial | failed
trace_id uuid not null
started_at timestamptz not null
finished_at timestamptz null
duration_ms int null
claimed_count int not null default 0
processed_count int not null default 0
failed_count int not null default 0
skipped_count int not null default 0
metadata jsonb
result jsonb
last_error text null
created_at
updated_at
```

Reglas:

- Solo `service_role` puede leer/escribir.
- No guarda secretos ni payloads financieros completos.
- Puede registrar outbox, jobs diarios y replay operativo.
- Un replay solo puede reencolar eventos `failed`, `dead_letter` o `processing`;
  nunca eventos `published`.

---

## 16. Learning

### 16.1 `learning_signals`

Campos:

```text
id uuid pk
user_id uuid not null
signal_type text not null
source_entity_type text not null
source_entity_id uuid null
before_value jsonb null
after_value jsonb null
confidence numeric(5,4) null
applied boolean not null default false
created_at
metadata jsonb
```

Reglas:

- Learning no cambia opt-in sin permiso.
- Learning sugiere; Core/Policy deciden.

---

## 17. RLS

Reglas base:

```sql
alter table <table> enable row level security;

create policy "select own rows"
on <table> for select
using (auth.uid() = user_id);
```

Mutaciones:

- El cliente puede mutar solo tablas y campos seguros.
- Movimientos, deudas, recurrentes y pendientes deben pasar por backend/Core.
- Service role solo en backend/workers.

Pruebas RLS obligatorias:

- usuario A no lee datos de usuario B,
- usuario A no edita movimiento de usuario B,
- anon no accede a datos financieros,
- service role se usa solo en rutas internas.

---

## 18. Indices Recomendados

| Tabla | Indices |
|---|---|
| movements | `(user_id, occurred_at desc)`, `(user_id, type)`, `(user_id, category_id)`, `(user_id, account_origin_id)`, `(user_id, source_ref)` |
| pending_items | `(user_id, status, created_at)`, `(user_id, source, source_ref)` |
| accounts | `(user_id, deleted_at)` |
| boxes | `(user_id, account_id, deleted_at)` |
| debts | `(user_id, status)`, `(user_id, related_person_id)` |
| recurring_rules | `(user_id, status, next_expected_date)` |
| recurring_occurrences | `(user_id, status, expected_date)` |
| insights | `(user_id, status, rank_score desc)` |
| insight_events | `(user_id, insight_id, occurred_at desc)`, `(user_id, event_type, occurred_at desc)` |
| nudge_candidates | `(user_id, status, scheduled_for)` |
| whatsapp_window_states | `(user_id, phone)`, `(user_id, status, window_expires_at)` |
| email_connections | `(user_id, provider, status)`, `(user_id, email_address)` |
| email_institutions | `(enabled, sort_order)` |
| user_email_sources | unique vigente `(user_id, institution_key)`, unique vigente `(email_connection_id, notification_sender)`, `(user_id, status)` |
| email_messages | unique `(email_connection_id, provider_message_id)`, `(user_id, received_at desc)`, `(user_id, parsed_status)` |
| email_parse_templates | unique `(provider, institution_key, template_version)`, `(enabled, priority)` |
| transactional_outbox | `(status, next_attempt_at)`, `(user_id, created_at)` |
| external_event_log | unique `(source, idempotency_key)` |

---

## 19. Orden De Migraciones

1. Extensions y enums.
2. Profiles/preferences.
3. Categories seed.
4. Accounts/boxes.
5. Movements/audit/tags.
6. Pending items.
7. Related persons/debts/installments/payments.
8. Recurring rules/occurrences/candidates.
9. Insights/nudges.
10. Conversations/states.
11. Email connections/messages/templates.
12. External events/outbox/internal logs.
13. Agent traces/learning signals.
14. RLS policies.
15. Indices.
16. Seed/test fixtures.

---

## 20. Criterios De Aceptacion

- Los 11 tipos canonicos de movimiento estan modelados.
- Los enums principales tienen valores V1 definidos antes de generar migrations.
- Cuenta `null` es permitida donde corresponde.
- Caja siempre pertenece a cuenta.
- Caja libre no existe como tabla.
- Pendientes no afectan saldo.
- Email no confirmado no crea movimiento.
- `email_connections` permite eliminar token al desconectar sin borrar trazabilidad.
- Gmail watch/history queda modelado para renovacion y recuperacion.
- `email_parse_templates` existe para no hardcodear reglas de parsing financiero.
- `whatsapp_window_states` soporta estrategia 24h sin depender de memoria de proceso.
- Deudas y recurrentes tienen entidades propias.
- `insight_events` existe para trazabilidad de entrega, accion y mutacion de descubrimientos.
- Outbox existe como tabla transaccional.
- External events e internal events estan separados.
- RLS esta definida para tablas de usuario.
- Audit log existe para cambios financieros.
- Agent traces no guardan chain-of-thought.

---

## 21. Resumen

El modelo de datos V1 debe ser tolerante con datos imperfectos, pero estricto con dinero.

```text
Imperfecto esta bien.
Inconsistente no.
```

*Fase 4 Tecnica - Documento 16 - V1.4*
