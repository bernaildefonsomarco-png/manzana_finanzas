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

> Esta sección refleja las carpetas reales de `src/` al 28 de julio de 2026.
> `W-07` construyó el esqueleto de rutas real: `(publico)` y `(app)` son
> grupos de rutas de Next.js (no aparecen en la URL). `dashboard-app.tsx` y
> el enrutado por `?view=` desaparecieron. El detalle y el plan de
> reestructuración viven en `documentacion/app_web/`.

```
src/
  app/
    api/            # Route Handlers (webhooks, endpoints internos, health, /v1)
    (publico)/      # sin sesión: entrar, crear-cuenta, recuperar/restablecer-clave,
                     # verificar, estado, baja, y las páginas legales
    (app)/          # con sesión: inicio, movimientos, pendientes, mi-dinero,
                     # presupuestos, deudas, pagos-que-vienen, descubrimientos,
                     # reportes, proyecciones, asistente, buscar, configuracion,
                     # recordatorios, bienvenida — layout único con guard de sesión
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
  ui/
    primitivas/     # Sistema de diseño (16): Dialog, Sheet, Popover, DropdownMenu, Tooltip,
                     # Combobox, Command, Tabs, Toast, Table, DatePicker y demás — 30+ componentes
    tokens.ts       # Accesores tipados de tokens (paleta de gráficos, presupuesto, asistente)
  shared/
    schemas/        # Schemas Zod compartidos
    types/          # Tipos TypeScript globales
    money/          # Aritmética en céntimos (index.ts) + parseo de entrada de formularios
                     # (parse-money-input.ts, AC-PAT-09) — la presentación vive en ui/primitivas/money.tsx
    dates/          # Módulo único de fechas y zona horaria de Lima (lima.ts, AC-PAT-09)
    data/           # Patrón de obtención de datos (17): TanStack Query, claves de caché,
                     # invalidación selectiva por mutación, mutación optimista
    forms/          # Patrón de formularios (17): useZodForm (react-hook-form + Zod)
    api/            # Cliente HTTP compartido (envelope {ok,data,meta}) y clientes de API
                     # por módulo (money.ts) para las pantallas fuera de features/ (W-08+)
    copy/           # Copys y etiquetas de dominio reutilizables entre pantallas (money-copy.ts)
    ui/             # Componentes compartidos entre pantallas fuera de features/: DialogMutationError,
                     # CategorySelector (SCR-CAT-03, W-08+)
    routing/        # Validación de `redirigir` y del deep-link a una deuda
    legacy-nav/      # Puente entre el `onNavigate(view)` de las pantallas condenadas y las rutas reales
    accessibility/  # Parche de accesibilidad de modales (modal-accessibility-guard)
    privacy/        # Modo discreto y tema oscuro manual
    telemetry/      # Logger estructurado y trace IDs
    placeholder-section.tsx  # Marcador para secciones cuyo contenido construye un corte futuro
  data/
    supabase/       # Clientes Supabase (browser, server, service)
    repositories/   # Repositorios de datos
    migrations.test.ts  # Lee y verifica supabase/migrations/ — no hay una segunda copia de los .sql
  features/         # Screens de la app (settings, upcoming, movements, debts,
                     # pending, home, insights, search, auth, app-shell, onboarding,
                     # public-site) — módulo por módulo, en reconstrucción (52, REEMPLAZAR).
                     # money/ ya no existe: reconstruido en app/(app)/mi-dinero/ (W-08)
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
