# 23 - Plan De Implementacion V1

**Estado:** V1.6 - Puente para construccion inicial de V1 directa; sincronizado con Kapso WhatsApp V1  
**Ultima actualizacion:** 16 de junio, 2026  
**Depende de:** `06_arquitectura_sistema.md`, `15_stack_tecnologico.md`, `16_modelo_datos.md`, `17_eventos_workers.md`, `18_api_spec.md`, `19_agent_runtime_tools.md`, `20_decisiones_tecnicas.md`, `21_decision_whatsapp_provider.md`, `22_decision_email_provider.md`, `25_scheduler_externo_v1.md`  

---

## 1. Tesis

Este documento convierte las specs de Manzana en una ruta de construccion.

No agrega alcance nuevo. Ordena que construir primero, que puede quedar mockeado, que debe ser real desde el inicio y que no se debe tocar en V1.

La regla:

```text
Construir por cortes pequenos.
Probar el circuito completo antes de ampliar superficie.
Nada financiero fuera del Core.
Nada async sin outbox.
Nada agentic sin ToolGateway.
Nada proactivo sin politica.
```

---

## 2. Fuentes De Verdad Para Implementar

| Tema | Fuente principal |
|---|---|
| Arquitectura transversal | `06_arquitectura_sistema.md` |
| Decisiones aprobadas/no negociables | `20_decisiones_tecnicas.md` |
| Stack base | `15_stack_tecnologico.md` |
| Datos, enums, tablas, RLS, indices | `16_modelo_datos.md` |
| Eventos, workers, outbox, schedules | `17_eventos_workers.md`, `25_scheduler_externo_v1.md` |
| Endpoints, webhooks, comandos | `18_api_spec.md` |
| Agentes, tools, context packs | `19_agent_runtime_tools.md` |
| WhatsApp | `21_decision_whatsapp_provider.md` + `05a_whatsapp.md` |
| Email | `22_decision_email_provider.md` + `05d_email_parsing.md` |
| Experiencia y tono | Fase 3 Producto |
| Identidad visual y UI | Fase 6 Visual V1 (`docs/fase_6_visual/28` a `33`) |

Regla de conflicto:

1. `20_decisiones_tecnicas.md` gana en decisiones.
2. `16_modelo_datos.md` gana en modelo.
3. `17_eventos_workers.md` gana en eventos internos.
4. `18_api_spec.md` gana en endpoints.
5. `19_agent_runtime_tools.md` gana en herramientas/agentes.
6. Fase 3 gana en experiencia visible, tono, estructura y UX.
7. Fase 6 gana en identidad visual, tokens, componentes, estados visuales y handoff.
8. Si un prototipo visual contradice Fase 6, gana Fase 6.

---

## 3. Invariantes De Construccion

Estos puntos no son negociables durante implementacion:

- Core Financiero es la unica capa que crea, corrige, elimina o confirma efectos financieros.
- Dashboard, WhatsApp, Email, workers y agentes no escriben dinero directamente.
- Toda escritura financiera pasa por `CommandDispatcher`.
- Agentes solo consultan por `ToolGateway`.
- Email crea `pending_items`; no crea movimientos confirmados.
- `pending_items` no afectan saldos.
- Eventos externos entran por `External Event Gateway`.
- Hechos internos salen por `transactional_outbox`.
- WhatsApp V1 usa Kapso via `WhatsAppAdapter` como proveedor oficial operativo.
- No usar Twilio, 360dialog, WATI, Zoko, respond.io, Evolution API, APIs no oficiales, sesiones QR ni automatizacion WhatsApp Web.
- Gmail V1 usa OAuth/API oficial; no passwords, app passwords ni scraping.
- `payload_ref` solo apunta a storage cifrado de corta retencion si se necesita replay/debug.

---

## 4. Estrategia De Construccion

La implementacion V1 debe avanzar en tres anillos:

```text
Anillo 1: Dominio confiable
  DB, Auth, RLS, Core, comandos, movimientos, cuentas, auditoria.

Anillo 2: Producto usable
  Dashboard V1 operativo, WhatsApp inbound/outbound, pendientes, confirmaciones.

Anillo 3: Inteligencia y experiencia
  AgentRuntime, DataAgent, ConversationAgent, email, recurrentes, deudas, insights, nudges.
```

No construir primero la IA completa. Primero debe existir un Core que pueda probar que el dinero queda correcto.

---

## 5. Cortes De Implementacion

### Corte 0 - Workspace Y Base Tecnica

Objetivo: dejar el proyecto listo para construir sin decisiones escondidas.

Incluye:

- Next.js App Router + TypeScript.
- Tailwind + componentes propios/headless siguiendo Fase 3 y Fase 6 visual V1.
- Supabase local/remoto configurado.
- Variables de entorno separadas por ambiente.
- Estructura de carpetas para `core`, `adapters`, `app`, `workers`, `agents`, `shared`.
- Validacion runtime compartida con Zod/Valibot o equivalente.
- Logger/tracing base.
- Test runner.

No incluye:

- WhatsApp real.
- Gmail real.
- IA real.
- Migraciones completas de todas las features.

Done:

- App corre localmente.
- Health check responde.
- Supabase conecta.
- Tests base corren.
- Hay convencion clara de carpetas.

### Corte 1 - Datos, Auth Y RLS Inicial

Objetivo: tener la base segura para un usuario real.

Incluye:

- `profiles`.
- `user_preferences`.
- `accounts`.
- `boxes`.
- `categories`.
- `user_subcategories`.
- `tags`.
- RLS por `user_id`.
- Seeds de 12 categorias canonicas.
- Migraciones SQL versionadas.

Done:

- Un usuario autenticado solo ve sus datos.
- Service role no se usa desde cliente.
- Categorias base existen y no se crean por usuario.
- Cuentas/cajas pueden crearse desde API o seed manual.

### Corte 2 - Core Financiero Inicial

Objetivo: registrar dinero correctamente antes de conectar canales.

Incluye:

- `movements`.
- `movement_audit_log`.
- `movement_tags`.
- `CommandDispatcher`.
- Core Commands iniciales:
  - `CreateMovementCommand`,
  - `UpdateMovementCommand`,
  - `DeleteMovementCommand`,
  - `CorrectMovementCommand`.
- Validadores deterministas de monto, tipo, fecha, cuenta, categoria y moneda.
- Balance Engine inicial.

Done:

- Se registra un gasto manual y afecta saldo correctamente.
- Se registra ingreso y afecta saldo correctamente.
- Se corrige movimiento y queda auditoria.
- Se elimina/reversa movimiento sin borrar trazabilidad.
- Ningun endpoint escribe directo en tablas financieras sin Core.

### Corte 3 - Dashboard V1 Operativo

Objetivo: que el usuario pueda usar Manzana aunque WhatsApp todavia este mockeado.

Incluye:

- Home con dinero libre, resumen y pendientes.
- Login/acceso V1 con privacidad visible.
- Onboarding de activacion inicial:
  - primer registro guiado,
  - primer valor antes de configuracion pesada,
  - estado `onboarding_status` actualizado.
- Lista de movimientos.
- Formulario manual de movimiento no trivial:
  - tipo,
  - monto,
  - fecha,
  - categoria,
  - cuenta opcional/default,
  - nota,
  - persona relacionada cuando aplique.
- Cuentas y cajas basicas.
- Centro de Confirmaciones/Pendientes visible.
- Estados vacios cuidados segun Fase 3.
- Tokens, tipografia, paleta y componentes base segun Fase 6 visual V1.
- Modo discreto basico para montos visibles.

Done:

- Usuario registra movimiento desde Dashboard.
- Usuario crea/edita cuenta.
- Usuario ve saldos y dinero libre.
- Usuario puede confirmar/descartar pendiente mock.
- UI no depende de datos fake para flujos principales.
- UI no parece starter kit ni dashboard generico.
- Usuario puede completar acceso + primer registro sin configurar todo.

### Corte 4 - Eventos, Outbox Y Workers Base

Objetivo: que el sistema deje de ser sincronico fragil.

Incluye:

- `external_event_log`.
- `transactional_outbox`.
- `internal_event_log`.
- Publicador de outbox.
- Handlers internos para:
  - recalculo de balance,
  - proyecciones Dashboard,
  - metricas,
  - pending lifecycle basico.
- Idempotencia por evento.
- Dead letter basico.

Done:

- Core guarda movimiento + audit log + evento en una transaccion.
- Worker publica/consume outbox sin duplicar efectos.
- Reintentos no crean movimientos duplicados.
- Eventos externos e internos no se mezclan.

### Corte 5 - WhatsApp V1 Con Kapso

Objetivo: activar el canal principal sin contaminar el Core.

Incluye:

- `WhatsAppAdapter`.
- `GET /api/webhooks/whatsapp`.
- `POST /api/webhooks/whatsapp`.
- Verificacion de webhook con firma de Kapso.
- Normalizacion de mensajes/status.
- Escritura en `external_event_log`.
- `whatsapp_window_states`.
- Envio de respuestas via Kapso.
- Templates utility minimos.
- `WhatsAppWindowManager`.
- Contingencia por Dashboard/Pendientes si no conviene insistir por WhatsApp.

No incluye:

- Twilio/360dialog/WATI/Zoko/respond.io/Evolution API.
- APIs no oficiales.
- Marketing blasts.

Done:

- Mensaje entrante se normaliza y procesa una sola vez.
- Respuesta sale por Kapso.
- Ventana 24h se actualiza.
- Webhook responde rapido.
- El adapter no decide categorias, saldos ni movimientos.

### Corte 6 - AgentRuntime Y Registro Por Lenguaje Natural

Objetivo: que WhatsApp empiece a sentirse inteligente sin ceder control financiero.

Incluye:

- `AgentRuntime` Codex-first/API-ready.
- `DataAgent`.
- `ResponseAgent`.
- Context Packs minimos.
- Schemas estructurados.
- Validacion de outputs.
- Flow:

```text
WhatsApp
  -> External Event Gateway
  -> FinancialOrchestrator
  -> DataAgent
  -> validadores
  -> CommandDispatcher
  -> Core
  -> outbox
  -> ResponseAgent/template
```

Escenarios minimos:

- "Gaste 8 en cafe."
- "Hoy gaste 8 cafe, 15 taxi y 20 almuerzo."
- "Eso no fue gasto, fue prestamo a Luis."
- "Me pagaron lo que me debia Ana."

Done:

- DataAgent propone, no escribe.
- Core valida y persiste.
- Ambiguedad pide confirmacion.
- Multiples movimientos se crean separados.
- No se guarda chain-of-thought crudo.

### Corte 7 - Pendientes Y Confirmaciones Reales

Objetivo: manejar incertidumbre con calidad, no con friccion.

Incluye:

- `pending_items` real.
- Confirmar, editar y confirmar, descartar.
- Batch confirm/discard.
- Centro de Confirmaciones en Dashboard/app.
- Confirmaciones por WhatsApp cuando la ventana y politica lo permitan.
- Agrupacion de pendientes si el usuario no responde.

Done:

- Pendiente no afecta saldo.
- Confirmar pendiente crea movimiento por Core.
- Descartar pendiente no borra evidencia minima.
- Batch no duplica movimientos.
- WhatsApp no envia un mensaje por cada pendiente si el usuario no responde.

### Corte 8 - Cuentas, Cajas, Deudas Y Recurrentes

Objetivo: ampliar el dominio financiero sin romper lo ya probado.

Incluye:

- Cuentas/cajas completas segun `05e`.
- Deudas y pagos segun `05h`.
- Recurrentes y candidatos segun `05i`.
- Workers:
  - recurring detector,
  - debt due detector,
  - pending lifecycle.
- Eventos internos correspondientes.

Done:

- Pago de deuda actualiza estado y movimiento relacionado.
- Recurrente detectado crea candidato, no movimiento confirmado sin usuario.
- Recurrente confirmado genera ocurrencia/pago segun reglas.
- Dinero libre no se confunde con pendientes.

### Corte 9 - Email Gmail V1

Objetivo: detectar transacciones por email sin perder confianza.

Incluye:

- `EmailAdapter`.
- Gmail OAuth start/callback.
- `email_connections`.
- `email_messages`.
- Gmail Pub/Sub webhook.
- Watch renewal.
- Fetch controlado por `historyId`.
- Parsing a pendiente.
- Dedup contra movimientos existentes.
- Confirmacion por WhatsApp/Dashboard.

No incluye:

- Outlook.
- IMAP.
- Forwarding.
- Passwords/app passwords.
- Registro automatico.

Done:

- Gmail conectado por OAuth.
- Email financiero crea pendiente.
- Email no confirmado no afecta saldo.
- Usuario puede confirmar desde WhatsApp o Centro de Confirmaciones.
- Desconexion elimina tokens y deja politica clara para pendientes no resueltos.

### Corte 10 - Busqueda Natural Y Conversacion Financiera

Objetivo: que el usuario pueda preguntar sin que el agente tenga acceso libre a la DB.

Incluye:

- `ConversationAgent`.
- `ToolGateway` read-only.
- `query_movements`.
- `get_accounts_summary`.
- `get_balance_snapshot`.
- `get_debt_summary`.
- `get_recurring_summary`.
- Endpoint `POST /api/v1/search/natural`.

Escenarios minimos:

- "Que gastos hice el ultimo viernes de hace 4 meses?"
- "Puedo gastar S/50 hoy?"
- "Cuanto tengo libre para gastar?"

Done:

- Agente responde usando tools, no SQL libre.
- Respuesta cita datos resumidos, no razonamiento interno.
- Si faltan datos, lo dice con claridad.
- Consultas historicas funcionan por rango de fechas.

### Corte 11 - Insights, Nudges Y Learning Inicial

Objetivo: agregar inteligencia de producto con control emocional y politico.

Incluye:

- Insight Signal Engine.
- InsightExperienceAgent.
- InsightNarratorAgent.
- NudgePolicyEngine.
- Learning signals.
- Reglas de frecuencia por canal.
- Opt-in, horario silencioso y modo discreto.
- Worker de insights.
- Worker de nudges.
- Lifecycle inicial:
  - `onboarding_started`,
  - `first_value_reached`,
  - `activated_light`,
  - `activated_strong`,
  - reengagement solo con opt-in y politica.

Done:

- Primer insight util aparece con triggers definidos.
- Insight positivo/progreso existe.
- Insight sensible pasa por politica.
- Nudge no se envia fuera de opt-in/horario.
- Learning guarda patrones sin sobrepersonalizar ni invadir.
- Lifecycle no empuja mensajes si el usuario no dio permiso o esta en horario silencioso.

---

## 6. Que Puede Quedar Mockeado Temporalmente

Durante implementacion inicial se puede mockear:

- WhatsApp Flow avanzado y templates proactivos fuera de ventana, hasta cerrar confirmaciones simples y politica de ventana.
- AgentRuntime, con fixtures estructurados, para probar Core.
- Gmail Pub/Sub, usando eventos simulados.
- Insight generation, usando candidatos seed.
- Observabilidad externa, usando logger local.

Pero no se debe mockear como si fuera final:

- Core financiero.
- RLS.
- Audit log.
- Outbox.
- Idempotencia.
- Separacion pending vs movement.
- CommandDispatcher.
- Validacion de schemas.

---

## 7. Orden De Migraciones Inicial

Usar el orden de `16_modelo_datos.md` como base, con este agrupamiento de implementacion:

1. Extensions, enums y helpers.
2. Usuarios y preferencias.
3. Categorias, tags y seeds.
4. Cuentas y cajas.
5. Movimientos, audit log y movement tags.
6. Pending items.
7. Eventos y outbox.
8. Conversacion, agent traces y WhatsApp window states.
9. Deudas.
10. Recurrentes.
11. Insights y nudges.
12. Email connections/messages.
13. Learning signals.
14. Indices y RLS final.

No crear migraciones SQL fuera de este orden sin actualizar `16_modelo_datos.md`.

---

## 8. Estructura Recomendada De Codigo

```text
src/
  app/
    api/
    (dashboard)/
  core/
    commands/
    validators/
    engines/
    events/
  adapters/
    whatsapp/
    email/
  agents/
    runtime/
    data-agent/
    conversation-agent/
    correction-agent/
    response-agent/
    insights/
  workers/
    outbox/
    pending/
    recurring/
    insights/
    nudges/
    email/
  shared/
    schemas/
    types/
    money/
    dates/
    telemetry/
  data/
    repositories/
    migrations/
```

Regla:

- `app/api` llama servicios/comandos, no contiene logica financiera.
- `core` no importa adapters externos.
- `agents` no importan repositories directos.
- `workers` son idempotentes.
- `shared/schemas` se puede usar en API, agentes, workers y Core.

---

## 9. Gates De Calidad Por Corte

Cada corte debe pasar:

| Gate | Requisito |
|---|---|
| Typecheck | TypeScript sin errores. |
| Tests unitarios | Validadores, comandos y motores principales. |
| Tests de integracion | DB/Core/API para flujos financieros. |
| RLS smoke test | Usuario A no ve datos de usuario B. |
| Idempotencia | Repetir comando/evento no duplica efecto. |
| Auditabilidad | Cambios financieros dejan audit log. |
| Observabilidad | Errores y eventos relevantes quedan trazados. |
| UX smoke | Flujos principales visibles no tienen estados rotos. |

Antes de conectar usuarios reales:

- probar registro simple,
- registro multiple,
- correccion,
- pendiente confirmado,
- pendiente descartado,
- movimiento manual Dashboard,
- pregunta read-only,
- email detectado sin auto-registro,
- WhatsApp inbound/outbound real en staging.

---

## 10. Prompts Recomendados Para Cursor/Claude Code

### Primer prompt de implementacion

```text
Lee primero:
- especificacion_producto_finanzas_personales_ia.md
- docs/fase_2_estrategia/alcance_v1/indice.md
- docs/fase_3_producto/indice.md
- docs/fase_4_tecnica/indice.md
- docs/fase_4_tecnica/23_plan_implementacion_v1.md

Implementa solo el Corte 0 y prepara estructura para los cortes siguientes.
No implementes features fuera del corte.
No escribas logica financiera fuera de core.
Al terminar, ejecuta typecheck/test/build si existen y reporta gaps.
```

### Prompt para Core

```text
Implementa el Corte 2 del plan.
Usa docs/fase_4_tecnica/16_modelo_datos.md, 18_api_spec.md y 20_decisiones_tecnicas.md.
Toda escritura financiera debe pasar por CommandDispatcher y Core.
Incluye tests de gasto, ingreso, correccion, eliminacion/reversa, auditoria e idempotencia.
```

### Prompt para WhatsApp

```text
Implementa el Corte 5.
Usa Kapso via WhatsAppAdapter como proveedor operativo V1.
No agregues Twilio, 360dialog, WATI, Zoko, respond.io, Evolution API, WhatsApp Web automation ni QR.
El webhook debe normalizar, deduplicar, guardar external_event_log y responder rapido.
```

---

## 11. Fuera De Este Plan V1

No construir todavia:

- pricing final,
- unit economics detallado,
- legal completo,
- GTM,
- integraciones bancarias directas,
- multi-moneda UI completa,
- metas/limites formales completas,
- OCR/voz en produccion,
- multiusuario/equipos,
- proveedores alternos Twilio/360dialog/respond.io/Evolution/QR para WhatsApp,
- Outlook/IMAP/forwarding para email.

---

## 12. Criterios De Aceptacion Del Plan

Este plan esta listo para usarse cuando:

- un agente de codigo puede saber por donde empezar sin inventar orden;
- cada corte tiene objetivo, alcance y done;
- los invariantes no negociables estan visibles;
- WhatsApp queda definido como Kapso via WhatsAppAdapter;
- Email queda definido como Gmail OAuth/API con confirmacion;
- pendientes y movimientos quedan separados;
- Core, outbox, RLS y ToolGateway no quedan como "despues";
- queda claro que IA se suma sobre un dominio financiero confiable, no lo reemplaza.

---

## 13. Resumen

El primer objetivo de implementacion no es impresionar con IA. Es demostrar que Manzana puede registrar, corregir, auditar y consultar dinero sin perder consistencia.

Despues de eso, WhatsApp, agentes, email, insights y nudges se vuelven una ventaja real, porque se apoyan sobre una base que no improvisa.

*Fase 4 Tecnica - Documento 23 - V1.5*
