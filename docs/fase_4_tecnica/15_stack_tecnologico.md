# 15 - Stack Tecnologico V1

**Estado:** V1.8 - Stack base aprobado; Kapso como proveedor WhatsApp V1  
**Ultima actualizacion:** 16 de junio, 2026  
**Depende de:** `06_arquitectura_sistema.md`, `20_decisiones_tecnicas.md`  

---

## 1. Tesis

El stack de Manzana debe permitir construir rapido sin sacrificar control financiero.

La prioridad no es elegir tecnologias por moda. La prioridad es que el stack soporte:

- WhatsApp como canal principal,
- Dashboard web,
- email parsing,
- Core Financiero deterministico,
- Supabase/PostgreSQL/Auth/RLS,
- agentes LLM controlados,
- workers confiables,
- eventos internos,
- outbox,
- observabilidad,
- y migracion futura de Codex a API por agente.

---

## 2. Stack Base Aprobado

Stack base aprobado V1:

| Capa | Decision V1 |
|---|---|
| Lenguaje | TypeScript |
| Frontend/Dashboard | Next.js App Router + React |
| UI | Tailwind CSS + componentes propios/headless siguiendo Fase 3 y Fase 6 visual V1 |
| Backend web | Next.js Route Handlers + Server Functions controladas |
| Dominio | Paquetes TypeScript puros (`core`, `domain`, `agents`) |
| Base de datos | Supabase PostgreSQL |
| Auth | Supabase Auth |
| Seguridad de datos | RLS + policies + service role solo backend controlado |
| Migraciones | SQL migrations al iniciar implementacion |
| Workers | Trigger.dev o worker TS equivalente con retries y observabilidad |
| Scheduler simple | Vercel Cron solo para disparar jobs, no para logica durable |
| WhatsApp | Kapso via `WhatsAppAdapter` sobre WhatsApp Business Platform |
| Email | Gmail API + Pub/Sub para V1 via `EmailAdapter` |
| AI runtime | Codex-first/API-ready por `AgentRuntime`; `api=openai` recomendado como primera implementacion API real |
| Validacion | Zod/Valibot o schema validator equivalente |
| Testing | Vitest + Playwright + tests de dominio |
| Observabilidad | Sentry/PostHog o equivalentes + trazas internas en DB |

El estado formal de cada decision vive en `20_decisiones_tecnicas.md`.

Regla:

```text
Las reglas financieras y de seguridad son firmes.
El stack base V1 esta aprobado.
Las herramientas equivalentes son validas cuando no rompen contratos, adapters, RLS, outbox ni pruebas.
```

---

## 3. Criterios Que Debe Cumplir Cualquier Stack

| # | Principio | Implicacion |
|---|---|---|
| 1 | TypeScript end-to-end | Compartir tipos entre UI, API, Core, workers y agentes. |
| 2 | SQL como verdad de datos | Las migraciones definen tablas, constraints, indices y RLS. |
| 3 | Dominio desacoplado | Core no depende de Next.js, React ni proveedores LLM. |
| 4 | Requests cortos | Webhooks/API responden rapido y delegan procesos async a workers. |
| 5 | Workers durables | Jobs con retries, idempotencia y trazas, no scripts sueltos. |
| 6 | Agentes tras runtime | Codex/API se cambia detras de `AgentRuntime`. |
| 7 | UI no generica | Dashboard debe respetar Fase 3 y Fase 6 visual V1; no debe parecer starter kit. |
| 8 | Proveedores como adapters | WhatsApp, Email, AI y Workers se encapsulan. |

---

## 4. Arquitectura De Repositorio Recomendada

```text
apps/
  web/
    app/
    components/
    features/
    api/
    styles/

packages/
  core/
    movements/
    accounts/
    boxes/
    debts/
    recurring/
    pending/
    balance/

  domain/
    commands/
    events/
    policies/
    schemas/

  db/
    repositories/
    migrations/
    types/
    rls-tests/

  agents/
    runtime/
    context-packs/
    prompts/
    tools/
    evaluators/

  adapters/
    whatsapp/
    email/
    dashboard/
    ai/
    telemetry/

  workers/
    outbox/
    pending/
    recurring/
    insights/
    nudges/
    learning/

docs/
  fase_*
```

Regla:

> `packages/core` nunca importa Next.js, React, WhatsApp, Gmail ni SDKs de LLM.

---

## 5. Frontend Y Dashboard

### Decision V1

Usar Next.js App Router con React y TypeScript.

### Por que

- Permite Dashboard y API en el mismo monorepo.
- Route Handlers sirven para webhooks y endpoints.
- Server Components/Server Functions pueden leer datos sin crear APIs innecesarias.
- El frontend puede compartir tipos con Core y DB.

### Reglas

- Dashboard usa componentes propios alineados con Fase 3.
- No usar templates genericos de SaaS financiero.
- No poner logica financiera en componentes.
- Formularios estructurados llaman comandos/backend, no escriben DB directo.
- Busqueda natural es read-only por defecto.
- Estados vacios, error, recalculo y modo discreto siguen `17_dashboard_ux.md` y `18_wireframes_prototipo.md`.

---

## 6. Backend Web

### Decision V1

Usar Next.js Route Handlers para:

- webhooks externos,
- endpoints de dashboard,
- acciones transaccionales,
- endpoints internos protegidos,
- health checks.

Server Functions/Actions pueden usarse para formularios del Dashboard si:

- llaman al mismo servicio de aplicacion que los Route Handlers,
- pasan por PolicyGate/validadores/Core,
- registran idempotencia si hay riesgo de doble submit,
- no acceden directo a tablas para mutaciones financieras.

### Regla

```text
UI -> application service -> orchestrator/core -> repository
```

Nunca:

```text
UI -> supabase.from("movements").insert(...)
```

para movimientos financieros.

---

## 7. Base De Datos Y Auth

### Decision V1

Supabase PostgreSQL + Supabase Auth + RLS.

Si en el futuro se reemplaza el proveedor, debe conservar:

- PostgreSQL o una base relacional equivalente,
- aislamiento fuerte por usuario,
- policies o capa equivalente a RLS,
- migraciones versionadas,
- service role solo en backend controlado.

### Uso

| Recurso | Uso |
|---|---|
| PostgreSQL | Fuente de verdad financiera. |
| Supabase Auth | Usuarios, sesiones, JWT. |
| RLS | Aislamiento por usuario. |
| SQL migrations | Implementacion SQL del contrato logico de datos. |
| Supabase generated types | Tipos base para repositorios. |
| Service role | Solo backend/trabajos controlados, nunca cliente. |

### Reglas

- Toda tabla con datos de usuario tiene `user_id`.
- RLS activado por defecto.
- El cliente solo puede leer/escribir lo que las policies permitan.
- Mutaciones financieras complejas pasan por backend/Core.
- Las constraints de DB refuerzan reglas, pero no sustituyen al Core.
- Fase 4 define contrato logico; las migraciones SQL reales se generan al iniciar implementacion.

---

## 8. Workers Y Jobs

### Decision V1

Usar un sistema de jobs TypeScript durable. Trigger.dev o equivalente queda permitido.

Vercel Cron puede disparar jobs periodicos, pero no debe contener logica durable compleja.

### Workers necesarios

| Worker | Funcion |
|---|---|
| Outbox Worker | Publicar eventos internos desde `transactional_outbox`. |
| Pending Worker | TTL, batch nocturno y archivo de pendientes. |
| Email Worker | Procesar Gmail/PubSub y parsear emails. |
| Recurring Worker | Crear ocurrencias y detectar candidatos. |
| Insight Worker | Generar, validar, rankear y actualizar descubrimientos. |
| Nudge Worker | Evaluar candidates, horario, opt-in, modo discreto y envio. |
| Learning Worker | Procesar correcciones y outcomes. |
| Recalculation Worker | Recalcular saldos/proyecciones selectivamente. |

### Reglas

- Todo worker es idempotente.
- Todo worker registra `trace_id`.
- Todo worker puede reintentar sin duplicar efectos.
- Jobs que escriben dinero pasan por Core.
- Workers no publican eventos internos si la escritura no fue persistida.

---

## 9. WhatsApp

### Decision V1

Usar Kapso como proveedor oficial operativo WhatsApp para V1, siempre detras de `WhatsAppAdapter`.

Meta WhatsApp Cloud API directo queda como escape tecnico futuro detras del mismo adapter, no como ruta operativa principal mientras Kapso este aprobado.

No se usaran proveedores alternos como Twilio, 360dialog, WATI, Zoko, respond.io, YCloud, Evolution API, sesiones QR ni WhatsApp Web automation para V1 salvo decision nueva.

El detalle operativo de la decision vive en `21_decision_whatsapp_provider.md`:

- proveedor V1: Kapso,
- Meta directo: escape tecnico futuro por adapter,
- sin proveedores alternos Twilio/360dialog/respond.io/YCloud/Evolution/QR en V1,
- prohibido: APIs no oficiales, WhatsApp Web automation, sesiones QR o proveedores grises.

### Adapter

`WhatsAppAdapter` debe encapsular:

- verificacion de webhook,
- normalizacion de payload,
- envio de mensajes,
- templates,
- errores de delivery,
- retries,
- rate limiting,
- modo discreto en salida ya preparada por PolicyGate/ResponsePlanner.

### Regla

WhatsApp no decide:

- categoria,
- tipo financiero,
- saldo,
- nudge,
- confirmacion de riesgo,
- ni escritura en Core.

---

## 10. Email

### Decision V1

V1 usa Gmail como primer proveedor mediante Gmail API + Pub/Sub, detras de `EmailAdapter`.

El detalle operativo y de privacidad vive en `22_decision_email_provider.md`:

- default V1: Gmail API + Pub/Sub;
- fallback tecnico: Gmail history polling si push falla;
- futuro: Outlook/Microsoft Graph o forwarding provider via adapter;
- prohibido: passwords, app passwords, scraping, browser automation o APIs no oficiales;
- scope minimo operativo: `gmail.readonly` si se necesita leer cuerpo/snippet de emails financieros;
- compliance: OAuth verification, disclosures y Limited Use antes de produccion abierta.

### Adapter

`EmailAdapter` debe:

- manejar OAuth,
- escuchar Pub/Sub y polling de recuperacion segun proveedor,
- renovar Gmail watch antes de expirar,
- filtrar remitentes,
- parsear datos minimos,
- registrar idempotencia por email,
- mandar evento externo al Orchestrator.

### Regla

Email nunca registra movimiento sin confirmacion del usuario en V1.

El adapter no debe guardar cuerpo completo del email por defecto. Solo puede procesar contenido en memoria cuando el remitente/subject pertenece a una whitelist financiera o a un template permitido.

---

## 11. AI Runtime

### Contrato V1

Codex-first ahora, API-ready despues.

Esto significa:

- los agentes existen desde V1,
- sus inputs/outputs estan versionados,
- el runtime es intercambiable,
- la memoria vive en DB/Core,
- los agentes usan herramientas controladas.

### Proveedores futuros

El stack debe permitir mover un agente a:

- API barata para output estructurado,
- modelo fuerte para conversacion profunda,
- runtime local/de evaluacion si aplica,
- Codex durante desarrollo o tareas de alta calidad.

---

## 12. Validacion Y Schemas

Usar validacion runtime compartida para:

- comandos Core,
- `ProposedAction`,
- outputs de agente,
- Context Packs,
- eventos internos,
- API request/response,
- payloads de webhooks normalizados.

Regla:

> Todo dato que entra por canal externo se valida antes de llegar al Core.

Zod, Valibot o un schema validator equivalente son opciones validas. La marca concreta no queda cerrada mientras cumpla los contratos.

---

## 13. Observabilidad

### Herramientas

| Herramienta | Uso |
|---|---|
| Sentry o equivalente | Errores de frontend/backend/workers. |
| PostHog o equivalente | Eventos de producto y funnels. |
| DB traces | Trazas financieras, agentes, outbox y workflows. |
| Logs estructurados | Debug tecnico sin datos sensibles. |
| AI tracing | Invocaciones, runtime, costo, confianza y outcome. |

### Reglas

- No guardar chain-of-thought.
- No loguear tokens OAuth.
- No loguear contenido financiero sensible en logs tecnicos.
- Guardar evidencias resumidas y decision trace segura.

---

## 14. Testing

| Tipo | Herramienta | Nivel |
|---|---|---|
| Dominio/Core | Vitest | Requerido |
| Repositories/RLS | Supabase local + tests SQL | Requerido si se usa Supabase |
| API contracts | Vitest/integration | Requerido |
| Workers | Tests de idempotencia/retry | Requerido |
| Dashboard | Playwright | Requerido para flujos criticos |
| Agentes | Golden tests/evals | Requerido |
| Visual UX | Screenshots Playwright | Requerido antes de handoff fuerte |

Tests criticos:

- email no registra sin confirmacion,
- pendiente no afecta saldo,
- cuenta `null` no rompe balance,
- outbox no duplica eventos,
- pago_deuda no es gasto,
- recurrente esperado no cambia saldo,
- dashboard manual pasa por Core,
- agente no escribe DB.

---

## 15. Ambientes

| Ambiente | Uso |
|---|---|
| local | Desarrollo con Supabase local y mocks de proveedores. |
| preview | PRs, demos, QA visual, datos fake. |
| staging | Webhooks reales de prueba, Gmail test, WhatsApp test number. |
| production | Usuarios reales, RLS, backups, monitoreo. |

Reglas:

- Nunca usar datos reales en preview.
- Webhooks de staging y prod separados.
- Tokens por ambiente.
- Outbox y workers aislados por ambiente.

---

## 16. No Usar En V1

Evitar:

- microservicios prematuros,
- Prisma como unica fuente de verdad de DB si debilita RLS/migrations SQL,
- agentes con acceso directo a DB,
- cron jobs sin idempotencia,
- Supabase client en UI para mutaciones financieras complejas,
- workflow async sin outbox,
- logs con montos/comercios/personas en texto plano innecesario,
- UI kits que impongan identidad generica.

---

## 17. Criterios De Aceptacion

- Stack base aprobado por capa.
- Next.js, Supabase, workers, WhatsApp, Email y AI runtime tienen rol claro.
- WhatsApp y Email apuntan a sus decision docs (`21` y `22`) sin duplicar reglas de proveedor.
- Core queda desacoplado de proveedores.
- SQL migrations son fuente de verdad de datos.
- Workers son durables e idempotentes.
- Vercel Cron no contiene logica financiera compleja.
- Dashboard no escribe finanzas directo desde cliente.
- Agentes no acceden directo a DB.
- Observabilidad cubre errores, producto, IA, outbox y workers.
- Testing cubre reglas financieras criticas.

---

## 18. Resumen

Stack aprobado V1:

```text
Next.js + TypeScript
Supabase/PostgreSQL/Auth/RLS
Core Financiero en packages de dominio
Workers TypeScript durables
WhatsApp Adapter
Gmail Adapter
AgentRuntime Codex-first/API-ready
Transactional Outbox
Observabilidad desde el inicio
```

*Fase 4 Tecnica - Documento 15 - V1.7*
