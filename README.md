# Manzana

Finanzas personales con inteligencia. Tu dinero, claro.

## Stack

- **Framework:** Next.js 16 App Router + TypeScript
- **UI:** Tailwind CSS v4 + componentes propios (Fase 6 Visual V1)
- **Base de datos:** Supabase PostgreSQL + Auth + RLS
- **Validación:** Zod
- **Tests:** Vitest + Testing Library
- **Fuentes:** DM Sans (headings) + Inter (body)

## Comandos

```bash
npm run dev        # Servidor de desarrollo (localhost:3000)
npm run build      # Build de producción
npm run typecheck  # Verificar tipos TypeScript
npm run test       # Ejecutar tests
npm run test:watch # Tests en modo watch
npm run lint       # ESLint
```

## Estructura

> Esta sección refleja las carpetas reales de `src/` al 27 de julio de 2026.
> La app autenticada sigue siendo una SPA montada en `src/app/page.tsx` vía
> `src/features/dashboard/`; no existe todavía un grupo de rutas `(app)` con
> páginas propias — lo crea `W-07` del plan de implementación. El detalle y
> el plan de reestructuración viven en `documentacion/app_web/`.

```
src/
  app/
    api/            # Route Handlers (webhooks, endpoints internos, health, /v1)
    contacto/, empresa/, privacidad/, terminos/, eliminar-datos/  # páginas legales, ya existen
    fonts/          # DM Sans e Inter, self-hosted
  core/
    channel/        # Puerto de entrada/salida agnostico de canal (21): Canal, TurnInput, Block
    finance/        # CommandDispatcher, Balance Engine, validadores de dinero
    debts/          # Debt Engine: creación, pagos, cuotas
    recurring/       # Recurring Engine: detección y ocurrencias
    insights/       # Insight Engine
    nudges/         # Nudge Evaluator y Nudge Policy
    pending/        # Confirmación de pendientes
    email/          # Ingesta y normalización de email
    classification/ # Clasificación de categorías/etiquetas
    dedup/          # Deduplicación cross-canal
    learning/       # Learning Engine y gobernanza de memoria
    conversation/   # ToolGateway, TurnCoordinator, TurnWorkspace (motor conversacional)
    orchestrator/   # FinancialOrchestrator
    response/       # Response Planner
    onboarding/, disclosure/, risk/, events/
    commands/, engines/, validators/  # vacías: marcador para el diseño de `core/` (documentacion/app_web/02_fundaciones/12)
  adapters/
    whatsapp/       # WhatsAppAdapter — implementado, 2.639 líneas
    email/          # EmailAdapter (la lógica real vive en core/email)
  agents/
    runtime/                        # AgentRuntime, readiness, config de providers
    conversational-executive-agent/ # Agente cabeza (modo shadow/active), sin documentar
    data-agent/, conversation-agent/, correction-agent/, response-agent/
    email-extraction-agent/, insight-experience-agent/, insight-narrator-agent/
    learning-signal-agent/, recurring-signal-agent/, risk-signal-agent/
    dedup-signal-agent/, disclosure-experience-agent/, nudge-experience-agent/
    orchestration-planning-agent/, evals/
  workers/
    outbox/         # Publicador de transactional_outbox
    nudges/         # Evaluación y entrega de nudges proactivos
  shared/
    ui/             # Primitivas de UI (8 componentes: button, card, field, states, money, badge, switch, cn)
    schemas/        # Schemas Zod compartidos
    types/          # Tipos TypeScript globales
    money/          # Utilidades de dinero (céntimos enteros, formato S/)
    accessibility/  # Parche de accesibilidad de modales (modal-accessibility-guard)
    privacy/        # Modo discreto
    telemetry/      # Logger estructurado y trace IDs
    dates/          # vacía: marcador para el módulo único de fechas (documentacion/app_web/02_fundaciones/17, AC-PAT-09)
  data/
    supabase/       # Clientes Supabase (browser, server, service)
    repositories/   # Repositorios de datos
    migrations.test.ts  # Lee y verifica supabase/migrations/ — no hay una segunda copia de los .sql
  features/         # Screens de la app (money, settings, upcoming, movements, debts,
                     # pending, home, insights, search, auth, app-shell, onboarding,
                     # public-site, dashboard) — SPA con routing por ?view=, en reconstrucción
```

`supabase/migrations/` es la única rama de migraciones (`WEB-D163`): la fuente
canónica que usa Supabase CLI y también la que lee `src/data/migrations.test.ts`.
No existe `src/data/migrations/`; un test de clase `build` falla si reaparece.

## Variables de entorno

Copia `.env.local.example` a `.env.local` y completa los valores:

```bash
cp .env.local.example .env.local
```

## Estado del proyecto y reestructuración en curso

Esta tabla de "Cortes" quedó desactualizada: describe el plan original
WhatsApp-first y marcaba como "Pendiente" trabajo que ya está implementado
en código (Core financiero, Dashboard parcial, WhatsApp, AgentRuntime,
Pendientes, Email Gmail V1, búsqueda natural, Insights/Nudges/Learning).

El estado real y verificado por evidencia vive en:

- `docs/fase_4_tecnica/23b_seguimiento_construccion_v1.md` — ledger de
  construcción hasta el 23 de julio de 2026 (no incluye el trabajo de motor
  conversacional posterior, sin documentar).
- `docs/fase_4_tecnica/auditoria_integral_arquitectura_ia_conversacional_2026-07-23.md`
  y `docs/fase_4_tecnica/matriz_cumplimiento_integral_v1_2026-07-24.md` —
  auditorías de arquitectura y de los 21 flujos V1 (scorecard 5.6/10, 0/21
  flujos con cumplimiento íntegro al 24 de julio).

**El proyecto está en reestructuración**: se separa la aplicación web del
canal WhatsApp. Primero se documenta y construye la app web completa,
vendible sin WhatsApp; después se conecta WhatsApp como canal conversacional
completo. El corpus documental nuevo y el plan de implementación viven en
`documentacion/app_web/` (`docs/` queda congelado como referencia histórica).

## Reglas de arquitectura

- `core/` nunca importa Next.js, React ni SDKs externos
- `app/api` llama servicios/comandos, no contiene lógica financiera
- `agents/` no importan repositories directos
- `workers/` son idempotentes — reintentar no duplica efectos
- Toda escritura financiera pasa por `CommandDispatcher`
- Email crea `pending_items`; nunca movimientos confirmados directamente
