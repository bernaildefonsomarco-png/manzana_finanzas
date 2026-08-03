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

### 3.1 Quién toca la base de datos

Aclaración necesaria antes de implementar, porque confundir esto rompe toda
la seguridad del diseño:

```text
El AGENTE compone        →  una consulta declarativa
                            (qué entidad, qué filtros, qué agrupar, qué medir)
                            NUNCA escribe SQL

El COMPILADOR traduce    →  SQL parametrizado
                            inyecta el user_id, aplica RLS, acota
                            ← AQUÍ vive el único SQL del sistema

La BASE devuelve         →  filas + sus identificadores

El SANDBOX recibe        →  ese array de filas, en memoria
                            calcula sobre ellas
                            CERO base de datos, cero SQL, cero red
```

**El modelo nunca escribe SQL en ningún punto.** Lo escribe el compilador, a
partir de una consulta ya validada contra el esquema del dominio.

El sandbox es una **función pura**: entra un array de filas, sale un valor.
No tiene credenciales que proteger, conexión que auditar ni consultas que
revisar, porque no accede a nada. Su peor caso posible es un bucle infinito,
y eso lo corta el límite de tiempo de §6.2.

La analogía que lo fija: la capa 2 es un bibliotecario que sabe dónde está
todo y solo entrega lo que te corresponde. El sandbox es tu escritorio con
los libros que te trajo — ahí haces lo que quieras, pero **no puedes volver a
la biblioteca por tu cuenta**.

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
| Límite de tiempo y volumen | Ver §6.2 |
| El código queda registrado | "¿Cómo calculaste eso?" tiene respuesta literal |
| El resultado hereda las referencias de su entrada | La procedencia no se pierde |
| Todo supuesto del mundo se declara | El usuario ve qué contó como feriado, como viaje, como categoría |

### 6.2 Límites de volumen y tiempo

El cálculo opera en memoria, así que tiene tope de cuántas filas recibe.

**En Manzana el tope casi nunca se alcanza**, y conviene saber por qué antes
de diseñar alrededor de él. No estamos ante una tabla de millones de
registros: estamos ante los movimientos de una persona.

| Perfil de uso | Movimientos/año | 3 años |
|---|---|---|
| Promedio (3/día) | ~1.100 | ~3.300 |
| Activo (8/día) | ~2.900 | ~8.800 |
| Muy activo (15/día) | ~5.400 | ~16.000 |

El historial completo de prácticamente cualquier usuario cabe entero. El
límite es una salvaguarda de borde, no una restricción que el usuario vaya a
notar.

**La estrategia que hace que casi nunca importe: agregar primero, calcular
después.** Es un principio de diseño, no solo una protección.

```text
Mal:   traer los 16.000 movimientos
       → el sandbox los agrupa por día y luego compara
       → 16.000 filas moviéndose para producir dos números

Bien:  la consulta trae totales por día (≈1.000 días en 3 años)
       → el sandbox marca cuáles fueron feriado o puente y compara
       → 1.000 filas, mismo resultado
```

El cálculo casi nunca necesita las filas crudas: necesita lo justo para
aplicar el conocimiento que la base no tiene. Si después el usuario pide
"¿cuáles fueron esos gastos?", ahí sí se piden los movimientos de esos días
concretos, que son pocos.

> **Regla: traer lo mínimo necesario para el cálculo, no todo lo que
> existe.**

**Cuando sí se alcanza el límite**, tres salidas en orden de preferencia:

1. **Reformular agregando en la consulta.** Cubre la mayoría de los casos.
2. **Acotar y decirlo.** *"Miré los últimos 2 años y no los 5 completos,
   para responderte rápido. ¿Quieres que revise todo?"* — el usuario decide.
3. **Decir que no cabe.** Solo si las dos anteriores no aplican.

Lo que **nunca** se hace: responder con una muestra presentándola como el
total. Analizar 2.000 de 16.000 movimientos y dar el resultado como completo
es exactamente el fallo que esta arquitectura existe para evitar.

**Límite de tiempo.** Además del volumen hay tope de ejecución. Es más
probable que se active este que el de volumen, porque el riesgo real no es
el tamaño de los datos sino que el código generado sea ineficiente. Un
cálculo que excede su tiempo se corta y no devuelve resultados parciales.

### 6.3 Comprobaciones de sanidad

El riesgo del cálculo libre es una cifra bien formada y mal calculada. Antes
de emitir:

- Una suma parcial no supera el total de su conjunto de entrada.
- Un conteo no supera las filas de entrada.
- Un porcentaje está entre 0 y 100.
- Una fecha resultante cae dentro del rango de los datos.
- El resultado no es `NaN`, infinito ni nulo inesperado.

Si una falla, **el resultado no se emite**. Se responde con honestidad y el
fallo se registra como defecto.

### 6.4 Transparencia

Todo resultado calculado explica su procedimiento en lenguaje del usuario:

```text
Tomé tus movimientos de los últimos 6 meses, marqué los días que fueron
feriado o puente, y comparé el promedio de esos días contra el resto.
```

Se muestra el procedimiento y los supuestos, no el código. El código queda
registrado para soporte.

Esto importa más de lo que parece: si "¿de dónde sale esta cifra?" se
respondiera mostrando un programa, la explicabilidad sería nominal. Un
procedimiento en lenguaje natural es lo que una persona puede verificar.

## 6b. El sistema aprende de su propio uso

El cálculo aislado no es solo una válvula de escape: es **el mecanismo por el
que el vocabulario descubre qué le falta**.

### 6b.1 El ciclo

```text
1. Llega una pregunta que el vocabulario no cubre
2. El motor la resuelve calculando sobre datos consultados
3. Se registra qué se calculó
4. Si ese mismo cálculo se repite en muchos turnos y usuarios
   → se PROMUEVE a dimensión o medida declarada
5. A partir de ahí deja de generarse: es rápida, determinista,
   indexada, probada, y está disponible para todos
```

Lo que empieza como cálculo improvisado termina siendo parte del vocabulario
estable. Cada análisis creativo deja algo atrás en vez de reinventarse cada
vez.

La promoción resuelve además tres problemas de golpe:

| Problema del cálculo generado | Qué pasa al promover |
|---|---|
| No es determinista: la misma pregunta puede generar código distinto | Pasa a ser una dimensión fija |
| Es lento: hay que traer filas y calcular | Se resuelve en el servidor, con índice |
| No está probado | Entra al conjunto de pruebas como cualquier dimensión |

### 6b.2 El filtro: qué se promueve y qué no

**No todo lo que se usa mucho debe promoverse.** Este es el punto donde el
ciclo podría deshacer la separación de §2.

| Se promueve | No se promueve |
|---|---|
| Lo que **depende de datos del usuario**: frecuencia de comercio, días desde el pago, desviación del propio promedio, relación entre entidades | El **conocimiento del mundo**: feriados, puentes, temporadas, rubros comerciales, estacionalidad |

Si "días de feriado" se usara en el 30% de las preguntas, la tentación sería
promoverlo a una tabla. **No se hace.** Promoverlo lo congela, exige
mantenerlo, y obliga a cargar una tabla por país al expandirse — exactamente
el problema que §2 evita. Ese conocimiento se sigue aportando desde el
modelo, declarado como supuesto.

La regla en una línea:

> Se promueve lo que le pertenece a la base. Lo que le pertenece al mundo se
> queda en el modelo, por mucho que se use.

### 6b.3 Qué se mide para decidir

Se registra por cálculo generado: qué agrupación o medida produjo, cuántos
turnos la usaron, cuántos usuarios distintos, y cuánto costó en tiempo.

Candidato a promoción: un cálculo recurrente, en varios usuarios, sobre datos
del usuario, y que sea caro de recomputar. Los tres criterios juntos — si
solo lo pide una persona, o si es trivial de calcular, no compensa ampliar el
vocabulario.

### 6b.4 La señal de salud

**La proporción de turnos que necesitan cálculo aislado debería bajar con el
tiempo, no subir.** Si sube, el vocabulario se está quedando corto respecto
a lo que la gente pregunta, y hay que ampliarlo.

Es la métrica que dice qué construir después sin tener que adivinarlo.

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
consultas, falta algo en el panorama. Si sube el cálculo, falta vocabulario —
y el ciclo de §6b convierte esa señal en capacidad permanente.

**El uso de los niveles inferiores es el instrumento que dice qué construir
después, sin tener que adivinarlo.**

Regla de preferencia: se usa siempre el nivel más alto que alcance. Cada
nivel hacia abajo es más lento, más caro y menos determinista que el
anterior.

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
  expresarlo. Evidencia: `TEST`. Cierra en `W-16` fase 4: `SemanticQuery`
  (`src/core/semantics/query.ts`) no tiene campo `user_id`;
  `compileSemanticQuery(query, userId)` lo recibe como segundo parámetro,
  nunca del objeto de consulta (`compiler.test.ts`, "AC-SEM-01"), y
  `executeSemanticQuery` lo inyecta como único `.eq("user_id", …)` real
  contra Supabase (`tool-gateway.test.ts`). Cierra solo para `movimientos`
  (`WEB-D257`).
- `AC-SEM-02` — El modelo del dominio no contiene conocimiento del mundo
  (feriados, rubros, estacionalidad). Evidencia: `TEST`. Clase: `corpus`.
  Cierra en `W-16` fase 4: `domain.test.ts` recorre `ENTIDADES_SEMANTICAS`
  buscando "feriado"/"puente"/"temporada"/"estacional"/"rubro" y falla si
  aparecen.
- `AC-SEM-03` — Cuando el motor usa conocimiento del mundo en un cálculo, lo
  declara como supuesto visible. Evidencia: `TEST` + `USER`. Cierra en `W-16`
  fase 4 solo la mitad estructural: `runIsolatedCalculation` exige
  `explicacion` y acepta `supuestos: string[]`, y `figure_without_assumptions`
  (fase 3) rechaza una proyección sin supuestos. No cierra: nada invoca
  todavía el sandbox desde el motor real con un cálculo que use conocimiento
  del mundo — el llamador que declararía el supuesto no existe (`USER`
  tampoco, sin sesión real).
- `AC-SEM-04` — El panorama cargado se mantiene por debajo de su presupuesto
  de tokens independientemente de los años de uso. Evidencia: `TEST` + `METRIC`.
  No tocado por `W-16`: el "panorama cargado" de `20b` §4 (resúmenes
  mensuales comprimidos, patrones precalculados) no se construyó en ninguna
  fase — el motor real sigue cargando movimientos recientes vía
  `DataContextPack`/`ConversationContextPack`, no el panorama de `26k`
  tokens estables que este documento describe.
- `AC-SEM-05` — Toda cifra del panorama y de toda consulta lleva sus
  referencias. Evidencia: `TEST`. Cierra en `W-16` fase 4 para la consulta
  abierta: `executeSemanticQuery` siempre devuelve `referencias` junto a
  `filas` (`compiler.test.ts`, "con evidencia por construccion"). No cierra
  para "el panorama": no existe todavía (ver `AC-SEM-04`).
- `AC-SEM-06` — El cálculo aislado no tiene acceso a base de datos, red ni
  ficheros. Evidencia: `TEST`. Cierra en `W-16` fase 4:
  `src/core/semantics/sandbox.ts` no importa ningún cliente de datos, red ni
  fichero — garantía estructural, no solo de comportamiento (`grep` del
  fichero no encuentra ningún `import` fuera de tipos propios).
- `AC-SEM-07` — Un resultado calculado que falla una comprobación de sanidad
  no se emite. Evidencia: `TEST`. Cierra en `W-16` fase 4: las cinco
  comprobaciones de `§6.3` están implementadas
  (`comprobarSumaParcialNoSuperaTotal`, `comprobarConteoNoSuperaFilas`,
  `comprobarPorcentajeEnRango`, `comprobarFechaEnRangoDeEntrada`, y la
  comprobación básica de `NaN`/infinito integrada en
  `runIsolatedCalculation`), probadas con `RUL-HECHO-02` en `sandbox.test.ts`.
- `AC-SEM-08` — Todo resultado calculado explica su procedimiento y sus
  supuestos en lenguaje del usuario. Evidencia: `TEST` + `USER`. Cierra en
  `W-16` fase 4 solo la parte estructural: `explicacion` es un campo
  obligatorio de `IsolatedCalculationInput`. No cierra: nadie llama al
  sandbox desde el motor real todavía (mismo hueco que `AC-SEM-03`).
- `AC-SEM-09` — Las siete preguntas de §8 se responden correctamente sin
  código específico para ninguna. Evidencia: `TEST` + `USER`. No cierra:
  ninguna de las siete depende solo de lo que `W-16` construyó (todas
  necesitan conocimiento del mundo aportado por el modelo en un cálculo real
  contra el sandbox, que no está conectado al motor todavía).
- `AC-SEM-10` — Un usuario de otro país obtiene respuestas correctas sobre
  sus feriados y temporadas sin cargar datos de ese país. Evidencia: `TEST`.
  No tocado por `W-16` — depende de `AC-SEM-09`.
- `AC-SEM-11` — Cuando nada alcanza, el motor lo dice y ofrece la
  alternativa más cercana; nunca estima. Evidencia: `TEST` + `USER`. Parcial:
  el compilador rechaza con un código de error explícito
  (`dimension_no_compilable`, `medida_no_compilable`, `predicado_no_compilable`)
  en vez de fallar en silencio o inventar, pero nada en el motor real
  traduce ese rechazo a una respuesta para el usuario todavía.
- `AC-SEM-12` — Un cálculo que excede su límite de volumen se reformula
  agregando en la consulta, se acota declarándolo, o se rechaza. **Nunca se
  responde con una muestra presentada como total.** Evidencia: `TEST`.
  Cierra en `W-16` fase 4 la tercera vía (rechazo limpio, sin resultado
  parcial): `runIsolatedCalculation` devuelve `emitido:false` cuando
  `filas.length > 50_000`, probado con `RUL-HECHO-02`
  (`sandbox.test.ts`, "AC-SEM-12"). No cierra las vías 1 y 2 (reformular,
  acotar y decirlo): son decisiones del agente en el turno, no del sandbox.
- `AC-SEM-13` — Un cálculo que excede su límite de tiempo se corta sin
  devolver resultados parciales. Evidencia: `TEST`. Cierra en `W-16` fase 4:
  `runIsolatedCalculation` mide el tiempo real de ejecución contra
  `LIMITE_TIEMPO_MS_CALCULO_AISLADO` (3.000 ms) y rechaza sin resultado
  parcial; probado con un cálculo deliberadamente lento (busy-loop real, no
  simulado) que confirma el corte real (`sandbox.test.ts`, "AC-SEM-13").
- `AC-SEM-14` — Se registra cada cálculo generado con su frecuencia de uso y
  número de usuarios, para alimentar el ciclo de promoción. Evidencia:
  `METRIC`. No tocado por `W-16`: ningún registro de uso del sandbox existe
  todavía — coherente con que nada lo invoca desde el motor real.
- `AC-SEM-15` — Ningún conocimiento del mundo se promueve al vocabulario,
  sea cual sea su frecuencia de uso. Evidencia: `TEST`. Clase: `corpus`. No
  cierra: el ciclo de promoción de `§6b` (calcular → contar usos → promover
  a dimensión) no existe en código; no hay nada que promueva nada todavía,
  así que la regla es vacuamente cierta, no verificada.
- `AC-SEM-16` — La proporción de turnos que requieren cálculo aislado se
  revisa periódicamente y tiende a bajar. Evidencia: `METRIC`. No tocado por
  `W-16`.
