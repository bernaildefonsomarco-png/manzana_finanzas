# 02 — Mapa de herencia del corpus legacy

**Bloque:** 00 — Gobierno
**Estado:** V1
**Fecha:** 25 de julio de 2026
**Depende de:** `01_convenciones_y_plantillas.md`
**Documentos que dependen de este:** todos — es el único lugar autorizado para decidir qué se hereda de `docs/`

---

## 1. Para qué existe este documento

`docs/` tiene 54 documentos (~52.500 líneas) más dos documentos raíz del
proyecto. Parte de ese trabajo es excelente y se pierde si lo reescribimos
desde cero; parte está construido sobre una tesis que vamos a invertir
(que el Dashboard es una capa de revisión subordinada a WhatsApp) y
reescribirlo sin decirlo produce contradicciones silenciosas.

Este documento es el **contrato antifuga**: nada de `docs/` entra al corpus
nuevo sin pasar por esta tabla. Si un documento de `documentacion/app_web/`
necesita un dato, una fórmula o una regla de `docs/`, se cita la ruta exacta
y se verifica que la clasificación de abajo lo permita.

## 2. Las cuatro clasificaciones

| Clasificación | Qué significa |
|---|---|
| **REUTILIZAR** | El documento es un activo fuerte. Se usa como fuente directa, con actualizaciones menores si el código avanzó desde que se escribió. |
| **REESCRIBIR** | La tesis o el alcance del documento está mal para una app web vendible sola. Se usa como insumo de contraste (qué NO hacer) y se reescribe con nueva ambición. |
| **CONGELAR-WHATSAPP** | El contenido es válido pero pertenece a la fase 2 (WhatsApp). No se toca ahora; se descongela cuando nazca `documentacion/whatsapp/`. |
| **DESCARTAR** | El documento quedó superado por decisiones posteriores o nunca se completó; no tiene destino en el corpus nuevo. |

---

## 3. Documentos raíz del proyecto

| Doc origen | Título | Clasificación | Destino | Qué se rescata | Justificación |
|---|---|---|---|---|---|
| `especificacion_producto_finanzas_personales_ia.md` | Especificación de producto V1.0 | **REESCRIBIR** | `06_tesis_app_web.md`, `07_alcance_web_v1.md` | §5 (filosofía, "wow"), §8-9 (movimiento financiero, tipos canónicos), §17-22 (dominio financiero) | Todo el documento asume WhatsApp como interfaz principal (§1, §11, §25). El dominio financiero (tipos de movimiento, cuentas/cajas, categorías, deudas, recurrentes) es sólido y se reutiliza vía los docs 24-31; la tesis de producto se invierte. |
| `roadmap_documentacion_completa.md` | Roadmap de documentación — orden de ejecución | **DESCARTAR** | — | El *método* (cada paso desbloquea al siguiente, no pasar todo a un agente de una vez) | Es un plan de ejecución ya cumplido para el corpus anterior. Su sucesor funcional es este mismo mapa (doc 02) más el orden de olas de `00_indice_maestro.md`. No aporta contenido de producto. |

---

## 4. Fase 1 — Identidad (`docs/fase_1_identidad/`)

| Doc origen | Título | Clasificación | Destino | Qué se rescata | Justificación |
|---|---|---|---|---|---|
| `01_user_personas.md` | User Personas (Camila/Diego/Valentina) | **REUTILIZAR** | `06_tesis_app_web.md`, `44_onboarding_web.md` | Comportamiento de registro, uso parcial, peso psicológico (§9-14) | Es conductual y accionable, no demográfico. Sobrevive al pivote casi entero; falta un journey "llego por la web" que se añade en doc 06. |
| `02_nombre_producto.md` | Nombre del producto y sistema de planes | **REESCRIBIR** | `54_plan_de_implementacion_web.md` (naming ya cerrado, no se retoca); la tabla de planes se rehace en negocio/pricing fuera de este corpus técnico | El nombre "Manzana" y el tono de marca | La tabla de planes está marcada como "borrador preliminar" desde mayo 2026 y el "Paso 7 Modelo de Negocio" prometido nunca se escribió. No es prioridad de este corpus (que es técnico-funcional), se deja anotado como pendiente de negocio. |
| `03_analisis_competitivo.md` | Análisis competitivo | **REESCRIBIR** | Insumo para `07_alcance_web_v1.md` §1 (contexto) | Los "competidores invisibles" (no registrar nada) como marco | Todo el eje competitivo compara "WhatsApp vs apps financieras". Para una app web con IA propia el mapa competitivo cambia (compite con Fintonic, YNAB, Mobills, no con "notas de WhatsApp"). Se re-evalúa fuera del alcance técnico de este corpus. |
| `04_tam_sam_som.md` | Dimensionamiento de mercado | **DESCARTAR** (para este corpus) | — | — | Es de negocio/inversión, no de producto o técnico. No tiene destino en `documentacion/app_web/`; se conserva en `docs/` como referencia histórica. |

---

## 5. Fase 2 — Estrategia / Alcance V1 (`docs/fase_2_estrategia/alcance_v1/`)

| Doc origen | Título | Clasificación | Destino | Qué se rescata | Justificación |
|---|---|---|---|---|---|
| `05a_whatsapp.md` | WhatsApp conversacional | **CONGELAR-WHATSAPP** | — (se descongela en `documentacion/whatsapp/`) | — | Comandos, ventana 24h, modo discreto conversacional: todo es específico del canal WhatsApp. |
| `05b_motor_ia.md` | Motor IA (FinancialOrchestrator, AgentRuntime, agentes) | **REESCRIBIR** (70%) + **REUTILIZAR** (30%) | `20_arquitectura_motor_conversacional.md` a `23_runtime_ia_modos_costo_y_degradacion.md` como contraste; §13 (guardrails financieros), §12 (confianza/riesgo), §18 (explicabilidad) se reutilizan | Guardrails financieros, invariantes de confianza y explicabilidad | El diseño de agentes está construido para el turno conversacional de WhatsApp y tiene los problemas P0/P1 documentados en la auditoría del 23 de julio. Los docs 20-23 se escriben **sin abrir este documento primero** (regla de la venda, ver `documentacion/app_web/03_motor_ia/`), pero sí se usa después para verificar que ningún guardrail financiero se pierda. |
| `05c_dashboard.md` | Dashboard Inteligente | **REESCRIBIR** | `39_modulo_home_resumen_financiero.md`, `07_alcance_web_v1.md` | Estructura de "jobs principales" (§4), campos del registro manual (§4.2.1) | Es la causa raíz del problema: §1 declara que el Dashboard "no debe competir con WhatsApp"; §15 prohíbe IA de escritura; §20 deja fuera presupuestos/metas/proyecciones/gráficos/reportes/exportaciones. Se invierte la tesis completa. |
| `05d_email_parsing.md` | Email parsing con confirmación | **REUTILIZAR** | `28_modulo_email_y_deteccion_bancaria.md` | Pipeline completo (§flujo), reglas de no auto-registro, dedup, ventana 24h | Único canal de captura automática que funciona sin WhatsApp — clave para la app web. Se amplía con "el usuario aporta más contexto" (decisión del usuario), pero la base es sólida. |
| `05e_cuentas_cajas.md` | Cuentas y cajas | **REUTILIZAR** | `24_modulo_cuentas_y_cajas.md` | Fórmulas de dinero libre completas, edge cases, saldo negativo | El activo más fuerte del corpus de dominio financiero: fórmulas explícitas con ejemplos numéricos. Reutilizable casi al 100%. |
| `05f_categorias.md` | Categorías, subcategorías y etiquetas | **REUTILIZAR** | `25_modulo_categorias_subcategorias_y_etiquetas.md` | 12 categorías canónicas, regla `otros` ≠ `sin clasificar`, aprendizaje por corrección | Muy específico y completo. Reutilizable al 100%. |
| `05g_insights.md` | Insights | **REESCRIBIR** | `34_modulo_descubrimientos_e_insights.md` | Los 13 tipos de insight como catálogo base, mecánica de scoring (impacto+novedad+accionabilidad) | Insights son solo descriptivos (nunca simulación, presupuesto o salud financiera) y los umbrales (40+ movimientos, 4 semanas) asumen captura sin fricción por WhatsApp; en una app web de registro manual eso significa meses sin valor. Se sube la ambición y se bajan los umbrales. |
| `05h_deudas.md` | Deudas | **REUTILIZAR** | `31_modulo_deudas.md` | Tipos de deuda, Debt Engine, estados, cuotas, personas relacionadas | Completo y bien trabajado. §10 (específico de WhatsApp) se separa; §15 (Dashboard) se amplía con RPC atómica ya implementada (migración 043). |
| `05i_recurrentes.md` | Recurrentes / Pagos que vienen | **REUTILIZAR** | `30_modulo_recurrentes_y_pagos_que_vienen.md` | Detección, calendario, naming visible (§20.1), Recurring Engine | Muy trabajado, especialmente el naming visible para Dashboard. Se amplía con "recordatorios configurables sin ejecutar nada sin aprobación". |
| `05j_nudges.md` | Nudges / Recordatorios | **CONGELAR-WHATSAPP** (parcial) | La lógica de fatiga/anti-spam (Nudge Policy) se reutiliza en `37_modulo_recordatorios_in_app.md` | Política de horario silencioso, máximo por día, anti-repetición | Es casi puro WhatsApp (el canal de entrega). Pero la política de *cuándo* interrumpir es agnóstica de canal y se reutiliza para el centro de recordatorios in-app de la web. |
| `indice.md` | Índice vivo del alcance V1.0 | **DESCARTAR** | — | Mapa de features como referencia | Reemplazado funcionalmente por `07_alcance_web_v1.md` y `00_indice_maestro.md`. |

---

## 6. Fase 3 — Producto / Experiencia (`docs/fase_3_producto/`)

| Doc origen | Título | Clasificación | Destino | Qué se rescata | Justificación |
|---|---|---|---|---|---|
| `10_principios_experiencia.md` | Principios de experiencia | **REUTILIZAR** | `08_principios_experiencia_web.md` | Jerarquía de calidad, anti-principios, fórmula de experiencia | Abstracto pero correcto y agnóstico de canal. Se amplía con tres principios nuevos: procedencia, control, reversibilidad. |
| `11_personalidad_conversacion.md` | Personalidad y conversación | **CONGELAR-WHATSAPP** | Lo transversal (matriz de tono, cuándo responder corto) informa `21_contrato_de_canal_y_presentadores.md` | Matriz de tono por situación | Muy específico de la voz conversacional de WhatsApp. Se descongela para fase 2; solo lo agnóstico de canal se usa como referencia de tono al diseñar el asistente en la app. |
| `12_lenguaje_producto.md` | Lenguaje de producto | **REUTILIZAR** | `04_glosario_y_lenguaje_visible.md` | Diccionario completo interno↔visible, microcopy, palabras prohibidas, glosario V1 | Excelente y directamente aplicable. Se amplía con vocabulario nuevo (presupuesto, meta, límite, proyección, evidencia, procedencia, olvidar). |
| `13_onboarding_activacion.md` | Onboarding y activación | **REESCRIBIR** (parcial) | `44_onboarding_web.md` | §6 (transformación emocional, primer valor) se reutiliza; §7 (flujo Dashboard-first) se reescribe entero | §7 es el único onboarding web-first existente y está subdesarrollado frente a §6 (WhatsApp-first). Se invierte la prioridad. |
| `14_flujos_usuario_v1.md` | Los 21 flujos canónicos V1 | **REUTILIZAR** (parcial) | Se reparte entre los docs de `04_modulos/` según el flujo; los ~9 WhatsApp-first (flujos 1, 2, 7, 12, 14, 15, 16) van a `56_puente_a_fase_whatsapp.md` | Los flujos dashboard/mixtos como base de casos de uso por módulo | Contrato usado por ambas auditorías como referencia; sigue siendo válido como catálogo de casos de uso, reasignado por módulo. |
| `15_retencion_lifecycle.md` | Retención y lifecycle | **CONGELAR-WHATSAPP** | — | — | La matriz de cumplimiento marca esto como "no implementado como sistema" (`C-09`) y el diseño depende fuertemente de mensajería proactiva por WhatsApp. Se retoma en fase 2. |
| `16_confianza_errores.md` | Confianza, errores y correcciones | **REUTILIZAR** | `11_confianza_errores_y_reversibilidad.md` | Modelo de confianza completo, deshacer/borrar, explicabilidad, trazabilidad | El documento que define por qué el producto se siente confiable. Reutilizable casi íntegro; se añade la separación explícita entre "reparar una respuesta" y "corregir dinero" (hallazgo P0 de la auditoría). |
| `17_dashboard_ux.md` | UX del Dashboard | **REESCRIBIR** | `39_modulo_home_resumen_financiero.md`, `10_sitemap_rutas_y_navegacion.md` | Navegación, jerarquía del primer pantallazo, estados de UX, accesibilidad | Solapa 60-70% con `05c_dashboard.md`. Se fusionan ambos en los docs 10 y 39, eliminando la duplicación y la subordinación a WhatsApp de §15.3. |
| `18_wireframes_prototipo.md` | Wireframes y prototipo | **REESCRIBIR** (parcial) | `10_sitemap_rutas_y_navegacion.md` | Inventario de componentes, matriz de captura | §23 está desactualizado: dice "sin prototipo visual aprobado" y referencia `prototypes/manzana-v3` como descartado, pero `prototypes/` está vacía y el trabajo real vive en `stitch_manzana_v1/` (161 carpetas). Se corrige esa referencia. |
| `indice.md` | Índice de Fase 3 | **DESCARTAR** | — | Orden de lectura como referencia de método | Reemplazado por `00_indice_maestro.md`. |

---

## 7. Fase 4 — Técnica (`docs/fase_4_tecnica/`)

| Doc origen | Título | Clasificación | Destino | Qué se rescata | Justificación |
|---|---|---|---|---|---|
| `06_arquitectura_sistema.md` | Arquitectura del sistema | **REUTILIZAR** | `12_arquitectura_app_web.md` | 7 capas (datos→experiencia), modo degradado | Base transversal correcta. Se amplía con el detalle real de Next.js App Router que falta hoy (rutas, layouts, streaming). |
| `15_stack_tecnologico.md` | Stack tecnológico | **REUTILIZAR** | `12_arquitectura_app_web.md` | Next.js/Supabase/Vercel, decisiones de stack ya aprobadas | Decidido y correcto; sigue vigente. |
| `16_modelo_datos.md` | Modelo de datos | **REUTILIZAR** | `13_modelo_datos_web_v1.md` | Enums canónicos, 43 tablas, RLS, orden de migraciones | El activo más valioso de todo el corpus. Se amplía con presupuestos/metas/límites, escenarios, exports, lotes de import, hilos de asistente, recordatorios, y se consolidan las migraciones 042-046 (nunca documentadas). |
| `17_eventos_workers.md` | Eventos y workers | **REUTILIZAR** | Insumo de `13_modelo_datos_web_v1.md` y `14_contratos_api_web.md` | Transactional Outbox, catálogo de workers, idempotencia | Sólido y agnóstico de canal. |
| `18_api_spec.md` | API spec | **REESCRIBIR** (parcial) | `14_contratos_api_web.md` | §5 (Dashboard API) como base del contrato actual | Falta paginación por cursor, rate limiting y CSRF — se redefine completo, no solo se documenta lo que hay. |
| `19_agent_runtime_tools.md` | Agent Runtime y Tools | **CONGELAR-WHATSAPP** (mayormente) | Lo transversal (Context Packs, principio de ToolGateway read-only) informa `20_arquitectura_motor_conversacional.md` como contraste, no como base | Principio de ToolGateway read-only | Diseñado para el runtime conversacional de WhatsApp; se redefine en los docs 20-23 desde cero (regla de la venda). |
| `20_decisiones_tecnicas.md` | Decision log técnico | **REUTILIZAR** (como formato) | Formato replicado en `03_decisiones_producto_web.md` | Estructura de decision log (no_negociable / aprobada / recomendada / pendiente / fuera de V1) | El formato es correcto y se reutiliza como plantilla; el contenido se reconstruye desde cero para las decisiones del corpus nuevo. |
| `21_decision_whatsapp_provider.md` | Decisión proveedor WhatsApp (Kapso) | **CONGELAR-WHATSAPP** | — | — | Íntegramente específico del canal WhatsApp. |
| `22_decision_email_provider.md` | Decisión proveedor Email (Gmail) | **REUTILIZAR** | `28_modulo_email_y_deteccion_bancaria.md` | OAuth, scopes, Pub/Sub, Limited Use, backfill | Transversal y correcto; el email es un canal de captura que no depende de WhatsApp. |
| `23_plan_implementacion_v1.md` | Plan de implementación V1 | **REESCRIBIR** (como formato) | Formato base para `54_plan_de_implementacion_web.md` | Invariantes no negociables (§3), estructura de "anillos", gates de calidad por corte | Superado por los hechos (16 de junio de 2026, el documento más desactualizado del set técnico) y por la separación web/WhatsApp que no contemplaba. Se reescribe con cortes propios de la app web. |
| `23b_seguimiento_construccion_v1.md` | Ledger de construcción V1 | **DESCARTAR** (como fuente activa) | Sucesor: `55_ledger_construccion_web.md` | Cronología como evidencia histórica de dónde se fue el esfuerzo | Se detuvo el 23 de julio de 2026; el trabajo posterior (ConversationalExecutiveAgent, TurnWorkspace, migraciones 042-046) nunca se registró ahí. Queda como archivo histórico en `docs/`, no se sigue escribiendo. |
| `24_paquete_identidad_meta.md` | Paquete de identidad Meta | **CONGELAR-WHATSAPP** | — | — | Específico de verificación de Meta/WhatsApp Business. |
| `25_scheduler_externo_v1.md` | Scheduler externo V1 | **REUTILIZAR** | Insumo de `19_observabilidad_y_telemetria_web.md` y `54_plan_de_implementacion_web.md` | Contrato del cron externo para `outbox_publisher` | Infraestructura pura, agnóstica de canal y de producto. Ya implementado según el ledger. |
| `26_auditoria_captura_financiera_externa_v1.md` | Auditoría de captura financiera externa | **REUTILIZAR** | `28_modulo_email_y_deteccion_bancaria.md` | Gates A-F, decisión de no hardcodear agentes por banco, brechas confirmadas (§5.2), incidente de `local_fixture` en producción | Auditoría reciente (23 de julio) y de alta calidad; el incidente documentado ahí es el precedente real del hallazgo P0.1 de la auditoría de arquitectura. |
| `auditoria_integral_arquitectura_ia_conversacional_2026-07-23.md` | Auditoría integral de arquitectura IA conversacional | **REUTILIZAR** (como diagnóstico, no como spec) | Insumo conceptual de `03_motor_ia/` (docs 20-23) y de `42_reutilizacion_del_codigo_existente_motor.md` | Veredicto ejecutivo, hallazgos P0-P2, scorecard 5.6/10, arquitectura objetivo §7 | Se usa como diagnóstico de qué salió mal, nunca como especificación heredada — los documentos 20-23 se escriben con "los ojos vendados" respecto a este documento (ver regla en `documentacion/app_web/03_motor_ia/`). Solo en el doc 42 se abre explícitamente para comparar. |
| `matriz_cumplimiento_integral_v1_2026-07-24.md` | Matriz de cumplimiento integral V1 | **REUTILIZAR** (como método y diagnóstico) | Método replicado en `50_matriz_de_trazabilidad_web.md`; contradicciones cerradas en `05_contradicciones_heredadas_cierre.md` | Niveles de evidencia (§2.2), tabla de contradicciones C-01 a C-17, veredicto de los 21 flujos | Metodológicamente es el documento más riguroso del corpus. Su método se hereda íntegro; su contenido (0/21 flujos cumplidos) es el punto de partida que este corpus busca corregir. |
| `indice.md` | Índice de Fase 4 | **DESCARTAR** | — | Orden de lectura como referencia | Reemplazado por `00_indice_maestro.md`. |

---

## 8. Fase 5 — Protección (`docs/fase_5_proteccion/`)

| Doc origen | Título | Clasificación | Destino | Qué se rescata | Justificación |
|---|---|---|---|---|---|
| `24_privacidad_proteccion_datos.md` | Privacidad y protección de datos | **REUTILIZAR** | `45_configuracion_privacidad_y_control_de_datos.md`, `15_seguridad_autorizacion_y_rls.md` | Clasificación de datos, consentimiento, retención, derechos del usuario, checklist pre-launch | Alto y accionable. §10 (específico de WhatsApp) se separa; el resto es transversal. |
| `25_unit_economics_costos.md` | Unit economics y costos | **REESCRIBIR** | Insumo de `23_runtime_ia_modos_costo_y_degradacion.md` §costo | Estructura de CostEvent/OutcomeEvent y semáforos de calidad (el método) | Todo el modelo de costo asume mensajes de plantilla WhatsApp y ventana 24h. Para una app web pura la estructura de costo cambia (llamadas LLM por turno, no mensajes salientes); se rehace con esa base. |
| `26_gtm_lanzamiento_v1_primeros_usuarios.md` | GTM lanzamiento V1 | **DESCARTAR** (para este corpus técnico-funcional) | — | Principio de "V1 completa antes que crecimiento" | Es de negocio/marketing, fuera del alcance de `documentacion/app_web/` que es técnico-funcional. El principio rector se cita en `06_tesis_app_web.md` pero el documento no se hereda completo aquí. |
| `27_legal_operativo_v1.md` | Legal operativo V1 | **REUTILIZAR** | `45_configuracion_privacidad_y_control_de_datos.md` | Paquete legal por etapa, disclaimers, políticas públicas mínimas | §17 (pagos, planes, reembolsos) es útil si se vende. Reutilizable, con la advertencia explícita del documento original de que no reemplaza revisión legal externa. |
| `indice.md` | Índice de Fase 5 | **DESCARTAR** | — | — | Reemplazado por `00_indice_maestro.md`. |

---

## 9. Fase 6 — Visual (`docs/fase_6_visual/`)

El bloque mejor conservado para la app web. Ninguno se descarta.

| Doc origen | Título | Clasificación | Destino | Qué se rescata | Justificación |
|---|---|---|---|---|---|
| `28_identidad_visual_marca.md` | Identidad visual y marca | **REUTILIZAR** | `16_design_system_web.md` | Paleta, tipografía, logo, modo oscuro, "lo que la marca NO es" | Correcto y ya vive parcialmente en código (`src/app/globals.css`, 181 variables CSS). |
| `29_design_system_ui.md` | Design system UI | **REUTILIZAR** | `16_design_system_web.md` | Tokens completos, catálogo de componentes con estados por variante | El mejor documento visual del corpus, implementable tal cual. Se amplía con las primitivas que faltan en `src/shared/ui/` (Modal, Tabs, Dropdown, Tooltip, Toast, Table, Pagination, etc.). |
| `30_app_flow.md` | App Flow (sitemap) | **REUTILIZAR** | `10_sitemap_rutas_y_navegacion.md` | Inventario completo de pantallas con IDs, mapa de navegación, estados por pantalla | Es literalmente el sitemap de la app web. Se traduce a rutas URL reales de Next.js App Router (hoy la app usa `?view=` en vez de estas rutas). |
| `31_wireflows.md` | Wireflows | **REUTILIZAR** (parcial) | Se reparte por módulo, referenciado en la sección 8 de cada doc de `04_modulos/` | Los flujos dashboard/mixtos de los 21 | 7 de los 21 son WhatsApp-only y van a `56_puente_a_fase_whatsapp.md`. |
| `32_especificacion_hifi.md` | Especificación Hi-Fi | **REUTILIZAR** | Referenciado desde §8 de cada doc de `04_modulos/` | ASCII layouts mobile+desktop, tokens exactos, estados, 151 frames | El mayor activo desperdiciado del proyecto — nivel de handoff profesional. Se referencia, no se copia, desde cada módulo. |
| `33_stitch_handoff_v1.md` | Handoff Stitch V1 | **REUTILIZAR** | Insumo de proceso, no de contenido | Prompt maestro, criterios de aceptación/rechazo visual | Genera el contenido de `stitch_manzana_v1/` (161 carpetas ya en disco). Se mantiene como referencia de proceso si se necesita regenerar o extender frames. |
| `indice.md` | Índice de Fase 6 | **DESCARTAR** | — | Orden de uso como referencia | Reemplazado por `00_indice_maestro.md`. |

---

## 10. Resumen cuantitativo

| Clasificación | Documentos | % del corpus legacy |
|---|---|---:|
| REUTILIZAR | 26 | 48 % |
| REESCRIBIR | 12 | 22 % |
| DESCARTAR | 9 | 17 % |
| CONGELAR-WHATSAPP | 7 | 13 % |
| **Total** | **54** | |

`05b_motor_ia.md` lleva doble clasificación —REESCRIBIR el 70 %, REUTILIZAR el
30 %— y cuenta una sola vez, en REESCRIBIR.

**Estas cifras se recontaron el 26 de julio de 2026 y no son las que este
documento declaraba.** Decía 21 / 11 / 9 / 15, que suman 56 sobre 54 filas: un
resumen escrito a mano que nunca se volvió a comprobar contra su propia tabla.
Es el mismo defecto que el corpus encontró en el catálogo de comandos
(`C-03`), en las páginas legales (`C-14`, `C-16`), en el mapa de rutas (`50`
§5.3) y en las dos ramas de migraciones (`WEB-D163`) — y aquí apareció en el
documento de gobierno que clasifica a todos los demás.

El remedio es el mismo de las otras cuatro veces: la tabla de arriba pasa a
ser una **vista generada** desde las filas de §3 a §9, con un test de clase
`corpus` que falla si divergen (`AC-INV-13`).

El bloque técnico (modelo de datos, arquitectura, cuentas/cajas, categorías,
deudas, recurrentes, design system, app flow, especificación Hi-Fi) se
reutiliza casi íntegro. El bloque que se reescribe es exactamente el que
define *qué puede hacer la app por sí sola*: Dashboard, Insights, Onboarding
web-first, Motor IA, API spec y el plan de implementación. Es la evidencia
más concreta de que el problema nunca fue la capacidad de escribir
documentación de calidad — fue la tesis de producto elegida.
