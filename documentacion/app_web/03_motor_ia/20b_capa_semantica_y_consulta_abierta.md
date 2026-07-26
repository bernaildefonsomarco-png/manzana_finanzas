# 20b — Conocimiento, contexto y consulta abierta

**Bloque:** 03 — Motor IA
**Estado:** V1.1
**Fecha:** 25 de julio de 2026
**Depende de:** `20_arquitectura_motor_conversacional.md`, `13_modelo_datos_web_v1.md`
**Documentos que dependen de este:** `22`, `23`, `40`, `41`, §14 de todos los módulos
**Amplía:** la §7 del documento 20, que se quedaba corta

---

## 1. El problema que resuelve

El documento 20 definió las lecturas como un catálogo de consultas
predefinidas. Eso pone un techo, y encima invisible: el asistente responde
las preguntas que alguien anticipó y calla en el resto, sin que el usuario
sepa dónde está el límite.

El espacio de preguntas que alguien puede hacerle a su propio dinero es
infinito:

```text
¿gasto más los fines de semana largos?
¿cuánto llevo en cosas que compré una sola vez?
¿los meses que pago la cuota salgo menos?
¿en qué se me va la plata la semana que cobro?
¿qué compro solo cuando trabajo hasta tarde?
¿mi gasto sube cuando estoy de viaje?
```

**La asimetría que gobierna este documento:**

| | Catálogo |
|---|---|
| **Escribir** | **Cerrado.** Es dinero real: cada operación se declara, se valida y se confirma. |
| **Leer y razonar** | **Abierto.** El motor accede a los datos y piensa sin un menú de preguntas permitidas. |

## 2. La separación que ordena todo

Hay dos clases de conocimiento, y confundirlas produce diseños malos en las
dos direcciones.

| | Quién lo tiene | Ejemplos |
|---|---|---|
| **Datos del usuario** | Solo la base de datos. El modelo no puede saberlos. | Sus movimientos, saldos, deudas, cuándo cobra, qué compró el martes |
| **Conocimiento del mundo** | El modelo, y mejor de lo que podríamos codificarlo. | Qué días son feriado en Perú, qué es un fin de semana largo, que Rappi es delivery, que diciembre es caro, que "yape" es una billetera, cómo se comporta la gente con el dinero |

**Regla:**

> La capa semántica modela el **dominio financiero del usuario**: entidades,
> relaciones, métricas y reglas de acceso. **No modela el conocimiento del
> mundo.** Eso lo aporta el modelo.

Codificar el conocimiento del mundo en tablas es un error por tres razones
concretas:

1. **Se desactualiza.** Un calendario de feriados hay que mantenerlo.
2. **Es peor que lo que ya hay.** El modelo conoce el contexto cultural,
   comercial y estacional con mucha más riqueza que cualquier tabla.
3. **No escala fuera del país.** Con tablas, expandirse a México o Colombia
   exige cargar una tabla por país. Con el modelo aportándolo, un usuario
   mexicano pregunta "¿gasto más en puentes?" y funciona el primer día, sin
   trabajo.

### 2.1 El conocimiento del mundo se declara como supuesto

El modelo puede equivocarse sobre un feriado. Por eso, cuando aporta
conocimiento del mundo a un cálculo, **lo dice**:

```text
Los fines de semana largos gastas en promedio S/95 más.
Conté como largos los que incluyen 28-29 de julio (Fiestas Patrias),
1 de mayo y 8 de diciembre.
```

Es el principio de procedencia (`08_principios_experiencia_web.md` §4.1)
aplicado al conocimiento, no solo a los datos: el usuario ve el supuesto y
puede corregirlo. Mejor un supuesto visible que una tabla invisible.

## 3. Las tres capas

```text
┌──────────────────────────────────────────────┐
│  1. PANORAMA CARGADO                         │
│     situación actual · patrones · perfil     │
│     90 días de movimientos · resúmenes       │
│     El motor ya sabe quién eres al leerte    │
└────────────────────┬─────────────────────────┘
                     ▼
┌──────────────────────────────────────────────┐
│  2. CONSULTA ABIERTA                         │
│     para el detalle que no está cargado      │
│     compilada, con identidad inyectada       │
│     devuelve datos + referencias             │
└────────────────────┬─────────────────────────┘
                     ▼
┌──────────────────────────────────────────────┐
│  3. CÁLCULO AISLADO                          │
│     opera sobre lo cargado y lo consultado   │
│     sin base de datos, sin red               │
│     hereda la evidencia                      │
└──────────────────────────────────────────────┘
```

El orden es obligatorio: **el cálculo aislado nunca accede a los datos**,
solo a lo que las capas 1 y 2 ya trajeron. Así el razonamiento libre no
puede saltarse las reglas de acceso ni perder la procedencia.

## 4. Panorama cargado

El motor arranca cada conversación sabiendo quién eres y cómo está tu
dinero. No va a buscar nada para entenderte.

| Contenido | Peso aprox. |
|---|---|
| **Situación actual** — saldos por cuenta, cajas, dinero libre con su desglose, deudas activas y su progreso, compromisos próximos, presupuestos y su avance | ~3k |
| **Patrones calculados** — gasto típico por categoría, comercios habituales con su frecuencia, ritmo de gasto, ingresos típicos y su cadencia, categorías que suben o bajan | ~2k |
| **Perfil** — las cuatro capas de `20c_perfil_del_usuario_y_voz.md` | ~1k |
| **Movimientos recientes** — los últimos 90 días, completos | ~18k |
| **Resúmenes mensuales** — todo el historial anterior, comprimido a agregados por mes y categoría | ~2k |

Total: **~26k tokens estables y cacheables**, que no crecen con los años de
uso.

### 4.1 Por qué no cargar todo el historial

Los movimientos de una persona pesan ~25 tokens cada uno:

| Perfil de uso | 1 año | 2 años | 3 años |
|---|---|---|---|
| Promedio (3/día) | 27k | 54k | 81k |
| Activo (8/día) | 72k | 144k | 216k |
| Muy activo (15/día) | 135k | 270k | 405k |

Cargar todo funciona el primer año y se rompe al tercero, **justo con los
usuarios más activos** — los que más valor tienen. Cambiar de estrategia
precisamente con ellos es el peor momento posible.

Y hay una razón mejor: **más contexto no es mejor razonamiento.** Con
cientos de miles de tokens de filas crudas, el modelo tiene que encontrar la
aguja cada vez, y la calidad se degrada. Un panorama estructurado con los
patrones ya calculados razona mejor que un volcado masivo.

La analogía que lo explica: un contador que te conoce no recita tus
transacciones de hace dos años. Conoce tus patrones —"tú en comida andas por
400, se te dispara cuando viajas"— y busca el detalle cuando hace falta. Eso
es lo que se siente como alguien que te conoce.

### 4.2 Los resúmenes mensuales

La pieza que hace que el historial completo esté presente sin cargarlo. Por
cada mes anterior a la ventana de 90 días: total gastado e ingresado,
desglose por categoría, comercios destacados, hechos notables (una deuda que
se abrió, un mes atípico).

Con eso el motor sabe "en marzo del año pasado gastaste S/2.100, sobre todo
en salidas" sin tener las 90 filas de marzo. Si le preguntas por el detalle
de marzo, lo consulta.

### 4.3 Mantenimiento

El panorama se recalcula cuando cambian los datos que lo componen; los
patrones y resúmenes, de forma diferida por un worker. Dentro de una
conversación es estable, lo que permite cachearlo. Toda cifra del panorama
lleva sus referencias, igual que una consulta.

## 5. Consulta abierta

Para el detalle que el panorama no lleva: movimientos antiguos, cortes muy
específicos, agrupaciones puntuales.

### 5.1 Modelo del dominio

Modela **solo lo que la base sabe**. Entidades consultables: movimientos,
cuentas, cajas, deudas, cuotas, pagos que vienen, ocurrencias, presupuestos,
metas, pendientes, categorías, comercios, personas, descubrimientos. Cada
una con sus dimensiones, medidas y relaciones declaradas — sin uniones
arbitrarias.

Medidas: suma, conteo, conteo distinto, promedio, mediana, mínimo, máximo,
percentil, desviación, variación, proporción del total.

**Dimensiones derivadas — solo las que requieren datos del usuario.** La
prueba para incluir una: *¿el modelo puede saber esto sin consultar la base?*
Si la respuesta es sí, no va aquí.

| Dimensión | Por qué necesita la base |
|---|---|
| `frecuencia_comercio` (única vez · ocasional · habitual) | Exige agregar todo el historial del usuario |
| `es_primera_vez` | Ídem |
| `dias_desde_anterior_igual` | Ídem |
| `es_dia_de_pago`, `dias_desde_el_pago`, `momento_del_ciclo` | Dependen de cuándo cobra **esta** persona (viene del perfil) |
| `desviacion_de_su_promedio` | Exige el baseline propio del usuario |
| `cubierto_por_caja`, `afecta_saldo`, `parte_de_compromiso` | Lógica financiera del dominio |
| `proporcion_del_ingreso` | Depende de sus ingresos |
| `periodo_declarado` (viaje, mudanza, mes atípico) | El usuario lo contó; vive en su perfil |

Y las de calendario puro —`dia_semana`, `quincena`, `franja_horaria`,
`semana_del_mes`— que son aritmética de fechas, no conocimiento cultural, y
se incluyen porque permiten agrupar en el servidor de forma eficiente.

**Lo que deliberadamente NO se modela:** feriados, puentes, temporadas,
qué comercio es de qué rubro, estacionalidad. Todo eso lo aporta el modelo.

### 5.2 El lenguaje

```text
consulta {
  de            entidad
  donde         predicados (y, o, no) — incluidos rangos de fecha arbitrarios
  agrupar_por   dimensiones
  medir         medidas
  ordenar       por medida o dimensión
  limitar       n
  comparar_con  otra consulta
  a_partir_de   subconsulta, para conjuntos derivados
}
```

`a_partir_de` es lo que da profundidad. "¿Cuánto llevo en cosas que compré
una sola vez?" se compone así: primero los comercios con conteo = 1, luego
la suma de los movimientos de esos comercios. Ninguno de los dos pasos
estaba previsto.

Y como `donde` acepta rangos de fecha arbitrarios, el modelo puede pedir
"del 26 al 30 de julio" porque *él sabe* que ahí cae Fiestas Patrias. No
necesita una dimensión `es_feriado`: necesita poder expresar el rango.

### 5.3 Compilación

| Paso | Qué hace |
|---|---|
| Validar | Contra el modelo del dominio; una dimensión inexistente se rechaza aquí |
| **Inyectar identidad** | El `user_id` lo pone el compilador. **El lenguaje no puede expresarlo ni alterarlo** |
| Aplicar reglas de acceso | Al compilar, no después |
| Acotar | Complejidad, filas, tiempo |
| Ejecutar | Contra vistas de solo lectura |
| Devolver | Resultado **más las referencias** de las filas que lo componen |

La segunda fila es la garantía estructural: no existe forma de escribir en el
lenguaje una consulta sobre datos ajenos, igual que no existe forma de
escribir una escritura.

### 5.4 Evidencia por construcción

Toda consulta devuelve resultado **y** referencias. Un total de `S/420.00`
viene siempre con los identificadores de los movimientos sumados. No es una
opción del agente: es la forma de la respuesta. Esto sostiene el invariante
de evidencia y alimenta el foco del turno.

## 6. Cálculo aislado

El escalón cuando ni el panorama ni una consulta bastan: correlaciones,
series temporales, agrupaciones por criterios que combinan datos y
conocimiento del mundo.

Es también **el lugar donde el modelo aplica lo que sabe del mundo a tus
datos**: agrupar tus movimientos por "días de feriado" es cálculo sobre
datos ya traídos, usando el calendario que el modelo conoce.

### 6.1 Reglas duras

| Regla | Por qué |
|---|---|
| Opera **solo sobre datos ya cargados o consultados** | Hereda las reglas de acceso y la evidencia |
| **Sin acceso a base de datos, red ni ficheros** | No hay superficie por donde escapar |
| Límite de tiempo y memoria | Un cálculo no puede degradar el servicio |
| El código queda registrado | "¿Cómo calculaste eso?" tiene respuesta literal |
| El resultado hereda las referencias de su entrada | La procedencia no se pierde |
| Todo supuesto del mundo se declara | El usuario ve qué contó como feriado, como viaje, como categoría |

### 6.2 Comprobaciones de sanidad

El riesgo del cálculo libre es una cifra bien formada y mal calculada. Antes
de emitir:

- Una suma parcial no supera el total de su conjunto de entrada.
- Un conteo no supera las filas de entrada.
- Un porcentaje está entre 0 y 100.
- Una fecha resultante cae dentro del rango de los datos.
- El resultado no es `NaN`, infinito ni nulo inesperado.

Si una falla, **el resultado no se emite**. Se responde con honestidad y el
fallo se registra como defecto.

### 6.3 Transparencia

Todo resultado calculado explica su procedimiento en lenguaje del usuario:

```text
Tomé tus movimientos de los últimos 6 meses, marqué los días que fueron
feriado o puente, y comparé el promedio de esos días contra el resto.
```

Se muestra el procedimiento y los supuestos, no el código. El código queda
registrado para soporte.

## 7. Cómo elige el motor

```text
¿Está en el panorama que ya tiene cargado?
├─ SÍ  → responde directamente              (caso mayoritario)
└─ NO  → ¿lo trae una consulta?
         ├─ SÍ  → consulta
         └─ NO  → ¿lo resuelve calculando sobre lo que sí puede traer?
                  ├─ SÍ  → consulta + cálculo
                  └─ NO  → lo dice y ofrece lo más cercano
```

Se vigila la proporción de turnos que llegan a cada nivel. Si suben las
consultas, falta algo en el panorama. Si sube el cálculo, puede faltar una
dimensión. **El uso de los niveles inferiores es un instrumento de medida
sobre qué construir después.**

## 8. Qué gana el usuario

| Pregunta | Cómo se resuelve | ¿Prevista? |
|---|---|---|
| "¿cómo voy este mes?" | Está en el panorama; responde sin consultar | No |
| "¿gasto más los fines de semana largos?" | El modelo sabe qué días son; consulta el rango y calcula | No |
| "¿cuánto llevo en cosas que compré una sola vez?" | `frecuencia_comercio` + subconsulta | No |
| "¿en qué se me va la plata al cobrar?" | `dias_desde_el_pago` (del perfil) | No |
| "¿gasto más cuando viajo?" | `periodo_declarado` (del perfil) | No |
| "¿mi delivery sube en diciembre?" | El modelo sabe qué es diciembre; consulta y compara | No |
| "¿qué compré fuera de lo normal?" | `desviacion_de_su_promedio` | No |

Ninguna se programó. Y ninguna necesita que codifiquemos el calendario, los
rubros comerciales ni la estacionalidad.

## 9. Criterios de aceptación

- `AC-SEM-01` — El `user_id` lo inyecta el compilador; el lenguaje no puede
  expresarlo. Evidencia: `TEST`.
- `AC-SEM-02` — El modelo del dominio no contiene conocimiento del mundo
  (feriados, rubros, estacionalidad). Evidencia: `DOC` + revisión.
- `AC-SEM-03` — Cuando el motor usa conocimiento del mundo en un cálculo, lo
  declara como supuesto visible. Evidencia: `TEST` + `USER`.
- `AC-SEM-04` — El panorama cargado se mantiene por debajo de su presupuesto
  de tokens independientemente de los años de uso. Evidencia: `TEST` + `METRIC`.
- `AC-SEM-05` — Toda cifra del panorama y de toda consulta lleva sus
  referencias. Evidencia: `TEST`.
- `AC-SEM-06` — El cálculo aislado no tiene acceso a base de datos, red ni
  ficheros. Evidencia: `TEST`.
- `AC-SEM-07` — Un resultado calculado que falla una comprobación de sanidad
  no se emite. Evidencia: `TEST`.
- `AC-SEM-08` — Todo resultado calculado explica su procedimiento y sus
  supuestos en lenguaje del usuario. Evidencia: `TEST` + `USER`.
- `AC-SEM-09` — Las siete preguntas de §8 se responden correctamente sin
  código específico para ninguna. Evidencia: `TEST` + `USER`.
- `AC-SEM-10` — Un usuario de otro país obtiene respuestas correctas sobre
  sus feriados y temporadas sin cargar datos de ese país. Evidencia: `TEST`.
- `AC-SEM-11` — Cuando nada alcanza, el motor lo dice y ofrece la
  alternativa más cercana; nunca estima. Evidencia: `TEST` + `USER`.
