# 13 — Modelo de datos V1-web

**Bloque:** 02 — Fundaciones
**Estado:** V1 (migración con mejoras)
**Fecha:** 25 de julio de 2026
**Depende de:** `07_alcance_web_v1.md`, `09_modelo_mental_dinero.md`, `12_arquitectura_app_web.md`
**Documentos que dependen de este:** §4 de todos los módulos, `14_contratos_api_web.md`, `15_seguridad_autorizacion_y_rls.md`
**Fuentes:** `docs/fase_4_tecnica/16_modelo_datos.md` (V1.4, el activo más valioso del corpus anterior) — se conserva íntegro; se documentan las migraciones 042–046 nunca registradas y se añaden las tablas de los módulos nuevos

---

## 1. Para qué existe este documento

`docs/fase_4_tecnica/16_modelo_datos.md` sigue siendo correcto en todo lo que
cubre. Este documento hace tres cosas que aquel no puede hacer sin editarse:

1. **Documenta las migraciones 042 a 046**, implementadas después de que el
   ledger de construcción se detuviera el 23 de julio de 2026. Ninguna
   aparece en el modelo de datos anterior.
2. **Añade las tablas de los módulos nuevos**: presupuestos, metas, límites,
   proyecciones, importaciones, reportes guardados, hilos del asistente y
   recordatorios in-app.
3. **Corrige el estado del árbol de migraciones**, que estaba duplicado y
   desincronizado (resuelto en la Ola 0, ver `WEB-D009`).

## 2. Estado real del esquema

| Dato | Valor verificado el 25 de julio de 2026 |
|---|---|
| Migraciones aplicadas | 46 (`001` a `046`) |
| Tablas en `public` | 43 |
| Tablas con RLS activo | 43 |
| Políticas RLS | 65 |
| Fuente canónica | `supabase/migrations/` |
| Espejo sincronizado | `src/data/migrations/` (lo consume `migrations.test.ts`) |

Regla de proceso: ambos árboles deben permanecer idénticos en los archivos
`NNN_*.sql`. La divergencia detectada en la Ola 0 (faltaba la `018` completa
y diferían la `026` y la `030`) queda resuelta y con prueba que la vigila
(`51_estrategia_de_pruebas_web.md`).

## 3. Convenciones

Heredadas sin cambios de `16_modelo_datos.md` §3:

```sql
id          uuid primary key default gen_random_uuid()
user_id     uuid not null references auth.users(id)
created_at  timestamptz not null default now()
updated_at  timestamptz not null default now()
deleted_at  timestamptz null
metadata    jsonb not null default '{}'::jsonb
```

Dinero:

```sql
amount    numeric(14,2) not null
currency  text not null default 'PEN'
```

- PEN es la moneda principal. USD existe en el modelo; la interfaz
  multi-moneda queda fuera de V1 (`07_alcance_web_v1.md` §4).
- Nunca `float` para dinero.
- Montos negativos solo en `ajuste` y en campos que lo declaren.

Tiempo: todo `timestamptz`. La zona horaria de referencia del producto es
`America/Lima`; la conversión ocurre en la capa de presentación, nunca en la
base de datos.

## 4. Enums canónicos

Se conservan los 21 enums de `16_modelo_datos.md` §4 sin modificación. Los
principales, por su peso en el resto del corpus:

**`movement_type`** — los 11 tipos canónicos. Los 11 deben ser guardables
desde la interfaz (`07_alcance_web_v1.md` §3.3, cierra `C-05`):

```text
gasto · ingreso · transferencia · asignacion_interna · deuda_adquirida
pago_deuda · prestamo_dado · prestamo_recibido · devolucion_recibida
pago_recurrente · ajuste
```

**`movement_status`**: `confirmed`, `needs_review`, `corrected`, `deleted`,
`reversed`. Los pendientes no usan este enum: viven en `pending_items`.

**`movement_source`**: `whatsapp`, `dashboard_manual`, `email_confirmed`,
`recurring_confirmed`, `backfill_confirmed`, `system_adjustment`.

> **Ampliación requerida:** los módulos nuevos introducen dos orígenes que
> el enum no contempla: `import_confirmed` (importación de archivo,
> `29_modulo_captura_sin_friccion_e_importacion.md`) y `assistant_confirmed`
> (registro propuesto por el asistente y confirmado por el usuario,
> `41_asistente_ia_en_la_app.md`). Se añaden en la migración `047`.

El resto (`pending_source`, `risk_level`, `account_type`, `box_type`,
`pending_type`, `pending_status`, `debt_direction`, `debt_kind`,
`debt_status`, `installment_status`, `recurring_status`,
`recurring_occurrence_status`, `recurring_candidate_status`, `insight_type`,
`insight_status`, `nudge_type`, `nudge_status`, `onboarding_status`) se
conserva tal cual.

## 5. Tablas existentes

Las 43 tablas actuales se conservan sin cambios estructurales, salvo donde
este documento indique lo contrario. Agrupadas por dominio:

| Dominio | Tablas |
|---|---|
| Usuario | `profiles`, `user_preferences`, `experience_preference_events` |
| Dinero | `accounts`, `boxes` |
| Movimientos | `movements`, `movement_audit_log`, `movement_tags` |
| Pendientes | `pending_items` |
| Clasificación | `categories`, `user_subcategories`, `tags` |
| Deudas | `debts`, `debt_installments`, `debt_payments`, `debt_payment_allocations`, `related_persons` |
| Recurrentes | `recurring_rules`, `recurring_occurrences`, `recurring_candidates` |
| Descubrimientos | `insight_candidates`, `insight_deliveries` |
| Recordatorios | `nudge_candidates`, `nudge_deliveries`, `nudge_preferences` |
| Aprendizaje | `learning_candidates`, `learning_evidence`, `learning_memory_events`, `learning_preferences`, `financial_memory_items` |
| Conversación | `conversation_memory_states` |
| Correo | `email_connections`, `email_messages`, `email_institutions`, `email_parse_templates`, `user_email_sources` |
| WhatsApp (fase 2) | `whatsapp_window_states`, `whatsapp_delivery_attempts` |
| Infraestructura | `transactional_outbox`, `internal_event_log`, `external_event_log`, `worker_job_runs`, `dedup_decisions` |

El detalle campo por campo de cada una vive en
`docs/fase_4_tecnica/16_modelo_datos.md` §5 a §16, que se reutiliza como
referencia directa. Este documento no lo duplica: lo cita.

## 6. Migraciones 042 a 046 — documentación pendiente

Implementadas en código, nunca registradas en ningún documento. Se
documentan aquí por primera vez.

### 6.1 `042_conversation_focus_set`

**Qué hace:** elimina el índice único por `(user_id, channel, scope)` en
`conversation_memory_states` y lo reemplaza por `(user_id, scope)`. Antes de
migrar, conserva solo el estado más reciente cuando el mismo ámbito se usó
de forma independiente desde canales distintos.

**Por qué importa:** convierte el foco conversacional en **compartido entre
canales**. Es la migración que cierra la contradicción `C-10` ("Core común,
conversación no común") a nivel de datos, y es exactamente lo que permite
que el motor sea agnóstico de canal (`WEB-D003`).

**Consumido por:** `20_arquitectura_motor_conversacional.md`,
`42_reutilizacion_del_codigo_existente_motor.md`.

### 6.2 `043_debt_creation_core`

**Qué hace:** añade `idempotency_key` a `debts` con índice único parcial por
usuario, y crea la función `manzana.commit_debt_creation`, que ejecuta de
forma atómica la creación de una deuda junto con su persona relacionada,
sus cuotas, su movimiento asociado, los registros de auditoría, los deltas
de cuentas y cajas, y los eventos de outbox.

**Por qué importa:** cierra el hallazgo §4.7 de la auditoría — se creaban
pendientes de deuda que se presentaban como confirmables pero no podían
confirmarse, porque no existía un camino atómico para dar de alta una deuda.

**Consumido por:** `31_modulo_deudas.md`, `27_modulo_pendientes_y_confirmaciones.md`.

### 6.3 `044_learning_governance`

**Qué hace:** amplía los estados de `learning_candidates` con `suspended` y
`expired`, y añade `positive_evidence_refs`, `negative_evidence_refs`,
`positive_evidence_count` y `negative_evidence_count`.

**Por qué importa:** hasta esta migración, la confianza de un aprendizaje
solo podía **aumentar** (`confidence = greatest(anterior, nueva)`). Con
evidencia negativa y estados de suspensión, un aprendizaje puede
contradecirse, degradarse y caducar. Es la base de datos que sostiene el
principio de reversibilidad (`08_principios_experiencia_web.md` §4.3) y
cierra parte de `C-08`.

**Consumido por:** `36_modulo_memoria_y_aprendizaje.md`.

### 6.4 `045_experience_privacy_preferences`

**Qué hace:** crea `experience_preference_events` con `idempotency_key`
único por usuario, estado anterior y siguiente en JSON, tipo de actor
(`user`, `system`, `worker`) y RLS activo.

**Por qué importa:** convierte las preferencias de experiencia —entre ellas
el modo discreto— en **estado de servidor auditable**, no en un interruptor
local por pantalla. Cierra `C-04`.

**Consumido por:** `45_configuracion_privacidad_y_control_de_datos.md`.

### 6.5 `046_movement_restore`

**Qué hace:** añade `restored` al conjunto de acciones válidas de
`movement_audit_log`.

**Por qué importa:** hace de la restauración de un movimiento eliminado una
acción auditable de primera clase, en vez de una edición silenciosa. Sostiene
el estado "Eliminado → restaurable" de
`11_confianza_errores_y_reversibilidad.md` §3 y cierra parte de `C-07`.

**Consumido por:** `26_modulo_movimientos.md`.

## 7. Tablas nuevas

Requeridas por los módulos añadidos en `07_alcance_web_v1.md`. Se agrupan en
migraciones a partir de la `047`.

### 7.1 Presupuestos, metas y límites — migración `048`

**`budgets`** — un presupuesto de gasto para una categoría en un periodo.

```text
id            uuid pk
user_id       uuid not null
category_id   text null            -- null = presupuesto general
period_kind   budget_period not null   -- semanal | quincenal | mensual
period_start  date not null
period_end    date not null
amount        numeric(14,2) not null
kind          budget_kind not null     -- presupuesto | limite_blando | limite_duro
rollover      boolean not null default false
source        budget_source not null   -- manual | sugerido
status        budget_status not null   -- activo | pausado | archivado
created_at, updated_at, deleted_at, metadata
```

Restricciones: `amount > 0`; `period_end > period_start`; único por
`(user_id, category_id, period_start, kind)` cuando no está borrado.

**`goals`** — una meta de ahorro, opcionalmente respaldada por una caja.

```text
id             uuid pk
user_id        uuid not null
name           text not null
target_amount  numeric(14,2) not null
target_date    date null
box_id         uuid null references boxes(id)
status         goal_status not null     -- activa | alcanzada | pausada | archivada
created_at, updated_at, deleted_at, metadata
```

Regla de dominio derivada de `09_modelo_mental_dinero.md` §8: **un
presupuesto no reserva dinero.** No existe ninguna columna que descuente de
saldos ni de dinero libre. Una meta sí puede afectar el dinero libre, pero
solo de forma indirecta, a través de la caja que la respalda.

**`budget_progress_snapshots`** — fotos del avance para historial y
comparativas, sin recalcular todo el pasado en cada consulta.

```text
id, user_id, budget_id, as_of date, spent numeric(14,2),
remaining numeric(14,2), pct numeric(5,4), created_at
```

### 7.2 Importación y captura — migración `049`

**`import_batches`** — un lote de importación, para poder deshacerlo entero.

```text
id             uuid pk
user_id        uuid not null
filename       text null
file_hash      text null
format         import_format not null   -- csv | ofx | xlsx
account_id     uuid null references accounts(id)
status         import_status not null   -- previsualizando | confirmado | deshecho | fallido
total_rows     integer not null default 0
imported_rows  integer not null default 0
pending_rows   integer not null default 0
skipped_rows   integer not null default 0
column_mapping jsonb not null default '{}'
created_at, updated_at, metadata
```

**`import_rows`** — cada fila con su destino y su resultado.

```text
id, user_id, batch_id, row_number, raw jsonb,
parsed jsonb, outcome import_row_outcome,   -- registrado | pendiente | duplicado | descartado | error
movement_id uuid null, pending_item_id uuid null,
error_reason text null, created_at
```

Regla derivada de `C-06`: cada fila se resuelve de forma independiente. Un
lote con 40 filas claras y 2 ambiguas registra 40 y deja 2 pendientes; no
se bloquea entero.

`file_hash` permite detectar la reimportación del mismo archivo y avisar
antes de duplicar.

### 7.3 Proyecciones y simulación — migración `050`

**`simulation_scenarios`** — escenarios guardados (marcado `V1.1` en el
alcance; la tabla se crea ahora para no cerrarle la puerta al modelo).

```text
id, user_id, name, assumptions jsonb not null,
horizon_days integer not null, result jsonb not null,
created_at, updated_at, deleted_at
```

Las proyecciones de uso corriente **no se persisten**: se calculan al vuelo
por el motor determinista a partir de movimientos, compromisos y
presupuestos. Persistir una proyección la volvería obsoleta en cuanto el
usuario registre algo. `assumptions` es obligatorio porque el principio de
procedencia exige que todo supuesto sea explícito y recuperable.

### 7.4 Reportes y exportaciones — migración `051`

**`saved_reports`** — configuración de reporte guardada, no sus datos.

```text
id, user_id, name, config jsonb not null, created_at, updated_at, deleted_at
```

**`export_jobs`** — trazabilidad de exportaciones, requerida por privacidad.

```text
id            uuid pk
user_id       uuid not null
kind          export_kind not null      -- movimientos | datos_completos | reporte
format        export_format not null    -- csv | xlsx | pdf | json
status        export_status not null    -- pendiente | procesando | listo | expirado | fallido
row_count     integer null
requested_at  timestamptz not null default now()
completed_at  timestamptz null
expires_at    timestamptz null
metadata      jsonb
```

No se guarda el archivo generado más allá de su ventana de expiración.
Registrar la solicitud es obligación de auditoría de privacidad
(`45_configuracion_privacidad_y_control_de_datos.md`).

### 7.5 Asistente en la app — migración `052`

**`assistant_threads`** y **`assistant_messages`**.

```text
assistant_threads:
  id, user_id, title text null, channel text not null default 'web',
  status thread_status not null, created_at, updated_at, deleted_at

assistant_messages:
  id                uuid pk
  user_id           uuid not null
  thread_id         uuid not null references assistant_threads(id)
  role              message_role not null      -- usuario | asistente | sistema
  content           jsonb not null             -- bloques neutrales de canal
  evidence_refs     text[] not null default '{}'
  proposed_action   jsonb null
  action_status     action_status null         -- propuesta | confirmada | descartada | expirada
  resulting_movement_id uuid null
  trace_id          text null
  created_at
```

Tres decisiones de diseño con consecuencias:

- `content` guarda **bloques neutrales de canal**, no texto renderizado. Es
  lo que permite que el mismo hilo se presente en la web hoy y en WhatsApp
  mañana (`21_contrato_de_canal_y_presentadores.md`).
- `evidence_refs` es obligatorio en los mensajes del asistente que contienen
  cifras. Un mensaje con cifra y sin evidencia es un defecto, no un caso
  válido (`22_grounding_evidencia_y_politica.md`).
- `proposed_action` y `action_status` separan **proponer** de **ejecutar**.
  El mensaje guarda la propuesta; la escritura real solo existe si
  `resulting_movement_id` está poblado (`WEB-D013`).

`channel` existe desde el principio con valor `'web'` para que la fase 2 no
requiera migrar datos.

### 7.6 Recordatorios in-app — migración `053`

Se reutiliza la infraestructura existente (`nudge_candidates`,
`nudge_deliveries`, `nudge_preferences`) y se amplía el canal de entrega:

```text
nudge_deliveries.channel: se añaden 'in_app' y 'email'
```

**`in_app_notifications`** — la bandeja visible al usuario.

```text
id, user_id, nudge_delivery_id uuid null, kind text not null,
title text not null, body text not null, action_url text null,
read_at timestamptz null, dismissed_at timestamptz null,
created_at, expires_at
```

Regla heredada y ampliada: **ningún canal viene activado por defecto**
(cierra `C-17`). `nudge_preferences` gobierna el consentimiento por tipo y
por canal.

## 8. Nuevos enums

Introducidos por las tablas de §7:

```text
budget_period        semanal | quincenal | mensual
budget_kind          presupuesto | limite_blando | limite_duro
budget_source        manual | sugerido
budget_status        activo | pausado | archivado
goal_status          activa | alcanzada | pausada | archivada
import_format        csv | ofx | xlsx
import_status        previsualizando | confirmado | deshecho | fallido
import_row_outcome   registrado | pendiente | duplicado | descartado | error
export_kind          movimientos | datos_completos | reporte
export_format        csv | xlsx | pdf | json
export_status        pendiente | procesando | listo | expirado | fallido
thread_status        activo | archivado
message_role         usuario | asistente | sistema
action_status        propuesta | confirmada | descartada | expirada
```

Ampliación de un enum existente:

```text
movement_source      + import_confirmed | assistant_confirmed
```

## 9. Orden de migraciones nuevas

| Nº | Contenido | Depende de |
|---|---|---|
| `047` | Ampliación de `movement_source` con `import_confirmed` y `assistant_confirmed` | 006 |
| `048` | Presupuestos, metas y snapshots de avance | 003, 004, 006 |
| `049` | Lotes y filas de importación | 006, 007 |
| `050` | Escenarios de simulación | 048 |
| `051` | Reportes guardados y trabajos de exportación | 006 |
| `052` | Hilos y mensajes del asistente | 006, 042 |
| `053` | Canal in-app y bandeja de notificaciones | 017, 019, 028 |

Reglas de migración heredadas y vigentes: cada archivo es idempotente
(`if not exists`), nunca usa `add constraint if not exists` (no existe en
PostgreSQL; se comprueba contra `pg_constraint`), y activa RLS en toda tabla
con datos de usuario **en la misma migración que la crea**.

## 10. RLS de las tablas nuevas

Toda tabla de §7 nace con RLS activo y política de aislamiento por
`user_id`, sin excepción. El patrón y la política completa de acceso —
incluida la corrección del uso masivo de `service_role` que hoy esquiva RLS
en unas 50 de 58 rutas — se define en `15_seguridad_autorizacion_y_rls.md`.

Regla específica para las tablas nuevas: **ninguna concede escritura directa
al rol `authenticated` sobre columnas que afecten dinero.** Igual que
`movements`, se escriben a través de funciones del Core.

## 11. Índices requeridos

| Tabla | Índice | Para qué |
|---|---|---|
| `budgets` | `(user_id, period_start desc, category_id)` | Avance del periodo actual en el Inicio |
| `goals` | `(user_id, status)` | Listado de metas activas |
| `import_batches` | `(user_id, created_at desc)` | Historial de importaciones |
| `import_rows` | `(batch_id, row_number)` | Previsualización y deshacer del lote |
| `import_batches` | `(user_id, file_hash)` | Detección de reimportación |
| `assistant_messages` | `(thread_id, created_at)` | Carga de la conversación |
| `assistant_threads` | `(user_id, updated_at desc)` | Listado de hilos |
| `in_app_notifications` | `(user_id, read_at, created_at desc)` | Contador y bandeja |
| `export_jobs` | `(user_id, requested_at desc)` | Historial y expiración |

Los índices de las tablas existentes se conservan según
`16_modelo_datos.md` §18. Se añade uno derivado del cambio de paginación
(`14_contratos_api_web.md`): todo listado paginado por cursor requiere un
índice que cubra su orden estable, típicamente
`(user_id, occurred_at desc, id desc)` en `movements`.

## 12. Qué NO se modela

- Datos de otros usuarios en ninguna tabla (V1 es de usuario individual).
- El cuerpo completo de los correos, por defecto.
- El razonamiento interno crudo del modelo de IA. `assistant_messages`
  guarda bloques de respuesta y referencias de evidencia, nunca cadena de
  pensamiento (regla heredada de privacidad).
- Proyecciones de uso corriente, que se calculan al vuelo.
- Presupuestos como dinero apartado.
- Datos de tarjeta, credenciales bancarias o números de cuenta completos.

## 13. Criterios de aceptación

- `AC-DATOS-01` — `supabase/migrations/` y `src/data/migrations/` contienen
  archivos `NNN_*.sql` idénticos. Evidencia: `TEST`.
- `AC-DATOS-02` — Toda tabla con datos de usuario tiene RLS activo y política
  de aislamiento. Evidencia: `TEST`.
- `AC-DATOS-03` — Ninguna tabla nueva concede escritura directa a
  `authenticated` sobre columnas que afecten dinero. Evidencia: `TEST`.
- `AC-DATOS-04` — Un lote de importación puede deshacerse por completo y
  revertir todos sus movimientos. Evidencia: `TEST`.
- `AC-DATOS-05` — Un mensaje del asistente con cifra y sin `evidence_refs`
  no se persiste. Evidencia: `TEST`.
- `AC-DATOS-06` — Un presupuesto no modifica ningún saldo ni el dinero libre.
  Evidencia: `TEST`.
- `AC-DATOS-07` — Las migraciones 042 a 046 quedan documentadas y sus
  capacidades tienen módulo responsable asignado. Evidencia: `DOC`.
- `AC-DATOS-08` — Cada listado paginado tiene un índice que cubre su orden
  estable. Evidencia: `CODE` + `TEST`.
