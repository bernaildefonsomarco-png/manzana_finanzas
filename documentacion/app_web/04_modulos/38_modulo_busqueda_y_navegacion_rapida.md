# 38 — Módulo: Búsqueda y navegación rápida

**ID de módulo:** `MOD-BUSQUEDA`
**Bloque:** 04 — Módulos
**Alcance:** V1
**Fecha:** 26 de julio de 2026
**Docs fuente:** `docs/fase_6_visual/30_app_flow.md` §2.3 y §4.10 (pantalla `SEARCH`), `16_design_system_web.md` (paleta de comandos), `20b_capa_semantica_y_consulta_abierta.md`
**Documentos que dependen de este:** `39` (home), `41` (asistente)

---

## 1. Tesis y qué NO es

Hay dos preguntas distintas que la gente le hace a una aplicación, y confundirlas
es lo que rompe las dos:

```text
"¿dónde está el movimiento de Netflix?"    → buscar
"¿cuánto llevo gastado en suscripciones?"  → preguntar
```

La primera tiene una respuesta que **existe en una fila de la base de datos**.
La segunda tiene una respuesta que hay que calcular. La búsqueda resuelve la
primera, en milisegundos y sin ambigüedad; el asistente resuelve la segunda, y
para eso tiene toda la capa semántica de `20b`.

**La tesis de este módulo es que la búsqueda debe saber cuándo no es la
herramienta adecuada, y decirlo pasando el testigo** (`RUL-BUS-03`). Una
búsqueda que intenta contestar la segunda pregunta con coincidencias de texto
devuelve una lista de movimientos donde hacía falta un número, y el usuario no
sabe si le faltan cosas.

De ahí sale la corrección que cierra `C-11`. El diseño heredado mostraba un
**porcentaje de confianza** junto a los resultados, y ese porcentaje es el
síntoma de una búsqueda que adivina. La solución no es ocultar el número: es
que **la búsqueda sea determinista** (`RUL-BUS-02`). Si los resultados se
obtienen por filtros y coincidencia literal, no hay confianza que mostrar
porque no hay nada que estimar.

Y la segunda mitad del módulo: la **paleta de comandos**. Un mismo control
—teclado, una tecla— que busca, navega y dispara acciones. Es la diferencia
entre una aplicación que se usa con el ratón y una que se usa rápido.

**Qué NO es:**

- **No es el asistente.** No calcula, no agrega, no explica. Encuentra cosas
  que ya existen.
- **No es una búsqueda semántica.** No hay incrustaciones, ni puntuación de
  similitud, ni resultados "parecidos". Ver `RUL-BUS-02`.
- **No busca dentro de los correos.** El módulo 28 no guarda el cuerpo de los
  mensajes, así que no hay dónde buscar. Está FUERA y es una consecuencia de
  privacidad, no una limitación.
- **No ejecuta operaciones de dinero.** La paleta abre el formulario; el
  usuario confirma (`RUL-BUS-08`).

## 2. Alcance

| Nivel | Funcionalidad |
|---|---|
| **IN** | Búsqueda global sobre movimientos, deudas, cajas, cuentas, compromisos, categorías, presupuestos y metas. Filtros estructurados parseados de forma determinista. Paleta de comandos con teclado: buscar, navegar y ejecutar. Traspaso al asistente cuando la consulta no reduce a filtros. Búsquedas guardadas. Resultados que distinguen confirmados de pendientes. **Ningún porcentaje de confianza en ninguna superficie.** |
| **V1.1** | Rangos de monto en lenguaje natural ("entre 50 y 100"). Sugerencias predictivas mientras se escribe. Búsqueda dentro de los hilos del asistente. |
| **FUERA** | Búsqueda sobre el contenido de correos originales. Búsqueda semántica por similitud. Búsqueda entre usuarios. Ejecutar operaciones de dinero desde la paleta. |

## 3. Vocabulario

| Interno | Visible |
|---|---|
| `query`, `token`, `filtro parseado` | — |
| `match_score`, `relevance` | — (**nunca visibles**, `C-11`) |
| Paleta de comandos | Buscar o ir a… |
| `saved_search` | Búsqueda guardada |
| Traspaso al asistente | "Pregúntaselo a Manzana" |

Prohibido frente al usuario: `query`, `índice`, `relevancia`, `score`,
`coincidencia`, `confianza`, `semántico`, `embedding`, además de la lista
general de `04_glosario_y_lenguaje_visible.md` §10.

Los resultados se enuncian **por lo que son**, no por cómo se encontraron:

```text
Correcto:   3 movimientos de Netflix
Incorrecto: 3 coincidencias (92% de relevancia)
Incorrecto: Resultados aproximados para "netflix"
```

## 4. Entidades y datos

### 4.1 `saved_searches` — migración `063`

```sql
id        uuid pk
user_id   uuid not null
name      text not null
query     text not null
filters   jsonb not null default '{}'
created_at, updated_at, deleted_at
```

Único por `(user_id, name)` entre las no borradas, `name` de 1 a 60
caracteres.

Guarda **la consulta, no sus resultados**, por la misma razón que
`saved_reports` (`35` §4.1): unos resultados guardados quedan obsoletos en
cuanto el usuario registra algo.

### 4.2 Índices de búsqueda — migración `063`

La búsqueda es determinista y lexical, así que necesita índices de texto, no
un almacén vectorial:

```sql
-- Búsqueda por texto en la descripción y el comercio
create index if not exists movements_search_idx
  on public.movements
  using gin (to_tsvector('spanish', coalesce(description,'') || ' ' || coalesce(merchant,'')));

-- Coincidencia por prefijo para la paleta, que responde mientras se escribe
create extension if not exists pg_trgm;
create index if not exists movements_merchant_trgm_idx
  on public.movements using gin (merchant gin_trgm_ops);
```

Configuración `spanish` porque los movimientos se describen en español y el
lematizador importa: buscar "compras" debe encontrar "compra".

Las demás entidades —cuentas, cajas, deudas, categorías, presupuestos— se
buscan por nombre con `ILIKE` sobre conjuntos pequeños: un usuario tiene
decenas de cada cosa, no miles. **No se indexa lo que cabe en memoria.**

### 4.3 Lo que se busca, y con qué se identifica

| Entidad | Se busca por | Módulo |
|---|---|---|
| Movimientos | Descripción, comercio, monto exacto, fecha | `26` |
| Pendientes | Ídem, marcados aparte | `27` |
| Cuentas y cajas | Nombre, institución | `24` |
| Categorías y etiquetas | Nombre | `25` |
| Compromisos | Nombre, comercio | `30` |
| Deudas y personas | Nombre, persona relacionada | `31` |
| Presupuestos y metas | Categoría, nombre | `32` |
| Descubrimientos | Título | `34` |

## 5. Máquina de estados

No aplica a entidades: una búsqueda no persiste ni tiene ciclo de vida. Lo que
sí tiene estados es **la sesión de búsqueda**, y se especifica en §12.

Las búsquedas guardadas tienen el ciclo trivial `activa → borrada`.

## 6. Reglas de negocio

**`RUL-BUS-01` — Todo lo que se encuentra es del usuario**

La identidad se inyecta en el compilador de la consulta, **nunca se expresa en
el texto de búsqueda**. Es la misma regla que `WEB-D021` para la capa
semántica, y aquí importa igual: ninguna cadena que el usuario escriba puede
ampliar el conjunto de datos al que llega.

**`RUL-BUS-02` — La búsqueda es determinista: no hay nada que estimar**

La regla que cierra `C-11`.

Un resultado **coincide o no coincide**. No hay grados, no hay puntuación, no
hay "resultados aproximados". La consulta se reduce a:

```text
filtros estructurados  ∧  coincidencia de texto
```

Consecuencias, todas verificables:

- **No se calcula ninguna puntuación de similitud**, así que no hay ningún
  número que ocultar. `C-11` deja de ser una regla de copy y pasa a ser una
  propiedad del diseño.
- La misma consulta devuelve **siempre** los mismos resultados sobre los
  mismos datos.
- El orden es por fecha descendente, no por relevancia. Un orden por
  relevancia sería una puntuación con otro nombre.
- Si algo no se encuentra, se dice; no se rellena con lo más parecido.

```text
Correcto:
  No encontré movimientos con "netflis".
  ¿Quisiste decir "Netflix"? [Buscar Netflix]

Incorrecto:
  Resultados para "netflis" (relevancia 61%)
  → Netflix S/44.90
```

La corrección ortográfica del ejemplo correcto **es una sugerencia explícita
que el usuario acepta**, no un resultado disfrazado. La diferencia es que el
usuario sabe qué está mirando.

**`RUL-BUS-03` — Cuando no es búsqueda, se pasa el testigo**

Si la consulta no se reduce a filtros y texto, la búsqueda **no lo intenta**.
Ofrece el asistente, con la consulta ya escrita.

| Lo que se escribe | Qué hace la búsqueda |
|---|---|
| `netflix` | Busca |
| `netflix julio` | Busca, con filtro de fecha |
| `> 100` | Busca por monto |
| `comida en julio` | Busca, con filtros de categoría y fecha |
| `¿cuánto llevo en comida?` | **No busca.** Ofrece preguntar |
| `¿gasto más los fines de semana?` | **No busca.** Ofrece preguntar |
| `compárame julio con junio` | **No busca.** Ofrece preguntar |

Cómo se detecta, de forma determinista y sin modelo: la consulta **empieza por
una palabra interrogativa, contiene un signo de interrogación, o contiene un
verbo de cálculo** (cuánto, cuántos, compara, suma, promedio, total). Si nada
de eso ocurre, se busca.

```text
┌──────────────────────────────────────────────────┐
│ ¿cuánto llevo en comida?                         │
├──────────────────────────────────────────────────┤
│ Eso es una pregunta, y la puedo responder mejor  │
│ en la conversación.                              │
│ [Preguntárselo a Manzana]                        │
│                                                  │
│ O si buscabas movimientos:                       │
│ [Buscar "comida"]                                │
└──────────────────────────────────────────────────┘
```

**Las dos salidas se ofrecen siempre**, porque la detección puede fallar y el
usuario debe poder corregirla en un clic sin volver a escribir.

**`RUL-BUS-04` — Los filtros se parsean con reglas, no con el modelo**

Lo que la búsqueda entiende sin llamar a nadie:

| Patrón | Ejemplo | Se convierte en |
|---|---|---|
| Mes | `julio`, `jul 2025` | Rango de fechas |
| Relativo | `ayer`, `esta semana`, `este mes` | Rango, en `America/Lima` |
| Rango explícito | `1/7 - 15/7` | Rango |
| Monto exacto | `44.90`, `S/44.90` | Monto |
| Comparación | `> 100`, `< 50` | Monto |
| Categoría | Nombre de una categoría suya | Filtro |
| Cuenta | Nombre de una cuenta suya | Filtro |
| Tipo | `gasto`, `ingreso`, `transferencia` | Filtro |
| Etiqueta | `#viaje` | Filtro |
| Resto | Cualquier otra cosa | Texto libre |

Se parsea con reglas y no con el modelo por tres razones: es instantáneo,
siempre da lo mismo, y **es explicable**. La pantalla muestra qué entendió:

```text
Buscando: comida · julio 2026 · más de S/50
[×] comida   [×] julio 2026   [×] > S/50
```

Cada filtro reconocido es una etiqueta que se puede quitar. Un parser que no
enseña lo que entendió es indistinguible de uno que adivina.

**`RUL-BUS-05` — Los pendientes se distinguen, siempre**

Un movimiento confirmado y un pendiente sin confirmar **no son la misma cosa**
y no pueden mezclarse en una lista sin marca. Un pendiente todavía no es
dinero que se movió.

```text
Movimientos (3)
  14 jul   Netflix           S/44.90    Ocio
  14 jun   Netflix           S/44.90    Ocio
  14 may   Netflix           S/44.90    Ocio

Sin confirmar (1)
  26 jul   Netflix           S/44.90    detectado en tu correo
           [Confirmar]  [Ver]
```

Van en **grupos separados con encabezado**, nunca intercalados con un icono
diferenciador. Y los pendientes no suman en ningún conteo que la búsqueda
muestre.

**`RUL-BUS-06` — La paleta hace tres cosas y las distingue**

Una sola tecla —`Ctrl+K` o `⌘K`— abre un control con tres clases de resultado,
siempre en este orden:

```text
┌──────────────────────────────────────────────────┐
│ > presu                                          │
├──────────────────────────────────────────────────┤
│ IR A                                             │
│   Presupuestos                          /presupuestos │
├──────────────────────────────────────────────────┤
│ HACER                                            │
│   Crear un presupuesto                           │
├──────────────────────────────────────────────────┤
│ ENCONTRAR                                        │
│   Presupuesto de Alimentación · julio            │
│   3 movimientos con "presu"                      │
└──────────────────────────────────────────────────┘
```

El orden —ir, hacer, encontrar— no es arbitrario: es de menos a más
consecuencias. Navegar no cambia nada, hacer abre un formulario, encontrar
depende de los datos. Con el orden inverso, pulsar Enter demasiado rápido
llevaría a lo más costoso de deshacer.

**`RUL-BUS-07` — Enter nunca sorprende**

- El primer resultado va **preseleccionado y visiblemente resaltado**.
- `Enter` activa el resaltado. `Esc` cierra sin hacer nada.
- Si la consulta está vacía, `Enter` **no hace nada**: no ejecuta el primer
  elemento de una lista que el usuario no ha leído.
- Ningún elemento de la paleta ejecuta una operación de dinero
  (`RUL-BUS-08`).

**`RUL-BUS-08` — La paleta abre, no ejecuta**

"Crear un presupuesto" abre el formulario con lo que se pueda precargar.
Nunca crea nada. "Registrar gasto" abre el registro rápido. Nunca registra.

Misma frontera que `WEB-D047` (descubrimientos), `WEB-D038` (proyecciones) y
`RUL-NOTIF-11` (recordatorios), y aquí por un motivo propio: **la paleta se usa
a ciegas y a toda velocidad**, con el foco puesto en escribir. Es la
superficie de la aplicación donde un usuario tiene menos posibilidades de leer
antes de pulsar.

**`RUL-BUS-09` — La búsqueda vacía no muestra la nada**

Al abrir sin escribir:

1. Las **búsquedas guardadas**, si las hay.
2. Las **tres últimas búsquedas** de la sesión.
3. Los destinos más usados de la aplicación.

Nunca una pantalla en blanco con un cursor. Un buscador vacío es una pregunta
sin contexto, y la gente no sabe qué se puede buscar hasta que ve un ejemplo.

**`RUL-BUS-10` — El estado vive en la URL**

`/buscar?q=netflix&desde=2026-07-01&hasta=2026-07-31`

Igual que en reportes (`WEB-D056`): **criterios en la URL, nunca cifras ni
identificadores**. La URL se puede guardar en marcadores y funciona el botón
atrás; y quien la abra verá sus propios datos o nada.

**`RUL-BUS-11` — Modo discreto y sensibilidad**

- Los montos de los resultados se ocultan; las descripciones no. Buscar es
  encontrar, y sin la descripción no se encuentra nada.
- Las categorías marcadas como sensibles (`45`) **se buscan y se encuentran**:
  ocultarle a alguien sus propios datos en su propia búsqueda sería
  paternalismo, no privacidad.
- Las búsquedas recientes **no se guardan** en modo discreto, ni en el
  servidor ni en el navegador: son la huella más reveladora de este módulo.

## 7. Validaciones

| Campo | Regla |
|---|---|
| `q` | Máximo 200 caracteres; se recorta, no se rechaza |
| Rango de fechas parseado | `hasta >= desde`; máximo 366 días |
| Monto | Numérico, hasta 2 decimales |
| `saved_search.name` | 1–60 caracteres, único por usuario entre las no borradas |
| `saved_search.query` | No vacía, máximo 200 caracteres |
| Consulta con solo espacios | Se trata como vacía (`RUL-BUS-09`) |
| Caracteres de control | Se eliminan antes de parsear |

## 8. Superficies

**Referencia visual: parcial.** La pantalla `SEARCH` existe en
`docs/fase_6_visual/30_app_flow.md` §2.3 y §4.10, con sus estados. La paleta
de comandos es nueva y no tiene frame: su primitiva se define en
`16_design_system_web.md`.

### `SCR-BUS-01` — Paleta de comandos

Superposición. Se abre con `Ctrl+K` / `⌘K` desde cualquier pantalla, y desde
el icono de buscar de la cabecera.

Detalles que importan:

- Se abre **sobre** la pantalla actual, sin navegar. `Esc` devuelve el foco a
  donde estaba.
- Responde mientras se escribe, con retardo de 150 ms para no consultar en
  cada tecla.
- El bloque ENCONTRAR se rellena el último y **no desplaza** lo que ya está
  arriba al llegar: mover los resultados bajo el cursor mientras alguien
  decide es la forma más fácil de que active lo que no quería.

### `SCR-BUS-02` — Búsqueda completa

**Ruta:** `/buscar`
**Estado en URL:** `q`, `desde`, `hasta`, `categoria`, `cuenta`, `tipo`

```text
┌──────────────────────────────────────────────────┐
│ 🔍 comida julio > 50                    [Guardar]│
│ [×] comida  [×] julio 2026  [×] más de S/50      │
├──────────────────────────────────────────────────┤
│ Movimientos (7)                                  │
│  22 jul  Almuerzo con Ana    S/68.00  Alimentación│
│  18 jul  Chifa               S/52.00  Alimentación│
│  ...                              [Ver los 7]    │
├──────────────────────────────────────────────────┤
│ Sin confirmar (1)                                │
│  26 jul  Rappi               S/61.50  del correo │
│                            [Confirmar]  [Ver]    │
├──────────────────────────────────────────────────┤
│ Otros                                            │
│  Presupuesto de Alimentación · julio             │
├──────────────────────────────────────────────────┤
│ ¿Buscabas cuánto llevas gastado en comida?       │
│ [Preguntárselo a Manzana]                        │
└──────────────────────────────────────────────────┘
```

- Los filtros reconocidos son **etiquetas quitables** (`RUL-BUS-04`).
- Confirmados y sin confirmar, en grupos separados (`RUL-BUS-05`).
- La última fila es el puente al asistente, ofrecido **también cuando la
  búsqueda sí funcionó**: encontrar siete movimientos no significa que fuera
  lo que el usuario quería.

### `SCR-BUS-03` — Sin resultados

```text
No encontré nada con "netflis".

¿Quisiste decir "Netflix"?     [Buscar Netflix]
¿O prefieres preguntarlo?      [Preguntárselo a Manzana]

También puedes:
  [Ver todos los movimientos]  [Registrar uno nuevo]
```

Tres salidas y ninguna vía muerta. La corrección ortográfica se calcula por
distancia sobre los comercios que el usuario ya tiene, **no sobre un
diccionario general**: solo se sugiere lo que existe en sus datos.

### `SCR-BUS-04` — Búsquedas guardadas

**Ruta:** `/buscar/guardadas`

Lista con nombre y una línea que describe qué busca. Abrir una restaura la URL
completa.

### `SCR-BUS-05` — Traspaso al asistente

Al aceptar el traspaso, se abre el asistente **con la consulta ya escrita y
sin enviar**. El usuario la puede ajustar antes.

No se envía sola porque la consulta venía de un cuadro de búsqueda, donde se
escribe en telegrama. Dejarla editable es reconocer que en conversación puede
querer decirlo de otra forma.

## 9. Acciones

| ID | Acción | ¿Confirma? | Deshacer | Evento |
|---|---|---|---|---|
| `ACT-BUS-01` | Abrir la paleta | No | `Esc` | `busqueda.paleta_abierta` |
| `ACT-BUS-02` | Buscar | No | — | `busqueda.ejecutada` |
| `ACT-BUS-03` | Quitar un filtro reconocido | No | Reescribiéndolo | `busqueda.filtro_quitado` |
| `ACT-BUS-04` | Abrir un resultado | No | Atrás | `busqueda.resultado_abierto` |
| `ACT-BUS-05` | Aceptar una corrección ortográfica | No | — | `busqueda.correccion_aceptada` |
| `ACT-BUS-06` | Pasar al asistente | No | Atrás | `busqueda.traspaso_asistente` |
| `ACT-BUS-07` | Guardar la búsqueda | No | Eliminándola | `busqueda.guardada` |
| `ACT-BUS-08` | Eliminar una guardada | Sí | Restaurando | `busqueda.guardada_eliminada` |
| `ACT-BUS-09` | Ir a un destino desde la paleta | No | Atrás | `busqueda.navegacion` |
| `ACT-BUS-10` | Abrir un formulario desde la paleta | No | Cerrándolo | `busqueda.accion_abierta` |
| `ACT-BUS-11` | Confirmar un pendiente desde los resultados | Sí | Por el módulo 27 | `pendiente.confirmado` |

`ACT-BUS-11` es la única que escribe, **y no es de este módulo**: delega
íntegra en el módulo 27, con su tarjeta y sus reglas. Aparece aquí porque
encontrar un pendiente y tener que ir a otra pantalla para confirmarlo es
fricción sin motivo.

## 10. API

| Método y ruta | Notas |
|---|---|
| `GET /search` | Global. `q`, filtros, `limit`. Devuelve por entidad |
| `GET /search/palette` | Reducida y rápida para la paleta. Bajo 150 ms |
| `GET /search/suggest` | Corrección ortográfica sobre los comercios del usuario |
| `GET /saved-searches` · `POST` · `DELETE` | Búsquedas guardadas |

`GET /search` devuelve los resultados **agrupados por entidad**, no en una
lista mezclada y ordenada por relevancia. Devolver una lista única obligaría a
puntuar para ordenarla, que es exactamente lo que `RUL-BUS-02` prohíbe.

Ninguna respuesta incluye puntuación, relevancia ni confianza. **No existe el
campo.**

`GET /search/palette` consulta menos entidades y con límites más bajos, porque
responde mientras se escribe. Es una ruta aparte y no un parámetro para que su
presupuesto de latencia sea suyo.

## 11. Permisos y RLS

- Cliente autenticado en todas las rutas. **Ninguna excepción de
  service-role**: no hay ningún trabajo de fondo en este módulo.
- La identidad se inyecta en el compilador (`RUL-BUS-01`); el texto de
  búsqueda **nunca llega crudo a una consulta**. Parámetros vinculados,
  siempre.
- RLS por `user_id` en `saved_searches`, y en todas las tablas consultadas.
- Las búsquedas recientes se guardan **solo en el navegador**, nunca en el
  servidor, y no en modo discreto (`RUL-BUS-11`).

La tercera es una decisión de privacidad con coste: no se sincronizan entre
dispositivos. A cambio, el historial de lo que alguien buscó sobre su propio
dinero no existe en ningún sitio que podamos perder.

## 12. Estados de datos

| Estado | Qué se muestra |
|---|---|
| **Inicial, sin escribir** | Guardadas, recientes y destinos (`RUL-BUS-09`) |
| **Escribiendo, menos de 2 caracteres** | No se consulta nada |
| **Cargando** | Esqueleto en el panel de resultados, con lo anterior visible atenuado |
| **Con resultados** | Agrupados por entidad, confirmados y pendientes separados |
| **Sin resultados** | `SCR-BUS-03`, con tres salidas |
| **Consulta que es una pregunta** | Traspaso, con la opción de buscar igual |
| **Solo pendientes coinciden** | Se muestran, diciendo que no hay confirmados |
| **Cuenta sin datos** | "Todavía no hay nada que buscar." + registrar |
| **Error de la búsqueda** | "No pude buscar ahora. Puedes filtrar los movimientos a mano." + enlace |
| **Modo discreto** | Descripciones visibles, montos ocultos, sin guardar recientes |

La fila de carga tiene un matiz que importa: **lo anterior se queda visible y
atenuado**, no se borra. Vaciar la pantalla en cada pulsación produce un
parpadeo que hace la búsqueda inutilizable al escribir rápido.

## 13. Errores

| ID | Causa | Mensaje visible | Salida |
|---|---|---|---|
| `ERR-BUS-01` | Rango de fechas inválido | "Esa fecha de fin va antes que la de inicio." | Corregir |
| `ERR-BUS-02` | Rango mayor de 366 días | "Puedo buscar en un año a la vez." | Acortar |
| `ERR-BUS-03` | Nombre de búsqueda duplicado | "Ya tienes una búsqueda con ese nombre." | Cambiar |
| `ERR-BUS-04` | Búsqueda guardada no encontrada | "Esa búsqueda guardada ya no existe." | Ver las demás |
| `ERR-BUS-05` | Fallo de la consulta | "No pude buscar ahora. Puedes filtrar los movimientos a mano." | Ir a movimientos |

`ERR-BUS-05` ofrece la alternativa **manual**, no reintentar. Si la búsqueda
falla, el usuario sigue teniendo un listado con filtros que funciona.

## 14. Integración con el motor IA

### 14.1 Consultas que expone

Este módulo **no aporta dimensiones ni medidas nuevas**: busca sobre las que
ya existen. Lo que sí aporta es una capacidad transversal:

| Dimensión | Notas |
|---|---|
| `coincide_texto` | Filtro de texto libre aplicable a cualquier consulta |

`coincide_texto` permite que el asistente responda *"¿cuánto llevo en cosas
que digan 'taxi'?"* combinando el filtro de texto de este módulo con la
agregación de la capa semántica. Es la unión de las dos preguntas del §1, y es
legítima porque la hace el asistente, no la búsqueda.

### 14.2 Comandos que acepta

| Comando | Confirmación |
|---|---|
| `guardar_busqueda` | No |
| `eliminar_busqueda_guardada` | Tarjeta |

Solo dos, y ninguno toca dinero. Buscar no es un comando: es una consulta.

### 14.3 Qué se puede pedir en lenguaje natural

```text
"busca netflix"                    → búsqueda literal
"guárdame esta búsqueda"           → guardar_busqueda
"¿dónde está el gasto de Ana?"     → búsqueda, aunque venga como pregunta
```

La tercera es el caso simétrico de `RUL-BUS-03`: la búsqueda pasa las
preguntas al asistente, y el asistente devuelve a la búsqueda lo que es
localizar una cosa. **El testigo va en las dos direcciones.**

### 14.4 Lo que el motor NO puede hacer aquí

- Mostrar relevancia, puntuación o confianza. **El campo no existe**
  (`RUL-BUS-02`).
- Ejecutar una acción desde un resultado sin la tarjeta del módulo que la
  posee.
- Buscar sobre datos de otro usuario. No existe la vía técnica.
- Buscar en el contenido de correos. No hay dónde: no se almacena.

## 15. Memoria y aprendizaje

| Qué aprende | De dónde | Cómo se corrige |
|---|---|---|
| Qué destinos usa más en la paleta | Navegaciones | — |
| Qué busca a menudo | Consultas repetidas | — |
| Si usa la paleta o el buscador completo | Cuál abre | — |

Los tres son **preferencias** (`RUL-MEM-01`): ordenan los destinos de la
paleta y sugieren guardar una búsqueda repetida tres veces. No se confirman y
no alimentan el perfil de `20c`.

Lo que **no** se aprende: nada sobre el contenido de las búsquedas. Que
alguien busque "farmacia" tres veces no genera ningún hecho sobre esa persona
(`RUL-MEM-11`).

## 16. Eventos y telemetría

Eventos: `busqueda.paleta_abierta`, `.ejecutada`, `.sin_resultados`,
`.filtro_quitado`, `.resultado_abierto`, `.correccion_aceptada`,
`.traspaso_asistente`, `.guardada`, `.navegacion`, `.accion_abierta`.

**Sin el texto de la consulta.** Sí longitud, número de filtros reconocidos,
número de resultados, entidad del resultado abierto y `trace_id`.

Que no se registre el texto es una decisión de privacidad deliberada, y tiene
coste: no se puede analizar qué busca la gente. Se acepta porque el texto de
lo que alguien busca sobre su dinero es de las cosas más reveladoras que
produce este producto.

| Métrica | Qué indica |
|---|---|
| Búsquedas sin resultados | Si el parseo o los índices fallan |
| **Traspasos al asistente aceptados** | Si `RUL-BUS-03` acierta al detectar preguntas |
| Traspasos ofrecidos y no aceptados | Si se ofrece de más |
| Filtros reconocidos por búsqueda | Si `RUL-BUS-04` cubre lo que la gente escribe |
| Uso de la paleta frente al buscador | Si la tecla se descubre |
| Correcciones ortográficas aceptadas | Si la sugerencia sirve |
| Resultados abiertos sobre búsquedas | Si lo que se encuentra es lo que se buscaba |

La segunda y la tercera se leen juntas: muchos traspasos aceptados significa
que la detección funciona; muchos ofrecidos y rechazados, que se está tratando
como pregunta lo que era una búsqueda.

## 17. Rendimiento

- Índices de la migración `063`: GIN sobre `to_tsvector('spanish', ...)` para
  el texto, y `gin_trgm_ops` sobre el comercio para el prefijo de la paleta.
- `GET /search/palette` bajo **150 ms**. Es el presupuesto más estricto del
  producto y está justificado: se ejecuta mientras alguien escribe.
- `GET /search` bajo 300 ms.
- Retardo de 150 ms en el cliente antes de consultar, y **cancelación de la
  petición anterior** al escribir de nuevo. Sin cancelación, escribir rápido
  produce respuestas que llegan desordenadas y resultados que parpadean.
- Menos de 2 caracteres no consulta nada.
- Las entidades pequeñas —cuentas, cajas, categorías— **se resuelven contra el
  panorama ya cargado** (`20b` §4) cuando la búsqueda ocurre dentro de una
  conversación, sin ir a la base.
- Coste de modelo: **cero**. Todo el módulo es determinista, incluida la
  detección de preguntas de `RUL-BUS-03`.

## 18. Accesibilidad específica

- La paleta sigue el patrón `combobox` con `aria-expanded`,
  `aria-activedescendant` y `role="listbox"`; las flechas mueven la selección
  sin mover el foco del campo.
- El número de resultados se anuncia en `aria-live="polite"` al estabilizarse:
  "7 movimientos, 1 sin confirmar". **Nunca en cada pulsación.**
- Los grupos de resultados son encabezados reales, navegables.
- El estado "sin confirmar" se anuncia **con texto**, no solo con un color o
  un icono.
- `Esc` cierra la paleta y devuelve el foco al elemento que la abrió.
- El atajo se anuncia en el propio icono de buscar: "Buscar, Control K".
- Los filtros reconocidos son botones con etiqueta completa: "Quitar el filtro
  julio 2026".
- La corrección ortográfica se ofrece como enlace, no se aplica sola: aplicar
  una corrección automáticamente a un lector de pantalla le cambia el
  resultado bajo los pies.

## 19. Casos borde

1. **Consulta que es solo un número** (`44.90`). Se busca como monto exacto y
   también como texto. Los dos grupos se muestran.
2. **Comercio que se llama igual que una categoría.** Aparecen las dos, en sus
   grupos.
3. **Consulta con el nombre de una categoría archivada.** Se busca igual: los
   movimientos históricos existen.
4. **Búsqueda que solo encuentra pendientes.** Se muestran, diciendo que no
   hay confirmados. No se presenta como "sin resultados".
5. **Consulta de 200 caracteres.** Se recorta y se dice, en vez de rechazarla.
6. **Consulta con emoji o caracteres de control.** Los de control se eliminan;
   los emoji se buscan como texto, porque una descripción puede llevarlos.
7. **Usuario sin ningún movimiento que abre la paleta.** Los bloques IR A y
   HACER funcionan igual. La paleta es útil desde el primer minuto.
8. **Dos búsquedas guardadas que devuelven lo mismo.** Se permite: los nombres
   son del usuario y puede tener motivos.
9. **Búsqueda guardada cuya categoría se eliminó.** Se abre y se dice que ese
   filtro ya no aplica, sin borrar la guardada.
10. **Pregunta que además contiene un término buscable** (*"¿cuánto llevo en
    Netflix?"*). Se ofrece el traspaso **y** los resultados de "Netflix". Las
    dos cosas, no una elección.
11. **Escribir muy rápido y borrar.** La cancelación de peticiones garantiza
    que no aparezcan resultados de una consulta ya abandonada.
12. **Modo discreto activado con búsquedas recientes ya guardadas.** Se ocultan
    y **se borran del navegador**, no solo se dejan de mostrar.

El caso 12 es el que distingue una función de privacidad de una función
cosmética.

## 20. Criterios de aceptación

- `AC-BUS-01` — **Ninguna respuesta de API incluye puntuación, relevancia ni
  confianza; el campo no existe.** Cierra `C-11`. Evidencia: `CODE` + `TEST`.
- `AC-BUS-02` — La misma consulta sobre los mismos datos devuelve siempre los
  mismos resultados, en el mismo orden. Evidencia: `TEST`.
- `AC-BUS-03` — Los resultados se ordenan por fecha, nunca por relevancia.
  Evidencia: `CODE` + `TEST`.
- `AC-BUS-04` — Una consulta que es una pregunta ofrece el traspaso **y** la
  opción de buscar igual. Evidencia: `TEST` + `USER`.
- `AC-BUS-05` — La detección de preguntas es determinista y no llama al
  modelo. Evidencia: `CODE`.
- `AC-BUS-06` — Los filtros reconocidos se muestran como etiquetas quitables.
  Evidencia: `TEST` + `USER`.
- `AC-BUS-07` — Confirmados y pendientes van en grupos separados con
  encabezado, y los pendientes no suman en ningún conteo.
  Evidencia: `TEST`.
- `AC-BUS-08` — Ningún elemento de la paleta ejecuta una operación de dinero.
  Evidencia: `CODE` + `TEST`.
- `AC-BUS-09` — `Enter` con la consulta vacía no hace nada. Evidencia: `TEST`.
- `AC-BUS-10` — El texto de búsqueda nunca llega crudo a una consulta SQL.
  Evidencia: `CODE` + `TEST`.
- `AC-BUS-11` — La corrección ortográfica se calcula solo sobre los comercios
  del propio usuario, y se ofrece, no se aplica. Evidencia: `TEST`.
- `AC-BUS-12` — El texto de las consultas **no se registra** en telemetría.
  Evidencia: `CODE` + `TEST`.
- `AC-BUS-13` — Las búsquedas recientes no salen del navegador, y en modo
  discreto se borran de él. Evidencia: `TEST`.
- `AC-BUS-14` — `GET /search/palette` responde por debajo de 150 ms con 5.000
  movimientos. Evidencia: `TEST` + `METRIC`.
- `AC-BUS-15` — Escribir rápido no produce resultados de consultas
  abandonadas. Evidencia: `TEST`.
- `AC-BUS-16` — El estado de la búsqueda se restaura desde la URL, y la URL no
  contiene cifras ni identificadores. Evidencia: `TEST`.
- `AC-BUS-17` — La paleta es operable solo con teclado, y `Esc` devuelve el
  foco a su disparador. Evidencia: `TEST`.
- `AC-BUS-18` — El número de resultados se anuncia al estabilizarse, no en
  cada pulsación. Evidencia: `TEST`.
- `AC-BUS-19` — No se busca en el contenido de correos, porque no se almacena.
  Evidencia: `CODE`.

## 21. Fuera de alcance y puente a WhatsApp

**Diferido a V1.1:** rangos de monto en lenguaje natural, sugerencias
predictivas mientras se escribe, búsqueda dentro de los hilos del asistente.

**Prohibido, no diferido:** búsqueda sobre el contenido de correos originales
—no hay dónde buscar, porque no se guarda—, búsqueda semántica por similitud,
cualquier resultado con puntuación visible, y ejecutar operaciones de dinero
desde la paleta.

Puente a WhatsApp: **la búsqueda no cruza como pantalla, y en gran medida
tampoco como función.** En conversación no hay paleta de comandos ni cuadro de
búsqueda: hay una frase. Lo que en la app es "buscar netflix" allí es una
pregunta más, y la responde el asistente con la capa semántica.

Lo que sí cruza es `coincide_texto` (§14.1): el filtro de texto libre pasa a
ser una dimensión más del vocabulario, disponible en los dos canales. Es la
parte de este módulo que sobrevive al cambio de canal, y no por casualidad —
es la única parte que es un dato y no una interfaz.

## 22. Trazabilidad

**Documentos de `docs/` consumidos:** `docs/fase_6_visual/30_app_flow.md`
§2.3 (la pantalla `SEARCH`) y §4.10 (sus siete estados, que se conservan casi
literales en §12 y se amplían a diez).

De ahí se hereda también el estado *"Intento de acción: para [acción], ábrelo
y confirma — no ejecuta acción"*, que aquí se generaliza a `RUL-BUS-08` y se
extiende a la paleta.

**Qué se corrige de lo heredado:**

| De `30_app_flow.md` | Corrección |
|---|---|
| `SEARCH` descrita como "búsqueda natural" | Se separa en dos: búsqueda determinista y traspaso al asistente (`RUL-BUS-03`). "Natural" a secas es lo que llevaba al porcentaje de confianza |
| Estado "Error IA" | Renombrado y reencuadrado: la búsqueda no usa IA, así que su error no es de IA (`ERR-BUS-05`) |
| Resultados como lista única con "respuesta principal" | Agrupados por entidad. Una lista única obliga a puntuar para ordenarla |

**Contradicciones que cierra:**

`C-11` — *"Confianza humana (lenguaje) vs. porcentaje visible en búsqueda."*
Se cierra por construcción y no por copy: `RUL-BUS-02` elimina el cálculo de
relevancia, y `AC-BUS-01` verifica que el campo **no exista** en ninguna
respuesta. La regla de lenguaje del glosario §7.3 sigue vigente para el resto
del producto, pero aquí ya no hace falta, porque no hay nada que ocultar.

Es la segunda vez en el corpus que se prefiere una imposibilidad estructural a
una prohibición: la primera fue `WEB-D046`, con los scores de los
descubrimientos, y por el mismo motivo.

**Decisiones tomadas en este documento**, registradas en
`03_decisiones_producto_web.md`:

| Decisión | ID | Alternativa descartada | Razón |
|---|---|---|---|
| La búsqueda es determinista, sin puntuación | `WEB-D074` | Búsqueda semántica con relevancia | El porcentaje de confianza era el síntoma de una búsqueda que adivina. Sin estimación no hay número que ocultar, y `C-11` deja de ser una regla de copy |
| Buscar y preguntar son cosas distintas, con traspaso | `WEB-D075` | Un solo cuadro que hace las dos | Una búsqueda que intenta responder preguntas devuelve una lista donde hacía falta un número, y el usuario no sabe si le faltan cosas |
| La detección de preguntas es por reglas, no por modelo | `WEB-D076` | Clasificar la intención con el modelo | Instantáneo, siempre igual y explicable. Y ambas salidas se ofrecen siempre, así que un fallo cuesta un clic |
| Los filtros reconocidos se muestran como etiquetas quitables | `WEB-D077` | Aplicarlos en silencio | Un parser que no enseña lo que entendió es indistinguible de uno que adivina |
| Resultados agrupados por entidad, ordenados por fecha | `WEB-D078` | Lista única ordenada por relevancia | Una lista única obliga a puntuar para ordenarla, que es justo lo que `WEB-D074` elimina |
| La paleta abre, nunca ejecuta | `WEB-D079` | Acciones directas desde la paleta | Es la superficie donde el usuario tiene menos posibilidades de leer antes de pulsar: se usa a ciegas y a toda velocidad |
| El texto de las búsquedas no se registra ni se sincroniza | `WEB-D080` | Guardar el historial en el servidor | Lo que alguien busca sobre su dinero es de lo más revelador que produce el producto. El coste —no sincroniza entre dispositivos— es menor que el riesgo |
