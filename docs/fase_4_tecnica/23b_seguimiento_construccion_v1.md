# 23b - Seguimiento De Construccion V1

**Estado:** Vivo - Seguimiento operativo de implementacion  
**Ultima actualizacion:** 23 de julio, 2026  
**Depende de:** `23_plan_implementacion_v1.md`, `20_decisiones_tecnicas.md`, Fase 6 Visual V1, codigo en `src/`  

---

## 1. Proposito

Este documento registra el estado real de construccion de Manzana V1.

No reemplaza el plan de implementacion.  
El plan (`23_plan_implementacion_v1.md`) dice que se debe construir.  
Este documento dice que ya se construyo, que esta parcial, que esta mockeado, que pruebas pasaron y que queda pendiente.

Regla:

```text
Si se cierra un corte, pantalla, migracion, endpoint o decision tecnica durante construccion,
actualizar este documento antes de continuar con el siguiente bloque importante.
```

---

## 2026-06-10 - Paquete De Identidad Publica Para Meta

Estado: completado a nivel base.

Cambios:

- Se agregaron rutas publicas sin login:
  - `/empresa`
  - `/privacidad`
  - `/terminos`
  - `/contacto`
  - `/eliminar-datos`
- Se centralizaron datos publicos configurables en `src/shared/public-identity.ts`.
- Se agregaron variables de entorno publicas de identidad en `.env.local.example`.
- Se actualizo `src/proxy.ts` para permitir las rutas publicas sin Supabase session refresh.
- Se creo `docs/fase_4_tecnica/24_paquete_identidad_meta.md` con checklist de dominio, correo, operador legal, documentos y datos para Meta.
- Se actualizo `docs/fase_4_tecnica/indice.md` para incluir el nuevo paquete.
- Se cambiaron las fuentes globales a `next/font/local` con archivos WOFF2 locales para que el build no dependa de descargar Google Fonts.

Notas:

- No se hardcodearon datos legales/contacto reales en el repo; viven en variables de entorno de Vercel.
- Antes de reenviar verificacion a Meta, verificar que `manzana.website` siga mostrando identidad publica completa y sin campos pendientes.
- Si la web vuelve a mostrar campos "pendiente de configurar", no esta lista para enviarse a Meta.

Siguiente:

- Comprar o elegir dominio propio.
- Crear correos del dominio.
- Configurar variables de identidad en Vercel.
- Redeployar y validar que las paginas publicas no muestran pendientes.

---

## 2. Estado General Actual

| Area | Estado | Nota |
|---|---|---|
| Workspace Next.js/TypeScript | Implementado | App local corriendo en `http://127.0.0.1:3100`. |
| Supabase local | Implementado | `.env.local` apunta a Supabase local y health check responde OK. |
| Auth inicial | Implementado | Login/signup con Supabase Auth y pantalla propia. |
| Migraciones base | Parcial avanzado | Existen migraciones `001` a `036`, incluidas captura Gmail, calidad de parser, dedup de contenido/backfill y health de dead letters. El historial `001`-`036` esta alineado local/remoto en produccion. |
| Core financiero inicial | Implementado parcial | `CommandDispatcher`, movimientos, audit log, repositorios y APIs iniciales existen. |
| Onboarding inicial | Implementado y desplegado | Progresion monotona `not_started -> started -> first_value_reached`, outbox atomico, inicio explicito, primer valor por movimiento/pendiente/deuda y Home responsive con una sola accion principal. No toca dinero. |
| Home Dashboard | Implementado parcial real | `GET /api/v1/dashboard/home` agrega onboarding, cuentas, cajas, movimientos confirmados, pendientes, proximos recurrentes, cuotas de deuda proximas, avisos dashboard y calidad de datos sin inventar saldos cuando no hay cuentas. |
| Movimientos Dashboard | Implementado parcial | Lista conectada a API real y formulario manual inicial. |
| Pendientes Dashboard | Implementado avanzado real | `pending_items`, API, UI conectada, seleccion explicita, confirmacion/rechazo batch, edicion tipada, "Ya lo registre", dedup y confirmaciones atomicas especializadas existen. Ningun Pendiente afecta saldos antes de pasar por Core. |
| Mi Dinero | Implementado parcial real | `GET /api/v1/money`, cuentas y cajas base reales existen. Crear caja con monto inicial usa `asignacion_interna` via Core. Compromisos recurrentes y cuotas de deuda alimentan dinero libre operativo como calculo read-only. |
| Deudas Dashboard | Implementado parcial real | Crear/listar deudas, registrar pagos/cobros via Core, detalle/historial V1, cuotas/vencimientos persistidos, conciliacion atomica pago-cuota, deep-link seguro y avisos `debt_due` existen. Faltan operaciones avanzadas y observabilidad operacional. |
| Pagos que vienen | Implementado parcial real | Recurrentes y cuotas de deuda comparten la vista dedicada, Home/Mi Dinero, acciones seguras y detalle/historial. Pagos/cobros pasan por Core y solo la cuota abierta mas antigua permite accion directa. |
| Nudges / avisos utiles | Implementado avanzado, activacion controlada | Elegibilidad, opt-in, horario silencioso, frecuencia, ventana de WhatsApp, Risk Policy y Disclosure son deterministas. `NudgeExperienceAgent` solo adapta framing despues de la decision. El worker multicanal Dashboard/WhatsApp, deliveries, templates y modo `planned` existen. Un piloto real de cohorte unica ya fue aceptado por Kapso; la activacion volvio a `planned` con kill switch apagado. Nunca toca dinero. |
| Descubrimientos / insights | Implementado avanzado y desplegado | Senales, calculos, evidencia, ranking, expiracion y feedback son deterministas. Existen proyeccion cautelosa, contexto por tags, lifecycle, Experience/Narrator con hechos bloqueados, API de lista/detalle/evidencia/seen/dismiss/action y pantalla real con QA desktop/mobile. El envio proactivo sigue apagado hasta completar opt-in, template y QA operativo. |
| Navegacion Dashboard | Implementada parcial | `DashboardApp` abre Home por defecto, conserva la vista en URL con `?view=` y soporta deep link a Pendientes; varias secciones posteriores siguen en placeholder. |
| Fase 6 visual aplicada | En progreso avanzado | Corte inicial de alineacion Stitch aplicado a tokens, Auth, AppShell, Movimientos, Pendientes y modal manual. |
| WhatsApp real | Implementado parcial real | Kapso operativo en staging, webhook verify/inbound, normalizacion provider, idempotencia externa, handoff agentic, agentes API con fallback seguro, PolicyGate, Core para registros directos y comando especializado para pago de deuda. El gate humano estricto cubrio cinco escenarios sin violaciones financieras. El primer template Utility esta `APPROVED`; el piloto de un usuario produjo exactamente un envio y su estado real `read` quedo reconciliado. Flow permanece pendiente. |
| AgentRuntime | Implementado avanzado API-ready | Contrato `AgentRuntime`, `RuntimeRouter`, HTTP adapter `api/codex`, OpenAI Responses API con Structured Outputs, provider por agente, fallback trazado, tool loop read-only para `ConversationAgent`, planner semantico, `CorrectionAgent` y `ResponseAgent` reales. El planner usa timeout configurable de 15 s y errores tipados. Falta monitoreo historico de costo/p95/fallback con volumen real. |
| Conversacion y busqueda natural | Implementado avanzado real | `OrchestrationPlanningAgent` es autoridad semantica para texto libre; el compilador seguro valida sin reinterpretar. `ConversationAgent` con function calling, `CorrectionAgent`, `ToolGateway`, `ConversationWorkingSet`, estilo libre persistente, consultas activas, borradores y pendientes acotados ya existen. El corte pasa eval API; falta QA humano final por WhatsApp y ampliar memoria narrativa con uso real. |
| Gmail/email real | Motor V1 implementado; BCP preparado para shadow con consentimiento | OAuth `gmail.readonly`, watch, Pub/Sub, History, extractor agentic con grounding, auth DKIM/DMARC, Pendientes/Core especializado, dedup, backfill, privacidad y health. Ninguna institucion se anuncia soportada: `active` exige consentimiento versionado, shadow medido, cero errores criticos, grounding >=99%, fallback <10%, cohorte minima y monitoreo. |
| Outbox/eventos/workers | Implementado real V1 | `external_event_log`, `transactional_outbox`, `internal_event_log`, worker publisher, handler de ciclo de deuda, `worker_job_runs`, snapshot de lag, replay protegido, contrato de scheduler externo y job real en cron-job.org existen. Falta alertas externas avanzadas/UI admin solo si se decide operacion manual. |

---

## 3. Cortes De Implementacion

### Corte 0 - Workspace Y Base Tecnica

**Estado:** Completado inicial

Implementado:

- Next.js App Router + TypeScript.
- Tailwind v4 y componentes UI compartidos.
- Estructura `src/app`, `src/core`, `src/data`, `src/features`, `src/shared`, `src/workers`, `src/agents`, `src/adapters`.
- Supabase local configurado.
- Health endpoint.
- Vitest.
- ESLint.
- Build Next.js.

Evidencia:

- `npm run typecheck` OK.
- `npm test` OK.
- `npm run build` OK.
- `GET /api/health` responde `status: ok`.

Pendiente:

- Convertir warning existente de `.cursor/stitch-proxy.mjs` en excepcion ignorada o corregirlo si se decide limpiar tooling.

### Corte 1 - Datos, Auth Y RLS Inicial

**Estado:** Parcial avanzado

Implementado:

- Migraciones:
  - `001_extensions_enums.sql`
  - `002_profiles_preferences.sql`
  - `003_categories_tags.sql`
  - `004_accounts_boxes.sql`
  - `005_rls.sql`
- Tipos de dominio base en `src/shared/types/domain.ts`.
- Supabase Auth integrado.
- Pantalla de login/signup.

Pendiente:

- UI completa de cuentas/cajas.
- Validar seeds de categorias en ambiente limpio.

### Corte 2 - Core Financiero Inicial

**Estado:** Implementado parcial

Implementado:

- Migracion `006_movements_core.sql`.
- Tabla `movements`.
- Tabla `movement_audit_log`.
- Tabla `movement_tags`.
- RPCs controladas para commit de movimientos.
- `CommandDispatcher`.
- `BalanceEngine` inicial.
- Repositorio Supabase para movimientos.
- Endpoints:
  - `GET /api/v1/movements`
  - `POST /api/v1/movements`
  - `GET /api/v1/movements/[id]`
  - `PATCH /api/v1/movements/[id]`
  - `DELETE /api/v1/movements/[id]`
- Tests de comandos, dominio, money y schemas.

Reglas preservadas:

- Las escrituras financieras pasan por Core/CommandDispatcher.
- `account_origin_id` puede ser `null`.
- Movimientos confirmados viven separados de pendientes.

Pendiente:

- Integrar `transactional_outbox` real.
- Ampliar pruebas de integracion DB con auditoria e idempotencia en Supabase limpio.
- Alinear borrado/reversa con politica final de producto si se agregan modales de riesgo.

### Corte 3 - Dashboard V1 Operativo

**Estado:** En progreso

Implementado:

- `DashboardApp` como contenedor de app autenticada.
- `AppShell` con navegacion interna.
- Tokens visuales globales ajustados a la paleta Stitch/Manzana V1.
- Componentes base ajustados: botones, cards, inputs/selects, estados vacios/loading/error y texto monetario discreto.
- Pantalla `Auth` alineada con el estilo de login de Stitch: entrada centrada, confianza visible y jerarquia mas sobria.
- `AppShell` alineado con sidebar Stitch, navegacion mobile y CTAs por pantalla.
- Pantalla `Movimientos` alineada visualmente con Stitch `32._movements_functional`.
- Formulario manual de nuevo movimiento reconstruido contra Stitch `44._nuevo_movimiento_gasto` y Doc 32: monto protagonista, impacto visible antes de guardar, footer reservado, scroll interno y bloqueo del fondo.
- Pantalla `Pendientes` alineada con Stitch `60._pending_functional`, `61._pending_empty`, `62._pending_batch` y variantes relacionadas.
- Pantalla `Home` conectada a API real:
  - dinero libre solo se calcula si existen cuentas;
  - pendientes activos se muestran como proteccion, no como movimientos;
  - movimientos recientes salen de `movements` confirmados;
  - calidad de datos explicita movimientos sin cuenta;
  - accion sugerida prioriza pendientes o primera cuenta segun el estado.
- Endpoint `GET /api/v1/dashboard/home` como agregador read-only para Home.
- Modo discreto basico en Movimientos y Pendientes.
- Bottom nav mobile usa etiquetas cortas para evitar solape sin cambiar nombres completos en desktop.
- Capturas QA desktop/mobile en `.artifacts/` contra build de produccion local.

Pendiente:

- Extender onboarding desde primer valor hacia activacion/retorno temprano si se
  autoriza ese corte; el inicio y primer valor reales ya estan implementados.
- Completar Mi Dinero: edicion de cuentas, edicion/eliminacion segura de cajas y movimientos entre cajas.
- Detalle de movimiento.
- Edicion completa de movimiento.
- Estados loading/error/vacio completos por pantalla real.
- Rutas o estado persistente de navegacion.
- Extender alineacion visual al resto de pantallas reales: Home, Mi Dinero, Deudas, Pagos que vienen, Descubrimientos, Configuracion y detalle/edicion.

### Corte 4 - Eventos, Outbox Y Workers Base

**Estado:** Implementado parcial real

Implementado:

- Migracion `008_events_outbox.sql`.
- Tabla `external_event_log` para eventos de entrada.
- Tabla `transactional_outbox` para eventos internos.
- Tabla `internal_event_log` para consumo idempotente por consumer.
- RPCs:
  - `claim_outbox_events`
  - `mark_outbox_published`
  - `mark_outbox_failed`
  - `record_internal_event_processing`
- Core financiero escribe eventos `movement_*` en outbox dentro del commit RPC.
- Pendientes escribe `pending_confirmed` en la misma transaccion que crea movimiento cuando el usuario confirma.
- Pendientes sigue escribiendo `pending_edited` y `pending_discarded` desde backend controlado.
- Worker `outbox_publisher` base.
- Ruta interna `POST /api/internal/workers/outbox`.
- Retry/dead letter basico via `attempt_count`, `max_attempts`, `next_attempt_at` y `status`.

Reglas preservadas:

- Eventos externos e internos estan separados.
- El cliente autenticado no lee ni escribe outbox/logs.
- El worker reclama eventos de forma atomica via DB.
- Si un movimiento se crea por Core, su evento `movement_created` nace en el mismo RPC de commit.

Pendiente:

- Registrar handlers reales por consumidor: balances/projections, insights, recurring, nudges, learning.
- Configurar `WORKER_SECRET` en entorno no local.
- Agregar observabilidad/metricas de lag.
- Formalizar replay manual controlado para dead letter.

Nota:

Este corte ya permite conectar canales externos con menos fragilidad, pero todavia no reemplaza workers durables completos ni handlers de producto.

### Corte 5 - WhatsApp V1

**Estado:** En progreso parcial real; proveedor operativo actualizado a Kapso

Implementado:

- `WhatsAppAdapter`.
- Webhook verification.
- Webhook inbound.
- Normalizacion de eventos.
- `whatsapp_window_states`.
- Sender outbound Meta Cloud inicial, reemplazado operativamente por sender Kapso.
- `whatsapp_delivery_attempts`.
- `WhatsAppWindowManager` base.
- Handoff minimo a `FinancialOrchestrator`.
- `ResponsePlanner` minimo conservador.

Detalle implementado:

- Adapter `meta_cloud` inicial para normalizar mensajes inbound y status de delivery; la ruta operativa actual usa `kapso` detras del mismo contrato.
- WindowManager puro para decidir `freeform`, `interactive`, `template`, `app_only` o `blocked`.
- Calculo de estado `open`, `closing_soon` y `closed`.
- Elegibilidad de prompt principal 12h y prompt opcional 20h.
- Guardrails de envio por opt-in, horario silencioso, valor accionable, sensibilidad y caps de templates.
- Repositorio de ventana permite marcar prompts 12h/20h, actualizar status y contar templates pagados.
- Builder de payload outbound para:
  - `freeform` dentro de ventana,
  - `template` fuera de ventana,
  - `interactive` con botones.
- Sender `sendMetaCloudMessage` contra Meta Graph API.
- Servicio `sendTrackedWhatsAppMessage` con idempotencia previa al envio.
- Registro de intentos outbound en `whatsapp_delivery_attempts`.
- Error provider normalizado via `WhatsAppSenderError`.
- Validacion de challenge `GET /api/webhooks/whatsapp`.
- Validacion opcional/obligatoria de firma `X-Hub-Signature-256`:
  - obligatoria en `staging`/`production`,
  - permitida sin firma en `APP_ENV=local` si no hay `WHATSAPP_APP_SECRET`.
- Endpoint `POST /api/webhooks/whatsapp`.
- Registro idempotente en `external_event_log` por `provider_message_id`.
- Encolado idempotente de handoff interno en `transactional_outbox` con `id = external_event.id`.
- Handler `financial_orchestrator.whatsapp_inbound` conectado al worker outbox.
- `FinancialOrchestrator` minimo acepta mensajes de texto WhatsApp y marca el evento externo como `accepted`.
- `ResponsePlanner` marca `no_response / agent_runtime_required` por defecto para no enviar respuestas pobres antes de AgentRuntime.
- Mensajes no texto o sin usuario se marcan como ignorados/procesados sin tocar Core.
- Status de delivery guardados como evento externo separado y reconciliados contra `whatsapp_delivery_attempts` por `provider_message_id`.
- El webhook reporta `statuses_reconciled` para distinguir status recibido vs intento outbound actualizado.
- Lookup de usuario por `profiles.phone_e164`.
- Renovacion de ventana 24h solo cuando llega mensaje del usuario.
- Migracion `010_whatsapp_windows.sql` aplicada a `src/data/migrations` y `supabase/migrations`.
- Migracion `011_whatsapp_delivery_attempts.sql` aplicada a `src/data/migrations` y `supabase/migrations`.
- `.env.local.example` documenta variables WhatsApp.
- `.env.local.example` incluye `MANZANA_APP_URL` / `NEXT_PUBLIC_MANZANA_APP_URL` para deep links y staging.
- Smoke `npm run smoke:whatsapp:staging-readiness` valida variables, entorno y guardrails antes de activar envio real.

Pendiente:

- Templates utility minimos.
- Conectar `WhatsAppWindowManager` con decisiones reales de `ResponsePlanner`/orquestador.
- Ajustar reset de contadores de templates a timezone de usuario cuando se conecte `Profile/UserPreferences`.
- Registro natural ya tiene `DataAgent` y `ResponseAgent` locales; Corte 22A agrego runtime `api=openai`, pendiente de key/modelo y QA real.
- Respuesta conversacional real desde `ResponsePlanner` cuando exista AgentRuntime/plantillas aprobadas.
- Conectar `sendTrackedWhatsAppMessage` desde `ResponsePlanner`/orquestador, no desde UI directa.
- Completar blockers del readiness y probar con Meta Developer App/staging real.
- Retencion/payload_ref cifrado si se requiere replay completo de raw payloads.

Regla:

No usar proveedores alternos, APIs no oficiales, sesiones QR ni WhatsApp Web automation fuera de la decision vigente. Desde 2026-06-16 la decision operativa es Kapso via `WhatsAppAdapter`.

### Corte 6 - AgentRuntime Y Registro Por Lenguaje Natural

**Estado:** Implementado parcial local

Implementado:

- Contrato `AgentRuntime`.
- `RuntimeProvider` preparado para `codex`, `api` y `local_fixture`.
- `RuntimeRouter` enruta por provider solicitado y puede caer a `local_fixture` con safety flags.
- `HttpAgentRuntime` preparado para endpoints `api` y `codex` via variables de entorno.
- Configuracion por agente:
  - `AGENT_RUNTIME_DEFAULT_PROVIDER`,
  - `AGENT_RUNTIME_DATA_AGENT_PROVIDER`,
  - `AGENT_RUNTIME_RESPONSE_AGENT_PROVIDER`,
  - endpoints/tokens/modelos `AGENT_RUNTIME_API_*` y `AGENT_RUNTIME_CODEX_*`.
- `DataAgent` y `ResponseAgent` ya leen provider configurable sin cambiar su contrato.
- `DataAgent`.
- `DataContextPack` minimo.
- `DataAgentOutputSchema`.
- `ProposedActionSchema`.
- Runtime local fixture para desarrollo/tests.
- Extraccion estructurada de:
  - `gaste 8 cafe`,
  - `hoy gaste 8 cafe, 15 taxi y 20 almuerzo`.
- `FinancialOrchestrator` invoca `DataAgent` para mensajes de texto WhatsApp conocidos.
- `DataActionPolicy`/PolicyGate inicial convierte propuestas en un plan financiero seguro:
  - listo para Core,
  - requiere confirmacion,
  - bloqueado,
  - sin accion.
- El PolicyGate valida tipo, monto, categoria, sensibilidad, confianza, cuenta resuelta y motores especializados pendientes.
- `DataActionExecutor` ejecuta planes `ready_for_core` via `CommandDispatcher`.
- La ejecucion usa idempotencia por `external_event_id + action_id`.
- Existe smoke repetible `npm run smoke:whatsapp:idempotency` para validar retries de Meta con el mismo `provider_message_id`.
- `WHATSAPP_EXECUTE_READY_ACTIONS` permite activar ejecucion fuera de local; en `APP_ENV=local` queda habilitado para desarrollo y smoke.
- `DataActionPending` crea `pending_items` para acciones `requires_confirmation`.
- La creacion de pendientes usa `source_ref = whatsapp:<external_event_id>:<action_id>` para idempotencia.
- `ResponsePlanner` compone respuesta segura segun resultado real:
  - movimiento creado,
  - multiples movimientos creados,
  - pendiente separado para revision,
  - pendiente confirmado desde WhatsApp,
  - pendiente descartado desde WhatsApp.
- Los payloads estructurados de botones y codigos `P-XXXXXXXX` se resuelven de
  forma deterministica. El lenguaje libre de confirmacion, descarte o listado se
  interpreta primero con el plan semantico y el Core valida el objetivo exacto.
- `ver pendientes` lista hasta 5 pendientes activos sin confirmar, descartar ni crear movimientos.
- La lista incluye codigos estables derivados de `user_id + pending_id` con formato `P-XXXXXXXX`.
- El usuario puede escribir `confirmar P-XXXXXXXX` o `cancelar P-XXXXXXXX` para actuar sobre un pendiente especifico, incluso si hay varios activos.
- Las respuestas de pendientes pueden incluir deep link a `?view=pending` cuando `MANZANA_APP_URL`, `NEXT_PUBLIC_MANZANA_APP_URL` o `APP_ENV=local` permiten construir URL segura.
- El Dashboard abre directamente Pendientes con `/?view=pending`; si no hay sesion, conserva el query durante login y aterriza luego en Pendientes.
- `ResponsePlanner` puede planificar `whatsapp_interactive` con botones `Confirmar` y `Descartar` para un pendiente unico no sensible.
- Pendientes sensibles o de alto riesgo siguen con texto + link, sin botones.
- `maybeSendWhatsAppResponse` ya puede enviar `interactive` por el proveedor activo del `WhatsAppAdapter` cuando el flag de envio real y credenciales esten activos.
- Si hay un unico pendiente activo:
  - confirma via `confirmPendingItemWithCore` y Core,
  - o descarta via backend controlado sin crear movimiento.
- Si no hay pendientes, o hay varios sin codigo especifico, pide aclaracion sin crear ni descartar movimientos.
- `maybeSendWhatsAppResponse` puede enviar por Kapso en V1 solo con `WHATSAPP_SEND_RESPONSES=true` y credenciales completas del proveedor.
- `ResponseAgent` local fixture mejora copy de respuestas WhatsApp sin escribir Core ni tocar reglas financieras.
- `ResponseContextPack` separa texto base, escenario, hechos a preservar, restricciones de canal y modo discreto.
- `ResponseAgentEnhancer` rechaza respuestas que pierden montos, codigos `P-XXXXXXXX`, links o frases de seguridad como saldo protegido.
- En respuestas interactivas, el enhancer actualiza tambien `interactive.bodyText` para no desalinear texto y botones.
- Si `ResponseAgent` falla o es rechazado, se conserva el texto deterministico de `ResponsePlanner`.
- El resultado queda trazado en `external_event_log.metadata`:
  - `data_agent_intent`,
  - `data_agent_confidence`,
  - `proposed_actions_count`,
  - `proposed_actions`,
  - `data_agent_ambiguities`,
  - `agent_runtime_provider`,
  - `financial_action_plan_kind`,
  - `financial_action_plan_actions`,
  - `financial_action_execution_kind`,
  - `financial_action_execution_movements`,
  - `pending_creation_kind`,
  - `pending_creation_items`,
  - `pending_resolution_kind`,
  - `pending_resolution_action`,
  - `pending_resolution_code`,
  - `pending_resolution_reason`,
  - `pending_resolution_pending_count`,
  - `pending_resolution_movement_id`,
  - `response_plan_text`,
  - `response_agent_status`,
  - `response_agent_reason`,
  - `response_agent_confidence`,
  - `response_agent_provider`,
  - `response_agent_model`,
  - `response_agent_latency_ms`,
  - `response_agent_safety_flags`,
  - `response_interactive_button_count`,
  - `response_send_kind`.
- Si no hay resultado de producto, `ResponsePlanner` sigue siendo conservador y no responde.

Pendiente:

- Configurar `OPENAI_API_KEY`/modelo o endpoint externo y validar QA real detras de `AgentRuntime`.
- Activar envio real por WhatsApp cuando existan WABA/token, copy aprobado y Meta staging.
- Flow, templates proactivos fuera de ventana y QA real de modelos/proveedor para agentes.

Regla:

Agentes proponen; PolicyGate decide; Core valida y escribe. El runtime `local_fixture` no es motor de IA de produccion y la ejecucion fuera de local requiere flag explicito.

### Corte 7 - Pendientes Y Confirmaciones Reales

**Estado:** Implementado parcial real

Implementado:

- Migracion `007_pending_items.sql` en `src/data/migrations` y `supabase/migrations`.
- Tabla `pending_items` con RLS: cliente autenticado solo lee sus pendientes.
- Repositorio `pending.repository.ts`.
- API:
  - `GET /api/v1/pending`
  - `GET /api/v1/pending/[id]`
  - `PATCH /api/v1/pending/[id]`
  - `POST /api/v1/pending/[id]/confirm`
  - `POST /api/v1/pending/[id]/discard`
- Confirmar pendiente crea movimiento via `CommandDispatcher` y Core.
- Servicio compartido `confirmPendingItemWithCore` reutilizado por API y WhatsApp.
- Confirmacion usa idempotencia `pending-confirm:<pending_id>`.
- Confirmacion atomica via RPC `confirm_pending_with_movement`.
- Confirmacion escribe `movement_created` y `pending_confirmed` dentro de la misma transaccion DB.
- Editar pendiente actualiza `normalized_summary` y marca `user_edited`.
- Descartar pendiente marca `discarded` y conserva metadata minima.
- UI de Pendientes conectada a API real.
- Pantalla `Pendientes` con:
  - banner de proteccion,
  - revision en grupo,
  - cards por pendiente,
  - confirmar,
  - editar,
  - rechazar,
  - modo discreto,
  - estado vacio,
  - QA desktop/mobile.
- Tipos `PendingItem`, `PendingSource`, `PendingType`.
- View model con tests.

Reglas preservadas:

- Un pendiente no afecta saldos.
- El cliente no inserta, actualiza ni elimina `pending_items` directamente.
- Confirmar un pendiente pasa por Core/CommandDispatcher.
- Reintentar una confirmacion ya aplicada devuelve respuesta idempotente y no duplica outbox.
- Confirmar por WhatsApp solo aplica automaticamente cuando hay exactamente un pendiente activo.

Pendiente real:

- Pruebas de integracion DB para confirmar que un pending no cambia saldos hasta que se confirma.
- Endurecer atomicidad de editar/descartar pendiente si se exige evento garantizado para esos estados.

### Cortes 8 A 11

**Estado:** Iniciados parcialmente

Incluyen:

- Cuentas/cajas base reales en progreso; falta completar edicion, eliminacion segura y movimientos entre cajas.
- Deudas.
- Recurrentes.
- Gmail V1.
- Busqueda natural.
- ConversationAgent.
- Insights.
- Nudges.
- Learning inicial.

---

## 4. Referencias Visuales Usadas Durante Construccion

| Pantalla implementada | Referencias usadas | Estado |
|---|---|---|
| Movimientos | `stitch_manzana_v1/32._movements_functional` | Aplicada como guia visual. |
| Pendientes | `60._pending_functional`, `61._pending_empty`, `62._pending_batch`, `63-65` | Aplicada como guia visual. |
| Auth | Pantallas `5-13` como referencia parcial | Alineacion inicial aplicada. |
| Nuevo movimiento | `44._nuevo_movimiento_gasto`, variantes `45-54` y Doc 32 seccion 21.10 | Rehecho como modal profesional: selector primario + otros tipos, monto protagonista, impacto contextual, campos con icono, footer sin solape y bloqueo de tipos que requieren cuenta/caja/riesgo. |
| Mobile nav | Referencias mobile Fase 6 + QA real | Ajustado para no solapar textos. |

Regla:

```text
Stitch guia composicion, jerarquia y estilo.
La implementacion real puede agregar/quitar acciones si el producto lo necesita.
Fase 6 gana cuando haya conflicto con una pantalla generada.
```

---

## 5. Pruebas Y QA Actual

Ultima verificacion ejecutada:

| Comando | Resultado |
|---|---|
| `npm run typecheck` | OK |
| `npm test` | OK - 315 tests; smoke OpenAI de `ResponseAgent` queda opt-in y no corre en suite normal |
| `npm run build` | OK |
| `npm run lint` | OK con 1 warning existente en `.cursor/stitch-proxy.mjs` |
| `npm run smoke:rls` | OK - usuarios A/B, movimientos, pendientes, audit log, escrituras directas bloqueadas y API con `user_id` autenticado |
| `npm run smoke:whatsapp:idempotency` | OK - retry con mismo `provider_message_id` no duplica `external_event_log`, handoff outbox, pendiente, movimiento ni respuesta planificada |
| `npm run smoke:whatsapp:pending-codes` | OK - lista codigos estables, cancela un pendiente por codigo, confirma otro por codigo, deja el resto intacto |
| `npm run smoke:whatsapp:delivery-status` | OK - `delivered` y `failed` actualizan `whatsapp_delivery_attempts`; retry duplicado reconcilia sin duplicar evento externo |
| `npm run smoke:whatsapp:staging-readiness` | OK - modo local seguro sin envio real; `--strict` falla con blockers esperados hasta tener credenciales Meta y staging publico |
| `npm run smoke:whatsapp:agent-traces` | OK - auditor read-only de trazas reales; detecta DataAgent/ResponseAgent/Core/Pendientes/Correcciones por `external_event_log`; modo `--strict` queda pendiente hasta repetir QA real con respuestas sendable recientes en API |
| Tests ResponseAgent | OK - mejora copy, preserva monto/link, frases de seguridad, rechaza respuestas que pierden hechos y smoke real OpenAI opt-in pasa |
| Tests AgentRuntime | OK - config por agente, router con fallback local, HTTP adapter `api/codex`, runtime `api=openai` con Structured Outputs mockeado y smoke real para `ResponseAgent` |
| Browser deep link `/?view=pending` | OK - sin sesion conserva query; tras login local aterriza en Pendientes; navegar a Movimientos limpia el query |
| Smoke HTTP `GET/POST /api/webhooks/whatsapp` | OK - challenge, inbound simulado, idempotencia por duplicado y limpieza de evento smoke |
| Smoke HTTP WhatsApp handoff + worker | OK - usuario con `phone_e164`, inbound conocido, outbox handoff, duplicado idempotente, worker procesa y evento externo queda `accepted` |
| Smoke HTTP WhatsApp ResponsePlanner | OK - worker deja `response_plan_kind = no_response`; tras DataAgent, `response_plan_reason = response_agent_required` |
| Smoke HTTP WhatsApp DataAgent | OK - usuario con `phone_e164`, "gaste 8 cafe", DataAgent propone 1 gasto S/8 alimentacion |
| Smoke HTTP WhatsApp Core execution | OK - con cuenta default, `financial_action_plan_kind = ready_for_core`, `execution_kind = executed`, crea 1 gasto S/8 y baja cuenta de S/100 a S/92 |
| Smoke HTTP WhatsApp claro sin cuenta | OK - sin cuenta, `financial_action_plan_kind = ready_for_core`, crea movimiento con `account_origin_id = null`, no afecta saldo de cuenta y no crea pendiente |
| Smoke HTTP WhatsApp directo despues de pendientes | OK - con cuenta default, crea 1 movimiento y 0 pendientes |
| Smoke HTTP WhatsApp respuesta creada | OK - con cuenta, `response_plan_reason = movement_created`, texto planificado, envio no ejecutado por `send_disabled` |
| Smoke HTTP WhatsApp respuesta pendiente | OK - movimiento ambiguo/baja confianza, `response_plan_reason = pending_created`, texto planificado, envio no ejecutado por `send_disabled` |
| Smoke HTTP WhatsApp `confirmo` pendiente unico | OK - `gaste 8 algo` crea `pending_item`; `confirmo` marca `user_confirmed`, crea movimiento via Core y planifica `pending_confirmed` |
| Smoke HTTP WhatsApp `cancelar` pendiente unico | OK - `gaste 8 algo` crea `pending_item`; `cancelar` marca `discarded`, no crea movimiento y planifica `pending_discarded` |
| Smoke HTTP WhatsApp `cancelar` con multiples pendientes | OK - con 2 pendientes activos, no descarta, no crea movimiento y planifica aclaracion para elegir en Pendientes |
| Smoke HTTP WhatsApp `ver pendientes` | OK - con 2 pendientes activos, lista pendientes, no descarta, no confirma y no crea movimientos |
| Tests PolicyGate DataAgent | OK - gasto claro con cuenta o sin cuenta queda listo para Core; cuenta invalida bloquea; sensible, ambiguo o motor especializado pide confirmacion |
| Smoke API `pending_items` | OK - lista, rechaza confirmacion incompleta, edita, confirma via Core |
| Smoke API `transactional_outbox` | OK - movimiento crea `movement_created`, worker publica y registra `internal_event_log` |
| Smoke API `pending_confirmed` atomico | OK - confirmar pendiente crea `movement_created` + `pending_confirmed`; retry devuelve 200 idempotente y no duplica eventos |
| Smoke worker outbox para pending atomico | OK - worker publica `movement_created` + `pending_confirmed` y ambos quedan `published` |

Capturas relevantes:

| Archivo | Uso |
|---|---|
| `.artifacts/movements-stitch-aligned-desktop.png` | QA desktop de Movimientos alineado a Stitch. |
| `.artifacts/pending-desktop.png` | QA desktop de Pendientes. |
| `.artifacts/pending-mobile-final.png` | QA mobile de Pendientes sin FAB indebido y sin overflow. |
| `.artifacts/pending-api-desktop.png` | QA desktop de Pendientes conectado a API real. |
| `.artifacts/pending-api-mobile.png` | QA mobile de Pendientes conectado a API real; sin FAB indebido ni overflow horizontal. |
| `.artifacts/visual-stitch-auth-final.png` | QA Auth alineado a Stitch contra build de produccion local. |
| `.artifacts/visual-stitch-new-movement-final.png` | QA modal manual alineado a Stitch contra build de produccion local. |
| `.artifacts/movement-new-modal-stitch-aligned-final-5.png` | QA visual final del modal nuevo movimiento: 560px, viewport contenido, impacto visible, footer sin solape y fondo bloqueado. |
| `.artifacts/visual-stitch-movements-data-final.png` | QA Movimientos autenticado con movimiento real creado por Core. |
| `.artifacts/visual-stitch-pending-empty-final.png` | QA Pendientes empty state autenticado. |
| `.artifacts/visual-stitch-mobile-loaded-fixed.png` | QA mobile cargado con bottom nav sin solape. |

Nota:

Las capturas son evidencia temporal de implementacion. No reemplazan Fase 6 ni una suite visual formal.

---

## 6. Deuda Tecnica Actual

| Deuda | Riesgo | Prioridad |
|---|---|---|
| `pending_edited` y `pending_discarded` se escriben fuera de una RPC dedicada | Un fallo despues de actualizar pending podria dejar evento faltante para esos estados no financieros | Media |
| Outbox publisher aun no tiene handlers reales de producto | Eventos se publican como skipped hasta conectar consumidores | Media |
| Dashboard aun no tiene rutas finales por seccion | `?view=` resuelve deep links iniciales, pero faltan URLs finales tipo `/movimientos` o `/pendientes` si se decide tenerlas | Baja |
| Varias pantallas del AppShell son placeholders | Puede dar falsa sensacion de avance visual | Media |
| WhatsApp real ya responde via proveedor vigente | El gate estricto de pago de deuda paso cinco escenarios con runtime API; falta observabilidad con mayor volumen y piloto operacional continuo | Media |
| DataAgent y ResponseAgent operan con provider API y fallback seguro | El gate humano registro una traza historica de timeout de ResponseAgent que no conto como evidencia; los cinco escenarios aceptados fueron provider-qualified. Falta medir p95/fallback con volumen real | Media |
| Resolucion avanzada por WhatsApp pendiente | Ya existe `confirmo`/`cancelar`, `ver pendientes`, accion por codigo estable, deep link y botones planificados para pendiente unico no sensible; faltan Flow y envio real staging | Media |
| WhatsAppWindowManager aun no gobierna todos los envios proactivos | Ya decide `freeform`/`interactive` para respuestas a usuario; faltan caps, quiet hours y plantillas/proactivos completos | Alta |
| Handoff webhook -> outbox no es una unica RPC transaccional | El ID deterministico permite reparar duplicados, pero una RPC dedicada seria mas fuerte | Media |
| Conteo diario/mensual de templates usa base UTC hasta integrar timezone de usuario | Puede desalinear caps blandos para usuarios fuera de UTC | Baja |
| WhatsApp outbound depende del proveedor vigente | Los payloads estan testeados y Kapso permite operar; si se vuelve a Meta Cloud directa, faltara repetir verificacion WABA/token real | Media |
| Raw payload de WhatsApp vive normalizado en metadata, sin `payload_ref` cifrado | Suficiente para local/V1 temprana, pero no para replay/retencion fina | Media |
| Warning de lint en `.cursor/stitch-proxy.mjs` | Ruido en verificacion | Baja |
| No hay QA visual automatizado estable | Riesgo de regresion responsive | Media |

---

## 7. Decisiones Tomadas Durante Construccion

### 2026-06-07 - Pendientes UI antes de backend real

Estado:

Decision historica superada por `pending_items` real.

Decision original:

Construir la pantalla de Pendientes con estado local temporal, sin fingir que `pending_items` ya existe.

Razon:

Permite avanzar en experiencia de Dashboard y validar UX, manteniendo separacion conceptual entre pendientes y movimientos confirmados.

Guardrail:

No conectar confirmacion real hasta tener migracion, repositorio, API y Core command correspondiente.

### 2026-06-07 - AppShell sin FAB generico

Decision:

Eliminar el FAB mobile por defecto del AppShell. Solo las pantallas que declaran una accion primaria mobile deben mostrarlo.

Razon:

En Pendientes aparecia un `+` indebido que sugeria crear algo nuevo, cuando la accion natural era revisar/confirmar.

### 2026-06-07 - `pending_items` real antes de WhatsApp/Gmail

Decision:

Conectar la bandeja de Pendientes a DB/API real antes de integrar WhatsApp o Gmail.

Razon:

Email, WhatsApp ambiguo, recurrentes candidatos y confirmaciones de riesgo necesitan una bandeja confiable. Construirla ahora reduce el riesgo de conectar canales externos sobre mocks.

Guardrail:

Confirmar pendiente crea movimiento via `CommandDispatcher`. Este guardrail historico quedo cerrado con `confirm_pending_with_movement`.

### 2026-06-07 - Confirmacion atomica de pendientes

Decision:

Confirmar un pendiente usa un repositorio especializado y el RPC `confirm_pending_with_movement`, manteniendo `CommandDispatcher` para construir el movimiento, audit logs, deltas y `movement_created`.

Razon:

Evita el estado partido donde el movimiento existe pero el pendiente sigue abierto. La confirmacion, el movimiento y los eventos `movement_created` + `pending_confirmed` quedan en una sola transaccion DB.

Guardrail:

El RPC solo se llama desde backend/service role. El cliente sigue sin escritura directa en `pending_items`, `movements` ni `transactional_outbox`.

### 2026-06-07 - Alineacion visual Stitch antes de ampliar pantallas

Decision:

Aplicar un corte de alineacion visual base antes de seguir con mas features del Dashboard.

Incluye:

- Paleta/tokens globales mas cercanos a Stitch.
- Auth centrado y sobrio.
- Sidebar/AppShell con fondo calido, estados activos suaves y CTAs mas contenidos.
- Movimientos con layout, filtros, filas y modal manual cercanos a las referencias.
- Pendientes con banner de proteccion, empty state y tarjetas conectadas a API real.
- Bottom nav mobile con etiquetas cortas para evitar solapes.

Razon:

La implementacion funcional estaba avanzando bien, pero empezaba a verse como UI tecnica. Antes de sumar Home, Mi Dinero, Deudas o WhatsApp, convenia fijar una base visual coherente para que cada pantalla nueva nazca con la misma calidad.

Guardrail:

Stitch sigue siendo referencia visual, no contrato pixel-perfect. Si una pantalla generada omite una accion necesaria del producto, gana la especificacion funcional y se adapta el layout.

### 2026-06-07 - Smoke RLS multiusuario antes de WhatsApp/Gmail

Decision:

Agregar `npm run smoke:rls` como verificacion explicita fuera de `npm test`, porque depende de Supabase local y usuarios reales de Auth.

Incluye:

- Usuario A y usuario B creados temporalmente.
- Movimientos, pendientes y audit logs separados por usuario.
- Confirmacion de que B no puede leer datos de A.
- Confirmacion de que un usuario autenticado no puede escribir directo en `movements` ni `pending_items`.
- Confirmacion de que `POST /api/v1/movements` crea con el `user_id` autenticado y rechaza `user_id` enviado por cliente.

Razon:

Antes de conectar WhatsApp, Gmail o agentes, la base multiusuario tenia que quedar probada con datos reales y no solo por lectura de migraciones.

Guardrail:

`npm test` sigue siendo rapido y local al codigo. `npm run smoke:rls` es una prueba de seguridad/integracion que requiere Supabase local activo y, si hay app local disponible, tambien verifica la API.

### 2026-06-07 - WhatsApp inbound primero, sin escribir dinero

Decision:

Construir primero el tramo seguro de entrada de WhatsApp:

```text
Meta Webhook
  -> WhatsAppAdapter
  -> external_event_log
  -> whatsapp_window_states
```

Antes de:

- enviar respuestas outbound,
- invocar agentes,
- crear movimientos desde lenguaje natural.

Razon:

WhatsApp es el canal principal, pero el primer riesgo tecnico no es "responder bonito"; es recibir eventos reales sin duplicar, sin saltarse Core y sin mezclar proveedor con dominio financiero.

Guardrails:

- El webhook no clasifica ni registra movimientos.
- El adapter no calcula saldos, no decide categorias y no envia nudges.
- Eventos externos e internos siguen separados.
- La ventana de WhatsApp se renueva solo con mensajes del usuario.
- Nota actualizada 2026-06-27: este guardrail se mantiene con Kapso como proveedor operativo V1 via `WhatsAppAdapter`; sigue prohibido usar QR, WhatsApp Web automation o APIs no oficiales.

### 2026-06-08 - WhatsApp outbound trazado, sin politica de envio aun

Decision:

Implementar primero la capacidad tecnica de envio outbound por proveedor WhatsApp controlado con trazabilidad e idempotencia:

```text
ResponsePlanner/Orchestrator futuro
  -> sendTrackedWhatsAppMessage
  -> whatsapp_delivery_attempts
  -> WhatsApp provider adapter
```

Razon:

Manzana necesita poder responder por WhatsApp, pero el envio no debe quedar escondido como un `fetch` suelto. Cada intento debe tener `trace_id`, `idempotency_key`, status, error provider y resumen seguro para auditoria y control de costos.

Guardrails:

- `sendTrackedWhatsAppMessage` no decide si conviene enviar.
- La politica de ventana 24h, opt-in, quiet hours, modo discreto y costo sigue fuera del sender.
- Reintentos deben usar idempotencia o una politica explicita posterior.
- No se guarda texto completo del mensaje en `whatsapp_delivery_attempts`; se guarda resumen seguro.
- Nota actualizada 2026-06-27: el proveedor operativo V1 ahora es Kapso; el sender mantiene el contrato normalizado y no debe filtrar detalles del proveedor al dominio.

### 2026-06-08 - WindowManager como decision pura de calidad/costo

Decision:

Implementar `WhatsAppWindowManager` primero como modulo puro y testeable, no como worker escondido.

Incluye:

- estado `open`, `closing_soon`, `closed`,
- plan de entrega `freeform`, `interactive`, `template`, `app_only`, `blocked`,
- prompt 12h como continuidad principal,
- prompt 20h como opcional bajo politica,
- opt-in, quiet hours, sensibilidad, valor accionable y caps blandos.

Razon:

La calidad no se protege solo "mandando menos". Se protege decidiendo bien: cuando hablar por WhatsApp, cuando agrupar, cuando usar template, cuando ir a app y cuando bloquear un mensaje sensible hasta tener copy discreto.

Guardrail:

El WindowManager no redacta mensajes, no decide nudges por si mismo y no escribe dinero. Solo produce una decision de canal/envio para que `ResponsePlanner`, `NudgePolicy` u orquestador la usen.

### 2026-06-08 - Handoff minimo WhatsApp hacia Orchestrator

Decision:

Conectar el webhook WhatsApp con el outbox interno antes de agregar IA.

Flujo implementado:

```text
POST /api/webhooks/whatsapp
  -> external_event_log
  -> transactional_outbox: whatsapp.message_received
  -> worker outbox
  -> FinancialOrchestrator minimo
  -> external_event_log.status = accepted
```

Razon:

Esto convierte el webhook en una entrada real al sistema sin meter logica pesada dentro de la request de Meta. Tambien deja claro que recibir un mensaje no significa registrar dinero automaticamente.

Guardrails:

- Solo usuarios conocidos por `profiles.phone_e164` generan handoff interno.
- El outbox usa `id = external_event.id` para hacer idempotente el handoff ante reintentos de Meta.
- En este corte inicial, el orquestador minimo no llamaba DataAgent, no respondia y no escribia Core. Esto quedo superado en Corte 6: ahora llama DataAgent local y puede ejecutar `ready_for_core` via Core en local/flag, pero sigue sin respuesta final de producto.
- Los mensajes no texto se ignoran de forma explicita hasta definir soporte.

### 2026-06-08 - ResponsePlanner conservador antes de AgentRuntime

Decision:

Agregar `ResponsePlanner` minimo, pero configurarlo para no responder por defecto.

Razon:

La peor experiencia seria responder rapido con una frase generica que parezca bot y luego no resolver el registro. Hasta que exista `ResponseAgent` o una plantilla segura conectada al resultado real, el planificador debe dejar trazado que el mensaje requiere una respuesta de producto.

Guardrail:

```text
response_plan_kind = no_response
response_plan_reason = agent_runtime_required
```

Existe un modo de ack local testeado, pero no se usa como comportamiento V1 real sin una decision explicita.

### 2026-06-08 - DataAgent local fixture solo como puente de contrato

Decision:

Implementar `AgentRuntime` y `DataAgent` con un runtime `local_fixture` para desarrollo, tests y smoke local.

Razon:

El sistema ya necesitaba el contrato real del agente: Context Pack, schema, ProposedActions, trazas y salida validada. Pero todavia no conviene acoplarse a un proveedor Codex/API ni permitir que una heuristica local registre dinero.

Guardrails:

- `local_fixture` no es IA de produccion.
- `DataAgent` propone, no escribe Core.
- `DataActionPolicy` decide si la propuesta esta lista para Core, requiere confirmacion o debe bloquearse.
- El orquestador guarda la propuesta en metadata para trazabilidad.
- Nota posterior: esto quedo superado parcialmente con `ResponseAgent` local,
  fallback deterministico y runtime `api=openai` en Corte 22A; falta
  key/modelo y QA real con proveedor externo.
- Convertir `proposed_actions` a movimientos exige PolicyGate + `CommandDispatcher`.

### 2026-06-08 - PolicyGate inicial para propuestas de DataAgent

Decision:

Agregar `DataActionPolicy` como capa pura entre `DataAgent` y Core.

Razon:

La salida de un agente no debe convertirse en dinero por si sola. Antes de escribir, el sistema debe revisar tipo de movimiento, monto, descripcion, categoria, sensibilidad, confianza, cuenta resuelta y si el caso pertenece a un motor especializado como deudas o recurrentes.

Guardrails:

- Gasto/ingreso claros con cuenta resuelta pueden quedar `ready_for_core`.
- Gasto/ingreso claros sin cuenta tambien pueden quedar `ready_for_core` con `account_origin_id`/`account_destination_id = null`; el Core registra el movimiento, pero no mueve saldo de cuenta.
- Categoria sensible, baja confianza, ambiguedad, persona relacionada o motor especializado pendiente queda `requires_confirmation`.
- Si faltan datos minimos o la cuenta indicada no existe, queda `blocked`.
- El plan se traza en `external_event_log.metadata`.
- La ejecucion del Core queda en un corte separado para mantener clara la frontera entre decidir y mutar dinero.

### 2026-06-08 - Ejecucion Core solo para `ready_for_core`

Decision:

Agregar `DataActionExecutor` para ejecutar planes `ready_for_core` via `CommandDispatcher`.

Razon:

Cuando PolicyGate ya determino que todos los movimientos son directos, con monto, categoria y confianza suficiente, el siguiente valor de producto es que WhatsApp registre de verdad. Si la cuenta no esta resuelta, el registro puede entrar con cuenta `null` y el Core no afecta saldos de cuenta. Pero la escritura no puede saltarse el Core ni depender de que el worker procese dos veces el mismo evento.

Guardrails:

- Solo ejecuta si `financial_action_plan_kind = ready_for_core`.
- No ejecuta planes mixtos, sensibles, ambiguos, con cuenta indicada invalida o de motores especializados.
- Si registra sin cuenta, el movimiento queda confirmado pero `affects_account_balance = false`.
- Usa idempotencia `whatsapp:<external_event_id>:<action_id>`.
- Cada movimiento entra por `CommandDispatcher` y genera audit log + outbox del Core.
- En `APP_ENV=local` queda habilitado para desarrollo/smoke.
- Fuera de local requiere `WHATSAPP_EXECUTE_READY_ACTIONS=true`.
- Aunque cree el movimiento, `ResponsePlanner` sigue esperando `ResponseAgent`/plantilla segura antes de responder por WhatsApp.

### 2026-06-08 - Pendientes para `requires_confirmation`

Decision:

Agregar `DataActionPending` para convertir acciones que requieren confirmacion en `pending_items`.

Razon:

Cuando Manzana entiende el movimiento pero falta una condicion de seguridad, por ejemplo baja confianza, categoria sensible, persona relacionada, deuda/recurrente/transferencia o ambiguedad real, no debe registrar dinero ni perder el trabajo de interpretacion. Debe separar el candidato en Pendientes para que el usuario lo confirme, edite o descarte.

Guardrails:

- Solo crea pendientes para acciones `requires_confirmation`.
- No crea movimientos.
- Usa `source_ref = whatsapp:<external_event_id>:<action_id>` para idempotencia.
- El pendiente guarda `proposed_action`, resumen seguro para UI y razones de PolicyGate.
- Un pendiente no afecta saldos, cajas, deudas ni reportes hasta confirmacion por Core.
- El caso de cuenta ausente en un gasto/ingreso claro ya no crea pendiente por si solo; queda registrado con cuenta `null` y sin afectar saldos de cuenta.
- Categorias sensibles o motores especializados quedan como `risk_confirmation`.

### 2026-06-08 - Respuesta segura planificada por WhatsApp

Decision:

Extender `ResponsePlanner` para componer respuestas deterministicas segun el resultado real del orquestador, y agregar `maybeSendWhatsAppResponse` como envio opcional detras de flag.

Razon:

El usuario no debe quedarse sin feedback despues de registrar o separar un movimiento. Pero tampoco conviene activar envio real sin credenciales Meta, copy aprobado y pruebas de staging. Por eso la respuesta se planifica y se traza siempre, mientras que el envio real requiere `WHATSAPP_SEND_RESPONSES=true`.

Guardrails:

- Si se creo un movimiento, responde con confirmacion concreta.
- Si se creo un pendiente, explica que se separo para revisar y que no toca saldo.
- Si no hay resultado de producto, no responde con frase generica.
- El envio real queda apagado por defecto.
- El envio real usa idempotencia `whatsapp-response:<external_event_id>:<reason>`.
- En local/smoke queda trazado como `response_send_kind = not_sent` y `response_send_reason = send_disabled`.
- Los botones interactivos quedan limitados a pendientes unicos no sensibles; WhatsApp Flow y envio real fuera de staging siguen pendientes.

### 2026-06-08 - Resolucion segura de pendientes por WhatsApp

Decision:

Permitir que el usuario confirme o descarte desde WhatsApp con mensajes claros como `confirmo`, `cancelar`, `descarta eso` o un codigo estable tipo `confirmar P-XXXXXXXX`.

Razon:

WhatsApp es el canal principal. Si Manzana separa un movimiento porque falta cuenta o confirmacion, la experiencia queda incompleta si el usuario tiene que abrir la app para resolver un caso simple. A la vez, resolver por texto libre no debe crear riesgos cuando hay varios pendientes o cuando el usuario escribe algo ambiguo.

Guardrails:

- Se evalua antes de `DataAgent`; si el texto no es resolucion clara, sigue el flujo normal.
- Frases negativas como `no confirmo` no confirman.
- `cancelar`, `descarta eso` o `borra pendiente` descartan solo si hay un unico pendiente activo.
- `ver pendientes` muestra una lista compacta de pendientes activos sin mutar datos.
- Cada pendiente listado muestra codigo estable `P-XXXXXXXX`.
- `confirmar P-XXXXXXXX` y `cancelar P-XXXXXXXX` resuelven solo el pendiente que coincide con ese codigo.
- Si el codigo no existe o no alcanza para resolver con seguridad, no se toca nada y se pide revisar la lista actual.
- Si hay 0 pendientes activos, responde que no encontro nada por confirmar o descartar.
- Si hay mas de 1 pendiente activo y el usuario no envio codigo, pide revisar/elegir en Pendientes y no toca nada.
- Si confirma exactamente 1 pendiente activo, usa `confirmPendingItemWithCore`.
- Si descarta exactamente 1 pendiente activo, usa backend controlado y no crea movimiento.
- La confirmacion entra por `CommandDispatcher`, no escribe directo en `movements`.
- La idempotencia de confirmacion sigue siendo `pending-confirm:<pending_id>`.
- El envio real de la respuesta sigue apagado salvo `WHATSAPP_SEND_RESPONSES=true`.
- No incluye todavia confirmar todos, descartar varios, seleccionar por indice, editar ni WhatsApp Flow.

### 2026-06-08 - Deep link a Pendientes desde WhatsApp

Decision:

Agregar un handoff simple y seguro desde WhatsApp hacia la bandeja de Pendientes usando `/?view=pending`.

Razon:

Cuando hay varios pendientes, el codigo estable por WhatsApp ya permite resolver sin abrir la app, pero la experiencia mejora si el usuario tambien puede ir a un centro visual donde revisar, editar, confirmar o descartar con calma. Este enlace no confirma nada por si solo y no afecta saldos.

Guardrails:

- La URL solo cambia la vista del Dashboard; no ejecuta acciones financieras.
- Si no hay sesion, Auth conserva `?view=pending` y despues de login aterriza en Pendientes.
- `DashboardApp` usa la URL como fuente de verdad de la vista para evitar estado invisible.
- Al navegar a Movimientos se limpia `?view=pending`.
- `ResponsePlanner` solo adjunta el enlace cuando puede construir una URL segura desde `MANZANA_APP_URL`, `NEXT_PUBLIC_MANZANA_APP_URL` o entorno local.
- El enlace acompana la respuesta, pero la accion principal por WhatsApp sigue siendo responder con texto claro o codigo estable.

### 2026-06-08 - Botones interactivos para pendiente unico

Decision:

Planificar respuestas `whatsapp_interactive` con botones `Confirmar` y `Descartar` solo cuando Manzana separa un unico pendiente no sensible.

Razon:

El caso de un pendiente unico es el mejor lugar para subir calidad sin aumentar riesgo: el usuario acaba de hablar por WhatsApp, la ventana esta abierta y la accion posible es binaria. Botones reducen friccion, pero no reemplazan codigos ni la bandeja de Pendientes para casos multiples o sensibles.

Guardrails:

- Solo aplica a `pending_created` con exactamente 1 pendiente.
- No aplica si `risk_level` es `sensitive` o `high`.
- Los botones usan IDs y titulos compatibles con el parser textual: `confirmar` y `descartar`.
- Si el usuario responde por boton, el inbound se normaliza como texto y entra por `maybeResolvePendingFromWhatsApp`.
- `maybeSendWhatsAppResponse` solo envia `interactive` si `WindowManager` devolvio modo `interactive`.
- En local y smoke sigue sin enviarse a Meta porque `WHATSAPP_SEND_RESPONSES` esta apagado.
- Codigos `P-XXXXXXXX` y deep link a Pendientes siguen siendo fallback seguro.

### 2026-06-08 - Reconciliacion de status delivery WhatsApp

Decision:

Cada status webhook de Meta (`sent`, `delivered`, `read`, `failed`) se guarda como evento externo y ademas intenta reconciliar el intento outbound correspondiente en `whatsapp_delivery_attempts` usando `provider_message_id`.

Razon:

Antes de activar envio real, Manzana necesita saber no solo que intento enviar un mensaje, sino si Meta lo acepto, entrego, leyo o fallo. Esto permite medir calidad del canal, detectar problemas de proveedor y evitar que staging/produccion queden ciegos ante fallos de entrega.

Guardrails:

- La reconciliacion no toca Core financiero, movimientos, saldos ni pendientes.
- Si el status ya fue registrado antes, el webhook puede reconciliar otra vez sin duplicar `external_event_log`.
- `delivered`, `read` y `sent` mantienen el intento como `accepted`.
- `failed` marca el intento como `failed` y guarda un resumen seguro del error.
- Si no existe intento outbound con ese `provider_message_id`, el status queda registrado como evento externo y no rompe el webhook.
- El payload raw completo sigue en `external_event_log.metadata`; `whatsapp_delivery_attempts` guarda solo resumen operativo.

### 2026-06-08 - Readiness check para WhatsApp staging

Decision:

Agregar `npm run smoke:whatsapp:staging-readiness` como puerta previa a cualquier envio real por WhatsApp.

Razon:

Antes de activar `WHATSAPP_SEND_RESPONSES=true`, Manzana necesita saber si el entorno esta listo para hablar con el proveedor activo de WhatsApp sin mezclar local, staging y produccion. Esta verificacion protege costo, privacidad, calidad de canal y evita probar mensajes reales con variables incompletas.

Guardrails:

- No envia mensajes ni llama al proveedor.
- En modo normal local informa estado seguro sin fallar si el envio real esta apagado.
- En modo `--strict` falla si faltan credenciales del proveedor activo, app URL publica HTTPS, `APP_ENV=staging`, `WORKER_SECRET` o `WHATSAPP_SEND_RESPONSES=true`.
- Bloquea envio real desde `production` y desde `local` por defecto.
- Permite `ALLOW_LOCAL_WHATSAPP_SEND=true` solo como excepcion explicita de desarrollo, no como camino recomendado.
- Nota actualizada 2026-06-17: el readiness entiende `WHATSAPP_PROVIDER=kapso` como proveedor operativo V1; no introduce proveedores alternos, QR ni fallback externo no oficial.

### 2026-06-08 - ResponseAgent local con guardrails de hechos

Decision:

Implementar `ResponseAgent` como agente local fixture y conectarlo despues de `ResponsePlanner`, no antes del resultado financiero.

Razon:

Podemos subir la calidad percibida de WhatsApp sin esperar staging ni token Meta. Pero el agente no debe decidir si se registro, confirmo, descarto o separo algo. Esa verdad viene de Core, Pending y `ResponsePlanner`; `ResponseAgent` solo mejora el texto visible.

Guardrails:

- `ResponseAgent` no tiene herramientas de escritura ni acceso directo a Core.
- Recibe un `ResponseContextPack` con texto base, escenario, restricciones y hechos que debe preservar.
- Si pierde montos, codigos `P-XXXXXXXX` o links, el enhancer rechaza su salida.
- Si falla, se conserva el texto deterministico.
- En mensajes interactivos se actualiza `interactive.bodyText` junto con `text`.
- La traza queda en `external_event_log.metadata` con status, razon, confianza, provider, modelo, latencia y safety flags.
- El runtime actual sigue siendo `local_fixture`; Codex/API queda para el siguiente nivel de calidad.

### 2026-06-09 - RuntimeRouter Codex/API-ready por agente

Decision:

Convertir `AgentRuntime` de contrato pasivo a runtime enrutable por agente, con providers `local_fixture`, `api` y `codex`.

Razon:

La arquitectura ya decia que Manzana puede mover agentes uno por uno a API sin reescribir el sistema. Para que eso sea real, `DataAgent` y `ResponseAgent` no deben hardcodear `local_fixture`; deben pedir provider a una capa de runtime. A la vez, no conviene activar un proveedor externo sin endpoint, medicion y fallback.

Guardrails:

- `AGENT_RUNTIME_DATA_AGENT_PROVIDER` y `AGENT_RUNTIME_RESPONSE_AGENT_PROVIDER` permiten mover agentes individualmente.
- `AGENT_RUNTIME_DEFAULT_PROVIDER` define el default global.
- `HttpAgentRuntime` usa endpoint/token/modelo configurables para `api` o `codex`.
- Si el provider externo no esta configurado o falla, el router puede caer a `local_fixture` y agrega safety flags `runtime_fallback_from_*`.
- El fallback no escribe dinero ni salta PolicyGate.
- El output sigue validandose en cada agente con su schema.
- `local_fixture` sigue siendo desarrollo/QA, no IA de produccion.

### 2026-06-09 - Staging publico minimo para Meta

Decision:

Crear una ruta publica `/empresa` y desplegar el proyecto en Vercel bajo `manzana-staging` para tener una URL HTTPS valida durante la configuracion de Meta WhatsApp Business.

Razon:

Meta solicita un sitio web valido para completar informacion del negocio antes de crear/configurar la cuenta de WhatsApp Business. Manzana todavia no tiene landing publica definitiva, pero necesita una pagina institucional seria que explique el producto sin depender de login, Supabase remoto ni dashboard.

Guardrails:

- `/empresa` es pagina publica institucional, no reemplaza la experiencia V1 ni el dashboard.
- Inicialmente `/empresa`, `/api/health` y `/api/webhooks/whatsapp` quedaron excluidos del refresco de sesion en `proxy.ts`.
- El 2026-06-10 esto se expandio con `/privacidad`, `/terminos`, `/contacto` y `/eliminar-datos` como paquete publico minimo para Meta.
- El webhook queda publicamente alcanzable para verificacion futura de Meta, pero el envio real sigue bloqueado hasta credenciales completas y readiness estricto.
- No se configuraron secretos reales de WhatsApp ni Supabase remoto en este corte.
- La URL publica estable para configuracion de Meta es `https://manzana.website/empresa`.

Verificacion:

- `npm run typecheck` OK.
- `npm run lint` OK con warning preexistente en `.cursor/stitch-proxy.mjs`.
- `npm run build` OK; Next marca `/empresa` como pagina estatica.
- `Invoke-WebRequest https://manzana.website/empresa` devuelve `200`.
- `Invoke-WebRequest https://manzana.website/api/health` devuelve `200` con Supabase `degraded`, esperado hasta configurar Supabase remoto.

### Actualizacion 2026-06-12: dominio y correo publico

Que se implemento/configuro:

- Dominio `manzana.website` comprado en Vercel y conectado al proyecto `manzana-staging`.
- Email de dominio creado en Zoho Mail: `hola@manzana.website`.
- DNS de Zoho configurado en Vercel: verificacion TXT, MX, SPF y DKIM.
- Recepcion y envio de correo probados manualmente con `hola@manzana.website`.
- Variables publicas de Vercel configuradas para identidad publica:
  - `NEXT_PUBLIC_MANZANA_APP_URL=https://manzana.website`
  - `NEXT_PUBLIC_MANZANA_CONTACT_EMAIL=hola@manzana.website`
  - `NEXT_PUBLIC_MANZANA_SUPPORT_EMAIL=hola@manzana.website`
  - `NEXT_PUBLIC_MANZANA_PRIVACY_EMAIL=hola@manzana.website`
  - `NEXT_PUBLIC_MANZANA_LEGAL_OPERATOR` configurada en Vercel
  - `NEXT_PUBLIC_MANZANA_LEGAL_COUNTRY=Peru`
  - `NEXT_PUBLIC_MANZANA_LEGAL_STATUS=Persona natural operando un producto digital en preparacion para V1`
  - `NEXT_PUBLIC_MANZANA_PUBLIC_ADDRESS` configurada en Vercel
  - `NEXT_PUBLIC_MANZANA_CONTACT_PHONE=+51 928 377 977`
  - `NEXT_PUBLIC_MANZANA_POLICY_EFFECTIVE_DATE=12 de junio de 2026`

Verificacion:

- `https://manzana.website/empresa`, `/privacidad`, `/terminos`, `/contacto` y `/eliminar-datos` devuelven `200`.
- Las paginas publicas ya muestran correo de dominio, dominio, operador legal, pais, direccion publica configurada y telefono dedicado donde corresponde.
- No quedan campos `pendiente de configurar` en las paginas publicas principales.

### Actualizacion 2026-06-13: intento de registro WhatsApp Cloud

Que se intento:

- Se intento registrar el numero dedicado de Manzana en WhatsApp Cloud API con `/{phone_number_id}/register`.
- Se uso PIN temporal local y token temporal de Meta; no se guardaron secretos en el repo.

Resultado:

- Meta rechazo el registro con `OAuthException code 100`.
- Motivo operativo: la cuenta de WhatsApp Business sigue marcada como no verificada.
- El bloqueo no es del webhook, del dominio, del PIN ni de Vercel; es verificacion de la WABA en Meta.

Siguiente:

- Completar verificacion legal/documental de la cuenta de WhatsApp Business o seguir desarrollo con numero de prueba/mock hasta resolver Meta.

---

### Actualizacion 2026-06-13: decision operativa YCloud para WhatsApp V1

Que se decidio:

- YCloud pasa a ser el proveedor oficial operativo de WhatsApp V1 hasta nueva decision explicita.
- Meta WhatsApp Cloud API directo queda como escape tecnico futuro detras de `WhatsAppAdapter`, no como ruta principal actual.
- No se habilitan Twilio, 360dialog, WATI, Zoko, respond.io, Evolution API, QR ni WhatsApp Web automation.
- Se conserva la regla de via oficial: YCloud debe operar sobre WhatsApp Business Platform, no sobre automatizacion no oficial.

Razon:

- El intento de Meta directo encontro bloqueo operativo por verificacion de WABA.
- Formalizar/verificar negocio ahora puede tardar mas que el avance tecnico de V1.
- YCloud permite avanzar con una via oficial y menor friccion sin bajar calidad de producto.

Implicacion tecnica:

- El contrato interno sigue siendo `WhatsAppAdapter`.
- El provider por defecto es `ycloud`.
- Los eventos inbound/status se normalizan igual que Meta.
- `FinancialOrchestrator`, Core, PolicyGate y agentes no deben conocer detalles de YCloud.
- `whatsapp_delivery_attempts.provider` acepta `ycloud` y `meta_cloud`, con default `ycloud`.

Regla de calidad:

```text
YCloud no cambia la experiencia de Manzana.
WhatsApp sigue siendo canal principal.
El costo se controla con WindowManager, batching y politica,
no escondiendo valor ni reduciendo claridad para el usuario.
```

---

## 8. Siguiente Paso Recomendado

Siguiente paso fuerte:

```text
Continuar Corte 5 con Kapso real en staging.
1. Configurar `WHATSAPP_PROVIDER=kapso`.
2. Configurar `KAPSO_API_KEY`, `KAPSO_WHATSAPP_PHONE_NUMBER_ID` y `KAPSO_WEBHOOK_SECRET`.
3. Conectar webhook Kapso a `/api/webhooks/whatsapp`.
4. Probar inbound text, outbound freeform, template/interactivo y status delivery.
5. Mantener codigos `P-XXXXXXXX`, deep link y fallback deterministico como base segura.
6. Evaluar WhatsApp Flow despues de tener webhook/status estable.
```

Razon:

La entrada de WhatsApp ya quedo registrada, encolada y aceptada por un orquestador minimo. DataAgent ya propone acciones estructuradas, PolicyGate ya separa lo listo para Core de lo que requiere confirmacion, `ready_for_core` ya crea movimiento por Core, `requires_confirmation` ya crea pendiente protegido, `confirmo` ya confirma el unico pendiente activo, `cancelar` ya descarta el unico pendiente activo, `ver pendientes` ya lista varios con codigos estables, `confirmar P-XXXXXXXX` y `cancelar P-XXXXXXXX` ya actuan sobre un pendiente especifico, el Dashboard ya abre `/?view=pending`, los botones interactivos ya estan planificados para pendiente unico no sensible, los retries por `provider_message_id` ya estan cubiertos por smoke repetible, los status delivery ya reconcilian intentos outbound, `ResponsePlanner` ya planifica una respuesta segura con link, `ResponseAgent` local ya mejora copy sin perder hechos y `RuntimeRouter` ya permite mover agentes por provider. El siguiente valor real es conectar Kapso en staging sin romper estos contratos.

```text
WhatsApp puede escribir solo cuando PolicyGate lo permite y siempre via Core. Cuando haya duda, debe pedir confirmacion o mandar a pendientes.
```

La recomendacion actual es retomar staging con Kapso. Si Kapso queda operativo, luego se continua con `AgentRuntime` real o mejoras de pendientes; si Kapso falla por una causa medible, se abre decision nueva sin recurrir a QR ni APIs grises.

---

### Actualizacion 2026-06-16: decision operativa Kapso para WhatsApp V1

Que se decidio:

- Kapso reemplaza a YCloud como proveedor oficial operativo de WhatsApp V1.
- YCloud queda pausado/legado por friccion de onboarding y correo corporativo.
- Meta directo sigue como escape tecnico futuro detras de `WhatsAppAdapter`.
- Se mantiene prohibido usar Twilio, 360dialog, WATI, Zoko, respond.io, Evolution API, QR, Baileys, `whatsapp-web.js` o WhatsApp Web automation.

Implicacion tecnica:

- El contrato interno sigue siendo `WhatsAppAdapter`.
- El provider por defecto es `kapso`.
- `whatsapp_delivery_attempts.provider` acepta `kapso`, `ycloud` y `meta_cloud`, con default `kapso`.
- `FinancialOrchestrator`, Core, PolicyGate y agentes no conocen detalles de Kapso.
- Kapso usa `KAPSO_API_KEY`, `KAPSO_WHATSAPP_PHONE_NUMBER_ID` y `KAPSO_WEBHOOK_SECRET`.

Regla de calidad:

```text
Kapso no cambia la experiencia de Manzana.
WhatsApp sigue siendo canal principal.
El costo se controla con WindowManager, batching y politica,
no escondiendo valor ni reduciendo claridad para el usuario.
```

---

### Actualizacion 2026-06-17: Kapso + Supabase Cloud + worker outbox en staging

Fecha:

2026-06-17

Corte:

Integracion real de WhatsApp inbound con Kapso, Supabase Cloud y worker outbox protegido.

Que se implemento:

- Supabase Cloud quedo enlazado al proyecto `manzana-staging`.
- Se aplicaron migraciones `001` a `012` en la base remota.
- Se agrego la migracion `012_service_role_backend_grants.sql` para permitir operaciones backend con `service_role` sin abrir escritura financiera a clientes.
- Vercel production quedo apuntando a `https://manzana.website`.
- Kapso quedo configurado como provider operativo de WhatsApp en staging.
- Se configuro `WORKER_SECRET` para proteger `/api/internal/workers/outbox`.
- Se dejaron apagadas las banderas de riesgo:
  - `WHATSAPP_EXECUTE_READY_ACTIONS=false`
  - `WHATSAPP_SEND_RESPONSES=false`
- Se creo un usuario staging vinculado al telefono personal de prueba para validar inbound real sin mezclarlo con usuarios anonimos.
- Un mensaje tipo `gaste 8 en cafe` entro por webhook, fue aceptado, se publico por outbox y termino como pendiente protegido.

Archivos principales:

- `src/app/api/health/route.ts`
- `supabase/migrations/012_service_role_backend_grants.sql`
- `src/data/migrations/012_service_role_backend_grants.sql`
- `.env.local`
- variables production en Vercel

Que quedo mockeado:

- No se enviaron respuestas reales de WhatsApp desde el worker porque `WHATSAPP_SEND_RESPONSES=false`.
- No se ejecutaron acciones financieras listas automaticamente porque `WHATSAPP_EXECUTE_READY_ACTIONS=false`.
- El usuario staging es tecnico y sirve para validar el pipeline, no onboarding real de producto.

Pruebas ejecutadas:

- `npm run typecheck`: OK.
- `npm run lint`: OK, con warning existente en `.cursor/stitch-proxy.mjs`.
- Health remoto: `GET https://manzana.website/api/health` devuelve `status=ok` y Supabase `ok`.
- Webhook Kapso firmado con telefono vinculado: OK.
- Worker outbox protegido: OK.
- Verificacion DB:
  - `external_event_log`: inbound aceptado con usuario.
  - `transactional_outbox`: `whatsapp.message_received` y `pending_created` publicados.
  - `internal_event_log`: orquestador procesado y evento interno skipped por envio apagado.
  - `pending_items`: creado `ambiguous_movement` por falta de cuenta.
  - `movements`: no se creo movimiento confirmado.

Capturas/artefactos:

- Vercel production alias: `https://manzana.website`.
- Kapso webhook URL: `https://manzana.website/api/webhooks/whatsapp`.

Deuda tecnica nueva:

- Definir si el primer test real con WhatsApp debe activar `WHATSAPP_SEND_RESPONSES=true` solo despues de validar outbound Kapso con un mensaje controlado.
- Definir si `WHATSAPP_EXECUTE_READY_ACTIONS` se activa en staging antes o despues de probar cuenta por defecto y confirmaciones.
- Automatizar el worker outbox con scheduler seguro cuando el pipeline manual quede validado.

Siguiente paso:

Probar desde WhatsApp real hacia el numero de Manzana. Primero validar que inbound real llega a Kapso y crea pendiente/movimiento segun reglas; despues activar envio controlado de respuestas en staging.

---

### Actualizacion 2026-06-27: outbound Kapso real + confirmacion interactiva validada

Fecha:

2026-06-27

Corte:

WhatsApp real dejo de ser solo inbound. Manzana ya puede responder por Kapso en staging, enviar botones interactivos para un pendiente unico y confirmar un pendiente desde WhatsApp hasta crear un movimiento por Core.

Que se implemento:

- Se activo `WHATSAPP_SEND_RESPONSES=true` en Vercel production para staging controlado.
- Se agrego `OUTBOX_AUTO_DRAIN_ON_WEBHOOK=true` para drenar el outbox justo despues de un webhook valido cuando hay handoff nuevo.
- Se agregaron limites de seguridad para auto-drain:
  - `OUTBOX_AUTO_DRAIN_LIMIT=10`.
  - `OUTBOX_AUTO_DRAIN_MAX_PASSES=3`.
- El webhook de WhatsApp ahora puede ejecutar varias pasadas controladas del outbox para cubrir:
  - evento inbound;
  - creacion de pendiente;
  - respuesta WhatsApp;
  - confirmacion posterior;
  - eventos financieros derivados.
- El readiness de WhatsApp ahora es provider-aware:
  - `kapso` valida `KAPSO_API_KEY`, `KAPSO_WHATSAPP_PHONE_NUMBER_ID` y `KAPSO_WEBHOOK_SECRET`;
  - `meta_cloud` mantiene su ruta propia sin mezclar credenciales.
- `ResponsePlanner` ya genera botones con titulo visible simple (`Confirmar`, `Descartar`) pero con ID estable:
  - `confirmar P-XXXXXXXX`;
  - `descartar P-XXXXXXXX`.
- Los adapters de Kapso, Meta Cloud y YCloud priorizan payload/id del boton antes que el titulo visible.
- `FinancialOrchestrator` acepta `text`, `button` e `interactive` como mensajes accionables.
- Se corrigio copy visible de WhatsApp para nuevas respuestas (`Lo separe`/`Tambien` ya no salen sin tilde).

Archivos principales:

- `src/app/api/webhooks/whatsapp/route.ts`
- `src/core/response/response-planner.ts`
- `src/core/orchestrator/financial-orchestrator.ts`
- `src/adapters/whatsapp/kapso-adapter.ts`
- `src/adapters/whatsapp/meta-cloud-adapter.ts`
- `src/adapters/whatsapp/ycloud-adapter.ts`
- `src/agents/response-agent/local-fixture-runtime.ts`
- `scripts/smoke-whatsapp-staging-readiness.mjs`
- `.env.local.example`
- variables production en Vercel

Que quedo mockeado:

- `WHATSAPP_EXECUTE_READY_ACTIONS=true` quedo activo en production para que registros claros por WhatsApp entren directo al Core.
- En `.env.local`, `WHATSAPP_EXECUTE_READY_ACTIONS` puede seguir apagado como valor seguro; `APP_ENV=local` mantiene la ejecucion disponible para desarrollo y smokes.
- `AgentRuntime` sigue usando fixture/local provider para el agente de respuesta; la verdad financiera sigue saliendo de Core y Pending.
- No hay WhatsApp Flow avanzado todavia.
- No hay scheduler durable global para todos los eventos outbox; el auto-drain por webhook acelera el flujo de WhatsApp, pero no reemplaza el worker/scheduler de produccion.

Pruebas ejecutadas:

- Focused tests WhatsApp/Response/Adapters: 68 tests OK.
- `npm run typecheck`: OK.
- `npm run lint`: OK, con warning existente en `.cursor/stitch-proxy.mjs`.
- `npm run test`: 164 tests OK.
- `npm run build`: OK.
- `npm run smoke:whatsapp:staging-readiness -- --strict` con flags de staging: OK.
- Health remoto: `GET https://manzana.website/api/health` devuelve `status=ok` y Supabase `ok`.
- Deploy Vercel con alias production `https://manzana.website`: OK.
- Prueba real WhatsApp:
  - Usuario envio `gasté 10 en desayuno`.
  - Kapso entrego respuesta interactiva con botones.
  - Usuario toco `Confirmar`.
  - Inbound llego como `interactive` con texto normalizado `confirmar P-2D6BC1FA`.
  - `pending_items` paso a `user_confirmed`.
  - Core creo movimiento `gasto` confirmado por S/10.00, categoria `alimentacion`, descripcion `desayuno`.
  - Manzana envio respuesta final por Kapso: pendiente confirmado.

### Actualizacion 2026-06-27 - registros claros sin cuenta entran directo

Decision:

El caso `gasté 10 en desayuno` no debe ir a Pendientes si el monto, descripcion, categoria y confianza son claros. Si no hay cuenta resuelta, el movimiento se registra con `account_origin_id = null`; el Core lo deja confirmado, pero no afecta saldo de cuenta ni dinero libre financiero basado en cuentas.

Archivos principales:

- `src/core/orchestrator/data-action-policy.ts`
- `src/core/orchestrator/data-action-policy.test.ts`
- `src/core/orchestrator/data-action-executor.test.ts`
- `src/core/orchestrator/data-action-pending.test.ts`
- `src/core/response/response-planner.ts`
- `src/core/response/response-planner.test.ts`
- `scripts/smoke-whatsapp-idempotency.mjs`
- `scripts/smoke-whatsapp-pending-codes.mjs`

Que cambio:

- `account_origin_null_allowed` y `account_destination_null_allowed` son razones trazables, no razones de confirmacion.
- Gasto/ingreso claro sin cuenta queda `ready_for_core`.
- Cuenta indicada pero inexistente sigue `blocked`.
- Pendientes sigue para baja confianza, categoria sensible, ambiguedad real, persona relacionada y motores especializados.
- La respuesta por WhatsApp ahora explica cuando el movimiento quedo sin cuenta: no movio ningun saldo de cuenta.
- Los smokes de Pendientes usan inputs ambiguos (`gaste 8 algo`) para no confundir una prueba de bandeja con un registro claro.
- `WHATSAPP_EXECUTE_READY_ACTIONS=true` quedo configurado en Vercel production.

Pruebas ejecutadas:

- Tests enfocados Policy/Executor/Pending/Response: 34 tests OK.
- `npm run typecheck`: OK.
- `npm run lint`: OK con warning existente en `.cursor/stitch-proxy.mjs`.
- `npm run test`: 168 tests OK.
- `npm run build`: OK.
- Deploy Vercel production + alias `https://manzana.website`: OK.
- Health remoto: `GET https://manzana.website/api/health` OK.
- `npm run smoke:whatsapp:staging-readiness -- --strict` con `WHATSAPP_EXECUTE_READY_ACTIONS=true`: OK, sin blockers ni warnings.

Capturas/artefactos:

- Dominio publico: `https://manzana.website`.
- Deep link de pendientes: `https://manzana.website/?view=pending`.
- Provider delivery attempt real:
  - `provider = kapso`;
  - `message_kind = interactive` para el pendiente;
  - `message_kind = freeform` para la confirmacion final.

Deuda tecnica nueva:

- Probar en WhatsApp real un nuevo registro claro despues de activar `WHATSAPP_EXECUTE_READY_ACTIONS=true`: debe responder como registrado directo, no como Pendientes.
- Definir si, mas adelante, Manzana sugiere una cuenta probable despues del registro sin cuenta sin interrumpir el flujo principal.
- Resolver desde Dashboard los pendientes antiguos de prueba antes de medir metricas reales.
- Agregar scheduler durable para outbox fuera del ciclo de webhook.
- Probar status `delivered`, `read` y `failed` de Kapso con eventos reales.
- Evaluar WhatsApp Flow solo despues de cerrar confirmaciones simples, batch y Centro de Confirmaciones.

Siguiente paso:

Pedir al usuario una prueba real: enviar por WhatsApp un registro simple nuevo, por ejemplo `gasté 10 en desayuno`, y verificar que Manzana responda con registro directo. Luego limpiar o resolver los pendientes antiguos de prueba antes de medir calidad real.

---

### Actualizacion 2026-06-27 - Home real inicial y limpieza de pendientes de prueba

Fecha:

2026-06-27

Corte:

Dashboard V1 operativo, Home conectado a datos reales y limpieza controlada de bandeja.

Que se implemento:

- Se agrego `GET /api/v1/dashboard/home` como agregador read-only para la pantalla Home.
- Home ahora consulta cuentas activas, cajas activas, pendientes activos, movimientos confirmados recientes y calidad de datos.
- Si el usuario no tiene cuentas, Home no inventa dinero libre: muestra estado honesto y sugiere crear la primera cuenta.
- Si hay pendientes, Home prioriza revisar pendientes y mantiene la regla de que no afectan saldo hasta confirmacion.
- Movimientos recientes en Home salen de `movements` confirmados, no de `pending_items`.
- Calidad de datos explica cuando un movimiento quedo confirmado sin cuenta y por eso no movio saldo de cuenta.
- `DashboardApp` abre `home` por defecto.
- Se agregaron tipos y view-model de Home con pruebas unitarias para estados sin cuenta y con pendientes.
- Se archivaron tres pendientes antiguos de prueba:
  - `9108ab67-f0b6-4e01-becc-734a1639f9ee` (`cafe`, S/8);
  - `ae94afb8-f4d2-4ac3-b39a-404ef857132c` (`cafe`, S/8);
  - `ed0b6e7d-de58-4034-a35d-036ecbf9e8e8` (`taxi`, S/9).
- Se dejo activo el pendiente actual `e1027d25-1554-4d28-b467-f0a01bec8c8e` (`algo`, S/20) para seguir validando Pendientes.

Archivos principales:

- `src/app/api/v1/dashboard/home/route.ts`
- `src/features/home/home-screen.tsx`
- `src/features/home/home-api.ts`
- `src/features/home/home-types.ts`
- `src/features/home/home-view-model.ts`
- `src/features/home/home-view-model.test.ts`
- `src/features/dashboard/dashboard-app.tsx`
- `docs/fase_4_tecnica/23b_seguimiento_construccion_v1.md`

Que quedo mockeado:

- En ese corte, `next_commitments` seguia vacio porque Deudas/Recurrentes/Pagos que vienen aun no tenian dominio real completo. Estado actual: Recurrentes V1 ya alimenta `next_commitments`.
- `featured_insight` es un estado de progreso simple basado en cantidad de movimientos confirmados; no reemplaza el motor real de insights.
- Home no permite crear cuentas todavia; solo dirige a `Mi Dinero`, que sigue pendiente.

Pruebas ejecutadas:

- `npm run typecheck`: OK.
- `npm run test`: 170 tests OK.
- `npm run lint`: OK con warning preexistente en `.cursor/stitch-proxy.mjs`.
- `npm run build`: OK.
- Deploy Vercel production + alias `https://manzana.website`: OK.
- Health remoto: `GET https://manzana.website/api/health` OK.
- Ruta Home remota sin sesion: `GET https://manzana.website/api/v1/dashboard/home` devuelve `401 AUTH_REQUIRED`, esperado.

Deuda tecnica nueva:

- Conectar Home con Deudas/Recurrentes cuando existan tablas y motores completos.
- Convertir `Mi Dinero` en pantalla real para crear cuentas/cajas y activar calculo de dinero libre.
- Agregar QA visual desktop/mobile de Home contra referencias Stitch cuando el flujo de dashboard avance.

Siguiente paso:

Validar Home en navegador con usuario real y continuar con `Mi Dinero` / cuentas como siguiente bloque de producto, porque es lo que desbloquea saldos y dinero libre completo.

---

### Actualizacion 2026-06-27 - Mi Dinero real inicial y cuentas base

Fecha:

2026-06-27

Corte:

Dashboard V1 operativo, pantalla Mi Dinero conectada a cuentas reales y resumen deterministico de dinero libre.

Que se implemento:

- Se agrego `GET /api/v1/money` como endpoint dedicado para Mi Dinero.
- Se agrego `GET /api/v1/accounts` para listar cuentas activas del usuario autenticado.
- Se agrego `POST /api/v1/accounts` para crear cuentas desde Dashboard con validacion runtime.
- La creacion de cuenta usa backend controlado con `service_role` para poder registrar `initial_balance/current_balance` sin abrir escritura directa de saldos al cliente.
- Si no hay cuentas, Mi Dinero muestra estado vacio util y no inventa saldo.
- El resumen calcula:
  - saldo total registrado;
  - dinero separado en cajas;
  - libre en cuentas;
  - dinero libre operativo inicial.
- `operational_free_money` coincide por ahora con `free_in_accounts` porque Deudas/Recurrentes/Compromisos aun no estan conectados al calculo.
- La pantalla Mi Dinero permite crear la primera cuenta desde modal, con tipo, nombre, institucion opcional y saldo inicial aproximado.
- Se permite saldo inicial negativo para datos imperfectos, siguiendo la regla del proyecto: advertir, no bloquear.
- Mi Dinero lee cajas existentes y las descuenta, pero no crea cajas todavia.
- `DashboardApp` enruta `view=money` a la pantalla real.
- Se agregaron pruebas unitarias para schema de cuentas y view-model de Mi Dinero.

Archivos principales:

- `src/app/api/v1/money/route.ts`
- `src/app/api/v1/accounts/route.ts`
- `src/app/api/v1/accounts/schemas.ts`
- `src/app/api/v1/accounts/schemas.test.ts`
- `src/features/money/money-screen.tsx`
- `src/features/money/money-api.ts`
- `src/features/money/money-types.ts`
- `src/features/money/money-view-model.ts`
- `src/features/money/money-view-model.test.ts`
- `src/data/repositories/accounts.repository.ts`
- `src/features/dashboard/dashboard-app.tsx`
- `docs/fase_4_tecnica/23b_seguimiento_construccion_v1.md`

Que quedo mockeado:

- En ese corte, `commitments` seguia vacio.
- En ese corte, `upcoming_uncovered_commitments` seguia en `0` hasta conectar Deudas/Recurrentes/Pagos que vienen. Estado actual: Recurrentes V1 ya alimenta compromisos recurrentes.
- En ese corte, `operational_free_money` no descontaba compromisos proximos todavia. Estado actual: descuenta compromisos recurrentes no cubiertos como senal read-only.
- Crear cajas queda fuera de este corte porque requiere asignacion interna controlada y debe pasar por comandos financieros, no por un formulario simple.
- Cambiar cuenta por defecto entre varias cuentas queda fuera de este corte para evitar conflictos parciales con la regla de una sola cuenta default.

Pruebas ejecutadas:

- `npm run typecheck`: OK.
- `npm run test`: 175 tests OK. Vitest aviso cierre lento de algunos workers al terminar, sin fallar pruebas.
- `npm run lint`: OK con warning preexistente en `.cursor/stitch-proxy.mjs`.
- `npm run build`: OK.
- Deploy Vercel production + alias `https://manzana.website`: OK.
- Health remoto: `GET https://manzana.website/api/health` OK.
- Ruta Money remota sin sesion: `GET https://manzana.website/api/v1/money` devuelve `401 AUTH_REQUIRED`, esperado.
- Ruta Accounts remota sin sesion: `GET https://manzana.website/api/v1/accounts` devuelve `401 AUTH_REQUIRED`, esperado.

Capturas/artefactos:

- Sin capturas en este corte. Pendiente QA visual desktop/mobile cuando validemos Mi Dinero en navegador con sesion real.

Deuda tecnica nueva:

- Agregar comandos/RPC transaccionales para crear cajas y mover dinero entre libre/cajas mediante `asignacion_interna`.
- Conectar Deudas/Recurrentes para calcular `upcoming_uncovered_commitments`.
- Permitir cambiar cuenta default de forma atomica.
- Agregar QA visual de Mi Dinero contra referencias Stitch.
- Evaluar si cuenta creada con saldo inicial debe emitir evento interno/audit log propio fuera de movimientos.

Siguiente paso:

Validar en navegador con usuario real: abrir `Mi Dinero`, crear una cuenta inicial, confirmar que Home deja de sugerir crear cuenta y que el dinero libre se calcula desde datos reales.

---

### Actualizacion 2026-06-27 - Cajas base en Mi Dinero

Fecha:

2026-06-27

Corte:

Corte 8 iniciado parcialmente: cajas base reales dentro de Mi Dinero.

Que se implemento:

- Se agrego `GET /api/v1/boxes` para listar cajas activas del usuario autenticado.
- Se agrego `POST /api/v1/boxes` para crear cajas desde Dashboard.
- Crear caja verifica primero que la cuenta pertenezca al usuario.
- La caja se crea con saldo `0` desde backend controlado.
- Si el usuario separa un monto inicial, Manzana crea un movimiento `asignacion_interna` mediante `CommandDispatcher` y Core financiero.
- La asignacion inicial no cambia el saldo total ni el saldo de la cuenta; actualiza el saldo de la caja y reduce el dinero libre calculado.
- Si falla la asignacion antes de pasar por Core, se hace `soft delete` compensatorio de la caja creada.
- Si la asignacion ya fue creada por Core, no se elimina la caja por fallos posteriores de lectura.
- Mi Dinero permite crear cajas desde el bloque `Cajas` cuando ya existe al menos una cuenta.
- El formulario de caja pide solo lo necesario: cuenta, nombre, tipo, monto separado, meta opcional y fecha objetivo opcional.
- El schema valida montos no negativos, maximo dos decimales y evita que el monto separado supere la meta.
- Se agregaron labels de tipo de caja en el view-model.

Archivos principales:

- `src/app/api/v1/boxes/route.ts`
- `src/app/api/v1/boxes/schemas.ts`
- `src/app/api/v1/boxes/schemas.test.ts`
- `src/data/repositories/accounts.repository.ts`
- `src/features/money/money-api.ts`
- `src/features/money/money-screen.tsx`
- `src/features/money/money-view-model.ts`
- `docs/fase_4_tecnica/23b_seguimiento_construccion_v1.md`

Que quedo mockeado:

- La edicion y eliminacion de cajas se implementaron en la actualizacion siguiente del mismo dia.
- No hay movimiento manual entre cajas desde UI.
- Los compromisos derivados de deudas, recurrentes y pagos que vienen siguen sin conectarse al calculo operativo.
- No hay RPC atomica dedicada para crear caja + asignacion inicial; por ahora se usa caja con saldo `0`, Core para asignacion y rollback compensatorio si la asignacion falla antes de confirmar.

Pruebas ejecutadas:

- `npm run typecheck`: OK.
- `npm run lint`: OK con warning preexistente en `.cursor/stitch-proxy.mjs`.
- `npm run test`: 179 tests OK.
- `npm run build`: OK.
- `npm run test -- --run src/app/api/v1/boxes/schemas.test.ts src/features/money/money-view-model.test.ts src/core/finance/command-dispatcher.test.ts`: OK.
- Deploy Vercel production + alias `https://manzana.website`: OK.
- Health remoto: `GET https://manzana.website/api/health` OK.
- Ruta Boxes remota sin sesion: `GET https://manzana.website/api/v1/boxes` devuelve `401 AUTH_REQUIRED`, esperado.
- Ruta Money remota sin sesion: `GET https://manzana.website/api/v1/money` devuelve `401 AUTH_REQUIRED`, esperado.

Capturas/artefactos:

- Pendiente QA visual desktop/mobile de Mi Dinero con sesion real y cuenta creada.

Deuda tecnica nueva:

- Crear una RPC transaccional o comando Core especifico para caja + asignacion inicial si se requiere atomicidad fuerte sin compensacion.
- Implementar edicion de cajas sin tocar `current_balance`.
- Implementar eliminacion segura de cajas: solo si saldo `0` o con flujo explicito de reasignacion.
- Implementar movimientos entre cajas mediante `asignacion_interna`.
- Agregar prueba de integracion DB para confirmar que caja inicial con monto actualiza `boxes.current_balance` y no toca `accounts.current_balance`.

Siguiente paso:

Correr verificacion completa del corte y desplegar. Luego validar en navegador con usuario real: crear una caja desde Mi Dinero y confirmar que Home/Mi Dinero descuentan el monto separado del dinero libre.

---

### Actualizacion 2026-06-27 - Edicion y eliminacion segura de cajas

Fecha:

2026-06-27

Corte:

Corte 8 extendido: cajas corregibles dentro de Mi Dinero.

Que se implemento:

- Se agrego `PATCH /api/v1/boxes/:id` para editar nombre, tipo, meta y fecha objetivo.
- La edicion no permite cambiar `current_balance` ni mover la caja de cuenta.
- La edicion rechaza una meta menor al saldo actual de la caja.
- Se agrego `DELETE /api/v1/boxes/:id` para eliminar cajas de forma segura.
- Si la caja tiene saldo, eliminarla crea primero un movimiento `asignacion_interna` via `CommandDispatcher` y Core para liberar el monto a dinero libre.
- Si la caja no tiene saldo, se hace `soft delete` sin crear movimiento.
- La eliminacion usa `service_role` controlado porque `deleted_at` no esta disponible para clientes autenticados por RLS.
- El flujo es reintentable: si liberar saldo funciona pero falla el soft delete, un nuevo intento elimina la caja ya sin saldo.
- Mi Dinero ahora permite editar y eliminar cajas desde cada fila con acciones iconicas.
- El modal de edicion muestra saldo separado y aclara que editar no mueve dinero.
- El dialogo de eliminacion explica si el dinero volvera a libre antes de ejecutar la accion destructiva.

Archivos principales:

- `src/app/api/v1/boxes/[id]/route.ts`
- `src/app/api/v1/boxes/schemas.ts`
- `src/app/api/v1/boxes/schemas.test.ts`
- `src/data/repositories/accounts.repository.ts`
- `src/features/money/money-api.ts`
- `src/features/money/money-screen.tsx`
- `docs/fase_4_tecnica/23b_seguimiento_construccion_v1.md`

Que quedo mockeado:

- No hay movimiento manual entre cajas desde UI.
- No hay UI explicita para liberar solo una parte del saldo de una caja.
- No hay prueba de integracion DB que confirme el efecto real de `DELETE /api/v1/boxes/:id` sobre `boxes.current_balance` y `accounts.current_balance`.

Pruebas ejecutadas:

- `npm run test -- --run src/app/api/v1/boxes/schemas.test.ts src/features/money/money-view-model.test.ts src/core/finance/command-dispatcher.test.ts`: 16 tests OK.
- `npm run typecheck`: OK.
- `npm run lint`: OK con warning preexistente en `.cursor/stitch-proxy.mjs`.
- `npm run test`: 182 tests OK.
- `npm run build`: OK.
- Deploy Vercel production + alias `https://manzana.website`: OK.
- Health remoto: `GET https://manzana.website/api/health` OK.
- Ruta Boxes PATCH remota sin sesion: `PATCH https://manzana.website/api/v1/boxes/:id` devuelve `401 AUTH_REQUIRED`, esperado.
- Ruta Boxes DELETE remota sin sesion: `DELETE https://manzana.website/api/v1/boxes/:id` devuelve `401 AUTH_REQUIRED`, esperado.

Capturas/artefactos:

- Pendiente QA visual desktop/mobile de Mi Dinero con sesion real para crear, editar y eliminar caja.

Deuda tecnica nueva:

- Agregar test de integracion DB para eliminar caja con saldo y verificar que la asignacion interna libera dinero sin tocar saldo de cuenta.
- Implementar movimiento parcial de dinero entre libre/caja y caja/caja.
- Evaluar si el historial de caja necesita una vista propia cuando existan muchas asignaciones internas.

Siguiente paso:

Desplegar y validar remoto. Luego probar con sesion real en Dashboard: crear caja, editarla, eliminarla y revisar que el dinero libre cambie solo cuando corresponde.

---

### Actualizacion 2026-06-27 - Edicion y eliminacion segura de cuentas

Fecha:

2026-06-27

Corte:

Corte 8 extendido: cuentas corregibles dentro de Mi Dinero.

Que se implemento:

- Se agrego `PATCH /api/v1/accounts/:id` para editar nombre, tipo, institucion, color e icono.
- La edicion de cuenta no permite cambiar saldo ni moneda.
- Se agrego `DELETE /api/v1/accounts/:id` con eliminacion segura.
- Eliminar cuenta queda bloqueado si la cuenta tiene saldo distinto de cero.
- Eliminar cuenta queda bloqueado si tiene cajas activas.
- La eliminacion usa `service_role` controlado para marcar `deleted_at`; el cliente autenticado no recibe permiso directo para borrar cuentas.
- Mi Dinero ahora permite editar y eliminar cuentas desde cada fila.
- El modal de edicion muestra el saldo actual y aclara que corregir saldo requiere un ajuste financiero auditado.
- El dialogo de eliminacion explica por que una cuenta con saldo o cajas no se puede eliminar todavia.

Archivos principales:

- `src/app/api/v1/accounts/[id]/route.ts`
- `src/app/api/v1/accounts/schemas.ts`
- `src/app/api/v1/accounts/schemas.test.ts`
- `src/features/money/money-api.ts`
- `src/features/money/money-screen.tsx`
- `docs/fase_4_tecnica/23b_seguimiento_construccion_v1.md`

Que quedo mockeado:

- No hay ajuste de saldo desde Mi Dinero.
- No hay transferencia entre cuentas desde Mi Dinero.
- No hay cambio atomico de cuenta default entre multiples cuentas.
- No hay eliminacion asistida que transfiera o ajuste saldo automaticamente.

Pruebas ejecutadas:

- `npm run test -- --run src/app/api/v1/accounts/schemas.test.ts src/features/money/money-view-model.test.ts`: 8 tests OK.
- `npm run typecheck`: OK.
- `npm run lint`: OK con warning preexistente en `.cursor/stitch-proxy.mjs`.
- `npm run test`: 185 tests OK.
- `npm run build`: OK.
- Deploy Vercel production + alias `https://manzana.website`: OK.
- Health remoto: `GET https://manzana.website/api/health` OK.
- Ruta Accounts PATCH remota sin sesion: `PATCH https://manzana.website/api/v1/accounts/:id` devuelve `401 AUTH_REQUIRED`, esperado.
- Ruta Accounts DELETE remota sin sesion: `DELETE https://manzana.website/api/v1/accounts/:id` devuelve `401 AUTH_REQUIRED`, esperado.

Capturas/artefactos:

- Pendiente QA visual desktop/mobile de Mi Dinero con sesion real para editar/eliminar cuentas.

Deuda tecnica nueva:

- Implementar ajustes de saldo como movimiento `ajuste` via Core.
- Implementar transferencia entre cuentas con `transferencia` via Core.
- Implementar cambio de cuenta default de forma atomica.
- Agregar pruebas de integracion DB para bloqueo de eliminacion con saldo y cajas.

Siguiente paso:

Desplegar y validar remoto. Luego probar con sesion real en Dashboard: editar cuenta, intentar eliminar cuenta con saldo/cajas y eliminar una cuenta vacia.

---

### Actualizacion 2026-06-27 - Acciones financieras auditadas en Mi Dinero

Fecha:

2026-06-27

Corte:

Corte 8 extendido: ajustes, transferencias y movimientos de caja desde Dashboard usando Core.

Que se implemento:

- Se agrego `POST /api/v1/money/actions` como endpoint de acciones financieras de Mi Dinero.
- La ruta no edita `accounts.current_balance` ni `boxes.current_balance` directamente.
- Ajustar saldo crea un movimiento `ajuste` via `CommandDispatcher` y requiere `metadata.reason`.
- Transferir entre cuentas crea un movimiento `transferencia` via Core.
- Separar, liberar o mover dinero entre cajas crea un movimiento `asignacion_interna` via Core.
- La API valida ownership de cuentas y cajas antes de crear comandos financieros.
- La API bloquea transferencias entre monedas distintas en V1.
- La API bloquea mover mas dinero del saldo existente de una caja.
- Mi Dinero ahora tiene un modal de accion financiera con tres modos: ajustar saldo, transferir y cajas.
- Las filas de cuenta permiten ajustar saldo o transferir desde esa cuenta.
- Las filas de caja permiten mover dinero de caja.
- Los mensajes de feedback explican si cambio saldo, dinero libre o distribucion de cajas.
- Se agregaron pruebas del Core para ajustes con motivo y rechazo de ajustes sin motivo.

Archivos principales:

- `src/app/api/v1/money/actions/route.ts`
- `src/app/api/v1/money/actions/schemas.ts`
- `src/features/money/money-api.ts`
- `src/features/money/money-screen.tsx`
- `src/core/finance/command-dispatcher.test.ts`
- `docs/fase_4_tecnica/23b_seguimiento_construccion_v1.md`

Que quedo mockeado:

- No hay cambio atomico de cuenta default entre multiples cuentas.
- No hay prueba de integracion DB autenticada para ejecutar `POST /api/v1/money/actions` con sesion real desde test automatizado.
- No hay flujo de vinculacion explicita entre cuenta Dashboard y numero de WhatsApp personal; por ahora los datos siguen aislados por `user_id`.

Pruebas ejecutadas:

- `npm run typecheck`: OK.
- `npm run lint`: OK con warning preexistente en `.cursor/stitch-proxy.mjs`.
- `npm run test -- src/core/finance/command-dispatcher.test.ts`: 9 tests OK.
- `npm run test`: 187 tests OK.
- `npm run build`: OK.
- Deploy Vercel production + alias `https://manzana.website`: OK.
- Health remoto: `GET https://manzana.website/api/health` OK.
- Ruta Money Actions remota sin sesion: `POST https://manzana.website/api/v1/money/actions` devuelve `401 AUTH_REQUIRED`, esperado.

Capturas/artefactos:

- Pendiente QA visual desktop/mobile de Mi Dinero con sesion real para ajustar saldo, transferir entre cuentas y mover dinero de cajas.

Deuda tecnica nueva:

- Agregar prueba de integracion DB con sesion real o fixture de auth para `POST /api/v1/money/actions`.
- Definir el flujo formal de vinculacion de telefono WhatsApp a usuario Dashboard.
- Evaluar una vista de historial por cuenta/caja cuando existan muchas acciones financieras internas.

Siguiente paso:

QA real en staging de las tres acciones nuevas de Mi Dinero. Luego continuar con el siguiente corte del Dashboard/Core segun prioridad de implementacion.

---

### Actualizacion 2026-06-27 - Fix source_ref en acciones financieras

Fecha:

2026-06-27

Corte:

Correccion de persistencia para transferencias, ajustes y movimientos de caja desde Mi Dinero.

Que se implemento:

- Se corrigio `POST /api/v1/money/actions` para que cada accion financiera genere un `source_ref` unico por `Idempotency-Key`.
- Antes, el endpoint usaba `source_ref` constante por tipo de movimiento (`money-action:transferencia`, etc.).
- Eso podia chocar con el indice unico `movements_user_source_ref_idx` en movimientos confirmados del mismo usuario y fuente.
- El cambio mantiene la regla de deduplicacion del Core, pero permite nuevas transferencias legitimas.
- Se endurecio la validacion del header `Idempotency-Key` para respetar el limite del Core.
- Se agrego prueba del helper de `source_ref`.
- Se agrego prueba del Core para transferencia exitosa entre cuentas sin cambiar el total financiero.

Archivos principales:

- `src/app/api/v1/money/actions/route.ts`
- `src/app/api/v1/money/actions/source-ref.ts`
- `src/app/api/v1/money/actions/source-ref.test.ts`
- `src/core/finance/command-dispatcher.test.ts`
- `docs/fase_4_tecnica/23b_seguimiento_construccion_v1.md`

Que quedo mockeado:

- No hay prueba automatizada con sesion real contra Supabase para reproducir el `source_ref` unico en DB.

Pruebas ejecutadas:

- `npm run typecheck`: OK.
- `npx vitest run src/app/api/v1/money/actions/source-ref.test.ts src/core/finance/command-dispatcher.test.ts`: 12 tests OK.
- `npm run lint`: OK con warning preexistente en `.cursor/stitch-proxy.mjs`.
- `npm test`: 190 tests OK.
- `npm run build`: OK.
- Deploy Vercel production + alias `https://manzana.website`: OK.
- Health remoto: `GET https://manzana.website/api/health` OK.
- Ruta Money Actions remota sin sesion: `POST https://manzana.website/api/v1/money/actions` devuelve `401 AUTH_REQUIRED`, esperado.

Capturas/artefactos:

- Screenshot del usuario mostro error generico: `No se pudo guardar el movimiento` al transferir entre cuentas.
- QA real posterior del usuario: transferencia entre cuentas ya guarda correctamente en `https://manzana.website`.

Deuda tecnica nueva:

- Mejorar el mensaje de error del UI/API para distinguir duplicados de trazabilidad, validacion y fallas DB.
- Agregar prueba de integracion autenticada para `POST /api/v1/money/actions`.

Siguiente paso:

Completar QA real de ajustar saldo y acciones de cajas si no se hizo; luego continuar con el siguiente corte del Dashboard/Core.

---

## 9. Corte: Vinculacion WhatsApp Con Usuario Dashboard

Fecha:

2026-06-27

Corte:

Se formalizo la vinculacion entre el numero personal de WhatsApp y la cuenta autenticada del Dashboard usando `profiles.phone_e164` como fuente V1. No se creo una tabla nueva porque el dominio ya tenia el campo correcto, RLS y unicidad por telefono.

Que se implemento:

- Normalizacion compartida de telefono para guardar en formato E.164 con `+`.
- Lookup de webhook mas robusto: ahora encuentra perfiles con telefono guardado como `+519...` o `519...`.
- Proteccion contra matches ambiguos: si dos perfiles historicos pudieran coincidir con el mismo numero en formatos distintos, el webhook no asigna el mensaje automaticamente.
- Endpoint autenticado `GET/PATCH /api/v1/profile` para leer y actualizar perfil/canal.
- Pantalla real de Configuracion para vincular o desvincular WhatsApp.
- Copy explicito: vincular WhatsApp no confirma pendientes, no mueve saldos y no cambia movimientos anteriores.

Archivos principales:

- `src/shared/phone.ts`
- `src/shared/phone.test.ts`
- `src/data/repositories/whatsapp-window.repository.ts`
- `src/app/api/v1/profile/route.ts`
- `src/app/api/v1/profile/schemas.ts`
- `src/app/api/v1/profile/schemas.test.ts`
- `src/features/settings/settings-api.ts`
- `src/features/settings/settings-screen.tsx`
- `src/features/dashboard/dashboard-app.tsx`
- `docs/fase_4_tecnica/23b_seguimiento_construccion_v1.md`

Que quedo mockeado:

- No hay prueba end-to-end autenticada contra Supabase real para guardar `phone_e164` desde UI.
- No se migra automaticamente historial viejo de WhatsApp que haya quedado asociado a otro usuario o sin usuario; por seguridad, el vinculo aplica hacia adelante.

Pruebas ejecutadas:

- `npm run typecheck`: OK.
- `npx vitest run src/shared/phone.test.ts src/app/api/v1/profile/schemas.test.ts src/app/api/webhooks/whatsapp/route.test.ts`: 8 tests OK.
- `npm run lint`: OK con warning preexistente en `.cursor/stitch-proxy.mjs`.
- `npm test`: 196 tests OK.
- `npm run build`: OK.
- Deploy Vercel production + alias `https://manzana.website`: OK.
- Health remoto: `GET https://manzana.website/api/health` OK.
- Ruta Profile remota sin sesion: `GET https://manzana.website/api/v1/profile` devuelve `401 AUTH_REQUIRED`, esperado.
- Pantalla remota: `GET https://manzana.website/?view=settings` devuelve `200 OK`.

Capturas/artefactos:

- Deployment: `https://manzana-staging-an0u8wjpp-marcobernas-projects.vercel.app`.
- Alias activo: `https://manzana.website`.
- QA real del usuario: despues de liberar el telefono duplicado en Supabase, el usuario pudo guardar su WhatsApp personal desde Configuracion y confirmar que el vinculo funciona hacia adelante.

Deuda tecnica nueva:

- Agregar prueba integrada autenticada para `PATCH /api/v1/profile`.
- Evaluar un flujo seguro de reclamo manual de eventos WhatsApp antiguos solo si el usuario lo pide y hay evidencia clara.

Siguiente paso:

Continuar con Corte 8: convertir Deudas en dominio real visible en Dashboard sin mezclarlo con movimientos o saldos.

---

## 10. Corte: Deudas V1 Base

Fecha:

2026-06-28

Corte:

Corte 8 extendido: se inicio Deudas como entidad financiera propia. El objetivo de este corte es permitir crear y listar deudas activas desde Dashboard sin tocar saldos, cuentas ni cajas por accidente. Pagos, cobros, cuotas profundas y cierre quedan para el siguiente corte de Debt Engine/Core.

Que se implemento:

- Migracion `013_debts.sql` con `related_persons`, `debts`, `debt_payments` y `debt_installments`.
- RLS y grants: el cliente autenticado solo puede leer sus deudas; las escrituras pasan por backend/service role.
- FKs diferidas desde `boxes.linked_debt_id` y `movements.debt_id` hacia `debts`.
- Tipos de dominio para `Debt`, `RelatedPerson`, `DebtPayment` y `DebtInstallment`.
- Repositorio de deudas con creacion de persona/entidad relacionada cuando aplica.
- Endpoint `GET/POST /api/v1/debts`.
- Pantalla real de Deudas en Dashboard con resumen, estado vacio, lista y modal de creacion.
- Copy explicito: crear deuda no mueve saldos; pagos se registran en flujo separado.

Archivos principales:

- `supabase/migrations/013_debts.sql`
- `src/data/migrations/013_debts.sql`
- `src/data/repositories/debts.repository.ts`
- `src/app/api/v1/debts/route.ts`
- `src/app/api/v1/debts/schemas.ts`
- `src/features/debts/debts-screen.tsx`
- `src/features/debts/debts-api.ts`
- `src/features/debts/debts-types.ts`
- `src/features/debts/debts-view-model.ts`
- `src/features/dashboard/dashboard-app.tsx`
- `src/shared/types/domain.ts`
- `src/data/supabase/types.ts`

Que quedo mockeado:

- No hay aun flujo real para registrar pagos/cobros desde la pantalla de Deudas.
- No hay aun Debt Engine que reduzca `current_balance` por movimientos `pago_deuda` o `devolucion_recibida`.
- No hay aun detector de vencimientos, nudges ni calculo de compromisos futuros conectado a Home/Mi Dinero.

Pruebas ejecutadas:

- `npm.cmd run typecheck`: OK.
- `npx.cmd vitest run src/features/debts/debts-view-model.test.ts src/data/migrations/migrations.test.ts`: OK, 14 tests.
- `npm.cmd test`: OK, 200 tests.
- `npm.cmd run build`: OK; la ruta `/api/v1/debts` aparece en el build.
- `npm.cmd run lint`: OK con warning preexistente en `.cursor/stitch-proxy.mjs` por `outputSchema` no usado.
- `supabase migration list`: remoto sincronizado hasta `013`.
- Verificacion REST Supabase con service role: `related_persons`, `debts`, `debt_payments` y `debt_installments` responden 200.
- Deploy Vercel production: OK; alias actualizado a `https://manzana.website`.
- Health remoto `GET https://manzana.website/api/health`: OK.
- Pantalla remota `GET https://manzana.website/?view=debts`: OK 200.
- API remota sin sesion `GET https://manzana.website/api/v1/debts`: OK 401 `AUTH_REQUIRED`.

Capturas/artefactos:

- Migracion `013_debts.sql` aplicada en Supabase remoto `manzana-staging`.
- Deploy production Vercel aliasado a `https://manzana.website`.
- Pendiente QA visual autenticado creando una deuda real desde Dashboard.

Deuda tecnica nueva:

- Implementar pagos de deuda con Core/Debt Engine y outbox transaccional.
- Conectar cuotas proximas a Pagos que vienen/Home cuando exista el motor de recurrentes o compromisos.
- Agregar detalle de deuda con historial, pagos, movimientos vinculados y audit trail.

Siguiente paso:

Hacer QA visual autenticado creando una deuda real desde Dashboard. Luego continuar con pagos/cobros de deuda via Core/Debt Engine.

---

## 11. Corte: Pagos Y Cobros De Deuda Por Core

Fecha:

2026-06-29

Corte:

Corte 9: pagos/cobros de deuda transaccionales. El objetivo de este corte fue que una deuda ya no sea solo una entidad visible, sino que pueda reducirse con un pago o una devolucion sin romper las reglas del Core financiero.

Que se implemento:

- Migracion `014_debt_payments_core.sql`.
- Funcion controlada `public.commit_debt_payment(...)`.
- Unicidad por `movement_id` en `debt_payments`.
- `debt_payments.currency` y `debts.last_payment_at` para cerrar el contrato real de pago.
- Pago de deuda (`i_owe`) crea movimiento `pago_deuda` via Core.
- Devolucion recibida (`they_owe_me`) crea movimiento `devolucion_recibida` via Core.
- Si el usuario elige cuenta, el Core actualiza el saldo de cuenta segun el tipo de movimiento.
- Si el usuario deja cuenta vacia, la deuda baja pero no se toca saldo de cuenta.
- La deuda actualiza `current_balance`, `status`, `last_payment_at`, `closed_at` cuando queda pagada y metadata de ultimo pago.
- El mismo commit escribe movimiento, auditoria, saldos, `debt_payment`, deuda y outbox dentro de una transaccion.
- Endpoint `POST /api/v1/debts/[id]/payments`.
- UI en Dashboard Deudas para registrar pago o devolucion desde cada tarjeta.
- Selector de cuenta filtrado por moneda de la deuda.
- Validacion de monto mayor a cero y no mayor al saldo pendiente.
- Feedback de producto que aclara si se tocaron saldos de cuenta o solo la deuda.

Archivos principales:

- `supabase/migrations/014_debt_payments_core.sql`
- `src/data/migrations/014_debt_payments_core.sql`
- `src/core/finance/command-dispatcher.ts`
- `src/data/repositories/debts.repository.ts`
- `src/app/api/v1/debts/[id]/payments/route.ts`
- `src/app/api/v1/debts/[id]/payments/schemas.ts`
- `src/features/debts/debts-screen.tsx`
- `src/features/debts/debts-api.ts`
- `src/features/debts/debts-types.ts`
- `src/shared/types/domain.ts`
- `src/data/supabase/types.ts`
- `docs/fase_4_tecnica/16_modelo_datos.md`

Que quedo mockeado:

- No hay pantalla de detalle de deuda con historial completo.
- No hay edicion/cancelacion/cierre manual de deuda.
- No hay calendario real de cuotas ni recalculo de cuotas.
- No hay nudges de deuda proxima o vencida.
- No hay prueba automatizada autenticada que cree una deuda y registre pago en Supabase remoto con usuario real.

Pruebas ejecutadas:

- `npm.cmd run typecheck`: OK.
- `npx.cmd vitest run src/data/migrations/migrations.test.ts src/features/debts/debts-view-model.test.ts`: OK, 15 tests.
- `npm.cmd run lint`: OK con warning preexistente en `.cursor/stitch-proxy.mjs` por `outputSchema` no usado.
- `npm.cmd test -- --run`: OK, 201 tests.
- `npm.cmd run build`: OK; la ruta `/api/v1/debts/[id]/payments` aparece en el build.
- `supabase db push --dry-run`: solo `014_debt_payments_core.sql`.
- `supabase db push --yes`: migracion `014` aplicada.
- `supabase migration list`: remoto sincronizado hasta `014`.
- Verificacion DB remota: `public.commit_debt_payment(...)` existe; `debt_payments.currency` y `debts.last_payment_at` existen.
- Deploy Vercel production: OK; alias actualizado a `https://manzana.website`.
- Health remoto `GET https://manzana.website/api/health`: OK.
- Pantalla remota `GET https://manzana.website/?view=debts`: OK 200.
- API remota sin sesion `POST https://manzana.website/api/v1/debts/:id/payments`: OK 401 `AUTH_REQUIRED`.
- QA real autenticado reportado por el usuario: crear deuda, registrar pago/devolucion y validar saldos funciona sin fallas visibles.

Capturas/artefactos:

- Migracion `014_debt_payments_core.sql` aplicada en Supabase remoto `manzana-staging`.
- Deploy production Vercel aliasado a `https://manzana.website`.
- QA visual autenticado registrando pago/cobro real desde Dashboard: pasado por el usuario.

Deuda tecnica nueva:

- Agregar prueba integrada autenticada para crear deuda y registrar pago/cobro con cuenta y sin cuenta.
- Agregar pantalla de detalle de deuda con pagos, movimientos vinculados y audit trail.
- Conectar cuotas/vencimientos a Pagos que vienen, Home y Nudge Policy.
- Mejorar copy de errores para diferenciar exceso de saldo, cuenta/moneda incompatible y deuda inactiva.

Siguiente paso:

Continuar con Recurrentes / Pagos que vienen V1 para anticipar compromisos, alimentar Home/Mi Dinero y preparar nudges utiles. Como alternativa posterior, agregar detalle de deuda con historial y audit trail.

---

## 12. Corte: Recurrentes / Pagos Que Vienen V1

Fecha:

2026-06-29

Corte:

Corte 10: recurrentes como compromisos esperados y pagos confirmados via Core. El objetivo de este corte es que "Pagos que vienen" deje de ser placeholder y permita anticipar pagos sin tocar saldos hasta que el usuario confirme un pago real.

Que se implemento:

- Migracion `015_recurring_payments.sql`.
- Tablas `recurring_rules`, `recurring_occurrences` y `recurring_candidates`.
- FKs desde `boxes.linked_recurring_id`, `movements.recurring_rule_id` y `movements.recurring_occurrence_id`.
- RLS y grants: el cliente autenticado solo lee; las escrituras pasan por backend/service role.
- Funcion controlada `public.commit_recurring_payment(...)`.
- Marcar pagado crea movimiento `pago_recurrente` con `source = recurring_confirmed` via Core.
- Si el usuario elige cuenta, Core descuenta saldo de esa cuenta.
- Si el usuario deja cuenta vacia, se registra el pago recurrente confirmado sin tocar saldos de cuenta.
- El commit transaccional actualiza movimiento, auditoria, saldos opcionales, ocurrencia, regla y outbox.
- `GET/POST /api/v1/recurring`.
- `PATCH /api/v1/recurring/[id]`.
- `POST /api/v1/recurring/[id]/cancel`.
- `POST /api/v1/recurring/[id]/occurrences/[occurrence_id]/mark-paid`.
- Pantalla real `Pagos que vienen` en Dashboard:
  - resumen de activos/vencidos/pausados/estimado mensual;
  - crear y editar pago esperado;
  - marcar pagado con cuenta opcional;
  - pausar/reactivar/cancelar;
  - seccion de sugeridos preparada para detecciones futuras.
- Home muestra proximos compromisos recurrentes como lectura.
- Mi Dinero calcula `upcoming_uncovered_commitments` y `operational_free_money` descontando compromisos recurrentes no cubiertos solo como senal read-only.
- Decision de seguridad: pagos recurrentes con `linked_debt_id` se rechazan en este flujo y deben registrarse desde Deudas para no duplicar efectos sobre saldo de deuda.

Archivos principales:

- `supabase/migrations/015_recurring_payments.sql`
- `src/data/migrations/015_recurring_payments.sql`
- `src/data/repositories/recurring.repository.ts`
- `src/app/api/v1/recurring/route.ts`
- `src/app/api/v1/recurring/[id]/route.ts`
- `src/app/api/v1/recurring/[id]/cancel/route.ts`
- `src/app/api/v1/recurring/[id]/occurrences/[occurrence_id]/mark-paid/route.ts`
- `src/features/upcoming/upcoming-screen.tsx`
- `src/features/upcoming/upcoming-api.ts`
- `src/features/upcoming/upcoming-view-model.ts`
- `src/app/api/v1/money/route.ts`
- `src/app/api/v1/dashboard/home/route.ts`
- `src/features/home/home-screen.tsx`
- `src/shared/types/domain.ts`
- `src/data/supabase/types.ts`

Que quedo mockeado:

- No hay worker detector de recurrentes desde historial.
- No hay confirmacion/descarte de candidatos automaticos desde UI; la tabla y lectura quedan preparadas.
- No hay integracion de cuotas de deuda dentro de Pagos que vienen; los pagos vinculados a deuda siguen en Deudas.
- No hay nudges proactivos de pago proximo/vencido.
- No hay prueba automatizada autenticada contra Supabase real para crear y marcar pagado con usuario real.

Pruebas ejecutadas:

- `npm.cmd run typecheck`: OK.
- `npm.cmd test -- src/data/migrations/migrations.test.ts src/features/upcoming/upcoming-view-model.test.ts src/core/finance/command-dispatcher.test.ts`: OK, 28 tests.
- `npm.cmd run lint`: OK con warning preexistente en `.cursor/stitch-proxy.mjs` por `outputSchema` no usado.
- `npm.cmd test`: OK, 207 tests.
- `npm.cmd run build`: OK; las rutas `/api/v1/recurring`, `/api/v1/recurring/[id]`, `/api/v1/recurring/[id]/cancel` y `/api/v1/recurring/[id]/occurrences/[occurrence_id]/mark-paid` aparecen en el build.
- `supabase db push --dry-run`: solo `015_recurring_payments.sql`.
- `supabase db push --yes`: migracion `015` aplicada.
- `supabase migration list`: remoto sincronizado hasta `015`.
- Verificacion REST Supabase con service role: `recurring_rules`, `recurring_occurrences` y `recurring_candidates` responden 200.
- Verificacion RPC remota dummy: `commit_recurring_payment` existe y rechaza con `RECURRING_RULE_NOT_FOUND`, esperado.
- Deploy Vercel production: OK; alias actualizado a `https://manzana.website`.
- Health remoto `GET https://manzana.website/api/health`: OK.
- Pantalla remota `GET https://manzana.website/?view=upcoming`: OK 200.
- API remota sin sesion `GET https://manzana.website/api/v1/recurring`: OK 401 `AUTH_REQUIRED`.
- API remota sin sesion `POST https://manzana.website/api/v1/recurring/:id/occurrences/:occurrence_id/mark-paid`: OK 401 `AUTH_REQUIRED`.

Capturas/artefactos:

- Deployment production: `https://manzana-staging-c8nqwyqaw-marcobernas-projects.vercel.app`.
- Alias activo: `https://manzana.website`.
- Pendiente QA visual autenticado desktop/mobile de `?view=upcoming`.

Deuda tecnica nueva:

- Implementar worker detector de recurrentes y flujo de candidatos sugeridos.
- Definir union segura entre recurrente vinculado a deuda y Debt Engine antes de permitir pago desde esta pantalla.
- Conectar vencimientos recurrentes a Nudge Policy.
- Agregar prueba integrada autenticada para `mark-paid` con cuenta y sin cuenta.
- Agregar detalle de pago recurrente con historial de ocurrencias.

Siguiente paso:

Hacer QA visual autenticado de Pagos que vienen: crear pago, editarlo, marcarlo pagado sin cuenta, marcar otro pagado con cuenta, pausar/reactivar y validar Home/Mi Dinero. Luego continuar con detector/candidatos o con detalle avanzado segun prioridad.

---

### Actualizacion 2026-06-29 - Fix QA Pagos Que Vienen

Fecha:

2026-06-29

Corte:

Correccion post-QA autenticado del corte Recurrentes / Pagos que vienen V1.

Que se implemento:

- Se corrigio la edicion de pagos que vienen: el modal ya no envia `currency` al PATCH estricto, evitando `VALIDATION_ERROR` por campos invalidos.
- Al marcar pagado con la fecha de hoy, el movimiento usa hora actual en vez de mediodia, para aparecer arriba en Movimientos recientes del mismo dia.
- La pantalla de Pagos que vienen ahora muestra una seccion `Pagados` con ocurrencias pagadas recientes.
- Una regla recurrente puede mostrar a la vez la ocurrencia pagada y la proxima ocurrencia abierta, evitando la sensacion de que no se marco como pagada.
- Home/Mi Dinero siguen tomando solo ocurrencias abiertas para compromisos futuros, no las ya pagadas.

Archivos principales:

- `src/features/upcoming/upcoming-screen.tsx`
- `src/features/upcoming/upcoming-view-model.ts`
- `src/features/upcoming/upcoming-view-model.test.ts`
- `src/data/repositories/recurring.repository.ts`

Que quedo mockeado:

- No hay historial/detail dedicado de recurrente; la seccion `Pagados` es una vista compacta.
- No hay QA automatizado autenticado contra datos reales de produccion.

Pruebas ejecutadas:

- `npm.cmd run typecheck`: OK.
- `npm.cmd test -- src/features/upcoming/upcoming-view-model.test.ts src/core/finance/command-dispatcher.test.ts`: OK, 16 tests.
- `npm.cmd run lint`: OK con warning preexistente en `.cursor/stitch-proxy.mjs` por `outputSchema` no usado.
- `npm.cmd test`: OK, 208 tests.
- `npm.cmd run build`: OK.
- Deploy Vercel production: OK; alias actualizado a `https://manzana.website`.
- Health remoto `GET https://manzana.website/api/health`: OK.
- Pantalla remota `GET https://manzana.website/?view=upcoming`: OK 200.
- API remota sin sesion `GET https://manzana.website/api/v1/recurring`: OK 401 `AUTH_REQUIRED`.

Capturas/artefactos:

- Deployment production: `https://manzana-staging-cti2r9utg-marcobernas-projects.vercel.app`.
- Alias activo: `https://manzana.website`.
- Pendiente re-QA autenticado del usuario sobre editar, marcar pagado sin cuenta y marcar pagado con cuenta.

Deuda tecnica nueva:

- Evaluar una vista detalle/historial por recurrente cuando existan varias ocurrencias pagadas.

Siguiente paso:

Repetir QA autenticado: editar pago, marcar pagado sin cuenta, marcar pagado con cuenta y confirmar que aparece en `Pagados` y arriba en Movimientos cuando se paga hoy.

---

### Actualizacion 2026-06-29 - Claridad De Pago Adelantado Recurrente

Fecha:

2026-06-29

Corte:

Correccion post-QA autenticado del corte Recurrentes / Pagos que vienen V1.

Que se implemento:

- Decision de producto: si el usuario paga una ocurrencia recurrente, la regla puede mostrar inmediatamente la siguiente ocurrencia abierta. Eso es correcto y no duplica el pago cerrado.
- La seccion antes llamada `Activos` ahora se presenta como `Proximos`, para dejar claro que es el siguiente vencimiento abierto.
- Si la siguiente ocurrencia tiene fecha futura, el boton dice `Pagar adelantado` en vez de `Marcar pagado`.
- El modal de confirmacion muestra `Pago adelantado` y avisa que se cerrara esa ocurrencia futura y se dejara listo el siguiente ciclo.
- No se cambio la ruta financiera: al confirmar, el pago sigue entrando por `commit_recurring_payment` y Core; sin cuenta no toca saldos, con cuenta descuenta saldo por Core.

Archivos principales:

- `src/features/upcoming/upcoming-screen.tsx`
- `src/features/upcoming/upcoming-view-model.ts`
- `src/features/upcoming/upcoming-view-model.test.ts`
- `src/features/upcoming/upcoming-types.ts`

Que quedo mockeado:

- No hay bloqueo por ventana de pago; V1 permite pago adelantado explicito.
- No hay vista detalle/historial dedicada por regla recurrente.

Pruebas ejecutadas:

- `npm.cmd run typecheck`: OK.
- `npm.cmd test -- src/features/upcoming/upcoming-view-model.test.ts`: OK, 4 tests.
- `npm.cmd run lint`: OK con warning preexistente en `.cursor/stitch-proxy.mjs` por `outputSchema` no usado.
- `npm.cmd test`: OK, 208 tests.
- `npm.cmd run build`: OK.
- Deploy Vercel production: OK; alias actualizado a `https://manzana.website`.
- Health remoto `GET https://manzana.website/api/health`: OK.
- Pantalla remota `GET https://manzana.website/?view=upcoming`: OK 200.
- API remota sin sesion `GET https://manzana.website/api/v1/recurring`: OK 401 `AUTH_REQUIRED`.

Capturas/artefactos:

- Deployment production: `https://manzana-staging-4fuymx4ei-marcobernas-projects.vercel.app`.
- Alias activo: `https://manzana.website`.

Deuda tecnica nueva:

- Evaluar si V1 debe agregar una ventana de confirmacion mas fuerte para pagos muy anticipados, por ejemplo mas de 7 o 15 dias antes del vencimiento.

Siguiente paso:

Re-QA autenticado de la pantalla: confirmar que el pago ya cerrado aparece en `Pagados`, que el siguiente ciclo aparece en `Proximos` y que el boton de fecha futura dice `Pagar adelantado`.

---

### Actualizacion 2026-06-29 - Orden De Movimientos Recientes

Fecha:

2026-06-29

Corte:

Correccion post-QA autenticado del corte Recurrentes / Pagos que vienen V1.

Que se implemento:

- Se confirmo en Supabase que el pago recurrente reciente si fue creado por Core; el problema era de orden de lectura en Home.
- `Movimientos recientes` ahora ordena por `created_at desc` y luego `occurred_at desc`, porque esa tarjeta representa recencia de registro/confirmacion.
- `GET /api/v1/movements` usa el mismo criterio de recencia de registro para que pagos confirmados recien no queden debajo de movimientos del mismo dia que fueron creados antes con hora financiera de mediodia.
- Se agrego helper de ordenamiento y test para el caso exacto: movimiento creado recien con `occurred_at` mas temprano debe aparecer antes que uno creado antes con `occurred_at` de mediodia.
- No se modificaron movimientos existentes ni saldos; no hubo escritura financiera.

Archivos principales:

- `src/features/movements/movement-sort.ts`
- `src/features/movements/movement-sort.test.ts`
- `src/app/api/v1/dashboard/home/route.ts`
- `src/app/api/v1/movements/route.ts`

Que quedo mockeado:

- No hay migracion para normalizar movimientos historicos creados con hora de mediodia; el fix resuelve la lectura reciente sin tocar historial.

Pruebas ejecutadas:

- `npm.cmd run typecheck`: OK.
- `npm.cmd test -- src/features/movements/movement-sort.test.ts src/features/upcoming/upcoming-view-model.test.ts`: OK, 6 tests.
- `npm.cmd run lint`: OK con warning preexistente en `.cursor/stitch-proxy.mjs` por `outputSchema` no usado.
- `npm.cmd test`: OK, 210 tests.
- `npm.cmd run build`: OK.
- Deploy Vercel production: OK; alias actualizado a `https://manzana.website`.
- Health remoto `GET https://manzana.website/api/health`: OK.
- Pantalla remota `GET https://manzana.website/?view=home`: OK 200.
- Verificacion directa Supabase read-only: el pago recurrente reciente queda primero al ordenar por `created_at desc, occurred_at desc`.

Capturas/artefactos:

- Deployment production: `https://manzana-staging-nlrrnup20-marcobernas-projects.vercel.app`.
- Alias activo: `https://manzana.website`.

Deuda tecnica nueva:

- Evaluar si la UI debe mostrar tambien "registrado hace..." cuando `created_at` y `occurred_at` difieren mucho.

Siguiente paso:

Revisar Home autenticado: `Movimientos recientes` debe mostrar arriba el pago confirmado mas reciente, aunque existan movimientos anteriores del mismo dia con hora financiera de mediodia.

---

### Actualizacion 2026-06-29 - Detector De Recurrentes Y Sugeridos

Fecha:

2026-06-29

Corte:

Corte 11: detector deterministico de recurrentes y flujo de candidatos sugeridos para `Pagos que vienen`.

Que se implemento:

- Motor puro `recurring-detector-v1` para detectar patrones desde movimientos confirmados sin escribir movimientos ni tocar saldos.
- La deteccion es conservadora: requiere comercio normalizado, moneda unica, recurrencia temporal compatible y evidencia suficiente; con dos ocurrencias puede guardar candidato silencioso, con tres puede sugerir.
- Persistencia de `recurring_candidates` via service role/backend, con deduplicacion por usuario y comercio normalizado.
- Migracion `016_recurring_candidate_detection.sql` con limpieza de duplicados abiertos e indice unico parcial para candidatos abiertos.
- API autenticada `POST /api/v1/recurring/detect` para buscar sugerencias del usuario actual.
- Worker interno `POST /api/internal/jobs/recurring-detect` protegido por `WORKER_SECRET`.
- API autenticada `POST /api/v1/recurring/candidates/[id]/confirm` para convertir una sugerencia en regla recurrente esperada.
- API autenticada `POST /api/v1/recurring/candidates/[id]/discard` para ignorar una sugerencia.
- UI de `Sugeridos` ahora permite buscar, aceptar, editar antes de aceptar e ignorar candidatos.
- Aceptar una sugerencia crea un pago esperado; no registra pago real ni mueve saldos. El pago real sigue entrando por `mark-paid` -> `commit_recurring_payment` -> Core.

Archivos principales:

- `src/core/recurring/recurring-detector.ts`
- `src/core/recurring/recurring-detector.test.ts`
- `src/data/repositories/recurring.repository.ts`
- `src/app/api/v1/recurring/detect/route.ts`
- `src/app/api/internal/jobs/recurring-detect/route.ts`
- `src/app/api/v1/recurring/candidates/[id]/confirm/route.ts`
- `src/app/api/v1/recurring/candidates/[id]/discard/route.ts`
- `src/app/api/v1/recurring/schemas.ts`
- `src/features/upcoming/upcoming-screen.tsx`
- `src/features/upcoming/upcoming-api.ts`
- `src/features/upcoming/upcoming-types.ts`
- `src/features/upcoming/upcoming-view-model.ts`
- `src/features/upcoming/upcoming-view-model.test.ts`
- `src/data/migrations/016_recurring_candidate_detection.sql`
- `supabase/migrations/016_recurring_candidate_detection.sql`
- `src/data/migrations/migrations.test.ts`

Que quedo mockeado:

- No hay scheduler durable configurado para ejecutar `recurring-detect` periodicamente; existe la ruta interna protegida.
- No hay QA visual autenticado del usuario final aceptando/ignorando sugerencias con datos reales.
- No hay integracion de candidatos recurrentes con nudges proactivos.
- No se conectaron cuotas de deuda a Pagos que vienen; el bloqueo de pagos recurrentes vinculados a deuda se mantiene.

Pruebas ejecutadas:

- `npm.cmd run typecheck`: OK.
- `npm.cmd run test -- src/core/recurring/recurring-detector.test.ts src/features/upcoming/upcoming-view-model.test.ts src/data/migrations/migrations.test.ts`: OK, 23 tests.
- `npm.cmd run lint`: OK con warning preexistente en `.cursor/stitch-proxy.mjs` por `outputSchema` no usado.
- `npm.cmd run test`: OK, 216 tests.
- `npm.cmd run build`: OK.
- `supabase migration list --linked`: antes de aplicar, remoto tenia 001-015 y local 016 pendiente.
- `supabase db push --linked`: OK, aplico `016_recurring_candidate_detection.sql`.
- `supabase migration list --linked`: OK, remoto quedo con 001-016.
- Deploy Vercel production: OK; alias actualizado a `https://manzana.website`.
- Health remoto `GET https://manzana.website/api/health`: OK, Supabase OK.
- Pantalla remota `GET https://manzana.website/?view=upcoming`: OK 200.
- API remota sin sesion `GET https://manzana.website/api/v1/recurring`: OK 401 `AUTH_REQUIRED`.
- API remota sin sesion `POST https://manzana.website/api/v1/recurring/detect`: OK 401 `AUTH_REQUIRED`.

Capturas/artefactos:

- Deployment production: `https://manzana-staging-n3llz3gx6-marcobernas-projects.vercel.app`.
- Alias activo: `https://manzana.website`.
- Vercel deployment id: `dpl_2ds8kU6zQKNqFZMqXNjxdQUtYCEk`.

Deuda tecnica nueva:

- Programar scheduler durable para `POST /api/internal/jobs/recurring-detect`.
- Hacer QA visual autenticado con historial real: buscar sugerencias, aceptar directo, editar y aceptar, ignorar.
- Definir si una sugerencia aceptada debe disparar nudge opcional cuando la proxima fecha este cerca.
- Agregar prueba integrada autenticada para confirmar/descartar candidato contra Supabase real.

Siguiente paso:

QA autenticado del flujo de sugeridos en `Pagos que vienen`: cargar historial con tres pagos compatibles, buscar sugerencias, aceptar una, confirmar que aparece en `Proximos`, marcarla pagada por Core y verificar Home/Mi Dinero.

---

### Actualizacion 2026-06-29 - Sugeridos Con Monto Variable

Fecha:

2026-06-29

Corte:

Correccion post-QA del detector de recurrentes.

Que se implemento:

- Se diagnostico que `chatgpt` si estaba siendo detectado, pero quedaba como `candidate` silencioso porque habia pagos de `S/ 13` y `S/ 20`.
- El detector ahora muestra patrones temporales claros con 3 o mas ocurrencias y confianza suficiente aunque el monto sea variable.
- La sugerencia mantiene `amount_variability = variable`; el usuario puede editar monto/fecha/categoria antes de aceptar.
- No se cambia el Core financiero: aceptar una sugerencia sigue creando solo un pago esperado, no movimiento ni saldo.

Archivos principales:

- `src/core/recurring/recurring-detector.ts`
- `src/core/recurring/recurring-detector.test.ts`

Que quedo mockeado:

- No hay heuristica avanzada por proveedor para distinguir cambios de plan/precio; V1 lo deja como sugerencia revisable.

Pruebas ejecutadas:

- `npm.cmd run typecheck`: OK.
- `npm.cmd run test -- src/core/recurring/recurring-detector.test.ts`: OK, 5 tests.
- `npm.cmd run build`: OK.
- Deploy Vercel production: OK; alias actualizado a `https://manzana.website`.
- Worker remoto `POST /api/internal/jobs/recurring-detect`: OK, `chatgpt` paso a `ready_to_suggest`.
- Verificacion Supabase service role: candidato `chatgpt` quedo `ready_to_suggest`, confianza `0.784`, `movement_count = 7`, `amount_variability = variable`.

Capturas/artefactos:

- Diagnostico remoto: `chatgpt` tenia 7 ocurrencias compatibles y estaba oculto como `candidate`.
- Deployment production: `https://manzana-staging-3vq5uh455-marcobernas-projects.vercel.app`.
- Vercel deployment id: `dpl_NRy4hZy2GAW4YKx3jATcsWJBa1H6`.

Deuda tecnica nueva:

- Agregar copy especifico en UI para `Monto variable` si el usuario necesita mas claridad.

Siguiente paso:

Abrir `Pagos que vienen`, recargar si hace falta, y revisar `Sugeridos`: debe aparecer `chatgpt` como sugerencia editable.

---

### Actualizacion 2026-06-29 - Scheduler De Detector Recurrente

Fecha:

2026-06-29

Corte:

Automatizacion del detector de recurrentes para que no dependa solo del boton `Buscar`.

Que se implemento:

- `POST /api/internal/jobs/recurring-detect` se mantiene para ejecucion manual/controlada.
- El mismo endpoint ahora acepta `GET` autenticado para ejecucion por Vercel Cron.
- La autorizacion interna acepta `CRON_SECRET` o `WORKER_SECRET`; fuera de `APP_ENV=local` rechaza si no hay secreto valido.
- Se agrego `vercel.json` con cron diario a las `13:00 UTC` (`08:00 America/Lima`) sobre `/api/internal/jobs/recurring-detect`.
- El job sigue siendo no financiero: solo lee movimientos confirmados y crea/actualiza `recurring_candidates`; no crea movimientos ni toca saldos.
- Se configuro `CRON_SECRET` en Vercel Production reutilizando el secreto operativo local de worker.

Archivos principales:

- `src/app/api/internal/jobs/recurring-detect/route.ts`
- `src/app/api/internal/jobs/recurring-detect/route.test.ts`
- `vercel.json`

Que quedo mockeado:

- Vercel Cron real correra en su proxima ventana diaria; se validara despues de la primera ejecucion automatica.
- No hay dashboard interno de ejecuciones de cron; por ahora la trazabilidad queda en respuesta del endpoint y metadata de candidatos.

Pruebas ejecutadas:

- `npm.cmd run test -- src/app/api/internal/jobs/recurring-detect/route.test.ts`: OK, 3 tests.
- `npm.cmd run typecheck`: OK.
- `npm.cmd run test`: OK, 220 tests.
- `npm.cmd run lint`: OK con warning preexistente en `.cursor/stitch-proxy.mjs` por `outputSchema` no usado.
- `npm.cmd run build`: OK.
- `vercel.cmd env ls production`: confirmo que faltaba `CRON_SECRET`.
- `vercel.cmd env add CRON_SECRET production`: OK.
- Deploy Vercel production: OK; alias actualizado a `https://manzana.website`.
- Health remoto `GET https://manzana.website/api/health`: OK, Supabase OK.
- Endpoint cron sin secreto `GET /api/internal/jobs/recurring-detect`: OK 403 `FORBIDDEN`.
- Endpoint cron con secreto `GET /api/internal/jobs/recurring-detect?max_users=5`: OK 200, `trigger = cron_get`.
- `vercel.cmd inspect manzana-staging-28d6cogcx-marcobernas-projects.vercel.app`: OK, deployment `Ready`.

Capturas/artefactos:

- Cron configurado: `0 13 * * *`.
- Ruta cron: `/api/internal/jobs/recurring-detect`.
- Deployment production: `https://manzana-staging-28d6cogcx-marcobernas-projects.vercel.app`.
- Vercel deployment id: `dpl_8E7wHBz86b7bAk3ASGgThpL3s69E`.

Deuda tecnica nueva:

- Verificar la primera ejecucion automatica del cron en Vercel.
- Agregar registro persistente de ejecuciones internas si se necesita auditoria operativa del scheduler.

Siguiente paso:

Esperar la primera ejecucion automatica diaria de Vercel Cron y revisar que las sugerencias se refresquen sin tocar `Buscar`.

---

### Actualizacion 2026-06-29 - Nudges Dashboard V1

Fecha:

2026-06-29

Corte:

Corte 12: avisos utiles internos en Dashboard. El objetivo fue activar la primera capa de Nudge Policy sin mensajes proactivos externos y sin tocar el Core financiero.

Que se implemento:

- Migracion `017_dashboard_nudges.sql`.
- Tablas `nudge_preferences`, `nudge_candidates` y `nudge_deliveries`.
- RLS y grants: el cliente autenticado solo puede leer sus avisos; las escrituras pasan por backend/service role.
- Motor deterministico `dashboard-nudges-v1` para crear candidatos desde ocurrencias recurrentes abiertas.
- Tipos V1 cubiertos: `payment_due` y `overdue_payment`.
- Reglas de seguridad:
  - pagos recurrentes pagados no generan aviso;
  - recurrentes vinculados a deuda no se avisan desde este flujo;
  - avisos descartados por el usuario no se recrean para la misma ocurrencia;
  - avisos stale se expiran si la ocurrencia deja de estar abierta;
  - no se crean movimientos, no se actualizan saldos y no se envia WhatsApp.
- API interna `GET/POST /api/internal/jobs/nudges-evaluate`, protegida por `CRON_SECRET` o `WORKER_SECRET`.
- Vercel Cron diario a las `13:15 UTC` (`08:15 America/Lima`) sobre `/api/internal/jobs/nudges-evaluate`.
- Home consume `dashboard_nudges` desde `GET /api/v1/dashboard/home`.
- UI Home muestra tarjeta `Avisos utiles` solo si hay avisos activos.
- API autenticada `POST /api/v1/nudges/[id]/dismiss` para ocultar un aviso.

Archivos principales:

- `src/data/migrations/017_dashboard_nudges.sql`
- `supabase/migrations/017_dashboard_nudges.sql`
- `src/core/nudges/nudge-evaluator.ts`
- `src/core/nudges/nudge-evaluator.test.ts`
- `src/data/repositories/nudges.repository.ts`
- `src/app/api/internal/jobs/nudges-evaluate/route.ts`
- `src/app/api/internal/jobs/nudges-evaluate/route.test.ts`
- `src/app/api/v1/nudges/[id]/dismiss/route.ts`
- `src/app/api/v1/dashboard/home/route.ts`
- `src/features/home/home-screen.tsx`
- `src/features/home/home-api.ts`
- `src/features/home/home-types.ts`
- `src/shared/types/domain.ts`
- `src/data/supabase/types.ts`
- `vercel.json`

Que quedo mockeado:

- No hay envio WhatsApp proactivo ni templates de nudge.
- No hay UI de preferencias granulares de nudges.
- No hay dashboard interno de ejecuciones del cron.
- No hay nudges de deuda/cuotas todavia; los recurrentes vinculados a deuda siguen bloqueados para evitar doble efecto.

Pruebas ejecutadas:

- `npm.cmd run typecheck`: OK.
- `npm.cmd run test -- src/core/nudges/nudge-evaluator.test.ts src/app/api/internal/jobs/nudges-evaluate/route.test.ts src/data/migrations/migrations.test.ts src/features/home/home-view-model.test.ts`: OK, 23 tests.
- `npm.cmd run lint`: OK con warning preexistente en `.cursor/stitch-proxy.mjs` por `outputSchema` no usado.
- `npm.cmd test -- --run`: OK, 227 tests.
- `npm.cmd run build`: OK; las rutas `/api/internal/jobs/nudges-evaluate` y `/api/v1/nudges/[id]/dismiss` aparecen en el build.
- `supabase migration list --linked`: remoto estaba en `016`, local tenia `017` pendiente.
- `supabase db push --linked --dry-run`: OK, solo `017_dashboard_nudges.sql`.
- `supabase db push --linked`: OK, aplico `017_dashboard_nudges.sql`.
- Verificacion REST Supabase service role: `nudge_candidates`, `nudge_preferences` y `nudge_deliveries` responden 200.
- `vercel.cmd env ls production`: `CRON_SECRET` y `WORKER_SECRET` existen.
- Deploy Vercel production: OK; alias actualizado a `https://manzana.website`.
- Health remoto `GET https://manzana.website/api/health`: OK.
- Pantalla remota `GET https://manzana.website/?view=home`: OK 200.
- API remota sin sesion `GET https://manzana.website/api/v1/dashboard/home`: OK 401 `AUTH_REQUIRED`.
- Endpoint worker sin secreto `GET /api/internal/jobs/nudges-evaluate`: OK 403 `FORBIDDEN`.
- Endpoint worker con secreto `GET /api/internal/jobs/nudges-evaluate?max_users=5&horizon_days=3`: OK 200, `trigger = cron_get`, `channel = dashboard`, `users = 1`, `generated = 0`.
- `vercel.cmd inspect manzana-staging-luymanvif-marcobernas-projects.vercel.app`: OK, deployment `Ready`.
- QA real autenticado del usuario: creo un pago recurrente proximo, se ejecuto `nudges-evaluate`, Home mostro `Avisos utiles`, el CTA `Ver pago` llevo a `Pagos que vienen`, `Ocultar aviso` lo dejo fuera de Home tras recargar y una reevaluacion posterior no lo recreo (`skipped = 1`, candidato `dismissed`).

Capturas/artefactos:

- Migracion `017_dashboard_nudges.sql` aplicada en Supabase remoto `manzana-staging`.
- Cron configurado: `15 13 * * *`.
- Ruta cron: `/api/internal/jobs/nudges-evaluate`.
- Deployment production: `https://manzana-staging-luymanvif-marcobernas-projects.vercel.app`.
- Vercel deployment id: `dpl_EYQud5vHB1qs98hcu9wrRcmQw9ak`.
- Alias activo: `https://manzana.website`.
- Candidato QA: `74d3f988-a100-47c6-89ff-e91192b657aa`, `payment_due`, estado final `dismissed`, ocurrencia `44392161-8534-4ba9-abbe-c78b69e33384`.

Deuda tecnica nueva:

- Verificar la primera ejecucion automatica diaria del cron de nudges.
- Agregar preferencias UI para activar/pausar tipos de avisos antes de cualquier canal proactivo.
- Implementar nudges de deuda solo cuando exista calendario/cuotas de deuda seguro.
- Agregar registro persistente de ejecuciones internas si se necesita auditoria operativa.

Siguiente paso:

Continuar con detalle/historial de recurrentes para que una regla muestre proxima ocurrencia, pagos cerrados, origen, estado y acciones sin mezclarlo con movimientos ni saldos.

---

Fecha: 30 de junio, 2026

Corte:

Corte 13: detalle e historial V1 de Pagos que vienen. El objetivo fue que cada regla recurrente tenga una vista de profundidad con proxima ocurrencia, pagos cerrados, origen y acciones sin mezclar lectura esperada con escrituras financieras.

Que se implemento:

- API autenticada `GET /api/v1/recurring/[id]` para leer una regla recurrente con ocurrencias del usuario actual.
- UI de detalle desde cada tarjeta de `Pagos que vienen`, con boton `Detalle`.
- Modal `RecurringDetailModal` con resumen, monto estimado, frecuencia, categoria, cuenta sugerida, ultimo pago, proteccion Core y timeline de ocurrencias.
- Timeline ordenado con ocurrencias abiertas primero y pagos cerrados despues, mostrando estado, fecha, monto y si existe movimiento vinculado.
- Acciones desde detalle reutilizan rutas existentes: marcar pagado, editar, pausar, reactivar y cancelar.
- Proteccion adicional: reglas recurrentes con `linked_debt_id` no pueden marcarse pagadas desde Pagos que vienen; deben resolverse desde Deudas para evitar doble efecto sobre saldo de deuda.
- Se corrigio la key visual de tarjetas para soportar mas de una ocurrencia pagada de la misma regla sin duplicar keys React.
- No se agrego migracion: el corte reutiliza `recurring_rules`, `recurring_occurrences`, `movements.recurring_rule_id` y `movements.recurring_occurrence_id` de la migracion `015_recurring_payments.sql`.
- No se agregaron escrituras financieras nuevas: el pago real sigue pasando por `mark-paid` -> `commit_recurring_payment` -> `CommandDispatcher/Core`.

Archivos principales:

- `src/app/api/v1/recurring/[id]/route.ts`
- `src/app/api/v1/recurring/[id]/route.test.ts`
- `src/features/upcoming/upcoming-api.ts`
- `src/features/upcoming/upcoming-types.ts`
- `src/features/upcoming/upcoming-view-model.ts`
- `src/features/upcoming/upcoming-view-model.test.ts`
- `src/features/upcoming/upcoming-screen.tsx`

Que quedo mockeado:

- No hay pagina URL dedicada para `UPCOMING_DETAIL`; por ahora es modal/drawer dentro de la pantalla `Pagos que vienen`.
- No hay drill-down desde una ocurrencia pagada al detalle del movimiento vinculado.
- No hay historial extendido con eventos/audit trail internos; se muestra el historial operativo de ocurrencias disponible.
- QA visual autenticado basico del detalle fue validado por el usuario; falta QA ampliado con varias ocurrencias pagadas y drill-down futuro a movimiento.

Pruebas ejecutadas:

- `npm.cmd run test -- src/features/upcoming/upcoming-view-model.test.ts src/app/api/v1/recurring/[id]/route.test.ts`: OK, 10 tests.
- `npm.cmd run typecheck`: OK.
- `npm.cmd run lint`: OK con warning preexistente en `.cursor/stitch-proxy.mjs` por `outputSchema` no usado.
- `npm.cmd run test`: OK, 232 tests.
- `npm.cmd run build`: OK; la ruta `/api/v1/recurring/[id]` aparece en el build.
- Deploy Vercel production: OK; alias actualizado a `https://manzana.website`.
- Health remoto `GET https://manzana.website/api/health`: OK 200.
- Pantalla remota `GET https://manzana.website/?view=upcoming`: OK 200.
- API remota sin sesion `GET https://manzana.website/api/v1/recurring/11111111-1111-4111-8111-111111111111`: OK 401 `AUTH_REQUIRED`.
- QA real autenticado del usuario: abrio el detalle/historial recurrente desplegado y confirmo que funciona correctamente.

Capturas/artefactos:

- Migracion nueva: no requerida.
- Deployment production: `https://manzana-staging-ee79dwixj-marcobernas-projects.vercel.app`.
- Vercel deployment id: `dpl_Cm9HMjU5NWs3SvEZ2ktadMM7avqL`.
- Alias activo: `https://manzana.website`.

Deuda tecnica nueva:

- Ampliar QA visual autenticado con varios pagos recurrentes pagados: abrir `Pagos que vienen`, entrar a `Detalle`, validar historial largo, marcar pagado desde el detalle, recargar y confirmar que el pago cerrado queda en historial y la proxima ocurrencia queda activa.
- Evaluar si `UPCOMING_DETAIL` debe pasar de modal a ruta dedicada cuando haya navegacion profunda o enlaces desde Home/nudges.
- Agregar drill-down desde ocurrencia pagada al movimiento vinculado cuando exista detalle de movimiento completo en la navegacion final.
- Definir union segura con cuotas/deudas antes de permitir pagos recurrentes ligados a deuda desde esta pantalla.

Siguiente paso:

Continuar con detalle avanzado de Deudas: historial, pagos/cobros vinculados, estado y acciones sin salir del Core financiero.

---

Fecha: 30 de junio, 2026

Corte:

Corte 14: detalle e historial V1 de Deudas. El objetivo fue que una deuda tenga una vista de profundidad con saldo pendiente, progreso, pagos/cobros vinculados y acciones sin sacar las escrituras financieras del Core.

Que se implemento:

- API autenticada `GET /api/v1/debts/[id]` para leer una deuda del usuario actual con pagos/cobros vinculados.
- Repositorio read-only `getDebtDetailById` y `listDebtPaymentsForDebt`, leyendo `debt_payments` y su movimiento vinculado desde `movements`.
- UI de detalle desde cada tarjeta de `Deudas`, con boton `Detalle`.
- Modal `DebtDetailModal` con resumen, estado, direccion, tipo, persona, fecha de inicio, vencimiento, ultimo pago, progreso y timeline de historial.
- Historial muestra pagos/cobros confirmados, monto, fecha, origen y si el movimiento Core tuvo cuenta vinculada o no.
- Accion desde detalle para registrar pago/devolucion reutiliza el modal existente y la ruta `POST /api/v1/debts/[id]/payments`.
- Al registrar pago desde el detalle, la lista y el detalle abierto se refrescan.
- No se agrego migracion: el corte reutiliza `debts`, `debt_payments`, `movements.debt_id` y `debt_payments.movement_id` de migraciones `013` y `014`.
- No se agregaron escrituras financieras nuevas: el pago/cobro real sigue pasando por `commit_debt_payment` y `CommandDispatcher/Core`.

Archivos principales:

- `src/data/repositories/debts.repository.ts`
- `src/app/api/v1/debts/[id]/route.ts`
- `src/app/api/v1/debts/[id]/route.test.ts`
- `src/features/debts/debts-api.ts`
- `src/features/debts/debts-types.ts`
- `src/features/debts/debts-view-model.ts`
- `src/features/debts/debts-view-model.test.ts`
- `src/features/debts/debts-screen.tsx`

Que quedo mockeado:

- No hay pagina URL dedicada para `DEBT_DETAIL`; por ahora es modal/drawer dentro de `Deudas`.
- No hay edicion/cancelacion/cierre manual de deuda desde el detalle.
- No hay drill-down desde un pago del historial al detalle completo del movimiento vinculado.
- No hay audit trail interno visible; se muestra historial operativo de `debt_payments` y movimiento Core vinculado.
- No hay cuotas operativas conectadas al timeline; solo se muestran los metadatos de cuotas guardados en la deuda.
- QA visual autenticado basico del detalle fue validado por el usuario; falta QA ampliado con varios pagos/cobros y deuda saldada.

Pruebas ejecutadas:

- `npm.cmd run test -- src/features/debts/debts-view-model.test.ts src/app/api/v1/debts/[id]/route.test.ts`: OK, 7 tests.
- `npm.cmd run typecheck`: OK.
- `npm.cmd run lint`: OK con warning preexistente en `.cursor/stitch-proxy.mjs` por `outputSchema` no usado.
- `npm.cmd run test`: OK, 236 tests.
- `npm.cmd run build`: OK; la ruta `/api/v1/debts/[id]` aparece en el build.
- Deploy Vercel production: OK; alias actualizado a `https://manzana.website`.
- Health remoto `GET https://manzana.website/api/health`: OK 200.
- Pantalla remota `GET https://manzana.website/?view=debts`: OK 200.
- API remota sin sesion `GET https://manzana.website/api/v1/debts/11111111-1111-4111-8111-111111111111`: OK 401 `AUTH_REQUIRED`.
- QA real autenticado del usuario: abrio el detalle/historial de Deudas desplegado y confirmo que funciona correctamente.

Capturas/artefactos:

- Migracion nueva: no requerida.
- Deployment production: `https://manzana-staging-3a0s2gzog-marcobernas-projects.vercel.app`.
- Vercel deployment id: `dpl_EQ1S8zXCHczJ3MCQ3nC2v1PpjLCb`.
- Alias activo: `https://manzana.website`.

Deuda tecnica nueva:

- Ampliar QA visual autenticado con varios pagos/cobros y deuda saldada: abrir `Deudas`, entrar a `Detalle`, registrar pago/devolucion desde el detalle, recargar y confirmar que el historial se actualiza.
- Agregar drill-down desde pago de historial al detalle del movimiento cuando `MOVEMENT_DETAIL` este completo.
- Implementar edicion/cancelacion/cierre manual de deuda con reglas de seguridad y auditoria.
- Conectar cuotas reales a detalle, Home, Pagos que vienen y nudges de deuda sin duplicar movimientos.

Siguiente paso:

Continuar con preferencias UI de avisos o con cuotas/vencimientos de deuda segun prioridad de producto.

---

Fecha: 30 de junio, 2026

Corte:

Corte 15: cuotas/vencimientos V1 de Deudas. El objetivo fue convertir los metadatos de cuotas en calendario operativo visible y en compromisos futuros para Home/Mi Dinero, sin crear movimientos ni tocar saldos fuera del Core financiero.

Que se implemento:

- Al crear una deuda con `installment_count`, se genera un calendario mensual V1 en `debt_installments`.
- El calendario parte de `next_payment_date` o `due_date`; si no existe primera fecha, no se inventa una agenda.
- La validacion de API exige primera fecha cuando se indica cantidad de cuotas.
- Si no hay monto explicito por cuota, el principal se divide entre cuotas y la ultima ajusta centimos para cerrar el total.
- Las fechas mensuales respetan fin de mes en casos como `2026-01-31` -> `2026-02-28` -> `2026-03-31`.
- El detalle de deuda muestra seccion `Cuotas` con numero, vencimiento, monto esperado, pendiente, estado y movimiento vinculado si existe.
- Los estados `Por vencer` y `Vencida` se derivan visualmente desde cuotas pendientes, sin escribir cambios de estado en DB durante lectura.
- `GET /api/v1/dashboard/home` combina compromisos recurrentes y cuotas de deuda abiertas para `next_commitments`.
- `GET /api/v1/money` combina compromisos recurrentes y cuotas de deuda abiertas para `upcoming_uncovered_commitments` y `operational_free_money`.
- Las cuotas de deuda son lectura operativa: no crean movimientos, no descuentan cuentas y no modifican saldos por si mismas.
- Los pagos/cobros de deuda siguen entrando solo por `POST /api/v1/debts/[id]/payments`, `commit_debt_payment` y `CommandDispatcher/Core`.
- No se agrego migracion nueva: el corte reutiliza `debt_installments` de la migracion `013` y el flujo de pagos de la migracion `014`.

Archivos principales:

- `src/data/repositories/debts.repository.ts`
- `src/data/repositories/debts.repository.test.ts`
- `src/data/repositories/recurring.repository.ts`
- `src/app/api/v1/debts/schemas.ts`
- `src/app/api/v1/money/route.ts`
- `src/app/api/v1/dashboard/home/route.ts`
- `src/features/debts/debts-types.ts`
- `src/features/debts/debts-view-model.ts`
- `src/features/debts/debts-view-model.test.ts`
- `src/features/debts/debts-screen.tsx`

Que quedo mockeado o pendiente:

- No hay conciliacion automatica cuota-pago dentro de `commit_debt_payment`; un pago reduce la deuda y crea historial, pero todavia no marca una cuota especifica como pagada.
- No hay worker durable que escriba `due_soon`/`overdue` en `debt_installments`; la UI deriva esos estados en lectura.
- No hay vista dedicada de `Pagos que vienen` para cuotas de deuda; Home y Mi Dinero ya las consideran como compromisos.
- No hay nudges `debt_due` todavia.
- No hay edicion, reprogramacion ni salto de cuotas.
- Deudas existentes sin calendario no se backfillean automaticamente; requieren una accion futura explicita de generacion/reparacion.

Pruebas ejecutadas:

- `npm.cmd run test -- src/data/repositories/debts.repository.test.ts src/features/debts/debts-view-model.test.ts src/app/api/v1/debts/[id]/route.test.ts`: OK, 9 tests.
- `npm.cmd run lint`: OK con warning preexistente en `.cursor/stitch-proxy.mjs` por `outputSchema` no usado.
- `npm.cmd run typecheck`: OK.
- `npm.cmd run test`: OK, 238 tests.
- `npm.cmd run build`: OK.
- Deploy Vercel production: OK.
- Health remoto `GET https://manzana.website/api/health`: OK 200.
- Pantallas remotas `?view=home`, `?view=money`, `?view=debts`: OK 200.
- APIs remotas protegidas sin sesion `GET /api/v1/money` y `GET /api/v1/dashboard/home`: OK 401 `AUTH_REQUIRED`.

Capturas/artefactos:

- Migracion nueva: no requerida.
- Deployment production: `https://manzana-staging-a2ht7hx5t-marcobernas-projects.vercel.app`.
- Vercel deployment id: `dpl_DNQ5kJ6cJhfVNFYWUBWXCmrRirBh`.
- Alias activo: `https://manzana.website`.

Deuda tecnica nueva:

- Decidir si la conciliacion cuota-pago debe vivir dentro de `commit_debt_payment` como parte atomica del Core o como comando financiero separado.
- Agregar QA visual autenticado: crear deuda con cuotas, abrir detalle, verificar calendario, Home y Mi Dinero.
- Definir si cuotas de deuda deben aparecer como una seccion propia en `Pagos que vienen` o mantenerse solo como compromisos de Home/Mi Dinero hasta nudges.
- Preparar nudges de deuda vencida/proxima sin enviar WhatsApp proactivo todavia.

Siguiente paso:

QA real autenticado de cuotas/vencimientos: crear una deuda con cantidad de cuotas y primera fecha, confirmar que el detalle muestra el calendario, y validar que Home/Mi Dinero descuentan esas cuotas como compromisos read-only. Luego decidir entre conciliacion cuota-pago en Core o nudges de deuda.

---

Fecha: 30 de junio, 2026

Corte:

Corte 16: Pagos que vienen unificado V1, desplegado y pendiente de QA visual autenticado. El objetivo fue que las cuotas de deuda que Home y Mi Dinero ya consideran como compromisos tambien aparezcan en la pantalla de destino, sin habilitar un segundo camino de pago fuera de Debt Engine/Core.

Que se implemento:

- Nuevo agregador autenticado read-only `GET /api/v1/dashboard/upcoming`.
- El agregador consulta en paralelo `listRecurringDashboard` y `listDebtInstallmentCommitments`, manteniendo Recurrentes y Debt Engine como dominios propietarios.
- La pantalla `Pagos que vienen` consume la proyeccion unificada y muestra una seccion propia `Cuotas de deuda`.
- Cada cuota muestra estado derivado, titulo, vencimiento, monto pendiente, moneda y accion `Ver deuda`.
- Las cuotas no exponen `Marcar pagado`, editar, pausar ni cancelar desde esta pantalla.
- `Ver deuda` navega a la pantalla `Deudas`; el pago/cobro real sigue entrando exclusivamente por `POST /api/v1/debts/[id]/payments`, `commit_debt_payment` y `CommandDispatcher/Core`.
- Si una regla recurrente esta vinculada a una deuda con cuota visible, se oculta de la lista recurrente para no duplicar el mismo compromiso.
- Los contadores de proximos/vencidos y el estimado de la pantalla incorporan las cuotas de deuda visibles.
- El contrato de API fue documentado en `18_api_spec.md`.
- No se agrego migracion: el corte reutiliza `debt_installments`, RLS e indices de la migracion `013_debts.sql`.
- No se agregaron escrituras financieras nuevas.

Archivos principales:

- `src/app/api/v1/dashboard/upcoming/route.ts`
- `src/app/api/v1/dashboard/upcoming/route.test.ts`
- `src/data/repositories/debts.repository.ts`
- `src/features/upcoming/upcoming-api.ts`
- `src/features/upcoming/upcoming-types.ts`
- `src/features/upcoming/upcoming-view-model.ts`
- `src/features/upcoming/upcoming-view-model.test.ts`
- `src/features/upcoming/upcoming-screen.tsx`
- `src/features/upcoming/upcoming-screen.test.tsx`
- `docs/fase_4_tecnica/18_api_spec.md`

Que quedo mockeado o pendiente:

- Falta QA visual autenticado en produccion con datos reales del usuario.
- `Ver deuda` abre la lista de Deudas; todavia no existe deep-link directo al detalle de una deuda especifica.
- Una cuota no puede marcarse pagada desde `Pagos que vienen` porque aun no existe conciliacion atomica cuota-pago dentro de Core.
- Un pago de deuda reduce el saldo de la deuda, pero todavia no marca una cuota especifica como pagada.
- No hay worker durable que persista `due_soon`/`overdue`; esos estados siguen derivados en lectura.

Pruebas ejecutadas:

- `npm.cmd run test -- src/features/upcoming/upcoming-screen.test.tsx src/features/upcoming/upcoming-view-model.test.ts src/app/api/v1/dashboard/upcoming/route.test.ts`: OK, 12 tests.
- La prueba de componente confirma que la cuota aparece, que existe `Ver deuda` y que no existe `Marcar pagado` en esa tarjeta.
- `npm.cmd run typecheck`: OK.
- `npm.cmd run lint`: OK con warning preexistente en `.cursor/stitch-proxy.mjs` por `outputSchema` no usado.
- `npm.cmd run test`: OK, 243 tests.
- `npm.cmd run build`: OK; la ruta `/api/v1/dashboard/upcoming` aparece en el build.
- Deploy Vercel production: OK; alias actualizado a `https://manzana.website`.
- Health remoto `GET https://manzana.website/api/health`: OK 200.
- Pantalla remota `GET https://manzana.website/?view=upcoming`: OK 200.
- API remota sin sesion `GET https://manzana.website/api/v1/dashboard/upcoming`: OK 401 `AUTH_REQUIRED`.

Capturas/artefactos:

- Migracion nueva: no requerida.
- Deployment production: `https://manzana-staging-9iv8n7nht-marcobernas-projects.vercel.app`.
- Vercel deployment id: `dpl_9v3H1Kb6HyP3Y6z6Vy4AVkJ1b4a3`.
- Alias activo: `https://manzana.website`.
- Captura autenticada: pendiente de QA del usuario; el navegador local de automatizacion no comparte su sesion.

Deuda tecnica nueva:

- Implementar deep-link desde una cuota al detalle de su deuda.
- Definir e implementar conciliacion atomica cuota-pago dentro de Core antes de habilitar pago directo desde una cuota.
- Decidir como asignar pagos parciales o adelantados a una o varias cuotas.
- Preparar nudges `debt_due` solo despues de estabilizar esa conciliacion y las preferencias de avisos.

Siguiente paso:

QA real autenticado en `Pagos que vienen`: confirmar que aparece `Cuota 1: Juan` en `Cuotas de deuda`, que el monto/fecha coinciden, que no existe boton de pago directo y que `Ver deuda` abre `Deudas`. Si pasa, cerrar Corte 16 y tomar como siguiente corte la conciliacion cuota-pago atomica en Core.

---

Fecha: 30 de junio, 2026

Corte:

Corte 17: conciliacion atomica pago-cuota V1, implementada y desplegada. El objetivo fue que cada pago/cobro de deuda reduzca el saldo y actualice las cuotas correctas dentro de la misma transaccion Core, con trazabilidad para abonos parciales y pagos repartidos.

Decision de producto aprobada:

- Politica `oldest_open_due_date_first_v1`.
- El pago se aplica primero a la cuota abierta con vencimiento mas antiguo.
- Un abono parcial aumenta `paid_amount` y mantiene la cuota abierta.
- Al completar el monto esperado, la cuota pasa a `paid`.
- Si sobra monto dentro del saldo total, continua por las siguientes cuotas abiertas.
- Se permiten pagos adelantados siguiendo el mismo orden.
- El sobrepago del saldo total se bloquea en V1 antes de escribir.
- Pago sin cuenta reduce deuda/cuotas sin tocar saldos de cuenta.
- Pago con cuenta reduce deuda/cuotas y el saldo de esa cuenta dentro de Core.

Que se implemento:

- Migracion remota `018_debt_installment_allocations.sql`.
- Nueva tabla RLS `debt_payment_allocations` para representar varios abonos sobre una cuota y un pago repartido entre varias cuotas.
- `commit_debt_payment` ahora confirma atomicamente movimiento Core, cuenta/caja opcional, `debt_payment`, asignaciones, `debt_installments`, saldo/estado de deuda y outbox.
- La idempotencia devuelve las mismas asignaciones existentes sin volver a aplicar dinero.
- Cada asignacion guarda monto, orden, politica, cuota, pago y movimiento.
- `debt_installments.movement_id` conserva el ultimo movimiento aplicado; el historial completo vive en `debt_payment_allocations`.
- `debts.next_payment_date` avanza a la siguiente cuota abierta.
- Si una deuda queda en cero ante un calendario inconsistente, las cuotas abiertas restantes pasan a `skipped` con razon y referencias auditables.
- La respuesta de `POST /api/v1/debts/[id]/payments` incluye `installment_allocations` y `allocation_policy`.
- El detalle de deuda lee asignaciones por pago y por cuota.
- La UI muestra cuantos abonos tiene cada cuota y a que cuota/cuotas se aplico cada pago del historial.
- El modal de pago explica el orden automatico antes de guardar.
- Se agrego smoke remoto reproducible con usuario temporal y limpieza en `finally`.
- Se armonizo la regla de sobrepago y conciliacion en producto, arquitectura, datos, API, decisiones tecnicas, wireflows y HiFi.

Archivos principales:

- `supabase/migrations/018_debt_installment_allocations.sql`
- `src/shared/types/domain.ts`
- `src/data/supabase/types.ts`
- `src/data/repositories/debts.repository.ts`
- `src/app/api/v1/debts/[id]/payments/route.ts`
- `src/app/api/v1/debts/[id]/payments/route.test.ts`
- `src/features/debts/debts-types.ts`
- `src/features/debts/debts-view-model.ts`
- `src/features/debts/debts-view-model.test.ts`
- `src/features/debts/debts-screen.tsx`
- `scripts/smoke-debt-installment-allocation.mjs`
- `docs/fase_2_estrategia/alcance_v1/05h_deudas.md`
- `docs/fase_3_producto/14_flujos_usuario_v1.md`
- `docs/fase_3_producto/16_confianza_errores.md`
- `docs/fase_4_tecnica/06_arquitectura_sistema.md`
- `docs/fase_4_tecnica/16_modelo_datos.md`
- `docs/fase_4_tecnica/18_api_spec.md`
- `docs/fase_4_tecnica/20_decisiones_tecnicas.md`
- `docs/fase_6_visual/31_wireflows.md`
- `docs/fase_6_visual/32_especificacion_hifi.md`

Que quedo mockeado o pendiente:

- Pagos anteriores a migracion `018` no se backfillean automaticamente; mantienen su historial de deuda, pero no tienen asignaciones pago-cuota.
- Falta QA visual autenticado del usuario sobre un abono parcial y un pago que cubra dos cuotas.
- `Pagos que vienen` todavia deriva a la lista `Deudas`; no abre directamente la deuda/cuota elegida.
- `Pagos que vienen` aun no ofrece pago directo desde una tarjeta de cuota, aunque Core ya puede soportarlo con seguridad.
- No hay edicion, reprogramacion ni salto manual de cuotas.
- Los estados temporales `due_soon`/`overdue` siguen derivados en lectura.

Pruebas ejecutadas:

- `npm.cmd run test -- src/features/debts/debts-view-model.test.ts src/app/api/v1/debts/[id]/payments/route.test.ts src/data/repositories/debts.repository.test.ts`: OK, 8 tests.
- `npm.cmd run typecheck`: OK.
- `npm.cmd run lint`: OK con warning preexistente en `.cursor/stitch-proxy.mjs` por `outputSchema` no usado.
- `npm.cmd run test`: OK, 245 tests.
- `npm.cmd run build`: OK.
- `npx.cmd supabase db push --dry-run`: detecto solo migracion `018`.
- `npx.cmd supabase db push`: OK; migracion `018` aplicada al remoto.
- `npx.cmd supabase db lint --linked --level error`: OK, sin resultados.
- REST service-role `debt_payment_allocations?select=id&limit=1`: OK 200.
- RPC remoto con deuda inexistente: OK 400 `DEBT_NOT_FOUND`, sin escritura.
- Smoke remoto real `node scripts/smoke-debt-installment-allocation.mjs`: OK.
- Smoke real: primer pago S/30 -> cuota 1 recibe S/30.
- Smoke real: segundo pago S/40 -> cuota 1 recibe S/20 y cuota 2 recibe S/20.
- Smoke real: pago con cuenta reduce saldo temporal de S/100 a S/60.
- Smoke real: tercer pago S/30 -> cuota 2 termina, deuda queda `paid` con saldo 0.
- El usuario temporal y todos sus datos fueron eliminados al finalizar.
- Deploy Vercel production: OK; alias actualizado a `https://manzana.website`.
- Health remoto `GET https://manzana.website/api/health`: OK 200.
- Pantalla remota `GET https://manzana.website/?view=debts`: OK 200.
- API remota protegida sin sesion `POST /api/v1/debts/[id]/payments`: OK 401 `AUTH_REQUIRED`.

Capturas/artefactos:

- Migracion: `018_debt_installment_allocations.sql`.
- Deployment production: `https://manzana-staging-clrjvbtmj-marcobernas-projects.vercel.app`.
- Vercel deployment id: `dpl_34ApNjnoz3rpMNMLEwhtDRGpDVST`.
- Alias activo: `https://manzana.website`.
- QA visual autenticado: pendiente de confirmacion del usuario.

Deuda tecnica nueva:

- Definir si pagos legacy deben poder asignarse manualmente a cuotas o permanecer solo como historial previo.
- Agregar deep-link `Pagos que vienen` -> deuda/cuota especifica.
- Reutilizar el flujo Core para habilitar pago seguro desde una tarjeta de cuota.
- Agregar worker durable para persistir vencimientos cuando se active `debt_due`.

Siguiente paso:

QA real autenticado de conciliacion: en una deuda con al menos dos cuotas, registrar primero un abono menor a la cuota y verificar que aumenta `pagado` sin cerrar la cuota; despues registrar un monto que termine esa cuota y alcance la siguiente. Confirmar tambien el caso con cuenta y sin cuenta. Si pasa, el siguiente corte recomendado es deep-link y pago de cuota desde `Pagos que vienen`, reutilizando exclusivamente `POST /api/v1/debts/[id]/payments`.

---

Fecha: 30 de junio, 2026

Corte:

Corte 18: deep-link y pago/cobro seguro desde `Pagos que vienen`, implementado y desplegado. El objetivo fue convertir la cuota visible en una entrada util al flujo de Deudas sin duplicar logica financiera ni confiar en datos transportados por la URL.

Que se implemento:

- `Pagos que vienen` muestra `Registrar pago` para cuotas `i_owe` y `Registrar cobro` para cuotas `they_owe_me`.
- Solo la cuota abierta mas antigua de cada deuda expone la accion financiera; las posteriores mantienen `Ver deuda`.
- El orden accionable se deriva por `due_at` y se vuelve a validar con el detalle autenticado antes de abrir el modal.
- Deep-link trazable mediante `view=debts`, `debt`, `installment` y `action`.
- Los parametros aceptan solo UUIDs validos y acciones `detail`/`pay`.
- El monto nunca se toma de la URL: Deudas vuelve a leer la deuda/cuotas del usuario y calcula `expected_amount - paid_amount`.
- Una intencion manipulada hacia una cuota posterior no abre pago; muestra la deuda/calendario actualizado.
- El modal existente de Deudas se abre precargado con el pendiente real y sigue llamando exclusivamente a `POST /api/v1/debts/[id]/payments`.
- El flujo directo de pago abre un solo modal; `Ver deuda` abre el detalle.
- En mobile se ocultan bottom nav y FAB mientras hay modal, evitando superposiciones.
- No se agrego migracion ni endpoint nuevo; el corte reutiliza migracion `018`, API de Deudas y `commit_debt_payment`.
- No se agregaron escrituras financieras fuera del Core.

Archivos principales:

- `src/features/dashboard/dashboard-app.tsx`
- `src/features/dashboard/dashboard-app.test.ts`
- `src/features/app-shell/app-shell.tsx`
- `src/features/upcoming/upcoming-types.ts`
- `src/features/upcoming/upcoming-view-model.ts`
- `src/features/upcoming/upcoming-view-model.test.ts`
- `src/features/upcoming/upcoming-screen.tsx`
- `src/features/upcoming/upcoming-screen.test.tsx`
- `src/features/debts/debts-types.ts`
- `src/features/debts/debts-view-model.ts`
- `src/features/debts/debts-view-model.test.ts`
- `src/features/debts/debts-screen.tsx`
- `src/features/debts/debts-screen.test.tsx`
- `src/data/repositories/debts.repository.ts`
- `docs/fase_6_visual/30_app_flow.md`
- `docs/fase_6_visual/32_especificacion_hifi.md`

Que quedo mockeado o pendiente:

- El pago se inicia desde `Pagos que vienen`, pero al terminar el usuario queda en `Deudas`; todavia no hay retorno automatico a la posicion anterior.
- Una cuota posterior no ofrece pago directo por diseno; Core mantiene el orden aprobado.
- QA real del usuario completado: confirmo el flujo y autorizo continuar con `debt_due`.
- Los pagos legacy anteriores a migracion `018` siguen sin asignaciones historicas.

Pruebas ejecutadas:

- Pruebas focalizadas de dashboard intent, view models y pantallas: OK, 19 tests.
- Prueba de componente: deep-link lee deuda, valida cuota mas antigua y precarga S/50 desde pendiente real.
- Prueba de componente: durante modal no se duplica el boton mobile `Crear deuda`.
- `npm.cmd run typecheck`: OK.
- `npm.cmd run lint`: OK con warning preexistente en `.cursor/stitch-proxy.mjs` por `outputSchema` no usado.
- `npm.cmd run test`: OK, 250 tests.
- `npm.cmd run build`: OK.
- Deploy Vercel production: OK; alias actualizado a `https://manzana.website`.
- Health remoto `GET https://manzana.website/api/health`: OK 200.
- API remota sin sesion `GET /api/v1/dashboard/upcoming`: OK 401 `AUTH_REQUIRED`.
- Smoke financiero remoto de migracion `018`: OK; asignaciones, cuenta y cierre de deuda siguen correctos.
- QA visual automatizado desktop: `Cuota 1` muestra `Registrar pago`; `Cuota 2` solo `Ver deuda`.
- QA visual automatizado desktop: la accion navega a Deudas y abre un unico modal `Cuota 1` con monto S/50.
- QA visual automatizado mobile detecto FAB sobre modal; se corrigio ocultando navegacion/FAB y se agrego cobertura de componente.
- El usuario temporal de QA y todos sus datos fueron eliminados.

Capturas/artefactos:

- Migracion nueva: no requerida.
- Deployment production final: `https://manzana-staging-bgxmi6agc-marcobernas-projects.vercel.app`.
- Vercel deployment id: `dpl_F7aX8PPHhqU8BHGtRCb8xwnGPfcS`.
- Alias activo: `https://manzana.website`.
- QA real del usuario: aprobado antes de iniciar Corte 19.

Deuda tecnica nueva:

- Evaluar retorno contextual a `Pagos que vienen` despues de guardar un pago iniciado alli.
- Generalizar `hideMobileNavigation` a otros modales si el mismo solapamiento aparece en otras pantallas.
- Agregar test E2E persistente del deep-link cuando exista runner autenticado de navegador en CI.

Siguiente paso:

QA real del usuario completado. El resultado habilito Corte 19: `nudges debt_due` con preferencias y sin WhatsApp proactivo automatico.

---

Fecha: 1 de julio, 2026

Corte:

Corte 19: avisos `debt_due` y preferencias Dashboard reversibles, implementado y desplegado. El objetivo fue avisar sobre la cuota/cobro que requiere atencion primero, sin duplicar compromisos, sin habilitar mensajes externos y sin escribir dinero.

Decision de producto documentada:

- Una tarjeta pasiva dentro del Dashboard autenticado puede estar habilitada por defecto.
- Ausencia de una fila de preferencia significa `enabled = true` de forma efectiva para Dashboard.
- Una preferencia explicita `false` retira el aviso.
- Este default interno no constituye opt-in de WhatsApp/email.
- WhatsApp proactivo permanece deshabilitado y cualquier activacion futura requerira consentimiento, horario silencioso, frecuencia y modo discreto.

Que se implemento:

- Migracion `019_dashboard_nudge_preferences.sql`.
- `nudge_preferences` agrega `paused_until` y `metadata` para trazabilidad y pausa futura.
- RPC service-role-only `set_dashboard_nudge_preference`.
- Desactivar una preferencia expira atomicamente sus candidatos abiertos sin tocar movimientos, cuentas, cajas, deudas ni cuotas.
- API autenticada `GET/POST /api/v1/preferences/nudges`.
- Contrato V1 visible: `payment_due` y `debt_due`, canal exclusivamente `dashboard`.
- Configuracion muestra toggles `Pagos que vienen` y `Cuotas de deuda`.
- Activar una preferencia reevalua fuentes vigentes; desactivarla retira el aviso de Home inmediatamente.
- Evaluador deterministico `dashboard-debt-due-v1`.
- Solo genera un aviso por deuda: la cuota abierta mas antigua dentro del horizonte.
- Cuotas futuras posteriores no compiten ni producen avisos duplicados.
- El aviso distingue pago de cuota (`i_owe`) y cobro esperado (`they_owe_me`).
- El copy de Home es generico y el candidato queda con riesgo `sensitive`; no expone nombre, persona ni monto en la tarjeta proactiva.
- Usuarios con cuotas, aunque no tengan recurrentes, entran al job `nudges-evaluate`.
- Al pasar un recurrente de proximo a vencido, la identidad del draft incluye tipo + fuente + id; el candidato anterior expira y no quedan dos avisos activos.
- Home transporta solo `debt_id` e `installment_id`; `Ver cuota/cobro` reutiliza el deep-link autenticado de Deudas y vuelve a leer el detalle real.
- No se agregaron envios WhatsApp, `nudge_deliveries` externos ni templates.
- No se agregaron escrituras financieras fuera de Core.

Archivos principales:

- `supabase/migrations/019_dashboard_nudge_preferences.sql`
- `src/data/migrations/019_dashboard_nudge_preferences.sql`
- `src/data/migrations/migrations.test.ts`
- `src/core/nudges/nudge-evaluator.ts`
- `src/core/nudges/nudge-evaluator.test.ts`
- `src/data/repositories/nudges.repository.ts`
- `src/data/repositories/nudges.repository.test.ts`
- `src/data/repositories/debts.repository.ts`
- `src/app/api/internal/jobs/nudges-evaluate/route.ts`
- `src/app/api/internal/jobs/nudges-evaluate/route.test.ts`
- `src/app/api/v1/preferences/nudges/route.ts`
- `src/app/api/v1/preferences/nudges/route.test.ts`
- `src/app/api/v1/preferences/nudges/schemas.ts`
- `src/app/api/v1/dashboard/home/route.ts`
- `src/features/settings/settings-api.ts`
- `src/features/settings/settings-screen.tsx`
- `src/features/settings/settings-screen.test.tsx`
- `src/features/home/home-types.ts`
- `src/features/home/home-screen.tsx`
- `src/features/home/home-screen.test.tsx`
- `src/features/dashboard/dashboard-app.tsx`
- `src/shared/ui/switch.tsx`
- `src/shared/types/domain.ts`
- `src/data/supabase/types.ts`
- `scripts/smoke-debt-due-nudge.mjs`
- `docs/fase_2_estrategia/alcance_v1/05j_nudges.md`
- `docs/fase_4_tecnica/16_modelo_datos.md`
- `docs/fase_4_tecnica/18_api_spec.md`
- `docs/fase_6_visual/30_app_flow.md`
- `docs/fase_6_visual/32_especificacion_hifi.md`

Que quedo mockeado o pendiente:

- No hay WhatsApp/email proactivo para nudges.
- No hay UI de pausa temporal, horario silencioso, frecuencia o modo discreto; `paused_until` queda preparado, no activado.
- El cron sigue siendo diario a las 08:15 `America/Lima`; todavia no reacciona a eventos `debt_created`/`debt_payment_recorded`.
- `debt_installments.status` aun no persiste automaticamente `due_soon`/`overdue`; UI y Nudge Policy derivan vencimiento por fecha.
- No hay tabla de ejecuciones del cron ni panel operativo.
- El aviso abre el detalle de la deuda/cuotas; el registro financiero sigue siendo una accion explicita dentro del flujo Core.

Pruebas ejecutadas:

- Pruebas focalizadas iniciales: 33 tests OK.
- `npm.cmd run typecheck`: OK.
- `npm.cmd run lint`: OK con warning preexistente en `.cursor/stitch-proxy.mjs` por `outputSchema` no usado.
- `npm.cmd run test`: OK, 53 archivos y 262 tests.
- `npm.cmd run build`: OK; `/api/v1/preferences/nudges` aparece como ruta dinamica.
- `supabase migration list --linked`: remoto en `018`, local `019` pendiente antes del push.
- `supabase db push --linked --dry-run`: OK; solo migracion `019`.
- `supabase db push --linked`: OK; migracion `019` aplicada.
- Smoke remoto `npm.cmd run smoke:nudges:debt-due`: OK.
- Smoke: crea deuda con dos cuotas y genera un solo `debt_due` para la cuota mas antigua.
- Smoke: preferencia efectiva inicial `enabled = true`, `configured = false`.
- Smoke: desactivar retira el aviso; reactivar lo restaura.
- Smoke: balance de deuda, estado, proxima fecha y cuotas quedan identicos antes/despues.
- Evaluacion post-deploy para usuarios existentes: 1 usuario, 1 `debt_due` generado e insertado.
- Health remoto `GET /api/health`: OK 200, Supabase OK.
- API protegida `GET /api/v1/preferences/nudges` sin sesion: OK 401 `AUTH_REQUIRED`.
- QA visual autenticado desktop: seccion Recordatorios, toggles, feedback y navegacion a cuota especifica correctos.
- QA visual autenticado mobile: tarjeta `Avisos utiles`, copy, CTA y controles sin desborde.
- Consola del navegador: sin errores ni warnings.
- Usuarios temporales del smoke y QA visual eliminados al finalizar.

Capturas/artefactos:

- Migracion remota: `019_dashboard_nudge_preferences.sql`.
- Script reproducible: `npm.cmd run smoke:nudges:debt-due`.
- Deployment production: `https://manzana-staging-6f8siyttk-marcobernas-projects.vercel.app`.
- Vercel deployment id: `dpl_6XvdRbDweAh3uQf47PKPMKTy62hg`.
- Alias activo: `https://manzana.website`.

Deuda tecnica nueva:

- Persistir transiciones `pending -> due_soon -> overdue` de cuotas con un worker idempotente y eventos trazables.
- Reevaluar/expirar `debt_due` por eventos de deuda/pago, ademas del cron diario.
- Agregar pausa temporal, horario silencioso y modo discreto antes de cualquier canal proactivo externo.
- Agregar observabilidad de ejecuciones si el volumen requiere auditoria operacional.

Siguiente paso:

QA real del usuario: abrir Home y confirmar `Avisos utiles`; entrar a Configuracion, apagar `Cuotas de deuda`, volver a Home y verificar que desaparece; reactivarlo y confirmar que vuelve. `Ver cuota` debe abrir el detalle correcto. Si pasa, el siguiente corte recomendado es worker durable de vencimientos de cuotas (`due_soon`/`overdue`) + reevaluacion idempotente de `debt_due` por eventos, sin tocar saldos.

---

Fecha: 1 de julio, 2026

Corte:

Corte 20: ciclo durable de vencimientos de cuotas y reevaluacion idempotente de
`debt_due`, implementado, migrado, probado y desplegado. El objetivo fue dejar
de depender solo de una derivacion visual por fecha, manteniendo intacta la
frontera financiera del Core.

Decision tecnica aplicada:

- El umbral V1 sigue siendo tres dias, ya usado por UI y Nudge Policy.
- La fecha se evalua en el timezone del perfil; si falta, usa
  `America/Lima`.
- El Debt Engine persiste `pending`, `due_soon` y `overdue`.
- Estados terminales de cuota (`paid`, `rescheduled`, `skipped`) y deuda
  (`paid`, `cancelled`, `archived`, `draft`) nunca se reabren.
- El refresco se implementa como RPC transaccional exclusivo de
  `service_role`, no como escritura directa desde UI, agente o repositorio.
- Una falla de proyeccion posterior no revierte una deuda/pago ya confirmado;
  el evento y el cron diario permiten recuperacion.

Que se implemento:

- Migraciones `020_debt_installment_lifecycle.sql` y
  `021_debt_lifecycle_lock_order.sql`.
- RPC `refresh_debt_installment_lifecycle` en schema interno `manzana` con
  wrapper publico exclusivo de `service_role`.
- Bloqueo `FOR UPDATE` de cuotas y deudas evaluadas.
- Orden de lock alineado con pagos (`deuda -> cuotas`) para evitar inversion
  cuando coinciden cron y `commit_debt_payment`.
- Transiciones de cuota:
  - fecha anterior a hoy -> `overdue`;
  - hoy hasta tres dias -> `due_soon`;
  - posterior al horizonte -> `pending`.
- Estado padre:
  - alguna cuota vencida -> `overdue`;
  - si no, alguna proxima -> `due_soon`;
  - en otro caso -> `active`.
- Eventos atomicos solo cuando cambia el estado:
  `debt_installment_pending`, `debt_installment_due_soon`,
  `debt_installment_overdue`, `debt_active`, `debt_due_soon` y
  `debt_overdue`.
- Servicio deterministico `refreshDebtLifecycle`, que ejecuta primero el RPC
  Core y despues sincroniza candidatos `debt_due`.
- Job protegido `GET/POST /api/internal/jobs/debt-lifecycle`.
- Cron diario `10 13 * * *` (08:10 `America/Lima`), antes de
  `nudges-evaluate`.
- Consumidor outbox `debt_engine.lifecycle_v1` para
  `debt_payment_registered`.
- Refresco inmediato best-effort despues de crear una deuda o confirmar un
  pago/cobro.
- Si el refresco inmediato falla, la API conserva el resultado financiero
  confirmado, registra el error estructurado y deja recuperacion a outbox/cron.
- La UI no recibio controles nuevos: Deudas y Pagos que vienen consumen los
  mismos estados, ahora persistidos; la derivacion por fecha permanece como
  defensa de lectura.
- No se escriben movimientos, pagos, importes, cuentas, cajas ni saldos fuera
  del Core.

Archivos principales:

- `supabase/migrations/020_debt_installment_lifecycle.sql`
- `supabase/migrations/021_debt_lifecycle_lock_order.sql`
- `src/data/migrations/020_debt_installment_lifecycle.sql`
- `src/data/migrations/021_debt_lifecycle_lock_order.sql`
- `src/core/debts/debt-lifecycle.ts`
- `src/core/debts/debt-lifecycle-service.ts`
- `src/data/repositories/debts.repository.ts`
- `src/data/supabase/types.ts`
- `src/app/api/internal/jobs/debt-lifecycle/route.ts`
- `src/workers/outbox/handlers/debt-lifecycle-handler.ts`
- `src/workers/outbox/default-handlers.ts`
- `src/app/api/v1/debts/route.ts`
- `src/app/api/v1/debts/[id]/payments/route.ts`
- `scripts/smoke-debt-lifecycle.mjs`
- `vercel.json`
- `docs/fase_4_tecnica/06_arquitectura_sistema.md`
- `docs/fase_4_tecnica/16_modelo_datos.md`
- `docs/fase_4_tecnica/17_eventos_workers.md`
- `docs/fase_4_tecnica/18_api_spec.md`

Que quedo mockeado o pendiente:

- El consumidor de evento existe y es idempotente, pero el publisher global de
  outbox aun no tiene scheduler frecuente independiente; pago y creacion tienen
  refresco inmediato y el cron diario cubre recuperacion.
- No existe tabla de ejecuciones de jobs, metrica de lag ni replay operativo
  desde UI.
- No se agrego notificacion WhatsApp/email.
- No hubo cambio visual que requiriera nuevas pantallas o capturas; la
  verificacion fue de API, base de datos y comportamiento existente.

Pruebas ejecutadas:

- Pruebas focalizadas de regla pura, servicio, migracion, job, handler y APIs:
  41 tests OK.
- `npm run test`: OK, 58 archivos y 286 tests.
- `npm run typecheck`: OK.
- `npm run lint`: OK sin errores; permanece un warning preexistente en
  `.cursor/stitch-proxy.mjs` por `outputSchema` no usado.
- `npm run build`: OK; la ruta dinamica
  `/api/internal/jobs/debt-lifecycle` aparece en el build.
- `supabase db push --dry-run`: OK; migraciones `020` y endurecimiento `021`
  validadas antes de cada push.
- `supabase db push`: OK; migraciones `020` y `021` aplicadas.
- Smoke previo al deploy:
  `overdue`, `due_soon`, `pending`; cuatro eventos en primera corrida y cero
  en segunda; `authenticated` sin permiso; saldos/importes intactos.
- Smoke production post-deploy:
  refresco inmediato aplicado al crear, worker idempotente, dos candidatos
  `debt_due`, cuatro eventos unicos y saldos/importes intactos.
- Health remoto `GET /api/health`: 200, Supabase OK.
- Worker remoto sin secreto `GET /api/internal/jobs/debt-lifecycle`: 403
  `FORBIDDEN`.
- Todos los usuarios temporales de QA fueron eliminados.

Capturas/artefactos:

- Migraciones remotas: `020_debt_installment_lifecycle.sql` y
  `021_debt_lifecycle_lock_order.sql`.
- Script reproducible: `npm run smoke:debts:lifecycle`.
- Deployment production:
  `https://manzana-staging-ppqkg0uyb-marcobernas-projects.vercel.app`.
- Vercel deployment id: `dpl_Hwy5CEvPUMHmLgv6QfwcZCcg46WY`.
- Alias activo: `https://manzana.website`.

Deuda tecnica nueva:

- Programar el publisher global de outbox con una frecuencia y costo
  operativamente aprobados.
- Agregar ejecuciones auditables, lag, fallos por usuario y replay controlado.
- Unificar utilidades de fecha local usadas por Debt Engine y Nudge Policy.
- Evaluar retorno contextual a `Pagos que vienen` despues de pagar una cuota.

Siguiente paso:

Corte 21 recomendado: operacion durable de outbox y jobs. Antes de
implementarlo se debe aprobar la decision de infraestructura/frecuencia
(polling Vercel, proveedor de cola o scheduler externo), porque cambia costo y
operacion. El corte debe incluir ejecuciones auditables, lag, reintento/replay
controlado y alertas basicas, sin mover logica financiera fuera de Core.

### Actualizacion 2026-07-04: Corte 21A - base operativa de outbox/jobs

Fecha:

4 de julio, 2026.

Corte:

Corte 21A: operacion durable de outbox/jobs, sin activar todavia scheduler
frecuente por limitacion/costo de infraestructura.

Que se implemento:

- Migracion `022_worker_job_operations.sql`.
- Tabla `worker_job_runs` para ejecuciones auditables de workers, crons y
  replays.
- RPC `requeue_outbox_event` exclusivo de `service_role`.
- `GET/POST /api/internal/workers/outbox` protegido con `CRON_SECRET` o
  `WORKER_SECRET`.
- Cada corrida de outbox registra job run, duracion, conteos, resultado y
  `trace_id`.
- Snapshot operativo de outbox: pending, processing, failed, dead_letter,
  evento fallido por tipo y lag basico.
- `POST /api/internal/workers/outbox/replay`, protegido con `WORKER_SECRET`,
  para reencolar eventos `failed`, `dead_letter` o `processing`.
- El replay no permite reejecutar eventos `published`.
- No se tocaron movimientos, cuentas, cajas, saldos, pagos, deudas ni reglas
  financieras.
- No se agrego cron frecuente en `vercel.json` porque Vercel Hobby no es una
  base correcta para polling de outbox cada pocos segundos/minutos.

Archivos principales:

- `supabase/migrations/022_worker_job_operations.sql`
- `src/data/migrations/022_worker_job_operations.sql`
- `src/data/repositories/worker-operations.repository.ts`
- `src/app/api/internal/workers/outbox/route.ts`
- `src/app/api/internal/workers/outbox/replay/route.ts`
- `src/data/supabase/types.ts`
- `src/data/migrations/migrations.test.ts`
- `src/data/repositories/worker-operations.repository.test.ts`
- `src/app/api/internal/workers/outbox/route.test.ts`
- `src/app/api/internal/workers/outbox/replay/route.test.ts`
- `docs/fase_4_tecnica/16_modelo_datos.md`
- `docs/fase_4_tecnica/17_eventos_workers.md`
- `docs/fase_4_tecnica/18_api_spec.md`

Que quedo mockeado o pendiente:

- No se activo scheduler frecuente global de outbox. Para eso falta decision
  operativa: Vercel Pro, scheduler externo o cola.
- No hay UI interna de operaciones; replay existe como endpoint interno
  protegido.
- No se agregaron alertas externas tipo email/Slack.

Pruebas ejecutadas:

- `npm.cmd run test -- src/app/api/internal/workers/outbox/route.test.ts src/app/api/internal/workers/outbox/replay/route.test.ts src/data/repositories/worker-operations.repository.test.ts src/data/migrations/migrations.test.ts`: OK, 25 tests.
- `npm.cmd run typecheck`: OK.
- `npm.cmd run lint`: OK sin errores; permanece warning preexistente en
  `.cursor/stitch-proxy.mjs`.
- `npm.cmd run test`: OK, 61 archivos y 293 tests.
- `npm.cmd run build`: OK; rutas `/api/internal/workers/outbox` y
  `/api/internal/workers/outbox/replay` aparecen en el build.
- `supabase db push --dry-run`: OK; solo migracion `022`.
- `supabase db push`: OK; migracion `022` aplicada.
- `vercel deploy --prod`: OK; alias activo `https://manzana.website`.
- Smoke remoto `GET /api/health`: OK.
- Smoke remoto sin secreto `GET /api/internal/workers/outbox?limit=1`: 403
  `FORBIDDEN`.
- Smoke remoto con secreto `GET /api/internal/workers/outbox?limit=5`: OK,
  `claimed = 5`, `published = 5`, `failed = 0`, `trigger = cron_get`,
  `job_run_id = 3c3cb3ac-2e38-44b8-89b1-e8dc1169bb2d`.

Capturas/artefactos:

- Migracion remota: `022_worker_job_operations.sql`.
- Build local con rutas internas nuevas.
- Deployment production:
  `https://manzana-staging-p1wg5bdvx-marcobernas-projects.vercel.app`.
- Alias activo: `https://manzana.website`.

Deuda tecnica nueva:

- Definir y activar scheduler frecuente de outbox con costo/operacion aprobada.
- Agregar alertas basicas sobre `dead_letter`, lag alto y fallos repetidos.
- Crear una vista interna/admin solo si realmente se necesita operacion manual.

Siguiente paso:

El scheduler externo real ya fue creado y verificado. El siguiente corte de
producto recomendado es AgentRuntime/DataAgent real para mejorar calidad de
interpretacion en WhatsApp y Dashboard sin tocar Core.

### Actualizacion 2026-07-05: Corte 21B - contrato de scheduler externo V1

Fecha:

5 de julio, 2026.

Corte:

Corte 21B: decision y handoff operativo para scheduler externo frecuente de
outbox.

Que se implemento:

- Documento `25_scheduler_externo_v1.md`.
- Decision `F4-D035` en `20_decisiones_tecnicas.md`.
- Script `npm run smoke:outbox:scheduler`.
- Readiness local del scheduler sin ejecutar el worker por defecto.
- Smoke real controlado con `-- --run` para llamar el endpoint protegido.
- Sincronizacion de `17_eventos_workers.md`, `18_api_spec.md` e `indice.md`.
- Se mantiene Vercel Cron diario para jobs lentos.
- Se deja cola dedicada como evolucion futura, no como requisito V1.

Archivos principales:

- `docs/fase_4_tecnica/25_scheduler_externo_v1.md`
- `docs/fase_4_tecnica/20_decisiones_tecnicas.md`
- `docs/fase_4_tecnica/17_eventos_workers.md`
- `docs/fase_4_tecnica/18_api_spec.md`
- `docs/fase_4_tecnica/indice.md`
- `docs/fase_4_tecnica/23_plan_implementacion_v1.md`
- `docs/fase_4_tecnica/23b_seguimiento_construccion_v1.md`
- `scripts/smoke-outbox-scheduler.mjs`
- `package.json`

Que quedo mockeado o pendiente:

- El job real fue creado en cron-job.org y verificado. Queda pendiente observar
  sus primeras ejecuciones automaticas durante 24-48 horas.
- No hay alerta externa definitiva por `dead_letter` o lag alto.
- No hay UI admin para replay/operacion.

Pruebas ejecutadas:

- `npm.cmd run smoke:outbox:scheduler`: OK, readiness sin ejecutar worker,
  URL y header configurados.
- `npm.cmd run smoke:outbox:scheduler -- --run`: OK, endpoint remoto 200,
  `claimed = 1`, `published = 1`, `failed = 0`,
  `job_run_id = 09bce339-88c2-498a-8997-5821cf6a0e84`.
- Se detecto backlog operativo previo: 13 eventos internos pendientes, sin
  outbound WhatsApp antiguo.
- `npm.cmd run smoke:outbox:scheduler -- --run --limit=25`: OK, dreno backlog,
  `claimed = 13`, `published = 13`, `failed = 0`, `pending = 0`,
  `dead_letter = 0`, `job_run_id = 4a4c19a1-3893-4e90-9eb5-5ff6162afd43`.
- Ejecucion de prueba desde cron-job.org: OK, HTTP 200,
  `job_run_id = 5e1bbb11-1b3f-4575-93f2-1774c214df31`,
  `claimed = 0`, `published = 0`, `failed = 0`, `pending = 0`.
- Verificacion cruzada en `worker_job_runs`: el `job_run_id`
  `5e1bbb11-1b3f-4575-93f2-1774c214df31` quedo `succeeded`.
- `npm.cmd run smoke:outbox:scheduler -- --run`: OK post-cron-job.org,
  `job_run_id = 1b7970ff-d412-4ea4-b991-b34a0c675b31`,
  `pending = 0`, `failed = 0`, `dead_letter = 0`.
- `npm.cmd run typecheck`: OK.
- `npm.cmd run lint`: OK sin errores; permanece warning preexistente en
  `.cursor/stitch-proxy.mjs`.

Capturas/artefactos:

- Contrato operativo listo en `25_scheduler_externo_v1.md`.
- Cronjob externo creado: `Manzana Outbox Publisher`.

Deuda tecnica nueva:

- Observar primeras ejecuciones automaticas del cronjob durante 24-48 horas.
- Agregar alertas externas cuando haya proveedor de observabilidad elegido.

Siguiente paso:

Seguir con AgentRuntime/DataAgent real. En paralelo, revisar manana el historial
de cron-job.org y apagar "guardar respuestas" si todo sigue estable.

### Actualizacion 2026-07-05: Corte 22A - runtime API OpenAI para agentes

Fecha:

5 de julio, 2026.

Corte:

Corte 22A: conectar una implementacion API real detras de `AgentRuntime` sin
dar escritura directa a los agentes.

Que se implemento:

- `OpenAIAgentRuntime` usando OpenAI Responses API y Structured Outputs.
- Modo interno `AGENT_RUNTIME_API_KIND=openai` dentro del provider canonico
  `api`.
- Deteccion automatica: si existe `OPENAI_API_KEY` y no hay
  `AGENT_RUNTIME_API_URL`, `api` usa modo `openai`.
- Schema JSON estricto para `DataAgentOutput` y `ResponseAgentOutput`.
- Instrucciones de sistema por agente:
  - agentes no escriben DB;
  - no llaman Core;
  - no devuelven chain-of-thought;
  - si falta evidencia, devuelven ambiguedad o confirmacion requerida.
- Fallback seguro a `local_fixture` cuando falta key, modelo o falla el
  proveedor, trazado con `runtime_fallback_from_api`.
- Limpieza de mojibake en fixtures locales de `DataAgent` y `ResponseAgent`.
- Variables nuevas documentadas en `.env.local.example`.
- Seccion `8.1 Implementacion api V1` agregada a `19_agent_runtime_tools.md`.

Archivos principales:

- `src/agents/runtime/openai-agent-runtime.ts`
- `src/agents/runtime/openai-agent-runtime.test.ts`
- `src/agents/runtime/config.ts`
- `src/agents/runtime/default-runtime.ts`
- `src/agents/runtime/config.test.ts`
- `src/agents/data-agent/data-agent.test.ts`
- `src/agents/data-agent/local-fixture-runtime.ts`
- `src/agents/response-agent/local-fixture-runtime.ts`
- `src/agents/response-agent/response-agent.test.ts`
- `src/core/response/response-agent-enhancer.test.ts`
- `src/core/response/response-planner.ts`
- `.env.local.example`
- `docs/fase_4_tecnica/19_agent_runtime_tools.md`
- `docs/fase_4_tecnica/23b_seguimiento_construccion_v1.md`

Que quedo mockeado o pendiente:

- No se configuro `OPENAI_API_KEY` ni `AGENT_RUNTIME_API_MODEL` en entorno real.
- No se ejecuto una llamada real a OpenAI; el runtime quedo probado con fetch
  mockeado y fallback local.
- Falta decidir modelo/costo/calidad para `DataAgent` y `ResponseAgent`.
- Falta QA real: activar `AGENT_RUNTIME_DATA_AGENT_PROVIDER=api` en staging,
  probar mensajes WhatsApp y revisar trazas antes de activar otros agentes.

Pruebas ejecutadas:

- `npm.cmd test -- --run src/core/response/response-agent-enhancer.test.ts src/agents/response-agent/response-agent.test.ts src/agents/runtime src/agents/data-agent`: OK,
  7 archivos, 23 tests.
- `npm.cmd run typecheck`: OK.
- `npm.cmd test`: OK, 62 archivos, 299 tests.
- `npm.cmd run lint`: OK con 1 warning preexistente en `.cursor/stitch-proxy.mjs`.
- `npm.cmd run build`: OK, Next.js 16.2.7/Turbopack.

Capturas/artefactos:

- No aplica captura; no toca UI.

Deuda tecnica nueva:

- Agregar smoke real opcional para `AgentRuntime` cuando exista key/modelo.
- Medir latencia y calidad real por agente antes de mover `ResponseAgent` o
  `ConversationAgent` a API.

Siguiente paso:

Configurar key/modelo de agente en staging y ejecutar QA real con mensajes
WhatsApp controlados. Si el costo/calidad es bueno, mantener `DataAgent` en
`api`; si no, ajustar prompt/schema antes de tocar Core.

### Actualizacion 2026-07-14: Corte 22B - DataAgent con OpenAI en Production

Fecha:

14 de julio, 2026.

Corte:

Corte 22B: activar OpenAI API oficial como runtime real solo para `DataAgent`
en Production, manteniendo fallback local y sin mover `ResponseAgent`.

Que se implemento:

- Se configuro `OPENAI_API_KEY` como variable sensible en Vercel Production.
- Se configuro `AGENT_RUNTIME_API_KIND=openai`.
- Se configuro `AGENT_RUNTIME_API_MODEL=gpt-5.6-luna`.
- Se configuro `AGENT_RUNTIME_DATA_AGENT_PROVIDER=api`.
- Se mantuvo `AGENT_RUNTIME_DEFAULT_PROVIDER=local_fixture`.
- Se mantuvo `AGENT_RUNTIME_FALLBACK_LOCAL=true`.
- Se dejo `AGENT_RUNTIME_RESPONSE_AGENT_PROVIDER` vacio para que las respuestas
  sigan en runtime local mientras se valida calidad/costo del parser.
- Se actualizo `.env.local` con la misma configuracion sin exponer secretos.
- Se redeployo Production en Vercel.

Archivos principales:

- `.env.local` (no versionado, contiene secreto local).
- `docs/fase_4_tecnica/23b_seguimiento_construccion_v1.md`.

Que quedo mockeado o pendiente:

- Falta QA real por WhatsApp con `DataAgent` usando OpenAI.
- Falta revisar trazas/logs para confirmar si la respuesta vino de `api/openai`
  o si hubo fallback local.
- `ResponseAgent` sigue en local por decision de rollout controlado.
- No se cambio el Core financiero ni las reglas de confirmacion.

Pruebas ejecutadas:

- Smoke real local contra OpenAI Responses API: OK, HTTP 200, modelo
  `gpt-5.6-luna`, Structured Outputs activo.
- `npx.cmd vercel deploy --prod`: OK.
- `npx.cmd vercel inspect https://manzana.website --timeout 120000`: OK,
  deployment `dpl_CjhzDv9GVUsjS4V8oTXkq4tiseBL` en estado `Ready`.

Capturas/artefactos:

- Alias Production actualizado: `https://manzana.website`.

Deuda tecnica nueva:

- Agregar smoke real para `AgentRuntime` con key configurada, sin depender de
  WhatsApp manual.
- Medir costo, latencia, fallback y calidad por agente antes de activar
  `ResponseAgent`.

Siguiente paso:

Enviar mensajes controlados por WhatsApp y validar dashboard/logs:
`gaste 10 en desayuno`, `gaste 8 cafe, 15 taxi y 20 almuerzo`, correccion y
confirmacion.

### Actualizacion 2026-07-14: Corte 22C - Fallback Seguro Para Correcciones Bloqueadas

Fecha:

14 de julio, 2026.

Corte:

Corte 22C: evitar silencio en WhatsApp cuando el `DataAgent` entiende una
correccion, pero el `PolicyGate` bloquea la accion porque el Core todavia no
puede ejecutarla de forma segura.

Que se implemento:

- `FinancialOrchestrator` ahora pasa el `financialActionPlan` al
  `ResponsePlanner`.
- `FinancialOrchestrator` tambien pasa el `dataAgentIntent` al
  `ResponsePlanner`.
- `ResponsePlanner` agrega el escenario `blocked_financial_action`.
- Si el plan queda `blocked`, el Core no ejecuta nada y no se crea pendiente,
  Manzana responde por WhatsApp con una aclaracion segura.
- Si el runtime API falla, cae a fixture local, el plan queda `no_action`, pero
  el texto parece una correccion financiera, Manzana tambien responde por la
  misma ruta segura.
- El mensaje deja explicito que no se cambio dinero y dirige a Movimientos para
  editar manualmente mientras no exista `CorrectionAgent` completo.
- `ResponseAgent` reconoce el escenario `blocked_financial_action` y conserva
  el texto base para no convertirlo en un mensaje de pendiente.

Archivos principales:

- `src/core/orchestrator/financial-orchestrator.ts`
- `src/core/response/response-planner.ts`
- `src/core/response/response-planner.test.ts`
- `src/agents/response-agent/types.ts`
- `src/agents/response-agent/local-fixture-runtime.ts`
- `docs/fase_4_tecnica/23b_seguimiento_construccion_v1.md`

Que quedo mockeado o pendiente:

- No se implementa aun la correccion automatica de movimientos desde WhatsApp.
- Falta el flujo completo de `CorrectionAgent` + herramientas seguras de
  lectura/escritura via Core para cambiar un movimiento confirmado.
- Un mensaje anterior ya procesado como `no_response` no se reenvia
  retroactivamente; el usuario debe reenviar la correccion tras el deploy.

Pruebas ejecutadas:

- `npm test -- --run src/core/response/response-planner.test.ts src/agents/response-agent/response-agent.test.ts src/core/response/response-agent-enhancer.test.ts`: OK,
  3 archivos, 22 tests.
- `npm run typecheck`: OK.
- `npm test -- --run`: OK, 62 archivos, 301 tests.
- `npm run build`: OK, Next.js 16.2.7/Turbopack.

Capturas/artefactos:

- No aplica captura; cambio de backend/orquestacion.

Deuda tecnica nueva:

- Implementar `CorrectionAgent` real para casos como "eso no fue gasto, fue
  prestamo a Luis".
- Agregar smoke real de WhatsApp para validar que el escenario
  `blocked_financial_action` se envia en Production.

Siguiente paso:

Redeployar Production y reenviar el mensaje de correccion por WhatsApp para
validar que Manzana responde sin tocar dinero.

---

### Actualizacion 2026-07-14: Corte 22D - CorrectionAgent V1 Para Prestamos Desde WhatsApp

Fecha:

14 de julio, 2026.

Corte:

Corte 22D: implementar el primer flujo real de `CorrectionAgent` para
correcciones seguras desde WhatsApp, empezando por el caso documentado:
"eso no fue gasto, fue prestamo a Luis".

Que se implemento:

- Nuevo `CorrectionAgent` local deterministico V1.
- Nuevo `CorrectionContextPack` con movimientos recientes de solo lectura.
- Nuevo helper `listRecentMovementsForCorrection` para consultar candidatos
  recientes sin dar escritura directa al agente.
- El agente detecta correcciones a `prestamo_dado` y `prestamo_recibido`.
- Si hay un candidato claro, Manzana pide confirmacion interactiva antes de
  cambiar.
- Si hay varios candidatos recientes, Manzana pregunta cual movimiento corregir
  con botones.
- Los botones usan comandos `corr:*`; el boton no cambia dinero por si mismo.
- Nuevo resolver `maybeResolveCorrectionFromWhatsApp` para aplicar el comando
  via `CorrectMovementCommand`.
- El cambio real pasa por `CommandDispatcher`, `SupabaseFinancialCoreRepository`,
  audit log, recalculo de saldos y outbox.
- `ResponsePlanner` agrega escenarios:
  `correction_applied`, `correction_cancelled`,
  `correction_needs_confirmation`, `correction_needs_selection` y
  `correction_needs_clarification`.
- `ResponseAgent` conserva estos textos base para no inventar acciones ni
  cambiar hechos financieros.

Archivos principales:

- `src/agents/correction-agent/types.ts`
- `src/agents/correction-agent/correction-agent.ts`
- `src/agents/correction-agent/index.ts`
- `src/core/orchestrator/whatsapp-correction.ts`
- `src/core/orchestrator/financial-orchestrator.ts`
- `src/core/response/response-planner.ts`
- `src/agents/response-agent/types.ts`
- `src/agents/response-agent/local-fixture-runtime.ts`
- `src/data/repositories/movements.repository.ts`
- `src/agents/correction-agent/correction-agent.test.ts`
- `src/core/response/response-planner.test.ts`

Que quedo mockeado o pendiente:

- V1 no crea todavia entidades formales de `related_person` ni `debt` al
  corregir a prestamo; guarda el nombre de la persona en metadata/descripcion y
  conserva la seguridad del Core.
- V1 no interpreta aun correcciones de monto, categoria o cuenta desde
  WhatsApp; esos casos siguen por flujo seguro/manual hasta ampliar el agente.
- Si hay demasiados candidatos recientes, Manzana pide aclaracion en vez de
  mostrar una lista incompleta.

Pruebas ejecutadas:

- `npm test -- src/agents/correction-agent/correction-agent.test.ts src/core/response/response-planner.test.ts`: OK,
  2 archivos, 21 tests.
- `npm run typecheck`: OK.
- `npm test`: OK, 63 archivos, 305 tests.
- `npm run build`: OK, Next.js 16.2.7/Turbopack.
- `npx vercel deploy --prod`: OK, deployment
  `dpl_DK4xJrDu7yr7ptHGiLSe4jip7Fm9`, alias `https://manzana.website`.
- `npx vercel inspect manzana-staging-4e2bj5np0-marcobernas-projects.vercel.app`: OK,
  status `Ready`.
- `GET https://manzana.website/api/health`: OK, Supabase OK.

Capturas/artefactos:

- No aplica captura; cambio de backend/orquestacion WhatsApp.

Deuda tecnica nueva:

- Agregar smoke real de WhatsApp para validar:
  1. mensaje de correccion,
  2. seleccion/confirmacion por boton,
  3. movimiento corregido en Dashboard,
  4. audit/outbox generado.
- Expandir `CorrectionAgent` a correcciones de monto, categoria, cuenta,
  descripcion y borrado seguro con confirmacion.

Siguiente paso:

Probar desde WhatsApp:

1. Registrar un movimiento simple.
2. Enviar: `eso no fue gasto, fue prestamo a Luis`.
3. Confirmar con boton.
4. Verificar que el movimiento cambia a `prestamo_dado` y que no hay escritura
   directa fuera del Core.

---

## Actualizacion 2026-07-14: QA Real Staging De Correccion WhatsApp

Estado: completado en `https://manzana.website`.

Prueba ejecutada:

1. Usuario registro por WhatsApp: `Gaste 20 en almuerzo`.
2. Manzana creo un movimiento confirmado desde `DataAgent`.
3. Usuario envio: `Eso no fue un gasto fue prestamo a luis`.
4. `CorrectionAgent` detecto una correccion con un solo candidato y pidio
   confirmacion interactiva.
5. Usuario confirmo con boton `corr:loan_to:*:luis`.
6. `FinancialOrchestrator` resolvio el comando y `CommandDispatcher` aplico la
   correccion via Core.

Resultado en datos reales:

- `external_event_log.orchestrator_reason` quedo como
  `accepted_with_correction_applied`.
- `response_plan_reason` quedo como `correction_applied`.
- El movimiento corregido quedo con:
  - `type = prestamo_dado`
  - `status = corrected`
  - `amount = 20`
  - `description = Prestamo a Luis`
  - `metadata.generated_by = correction_agent`
  - `metadata.correction_source = whatsapp_interactive`
  - `metadata.related_person_name = Luis`
- `movement_audit_log` registro cambios en `type`, `status`, `description`,
  `merchant`, `category_id`, `confidence` y `metadata`.
- `transactional_outbox` publico `movement_corrected`.

Observaciones:

- El flujo respeta el contrato de producto: el agente propone/interpreta, pero
  la escritura financiera la ejecuta el Core.
- La correccion no crea aun una entidad formal de persona/deuda. En V1 queda
  como descripcion y metadata segura, pendiente de ampliar el dominio de
  personas relacionadas.
- Los eventos antiguos previos a este corte quedaron como evidencia de la razon
  por la que se construyo `CorrectionAgent`: antes el sistema entendia la
  intencion, pero no tenia resolucion segura de correccion.

Siguiente paso:

Cerrar el siguiente corte de calidad sobre correcciones: monto, categoria,
cuenta y anulacion segura, manteniendo confirmacion humana antes de cualquier
cambio financiero sensible.

---

## Actualizacion 2026-07-14: Corte 22E - Correcciones WhatsApp Ampliadas

Fecha: 2026-07-14.

Corte: Correcciones WhatsApp para monto, categoria, cuenta y eliminacion segura.

Que se implemento:

- `CorrectionAgent` ahora puede proponer correcciones de:
  - prestamo dado/recibido,
  - monto,
  - categoria canonica,
  - cuenta origen/destino segun tipo de movimiento,
  - eliminacion segura por `soft_delete`.
- El agente sigue sin escribir dinero: solo devuelve comandos `corr:*` y exige
  confirmacion humana.
- `FinancialOrchestrator` entrega `CorrectionContextPack` con movimientos
  recientes, cuentas activas y categorias canonicas de solo lectura.
- `whatsapp-correction` resuelve los nuevos botones:
  - `corr:amount:*`,
  - `corr:category:*`,
  - `corr:acct_origin:*`,
  - `corr:acct_destination:*`,
  - `corr:delete:*`.
- Las correcciones confirmadas pasan por `CommandDispatcher`:
  - `CorrectMovementCommand` para monto/categoria/cuenta/prestamo,
  - `DeleteMovementCommand` para eliminacion segura.
- `ResponsePlanner` distingue entre cambiar y eliminar para no usar copy
  ambiguo en acciones sensibles.

Archivos principales:

- `src/agents/correction-agent/types.ts`
- `src/agents/correction-agent/correction-agent.ts`
- `src/core/orchestrator/financial-orchestrator.ts`
- `src/core/orchestrator/whatsapp-correction.ts`
- `src/core/response/response-planner.ts`
- `src/agents/correction-agent/correction-agent.test.ts`
- `src/core/orchestrator/whatsapp-correction.test.ts`
- `src/core/response/response-planner.test.ts`

Que quedo mockeado o pendiente:

- Falta QA real por WhatsApp para los cuatro casos nuevos.
- No se agrego aun correccion natural de descripcion/merchant; queda para un
  corte posterior porque requiere mas ambiguedad semantica.
- La limpieza completa del `ResponsePlanner` quedo separada para el Corte 22F,
  para no mezclar refactor textual con logica financiera.

Pruebas ejecutadas:

- `npm run typecheck`: OK.
- `npm test -- src/agents/correction-agent/correction-agent.test.ts src/core/orchestrator/whatsapp-correction.test.ts src/core/response/response-planner.test.ts`: OK,
  3 archivos, 30 tests.
- `npm test`: OK, 64 archivos, 314 tests.
- `npm run build`: OK, Next.js 16.2.7/Turbopack.
- `npx vercel deploy --prod`: OK, alias `https://manzana.website`.
- `GET https://manzana.website/api/health`: OK, Supabase OK.

Capturas/artefactos:

- No aplica captura; cambio de backend/orquestacion WhatsApp.

Deuda tecnica nueva:

- Hacer QA real desde WhatsApp:
  1. `no fueron 20, fueron 25`,
  2. `eso no era comida, era transporte`,
  3. `fue con tarjeta bcp` o una cuenta activa real,
  4. `borra ese gasto`.
- Resuelta en el Corte 22F: limpieza de `ResponsePlanner`.

Siguiente paso:

Ejecutar QA real de correcciones ampliadas en staging y, si pasa, continuar con
el siguiente corte documentado del plan vivo.

---

## Actualizacion 2026-07-14: Corte 22F - Limpieza ResponsePlanner Correcciones

Fecha: 2026-07-14.

Corte: Limpieza tecnica y de copy en `ResponsePlanner` para correcciones por
WhatsApp.

Que se implemento:

- Se elimino el bloque legacy duplicado de propuestas de correccion en
  `buildProductResponse`.
- Las propuestas de correccion ahora tienen una sola ruta de decision:
  - `requires_confirmation`,
  - `candidate_selection_required`,
  - `no_candidate`,
  - `needs_clarification`,
  - `unsupported`.
- Se elimino el helper muerto `describeCorrectionTarget`.
- Se corrigio copy visible de WhatsApp:
  - `Cambié`,
  - `Eliminé`,
  - `no cambié`,
  - `código/códigos`,
  - `cuál`,
  - `corrección`,
  - `revisión`,
  - `ningún`.
- Los botones de confirmacion usan `Sí, cambiar` y `Sí, eliminar`.

Archivos principales:

- `src/core/response/response-planner.ts`
- `src/core/response/response-planner.test.ts`
- `docs/fase_4_tecnica/23b_seguimiento_construccion_v1.md`

Que quedo mockeado o pendiente:

- No se cambio logica financiera ni escritura Core.
- Sigue pendiente QA real desde WhatsApp de las correcciones ampliadas del Corte
  22E.

Pruebas ejecutadas:

- `npm test -- src/core/response/response-planner.test.ts`: OK, 19 tests.
- `npm test -- src/agents/correction-agent/correction-agent.test.ts src/core/orchestrator/whatsapp-correction.test.ts src/core/response/response-planner.test.ts`: OK,
  3 archivos, 30 tests.
- `npm run typecheck`: OK.
- `npm test`: OK, 64 archivos, 314 tests.
- `npm run build`: OK, Next.js 16.2.7/Turbopack.
- `npx vercel deploy --prod`: OK, alias `https://manzana.website`.
- `GET https://manzana.website/api/health`: OK, Supabase OK.

Capturas/artefactos:

- No aplica captura; cambio de backend/copy WhatsApp.

Deuda tecnica nueva:

- Ninguna nueva detectada en este corte.

Siguiente paso:

Hacer QA real desde WhatsApp con las correcciones ampliadas:

1. `no fueron 20, fueron 25`.
2. `eso no era comida, era transporte`.
3. `fue con tarjeta bcp` o una cuenta activa real.
4. `borra ese gasto`.

---

## Actualizacion 2026-07-14: Corte 22G - ResponseAgent Guardrails De Seguridad

Fecha: 2026-07-14.

Corte: Cierre de calidad de `ResponseAgent` para respuestas WhatsApp, sin
darle escritura financiera ni moverlo aun a API por defecto.

Que se implemento:

- Se verifico que `ResponseAgent` ya esta conectado despues de
  `ResponsePlanner` en el `FinancialOrchestrator`.
- `ResponseAgentEnhancer` ahora rechaza salidas del agente que pierden frases o
  conceptos de seguridad del texto base:
  - saldo protegido: "no toca tu saldo" / "no tocaba tu saldo",
  - confirmacion humana: "hasta que confirmes",
  - no mutacion: "no cambie nada",
  - bloqueo seguro: "no pude aplicar".
- Si el agente falla o pierde una frase protegida, se conserva el texto
  deterministico del `ResponsePlanner`.
- Se agrego una prueba de regresion para evitar que una respuesta de pendiente
  conserve el link pero omita que el saldo no se toca.

Archivos principales:

- `src/core/response/response-agent-enhancer.ts`
- `src/core/response/response-agent-enhancer.test.ts`
- `docs/fase_4_tecnica/23b_seguimiento_construccion_v1.md`

Que quedo mockeado o pendiente:

- `ResponseAgent` sigue pudiendo usar `local_fixture` por defecto.
- Activar `AGENT_RUNTIME_RESPONSE_AGENT_PROVIDER=api` queda pendiente de QA
  controlado con OpenAI en staging/production.
- No se cambio Core, saldos, pendientes ni reglas financieras.

Pruebas ejecutadas:

- `npm test -- src/agents/response-agent/response-agent.test.ts src/core/response/response-agent-enhancer.test.ts`:
  OK, 2 archivos, 6 tests.
- `npm test`: OK, 64 archivos, 315 tests.
- `npm run typecheck`: OK.
- `npm run build`: OK, Next.js 16.2.7/Turbopack.
- `npx vercel deploy --prod`: OK, deployment
  `dpl_6WBGWzctk9zGHC4TyYvia5zpQT6W`, alias `https://manzana.website`.
- `GET https://manzana.website/api/health`: OK, Supabase OK.

Capturas/artefactos:

- No aplica captura; cambio de backend/copy WhatsApp.

Deuda tecnica nueva:

- Cuando se active `ResponseAgent` con API real, revisar trazas de rechazo por
  `missing_safety_phrase` para ajustar prompt/copy sin relajar guardrails.

Siguiente paso:

Mantener QA real desde WhatsApp de las correcciones ampliadas y, despues,
activar `ResponseAgent` con proveedor API solo si la calidad supera al
fallback local sin perder frases protegidas.

---

## Actualizacion 2026-07-14: Corte 22H - ResponseAgent API Controlado

Fecha: 2026-07-14.

Corte: activar `ResponseAgent` con OpenAI API detras de `AgentRuntime`, despues
de smoke real opt-in y sin darle escritura financiera.

Que se implemento:

- Se separaron mejor las instrucciones de sistema por agente en
  `OpenAIAgentRuntime`:
  - `DataAgent` mantiene reglas de ambiguedad y confirmacion;
  - `ResponseAgent` conserva montos, links, codigos, conteos y frases de
    seguridad del `base_text`;
  - `ResponseAgent` no puede convertir un pendiente en movimiento confirmado ni
    una accion bloqueada en accion aplicada.
- Se agrego smoke real opt-in para `ResponseAgent` contra OpenAI:
  - no corre en la suite normal;
  - solo corre con `RUN_OPENAI_AGENT_SMOKE=true`;
  - falla si hay fallback local, si no preserva monto, si pierde link o si
    omite "no toca tu saldo" / confirmacion.
- Se agrego script:
  - `npm run smoke:agent:response-api`.
- Se actualizo `.env.local.example` para indicar que
  `AGENT_RUNTIME_RESPONSE_AGENT_PROVIDER=api` debe activarse despues de smoke
  controlado.
- Se activo localmente `AGENT_RUNTIME_RESPONSE_AGENT_PROVIDER=api`.
- Se agrego `AGENT_RUNTIME_RESPONSE_AGENT_PROVIDER=api` en Vercel Production.
- Se redeployo Production para que `https://manzana.website` tome el nuevo
  runtime.

Archivos principales:

- `src/agents/runtime/openai-agent-runtime.ts`
- `src/agents/response-agent/response-agent.api-smoke.test.ts`
- `.env.local.example`
- `.env.local` (no versionado; solo cambio de provider, sin exponer secretos)
- `package.json`
- `docs/fase_4_tecnica/23b_seguimiento_construccion_v1.md`

Que quedo mockeado o pendiente:

- No se cambio Core, saldos, pendientes, PolicyGate ni reglas financieras.
- `AGENT_RUNTIME_FALLBACK_LOCAL=true` sigue activo en Production; si OpenAI
  falla, el router puede conservar respuesta local y trazar fallback.
- Falta QA real conversacional desde WhatsApp para observar tono, latencia,
  costo y rechazos por `missing_safety_phrase` en conversaciones reales.
- No se movieron `ConversationAgent`, `CorrectionAgent` ni agentes de insights.

Pruebas ejecutadas:

- `npm test -- src/agents/runtime/openai-agent-runtime.test.ts src/agents/response-agent/response-agent.test.ts src/core/response/response-agent-enhancer.test.ts src/agents/response-agent/response-agent.api-smoke.test.ts`:
  OK, 9 tests y 2 smoke tests saltados.
- `npm run typecheck`: OK.
- `RUN_OPENAI_AGENT_SMOKE=true npm run smoke:agent:response-api`: OK, 2 tests
  reales contra OpenAI.
- `npm test`: OK, 64 archivos, 315 tests y 2 smoke tests saltados.
- `npm run build`: OK, Next.js 16.2.7/Turbopack.
- `npx vercel env add AGENT_RUNTIME_RESPONSE_AGENT_PROVIDER production`: OK.
- `npx vercel deploy --prod`: OK, deployment
  `dpl_C1uY2CuBTfe6SuPK9nRPM1n2QDMW`, alias `https://manzana.website`.
- `GET https://manzana.website/api/health`: OK, Supabase OK.

Capturas/artefactos:

- No aplica captura; cambio de runtime/copy backend.
- Smoke real opt-in disponible como comando de QA.

Deuda tecnica nueva:

- Medir en trazas reales:
  - proveedor usado,
  - latencia,
  - fallback,
  - rechazos de guardrails,
  - calidad percibida del copy.
- Si el costo o tono no conviene, bajar solo
  `AGENT_RUNTIME_RESPONSE_AGENT_PROVIDER` a `local_fixture` sin tocar Core ni
  `DataAgent`.

Siguiente paso:

Hacer QA real desde WhatsApp con mensajes de registro, pendientes y correccion:

1. `gasté 10 en desayuno`.
2. `gasté 8 café, 15 taxi y 20 almuerzo`.
3. `creo que gasté en algo pero no recuerdo cuánto`.
4. `eso no fue gasto, fue préstamo a Luis`.
5. `ver pendientes`.

Revisar que las respuestas sean mas humanas sin perder hechos ni seguridad.

---

## Actualizacion 2026-07-14: Corte 22I - Auditor De Trazas WhatsApp AgentRuntime

Fecha: 2026-07-14.

Corte: convertir el QA real de WhatsApp + AgentRuntime + ResponseAgent en una
prueba repetible de trazas, sin enviar mensajes nuevos ni tocar Core.

Que se implemento:

- Se agrego `npm run smoke:whatsapp:agent-traces`.
- El smoke lee `external_event_log` con `service_role` y audita eventos reales
  recientes de WhatsApp:
  - `DataAgent` completado;
  - proveedor/modelo/latencia de `DataAgent`;
  - `ResponseAgent` status/proveedor/modelo;
  - `response_plan_kind`, `response_plan_reason` y texto planificado;
  - razon del `FinancialOrchestrator`;
  - camino Core/Pendientes/Correcciones.
- El smoke reconoce los escenarios QA del documento:
  - `gaste 10 en desayuno`;
  - `gaste 8 cafe, 15 taxi y 20 almuerzo`;
  - `creo que gaste en algo pero no recuerdo cuanto`;
  - `eso no fue gasto, fue prestamo a Luis`;
  - `ver pendientes`.
- El modo normal es `readiness`: no falla por conversaciones antiguas o
  incompletas, pero deja warnings claros.
- El modo estricto se activa con:
  - `npm run smoke:whatsapp:agent-traces -- --strict`;
  - o `RUN_WHATSAPP_AGENT_TRACE_SMOKE=true`.
- Se agrego soporte de filtro por telefono:
  - `-- --phone=+51XXXXXXXXX`.
- Se actualizaron los smokes antiguos de WhatsApp para llamar el worker outbox
  con `Authorization: Bearer <WORKER_SECRET|CRON_SECRET>` cuando el secreto esta
  configurado.

Archivos principales:

- `scripts/smoke-whatsapp-agent-traces.mjs`
- `scripts/smoke-whatsapp-idempotency.mjs`
- `scripts/smoke-whatsapp-pending-codes.mjs`
- `package.json`
- `docs/fase_4_tecnica/23b_seguimiento_construccion_v1.md`

Que quedo mockeado o pendiente:

- El nuevo smoke no genera mensajes WhatsApp. Es intencional: evita mandar
  mensajes reales a numeros aleatorios cuando `WHATSAPP_SEND_RESPONSES=true`.
- El modo estricto queda pendiente hasta repetir los 5 mensajes QA desde el
  WhatsApp vinculado despues del Corte 22H.
- En las trazas actuales:
  - hay eventos recientes con `DataAgent` usando `api`;
  - no hay una respuesta sendable reciente donde `ResponseAgent` haya completado
    usando `api`;
  - varias respuestas sendable encontradas pertenecen a QA anterior y todavia
    aparecen con `local_fixture`;
  - faltan trazas recientes para los escenarios ambiguo y `ver pendientes`.

Pruebas ejecutadas:

- `npm run smoke:whatsapp:agent-traces`: OK en modo `readiness`; deja warnings
  utiles sobre `ResponseAgent` sendable aun no observado en API.
- `npm run smoke:whatsapp:agent-traces -- --strict`: falla esperado porque el QA
  real completo todavia no fue repetido despues de activar `ResponseAgent` API.
- `npm run typecheck`: OK.
- `npm test`: OK, 64 archivos pasaron, 1 archivo skip, 315 tests pasaron y 2
  smoke tests quedaron saltados.
- `npm run build`: OK.

Capturas/artefactos:

- No aplica captura; auditor de backend/trazas.

Deuda tecnica nueva:

- Repetir QA real desde WhatsApp con los 5 mensajes canonicos y correr el smoke
  estricto filtrando por telefono vinculado.
- Si el smoke estricto sigue mostrando `ResponseAgent` en `local_fixture` para
  respuestas sendable recientes, revisar variables de Vercel, redeploy y ruta
  `AGENT_RUNTIME_RESPONSE_AGENT_PROVIDER`.

Siguiente paso:

Repetir los mensajes QA desde el WhatsApp vinculado y correr:

```bash
npm run smoke:whatsapp:agent-traces -- --strict --phone=<telefono_vinculado>
```

El corte se considera cerrado solo cuando el modo estricto confirme que los
escenarios recientes usan los proveedores esperados, responden sin perder
frases protegidas y mantienen Core/Pendientes/Correcciones separados.

---

## Actualizacion 2026-07-14: Corte 22J - Conversacion Basica WhatsApp

Fecha: 2026-07-14.

Corte: evitar silencio en WhatsApp para interacciones conversacionales basicas
sin convertir todavia esto en ConversationAgent completo.

Que se implemento:

- `ResponsePlanner` ahora reconoce respuestas conversacionales seguras cuando
  `DataAgent` ya termino y clasifico la intencion como `conversation` o
  `unknown`.
- Escenarios cubiertos:
  - saludo simple: `hola`, `buenas`, `hey`, `manzana`;
  - ayuda: `ayuda`, `que puedes hacer`, `como funciona`;
  - agradecimiento: `gracias`, `muchas gracias`, `ok gracias`.
- Estos escenarios generan `whatsapp_freeform` con razones auditables:
  - `conversation_greeting`;
  - `conversation_help`;
  - `conversation_thanks`.
- El `FinancialOrchestrator` marca estos eventos como
  `accepted_with_conversation_response`, no como propuesta financiera.
- `ResponseAgent` acepta los nuevos escenarios sin alterar el texto base ni
  inventar accion financiera.
- El smoke de trazas agrega `hola` como escenario obligatorio en modo estricto.

Archivos principales:

- `src/core/response/response-planner.ts`
- `src/core/orchestrator/financial-orchestrator.ts`
- `src/agents/response-agent/types.ts`
- `src/agents/response-agent/local-fixture-runtime.ts`
- `src/core/response/response-planner.test.ts`
- `src/agents/response-agent/response-agent.test.ts`
- `scripts/smoke-whatsapp-agent-traces.mjs`
- `docs/fase_4_tecnica/23b_seguimiento_construccion_v1.md`

Que quedo mockeado o pendiente:

- No se implementa aun `ConversationAgent` completo con ToolGateway, memoria
  consultable, preguntas historicas ni razonamiento financiero read-only.
- No se responde cualquier texto desconocido de forma generica; solo patrones
  seguros para no tapar errores de interpretacion financiera.
- La personalizacion profunda sigue pendiente de Context Packs conversacionales
  reales y memoria viva.

Pruebas ejecutadas:

- `npm test -- src/core/response/response-planner.test.ts src/agents/response-agent/response-agent.test.ts src/core/response/response-agent-enhancer.test.ts`: OK, 29 tests pasaron.
- `npm run typecheck`: OK.
- `npm test`: OK, 64 archivos pasaron, 1 archivo skip, 319 tests pasaron y 2 tests saltados.
- `npm run build`: OK.
- `npm run lint`: OK con 2 warnings preexistentes:
  - `.cursor/stitch-proxy.mjs`: `outputSchema` sin uso;
  - `src/agents/correction-agent/correction-agent.ts`: `_traceId` sin uso.
- `npx.cmd vercel deploy --prod`: OK, deployment
  `https://manzana-staging-8zsd6ftwf-marcobernas-projects.vercel.app`,
  alias `https://manzana.website`.
- `GET https://manzana.website/api/health`: OK 200, Supabase OK.
- `npm run smoke:whatsapp:agent-traces -- --hours=24 --limit=80`: OK en modo `readiness`; muestra el `hola` antiguo como `response_agent_required` porque fue recibido antes de este cambio y todavia falta redeploy/reprueba.
- Deploy Vercel production: OK; alias actualizado a `https://manzana.website`.
- QA real WhatsApp despues del deploy con `Hola`: OK.
  - `orchestrator_reason = accepted_with_conversation_response`;
  - `response_plan_kind = whatsapp_freeform`;
  - `response_plan_reason = conversation_greeting`;
  - `DataAgent provider = api`;
  - `ResponseAgent provider = api`;
  - `response_send_kind = sent`;
  - `financial_action_execution_created_count = 0`;
  - `pending_creation_created_count = 0`.
- `npm run smoke:whatsapp:agent-traces -- --hours=1 --limit=40 --verbose`: OK en modo `readiness`; confirma el escenario `conversation_greeting` y deja warnings solo porque no se repitieron los otros 5 escenarios canonicos dentro de esa ventana.

Capturas/artefactos:

- No aplica captura; cambio de backend/orquestacion WhatsApp.

Deuda tecnica nueva:

- Implementar el corte de `ConversationAgent` V1 con herramientas read-only:
  saldos, movimientos, pendientes, deudas, pagos que vienen y memoria
  consultable.
- Agregar QA real de `hola`, `ayuda` y `gracias` desde el WhatsApp vinculado.
- Repetir despues `ayuda` y `gracias` para confirmar los otros dos escenarios
  conversacionales basicos.

Siguiente paso:

Repetir QA real desde WhatsApp con 6 mensajes canonicos y correr:

```bash
npm run smoke:whatsapp:agent-traces -- --strict --phone=<telefono_vinculado>
```

Mensajes:

1. `hola`
2. `gaste 10 en desayuno`
3. `gaste 8 cafe, 15 taxi y 20 almuerzo`
4. `creo que gaste en algo pero no recuerdo cuanto`
5. `eso no fue gasto, fue prestamo a Luis`
6. `ver pendientes`

---

## Actualizacion 2026-07-14: Corte 22K - ConversationAgent V1 Read-only

Fecha: 2026-07-14.

Corte: responder preguntas financieras simples desde WhatsApp con un
`ConversationAgent` real, sin convertirlo en escritor financiero ni pegar todo
el historial al prompt.

Que se implemento:

- Nuevo `ConversationAgent` con `ConversationContextPack` y output estructurado
  `ConversationalAnswer`.
- Nuevo `ToolGateway` read-only para consultas conversacionales:
  - `get_balance_snapshot`: cuentas, cajas, compromisos proximos y dinero libre
    operativo;
  - `query_movements`: movimientos confirmados por rango de fecha;
  - `get_pending_summary`: pendientes activos sin afectar saldos.
- Nuevo `ConversationRouter` para clasificar preguntas:
  - dinero libre / saldo / `puedo gastar S/50`;
  - busqueda historica de movimientos, incluido `ultimo viernes de hace 4 meses`;
  - resumen de pendientes.
- `FinancialOrchestrator` ahora invoca `ConversationAgent` solo cuando:
  - `DataAgent` ya termino;
  - no propuso acciones financieras;
  - la intencion es `conversation` o `unknown`;
  - el router detecta una consulta soportada.
- La respuesta queda trazada como:
  - `orchestrator_reason = accepted_with_conversation_response`;
  - `response_plan_reason = conversation_answer`;
  - `conversation_agent_*`;
  - `conversation_tool_results`.
- `ResponseAgent` acepta `conversation_answer` y conserva el texto base cuando
  ya viene seguro.
- `OpenAIAgentRuntime` ya tiene schema e instrucciones para
  `conversation_agent`, de modo que puede moverse a API por variable de entorno
  sin reescribir orquestador.

Archivos principales:

- `src/agents/conversation-agent/types.ts`
- `src/agents/conversation-agent/conversation-agent.ts`
- `src/agents/conversation-agent/local-fixture-runtime.ts`
- `src/core/conversation/conversation-router.ts`
- `src/core/conversation/tool-gateway.ts`
- `src/core/orchestrator/financial-orchestrator.ts`
- `src/core/response/response-planner.ts`
- `src/agents/runtime/local-fixture-runtime.ts`
- `src/agents/runtime/openai-agent-runtime.ts`
- `src/agents/response-agent/types.ts`
- `src/agents/response-agent/local-fixture-runtime.ts`
- `src/core/conversation/conversation-router.test.ts`
- `src/agents/conversation-agent/conversation-agent.test.ts`
- `src/core/response/response-planner.test.ts`
- `src/agents/runtime/openai-agent-runtime.test.ts`

Que quedo mockeado o pendiente:

- El `ConversationAgent` corre por fixture local salvo que se active
  `AGENT_RUNTIME_CONVERSATION_AGENT_PROVIDER=api`.
- No se implementa aun memoria conversacional persistente ni preferencias
  aprendidas completas; el Context Pack deja el lugar preparado.
- No se implementa aun conversacion multi-turn compleja, continuidad activa,
  aliases/personas frecuentes ni aprendizaje de correcciones para conversacion.
- Las respuestas historicas usan movimientos confirmados; pendientes siguen
  separados y no se mezclan con saldos.
- Falta QA real en staging desde WhatsApp con preguntas como:
  - `puedo gastar S/50 hoy?`;
  - `que gaste el ultimo viernes de hace 4 meses?`;
  - `tengo pendientes?`.

Pruebas ejecutadas:

- `npm test -- src/core/conversation/conversation-router.test.ts src/agents/conversation-agent/conversation-agent.test.ts src/core/response/response-planner.test.ts src/agents/runtime/openai-agent-runtime.test.ts`: OK, 4 archivos y 33 tests pasaron.
- `npm run typecheck`: OK.
- `npm test`: OK, 66 archivos pasaron, 1 archivo skip, 327 tests pasaron y
  2 tests saltados.
- `npm run build`: OK.
- `npm run lint`: OK con 2 warnings preexistentes:
  - `.cursor/stitch-proxy.mjs`: `outputSchema` sin uso;
  - `src/agents/correction-agent/correction-agent.ts`: `_traceId` sin uso.

Capturas/artefactos:

- No aplica captura; cambio de backend/orquestacion.

Deuda tecnica nueva:

- Agregar smoke real para `ConversationAgent` en WhatsApp con filtro por
  telefono vinculado.
- Activar `conversation_agent` por API en staging solo cuando se quiera evaluar
  costo, latencia y calidad real del modelo.
- Implementar luego memoria consultable real: preferencias, aliases, personas
  frecuentes, correcciones y estado conversacional activo.

Siguiente paso:

Hacer QA real desde WhatsApp con las 3 preguntas conversacionales nuevas:
`puedo gastar S/50 hoy?`, `que gaste el ultimo viernes de hace 4 meses?` y
`tengo pendientes?`. Si el QA queda estable, el corte siguiente recomendado es
memoria conversacional consultable + personalizacion no invasiva.

---

## Actualizacion 2026-07-14: Corte 22K.1 - QA Conversacional De Seguimiento

Objetivo:

Corregir el primer hallazgo de QA real del `ConversationAgent` V1: Manzana
respondia bien a `Que movimientos hice hoy`, pero se quedaba callada ante el
seguimiento `Puedes decirme la hora de cada uno?`.

Que se implemento:

- `ConversationRouter` ahora reconoce preguntas de hora como una consulta
  read-only de movimientos cuando el texto contiene senales como `hora` y
  `cada uno`, `movimientos`, `gastos` o `registros`.
- El runtime local del `ConversationAgent` ahora incluye la hora del movimiento
  cuando el usuario la pide explicitamente.
- El orquestador ya no abandona preguntas conversacionales no soportadas que
  parecen una peticion real; en esos casos llama al `ConversationAgent` para
  responder con una aclaracion segura.
- Se mantiene fuera del `ConversationAgent` el saludo basico (`hola`), ayuda y
  agradecimientos, para no reemplazar el flujo controlado actual por respuestas
  genericas.

Archivos principales:

- `src/core/conversation/conversation-router.ts`
- `src/agents/conversation-agent/local-fixture-runtime.ts`
- `src/agents/runtime/openai-agent-runtime.ts`
- `src/core/orchestrator/financial-orchestrator.ts`
- `src/core/conversation/conversation-router.test.ts`
- `src/agents/conversation-agent/conversation-agent.test.ts`

Que quedo mockeado o pendiente:

- El seguimiento `la hora de cada uno` funciona por heuristica de router y
  movimientos recientes/confirmados. Todavia no usa memoria conversacional
  persistente para saber con certeza que se refiere a la respuesta anterior.
- El saludo `Hola` sigue siendo deterministico y repetible. Esto es aceptable
  como guardrail actual, pero no es la experiencia final personalizada.
- La personalizacion real requiere el siguiente corte: memoria consultable,
  preferencias, aliases/personas frecuentes, correcciones y estado
  conversacional activo.

Pruebas ejecutadas:

- `npm test -- src/agents/runtime/openai-agent-runtime.test.ts src/core/conversation/conversation-router.test.ts src/agents/conversation-agent/conversation-agent.test.ts`: OK, 3 archivos y 12 tests pasaron.
- `npm run typecheck`: OK.
- `npm run lint`: OK con 2 warnings preexistentes:
  - `.cursor/stitch-proxy.mjs`: `outputSchema` sin uso;
  - `src/agents/correction-agent/correction-agent.ts`: `_traceId` sin uso.
- `npm test`: OK, 66 archivos pasaron, 1 archivo skip, 329 tests pasaron y
  2 tests saltados.
- `npm run build`: OK.

Capturas/artefactos:

- QA real reportado por WhatsApp:
  - `Que movimientos hice hoy`: OK.
  - `Puedes decirme la hora de cada uno?`: antes quedaba sin respuesta.
- Deploy production Vercel:
  - deployment id: `dpl_7S464srmeuq1jt49Gt9cG8egoAqi`;
  - URL temporal: `https://manzana-staging-oy71jx0tq-marcobernas-projects.vercel.app`;
  - alias: `https://manzana.website`.
- Health check:
  - `GET https://manzana.website/api/health`: OK;
  - `env=staging`;
  - `supabase.status=ok`.

Deuda tecnica nueva:

- Agregar smoke real de WhatsApp para seguimientos conversacionales:
  1. preguntar movimientos de hoy;
  2. preguntar luego `me puedes decir la hora de cada uno?`;
  3. validar que no quede en silencio y que responda con horas.
- Implementar `ConversationKernel`/memoria conversacional para resolver
  referencias como `cada uno`, `eso`, `el anterior`, `el de taxi`, etc. sin
  asumir por heuristica.

Siguiente paso:

Probar de nuevo en WhatsApp el mismo flujo. Si responde con horas, continuar
con memoria conversacional consultable + personalizacion no invasiva.

---

## Actualizacion 2026-07-15: Corte 22K.2 - Memoria Conversacional Consultable Y Busqueda Natural

Fecha: 2026-07-15.

Corte: convertir el seguimiento conversacional de un parche por frase a una
capacidad read-only con memoria consultable, referencias activas y busqueda
natural en Dashboard.

Que se implemento:

- Nueva tabla `conversation_memory_states` con RLS:
  - guarda resumen de la ultima consulta conversacional;
  - guarda movimientos referenciados por la ultima respuesta;
  - no guarda historial crudo ni chain-of-thought;
  - permite resolver referencias como `eso`, `cada uno`, `el anterior`,
    `el de taxi` o `el primero`.
- `ConversationContextPack` ahora incluye:
  - `active_conversation_state`;
  - `preferences_summary`;
  - `memory_summary` con personas frecuentes y correcciones recientes.
- `ToolGateway` carga memoria activa, preferencias, personas frecuentes y
  correcciones recientes como herramientas/contexto read-only.
- `ToolGateway.query_movements` puede consultar:
  - un rango nuevo si el usuario cambia de periodo (`ayer`, `hoy`, etc.);
  - los movimientos referenciados en la respuesta anterior si el usuario hace
    seguimiento;
  - filtros contextuales como `el de taxi` o `el primero`.
- Los movimientos usados por conversacion ahora incluyen etiquetas humanas
  disponibles:
  - categoria;
  - cuenta origen/destino;
  - fuente/origen;
  - hora;
  - `requires_review` y confianza cuando exista.
- `ConversationAgent` local responde seguimientos por dimension:
  - hora / cuando;
  - cuenta / tarjeta / efectivo;
  - categoria / rubro;
  - fuente / origen / de donde salio;
  - monto / total / neto;
  - detalle de un movimiento o lista corta.
- `OpenAIAgentRuntime` actualizo instrucciones para que el
  `conversation_agent` API use las mismas reglas: read-only, sin inventar y
  usando `active_conversation_state` solo como pista.
- `FinancialOrchestrator` lee memoria conversacional de WhatsApp antes de
  clasificar la consulta y guarda el resultado despues de responder.
- Nuevo endpoint `POST /api/v1/search/natural`:
  - autenticado;
  - read-only;
  - usa `ConversationAgent` + `ToolGateway`;
  - redirige intentos de escritura a flujos estructurados;
  - devuelve fuentes, interpretacion, limites de datos y respuesta.
- Nueva pantalla Dashboard de busqueda natural:
  - no se comporta como chatbot;
  - muestra respuesta, fuentes, rango interpretado y limites;
  - conserva el principio de solo lectura.

Archivos principales:

- `supabase/migrations/023_conversation_memory.sql`
- `src/data/migrations/023_conversation_memory.sql`
- `src/data/repositories/conversation-memory.repository.ts`
- `src/data/supabase/types.ts`
- `src/agents/conversation-agent/types.ts`
- `src/agents/conversation-agent/local-fixture-runtime.ts`
- `src/agents/runtime/openai-agent-runtime.ts`
- `src/core/conversation/conversation-router.ts`
- `src/core/conversation/tool-gateway.ts`
- `src/core/conversation/conversation-memory.ts`
- `src/core/orchestrator/financial-orchestrator.ts`
- `src/app/api/v1/search/natural/route.ts`
- `src/features/search/natural-search-api.ts`
- `src/features/search/natural-search-screen.tsx`
- `src/features/app-shell/app-shell.tsx`
- `src/features/dashboard/dashboard-app.tsx`
- `src/core/conversation/conversation-router.test.ts`
- `src/agents/conversation-agent/conversation-agent.test.ts`
- `src/data/migrations/migrations.test.ts`

Que quedo mockeado o pendiente:

- La memoria persistente V1 es de continuidad inmediata y resumen seguro; no
  reemplaza todavia una memoria semantica profunda.
- `ConversationAgent` sigue usando fixture local salvo que se active proveedor
  API para ese agente.
- Busqueda natural V1 ya existe para movimientos, dinero y pendientes; deudas
  y pagos que vienen requieren herramientas read-only dedicadas para respuestas
  mas profundas.
- El saludo `Hola` sigue siendo deterministico; se mantiene como guardrail
  hasta implementar personalizacion conversacional mas fina.
- Falta deploy/QA real post-corte para confirmar en WhatsApp el flujo:
  1. `Que movimientos hice hoy`;
  2. `Puedes decirme la hora de cada uno?`;
  3. `El de taxi de donde salio?`;
  4. `El primero en que cuenta fue?`.

Pruebas ejecutadas:

- `npm run typecheck`: OK.
- `npm test -- src/core/conversation/conversation-router.test.ts src/agents/conversation-agent/conversation-agent.test.ts src/data/migrations/migrations.test.ts`: OK, 3 archivos y 33 tests pasaron.

Capturas/artefactos:

- No aplica captura; cambio principal de backend/conversacion y una pantalla
  Dashboard conectada.

Deuda tecnica nueva:

- Ejecutar `npm run lint`, `npm test` completo y `npm run build` antes de
  desplegar.
- Desplegar y hacer QA real en WhatsApp y Dashboard.
- Agregar herramientas read-only especificas para deudas/recurrentes dentro de
  busqueda natural.
- Evolucionar `ConversationKernel` formal si crecen los estados de continuidad
  mas alla de una memoria activa por canal.

Siguiente paso:

Correr validacion completa, desplegar y repetir QA real. Si queda estable,
continuar con herramientas read-only para deudas/recurrentes o con
personalizacion conversacional mas profunda segun prioridad de producto.

---

## Actualizacion 2026-07-15: Corte 22K.3 - ConversationKernel Y Experiencia Conversacional

Fecha: 2026-07-15.

Corte: elevar la conversacion de un seguimiento por dimensiones a una capa
formal de experiencia conversacional. El objetivo no fue parchar frases como
`la hora de cada uno`, sino evitar que WhatsApp se comporte como un bot fragil:
Manzana debe entender continuidad, estado emocional probable, modo de
experiencia y contexto activo antes de decidir si responde, pregunta, registra
o deriva a otro flujo.

Que se implemento:

- Nuevo `ConversationKernel`:
  - clasifica cada turno en `act`, `continuity`, `emotional_state` y
    `experience_mode`;
  - distingue saludo, ayuda, pregunta financiera, seguimiento financiero,
    reconstruccion, correccion, captura financiera incompleta y smalltalk;
  - decide si debe usar memoria activa, si debe pasar por `ConversationAgent`
    y si primero conviene pedir aclaracion;
  - produce guias de respuesta, senales de personalizacion y notas de riesgo
    sin guardar chain-of-thought.
- `ConversationContextPack` ahora incluye `turn_state`, para que el agente no
  reciba solo datos sino tambien el estado conversacional operativo.
- `FinancialOrchestrator` ahora invoca el `ConversationKernel` antes del
  ruteo final:
  - lee timezone y memoria activa del canal;
  - permite que un mensaje financiero que el `DataAgent` no puede convertir en
    accion segura pase a `ConversationAgent` en vez de quedarse en silencio;
  - guarda trazas seguras de `act`, `continuity`, `emotional_state`,
    `experience_mode` y uso de memoria activa.
- `ResponsePlanner` permite respuestas conversacionales aunque el intento
  inicial parezca captura financiera, siempre que `turn_state` indique que no
  hay accion Core segura y que debe responder el agente.
- `ConversationAgent` local usa `turn_state` para:
  - continuar una conversacion sin reiniciar el hilo;
  - bajar ansiedad o incertidumbre antes de responder;
  - tratar reconstrucciones como lectura/ayuda, no como registro confirmado;
  - responder saludos con memoria activa sin olvidar lo anterior.
- `OpenAIAgentRuntime` actualizo el prompt del `ConversationAgent` API:
  - debe usar `turn_state`;
  - debe responder con contexto y fuentes;
  - debe reducir culpa/ansiedad;
  - no puede crear, editar ni borrar dinero;
  - no puede inventar datos cuando las herramientas no alcanzan.
- `ConversationRouter` reconoce reconstrucciones como consultas financieras
  read-only, por ejemplo `creo que ayer gaste...`, para que puedan entrar al
  flujo conversacional y no terminen como unsupported.
- `POST /api/v1/search/natural` usa el mismo `ConversationKernel`, evitando
  que Dashboard y WhatsApp tengan inteligencias distintas.
- La memoria conversacional guarda `turn_state` como metadata segura para
  auditoria y mejora de continuidad.

Archivos principales:

- `src/core/conversation/conversation-kernel.ts`
- `src/core/conversation/conversation-router.ts`
- `src/core/conversation/tool-gateway.ts`
- `src/core/conversation/conversation-memory.ts`
- `src/core/orchestrator/financial-orchestrator.ts`
- `src/core/response/response-planner.ts`
- `src/agents/conversation-agent/types.ts`
- `src/agents/conversation-agent/local-fixture-runtime.ts`
- `src/agents/runtime/openai-agent-runtime.ts`
- `src/app/api/v1/search/natural/route.ts`
- `src/core/conversation/conversation-kernel.test.ts`
- `src/core/conversation/conversation-router.test.ts`
- `src/agents/conversation-agent/conversation-agent.test.ts`
- `src/core/response/response-planner.test.ts`
- `src/agents/runtime/openai-agent-runtime.test.ts`

Que quedo mockeado o pendiente:

- La conversacion ya tiene kernel, continuidad y memoria activa, pero aun no es
  una memoria semantica/narrativa profunda de largo plazo.
- Deudas, pagos que vienen, recurrentes e insights necesitan herramientas
  read-only dedicadas para que el `ConversationAgent` responda con la misma
  profundidad que movimientos/dinero.
- El saludo sigue protegido por respuesta controlada; ahora puede reconocer
  continuidad activa, pero falta personalizacion fina por etapa del usuario.
- Deploy a `https://manzana.website` realizado; falta repetir QA real desde
  WhatsApp con preguntas abiertas, seguimientos, reconstrucciones, correcciones
  y cambios de tema.

Pruebas ejecutadas:

- `npm run typecheck`: OK.
- `npm test -- src/core/conversation/conversation-router.test.ts src/core/conversation/conversation-kernel.test.ts src/agents/conversation-agent/conversation-agent.test.ts src/core/response/response-planner.test.ts src/agents/runtime/openai-agent-runtime.test.ts`: OK, 5 archivos y 48 tests pasaron.
- `npm run lint`: OK, 0 errores y 2 warnings no bloqueantes existentes.
- `npm test`: OK, 67 archivos pasaron, 1 skipped; 343 tests pasaron, 2 skipped.
- `npm run build`: OK.

Capturas/artefactos:

- Deploy Vercel Production:
  `https://manzana-staging-99xpflr6g-marcobernas-projects.vercel.app`
  alias `https://manzana.website`.
- Health check `GET https://manzana.website/api/health`: OK, Supabase OK.
- Pagina publica `GET https://manzana.website/empresa`: 200.
- No aplica captura; cambio principal de orquestacion, agentes, contexto y
  runtime conversacional.

Deuda tecnica nueva:

- Validar en WhatsApp:
  1. `Hola` con y sin memoria activa;
  2. `Que movimientos hice hoy`;
  3. `Puedes decirme la hora de cada uno?`;
  4. `El de taxi de donde salio?`;
  5. `Creo que ayer gaste en taxi y comida pero no recuerdo cuanto`;
  6. `Eso no fue gasto, fue prestamo a Luis`;
  7. cambio de tema despues de una consulta financiera.
- Agregar herramientas read-only de deudas, recurrentes y pagos que vienen.
- Definir metricas de calidad conversacional: silencios, respuestas sin fuente,
  aclaraciones utiles, correcciones exitosas y follow-ups resueltos.

Siguiente paso:

Hacer QA conversacional real en WhatsApp. Si pasa, continuar con herramientas
read-only para deudas/recurrentes o con memoria semantica/narrativa segun
prioridad de calidad.

---

## Actualizacion 2026-07-15: Corte 22K.4 - Conversacion Read-Only Profunda

Fecha: 2026-07-15.

Corte: ampliar la conversacion financiera para que Manzana no dependa de
parches de frases especificas. El objetivo fue que el `ConversationAgent` y la
Busqueda Natural puedan responder con contexto a movimientos, dinero libre,
pendientes, deudas, pagos que vienen y memoria financiera resumida, manteniendo
la regla central: lectura inteligente por agentes, escritura financiera solo por
Core.

Que se implemento:

- `ConversationRouter` reconoce nuevas intenciones read-only:
  - `debt_summary`;
  - `recurring_summary`;
  - `financial_memory_search`.
- `ConversationKernel` ya agrega guias operativas por dominio:
  - deudas: separar lo que el usuario debe de lo que le deben, sin tono de
    cobranza;
  - pagos que vienen: anticipar sin alarmar y sin marcar pagos como hechos sin
    confirmacion del Core;
  - memoria: usar resumen seguro, no historial crudo.
- `ToolGateway` agrego herramientas read-only reales:
  - `get_debt_summary`;
  - `get_recurring_summary`;
  - `search_financial_memory`.
- `ConversationAgent` local ya redacta respuestas para:
  - deudas y cuotas proximas;
  - pagos recurrentes / pagos que vienen;
  - preferencias, personas frecuentes, correcciones recientes y continuidad
    activa.
- `OpenAIAgentRuntime` amplio el contrato del `ConversationAgent` API con los
  nuevos `answer_kind` y reglas de tono/seguridad por dominio.
- `conversation-memory` guarda entidades referenciadas, no solo movimientos,
  para que un seguimiento como `y cuando vence?` pueda continuar sobre una deuda
  o pago que viene.
- `POST /api/v1/search/natural` respeta el alcance elegido en Dashboard:
  `movements`, `money`, `debts`, `recurring`, `pending` o `all`.
- La pantalla de Busqueda Natural ahora puede mostrar fuentes no solo de
  movimientos, sino tambien deudas, cuotas, pagos que vienen, pendientes,
  snapshot de dinero y memoria resumida.

Archivos principales:

- `src/agents/conversation-agent/types.ts`
- `src/agents/conversation-agent/conversation-agent.ts`
- `src/agents/conversation-agent/local-fixture-runtime.ts`
- `src/agents/runtime/openai-agent-runtime.ts`
- `src/core/conversation/conversation-router.ts`
- `src/core/conversation/conversation-kernel.ts`
- `src/core/conversation/tool-gateway.ts`
- `src/core/conversation/conversation-memory.ts`
- `src/data/repositories/conversation-memory.repository.ts`
- `src/app/api/v1/search/natural/route.ts`
- `src/features/search/natural-search-api.ts`
- `src/features/search/natural-search-screen.tsx`
- `src/core/conversation/conversation-router.test.ts`
- `src/core/conversation/conversation-kernel.test.ts`
- `src/agents/conversation-agent/conversation-agent.test.ts`

Que quedo mockeado o pendiente:

- `ConversationAgent` local ya cubre los dominios nuevos, pero el runtime API
  para `conversation_agent` todavia requiere QA real con `OPENAI_API_KEY` y
  modelo configurado.
- La memoria V1 sigue siendo memoria de continuidad, preferencias y resumen
  seguro; no es todavia memoria semantica/narrativa profunda de largo plazo.
- Falta deploy/QA real post-corte en WhatsApp y Dashboard para confirmar:
  deudas, pagos que vienen, preguntas de seguimiento y busqueda natural por
  alcance.
- Insights conversacionales profundos siguen fuera de este corte.

Pruebas ejecutadas:

- `npm run typecheck`: OK.
- `npm test -- src/core/conversation/conversation-router.test.ts src/core/conversation/conversation-kernel.test.ts src/agents/conversation-agent/conversation-agent.test.ts`: OK, 3 archivos y 30 tests pasaron.
- `npm run lint`: OK, 0 errores y 2 warnings no bloqueantes existentes.
- `npm test`: OK, 67 archivos pasaron, 1 skipped; 353 tests pasaron, 2 skipped.
- `npm run build`: OK.

Capturas/artefactos:

- No aplica captura; cambio principal de backend conversacional, herramientas
  read-only, contratos de agente y busqueda natural.
- No se desplego en Vercel en este corte.

Deuda tecnica nueva:

- QA real:
  1. `Que movimientos hice hoy`;
  2. `Puedes decirme la hora de cada uno?`;
  3. `Cuanto le debo a Luis?`;
  4. `Y cuando vence?`;
  5. `Que pagos vienen este mes?`;
  6. `Que recuerdas de mis preferencias?`;
  7. Busqueda Natural con alcance `Deudas`, `Pagos que vienen` y `Todo`.
- Mejorar memoria semantica de largo plazo si se decide elevar
  personalizacion mas alla de preferencias/correcciones/personas frecuentes.
- Evaluar si `ConversationAgent` debe pasar a API como siguiente corte o si
  conviene primero hacer deploy/QA del runtime local mejorado.

Siguiente paso:

Desplegar este corte y hacer QA real en WhatsApp/Dashboard. Si el QA pasa,
continuar con activacion controlada del `conversation_agent` en OpenAI API o
con memoria semantica/narrativa, segun prioridad de calidad.

---

## Actualizacion 2026-07-15: Corte 22K.5 - Memoria Consultable Query-Aware

Fecha: 2026-07-15.

Corte: elevar la calidad conversacional sin parchar frases aisladas. El objetivo
fue que Manzana pueda responder preguntas amplias como `que sabes de mi forma de
gastar?`, `que recuerdas de mis preferencias?` o consultas sobre personas y
correcciones usando memoria consultable por herramientas, no historial crudo ni
prompt global gigante.

Que se implemento:

- `ConversationRouter` ahora reconoce preguntas de memoria mas naturales:
  - `que sabes de mi`;
  - `que sabes de`;
  - `forma de gastar`;
  - `mis habitos`;
  - `mis patrones`;
  - `personas que menciono`.
- `ConversationContextPack.memory_summary` dejo de ser una lista plana de texto
  y ahora expone memoria estructurada:
  - personas frecuentes con `id`, `display_name`, `kind`,
    `relationship_label`, `aliases` y `last_seen_at`;
  - correcciones recientes con `action`, `field_name`, `created_at`,
    `movement_id` y `summary`.
- `ToolGateway.search_financial_memory` ahora interpreta facetas de memoria:
  - preferencias;
  - personas;
  - correcciones;
  - contexto conversacional activo;
  - patrones;
  - narrativa.
- La herramienta de memoria ahora devuelve:
  - `requested_facets`;
  - `matched_people`;
  - `matched_corrections`;
  - `memory_levels_available`;
  - `memory_levels_limited`;
  - `sources` citables para Dashboard.
- `ConversationAgent` local usa esas facetas para responder mejor:
  - menciona preferencias solo si son relevantes;
  - diferencia personas coincidentes vs personas frecuentes;
  - usa correcciones como pistas, no como verdad absoluta;
  - declara limites cuando el usuario pide memoria narrativa/patrones profundos
    y todavia no hay evidencia suficiente.
- `POST /api/v1/search/natural` agrega alcance `memory`.
- `Busqueda Natural` en Dashboard agrega filtro visible `Memoria` y fuentes de
  memoria mas granulares, en lugar de una fuente generica.

Archivos principales:

- `src/agents/conversation-agent/types.ts`
- `src/agents/conversation-agent/local-fixture-runtime.ts`
- `src/core/conversation/conversation-router.ts`
- `src/core/conversation/tool-gateway.ts`
- `src/app/api/v1/search/natural/route.ts`
- `src/features/search/natural-search-api.ts`
- `src/features/search/natural-search-screen.tsx`
- `src/core/conversation/conversation-router.test.ts`
- `src/agents/conversation-agent/conversation-agent.test.ts`

Que quedo mockeado o pendiente:

- Esto sigue siendo memoria V1 estructurada y query-aware. No es todavia memoria
  semantica con embeddings ni narrativa profunda de largo plazo.
- El `ConversationAgent` API debe validarse en staging con `OPENAI_API_KEY` y
  modelo real para confirmar que respeta el nuevo contrato de memoria.
- Falta QA real en WhatsApp y Dashboard con preguntas abiertas de memoria:
  `que sabes de mi?`, `que sabes de Luis?`, `que aprendiste de mis
  correcciones?`, `como suelo gastar?`.

Pruebas ejecutadas:

- `npm run typecheck`: OK.
- `npm test -- src/core/conversation/conversation-router.test.ts src/core/conversation/conversation-kernel.test.ts src/agents/conversation-agent/conversation-agent.test.ts`: OK, 3 archivos y 32 tests pasaron.
- `npm run lint`: OK, 0 errores y 2 warnings no bloqueantes existentes.
- `npm test`: OK, 67 archivos pasaron, 1 skipped; 355 tests pasaron, 2 skipped.
- `npm run build`: OK.

Capturas/artefactos:

- No aplica captura; cambio principal de contrato conversacional, herramienta
  de memoria y busqueda natural.

Deuda tecnica nueva:

- Crear memoria semantica/narrativa real si se decide elevar el nivel de
  personalizacion mas alla de preferencias, personas, correcciones y continuidad.
- Agregar metricas por faceta: consultas de memoria resueltas, consultas
  limitadas, fuentes citadas y follow-ups exitosos.
- Validar que el runtime API no use la memoria para inventar personalidad,
  diagnosticos o patrones sin datos suficientes.

Siguiente paso:

Hacer QA real de memoria consultable en WhatsApp/Dashboard antes de marcar la
experiencia conversacional como lista para staging amplio.

---

## Actualizacion 2026-07-15: Corte 22K.6 - Conversacion Fluida Y Busqueda Global

Fecha: 2026-07-15.

Corte: cerrar el hueco detectado en QA donde Manzana respondia bien una pregunta
financiera (`que movimientos hice hoy`) pero podia quedarse callada ante un
seguimiento natural (`me puedes decir la hora de cada uno?`). El objetivo no fue
parchar esa frase, sino reforzar la capa conversacional para que use memoria
activa, continuidad, busqueda historica y busqueda semantica como esta definido
en Motor IA y Dashboard.

Que se implemento:

- `ConversationRouter` distingue referencias colgantes de seguimientos reales:
  - sin memoria activa, `la hora de cada uno` no se responde con falsa precision;
  - con memoria activa, mantiene `movement_search` y reutiliza el periodo/hilo
    anterior.
- El router reconoce preguntas historicas y semanticas de movimientos:
  - `cuando fue la ultima vez que pague Netflix?`;
  - `que gastos hice el dia que fui al medico?`;
  - referencias tipo `lo de`, `ese gasto`, `movimiento raro`.
- `ConversationKernel` ahora deja guia explicita para respuestas de calidad:
  - usar la respuesta anterior como contexto activo;
  - no explicar desde cero si el seguimiento es claro;
  - responder sobre el hilo activo sin repetir todo;
  - mostrar periodo interpretado y fuente de datos en busquedas financieras.
- `conversation_memory_states` conserva mas datos de los movimientos
  referenciados:
  - comercio;
  - categoria visible;
  - fuente;
  - cuentas origen/destino;
  - confianza;
  - bandera de revision.
- `Busqueda Natural` en Dashboard ahora se puede iniciar desde el topbar global:
  - campo visible `Pregunta algo sobre tu dinero...`;
  - navega a `view=search&q=...`;
  - auto-ejecuta la consulta al entrar a la pantalla;
  - mantiene el valor consultado en el buscador.
- Cuando la busqueda devuelve fuentes de tipo movimiento, la UI ofrece `Ver
  movimientos filtrados` y navega a Movimientos con `movement_q` aplicado.
- La pantalla de Movimientos interpreta `movement_q` con busqueda tolerante por
  tokens utiles, para que consultas naturales como `gastos de cafeteria` no
  fallen por exigir coincidencia exacta de toda la frase.
- `POST /api/v1/search/natural` agrega fallback textual seguro:
  - si el Motor no entiende una consulta read-only pero parece busqueda
    financiera, la degrada a `movement_search`;
  - no aplica a intentos de escritura como registrar, editar, borrar, confirmar
    o descartar.
- El saludo con memoria activa ahora comunica continuidad sin prometer cambios
  financieros: Manzana indica que tiene el hilo reciente a mano y ofrece pedir
  hora, cuenta, origen o detalle de lo anterior.

Archivos principales:

- `src/core/conversation/conversation-router.ts`
- `src/core/conversation/conversation-kernel.ts`
- `src/data/repositories/conversation-memory.repository.ts`
- `src/core/response/response-planner.ts`
- `src/app/api/v1/search/natural/route.ts`
- `src/features/app-shell/app-shell.tsx`
- `src/features/dashboard/dashboard-app.tsx`
- `src/features/movements/movement-view-model.ts`
- `src/features/movements/movements-screen.tsx`
- `src/features/search/natural-search-screen.tsx`
- `src/app/api/v1/search/natural/route.test.ts`
- `src/features/app-shell/app-shell.test.tsx`
- `src/features/movements/movement-view-model.test.ts`
- `src/features/search/natural-search-screen.test.tsx`
- `src/core/conversation/conversation-router.test.ts`
- `src/core/conversation/conversation-kernel.test.ts`

Que quedo mockeado o pendiente:

- No se implemento embeddings ni memoria narrativa profunda; esto sigue siendo
  memoria activa y estructurada V1.
- Falta desplegar y hacer QA real post-deploy en WhatsApp/Dashboard con:
  - `Que movimientos hice hoy`;
  - `Puedes decirme la hora de cada uno?`;
  - `Y de donde salio ese gasto?`;
  - `Cuando fue la ultima vez que pague Netflix?`;
  - `Que gastos hice el dia que fui al medico?`;
  - busqueda desde el topbar global.
- El runtime API debe validarse en staging con consultas conversacionales largas
  para confirmar que respeta las nuevas guias sin inventar.

Pruebas ejecutadas:

- `npm test -- src/features/movements/movement-view-model.test.ts src/app/api/v1/search/natural/route.test.ts src/features/search/natural-search-screen.test.tsx src/features/app-shell/app-shell.test.tsx src/core/conversation/conversation-router.test.ts src/core/conversation/conversation-kernel.test.ts`: OK, 6 archivos y 38 tests pasaron.
- `npm test -- src/core/conversation/conversation-router.test.ts src/core/conversation/conversation-kernel.test.ts src/core/response/response-planner.test.ts src/agents/conversation-agent/conversation-agent.test.ts`: OK, 4 archivos y 60 tests pasaron.
- `npm run typecheck`: OK.
- `npm run lint`: OK, 0 errores y 2 warnings no bloqueantes existentes.
- `npm test`: OK, 70 archivos pasaron, 1 skipped; 369 tests pasaron, 2 skipped.
- `npm run build`: OK.
- `npx vercel deploy --prod --yes`: OK, deployment `dpl_CP1AZCzzANNitmEhrE424iBtq6Wa`, alias `https://manzana.website`.
- Smoke post-deploy:
  - `GET https://manzana.website/api/health`: OK, 200, Supabase `ok`.
  - `HEAD https://manzana.website/empresa`: OK, 200.
  - `HEAD https://manzana.website`: OK, 200.

Capturas/artefactos:

- No aplica captura obligatoria; cambio principal de comportamiento
  conversacional, memoria activa, endpoint read-only y buscador global.
- Se desplego en Vercel produccion del proyecto `manzana-staging` y quedo
  aliasado a `https://manzana.website`.

Deuda tecnica nueva:

- QA real post-deploy del topbar global en desktop/mobile.
- QA real de continuidad en WhatsApp con el numero vinculado.
- Evaluar memoria semantica/narrativa cuando haya volumen real de datos y no
  solo memoria activa de corto plazo.

Siguiente paso:

Desplegar el corte y hacer QA real conversacional. Si pasa, continuar con el
siguiente corte de calidad: elevar `ConversationAgent` API/staging y/o empezar
la memoria semantica de largo plazo, sin romper la regla de que toda accion de
dinero pasa por Core.

---

## Actualizacion 2026-07-16: Corte 22K.7 - Captura Conversacional Sin Parches

Fecha: 2026-07-16.

Corte: corregir la brecha detectada en QA real de WhatsApp donde Manzana podia
entender linguisticamente una captura (`hice un gasto de 20 soles comprando
desayuno`) pero responder como conversacion, o mandar una captura simple a
Pendientes cuando el mensaje si tenia monto y concepto claro. El objetivo no fue
parchar una frase aislada, sino fortalecer la frontera documentada entre captura
financiera, conversacion read-only y confirmacion de pendientes.

Que se implemento:

- `DataAgent` local fixture ahora entiende familias de captura natural:
  - `hice un gasto de 20 soles comprando desayuno`;
  - `registra 20 en desayuno`;
  - `compre desayuno por 20`;
  - `me salio 15 el taxi`;
  - `anota 8 cafe`.
- El fixture diferencia captura real de consulta o hipotesis con monto:
  - `puedo gastar 50 hoy?` no se convierte en movimiento;
  - preguntas, presupuestos, ejemplos y busquedas historicas siguen yendo por
    conversacion read-only o aclaracion.
- `ConversationKernel` reconoce mas variantes naturales de captura y mantiene
  `experience_mode=quick_capture`, con guia explicita para evitar respuestas
  largas cuando la tarea es registrar.
- La resolucion de pendientes por WhatsApp acepta seguimientos seguros como:
  - `registra ese gasto`;
  - `registralo`;
  - `guarda eso`.
- Esas frases solo confirman un pendiente existente; `registra 20 en desayuno`
  sigue pasando como nueva captura a `DataAgent`.
- `OpenAIAgentRuntime` mantiene el mismo contrato en el prompt API del
  `DataAgent`: capturar registros naturales claros, pero no tratar todo monto
  como registro.

Archivos principales:

- `src/agents/data-agent/local-fixture-runtime.ts`
- `src/core/conversation/conversation-kernel.ts`
- `src/core/orchestrator/whatsapp-pending-confirmation.ts`
- `src/agents/runtime/openai-agent-runtime.ts`
- `src/agents/data-agent/data-agent.test.ts`
- `src/core/conversation/conversation-kernel.test.ts`
- `src/core/orchestrator/whatsapp-pending-confirmation.test.ts`
- `src/agents/runtime/openai-agent-runtime.test.ts`
- `src/features/upcoming/upcoming-view-model.test.ts` (estabilizacion temporal
  de test para suite completa)

Que quedo mockeado o pendiente:

- Esto no implementa todavia una memoria de borrador conversacional persistente
  para todos los casos incompletos. Si un turno queda en conversacion sin crear
  pendiente y el usuario luego dice `registralo`, ese caso requiere un corte de
  `capture_draft`/memoria de borrador.
- El `ConversationAgent` API sigue pendiente de QA real si se activa como
  proveedor para conversacion larga.
- Falta deploy y QA real post-deploy en WhatsApp.

Pruebas ejecutadas:

- `npm test -- src/agents/data-agent/data-agent.test.ts src/core/orchestrator/whatsapp-pending-confirmation.test.ts src/core/conversation/conversation-kernel.test.ts src/agents/runtime/openai-agent-runtime.test.ts`: OK, 4 archivos y 33 tests pasaron.
- `npm run typecheck`: OK.
- `npm run lint`: OK, 0 errores y 2 warnings no bloqueantes existentes.
- `npm test`: OK, 70 archivos pasaron, 1 skipped; 377 tests pasaron, 2
  skipped.
- `npm run build`: OK.
- `npx vercel deploy --prod --yes`: OK, deployment
  `https://manzana-staging-i2lwezxnf-marcobernas-projects.vercel.app`,
  alias `https://manzana.website`.
- Smoke post-deploy:
  - `GET https://manzana.website/api/health`: OK, 200, Supabase `ok`.
  - `HEAD https://manzana.website/empresa`: OK, 200.
  - `HEAD https://manzana.website`: OK, 200.

Capturas/artefactos:

- No aplica captura visual; cambio de backend conversacional/captura.

Deuda tecnica nueva:

- Agregar un corte dedicado de `CaptureDraftMemory` si se decide que Manzana
  debe recordar datos extraidos no aplicados aunque no se haya creado pendiente.
- Agregar metricas de `capture_misrouted_to_conversation`,
  `pending_confirmed_by_follow_up` y `question_with_amount_not_captured`.
- El test de `Pagos que vienen` quedo con fecha fija para evitar fallas por el
  paso del tiempo; no cambia comportamiento de producto.

Siguiente paso:

Hacer QA real por WhatsApp con:

1. `Hice un gasto de 20 soles comprando desayuno`.
2. `Registra 20 en desayuno`.
3. `Compre desayuno por 20`.
4. `Me salio 15 el taxi`.
5. `Puedo gastar 50 hoy?`.
6. Crear un pendiente ambiguo y luego responder `registra ese gasto`.

---

## Actualizacion 2026-07-16: Corte 22K.8 - CaptureDraftMemory Conversacional

Fecha: 2026-07-16.

Corte: cerrar la deuda tecnica declarada en 22K.7: cuando Manzana entiende o
intenta entender una captura financiera pero no puede convertirla todavia en
movimiento ni pendiente, debe recordar un borrador temporal seguro. Si el
usuario luego dice `registralo`, `confirma eso`, `descartalo` o una variante,
el sistema no debe responder desde cero ni inventar; debe recuperar el
borrador, volver a pasarlo por `DataAgent`, `PolicyGate`, Core/Pendientes y
responder segun el resultado.

Que se implemento:

- Nuevo `CaptureDraftMemory` sobre `conversation_memory_states` usando scope
  `capture_draft`; no se creo tabla nueva ni migracion.
- TTL de 30 minutos para borradores de captura financiera, evitando que una
  confirmacion tardia registre datos viejos fuera de contexto.
- El borrador guarda solo datos seguros:
  - mensaje original;
  - salida estructurada del `DataAgent`;
  - resumen del plan financiero;
  - `source_ref`;
  - razon de memoria.
- `FinancialOrchestrator` ahora intercepta confirmaciones sin pendiente activo:
  - si existe `capture_draft`, reejecuta el mensaje original por `DataAgent`;
  - si no existe, pide el movimiento completo;
  - si el usuario descarta, cierra el borrador sin tocar saldos.
- El replay no escribe dinero directamente: siempre vuelve a pasar por
  `DataAgent -> DataActionPolicy -> CommandDispatcher/Core` o `Pending Inbox`.
- Cuando el replay crea movimiento o pendiente, el borrador se limpia.
- Cuando la captura sigue bloqueada, el borrador se refresca para permitir un
  siguiente turno.
- `ResponsePlanner` diferencia captura bloqueada de correccion bloqueada:
  Manzana ya no responde "esa correccion necesita revision" cuando el usuario
  estaba intentando registrar un gasto.

Archivos principales:

- `src/core/orchestrator/capture-draft-memory.ts`
- `src/core/orchestrator/financial-orchestrator.ts`
- `src/core/response/response-planner.ts`
- `src/agents/response-agent/types.ts`
- `src/data/repositories/conversation-memory.repository.ts`
- `src/core/orchestrator/capture-draft-memory.test.ts`
- `src/core/response/response-planner.test.ts`

Que quedo mockeado o pendiente:

- Falta deploy y QA real por WhatsApp.
- El borrador es memoria activa de corto plazo, no memoria semantica de largo
  plazo.
- No cambia el limite de calidad de `ConversationAgent`; mejora la continuidad
  de captura financiera, no reemplaza la conversacion profunda.

Pruebas ejecutadas:

- `npm run typecheck`: OK.
- `npx vitest run src/core/orchestrator/capture-draft-memory.test.ts src/core/response/response-planner.test.ts`: OK, 2 archivos y 30 tests pasaron.
- `npm test`: OK, 71 archivos pasaron, 1 skipped; 383 tests pasaron, 2
  skipped.
- `npm run lint`: OK, 0 errores y 2 warnings no bloqueantes existentes.
- `npm run build`: OK.
- `npx vercel deploy --prod --yes`: OK, deployment
  `https://manzana-staging-qlmkynh41-marcobernas-projects.vercel.app`,
  alias `https://manzana.website`.
- Smoke post-deploy:
  - `GET https://manzana.website/api/health`: OK, 200.
  - `HEAD https://manzana.website/empresa`: OK, 200.

Capturas/artefactos:

- No aplica captura visual; cambio de backend conversacional/captura.

Deuda tecnica nueva:

- Hacer QA real en WhatsApp con un caso donde `DataAgent` entienda una captura
  pero no ejecute, y luego responder `registralo`.
- Agregar metrica operacional `capture_draft_replayed` y alerta si muchos
  replays terminan sin accion.
- Evaluar si `capture_draft` debe exponerse en una vista interna de debug
  durante staging.

Siguiente paso:

Ejecutar verificacion completa, desplegar y hacer QA real por WhatsApp:

1. `Hice un gasto de 20 soles comprando desayuno`.
2. Si Manzana pide dato o queda bloqueado, responder `registralo`.
3. Repetir con `descartalo`.
4. Confirmar que ningun pendiente ni borrador viejo toca saldos sin Core.

---

## Actualizacion 2026-07-16: Corte 22K.9 - Descarte Contextual Tras Registro Directo

Fecha: 2026-07-16.

Corte: correccion post-QA real de WhatsApp para el caso:

```text
Usuario: Hice un gasto de 20 soles comprando desayuno
Manzana: Listo. Desayuno por S/20.00 registrado.
Usuario: Descartalo
Manzana anterior: No encontre algo reciente para descartar. Nada se cambio.
```

Diagnostico:

- La captura directa ya habia creado un movimiento confirmado por Core.
- `descartalo` entraba primero al flujo de pendientes.
- Como no habia pendiente ni `capture_draft` activo, el sistema respondia que no
  habia nada para descartar.
- Segun `16_confianza_errores.md`, si ya existe dato persistido, cancelar o
  descartar debe derivar a correccion/deshacer/borrar con confirmacion segura.

Que se implemento:

- `CorrectionAgent` ahora reconoce lenguaje corto de WhatsApp como posible
  correccion segura:
  - `descartalo`;
  - `deshaz eso`;
  - `olvidalo`;
  - variantes de borrar, cancelar, quitar, anular y eliminar.
- Si no hay pendiente ni borrador activo, `FinancialOrchestrator` ya no corta el
  flujo con "no encontre algo reciente"; permite que `CorrectionAgent` proponga
  eliminar el ultimo movimiento reciente.
- El borrado no es automatico: se mantiene confirmacion explicita via botones
  `Si, eliminar` / `No cambiar`, porque borrar movimiento confirmado afecta
  dinero e historial.
- La eliminacion confirmada sigue pasando por `CommandDispatcher` y Core con
  `DeleteMovementCommand`, audit log y recalculo de saldos.

Archivos principales:

- `src/agents/correction-agent/correction-agent.ts`
- `src/agents/correction-agent/correction-agent.test.ts`
- `src/core/orchestrator/financial-orchestrator.ts`
- `src/core/orchestrator/financial-orchestrator-routing.test.ts`

Pruebas ejecutadas:

- `npx vitest run src/core/orchestrator/financial-orchestrator-routing.test.ts src/agents/correction-agent/correction-agent.test.ts src/core/orchestrator/whatsapp-pending-confirmation.test.ts src/core/orchestrator/capture-draft-memory.test.ts src/core/response/response-planner.test.ts`: OK, 5 archivos y 48 tests pasaron.
- `npm run typecheck`: OK.
- `npm test`: OK, 72 archivos pasaron y 1 skipped; 388 tests pasaron y 2
  skipped.
- `npm run lint`: OK, 0 errores y 2 warnings existentes no bloqueantes.
- `npm run build`: OK.
- `npx vercel deploy --prod --yes`: OK, deployment
  `https://manzana-staging-nn9q74d43-marcobernas-projects.vercel.app`,
  alias `https://manzana.website`.
- Smoke post-deploy:
  - `GET https://manzana.website/api/health`: OK, 200.
  - `HEAD https://manzana.website/empresa`: OK, 200.

Pendiente:

- QA real:
  1. Registrar `Hice un gasto de 20 soles comprando desayuno`.
  2. Responder `descartalo`.
  3. Confirmar que Manzana pide confirmacion para eliminar el movimiento
     reciente, en vez de decir que no encontro nada.
  4. Pulsar `Si, eliminar` y verificar que el movimiento quede eliminado/anulado
     por Core.

---

## Actualizacion 2026-07-16: Corte 22K.10 - Orchestration Planning Agent Y Flujos Mixtos

Fecha: 2026-07-16.

Corte: incorporar el planificador agentic definido en `05b_motor_ia.md` sin
convertirlo en una via alternativa de escritura financiera. El objetivo es que
un turno completo pueda ser entendido como una intencion o flujo mixto, por
ejemplo `Registre S/20 en desayuno, como voy esta semana?`, sin obligar al
usuario a hablar con comandos aislados ni precargar una respuesta fija por cada
frase posible.

Que se implemento:

- Nuevo `OrchestrationPlanningAgent` con contrato estructurado
  `OrchestrationPlan`:
  - propone objetivo, workflow, pasos, agentes, tools autorizadas, estrategia
    de respuesta, nivel de confianza y banderas de riesgo;
  - recibe un `OrchestrationContextPack` compacto y un catalogo completo de
    capacidades permitidas;
  - conoce el flujo, pero no recibe secretos, SQL, historial crudo completo ni
    permisos para escribir directamente en Core o Supabase.
- `FinancialOrchestrator` invoca al planificador antes de decidir la ruta final
  del turno y conserva fallback deterministico si el runtime falla.
- Nuevo compilador de plan:
  - cumple el rol operativo de `WorkflowPlanner` y `AgentPlanner` en V1;
  - valida la ruta, descarta pasos no autorizados y limita las tools read-only
    seleccionadas;
  - no permite que un plan del modelo omita `PolicyGate`,
    `CommandDispatcher` o Core para acciones de dinero.
- `ToolGateway` acepta el conjunto exacto de tools read-only que el plan
  autorizo. El agente planifica consultas sobre movimientos, dinero,
  pendientes, deudas, pagos que vienen y memoria; el gateway ejecuta solo el
  subconjunto permitido.
- Se implemento el primer flujo mixto real:
  1. `DataAgent` propone la captura;
  2. politicas y Core confirman la accion financiera;
  3. solo despues, `ToolGateway` consulta los hechos que el plan selecciono;
  4. `ConversationAgent` responde la pregunta adicional con esos hechos;
  5. `ResponsePlanner` une confirmacion y respuesta sin perder la certeza del
     resultado de Core.
- Si la captura queda en Pendientes, el sistema no afirma que el gasto se haya
  registrado ni ejecuta la consulta como si el saldo ya hubiera cambiado.
- Se agregaron trazas seguras de provider/modelo/latencia, plan compilado,
  tools seleccionadas, pasos rechazados y resultado de conversacion mixta.
- Se agrego el provider por entorno
  `AGENT_RUNTIME_ORCHESTRATION_PLANNING_AGENT_PROVIDER`. En Production queda
  preparado para `api` con fallback local controlado.

Arquitectura resultante:

```text
Entrada WhatsApp
  -> ConversationKernel + memoria activa
  -> OrchestrationPlanningAgent propone ExecutionPlan
  -> WorkflowPlanner/AgentPlanner V1 compilan y vetan el plan
  -> DataAgent / ConversationAgent / CorrectionAgent segun ruta
  -> PolicyGate
  -> CommandDispatcher + Core (solo si hay accion financiera)
  -> ToolGateway read-only (si el plan lo necesita)
  -> ResponsePlanner + canal
```

Archivos principales:

- `src/agents/orchestration-planning-agent/types.ts`
- `src/agents/orchestration-planning-agent/orchestration-planning-agent.ts`
- `src/agents/orchestration-planning-agent/local-fixture-runtime.ts`
- `src/core/orchestrator/orchestration-plan.ts`
- `src/core/orchestrator/financial-orchestrator.ts`
- `src/core/conversation/tool-gateway.ts`
- `src/agents/runtime/openai-agent-runtime.ts`
- `src/agents/runtime/config.ts`
- `src/agents/runtime/types.ts`
- `src/core/response/response-planner.ts`
- `.env.local.example`

Que quedo mockeado o pendiente:

- El planificador ya selecciona tools y el gateway las ejecuta de forma
  controlada; aun no es un ciclo autonomo de `function_call` nativo donde el
  modelo itera tools hasta decidir que termino. Ese corte debe conservar los
  mismos limites de `ToolGateway`.
- `ConversationAgent` conserva su contrato y tools read-only, pero falta
  activarlo y hacer QA real por API para conversaciones largas y cambios de
  tema semanticos.
- `CorrectionAgent` todavia no es un agente semantico API: las correcciones
  complejas, referencias ambiguas y deshacer contextual necesitan su corte
  especializado con confirmacion segura.
- La memoria actual es continuidad, preferencias, aliases, personas y
  correcciones estructuradas V1; falta memoria semantica/narrativa profunda y
  Learning Engine con evidencias suficientes.
- `ResponseAgent` API ya existe, pero la experiencia personalizada profunda no
  esta cerrada. En respuesta mixta se preserva la respuesta factica del
  `ConversationAgent` para no degradar una cifra confirmada con reescritura.
- Falta corpus de evaluacion conversacional y metricas de silencios, cambios de
  tema, aclaraciones utiles, tools fallidas y correcciones exitosas.

Pruebas ejecutadas:

- `npx vitest run src/core/response/response-planner.test.ts src/core/orchestrator/orchestration-plan.test.ts src/agents/orchestration-planning-agent/local-fixture-runtime.test.ts`: OK, 3 archivos y 33 tests pasaron.
- `npm run typecheck`: OK.
- `npm run lint`: OK, 0 errores y 2 warnings no bloqueantes existentes.
- `npm test`: OK, 74 archivos pasaron, 1 skipped; 395 tests pasaron, 2 skipped.
- `npm run build`: OK.
- `npx vercel deploy --prod --yes`: OK, deployment
  `https://manzana-staging-bhvhpvcd8-marcobernas-projects.vercel.app`, alias
  `https://manzana.website`.
- Smoke post-deploy:
  - `GET https://manzana.website/api/health`: OK, 200.
  - `GET https://manzana.website/empresa`: OK, 200.

Capturas/artefactos:

- No aplica captura visual; cambio principal de planificacion, orquestacion y
  contratos de agentes.

Deuda tecnica nueva:

- Medir costo, latencia, calidad y porcentaje de fallback del
  `OrchestrationPlanningAgent` antes de ampliarlo a mas rutas.
- Construir el ciclo de tool calling semantico para `ConversationAgent` sin
  concederle herramientas de escritura.
- Implementar `CorrectionAgent` semantico antes de prometer correcciones
  naturales completas por WhatsApp.
- Crear corpus versionado de conversaciones reales/anomalias y evaluacion de
  regresion por escenario.

Siguiente paso:

Desplegar y hacer QA real por WhatsApp:

1. `Registre S/17 en desayuno, como voy esta semana?`.
2. Confirmar que primero se registra por Core y luego responde con datos reales
   del periodo, o que si queda pendiente no promete saldo actualizado.
3. `Que movimientos hice hoy?` y luego `Puedes decirme la hora de cada uno?`.
4. `Descarta el ultimo gasto` para comprobar que una correccion aun sigue su
   ruta segura y que no se vende como correccion semantica terminada.

---

## 2026-07-16 - Cierre De Capa Conversacional Agentic V1

Fecha: 16 de julio de 2026.

Corte: cerrar la capa conversacional documentada sin convertir WhatsApp en un
router de frases ni conceder escrituras directas a los agentes.

Que se implemento:

- `OrchestrationPlanningAgent` interpreta semanticamente objetivos simples,
  correcciones, consultas, continuidad e intenciones mixtas antes de compilar
  el flujo.
- `compileOrchestrationPlan` trata el plan del modelo como no confiable:
  descarta pasos incompatibles y fuerza confirmacion en toda correccion aunque
  el modelo omita la bandera.
- `ConversationAgent` usa un ciclo iterativo real de function calling sobre
  tools read-only: movimientos, dinero libre, pendientes, deudas, pagos que
  vienen y memoria financiera.
- `CorrectionAgent` resuelve referencias contra candidatos acotados y propone
  corregir, eliminar, deshacer o reclasificar. Nunca aplica el cambio; toda
  accion pasa por PolicyGate, confirmacion y Core.
- Se incorporo `ConversationWorkingSet` persistente para referencias como
  `ese`, `el ultimo`, `hazlo`, resultados anteriores, acciones pendientes y
  cambios de tema.
- Se creo `financial_memory_items` y `FinancialMemoryRepository` para aliases,
  personas frecuentes, preferencias y correcciones confirmadas consultables.
- `LearningEngine` aprende solo de correcciones confirmadas con evidencia y
  deja la memoria reversible/auditable; no consolida inferencias aisladas.
- `ResponseAgent` recibe un `ResponseContextPack` experiencial con continuidad,
  estado emocional probable, tono, objetivo y hechos obligatorios. El
  validador rechaza omisiones e invenciones de montos, codigos y links.
- Se creo un corpus versionado de 200 mensajes en 20 familias semanticas. El
  fallback deterministico se evalua por seguridad; la comprension se evalua
  contra el provider API real.
- El planner usa presupuesto configurable
  `AGENT_RUNTIME_ORCHESTRATION_PLANNING_AGENT_TIMEOUT_MS`, default 15 segundos,
  y reporta `RUNTIME_TIMEOUT` en vez de un error generico.
- Production tiene activados por agente `DataAgent`, `ResponseAgent`,
  `ConversationAgent`, `CorrectionAgent` y `OrchestrationPlanningAgent` sobre
  el provider API; `local_fixture` queda solo como fallback degradado trazable.

Archivos principales:

- `src/agents/orchestration-planning-agent/`
- `src/agents/conversation-agent/`
- `src/agents/correction-agent/`
- `src/agents/response-agent/`
- `src/agents/evals/conversation-eval-corpus.v1.ts`
- `src/agents/evals/conversation-eval-corpus.test.ts`
- `src/agents/evals/conversation-eval.api-smoke.test.ts`
- `src/agents/runtime/openai-agent-runtime.ts`
- `src/core/orchestrator/financial-orchestrator.ts`
- `src/core/orchestrator/orchestration-plan.ts`
- `src/core/conversation/`
- `src/core/learning/learning-engine.ts`
- `src/core/response/response-agent-enhancer.ts`
- `src/data/repositories/financial-memory.repository.ts`
- `supabase/migrations/024_financial_memory_learning.sql`

Que quedo mockeado o pendiente:

- No queda mock para la ruta API semantica central. El fallback local sigue
  existiendo deliberadamente como modo degradado seguro, no como benchmark de
  comprension humana.
- Falta QA humano final por WhatsApp para observar tono, continuidad y latencia
  extremo a extremo con la cuenta real.
- Memoria narrativa de largo plazo e insights conversacionales creceran con
  evidencia de uso; no se inventan antes de tener datos confirmados.

Pruebas ejecutadas:

- `npm run typecheck`: OK.
- `npm run lint`: OK, 0 errores y 2 warnings no bloqueantes.
- `npm test`: OK, 77 archivos pasaron, 2 skipped; 410 tests pasaron, 3 skipped.
- Corpus estructural: OK, exactamente 200 casos unicos en 20 familias.
- Eval API estratificado: OK, 20/20 llamadas completadas, umbral semantico
  `>= 80%` cumplido y 0 violaciones de seguridad despues del compilador.
- `npm run build`: OK con Next.js 16.2.7.
- `npx supabase db push`: OK; migracion `024` aplicada al proyecto remoto.
- `npx vercel deploy --prod --yes`: OK; deployment
  `https://manzana-staging-l87pxbwoy-marcobernas-projects.vercel.app`, alias
  `https://manzana.website`.
- `GET https://manzana.website/api/health`: 200, Supabase OK.
- `GET https://manzana.website/empresa`: 200.

Capturas/artefactos:

- No aplica captura visual; el corte modifica contratos de agentes,
  orquestacion, memoria, seguridad y evaluacion.

Deuda tecnica nueva:

- Persistir dashboards de costo, p50/p95, timeouts, fallback y calidad por
  agente cuando exista volumen real.
- Automatizar el eval API en un entorno controlado con presupuesto y clave de
  CI; no ejecutarlo en cada test local ordinario.

Siguiente paso:

QA humano por WhatsApp con una conversacion continua, no comandos aislados:

1. `Hice un gasto de 20 soles comprando desayuno`.
2. `En realidad fueron 18` y confirmar la correccion propuesta.
3. `Que movimientos hice hoy?` seguido de `y a que hora fue cada uno?`.
4. `Registre 15 en taxi, como voy esta semana?`.
5. `No, eso no era gasto; fue prestamo a Luis` y revisar confirmacion.
6. Cambiar de tema a dinero libre y volver a referirse al movimiento anterior.

---

## 2026-07-17 - Hardening Conversacional Y Prueba Agentic Integral

Fecha: 17 de julio de 2026.

Corte: eliminar rutas silenciosas y probar el flujo conversacional completo con
OpenAI API real, sin ejecutar escrituras financieras desde los agentes.

Que se implemento:

- El Orchestrator ya no exige patrones interrogativos para enviar a
  `ConversationAgent` un turno semantico sin acciones financieras. Cuando el
  plan compilado existe, es la autoridad; `DataAgent` y el kernel solo cubren el
  fallback degradado cuando el planner no esta disponible.
- Una captura financiera reconocida pero sin accion estructurada recibe una
  aclaracion segura; no termina en `no_response` ni inventa un movimiento.
- Los presupuestos de runtime quedaron configurables por agente, entre 1 y 30
  segundos: DataAgent 10 s, ResponseAgent 10 s, CorrectionAgent 15 s,
  OrchestrationPlanningAgent 15 s y ConversationAgent 20 s.
- Se agrego un smoke agentic con API real que valida en un mismo recorrido:
  consulta con tool calling, continuidad por working set, seguimiento de horas,
  intencion mixta de registro mas consulta y correccion semantica con
  confirmacion obligatoria.
- El contrato temporal de `DataAgent` ya no permite inventar `occurred_at`: si
  el usuario no expresa fecha u hora, devuelve `null`; si la expresa, debe
  resolverla con zona horaria y offset RFC3339 explicito.
- La referencia conversacional creada despues de ejecutar una accion conserva
  el `occurred_at` confirmado por Core. Esto evita que el resultado de escritura
  reemplace en memoria una referencia mas rica por otra sin hora.
- Se agrego un E2E de produccion que entra por el webhook firmado de Kapso,
  procesa outbox real y recorre apertura, consulta vacia, intencion mixta,
  seguimiento contextual, correccion, confirmacion y cambio de tema.
- Las trazas distinguen ahora las herramientas declaradas en el output del
  agente de las llamadas que el runtime ejecuto realmente. Esto permite auditar
  tool calling sin confiar solo en el texto estructurado del modelo.
- Se elimino el clasificador literal residual que podia competir con el
  planificador semantico.
- El orquestador conserva el plan bruto del `OrchestrationPlanningAgent` y
  compila un plan efectivo despues de recibir evidencia de `DataAgent`. Si el
  agente detecta una accion y el turno tambien exige una consulta read-only, el
  workflow efectivo se reconcilia a `mixed` y garantiza Core antes de la
  consulta y la respuesta.
- `ToolGateway` resuelve referencias activas originadas tanto por una consulta
  como por una captura confirmada. La continuidad depende del estado semantico
  del turno y no de que el usuario repita palabras o una clase fija de pregunta.
- Las ambiguedades de `DataAgent` quedaron acotadas por `scope` y `action_id`.
  Una duda sobre el resumen conversacional ya no contamina una accion clara del
  mismo turno, y una cuenta omitida en un gasto simple puede permanecer `null`
  sin forzar por si sola la creacion de un pendiente.

Archivos principales:

- `src/core/orchestrator/financial-orchestrator.ts`
- `src/core/orchestrator/orchestration-plan.ts`
- `src/core/orchestrator/data-action-policy.ts`
- `src/core/conversation/tool-gateway.ts`
- `src/core/response/response-planner.ts`
- `src/agents/data-agent/data-agent.ts`
- `src/agents/conversation-agent/conversation-agent.ts`
- `src/agents/correction-agent/correction-agent.ts`
- `src/agents/response-agent/response-agent.ts`
- `src/agents/evals/conversation-agentic-flow.api-smoke.test.ts`
- `src/agents/runtime/openai-agent-runtime.ts`
- `src/core/orchestrator/data-action-executor.ts`
- `scripts/smoke-whatsapp-conversation-e2e.mjs`
- `.env.local.example`
- `docs/fase_4_tecnica/19_agent_runtime_tools.md`

Que quedo mockeado o pendiente:

- No queda mock en el smoke semantico: planner, DataAgent, ConversationAgent y
  CorrectionAgent usaron el provider API real. Los resultados de tools son un
  fixture read-only deliberado para probar razonamiento sin mutar Core.
- El E2E de produccion usa un numero reservado inexistente para no contactar a
  una persona real. Por eso valida hasta el plan de envio y outbox, pero el
  proveedor rechaza la entrega final de forma esperada. La entrega al numero
  real ya cuenta con QA separado previo.
- Quedan como validacion operativa, no como implementacion faltante, una sesion
  humana de calidad de tono por WhatsApp y metricas con volumen real.

Pruebas ejecutadas:

- `npm run typecheck`: OK.
- Smoke agentic API real: OK, continuidad, tools, turno mixto y correccion.
  Tambien verifico que el runtime llamo realmente `query_movements` en la
  consulta inicial y en el seguimiento contextual.
- `npm run smoke:whatsapp:conversation-e2e`: OK tres veces consecutivas contra
  `https://manzana.website`, runs
  `57384211-bb94-44a7-aa6c-54bbccd6714d`,
  `5d769f94-ac9d-4193-ac9b-5ff29e74f413` y
  `22a20bd1-c803-491c-8d10-a479a4bc152b`. Cada ejecucion probo siete turnos
  continuos, memoria activa, planificacion API, tool calling, plan mixto
  reconciliado, Core antes de la respuesta y correccion aplicada solo despues
  de confirmar.
- Durante el hardening, ejecuciones intermedias detectaron dos fallos reales:
  plan bruto `query` ante una intencion mixta y ambiguedades conversacionales
  aplicadas globalmente a la accion. Ambos quedaron corregidos y cubiertos por
  pruebas de regresion antes de las tres ejecuciones consecutivas finales.
- Suite completa serial: OK, 78 archivos y 422 tests; 3 archivos/4 tests API
  opt-in omitidos en la corrida ordinaria.
- `npm run lint`: OK, 0 errores y 2 warnings preexistentes no bloqueantes.
- `npm run build`: OK con Next.js 16.2.7.
- Deployment production:
  `dpl_Gwg7Fbmeo5Q3a1oU77FkPXEXJBHF`, inspector
  `https://vercel.com/marcobernas-projects/manzana-staging/Gwg7Fbmeo5Q3a1oU77FkPXEXJBHF`,
  URL `https://manzana-staging-dgbmziwpx-marcobernas-projects.vercel.app` y
  alias `https://manzana.website`.
- `GET https://manzana.website/api/health`: 200, Supabase OK, verificado el 17
  de julio de 2026.
- Smoke de trazas production: 0 blockers; las advertencias corresponden a
  eventos historicos anteriores a la activacion API completa.

Capturas/artefactos:

- No aplica captura visual; el corte modifica orquestacion, runtime y pruebas
  conversacionales.

Deuda tecnica nueva:

- Incorporar p50/p95, timeout, fallback, costo y outcome por agente cuando haya
  suficiente volumen real.
- Ejecutar el smoke agentic API en CI controlado, con secreto y presupuesto,
  no en cada suite local.

Siguiente paso:

La implementacion tecnica central de la capa conversacional queda cerrada para
este corte. Ejecutar QA humano cualitativo con el numero real para evaluar tono,
naturalidad y utilidad percibida, y observar p50/p95, fallback, costo y outcomes
con volumen. Esas validaciones pueden afinar la experiencia, pero ya no ocultan
una ruta tecnica faltante del flujo conversacional probado.

---

## 2026-07-17 - Autoridad Semantica Y Estado Conversacional Operativo

Fecha: 17 de julio de 2026.

Corte: eliminar la interpretacion por frases conocidas como ruta principal y
convertir el plan semantico, el estado de trabajo y la evidencia de herramientas
en la base de la continuidad conversacional.

Problemas expuestos por el QA humano:

- una instruccion libre de estilo se aplicaba solo a una respuesta;
- una pregunta como `Ayer tuve movimientos?` podia no ejecutar la consulta;
- una confirmacion posterior podia producir una promesa de trabajo futuro sin
  herramienta, job o workflow que la respaldara;
- las referencias a un pendiente, un borrador de captura y un movimiento ya
  confirmado podian competir entre si;
- `DataAgent` o el kernel deterministico podian desviar un plan semantico valido.

Que se implemento:

- `OrchestrationPlanningAgent` es la autoridad de intencion para todo texto
  libre cuando entrega un plan valido. `DataAgent`, el kernel y los
  clasificadores deterministas solo participan como fallback degradado si el
  planner no esta disponible o su salida es rechazada por contrato.
- El contrato del planner incluye una resolucion financiera tipada para listar,
  confirmar o descartar un pendiente o un borrador. El modelo interpreta la
  referencia y el Core valida el objetivo exacto antes de cualquier cambio.
- El context pack entrega solo resúmenes seguros del borrador activo y de los
  candidatos pendientes. No expone acceso de escritura ni transfiere la
  decision financiera al agente.
- Los botones, IDs de protocolo y codigos `P-XXXXXXXX` siguen siendo
  deterministas. No se agregaron listas de frases como sustituto de comprension
  semantica.
- El estilo conversacional se representa como instruccion libre, no como un
  enum de tonos. Puede tener alcance de turno, sesion o preferencia persistente
  y nunca altera hechos, permisos ni reglas financieras.
- El working set conserva consulta activa, rango temporal normalizado, borrador,
  candidatos pendientes, referencias y operacion read-only. Una respuesta como
  `si` puede continuar una operacion real en lugar de prometer que se ejecutara
  despues.
- Las fechas relativas se resuelven respecto de `received_at` y
  `America/Lima`; sus limites UTC se validan sin perder la fecha local.
- `ConversationAgent` tiene una regla explicita contra promesas fantasma y una
  comprobacion de grounding: no puede afirmar que consulto o cambiara algo sin
  evidencia de tool, job o workflow.
- Se ampliaron las evaluaciones multivuelta con variaciones semanticas, no con
  coincidencias de una frase exacta: fechas relativas, estilo libre, pendientes,
  borradores y continuidad por herramientas.

Archivos principales:

- `src/agents/orchestration-planning-agent/types.ts`
- `src/agents/runtime/openai-agent-runtime.ts`
- `src/core/orchestrator/orchestration-plan.ts`
- `src/core/orchestrator/financial-orchestrator.ts`
- `src/core/orchestrator/whatsapp-pending-confirmation.ts`
- `src/core/conversation/conversation-memory.ts`
- `src/core/conversation/tool-gateway.ts`
- `src/agents/evals/conversation-agentic-flow.api-smoke.test.ts`
- `src/core/orchestrator/financial-orchestrator-routing.test.ts`
- `docs/fase_2_estrategia/alcance_v1/05b_motor_ia.md`
- `docs/fase_3_producto/11_personalidad_conversacion.md`
- `docs/fase_4_tecnica/19_agent_runtime_tools.md`

Que quedo mockeado o pendiente:

- La evaluacion agentic invoca OpenAI API real; solo los resultados financieros
  read-only usan fixtures controlados para no mutar Core durante el test.
- El codigo, la documentacion y el recorrido tecnico de produccion estan
  cerrados para el corte. Falta repetir el QA cualitativo en el numero real.
- El E2E usa un numero reservado inexistente: valida el plan de envio y el
  outbox sin contactar a una persona, por lo que el proveedor rechaza solo la
  entrega final de forma esperada.
- Las metricas historicas de p50/p95, costo, fallback y outcome necesitan
  volumen real y no se sustituyen con pruebas de laboratorio.

Pruebas ejecutadas:

- `npm run typecheck`: OK.
- Pruebas unitarias dirigidas: 5 archivos, 33 tests, OK.
- Smoke agentic con OpenAI API real: 2 tests, OK.
- Suite completa: 78 archivos pasaron y 3 se omitieron; 433 tests pasaron y 5
  se omitieron, 438 en total.
- `npm run lint`: 0 errores y 2 warnings preexistentes no bloqueantes.
- `npm run build`: OK con Next.js 16.2.7.
- Deployment production: `dpl_43txnr3boE4DYnmv1uhckJzCU3m3`, URL
  `https://manzana-staging-j5h8uq73t-marcobernas-projects.vercel.app`, alias
  `https://manzana.website`.
- `GET https://manzana.website/api/health`: 200, entorno staging y Supabase OK.
- `npm run smoke:whatsapp:conversation-e2e`: OK contra produccion, run
  `82b45de8-9b0f-48ab-8eee-23423bc82d28`; siete turnos, planner API,
  tool calling, intencion mixta, Core, referencia activa, correccion con
  confirmacion y cambio de tema. Ningun turno accionable quedo silencioso.

Capturas/artefactos:

- Captura de QA humano del 17 de julio: instruccion de estilo, consulta relativa
  a ayer y confirmacion posterior que revelaron la brecha de continuidad.

Deuda tecnica nueva:

- Medir la calidad por conversaciones completas: silencios, tool calls
  correctos, clarificaciones utiles, acciones equivocadas, persistencia de
  estilo y promesas sin ejecucion.
- Ampliar el corpus con lenguaje peruano y cambios de tema sin convertirlo en
  un catalogo de frases de produccion.

Siguiente paso:

Ejecutar un QA humano multivuelta por WhatsApp que compruebe estilo libre,
consulta temporal, continuacion, borrador, pendiente y correccion sobre la misma
conversacion. Despues, observar calidad y latencia con volumen real.

---

## 2026-07-18 - Consultas Historicas Sin Falsos Vacios

Fecha: 2026-07-18

Corte: correccion de autoridad semantica en consultas historicas de movimientos.

Que se implemento:

- Se reprodujo un fallo observado en WhatsApp: el planner resolvia correctamente
  `ayer`, `antes de ayer` y `14 de julio`, pero la respuesta afirmaba que no
  habia movimientos aunque el Dashboard mostraba registros confirmados.
- La causa no estaba en la interpretacion de fechas ni en Supabase. Despues de
  consultar el rango correcto, `ToolGateway` volvia a tokenizar el texto libre y
  trataba palabras temporales como `antes` o `julio` como filtros de comercio o
  descripcion, eliminando filas validas.
- Se separo el contrato de consulta en dos dimensiones explicitas:
  `date_range` responde cuando buscar y `movement_filters` responde que
  subconjunto financiero buscar.
- Una consulta solo temporal produce filtros semanticos vacios y devuelve todos
  los movimientos confirmados del rango. Una consulta como `taxi del 14` separa
  el rango del filtro `taxi` sin inferir filtros desde conectores temporales.
- `ToolGateway` respeta el plan semantico tipado y ya no retokeniza el mensaje
  original cuando ese plan existe. El parser textual anterior queda unicamente
  como fallback degradado cuando no hubo una consulta semantica valida.
- La correccion es estructural; no agrega excepciones para frases concretas ni
  amplia una lista de stop words.
- El primer smoke posterior al despliegue descubrio otra contradiccion de plan:
  un turno `help` podia pedir aclaracion pero compilarse a `support`, una ruta
  que no ejecutaba ConversationAgent y terminaba sin respuesta. El compilador
  ahora enruta `help` y `review` read-only a ConversationAgent; las rutas de
  escritura financiera y la autoridad de Core no cambiaron.

Archivos principales:

- `src/agents/conversation-agent/types.ts`
- `src/agents/runtime/openai-agent-runtime.ts`
- `src/core/orchestrator/orchestration-plan.ts`
- `src/core/conversation/tool-gateway.ts`
- `src/core/conversation/tool-gateway.test.ts`
- `src/core/orchestrator/orchestration-plan.test.ts`
- `src/agents/runtime/openai-agent-runtime.test.ts`
- `src/agents/evals/conversation-agentic-flow.api-smoke.test.ts`
- `docs/fase_2_estrategia/alcance_v1/05b_motor_ia.md`
- `docs/fase_4_tecnica/19_agent_runtime_tools.md`

Que quedo mockeado:

- Las regresiones de filtrado usan movimientos controlados para probar la
  frontera semantica sin depender de datos personales de produccion.
- El smoke del planner usa OpenAI API real; las herramientas financieras siguen
  controladas para no modificar Core durante esa evaluacion.
- Queda pendiente repetir por WhatsApp real las fechas que revelaron el fallo.

Pruebas ejecutadas:

- `npm run typecheck`: OK.
- Pruebas dirigidas: 3 archivos, 25 tests, OK.
- Smoke agentic con OpenAI API real: 2 tests, OK; incluye `Y el 14 de julio?`
  con rango correcto y filtros financieros vacios.
- Suite completa final: 78 archivos pasaron y 3 se omitieron; 438 tests pasaron
  y 5 se omitieron, 443 en total.
- `npm run lint`: 0 errores y 2 warnings preexistentes no bloqueantes.
- `npm run build`: OK con Next.js 16.2.7.
- Deployment final: `dpl_H3aEYhUzzadcY8mtu1qrKcGM7gV7`, URL
  `https://manzana-staging-iv6basjd6-marcobernas-projects.vercel.app`, alias
  `https://manzana.website`.
- `GET https://manzana.website/api/health`: 200, entorno staging y Supabase OK.
- Primer E2E post-deploy: fallo correctamente al detectar un turno de ayuda sin
  respuesta; no se acepto como cierre.
- E2E final `npm run smoke:whatsapp:conversation-e2e`: OK contra produccion, run
  `1c70ac84-5881-4815-9e03-2d7b344a2309`; siete turnos y la invariancia
  `no_silent_actionable_turns=true`.

Capturas/artefactos:

- Captura de WhatsApp con respuestas vacias para 16 y 14 de julio.
- Captura del Dashboard con movimientos confirmados en ambas fechas.

Deuda tecnica nueva:

- Incorporar estas consultas historicas al corpus continuo de evaluacion
  conversacional y medir falsos vacios por rango, filtro y zona horaria.

Siguiente paso:

Desplegar el corte, ejecutar el smoke tecnico de produccion y repetir en el
numero real: `Que movimientos hice el 16 de julio?`, `Y el 14?` y `Que gastos de
taxi hice el 14?`.

---

## Actualizacion 2026-07-19: Corte 23 - Motores Hibridos De Calidad

Estado: implementado, desplegado y verificado en staging. La activacion
proactiva permanece controladamente apagada.

Corte:

Convertir Learning, Dedup, Risk, Disclosure, Recurrentes, Descubrimientos,
Nudges y Orquestacion en subsistemas hibridos controlados. La IA interpreta,
enriquece o adapta experiencia; las reglas deterministas conservan la autoridad
sobre dinero, identidad, consentimiento, evidencia, duplicados exactos y
ejecucion.

Que se implemento:

- `LearningSignalAgent` propone candidatos semanticos; `LearningPolicyGate`
  exige evidencia confirmada, limita alcance y decide que memoria se acepta.
- `DedupSignalAgent` interviene solo en la zona incierta. El prefilter, scoring,
  umbral de duplicado exacto y reconciliacion de pendientes email contra
  movimientos confirmados siguen siendo deterministas y auditables.
- `RiskSignalAgent` puede elevar riesgo o recomendar cautela, pero
  `RiskPolicy` y `SystemActionGate` tienen la decision final para lecturas,
  acciones de sistema, salidas proactivas y feedback de experiencia.
- `DisclosureEngine` calcula hechos seguros por canal y modo discreto;
  `DisclosureExperienceAgent` solo adapta el framing de esos hechos. El
  `OutputGuard` impide que el agente recupere detalle retirado.
- `RecurringSignalAgent` mejora nombre visible, explicacion y sensibilidad de
  candidatos ya detectados. No puede modificar monto, frecuencia, fechas ni
  activar una regla sin confirmacion.
- `NudgeExperienceAgent` redacta despues de `NudgePolicy`, Risk y Disclosure.
  El worker multicanal revalida la fuente, opt-in, pausas, quiet hours,
  frecuencia y ventana de WhatsApp antes de planificar o enviar.
- `InsightEngine` calcula señales avanzadas trazables, incluidas proyeccion
  cautelosa y contexto por tags. `InsightExperienceAgent` e
  `InsightNarratorAgent` reciben hechos bloqueados y no recalculan dinero.
- Lifecycle de insights con expiracion por tipo, `outdated`, historial de
  entregas, supresion/penalizacion por feedback y endpoints de seen, dismiss,
  action y evidence. La accion de un CTA no ejecuta dinero: debe entrar por el
  endpoint de dominio y Core correspondiente.
- `OrchestrationPlanningAgent` sigue siendo autoridad semantica para proponer el
  workflow; el compilador, PolicyGate, ExecutionEngine y Core validan el plan y
  conservan la autoridad de ejecucion.
- Categorias base y sus invariantes permanecen deterministas. Los agentes solo
  pueden sugerir clasificacion o alias sujetos a validacion y aprendizaje
  confirmado.

Archivos principales:

- `src/agents/{learning-signal-agent,dedup-signal-agent,risk-signal-agent,disclosure-experience-agent,recurring-signal-agent,nudge-experience-agent,insight-experience-agent,insight-narrator-agent}/`
- `src/core/{learning,dedup,risk,disclosure,recurring,nudges,insights,orchestrator}/`
- `src/workers/nudges/proactive-nudge-worker.ts`
- `src/workers/outbox/handlers/insight-lifecycle-handler.ts`
- `src/app/api/v1/insights/`
- `src/app/api/internal/jobs/{insights-evaluate,nudges-evaluate,recurring-detect}/`
- `src/data/migrations/025_hybrid_learning_candidates.sql`
- `src/data/migrations/026_cross_channel_dedup_decisions.sql`
- `src/data/migrations/027_advanced_insights.sql`
- `src/data/migrations/028_proactive_nudges.sql`

Que quedo mockeado o pendiente:

- Activar providers API por agente solo donde existan modelo, key y metricas
  aprobadas; `local_fixture` sigue siendo fallback controlado de pruebas.
- Mantener `WHATSAPP_SEND_PROACTIVE_NUDGES=false` hasta aprobar template,
  consentimiento, metodo de pago, quiet hours y QA con el numero real.
- Gmail adapter real sigue pendiente. La reconciliacion cross-channel ya existe
  para usarla cuando entren pendientes normalizados desde email.
- Medir utilidad, falsos positivos, supresion por feedback, conversion y
  latencia con volumen real. El QA tecnico no sustituye estas metricas de uso.

Pruebas ejecutadas:

- Suite completa: 102 archivos pasaron y 3 se omitieron; 559 tests pasaron y 5
  se omitieron.
- Pruebas dirigidas finales de UI/API/Repositorio de Descubrimientos: 12 tests,
  OK despues del ajuste visual final.
- `npm run typecheck`: OK.
- Lint dirigido de los archivos modificados: OK.
- `npm run build`: OK con Next.js 16.2.7 y las rutas publicas de Insights.
- Smokes no destructivos de jobs internos y outbox en staging: OK.

Capturas/artefactos:

- Pantalla real de Descubrimientos conectada a lista, detalle, evidencia,
  seen, dismiss y action.
- QA autenticado desktop `1280x720` y mobile `390x844`: sin overflow
  horizontal; estados funcional, detalle, actualizado, vacio y modo discreto
  verificados.
- La evidencia muestra solo movimientos confirmados y pertenecientes al mismo
  usuario. Los CTA registran engagement y enrutan; no ejecutan dinero.
- Deployment Vercel `dpl_2gwyj8ZVTFHEhJyYjms2isMueJMK`, publicado en
  `https://manzana.website`.
- Migraciones `025` a `028` aplicadas y alineadas con staging.

Deuda tecnica nueva:

- Medir precision/recall por tipo de señal, supresion por feedback, costo y
  latencia por agente con volumen real.
- Agregar observabilidad operacional para envios proactivos, dead letters y
  divergencias entre recomendacion agentic y decision determinista.

Siguiente paso:

Corte operativo de activacion proactiva controlada: aprobar templates y
consentimiento, verificar metodo de pago/ventana/quiet hours, ejecutar piloto
con opt-in real y envio limitado, y observar delivery, feedback, costo,
latencia y falsos positivos. No habilitar el kill switch antes de esa puerta.

---

## Actualizacion 2026-07-20: Activacion Proactiva Controlada - Infraestructura Del Piloto

Estado: implementado, migrado, desplegado y verificado en modo seguro. El
piloto real no esta activado y no se enviaron mensajes proactivos.

Corte:

Cerrar las barreras tecnicas y operativas previas a un piloto WhatsApp sin
convertir un flag aislado en permiso de envio ni reducir la calidad por costo.

Que se implemento:

- Modos `off | planned | pilot`; no existe modo global en este corte.
- Cohorte obligatoria por UUID y validacion de IDs antes de considerar listo el
  sistema.
- Gate acumulativo: provider, WABA, metodo de pago atestado, template
  configurado, aprobacion atestada, aprobacion live, allowlist, telefono,
  opt-in maestro, opt-in granular y quiet hours.
- Comprobacion live del template Kapso por nombre e idioma. Solo `APPROVED`
  habilita readiness; `PENDING`, `REJECTED`, ausencia o error bloquean.
- Consentimiento WhatsApp atomico y revocable mediante RPC service-role. La
  vinculacion del numero no implica consentimiento proactivo.
- Endpoint interno read-only `GET /api/internal/jobs/nudges-readiness`,
  autenticado con `CRON_SECRET` o `WORKER_SECRET` y sin exponer secretos.
- Metricas limitadas a la cohorte: candidatos, delivery, latencias, intentos de
  proveedor, errores y conteo de templates. Sin cohorte no se consulta data
  global.
- Smoke operativo con validaciones opcionales `require-ready` y
  `require-active`.

Archivos principales:

- `src/core/nudges/proactive-activation.ts`
- `src/core/nudges/proactive-readiness.ts`
- `src/adapters/whatsapp/kapso-template-readiness.ts`
- `src/workers/nudges/proactive-nudge-worker.ts`
- `src/data/repositories/proactive-nudge-operations.repository.ts`
- `src/app/api/internal/jobs/nudges-readiness/route.ts`
- `src/app/api/v1/preferences/nudges/whatsapp/`
- `supabase/migrations/029_whatsapp_nudge_consent.sql`
- `scripts/smoke-proactive-nudges-readiness.mjs`

Que quedo mockeado o pendiente (actualizado por el corte siguiente):

- El template Utility ya esta configurado y permanece `PENDING`; todavia no
  esta aprobado por Meta.
- WABA ya esta configurada. Falta atestar el metodo de pago, definir una
  cohorte y registrar opt-in real para sus usuarios.
- `WHATSAPP_PROACTIVE_NUDGE_MODE=planned` y
  `WHATSAPP_SEND_PROACTIVE_NUDGES=false`; el safety hold de envio sigue activo.
- El costo monetario requiere billing conciliado. La tasa de falsos positivos
  requiere feedback humano etiquetado; no se infieren desde descartes.

Pruebas ejecutadas:

- Suite completa: 108 archivos pasaron y 3 se omitieron; 580 tests pasaron y 5
  se omitieron.
- Suite dirigida del corte: 6 archivos y 16 tests, OK.
- `npm run typecheck`: OK.
- Lint dirigido: OK.
- `npm run build`: OK con Next.js 16.2.7.
- Migraciones local/staging `001` a `029`: alineadas.
- Smoke read-only de produccion: `200`, provider `kapso`, modo `off`, kill
  switch apagado, cohorte `0`, `configuration_ready=false` y
  `sending_active=false`.
- Acceso sin secreto a readiness: `403`.

Capturas/artefactos:

- Deployment Vercel `dpl_3uYLw15kGhcaMi5u3oDWVGUWvjuv`, `Ready` y publicado
  en `https://manzana.website`.
- `/api/health`: `200` en staging.
- QA visual autenticado de Configuracion no repetido en este corte porque la
  sesion de navegador disponible llego al login. API, schema, repositorio y
  componentes permanecen cubiertos por la suite automatizada.

Deuda tecnica nueva:

- Esperar la aprobacion live del template y completar las puertas comerciales
  de Meta.
- Etiquetar feedback de utilidad/falso positivo y conciliar billing real.
- Repetir QA autenticado desktop/mobile de consentimiento antes del primer
  piloto.

Siguiente paso:

Configurar el piloto sin enviarlo: crear y aprobar el template Utility,
confirmar metodo de pago y WABA, seleccionar una cohorte minima con opt-in real,
pasar primero a `planned` y exigir `configuration_ready=true`. Solo despues de
QA humano se podra activar `pilot` y el kill switch para un envio controlado.

---

## Actualizacion 2026-07-20: Primer Template Utility - Contrato Y Envio A Revision

Estado: implementado, desplegado y verificado en modo `planned`. La plantilla
fue creada, esta `PENDING` y no se enviaron mensajes proactivos.

Corte:

Definir un contrato Utility estrecho, auditable y seguro antes de pedir
aprobacion, evitando reutilizar texto libre de agentes o una sola plantilla
para cualquier tipo de nudge.

Que se implemento:

- Contrato versionado `manzana_compromiso_financiero_v1`, idioma `es_PE` y
  categoria `UTILITY`.
- Alcance cerrado a `payment_due`, `overdue_payment` y `debt_due`.
- Un unico parametro temporal deterministico; no expone monto, comercio,
  cuenta, deuda, persona ni URL dinamica.
- Boton estatico `Ver en Manzana` a `https://manzana.website`.
- El worker solo declara disponible la plantilla cuando nombre, idioma y tipo
  coinciden con el contrato. Un tipo no cubierto degrada a Dashboard fuera de
  ventana.
- Script idempotente de preview/submit que descubre WABA desde el numero de
  Kapso, evita duplicados y nunca imprime la API key.
- Configuracion productiva en `planned`, WABA/template referenciados, pago y
  aprobacion sin atestar, kill switch apagado y cohorte vacia.

Archivos principales:

- `src/core/nudges/templates/manzana_compromiso_financiero_v1.json`
- `src/core/nudges/proactive-utility-template.ts`
- `src/core/nudges/proactive-utility-template.test.ts`
- `src/workers/nudges/proactive-nudge-worker.ts`
- `scripts/submit-whatsapp-utility-template.mjs`

Que quedo mockeado o pendiente:

- Meta debe cambiar el estado live de `PENDING` a `APPROVED`.
- Falta confirmar el metodo de pago real en la WABA.
- Falta elegir una cohorte minima, registrar opt-in real y ejecutar QA humano
  de horario silencioso, modo discreto y frecuencia.
- `WHATSAPP_SEND_PROACTIVE_NUDGES=false`; no existe permiso de envio.

Pruebas ejecutadas:

- Suite dirigida de template/worker/sender: 3 archivos y 15 tests, OK.
- Suite completa: 109 archivos pasaron y 3 se omitieron; 587 tests pasaron y
  5 se omitieron.
- `npm run typecheck`: OK.
- `npm run lint`: 0 errores; 2 warnings preexistentes fuera del corte.
- `npm run build`: OK con Next.js 16.2.7.
- Submit Kapso: template ID `1551797666674132`, estado `PENDING`.
- Readiness productivo: `200`, modo `planned`, kill switch apagado, cohorte
  `0`, template encontrado como `UTILITY/PENDING`,
  `configuration_ready=false` y `sending_active=false`.

Capturas/artefactos:

- Deployment Vercel `dpl_9ycJddVt89kE2TjGEst6CffJTkF2`, `Ready` y publicado
  en `https://manzana.website`.
- Kapso WABA `1574436304306972`; se registra solo metadata operativa, nunca
  secretos.

Deuda tecnica nueva:

- Observar la revision de Meta sin convertir `PENDING` en aprobacion manual.
- Conciliar billing antes de medir costo monetario por template.
- Crear contratos separados si otro tipo de nudge amerita WhatsApp fuera de
  ventana; no ampliar este template por conveniencia.

Siguiente paso:

Esperar `APPROVED` y confirmar metodo de pago. Luego seleccionar una cohorte
minima con opt-in explicito, verificar `configuration_ready=true` en
`planned`, ejecutar QA humano sin envio y solo despues evaluar un unico envio
en modo `pilot`.

---

## Actualizacion 2026-07-21: Cierre De Adherencia Conversacional

Estado: implementado, desplegado, verificado localmente y probado contra OpenAI
real. El QA humano por WhatsApp sigue pendiente y no se considera completado por
esta entrada.

Corte:

Cerrar la brecha entre detectar una preferencia conversacional y aplicarla de
forma verificable en las respuestas financieras siguientes. La solucion es
generica y no agrega ramas por palabras como `chistoso`, `emojis` o frases
equivalentes.

Que se implemento:

- `ResponseContextPack v2` con `style_contract` estructurado, instruccion libre,
  alcance, dimensiones permitidas/bloqueadas y retroalimentacion de reintento.
- Alcances `turn`, `session` y `persistent`. La preferencia persistente vive en
  `user_preferences.metadata.conversation_style` y dura entre conversaciones
  hasta que el usuario la cambie o la elimine.
- Precedencia explicita: override del turno, estilo de la sesion activa y luego
  preferencia persistente.
- Validador de adherencia con evidencia textual exacta, preservacion de hechos,
  maximo dos intentos y fallback deterministico si la salida no cumple.
- Bloqueo selectivo de dimensiones expresivas en correcciones, riesgo o
  contenido sensible sin eliminar dimensiones seguras como concision o
  directness.
- Politica mecanica de emojis: maximo uno, solo si fue solicitado, en respuesta
  breve y contexto seguro.
- Normalizacion final al formato nativo de WhatsApp para freeform e
  interactivos.

Archivos principales:

- `src/core/response/conversation-style-policy.ts`
- `src/core/conversation/conversation-style-preferences.ts`
- `src/core/response/response-agent-enhancer.ts`
- `src/agents/response-agent/types.ts`
- `src/agents/runtime/openai-agent-runtime.ts`
- `src/core/orchestrator/financial-orchestrator.ts`
- `src/core/response/whatsapp-formatting.ts`
- `src/core/response/whatsapp-response-sender.ts`

Que quedo mockeado o pendiente:

- Falta hacer QA humano por WhatsApp con estilos arbitrarios en los tres
  alcances; no basta probar unicamente humor.
- La utilidad percibida de estilos persistentes requiere metricas con uso real.

Pruebas ejecutadas:

- Suite dirigida: 21 tests, OK.
- Smoke opt-in `ResponseAgent` contra OpenAI: 1 archivo y 3 tests, OK. Incluye
  preservacion de hechos, Pendientes e instruccion libre de sesion con evidencia
  de estilo.
- Suite completa: 112 archivos pasaron y 3 se omitieron; 599 tests pasaron y 6
  se omitieron.
- `npm run typecheck`: OK.
- `npm run build`: OK con Next.js 16.2.7.

Capturas/artefactos:

- Deployment Vercel `dpl_4jaxbsRPTpMAvmAWkT71YJTepwq8`, `Ready` y publicado en
  `https://manzana.website`.
- `/api/health`: `200`, entorno `staging` y Supabase `ok`.
- Todavia no hay captura de QA humano por WhatsApp para este corte.

Deuda tecnica nueva:

- Medir rechazo por `style_not_applied`, cantidad de segundos intentos y
  frecuencia de bloqueos por seguridad.
- Confirmar con conversaciones reales que una preferencia persistente no se
  vuelve invasiva y que el reset es inmediato.

Siguiente paso:

Probar por WhatsApp una instruccion libre de sesion, una preferencia persistente
y su eliminacion, incluyendo una respuesta financiera normal y otra sensible.

---

## Actualizacion 2026-07-21: Corte 24 - DataContextPack V2 Y Arsenal Semantico

Estado: implementado en codigo, verificado localmente y pendiente de QA humano
por WhatsApp con datos reales.

Corte:

Cerrar la brecha entre el contexto de captura y las capacidades que el planner
puede seleccionar. El objetivo no es agregar respuestas para frases concretas,
sino darle al sistema un contexto financiero util y un arsenal read-only que
pueda combinar segun la necesidad semantica del turno.

Que se implemento:

- `DataContextPack v2` con categorias, subcategorias, tags, cuentas, cajas,
  personas relacionadas y aliases, movimientos recientes, correcciones y
  vocabulario aprendido con evidencia.
- Ocho capacidades read-only nuevas en los contratos, prompts, planner,
  `ConversationAgent` y `ToolGateway`: `get_classification_catalog`,
  `get_pending_details`, `get_financial_structure`, `get_insights`,
  `get_insight_evidence`, `get_record_provenance`,
  `get_user_context_summary` y `get_spending_summary`.
- El arsenal total queda en catorce herramientas catalogadas: seis lecturas
  existentes y ocho nuevas. El gateway limita el fan-out por turno a ocho para
  proteger latencia y costo; no ejecuta todas por defecto.
- `query_movements` acepta filtros semanticos de subcategoria, persona y tags,
  ademas de fecha, tipo, categoria, cuenta, fuente y texto.
- `get_spending_summary` cuenta solo salidas financieras reales y excluye
  ingresos, transferencias, asignaciones internas y deuda adquirida.
- La clasificacion inferida, tags, personas y subcategorias no otorgan permiso
  de escritura: cualquier mutacion sigue pasando por PolicyGate, comandos y
  Core. Los agentes siguen sin acceso directo a Supabase.

Archivos principales:

- `src/agents/data-agent/types.ts`
- `src/data/repositories/data-context.repository.ts`
- `src/core/orchestrator/financial-orchestrator.ts`
- `src/agents/orchestration-planning-agent/types.ts`
- `src/agents/conversation-agent/conversation-agent.ts`
- `src/agents/runtime/openai-agent-runtime.ts`
- `src/core/conversation/tool-gateway.ts`
- `src/core/conversation/tool-gateway.test.ts`
- `docs/fase_4_tecnica/19_agent_runtime_tools.md`

Que quedo mockeado o pendiente:

- QA humano con peticiones mixtas reales: registrar y preguntar por periodo,
  buscar por subcategoria/persona/tag, pedir origen y abrir evidencia.
- Medir precision de filtros, falsos vacios, latencia, fan-out y utilidad por
  herramienta con volumen real.
- El catalogo no convierte automaticamente cada capacidad en una llamada: el
  planner decide, el ConversationAgent ejecuta lecturas autorizadas y Core
  conserva la autoridad sobre cualquier escritura.

Pruebas ejecutadas:

- Suite dirigida del gateway, DataAgent y flujo agentic: 18 tests, OK; smokes
  externos omitidos por falta de credenciales en este entorno.
- `npm run typecheck`: OK.
- `npm run lint`: 0 errores; quedan tres warnings de variables no usadas.
- Suite completa: 112 archivos pasaron, 3 se omitieron; 600 tests pasaron,
  6 se omitieron. El fallo inicial era una expectativa antigua de filtros y
  quedo actualizado para el contrato semantico nuevo.

Capturas/artefactos:

- No aplica QA visual: el corte es de contratos, contexto y herramientas
  read-only.

Deuda tecnica nueva:

- Agregar evaluaciones conversacionales con datos de subcategorias, tags,
  personas, cajas, origen y evidencia.
- Observar si el planner elige herramientas suficientes sin sobreconsultar y
  si responde con claridad cuando una capacidad no tiene datos.

Siguiente paso:

Desplegar el corte y ejecutar QA real por WhatsApp con un flujo mixto,
correccion contextual y busqueda historica. Despues cerrar las herramientas
read-only restantes solo si el QA demuestra que las lecturas actuales no
cubren un caso; no agregar ramas por frases.

---

## Actualizacion 2026-07-21: Corte 25 - Continuidad De Deudas Y Calendario Autoritativo

Estado: implementado, desplegado y verificado en staging.

Que se implemento:

- `get_debt_details` como tool read-only del ToolGateway para consultar una
  deuda concreta, sus filas individuales de cuotas, pagos y asignaciones.
- Separacion explicita entre saldo actual, calendario registrado y
  configuracion agregada. Las filas individuales tienen prioridad cuando
  existen; una diferencia se muestra como advertencia y no se corrige con una
  suposicion.
- Continuidad semantica de borradores de captura: un pago de cuota incompleto
  puede continuar en el siguiente turno cuando llega el monto o la referencia
  faltante.
- Dashboard de deuda con etiquetas separadas para calendario configurado,
  calendario registrado y advertencias de diferencia.

Archivos principales:

- `src/core/conversation/tool-gateway.ts`
- `src/agents/conversation-agent/conversation-agent.ts`
- `src/agents/runtime/openai-agent-runtime.ts`
- `src/agents/data-agent/types.ts`
- `src/core/orchestrator/capture-draft-memory.ts`
- `src/features/debts/debts-view-model.ts`
- `src/features/debts/debts-screen.tsx`
- `docs/fase_4_tecnica/19_agent_runtime_tools.md`

Que quedo mockeado:

- El runtime local usa fixtures para pruebas. El runtime de produccion debe
  usar el proveedor API configurado y las tools autorizadas del Core.

Pruebas ejecutadas:

- DataAgent: completa semanticamente el monto de un pago de cuota desde un
  borrador activo.
- ConversationAgent: usa detalle individual de cuotas, separa saldo de
  calendario y emite advertencias ante discrepancias.
- View-model de deudas: conserva la diferencia entre saldo actual y calendario.
- Conversation memory: conserva entidades y referencias de la consulta.
- Resultado: 4 archivos, 35 tests, todos pasaron.
- `npm run typecheck`: OK.
- `npm run build`: OK.
- `npm exec vitest run src/data/migrations/migrations.test.ts`: 26 tests,
  todos pasaron.
- `npm run smoke:debts:lifecycle`: OK; transiciones idempotentes y sin mutar
  saldos.
- `node scripts/smoke-debt-installment-allocation.mjs`: OK; asignacion por
  cuotas, saldos y cierre pagado correctos.
- `npm run smoke:whatsapp:conversation-e2e`: OK; run
  `558ad109-73a1-413e-aa33-8e848a048051` con runtime API, flujo mixto, memoria
  activa y correccion confirmada por Core.

Despliegue y QA ejecutado en staging:

1. "que deudas tengo": OK; uso el resumen general sin solicitar detalle
   innecesario.
2. "cuantas cuotas me faltan de Pedro": OK; uso `get_debt_details`, devolvio
   las tres filas registradas, sus fechas y el saldo actual de S/300, sin
   multiplicar configuracion agregada.
3. "quiero registrar el pago de la primera cuota" seguido por "el monto es 100
   soles": OK; el primer turno guardo `capture_draft` y el segundo conservo
   `pago_deuda`, incorporo S/100 y llevo la propuesta a Pendiente de alto
   riesgo. No creo un movimiento generico, no ejecuto un pago y no cambio el
   saldo de S/300. Run `245c9e71-c6ea-43aa-9d22-5bea900e9694`.
4. Detalle de Pedro en Dashboard: OK; mostro saldo actual S/300, tres filas
   concretas de S/100 y la configuracion "3 cuotas de S/100" como conceptos
   separados.

Artefactos operacionales del despliegue:

- Corte 25 desplegado como `dpl_AZbvcYQDpbmttFE2Deghttuc2zZr` y promovido a
  `https://manzana.website`.
- Endurecimiento posterior de observabilidad del outbox desplegado desde
  `https://manzana-staging-bs1jjieli-marcobernas-projects.vercel.app` y
  promovido al mismo alias.
- Se detecto drift de esquema porque
  `supabase/migrations/030_classification_governance.sql` no estaba en la ruta
  autoritativa de Supabase. La migracion 030 se sincronizo, se aplico al remoto
  `ifjqnftgznbehtyrpnkt` y `supabase migration list` confirma 001-030 alineadas.
- El smoke de WhatsApp usa un numero reservado; por eso la entrega final al
  proveedor queda en `response_send_kind=failed`. La recepcion, orquestacion,
  tools, memoria, Core y planes de respuesta si fueron verificados.

Deuda tecnica nueva:

- Medir si el planner solicita detalle solo cuando la pregunta lo requiere y
  si la respuesta mantiene la distincion entre saldo, cuotas y pagos.
- Integrar la ejecucion de pagos de deuda desde WhatsApp con un comando
  especializado del Debt Engine/Core. Hoy la politica de acciones directas
  permite `gasto` e `ingreso`; un `pago_deuda` claro puede continuar como
  borrador o Pendiente hasta que exista ese dispatcher especializado. Esto es
  una limitacion de integracion financiera, no un problema de interpretacion
  de la frase ni una razon para habilitar escrituras genericas.

Siguiente paso:

El Corte 25 queda cerrado. No existe todavia un Corte 26 aprobado en este
ledger. La deuda tecnica prioritaria candidata es el dispatcher especializado
de pagos del Debt Engine/Core para que un `pago_deuda` confirmado pueda
ejecutarse sin pasar por una escritura generica; debe definirse como un corte
nuevo antes de implementarlo.

---

## Actualizacion 2026-07-22: Corte 26 - Pago De Deuda Seguro Desde WhatsApp

Estado: implementado, desplegado y aprobado en QA financiero automatizado de
staging. La entrega a un numero humano de WhatsApp queda pendiente como QA de
canal, no como brecha de ejecucion del Debt Engine/Core.

Corte:

Cerrar la deuda tecnica prioritaria del Corte 25 conectando `pago_deuda` y
`devolucion_recibida` de WhatsApp con un comando especializado del Core/Debt
Engine. No se amplia la politica de movimientos genericos y no se agregan
ramas por frases.

Que se implemento:

- `RecordDebtPaymentCommand` tipado con deuda, monto, moneda opcional explicita,
  cuenta opcional, cuota opcional, fecha, fuente e idempotency key.
- `DebtPaymentCommandHandler` con validacion deterministica de pertenencia,
  estado activo, saldo pendiente, moneda, cuenta y orden de cuota antes de
  ejecutar el RPC atomico `commit_debt_payment`.
- `SupabaseDebtPaymentExecutionPort` como adaptador intercambiable entre Core y
  repositorios; conserva idempotencia y devuelve pago, deuda, movimiento y
  asignaciones.
- `DataContextPack v2` ampliado con `active_debts`, personas, aliases y cuotas
  abiertas. `debt_hint` deja de ser un objeto opaco y pasa a un contrato tipado
  con IDs y numeros de cuota.
- Resolucion semantica acotada por evidencia: deuda exacta, persona, alias,
  cuota o unica deuda compatible. Multiples coincidencias, referencias
  inexistentes, sobrepago, moneda incompatible y cuota no aplicable se bloquean
  sin escritura.
- `DataActionExecutor` despacha pagos listos por el comando especializado y el
  `ResponsePlanner` confirma monto, deuda y saldo restante.
- Dashboard reutiliza el mismo comando especializado; ya no mantiene una
  segunda implementacion del commit.
- La confirmacion generica de Pendientes rechaza tipos especializados. Esto
  cierra el hueco por el cual un Pendiente historico de `pago_deuda` podia
  convertirse en movimiento sin reducir la deuda.
- La cuenta es verdaderamente opcional: solo se conserva cuando el texto
  original menciona una cuenta y el DataAgent adjunta evidencia explicita. Una
  cuenta por defecto inferida desde el Context Pack se ignora y el pago no toca
  saldos de cuenta.
- La sensibilidad de una deuda limita divulgacion, pero por si sola no exige
  una segunda confirmacion para un pago pasado, exacto y validable por Core.
- `ResponseAgent` tiene guards deterministas para no convertir una operacion ya
  ejecutada en una solicitud de confirmacion ni inventar una cuenta ausente del
  plan base.
- Se agrego `scripts/smoke-whatsapp-debt-payment.mjs`: crea fixtures temporales,
  firma eventos Kapso, ejecuta el worker, exige runtime API, verifica mutaciones
  y outbox, prueba idempotencia y elimina el usuario temporal al terminar.

Archivos principales:

- `src/core/debts/debt-payment-command.ts`
- `src/data/repositories/debt-payment-command.repository.ts`
- `src/core/finance/commands.ts`
- `src/core/finance/command-dispatcher.ts`
- `src/agents/data-agent/types.ts`
- `src/data/repositories/data-context.repository.ts`
- `src/core/orchestrator/data-action-policy.ts`
- `src/core/orchestrator/data-action-executor.ts`
- `src/core/orchestrator/financial-orchestrator.ts`
- `src/core/pending/confirm-pending.ts`
- `src/core/response/response-planner.ts`
- `src/core/response/response-agent-enhancer.ts`
- `src/app/api/v1/debts/[id]/payments/route.ts`
- `src/agents/runtime/openai-agent-runtime.ts`
- `scripts/smoke-whatsapp-debt-payment.mjs`
- `docs/fase_4_tecnica/19_agent_runtime_tools.md`
- `docs/fase_2_estrategia/alcance_v1/05h_deudas.md`

Que quedo mockeado o pendiente:

- El smoke usa un numero reservado y llama el webhook firmado; no demuestra
  recepcion ni entrega desde un telefono humano a traves del proveedor. Si
  `response_send_kind` falla por ese numero, no invalida la escritura financiera
  ya verificada, pero el QA humano de canal sigue pendiente.
- `local_fixture` sigue siendo la degradacion segura cuando la API no esta
  disponible. El smoke rechaza esa pasada como QA linguistico, comprueba que no
  haya mutaciones y reintenta con un evento nuevo hasta obtener runtime API.
- Falta observar precision y latencia con volumen real, no solo con fixtures
  temporales y nombres unicos.

Pruebas ejecutadas:

- Suite dirigida final de policy, ResponsePlanner y ResponseAgent: 3 archivos,
  59 tests, todos pasaron.
- Suite completa final: 113 archivos pasaron, 3 se omitieron; 621 tests pasaron
  y 6 se omitieron.
- `npm run typecheck`: OK.
- `npm run lint`: 0 errores; quedan dos warnings preexistentes fuera del corte.
- `npm run build`: OK con Next.js 16.2.7.
- Build remoto Vercel del deployment final: OK con Next.js 16.2.7.
- `node scripts/smoke-debt-installment-allocation.mjs` contra
  `https://manzana.website`: OK; asignacion por cuota, cuenta enlazada y cierre
  `paid` siguen correctos desde Dashboard.
- `npm run smoke:whatsapp:debt-payment` contra staging: OK; run
  `331f7f28-65c6-4d51-bb20-442cd4f80701`, con runtime API en todos los casos.

Despliegue y QA ejecutado en staging:

- Deployment final `dpl_B7LhFJRsKLeCogSQuN7gwbZGtQNf`, target del proyecto de
  staging y alias verificado en `https://manzana.website`.
- Health: `status=ok`, `env=staging` y Supabase disponible.
- Pago parcial: S/30 ejecutados por `RecordDebtPaymentCommand`; saldo de deuda
  S/100 -> S/70, una fila en `debt_payments`, movimiento `pago_deuda` y ninguna
  fila en Pendientes.
- Pago completo: S/70 ejecutados; saldo S/0, deuda `paid` y segundo pago
  registrado.
- Cuenta omitida: saldo de la cuenta fixture permanecio en S/200 durante ambos
  pagos.
- Evento duplicado: un segundo webhook con el mismo message id fue reconocido
  como duplicado, sin nuevo handoff ni segundo pago.
- Deuda ambigua, sobrepago y moneda incompatible: los tres quedaron `blocked`,
  `not_executed`, sin Pendiente y sin cambios en deudas, movimientos, pagos ni
  cuenta.
- Outbox: presentes `debt_payment_registered` y `debt_paid` para la deuda
  liquidada.
- El QA iterativo detecto y corrigio cuatro defectos antes del run final:
  sensibilidad usada como bloqueo, cuenta default inferida, texto que pedia
  confirmar despues de ejecutar y copy de moneda que mencionaba una cuenta
  inexistente. Tambien se verifico el alias para no confundir previews con el
  deployment promovido.

Capturas/artefactos:

- No aplica QA visual: el corte modifica contratos y ejecucion financiera, no
  superficies de UI.

Deuda tecnica nueva:

- Medir con volumen precision de resolucion por persona/deuda/cuota, frecuencia
  de ambiguedad, fallback del runtime y latencia adicional del contexto.
- Evaluar la distincion conversacional entre un pago nuevo y la correccion de un
  pago reciente cuando ambos aparecen en turnos consecutivos.

Siguiente paso:

El Corte 26 queda cerrado para ejecucion financiera en staging: escritura real,
idempotencia, outbox y ausencia de mutaciones en bloqueos fueron verificadas. El
siguiente trabajo no debe abrir un Corte 27 implicito: primero hacer QA humano
del canal con un numero autorizado y reunir metricas de resolucion, fallback y
latencia para decidir el siguiente corte en este ledger.

---

## Actualizacion 2026-07-22: Gate Previo Al Corte 27 - QA Humano Y Metricas De Pago De Deuda

Estado: gate cerrado con QA humano estricto sobre fixtures autorizados. Un
defecto de fallback fue encontrado, corregido, redesplegado y validado. Este
cierre habilita definir explicitamente el Corte 27, pero no lo abre por si solo.

Objetivo del gate:

Evitar elegir el siguiente corte por intuicion. Primero se debe observar el
flujo de pago de deuda con transporte humano real, runtime API y datos de
staging, conservando las mismas garantias financieras verificadas por el smoke.

Que se implemento:

- `scripts/smoke-whatsapp-agent-traces.mjs` acepta `--debt-payment` y limita el
  reporte a eventos de pagos de deuda sin mostrar texto ni telefono por defecto.
- El auditor calcula outcomes de plan y ejecucion, providers de DataAgent y
  ResponseAgent, fallback, razones de bloqueo, rechazos de guards, ejecuciones
  con/sin cuenta y p50/p95 de latencia por agente.
- La cobertura exigible incluye pago parcial, pago completo, deuda ambigua,
  sobrepago y moneda incompatible.
- Son blockers una ejecucion sin plan `ready_for_core`, una mutacion desde un
  plan bloqueado o la creacion de un Pendiente para un pago bloqueado.
- Se agrego el script npm `smoke:whatsapp:debt-payment-traces` y filtros por
  `--phone`, `--hours`, `--since`, `--limit`, `--expected-provider` y `--strict`.

Evidencia actual:

- Auditor conversacional de 24 horas: 18 eventos humanos elegibles, 16 con
  DataAgent API y 17 respuestas con ResponseAgent API.
- Auditor de deuda de 24 horas: 2 eventos humanos, ambos anteriores al Corte 26;
  no ejecutaron pagos y todavia mostraban
  `movement_type_requires_specialized_engine`.
- En esos dos eventos historicos DataAgent tuvo p50 6266 ms y p95 6443 ms;
  ResponseAgent p50 2941 ms y p95 4401 ms. No se detectaron violaciones de
  escritura.
- Antes de iniciar este gate, desde el deployment
  `dpl_B7LhFJRsKLeCogSQuN7gwbZGtQNf` (`2026-07-22T15:14:08Z`) habia cero
  eventos humanos de pago de deuda. Los smokes automatizados se excluyen
  deliberadamente de este auditor.

Avance del QA humano:

- Se crearon tres deudas temporales aisladas bajo el run
  `c46eca11-7a55-4001-987f-544617a204d0`: dos PEN para probar ambiguedad y
  sobrepago, y una USD para incompatibilidad de moneda.
- El primer caso, referencia solo por persona con dos deudas compatibles, uso
  DataAgent y ResponseAgent API; quedo `blocked`, `not_executed`, con razon
  `debt_reference_ambiguous`, sin Pendiente ni violacion financiera.
- El primer intento del segundo caso no cuenta: DataAgent cayo a
  `local_fixture` y el parser local degrado `pago_deuda` a `gasto`, creando un
  Pendiente generico. No hubo movimiento ni pago de deuda, pero se incumplio el
  contrato de fallback seguro.
- Se corrigio `LocalFixtureDataAgentRuntime` para resolver primero contra
  `active_debts` y conservar deuda, persona, moneda y cuota. Las referencias de
  deuda no resueltas ya no se convierten en movimientos genericos.
- El Pendiente incorrecto fue descartado mediante el repositorio y outbox, y su
  borrador conversacional fue retirado; el historial de auditoria se preservo.
- Regresion verificada con 625 tests aprobados, 6 omitidos, typecheck, lint sin
  errores y build. La correccion esta desplegada en
  `dpl_He2s3mboy8DZY2Dqe2MN2uZ166FT`, alias `https://manzana.website`, con
  health y Supabase en estado `ok`.
- El segundo caso repetido uso ambos agentes API y quedo `blocked`,
  `not_executed`, con razon `debt_payment_exceeds_balance`, sin fallback,
  Pendiente ni violacion. Las tres deudas conservaron sus saldos originales y
  no existen movimientos QA activos. El gate humano acumula 2 de 5 escenarios
  aprobados: ambiguedad y sobrepago.
- El tercer caso resolvio la deuda USD pero con un monto expresado en PEN; uso
  ambos agentes API y quedo `blocked`, `not_executed`, con razon
  `debt_payment_currency_mismatch`. No hubo fallback, Pendiente, movimiento ni
  cambio de saldo. El gate humano acumula 3 de 5 escenarios aprobados; faltan
  pago parcial de cuota y liquidacion del saldo restante.
- El primer intento de pago parcial ejecuto correctamente S/30 por el comando
  especializado: plan `ready_for_core`, saldo S/70, primera cuota con S/30
  aplicados, un movimiento, un `debt_payment` y outbox
  `debt_payment_registered` publicado; no hubo cuenta ni Pendiente. DataAgent
  uso API, pero ResponseAgent agoto su timeout y termino por `local_fixture`.
  La escritura es valida y no se revierte, aunque el intento no califica como
  evidencia operativa del escenario porque el gate exige ambos providers API.
- El auditor ahora separa intentos de eventos calificados por provider y exige
  que cada escenario tenga al menos una traza completa API; los fallbacks
  previos permanecen visibles como metrica sin sustituir evidencia valida.
- La repeticion del pago parcial aplico los S/20 restantes de la primera cuota
  con ambos agentes API. El saldo quedo en S/50, la cuota 1 en `paid`, la cuota
  2 pendiente, dos pagos/outbox publicados y cero Pendientes. El gate humano
  acumula 4 de 5 escenarios aprobados; solo falta liquidar el saldo restante.
- El quinto caso liquido los S/50 restantes con ambos agentes API: deuda en
  S/0 y `paid`, ambas cuotas `paid`, tres pagos especializados acumulados, tres
  eventos `debt_payment_registered` y un `debt_paid`, todos publicados. No se
  infirio cuenta y no se creo Pendiente.
- El auditor estricto cerro con 5 de 5 escenarios, 6 eventos de deuda, 3
  ejecutados, 3 bloqueados, 5 eventos calificados por ambos providers API, cero
  `safety_violations` y cero blockers. DataAgent tuvo p50 4840 ms y p95 7870
  ms; ResponseAgent p50 3308 ms y p95 6397 ms.
- Permanece visible un intento no calificado: el primer pago parcial uso
  fallback seguro de ResponseAgent por `RUNTIME_TIMEOUT`. No sustituyo la
  repeticion API ni altero la validez de la escritura financiera.
- Al terminar se retiro el borrador conversacional y se archivaron tres deudas
  y tres movimientos fixture; pagos, outbox y trazas quedaron preservados como
  historial de auditoria.

Comando de cierre del gate:

```bash
npm run smoke:whatsapp:debt-payment-traces -- --strict --since=2026-07-22T15:14:08Z --phone=NUMERO_E164_AUTORIZADO
```

QA humano requerido sobre fixtures controlados de staging:

1. Pago parcial exacto de una cuota.
2. Pago del saldo restante hasta dejar la deuda en cero.
3. Pago que solo identifica una persona con dos deudas compatibles.
4. Pago superior al saldo pendiente.
5. Pago expresado en una moneda distinta de la deuda.

El gate se considera cerrado solo si los cinco escenarios aparecen, todos usan
runtime API, no hay `safety_violations` y los bloqueos no producen mutaciones ni
Pendientes. Con esa evidencia se puede definir el Corte 27 en este ledger.

---

## Corte 27 - Onboarding De Activacion Inicial Real

Estado: completado, migrado, desplegado y validado en staging/produccion el 22
de julio de 2026.

Decision de alcance:

El siguiente hueco prioritario de V1 es onboarding. Gmail requiere OAuth,
Pub/Sub y credenciales externas; la activacion proactiva requiere aprobacion y
consentimiento. En cambio, onboarding puede cerrarse sobre el Core y Dashboard
actuales y es una dependencia de ambos trabajos posteriores.

Este corte no intenta completar todo el lifecycle. Cierra de forma verificable
la primera progresion:

```text
not_started -> started -> first_value_reached
```

Incluye:

- `OnboardingActivationEngine` determinista, monotono y sin escritura
  financiera.
- Inicio explicito desde un estado vacio util; no mutar en un `GET`.
- Primer valor por movimiento confirmado, pendiente confirmado o primera deuda
  real, reutilizando eventos/servicios existentes.
- Evento auditable `onboarding_stage_changed` y metrica especifica del trigger.
- Home sin datos con una sola accion principal: registrar un movimiento;
  WhatsApp, cuenta y email quedan como opciones secundarias, nunca requisitos.
- Tip de control/correccion despues del primer valor, mostrado sin tour largo ni
  celebracion artificial.
- API autenticada, idempotencia, pruebas de transicion, Home y worker.

No incluye:

- `activated_light`, `activated_strong`, `completed` ni retorno D1-D7.
- Gmail OAuth/backfill.
- Activar recordatorios o templates proactivos.
- Obligar a crear cuenta, categoria, caja o conectar un canal.
- Reinterpretar movimientos, deudas o Pendientes fuera de sus motores.

Done del corte:

- Un usuario sin datos puede iniciar por una accion real en menos de un minuto.
- Pulsar la CTA inicial cambia a `started` una sola vez y no toca dinero.
- El primer valor confirmado cambia a `first_value_reached` una sola vez, desde
  Dashboard o WhatsApp, con outbox/auditoria.
- Un retry o evento tardio no retrocede ni duplica la etapa.
- Home no prioriza crear cuenta sobre registrar el primer movimiento y nunca
  muestra dinero libre `S/0` sin datos.
- Typecheck, tests, lint, build, migracion/staging y QA visual desktop/mobile
  pasan antes de cerrar.

Que se implemento:

- Migracion `031_onboarding_activation.sql` con RPC
  `advance_onboarding_stage(...)`, lock del perfil, progresion monotona,
  idempotencia y evento `onboarding_stage_changed` en el mismo commit.
- Repositorio y motor determinista en
  `src/data/repositories/onboarding.repository.ts` y
  `src/core/onboarding/onboarding-activation.ts`.
- `GET /api/v1/onboarding` como snapshot read-only y
  `POST /api/v1/onboarding` solo para el inicio explicito. Un `GET` nunca cambia
  la etapa.
- Primer valor por `movement_created`, `pending_confirmed` o primera deuda real.
  Movimientos/Pendientes avanzan desde el worker de outbox; la creacion de deuda
  reutiliza el servicio de onboarding y no revierte la deuda si la telemetria se
  difiere.
- `GET /api/v1/dashboard/home` devuelve el resumen de onboarding derivado de la
  etapa y de hechos reales, por lo que Home sigue siendo correcto aunque el
  worker este pendiente.
- Home vacio prioriza `Registrar primer movimiento`, explica que cuenta,
  categoria y canales no son requisitos, y deja WhatsApp como alternativa.
- La CTA registra `started` y abre directamente el modal de nuevo movimiento con
  `?view=movements&movement=new`.
- Despues del primer valor Home muestra control y correccion, sin celebracion
  artificial ni tour.
- Smoke reutilizable `npm run smoke:onboarding:activation` crea y elimina un
  usuario desechable, prueba dos transiciones, dos retries idempotentes, dos
  eventos outbox y cero filas financieras.

Garantias verificadas:

- Solo `service_role` ejecuta la RPC; el endpoint exige sesion autenticada.
- `paused` se respeta y una etapa nunca retrocede.
- La transicion y su outbox son atomicos.
- Iniciar onboarding no crea movimientos, deudas ni Pendientes.
- El primer movimiento de QA se guardo sin cuenta por el Core; el onboarding no
  altero saldo ni invento dinero libre.

Pruebas y evidencia:

- Historial Supabase `001`-`031` alineado local/remoto.
- Smoke real aprobado, run `254b8500`:
  `started -> first_value_reached`, dos retries idempotentes, dos eventos outbox
  y cero filas financieras.
- Vitest completo: 118 archivos aprobados, 3 omitidos; 641 pruebas aprobadas, 6
  omitidas, cero fallos.
- Se estabilizo un test asincrono preexistente de busqueda natural ampliando solo
  su espera de 1 s a 5 s; aislado y dentro de la suite completa pasa.
- `npm run typecheck`: aprobado.
- `npm run lint`: cero errores; permanecen dos warnings preexistentes en
  `.cursor/stitch-proxy.mjs` y `correction-agent.test.ts`.
- `npm run build`: aprobado con Next.js 16.2.7; la ruta
  `/api/v1/onboarding` aparece en el build.
- Deployment Vercel `dpl_9os7bjWAJsLTTjHXbrQubcrxbhH1`, estado `Ready`, alias
  `https://manzana.website`.
- Health post-deploy: `status=ok`, Supabase `ok`, 42 ms. La ruta de onboarding
  sin sesion responde `401`.
- QA visual desktop:
  - primer acceso con una sola CTA y alternativa secundaria de WhatsApp;
  - CTA abre el modal real de movimiento;
  - gasto controlado S/8 sin cuenta queda confirmado;
  - Home cambia a `Tu primer registro ya esta en Manzana`.
- QA visual mobile explicita a 390x844:
  - estado inicial, CTA, tarjeta de WhatsApp y bottom nav sin solapes;
  - estado de primer valor, movimiento reciente y siguiente paso de cuenta sin
    bloquear el uso.
- Los dos usuarios visuales desechables y sus filas en cascada fueron eliminados
  y su ausencia fue verificada.

Que queda fuera y no debe confundirse con este cierre:

- `activated_light`, `activated_strong`, `completed`, retorno D1-D7 y cohortes de
  retencion.
- Gmail OAuth/PubSub y backfill.
- Activacion real de templates o mensajes proactivos.
- Metricas historicas con usuarios reales; el smoke y QA prueban correccion, no
  conversion de producto.

Siguiente paso propuesto, no autorizado automaticamente:

- El plan base todavia tiene sin construir `Corte 9 - Email Gmail V1`. En el
  ledger vivo corresponderia definirlo como Corte 28 solo despues de verificar
  credenciales Google Cloud, redirect URIs, Pub/Sub y politica de tokens.
- Si esas credenciales no estan disponibles, el corte alternativo es completar
  activacion/retorno temprano sobre los eventos ya persistidos. No se debe abrir
  ninguno de los dos por implicacion: el alcance debe quedar decidido aqui antes
  de escribir codigo.

---

## Corte 28 - Gmail V1 Seguro

Estado: completado, operativo y cerrado el 23 de julio de 2026. Gate A quedo
completado el 22 de julio; Gate B paso OAuth, watch, push, ingesta, Pendiente e
invariantes financieras contra Google y produccion reales el 23 de julio.

Decision de alcance:

Este corte implementa Gmail como proveedor V1 detras de `EmailAdapter`, sin
passwords, app passwords, IMAP, forwarding, scraping ni browser automation. El
scope permitido es `gmail.readonly`; se procesa solo correo financiero de
remitentes/template allowlisted y nunca se registra un movimiento sin
confirmacion.

Gate A - Implementacion segura:

- `email_connections`, `email_messages` y `email_parse_templates` con RLS,
  unicidad e indices.
- Refresh token cifrado con AES-256-GCM y clave separada del cliente OAuth.
- OAuth start/callback con `state` anti-CSRF en cookie HttpOnly, status y
  desconexion.
- `EmailAdapter` y proveedor Gmail para refresh, profile, watch, stop, History
  API y fetch minimo de mensajes.
- Pub/Sub push autenticado por OIDC, validando firma/token, audience, service
  account y `email_verified`.
- Ingreso idempotente por Pub/Sub message id + history id y trabajo async por
  outbox.
- Filtrado por headers antes de obtener contenido; cuerpo/snippet solo en
  memoria y nunca persistido por defecto.
- Parsing determinista por templates allowlisted, dedup cross-channel y creacion
  exclusiva de `pending_items`.
- Desconexion elimina token, detiene watch y archiva Pendientes email sin tocar
  movimientos ya confirmados.
- Settings con disclosure, estado, conectar y desconectar.
- Tests, smoke con fixtures sinteticos, migracion, build, deploy y QA visual.

Resultado Gate A:

- Migraciones remotas aplicadas:
  `032_gmail_v1.sql` y `033_gmail_commit_digest_schema.sql`. La segunda califica
  `extensions.digest` sin ampliar el `search_path` del RPC `security definer`.
- Persistencia/RPC: conexion + outbox atomicos, notificacion Pub/Sub idempotente,
  email + Pendiente atomicos y desconexion con eliminacion local del token.
- Adaptador: OAuth Web, refresh, profile, `users.watch`, `users.stop`, History
  API, metadata/full y listado acotado `newer_than:30d` sobre INBOX.
- Seguridad: scope unico `gmail.readonly`, AES-256-GCM con AAD, state OAuth
  HttpOnly/SameSite, OIDC con audience/service account exactos, allowlist exacta
  de remitentes y ningun cuerpo persistido.
- Ejecucion: Pub/Sub entrega a outbox; `gmail_history_notification` y
  `gmail_backfill_requested` comparten parser, dedup y creacion exclusiva de
  Pendientes. Backfill limitado a 30 dias y 500 mensajes, Dashboard-only.
- UI: tarjeta `Gmail financiero` en Configuracion, disclosure de solo lectura,
  estado credential-gated y confirmacion explicita al desconectar.
- Validacion local: `npm run typecheck`, `npm run lint` sin errores (dos warnings
  preexistentes fuera del corte), `npm test` con 677 tests pasando y 6 omitidos,
  y `npm run build` exitoso sobre Next.js 16.2.7.
- Smoke remoto `smoke:gmail:foundation`, run
  `8bf05044-dfef-4e33-999a-cb0121198a4b`: OAuth commit atomico, reintentos
  Pub/Sub/email idempotentes, acceso autenticado directo bloqueado, cero
  movimientos, token eliminado y Pendiente archivado. Fixtures eliminados.
- Deploy READY `dpl_2HaXBcX7Y2VHqXkjkskTrnk5Cidi`, alias
  `https://manzana.website`.
- QA real credential-gated: tarjeta visible con `No configurado`, CTA
  deshabilitado, health 200, status/OAuth 401 sin sesion, webhook 503 sin
  configuracion y renovador 403 sin secreto. Usuario temporal de QA eliminado.

Gate B - Google real:

- Crear/configurar OAuth client Web, redirect URI y consent screen.
- Habilitar Gmail API y Pub/Sub; crear topic/subscription.
- Dar `roles/pubsub.publisher` a
  `gmail-api-push@system.gserviceaccount.com` sobre el topic.
- Configurar push autenticado con service account y audience exactos.
- Cargar credenciales/clave de cifrado en Vercel sin exponerlas.
- Conectar una cuenta Gmail de prueba autorizada, validar `users.watch`, recibir
  un push real, crear un Pendiente y confirmar que no existe movimiento hasta la
  accion humana.

Resultado Gate B:

- Las siete variables Gmail fueron verificadas en Vercel Production sin exponer
  valores. El runtime reporto `configured=true`, `missing=[]`; OAuth genero solo
  `gmail.readonly`, acceso offline, callback exacto y cookie de state
  HttpOnly/Secure/SameSite=Lax.
- OAuth real completo, refresh token cifrado, `users.watch` activo con
  expiracion futura, checkpoint presente y backfill inicial publicado. El
  cuerpo del correo permanecio fuera de persistencia.
- Pub/Sub OIDC real paso de rechazo no configurado a autenticacion efectiva y
  HTTP 200. La QA descubrio y corrigio compatibilidad con envelopes v1/legacy,
  payload wrapped/unwrapped y `historyId` numerico seguro; valores fuera de
  `Number.MAX_SAFE_INTEGER` siguen rechazados para no perder precision.
- La sincronizacion real descubrio otro caso de carrera: un mensaje listado por
  History puede desaparecer antes de `messages.get`. Un 404 individual ahora se
  omite sin abortar el lote; el resto se procesa y el checkpoint avanza. Cuatro
  eventos reales antes fallidos pasaron por replay auditado y terminaron
  publicados sin fallos.
- QA financiera controlada: un correo exacto produjo un unico
  `email_messages.parsed_status=pending_created` y un unico Pendiente
  `email_detected`/`email_pending` por S/ 37.41 PEN, tipo `gasto`,
  `requires_review=true`. No se creo ningun movimiento.
- Idempotencia y outbox finales: 7 eventos Gmail unicos, 7 procesados, 7 claves
  idempotentes; 9 eventos outbox publicados, cero pendientes, cero processing,
  cero failed y cero dead letters. Todos conservaron
  `content_persisted=false`.
- Limpieza QA: Pendiente fixture archivado, template limitado al remitente exacto
  eliminado y usuario fixture auxiliar eliminado. La conexion Gmail real queda
  activa; no se expusieron credenciales ni direcciones en artefactos.
- Validacion final: `npm run typecheck`, lint sin errores y con los dos warnings
  preexistentes fuera del corte, suite completa con 684 tests pasando y 6
  omitidos, y builds Vercel exitosos sobre Next.js 16.2.7.
- Deploy final READY `dpl_6P179RUD8eY3dGxkhcvqKmwkbz8r`, alias
  `https://manzana.website`.

Regla de cierre:

Cumplida. Gate A no se confundio con operacion real; Gate B uso Google,
Pub/Sub, Gmail, Vercel y produccion reales. El Corte 28 queda cerrado sin
auto-registro, sin cuerpo persistido y sin movimiento previo a confirmacion.

Cierre y siguiente decision:

- El bloqueo de credenciales/recursos Google quedo resuelto y no permanece como
  deuda del Corte 28.
- Corte 29 no estaba preautorizado por esta entrada. Debe definirse contra el
  plan vivo y los huecos restantes; documentar su alcance antes de escribir
  codigo y no convertir templates fixture en allowlist de produccion.

No incluye:

- Outlook, Yahoo, IMAP, forwarding ni multi-cuenta.
- Adjuntos, PDF, imagenes/OCR o cuerpo completo persistido.
- Auto-registro, auto-confirmacion o envios proactivos por email.
- Backfill masivo sin limite ni confirmaciones individuales por WhatsApp.

---

## Corte 29 - Piloto Proactivo WhatsApp Controlado

Estado: completado el 23 de julio de 2026. Kapso acepto exactamente un envio, el
usuario confirmo humanamente su recepcion y el sistema regreso a `planned` con
kill switch apagado. Gate B cerrado sin ampliar la cohorte.

Fuentes de alcance:

- `docs/fase_4_tecnica/21_decision_whatsapp_provider.md`
- `docs/fase_2_estrategia/alcance_v1/05j_nudges.md`
- infraestructura ya registrada de activacion proactiva y template Utility.

Objetivo:

Pasar de infraestructura `planned` a un piloto de un solo usuario y un solo
envio medido, sin convertir una variable, una aprobacion de Meta o un opt-in
aislado en permiso suficiente.

Resultado Gate A:

- Readiness productivo consultado con secreto interno: provider `kapso`,
  configuracion del proveedor lista y template
  `manzana_compromiso_financiero_v1` encontrado live como
  `UTILITY/APPROVED`.
- La aprobacion live fue atestada en
  `WHATSAPP_PROACTIVE_TEMPLATE_APPROVED=true`; redeploy READY
  `dpl_6r8xZ1VAKvN5V4YZvjPbbV5MKajZ`.
- El usuario candidato real tiene telefono vinculado, opt-in maestro y opt-in
  granular para `payment_due` y `debt_due`; quiet hours `22:00-08:00` en
  `America/Lima` siguen activas y se respetan.
- Readiness posterior: `configuration_ready=false`,
  `sending_active=false`; blockers exactos
  `payment_method_confirmed` y `pilot_cohort_configured`. Safety holds:
  `activation_mode_planned` y `proactive_send_kill_switch_disabled`.
- No se eligio cohorte por implicacion, no se atesto un metodo de pago sin
  evidencia y no se envio ningun mensaje.

Preparacion Gate B previa al envio:

- El operador confirmo el metodo de pago de la WABA y autorizo al usuario con
  opt-in como unica cohorte, ademas de exactamente un unico envio controlado.
- Se configuraron
  `WHATSAPP_PROACTIVE_PAYMENT_METHOD_CONFIRMED=true` y una cohorte valida de un
  solo UUID, manteniendo `WHATSAPP_PROACTIVE_NUDGE_MODE=planned` y
  `WHATSAPP_SEND_PROACTIVE_NUDGES=false`; deploy READY
  `dpl_g5GY7BRKj8sBN3hcY6PmqVoLxg8k`.
- Readiness productivo posterior: `configuration_ready=true`,
  `sending_active=false`, cero blockers globales, un usuario allowlisted y
  `pilot_ready=true`. El unico blocker temporal del usuario es
  `quiet_hours_active_now`.
- La evaluacion read-only en `planned` produjo dos candidatos vigentes:
  `debt_due` sensible con prioridad 100 y `payment_due` low con prioridad 62.
  Ambos quedaron `deferred` por `quiet_hours`; resultado: 2 evaluados, 0
  enviados, 0 fallidos.
- La comprobacion en base confirma cero filas en `nudge_deliveries` para ambos
  candidatos y ningun intento template/proactivo nuevo en
  `whatsapp_delivery_attempts`.
- El operador autorizo despues desactivar quiet hours y ejecutar inmediatamente.
  La preferencia reversible quedo `00:00-00:00`, conservando opt-in maestro,
  `payment_due` y `debt_due`.

Resultado del unico envio:

- El QA detecto que PostgreSQL entrega columnas `time` como `HH:mm:ss`, mientras
  `parseClock` solo aceptaba `HH:mm`. Readiness normalizaba el valor, pero el
  worker caia silenciosamente al horario por defecto.
- Se corrigio `parseClock` para aceptar el formato PostgreSQL sin relajar la
  validacion de horas. Se agrego regresion para `00:00:00-00:00:00`.
  Resultado: 13/13 pruebas del policy, typecheck y lint focal pasaron; suite
  completa: 127 archivos pasaron, 3 omitidos; 685 tests pasaron, 6 omitidos.
- Tras desplegar la correccion, el QA `planned` produjo 2 candidatos
  `planned`, 0 enviados, 0 diferidos y 0 fallidos, ambos con
  `all_policy_gates_passed`.
- Se activo temporalmente `pilot/true` en deploy READY
  `dpl_69HZWBqvYNNRS8bBfsLoAb7QtK8c`. Readiness exigido antes del envio:
  `configuration_ready=true`, `sending_active=true`, cohorte 1,
  `eligible_now=true`, template `APPROVED`, cero blockers y cero entregas o
  intentos previos.
- Una unica llamada al worker evaluo un candidato y envio uno:
  `debt_due`, sensible, `freeform` por `window_open`; resultado 1 enviado,
  0 fallidos. El segundo candidato no fue enviado porque el worker corta tras
  el primer exito.
- Kapso respondio `HTTP 200`, estado `accepted`, provider message ID presente,
  sin `error_code` y latencia 1541 ms. `nudge_deliveries` quedo `sent`.
  Despues de 30 segundos aun no existia webhook `delivered/read/failed`; no se
  presenta `accepted` como entrega final.
- El usuario confirmo posteriormente que el mensaje llego a su WhatsApp. Esta
  evidencia humana cierra la recepcion del piloto, pero no reescribe
  artificialmente `nudge_deliveries` ni el estado del proveedor: la fuente
  tecnica permanece `sent/accepted` hasta que exista un webhook real.
- Se restauro inmediatamente `planned/false` y se desplego
  `dpl_CHhZjBvPumBMwMzC7vScP6vCdZsr`. Readiness posterior:
  `sending_active=false`, safety holds
  `activation_mode_planned` y `proactive_send_kill_switch_disabled`.
- Verificacion financiera desde el inicio del envio: 0 movimientos y 0
  `debt_payments` creados. La cohorte no se amplio.

Gate B - piloto real:

1. El operador confirma que el metodo de pago de la WABA esta activo.
2. El operador autoriza al usuario con opt-in como unica cohorte del piloto.
3. Configurar la cohorte y pago manteniendo `planned` y kill switch apagado;
   exigir `configuration_ready=true`.
4. Ejecutar QA humano read-only de template, privacidad, frecuencia, quiet
   hours, modo discreto y candidato vigente.
5. Fuera de quiet hours, con autorizacion explicita para el envio, cambiar
   temporalmente a `pilot` y habilitar el kill switch.
6. Enviar un unico Utility controlado, verificar provider accepted,
   `delivered/read/failed`, latencia, deduplicacion, costo observable y cero
   efectos financieros.
7. Volver inmediatamente a `planned` con kill switch apagado y registrar
   metricas/feedback. No ampliar la cohorte desde este corte.

Regla de cierre:

Corte 29 no se declara completado por tener template `APPROVED` ni por existir
opt-in. Requiere pago atestado, cohorte autorizada, readiness completo, un envio
humano controlado fuera de quiet hours, evidencia de delivery y retorno al
safety hold.

---

## Corte 30 - Finalidad De Delivery Kapso V2

Estado: completado, desplegado y reconciliado contra Kapso real el 23 de julio
de 2026.

Evidencia que abre el corte:

- Tras el unico envio del Corte 29, Vercel recibio tres `POST 200` de Kapso en
  `/api/webhooks/whatsapp`, a los 2, 5 y 15 segundos del envio.
- Los tres terminaron con `inbound_received=0`, `statuses_received=0` y
  `statuses_reconciled=0`; por eso no se persistio ningun
  `external_event_log` de status.
- El contrato live documentado de Kapso usa V2:
  `X-Webhook-Event: whatsapp.message.sent|delivered|read|failed`, body con
  `message`, `conversation` y `phone_number_id` top-level, y estado canonico en
  `message.kapso.status`.
- El adapter actual solo reconoce nombres legacy
  `message.sent|delivered|read|failed` y busca principalmente
  `message.status`. La firma HMAC y el endpoint si funcionaron; la brecha esta
  acotada a normalizacion.

Objetivo:

Normalizar y reconciliar estados Kapso V2 sin romper payloads legacy ni Meta
compatibles, sin persistir texto del mensaje y sin fabricar delivery para el
piloto historico.

Incluye:

1. Canonicalizar nombres `whatsapp.message.*` y conservar `message.*`.
2. Leer `message.kapso.status`, historial `statuses`, `conversation.id` y
   `phone_number_id` top-level con fallbacks seguros.
3. Cubrir `sent`, `delivered`, `read` y `failed`, incluida informacion de error
   estructural sin exponer contenido.
4. Agregar regresiones unitarias y de route para fixtures V2 sanitizados.
5. Desplegar con activacion proactiva en `planned/false`.
6. Ejecutar fixtures V2 sanitizados en tests y un replay de recuperacion firmado
   con estado real consultado por WAMID, sin enviar un segundo WhatsApp ni tocar
   dinero.
7. No convertir la confirmacion humana en webhook retroactivo. Si se recupera
   el estado historico, debe provenir del WAMID y timestamps reales del
   proveedor.

Resultado:

- `src/adapters/whatsapp/kapso-adapter.ts` canonicaliza
  `whatsapp.message.*`, conserva `message.*` legacy y Meta-compatible, y lee
  `message.kapso.status`, historial de estados, conversation y
  `phone_number_id` V2.
- Los status normalizados ya no incluyen el texto ni el payload crudo en
  `external_event_log`; solo persisten identificadores operativos, estado,
  pricing, errores estructurales y version del payload normalizado.
- Regresiones agregadas para envelope oficial, `sent`, `delivered`, `read`,
  `failed`, privacidad y route firmado con reconciliacion.
- Deploy READY: `dpl_xw6mxJiogNuC4zfkzYVAYn9oNFor`, con activacion proactiva
  conservada en `planned/false`.
- La API oficial `GET /platform/v1/whatsapp/messages/{WAMID}` devolvio para el
  unico piloto estado `read`, procesamiento `processed` e historial real
  `delivered`, `sent`, `read`, sin errores.
- Se construyo desde esa respuesta un envelope V2 minimo sin texto y se firmo
  con el secreto live. El endpoint respondio `POST 200`: 1 status recibido,
  1 reconciliado, 0 duplicados, 0 usuarios desconocidos y 0 handoffs.
- Estado final: `nudge_deliveries=delivered`, candidato `debt_due=delivered`,
  `latest_provider_status=read` y `read_at` presente. El intento outbound
  conserva `status=accepted` como semantica HTTP y registra
  `latest_delivery_status=read` en metadata.
- El nuevo `external_event_log` no contiene `payload` crudo ni claves de texto.
  Verificacion financiera: 0 movimientos y 0 `debt_payments` creados. No hubo
  segundo envio.
- Suite final: 127 archivos pasaron, 3 omitidos; 690 tests pasaron, 6 omitidos.
  Typecheck y build pasaron. Lint termino con 0 errores y 2 warnings
  preexistentes fuera de este corte.

Regla de cierre:

Corte 30 requiere tests, build/deploy, fixtures V2 sanitizados, recuperacion
firmada desde evidencia real del proveedor, reconciliacion observable, cero
efectos financieros y safety hold intacto. No incluye otro envio humano ni
WhatsApp Flow.

---

## Corte 31 - Captura Financiera Externa Por Email V1

Estado: cierre tecnico de Gates A-E completado y desplegado el 23 de julio de
2026. Gate F permanece bloqueado externamente por corpus real consentido; no
hay instituciones anunciadas como soportadas.

Auditoria previa:

- Se reviso la documentacion raiz, Fases 1 a 6, handoff visual, codigo,
  migraciones y estado remoto sanitizado.
- El contrato consolidado y las contradicciones resueltas viven en
  `docs/fase_4_tecnica/26_auditoria_captura_financiera_externa_v1.md`.
- El alcance no es "agregar Yape/BCP". Es cerrar parser configurable,
  semantica financiera, Pending/Core, dedup, canales, operacion, privacidad y
  activacion institucional verificable.

Estado que abrio el corte:

- Gmail OAuth/PubSub/History y el transporte seguro ya funcionan.
- `parser_config` se carga, pero el parser actual no lo interpreta.
- El parser actual es generico, hardcodeado y solo produce `gasto`/`ingreso`.
- No existen templates productivos habilitados ni corpus P0/P1 verificado.
- No existen SLO ni salud operacional por institucion/template.
- Produccion conserva una conexion Gmail real activa, un email fixture
  procesado y su Pendiente archivado; `email_parse_templates` tiene cero filas.

Gates autorizados:

1. Contrato de parser y corpus versionado.
2. Semantica financiera y resolucion conservadora.
3. Pending, Core especializado y dedup.
4. Canales, batching, lifecycle y modo discreto.
5. Operacion, privacidad, retencion y costos.
6. Activacion P0 + P1 solo con remitente autenticado, consentimiento
   versionado, shadow, QA por metricas y monitoreo.

Regla:

- No insertar remitentes documentales como allowlist productiva.
- No hardcodear bancos en el parser.
- No marcar el corte como completado por un fixture o un solo proveedor.
- No ejecutar transferencia, deuda o recurrente por movimiento generico.
- Open banking e integraciones bancarias directas siguen fuera de V1.

Implementacion cerrada:

- Gate A: `gmail_parser_v1` validado con Zod, matching sender + subject,
  extraccion driven-by-DB, fallback identificable, version/rollback y golden
  tests. No existe logica institucional hardcodeada.
- Gate B: enriquecimiento conservador de cuenta, deuda, recurrente,
  transferencia y devolucion. Las acciones ambiguas quedan separadas.
- Gate C: confirmacion/edicion/rechazo, "Ya lo registre", endpoints batch con
  IDs explicitos, idempotencia y rutas atomicas especializadas para deuda,
  recurrente y transferencia.
- Gate D: backfill `dashboard_only`, reconciliacion Email/WhatsApp, agrupacion,
  consentimiento, ventana, quiet hours, frecuencia y modo discreto.
- Gate E: health diario por template/version, parse/fallback/p95/watch/token,
  eventos atascados, `failed` + `dead_letter`, uso Gmail y conversion de
  Pendientes; exportacion y eliminacion self-service sin exponer tokens.
- Migraciones `034_email_capture_quality.sql`,
  `035_email_content_dedup_backfill.sql` y
  `036_email_health_dead_letters.sql` aplicadas y alineadas local/remoto.

QA y evidencia:

- Parser: 9 tests; enriquecimiento financiero: 6 tests.
- Suite final: 134 archivos pasaron, 3 omitidos; 729 tests pasaron, 6
  omitidos.
- `npm run typecheck`: OK.
- `npm run lint`: 0 errores; 2 warnings preexistentes fuera del corte.
- `npm run build`: OK con Next.js 16.2.7.
- Smoke Gmail real: OAuth/watch/PubSub idempotente, dedup por message ID y hash
  24 h, backfill Dashboard-only, RLS, desconexion/archivo y cero movimientos
  automaticos.
- Smoke Core especializado real: deuda atomica e idempotente, recurrente
  atomico, transferencia por rama dedicada, Pending/outbox atomicos y saldos
  finales verificados.
- Smoke privacidad real: export autenticado sin tokens, desconexion Gmail,
  eliminacion Auth, cascada y minimizacion del log externo.
- Health de produccion: saludable, sin targets fallidos, parse failures,
  watches/tokens enfermos, templates activos obsoletos ni fallos silenciosos.
- QA visual de produccion con fixture temporal: Settings muestra export/borrado;
  el borrado exige `ELIMINAR MI CUENTA` y permanece deshabilitado antes de la
  frase; Pendientes batch exige seleccion explicita. No se confirmo/rechazo
  ningun dato real y la fixture se elimino al terminar.
- Deployment Vercel `dpl_BpTNz1ahVDkxuBcMbKZ4yXDA3F4T`, alias
  `https://manzana.website`.

Bloqueo externo declarado:

- Gate F no se simula con remitentes de documentacion ni fixtures inventados.
- Por cada institucion P0/P1 faltan autenticidad de remitente, consentimiento
  versionado, shadow, QA de falsos positivos, cohorte minima y monitoreo de una
  semana.
- Hasta superar ese proceso, el motor esta listo pero no se promete soporte
  publico para Yape, BCP, Interbank, BBVA, Plin ni otra institucion.
- Open banking directo sigue fuera de V1 y requiere decision legal, tecnica y
  de producto separada.

Siguiente:

- Ejecutar Gate F institucion por institucion cuando exista el corpus real
  consentido. No abrir un corte de parches por marca ni insertar allowlists
  documentales.

---

## Ampliacion Corte 31 - EmailExtractionAgent Controlado

Fecha: 23 de julio de 2026.

Decision:

- La extraccion flexible de avisos bancarios pertenece a un unico
  `EmailExtractionAgent`, no a agentes hardcodeados por Yape/BCP ni al Core.
- La seleccion de sender/contexto/template permanece deterministica y
  versionada por institucion.
- El agente recibe solo remitente ya verificado, asunto/cuerpo transitorio,
  institucion, fecha y template. No recibe DB, tools, IDs financieros ni
  autoridad de escritura.
- Cada valor debe aportar evidencia literal. Un validador deterministico
  descarta output no grounded o contradictorio.
- Enriquecimiento, resolucion de cuenta/deuda/recurrente/transferencia, dedup,
  Pending, confirmacion y Core conservan sus responsabilidades existentes.

Que se implemento:

- `EmailExtractionAgent` con Structured Output Zod estricto para tipo de aviso,
  estado, direccion, monto, moneda, fecha, comercio, pistas de cuenta
  origen/destino e identificador.
- Prompt de seguridad que trata el correo como input no confiable y prohibe
  seguir instrucciones/enlaces contenidos en el email.
- Grounding literal por campo y guard deterministico para impedir que un
  rechazo explicito sea tratado como operacion completada.
- Integracion primaria en Gmail ingestion con fallback al parser
  deterministico; avisos `rejected`, `pending` e `informational` no crean
  Pendiente.
- Ejecucion `shadow` del agente sin dedup, Pending ni escritura financiera.
- Transferencias con hints de origen/destino separados y resolucion hacia la
  ruta especializada existente.
- Health agregado del agente en el job de email y migracion
  `037_email_extraction_agent_health.sql`, sin cuerpo, evidencia, monto,
  comercio, cuenta ni token.
- Disclosure visible en Settings y contrato de privacidad actualizado para
  procesamiento transitorio con proveedor de IA.

Corpus y privacidad:

- Se inspeccionaron localmente cuatro EML BCP autorizados: dos compras, una
  transferencia entre cuentas propias y un rechazo por fondos insuficientes.
- Solo se versionaron fixtures sinteticos con valores ficticios. Los cuerpos,
  datos y hashes reales no se guardaron ni se enviaron a un modelo.
- El smoke API uso exclusivamente los cuatro fixtures sinteticos.

QA:

- Smoke OpenAI Responses API del extractor: 4/4 familias sinteticas, provider
  `api`, grounding valido, cero tools y cero fallback.
- Suite completa: 135 archivos pasaron, 4 omitidos; 741 tests pasaron, 7
  omitidos.
- `npm run typecheck`: OK.
- `npm run lint`: 0 errores; 2 warnings preexistentes fuera del corte.
- `npm run build`: OK con Next.js 16.2.7.
- Migracion `037` aplicada y verificada local/remoto.
- Deploy Vercel READY `dpl_C7n4t8wwiq1YkcAiDoaKft63Nmqb`, alias
  `https://manzana.website`.
- Health productivo HTTP 200: saludable, cero targets fallidos y cero intentos,
  fallbacks o grounding failures del extractor porque no hay templates
  institucionales activos/shadow.
- QA visual autenticada en produccion: `Gmail financiero` muestra que el agente
  solo extrae, no decide ni registra, que el cuerpo es transitorio y puede pasar
  por el proveedor configurado. El usuario fixture temporal fue eliminado al
  terminar.

Gate F:

- BCP no se activa publicamente. Sus cuatro headers permiten verificar sender,
  DKIM y DMARC y preparar un template `shadow`; los EML reales entregados no se
  enviaron al proveedor de IA.
- El siguiente paso institucional es registrar consentimiento versionado,
  observar correos naturales en shadow, revisar falsos positivos y luego abrir
  cohorte minima solo si las metricas y el rollback cumplen Gate F.

---

## Cierre De Preparacion Gate F - Sender Auth, Consentimiento Y Shadow BCP

Fecha: 23 de julio de 2026.

Decision:

- No se usa una cuota de muestras para ensenar al agente ni para habilitar una
  institucion. Los ejemplos sinteticos prueban el contrato; los correos naturales
  posteriores miden su calidad operacional.
- Gmail solo puede descargar el cuerpo de un remitente financiero seleccionado
  despues de validar `From` exacto, DKIM y DMARC alineados en un
  `Authentication-Results` emitido por Google.
- El envio transitorio de asunto/cuerpo al proveedor de IA exige consentimiento
  separado, revocable y versionado como `email_ai_extraction_v1`.
- El agente solo extrae datos grounded. El dominio deterministico conserva
  clasificacion, resolucion, dedup, Pending, confirmacion y escritura financiera.

Que se implemento:

- Autenticacion de sender antes de descargar el cuerpo. Un fallo queda como
  metadato seguro `sender_authentication_failed`; no llega al agente ni crea
  Pendiente.
- Toggle `Permitir extraccion bancaria con IA` y API autenticada
  `/api/v1/email/ai-consent`.
- OpenAI Responses API con `store: false`; el disclosure distingue ese control
  de los logs de seguridad del proveedor.
- Politica de activacion institucional por metricas: grounding mayor o igual a
  99%, fallback menor a 10%, cero errores criticos, revision shadow y rollback
  listo.
- Template BCP `bcp-agent-shadow-v1` en modo `shadow`, asociado solo al remitente
  exacto `notificaciones@notificacionesbcp.com.pe`.
- Migracion `038_email_sender_auth_shadow_policy.sql` aplicada y verificada en
  local/remoto.

Privacidad:

- Los cuatro EML reales se usaron localmente solo para inspeccionar headers de
  autenticacion. Sus cuerpos y hashes no se persistieron, no se versionaron y no
  se enviaron a OpenAI.
- Los correos historicos no se reproducen automaticamente. Un backfill futuro
  requeriria consentimiento ya activo y una decision operacional separada.
- El `WORKER_SECRET` productivo se roto durante el QA y se retiro su valor local
  despues de una exposicion accidental en la salida de terminal.

QA:

- Suite completa: 137 archivos pasaron, 4 omitidos; 752 tests pasaron, 7
  omitidos.
- `npm run typecheck`: OK.
- `npm run lint`: 0 errores; 2 warnings preexistentes fuera del corte.
- `npm run build`: OK con Next.js 16.2.7.
- Health publico: HTTP 200 y Supabase saludable.
- Health interno: HTTP 200, cero targets fallidos; BCP en `shadow`, cero matches
  y cero intentos del agente, estado esperado antes del consentimiento y de un
  nuevo correo natural.
- Deployment funcional validado: Vercel READY
  `dpl_28dqiJ7vLETftgdP23fgn7sF5oCZ`, alias `https://manzana.website`.

Estado de Gate F:

- Preparacion tecnica cerrada.
- Activacion publica no aprobada.
- El siguiente paso es que el usuario habilite el consentimiento en Settings,
  observar correos BCP nuevos en `shadow` y abrir una cohorte minima solo cuando
  las metricas anteriores hayan sido revisadas.

Observacion posterior al consentimiento:

- El consentimiento `email_ai_extraction_v1` quedo activo y Gmail conserva
  `watch_active`.
- El primer mensaje BCP reevaluado desde History fue rechazado por
  `dkim_pass_missing`. El cuerpo no se descargo y el agente tuvo cero intentos;
  ese fail-closed fue correcto para la version desplegada.
- El diagnostico de los cuatro EML exportados encontro DKIM pass alineado en
  `header.i`; el verificador solo leia `header.d`. Ahora acepta cualquiera de
  las dos propiedades estandar y sigue exigiendo DKIM + DMARC alineados.
- Ese rechazo de seguridad estaba sumando como fallo del parser. La migracion
  `039_email_sender_auth_health.sql` separa ambos conceptos, recalcula el
  contador del template y agrega targets de cero descargas tras rechazo y
  razones controladas.
- Resultado verificado: `parse_failure_count=0`, un rechazo de autenticacion,
  cero violaciones de descarga y ambos targets de sender auth en verde.
- Migracion `039` aplicada local/remoto. Validacion final: 137 archivos y 754
  tests pasaron; 4 archivos y 7 tests quedaron omitidos; typecheck y build OK,
  lint sin errores y con dos warnings preexistentes fuera del corte.

Backfill real autorizado:

- El usuario autorizo expresamente enviar los cuatro EML reales al proveedor de
  IA despues de activar el consentimiento. Hubo reintentos tecnicos durante el
  hardening; ningun cuerpo, cita, valor ni hash se persistio.
- Resultado semantico: 4/4 familias correctas, incluidas dos compras, una
  transferencia `internal` entre cuentas propias y un rechazo; provider API,
  cero tools y cero escrituras financieras.
- Se generalizo el grounding para fechas con mes textual, caracteres invisibles
  y cuentas enmascaradas. Una reparacion deterministica solo puede usar un
  fragmento literal del mismo correo y nunca cambia decisiones financieras.
- Si un aviso no completado contiene un campo opcional ambiguo, ese campo se
  elimina en lugar de aceptar un valor dudoso.
- El timeout tecnico del extractor sube a 20 s para correo asincrono, pero el
  target de p95 se mantiene en 10 s y degrada health si se supera.
- Migracion `040_email_extraction_repair_health.sql` aplicada local/remoto:
  registra solo agregados 4/4, contenido no persistido y cero tools; anade
  targets de reparacion <20% y normalizacion <10%. BCP permanece `shadow` y
  `draft`, con `parse_failure_count=0`.
- Validacion posterior al hardening: 137 archivos y 758 tests pasaron; 4
  archivos y 7 tests omitidos; typecheck/build OK y lint sin errores, con los
  dos warnings preexistentes fuera del corte.
- Despliegue final READY `dpl_8UrBxHvEU2RYC7rFNC3ffcCUSREJ`, alias
  `https://manzana.website`. El health publico posterior al despliegue
  respondio HTTP 200 con estado `ok` y Supabase saludable.
- El backfill autorizado se limito exactamente a los cuatro EML entregados. No
  se amplio a la bandeja Gmail ni se reabrio a la fuerza el evento productivo
  ya deduplicado.

Estado posterior:

- La transferencia entre cuentas propias fue extraida como `internal`; no se
  convirtio en gasto o ingreso y no produjo escritura financiera.
- El corpus autorizado demuestra contrato y grounding, pero no sustituye las
  metricas naturales exigidas para activar una institucion.
- BCP continua en `shadow` y `draft`. Gate F sigue cerrado hasta observar
  correos nuevos autenticados, revisar precision/latencia/fallbacks/reparaciones
  y aprobar una cohorte minima con rollback.

Primera observacion natural posterior al fix:

- Un nuevo correo BCP de transferencia entre cuentas propias entro por
  `gmail_history`, paso DKIM + DMARC mediante
  `gmail_authentication_results_dkim_dmarc` y produjo el primer
  `shadow_match_count=1`.
- El extractor clasifico el aviso como transferencia completada, pero uso
  `local_fixture` y el grounding fallo. El resultado quedo fail-closed:
  `parse_mode=shadow`, sin Pendiente y sin escritura financiera.
- Causa raiz: Production no tenia
  `AGENT_RUNTIME_EMAIL_EXTRACTION_AGENT_PROVIDER`; al conservar
  `AGENT_RUNTIME_DEFAULT_PROVIDER=local_fixture`, el agente de email heredaba
  el runtime local aunque OpenAI estuviera configurado para otros agentes.
- Se agrego explicitamente
  `AGENT_RUNTIME_EMAIL_EXTRACTION_AGENT_PROVIDER=api` en Vercel Production,
  se alinearon `.env.local`, `.env.local.example` y el contrato de runtime, y
  se mantuvo el timeout asincrono del extractor en 20 s.
- Validacion de configuracion: 14 tests dirigidos y typecheck OK. Deployment
  READY `dpl_Hp2Rbg3CgXrVi9WHcNZHcmq6fBYg`; health publico HTTP 200 con estado
  `ok`.
- El mensaje ya procesado no se reescribe ni se elimina: la siguiente
  observacion natural debe demostrar provider `api`, grounding valido y cero
  fallback antes de avanzar Gate F.

---

## Corte 32 - Fuentes Bancarias Multi-Buzon Y Confirmacion WhatsApp

Fecha: 23 de julio de 2026.

Decision:

- Cada usuario puede conectar varios Gmail y elegir, por institucion, el buzon
  receptor y el remitente exacto de notificaciones. Cambiar un banco no
  desconecta ni altera las demas fuentes.
- El agente recibe contenido solo despues de resolver la fuente configurada y
  validar remitente exacto + DKIM/DMARC. Extrae evidencia; no decide, no
  confirma y no escribe movimientos.
- Solo una fuente y template `active` + `verified` pueden crear Pendientes. El
  backfill autorizado es Dashboard-only y nunca inicia WhatsApp.
- Un Pendiente live puede avisarse por WhatsApp con botones dentro de ventana.
  Fuera de ventana requiere Utility aprobada, opt-in, caps y kill switch. El
  horario silencioso difiere la entrega y una confirmacion anterior sin
  respuesta acumula las siguientes en Dashboard.
- La activacion de BCP usa como limite de cohorte el despliegue que fijo
  `AGENT_RUNTIME_EMAIL_EXTRACTION_AGENT_PROVIDER=api`. La fila natural anterior
  con `local_fixture` se conserva para auditoria, pero no se mezcla con la
  cohorte posterior al fix ni se reescribe.

Implementacion:

- Migracion `041_email_multi_mailbox_sources.sql`: conexiones Gmail multiples,
  catalogo institucional, fuentes por usuario/banco, RPCs acotados y guardas
  transaccionales que atan Pending a usuario, conexion, institucion, sender y
  template exactos.
- APIs autenticadas para estado, consentimiento y alta/cambio/baja de fuentes.
- Settings permite conectar varios Gmail y elegir/cambiar el buzon y remitente
  de cada banco.
- Ingestion filtra la fuente antes del cuerpo, conserva dedup por conexion y
  transmite al agente solo contenido autenticado y consentido.
- El resultado activo conserva metadatos seguros de auditoria
  (`agent_notice_kind`, `agent_operation_status`, confianza, provider,
  grounding, reparaciones y normalizaciones), sin cuerpo ni evidencia literal.
- Handler outbox para confirmacion de Pending por WhatsApp, con horario
  silencioso, acumulacion, privacidad discreta, template Utility e
  idempotencia.

Decision previa a activacion BCP:

- Los cuatro EML consentidos ya demostraron 4/4 familias correctas mediante el
  proveedor API y quedaron registrados solo como agregados, sin cuerpos,
  valores, citas ni hashes persistidos.
- El correo natural recibido a las `2026-07-23T18:05:10Z` paso sender auth,
  provider `api`, transferencia completada, confianza `0.99`, grounding valido,
  cero fallback, cero reparaciones y cero normalizaciones.
- Para la cohorte posterior al fix: grounding `1.00`, fallback `0.00`,
  reparacion `0.00`, normalizacion `0.00`, errores criticos `0`; rollback a
  `shadow` esta listo. Esta evidencia autoriza promover BCP sin eliminar el
  intento historico fallido.
- Promocion ejecutada a las `2026-07-23T18:21:10Z`: template BCP
  `active/verified` y fuente exacta del usuario `active/verified`. La fila
  shadow usada como evidencia permanece inmutable y no se reprocesa.
- Tras promover, el corte sigue abierto hasta que un correo BCP nuevo cree un
  Pending live, se entregue por WhatsApp, el usuario lo confirme y el Core
  especializado persista exactamente una operacion.

QA tecnico cerrado hasta esta decision:

- Migracion `041` aplicada local y remotamente. El smoke transaccional valido
  dos Gmail, fuentes BCP/Yape separadas, cambio de buzon/sender, shadow
  fail-closed, activacion, outbox, idempotencia, baja acotada y desconexion
  selectiva.
- Suite completa: 140 archivos pasaron, 4 omitidos; 771 tests pasaron, 7
  omitidos. La ampliacion posterior cubrio consumo -> gasto/cuenta origen,
  deposito -> ingreso/cuenta destino y transferencia ->
  `record_transfer`/ambas cuentas; resultado final: 140 archivos pasaron, 4
  omitidos; 774 tests pasaron, 7 omitidos. Typecheck y build OK; lint sin
  errores y con dos warnings preexistentes fuera del corte.
- Deployment READY `dpl_43wyDmo7JDg36t2JpDChQnL2fD3u`, alias
  `https://manzana.website`; health publico `ok` y Supabase saludable.
- QA visual autenticada desktop/movil verifico dos Gmail, fuentes BCP/Yape,
  cambio de buzon/remitente y layout responsive. El fixture temporal fue
  eliminado con cascade verificada.
- Template Utility `manzana_movimiento_por_confirmar_v1`, ID
  `1687262626738855`, continua `PENDING`; hasta su aprobacion la ruta fuera de
  ventana queda deliberadamente Dashboard-only. La ruta interactiva dentro de
  ventana no depende de esta aprobacion.
- La consulta directa de componentes en Meta confirmo que la copia remota
  conserva correctamente UTF-8 (`revision`, `Abrelo`, `confirmacion`, con sus
  tildes en la plantilla real) y que el boton URL apunta a
  `https://manzana.website/?view=pending`. Un render mojibake observado en
  PowerShell era solo decodificacion local del terminal, no contenido enviado a
  Meta. No queda drift de contenido; solo falta el cambio externo a
  `APPROVED`.

QA real posterior a activacion:

- Dos correos BCP live posteriores a Gate F pasaron remitente exacto,
  DKIM/DMARC, provider API, grounding y dedup. Crearon exactamente dos
  Pendientes: transferencia propia por S/1 y Yape por S/10; cero movimientos y
  cero cambios de saldo antes de confirmacion.
- El primer intento de entrega quedo Dashboard-only porque Production no
  aplico `WHATSAPP_SEND_EMAIL_PENDING_CONFIRMATIONS=true`. Se corrigio la
  variable, se redeployo y se reencolaron los mismos Pendientes con IDs
  deterministas, sin releer correos ni duplicar items.
- Ambos WhatsApp interactivos quedaron `accepted`, luego `delivered` y `read`.
  Los Pendientes pasaron a `sent_for_confirmation`; aun no fueron confirmados.
- La observacion real encontro una ambiguedad valida: Manzana solo tenia
  `Efectivo` y `Tarjeta BCP`, sin las cuentas `****3087`, `****9039` o
  `****5019`. El Core no permite confirmar una transferencia sin origen y
  destino resueltos.
- Esa ambiguedad no se resolvera creando cuentas con nombres hardcodeados. Se
  adopta el contrato general de revision conversacional: proponer cuentas
  activas por sus nombres reales, completar origen/destino, reclasificar un
  pago externo como gasto/ingreso con cuenta opcional, o descartar sin
  registrar.
- El planificador puede interpretar la eleccion, pero el dominio valida
  pertenencia, moneda, IDs, cuentas distintas y categoria. Editar la propuesta
  no toca saldos y siempre exige una confirmacion posterior por Core.
- El aprendizaje de pistas como `****3087` queda separado de la eleccion
  puntual: solo se persiste si el usuario establece o solicita recordar la
  asociacion de forma explicita.
- El contrato ya esta implementado. `financial_resolution` admite `review`,
  `assign_transfer`, `classify_expense` y `classify_income`, junto a IDs de
  cuenta/categoria tomados exclusivamente del Context Pack. El compilador y el
  dominio vuelven a validar objetivo, pertenencia, moneda y consistencia.
- `pending-account-review` propone solo cuentas activas compatibles; resuelve
  por IDs validados o por los nombres reales del usuario, edita el Pendiente
  como `user_edited` y vuelve a pedir confirmacion. Gasto/ingreso pueden quedar
  sin cuenta y usan `otros` como categoria explicita de revision si el usuario
  no eligio otra.
- El vinculo persistente de una pista enmascarada usa
  `accounts.metadata.email_account_hints` con auditoria
  `whatsapp_user_explicit`, `linked_at` y `trace_id`. Una seleccion puntual no
  activa ese aprendizaje.
- Los nuevos interactivos usan idempotencia `whatsapp:v2`: un
  `review_specialized` muestra `Revisar/Descartar`; un Pendiente ya completo
  conserva `Confirmar/Descartar`. Una plantilla antigua que entregue
  `Confirmar` sobre un item incompleto tambien degrada a revision, nunca a
  escritura.
- Tambien se corrigio un falso match: el hint textual `Yape` ya no puede
  resolverse por fallback como la cuenta BCP emisora. El Pendiente afectado se
  corrigio de forma acotada mientras seguia sin confirmar y conserva metadato
  de auditoria.
- Si el usuario pulsa confirmar sin completar las cuentas, WhatsApp ahora
  explica que debe elegir origen/destino y enlaza a Pendientes, en vez de
  fallar o adivinar. El envio exitoso sobrescribe correctamente la razon de
  politica anterior con `interactive_sent`.
- Validacion de este hardening: 54 pruebas dirigidas; suite completa con 140
  archivos pasados, 4 omitidos, 776 tests pasados y 7 omitidos. Typecheck OK;
  lint sin errores y con los mismos dos warnings preexistentes. Deployment
  READY `dpl_7SbS4Z4UPKRQyn32usuZ7V8PPU3H`, alias
  `https://manzana.website`; health publico `ok`.
- El smoke transaccional especializado se actualizo al contrato de la
  migracion 041: institucion + fuente exacta activas/verificadas y metadata
  Gate F. Contra produccion creo un usuario fixture temporal y probo pago de
  deuda, pago recurrente y transferencia, confirmacion atomica, tres
  movimientos exactos, saldos esperados e idempotencia del retry. Resultado
  `ok`, run `1f7f2e7a-2c53-4ebb-b4c2-4f777a727ba4`; usuario, fuente, template e
  institucion fixture quedaron eliminados y se verifico conteo cero.
- Suite posterior a la revision conversacional: 141 archivos pasaron, 4
  omitidos; 788 tests pasaron y 7 se omitieron. Typecheck y build Next
  `16.2.7` pasaron; lint quedo en cero errores y los mismos dos warnings
  preexistentes.
- El smoke live read-only se ejecuto sobre los dos Pendientes reales
  (`P-2483A40C` y `P-34EA2DFD`). Ambos devolvieron exactamente `Efectivo` y
  `Tarjeta BCP` como opciones PEN; status, propuesta, cantidad de movimientos
  y saldos quedaron identicos antes/despues.
- El smoke por OpenAI API paso 2/2 y verifico Structured Output del nuevo
  contrato, incluida la asociacion semantica explicita `****3087` ->
  `Tarjeta BCP`, `****9039` -> `Efectivo`, con
  `learn_account_aliases=true`; no ejecuto Core.
- El smoke transaccional conversacional creo un usuario y una fuente email
  temporales en la base real. Con cuentas llamadas `Mi cuenta principal` y
  `Mi bolsillo diario` completo una transferencia desde
  `review_specialized`, exigio reconfirmacion, ejecuto Core, verifico saldos
  `200/10 -> 180/30` e idempotencia del retry. Luego reclasifico un aviso Yape
  como gasto `otros` sin cuenta, confirmo sin alterar saldos de cuentas y
  descarto un tercer aviso sin escritura financiera.
- El mismo smoke comprobo aprendizaje explicito y auditable de `****3087` y
  `****9039`, exactamente dos movimientos, dos Pendientes confirmados y uno
  descartado. Run `e7d350ce-a951-463c-96ff-397a174dfcf5`; usuario, fuente,
  template, institucion y datos financieros fixture quedaron eliminados con
  conteo residual cero.
- La tarjeta WhatsApp v2 del Pendiente real `P-2483A40C` se envio una sola vez
  dentro de ventana con `Revisar/Descartar`, idempotencia
  `email-pending:87d7e063-4252-43bf-a9fb-4e9f7c604648:whatsapp:v2` y
  `financial_write=false`. Kapso la acepto y Meta reporto `read`; mientras el
  usuario no pulse una opcion, propuesta, movimientos y saldos permanecen
  intactos.
- El usuario pulso `Revisar` y el evento interactivo live fue aceptado con
  `accepted_with_pending_resolution_clarification`. La respuesta detecto las
  pistas `****3087`/`****9039`, ofrecio solo las cuentas reales `Efectivo` y
  `Tarjeta BCP`, y explico las rutas transferencia, gasto con/sin cuenta y
  descarte. El Pending siguio `review_specialized` y la busqueda exacta por
  `pending:{id}` y `gmail:{connection}:{message}` devolvio cero movimientos:
  revisar no escribe ni presupone la eleccion.
- El usuario respondio en lenguaje natural que no queria registrar la
  transferencia. El planner la resolvio como descarte y el orquestador termino
  `accepted_with_pending_discarded`; `P-2483A40C` quedo `discarded`, con cero
  movimientos vinculados y saldos `Efectivo S/837` / `Tarjeta BCP S/165`
  intactos.
- Cerrado ese item, se envio exactamente una tarjeta v2 para el segundo
  Pendiente live `P-34EA2DFD` (Yape S/10). La ventana estaba abierta, el intento
  interactivo quedo `accepted/read`, `requires_review=true` y
  `financial_write=false`; el Pending continua `sent_for_confirmation` hasta
  que el usuario revise, reclasifique o descarte.
- El usuario reviso `P-34EA2DFD`, lo reclasifico en lenguaje natural como
  gasto desde `Tarjeta BCP` y recibio una nueva reconfirmacion
  `Confirmar/Descartar`. Esa edicion produjo `pending_edited`, no movimiento ni
  cambio de saldo. Al pulsar `Confirmar`, el orquestador termino
  `accepted_with_pending_confirmed` y el Core creo exactamente un movimiento
  confirmado por S/10, `source_ref=pending:{id}` e idempotencia
  `pending-confirm:{id}`.
- La ejecucion live dejo `P-34EA2DFD=user_confirmed`, saldo `Tarjeta BCP`
  `S/165 -> S/155` y `Efectivo=S/837`. `movement_created` y
  `pending_confirmed` salieron por outbox con un intento, quedaron `published`
  y sus consumidores terminaron sin error. Un retry posterior encontro cero
  Pendientes activos y mantuvo exactamente un movimiento y los mismos saldos.
  La pista `****5019` no se aprendio automaticamente porque el usuario no
  solicito recordarla.
- Ese QA mostro delivery status fuera de orden (`read` seguido de `sent`). La
  reconciliacion ahora es monotona (`sent -> delivered -> read`), conserva
  `failed` terminal y registra por separado el ultimo evento recibido para
  auditoria. El smoke transaccional `read -> sent` termino en `read`, sin
  escritura financiera y con cero residuos; run
  `14a9deee-6283-471f-93be-3656e926c3f3`.
- El intento live afectado fue reconciliado nuevamente desde sus dos eventos
  inmutables (`read`, luego `sent`) y quedo restaurado en `read`. La verificacion
  antes/despues confirmo Pending y cantidad de movimientos identicos, con
  `financial_write=false`.
- Validacion posterior: suite completa con 141 archivos pasados, 4 omitidos,
  788 tests pasados y 7 omitidos; typecheck y build Next `16.2.7` OK; lint con
  cero errores y los mismos dos warnings preexistentes. Deployment final READY
  `dpl_9bWBazA7gWuDuoNbE5xEPrZJyWzw`, alias `https://manzana.website`; health
  publico `ok` y Supabase saludable.

Auditoria de cierre del Corte 32:

| Requisito | Evidencia actual | Estado |
|---|---|---|
| Varios Gmail por usuario | Migracion 041, API, UI y smoke con dos buzones | Probado |
| Elegir banco + buzon + remitente exacto | `user_email_sources`, Settings y QA autenticada | Probado |
| Cambiar buzon/remitente sin afectar otros bancos | RPC/API, smoke transaccional y QA UI | Probado |
| Filtrar antes del cuerpo | Fuente exacta + DKIM/DMARC + consentimiento; correo no bancario descartado con `contentFetches=0` | Probado |
| Agente solo extrae | Provider API, grounding, cero tools y contenido no persistido | Probado |
| Consumo, deposito y transferencia | Tests activos a Pending; EML autorizados y dos transferencias BCP live | Probado |
| Nada toca saldo antes de confirmar | Dos Pendientes live, cero movimientos antes de confirmacion | Probado |
| Aviso WhatsApp live | Dos mensajes Kapso `accepted`/`delivered`/`read`, IDs idempotentes | Probado |
| Confirmacion usa Core especializado | Smoke produccion con transferencia, deuda y recurrente; saldos e idempotencia correctos | Probado con fixture |
| Revision inteligente de cuentas | Planner + dominio + WhatsApp v2; 788 tests, API smoke y smoke live read-only sobre ambos Pendientes | Probado |
| Confirmacion real del usuario | `P-2483A40C` descartado sin escritura; `P-34EA2DFD` revisado, reclasificado, reconfirmado y ejecutado por Core como un unico gasto S/10 con saldo `165 -> 155` | Probado |
| Aviso fuera de ventana | Utility email-pending enviada a Meta, aun `PENDING` | Pendiente externo |

---

## 13. Regla De Mantenimiento

Cada entrada futura debe incluir:

```text
Fecha:
Corte:
Que se implemento:
Archivos principales:
Que quedo mockeado:
Pruebas ejecutadas:
Capturas/artefactos:
Deuda tecnica nueva:
Siguiente paso:
```

No marcar un corte como completado si:

- no paso typecheck/tests/build cuando aplica,
- no tiene QA visual si toca UI,
- contiene mocks no declarados,
- rompe una regla no negociable del Core,
- mezcla pendientes con movimientos confirmados,
- o deja decisiones nuevas sin documentar.

---

## 14. Resumen

Manzana ya tiene una base tecnica y de producto desplegada: auth, Core,
movimientos, cuentas/cajas, Pendientes, deudas/cuotas, recurrentes, Pagos que
vienen, avisos Dashboard y workers diarios con QA real. El corte de motores
hibridos de calidad esta implementado y desplegado; sus migraciones, jobs,
APIs y pantalla real de Descubrimientos pasaron QA tecnico en staging.

La infraestructura de activacion proactiva tambien esta desplegada: gate
acumulativo, consentimiento atomico, aprobacion live de templates, cohortes,
readiness y metricas. El primer template Utility esta `APPROVED`, el pago fue
atestado y el piloto real de cohorte unica produjo exactamente un envio
`accepted`, luego reconciliado como `delivered/read` desde el estado real de
Kapso. El sistema regreso a `planned` con kill switch apagado y Gate B quedo
cerrado.

Todavia no tiene una V1 completa. El onboarding inicial real ya cubre inicio y
primer valor; sus etapas de retencion posteriores siguen fuera de alcance. El
motor Gmail V1 ya esta implementado, migrado, desplegado y probado contra
OAuth, watch, Pub/Sub, History, parser configurable, Pendientes, Core
especializado, privacidad y health. Permanece deliberadamente limitado a
`gmail.readonly` y confirmacion humana. La activacion de cada institucion sigue
bloqueada hasta autenticar sender, registrar consentimiento versionado, medir
shadow, abrir cohorte minima y monitorear una semana; no se promete soporte
publico antes de ese Gate F. El
hueco operacional transversal restante es medir precision, latencia, delivery y
feedback con volumen real, sin ampliar cohortes por implicacion.
Los insights avanzados, sus agentes y su
superficie visual ya existen. La capa conversacional agentic ya esta
implementada y desplegada con planner semantico, tool calling read-only,
correcciones seguras, working set, memoria financiera aprendida, experiencia de
respuesta y evaluacion versionada. Su flujo tecnico central quedo probado de
extremo a extremo contra produccion; el pago de deuda ya paso QA humano estricto,
pero la operacion conversacional completa aun requiere metricas con volumen real.
La
prioridad sigue siendo cerrar cada pieza sin romper Core, RLS, trazabilidad ni
confirmacion humana.

El pago de deuda desde WhatsApp ya no es una brecha de escritura: pasa por
`RecordDebtPaymentCommand`, validacion deterministica y el RPC atomico del Debt
Engine/Core. Su QA financiero de staging cubre pago parcial, liquidacion,
idempotencia, ambiguedad, sobrepago, moneda, cuenta opcional y outbox. El gate
humano del transporte WhatsApp paso los cinco escenarios exigidos, sin
violaciones ni Pendientes; queda observabilidad con volumen real, no una brecha
de escritura.

*Fase 4 Tecnica - Documento 23b - Seguimiento Vivo V1*
