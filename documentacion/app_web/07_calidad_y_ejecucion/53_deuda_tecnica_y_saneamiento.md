# 53 — Deuda técnica y saneamiento

**Bloque:** 07 — Calidad y ejecución
**Alcance:** V1
**Fecha:** 26 de julio de 2026
**Docs fuente:** `51_estrategia_de_pruebas_web.md` §3, `52_inventario_reutilizacion_codigo_src.md`, medición del árbol del 26 de julio de 2026
**Documentos que dependen de este:** `54` (plan de implementación)

---

## 1. La distinción que hace útil este documento

Un catálogo de deuda técnica que enumera todo lo mejorable es un documento que
nadie usa. Este solo contiene lo que **sobrevive a la reconstrucción**.

La mayor parte de lo que un análisis convencional llamaría deuda de este
proyecto —pantallas de 2.360 líneas, 17 modales a mano, controles sin
manejador, cero paginación, `useEffect` reimplementado en cada pantalla— vive
en `src/features/`, y el `52` §5 ya dictaminó REEMPLAZAR sobre esas 18.142
líneas. Listarlo aquí como deuda a pagar sería **contar el mismo trabajo dos
veces** y, peor, invitaría a arreglar componentes que van a desaparecer.

`WEB-D164` — **No se salda deuda en código condenado.** Si el `52` dictaminó
REEMPLAZAR o DESCARTAR sobre un fichero, su deuda no se arregla: se documenta
como caso borde en el §19 de su módulo (`RUL-INV-01`) y desaparece con él.

Lo que queda son tres categorías, y las tres son cortas.

| Categoría | Cuántas | Qué las define |
|---|---|---|
| **Bloqueante** | 5 — **una resuelta** | Impiden que un corte del `54` pueda cerrarse. Exigen evidencia de resolución |
| **Con gate asignado** | 7 | No bloquean hoy; tienen un corte concreto donde se pagan |
| **Riesgo aceptado** | 2 | Se conocen, se registran y se convive con ellas hasta una fecha |

---

## 2. Las cinco bloqueantes

Una deuda es bloqueante cuando **algo que el corpus da por cierto no lo es**.
No cuando molesta.

### 2.0 `D-12` — El repositorio no compilaba · **RESUELTA**

| | |
|---|---|
| **Qué** | `npm run build` fallaba. Cuatro errores de tipos: tres códigos de error lanzados en `command-dispatcher.ts` que no estaban en la unión `CoreErrorCode`, y un `Json \| undefined` en `experience-preferences.repository.ts` |
| **Causa** | La implementación de `auditoria_integral_arquitectura_ia_conversacional_2026-07-23.md` **se interrumpió a medias y no se documentó** |
| **Descubierta** | 26 de julio de 2026, al ejecutar `npm run build` por primera vez |
| **Resuelta** | 26 de julio de 2026. `build`, `typecheck`, `lint` y `test` en verde |
| **Corte** | Se adelantó a antes de `W-01` porque bloqueaba cualquier comprobación |

**Los 863 tests pasaban sobre código que no compilaba**, porque Vitest no
comprueba tipos. Es la ilustración más literal posible del argumento del `51`:
una suite verde no dice que el código funcione, dice que las pruebas que
existen pasan.

**No estaba en ninguna lista de deuda porque nadie había ejecutado el
comando** — ni el diagnóstico inicial, que dio por buena la línea base sin
comprobarla. Es la respuesta a `AC-DEUDA-06`: el gate que faltaba era ejecutar
`npm run build`, y ahora es `AC-DEUDA-08`.

**Qué se hizo, y por qué no fue solo hacer que compilara.** Los tres códigos
—`MOVEMENT_NOT_DELETED`, `MOVEMENT_REVERSED_NOT_RESTORABLE` y
`MOVEMENT_REQUIRES_SPECIALIZED_ENGINE`— son implementación **correcta** de
reglas que el corpus exige: `26` pide restauración de eliminados, y `30` y `31`
piden que un movimiento ligado a una deuda o a un recurrente se edite desde su
flujo especializado. Lo que faltaba era declararlos. Así que además de añadirlos
a la unión se clasificaron en el mapeo HTTP de `src/app/api/_lib/http.ts`: los
dos primeros son conflicto de estado (**409**), el tercero es una operación
rechazada con significado de redirección (**422**), que era el valor por
defecto y resultó ser el correcto.

### 2.0.1 El corte interrumpido, y qué queda de él

El código que no compilaba viene de implementar la auditoría del 23 de julio.
Se ejecutó buena parte y **no se registró en ningún sitio**: el ledger `23b`
había dejado de escribirse el 18 de julio (`55` §1).

Rastreado contra el árbol, el 26 de julio:

| Corte de la auditoría | Estado en el código |
|---|---|
| A.1 `local_fixture` prohibido en producción | Implementado (`production_safe`) |
| A.2 `focus_set` con IDs exactos | Implementado, migración `042` |
| **A.5 separar reparar respuesta de corregir dinero** | **No implementado** |
| B.1 `TurnWorkspace` | Implementado |
| B.2 claims con `evidence_refs` | Implementado |
| B.3 `EvidenceAndPolicyCompiler` | Implementado |
| B2 memoria gobernada con estados | Implementado, migración `044` |
| C.1 `ConversationalExecutiveAgent` | Implementado |

**El corpus ya absorbió casi todo esto sin saber que venía de ahí.** El `13`
documentó las migraciones `042` a `046` leyendo el SQL, y el `42` emitió
veredicto sobre `TurnWorkspace`, el compilador de evidencia y el agente
ejecutivo leyendo el código. Que dos documentos escritos a ciegas coincidan
con un plan que nadie les enseñó dice algo bueno del método.

**Lo único de la auditoría que no llegó al código es A.5**, y el corpus lo
recogió por su cuenta: `11` separa *reparar respuesta* de *corregir dinero*
como principio, y `36` lo implementa como memoria gobernable. Se construye en
`W-13`, no como deuda pendiente sino como funcionalidad especificada.

### 2.1 `D-01` — El canal está dentro del núcleo

| | |
|---|---|
| **Qué** | 28 ficheros de producción de `src/core/` mencionan WhatsApp. Seis lo llevan en el nombre. `financial-orchestrator.ts` lo menciona 102 veces |
| **Por qué bloquea** | `WEB-D105` declara que el canal sale del núcleo, y `21` define una prueba de agnosticismo que **hoy no se puede escribir**. Todo el bloque `03_motor_ia/` está construido sobre una premisa que el árbol contradice |
| **Evidencia de resolución** | La prueba de agnosticismo del `21` compila y pasa: el mismo caso ejecutado por dos presentadores produce el mismo espacio de trabajo, los mismos comandos y las mismas referencias de evidencia |
| **Criterios** | `AC-INV-03`, `AC-INV-04` |
| **Corte** | El suyo propio (`WEB-D162`) |

No se cierra contando menciones eliminadas. Se cierra cuando existe un test
que hoy es imposible de escribir.

### 2.2 `D-02` — 48 rutas esquivan RLS sin justificación

| | |
|---|---|
| **Qué** | 48 de las 58 rutas de `/api/v1` importan `createServiceClient`. No hay lista blanca ni prueba que lo impida |
| **Por qué bloquea** | RLS está activa en las 43 tablas y hay 65 políticas, y 48 rutas pasan por encima. La protección que el `15` describe no está en efecto |
| **Evidencia de resolución (parcial, en `W-02`)** | `AC-SEG-01` implementado como test de clase `build`: toda importación de `createServiceClient` fuera de `/api/v1` está en la lista blanca permanente, y las 48 rutas de dentro están declaradas como excepciones temporales justificadas |
| **Evidencia de resolución (completa)** | Además de lo anterior, la lista de excepciones temporales vacía (`AC-SEG-07`) — no ocurre en `W-02`, es agregada y cierra en el corte que migre la última ruta (`WEB-D168`) |
| **Criterios** | `AC-SEG-01` (cierra en `W-02`), `AC-SEG-07` (agregado, sin corte propio), `AC-TRAZ-11` |
| **Corte** | `W-02` para `AC-SEG-01`. `AC-SEG-07` no tiene corte propio |

Las 14 rutas de fuera de `/api/v1` —salud, trabajos internos, webhooks— entran
en la lista blanca por categoría: no tienen sesión de usuario que usar. Esa
distinción es lo que hace el gate cumplible en vez de decorativo.

`D-02` no se cierra por completo en `W-02` (`WEB-D168`): el gate que impide
que una ruta esquive RLS **sin justificación** sí existe desde `W-02`, pero
las 48 rutas siguen ahí, justificadas como pendientes de migración. `R-01`
sigue abierto hasta que la última salga de la lista.

### 2.3 `D-03` — Ninguna prueba verifica el aislamiento entre usuarios

| | |
|---|---|
| **Qué** | 43 tablas con RLS y una sola comprobación de aislamiento: un script de humo que cubre **tres**, exige credenciales reales y no corre en CI |
| **Por qué bloquea** | Es un producto de finanzas personales. Una fuga entre usuarios no es un defecto de calidad, es el final del producto. Y hoy nada la detectaría |
| **Evidencia de resolución** | Una prueba por tabla con datos de usuario, en CI, con los cuatro asertos de `51` §8. El usuario A recibe **cero filas**, no un error |
| **Criterios** | `AC-SEG-02`, `AC-SEG-03`, `AC-PRUEBA-05` |
| **Corte** | El mismo que `D-02` |

`D-02` y `D-03` son la misma deuda vista por sus dos lados: una capa de
seguridad que se esquiva y una comprobación que no existe. Se pagan juntas o
no se paga ninguna.

### 2.4 `D-04` — El motor de prueba puede servir en producción

| | |
|---|---|
| **Qué** | `local_fixture` es un proveedor de modelo activable por variable de entorno, sin gate de arranque |
| **Por qué bloquea** | Un motor de fixture en producción responde con datos inventados sobre el dinero de alguien, y lo hace **sin fallar**. Es el modo de fallo más peligroso que tiene este producto: silencioso y plausible |
| **Evidencia de resolución** | `AC-RT-01` y `AC-REU-06` como gates de arranque, más la alerta de `AC-OBS-03` si algún componente sirve con fixture |
| **Criterios** | `AC-RT-01`, `AC-REU-06`, `AC-OBS-03` |
| **Corte** | El primero que toque el motor |

---

## 3. Las siete con gate asignado

No bloquean. Cada una tiene un corte donde se paga y un criterio que lo
verifica. Ninguna se queda sin dueño.

| ID | Deuda | Medida hoy | Se paga en | Criterio |
|---|---|---|---|---|
| `D-05` | Dos ramas de migraciones | 46 ficheros idénticos en `src/data/migrations/` y `supabase/migrations/` | Saneamiento previo al primer corte | `AC-INV-07` |
| `D-06` | La cobertura nunca se ha medido | `@vitest/coverage-v8` sin instalar; `include` deja fuera `src/features` y `src/app` | Corte de infraestructura de pruebas | `AC-PRUEBA-06` |
| `D-07` | Sin pruebas de navegador | Playwright no instalado; 8 criterios `e2e` sin forma de verificarse | Corte de infraestructura de pruebas | `AC-PRUEBA-09` |
| `D-08` | 38 de 58 rutas sin prueba | 20 tienen test hermano | Con cada módulo, no en bloque | `AC-PRUEBA-04` |
| `D-09` | Sin límite de peticiones ni CSRF | Cero coincidencias en `src/` | Corte de contratos de API | `AC-API-06`, `AC-API-07`, `AC-SEG-08` |
| `D-10` | El `README.md` describe un árbol que no existe | Ocho afirmaciones falsas (§4) | Saneamiento previo | `AC-INV-08` |
| `D-11` | Diez carpetas con solo `.gitkeep` | Seis sin destino, cuatro que el diseño llenará | Saneamiento previo | `AC-INV-08` |

### 3.1 Por qué `D-08` no se paga en bloque

Escribir 38 conjuntos de pruebas de API de golpe, antes de que los módulos
cambien esas rutas, es trabajo que hay que rehacer: el `52` §7.1 dictaminó
ADAPTAR sobre las 58, con cursor, filtros en servidor y sin service-role. La
prueba se escribe **cuando la ruta alcanza su forma final**, no antes.

Es la misma razón por la que la Ola 0 no arregló el service-role: el `14` iba
a redefinir esas rutas de todos modos.

---

## 4. Las ocho afirmaciones falsas del `README.md`

`D-10` no es cosmética. Es la primera cosa que lee quien llega al proyecto.

| Dice | Es |
|---|---|
| `core/commands/` | Vacía |
| `core/engines/` | Vacía |
| `core/validators/` | Vacía |
| `workers/pending/ # TTL y lifecycle de pendientes` | Vacía |
| `workers/recurring/ # Detección y ocurrencias` | Vacía |
| `workers/insights/` | Vacía |
| `workers/email/` | Vacía |
| `adapters/whatsapp/ # (reservado; sin implementación aún)` | **2.639 líneas implementadas** |

La última es la peor: dice que no hay implementación donde hay más código que
en toda `src/shared/`. Alguien que lea el README y decida qué se puede
reutilizar en la fase 2 concluiría lo contrario de la verdad.

---

## 5. Las dos de riesgo aceptado

| ID | Riesgo | Hasta cuándo | Quién decidió |
|---|---|---|---|
| `R-01` | RLS esquivada en 48 rutas, ahora con justificación y gate registrados desde `W-02` | Hasta que `AC-SEG-07` cierre — la última ruta sale de la lista de excepciones (`WEB-D168`). El producto no tiene usuarios reales todavía | `WEB-D006` y la Ola 0, registrado |
| `R-02` | Los ocho ficheros de `42` §8 sin veredicto | Hasta el corte que los toque (`AC-REU-10`) | `42` §8 |

`R-01` es un riesgo aceptado **con condición**: es aceptable porque no hay
usuarios reales. Deja de serlo el día que los haya, y esa es la razón por la
que `W-02` va antes que cualquier módulo en el `54` — no porque migre las 48
rutas, sino porque desde ahí ninguna ruta nueva puede esquivar RLS sin que el
build lo note.

`R-02` es honestidad, no pereza: emitir el veredicto sobre lectura de
superficie sería peor que no emitirlo.

---

## 6. Lo que no es deuda

Tres cosas que el análisis inicial señaló y que, medidas, resultaron no serlo.
Se dejan escritas para que nadie las vuelva a abrir.

**Las dos ramas de migraciones ya no divergen.** El diagnóstico inicial
encontró 45 ficheros contra 46 y un índice distinto en la `026`. Hoy son 46 y
46, byte a byte idénticos, comprobado fichero a fichero. Queda `D-05`, que es
la duplicación misma, no la divergencia.

**Los ficheros temporales ya no están.** `tmp-manzana-dev.log` y
`tmp-manzana-dev.err.log` no existen y el `.gitignore` los cubre en las líneas
32 y 33. `tsconfig.tsbuildinfo` existe en local pero no está versionado.

**Los siete tests saltados no son abandono.** Son cuatro ficheros de humo
contra una API de pago, con un gate por variable de entorno. Lo que sí es
deuda es su **forma**, y la resuelve `WEB-D158` sacándolos de la suite en vez
de saltarlos dentro de ella.

Además, dos cifras del diagnóstico inicial no se confirmaron al medir:
`money-screen.tsx` tiene **36 llamadas a hooks**, no 59, y las nueve pantallas
suman 14.072 líneas, no más de 13.000 como se estimó. La conclusión no cambia
—`settings-screen.tsx` sigue teniendo un solo componente de 1.740 líneas— pero
las cifras que este corpus usa a partir de aquí son las medidas.

---

## 7. Cómo no se acumula deuda nueva

El corpus ya tiene los mecanismos; esta sección los reúne para que el `54` los
coloque como gates y no como buenas intenciones.

| Mecanismo | Qué impide | Dónde |
|---|---|---|
| Seis comprobaciones que fallan el build | Que vuelvan `D-02` y `D-04` | `51` §7 |
| Ocho reglas de lint | Componentes de 2.000 líneas, `?view=`, literales de estilo, canal en el núcleo | `51` §6.4 |
| Un criterio no llega a `verificado` sin clase de prueba | Pruebas escritas sin saber qué verifican | `AC-HECHO-03` |
| Un test en `skip` reabre su criterio | Suites verdes que no prueban nada | `RUL-HECHO-01` |
| Un test debe fallar al revertir su cambio | Pruebas que miden la existencia del fichero | `RUL-HECHO-02` |
| Tests sobre el corpus | Que la documentación se pudra como `docs/` | `WEB-D147` |
| Inventarios generados, no escritos a mano | Que dos listas diverjan por quinta vez | `WEB-D152`, `WEB-D163`, `40` §2 |

**La última fila es la lección del corpus entero.** Cinco veces se ha
encontrado el mismo defecto: catálogo de comandos contra §14 (`C-03`), páginas
legales contra el producto (`C-14`, `C-16`), mapa de rutas contra las §8, dos
ramas de migraciones, y el registro de tokens. Las cinco tienen el mismo
remedio y ninguna se resolvió pidiendo más cuidado.

---

## 8. Criterios de aceptación

- `AC-DEUDA-01` — Las cinco bloqueantes tienen evidencia de resolución
  registrada antes de que ningún corte se declare cerrado. Evidencia: `TEST`.
  Clase: `build`.
- `AC-DEUDA-02` — Toda deuda de §3 tiene corte asignado en el `54`.
  Evidencia: `TEST`. Clase: `corpus`.
- `AC-DEUDA-03` — Ninguna deuda se paga sobre un fichero con veredicto
  REEMPLAZAR o DESCARTAR. Evidencia: `DOC`.
- `AC-DEUDA-04` — El `README.md` describe el árbol real, y un test lo
  verifica. Evidencia: `TEST`. Clase: `lint`.
- `AC-DEUDA-05` — Todo riesgo aceptado tiene condición de caducidad escrita,
  no una fecha vaga. Evidencia: `DOC`.
- `AC-DEUDA-06` — Ninguna deuda nueva entra sin que un mecanismo de §7 la
  hubiera podido detener; si ninguno la habría detenido, se añade el
  mecanismo. Evidencia: `DOC`.
- `AC-DEUDA-07` — La lista de excepciones temporales de service-role está
  vacía antes del lanzamiento. Evidencia: `CODE`.
- `AC-DEUDA-08` — `npm run build` y `npm run typecheck` terminan sin errores.
  Evidencia: `TEST`. Clase: `build`.

`AC-DEUDA-06` es el único que no se puede automatizar y el que más vale. Cada
deuda nueva que aparezca obliga a preguntarse qué gate faltaba, en vez de
apuntarla y seguir.

---

## 9. Fuera de alcance

Este documento no ordena el trabajo —es del `54`— ni reparte veredictos sobre
código —es del `52`— ni define pruebas —es del `51`—.

Tampoco recoge deuda de producto. Que a un módulo le falte una función
declarada `V1.1` no es deuda técnica: es alcance, y vive en el `07`.

Para la fase de WhatsApp: `D-01` es la única que la afecta directamente, y en
la dirección buena. Sacar el canal del núcleo es trabajo que la fase 2
necesita hecho, no un coste que la fase web asume por elegancia.

---

## 10. Trazabilidad

| Elemento | Origen |
|---|---|
| Veredictos sobre `src/` | `52` |
| Estado medido del árbol de pruebas | `51` §2, §3 |
| Canal fuera del núcleo | `WEB-D105`, `WEB-D162`, `21` |
| Lista blanca de service-role | `15` §4, `AC-SEG-01` |
| RLS por tabla | `WEB-D156`, `51` §8 |
| `local_fixture` prohibido en producción | `23`, `42` §6 |
| Una sola rama de migraciones | `WEB-D163` |
| Riesgo aceptado durante la documentación | `WEB-D006`, Ola 0 |
| Decisión nueva | `WEB-D164` |

| Documento que depende de este | Qué toma |
|---|---|
| `54_plan_de_implementacion_web.md` | Las cinco bloqueantes como precondición de corte, y los siete gates |
