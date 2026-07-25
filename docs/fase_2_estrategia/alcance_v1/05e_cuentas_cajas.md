# Feature 5: Cuentas y Cajas Inteligentes

**Parte del Paso 5/20 — Alcance V1.0**  
**Prioridad:** P0  
**Última actualización:** 20 de mayo, 2026  
**Estado:** V2 — Especificación avanzada

---

## 1. Tesis

> **Dinero disponible ≠ dinero total.** El verdadero valor es saber cuánto puedes gastar, no cuánto tienes. Una persona con S/800 en total puede tener solo S/220 libres si S/580 están comprometidos.

Cuentas y cajas son la base para que Manzana responda la pregunta más importante de finanzas personales:

> **¿Cuánto puedo gastar realmente?**

Sin cuentas ni cajas, Manzana es una calculadora de gastos. Con ellas, es un espejo financiero inteligente que distingue entre dinero que existe y dinero que se puede usar.

### Sin cuentas/cajas
```
IA: "Tienes S/800."
```
→ El usuario cree que puede gastar S/800. Peligroso.

### Con cuentas/cajas
```
IA: "Tienes S/800 en total, pero libre para gastar
     tienes aproximadamente S/220."
```
→ Claridad real. Esto es Manzana siendo útil de verdad.

### Conexión con personas

- **Diego** (ingresos variables): Quiere saber cuánto le queda "de verdad" después de compromisos.
- **Camila**: Tiene dinero en Yape, efectivo y banco pero parte ya debería estar separada.

---

## 2. Qué NO debe ser

Cuentas y cajas no deben convertirse en:

- **Contabilidad de partida doble.** Manzana no es un sistema contable. Las reglas son simples y humanas.
- **Configuración obligatoria.** No se requiere crear cuentas ni cajas para usar Manzana. Sin ellas, todo es "dinero general".
- **Tracker de saldo bancario exacto.** Manzana trabaja con datos imperfectos. El saldo puede no coincidir con el banco real.
- **Sincronización automática con bancos.** Eso es integración bancaria (open banking), fuera de V1.
- **Sistema que obliga a clasificar todo.** Si un movimiento no tiene cuenta asignada, se registra igual. Los datos imperfectos son válidos.

Principio:

> Las cuentas y cajas deben dar claridad sin exigir perfección. Un usuario que solo registra gastos sin asignar cuenta sigue obteniendo valor de Manzana.

---

## 3. Relación con otros sistemas

| Sistema | Rol en cuentas y cajas |
|---|---|
| Core Financiero | Persiste cuentas, cajas y movimientos. Ejecuta comandos transaccionales. |
| Balance Engine | Calcula saldos por cuenta, saldos por caja y libre en cuentas. Determinístico. |
| Motor IA (`DataAgent`) | Infiere cuenta cuando el usuario no la dice explícitamente. |
| Motor IA (`ConversationAgent`) | Presenta dinero libre operativo en respuestas a consultas de liquidez. |
| Dashboard (`Mi Dinero`) | Visualiza cuentas, cajas, dinero libre y compromisos. Ref: `05c_dashboard.md` §9. |
| Deudas | Vincula cuotas a cajas compromiso via `deuda_vinculada_id`. Ref: `05h_deudas.md`. |
| Recurrentes | Vincula pagos periódicos a cajas compromiso via `recurrente_vinculado_id`. Ref: `05i_recurrentes.md`. |
| Email Parsing | Detecta cuenta por campo `bank_or_app` del email parseado. Ref: `05d_email_parsing.md`. |

---

## 4. Cuenta vs Caja

### 4.1 Cuenta (dónde ESTÁ el dinero)

Representación de un lugar real donde existe el dinero del usuario.

| Ejemplo | Tipo |
|---|---|
| Yape | Digital |
| Plin | Digital |
| BCP | Banco |
| Interbank | Banco |
| Efectivo | Físico |
| PayPal | Digital |
| Tarjeta débito/prepago | Tarjeta |

Una cuenta responde: **¿en qué lugar físico o digital está este dinero?**

### 4.2 Caja (para qué ES el dinero)

Separación mental o propósito del dinero. Cada caja vive dentro de una cuenta específica.

| Tipo de caja | Ejemplo | Propósito |
|---|---|---|
| **Caja compromiso** | "Cuota laptop", "Alquiler" | Dinero reservado para pagos obligatorios |
| **Caja objetivo** | "Viaje a Cusco", "Laptop nueva" | Ahorro con meta |
| **Caja emergencia** | "Emergencia" | Reserva que no se toca |

Una caja responde: **¿para qué está separado este dinero?**

> **Importante:** Caja libre NO es un tipo de caja. Es un cálculo. Ver §5.

### 4.3 Relación cuenta-caja

```
Cuenta real: BCP (S/630)
├── Caja compromiso: Cuota laptop (S/180)
├── Caja compromiso: Alquiler (S/300)
├── Caja emergencia: Emergencia (S/100)
└── [Calculado] Libre: S/50  (630 - 180 - 300 - 100)

Cuenta real: Yape (S/120)
└── [Calculado] Libre: S/120  (120 - 0)

Cuenta real: Efectivo (S/50)
└── [Calculado] Libre: S/50  (50 - 0)

═══════════════════════════════════════════
Total en cuentas:     S/800
Comprometido en cajas: S/580
Libre para gastar:    S/220 👈 ESTO es lo que importa
```

Regla fundamental:

> Las cajas son **per account** (no globales). Una caja vive dentro de una cuenta específica. Pero el Dashboard puede **agregar** cajas del mismo nombre entre cuentas para dar visión global.

### 4.4 Tipos de cuenta

| Tipo | Ejemplos | Notas |
|---|---|---|
| `digital` | Yape, Plin, PayPal | Wallets digitales |
| `banco` | BCP, Interbank, BBVA | Cuentas bancarias |
| `fisico` | Efectivo | Sin tracking externo |
| `tarjeta` | Tarjeta débito/prepago | Solo si representa dinero disponible o una cuenta con saldo propio |

Regla:

> Tarjeta de crédito no es una cuenta de dinero disponible. Se modela como deuda/pasivo en `05h_deudas.md`, o como método de pago vinculado a una deuda, porque gastar con crédito aumenta una obligación y no debe sumar al dinero total.

### 4.5 Tipos de caja

| Tipo | Propósito | Ejemplo | Se descuenta de libre en cuentas |
|---|---|---|---|
| `compromiso` | Pagos obligatorios | Cuota laptop, Alquiler | Sí |
| `objetivo` | Ahorro con meta | Viaje, Laptop nueva | Sí |
| `emergencia` | Reserva intocable | Emergencia | Sí |

Regla:

> Todos los tipos de caja se descuentan del libre en cuentas. Caja libre **no es un tipo**. Es el resultado del cálculo: `saldo_cuenta - suma_cajas_en_cuenta`.

---

## 5. Dinero libre

### 5.1 Fórmula

En Manzana hay dos niveles de "libre":

1. **Libre en cuentas:** dinero no separado en cajas dentro de cuentas reales.
2. **Dinero libre operativo:** dinero que el usuario puede gastar con más seguridad después de considerar compromisos próximos no cubiertos por cajas.

```
libre_en_cuenta = saldo_cuenta - Σ cajas_en_cuenta

libre_en_cuentas_global = Σ libre_en_cuenta
                        = Σ saldo_cuenta - Σ todas_las_cajas

dinero_libre_operativo = libre_en_cuentas_global
                       - compromisos_proximos_no_cubiertos_por_cajas
```

`Balance Engine` calcula saldos, cajas y libre en cuentas. `Debt Engine` y `Recurring Engine` aportan compromisos próximos. La respuesta final a preguntas como "¿puedo gastar S/50 hoy?" usa el dinero libre operativo.

Si una deuda o recurrente ya tiene caja compromiso con saldo suficiente, no se descuenta dos veces.

### 5.2 Caja libre es un cálculo

> Caja libre no es una entidad en base de datos. Es el resultado de restar las cajas del saldo de la cuenta. Esto evita inconsistencias: si el saldo cambia, el libre en cuentas se ajusta automáticamente sin necesidad de actualizar una entidad adicional.

```
BCP: S/630
├── Caja compromiso: Cuota laptop (S/180)
├── Caja compromiso: Alquiler (S/300)
├── Caja emergencia: Emergencia (S/100)
└── [Calculado] Libre: S/50  (630 - 180 - 300 - 100)
```

Si entra un ingreso de S/200 a BCP:

```
BCP: S/830  (630 + 200)
├── Caja compromiso: Cuota laptop (S/180)  — no cambia
├── Caja compromiso: Alquiler (S/300)      — no cambia
├── Caja emergencia: Emergencia (S/100)    — no cambia
└── [Calculado] Libre: S/250  (830 - 580)  — se ajusta solo
```

### 5.3 Ejemplo completo con agregación

```
Dashboard Mi Dinero:

  Total en cuentas:    S/800
  Comprometido:        S/580
  Libre en cuentas:    S/220
  Libre operativo:     S/170  (si hay S/50 próximos no cubiertos)

  ─── Cuentas ───
  BCP           S/630
  Yape          S/120
  Efectivo       S/50

  ─── Cajas (agregadas) ───
  Emergencia: S/500 total
    - BCP: S/400
    - Efectivo: S/100
  Cuota laptop: S/180
    - BCP: S/180
  Alquiler: S/300 (pendiente de separar)
    - Solo existe en libre de BCP
```

La agregación cross-account es solo visual. Cada caja sigue perteneciendo a una cuenta específica.

Si no hay compromisos próximos sin caja vinculada, libre operativo y libre en cuentas pueden ser el mismo número. Si sí existen deudas, cuotas o recurrentes no cubiertos por cajas, el Dashboard debe distinguirlos.

### 5.4 Display en Dashboard

El Dashboard (`Mi Dinero`, ref: `05c_dashboard.md` §9) muestra dinero libre como el dato principal:

```
┌─────────────────────────────────────┐
│  💰 Libre para gastar               │
│  S/170                              │
│                                     │
│  Total: S/800  ·  Separado: S/580  │
│  Libre en cuentas: S/220           │
│  Próx. sin cubrir: S/50            │
│                                     │
│  ─── Cuentas ───                    │
│  BCP         S/630  [3 cajas]       │
│  Yape        S/120  [sin cajas]     │
│  Efectivo     S/50  [sin cajas]     │
│                                     │
│  [+ Agregar cuenta]                 │
│                                     │
│  ─── Cajas ───                      │
│  🏠 Alquiler       S/300 / -       │
│  💻 Cuota laptop   S/180 / S/2,400 │
│  🚨 Emergencia     S/500 / S/1,000 │
│                                     │
│  [+ Crear caja]                     │
└─────────────────────────────────────┘
```

---

## 6. Modelo de datos

### 6.1 Cuenta

```typescript
interface Account {
  id: string;
  user_id: string;
  nombre: string;
  tipo: 'digital' | 'banco' | 'fisico' | 'tarjeta';
  saldo_actual: number;       // snapshot, recalculado por Balance Engine
  moneda: 'PEN' | 'USD';
  institucion: string | null; // "Yape", "BCP", "Interbank", etc.
  color: string | null;
  icono: string | null;
  es_default: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;  // soft delete
}
```

Notas:

- `saldo_actual` es un snapshot que el Balance Engine recalcula. No se edita manualmente.
- `institucion` se usa para match con `bank_or_app` de email parsing.
- `es_default` indica la cuenta preferida para inferencia cuando no hay señal.
- Solo una cuenta puede ser `es_default = true` por usuario.
- `tipo = 'tarjeta'` solo aplica a tarjeta débito/prepago o instrumentos con saldo propio. Tarjeta de crédito vive en Deudas.

### 6.2 Caja

```typescript
interface Box {
  id: string;
  user_id: string;
  cuenta_id: string;                    // BELONGS TO a specific account
  nombre: string;
  tipo: 'compromiso' | 'objetivo' | 'emergencia';
  saldo_actual: number;                 // snapshot, recalculado
  moneda: 'PEN' | 'USD';
  meta: number | null;                  // goal amount, para tipo objetivo
  fecha_objetivo: string | null;        // deadline para objetivo
  deuda_vinculada_id: string | null;    // link to debt if compromiso
  recurrente_vinculado_id: string | null; // link to recurring
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
```

Notas:

- `cuenta_id` es obligatorio. Una caja siempre pertenece a una cuenta.
- `meta` solo aplica para tipo `objetivo`. Para `compromiso` y `emergencia` es opcional.
- `deuda_vinculada_id` y `recurrente_vinculado_id` permiten conectar con features de `05h_deudas.md` y `05i_recurrentes.md`.

### 6.3 Movimiento (campos relevantes a cuentas y cajas)

```typescript
interface Movement {
  // ... campos base (id, user_id, tipo, monto, descripcion, etc.)
  
  cuenta_origen_id: string | null;   // null = Sin cuenta asignada
  cuenta_destino_id: string | null;  // para transferencias
  caja_origen_id: string | null;     // para asignaciones internas (de dónde sale)
  caja_destino_id: string | null;    // para asignaciones internas (a dónde va)
  afecta_saldo_total: boolean;       // transferencias y asignaciones = false
}
```

> **Decisión de diseño: campos DUALES para cajas.** El movimiento tiene `caja_origen_id` + `caja_destino_id` (no un solo `box_id`). Esto permite que una asignación interna use ambos campos en un solo movimiento: origen es libre (calculado, representado como `null`) y destino es la caja específica.

Convenciones para `caja_origen_id` y `caja_destino_id`:

| Valor | Significado |
|---|---|
| `null` | Dinero libre (calculado, no es una entidad) |
| UUID de caja | Caja específica |

### 6.4 Relación cuenta-caja-movimiento

```
┌─────────────────────────────────────────────────┐
│                    USUARIO                       │
└──────────┬──────────────────────┬────────────────┘
           │                      │
    ┌──────▼──────┐        ┌──────▼──────┐
    │  Cuenta A   │        │  Cuenta B   │
    │  (BCP)      │        │  (Yape)     │
    └──┬──────┬───┘        └──────┬──────┘
       │      │                    │
  ┌────▼──┐ ┌─▼────┐         [sin cajas]
  │Caja 1 │ │Caja 2│         libre = todo
  │(Cuota)│ │(Emrg)│
  └───────┘ └──────┘
       │
       │  ← Movimiento:
       │     cuenta_origen_id = BCP
       │     caja_origen_id = Caja 1 (Cuota)
       │     tipo = pago_deuda
```

---

## 7. Balance Engine

### 7.1 Responsabilidad

El Balance Engine es un motor determinístico (no IA) que calcula:

- Saldo por cuenta (`Account.saldo_actual`).
- Saldo por caja (`Box.saldo_actual`).
- Libre en cuenta (calculado: `saldo_cuenta - Σ cajas_en_cuenta`).
- Libre en cuentas global (calculado: `Σ libre_en_cuenta`).
- Dinero libre operativo cuando se combinan saldos/cajas con compromisos no cubiertos por cajas.

Ref: `05b_motor_ia.md` §6.2 — Balance Engine, Accounts/Boxes Engine.  
Ref: `06_arquitectura_sistema.md` Capa 1 — Core Financiero, Balance Engine.

### 7.2 Cálculo de saldos

Enfoque híbrido:

- `saldo_actual` es un **snapshot almacenado** en la tabla de cuentas y cajas.
- El Balance Engine **recalcula** este snapshot en cada evento que afecta saldos.
- Si se necesita verificación, el Balance Engine puede hacer un **recálculo completo** desde el historial de movimientos (event-sourced rebuild).

```
saldo_cuenta = saldo_inicial + Σ ingresos - Σ gastos ± Σ transferencias ± Σ ajustes

saldo_caja = Σ asignaciones_entrantes - Σ asignaciones_salientes - Σ pagos_desde_caja
```

### 7.3 Recálculo por evento

| Evento | Qué recalcula el Balance Engine |
|---|---|
| `movimiento_creado` | Saldo de cuenta(s) afectada(s) + saldo de caja(s) afectada(s) |
| `movimiento_corregido` | Reversa efecto anterior + aplica nuevo efecto |
| `movimiento_eliminado` | Reversa efecto del movimiento eliminado |
| `caja_creada` | No cambia saldos (caja nace con saldo 0) |
| `caja_eliminada` | Requiere asignación interna previa si tiene saldo; luego recalcula libre |

### 7.4 Consistencia

> El Balance Engine corre **dentro de la misma transacción** que la escritura del movimiento. Si el Balance Engine falla, el movimiento también falla. No hay estado intermedio inconsistente.

Flujo transaccional:

```text
BEGIN TRANSACTION
  → Core crea/edita/elimina movimiento
  → Balance Engine recalcula saldos afectados
  → Audit log se escribe
  → Evento se escribe en transactional_outbox
COMMIT
```

Ref: `05b_motor_ia.md` §6.3.1 — Transactional Outbox.

---

## 8. CRUD de Cuentas

### 8.1 Crear cuenta

Desde Dashboard:

```
Mi Dinero → Cuentas → [+ Agregar cuenta]
  → Nombre: "Yape"
  → Tipo: digital
  → Saldo inicial: S/120 (opcional)
  → [Crear]
```

Desde WhatsApp:

```
User: "crea cuenta Yape"
IA:   "Listo ✅ Cuenta Yape creada.
       ¿Cuánto tienes ahí ahora? (puedes decirme después)"

User: "tengo S/200 en efectivo"
IA:   "Listo ✅ Cuenta Efectivo creada con S/200."

User: "agrega mi cuenta BCP"
IA:   "Listo ✅ Cuenta BCP creada.
       ¿Cuánto tienes ahí aproximadamente?"
```

Auto-sugerencia (cuando un movimiento menciona cuenta desconocida):

```
User: "pagué con Plin"
IA:   "No tengo una cuenta Plin. ¿La creo?"
User: "sí"
IA:   "Listo ✅ Cuenta Plin creada · Gasto registrado."
```

Intenciones del Motor IA: `create_account`, `update_account`, `create_box` y `assign_to_box` (ref: `05b_motor_ia.md` §8.2).  
Estado conversacional: `creating_account` o `creating_pocket` según corresponda (ref: `05b_motor_ia.md` §3.5).

Regla:

> **No forzar cuentas en onboarding.** Las cuentas crecen con el uso, no se obligan al setup. Si el usuario nunca menciona una cuenta, sus movimientos se registran con cuenta de origen/destino `null` según el tipo.

### 8.2 Editar cuenta

Campos editables:

- `nombre` — cambiar nombre de la cuenta.
- `tipo` — cambiar tipo (digital, banco, etc.).
- `color` — personalización visual.
- `icono` — personalización visual.
- `es_default` — marcar/desmarcar como cuenta por defecto.
- `institucion` — cambiar institución vinculada.

Campos NO editables manualmente:

- `saldo_actual` — calculado por Balance Engine. Para corregir saldo, se crea un movimiento tipo `ajuste`.

### 8.3 Eliminar cuenta

- **Soft delete siempre.** La cuenta se marca con `deleted_at` pero no se borra.
- Movimientos históricos conservan la referencia a la cuenta eliminada.
- Si la cuenta tiene cajas activas: el usuario debe transferir o eliminar las cajas primero.
- Requiere confirmación explícita → `PolicyGate` / `awaiting_risk_confirmation`.

```
Dashboard: "Vas a eliminar tu cuenta Yape. Los movimientos
            se conservan pero la cuenta ya no aparece.
            [Confirmar] [Cancelar]"

WhatsApp:   "Vas a eliminar tu cuenta Yape. Los movimientos
             se conservan pero la cuenta ya no aparece.
             ¿Confirmas? Responde 'sí, eliminar'."
```

Ref: `06_arquitectura_sistema.md` — Acciones de alto riesgo.

### 8.4 Saldo inicial

- Opcional al crear la cuenta.
- Si no se define, la cuenta nace con `saldo_actual = 0` y se construye desde movimientos.
- Si se define, se crea un movimiento tipo `ajuste` con la descripción "Saldo inicial".
- El saldo inicial puede ajustarse después con otro movimiento `ajuste`.

```
User: "mi Yape tiene 350"
IA:   "Ajusté el saldo de Yape a S/350. 
       Antes tenía S/120. La diferencia se registra como ajuste."
```

### 8.5 Creación progresiva

La creación de cuentas sigue la filosofía de experiencia progresiva:

- **La primera cuenta puede venir del onboarding O del primer movimiento.**
- No se requiere setup previo.
- Si el usuario dice "gasté 15 con Yape" y no tiene cuenta Yape, el sistema sugiere crearla.
- Si el usuario confirma: se crea la cuenta y se asigna el movimiento.
- Si el usuario no responde o dice no: el movimiento se registra con cuenta de origen/destino `null` según el tipo.

```text
Día 1: Sin cuentas. "gasté 15" → registra sin cuenta.
Día 3: "gasté 20 con Yape" → "¿Creo una cuenta Yape?" → sí → cuenta creada.
Día 5: "pasé 100 de BCP a Yape" → "¿Creo una cuenta BCP?" → sí → cuenta creada.
Día 10: Dashboard → "Agregar cuenta" → Efectivo → S/50 inicial.
```

---

## 9. CRUD de Cajas

### 9.1 Crear caja

Desde Dashboard:

```
Mi Dinero → Cajas → [+ Crear caja]
  → Nombre: "Emergencia"
  → Tipo: emergencia
  → Cuenta: BCP
  → Meta: S/1,000 (opcional)
  → [Crear]
```

Desde WhatsApp:

```
User: "separa 200 para emergencia"
IA:   "¿En qué cuenta? Tienes BCP (S/630) y Yape (S/120)."
User: "en BCP"
IA:   "Listo ✅ Caja Emergencia creada en BCP con S/200 🚨"

User: "quiero ahorrar para un viaje"
IA:   "¿Cuánto quieres juntar para el viaje?"
User: "1500"
IA:   "Listo ✅ Caja Viaje creada · Meta: S/1,500
       ¿Cuánto quieres apartar ahora?"
```

Reglas:

- Una caja **siempre** está vinculada a una `cuenta_id` específica.
- Si el usuario no dice en qué cuenta: usar cuenta por defecto (`es_default = true`) o preguntar.
- Si el usuario solo tiene 1 cuenta activa: asignar a esa cuenta sin preguntar.

### 9.2 Editar caja

Campos editables:

- `nombre` — cambiar nombre.
- `tipo` — cambiar tipo (compromiso, objetivo, emergencia).
- `meta` — cambiar meta para tipo objetivo.
- `fecha_objetivo` — cambiar fecha límite.
- `deuda_vinculada_id` — vincular/desvincular deuda.
- `recurrente_vinculado_id` — vincular/desvincular recurrente.

Campo NO editable manualmente:

- `saldo_actual` — calculado por Balance Engine. Para mover dinero, se usa asignación interna.

### 9.3 Eliminar caja

- Si la caja tiene `saldo_actual > 0`: el dinero vuelve a libre (calculado) de la cuenta.
- Para auditoría, antes del soft delete el Core debe crear una `asignacion_interna` desde `caja_origen_id = caja.id` hacia `caja_destino_id = null` por el saldo restante. Luego se elimina la caja.

```
Dashboard: "Esta caja tiene S/180. Al eliminarla, 
            ese dinero vuelve a estar disponible en BCP.
            [Eliminar] [Cancelar]"

WhatsApp:   "Tu caja Cuota laptop tiene S/180. 
             ¿La elimino? El dinero vuelve a libre en BCP."
```

- Soft delete. Movimientos históricos conservan referencia.
- Si la caja está vinculada a una deuda o recurrente: desvincular primero.
- El audit log debe mostrar tanto la asignación interna como el soft delete de la caja.

### 9.4 Meta y progreso

- Solo para tipo `objetivo` (aunque `meta` es opcional en todos los tipos).
- Progreso = `saldo_actual / meta * 100`.
- Dashboard muestra barra de progreso visual.

```
┌─────────────────────────────┐
│ ✈️ Viaje a Cusco             │
│ S/450 / S/1,500             │
│ ████████░░░░░░░░░░░░░ 30%   │
│ Fecha objetivo: julio 2026  │
└─────────────────────────────┘
```

### 9.5 Caja completada

Cuando `saldo_actual >= meta`:

- El estado cambia visualmente a "completada".
- Notificación al usuario:

```
WhatsApp: "¡Tu caja Viaje alcanzó su meta de S/1,500! 🎉
           ¿Quieres usar ese dinero o seguir ahorrando?"
```

- La caja **permanece activa** hasta que el usuario decida qué hacer.
- No se auto-cierra ni se vacía automáticamente.

---

## 10. Inferencia de cuenta por IA

### 10.1 Cascada de inferencia

Cuando el usuario registra un movimiento sin especificar cuenta, el Motor IA (`DataAgent`) sigue esta cascada en orden:

```
1. Explícita en mensaje    → "gasté 15 con Yape"          → Yape
2. Detectada por fuente    → email de BCP                  → cuenta BCP
3. Patrón aprendido fuerte → "taxi" casi siempre Yape      → usar con evidencia
4. Cuenta por defecto      → si hay es_default = true      → usar esa
5. Cuenta única activa     → si solo tiene 1 cuenta        → usar esa
6. Sin información         → cuenta = null                 → "Sin cuenta"
```

Regla:

> La IA **nunca inventa** una cuenta. Si no hay señal suficiente, el movimiento se registra sin cuenta. Es mejor un dato incompleto que un dato incorrecto.

El patrón aprendido solo gana cuando tiene confianza alta y evidencia por usuario. Si entra en conflicto con una cuenta explícita o detectada por email, gana la cuenta explícita/detectada.

### 10.2 Señales de cuenta

| Señal | Ejemplo | Cuenta inferida | Confianza |
|---|---|---|---|
| Keyword explícito | "yapeé", "con Yape" | Yape | Alta |
| Jerga con cuenta implícita | "saqué del cajero" | banco → efectivo (transfer) | Alta |
| Email source | `bank_or_app: "bcp"` | BCP | Alta |
| Patrón aprendido | "taxi" siempre con Yape (historial) | Yape | Media |
| Patrón de monto | gastos < S/20 suelen ser efectivo | efectivo | Baja |

Ref: `05b_motor_ia.md` §9.3 — Jerga peruana inicial (tabla de expresiones como "yapeé", "saqué del cajero", "recargué Yape").

### 10.3 Cuenta null (Sin cuenta)

Cuando un movimiento queda sin cuenta de origen o destino:

- **Se registra normalmente.** No se bloquea.
- **No afecta** saldo de ninguna cuenta específica.
- **Sí afecta** analítica global de gastos/ingresos, categorías e insights.
- **No afecta** dinero total financiero ni libre en cuentas, porque esos saldos se calculan desde cuentas reales.
- Dashboard lo muestra como **"Sin cuenta asignada"** con opción de asignar.
- La IA puede sugerir asignación posterior:

```
IA: "Tienes 5 movimientos sin cuenta asignada. 
     ¿Quieres que los revisemos? Puedo sugerir 
     cuenta para algunos."
```

Regla:

> Cuenta `null` significa "registro válido pero saldo incompleto". Sirve para historial e insights, pero no para afirmar saldos por cuenta. Cuando el usuario asigna cuenta después, el Balance Engine recalcula.

### 10.4 Cuándo preguntar

> Solo preguntar al usuario si la ambigüedad afecta saldos importantes.

| Caso | ¿Preguntar? | Razón |
|---|---|---|
| S/500 transferencia sin origen | **Sí** | Afecta saldos significativamente |
| S/8 café sin saber si Yape o efectivo | **No** | Monto bajo, registrar con null o best guess |
| S/200 ingreso sin saber a qué cuenta | **Sí** | Afecta libre en cuentas y dinero libre operativo |
| S/15 taxi que siempre es Yape | **No** | Patrón conocido, usar inferencia |
| S/50 gasto mencionando Plin, cuenta no existe | **Sí** | Oportunidad de crear cuenta |

### 10.5 Aprendizaje

- Si el usuario corrige la cuenta de un movimiento, el Learning Engine registra el patrón.
- Futuras inferencias similares usan este patrón con mayor confianza.
- El aprendizaje es por usuario: "taxi → Yape" para Camila no implica "taxi → Yape" para Diego.

Ref: `05b_motor_ia.md` §6.2 — Learning Engine.

---

## 11. Afectación de movimientos

### 11.1 Tabla de los 11 tipos canónicos

| Tipo | cuenta_origen | cuenta_destino | caja_origen | caja_destino | afecta_saldo_total | Ejemplo |
|---|---|---|---|---|---|---|
| `gasto` | ✅ decrementa | — | ✅ libre o específica | — | Sí (decrementa) | café S/8 |
| `ingreso` | — | ✅ incrementa | — | ✅ libre (default) | Sí (incrementa) | sueldo S/2,000 |
| `transferencia` | ✅ decrementa | ✅ incrementa | — | — | No | BCP→Yape S/100 |
| `asignacion_interna` | — | — | ✅ libre (decrementa) | ✅ específica (incrementa) | No | separar S/200 emergencia |
| `deuda_adquirida` | — | — | — | — | No (crea obligación) | debo 50 a Luis |
| `pago_deuda` | ✅ decrementa | — | ✅ caja si existe | — | Sí (decrementa) | pagué cuota laptop |
| `prestamo_dado` | ✅ decrementa | — | — | — | Sí (decrementa) | presté 200 a hermano |
| `prestamo_recibido` | — | ✅ incrementa | — | — | Sí (incrementa) | mamá me prestó 500 |
| `devolucion_recibida` | — | ✅ incrementa | — | — | Sí (incrementa) | me devolvieron 30 |
| `pago_recurrente` | ✅ decrementa | — | ✅ caja si vinculada | — | Sí (decrementa) | pagué internet |
| `ajuste` | varía | varía | varía | varía | varía | corrección manual |

### 11.2 Gasto

```
User: "gasté 15 en taxi con Yape"
Sistema:
  tipo: gasto
  monto: S/15
  cuenta_origen_id: acc_yape
  caja_origen_id: null (libre)
  afecta_saldo_total: true
  
  Yape: S/120 → S/105
  Libre Yape: S/120 → S/105
```

Si el usuario tiene una caja y el gasto corresponde a ella:

```
User: "pagué la luz" (vinculada a caja "Servicios")
Sistema:
  tipo: pago_recurrente
  caja_origen_id: box_servicios
  
  Caja Servicios: S/89 → S/0
```

### 11.3 Ingreso

```
User: "me pagaron 2000"
Sistema:
  tipo: ingreso
  monto: S/2,000
  cuenta_destino_id: acc_bcp (inferida o default)
  caja_destino_id: null (va a libre)
  afecta_saldo_total: true
  
  BCP: S/630 → S/2,630
  Libre BCP: S/50 → S/2,050
```

Un ingreso siempre va a libre (calculado) a menos que el usuario asigne a caja explícitamente en un segundo paso.

### 11.4 Transferencia

```
User: "pasé 100 de BCP a Yape"
Sistema:
  tipo: transferencia
  monto: S/100
  cuenta_origen_id: acc_bcp
  cuenta_destino_id: acc_yape
  caja_origen_id: null
  caja_destino_id: null
  afecta_saldo_total: false  ← no es gasto
  
  BCP: S/630 → S/530
  Yape: S/120 → S/220
  Total: sigue siendo S/800
```

> Una transferencia entre cuentas propias **no es gasto**. El saldo total no cambia. Ref: `06_arquitectura_sistema.md` — Reglas de negocio.

### 11.5 Asignación interna

```
User: "separa 180 para mi cuota de laptop"
Sistema:
  tipo: asignacion_interna
  monto: S/180
  cuenta_origen_id: null (no cambia saldo de cuenta)
  cuenta_destino_id: null (no cambia saldo de cuenta)
  caja_origen_id: null (libre → calculado)
  caja_destino_id: box_cuota_laptop
  afecta_saldo_total: false  ← no es gasto
  
  BCP saldo: S/630 (no cambia)
  Caja Cuota laptop: S/0 → S/180
  Libre BCP: S/630 → S/450 (calculado: 630 - 180)
```

> La asignación interna usa ambos campos `caja_origen_id` (null = libre) y `caja_destino_id` (caja específica) en un solo movimiento. No cambia el saldo de la cuenta ni el patrimonio total.

Reverse (devolver de caja a libre):

```
User: "devuelve S/50 de emergencia a libre"
Sistema:
  tipo: asignacion_interna
  caja_origen_id: box_emergencia (decrementa)
  caja_destino_id: null (libre)
  
  Caja Emergencia: S/100 → S/50
  Libre: aumenta S/50 (calculado)
```

### 11.6 Pago de deuda desde caja

```
User: "pagué la cuota de la laptop"
Sistema:
  tipo: pago_deuda
  monto: S/180
  cuenta_origen_id: acc_bcp
  caja_origen_id: box_cuota_laptop (si existe y tiene saldo)
  afecta_saldo_total: true
  
  BCP: S/630 → S/450
  Caja Cuota laptop: S/180 → S/0
  Deuda laptop: S/2,400 → S/2,220
```

Si la caja no tiene suficiente saldo:

```
Caja tiene S/150, pago es S/180
→ Caja: S/150 → S/0 (se vacía)
→ Los S/30 restantes salen de libre
→ Warning: "Tu caja Cuota laptop no cubría todo. 
           Faltaron S/30 que salieron de libre."
```

### 11.7 Pago recurrente

```
User: "pagué internet"
Sistema:
  tipo: pago_recurrente
  monto: S/89
  cuenta_origen_id: acc_bcp
  caja_origen_id: box_servicios (si vinculada)
  afecta_saldo_total: true
  
  Si caja vinculada: caja_servicios se decrementa
  Si no hay caja: sale de libre
  Recurrente: se marca como pagado este periodo
```

### 11.8 Otros tipos

**Deuda adquirida:**
- No afecta cuentas ni cajas. Solo crea la obligación en el sistema de deudas.
- `cuenta_origen_id = null`, `caja_origen_id = null`.

**Préstamo dado:**
- El dinero sale de la cuenta del usuario.
- No tiene caja destino (el dinero se fue).
- Crea un "me deben" en el sistema de deudas.

**Préstamo recibido:**
- El dinero entra a la cuenta del usuario.
- Crea un "debo" en el sistema de deudas.

**Devolución recibida:**
- El dinero entra a la cuenta del usuario.
- Reduce deuda a favor si existe.

**Ajuste:**
- Movimiento especial para reconciliación manual.
- Puede incrementar o decrementar cualquier cuenta.
- `afecta_saldo_total` depende del caso.

---

## 12. Transferencias y asignaciones

### 12.1 Reglas de transferencia

| Operación | ¿Permitida? | Tipo de movimiento |
|---|---|---|
| Cuenta → Cuenta (propias) | ✅ Sí | `transferencia` |
| Cuenta → Tercero | ✅ Sí, pero **es gasto** | `gasto` o `prestamo_dado` |
| Caja → Caja (misma cuenta) | ✅ Sí | `asignacion_interna` |
| Caja → Caja (cross-account) | ❌ No en V1 | Demasiado complejo |

### 12.2 Reglas de asignación interna

- Usa `caja_origen_id` y `caja_destino_id` en un solo movimiento.
- **No cambia** el saldo de la cuenta.
- Solo cambia saldos de cajas dentro de la **misma cuenta**.
- Representación:

| Dirección | caja_origen_id | caja_destino_id | Efecto |
|---|---|---|---|
| Libre → Caja | `null` (libre) | UUID de caja | Caja sube, libre baja |
| Caja → Libre | UUID de caja | `null` (libre) | Caja baja, libre sube |
| Caja → Caja | UUID de caja A | UUID de caja B | A baja, B sube |

### 12.3 Qué está permitido y qué no

| Acción | Estado V1 | Razón |
|---|---|---|
| Transferir entre cuentas propias | ✅ Permitido | Caso común, no es gasto |
| Asignar de libre a caja | ✅ Permitido | Core del producto |
| Devolver de caja a libre | ✅ Permitido | Flexibilidad |
| Mover entre cajas (misma cuenta) | ✅ Permitido | Reorganización simple |
| Mover caja de una cuenta a otra | ❌ No en V1 | Complejidad excesiva |
| Pagar a tercero desde caja | ✅ Permitido | Caja se reduce + gasto |
| Auto-asignar ingresos a cajas | ❌ No en V1 | Requiere reglas automáticas |

---

## 13. Relación con Deudas

Ref: `05h_deudas.md`.

- Una caja tipo `compromiso` puede vincularse a una deuda via `deuda_vinculada_id`.
- Cuando el usuario crea una deuda con cuotas, el sistema **puede sugerir** crear una caja compromiso:

```
IA: "Tienes una cuota de S/400 para la laptop cada mes.
     ¿Quieres crear una caja para separar ese dinero?"
```

- **La caja NO se auto-crea.** El sistema sugiere, el usuario confirma.
- Pagar una deuda desde una caja compromiso reduce ambos: la deuda y la caja.
- Una deuda **puede existir sin caja vinculada.** La caja es una herramienta de organización, no un requisito.

```
Deuda: Laptop S/2,400 (6 cuotas de S/400)
  └── Caja vinculada: Cuota laptop (S/400 separados en BCP)
      └── Al pagar: caja S/400 → S/0, deuda S/2,400 → S/2,000
```

---

## 14. Relación con Recurrentes

Ref: `05i_recurrentes.md`.

- Una caja tipo `compromiso` puede vincularse a un recurrente via `recurrente_vinculado_id`.
- Cuando un recurrente es detectado/confirmado, el sistema **puede sugerir** vincular a una caja:

```
IA: "Pagas internet ~S/89 cada mes. ¿Quieres crear una 
     caja para separar ese dinero o recordarte apartarlo?"
```

- Pagar un recurrente vinculado a caja reduce el saldo de la caja.
- **Múltiples recurrentes pueden compartir una caja.** Ejemplo: una caja "Servicios" para internet + Netflix + Spotify.

```
Caja compromiso: Servicios (S/150 en BCP)
  ├── Vinculado: Internet (~S/89/mes)
  ├── Vinculado: Netflix (S/25/mes)
  └── Vinculado: Spotify (S/22/mes)
```

- Si un recurrente se pausa o desactiva, la caja permanece. El usuario decide qué hacer con el dinero.
- El vínculo no obliga: un recurrente puede existir sin caja, y una caja puede existir sin recurrente.

---

## 15. Relación con Email Parsing

Ref: `05d_email_parsing.md`.

- Los emails parseados incluyen el campo `bank_or_app` (ej: "yape", "bcp", "interbank").
- El sistema hace match entre `bank_or_app` del email y `institucion` de cuentas existentes.
- Si hay match → se usa esa cuenta para el movimiento pendiente.
- Si no hay match → el pendiente aparece sin cuenta. El usuario puede asignar cuenta al confirmar.
- Si el usuario confirma y asigna una cuenta que no existe → sugerir creación:

```
IA: "Este email es de Plin, pero no tienes cuenta Plin. 
     ¿La creo y asigno este movimiento?"
```

Flujo de match:

```text
Email parseado con bank_or_app = "bcp"
  → Buscar Account donde institucion LIKE "bcp"
  → Si encontrada: cuenta_origen_id = account.id
  → Si no encontrada: cuenta_origen_id = null, usuario asigna
```

---

## 16. Saldo negativo y reconciliación

### 16.1 Saldo negativo permitido

> Manzana trabaja con datos imperfectos. Un saldo negativo **se permite** pero se muestra como estado de advertencia.

Un saldo negativo puede ocurrir por:

- Ingreso no registrado (falta un depósito o pago recibido).
- Saldo inicial incorrecto (el usuario puso S/100 pero tenía S/200).
- Movimiento eliminado que ya había afectado saldo.
- Gasto registrado antes que el ingreso que lo cubría.

Visual:

```
Dashboard:
  ⚠️ Yape: -S/30
  
WhatsApp (si pregunta):
  "Tu cuenta Yape muestra saldo negativo (-S/30). 
   Esto puede pasar si falta un ingreso o si el 
   saldo inicial no era exacto. ¿Quieres ajustarlo?"
```

Reglas:

- **Nunca bloquear** un movimiento por saldo negativo.
- Mostrar indicador visual (color rojo, ícono de advertencia).
- La IA puede sugerir reconciliación, pero no obligar.

### 16.2 Reconciliación manual

El usuario puede ajustar el saldo de cualquier cuenta para alinearlo con la realidad:

```
User: "mi Yape en realidad tiene 350"
IA:   "Ajusté Yape a S/350. Antes marcaba S/120.
       La diferencia de S/230 se registra como ajuste."
```

Desde Dashboard:

```
Cuenta Yape → ⚙️ → "Ajustar saldo"
  → Saldo actual: S/120
  → Saldo real: [350]
  → Motivo: "Faltaba registrar ingreso"
  → [Ajustar]
```

### 16.3 Ajuste como tipo de movimiento

- Cada reconciliación crea un movimiento tipo `ajuste`.
- El ajuste tiene `description = "Ajuste manual"` y opcionalmente un motivo del usuario.
- El ajuste aparece en el historial de movimientos con fuente "Dashboard/manual".
- El Balance Engine recalcula saldos normalmente.
- El audit log registra el cambio completo.

---

## 17. Integración progresiva

Cuentas y cajas siguen la filosofía de experiencia progresiva de Manzana. Cada fase es válida. No se fuerza la siguiente.

### Fase 1: Día 1-7 — Sin estructura

```
0-1 cuentas, sin cajas.
Todo es "dinero general".
Movimientos se registran con o sin cuenta.
Dashboard muestra total simple.

User: "gasté 15 en taxi"
IA:   "Listo ✅ Taxi S/15"
→ Sin cuenta, sin caja, funciona perfecto.
```

### Fase 2: Semana 2-3 — Cuentas emergentes

```
El usuario menciona cuentas en mensajes.
La IA sugiere crearlas.
Movimientos empiezan a tener cuenta asignada.

User: "pagué con Yape"
IA:   "No tengo una cuenta Yape. ¿La creo?"
User: "sí"
IA:   "Listo ✅ Cuenta Yape creada."
```

### Fase 3: Mes 1+ — Primera caja

```
El usuario quiere separar dinero.
Se crea la primera caja.
Dinero libre aparece en Dashboard.
→ Valor real desbloqueado.

User: "quiero ahorrar para emergencia"
IA:   "¿Quieres crear una caja de emergencia?
       Puedes ir guardando de a pocos."
User: "sí"
IA:   "Listo ✅ Caja Emergencia creada 🚨
       ¿Cuánto quieres apartar ahora?"
```

### Fase 4: Mes 2+ — Panorama completo

```
Múltiples cuentas y cajas.
Cajas vinculadas a deudas y recurrentes.
Dinero libre muestra el panorama real.
La IA usa dinero libre en respuestas.

User: "¿puedo gastar 50 hoy?"
IA:   "Tienes S/800 en total, pero S/180 son para la cuota 
       y S/100 para emergencia. Libre tienes S/220.
       Sí puedes gastar S/50, quedarías con S/170 libres 
       hasta el viernes."
```

### Si nunca crea cajas

→ Todo su dinero se considera "libre". El Dashboard no muestra cajas. La IA dice "tienes S/X". Manzana sigue siendo útil.

---

## 18. Edge cases

| # | Edge case | Solución |
|---|---|---|
| 1 | Cuenta con saldo 0 → gasto desde ella | Permitir. La cuenta queda negativa con advertencia visual. |
| 2 | Caja overspend (caja S/150, pago S/200) | Permitir. Caja a -S/50 con warning. IA sugiere ajustar. |
| 3 | Eliminar cuenta que tiene cajas | Bloquear hasta transferir o eliminar cajas primero. |
| 4 | Movimiento sin cuenta NI caja | Ambos null → registra como general. Afecta historial/insights, no saldos financieros. |
| 5 | Nombre de cuenta duplicado | Prevenir: "Ya tienes una cuenta Yape." |
| 6 | Movimientos históricos anteriores a creación de cuentas | No retroasignar automáticamente. El usuario puede editar manualmente. |
| 7 | Movimiento soft-deleted → efecto en saldo | Balance Engine recalcula y reversa el efecto del movimiento eliminado. |
| 8 | Saldo de cajas > saldo de cuenta | Warning: "Tu caja Emergencia (S/400) es mayor que tu saldo BCP (S/350). Puede faltar un ingreso." |
| 9 | Crear cuenta por WhatsApp con typo | IA confirma antes de crear: "¿Creo cuenta 'Ypae'? ¿O quisiste decir Yape?" |
| 10 | Transferencia cross-account de cajas | No permitido como operación única en V1. Se modela como transferencia entre cuentas + asignación interna en la cuenta destino, o como flujo guiado futuro. |
| 11 | Backfill de emails → ¿qué cuenta? | Usar `bank_or_app` del email para asignar. Si cuenta no existe, sugerir creación. |
| 12 | Usuario crea cuenta desde Dashboard y WhatsApp al mismo tiempo | Dedup por nombre + institución. Core rechaza duplicado. |
| 13 | Asignación interna mayor al dinero libre | Permitir. Libre queda negativo. Warning: "Estás asignando más de lo que tienes libre." |
| 14 | Todas las cuentas eliminadas | Los movimientos persisten. Si crea nueva cuenta, empieza de cero. Historial intacto. |

---

## 19. Métricas de éxito

| Métrica | Target | Cómo se mide |
|---|---|---|
| Usuarios con al menos 1 cuenta al D7 | ≥ 60% | Count users con Account activa a los 7 días |
| Usuarios con al menos 1 caja al D30 | ≥ 30% | Count users con Box activa a los 30 días |
| Movimientos con cuenta asignada | ≥ 70% | Ratio movimientos con `cuenta_origen_id` o `cuenta_destino_id` / total movimientos que deberían tener cuenta |
| Precisión de inferencia de cuenta por IA | ≥ 85% | Movimientos inferidos correctamente / total inferidos |
| Usuarios que entienden dinero libre | Medir | Acción posterior a ver dinero libre (crear caja, asignar, consultar) |
| Cajas completadas (objetivo alcanzado) | Medir | Count cajas con saldo_actual >= meta |
| Reconciliaciones manuales por usuario/mes | Medir (baseline) | Count ajustes tipo reconciliación |

---

## 20. Fuera de alcance V1

| Feature | Razón |
|---|---|
| Sincronización automática con bancos (open banking) | V1 usa email parsing + registro manual. No hay integraciones directas. |
| Cuentas compartidas (parejas, familia) | V1 es usuario individual. |
| Inversiones como tipo de cuenta | No dar asesoría financiera ni tracking de inversiones. |
| Multi-moneda UI completa | Solo PEN en V1. USD existe en el modelo de datos pero la UI no lo soporta. |
| Transferencias cross-account de cajas | Complejidad excesiva para V1. Workaround: eliminar + recrear. |
| Auto-funding de cajas (asignación automática) | Requiere reglas automáticas y schedulers. Futuro. |
| Cálculo de intereses en cajas de ahorro | Manzana no es banco. Las cajas no generan rendimientos. |
| Presupuestos formales por categoría vinculados a cajas | Metas/límites no tienen documento propio todavía. Ref: `05b_motor_ia.md` §11.10. |

---

## 21. Resumen final

Cuentas y cajas son la base del valor diferencial de Manzana: **dinero libre real**.

Sin ellas, Manzana es una calculadora de gastos. Con ellas, es un espejo financiero inteligente que responde la pregunta que más importa: **¿cuánto puedo gastar?**

Principios clave de esta especificación:

| Principio | Decisión |
|---|---|
| Caja libre es cálculo | No es entidad. `libre = saldo - cajas`. |
| Cajas son per account | Pero Dashboard agrega visualmente. |
| Cuenta null es válida | Datos imperfectos > datos inventados. |
| Saldo negativo permitido | Con warning, no bloqueo. |
| Campos duales en movimiento | `caja_origen_id` + `caja_destino_id`. |
| Creación progresiva | Cuentas crecen con uso, no en onboarding forzado. |
| Balance Engine determinístico | Saldos son cálculos exactos, no IA. |
| Inferencia por cascada | 6 niveles antes de preguntar al usuario. |

---

*Feature 5/10 del Paso 5 — V2 Especificación avanzada ✅*
