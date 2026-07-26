# 26 — Módulo: Movimientos

**ID de módulo:** `MOD-MOVIMIENTOS`
**Bloque:** 04 — Módulos
**Estado:** V1
**Fecha:** 25 de julio de 2026
**Docs fuente:** `docs/fase_4_tecnica/16_modelo_datos.md` §7, `docs/fase_2_estrategia/alcance_v1/05e_cuentas_cajas.md` §11, `docs/fase_6_visual/32_especificacion_hifi.md`, `11_confianza_errores_y_reversibilidad.md`
**Documentos que dependen de este:** todos los módulos que producen movimientos (`27`, `28`, `29`, `30`, `31`), más `32`, `34`, `35`, `39`

---

## 1. Tesis y qué NO es

El movimiento es la entidad central del producto: todo lo demás —saldos,
presupuestos, deudas, descubrimientos— se deriva de aquí. Este módulo es
donde el usuario ve su historial, lo corrige y confía en él.

Y es donde el producto actual falla de forma más visible: hoy no se puede
buscar, no se puede ver más de 50, hay controles que no responden, y **9 de
los 11 tipos de movimiento expulsan al usuario a otra pantalla** en vez de
guardarse.

**Qué NO es:**

- No es un libro contable. No exige que todo cuadre.
- No es solo "gastos". Un movimiento es cualquier evento que mueve, cambia o
  explica dinero: 11 tipos, no uno.
- No es inmutable. Todo se corrige, se elimina y **se restaura**.

## 2. Alcance

| Nivel | Funcionalidad |
|---|---|
| **IN V1-web** | **Los 11 tipos guardables desde la propia pantalla** (cierra `C-05`). Listado con paginación por cursor y filtros en servidor. Búsqueda por texto. Detalle completo con fuente, estado e impacto. Edición. Eliminación con confirmación. **Restauración**. Historial de cambios por movimiento. Duplicar. Nota. Selección múltiple con acciones en lote. Aviso de duplicado antes de guardar. |
| **V1.1** | Adjuntar imagen de comprobante. Dividir un movimiento entre varias categorías. Movimientos programados a futuro. |
| **FUERA** | OCR de boletas. Voz. Movimientos compartidos entre usuarios. Adjuntos de más de un archivo. |

## 3. Vocabulario

| Interno | Visible |
|---|---|
| `Movement` | Movimiento |
| `movement_type` | Tipo — se muestra el nombre concreto: Gasto, Ingreso, Transferencia… |
| `occurred_at` | Fecha |
| `merchant` | Comercio / Dónde |
| `description` | Descripción |
| `source` | Origen — "Registrado por ti", "Detectado en tu correo del BCP" |
| `status: needs_review` | Por revisar |
| `status: corrected` | Corregido |
| `status: deleted` | Eliminado |
| `movement_audit_log` | Historial de cambios |

## 4. Entidades y datos

### 4.1 `movements`

```sql
id                       uuid pk
user_id                  uuid not null
type                     movement_type not null
status                   movement_status not null default 'confirmed'
amount                   numeric(14,2) not null
currency                 text not null default 'PEN'
occurred_at              timestamptz not null
description              text null
merchant                 text null
category_id              text null references categories(id)
subcategory_id           uuid null references user_subcategories(id)
source                   movement_source not null
source_ref               text null
confidence               numeric(5,4) null
requires_review          boolean not null default false

account_origin_id        uuid null references accounts(id)
account_destination_id   uuid null references accounts(id)
box_origin_id            uuid null references boxes(id)
box_destination_id       uuid null references boxes(id)

debt_id                  uuid null references debts(id)
recurring_rule_id        uuid null references recurring_rules(id)
recurring_occurrence_id  uuid null references recurring_occurrences(id)
related_person_id        uuid null references related_persons(id)

affects_total_balance    boolean not null
affects_account_balance  boolean not null
idempotency_key          text null
created_at, updated_at, deleted_at, metadata
```

Restricciones:

- `amount > 0` salvo en `ajuste`, donde puede ser negativo.
- Único parcial `(user_id, idempotency_key)` donde no es nulo.
- `affects_total_balance` y `affects_account_balance` **los calcula el Core**
  a partir del tipo (`RUL-CUENTAS-10`); nunca los envía el cliente.
- `confidence` existe en el modelo pero **jamás se muestra al usuario**
  (`C-11`).

### 4.2 `movement_audit_log`

Toda operación sobre dinero, categoría, cuenta, caja, deuda, recurrente o
estado deja una fila. Acciones válidas tras la migración `046`:
`created`, `updated`, `corrected`, `deleted`, `reversed`, `restored`.

Guarda campo modificado, valor anterior, valor nuevo, origen, tipo de actor,
`trace_id`. **Nunca guarda el razonamiento del modelo.**

### 4.3 Campos requeridos por tipo

La tabla que gobierna el formulario. Un tipo cuyo formulario no pueda
completarse aquí es un tipo no guardable, y eso está prohibido por `C-05`.

| Tipo | Obligatorios | Opcionales | Prohibidos |
|---|---|---|---|
| `gasto` | monto, fecha | cuenta origen, caja origen, categoría, subcategoría, comercio, descripción, etiquetas | cuenta destino, deuda |
| `ingreso` | monto, fecha | cuenta destino, categoría, descripción | cuenta origen, caja origen |
| `transferencia` | monto, fecha, cuenta origen, cuenta destino | descripción | categoría, cajas, deuda |
| `asignacion_interna` | monto, fecha, cuenta, y al menos una caja (origen o destino) | descripción | categoría, cuenta destino distinta |
| `deuda_adquirida` | monto, fecha, persona o entidad | descripción, cuotas | cuentas, cajas |
| `pago_deuda` | monto, fecha, deuda | cuenta origen, caja origen, descripción | cuenta destino |
| `prestamo_dado` | monto, fecha, persona | cuenta origen, descripción | cuenta destino |
| `prestamo_recibido` | monto, fecha, persona | cuenta destino, descripción | cuenta origen |
| `devolucion_recibida` | monto, fecha, persona o deuda | cuenta destino, descripción | cuenta origen |
| `pago_recurrente` | monto, fecha, regla recurrente | cuenta origen, caja origen, categoría | cuenta destino |
| `ajuste` | monto (puede ser negativo), fecha, cuenta, motivo | descripción | categoría |

**Nota sobre "prohibidos":** enviar un campo prohibido para el tipo devuelve
`ERR-MOV-06`, no se ignora en silencio. Ignorarlo produciría movimientos que
parecen correctos y tienen datos huérfanos.

### 4.4 Migraciones requeridas

Ninguna nueva para el módulo. La `047` (que amplía `movement_source` con
`import_confirmed` y `assistant_confirmed`) es requisito de los módulos 29 y
41, y este módulo debe aceptar esos orígenes en su listado y detalle.

## 5. Máquina de estados

```text
                    crear
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
     confirmed   needs_review   (rechazado por validación)
          │           │
          │           └── el usuario completa ──► confirmed
          │
          ├── editar ──► corrected ──► editar ──► corrected
          │
          ├── eliminar ──► deleted ──► restaurar ──► confirmed | corrected
          │
          └── revertir ──► reversed        (solo desde el Core, no desde UI)
```

| Estado | ¿Afecta saldos? | Acciones disponibles |
|---|---|---|
| `confirmed` | Sí, según su tipo | Editar, eliminar, duplicar, ver historial |
| `needs_review` | Sí, con la información que tenga | Completar, editar, eliminar |
| `corrected` | Sí, recalculado | Editar, eliminar, ver historial |
| `deleted` | **No.** Su impacto se revierte | **Restaurar**, ver historial |
| `reversed` | No | Ver historial |

`reversed` es distinto de `deleted`: lo produce el Core al deshacer una
operación compuesta (una importación, un lote), no el usuario borrando algo.

**Restaurar recalcula el impacto.** Un movimiento restaurado vuelve a afectar
saldos, presupuestos y descubrimientos, y queda registrado como `restored` en
la auditoría.

## 6. Reglas de negocio

**`RUL-MOV-01` — Los 11 tipos son guardables desde Movimientos**

Ningún tipo sustituye su botón de guardar por un enlace a otra pantalla.
Cierra `C-05`, cuyo estado real verificado es peor que el documentado: son 9
de 11 los que hoy expulsan al usuario, no 3.

Los tipos que además tienen una pantalla especializada (deudas, recurrentes)
**pueden ofrecerla como atajo**, pero nunca como única vía.

**`RUL-MOV-02` — El tipo determina el efecto, y lo calcula el Core**

`affects_total_balance` y `affects_account_balance` se derivan del tipo según
`RUL-CUENTAS-10`. El cliente nunca los envía. Enviarlos se ignora.

**`RUL-MOV-03` — Toda escritura es idempotente**

Requiere `Idempotency-Key` de al menos 8 caracteres. Repetir con la misma
clave devuelve el resultado original con `meta.idempotent_replay: true`, sin
crear duplicado ni dar error.

**`RUL-MOV-04` — Aviso de duplicado antes de guardar**

Si el sistema detecta un movimiento muy parecido (mismo monto, ventana de 24
horas, mismo comercio o cuenta), responde `409` con `requires_confirmation` y
el candidato. El usuario decide: ver el existente, o registrar igual.

Ejemplo: el usuario registra "Netflix S/44.90" el 14 de julio y ya existe uno
detectado por correo ese mismo día.
→ Se muestra el existente con su origen antes de duplicar.

**`RUL-MOV-05` — Editar genera historial, no reemplaza en silencio**

Cada edición registra qué campo cambió, con valor anterior y nuevo. El estado
pasa a `corrected`. El usuario puede ver ese historial completo desde el
detalle.

**`RUL-MOV-06` — Eliminar es reversible**

Eliminar hace soft delete, revierte el impacto en saldos y deja el movimiento
restaurable **sin límite de tiempo** (`23` §5b.4). No existe borrado
definitivo desde la interfaz.

**`RUL-MOV-07` — Cambiar el tipo de un movimiento existente**

Está permitido y es una operación de riesgo: recalcula el efecto sobre
saldos, puede requerir campos nuevos y puede invalidar los actuales.

Ejemplo: un `gasto` de S/200.00 desde BCP se cambia a `transferencia` a Yape.
→ BCP no cambia (ya se había descontado), Yape sube S/200.00, el gasto total
del periodo baja S/200.00, y el presupuesto de su categoría se libera. Se
avisa el efecto antes de confirmar.

**`RUL-MOV-08` — Fecha en zona horaria del usuario**

`occurred_at` se interpreta en `America/Lima`. Un movimiento registrado a las
23:30 del 14 de julio queda con fecha del 14, no del 15.

**`RUL-MOV-09` — Movimiento sin cuenta es válido**

Afecta categorías, presupuestos y el total gastado, pero no los saldos por
cuenta (`RUL-CUENTAS-12`). El detalle lo indica explícitamente para que el
usuario entienda por qué no ve el cambio en su cuenta.

**`RUL-MOV-10` — Fecha futura**

No se aceptan movimientos con fecha futura en V1: un gasto que no ocurrió no
es un movimiento, es un pago que viene
(`30_modulo_recurrentes_y_pagos_que_vienen.md`). Se rechaza con
`ERR-MOV-08` y se ofrece esa alternativa.

**`RUL-MOV-11` — Orden estable del listado**

```sql
order by occurred_at desc, id desc
```

El desempate por `id` es obligatorio para que la paginación por cursor sea
determinista (`14_contratos_api_web.md` §5).

**`RUL-MOV-12` — Acciones en lote**

Recategorizar, etiquetar y eliminar en lote siguen el contrato de operaciones
masivas: conteo real, muestra, exclusión y deshacer por lote.

## 7. Validaciones

| Campo | Regla |
|---|---|
| `amount` | Obligatorio. `> 0` salvo `ajuste`. Máximo 14 dígitos con 2 decimales. Acepta entrada como `1250.5`, `1,250.50`, `S/1250.50` y normaliza |
| `occurred_at` | Obligatorio. No futura (`RUL-MOV-10`). No anterior a 1970 |
| `type` | Obligatorio. Uno de los 11 |
| `description` | Opcional. Máximo 280 caracteres |
| `merchant` | Opcional. Máximo 80 caracteres |
| `category_id` | Opcional. Debe existir. Prohibido en tipos que no lo admiten (`RUL-CAT-11`) |
| Cuentas y cajas | Deben existir, estar activas y ser del usuario. Coherentes con el tipo según §4.3 |
| `debt_id` | Obligatorio en `pago_deuda`. La deuda debe estar activa |
| `recurring_rule_id` | Obligatorio en `pago_recurrente` |
| Motivo de ajuste | Obligatorio en `ajuste`. Máximo 200 caracteres |
| `Idempotency-Key` | Obligatorio en toda escritura. Mínimo 8 caracteres |

## 8. Superficies

### `SCR-MOV-01` — Listado de movimientos

**Ruta:** `/movimientos`
**Estado en URL:** `tipo`, `categoria`, `subcategoria`, `cuenta`, `caja`,
`etiqueta`, `estado`, `origen`, `desde`, `hasta`, `monto_min`, `monto_max`,
`q`, `orden`, `cursor`

```text
┌──────────────────────────────────────────────────┐
│ Movimientos                    [Buscar] [+ Nuevo]│
│ [Este mes ×] [Alimentación ×] [+ Filtros]        │  ← chips reales
│ 42 movimientos · S/1,240.50                      │  ← total del filtro
├──────────────────────────────────────────────────┤
│ ☐ 14 jul  Wong            Alimentación  -S/40.00 │
│ ☐ 14 jul  Transferencia   BCP → Yape    S/100.00 │  ← sin signo: no es gasto
│ ☐ 13 jul  Rappi ⚠️        Por revisar   -S/28.50 │
├──────────────────────────────────────────────────┤
│              [Cargar más]                        │  ← con manejador real
└──────────────────────────────────────────────────┘
```

Requisitos que corrigen el estado actual:

- **La búsqueda siempre está disponible**, no solo si ya hay un término en la
  URL.
- **Todos los chips de filtro son reales**: reflejan un filtro aplicado y su
  aspa lo quita. Prohibido un chip decorativo.
- **"Cargar más" tiene manejador**, estados de carga, y desaparece cuando
  `has_more` es falso.
- Los filtros se aplican en el servidor.
- El total mostrado corresponde al filtro activo, no al global.
- Selección múltiple con acciones en lote.
- Cada fila indica su origen y su estado sin depender solo del color.

### `SCR-MOV-02` — Detalle de movimiento

**Ruta:** `/movimientos/[id]` — panel sobre el listado al navegar, pantalla
completa si se carga directa (`10_sitemap_rutas_y_navegacion.md` §4).

Muestra: tipo, monto, fecha, comercio, descripción, categoría y
subcategoría, etiquetas, cuentas y cajas afectadas, deuda o recurrente
vinculado, **origen legible**, estado, **impacto explicado** ("Bajó tu saldo
de BCP y usó S/40.00 de tu presupuesto de Alimentación"), e historial de
cambios.

Acciones: editar, duplicar, eliminar, restaurar si está eliminado, ver por
qué se clasificó así.

### `SCR-MOV-03` — Nuevo movimiento

**Ruta:** `/movimientos/nuevo` — modal sobre el listado; tiene URL propia
para poder enlazarla desde el Inicio, un recordatorio o el asistente.

Estructura: selector de tipo primero, y el formulario se adapta según §4.3.
**Los 11 tipos terminan en un botón de guardar funcional.**

Los tipos con pantalla especializada muestran además un enlace secundario
("¿Prefieres registrarlo desde Deudas?"), nunca en lugar del botón.

### `SCR-MOV-04` — Editar movimiento

Modal sobre el detalle. Mismos campos. Si cambia el tipo, muestra el efecto
antes de confirmar (`RUL-MOV-07`).

### `SCR-MOV-05` — Confirmar eliminación

`AlertDialog`. Nombra el movimiento concreto: *"Eliminar el gasto de Wong,
S/40.00 del 14 de julio."* Botón: "Eliminar movimiento", nunca "Aceptar".

### `SCR-MOV-06` — Filtros

Panel lateral en escritorio, hoja inferior en móvil. Todos los filtros de
§8/`SCR-MOV-01`. Muestra cuántos resultados daría antes de aplicar.

### `SCR-MOV-07` — Acciones en lote

Barra que aparece con la selección: conteo, y acciones de recategorizar,
etiquetar y eliminar. Cada una con previsualización.

## 9. Acciones

| ID | Acción | Precondición | ¿Confirma? | Deshacer | Evento |
|---|---|---|---|---|---|
| `ACT-MOV-01` | Crear movimiento | Campos según tipo | Sí, si es por asistente | Eliminando | `movimiento.creado` |
| `ACT-MOV-02` | Editar movimiento | Existe, no eliminado | No | Editando | `movimiento.editado` |
| `ACT-MOV-03` | Cambiar tipo | Existe | **Sí, riesgo con efecto** | Cambiando de vuelta | `movimiento.tipo_cambiado` |
| `ACT-MOV-04` | Eliminar | Existe, no eliminado | **Sí, riesgo** | **Restaurar** | `movimiento.eliminado` |
| `ACT-MOV-05` | Restaurar | Eliminado | No | Eliminando | `movimiento.restaurado` |
| `ACT-MOV-06` | Duplicar | Existe | No | Eliminando la copia | `movimiento.duplicado` |
| `ACT-MOV-07` | Registrar igual pese al duplicado | Aviso mostrado | Sí | Eliminando | `duplicado.confirmado_igual` |
| `ACT-MOV-08` | Ver historial de cambios | Existe | No | — | `historial.consultado` |
| `ACT-MOV-09` | Ver impacto | Existe | No | — | `impacto.consultado` |
| `ACT-MOV-10` | Recategorizar en lote | Selección no vacía | **Sí, masiva** | Por lote | `clasificacion.lote` |
| `ACT-MOV-11` | Etiquetar en lote | Selección no vacía | **Sí, masiva** | Por lote | `etiqueta.lote` |
| `ACT-MOV-12` | Eliminar en lote | Selección no vacía | **Sí, masiva** | Por lote | `movimiento.eliminado_lote` |
| `ACT-MOV-13` | Exportar el resultado del filtro | — | No | — | `export.solicitado` |

## 10. API

Base `/api/v1/movements`.

| Método y ruta | Notas |
|---|---|
| `GET /movements` | **Cursor obligatorio.** Filtros de §8. `limit` por defecto 25, máximo 100. Devuelve `meta.page` y el total del filtro si se pide `include_total` |
| `POST /movements` | `Idempotency-Key` obligatoria. Puede devolver `409` con `requires_confirmation` |
| `GET /movements/[id]` | Detalle con impacto y origen resueltos |
| `PATCH /movements/[id]` | Edición. `Idempotency-Key` |
| `DELETE /movements/[id]` | Soft delete. `Idempotency-Key` |
| `POST /movements/[id]/restore` | Restaura y recalcula |
| `GET /movements/[id]/history` | Historial de cambios |
| `POST /movements/bulk` | Acciones en lote. `preview: true` devuelve conteo y muestra sin escribir. Devuelve `batch_id` |
| `POST /movements/bulk/[batch_id]/undo` | Deshace el lote |

Ejemplo de creación:

```jsonc
POST /api/v1/movements
Idempotency-Key: 8f2b9c1e-...
{
  "type": "gasto",
  "amount": "40.00",
  "occurred_at": "2026-07-14T19:20:00-05:00",
  "merchant": "Wong",
  "category_id": "alimentacion",
  "account_origin_id": "acc_bcp",
  "tags": ["necesario"]
}
```

El cliente **no envía** `affects_total_balance`, `affects_account_balance`,
`status` ni `confidence`. Los determina el Core.

## 11. Permisos y RLS

- Cliente autenticado en todas las rutas. **Sin excepciones de service-role.**
- RLS por `user_id` en `movements`, `movement_audit_log` y `movement_tags`.
- El rol `authenticated` **no puede insertar ni actualizar `movements`
  directamente**: toda escritura pasa por funciones del Core
  (`WEB-D012`), que actualizan movimiento, saldos, auditoría y outbox en una
  sola transacción.
- Un movimiento de otro usuario devuelve 404.

## 12. Estados de datos

| Estado | Qué se muestra |
|---|---|
| **Vacío** (sin ningún movimiento) | "Cuando registres algo, aparecerá aquí." + *Nuevo movimiento* + *Importar* |
| **Sin resultados** (hay datos, el filtro no coincide) | "No encontré movimientos con esos filtros." + *Limpiar filtros* |
| **Pocos** | Listado normal; sin totales comparativos que no tengan base |
| **Muchos** | Cursor funcionando; el total del filtro visible |
| **Cargando** | Esqueleto de 6 filas con la forma real |
| **Cargando más** | Filas existentes visibles, indicador al pie |
| **Error** | "No pude cargar tus movimientos. Tus datos siguen guardados." + reintentar |
| **Por revisar** | Distintivo textual e icono; acción de completar |
| **Eliminado** | Solo visible con el filtro `estado=eliminado`; con acción de restaurar |
| **Modo discreto** | Montos como `S/•••`; comercios ocultos en la lista, visibles al abrir el detalle |

Los dos primeros son estados **distintos**, con mensaje y acción distintos
(`17_patrones_datos_formularios_y_listados.md` §4.2).

## 13. Errores

| ID | Causa | Mensaje visible | Salida |
|---|---|---|---|
| `ERR-MOV-01` | Monto ausente o cero | "Necesito el monto." | Completar |
| `ERR-MOV-02` | Monto con formato inválido | "No entendí ese monto. Escríbelo como 40 o 40.50." | Corregir |
| `ERR-MOV-03` | Falta un campo obligatorio del tipo | "Para registrar un pago de deuda necesito saber cuál." | Completar el campo señalado |
| `ERR-MOV-04` | Cuenta o caja inexistente | "No encontré esa cuenta." | Elegir otra |
| `ERR-MOV-05` | Cuenta archivada | "Esa cuenta está archivada. ¿La restauramos?" | Restaurar o elegir otra |
| `ERR-MOV-06` | Campo prohibido para el tipo | "Las transferencias no llevan categoría: no son un gasto." | Quitar el campo |
| `ERR-MOV-07` | Duplicado probable | "Ya tienes un movimiento igual el 14 de julio." | Ver el existente / Registrar igual |
| `ERR-MOV-08` | Fecha futura | "Esa fecha todavía no llega. ¿Quieres anotarlo como un pago que viene?" | Ir a Pagos que vienen |
| `ERR-MOV-09` | Movimiento no encontrado | "No encontré ese movimiento." | Volver al listado |
| `ERR-MOV-10` | Editar uno eliminado | "Ese movimiento está eliminado. ¿Lo restauramos primero?" | Restaurar |
| `ERR-MOV-11` | Falta `Idempotency-Key` | "No pude procesar la solicitud." (técnico, no del usuario) | Reintentar |
| `ERR-MOV-12` | Deuda o recurrente inactivo | "Esa deuda ya está cerrada." | Elegir otra |
| `ERR-MOV-13` | Lote vacío | "No hay movimientos seleccionados." | Seleccionar |
| `ERR-MOV-14` | Deshacer lote fuera de plazo | "Ese cambio ya no se deshace en bloque, pero puedes corregir los movimientos." | Ir al listado |

## 14. Integración con el motor IA

### 14.1 Consultas que expone

Entidad principal: `movimientos`.

| Dimensión | Notas |
|---|---|
| `tipo` | Los 11 |
| `estado` | confirmado, por revisar, corregido, eliminado |
| `origen` | manual, correo, importación, asistente, recurrente, whatsapp |
| `comercio` | |
| `cuenta`, `caja` | |
| `fecha` | Con rangos arbitrarios — clave para que el modelo aplique su conocimiento del mundo (`20b` §5.2) |
| `dia_semana`, `quincena`, `franja_horaria`, `semana_del_mes` | Aritmética de fechas |
| `frecuencia_comercio` | única vez, ocasional, habitual, recurrente |
| `es_primera_vez` | En ese comercio |
| `dias_desde_anterior_igual` | En el mismo comercio |
| `desviacion_de_su_promedio` | Respecto al comportamiento propio del usuario |
| `afecta_saldo` | Derivada del tipo |
| `tiene_adjunto`, `tiene_nota` | |

| Medida | Notas |
|---|---|
| `suma`, `conteo`, `promedio`, `mediana`, `maximo`, `minimo`, `percentil` | |
| `conteo_comercios_distintos` | |
| `proporcion_del_total` | |

**Regla del compilador:** las consultas de gasto excluyen por defecto
`transferencia`, `asignacion_interna` y `ajuste` (`RUL-CAT-11`). Incluirlos
requiere pedirlo explícitamente.

### 14.2 Comandos que acepta

| Comando | Confirmación | Idempotente |
|---|---|---|
| `crear_movimiento` | Tarjeta editable con lo dudoso resaltado | Sí |
| `editar_movimiento` | Tarjeta editable | Sí |
| `cambiar_tipo` | **Riesgo**, mostrando el efecto | Sí |
| `eliminar_movimiento` | **Riesgo**, nombrando el movimiento | Sí |
| `restaurar_movimiento` | Tarjeta | Sí |
| `duplicar_movimiento` | Tarjeta editable | Sí |
| `recategorizar_lote` | **Masiva** | Sí |
| `etiquetar_lote` | **Masiva** | Sí |
| `eliminar_lote` | **Masiva, riesgo** | Sí |

### 14.3 Qué se puede pedir en lenguaje natural

```text
"gasté 40 en el súper"                      → crear_movimiento
"el taxi de ayer fueron 18, no 15"          → editar_movimiento
"borra el último"                           → eliminar_movimiento (riesgo)
"eso que borré, devuélvelo"                 → restaurar_movimiento
"¿cuánto gasté en julio?"                   → consulta con evidencia
"de esos, ¿cuáles fueron el finde?"         → consulta sobre el foco
"¿qué compré por primera vez este mes?"     → es_primera_vez
"esto no era un gasto, fue transferencia"   → cambiar_tipo (riesgo)
```

La sexta apoya el foco del turno (`22` §4): "esos" son exactamente los
identificadores devueltos por la consulta anterior.

### 14.4 Lo que el motor NO puede hacer aquí

- Escribir `affects_*`, `status` o `confidence`.
- Crear un movimiento con fecha futura.
- Eliminar sin confirmación de riesgo.
- Ejecutar un lote sin previsualización.

## 15. Memoria y aprendizaje

| Qué aprende | Evidencia | Cómo se corrige |
|---|---|---|
| Comercio habitual y su categoría | Registros confirmados | Reclasificando (módulo 25) |
| Cuenta habitual por tipo de gasto | Registros confirmados | Cambiando cuenta por defecto |
| Montos típicos por comercio | Historial | — (solo informa el aviso de anomalía) |
| Cómo describe sus movimientos | Texto libre repetido | — |

Los montos típicos alimentan la dimensión `desviacion_de_su_promedio` y el
aviso de "esto se sale de lo normal", que **es informativo y no bloquea**.

## 16. Eventos y telemetría

Eventos: `movimiento.creado`, `.editado`, `.eliminado`, `.restaurado`,
`.duplicado`, `.tipo_cambiado`, `duplicado.advertido`,
`duplicado.confirmado_igual`, `historial.consultado`, `impacto.consultado`,
`clasificacion.lote`, `etiqueta.lote`, `movimiento.eliminado_lote`.

**Nunca llevan monto, comercio ni descripción.** Sí llevan tipo, origen,
categoría y `trace_id`.

Métricas: movimientos por usuario y semana, distribución por origen (indica
qué vía de captura funciona), tiempo desde abrir el formulario hasta guardar,
tasa de duplicados advertidos y confirmados, tasa de corrección, uso de la
restauración.

## 17. Rendimiento

- Índice obligatorio para el cursor:
  `movements (user_id, occurred_at desc, id desc) where deleted_at is null`.
- Índices de filtro: `(user_id, type)`, `(user_id, category_id)`,
  `(user_id, account_origin_id)`, `(user_id, status)`.
- Búsqueda por texto: índice sobre `merchant` y `description` con búsqueda
  de texto completo en español.
- Nunca `SELECT *` sobre el historial completo: siempre con cursor y límite.
- Un lote se ejecuta en transacción con `batch_id`.
- Presupuesto: listado de 25 filas bajo 400 ms en el percentil 95; detalle
  bajo 250 ms.

## 18. Accesibilidad específica

- Cada fila es un enlace navegable con teclado, con nombre accesible que
  incluye tipo, comercio, fecha y monto.
- El monto se anuncia con signo y moneda: "menos 40 soles".
- El estado "por revisar" se anuncia como texto, no solo con icono.
- La selección múltiple se opera con teclado; el conteo seleccionado se
  anuncia en región activa.
- "Cargar más" mantiene el foco tras cargar, sin saltar al inicio.
- El modal de nuevo movimiento devuelve el foco al botón que lo abrió.

## 19. Casos borde

1. **Registrar con fecha de hace dos años.** Permitido. Recalcula
   presupuestos y resúmenes de ese periodo.
2. **Editar el monto de un movimiento que ya pagó una cuota de deuda.** Se
   recalcula la deuda y se avisa el efecto antes de confirmar.
3. **Eliminar un movimiento vinculado a una ocurrencia recurrente.** La
   ocurrencia vuelve a "pendiente de pago"; se avisa.
4. **Restaurar un movimiento cuya cuenta fue archivada.** Se restaura y se
   avisa que su cuenta está archivada; el movimiento queda visible pero no
   suma al total.
5. **Dos pestañas creando el mismo movimiento.** La idempotencia lo impide;
   la segunda recibe el resultado de la primera.
6. **Duplicado con montos que difieren en céntimos.** No se advierte: el
   umbral exige mismo monto exacto.
7. **Movimiento sin cuenta y sin categoría.** Válido. Queda `needs_review` y
   aparece en el aviso de pendientes de clasificar.
8. **Lote de 500 movimientos.** Se ejecuta; la previsualización muestra
   conteo y 5 ejemplos.
9. **Cambiar el tipo a uno que exige un campo ausente.** Se pide el campo en
   el mismo formulario antes de permitir guardar.
10. **Filtro que no devuelve nada tras eliminar el último resultado.** Se
    muestra "sin resultados", no "vacío".
11. **Movimiento en moneda distinta de PEN.** El modelo lo soporta; la
    interfaz de V1 no permite crearlo, pero sí mostrarlo si existe.
12. **Historial de cambios muy largo.** Se pagina; se muestran los 10 últimos
    con opción de ver todo.

## 20. Criterios de aceptación

- `AC-MOV-01` — Los 11 tipos se guardan desde `/movimientos/nuevo` sin
  redirigir a otra pantalla. Evidencia: `TEST` + `USER`.
- `AC-MOV-02` — El listado recorre el conjunto completo mediante cursor.
  Evidencia: `TEST` (E2E).
- `AC-MOV-03` — Todos los filtros se aplican en el servidor.
  Evidencia: `TEST`.
- `AC-MOV-04` — Ningún control del listado carece de manejador funcional.
  Evidencia: `TEST`.
- `AC-MOV-05` — La búsqueda está siempre disponible, sin depender de la URL.
  Evidencia: `TEST`.
- `AC-MOV-06` — Un movimiento eliminado se restaura y su impacto se
  recalcula correctamente. Evidencia: `TEST`.
- `AC-MOV-07` — Toda edición queda en el historial con valor anterior y
  nuevo. Evidencia: `TEST`.
- `AC-MOV-08` — Repetir una creación con la misma `Idempotency-Key` no
  duplica. Evidencia: `TEST`.
- `AC-MOV-09` — Un duplicado probable se advierte antes de guardar y ofrece
  las dos salidas. Evidencia: `TEST` + `USER`.
- `AC-MOV-10` — El cliente no puede imponer `affects_*`, `status` ni
  `confidence`. Evidencia: `TEST`.
- `AC-MOV-11` — Cambiar el tipo muestra el efecto sobre saldos antes de
  confirmar. Evidencia: `TEST` + `USER`.
- `AC-MOV-12` — Un movimiento a las 23:30 hora de Lima queda con la fecha de
  ese día. Evidencia: `TEST`.
- `AC-MOV-13` — Una fecha futura se rechaza ofreciendo Pagos que vienen.
  Evidencia: `TEST`.
- `AC-MOV-14` — "Vacío" y "sin resultados" son estados distintos.
  Evidencia: `TEST` + `USER`.
- `AC-MOV-15` — Un lote muestra conteo y muestra reales antes de ejecutar, y
  se deshace entero. Evidencia: `TEST`.
- `AC-MOV-16` — El detalle explica el impacto del movimiento en lenguaje del
  usuario. Evidencia: `USER`.
- `AC-MOV-17` — `confidence` no aparece en ninguna superficie.
  Evidencia: `TEST`.
- `AC-MOV-18` — Ninguna ruta de este módulo usa service-role.
  Evidencia: `TEST`.
- `AC-MOV-19` — El rol `authenticated` no puede insertar en `movements`
  directamente. Evidencia: `TEST`.
- `AC-MOV-20` — Cada fila del listado es navegable con teclado y su monto se
  anuncia con signo y moneda. Evidencia: `TEST`.

## 21. Fuera de alcance y puente a WhatsApp

Fuera de V1-web: OCR, voz, adjuntos múltiples, división entre categorías,
movimientos programados.

Puente a WhatsApp: los comandos de §14.2 son agnósticos de canal. La
diferencia de presentación estará en el listado —WhatsApp mostrará los
primeros resultados y un enlace— y en la selección múltiple, que en
conversación se resolverá por descripción del conjunto en vez de por
casillas.

## 22. Trazabilidad

**Documentos de `docs/` consumidos:**
`docs/fase_4_tecnica/16_modelo_datos.md` §7 (tabla, auditoría, tags),
`docs/fase_2_estrategia/alcance_v1/05e_cuentas_cajas.md` §11 (afectación por
tipo), `docs/fase_6_visual/32_especificacion_hifi.md` (Movimientos, detalle,
formulario), `docs/fase_3_producto/16_confianza_errores.md` (estados de
confianza, deshacer/borrar).

**Contradicciones que cierra:** `C-05` (tipos no guardables — el estado real
verificado es 9 de 11, peor que los 3 documentados), `C-07` (Movimientos sin
detalle, edición ni eliminación).

**Diferencias frente a los documentos fuente:** se añade la restauración como
acción de primera clase, posible desde la migración `046`; se añaden las
acciones en lote, que ninguna fuente contemplaba; se prohíbe explícitamente
la fecha futura, que las fuentes no acotaban; y se retira `confidence` de
toda superficie visible.
