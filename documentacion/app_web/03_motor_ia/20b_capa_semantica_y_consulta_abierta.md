# 20b — Capa semántica y consulta abierta

**Bloque:** 03 — Motor IA
**Estado:** V1
**Fecha:** 25 de julio de 2026
**Depende de:** `20_arquitectura_motor_conversacional.md`, `13_modelo_datos_web_v1.md`
**Documentos que dependen de este:** `22`, `23`, `40`, `41`, §14 de todos los módulos
**Amplía:** la §7 del documento 20, que quedaba corta

---

## 1. El problema que resuelve

El documento 20 definió las lecturas como un catálogo de consultas
predefinidas. Eso pone un techo: el asistente responde bien las preguntas que
alguien anticipó y se queda mudo en todo lo demás.

El espacio de preguntas que una persona puede hacerle a su propio dinero es
infinito:

```text
¿gasto más los fines de semana largos?
¿cuánto llevo en cosas que compré una sola vez?
¿los meses que pago la cuota salgo menos?
¿gasto distinto en quincena que a fin de mes?
¿qué compro solo cuando trabajo hasta tarde?
¿mi gasto en delivery sube cuando llueve?
```

Ninguna lista de consultas fijas cubre esto, y cada vez que el usuario toca
el techo, el producto deja de parecer inteligente. Peor: el techo es
invisible desde fuera, así que el usuario no sabe qué puede preguntar y qué
no.

**La asimetría que gobierna este documento:**

| | Catálogo |
|---|---|
| **Escribir** | **Cerrado.** Es dinero real: cada operación se declara, se valida y se confirma. |
| **Leer** | **Abierto.** El vocabulario es fijo; las preguntas que se componen con él, no. |

## 2. Por qué no SQL directo

La opción obvia sería que el modelo escriba SQL. Se descarta por una razón
concreta, medida: los fallos de un modelo escribiendo SQL contra tablas
crudas son **cifras confiadas y equivocadas**; los fallos de un modelo
componiendo sobre una capa semántica son **rechazos** ("no puedo responder
eso con lo que sé").

En un producto financiero esa diferencia lo decide todo. Una negativa cuesta
una interacción; una cifra falsa presentada con seguridad cuesta la
confianza en todas las cifras siguientes.

Hay una segunda razón, de seguridad: cuando las reglas de acceso se aplican
**al compilar la consulta**, el agente no puede pedir datos que no le
corresponden — no porque se le prohíba, sino porque la consulta que genera
no tiene forma de expresarlo.

## 3. Las tres capas

```text
┌──────────────────────────────────────────────┐
│  1. MODELO SEMÁNTICO                         │
│     entidades · dimensiones · derivadas      │
│     medidas · relaciones                     │
│     Vocabulario fijo, definido una vez       │
└────────────────────┬─────────────────────────┘
                     ▼
┌──────────────────────────────────────────────┐
│  2. LENGUAJE DE CONSULTA                     │
│     el agente compone libremente             │
│     compilado, validado, con RLS inyectado   │
│     devuelve datos + referencias             │
└────────────────────┬─────────────────────────┘
                     ▼
┌──────────────────────────────────────────────┐
│  3. CÁLCULO AISLADO   (solo si hace falta)   │
│     opera sobre lo ya consultado             │
│     sin base de datos, sin red               │
│     hereda la evidencia del paso 2           │
└──────────────────────────────────────────────┘
```

El orden importa y es obligatorio: **el cálculo aislado nunca accede a los
datos, solo a lo que la capa 2 ya trajo.** Así el cálculo libre no puede
saltarse las reglas de acceso ni perder la procedencia.

## 4. Modelo semántico

### 4.1 Entidades consultables

`movimientos`, `cuentas`, `cajas`, `deudas`, `cuotas`, `pagos_que_vienen`,
`ocurrencias`, `presupuestos`, `metas`, `pendientes`, `categorías`,
`comercios`, `personas`, `descubrimientos`.

Cada una declara sus dimensiones, sus medidas y sus relaciones permitidas.
No hay uniones arbitrarias: solo las relaciones declaradas.

### 4.2 Medidas

`suma`, `conteo`, `conteo_distinto`, `promedio`, `mediana`, `mínimo`,
`máximo`, `percentil`, `desviación`, `primero`, `último`, `variación`,
`proporción_del_total`.

### 4.3 Dimensiones directas

Las que existen como campo: tipo, estado, categoría, subcategoría,
etiqueta, cuenta, caja, comercio, persona, origen, moneda, fecha, monto.

### 4.4 Dimensiones derivadas — **donde se gana o se pierde**

Son las que convierten datos en preguntas humanas. Sin ellas, la capa
semántica no sirve de nada: nadie pregunta "agrupa por `occurred_at`
truncado a semana", preguntan "¿gasto más los fines de semana?".

**Temporales**

| Dimensión | Valores | Habilita |
|---|---|---|
| `dia_semana` | lunes…domingo | "¿qué día gasto más?" |
| `es_fin_de_semana` | sí / no | "¿gasto más los findes?" |
| `es_feriado` | sí / no | Calendario peruano oficial |
| `tipo_de_dia` | laboral · fin de semana · feriado · **fin de semana largo** | "¿gasto más los fines de semana largos?" |
| `franja_horaria` | madrugada · mañana · tarde · noche | "¿qué compro de madrugada?" |
| `quincena` | primera · segunda | "¿gasto distinto en quincena?" |
| `semana_del_mes` | 1…5 | |
| `dias_hasta_fin_de_mes` | número | "¿me aprieto a fin de mes?" |
| `mes`, `trimestre`, `año` | | Comparativas |

**De pago del usuario** — requieren el perfil (`20c_perfil_del_usuario_y_voz.md`)

| Dimensión | Habilita |
|---|---|
| `es_dia_de_pago` | "¿gasto más el día que me pagan?" |
| `dias_desde_el_pago` | "¿en qué se me va la plata la primera semana?" |
| `momento_del_ciclo` | recién cobrado · media · antes de cobrar |

**De comportamiento**

| Dimensión | Valores | Habilita |
|---|---|---|
| `frecuencia_comercio` | única vez · ocasional · habitual · recurrente | **"¿cuánto llevo en cosas que compré una sola vez?"** |
| `es_primera_vez` | sí / no | "¿cuánto gasto probando cosas nuevas?" |
| `dias_desde_anterior_igual` | número | "¿cada cuánto pido delivery?" |
| `posicion_en_periodo` | ranking de gasto | "¿cuáles fueron mis 5 gastos más grandes?" |
| `desviacion_de_su_promedio` | veces respecto a lo normal | "¿qué gasté fuera de lo normal?" |

**Financieras**

| Dimensión | Habilita |
|---|---|
| `afecta_saldo` | Separar movimientos reales de traspasos |
| `cubierto_por_caja` | "¿qué compromisos ya tengo apartados?" |
| `parte_de_compromiso` | |
| `proporcion_del_ingreso` | "¿qué porcentaje de lo que gano se va en alquiler?" |

**De contexto de vida** — requieren el perfil

| Dimensión | Habilita |
|---|---|
| `periodo_declarado` | "¿gasto más cuando estoy de viaje?" |
| `es_dia_laboral_del_usuario` | Para quien no trabaja de lunes a viernes |

La última familia es la que más eleva la sensación de que el asistente
conoce a la persona, y solo es posible porque el perfil guarda lo que el
usuario cuenta de su vida.

### 4.5 El vocabulario crece

Añadir una dimensión derivada **habilita una familia entera de preguntas**,
no una pregunta. `tipo_de_dia` no responde solo lo de los fines de semana
largos: responde también "¿gasto más en feriados?", "¿los laborales gasto
distinto?", "compara mis findes con mis feriados". Por eso el trabajo se
invierte en dimensiones, no en consultas.

Cada módulo declara en su §14 las dimensiones y medidas que aporta. El
documento 40 las agrega.

## 5. Lenguaje de consulta

El agente compone; el usuario nunca lo ve.

```text
consulta {
  de            entidad
  donde         predicados sobre dimensiones (y, o, no)
  agrupar_por   dimensiones, incluidas derivadas
  medir         medidas
  ordenar       por medida o dimensión
  limitar       n
  comparar_con  otra consulta (periodo anterior, otro grupo)
  a_partir_de   subconsulta, para conjuntos derivados
}
```

**`a_partir_de` es la pieza que da profundidad.** Permite construir un
conjunto y luego consultar sobre él:

```text
"¿cuánto llevo en cosas que compré una sola vez?"

paso 1:  de movimientos, agrupar por comercio, medir conteo
         → donde conteo = 1
paso 2:  de movimientos, a partir de (esos comercios), medir suma
```

Ninguno de los dos pasos estaba previsto. Ambos son composiciones del
vocabulario.

### 5.1 Compilación

Toda consulta pasa por el compilador antes de tocar los datos:

| Paso | Qué hace |
|---|---|
| Validar | Contra el modelo semántico; una dimensión inexistente se rechaza aquí |
| **Inyectar identidad** | El `user_id` lo pone el compilador. **El agente no puede expresarlo ni alterarlo** |
| Aplicar reglas de acceso | Al compilar, no después |
| Acotar | Complejidad, filas, tiempo |
| Ejecutar | Contra vistas de solo lectura |
| Devolver | Resultado **más las referencias** de las filas que lo componen |

La segunda fila es la garantía estructural de aislamiento: no existe forma
de escribir en el lenguaje una consulta sobre datos ajenos, igual que no
existe forma de escribir una escritura.

### 5.2 Evidencia por construcción

Toda consulta devuelve resultado **y** referencias. Un total de `S/420.00`
viene siempre con los identificadores de los movimientos sumados. No es una
opción del agente: es la forma de la respuesta.

Esto sostiene el invariante de evidencia (`22`) y, además, alimenta el foco
del turno: cuando el usuario dice "de esos…", el motor sabe exactamente
cuáles.

### 5.3 Cuando el vocabulario no alcanza

El motor lo dice, y ofrece lo más cercano que sí puede:

```text
No puedo responder eso con lo que sé de tus datos.
Lo más parecido que sí puedo darte: tu gasto por día de la semana.
¿Te sirve?
```

Rechazar es un resultado aceptable. Inventar no.

## 6. Cálculo aislado

El escalón cuando el lenguaje no expresa algo: correlaciones, series
temporales complejas, agrupaciones por criterios que no son una dimensión.

### 6.1 Reglas duras

| Regla | Por qué |
|---|---|
| Opera **solo sobre datos ya consultados** por la capa 2 | Hereda las reglas de acceso y la evidencia; no puede eludirlas |
| **Sin acceso a base de datos, red ni ficheros** | No hay superficie por donde escapar |
| Límite de tiempo y memoria | Un cálculo no puede degradar el servicio |
| El código queda registrado | "¿Cómo calculaste eso?" tiene respuesta literal |
| Se prefiere siempre el lenguaje cuando alcanza | El sandbox es el último recurso, no el primero |
| El resultado hereda las referencias de sus datos de entrada | La procedencia no se pierde |

### 6.2 Comprobaciones de sanidad

El riesgo real del cálculo libre es una cifra bien formada y mal calculada.
Antes de emitir un resultado se comprueba:

- Una suma parcial no supera el total del conjunto de entrada.
- Un conteo no supera el número de filas de entrada.
- Un porcentaje está entre 0 y 100.
- Una fecha resultante cae dentro del rango consultado.
- El resultado no es `NaN`, infinito ni nulo inesperado.

Si una comprobación falla, el resultado **no se emite**. Se responde con
honestidad y el fallo se registra como defecto.

### 6.3 Transparencia

Todo resultado de cálculo aislado puede explicar cómo se obtuvo, en lenguaje
del usuario:

```text
Tomé tus 340 movimientos de los últimos 3 meses, los agrupé por semana
y comparé las semanas con feriado contra las demás.
```

No se muestra el código, se muestra el procedimiento. El código queda
registrado para soporte.

## 7. Cómo elige el agente

```text
¿Lo responde una consulta del lenguaje?
├─ SÍ  → compone la consulta                      (caso mayoritario)
└─ NO  → ¿lo resuelve calculando sobre datos que sí puede traer?
         ├─ SÍ  → consulta + cálculo aislado
         └─ NO  → lo dice y ofrece lo más cercano
```

Regla de preferencia: el lenguaje **siempre** que alcance. Cada consulta es
determinista, cacheable, verificable y barata; cada cálculo aislado es lo
contrario en las cuatro cosas.

Se vigila la proporción de turnos que recurren al sandbox: si sube, indica
que **falta una dimensión derivada** y hay que añadirla al vocabulario. El
sandbox es también un instrumento de medida sobre qué le falta al modelo
semántico.

## 8. Qué gana el usuario

| Pregunta | Cómo se resuelve | ¿Estaba prevista? |
|---|---|---|
| "¿gasto más los fines de semana largos?" | `tipo_de_dia` + comparar | No |
| "¿cuánto llevo en cosas que compré una sola vez?" | `frecuencia_comercio` = única vez | No |
| "¿gasto distinto en quincena?" | `quincena` + comparar | No |
| "¿en qué se me va la plata al cobrar?" | `dias_desde_el_pago` | No |
| "¿qué compré fuera de lo normal?" | `desviacion_de_su_promedio` | No |
| "¿gasto más cuando viajo?" | `periodo_declarado` (del perfil) | No |
| "¿mi delivery sube cuando trabajo tarde?" | `franja_horaria` + perfil + cálculo | No |

Ninguna se programó. Todas salen del mismo vocabulario.

## 9. Criterios de aceptación

- `AC-SEM-01` — El `user_id` lo inyecta el compilador; el lenguaje no puede
  expresarlo. Evidencia: `TEST`.
- `AC-SEM-02` — Una consulta que referencia una dimensión inexistente se
  rechaza al compilar, sin tocar los datos. Evidencia: `TEST`.
- `AC-SEM-03` — Toda consulta devuelve las referencias de las filas que
  componen su resultado. Evidencia: `TEST`.
- `AC-SEM-04` — El cálculo aislado no tiene acceso a base de datos, red ni
  ficheros. Evidencia: `TEST`.
- `AC-SEM-05` — Un resultado de cálculo que falla una comprobación de
  sanidad no se emite. Evidencia: `TEST`.
- `AC-SEM-06` — Todo resultado de cálculo aislado puede explicar su
  procedimiento en lenguaje del usuario. Evidencia: `TEST` + `USER`.
- `AC-SEM-07` — Las siete preguntas de §8 se responden correctamente sin
  código específico para ninguna. Evidencia: `TEST` + `USER`.
- `AC-SEM-08` — Cuando el vocabulario no alcanza, el motor lo dice y ofrece
  la alternativa más cercana; nunca estima. Evidencia: `TEST` + `USER`.
- `AC-SEM-09` — Se mide la proporción de turnos que usan el sandbox y se
  revisa como señal de dimensiones faltantes. Evidencia: `METRIC`.
