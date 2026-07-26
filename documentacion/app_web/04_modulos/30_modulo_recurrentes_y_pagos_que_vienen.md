# 30 — Módulo: Pagos que vienen

**ID de módulo:** `MOD-RECURRENTES`
**Bloque:** 04 — Módulos
**Estado:** V1
**Fecha:** 26 de julio de 2026
**Docs fuente:** `docs/fase_2_estrategia/alcance_v1/05i_recurrentes.md` (reutilizado), `docs/fase_4_tecnica/16_modelo_datos.md` §11, `09_modelo_mental_dinero.md`
**Documentos que dependen de este:** `24` (cuentas y cajas), `31` (deudas), `33` (proyecciones), `37` (recordatorios), `39` (home)

---

## 1. Tesis y qué NO es

La sensación que este módulo debe producir:

```text
Ya sé qué viene. No me va a agarrar de sorpresa.
```

Y la que debe evitar:

```text
Tengo otra app recordándome que debo plata.
```

Un pago que viene es **una expectativa financiera, no un hecho**. No es
dinero que salió: es dinero que va a salir. Esa distinción gobierna todo el
módulo — un recurrente esperado **no toca ningún saldo** hasta que el usuario
confirma que pagó.

Su valor real no es hacer una lista: es **descontar del dinero libre lo que
ya está comprometido**, para que la cifra principal del producto sea honesta.

**Qué NO es:**

- No es un calendario de tareas.
- No paga nada. No se conecta a ningún servicio ni ejecuta transferencias.
- No activa nada solo: detectar un patrón **no es activarlo**.
- No es una deuda. Una suscripción de Netflix no es dinero que debes; es
  dinero que vas a gastar. Las deudas viven en el módulo 31.

## 2. Alcance

| Nivel | Funcionalidad |
|---|---|
| **IN V1-web** | Detección automática de pagos que se repiten, **siempre como sugerencia que el usuario confirma**. Creación manual. Estados: sugerido, activo, pausado, cancelado. Ocurrencias con marcado de pago. Calendario de compromisos. Vinculación con deudas y con cajas. Cambios de monto mostrados explícitamente. Saltar un periodo. Efecto sobre el dinero libre **sin doble descuento** si hay caja que lo cubre. Detección de vencidos con lenguaje cuidado. |
| **V1.1** | Predicción de monto para los de importe variable. Negociación de fechas ("muévelo al día 5"). Agrupación de pagos por proveedor. |
| **FUERA** | Pago automático real de servicios. Integración con pasarelas. Recordatorios por WhatsApp (fase 2). Domiciliación bancaria. |

## 3. Vocabulario

Este módulo tiene la brecha de vocabulario más grande del producto: su nombre
técnico y su nombre visible no se parecen.

| Interno | Visible | Regla |
|---|---|---|
| `RecurringRule` | **Pago que viene** | Nunca decir "recurrente" al usuario |
| `RecurringOccurrence` | Pago esperado / El de este mes | Nunca "ocurrencia" |
| `RecurringCandidate` | Sugerencia | |
| Conjunto con deudas y cuotas | **Compromisos** | Cuando se agrupan en una vista |
| `status: overdue` | Pendiente **o** vencido según la regla `RUL-REC-10` | |
| `expected_amount` | Suele ser | "Suele ser S/89.00" |

## 4. Entidades y datos

### 4.1 `recurring_rules`

```sql
id                                 uuid pk
user_id                            uuid not null
status                             recurring_status not null
name                               text not null
merchant_pattern                   text null
expected_amount                    numeric(14,2) null
amount_variability                 text not null   -- fijo | variable
currency                           text not null default 'PEN'
frequency                          text not null   -- mensual | quincenal | semanal | anual | personalizada
day_of_month                       int null
next_expected_date                 date null
category_id                        text null
subcategory_id                     uuid null
linked_box_id                      uuid null references boxes(id)
linked_debt_id                     uuid null references debts(id)
source                             text not null   -- manual | detectado | email
requires_confirmation_for_payment  boolean not null default true
created_at, updated_at, deleted_at, metadata
```

`requires_confirmation_for_payment` está en `true` por defecto y **en V1 no
se puede poner en false desde ninguna superficie**. Existe en el modelo para
una evolución futura, no como opción actual.

### 4.2 `recurring_occurrences`

```sql
id                 uuid pk
user_id            uuid not null
recurring_rule_id  uuid not null references recurring_rules(id)
expected_date      date not null
expected_amount    numeric(14,2) null
status             recurring_occurrence_status not null
paid_at            timestamptz null
paid_movement_id   uuid null references movements(id)
created_at, updated_at, metadata
```

Único por `(recurring_rule_id, expected_date)`: no puede haber dos
ocurrencias del mismo pago para la misma fecha.

### 4.3 `recurring_candidates`

```sql
id            uuid pk
user_id       uuid not null
merchant_key  text null
category_id   text null
evidence      jsonb not null
confidence    numeric(5,4) not null
status        recurring_candidate_status not null default 'candidate'
created_at, updated_at, metadata
```

`evidence` guarda **los identificadores de los movimientos** que sustentan la
detección. Es lo que permite responder "¿por qué crees que esto se repite?"
con datos concretos en vez de con un porcentaje.

`confidence` existe en el modelo y **no se muestra nunca** (`C-11`).

### 4.4 Migración requerida

Ninguna nueva. Las tablas existen desde la migración `014`.

## 5. Máquina de estados

### 5.1 Regla recurrente

```text
   detección          creación manual
       │                     │
       ▼                     │
  ┌──────────┐               │
  │ sugerido │               │
  └────┬─────┘               │
       │ el usuario confirma │
       ▼                     ▼
   ┌────────────────────────────┐
   │          activo            │
   └──┬──────────┬──────────┬───┘
      │          │          │
      ▼          ▼          ▼
  pausado    cancelado   (sigue generando ocurrencias)
      │
      └──► activo
```

| Transición | Quién | Efecto en el dinero libre |
|---|---|---|
| detectado → sugerido | Sistema | **Ninguno.** Un candidato no descuenta nada |
| sugerido → activo | **Solo el usuario** | Empieza a descontar como compromiso próximo |
| activo → pausado | Usuario | Deja de descontar y de generar ocurrencias |
| activo → cancelado | Usuario | Deja de descontar; el historial se conserva |
| pausado → activo | Usuario | Vuelve a descontar |

### 5.2 Ocurrencia

```text
   generada ──► esperada ──► pagada
                    │
                    ├──► saltada (el usuario dice que este mes no toca)
                    │
                    └──► vencida (pasó la fecha sin pagarse)
                             │
                             ├──► pagada (tarde, pero pagada)
                             └──► saltada
```

Una ocurrencia **vencida sigue descontando** del dinero libre: el dinero
sigue debiéndose aunque la fecha haya pasado.

## 6. Reglas de negocio

**`RUL-REC-01` — Detectar no es activar**

Una detección crea un **candidato**, nunca una regla activa. El usuario
confirma. Sin confirmación, no descuenta nada ni aparece en compromisos.

Es la aplicación del principio de control (`08` §4.2) al módulo.

**`RUL-REC-02` — Umbral de detección**

Se sugiere un pago que viene cuando se cumplen las tres condiciones:

| Condición | Valor |
|---|---|
| Repeticiones del mismo comercio | **3 o más** |
| Regularidad del intervalo | Desviación menor al 20% del periodo |
| Estabilidad del monto | Igual, o variación menor al 15% |

Ejemplo que **sí** dispara sugerencia: Netflix S/44.90 el 14 de mayo, el 14
de junio y el 13 de julio. Tres repeticiones, intervalo de ~30 días con
desviación de un día, monto idéntico.

Ejemplo que **no**: tres compras en el mismo supermercado con montos de
S/40.00, S/120.00 y S/85.00 en fechas irregulares. Es un comercio habitual,
no un pago que se repite.

Si el monto varía más del 15% pero el intervalo es regular, se sugiere como
`amount_variability: variable` y sin monto esperado fijo.

**`RUL-REC-03` — Un pago esperado no afecta saldos**

Hasta que se marca como pagado, una ocurrencia **no toca el saldo de ninguna
cuenta**. Solo afecta el **dinero libre** como compromiso próximo
(`RUL-CUENTAS-03`).

La distinción es la clave del módulo: el dinero sigue en tu cuenta, pero ya
no es tuyo para gastar.

**`RUL-REC-04` — Sin doble descuento si hay caja**

Si un pago que viene está vinculado a una caja con saldo suficiente, **no
descuenta del dinero libre**: su dinero ya salió del libre cuando se separó.

Cobertura parcial: caja con S/60.00 y pago de S/89.00 descuenta solo S/29.00.

Es `RUL-CUENTAS-04` visto desde este lado.

**`RUL-REC-05` — Marcar pagado crea un movimiento real**

```text
1. El usuario marca la ocurrencia como pagada
2. Se crea un movimiento tipo `pago_recurrente` vía Core
3. La ocurrencia guarda `paid_movement_id` y pasa a `pagada`
4. El saldo de la cuenta baja
5. El compromiso deja de descontar del dinero libre (ya salió de verdad)
6. Se genera la siguiente ocurrencia
```

El paso 5 es donde la contabilidad cuadra: el dinero pasa de "comprometido" a
"gastado", y el dinero libre no cambia — porque ya estaba descontado.

**`RUL-REC-06` — Eliminar el movimiento revierte la ocurrencia**

Si el usuario elimina el movimiento de pago, la ocurrencia vuelve a
`esperada` y el compromiso vuelve a descontar. Se avisa.

**`RUL-REC-07` — Cambios de monto se muestran explícitamente**

Si un pago llega con un monto distinto al esperado, **se dice**:

```text
Tu internet subió: este mes fueron S/99.00, antes eran S/89.00.
[Actualizar lo que suele ser]  [Fue algo puntual]
```

Nunca se actualiza el monto esperado en silencio. Un servicio que sube de
precio es información que el usuario quiere tener.

**`RUL-REC-08` — Saltar un periodo**

El usuario puede decir que este mes no toca. La ocurrencia pasa a `saltada`,
deja de descontar, y **la regla sigue activa** para el periodo siguiente.

**`RUL-REC-09` — Vinculación con deudas**

Un pago que viene puede corresponder a la cuota de una deuda. En ese caso:

- El seguimiento del saldo y el progreso los lleva **el módulo de deudas**.
- Este módulo aporta la fecha y el recordatorio.
- Marcar pagado aquí ejecuta el pago de cuota del módulo 31, no un
  `pago_recurrente` genérico.
- **El compromiso se cuenta una sola vez**, no como cuota y como recurrente.

**`RUL-REC-10` — "Vencido" solo cuando aporta**

Regla de lenguaje heredada, porque "vencido" carga emocionalmente más que
"pendiente":

| Situación | Se dice |
|---|---|
| 0–2 días pasada la fecha esperada | **Pendiente** |
| 3+ días con fecha confirmada | **Vencido** |
| Fecha aproximada, no confirmada | **Pendiente** siempre |
| Deuda informal entre personas | **Pendiente** (evitar tono de cobranza) |
| Modo discreto | "Compromiso pendiente" |

**`RUL-REC-11` — Horizonte de compromisos: 30 días**

Coherente con `RUL-CUENTAS-05`. Los próximos 7 días se destacan en el Inicio.

**`RUL-REC-12` — Generación de ocurrencias**

Un trabajo diario genera las ocurrencias de los próximos 60 días para las
reglas activas. Nunca se generan al vuelo en una petición.

**`RUL-REC-13` — El correo no activa pagos que vienen**

Una detección por correo puede crear un **candidato**, nunca una regla
activa. Y un correo **no marca una ocurrencia como pagada**: crea un
pendiente que el usuario confirma (`RUL-EMAIL-01`).

## 7. Validaciones

| Campo | Regla |
|---|---|
| `name` | Obligatorio. 1–60 caracteres. Único por usuario entre activos |
| `frequency` | Obligatoria. Del conjunto permitido |
| `day_of_month` | 1–31 en frecuencia mensual. El 31 en meses cortos cae al último día |
| `expected_amount` | Obligatorio si `amount_variability = 'fijo'`. Mayor que 0 |
| `linked_box_id` | La caja debe existir, estar activa y ser del usuario |
| `linked_debt_id` | La deuda debe existir y estar activa |
| `next_expected_date` | No anterior a hoy al crear |
| Marcar pagado | Monto mayor que 0. Fecha no futura. Cuenta activa si se indica |

## 8. Superficies

### `SCR-REC-01` — Pagos que vienen

**Ruta:** `/pagos-que-vienen`
**Estado en URL:** `estado`, `cursor`

```text
┌──────────────────────────────────────────────────┐
│ Pagos que vienen                    [+ Agregar]  │
│ Este mes: S/428.00 · S/180.00 ya apartado        │
├──────────────────────────────────────────────────┤
│ Esta semana                                      │
│ Internet          28 jul    S/89.00   [Pagué]    │
│ Netflix           30 jul    S/44.90   [Pagué]    │
├──────────────────────────────────────────────────┤
│ Más adelante                                     │
│ Cuota laptop       5 ago   S/180.00   🏦 cubierto│
│ Alquiler          10 ago   S/300.00              │
├──────────────────────────────────────────────────┤
│ Pendientes                                       │
│ Luz               22 jul    S/62.00   ⚠️ 4 días  │
├──────────────────────────────────────────────────┤
│ Sugerencias                                      │
│ ¿Spotify se repite cada mes? S/19.90             │
│ Lo vi en mayo, junio y julio.                    │
│ [Sí, es un pago que viene]  [No]                 │
└──────────────────────────────────────────────────┘
```

Detalles que importan:

- **Cuatro secciones separadas**: esta semana, más adelante, pendientes,
  sugerencias. No una lista plana.
- El marcador "cubierto" indica que una caja lo respalda y por eso no
  descuenta del dinero libre.
- La sugerencia **muestra su evidencia** ("lo vi en mayo, junio y julio"), no
  un porcentaje.
- La cuota de laptop aparece aquí y **también** en Deudas, pero cuenta una
  sola vez en los compromisos (`RUL-REC-09`).

### `SCR-REC-02` — Detalle de un pago que viene

**Ruta:** `/pagos-que-vienen/[id]`

Muestra: nombre, monto esperado y su variabilidad, frecuencia, próxima
fecha, caja o deuda vinculada, historial de ocurrencias con lo que se pagó de
verdad cada vez, y el efecto sobre el dinero libre.

El historial es lo más útil: ver que el internet fue S/89.00, S/89.00,
S/99.00 le dice al usuario que subió sin que nadie se lo tenga que explicar.

### `SCR-REC-03` — Crear o editar

Modal. Campos de §7. Al crear desde una sugerencia, viene precargado con la
evidencia visible.

### `SCR-REC-04` — Marcar como pagado

Modal de confirmación. Precargado con el monto esperado, editable. Si el
monto difiere, aparece `RUL-REC-07` en el mismo paso.

Si está vinculado a una deuda, el modal lo dice y explica que se registrará
como pago de cuota.

### `SCR-REC-05` — Calendario de compromisos

Vista alternativa del mismo listado, por mes. Muestra deudas, cuotas y pagos
que vienen juntos — aquí sí se llaman **Compromisos**, según la regla de
vocabulario.

## 9. Acciones

| ID | Acción | ¿Confirma? | Deshacer | Evento |
|---|---|---|---|---|
| `ACT-REC-01` | Crear pago que viene | No | Eliminando | `recurrente.creado` |
| `ACT-REC-02` | Confirmar sugerencia | Sí | Cancelando | `recurrente.confirmado` |
| `ACT-REC-03` | Rechazar sugerencia | No | — | `recurrente.sugerencia_rechazada` |
| `ACT-REC-04` | Editar | No | Editando | `recurrente.editado` |
| `ACT-REC-05` | Pausar | No | Reactivando | `recurrente.pausado` |
| `ACT-REC-06` | Reactivar | No | Pausando | `recurrente.reactivado` |
| `ACT-REC-07` | Cancelar | **Sí, riesgo** | Reactivando | `recurrente.cancelado` |
| `ACT-REC-08` | Marcar pagado | Sí | Eliminando el movimiento | `ocurrencia.pagada` |
| `ACT-REC-09` | Saltar periodo | Sí | Desmarcando | `ocurrencia.saltada` |
| `ACT-REC-10` | Actualizar monto esperado | Sí | Editando | `recurrente.monto_actualizado` |
| `ACT-REC-11` | Vincular a caja | No | Desvinculando | `recurrente.vinculado_caja` |
| `ACT-REC-12` | Vincular a deuda | Sí | Desvinculando | `recurrente.vinculado_deuda` |

## 10. API

Base `/api/v1/recurring`.

| Método y ruta | Notas |
|---|---|
| `GET /recurring` | Reglas con su próxima ocurrencia. Filtro por estado |
| `POST /recurring` | Crea. `Idempotency-Key` |
| `GET /recurring/[id]` | Detalle con historial de ocurrencias |
| `PATCH /recurring/[id]` | Edita |
| `POST /recurring/[id]/pause` · `/resume` · `/cancel` | Transiciones |
| `GET /recurring/[id]/occurrences` | Historial paginado |
| `POST /recurring/[id]/occurrences/[oid]/mark-paid` | **Crea el movimiento vía Core.** `Idempotency-Key` |
| `POST /recurring/[id]/occurrences/[oid]/skip` | Salta |
| `GET /recurring/candidates` | Sugerencias con su evidencia |
| `POST /recurring/candidates/[id]/confirm` | Crea la regla activa |
| `POST /recurring/candidates/[id]/discard` | Rechaza |
| `GET /upcoming` | **Vista de compromisos**: recurrentes + cuotas de deuda, unificados y sin duplicar |

`GET /upcoming` es el que consume el Inicio y el cálculo de dinero libre.
Resuelve la unificación en el servidor para que ningún cliente tenga que
saber que una cuota puede aparecer en dos módulos.

## 11. Permisos y RLS

- Cliente autenticado en todas las rutas.
- **Excepción de service-role justificada**: el trabajo diario que genera
  ocurrencias y el detector de candidatos, ambos sin usuario en la petición.
  Lista blanca de `15` §4.
- RLS por `user_id` en las tres tablas.
- Marcar pagado escribe por el Core, con las mismas garantías que un
  movimiento manual.

## 12. Estados de datos

| Estado | Qué se muestra |
|---|---|
| **Vacío** | "No tienes pagos que vienen registrados. Cuando note que algo se repite, te lo sugiero." + agregar |
| **Solo sugerencias** | Las sugerencias con su evidencia, sin lista vacía arriba |
| **Con activos** | Las cuatro secciones de `SCR-REC-01` |
| **Todos pausados** | Se muestran atenuados con acción de reactivar |
| **Cargando** | Esqueleto de 3 tarjetas |
| **Error** | Mensaje en español con reintento |
| **Modo discreto** | "Tienes un compromiso próximo" sin monto ni nombre |

## 13. Errores

| ID | Causa | Mensaje visible | Salida |
|---|---|---|---|
| `ERR-REC-01` | Nombre duplicado | "Ya tienes un pago que viene con ese nombre." | Cambiar |
| `ERR-REC-02` | Monto ausente en tipo fijo | "¿De cuánto suele ser?" | Completar |
| `ERR-REC-03` | Día inválido | "El día debe estar entre 1 y 31." | Corregir |
| `ERR-REC-04` | Ocurrencia ya pagada | "Ese pago ya lo marcaste." | Ver el movimiento |
| `ERR-REC-05` | Caja inexistente o archivada | "Esa caja ya no está disponible." | Elegir otra |
| `ERR-REC-06` | Deuda cerrada | "Esa deuda ya está cerrada." | Elegir otra |
| `ERR-REC-07` | Fecha de pago futura | "Esa fecha todavía no llega." | Corregir |
| `ERR-REC-08` | Regla cancelada | "Ese pago está cancelado. ¿Lo reactivamos?" | Reactivar |
| `ERR-REC-09` | Cuenta archivada al pagar | "Esa cuenta está archivada." | Elegir otra |

## 14. Integración con el motor IA

### 14.1 Consultas que expone

| Dimensión | Notas |
|---|---|
| `estado_recurrente` | sugerido, activo, pausado, cancelado |
| `frecuencia` | |
| `variabilidad_monto` | fijo, variable |
| `cubierto_por_caja` | sí/no — **la que evita el doble descuento** |
| `vinculado_a_deuda` | sí/no |
| `dias_hasta_vencimiento` | |
| `estado_ocurrencia` | esperada, pagada, saltada, vencida |
| `origen` | manual, detectado, email |

| Medida | Notas |
|---|---|
| `total_comprometido` | Suma de compromisos del periodo |
| `total_no_cubierto` | **La que entra en el dinero libre** |
| `variacion_vs_esperado` | Cuánto se desvió lo pagado de lo previsto |

### 14.2 Comandos que acepta

| Comando | Confirmación |
|---|---|
| `crear_recurrente` | Tarjeta editable |
| `confirmar_sugerencia` | Tarjeta con evidencia |
| `marcar_pagado` | Tarjeta con monto editable |
| `saltar_periodo` | Tarjeta |
| `pausar_recurrente` / `reactivar` | Tarjeta |
| `cancelar_recurrente` | **Riesgo** |
| `actualizar_monto_esperado` | Tarjeta |
| `vincular_caja` / `vincular_deuda` | Tarjeta |

### 14.3 Qué se puede pedir en lenguaje natural

```text
"¿qué pagos vienen esta semana?"           → consulta con horizonte
"pagué el internet"                        → marcar_pagado
"el internet subió a 99"                   → actualizar_monto_esperado
"este mes no toca el gimnasio"             → saltar_periodo
"¿cuánto tengo comprometido este mes?"     → total_comprometido
"cancela Netflix"                          → cancelar_recurrente (riesgo)
"¿por qué crees que Spotify se repite?"    → evidencia del candidato
```

La segunda es el caso más frecuente y debe ser instantánea: si hay una sola
ocurrencia esperada de internet, se marca esa sin preguntar cuál.

La última muestra la evidencia real: "lo vi el 14 de mayo, el 14 de junio y
el 13 de julio, siempre S/19.90".

### 14.4 Lo que el motor NO puede hacer aquí

- Activar una sugerencia sin confirmación del usuario.
- Marcar pagado sin mostrar el monto que se va a registrar.
- Poner `requires_confirmation_for_payment` en false.

## 15. Memoria y aprendizaje

| Qué aprende | De dónde | Cómo se corrige |
|---|---|---|
| Qué comercios se repiten para este usuario | Detección confirmada | Rechazando la sugerencia |
| Su tolerancia a sugerencias | Aceptadas vs. rechazadas | — |
| Montos típicos por servicio | Historial de ocurrencias | Actualizando el esperado |
| Qué servicios suelen subir de precio | Variaciones registradas | — |

Un usuario que rechaza varias sugerencias seguidas recibe menos: el sistema
aprende que no quiere que le propongan esto, y baja la frecuencia en vez de
insistir.

## 16. Eventos y telemetría

Eventos: `recurrente.creado`, `.confirmado`, `.editado`, `.pausado`,
`.reactivado`, `.cancelado`, `.monto_actualizado`, `.vinculado_caja`,
`.vinculado_deuda`, `ocurrencia.generada`, `.pagada`, `.saltada`,
`.vencida`, `candidato.detectado`, `candidato.rechazado`.

Sin montos ni nombres de comercio. Sí frecuencia, origen y `trace_id`.

Métricas: reglas activas por usuario, tasa de aceptación de sugerencias
(mide la calidad del detector), tasa de pago a tiempo, ocurrencias saltadas,
proporción cubierta por caja, desviación media entre esperado y pagado.

La segunda es la más importante: si la gente rechaza la mayoría de
sugerencias, el detector está produciendo ruido y el umbral de `RUL-REC-02`
debe subir.

## 17. Rendimiento

- Índices: `recurring_rules (user_id, status)`,
  `recurring_occurrences (user_id, expected_date, status)`,
  `(recurring_rule_id, expected_date)` único,
  `recurring_candidates (user_id, status)`.
- Las ocurrencias se generan por trabajo diario, nunca en una petición.
- `GET /upcoming` resuelve la unión con deudas en **una sola consulta**, sin
  N+1.
- La detección de candidatos corre como trabajo diario sobre movimientos
  recientes, no sobre todo el historial.
- Presupuesto: listado bajo 400 ms; `/upcoming` bajo 300 ms porque lo consume
  el Inicio.

## 18. Accesibilidad específica

- El estado de cada pago se anuncia con texto: "Internet, 28 de julio, 89
  soles, pendiente".
- "Cubierto por caja" se comunica con texto, no solo con un icono.
- Las secciones (esta semana, más adelante, pendientes) son encabezados
  reales navegables.
- El aviso de vencido usa rol de alerta y lenguaje según `RUL-REC-10`.
- El calendario tiene tabla equivalente accesible.

## 19. Casos borde

1. **Día 31 en un mes de 30.** La ocurrencia cae el último día del mes.
2. **Frecuencia quincenal a fin de mes.** Días 15 y último del mes.
3. **Pago adelantado antes de la fecha esperada.** Se marca la ocurrencia
   próxima como pagada; no se crea una fuera de ciclo.
4. **Dos pagos del mismo servicio en un mes.** El segundo se registra como
   movimiento normal y se pregunta si adelantó el del mes siguiente.
5. **Regla vinculada a una caja que se elimina.** Se desvincula y se avisa
   que ese compromiso pasará a descontar del dinero libre.
6. **Regla vinculada a una deuda que se cierra.** Se ofrece cancelarla o
   desvincularla.
7. **Monto variable sin historial suficiente.** Se muestra sin monto
   esperado; no descuenta del dinero libre hasta tener una estimación con
   base.
8. **Usuario que cancela y vuelve a crear el mismo servicio.** Son dos reglas
   distintas; el historial de la anterior se conserva.
9. **Sugerencia de algo que el usuario ya tiene activo.** No se sugiere: el
   detector excluye comercios con regla activa.
10. **Ocurrencia vencida hace meses.** Sigue apareciendo en pendientes; a los
    90 días se ofrece resolverla ("¿lo pagaste, o lo dejamos?").
11. **Eliminar el movimiento de un pago marcado.** La ocurrencia vuelve a
    esperada y el compromiso vuelve a descontar (`RUL-REC-06`).
12. **Cuota de deuda que también parece recurrente.** El detector excluye
    movimientos con `debt_id`: ya los sigue el módulo 31.

## 20. Criterios de aceptación

- `AC-REC-01` — Una detección crea un candidato, nunca una regla activa.
  Evidencia: `TEST`.
- `AC-REC-02` — Un pago esperado no modifica el saldo de ninguna cuenta.
  Evidencia: `TEST`.
- `AC-REC-03` — Un pago cubierto por caja no descuenta del dinero libre; la
  cobertura parcial descuenta solo la diferencia. Evidencia: `TEST`.
- `AC-REC-04` — Marcar pagado crea un movimiento real vía Core y el dinero
  libre no cambia por ello. Evidencia: `TEST`.
- `AC-REC-05` — Eliminar el movimiento devuelve la ocurrencia a esperada.
  Evidencia: `TEST`.
- `AC-REC-06` — Un cambio de monto se muestra explícitamente y nunca se
  actualiza el esperado en silencio. Evidencia: `TEST` + `USER`.
- `AC-REC-07` — Una cuota vinculada a deuda cuenta **una sola vez** en los
  compromisos. Evidencia: `TEST`.
- `AC-REC-08` — La regla de "vencido" vs "pendiente" se aplica según
  `RUL-REC-10`. Evidencia: `TEST` + `USER`.
- `AC-REC-09` — El umbral de detección exige 3 repeticiones con intervalo y
  monto estables. Evidencia: `TEST`.
- `AC-REC-10` — Una sugerencia muestra su evidencia concreta, nunca un
  porcentaje. Evidencia: `TEST` + `USER`.
- `AC-REC-11` — El detector no sugiere comercios con regla activa ni
  movimientos vinculados a deudas. Evidencia: `TEST`.
- `AC-REC-12` — Las ocurrencias las genera un trabajo programado, no una
  petición. Evidencia: `CODE`.
- `AC-REC-13` — `requires_confirmation_for_payment` no se puede desactivar
  desde ninguna superficie en V1. Evidencia: `TEST`.
- `AC-REC-14` — El correo nunca activa una regla ni marca una ocurrencia como
  pagada. Evidencia: `TEST`.
- `AC-REC-15` — `GET /upcoming` unifica recurrentes y cuotas sin duplicar, en
  una sola consulta. Evidencia: `TEST`.

## 21. Fuera de alcance y puente a WhatsApp

Fuera de V1-web: pago automático, pasarelas, predicción de monto variable,
negociación de fechas.

Puente a WhatsApp: este módulo es el principal productor de recordatorios
proactivos, y en la fase 2 WhatsApp será su canal natural ("tu internet vence
mañana"). La política de cuándo y cuánto avisar vive en el módulo 37 y se
ampliará entonces; las reglas de este módulo no cambian. El comando
`marcar_pagado` es de los que mejor funcionan en conversación: *"pagué el
internet"* resuelto en un turno.

## 22. Trazabilidad

**Documentos de `docs/` consumidos:**
`docs/fase_2_estrategia/alcance_v1/05i_recurrentes.md` (tipos, detección,
naming visible §20.1, estados, vínculo con deudas),
`docs/fase_4_tecnica/16_modelo_datos.md` §11,
`docs/fase_3_producto/12_lenguaje_producto.md` §9.1 (regla de "vencido").

**Contradicciones que cierra:** ninguna directamente; sostiene
`RUL-CUENTAS-04` (no doble descuento) desde el lado de los compromisos.

**Diferencias frente a los documentos fuente:** se fijan los umbrales
concretos de detección (3 repeticiones, 20% de desviación de intervalo, 15%
de monto), que `05i` dejaba indefinidos. Se añade `GET /upcoming` como vista
unificada que resuelve el conteo único de las cuotas de deuda en el servidor.
Se retira `confidence` de toda superficie visible.
