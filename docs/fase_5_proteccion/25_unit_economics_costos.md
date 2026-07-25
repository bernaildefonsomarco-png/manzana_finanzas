# 25 - Unit Economics Y Costos De Calidad V1

**Estado:** V1.2 - Modelo de costos actualizado con Kapso WhatsApp V1  
**Ultima actualizacion:** 13 de junio, 2026  
**Depende de:** `24_privacidad_proteccion_datos.md`, `21_decision_whatsapp_provider.md`, `22_decision_email_provider.md`, `20_decisiones_tecnicas.md`, `05a_whatsapp.md`, `05b_motor_ia.md`, `05d_email_parsing.md`, `05g_insights.md`, `05j_nudges.md`  

---

## 1. Tesis

Manzana no debe optimizar costos bajando calidad.

Debe optimizar costos eliminando desperdicio, duplicacion, spam, IA innecesaria, mensajes mal sincronizados y procesos que no generan valor para el usuario.

La tesis:

```text
Unit economics no es gastar menos.
Es saber cuanto cuesta dar una experiencia excelente de forma sostenible.
```

El objetivo no es:

- esconder valor en el Dashboard para ahorrar WhatsApp;
- reducir inteligencia del producto;
- volver todo deterministico aunque el usuario necesite lenguaje, contexto o ayuda;
- mandar menos mensajes aunque eso rompa confianza;
- usar APIs no oficiales para evitar costos;
- limitar funciones importantes sin entender su impacto.

El objetivo si es:

- medir costo por resultado util;
- saber que funciones crean retencion, confianza y sorpresa util;
- usar WhatsApp donde mejora captura, claridad o continuidad;
- usar Dashboard/app donde conviene profundidad, detalle o revision acumulada;
- usar IA donde aumenta calidad percibida;
- usar motores deterministas donde dan exactitud, menor riesgo y menor costo;
- tomar decisiones de plan, frecuencia y runtime con datos reales.

---

## 2. Principios No Negociables

| Principio | Regla |
|---|---|
| Calidad primero | Ninguna optimizacion de costo debe romper el valor central de Manzana. |
| Costo por outcome | No medir solo costo por mensaje o token; medir costo por movimiento confirmado, pendiente resuelto, insight util y usuario retenido. |
| WhatsApp sigue siendo principal | El canal conversacional no se degrada a "notificador barato". |
| Dashboard complementa | Dashboard sirve para detalle, revision, confirmaciones agrupadas y exploracion, no para esconder valor importante. |
| Oficial sobre barato | No usar WhatsApp no oficial, scraping, sesiones QR o proveedores grises para ahorrar. |
| Email siempre confirma | Ningun email crea movimiento financiero confirmado sin aprobacion del usuario. |
| Pendientes no afectan saldos | Lo detectado no confirmado no impacta dinero libre, balances ni reportes reales. |
| Core financiero manda | Calculos, saldos, deudas, recurrentes, limites y movimientos pasan por Core deterministico. |
| Agentes por valor | No activar agentes si una regla exacta resuelve mejor; no evitar agentes cuando la calidad depende de lenguaje/contexto. |
| Medicion desde V1 | Cada costo relevante debe tener trazabilidad minima a canal, feature, runtime y outcome. |

---

## 3. Diferencia Entre Ahorrar Y Gobernar Costos

### 3.1 Ahorrar Mal

Ejemplos de ahorro que bajan producto:

- no enviar un insight importante por WhatsApp aunque sea el canal donde el usuario lo vera;
- mandar todo al Dashboard aunque el usuario vive en WhatsApp;
- quitar confirmaciones inteligentes porque cuestan templates;
- usar un parser basico cuando el mensaje del usuario es ambiguo;
- usar un modelo barato en conversaciones profundas que requieren criterio;
- omitir ayudas porque "son caras";
- reducir privacidad o validacion para acelerar.

Resultado probable:

```text
El usuario siente que Manzana no esta presente, no entiende y no ayuda justo cuando importa.
```

### 3.2 Gobernar Bien

Ejemplos de optimizacion sana:

- agrupar pendientes cuando el usuario no responde;
- usar WhatsApp Flow para resolver varias confirmaciones con menos friccion;
- mandar un template que abre una conversacion util, no una secuencia repetitiva;
- usar deterministic engines para calculos financieros;
- usar DataAgent barato o API cuando la tarea es estructurada;
- reservar modelos mas fuertes para conversacion compleja, reconstruccion, insights sensibles o respuestas de alto impacto;
- cachear context packs y summaries consultables;
- medir fatiga de nudges;
- detener mensajes si el usuario ignora un tipo de aviso.

Resultado esperado:

```text
El usuario recibe menos ruido, mas ayuda y Manzana sostiene margen.
```

---

## 4. Capas De Costo

Manzana debe medir costos por capas, no como un unico gasto mensual.

| Capa | Que incluye | Naturaleza |
|---|---|---|
| Infra base | Hosting, dominio, Supabase, storage, CDN, logs, backups | Fijo + variable |
| Base de datos | PostgreSQL, RLS, queries, storage, backups, replicas futuras | Fijo + variable |
| Workers | Jobs, retries, schedules, outbox, email watch renewal, eventos | Variable operacional |
| WhatsApp | Templates, mensajes proactivos, Flows, delivery, conversaciones | Variable por canal |
| IA runtime | Codex/API, tokens, herramientas, agentes, traces, evaluaciones | Variable por tarea |
| Email | Gmail API, Pub/Sub, procesamiento, parsing, pendientes | Variable por volumen |
| Observabilidad | Errores, producto, IA traces, eventos de costo | Fijo + variable |
| Soporte | Atencion humana, investigacion de errores, incidentes | Variable por usuario/caso |
| Privacidad/compliance | Legal, politicas, verificaciones, seguridad, Google OAuth | Fijo + hito |
| Operacion | Monitoreo, revision de calidad, templates, incident response | Fijo + variable |

---

## 5. Fuentes De Precio Y Revalidacion

Los precios exactos no deben quedar hardcoded en el producto ni en las decisiones permanentes.

Reglas:

- usar USD como moneda base para costos de proveedores;
- convertir a soles con una variable `fx_pen_per_usd`;
- guardar fecha de snapshot: `cost_sources_snapshot_date`;
- revalidar antes de decisiones de pricing, cobro V1 o escala;
- separar precio oficial de estimacion interna;
- no asumir que "WhatsApp es gratis" como verdad de produccion;
- no asumir que "Codex no tiene costo marginal" como verdad de produccion;
- no estimar margen sin incluir soporte y operacion.

Fuentes oficiales a revalidar:

| Proveedor/capa | Fuente oficial |
|---|---|
| Kapso WhatsApp API | `https://kapso.com/whatsapp-api-for-developers` y documentacion de WhatsApp en Kapso |
| WhatsApp Business Platform / Meta | `https://whatsappbusiness.com/products/platform-pricing/` y rate cards enlazados desde esa pagina |
| OpenAI API | `https://openai.com/api/pricing/` |
| Supabase | `https://supabase.com/pricing` |
| Vercel | `https://vercel.com/pricing` |
| Trigger.dev o equivalente | `https://trigger.dev/pricing` |
| Gmail API cuotas | `https://developers.google.com/workspace/gmail/api/reference/quota` |

Nota:

```text
Este documento define el modelo de calculo.
Los numeros finales se actualizan con snapshots antes de lanzamiento V1, pricing y escala.
```

---

## 6. Variables Base

### 6.1 Variables Generales

| Variable | Descripcion |
|---|---|
| `active_users_monthly` | Usuarios activos mensuales. |
| `paying_users_monthly` | Usuarios que pagan. |
| `arpu_pen` | Ingreso promedio mensual por usuario pagador en soles. |
| `gross_revenue_pen` | Ingreso bruto mensual. |
| `variable_cost_user_pen` | Costo variable mensual por usuario activo. |
| `fixed_cost_month_pen` | Costos fijos mensuales. |
| `gross_margin_user_pen` | Margen bruto por usuario. |
| `fx_pen_per_usd` | Tipo de cambio para convertir costos USD a PEN. |
| `support_minutes_user_month` | Minutos de soporte promedio por usuario. |
| `quality_score` | Medida interna de satisfaccion/utilidad. |
| `retention_d7` | Retencion dia 7. |
| `retention_d30` | Retencion dia 30. |

Formula base:

```text
gross_revenue_pen = paying_users_monthly * arpu_pen

variable_cost_user_pen =
  whatsapp_cost_user_pen
  + ai_cost_user_pen
  + email_cost_user_pen
  + infra_variable_user_pen
  + observability_variable_user_pen
  + support_variable_user_pen

gross_margin_user_pen = arpu_pen - variable_cost_user_pen

gross_margin_percent =
  (gross_revenue_pen - total_variable_cost_pen) / gross_revenue_pen
```

### 6.2 Variables De WhatsApp

| Variable | Descripcion |
|---|---|
| `wa_inbound_messages` | Mensajes entrantes del usuario. |
| `wa_freeform_replies` | Respuestas dentro de ventana habilitada. |
| `wa_template_messages` | Templates enviados fuera de ventana o segun categoria. |
| `wa_flow_sessions` | Flows iniciados. |
| `wa_pending_confirmation_templates` | Templates para confirmar pendientes. |
| `wa_nudge_templates` | Templates de nudges/recordatorios. |
| `wa_insight_templates` | Templates de insights puntuales. |
| `wa_delivery_failures` | Mensajes fallidos. |
| `wa_response_rate` | Porcentaje de mensajes que generan respuesta util. |
| `wa_window_reopen_rate` | Porcentaje que reabre conversacion por mensaje util. |

Formula:

```text
whatsapp_cost_user_pen =
  sum(wa_units_by_category_country * kapso_or_whatsapp_rate_usd(category, country) * fx_pen_per_usd)
```

El sistema debe guardar estimacion por mensaje cuando sea posible:

```text
channel = "whatsapp"
provider = "kapso"
pricing_category = "utility" | "authentication" | "marketing" | "service" | "unknown"
country_code = "PE"
estimated_cost_usd
estimated_cost_pen
pricing_snapshot_id
```

Regla V1:

```text
Marketing templates no son parte del producto financiero V1.
Usarlos requiere decision GTM separada.
```

### 6.3 Variables De IA

| Variable | Descripcion |
|---|---|
| `agent_calls_total` | Invocaciones totales a agentes. |
| `agent_calls_by_agent` | Invocaciones por DataAgent, CorrectionAgent, ConversationAgent, etc. |
| `tokens_input` | Tokens de entrada por modelo/agente. |
| `tokens_output` | Tokens de salida por modelo/agente. |
| `tool_calls` | Consultas a ToolGateway/Core read-only. |
| `agent_retry_count` | Reintentos por error o baja confianza. |
| `agent_escalation_count` | Escaladas a modelo mas fuerte. |
| `agent_cache_hit_rate` | Uso de context packs/summaries cacheados. |
| `manual_review_rate` | Casos que requieren soporte humano. |

Formula:

```text
ai_cost_user_pen =
  sum(tokens_input_by_model * input_rate_model_usd * fx_pen_per_usd)
  + sum(tokens_output_by_model * output_rate_model_usd * fx_pen_per_usd)
  + runtime_overhead_pen
```

Regla:

```text
Medir por agente y por resultado.
No basta saber cuanto costo la IA.
Hay que saber si produjo movimiento correcto, correccion util, insight recordado o respuesta que ayudo.
```

### 6.4 Variables De Email

| Variable | Descripcion |
|---|---|
| `email_connections_active` | Usuarios con Gmail conectado. |
| `gmail_watch_renewals` | Renovaciones de watch. |
| `gmail_api_calls` | Llamadas Gmail API. |
| `pubsub_events` | Eventos Pub/Sub recibidos. |
| `emails_scanned` | Emails candidatos leidos/minimizados. |
| `emails_financial_detected` | Emails detectados como financieros. |
| `pending_items_created` | Pendientes creados desde email. |
| `pending_items_confirmed` | Pendientes confirmados por usuario. |
| `pending_items_ignored` | Pendientes ignorados. |
| `email_to_whatsapp_templates` | Templates WhatsApp generados por pendientes email. |

Formula:

```text
email_cost_user_pen =
  gmail_processing_cost_pen
  + pubsub_worker_cost_pen
  + ai_email_enrichment_cost_pen
  + whatsapp_confirmation_cost_pen
  + storage_cost_pen
```

Regla:

```text
El costo principal de email puede terminar estando en WhatsApp y soporte,
no en Gmail API.
```

### 6.5 Variables De Soporte

| Variable | Descripcion |
|---|---|
| `support_cases_user_month` | Casos de soporte por usuario/mes. |
| `support_minutes_case` | Tiempo promedio por caso. |
| `incident_cases` | Casos causados por errores del sistema. |
| `manual_reconciliation_cases` | Casos por saldos o movimientos confusos. |
| `privacy_requests` | Solicitudes de exportacion, borrado o acceso. |

Formula:

```text
support_variable_user_pen =
  support_cases_user_month * support_minutes_case * support_cost_per_minute_pen
```

Regla:

```text
Un producto "barato" que genera confusion puede salir caro en soporte.
```

---

## 7. Metricas Unitarias De Calidad Y Costo

Estas metricas deben existir desde el lanzamiento V1 aunque sean estimadas.

| Metrica | Formula | Por que importa |
|---|---|---|
| Costo por usuario activo | `total_variable_cost / active_users_monthly` | Mide sostenibilidad base. |
| Costo por usuario retenido D30 | `total_variable_cost / retained_users_d30` | Evita celebrar usuarios que no vuelven. |
| Costo por movimiento confirmado | `costos captura / confirmed_movements` | Mide eficiencia de registro real. |
| Costo por pendiente confirmado | `costos pending/email/WA / pending_confirmed` | Mide email + confirmaciones. |
| Costo por insight util | `costos insight / insights_helpful` | Mide valor, no cantidad de insights. |
| Costo por conversacion resuelta | `costos conversacion / resolved_conversations` | Mide ayuda real. |
| Costo por correccion resuelta | `costos correccion / corrections_completed` | Mide confianza y reparacion. |
| Costo por nudge efectivo | `costos nudge / nudges_with_positive_outcome` | Evita spam caro. |
| Fatiga por canal | `ignored_messages / proactive_messages` | Mide saturacion. |
| Tasa de reapertura WhatsApp | `windows_reopened / proactive_templates` | Mide si el mensaje fue util. |

Outcome util puede ser:

- usuario confirma movimiento;
- usuario corrige sin frustracion;
- usuario responde y reabre conversacion;
- usuario entiende un insight;
- usuario evita olvido de deuda/cuota;
- usuario vuelve al dia siguiente;
- usuario marca insight como util;
- usuario pregunta algo financiero despues de un descubrimiento;
- usuario completa onboarding sin soporte.

---

## 8. Segmentos De Uso Para Modelar Costos

Manzana no debe promediar todo demasiado pronto. Hay perfiles con costos distintos.

| Segmento | Comportamiento | Costo principal | Riesgo |
|---|---|---|---|
| Ligero | Registra pocos gastos por WhatsApp, casi no conecta Gmail | WhatsApp/IA bajo | Baja activacion si no ve valor rapido. |
| Normal | Registra varias veces por semana, consulta dinero libre, recibe algunos insights | WhatsApp + IA moderado | Necesita calidad constante. |
| Power user | Registra mucho, pregunta historico, corrige, revisa Dashboard | IA + DB + soporte | Puede ser rentable si paga, caro si es gratis. |
| Email-heavy | Conecta Gmail/Yape/banco y recibe muchos pendientes | Email + WhatsApp templates + pending UX | Muchas confirmaciones ignoradas. |
| Deudas/recurrentes | Usa cuotas, prestamos, pagos que vienen | Core + nudges + WhatsApp | Riesgo de ansiedad si se comunica mal. |
| Conversacional profundo | Pregunta decisiones, reconstruye gastos, pide analisis | ConversationAgent + ToolGateway | Alto valor, alto costo si no se enruta bien. |

Regla:

```text
El plan de monetizacion futuro debe considerar segmentos.
No todos los usuarios cuestan igual ni reciben el mismo valor.
```

---

## 9. Escenarios De Modelado

Estos escenarios no fijan precios finales. Sirven para simular.

### 9.1 Pre-Lanzamiento Interno

| Variable | Supuesto |
|---|---|
| Usuarios | 20 a 50 |
| Objetivo | Aprender comportamiento real y calidad percibida. |
| Margen | Secundario. |
| Prioridad | Instrumentacion, retencion, errores, costo por outcome. |
| Riesgo | Confundir entusiasmo manual con unit economics real. |

Decision:

```text
En pre-lanzamiento interno se puede subsidiar calidad,
pero se mide todo desde el inicio.
```

### 9.2 Lanzamiento V1

| Variable | Supuesto |
|---|---|
| Usuarios | 100 a 300 |
| Objetivo | Validar patrones de uso y costo por segmento. |
| Margen | Empezar a observar. |
| Prioridad | Reducir desperdicio sin bajar experiencia. |
| Riesgo | WhatsApp/email-heavy crecen mas rapido que retencion. |

Decision:

```text
Aqui se ajustan frecuencia, batching, Flows, runtime y limites de abuso.
```

### 9.3 Validacion Comercial

| Variable | Supuesto |
|---|---|
| Usuarios | 500 a 1,500 |
| Objetivo | Validar disposicion a pagar y margen inicial. |
| Margen | Importante. |
| Prioridad | Planes, limites justos, soporte, calidad estable. |
| Riesgo | Prometer ilimitado sin conocer costo real. |

Decision:

```text
No lanzar pricing publico sin unit economics por segmento.
```

### 9.4 Escala Inicial

| Variable | Supuesto |
|---|---|
| Usuarios | 5,000 a 10,000 |
| Objetivo | Operacion repetible. |
| Margen | Necesario. |
| Prioridad | Automatizacion, observabilidad, soporte, governance de runtime. |
| Riesgo | Errores pequenos multiplicados por volumen. |

Decision:

```text
El producto debe poder enrutar costo/calidad por plan, riesgo y comportamiento.
```

---

## 10. Presupuesto De Calidad Por Feature

Este documento no define precios finales. Define donde Manzana debe estar dispuesta a gastar.

| Feature | Vale gastar cuando | Evitar gasto cuando | Medida de calidad |
|---|---|---|---|
| Registro WhatsApp | El usuario esta capturando dinero real en lenguaje natural. | El mensaje es duplicado o confirmacion innecesaria. | Movimiento correcto, baja correccion. |
| Correcciones | Repara confianza y aprendizaje. | La correccion es obvia y deterministicamente resoluble. | Correccion exitosa, tono sin culpa. |
| Email pending | Evita olvido y captura movimientos reales. | El usuario ignora repetidamente pendientes similares. | Pendiente confirmado/cancelado. |
| Insights | Revela algo util, especifico y accionable. | Es obvio, generico o repetitivo. | Insight recordado/util. |
| Nudges | Evita olvido o ansiedad financiera. | Solo interrumpe sin accion clara. | Respuesta, pago, snooze, opt-in sano. |
| Conversacion financiera | Ayuda a decidir o entender dinero. | Pregunta simple que una query/resumen resuelve. | Respuesta entendida, siguiente paso. |
| Dashboard | Permite revisar, confirmar, explorar y corregir. | Replica chat sin ventaja visual. | Uso de detalle, confirmaciones, filtros. |
| Onboarding | Reduce miedo y activa uso real. | Tour largo sin accion. | Primer movimiento, primer valor. |

Regla:

```text
El gasto se justifica cuando aumenta confianza, claridad, captura o retencion.
No se justifica cuando solo aumenta actividad artificial.
```

---

## 11. Politica WhatsApp: Calidad Sin Spam

WhatsApp es el canal principal de relacion. Eso no significa mandar todo por WhatsApp.

### 11.1 Usar WhatsApp Cuando

- el usuario acaba de escribir;
- hay ventana de conversacion abierta;
- la confirmacion es importante y breve;
- un pendiente necesita atencion;
- un insight tiene alto valor y bajo riesgo de sensibilidad;
- un nudge evita olvido real;
- el usuario pidio ser avisado;
- el mensaje puede abrir una conversacion util.

### 11.2 Usar Dashboard/App Cuando

- hay muchas confirmaciones acumuladas;
- el detalle visual ayuda mas que texto;
- hay datos sensibles;
- el usuario no responde templates;
- se necesita comparar, filtrar o revisar historial;
- el mensaje seria largo;
- el usuario esta fuera de ventana y no hay urgencia suficiente.

### 11.3 Estrategia De Ventana

La ventana de WhatsApp debe gestionarse con `WhatsAppWindowManager`.

Estados minimos:

| Estado | Significado |
|---|---|
| `open` | Se puede responder en la conversacion activa. |
| `expiring_soon` | Quedan pocas horas; se puede mandar mensaje util si hay valor real. |
| `closed` | Requiere template aprobado para iniciar. |
| `cooldown` | Usuario ignoro o hay riesgo de fatiga. |
| `silent_hours` | No interrumpir salvo caso explicitamente permitido. |

Reglas:

- no enviar mensajes solo para "mantener viva" la ventana si no hay valor;
- si hay pendientes, se puede enviar resumen accionable antes de que cierre la ventana;
- el recordatorio alrededor de 12 horas puede ser util si hay pendientes reales o valor claro;
- el recordatorio alrededor de 20 horas queda opcional y debe pasar por Nudge Policy;
- si el usuario ya ignoro varios mensajes, mover el peso a Centro de Confirmaciones;
- si se usa Flow, debe resolver una accion concreta.

Ejemplo de uso sano:

```text
Tienes 3 movimientos por revisar.
Puedo ayudarte a confirmarlos por aqui o abrirlos juntos en Manzana.
```

### 11.4 Templates Pagados

Un template pagado debe tener uno de estos propositos:

- confirmar pendiente financiero;
- avisar pago/cuota proxima con opt-in;
- mostrar insight de alto valor con baja sensibilidad;
- reabrir conversacion porque hay accion clara;
- entregar seguridad/privacidad/estado de cuenta solicitado.

No usar templates para:

- perseguir al usuario;
- repetir el mismo pendiente muchas veces;
- hacer marketing sin decision GTM;
- enviar "tips" genericos;
- empujar engagement artificial.

---

## 12. Politica Email: Pendientes De Calidad

Email puede crear mucho valor, pero tambien puede crear costo y ruido.

Reglas:

- Gmail V1 solo por OAuth oficial;
- no passwords, app passwords ni scraping;
- email detectado crea `pending_item`, no movimiento confirmado;
- si el usuario no responde, acumular en Centro de Confirmaciones;
- las confirmaciones por WhatsApp deben ser inteligentes, no una por cada email si hay acumulacion;
- cuando hay varios pendientes, preferir resumen + Flow/link/app;
- si el usuario confirma "todos", Core procesa individualmente con validacion;
- si cancela uno, se archiva sin afectar saldos;
- si hay ambiguedad alta, pedir confirmacion puntual.

Metrica clave:

```text
pending_confirmed_rate =
  pending_items_confirmed / pending_items_created
```

Si esta metrica baja:

- revisar calidad del parser;
- revisar si el usuario entiende el pendiente;
- revisar frecuencia de mensajes;
- revisar si el Centro de Confirmaciones esta visible;
- revisar si los mensajes llegan en mal horario;
- revisar si se estan detectando emails irrelevantes.

No resolver bajando calidad:

```text
No registrar automaticamente desde email para subir conversion.
```

---

## 13. Politica IA: Costo Por Inteligencia Real

La IA de Manzana debe sentirse inteligente, pero no todo debe ser agente.

### 13.1 Donde IA Si Agrega Calidad

| Caso | Agente/runtime |
|---|---|
| Lenguaje natural de registro | DataAgent |
| Correccion ambigua | CorrectionAgent |
| Preguntas historicas o decisiones | ConversationAgent |
| Explicacion de insight sensible | InsightExperienceAgent + InsightNarratorAgent |
| Respuesta humana y breve | ResponseAgent |
| Reconstruccion de memoria financiera | ConversationAgent + ToolGateway |

### 13.2 Donde Motor Deterministico Gana

| Caso | Motor |
|---|---|
| Saldo | Balance Engine |
| Dinero libre | Core Financiero |
| Deudas | Debt Engine |
| Recurrentes | Recurring Engine |
| Duplicados | Dedup Engine |
| Pendientes | Pending Inbox |
| Riesgo y opt-in | Risk/Nudge Policy |
| Escrituras financieras | Core Commands |

### 13.3 Runtime Routing

Fase actual:

```text
Codex-first para velocidad, calidad y menor friccion de construccion.
```

Fase API-ready:

```text
Mover agentes uno por uno a API segun costo, latencia, calidad y escala.
El agente sigue existiendo; cambia el runtime que lo ejecuta.
```

Candidatos a API barata:

- `DataAgent`;
- `CorrectionAgent` en casos simples;
- `ResponseAgent`;
- clasificadores de intencion;
- resumen de context packs.

Candidatos a modelo mas fuerte:

- `ConversationAgent` para preguntas complejas;
- `InsightExperienceAgent` en insights sensibles;
- reconstruccion historica;
- casos con riesgo de dinero/deuda;
- conversaciones con frustracion o ansiedad.

Regla:

```text
El router no elige el modelo mas barato.
Elige el minimo runtime que preserve calidad para esa tarea.
```

---

## 14. Costos Por Canal Y Experiencia

| Canal | Rol | Costo que importa | Riesgo de mala optimizacion |
|---|---|---|---|
| WhatsApp | Captura, continuidad, confirmacion, confianza | Templates, Flows, IA, fatiga | Volverlo spam o esconder valor. |
| Dashboard | Revision, detalle, confirmaciones, historico | Hosting, DB, UI, queries | Volverlo frio o principal por ahorro. |
| Email | Deteccion de senales financieras | Gmail, Pub/Sub, workers, pendientes, WA | Crear ruido sin confirmacion. |
| Automatizaciones | Recurrentes, deudas, nudges | Workers, templates, observabilidad | Notificar sin contexto emocional. |
| Soporte | Reparacion de confianza | Tiempo humano | Que errores baratos se vuelvan caros. |

Regla:

```text
El canal se elige por experiencia y momento,
no solo por costo.
```

---

## 15. Cost Events

Desde V1 debe existir un contrato para registrar costos estimados.

No necesariamente requiere tabla final desde el primer dia, pero si un evento/log estructurado.

### 15.1 Schema Logico

```ts
type CostEvent = {
  cost_event_id: string;
  user_id: string | null;
  occurred_at: string;

  feature:
    | "whatsapp_capture"
    | "whatsapp_confirmation"
    | "email_pending"
    | "agent_runtime"
    | "insight"
    | "nudge"
    | "dashboard"
    | "worker"
    | "support"
    | "observability";

  channel:
    | "whatsapp"
    | "dashboard"
    | "email"
    | "worker"
    | "api"
    | "support";

  provider:
    | "meta_whatsapp_cloud_api"
    | "openai_api"
    | "codex_runtime"
    | "supabase"
    | "vercel"
    | "gmail_api"
    | "pubsub"
    | "trigger_or_equivalent"
    | "manual"
    | "other";

  unit_type:
    | "message"
    | "template"
    | "flow"
    | "token_input"
    | "token_output"
    | "api_call"
    | "worker_run"
    | "db_operation"
    | "storage_mb"
    | "support_minute"
    | "unknown";

  units: number;
  estimated_cost_usd: number | null;
  estimated_cost_pen: number | null;
  currency: "USD" | "PEN" | "unknown";
  fx_pen_per_usd: number | null;
  pricing_snapshot_id: string | null;

  related_entity_type:
    | "movement"
    | "pending_item"
    | "insight"
    | "nudge"
    | "conversation"
    | "agent_run"
    | "worker_job"
    | "support_case"
    | null;

  related_entity_id: string | null;
  trace_id: string | null;
  outcome_id: string | null;

  metadata: Record<string, unknown>;
};
```

### 15.2 Reglas

- no guardar contenido sensible completo en `metadata`;
- guardar ids y categorias, no mensajes crudos;
- redondear costos para analitica, no para facturacion exacta;
- separar costo estimado de costo real si el proveedor entrega invoice posterior;
- mantener `pricing_snapshot_id` para auditoria;
- vincular costo con outcome cuando exista.

---

## 16. Outcome Events

Costos sin outcomes pueden empujar decisiones incorrectas.

Manzana debe medir si el costo produjo valor.

### 16.1 Schema Logico

```ts
type OutcomeEvent = {
  outcome_id: string;
  user_id: string;
  occurred_at: string;

  outcome_type:
    | "movement_confirmed"
    | "pending_confirmed"
    | "pending_cancelled"
    | "conversation_resolved"
    | "correction_completed"
    | "insight_viewed"
    | "insight_marked_useful"
    | "nudge_acted_on"
    | "window_reopened"
    | "dashboard_review_completed"
    | "onboarding_activated"
    | "support_resolved";

  source_channel:
    | "whatsapp"
    | "dashboard"
    | "email"
    | "worker"
    | "support";

  related_entity_type: string | null;
  related_entity_id: string | null;
  trace_id: string | null;
  quality_signal: "positive" | "neutral" | "negative" | "unknown";
  metadata: Record<string, unknown>;
};
```

### 16.2 Relacion Cost/Outcome

Ejemplos:

| Caso | CostEvent | OutcomeEvent |
|---|---|---|
| Template de pendiente | `whatsapp_confirmation` | `pending_confirmed` o `window_reopened` |
| DataAgent registra gasto | `agent_runtime` | `movement_confirmed` |
| Insight por WhatsApp | `insight` + `template` | `insight_viewed` o respuesta |
| Nudge de cuota | `nudge` | `nudge_acted_on` o snooze |
| Pregunta historica | `agent_runtime` + DB | `conversation_resolved` |

Regla:

```text
Si un costo no puede conectarse a outcome,
se revisa antes de optimizar producto alrededor de el.
```

---

## 17. Dashboard De Unit Economics

En implementacion, el equipo debe poder revisar estas vistas.

### 17.1 Vista Ejecutiva

- usuarios activos;
- usuarios retenidos D7/D30;
- costo variable total;
- costo variable por usuario activo;
- costo variable por usuario retenido;
- margen bruto estimado;
- WhatsApp cost/user;
- AI cost/user;
- Email cost/user;
- soporte cost/user;
- calidad percibida;
- incidentes financieros.

### 17.2 Vista WhatsApp

- mensajes por tipo;
- templates por categoria;
- costo estimado por categoria;
- respuesta por tipo de template;
- reapertura de ventana;
- confirmaciones por WhatsApp;
- confirmaciones movidas a Centro de Confirmaciones;
- fatiga por usuario;
- opt-outs/silencios.

### 17.3 Vista IA

- costo por agente;
- llamadas por agente;
- token usage por runtime/modelo;
- correction rate posterior a DataAgent;
- retry/escalation rate;
- ToolGateway usage;
- costo por conversacion resuelta;
- costo por insight util;
- calidad por agente.

### 17.4 Vista Email

- usuarios con Gmail conectado;
- emails procesados;
- pending created;
- pending confirmed;
- pending ignored;
- conversion por remitente/tipo;
- costo de confirmaciones WhatsApp generadas por email;
- cuota Gmail/PubSub;
- errores de watch renewal.

### 17.5 Vista Soporte/Confianza

- tickets por 100 usuarios;
- tickets por feature;
- minutos por caso;
- casos por saldos incorrectos;
- casos por privacidad;
- solicitudes de borrado/exportacion;
- errores que requirieron disculpa;
- cambios de modo discreto.

---

## 18. Semaforos De Decision

Los umbrales exactos se ajustan con datos reales. Para V1 se usa esta guia.

### 18.1 Variable Cost Como Porcentaje De ARPU

| Estado | Rango | Accion |
|---|---|---|
| Verde | `<= 25%` del ARPU | Mantener calidad y seguir midiendo. |
| Amarillo | `> 25%` y `<= 45%` | Revisar desperdicio, frecuencia, routing y soporte. |
| Rojo | `> 45%` | Revisar planes, limites, segmentos y costos de alto volumen. |

Importante:

```text
Rojo no significa bajar calidad.
Significa encontrar que parte del costo no produce valor o si el plan/precio no calza.
```

### 18.2 WhatsApp

| Senal | Interpretacion | Respuesta |
|---|---|---|
| Alto costo + alta respuesta | Canal valioso; revisar pricing/plan, no cortar. |
| Alto costo + baja respuesta | Ruido/fatiga; ajustar timing, copy, Flow o frecuencia. |
| Bajo costo + baja respuesta | No duele margen, pero puede danar experiencia. |
| Bajo costo + alta respuesta | Mantener y escalar con cuidado. |

### 18.3 IA

| Senal | Interpretacion | Respuesta |
|---|---|---|
| Alto costo + baja correccion | IA cara pero buena; revisar si mejora retencion. |
| Alto costo + alta correccion | Problema de calidad; mejorar agente, schema o context pack. |
| Bajo costo + alta correccion | Modelo barato esta degradando producto. |
| Bajo costo + baja correccion | Buen candidato para runtime economico. |

### 18.4 Email

| Senal | Interpretacion | Respuesta |
|---|---|---|
| Muchos pendientes confirmados | Feature valiosa; puede justificar plan superior. |
| Muchos pendientes ignorados | Deteccion o cadencia mala. |
| Muchos templates sin respuesta | Pasar a resumen/app y revisar WindowManager. |
| Muchos falsos positivos | Mejorar whitelist/parser y confianza. |

---

## 19. Estrategia Por Plan Futuro

Este documento no define precios finales, pero si restricciones sanas.

### 19.1 Lanzamiento V1

- acceso controlado;
- calidad subsidiada;
- limite por invitacion;
- medicion completa;
- soporte cercano;
- no prometer ilimitado permanente;
- no optimizar contra margen antes de aprender.

### 19.2 Plan Gratuito Futuro

Si existe, debe evitar promesas que generen costos ilimitados.

Posibles limites sanos:

- numero de confirmaciones email/mes;
- cantidad de insights proactivos;
- historico avanzado;
- frecuencia de preguntas profundas;
- automatizaciones premium;
- soporte prioritario.

Regla:

```text
El plan gratuito puede limitar volumen,
pero no debe dar una experiencia rota o poco confiable.
```

### 19.3 Plan Pago Futuro

El plan pago debe justificar mayor calidad:

- mas automatizaciones;
- mas preguntas historicas;
- email parsing completo;
- insights proactivos;
- deudas/recurrentes avanzados;
- soporte mejor;
- mas contexto historico;
- exportacion y reportes.

Regla:

```text
No vender "mas mensajes".
Vender mas tranquilidad, control y claridad.
```

---

## 20. Decisiones De Producto Guiadas Por Costos

### 20.1 Cuando WhatsApp Suba Mucho

Orden de respuesta:

1. Revisar si los mensajes tienen outcome.
2. Agrupar pendientes.
3. Usar Flow para lotes.
4. Ajustar horarios y frecuencia.
5. Mover detalle al Centro de Confirmaciones.
6. Segmentar por opt-in e importancia.
7. Revisar plan/precio para usuarios de alto volumen.

No hacer:

- esconder valor clave;
- cambiar a API no oficial;
- mandar mensajes frios o genericos;
- cortar nudges utiles sin medir impacto.

### 20.2 Cuando IA Suba Mucho

Orden de respuesta:

1. Medir costo por agente.
2. Medir correccion y satisfaccion.
3. Separar casos simples/complejos.
4. Mover agentes simples a API barata si preserva calidad.
5. Mejorar context packs.
6. Cachear summaries consultables.
7. Usar deterministic engines para calculos.
8. Escalar modelo fuerte solo cuando el riesgo/valor lo justifica.

No hacer:

- usar modelo barato en todo;
- eliminar ConversationAgent si genera retencion;
- dejar agentes consultar toda la DB sin ToolGateway;
- usar IA para calculos exactos que Core ya resuelve.

### 20.3 Cuando Email Genere Ruido

Orden de respuesta:

1. Mejorar filtros y whitelists.
2. Medir falsos positivos por remitente.
3. Ajustar umbral de confianza.
4. Agrupar pendientes.
5. Mostrar Centro de Confirmaciones.
6. Cambiar copy.
7. Permitir preferencias por tipo de email.

No hacer:

- confirmar automaticamente;
- desactivar Gmail completo sin diagnostico;
- ocultar pendientes sin explicacion.

### 20.4 Cuando Soporte Suba

Orden de respuesta:

1. Clasificar motivo.
2. Ver si nace de copy, UI, Core o agente.
3. Reducir confusion en producto.
4. Mejorar correcciones.
5. Mejorar trazas internas.
6. Crear estados de error claros.
7. Automatizar sin perder humanidad.

No hacer:

- culpar al usuario;
- esconder errores;
- hacer que soporte vea mas datos de los necesarios.

---

## 21. Guardrails De Calidad

Estas cosas no se sacrifican por margen en V1:

- confirmacion de email antes de registrar;
- separacion pending/movement;
- Core financiero deterministico;
- agentes sin escritura directa;
- correcciones faciles;
- modo discreto;
- opt-in para proactividad sensible;
- Dashboard como centro de revision;
- WhatsApp como canal principal;
- insights de alto valor cuando pasan politicas;
- ToolGateway para acceso controlado a datos;
- outbox/eventos para consistencia;
- privacidad y borrado/exportacion.

Si un costo amenaza uno de estos guardrails, la respuesta correcta es:

```text
redisenar flujo, runtime, frecuencia, plan o pricing.
No romper la promesa central.
```

---

## 22. Decision Log Que Se Alimenta De Este Documento

Este documento puede crear decisiones futuras para `20_decisiones_tecnicas.md` o una fase comercial.

Decisiones futuras probables:

| Tema | Momento |
|---|---|
| Pricing de cobro V1 | Antes de cobrar. |
| Limites por plan | Despues de medir uso real. |
| Runtime API por agente | Cuando haya volumen o latencia/costo reales. |
| Observabilidad final | Al elegir herramientas exactas. |
| Plan email-heavy | Cuando Gmail tenga usuarios activos suficientes. |
| Politica de insights proactivos | Cuando haya datos de fatiga/utilidad. |
| Soporte humano | Antes de lanzamiento V1 amplio. |
| Legal/compliance | Antes de lanzamiento publico. |

---

## 23. Preguntas Que Este Documento Debe Poder Responder

Antes de escalar, Manzana debe responder:

- Cuanto cuesta un usuario activo mensual?
- Cuanto cuesta un usuario retenido D30?
- Cuanto cuesta confirmar un movimiento por WhatsApp?
- Cuanto cuesta un pendiente de email confirmado?
- Que agentes cuestan mas?
- Que agentes generan mas calidad?
- Cuanto costo tiene un usuario email-heavy?
- Que costo se debe a errores o soporte?
- Que mensajes se ignoran?
- Que templates reabren conversacion?
- Que insights generan valor real?
- Donde el Dashboard reduce friccion sin esconder valor?
- Que parte del costo es fija y cual escala con usuarios?
- Que margen requiere el producto para sostener calidad?

---

## 24. Criterios De Aceptacion

Este documento queda aceptado si:

- deja claro que costos no se optimizan bajando calidad;
- separa costos por canal, IA, email, infra, soporte y compliance;
- define formulas base para costo por usuario y margen;
- define metricas por outcome;
- incluye estrategia de WhatsApp sin spam ni degradacion;
- mantiene Kapso como proveedor oficial WhatsApp V1 via `WhatsAppAdapter`;
- mantiene email con confirmacion obligatoria;
- mantiene pendientes fuera de saldos;
- mantiene agentes controlados y Core deterministico;
- define CostEvent y OutcomeEvent logicos;
- indica fuentes oficiales a revalidar;
- deja decisiones de pricing final fuera de este documento;
- permite a un implementador instrumentar desde V1 sin inventar todo.

---

## 25. Checklist Para Implementacion

Cuando se empiece a construir, crear tareas para:

- [ ] Definir `pricing_snapshot_id` inicial.
- [ ] Configurar `fx_pen_per_usd`.
- [ ] Registrar costos estimados de WhatsApp por template/categoria.
- [ ] Registrar costos estimados por agente/runtime/modelo.
- [ ] Registrar costos de Gmail/PubSub/workers.
- [ ] Registrar `OutcomeEvent`.
- [ ] Conectar CostEvent con OutcomeEvent por `trace_id`/`outcome_id`.
- [ ] Crear dashboard interno de costos.
- [ ] Medir fatiga de WhatsApp.
- [ ] Medir pendientes ignorados.
- [ ] Medir costo por movimiento confirmado.
- [ ] Medir costo por pendiente confirmado.
- [ ] Medir costo por insight util.
- [ ] Medir soporte por feature.
- [ ] Revisar costos antes de lanzamiento V1 amplio.
- [ ] Revisar costos antes de pricing publico.

---

## 26. Resumen Operativo

Manzana debe verse como un producto premium porque entiende, acompana y protege.

Eso cuesta. Pero el costo se puede gobernar con arquitectura, datos y criterio.

La regla final:

```text
No se recorta la inteligencia que crea confianza.
Se recorta el ruido, la duplicacion, el spam, el runtime incorrecto y la operacion ciega.
```

*Fase 5 Proteccion - Documento 25 - V1.1*
