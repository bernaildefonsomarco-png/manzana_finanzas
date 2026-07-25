# Feature 9: Deudas y Personas Relacionadas

**Parte del Paso 5/20 - Alcance V1.0**  
**Prioridad:** P1  
**Estado:** V2.1 - Especificacion avanzada con ciclo de vencimientos V1  
**Ultima actualizacion:** 1 de julio, 2026

---

## 1. Tesis

Las deudas son una de las formas mas fuertes de ansiedad financiera cotidiana. Muchas personas no necesitan primero un presupuesto perfecto; necesitan saber:

- cuanto deben,
- quien les debe,
- que cuota viene,
- que ya pagaron,
- que falta,
- y que no se les olvide.

La tesis de V1 es:

> Una deuda puede existir y dar valor aunque el usuario no registre todos sus gastos.

Manzana debe permitir usar la app solo para deudas si eso resuelve el dolor principal del usuario.

---

## 2. Principios

1. **Deuda no es solo gasto.**  
   Una deuda tiene estado, saldo pendiente, pagos, persona/entidad, vencimientos y progreso.

2. **Debt Engine calcula, IA entiende lenguaje.**  
   El LLM interpreta frases como "Luis me pago" o "pague la cuota"; Debt Engine valida y actualiza.

3. **Deudas reducen ansiedad, no presionan.**  
   El tono debe ser claro y tranquilo, nunca de cobranza agresiva.

4. **Puede vivir standalone.**  
   El usuario puede registrar una deuda sin registrar cuenta, categoria o todos sus gastos.

5. **Pagos y saldos son trazables.**  
   Todo pago, ajuste, mora, condonacion o renegociacion queda auditado.

6. **Personas relacionadas son ligeras.**  
   No son contactos, red social ni invitaciones. Son entidades para recordar relaciones financieras.

7. **Tarjeta de credito no es cuenta.**  
   Una tarjeta de credito es deuda/pasivo o metodo vinculado a deuda, no dinero disponible.

8. **No contactar terceros.**  
   Manzana ayuda al usuario a recordar. No cobra, no notifica a la otra persona y no envia mensajes a terceros.

9. **Modo discreto importa.**  
   Deudas, montos, bancos y personas son datos sensibles.

---

## 3. Que no es esta feature

No es:

- sistema legal de cobranza,
- Splitwise grupal,
- red social de deudas,
- contacto automatico a deudores,
- scoring crediticio,
- asesor financiero,
- calculadora exacta de amortizacion bancaria compleja,
- integracion bancaria directa,
- reemplazo de cuentas/cajas,
- categoria de gasto.

Manzana organiza y explica. No cobra ni juzga.

---

## 4. Relacion con otros sistemas

| Sistema | Relacion |
|---|---|
| Motor IA | DataAgent detecta deuda/prestamo/pago/devolucion; Orchestrator activa Debt Engine. |
| Core financiero | Ejecuta comandos, movimientos, auditoria y outbox. |
| Debt Engine | Mantiene estado, saldo, pagos, cuotas, vencimientos y progreso. |
| Cuentas/Cajas | Pagos afectan cuentas/cajas si se indica origen; cajas compromiso pueden vincularse a deuda. |
| Recurrentes | Cuotas periodicas pueden vincularse a Recurring Engine, pero Debt Engine conserva el saldo real de deuda. |
| Email Parsing | Emails de cuotas/tarjeta crean pendientes; nunca actualizan deuda sin aprobacion. |
| Dashboard | Permite revisar, pagar, cerrar, renegociar y ver personas relacionadas. |
| Insights | Usa progreso, vencimientos, deuda pendiente y pagos para descubrimientos. |
| Nudges | Puede recordar cuotas proximas o vencidas si hay opt-in y politicas. |
| Categorias | Categoria `deudas` clasifica movimientos, pero no reemplaza Debt Engine. |

---

## 5. Modelo conceptual

### 5.1 Debt

Entidad principal. Representa una obligacion o una deuda a favor.

Ejemplos:

- "le debo 50 a Luis",
- "Luis me debe 30",
- "debo 2000 en la tarjeta BCP",
- "laptop en 6 cuotas de 400",
- "mi mama me presto 500".

### 5.2 Direction

La deuda siempre tiene direccion.

| Direction | Significado |
|---|---|
| `i_owe` | Yo debo dinero. Es pasivo/obligacion. |
| `they_owe_me` | Alguien me debe dinero. Es una deuda a favor/por cobrar. |

### 5.3 Debt kind

El tipo describe la estructura de la deuda.

| Kind | Ejemplo |
|---|---|
| `personal` | Le debo a Luis, Ana me debe. |
| `bank_loan` | Prestamo bancario en cuotas. |
| `credit_card` | Tarjeta de credito. |
| `installment_purchase` | Laptop en 6 cuotas. |
| `service_or_bill` | Recibo, cuota o compromiso con entidad. |
| `other` | Caso no cubierto. |

### 5.4 Payment

Movimiento que reduce una deuda.

- Si `direction = i_owe`, un pago reduce lo que debo.
- Si `direction = they_owe_me`, un cobro/devolucion reduce lo que me deben.

### 5.5 Installment

Cuota esperada.

Puede tener:

- monto,
- fecha de vencimiento,
- estado,
- pago vinculado,
- recurrente vinculado.

### 5.6 RelatedPerson / RelatedParty

Entidad ligera para personas o entidades mencionadas en deuda.

Ejemplos:

- Luis,
- mama,
- Ana,
- BCP,
- Interbank,
- tienda de laptop.

No se guardan datos de contacto salvo que una futura feature lo pida con consentimiento explicito.

---

## 6. Tipos de deuda V1

### 6.1 Deuda informal personal

```text
User: le debo 50 a Luis
Manzana: Listo. Lo guardo como deuda con Luis por S/50.
```

Caracteristicas:

- Puede no tener fecha de pago.
- Puede pagarse parcial o total.
- Puede tener alias de persona.
- No requiere interes.

### 6.2 Deuda a favor

```text
User: Luis me debe 80
Manzana: Listo. Luis te debe S/80.
```

Caracteristicas:

- Direction `they_owe_me`.
- No es ingreso hasta que se cobre.
- Puede generar recordatorio privado para el usuario.

### 6.3 Prestamo recibido

```text
User: mi mama me presto 500
Manzana: Listo. Registrare S/500 como prestamo recibido de mama.
```

Efecto:

- Crea deuda `i_owe`.
- Si el dinero entro a una cuenta, puede crear movimiento `prestamo_recibido`.
- Si no se sabe cuenta, la deuda se crea igual y el movimiento queda con cuenta `null`.

### 6.4 Prestamo dado

```text
User: le preste 200 a mi hermano
Manzana: Listo. Tu hermano te debe S/200.
```

Efecto:

- Crea deuda `they_owe_me`.
- Si salio dinero de cuenta, crea movimiento `prestamo_dado`.
- No se clasifica como gasto comun.

### 6.5 Prestamo bancario

```text
User: tengo un prestamo del banco de 5000 en 12 cuotas
Manzana: Entendido. Lo registro como prestamo bancario. Me falta saber la fecha de la proxima cuota.
```

Campos utiles:

- monto original,
- saldo pendiente,
- numero de cuotas,
- monto de cuota,
- proxima fecha,
- entidad,
- interes opcional si el usuario lo sabe.

### 6.6 Tarjeta de credito

```text
User: debo 2000 en la tarjeta BCP
Manzana: Registrado como deuda de tarjeta BCP por S/2,000. ¿Quieres agregar fecha de pago?
```

Reglas:

- No es una cuenta de dinero disponible.
- Puede tener saldo variable.
- Puede tener pago minimo, pago total o monto fijo.
- En V1, intereses/mora se registran como ajustes manuales o cargos confirmados.

### 6.7 Compra en cuotas

```text
User: compre una laptop en 6 cuotas de 400
Manzana: Registro la laptop como deuda en 6 cuotas de S/400.
```

Reglas:

- Crea deuda `installment_purchase`.
- Puede crear calendario de cuotas.
- Puede sugerir caja compromiso.
- Si llega email de una cuota, se sugiere vincular al pago esperado.

---

## 7. Relacion con tipos canonicos de movimiento

La deuda se expresa en movimientos, pero no se reduce a movimientos.

| Movimiento canonico | Que hace en Debt Engine | Afecta cuenta/caja |
|---|---|---|
| `deuda_adquirida` | Crea o aumenta deuda `i_owe` sin entrada de dinero disponible. | No, salvo pago inicial separado. |
| `prestamo_recibido` | Crea deuda `i_owe` y registra entrada de dinero si cuenta conocida. | Si, incrementa cuenta destino si existe. |
| `prestamo_dado` | Crea deuda `they_owe_me` y registra salida de dinero si cuenta conocida. | Si, decrementa cuenta origen si existe. |
| `pago_deuda` | Reduce deuda `i_owe`. | Si, decrementa cuenta/caja si se conoce origen. |
| `devolucion_recibida` | Reduce deuda `they_owe_me`. | Si, incrementa cuenta destino si existe. |
| `ajuste` | Corrige saldo, interes, mora, condonacion o error. | Depende del ajuste. |

Regla clave:

> `pago_deuda` no es un `gasto` generico. Es salida de dinero vinculada a una obligacion.

La categoria `deudas` puede ayudar a filtrar, pero el estado real vive en Debt Engine.

---

## 8. Debt Engine

### 8.1 Responsabilidades

Debt Engine debe:

- crear deudas,
- actualizar saldo pendiente,
- registrar pagos y devoluciones,
- calcular progreso,
- manejar cuotas,
- detectar vencimientos,
- marcar vencida/pagada/cancelada,
- vincular personas/entidades,
- vincular recurrentes y cajas,
- emitir eventos internos,
- proveer datos read-only al Motor IA y Dashboard.

### 8.2 No hace

Debt Engine no debe:

- contactar a terceros,
- cobrar dinero,
- asumir intereses complejos sin datos,
- cambiar cuentas/cajas directamente sin Core,
- crear movimientos sin validacion,
- sumar emails no confirmados,
- dar consejo legal o crediticio.

### 8.3 Regla de oro

> Si el usuario dice algo que puede ser regalo, gasto, prestamo o pago de deuda, preguntar antes de asumir.

Ejemplo ambiguo:

```text
Le pase 50 a Luis.
```

Puede ser:

- gasto compartido,
- regalo,
- prestamo dado,
- pago de deuda,
- transferencia a otra cuenta propia si Luis es alias raro.

Manzana debe preguntar.

---

## 9. Estados

### 9.1 DebtStatus

| Estado | Significado |
|---|---|
| `draft` | Falta informacion importante y no debe generar nudges. |
| `active` | Deuda vigente. |
| `due_soon` | Tiene cuota o pago proximo. |
| `overdue` | Hay cuota vencida o fecha pasada. |
| `paid` | Saldo pendiente cero. |
| `cancelled` | El usuario cancelo/anulo la deuda. |
| `archived` | Cerrada y oculta de vistas activas. |

`partially_paid` no necesita ser estado principal: se calcula por progreso.

### 9.2 InstallmentStatus

| Estado | Significado |
|---|---|
| `pending` | Cuota esperada. |
| `due_soon` | Vence pronto. |
| `overdue` | Vencida. |
| `paid` | Pagada. |
| `rescheduled` | Reprogramada. |
| `skipped` | Omitida/cambiada por acuerdo. |

Regla operativa V1:

- `due_soon` cubre desde tres dias antes del vencimiento hasta el mismo dia.
- `overdue` comienza el dia posterior a `due_date`, segun timezone del perfil.
- Debt Engine persiste estas transiciones de forma idempotente y las acompana
  con eventos de dominio; no cambia saldo ni monto por el paso del tiempo.
- El cron diario es recuperacion durable. Crear una deuda o confirmar un pago
  solicita ademas una reevaluacion inmediata.

---

## 10. Flujos por WhatsApp

### 10.1 Deuda informal

```text
User: le debo 50 a Luis
```

Flujo:

```text
WhatsApp
  -> Orchestrator
  -> DataAgent detecta deuda
  -> DebtContextPack con personas frecuentes
  -> Debt Engine valida
  -> Core crea deuda + audit_log + outbox
  -> ResponseAgent/plantilla confirma
```

Resultado:

- `direction: i_owe`,
- `kind: personal`,
- `related_party: Luis`,
- `principal_amount: 50`,
- `status: active`.

### 10.2 Deuda a favor

```text
User: Luis me debe 80
```

Resultado:

- `direction: they_owe_me`,
- `kind: personal`,
- `related_party: Luis`,
- no cuenta como ingreso hasta que Luis pague.

### 10.3 Pago parcial

```text
User: le pague 30 a Luis
```

Si existe deuda clara:

- crear movimiento `pago_deuda`,
- reducir saldo pendiente,
- registrar payment,
- recalcular progreso.

Si hay varias deudas con Luis, preguntar cual.

Contrato de ejecucion V1:

- WhatsApp y Dashboard usan el mismo `RecordDebtPaymentCommand` del
  Core/Debt Engine.
- El agente propone y copia IDs desde `active_debts`; nunca escribe deuda,
  movimiento, pago ni cuota directamente.
- El Core valida deuda activa, saldo, moneda, cuenta opcional y cuota antes de
  ejecutar `commit_debt_payment`.
- El commit es atomico e idempotente: movimiento, saldo de cuenta cuando
  aplica, `debt_payment`, asignacion a cuotas, saldo/estado de deuda y outbox.
- Si no se especifica cuenta, el pago reduce la deuda pero no altera saldos de
  cuentas.
- Si hay ambiguedad, sobrepago o moneda incompatible, no se crea un Pendiente
  generico confirmable ni se modifica dinero; se solicita aclaracion.
- La sensibilidad de la categoria deuda protege la lectura y el texto visible,
  pero no exige una segunda confirmacion para anotar un pago pasado claro; el
  Core especializado conserva todas las validaciones financieras.

### 10.4 Cobro recibido

```text
User: Luis me pago 50
```

Si Luis tenia deuda a favor:

- crear movimiento `devolucion_recibida`,
- reducir saldo por cobrar,
- cerrar si queda en cero.

Si no hay deuda previa, preguntar si quiere registrarlo como ingreso, devolucion o nuevo ajuste.

### 10.5 Compra en cuotas

```text
User: compre una laptop en 6 cuotas de 400
```

Debt Engine crea deuda `installment_purchase` con 6 cuotas. Si falta fecha de primera cuota, preguntar.

### 10.6 Tarjeta

```text
User: pague 200 de la tarjeta
```

Si hay una tarjeta clara:

- crear `pago_deuda`,
- reducir saldo,
- actualizar proxima fecha si aplica.

Si hay varias tarjetas o falta saldo, preguntar.

---

## 11. Creacion progresiva

No todas las deudas necesitan todos los campos al inicio.

### 11.1 Campos minimos

| Caso | Minimo para crear |
|---|---|
| Personal `i_owe` | monto + persona/entidad |
| Personal `they_owe_me` | monto + persona/entidad |
| Prestamo recibido | monto + persona/entidad |
| Prestamo dado | monto + persona/entidad |
| Banco/prestamo | monto o cuota + entidad |
| Tarjeta | entidad + saldo o pago |
| Compra en cuotas | monto total o cuota + cantidad de cuotas |

### 11.2 Campos opcionales

- fecha de vencimiento,
- cuenta vinculada,
- caja compromiso,
- interes,
- numero de cuotas,
- nota,
- categoria/subcategoria,
- recurrente vinculado.

### 11.3 Drafts

Si falta informacion critica, se puede crear `draft` o preguntar antes.

Ejemplo:

```text
User: tengo una deuda con el banco
Manzana: ¿De cuanto es o cuanto pagas al mes?
```

---

## 12. Pagos, devoluciones y ajustes

### 12.1 Pago total

Si el pago cubre el saldo pendiente:

- saldo pendiente queda en cero,
- deuda pasa a `paid`,
- se emite evento `debt_closed`,
- se archiva visualmente despues de confirmacion o periodo.

### 12.2 Pago parcial

Reduce saldo pendiente y actualiza progreso.

```text
Deuda S/150
Pago S/50
Pendiente S/100
```

Si la deuda tiene calendario de cuotas, V1 aplica esta politica determinista:

1. tomar la cuota abierta con `due_date` mas antigua;
2. aplicar el abono hasta cubrir su pendiente;
3. si sobra monto, continuar con la siguiente cuota abierta;
4. permitir pagos adelantados siguiendo el mismo orden;
5. registrar cada asignacion pago-cuota para auditoria;
6. ejecutar movimiento, cuenta/caja opcional, deuda, cuotas y outbox en una sola transaccion Core.

Una cuota parcialmente cubierta conserva su estado abierto y aumenta
`paid_amount`. Al completar su monto esperado pasa a `paid`.

### 12.3 Pago con cuenta desconocida

Si el usuario no especifica cuenta:

- la deuda puede actualizarse,
- el movimiento queda con `account_from: null`,
- no afecta saldos por cuenta,
- Dashboard debe sugerir completar cuenta si importa para liquidez.

### 12.4 Pago desde caja compromiso

Si hay caja vinculada y saldo suficiente:

- `pago_deuda` usa `box_from`,
- baja la caja,
- baja la deuda,
- no se descuenta dos veces en dinero libre operativo.

### 12.5 Sobrepago

Si el pago excede saldo pendiente:

- V1 bloquea el registro y pide corregir el monto;
- no crea movimiento, asignacion ni cambio de saldo;
- aplicar excedente como otro concepto queda fuera del flujo V1 y requerira una
  decision/confirmacion explicita futura.

### 12.6 Interes y mora

En V1:

- intereses y moras se registran como `DebtAdjustment`,
- no calcular APR/amortizacion compleja automaticamente,
- si el usuario da una cuota fija, usar esa cuota como dato operativo,
- si llega email de mora, crear pendiente y pedir confirmacion.

### 12.7 Condonacion o perdon

Si el usuario dice:

```text
Luis ya no me va a pagar
```

Debe preguntar si quiere:

- cancelar la deuda,
- marcar como perdida/condonada,
- mantenerla activa.

---

## 13. Cuotas

### 13.1 Cuotas fijas

Para prestamos y compras en cuotas:

- monto de cuota,
- numero total de cuotas,
- cuota actual,
- fecha proxima,
- estado por cuota.

### 13.2 Cuotas variables

Para tarjeta u obligaciones variables:

- saldo actual,
- pago minimo opcional,
- pago esperado opcional,
- fecha de vencimiento.

### 13.3 Vinculo con Recurrentes

Regla:

> Debt Engine posee el saldo y progreso de deuda. Recurring Engine puede manejar la expectativa periodica o deteccion de pago repetido.

Si se paga un recurrente vinculado:

```text
Recurring Engine confirma pago
  -> Core registra movimiento
  -> Debt Engine reduce deuda/cuota
  -> Event Bus actualiza Dashboard, Insights y Nudges
```

---

## 14. Personas relacionadas

### 14.1 Proposito

Personas relacionadas ayudan a responder:

- cuanto le debo a Luis,
- cuanto me debe Ana,
- quien tiene deudas activas conmigo,
- que alias se refieren a la misma persona.

No son contactos.

### 14.2 Datos permitidos

```ts
type RelatedPerson = {
  id: string;
  user_id: string;
  display_name: string;
  normalized_name: string;
  aliases: string[];
  relationship: "friend" | "family" | "partner" | "coworker" | "institution" | "merchant" | "other" | null;
  status: "active" | "merged" | "archived";
  merged_into_id: string | null;
  created_from: "whatsapp" | "dashboard" | "email" | "manual";
};
```

### 14.3 Datos no permitidos en V1

- telefono,
- email,
- cuenta bancaria,
- DNI,
- direccion,
- datos de contacto,
- permisos para escribirle.

### 14.4 Alias y fusion

Si el sistema sospecha duplicado:

```text
"mi viejo" podria ser "papa". ¿Es la misma persona?
```

Solo fusionar con confirmacion si la confianza no es absoluta.

### 14.5 Saldo neto por persona

Para cada persona:

```text
saldo_neto = total_que_me_debe - total_que_le_debo
```

La UI debe mostrarlo con lenguaje claro:

- "Luis te debe S/80"
- "Le debes S/50 a Ana"
- "Con Marco estas tablas"

---

## 15. Dashboard

La pantalla de Deudas debe permitir:

- ver total que debo,
- ver total que me deben,
- ver saldo neto,
- ver proximas cuotas,
- ver deudas vencidas,
- registrar pago,
- registrar cobro recibido,
- crear deuda,
- editar/renegociar,
- cerrar/cancelar,
- ver historial,
- ver persona relacionada.

### 15.1 Lista

Cada deuda muestra:

- nombre,
- tipo,
- direccion,
- monto pendiente,
- monto pagado,
- progreso,
- proxima cuota/fecha,
- estado,
- persona/entidad,
- acciones principales.

### 15.2 Detalle

El detalle debe mostrar:

- saldo original,
- saldo pendiente,
- pagos,
- ajustes,
- cuotas,
- movimientos vinculados,
- caja vinculada,
- recurrente vinculado,
- audit trail,
- fuente de creacion.

### 15.3 Estados vacios

Si el usuario no usa deudas:

```text
Puedes guardar deudas o prestamos con un mensaje como "le debo 50 a Luis".
```

No mostrar una pantalla pesada ni obligar a configurar nada.

---

## 16. Email Parsing

Emails de banco/Yape/tarjeta pueden sugerir:

- pago de cuota,
- cargo de tarjeta,
- devolucion,
- compra en cuotas,
- mora/interes,
- transferencia relacionada.

Reglas:

- Nada se registra sin aprobacion.
- Email no confirmado no cambia deuda.
- Si el monto coincide con cuota esperada, sugerir vinculo.
- Si hay varias deudas compatibles, preguntar.
- Si es cargo de tarjeta, sugerir si aumenta deuda de tarjeta o si es gasto ya registrado segun contexto.

Ejemplo:

```text
Detecte un cargo de S/180 que parece tu cuota de laptop. ¿Lo marco como pagada?
```

---

## 17. Nudges y modo discreto

Las deudas son sensibles.

### 17.1 Permitido

Con opt-in:

```text
Tu cuota vence en 2 dias. ¿Quieres verla?
```

### 17.2 Modo discreto

Si modo discreto esta activo:

```text
Tienes un compromiso financiero proximo. ¿Quieres verlo?
```

No exponer:

- monto,
- banco,
- tarjeta,
- persona,
- palabra "deuda" si puede ser sensible en notificacion.

### 17.3 Anti-spam

- No repetir vencimiento si el usuario ya lo vio y no actuo, salvo escalamiento razonable.
- No enviar recordatorios de deudas sin opt-in.
- No enviar de noche si horario silencioso activo.

---

## 18. Contratos de datos

### 18.1 Enums

```ts
type DebtDirection = "i_owe" | "they_owe_me";

type DebtKind =
  | "personal"
  | "bank_loan"
  | "credit_card"
  | "installment_purchase"
  | "service_or_bill"
  | "other";

type DebtStatus =
  | "draft"
  | "active"
  | "due_soon"
  | "overdue"
  | "paid"
  | "cancelled"
  | "archived";

type InstallmentStatus =
  | "pending"
  | "due_soon"
  | "overdue"
  | "paid"
  | "rescheduled"
  | "skipped";
```

### 18.2 Debt

```ts
type Debt = {
  id: string;
  user_id: string;
  direction: DebtDirection;
  kind: DebtKind;
  status: DebtStatus;
  title: string;
  related_person_id: string | null;
  institution_name: string | null;
  currency: "PEN" | "USD";
  original_amount: number | null;
  principal_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  installment_count: number | null;
  installment_amount: number | null;
  next_due_date: string | null;
  interest_mode: "none" | "manual" | "unknown";
  linked_box_id: string | null;
  linked_recurring_id: string | null;
  source: "whatsapp" | "dashboard" | "email_pending" | "manual";
  confidence: number | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};
```

### 18.3 DebtPayment

```ts
type DebtPayment = {
  id: string;
  debt_id: string;
  user_id: string;
  movement_id: string | null;
  amount: number;
  currency: "PEN" | "USD";
  paid_at: string;
  payment_type: "payment" | "repayment_received" | "adjustment" | "forgiveness";
  account_from_id: string | null;
  account_to_id: string | null;
  box_from_id: string | null;
  note: string | null;
  source: "whatsapp" | "dashboard" | "email_confirmed" | "manual";
};
```

### 18.4 Installment

```ts
type DebtInstallment = {
  id: string;
  debt_id: string;
  installment_number: number;
  due_date: string | null;
  expected_amount: number;
  paid_amount: number;
  status: InstallmentStatus;
  movement_id: string | null;
};
```

### 18.5 DebtAdjustment

```ts
type DebtAdjustment = {
  id: string;
  debt_id: string;
  type: "interest" | "late_fee" | "correction" | "forgiveness" | "renegotiation";
  amount_delta: number;
  reason: string;
  created_by: "user" | "system";
  created_at: string;
};
```

---

## 19. Validaciones

Debt Engine/Core deben validar:

- monto positivo para creacion y pagos,
- moneda consistente o conversion explicita,
- direccion correcta,
- persona/entidad cuando aplique,
- no cerrar deuda con saldo pendiente salvo cancelacion/condonacion explicita,
- no aplicar pago mayor al saldo en V1,
- no actualizar deuda desde email no confirmado,
- no tratar tarjeta de credito como cuenta de dinero disponible,
- no contar prestamo dado como gasto comun,
- no contar prestamo recibido como ingreso normal,
- no fusionar personas sin suficiente confianza o confirmacion,
- toda edicion genera audit_log.

---

## 20. Eventos internos

Eventos que Debt Engine puede emitir:

```text
debt_created
debt_updated
debt_payment_recorded
debt_repayment_received
debt_adjusted
debt_closed
debt_cancelled
debt_due_soon
debt_overdue
debt_installment_paid
related_person_created
related_person_merged
```

Eventos se escriben en `transactional_outbox` dentro de la misma transaccion que cambia la deuda.

---

## 21. Insights

Insights puede usar deudas para:

- progreso pagado,
- deuda que baja,
- deuda que sube,
- cuota proxima,
- deuda vencida,
- relacion con dinero libre,
- persona con saldo neto,
- deuda pagada completamente.

Ejemplo:

```text
Ya pagaste 65% de tu laptop. Te faltan 3 cuotas.
```

Reglas:

- No mostrar deudas sensibles en proactivos sin politicas.
- No usar tono de regano.
- No mezclar deuda con gasto comun.

---

## 22. Metricas

| Metrica | Para que sirve |
|---|---|
| Deudas activas por usuario con feature usada | Medir adopcion. |
| Pagos registrados por semana | Medir uso recurrente. |
| Deudas cerradas | Medir valor logrado. |
| Cuotas vencidas vistas vs ignoradas | Medir nudge/UX. |
| Ambiguedad prestamo vs gasto | Mejorar DataAgent. |
| Personas fusionadas/corregidas | Medir calidad de entidades. |
| Pagos con cuenta `null` | Medir deuda actualizada pero liquidez incompleta. |
| Retencion de usuarios debt-first | Validar entrada por deudas. |

---

## 23. Escenarios de prueba

### Escenario 1: deuda informal

```text
Le debo 50 a Luis.
```

Debe crear deuda `i_owe`, persona Luis y estado activo.

### Escenario 2: deuda a favor

```text
Luis me debe 80.
```

Debe crear deuda `they_owe_me`. No debe registrar ingreso.

### Escenario 3: pago parcial

```text
Le pague 30 a Luis.
```

Debe reducir deuda si existe. Si hay varias con Luis, preguntar.

### Escenario 4: devolucion recibida

```text
Ana me pago lo que me debia.
```

Debe buscar deuda a favor de Ana y registrar `devolucion_recibida`.

### Escenario 5: prestamo recibido

```text
Mi mama me presto 500.
```

Debe crear deuda `i_owe` y movimiento `prestamo_recibido` si hay cuenta destino.

### Escenario 6: prestamo dado

```text
Le preste 200 a mi hermano.
```

Debe crear deuda `they_owe_me` y movimiento `prestamo_dado` si hay cuenta origen.

### Escenario 7: banco

```text
Tengo un prestamo del banco de 5000 en 12 cuotas.
```

Debe crear deuda bancaria, pedir fecha de proxima cuota si falta.

### Escenario 8: compra en cuotas

```text
Compre una laptop en 6 cuotas de 400.
```

Debe crear deuda `installment_purchase` y cuotas.

### Escenario 9: tarjeta

```text
Pague 200 de la tarjeta BCP.
```

Debe vincular a deuda de tarjeta si existe o preguntar.

### Escenario 10: email de cuota

Email detecta cargo S/180 posible cuota.

Debe crear pendiente y pedir confirmacion. No actualiza deuda sin aprobar.

### Escenario 11: ambiguo

```text
Le pase 50 a Luis.
```

Debe preguntar si fue prestamo, pago de deuda, regalo o gasto compartido.

### Escenario 12: sobrepago

Deuda pendiente S/50, usuario dice:

```text
Le pague 80 a Luis.
```

Debe bloquear el registro en V1 y pedir corregir el monto antes de crear
movimiento o modificar la deuda.

---

## 24. Out of scope V1

Queda fuera de V1:

- contactar o cobrar a terceros,
- pagos reales desde la app,
- invitaciones a otras personas,
- deudas compartidas multiusuario,
- intereses compuestos o amortizacion bancaria exacta,
- score crediticio,
- asesor legal o financiero,
- integracion bancaria directa,
- conciliacion automatica sin confirmacion,
- recordatorios a terceros,
- documentos legales.

---

## 25. Criterios de aceptacion

- Deuda es entidad propia, no solo categoria.
- `pago_deuda` no se modela como gasto generico.
- Prestamo dado/recibido y devolucion recibida tienen tratamiento propio.
- Tarjeta de credito no se modela como cuenta de dinero disponible.
- Debt Engine mantiene saldo, progreso, pagos, cuotas y estados.
- Personas relacionadas son ligeras y privadas.
- No se guardan telefonos, cuentas bancarias ni datos de contacto de terceros.
- Una deuda puede existir sin cuenta/caja/categoria.
- Pagos con cuenta `null` pueden actualizar deuda pero no saldos por cuenta.
- Email no confirmado no actualiza deuda.
- Recurrente vinculado puede actualizar deuda solo mediante Core/Debt Engine.
- Caja compromiso vinculada no duplica descuento en dinero libre.
- Modo discreto protege deudas, personas, bancos y montos.
- Dashboard permite crear, revisar, pagar, cerrar y ver historial.
- WhatsApp puede crear y actualizar deudas con lenguaje natural.
- Ambiguedades prestamo/gasto/regalo/pago preguntan antes.

---

*Feature 9/10 del Paso 5 - V2*
