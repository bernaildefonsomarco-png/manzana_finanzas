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
> `29_modulo_captura_sin_friccion.md` §21.1, diferido a V1.1) y `assistant_confirmed`
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
auto_renew    boolean not null default true
alerted_thresholds  smallint[] not null default '{}'   -- 70 | 90 | 100
source        budget_source not null   -- manual | sugerido
status        budget_status not null   -- activo | pausado | archivado
created_at, updated_at, deleted_at, metadata
```

`auto_renew` sostiene `RUL-PRES-10`: la renovación automática se puede
desactivar por presupuesto, y sin columna esa promesa no era implementable.

`alerted_thresholds` guarda qué umbrales ya avisaron **en este periodo**, y se
vacía al renovar. Es lo que hace verificable `RUL-PRES-06` ("una vez por umbral
y periodo"): sin él, un presupuesto superado a mitad de mes convierte cada
compra posterior en una notificación, y `AC-PRES-05` no se puede escribir como
test. Se guarda el umbral y no un contador porque la regla se enuncia por
umbral, y el test debe poder leerse igual que la regla.

Restricciones: `amount > 0`; `period_end > period_start`; `category_id`
referencia `categories(id)`; único parcial por
`(user_id, category_id, period_start, kind)` **entre los de `status = 'activo'`**.

El alcance del único es deliberado y no es "cuando no está borrado": archivar
un presupuesto a mitad de periodo y crear otro para la misma categoría y
periodo es un caso legítimo —es lo que hace `ACT-PRES-03` cuando el usuario
recalibra— y un único sobre los no borrados lo bloquearía. Solo los activos
calculan avance, así que solo entre ellos hay ambigüedad real.

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

Único por `(budget_id, as_of)`: el trabajo diario debe poder reejecutarse sin
duplicar la foto del día.

### 7.2 Importación — migración `049` — **DIFERIDA A V1.1**

> **La importación de archivos se difirió a V1.1** por decisión del usuario
> el 26 de julio de 2026 (`WEB-D026`). Estas tablas quedan **diseñadas y sin
> aplicar**: la migración `049` no se ejecuta hasta activar la
> funcionalidad. Se documentan aquí para que el resto del modelo no le cierre
> la puerta. Ver `29_modulo_captura_sin_friccion.md` §21.1.

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

### 7.3 Proyecciones y simulación — migración `050` — **DIFERIDA A V1.1**

> **Los escenarios guardados son V1.1** (`07_alcance_web_v1.md` §3.10). Esta
> tabla queda **diseñada y sin aplicar**: la migración `050` no se ejecuta
> hasta activar la funcionalidad, mismo criterio que la `049` (`WEB-D026`).
> Una tabla vacía que ningún código lee ni escribe es esquema muerto; lo que
> evita cerrarle la puerta al modelo es el diseño escrito, no el DDL aplicado.
> Ver `33_modulo_proyecciones_y_simulacion.md` §4.2.

**`simulation_scenarios`** — escenarios guardados.

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

### 7.5b Perfil del usuario — migración `054`

Requerido por `20c_perfil_del_usuario_y_voz.md`. Es lo que hace que dos
usuarios con los mismos movimientos no reciban la misma conversación.

**`user_profile_facts`** — un hecho conocido sobre la persona.

```text
id                  uuid pk
user_id             uuid not null
layer               profile_layer not null    -- estilo | vida | vinculo | hilo
key                 text not null             -- 'cobro_frecuencia', 'trabajo', 'longitud_mensaje'
value               jsonb not null
origin              profile_origin not null   -- dicho | observado_confirmado
validity            profile_validity not null -- permanente | revisable | volatil
status              profile_status not null   -- vigente | en_duda | suspendido | caducado
first_seen_at       timestamptz not null default now()
last_confirmed_at   timestamptz null
expires_at          timestamptz null
evidence_refs       text[] not null default '{}'
created_at, updated_at, deleted_at, metadata
```

Único por `(user_id, layer, key)` cuando no está borrado: un hecho nuevo
sobre la misma clave **reemplaza y archiva** al anterior, no se acumula.

Cuatro campos merecen justificación, porque son los que evitan que el perfil
haga daño:

| Campo | Por qué existe |
|---|---|
| `origin` | Distingue lo que el usuario contó de lo que el motor dedujo. Un hecho `observado` sin confirmar **no se guarda aquí** — vive como candidato hasta que se confirma. |
| `validity` | Lo permanente (cómo escribe) no caduca; lo revisable (su trabajo) se reconfirma; lo volátil (un viaje en curso) caduca solo. |
| `status` | Ante contradicción pasa a `en_duda`, **no se borra**. Así el usuario puede decir "no, sigue igual" y el hecho se restaura con su historia. |
| `evidence_refs` | De dónde salió: qué dijo, o qué observó el motor y cuándo lo confirmó. Exigido por el principio de procedencia. |

**`user_profile_candidates`** — lo observado que aún no se confirmó.

```text
id, user_id, layer, key, proposed_value jsonb,
evidence_refs text[], observed_at, asked_at timestamptz null,
ask_count integer not null default 0,
status candidate_status not null   -- pendiente | confirmado | rechazado | abandonado
```

`ask_count` implementa la regla de `20c` §3: si el usuario ignora dos veces,
no se vuelve a preguntar por ese hecho.

**`user_profile_events`** — auditoría de cambios, con el mismo patrón que
`experience_preference_events` (migración `045`): estado anterior, estado
siguiente, actor e idempotencia. Necesario porque el usuario puede corregir
y borrar, y esas acciones deben ser trazables.

### 7.5c Panorama financiero — migración `055`

Requerido por `20b_capa_semantica_y_consulta_abierta.md` §4. Es lo que
permite que el motor sepa quién eres antes de leer tu mensaje, en ~26k
tokens estables y cacheables.

**`user_financial_patterns`** — los patrones ya calculados.

```text
id            uuid pk
user_id       uuid not null
kind          pattern_kind not null  -- gasto_tipico | comercio_habitual | ritmo | ingreso_tipico | tendencia
scope         jsonb not null         -- a qué aplica: categoría, comercio, periodo
value         jsonb not null         -- el patrón: promedio, mediana, frecuencia, desviación
sample_size   integer not null
evidence_refs text[] not null default '{}'
computed_at   timestamptz not null
valid_until   timestamptz null
created_at, updated_at
```

Se recalculan de forma diferida por un worker, no en el momento de la
consulta. `sample_size` permite que el motor sepa cuánta confianza merece un
patrón: "gastas ~S/400 en comida" con 8 movimientos de muestra no es lo
mismo que con 200.

**`user_monthly_summaries`** — el historial anterior a los 90 días,
comprimido.

```text
id             uuid pk
user_id        uuid not null
period_month   date not null          -- primer día del mes
total_spent    numeric(14,2) not null
total_income   numeric(14,2) not null
by_category    jsonb not null         -- desglose
notable        jsonb not null default '[]'  -- hechos del mes: deuda abierta, mes atípico
movement_count integer not null
evidence_refs  text[] not null default '{}'
computed_at    timestamptz not null
```

Único por `(user_id, period_month)`. Esta tabla es la que hace que el
historial completo esté presente sin cargarlo: el motor sabe "en marzo del
año pasado gastaste S/2.100, sobre todo en salidas" sin tener las 90 filas
de marzo.

**`conversation_summaries`** — la capa Hilo del perfil.

```text
id              uuid pk
user_id         uuid not null
thread_id       uuid not null references assistant_threads(id)
topics          text[] not null default '{}'
decisions       jsonb not null default '[]'
open_items      jsonb not null default '[]'
ended_as        text null              -- resuelto | a_medias | abandonado
created_at, updated_at, deleted_at
```

Regla de contenido, heredada de `20c` §2.4: guarda **de qué se habló, no lo
que se dijo**. Temas y conclusiones, no transcripción. Y nunca detalle de
categorías sensibles: guarda "revisó sus gastos de salud", no cuáles.

### 7.5d Registro de cálculos — migración `056`

Requerido por el ciclo de promoción de `20b` §6b. Es lo que convierte el uso
real del sandbox en una señal sobre qué falta en el vocabulario.

**`generated_computations`**

```text
id                uuid pk
signature         text not null        -- forma normalizada del cálculo, no su resultado
shape             jsonb not null       -- qué agrupación y qué medida produjo
depends_on        computation_source not null  -- datos_usuario | conocimiento_mundo | mixto
user_count        integer not null default 0
turn_count        integer not null default 0
avg_duration_ms   integer null
first_seen_at     timestamptz not null
last_seen_at      timestamptz not null
status            computation_status not null  -- registrado | candidato | promovido | descartado
promoted_to       text null            -- nombre de la dimensión o medida resultante
```

Tres decisiones de diseño con consecuencias:

1. **No guarda datos ni resultados**, solo la *forma* del cálculo. Registrar
   qué agrupación se hizo no expone nada del usuario; registrar el resultado
   sí. Esto mantiene la regla de `19_observabilidad_y_telemetria_web.md` §4.1.
2. **`depends_on` implementa el filtro de promoción** de `20b` §6b.2: solo
   los cálculos marcados `datos_usuario` pueden llegar a `candidato`. Lo que
   depende de conocimiento del mundo se registra para medirlo, pero **nunca
   se promueve** — promoverlo lo congelaría y obligaría a mantener una tabla
   por país.
3. **`user_count` es tan importante como `turn_count`.** Un cálculo que una
   sola persona repite mucho no justifica ampliar el vocabulario; uno que
   muchas personas piden, sí.

No hay tabla para el vocabulario en sí: las dimensiones y medidas son
**código**, no datos. La promoción es un cambio de código informado por esta
tabla, no una fila que se inserta.

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

profile_layer        estilo | vida | vinculo | hilo
profile_origin       dicho | observado_confirmado
profile_validity     permanente | revisable | volatil
profile_status       vigente | en_duda | suspendido | caducado
candidate_status     pendiente | confirmado | rechazado | abandonado
pattern_kind         gasto_tipico | comercio_habitual | ritmo | ingreso_tipico | tendencia
computation_source   datos_usuario | conocimiento_mundo | mixto
computation_status   registrado | candidato | promovido | descartado
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
| `049` | Lotes y filas de importación — **diferida a V1.1**, no se aplica | 006, 007 |
| `050` | Escenarios de simulación — **diferida a V1.1**, no se aplica | 048 |
| `051` | Reportes guardados y trabajos de exportación | 006 |
| `052` | Hilos y mensajes del asistente | 006, 042 |
| `053` | Canal in-app y bandeja de notificaciones | 017, 019, 028 |
| `054` | Perfil del usuario: hechos, candidatos y auditoría | 001, 045 |
| `055` | Panorama: patrones, resúmenes mensuales y de conversación | 006, 007, 052, 054 |
| `056` | Registro de cálculos generados | — |
| `057` | Confirmabilidad de pendientes | 008 |
| `058` | Gestión de remitentes bancarios y sugerencias | 006, 028 |
| `059` | Plantillas de movimientos | 006, 007 |
| `060` | Tipos nuevos de descubrimiento y feedback del usuario | 027, 048 |
| `061` | Preferencias observadas, lápidas de memoria y auditoría unificada | 002, 044, 054 |
| `062` | Resolución automática de recordatorios | 017, 053 |
| `063` | Búsquedas guardadas e índices de texto | 006 |
| `064` | Auditoría de eventos de cuenta | 001 |
| `065` | Registro de consentimientos | 001, 045 |

### 9.1 Migración `057` — confirmabilidad de pendientes

Requerida por `27_modulo_pendientes_y_confirmaciones.md` §4.2. Añade a
`pending_items`:

```sql
confirmable      boolean not null default false
confirm_command  jsonb null
```

Con una restricción que traduce a la base la regla "todo pendiente nace
confirmable o no nace":

```sql
alter table public.pending_items
  add constraint pending_items_confirmable_has_command
  check (
    status <> 'pending'
    or confirmable = false
    or confirm_command is not null
  );
```

**Por qué la restricción y no solo código:** el fallo documentado —pendientes
presentados como confirmables que no podían confirmarse— ocurrió porque nada
lo impedía estructuralmente. Con esta restricción, la base rechaza el estado
inválido aunque el código lo intente.

### 9.2 Migración `058` — remitentes bancarios

Requerida por `28_modulo_email_y_deteccion_bancaria.md` §4. Hace editables las
direcciones desde las que cada banco escribe, permite varias activas por
institución, y añade `sender_suggestions` para los remitentes no vigilados que
parecen financieros, detectados **solo con metadatos** (`WEB-D028`).

### 9.3 Migración `059` — plantillas de movimientos

Requerida por `29_modulo_captura_sin_friccion.md` §4. Guarda las plantillas
de registro rápido del usuario.

### 9.4 Migración `060` — descubrimientos

Requerida por `34_modulo_descubrimientos_e_insights.md` §4.3. Amplía lo que ya
creó la migración `027`:

```sql
-- Cuatro tipos que antes eran imposibles: sus módulos no existían
alter type public.insight_type add value 'budget_risk';
alter type public.insight_type add value 'goal_pace';
alter type public.insight_type add value 'commitment_uncovered';
alter type public.insight_type add value 'merchant_pattern';

create type public.insight_feedback as enum ('util', 'no_util');

alter table public.insight_candidates
  add column if not exists feedback    public.insight_feedback null,
  add column if not exists feedback_at timestamptz null;

create index if not exists insight_candidates_feedback_idx
  on public.insight_candidates (user_id, type, feedback);
```

El feedback vive en el candidato y no en `insight_deliveries` porque el juicio
del usuario es sobre **el hallazgo**, no sobre la vez que se le mostró: si el
mismo hallazgo reaparece en otro periodo, su historial de utilidad debe
acompañarlo.

`alter type ... add value` no puede ejecutarse dentro de una transacción en
PostgreSQL. Esta migración va en su propio archivo, sin envolver, y por eso no
comparte fichero con la creación del enum ni con el `alter table`.

### 9.5 Migración `061` — memoria gobernable

Requerida por `36_modulo_memoria_y_aprendizaje.md` §4.5. Tres tablas que
convierten la memoria de algo que existe en algo que el usuario controla:

**`learned_preferences`** — lo que el sistema observó sobre cómo usa la app.
Distinta de `user_preferences` (migración `002`), que guarda lo que el usuario
**eligió**. La jerarquía entre ambas es `RUL-MEM-14`: lo declarado gana.

**`memory_tombstones`** — lo que impide reaprender lo olvidado:

```sql
id, user_id
scope       memory_scope not null   -- clasificacion | perfil | preferencia
subject_key text not null
reason      text null
created_at  timestamptz not null default now()
lifted_at   timestamptz null
lifted_by   text null

-- único cuando la lápida sigue en pie
create unique index memory_tombstones_active_idx
  on public.memory_tombstones (user_id, scope, subject_key)
  where lifted_at is null;
```

**Por qué una tabla y no una columna.** Sin lápida, olvidar borra una fila y
el sistema reaprende lo mismo mañana desde los mismos movimientos, que siguen
ahí. La columna no serviría porque el registro que habría que marcar es
justamente el que se elimina; la lápida sobrevive a lo que mata.

El índice parcial es el más caliente del módulo: se consulta **en cada intento
de aprendizaje**, antes de crear cualquier candidato.

**`memory_events`** — auditoría de las cuatro acciones obligatorias sobre las
tres clases, con el mismo patrón que `user_profile_events` (`054`) y
`experience_preference_events` (`045`): estado anterior, siguiente, actor e
idempotencia. Unificada porque, con tres tablas de auditoría distintas,
responder "qué ha cambiado en lo que sabes de mí" exigiría tres consultas con
tres formas.

### 9.6 Migración `062` — recordatorios que se resuelven solos

Requerida por `37_modulo_recordatorios_in_app.md` §4.2. Añade a
`in_app_notifications`:

```sql
subject_key   text null          -- 'compromiso:rec_9f2', 'cuota:debt_31c#4'
resolved_at   timestamptz null
snoozed_until timestamptz null

create index in_app_notifications_open_idx
  on public.in_app_notifications (user_id, created_at desc)
  where dismissed_at is null and resolved_at is null;

create index in_app_notifications_subject_idx
  on public.in_app_notifications (user_id, subject_key)
  where resolved_at is null;
```

`subject_key` identifica **la cosa del mundo** a la que se refiere el aviso.
Es lo que permite cerrar el recordatorio cuando esa cosa deja de aplicar
—se paga la cuota, se reconecta el buzón— **en la misma transacción de la
escritura que lo resuelve**, sin que el usuario descarte nada
(`RUL-REC-06`). Mismo patrón que el `fingerprint` de los descubrimientos
(`WEB-D048`).

El primer índice sostiene el badge, que se consulta en cada carga de página.

### 9.7 Migración `063` — búsqueda

Requerida por `38_modulo_busqueda_y_navegacion_rapida.md` §4. Una tabla y dos
índices de texto:

```sql
create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  query text not null,
  filters jsonb not null default '{}'::jsonb,
  created_at, updated_at, deleted_at
);

create index movements_search_idx on public.movements
  using gin (to_tsvector('spanish',
    coalesce(description,'') || ' ' || coalesce(merchant,'')));

create extension if not exists pg_trgm;
create index movements_merchant_trgm_idx
  on public.movements using gin (merchant gin_trgm_ops);
```

Configuración `spanish` porque los movimientos se describen en español y el
lematizador importa: buscar "compras" debe encontrar "compra".

**Índices de texto y no un almacén vectorial**, porque la búsqueda es
determinista por decisión de producto (`WEB-D074`): no calcula similitud, así
que no tiene nada que puntuar ni que ocultar.

### 9.8 Migración `064` — eventos de cuenta

Requerida por `43_auth_y_cuenta.md` §4.3. Auditoría de lo que le pasa a una
cuenta: creación, verificación, cambios de clave y de correo, cierre de
sesiones y solicitud de eliminación.

```sql
create table if not exists public.account_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  kind public.account_event_kind not null,
  ip_hash text null,
  user_agent_hash text null,
  created_at timestamptz not null default now()
);
```

**Se guardan hashes, no la IP ni el agente en claro.** Sirven para que el
usuario reconozca "esto fui yo" comparando, no para identificar el
dispositivo: guardar la IP sería recoger un dato de localización que el
producto no necesita.

`user_id` es `on delete set null` y no `cascade`, a diferencia del resto del
esquema. Es deliberado: el evento `eliminacion_solicitada` **sobrevive al
borrado**, anonimizado, y es el único rastro que queda de una cuenta
eliminada. Existe para poder responder "sí, esa cuenta se eliminó el 26 de
julio" si alguna vez hace falta.

### 9.9 Migración `065` — consentimientos

Requerida por `45_configuracion_privacidad_y_control_de_datos.md` §4.2.

```sql
create table if not exists public.consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind public.consent_kind not null,
  granted boolean not null,
  version text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists consent_events_lookup_idx
  on public.consent_events (user_id, kind, created_at desc);
```

**Es un registro de eventos, no un estado.** El consentimiento vigente es el
último evento de su tipo. Guardarlo como estado mutable perdería la historia,
y la historia es lo que permite responder "¿desde cuándo?" y "¿cuándo lo
quitó?".

`version` guarda qué versión del documento se aceptó, y es lo que hace
verificable la regla de versionar juntas la capacidad y su declaración
(`45` `RUL-CONF-09`).

Reglas de migración heredadas y vigentes: cada archivo es idempotente
(`if not exists`), nunca usa `add constraint if not exists` (no existe en
PostgreSQL; se comprueba contra `pg_constraint`), y activa RLS en toda tabla
con datos de usuario **en la misma migración que la crea**.

## 10. RLS de las tablas nuevas

Toda tabla de §7 nace con RLS activo y política de aislamiento por
`user_id`, sin excepción. El patrón y la política completa de acceso —
incluida la corrección del uso masivo de `service_role` que hoy esquiva RLS
en 48 de 58 rutas — se define en `15_seguridad_autorizacion_y_rls.md`.

Regla específica para las tablas nuevas: **ninguna concede escritura directa
al rol `authenticated` sobre columnas que afecten dinero.** Igual que
`movements`, se escriben a través de funciones del Core.

## 11. Índices requeridos

| Tabla | Índice | Para qué |
|---|---|---|
| `budgets` | `(user_id, period_start desc, category_id)` | Avance del periodo actual en el Inicio |
| `budgets` | `(user_id, status)` | Listado y renovación diaria de los activos |
| `budget_progress_snapshots` | `(budget_id, as_of desc)` | Historial de periodos en el detalle |
| `goals` | `(user_id, status)` | Listado de metas activas |
| `import_batches` | `(user_id, created_at desc)` | Historial de importaciones |
| `import_rows` | `(batch_id, row_number)` | Previsualización y deshacer del lote |
| `import_batches` | `(user_id, file_hash)` | Detección de reimportación |
| `assistant_messages` | `(thread_id, created_at)` | Carga de la conversación |
| `assistant_threads` | `(user_id, updated_at desc)` | Listado de hilos |
| `in_app_notifications` | `(user_id, read_at, created_at desc)` | Contador y bandeja |
| `export_jobs` | `(user_id, requested_at desc)` | Historial y expiración |
| `user_profile_facts` | `(user_id, layer, status)` | Cargar el perfil en cada conversación |
| `user_profile_facts` | `(user_id, expires_at)` donde no es nulo | Caducidad de hechos volátiles |
| `user_profile_candidates` | `(user_id, status, ask_count)` | Decidir si preguntar |
| `user_financial_patterns` | `(user_id, kind)` | Armar el panorama |
| `user_monthly_summaries` | `(user_id, period_month desc)` | Historial comprimido |
| `conversation_summaries` | `(user_id, updated_at desc)` | Capa Hilo del perfil |
| `generated_computations` | `(signature)` único | Acumular uso por cálculo |
| `generated_computations` | `(status, depends_on, user_count desc)` | Detectar candidatos a promoción |

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
- **Conocimiento del mundo**: feriados, puentes, temporadas, rubros
  comerciales, estacionalidad. Lo aporta el modelo (`WEB-D021b`). No existe
  ni existirá una tabla de calendarios ni de clasificación de comercios.
- **El vocabulario de consulta**: las dimensiones y medidas son código, no
  filas. `generated_computations` registra el uso para decidir promociones,
  pero la promoción es un cambio de código.
- **Resultados ni datos dentro del registro de cálculos**: solo la forma del
  cálculo. Registrar qué agrupación se hizo no expone nada; registrar el
  resultado sí.
- **Hechos de perfil observados sin confirmar** en `user_profile_facts`:
  viven como candidatos hasta que el usuario los confirma.
- Transcripciones de conversación en `conversation_summaries`: solo temas y
  conclusiones.

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
- `AC-DATOS-09` — Un hecho de perfil observado no entra en
  `user_profile_facts` sin confirmación del usuario. Evidencia: `TEST`.
- `AC-DATOS-10` — Un hecho contradicho pasa a `en_duda` conservando su
  historia; no se borra ni se sobrescribe en silencio. Evidencia: `TEST`.
- `AC-DATOS-11` — El panorama completo de un usuario se arma por debajo de su
  presupuesto de tokens sin importar los años de uso. Evidencia: `TEST` + `METRIC`.
- `AC-DATOS-12` — `generated_computations` no contiene datos del usuario ni
  resultados, solo la forma del cálculo. Evidencia: `TEST`.
- `AC-DATOS-13` — Un cálculo marcado `conocimiento_mundo` nunca alcanza el
  estado `candidato`. Evidencia: `TEST`.
- `AC-DATOS-14` — `conversation_summaries` no contiene transcripción ni
  detalle de categorías sensibles. Evidencia: `TEST` + revisión.
- `AC-DATOS-15` — Exportar los datos del usuario incluye su perfil completo, y
  eliminar la cuenta lo elimina. Evidencia: `TEST`.
