# 55 — Ledger de construcción de la app web

**Bloque:** 07 — Calidad y ejecución
**Alcance:** V1
**Estado:** vivo
**Fecha de última actualización:** 2 de agosto de 2026
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

**La construcción avanza.** `W-01` a `W-14` cerraron `G1`. Ninguno tiene
criterios de `G3` propios cerrados. En `W-13` y `W-14`, “verificado” incluye
la parte `TEST` que el criterio realmente cubre; las mitades `USER` sin
sesión y los criterios explícitamente diferidos siguen marcados como
abiertos en sus documentos. `W-14` es el primer corte que, además, retira
`Evidencia:` falsa donde no correspondía: varios criterios de `35`/`37`/`38`
tenían `TEST` declarado desde su redacción original sin que nada los
verificara — se corrigieron a `No cierra: <razón>` conservando el nivel de
evidencia que sí les toca, no ocultándolo (ver `W-14` §"qué sorprendió").

| | |
|---|---|
| Cortes cerrados | 14 de 20 |
| Criterios `verificado` | 225 de 708 |
| Criterios `validado` | 0 de 135 |
| Sesiones con usuarios | 0 |
| Series abiertas | 0 |

Esta tabla se actualiza con cada corte y es lo primero que se lee.

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
commit sustantivo: `56d1e62` (hash real registrado en el commit de seguimiento de este cierre).

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

## W-14 — Recordatorios in-app, Búsqueda y Reportes/exportación

**Cerrado:** 2026-08-02
**Portones:** G1 ✓ (parcial, ver abajo) · G2 no aplica a este corte · G3 no
cierra: no hubo sesiones `USER` ni cohorte para `METRIC`
**Matriz regenerada:** 2026-08-02, con `npm run matriz:generar`; hash del
commit sustantivo: `b63e8a1` (hash real registrado en el commit de
seguimiento de este cierre).

### Qué se entregó

Recordatorios (`37`): tabla `in_app_notifications` nueva con su propio ciclo
de vida (`WEB-D247`, no se reutiliza `nudge_candidates`), ocho triggers
`AFTER` en Postgres que resuelven un recordatorio en la misma transacción
que la escritura que resuelve su causa (cuotas, deudas, ocurrencias
recurrentes, reglas canceladas, presupuestos, pendientes, correo,
movimientos), un índice único que impide dos recordatorios abiertos con el
mismo `subject_key`, un evaluador diario (`reminder-engine.ts` +
`reminders-evaluate.repository.ts`, plantilla del Insight Engine de `W-13`)
para los tipos de escaneo, y siete RPC de acción (leer, posponer, descartar,
preferencia, pausar, reanudar). Nueve rutas de API y dos pantallas
(`/recordatorios`, `/configuracion/recordatorios`), más el badge en la
navegación.

Búsqueda (`38`): parser determinista de consultas (mes, relativo, rango,
monto, pregunta vs. búsqueda — `RUL-BUS-03/04`), reutiliza `search_vector`
de la migración `052` (W-09) en vez de duplicar el índice de texto
(`WEB-D249`), sugerencia ortográfica por distancia sobre los comercios
propios, y siete rutas de API. `/buscar` se reconstruyó entera reemplazando
`natural-search-screen.tsx` (`WEB-D164`); la paleta de comandos (`Ctrl+K`)
queda sin interfaz — ver "qué quedó abierto".

Reportes y exportación (`35`): el agregado por categoría reutiliza
literalmente `movementCountsForBudget` de Presupuestos (`RUL-REP-01`,
verificado con `RUL-HECHO-02`), `GET /reports/period`/`compare`/`chart` (un
solo gráfico de los cinco), `saved-reports`, y el flujo de exportación
completo: `POST /exports` (RPC idempotente), un worker que genera CSV
(`RUL-REP-10`, formato RFC 4180 con BOM) o el JSON de datos completos, sube
a un bucket privado de Storage y un enlace firmado de un solo uso a 15
minutos. `/reportes` y `/configuracion/datos` tienen pantalla real.

Dos migraciones nuevas (`063`, `064`) con números reales: las reservas
documentales `051`/`053`/`062`/`063` de `13`/`35`/`37`/`38` estaban todas
obsoletas, no solo `062`/`063` como anticipaba `WEB-D245` (`WEB-D246`).
Cinco decisiones nuevas (`WEB-D246` a `WEB-D249` más la reafirmación de
`WEB-D164` sobre `natural-search-screen.tsx`). 63 pruebas nuevas: 44
unitarias (`reminder-engine`, `report-engine`, `query-parser`,
`spelling-suggestion`, `csv-export`, `computeReminderStatus`), 22
end-to-end contra Postgres real (`w14-reminders-and-search.test.ts`,
`w14-reminders-evaluate.test.ts`), 18 de ruta API. RLS completa: 18 archivos,
284/284. `npx tsc --noEmit` y `npx eslint .` en verde. `npm run build`
compila y genera 42 páginas, con las 22 rutas nuevas de `W-14` visibles en
la salida. `npm test`: 326/327 archivos y 2154/2155 pruebas por el mismo
timeout frío conocido de `movements/route.test.ts` desde `W-09`; aislado con
`--testTimeout=20000` pasa 6/6.

### Qué sorprendió

La primera, y la más cara de verificar: `WEB-D245` (cerrada en `W-13`) solo
había detectado la colisión de `062`/`063`. Al confirmar contra el árbol
real de `supabase/migrations/` para este corte, `051`
(`13` §7.4, tablas de reportes) y `053` (`13` §7.6, `in_app_notifications`)
**también** estaban ocupadas por migraciones reales de `W-09` y `W-10` sin
relación alguna — ninguna de las tres tablas nuevas de este corte existía
todavía en ningún lado. `WEB-D246` documenta las cinco reservas obsoletas de
una vez, no una por una.

La segunda, arquitectónica: `13` §7.6 y `37` §4.1 daban por hecho que
bastaba con "ampliar el canal" de `nudge_candidates`/`nudge_deliveries`
existentes. Al leer el motor real (`src/core/nudges/`), sus doce estados de
`nudge_status` y su `NudgeType` no cubrían cuatro de los diez tipos de `37`
ni tenían un equivalente de "resuelto"/"pospuesto", y el propio inventario
de reutilización ya lo marcaba "ADAPTAR", no "reutilizar literal". Forzarlo
habría arriesgado el aviso proactivo de WhatsApp ya en producción.
`WEB-D247` construye `in_app_notifications` como tabla nueva y solo
reutiliza `nudge_preferences` (consentimiento) y `nudge_deliveries`
(rastreo de envíos de correo).

La tercera, encontrada al escribir el primer test de integración: regenerar
`src/data/supabase/types.ts` con la CLI de Supabase actual cambió la
nulabilidad declarada de nueve argumentos de RPC ya existentes
(`commit_budget_operation`, `commit_goal_operation`, `run_budget_daily_lifecycle`,
`list_recurring_generation_user_ids`) sin que ningún esquema hubiera
cambiado — una diferencia de versión de la CLI, no una migración real. Se
detectó con `git diff` antes de aceptar el archivo regenerado y se
parchearon a mano las nueve líneas para conservar exactamente el
comportamiento anterior, en vez de dejar que una regeneración de rutina
alterara nueve funciones que este corte no tocó.

La cuarta: al escribir las anotaciones de `§20`, quitar la línea
`Evidencia:` de un criterio que pasaba a "No cierra" sacaba a esas filas del
recuento de portones (`G1`/`G2`/`G3`) de la matriz sin que ningún test lo
notara al principio — el generador cuenta el portón de un criterio a partir
de su nivel de evidencia declarado, no de si cierra. Descubierto porque
`G1+G2+G3` dejó de sumar `708` tras la primera regeneración; se restauraron
las 25 líneas `Evidencia:` que correspondían, conservando la explicación de
por qué no cierran. El patrón correcto —confirmado leyendo `27` §20, ya
cerrado desde `W-10`— es mantener `Evidencia:` y añadir `No cierra: <razón>`,
nunca omitir la evidencia.

La quinta: verificar en navegador contra `NEXT_PUBLIC_SUPABASE_URL` de
`.env.local` (un proyecto de staging) devolvió `500` en `GET /reminders` y
`403` en la escritura, mientras que `GET /reports/period` sí respondía
`200`. Investigado antes de asumir un bug propio: las tres tablas nuevas
existen en el Postgres de staging (confirmado con el cliente de
servicio), pero el caché de esquema de PostgREST ahí no se había
refrescado — `PGRST205`, "no encuentro la tabla" sobre una tabla que sí
existe. El `403` de escritura fue un origen no permitido de esa misma
sesión de staging, no de la ruta. Verificado en su lugar contra Supabase
local con un `.env.development.local` temporal (nunca comprometido): las
mismas rutas devolvieron `200` con datos reales de principio a fin
(recordatorio creado, contado, marcado leído; búsqueda de "netflix"
encontrando el movimiento sembrado; el reporte de agosto agregando el gasto
correcto). No se intentó `db push` a staging — mismo límite que cortes
anteriores.

### Qué quedó abierto

Backend con gaps reales, documentados criterio por criterio en `§20` de los
tres módulos en vez de en silencio: el envío real de correo no existe
(`WEB-D248`, `46`/`W-19` lo construye); la exportación de movimientos carga
hasta 50.000 filas en memoria en vez de transmitir por lotes
(`AC-REP-12`, contradice `RUL-REP-12` tal como está escrito — candidato a
deuda de `53`); el agregado de reportes suma en JavaScript, no con
`group by` en SQL (`AC-REP-18`); no hay worker que borre archivos de
Storage al caducar (`AC-REP-14`); la paleta de comandos (`Ctrl+K`,
`SCR-BUS-01`) no tiene interfaz, solo backend; solo uno de los cinco
gráficos de `RUL-REP-05` tiene pantalla; ni `/reportes` ni la búsqueda
sincronizan sus filtros completos con la URL; el modo discreto no está
conectado a `/reportes`; y `AC-NOTIF-17` (aprendizaje de descartes
repetidos) no se construyó. Ninguno de estos se reportó como cerrado.

No hubo sesiones `USER` ni serie `METRIC`. `AC-DEUDA-06`: la sorpresa cuarta
de arriba (regenerar tipos altera nulabilidad de RPC ajenas) sugiere que
`51`/`54` deberían advertir explícitamente sobre revisar el `git diff` de
`types.ts` tras cualquier regeneración, no solo tras crear tablas —
ningún documento lo decía antes de este corte.

### Documentos corregidos

- `37` §20: los veinte criterios anotados contra código y pruebas reales;
  ocho quedaron con `Evidencia: TEST` + `No cierra: WEB-D248` (envío de
  correo real, `12`–`15`) tras restaurar la evidencia que una primera
  redacción había quitado por error (ver "qué sorprendió").
- `38` §20: diecinueve criterios anotados; nota de alcance nueva que separa
  `SCR-BUS-02`/`03` (construidos) de `SCR-BUS-01` (sin interfaz).
- `35` §20: veinte criterios anotados; nota de alcance nueva; `AC-REP-12` y
  `AC-REP-18` documentados como contradicción real con lo construido, no
  como pendiente neutro.
- `50` §3.1: censo regenerado (309 con clase, no 295; `integracion` 81, no
  76; `unidad` 118, no 109; portón `563/10/135`, no `558/11/139` — la
  corrección de `Evidencia:` de la cuarta sorpresa mueve algunos criterios
  entre portones sin cambiar el total de `708`).
- `tests/corpus/matriz.test.ts`: expectativas de censo y portón actualizadas.
- `tests/lint/seg-04-404-no-403.test.ts`: conteo de rutas actualizado a 142
  (22 nuevas de `W-14`).
- `tests/lint/readme-arbol-real.test.ts` / `README.md`: `core/reminders/`,
  `core/reports/`, `core/search/` documentados en el árbol real.
- `scripts/gates/service-role-lista.ts`: `v1/exports/*/link` añadido a la
  lista blanca permanente (enlace firmado de Storage, `15` §4).
- `03_decisiones_producto_web.md`: `WEB-D246` a `WEB-D249` (nuevas).

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
