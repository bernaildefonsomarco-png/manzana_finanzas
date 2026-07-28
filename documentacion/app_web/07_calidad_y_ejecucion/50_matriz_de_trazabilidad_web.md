# 50 — Matriz de trazabilidad web

**Bloque:** 07 — Calidad y ejecución
**Alcance:** V1
**Estado:** vivo
**Fecha de última actualización:** 26 de julio de 2026
**Docs fuente:** los documentos del corpus con identificadores (57 a fecha de hoy)
**Documentos que dependen de este:** `51` (pruebas), `54` (plan), `55` (ledger)

---

## 1. Qué es y qué no es

La matriz une cada requisito con su implementación real:

```text
ID → documento y sección → ruta URL → endpoint → componente → test → evidencia → estado
```

**No es una tabla escrita a mano.** El corpus tiene **1.551 identificadores** (§3).
Una tabla de ese tamaño mantenida a mano estaría desactualizada la primera
semana de implementación, y el corpus ya sabe exactamente cómo termina eso:
`C-03` fue una lista de tools mantenida a mano junto a otra lista de tools,
divergiendo en silencio hasta que alguien las contó.

Así que este documento contiene **cuatro cosas**, y ninguna de ellas es la
lista completa de filas:

1. **El registro de tokens** (§2) — la única fuente de verdad del corpus para
   los nombres cortos de módulo. Se mantiene a mano porque cabe en una
   pantalla y porque asignar un token es una decisión, no un dato derivado.
2. **El esquema de la matriz** (§4) — qué columnas tiene, quién llena cada
   una y en qué momento.
3. **Las vistas agregadas** (§3, §5, §6) — censo de identificadores,
   inventario de superficies y rutas, inventario de endpoints. Generadas.
4. **Las reglas que la mantienen viva** (§8) y lo que reveló al cruzarse por
   primera vez (§9).

La matriz completa **se genera**: sale de leer los documentos y el árbol
de código, y un test falla si el generador encuentra un ID que no puede
resolver. Ese es el mismo mecanismo con el que `40` §2 cerró `C-03` y con el
que `WEB-D147` convierte los criterios sobre el corpus en tests.

---

## 2. El registro de tokens

**Fuente única.** `WEB-D143`: el token no se infiere del nombre del módulo, se
asigna aquí. Un identificador cuyo token no esté en esta tabla no existe, y el
test de `AC-HECHO-02` lo rechaza.

### 2.1 Módulos

El `MOD-` usa el **nombre largo**; las otras cinco familias usan el **token
corto**. Son dos cosas distintas a propósito: `MOD-MOVIMIENTOS` se lee en
prosa una vez por documento, y `SCR-MOV-01` se lee cuarenta veces.

| Doc | `MOD-` | Token | Familias que lo usan |
|---|---|---|---|
| `24` | `MOD-CUENTAS` | `CUENTAS` | `SCR` `ACT` `RUL` `ERR` `AC` |
| `25` | `MOD-CATEGORIAS` | `CAT` | `SCR` `ACT` `RUL` `ERR` `AC` |
| `26` | `MOD-MOVIMIENTOS` | `MOV` | `SCR` `ACT` `RUL` `ERR` `AC` |
| `27` | `MOD-PENDIENTES` | `PEND` | `SCR` `ACT` `RUL` `ERR` `AC` |
| `28` | `MOD-EMAIL` | `EMAIL` | `SCR` `ACT` `RUL` `ERR` `AC` |
| `29` | `MOD-CAPTURA` | `CAP` | `SCR` `ACT` `RUL` `ERR` `AC` |
| `30` | `MOD-RECURRENTES` | `REC` | `SCR` `ACT` `RUL` `ERR` `AC` |
| `31` | `MOD-DEUDAS` | `DEUDAS` | `SCR` `ACT` `RUL` `ERR` `AC` |
| `32` | `MOD-PRESUPUESTOS` | `PRES` | `SCR` `ACT` `RUL` `ERR` `AC` |
| `33` | `MOD-PROYECCIONES` | `PROY` | `SCR` `ACT` `RUL` `ERR` `AC` |
| `34` | `MOD-DESCUBRIMIENTOS` | `DESC` | `SCR` `ACT` `RUL` `ERR` `AC` |
| `35` | `MOD-REPORTES` | `REP` | `SCR` `ACT` `RUL` `ERR` `AC` |
| `36` | `MOD-MEMORIA` | `MEM` | `SCR` `ACT` `RUL` `ERR` `AC` |
| `37` | `MOD-RECORDATORIOS` | `NOTIF` | `SCR` `ACT` `RUL` `ERR` `AC` |
| `38` | `MOD-BUSQUEDA` | `BUS` | `SCR` `ACT` `RUL` `ERR` `AC` |
| `39` | `MOD-HOME` | `HOME` | `SCR` `ACT` `RUL` `ERR` `AC` |
| `41` | `MOD-ASISTENTE` | `ASI` | `SCR` `ACT` `RUL` `ERR` `AC` |

**`MOD-RECORDATORIOS` → `NOTIF` es el único donde el token no abrevia el
nombre.** Está así a propósito: abreviar "recordatorios" da `REC`, que ya es
de `MOD-RECURRENTES`, y esa coincidencia produjo 46 identificadores ambiguos
(`49` §3.1). `NOTIF` viene de `in_app_notifications`, que es la entidad real
del módulo. Los identificadores no se ven nunca, así que se alinean con la
tabla de datos y no con la pantalla.

### 2.2 Documentos sin módulo

| Doc | Token | Qué gobierna |
|---|---|---|
| `06` | `TESIS` | Tesis de la app web |
| `07` | `ALCANCE` | Candado de alcance |
| `08` | `EXP` | Principios de experiencia |
| `09` | `DINERO` | Modelo mental del dinero |
| `10` | `NAV` | Sitemap y navegación |
| `11` | `CONFIANZA` | Confianza, errores, reversibilidad |
| `12` | `ARQ` | Arquitectura de la app |
| `13` | `DATOS` | Modelo de datos |
| `14` | `API` | Contratos de API |
| `15` | `SEG` | Seguridad, autorización, RLS |
| `16` | `DS` | Sistema de diseño |
| `17` | `PAT` | Patrones de datos y formularios |
| `18` | `A11Y` | Accesibilidad, i18n, formatos |
| `19` | `OBS` | Observabilidad y telemetría |
| `20` | `MOTOR` | Arquitectura del motor conversacional |
| `20b` | `SEM` | Capa semántica y consulta abierta |
| `20c` | `PERF` | Perfil del usuario y voz |
| `21` | `CANAL` | Contrato de canal y presentadores |
| `22` | `EVID` | Grounding, evidencia y política |
| `23` | `RT` | Runtime IA, costo y degradación |
| `40` | `CATALOGO` | Catálogo de tools y comandos |
| `42` | `REU` | Reutilización del código del motor |
| `43` | `AUTH` | Auth y cuenta |
| `44` | `ONB` | Onboarding web |
| `45` | `CONF` | Configuración, privacidad y datos |
| `46` | `MAIL` | Notificaciones y correo saliente |
| `47` | `VIDA` | Ciclo de vida del dato |
| `48` | `AYUDA` | Ayuda, explicabilidad y soporte |
| `49` | `HECHO` | Criterios de aceptación globales |
| `50` | `TRAZ` | Trazabilidad y registro de identificadores |
| `51` | `PRUEBA` | Estrategia de pruebas |
| `52` | `INV` | Inventario y reutilización del código |
| `53` | `DEUDA` | Deuda técnica y saneamiento |
| `54` | `PLAN` | Plan de implementación |
| `55` | `LEDGER` | Ledger de construcción |
| `56` | `PUENTE` | Puente a la fase WhatsApp |

**53 tokens en total.** Los seis documentos de `00_gobierno/` no tienen: no
definen reglas ni criterios propios, gobiernan el proceso de escritura. Los
del bloque `07` que aún no existen tomarán el suyo aquí antes de usarlo
(`RUL-TRAZ-02`).

### 2.3 Reglas del registro

**`RUL-TRAZ-01` — Un token pertenece a un único documento.** El test de
`AC-HECHO-01` falla si un token aparece definido en dos.

**`RUL-TRAZ-02` — Un token nuevo se añade aquí antes de usarse.** No después.
Un identificador con token no registrado no compila la suite de corpus.

**`RUL-TRAZ-03` — Un token no se reutiliza aunque su documento se retire.**
Misma regla que los números (`01` §3): el token muerto queda muerto, porque
los tests, los tickets y los commits antiguos siguen citándolo.

**`RUL-TRAZ-04` — Los ejemplos de la documentación usan identificadores
reales.** Un ejemplo inventado en una plantilla es un token no registrado
esperando a que alguien lo copie. Pasó: `01` §3 ilustraba el sistema con
tokens largos que ningún documento usa, y era el único documento del corpus
que incumplía su propia regla.

---

## 3. Censo de identificadores

**Este es el único censo vivo del corpus.** El `49` §2 agrega los 625
criterios que existían antes del bloque `07` y deliberadamente no publica
totales: los documentos de este bloque siguen añadiendo identificadores, y un
total escrito en un documento `aprobado` nace desactualizado.

Última regeneración: 27 de julio de 2026, con el generador de `W-01`
(`scripts/matriz/generar.ts`, `npm run matriz:generar`). Es la primera vez que
esta tabla sale de ejecutar código y no de contarlo a mano.

**1.552 identificadores en 59 documentos.** Una unidad más que el conteo
manual anterior: dos defectos reales que el generador destapó al construirse
—una errata en `49` §10.1 que escribía mal el token de `RUL-CUENTAS-02`, y
`MOD-ASISTENTE` sin su campo de cabecera en el `41`— se corrigieron, y quedó
un `RUL-` de más en el conteo a mano de antes, que esta tabla ya no hereda
(`WEB-D167`, ver también §9).

| Familia | Únicos | Qué identifica |
|---|---|---|
| `MOD-` | 17 | Módulo funcional completo |
| `SCR-` | 119 | Pantalla, panel o componente de superficie |
| `ACT-` | 232 | Acción que el usuario puede disparar |
| `RUL-` | 317 | Regla de negocio verificable |
| `ERR-` | 159 | Error de dominio con mensaje visible |
| `AC-` | 708 | Criterio de aceptación |
| **Total** | **1.552** | |

**Ningún identificador citado queda sin definición.** Se verificó familia por
familia; los tres colgantes que había estaban en la tabla de ejemplos de `01`
§3 y se corrigieron (`RUL-TRAZ-04`).

Los 708 `AC-` son los 625 del `49` §2, más 12 `AC-HECHO-`, 12 `AC-TRAZ-`, 14
`AC-PRUEBA-`, 13 `AC-INV-`, 8 `AC-DEUDA-`, 9 `AC-PLAN-`, 8 `AC-LEDGER-` y 7 `AC-PUENTE-`.

Sesenta y seis cadenas distintas aparecen como token: los 53 del registro más
los trece `MOD-` de nombre largo que no coinciden con su token corto
(`MOD-MOVIMIENTOS` frente a `MOV`). Las dos formas conviven a propósito y el
test las distingue por familia.

### 3.1 Los criterios, por portón y por clase

| Portón | Criterios |
|---|---|
| `G1` construido | 558 |
| `G2` probado en real | 11 |
| `G3` validado | 139 |
| **Total** | **708** |

| Clase de prueba | Asignadas |
|---|---|
| `corpus` | 45 |
| `build` | 15 |
| `lint` | 21 |
| `e2e` | 8 |
| `presupuesto` | 2 |
| `contenido` | 1 |
| `integracion` | 5 |
| `unidad` | 20 |
| **Con clase** | **117** |
| **Con `TEST` y sin clase** | **514** |
| **Total con `TEST`** | **631** |

`lint` sube de 13 a 14 en `W-01`: `AC-INV-10` recibe su clase al escribir su
prueba (`51` §4.1), como manda el árbol de decisión — es una comparación
leída sin ejecutar la aplicación.

Ningún criterio declara clase sin exigir `TEST`, que es el otro error de forma
posible. Las 544 sin clase las reparte el `51` §4 al escribir cada prueba, y
`AC-HECHO-03` impide que ninguna llegue a `verificado` sin ella.

---

## 4. El esquema de la matriz

Cada fila de la matriz generada tiene estas columnas. Las tres primeras salen
del corpus; las demás se llenan durante la implementación.

| Columna | Origen | Cuándo se llena | Obligatoria |
|---|---|---|---|
| `id` | El documento que lo define | Ya | Sí |
| `documento` | Ruta del archivo `.md` | Ya | Sí |
| `seccion` | §N dentro del documento | Ya | Sí |
| `ruta_url` | §8 del módulo, si aplica | Ya para `SCR-` | Solo `SCR-` |
| `endpoint` | §10 del módulo, si aplica | Ya para `ACT-` con API | No |
| `componente` | Árbol de `src/` | Al implementar | Solo `SCR-` |
| `test` | Ruta del fichero y nombre del caso | Al implementar | Si el nivel incluye `TEST` |
| `clase_prueba` | Enum de `49` §6.1 | Al asignar | Si el nivel incluye `TEST` |
| `nivel_evidencia` | El propio criterio | Ya para `AC-` | Solo `AC-` |
| `porton` | Derivado del nivel (`49` §4) | Ya para `AC-` | Solo `AC-` |
| `estado` | Ciclo de §7 | Cambia | Sí |
| `dueño` | Persona, no equipo | Al abrir `G3` | Solo `G3` cerrado sin validar |
| `fecha_revision` | Cuándo se vuelve a mirar | Al abrir `G3` | Solo `G3` cerrado sin validar |
| `corte` | `W-NN` del documento `54` | Al planificar | Sí |

`dueño` es una persona con nombre. "El equipo" no revisa nada; una persona sí.

---

## 5. Superficies y rutas

### 5.1 El inventario

**119 superficies `SCR-`.** No todas son rutas: la regla de `10` §4 distingue
ruta de modal, y está bien planteada.

| Tratamiento | Cuántas |
|---|---|
| Ruta URL propia | 59 |
| Modal, panel o componente sin ruta | el resto |
| **Declaran su tratamiento de forma verificable** | **64 de 119** |

**55 superficies no declaran su tratamiento en un campo que un test pueda
leer.** Dicen cosas como *"Modal sobre `/mi-dinero`"* en prosa, que una persona
entiende perfectamente y una prueba no. No es un error de contenido: es un
error de forma que impide verificar `AC-NAV-*` y llenar la columna `ruta_url`.

**`RUL-TRAZ-05` — Toda superficie declara una línea `**Ruta:**`.** Sin
excepción. Las que no tienen ruta propia declaran su tratamiento con la misma
línea:

```text
**Ruta:** `/mi-dinero`
**Ruta:** ninguna — modal sobre `/mi-dinero`
**Ruta:** ninguna — panel invocable desde cualquier pantalla
**Ruta:** ninguna — componente, se documenta en §5
```

Esto corrige también la plantilla: `01` §8 item 8 pedía *"una sola ruta URL
real"* de toda superficie, lo cual es imposible para un modal y llevó a que
cada autor lo resolviera en prosa a su manera.

**`AC-TRAZ-04` es agregado, no se cierra de una vez (`WEB-D167`).** La regla
se declaró aquí, pero aplicarla a las 82 superficies que hoy le faltan es
trabajo de veinte documentos repartidos entre `W-08` y `W-19` — no de `W-01`,
que es dueño de este documento pero no de ninguno de los que declaran una
superficie. Cada corte de módulo añade su línea `**Ruta:**` al cerrar su
propio `G1`; el criterio cierra por superficie, y el conjunto completo cierra
cuando lo hace el último.

### 5.2 Las rutas declaradas por los módulos

59 rutas. Las que el mapa de `10` §3 ya listaba se omiten aquí; estas son las
**16 que los módulos declararon y el mapa no conocía** — añadidas a `10` §3
en `W-03`, con el gate de `AC-TRAZ-05` (§10) que impide que vuelvan a
divergir:

| Ruta | Módulo | Qué es |
|---|---|---|
| `/recordatorios` | `37` | Bandeja de recordatorios |
| `/configuracion/categorias` | `25` | Gestión de categorías |
| `/configuracion/categorias/[id]` | `25` | Detalle de categoría |
| `/configuracion/correo/estado` | `28` | Salud de la detección |
| `/configuracion/plantillas` | `29` | Plantillas de registro rápido |
| `/configuracion/personas` | `31` | Personas de las deudas |
| `/configuracion/memoria/[id]` | `36` | Un aprendizaje en detalle |
| `/configuracion/voz` | `45` | Cómo habla Manzana |
| `/reportes/guardadas` | `35` | Vistas guardadas |
| `/buscar/guardadas` | `38` | Búsquedas guardadas |
| `/asistente/hilos` | `41` | Historial de conversaciones |
| `/ayuda` | `48` | Índice de ayuda |
| `/ayuda/[tema]` | `48` | Artículo |
| `/ayuda/contacto` | `48` | Contacto de soporte |
| `/estado` | `48` | Estado del producto, público |
| `/baja?t=<token>` | `46` | Baja de correo sin sesión |

Más seis estados de rutas existentes, que son parámetros y no rutas nuevas:
`/configuracion/memoria?inactivos=1`, `/configuracion/perfil#actividad`,
`/configuracion/privacidad#permisos`, `/configuracion/recordatorios#enviados`,
`/descubrimientos?historial=1`, `/recordatorios?filtro=cerrados`.

`/estado` y `/baja` son las dos que más importan porque son **públicas y sin
sesión**: viven en el grupo `(publico)` del árbol de `12` §5, no en `(app)`.
Un mapa de rutas que no las conoce es un mapa que no sabe cuántas superficies
sin autenticación tiene el producto — que es exactamente la pregunta que hace
falta responder para el documento `15`.

### 5.3 El mapa no se mantiene a mano

La causa es la de siempre. `10` se escribió en la Ola 2; los módulos, entre la
5 y la 12. El mapa no tenía forma de enterarse, y nadie volvió a cruzarlos
hasta ahora.

**`WEB-D152` — El inventario de rutas se genera desde las §8 de los módulos.**
`10` §3 conserva las **reglas** de navegación —qué es ruta y qué es modal,
grupos, estado en la URL, rutas de sistema por segmento— que son diseño y se
deciden. El **inventario** pasa a ser una vista generada, y un test falla el
build si una superficie declara una ruta que el mapa no tiene o al revés.

Es la tercera vez que el corpus aplica este remedio: `40` §2 con el catálogo
de comandos, `45` `RUL-CONF-08` con las páginas legales, y ahora las rutas.
Las tres nacieron del mismo defecto —dos listas mantenidas a mano— y las tres
se cierran igual.

### 5.4 Dos correcciones más

**`/movimientos/importar` estaba en el mapa y ya no va en V1.** El módulo `29`
difirió la importación de archivos a V1.1. La ruta se queda en el mapa marcada
como `V1.1`, no se borra: borrarla haría perder la razón por la que existe.

**Tres páginas públicas no tienen módulo dueño.** `/terminos`, `/empresa` y
`/contacto` existen en el código y ningún documento las reclama. Es la
situación exacta que produjo `C-14` y `C-16`: una página que el producto
publica y que ningún dueño mantiene.

| Página | Dueño asignado | Por qué |
|---|---|---|
| `/terminos` | `45` | Va versionada junto al consentimiento (`RUL-CONF-05`) |
| `/empresa` | `45` | Requisito de la verificación de Google, mismo bloque legal |
| `/contacto` | `48` | Es una superficie de soporte |

`/contacto` y `/ayuda/contacto` **no son la misma pantalla y las dos se
quedan.** La primera es pública y existe porque la verificación de Google la
exige; la segunda es el formulario dentro de la app, con `trace_id` y contexto
adjunto (`48` §6). Quien no tiene sesión no puede usar la segunda.

---

## 6. Endpoints

**187 endpoints declarados** en las secciones de API de 20 documentos.

| Doc | Endpoints | Doc | Endpoints |
|---|---|---|---|
| `24` | 14 | `35` | 8 |
| `25` | 13 | `36` | 10 |
| `26` | 9 | `37` | 8 |
| `27` | 11 | `38` | 4 |
| `28` | 18 | `39` | 4 |
| `29` | 9 | `41` | 9 |
| `30` | 12 | `43` | 9 |
| `31` | 13 | `45` | 8 |
| `32` | 12 | `46` | 5 |
| `33` | 4 | | |
| `34` | 7 | **Total** | **187** |

Hoy existen **58 rutas** en `src/app/api/v1/`. La diferencia no es el trabajo
pendiente: buena parte de los 187 son operaciones que hoy viven dentro de
rutas más grandes y que el corpus separa, y buena parte de las 58 se conservan
tal cual. El reparto exacto lo hace el documento `52`, que es quien mira el
árbol de código.

Lo que sí sale de aquí es una cifra para el documento `15`: cada uno de los
187 declara en la §11 de su módulo si necesita service-role, y hoy **48 de las
58 rutas existentes lo usan**. La lista blanca de `AC-SEG-01` se construye
contra esta tabla, no contra el código actual.

---

## 7. Estados y su ciclo

Los seis estados de `49` §5, con quién los mueve:

```text
pendiente ──► implementado ──► verificado ──► validado
    │              │                │
    │              │                └──► verificado, sin validar   (G3 abierto)
    │              │
    │              └──► (revierte a pendiente si el test se marca skip)
    │
    ├──► derivado    (lo cubre un criterio transversal)
    └──► retirado    (con entrada en el decision log)
```

| Transición | Quién la hace | Qué la prueba |
|---|---|---|
| `pendiente` → `implementado` | Implementación | Hay código y la fila tiene `componente` o `endpoint` |
| `implementado` → `verificado` | CI | El test existe, pasa, y falla al revertir el cambio (`RUL-HECHO-02`) |
| `verificado` → `validado` | Producto | Registro de `USER` o `METRIC` en el ledger `55` |
| cualquiera → `derivado` | Este documento | Apunta al ID transversal que lo cubre |
| cualquiera → `retirado` | Decisión en `03` | La entrada existe |
| `verificado` → `pendiente` | CI | El test pasó a `skip` |

Esa última fila es la que hace que `RUL-HECHO-01` tenga consecuencias: marcar
un test como `skip` no deja el criterio en verde con una nota, lo **devuelve a
pendiente** y reabre el portón del corte.

---

## 8. Cómo se mantiene viva

**`RUL-TRAZ-06` — La matriz se genera, no se edita.** El generador lee los
documentos y el árbol de `src/`, y produce la tabla completa. Nadie escribe
una fila a mano.

**`RUL-TRAZ-07` — Un ID que el generador no puede resolver falla el build.**
Tres casos: token no registrado, ID citado sin definición, y criterio sin
nivel de evidencia o sin clase de prueba.

**`RUL-TRAZ-08` — La matriz se regenera en cada corte, no al final.** Un corte
del documento `54` no se declara cerrado sin una regeneración posterior a su
último commit.

**`RUL-TRAZ-09` — Lo que la matriz no puede derivar, lo declara vacío.** Nunca
lo adivina. Una columna vacía es información: dice que ese requisito no tiene
todavía componente, test o dueño. Rellenarla con una suposición convierte la
matriz en una fuente de falsos positivos, que es peor que no tenerla.

### 8.1 Las cuatro vistas que debe producir

| Vista | Para qué | Quién la usa |
|---|---|---|
| Por corte | Qué falta para cerrar `W-NN` | `54` |
| Por portón | Qué está construido, probado en real, validado | `54`, `55` |
| Huérfanos | IDs sin componente, sin test o sin corte | `51` |
| Regresión de alcance | Funciones `FUERA` con implementación | `07` (`AC-ALCANCE-02`) |

La cuarta es la menos obvia y la más útil: detecta que alguien implementó algo
que el alcance excluye. Es barata —cruza la matriz de `07` §3 contra las filas
con `componente` no vacío— y es la única defensa automática contra el modo más
común de que un V1 se convierta en un V2 sin que nadie lo decida.

---

## 9. Lo que apareció al cruzarlo por primera vez

Cuatro cosas, todas del mismo tipo: **el corpus sabía más que sus índices.**

1. **16 rutas existían en los módulos y no en el mapa** (§5.2), dos de ellas
   públicas y sin sesión.
2. **Una contradicción dura sobre la ruta más importante del producto**
   (§9.1).
3. **Tres páginas publicadas sin dueño** (§5.4).
4. **Una ruta en el mapa que el alcance ya había sacado de V1** (§5.4).

### 9.1 Dónde vive el Inicio

`10` §3 y `12` §5 decían que `/` es una portada pública y que el Inicio de la
app vive en `/inicio`. `39` `SCR-HOME-01` y `44` `SCR-ONB-01`, escritos entre
siete y diez documentos después, decían que el Inicio está en `/`. El código
actual tiene la app en `/`.

Cuatro documentos aprobados, dos posiciones, y **el alcance no tenía entrada
para una portada pública** que permitiera resolverlo leyendo: `07` no la
declaraba ni `IN` ni `FUERA`. Por eso no era una errata que corregir, sino una
decisión que tomar.

**Resuelto (`WEB-D151`):**

| Ruta | V1 |
|---|---|
| `/inicio` | El Inicio de la app. `SCR-HOME-01` |
| `/` | **Solo redirección.** Sin sesión, a `/entrar`. Con sesión, a `/inicio`. No renderiza nada propio |
| Portada pública de venta en `/` | `V1.1`, declarada en `07` §3.16 |

Deja el sitio hecho para la página de venta sin construirla ahora. El precio
es una redirección permanente en la raíz, que es barata y explícita.

Documentos corregidos: `39` §8, `44` §8, `10` §3.1, `12` §5, `07` §3.16.

---

## 10. Criterios de aceptación

- `AC-TRAZ-01` — Todo identificador del corpus tiene fila en la matriz.
  Evidencia: `TEST`. Clase: `corpus`.
- `AC-TRAZ-02` — Ningún token usado está fuera del registro de §2.
  Evidencia: `TEST`. Clase: `corpus`.
- `AC-TRAZ-03` — Ningún ID citado carece de definición. Evidencia: `TEST`.
  Clase: `corpus`.
- `AC-TRAZ-04` — Las 119 superficies declaran una línea `**Ruta:**`, con ruta
  o con tratamiento. Evidencia: `TEST`. Clase: `corpus`. **Agregado**
  (`51` §5, `WEB-D167`): su conjunto son las 119 `SCR-` y cierra por
  superficie, no de una vez. Medido al construir el generador (`W-01`):
  **37 de 119** la tienen hoy. Las 82 restantes viven en los 20 documentos
  que declaran superficies (`24`–`39`, `41`, `43`–`46`, `48`), y cada uno
  añade su línea al cerrar su propio `G1` en su corte dueño (§3.1 de `54`).
  `W-01` no lo cierra: construye el generador y el test que lo miden.
- `AC-TRAZ-05` — El inventario de rutas del mapa de `10` §3 coincide
  exactamente con el declarado por las §8. Evidencia: `TEST`. Clase: `build`.
- `AC-TRAZ-06` — Ninguna página publicada carece de documento dueño.
  Evidencia: `TEST`. Clase: `corpus`.
- `AC-TRAZ-07` — La matriz se regenera sin edición manual y el resultado es
  idéntico ejecutándola dos veces. Evidencia: `TEST`.
- `AC-TRAZ-08` — Ningún criterio en estado `verificado` tiene su test en
  `skip`. Evidencia: `TEST`. Clase: `build`.
- `AC-TRAZ-09` — Ninguna funcionalidad marcada `FUERA` en `07` §3 tiene fila
  con `componente` no vacío. Evidencia: `TEST`. Clase: `build`.
- `AC-TRAZ-10` — Todo criterio de `G3` cerrado como corte tiene `dueño` y
  `fecha_revision`. Evidencia: `TEST`. Clase: `corpus`.
- `AC-TRAZ-11` — Ningún endpoint de los 187 llega a producción con
  service-role fuera de la lista blanca de `15`. Evidencia: `TEST`. Clase: `build`.
- `AC-TRAZ-12` — Una regeneración posterior al último commit de cada corte
  existe antes de declararlo cerrado. Evidencia: `DOC`.

---

## 11. Fuera de alcance

Este documento no asigna clases de prueba (es del `51`), no reparte el código
existente (es del `52`), no define los cortes (es del `54`) y no lleva el
registro de sesiones con usuarios (es del `55`).

Tampoco es un panel: no muestra progreso porcentual. Un porcentaje sobre mil quinientos
identificadores heterogéneos no significa nada, y `WEB-D146` ya prohibió
cerrar portones parcialmente.

Para la fase de WhatsApp: el registro de tokens y el esquema se heredan tal
cual. Se añade un token por documento nuevo y las filas de `SCR-` del canal
web quedan marcadas como no aplicables, sin borrarse — la prueba de
agnosticismo de `21` necesita que las dos columnas existan a la vez.

---

## 12. Trazabilidad

| Elemento | Origen |
|---|---|
| Sistema de identificadores | `01_convenciones_y_plantillas.md` §3 |
| Niveles de evidencia y portones | `01` §4, `49_criterios_de_aceptacion_globales.md` §4 |
| Estados de un criterio | `49` §5 |
| Clases de prueba | `49` §6.1 |
| Regla ruta/modal | `10_sitemap_rutas_y_navegacion.md` §4 |
| Grupos de rutas y árbol | `12_arquitectura_app_web.md` §5 |
| Patrón "una lista mantenida a mano diverge" | `C-03`, `C-14`, `C-16`; `40` §2; `45` `RUL-CONF-08` |
| Decisiones nuevas | `WEB-D151`, `WEB-D152` |

| Contradicción | Estado |
|---|---|
| `/` vs `/inicio` como Inicio de la app | **Cerrada** con `WEB-D151`. No estaba en la lista `C-01`..`C-17` porque nació dentro de este corpus, no del anterior |
