# 24 — Módulo: Cuentas y cajas

**ID de módulo:** `MOD-CUENTAS`
**Bloque:** 04 — Módulos
**Estado:** V1
**Fecha:** 25 de julio de 2026
**Docs fuente:** `docs/fase_2_estrategia/alcance_v1/05e_cuentas_cajas.md` (V2, reutilizado), `docs/fase_4_tecnica/16_modelo_datos.md` §6, `09_modelo_mental_dinero.md`, `docs/fase_6_visual/32_especificacion_hifi.md`
**Documentos que dependen de este:** `26` (movimientos), `30` (recurrentes), `31` (deudas), `32` (presupuestos), `33` (proyecciones), `39` (home)

---

## 1. Tesis y qué NO es

El dinero que tienes no es el dinero que puedes gastar. Este módulo modela
esa distinción: **dónde está** tu dinero (cuentas) y **para qué está**
separado (cajas), y de ahí calcula la cifra que gobierna todo el producto —
el dinero libre.

**Qué NO es:**

- No es una réplica de tu banca en línea. No sincroniza saldos ni ejecuta
  transferencias reales.
- No es contabilidad de partida doble.
- No es un sistema de sobres rígido: una caja no bloquea el dinero, lo
  etiqueta.
- No obliga a configurar nada. El producto funciona sin una sola cuenta
  creada; sin ellas simplemente no puede calcular dinero libre, y lo dice.

## 2. Alcance

| Nivel | Funcionalidad |
|---|---|
| **IN V1-web** | Crear, editar y archivar cuentas (`digital`, `banco`, `fisico`, `tarjeta`). Crear, editar y eliminar cajas (`compromiso`, `objetivo`, `emergencia`). Cálculo de libre en cuentas y dinero libre. Transferencia entre cuentas propias. Asignación interna entre libre y cajas de la misma cuenta. Saldo inicial y ajuste manual de saldo. Saldo negativo permitido con aviso. Vinculación de caja a deuda o a pago recurrente. Meta y progreso en cajas de objetivo. Cuenta por defecto. |
| **V1.1** | Cajas compartidas entre cuentas como entidad propia (hoy la agregación cross-account es solo visual). Historial de saldo por cuenta en el tiempo. Auto-asignación de ingresos a cajas por reglas. |
| **FUERA** | Multi-moneda con UI completa (el modelo conserva `currency`). Conexión bancaria directa. Tarjeta de crédito como cuenta de saldo — vive en `31_modulo_deudas.md`. Mover una caja de una cuenta a otra. Transferencia caja→caja entre cuentas distintas. |

## 3. Vocabulario

| Interno | Visible | Nota |
|---|---|---|
| `Account` | Cuenta | "Yape", "BCP", "Efectivo" |
| `Box` | Caja | "Dinero separado para algo" |
| `free_in_account` | Libre en cuentas | Subcálculo de detalle |
| `operational_free_money` | **Dinero libre** | Número principal. Nunca decir "operativo" |
| `initial_balance` | Saldo inicial | |
| `current_balance` | Saldo | |
| `target_amount` | Meta | Solo en cajas de objetivo |
| `asignacion_interna` | Separar dinero / Mover a caja | Nunca "asignación interna" |
| `ajuste` | Ajustar saldo | |

Glosario completo en `04_glosario_y_lenguaje_visible.md`.

## 4. Entidades y datos

### 4.1 `accounts`

```sql
id               uuid pk
user_id          uuid not null references auth.users(id)
name             text not null
institution      text null
type             account_type not null    -- digital | banco | fisico | tarjeta
currency         text not null default 'PEN'
initial_balance  numeric(14,2) not null default 0
current_balance  numeric(14,2) not null default 0
is_default       boolean not null default false
color            text null
icon             text null
created_at, updated_at, deleted_at, metadata
```

Restricciones:

- Único parcial: **una sola cuenta `is_default = true` activa por usuario.**
- Único parcial: `(user_id, lower(name))` entre cuentas activas.
- `current_balance` es un **snapshot que recalcula el Balance Engine**; no se
  edita directamente por API (ver `RUL-CUENTAS-08`).
- `type = 'tarjeta'` aplica solo a débito o prepago. Crédito vive en Deudas.

### 4.2 `boxes`

```sql
id                     uuid pk
user_id                uuid not null
account_id             uuid not null references accounts(id)
name                   text not null
type                   box_type not null    -- compromiso | objetivo | emergencia
current_balance        numeric(14,2) not null default 0
target_amount          numeric(14,2) null
target_date            date null
linked_debt_id         uuid null references debts(id)
linked_recurring_id    uuid null references recurring_rules(id)
created_at, updated_at, deleted_at, metadata
```

Restricciones:

- Una caja **siempre pertenece a una cuenta**. `account_id` no es nullable.
- Único parcial: `(user_id, account_id, lower(name))` entre cajas activas.
- `target_amount` solo tiene sentido con `type = 'objetivo'`; en los demás se
  ignora en la interfaz.
- `linked_debt_id` solo con `type = 'compromiso'`.
- **`current_balance >= 0` siempre.** Una caja no puede quedar en negativo
  (a diferencia de una cuenta).

### 4.3 Lo que NO es una tabla

**"Libre" no existe como fila.** Es un cálculo:

```text
libre_en_cuenta = account.current_balance − Σ(boxes activas de esa cuenta)
```

Si el saldo de la cuenta cambia, el libre se ajusta solo. No hay entidad que
mantener sincronizada, y por tanto no hay forma de que se desincronice.

### 4.4 Migraciones requeridas

Ninguna nueva. Las tablas existen desde las migraciones `003` y `004`.

## 5. Máquina de estados

### 5.1 Cuenta

```text
              crear
                │
                ▼
           ┌─────────┐  editar   ┌─────────┐
           │ activa  │◄─────────►│ activa  │
           └────┬────┘           └─────────┘
                │ archivar (deleted_at)
                ▼
           ┌──────────┐  restaurar   ┌────────┐
           │ archivada│─────────────►│ activa │
           └──────────┘              └────────┘
```

| Transición | Quién la dispara | Efectos | ¿Reversible? |
|---|---|---|---|
| crear | Usuario o asistente | Si `initial_balance ≠ 0`, genera movimiento `ajuste` de apertura | Sí, archivando |
| editar | Usuario o asistente | Cambia nombre, tipo, color, icono. **No cambia saldo** | Sí |
| ajustar saldo | Usuario o asistente | Genera movimiento `ajuste` por la diferencia | Sí, con otro ajuste |
| archivar | Usuario | `deleted_at`. Sus cajas se archivan en cascada. Sus movimientos **se conservan** | Sí |
| restaurar | Usuario | Reactiva cuenta y sus cajas | Sí |

**Archivar no es borrar.** El historial de movimientos que apuntan a esa
cuenta se conserva íntegro; la cuenta deja de aparecer en selectores y de
sumar al dinero total.

### 5.2 Caja

```text
   crear ──► activa ──► completada (solo tipo objetivo, al llegar a la meta)
               │              │
               │              └──► activa (si el saldo baja de la meta)
               ▼
           eliminada
```

| Transición | Efectos |
|---|---|
| crear | Caja con saldo 0. Crear **no mueve dinero** |
| separar dinero | `asignacion_interna` de libre a la caja |
| devolver a libre | `asignacion_interna` de la caja a libre |
| completar | Automático cuando `current_balance >= target_amount`. Es visual, no bloquea nada |
| eliminar con saldo > 0 | **Genera `asignacion_interna` de la caja a libre**, y luego archiva. Nunca se pierde dinero |
| eliminar con saldo = 0 | Archiva directamente |

## 6. Reglas de negocio

**`RUL-CUENTAS-01` — Libre en una cuenta**

```text
libre_en_cuenta = saldo_cuenta − Σ(cajas activas de esa cuenta)
```

Ejemplo: BCP tiene S/630.00, con cajas Emergencia S/100.00, Cuota laptop
S/180.00 y Alquiler S/300.00.
→ `libre_en_BCP = 630.00 − 580.00 = S/50.00`

**`RUL-CUENTAS-02` — Libre en cuentas global**

```text
libre_en_cuentas = Σ(saldos de cuentas activas) − Σ(todas las cajas activas)
```

Ejemplo: BCP S/630.00 + Yape S/120.00 + Efectivo S/50.00 = S/800.00 total.
Cajas: S/580.00.
→ `libre_en_cuentas = S/220.00`

**`RUL-CUENTAS-03` — Dinero libre**

```text
dinero_libre = libre_en_cuentas − compromisos_próximos_no_cubiertos_por_caja
```

Ejemplo continuando el anterior: hay dos compromisos en los próximos 30 días
— Internet S/50.00 (sin caja) y Cuota laptop S/180.00 (con caja de S/180.00).
Solo el primero descuenta.
→ `dinero_libre = 220.00 − 50.00 = S/170.00`

**`RUL-CUENTAS-04` — No hay doble descuento**

Un compromiso cubierto por una caja con saldo suficiente **no se descuenta**
del dinero libre. Su dinero ya salió del libre cuando se separó en la caja.

Verificación con el ejemplo: si la cuota de S/180.00 se descontara igual, el
dinero libre daría `220.00 − 230.00 = S/-10.00`. Ese error de doble conteo es
el más fácil de cometer y el más difícil de ver en pantalla.

Cobertura parcial: si la caja tiene S/120.00 y el compromiso es S/180.00, se
descuenta solo la diferencia, S/60.00.

**`RUL-CUENTAS-05` — Horizonte de compromisos**

Los compromisos próximos son los que vencen en los **próximos 30 días
naturales**, calculados en `America/Lima`. Definido en
`09_modelo_mental_dinero.md` §7.

**`RUL-CUENTAS-06` — Una caja pertenece a una cuenta**

El saldo de una caja nunca supera el saldo de su cuenta. Si una operación lo
produciría, se rechaza con `ERR-CUENTAS-04`.

**`RUL-CUENTAS-07` — Las cajas no pueden quedar negativas**

A diferencia de las cuentas, `box.current_balance >= 0` siempre. Devolver
más de lo que tiene una caja se rechaza.

**`RUL-CUENTAS-08` — El saldo no se edita, se ajusta**

`current_balance` es un snapshot del Balance Engine. Cambiarlo requiere un
movimiento `ajuste` por la diferencia, que queda en el historial.

Ejemplo: Yape marca S/120.00 y el usuario dice que tiene S/350.00.
→ Se crea `ajuste` de `+S/230.00` con motivo, y el Balance Engine recalcula.
Nunca se hace `UPDATE accounts SET current_balance = 350`.

**`RUL-CUENTAS-09` — Saldo negativo permitido**

Una cuenta puede quedar en negativo. **Nunca se bloquea un movimiento por
eso.** Se muestra con aviso y se ofrece ajustar.

**`RUL-CUENTAS-10` — Efecto de cada tipo de movimiento**

| Tipo | Cuenta origen | Cuenta destino | Caja origen | Caja destino | Afecta total |
|---|---|---|---|---|---|
| `gasto` | decrementa | — | libre o específica | — | Sí (−) |
| `ingreso` | — | incrementa | — | libre por defecto | Sí (+) |
| `transferencia` | decrementa | incrementa | — | — | **No** |
| `asignacion_interna` | — | — | decrementa | incrementa | **No** |
| `deuda_adquirida` | — | — | — | — | No |
| `pago_deuda` | decrementa | — | caja si existe | — | Sí (−) |
| `prestamo_dado` | decrementa | — | — | — | Sí (−) |
| `prestamo_recibido` | — | incrementa | — | — | Sí (+) |
| `devolucion_recibida` | — | incrementa | — | — | Sí (+) |
| `pago_recurrente` | decrementa | — | caja si vinculada | — | Sí (−) |
| `ajuste` | varía | varía | varía | varía | varía |

Las dos filas con **No** son la fuente de error más común: mover dinero
entre cuentas propias o separarlo en una caja **no es gasto** y no reduce tu
patrimonio.

**`RUL-CUENTAS-11` — Asignación interna es intra-cuenta**

Una `asignacion_interna` solo mueve dinero entre libre y cajas **de la misma
cuenta**. Mover entre cajas de cuentas distintas requeriría una
transferencia previa, y queda fuera de V1.

| Dirección | `box_origin_id` | `box_destination_id` |
|---|---|---|
| Libre → Caja | `null` | id de caja |
| Caja → Libre | id de caja | `null` |
| Caja → Caja (misma cuenta) | id A | id B |

**`RUL-CUENTAS-12` — Movimiento sin cuenta**

Un movimiento con `account_origin_id = null` es válido: afecta categorías,
presupuestos y el total gastado, pero **no afecta ningún saldo por cuenta**.
La interfaz lo indica en el detalle del movimiento.

**`RUL-CUENTAS-13` — Cuenta por defecto**

Como máximo una cuenta activa con `is_default = true`. Marcar una nueva
desmarca la anterior en la misma operación. Si el usuario tiene una sola
cuenta, es la de por defecto aunque no esté marcada.

**`RUL-CUENTAS-14` — Eliminar caja con saldo**

Genera una `asignacion_interna` de la caja hacia libre por su saldo completo
y luego archiva. **El dinero nunca desaparece.**

Ejemplo: caja Viaje con S/340.00 se elimina.
→ `asignacion_interna` de S/340.00 hacia libre. El libre de esa cuenta sube
S/340.00, el saldo de la cuenta no cambia.

**`RUL-CUENTAS-15` — Redondeo**

Todo cálculo redondea al céntimo (2 decimales) al final, nunca en pasos
intermedios. Se usa decimal, nunca coma flotante.

## 7. Validaciones

### 7.1 Cuenta

| Campo | Regla |
|---|---|
| `name` | Obligatorio. 1–60 caracteres. Se normaliza recortando espacios. Único por usuario, sin distinguir mayúsculas |
| `type` | Obligatorio. Uno de los cuatro valores del enum |
| `institution` | Opcional. Máximo 60 caracteres. Se usa para emparejar con detección por correo |
| `currency` | Por defecto `PEN`. En V1 solo se acepta `PEN` desde la interfaz |
| `initial_balance` | Opcional, por defecto 0. Acepta negativo. Máximo 14 dígitos con 2 decimales |
| `color`, `icon` | Opcionales. Del catálogo del design system, no libres |
| `is_default` | Booleano. Marcarlo desmarca la anterior |

### 7.2 Caja

| Campo | Regla |
|---|---|
| `name` | Obligatorio. 1–60 caracteres. Único por cuenta |
| `account_id` | Obligatorio. La cuenta debe existir, estar activa y ser del usuario |
| `type` | Obligatorio |
| `target_amount` | Solo si `type = 'objetivo'`. Debe ser > 0 |
| `target_date` | Opcional. Si se indica, debe ser futura al crearla |
| `linked_debt_id` | Solo si `type = 'compromiso'`. La deuda debe existir y estar activa |
| `linked_recurring_id` | La regla recurrente debe existir y estar activa |

### 7.3 Operaciones de dinero

| Operación | Reglas |
|---|---|
| Transferencia | Origen ≠ destino. Ambas activas y del usuario. Monto > 0 |
| Separar en caja | Monto > 0. No puede superar el libre de la cuenta |
| Devolver a libre | Monto > 0. No puede superar el saldo de la caja |
| Mover entre cajas | Misma cuenta. Monto ≤ saldo de la caja origen |
| Ajustar saldo | Nuevo saldo distinto del actual. Motivo opcional, máximo 200 caracteres |

Zona horaria: las fechas de operación se interpretan en `America/Lima`. Un
ajuste registrado a las 23:30 del 14 de julio queda con fecha del 14.

## 8. Superficies

### `SCR-CUENTAS-01` — Mi Dinero

**Ruta:** `/mi-dinero`
**Referencia visual:** `docs/fase_6_visual/32_especificacion_hifi.md` (Mi Dinero), frames `stitch_manzana_v1/` de la sección Mi Dinero.

Jerarquía, derivada de `09_modelo_mental_dinero.md` §6:

```text
┌────────────────────────────────────────┐
│  Dinero libre            S/170.00      │  ← cifra principal
│  [¿de dónde sale?]                     │  ← EvidenceLink
│                                        │
│  Total S/800  ·  Separado S/580        │  ← contexto, tamaño menor
│  Libre en cuentas S/220                │
│  Próximos sin cubrir S/50              │
├────────────────────────────────────────┤
│  Cuentas                    [+ Nueva]  │
│  BCP          S/630.00   3 cajas   ⚠️  │  ← aviso si negativa
│  Yape         S/120.00   sin cajas     │
│  Efectivo      S/50.00   sin cajas     │
├────────────────────────────────────────┤
│  Cajas                      [+ Nueva]  │
│  Alquiler        S/300.00              │
│  Cuota laptop    S/180.00 / S/2,400 ▓▓ │  ← progreso si hay meta
│  Emergencia      S/100.00 / S/1,000 ▓  │
└────────────────────────────────────────┘
```

Reglas de la pantalla:

- **El dinero total nunca es la cifra principal** (`AC-DINERO-04`).
- El desglose completo de las cuatro capas está a un clic, siempre.
- Las cajas se agrupan visualmente entre cuentas, pero cada una sigue
  perteneciendo a su cuenta; al abrir una se ve cuál.
- Móvil: una columna, cifra principal arriba, cuentas y cajas en secciones
  colapsables.
- Ancho máximo del contenido: 1200px (`16_design_system_web.md` §7).

### `SCR-CUENTAS-02` — Detalle de cuenta

**Ruta:** `/mi-dinero/cuentas/[id]`

Muestra: saldo actual, saldo inicial, libre en esa cuenta, sus cajas,
movimientos recientes de esa cuenta con enlace al listado filtrado, y las
acciones. Si el saldo es negativo, aviso con acción de ajustar.

### `SCR-CUENTAS-03` — Detalle de caja

**Ruta:** `/mi-dinero/cajas/[id]`

Muestra: saldo, meta y progreso si aplica, a qué cuenta pertenece, deuda o
pago recurrente vinculado, historial de asignaciones, y las acciones.

### `SCR-CUENTAS-04` — Crear/editar cuenta

Modal sobre `/mi-dinero`. Campos según §7.1. El saldo inicial se pide solo al
crear; después se cambia con ajuste.

### `SCR-CUENTAS-05` — Crear/editar caja

Modal sobre `/mi-dinero`. Campos según §7.2. Al crear, ofrece separar dinero
de inmediato como paso opcional.

### `SCR-CUENTAS-06` — Mover dinero

Modal. Una sola superficie para las cuatro operaciones (transferir, separar,
devolver, mover entre cajas): el usuario elige origen y destino, y el sistema
deduce el tipo de movimiento. Muestra el efecto antes de confirmar.

### `SCR-CUENTAS-07` — Ajustar saldo

Modal de confirmación de riesgo. Muestra saldo actual, pide el real, calcula
y muestra la diferencia, y pide motivo opcional.

## 9. Acciones

| ID | Acción | Precondición | ¿Confirma? | Deshacer | Evento |
|---|---|---|---|---|---|
| `ACT-CUENTAS-01` | Crear cuenta | — | No | Archivando | `cuenta.creada` |
| `ACT-CUENTAS-02` | Editar cuenta | Existe y activa | No | Editando | `cuenta.editada` |
| `ACT-CUENTAS-03` | Archivar cuenta | Existe y activa | **Sí, riesgo** | Restaurar | `cuenta.archivada` |
| `ACT-CUENTAS-04` | Restaurar cuenta | Archivada | No | Archivando | `cuenta.restaurada` |
| `ACT-CUENTAS-05` | Marcar por defecto | Existe y activa | No | Marcando otra | `cuenta.default_cambiada` |
| `ACT-CUENTAS-06` | Ajustar saldo | Existe y activa | **Sí, riesgo** | Otro ajuste | `cuenta.saldo_ajustado` |
| `ACT-CUENTAS-07` | Crear caja | Cuenta activa | No | Eliminando | `caja.creada` |
| `ACT-CUENTAS-08` | Editar caja | Existe y activa | No | Editando | `caja.editada` |
| `ACT-CUENTAS-09` | Eliminar caja | Existe y activa | **Sí, riesgo si tiene saldo** | No automático | `caja.eliminada` |
| `ACT-CUENTAS-10` | Transferir entre cuentas | Dos cuentas activas distintas | Sí | Eliminando el movimiento | `movimiento.creado` |
| `ACT-CUENTAS-11` | Separar dinero en caja | Libre suficiente | Sí | Devolviendo | `movimiento.creado` |
| `ACT-CUENTAS-12` | Devolver de caja a libre | Saldo suficiente en caja | Sí | Separando de nuevo | `movimiento.creado` |
| `ACT-CUENTAS-13` | Mover entre cajas | Misma cuenta, saldo suficiente | Sí | Moviendo al revés | `movimiento.creado` |
| `ACT-CUENTAS-14` | Vincular caja a deuda | Caja de compromiso, deuda activa | No | Desvinculando | `caja.vinculada` |
| `ACT-CUENTAS-15` | Ver desglose del dinero libre | — | No | — | `desglose.consultado` |

Las acciones 10 a 13 crean movimientos y por tanto pasan por el
`CommandDispatcher` (`WEB-D012`). Las demás operan sobre las entidades
directamente, con auditoría.

La confirmación de `ACT-CUENTAS-09` nombra el efecto real cuando hay saldo:
*"Eliminar la caja Viaje. Sus S/340.00 vuelven a tu dinero libre."*

## 10. API

Base: `/api/v1/accounts` y `/api/v1/boxes`. Contrato general en
`14_contratos_api_web.md`.

| Método y ruta | Qué hace |
|---|---|
| `GET /accounts` | Lista cuentas activas. Filtros: `include_archived`. Sin paginación (el volumen es de decenas) |
| `POST /accounts` | Crea. Requiere `Idempotency-Key` si `initial_balance ≠ 0` |
| `GET /accounts/[id]` | Detalle con libre calculado y sus cajas |
| `PATCH /accounts/[id]` | Edita nombre, tipo, institución, color, icono, `is_default` |
| `DELETE /accounts/[id]` | Archiva. Cascada a sus cajas |
| `POST /accounts/[id]/restore` | Restaura |
| `POST /accounts/[id]/adjust` | Ajusta saldo. **Requiere `Idempotency-Key`**. Crea movimiento `ajuste` |
| `GET /boxes` | Lista cajas activas. Filtro: `account_id` |
| `POST /boxes` | Crea |
| `GET /boxes/[id]` | Detalle con progreso |
| `PATCH /boxes/[id]` | Edita |
| `DELETE /boxes/[id]` | Elimina, devolviendo saldo a libre si lo hay |
| `GET /summary` | Las cuatro capas con sus referencias de evidencia |
| `POST /money/actions` | Transferir, separar, devolver, mover. **Requiere `Idempotency-Key`** |

`POST /money/actions` recibe:

```jsonc
{
  "action": "transferir | separar | devolver | mover_entre_cajas",
  "amount": "150.00",
  "from": { "account_id": "...", "box_id": null },
  "to":   { "account_id": "...", "box_id": "..." },
  "occurred_at": "2026-07-25T15:30:00-05:00",
  "note": "opcional"
}
```

El servidor **deduce el tipo de movimiento** a partir de origen y destino; el
cliente no lo envía. Esto evita que la interfaz y el asistente puedan crear
un tipo incorrecto.

Errores: los de §13, mapeados según `14_contratos_api_web.md` §4.

## 11. Permisos y RLS

- Todas las rutas usan el **cliente autenticado**, no service-role
  (`15_seguridad_autorizacion_y_rls.md` §2). Este módulo **no pide ninguna
  excepción**.
- RLS por `user_id` en `accounts` y `boxes`.
- Las escrituras que generan movimientos pasan por funciones del Core con
  permisos elevados; el rol `authenticated` no puede escribir
  `current_balance` directamente.
- Una cuenta o caja de otro usuario devuelve **404**, no 403.

## 12. Estados de datos

| Estado | Qué se muestra |
|---|---|
| **Sin cuentas** | "Puedo calcular tu dinero libre cuando tenga al menos un saldo." + acción *Agregar cuenta*. **Nunca "Dinero libre: S/0.00"** |
| **Con cuentas, sin cajas** | Dinero libre = libre en cuentas − compromisos. Sección de cajas con estado vacío informativo, sin presionar |
| **Con cajas, sin compromisos** | Dinero libre y libre en cuentas coinciden. Se muestran iguales, **sin inventar una diferencia** |
| **Cargando** | Esqueleto con la forma del desglose, no un spinner |
| **Recalculando** | Datos anteriores visibles con indicador "Actualizando…" |
| **Error** | "No pude actualizar. Tus datos siguen guardados." + reintentar |
| **Saldo negativo** | Aviso en la cuenta afectada + acción de ajustar. No bloquea nada |
| **Modo discreto** | Todos los montos como `S/•••`, conservando el ancho |

## 13. Errores

| ID | Causa | Mensaje visible | Salida | ¿Recuperable? |
|---|---|---|---|---|
| `ERR-CUENTAS-01` | Nombre duplicado | "Ya tienes una cuenta con ese nombre." | Cambiar el nombre | Sí |
| `ERR-CUENTAS-02` | Cuenta no existe o no es del usuario | "No encontré esa cuenta." | Volver a Mi Dinero | Sí |
| `ERR-CUENTAS-03` | Separar más que el libre disponible | "Solo tienes S/50.00 libres en BCP." | Ajustar el monto | Sí |
| `ERR-CUENTAS-04` | El saldo de cajas superaría el de la cuenta | "Esa cuenta no tiene suficiente para separar tanto." | Ajustar el monto | Sí |
| `ERR-CUENTAS-05` | Devolver más de lo que tiene la caja | "La caja Viaje tiene S/120.00. No puedo devolver más." | Ajustar el monto | Sí |
| `ERR-CUENTAS-06` | Transferir a la misma cuenta | "El origen y el destino son la misma cuenta." | Cambiar destino | Sí |
| `ERR-CUENTAS-07` | Mover entre cajas de cuentas distintas | "Por ahora solo puedo mover entre cajas de la misma cuenta." | Transferir primero | Sí |
| `ERR-CUENTAS-08` | Monto ≤ 0 | "El monto tiene que ser mayor que cero." | Corregir | Sí |
| `ERR-CUENTAS-09` | Nombre de caja duplicado en la cuenta | "Ya tienes una caja con ese nombre en esa cuenta." | Cambiar el nombre | Sí |
| `ERR-CUENTAS-10` | Ajuste sin cambio | "Ese ya es el saldo registrado." | Cerrar | Sí |
| `ERR-CUENTAS-11` | Cuenta archivada en una operación | "Esa cuenta está archivada. ¿Quieres restaurarla?" | Restaurar | Sí |
| `ERR-CUENTAS-12` | Vincular caja a deuda cerrada | "Esa deuda ya está cerrada." | Elegir otra | Sí |

Ninguno expone mensajes de proveedor ni códigos técnicos
(`11_confianza_errores_y_reversibilidad.md` §9).

## 14. Integración con el motor IA

### 14.1 Consultas que expone (solo lectura)

Entidades: `cuentas`, `cajas`.

| Dimensión | Valores |
|---|---|
| `tipo_cuenta` | digital, banco, físico, tarjeta |
| `institucion` | texto |
| `es_default` | sí/no |
| `tiene_cajas` | sí/no |
| `saldo_negativo` | sí/no |
| `tipo_caja` | compromiso, objetivo, emergencia |
| `tiene_meta` | sí/no |
| `progreso_meta` | proporción 0–1 |
| `vinculada_a_deuda` | sí/no |
| `cubierto_por_caja` | sí/no — **dimensión de movimientos que aporta este módulo** |

| Medida | Qué calcula |
|---|---|
| `saldo_total` | Suma de saldos de cuentas activas |
| `separado_total` | Suma de saldos de cajas activas |
| `libre_en_cuentas` | `RUL-CUENTAS-02` |
| `dinero_libre` | `RUL-CUENTAS-03` |
| `libre_por_cuenta` | `RUL-CUENTAS-01`, agrupable |

Toda consulta devuelve las referencias de las cuentas, cajas y movimientos
que componen cada cifra (`22_grounding_evidencia_y_politica.md` §2).

### 14.2 Comandos que acepta (escritura)

| Comando | Confirmación | Idempotente |
|---|---|---|
| `crear_cuenta` | Tarjeta editable | Sí |
| `editar_cuenta` | Tarjeta editable | Sí |
| `archivar_cuenta` | **Riesgo** | Sí |
| `ajustar_saldo` | **Riesgo**, mostrando la diferencia | Sí |
| `crear_caja` | Tarjeta editable | Sí |
| `editar_caja` | Tarjeta editable | Sí |
| `eliminar_caja` | **Riesgo** si tiene saldo, nombrando el destino del dinero | Sí |
| `transferir` | Tarjeta con efecto previo | Sí |
| `separar_en_caja` | Tarjeta con efecto previo | Sí |
| `devolver_a_libre` | Tarjeta con efecto previo | Sí |
| `mover_entre_cajas` | Tarjeta con efecto previo | Sí |
| `vincular_caja` | Tarjeta | Sí |

### 14.3 Qué se puede pedir en lenguaje natural

```text
"¿cuánto tengo libre?"                        → dinero_libre + desglose
"¿por qué me quedan 170?"                     → las cuatro capas con evidencia
"pasa 100 de BCP a Yape"                      → transferir
"separa 200 para emergencia"                  → separar_en_caja
"mi Yape en realidad tiene 350"               → ajustar_saldo (riesgo)
"crea una caja para el viaje con meta 2000"   → crear_caja
"¿cuánto llevo apartado para el alquiler?"    → consulta sobre cajas
"¿en qué cuenta tengo más plata?"             → consulta agrupada
```

### 14.4 Lo que el motor NO puede hacer aquí

- Editar `current_balance` directamente. Solo mediante `ajustar_saldo`.
- Archivar una cuenta sin confirmación de riesgo.
- Crear una cuenta con moneda distinta de `PEN` en V1.

## 15. Memoria y aprendizaje

| Qué aprende | Evidencia | Cómo se corrige |
|---|---|---|
| Cuenta habitual del usuario para gastos | Frecuencia de uso en movimientos confirmados | Cambiando la cuenta por defecto |
| Cómo llama a sus cuentas ("el bécepé", "mi cuenta sueldo") | Correcciones y menciones repetidas | Renombrando la cuenta |
| Qué caja usa para qué tipo de compromiso | Vinculaciones confirmadas | Desvinculando |

Alimenta `36_modulo_memoria_y_aprendizaje.md`. Nada se da por aprendido sin
confirmación (`WEB-D023`).

Este módulo también **aporta al perfil**: la cuenta donde entran ingresos
regulares es la señal principal para deducir cómo le pagan al usuario, que
es un hecho de la capa Vida (`20c` §2.2) y habilita las dimensiones
`es_dia_de_pago` y `dias_desde_el_pago`.

## 16. Eventos y telemetría

Eventos de dominio: `cuenta.creada`, `cuenta.editada`, `cuenta.archivada`,
`cuenta.restaurada`, `cuenta.saldo_ajustado`, `cuenta.default_cambiada`,
`caja.creada`, `caja.editada`, `caja.eliminada`, `caja.vinculada`,
`caja.meta_alcanzada`, `desglose.consultado`.

Todos con `user_id`, `trace_id` y origen. **Ninguno lleva montos**
(`19_observabilidad_y_telemetria_web.md` §4.1).

Métricas de producto: usuarios con al menos una cuenta, usuarios con al menos
una caja, frecuencia de consulta del desglose, frecuencia de ajustes de saldo
(un valor alto indica que la captura está fallando), proporción de cuentas
con saldo negativo.

## 17. Rendimiento

- El volumen es de decenas de filas por usuario: **no requiere paginación**.
- Índices: `accounts (user_id, deleted_at)`, `boxes (user_id, account_id, deleted_at)`.
- El cálculo de las cuatro capas debe resolverse en **una sola consulta**, no
  con N+1 por cuenta.
- El dinero libre se recalcula ante cualquier escritura financiera; su
  invalidación de caché está en `17_patrones_datos_formularios_y_listados.md` §2.3.
- Presupuesto de latencia: `/summary` bajo 300 ms en el percentil 95.

## 18. Accesibilidad específica

- El dinero libre se anuncia con moneda y contexto: "Dinero libre, 170 soles".
- El saldo negativo **no se comunica solo por color**: lleva icono y el signo.
- El progreso de una caja se anuncia con valor y meta: "Emergencia, 100 de
  1.000 soles, 10 por ciento".
- En modo discreto el monto oculto se anuncia como "monto oculto", no como
  puntos.
- El modal de mover dinero es operable solo con teclado, incluidos los
  selectores de origen y destino.

## 19. Casos borde

1. **Usuario sin ninguna cuenta.** No se muestra dinero libre. Los
   movimientos siguen registrándose con cuenta `null`.
2. **Cuenta con saldo inicial negativo.** Permitido; puede ser una tarjeta
   de débito en sobregiro.
3. **Suma de cajas igual al saldo.** Libre en esa cuenta = S/0.00. Es válido
   y se muestra como cero, no como error.
4. **Compromiso mayor que su caja.** Se descuenta solo la diferencia
   (`RUL-CUENTAS-04`).
5. **Archivar la cuenta por defecto.** Se desmarca; si queda una sola cuenta
   activa, esa pasa a ser la de por defecto.
6. **Archivar una cuenta con cajas con saldo.** Las cajas se archivan; el
   dinero permanece contabilizado en el saldo de la cuenta archivada, que
   deja de sumar al total. Se advierte en la confirmación.
7. **Eliminar una caja vinculada a una deuda activa.** Permitido; se
   desvincula y se avisa que ese compromiso pasará a descontar del dinero
   libre.
8. **Ajuste que deja la cuenta en negativo.** Permitido, con aviso.
9. **Dos ajustes simultáneos sobre la misma cuenta.** La idempotencia y la
   transacción del Core garantizan que solo uno se aplique por clave.
10. **Meta alcanzada y luego el saldo baja.** La caja vuelve a estado activo;
    no se "descompleta" con celebración inversa.
11. **Movimiento a una cuenta archivada.** Se permite editar el movimiento
    para reasignarlo; no se crean movimientos nuevos hacia cuentas
    archivadas.
12. **Caja con meta pero sin fecha.** Válido: muestra progreso sin cuenta
    regresiva.

## 20. Criterios de aceptación

- `AC-CUENTAS-01` — El ejemplo de §6 produce exactamente S/800.00 / S/580.00
  / S/220.00 / S/170.00. Evidencia: `TEST`.
- `AC-CUENTAS-02` — Un compromiso cubierto por su caja no se descuenta dos
  veces. Evidencia: `TEST`.
- `AC-CUENTAS-03` — Una cobertura parcial descuenta solo la diferencia.
  Evidencia: `TEST`.
- `AC-CUENTAS-04` — Sin cuentas, no se muestra "Dinero libre: S/0.00".
  Evidencia: `TEST` + `USER`.
- `AC-CUENTAS-05` — El desglose de las cuatro capas está accesible desde
  donde se muestre el dinero libre. Evidencia: `TEST` + `USER`.
- `AC-CUENTAS-06` — `current_balance` nunca se modifica sin un movimiento
  `ajuste` asociado. Evidencia: `TEST`.
- `AC-CUENTAS-07` — Una transferencia no cambia el dinero total.
  Evidencia: `TEST`.
- `AC-CUENTAS-08` — Una asignación interna no cambia el saldo de la cuenta.
  Evidencia: `TEST`.
- `AC-CUENTAS-09` — Eliminar una caja con saldo devuelve el dinero a libre y
  no lo pierde. Evidencia: `TEST`.
- `AC-CUENTAS-10` — Una caja nunca queda con saldo negativo.
  Evidencia: `TEST`.
- `AC-CUENTAS-11` — Un saldo negativo de cuenta no bloquea ningún
  movimiento. Evidencia: `TEST`.
- `AC-CUENTAS-12` — Existe como máximo una cuenta por defecto activa.
  Evidencia: `TEST`.
- `AC-CUENTAS-13` — Ninguna ruta de este módulo usa service-role.
  Evidencia: `TEST`.
- `AC-CUENTAS-14` — Una cuenta de otro usuario devuelve 404.
  Evidencia: `TEST`.
- `AC-CUENTAS-15` — El servidor deduce el tipo de movimiento en
  `/money/actions`; el cliente no puede imponerlo. Evidencia: `TEST`.
- `AC-CUENTAS-16` — Las cuatro capas se calculan en una sola consulta.
  Evidencia: `CODE` + `TEST`.
- `AC-CUENTAS-17` — El saldo negativo se comunica con icono y signo, no solo
  con color. Evidencia: `TEST`.
- `AC-CUENTAS-18` — El asistente puede ejecutar los 12 comandos de §14.2 con
  confirmación. Evidencia: `TEST` + `USER`.

## 21. Fuera de alcance y puente a WhatsApp

Fuera de V1-web: multi-moneda con UI, conexión bancaria, cajas
cross-account, auto-asignación por reglas, historial de saldo en el tiempo.

Puente a la fase WhatsApp: los comandos de §14.2 y las consultas de §14.1 ya
son agnósticos de canal (`21_contrato_de_canal_y_presentadores.md`). WhatsApp
no requerirá nada nuevo de este módulo salvo su presentador. La única
diferencia esperada es que la tarjeta de "mover dinero" se resolverá en
conversación en vez de en un modal.

## 22. Trazabilidad

**Documentos de `docs/` consumidos:**
`docs/fase_2_estrategia/alcance_v1/05e_cuentas_cajas.md` (fórmulas §5, tabla
de afectación §11.1, reglas de transferencia §12, saldo negativo §16, edge
cases §18), `docs/fase_4_tecnica/16_modelo_datos.md` §6,
`docs/fase_6_visual/32_especificacion_hifi.md` (Mi Dinero).

**Contradicciones que cierra:** ninguna directamente; sostiene
`AC-DINERO-01` a `AC-DINERO-06` de `09_modelo_mental_dinero.md`, que son la
base de `C-04` (modo discreto transversal) en lo que respecta a montos.

**Diferencias frente al documento fuente:** se elimina la referencia a
inferencia de cuenta por IA de `05e` §10 como responsabilidad de este módulo;
la inferencia vive ahora en el motor (`20b`) y en la memoria (`36`), y aquí
solo se declara qué señales aporta (§15).
