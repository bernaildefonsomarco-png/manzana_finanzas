# 25 — Módulo: Categorías, subcategorías y etiquetas

**ID de módulo:** `MOD-CATEGORIAS`
**Bloque:** 04 — Módulos
**Estado:** V1
**Fecha:** 25 de julio de 2026
**Docs fuente:** `docs/fase_2_estrategia/alcance_v1/05f_categorias.md` (reutilizado), `docs/fase_4_tecnica/16_modelo_datos.md` §9
**Documentos que dependen de este:** `26` (movimientos), `32` (presupuestos), `34` (descubrimientos), `35` (reportes), `36` (memoria)

---

## 1. Tesis y qué NO es

Las categorías convierten una lista de movimientos en una respuesta a "¿en
qué se me va la plata?". Son la dimensión sobre la que se apoyan
presupuestos, reportes y descubrimientos: sin clasificación fiable, esos tres
módulos no tienen nada que decir.

Tres niveles con propósitos distintos:

| Nivel | Qué responde | Quién lo define |
|---|---|---|
| **Categoría** | ¿De qué tipo es este gasto? | El sistema. 12 fijas, canónicas |
| **Subcategoría** | ¿Qué exactamente dentro de ese tipo? | El usuario, con sugerencias |
| **Etiqueta** | ¿En qué circunstancia ocurrió? | Inferida o puesta por el usuario |

**Qué NO es:**

- No es un plan contable. Las 12 categorías no crecen ni se personalizan.
- No es obligatorio. Un movimiento sin categoría es válido y no bloquea nada.
- No es un juicio. Una etiqueta `impulso` describe un patrón, no acusa a la
  persona.
- No sustituye al tipo de movimiento. Un `pago_deuda` no es "un gasto de la
  categoría Deudas": es otro tipo de operación que además puede clasificarse.

## 2. Alcance

| Nivel | Funcionalidad |
|---|---|
| **IN V1-web** | Las 12 categorías canónicas. Subcategorías propias del usuario: crear, renombrar, fusionar, archivar. Etiquetas: 8 base más propias. Clasificación automática con corrección. Distinción `otros` ≠ `sin clasificar`. Reclasificación masiva desde un listado filtrado. Normalización de variantes al crear subcategorías. Ver por qué se clasificó algo. |
| **V1.1** | Reglas explícitas del usuario ("todo lo de X va a Y"). Iconos y colores propios por subcategoría. Sugerencia de fusión cuando dos subcategorías se solapan. |
| **FUERA** | Cambiar el conjunto de 12 categorías base. Jerarquías de más de dos niveles. Categorías compartidas entre usuarios. Reclasificación automática retroactiva sin confirmación. |

## 3. Vocabulario

| Interno | Visible |
|---|---|
| `Category` | Categoría |
| `UserSubcategory` | Detalle / Subcategoría |
| `Tag` | Etiqueta |
| `classification_status: needs_review` | Por revisar |
| `category_id: null` | Sin clasificar |
| `otros` | Otros |
| `confidence` | **No se muestra nunca como porcentaje** (`C-11`) |

## 4. Entidades y datos

### 4.1 `categories` — semilla global, 12 filas

```sql
id          text primary key
label       text not null
description text null
is_system   boolean not null default true
sort_order  int not null
```

Las 12, con lo que incluyen y con qué no debe confundirse:

| `id` | Visible | Incluye |
|---|---|---|
| `alimentacion` | Alimentación | café, delivery, restaurante, menú, mercado, snacks |
| `transporte` | Transporte | taxi, apps de viaje, bus, gasolina, peajes, estacionamiento |
| `vivienda_hogar` | Vivienda / Hogar | alquiler, mantenimiento, limpieza, muebles |
| `servicios_suscripciones` | Servicios / Suscripciones | luz, agua, internet, celular, streaming, software mensual |
| `salud` | Salud | farmacia, consultas, terapia, exámenes, seguro médico |
| `educacion` | Educación | universidad, cursos, libros, materiales, certificaciones |
| `ocio_salidas` | Ocio / Salidas | cine, bares, videojuegos, eventos, hobbies |
| `compras_personales` | Compras personales | ropa, tecnología personal, belleza, accesorios |
| `familia_apoyo` | Familia / Apoyo | regalos, apoyo a familiares, aportes |
| `deudas` | Deudas | cuotas, intereses, pagos de préstamo o tarjeta |
| `trabajo_productividad` | Trabajo / Productividad | herramientas, coworking, software laboral |
| `otros` | Otros | movimientos claros que no encajan en ninguna anterior |

**No se crean categorías base nuevas por usuario, nunca.** Si algo no encaja,
existe `otros` y existen las subcategorías.

### 4.2 `user_subcategories`

```sql
id                uuid pk
user_id           uuid not null
category_id       text not null references categories(id)
label             text not null
normalized_label  text not null
created_by        text not null    -- usuario | sugerencia | aprendizaje
created_at, updated_at, deleted_at, metadata
```

Restricción: único parcial `(user_id, category_id, normalized_label)` entre
activas. `normalized_label` es el `label` en minúsculas, sin tildes y sin
espacios extremos — es lo que evita que "Café", "cafe" y "CAFÉ" convivan.

### 4.3 `tags` y `movement_tags`

```sql
tags:
  id uuid pk, user_id uuid null, key text not null,
  label text not null, type text not null,
  is_system boolean not null default false, created_at, metadata

movement_tags:
  movement_id uuid, tag_id uuid, source text, confidence numeric,
  status text     -- suggested | confirmed
```

`user_id` nulo indica etiqueta del sistema, compartida. Las 8 base:

| `key` | Visible | Qué señala |
|---|---|---|
| `necesario` | Necesario | Gasto difícil de evitar |
| `gusto` | Gusto | Elegido para disfrutar |
| `impulso` | Impulso | No planeado |
| `recurrente` | Recurrente | Se repite |
| `social` | Social | Con otras personas |
| `trabajo` | Trabajo | Ligado a lo laboral |
| `estres` | Estrés | Posiblemente ligado a tensión |
| `fin_de_semana` | Fin de semana | Patrón temporal |

`estres` es la más delicada: describe una hipótesis, no un diagnóstico. No
aparece en mensajes proactivos ni con modo discreto activo.

### 4.4 Migraciones requeridas

Ninguna nueva. Las tablas existen desde las migraciones `007` y `030`.

## 5. Máquina de estados

### 5.1 Estado de clasificación de un movimiento

```text
      registrado
          │
    ┌─────┴─────┐
    ▼           ▼
sin_clasificar  clasificado
(category_id     │
 = null,         ├──► corregido por el usuario  ──► clasificado
 needs_review)   │
    │            └──► reclasificado en lote     ──► clasificado
    └──► el usuario o el sistema clasifica ──► clasificado
```

**Tres estados, no dos.** `sin_clasificar` y la categoría `otros` son cosas
distintas y no deben mezclarse jamás:

| Estado | Significado | `category_id` | `classification_status` |
|---|---|---|---|
| Sin clasificar | Todavía no sabemos qué es | `null` | `needs_review` |
| Otros | Sabemos qué es, no encaja en las 12 | `'otros'` | `classified` |
| Clasificado | Encaja en una categoría | id de categoría | `classified` |

Confundirlos rompe los reportes: `otros` es una respuesta, `sin clasificar`
es una pregunta abierta.

### 5.2 Subcategoría

```text
sugerida ──► aceptada ──► activa ──► archivada
   │                        │
   └──► descartada          └──► fusionada con otra
```

Archivar no borra: los movimientos que la usaban conservan su referencia y
siguen apareciendo en reportes históricos.

### 5.3 Etiqueta en un movimiento

```text
sugerida ──► confirmada    (el usuario la acepta o no la quita)
   │
   └──► rechazada          (el usuario la quita)
```

Una etiqueta rechazada alimenta evidencia negativa en la memoria
(`36_modulo_memoria_y_aprendizaje.md`).

## 6. Reglas de negocio

**`RUL-CAT-01` — `otros` no es `sin clasificar`**

Ya definido en §5.1. Consecuencia operativa: un reporte por categoría muestra
`Otros` como una barra más, y `Sin clasificar` como un aviso aparte con
acción de resolver.

**`RUL-CAT-02` — Ningún movimiento se bloquea por falta de categoría**

Registrar siempre gana. Un movimiento sin categoría se guarda, afecta saldos
y aparece en el historial. Solo queda marcado para revisar.

**`RUL-CAT-03` — La clasificación automática nunca es definitiva**

Cualquier clasificación puesta por el sistema es corregible sin fricción y
sin confirmación de riesgo. Corregir es tan barato como registrar.

**`RUL-CAT-04` — Una subcategoría pertenece a una sola categoría**

Cambiar la categoría de una subcategoría con movimientos asociados exige
confirmación, porque reclasifica todos esos movimientos.

Ejemplo: la subcategoría `uber` está en Transporte con 47 movimientos.
Moverla a Trabajo reclasifica los 47. Se avisa con el conteo antes.

**`RUL-CAT-05` — Normalización antes de crear**

Antes de crear una subcategoría se normaliza y se busca una equivalente. Si
existe, se reutiliza en vez de duplicar.

| El usuario escribe | Se normaliza a | Resultado |
|---|---|---|
| "Café", "cafe", "CAFÉ", " café " | `cafe` | Reutiliza la existente |
| "Uber", "uber " | `uber` | Reutiliza |
| "cafecito" | `cafecito` | **Nueva** — no se asume que es `cafe` |

La última fila es deliberada: normalizar mayúsculas y tildes es seguro;
asumir sinónimos no lo es. Si hay duda entre dos subcategorías existentes,
**no se crea una nueva automáticamente**: se pregunta.

**`RUL-CAT-06` — Cuándo se crea una subcategoría sola**

Se crea o sugiere cuando aparece repetidamente, tiene utilidad analítica, el
usuario la nombra explícitamente, y no duplica una existente.

**No** se crea cuando parece un error de tipeo, es una descripción única, es
sensible sin confirmación, o solo existe por falta de contexto.

**`RUL-CAT-07` — Fusionar subcategorías**

Fusionar mueve todos los movimientos de la origen a la destino y archiva la
origen. Es reversible durante 7 días (`23` §5b.4 no la cubre; se define aquí
como caso propio de este módulo).

Ejemplo: `uber` (47 movimientos) se fusiona con `taxi` (89).
→ `taxi` queda con 136, `uber` se archiva. Se avisa el conteo antes.

**`RUL-CAT-08` — Varias etiquetas por movimiento**

Un movimiento puede tener varias etiquetas simultáneas. No son excluyentes:
un almuerzo de trabajo el sábado puede ser `trabajo`, `social` y
`fin_de_semana`.

**`RUL-CAT-09` — Las etiquetas no bloquean nada**

Nunca son obligatorias, nunca impiden registrar, nunca cambian saldos.

**`RUL-CAT-10` — No se muestra confianza numérica**

Prohibido mostrar "87% de confianza" (`C-11`). Se usa el lenguaje de
incertidumbre del glosario: "parece", "por revisar", "confirmado".

**`RUL-CAT-11` — Categorías por tipo de movimiento**

No todos los tipos admiten categoría de la misma forma:

| Tipo | ¿Categoría? |
|---|---|
| `gasto`, `pago_recurrente` | Sí, obligatoria para reportes útiles |
| `ingreso` | Opcional; se usa para distinguir fuentes |
| `pago_deuda` | Se clasifica como `deudas` automáticamente |
| `transferencia`, `asignacion_interna` | **No.** No son gasto; no entran en reportes por categoría |
| `prestamo_dado`, `prestamo_recibido`, `devolucion_recibida`, `deuda_adquirida` | No; su significado lo da el módulo de deudas |
| `ajuste` | No |

La fila de transferencias es crítica: incluirlas en un reporte por categoría
inflaría el gasto con dinero que solo cambió de sitio.

**`RUL-CAT-12` — Reclasificación masiva**

Reclasificar en lote sigue el contrato de operaciones masivas
(`20` §8): conteo real, muestra de ejemplos, posibilidad de excluir, y
deshacer completo por lote.

## 7. Validaciones

| Campo | Regla |
|---|---|
| `category_id` | Debe existir en las 12. `null` es válido y significa sin clasificar |
| Subcategoría `label` | 1–40 caracteres. Se normaliza. Único por categoría y usuario |
| Subcategoría `category_id` | Obligatorio, una de las 12 |
| Etiqueta `label` | 1–24 caracteres. Única por usuario |
| Etiquetas por movimiento | Máximo 6. Más de eso deja de aportar significado |
| Fusión | Origen y destino distintas, de la misma categoría |

## 8. Superficies

### `SCR-CAT-01` — Gestión de categorías

**Ruta:** `/configuracion/categorias`

Lista las 12 con su total gastado en el periodo actual y sus subcategorías
colapsables. Las 12 no son editables ni eliminables; se indica visualmente
que son fijas, sin que parezca un error.

### `SCR-CAT-02` — Detalle de categoría

**Ruta:** `/configuracion/categorias/[id]`

Subcategorías con conteo de movimientos, acciones de renombrar, fusionar y
archivar, y enlace al listado de movimientos filtrado por esa categoría.

### `SCR-CAT-03` — Selector de categoría

Componente, no pantalla. Aparece en el formulario de movimiento, en la
edición y en el filtro de listados. Requisitos:

- Búsqueda por texto que atraviesa categorías y subcategorías.
- Muestra primero las más usadas por el usuario.
- Permite crear una subcategoría desde el propio selector.
- Permite dejar sin clasificar de forma explícita, no por omisión.

### `SCR-CAT-04` — Reclasificación masiva

Se invoca desde el listado de movimientos con selección múltiple. Muestra
conteo, ejemplos, destino y el efecto sobre presupuestos afectados.

### `SCR-CAT-05` — Por qué se clasificó así

Panel invocado desde el detalle de un movimiento. Muestra la evidencia en
lenguaje del usuario:

```text
Lo puse en Alimentación porque así clasificaste 8 de tus últimos
10 movimientos de Rappi.
[Cambiar categoría]   [Olvidar esto que aprendiste]
```

Es la materialización del principio de procedencia
(`08_principios_experiencia_web.md` §4.1) en este módulo.

## 9. Acciones

| ID | Acción | ¿Confirma? | Deshacer | Evento |
|---|---|---|---|---|
| `ACT-CAT-01` | Clasificar un movimiento | No | Reclasificando | `movimiento.clasificado` |
| `ACT-CAT-02` | Corregir clasificación | No | Reclasificando | `clasificacion.corregida` |
| `ACT-CAT-03` | Dejar sin clasificar | No | Clasificando | `clasificacion.removida` |
| `ACT-CAT-04` | Crear subcategoría | No | Archivando | `subcategoria.creada` |
| `ACT-CAT-05` | Renombrar subcategoría | No | Renombrando | `subcategoria.renombrada` |
| `ACT-CAT-06` | Fusionar subcategorías | **Sí, con conteo** | 7 días | `subcategoria.fusionada` |
| `ACT-CAT-07` | Archivar subcategoría | Sí si tiene movimientos | Restaurando | `subcategoria.archivada` |
| `ACT-CAT-08` | Mover subcategoría de categoría | **Sí, con conteo** | Moviendo de vuelta | `subcategoria.movida` |
| `ACT-CAT-09` | Añadir etiqueta | No | Quitando | `etiqueta.agregada` |
| `ACT-CAT-10` | Quitar etiqueta | No | Añadiendo | `etiqueta.removida` |
| `ACT-CAT-11` | Crear etiqueta propia | No | Archivando | `etiqueta.creada` |
| `ACT-CAT-12` | Reclasificar en lote | **Sí, masiva** | Por lote | `clasificacion.lote` |
| `ACT-CAT-13` | Ver por qué se clasificó | No | — | `explicacion.consultada` |

## 10. API

| Método y ruta | Qué hace |
|---|---|
| `GET /categories` | Las 12 con totales del periodo. Caché larga |
| `GET /subcategories` | Del usuario. Filtro: `category_id`, `include_archived` |
| `POST /subcategories` | Crea, normalizando y detectando duplicado |
| `PATCH /subcategories/[id]` | Renombra o cambia de categoría |
| `DELETE /subcategories/[id]` | Archiva |
| `POST /subcategories/[id]/merge` | Fusiona con otra. `Idempotency-Key` |
| `GET /tags` | Base más propias |
| `POST /tags` | Crea propia |
| `PATCH /movements/[id]/classification` | Clasifica o corrige un movimiento |
| `POST /classification/bulk` | Reclasificación masiva. `Idempotency-Key`. Devuelve `batch_id` |
| `POST /classification/bulk/[batch_id]/undo` | Deshace el lote |
| `GET /classification/catalog` | Catálogo completo para poblar selectores |
| `GET /movements/[id]/classification/why` | Evidencia de la clasificación |

`POST /classification/bulk` devuelve primero una **previsualización** cuando
se llama con `preview: true`: conteo real y muestra, sin escribir nada.

## 11. Permisos y RLS

- `categories` es semilla global de solo lectura: sin RLS por usuario, sin
  escritura desde la API.
- `user_subcategories`, `tags` propias y `movement_tags`: RLS por `user_id`.
- Cliente autenticado en todas las rutas. **Sin excepciones de service-role.**
- Una subcategoría de otro usuario devuelve 404.

## 12. Estados de datos

| Estado | Qué se muestra |
|---|---|
| **Sin movimientos** | Las 12 categorías con S/0.00 y explicación de para qué sirven. No se presenta como fracaso |
| **Pocos movimientos** | Categorías con datos; el resto atenuadas. Sin subcategorías todavía |
| **Con sin clasificar** | Aviso con conteo y acción de resolver: "Tienes 4 movimientos por clasificar" |
| **Muchas subcategorías** | Agrupadas por categoría, ordenadas por uso, con búsqueda |
| **Cargando** | Esqueleto con la forma de la lista |
| **Error** | Mensaje en español con reintento |
| **Modo discreto** | Los totales por categoría se ocultan; los nombres de categoría se mantienen |

## 13. Errores

| ID | Causa | Mensaje visible | Salida |
|---|---|---|---|
| `ERR-CAT-01` | Subcategoría duplicada tras normalizar | "Ya tienes «Café» en Alimentación." | Usar la existente |
| `ERR-CAT-02` | Categoría inexistente | "Esa categoría no existe." | Elegir otra |
| `ERR-CAT-03` | Fusionar con ella misma | "No puedo fusionar una subcategoría consigo misma." | Elegir otra |
| `ERR-CAT-04` | Fusionar entre categorías distintas | "Solo puedo fusionar subcategorías de la misma categoría." | Mover primero |
| `ERR-CAT-05` | Más de 6 etiquetas | "Un movimiento puede tener hasta 6 etiquetas." | Quitar alguna |
| `ERR-CAT-06` | Categoría en tipo que no la admite | "Las transferencias no llevan categoría: no son un gasto." | Entendido |
| `ERR-CAT-07` | Lote vacío | "No hay movimientos que coincidan con eso." | Cambiar el filtro |
| `ERR-CAT-08` | Deshacer lote fuera de plazo | "Ese cambio ya no se puede deshacer en bloque, pero puedes corregir los movimientos." | Ir al listado |
| `ERR-CAT-09` | Nombre de subcategoría vacío o muy largo | "El nombre debe tener entre 1 y 40 caracteres." | Corregir |

## 14. Integración con el motor IA

### 14.1 Consultas que expone

Entidades: `categorias`, `subcategorias`, `etiquetas`.

| Dimensión | Notas |
|---|---|
| `categoria` | Las 12, más el valor especial "sin clasificar" |
| `subcategoria` | Del usuario |
| `etiqueta` | Base y propias; un movimiento puede tener varias |
| `estado_clasificacion` | clasificado, por revisar |
| `origen_clasificacion` | usuario, sistema, aprendizaje |
| `admite_categoria` | Derivada de `RUL-CAT-11` |

| Medida | Qué calcula |
|---|---|
| `gasto_por_categoria` | Suma agrupable, excluyendo tipos que no admiten categoría |
| `conteo_por_categoria` | |
| `proporcion_del_gasto` | Porcentaje del total del periodo |
| `sin_clasificar` | Conteo y suma pendientes de revisar |

**Regla que el compilador aplica siempre:** las consultas de gasto por
categoría excluyen `transferencia`, `asignacion_interna` y `ajuste`. Es una
decisión del dominio, no del agente, y por eso vive en el compilador.

### 14.2 Comandos que acepta

| Comando | Confirmación |
|---|---|
| `clasificar_movimiento` | Tarjeta editable |
| `corregir_clasificacion` | Tarjeta editable |
| `crear_subcategoria` | Tarjeta |
| `renombrar_subcategoria` | Tarjeta |
| `fusionar_subcategorias` | **Riesgo, con conteo** |
| `mover_subcategoria` | **Riesgo, con conteo** |
| `agregar_etiqueta` / `quitar_etiqueta` | Tarjeta |
| `reclasificar_lote` | **Masiva**: conteo, muestra, exclusión, deshacer |

### 14.3 Qué se puede pedir en lenguaje natural

```text
"¿en qué gasto más?"                          → gasto_por_categoria
"el taxi de ayer es de trabajo"               → corregir_clasificacion + etiqueta
"reclasifica todos mis Rappi a Comida"        → reclasificar_lote (masiva)
"¿qué tengo sin clasificar?"                  → consulta de estado
"junta uber y taxi"                           → fusionar_subcategorias
"¿por qué pusiste esto en Salud?"             → explicación con evidencia
"marca esto como impulso"                     → agregar_etiqueta
```

La tercera es el caso canónico de operación masiva de todo el corpus
(`20` §8, `22` §7.1).

## 15. Memoria y aprendizaje

Este módulo es **la fuente principal de aprendizaje del producto**. Lo que se
aprende aquí:

| Qué | Evidencia | Cómo se corrige |
|---|---|---|
| Comercio → categoría ("Rappi" → Alimentación) | Clasificaciones confirmadas de ese comercio | Reclasificando |
| Comercio → subcategoría | Ídem | Reclasificando |
| Texto → categoría ("chifa" → Alimentación) | Repetición en descripciones | Corrigiendo |
| Patrones de etiqueta (viernes noche → social) | Confirmaciones | Quitando la etiqueta |
| Vocabulario propio del usuario | Cómo nombra sus subcategorías | Renombrando |

Reglas heredadas de `WEB-D023` y de la migración `044`:

- Cada corrección genera **evidencia negativa** contra la clasificación
  anterior, no solo positiva a favor de la nueva. Un aprendizaje puede
  degradarse, no solo reforzarse.
- Tras suficientes contradicciones, el aprendizaje pasa a `suspended` y el
  sistema deja de aplicarlo.
- El usuario puede ver, corregir y **olvidar** cualquier aprendizaje desde
  `SCR-CAT-05` o desde `/configuracion/memoria`.

## 16. Eventos y telemetría

Eventos: `movimiento.clasificado`, `clasificacion.corregida`,
`clasificacion.lote`, `subcategoria.creada`, `subcategoria.fusionada`,
`etiqueta.agregada`, `etiqueta.removida`, `explicacion.consultada`.

Nunca llevan el nombre del comercio ni el monto: solo el identificador de
categoría y el origen.

Métricas: proporción de movimientos sin clasificar, tasa de corrección de
clasificaciones automáticas (alta indica mal aprendizaje), subcategorías por
usuario, uso del "por qué".

La segunda métrica es la más importante del módulo: **si la gente corrige
mucho, el aprendizaje está fallando**, y eso erosiona la confianza en todo lo
demás.

## 17. Rendimiento

- `GET /categories` y `/classification/catalog`: caché larga, invalidada solo
  al modificar subcategorías o etiquetas.
- Índices: `user_subcategories (user_id, category_id, deleted_at)`,
  `movement_tags (movement_id)`, `movement_tags (tag_id)`.
- La agregación por categoría se resuelve en el servidor, nunca sumando en el
  cliente.
- Una reclasificación masiva se ejecuta por lotes en una transacción, con
  `batch_id` para poder deshacerla.
- Presupuesto: catálogo bajo 200 ms; previsualización de lote bajo 1 s.

## 18. Accesibilidad específica

- El selector de categoría es un `Combobox` accesible: se escribe para
  filtrar, las flechas navegan, se anuncia el número de resultados.
- Las categorías no se distinguen solo por color: siempre llevan su nombre.
- El estado "por revisar" se anuncia como texto, no solo con un punto.
- La reclasificación masiva anuncia el conteo antes de confirmar, en una
  región activa.

## 19. Casos borde

1. **El usuario escribe una subcategoría que ya existe con otra grafía.** Se
   reutiliza la existente y se le informa.
2. **Fusionar dos subcategorías con movimientos en presupuestos distintos.**
   Se recalculan ambos presupuestos y se avisa.
3. **Archivar una subcategoría con movimientos.** Los movimientos la
   conservan; sigue apareciendo en reportes históricos con marca de
   archivada.
4. **Movimiento de tipo transferencia con categoría heredada.** Al cambiar el
   tipo de un movimiento a transferencia, se le quita la categoría y se avisa.
5. **Reclasificar un lote que incluye movimientos ya corregidos a mano.** Se
   excluyen por defecto y se dice; el usuario puede incluirlos
   explícitamente.
6. **Etiqueta `estres` sugerida en un movimiento de salud.** No se sugiere:
   la combinación de categorías sensibles con etiquetas emocionales queda
   bloqueada.
7. **Más de 200 subcategorías.** Se sugiere revisar y fusionar; no se
   bloquea.
8. **Categoría `otros` creciendo mucho.** Si supera el 15% del gasto del
   periodo, se ofrece revisarla — es señal de que la clasificación no está
   funcionando.
9. **Deshacer un lote cuyos movimientos se editaron después.** Se deshacen
   solo los que no cambiaron, y se informa cuántos quedaron fuera.
10. **Movimiento importado sin descripción.** Queda sin clasificar; no se
    inventa categoría a partir del monto.

## 20. Criterios de aceptación

- `AC-CAT-01` — `sin clasificar` y `otros` son estados distintos en datos y
  en interfaz. Evidencia: `TEST` + `USER`.
- `AC-CAT-02` — Ningún movimiento se bloquea por falta de categoría.
  Evidencia: `TEST`.
- `AC-CAT-03` — Las 12 categorías base no se pueden crear, editar ni
  eliminar desde ninguna vía, incluido el asistente. Evidencia: `TEST`.
- `AC-CAT-04` — Crear una subcategoría que ya existe con otra grafía
  reutiliza la existente. Evidencia: `TEST`.
- `AC-CAT-05` — No se crea una subcategoría nueva automáticamente cuando hay
  duda entre dos existentes. Evidencia: `TEST`.
- `AC-CAT-06` — Las transferencias y asignaciones internas no aparecen en
  ningún reporte por categoría. Evidencia: `TEST`.
- `AC-CAT-07` — No se muestra confianza numérica en ninguna superficie.
  Evidencia: `TEST`.
- `AC-CAT-08` — Una reclasificación masiva muestra conteo real y muestra
  antes de ejecutar, y se puede deshacer entera. Evidencia: `TEST` + `USER`.
- `AC-CAT-09` — Cada corrección genera evidencia negativa contra la
  clasificación anterior. Evidencia: `TEST`.
- `AC-CAT-10` — El usuario puede ver por qué se clasificó algo, con evidencia
  concreta y sin jerga. Evidencia: `TEST` + `USER`.
- `AC-CAT-11` — El usuario puede olvidar un aprendizaje de clasificación y
  deja de aplicarse. Evidencia: `TEST`.
- `AC-CAT-12` — Fusionar subcategorías avisa el conteo antes y no pierde
  ningún movimiento. Evidencia: `TEST`.
- `AC-CAT-13` — Un movimiento admite hasta 6 etiquetas simultáneas.
  Evidencia: `TEST`.
- `AC-CAT-14` — Las categorías nunca se distinguen solo por color.
  Evidencia: `TEST`.
- `AC-CAT-15` — Ninguna ruta de este módulo usa service-role.
  Evidencia: `TEST`.

## 21. Fuera de alcance y puente a WhatsApp

Fuera de V1-web: reglas explícitas del usuario, jerarquías de tres niveles,
categorías compartidas, reclasificación retroactiva automática.

Puente a WhatsApp: los comandos de §14.2 funcionan igual por conversación. La
única diferencia de presentación será la reclasificación masiva, que en
WhatsApp mostrará conteo y primeros ejemplos en vez de una tabla con casillas
(`21_contrato_de_canal_y_presentadores.md` §9).

## 22. Trazabilidad

**Documentos de `docs/` consumidos:**
`docs/fase_2_estrategia/alcance_v1/05f_categorias.md` (12 categorías §6, regla
`otros` ≠ sin clasificar, subcategorías §7, normalización §7.3, etiquetas §8,
casos borde §20), `docs/fase_4_tecnica/16_modelo_datos.md` §9.

**Contradicciones que cierra:** `C-11` (confianza numérica visible) en lo que
respecta a clasificación.

**Diferencias frente al documento fuente:** se añade la reclasificación
masiva, que `05f` no contemplaba; se añade la evidencia negativa en el
aprendizaje, posible desde la migración `044`; y se elimina la exposición de
`confidence` en el contrato de datos visible, que `05f` §8.2 mostraba en un
ejemplo.
