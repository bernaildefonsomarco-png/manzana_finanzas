# 54 — Plan de implementación de la aplicación web

**Bloque:** 07 — Calidad y ejecución
**Alcance:** V1
**Fecha:** 26 de julio de 2026
**Docs fuente:** los 53 documentos anteriores. En particular `49` (portones), `50` (matriz), `51` (pruebas), `52` (veredictos), `53` (deuda)
**Documentos que dependen de este:** `55` (ledger), `56` (puente a WhatsApp)

---

## 1. Qué es este documento

Es el que convierte 53 documentos en trabajo con orden, y el primero del
corpus cuyo destinatario no es un lector sino **alguien que va a escribir
código mañana**.

Veinte cortes, `W-01` a `W-20`. Cada uno declara qué entrega, qué necesita
cerrado antes, qué documentos implementa y cómo se sabe que terminó. No hay
estimaciones de tiempo: el corpus no tiene datos para producirlas y una
estimación inventada solo sirve para incumplirse.

**Lo que este documento no hace es repartir los 707 criterios uno por uno.**
Cada corte declara qué documentos implementa; la matriz del `50` deriva qué
criterios son. Mantener a mano un mapeo de 707 filas sería el sexto caso del
mismo defecto que este corpus lleva encontrando desde el `40`.

---

## 2. Cómo se declara un corte

```text
W-NN — Nombre

Entrega       Una frase. Lo que un usuario o un test puede comprobar
Implementa    Documentos del corpus, no tareas
Precondición  Cortes que deben estar cerrados
Paga          Deudas de 53 que salda
Cierra        G1 y G2. Los G3 pasan a `verificado, sin validar`
```

**`RUL-PLAN-01` — Un corte entrega algo comprobable, no un porcentaje.** Si
la entrega no se puede enunciar como *"ahora se puede X"* o *"ahora falla si
Y"*, no es un corte: es una fase de proyecto disfrazada.

**`RUL-PLAN-02` — Un corte no se cierra sin regenerar la matriz.** `AC-TRAZ-12`
exige una regeneración posterior al último commit del corte. Sin ella, el
estado de los criterios es una opinión.

**`RUL-PLAN-03` — Un corte no empieza si su precondición tiene un `G1`
abierto.** `WEB-D146`: los portones no se cierran parcialmente.

---

## 3. Los cuatro bloques

```text
A. Cimientos          W-01 … W-07    Nada funcional. Todo lo demás depende
B. Módulos            W-08 … W-15    El producto que se vende
C. Motor y asistente  W-16 … W-17    La inteligencia
D. Cierre             W-18 … W-20    Entrada, salida y validación
```

**El bloque A no entrega ninguna función de producto y es el que decide si el
resto sale bien.** Es la parte que la construcción anterior se saltó, y por eso
hay 17 modales a mano, cero rutas y 48 rutas esquivando RLS. Saltárselo otra
vez produciría exactamente el mismo resultado con más código.

### 3.1 Qué corte es dueño de cada documento

`AC-PLAN-05` exige que **todo documento con criterios tenga exactamente un
corte dueño**. Los 53 que los tienen:

| Corte | Documentos |
|---|---|
| `W-01` | `06`, `07`, `49`, `50`, `52`, `53`, `54`, `56` |
| `W-02` | `13`, `15` |
| `W-03` | `51` |
| `W-04` | `21` |
| `W-05` | `14` |
| `W-06` | `16`, `18` |
| `W-07` | `08`, `10`, `11`, `12`, `17` |
| `W-08` | `09`, `24`, `25` |
| `W-09` | `26` |
| `W-10` | `27`, `28`, `29` |
| `W-11` | `30`, `31` |
| `W-12` | `32`, `33` |
| `W-13` | `34`, `36` |
| `W-14` | `35`, `37`, `38` |
| `W-15` | `39` |
| `W-16` | `20`, `20b`, `20c`, `22`, `23`, `40`, `42` |
| `W-17` | `41` |
| `W-18` | `43`, `44`, `45` |
| `W-19` | `19`, `46`, `47`, `48` |
| `W-20` | `55` |

Los seis de `00_gobierno/` no aparecen: gobiernan el proceso de escritura y no
tienen criterios.

**`RUL-PLAN-04` — Ser dueño de un documento y cerrar un criterio suyo son
cosas distintas.** El documento tiene un solo corte dueño, que es quien
responde de que quede implementado entero. Pero un corte anterior puede cerrar
criterios sueltos de ese documento, y la matriz registra cuál lo hizo.

Cuatro casos reales, y los cuatro son deliberados:

| Criterio | Lo cierra | El documento es de |
|---|---|---|
| `AC-RT-01` — el proceso no arranca con motor de prueba en producción | `W-02` | `W-16` |
| `AC-REU-06` — el arranque falla si `production_safe` es falso | `W-02` | `W-16` |
| `AC-INV-03`, `AC-INV-04` — el canal fuera del núcleo | `W-04` | `W-01` |
| `AC-PRUEBA-05` — la prueba de aislamiento por tabla existe y pasa | `W-02` | `W-03` |

Los dos primeros son gates de seguridad que no pueden esperar al corte del
motor. El tercero es la auditoría de canal, que tiene corte propio aunque su
documento sea el inventario. El cuarto es la misma prueba de aislamiento que
`AC-SEG-02`: vive conceptualmente en `51` (estrategia de pruebas, `W-03`),
pero es exactamente lo que `D-03` exige pagar junto con `D-02`, así que
cierra en `W-02` y no espera a que `W-03` construya el resto de la
infraestructura de pruebas.

---

## 4. Bloque A — Cimientos

### `W-01` — La verdad del repositorio

| | |
|---|---|
| **Entrega** | El repositorio describe lo que contiene, y existe la herramienta que lo comprueba |
| **Implementa** | `50`, `52`, `53`; y las aserciones sobre el corpus de `06`, `07`, `49`, `54`, `56` |
| **Precondición** | Ninguna |
| **Paga** | `D-05` (dos ramas), `D-10` (README), `D-11` (carpetas). `D-12` ya resuelta |
| **Cierra** | `AC-INV-07`, `AC-INV-08`, `AC-INV-09`, `AC-INV-10`, `AC-DEUDA-04`, `AC-DEUDA-08`, `AC-TRAZ-01` a `AC-TRAZ-03` |

Contenido concreto:

1. **El generador de la matriz** (`50` §8) y los tests de clase `corpus`. Van
   aquí y no en `W-03` por una razón de arranque: `RUL-PLAN-02` exige
   regenerar la matriz para cerrar cualquier corte, **incluido este**. Sin el
   generador, `W-01` no puede cerrarse y el plan entero se queda parado en la
   primera casilla. Es además un script que lee ficheros de texto: no necesita
   nada de la aplicación.
2. `supabase/migrations/` como rama única y `migrations.test.ts` leyendo de
   ella.
3. Borrar las seis carpetas con solo `.gitkeep` —`(dashboard)` entre ellas— y
   conservar las cuatro que el diseño llenará.
4. Corregir las ocho afirmaciones falsas del `README.md`.
5. Completar `PUBLIC_PATHS` del proxy con las ocho rutas públicas que faltan.

**Lo que este corte NO hace: la redirección de `/`.** `WEB-D151` la fija, pero
hoy `src/app/page.tsx` renderiza `AuthScreen` sin sesión y `DashboardApp` con
ella, y **ni `/entrar` ni `/inicio` existen todavía**. Implementarla aquí
dejaría la aplicación inalcanzable. Se implementa en `W-07`, que es el corte
que crea los dos destinos. Completar `PUBLIC_PATHS` sí es seguro: añadir a una
lista de exclusión rutas que aún no existen no rompe nada.

**`AC-TRAZ-04` no está en lo que este corte cierra (`WEB-D167`).** Es
agregado: su conjunto son las 119 superficies `SCR-`, y hoy solo 37 declaran
su línea `**Ruta:**`. Las 82 restantes viven en documentos de `W-08` a
`W-19`, no en los de `W-01`. Este corte entrega el generador y el test que lo
miden — hoy en 37/119 — y cada corte de módulo lo acerca al cierre cuando
etiqueta las suyas.

Es el corte más pequeño y va primero porque **todo lo demás se apoya en creer
lo que el repositorio dice** — y ahora también en poder comprobarlo.

### `W-02` — RLS y arranque seguro

| | |
|---|---|
| **Entrega** | El build falla si una ruta esquiva RLS sin justificación, y si el motor de prueba puede servir en producción |
| **Implementa** | `13`, `15`. Cierra además `AC-RT-01` y `AC-REU-06`, cuyos documentos son de `W-16` (`RUL-PLAN-04`) |
| **Precondición** | `W-01` |
| **Paga** | `D-03`, `D-04`. De `D-02` paga la parte verificable ahora — ver abajo |
| **Cierra** | `AC-SEG-01` a `AC-SEG-04`, `AC-RT-01`, `AC-REU-06`, `AC-PRUEBA-05` |

**Este corte NO migra las 48 rutas a cliente autenticado (`WEB-D168`).** `15`
§9 es explícito: esa migración va acoplada al rediseño de paginación y
filtros de `14`, en `W-05` y en cada corte de módulo — "tocarlas dos veces
sería peor". Lo que `W-02` entrega es la lista blanca permanente (para las 14
rutas fuera de `/api/v1` que de verdad no tienen sesión de usuario) más las
48 rutas declaradas como **excepciones temporales justificadas**, y el test
que falla el build si aparece una importación sin ninguna de las dos
justificaciones. Con eso, `AC-SEG-01` ya es verificable hoy: no exige que la
lista esté vacía, exige que **todo lo que esquiva RLS lo haga con
justificación registrada**.

Una prueba de aislamiento por tabla, con los cuatro asertos de `51` §8,
contra una base de datos de prueba real — no depende de qué cliente use la
ruta, así que cierra completa en este corte (`AC-SEG-02`, `AC-SEG-03`).
`AC-SEG-04` (404 nunca 403) cierra como criterio agregado sobre el conjunto
de rutas que ya devuelven ese contrato hoy; las que se rediseñen después lo
heredan al migrar. Gates de arranque para `local_fixture` y
`production_safe`.

**Lo que este corte NO cierra, y por qué:** `AC-SEG-05` (mensajes de
autenticación) es de `W-18`, doc `43`. `AC-SEG-06` (sin datos sensibles en
registros) es de `W-19`, doc `19`. `AC-SEG-08` (CSRF) ya estaba asignado por
`53` §3 a `D-09` → `W-05`; `54` lo repetía aquí por error. `AC-SEG-07` (la
lista de excepciones temporales vacía) es agregado: no tiene corte propio,
cierra cuando la última ruta sale de la lista, en el corte que la migre —
mismo patrón que `AC-TRAZ-04` (`WEB-D167`).

**Va antes que cualquier módulo, y esa es la única decisión de orden de este
plan que no admite discusión.** `R-01` declara el riesgo aceptable solo
mientras no haya usuarios reales.

### `W-03` — Infraestructura de pruebas

| | |
|---|---|
| **Entrega** | Cinco comandos de prueba, cobertura medida por primera vez, y ocho reglas de lint que fallan |
| **Implementa** | `51` completo |
| **Precondición** | `W-01` |
| **Paga** | `D-06` (cobertura), `D-07` (navegador) |
| **Cierra** | `AC-PRUEBA-01`, `AC-PRUEBA-06`, `AC-PRUEBA-07`, `AC-PRUEBA-08`, `AC-PRUEBA-10`, `AC-PRUEBA-11`, `AC-PRUEBA-12` |

Vitest partido en proyectos según `51` §10; `@vitest/coverage-v8` instalado y
`include` sobre todo `src/`; Playwright instalado con los doce recorridos
declarados aunque vacíos; las ocho reglas de lint de `51` §6.4; los tests de
clase `corpus`.

`W-02` y `W-03` pueden ir en paralelo: no se tocan.

### `W-04` — El canal sale del núcleo

| | |
|---|---|
| **Entrega** | La prueba de agnosticismo del `21` compila y pasa |
| **Implementa** | `21`. Cierra `AC-INV-03` y `AC-INV-04`, del `52`, que es de `W-01` (`RUL-PLAN-04`) |
| **Precondición** | `W-03` (la prueba necesita dónde vivir) |
| **Paga** | `D-01` |
| **Cierra** | `AC-CANAL-01` a `AC-CANAL-09`, `AC-INV-03`, `AC-INV-04` |

28 ficheros de `src/core/` y 15.196 líneas a auditar. Los seis que llevan el
canal en el nombre se mueven a un presentador o se generalizan.

**Va antes de los módulos aunque duela**, porque los módulos van a adaptar
esas mismas partes de `core/` y hacerlo dos veces cuesta más que hacerlo bien
una. Es el corte con más riesgo de desbordarse, y por eso su criterio de
cierre es binario: un test que hoy no se puede escribir, después sí.

### `W-05` — Contratos de API

| | |
|---|---|
| **Entrega** | Todo listado pagina por cursor, filtra en servidor, y rechaza escrituras de otro origen |
| **Implementa** | `14` completo |
| **Precondición** | `W-02` |
| **Paga** | `D-09` (límite y CSRF) |
| **Cierra** | `AC-API-01` a `AC-API-10` |

### `W-06` — Sistema de diseño

| | |
|---|---|
| **Entrega** | Existen las 18 primitivas que faltan y `modal-accessibility-guard.tsx` ha desaparecido |
| **Implementa** | `16`, `18` |
| **Precondición** | `W-03` (las reglas de lint del sistema de diseño) |
| **Paga** | La causa de los 17 modales a mano |
| **Cierra** | `AC-DS-01` a `AC-DS-10`, `AC-A11Y-01` a `AC-A11Y-10` |

El guard de accesibilidad es un `MutationObserver` global que parchea diálogos
mal construidos. Desaparece porque deja de haber diálogos mal construidos, no
porque se borre.

### `W-07` — Esqueleto y patrones

| | |
|---|---|
| **Entrega** | Cada pantalla tiene URL propia, el botón atrás funciona, y ninguna pantalla implementa a mano su obtención de datos |
| **Implementa** | `08`, `10`, `11`, `12`, `17` |
| **Precondición** | `W-05`, `W-06` |
| **Paga** | El router manual |
| **Cierra** | `AC-NAV-01` a `AC-NAV-08`, `AC-ARQ-01` a `AC-ARQ-08`, `AC-PAT-01` a `AC-PAT-10`, `AC-EXP-*`, `AC-CONFIANZA-*` |

Grupos `(publico)` y `(app)`, rutas interceptadas para los detalles,
`loading.tsx` y `error.tsx` por segmento. Se elige aquí la librería de
obtención de datos, la de formularios y la de fechas —las tres que `12` §2
declara necesarias—. `dashboard-app.tsx` desaparece.

**Aquí entra la redirección de `/`** (`WEB-D151`), porque es el corte que crea
sus dos destinos: `/inicio` dentro de `(app)` y `/entrar` dentro de
`(publico)`. La pantalla de entrada se mueve tal cual desde
`src/app/page.tsx`; **mejorarla es `W-18`**, moverla es aquí. Sin este paso el
producto se quedaría sin puerta de entrada entre `W-07` y `W-18`.

**Aquí termina el bloque A.** A partir de este punto cada corte entrega
producto.

---

## 5. Bloque B — Módulos

El orden lo fijan las dependencias del corpus, no la preferencia. Cuentas
antes que movimientos porque un movimiento necesita una cuenta; pendientes
antes que sus productores porque `27` fija la regla que todos deben cumplir;
Inicio el último porque agrega a todos.

| Corte | Entrega | Implementa | Precondición |
|---|---|---|---|
| `W-08` | Se ven las cuatro capas del dinero y se clasifica lo que entra | `09`, `24`, `25` | `W-07` |
| `W-09` | Los once tipos de movimiento se guardan desde Movimientos | `26` | `W-08` |
| `W-10` | Nada se registra solo, y todo pendiente nace confirmable | `27`, `28`, `29` | `W-09` |
| `W-11` | Se ve qué se debe y qué viene, sin doble descuento | `30`, `31` | `W-10` |
| `W-12` | Se puede planear y preguntar "¿puedo permitirme X?" | `32`, `33` | `W-11` |
| `W-13` | Manzana encuentra cosas y recuerda lo aprendido, con control | `34`, `36` | `W-12` |
| `W-14` | Se puede mirar atrás, buscar y recibir recordatorios | `35`, `37`, `38` | `W-13` |
| `W-15` | El Inicio responde "¿dónde estoy?" en una pantalla | `39` | `W-14` |

### 5.1 Lo que cada corte de módulo incluye sin decirlo

Todo corte de módulo entrega, además de su §8 y su §9:

- Sus endpoints con los cinco casos de `51` §6.2.
- Su prueba de RLS si añade tablas.
- Sus `RUL-` con ejemplo numérico convertidas en pruebas (`RUL-PRUEBA-02`).
- Sus estados de `47`: vacío, temprano, funcional, completo.
- Su procedencia, con el componente único de `48`.
- Los casos borde extraídos de la pantalla que reemplaza (`RUL-INV-01`).

**El último punto es el que se olvida.** Antes de borrar `debts-screen.tsx`
hay que leer sus 1.421 líneas y llevarse lo que sabe sobre conciliación de
deudas al §19 del módulo `31`.

### 5.2 Los cortes de módulo no se paralelizan

`W-08` a `W-15` van en serie. Cada uno consume lo que el anterior declaró:
`26` usa las cuentas de `24` y las categorías de `25`; `30` y `31` usan la
bandeja de `27`; `33` consume `total_no_cubierto` de `30`; `39` consume a
todos.

Dentro de un corte sí hay paralelo —`30` y `31` se pueden repartir entre dos
personas—, pero **el corte no cierra hasta que ambos cierran**, porque su
entrega es conjunta.

---

## 6. Bloque C — Motor y asistente

| Corte | Entrega | Implementa | Precondición |
|---|---|---|---|
| `W-16` | El motor responde con evidencia y no ejecuta nada sin confirmar | `20`, `20b`, `20c`, `22`, `23`, `40`, `42` | `W-15`, `W-04` |
| `W-17` | Se le puede pedir hablando lo mismo que se hace con el ratón | `41` | `W-16` |

**`W-16` va después de los módulos**, no antes, por la misma razón por la que
el `40` se escribió después: el catálogo de comandos se agrega desde las §14
de los dieciséis módulos, y agregar desde módulos que no existen produce un
catálogo que hay que rehacer.

Aquí se emiten los veredictos pendientes de `42` §8 sobre los ocho ficheros
que quedaron sin decidir (`AC-REU-10`, `R-02`). No antes: se leen enteros
cuando toca tocarlos.

---

## 7. Bloque D — Cierre

| Corte | Entrega | Implementa | Precondición |
|---|---|---|---|
| `W-18` | Se puede entrar, recuperar la contraseña y llegar al primer valor | `43`, `44`, `45` | `W-15` |
| `W-19` | Toda cifra se explica, y nada sale por correo sin permiso | `46`, `47`, `48`, `19` | `W-18` |
| `W-20` | Los criterios de `G3` se cierran con usuarios y con series | `55`, y los protocolos de `49` §8 y §9 | `W-19` |

### 7.1 Por qué auth va casi al final

Porque **ya funciona**. Registro, login y verificación existen y se usan; lo
que falta es recuperación de contraseña, `/auth/callback` y errores en español
(`C-13`). Adelantar `W-18` significaría reescribir la pantalla de entrada
antes de tener el sistema de diseño y las primitivas, y volver a tocarla
después.

Lo único de auth que va antes es la parte de sesión del proxy, y esa está en
`W-01`.

### 7.2 `W-20` no construye

Es el único corte cuyo trabajo no es código: es ejecutar el protocolo de
`USER` de `49` §8 —tres personas, tarea sin ayuda, registro de las que
fallaron— sobre los 139 criterios de `G3`, y abrir las ventanas de observación
de `37` y `46` (`WEB-D159`).

**Puede empezar antes de terminar `W-19`.** Un criterio de `G3` cuyo corte ya
cerró `G1` se puede validar aunque el resto siga en marcha; de hecho debe,
porque esperar al final concentra todos los hallazgos de usabilidad en el peor
momento para atenderlos.

---

## 8. El grafo completo

```text
W-01 ──┬── W-02 ── W-05 ──┐
       │                  ├── W-07 ── W-08 ── W-09 ── W-10 ── W-11 ──
       └── W-03 ──┬─ W-06 ┘                                          │
                  │                                                   │
                  └─ W-04 ─────────────────────────┐                 │
                                                    │                 │
   ── W-12 ── W-13 ── W-14 ── W-15 ──┬── W-16 ──────┴── W-17          │
                                     │                                │
                                     └── W-18 ── W-19 ── W-20 ────────┘
```

**Tres aristas que no se pueden invertir:**

| Arista | Por qué |
|---|---|
| `W-02` antes de todo módulo | Riesgo aceptado solo mientras no haya usuarios |
| `W-04` antes de `W-16` | El motor no se puede probar agnóstico contra un núcleo acoplado |
| `W-15` antes de `W-16` | El catálogo se agrega desde módulos que deben existir |

**Y una que sí se puede, con condición:** `W-18` (auth y onboarding) puede
adelantarse si hay dos personas y una se queda sin trabajo, siempre que `W-07`
esté cerrado. Su única dependencia real es el sistema de diseño.

---

## 9. Qué se elige y cuándo

`12` §2 declara cuatro responsabilidades que no se resuelven a mano. Las
marcas se eligen aquí:

| Responsabilidad | Se elige en | Criterio de elección |
|---|---|---|
| Obtención de datos con caché | `W-07` | Soporte de Server Components de Next 16, invalidación por clave, sin adaptadores propios |
| Formularios con Zod | `W-07` | El esquema del servidor se reutiliza sin duplicar |
| Fechas con zona horaria | `W-07` | `America/Lima` sin horario de verano, aritmética de meses correcta |
| Gráficos accesibles | `W-14` | Navegable por teclado, tabla equivalente, sin `canvas` opaco |

**La de gráficos se elige tarde a propósito.** Es la única que no bloquea
nada hasta el módulo `35`, y elegirla antes es comprometerse sin necesidad.

`WEB-D165` — **Ninguna de las cuatro se elige sin escribir antes el caso más
difícil que tendrá que resolver.** Para fechas es el movimiento de las 23:30
hora de Lima (`AC-PAT-10`); para gráficos, la tabla equivalente accesible; para
formularios, el modal de movimiento con sus once tipos; para obtención de
datos, el listado con cursor y deshacer optimista.

---

## 10. Prompt de corte

Cada corte se puede encargar a una persona o a un agente con este texto. No
es una plantilla decorativa: es lo que hace que el corpus sirva de algo.

```text
Implementa el corte W-NN de documentacion/app_web/54_plan_de_implementacion_web.md.

ANTES DE ESCRIBIR CÓDIGO
1. Lee los documentos que el corte declara en "Implementa". Enteros.
2. Lee 49 §4 (portones), §10 (reglas anti-autoengaño) y 51 §4 (clases de prueba).
3. Comprueba que las precondiciones del corte están cerradas en la matriz del 50.
   Si alguna tiene un criterio G1 abierto, para y dilo.

MIENTRAS
4. Cada RUL- con ejemplo numérico se convierte en una prueba que usa ese ejemplo.
5. Cada endpoint lleva los cinco casos de 51 §6.2, incluido el 404 de otro usuario.
6. Cada criterio que implementes recibe su clase de prueba según el árbol de 51 §4.
7. Antes de dar por buena una prueba, revierte el cambio que implementa su
   criterio y comprueba que la prueba FALLA (RUL-HECHO-02).

NO HAGAS
- No inventes reglas de producto. Si el documento no lo dice, pregunta.
- No copies un criterio transversal de 14-19, 47 o 48 al módulo (WEB-D148).
- No arregles nada de un fichero con veredicto REEMPLAZAR o DESCARTAR en el 52.
- No marques ningún test como skip.

AL TERMINAR
8. Regenera la matriz del 50 y comprueba que no queda ningún ID sin resolver.
9. Los criterios G3 del corte pasan a "verificado, sin validar" con dueño y fecha.
10. Anota en el ledger 55: qué entregaste, qué te sorprendió, qué quedó abierto.

El corte está cerrado cuando G1 y G2 pasan. G3 no lo bloquea (WEB-D144).
```

**El punto 7 es el que distingue un corte hecho de un corte marcado.** Y el
punto 10 no es burocracia: el `23b` del corpus anterior se detuvo el 23 de
julio y por eso cinco migraciones quedaron sin documentar durante meses.

---

## 11. Lo que puede salir mal

Cuatro riesgos concretos, con lo que se hace si aparecen.

**`W-04` se desborda.** 15.196 líneas a auditar es la estimación más
incierta del plan. Si a mitad del corte la prueba de agnosticismo sigue sin
compilar, la salida **no** es aceptar un núcleo medio acoplado: es partir el
corte por subsistema —orquestador, respuesta, aprendizaje— y cerrar cada parte
con su propio test.

**Un módulo descubre que su documento está mal.** Pasará, y es sano: significa
que alguien está leyendo. El documento se corrige y la corrección va al
decision log, con el criterio anterior marcado `retirado`. Lo que no puede
pasar es `RUL-HECHO-04`: reescribir un criterio en silencio hasta que el
código lo cumpla.

**Los 544 criterios sin clase se convierten en un cuello de botella.** No
deberían: la clase se asigna al escribir cada prueba, no en un ejercicio
previo. Si alguien intenta clasificarlos todos antes de empezar, está
haciendo el trabajo que `51` §4.1 explica por qué no funciona.

**El bloque A se percibe como tiempo perdido.** Siete cortes sin una sola
función nueva. Es exactamente lo que la construcción anterior evitó, y el
resultado fue 14.072 líneas de pantallas sin rutas ni primitivas. La defensa
no es argumentar: es que `W-07` cierra con el botón atrás funcionando, y eso
se ve.

---

## 12. Criterios de aceptación

- `AC-PLAN-01` — Todo corte declara entrega comprobable, documentos que
  implementa, precondición y deudas que paga. Evidencia: `TEST`.
  Clase: `corpus`.
- `AC-PLAN-02` — Ningún corte se declara cerrado con un criterio de `G1` en
  estado distinto de `verificado` o `derivado`. Evidencia: `TEST`.
  Clase: `build`.
- `AC-PLAN-03` — Todo corte cerrado tiene una regeneración de la matriz
  posterior a su último commit. Evidencia: `DOC`.
- `AC-PLAN-04` — Ningún corte empieza con una precondición abierta.
  Evidencia: `TEST`. Clase: `corpus`.
- `AC-PLAN-05` — Todo documento del corpus con criterios está asignado a
  exactamente un corte. Evidencia: `TEST`. Clase: `corpus`.
- `AC-PLAN-06` — Las cinco deudas bloqueantes de `53` §2 están pagadas antes
  de que cierre `W-08`. Evidencia: `TEST`. Clase: `build`.
- `AC-PLAN-07` — Cada una de las cuatro librerías se elige con su caso difícil
  escrito antes. Evidencia: `DOC`.
- `AC-PLAN-08` — Todo corte tiene entrada en el ledger `55` con lo entregado,
  lo sorprendente y lo abierto. Evidencia: `DOC`.
- `AC-PLAN-09` — Ningún corte de módulo cierra sin haber extraído los casos
  borde de la pantalla que reemplaza. Evidencia: `DOC`.

---

## 13. Fuera de alcance

Este plan no estima tiempos ni asigna personas. No elige marcas concretas
—fija cuándo y con qué criterio se eligen—. No lleva el registro de lo
ocurrido, que es del `55`.

Y no planifica WhatsApp. `W-20` cierra la fase web; lo que sigue está en el
`56`.

---

## 14. Trazabilidad

| Elemento | Origen |
|---|---|
| Los tres portones y "hecho" | `49` §4 |
| Reglas anti-autoengaño | `49` §10 |
| Estados y matriz | `50` §4, §7 |
| Árbol de pruebas y clases | `51` |
| Veredictos sobre `src/` | `52` |
| Deuda bloqueante y con gate | `53` §2, §3 |
| Orden de dependencia entre módulos | `07` §3, y las §22 de cada módulo |
| Cuatro librerías necesarias | `12` §2 |
| Prueba de agnosticismo | `21` |
| Catálogo agregado desde las §14 | `40` §2 |
| Decisión nueva | `WEB-D165` |

| Documento que depende de este | Qué toma |
|---|---|
| `55_ledger_construccion_web.md` | Los veinte cortes como entradas a registrar |
| `56_puente_a_fase_whatsapp.md` | Qué queda listo al cerrar `W-20` |
