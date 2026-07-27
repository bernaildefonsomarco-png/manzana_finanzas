# 47 — Ciclo de vida del dato y estados vacíos

**Bloque:** 06 — Transversales
**Alcance:** V1
**Fecha:** 26 de julio de 2026
**Docs fuente:** las §12 de los dieciséis módulos, `39_modulo_home_resumen_financiero.md` §5, `44_onboarding_web.md`
**Documentos que dependen de este:** `51` (pruebas), `54` (plan de implementación)

---

## 1. Qué es este documento

Es una **agregación**, como `40`: no diseña estados, recoge los que los
dieciséis módulos ya declararon en su §12 y los pone en un solo cuadro.

Y como en `40`, el valor está en lo que aparece al verlos juntos. Salieron dos
cosas:

**1. Cada módulo nombró sus tramos a su manera.** Lo que el módulo 26 llama
`Vacío`, el 24 lo llama `Sin cuentas`, el 25 `Sin movimientos` y el 28 `Sin
correo conectado`. Cuatro nombres para el mismo tramo. Y `Pocos`, `Pocos
movimientos` y `Pocos (1-10)` conviven sin que quede claro si son lo mismo.

**2. Solo dos módulos declararon dónde están sus umbrales.** El 27 dice
`Pocos (1-10)` y `Muchos (>10)`; el resto dice "pocos" y "muchos" sin número.
Cuatro módulos citan cifras en su §12 —4 movimientos, 7 días, 3 movimientos,
5 movimientos— y no coinciden entre sí ni con nada.

**3. Y el alcance y el módulo 39 declaran tramos distintos.**
`07_alcance_web_v1.md` §3.18 dice *"0 / 5 / 50 / 500 movimientos"*;
`39` §5 dice *"vacío 0, temprano 1-10, funcional 11-50, completo 50+"*. Los dos
son razonables y no son el mismo.

Ninguno de los tres es un defecto de un módulo: **son defectos que solo
existen entre módulos**, y por eso hacía falta este documento.

La resolución está en §2, y consiste en separar dos ejes que estaban
mezclados: **cuánto se le puede decir al usuario** y **qué cambia
técnicamente**. No son el mismo eje y no tienen los mismos cortes.

## 2. Dos ejes, no uno

**`RUL-VIDA-01` — Los tramos de presentación son cuatro, y son los de `39` §5**

Gobiernan **cuánto se le puede decir al usuario** sin inventar.

| Tramo | Movimientos | Qué se puede afirmar |
|---|---|---|
| **vacío** | 0 | Nada sobre él. Solo lo que declare (`44`) |
| **temprano** | 1–10 | Lo que registró, y lo derivado de lo declarado |
| **funcional** | 11–50 | Lo anterior, más agregados del periodo |
| **completo** | 51+ | Todo lo aplicable a su uso |

Se adoptan los de `39` y no los del alcance porque **tienen razonamiento
detrás**: salen de `05c` §12 recalibrados en la Ola 9. `07` §3.18 se amplía
para que coincida (§8).

**Y una precisión que evita el malentendido más caro de este documento:** los
tramos son de **presentación, no de capacidad**. Un usuario en `temprano` que
registró una deuda ve sus compromisos, su cuota y si está cubierta, porque la
clase A de `RUL-DESC-01` no depende del volumen (`WEB-D042`). Lo que gradúa el
tramo es cuánta **interpretación del historial** cabe, no qué funciones
existen.

**`RUL-VIDA-02` — Los tramos de volumen son tres, y no cambian lo que se dice**

Gobiernan **qué cambia técnicamente**. Son ortogonales a los anteriores.

| Tramo | Movimientos | Qué cambia |
|---|---|---|
| **normal** | < 500 | Nada. Todo cabe y todo es rápido |
| **denso** | 500 – 5.000 | La paginación deja de ser teórica; los agregados de periodos cerrados se cachean |
| **muy denso** | > 5.000 | Los listados sin filtro dejan de ofrecerse por defecto; la exportación va por lotes obligatoriamente |

**Un usuario denso no ve un producto distinto.** Ve el mismo producto que
sigue siendo rápido, y esa es toda la diferencia entre estos tramos y los
anteriores.

El corte en 500 no es arbitrario: es donde `26` §17 sitúa el punto en que un
listado sin cursor empieza a doler, y donde la caché de periodos cerrados de
`35` §17 empieza a valer la pena.

**`RUL-VIDA-03` — Los nombres de estado son estos, en todos los módulos**

Corrección de la primera incoherencia. Vocabulario cerrado para las §12:

| Nombre | Significa |
|---|---|
| `vacío` | El usuario no tiene ninguna entidad de este módulo |
| `sin resultados` | Tiene entidades, pero ninguna pasa el filtro actual |
| `temprano` | Tiene pocas y aún no hay base para interpretar |
| `funcional` | Hay base para lo que este módulo hace |
| `completo` | Todo lo aplicable |
| `cargando` | |
| `error` | No se pudo cargar |
| `modo discreto` | `RUL-CONF-03` |

**`vacío` y `sin resultados` son distintos y confundirlos es un fallo real**:
"no tienes movimientos" cuando el usuario tiene 300 y filtró por una categoría
sin gasto es decirle algo falso sobre sus datos.

Los estados propios de un módulo —`saldo negativo` en `24`, `token expirado`
en `28`, `solo no confirmables` en `27`— **se conservan**. Lo que se unifica
son los cinco genéricos.

**`RUL-VIDA-04` — Un umbral sin número no es un umbral**

Corrección de la segunda incoherencia. Toda §12 que diga "pocos" o "muchos"
declara **dónde está el corte**, y ese corte es el de `RUL-VIDA-01` salvo que
el módulo justifique otro.

Los cuatro módulos que ya declaraban cifras propias se revisaron:

| Módulo | Decía | Resolución |
|---|---|---|
| `25` | "4 movimientos" | Su umbral propio: 4 en una categoría para sugerir subcategoría. **Válido**, es por dimensión |
| `33` | "7 días" | `RUL-PROY-04`. **Válido**, es temporal y no de volumen |
| `34` | "0, 2, 3+ movimientos" | `RUL-DESC-01` por dimensión. **Válido** |
| `35` | "5 movimientos" | Mínimo para dibujar un gráfico. **Válido** |

Los cuatro sobreviven porque **son umbrales por dimensión, no de
presentación**, que es exactamente lo que `WEB-D043` estableció. Un umbral
por dimensión con su número declarado está bien; un "pocos" sin número, no.

## 3. Qué muestra cada módulo, por tramo

Agregación de las dieciséis §12, normalizada a `RUL-VIDA-03`.

### 3.1 Los módulos de datos declarados

Su tramo depende de **sus propias entidades**, no de los movimientos. Un
usuario con 0 movimientos y 1 deuda está `vacío` en Movimientos y `funcional`
en Deudas.

| Módulo | `vacío` | Con 1 entidad | Con muchas |
|---|---|---|---|
| `24` Cuentas | Sin dinero libre; se dice qué falta y se ofrece crear | Saldo y libre en esa cuenta | Agrupación por cuenta |
| `31` Deudas | "Aquí verás lo que debes y lo que te deben" | Saldo, cuota, vencimiento, cobertura | Agrupación por persona |
| `30` Compromisos | Explica qué es un pago que viene | Calendario con uno | Calendario y total comprometido |
| `32` Presupuestos | Sugerencias si hay historial; si no, crear a mano | Su avance | Los tres más relevantes en el Inicio |

**Las cuatro dan valor con una sola entidad.** Es la consecuencia práctica de
`WEB-D042` y lo que hace que `44` pueda ofrecer seis rutas con valor en un
dato.

### 3.2 Los módulos que dependen de movimientos

| Módulo | `vacío` | `temprano` | `funcional` | `completo` |
|---|---|---|---|---|
| `26` Movimientos | Registrar | Lista, sin filtros avanzados | Filtros y cursor | Todo |
| `25` Categorías | Las 12 canónicas, sin uso | Clasificación asistida | Sugerencia de subcategorías | Reclasificación en lote |
| `34` Descubrimientos | Nada | Clase A y `learning_progress` | Clase B por dimensión | Todo |
| `35` Reportes | "Cuando registres algo…" | Tabla, **sin gráfico** | Gráficos y agrupación | Comparativa |
| `33` Proyecciones | Nada | Nada hasta 7 días | Proyección con supuestos | Rango si hay dispersión |
| `39` Inicio | `SCR-HOME-02` | Movimientos y total | Dinero libre, pendientes, presupuestos | Todo lo aplicable |

`35` en `temprano` es el ejemplo canónico de la regla: **cuatro barras no son
un gráfico**, así que se muestra la tabla y se dice por qué.

### 3.3 Los módulos que no tienen tramos

| Módulo | Por qué |
|---|---|
| `27` Pendientes | Depende del correo, no del volumen. Sus estados son `vacío`, `sin resultados`, y los suyos propios |
| `28` Correo | Depende de la conexión |
| `29` Captura | Siempre disponible; las plantillas aparecen a las 3 repeticiones |
| `36` Memoria | Depende de lo aprendido, que depende del uso |
| `37` Recordatorios | Depende de lo que venza |
| `38` Búsqueda | Con 0 movimientos dice "todavía no hay nada que buscar" y ya |

**Declarar que un módulo no tiene tramos es tan útil como declararlos.** Sin
esta tabla, alguien implementando `28` buscaría un estado "funcional" que no
existe.

## 4. Reglas transversales de estado vacío

**`RUL-VIDA-05` — Un vacío explica qué aparecerá aquí, no que está vacío**

```text
Correcto:   Aquí verás lo que debes y lo que te deben, con sus fechas.
            [Registrar una deuda]
Incorrecto: No tienes deudas registradas.
Incorrecto: No hay datos que mostrar.
```

La primera dice para qué sirve la pantalla; las otras dos describen la
ausencia. Un vacío es la mejor oportunidad de explicar una función, porque no
compite con nada.

**`RUL-VIDA-06` — Un bloque vacío del Inicio no se muestra**

`WEB-D084`, repetido aquí porque es donde se agrega: **la regla del Inicio es
la contraria a la de las pantallas propias.**

| Superficie | Con cero datos |
|---|---|
| Pantalla del módulo | Estado vacío explicativo, con su acción |
| Bloque en el Inicio | **No aparece** |

No es una contradicción: quien entra en `/deudas` fue a buscar deudas y merece
saber qué encontrará; quien abre el Inicio no pidió ver un hueco de deudas
sugiriendo que debería tener alguna.

**`RUL-VIDA-07` — Nunca `S/0.00` cuando no se sabe**

`18` §9.1, aplicado en todas partes: se distingue **no tener** de **no saber**.

| Situación | Qué se muestra |
|---|---|
| Dinero libre calculable, y es cero | `S/0.00` |
| Dinero libre no calculable por falta de cuentas | Qué falta, y cómo darlo |
| Gasto del periodo, y no hubo | `S/0.00`, **explicado** si el periodo tuvo actividad de otro tipo |
| Un dato que no existe | `—` |

La tercera fila viene de `35` §19 caso 14, y es la que más fácil se implementa
mal: `S/0.00` sin explicación parece un error del sistema en vez de un hecho
sobre el mes.

**`RUL-VIDA-08` — El error de carga nunca deja la pantalla en blanco**

`RUL-HOME-09`, generalizado: cada bloque falla solo, se dice qué pasó, qué
sigue siendo válido y qué se puede hacer.

Y la regla heredada de `05c` §12.5, que se conserva literal porque estaba bien
dicha:

> Nunca mostrar un estado de error vacío sin guía. Si algo falla, explicar qué
> pasó, qué puede hacer el usuario, y qué datos siguen siendo válidos.

**`RUL-VIDA-09` — Los datos no envejecen solos**

Nada caduca por antigüedad salvo lo que un módulo declare explícitamente:

| Qué caduca | Dónde |
|---|---|
| Pendientes sin resolver | `27` |
| Descubrimientos | `RUL-DESC-09` |
| Aprendizajes sin usar, 12 meses | `RUL-MEM-13` |
| Recordatorios | `37` §5 y §7 (`expires_at`, máximo 30 días) |
| Archivos de exportación, 24 h | `RUL-REP-13` |
| Hechos de perfil revisables | `20c` §4 |

**Los movimientos, cuentas, deudas y presupuestos no caducan nunca.** Un
movimiento de hace tres años sigue estando ahí, contando en su periodo y
apareciendo en su reporte.

Parece obvio y conviene escribirlo, porque es lo que hace que el usuario pueda
confiar en que el histórico es histórico.

**`RUL-VIDA-10` — Lo que se degrada con volumen se declara**

En el tramo `denso` y `muy denso`, tres comportamientos cambian:

| A partir de | Qué cambia | Dónde |
|---|---|---|
| 500 movimientos | Los listados usan cursor y no offset | `26` §17 |
| 500 movimientos | Los agregados de periodos cerrados se cachean | `35` §17 |
| 5.000 movimientos | El listado sin filtro no se ofrece por defecto: se propone un periodo | `26` §12 |
| 5.000 movimientos | La exportación va por lotes obligatoriamente | `RUL-REP-12` |
| Cualquier volumen | El panorama del motor se arma con resúmenes, no con filas | `20b` §4 |

La última es la que hace que el asistente escale: `WEB-D021c` decidió cargar
patrones precalculados y resúmenes mensuales en vez del historial completo,
precisamente para que el usuario más activo no rompa el producto.

## 5. El primer día, la primera semana, el primer mes

Cómo se ve el producto en el tiempo, agregando `44` y los tramos.

| Momento | Qué tiene | Qué ve |
|---|---|---|
| **Minuto 1** | Nada | Tres puertas y la promesa del dinero libre |
| **Minuto 3** | Un dato de una ruta | El valor de esa ruta, y el paso que la completa |
| **Día 1** | 1–5 movimientos, o una entidad | Sus datos, y lo derivado de lo declarado |
| **Semana 1** | 5–20 movimientos | Categoría principal, primeros descubrimientos de clase A y B |
| **Mes 1** | 20–60 movimientos | Comparativa entre periodos, presupuestos con historial, proyección |
| **Mes 3** | 60–200 | Patrones temporales, sugerencias con mediana de 3 periodos |
| **Año 1** | 200–800 | Comparativas largas (V1.1), tramo `denso` |

**El salto que importa es el de minuto 1 a minuto 3.** Todo lo demás es
acumulación; eso es la diferencia entre alguien que vuelve y alguien que no
(`AC-ONB-13`).

Y la fila del mes 3 es donde el diseño anterior situaba el primer patrón
temporal —4 semanas—, que sigue ahí y sigue siendo honesto (`WEB-D045`). La
diferencia es que ahora las once semanas anteriores no están vacías.

## 6. Superficies

Este documento no tiene superficies propias: describe las de otros.

Lo que sí aporta es el **componente de estado vacío** que todos usan, definido
en `16_design_system_web.md`:

```text
┌──────────────────────────────────────┐
│                                      │
│  Aquí verás lo que debes y lo que    │
│  te deben, con sus fechas.           │
│                                      │
│  [Registrar una deuda]               │
│                                      │
└──────────────────────────────────────┘
```

Sin ilustración, sin icono grande, sin texto secundario. Una frase que explica
para qué sirve la pantalla y una acción.

## 7. Criterios de aceptación

- `AC-VIDA-01` — Los cuatro tramos de presentación son los mismos en todos los
  módulos y coinciden con `39` §5. Evidencia: `DOC` + `TEST`.
- `AC-VIDA-02` — Ninguna §12 usa "pocos" o "muchos" sin declarar el corte.
  Evidencia: `DOC`.
- `AC-VIDA-03` — Los cinco estados genéricos usan los nombres de
  `RUL-VIDA-03`. Evidencia: `CODE` + `TEST`.
- `AC-VIDA-04` — `vacío` y `sin resultados` producen mensajes distintos, y
  nunca se dice "no tienes movimientos" a quien tiene y filtró.
  Evidencia: `TEST` + `USER`.
- `AC-VIDA-05` — Ningún estado vacío describe la ausencia: todos explican qué
  aparecerá. Evidencia: `TEST` + `USER`.
- `AC-VIDA-06` — Ningún bloque vacío se renderiza en el Inicio, y toda pantalla
  de módulo sí tiene su estado vacío. Evidencia: `TEST`.
- `AC-VIDA-07` — Nunca se muestra `S/0.00` cuando el dato no se puede calcular.
  Evidencia: `TEST`.
- `AC-VIDA-08` — Un `S/0.00` real en un periodo con actividad de otro tipo se
  explica. Evidencia: `TEST`.
- `AC-VIDA-09` — Ningún error de carga deja una pantalla en blanco sin guía.
  Evidencia: `TEST`.
- `AC-VIDA-10` — Movimientos, cuentas, deudas y presupuestos **no caducan
  nunca**. Evidencia: `TEST`.
- `AC-VIDA-11` — Con 5.000 movimientos, el producto responde dentro de los
  presupuestos de latencia de cada módulo. Evidencia: `TEST` + `METRIC`.
- `AC-VIDA-12` — Un usuario con una sola entidad declarada —una deuda, una
  cuenta, un compromiso— recibe el valor completo de esa ruta.
  Evidencia: `TEST`.

`AC-VIDA-11` exige un juego de datos de prueba con 5.000 movimientos. Sin él,
el tramo `denso` es una declaración sin comprobar, y los problemas de volumen
se descubren con usuarios reales.

## 8. Correcciones aplicadas a otros documentos

Este documento amplía `07_alcance_web_v1.md` §3.18, cuyos tramos —"0 / 5 / 50
/ 500"— no coincidían con los de `39` §5. Se adoptan los de `39` para la
presentación y los de `RUL-VIDA-02` para el volumen, y `07` se corrige.

Es el mismo procedimiento de `01_convenciones_y_plantillas.md` §2 que ya se
aplicó en la Ola 7 con el alcance de presupuestos: **cuando un documento
posterior contradice al de alcance, se amplía el de alcance y se dice.**

## 9. Trazabilidad

**Documentos agregados:** las §12 de `24` a `39`.

**Qué encontró la agregación** (§1): cuatro nombres distintos para el tramo
vacío, "pocos" y "muchos" sin números en catorce módulos, y una divergencia
entre el documento de alcance y el módulo 39.

Ninguno era visible desde dentro de un módulo, igual que las siete colisiones
de nombre que encontró `40`. **Es el segundo documento de agregación del
corpus y ha encontrado el mismo tipo de defecto que el primero**, lo que
sugiere que la técnica —escribir cada pieza desde dentro y agregar después—
tiene un coste sistemático y conocido: los contratos entre piezas.

**Contradicciones:** ninguna de las 17. Aporta la comprobación de volumen que
`C-05` y `C-07` necesitan para ser verificables con datos reales.

**Decisiones tomadas en este documento**, registradas en
`03_decisiones_producto_web.md`:

| Decisión | ID | Alternativa descartada | Razón |
|---|---|---|---|
| Dos ejes: presentación y volumen | `WEB-D133` | Un solo juego de tramos, como decía el alcance | Cuánto se le puede decir a alguien y qué cambia técnicamente no son el mismo eje y no tienen los mismos cortes. Mezclarlos produce un usuario con 600 movimientos al que se le trata distinto sin razón |
| Los tramos de presentación son los de `39` §5 | `WEB-D134` | Los "0 / 5 / 50 / 500" del alcance | Los de `39` tienen razonamiento detrás: salen de `05c` §12 recalibrados. Los del alcance eran una abreviatura. Se amplía el alcance |
| Vocabulario cerrado para los estados genéricos | `WEB-D135` | Que cada módulo nombre los suyos | Cuatro nombres para el tramo vacío es el mismo defecto que `origen` en cuatro módulos, y se corrige igual. Los estados propios de cada módulo se conservan |
| Un umbral sin número no es un umbral | `WEB-D136` | Dejar "pocos" y "muchos" a criterio de quien implemente | Catorce módulos decían "pocos" sin decir cuántos. Los umbrales por dimensión con su cifra declarada sí valen: es `WEB-D043` |
| Los datos financieros no caducan nunca | `no_negociable` `WEB-D137` | Archivar automáticamente lo antiguo | Es lo que permite confiar en que el histórico es histórico. Solo caduca lo que un módulo declara explícitamente, y ninguno de esos es dinero registrado |
