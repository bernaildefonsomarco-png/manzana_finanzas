# 20 - Decisiones Tecnicas V1

**Estado:** V2.1 - Decision log auditado; runtime API de agentes clasificado  
**Ultima actualizacion:** 5 de julio, 2026  
**Depende de:** `06_arquitectura_sistema.md`, `15_stack_tecnologico.md`  

---

## 1. Tesis

Fase 4 no debe mezclar tres cosas distintas:

- reglas tecnicas necesarias para proteger dinero y confianza,
- decisiones de producto ya aceptadas,
- recomendaciones de stack que todavia pueden cambiar.

Este documento es el registro central para distinguirlas.

La arquitectura puede estar lista para implementar sin fingir que todos los proveedores, frameworks o servicios ya fueron aprobados definitivamente.

---

## 2. Estados Permitidos

| Estado | Significado |
|---|---|
| `no_negociable` | Regla necesaria para seguridad, consistencia financiera o confianza del producto. No debe cambiarse sin redisenar la arquitectura. |
| `aprobada_producto` | Decision ya aceptada por alcance/producto. Puede implementarse como contrato V1. |
| `recomendada` | Recomendacion tecnica fuerte. Es la opcion preferida actual, pero requiere aprobacion explicita antes de tratarla como cerrada. |
| `pendiente_decision` | Necesita definicion futura antes de implementacion productiva. |
| `fuera_v1` | No pertenece a la implementacion V1 inicial. |

---

## 3. Decision Log

| decision_id | tema | estado | recomendacion_actual | razon | riesgo_si_se_ignora | documentos_afectados |
|---|---|---|---|---|---|---|
| F4-D001 | Core Financiero como dominio propio | `no_negociable` | Mantener Core separado de UI, adapters, DB cruda y agentes. | El dinero requiere reglas trazables y reproducibles. | Agentes o UI podrian mutar dinero sin validacion central. | `06`, `15`, `16`, `18`, `19` |
| F4-D002 | Agentes sin escritura directa | `no_negociable` | Agentes proponen, consultan o redactan; no escriben DB ni Core. | Reduce riesgo financiero, privacidad y errores por LLM. | Mutaciones no auditables o inconsistentes. | `05b`, `06`, `18`, `19` |
| F4-D003 | `CommandDispatcher` como via de escritura | `no_negociable` | Toda escritura aprobada pasa por comandos del Core. | Unifica validacion, auditoria, idempotencia y permisos. | Doble logica de escritura y reglas divergentes. | `06`, `18`, `19` |
| F4-D004 | `ToolGateway` para consultas de agentes | `no_negociable` | Agentes consultan datos mediante tools limitadas y auditables. | Evita acceso libre a memoria/DB y permite aplicar scopes. | Exposicion excesiva de datos o consultas sin control. | `06`, `19` |
| F4-D005 | Transactional Outbox | `no_negociable` | Todo hecho financiero persistido emite evento via outbox. | Evita guardar dinero sin evento o publicar evento sin transaccion. | Saldos, insights, nudges o auditoria desincronizados. | `06`, `16`, `17`, `18` |
| F4-D006 | Separar eventos externos e internos | `no_negociable` | External Event Gateway separado del Internal Domain Event Bus. | Evita loops y separa entrada de usuario de hechos persistidos. | Bucles de eventos, duplicados y acciones inesperadas. | `06`, `17`, `18` |
| F4-D007 | Email sin auto-registro | `no_negociable` | Email crea pendientes; usuario confirma antes de movimiento real. | Es una regla de confianza y control del usuario. | Movimientos falsos, saldos incorrectos y perdida de confianza. | `05d`, `06`, `16`, `17`, `18` |
| F4-D008 | Pendientes no afectan saldos | `no_negociable` | `pending_items` no cuentan como movimientos confirmados. | Mantiene diferencia clara entre senal y hecho financiero. | Dinero libre y balances inflados o incorrectos. | `05d`, `06`, `16`, `18` |
| F4-D009 | AgentRuntime Codex-first/API-ready | `aprobada_producto` | Agentes existen desde V1; el runtime puede cambiar por agente. | El usuario ya definio que Codex es runtime inicial y API futura. | Reescritura costosa al migrar agentes a API. | `05b`, `06`, `15`, `19` |
| F4-D010 | TypeScript-first | `aprobada_producto` | Usar TypeScript end-to-end. | Facilita compartir tipos entre UI, API, Core, workers y agentes. | Mas friccion al mantener contratos entre capas. | `15`, `18`, `19` |
| F4-D011 | Next.js fullstack para Dashboard/API/webhooks | `aprobada_producto` | Next.js App Router + React + Route Handlers. | Permite web, API y webhooks en un mismo monorepo con buen DX. | Stack alternativo puede aumentar integracion y duplicacion. | `15`, `18` |
| F4-D012 | Supabase/PostgreSQL/Auth/RLS | `aprobada_producto` | Supabase PostgreSQL + Auth + RLS. | Acelera auth, DB, policies y desarrollo local con Postgres. | Rehacer auth/RLS/repositorios o perder aislamiento multiusuario. | `15`, `16`, `18` |
| F4-D013 | SQL migrations como camino de implementacion | `aprobada_producto` | Usar migrations SQL versionadas al iniciar implementacion; Fase 4 mantiene contrato logico. | RLS y constraints financieras se expresan mejor de forma explicita. | Drift entre ORM, DB real y policies. | `15`, `16` |
| F4-D014 | Workers TypeScript durables | `aprobada_producto` | Usar workers TypeScript con retries, idempotencia y observabilidad; Trigger.dev o equivalente. | Fase 4 necesita jobs idempotentes, retries, trazas y schedules. | Cron suelto, duplicados o fallos silenciosos. | `15`, `17` |
| F4-D015 | Vercel Cron limitado | `recomendada` | Usarlo solo como disparador simple, no como motor durable. | Sirve para despertar jobs, no para logica financiera compleja. | Jobs sin retry/idempotencia/observabilidad. | `15`, `17` |
| F4-D016 | WhatsApp provider via adapter | `aprobada_producto` | Kapso como proveedor oficial operativo WhatsApp V1 detras de `WhatsAppAdapter`; Meta Cloud API directo queda como escape tecnico futuro. | El adapter protege el dominio y concentra webhooks, templates, retries, ventana 24h y delivery sin acoplar Core al canal ni a Kapso. | Saltarse el adapter o mezclar proveedores por usuario aumenta complejidad, costos y comportamiento inconsistente. | `15`, `18`, `21` |
| F4-D017 | Gmail API + Pub/Sub para email V1 | `aprobada_producto` | Gmail como primer proveedor de email parsing via `EmailAdapter`; otros proveedores quedan futuro. | Es el caso inicial mas concreto para capturar correos financieros con OAuth oficial, Pub/Sub, `historyId` y watch renewal. | Soporte incompleto si usuarios usan otros proveedores; scope/compliance mal gestionado puede bloquear produccion. | `05d`, `06`, `15`, `16`, `17`, `18`, `22` |
| F4-D018 | Schema validator compartido | `aprobada_producto` | Usar validacion runtime compartida; Zod, Valibot o equivalente son opciones permitidas. | Los contratos de agentes, APIs y Core necesitan validacion runtime. | Inputs externos o LLM outputs no validados. | `15`, `18`, `19` |
| F4-D019 | Observabilidad desde V1 | `aprobada_producto` | Usar observabilidad de errores, producto, IA y traces; Sentry, PostHog o equivalentes son opciones permitidas. | Manzana necesita medir calidad, costo, errores, outbox y agentes. | Errores invisibles y decisiones sin evidencia. | `15`, `17`, `19` |
| F4-D020 | Stack visual del Dashboard | `aprobada_producto` | Tailwind CSS + componentes propios/headless, siguiendo Fase 3 y Fase 6 visual V1. | El producto necesita identidad propia, no UI generica. | Dashboard correcto tecnicamente pero sin calidad percibida. | `15`, `17_dashboard_ux`, `18_wireframes_prototipo`, `docs/fase_6_visual` |
| F4-D021 | Multi-moneda UI completa | `fuera_v1` | Modelo puede dejar base con `currency`; UI completa queda para futuro. | Evita complejidad temprana en UX, saldos y reportes. | Sobrecargar V1 y confundir dinero libre. | `16`, `05e`, `05c` |
| F4-D022 | Pricing/unit economics/legal/GTM | `fuera_v1` | Tratar en Fase 5 o documentos dedicados. | Son decisiones de negocio/proteccion, no base tecnica de Fase 4. | Mezclar arquitectura con estrategia comercial. | `roadmap`, `especificacion_producto` |
| F4-D023 | Integraciones bancarias directas | `fuera_v1` | V1 usa email parsing + confirmacion, no open banking directo. | Reduce dependencia legal/comercial y complejidad de permisos. | Scope excesivo antes de validar uso real. | `05d`, `06`, `15` |
| F4-D024 | Metas/limites formales | `fuera_v1` | Mantener `BudgetGoalReactor` como hook, no feature completa. | Aun no hay documento propio definitivo. | Implementar reglas de presupuesto sin contrato de producto. | `05b`, `05j`, `06` |
| F4-D025 | REST + Core Commands | `aprobada_producto` | Dashboard/API usa endpoints REST simples; escrituras financieras pasan por Core Commands internos. | Mantiene APIs legibles sin saltarse validaciones financieras. | Endpoints pueden duplicar reglas o mutar sin pasar por Core. | `18`, `06`, `15` |
| F4-D026 | Modelo de datos logico en Fase 4 | `aprobada_producto` | Fase 4 define tablas, enums, relaciones, RLS e indices; SQL real se genera al iniciar implementacion. | Evita congelar migraciones antes de construir y mantiene contrato claro. | SQL prematuro dificil de mantener o modelo demasiado libre para implementador. | `16`, `15` |
| F4-D027 | Trigger.dev como proveedor de workers | `recomendada` | Trigger.dev es proveedor sugerido para workers TypeScript durables; puede reemplazarse por equivalente con retries, idempotencia y trazas. | Encaja bien con el patron aprobado sin hacerlo dependencia obligatoria. | Elegir un worker sin garantias durables puede duplicar efectos o perder jobs. | `15`, `17` |
| F4-D028 | Zod/Valibot como schema validators | `recomendada` | Zod o Valibot son marcas sugeridas; cualquier equivalente debe validar runtime y compartir contratos. | Reducen friccion en TypeScript sin cerrar marca obligatoria. | Validaciones inconsistentes entre agentes, API y Core. | `15`, `18`, `19` |
| F4-D029 | Sentry/PostHog como observabilidad | `recomendada` | Sentry y PostHog son marcas sugeridas; equivalentes son validos si cubren errores, producto, IA y traces. | Dan una ruta rapida para medir calidad y fallos. | Menor visibilidad de errores, costo IA, outcomes y comportamiento de usuarios. | `15`, `17`, `19` |
| F4-D030 | APIs no oficiales de WhatsApp | `no_negociable` | No usar WhatsApp Web automation, sesiones QR, Baileys, whatsapp-web.js, scraping ni proveedores grises para V1. | El canal maneja datos financieros y debe operar por vias oficiales. | Bloqueo del numero, perdida de mensajes, fragilidad tecnica y riesgo reputacional. | `15`, `18`, `21` |
| F4-D031 | Proveedores alternos descartados para WhatsApp V1 | `aprobada_producto` | No usar Twilio, 360dialog, WATI, Zoko, respond.io, Evolution API, sesiones QR ni WhatsApp Web automation; Kapso es el unico proveedor operativo aprobado hasta nueva decision. YCloud queda reemplazado/pausado. | Mantiene una sola via oficial operativa, una sola medicion de costos y una experiencia controlada. | Duplicar proveedor antes de validar puede crear lock-in, costos extra, diferencias de entrega, bloqueo del numero o confusion operativa. | `15`, `18`, `21` |
| F4-D032 | WhatsApp Window Strategy | `aprobada_producto` | Manejar ventana de 24h, templates utility, Flows, Centro de Confirmaciones y app/Dashboard sin degradar calidad. | WhatsApp debe seguir siendo canal principal, pero no debe insistir con templates sin respuesta. | Costos altos, spam, perdida de confianza o esconder valor del producto en Dashboard. | `05a`, `05d`, `05g`, `05j`, `06`, `16`, `17`, `18`, `21` |
| F4-D033 | Email por OAuth oficial, sin passwords ni scraping | `no_negociable` | Email V1 usa APIs oficiales y OAuth; prohibido pedir contrasenas, app passwords, scraping, browser automation o acceso no oficial al inbox. | El canal maneja informacion financiera sensible y debe sostener confianza, privacidad y cumplimiento. | Bloqueo de proveedor, exposicion de datos, mala experiencia de consentimiento y riesgo reputacional. | `05d`, `06`, `15`, `16`, `17`, `18`, `22` |
| F4-D034 | Conciliacion pago-cuota de deuda | `aprobada_producto` | Aplicar cada pago primero a la cuota abierta mas antigua, mantener abonos parciales, distribuir excedente a cuotas siguientes, permitir adelanto por el mismo orden y bloquear sobrepago del saldo total en V1. Ejecutar todo dentro de `commit_debt_payment` con asignaciones auditables. | El usuario aprobo una regla determinista que evita cuotas pagadas fuera de orden y mantiene una sola escritura financiera atomica. | Deuda, cuotas, movimientos y saldos podrian divergir o duplicar efectos. | `05h`, `06`, `16`, `18`, `23b`, `31`, `32` |
| F4-D035 | Scheduler externo para outbox frecuente | `aprobada_producto` | Usar un scheduler externo compatible para llamar `GET /api/internal/workers/outbox` cada 1 minuto con `CRON_SECRET`. Vercel Cron diario se mantiene para jobs lentos; cola dedicada queda como evolucion futura. | Cierra el publisher frecuente sin pagar Vercel Pro solo por cron ni introducir cola prematura. | Eventos internos pueden quedar pendientes hasta que un webhook o ejecucion manual drene outbox. | `17`, `18`, `23b`, `25` |
| F4-D036 | OpenAI Responses API como primer runtime API de agentes | `recomendada` | Usar `AGENT_RUNTIME_API_KIND=openai` como primera implementacion API real detras de `AgentRuntime`, con Structured Outputs y fallback local. | Encaja con los schemas estructurados de `DataAgent` y `ResponseAgent` sin cambiar Orchestrator, PolicyGate ni Core. | Activar un proveedor LLM sin schema estricto o fallback puede degradar calidad, costo y seguridad. | `19`, `23b`, `.env.local.example` |

---

## 4. Como Usar Este Log

Antes de implementar una parte de Fase 4:

1. Revisar si la decision existe aqui.
2. Si es `no_negociable`, implementarla como regla.
3. Si es `aprobada_producto`, implementarla como contrato V1.
4. Si es `recomendada`, usarla como default tecnico, pero no presentarla como aprobacion final del usuario.
5. Si es `pendiente_decision`, pedir decision antes de construir en produccion.
6. Si es `fuera_v1`, no construir salvo cambio explicito de alcance.

---

## 5. Resumen

Fase 4 queda lista como base tecnica, pero honesta:

```text
Reglas financieras: firmes.
Arquitectura agentic controlada: firme.
Stack base V1: aprobado.
Herramientas equivalentes: permitidas cuando no rompen contrato.
Temas de negocio/legal/futuro: fuera de V1 tecnica.
```

*Fase 4 Tecnica - Documento 20 - V2.0*
