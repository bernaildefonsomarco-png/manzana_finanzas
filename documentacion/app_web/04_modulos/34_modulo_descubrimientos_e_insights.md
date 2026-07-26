# 34 — Módulo: Descubrimientos e insights

**ID de módulo:** `MOD-DESCUBRIMIENTOS`
**Bloque:** 04 — Módulos
**Alcance:** V1 (reescritura)
**Fecha:** 26 de julio de 2026
**Docs fuente:** `docs/fase_2_estrategia/alcance_v1/05g_insights.md` (1.651 líneas, reescrito — ver §22), migración `027_advanced_insights`, `32` (presupuestos), `33` (proyecciones)
**Documentos que dependen de este:** `36` (memoria), `37` (recordatorios), `39` (home), `41` (asistente)

---

## 1. Tesis y qué NO es

Un descubrimiento es **algo que el usuario no sabía sobre su propio dinero y
que puede usar hoy**. Las dos mitades importan por igual: si ya lo sabía, es
un resumen; si no puede hacer nada con ello, es trivia.

La reescritura corrige tres cosas del diseño anterior. La primera es la que
gobierna todas las demás.

**El diseño anterior tenía una sola clase de descubrimiento: la inferida del
historial.** Toda su tabla de umbrales (`05g` §9) cuenta movimientos
acumulados —5, 10, 20, 40— y encadena las capacidades a ese contador. Eso
tenía sentido cuando la captura iba por WhatsApp y el volumen llegaba solo.
En una app web con registro manual, significa semanas de producto callado.

Pero la mayor parte de lo que se le puede decir a alguien sobre su dinero **no
sale de inferir patrones: sale de lo que esa persona ya declaró**. Quien
registra una deuda el primer día tiene una cuota que vence, una proporción de
su dinero comprometida y una caja que la cubre o no la cubre. Nada de eso
necesita historial. Necesita una cuenta y un dato.

Ese es el reencuadre: **dos clases de descubrimiento, con requisitos de datos
distintos** (§6, `RUL-DESC-01`). Los derivados de lo declarado funcionan desde
el primer día. Los inferidos del historial siguen necesitando volumen, y está
bien que lo necesiten.

La segunda corrección: **los umbrales se declaran por dimensión, no por un
contador global** (`RUL-DESC-03`). Que alguien tenga 40 movimientos no dice
nada sobre si se puede afirmar algo de su gasto en delivery. `05g` ya tenía
esta idea, en una subsección de tres ejemplos (§9.2); aquí es la regla que
gobierna.

La tercera: **accionable significa que el descubrimiento conecta con una
herramienta del producto**, no que trae un consejo. "Transporte subió S/42" es
descriptivo. "Transporte subió S/42 · [Ver qué subió] [Ponerle presupuesto]"
es accionable. "Deberías gastar menos en transporte" está prohibido
(`22` §8). La diferencia no es de tono: es que ahora existen presupuestos,
cajas, metas y proyecciones a los que llevar al usuario, y en `05g` no
existían.

**Qué NO es este módulo:**

- **No es un informe.** Un reporte responde una pregunta que el usuario hizo;
  un descubrimiento le cuenta algo que no preguntó. Los reportes son el
  módulo 35.
- **No es una alerta.** Un descubrimiento espera en su pantalla; una alerta va
  a buscar al usuario. La entrega proactiva es el módulo 37, con su política
  de fatiga.
- **No es un consejo.** Describe lo que pasó y ofrece herramientas. Nunca dice
  qué debería hacer alguien con su dinero.
- **No es un diagnóstico de la persona.** Se observan patrones de gasto, no se
  emiten juicios sobre quien gasta.
- **No es el motor conversacional.** Si el usuario pregunta, responde el
  asistente (`20b`). Este módulo es lo que aparece **sin** preguntar.

## 2. Alcance

| Nivel | Funcionalidad |
|---|---|
| **IN** | Las tres clases de descubrimiento de `RUL-DESC-01` con sus 17 tipos. Umbrales por dimensión. Evidencia trazable a movimientos concretos en todos. Ligados a presupuestos, proyecciones, compromisos, deudas y cajas, no solo a comparativas históricas. Marcar visto, útil o no útil. Recálculo y expiración cuando cambian los datos base. Explicación de por qué se generó. Los dos niveles de hallazgo de `WEB-D016`. |
| **V1.1** | Comparativas entre periodos largos (trimestre, año). Resumen semanal como pieza narrativa única. Descubrimientos que cruzan más de dos módulos. |
| **FUERA** | Comparación con otros usuarios o promedios de mercado. Diagnóstico de la persona. Recomendación de recortes. Predicción de ingresos no declarados. Entrega proactiva por cualquier canal (es el módulo 37). |

Nada de lo que está FUERA es "todavía no": son cuatro cosas prohibidas y una
que vive en otro módulo.

## 3. Vocabulario

| Interno | Visible |
|---|---|
| `Insight` | Descubrimiento · "Algo que noté" · "Lo que vi esta semana" |
| `insight_candidate` | — (nunca visible) |
| `quality_score`, `rank_score`, `confidence` | — (**nunca visibles**, `C-11`) |
| `fingerprint` | — |
| `outdated` | "Esto cambió desde que lo vi" |
| `evidence` | "De dónde sale esto" |
| `dismissed` | "No me sirve" |

Prohibido frente al usuario, además de la lista general de
`04_glosario_y_lenguaje_visible.md` §10: `insight`, `score`, `confianza`,
`patrón detectado`, `anomalía`, `algoritmo`, `analizado`, `procesado`.

Y una regla de encabezado: **el descubrimiento se enuncia, no se anuncia.**

```text
Correcto:   Este mes, 4 de cada 10 soles que gastaste fueron en comida.
Incorrecto: 💡 Insight detectado: concentración de categoría.
Incorrecto: Hemos analizado tus gastos y encontramos un patrón.
```

La segunda y la tercera hablan del sistema. La primera habla del dinero del
usuario, que es lo único que le importa.

## 4. Entidades y datos

### 4.1 `insight_candidates` — ya existe

Creada por la migración `027_advanced_insights`. Se conserva íntegra:

```sql
id, user_id
type              insight_type not null
fingerprint       text not null      -- identidad estable del hallazgo
status            insight_status not null default 'candidate'
period_start, period_end   date not null
confidence        numeric(5,4) not null    -- INTERNO, nunca visible
quality_score     integer not null         -- INTERNO
rank_score        integer not null         -- INTERNO
risk_level        risk_level not null default 'low'
title, body, evidence_text   text not null
evidence          jsonb not null default '{}'
source_facts      jsonb not null default '{}'
source_entity_ids text[] not null default '{}'
action            jsonb
expires_at, narrated_at, displayed_at, outdated_at   timestamptz
metadata, created_at, updated_at
```

`fingerprint` es la pieza que hace todo lo demás posible: identifica el
**mismo hallazgo** entre ejecuciones. Sin él no se puede saber si un
descubrimiento es nuevo, si ya se descartó o si el que hay en pantalla quedó
obsoleto. Su composición se define en `RUL-DESC-11`.

`confidence`, `quality_score` y `rank_score` son de ordenación interna.
**Ninguno aparece nunca en una superficie**, ni como número ni como barra ni
como etiqueta ("confianza alta"). Es `C-11`, y aquí es donde más fácil sería
incumplirlo.

### 4.2 `insight_deliveries` — ya existe, uso reducido

```sql
id, user_id, insight_candidate_id
channel   text check (channel in ('dashboard','whatsapp'))
status    text check (status in ('planned','sent','delivered','seen','failed'))
delivered_at, seen_at, metadata, created_at
```

En V1-web solo se usa `channel = 'dashboard'`. El valor `whatsapp` queda en la
restricción sin usar, para la fase 2. Lo mismo con el estado `sent` del enum
`insight_status`: en V1-web nada se envía, se muestra.

### 4.3 Migración `060` — lo que falta

**Cuatro tipos nuevos** en `insight_type`, todos de la clase A, todos
imposibles antes porque sus módulos de origen no existían:

```sql
alter type insight_type add value 'budget_risk';          -- 32
alter type insight_type add value 'goal_pace';            -- 32
alter type insight_type add value 'commitment_uncovered'; -- 30 + 24
alter type insight_type add value 'merchant_pattern';     -- clase B
```

**Feedback del usuario**, que `07` §3.11 exige y no tenía dónde vivir:

```sql
alter table insight_candidates
  add column feedback     insight_feedback null,   -- util | no_util
  add column feedback_at  timestamptz null;

create type insight_feedback as enum ('util', 'no_util');
```

Se guarda en el candidato y no en la entrega porque el juicio es sobre **el
descubrimiento**, no sobre la vez que se mostró. Si el mismo hallazgo
reaparece en otro periodo, su historial de utilidad acompaña al
`fingerprint`, que es lo que alimenta `RUL-DESC-14`.

Un índice más:

```sql
create index on insight_candidates (user_id, type, feedback);
```

### 4.4 De dónde salen los datos

| Fuente | Qué aporta |
|---|---|
| `24` Cuentas y cajas | Dinero libre, cobertura de compromisos por caja |
| `26` Movimientos | La materia prima de todo lo inferido |
| `27` Pendientes | Calidad de datos: lo que falta confirmar |
| `28` Correo | Volumen de captura pasiva, que acelera la clase B |
| `30` Pagos que vienen | Compromisos, cobertura, recurrentes candidatos |
| `31` Deudas | Cuotas, vencimientos, progreso |
| `32` Presupuestos y metas | **La fuente más productiva de la clase A** |
| `33` Proyecciones | Ritmo, cierre estimado |
| `20c` Perfil | Cómo se le habla, qué le interesa |

## 5. Máquina de estados

```text
   candidate ──► validated ──► ranked ──► narrated ──► displayed
       │             │                                     │
       │             └──► (descartado en silencio)         │
       │                   si pierde evidencia             │
       ▼                                                   ▼
   expired ◄───────────────────────────────── acted | dismissed | ignored
                                                           │
                                              outdated ◄───┘
                                         (los datos base cambiaron)
```

| Estado | Significado |
|---|---|
| `candidate` | Señal detectada, sin validar |
| `validated` | Pasó los umbrales de `RUL-DESC-03` y la evidencia existe |
| `ranked` | Tiene prioridad calculada |
| `narrated` | Tiene texto listo |
| `displayed` | Se mostró al usuario |
| `acted` | El usuario usó una de sus acciones |
| `dismissed` | El usuario dijo que no le sirve |
| `ignored` | Se mostró, se vio, no pasó nada |
| `outdated` | Se mostró y después cambiaron los datos que lo sostienen |
| `expired` | Dejó de ser relevante |
| `sent` | Sin uso en V1-web (fase 2) |

Los cuatro primeros estados son internos y ocurren en la misma ejecución del
cálculo. **El usuario solo ve `displayed` en adelante.**

`outdated` es el estado que más trabajo hace y el que más fácil se omite al
implementar: ver `RUL-DESC-08`.

## 6. Reglas de negocio

**`RUL-DESC-01` — Tres clases, con requisitos de datos distintos**

Es la regla que reordena el módulo entero.

| Clase | De dónde sale | Qué necesita |
|---|---|---|
| **A — Derivados de lo declarado** | El usuario declaró un presupuesto, una deuda, un compromiso, una caja o una meta | La declaración, y a veces un movimiento |
| **B — Inferidos del historial** | Un patrón que nadie declaró y el sistema observa | Volumen **en su dimensión** |
| **C — De progreso** | Algo que el usuario hizo y merece verse | Un hecho consumado |

Los diecisiete tipos, con lo que exige cada uno:

**Clase A — funcionan desde el primer día**

| Tipo | Qué dice | Requiere |
|---|---|---|
| `budget_risk` | El ritmo llegaría al presupuesto antes de que acabe el periodo | 1 presupuesto activo + 3 gastos en su categoría |
| `goal_pace` | El ritmo de aporte llegaría o no a la meta en su fecha | 1 meta con fecha + 2 aportes |
| `commitment_uncovered` | Un pago que viene no está apartado en ninguna caja | 1 compromiso en 30 días |
| `debt` | Una cuota vence, o pesa una proporción alta de lo que queda | 1 deuda activa con cuota |
| `free_money` | El dinero libre no alcanza lo que viene | 1 cuenta con saldo + 1 compromiso |
| `box_saving` | Una caja de compromiso tiene menos de lo que su compromiso necesita | 1 caja vinculada |
| `projection` | El cierre del periodo, con sus supuestos | Lo que exija `RUL-PROY-04` (7 días) |
| `data_quality` | Falta algo que impide calcular bien | 1 movimiento sin cuenta, o 1 pendiente sin confirmar |

**Clase B — necesitan volumen en su dimensión**

| Tipo | Qué dice | Requiere |
|---|---|---|
| `category_concentration` | Dónde se va el dinero del periodo | 10 gastos en el periodo, y ≥3 en la categoría que se nombra |
| `comparative` | Qué cambió entre dos periodos | 2 periodos comparables con ≥5 gastos cada uno |
| `anomaly` | Un gasto se sale de lo habitual de esa categoría | 6 gastos previos en la categoría, y desviación ≥2× la mediana |
| `merchant_pattern` | Un comercio se repite más de lo que el usuario cree | 4 movimientos del mismo comercio en 60 días |
| `temporal_pattern` | Un patrón por día de la semana o momento del mes | 4 semanas con actividad y ≥3 ocurrencias del patrón |
| `recurring` | Un pago parece repetirse | Lo que exija el módulo 30 |
| `contextual` | Algo que el usuario contó y se refleja en sus números | 1 hecho de perfil confirmado + evidencia en movimientos |

**Clase C — reconocen lo hecho**

| Tipo | Qué dice | Requiere |
|---|---|---|
| `learning_progress` | Qué va entendiendo Manzana, sin fingir patrones | 3 movimientos |
| `progress` | Algo salió bien: cuota pagada, meta avanzada, periodo cerrado dentro del presupuesto | El hecho consumado |

**Sobre no bajar el umbral de `temporal_pattern`.** Sigue en 4 semanas, que es
lo mismo que pedía `05g`, y es deliberado: bajarlo a dos semanas no lo haría
más útil, lo haría falso. Para decir "gastas más los viernes" hacen falta
varios viernes. **El error de `05g` no fue ese número, fue que ese número
gobernaba la experiencia entera.** Con la clase A, el usuario tiene
descubrimientos desde el primer día y los patrones temporales llegan cuando de
verdad se sostienen. Un umbral honesto deja de doler en cuanto no es el único
camino.

**`RUL-DESC-02` — Lo declarado se lee, no se adivina**

Un descubrimiento de clase A **nunca infiere lo que el usuario ya dijo**. Si
hay un presupuesto de S/400 en Alimentación, ese es el número; no se estima
uno "razonable" ni se sugiere que el declarado esté mal.

Consecuencia práctica: la clase A no tiene incertidumbre estadística. Su
`confidence` interna es siempre 1. Lo único que puede fallar es la aritmética,
y para eso está la evidencia.

**`RUL-DESC-03` — Los umbrales son por dimensión, nunca globales**

No existe un contador de movimientos totales que habilite capacidades. **Cada
tipo declara lo que necesita en la dimensión sobre la que habla**, y esa es la
única condición.

```text
Usuario con 60 movimientos, de los cuales 1 es de delivery:
  → NO se genera ningún descubrimiento sobre delivery.
    Un solo movimiento no sostiene ninguna afirmación, tenga
    el usuario 60 movimientos o 6.000.

Usuario con 12 movimientos, de los cuales 5 son del mismo comercio:
  → SÍ se genera `merchant_pattern` en cuanto llegue el sexto
    dentro de la ventana. La dimensión tiene evidencia aunque
    el total sea pequeño.
```

Un contador global mide el uso del producto, no si una afirmación es
sostenible. Encadenar capacidades a él fue el error estructural de `05g` §9, y
es lo que hacía que el producto callara durante semanas teniendo cosas ciertas
que decir.

Corolario: **un usuario que solo registra deudas recibe descubrimientos
útiles.** No hay ningún requisito de tener gastos.

**`RUL-DESC-04` — Ningún descubrimiento sin evidencia navegable**

Todo descubrimiento guarda las referencias de las filas concretas que lo
sostienen (`source_entity_ids`, `evidence`), y toda cifra que aparezca en su
texto sale de esas filas. Es la invariante de `22` §2 aplicada aquí.

Verificación al validar: si el conjunto de evidencia está vacío o alguna de
sus referencias ya no existe, **el candidato se descarta en silencio**. No se
muestra un descubrimiento cuya evidencia no se puede abrir.

**`RUL-DESC-05` — Accionable es ofrecer una herramienta, no un consejo**

```text
Correcto:
  A este ritmo, Alimentación llegaría a los S/400 alrededor del 24.
  Llevas S/318 en 14 compras y quedan 7 días del mes.
  [Ver las 14 compras]  [Ajustar el presupuesto]

Incorrecto (consejo):
  Vas a superar tu presupuesto de Alimentación. Deberías reducir
  tus salidas a comer esta semana.

Incorrecto (descriptivo sin salida):
  Has gastado S/318 en Alimentación este mes.
```

La primera versión lleva a dos herramientas del producto y deja la decisión
donde estaba. La segunda es asesoría, prohibida por `22` §8. La tercera es lo
que hacía `05g`: cierta, y sin nada que hacer con ella.

**No todo descubrimiento necesita acción.** A veces el valor es solo la
claridad, y en ese caso se muestra sin botones antes que con un botón forzado:

```text
Este mes tu mayor cambio fue transporte: S/42 más que el mes pasado.
```

**`RUL-DESC-06` — Los dos niveles no se mezclan**

Aplicación de `WEB-D016` y `22` §9.

| Nivel | Qué es | Cómo se muestra |
|---|---|---|
| **Determinístico** | Calculado por los motores sobre datos consultados | Afirmación normal, con su evidencia |
| **Observación** | Lectura del modelo sobre datos ya traídos | Marcada visualmente como impresión |

Los diecisiete tipos de `RUL-DESC-01` son **determinísticos sin excepción**.
Las observaciones del modelo no se persisten como `insight_candidates`: viven
en la conversación (`41`), donde el usuario puede repreguntar.

La razón de no mezclarlos en esta pantalla: un descubrimiento que aparece solo
tiene todo el peso de una afirmación del producto. Una impresión necesita el
contexto de la conversación para poder ser matizada.

**`RUL-DESC-07` — Qué movimientos cuentan**

| Cuenta | No cuenta |
|---|---|
| `gasto`, `ingreso`, `pago_recurrente`, `pago_deuda` | `transferencia` y `asignacion_interna`: mover dinero propio no es actividad |
| Movimientos confirmados de cualquier origen | `ajuste`: es corrección, no comportamiento |
| | Pendientes sin confirmar (`27`) |
| | Movimientos eliminados |

Los movimientos con cuenta `null` **cuentan para categorías y comercios, pero
no sostienen ningún descubrimiento de liquidez**: no se sabe de dónde salió
ese dinero. Herencia directa de `05g` §25, que era correcta.

**`RUL-DESC-08` — Los datos cambian y el descubrimiento cambia con ellos**

| Estado | Qué pasa si cambian los datos base |
|---|---|
| `candidate`, `validated`, `ranked` | Se recalcula en silencio, o se descarta si pierde evidencia |
| `narrated` | Se regenera el texto |
| `displayed` | Pasa a `outdated` y se muestra la versión corregida **diciendo que cambió** |
| `acted` | Se conserva el historial; el impacto se recalcula |
| `dismissed` | No revive, salvo cambio material del `fingerprint` |
| `expired` | Queda archivado; si vuelve a ser relevante nace uno nuevo |

Lo que dispara el recálculo: crear, editar, eliminar o restaurar un
movimiento; confirmar un pendiente; cambiar una categoría; asignar una cuenta;
pagar una cuota; editar un presupuesto o una caja.

La forma visible de `outdated`:

```text
Delivery subió 38% esta semana.
  ↓ el usuario corrige 3 movimientos
Esto cambió: con tus correcciones, delivery subió 22%.
```

**Nunca se corrige en silencio un número que el usuario ya vio.** Cambiar la
cifra sin decirlo hace que el producto parezca haberse equivocado dos veces:
una al dar el número viejo y otra al no admitirlo. Decir que cambió, y por
qué, convierte el error en una demostración de que las correcciones sirven —
que es exactamente lo que se quiere enseñar.

**`RUL-DESC-09` — Cada tipo expira cuando deja de ser cierto**

| Tipo | Expira |
|---|---|
| `learning_progress` | Al aparecer el primer descubrimiento de otra clase, o a los 7 días |
| `comparative` | Al empezar el periodo siguiente |
| `category_concentration` | Al cerrar el periodo analizado |
| `temporal_pattern` | A los 30 días sin reforzarse |
| `anomaly` | A los 7 días, o cuando el comportamiento vuelve a lo habitual |
| `merchant_pattern` | A los 30 días sin nueva ocurrencia |
| `projection` | Al cerrar el periodo, o cuando cambian saldos o compromisos |
| `free_money`, `commitment_uncovered`, `box_saving` | Cuando cambia el saldo, la caja o el compromiso que lo sostiene |
| `budget_risk` | Al cerrar el periodo del presupuesto, o si se ajusta el monto |
| `goal_pace` | Al alcanzar la meta, o si cambia el objetivo o la fecha |
| `recurring` | Cuando el usuario confirma o rechaza, o el patrón deja de repetirse |
| `debt` | No expira mientras la deuda esté activa; los puntuales de una cuota, al pagarse |
| `progress` | Al cerrar el periodo, o al generarse uno más reciente |
| `contextual` | Cuando el hecho de perfil que lo sostiene se suspende o expira (`36`) |
| `data_quality` | Cuando se resuelve el dato que faltaba |

Un descubrimiento expirado **no se borra**: pasa a `expired` y sigue
consultable en el historial. Sirve para responder "¿qué me dijiste el mes
pasado?" y para medir si acertábamos.

**`RUL-DESC-10` — Cuántos se muestran**

| Superficie | Máximo |
|---|---|
| `/descubrimientos` | 5 activos a la vez |
| Inicio | 2 |
| Respuesta del asistente | 1, y solo si viene a cuento |

Cinco es el techo, no la meta: si solo hay dos que valen, se muestran dos. Una
pantalla con cinco descubrimientos mediocres vale menos que una con uno bueno,
porque enseña a no leerlos.

Orden: por `rank_score` interno, con los de clase A y C antes que los de clase
B cuando empatan. Lo derivado de lo que el usuario declaró le es más
reconocible que lo inferido de su historial.

**`RUL-DESC-11` — Identidad estable: el `fingerprint`**

```text
fingerprint = hash(tipo · dimensión · periodo · entidad)
```

Ejemplos:

```text
budget_risk · categoria=alimentacion · periodo=2026-07 · budget=b_31f
anomaly · categoria=transporte · fecha=2026-07-18 · movimiento=mov_9c2
merchant_pattern · comercio=Tambo · ventana=60d
```

El `fingerprint` **no incluye las cifras**. Es lo que permite que un
descubrimiento cuyo número cambió sea reconocido como el mismo (y pase a
`outdated`) en vez de nacer como uno nuevo. Si incluyera la cifra, cada
corrección del usuario generaría un descubrimiento duplicado.

Único por `(user_id, type, fingerprint)`, ya en la migración `027`.

**`RUL-DESC-12` — No se repite lo ya resuelto ni lo ya rechazado**

- Un `fingerprint` descartado (`dismissed`) no vuelve a mostrarse en el mismo
  periodo.
- Un `fingerprint` marcado `no_util` **dos veces** deja de generarse para ese
  usuario, y se registra como preferencia en `36`.
- Un tipo entero puede silenciarse desde configuración.

La segunda regla es la que impide el fallo más molesto: insistir con un tipo
de hallazgo que a esta persona no le sirve. Dos rechazos son señal, no
casualidad.

**`RUL-DESC-13` — Descubrimientos sensibles: se generan con más cuidado**

Categorías que pueden tocar algo delicado —salud, farmacia, y las que el
usuario haya marcado como sensibles en `45`— tienen tres restricciones:

1. Nunca aparecen en el Inicio, solo en `/descubrimientos`.
2. Nunca se enuncian como cambio de comportamiento ("estás gastando más en
   salud"), solo como dato del periodo.
3. Se ocultan enteras en modo discreto, no solo su monto.

La segunda es la importante: la diferencia entre "gastaste S/340 en farmacia
este mes" y "tu gasto en farmacia subió 60%" es que la segunda invita a una
conversación que el producto no tiene derecho a empezar.

**`RUL-DESC-14` — Progreso, no solo problemas**

Al menos **uno de cada tres descubrimientos mostrados debe ser de clase C**
cuando haya material para ello. No es decoración ni gamificación: es que un
producto que solo señala lo que va mal se percibe como un reproche, y se
abandona.

```text
Correcto:   Cerraste julio dentro de tus tres presupuestos.
Correcto:   Ya llevas 4 de las 12 cuotas de la laptop.
Incorrecto: ¡Racha de 3 meses! 🔥 Sigue así.
Incorrecto: ¡Felicidades, eres un ahorrador ejemplar!
```

Los dos correctos son hechos. Los dos incorrectos son halago, y el halago
inventa una relación que el usuario no pidió (`04` §10).

**`RUL-DESC-15` — El texto lo compone el motor determinista, no el modelo libre**

Cada tipo tiene su plantilla, con huecos que rellenan cifras ya calculadas y
verificadas. El modelo puede **adaptar el registro** según el perfil (`20c`
§5) —más corto, más formal, con o sin emoji— pero no puede cambiar una cifra,
añadir una comparación que no se calculó ni introducir una conclusión.

La razón es la de siempre: una cifra que el modelo escribe libremente es una
cifra que puede estar mal, y este módulo habla sin que nadie le pregunte, que
es donde un error cuesta más.

## 7. Validaciones

| Campo | Regla |
|---|---|
| `type` | Del enum, obligatorio |
| `fingerprint` | Obligatorio, no vacío, único por `(user_id, type)` |
| `period_start` / `period_end` | `period_end >= period_start`; ambos en `America/Lima` |
| `confidence` | Entre 0 y 1. Clase A siempre 1 |
| `quality_score`, `rank_score` | Enteros no negativos |
| `evidence` | Objeto JSON, **no vacío** |
| `source_entity_ids` | Al menos una referencia, y todas deben resolver |
| `title`, `body` | No vacíos; validados contra la lista de palabras prohibidas de §3 |
| `expires_at` | Obligatorio salvo en `debt` de deuda activa |
| `action` | Objeto JSON o nulo; si existe, su acción debe estar en el catálogo de §9 |
| `feedback` | `util` o `no_util`; si se indica, `feedback_at` obligatorio |

## 8. Superficies

**Referencia visual: parcial.** El Dashboard de `05c` tenía una tarjeta de
insights, descrita en `docs/fase_6_visual/32_especificacion_hifi.md` (Inicio).
`SCR-DESC-01` y `SCR-DESC-02` son nuevas y no tienen frame previo: `05g` §13.1
las daba por un bloque del Dashboard, no por pantallas propias. Tokens y
primitivas, de `16_design_system_web.md`.

### `SCR-DESC-01` — Descubrimientos

**Ruta:** `/descubrimientos`
**Estado en URL:** `tipo`, `historial`

```text
┌──────────────────────────────────────────────────┐
│ Lo que noté                                      │
├──────────────────────────────────────────────────┤
│ A este ritmo, Alimentación llegaría a los S/400  │
│ alrededor del 24.                                │
│ Llevas S/318 en 14 compras y quedan 7 días.      │
│ [Ver las 14]  [Ajustar el presupuesto]      [⋯]  │
├──────────────────────────────────────────────────┤
│ El alquiler del 1 (S/850) no está apartado en    │
│ ninguna caja. Ahora tienes S/560 libres.         │
│ [Crear una caja]  [Ver el compromiso]       [⋯]  │
├──────────────────────────────────────────────────┤
│ Ya llevas 4 de las 12 cuotas de la laptop.       │
│ Van S/720 de S/2,160.                            │
│                                             [⋯]  │
├──────────────────────────────────────────────────┤
│ Esto cambió · El sábado gastaste S/210 en        │
│ Transporte. Tus otros días están entre S/8 y     │
│ S/25. Antes decía S/240: corregiste un gasto.    │
│ [Ver ese día]                               [⋯]  │
├──────────────────────────────────────────────────┤
│                          [Ver los anteriores]    │
└──────────────────────────────────────────────────┘
```

Detalles que importan:

- **Sin encabezados de tipo.** No hay una sección "Anomalías" y otra
  "Patrones". El usuario no piensa en taxonomías; piensa en su dinero.
- El tercero es de clase C y no lleva acciones. Está bien: `RUL-DESC-05`.
- El cuarto muestra la forma visible de `outdated`, con la razón del cambio.
- `[⋯]` abre: de dónde sale esto · me sirve · no me sirve · no mostrar este
  tipo.
- "Ver los anteriores" lleva al historial de expirados, que es una pantalla de
  solo lectura.

### `SCR-DESC-02` — De dónde sale esto

**Ruta:** `/descubrimientos/[id]`

La materialización de `RUL-DESC-04`. Muestra, en este orden:

```text
Qué miré        14 gastos de Alimentación, del 1 al 26 de julio
Qué no conté    2 transferencias, 1 pendiente sin confirmar
Contra qué      Tu presupuesto de S/400, que pusiste el 1 de julio
Cómo lo calculé S/318 en 26 días = S/12.20 al día
                A ese ritmo, S/400 se alcanzan el 24
Los movimientos [lista navegable de los 14]
```

"Qué no conté" es la línea que más confianza construye y la que más fácil se
omite. Alguien que ve que excluimos las transferencias entiende que sabemos lo
que estamos haciendo; alguien que solo ve el resultado tiene que creernos.

**No se expone el razonamiento del modelo**, ni los scores internos, ni la
confianza. Solo la aritmética y sus entradas.

### `SCR-DESC-03` — Lo que noté, en el Inicio

Componente. Máximo dos, nunca sensibles (`RUL-DESC-13`), con enlace a la
pantalla completa. Si no hay ninguno que valga, **el componente no aparece**;
no se rellena con un placeholder.

### `SCR-DESC-04` — Historial

**Ruta:** `/descubrimientos?historial=1`

Los expirados y descartados, por fecha, en solo lectura. Sirve para "¿qué me
dijiste el mes pasado?".

## 9. Acciones

| ID | Acción | ¿Confirma? | Deshacer | Evento |
|---|---|---|---|---|
| `ACT-DESC-01` | Ver un descubrimiento | No | — | `descubrimiento.visto` |
| `ACT-DESC-02` | Ver de dónde sale | No | — | `descubrimiento.evidencia_consultada` |
| `ACT-DESC-03` | Marcar útil | No | Desmarcando | `descubrimiento.util` |
| `ACT-DESC-04` | Marcar no útil | No | Desmarcando | `descubrimiento.no_util` |
| `ACT-DESC-05` | Descartar | No | Restaurando | `descubrimiento.descartado` |
| `ACT-DESC-06` | No mostrar este tipo | Sí | Reactivando en `45` | `descubrimiento.tipo_silenciado` |
| `ACT-DESC-07` | Ver los movimientos que lo sostienen | No | — | `descubrimiento.movimientos_vistos` |
| `ACT-DESC-08` | Ir a la herramienta que ofrece | No | La de destino | `descubrimiento.accion_tomada` |
| `ACT-DESC-09` | Ver el historial | No | — | `descubrimiento.historial_visto` |

`ACT-DESC-08` no ejecuta nada: **navega**. Un descubrimiento nunca crea un
presupuesto, una caja ni un movimiento; lleva al usuario a la pantalla donde
él lo hace, con los campos precargados. Es la misma frontera que el módulo 33
(`WEB-D038`), por la misma razón: lo que se muestra sin que nadie lo pida no
debería poder cambiar nada.

Catálogo de destinos de `ACT-DESC-08`, heredado y ampliado de `05g` §12:

| Destino | Cuándo |
|---|---|
| Ver movimientos filtrados | Siempre disponible |
| Ajustar presupuesto (`32`) | `budget_risk` |
| Crear presupuesto (`32`) | `category_concentration`, `comparative` |
| Crear caja (`24`) | `commitment_uncovered`, `box_saving` |
| Vincular meta a caja (`32`) | `goal_pace` sin respaldo |
| Confirmar recurrente (`30`) | `recurring` |
| Revisar pendientes (`27`) | `data_quality` |
| Asignar cuenta (`26`) | `data_quality` de cuenta nula |
| Corregir categoría (`26`) | `anomaly`, `category_concentration` |
| Ver la deuda (`31`) | `debt` |

## 10. API

| Método y ruta | Notas |
|---|---|
| `GET /insights` | Activos, ordenados, con evidencia resumida. Filtro `type`, `include_expired` |
| `GET /insights/[id]` | Detalle con evidencia completa y movimientos |
| `POST /insights/[id]/feedback` | `{ value: "util" \| "no_util" }`. Idempotente |
| `POST /insights/[id]/dismiss` | Descarta. Idempotente |
| `POST /insights/[id]/seen` | Marca visto. Idempotente |
| `POST /insights/types/[type]/mute` · `/unmute` | Silencia un tipo |
| `GET /insights/summary` | Los dos del Inicio. Bajo 200 ms |

Ninguna ruta genera descubrimientos bajo demanda: el cálculo es del trabajo de
§17. Un `GET` que dispara un pipeline de análisis es un `GET` que tarda
segundos y se cae bajo carga.

Todas devuelven `evidence_refs` (`22` §2). Ninguna devuelve `confidence`,
`quality_score` ni `rank_score`: **no se serializan al cliente en ningún
caso.** Un campo que no llega al navegador no se puede pintar por accidente, y
es la única forma robusta de cumplir `C-11`.

## 11. Permisos y RLS

- Cliente autenticado en todas las rutas. RLS por `user_id` en
  `insight_candidates` e `insight_deliveries`.
- **Una excepción de service-role, en la lista blanca de `15` §4:** el trabajo
  periódico de generación, que no tiene usuario en la petición. Solo escribe
  candidatos; nunca lee ni escribe movimientos.
- Un descubrimiento de otro usuario devuelve 404.
- Los descubrimientos **nunca se comparten**, ni siquiera anonimizados. Es
  parte de lo que está FUERA en §2.

## 12. Estados de datos

| Estado | Qué se muestra |
|---|---|
| **Cuenta recién creada, 0 movimientos** | Nada de este módulo. El Inicio muestra el onboarding (`44`), no un hueco |
| **1-2 movimientos** | Nada todavía. Ningún tipo baja de 3 |
| **3+ movimientos, sin nada declarado** | `learning_progress`: qué va entendiendo, sin fingir patrones |
| **Algo declarado (presupuesto, deuda, compromiso)** | Clase A desde el primer día |
| **Volumen suficiente en alguna dimensión** | Empieza la clase B, dimensión por dimensión |
| **Todos descartados** | "Por ahora no tengo nada nuevo que contarte." + enlace al historial |
| **Un tipo silenciado** | No aparece, y se dice en `45` que está silenciado |
| **Cargando** | Esqueleto con la forma de las tarjetas |
| **Error del trabajo de cálculo** | Se muestran los últimos vigentes. **No se dice que hubo un error**: no es un problema del usuario y no puede hacer nada |
| **Modo discreto** | Tarjetas visibles, montos ocultos. Los sensibles, ocultos enteros |

## 13. Errores

| ID | Causa | Mensaje visible | Salida |
|---|---|---|---|
| `ERR-DESC-01` | Descubrimiento no encontrado | "Ese descubrimiento ya no está disponible." | Ver los actuales |
| `ERR-DESC-02` | Evidencia inaccesible al abrir el detalle | "Los movimientos que sostenían esto cambiaron. Voy a recalcularlo." | Volver a la lista |
| `ERR-DESC-03` | Feedback sobre uno expirado | "Ese descubrimiento ya expiró, pero anoto que no te servía." | Continuar |
| `ERR-DESC-04` | Tipo desconocido al silenciar | "No reconozco ese tipo." | Volver a configuración |

`ERR-DESC-02` no es un callejón: el sistema recalcula y el usuario ve el
resultado corregido con su nota de cambio (`RUL-DESC-08`).

## 14. Integración con el motor IA

### 14.1 Consultas que expone

| Dimensión | Notas |
|---|---|
| `tipo_descubrimiento` | Los 17 de `RUL-DESC-01` |
| `clase_descubrimiento` | A, B o C |
| `estado_descubrimiento` | Mostrado, descartado, expirado, obsoleto |
| `periodo_analizado` | |
| `fue_util` | Según el feedback del usuario |
| `tuvo_accion` | Si el usuario usó su acción |

| Medida | Notas |
|---|---|
| `descubrimientos_activos` | Cuántos hay ahora |
| `tasa_de_utilidad` | Marcados útiles sobre mostrados |
| `tasa_de_accion` | Con acción tomada sobre mostrados |

### 14.2 Comandos que acepta

| Comando | Confirmación |
|---|---|
| `descartar_descubrimiento` | No: es reversible y de bajo riesgo |
| `marcar_descubrimiento` | No |
| `silenciar_tipo_descubrimiento` | Tarjeta, por ser una preferencia persistente |

**Ningún comando genera descubrimientos.** El asistente puede mostrarlos,
explicarlos y descartarlos; no puede pedir que se fabrique uno. Un
descubrimiento a petición sería una respuesta a una pregunta, y para eso está
la consulta abierta de `20b`.

### 14.3 Qué se puede pedir en lenguaje natural

```text
"¿qué has notado?"                       → los activos, resumidos
"¿por qué dices que voy a pasarme?"      → evidencia de ese descubrimiento
"eso no me sirve"                        → marcar no útil
"no me hables más de esto"               → silenciar el tipo
"¿qué me dijiste el mes pasado?"         → historial
```

La cuarta merece atención: **es una instrucción sobre cómo debe comportarse el
producto**, y se ejecuta de verdad, no se contesta con simpatía. Un asistente
que dice "entendido" y sigue mostrando lo mismo pierde la confianza de golpe.

### 14.4 Lo que el motor NO puede hacer aquí

- **Inventar un descubrimiento.** Solo puede leer los ya calculados.
- Cambiar una cifra de un descubrimiento al narrarlo (`RUL-DESC-15`).
- Mostrar la confianza, el score o el ranking.
- Convertir un descubrimiento en consejo al reformularlo. La prohibición vale
  igual cuando el texto lo compone el modelo.

## 15. Memoria y aprendizaje

| Qué aprende | De dónde | Cómo se corrige |
|---|---|---|
| Qué tipos le sirven | Feedback útil / no útil | Cambiando el feedback |
| Qué tipos ignora | Mostrados sin acción ni feedback | Marcándolos útiles |
| Qué categorías le interesan | Con qué descubrimientos actúa | — |
| Su tolerancia al volumen | Descartes seguidos | Reactivando en `45` |
| Qué le resulta sensible | Descartes en categorías delicadas | En `45` |

Los cinco son **hechos observados**, no dichos, así que siguen la regla de
`WEB-D023`: se registran con evidencia y **se confirman antes de darse por
ciertos**. El módulo 36 gobierna cómo.

Una precisión sobre el segundo: ignorar no es rechazar. Alguien que ve un
descubrimiento y no hace nada puede haberlo leído y bastado con eso — que es
justamente el valor de los que no llevan acción (`RUL-DESC-05`). Por eso
"ignorado" pesa mucho menos que "no útil", y hacen falta muchos más para
concluir algo.

## 16. Eventos y telemetría

Eventos: `descubrimiento.generado`, `.mostrado`, `.visto`, `.util`,
`.no_util`, `.descartado`, `.accion_tomada`, `.obsoleto`, `.expirado`,
`.tipo_silenciado`.

Sin montos. Sí tipo, clase, si tenía acción y `trace_id`.

| Métrica | Qué indica |
|---|---|
| Tasa de utilidad por tipo | Qué tipos vale la pena mantener |
| Tasa de acción por tipo | Si "accionable" se cumple de verdad |
| Descubrimientos por usuario y semana | Si el volumen es el correcto |
| **Días hasta el primer descubrimiento de clase A** | **La métrica que valida la reescritura entera** |
| Tipos silenciados | Dónde el módulo molesta |
| Ratio clase C sobre el total | Si `RUL-DESC-14` se cumple en producción |
| Descubrimientos que pasan a `outdated` | Calidad de los datos base |

La cuarta es la que hay que vigilar. Si la mediana de días hasta el primer
descubrimiento de clase A no baja de días a horas frente al diseño anterior,
la reescritura no sirvió de nada por bien argumentada que esté.

## 17. Rendimiento

- Índices existentes de la migración `027`, que se conservan:
  `(user_id, rank_score desc, quality_score desc, created_at desc)`,
  `(user_id, status, expires_at)`, `(user_id, type, fingerprint)`.
  Más el nuevo `(user_id, type, feedback)` de la migración `060`.
- **El cálculo nunca ocurre en una petición del usuario.** Dispara un trabajo:
  - por evento, para la clase A, que es barata y depende de pocas filas;
  - una vez al día, para la clase B, que agrega historial.
- La clase A se recalcula **solo para las entidades tocadas**, no para todas.
  Editar un movimiento de Alimentación no recalcula los descubrimientos de
  deuda.
- `GET /insights` bajo 300 ms; `GET /insights/summary` bajo 200 ms porque lo
  consume el Inicio.
- Presupuesto de coste: la clase A y la B son **enteramente deterministas y no
  gastan llamadas al modelo**. El modelo solo interviene al adaptar el
  registro (`RUL-DESC-15`), y ese trabajo se hace al mostrar, no al calcular,
  reutilizando el turno en curso.

## 18. Accesibilidad específica

- Cada tarjeta es un `article` con encabezado propio; la lista es navegable
  por encabezados.
- El estado `outdated` **se anuncia con texto** ("Esto cambió"), nunca solo
  con un color o un icono.
- Las acciones de la tarjeta son botones reales, alcanzables con tabulador en
  el orden en que se leen.
- El menú `[⋯]` se abre con teclado y devuelve el foco a su disparador al
  cerrarse.
- Ningún descubrimiento usa `role="alert"`: no son urgencias y no deben
  interrumpir a un lector de pantalla.
- En modo discreto, los montos se anuncian como "monto oculto".
- Las cifras se leen completas: "trescientos dieciocho soles", no "S/318".

## 19. Casos borde

1. **Usuario que solo registra deudas, sin ningún gasto.** Recibe clase A
   desde la primera deuda. `RUL-DESC-03` lo garantiza explícitamente.
2. **Movimiento que sostiene un descubrimiento, eliminado.** El descubrimiento
   pasa a `outdated` y se recalcula; si pierde toda su evidencia, expira.
3. **Presupuesto borrado con `budget_risk` activo.** El descubrimiento expira
   de inmediato: su razón de ser desapareció.
4. **Dos descubrimientos que dicen lo mismo desde ángulos distintos**
   (`category_concentration` y `budget_risk` de la misma categoría). Solo se
   muestra el de mayor `rank_score`; el otro queda `validated` sin mostrarse.
5. **Todos los tipos silenciados.** La pantalla lo dice y ofrece reactivar,
   sin insistir en que se está perdiendo algo.
6. **Usuario que corrige un movimiento cinco veces seguidas.** El recálculo se
   agrupa: se ejecuta una vez al terminar la ráfaga, no cinco.
7. **Descubrimiento generado sobre un periodo que el usuario aún no cerró.**
   Válido, y su texto lo dice: "hasta hoy", nunca "en julio" cuando julio no
   ha terminado.
8. **Anomalía sobre un movimiento que el usuario luego marca como esperado.**
   Se descarta y su `fingerprint` no vuelve.
9. **Cuenta con dos meses sin actividad.** No se genera nada de clase B, y
   `learning_progress` no revive. El silencio es la respuesta correcta.
10. **Categoría sensible que además tiene presupuesto.** Gana `RUL-DESC-13`:
    fuera del Inicio, y sin lenguaje de cambio de comportamiento.
11. **Movimiento con cuenta `null` que sería la evidencia principal de un
    descubrimiento de liquidez.** No se genera; se genera en su lugar el
    `data_quality` que pide asignar la cuenta.
12. **El trabajo diario falla dos días seguidos.** Los descubrimientos vigentes
    siguen mostrándose hasta expirar. No se muestra un error al usuario, y sí
    se emite una alerta de observabilidad (`19`).

## 20. Criterios de aceptación

- `AC-DESC-01` — Un usuario con una deuda registrada y **cero gastos** recibe
  al menos un descubrimiento de clase A. Evidencia: `TEST`.
- `AC-DESC-02` — Un usuario con un presupuesto y 3 gastos en su categoría
  recibe `budget_risk` **sin ningún requisito de historial**.
  Evidencia: `TEST`.
- `AC-DESC-03` — No existe en el código ningún umbral que dependa del total de
  movimientos del usuario. Todos son por dimensión. Evidencia: `CODE` + `TEST`.
- `AC-DESC-04` — Con 60 movimientos de los cuales 1 es de una categoría, no se
  genera ningún descubrimiento sobre esa categoría. Evidencia: `TEST`.
- `AC-DESC-05` — Ningún descubrimiento se muestra con `evidence` vacía o con
  referencias que no resuelven. Evidencia: `TEST`.
- `AC-DESC-06` — `confidence`, `quality_score` y `rank_score` **no aparecen en
  ninguna respuesta de API**. Evidencia: `TEST`.
- `AC-DESC-07` — Ningún texto de descubrimiento contiene las palabras
  prohibidas de §3 ni un consejo sobre qué hacer con el dinero.
  Evidencia: `TEST` + `USER`.
- `AC-DESC-08` — Corregir un movimiento que sostiene un descubrimiento
  mostrado lo pasa a `outdated` y **muestra que cambió**, sin corregir en
  silencio. Evidencia: `TEST` + `USER`.
- `AC-DESC-09` — El `fingerprint` no incluye cifras: corregir un monto no
  genera un descubrimiento duplicado. Evidencia: `TEST`.
- `AC-DESC-10` — Un tipo marcado `no_util` dos veces deja de generarse para
  ese usuario. Evidencia: `TEST`.
- `AC-DESC-11` — Se muestran como máximo 5 en `/descubrimientos` y 2 en el
  Inicio. Evidencia: `TEST`.
- `AC-DESC-12` — Los sensibles nunca aparecen en el Inicio y se ocultan
  enteros en modo discreto. Evidencia: `TEST`.
- `AC-DESC-13` — Al menos 1 de cada 3 mostrados es de clase C cuando hay
  material. Evidencia: `TEST` + `METRIC`.
- `AC-DESC-14` — Ninguna acción de un descubrimiento escribe dinero: todas
  navegan. Evidencia: `CODE` + `TEST`.
- `AC-DESC-15` — Ningún `GET` genera descubrimientos. Evidencia: `CODE`.
- `AC-DESC-16` — El detalle muestra qué se contó y **qué no se contó**.
  Evidencia: `TEST` + `USER`.
- `AC-DESC-17` — El estado `outdated` se anuncia con texto, no solo con color.
  Evidencia: `TEST`.
- `AC-DESC-18` — El motor no puede generar un descubrimiento, solo leer los
  existentes. Evidencia: `TEST`.
- `AC-DESC-19` — El fallo del trabajo de cálculo no muestra ningún error al
  usuario y sí emite alerta de observabilidad. Evidencia: `TEST`.
- `AC-DESC-20` — La mediana de días hasta el primer descubrimiento de clase A
  es menor que 1. Evidencia: `METRIC`.

## 21. Fuera de alcance y puente a WhatsApp

**Diferido a V1.1:** comparativas de periodos largos, el resumen semanal como
pieza narrativa única, descubrimientos que cruzan más de dos módulos.

**Prohibido, no diferido:** comparación con otros usuarios o con promedios de
mercado, diagnóstico de la persona, recomendación de recortes, predicción de
ingresos no declarados, y mostrar confianza numérica en cualquier forma.

**Vive en otro módulo:** la entrega proactiva. En V1-web un descubrimiento
espera en su pantalla; nunca va a buscar al usuario. Quien decide qué
interrumpe y con qué frecuencia es el módulo 37.

Puente a WhatsApp: los diecisiete tipos son agnósticos de canal por
construcción —son datos con evidencia, y el texto se compone al presentar
(`21`)—. Lo que **no** cruza sin rediseño es el volumen: cinco descubrimientos
en una pantalla que el usuario abre cuando quiere son razonables; cinco
mensajes que llegan sin pedirlos, no. `05g` §13.2 ya lo había resuelto con una
frecuencia máxima por canal, y esa parte se rescata en la fase 2. La
infraestructura está lista: `insight_deliveries.channel` ya admite `whatsapp`
y el estado `sent` ya existe en el enum.

## 22. Trazabilidad

**Documento de `docs/` reescrito:** `docs/fase_2_estrategia/alcance_v1/05g_insights.md`
(1.651 líneas). Es la reescritura más profunda del corpus junto con la del
Dashboard.

**Qué se rescata de `05g`, porque era bueno:**

| De `05g` | Dónde vive ahora |
|---|---|
| El ciclo de vida con `outdated` y la mutación por cambios de datos (§6, §6.1) | `RUL-DESC-08`, §5 |
| La tabla de expiración por tipo (§6.2) | `RUL-DESC-09`, ampliada a 17 tipos |
| La regla de suficiencia (§9.2) | **Promovida a regla que gobierna:** `RUL-DESC-03` |
| La lista de explicabilidad (§11) | `SCR-DESC-02` |
| El catálogo de acciones (§12) | §9, ampliado con presupuestos y metas |
| "No todo insight necesita CTA" (§12.1) | `RUL-DESC-05` |
| Interno `Insights` ≠ visible `Descubrimientos` (§25) | §3 |
| Que un usuario solo con deudas reciba valor (§25) | `RUL-DESC-03`, ahora con test |
| Las tablas y enums de la migración `027` | §4.1, §4.2, intactos |

**Qué se descarta, y por qué:**

| De `05g` | Razón |
|---|---|
| La tabla de umbrales por movimientos acumulados (§9) | Es el defecto central: encadenaba toda la experiencia a un contador que no mide si una afirmación es sostenible |
| `InsightExperienceAgent`, `InsightNarratorAgent`, `DeliveryPlanner` (§5) | Arquitectura de agentes anterior al motor de `20`–`23`. El texto lo compone el motor determinista y lo adapta el presentador |
| La entrega por WhatsApp y su cadencia (§13.2, §20) | Es la fase 2. Lo que quedaba útil se apunta en §21 |
| El score expuesto como "nivel de confianza resumido" (§11) | Contradice `C-11` |
| El tipo `emocional` de `contextual/emocional` (§8.10) | Inferir estados de ánimo del gasto es diagnosticar a la persona, que está FUERA |

**Contradicciones que cierra:** ninguna de las 17 directamente. Refuerza
`C-11` con `AC-DESC-06`, que es más fuerte que prohibirlo en el copy: si el
campo no se serializa, no se puede pintar por accidente.

**Brecha que cierra:** `06_tesis_app_web.md` §7 señalaba que los umbrales
heredados condenaban a la app web a semanas de silencio. `RUL-DESC-01` y
`RUL-DESC-03` son la respuesta, y `AC-DESC-20` la mide.

**Decisiones tomadas en este documento**, registradas en
`03_decisiones_producto_web.md`:

| Decisión | ID | Alternativa descartada | Razón |
|---|---|---|---|
| Tres clases de descubrimiento con requisitos distintos | `WEB-D042` | Una sola clase inferida del historial, como `05g` | La mayor parte de lo que se puede decir sale de lo que el usuario declaró, y eso no necesita historial |
| Umbrales por dimensión, nunca globales | `WEB-D043` | Contador de movimientos acumulados | Un contador global mide el uso del producto, no si una afirmación es sostenible |
| Accionable = conecta con una herramienta | `WEB-D044` | Accionable = trae una recomendación | La recomendación es asesoría financiera, prohibida; la herramienta deja la decisión donde estaba |
| `temporal_pattern` se queda en 4 semanas | `WEB-D045` | Bajarlo para acelerar la primera experiencia | Bajarlo no lo haría más útil, lo haría falso. La clase A cubre la espera |
| Los scores no se serializan al cliente | `WEB-D046` | Prohibirlos solo en el copy | Un campo que no llega al navegador no se puede pintar por accidente |
| Los descubrimientos navegan, no escriben | `WEB-D047` | Permitir crear el presupuesto desde la tarjeta | Lo que aparece sin que nadie lo pida no debería poder cambiar nada. Mismo criterio que `WEB-D038` |
| El `fingerprint` no incluye cifras | `WEB-D048` | Incluirlas | Con cifras dentro, cada corrección del usuario generaría un duplicado en vez de marcar el original como obsoleto |
