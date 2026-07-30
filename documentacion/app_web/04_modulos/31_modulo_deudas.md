# 31 — Módulo: Deudas

**ID de módulo:** `MOD-DEUDAS`
**Bloque:** 04 — Módulos
**Estado:** V1
**Fecha:** 26 de julio de 2026
**Docs fuente:** `docs/fase_2_estrategia/alcance_v1/05h_deudas.md` (reutilizado), `docs/fase_4_tecnica/16_modelo_datos.md` §10, `docs/fase_4_tecnica/20_decisiones_tecnicas.md` F4-D034, `docs/fase_6_visual/32_especificacion_hifi.md` (parcial), migración `043`
**Documentos que dependen de este:** `24` (cajas), `26` (movimientos), `30` (pagos que vienen), `33` (proyecciones), `39` (home)

---

## 1. Tesis y qué NO es

Las deudas son una entidad financiera propia, no una categoría de gasto.
Existen aunque el usuario no registre nada más, y son de las pocas cosas que
la gente **realmente necesita** tener ordenadas: le deben, debe, hay cuotas y
hay fechas.

El principio que gobierna el tono:

> Manzana ayuda a recordar, entender y ordenar deudas. **No cobra, no
> contacta a terceros y no juzga.**

**Qué NO es:**

- No es una categoría. Un `pago_deuda` no es un gasto genérico: reduce un
  saldo que se sigue aparte.
- No es una herramienta de cobranza. Nunca contacta a nadie, nunca genera
  mensajes para terceros, nunca usa lenguaje de reclamo.
- No es una agenda de contactos. Las personas relacionadas son ligeras y
  privadas: nombre, alias y relación. **Sin teléfono, sin correo, sin cuenta
  bancaria.**
- No da consejo sobre qué deuda pagar primero. Puede mostrarte el panorama;
  decidir es tuyo (`22` §8).

## 2. Alcance

| Nivel | Funcionalidad |
|---|---|
| **IN V1-web** | Deuda informal, deuda a favor, préstamo bancario, **tarjeta de crédito como deuda simple**, cuota fija, préstamo dado y recibido. Creación atómica (RPC `commit_debt_creation`). Pagos parciales y totales con conciliación determinista de cuotas. Devoluciones. Interés y mora como notas descriptivas. Cierre pagado con saldo cero o condonación explícita. Reapertura solo de condonadas. Reprogramación conservadora de fechas. Personas relacionadas ligeras. Progreso y calendario de vencimientos. Lectura de cajas vinculadas y unión con Pagos que vienen. |
| **V1.1** | Ajuste monetario por interés/mora y renegociación de principal/calendario (`WEB-D205`). Tabla de amortización con intereses calculados. Simulación de pago anticipado. **Ciclo de facturación de tarjeta de crédito.** Deudas compartidas. |
| **FUERA** | Contactar a terceros por cualquier medio. Cobranza. Reporte a centrales de riesgo. Recomendación de refinanciamiento o de orden de pago. Cálculo de intereses compuestos con fórmula bancaria. |

## 3. Vocabulario

| Interno | Visible |
|---|---|
| `Debt` con `direction: i_owe` | Deuda / Lo que debes |
| `Debt` con `direction: they_owe_me` | Deuda a favor / Te deben |
| `DebtInstallment` | Cuota |
| `RelatedPerson` | Persona — se muestra su nombre, nunca "entidad relacionada" |
| `principal_amount` | Monto original |
| `current_balance` | Te queda por pagar / Te queda por cobrar |
| `debt_payment_allocations` | No visible |
| `status: overdue` | Según `RUL-REC-10`: pendiente o vencido |

Regla de tono heredada: se dice *"Le debes S/150 a Luis"*, nunca *"Estás
endeudado"* ni *"Deberías pagarle a Luis"*.

## 4. Entidades y datos

### 4.1 `related_persons`

```sql
id                  uuid pk
user_id             uuid not null
display_name        text not null
normalized_name     text not null
kind                text not null default 'person'   -- person | entity
relationship_label  text null                        -- hermano, amiga, casero…
created_at, updated_at, deleted_at, metadata
```

**Lo que esta tabla deliberadamente no tiene:** teléfono, correo, dirección,
cuenta bancaria, documento de identidad. Son datos de un tercero que no ha
consentido nada, y el producto no los necesita para su función
(`45_configuracion_privacidad_y_control_de_datos.md`).

Único parcial `(user_id, normalized_name)` entre activas.

### 4.2 `debts`

```sql
id                  uuid pk
user_id             uuid not null
direction           debt_direction not null   -- i_owe | they_owe_me
kind                debt_kind not null        -- personal | bank_loan | credit_card | installment_purchase | service_or_bill | other
status              debt_status not null      -- draft | active | due_soon | overdue | paid | cancelled | archived
related_person_id   uuid null references related_persons(id)
name                text not null
principal_amount    numeric(14,2) not null
current_balance     numeric(14,2) not null
currency            text not null default 'PEN'
opened_at           date not null
due_date            date null
next_payment_date   date null
installment_count   int null
installment_amount  numeric(14,2) null
interest_notes      text null
last_payment_at     timestamptz null
idempotency_key     text null
created_at, updated_at, deleted_at, metadata
```

Restricciones:

- **`current_balance >= 0` siempre.** Una deuda no puede quedar negativa.
- **Un pago mayor al saldo se rechaza** (`ERR-DEUDAS-04`).
- Cerrar con saldo pendiente exige confirmación explícita o marcarla como
  condonada.
- Único parcial `(user_id, idempotency_key)` donde no es nulo.

`interest_notes` es texto libre descriptivo, no un cálculo. `W-11` no
aumenta saldos por interés/mora ni publica una renegociación monetaria hasta
que exista un contrato de ajuste especializado (`WEB-D205`).

### 4.3 `debt_installments`

```sql
id               uuid pk
user_id          uuid not null
debt_id          uuid not null references debts(id)
number           int not null
due_date         date not null
expected_amount  numeric(14,2) not null
paid_amount      numeric(14,2) not null default 0
status           installment_status not null
movement_id      uuid null references movements(id)
created_at, updated_at, metadata
```

Ciclo de vencimiento, ya implementado y vigente:

| Estado | Cuándo |
|---|---|
| `pending` | Falta más de 3 días para vencer |
| `due_soon` | Desde 3 días antes, incluido el día de vencimiento |
| `overdue` | `due_date` anterior a la fecha local del usuario |
| `paid`, `skipped` | **Terminales.** Nunca se reabren automáticamente |

`rescheduled` queda reservado para una futura sustitución de calendario. En
V1, reprogramar una cuota abierta cambia su fecha en la misma fila, guarda
el historial anterior y vuelve a `pending` mediante el RPC atómico de
`WEB-D211`.

El estado de la deuda padre se deriva: `overdue` si alguna cuota abierta está
vencida; si no, `due_soon` si alguna vence pronto; si no, `active`.

El refresco lo hace `refresh_debt_installment_lifecycle`, un RPC exclusivo de
service-role que **solo modifica estados y trazabilidad** — nunca montos,
saldos, movimientos, cuentas ni cajas. Bloquea las filas que evalúa y solo
emite eventos ante transición real, así que repetirlo es idempotente.

### 4.4 `debt_payments` y `debt_payment_allocations`

```sql
debt_payments:
  id, user_id, debt_id, movement_id, amount, currency,
  paid_at, source, created_at, metadata

debt_payment_allocations:
  id, user_id, debt_id, debt_payment_id, debt_installment_id,
  movement_id, allocated_amount, allocation_order, policy,
  created_at, metadata
```

`debt_payment_allocations` es la tabla puente que hace auditable la
conciliación: permite varios abonos sobre una cuota y un pago repartido entre
varias.

### 4.5 Migraciones requeridas

La `043` aporta `idempotency_key` y la función
`commit_debt_creation`, que crea de forma atómica la deuda, su persona
relacionada, sus cuotas, su movimiento asociado, la auditoría, los deltas de
cuentas y cajas, y los eventos de outbox.

`W-11` corrige la `043` para admitir deudas sin persona y comparar el
vencimiento en reintentos; añade la `056` para reversión especializada de
pagos y la `057` para cierre, reapertura, reprogramación y omisión atómicos,
idempotentes y con outbox. Como `043`/`015` ya existían, el esquema se
reaplica completo según `WEB-D163`.

Esa función es lo que hace posible `RUL-PEND-01` para deudas: sin un camino
atómico de alta, un pendiente de deuda no podía ser confirmable.

## 5. Máquina de estados

### 5.1 Deuda

```text
   crear (commit_debt_creation, atómica)
        │
        ▼
   ┌──────────┐  vence pronto  ┌───────────┐  pasa la fecha  ┌──────────┐
   │  activa  │───────────────►│ vence ya  │────────────────►│ vencida  │
   └────┬─────┘◄───────────────└───────────┘◄────────────────└────┬─────┘
        │            se paga                                      │
        │                                                         │
        ├──── saldo llega a 0 ──────────────────────────────────►┌──────────┐
        │                                                        │ pagada   │
        ├──── el usuario condona saldo (confirmación) ──────────►└──────────┘
        │
        └──── se condona ──────────────────────────────────────►┌───────────┐
                                                                 │ condonada │
                                                                 └───────────┘
```

La base persiste `paid` y `cancelled`; la interfaz muestra “pagada” y
“condonada”. Una condonación significa que el saldo se perdonó, no que se
pagó. Solo esa transición puede reabrirse restaurando el saldo auditable
(`WEB-D204`).

### 5.2 Cuota

```text
   pendiente ──► vence pronto ──► vencida
        │              │              │
        └──────────────┴──────────────┴──► pagada       (terminal)
                                       ──► saltada      (terminal)
```

Los dos estados terminales **nunca se reabren automáticamente**. En V1 una
reprogramación conservadora mantiene la misma cuota abierta y registra cada
fecha anterior en su historial (`WEB-D211`).

## 6. Reglas de negocio

**`RUL-DEUDAS-01` — Una deuda no es un gasto**

Un `pago_deuda` reduce el saldo de la deuda y sale de la cuenta, pero **no se
cuenta como gasto de consumo** en reportes por categoría. Se clasifica
automáticamente en la categoría `deudas` para que aparezca en el desglose,
pero su significado lo da este módulo.

**`RUL-DEUDAS-02` — Creación atómica**

Una deuda con cuotas y movimiento asociado se crea en **una sola
transacción** vía `commit_debt_creation`. O se crea todo, o no se crea nada.

Sin esto no se puede prometer que un pendiente de deuda sea confirmable.

**`RUL-DEUDAS-03` — Conciliación determinista de pagos**

Política V1: `oldest_open_due_date_first_v1`. Decisión heredada F4-D034.

```text
1. El pago se aplica primero a la cuota abierta más antigua
2. Si la cubre, el excedente pasa a la siguiente cuota abierta
3. Y así hasta agotar el pago o las cuotas
4. Un abono parcial aumenta `paid_amount` de esa cuota sin cerrarla
5. Todo queda registrado en `debt_payment_allocations`
```

Ejemplo completo:

```text
Deuda de S/1.200,00 en 4 cuotas de S/300,00.
Cuota 1: vence 5 jul, pagada S/100,00 (abono parcial, sigue abierta)
Cuota 2: vence 5 ago, sin pagar
El usuario paga S/500,00 el 6 de agosto.

Aplicación:
  → S/200,00 a la cuota 1 (completa los S/300,00) → pagada
  → S/300,00 a la cuota 2 → pagada
  → saldo de la deuda: 1.200,00 − 100,00 − 500,00 = S/600,00
  → quedan las cuotas 3 y 4
```

Todo eso ocurre en **una sola transacción del Core**: movimiento, saldos,
deuda, pago, asignaciones, cuotas y outbox.

**`RUL-DEUDAS-04` — No se permite sobrepago**

Un pago mayor al saldo pendiente se rechaza en V1. Se ofrecen dos salidas:
pagar exactamente el saldo, o registrar la diferencia como un movimiento
aparte.

Razón: aceptar un sobrepago exigiría modelar saldo a favor, que abre un
subsistema completo por un caso poco frecuente.

**`RUL-DEUDAS-05` — El saldo nunca queda negativo**

Consecuencia de la anterior, garantizada por restricción de base.

**`RUL-DEUDAS-06` — Pago sin cuenta es válido**

Se puede registrar un pago de deuda sin decir de qué cuenta salió. La deuda
se actualiza y **los saldos por cuenta no cambian** (`RUL-CUENTAS-12`). Es
frecuente en deudas informales pagadas en efectivo.

**`RUL-DEUDAS-07` — Deuda sin calendario**

Una deuda puede no tener cuotas. Los pagos siguen siendo válidos, reducen el
saldo, y **no crean asignaciones** porque no hay cuotas a las que asignar.

**`RUL-DEUDAS-08` — Calendario inconsistente**

Si la deuda llega a saldo cero antes de agotar sus cuotas, las cuotas
abiertas restantes se marcan `skipped` con razón auditable. Ocurre cuando el
usuario paga de más en abonos o cuando el calendario se creó mal.

**`RUL-DEUDAS-09` — Tarjeta de crédito como deuda simple**

Decisión `WEB-D029`. Una tarjeta se modela como deuda con saldo, cuotas
opcionales y pagos que la reducen. **Sin ciclo de facturación.**

Lo que esto significa para el usuario, y que la interfaz debe decir con
honestidad:

| Sí puede | No puede |
|---|---|
| Saber cuánto debe en total | Saber cuánto le facturarán este ciclo |
| Registrar sus pagos | Distinguir consumo del ciclo actual del ya facturado |
| Seguir cuotas de compras en partes | Ver pago mínimo vs. total |

Además, regla heredada y vigente: **una tarjeta de crédito no es una cuenta
de dinero disponible.** No suma al dinero total ni al dinero libre.

**`RUL-DEUDAS-10` — Deuda a favor**

`direction: they_owe_me` invierte el sentido: un `prestamo_dado` la crea, y
una `devolucion_recibida` la reduce. El dinero prestado **salió** de la
cuenta, así que reduce el saldo — pero no es un gasto de consumo.

Nunca genera lenguaje de cobranza. Se dice *"Te deben S/200"*, nunca
*"Cóbrale a tu hermano"*.

**`RUL-DEUDAS-11` — Interés y mora**

En V1 no se calculan con fórmula. `interest_notes` guarda únicamente el texto
de las condiciones para que el usuario lo recuerde. Aumentar el saldo por
interés o mora queda fuera de V1 hasta definir un ajuste especializado,
auditable y reversible (`WEB-D205`).

Es una limitación deliberada: calcular intereses mal es peor que no
calcularlos.

**`RUL-DEUDAS-12` — Renegociación**

La renegociación que cambia monto, principal o reconstruye cuotas queda
fuera de V1 por `WEB-D205`: el corpus no define su algoritmo. `W-11` sí
permite reprogramar la fecha de una cuota abierta sin tocar importes ni
asignaciones, mediante `commit_debt_operation`; conserva un
`reschedule_history` y outbox (`WEB-D211`).

**`RUL-DEUDAS-13` — Cierre con saldo**

Cerrar una deuda con saldo pendiente exige elegir explícitamente entre:

| Opción | Qué significa |
|---|---|
| **Ya está pagada** | Solo cuando el saldo ya es cero. Si faltan pagos, primero se registran o se crea un ajuste explícito |
| **Me la perdonaron** | Persiste `cancelled`, visible como “condonada”. El saldo no se pagó y no se cuenta como pago |

Nunca se cierra con una etiqueta que oculte saldo: `paid` exige cero y
`cancelled` conserva `forgiven_balance` antes de llevar el saldo a cero
(`WEB-D204`).

**`RUL-DEUDAS-14` — Vinculación con cajas y pagos que vienen**

- Una caja de tipo compromiso puede respaldar una deuda: su saldo cubre las
  cuotas próximas y evita el doble descuento (`RUL-CUENTAS-04`).
- Una cuota puede aparecer en Pagos que vienen, y **cuenta una sola vez** en
  los compromisos (`RUL-REC-09`).
- Marcar pagada la cuota desde Pagos que vienen usa el pago especializado de
  deuda. Una regla recurrente ligada a esa deuda permanece bloqueada hasta
  que exista el commit compuesto único de `WEB-D208`; nunca se encadenan dos
  motores.

**`RUL-DEUDAS-15` — Personas privadas y ligeras**

Solo nombre, alias y relación. Una persona relacionada **nunca sale del
producto**: no se comparte, no se exporta a terceros, no genera
notificaciones hacia ella.

## 7. Validaciones

| Campo | Regla |
|---|---|
| `name` | Obligatorio. 1–60 caracteres |
| `direction`, `kind` | Obligatorios |
| `principal_amount` | Mayor que 0 |
| `current_balance` | Entre 0 y `principal_amount` al crear |
| `opened_at` | No futura |
| `due_date` | Posterior a `opened_at` si se indica |
| `installment_count` | Entre 1 y 360 si se indica |
| `installment_amount` | Mayor que 0. Si hay `installment_count`, su producto debe aproximarse a `principal_amount` con tolerancia del 1% |
| Pago | Mayor que 0 y **menor o igual al saldo**. Fecha no futura |
| Persona | Nombre 1–60 caracteres, único por usuario tras normalizar |

## 8. Superficies

**Referencia visual:** `docs/fase_6_visual/32_especificacion_hifi.md` §9
(`DEBTS`), §21.5 (`DEBT_DETAIL`) y §21.11 (`DEBT_CREATE` / `DEBT_EDIT`), con
sus frames en `stitch_manzana_v1/`; el inventario numerado está en
`docs/fase_6_visual/33_stitch_handoff_v1.md` §6.13. La cobertura es parcial:
el listado, el detalle y el alta tienen frame; las operaciones sobre una
deuda ya creada, no.

| Pantalla | Frame previo |
|---|---|
| `SCR-DEUDAS-01` | Sí — `DEBTS_FUNCTIONAL` (85), `DEBTS_EMPTY` (86), `DEBTS_LOADING` (87), `DEBTS_ERROR` (88), `DEBTS_DISCREET` (89) |
| `SCR-DEUDAS-02` | Sí — `DEBT_DETAIL_ACTIVE` (90), `_PAID` (91), `_EMPTY_HISTORY` (92), `_LOADING` (93), `_ERROR` (94), `_DISCREET` (95) |
| `SCR-DEUDAS-03` | Sí — `DEBT_CREATE` (96) y `DEBT_EDIT` (97) |
| `SCR-DEUDAS-04` | **No existe frame propio.** El Hi-Fi solo define el CTA "Registrar pago" en la card (§9.2) y en el detalle (§21.5); la previsualización de la aplicación del pago no está dibujada en ningún frame. |
| `SCR-DEUDAS-05` | **No existe frame previo.** §21.5 deja el botón "Cerrar o eliminar", pero el diálogo con las dos opciones de `RUL-DEUDAS-13` no está en el inventario; `MODAL_RISK` solo tiene frames para borrar movimiento (140) y ajuste de saldo (141). |
| `SCR-DEUDAS-06` | **Fuera de V1 por `WEB-D205`.** La renegociación monetaria no tiene contrato ejecutable ni frame previo. |
| `SCR-DEUDAS-07` | **No existe frame previo.** El Hi-Fi trata a la persona como campo de la deuda (§21.5, §21.11), nunca como pantalla de gestión. |

Donde dice que no hay frame, el bloque de abajo es la especificación de
layout, no un boceto de algo ya dibujado; tokens y primitivas salen de
`16_design_system_web.md`. El preview rápido `MODAL_DETAIL_QUICK_DEBT` (144,
§21.8) también pertenece a este módulo aunque §8 no lo declare como pantalla
propia.

### `SCR-DEUDAS-01` — Deudas

**Ruta:** `/deudas`
**Estado en URL:** `estado`, `direccion`, `cursor`

```text
┌──────────────────────────────────────────────────┐
│ Deudas                              [+ Agregar]  │
│ Debes S/2,340.00  ·  Te deben S/200.00           │
├──────────────────────────────────────────────────┤
│ Lo que debes                                     │
│ Cuota laptop        S/1,800 de S/2,400  ▓▓▓░ 25% │
│   Próxima: 5 ago · S/300.00 · 🏦 cubierto        │
│                                                  │
│ Tarjeta BCP           S/540.00 restantes          │
│   Próxima: sin fecha                             │
├──────────────────────────────────────────────────┤
│ Te deben                                         │
│ Hermano               S/200.00                    │
│   Desde el 12 de junio                            │
├──────────────────────────────────────────────────┤
│ Cerradas (3)                                      │
└──────────────────────────────────────────────────┘
```

Detalles: dos bloques separados por dirección; el neto **no se presenta como
cifra principal** porque mezcla dos cosas distintas; el progreso es visual y
textual; "cubierto" indica caja vinculada.

### `SCR-DEUDAS-02` — Detalle de deuda

**Ruta:** `/deudas/[id]`

Muestra: monto original y saldo, progreso, persona o entidad, calendario de
cuotas con su estado, historial de pagos **con sus asignaciones** ("de tus
S/500, S/200 fueron a la cuota 1 y S/300 a la cuota 2"), caja vinculada,
notas de interés, y las acciones.

El historial de asignaciones es lo que hace la conciliación explicable en vez
de mágica.

### `SCR-DEUDAS-03` — Crear deuda

Modal. Campos según §7. Si es a favor, cambia el copy sin cambiar el
formulario. Ofrece crear el calendario de cuotas y previsualiza las fechas
antes de guardar.

### `SCR-DEUDAS-04` — Registrar pago

Modal. Precargado con el monto de la cuota próxima si la hay. **Muestra cómo
se va a aplicar antes de confirmar:**

```text
Pagas S/500.00
  → S/200.00 completan la cuota 1 (5 jul)
  → S/300.00 pagan la cuota 2 (5 ago)
Te quedará S/600.00 por pagar.
```

Esa previsualización es lo que hace que la política de conciliación sea
comprensible sin explicarla.

### `SCR-DEUDAS-05` — Cerrar deuda

`AlertDialog`. Si hay saldo, exige elegir entre las dos opciones de
`RUL-DEUDAS-13`, explicando qué significa cada una.

### `SCR-DEUDAS-06` — Renegociar

Fuera de V1 por `WEB-D205`. No se muestra una acción ni un modal que prometa
regenerar montos o calendario. La reprogramación de una fecha vive en la
cuota y sigue `WEB-D211`.

### `SCR-DEUDAS-07` — Personas

**Ruta:** `/configuracion/personas`

Lista con nombre, relación y deudas asociadas. Al crear se explica qué se
guarda y qué no: *"Solo su nombre y cómo se relaciona contigo. No guardo
teléfono ni datos de contacto."*

## 9. Acciones

| ID | Acción | ¿Confirma? | Deshacer | Evento |
|---|---|---|---|---|
| `ACT-DEUDAS-01` | Crear deuda | Sí, con previsualización de cuotas | Eliminando | `deuda.creada` |
| `ACT-DEUDAS-02` | Editar datos básicos | No | Editando | `deuda.editada` |
| `ACT-DEUDAS-03` | Registrar pago | **Sí, con la aplicación visible** | Eliminando el movimiento | `deuda.pago_registrado` |
| `ACT-DEUDAS-04` | Registrar devolución recibida | Sí | Eliminando | `deuda.devolucion_registrada` |
| `ACT-DEUDAS-05` | Registrar interés o mora monetario | **No disponible en V1 (`WEB-D205`)** | — | — |
| `ACT-DEUDAS-06` | Renegociar monto/calendario | **No disponible en V1 (`WEB-D205`)** | — | — |
| `ACT-DEUDAS-07` | Cerrar deuda | **Sí, riesgo con dos opciones** | Reabriendo | `deuda.cerrada` |
| `ACT-DEUDAS-08` | Reabrir deuda cerrada | Sí | Cerrando | `deuda.reabierta` |
| `ACT-DEUDAS-09` | Vincular caja | No | Desvinculando | `deuda.vinculada_caja` |
| `ACT-DEUDAS-10` | Reprogramar una cuota | Sí | Reprogramando | `cuota.reprogramada` |
| `ACT-DEUDAS-11` | Saltar una cuota | Sí | Desmarcando | `cuota.saltada` |
| `ACT-DEUDAS-12` | Crear persona | No | Archivando | `persona.creada` |
| `ACT-DEUDAS-13` | Editar o archivar persona | No | Editando | `persona.editada` |
| `ACT-DEUDAS-14` | Ver cómo se aplicó un pago | No | — | `asignacion.consultada` |

## 10. API

Base `/api/v1/debts`.

| Método y ruta | Notas |
|---|---|
| `GET /debts` | Cursor. Filtros: `direccion`, `estado`. Con saldos y próxima cuota |
| `POST /debts` | **`commit_debt_creation` atómica.** `Idempotency-Key` obligatoria |
| `GET /debts/[id]` | Detalle con cuotas, pagos y asignaciones |
| `PATCH /debts/[id]` | Edita datos básicos. No toca saldos |
| `POST /debts/[id]/payments` | Registra pago con conciliación. `Idempotency-Key` |
| `GET /debts/[id]/payments` | Historial con asignaciones |
| `POST /debts/[id]/close` | Cierra. Body exige `reason: 'paid' \| 'forgiven'` |
| `POST /debts/[id]/reopen` | Reabre |
| `GET /debts/[id]/installments` | Cuotas con su estado |
| `POST /debts/[id]/installments/[iid]/reschedule` · `/skip` | Transiciones de cuota |
| `GET /related-persons` · `POST` · `PATCH` · `DELETE` | Personas |
| `POST /debts/[id]/payments/preview` | **Previsualiza la aplicación sin escribir** |

`close`, `reopen`, `reschedule` y `skip` pasan por
`commit_debt_operation`: bloqueo deuda→cuota, recibo idempotente y outbox en
la misma transacción (`WEB-D211`). `/renegotiate` no se publica.

El último endpoint es el que alimenta `SCR-DEUDAS-04`: devuelve cómo se
repartiría el pago sin ejecutarlo.

## 11. Permisos y RLS

- Cliente autenticado en todas las rutas.
- **Excepción de service-role justificada**:
  `refresh_debt_installment_lifecycle`, el trabajo que refresca estados de
  cuotas sin usuario en la petición. Está acotado por diseño: solo modifica
  estados y trazabilidad.
- RLS por `user_id` en las cinco tablas.
- Toda escritura de dinero pasa por el Core.
- Una deuda o persona de otro usuario devuelve 404.

## 12. Estados de datos

| Estado | Qué se muestra |
|---|---|
| **Vacío** | "No tienes deudas registradas. Si le debes a alguien, te deben, o tienes una cuota, puedes anotarlo aquí." Sin presión |
| **Solo a favor** | Se muestra el bloque "Te deben"; el otro no aparece vacío |
| **Con cuotas próximas** | Destacadas arriba con su fecha |
| **Con vencidas** | Aviso según `RUL-REC-10`: pendiente o vencido según los días |
| **Todo cerrado** | Sección de cerradas colapsada, con el histórico accesible |
| **Cargando** | Esqueleto de 2 tarjetas |
| **Error** | Mensaje en español con reintento |
| **Modo discreto** | Montos ocultos y **nombres de personas ocultos**: "Tienes un compromiso próximo" |

La última fila es especialmente importante en este módulo: los nombres de
personas son de los datos más sensibles del producto.

## 13. Errores

| ID | Causa | Mensaje visible | Salida |
|---|---|---|---|
| `ERR-DEUDAS-01` | Deuda no encontrada | "No encontré esa deuda." | Volver al listado |
| `ERR-DEUDAS-02` | Deuda cerrada | "Esa deuda ya está cerrada. ¿La reabrimos?" | Reabrir |
| `ERR-DEUDAS-03` | Pago de cero o negativo | "El pago tiene que ser mayor que cero." | Corregir |
| `ERR-DEUDAS-04` | **Sobrepago** | "Solo te quedan S/600.00 por pagar. ¿Pagas eso, o registro la diferencia aparte?" | Ajustar / Registrar aparte |
| `ERR-DEUDAS-05` | Cuota ya pagada | "Esa cuota ya está pagada." | Ver el pago |
| `ERR-DEUDAS-06` | Cerrar con saldo sin elegir motivo | "¿Ya la pagaste, o te la perdonaron?" | Elegir |
| `ERR-DEUDAS-07` | Cuotas incoherentes con el monto | "4 cuotas de S/300 suman S/1,200, no S/1,000." | Ajustar |
| `ERR-DEUDAS-08` | Persona duplicada | "Ya tienes a alguien con ese nombre." | Usar la existente |
| `ERR-DEUDAS-09` | Cuenta archivada al pagar | "Esa cuenta está archivada." | Elegir otra |
| `ERR-DEUDAS-10` | Renegociar una deuda cerrada | "No puedo renegociar una deuda cerrada." | Reabrir primero |
| `ERR-DEUDAS-11` | Fecha de apertura futura | "Esa fecha todavía no llega." | Corregir |

## 14. Integración con el motor IA

### 14.1 Consultas que expone

| Dimensión | Notas |
|---|---|
| `direccion_deuda` | debes / te deben |
| `tipo_deuda` | informal, banco, tarjeta, cuotas, préstamo |
| `estado_deuda` | activa, vence pronto, vencida, cerrada, condonada |
| `persona` | |
| `tiene_calendario` | sí/no |
| `deuda_cubierta_por_caja` | sí/no |
| `dias_hasta_proxima_cuota` | |
| `progreso_pago` | Proporción pagada |
| `estado_cuota` | Los seis estados |

| Medida | Notas |
|---|---|
| `saldo_total_debido` | |
| `saldo_total_a_favor` | **Nunca se restan entre sí sin decirlo** |
| `pagado_en_periodo` | |
| `proximo_vencimiento` | |

La advertencia de la segunda medida importa: presentar un "neto" de deudas
mezcla lo que debes con lo que te deben, y son compromisos de naturaleza muy
distinta.

### 14.2 Comandos que acepta

| Comando | Confirmación |
|---|---|
| `crear_deuda` | Tarjeta con previsualización de cuotas |
| `registrar_pago_deuda` | **Tarjeta con la aplicación visible** |
| `registrar_devolucion` | Tarjeta |
| `registrar_interes` | **Riesgo** |
| `renegociar_deuda` | **No disponible en V1** (`WEB-D205`) |
| `cerrar_deuda` | **Riesgo**, con las dos opciones |
| `reabrir_deuda` | Tarjeta |
| `vincular_caja_a_deuda` | Tarjeta |
| `reprogramar_cuota` / `saltar_cuota` | Tarjeta |
| `crear_persona` | Tarjeta |

### 14.3 Qué se puede pedir en lenguaje natural

```text
"le debo 200 a mi hermano"                  → crear_deuda (informal, a deber)
"mi hermano me prestó 500 en 5 cuotas"      → crear_deuda con calendario
"pagué 300 de la laptop"                    → registrar_pago_deuda
"¿cuánto me falta de la laptop?"            → saldo y progreso con evidencia
"¿a quién le debo?"                         → consulta agrupada por persona
"me devolvieron los 200"                    → registrar_devolucion
"ya está pagada la de Luis"                 → comprobar saldo; registrar lo faltante o condonar explícitamente
"¿cómo se aplicaron mis 500?"               → asignaciones del pago
```

La segunda es el caso que motivó la migración `043`: crear una deuda con
persona, calendario y movimiento en una sola operación atómica, para que se
pueda ofrecer como confirmable sin mentir.

### 14.4 Lo que el motor NO puede hacer aquí

- **Recomendar qué deuda pagar primero.** Es consejo financiero, prohibido
  por `22` §8. Puede mostrar el panorama y las fechas.
- Cerrar una deuda sin resolver si fue pagada o condonada.
- Registrar un sobrepago.
- Aplicar interés, mora o renegociar montos sin el comando especializado
  diferido por `WEB-D205`.
- Generar cualquier mensaje dirigido a un tercero.

## 15. Memoria y aprendizaje

| Qué aprende | De dónde | Cómo se corrige |
|---|---|---|
| Personas con las que tiene deudas recurrentes | Deudas creadas | Archivando la persona |
| Cómo llama a sus deudas | Nombres puestos | Renombrando |
| Su ritmo de pago | Historial de pagos | — |
| Si suele pagar antes o después del vencimiento | Fechas de pago vs. vencimiento | — |

El último aporta a las proyecciones (módulo 33): alguien que siempre paga
tres días tarde tiene un perfil de compromiso distinto al que paga puntual.

**Límite de privacidad:** no se infieren conclusiones sobre las personas
relacionadas, solo sobre el comportamiento del propio usuario.

## 16. Eventos y telemetría

Eventos activos en V1: `deuda.creada`, `.editada`, `.pago_registrado`,
`.devolucion_registrada`, `.cerrada`, `.reabierta`, `.vinculada_caja`,
`cuota.pagada`, `.reprogramada`,
`.saltada`, `.vencida`, `persona.creada`, `asignacion.consultada`.
`.interes_registrado` y `.renegociada` quedan reservados, no se emiten
(`WEB-D205`).

La telemetría, logs y métricas **nunca llevan montos ni nombres de
personas**. Sí dirección, tipo, estado y `trace_id`. El outbox transaccional
de dominio puede conservar los datos financieros imprescindibles para
auditoría/replay y no se trata como analítica (`WEB-D210`).

Métricas: usuarios con deudas registradas, pagos por semana en usuarios con
deudas, proporción de deudas con calendario, tasa de pago puntual,
proporción cubierta por caja, uso de la consulta de asignaciones.

## 17. Rendimiento

- Índices: `debts (user_id, status, direction)`,
  `debt_installments (debt_id, due_date, status)`,
  `debt_installments (user_id, status, due_date)` para el refresco,
  `debt_payments (debt_id, paid_at desc)`,
  `debt_payment_allocations (debt_payment_id)`.
- El refresco de estados corre como trabajo diario con bloqueo de filas, no
  en cada lectura.
- El detalle carga cuotas y pagos completos en `W-11` para no ocultar filas:
  la paginación del historial largo queda pendiente de un contrato de cursor
  y una superficie que lo consuma (`WEB-D217`). No se aplica un límite
  silencioso.
- La conciliación ocurre dentro de la transacción del Core, sin viajes extra.
- Presupuesto: listado bajo 400 ms; detalle bajo 350 ms.

## 18. Accesibilidad específica

- El progreso se anuncia con valor y contexto: "Cuota laptop, has pagado 600
  de 2.400 soles, 25 por ciento".
- El estado de una cuota se comunica con texto, no solo con color.
- La previsualización de aplicación del pago se anuncia en región activa
  antes de que el usuario confirme.
- Los nombres de personas se ocultan en modo discreto también para lectores
  de pantalla, no solo visualmente.
- El calendario de cuotas tiene tabla equivalente accesible.

## 19. Casos borde

1. **Pago exactamente igual al saldo.** Cierra la deuda automáticamente con
   estado persistido `paid`, visible como “pagada”.
2. **Pago que cubre varias cuotas y sobra dentro del saldo.** Se aplica en
   orden hasta agotar (`RUL-DEUDAS-03`).
3. **Saldo cero con cuotas abiertas.** Las restantes se marcan `skipped` con
   razón auditable (`RUL-DEUDAS-08`).
4. **Deuda sin calendario que recibe pagos.** Válido; sin asignaciones.
5. **Eliminar el movimiento de un pago de deuda.** El pago se revierte, las
   asignaciones se deshacen, las cuotas vuelven a su estado anterior y el
   saldo se restaura. Se avisa el efecto.
6. **Intentar renegociar monto con pagos ya aplicados.** Se rechaza en V1;
   no existe algoritmo seguro hasta el corte definido por `WEB-D205`.
7. **Persona con deudas en ambas direcciones.** Válido: le debes a tu hermano
   y él te debe. **No se compensan automáticamente.**
8. **Cuota que vence en fin de semana.** No se mueve. La regla de
   `due_soon`/`overdue` opera sobre la fecha tal cual.
9. **Tarjeta de crédito sin cuotas.** Válida: saldo que se reduce con pagos,
   sin calendario.
10. **Deuda en moneda distinta de PEN.** El modelo lo soporta; la interfaz de
    V1 no permite crearla.
11. **Reabrir una deuda condonada.** Permitido, con confirmación: vuelve a
    `activa` con el saldo que tenía.
12. **Archivar una persona con deudas activas.** Se avisa; las deudas
    conservan la referencia y siguen visibles.

## 20. Criterios de aceptación

- `AC-DEUDAS-01` — Una deuda con cuotas y movimiento se crea en una sola
  transacción atómica. Evidencia: `TEST`. Clase: `integracion`. Cierra en
  `W-11`: `src/core/debts/debt-creation-command.test.ts` cubre calendario y
  movimiento opcional, y `tests/rls/w11-debt-creation-core.test.ts` ejecuta
  el commit atómico real con retry/conflicto de idempotencia.
- `AC-DEUDAS-02` — El ejemplo de conciliación de `RUL-DEUDAS-03` produce
  exactamente el reparto descrito y saldo S/600.00. Evidencia: `TEST`. Clase:
  `unidad`. Cierra en `W-11`: `debts.repository.test.ts` y
  `payments/preview/route.test.ts` prueban el reparto S/200 + S/300 y saldo
  S/600, además de la política oldest-first.
- `AC-DEUDAS-03` — Un sobrepago se rechaza ofreciendo las dos salidas.
  Evidencia: `TEST` + `USER`. Clase: `integracion`. Cierra la parte `TEST`
  en `W-11`: la ruta y `DebtsScreen` rechazan el sobrepago antes del RPC y
  ofrecen saldo exacto o movimiento aparte (`payments/route.test.ts`,
  `payments/preview/route.test.ts`, `debts-screen.test.tsx`). `USER` no
  cierra sin sesión de navegador.
- `AC-DEUDAS-04` — `current_balance` nunca queda negativo.
  Evidencia: `TEST`. Clase: `unidad`. Cierra en `W-11`: la prueba de
  migraciones verifica `debts_current_balance_non_negative` y el comando de
  pago rechaza cualquier monto superior al saldo antes del commit.
- `AC-DEUDAS-05` — Cerrar con saldo exige elegir entre pagada y condonada.
  Evidencia: `TEST` + `USER`. Clase: `integracion`. Cierra la parte `TEST`
  en `W-11`: `w11-debt-operations-core.test.ts` prueba condonación/reapertura
  atómicas e idempotentes, y la ruta/UI bloquean `paid` con saldo. `USER` no
  cierra sin navegador.
- `AC-DEUDAS-06` — El usuario ve cómo se aplicará el pago **antes** de
  confirmar. Evidencia: `TEST` + `USER`. Clase: `unidad`. Cierra la parte
  `TEST` en `W-11`: el preview de ruta y `DebtsScreen` muestran asignaciones,
  saldo proyectado y cuota antes de habilitar el registro. `USER` no cierra
  sin sesión de navegador.
- `AC-DEUDAS-07` — Una cuota cubierta por caja no descuenta dos veces del
  dinero libre. Evidencia: `TEST`. Clase: `unidad`. No cierra completo:
  `money-layers.test.ts` prueba cobertura completa/parcial y consumo único de
  una caja genérica, pero el pago compuesto caja+deuda está bloqueado por
  `WEB-D208` hasta tener un único RPC integrado; la UI declara que no consume
  la caja automáticamente.
- `AC-DEUDAS-08` — Una cuota que también aparece en Pagos que vienen cuenta
  una sola vez en los compromisos. Evidencia: `TEST`. Clase: `unidad`. Cierra
  en `W-11`: `upcoming-commitments.test.ts` y `GET /api/v1/upcoming` prueban
  la unión deuda/recurrente sin duplicar la cuota.
- `AC-DEUDAS-09` — Eliminar el movimiento de un pago revierte pago,
  asignaciones, cuotas y saldo. Evidencia: `TEST`. Clase: `integracion`.
  Cierra en `W-11`: `tests/rls/w11-specialized-payment-reversal.test.ts` y
  `movements/[id]/route.test.ts` verifican movimiento, cuenta, pago,
  asignaciones, cuotas, deuda, auditoría/outbox e idempotencia en Postgres.
- `AC-DEUDAS-10` — Las personas relacionadas no admiten teléfono, correo ni
  datos bancarios en ningún campo. Evidencia: `TEST`. No cierra: el esquema y
  la migración solo declaran nombre/alias/relación, pero falta una prueba
  negativa dedicada que intente introducir teléfono, correo o datos bancarios
  y compruebe el rechazo en la superficie de creación.
- `AC-DEUDAS-11` — El motor no recomienda qué deuda pagar primero.
  Evidencia: `TEST` + `USER`. No cierra: el código solo ordena por próximo
  vencimiento (`sortDebtsByNextPaymentDate`) y no hay prueba dedicada que
  demuestre la ausencia de una recomendación; tampoco hay validación `USER`.
- `AC-DEUDAS-12` — No se genera ningún mensaje dirigido a un tercero.
  Evidencia: `TEST`. No cierra: no existe una prueba de trazabilidad que
  recorra eventos/outbox y demuestre que ninguna ruta emite un mensaje a una
  persona relacionada; la prohibición está documentada, pero no verificada
  como criterio ejecutable.
- `AC-DEUDAS-13` — En modo discreto los nombres de personas se ocultan
  también para lectores de pantalla. Evidencia: `TEST`. Clase: `unidad`.
  Cierra en `W-11`: `debts-screen.test.tsx` comprueba que nombre y persona
  desaparecen también del árbol accesible bajo modo discreto.
- `AC-DEUDAS-14` — Una tarjeta de crédito no suma al dinero total ni al
  dinero libre. Evidencia: `TEST`. No cierra: la deuda `credit_card` no se
  modela como cuenta disponible y la UI lo explica, pero no hay una prueba
  que combine una tarjeta como deuda con `/money` y verifique explícitamente
  las dos capas.
- `AC-DEUDAS-15` — Los estados terminales de cuota no se reabren
  automáticamente. Evidencia: `TEST`. Clase: `integracion`. Cierra en
  `W-11`: `w11-debt-operations-core.test.ts` prueba `skipped` como terminal,
  y las pruebas de reversión/lifecycle cubren que `paid`/`cancelled` no se
  reabren por lectura o retry.
- `AC-DEUDAS-16` — El saldo debido y el saldo a favor no se presentan restados
  sin decirlo. Evidencia: `TEST` + `USER`. Clase: `unidad`. Cierra la parte
  `TEST` en `debts-view-model.test.ts` y `debts-screen.test.tsx`, que separan
  `Debes`/`Me deben` y también las capas PEN/USD. `USER` no cierra sin
  navegador.
- `AC-DEUDAS-17` — Ningún evento ni registro contiene nombres de personas ni
  montos. Evidencia: `TEST`. No cierra como estaba redactado: `WEB-D210`
  aclara que el outbox financiero puede conservar importes/moneda para
  auditoría y replay; la prohibición verificable aplica a logs, métricas y
  analítica, pero este corte no tiene una prueba global de higiene de esos
  emisores. Queda pendiente esa prueba, no se afirma que todo registro esté
  libre de montos.

## 21. Fuera de alcance y puente a WhatsApp

Fuera de V1-web: ciclo de facturación de tarjeta (`WEB-D029`), amortización
con intereses calculados, simulación de pago anticipado, deudas compartidas,
y todo lo relacionado con contactar terceros — que está **prohibido, no
diferido**.

Puente a WhatsApp: `registrar_pago_deuda` es uno de los comandos que mejor
funcionan en conversación (*"pagué 300 de la laptop"*), y ya está implementado
de forma segura en el canal actual. La previsualización de aplicación se
presentará como texto en vez de tabla. Los recordatorios de cuotas próximas
serán responsabilidad del módulo 37 con su política de fatiga.

## 22. Trazabilidad

**Documentos de `docs/` consumidos:**
`docs/fase_2_estrategia/alcance_v1/05h_deudas.md` (tipos, estados, personas
ligeras, operaciones, principio de no cobranza),
`docs/fase_4_tecnica/16_modelo_datos.md` §10 (cinco tablas, ciclo de
vencimiento, reglas de asignación),
`docs/fase_4_tecnica/20_decisiones_tecnicas.md` F4-D034 (política de
conciliación), `docs/fase_6_visual/32_especificacion_hifi.md` §9, §21.5 y
§21.11 (listado, detalle y formulario; no cubre registrar pago, cerrar,
renegociar ni personas).

**Contradicciones que cierra:** ninguna directamente; la migración `043`, que
este módulo consume, es la que cerró el hallazgo §4.7 de la auditoría
(pendientes de deuda no confirmables).

**Diferencias frente a los documentos fuente:** se fija la tarjeta de crédito
como deuda simple sin ciclo (`WEB-D029`) y se documenta explícitamente qué
puede y qué no puede hacer el usuario con esa decisión. Se añade el endpoint
de previsualización de aplicación del pago, que ninguna fuente contemplaba y
que es lo que hace comprensible la política de conciliación. Se prohíbe
explícitamente que el motor recomiende orden de pago, aplicando el límite de
consejo financiero de `22` §8.
