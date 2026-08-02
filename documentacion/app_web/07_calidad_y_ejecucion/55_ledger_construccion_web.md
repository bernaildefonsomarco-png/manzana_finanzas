# 55 — Ledger de construcción de la app web

**Bloque:** 07 — Calidad y ejecución
**Alcance:** V1
**Estado:** vivo
**Fecha de última actualización:** 1 de agosto de 2026
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

**La construcción avanza.** `W-01` a `W-13` cerraron `G1` y `G2`. Ninguno
tiene criterios de `G3` propios. En `W-13`, “verificado” incluye la parte
`TEST` que el criterio realmente cubre; las mitades `USER` sin sesión y los
criterios explícitamente diferidos siguen marcados como abiertos en sus
documentos.

| | |
|---|---|
| Cortes cerrados | 13 de 20 |
| Criterios `verificado` | 212 de 708 |
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
commit `7042945` (`AC-TRAZ-12`).

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

## W-04 — El canal sale del núcleo

**Cerrado:** 2026-07-28
**Portones:** G1 ✓ · G2 no aplica (el corte no declara criterios de `G2`) · G3 ninguno propio
**Matriz regenerada:** 2026-07-28, con `npm run matriz:generar`, posterior al
commit `1c6e194` (`AC-TRAZ-12`).

### Qué se entregó

El puerto de canal de `21` existe en código: `src/core/channel/types.ts`
declara `Channel`, `TurnInput` (la *entrada* de `21` §3), `Block` (los diez
bloques de `21` §5) y `verifyBlocks` (`AC-CANAL-03`, `AC-CANAL-04`).
`response-planner.ts` se partió en dos: `planTurnBlocks` (núcleo,
channel-agnóstico, produce bloques) y `src/adapters/whatsapp/response-shaper.ts`
(adaptador, traduce bloques a texto libre o interactivo de WhatsApp, con la
ventana de mensajería). `financial-orchestrator.ts` cambió su único método
público de `handleWhatsAppInboundEvent(event: OutboxEvent)` a
`handleTurn(input: TurnHandlingInput)`, y el envío de respuesta se delega a
un `presentTurn` inyectado por el adaptador de canal —el núcleo ya no
importa nada de `@/adapters/whatsapp/*`—; `src/adapters/whatsapp/present-turn.ts`
implementa ese `presentTurn` para WhatsApp real. Los seis ficheros con el
canal en el nombre se resolvieron cada uno según lo que de verdad hacían:
`whatsapp-formatting.ts` y `whatsapp-response-sender.ts` (envío real) se
movieron a `adapters/whatsapp/`; `whatsapp-pending-code.ts`,
`whatsapp-correction.ts`, `whatsapp-pending-confirmation.ts` y
`whatsapp-memory-control.ts` resultaron ser lógica de negocio o de
interpretación de texto genuinamente channel-agnóstica —parsear "confirmo"
o un código `corr:categoria:...` no depende de si llegó por WhatsApp o por
un chat futuro en la web— y se quedaron en `core/`, solo renombradas.
`response-agent-enhancer.ts` (el agente de estilo, con su límite de 900
caracteres y su cuerpo de botón) resultó genuinamente específico de
WhatsApp y se movió también. La regla de lint `sin-canal-en-el-nucleo`
(`AC-INV-04`) verifica, sobre todo `src/core/`, que ningún fichero mencione
"whatsapp" fuera de una lista de trece excepciones documentadas y exactas
—el puerto mismo, la taxonomía de disclosure (`WEB-D171`) y las funciones
que traducen entre el vocabulario del puerto y el de columnas/variables de
entorno ya desplegadas (`WEB-D172`)—. La prueba de agnosticismo de `21` §8
(`AC-CANAL-01`) existe y compila: para seis de los siete casos, el mismo
caso ejecutado con `canal: "whatsapp"` y `canal: "dashboard"` produce
bloques idénticos, y esos bloques, leídos por dos presentadores de prueba
con formas de renderizado deliberadamente distintas, exponen los mismos
comandos y referencias de evidencia (`AC-CANAL-02` a `AC-CANAL-05`,
`AC-CANAL-07`). `npm run typecheck`, `npm run lint`, `npm run build` (con
los cinco gates de `prebuild` en verde), `npm test` (176 ficheros, 1.015
tests) y `npm run test:rls` (48 tests) terminan sin errores.

### Qué sorprendió

Cuatro cosas.

La primera cambió la estimación de riesgo del corte por completo. La
auditoría inicial (`52` §4.1) medía 28 ficheros y 15.196 líneas como si
todos fueran acoplamiento profundo a WhatsApp. Al leer los seis ficheros
con el canal en el nombre uno por uno, resultó que la mayoría —parseo de
texto libre, resolución de comandos de corrección, control de memoria— es
lógica de negocio genuinamente channel-agnóstica que solo llevaba un
nombre equivocado; lo verdaderamente acoplado a WhatsApp (formateo de
Markdown, ventana de mensajería, envío, el agente de estilo con su límite
de caracteres) era una fracción mucho menor. El corte que el `54` marcó
como "el de más riesgo de desbordarse" resultó ser, en su mayor parte, un
renombrado mecánico verificado por los tests existentes — no una reescritura de
lógica financiera. La construcción real sí fue grande (financial-orchestrator.ts,
2.669 líneas, con siete puntos de envío de respuesta reescritos con el
patrón de `presentTurn` inyectado) pero acotada.

La segunda: al intentar borrar cada mención de "whatsapp" restante,
apareció un vocabulario duplicado ya existente en el árbol —columnas y
schemas usan `"dashboard_manual"`, el resto del código usa `"dashboard"`
para el mismo concepto—. Unificarlos habría sido una migración de esquema
disfrazada de limpieza de código, así que `WEB-D170` fija el puerto en el
vocabulario que ya existe (`"whatsapp" | "dashboard"`) en vez de inventar
uno nuevo, y las funciones que sí necesitan `"dashboard_manual"` (los
comandos de `core/finance/commands.ts`) quedan como el único punto de
traducción, documentado.

La tercera: al construir la prueba de agnosticismo, `AC-CANAL-01` reveló
que dos de sus siete casos y dos criterios más (`AC-CANAL-06`,
`AC-CANAL-08`) no tienen ningún código real detrás todavía —ningún flujo
compone un bloque `hallazgo` con nivel de certeza, ni existe un comando de
navegación que produzca un bloque `mostrar`, ni existe recategorización en
lote (`26` `ACT-MOV-10`)—. Escribir esas pruebas en verde habría exigido
inventar comportamiento de producto (`RUL-HECHO-04` lo prohíbe), así que
`AC-CANAL-01` pasa a agregado (`WEB-D173`, seis de siete casos) y
`AC-CANAL-06`/`AC-CANAL-08` quedan declarados sin cerrar (`WEB-D174`).

La cuarta, la más seria: verificar `AC-CANAL-09` ("un foco abierto en un
canal se puede retomar en el otro") contra el esquema real encontró que
`conversation_memory_states` tiene un índice único por
`(user_id, channel, scope)` — la memoria conversacional está particionada
por canal, exactamente lo contrario de lo que `21` §10 exige. Es un defecto
real, no una brecha de prueba: hoy, una conversación empezada por WhatsApp
no se puede continuar en la web aunque el usuario la abra dentro de su
vigencia. Se registra como deuda nueva (`D-12`, `53` §3) con su propio
corte futuro, y `AC-CANAL-09` no cierra en `W-04` (`WEB-D174`).

### Qué quedó abierto

Ningún criterio de `G3` propio. `AC-CANAL-01` sigue abierto para el caso de
operación masiva (cierra con `26`). `AC-CANAL-06` y `AC-CANAL-08` cierran
cuando exista un flujo real que produzca `hallazgo` o `mostrar`. `AC-CANAL-09`
cierra cuando se pague `D-12` — un corte que rediseñe la clave de memoria
conversacional para que no dependa del canal.

### Documentos corregidos

- `21` §11: `AC-CANAL-01` marcado agregado (`WEB-D173`); `AC-CANAL-06`,
  `AC-CANAL-08`, `AC-CANAL-09` marcados sin cerrar (`WEB-D174`); `Clase:`
  añadida a `AC-CANAL-01`, `03`, `04`, `05`, `07`.
- `52` §15: `AC-INV-03` recibe `Clase: unidad`, que le faltaba.
- `54` W-04: lista de "Cierra" corregida para reflejar el cierre agregado
  y los tres criterios diferidos.
- `50` §3.1: censo de clases actualizado (96 con clase, no 87; `unidad` 7,
  no 1; `integracion` 3, no 1; `lint` 15, no 14 — esta última tabla llevaba
  desactualizada desde antes de `W-04`, corregida de paso).
- `53` §3: `D-12` (nueva) — memoria conversacional particionada por canal.
- `03_decisiones_producto_web.md`: `WEB-D170` a `WEB-D174` (nuevas).

---

## W-05 — Contratos de API

**Cerrado:** 2026-07-28
**Portones:** G1 ✓ · G2 no aplica (el corte no declara criterios de `G2`) · G3 ninguno propio
**Matriz regenerada:** 2026-07-28, con `npm run matriz:generar`, posterior al
commit `58b0a0e` (`AC-TRAZ-12`).

### Qué se entregó

Infraestructura compartida nueva en `src/app/api/_lib/`: `pagination.ts`
(cursor opaco de una columna, compuesto de varias, y en memoria para
catálogos pequeños — `encodeCursor`/`decodeCursor`, `buildCursorOrFilter`,
`paginate`/`paginateComposite`/`paginateInMemory`), `idempotency.ts`
(`readIdempotencyKey`, que reemplaza cuatro validaciones duplicadas de
8-180 caracteres), `csrf.ts` (`verifyOrigin`, falla cerrado si no puede
determinar el origen propio) y `rate-limit.ts` (clasificador de familia por
ruta+método y llamada al RPC nuevo). Migración `047_api_rate_limits.sql`:
tabla `api_rate_limit_counters` y RPC `check_and_increment_rate_limit`, un
contador de ventana deslizante aproximada sobre Postgres (`WEB-D179`, sin
Redis/Upstash en el stack). `src/proxy.ts` gana verificación de CSRF,
límite de peticiones y las tres cabeceras de seguridad de `14` §9
(incluida la CSP que el propio `14` decía tener `54` y no tenía,
`WEB-D178`) para toda petición a `/api/v1/*` — un único punto, correcto
por construcción para familias que todavía no existen (`WEB-D180`).

Paginación por cursor y filtros server-side aplicados a los nueve
listados que existen hoy: `movements` (cursor compuesto
`created_at, occurred_at` + `id`, ya que `occurred_at` solo no era
estable), `pending`, `debts` (cursor por `created_at`/`id`, no por
`next_payment_date` porque admite null; el orden de negocio se reaplica
sobre la página ya recortada, `sortDebtsByNextPaymentDate`), `recurring`
(mismo patrón, `sortRecurringRulesByNextExpectedDate`, y se corrigió
`dashboard/upcoming` para no perder ese orden), `insights` (cursor
compuesto `rank_score, created_at`), y los catálogos pequeños `accounts`,
`boxes`, `categories`, `subcategories`, `tags` (paginación en memoria,
`paginateInMemory`). Las nueve rutas ganaron `.strict()` en su esquema de
query (`AC-API-04`); `insights` tenía además un defecto real —solo leía
`limit`/`status`/`type` explícitos de la URL, así que cualquier filtro
desconocido ya se ignoraba en silencio antes de esto, sin necesitar
`.strict()` para probarlo—.

`Idempotency-Key` real extendido a: creación de deudas (`createDebt`
ahora comprueba `(user_id, idempotency_key)` antes de insertar y atrapa la
violación de índice único de una carrera concurrente, migración `043`),
`pending/[id]/confirm` y `pending/batch-confirm` (cabecera exigida; el
mecanismo de fondo ya era idempotente por `pending_item_id`), y
`preferences/experience`/`memory` (las cuatro claves sintéticas
`dashboard:${trace_id}:...` —que cambiaban en cada reintento real, dejando
inalcanzable el índice único de la migración `045`— pasan a usar la
cabecera real del cliente). `http.ts` gana `RATE_LIMITED`/
`PAYLOAD_TOO_LARGE` en `ApiErrorCode` y `page`/`idempotent_replay` en
`ApiMeta`. `npm run typecheck`, `npm run lint`, `npm run build` (con los
cinco gates de `prebuild` en verde, Proxy sigue en runtime Node.js), `npm
test` y `npm run test:rls` terminan sin errores.

### Qué sorprendió

Cuatro cosas, cada una llevó a una decisión (`WEB-D175` a `WEB-D182`).

La primera: nueve de las dieciocho familias que `14` §10 mapea
(`budgets`, `projections`, `simulate`, `reports`, `exports`, `imports`,
`assistant`, `notifications`, `summary`) no tienen ni una ruta escrita
todavía. `AC-API-01`/`02`/`03`/`04`/`10` pasan a agregados sobre las nueve
que sí existen (`WEB-D175`), heredando el mecanismo compartido cuando se
construyan.

La segunda, la más cara de las cuatro: el plan era reconectar
`POST /api/v1/debts` al comando de Core `debt-creation-command.ts` (que ya
tenía idempotencia completa vía la migración `043`) en vez de construir
algo nuevo. Al implementarlo, `CreateDebtCommandSchema` exige
`related_person_name` no vacío, mientras que el producto permite crear una
deuda sin persona relacionada (un servicio o factura) — `debts.repository.ts`
ya lo soporta. Forzar el comando de Core habría roto ese caso sin ningún
test que lo cubriera. Se optó por hacer idempotente la propia función
`createDebt` en vez de rehusar el comando de Core (`WEB-D176`), verificado
con una prueba de concurrencia real contra Postgres (dos llamadas
simultáneas con la misma clave, una gana la carrera del índice único, la
otra recibe la fila ganadora).

La tercera: `14` §8 y `43` `RUL-AUTH-06` dan números distintos para el
mismo límite de autenticación ("10 por 15 minutos" contra "5 en 15
minutos"), y además las peticiones de autenticación/recuperación de
contraseña/registro nunca pasan por nuestro servidor — van del navegador
directo a la API de Supabase Auth. `14` §8 se corrigió a favor de `43`
(más detallado, dueño de `AC-SEG-05`/`W-18`), y esas tres familias de
`AC-API-06` no cierran en `W-05` (`WEB-D181`).

La cuarta: `14` §9 decía que la Content Security Policy estaba "definida
en `54`", y `54` no la definía en ningún sitio — se corrigió `14` §9 para
definirla directamente (`WEB-D178`), el mismo patrón de referencia rota
que otros `WEB-D` ya corrigieron en otros documentos.

### Qué quedó abierto

`AC-API-01`/`02`/`03`/`04`/`10` siguen abiertos para las nueve familias
que no existen; cierran cuando cada una nazca, reutilizando
`pagination.ts`. `AC-API-05` queda abierto para `imports`/`assistant` (sus
familias tampoco existen). `AC-API-06` queda abierto para
autenticación/recuperación de contraseña/registro — es trabajo de `W-18`,
que puede reutilizar el RPC `check_and_increment_rate_limit`. `AC-API-09`
no cierra: la familia `assistant` no existe.

### Documentos corregidos

- `14` §8: tabla de límites corregida (solo las familias que pasan por
  `/api/v1/*`; autenticación/recuperación/registro remiten a `43`
  `RUL-AUTH-06`, `WEB-D181`).
- `14` §9: Content Security Policy definida directamente, ya no remite a
  una definición de `54` que no existía (`WEB-D178`).
- `14` §15: `Clase:` añadida a `AC-API-01, 02, 03, 04, 05, 06, 07, 08, 10`;
  `AC-API-09` marcado sin cerrar (`WEB-D177`).
- `50` §3.1: censo de clases actualizado (105 con clase, no 96; `unidad`
  14, no 7; `integracion` 5, no 3).
- `03_decisiones_producto_web.md`: `WEB-D175` a `WEB-D182` (nuevas);
  `WEB-D170` corregida (el tipo `Canal` real es `"whatsapp" | "dashboard"`,
  no `"web" | "whatsapp"` como decía por error desde `W-04`).

---

## W-06 — Sistema de diseño

**Cerrado:** 2026-07-28
**Portones:** G1 ✓ · G2 no aplica (el corte no declara criterios de `G2`) · G3 ninguno propio
**Matriz regenerada:** 2026-07-28, con `npm run matriz:generar`, posterior
al commit `f8d8f69` (`AC-TRAZ-12`).

### Qué se entregó

`src/shared/ui/` (8 ficheros) se mueve a `src/ui/primitivas/` (`16` §10),
con `src/ui/tokens.ts` nuevo para acceso tipado. Los 7 componentes
existentes se amplían: `Button` (variante `danger` corregida de rojo
literal a `--color-error`), `Card` (`CardLink`, toda la tarjeta como
enlace), `Field` (`aria-describedby`/`aria-invalid` automáticos vía
`cloneElement`, prefijo/sufijo en `Input`, asterisco de requerido),
`States` (`SkeletonRow`/`SkeletonCard` con la forma real del contenido),
`Money` (`value: number | null` → "—" nunca `S/0.00`, variante `compact`,
y un defecto real corregido: `Intl` deja un espacio entre "S/" y la
cifra que `18` §9.1 no permite), `Badge` (tonos `amber-800`/`blue-800`
literales corregidos a tokens, tonos `budget-*` nuevos), `Switch`
(`loading`).

18 primitivas nuevas en `src/ui/primitivas/`: `Dialog`/`AlertDialog`
(foco atrapado propio en `internal/use-focus-trap.ts`, sin librería
headless nueva — `Escape`, `Tab`/`Shift+Tab` cíclico, retorno de foco al
disparador, `DialogTitle` obligatorio que falla en desarrollo si falta),
`Sheet` (mismo contrato, posición lateral/inferior), `Popover`/
`DropdownMenu`/`Combobox`/`Command` (capa no modal compartida,
`internal/use-dismissable-layer.ts` — `Escape` y clic fuera cierran, sin
atrapar foco), `Tooltip` (aparece con foco de teclado, no solo ratón),
`Tabs`/`RadioGroup` (flechas + `Home`/`End`), `Checkbox` (indeterminado
real vía la propiedad DOM, no solo visual), `Textarea` (autoajuste de
altura + contador), `Progress`/`Avatar`/`Separator`/`ScrollArea`/
`VisuallyHidden`/`Table`/`Pagination` (botones reales, reemplaza el "Ver
más" sin manejador — pero solo el componente; `movements-screen.tsx`
sigue con el suyo, `WEB-D182`), y `DatePicker`/`DateRangePicker`
(entrada por texto siempre disponible, calendario nativo con
`Intl`/`Date` en `internal/date-lima.ts` — sin elegir librería de fechas,
esa decisión es de `W-07`, `WEB-D165`).

Tokens nuevos en `globals.css`: paleta categórica de 8 colores para
gráficos, semáforo `budget-ok/warning/over`, superficies del asistente
(alias de tokens ya verificados), y cuatro `--color-*-on-subtle` para
texto sobre fondo `-subtle` (ver "Qué sorprendió"). Modo oscuro manual:
migración `048` añade `theme_preference` (`system`/`light`/`dark`) a
`set_experience_preferences`; `DiscreetModeProvider` (ya el único
proveedor del modo discreto) lo aplica a `<html data-theme>` en vez de
crear un segundo proveedor paralelo. `globals.css` gana un bloque
`:root[data-theme="dark"]` gemelo del `@media` existente, con un test
que falla si los dos divergen.

`sin-literales-de-estilo` (`AC-DS-01`) se activa (`WEB-D169` la dejaba
definida sin activar hasta que existiera la paleta de tokens): tres
comprobaciones —paleta por defecto de Tailwind, sintaxis de valor
arbitrario, `style` en línea con color/tamaño literal— sobre `src/`
fuera de `src/features/**`. Infraestructura de accesibilidad nueva:
`tests/lint/contraste.test.ts` (fórmula real de luminancia relativa de
WCAG sobre los hexadecimales de `globals.css`, no una aprobación
visual) y `tests/lint/foco-sin-reemplazo.test.ts` (`outline-none` exige
un anillo, otro contorno o un cambio de fondo en la misma cadena de
clases). `npx tsc --noEmit`, `npx eslint .`, `npm test` (212 ficheros,
1.190 pruebas) terminan sin errores.

### Qué sorprendió

La medición de contraste encontró un defecto real, no fabricado: los
tonos semánticos (`success`, `warning`, `error`, `info`) como texto sobre
su propio fondo `-subtle` no llegan a 4.5:1 en modo claro —2.88, 1.85,
3.44 y 2.37, medidos con la fórmula real, no estimados—. Afectaba
directamente al `Badge` que este mismo corte amplía. Se corrigió con
cuatro tokens `--color-*-on-subtle` (oscurecidos hasta cruzar 4.5:1
contra su "-subtle" en claro; en oscuro el semántico base ya cumplía de
sobra, así que ahí se repite el mismo valor) en vez de declarar el
criterio cerrado sobre un par que no pasaba.

La segunda: `jsdom` no calcula layout, así que `offsetParent` es
siempre `null` — el primer `useFocusTrap` filtraba los elementos
enfocables por `offsetParent !== null`, lo que en las pruebas dejaba el
atrapado de foco operando sobre una lista vacía sin que ningún test lo
notara al principio (el foco nunca se movía, así que la aserción de
"vuelve al disparador" pasaba por una razón equivocada: el foco nunca
se había ido). Se cambió el filtro a `hidden`/`aria-hidden` explícitos,
y se re-verificó cada prueba de foco con `RUL-HECHO-02` para confirmar
que ahora sí ejercita el atrapado real.

La tercera, la misma tensión que `WEB-D182` ya resolvió para
`movements-screen.tsx`: `54` describe que
`modal-accessibility-guard.tsx` "desaparece porque deja de haber
diálogos mal construidos, no porque se borra" — medido, el 100 % de
los diálogos mal construidos conocidos (los 17 modales a mano) viven
dentro de las 5 carpetas `REEMPLAZAR` de `52` §5. Borrar el guard ahora
les quitaría el atrapado de foco que hoy tienen en producción, sin que
ninguna migración real los sustituya todavía — `WEB-D183` lo deja
montado hasta que cada pantalla condenada migre sus propios modales.

La cuarta: de los diez `AC-A11Y-*` que `54` lista como "Cierra" de
`W-06`, dos (`01`, `08`) dependen de los doce recorridos de
`tests/e2e/recorridos/`/`irreversibles/`, que ya existían como
`test.fixme()` con su propio corte dueño anotado desde `W-03` —ninguno
es de `W-06`— y dos más (`04`, `06`) piden evidencia `USER` que exige el
protocolo de tres personas de `WEB-D149`. `WEB-D185` documenta el
reparto real: seis cierran completos, dos parcialmente (`TEST` sí,
`USER` no), uno es agregado, y dos no cierran.

### Qué quedó abierto

`AC-DS-05` (borrar el guard) y los 17 modales a mano: migran cuando cada
corte de módulo (`W-08` a `W-19`) reconstruya su pantalla. `AC-DS-10`
sobre el "Ver más" de `movements-screen.tsx`: mismo tratamiento,
`WEB-D182`. `AC-A11Y-01`/`08` (e2e/visual) y la mitad `USER` de
`AC-DS-08`/`AC-A11Y-04`/`06`: fuera del alcance de este corte
(`WEB-D185`). Los 12 componentes de dominio de `16` §4.3
(`MovementRow`, `ConfirmationCard`, `Chart`, etc.): los construye el
corte de módulo que primero los necesite (`WEB-D184`). El arrastrar
hacia abajo para cerrar `Sheet` en móvil (`16` §4.2) no se implementó —
simplificación no documentada como decisión porque no genera una
contradicción de criterios, solo queda pendiente.

### Documentos corregidos

- `16` §12: `Clase:` añadida a `AC-DS-01` a `10` (o nota de por qué no
  cierra); `AC-DS-05` marcado sin cerrar (`WEB-D183`).
- `18` §11: `Clase:` añadida a los diez `AC-A11Y-*` (o nota de por qué
  no cierra/es agregado), `WEB-D185`.
- `50` §3.1: censo de clases actualizado (117 con clase, no 105; `lint`
  21, no 15; `unidad` 20, no 14).
- `03_decisiones_producto_web.md`: `WEB-D183` a `WEB-D185` (nuevas).

---

## W-07 — Esqueleto y patrones

**Cerrado:** 2026-07-28
**Portones:** G1 ✓ · G2 no aplica (el corte no declara criterios de `G2`) · G3 ninguno propio
**Matriz regenerada:** 2026-07-28, con `npm run matriz:generar`, posterior
al commit `01b1158` (`AC-TRAZ-12`).

### Qué se entregó

`dashboard-app.tsx` (263 líneas, router manual por `?view=`) desaparece.
`src/app/(publico)/` y `src/app/(app)/` son grupos de rutas reales: las
cinco páginas legales se mueven tal cual a `(publico)/`; `entrar` y
`crear-cuenta` son rutas propias que montan `AuthScreen` con un
`initialMode` nuevo (las pestañas navegan de verdad en vez de solo
cambiar estado local); `recuperar-clave`, `restablecer-clave`,
`verificar`, `estado` y `baja` son marcadores con URL propia
(`PlaceholderSection`) — su lógica real es de `W-18` o de sus módulos
dueños. `(app)/layout.tsx` verifica la sesión una vez; `src/proxy.ts`
gana el redirigido real con `?redirigir=<ruta>` (única capa con la URL
completa) y `src/shared/routing/known-routes.ts` valida ese parámetro
contra una lista blanca antes de que `AuthScreen` lo siga tras iniciar
sesión. Las 30+ rutas de `10` §3.2 existen: las que ya tienen pantalla
condenada la montan a través de un puente nuevo
(`src/shared/legacy-nav/legacy-view-routes.ts`, traduce el
`onNavigate(view)` que esas pantallas ya esperan a rutas reales sin
tocar su código); el resto son marcadores hasta su corte de módulo.
`movimientos/` estrena el piloto de rutas paralelas e interceptadas de
`12` §6: `@panel/default.tsx` + `@panel/(.)[id]/page.tsx` muestran un
panel sobre el listado en navegación de cliente, `[id]/page.tsx` sirve
la pantalla completa en carga directa, ambos sobre el mismo
`MovementDetailView` nuevo (fuera de `src/features/movements/`,
`WEB-D164`).

Se eligieron tres librerías con el caso difícil escrito antes
(`WEB-D165`/`WEB-D186`; gráficos se difiere a `W-14`): TanStack Query
(`src/shared/data/` — claves jerárquicas de `17` §2.2, mapa de
invalidación selectiva de `17` §2.3, mutación optimista genérica),
`react-hook-form` + `@hookform/resolvers/zod` (`src/shared/forms/
use-zod-form.ts`, `mode: "onBlur"`), y `date-fns` junto al módulo único
de fecha de Lima (`src/shared/dates/lima.ts`, offset fijo -05:00, sin
tabla de zonas horarias). `sin-view-query` (`W-03`) pierde su exclusión
de `dashboard-app.tsx` y cierra sin excepciones. `fetch-a-mano`
(`AC-PAT-01`, diferida por `WEB-D169`) se activa. `sin-confianza-numerica`
nueva (`AC-EXP-05`).

### Qué sorprendió

El caso difícil de fechas encontró un defecto real antes de firmar la
elección: `date-fns#addMonths` opera con los getters/setters *locales*
de `Date`; el primer intento construía la fecha base con `Date.UTC` y
leía el resultado con `getUTC*`, y bajo `TZ=America/Lima` eso convertía
el 31 de enero en 1 de marzo en vez de 28 de febrero. Corregido usando
el constructor y los getters locales de punta a punta — la función solo
hace aritmética de calendario, nunca un instante real, así que es
correcto sin importar la zona del proceso.

`fetch-a-mano` encontró una infractora real fuera de `src/features/**`
apenas se activó: `discreet-mode-context.tsx` (`W-06`) seguía cargando
sus preferencias con `useEffect` + bandera de cancelación manual — el
mismo patrón que el propio criterio prohíbe. Se migró a `useQuery` +
`useOptimisticMutation`, con su test envuelto en `QueryClientProvider`.

Auditar `AC-CONFIANZA-02` antes de asumir que seguía abierto (`11` §9 cita
literalmente `auth-screen.tsx` publicando `Invalid login credentials`,
`C-13`) mostró que ese hallazgo no corresponde al estado real del
repositorio: `toAuthErrorMessage()` ya traduce los mensajes conocidos de
Supabase al español, con una prueba que ya existía en el commit base,
antes de que esta reconstrucción empezara. `WEB-D151` había asumido que
`C-13` seguía vigente al escribir "mejorarla es `W-18`"; el criterio
cierra en `W-07` sin tocar el fichero, porque moverlo tal cual conserva
la traducción intacta.

Un primer borrador de esta misma decisión proponía escribir recorridos
E2E nuevos, más pequeños, para `AC-NAV-01`/`02`/`04`/`05`/`07`/`08` —
auditado contra `WEB-D154` antes de escribir esas pruebas, la idea
violaba la decisión de gobierno que ya cierra el conjunto E2E en doce
recorridos. Corregido con el árbol de `WEB-D153`: seis de esos ocho
criterios no necesitan un navegador real y cierran con `build`/`lint`/
`unidad`; los dos que sí lo necesitan (`AC-NAV-02`/`03`, y `AC-ARQ-08`
del mismo lote) no cierran en este corte.

El manifest de producción de Turbopack no tiene el `app-build-manifest.json`
plano de los builds de Webpack que un gate de presupuesto necesitaría
para `AC-ARQ-03` — auditado antes de escribir esa prueba, en vez de
inventar una comprobación sobre un formato sin verificar.

### Qué quedó abierto

`AC-NAV-02`/`03`, `AC-ARQ-08` (necesitan navegador real, sin recorrido
E2E propio disponible — cierran cuando el recorrido de movimientos de
`W-09` los ejerza como parte de un flujo funcional). `AC-ARQ-03`
(presupuesto, formato de manifest sin auditar y nada pesado que proteger
todavía — `W-14`). `AC-PAT-03`/`04`/`05`/`06`/`08` (piden un listado o
formulario real — sus cortes de módulo). `AC-EXP-01`/`03`/`04`,
`AC-CONFIANZA-01`/`03`/`04`/`05`/`07`/`08` (pantallas reales o `USER`).
La mitad `USER` de `AC-NAV-06` y `AC-CONFIANZA-06` (`WEB-D149`). El
listado de movimientos condenado no enlaza todavía a
`/movimientos/[id]` — el mecanismo de panel existe, pero nadie lo
dispara desde una fila real hasta que `W-09` reconstruya la pantalla.

### Documentos corregidos

- `08` §13: `Clase:` añadida a `AC-EXP-02`, `05`, `06`; nota de por qué
  no cierran en `01`, `03`, `04`.
- `10` §11: `AC-NAV-01` reclasificado de `e2e` a `build`; `Clase:`
  añadida a `04`, `06` (parte `TEST`), `07`, `08`; nota de por qué no
  cierran `02`, `03`.
- `11` §14: `Clase:` añadida a `AC-CONFIANZA-02`, `06` (parte `TEST`);
  nota de por qué no cierran `01`, `03`, `04`, `05`, `07`, `08`.
- `12` §15: `Clase:` añadida a `AC-ARQ-01`, `06`, `07`; nota de por qué
  no cierran `03`, `08`.
- `17` §11: `Clase:` añadida a `AC-PAT-02`, `07`, `10`; nota de por qué
  no cierran `03` a `06`, `08`.
- `50` §3.1: censo de clases actualizado (132 con clase, no 117; `lint`
  25, no 21; `unidad` 31, no 20; `e2e` 7, no 8; `build` 16, no 15).
- `03_decisiones_producto_web.md`: `WEB-D186` a `WEB-D189` (nuevas), y
  correcciones a `WEB-D187`/`188`/`189` tras auditar `WEB-D154` y el
  estado real de `auth-screen.tsx` antes de firmar la versión final.

## W-08 — Las cuatro capas del dinero

**Cerrado:** 2026-07-29
**Portones:** G1 ✓ · G2 no aplica (el corte no declara criterios de `G2`) · G3 ninguno propio
**Matriz regenerada:** 2026-07-29, con `npm run matriz:generar`, posterior
al commit `7df5b91` (`AC-TRAZ-12`).

### Qué se entregó

Un bug real de doble descuento en las cuatro capas: cuando un compromiso
estaba parcialmente cubierto por una caja, `GET /api/v1/money` restaba el
monto nominal del compromiso en vez de `Math.min(compromiso, saldo real de
la caja)`, y la misma lógica estaba reimplementada por separado (y mal) en
`tool-gateway.ts::buildBalanceSnapshot` e `insight-engine.ts` (dos veces).
Las cuatro quedaron en un único módulo (`src/core/finance/money-layers.ts`),
probado contra el ejemplo canónico de `09` §4 (800/580/220/170) y contra
cobertura parcial, verificado con `RUL-HECHO-02`. Cajas ganan una
invariante de base de datos (`boxes_current_balance_non_negative`,
migración `049`) y las cuentas, unicidad de nombre sin distinguir
mayúsculas (`accounts_unique_name_per_user_ci`) — ambas probadas contra
Postgres real en `tests/rls/`. Ciclo de vida de cuenta completo: restaurar
una archivada (`POST /accounts/[id]/restore`), cambiar la cuenta por
defecto (`PATCH .../[id]` con `is_default`), y archivar en cascada con sus
cajas sin exigir saldo cero ni cajas vacías — con dos rutas `GET` nuevas
(`accounts/[id]`, `boxes/[id]`) que el documento `24` §10 exigía y no
existían. Categorías: `GET /categories` trae el total del período por
categoría con `sin_clasificar` separado de `otros`; `GET /subcategories`
trae conteo de movimientos y ordena por uso; el límite de etiquetas por
movimiento se corrigió de 12 a 6 (contradecía `RUL-CAT §7`/`ERR-CAT-05`
desde antes de este corte, nadie lo había notado hasta escribir la prueba).

El frontend de Mi Dinero (`SCR-CUENTAS-01` a `07`) se reconstruyó entero
en `src/app/(app)/mi-dinero/`, reemplazando el `money-screen.tsx` condenado
de `src/features/money/` (`WEB-D164`) tras extraer su conocimiento de
copys y casos borde antes de borrarlo. Categorías (`SCR-CAT-01` a `03`,
alcance recortado por `WEB-D190`): gestión de las 12 categorías con su
total, detalle de categoría con renombrar/archivar subcategorías (sin
fusionar), y `CategorySelector` — un componente compartido con búsqueda,
"sin clasificar" explícito, y crear subcategoría inline — construido sin
consumidor propio todavía porque su primer consumidor real es el
formulario de movimientos de `W-09`.

### Qué sorprendió

El bug de doble descuento no vivía en un solo lugar: existían **tres**
implementaciones independientes del cálculo de las cuatro capas
(`money/route.ts`, `tool-gateway.ts`, `insight-engine.ts` dos veces) y
ninguna prueba existente las comparaba entre sí ni contra el ejemplo
canónico del documento — las cuatro pasaban sus propias pruebas
individuales mientras calculaban números distintos ante el mismo caso de
cobertura parcial.

Auditar la cobertura de `AC-CUENTAS-12` ("máximo una cuenta por defecto
activa") antes de darla por cerrada encontró que nunca había tenido una
prueba propia — el único test que la tocaba mockeaba `setDefaultAccount`
en vez de ejercitarla. Al escribir la prueba real contra Postgres
(`tests/rls/account-box-invariants.test.ts`) y romper la implementación
para verificarla (`RUL-HECHO-02`), apareció una segunda protección que
nadie había documentado: un índice de exclusión
`accounts_one_default_per_user` de la migración `004`, anterior a esta
reconstrucción — el criterio ya estaba doblemente protegido, solo sin
prueba.

`subcategories/[id]/route.ts` (`PATCH`/`DELETE`, ya existente) no tenía
ningún test — cero, ni siquiera el camino feliz — a pesar de ser la ruta
que las nuevas pantallas de `SCR-CAT-02` ahora ejercitan en producción.
Se cerró con los cinco casos de `51` §6.2.

### Qué quedó abierto

`AC-CAT-08` a `12` (fusión, reclasificación masiva, panel "por qué",
olvidar un aprendizaje) y `AC-CUENTAS-18` (comandos del asistente):
dependen de módulos que todavía no existen (`36`, `W-13`) o de la fase
WhatsApp (`WEB-D001`). `AC-CUENTAS-13`/`AC-CAT-15` (nada de service-role):
diferido a `AC-SEG-07`, transversal (`WEB-D191`). `AC-CUENTAS-17` (icono +
signo, no solo color): construido en `AccountsPanel`, sin prueba
automatizada dedicada — candidato a `tests/a11y/` en un corte futuro.
`tool-gateway.ts::buildBalanceSnapshot` no tiene prueba propia (función
privada, hereda cobertura de `calculateMoneyLayers` pero su mapeo de datos
no está aislado). Verificación interactiva en navegador de las pantallas
nuevas: bloqueada dos veces — el entorno de vista previa no alcanza al
Supabase local (`127.0.0.1`, aislamiento de red del sandbox), y crear un
usuario de prueba desechable contra el proyecto de Supabase real fue
denegado por el clasificador de modo automático. Se verificó en su lugar
que la ruta protegida redirige correctamente sin sesión (sin error de
servidor) y que `tsc`/`eslint`/`test`/`build` pasan limpios — no
reemplaza una prueba de usuario real, y se reporta así en vez de afirmar
una verificación que no ocurrió.

### Documentos corregidos

- `09` §11: `Clase:` añadida a `AC-DINERO-01`, `02`, `05`, `06`; nota de
  por qué no cierran `03` (módulo de presupuestos inexistente) y `04`
  (`USER` no verificado).
- `24` §20: `Clase:` añadida a `AC-CUENTAS-01` a `04`, `06` a `12`, `14`
  a `16`; nota de por qué no cierran `05`, `13`, `17`, `18`.
- `25` §20: `Clase:` añadida a `AC-CAT-01` a `07`, `13`, `14`; nota de por
  qué no cierran `08` a `12`, `15`.
- `24` §22 y `25` §22: `WEB-D194` (nuevo) — `SCR-CAT-02` no enlaza al
  listado de movimientos filtrado por categoría, porque la pantalla de
  movimientos (`W-09`) todavía no acepta ese filtro.
- `50` §3.1: censo de clases actualizado (159 con clase, no 132; `lint`
  28, no 25; `integracion` 11, no 5; `unidad` 49, no 31).
- `03_decisiones_producto_web.md`: `WEB-D190` a `WEB-D194` (nuevas, cuatro
  del trabajo previo a este cierre más `WEB-D194` de esta sección).

---

## W-09 — Los once tipos de movimiento se guardan desde Movimientos

**Cerrado:** 2026-07-29
**Portones:** G1 ✓ · G2 no aplica (el corte no declara criterios de `G2`) · G3 ninguno propio
**Matriz regenerada:** 2026-07-29, con `npm run matriz:generar`, posterior
al commit `61e7a91` (`AC-TRAZ-12`).

### Qué se entregó

`RUL-MOV-01`/`AC-MOV-01` cierran su parte `TEST`: los 11 tipos de movimiento
se guardan de verdad desde `POST /api/v1/movements`, cerrando `C-05` (antes
9 de 11 expulsaban al usuario a otra pantalla). La investigación previa a
escribir código (`WEB-D195`) encontró que la ruta genérica no impedía crear
directamente `pago_deuda`, `deuda_adquirida`, `prestamo_dado`,
`prestamo_recibido` o `devolucion_recibida` sin pasar por sus comandos
especializados — un movimiento de deuda "huérfano" que no actualizaría
`debts.current_balance` ni las cuotas. La ruta ahora despacha por grupo:
`gasto`, `ingreso`, `transferencia`, `asignacion_interna`, `ajuste` y
`pago_recurrente` (sin ocurrencia) siguen el camino genérico ya existente;
`deuda_adquirida`/`prestamo_dado`/`prestamo_recibido` despachan
`CreateDebtCommand` (el mismo comando que ya usa el canal del asistente);
`pago_deuda`/`devolucion_recibida` exigen una deuda existente y despachan
`RecordDebtPaymentCommand`, validando que el tipo elegido coincida con la
dirección real de la deuda antes de comprometer nada. `deuda_adquirida` se
habilitó como `movement_type` válido de `CreateDebtCommand`
(`WEB-D198`) — antes solo existían `prestamo_recibido`/`prestamo_dado`, y
ningún camino del repositorio podía crear una deuda adquirida de verdad.

`ajuste` cierra como el undécimo tipo real: `26` §4.1/§7 documentaba "amount
> 0 salvo en ajuste, donde puede ser negativo" desde antes de este corte,
pero el constraint de la migración `006` y `requireAmount` en
`balance-engine.ts` rechazaban cualquier monto negativo para cualquier tipo
— la regla estaba escrita, nunca implementada (`WEB-D197`). La migración
`051` corrige el constraint; el campo "cuenta" de un ajuste se envía siempre
como destino (nunca origen), para que el signo del monto sea la única señal
de si el saldo sube o baja. `RUL-MOV-10`/`ERR-MOV-08` (fecha futura
rechazada, ofrece Pagos que vienen) tampoco existía en ningún lado del
repositorio; se agregó a los tres caminos de creación y a la corrección de
fecha por `PATCH`. La búsqueda de texto (`AC-MOV-05`) es nueva en el
servidor: migración `052` agrega una columna generada `search_vector`
(`tsvector` en español sobre `merchant`/`description`) con índice GIN, y
`GET /movements` la usa vía `.textSearch()` en vez de construir un filtro
`ilike` a mano con el texto del usuario.

El frontend reconstruye `/movimientos` entero en `src/app/(app)/movimientos/`,
reemplazando `movements-screen.tsx` (1.697 líneas, condenado por
`WEB-D164`) tras extraer sus doce casos borde rescatables al §19 del
módulo. `SCR-MOV-01` (listado con `useInfiniteQuery`, búsqueda siempre
visible, filtros de tipo/estado/categoría/fecha aplicados en servidor,
estados vacío/sin-resultados/error distintos), `SCR-MOV-02` (detalle con
editar/eliminar/restaurar/historial/impacto), `SCR-MOV-03` (formulario
adaptado a los 11 tipos, con enlace secundario a Deudas/Pagos que vienen
cuando aplica) y `SCR-MOV-05` (confirmación de eliminación nombrando el
movimiento) están construidas. `SCR-MOV-06`/`07` (panel de filtros con
previsualización de conteo, acciones en lote) no se construyeron — ver "qué
quedó abierto". El enlace pendiente de `WEB-D194` (`SCR-CAT-02` → listado
filtrado por categoría) se cerró (`WEB-D200`): la API ya filtraba por
`category_id` desde `W-05`, el bloqueo era enteramente del listado viejo.

`GET /movements/[id]/history` es una ruta nueva (no existía ningún endpoint
que leyera `movement_audit_log`); pagina por cursor, nunca trae el
historial completo de una vez. `tsc`, `eslint`, `npm run build` (con los
gates de `prebuild` en verde) y `npm test` (237 ficheros, 1.349 pruebas)
terminan sin errores, salvo un caso descrito abajo.

### Qué sorprendió

Cinco cosas.

La primera y más seria: la investigación de reconocimiento (antes de
escribir cualquier código) encontró que el respaldo financiero para los 11
tipos era mucho más sólido de lo que el módulo `26` asumía —
`CommandDispatcher`, el cálculo de saldo por tipo, la auditoría y la
detección de duplicados cross-canal ya existían y funcionaban— pero que
exactamente los cinco tipos "especializados" tenían una brecha real de
integridad de datos (arriba, `WEB-D195`) que nadie había notado porque
nunca se había intentado crearlos desde un formulario genérico. El corte
que el documento describía como "conectar un formulario a una API que ya
existe" resultó ser, en su mitad más delicada, cerrar un agujero de
integridad financiera real.

La segunda: `ajuste` con monto negativo — una regla escrita en el modelo de
datos del propio módulo `26` desde su redacción original — nunca había sido
implementada, ni en el constraint de base de datos ni en el Core. Nadie lo
había notado porque nadie había intentado registrar un ajuste negativo
antes de este corte.

La tercera: al diseñar `deuda_adquirida`/`prestamo_dado`/`prestamo_recibido`,
`CreateDebtCommand` resultó tener un test explícito ("crea deuda y
calendario mensual **sin inventar un movimiento** ni tocar cuentas") que
documentaba una decisión deliberada anterior: sin cuenta vinculada, no se
crea ninguna fila en `movements`, ni siquiera para tipos que si tuvieran
cuenta la usarían. Se preservó ese comportamiento en vez de "corregirlo"
para forzar una fila que el propio test decía explícitamente que no debía
existir.

La cuarta: la verificación en navegador con sesión real —el estándar que
venía rigiendo esta reconstrucción hasta `Mi Dinero`/`Categorías`— no fue
posible en este entorno: la extensión de Chrome de automatización no está
conectada en esta sesión. Sí fue posible ejecutar la app real contra el
proyecto de Supabase de staging (con las migraciones `051`/`052` aplicadas
ahí mismo) y confirmar por `curl` que las rutas protegidas redirigen sin
sesión y que la API exige autenticación — no reemplaza una verificación de
usuario real, y se reporta así en vez de afirmar una que no ocurrió. Por el
mismo motivo, los dos recorridos de Playwright que `W-03`/`W-07` dejaron
como `test.fixme()` asignados a este corte (registro rápido, eliminar y
restaurar) no se implementaron: hacerlo sin poder ejecutarlos contra una
sesión real habría sido escribir una prueba sin verificar que falla sin el
código y pasa con él (`RUL-HECHO-02`), exactamente lo que esas reglas
prohíben.

La quinta, menor: `AC-API-04` de `route.test.ts` (ya existente, de `W-05`)
resultó intermitente bajo la suite completa de 1.349 pruebas en este
entorno —pasa siempre en aislamiento y junto a los demás ficheros de
movimientos, pero falla por timeout de 5s cuando compite por recursos con
la suite entera—. No es una regresión de este corte: el fichero no se tocó
y su lógica no cambió.

### Qué quedó abierto

`AC-MOV-11` (cambiar el tipo muestra el efecto antes de confirmar) no se
construyó: `WEB-D195` solo permite cambiar el tipo entre los seis genéricos
entre sí (cambiar hacia o desde uno especializado se rechaza con
`ERR-MOV-06`), y la previsualización de efecto para ese subconjunto queda
pendiente. `AC-MOV-15`/`SCR-MOV-07` (acciones en lote) se difieren
completas a `W-10` (`WEB-D199`): el "contrato de operaciones masivas" que
`RUL-MOV-12` exige seguir es del módulo `27` (dueño `W-10`), y hoy no existe
ni siquiera en el único código real que se le parece
(`pending/batch-confirm`, sin preview ni `batch_id` ni deshacer). `AC-MOV-18`
no cierra: las rutas de movimientos ya estaban en la lista blanca de
excepciones temporales de `AC-SEG-01` desde `W-02`, y esa lista se vacía
con `AC-SEG-07`, no con este corte (`WEB-D201`, mismo patrón que
`WEB-D191`). `AC-MOV-02` (recorrido e2e), `AC-MOV-09`/`14`/`16` en su parte
`USER`, y `AC-MOV-04`/`20` (sin prueba dedicada, verificados por
construcción) quedan sin cerrar por las razones del punto cuatro de "qué
sorprendió". `SCR-MOV-06` (panel de filtros con previsualización de
conteo) no se construyó — los filtros de `26` §8 sí se aplican todos en
servidor, pero sin ese panel dedicado; candidato a un corte de pulido
futuro, sin AC propio que lo exija literalmente. Pagar una deuda desde una
caja (no solo cuenta) queda fuera de `pago_deuda`/`devolucion_recibida`
hasta que `W-11` extienda `RecordDebtPaymentCommand` (`WEB-D195`).

### Documentos corregidos

- `26` §19: doce casos borde rescatados de `movements-screen.tsx` antes de
  borrarla (`RUL-INV-01`), y dos casos nuevos de las decisiones de este
  corte (`pago_recurrente` sin ocurrencia, `ajuste` con destino).
- `26` §20: `Clase:` añadida a `AC-MOV-01` (parte `TEST`), `03`, `05`, `06`,
  `07`, `08`, `09` (parte `TEST`), `10`, `12`, `13`, `17`, `19`; nota de por
  qué no cierran `02`, `04`, `11`, `14`, `15`, `16`, `18`, `20`.
- `26` §22: decisiones nuevas listadas (`WEB-D195` a `WEB-D201`).
- `25` §8: `SCR-CAT-02` enlaza "Ver movimientos de esta categoría" a
  `/movimientos?categoria=...` (`WEB-D200`, cierra `WEB-D194`).
- `50` §3.1: censo de clases actualizado (171 con clase, no 159; `lint` 29,
  no 28; `integracion` 21, no 11; `unidad` 50, no 49).
- `tests/lint/seg-04-404-no-403.test.ts`: conteo de rutas actualizado a 60
  (`v1/movements/[id]/history`, nueva).
- `03_decisiones_producto_web.md`: `WEB-D195` a `WEB-D201` (nuevas).

---

## W-10 — Nada se registra solo, y todo pendiente nace confirmable

**Cerrado:** 2026-07-29
**Portones:** G1 ✓ · G2 no aplica (el corte no declara criterios de `G2`) · G3 ninguno propio
**Matriz regenerada:** 2026-07-29, con `npm run matriz:generar`, posterior
al commit `b2ce397` (`AC-TRAZ-12`).

### Qué se entregó

`RUL-PEND-01` cierra su parte `TEST`: la migración `053` agrega
`confirmable`/`confirm_command` a `pending_items` con un `check` que la
propia base impone (`AC-PEND-01`), y `computeConfirmability`
(`src/core/pending/compute-confirmability.ts`) recalcula ambos campos —
nunca en el cliente — al crear un pendiente desde email y en cada `PATCH`
de edición, replicando en modo simulación (sin ejecutar nada) la validación
real de cada comando especializado (`record_generic_movement`,
`record_transfer`, `record_recurring_payment`, `record_debt_payment`).
`POST /pending/[id]/confirm` ahora rechaza con `422` antes de intentar
ejecutar si el pendiente no es confirmable (`AC-PEND-02`/`15`), y comunica
por texto qué falta. `already_registered` entra al enum `pending_status`
como una resolución distinta de `discarded` (`RUL-PEND-05`/`AC-PEND-06`),
con endpoints nuevos para marcarla y para aportar contexto libre
(`POST /pending/[id]/already-registered`, `.../context`). El lote de
confirmación (`AC-PEND-08`, diferido desde `W-09` por `WEB-D199`) ahora
admite hasta 50 ids, excluye automáticamente riesgo alto y estados no
confirmables con su razón, soporta un modo `preview` sin ejecutar nada, y
etiqueta cada confirmación con un `batch_id` para deshacerla dentro de las
24 horas (`POST /pending/batch/[batch_id]/undo`, deshace movimientos
genéricos, no efectos especializados de deuda/recurrencia — real pero no
completo, ver "qué sorprendió"). Un trabajo interno
(`/api/internal/jobs/pending-expiry`) caduca pendientes a los 60 días sin
crear nada, dejándolos consultables (`AC-PEND-11`).

En `28`, la migración `054` agrega gestión de remitentes: editar el
remitente de una fuente vuelve a `status='shadow'` y ahora registra
`origin='usuario'` (`AC-EMAIL-04`); una tabla nueva `sender_suggestions`
acumula ocurrencias de remitentes no vigilados que "parecen financieros"
solo por metadatos de remitente/asunto, nunca por cuerpo
(`looksFinancialByMetadata`, `AC-EMAIL-05`), con un límite de una
sugerencia nueva por semana por buzón y silencio indefinido si el usuario
lo pide (`AC-EMAIL-06`). En `29`, la migración `055` crea
`movement_templates` (única tabla de este corte con RLS de escritura
directa para `authenticated`, sin service-role — `AC-CAP-15`) y un parser
por reglas (`src/core/capture/quick-add-parser.ts`) que resuelve
`taxi 15`, montos con `s/`, fechas relativas en `America/Lima` y
proveniencia por campo (`"dicho"`/`"supuesto"`) sin ningún modelo
(`AC-CAP-02`/`04`/`12`); `POST /capture/parse` expone ese parser sin
escribir nada.

`tsc`, `eslint`, `npm run build` (con los gates de `prebuild` en verde) y
`npm test` (252 ficheros, 1.459 pruebas) terminan sin errores, salvo el
caso descrito abajo. `npm run test:rls` (69 pruebas, 6 ficheros) también en
verde.

### Qué sorprendió

Cinco cosas.

La primera y más seria: `email-ingestion.ts::buildPendingPayload` fijaba
`normalized_summary.category_id: null` siempre, y el camino de confirmación
genérico ya exigía `category_id` para confirmar — es decir, **todo
pendiente detectado por correo era silenciosamente inconfirmable**, sin
ninguna señal que lo dijera, reproduciendo exactamente la tesis del propio
módulo `27` sobre pendientes que el sistema no puede confirmar. Esto no era
un caso borde: era el estado normal de todo pendiente de email antes de
este corte, y es la razón real por la que el contrato de confirmabilidad
pasó de "criterio documentado" a la prioridad central del corte.

La segunda: al escribir la prueba de cierre de `AC-PEND-01` (que no existía
hasta ahora, ver más abajo), el `check` de la migración `053` resultó
proteger solo `status='pending'`, no los otros dos estados "activos" que
`pending.repository.ts` reconoce (`sent_for_confirmation`, `user_edited`)
— un pendiente editado por `PATCH` podía en teoría quedar marcado
confirmable sin `confirm_command` sin que la base lo impidiera. Se
corrigió el `check` para cubrir los tres estados y se confirmó con
`RUL-HECHO-02` (revertido, la prueba nueva falló exactamente en esos dos
casos, restaurado). Ninguno de los caminos de escritura actuales llega a
producir el caso que el `check` original dejaba pasar, pero la garantía
"impuesta por la base de datos" que `27` promete no era literalmente
cierta hasta corregirlo.

La tercera: al escribir las anotaciones de cierre de este documento se
encontró que `src/app/api/v1/pending/[id]/discard/route.ts` —una ruta
preexistente de un corte anterior, no tocada en `W-10`— nunca había tenido
un fichero de prueba. Se le agregó el mismo paquete de cinco casos de
`51§6.2` que exige cada endpoint, cerrando la mitad que le faltaba a
`AC-PEND-06`.

La cuarta: fuera del alcance formal de este corte, verificar en navegador
con la sesión real del usuario (tras que iniciara sesión) reveló que las
migraciones `042` a `052` —de `W-05` a `W-09`, no solo las de este
corte— nunca se habían aplicado al proyecto de Supabase de verdad, solo en
local; `GET /subcategories` devolvía `500` en producción. El usuario
ejecutó `supabase db push` (bloqueado para mí por el clasificador de modo
automático incluso con autorización explícita en el chat, respetado sin
intentar rodearlo) y quedó confirmado con `supabase migration list` y con
verificación visual real de Mi Dinero, Categorías y el propio endpoint de
subcategorías.

La quinta, y la razón de `WEB-D203`: al auditar el riesgo de no construir
interfaz nueva este corte, se encontró que la pantalla condenada
`src/features/pending/pending-screen.tsx` (`WEB-D164`) ya calcula su
propio `needsCompletion` en el cliente con una heurística que coincide en
la práctica con lo que `computeConfirmability` ahora impone en el
servidor — el riesgo de que la interfaz muestre "Confirmar" sobre un
pendiente que el servidor rechazaría con `422` es bajo, no inexistente, lo
que hizo defendible diferir la interfaz nueva completa a un corte de
pulido en vez de construirla apurada en las horas finales de un corte ya
extenso.

### Qué quedó abierto

`WEB-D203` (nueva) difiere completa la capa de interfaz de este corte:
`SCR-CAP-01`/`02` (barra de registro rápido, plantillas), la gestión
editable de remitentes de `SCR-EMAIL-01`, y las acciones nuevas de
`SCR-PEND-01`/`02`. Esto deja sin cerrar, por ausencia de interfaz, la
mitad `USER` de la mayoría de criterios nuevos y la totalidad de
`AC-CAP-01`, `03`, `05`, `06`, `08`, `09`, `10`, `11`, `13`, `14` (los tres
últimos, más `08`/`09`/`10`, exigen además que `capture/parse` deje de ser
de solo lectura y llegue a `POST /api/v1/movements`, lo que tampoco se
construyó). `AC-PEND-04` (búsqueda) y `AC-PEND-10`/`AC-EMAIL-16` (memoria)
quedan diferidos por `WEB-D202` a los módulos `38`/`36`, sin corte
asignado el primero y a `W-13` el segundo. `AC-PEND-09` (agrupación por
origen/similitud) y `AC-PEND-16` (suma de pendientes) no tienen ninguna
lógica construida, ni arriesgada ni segura. `AC-PEND-14` no cierra —es
falso tal como está construido hoy: casi todo el módulo sigue en
`EXCEPCIONES_TEMPORALES`, diferido a `AC-SEG-07` igual que `AC-MOV-18` en
`W-09`. `AC-EMAIL-10`/`11`/`13` (backfill opcional/cancelable, agrupación
por mes, aviso a los 21 días de silencio) no tienen ningún consumidor real
del lado que falta, aunque parte de su plomería ya existe
(`processGmailBackfill`, `touchUserEmailSourceLastMatched`). `AC-EMAIL-06`
tiene la lógica de límite semanal y silencio construida pero sin ningún
caso de prueba que ejercite la supresión real (solo se mockea el caso
permisivo) — queda como trabajo de prueba pendiente, no de código.
`AC-EMAIL-17`/`18` (higiene de PII en logs, resistencia a inyección) y
`AC-PEND-03`/`12` quedan abiertos desde antes de `W-10`, sin cambios este
corte.

### Documentos corregidos

- `27` §20: `Clase:` añadida a `AC-PEND-01`, `02`, `05`, `06`, `08`, `11`,
  `15` (parte `TEST`); nota de por qué no cierran `03`, `04`, `07`, `09`,
  `10`, `12`, `13`, `14`, `16`.
- `28` §20: `Clase:` añadida a `AC-EMAIL-01`, `02`, `04`, `05` (parte
  `TEST`), `07`, `08`, `09`, `12`, `15`; nota de por qué no cierran `03`,
  `06`, `10`, `11`, `13`, `14`, `16`, `17`, `18`.
- `29` §20: `Clase:` añadida a `AC-CAP-02`, `04` (parte `TEST`), `12`,
  `15`; nota de por qué no cierran `01`, `03`, `05` a `11`, `13`, `14`.
- `50` §3.1: censo de clases actualizado (191 con clase, no 171; `lint` 30,
  no 29; `integracion` 34, no 21; `unidad` 56, no 50).
- `tests/lint/seg-04-404-no-403.test.ts`: conteo de rutas actualizado a 71
  (once nuevas de `W-10`).
- `tests/lint/service-role-en-rutas.test.ts`: excepciones temporales
  actualizadas a 54 (siete nuevas sobre `pending`/`email`; `templates` y
  `capture/parse` no entran, `AC-CAP-15`).
- `src/shared/types/domain.ts`/`.test.ts`: estado `already_registered`
  agregado a `PENDING_STATUSES`.
- `README.md`: `core/capture/` documentado en el árbol real.
- `supabase/migrations/053_pending_confirmable_contract.sql`: el `check`
  de `AC-PEND-01` corregido para cubrir los tres estados activos, no solo
  `pending` (ver "qué sorprendió").
- `tests/rls/pending-confirmable-constraint.test.ts` (nuevo): siete
  pruebas del `check` de la migración `053`.
- `src/app/api/v1/pending/[id]/discard/route.test.ts` (nuevo): los cinco
  casos de `51§6.2` que le faltaban a una ruta preexistente.
- `03_decisiones_producto_web.md`: `WEB-D202` (alcance de `27`/`28`/`29`),
  `WEB-D203` (diferir la capa de interfaz) (nuevas).

---

## W-11 — Pagos que vienen y Deudas sin doble registro

**Cerrado:** 2026-07-29
**Portones:** G1 ✓ · G2 no aplica (el corte no declara criterios de `G2`) · G3 ninguno propio
**Matriz regenerada:** 2026-07-29, con `npm run matriz:generar`; hash del
commit sustantivo: `c92a7b9` (hash real registrado en el commit de seguimiento
de este cierre).

### Qué se entregó

El módulo `30` quedó conectado a un motor de ocurrencias que materializa el
horizonte desde un job diario idempotente, sin generar filas al crear o editar
una regla. `GET /api/v1/upcoming` combina recurrentes y cuotas de deuda con
un horizonte civil fijo de 30 días, conserva vencidos fuera de ese horizonte,
deduplica una cuota ligada a una regla y consume una caja virtual una sola vez
por fecha. Las reglas variables no inventan una estimación: solo descuentan si
el monto esperado fue aceptado explícitamente. `mark-paid`, pausa/reanudación,
omisión, candidatos y reversión pasan por Core especializado; la misma llave
de idempotencia con una petición distinta devuelve conflicto.

El módulo `31` recibió creación atómica de deuda, preview y registro
oldest-first, lifecycle atómico de cuotas (cerrar, condonar, reabrir,
reprogramar y omitir), historial de pagos sin recorte silencioso, y reversión
especializada de `pago_deuda` con auditoría/outbox. La reversión de una deuda
condonada exige reabrirla antes. Las pantallas condenadas de Recurrentes,
Pagos que vienen y Deudas fueron reemplazadas enteras según `WEB-D164`; el
detalle de deuda separa `Debes`/`Me deben`, estados de cuota y pagos
revertidos.

La capa de dinero ahora conserva PEN como base y muestra USD en una capa
paralela, sin conversión implícita (`WEB-D212`). La base impone la
idempotencia y unicidad normalizada de reglas, los checks de creación y el
acceso service-only del worker. `tests/rls/` cerró seis archivos y 18 pruebas
específicas del corte y la suite RLS completa cerró 12 archivos y 87 pruebas
contra el Supabase local; cada endpoint de usuario nuevo o modificado tiene
los cinco casos de `51` §6.2 en su fichero de ruta (las acciones `pause`/`resume`
comparten un fichero explícito de cinco casos por acción). Los jobs internos
no tienen sesión ni recurso de otro usuario por diseño y conservan sus
pruebas de autenticación de cron/idempotencia específicas.
`npx tsc --noEmit`, `npx eslint .` y `npm run build` pasan. `npm test` termina
con 271/272 archivos y 1.656/1.657 pruebas por el timeout frío intermitente de
`src/app/api/v1/movements/route.test.ts` (`AC-API-04`), conocido desde `W-09`;
el archivo aislado pasa con `--testTimeout=20000`.

### Qué sorprendió

La primera prueba de contrato encontró que el `CHECK` de creación de
Recurrentes aceptaba una llave sin hash (Postgres trata una expresión con
`NULL` como desconocida). Se revirtió la implementación, la prueba RLS falló
en el caso incompleto y se restauró (`RUL-HECHO-02`); el check quedó escrito
con las dos ramas explícitas y la prueba negativa.

La segunda: la rama idempotente de `pago_recurrente` comparaba solo la llave y
el estado mutable de la ocurrencia. Un retry con el mismo evento podía
rechazar una ocurrencia ya pagada, y la misma llave con otro monto podía
reutilizar el resultado. La prueba de monto distinto falló antes del cambio;
ahora se compara la huella completa de la petición.

La tercera: el worker diario cortaba silenciosamente a 50 usuarios. El
reconocimiento de la ruta y su prueba HECHO-02 demostraron que un usuario
posterior no recibía ocurrencias; el RPC service-only enumera todos por
defecto y solo acepta `max_users` como límite operativo explícito.

La cuarta: revertir un pago después de condonar la deuda reconstruía un saldo
inventado. La prueba negativa, primero contra la implementación sin guarda,
falló como debía; la transacción ahora exige `reopen` y no toca ninguna fila
si la deuda está `cancelled`.

La quinta: había límites `.limit(40)`/`.limit(80)` sin cursor consumidor en
cuotas e historial de pagos. Quitarlos evita ocultar filas antiguas; `WEB-D217`
deja la paginación real pendiente de un contrato de cursor. La revisión de
monedas también encontró que las cinco cifras de dinero sumaban PEN y USD como
si fueran una unidad; `WEB-D212` las separa.

### Qué quedó abierto

`AC-REC-04` tiene camino feliz de ruta/Core, pero todavía no una prueba RLS
completa de creación desde una ocurrencia esperada; `AC-REC-14` carece de la
integración dedicada de correo. `AC-DEUDAS-07` sigue bloqueado por
`WEB-D208`: no existe un único commit compuesto para caja + deuda, ni UI de
vinculación/selección automática. `AC-DEUDAS-10`, `11`, `12`, `17` no tienen
aún las pruebas negativas/globales que exige su redacción. `AC-DEUDAS-14`
queda abierto por separado: falta una prueba que combine una tarjeta como
deuda con las capas de `/money`; no se confunde ese vacío con el bloqueo
transaccional de `WEB-D208`.

Las mitades `USER` de `AC-REC-06`, `08`, `10` y de `AC-DEUDAS-03`, `05`,
`06`, `16` no cierran porque no hubo sesión real de navegador. `AC-REC-08`
conserva la prueba de umbral, pero la validación visual queda abierta.
`WEB-D205` mantiene fuera de V1 el cálculo monetario de intereses y
renegociación. `WEB-D217` deja pendiente el cursor de historial; también
quedan sin consumidor URL/cursor de detalle, historial de movimientos de una
ocurrencia y cualquier integración de correo que escriba automáticamente.
No se hizo validación contra staging ni push de migraciones: el clasificador
de modo automático bloquea esa operación y no se intentó rodearlo.

### Documentos corregidos

- `30` §20 y `31` §20: anotaciones `Evidencia`/`Clase` verificadas contra
  tests reales, con cada criterio abierto explicado; se incorporó `WEB-D217`
  en `31` §17.
- `03_decisiones_producto_web.md`: `WEB-D204` a `WEB-D217` (enums,
  horizonte/detección, caja compuesta, reversión, privacidad, lifecycle,
  monedas, unicidad, idempotencia, worker e historial).
- `50_matriz_de_trazabilidad_web.md`: regeneración y conteos reales
  (`217` con clase; `43` integración; `73` unidad; `415` con `TEST` sin
  clase).
- `tests/corpus/matriz.test.ts` y
  `scripts/matriz/matriz.generada.json`: expectativas y censo regenerados.
- `scripts/gates/service-role-lista.ts`, `tests/lint/service-role-en-rutas.test.ts`
  y `tests/lint/seg-04-404-no-403.test.ts`: ocho rutas de lifecycle y doce
  superficies nuevas de W-11 declaradas y auditadas.
- `tests/rls/lib/fixtures.ts`: la semilla de reglas variables actualizada al
  contrato de monto de la migración `058`; `adjust-balance-dialog.tsx` quedó
  bajo el límite de tamaño sin justificar una excepción.
- Migraciones `056` a `060`, repositorios, rutas, Core y pantallas de los
  dos módulos; seis pruebas RLS nuevas para los contratos de base.

## W-12 — Presupuestos, Metas y Proyecciones sin asesoría ni dinero ficticio

**Cerrado:** 2026-07-30
**Portones:** G1 ✓ · G2 no aplica (el corte no declara criterios de `G2`) · G3 ninguno propio
**Matriz regenerada:** 2026-07-30, con `npm run matriz:generar`; hash del
commit sustantivo: `a8c11c3` (hash real registrado en el commit de
seguimiento de este cierre).

### Qué se entregó

La migración `061_w12_budgets_goals.sql` incorpora presupuestos, metas,
snapshots de avance, decisiones de sugerencias y recibos de idempotencia con
RLS, constraints PEN y RPCs atómicos. El Budget Engine calcula los once tipos
de movimiento sin tocar saldos, conserva referencias, implementa los cuatro
tramos, los umbrales 70/90/100 una sola vez, renovación, traspaso sin
propagación indefinida, metas vinculadas a cajas objetivo y sugerencias por
mediana de hasta seis periodos completos. El job diario service-only produce
snapshots, lifecycle y eventos de umbral; `vercel.json` lo programa a las
13:12 UTC (08:12 Lima).

Las APIs publican presupuestos, resumen, copia del periodo anterior,
sugerencias y sus decisiones; metas y sus transiciones/vínculo; proyección de
periodo, desglose, situación del mes y simulación de solo lectura. Son 27
endpoints reales sometidos a los cinco casos de `51` §6.2: 135/135 pruebas
contra Supabase local, mockeando únicamente la sesión. Las colecciones y
cálculos prueban aislamiento con 200 y datos exclusivamente propios
(`WEB-D230`); las rutas con ID devuelven 404 para recursos ajenos. La
exportación de privacidad también incluye presupuestos, metas, snapshots y
decisiones y tiene sus cinco casos reales propios.

Projection Engine queda como único dueño de la cifra: usa PEN, dinero libre
que ya descuenta compromisos, mediana de hasta 14 días civiles Lima incluidos
los ceros, IQR lineal para decidir rango, cero ingresos futuros inventados y
un reloj explícito. El candidato legado de Insights dejó de publicar una
segunda fórmula y la respuesta conversacional existente dejó de emitir un
veredicto financiero. Simular devuelve efecto inmediato, lo ya contado y
cierre proyectado sin crear movimiento, tocar cuenta, caja, presupuesto ni
outbox.

Las superficies nuevas de Presupuestos/Metas y Proyecciones sustituyen el
placeholder por flujos reales. Incluyen selector semanal/quincenal/mensual
sincronizado con URL, creación, ajuste `PATCH`, copia confirmada del periodo
anterior, sugerencias, detalle, metas sin barra ficticia, vínculo a caja,
supuestos, aritmética con referencias conocidas, situación y simulador. Tras
la revisión, las pantallas monolíticas se dividieron: los orquestadores
principales quedaron en 281, 191 y 78 líneas. Los componentes compactos de
presupuesto/proyección se entregan para Home, pero no se presentan como
montados (`WEB-D223`).

La suite RLS completa termina con 15 archivos y 238/238 pruebas. `npx tsc
--noEmit`, `npx eslint .` y `npm run build` pasan; el build de Next 16.2.7
compila y genera 40 páginas. `npm test` termina con 304/305 archivos y
1.896/1.897 pruebas por el timeout frío conocido de
`src/app/api/v1/movements/route.test.ts > AC-API-04`; aislado con
`--testTimeout=20000` pasa 6/6. El lint SQL no reporta regresiones W-12 y
conserva dos warnings anteriores: volatilidad de `next_recurring_date` y la
variable no leída `v_debt_id`.

### Qué sorprendió

El diseño reservaba migraciones `048`/`050`, pero ambas ya existían en la
rama ejecutable. `WEB-D218` asignó `061` sin reescribir historia. El corpus
también dejaba sin cerrar moneda/estados de avance, fórmula de rollover,
mediana par, sincronización meta-caja, cuartiles, saldo cero conocido,
ingresos futuros, situación mensual, ownership entre cortes y aislamiento de
colecciones; `WEB-D219` a `WEB-D230` resolvieron esos vacíos antes de elegir
comportamiento.

La prueba real de sobresfuerzo encontró que `numeric(5,4)` no soportaba un
avance de 1.500 %: Postgres abortaba el lifecycle con `numeric field
overflow`. La implementación se revirtió a esa precisión, la prueba falló y
se restauró `numeric` sin tope arbitrario con `pct >= 0` (`WEB-D229`,
`RUL-HECHO-02`). Otra prueba descubrió que la validación
`Number.isInteger(value * 100)` rechazaba montos válidos como S/0.29 y
S/654.32 por representación IEEE-754; ahora todos los esquemas reutilizan el
validador monetario por tolerancia y el caso real conserva S/654.32.

Los repositorios devolvían códigos SQL específicos —categoría inexistente,
duplicado, estado inválido— que las rutas convertían en 500. Las pruebas
negativas hicieron visible el error; el mapper ahora responde 404, 409 o 400
según contrato. Los tests de acciones también tenían URLs falsas
(`/accept`, `/link-box` omitidos): no era un bug de producto, sí evidencia de
que una prueba podía pasar sin invocar la ruta que nombraba; se corrigieron.

Privacidad exportaba el corpus anterior pero omitía las cuatro familias de
datos nuevas y aceptaba query params desconocidos con 200. La prueba se
escribió primero, falló 200→400 y luego quedó 5/5. Al correr toda RLS, ese
test falló otra vez porque medía conteos globales mientras otras suites
limpiaban filas concurrentemente; se corrigió para observar solo sus IDs. No
se maquilló ninguno de los dos fallos como “flaky”.

La auditoría de aceptación detectó cuatro comportamientos existentes sin
aserción —rollover apagado por defecto, meta sin caja sin barra, rango visible
y motivo visible con historia insuficiente— y una huella de simulación que
contaba movimientos pero no saldos. Las cuatro pruebas fallaron 4/4 con
mutaciones deliberadas y volvieron 16/16 al restaurar. Después, insertar una
cuenta desde la simulación hizo fallar la idempotencia real; restaurada la
implementación, el contrato volvió 5/5. También se mutaron constraints,
efectos de saldo, bloqueo de límite duro, doble descuento, fecha, invalidación,
privacidad, método `PATCH` y trigger del worker en sus pruebas respectivas:
cada mutación produjo rojo antes de aceptar la evidencia (`RUL-HECHO-02`).

La matriz expuso una contradicción histórica: cinco rótulos usan sufijo
minúsculo (`05b`–`05e`, `02b`), pero el registro solo reconoce el ID base.
`WEB-D231` los conserva como subcriterios anotados y evita inflar el censo de
708; por eso W-12 agrega 31 filas con clase, no 36. Finalmente, el corpus no
definía catch-up tras una pausa/caída ni un contrato consumible para
“Registrar gasto” desde la simulación. `WEB-D232` deja el lifecycle en un
periodo por invocación hasta `idempotent=true`; `WEB-D233` mueve la precarga
compartida a W-13 en vez de publicar parámetros inertes.

### Qué quedó abierto

No hubo sesión real `USER`. En `32` siguen abiertas esas mitades de
`AC-PRES-05c`, `06`, `07`, `08`, `11`, `12` y `13`; en `33`, las de
`AC-PROY-01`, `05`, `06`, `12` y `17`. `AC-PRES-05` solo entrega el productor
de umbral: la notificación visible pertenece a W-14. `AC-PRES-14` tiene
componente de máximo tres, pero Home no lo consume hasta W-15. La consulta
conversacional completa de “¿puedo permitirme?” queda en W-16/W-17.

`AC-PROY-12` no cierra completo aunque su tabla sí existe: `free_money` y
`free_in_accounts` no traen referencias, y los compromisos enlazan al módulo
Pagos que vienen, no a una ocurrencia exacta. `ACT-PROY-04` no aparece:
Movimientos no consume aún un prefill seguro de monto/categoría/fecha y
`WEB-D233` lo asigna al contrato compartido de W-13. El selector de caja para
metas recibe de `/api/v1/boxes` tipo e identidad, pero no moneda ni si ya
respalda otra meta; filtra `objetivo` y deja que el Core valide PEN y
exclusividad, por lo que puede mostrar una opción que después sea rechazada.

La recuperación de varios periodos vencidos requiere repetir el job con el
mismo `as_of` hasta `idempotent=true`; el endpoint no hace ese bucle
automáticamente. Un presupuesto pausado tampoco cierra ni renueva hasta
reanudarlo (`WEB-D232`). No se ejecutó un E2E real:
`tests/e2e/recorridos/07-crear-presupuesto.spec.ts` continúa en `test.fixme`.
Tampoco hubo staging, despliegue ni push de migraciones. Las dos advertencias
SQL anteriores siguen abiertas y no se atribuyen a este corte.

### Documentos corregidos

- `32` §20 y `33` §20: las 39 obligaciones quedaron anotadas contra código y
  pruebas reales; cierres parciales y `USER` ausente se declaran uno por uno.
- `03_decisiones_producto_web.md`: `WEB-D218` a `WEB-D233` (migración,
  moneda/estados, rollover, sugerencias, metas/cajas, ownership, estadística,
  horizonte/ingresos, motor canónico, situación, saldo cero, porcentaje,
  aislamiento, sufijos, lifecycle y precarga).
- `13_modelo_datos_web_v1.md`, `14_contratos_api_web.md` y
  `17_patrones_datos_formularios_y_listados.md`: esquema ejecutable `061`,
  contratos W-12 e invalidaciones reales.
- `50_matriz_de_trazabilidad_web.md`, `tests/corpus/matriz.test.ts` y
  `scripts/matriz/matriz.generada.json`: 248 criterios con clase (`52`
  integración, `89` unidad, `36` lint) y 384 con `TEST` sin clase.
- `54_plan_de_implementacion_web.md`: el prefill compartido de Movimientos
  queda explícitamente bajo W-13 por `WEB-D233`.
- `README.md`, tipos Supabase, lista service-role, gate 404 y cron: árbol,
  tablas, rutas internas y superficies nuevas declaradas.
- Migración `061`, Core, repositorios, 27 contratos de API, privacidad,
  invalidación, worker/outbox y pantallas modulares de ambos documentos.

## W-13 — Descubrimientos útiles y Memoria gobernable

**Cerrado:** 2026-08-01
**Portones:** G1 ✓ · G2 ✓ contra Supabase local · G3 no cierra: no hubo
sesiones `USER` ni una cohorte para `METRIC`
**Matriz regenerada:** 2026-08-01, con `npm run matriz:generar`; hash del
commit sustantivo: `PENDIENTE` (hash real registrado en el commit de seguimiento de este cierre).

### Qué se entregó

Descubrimientos dejó de ser un placeholder. El Insight Engine genera y
prioriza hallazgos deterministas, con umbrales numéricos, fingerprint,
evidencia, vigencia, feedback idempotente, descarte, acción, silencio por tipo
y resumen de máximo dos elementos para Home. El worker interno evalúa fuera
de las peticiones de usuario y registra inicio, éxito o fallo en
`worker_job_runs`, con alerta y log estructurado cuando falla. Las rutas de
lista, detalle, evidencia, visto, feedback, acción, descarte, resumen y
preferencias de tipo aplican sesión, aislamiento 404 o colección filtrada,
validación e idempotencia según `WEB-D230`.

Memoria publica las tres clases: reglas clasificatorias, hechos de perfil y
preferencias observadas. La migración `062_w13_insights_memory.sql` incorpora
las siete familias canónicas, RLS, cascadas, recibos y RPCs transaccionales
para ver, corregir, olvidar, reactivar y deshacer. Corregir encadena versiones;
olvidar crea lápida; deshacer respeta 30 días; el GET de detalle sigue siendo
puro y `POST /memory/[id]/view` registra el evento idempotente (`WEB-D244`).
La exportación de privacidad incluye clases, candidatos, lápidas y auditoría.

Las superficies `src/features/insights/**` y `src/features/memory/**` fueron
reemplazadas completas conforme a `WEB-D164`. También cerraron carryovers:
clasificación masiva con preview/exclusiones/undo, explicación por movimiento,
merge de subcategorías con preview y undo, y el prefill compartido de
Movimientos para Descubrimientos y Proyecciones. Una fecha futura se conserva
visible pero bloquea guardar; una categoría global no inventa subcategoría.

La matriz conserva 708 criterios y ahora tiene 295 con clase: 76 de
integración, 109 de unidad y 39 de lint; 337 declaran `TEST` y aún no tienen
clase. W-13 agrega 47 verificaciones clasificadas. RLS termina 16 archivos y
262/262 pruebas. `npx tsc --noEmit` y `npx eslint .` pasan. Resultado de
`npm test`: 319/320 archivos y 2.058/2.059 pruebas por el único timeout frío
conocido de `src/app/api/v1/movements/route.test.ts > AC-API-04`; el archivo
aislado con `--testTimeout=20000` pasa 6/6. `npm run build` pasa sus cinco
gates, compila Next.js 16.2.7 y genera 42 páginas.

### Qué sorprendió

La primera reconstrucción real del esquema encontró tres bugs: el upsert de
lifecycle no incluía el predicado del índice parcial, una corrección de
memoria financiera podía colisionar con su clave canónica y el undo dependía
del reloj implícito. El reset también mostró que Kong podía responder con
conexión vacía justo después de reiniciar; reiniciar únicamente
`supabase_kong_manzana` restauró el gateway y la suite completa quedó verde.

El corpus reservaba `060` y `061` para W-13 aunque ya pertenecían a W-11 y
W-12. `WEB-D234` asignó `062`. A la vez, Memoria decía “seis tablas” mientras
enumeraba siete y atribuía perfil a `054`, que realmente es correo;
`WEB-D235` fijó siete familias y preservó las tablas heredadas. Esto dejó una
segunda colisión documental: W-14 todavía reserva `062/063`. `WEB-D245`
obliga a elegir los siguientes números libres al abrir ese corte, sin
renumerar historia.

La suite completa encontró tres desajustes de inventario que las suites
focales no veían: README omitía `core/memory` y `shared/movements`, el gate
404 aún esperaba 104 rutas en vez de 120 y cuatro excepciones service-role ya
eran obsoletas. Se corrigieron y la lista temporal bajó honestamente de 62 a
58; los cuatro archivos afectados pasan 144/144.

`RUL-HECHO-02` volvió a encontrar defectos y a demostrar cobertura: al mutar
el merge real, `47 + 89` produjo `137` y la prueba exigió `136`; degradar el
estado observable del worker, reactivar al “ver”, cambiar el umbral de cuatro
comercios, filtrar score público, alterar la precarga o filtrar confianza de
clasificación/memoria produjo rojo antes de restaurar. También se revirtieron
y restauraron constraints/RPCs mediante `npx supabase db reset --debug`.

### Qué quedó abierto

No se ejecutaron sesiones `USER`, staging, despliegue ni push. En
Descubrimientos siguen abiertos los resolvers no basados en movimientos, la
revisión exhaustiva de copy, el recorrido integral movimiento→worker→vigencia,
una regresión aislada de fingerprint, las dos obligaciones `USER`, la prueba
estructural de tools del asistente y `AC-DESC-20`, que necesita una cohorte
real para medir mediana menor de un día.

Memoria no cierra la equivalencia exacta entre corregir clasificación desde
su pantalla y hacerlo desde Movimientos: hoy la corrección desde Memoria es
texto libre. Tampoco están resueltas todas las referencias de perfil y
preferencia, la contradicción automática de perfil a `en_duda`, un caso real
antes/después sobre movimientos pasados, el doble camino de evidencia al
editar un pendiente antes de confirmarlo ni la prueba estructural de
“olvidar todo” desde el motor. Esos criterios quedaron anotados como abiertos,
no presentados como terminados.

La corrección temporal de `tests/rls/w12-budgets-goals.test.ts` de julio a
agosto fue necesaria porque el reloj Lima avanzó durante W-13; no cambia el
producto W-12. Las advertencias SQL heredadas y el timeout frío conocido de
Movimientos tampoco se atribuyen silenciosamente a este corte.

### Documentos corregidos

- `34` y `36` §20: cada criterio quedó contrastado con código/prueba y marcado
  con clase o razón concreta de no cierre.
- `25` `AC-CAT-08` a `12` y `33` `SCR-PROY-03`/`ACT-PROY-04`: carryovers
  verificados contra las operaciones y el prefill realmente entregados.
- `03_decisiones_producto_web.md`: `WEB-D234` a `WEB-D245`, incluidas las
  contradicciones de migración, censo, evidencia, prefill, transacciones y
  vista idempotente.
- `50`, `tests/corpus/matriz.test.ts` y `scripts/matriz/matriz.generada.json`:
  censo regenerado, 295 clases asignadas y cero formas inválidas.
- `55`: esta entrada y la tabla de estado actual; código, migración `062`,
  tipos Supabase, RLS y superficies se citan desde la evidencia de §20.

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
