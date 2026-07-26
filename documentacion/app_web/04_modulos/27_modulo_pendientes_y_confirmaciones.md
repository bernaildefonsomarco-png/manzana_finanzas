# 27 — Módulo: Pendientes y confirmaciones

**ID de módulo:** `MOD-PENDIENTES`
**Bloque:** 04 — Módulos
**Estado:** V1
**Fecha:** 25 de julio de 2026
**Docs fuente:** `docs/fase_4_tecnica/16_modelo_datos.md` §8, `docs/fase_2_estrategia/alcance_v1/05d_email_parsing.md`, `docs/fase_6_visual/32_especificacion_hifi.md`, `docs/fase_4_tecnica/auditoria_integral_arquitectura_ia_conversacional_2026-07-23.md` §4.7 (como diagnóstico)
**Documentos que dependen de este:** `28` (email), `29` (importación), `30` (recurrentes), `31` (deudas), `39` (home), `41` (asistente)

---

## 1. Tesis y qué NO es

Pendientes es **el contrato de confirmación de todo el producto**. Cualquier
cosa que el sistema detecta pero no ejecuta pasa por aquí: un pago visto en
el correo, una fila ambigua de una importación, un pago que parece repetirse,
un dato que quedó incompleto.

Es el módulo que hace verdadero el principio de control
(`08_principios_experiencia_web.md` §4.2): **el sistema propone, el usuario
decide.**

**La regla que gobierna todo el módulo:**

> **Todo pendiente nace confirmable o no nace.**

Un pendiente que se presenta como accionable y luego no puede ejecutarse es
peor que no haberlo creado: rompe la confianza en todos los siguientes. Ese
fallo está documentado y ocurrió de verdad — se crearon pendientes de deuda
que el sistema no podía confirmar porque no existía un camino atómico para
dar de alta una deuda.

**Qué NO es:**

- No es una bandeja de notificaciones. Cada elemento exige una decisión.
- No es una lista de tareas. El usuario puede ignorarla sin consecuencias.
- No afecta saldos. Un pendiente **nunca** cuenta como dinero movido.
- No es específico del correo. El correo es un productor entre varios.

## 2. Alcance

| Nivel | Funcionalidad |
|---|---|
| **IN V1-web** | Bandeja unificada de todos los orígenes. Confirmar, editar antes de confirmar, descartar. Confirmación en lote con selección explícita. Agrupación por origen y por similitud. "Ya lo registré" que alimenta la deduplicación. Detección de duplicados antes de confirmar. Caducidad de pendientes viejos. Contador en la navegación. **Verificación de confirmabilidad antes de mostrar.** |
| **V1.1** | Reglas de auto-confirmación por origen de alta confianza, bajo opt-in explícito y por origen. Agrupación inteligente por comercio. |
| **FUERA** | Auto-registro sin confirmación humana, en cualquier circunstancia y bajo cualquier configuración. Es regla no negociable heredada. |

## 3. Vocabulario

| Interno | Visible |
|---|---|
| `PendingItem` | Pendiente |
| Pending Inbox | Pendientes / Por revisar |
| `confirm` | Confirmar |
| `discard` | No era eso |
| `already_registered` | Ya lo registré |
| `proposed_action` | Lo que Manzana detectó |
| `risk_level` | No visible; determina si se pide confirmación reforzada |

## 4. Entidades y datos

### 4.1 `pending_items`

```sql
id                        uuid pk
user_id                   uuid not null
type                      pending_type not null
status                    pending_status not null default 'pending'
source                    pending_source not null
source_ref                text null
proposed_action           jsonb not null
normalized_summary        jsonb not null default '{}'
dedup_status              text null
risk_level                risk_level not null default 'low'
confirmable               boolean not null      -- ← ver §4.3
confirm_command           jsonb null            -- ← ver §4.3
expires_at                timestamptz null
sent_for_confirmation_at  timestamptz null
resolved_at               timestamptz null
resolved_by               text null
created_at, updated_at, metadata
```

Tipos (`pending_type`):

| Tipo | Lo produce | Ejemplo |
|---|---|---|
| `email_detected` | Módulo 28 | Un pago de Yape visto en el correo |
| `ambiguous_movement` | Motor IA o importación | "le di 50 a Luis" sin resolver si fue gasto o préstamo |
| `recurring_candidate` | Módulo 30 | Netflix detectado tres meses seguidos |
| `backfill_item` | Módulo 28 | Correos antiguos al conectar el buzón |
| `data_quality` | Sistema | Movimiento sin cuenta que impide calcular algo |
| `risk_confirmation` | Motor IA | Operación de riesgo propuesta por el asistente |

Estados (`pending_status`): `pending`, `confirmed`, `discarded`,
`already_registered`, `expired`, `superseded`.

### 4.2 Migración requerida

Las columnas `confirmable` y `confirm_command` **no existen hoy**. Se añaden
en la migración `057`:

```sql
alter table public.pending_items
  add column if not exists confirmable boolean not null default false,
  add column if not exists confirm_command jsonb null;

-- Un pendiente sin comando de confirmación no puede estar activo.
alter table public.pending_items
  add constraint pending_items_confirmable_has_command
  check (
    status <> 'pending'
    or confirmable = false
    or confirm_command is not null
  );
```

Esa restricción es la traducción a la base de datos de la regla de §1: **la
propia base impide que exista un pendiente activo marcado como confirmable
sin un comando que lo ejecute.** No depende de que el código lo recuerde.

### 4.3 El contrato de confirmabilidad

`proposed_action` describe **qué se detectó**. `confirm_command` describe
**cómo se ejecutaría**, y es lo que hace posible verificar antes de mostrar.

```jsonc
{
  "proposed_action": {
    "kind": "crear_movimiento",
    "type": "gasto",
    "amount": "44.90",
    "merchant": "Netflix",
    "occurred_at": "2026-07-14T10:12:00-05:00",
    "category_id": "servicios_suscripciones",
    "account_origin_id": "acc_bcp"
  },
  "confirmable": true,
  "confirm_command": {
    "command": "create_movement",
    "idempotency_key": "pend_8f2b9c1e",
    "payload": { "...": "..." },
    "preconditions": ["account_exists:acc_bcp"]
  }
}
```

Si al crear el pendiente no se puede construir un `confirm_command` válido,
**el pendiente nace con `confirmable: false`** y se presenta como
información, no como acción: *"Detecté un pago de Netflix pero me falta
saber de qué cuenta salió"* — con la acción de completar, no de confirmar.

## 5. Máquina de estados

```text
                    creado
                      │
              ┌───────┴────────┐
              ▼                ▼
        confirmable       no confirmable
              │                │
              │                └──► el usuario completa ──► confirmable
              ▼
      ┌───── pending ─────┐
      │       │           │
      ▼       ▼           ▼
 confirmed  discarded  already_registered
      │       │           │
      │       │           └──► alimenta dedup
      │       └──► alimenta evidencia negativa
      └──► crea movimiento o entidad vía Core

  pending ──(sin resolver y caducado)──► expired
  pending ──(llega uno mejor del mismo hecho)──► superseded
```

| Transición | Efectos | ¿Reversible? |
|---|---|---|
| confirmar | Ejecuta `confirm_command` por el Core. Crea movimiento o entidad | Sí, 24 h (`23` §5b.4); después se corrige el movimiento |
| editar y confirmar | Igual, con los valores corregidos por el usuario. **La corrección alimenta el aprendizaje** | Igual |
| descartar | No crea nada. Conserva evidencia mínima para no volver a proponerlo | Sí, mientras no caduque |
| ya lo registré | No crea nada. **Alimenta la deduplicación** para que ese hecho no vuelva a proponerse | Sí |
| caducar | Automático. No crea nada. Queda consultable | No |
| quedar superado | Llega un pendiente mejor del mismo hecho; el viejo se cierra | No |

## 6. Reglas de negocio

**`RUL-PEND-01` — Todo pendiente nace confirmable o no nace**

Antes de persistir un pendiente activo, el productor debe poder construir un
`confirm_command` ejecutable. Si no puede, el pendiente se crea con
`confirmable: false` y se presenta como información con acción de completar.

Verificación exigida antes de marcar `confirmable: true`:

| Comprobación |
|---|
| Existe un comando del Core para esa operación |
| Están todos los campos que el comando exige |
| Las precondiciones se cumplen: la cuenta existe, la deuda está activa, la cuota está abierta |
| El comando es idempotente y tiene su clave |

Es la misma comprobación que hace el verificador del motor antes de mostrar
una propuesta (`22_grounding_evidencia_y_politica.md` §6). Aquí se persiste.

**`RUL-PEND-02` — Un pendiente nunca afecta saldos**

No cuenta como movimiento, no aparece en el gasto del periodo, no consume
presupuesto, no cambia el dinero libre. Regla no negociable heredada.

En búsqueda sí puede aparecer, **marcado como pendiente y separado** de los
confirmados: *"No encontré movimientos confirmados de Netflix ese día.
También hay 1 pendiente parecido por revisar."*

**`RUL-PEND-03` — Confirmar es una escritura idempotente por el Core**

La `idempotency_key` se genera **al crear el pendiente**, no al confirmarlo.
Así, dos confirmaciones del mismo pendiente —dos pestañas, doble clic— no
pueden producir dos movimientos.

**`RUL-PEND-04` — Editar antes de confirmar es lo normal, no la excepción**

Todo campo de la propuesta es editable antes de confirmar. La interfaz
resalta los campos con menor certeza, sin mostrar porcentajes (`C-11`).

Cada corrección genera **evidencia** para el aprendizaje: si el usuario
cambia la categoría propuesta, eso alimenta memoria positiva de la nueva y
negativa de la anterior (migración `044`).

**`RUL-PEND-05` — "Ya lo registré" ≠ "No era eso"**

Dos acciones distintas con consecuencias distintas:

| Acción | Significa | Efecto en el aprendizaje |
|---|---|---|
| **Ya lo registré** | El hecho es real, pero ya está en el sistema | Alimenta la **deduplicación**: ese hecho no se vuelve a proponer, y se afina la detección de duplicados |
| **No era eso** | La detección es incorrecta | Alimenta **evidencia negativa** sobre el patrón que la produjo |

Confundirlas degrada el sistema: tratar un duplicado como error hace que el
detector deje de detectar cosas correctas.

Al elegir "ya lo registré", si el sistema puede identificar el movimiento
existente, lo enlaza y lo muestra.

**`RUL-PEND-06` — Detección de duplicados antes de confirmar**

Al abrir un pendiente se busca un movimiento equivalente ya registrado
(mismo monto, ventana de 24 horas, mismo comercio o cuenta). Si existe, se
muestra **antes** de que el usuario confirme, con la acción "ya lo registré"
destacada.

**`RUL-PEND-07` — Confirmación en lote con selección explícita**

Nunca "confirmar todos" con un solo clic ambiguo. El lote exige selección
explícita de cada elemento o de un grupo nombrado, muestra el conteo, y
excluye automáticamente los que tengan riesgo alto o duplicado probable —
esos se confirman uno a uno.

**`RUL-PEND-08` — Caducidad**

Un pendiente sin resolver caduca a los **60 días**. Al caducar no crea nada y
queda consultable con el filtro de caducados. No se borra: su evidencia sigue
sirviendo para deduplicación.

**`RUL-PEND-09` — Superación**

Si llega un pendiente que describe el mismo hecho con mejor información (por
ejemplo, el correo del banco tras uno de la app), el anterior pasa a
`superseded` y solo se muestra el nuevo. Nunca dos pendientes activos para el
mismo hecho.

**`RUL-PEND-10` — El volumen no puede abrumar**

Con más de 10 pendientes, la interfaz agrupa por origen y por similitud, y
ofrece la revisión en grupo antes que la lista plana. Un usuario que conecta
su correo y recibe 80 pendientes sueltos abandona.

**`RUL-PEND-11` — Riesgo alto siempre es individual**

Un pendiente con `risk_level: high` —crear una deuda, un monto inusualmente
alto, una operación irreversible— **nunca entra en un lote**. Se confirma
solo, con confirmación reforzada.

## 7. Validaciones

| Elemento | Regla |
|---|---|
| `proposed_action` | Obligatorio. Debe validar contra el esquema de su `kind` |
| `confirm_command` | Obligatorio si `confirmable = true` (impuesto por la base) |
| `source_ref` | Obligatorio en `email_detected` y `backfill_item`: es la trazabilidad al origen |
| `expires_at` | Se calcula al crear: 60 días |
| Edición antes de confirmar | Los mismos validadores del módulo destino (26, 30, 31) |
| Lote | Máximo 50 elementos por operación. Excluye riesgo alto y duplicados |

## 8. Superficies

**Referencia visual:** `docs/fase_6_visual/32_especificacion_hifi.md` §7
(`PENDING`) y §21.4 (`PENDING_DETAIL` / `DRAWER_PENDING_DETAIL`), con sus
frames en `stitch_manzana_v1/`; el inventario numerado está en
`docs/fase_6_visual/33_stitch_handoff_v1.md` §6.13. Cobertura pantalla por
pantalla:

| Pantalla | Frame previo |
|---|---|
| `SCR-PEND-01` | Sí — `PENDING_FUNCTIONAL` (60), `PENDING_EMPTY` (61), `PENDING_LOADING` (63), `PENDING_ERROR` (64), `PENDING_DISCREET` (65) |
| `SCR-PEND-02` | Sí — `PENDING_DETAIL_DEFAULT`, `_EDITING`, `_CONFIRMING`, `_REJECTING`, `_ALREADY_REGISTERED`, `_LOADING`, `_ERROR`, `_DISCREET` (66-73) y `DRAWER_PENDING_DETAIL` (151) |
| `SCR-PEND-03` | Sí — `PENDING_BATCH` (62) y el banner de lote de §21.4 |
| `SCR-PEND-04` | **No existe frame previo.** El Hi-Fi no contempla pendientes incompletos; `PENDING_DETAIL_EDITING` (67) edita una propuesta ya completa, que es otra cosa. El layout de abajo es especificación, no boceto. |

El preview rápido invocado desde Inicio, `MODAL_DETAIL_QUICK_PENDING` (143,
§21.8), también pertenece a este módulo aunque §8 no lo declare como
pantalla propia.

### `SCR-PEND-01` — Bandeja de pendientes

**Ruta:** `/pendientes`
**Estado en URL:** `origen`, `tipo`, `estado`, `cursor`

```text
┌──────────────────────────────────────────────────┐
│ Pendientes                        3 por revisar  │
│ [Todos] [Correo 2] [Importación 1]               │
├──────────────────────────────────────────────────┤
│ Detectado en tu correo del BCP                   │
│ Netflix · 14 jul · S/44.90                       │
│ Servicios / Suscripciones · BCP                  │
│ [Confirmar]  [Editar]  [No era eso]              │
├──────────────────────────────────────────────────┤
│ ⚠️ Ya tienes un movimiento parecido el 14 jul    │
│ Rappi · 14 jul · S/28.50                         │
│ [Ver el existente]  [Ya lo registré]  [Confirmar]│
├──────────────────────────────────────────────────┤
│ Me falta un dato                                 │
│ Yape · 13 jul · S/60.00                          │
│ No sé de qué cuenta salió                        │
│ [Completar]                                      │  ← no confirmable aún
└──────────────────────────────────────────────────┘
```

Reglas de la pantalla:

- Cada elemento muestra **su origen legible**, no un código.
- Un pendiente no confirmable **no muestra botón de confirmar**. Muestra
  "Completar" y qué falta.
- El aviso de duplicado aparece **antes** de las acciones, no después.
- Con más de 10 elementos, se agrupan (`RUL-PEND-10`).
- El contador de la navegación cuenta solo los `pending`.

### `SCR-PEND-02` — Detalle de pendiente

**Ruta:** `/pendientes/[id]` — panel sobre la bandeja, pantalla completa si
se carga directo.

Muestra la propuesta completa y editable, el origen con su trazabilidad
("Correo del BCP recibido el 14 de julio a las 10:12"), el duplicado si lo
hay, y **qué pasará al confirmar**: "Se registrará como gasto y bajará tu
saldo de BCP".

Para pendientes de correo, ofrece **aportar contexto**: un campo libre donde
el usuario puede explicar qué fue ese pago, que alimenta la memoria
(módulo 28).

### `SCR-PEND-03` — Revisión en grupo

Se invoca cuando hay elementos similares. Muestra el grupo con casillas,
conteo, y una confirmación única. Los de riesgo alto aparecen fuera del
grupo, marcados como "estos los reviso contigo uno a uno".

### `SCR-PEND-04` — Completar un pendiente incompleto

Modal que pide solo el dato que falta. Al completarlo, el pendiente pasa a
confirmable y se ofrece confirmar en el mismo paso.

## 9. Acciones

| ID | Acción | Precondición | ¿Confirma? | Deshacer | Evento |
|---|---|---|---|---|---|
| `ACT-PEND-01` | Confirmar | `confirmable = true` | Sí, implícita en el botón | 24 h | `pendiente.confirmado` |
| `ACT-PEND-02` | Editar y confirmar | `confirmable = true` | Sí | 24 h | `pendiente.editado_confirmado` |
| `ACT-PEND-03` | Descartar | Existe | No | Mientras no caduque | `pendiente.descartado` |
| `ACT-PEND-04` | Ya lo registré | Existe | No | Mientras no caduque | `pendiente.ya_registrado` |
| `ACT-PEND-05` | Completar | `confirmable = false` | No | — | `pendiente.completado` |
| `ACT-PEND-06` | Ver el duplicado | Hay candidato | No | — | `duplicado.consultado` |
| `ACT-PEND-07` | Confirmar en lote | Selección, sin riesgo alto | **Sí, masiva** | Por lote, 24 h | `pendiente.lote_confirmado` |
| `ACT-PEND-08` | Descartar en lote | Selección | **Sí, masiva** | Por lote | `pendiente.lote_descartado` |
| `ACT-PEND-09` | Aportar contexto | Pendiente de correo | No | Editando | `contexto.aportado` |

## 10. API

Base `/api/v1/pending`.

| Método y ruta | Notas |
|---|---|
| `GET /pending` | Cursor. Filtros: `origen`, `tipo`, `estado`. Por defecto solo `pending` |
| `GET /pending/count` | Solo el conteo, para el contador de navegación. Caché corta |
| `GET /pending/[id]` | Detalle con duplicado resuelto y efecto explicado |
| `POST /pending/[id]/confirm` | Ejecuta `confirm_command`. Acepta `overrides` con los campos editados. **Idempotente por la clave del pendiente** |
| `POST /pending/[id]/discard` | Descarta |
| `POST /pending/[id]/already-registered` | Marca como ya registrado y enlaza el movimiento si se identifica |
| `PATCH /pending/[id]` | Completa datos faltantes; puede volverlo confirmable |
| `POST /pending/[id]/context` | Aporta contexto libre |
| `POST /pending/batch-confirm` | Lote. `preview: true` devuelve conteo y exclusiones. Devuelve `batch_id` |
| `POST /pending/batch-discard` | Lote |
| `POST /pending/batch/[batch_id]/undo` | Deshace el lote dentro de 24 h |

`POST /pending/[id]/confirm` responde `422` con `ERR-PEND-02` si el pendiente
no es confirmable. **Nunca intenta ejecutar un comando inexistente.**

## 11. Permisos y RLS

- Cliente autenticado en todas las rutas de lectura y resolución.
- **Excepción justificada de service-role:** la *creación* de pendientes por
  workers (correo entrante, detección de recurrentes) ocurre sin usuario en
  la petición. Entra en la lista blanca de
  `15_seguridad_autorizacion_y_rls.md` §4, fila "Workers y trabajos
  programados". La creación desde la interfaz o el asistente usa el cliente
  autenticado.
- RLS por `user_id` en `pending_items`.
- Confirmar ejecuta el comando por el Core, con las mismas garantías que una
  escritura manual.
- Un pendiente de otro usuario devuelve 404.

## 12. Estados de datos

| Estado | Qué se muestra |
|---|---|
| **Vacío** | "No tienes nada por revisar." + enlace al Inicio. Es un estado **bueno**, no un fracaso |
| **Sin resultados por filtro** | "No hay pendientes de ese origen." + limpiar filtro |
| **Pocos (1-10)** | Lista plana, cada uno con sus acciones |
| **Muchos (>10)** | Agrupados por origen y similitud, con revisión en grupo |
| **Solo no confirmables** | "Tengo algunas detecciones a las que les falta un dato." + completar |
| **Cargando** | Esqueleto de 3 tarjetas |
| **Error** | Mensaje en español con reintento |
| **Modo discreto** | "Tienes un movimiento por revisar" sin monto ni comercio; el detalle sí los muestra al abrirlo |

El estado vacío importa: una bandeja vacía significa que el usuario está al
día, y debe sentirse así.

## 13. Errores

| ID | Causa | Mensaje visible | Salida |
|---|---|---|---|
| `ERR-PEND-01` | Pendiente no encontrado | "No encontré ese pendiente." | Volver a la bandeja |
| `ERR-PEND-02` | Confirmar uno no confirmable | "Me falta un dato para poder registrarlo." | Completar |
| `ERR-PEND-03` | Ya resuelto | "Ese pendiente ya lo resolviste." | Ver el resultado |
| `ERR-PEND-04` | Caducado | "Ese pendiente caducó. Puedes registrarlo a mano si sigue siendo válido." | Nuevo movimiento |
| `ERR-PEND-05` | Precondición rota (cuenta archivada, deuda cerrada) | "La cuenta de ese pago está archivada. ¿La restauramos o eliges otra?" | Restaurar o editar |
| `ERR-PEND-06` | El Core rechaza el comando | "No pude registrarlo: {razón del dominio en español}." | Editar |
| `ERR-PEND-07` | Lote con riesgo alto | "Estos los reviso contigo uno a uno." | Confirmar individual |
| `ERR-PEND-08` | Lote de más de 50 | "Puedo confirmar hasta 50 a la vez." | Dividir |
| `ERR-PEND-09` | Deshacer lote fuera de plazo | "Ya no puedo deshacerlo en bloque, pero puedes corregir los movimientos." | Ir a Movimientos |

## 14. Integración con el motor IA

### 14.1 Consultas que expone

Entidad: `pendientes`.

| Dimensión | Notas |
|---|---|
| `origen_pendiente` | correo, importación, recurrente, asistente, sistema |
| `tipo_pendiente` | Los seis de §4.1 |
| `estado_pendiente` | pendiente, confirmado, descartado, ya registrado, caducado |
| `confirmable` | sí/no |
| `nivel_riesgo` | bajo, medio, alto |
| `tiene_duplicado` | sí/no |
| `antiguedad_pendiente` | Días desde su creación |

| Medida | Notas |
|---|---|
| `conteo_pendientes` | Agrupable por origen y tipo |
| `suma_propuesta` | Suma de los montos propuestos. **Nunca se presenta como gasto real** |
| `tasa_confirmacion_pendientes` | Confirmados sobre total resueltos |

La segunda medida lleva advertencia obligatoria en cualquier respuesta que la
use: es dinero **no confirmado**, y presentarlo junto al gasto real sin
distinguirlo violaría `RUL-PEND-02`.

### 14.2 Comandos que acepta

| Comando | Confirmación |
|---|---|
| `confirmar_pendiente` | Tarjeta con la propuesta editable |
| `editar_y_confirmar` | Tarjeta editable |
| `descartar_pendiente` | Tarjeta |
| `marcar_ya_registrado` | Tarjeta |
| `completar_pendiente` | Tarjeta con el campo que falta |
| `confirmar_lote` | **Masiva**: conteo, muestra, exclusión de riesgo alto |

### 14.3 Qué se puede pedir en lenguaje natural

```text
"¿qué tengo por revisar?"                   → consulta agrupada por origen
"confirma el de Netflix"                    → confirmar_pendiente
"ese ya lo registré"                        → marcar_ya_registrado
"el de Rappi fue con Yape, no con BCP"      → editar_y_confirmar
"confirma todos los del correo"             → confirmar_lote (masiva)
"no, ese pago no fue mío"                   → descartar_pendiente
```

La quinta excluye automáticamente los de riesgo alto y avisa cuáles quedaron
fuera (`RUL-PEND-11`).

### 14.4 Lo que el motor NO puede hacer aquí

- Confirmar un pendiente sin mostrar su propuesta al usuario.
- Confirmar en lote incluyendo riesgo alto.
- Crear un pendiente marcado confirmable sin `confirm_command` válido — la
  base lo impide.
- Presentar la suma de pendientes como gasto real.

## 15. Memoria y aprendizaje

Este módulo es la **fuente de aprendizaje más valiosa del producto**, porque
cada resolución es una señal explícita del usuario sobre un caso concreto.

| Señal | Qué alimenta |
|---|---|
| Confirmar sin editar | Evidencia positiva fuerte del patrón que lo detectó |
| Editar y confirmar | Positiva de los valores corregidos, **negativa de los propuestos** |
| Descartar | Evidencia negativa sobre el patrón de detección |
| Ya lo registré | Deduplicación: afina el detector de duplicados |
| Aportar contexto | Enriquece la memoria sobre ese comercio o tipo de pago |
| Caducar sin resolver | Señal débil de que ese origen no aporta valor a este usuario |

La última fila importa para el producto: si un origen produce muchos
pendientes que caducan, ese origen está generando ruido y debe revisarse.

## 16. Eventos y telemetría

Eventos: `pendiente.creado`, `.confirmado`, `.editado_confirmado`,
`.descartado`, `.ya_registrado`, `.completado`, `.caducado`, `.superado`,
`lote_confirmado`, `lote_descartado`, `duplicado.advertido`,
`contexto.aportado`.

Llevan tipo, origen, nivel de riesgo y `trace_id`. **Nunca monto ni
comercio.**

Métricas clave:

| Métrica | Qué indica |
|---|---|
| Tasa de confirmación por origen | Si ese origen aporta valor |
| Tasa de edición antes de confirmar | Calidad de la detección |
| Tasa de descarte por origen | Ruido |
| Tasa de caducidad | Pendientes que el usuario ignora |
| Tiempo hasta resolver | Fricción de la bandeja |
| Pendientes no confirmables creados | **Defecto del productor**, no funcionamiento normal |

La última es un indicador de salud: un productor que genera muchos
pendientes incompletos está mal implementado.

## 17. Rendimiento

- Índices: `pending_items (user_id, status, created_at desc)`,
  `(user_id, source, status)`, `(user_id, expires_at) where status = 'pending'`.
- `GET /pending/count` es una consulta de conteo con índice, caché de 30 s.
- La detección de duplicados al abrir un pendiente usa el índice de
  `dedup_decisions (user_id, fingerprint)`.
- La caducidad la ejecuta un worker diario, no una consulta en cada lectura.
- Un lote se ejecuta en transacción con `batch_id`.
- Presupuesto: bandeja bajo 400 ms; conteo bajo 100 ms.

## 18. Accesibilidad específica

- Cada pendiente es una tarjeta navegable con teclado; sus acciones son
  botones reales en orden lógico.
- El aviso de duplicado se anuncia antes que las acciones en el orden de
  lectura, no solo visualmente antes.
- El contador de la navegación se anuncia como "Pendientes, 3 por revisar".
- Al confirmar, el foco pasa al siguiente pendiente, no al inicio de la
  lista.
- La revisión en grupo anuncia el conteo seleccionado en región activa.
- Un pendiente no confirmable comunica **por texto** qué le falta, no solo
  por la ausencia del botón.

## 19. Casos borde

1. **Confirmar dos veces (doble clic, dos pestañas).** La idempotencia por la
   clave del pendiente impide el duplicado; la segunda recibe el resultado de
   la primera.
2. **La cuenta del pendiente se archivó tras crearlo.** `ERR-PEND-05` con la
   opción de restaurar o elegir otra.
3. **La deuda del pendiente se cerró.** Igual: se ofrece editar el destino.
4. **80 pendientes tras conectar el correo.** Agrupación obligatoria
   (`RUL-PEND-10`) y backfill separado del flujo diario.
5. **Dos pendientes del mismo hecho por dos orígenes.** El segundo supera al
   primero (`RUL-PEND-09`); nunca se muestran los dos.
6. **Confirmar un pendiente cuyo movimiento equivalente se creó a mano entre
   medias.** Se detecta al confirmar y se ofrece "ya lo registré" antes de
   duplicar.
7. **Deshacer una confirmación de lote donde algunos movimientos ya se
   editaron.** Se deshacen los no modificados y se informa cuántos quedaron
   fuera.
8. **Pendiente de riesgo alto en una selección de lote.** Se excluye
   automáticamente y se dice cuál y por qué.
9. **Pendiente que caduca mientras el usuario lo tiene abierto.** Se permite
   resolverlo: la caducidad se evalúa al listar, no al confirmar.
10. **Un productor intenta crear un pendiente confirmable sin comando.** La
    restricción de la base lo rechaza; el productor registra el defecto y
    crea el pendiente como no confirmable.
11. **Usuario que nunca abre la bandeja.** No se le presiona. El contador
    existe, y los recordatorios respetan la política anti-fatiga del módulo
    37.
12. **Descartar y que el mismo hecho vuelva a detectarse.** La evidencia
    negativa debe impedirlo; si vuelve, es un defecto del detector y se
    registra como tal.

## 20. Criterios de aceptación

- `AC-PEND-01` — No existe ningún pendiente activo con `confirmable = true` y
  sin `confirm_command`. **Impuesto por la base de datos.**
  Evidencia: `TEST`.
- `AC-PEND-02` — Confirmar un pendiente no confirmable devuelve `422` y nunca
  intenta ejecutar. Evidencia: `TEST`.
- `AC-PEND-03` — Un pendiente no afecta saldos, presupuestos ni dinero libre
  en ningún estado. Evidencia: `TEST`.
- `AC-PEND-04` — En búsqueda, los pendientes aparecen separados y marcados,
  nunca mezclados con confirmados. Evidencia: `TEST` + `USER`.
- `AC-PEND-05` — Confirmar dos veces no crea dos movimientos.
  Evidencia: `TEST`.
- `AC-PEND-06` — "Ya lo registré" y "No era eso" producen aprendizaje
  distinto. Evidencia: `TEST`.
- `AC-PEND-07` — El duplicado se advierte antes de las acciones de
  confirmación, también en el orden de lectura. Evidencia: `TEST` + `USER`.
- `AC-PEND-08` — Un lote nunca incluye pendientes de riesgo alto, y dice
  cuáles excluyó. Evidencia: `TEST`.
- `AC-PEND-09` — Con más de 10 pendientes se agrupan por origen y similitud.
  Evidencia: `TEST` + `USER`.
- `AC-PEND-10` — Editar antes de confirmar genera evidencia positiva de lo
  corregido y negativa de lo propuesto. Evidencia: `TEST`.
- `AC-PEND-11` — Un pendiente caduca a los 60 días sin crear nada y sigue
  consultable. Evidencia: `TEST`.
- `AC-PEND-12` — Nunca hay dos pendientes activos para el mismo hecho.
  Evidencia: `TEST`.
- `AC-PEND-13` — La bandeja vacía se presenta como estado bueno, no como
  fracaso. Evidencia: `USER`.
- `AC-PEND-14` — La única excepción de service-role de este módulo es la
  creación por workers, declarada en la lista blanca. Evidencia: `TEST`.
- `AC-PEND-15` — Un pendiente no confirmable comunica por texto qué le falta.
  Evidencia: `TEST` + `USER`.
- `AC-PEND-16` — La suma de pendientes nunca se presenta junto al gasto real
  sin distinguirse. Evidencia: `TEST` + `USER`.

## 21. Fuera de alcance y puente a WhatsApp

Fuera de V1-web: auto-confirmación sin intervención humana (prohibida por
regla no negociable), agrupación semántica avanzada por comercio.

Puente a WhatsApp: este módulo es el que más cambia de presentación entre
canales y el que menos cambia de lógica. En WhatsApp la confirmación llegará
como mensaje con botones y la revisión en grupo como conteo con ejemplos,
pero `confirm_command`, la idempotencia y las reglas de riesgo son idénticas.
La política de cuántas confirmaciones enviar y con qué frecuencia vive en el
módulo 37 y se ampliará en la fase 2.

## 22. Trazabilidad

**Documentos de `docs/` consumidos:**
`docs/fase_4_tecnica/16_modelo_datos.md` §8 (tabla, tipos, reglas),
`docs/fase_2_estrategia/alcance_v1/05d_email_parsing.md` (flujo de
confirmación, "ya lo registré", revisión batch),
`docs/fase_6_visual/32_especificacion_hifi.md` §7 y §21.4 (bandeja, detalle
y lote; no cubre el pendiente incompleto de `SCR-PEND-04`),
`docs/fase_4_tecnica/auditoria_integral_arquitectura_ia_conversacional_2026-07-23.md`
§4.7 y §5 (P0.5: pendientes creados como confirmables sin serlo) — usado como
diagnóstico, no como especificación.

**Contradicciones que cierra:** `C-06` (lote bloqueado completo: aquí cada
elemento se resuelve por separado).

**Diferencias frente a los documentos fuente:** se añaden las columnas
`confirmable` y `confirm_command` con una restricción de base que hace la
regla verificable en datos, no solo en código — ninguna fuente lo
contemplaba, y su ausencia es exactamente lo que permitió el fallo
documentado. Se añade la separación explícita entre "ya lo registré" y "no
era eso" con aprendizajes distintos. Se añade la caducidad a 60 días, que las
fuentes dejaban indefinida.
