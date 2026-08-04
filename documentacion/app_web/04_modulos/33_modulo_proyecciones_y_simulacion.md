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
`13_modelo_datos_web_v1.md` §7.3 y su migración queda **diferida, sin número
reservado**: el número preliminar `050` ya pertenece a una migración ejecutada
(`WEB-D218`). Se documenta pero no se aplica en V1-web. Mismo criterio que la
importación (`WEB-D026`): una tabla vacía que nada lee ni escribe es esquema
muerto, y el diseño ya está conservado por escrito, que es lo que evita
cerrarle la puerta al modelo.

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
  − (ritmo_diario × dias_restantes_del_periodo)
```

Donde:

| Componente | Cómo se calcula |
|---|---|
| `dinero_libre_actual` | `RUL-CUENTAS-03` |
| `ritmo_diario` | **Mediana** de hasta los últimos 14 días civiles observables del periodo, incluidos los días con gasto cero, **excluyendo los movimientos ligados a compromisos** (`WEB-D224`) |
| `dias_restantes` | Hasta el fin del periodo, en `America/Lima` |

**Los compromisos no se restan aquí.** Ya están descontados dentro de
`dinero_libre_actual`: `RUL-CUENTAS-03` es
`libre_en_cuentas − compromisos_próximos_no_cubiertos_por_caja`. Restarlos otra
vez sería el doble descuento que `RUL-CUENTAS-04` señala como el error más
fácil de cometer y el más difícil de ver en pantalla, y que
`09_modelo_mental_dinero.md` §3 regla 2 prohíbe por nombre.

Los compromisos **sí aparecen en el texto**, pero como declaración de lo que ya
está contado, nunca como una segunda resta. Es lo que exige `RUL-PROY-01`:
el supuesto se declara, y aquí el supuesto es *"esta cifra ya descuenta tus
compromisos"*.

Ejemplo completo:

```text
Hoy es 26 de julio.
Dinero libre: S/560.00
  (ya descuenta S/89.00 de internet, 28 jul, que no está apartado en caja)
Ritmo: mediana de los últimos 14 días = S/62.00 al día
Días restantes: 5

proyección = 560.00 − (62.00 × 5) = S/250.00
```

**El segundo doble descuento, y por qué el ritmo excluye compromisos.** Un pago
recurrente o una cuota que cayó dentro de los últimos 14 días entra en el gasto
diario observado. Si además se proyecta hacia adelante como parte del ritmo, se
está contando dos veces el mismo tipo de salida: una en el ritmo y otra en el
dinero libre. La mediana lo amortigua —un pago mensual afecta como mucho 1 de
14 días y no mueve la mediana— pero eso es una casualidad estructural, no una
garantía: quien implemente el ritmo con un promedio móvil reintroduce el error.
Por eso **la exclusión es parte de la regla, no una optimización**: el ritmo
mide el gasto corriente, y los compromisos ya viven en el otro término.

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
mediana, se muestra rango. Los días son civiles Lima e incluyen cero cuando
no hubo gasto; mediana y cuartiles usan interpolación lineal en céntimos. El
rango proyecta Q3 como extremo inferior y Q1 como superior, según
`WEB-D224`. Un número único sobre datos muy dispersos es falsa precisión.

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
1. El efecto inmediato     "Comprarlo te dejaría S/260 libres."
2. Lo que ya está contado  "Esos S/560 ya descuentan los S/89 que aún no
                            tienes apartados."
3. Cómo quedaría el cierre "A tu ritmo, cerrarías julio con unos S/-50."
```

La tercera parte aplica `RUL-PROY-02` con la compra ya dentro. **No se restan
los compromisos otra vez**: la parte 2 los declara porque ya viven en la cifra
de la parte 1.

Y una prohibición: **no se emite un veredicto.** Nunca "sí puedes" ni "no te
alcanza". Se dan los números y la decisión es del usuario.

Ejemplo completo:

```text
Usuario: "¿puedo permitirme unas zapatillas de 300?"

Ahora tienes S/560 libres. Si gastas S/300, te quedarían S/260.
Esos S/560 ya descuentan los S/89 de internet del 28, que no está
apartado en ninguna caja.
A tu ritmo de estas semanas (S/62 al día, quedan 5), cerrarías julio
con unos S/-50.
[Ver el desglose]  [Registrar el gasto]
```

Nótese que la respuesta **no dice si le alcanza**. Dice cuánto le quedaría, y
deja ver que el cierre saldría en negativo sin llamarlo un error. Mostrar un
cierre negativo es información; decir "no deberías comprarlo" sería un consejo,
y eso está prohibido (`22` §8).

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

En V1-web es el **mes civil actual en America/Lima** y no se expone parámetro
`horizon`. Proyecciones a más largo plazo son V1.1 (`WEB-D225`).

**`RUL-PROY-10` — Los ingresos futuros solo se cuentan si son conocidos**

Un ingreso se podrá contar en la proyección solo si:

- es un recurrente activo de tipo ingreso, o
- el usuario declaró en su perfil cuándo cobra y con qué regularidad
  (`20c` §2.2).

**Nunca se infiere un sueldo futuro solo porque hubo ingresos regulares en el
pasado.** Si el sistema lo sospecha, lo pregunta y lo confirma antes de
contarlo (`WEB-D023`).

Esta regla evita el fallo más peligroso del módulo: proyectar que a alguien
le va a entrar dinero que quizá no entre.

Recorte ejecutable de `W-12`: las fuentes descritas todavía no existen con
un contrato que distinga ingresos confirmados. Por eso el motor suma **cero
ingresos futuros** y nunca infiere uno; `W-16` deberá añadir la rama positiva
y su término explícito a la fórmula (`WEB-D225`).

**`RUL-PROY-11` — Toda proyección es reproducible**

Dado el mismo estado de datos, la misma proyección debe dar el mismo
resultado. Se calcula con reglas determinísticas, **nunca por el modelo**.

El modelo puede explicar una proyección y ponerla en palabras; no la calcula.

## 7. Validaciones

| Elemento | Regla |
|---|---|
| Monto a simular | Mayor que 0, máximo 14 dígitos con 2 decimales |
| Horizonte | No se recibe en V1-web; siempre termina el último día del mes Lima |
| Categoría de la simulación | Opcional; si se indica, afecta también al presupuesto de esa categoría |
| Fecha de la simulación | Entre hoy y el fin del mes civil actual |

## 8. Superficies

**Referencia visual: no existe frame previo.** Las proyecciones estaban fuera
de V1 en `05c` §20 y nunca se diseñaron, así que no hay nada en
`docs/fase_6_visual/32_especificacion_hifi.md` ni en `stitch_manzana_v1/`. Los
bloques de abajo son la especificación de layout. Tokens y primitivas salen de
`16_design_system_web.md`.

### `SCR-PROY-01` — Proyecciones

**Ruta:** `/proyecciones`

```text
┌──────────────────────────────────────────────────┐
│ Cómo vas                             julio 2026  │
├──────────────────────────────────────────────────┤
│ A este ritmo terminarías el mes con              │
│                                                  │
│      S/250                                       │
│                                                  │
│ Parto de tus S/560 libres, que ya descuentan     │
│ S/89 de compromisos sin apartar, y de tu ritmo   │
│ de las últimas 2 semanas (S/62 al día).          │
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
Dinero libre hoy                     S/560.00  [ver desglose]
  Libre en cuentas        S/649.00
  − Compromisos sin caja  − S/89.00            [ver cuáles]
− Ritmo estimado (5 días × S/62)    − S/310.00 [ver los 14 días]
─────────────────────────────────────────────
= Proyección de cierre               S/250.00
```

Es la materialización del principio de procedencia: cada línea es navegable
hasta sus datos.

La primera línea se muestra **desglosada hacia dentro, con sangría**, no como
dos restas al mismo nivel. Es deliberado: hace visible que los compromisos ya
están dentro del dinero libre y hace evidente en pantalla que restarlos de
nuevo sería contarlos dos veces. La jerarquía visual aquí no es estética, es
la defensa contra `RUL-CUENTAS-04`.

### `SCR-PROY-03` — Simulador

Modal o sección. Pide monto y opcionalmente en qué y cuándo. Devuelve la
respuesta de tres partes de `RUL-PROY-05`. Desde `W-13`, registrar abre
Movimientos con el contrato estricto de precarga compartida (`WEB-D238`): no
guarda nada, conserva una fecha futura bloqueada y nunca inventa subcategoría
ni hora pasada.

### `SCR-PROY-04` — Cómo vas, en el Inicio

Componente compacto. Una línea con la proyección y su supuesto principal.
Solo aparece si hay datos suficientes (`RUL-PROY-04`).

## 9. Acciones

| ID | Acción | ¿Confirma? | Deshacer | Evento |
|---|---|---|---|---|
| `ACT-PROY-01` | Ver proyección de cierre | No | — | `proyeccion.vista` |
| `ACT-PROY-02` | Ver el detalle de la aritmética | No | — | `proyeccion.detalle_consultado` |
| `ACT-PROY-03` | Simular un gasto | No | — | `simulacion.ejecutada` |
| `ACT-PROY-04` | Registrar el gasto simulado por precarga (`WEB-D238`) | Sí, en Movimientos | Eliminando el movimiento | `movimiento.creado` |
| `ACT-PROY-05` | Ver situación del mes | No | — | `situacion.consultada` |
| `ACT-PROY-06` | Ver de dónde sale un componente | No | — | `evidencia.consultada` |

Solo `ACT-PROY-04` termina escribiendo, y lo hace por el módulo 26 con sus
reglas normales después de que el usuario revise y guarde. Proyecciones sigue
sin mutar dinero: el enlace entregado en `W-13` solo transporta precarga.

## 10. API

| Método y ruta | Notas |
|---|---|
| `GET /projections/period` | Proyección de cierre con supuestos y referencias |
| `GET /projections/health` | Los cuatro componentes de situación con su dato |
| `POST /simulate` | **Solo lectura, no escribe.** Body: `{ amount, category_id?, date? }` |
| `GET /projections/period/breakdown` | La aritmética línea por línea con referencias |

Los cuatro son **endpoints de solo lectura sin excepción** (`14` §13). Si una
consulta natural expresa intención de gastar, nunca se ejecuta. El enlace al
flujo de registro se habilitará con la precarga validada de `WEB-D233`; `W-12`
no emite parámetros que el formulario actual no consume.

Respuesta de `GET /projections/period`:

```jsonc
{
  "projection": "250.00",
  "range": null,                       // o { "min": "120.00", "max": "240.00" }
  "assumptions": [
    // Declarativo: ya está dentro de free_money, no se resta aparte
    { "kind": "compromisos_ya_descontados", "amount": "89.00",
      "refs": ["rec_123"] },
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
| **Sin cuenta PEN activa** | "Para decirte cómo vendría el cierre del mes necesito saber cuánto tienes." + agregar saldo. Una cuenta conocida con saldo S/0 sí es dato (`WEB-D228`) |
| **Menos de 7 días con movimientos** | "Con unos días más de movimientos puedo decirte cómo vendría el cierre." Sin estimar |
| **Con datos, sin compromisos** | Proyección solo por ritmo, declarando que no hay compromisos contados |
| **Alta dispersión del gasto** | Rango en vez de número (`RUL-PROY-03`) |
| **Periodo recién empezado** (menos de 7 días, `RUL-PROY-04`) | Proyección con aviso de que el ritmo se basa en pocos días |
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
| `ERR-PROY-04` | Horizonte fuera de rango | **Diferido a V1.1**: W-12 no recibe horizonte (`WEB-D225`) |
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
| *(compromisos del periodo)* | **No es una medida de este módulo.** Se consume `total_no_cubierto` del módulo `30` (`RUL-CATALOGO-03`) |
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
"¿por qué dices que terminaría con 250?"       → detalle de la aritmética
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

- La proyección se calcula en el servidor con un número fijo de consultas,
  sin N+1: una lectura agregada de movimientos y los compromisos canónicos
  que también alimentan `GET /upcoming` (`WEB-D193`, `WEB-D227`).
- El ritmo diario usa el índice `movements (user_id, occurred_at desc)`.
- Se cachea por usuario durante 5 minutos y se invalida ante cualquier
  escritura financiera.
- Dentro de una carga compartida la simulación es aritmética sobre el mismo
  estado. Como endpoint independiente carga ese estado canónico una vez; no
  presume una caché de otro request.
- Presupuesto: `/projections/period` bajo 300 ms porque lo consume el Inicio;
  `/simulate` bajo 150 ms.

## 18. Accesibilidad específica

- La proyección se anuncia con su supuesto principal, no sola: "A este ritmo
  terminarías el mes con 250 soles, partiendo de 560 libres que ya descuentan
  89 de compromisos".
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
13. **Convertir la simulación en gasto.** No se ofrece un enlace inerte ni se
    traduce una fecha futura a “hoy”. La acción espera el contrato de precarga
    compartido de `W-13` (`WEB-D233`).

## 20. Criterios de aceptación

**Nota de trazabilidad (`WEB-D231`):** `AC-PROY-02b` se conserva como
subcriterio documental y se verifica por separado, pero la matriz lo pliega
en la fila del identificador base `AC-PROY-02`.

- `AC-PROY-01` — Ninguna proyección se emite sin declarar sus supuestos en el
  mismo bloque visual. Evidencia: `TEST` + `USER`. Clase: `unidad`. Cierra la
  parte `TEST` en `W-12`: `projections-screen.test.tsx` exige los supuestos
  debajo de la cifra y oculta esta si llegan vacíos. `USER` no cierra: no
  hubo sesión real.
- `AC-PROY-02` — El ejemplo de `RUL-PROY-02` produce exactamente S/250.00.
  Evidencia: `TEST`. Clase: `unidad`. Cierra en `W-12`:
  `projection-engine.test.ts` y `projections.repository.test.ts` prueban
  `560 − 62 × 5 = 250`.
- `AC-PROY-02b` — **Los compromisos se descuentan una sola vez.** Dado un
  usuario con compromisos no cubiertos, la proyección de cierre es igual a
  `dinero_libre − ritmo × dias`, y **no** a `dinero_libre − compromisos −
  ritmo × dias`. Evidencia: `TEST`. Clase: `unidad`. Cierra en `W-12`: las
  mismas pruebas confirman que los S/89 de compromisos ya contenidos en
  dinero libre no vuelven a restarse.
- `AC-PROY-03` — El ritmo diario usa mediana, no promedio, y **excluye los
  movimientos ligados a compromisos**. Evidencia: `TEST`. Clase: `unidad`.
  Cierra en `W-12`: el Projection Engine prueba la mediana de 14 días civiles
  Lima, incluidos ceros, y excluye movimientos ligados.
- `AC-PROY-04` — Con alta dispersión se muestra rango en vez de número único.
  Evidencia: `TEST`. Clase: `unidad`. Cierra en `W-12`: el Engine produce el
  rango IQR y `ProjectionHero` muestra S/180–S/320 con “Rango por variación”.
- `AC-PROY-05` — Con menos de 7 días de movimientos no se proyecta y se dice
  por qué. Evidencia: `TEST` + `USER`. Clase: `unidad`. Cierra la parte
  `TEST` en `W-12`: Engine y UI prueban menos de siete días, motivo visible y
  ausencia de cifra futura. `USER` no cierra sin sesión real.
- `AC-PROY-06` — La respuesta a "¿puedo permitirme X?" **no contiene
  veredicto**. Evidencia: `TEST` + `USER`. Clase: `unidad`. Cierra la parte
  `TEST` en `W-12`: Engine, barrido de copy y `conversation-agent.test.ts`
  eliminan veredictos. `USER` no cierra y el routing conversacional completo
  sigue asignado a `W-16`/`W-17` por `WEB-D223`.
- `AC-PROY-07` — Simular no crea ningún movimiento ni modifica ningún saldo.
  Evidencia: `TEST`. Clase: `integracion`. Cierra en `W-12`:
  `w12-api-routes.test.ts` ejecuta `/simulate` real y compara movimientos,
  cuentas y cajas, incluidos `current_balance` y `updated_at`, antes y después.
- `AC-PROY-08` — No existe puntuación ni letra de salud financiera en ninguna
  superficie. Evidencia: `TEST`. Clase: `lint`. Cierra en `W-12`: el barrido
  completo de la superficie y la prueba de situación mensual descartan score,
  letra y puntuación global.
- `AC-PROY-09` — No se cuenta ningún ingreso futuro que el usuario no haya
  declarado o confirmado. Evidencia: `TEST`. Clase: `unidad`. Cierra en
  `W-12`: el Engine declara S/0 con `basis=not_available_v1` y no incorpora
  fuente inventada.
- `AC-PROY-10` — La proyección es reproducible: el mismo estado de datos da
  el mismo resultado. Evidencia: `TEST`. Clase: `unidad`. Cierra en `W-12`:
  el mismo estado y reloj explícito producen una estructura idéntica.
- `AC-PROY-11` — La proyección la calculan reglas determinísticas, nunca el
  modelo. Evidencia: `CODE` + `TEST`. Clase: `unidad`. Cierra en `W-12`: las
  rutas delegan en Projection Engine determinístico y
  `insight-engine.test.ts` exige que la proyección legada incompatible no se
  publique.
- `AC-PROY-12` — El detalle desglosa la aritmética línea por línea con
  referencias navegables. Evidencia: `TEST` + `USER`. Clase: `unidad`.
  Cierra solo la parte de aritmética y referencias conocidas en `W-12`:
  `projections-screen.test.tsx` prueba líneas y enlaces de movimientos. No
  cierra `USER` ni la procedencia completa: `free_money`/`free_in_accounts`
  no traen referencias y los compromisos enlazan al módulo, no al ítem exacto.
- `AC-PROY-13` — Ningún copy de este módulo usa las palabras prohibidas de
  §3. Evidencia: `TEST`. Clase: `lint`. Cierra en `W-12`: el barrido
  automático recorre todos los archivos productivos de
  `src/features/projections`.
- `AC-PROY-14` — Este módulo no expone ningún comando de escritura.
  Evidencia: `TEST`. Clase: `integracion`. Cierra en `W-12`: la prueba de
  arquitectura limita la superficie a tres GET y el POST de simulación, y
  RLS prueba que ese POST no altera movimientos, cuentas, cajas ni otro
  estado.
- `AC-PROY-15` — Ante fallo de cálculo no se muestra una proyección
  aproximada de respaldo. Evidencia: `TEST`. Clase: `unidad`. Cierra en
  `W-12`: la prueba de error exige ausencia de cifra y de respaldo aproximado.
- `AC-PROY-16` — No existe comparación con otros usuarios ni con promedios
  externos. Evidencia: `TEST`. Clase: `lint`. Cierra en `W-12`: el barrido
  completo descarta usuarios, mercado y promedios externos.
- `AC-PROY-17` — Un dinero libre negativo se proyecta sin dramatizar.
  Evidencia: `USER`. No cierra: el motor acepta valores negativos y el copy es
  neutral, pero no hubo la sesión `USER` exigida.

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

**Decisiones tomadas en este documento**, registradas en
`03_decisiones_producto_web.md`:

| Decisión | ID | Alternativa descartada | Razón |
|---|---|---|---|
| Sin veredicto en "¿puedo permitírmelo?" | `WEB-D036` | Responder sí o no | Un veredicto le quita la decisión al usuario, y el sistema no conoce su contexto completo |
| Salud descrita por componentes, sin puntuar | `WEB-D037` | Score numérico o letra | Un número desnudo es falsa precisión y un juicio sobre la persona |
| Sin comandos de escritura | `WEB-D038` | Permitir registrar desde el simulador | Proyectar nunca debe poder cambiar nada; registrar es una acción aparte y explícita |
| Mediana para el ritmo, sin compromisos | `WEB-D039` | Promedio, e incluir todo el gasto | Un día atípico distorsiona el promedio, y contar los compromisos en el ritmo los cuenta dos veces |
| Rango con alta dispersión | `WEB-D040` | Número único siempre | Un número exacto sobre datos dispersos es falsa precisión |
| Umbral de 7 días para proyectar | `WEB-D041` | Proyectar desde el primer día | Proyectar con dos movimientos produce cifras sin base que erosionan la confianza |

**Corrección de auditoría, 26 de julio de 2026.** Una revisión externa
encontró que `RUL-PROY-02` descontaba los compromisos dos veces: partía de
`dinero_libre` (`RUL-CUENTAS-03`), que ya los resta, y los volvía a restar.
Era el error que `RUL-CUENTAS-04` nombra como el más difícil de ver en
pantalla, cometido tres reglas después de enunciarlo. Se eliminó la resta
duplicada por decisión del usuario, se propagó a `RUL-PROY-05`, `SCR-PROY-01`,
`SCR-PROY-02`, `GET /projections/period`, §17, §18 y `AC-PROY-02`, y se añadió
`AC-PROY-02b` para que un test lo impida en el futuro.

Al corregirlo apareció un **segundo doble descuento que la auditoría no vio**:
los pagos recurrentes y las cuotas caían dentro de la ventana de 14 días del
ritmo y a la vez dentro de los compromisos. La mediana lo tapaba por
casualidad. Ahora `RUL-PROY-02` excluye del ritmo los movimientos ligados a
compromisos, y `AC-PROY-03` lo verifica.
