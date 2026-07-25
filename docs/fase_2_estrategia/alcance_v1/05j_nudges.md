# Feature 12: Nudges Inteligentes / Recordatorios

**Parte del Paso 5/20 - Alcance V1.0**  
**Prioridad:** P2  
**Estado:** V2.1 - Especificacion avanzada y worker multicanal sincronizado  
**Ultima actualizacion:** 19 de julio, 2026

---

## 1. Tesis

Nudges es el sistema de recordatorios proactivos de Manzana.

Su objetivo no es aumentar mensajes por aumentar mensajes. Su objetivo es ayudar al usuario a:

- no olvidar pagos importantes,
- reconstruir gastos cuando se le paso registrar,
- revisar pendientes sin saturarse,
- recibir claridad cuando algo cambio,
- y mantener sensacion de control sin culpa.

Principio central:

> Un buen nudge se siente como una ayuda oportuna. Un mal nudge se siente como persecucion.

Por eso, los nudges deben ser pocos, consentidos, contextuales, discretos cuando haga falta y faciles de pausar.

---

## 2. Lenguaje de producto

`Nudge` es el nombre tecnico interno. Frente al usuario, usar lenguaje mas claro:

| Capa | Nombre recomendado | Uso |
|---|---|---|
| Codigo / arquitectura | `Nudge`, `NudgePolicyEngine`, `NudgeCandidate` | Precision tecnica. |
| Dashboard configuracion | **Recordatorios** | Nombre claro y familiar. |
| WhatsApp | "te aviso", "recordatorio", "quieres que te avise" | Conversacion natural. |
| Insights | "puedo avisarte si vuelve a pasar" | Accion opcional. |
| Deudas/recurrentes | "avisos de pagos" | Evita sonar tecnico. |

Regla:

> El usuario no debe sentir que Manzana lo empuja. Debe sentir que Manzana le pregunta como quiere ser acompanado.

Ejemplo:

```text
¿Quieres que te avise cuando se acerque este pago?
```

Mejor que:

```text
Activar nudge de recurrente.
```

---

## 3. Que es y que no es un nudge

### 3.1 Es un nudge

Un mensaje proactivo, no solicitado en ese momento, que Manzana decide enviar para ayudar.

Ejemplos:

- "Tu internet suele pagarse entre hoy y el viernes. ¿Quieres revisarlo?"
- "Ayer no registraste nada. ¿Hubo algun gasto que se te paso?"
- "Tu semana ya esta lista. Hay un cambio que puede servirte."

### 3.2 No es un nudge

No son nudges:

- una respuesta directa a una pregunta del usuario,
- una confirmacion inmediata de una accion que el usuario acaba de hacer,
- una aclaracion dentro de la misma conversacion,
- un pendiente transaccional obligatorio para completar una accion.

Ejemplo:

```text
Usuario: pague internet
Manzana: Listo, lo marque como pagado.
```

Eso es respuesta, no nudge.

### 3.3 Confirmaciones transaccionales

Algunos mensajes proactivos son necesarios para confirmar datos detectados, por ejemplo email parsing. En V1 se tratan como `transactional_prompt`, no como nudge de marketing.

Regla:

> Aunque no sean nudges de engagement, tambien deben respetar horario silencioso, modo discreto, batch/rate limiting y privacidad.

---

## 4. Principios

| # | Principio | Implicacion |
|---|---|---|
| 1 | Consentimiento primero | No enviar mensajes proactivos sin opt-in aplicable. |
| 2 | Utilidad sobre engagement | No buscar abrir WhatsApp si no hay ayuda real. |
| 3 | El usuario manda | Pausar, reducir, cambiar o cancelar debe ser facil. |
| 4 | Pocos y buenos | Mejor 1 aviso util que 5 mensajes medianos. |
| 5 | Contexto antes que calendario | No enviar si el usuario ya actuo o ya registro suficiente. |
| 6 | Discrecion por defecto cuando hay riesgo | Si puede exponer informacion sensible, ocultar o no enviar. |
| 7 | No todos los insights son nudges | Dashboard puede guardar informacion sin interrumpir al usuario. |
| 8 | No castigar | Evitar culpa, presion o tono escolar. |
| 9 | Medir molestia | Opt-outs, pausas e ignorados son senales de producto. |
| 10 | Determinismo en la decision | `NudgePolicyEngine` decide si/cuando enviar; agentes solo redactan. |

---

## 5. Alcance V1

### 5.1 Incluido

- Opt-in granular por tipo de recordatorio.
- Pausar, reanudar y cancelar recordatorios.
- Horario silencioso.
- Frecuencia maxima diaria/semanal.
- Modo discreto para mensajes proactivos.
- Priorizacion cuando varios nudges compiten.
- Recordatorios de pagos que vienen.
- Recordatorios de deudas/cuotas.
- Reconstruccion suave si el usuario no registro.
- Resumen/insight semanal si hay opt-in.
- Alertas de cambio o anomalia solo si pasan calidad/politica.
- Recordatorios de pendientes de email en batch.
- Re-engagement respetuoso para usuarios inactivos.
- Eventos y metricas de entrega/respuesta/pausa.

### 5.2 Fuera de V1

- Push notifications nativas fuera de WhatsApp.
- Notificaciones por SMS.
- Recordatorios a terceros.
- Campanas comerciales.
- Automatizaciones de marketing no financieras.
- Modelos predictivos agresivos de comportamiento.
- Nudges basados en comparaciones sociales.
- Escalamiento infinito de recordatorios.

---

## 6. Tipos de nudge V1

| Tipo interno | Nombre usuario | Ejemplo | Canal principal |
|---|---|---|---|
| `daily_reconstruction` | Revisión del día | "¿Hubo algun gasto que se te paso hoy?" | WhatsApp |
| `missing_activity` | Recordatorio suave | "Hace unos dias que no registras. ¿Quieres reconstruir algo rapido?" | WhatsApp |
| `payment_due` | Pago que viene | "Tu internet suele pagarse esta semana." | WhatsApp/Dashboard |
| `debt_due` | Cuota próxima | "Tienes una cuota próxima. ¿Quieres verla?" | WhatsApp/Dashboard |
| `overdue_payment` | Pago vencido | "Hay un compromiso que parece pendiente." | WhatsApp/Dashboard |
| `pending_review` | Pendientes por revisar | "Tienes 3 movimientos detectados para confirmar." | WhatsApp/Dashboard |
| `weekly_review` | Semana en claro | "Tu semana ya esta lista." | WhatsApp/Dashboard |
| `insight_prompt` | Descubrimiento | "Hay un cambio que puede servirte ver." | WhatsApp/Dashboard |
| `anomaly_alert` | Cambio inusual | "Algo cambio fuerte esta semana." | WhatsApp/Dashboard |
| `progress_positive` | Progreso | "Llevas 3 cuotas seguidas a tiempo." | WhatsApp/Dashboard |
| `budget_goal` | Limite/meta | Solo si existe meta configurada. | WhatsApp/Dashboard |
| `reengagement` | Volver sin friccion | "¿Quieres que reconstruyamos esta semana en 1 minuto?" | WhatsApp |

---

## 7. Nudge Policy Engine

`NudgePolicyEngine` es un motor deterministico. Evalua candidatos y decide:

- enviar,
- diferir,
- agrupar,
- degradar a Dashboard,
- descartar,
- pedir permiso,
- o pausar.

El LLM no decide libremente enviar nudges.

### 7.1 Pipeline

```text
Domain event / Scheduler / Insight
  -> NudgeCandidate
  -> NudgePolicyEngine
  -> PolicyGate / Risk Policy / Discreet Mode
  -> ResponseAgent o plantilla
  -> Delivery Adapter
  -> NudgeDelivery
  -> Metrics + Learning
```

### 7.2 Gates obligatorios

| Gate | Pregunta |
|---|---|
| Consentimiento | ¿El usuario acepto este tipo de aviso? |
| Horario | ¿Estamos fuera de horario silencioso? |
| Frecuencia | ¿No excede maximos diarios/semanales? |
| Relevancia | ¿Sigue siendo util o ya se resolvio? |
| Duplicados | ¿Ya se envio algo similar? |
| Prioridad | ¿Hay otro aviso mas importante compitiendo? |
| Sensibilidad | ¿Puede exponer deuda, monto, persona, comercio o categoria sensible? |
| Modo discreto | ¿Debe ocultar detalles? |
| Actividad reciente | ¿El usuario ya actuo o registro suficiente hoy? |
| Calidad de datos | ¿La fuente es confirmada o solo sospecha? |

Si un gate falla, no se envia tal cual.

---

## 8. Preferencias y consentimiento

### 8.1 Opt-in granular

| Tipo de recordatorio | Default V1 | Configurable |
|---|---|---|
| Confirmaciones transaccionales de email | Activo | No desactivar completo; si pausar canal/batch. |
| Pagos que vienen | Activado con onboarding | Si |
| Deudas/cuotas | Activado con onboarding | Si |
| Resumen semanal | Activado con onboarding | Si |
| Reconstruccion diaria | Activado con onboarding | Si |
| Alertas de gasto inusual | Activado con onboarding | Si |
| Insights puntuales | Activado con onboarding | Si |
| Progreso/motivacion | Desactivado por defecto | Si |
| Re-engagement | Activado con baja frecuencia | Si |
| Metas/limites | Solo si feature/meta existe | Si |

Regla de canal:

- Una tarjeta pasiva dentro del Dashboard autenticado puede estar visible por defecto y ser desactivable.
- Ese default interno no constituye opt-in para WhatsApp o email.
- Cualquier salida proactiva externa sigue requiriendo consentimiento explicito, Nudge Policy y controles de privacidad.

### 8.2 Comandos naturales

| Usuario dice | Resultado |
|---|---|
| "pausa recordatorios" | Preguntar duracion o pausar default. |
| "pausa todo una semana" | Pausar nudges no transaccionales por 7 dias. |
| "solo avisame de cuotas" | Desactivar otros tipos, mantener deudas/cuotas. |
| "no me escribas de noche" | Configurar horario silencioso. |
| "no me mandes mas mensajes" | Pausar proactivos, mantener confirmaciones criticas en modo minimo. |
| "avisame de mis pagos" | Activar pagos que vienen/deudas. |
| "modo discreto" | Activar salida proactiva sin detalles sensibles. |

### 8.3 Pausas

Duraciones V1:

- hasta mañana,
- esta semana,
- 7 dias,
- 30 dias,
- hasta que yo te diga.

Durante pausa:

- no enviar nudges de engagement,
- no enviar insights proactivos,
- no enviar reconstrucciones,
- mantener confirmaciones transaccionales necesarias en batch/discreto,
- mantener respuestas a mensajes iniciados por el usuario.

---

## 9. Horario silencioso

Default V1:

```text
22:00 - 08:00
```

Reglas:

- No enviar mensajes proactivos durante horario silencioso.
- Diferir al siguiente bloque permitido si sigue siendo relevante.
- Si al despertar hay varios avisos, agrupar.
- El usuario puede cambiarlo.
- El horario silencioso no aplica igual a respuestas iniciadas por el usuario.

Ejemplo:

```text
Usuario: no me escribas despues de las 10pm
Manzana: Listo. No te escribire entre 10pm y 8am.
```

---

## 10. Frecuencia y anti-spam

### 10.1 Limites globales V1

| Regla | Limite |
|---|---|
| Nudges no solicitados por dia | Maximo 2. |
| Nudges sensibles por dia | Maximo 1, solo si permitido. |
| Insights por WhatsApp puntual | Maximo 1/dia. |
| Resumen semanal | Maximo 1/semana. |
| Re-engagement | Maximo 1 cada 7 dias despues de inactividad. |
| Recordatorio mismo pago/cuota | Maximo 2 por ocurrencia: antes y despues. |
| Reconstruccion diaria | Maximo 1/dia, y no si ya registro suficiente. |

### 10.2 Competencia entre nudges

Si varios candidatos compiten, prioridad:

1. Confirmacion transaccional necesaria agrupada.
2. Pago/deuda vencida o proxima.
3. Pendientes de email importantes.
4. Insight sensible solo si permitido.
5. Resumen semanal.
6. Reconstruccion diaria.
7. Progreso/motivacion.
8. Re-engagement.

Regla:

> Si hay duda entre interrumpir o guardar en Dashboard, guardar en Dashboard.

### 10.3 Supresion por actividad

No enviar reconstruccion diaria si:

- usuario ya registro 2+ movimientos hoy,
- usuario tuvo conversacion financiera reciente,
- usuario acaba de corregir/confirmar pendientes,
- usuario pauso este tipo de aviso,
- historial muestra que ignora ese horario.

### 10.4 Estrategia de ventana WhatsApp

Nudge Policy no debe optimizar solo costo. Debe optimizar utilidad, momento y respeto.

Regla:

```text
Si la ventana de 24h esta abierta:
  WhatsApp puede resolver con conversacion, Flow o mensaje libre.

Si la ventana esta por cerrar:
  Preferir continuidad a las 12h si hay algo accionable.
  Usar 20h solo como prompt opcional, no default, si el valor lo justifica.

Si la ventana esta cerrada:
  Usar template utility solo si abre claridad o accion.
  No usar template pagado para insistir sobre algo ya ignorado.
```

Casos:

| Caso | Decision |
|---|---|
| Pendiente unico importante | Puede enviar template utility. |
| Segundo pendiente sin respuesta | Enviar mensaje acumulativo + Centro de Confirmaciones. |
| Mas pendientes sin respuesta | Guardar en app/Dashboard; no enviar uno por uno. |
| Varios pendientes dentro de ventana | Usar WhatsApp Flow o Centro de Confirmaciones. |
| Insight con alto potencial de claridad | Puede ir por WhatsApp si pasa policy y no es sensible. |
| Insight interesante pero exploratorio | Dashboard/app, posible resumen posterior. |
| Pago o deuda proxima | WhatsApp si opt-in, timing y privacidad lo permiten. |
| Re-engagement sin accion concreta | No enviar o bajar frecuencia. |

El objetivo no es "hacer hablar al usuario" por costo. El objetivo es darle una accion util que, si responde, permite continuar la ayuda por WhatsApp sin friccion.

---

## 11. Modo discreto y privacidad

Modo discreto aplica a cualquier mensaje proactivo.

No exponer:

- montos,
- comercios,
- bancos/cuentas,
- saldos,
- deudas especificas,
- nombres de personas,
- categorias sensibles,
- inferencias personales.

### 11.1 Ejemplos

Normal:

```text
Tu cuota de tarjeta BCP por S/180 vence mañana.
```

Discreto:

```text
Tienes un compromiso financiero proximo. ¿Quieres verlo?
```

Normal:

```text
Netflix parece haber subido de S/25.90 a S/29.90.
```

Discreto:

```text
Un pago que viene parece haber cambiado. ¿Quieres revisarlo?
```

### 11.2 Sensibilidad alta

Para deuda, salud, apuestas, persona relacionada o compra delicada:

- preferir Dashboard,
- usar copy generico,
- no enviar si no hay opt-in claro,
- no repetir si el usuario ignoro.

---

## 12. Calidad del nudge

Un nudge debe tener:

- motivo claro,
- accion simple,
- bajo costo mental,
- evidencia suficiente,
- permiso aplicable,
- tono amable,
- salida facil.

Formula:

```text
[Motivo breve] + [accion opcional] + [control del usuario]
```

Ejemplo:

```text
Tu internet suele pagarse esta semana. ¿Quieres marcarlo si ya lo pagaste?
```

No usar:

- "te olvidaste",
- "deberias",
- "estas atrasado" sin certeza,
- "otra vez",
- "mal",
- "urgente" si no lo es,
- manipular rachas.

Preferir:

- "parece",
- "suele",
- "si quieres",
- "puedo recordarlo",
- "lo dejamos pausado",
- "puedes cambiarlo cuando quieras".

---

## 13. Motores y agentes

### 13.1 Motores

| Motor | Rol |
|---|---|
| NudgePolicyEngine | Decide si/cuando/como enviar o diferir. |
| RiskPolicy | Evalua privacidad, sensibilidad y confirmacion. |
| DisclosureEngine | Define que detalles se pueden mostrar. |
| Debt Engine | Genera candidatos de cuota proxima/vencida. |
| Recurring Engine | Genera candidatos de pagos que vienen. |
| Insights Engine | Genera candidatos de insight si pasan QualityGate. |
| Pending Inbox | Agrupa pendientes de email/revision. |
| Learning Engine | Ajusta horarios, tipos ignorados y preferencias inferidas. |

### 13.2 Agentes

| Agente | Rol |
|---|---|
| ResponseAgent | Redacta el texto final si no basta una plantilla. |
| InsightNarratorAgent | Redacta insight que puede convertirse en nudge. |
| InsightExperienceAgent | Decide framing/timing de insights sensibles o con potencial wow. |
| ConversationAgent | Responde cuando el usuario contesta al nudge. |
| CorrectionAgent | Interpreta "eso no era", "ya lo pague", "no me recuerdes esto". |

No existe un `NudgeAgent` en V1. La decision de interrumpir al usuario es una politica deterministica, no una ocurrencia creativa del LLM.

---

## 14. Contexto necesario

`NudgeContextPack` incluye:

- motivo del nudge,
- tipo de nudge,
- opt-in aplicable,
- horario silencioso,
- frecuencia diaria/semanal,
- historial de nudges similares,
- canal,
- modo discreto,
- sensibilidad,
- accion sugerida,
- dato minimo permitido para mostrar,
- estado de la entidad vinculada: deuda, recurrente, insight, pendiente o movimiento.

No incluye:

- historial financiero completo,
- razonamiento interno crudo,
- datos sensibles que no se mostraran,
- mensajes antiguos no relevantes.

---

## 15. Flujos principales

### 15.1 Recordatorio de pago que viene

```text
Recurring Engine crea ocurrencia due_soon
  -> NudgeCandidate payment_due
  -> NudgePolicyEngine valida opt-in, horario, frecuencia
  -> RiskPolicy revisa sensibilidad
  -> ResponseAgent/plantilla redacta
  -> WhatsApp envia o Dashboard guarda
```

Mensaje:

```text
Tu internet suele pagarse esta semana. ¿Quieres marcarlo si ya lo pagaste?
```

### 15.2 Cuota de deuda proxima

```text
Debt Engine detecta cuota proxima
  -> NudgePolicyEngine
  -> modo discreto si aplica
  -> envio o Dashboard
```

Normal:

```text
Tu cuota de laptop vence en 2 dias. ¿Quieres verla?
```

Discreto:

```text
Tienes un compromiso financiero proximo. ¿Quieres verlo?
```

### 15.3 Reconstruccion diaria

```text
Scheduler nocturno
  -> revisa actividad del dia
  -> si no registro o hay huecos probables
  -> NudgePolicyEngine decide
```

Mensaje:

```text
¿Hubo algun gasto de hoy que quieras anotar rapido?
```

No enviar si el usuario ya registro suficiente o suele no responder a esa hora.

### 15.4 Pendientes de email en batch

```text
Pending Inbox tiene 5 emails sin confirmar
  -> agrupar
  -> respetar horario silencioso
  -> enviar resumen breve
```

Mensaje:

```text
Tengo 5 movimientos detectados para revisar. ¿Quieres verlos juntos?
```

No enviar 5 mensajes separados.

### 15.5 Insight semanal

```text
Insights Engine valida insight/resumen
  -> NudgeCandidate weekly_review
  -> NudgePolicyEngine revisa opt-in y frecuencia
  -> ResponseAgent redacta version permitida
```

Mensaje:

```text
Tu semana ya esta lista. Hay un cambio que puede servirte ver.
```

### 15.6 Alerta de anomalia o cambio

Solo si:

- dato confirmado,
- cambio material,
- no sensible o permitido,
- no repetitivo,
- accion posible.

Mensaje:

```text
Hay un gasto que salio de tu patron normal. ¿Quieres revisarlo?
```

### 15.7 Progreso positivo

Default desactivado salvo opt-in o contexto claro.

Mensaje:

```text
Llevas 3 cuotas seguidas a tiempo. Buen ritmo.
```

Debe reforzar control, no gamificar de forma infantil.

### 15.8 Re-engagement

Para usuario inactivo:

```text
Hace unos dias que no usamos Manzana. Si quieres, reconstruimos esta semana en 1 minuto.
```

Reglas:

- baja frecuencia,
- no culpar,
- no preguntar "todo bien?" si puede sentirse invasivo,
- ofrecer accion concreta.

### 15.9 Pausar desde respuesta

```text
Usuario: pausa estos avisos
NudgePolicyEngine actualiza preferencias
ResponseAgent confirma
```

Respuesta:

```text
Listo. Pauso estos recordatorios por 7 dias. Puedes reactivarlos cuando quieras.
```

---

## 16. Dashboard y configuracion

### 16.1 Configuracion de Recordatorios

Debe permitir:

- activar/desactivar por tipo,
- elegir horario silencioso,
- elegir frecuencia maxima,
- pausar temporalmente,
- activar modo discreto,
- ver que esta pausado,
- reactivar facil,
- entender que confirmaciones transaccionales pueden seguir en modo minimo.

### 16.2 Dashboard Home

Dashboard puede mostrar avisos no enviados por WhatsApp:

- pendientes por revisar,
- pagos proximos,
- cuotas vencidas,
- insights guardados,
- sugerencias de configuracion.

Regla:

> No todo lo importante debe interrumpir por WhatsApp. Muchas cosas viven mejor en Dashboard.

---

## 17. Contratos de datos

### 17.1 Enums

```ts
type NudgeType =
  | "daily_reconstruction"
  | "missing_activity"
  | "payment_due"
  | "debt_due"
  | "overdue_payment"
  | "pending_review"
  | "weekly_review"
  | "insight_prompt"
  | "anomaly_alert"
  | "progress_positive"
  | "budget_goal"
  | "reengagement";

type NudgeStatus =
  | "candidate"
  | "approved"
  | "deferred"
  | "rejected"
  | "scheduled"
  | "sent"
  | "delivered"
  | "responded"
  | "acted"
  | "dismissed"
  | "expired";

type NudgeChannel =
  | "whatsapp"
  | "dashboard"
  | "email";

type NudgeRejectReason =
  | "no_opt_in"
  | "quiet_hours"
  | "rate_limited"
  | "low_relevance"
  | "duplicate"
  | "sensitive"
  | "already_resolved"
  | "competing_priority"
  | "paused"
  | "insufficient_data";
```

### 17.2 NudgePreference

```ts
type NudgePreference = {
  user_id: string;
  type: NudgeType;
  enabled: boolean;
  channel: NudgeChannel[];
  max_per_day: number | null;
  max_per_week: number | null;
  quiet_hours_start: string;
  quiet_hours_end: string;
  discreet_mode_required: boolean;
  paused_until: string | null;
  created_at: string;
  updated_at: string;
};
```

### 17.3 NudgeCandidate

```ts
type NudgeCandidate = {
  id: string;
  user_id: string;
  type: NudgeType;
  source:
    | "scheduler"
    | "debt_engine"
    | "recurring_engine"
    | "insights_engine"
    | "pending_inbox"
    | "budget_goal_reactor";
  entity_type:
    | "movement"
    | "debt"
    | "recurring"
    | "insight"
    | "pending"
    | "budget_goal"
    | "global";
  entity_id: string | null;
  priority_score: number;
  relevance_score: number;
  sensitivity: "low" | "medium" | "high";
  evidence_summary: string;
  suggested_action: string | null;
  expires_at: string | null;
  created_at: string;
};
```

### 17.4 NudgeDecision

```ts
type NudgeDecision = {
  candidate_id: string;
  decision: "send" | "defer" | "dashboard_only" | "reject";
  channel: NudgeChannel | null;
  scheduled_for: string | null;
  reject_reason: NudgeRejectReason | null;
  discreet_mode_applied: boolean;
  allowed_content_level:
    | "full"
    | "generic"
    | "minimal";
  policy_trace_id: string;
};
```

### 17.5 NudgeDelivery

```ts
type NudgeDelivery = {
  id: string;
  candidate_id: string;
  user_id: string;
  type: NudgeType;
  channel: NudgeChannel;
  status: NudgeStatus;
  sent_at: string | null;
  delivered_at: string | null;
  responded_at: string | null;
  acted_at: string | null;
  dismissed_at: string | null;
  message_template_id: string | null;
  copy_variant: string | null;
  discreet_mode_applied: boolean;
  created_at: string;
  updated_at: string;
};
```

---

## 18. Eventos internos

Eventos publicados desde `transactional_outbox` cuando aplique:

```text
nudge_candidate_created
nudge_policy_approved
nudge_policy_rejected
nudge_deferred
nudge_scheduled
nudge_sent
nudge_delivered
nudge_responded
nudge_acted
nudge_dismissed
nudge_expired
nudge_paused
nudge_resumed
nudge_preferences_updated
nudge_quiet_hours_hit
nudge_rate_limited
nudge_dashboard_only
```

---

## 19. Learning

Learning Engine puede ajustar recomendaciones, no cambiar consentimiento sin permiso.

Puede aprender:

- horario con mayor respuesta,
- tipos ignorados,
- tipos aceptados,
- frecuencia tolerada,
- preferencia por resumen vs avisos puntuales,
- necesidad de modo discreto sugerido.

No puede:

- activar un tipo desactivado,
- saltarse horario silencioso,
- enviar mas por "probabilidad de engagement",
- inferir emociones como hechos,
- convertir un no en un "probar otra vez".

---

## 20. Edge cases

| Caso | Regla V1 |
|---|---|
| Usuario respondio "stop" o "no me escribas" | Pausar proactivos y confirmar control. |
| Usuario ya registro hoy | No enviar reconstruccion diaria. |
| Muchos pendientes de email | Agrupar en batch. |
| Pago ya marcado | Cancelar nudge programado. |
| Deuda sensible | Modo discreto o Dashboard only. |
| Insight repetido | Aplicar suppression. |
| Usuario ignora 3 veces el mismo tipo | Reducir frecuencia o sugerir pausa. |
| Horario silencioso | Diferir o descartar segun caducidad. |
| Varios nudges compiten | Enviar solo el de mayor prioridad o agrupar. |
| Datos no confirmados | No enviar alerta fuerte. |
| Meta/limite no configurado | No inventar nudge de limite. |
| Canal WhatsApp falla | Reintentar segun politica o mostrar en Dashboard. |

---

## 21. Metricas

| Metrica | Objetivo |
|---|---|
| Nudges enviados sin opt-in | Debe ser 0. |
| Quiet hours violations | Debe ser 0. |
| Discreet mode violations | Debe ser 0. |
| Response post-nudge | Medir utilidad real. |
| Action post-nudge | Medir si ayudo a completar tarea. |
| Pause/opt-out rate | Medir molestia. |
| Ignore rate by type | Ajustar frecuencia y calidad. |
| Duplicate nudge rate | Evitar repeticion. |
| Dashboard-only save rate | Medir decisiones de no interrumpir. |
| Time to resolve pending after nudge | Medir eficiencia. |
| Re-engagement retention | Medir retorno sin presion. |

---

## 22. Escenarios de prueba

### Escenario 1: usuario sin opt-in

Hay cuota proxima, pero el usuario desactivo avisos de cuotas.

Resultado:

- no enviar WhatsApp,
- puede aparecer en Dashboard,
- evento `nudge_policy_rejected` con `no_opt_in`.

### Escenario 2: horario silencioso

Se detecta pendiente a las 23:10.

Resultado:

- no enviar,
- diferir a 08:00 si sigue relevante,
- si hay varios, agrupar.

### Escenario 3: modo discreto

Cuota de tarjeta S/180 vence mañana y modo discreto esta activo.

Resultado:

- mensaje generico,
- no mostrar monto, banco ni palabra sensible si aplica.

### Escenario 4: usuario ya registro suficiente

Usuario registro 3 movimientos hoy.

Resultado:

- no enviar reconstruccion diaria.

### Escenario 5: muchos emails pendientes

Hay 7 emails detectados.

Resultado:

- enviar un solo batch,
- no 7 mensajes.

### Escenario 6: insight sensible

Insight sobre deuda o salud.

Resultado:

- Risk Policy decide,
- probablemente Dashboard only o mensaje generico.

### Escenario 7: pago que viene ya pagado

Recurrente tenia nudge programado, pero usuario registra pago antes.

Resultado:

- cancelar nudge,
- no avisar de algo ya resuelto.

### Escenario 8: usuario pausa recordatorios

Usuario:

```text
pausa recordatorios esta semana
```

Resultado:

- pausar nudges no transaccionales por 7 dias,
- confirmar de forma breve.

### Escenario 9: varios candidatos compiten

Hay resumen semanal, cuota proxima y reconstruccion diaria.

Resultado:

- priorizar cuota proxima,
- guardar resumen en Dashboard o diferir,
- no enviar reconstruccion.

### Escenario 10: re-engagement

Usuario lleva 10 dias sin usar Manzana.

Resultado:

- enviar maximo 1 mensaje suave si opt-in permite,
- ofrecer reconstruccion rapida,
- no culpar.

### Escenario 11: meta/limite inexistente

Usuario no configuro limite de cafe, pero gasto cafe varias veces.

Resultado:

- no enviar nudge de limite,
- insight o sugerencia solo si motores lo permiten y sin inventar regla.

### Escenario 12: usuario dice "no me recuerdes cafes"

Resultado:

- actualizar preferencia granular,
- no bloquear todos los recordatorios,
- no volver a sugerir ese tipo salvo que usuario lo reactive.

---

## 22.1 Estado de implementacion tecnica

Estado al 20 de julio de 2026: evaluacion, lifecycle, Dashboard, worker
Dashboard/WhatsApp, consentimiento atomico y gate de activacion implementados.
El envio proactivo real continua apagado hasta cerrar la configuracion y el QA
operativo con una cohorte explicita.

Orden obligatorio implementado:

```text
fuente todavia vigente
  -> preferencias y opt-in granular
  -> pausas y horario silencioso
  -> limite de frecuencia y competencia
  -> ventana de WhatsApp / template permitido
  -> Risk Policy
  -> Disclosure y modo discreto
  -> decision deterministica: send | defer | dashboard_only | reject
  -> NudgeExperienceAgent opcional
  -> guard final de hechos
  -> delivery trazado
```

`NudgeExperienceAgent` solo recibe un candidato que ya paso la politica. Puede
adaptar brevedad, tono y siguiente paso; no puede decidir interrumpir, recuperar
hechos redaccionados, cambiar la fecha/monto ni convertir un `dashboard_only` en
WhatsApp.

El worker multicanal:

- revalida que recurrente, cuota, pendiente o insight siga activo;
- evita avisar sobre algo ya resuelto;
- distingue freeform dentro de ventana, template aprobado fuera de ventana y
  fallback Dashboard;
- registra candidato, decision, delivery, intento, proveedor y resultado;
- soporta modo `planned` cuando el envio esta desactivado o el proveedor no esta
  listo;
- nunca ejecuta una accion financiera.

Flags operativos:

```text
WHATSAPP_PROACTIVE_NUDGE_MODE=off | planned | pilot
WHATSAPP_PROACTIVE_NUDGE_PILOT_USER_IDS=
WHATSAPP_PROACTIVE_PAYMENT_METHOD_CONFIRMED=false
WHATSAPP_PROACTIVE_TEMPLATE_APPROVED=false
WHATSAPP_SEND_PROACTIVE_NUDGES=false
WHATSAPP_NUDGE_TEMPLATE_NAME=
WHATSAPP_NUDGE_TEMPLATE_LANGUAGE=es_PE
```

Primer contrato Utility versionado:

```text
name: manzana_compromiso_financiero_v1
language: es_PE
category: UTILITY
tipos permitidos: payment_due | overdue_payment | debt_due
body: Tienes un compromiso financiero en Manzana {{1}}.
      Puedes revisarlo con calma y privacidad.
footer: Puedes pausar estos avisos en Configuración.
button: Ver en Manzana -> https://manzana.website
```

`{{1}}` solo expresa proximidad temporal con una frase deterministica segura:
`para hoy`, `para mañana`, `para los próximos días`, `que sigue pendiente` o
`que conviene revisar`. No recibe copy libre de agentes, monto, comercio,
cuenta, deuda, persona ni URL dinamica. Un candidato de otro tipo no puede
reutilizar esta plantilla: fuera de ventana degrada a Dashboard hasta tener un
contrato Utility propio aprobado.

`off` detiene el canal, `planned` permite observar decisiones sin enviar y
`pilot` limita el envio a los UUID de la cohorte. No existe modo global en este
corte. El kill switch `WHATSAPP_SEND_PROACTIVE_NUDGES` tampoco basta por si solo:
el gate exige simultaneamente modo `pilot`, allowlist, proveedor listo, WABA,
metodo de pago atestado, template configurado y aprobado en vivo, opt-in maestro,
opt-in del tipo, telefono vinculado y horario silencioso respetado.

El consentimiento se registra o revoca de forma atomica mediante
`set_whatsapp_nudge_consent`. Aceptar mensajes transaccionales o vincular un
numero no equivale a aceptar nudges proactivos.

Readiness operacional:

```text
GET /api/internal/jobs/nudges-readiness
Authorization: Bearer <CRON_SECRET o WORKER_SECRET>
```

La ruta es solo lectura, comprueba el estado real del template en Kapso y
reporta separadamente `configuration_ready` y `sending_active`. Las metricas se
limitan a la cohorte solicitada o configurada; si no hay cohorte, no consulta ni
agrega datos globales. La tasa de falsos positivos y el costo monetario quedan
sin inventar hasta disponer de feedback etiquetado y billing conciliado.

La primera activacion exige opt-in real, template aprobado, metodo de pago,
quiet hours verificadas, modo discreto probado y una cohorte limitada. No se
activa solo porque el worker compile o el endpoint de readiness responda `200`.

Estado operativo al 2026-07-20: la plantilla existe en Meta/Kapso como
`PENDING`; el entorno esta en `planned`, sin cohorte y con kill switch apagado.
Creacion no equivale a aprobacion ni autoriza envios.

---

## 23. Criterios de aceptacion

- No se envia ningun nudge proactivo sin opt-in aplicable.
- Horario silencioso se respeta.
- Modo discreto se aplica a todo mensaje proactivo sensible.
- `NudgePolicyEngine` decide envio; agentes no deciden interrumpir.
- Hay opt-in granular por tipo.
- Usuario puede pausar, reanudar y cancelar.
- Frecuencia maxima diaria/semanal esta definida.
- Si varios nudges compiten, se prioriza o agrupa.
- No se envian nudges de datos ya resueltos.
- Email pendientes se agrupan; no se spamea.
- Insights no se envian por WhatsApp sin pasar Nudge Policy.
- Deudas y pagos sensibles no exponen detalle en proactivos discretos.
- Recurrentes/deudas pueden generar nudges solo si sus motores producen candidatos validos.
- Metas/limites solo generan nudges si existen configuradas.
- Learning puede ajustar recomendaciones, no saltarse consentimiento.
- Dashboard puede guardar avisos que no conviene enviar por WhatsApp.
- El tono evita culpa, urgencia falsa y presion.

---

*Feature 12/13 del Paso 5 - V2.1*
