# 51 — Estrategia de pruebas de la aplicación web

**Bloque:** 07 — Calidad y ejecución
**Alcance:** V1
**Fecha:** 26 de julio de 2026
**Docs fuente:** `49_criterios_de_aceptacion_globales.md` (los criterios y las 8 clases), `50_matriz_de_trazabilidad_web.md` (el esquema), `15_seguridad_autorizacion_y_rls.md`, `23_runtime_ia_modos_costo_y_degradacion.md`
**Documentos que dependen de este:** `52` (inventario de código), `53` (deuda técnica), `54` (plan de implementación)

---

## 1. Qué es este documento

El `49` dejó, de las 625 que agregó, **567 exigiendo una prueba automatizada y
540 sin clase de prueba**. Con los criterios que este bloque ha ido añadiendo,
el censo vivo del `50` §3.1 cuenta **600 con `TEST` y 542 sin clase**. Este
documento reparte esas 542, define dónde vive cada clase, y fija las reglas
que impiden que la suite mienta.

No propone una pirámide de pruebas ni un porcentaje de cobertura. El objetivo
está fijado desde el `49` y es **nominal, no porcentual**: cada criterio con
`TEST` tiene una prueba con nombre. Un 80 % de cobertura sobre código que nadie
especificó no dice nada; seiscientos criterios verificados sí.

---

## 2. El punto de partida, medido

Ejecutado el 26 de julio de 2026 sobre el árbol actual. No son estimaciones.

| Medida | Valor |
|---|---|
| Ficheros de prueba | 158 |
| Casos | 870 — **863 pasan, 7 saltados** |
| Duración de `npm test` | 254 s |
| Marco | Vitest 4.1.8, entorno `jsdom`, `globals: true` |
| Patrón de inclusión | `src/**/*.{test,spec}.{ts,tsx}` |
| Scripts de humo | 23 ficheros en `scripts/` y 35 entradas en `package.json`. **11 ficheros son de WhatsApp**, invocados por 14 entradas |
| Playwright | **No instalado** |

### 2.1 Dónde están las pruebas hoy

| Área | Ficheros de prueba | Comentario |
|---|---|---|
| `src/core/` | 49 | El dominio. Es donde está la calidad |
| `src/app/` | 40 | Todas bajo `api/`; **cero fuera de `api/`** |
| `src/agents/` | 21 | Incluye los 4 de humo con API real |
| `src/features/` | 17 | Frente a 13 pantallas de 14.072 líneas |
| `src/data/` | 7 | |
| `src/shared/` | 4 | Frente a 8 primitivas de UI |

### 2.2 La cobertura nunca se ha medido

```ts
// vitest.config.ts, hoy
coverage: {
  reporter: ["text", "json-summary"],
  include: ["src/core/**", "src/shared/**"],
},
```

Dos problemas, y el segundo es peor que el primero.

**El `include` excluye `src/features` y `src/app`.** Las 17 pruebas de
`features` y las 40 de `app` se ejecutan, pasan y **no cuentan**: existen para
la suite y no existen para la métrica.

**El proveedor de cobertura no está instalado.** `@vitest/coverage-v8` no
figura en `package.json`. Pedir cobertura falla. Es decir: la configuración
describe una medición que nunca se ha ejecutado ni una sola vez.

Esto no es un descuido menor, es el mismo patrón que este corpus lleva
encontrando desde el `43`: **algo declarado que nadie comprobó que existiera.**

### 2.3 Los 7 saltados son legítimos

Cuatro ficheros `*.api-smoke.test.ts` en `src/agents/` se saltan por diseño:

```ts
const shouldRunSmoke = process.env.RUN_OPENAI_AGENT_SMOKE === "true";
const describeIf = shouldRunSmoke ? describe : describe.skip;
```

Consumen una API real y cuestan dinero. Saltarlos por defecto es correcto.
Pero la forma en que se saltan **es indistinguible de un test abandonado** en
el informe de la suite, y `RUL-HECHO-01` dice que un test en `skip` devuelve
su criterio a `pendiente`. §10 resuelve la ambigüedad.

---

## 3. Los cuatro huecos de la suite actual

### 3.1 No hay ninguna prueba de RLS

43 tablas, las 43 con RLS activo, 65 políticas. Y la única comprobación de
aislamiento es `scripts/smoke-rls-multiuser.mjs`: 464 líneas que crean dos
usuarios reales contra un Supabase real y verifican **tres tablas**
(`movements`, `pending_items`, `movement_audit_log`).

Está bien hecho y no es una prueba: exige credenciales reales y una app
levantada, así que es `SMOKE`, no `TEST`, y no corre en CI. `AC-SEG-02` pide
literalmente *"para cada tabla con datos de usuario"*. Hoy son 3 de 43.

### 3.2 Nada verifica que 48 rutas esquiven RLS

De las 58 rutas de `/api/v1`, **48 importan `createServiceClient`**. Ninguna
prueba lo comprueba, ninguna lista blanca existe, y `AC-SEG-01` —el criterio
que debería impedirlo— está sin implementar.

Fuera de `/api/v1` hay **14 rutas más** (2 de salud, 10 de trabajos internos,
2 de webhooks), de las cuales 12 usan service-role. Esas son legítimas: un
trabajador de fondo no tiene sesión de usuario. Pero el criterio nunca dijo
qué hacer con ellas porque nunca las contó.

### 3.3 20 de 58 rutas tienen prueba

Treinta y ocho rutas de API no tienen ni un caso. Y el corpus especifica
**187 endpoints**, así que la proporción empeora antes de mejorar.

### 3.4 Cero pruebas de navegador

No hay Playwright ni equivalente. Los siete criterios de clase `e2e` que el
corpus ya declaró —URLs propias, botón atrás, recarga de un detalle, teclado—
no se pueden verificar de ninguna forma con la suite actual. Y son
exactamente los que cubren el defecto raíz del `10`: el enrutado por
`?view=`.

---

## 4. Cómo se asigna la clase a las 542 pendientes

`WEB-D153` — **La clase se decide con un árbol de decisión, no por criterio
del autor.** El árbol se aplica en orden y gana la primera respuesta
afirmativa. Dos personas distintas obtienen la misma clase para el mismo
criterio.

```text
1. ¿Afirma algo sobre los documentos del corpus?            → corpus
2. ¿Debe impedir que el código llegue a producción?         → build
3. ¿Se comprueba contra texto ya publicado?                 → contenido
4. ¿Se decide leyendo el código sin ejecutarlo?             → lint
5. ¿Mide un número sobre un artefacto de compilación?       → presupuesto
6. ¿Necesita un navegador de verdad?                        → e2e
7. ¿Cruza HTTP o toca la base de datos?                     → integracion
8. Resto                                                     → unidad
```

**El orden importa y no es arbitrario.** Va de lo más barato y más temprano a
lo más caro y más tardío. Un criterio que se puede comprobar con un lint no
debe comprobarse con un E2E: el lint falla en dos segundos y señala la línea;
el E2E falla en dos minutos y señala una captura de pantalla.

### 4.1 Por qué no se asignan aquí una por una

Se probó a asignarlas por palabras clave sobre el texto de todos los criterios
del corpus. El resultado fue malo de una forma instructiva: cuatro de cada
cinco caían al paso 8, y varias de las que el filtro sí clasificaba quedaban
mal. *"Ninguna ruta de este módulo usa service-role"* salía como `lint`
—correcto— pero *"un campo extraído sin respaldo literal no se extrae"*
también, y eso es `unidad`.

La conclusión es que **la clase depende de dónde vive la lógica, no de cómo
está redactado el criterio**, y eso solo se sabe con el árbol de código
delante. Así que la asignación ocurre **al escribir la prueba**, la registra
la matriz del `50`, y `AC-HECHO-03` impide que un criterio llegue a
`verificado` sin ella. El árbol de §4 es el contrato que hace que esa
decisión no dependa de quién la tome.

### 4.2 Reparto esperado

Estimación de planificación, no compromiso. Sirve para dimensionar el trabajo
del documento `54`, no para cerrar criterios.

| Clase | Esperados | De dónde salen |
|---|---|---|
| `unidad` | ~380 | Las `RUL-` de los dieciséis módulos, con su ejemplo numérico |
| `integracion` | ~120 | Los 187 endpoints y sus errores |
| `e2e` | ~40 | Los ocho recorridos de primer valor y los flujos irreversibles |
| `lint` | ~20 | Fronteras de arquitectura y de sistema de diseño |
| `corpus` | 30 | Ya asignados |
| `build` | 9 | Ya asignados (§7) |
| `presupuesto` | ~5 | Peso inicial, consultas por pantalla, llamadas al modelo |
| `contenido` | ~3 | Páginas legales |

Las cifras de `corpus` y `build` no son estimaciones: son las asignadas hoy,
según `50` §3.1.

---

## 5. Las tres relaciones entre criterio y prueba

El `49` §7 identificó dos: criterio **propio** y criterio **derivado**. Al
repartir las clases aparece una tercera, y sin ella dos docenas de criterios
transversales no tienen forma de cerrarse.

| Relación | Qué significa | Cómo cierra |
|---|---|---|
| **propio** | Tiene su prueba, uno a uno | Su prueba pasa |
| **derivado** | Lo cubre entero un criterio transversal | Cierra cuando cierra el otro. No genera prueba |
| **agregado** | Es transversal y su evidencia es la **unión** de las pruebas por módulo | Cierra cuando pasan todas las de su conjunto, y el conjunto está declarado |

`AC-PAT-03` —*"todo listado recorre su conjunto completo mediante cursor"*—
es agregado: no existe un solo test que lo pruebe, existe uno por listado.
Igual `AC-A11Y-01` (*"todo flujo crítico se completa solo con teclado"*),
`AC-NAV-01` (*"toda pantalla responde en su propia URL"*), `AC-DS-01`
(*"ningún componente escribe un color literal"*, que es agregado y además
`lint`) y `AC-TRAZ-04` (*"las 119 superficies declaran una línea `**Ruta:**`"*,
`WEB-D167` — su conjunto son las 119 `SCR-` y cierra una por una, a medida que
el corte dueño de cada documento la etiqueta).

**`RUL-PRUEBA-01` — Un criterio agregado declara su conjunto.** "Todo
listado" no vale: la matriz enumera cuáles son los listados, y añadir uno
nuevo sin su prueba deja el criterio agregado abierto. Un criterio agregado
sin conjunto declarado es una afirmación universal que nadie puede falsar, y
por tanto no es un criterio.

`AC-MOV-02` (*"el listado recorre el conjunto completo mediante cursor"*) es
uno de los miembros del conjunto de `AC-PAT-03`, no un duplicado: cada listado
tiene su propia consulta y su propia forma de romperse.

---

## 6. El árbol de pruebas

```text
src/
├── **/*.test.ts              unidad — junto al código que prueban
tests/
├── api/                      integracion — una carpeta por recurso
│   └── movimientos.test.ts
├── rls/                      integracion — una por tabla con datos de usuario
│   └── movements.rls.test.ts
├── e2e/                      Playwright
│   ├── recorridos/           los ocho de primer valor
│   └── irreversibles/        borrar, cerrar deuda, olvidar memoria
├── contenido/                páginas legales publicadas
└── corpus/                   asserts sobre documentacion/app_web/
scripts/
└── smoke-*.mjs               SMOKE y LIVE, fuera de CI
```

**Las de unidad se quedan junto al código.** Es lo que ya hace el proyecto en
`src/core/` con 49 ficheros y funciona. Cambiarlo por una carpeta espejo no
aporta nada y rompe 158 ficheros.

**Las demás se agrupan por clase**, porque se ejecutan en momentos distintos
y con requisitos distintos: las de integración necesitan base de datos, las
E2E un navegador y un servidor, las de corpus solo ficheros de texto.

### 6.1 `unidad`

Prueban una regla de negocio aislada, sin red ni base de datos.

**`RUL-PRUEBA-02` — Toda `RUL-` con ejemplo numérico tiene una prueba que usa
ese ejemplo.** La plantilla de módulo (`01` §8, item 6) obliga a que cada
regla lleve un ejemplo completo en soles. Ese ejemplo es el caso de prueba, ya
escrito, revisado y en la moneda correcta. No traducirlo a un test es tirar
trabajo hecho.

```ts
// Lo que ya dice 24 §6, convertido en test sin inventar nada
it("AC-CUENTAS-01: las cuatro capas del ejemplo de 24 §6", () => {
  expect(calcularCapas(fixture24)).toEqual({
    total: 80000, separado: 58000, libreEnCuentas: 22000, dineroLibre: 17000,
  });
});
```

Los montos van en céntimos enteros, nunca en decimales de coma flotante.

### 6.2 `integracion`

Prueban una ruta de API completa contra una base de datos de prueba: entrada,
validación, autorización, efecto y forma de la respuesta.

Cada endpoint de los 187 necesita, como mínimo:

| Caso | Qué comprueba |
|---|---|
| Camino feliz | El efecto y el envelope `{ok,data,meta}` |
| Sin sesión | 401, sin filtrar si el recurso existe |
| Recurso de otro usuario | **404, nunca 403** (`AC-SEG-04`) |
| Validación | `VALIDATION_ERROR` con mensaje en español |
| Idempotencia | Repetir con la misma `Idempotency-Key` no duplica |

Los cinco no son opcionales. El tercero es el que más se olvida y el único
que impide una fuga de datos entre usuarios.

### 6.3 `e2e`

Playwright, contra la app levantada. **Son las pruebas más caras del árbol y
por eso su conjunto está acotado**, no abierto.

`WEB-D154` — **El conjunto E2E son los ocho recorridos de primer valor de
`44` §5, más los flujos irreversibles.** No se escribe un E2E para algo que
una prueba de integración puede verificar.

| Recorrido | De dónde sale |
|---|---|
| Registro rápido → movimiento guardado | `44` §5, ruta 1 |
| Crear cuenta → *"Tienes S/X"* | ruta 2 |
| Cuenta + compromiso → dinero libre distinto del saldo | ruta 3 |
| Registrar deuda → cuota que vence, cubierta o no | ruta 4 |
| Registrar recurrente → qué pagos vienen | ruta 5 |
| Conectar buzón → pendientes sin registrar nada solo | ruta 6 |
| Crear presupuesto + 3 gastos → avance | ruta 7 |
| Historial → primer descubrimiento con evidencia | ruta 8 |
| Eliminar y restaurar un movimiento | flujo irreversible |
| Cerrar una deuda | flujo irreversible |
| Olvidar un aprendizaje | flujo irreversible |
| Exportar y eliminar la cuenta | flujo irreversible |

Doce recorridos. Los ocho primeros son además la definición operativa de que
el onboarding funciona, así que sirven dos propósitos con un solo coste.

### 6.4 `lint`

Reglas de ESLint propias. Verifican **fronteras**, que es lo que un test no
puede vigilar porque no se manifiestan como comportamiento.

| Regla | Criterio | Qué prohíbe |
|---|---|---|
| `sin-view-query` | `AC-ARQ-01`, `AC-NAV-04` | Leer `?view=` para decidir pantalla |
| `frontera-core` | `AC-ARQ-07` | Que `core/` importe React o Next |
| `frontera-cliente` | `AC-ARQ-05` | Que un Client Component importe repositorios |
| `sin-literales-de-estilo` | `AC-DS-01` | Colores, espaciados y radios literales |
| `dialogo-unico` | `AC-DS-04` | `role="dialog"` fuera del componente `Dialog` |
| `tamano-componente` | `AC-ARQ-04` | Más de 150 líneas sin justificación registrada |
| `fetch-a-mano` | `AC-PAT-01` | Reimplementar el patrón de obtención de datos |
| `sin-canal-en-el-nucleo` | `AC-CANAL-02` | `"web"` o `"whatsapp"` fuera de un presentador |

`tamano-componente` es la que evita que `money-screen.tsx` (2.360 líneas)
vuelva a existir. Es una regla mecánica contra un problema que ninguna
revisión detuvo la primera vez.

### 6.5 `build`

Ver §7. Son seis y merecen sección propia.

### 6.6 `presupuesto`

Un número máximo, medido en CI, que falla si se supera.

| Presupuesto | Criterio | Límite |
|---|---|---|
| El Inicio no descarga reportes ni asistente | `AC-ARQ-03` | Declarado en `12` §9 |
| Las cuatro capas en una consulta | `AC-CUENTAS-16` | 1 consulta |
| `GET /upcoming` sin duplicar | `AC-REC-15` | 1 consulta |
| Avance de todos los presupuestos | `AC-PRES-15` | 1 consulta |
| Agregado de un periodo | `AC-REP-18` | 1, o 2 con comparación |

Los cuatro últimos son presupuestos de consultas, no de bytes. Se miden
contando las consultas que la petición emite, no cronometrándola: un umbral
de milisegundos falla de forma intermitente según la máquina y acaba
desactivado.

### 6.7 `contenido`

Descargan la página publicada y comprueban su texto. **Contra lo publicado,
no contra el fuente**, porque la divergencia que `C-14` y `C-16` produjeron
era precisamente entre lo que el repositorio decía y lo que el visitante veía.

### 6.8 `corpus`

Leen `documentacion/app_web/` y comprueban propiedades de los documentos. Son
26 y las gobierna `WEB-D147`. Verifican, entre otras cosas, que no haya
identificadores duplicados, que todo token esté registrado, que ningún módulo
copie un criterio transversal y que nada marcado `FUERA` aparezca como activo.

Su coste de ejecución es de segundos y su valor es que **el corpus deja de
poder pudrirse en silencio**, que es lo que le pasó a `docs/`.

---

## 7. Los seis tests que fallan el build

`WEB-D155` — **Estos seis no fallan una suite: impiden desplegar.** La
diferencia importa: una suite roja se puede ignorar un viernes; un build roto,
no.

| # | Criterio | Qué impide |
|---|---|---|
| 1 | `AC-SEG-01` | Que una ruta de `/api/v1` importe `createServiceClient` fuera de la lista blanca justificada |
| 2 | `AC-RT-01` | Que el proceso arranque en producción con el proveedor de modelo de prueba (`local_fixture`) |
| 3 | `AC-REU-06` | Que arranque con `production_safe` en falso |
| 4 | `AC-TRAZ-05` | Que el mapa de rutas de `10` §3 diverja de las §8 de los módulos |
| 5 | `AC-TRAZ-08` | Que un criterio figure `verificado` con su prueba en `skip` |
| 6 | `AC-TRAZ-09` | Que algo marcado `FUERA` en `07` §3 tenga implementación |

Los tres primeros protegen al usuario: RLS esquivada, respuestas inventadas
por un motor de prueba, y un arranque sin las garantías declaradas. Los tres
últimos protegen al corpus de convertirse en `docs/`.

**Hay nueve criterios de clase `build` en total, no seis.** Los otros tres
corren sobre la matriz al cerrar un corte, no en cada compilación:
`AC-HECHO-06` (que un corte no se cierre con criterios de `G1` abiertos),
`AC-TRAZ-11` (service-role en los 187 endpoints) y `AC-PRUEBA-08`, que es el
que verifica que estos seis fallan de verdad — introduciendo la violación a
propósito y comprobando que el build se rompe.

Un gate que nadie ha visto fallar no es un gate, es una suposición.

### 7.1 La lista blanca de service-role

La lista vive en el código, no en un documento, y cada entrada lleva su
justificación en la misma línea:

```ts
// tests/lint/service-role-whitelist.ts
export const RUTAS_CON_SERVICE_ROLE = {
  "api/internal/jobs/*": "trabajador de fondo, sin sesión de usuario",
  "api/internal/workers/outbox": "outbox transaccional, sin sesión",
  "api/webhooks/gmail-pubsub": "notificación de Google, sin sesión",
  // toda entrada nueva exige justificación y revisión
} as const;
```

**El alcance del test son las 58 rutas de `/api/v1`.** Las 14 de fuera —2 de
salud, 10 de trabajos internos, 2 de webhooks— entran en la lista blanca por
categoría, porque ninguna tiene sesión de usuario que usar. Distinguirlas es
lo que el criterio original no hacía: prohibir service-role sin excluir a los
trabajadores habría sido imposible de cumplir y se habría desactivado en la
primera semana.

`AC-SEG-07` exige que la lista de **excepciones temporales** esté vacía antes
del lanzamiento. Esa es distinta de la lista blanca: la blanca es permanente y
justificada; la temporal es deuda con fecha.

---

## 8. Pruebas de RLS

`WEB-D156` — **Una prueba de aislamiento por tabla con datos de usuario, en
CI, contra una base de datos de prueba.** No un script de humo contra
producción.

Las 43 tablas de hoy tienen RLS activo y 65 políticas. Las nuevas de `13` §7
y §9 nacen con RLS, según `13` §10. Cada una necesita cuatro asertos:

```text
1. El usuario A no LEE filas del usuario B          → 0 filas, no error
2. El usuario A no ESCRIBE filas del usuario B      → rechazo
3. El usuario A no ACTUALIZA filas del usuario B    → 0 filas afectadas
4. El rol authenticated no escribe columnas de dinero → rechazo (AC-SEG-03)
```

El primero devuelve **cero filas, no un error**. Es la diferencia entre RLS
bien puesta y una comprobación en la aplicación: con RLS, la fila no existe
para ese usuario.

`scripts/smoke-rls-multiuser.mjs` **no se borra.** Cubre tres tablas contra
infraestructura real y eso es evidencia `LIVE` que una prueba en CI no
sustituye (`01` §4). Se conserva como el humo que es, y se le añade el resto
de tablas cuando el corte correspondiente las toque.

---

## 9. Cobertura

`WEB-D157` — **La cobertura se mide sobre todo `src/`, se publica, y no
bloquea nada por porcentaje.**

```ts
coverage: {
  provider: "v8",                    // hoy ni siquiera está instalado
  reporter: ["text", "json-summary", "html"],
  include: ["src/**"],
  exclude: ["src/**/*.test.*", "src/test/**"],
}
```

Tres cambios: se instala el proveedor, se incluye todo `src/` —con
`src/features` y `src/app`, que hoy quedan fuera— y se añade el informe HTML
para poder mirarlo.

**Y no hay umbral global.** Un umbral porcentual se cumple escribiendo pruebas
donde es fácil, que es exactamente donde no hacen falta. Lo que sí bloquea es
nominal:

| Regla | Bloquea |
|---|---|
| Toda `RUL-` con ejemplo numérico tiene su prueba | Sí, al cerrar el corte |
| Todo endpoint tiene sus cinco casos de §6.2 | Sí, al cerrar el corte |
| Toda tabla con datos de usuario tiene su prueba de RLS | Sí, al cerrar el corte |
| Porcentaje de líneas cubiertas | **No.** Se publica y se mira |

La cobertura sirve para **encontrar lo que nadie especificó**: un fichero con
0 % es un fichero sin criterio que lo describa, y eso es una pregunta para el
corpus antes que para el equipo.

---

## 10. Qué significa un test saltado

`RUL-HECHO-01` dice que un test en `skip` devuelve su criterio a `pendiente`.
Los 7 saltados de hoy no son criterios abandonados: son pruebas que consumen
una API de pago y se activan con `RUN_OPENAI_AGENT_SMOKE=true`.

`WEB-D158` — **Un test que no corre en la suite por diseño no vive en la
suite.** Se separa por proyecto de Vitest, no por un `skip` condicional
dentro del fichero.

| Comando | Qué corre | Dónde |
|---|---|---|
| `npm test` | `unidad` + `lint` + `corpus` | Cada commit. Sin red |
| `npm run test:api` | `integracion` + `rls` | Cada commit. Base de datos de prueba |
| `npm run test:e2e` | `e2e` | Antes de mezclar. App levantada |
| `npm run test:contenido` | `contenido` | Contra el despliegue |
| `npm run smoke:*` | `SMOKE` y `LIVE` | A mano, antes de un corte |

Con esta separación, `skip` recupera su único significado —**un test
desactivado es un criterio abierto**— y `AC-TRAZ-08` se puede aplicar sin
excepciones que discutir.

El reparto también resuelve un problema que hoy ya duele. `npm test` tarda
**254 segundos de reloj**, y su propio desglose dice dónde se van:

```text
Duration  254.28s (transform 34.41s, setup 185.30s, import 167.12s,
                   tests 35.56s, environment 1197.76s)
```

Las cifras del paréntesis se acumulan entre procesos en paralelo, así que
suman más que el reloj y no se pueden restar entre sí. Pero la proporción es
inequívoca: **ejecutar los asertos cuesta 35,56 s y preparar el entorno
`jsdom` cuesta 1.197 s acumulados.** Se está montando un DOM para 49 ficheros
de `src/core/` que no tocan el DOM, y para las pruebas de corpus, que solo
leen ficheros de texto.

---

## 11. Lo que ninguna prueba puede cerrar

138 criterios exigen `USER` o `METRIC` (`49` §4). Este documento no los cubre
y no puede: los cubre el `55`.

Pero el `49` §8.1 dejó un hueco nominal que sí es de este documento resolver:
**los módulos `37` (recordatorios) y `46` (correo saliente) no tienen ni un
criterio de `G3`**, siendo los dos cuyo riesgo entero es cansar a la gente.
Sus 38 criterios son todos de `G1`.

No se arregla añadiendo criterios desde fuera del módulo —`WEB-D148` lo
prohíbe y con razón—. Se arregla **desde el lado de la validación**:

`WEB-D159` — **Un módulo cuyo fallo es acumulativo entra en la ventana de
observación aunque sus criterios sean todos de `G1`.** Se define en el `55`
como un periodo con métricas declaradas de antemano, no como una sesión con
tres personas.

| Módulo | Qué se observa | Umbral declarado antes |
|---|---|---|
| `37` | Recordatorios `descartado` frente a `resuelto` (`37` §5) | Lo fija el `55` |
| `46` | Bajas por tipo y quejas de spam (`46` §5) | Lo fija el `55` |

La distinción entre `descartado` y `resuelto` que el `37` §5 introdujo
—*"el primero es el sistema diciendo ya no hace falta; el segundo es el
usuario diciendo no me importa"*— existe precisamente para esto. El módulo ya
emite la señal; lo que faltaba era declarar que alguien la mira.

---

## 12. Las pruebas de WhatsApp

De los 23 ficheros de `scripts/`, **11 son específicos de WhatsApp** y los
invocan 14 entradas de `package.json`. A eso se suman los adaptadores y sus
pruebas en `src/adapters/whatsapp/`.

`WEB-D160` — **No se borran, se aíslan.** Salen de la suite por defecto y
quedan en un proyecto propio que no corre en CI durante la fase web.

Borrarlos sería tirar trabajo que la fase 2 necesita, y dejarlos donde están
sería mantener verde una suite que prueba un canal que no existe todavía. El
veredicto por fichero lo emite el `52`; lo que este documento fija es que
**su estado no bloquea ni desbloquea ningún corte de la fase web**.

---

## 13. Criterios de aceptación

- `AC-PRUEBA-01` — Todo criterio con `TEST` tiene clase asignada en la
  matriz antes de pasar a `verificado`. Evidencia: `TEST`. Clase: `corpus`.
- `AC-PRUEBA-02` — Todo criterio agregado declara su conjunto, y añadir un
  miembro sin prueba lo deja abierto. Evidencia: `TEST`. Clase: `corpus`.
- `AC-PRUEBA-03` — Toda `RUL-` con ejemplo numérico tiene una prueba que usa
  ese ejemplo. Evidencia: `TEST`. Clase: `corpus`.
- `AC-PRUEBA-04` — Todo endpoint tiene los cinco casos de §6.2. Evidencia:
  `TEST`. Clase: `corpus`.
- `AC-PRUEBA-05` — Toda tabla con datos de usuario tiene su prueba de
  aislamiento, y el usuario A recibe **cero filas**, no un error. Evidencia:
  `TEST`. Clase: `integracion`.
- `AC-PRUEBA-06` — La cobertura se mide sobre todo `src/`, con el proveedor
  instalado, y el informe se genera. Evidencia: `CODE` + `TEST`.
- `AC-PRUEBA-07` — Ningún test se salta con una condición dentro del fichero;
  lo que no corre por diseño vive en otro proyecto. Evidencia: `TEST`.
  Clase: `lint`.
- `AC-PRUEBA-08` — Los seis tests de §7 fallan el build, no la suite, y se
  verifica introduciendo la violación a propósito. Evidencia: `TEST`.
  Clase: `build`.
- `AC-PRUEBA-09` — Los doce recorridos E2E de §6.3 existen y pasan en CI.
  Evidencia: `TEST`. Clase: `e2e`.
- `AC-PRUEBA-10` — Ninguna prueba de la suite por defecto necesita red,
  credenciales ni base de datos. Evidencia: `TEST`.
- `AC-PRUEBA-11` — `npm test` no supera los 120 segundos. Evidencia: `TEST`.
  Clase: `presupuesto`.
- `AC-PRUEBA-12` — Las pruebas de WhatsApp no corren en CI durante la fase
  web y ninguna de ellas bloquea un corte. Evidencia: `CODE`.
- `AC-PRUEBA-13` — Cada prueba nueva falla al revertir el cambio que
  implementa su criterio (`RUL-HECHO-02`), y esa comprobación consta.
  Evidencia: `DOC`.
- `AC-PRUEBA-14` — Los módulos `37` y `46` tienen ventana de observación con
  umbral declarado antes de mirarla. Evidencia: `METRIC`.

`AC-PRUEBA-11` fija 120 segundos frente a los 254 de hoy. No es optimismo:
sale de sacar de la suite por defecto lo que no debería estar —E2E,
integración, humo— y de que las pruebas de unidad y de corpus no necesitan
`jsdom`, que hoy consume la mayor parte del arranque.

---

## 14. Fuera de alcance

Este documento no asigna las 542 clases una por una (§4.1 explica por qué), no
reparte el código existente (`52`), no prioriza la deuda (`53`), no define los
cortes (`54`) y no lleva el registro de validación con usuarios (`55`).

Tampoco elige la herramienta de E2E más allá de nombrar Playwright, que ya
figuraba en `12` §2 como pendiente de incorporar.

Para la fase de WhatsApp: el árbol de clases, el árbol de decisión y las
reglas anti-autoengaño se heredan. Cambian dos cosas: la clase `e2e` no aplica
a un canal sin navegador y se sustituye por pruebas de conversación completa
contra un presentador de prueba, y la prueba de agnosticismo del `21` pasa a
ser el criterio que valida que el motor no se enteró del cambio.

---

## 15. Trazabilidad

| Elemento | Origen |
|---|---|
| El enum de 8 clases y el inventario de criterios | `49` §2.2, §6.1 |
| Los tres portones | `49` §4 |
| Reglas anti-autoengaño | `49` §10 |
| Criterio derivado | `49` §7.2 |
| El esquema de la matriz y los estados | `50` §4, §7 |
| Lista blanca de service-role | `15` §4 y §5, `AC-SEG-01`, `AC-SEG-07` |
| `local_fixture` prohibido en producción | `23`, `AC-RT-01`; `42`, `AC-REU-06` |
| Los ocho recorridos de primer valor | `44` §5 |
| Estado medido del árbol de pruebas | Ejecución de `npm test` del 26 de julio de 2026 |
| Decisiones nuevas | `WEB-D153` a `WEB-D160` |

| Documento que depende de este | Qué toma |
|---|---|
| `52_inventario_reutilizacion_codigo_src.md` | El veredicto sobre las pruebas de WhatsApp y las 158 existentes |
| `53_deuda_tecnica_y_saneamiento.md` | Los cuatro huecos de §3 |
| `54_plan_de_implementacion_web.md` | El árbol de pruebas, los seis gates de build, los doce E2E |
| `55_ledger_construccion_web.md` | La ventana de observación de `37` y `46` |
