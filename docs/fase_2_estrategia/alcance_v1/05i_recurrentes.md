# Feature 11: Pagos Recurrentes

**Parte del Paso 5/20 - Alcance V1.0**  
**Prioridad:** P1  
**Estado:** V2.1 - Especificacion avanzada y detector hibrido sincronizado  
**Ultima actualizacion:** 19 de julio, 2026

---

## 1. Tesis

Los recurrentes no son solo "Netflix". Son compromisos que vuelven y que afectan la sensacion real de disponibilidad del usuario.

Manzana debe ayudar a responder:

- que pagos vienen,
- cuales ya pague,
- cuales se atrasaron,
- que monto cambio,
- que compromisos reducen mi dinero libre,
- y que pagos deberia separar mentalmente antes de gastar.

Principio central:

> Un recurrente es una expectativa financiera. No es un movimiento real hasta que el usuario lo paga, confirma o existe una fuente aprobada.

Esto evita el error peligroso de inflar o reducir saldos por pagos futuros que todavia no ocurrieron.

---

## 2. Rol dentro del producto

Recurrentes conecta cinco piezas del producto:

| Sistema | Relacion |
|---|---|
| WhatsApp | Crear, confirmar, corregir, pausar o consultar recurrentes en lenguaje natural. |
| Dashboard | Ver calendario/lista, estados, proximos pagos, cambios y sugeridos. |
| Email Parsing | Detectar cargos que coinciden con recurrentes, pero siempre pedir confirmacion en V1. |
| Cuentas/Cajas | Afectar dinero libre operativo y sugerir cajas compromiso. |
| Deudas | Una cuota periodica puede estar vinculada a una deuda, pero Debt Engine conserva el saldo real. |
| Insights | Detectar cambios, patrones, atrasos y oportunidades de claridad. |
| Nudges | Recordar vencimientos solo con opt-in, horario permitido y modo discreto. |

### 2.1 Lenguaje de producto

`Recurrentes` es el nombre tecnico de la feature. Es util para arquitectura, contratos, eventos y documentacion interna, pero no debe ser el lenguaje principal frente al usuario.

Naming recomendado:

| Capa | Nombre recomendado | Uso |
|---|---|---|
| Codigo / arquitectura | `Recurrentes`, `Recurring Engine`, `RecurringRule` | Precision tecnica. |
| Dashboard - vista agrupadora | **Compromisos** | Cuando se muestran deudas, cuotas y pagos que vienen juntos. |
| Dashboard - subvista/lista | **Pagos que vienen** | Nombre humano para pagos periodicos esperados. |
| WhatsApp | "pagos que vienen", "pagos que se repiten", "lo que vuelve cada mes" | Conversacion natural. |
| Insights/nudges | "pago que viene", "pago esperado", "compromiso proximo" | Evitar tono contable. |

Regla:

> El usuario no necesita aprender la palabra "recurrente". Debe sentir que Manzana recuerda lo que viene y le ayuda a no ser sorprendido.

Ejemplos de copy:

```text
Tienes 3 pagos que vienen esta semana.
```

```text
Netflix parece volver cada mes cerca de esta fecha. ¿Quieres que lo recuerde como pago que viene?
```

```text
Tu dinero libre ya descuenta los compromisos que vienen y no estan cubiertos por cajas.
```

---

## 3. Definiciones

### 3.1 Recurrente

Entidad que representa un pago esperado que se repite.

Ejemplos:

- Netflix cada mes cerca del dia 15.
- Internet entre el 12 y 15.
- Alquiler el primer dia del mes.
- Luz con monto variable cerca del 20.
- Cuota mensual de una laptop.

### 3.2 Ocurrencia

Instancia esperada de un recurrente para un periodo concreto.

Ejemplo:

```text
Recurrente: Internet S/89 cada mes entre 12-15
Ocurrencia: Internet junio 2026, esperada entre 12-15 junio
```

### 3.3 Pago recurrente

Movimiento financiero creado cuando una ocurrencia se paga o confirma.

Tipo canonico:

```text
pago_recurrente
```

### 3.4 Candidato recurrente

Patron detectado por movimientos, email confirmado o historial. No esta activo hasta que el usuario lo confirma.

---

## 4. Principios

| # | Principio | Implicacion |
|---|---|---|
| 1 | Detectar no es activar | Un patron sugerido requiere confirmacion del usuario. |
| 2 | Esperado no es pagado | Un recurrente activo afecta compromisos/dinero libre, no saldo de cuenta hasta pago real. |
| 3 | La realidad es irregular | Montos y fechas pueden variar sin romper el modelo. |
| 4 | Deuda no es gasto comun | Cuotas vinculadas a deuda actualizan Debt Engine, no solo gasto. |
| 5 | Cajas evitan doble descuento | Si un recurrente esta cubierto por caja compromiso, dinero libre no debe restarlo dos veces. |
| 6 | Email no auto-registra en V1 | Email puede sugerir confirmar pago, no crear movimiento sin aprobacion. |
| 7 | El usuario puede usar solo recurrentes | No requiere tracking completo de gastos para ser util. |
| 8 | Menos ansiedad, mas anticipacion | El tono debe ayudar a prepararse, no asustar. |

---

## 5. Alcance V1

### 5.1 Incluido

- Crear recurrentes desde WhatsApp.
- Crear recurrentes desde Dashboard.
- Detectar candidatos recurrentes desde movimientos confirmados.
- Sugerir recurrentes desde email parsing.
- Confirmar o rechazar candidatos.
- Marcar ocurrencias como pagadas.
- Vincular recurrente a caja compromiso.
- Vincular recurrente a deuda/cuota.
- Detectar cambio de monto.
- Detectar pago esperado vencido.
- Pausar o desactivar recurrente.
- Mostrar proximos pagos en Dashboard.
- Aportar compromisos a dinero libre operativo.
- Generar eventos para insights y nudges.

### 5.2 Fuera de V1

- Auto-pago real.
- Conexion directa a bancos/open banking.
- Auto-confirmar pagos por email sin aprobacion.
- Reglas complejas de prorrateo.
- Prediccion exacta de servicios variables.
- Recurrentes compartidos entre personas/familias.
- Ingresos recurrentes como modulo completo.
- Pagos en multiples monedas con UI completa.

Nota:

> V1 puede guardar senales de ingresos que se repiten, pero la feature formal se enfoca en egresos/compromisos recurrentes.

---

## 6. Tipos de recurrente

| Tipo | Ejemplo | Reglas |
|---|---|---|
| Monto fijo, fecha fija | Netflix S/25 el dia 15 | Alta confianza, facil de detectar. |
| Monto fijo, fecha aproximada | Internet S/89 entre 12-15 | Usar ventana de fecha. |
| Monto variable, fecha fija | Luz el dia 20 | Fecha fuerte, monto estimado. |
| Monto variable, fecha aproximada | Agua entre 18-23 | Mayor incertidumbre, requiere copy cuidadoso. |
| Suscripcion | Spotify, iCloud, Netflix | Suele detectarse por merchant. |
| Servicio | Internet, celular, luz, agua | Puede variar por proveedor. |
| Alquiler | Alquiler cuarto/depa | Compromiso fuerte. |
| Cuota vinculada a deuda | Laptop 6 cuotas, prestamo | Debt Engine conserva saldo/progreso. |
| Manual | "cada mes pago cochera 120" | Creado por usuario. |
| Detectado por email | cargo recurrente de banco/Yape | Pendiente de confirmacion en V1. |

---

## 7. Frecuencia y calendario

### 7.1 Frecuencias soportadas V1

| Frecuencia | Soporte V1 | Nota |
|---|---|---|
| Mensual | Completo | Caso principal. |
| Semanal | Basico | Util para clases, comida, servicios. |
| Quincenal | Basico | Manejar como intervalo de 14/15 dias. |
| Anual | Basico | Suscripciones anuales; menos automatizacion. |
| Irregular con ventana | Basico | "entre 12 y 15" o "a fin de mes". |

### 7.2 Ventanas

| Campo | Ejemplo |
|---|---|
| `expected_date` | 2026-06-15 |
| `date_window_start` | 2026-06-12 |
| `date_window_end` | 2026-06-15 |
| `due_grace_days` | 2 dias |

Regla:

> Para el usuario, se muestra "entre 12 y 15"; internamente se guarda ventana.

---

## 8. Estados

### 8.1 Estado del recurrente

```text
suggested -> active -> paused | cancelled | archived
```

| Estado | Significado |
|---|---|
| `suggested` | Detectado, pendiente de confirmacion. |
| `active` | Confirmado y usado en compromisos futuros. |
| `paused` | Temporalmente detenido sin borrar historial. |
| `cancelled` | El usuario ya no lo paga. |
| `archived` | Cerrado/historico, no aparece por defecto. |

### 8.2 Estado de ocurrencia

```text
expected -> due_soon -> pending_confirmation -> paid
                             -> skipped | rejected
expected -> overdue -> paid | skipped
```

| Estado | Significado |
|---|---|
| `expected` | Pago esperado en el futuro. |
| `due_soon` | Dentro de ventana de aviso. |
| `pending_confirmation` | Hay señal de pago, falta aprobacion. |
| `paid` | Pago confirmado y vinculado a movimiento. |
| `skipped` | Usuario indica que este periodo no aplica. |
| `overdue` | Fecha/ventana paso sin pago registrado. |
| `rejected` | Señal sugerida no correspondia. |

### 8.3 Estado de candidato

| Estado | Significado |
|---|---|
| `candidate` | Patron detectado con evidencia inicial. |
| `ready_to_suggest` | Supera umbral de confianza. |
| `suggested` | Ya se mostro al usuario. |
| `confirmed` | Usuario lo activo como recurrente. |
| `dismissed` | Usuario lo rechazo. |
| `expired` | Patron dejo de tener evidencia. |

---

## 9. Recurring Engine

El `Recurring Engine` es deterministico. No es un agente LLM.

Responsabilidades:

- detectar patrones repetidos,
- crear candidatos,
- crear ocurrencias esperadas,
- vincular pagos confirmados,
- detectar cambios de monto,
- detectar vencimientos,
- aportar compromisos a Balance Engine,
- emitir eventos internos,
- evitar duplicados con email/WhatsApp/Dashboard,
- mantener historico y auditabilidad.

El LLM ayuda a entender frases y redactar respuestas. No decide por si solo que un recurrente existe, fue pagado o debe descontarse del saldo.

---

## 10. Deteccion automatica

### 10.1 Fuentes

| Fuente | Puede detectar | Puede activar |
|---|---|---|
| Movimientos confirmados | Si | No, solo sugerir. |
| Email confirmado | Si | No, solo sugerir. |
| Email no confirmado | Señal debil | No. |
| WhatsApp manual | Si el usuario lo pide | Si, con confirmacion clara si faltan datos. |
| Dashboard manual | Si el usuario lo crea | Si. |

### 10.2 Umbrales iniciales

| Señal | Umbral V1 |
|---|---|
| Mismo merchant/descripcion normalizada | Requerido para deteccion automatica. |
| Ocurrencias | 3 ocurrencias en periodos compatibles para sugerir. |
| Monto fijo | Variacion maxima aproximada `<= 10%`. |
| Fecha mensual | Ventana aproximada `+- 5 dias`. |
| Frecuencia mensual | Separacion entre 25 y 35 dias. |
| Frecuencia semanal | Separacion entre 6 y 8 dias. |
| Confianza minima para sugerir | `>= 0.75`. |

Reglas:

- Con 2 ocurrencias puede guardarse candidato silencioso.
- Con 3 ocurrencias puede sugerirse al usuario.
- Si el merchant es sensible, aplicar Risk Policy antes de mensaje proactivo.
- Si hay duda entre sugerir y esperar, esperar.

### 10.3 Normalizacion de merchant

Ejemplos:

```text
NETFLIX.COM
Netflix Lima
Pago Netflix
```

Deben poder agruparse como:

```text
merchant_normalized = "netflix"
```

La normalizacion debe guardar evidencia y no destruir el texto original del movimiento/email.

---

## 11. Reglas financieras

### 11.1 Saldo de cuenta

Un recurrente esperado no modifica saldo de cuenta.

Solo modifica saldo cuando existe movimiento real:

```text
ocurrencia pagada
  -> Core crea movimiento `pago_recurrente`
  -> Balance Engine decrementa cuenta si hay `account_id`
```

### 11.2 Dinero libre operativo

Un recurrente activo puede reducir dinero libre operativo si:

- esta dentro de la ventana de compromisos,
- no esta pagado,
- no esta cubierto por caja compromiso suficiente,
- no esta pausado/cancelado.

Ejemplo:

```text
Saldo cuenta: S/500
Caja internet: S/90
Recurrente internet esperado: S/89

Dinero libre operativo no descuenta internet otra vez,
porque la caja ya lo cubre.
```

### 11.3 Cuenta desconocida

Si el usuario confirma pago recurrente sin cuenta:

- se puede marcar ocurrencia como pagada,
- se puede crear movimiento con `account_id = null`,
- no se actualiza saldo por cuenta,
- se puede pedir/sugerir cuenta despues si aporta valor.

### 11.4 Pago parcial

V1 puede registrar pago parcial si el usuario lo expresa:

```text
Pague 50 de internet, falta el resto.
```

Regla:

- La ocurrencia queda `pending_confirmation` o parcialmente pagada mediante metadata.
- No considerar completamente pagada hasta completar monto esperado o confirmar cierre.

Para simplificar UI V1, los pagos parciales pueden mostrarse como "pendiente con pago parcial".

### 11.5 Reembolsos o devoluciones

Si hay devolucion asociada a un recurrente:

- se vincula como movimiento separado,
- no borra automaticamente el pago original,
- puede ajustar insights o dinero libre si se confirma.

---

## 12. Relacion con deudas

Debt Engine es dueño del saldo, progreso y cuotas de deuda.

Recurring Engine puede manejar:

- expectativa periodica,
- recordatorio,
- deteccion de pago repetido,
- matching entre cargo y cuota esperada.

Flujo:

```text
Usuario paga cuota recurrente vinculada
  -> Recurring Engine marca ocurrencia como pagada
  -> Core crea movimiento `pago_deuda` o `pago_recurrente` segun vinculo
  -> Debt Engine reduce saldo/cuota
  -> Balance Engine actualiza cuenta/caja si aplica
  -> Event Bus recalcula insights/nudges
```

Reglas:

- Si el recurrente esta vinculado a deuda, no tratarlo como gasto generico.
- Si una cuota bancaria aparece por email, sugerir vincular a deuda existente.
- Si no existe deuda pero parece cuota, preguntar antes de crear deuda.
- No duplicar: una cuota no debe aparecer como deuda y gasto separado sin relacion.

---

## 13. Relacion con cajas

Un recurrente puede vincularse a una caja compromiso.

Ejemplos:

- caja "Servicios" cubre internet + Netflix + Spotify,
- caja "Alquiler" cubre alquiler mensual,
- caja "Cuota laptop" cubre cuota vinculada a deuda.

Reglas:

- Un recurrente puede existir sin caja.
- Una caja puede cubrir varios recurrentes.
- Si el recurrente se pausa/cancela, la caja permanece; el usuario decide que hacer con el dinero.
- Pagar recurrente desde una caja reduce la caja.
- Si caja no tiene saldo suficiente, dinero libre operativo debe mostrar faltante.

---

## 14. Relacion con email parsing

En V1, email nunca registra pago recurrente sin aprobacion.

### 14.1 Email coincide con recurrente activo

```text
Email Adapter detecta cargo Netflix S/25.90
  -> DataAgent normaliza
  -> Dedup Engine compara con recurrente activo
  -> Pending Inbox crea confirmacion
  -> Usuario confirma
  -> Core crea movimiento y vincula ocurrencia
```

Mensaje:

```text
Detecte un cargo que parece Netflix de este mes por S/25.90. ¿Lo marco como pagado?
```

### 14.2 Monto cambio

```text
Netflix esperado: S/25.90
Email detectado: S/29.90
```

Respuesta:

```text
Netflix parece haber cambiado de S/25.90 a S/29.90.
¿Marco este pago y actualizo el monto esperado?
```

Opciones:

- marcar solo este pago,
- marcar pago y actualizar recurrente,
- no es Netflix,
- ignorar.

### 14.3 Email no coincide claramente

Crear pendiente normal, no vincular automaticamente.

---

## 15. Relacion con nudges

Los nudges de recurrentes pasan por `Nudge Policy Engine`.

Condiciones:

- opt-in activado,
- horario silencioso respetado,
- frecuencia maxima respetada,
- modo discreto aplicado,
- usuario no registro ya el pago,
- no hay mensaje mas importante compitiendo.

### 15.1 Ventanas sugeridas V1

| Caso | Regla |
|---|---|
| Recurrente proximo fuerte | Avisar 1-3 dias antes si opt-in. |
| Recurrente vencido | Avisar 1 vez despues de gracia. |
| Cambio de monto | Avisar al confirmar pago o al revisar pendiente. |
| Recurrente sensible | Evitar detalle en proactivo; usar modo discreto. |

Ejemplo con modo discreto:

```text
Tienes un pago recurrente proximo. ¿Quieres verlo?
```

Ejemplo normal:

```text
Tu internet suele pagarse entre el 12 y 15. Faltan 2 dias.
```

---

## 16. Relacion con insights

Recurring Engine alimenta insights, pero no los narra.

Tipos de insight posibles:

- recurrente detectado,
- recurrente subio de monto,
- recurrente vencido,
- compromisos mensuales aumentaron,
- caja sugerida para recurrente frecuente,
- progreso positivo por pagos a tiempo.

Regla:

> Un insight puede sugerir marcar recurrente, pero Recurring Engine y el usuario deciden si se activa.

---

## 17. Agentes y motores

### 17.1 Motores deterministas

| Motor | Responsabilidad |
|---|---|
| Recurring Engine | Deteccion, estados, ocurrencias, matching y compromisos. |
| Dedup Engine | Evitar duplicados entre email, WhatsApp, Dashboard y pagos esperados. |
| Balance Engine | Calcular impacto en cuenta, caja y dinero libre. |
| Debt Engine | Validar y actualizar deudas/cuotas vinculadas. |
| Pending Inbox | Gestionar confirmaciones de email/candidatos. |
| Nudge Policy Engine | Decidir si se puede avisar. |
| Risk Policy | Proteger mensajes sensibles. |

### 17.2 Agentes LLM

| Agente | Rol |
|---|---|
| DataAgent | Entiende frases como "pague internet" o "cada mes pago Netflix". |
| CorrectionAgent | Interpreta correcciones: "ese pago no era Netflix". |
| ConversationAgent | Responde consultas: "que pagos vienen este mes?". |
| ResponseAgent | Redacta confirmaciones breves y claras. |
| InsightNarratorAgent | Narra insights sobre recurrentes ya calculados. |

No se crea un `RecurringAgent` en V1. La calidad aqui viene de reglas y contratos claros, no de volver agente un calculo financiero.

---

## 18. Contexto necesario

Para flujos de recurrentes, los agentes o plantillas reciben un `RecurringContextPack` construido por `ContextPackBuilder`.

Incluye solo lo necesario:

- recurrentes activos relevantes,
- candidatos pendientes,
- ocurrencias proximas/vencidas,
- deuda vinculada si aplica,
- caja vinculada si aplica,
- cuenta sugerida o ultima cuenta usada,
- historial breve de pagos similares,
- preferencias de nudges,
- modo discreto,
- estado de confirmacion actual.

No incluye:

- todo el historial financiero,
- datos sensibles no relacionados,
- deudas cerradas no relevantes,
- razonamiento interno crudo.

---

## 19. Flujos principales

### 19.1 Crear recurrente por WhatsApp

```text
Usuario: todos los 15 pago internet 89
Orchestrator -> DataAgent -> Recurring Engine
Recurring Engine valida datos minimos
Core crea recurrente activo
ResponseAgent confirma
```

Respuesta:

```text
Listo. Deje Internet como recurrente: S/89 aprox. cada 15 del mes.
```

Si falta dato:

```text
¿Que dia suele pagarse?
```

### 19.2 Crear recurrente desde Dashboard

Usuario abre Pagos que vienen -> Nuevo pago que viene.

Campos minimos:

- nombre,
- monto esperado o variable,
- frecuencia,
- fecha o ventana aproximada,
- categoria opcional,
- cuenta sugerida opcional,
- caja/deuda vinculada opcional.

### 19.3 Deteccion por movimientos

```text
Netflix aparece en enero, febrero y marzo
Recurring Engine crea candidato ready_to_suggest
Pending Inbox/Dashboard muestra sugerencia
WhatsApp puede preguntar si hay opt-in/contexto
```

Copy:

```text
He visto Netflix cerca de esta fecha por 3 meses.
¿Quieres marcarlo como pago recurrente?
```

### 19.4 Confirmar pago del periodo

```text
Usuario: ya pague internet
DataAgent identifica recurrente probable
Recurring Engine encuentra ocurrencia actual
Core crea movimiento `pago_recurrente`
Balance Engine actualiza cuenta/caja si aplica
Recurring Engine marca ocurrencia pagada
```

Si hay varios candidatos:

```text
¿Te refieres a Internet S/89 o a Celular S/45?
```

### 19.5 Email detecta pago recurrente

```text
Email -> Pending Inbox
Usuario confirma por WhatsApp/Dashboard
Core crea movimiento
Recurring Engine vincula ocurrencia
```

Regla:

> Email sin confirmacion no marca pagado y no afecta saldo.

### 19.6 Cambio de monto

```text
Usuario: Spotify me cobro 22, antes era 18
Recurring Engine registra pago actual
Pregunta si actualiza monto esperado
```

Respuesta:

```text
Lo marco como pagado por S/22. ¿Actualizo Spotify para esperar S/22 desde ahora?
```

### 19.7 Pausar o cancelar

```text
Usuario: ya no pago Netflix
Recurring Engine cambia estado a cancelled
Futuras ocurrencias se cancelan
Historial queda visible
```

Respuesta:

```text
Listo. Desactive Netflix como recurrente. El historial queda guardado.
```

### 19.8 Saltar un periodo

```text
Usuario: este mes no pagare gimnasio
```

Regla:

- La ocurrencia del periodo queda `skipped`.
- El recurrente sigue activo para el siguiente periodo.

### 19.9 Recurrente vinculado a deuda

```text
Usuario: pague la cuota de la laptop
DataAgent detecta pago de cuota
Recurring Engine encuentra ocurrencia
Debt Engine valida deuda vinculada
Core registra `pago_deuda`
Debt Engine reduce saldo
```

### 19.10 Recurrente vinculado a caja

```text
Usuario: pague internet con mi caja servicios
Core crea movimiento
Balance Engine reduce cuenta/caja segun origen
Recurring Engine marca ocurrencia pagada
```

---

## 20. Dashboard

La pantalla Recurrentes debe permitir:

- ver activos,
- ver proximos,
- ver vencidos,
- ver sugeridos,
- crear manualmente,
- editar,
- pausar/cancelar,
- marcar pagado,
- vincular a caja/deuda,
- ver historial por recurrente.

### 20.1 Naming visible

La UI no debe titular esta experiencia como "Recurrentes" salvo en zonas tecnicas/admin. El label recomendado es:

```text
Compromisos
  - Pagos que vienen
  - Cuotas
  - Sugeridos
```

Si la pantalla solo muestra pagos periodicos y no deudas/cuotas, usar:

```text
Pagos que vienen
```

### 20.2 Vista de lista

Cada item muestra:

| Campo | Ejemplo |
|---|---|
| Nombre | Internet |
| Monto | S/89 o ~S/80-100 |
| Proxima fecha | 12-15 junio |
| Estado | Activo, proximo, vencido, sugerido |
| Vinculo | Caja Servicios, Deuda Laptop |
| Fuente | Manual, patron, email |

### 20.3 Vista detalle

Debe mostrar:

- condiciones del recurrente,
- ocurrencia actual,
- pagos anteriores,
- monto anterior vs actual,
- movimientos vinculados,
- caja/deuda vinculada,
- fuente de deteccion,
- acciones disponibles.

### 20.4 Pendientes

Recurrentes sugeridos y pagos detectados por email entran a Pendientes si requieren aprobacion.

---

## 21. WhatsApp

### 21.1 Comandos naturales

| Mensaje | Resultado esperado |
|---|---|
| "cada mes pago Netflix 25" | Crear recurrente activo si hay datos suficientes. |
| "pague Netflix" | Marcar ocurrencia actual como pagada. |
| "ya no pago Netflix" | Cancelar recurrente. |
| "pausa gimnasio este mes" | Saltar o pausar segun contexto. |
| "que pagos vienen?" | Consultar proximos recurrentes/deudas. |
| "cuanto tengo comprometido este mes?" | Sumar recurrentes/deudas no pagados. |
| "eso no era Netflix, era Disney" | CorrectionAgent actualiza vinculo/patron. |

### 21.2 Confirmaciones compactas

Para un recurrente claro:

```text
Listo. Marque Netflix como pagado por S/25.
```

Para un recurrente ambiguo:

```text
Tengo dos parecidos: Netflix S/25 y Disney S/27. ¿Cual pagaste?
```

Para deteccion:

```text
Netflix aparece cerca de esta fecha por 3 meses. ¿Lo marco como recurrente?
```

---

## 22. Contratos de datos

### 22.1 Tipos

```ts
type RecurringStatus =
  | "suggested"
  | "active"
  | "paused"
  | "cancelled"
  | "archived";

type RecurringFrequency =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "yearly"
  | "custom_window";

type RecurringAmountType =
  | "fixed"
  | "variable"
  | "estimated";

type RecurringSource =
  | "whatsapp"
  | "dashboard"
  | "pattern_detection"
  | "email_confirmed"
  | "manual_import";

type RecurringOccurrenceStatus =
  | "expected"
  | "due_soon"
  | "pending_confirmation"
  | "paid"
  | "skipped"
  | "overdue"
  | "rejected";
```

### 22.2 RecurringRule

```ts
type RecurringRule = {
  id: string;
  user_id: string;
  name: string;
  merchant_normalized: string | null;
  description_pattern: string | null;
  status: RecurringStatus;
  frequency: RecurringFrequency;
  interval: number;
  amount_type: RecurringAmountType;
  expected_amount: number | null;
  min_amount: number | null;
  max_amount: number | null;
  currency: string;
  expected_day_of_month: number | null;
  date_window_start_day: number | null;
  date_window_end_day: number | null;
  next_expected_date: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  tag_ids: string[];
  default_account_id: string | null;
  linked_box_id: string | null;
  linked_debt_id: string | null;
  source: RecurringSource;
  confidence: number;
  requires_confirmation_for_payment: boolean;
  last_paid_at: string | null;
  last_paid_amount: number | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
};
```

### 22.3 RecurringOccurrence

```ts
type RecurringOccurrence = {
  id: string;
  recurring_rule_id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  expected_date: string | null;
  expected_window_start: string | null;
  expected_window_end: string | null;
  expected_amount: number | null;
  status: RecurringOccurrenceStatus;
  matched_movement_id: string | null;
  pending_id: string | null;
  paid_at: string | null;
  paid_amount: number | null;
  amount_variance: number | null;
  account_id: string | null;
  box_id: string | null;
  debt_id: string | null;
  created_at: string;
  updated_at: string;
};
```

### 22.4 RecurringCandidate

```ts
type RecurringCandidate = {
  id: string;
  user_id: string;
  merchant_normalized: string | null;
  display_name: string;
  evidence_movement_ids: string[];
  evidence_email_ids: string[];
  inferred_frequency: RecurringFrequency;
  inferred_amount_type: RecurringAmountType;
  inferred_amount: number | null;
  inferred_min_amount: number | null;
  inferred_max_amount: number | null;
  inferred_date_window_start_day: number | null;
  inferred_date_window_end_day: number | null;
  confidence: number;
  evidence_summary: string;
  status:
    | "candidate"
    | "ready_to_suggest"
    | "suggested"
    | "confirmed"
    | "dismissed"
    | "expired";
  created_at: string;
  updated_at: string;
};
```

---

## 23. Eventos internos

Eventos emitidos desde `transactional_outbox`:

```text
recurring_candidate_detected
recurring_candidate_suggested
recurring_confirmed
recurring_updated
recurring_paused
recurring_cancelled
recurring_occurrence_created
recurring_occurrence_due_soon
recurring_occurrence_overdue
recurring_payment_pending_confirmation
recurring_payment_confirmed
recurring_payment_matched
recurring_amount_changed
recurring_linked_to_box
recurring_linked_to_debt
recurring_skipped
```

Compatibilidad conceptual con nombres anteriores:

```text
recurrente_detectado -> recurring_candidate_detected
cuota_proxima -> recurring_occurrence_due_soon o debt_due_soon
```

---

## 24. Politicas de riesgo y privacidad

Son sensibles:

- pagos medicos,
- deudas,
- apuestas,
- compras personales delicadas,
- terapia/salud,
- servicios que podrian exponer vida privada.

Reglas:

- No enviar detalle sensible por WhatsApp proactivo sin opt-in claro.
- Con modo discreto, ocultar monto, comercio y categoria sensible.
- No inferir comportamiento personal desde el recurrente.
- No decir "estas atrasado" si el sistema no tiene confianza suficiente.
- No insistir si el usuario ignoro o pauso avisos.

Copy seguro:

```text
Tienes un pago recurrente sensible cerca. ¿Quieres revisarlo?
```

Copy no seguro:

```text
Tu pago de terapia de S/180 vence mañana.
```

---

## 25. Edge cases

| Caso | Regla V1 |
|---|---|
| Merchant cambio de nombre | Mantener candidato, pedir confirmacion si baja confianza. |
| Dos recurrentes mismo monto | Preguntar antes de marcar pagado. |
| Email duplicado | Dedup Engine evita doble pendiente. |
| Pago manual + email posterior | Dedup compara monto/fecha/merchant y sugiere resolver. |
| Monto subio | Preguntar si actualizar monto esperado. |
| Monto bajo una vez | Marcar pago, no actualizar regla automaticamente. |
| Recurrente anual | Crear ocurrencia anual; evitar nudges frecuentes. |
| Pago adelantado | Permitir marcar ocurrencia futura como pagada. |
| Pago tardio | Vincular a ocurrencia vencida si esta dentro de ventana razonable. |
| Usuario cancela | No borrar historial; estado `cancelled`. |
| Usuario pausa | No generar ocurrencias durante pausa. |
| Cuenta null | Pago valido, saldo por cuenta no cambia. |
| Caja sin fondos | Mostrar faltante en dinero libre operativo. |
| Deuda vinculada cerrada | Sugerir cancelar o desvincular recurrente. |

---

## 26. Metricas

| Metrica | Objetivo |
|---|---|
| Recurring detection precision | Reducir falsos positivos. |
| Candidate confirmation rate | Medir calidad de sugerencias. |
| False recurring dismissal rate | Detectar patrones mal agrupados. |
| Payment match accuracy | Medir vinculo pago/ocurrencia. |
| Overdue false positive rate | Evitar avisos incorrectos. |
| Amount change confirmation rate | Saber si cambios detectados son reales. |
| Manual recurring creation rate | Medir valor percibido. |
| Recurring-linked free money usage | Medir impacto en claridad financiera. |
| Nudge opt-out after recurring alerts | Detectar molestia. |

---

## 27. Escenarios de prueba

### Escenario 1: crear recurrente manual

Mensaje:

```text
cada mes pago internet 89 entre el 12 y 15
```

Resultado:

- crear recurrente activo,
- monto fijo S/89,
- ventana 12-15,
- proxima ocurrencia calculada.

### Escenario 2: detectar Netflix

Netflix aparece 3 meses seguidos con monto similar.

Resultado:

- crear candidato,
- sugerir marcar recurrente,
- no activar sin confirmacion.

### Escenario 3: email de recurrente

Email detecta cargo de Netflix que coincide con recurrente activo.

Resultado:

- crear pendiente de confirmacion,
- no crear movimiento automaticamente,
- al confirmar, marcar ocurrencia pagada.

### Escenario 4: cambio de monto

Spotify esperado S/18, cargo detectado S/22.

Resultado:

- preguntar si actualizar monto esperado,
- permitir marcar solo este pago.

### Escenario 5: pago de deuda recurrente

Usuario:

```text
pague la cuota de la laptop
```

Resultado:

- vincular ocurrencia,
- crear `pago_deuda` si existe deuda vinculada,
- Debt Engine reduce saldo,
- no contar como gasto generico.

### Escenario 6: recurrente cubierto por caja

Internet S/89 tiene caja Servicios con S/100.

Resultado:

- dinero libre operativo no descuenta dos veces,
- al pagar, se reduce caja.

### Escenario 7: cuenta desconocida

Usuario:

```text
pague Netflix
```

No se conoce cuenta.

Resultado:

- marcar pagado con `account_id = null`,
- no actualizar saldo por cuenta,
- sugerir cuenta despues si aporta valor.

### Escenario 8: ya no pago

Usuario:

```text
ya no pago Netflix
```

Resultado:

- estado `cancelled`,
- no crear proximas ocurrencias,
- historial queda.

### Escenario 9: vencido

Internet se esperaba entre 12-15 y hoy es 18.

Resultado:

- ocurrencia `overdue`,
- nudge solo si opt-in y politica lo permite,
- Dashboard muestra vencido.

### Escenario 10: dos recurrentes parecidos

Usuario:

```text
pague streaming
```

Tiene Netflix y Disney.

Resultado:

- preguntar cual,
- no marcar ambos.

### Escenario 11: usuario solo con recurrentes

Usuario no registra gastos diarios, solo alquiler e internet.

Resultado:

- Dashboard muestra compromisos/proximos,
- dinero libre operativo puede calcularse si hay cuenta/cajas,
- no exigir categorias ni insights de consumo.

### Escenario 12: pago adelantado

Usuario paga alquiler del proximo mes antes de fecha.

Resultado:

- vincular a ocurrencia futura,
- no marcar como overdue cuando llegue la fecha.

---

## 27.1 Estado de implementacion tecnica

Estado al 19 de julio de 2026: dominio, detector deterministico y capa agentic
de enriquecimiento implementados; activacion de recurrentes sigue requiriendo
confirmacion humana.

Flujo implementado:

```text
movimientos confirmados
  -> RecurringDetector
  -> candidato con evidencia, monto, intervalo, frecuencia y fecha esperada
  -> RecurringSignalAgent opcional
  -> validadores de evidencia
  -> candidato sugerido
  -> confirmacion del usuario
  -> regla recurrente activa
```

`RecurringSignalAgent` puede:

- mejorar el nombre visible usando tokens presentes en la evidencia;
- redactar una explicacion breve del patron;
- marcar sensibilidad o recomendar cautela;
- hacer que un candidato requiera mas revision.

`RecurringSignalAgent` no puede:

- cambiar montos, fechas, frecuencia o intervalo calculados;
- inventar comercios, cuentas o movimientos;
- subir un candidato a regla activa;
- registrar un pago o modificar saldos;
- eliminar la confirmacion requerida.

La salida del agente se descarta si introduce numeros no presentes en la
evidencia, un nombre sin relacion con las muestras o claves fuera del contrato.
En ese caso se conserva el candidato deterministico sin perder el flujo.

Pendiente operativo:

- activar el provider API del agente solo despues de evaluar precision y costo;
- validar la migracion y el job en staging junto con el nuevo corte;
- ampliar QA con comercios peruanos, montos variables y patrones estacionales.

---

## 28. Criterios de aceptacion

- Recurrente esperado no modifica saldo de cuenta hasta pago confirmado.
- Email no registra pago recurrente sin aprobacion del usuario en V1.
- Deteccion automatica crea candidatos, no recurrentes activos.
- Recurrentes activos aportan a dinero libre operativo sin doble descuento por cajas.
- `pago_recurrente` se crea solo cuando hay pago real/confirmado.
- Recurrente vinculado a deuda actualiza Debt Engine y no se muestra como gasto generico.
- Recurrente puede existir con cuenta `null`.
- Hay estados claros para regla, ocurrencia y candidato.
- Hay contratos de datos minimos.
- Hay eventos internos para deteccion, confirmacion, pago, cambios y vencimientos.
- Nudges respetan opt-in, horario silencioso, frecuencia y modo discreto.
- Dashboard permite ver activos, proximos, vencidos y sugeridos.
- Usuario puede pausar, cancelar, saltar periodo y editar.
- Cambios de monto se muestran explicitamente.
- Duplicados entre WhatsApp, email y Dashboard pasan por Dedup Engine.
- Uso parcial es valido: un usuario puede usar solo recurrentes.

---

*Feature 11/13 del Paso 5 - V2.1*
