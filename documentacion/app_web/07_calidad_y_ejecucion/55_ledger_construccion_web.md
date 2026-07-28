# 55 — Ledger de construcción de la app web

**Bloque:** 07 — Calidad y ejecución
**Alcance:** V1
**Estado:** vivo
**Fecha de última actualización:** 27 de julio de 2026
**Docs fuente:** `54` (los veinte cortes), `49` §8 y §9 (protocolos de `USER` y `METRIC`), `50` (matriz)
**Documentos que dependen de este:** `56` (puente a WhatsApp)

---

## 1. Qué es, y por qué el anterior falló

Este documento registra **lo que de verdad pasó** durante la construcción: qué
se entregó, qué sorprendió, qué quedó abierto. El `54` dice qué hay que
construir; este dice qué se construyó.

Su predecesor, `docs/fase_4_tecnica/23b_seguimiento_construccion_v1.md`,
existía y tenía la regla correcta escrita en su §1:

> *"Si se cierra un corte, pantalla, migración, endpoint o decisión técnica
> durante construcción, actualizar este documento antes de continuar con el
> siguiente bloque importante."*

Y aun así falló. Los datos, medidos:

| Medida | Valor |
|---|---|
| Longitud | **8.082 líneas** |
| Entradas fechadas | **5** |
| Última entrada real | **18 de julio de 2026** |
| Fecha declarada en su cabecera | **23 de julio de 2026** |
| Menciones de las migraciones `042` a `046` | **0** |

Tres cosas a la vez. Se dejó de escribir. Su cabecera declaraba una fecha
**cinco días posterior a su última entrada**, así que ni siquiera sabía que se
había parado. Y las cinco migraciones que se aplicaron en ese periodo no
aparecen en ninguna de sus 8.082 líneas — el `13` tuvo que documentarlas desde
el SQL, meses después.

**La causa no fue descuido: fue que la regla era una promesa.** Nada fallaba si
no se cumplía. Un corte se podía dar por cerrado con el ledger intacto, y eso
es exactamente lo que pasó.

`WEB-D166` — **La entrada en el ledger es precondición de cerrar un corte, no
una cortesía posterior.** `AC-PLAN-08` lo exige y `AC-LEDGER-01` lo verifica:
un corte sin entrada no cierra, igual que uno con un criterio de `G1` abierto.

---

## 2. El contrato de entrada

Una entrada por corte. Formato fijo, porque un formato libre produce entradas
que no se pueden comparar ni agregar.

```markdown
## W-NN — Nombre del corte

**Cerrado:** AAAA-MM-DD
**Portones:** G1 ✓ · G2 ✓ · G3 12 abiertos
**Matriz regenerada:** AAAA-MM-DD, commit `abc1234`

### Qué se entregó
Una frase por entrega comprobable.

### Qué sorprendió
Lo que no estaba en el documento. Si no sorprendió nada, se escribe
"nada" — y eso también es información.

### Qué quedó abierto
Criterios de G3 con dueño y fecha. Deuda nueva, si la hay, con el gate
que la habría detenido (AC-DEUDA-06).

### Documentos corregidos
Si el corte encontró que un documento estaba mal, qué se cambió y con qué
entrada del decision log.
```

### 2.1 Por qué "qué sorprendió" es obligatorio

Es la sección que hace útil el ledger a los seis meses. Un registro de lo
entregado se puede reconstruir del historial de git; **lo que sorprendió, no**.

Y es la que alimenta `AC-DEUDA-06`: cada sorpresa obliga a preguntarse qué
documento debería haberla previsto. Si la respuesta es "ninguno", falta un
documento; si es "el 32, y lo dice mal", hay una corrección que hacer.

Escribir "nada" es una respuesta legítima y también es un dato: un corte sin
sorpresas significa que su documento estaba bien.

---

## 3. Qué no va aquí

| No va | Va en |
|---|---|
| Qué hay que construir | `54` |
| El estado de cada criterio | `50` (matriz) |
| Decisiones de producto | `03` (decision log) |
| Deuda catalogada | `53` |
| Cómo se prueba algo | `51` |

El ledger es **narrativo y fechado**. La matriz es tabular y viva. Si algo se
puede derivar de la matriz, no se copia aquí: se copia y diverge.

Ese fue el otro problema del `23b`. Sus 8.082 líneas mezclaban seguimiento,
especificación, decisiones y notas de depuración, y por eso nadie sabía si
estaba al día.

---

## 4. El registro de validación con usuarios

139 criterios exigen `USER` o `METRIC` (`50` §3.1). Este documento es donde se
cierran.

### 4.1 Sesiones con usuarios

`WEB-D149` fija el protocolo: tres personas ajenas a quien escribió el
documento y a quien lo implementó, la tarea sin guía verbal, y cierra cuando
**las tres** la completan.

```markdown
### Sesión AAAA-MM-DD — Criterios AC-XXX-NN, AC-YYY-MM

**Tarea pedida:** el enunciado exacto que se leyó en voz alta.
**Participantes:** tres, con una línea de contexto cada uno (no su nombre).

| Persona | ¿Completó? | Dónde se atascó |
|---|---|---|
| 1 | Sí | — |
| 2 | No | No encontró el control de X |
| 3 | Sí | Dudó en el paso 2 |

**Veredicto:** no cierra. 2 de 3.
**Qué se cambia:** …
**Repetición:** AAAA-MM-DD
```

**La fila de quien falló es la razón de ser de la tabla.** Un registro que solo
anota los éxitos convierte tres sesiones en una anécdota favorable. Si dos de
tres completan, el criterio **no cierra** — se corrige y se repite, y las dos
sesiones quedan escritas.

### 4.2 Series operativas

`WEB-D150` exige tres cosas y el orden importa: la serie, el objetivo
**declarado antes de mirar el dato**, y la decisión tomada.

```markdown
### Métrica AC-XXX-NN — Nombre

**Objetivo declarado el:** AAAA-MM-DD (antes de la primera medición)
**Umbral:** …
**Serie:** …
**Decisión tomada:** …
```

Si el objetivo no lleva fecha anterior a la primera medición, la métrica **no
cierra**. Una métrica sin umbral previo confirma cualquier cosa.

### 4.3 Las dos ventanas de observación

`WEB-D159` asignó ventana a los módulos `37` y `46`, que tienen sus 38
criterios en `G1` siendo los dos cuyo riesgo entero es cansar a la gente. Los
umbrales se declaran aquí antes de abrirlas.

| Módulo | Señal | Umbral | Declarado el |
|---|---|---|---|
| `37` | Recordatorios `descartado` frente a `resuelto` (`37` §5) | *pendiente de declarar* | — |
| `46` | Bajas por tipo y quejas de correo no deseado (`46` §5) | *pendiente de declarar* | — |

**Los umbrales se fijan cuando `W-14` cierre `G1`, y antes de que el módulo
tenga usuarios.** Declararlos hoy sería inventar un número sin saber qué mide;
declararlos después de ver el dato sería `WEB-D150` incumplido.

---

## 5. Cómo se detecta que este documento se paró

El `23b` no supo que se había parado. Este sí.

**`RUL-LEDGER-01` — La cabecera declara la fecha de la última entrada real,
no la del último toque.** Un test de clase `corpus` compara la fecha de la
cabecera con la entrada más reciente del cuerpo y falla si no coinciden. Es
literalmente el defecto que el `23b` tenía y nadie vio.

**`RUL-LEDGER-02` — Un corte cerrado en la matriz sin entrada aquí falla el
build.** La matriz sabe qué cortes están cerrados; este documento sabe cuáles
tienen entrada. Si divergen, el gate salta.

**`RUL-LEDGER-03` — Este documento no supera las 2.000 líneas.** Cuando se
acerque, se archiva por bloque de cortes y se empieza uno nuevo. El `23b`
llegó a 8.082 líneas y esa es una de las razones por las que dejó de leerse: a
partir de cierto tamaño, nadie comprueba si está al día.

Las tres son mecanismos, no promesas. La diferencia con el `23b` es
exactamente esa.

---

## 6. Estado actual

**La construcción avanza.** `W-01`, `W-02` y `W-03` cerraron `G1` y `G2`.
Ninguno de los tres tiene criterios de `G3` propios.

| | |
|---|---|
| Cortes cerrados | 3 de 20 |
| Criterios `verificado` | 23 de 708 |
| Criterios `validado` | 0 de 139 |
| Sesiones con usuarios | 0 |
| Series abiertas | 0 |

Esta tabla se actualiza con cada corte y es lo primero que se lee.

---

## 7. Entradas

## W-01 — La verdad del repositorio

**Cerrado:** 2026-07-27
**Portones:** G1 ✓ · G2 no aplica (el corte no declara criterios de `G2`) · G3 ninguno propio
**Matriz regenerada:** 2026-07-27, con `npm run matriz:generar`, posterior al
commit `098cbad` (`AC-TRAZ-12`).

### Qué se entregó

El generador de la matriz de trazabilidad existe
(`scripts/matriz/generar.ts`) y produce el censo de los 1.552 identificadores,
la validación de `AC-TRAZ-01` a `AC-TRAZ-03`, y una fila por identificador con
las columnas de `50` §4 que hoy se pueden derivar. `supabase/migrations/` es
la única rama de migraciones, con un gate de `prebuild` que falla si
reaparece una segunda. Las seis carpetas con solo `.gitkeep` sin destino
desaparecieron; las cuatro que el diseño llenará se conservan. El `README.md`
describe el árbol real de `src/`, verificado en las dos direcciones. El proxy
completó `PUBLIC_PATHS` con las ocho rutas públicas que faltaban —sin tocar la
redirección de `/`, que es de `W-07`—. `npm run typecheck`, `npm run lint`,
`npm run build` y `npm test` terminan sin errores (902 pasan, 7 saltados por
diseño).

### Qué sorprendió

Tres cosas, y las tres las encontró la propia herramienta que este corte
construye — no un lector.

La primera ya estaba resuelta antes de escribir código: el `54` original
asignaba a `W-01` cerrar `AC-TRAZ-04` (que las 119 superficies declaren
`**Ruta:**`), pero medido contra el árbol real solo 37 de 119 la declaran, y
las 82 restantes viven en documentos de `W-08` a `W-19`, no en los de `W-01`.
Pasó a criterio agregado que cierra por superficie (`WEB-D167`), y `W-01`
entrega el generador y el test que lo miden, no su cierre completo.

La segunda: el generador, al construirse, encontró dos identificadores del
corpus sin definición real —una errata en `49` §10.1 que escribía mal el
token de `RUL-CUENTAS-02`, y `MOD-ASISTENTE` (registrado en `50` §2.1 contra
el documento `41`) sin su campo `**ID de módulo:**` en la cabecera de ese
documento—. Los dos eran defectos genuinos que ningún lector había visto
porque nadie había escrito antes un test que los pudiera encontrar.

La tercera es sobre el generador mismo: sus dos primeras versiones tenían
errores de forma que solo aparecieron al contrastar sus cifras contra las ya
escritas a mano en `50` §3.1 —la expresión de `Clase:` no aceptaba dígitos, así
que `e2e` no se reconocía nunca, y la búsqueda de `Clase:` se detenía en
cuanto encontraba `Evidencia:`, sin seguir buscando cuando la clase venía en
una tercera línea distinta (`AC-HECHO-01`, `AC-TRAZ-03`, `AC-PLAN-01`,
`AC-PUENTE-03`)—. Sin el conteo manual previo como referencia, ninguno de los
dos se habría notado: las cifras del generador se explican solas y no gritan
que están mal.

### Qué quedó abierto

Ningún criterio de `G3` propio de este corte queda abierto: `W-01` no
declara ninguno. `AC-TRAZ-04` queda como agregado en 37/119 y se cierra por
partes en `W-08`–`W-19` (`WEB-D167`). El commit de cierre y la regeneración
posterior a él (`AC-TRAZ-12`) quedan pendientes de que el usuario decida
comprometer estos cambios.

### Documentos corregidos

- `52` §11: corregida la contradicción sobre `src/app/(dashboard)/` (ya
  resuelta antes de este corte, ver el commit `1c3ac7f`).
- `54` §3.1 (nueva): tabla de corte dueño por documento y `RUL-PLAN-04` (ya
  resuelta antes de este corte).
- `49` §10.1: corregida la errata de tecleo que dejaba mal escrito el token
  de `RUL-CUENTAS-02`.
- `41`: añadido `**ID de módulo:** \`MOD-ASISTENTE\`` a la cabecera.
- `50` §3, §3.1, §10, §5.1: censo regenerado (1.552 identificadores, no 1.551;
  `RUL-` 317, no 316; clase `lint` 14, no 13); `AC-TRAZ-04` marcado agregado.
- `51` §5: `AC-TRAZ-04` añadido a los ejemplos de criterio agregado.
- `52` §15: `AC-INV-10` recibe `Clase: lint`, que le faltaba.
- `54` W-01: `AC-TRAZ-04` retirado de lo que el corte cierra.
- `03_decisiones_producto_web.md`: `WEB-D167` (nueva).

---

## W-02 — RLS y arranque seguro

**Cerrado:** 2026-07-27
**Portones:** G1 ✓ · G2 ✓ (con evidencia `LIVE` real, ver abajo) · G3 ninguno propio
**Matriz regenerada:** 2026-07-27, con `npm run matriz:generar`, posterior al
commit `9871e09` (`AC-TRAZ-12`).

### Qué se entregó

`AC-SEG-01` cierra: un gate de `prebuild` y un test que falla si una ruta de
`src/app/api/` importa `createServiceClient` sin figurar en la lista blanca
permanente (14 rutas sin sesión de usuario, por categoría) o en las
excepciones temporales justificadas (46 de las 48 rutas de `/api/v1` que hoy
lo usan — dos, `onboarding` y `privacy/account`, resultaron permanentes por
`15` §4, no temporales). `AC-SEG-02` y `AC-SEG-03` cierran con una prueba de
integración real contra el stack local de Supabase (`supabase start`, no
producción): dos usuarios, 43 tablas, los cuatro asertos de `51` §8 —lectura
cero filas, actualización cero filas, escritura con `user_id` ajeno
rechazada, y las columnas de dinero sin escritura directa—. `AC-SEG-04`
cierra como criterio agregado: ninguna de las 58 rutas de `/api/v1` devuelve
403 para un recurso ajeno (el patrón de repositorio del proyecto ya lo
garantizaba; esta prueba lo deja verificado, no lo cambia). `AC-RT-01` y
`AC-REU-06` cierran con `src/instrumentation.ts`: el servidor no arranca en
producción si el proveedor de modelo es `local_fixture` o si
`production_safe` es falso — verificado no solo con `TEST` sino con `LIVE`
real, arrancando el build de producción con una configuración peligrosa y
confirmando que el proceso muere y deja de aceptar conexiones (ver abajo).

### Qué sorprendió

Dos cosas, y las dos cambiaron el diseño antes de cerrar el corte.

La primera es la que más importa: `54` decía que `W-02` migraba las 48 rutas
a cliente autenticado y cerraba `AC-SEG-01` a `AC-SEG-08` completos. Pero
`15` §9 —su propia fuente— dice lo contrario de forma explícita: la
migración va acoplada al rediseño de paginación y filtros de `14`, y
"tocarlas dos veces sería peor". Y `53` §3 ya tenía asignado `AC-SEG-08`
(CSRF) a `D-09` → `W-05`, no a `W-02`. Migrar 48 endpoints de dinero real de
golpe, sin su contrato nuevo, era exactamente el error que `15` §9 nombra.
Se corrigió antes de escribir código (`WEB-D168`): `W-02` construye el
mecanismo — la lista blanca, las excepciones justificadas, la prueba de
aislamiento — y dejó fuera lo que de verdad pertenece a `W-05`, `W-18` y
`W-19`.

La segunda: `instrumentation.ts` de Next.js 16 **no impide que el servidor
acepte conexiones** cuando `register()` lanza. Medido directamente: con
`next start` en modo producción y una configuración peligrosa forzada, el
proceso imprime "Ready", el puerto queda abierto, y cada petición responde
`500` — pero el proceso sigue vivo indefinidamente. El texto de `23`/`42`
("el servidor no arranca") describe la intención, no lo que la convención de
Next hace por sí sola. Se corrigió añadiendo `process.exit(1)` explícito en
el `catch` de `register()`, y se volvió a medir: con eso, el proceso muere
de verdad y las conexiones nuevas se rechazan. Sin la segunda medición, el
gate habría quedado con una falsa sensación de seguridad — respondía con
error, pero no dejaba de responder.

### Qué quedó abierto

Ningún criterio de `G3` propio. `AC-SEG-05` (mensajes de autenticación),
`AC-SEG-06` (sin datos sensibles en registros) y `AC-SEG-08` (CSRF) no
cierran aquí — son de `W-18`, `W-19` y `W-05` respectivamente (`WEB-D168`).
`AC-SEG-07` (la lista de excepciones temporales vacía) queda como agregado
sin corte propio: hoy tiene 46 rutas, y baja de una en una a medida que cada
familia de endpoints migra en su corte de módulo. `R-01` (RLS esquivada con
riesgo aceptado) sigue abierto hasta que esa lista llegue a cero.

### Documentos corregidos

- `15` §9: aclara que 46 de las 48 rutas —no 48— son excepción temporal; las
  otras dos son permanentes por §4.
- `15` §11: `AC-SEG-02`, `AC-SEG-03` reciben `Clase: integracion`;
  `AC-SEG-04` recibe `Clase: lint` y se marca agregado.
- `52` §15 y `53` §2.2, §5: `D-02` se redefine como parcialmente pagado en
  `W-02` (el gate existe; la lista no está vacía) y `R-01` se reformula en
  consecuencia.
- `54` W-02: reescrito completo — quita la migración de las 48 rutas y
  `AC-SEG-05/06/08` de lo que cierra; añade `AC-PRUEBA-05` a la tabla de
  excepciones de `RUL-PLAN-04` (documento `51`/`W-03`, cierra en `W-02`).
- `03_decisiones_producto_web.md`: `WEB-D168` (nueva).

---

## W-03 — Infraestructura de pruebas

**Cerrado:** 2026-07-27
**Portones:** G1 ✓ · G2 no aplica (el corte no declara criterios de `G2`) · G3 ninguno propio
**Matriz regenerada:** 2026-07-27, con `npm run matriz:generar`, posterior al
commit `[pendiente: se registra tras el commit de cierre]` (`AC-TRAZ-12`).

### Qué se entregó

`AC-PRUEBA-01` cierra: un test de clase `corpus` falla el build si aparece
una fila `verificado` con evidencia `TEST` y sin `Clase:`. `AC-PRUEBA-06`
cierra: `@vitest/coverage-v8` mide sobre `src/**` completo, con reporte
`html`, no solo sobre lo que ya tenía test. `AC-PRUEBA-07` cierra: los cuatro
tests de humo (`*.api-smoke.test.ts`, dinero real de agentes) viven en su
propio proyecto de Vitest (`vitest.smoke.config.ts`, `npm run
test:smoke:agents`), fuera de `npm test`. `AC-PRUEBA-08` cierra: los seis
gates que paran el build tienen mecanismo real, no declarado — cuatro en
`prebuild` (`service-role-en-rutas`, `mapa-de-rutas`, `sin-tests-en-skip`,
`sin-regresion-de-alcance`) y dos en `src/instrumentation.ts` al arrancar el
servidor (`AC-RT-01`, `AC-REU-06`, heredados de `W-02`). `AC-PRUEBA-10`
cierra: `vitest.config.ts` excluye `tests/rls/**` de la suite por defecto y
ningún `.test.ts` fuera de ese directorio construye un cliente Supabase
contra una URL real. `AC-PRUEBA-11` cierra: `npm test` corre en 43 segundos,
por debajo del presupuesto de 120s, con un gate propio
(`scripts/gates/presupuesto-npm-test.mjs`) que lo vuelve a medir. `AC-PRUEBA-12`
cierra: ningún test de los ocho adaptadores de WhatsApp lee variables de
entorno, y el script de humo de WhatsApp no está en el `include` de Vitest.
Además, sin ser lo que el corte cierra formalmente (`AC-PRUEBA-09` es de los
cortes de módulo que crean cada ruta): Playwright está instalado, corre sin
advertencias, y los doce recorridos de `44` §5 y los cuatro flujos
irreversibles existen como `test.fixme()` declarados. Cinco de las ocho
reglas de lint de `51` §6.4 están activas y en verde
(`frontera-core`, `frontera-cliente`, `sin-view-query`, `tamano-componente`,
`dialogo-unico`); las otras tres quedan definidas y sin activar (`WEB-D169`).
El mapa de rutas de `10` §3.1/§3.2 ahora declara las 16 rutas que faltaban
frente al árbol real de superficies, y un gate de `prebuild` lo mantiene así
(`AC-TRAZ-05`). `npm run typecheck`, `npm run lint`, `npm run build`,
`npm test` (173 ficheros, 995 tests) y `npm run test:rls` (48 tests, contra
Supabase local real) terminan sin errores.

### Qué sorprendió

Tres cosas.

La primera, la más cara de las tres: `instrumentation.ts` de Next.js 16
**no acepta `process.exit` en su nivel superior**, aunque esté detrás de un
guard de runtime (`if (process.env.NEXT_RUNTIME !== "nodejs") return`). El
analizador estático de Next lo marca como incompatible con Edge Runtime de
todas formas, y `next build` lo advierte. La documentación de Next no dice
esto en ningún sitio que mencione `instrumentation.ts` directamente; el
patrón para evitarlo —dividir en un despachador fino que hace `import()`
dinámico de un módulo separado con la lógica de Node— aparece solo en su
documentación general sobre módulos exclusivos de Node. Se corrigió
partiendo el fichero en tres: `instrumentation.ts` (despachador),
`instrumentation.node.ts` (el `process.exit`) e `instrumentation-check.ts`
(la lógica pura, ya la de `W-02`, ahora testable sin tocar ninguno de los
otros dos). Verificado de nuevo con `next build` real: la advertencia
desapareció y el comportamiento en caliente (`next start` con configuración
peligrosa) siguió matando el proceso como antes.

La segunda: el patrón `include` de `vitest.config.ts`
(`tests/**/*.{test,spec}.{ts,tsx}`) coincidía también con los `.spec.ts` de
Playwright recién creados bajo `tests/e2e/`, porque Vitest y Playwright
comparten la extensión `.spec.ts` por convención y el patrón no distinguía
directorios. Vitest intentaba cargarlos y fallaba con
`test.fixme() can only be called inside test, describe block or fixture` —
un error de carga, no de aserción: las 995 pruebas reales seguían en verde,
pero 12 ficheros marcaban el run como roto. Se corrigió añadiendo
`tests/e2e/**` a la exclusión común de ambos proyectos de Vitest.

La tercera: al medir qué reglas de lint de `51` §6.4 se podían activar hoy
sin violaciones, tres de las ocho fallaban contra código real y legítimo que
todavía no tiene su corte — 55 menciones de WhatsApp en `core/` (de `W-04`),
literales de estilo sin que exista aún la paleta de `W-06`, y llamadas a
`fetch` a mano sin que exista aún la librería elegida en `W-07`. Activarlas
ahora habría sido saldar deuda en código condenado (`WEB-D164`) o, en el
caso de estilo, inventar una definición de "literal" sin la paleta que la
sustenta. Se documentó como `WEB-D169`: cinco activas desde ya, tres con
fecha de activación fijada a su propio corte.

### Qué quedó abierto

Ningún criterio de `G3` propio. `AC-PRUEBA-09` no cierra aquí — el arnés de
los doce recorridos existe (`test.fixme`, Playwright sin advertencias) pero
ninguno pasa todavía: cada uno cierra cuando su corte de módulo construye la
ruta que recorre (`W-08` en adelante). Las tres reglas de lint diferidas por
`WEB-D169` (`sin-canal-en-el-nucleo`, `sin-literales-de-estilo`,
`fetch-a-mano`) se activan en `W-04`, `W-06` y `W-07` respectivamente.

### Documentos corregidos

- `10` §3.1: añadidas `/estado` y `/baja`, ya construidas en `W-01` pero
  ausentes del mapa.
- `10` §3.2: añadidas 14 rutas más declaradas por superficies existentes del
  corpus (`/recordatorios`, `/configuracion/categorias[/[id]]`,
  `/configuracion/correo/estado`, `/configuracion/plantillas`,
  `/configuracion/personas`, `/configuracion/memoria/[id]`,
  `/configuracion/voz`, `/reportes/guardadas`, `/buscar/guardadas`,
  `/asistente/hilos`, `/ayuda[/[tema]|/contacto]`).
- `50` §5.2: actualizado, el hueco entre mapa y superficies que describía ya
  está cerrado.
- `03_decisiones_producto_web.md`: `WEB-D169` (nueva).

---

## 8. Criterios de aceptación

- `AC-LEDGER-01` — Ningún corte figura cerrado en la matriz sin entrada aquí.
  Evidencia: `TEST`. Clase: `build`.
- `AC-LEDGER-02` — La fecha de la cabecera coincide con la entrada más
  reciente. Evidencia: `TEST`. Clase: `corpus`.
- `AC-LEDGER-03` — Toda entrada tiene las cuatro secciones del formato de §2,
  incluida "qué sorprendió". Evidencia: `TEST`. Clase: `corpus`.
- `AC-LEDGER-04` — Todo `USER` cerrado tiene registro de tres personas,
  incluidas las que no completaron la tarea. Evidencia: `DOC`.
- `AC-LEDGER-05` — Todo `METRIC` cerrado tiene objetivo con fecha anterior a
  la primera medición. Evidencia: `TEST`. Clase: `corpus`.
- `AC-LEDGER-06` — Las dos ventanas de observación tienen umbral declarado
  antes de abrirse. Evidencia: `DOC`.
- `AC-LEDGER-07` — Este documento no supera las 2.000 líneas.
  Evidencia: `TEST`. Clase: `corpus`.
- `AC-LEDGER-08` — La tabla de §6 coincide con la matriz del `50`.
  Evidencia: `TEST`. Clase: `corpus`.

---

## 9. Fuera de alcance y puente a WhatsApp

Este documento no planifica, no especifica y no decide. Registra.

Para la fase de WhatsApp: **el ledger no se hereda, se cierra.** Al terminar
`W-20` se archiva completo y la fase 2 abre el suyo. Lo que sí se hereda son
los tres mecanismos de §5 y los dos protocolos de §4, porque el problema que
resuelven es del proceso, no del canal.

Lo que la fase 2 sí lee de aquí son las secciones "qué sorprendió": son el
único sitio donde queda escrito qué salió distinto de lo documentado, y eso es
justo lo que ahorra repetir el error.

---

## 10. Trazabilidad

| Elemento | Origen |
|---|---|
| Los veinte cortes | `54` |
| Protocolo de `USER` | `WEB-D149`, `49` §8 |
| Protocolo de `METRIC` | `WEB-D150`, `49` §9 |
| Ventanas de observación de `37` y `46` | `WEB-D159`, `51` §11 |
| Estados de criterio | `49` §5, `50` §7 |
| Predecesor y su diagnóstico | `docs/fase_4_tecnica/23b_seguimiento_construccion_v1.md`, medido el 26 de julio de 2026 |
| Decisión nueva | `WEB-D166` |
