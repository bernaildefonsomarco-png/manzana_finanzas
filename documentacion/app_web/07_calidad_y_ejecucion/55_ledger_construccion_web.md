# 55 — Ledger de construcción de la app web

**Bloque:** 07 — Calidad y ejecución
**Alcance:** V1
**Estado:** vivo
**Fecha de última actualización:** 3 de agosto de 2026
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

**La construcción avanza.** `W-01` a `W-15` cerraron `G1`. Ninguno tiene
criterios de `G3` propios cerrados. Desde `W-13`, “verificado” incluye
la parte `TEST` que el criterio realmente cubre; las mitades `USER` sin
sesión y los criterios explícitamente diferidos siguen marcados como
abiertos en sus documentos. Desde `W-14`, además, se retira `Evidencia:`
falsa donde no correspondía: varios criterios de `35`/`37`/`38` y, en
`W-15`, de `39`, tenían `TEST`/`USER` declarado desde su redacción original
sin que nada los verificara — se corrigieron a `No cierra: <razón>`
conservando el nivel de evidencia que sí les toca, no ocultándolo (ver
`W-14`/`W-15` §"qué sorprendió").

| | |
|---|---|
| Cortes cerrados | 19 de 20 |
| Criterios `verificado` | ~395 de 708 |
| Criterios `validado` | 0 de 135 |
| Sesiones con usuarios | 0 |
| Series abiertas | 0 |

Esta tabla se actualiza con cada corte y es lo primero que se lee. **Nota de
`W-17`:** esta tabla se quedó sin actualizar al cerrar `W-16` — el salto de
"240" a "346" cubre el crecimiento real de dos cortes, no solo de este. No
hay un test que compare esta tabla contra la matriz (`AC-LEDGER-08` lo
exige en prosa, pero no está gateado); es la brecha que motivó esta nota.
**Nota de `W-18`/`W-19`:** el `~395` sigue siendo una estimación contada a
mano (`W-18`: 28 de 49 criterios de `43`/`44`/`45`; `W-19`: ~21 de 51
criterios de `19`/`46`/`47`/`48`, ver §7 de esta entrada), por la misma
brecha: `generar.ts` deja `estado` fijo en `"pendiente"` para toda fila
(`scripts/matriz/generar.ts` línea 95) — nunca deriva `verificado` de nada,
así que esta tabla sigue siendo la única fuente de la cuenta real. Arreglar
el generador es trabajo de un corte de mantenimiento, no de este.

**`W-20` — pendiente de coordinación humana, no de código.** Los 19 cortes
de construcción están cerrados; `W-20` no construye (`54` §7.2): es correr
el protocolo `USER` de `49` §8 (tres personas reales, tarea sin ayuda) y
abrir las series `METRIC` de `49` §9 sobre los 135 criterios `G3`.
`RUL-HECHO-05` es explícito: ese cierre no lo puede declarar quien escribió
el código. El material de apoyo —los 135 criterios `G3` con su enunciado,
agrupados por corte y separados por protocolo— está generado en
[`55c_w20_checklist_g3.md`](./55c_w20_checklist_g3.md)
(`npm run matriz:listar-g3`); las sesiones y series reales, cuando ocurran,
se registran como nuevas entradas en este documento.

---

## 7. Entradas

## Bloque A archivado (`W-01` a `W-07`)

`RUL-LEDGER-03`: al cerrar `W-14` este documento llegó a 2.013 líneas. Las
siete entradas del Bloque A — Cimientos se movieron íntegras, sin resumir,
a [`55a_ledger_archivo_bloque_a.md`](./55a_ledger_archivo_bloque_a.md). Lo
que sigue es un puntero de una línea por corte, no un resumen: para
"qué sorprendió", "qué se entregó" y "documentos corregidos" completos, el
archivo es la fuente.

| Corte | Entrega | Cerrado |
|---|---|---|
| `W-01` | El generador de la matriz existe y regenera el censo real | 2026-07-27 |
| `W-02` | RLS con lista blanca de service-role y arranque seguro verificado en caliente | 2026-07-27 |
| `W-03` | Cinco comandos de prueba, cobertura medida, ocho reglas de lint definidas | 2026-07-27 |
| `W-04` | El canal sale del núcleo: prueba de agnosticismo compila y pasa | 2026-07-28 |
| `W-05` | Paginación por cursor, filtros server-side e idempotencia real en nueve listados | 2026-07-28 |
| `W-06` | 18 primitivas nuevas, modo oscuro, contraste WCAG medido y corregido | 2026-07-28 |
| `W-07` | `dashboard-app.tsx` desaparece; cada pantalla tiene URL propia | 2026-07-28 |

---

## Bloque B archivado (`W-08` a `W-15`)

`RUL-LEDGER-03`: al cerrar `W-19` este documento se acercaba de nuevo a
2.000 líneas. Las ocho entradas del Bloque B — Módulos se movieron
íntegras, sin resumir, a
[`55b_ledger_archivo_bloque_b.md`](./55b_ledger_archivo_bloque_b.md).
Lo que sigue es un puntero de una línea por corte, no un resumen: para
"qué sorprendió", "qué se entregó" y "documentos corregidos" completos,
el archivo es la fuente.

| Corte | Entrega | Cerrado |
|---|---|---|
| `W-08` | Las cuatro capas del dinero | 2026-07-29 |
| `W-09` | Los once tipos de movimiento se guardan desde Movimientos | 2026-07-29 |
| `W-10` | Nada se registra solo, y todo pendiente nace confirmable | 2026-07-29 |
| `W-11` | Pagos que vienen y Deudas sin doble registro | 2026-07-29 |
| `W-12` | Presupuestos, Metas y Proyecciones sin asesoría ni dinero ficticio | 2026-07-30 |
| `W-13` | Descubrimientos útiles y Memoria gobernable | 2026-08-01 |
| `W-14` | Recordatorios in-app, Búsqueda y Reportes/exportación | 2026-08-02 |
| `W-15` | El Inicio responde "¿dónde estoy?" en una pantalla | 2026-08-02 |

---

## W-16 — El motor responde con evidencia y no ejecuta nada sin confirmar

**Cerrado:** 2026-08-03
**Portones:** G1 ✓ (parcial, ver abajo) · G2 no aplica a este corte · G3 no
cierra: no hubo sesiones `USER` ni cohorte para `METRIC`
**Matriz regenerada:** 2026-08-03, con `npm run matriz:generar`; hash del
commit sustantivo: `0c88e21`.

### Qué se entregó

El corte más grande hasta ahora (siete documentos de diseño — `20`, `20b`,
`20c`, `22`, `23`, `40`, `42` — contra ~17k líneas de agente heredado),
tratado como ocho fases, cada una cerrada y verificada antes de empezar la
siguiente, en vez de intentarse de una sola vez.

**Fase 1 — Catálogo de comandos y vocabulario (`40`).**
`scripts/catalogo/generar.ts` parsea mecánicamente las tablas de `40`
§5/§6/§7 y las cruza contra la §14 de los dieciséis módulos. Censo
verificado: **99 comandos, 156 entradas de lectura** (101 dimensiones + 50
medidas + 5 alias), no los "95/145" que `40` §11 declaraba a mano
(`WEB-D254`) — corregido en seis documentos. Encontró y corrigió dos
defectos reales en `30` §14.2. `src/core/catalog/` es el artefacto en
tiempo de ejecución (`esComandoConocido`, `esDimensionConocida`, etc.),
generado y con guarda de desincronización propia.

**Fase 2 — Limpieza de canal del núcleo.** `WEB-D105` solo había tocado
`TurnWorkspace`; la lectura completa de los ocho archivos de `42` §8 encontró
`channel` también en `ConversationContextPackSchema` y `DataContextPack`
(`WEB-D252`). Los tres se limpiaron; donde el canal servía para registro
(`conversation_memory`), pasó a ser un parámetro explícito en vez de leerse
del contrato (`WEB-D255`).

**Fase 3 — Extensión del verificador.** `evidence-and-policy-compiler.ts`
ganó tres códigos (`command_outside_catalog`, `figure_without_assumptions`,
`world_knowledge_promoted`) y, más tarde en la fase 7, un cuarto
(`focus_expired`). Extender el verificador exigió extender primero lo que
`ConversationalExecutiveOutput` puede expresar: `command_id` en las
propuestas, `claim_type: "projection"` + `assumptions`, y el concepto de
`findings` (`WEB-D256`).

**Fase 4 — Capa semántica (`20b`).** Lenguaje de consulta declarativo
(`de`/`donde`/`agrupar_por`/`medir`/`ordenar`/`limitar`), compilador que
inyecta `user_id` sin que el lenguaje pueda expresarlo (`AC-SEM-01`), y
cálculo aislado puro con los límites reales de filas y tiempo de `23` §5b.2.
El modelo del dominio reutiliza el vocabulario ya generado en la fase 1 en
vez de redeclararlo (`WEB-D257`); solo `movimientos` es compilable, con
predicados `y` (AND) — `o`/`no`/subconsultas quedan fuera, documentado
(`WEB-D258`).

**Fase 5 — Adaptación de la sesión única.** `conversational-executive-agent.ts`
gana `consultar_datos_abiertos` como una 16ª herramienta, **aditiva** sobre
el enum cerrado de 15 (`WEB-D259`) — reemplazarlas habría sido una regresión
real, porque 14 de ellas cubren entidades que la capa semántica todavía no
modela.

**Fase 6 — Perfil del usuario (`20c`).** Descubrió que el esquema de perfil
ya existía, construido por `W-13` (`user_profile_facts`/`candidates`,
migración `062`) — `13` §7.5b describía una migración `054` que nunca se
construyó así (`WEB-D260`, corregido). `src/core/profile/` formaliza lo que
faltaba: la capa (`estilo`/`vida`/`vinculo`/`hilo`) como lectura del prefijo
de `subject_key`, y la política de confirmación de `20c` §3 (máximo una vez
por conversación, nunca en el primer turno, no reintentar tras dos veces
ignorado) como función pura.

**Fase 7 — Runtime, costo y degradación (`23`).** Verificó primero:
`src/agents/runtime/` ya implementaba la puerta de arranque, el aislamiento
de proveedor por componente y el endpoint de salud, de un endurecimiento
anterior (`53` `D-04`) — no se reconstruyó nada de eso. Cerró dos huecos
reales: el foco caducado no se comprobaba en la sesión única nueva (sí en el
motor legado), y no existía el concepto de los cuatro grados de degradación
de `23` §7 en ningún fichero (`src/core/degradation/grade.ts`, `WEB-D261`).

**Fase 8 — Cierre.** Este documento, la anotación de §20/§17/§12 de los
siete documentos de diseño contra código y pruebas reales (no contra
intención), regeneración de la matriz, y verificación final completa.

Cifras: 4 módulos nuevos de `src/core/` (`catalog/`, `semantics/`,
`profile/`, `degradation/`), 12 decisiones nuevas (`WEB-D250` era de `W-14`;
las de este corte van de `WEB-D252` a `WEB-D261`, diez), ~150 pruebas nuevas
repartidas en las ocho fases, todas con `RUL-HECHO-02` sobre la lógica
determinista nueva (mutación real del código, confirmación de que la prueba
falla, reversión). `npx tsc --noEmit` y `npx eslint .` en verde en cada
fase y al cierre. `npm test`: mismo timeout frío conocido de
`movements/route.test.ts` desde `W-09` (pasa aislado), el resto en verde.

### Qué sorprendió

La primera y más grande: **`conversational-executive-agent.ts` ya
implementaba la forma exacta de la sesión única que `20` §6 pedía**, y ya
había sustituido en producción a `orchestration-planning-agent`
(`legacyPlanningAgent` en el propio código) antes de que este corte
empezara. `WEB-D253` reencuadró toda la fase 5: no era "construir la sesión
única", era "quitarle el enum cerrado de herramientas a la que ya existe" —
mucho más angosto de lo previsto, y una fracción del trabajo que se había
presupuestado.

La segunda: el propio documento `40`, escrito para *cerrar* la contradicción
`C-03` sobre el número de comandos, tenía su propio número mal — contado a
mano, por filas de tabla en vez de comandos distintos (`WEB-D254`). El
patrón se repitió con `13` §7.5b (`WEB-D260`): un documento de diseño
citando un esquema que nunca se construyó así, porque nadie lo corrigió
después de que el corte que lo implementó tomara decisiones distintas.

La tercera: el perfil del usuario (`20c`) y buena parte del runtime seguro
(`23` §3/§4) **ya estaban construidos** por cortes anteriores (`W-13`, y un
endurecimiento posterior citado como `53` `D-04`) antes de que `20c`/`23`
mismos se terminaran de escribir como documentos de diseño. Verificar antes
de construir —el mismo método que ya había pagado en la fase 5— evitó
reconstruir dos veces infraestructura real y probada.

La cuarta: extender el verificador (fase 3) resultó ser, en la práctica,
extender primero el contrato de salida que el verificador comprueba —
`command_id`, `assumptions`, `findings` no existían en
`ConversationalExecutiveOutput` antes de esta fase. Un verificador no puede
comprobar un hecho que la salida no puede expresar.

### Qué quedó abierto

Documentado explícitamente en el §20/§17/§12 de cada uno de los siete
documentos, no oculto. Lo más significativo:

- La capa semántica (`20b`) solo compila la entidad `movimientos`, con
  predicados `y`. Trece entidades más (deudas, cuentas, pendientes,
  recurrentes...) y los combinadores `o`/`no`/subconsultas quedan para un
  corte futuro (`WEB-D257`/`WEB-D258`).
- "El panorama cargado" de `20b` §4 (resúmenes mensuales comprimidos,
  patrones precalculados, ~26k tokens estables) no se construyó: el motor
  real sigue sin esa capa. `AC-SEM-04`/`09`/`10`/`16` y `AC-RT-15` dependen
  de ella y no cierran.
- El pipeline que **genera** candidatos de perfil observando una
  conversación real no existe todavía — `src/core/profile/` construye la
  política de cuándo preguntar y qué no generar automáticamente, pero nada
  llama a esas funciones desde el motor real. `AC-PERF-02`/`10`/`14` quedan
  con la mitad estructural cerrada y la integración pendiente.
- Las cuatro capas de voz/personalización adaptativa (`20c` §5-§6b) y la
  mayoría de los criterios de evidencia procedimental de `22` (procedencia
  `dicho`/`heredado`/`consultado`/`supuesto` como campo explícito,
  confirmabilidad completa de `§6`, operaciones masivas de `§7.1`) son
  comportamiento del modelo en el turno o piezas del motor legado que
  ninguna fase de este corte tocó — de evidencia `USER`/`LIVE` en su
  mayoría, fuera del alcance de lo que un corte de código puede cerrar por
  sí solo.
- El criterio `AC-REU-07` (ningún enum cerrado de herramientas) se declaró
  antes de que `WEB-D257` limitara la capa semántica a una entidad; con esa
  limitación, **no cierra por decisión explícita** (`WEB-D259`), no por
  omisión: las 15 herramientas cerradas siguen ahí, con una 16ª abierta al
  lado.

No hubo sesiones `USER` ni serie `METRIC`. Ningún criterio con evidencia
`USER`/`LIVE` cierra en este corte — mismo patrón que `W-14`/`W-15`: no hay
sesión de usuario real todavía en el flujo del motor conversacional nuevo.

### Documentos corregidos

- `20` §17, `20b` §9, `20c` §10, `22` §12, `23` §11, `42` §12: los 80
  criterios de los seis documentos anotados contra código y pruebas reales,
  criterio por criterio — incluidos los que no cierran, con la razón
  específica en vez de omitirlos.
- `13` §7.5b: reescrita para reflejar el esquema real de `062_w13_insights_memory.sql`
  en vez de la migración `054` nunca construida (`WEB-D260`).
- `03_decisiones_producto_web.md`: `WEB-D252` a `WEB-D261` (diez decisiones
  nuevas).
- `00_indice_maestro.md`, `05_contradicciones_heredadas_cierre.md`,
  `49_criterios_de_aceptacion_globales.md`, `56_puente_a_fase_whatsapp.md`:
  cifras del catálogo corregidas de "95/145" a "99/156" (`WEB-D254`).
- `scripts/gates/sin-canal-en-el-nucleo.ts`: `src/core/catalog/generated.ts`
  agregado a la excepción ya vigente de `WEB-D172` (valor de dato legítimo,
  no rama de canal).
- `README.md`: `core/catalog/`, `core/semantics/`, `core/profile/`,
  `core/degradation/` documentados en el árbol real.
- `tests/lint/readme-arbol-real.test.ts`: sin cambios de expectativa (el
  gate ya exigía que toda carpeta nueva se documentara; este corte cumplió
  la regla en cada fase, no al final).

---

## W-17 — El asistente responde en la app, no ejecuta nada sin confirmar, y calla cuando no puede

**Cerrado:** 2026-08-03
**Portones:** G1 ✓ (parcial: 17 de 18 criterios sin `USER`/`METRIC` cierran
su parte `TEST`/`CODE` — `AC-ASI-18` no cierra) · G2 no aplica a este corte
· G3 no cierra: no hubo sesiones `USER` ni cohorte `METRIC` (9 criterios de
`G3`, ninguno validado)
**Matriz regenerada:** 2026-08-03, con `npm run matriz:generar`; hash del
commit sustantivo: `8080019`.

### Qué se entregó

El presentador web del asistente conversacional (`41`), sobre el motor que
`W-16` ya dejó listo — ocho fases, cada una cerrada y verificada antes de
empezar la siguiente.

**Fase 1 — Migración y tipos.** `13` §7.5 reservaba la migración `052` para
`assistant_threads`/`assistant_messages`; el número real es `065`
(`052` ya lo usa `052_movements_search_vector.sql`, `WEB-D262`).
`assistant_messages` gana `idempotency_key` — columna que `13` no incluía,
sin la cual un reintento de red duplicaría el mensaje del usuario.

**Fase 2 — Puente al motor.** El hallazgo central del corte: el
`financial_proposals` del agente ejecutivo único ya viaja por el mismo
`pending_items` que usa el resto de la app (`dataAgentResultFromExecutive`,
`data-action-pending.ts`), así que el presentador web no necesitó inventar
un segundo mecanismo de confirmación — correlaciona `pending_items.source_ref`
contra el turno actual (`WEB-D263`). El turno web llama al motor
directamente y en la misma petición HTTP, sin `transactional_outbox`: la
razón de WhatsApp para encolar (el webhook de Meta debe reconocer en
milisegundos) no existe en la web, donde el navegador ya espera la
respuesta completa.

**Fase 3 — Siete rutas API.** `/assistant/turns`, `/threads`,
`/threads/[id]`, `/health`, `/proposals/[id]` (`PATCH`/`confirm`/`dismiss`)
— todas con cliente autenticado, sin excepción de `service_role` en el
camino de lectura (`41` §15, `WEB-D264`); la confirmación sí usa
`service_role`, con la misma justificación ya auditada de
`/pending/[id]/confirm` (`WEB-D264`). Quedó explícitamente fuera:
confirmar una propuesta respaldada por un `CorrectionCommand` en vez de un
`pending_item` — investigar ese segundo camino de ejecución es trabajo real
que esta fase no alcanzó (`WEB-D265`).

**Fase 4 — Los diez bloques.** `EvidenceLink`, `ConfirmationCard` (con
`ConfirmationCardActions`/`ConfirmationCardFieldRow` extraídos para cumplir
el límite de 150 líneas), `MassivePreviewCard` y `BlockRenderer` con seis
vistas de bloque propias. El nivel de confirmación de una tarjeta se
deriva de `risk_level`/`confirmable` del `pending_item`, porque `40` §3 no
persiste el nivel en ningún sitio (`WEB-D266`).

**Fase 5 — Las superficies.** Panel lateral persistente y hoja inferior
móvil en un solo componente responsive — deliberadamente **no** una
instancia de `Sheet`/`Dialog`, porque esos primitivos atrapan el foco y
oscurecen el fondo a propósito, justo lo que `RUL-ASI-01` prohíbe
(`WEB-D267`). `/asistente` (conversación completa) y `/asistente/hilos`
(historial). React Query para el estado de servidor, con una entrada nueva
en el registro central de invalidación (`assistant.thread_updated`) en vez
de una caché paralela.

**Fase 6 — Degradación y accesibilidad.** Investigado primero: el motor no
tiene ningún gancho de transmisión incremental (`stream`/`onToken`/
`AsyncGenerator` no existen en `src/agents/` ni `src/core/`) — construirlo
sería diseñar motor, fuera del alcance de este documento (`WEB-D268`). Lo
que sí se construyó: `handleWebAssistantTurn` consulta el grado de
degradación antes de llamar al motor — en `sin_modelo` no lo intenta; en
`solo_lectura` sí llama pero el presentador quita los bloques de acción
antes de escribirlos (`AC-ASI-17`). Corregido en el camino: `ConfirmationCard`
enfocaba el primer campo incierto al montar por defecto, violando
`RUL-ASI-22` en el único contexto real donde la tarjeta aparece hoy (una
respuesta al mensaje que el usuario acaba de enviar) — el valor por
defecto pasó a `false`.

**Fase 7 — Masivas, telemetría, anti-inyección, modo discreto.**
Investigado antes de construir: los ocho comandos `masiva` de `40` §7.17
no tienen ninguna implementación en el motor — ni rama en
`response-planner.ts`, ni pendiente por lote (`WEB-D269`); conectar
`MassivePreviewCard` a datos simulados habría sido el mismo error que
`WEB-D268` evitó. Tampoco existe un pipeline de eventos de producto en
ningún módulo de la app (`WEB-D270`) — se verificó y se dejó probado que
ningún `logger.*` del asistente lleva el texto del turno. Se verificó
(código + prueba nueva) que un mensaje con forma de instrucción llega
intacto como dato, nunca como instrucción (`RUL-ASI-20`). El campo `Monto`
de una `ConfirmationCard` de solo lectura ahora respeta el modo discreto
(`MoneyText`), que antes mostraba el número en texto plano.

**Fase 8 — Cierre.** Este documento, la anotación de §21 de `41` contra
código y pruebas reales, dos correcciones encontradas y arregladas en el
camino (`AC-ASI-24`: el foco no volvía al compositor tras confirmar;
`AC-ASI-08`: no había mensaje visible cuando el Core rechazaba una
ejecución), regeneración de la matriz, y verificación final completa.

Cifras: 1 módulo nuevo de `src/core/` (`degradation/current-grade.ts`,
sobre `grade.ts` de `W-16`), 6 decisiones nuevas (`WEB-D266` a `WEB-D271`),
~140 pruebas nuevas repartidas en las ocho fases, todas con `RUL-HECHO-02`
sobre la lógica determinista nueva. `npx tsc --noEmit` y `npx eslint .` en
verde en cada fase y al cierre. `npm test`: mismo timeout frío conocido de
`movements/route.test.ts` desde `W-09` (pasa aislado), el resto en verde.

### Qué sorprendió

La primera: el hallazgo de la fase 2 — `financial_proposals` ya viajaba por
`pending_items` — reencuadró todo el corte de la misma forma que
`WEB-D253` reencuadró la fase 5 de `W-16`. La pregunta dejó de ser
"¿cómo confirma el usuario una propuesta del asistente?" y pasó a ser
"¿cómo reutilizo el confirmador que `/pendientes` ya tiene, probado y en
producción?" — mucho menos trabajo, y sin una segunda fuente de verdad
compitiendo con la primera.

La segunda: `RUL-ASI-06` ("el foco entra en el primer campo incierto") y
`RUL-ASI-22` ("cuando llega una propuesta, el foco no se mueve") parecen
compatibles leídas por separado, pero chocan en el único contexto real
donde `ConfirmationCard` aparece: una propuesta **siempre** llega como
respuesta al mensaje que el usuario acaba de enviar, así que "entra el
foco al montar" y "el foco no se mueve al llegar" son la misma situación
descrita dos veces, con resultados opuestos. Se descubrió escribiendo la
Fase 6, no la Fase 4 donde se construyó el componente — la primera vez
que una regla de accesibilidad de `41` §18 obligó a revertir una decisión
ya tomada en una fase anterior del mismo corte.

La tercera, repetida de `W-16`: verificar antes de construir volvió a
pagar dos veces. Ni la transmisión incremental (fase 6) ni las operaciones
masivas (fase 7) tienen ningún soporte en el motor — confirmarlo con una
búsqueda exhaustiva antes de intentar "conectar" nada evitó construir
interfaz sobre datos inventados en ambos casos.

La cuarta: la tabla de §6 de este mismo documento llevaba desde el cierre
de `W-16` sin actualizarse — "15 de 20" cuando ya eran 16. Ningún test la
compara contra la matriz (`AC-LEDGER-08` lo exige en prosa, no en código).
Corregida aquí, con la brecha anotada en vez de silenciada.

### Qué quedó abierto

Documentado explícitamente en el §21 de `41`, no oculto. Lo más
significativo:

- Las operaciones masivas (`AC-ASI-09`) no cierran: el motor no produce
  ningún bloque `previsualizacion` real. `MassivePreviewCard` y el punto de
  extensión `resolveMassivePreview` quedan construidos y probados, sin
  productor (`WEB-D269`).
- La transmisión incremental real (`AC-ASI-10` cierra de forma trivial,
  `AC-ASI-11` y `AC-ASI-26` no cierran en absoluto) depende de un gancho de
  streaming que el motor no expone — motor, no presentador (`WEB-D268`).
- `RUL-ASI-11` (contexto de pantalla) no está conectado: `POST /assistant/turns`
  solo acepta `thread_id`/`text`. `AC-ASI-21` cierra de forma trivial (no
  hay contexto que pudiera ampliar nada), pero la función real —
  "¿y esto qué significa?" sin repetir nada — no funciona todavía
  (`WEB-D271`).
- El criterio de que `mostrar` no interrumpa una edición en curso
  (`AC-ASI-18`) no cierra: no existe una forma genérica de detectar "hay un
  formulario abierto en esta pantalla" en la app, y esta fase no la
  construyó.
- Ningún pipeline de eventos de producto (`41` §20) existe — ni aquí ni en
  ningún otro módulo (`WEB-D270`). `AC-ASI-22` cierra por la ausencia
  verificada de fuga de contenido, no por un sistema construido.
- Los nueve criterios de `G3` (`01`, `04`, `05`, `09`, `11`, `13`, `15`,
  `26`, `27`) no cierran: no hubo sesión `USER` ni cohorte `METRIC` en este
  corte, mismo patrón que todos los anteriores desde `W-14`.

No hubo sesiones `USER` ni serie `METRIC`.

### Documentos corregidos

- `41` §21: los 27 criterios anotados contra código y pruebas reales,
  incluidos los nueve que no cierran, con la razón específica.
- `13` §7.5: migración `052`→`065`, columna `idempotency_key` añadida
  (`WEB-D262`).
- `03_decisiones_producto_web.md`: `WEB-D262` a `WEB-D271` (diez
  decisiones nuevas, seis de ellas registradas en esta fase de cierre).
- `55` (este documento) §6: tabla de estado corregida de "15 de 20" /
  "240 de 708" a "17 de 20" / "346 de 708" — cubre el crecimiento no
  registrado de `W-16` y el de este corte, con la brecha anotada.
- `vitest.config.ts`: `src/app/(app)/asistente/**/*.test.tsx` añadido a
  `PATRON_DOM` — los componentes del asistente viven fuera de `features/`
  (`WEB-D164`) pero montan hooks de React igual que los de `src/ui/`.
- `tests/corpus/matriz.test.ts`: censo de criterios con clase actualizado
  (131→153 `unidad`, 324→346 `conClaseAsignada`).
- `tests/lint/seg-04-404-no-403.test.ts`,
  `tests/lint/service-role-en-rutas.test.ts`: conteos de rutas y
  excepciones de `service_role` actualizados (siete rutas nuevas, tres
  excepciones nuevas).

---

## `W-18` — Se puede entrar, recuperar la contraseña y llegar al primer valor

**Cerrado:** 2026-08-03
**Portones:** `G1` ✓ parcial — de los 49 criterios de `43`/`44`/`45`, 28
cierran con evidencia `TEST`/`CODE` real (ver "qué quedó abierto" para el
resto, con razón por cada uno) · `G2` no aplica a este corte · `G3` no
cierra: sin sesiones `USER` ni cohorte `METRIC` (mismo patrón que todos los
cortes desde `W-14`).
**Matriz regenerada:** 2026-08-03, con `npm run matriz:generar` (1553
identificadores, 120 `SCR-`, censo sin cambios en `AC` porque no se creó
ningún criterio nuevo — solo se implementaron los existentes); hash del
commit sustantivo: `2a2a293`.

### Qué se entregó

Autenticación real (`43`), la puerta de bienvenida y el permiso de correo
explicado (`44`), y el arreglo de dos defectos de privacidad reales
encontrados auditando el código antes de construir (`45`).

**Auth.** Mapeo de errores por **código** del proveedor
(`src/core/auth/auth-error-mapping.ts`), no por subcadena de su mensaje en
inglés — cierra `C-13` de verdad esta vez: los doce códigos de
`@supabase/auth-js` (`error-codes.d.ts`) se leyeron del paquete instalado,
no se inventaron. Límite de intentos (`RUL-AUTH-06`) con endpoint propio,
`POST /api/v1/auth/attempt`, tal como `WEB-D181` se lo encargó a este
corte: reusa `check_and_increment_rate_limit` (migración `047`) con claves
por correo y por IP. `/auth/callback` real (intercambio de sesión en
servidor, `next` validado contra rutas internas conocidas — nunca una URL
externa). Recuperación de contraseña completa: `/recuperar-clave` (nunca
distingue si el correo existe — ni siquiera hay una forma de que Supabase
lo revele desde este endpoint), `/restablecer-clave` (cierra las demás
sesiones al terminar, `RUL-AUTH-07`), `/verificar` (reenvío, sin bloquear
el uso de la app mientras tanto). Cambiar contraseña y correo con sesión
activa (`PATCH /api/v1/auth/password`, `PATCH /api/v1/auth/email`) — estos
dos sí pasan por nuestro servidor, a diferencia de entrar/registrarse:
tienen sesión ya establecida, no son uno de los tres flujos que `WEB-D181`
excluyó. "Salir en todos los dispositivos" (`ACT-AUTH-10`,
`src/core/auth/sign-out.ts`) con auditoría antes de cerrar la sesión propia
(porque después ya no habría con qué autenticar el `insert`). Pantalla real
de eliminar cuenta (`SCR-AUTH-08`, `DeleteAccountSection`) con cifras
reales consultadas en el momento — movimientos, deudas, buzones, cosas
aprendidas, conversaciones — y jerarquía de botones correcta (cancelar
primario, `WEB-D099`). Migración `066`, `account_events`, con la
contradicción propia de `43` corregida (`user_id` no puede ser `not null`
y a la vez "anonimizarse a null" — se corrigió a `nullable`/`on delete set
null`, `WEB-D275`).

**Dos bugs reales, no hipótesis.** `useLegacySignOut` ("Salir") llamaba a
`supabase.auth.signOut()` sin `scope`, que es `'global'` por defecto en
`@supabase/auth-js` — cada "Salir" cerraba sesión en **todos** los
dispositivos, no solo el actual, sin decirlo (`WEB-D277`). Y
`DiscreetModeProvider` leía el modo discreto con un `fetch` de cliente, así
que todo usuario con el modo activo veía sus montos **en claro** en cada
carga de página hasta que el `fetch` resolvía — exactamente el defecto que
`C-04`/`AC-CONF-04` describen (`WEB-D278`). Se corrigió pasando la
preferencia ya leída en el servidor (`getExperiencePreferences`, en el
layout de `(app)`) como `initialData` de la query: el primer render, antes
de cualquier JavaScript de cliente, ya es correcto.

**Onboarding.** `/bienvenida` real (`SCR-ONB-02`, `WelcomeScreen`): tres
frases, tres puertas más "prefiero mirar primero", las cuatro avanzan
`onboarding_status` (infraestructura que `W-15` ya había construido y
nadie conectó a una pantalla) para que la bienvenida nunca vuelva a
aparecer, elija lo que elija (`RUL-ONB-05`). `/bienvenida/correo`
(`SCR-ONB-04`, `EmailPermissionScreen`): "lo que hago" / "lo que no hago"
como dos secciones reales, antes de la pantalla de Google.

**Privacidad.** `GET /api/v1/preferences/discreet`, el punto único de
decisión que `RUL-CONF-03` exige, con su propio test. Migración `067`:
`consent_events` (esquema, sin UI todavía — ver abajo) y
`sensitive_category_ids` en `user_preferences`, **sin tocar**
`categories.is_sensitive` (que ya consume `sensitive-topics.ts` para
`AC-PERF-10`, cerrado desde `W-16`) — son dos fuentes de verdad
deliberadamente distintas (`WEB-D276`). `/privacidad` y `/eliminar-datos`
reescritas de cero: cierran `C-14` (el borrado sí está en la app, y ahora
lo dice como vía principal) y `C-16` (declaración Limited Use de Google,
con la frase estándar recomendada — sin poder verificarla por `fetch` en
vivo contra la página oficial, `WEB-D279`, `pendiente_decision`). Un test
de contenido nuevo, `tests/contenido/paginas-legales.test.ts`, falla el
build si las páginas legales vuelven a divergir del código (`AC-CONF-10`).

### Qué sorprendió

La primera: `W-15` ya había construido toda la máquina de estados de
`onboarding_status` (`src/core/onboarding/onboarding-activation.ts`,
`POST /api/v1/onboarding`) y **nadie la había conectado a una pantalla** —
`show_initial_prompt` existía, calculado, sin consumidor. Construir
`/bienvenida` fue conectar un cable que ya estaba tendido, no diseñar el
sistema.

La segunda, la más seria: los dos bugs de "qué se entregó" (`signOut`
global por defecto, modo discreto con parpadeo) llevaban tiempo en
producción, invisibles porque ambos son silenciosos — no lanzan error, solo
hacen algo distinto de lo que el usuario esperaba. Ninguno lo encontró un
test hasta que este corte leyó el código con la pregunta correcta delante
(`RUL-AUTH-11` para el primero, `AC-CONF-04` para el segundo). Se corrigen
aquí en vez de abrir una `WEB-D` para "arreglar después", porque los dos ya
estaban en producción y el segundo es exactamente la promesa central del
modo discreto.

La tercera: `43` §4.3 se contradice a sí mismo en el propio bloque SQL que
declara (`not null` + "se anonimiza a null" un párrafo después) — el cuarto
caso del corpus de ese patrón específico, después de los que `C-01`/`C-08`/
`C-13` ya habían mostrado: el código y la prosa de un mismo documento
pueden desalinearse igual que dos documentos distintos.

### Qué quedó abierto

De los 49 criterios de `43`/`44`/`45`, veintiuno no cierran en este corte,
documentados aquí en vez de marcados en silencio (`RUL-HECHO-04`):

- **`AC-CONF-01`/`AC-CONF-06`/`AC-CONF-16`** — `settings-screen.tsx`
  (2.081 líneas) sigue sin dividirse en las ocho secciones reales de
  `RUL-CONF-01`. `/configuracion/perfil`, `/configuracion/privacidad`,
  `/configuracion/correo` siguen siendo el índice condenado o un
  marcador. `consent_events` tiene esquema y RLS pero ningún endpoint
  `GET/POST /consents` ni pantalla "permisos que diste". Es el trabajo más
  grande que quedó fuera — un corte propio, no un descuido.
- **`AC-AUTH-08`** (aviso a la dirección antigua al cambiar correo, con
  revertir 24 h) — depende de que el proyecto de Supabase tenga activado
  "Secure email change"; el código llama a `updateUser({email})` y confía
  en esa configuración, no la garantiza por sí solo.
- **`AC-AUTH-06`** (enlaces caducan en 1 hora exacta) — depende del `OTP
  expiry`/tiempo de vida del `flow_state` configurado en el proyecto de
  Supabase, no de un valor que este código fije.
- **`AC-AUTH-16`** (formularios funcionan sin JavaScript) — choca con
  `WEB-D181` (`no_negociable`): los formularios llaman a
  `supabase.auth.signInWithPassword`/etc. desde el cliente, lo que exige
  JavaScript por diseño. Reconciliar los dos es un cambio de arquitectura
  que no cabe en este corte.
- **`AC-AUTH-10`** (sesión caducada no pierde un formulario a medias) — no
  se tocó: exige un mecanismo genérico de "restaurar borrador tras volver
  a entrar" que ninguna pantalla tiene todavía.
- **`RUL-ONB-03`/`SCR-ONB-03`** (explicación en sitio, un componente para
  los seis conceptos de `44` §6.4) — no se construyó el componente
  genérico; ninguna de las seis explicaciones existe todavía.
- **`RUL-ONB-07`** (ofrecer el correo una segunda vez a los 10 movimientos
  manuales) — no implementado: exige contar movimientos manuales y
  recordar si ya se ofreció una vez, ninguno de los dos existe hoy.
- **`/configuracion/voz`** (`RUL-CONF-10`) — la ruta ni siquiera tiene
  `page.tsx` todavía; no es una regresión de este corte, es que nunca se
  construyó.
- Los nueve criterios de `G3` de estos tres documentos no cierran: mismo
  patrón que todos los cortes desde `W-14`, sin sesión `USER` ni cohorte
  `METRIC`.

No hubo sesiones `USER` ni serie `METRIC`.

### Documentos corregidos

- `43` §4.3: migración `064`→`066`, `user_id` de `account_events` corregido
  a `nullable`/`on delete set null` (`WEB-D274`, `WEB-D275`).
- `43` §7/§8: la palabra de confirmación de borrado se corrige de
  `ELIMINAR` a `ELIMINAR MI CUENTA`, la que el endpoint ya tenía en
  producción (`WEB-D273`).
- `43` §8: nuevo `SCR-AUTH-09` (`/cuenta-eliminada`, `WEB-D280`).
- `44` §7: `SCR-ONB-04` gana ruta real, `/bienvenida/correo`.
- `45` §4.2: migración `065`→`067` (`WEB-D274`); `RUL-CONF-04` corregido de
  "salud y farmacia" a "salud" — no existe categoría propia "farmacia"
  entre las 12 canónicas (`WEB-D276`).
- `10` §3.1/§3.2: `/cuenta-eliminada` y `/bienvenida/correo` añadidas.
- `03_decisiones_producto_web.md`: `WEB-D272` a `WEB-D281` (diez
  decisiones nuevas).
- `README.md`: `core/auth/` añadido al árbol.
- `tests/lint/seg-04-404-no-403.test.ts`: 152→157 rutas.
- `tests/lint/service-role-en-rutas.test.ts` /
  `scripts/gates/service-role-lista.ts`: `v1/auth/attempt` añadida a la
  lista blanca permanente (RPC revocado de `authenticated`/`anon`, sin
  sesión de usuario posible antes de entrar).
- `tests/corpus/matriz.test.ts`: censo de superficies con ruta, 119→120.

---

## `W-19` — Toda cifra se explica, y nada sale por correo sin permiso

**Cerrado:** 2026-08-03
**Portones:** `G1` ✓ parcial — de los 51 criterios de `19`/`46`/`47`/`48`,
~21 cierran con evidencia `TEST`/`CODE` real (ver "qué quedó abierto")
· `G2` no aplica a este corte · `G3` no cierra: sin sesiones `USER` ni
cohorte `METRIC` (mismo patrón que todos los cortes desde `W-14`).
**Matriz regenerada:** 2026-08-03, con `npm run matriz:generar` (1553
identificadores, sin cambios de censo: no se creó ningún criterio nuevo);
hash del commit sustantivo: `cc8a97d`.

### Qué se entregó

Correo saliente real (`46`), un índice de ayuda con contacto a soporte
(`48`, que también cierra el "reportar un problema" de `19`), y una
corrección de consistencia en tres módulos que `47` daba por resuelta y no
lo estaba del todo.

**Correo saliente.** Migración `068`: `email_outbox` y `email_suppressions`.
Política de envío (`src/core/email-outbox/send-policy.ts`, `RUL-MAIL-02`)
pura y probada: las cinco condiciones —tipo activo, causa vigente,
dirección suprimida, horario silencioso, límite diario— con la corrección
de que la supresión bloquea **todo** correo, incluidos los transaccionales
(`WEB-D282`, ver "qué sorprendió"). Idempotencia por `(tipo · sujeto ·
día)` (`RUL-MAIL-07`). Plantillas (`RUL-MAIL-05`) que nunca emiten
`<img>`, siempre llevan texto plano, y añaden `List-Unsubscribe`/
`One-Click` solo en notificaciones, nunca en transaccionales. Token de
baja firmado con HMAC, sin sesión (`RUL-MAIL-04`, `/baja`), reutilizando
`setReminderPreference`/`getReminderPreferences` que `W-14` ya había
construido para `37`. `/baja/todos` (`ACT-MAIL-04`) suprime la dirección
entera. Webhook de rebotes/quejas con firma verificada **antes** de leer
el cuerpo (`AC-MAIL-17`), reubicado a `/api/webhooks/email` porque un
proveedor externo no puede pasar el `verifyOrigin` de `/api/v1/*`
(`WEB-D284`). El trabajador que envía usa un `EmailSender` conectable, con
un remitente de registro por defecto — no hay credenciales de proveedor
real configuradas todavía (`WEB-D285`, `AC-MAIL-12` queda `LIVE`). El único
productor real conectado en este corte es transaccional: "tu descarga está
lista", encolado desde `exports-process` cuando un `export_job` pasa a
`listo`.

**Ayuda y soporte.** `/ayuda` (nueve artículos, ni uno más, `RUL-AYUDA-08`)
y `/ayuda/[tema]`. `/ayuda/contacto` (`RUL-AYUDA-09`): el usuario ve
exactamente qué contexto se adjunta —pantalla, versión, navegador— y puede
quitar cualquier pieza antes de enviar; nunca monto, descripción ni
conversación. Este mismo formulario cierra el "reportar un problema" de
`19` §8: son la misma superficie descrita desde dos documentos, así que se
construyó una sola vez. `/estado` real, pública, sin JavaScript,
declarando a mano cuándo se actualizó (`RUL-AYUDA-10`).

**Observabilidad.** `tests/lint/obs-02-sin-datos-financieros-en-logs.test.ts`
escanea todo `logger.*` del proyecto por las claves financieras
inequívocas (`amount`, `monto`, `merchant`, `comercio`) — pasó en verde a
la primera, confirmando lo que `19` §3 ya afirmaba ("ya implementado y
correcto"), ahora con un test que lo impide regresar en silencio
(`AC-OBS-02`).

**Consistencia de `47`.** El test de corpus de `AC-VIDA-02` encontró que
tres módulos (`25`, `26`, `33`) seguían escribiendo "pocos"/"muchos" sin
número en su §12 pese a que `47` §1 decía haberlo corregido en catorce
módulos — se corrigieron los tres (`WEB-D287`).

### Qué sorprendió

La primera, la más seria: `RUL-MAIL-03` dice literalmente "los
transaccionales ignoran las cinco reglas", pero escribir el test que debía
confirmarlo produjo un caso que no tenía sentido — una recuperación de
contraseña a una dirección que rebota de forma permanente, enviada de
todas formas porque "es transaccional". La regla, leída con cuidado, se
titula "horario silencioso y límites, **solo para notificaciones**" y su
único ejemplo es sobre horario; la supresión (`RUL-MAIL-08`) tiene una
razón de ser completamente distinta —proteger la reputación del dominio—
que no depende de qué tipo de correo sea. Se corrigió antes de que el
código incorrecto llegara a un test que lo validara mal (`WEB-D282`).

La segunda: `47` afirma en su propio §1 y §9 haber corregido "catorce
módulos" que decían "pocos"/"muchos" sin número, y el test de corpus que
debía confirmarlo (`AC-VIDA-02`, nunca escrito hasta ahora) encontró tres
que seguían sin corregir. `47` es un documento de agregación —el mismo
patrón que `40` con las siete colisiones de nombre— y esta es la tercera
vez que ese tipo de documento afirma haber cerrado algo que, verificado con
código en vez de con lectura, no lo estaba del todo.

La tercera: `/ayuda/contacto` (`48`) y "reportar un problema" (`19` §8) son
literalmente la misma pantalla descrita por dos documentos distintos con
vocabulario distinto — ninguno de los dos lo dice explícitamente. Se
construyó una sola vez, no dos.

### Qué quedó abierto

De los 51 criterios de `19`/`46`/`47`/`48`, unos 30 no cierran en este
corte:

- **`AC-AYUDA-01`** (toda cifra tiene procedencia navegable) — el criterio
  más transversal del corpus, y el más grande que queda fuera. `EvidenceLink`
  existe desde `W-17` pero solo lo usa el asistente; el panel de
  procedencia (`SCR-AYUDA-01`, "qué conté / qué no conté") no se construyó,
  y ninguna de las dieciséis pantallas de módulo lo usa todavía. Es
  correctamente un corte propio, no un descuido de este.
- **`RUL-AYUDA-05`/`SCR-ONB-03`** (explicación en sitio, nueve conceptos) —
  el componente genérico no se construyó; ninguno de los nueve existe.
- **Los diez tipos de notificación de `37` no tienen productor real
  conectado a `email_outbox`** — el trabajador y la política están listos
  y probados, pero nada llama a `enqueueEmail` todavía salvo la descarga
  lista. `AC-MAIL-01` (nunca sin consentimiento) y `AC-MAIL-11` (aviso en
  la app de dirección suprimida) no cierran por la misma razón.
- **`AC-MAIL-12`** (SPF/DKIM/DMARC) — evidencia `LIVE`, depende de un
  dominio real. No hay proveedor de correo configurado (`WEB-D285`).
- **`AC-VIDA-03` a `AC-VIDA-12`** (nombres de estado unificados en las
  dieciséis pantallas, `S/0.00` nunca sin explicar, bloques vacíos fuera
  del Inicio, 5.000 movimientos de prueba) — exigen una auditoría por
  pantalla que este corte no alcanzó; solo `AC-VIDA-01`/`AC-VIDA-02`
  (consistencia de corpus) cierran.
- **`AC-AYUDA-10`** (el asistente deriva a un artículo en vez de improvisar)
  — no se tocó el motor conversacional en este corte.
- Los criterios de `G3` de estos cuatro documentos no cierran: mismo
  patrón que todos los cortes desde `W-14`, sin sesión `USER` ni cohorte
  `METRIC`.

No hubo sesiones `USER` ni serie `METRIC`.

### Documentos corregidos

- `46` §4.2/§4.3: migración `066`→`068` (`WEB-D283`).
- `46` `RUL-MAIL-03`: se aclara que "las cinco reglas" que ignoran los
  transaccionales son horario y límite, no supresión (`WEB-D282`).
- `46` §8: el webhook se declara en `/api/webhooks/email`, no bajo
  `/api/v1/*` (`WEB-D284`).
- `25`, `26`, `33` §12: tramos "pocos"/"muchos" corregidos con número
  (`WEB-D287`).
- `03_decisiones_producto_web.md`: `WEB-D282` a `WEB-D288` (siete
  decisiones nuevas; `WEB-D282` ya se había usado en código durante `W-18`
  sin registrarse aquí — corregido).
- `README.md`: `core/email-outbox/` añadido al árbol.
- `tests/lint/seg-04-404-no-403.test.ts`: 157→158 rutas.
- `55` (este documento): Bloque B (`W-08` a `W-15`) archivado a
  [`55b_ledger_archivo_bloque_b.md`](./55b_ledger_archivo_bloque_b.md) —
  el documento se acercaba de nuevo a 2.000 líneas (`RUL-LEDGER-03`).

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
