# 55 — Ledger de construcción de la app web

**Bloque:** 07 — Calidad y ejecución
**Alcance:** V1
**Estado:** vivo
**Fecha de última actualización:** 28 de julio de 2026
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

**La construcción avanza.** `W-01` a `W-08` cerraron `G1` y `G2`. Ninguno
tiene criterios de `G3` propios.

| | |
|---|---|
| Cortes cerrados | 8 de 20 |
| Criterios `verificado` | 79 de 708 |
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
