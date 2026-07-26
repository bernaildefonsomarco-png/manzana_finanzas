# 33 — Módulo: Proyecciones y simulación

**ID de módulo:** `MOD-PROYECCIONES`
**Bloque:** 04 — Módulos
**Estado:** V1
**Fecha:** 26 de julio de 2026
**Docs fuente:** ninguno — **módulo nuevo**. Se apoya en `09_modelo_mental_dinero.md`, `24` (dinero libre), `30` (compromisos), `31` (deudas), `32` (presupuestos), y muy especialmente `22_grounding_evidencia_y_politica.md` §8 (límite de consejo financiero)
**Documentos que dependen de este:** `34` (descubrimientos), `39` (home), `41` (asistente)

---

## 1. Tesis y qué NO es

Todos los módulos anteriores miran hacia atrás. Este mira hacia adelante, y
responde la pregunta que la gente hace de verdad antes de gastar:

```text
¿Puedo permitirme esto?
```

Nadie abre una app de finanzas para admirar sus gráficos. La abre porque va a
tomar una decisión y quiere saber si le alcanza. Este módulo convierte los
datos de todos los demás en una respuesta a esa pregunta.

**El límite que gobierna el módulo, y que hay que tener presente en cada
línea de copy:**

> Describir la situación y sus consecuencias aritméticas es **información**.
> Decirle a alguien qué hacer con su dinero es **consejo financiero**, y está
> prohibido (`22` §8).

La frontera es fina y se cruza sin querer. "Con lo que tienes, comprarlo te
dejaría S/70 libres" es información. "Mejor no lo compres" es consejo. La
primera respeta que la decisión es del usuario; la segunda se la quita.

**Qué NO es:**

- No es un oráculo. Una proyección es aritmética con supuestos, y los
  supuestos se declaran siempre.
- No es asesoría de inversión. Ni de refinanciamiento, ni de productos, ni de
  bancos.
- No predice ingresos que el usuario no declaró.
- No da un veredicto. Nunca dice "no te alcanza" como juicio: dice cuánto te
  quedaría.
- No es un score. La salud financiera se describe, no se puntúa.

## 2. Alcance

| Nivel | Funcionalidad |
|---|---|
| **IN V1-web** | Proyección de cierre de periodo a partir del ritmo actual y los compromisos conocidos. **"¿Puedo permitirme X?"** con respuesta fundamentada. Simulación de un gasto puntual sobre el dinero libre. Descripción de salud financiera con sus componentes visibles, sin puntuación. **Todo supuesto declarado junto a la cifra.** Rango en vez de número único cuando la incertidumbre lo justifica. |
| **V1.1** | Escenarios guardados y comparables. Proyección a 3 y 6 meses. Simulación de cambio de ingreso. Simulación de un gasto recurrente nuevo. |
| **FUERA** | Asesoría de inversión de cualquier tipo. Recomendación de productos financieros o bancos. Recomendación de orden de pago de deudas. Predicción de ingresos no declarados. Score numérico de salud financiera. |

## 3. Vocabulario

| Interno | Visible | Regla |
|---|---|---|
| `Projection` | Proyección | "A este ritmo…" |
| `Simulation` | Simulación | "Si gastas…" |
| `affordability_check` | ¿Puedo permitírmelo? | |
| `financial_health` | Cómo vas / Tu situación | **Nunca "salud financiera: 72"** |
| `assumptions` | Lo que estoy contando | Siempre visible |
| `confidence_band` | Aproximado / Entre X e Y | Nunca un porcentaje de confianza |

Palabras prohibidas en este módulo: *deberías*, *te conviene*, *mejor*,
*recomiendo*, *no te alcanza*, *riesgo*, *peligro*, *malo*.

## 4. Entidades y datos

### 4.1 Lo que NO se persiste

**Las proyecciones de uso corriente no se guardan.** Se calculan al vuelo a
partir de movimientos, compromisos y presupuestos.

Razón: una proyección persistida queda obsoleta en cuanto el usuario registra
un movimiento. Mostrar una proyección guardada de ayer sería mostrar una
cifra falsa con apariencia de dato.

### 4.2 `simulation_scenarios` — solo escenarios guardados (V1.1)

```sql
id            uuid pk
user_id       uuid not null
name          text not null
assumptions   jsonb not null
horizon_days  integer not null
result        jsonb not null
created_at, updated_at, deleted_at
```

`assumptions` es obligatorio, no opcional: un escenario sin sus supuestos
guardados no se puede reinterpretar después, y mostrar su resultado sería
mostrar un número sin significado.

La funcionalidad de guardar escenarios es **V1.1**; la tabla está diseñada en
`13_modelo_datos_web_v1.md` §7.3 y su migración `050` no se aplica hasta
entonces.

### 4.3 De dónde salen los datos

Este módulo **no tiene datos propios**. Todo viene de otros:

| Fuente | Qué aporta |
|---|---|
| `24` Cuentas y cajas | Dinero libre, libre en cuentas, saldos |
| `26` Movimientos | Ritmo de gasto real del periodo |
| `30` Pagos que vienen | Compromisos del horizonte |
| `31` Deudas | Cuotas próximas |
| `32` Presupuestos | Lo que el usuario planeó |
| `20c` Perfil | Cuándo cobra, periodos declarados |

Consecuencia: **cada cifra proyectada hereda las referencias de evidencia de
sus fuentes** (`22` §2).

## 5. Máquina de estados

No aplica. Este módulo no tiene entidades con ciclo de vida propio en V1:
calcula sobre el estado de otros. Los escenarios guardados de V1.1 tendrán
estados `activo` y `archivado`.

## 6. Reglas de negocio

**`RUL-PROY-01` — Todo supuesto se declara junto a la cifra**

No en un tooltip, no en una nota al pie: **en el mismo bloque visual**.

```text
Correcto:
  A este ritmo terminarías julio con unos S/180 libres.
  Cuento tus 3 pagos que vienen (S/428) y tu ritmo de las últimas
  2 semanas (S/62 al día).
  [Ver el detalle]

Incorrecto:
  Terminarás el mes con S/180.
```

La versión incorrecta afirma un futuro. La correcta describe una aritmética
con sus entradas visibles, y el usuario puede juzgar si los supuestos le
parecen razonables.

**`RUL-PROY-02` — Proyección de cierre de periodo**

```text
proyeccion_cierre =
    dinero_libre_actual
  − compromisos_pendientes_del_periodo_no_cubiertos
  − (ritmo_diario × dias_restantes_del_periodo)
```

Donde:

| Componente | Cómo se calcula |
|---|---|
| `dinero_libre_actual` | `RUL-CUENTAS-03` |
| `compromisos_pendientes` | Del módulo 30, sin doble descuento por cajas |
| `ritmo_diario` | **Mediana** del gasto diario de los últimos 14 días con actividad |
| `dias_restantes` | Hasta el fin del periodo, en `America/Lima` |

Ejemplo completo:

```text
Hoy es 26 de julio.
Dinero libre: S/560.00
Compromisos pendientes de julio no cubiertos: S/89.00 (internet, 28 jul)
Ritmo: mediana de los últimos 14 días = S/62.00 al día
Días restantes: 5

proyección = 560.00 − 89.00 − (62.00 × 5) = S/161.00
```

Se usa **mediana y no promedio** por la misma razón que en presupuestos: un
día atípico (una compra grande) distorsiona el promedio y produce una
proyección que no representa el ritmo real.

**`RUL-PROY-03` — Rango cuando la incertidumbre lo justifica**

Si el ritmo diario tiene alta dispersión, se muestra un rango en vez de un
número:

```text
Terminarías julio con algo entre S/120 y S/240.
Tu gasto diario varía bastante estas semanas.
```

Umbral: si el rango intercuartílico del gasto diario supera el 50% de la
mediana, se muestra rango. Un número único sobre datos muy dispersos es
falsa precisión.

**`RUL-PROY-04` — Datos insuficientes: se dice, no se estima**

| Situación | Qué se muestra |
|---|---|
| Menos de 7 días con movimientos en el periodo | No se proyecta. "Con unos días más de movimientos puedo decirte cómo vendría el cierre del mes." |
| Sin cuentas con saldo | No se proyecta. Se ofrece agregar saldo |
| Sin compromisos conocidos | Se proyecta solo con el ritmo, **y se dice** que no hay compromisos contados |

Nunca se rellena un hueco con una estimación silenciosa (`22` §2.1).

**`RUL-PROY-05` — "¿Puedo permitirme X?"**

La respuesta tiene tres partes obligatorias, en este orden:

```text
1. El efecto aritmético    "Comprarlo te dejaría S/260 libres."
2. Lo que hay contado      "Cuento tus 3 pagos de este mes (S/428)."
3. Lo que queda por venir  "Después de esos pagos, te quedarían S/171."
```

Y una prohibición: **no se emite un veredicto.** Nunca "sí puedes" ni "no te
alcanza". Se dan los números y la decisión es del usuario.

Ejemplo completo:

```text
Usuario: "¿puedo permitirme unas zapatillas de 300?"

Ahora tienes S/560 libres.
Si gastas S/300, te quedarían S/260.
Este mes te quedan por pagar S/428 en compromisos, y S/89 de eso
no está apartado en ninguna caja.
Después de todo eso, te quedarían unos S/171.
[Ver el desglose]  [Registrar el gasto]
```

Nótese que la respuesta **no dice si le alcanza**. Dice cuánto le quedaría.

**`RUL-PROY-06` — Simulación no escribe nada**

Simular un gasto no crea ningún movimiento ni modifica ningún saldo. Es un
cálculo efímero. Si el usuario decide gastarlo, hay una acción explícita de
registrar.

**`RUL-PROY-07` — Salud financiera se describe, no se puntúa**

Prohibido un número o una letra. Se describen **componentes observables**,
cada uno con su dato:

| Componente | Cómo se describe |
|---|---|
| Cobertura de compromisos | "Tus compromisos de este mes están cubiertos" o "te faltan S/89 para cubrirlos" |
| Relación gasto/ingreso | "Este mes llevas gastado el 78% de lo que te entró" |
| Reserva | "Tienes S/500 apartados en cajas" o "no tienes dinero apartado" |
| Deudas al día | "Tus 3 cuotas están al día" o "tienes 1 cuota pendiente desde el 22" |

Y un resumen en **lenguaje de situación, no de valor**:

```text
Correcto:   Este mes: cubres tus compromisos y te queda margen.
Correcto:   Este mes: tus compromisos se llevan casi todo lo que te queda.
Incorrecto: Tu salud financiera es MALA.
Incorrecto: Salud financiera: 42/100.
```

La diferencia: el correcto describe una situación del mes; el incorrecto
emite un juicio sobre la persona.

**`RUL-PROY-08` — Sin comparación con nadie**

No se compara con otros usuarios, con promedios de mercado, ni con
"lo recomendado". El único punto de comparación válido es **el propio pasado
del usuario**.

**`RUL-PROY-09` — El horizonte por defecto es el periodo actual**

Coherente con `RUL-CUENTAS-05` (30 días) y con los periodos de presupuesto.
Proyecciones a más largo plazo son V1.1.

**`RUL-PROY-10` — Los ingresos futuros solo se cuentan si son conocidos**

Un ingreso se cuenta en la proyección solo si:

- es un recurrente activo de tipo ingreso, o
- el usuario declaró en su perfil cuándo cobra y con qué regularidad
  (`20c` §2.2).

**Nunca se infiere un sueldo futuro solo porque hubo ingresos regulares en el
pasado.** Si el sistema lo sospecha, lo pregunta y lo confirma antes de
contarlo (`WEB-D023`).

Esta regla evita el fallo más peligroso del módulo: proyectar que a alguien
le va a entrar dinero que quizá no entre.

**`RUL-PROY-11` — Toda proyección es reproducible**

Dado el mismo estado de datos, la misma proyección debe dar el mismo
resultado. Se calcula con reglas determinísticas, **nunca por el modelo**.

El modelo puede explicar una proyección y ponerla en palabras; no la calcula.

## 7. Validaciones

| Elemento | Regla |
|---|---|
| Monto a simular | Mayor que 0, máximo 14 dígitos con 2 decimales |
| Horizonte | Entre 1 y 90 días en V1 |
| Categoría de la simulación | Opcional; si se indica, afecta también al presupuesto de esa categoría |
| Fecha de la simulación | Entre hoy y el fin del horizonte |

## 8. Superficies

### `SCR-PROY-01` — Proyecciones

**Ruta:** `/proyecciones`

```text
┌──────────────────────────────────────────────────┐
│ Cómo vas                             julio 2026  │
├──────────────────────────────────────────────────┤
│ A este ritmo terminarías el mes con              │
│                                                  │
│      S/161                                       │
│                                                  │
│ Cuento tus S/89 de compromisos pendientes y tu   │
│ ritmo de las últimas 2 semanas (S/62 al día).    │
│ [Ver el detalle]                                 │
├──────────────────────────────────────────────────┤
│ Este mes                                         │
│ ✓ Tus compromisos están cubiertos, salvo S/89    │
│ · Llevas gastado el 78% de lo que te entró       │
│ ✓ Tienes S/500 apartados en cajas                │
│ ✓ Tus 3 cuotas están al día                      │
├──────────────────────────────────────────────────┤
│ ¿Puedo permitirme…?                              │
│ [S/         ]  [en qué]        [Calcular]        │
└──────────────────────────────────────────────────┘
```

Detalles que importan:

- Los supuestos están **debajo de la cifra, en el mismo bloque**, no
  escondidos.
- Los cuatro componentes de situación se muestran como hechos con su dato,
  sin puntuación ni etiqueta de valor.
- El simulador está en la misma pantalla porque es la pregunta que la gente
  viene a hacer.

### `SCR-PROY-02` — Detalle de la proyección

Panel. Muestra la aritmética completa, línea por línea, con enlace a los
movimientos y compromisos que la componen:

```text
Dinero libre hoy                    S/560.00   [ver desglose]
− Compromisos de julio sin cubrir   − S/89.00  [ver cuáles]
− Ritmo estimado (5 días × S/62)    − S/310.00 [ver los 14 días]
────────────────────────────────────────────
= Proyección de cierre               S/161.00
```

Es la materialización del principio de procedencia: cada línea es navegable
hasta sus datos.

### `SCR-PROY-03` — Simulador

Modal o sección. Pide monto y opcionalmente en qué y cuándo. Devuelve la
respuesta de tres partes de `RUL-PROY-05`, con las acciones de registrar el
gasto o cerrar.

### `SCR-PROY-04` — Cómo vas, en el Inicio

Componente compacto. Una línea con la proyección y su supuesto principal.
Solo aparece si hay datos suficientes (`RUL-PROY-04`).

## 9. Acciones

| ID | Acción | ¿Confirma? | Deshacer | Evento |
|---|---|---|---|---|
| `ACT-PROY-01` | Ver proyección de cierre | No | — | `proyeccion.vista` |
| `ACT-PROY-02` | Ver el detalle de la aritmética | No | — | `proyeccion.detalle_consultado` |
| `ACT-PROY-03` | Simular un gasto | No | — | `simulacion.ejecutada` |
| `ACT-PROY-04` | Registrar el gasto simulado | Sí | Eliminando el movimiento | `movimiento.creado` |
| `ACT-PROY-05` | Ver situación del mes | No | — | `situacion.consultada` |
| `ACT-PROY-06` | Ver de dónde sale un componente | No | — | `evidencia.consultada` |

Solo `ACT-PROY-04` escribe, y lo hace por el módulo 26 con sus reglas
normales. Las demás son de lectura.

## 10. API

| Método y ruta | Notas |
|---|---|
| `GET /projections/period` | Proyección de cierre con supuestos y referencias |
| `GET /projections/health` | Los cuatro componentes de situación con su dato |
| `POST /simulate` | **Solo lectura, no escribe.** Body: `{ amount, category_id?, date? }` |
| `GET /projections/period/breakdown` | La aritmética línea por línea con referencias |

Los cuatro son **endpoints de solo lectura sin excepción** (`14` §13). Si una
consulta natural expresa intención de gastar, se devuelve el enlace al flujo
de registro, no se ejecuta.

Respuesta de `GET /projections/period`:

```jsonc
{
  "projection": "161.00",
  "range": null,                       // o { "min": "120.00", "max": "240.00" }
  "assumptions": [
    { "kind": "compromisos", "amount": "89.00", "refs": ["rec_123"] },
    { "kind": "ritmo_diario", "amount": "62.00", "basis": "mediana_14d",
      "refs": ["mov_1", "mov_2", "..."] },
    { "kind": "dias_restantes", "value": 5 }
  ],
  "sufficient_data": true
}
```

`assumptions` no es opcional. Una respuesta sin supuestos declarados es un
defecto que el verificador rechaza (`22` §2).

## 11. Permisos y RLS

- Cliente autenticado. **Sin excepciones de service-role.**
- Sin tablas propias en V1; la RLS aplica en las de origen.
- Ninguna ruta de este módulo escribe.

## 12. Estados de datos

| Estado | Qué se muestra |
|---|---|
| **Sin cuentas con saldo** | "Para decirte cómo vendría el cierre del mes necesito saber cuánto tienes." + agregar saldo |
| **Menos de 7 días con movimientos** | "Con unos días más de movimientos puedo decirte cómo vendría el cierre." Sin estimar |
| **Con datos, sin compromisos** | Proyección solo por ritmo, declarando que no hay compromisos contados |
| **Alta dispersión del gasto** | Rango en vez de número (`RUL-PROY-03`) |
| **Periodo recién empezado** | Proyección con aviso de que el ritmo se basa en pocos días |
| **Cargando** | Esqueleto con la forma del bloque |
| **Error** | Mensaje en español con reintento; **nunca una proyección aproximada de respaldo** |
| **Modo discreto** | La situación se muestra sin montos: "cubres tus compromisos" sin las cifras |

La fila de error importa: ante un fallo **no se muestra una proyección
degradada**. Se dice que no se pudo calcular.

## 13. Errores

| ID | Causa | Mensaje visible | Salida |
|---|---|---|---|
| `ERR-PROY-01` | Datos insuficientes | "Todavía no tengo suficientes movimientos para proyectar el mes." | Registrar movimientos |
| `ERR-PROY-02` | Sin saldos | "Necesito saber cuánto tienes para poder proyectar." | Agregar cuenta o saldo |
| `ERR-PROY-03` | Monto de simulación inválido | "El monto tiene que ser mayor que cero." | Corregir |
| `ERR-PROY-04` | Horizonte fuera de rango | "Puedo proyectar hasta 90 días." | Corregir |
| `ERR-PROY-05` | Fallo de cálculo | "No pude calcular la proyección ahora." | Reintentar |
| `ERR-PROY-06` | Fecha de simulación pasada | "Esa fecha ya pasó. ¿Quieres registrarlo como movimiento?" | Ir a registrar |

## 14. Integración con el motor IA

### 14.1 Consultas que expone

| Dimensión | Notas |
|---|---|
| `horizonte` | Días hasta el fin del periodo |
| `tiene_datos_suficientes` | sí/no |
| `dispersion_gasto` | Baja, media, alta — determina si se muestra rango |
| `componente_situacion` | cobertura, gasto/ingreso, reserva, deudas |

| Medida | Notas |
|---|---|
| `proyeccion_cierre` | Con sus supuestos obligatorios |
| `ritmo_diario` | Mediana de 14 días |
| `compromisos_restantes` | Del periodo |
| `impacto_simulado` | Efecto de un gasto hipotético |

**Regla del compilador:** ninguna medida de este módulo se devuelve sin su
`assumptions`. Es la única familia de consultas donde los supuestos son parte
obligatoria de la respuesta, porque son las únicas que hablan del futuro.

### 14.2 Comandos que acepta

**Ninguno.** Este módulo es de solo lectura. La única escritura relacionada
—registrar el gasto que se simuló— es `crear_movimiento` del módulo 26.

Es el único módulo del corpus sin comandos, y es deliberado: **proyectar
nunca debe poder cambiar nada.**

### 14.3 Qué se puede pedir en lenguaje natural

```text
"¿puedo permitirme unas zapatillas de 300?"   → simulación, respuesta de 3 partes
"¿cómo voy este mes?"                          → proyección + situación
"¿me alcanza hasta fin de mes?"                → proyección con compromisos
"¿qué pasa si gasto 500 esta semana?"          → simulación
"¿por qué dices que terminaría con 161?"       → detalle de la aritmética
"¿estoy gastando más de lo que gano?"          → componente gasto/ingreso
```

La quinta es la que valida todo el módulo: si el motor no puede desglosar su
propia proyección línea por línea, la proyección no debería haberse emitido.

### 14.4 Lo que el motor NO puede hacer aquí

Esta lista es más importante que la de capacidades:

- **Emitir un veredicto** sobre si el usuario puede o no permitirse algo.
- **Recomendar** gastar menos, ahorrar más, pagar una deuda antes que otra, o
  cualquier acción sobre el dinero.
- Recomendar productos financieros, bancos o inversiones.
- Proyectar ingresos que el usuario no declaró ni confirmó.
- Dar una proyección sin declarar sus supuestos.
- Presentar la situación como un juicio sobre la persona.
- Comparar al usuario con nadie.

## 15. Memoria y aprendizaje

| Qué aprende | De dónde | Cómo se corrige |
|---|---|---|
| Su ritmo de gasto habitual | Movimientos | — |
| Su variabilidad típica | Dispersión histórica | — |
| Cuándo y cuánto cobra | **Perfil, confirmado por el usuario** | En `/configuracion/memoria` |
| Qué simula habitualmente | Simulaciones ejecutadas | — |

El tercero es el más importante y el más delicado: **solo se usa si el
usuario lo confirmó** (`RUL-PROY-10`). Un ingreso inferido y no confirmado no
entra en ninguna proyección.

## 16. Eventos y telemetría

Eventos: `proyeccion.vista`, `.detalle_consultado`, `.datos_insuficientes`,
`simulacion.ejecutada`, `simulacion.convertida_en_gasto`,
`situacion.consultada`, `evidencia.consultada`.

Sin montos. Sí horizonte, si hubo datos suficientes, y `trace_id`.

Métricas:

| Métrica | Qué indica |
|---|---|
| Simulaciones por usuario activo | Si el módulo resuelve una pregunta real |
| Proporción que termina en gasto registrado | Si la simulación ayuda a decidir |
| Consultas del detalle de la proyección | Confianza: si la gente verifica, es que le importa |
| Proyecciones no emitidas por datos insuficientes | Cuánto tarda un usuario en poder usar el módulo |
| Días desde el registro hasta la primera proyección | Tiempo hasta este valor |

La cuarta y la quinta son las que dirán si el umbral de 7 días es el correcto
o si hay que ajustarlo.

## 17. Rendimiento

- La proyección se calcula en el servidor con **una sola consulta agregada**
  sobre movimientos, más los compromisos ya resueltos por `GET /upcoming`.
- El ritmo diario usa el índice `movements (user_id, occurred_at desc)`.
- Se cachea por usuario durante 5 minutos y se invalida ante cualquier
  escritura financiera.
- La simulación es aritmética sobre datos ya cargados: **no consulta nada
  nuevo**.
- Presupuesto: `/projections/period` bajo 300 ms porque lo consume el Inicio;
  `/simulate` bajo 150 ms.

## 18. Accesibilidad específica

- La proyección se anuncia con su supuesto principal, no sola: "A este ritmo
  terminarías el mes con 161 soles, contando 89 de compromisos".
- Un rango se anuncia como rango: "entre 120 y 240 soles".
- Los componentes de situación son una lista con texto, sin depender de
  iconos de check.
- El detalle de la aritmética es una tabla accesible con encabezados.
- En modo discreto se anuncian los hechos sin cifras.

## 19. Casos borde

1. **Usuario con un solo día de movimientos.** No se proyecta
   (`RUL-PROY-04`).
2. **Gasto muy alto un solo día** (una compra grande). La mediana lo absorbe;
   el promedio no lo habría hecho.
3. **Periodo que empieza mañana.** Se proyecta el periodo actual hasta su
   fin, no el siguiente.
4. **Compromiso vencido dentro del periodo.** Sigue contando: el dinero se
   sigue debiendo.
5. **Dinero libre negativo.** Se proyecta igual, con el número negativo y sin
   dramatizar: "terminarías el mes con S/-40".
6. **Simulación mayor que el dinero libre.** Se muestra el resultado
   negativo, **sin veredicto**: "te quedarían S/-140".
7. **Usuario que cobra mañana pero no lo declaró.** El ingreso no se cuenta.
   Si el sistema lo sospecha por el patrón, lo pregunta antes de contarlo
   (`RUL-PROY-10`).
8. **Todos los compromisos cubiertos por cajas.** La proyección solo resta el
   ritmo, y se dice que los compromisos están cubiertos.
9. **Cambio de mes durante la sesión.** La proyección se recalcula sobre el
   periodo nuevo; se avisa del cambio de contexto.
10. **Presupuestos que ya se superaron.** No afectan la proyección: un
    presupuesto no reserva dinero (`RUL-PRES-01`). Se puede mencionar como
    contexto, no como resta.
11. **Simulación de un gasto en una categoría con presupuesto.** Se muestra
    también el efecto sobre ese presupuesto, como dato adicional.
12. **Fallo del cálculo.** No se muestra una proyección aproximada de
    respaldo: se dice que no se pudo calcular.

## 20. Criterios de aceptación

- `AC-PROY-01` — Ninguna proyección se emite sin declarar sus supuestos en el
  mismo bloque visual. Evidencia: `TEST` + `USER`.
- `AC-PROY-02` — El ejemplo de `RUL-PROY-02` produce exactamente S/161.00.
  Evidencia: `TEST`.
- `AC-PROY-03` — El ritmo diario usa mediana, no promedio.
  Evidencia: `TEST`.
- `AC-PROY-04` — Con alta dispersión se muestra rango en vez de número único.
  Evidencia: `TEST`.
- `AC-PROY-05` — Con menos de 7 días de movimientos no se proyecta y se dice
  por qué. Evidencia: `TEST` + `USER`.
- `AC-PROY-06` — La respuesta a "¿puedo permitirme X?" **no contiene
  veredicto**. Evidencia: `TEST` + `USER`.
- `AC-PROY-07` — Simular no crea ningún movimiento ni modifica ningún saldo.
  Evidencia: `TEST`.
- `AC-PROY-08` — No existe puntuación ni letra de salud financiera en ninguna
  superficie. Evidencia: `TEST`.
- `AC-PROY-09` — No se cuenta ningún ingreso futuro que el usuario no haya
  declarado o confirmado. Evidencia: `TEST`.
- `AC-PROY-10` — La proyección es reproducible: el mismo estado de datos da
  el mismo resultado. Evidencia: `TEST`.
- `AC-PROY-11` — La proyección la calculan reglas determinísticas, nunca el
  modelo. Evidencia: `CODE` + `TEST`.
- `AC-PROY-12` — El detalle desglosa la aritmética línea por línea con
  referencias navegables. Evidencia: `TEST` + `USER`.
- `AC-PROY-13` — Ningún copy de este módulo usa las palabras prohibidas de
  §3. Evidencia: `TEST`.
- `AC-PROY-14` — Este módulo no expone ningún comando de escritura.
  Evidencia: `TEST`.
- `AC-PROY-15` — Ante fallo de cálculo no se muestra una proyección
  aproximada de respaldo. Evidencia: `TEST`.
- `AC-PROY-16` — No existe comparación con otros usuarios ni con promedios
  externos. Evidencia: `TEST`.
- `AC-PROY-17` — Un dinero libre negativo se proyecta sin dramatizar.
  Evidencia: `USER`.

## 21. Fuera de alcance y puente a WhatsApp

Diferido a V1.1: escenarios guardados, proyección a 3 y 6 meses, simulación
de cambio de ingreso, simulación de gasto recurrente nuevo.

**Prohibido, no diferido:** asesoría de inversión, recomendación de
productos, recomendación de orden de pago de deudas, score de salud
financiera, predicción de ingresos no declarados, veredictos sobre si el
usuario puede permitirse algo.

Puente a WhatsApp: *"¿puedo permitirme X?"* es probablemente **la consulta
más natural de todo el producto en conversación**, y funcionará sin cambios:
la respuesta de tres partes es texto por naturaleza. El detalle de la
aritmética se presentará como lista en vez de tabla.

## 22. Trazabilidad

**Documentos de `docs/` consumidos:** ninguno como especificación. `05c` §20
excluía las proyecciones de V1; `WEB-D002` las incorpora.

Se hereda el límite de consejo financiero de
`especificacion_producto_finanzas_personales_ia.md` §24 (fuera de alcance:
asesoría tributaria, recomendación de bancos o productos financieros), que se
formaliza aquí como regla verificable.

**Contradicciones que cierra:** ninguna de las 17.

**Decisiones tomadas en este documento**, sujetas a revisión del usuario:

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Sin veredicto en "¿puedo permitírmelo?" | Responder sí o no | Un veredicto le quita la decisión al usuario, y el sistema no conoce su contexto completo |
| Salud descrita por componentes, sin puntuar | Score numérico o letra | Un número desnudo es falsa precisión y un juicio sobre la persona |
| Mediana para el ritmo | Promedio | Un día atípico distorsiona el promedio y produce proyecciones que no representan el hábito |
| Rango con alta dispersión | Número único siempre | Un número exacto sobre datos dispersos es falsa precisión |
| Umbral de 7 días para proyectar | Proyectar desde el primer día | Proyectar con dos movimientos produce cifras sin base que erosionan la confianza |
| Sin comandos de escritura | Permitir registrar desde el simulador | Proyectar nunca debe poder cambiar nada; registrar es una acción aparte y explícita |
