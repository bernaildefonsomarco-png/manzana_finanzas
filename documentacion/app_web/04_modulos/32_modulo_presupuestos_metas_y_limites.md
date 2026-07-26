# 32 — Módulo: Presupuestos, metas y límites

**ID de módulo:** `MOD-PRESUPUESTOS`
**Bloque:** 04 — Módulos
**Estado:** V1
**Fecha:** 26 de julio de 2026
**Docs fuente:** ninguno — **módulo nuevo**. `docs/fase_2_estrategia/alcance_v1/05c_dashboard.md` §20 lo dejaba explícitamente fuera de V1; `WEB-D002` lo incorpora. Se apoya en `09_modelo_mental_dinero.md` §8 y `13_modelo_datos_web_v1.md` §7.1
**Documentos que dependen de este:** `33` (proyecciones), `34` (descubrimientos), `35` (reportes), `39` (home)

---

## 1. Tesis y qué NO es

Los módulos anteriores responden *"¿qué pasó?"*. Este responde **"¿cómo voy
respecto a lo que quería?"** — y es la primera pieza del cuarto trabajo del
producto: decidir hacia adelante.

Su valor no es controlar al usuario. Es **convertir una intención en algo que
se puede mirar**: alguien que dice "quiero gastar menos en delivery" no tiene
forma de saber si lo está logrando hasta que existe un número contra el cual
compararse.

El riesgo de este módulo es evidente y hay que nombrarlo: **un presupuesto es
la herramienta más fácil de convertir en un instrumento de culpa.** Todo el
diseño de abajo está orientado a que eso no ocurra. Superar un presupuesto es
**información**, no un fracaso.

**Qué NO es:**

- **No reserva dinero.** Presupuestar S/400 en comida no baja tu dinero libre
  en S/400. Es una referencia, no un apartado (`RUL-PRES-01`).
- No bloquea nada. Nunca impide registrar un gasto ni te avisa en el momento
  de gastar.
- No es una dieta. No hay rachas, ni puntos, ni celebración por "cumplir".
- No juzga. No existe el concepto de "presupuesto fallido".
- No aconseja. Puede decirte que vas S/30 arriba; no te dice que deberías
  gastar menos (`22` §8).

## 2. Alcance

| Nivel | Funcionalidad |
|---|---|
| **IN V1-web** | Presupuesto por categoría y periodo (semanal, quincenal, mensual). Tres tipos: presupuesto, límite blando y límite duro. Metas de ahorro con monto objetivo y fecha, vinculables a una caja. Semáforo de avance con lenguaje sin culpa. Presupuesto sugerido a partir del historial propio. Copiar del periodo anterior. Traspaso de sobrante opcional. Relación explícita con el dinero libre. Avance visible en el Inicio. |
| **V1.1** | Presupuesto de base cero. Reasignación entre categorías dentro del periodo. Presupuestos por subcategoría. Metas con aportes programados. |
| **FUERA** | Presupuestos compartidos entre personas. Bloqueo de gastos. Recomendación automática de recortes — es consejo financiero. Gamificación de cualquier tipo. |

## 3. Vocabulario

| Interno | Visible | Regla |
|---|---|---|
| `Budget` con `kind: presupuesto` | Presupuesto | Referencia de gasto planeado |
| `Budget` con `kind: limite_blando` | Límite | Avisa al acercarse |
| `Budget` con `kind: limite_duro` | Límite estricto | Avisa y destaca; **no bloquea** |
| `Goal` | Meta | Objetivo de ahorro |
| `rollover` | Lo que sobre pasa al siguiente | |
| Superar | **Superado** | Nunca "excedido", "fallido" ni "incumplido" |
| `budget_progress_snapshots` | No visible | |

Palabras prohibidas en este módulo, además de las del glosario general:
*fallaste*, *incumpliste*, *deberías*, *mal*, *fuera de control*, *alerta*.

## 4. Entidades y datos

### 4.1 `budgets`

```sql
id            uuid pk
user_id       uuid not null
category_id   text null references categories(id)   -- null = presupuesto general
period_kind   budget_period not null    -- semanal | quincenal | mensual
period_start  date not null
period_end    date not null
amount        numeric(14,2) not null
kind          budget_kind not null      -- presupuesto | limite_blando | limite_duro
rollover      boolean not null default false
auto_renew    boolean not null default true
alerted_thresholds  smallint[] not null default '{}'   -- 70 | 90 | 100
source        budget_source not null    -- manual | sugerido
status        budget_status not null    -- activo | pausado | archivado
created_at, updated_at, deleted_at, metadata
```

Restricciones:

- `amount > 0`.
- `period_end > period_start`.
- `category_id` referencia `categories(id)`.
- Único parcial `(user_id, category_id, period_start, kind)` **entre los de
  `status = 'activo'`**: no puede haber dos presupuestos activos de la misma
  categoría, periodo y tipo. Archivados y pausados no bloquean, porque
  archivar y recrear dentro del mismo periodo es un caso legítimo
  (`ACT-PRES-03`) y solo los activos calculan avance.
- `category_id` nulo significa presupuesto general del periodo, que convive
  con los de categoría.

Dos columnas merecen explicación porque existen para sostener una regla que
sin ellas no sería implementable:

- **`auto_renew`** — `RUL-PRES-10` permite desactivar la renovación por
  presupuesto. Sin columna, esa frase era una promesa sin respaldo.
- **`alerted_thresholds`** — qué umbrales ya avisaron en **este** periodo. Se
  vacía al renovar. Es lo que hace verificable `RUL-PRES-06`; véase §6 para
  por qué el aviso y el tramo son cosas distintas.

**No existe ninguna columna que descuente de saldos.** Es la traducción
estructural de `RUL-PRES-01`.

### 4.2 `goals`

```sql
id             uuid pk
user_id        uuid not null
name           text not null
target_amount  numeric(14,2) not null
target_date    date null
box_id         uuid null references boxes(id)
status         goal_status not null   -- activa | alcanzada | pausada | archivada
created_at, updated_at, deleted_at, metadata
```

`box_id` es lo que conecta una meta con dinero real. Sin caja, una meta es
una intención sin respaldo — válida, pero se muestra distinto (§12).

### 4.3 `budget_progress_snapshots`

```sql
id         uuid pk
user_id    uuid not null
budget_id  uuid not null references budgets(id)
as_of      date not null
spent      numeric(14,2) not null
remaining  numeric(14,2) not null
pct        numeric(5,4) not null
created_at
```

Fotos diarias del avance, para historial y comparativas sin tener que
recalcular todo el pasado en cada consulta. Único por `(budget_id, as_of)`.

### 4.4 Migración requerida

`048`, documentada en `13_modelo_datos_web_v1.md` §7.1. Este módulo añade a lo
que allí figuraba:

| Cambio | Por qué |
|---|---|
| `budgets.auto_renew` | `RUL-PRES-10` |
| `budgets.alerted_thresholds` | `RUL-PRES-06` |
| FK `budgets.category_id → categories(id)` | Un presupuesto de una categoría inexistente no es representable |
| Alcance del único: entre `activo`, no "no borrado" | Archivar y recrear en el mismo periodo es legítimo |
| Único `(budget_id, as_of)` en snapshots | El trabajo diario debe poder reejecutarse sin duplicar |
| Índices `budgets (user_id, status)` y `budget_progress_snapshots (budget_id, as_of desc)` | §17 |

Los seis están ya reflejados en `13` §7.1 y §11.

## 5. Máquina de estados

### 5.1 Presupuesto

```text
   crear (manual o desde sugerencia)
        │
        ▼
   ┌─────────┐  el periodo termina   ┌───────────┐
   │ activo  │──────────────────────►│ archivado │
   └────┬────┘                       └───────────┘
        │ pausar          ▲
        ▼                 │ renovar (crea uno nuevo)
   ┌─────────┐            │
   │ pausado │────────────┘
   └─────────┘
```

Un presupuesto **no se "cumple" ni se "falla"**: termina su periodo y se
archiva con su resultado. La renovación crea uno nuevo, opcionalmente con el
sobrante si `rollover` está activo.

### 5.2 Avance de un presupuesto (no es un estado persistido)

```text
   ├──────────────┼──────────────┼──────────────┤
   0%            70%            90%           100%+
   holgado      atención      cerca         superado
```

Cuatro tramos, y su único efecto es el lenguaje y el color con que se
muestra. **Ninguno bloquea nada.**

**Tramo y aviso son dos cosas distintas, y confundirlas es el error clásico de
este módulo.** Conviene fijarlo aquí porque el resto de §6 depende de la
distinción:

| | Tramo | Aviso |
|---|---|---|
| Qué es | Estado visual permanente | Notificación puntual |
| Dónde vive | Se calcula al vuelo, no se guarda | `alerted_thresholds` en `budgets` |
| Dónde se ve | Donde aparezca el presupuesto: `/presupuestos` e Inicio | Bandeja de notificaciones (`37`) |
| Cuántas veces | Siempre visible mientras dure | Una vez por umbral y periodo |
| Quién lo dispara | Nadie: es el avance actual | Cruzar un umbral hacia arriba |

Un presupuesto al 95% muestra el tramo "cerca" cada vez que el usuario abra la
pantalla, indefinidamente, y eso no es un aviso: es el estado de la cosa. El
aviso es el mensaje que llega **una sola vez** cuando cruza el 90%. Que el
tramo sea permanente y el aviso no es lo que evita que el producto se convierta
en un recordatorio constante de que vas mal.

### 5.3 Meta

```text
   activa ──► alcanzada     (el saldo de su caja llega al objetivo)
      │           │
      │           └──► activa   (si el saldo baja de nuevo)
      ├──► pausada ──► activa
      └──► archivada
```

Igual que en cajas (`24` §5.2): alcanzar es un estado observable, no un
logro que se celebra ni se pierde con drama.

## 6. Reglas de negocio

**`RUL-PRES-01` — Un presupuesto no reserva dinero**

La regla que gobierna el módulo, ya fijada en `09_modelo_mental_dinero.md`
§8:

```text
Presupuestas S/400.00 en comida.
Tu dinero libre NO baja S/400.00.
El gasto real se descuenta cuando ocurre, como cualquier movimiento.
```

Si el usuario quiere que ese dinero sí quede apartado, la herramienta
correcta es una **caja**, no un presupuesto. La app debe saber explicar esta
diferencia cuando el usuario la encuentre por primera vez
(`48_ayuda_explicabilidad_y_soporte.md`).

**`RUL-PRES-02` — Qué movimientos cuentan**

| Cuenta | No cuenta |
|---|---|
| `gasto` | `ingreso` — un presupuesto mide gasto, no entradas |
| `pago_recurrente` | `transferencia` — mover entre cuentas propias no es gasto |
| `pago_deuda`, solo en presupuestos de la categoría `deudas` | `asignacion_interna` — apartar no es gastar |
| | `ajuste` |
| | `deuda_adquirida`, `prestamo_dado`, `prestamo_recibido`, `devolucion_recibida` |

Los once tipos de `26` §4 quedan clasificados: tres cuentan, ocho no.

La tercera fila de la izquierda es una decisión deliberada: si alguien
presupuesta "Deudas: S/500 al mes", espera que sus pagos de cuota cuenten
ahí. Fuera de esa categoría, un pago de deuda no consume presupuesto de
consumo.

Los movimientos **eliminados no cuentan**; los restaurados vuelven a contar.

**`RUL-PRES-03` — Cálculo del avance**

```text
gastado    = Σ movimientos que cuentan, en la categoría y el periodo
restante   = amount − gastado          (puede ser negativo)
porcentaje = gastado / amount
```

Ejemplo:

```text
Presupuesto Alimentación, julio, S/400.00
Gastos del periodo: S/318.50
  → restante: S/81.50
  → 80% — tramo "atención"
```

Un movimiento sin categoría **no cuenta en ningún presupuesto de categoría**,
pero sí en el presupuesto general si existe.

**`RUL-PRES-04` — Los tres tipos, y qué cambia entre ellos**

Lo único que cambia entre los tres tipos es **en qué umbrales avisan**. El
tramo se muestra igual en los tres (§5.2).

| Tipo | Umbrales que avisan | Peso visual del tramo | ¿Bloquea? |
|---|---|---|---|
| **Presupuesto** | 100 | Normal | No |
| **Límite** | 90, 100 | Con más peso | No |
| **Límite estricto** | 70, 90, 100 | Destacado | **No** |

Los umbrales de esta tabla son los valores que se guardan en
`alerted_thresholds`, y el destino del aviso es la bandeja de notificaciones
del módulo 37, con su política de fatiga.

**Ninguno bloquea un gasto.** La diferencia es solo cuánta atención pide.

Un usuario que pone un límite estricto está pidiendo que le avisen antes, no
que le impidan gastar. Impedirlo sería tratarlo como si no supiera lo que
hace con su dinero.

**`RUL-PRES-05` — Lenguaje al superar: información, no juicio**

```text
Correcto:
  Vas S/30.00 arriba de lo que planeaste en Transporte.
  Subió sobre todo por 4 viajes del fin de semana.
  [Ver qué subió]  [Ajustar el presupuesto]

Incorrecto:
  ⚠️ PRESUPUESTO EXCEDIDO
  Has superado tu límite de Transporte en S/30.00
```

Reglas de copy, verificables:

- Se dice **qué pasó y por qué**, no que el usuario falló.
- Siempre hay una salida útil, y **"ajustar el presupuesto" es una de ellas
  con la misma jerarquía que las demás**. Un presupuesto mal calibrado se
  corrige, no se sufre.
- Nunca signos de alarma como elemento principal.
- Nunca comparación con otros usuarios.
- Nunca lenguaje de racha ni de disciplina.

**`RUL-PRES-06` — El aviso llega una vez por umbral y periodo**

Cruzar el 90% avisa una vez. Si el gasto baja y vuelve a subir, **no avisa
otra vez**. Superar avisa una vez, no en cada gasto posterior.

Sin esta regla, un presupuesto superado a mitad de mes convierte cada compra
del resto del mes en una notificación de fracaso.

Cómo se implementa, sin ambigüedad:

```text
Al escribirse un movimiento de una categoría presupuestada:
  1. recalcular pct
  2. para cada umbral U de RUL-PRES-04 según el tipo:
       si pct >= U y U no está en budget.alerted_thresholds:
           emitir aviso al módulo 37
           añadir U a budget.alerted_thresholds
  3. nunca se quita nada de alerted_thresholds durante el periodo
```

El paso 3 es la regla entera. Si el avance baja del umbral, **el umbral sigue
marcado**: eso es lo que impide el aviso repetido cuando vuelve a subir. Se
vacía solo al renovar el periodo (`RUL-PRES-10`).

Ejemplo, límite estricto de S/300 en Transporte:

```text
 5 jul  gastado S/215  → 72%  cruza 70  → avisa.  alerted = {70}
12 jul  gastado S/276  → 92%  cruza 90  → avisa.  alerted = {70,90}
14 jul  se elimina un gasto, queda S/258 → 86%    no avisa. alerted = {70,90}
18 jul  gastado S/291  → 97%  90 ya está → NO avisa
26 jul  gastado S/330  → 110% cruza 100 → avisa.  alerted = {70,90,100}
29 jul  gastado S/358  → 119% 100 ya está → NO avisa
 1 ago  renueva → alerted = {}
```

Editar el monto del presupuesto **no vacía** `alerted_thresholds`. Subirlo tras
superar baja el porcentaje, y si más tarde vuelve a cruzar el 100% no se avisa
de nuevo: el usuario ya sabe que ese presupuesto le queda corto, se lo dijimos
este mes y ya actuó. Insistir sería exactamente el ruido que la regla evita.

**El tramo no se ve afectado por nada de esto.** En el ejemplo, el 14 de julio
la pantalla muestra "cerca, 86%" aunque no se haya emitido ningún aviso, y el
29 muestra "superado por S/58" aunque tampoco. Ver §5.2.

**`RUL-PRES-07` — Presupuesto sugerido a partir del historial propio**

Se sugiere un presupuesto para una categoría cuando hay **al menos 2
periodos completos** con gasto en ella. El valor propuesto es la **mediana**
de esos periodos, no el promedio.

Razón de la mediana: un mes atípico (una mudanza, un viaje) desplaza el
promedio y produce un presupuesto que no representa el hábito real.

La sugerencia muestra su evidencia:

```text
En comida sueles gastar cerca de S/380 al mes.
Lo veo en tus últimos 3 meses: S/360, S/385 y S/378.
¿Quieres poner un presupuesto de S/400?
[Sí]  [Otro monto]  [No, gracias]
```

Nunca se crea solo. Nunca se compara con "lo que gasta la gente".

**`RUL-PRES-08` — Traspaso de sobrante, apagado por defecto**

Si `rollover` está activo, lo que sobra de un periodo se suma al siguiente al
renovar.

```text
Julio: presupuesto S/400.00, gastado S/340.00 → sobran S/60.00
Agosto con traspaso: S/460.00
Agosto sin traspaso: S/400.00
```

**Por defecto está apagado.** Con traspaso, el presupuesto deja de ser una
referencia del periodo y se convierte en un acumulado, que es una herramienta
distinta y menos legible. Quien la quiera la activa.

El traspaso **no acumula indefinidamente**: solo del periodo inmediatamente
anterior.

**`RUL-PRES-09` — Periodos**

| Periodo | Definición |
|---|---|
| Semanal | Lunes a domingo |
| Quincenal | Del 1 al 15, y del 16 al último día del mes |
| Mensual | Del 1 al último día del mes |

Todos en `America/Lima`. El periodo activo es el que contiene la fecha de
hoy. **En V1 no se pueden alinear con el día de cobro del usuario**; se
documenta como límite conocido.

**`RUL-PRES-10` — Renovación automática**

Al terminar un periodo, un trabajo diario archiva el presupuesto con su
resultado y, **si `auto_renew` está activo**, crea el del periodo siguiente con
el mismo monto (más el sobrante si `rollover` aplica) y con
`alerted_thresholds` vacío. Se avisa una vez al empezar el periodo nuevo, sin
interrumpir.

`auto_renew` está **encendido por defecto**: quien pone un presupuesto mensual
espera tenerlo el mes siguiente sin volver a crearlo. Se apaga desde
`ACT-PRES-15` o `PATCH /budgets/[id]`, y con él apagado el presupuesto
simplemente se archiva al cerrar el periodo.

Es el reverso deliberado de `rollover`, que está apagado por defecto
(`RUL-PRES-08`): renovar mantiene la herramienta como el usuario la dejó,
mientras que traspasar el sobrante **cambia qué significa el número** del mes
siguiente. Lo que preserva la expectativa va encendido; lo que la altera, no.

**`RUL-PRES-11` — Metas y cajas**

Una meta puede vincularse a una caja. Si lo está:

- Su progreso es el saldo real de la caja.
- **El dinero está realmente apartado** y por tanto sí afecta al dinero libre
  — pero por ser caja, no por ser meta (`RUL-CUENTAS-01`).
- Alcanzarla es que el saldo de la caja llegue al objetivo.

Sin caja vinculada, la meta es una intención sin respaldo: se muestra sin
barra de progreso y con la opción de crear la caja que la respalde.

**`RUL-PRES-12` — Una meta no fuerza aportes**

No hay aportes obligatorios ni recordatorios de "te toca ahorrar". Si tiene
fecha objetivo, se puede mostrar el ritmo necesario **como dato**, nunca como
exigencia:

```text
Correcto:   Para llegar en diciembre, harían falta unos S/240 al mes.
Incorrecto: Debes ahorrar S/240 este mes para cumplir tu meta.
```

**`RUL-PRES-13` — Editar un presupuesto no reescribe el pasado**

Cambiar el monto de un presupuesto activo afecta el avance del periodo
actual, no los archivados. Los snapshots ya tomados se conservan.

## 7. Validaciones

| Campo | Regla |
|---|---|
| `amount` | Obligatorio, mayor que 0, máximo 14 dígitos con 2 decimales |
| `category_id` | Opcional. Si se indica, debe existir. Prohibidas las categorías que no admiten gasto |
| `period_kind` | Obligatorio, del enum |
| `period_start` / `period_end` | Coherentes con `period_kind`; los calcula el servidor, no el cliente |
| Duplicado | Rechazado si ya existe uno activo de la misma categoría, periodo y tipo |
| `kind` | Obligatorio, del enum |
| Meta `name` | 1–60 caracteres, único por usuario entre activas |
| Meta `target_amount` | Mayor que 0 |
| Meta `target_date` | Futura al crear, si se indica |
| Meta `box_id` | La caja debe existir, estar activa y ser del usuario |

## 8. Superficies

**Referencia visual: no existe frame previo.** Ninguna de estas cinco
pantallas está en `docs/fase_6_visual/32_especificacion_hifi.md` ni en
`stitch_manzana_v1/`, porque `05c` §20 dejaba los presupuestos fuera de V1 y
nunca se diseñaron. Los bloques de texto de abajo son la especificación de
layout, no un boceto de algo ya dibujado. Los tokens y primitivas salen de
`16_design_system_web.md`.

### `SCR-PRES-01` — Presupuestos

**Ruta:** `/presupuestos`
**Estado en URL:** `periodo`

```text
┌──────────────────────────────────────────────────┐
│ Presupuestos              julio 2026  [+ Nuevo]  │
│ Llevas S/640 de S/900 planeado                   │
├──────────────────────────────────────────────────┤
│ Alimentación        S/318 de S/400   ▓▓▓▓▓▓▓░ 80%│
│ Transporte          S/230 de S/200   ▓▓▓▓▓▓▓▓ +30│
│   Subió por 4 viajes del fin de semana           │
│   [Ver qué subió]  [Ajustar]                     │
│ Ocio                S/ 92 de S/300   ▓▓░░░░░░ 31%│
├──────────────────────────────────────────────────┤
│ Metas                                  [+ Nueva] │
│ Viaje a Cusco    S/840 de S/2,000  ▓▓▓░░ · dic   │
│   Al ritmo actual, llegarías en noviembre        │
├──────────────────────────────────────────────────┤
│ Sugerencia                                       │
│ En Servicios sueles gastar cerca de S/180 al mes.│
│ ¿Quieres ponerle presupuesto?      [Sí]  [No]    │
└──────────────────────────────────────────────────┘
```

Detalles que importan:

- La cabecera suma **exactamente los presupuestos listados**: 318 + 230 + 92 =
  640, sobre 400 + 200 + 300 = 900. Esta pantalla los muestra todos; la que
  recorta a tres es `SCR-PRES-05`.
- El superado se muestra con **su explicación y sus dos salidas**, en la
  misma tarjeta. No hay que ir a buscar por qué.
- "Ajustar" tiene la misma jerarquía visual que "Ver qué subió".
- La meta muestra el ritmo como **dato observado**, no como exigencia.
- La sugerencia lleva su evidencia.

### `SCR-PRES-02` — Detalle de presupuesto

**Ruta:** `/presupuestos/[id]`

Avance del periodo, movimientos que lo componen con enlace al listado
filtrado, historial de periodos anteriores con su resultado, y las acciones.

El historial es lo más útil del detalle: ver S/360, S/385, S/430, S/318 dice
más sobre el hábito que cualquier porcentaje del mes actual.

### `SCR-PRES-03` — Crear o editar presupuesto

Modal. Al elegir categoría, **precarga el monto sugerido** con su evidencia
si hay historial suficiente. El tipo se explica en una línea cada uno.

### `SCR-PRES-04` — Detalle de meta

**Ruta:** `/presupuestos/[id]`

Es la misma ruta que `SCR-PRES-02` y no hay `/metas/[id]`: presupuestos y metas
comparten pantalla de listado, y darles rutas de detalle distintas obligaría a
saber de qué tipo es un identificador antes de poder navegar hasta él.
Coherente con el mapa de rutas de `10` §4, donde `/presupuestos/[id]` está
declarada como "detalle de presupuesto o meta".

Progreso, caja vinculada, ritmo necesario si hay fecha, historial de aportes,
y acción de aportar (que crea una `asignacion_interna` hacia la caja).

### `SCR-PRES-05` — Avance en el Inicio

Componente. Muestra **como máximo los tres presupuestos más relevantes**:
los superados primero, luego los que están cerca, luego el resto por gasto.

Nunca los muestra todos: el Inicio informa, no audita.

## 9. Acciones

| ID | Acción | ¿Confirma? | Deshacer | Evento |
|---|---|---|---|---|
| `ACT-PRES-01` | Crear presupuesto | No | Archivando | `presupuesto.creado` |
| `ACT-PRES-02` | Editar presupuesto | No | Editando | `presupuesto.editado` |
| `ACT-PRES-03` | Ajustar monto tras superar | No | Editando | `presupuesto.ajustado` |
| `ACT-PRES-04` | Pausar | No | Reactivando | `presupuesto.pausado` |
| `ACT-PRES-05` | Archivar | Sí | Restaurando | `presupuesto.archivado` |
| `ACT-PRES-06` | Aceptar sugerencia | No | Archivando | `presupuesto.sugerido_aceptado` |
| `ACT-PRES-07` | Rechazar sugerencia | No | — | `presupuesto.sugerido_rechazado` |
| `ACT-PRES-08` | Copiar del periodo anterior | Sí, con resumen | Archivando | `presupuesto.copiado` |
| `ACT-PRES-09` | Activar o desactivar traspaso | No | Alternando | `presupuesto.traspaso_cambiado` |
| `ACT-PRES-15` | Activar o desactivar renovación | No | Alternando | `presupuesto.renovacion_cambiada` |
| `ACT-PRES-10` | Ver qué compone el avance | No | — | `presupuesto.detalle_consultado` |
| `ACT-PRES-11` | Crear meta | No | Archivando | `meta.creada` |
| `ACT-PRES-12` | Vincular meta a caja | No | Desvinculando | `meta.vinculada` |
| `ACT-PRES-13` | Aportar a una meta | Sí | Devolviendo | `meta.aporte` |
| `ACT-PRES-14` | Archivar meta | Sí | Restaurando | `meta.archivada` |

`ACT-PRES-13` no es una acción propia: crea una `asignacion_interna` hacia la
caja vinculada, vía el módulo 24.

## 10. API

| Método y ruta | Notas |
|---|---|
| `GET /budgets` | Del periodo indicado, con avance calculado y sus referencias |
| `POST /budgets` | Crea. El servidor calcula `period_start` y `period_end` |
| `GET /budgets/[id]` | Detalle con movimientos que lo componen e historial |
| `PATCH /budgets/[id]` | Edita monto, tipo, traspaso o renovación. No toca `alerted_thresholds` |
| `DELETE /budgets/[id]` | Archiva |
| `POST /budgets/[id]/pause` · `/resume` | Transiciones |
| `POST /budgets/copy-previous` | Copia el periodo anterior completo. `Idempotency-Key` |
| `GET /budgets/suggestions` | Sugerencias con su evidencia |
| `POST /budgets/suggestions/[id]/accept` · `/dismiss` | Resolución |
| `GET /goals` · `POST` · `PATCH` · `DELETE` | Metas |
| `POST /goals/[id]/link-box` | Vincula caja |
| `GET /budgets/summary` | Avance agregado del periodo, para el Inicio |

`GET /budgets` devuelve el avance **con las referencias de los movimientos
que lo componen**, para que "¿de dónde sale este 80%?" tenga respuesta sin
otra petición.

## 11. Permisos y RLS

- Cliente autenticado en todas las rutas. **Sin excepciones de service-role**
  salvo el trabajo diario de snapshots y renovación, que entra en la lista
  blanca por no tener usuario en la petición.
- RLS por `user_id` en `budgets`, `goals` y `budget_progress_snapshots`.
- Un presupuesto o meta de otro usuario devuelve 404.

## 12. Estados de datos

| Estado | Qué se muestra |
|---|---|
| **Sin presupuestos, sin historial** | "Cuando tenga un par de meses de tus gastos, puedo proponerte presupuestos con tus propios números." + crear a mano |
| **Sin presupuestos, con historial** | Sugerencias con evidencia, listas para aceptar |
| **Con presupuestos, periodo recién empezado** | Avance en 0% sin alarma; el tramo "holgado" es el estado normal |
| **Con superados** | Ordenados primero, con explicación y salidas |
| **Meta sin caja** | Sin barra de progreso; "Esta meta no tiene dinero apartado todavía" + crear caja |
| **Meta alcanzada** | Estado observable, sin celebración desproporcionada |
| **Periodo pasado** | Solo lectura, con su resultado final |
| **Cargando** | Esqueleto con la forma de las barras |
| **Modo discreto** | Barras visibles, montos ocultos |

La última fila es una decisión de diseño: en modo discreto el **avance
relativo sigue siendo útil y no es sensible**; el monto sí.

## 13. Errores

| ID | Causa | Mensaje visible | Salida |
|---|---|---|---|
| `ERR-PRES-01` | Presupuesto duplicado | "Ya tienes un presupuesto de Alimentación para julio." | Ver el existente |
| `ERR-PRES-02` | Monto cero o negativo | "El monto tiene que ser mayor que cero." | Corregir |
| `ERR-PRES-03` | Categoría que no admite gasto | "Las transferencias no llevan presupuesto: no son un gasto." | Elegir otra |
| `ERR-PRES-04` | Presupuesto no encontrado | "No encontré ese presupuesto." | Volver |
| `ERR-PRES-05` | Editar uno de periodo cerrado | "Ese periodo ya terminó. Puedes ajustar el de este mes." | Ir al actual |
| `ERR-PRES-06` | Copiar sin periodo anterior | "Todavía no hay un periodo anterior que copiar." | Crear a mano |
| `ERR-PRES-07` | Meta duplicada | "Ya tienes una meta con ese nombre." | Cambiar nombre |
| `ERR-PRES-08` | Caja ya vinculada a otra meta | "Esa caja ya respalda otra meta." | Elegir otra |
| `ERR-PRES-09` | Fecha objetivo pasada | "Esa fecha ya pasó." | Corregir |
| `ERR-PRES-10` | Aporte mayor que el libre de la cuenta | "Solo tienes S/50.00 libres en esa cuenta." | Ajustar |

## 14. Integración con el motor IA

### 14.1 Consultas que expone

| Dimensión | Notas |
|---|---|
| `categoria_presupuestada` | |
| `tipo_presupuesto` | presupuesto, límite, límite estricto |
| `periodo_presupuesto` | semanal, quincenal, mensual |
| `tramo_avance` | holgado, atención, cerca, superado |
| `tiene_traspaso` | sí/no |
| `origen_presupuesto` | manual, sugerido |
| `estado_meta` | activa, alcanzada, pausada |
| `meta_respaldada` | Si tiene caja vinculada |

| Medida | Notas |
|---|---|
| `gastado_en_presupuesto` | Con sus referencias |
| `restante` | Puede ser negativo |
| `porcentaje_avance` | |
| `total_presupuestado` | Del periodo |
| `desviacion_vs_periodo_anterior` | |
| `progreso_meta` | Saldo de la caja sobre el objetivo |

### 14.2 Comandos que acepta

| Comando | Confirmación |
|---|---|
| `crear_presupuesto` | Tarjeta con monto sugerido precargado |
| `editar_presupuesto` | Tarjeta |
| `ajustar_presupuesto` | Tarjeta |
| `pausar_presupuesto` / `archivar_presupuesto` | Tarjeta |
| `copiar_presupuestos_periodo_anterior` | **Masiva**: conteo y muestra |
| `aceptar_sugerencia_presupuesto` | Tarjeta con evidencia |
| `crear_meta` | Tarjeta |
| `vincular_caja_a_meta` | Tarjeta |
| `aportar_a_meta` | Tarjeta con efecto sobre el dinero libre |
| `activar_renovacion` / `desactivar_renovacion` | Tarjeta (`ACT-PRES-15`) |

### 14.3 Qué se puede pedir en lenguaje natural

```text
"pónme presupuesto de comida en 400"          → crear_presupuesto
"pónme presupuestos según lo que gasté"       → copiar/sugerir (masiva)
"¿cómo voy con mis presupuestos?"             → avance con referencias
"¿por qué voy sobre el de transporte?"        → detalle con los movimientos
"súbelo a 250"                                → ajustar_presupuesto
"quiero ahorrar 2000 para diciembre"          → crear_meta
"aparta 200 para el viaje"                    → aportar_a_meta
```

La segunda es una operación masiva legítima: genera un presupuesto por
categoría con historial suficiente, muestra el conjunto propuesto con sus
montos, y se confirma de una vez.

### 14.4 Lo que el motor NO puede hacer aquí

- **Recomendar reducir un gasto.** Puede decir que se superó y por qué; no
  que el usuario debería gastar menos (`22` §8).
- Crear un presupuesto sin confirmación.
- Comparar con otros usuarios o con promedios de mercado.
- Presentar el avance como logro o fracaso.

## 15. Memoria y aprendizaje

| Qué aprende | De dónde | Cómo se corrige |
|---|---|---|
| Sus montos habituales por categoría | Historial de gasto | — |
| Qué presupuestos ajusta al superar | Ajustes tras superar | — |
| Si prefiere presupuestos o límites | Tipos que elige | — |
| Su tolerancia a sugerencias | Aceptadas vs. rechazadas | Rechazando |

El segundo es una señal valiosa: alguien que ajusta el presupuesto cada vez
que lo supera está usando la herramienta como referencia flexible, y las
sugerencias futuras deben ser más generosas. Alguien que nunca lo ajusta lo
usa como límite real.

## 16. Eventos y telemetría

Eventos: `presupuesto.creado`, `.editado`, `.ajustado`, `.pausado`,
`.archivado`, `.copiado`, `.superado`, `.umbral_cruzado`,
`.sugerido_aceptado`, `.sugerido_rechazado`, `meta.creada`, `.vinculada`,
`.aporte`, `.alcanzada`, `.archivada`.

Sin montos. Sí categoría, tipo, tramo y `trace_id`.

Métricas clave:

| Métrica | Qué indica |
|---|---|
| Usuarios con al menos un presupuesto | Adopción del cuarto trabajo del producto |
| Tasa de aceptación de sugerencias | Calidad de la propuesta basada en historial |
| Presupuestos ajustados tras superar | **Señal buena**: el usuario los usa como referencia viva |
| Presupuestos archivados tras superar | **Señal de alarma**: el módulo puede estar generando culpa |
| Metas con caja vinculada | Cuántas tienen respaldo real |
| Retención de usuarios con presupuestos vs. sin ellos | Si el módulo aporta valor sostenido |

La cuarta fila es la métrica de salud del tono. Si la gente abandona sus
presupuestos justo después de superarlos, el lenguaje está fallando aunque
cumpla todas las reglas de §6.

## 17. Rendimiento

- Índices: `budgets (user_id, period_start desc, category_id)`,
  `budgets (user_id, status)`, `goals (user_id, status)`,
  `budget_progress_snapshots (budget_id, as_of desc)`.
- El avance del periodo actual se calcula agregando movimientos con índice
  por categoría y fecha; **una sola consulta para todos los presupuestos del
  periodo**, no una por presupuesto.
- Los snapshots los genera un trabajo diario, no una petición.
- El avance se invalida ante cualquier escritura de movimiento de una
  categoría presupuestada (`17` §2.3).
- Presupuesto: `/budgets` bajo 350 ms; `/budgets/summary` bajo 200 ms porque
  lo consume el Inicio.

## 18. Accesibilidad específica

- El avance se anuncia con valor y contexto: "Alimentación, 318 de 400 soles,
  80 por ciento".
- El tramo **no se comunica solo por color**: lleva texto y el porcentaje.
- Superado se anuncia como "superado por 30 soles", nunca como alerta
  sonora ni con rol `alert` — no es una emergencia.
- Las barras de progreso tienen `role="progressbar"` con sus valores.
- En modo discreto se anuncia el porcentaje, no el monto.

## 19. Casos borde

1. **Presupuesto creado a mitad de periodo.** Cuenta los movimientos de todo
   el periodo, no solo desde su creación. Se avisa al crearlo.
2. **Movimiento reclasificado a otra categoría.** Ambos presupuestos se
   recalculan.
3. **Movimiento eliminado y restaurado.** El avance baja y vuelve a subir.
4. **Presupuesto de una categoría sin ningún gasto.** Se muestra en 0% sin
   sugerir que "va bien"; simplemente no hay datos.
5. **Categoría archivada con presupuesto activo.** El presupuesto sigue; se
   avisa que esa categoría ya no se usa.
6. **Traspaso con sobrante negativo.** No se traspasa deuda: si se superó, el
   periodo siguiente empieza con el monto base.
7. **Dos periodos solapados por cambio de tipo.** Al cambiar de mensual a
   quincenal se archiva el mensual y se crean los quincenales del periodo
   restante, avisando.
8. **Meta con fecha imposible** (objetivo alto, fecha cercana). Se muestra el
   ritmo necesario como dato, sin decir que es imposible ni recomendar nada.
9. **Meta cuya caja se elimina.** Se desvincula; la meta queda sin respaldo y
   se avisa.
10. **Aporte a una meta sin caja.** Se ofrece crear la caja en el mismo paso.
11. **Usuario que supera el mismo presupuesto tres meses seguidos.** No se
    insiste ni se regaña. Se ofrece **una vez** ajustarlo con el monto real
    observado.
12. **Presupuesto general y por categoría a la vez.** Conviven: el general
    cuenta todo lo que cuenta, incluidos los movimientos sin categoría.

## 20. Criterios de aceptación

- `AC-PRES-01` — Un presupuesto no modifica el dinero libre ni ningún saldo.
  Evidencia: `TEST`.
- `AC-PRES-02` — De los once tipos de movimiento, solo `gasto`,
  `pago_recurrente` y `pago_deuda` (este último solo en categoría `deudas`)
  cuentan en un presupuesto. Los otros ocho, incluido `ingreso`, no.
  Evidencia: `TEST`.
- `AC-PRES-03` — Un pago de deuda cuenta solo en presupuestos de la categoría
  `deudas`. Evidencia: `TEST`.
- `AC-PRES-04` — Ningún tipo de presupuesto bloquea un gasto.
  Evidencia: `TEST`.
- `AC-PRES-05` — Cruzar un umbral avisa **una sola vez** por periodo. El
  ejemplo de siete pasos de `RUL-PRES-06` produce exactamente tres avisos, y
  `alerted_thresholds` termina en `{70,90,100}`. Evidencia: `TEST`.
- `AC-PRES-05b` — Bajar del umbral y volver a cruzarlo **no** vuelve a avisar,
  y editar el monto tampoco vacía `alerted_thresholds`. Evidencia: `TEST`.
- `AC-PRES-05c` — El tramo se muestra siempre según el avance actual, aunque no
  se haya emitido ningún aviso. Evidencia: `TEST` + `USER`.
- `AC-PRES-05d` — Renovar un periodo vacía `alerted_thresholds`.
  Evidencia: `TEST`.
- `AC-PRES-05e` — Con `auto_renew` apagado, el presupuesto se archiva al cerrar
  el periodo y **no** se crea uno nuevo. Evidencia: `TEST`.
- `AC-PRES-06` — Ningún copy usa las palabras prohibidas de §3 ni presenta el
  superado como fracaso. Evidencia: `TEST` + `USER`.
- `AC-PRES-07` — "Ajustar el presupuesto" aparece con la misma jerarquía que
  las demás salidas al superar. Evidencia: `USER`.
- `AC-PRES-08` — La sugerencia usa la **mediana** de al menos 2 periodos y
  muestra su evidencia. Evidencia: `TEST` + `USER`.
- `AC-PRES-09` — El traspaso está apagado por defecto y solo acumula del
  periodo inmediatamente anterior. Evidencia: `TEST`.
- `AC-PRES-10` — El avance devuelve las referencias de los movimientos que lo
  componen. Evidencia: `TEST`.
- `AC-PRES-11` — Una meta sin caja no muestra barra de progreso.
  Evidencia: `TEST` + `USER`.
- `AC-PRES-12` — El ritmo necesario de una meta se presenta como dato, nunca
  como exigencia. Evidencia: `USER`.
- `AC-PRES-13` — El motor no recomienda reducir gastos.
  Evidencia: `TEST` + `USER`.
- `AC-PRES-14` — El Inicio muestra como máximo tres presupuestos.
  Evidencia: `TEST`.
- `AC-PRES-15` — El avance de todos los presupuestos del periodo se calcula
  en una sola consulta. Evidencia: `CODE` + `TEST`.
- `AC-PRES-16` — El tramo no se comunica solo por color.
  Evidencia: `TEST`.
- `AC-PRES-17` — No existe ninguna comparación con otros usuarios ni con
  promedios de mercado. Evidencia: `TEST`.

## 21. Fuera de alcance y puente a WhatsApp

**Diferido a V1.1** (`07` §3.9): base cero, reasignación entre categorías
dentro del periodo, presupuestos por subcategoría, aportes programados a
metas, alineación del periodo con el día de cobro (límite conocido de
`RUL-PRES-09`), metas colaborativas.

**Fuera de V1 sin fecha:** presupuestos compartidos o por grupo. No es lo
mismo que las metas colaborativas de V1.1: una meta compartida es un objetivo
que dos personas miran, mientras que un presupuesto compartido exige decidir
de quién es cada gasto, y eso es un producto distinto.

**Prohibido, no diferido:** bloqueo de gastos, gamificación, comparación
social, recomendación de recortes.

Puente a WhatsApp: las consultas de avance funcionan igual en conversación
(*"¿cómo voy con mis presupuestos?"*). El aviso al superar será candidato a
mensaje proactivo en la fase 2, sujeto a la política de fatiga del módulo 37
— y con especial cuidado, porque un aviso de presupuesto superado que llega
sin que lo pidas es exactamente donde el tono puede convertirse en presión.

## 22. Trazabilidad

**Documentos de `docs/` consumidos:** ninguno como especificación. `05c` §20
y `docs/fase_4_tecnica/20_decisiones_tecnicas.md` F4-D024 se citan como
**antítesis**: ambos dejaban metas y presupuestos fuera de V1 por no tener
documento propio. Este es ese documento.

Se hereda el principio de cero culpa de
`docs/fase_3_producto/10_principios_experiencia.md` §3 y el lenguaje de
`docs/fase_3_producto/12_lenguaje_producto.md`.

**Contradicciones que cierra:** ninguna de las 17. Cierra una brecha
documental heredada: `docs/fase_2_estrategia/alcance_v1/indice.md` §11 listaba
"Metas/límites — documento propio si se decide convertirlo en feature
formal", pendiente desde mayo de 2026.

**Decisiones tomadas en este documento**, registradas en
`03_decisiones_producto_web.md`:

| Decisión | ID | Alternativa descartada | Razón |
|---|---|---|---|
| Un presupuesto no reserva dinero | `WEB-D030` | Reservar como una caja | Reservar convierte el presupuesto en caja y borra la distinción entre planear y apartar |
| Ningún tipo bloquea gastos | `WEB-D031` | Límite duro que bloquea | Impedirlo trataría al usuario como si no supiera lo que hace con su dinero |
| Tramo permanente, aviso una sola vez | `WEB-D032` | Un solo concepto de "alerta" | Confundirlos convierte el resto del mes en notificaciones de fracaso, o hace desaparecer el estado de la pantalla |
| Sugerencia por mediana de ≥2 periodos | `WEB-D033` | Promedio, o sugerir desde el primer periodo | Un mes atípico desplaza el promedio y produce un presupuesto que no representa el hábito |
| Traspaso apagado, renovación encendida | `WEB-D034` | Ambos iguales | Renovar preserva la expectativa del usuario; traspasar cambia qué significa el número del mes siguiente |
| "Ajustar el presupuesto" con la misma jerarquía | `WEB-D035` | Salida secundaria | Un presupuesto mal calibrado se corrige, no se sufre |

**Corrección de auditoría, 26 de julio de 2026.** Una revisión externa
encontró nueve defectos en la primera versión de este documento. Los cambios:
se separó el tramo del aviso (§5.2, `RUL-PRES-06`), se añadieron las columnas
`auto_renew` y `alerted_thresholds` que sostenían reglas sin respaldo, se
alineó el alcance del único con `13` §7.1, se completó `RUL-PRES-02` con
`ingreso`, se cuadró la aritmética del mockup de `SCR-PRES-01`, se eliminó la
ruta alternativa `/metas/[id]`, se sincronizaron los índices con `13` §11 y se
amplió `07` §3.9 con lo que este documento añadió a IN.
