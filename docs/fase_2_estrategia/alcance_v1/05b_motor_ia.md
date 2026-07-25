# Feature 2: Motor de IA Financiera Agentic Controlado

**Parte del Paso 5/20 — Alcance V1.0**  
**Prioridad:** P0  
**Última actualización:** 19 de julio, 2026  
**Estado:** V6.1 — Agentic Controlado, implementación híbrida sincronizada

---

## 0. Decisión ejecutiva

El motor de IA de Manzana no debe ser un LLM gigante decidiendo todo. Debe ser un sistema agentic controlado: agentes especializados para entender lenguaje, contexto e intención; motores determinísticos para ejecutar reglas financieras, validar dinero, calcular saldos, proteger confianza y activar automatizaciones.

La nueva tesis del motor es:

> **IA para entender cómo el usuario habla de su dinero. Determinismo para cuidar el dinero real. Orquestación para usar solo la inteligencia necesaria en cada caso.**

Esto cambia la arquitectura anterior de "Modo Datos vs Modo Conversación" hacia un modelo con:

- `FinancialOrchestrator` como cerebro operativo.
- Agentes especializados invocados solo cuando aportan valor.
- Motores determinísticos para cálculo, reglas, saldos, deudas, recurrentes, riesgo y nudges.
- `Context Packs` mínimos por tarea, no un JSON global enviado a todos.
- Runtime actual **Codex-first**, preparado para migrar agentes individuales a API después.

---

## 1. Filosofía del motor

### 1.1 Principios

| # | Principio | Implicación técnica |
|---|---|---|
| 1 | **La conversación es el producto** | WhatsApp debe sentirse natural, rápido y humano. |
| 2 | **El dinero exige determinismo** | Saldos, cajas, deudas, recurrentes, límites y riesgo se calculan con reglas trazables. |
| 3 | **Los agentes no escriben directo al Core** | Los agentes proponen acciones; el Orquestador y el Core validan y ejecutan. |
| 4 | **No todos los mensajes necesitan todos los agentes** | Un gasto simple no debe activar conversación profunda, insights ni nudges si no hace falta. |
| 5 | **Memoria en BD, no en el modelo** | La memoria vive en Supabase/Core y se inyecta como Context Pack. |
| 6 | **Contexto mínimo por agente** | Cada agente recibe solo lo necesario para su tarea. |
| 7 | **Nada sensible en trazas externas** | Mensajes, nombres y montos se quedan en la app; observabilidad externa va redactada. |
| 8 | **Codex ahora, API después** | El diseño permite mover agentes uno por uno a API sin reescribir el sistema. |
| 9 | **La experiencia debe entender a la persona** | El Orquestador decide intención, profundidad, tono, momento y acompañamiento; no solo qué herramienta ejecutar. |

Principio transversal:

> El Motor IA no existe solo para clasificar mensajes. Existe para que Manzana se sienta útil, humana y contextual. Una respuesta técnicamente correcta pero fría, invasiva o poco empática todavía es una mala respuesta de producto.

### 1.2 Qué significa "agentic" en Manzana

Un agente en Manzana no es una IA autónoma suelta. Es una unidad controlada con:

- Un prompt de rol específico.
- Un Context Pack limitado.
- Herramientas tipadas.
- Output estructurado.
- Reglas de seguridad.
- Trazabilidad.
- Permisos explícitos.

El agente puede entender, preguntar, explicar o proponer. No puede romper las reglas financieras ni saltarse el Core.

Un agente puede conocer el **catálogo completo de capacidades autorizadas** de
Manzana para planificar un caso complejo. Eso no significa acceso libre: conoce
los flujos, agentes, tools, motores, políticas y schemas disponibles, pero no
recibe credenciales, SQL libre ni el historial financiero completo. Los datos
históricos se recuperan bajo demanda mediante `ToolGateway`.

---

## 2. Arquitectura general: grafo orquestado

```text
┌─────────────────────────────────────────────────────────────────────┐
│                  Canales y eventos externos de entrada              │
│        WhatsApp · Email webhook · Dashboard · Scheduler · Webhooks   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────┐
│                     FinancialOrchestrator                            │
│ Intake · Kernel · Intent · Experience · Workflow · Policy · Trace     │
└───────────────┬───────────────────────────────┬─────────────────────┘
                │
                ├── ContextPackBuilder
                │     └─ arma contexto mínimo por agente, tool o respuesta
                │
                ├── AgentRuntime
                │     └─ ejecuta agentes en Codex/API/híbrido
                │          └─ Agentes LLM:
                │             OrchestrationPlanning · Data · Conversation · Correction · Response · InsightExperience · InsightNarrator
                │
                ├── ToolGateway
                │     ├─ Memoria financiera consultable
                │     │   DateResolver · FinancialQuery · SemanticSearch
                │     │   Timeline · PatternMemory · NarrativeMemory · Explanation
                │     ├─ Motores de calidad de experiencia
                │     │   Experience · ChangeDetection · SmartClarification
                │     │   NextBestAction · Trust · Personalization
                │     │   MicroReconstruction · ActionableInsights · Reviews
                │     └─ Consultas read-only al Core
                │
                ├── PolicyGate
                │     └─ riesgo · privacidad · permisos · confirmación · plan
                │
                ├── CommandDispatcher
                │     └─ única vía para escribir al Core Financiero
                │
                ├── ResponsePlanner
                │     └─ plantilla · ResponseAgent · ConversationAgent · formato canal
                │
                └── TraceCollector
                      └─ calidad · latencia · costo · confianza · outcomes

Core Financiero
  └─ comandos transaccionales: movimientos · cuentas · cajas · deudas · recurrentes

Domain Engines
  └─ Balance · Dedup · Recurring · Debt · Risk · Nudge · Learning · Disclosure

Data Layer
  └─ Supabase/PostgreSQL · audit_log · transactional_outbox · memoria · preferencias

Internal Domain Event Bus
  └─ eventos publicados desde transactional_outbox para procesos async
```

Este diagrama no representa una tubería lineal. Representa un **grafo orquestado**: el `FinancialOrchestrator` decide qué módulos invocar, en qué orden y con qué permisos según el caso.

La memoria no va "después" de los agentes. Los agentes la usan mediante `ToolGateway` mientras razonan. Los motores de experiencia pueden activarse antes, durante o después de una ejecución agentic.

### 2.1 Cambio principal vs arquitectura anterior

Antes el motor estaba descrito como dos modos:

- Modo Datos.
- Modo Conversación.

La nueva arquitectura mantiene esa diferencia conceptual, pero la implementa con agentes y motores:

- **Datos** ahora es principalmente `DataAgent` + validadores + Core.
- **Conversación** ahora es `ConversationAgent` con herramientas read-only.
- **Corrección** tiene un flujo propio con `CorrectionAgent`.
- **Respuestas** pueden salir de plantillas o de `ResponseAgent`.
- **Insights, nudges, recurrentes y deudas** no dependen de que un LLM piense todo: los motores detectan y calculan; los agentes redactan o aclaran.
- **Calidad de experiencia** se vuelve una capa explícita: el sistema decide profundidad, momento, claridad, siguiente acción y nivel de acompañamiento según el usuario.
- **Memoria y motores de experiencia** se invocan como herramientas o pasos del plan, no como una etapa fija posterior al agente.

### 2.2 Reglas del grafo orquestado

- El Orquestador puede invocar módulos en distinto orden según intención, estado, riesgo y experiencia.
- Los agentes no acceden directo a base de datos ni a Core: consultan mediante `ToolGateway`.
- La memoria consultable es read-only para agentes conversacionales.
- Los motores de experiencia pueden correr antes del agente, durante la investigación, después del resultado o en procesos async.
- `PolicyGate` revisa riesgo y privacidad antes y después de ejecutar.
- `CommandDispatcher` es la única vía hacia escrituras en Core.
- Core Financiero sigue siendo la fuente de verdad.
- `Transactional Outbox` garantiza que persistencia, auditoría y eventos queden consistentes.
- `Internal Domain Event Bus` dispara procesos posteriores sin bloquear la respuesta inmediata cuando no es necesario.
- Los eventos externos de entrada y los eventos internos de dominio no son el mismo canal.

---

## 3. FinancialOrchestrator

El `FinancialOrchestrator` es el coordinador central del motor. No reemplaza al Core Financiero; decide qué debe pasar antes y después de invocar agentes o motores.

No se convierte en una IA autónoma con autoridad financiera. Es un controlador
híbrido: conserva validaciones, políticas, ejecución y trazabilidad
determinísticas; puede invocar un `OrchestrationPlanningAgent` para interpretar
lenguaje libre y proponer el plan completo de un turno.

### 3.1 Descomposición interna

El `FinancialOrchestrator` no debe implementarse como una función gigante. Debe dividirse en módulos pequeños, cada uno con una responsabilidad clara.

```text
FinancialOrchestrator
  ├─ IntakeRouter
  ├─ ConversationKernel
  ├─ IntentRouter
  ├─ ExperienceModeRouter
  ├─ PlanningLayer
  │   ├─ OrchestrationPlanningAgent
  │   ├─ WorkflowPlanner
  │   └─ AgentPlanner
  ├─ ContextPackBuilder
  ├─ RuntimeRouter
  ├─ PolicyGate
  ├─ ExecutionEngine
  ├─ ToolGateway
  ├─ CommandDispatcher
  ├─ ResponsePlanner
  └─ TraceCollector
```

| Módulo | Responsabilidad |
|---|---|
| `IntakeRouter` | Normaliza entradas de WhatsApp, Email, Dashboard, Scheduler y webhooks/eventos externos permitidos a un formato común. |
| `ConversationKernel` | Maneja estado, continuidad, expiración suave, cancelaciones y cambios de intención. |
| `IntentRouter` | Entiende qué quiere hacer el usuario: registrar, consultar, corregir, confirmar, revisar, crear deuda, etc. |
| `ExperienceModeRouter` | Detecta si el usuario necesita captura rápida, análisis profundo, foco en deuda, liquidez, reconstrucción, revisión u onboarding. |
| `PlanningLayer` | Convierte el turno y el estado activo en un plan ejecutable, sin ejecutar dinero ni saltar políticas. |
| `OrchestrationPlanningAgent` | Interpreta semánticamente el objetivo, la continuidad y las intenciones mixtas; conoce el catálogo completo autorizado y propone un `ExecutionPlan` estructurado. Puede pedir más evidencia mediante tools permitidas antes de cerrar el plan. |
| `WorkflowPlanner` | Valida y compila el flujo de negocio propuesto: registro simple/múltiple, consulta histórica, corrección, email pendiente, deuda multi-paso o insight accionable. Completa pasos obligatorios que el agente no puede omitir. |
| `AgentPlanner` | Valida y compila agentes, tools, dependencias y runtimes del plan. Elige el orden de ejecución efectivo dentro del catálogo permitido. |
| `ContextPackBuilder` | Construye el Context Pack mínimo para cada agente, herramienta o respuesta. |
| `RuntimeRouter` | Decide si cada agente corre en Codex, API o modo híbrido. |
| `PolicyGate` | Puede vetar, pausar o exigir confirmación por riesgo, privacidad, permisos, modo discreto, opt-in o límites del plan. |
| `ExecutionEngine` | Ejecuta el plan paso a paso: agentes, herramientas read-only, motores de calidad y motores determinísticos. |
| `ToolGateway` | Controla el acceso de agentes a memoria, herramientas, motores de experiencia y consultas read-only. |
| `CommandDispatcher` | Traduce acciones aprobadas a comandos del Core Financiero. |
| `ResponsePlanner` | Decide plantilla, `ResponseAgent`, respuesta conversacional o respuesta mixta por canal. |
| `TraceCollector` | Registra calidad, latencia, costo, confianza, agentes usados, herramientas, policy gates y outcomes. |

### 3.2 Orden de ejecución

Flujo base:

```text
Entrada
  -> IntakeRouter
  -> ConversationKernel
  -> IntentRouter
  -> ExperienceModeRouter
  -> ContextPackBuilder (OrchestrationContextPack)
  -> OrchestrationPlanningAgent
  -> WorkflowPlanner + AgentPlanner (validan/compilan ExecutionPlan)
  -> ContextPackBuilder (packs específicos por paso)
  -> RuntimeRouter
  -> PolicyGate pre-execution
  -> ExecutionEngine
  -> ToolGateway cuando un agente necesita memoria, tools o consultas read-only
  -> CommandDispatcher si hay escritura aprobada
  -> PolicyGate post-execution
  -> ResponsePlanner
  -> TraceCollector
```

Reglas:

- `ConversationKernel` corre antes de decidir intención final, porque el estado activo puede cambiar el significado del mensaje.
- `PolicyGate` corre antes y después de ejecutar: antes para bloquear riesgo, después para revisar salida, privacidad y confirmaciones.
- `TraceCollector` es transversal: observa cada paso, no solo el resultado final.
- `ContextPackBuilder` no envía todo el User Context; selecciona lo mínimo según flujo, agente, herramienta y canal.
- `ToolGateway` evita acceso libre a BD/Core; toda consulta de agente pasa por herramientas con permisos y límites.
- `CommandDispatcher` es la única vía para mandar escrituras al Core. Los agentes nunca escriben directo.

### 3.3 Capa de planificación agentic

`OrchestrationPlanningAgent` no reemplaza a `WorkflowPlanner` ni a
`AgentPlanner`. Los tres colaboran con responsabilidades distintas:

```text
OrchestrationPlanningAgent
  -> propone intencion, workflow, agentes, tools, dependencias y estrategia de respuesta
WorkflowPlanner
  -> rechaza o completa flujos de negocio invalidos o incompletos
AgentPlanner
  -> rechaza o completa agentes/tools/runtimes fuera del catalogo permitido
ExecutionEngine
  -> ejecuta solamente el plan validado
```

El agente recibe un `OrchestrationContextPack` con:

- mensaje original y canal;
- estado conversacional, referencias activas, borradores y acciones recientes;
- preferencias, modo discreto, riesgo y permisos;
- catálogo completo versionado de workflows, agentes, tools, motores y modos de respuesta autorizados;
- presupuestos de tool calls, latencia y costo;
- resúmenes pertinentes ya recuperados.

El catálogo es completo para la **planificación**, no para la exposición de
datos. Si necesita movimientos de hace meses, saldos, deudas, cajas, memoria o
evidencia de un insight, propone una tool tipada. `ToolGateway` decide si la
ejecuta y devuelve un resultado limitado; el agente puede replanificar con ese
resultado hasta alcanzar el límite del turno.

Su salida no es texto libre ni chain-of-thought. Es un `ExecutionPlan`:

```ts
type ExecutionPlan = {
  goal: "record" | "query" | "correction" | "confirmation" | "review" | "help" | "mixed";
  workflow: string;
  semantic_query: ConversationQuery | null;
  semantic_turn: ConversationTurnState;
  pending_operation_resolution: "none" | "execute" | "replace" | "cancel";
  financial_resolution: {
    action: "none" | "list" | "confirm" | "discard";
    target: "none" | "pending_item" | "capture_draft";
    pending_code: string | null;
    confidence: number;
  };
  style_update: ConversationStyleUpdate | null;
  steps: Array<{
    kind: "agent" | "tool" | "core_command" | "policy_check" | "response";
    capability: string;
    depends_on: string[];
    purpose: string;
  }>;
  response_strategy: "acknowledge" | "clarify" | "confirm" | "explain" | "mixed";
  requires_confirmation: boolean;
  risk_flags: string[];
  confidence: number;
};
```

Ejemplo: `"Registré 20 en desayuno, ¿cómo voy esta semana?"` puede proponer
`DataAgent -> PolicyGate -> Core -> get_week_summary -> ConversationAgent ->
ResponseAgent`. El Core y los policy checks siguen siendo pasos obligatorios
insertados o validados por módulos determinísticos.

El `ExecutionPlan` producido por el agente es el plan bruto y se conserva en la
traza. Despues de obtener evidencia estructurada de `DataAgent` y del estado
conversacional, el orquestador puede reconciliar un plan efectivo. Si existe una
accion financiera clara y tambien una consulta read-only, el objetivo efectivo
debe ser `mixed` y el orden es `PolicyGate -> Core -> ToolGateway ->
ConversationAgent`. La reconciliacion no permite que el agente se apruebe a si
mismo ni evita confirmaciones: solo corrige el workflow; la autoridad de
escritura sigue en `CommandDispatcher` y Core. La traza conserva objetivo y
workflow bruto y efectivo para explicar cualquier diferencia.

### 3.3.1 Autoridad semantica y continuidad

Para mensajes de texto libre, la interpretacion primaria pertenece al
`OrchestrationPlanningAgent`. `ConversationKernel`, `IntentRouter`, `DataAgent`
y clasificadores locales aportan pistas o un modo degradado cuando el planner no
esta disponible; no pueden contradecir un plan semantico valido por reconocer
una palabra o una frase conocida.

La capa deterministica valida el plan, no reinterpreta la conversacion. Puede:

- rechazar tools, fechas, IDs, permisos o pasos invalidos;
- exigir confirmacion y resolver ambiguedad antes de una escritura;
- ejecutar comandos estructurados emitidos por botones o payloads con IDs;
- activar un fallback seguro si el runtime semantico falla.

No debe mantener un abanico creciente de regex para simular comprension humana.
Las fallas de significado se corrigen en contratos, Context Packs, prompts,
memoria y evaluaciones multiturno.

Cada turno recibe un estado de trabajo tipado, no solo el ultimo mensaje:
consulta activa, referencias, resultado anterior, borrador de captura,
pendientes candidatos, operacion read-only incompleta, cambio de tema y estilo
solicitado. Expresiones como "eso", "el ultimo", "si", "mejor no" o una fecha
relativa se resuelven contra ese estado y nunca funcionan por coincidencia de
texto aislada.

En busquedas de movimientos, el contrato semantico separa dos dimensiones:

- `date_range`: periodo exacto resuelto con zona horaria;
- `movement_filters`: restricciones financieras explicitamente pedidas, como
  tipo, categoria, fuente, cuenta, comercio o concepto.

Una expresion temporal como `antes de ayer` o `14 de julio` nunca se reutiliza
despues como filtro de comercio o categoria. Si el usuario solo pide un dia,
`movement_filters` queda vacio y `FinancialQueryEngine` devuelve todos los
movimientos confirmados de ese rango. Si pide `taxi del 14 de julio`, el rango y
el filtro `taxi` viajan separados. El parser textual legado solo puede intervenir
cuando no existe un plan semantico valido.

### 3.4 Límites no negociables del planificador

- No ejecuta DB, Core, envíos externos ni herramientas privilegiadas.
- No puede aprobar su propio `core_command`; solo puede proponerlo.
- No puede omitir `PolicyGate`, confirmaciones, deduplicación, auditoría ni outbox.
- No decide cálculos, saldos, límites de riesgo ni estado final de dinero.
- No recibe ni expone razonamiento interno crudo.
- Si el plan es inválido, supera presupuesto o no tiene evidencia, el sistema cae a un flujo seguro de aclaración o a una ruta determinística.
- Las ambiguedades se acotan por `scope` y, cuando corresponde, por
  `action_id`. Una duda de una consulta read-only no bloquea una accion
  financiera independiente y clara del mismo mensaje. En un gasto simple, una
  cuenta no indicada puede quedar en `null` sin convertir el movimiento en
  pendiente por ese unico motivo.

### 3.5 Responsabilidades del orquestador completo

| Responsabilidad | Descripción |
|---|---|
| Clasificar intención inicial | Determina si el mensaje es registro, corrección, consulta, confirmación, comando, deuda, recurrente o conversación. |
| Respetar estado conversacional | Si el usuario está en `awaiting_confirmation`, `creating_debt`, `reviewing_pending`, etc., el estado tiene prioridad. |
| Construir el plan de ejecución | `WorkflowPlanner` decide flujo; `AgentPlanner` decide agentes; `ExecutionEngine` ejecuta pasos. |
| Controlar costo y latencia | Evita invocar agentes innecesarios. |
| Aplicar riesgo | Acciones sensibles pasan por `RiskPolicyEngine`. |
| Aplicar calidad de experiencia | Decide nivel de detalle, clarificación, next best action, tono y oportunidad. |
| Coordinar escritura | Solo Core crea, edita, borra o confirma movimientos. |
| Emitir eventos | Publica eventos como `movimiento_creado`, `movimiento_corregido`, `email_parseado`, `cuota_proxima`. |
| Trazar ejecución | Registra agent runs, herramientas, confianza, latencia y runtime. |

### 3.6 Regla de activación

> El Orquestador activa el mínimo conjunto de agentes y motores capaz de resolver la intención con confianza suficiente.

| Caso | Flujo | Agentes | Motores/herramientas |
|---|---|---|---|
| "Gasté 8 en café" | Registro simple | `DataAgent` | Validadores, Core, Balance, outbox/evento interno |
| "Hoy gasté 8 café, 15 taxi y 20 almuerzo" | Registro múltiple | `DataAgent` | Validadores, Core, Balance, Dedup |
| "Gasté 20 en almuerzo, ¿cómo va mi presupuesto?" | Registro + consulta | `DataAgent`, luego `ConversationAgent` | Core, Balance, Cajas, posibles hooks |
| "Eso no fue taxi, fue Uber de trabajo" | Corrección | `CorrectionAgent` | Core, Learning, Balance |
| "¿Puedo gastar S/50 hoy?" | Consulta de liquidez | `ConversationAgent` | Balance, Cuentas/Cajas, Deudas, Recurrentes |
| Email bancario detectado | Pendiente email | `DataAgent`, `ResponseAgent` o plantilla | Pending Inbox, Dedup |
| Cuota próxima | Nudge de compromiso | `ResponseAgent` o plantilla | Debt Engine, Nudge Policy |
| Recurrente detectado | Confirmación recurrente | Ninguno o `ResponseAgent` | Recurring Engine, Pending/Confirmation |
| Insight semanal | Insight accionable | `InsightExperienceAgent` si necesita framing + `InsightNarratorAgent` | Insights Engine, Nudge Policy |
| "¿Por qué este mes siento que se me va más plata?" | Qué cambió | `ConversationAgent` | ChangeDetection, FinancialQuery, PatternMemory, Explanation |
| "Creo que ayer gasté en taxi y comida pero no recuerdo cuánto" | Reconstrucción | `ConversationAgent`, posible `DataAgent` | MicroReconstruction, Pending Inbox, PatternMemory |
| "Gasté 3 cafés esta semana" con límite existente | Next best action | `ResponseAgent` o plantilla | BudgetGoalReactor, NextBestAction, Nudge Policy |

### 3.7 Estados conversacionales soportados

El Orquestador debe respetar la state machine definida para WhatsApp:

- `idle`
- `processing`
- `awaiting_clarification`
- `awaiting_confirmation`
- `awaiting_risk_confirmation`
- `editing_movement`
- `creating_account`
- `creating_debt`
- `creating_pocket`
- `onboarding`
- `reviewing_pending`
- `error_recovery`
- `cancelled`
- `completed`

Reglas globales:

- Una cancelacion expresada naturalmente detiene el flujo activo cuando el plan
  semantico la vincula con ese flujo; los ejemplos de copy no forman una lista
  cerrada de comandos.
- Un cambio claro de intención pausa el flujo anterior y responde lo nuevo.
- Una confirmación ambigua no ejecuta acciones de alto riesgo.
- La expiración suave debe venir del Orquestador, no de cada agente por separado.

---

## 4. AgentRuntime: Codex-first, API-ready

### 4.1 Decisión actual

En esta etapa, Manzana usará una estrategia **Codex-first**:

- Todos los agentes pueden correr inicialmente sobre Codex.
- Los prompts, herramientas y Context Packs se diseñan separados por agente desde el día 1.
- La arquitectura no asume que Codex tendrá costo marginal cero, cuota infinita ni latencia estable para producción masiva.
- Cada invocación se mide para decidir qué agente conviene migrar a API después.

### 4.2 Abstracción requerida

```typescript
export type AgentRuntimeProvider = "codex" | "api";

export type AgentName =
  | "orchestration_planning_agent"
  | "data_agent"
  | "conversation_agent"
  | "correction_agent"
  | "response_agent"
  | "insight_experience_agent"
  | "insight_narrator_agent";

export interface AgentRuntimeRequest<TContext> {
  agent: AgentName;
  provider: AgentRuntimeProvider;
  user_id: string;
  channel: "whatsapp" | "email" | "dashboard" | "scheduler";
  context_pack: TContext;
  input: unknown;
  constraints: {
    max_latency_ms?: number;
    max_cost_usd?: number;
    requires_structured_output: boolean;
    allow_write_tools: false;
  };
}

export interface AgentRuntimeResponse<TOutput> {
  output: TOutput;
  runtime: {
    provider: AgentRuntimeProvider;
    model_or_session: string;
    latency_ms: number;
    cost_estimate_usd: number | null;
  };
  trace: {
    agent_run_id: string;
    context_pack_version: string;
    prompt_version: string;
  };
}
```

### 4.3 Migración futura por agente

| Fase | Runtime | Decisión |
|---|---|---|
| Fase 0 | Codex-first | Construir y validar todos los agentes con separación real de prompts, herramientas y outputs. |
| Fase 1 | Híbrido | Migrar `DataAgent`, `CorrectionAgent` y `ResponseAgent` a API barata si las métricas lo justifican. |
| Fase 2 | Escala | Enrutar por costo, latencia, riesgo, plan del usuario y calidad observada. |

Primeros candidatos a API:

- `DataAgent`, por alto volumen y output estructurado.
- `CorrectionAgent`, por tarea acotada.
- `ResponseAgent`, cuando la respuesta no pueda salir de plantilla.

`ConversationAgent` puede permanecer más tiempo en Codex si entrega mejor calidad para análisis, presupuestos, micro-reconstrucción financiera y conversación larga.

---

## 5. Agentes LLM

### 5.1 DataAgent

Interpreta mensajes que pueden convertirse en datos financieros.

Responsabilidades:

- Extraer intención financiera.
- Detectar uno o varios movimientos.
- Inferir categoría, subcategoría, etiquetas y cuenta cuando haya evidencia suficiente.
- Detectar deuda, préstamo, devolución, transferencia, asignación interna o recurrente.
- Identificar ambigüedades.
- Devolver acciones propuestas, no escribir en base de datos.

No hace:

- Calcular saldos.
- Confirmar emails automáticamente.
- Crear movimientos directo.
- Dar asesoría.
- Inventar montos, cuentas, personas o fechas.

### 5.2 ConversationAgent

Responde preguntas financieras y acompaña al usuario.

Responsabilidades:

- Explicar gastos, patrones, dinero libre, deudas, cajas y recurrentes.
- Responder consultas históricas y cruzadas sobre cualquier periodo disponible.
- Ayudar a reconstruir un día incompleto.
- Responder "¿puedo gastar S/50 hoy?" usando datos reales.
- Proponer presupuestos o límites si el dominio ya tiene esa capacidad.
- Derivar cualquier acción de escritura al Orquestador.

Herramientas permitidas:

- `DateResolver`, para interpretar fechas humanas y ambiguas.
- `FinancialQueryEngine`, para consultar movimientos, saldos, categorías, cuentas, cajas, personas y periodos.
- `TimelineMemory`, para reconstruir días, semanas, meses o etapas.
- `SemanticMemorySearch`, para encontrar recuerdos financieros por significado, no solo por texto exacto.
- `PatternMemory`, para recuperar patrones aprendidos del usuario.
- `ExplanationEngine`, para explicar de dónde sale cada respuesta.
- Lectura de pendientes.

No hace:

- Mutar datos.
- Registrar movimientos por su cuenta.
- Recomendar inversiones, bancos, tasas o productos financieros.
- Dar asesoría tributaria.

Acceso a memoria:

- Usa memoria, motores de experiencia y consultas read-only solo mediante `ToolGateway`.
- No ejecuta SQL ni consultas libres.
- No recibe todo el historial en prompt.
- Puede llamar varias herramientas durante una consulta compleja si el `ExecutionEngine` lo permite.

### 5.3 CorrectionAgent

Interpreta correcciones del usuario.

Responsabilidades:

- Resolver referencias como "el último", "el taxi", "lo de ayer", "ese gasto".
- Proponer edición, borrado o deshacer.
- Detectar si hay múltiples candidatos.
- Alimentar al Learning Engine cuando la corrección se confirma.

No hace:

- Borrar sin confirmación cuando la referencia sea ambigua.
- Cambiar saldos directamente.
- Justificar errores del sistema.

### 5.4 ResponseAgent

Redacta respuestas cuando una plantilla no basta.

Responsabilidades:

- Adaptar tono al usuario.
- Aplicar instrucciones libres de estilo solicitadas por el usuario durante el
  alcance acordado: un turno, la sesion o de forma persistente. Humor, sobriedad,
  comparaciones, tecnicidad o brevedad son ejemplos, no categorias cerradas.
- Recibir un `ResponseContextPack` con estado emocional probable, continuidad, modo de experiencia, preferencia de tono y hechos ya confirmados.
- Respetar modo discreto.
- Explicar decisiones complejas en lenguaje simple.
- Preparar respuestas para confirmaciones, dudas o conflictos.
- Mantener continuidad sin repetir presentación, ayuda genérica ni datos que el usuario ya conoce.
- Personalizar solo con señales entregadas por contexto o memoria confirmada; nunca diagnosticar emociones ni inventar intimidad.

El agente redacta, pero no cambia montos, links, códigos de pendiente, decisiones de PolicyGate ni resultados de Core. La salida debe validarse en ambas direcciones: no puede omitir un hecho obligatorio ni agregar uno que no exista en la respuesta base.

Tampoco puede prometer una accion futura como "volvere a consultar" o "te
aviso" si el turno no creo un job, tool call o workflow real que la ejecute.

Uso recomendado:

- Usar plantillas para registros simples.
- Usar `ResponseAgent` para respuestas con ambigüedad, varios movimientos, explicación, insight o tono delicado.

### 5.5 InsightExperienceAgent

Agente de calidad experiencial para insights. Eleva los criterios base de wow (personal, sorprendente, explicable, accionable y amable) hacia autodescubrimiento financiero amable: que el usuario se reconozca en un patron util sin culpa. Mejora percepcion de inteligencia, personalizacion y timing, sin calcular datos financieros.

Responsabilidades:

- Elegir el framing mas personal entre insights candidatos ya validados.
- Detectar si un insight suena frio, obvio, invasivo o culpabilizante.
- Evitar diagnosticar a la persona; solo observar patrones con evidencia.
- Recomendar profundidad: breve, explicativa, accionable o exploratoria.
- Considerar feedback historico, tono, etapa del usuario y sensibilidad.
- Recomendar si conviene mostrar ahora, esperar o dejarlo solo en Dashboard.

No hace:

- Calcular insights desde cero.
- Validar saldos, montos, deuda o recurrentes.
- Saltarse `InsightQualityGate`, `Risk Policy` o `Nudge Policy`.
- Enviar mensajes.

Uso recomendado:

- Invocarlo solo cuando hay varios candidatos, sensibilidad, posible envio proactivo, micro-descubrimiento temprano o necesidad clara de personalizacion.
- No invocarlo para resúmenes simples o insights obvios de baja complejidad.

### 5.6 InsightNarratorAgent

Convierte resultados de motores analíticos en mensajes útiles.

Responsabilidades:

- Narrar insights comparativos, patrones, anomalías o proyecciones.
- Explicar la fuente de cada número.
- Evitar tono de regaño.
- Sugerir una acción ligera cuando sea natural.

No hace:

- Calcular insights desde cero.
- Decidir frecuencia de nudges.
- Enviar mensajes ignorando opt-in, horario silencioso o modo discreto.

---

## 6. Core, Domain Engines y motores de calidad

La arquitectura separa tres conceptos que no deben mezclarse:

| Capa | Responsabilidad | Ejemplos |
|---|---|---|
| Core Financiero | Ejecuta comandos transaccionales y mantiene la verdad financiera. | Crear movimiento, confirmar pendiente, editar deuda, soft delete. |
| Domain Engines | Calculan, validan o reaccionan con reglas determinísticas. | Balance, Dedup, Debt, Recurring, Risk, Nudge, Learning. |
| Data Layer | Persiste estado, auditoría, outbox y memoria. | Supabase/PostgreSQL, audit_log, transactional_outbox. |

### 6.1 Core Financiero

El Core Financiero no es la base de datos. Es la capa de dominio que valida y ejecuta comandos financieros.

Responsabilidades:

- Crear, editar, confirmar, borrar y auditar movimientos.
- Aplicar reglas de afectación financiera.
- Mantener consistencia entre movimiento, cuenta, caja, deuda o recurrente.
- Escribir audit log.
- Escribir eventos en `transactional_outbox`.
- Rechazar comandos incompletos, ambiguos o no autorizados.

### 6.2 Domain Engines determinísticos

Los Domain Engines son parte central de la calidad. No son "menos inteligentes"; son la forma correcta de proteger exactitud, costo y confianza.

| Engine | Responsabilidad | Por qué no debe ser LLM |
|---|---|---|
| Balance Engine | Calcular saldos, dinero libre y afectación de cajas | Debe ser exacto y reproducible. |
| Accounts/Boxes Engine | Aplicar cuentas y cajas | Dinero disponible no es dinero total. |
| Debt Engine | Estado de deudas, pagos, cuotas, personas | Reglas financieras claras. |
| Recurring Engine | Detectar y gestionar recurrentes | Patrones de fecha/monto son verificables. |
| Dedup Engine | Evitar duplicados entre WhatsApp, email y dashboard | Debe comparar eventos de forma estable. |
| Pending Inbox | Guardar emails y acciones no confirmadas | V1 nunca auto-registra emails. |
| Risk Policy Engine | Exigir confirmación para acciones sensibles | Seguridad antes que fluidez. |
| Nudge Policy Engine | Decidir si, cuándo y cómo nudgear | Respeta opt-in, frecuencia y horario. |
| Learning Engine | Guardar correcciones y preferencias | Memoria trazable por usuario. |
| Disclosure Engine | Mostrar u ocultar complejidad | Experiencia progresiva. |
| BudgetGoalReactor | Hook opcional para metas/límites existentes | No es feature formal hasta tener documento propio. |

### 6.3 Data Layer y Transactional Outbox

El Data Layer persiste estado. No decide reglas financieras.

Incluye:

- Supabase/PostgreSQL.
- Tablas financieras.
- `audit_log`.
- `transactional_outbox`.
- Memoria financiera y narrativa.
- Preferencias del usuario.
- Estados conversacionales.

#### 6.3.1 Transactional Outbox

Como Manzana maneja dinero, auditoría y eventos, los eventos internos no deben publicarse directamente desde el Core durante una operación. Deben escribirse dentro de la misma transacción de base de datos.

Flujo correcto:

```text
Core ejecuta transacción
  -> guarda movimiento/deuda/caja/recurrente
  -> guarda audit_log
  -> guarda evento en transactional_outbox
  -> commit
  -> Outbox Worker lee eventos pendientes
  -> publica al Internal Domain Event Bus
  -> marca evento como publicado
```

Esto evita fallas clásicas:

- Movimiento guardado pero evento no publicado.
- Evento publicado pero transacción financiera fallida.
- Balance no recalculado.
- Insight o nudge disparado con datos inexistentes.
- Auditoría incompleta.

Campos mínimos del outbox:

```typescript
export interface TransactionalOutboxEvent {
  outbox_id: string;
  event_id: string;
  event_type: string;
  event_version: number;
  user_id: string;
  aggregate_type: "movement" | "debt" | "box" | "recurring" | "pending" | "user";
  aggregate_id: string;
  payload: unknown;
  idempotency_key: string;
  correlation_id: string;
  causation_id: string | null;
  status: "pending" | "published" | "failed";
  attempts: number;
  created_at: string;
  published_at: string | null;
}
```

Reglas:

- Todo evento que derive de una escritura financiera se guarda primero en `transactional_outbox`.
- El Event Bus interno publica desde outbox, no desde agentes ni desde adaptadores.
- Los consumidores deben ser idempotentes.
- Si falla la publicación, el evento queda pendiente para retry.
- Si excede retries, va a revisión o dead-letter queue.

### 6.4 Regla de oro

> Si una decisión se puede resolver con una regla financiera exacta, no debe delegarse a un agente.

Ejemplos:

- Una transferencia no cuenta como gasto.
- Una asignación interna no cambia patrimonio total.
- Un pendiente no afecta saldos.
- Una deuda puede existir aunque el usuario no registre todos sus gastos.
- Un email bancario detectado se confirma por WhatsApp antes de registrarse.
- Una cuota recurrente puede actualizar deuda si está vinculada.

### 6.5 Motores de calidad de producto

Estos motores no existen para "hacer más compleja" la arquitectura. Existen para que Manzana se sienta más útil, más personal y más inteligente con el uso.

#### 6.5.1 Mapa por función

| Función | Motores | Qué mejora |
|---|---|---|
| Contexto y personalización | `ExperienceIntelligenceEngine`, `PersonalizationLoopEngine`, `NarrativeMemoryEngine` | La experiencia se adapta al usuario y a su momento. |
| Diagnóstico y comprensión | `ChangeDetectionEngine`, `MicroReconstructionEngine` | Explica qué cambió y ayuda a reconstruir datos incompletos. |
| Decisión conversacional | `ClarificationStrategyEngine`, `TrustExperienceLayer` | Pregunta mejor, muestra confianza y evita falsa precisión. |
| Acción y utilidad | `NextBestActionEngine`, `ActionableInsightEngine` | Convierte datos e insights en próximos pasos útiles. |
| Retención y acompañamiento | `DailyWeeklyReviewEngine` | Cierres diarios/semanales útiles sin ser reporte pesado. |

#### 6.5.2 ExperienceIntelligenceEngine

Manzana debe decidir qué experiencia necesita el usuario ahora, no solo qué intención escribió.

Modos posibles:

- `quick_capture`: registrar rápido, respuesta mínima.
- `debt_focus`: priorizar deudas, personas, cuotas y progreso.
- `liquidity_focus`: priorizar dinero libre, cajas y compromisos.
- `reconstruction`: ayudar a recordar movimientos incompletos.
- `review`: revisar pendientes, semana o mes.
- `deep_analysis`: responder preguntas complejas con memoria consultable.
- `onboarding_light`: enseñar sin abrumar.

Ejemplo:

```text
Camila registra "taxi 15" -> respuesta mínima.
Diego pregunta "¿puedo gastar 50?" -> dinero libre + deudas + compromisos.
Valentina dice "Luis me pagó" -> deudas/personas primero.
```

#### 6.5.3 NarrativeMemoryEngine

La memoria narrativa guarda contexto que explica la vida financiera del usuario.

Ejemplos:

- "Empezó trabajo presencial."
- "Está pagando una laptop."
- "Tiene viaje a Cusco en julio."
- "Este mes está ayudando a su mamá."
- "Suele salir con Luis los viernes."
- "Quiere bajar delivery, pero sin sentirse juzgado."

Reglas:

- Solo guardar hechos derivados de mensajes, correcciones o confirmaciones claras.
- No convertir inferencias sensibles en memoria estable sin confirmación.
- Permitir que el usuario corrija o borre memoria narrativa.
- Usarla para explicar cambios, no para juzgar.

Respuesta que habilita:

```text
Tu transporte subió, pero tiene sentido: desde que empezaste a ir presencial, tus taxis de lunes a viernes aumentaron.
```

#### 6.5.4 ChangeDetectionEngine

Este motor responde la pregunta más valiosa para muchos usuarios:

> "¿Qué cambió?"

Compara:

- Mes actual vs mes anterior.
- Semana actual vs semana anterior.
- Antes/después de un evento narrativo.
- Categorías que subieron o bajaron.
- Recurrentes nuevos.
- Deudas o cuotas nuevas.
- Gastos atípicos.
- Cambios por día de semana, comercio o persona.

Debe devolver:

- Cambios principales.
- Magnitud.
- Fuente.
- Si el cambio es normal, atípico o explicado por un evento.
- Acción sugerida si aplica.

Ejemplo:

```text
No subió todo. Este mes cambiaron 3 cosas:
- Delivery subió S/120.
- Transporte subió S/85.
- Apareció una cuota de S/180 que no estuvo el mes pasado.

Sin esa cuota, tu mes estaría parecido al anterior.
```

#### 6.5.5 MicroReconstructionEngine

El usuario real no registra perfecto. Este motor ayuda a reconstruir sin inventar.

Entrada típica:

```text
Creo que ayer gasté en taxi y comida pero no recuerdo cuánto.
```

Salida esperada:

```text
Ayer tengo 2 pistas:
- Sueles registrar taxi entre S/12 y S/18 cuando sales de noche.
- Hay un email pendiente de Yape por S/24.

¿Quieres revisar esos movimientos?
```

Reglas:

- Nunca crear montos inventados.
- Usar rangos solo como ayuda conversacional, no como registro.
- Priorizar pendientes reales sobre inferencias.
- Si el usuario confirma un monto, recién ahí pasa a Core.

#### 6.5.6 ClarificationStrategyEngine

Cuando hay duda, Manzana no debe sonar como formulario.

Malo:

```text
¿Qué tipo de movimiento es?
```

Mejor:

```text
Suena a préstamo a Luis. ¿Lo registro así?
```

O si hay dos opciones reales:

```text
¿Fue préstamo a Luis o un regalo?
```

Estrategias:

- `silent_accept`: registrar y permitir corrección si el riesgo es bajo.
- `suggested_confirm`: sugerir la opción más probable.
- `two_option_question`: preguntar entre dos alternativas claras.
- `missing_field_question`: pedir solo el dato que falta.
- `risk_block`: exigir confirmación explícita.

#### 6.5.7 NextBestActionEngine

Este motor sugiere el siguiente paso útil solo cuando hay una señal fuerte.

Ejemplos:

| Señal | Siguiente acción |
|---|---|
| Netflix aparece 3 meses | "¿Lo marco como recurrente?" |
| Cuota de laptop pagada | "¿Quieres vincularla a tu deuda de laptop?" |
| Delivery sube fuerte | "¿Quieres que lo vigilemos esta semana?" |
| Usuario crea caja emergencia | "¿Quieres separar algo ahora?" |
| Hay 4 emails pendientes | "¿Los revisamos juntos?" |
| Usuario menciona cafés y hay límite | "Te quedan S/6 esta semana." |

Reglas:

- No sugerir algo en cada respuesta.
- No activar nudges sin consentimiento.
- No crear metas/límites si no existe feature formal o confirmación clara.
- Respetar plan, modo discreto y momento.

#### 6.5.8 TrustExperienceLayer

La confianza no debe vivir solo en backend. El usuario debe sentir control.

Incluye:

- Fuente visible: WhatsApp, Email confirmado, Dashboard/manual, recurrente.
- Corrección fácil.
- "¿Por qué?" explicable.
- Incertidumbre honesta.
- Confirmaciones específicas.
- Indicador de pendiente cuando algo no afecta saldo.
- Registro de qué aprendió Manzana y cómo cambiarlo.

Ejemplo:

```text
Lo puse como transporte porque dijiste "Uber". Si fue por trabajo, lo cambio.
```

#### 6.5.9 PersonalizationLoopEngine

El aprendizaje debe mejorar la experiencia, no solo la clasificación.

Aprende:

- Prefiere respuestas breves o detalladas.
- Usa pocos emojis.
- Registra más de noche.
- Responde mejor a resumen nocturno que a nudges matutinos.
- Usa Manzana principalmente para deudas.
- Corrige seguido gastos de trabajo.
- Ignora insights largos.

No aprende automáticamente:

- Preferencias sensibles.
- Reglas que afecten dinero real.
- Nudges proactivos.
- Metas/límites.
- Recurrentes.

#### 6.5.10 ActionableInsightEngine

Un insight debe terminar en claridad o acción, no solo en un dato.

Ejemplo pasivo:

```text
Delivery subió 38%.
```

Ejemplo de calidad:

```text
Delivery subió 38% esta semana. Fueron 4 pedidos más que la anterior. ¿Quieres que lo vigilemos esta semana?
```

Tipos de acción:

- Vigilar categoría.
- Revisar pendiente.
- Marcar recurrente.
- Crear caja.
- Vincular deuda.
- Pausar nudge.
- Ignorar insight para no repetirlo.

#### 6.5.11 DailyWeeklyReviewEngine

Genera cierres útiles, no reportes largos.

Cierre diario:

```text
Hoy registraste 4 movimientos. También detecté 2 pendientes de email. ¿Los revisamos?
```

Cierre semanal:

```text
Esta semana lo más distinto fue transporte: subió S/75. Delivery bajó S/40 y tienes una cuota próxima el martes.
```

Reglas:

- Opt-in para mensajes proactivos.
- Modo discreto en WhatsApp.
- No enviar si no hay datos suficientes.
- No repetir información que el usuario ya vio.
- Siempre ofrecer una acción clara o cerrar sin pedir nada.

#### 6.5.12 Cuándo se activan los motores de experiencia

Los motores de experiencia no son una etapa posterior a los agentes. El Orquestador puede invocarlos en distintos momentos:

| Momento | Motores típicos | Ejemplo |
|---|---|---|
| Antes del agente | `ExperienceIntelligenceEngine`, `ClarificationStrategyEngine`, `PolicyGate` | Detectar captura rápida y evitar una respuesta larga. |
| Durante el agente | `ChangeDetectionEngine`, `NarrativeMemoryEngine`, `MicroReconstructionEngine`, `PatternMemory` | Investigar por qué cambió el gasto del mes. |
| Después del agente | `NextBestActionEngine`, `TrustExperienceLayer`, `ActionableInsightEngine`, `ResponsePlanner` | Sugerir marcar Netflix como recurrente después de detectar patrón. |
| Async después del Core | `DailyWeeklyReviewEngine`, `PersonalizationLoopEngine`, `LearningEngine`, `NudgePolicyEngine` | Generar cierre semanal o ajustar preferencias de nudges. |

Regla:

> La calidad de experiencia es contextual. Puede aparecer antes, durante o después del razonamiento, pero siempre bajo control del Orquestador y las políticas del sistema.

---

## 7. Context Packs

### 7.1 Por qué cambiar el User Context

El contexto anterior era un JSON global enviado a ambos modos. Eso escala mal porque:

- Aumenta costo y latencia.
- Expone más datos de los necesarios.
- Mezcla tareas simples con conversación profunda.
- Dificulta evaluar qué contexto causó una decisión.

El nuevo modelo usa `Context Packs`: paquetes mínimos, versionados y específicos por tarea.

### 7.2 Base común

Todo Context Pack incluye:

```typescript
export interface BaseContextPack {
  context_pack_version: string;
  user_id: string;
  locale: "es-PE";
  default_currency: "PEN" | "USD";
  user_style: {
    tone: "breve" | "normal" | "detallado";
    formality: "informal" | "neutral" | "formal";
    emoji_level: "none" | "low" | "medium";
  };
  privacy: {
    discreet_mode: boolean;
    hide_amounts_in_proactive_messages: boolean;
  };
  plan_capabilities: {
    plan: "free" | "plata" | "oro";
    advanced_conversation_enabled: boolean;
    proactive_nudges_enabled: boolean;
    predictions_enabled: boolean;
  };
  conversation_state: {
    state: string;
    active_flow_id: string | null;
    expires_at: string | null;
  };
  experience: {
    mode:
      | "quick_capture"
      | "debt_focus"
      | "liquidity_focus"
      | "reconstruction"
      | "review"
      | "deep_analysis"
      | "onboarding_light";
    quality_signals: string[];
  };
}
```

### 7.3 DataContextPack

Para `DataAgent`.

Incluye:

- Cuentas activas y aliases.
- Cajas frecuentes si el mensaje habla de separar, guardar o usar dinero.
- Categorías base y subcategorías del usuario.
- Personas relacionadas frecuentes.
- Últimas correcciones relevantes.
- Movimientos recientes solo para dedup y referencias.
- Jerga personalizada.

No incluye:

- Historial mensual completo.
- Insights profundos.
- Proyecciones.
- Datos no necesarios para clasificar el mensaje.

### 7.3.1 DataContextPack V2 implementado

La implementacion vigente amplia este pack con cajas activas, subcategorias,
tags, personas relacionadas y aliases, movimientos recientes, correcciones y
vocabulario aprendido con evidencia confirmada, ademas de preferencias, modo
discreto y riesgo acotado para el turno. Se envia solo el contexto pertinente;
la memoria historica se consulta mediante herramientas read-only de
`ToolGateway`, no como historial completo dentro del prompt.

### 7.4 ConversationContextPack

Para `ConversationAgent`.

Incluye según la consulta:

- Resumen de saldos.
- Dinero libre.
- Cajas y compromisos.
- Deudas activas.
- Recurrentes próximos.
- Agregados por categoría y periodo.
- Últimos insights relevantes.
- Pendientes si el usuario pregunta por movimientos no confirmados.

No incluye:

- Raw emails.
- Mensajes completos antiguos.
- Personas no relevantes.

### 7.5 CorrectionContextPack

Para `CorrectionAgent`.

Incluye:

- Últimos movimientos candidatos.
- Última respuesta enviada.
- Estado conversacional.
- Historial de cambios reciente.
- Reglas de deshacer.

### 7.6 DebtContextPack

Para flujos de deuda, prestamo, pago, devolucion y personas relacionadas.

Incluye:

- Deudas activas relevantes.
- Personas relacionadas frecuentes y aliases.
- Cuotas proximas o vencidas.
- Deudas por persona/entidad mencionada.
- Cajas compromiso vinculadas a deuda.
- Recurrentes vinculados a deuda.
- Movimientos recientes solo para dedup y pagos candidatos.
- Reglas de ambigüedad entre gasto, regalo, prestamo y pago de deuda.
- Restricciones de modo discreto si la respuesta sera proactiva.

No incluye:

- Historial completo de deudas cerradas salvo que el usuario pregunte.
- Datos de contacto de terceros.
- Informacion bancaria de la otra persona.

### 7.7 RecurringContextPack

Para flujos de recurrentes, pagos esperados, ocurrencias, cambios de monto y pagos vinculados.

Incluye:

- Recurrentes activos relevantes.
- Candidatos recurrentes pendientes.
- Ocurrencias proximas, vencidas o pendientes de confirmacion.
- Pagos similares recientes para dedup.
- Caja compromiso vinculada si existe.
- Deuda vinculada si existe.
- Cuenta sugerida o ultima cuenta usada.
- Estado de opt-in para nudges de recurrentes.
- Restricciones de modo discreto si el mensaje sera proactivo.

No incluye:

- Todo el historial financiero.
- Recurrentes cancelados no relevantes salvo que el usuario pregunte.
- Datos sensibles no relacionados con el pago esperado.

### 7.8 InsightContextPack

Para `InsightExperienceAgent` e `InsightNarratorAgent`.

Incluye:

- Resultado ya calculado por Insights Engine.
- Datos agregados que sustentan el insight.
- Candidatos alternativos cuando existan.
- Score, sensibilidad, novelty y accionabilidad.
- Feedback historico sobre insights similares.
- Etapa del usuario: nuevo, en aprendizaje, activo, avanzado.
- Preferencias de tono.
- Restricciones de nudges y modo discreto.
- Historial de entregas por canal cuando afecte repeticion o frecuencia.
- Estado de frecuencia por canal para no reenviar algo innecesario.
- Version previa o insight desactualizado si se esta explicando una actualizacion.

### 7.9 NudgeContextPack

Para mensajes proactivos.

Incluye:

- Motivo del nudge.
- Tipo de nudge.
- Opt-in aplicable.
- Horario silencioso.
- Frecuencia diaria/semanal.
- Historial de nudges similares.
- Canal permitido.
- Modo discreto.
- Sensibilidad.
- Acción sugerida.
- Texto permitido sin datos sensibles.
- Entidad vinculada: deuda, recurrente, insight, pendiente o movimiento.

### 7.10 RiskContextPack

Para confirmaciones sensibles.

Incluye:

- Acción propuesta.
- Motivo del riesgo.
- Nivel de impacto.
- Frase de confirmación requerida.
- Datos mínimos para mostrar al usuario.

### 7.11 Capa de memoria financiera consultable

Los `Context Packs` no son toda la memoria del usuario. Son solo el contexto mínimo que se envía al agente para una tarea específica.

Para dar una experiencia de alta calidad, Manzana necesita además una **memoria financiera consultable**: una capa de herramientas que permite al agente buscar, cruzar y explicar cualquier dato histórico disponible sin cargar todo el historial en el prompt.

La regla es:

> El contexto puede crecer indefinidamente en la base de datos, pero el agente accede a esa memoria mediante herramientas, consultas y agregados relevantes.

#### 7.11.1 Qué guarda la memoria

La memoria completa vive en Supabase/Core y sistemas derivados:

- Movimientos confirmados, corregidos y eliminados.
- Cuentas y cajas.
- Deudas y préstamos.
- Recurrentes detectados o confirmados.
- Pendientes de email.
- Personas relacionadas.
- Correcciones del usuario.
- Patrones aprendidos.
- Insights generados.
- Nudges enviados, aceptados, ignorados o pausados.
- Preferencias, tono, modo discreto, horarios y opt-ins.
- Audit log y eventos financieros.

Esta memoria no se pega completa al prompt. Se consulta cuando la pregunta lo requiere.

#### 7.11.2 Herramientas de recuperación

| Herramienta | Función |
|---|---|
| `DateResolver` | Interpreta fechas humanas: "ayer", "último viernes", "hace 4 meses", "fin de mes", "quincena". |
| `FinancialQueryEngine` | Consulta movimientos por fecha, periodo, categoría, subcategoría, cuenta, caja, persona, monto, fuente y confianza. |
| `TimelineMemory` | Reconstruye un día, semana, mes o etapa financiera del usuario. |
| `SemanticMemorySearch` | Busca por significado: "lo de la laptop", "cuando fui al médico", "ese gasto grande", "mi etapa de delivery". |
| `PatternMemory` | Recupera patrones aprendidos: días de más gasto, comercios frecuentes, categorías crecientes, hábitos por horario. |
| `NarrativeMemory` | Recupera contexto de vida financiera confirmado o inferido con alta confianza. |
| `ExplanationEngine` | Convierte consultas, agregados y reglas en una explicación clara y verificable para el usuario. |

Estas herramientas son read-only para los agentes conversacionales. Si una consulta deriva en una acción, el Orquestador debe crear un nuevo plan de ejecución y pasar por Core.

#### 7.11.3 Flujo de consulta inteligente

```text
Usuario pregunta algo histórico o complejo
  -> Orquestador detecta query_finances
  -> ContextPackBuilder crea ConversationContextPack mínimo
  -> ConversationAgent decide qué herramientas necesita
  -> DateResolver normaliza fechas si aplica
  -> FinancialQueryEngine / TimelineMemory / SemanticSearch recuperan datos
  -> Motores determinísticos calculan agregados si hace falta
  -> ConversationAgent razona sobre resultados, no sobre historial crudo
  -> ExplanationEngine aporta fuente y trazabilidad
  -> ResponseAgent o ConversationAgent responde
```

Ejemplo:

```text
Usuario: "¿Qué gastos hice el último viernes de hace 4 meses?"

DateResolver:
  - Interpreta la fecha exacta o detecta ambigüedad.

FinancialQueryEngine:
  - Busca movimientos confirmados de ese día.

ConversationAgent:
  - Responde con fecha interpretada, lista de gastos, total y fuente.
```

Si la fecha es ambigua:

```text
"¿Te refieres al último viernes de enero o al viernes más cercano a hace 4 meses?"
```

#### 7.11.4 Tipos de preguntas que debe soportar

La memoria consultable debe permitir preguntas como:

- "¿Qué gasté el último viernes de enero?"
- "¿Cuándo fue la última vez que pagué Netflix?"
- "¿Cuánto le debo todavía a Luis?"
- "¿Cuánto gasté en café desde que empecé a trabajar presencial?"
- "¿Qué gastos hice el día que fui al médico?"
- "¿Por qué este mes siento que se me va más plata?"
- "¿Qué cambió entre este mes y el anterior?"
- "¿Cuánto gasté en taxis los viernes por la noche?"
- "¿Cuáles fueron mis gastos raros este mes?"
- "¿Qué pagos recurrentes aparecieron últimamente?"

#### 7.11.5 Niveles de memoria

| Nivel | Qué contiene | Uso |
|---|---|---|
| Memoria estructurada | Movimientos, deudas, cajas, cuentas, recurrentes, personas, eventos | Fuente factual. |
| Memoria agregada | Totales por periodo, categoría, cuenta, día, comercio, persona | Respuestas rápidas y comparativas. |
| Memoria semántica | Descripciones, notas, etiquetas, eventos y embeddings | Búsqueda humana y flexible. |
| Memoria narrativa | Hechos de vida financiera: trabajo, viajes, metas, cambios, contexto personal | Respuestas con más sentido humano. |
| Memoria de patrones | Hábitos, correcciones repetidas, anomalías y tendencias | Insights y personalización. |
| Memoria conversacional activa | Estado actual, última respuesta, flujo pendiente | Continuidad de conversación. |

#### 7.11.6 Reglas de calidad

- El agente debe mostrar la fecha o periodo interpretado cuando la consulta sea temporal.
- Si recupera movimientos, debe distinguir confirmados, pendientes y corregidos.
- Si compara periodos, debe indicar los periodos exactos comparados.
- Si no hay datos suficientes, debe decirlo y explicar qué falta.
- Si usa búsqueda semántica, debe aclarar cuando el resultado es probable y no exacto.
- Si hay ambigüedad de fecha, persona o evento, debe preguntar antes de responder con falsa precisión.
- Si el usuario pide detalle sensible por un canal proactivo, debe respetar modo discreto.
- La memoria conversacional activa mantiene un `working_set` temporal con referencias, último objetivo, última respuesta, acción pendiente y cambio de tema; no equivale a autorización para escribir.
- El `LearningEngine` solo consolida aliases, personas o patrones cuando existe corrección confirmada y evidencia trazable. Una inferencia del modelo o una conversación aislada no se convierte en memoria estable.
- La memoria aprendida debe poder desactivarse, corregirse y auditarse; los agentes la consultan mediante tools read-only.

#### 7.11.7 Contrato de respuesta

Para consultas históricas o de memoria, la respuesta debe incluir cuando aplique:

- Interpretación de la pregunta.
- Fecha o periodo exacto usado.
- Resultados principales.
- Total o comparación si corresponde.
- Fuente: WhatsApp, Email confirmado, Dashboard/manual o recurrente.
- Nota de incertidumbre si hay ambigüedad.

Ejemplo:

```text
Tomé "último viernes de hace 4 meses" como el viernes 30 de enero de 2026.
Ese día registraste 4 gastos:
- Café S/8
- Taxi S/15
- Almuerzo S/22
- Yape a Luis S/40

Total: S/85.
```

---

## 8. Tipos y schemas principales

Los schemas de IA deben ser simples, validables y orientados a acciones. No deben guardar chain-of-thought crudo. La explicación al usuario se construye con evidencia y resúmenes seguros.

### 8.1 Tipos canónicos de movimiento

```typescript
export const MovementTypeSchema = z.enum([
  "gasto",
  "ingreso",
  "transferencia",
  "asignacion_interna",
  "deuda_adquirida",
  "pago_deuda",
  "prestamo_dado",
  "prestamo_recibido",
  "devolucion_recibida",
  "pago_recurrente",
  "ajuste",
]);
```

### 8.2 Intenciones

```typescript
export const IntentTypeSchema = z.enum([
  "record_movement",
  "record_multiple_movements",
  "correct_movement",
  "delete_movement",
  "undo",
  "query_finances",
  "create_debt",
  "update_debt",
  "create_recurring",
  "update_recurring",
  "create_account",
  "update_account",
  "create_box",
  "assign_to_box",
  "configure_goal_or_limit",
  "confirm_pending",
  "reject_pending",
  "pause_nudges",
  "resume_nudges",
  "smalltalk",
  "unknown",
]);
```

### 8.3 Propuesta de acción

```typescript
export const MoneySchema = z.object({
  amount: z.number().positive().nullable(),
  currency: z.enum(["PEN", "USD"]).default("PEN"),
  source_text: z.string().nullable(),
});

export const ConfidenceSchema = z.object({
  llm_confidence: z.number().min(0).max(1),
  rule_confidence: z.number().min(0).max(1),
  final_confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()).max(5),
});

export const BaseCategorySchema = z.enum([
  "alimentacion",
  "transporte",
  "vivienda_hogar",
  "servicios_suscripciones",
  "salud",
  "educacion",
  "ocio_salidas",
  "compras_personales",
  "familia_apoyo",
  "deudas",
  "trabajo_productividad",
  "otros",
]);

export const ClassificationStatusSchema = z.enum([
  "confirmed",
  "suggested",
  "needs_review",
  "corrected",
]);

export const EvidenceSchema = z.object({
  matched_amount_text: z.string().nullable(),
  matched_date_text: z.string().nullable(),
  matched_account_text: z.string().nullable(),
  matched_person_text: z.string().nullable(),
  explanation_summary: z.string().max(280),
});

export const ProposedActionSchema = z.object({
  action_type: z.enum([
    "create_movement",
    "update_movement",
    "delete_movement",
    "create_pending",
    "answer_query",
    "ask_clarification",
    "no_action",
  ]),
  movement_type: MovementTypeSchema.nullable(),
  money: MoneySchema,
  description: z.string().max(80).nullable(),
  category_id: BaseCategorySchema.nullable(),
  subcategory_id: z.string().nullable(),
  tags: z.array(z.string()).default([]),
  classification_status: ClassificationStatusSchema,
  classification_confidence: z.number().min(0).max(1).nullable(),
  account_from: z.string().nullable(),
  account_to: z.string().nullable(),
  box_from: z.string().nullable(),
  box_to: z.string().nullable(),
  related_person: z.string().nullable(),
  occurred_at: z.string().nullable(),
  pending_source_id: z.string().nullable(),
  requires_confirmation: z.boolean(),
  confirmation_reason: z.string().nullable(),
  ambiguities: z.array(z.string()).default([]),
  evidence: EvidenceSchema,
  confidence: ConfidenceSchema,
});
```

### 8.4 Output de agente

```typescript
export const AgentDecisionSchema = z.object({
  intent: IntentTypeSchema,
  proposed_actions: z.array(ProposedActionSchema),
  user_message_hint: z.string().nullable(),
  handoff: z.enum([
    "core",
    "conversation_agent",
    "correction_agent",
    "response_agent",
    "pending_inbox",
    "risk_policy",
    "none",
  ]),
  requires_user_reply: z.boolean(),
});
```

### 8.5 Reglas de schema

- No usar campos `razonamiento` ni chain-of-thought crudo.
- No pedir al LLM cálculos de saldo final.
- No permitir categorías base fuera de las 12 definidas.
- No usar `otros` cuando la categoría es desconocida; usar `category_id: null` + `classification_status: "needs_review"`.
- No aceptar montos si no hay evidencia en mensaje, email parseado o estado activo.
- No permitir acciones de escritura sin pasar por Core.
- No usar `.transform()` para campos que debe producir el LLM.
- Las validaciones complejas ocurren después del output estructurado.

---

## 9. Categorías, etiquetas y jerga

### 9.1 Categorías base

Las categorías base vienen de `05f_categorias.md`:

- `alimentacion`
- `transporte`
- `vivienda_hogar`
- `servicios_suscripciones`
- `salud`
- `educacion`
- `ocio_salidas`
- `compras_personales`
- `familia_apoyo`
- `deudas`
- `trabajo_productividad`
- `otros`

Las subcategorías son orgánicas y pueden crecer por usuario: `cafe`, `delivery`, `taxi`, `uber`, `menú`, `farmacia`, `netflix`, etc.

Regla clave:

- `otros` significa que el movimiento es claro, pero no encaja bien en las 12 categorías.
- `sin clasificar` se representa como `category_id: null` y `classification_status: "needs_review"`.
- El detalle completo vive en `05f_categorias.md`.

### 9.2 Etiquetas contextuales

Etiquetas inferibles:

- `necesario`
- `gusto`
- `impulso`
- `recurrente`
- `social`
- `trabajo`
- `estres`
- `fin_de_semana`

Las etiquetas ayudan a insights y conversación, pero no deben bloquear el registro si hay confianza suficiente en el movimiento.

### 9.3 Jerga peruana inicial

| Expresión | Interpretación |
|---|---|
| "me yapearon" | Ingreso o devolución por Yape, según contexto. |
| "yapeé" | Pago o transferencia saliente. |
| "me bajaron" | Me cobraron. |
| "me comí 20 en..." | Gasto. |
| "una luca" | S/1,000 si el contexto lo confirma. |
| "un coco" | S/100 si el contexto lo confirma. |
| "mi viejo / mi viejita" | Persona relacionada: papá/mamá. |
| "la flaca / el flaco" | Persona relacionada: pareja. |
| "saqué del cajero" | Transferencia de banco a efectivo. |
| "recargué Yape" | Transferencia desde banco a Yape. |
| "puse plata al chancho" | Asignación interna o caja de ahorro. |

La jerga personalizada se aprende por usuario mediante correcciones confirmadas.

---

## 10. Prompts del sistema

### 10.1 No hay un solo system prompt global

Cada agente recibe su propio system prompt compuesto por:

1. Identidad base de Manzana.
2. Rol del agente.
3. Reglas de seguridad.
4. Context Pack específico.
5. Herramientas permitidas.
6. Formato de salida.

El system prompt se envía en cada invocación del agente. No debe usarse como memoria permanente.

### 10.2 Identidad base de Manzana

```markdown
# PERSONA: Manzana

## Identidad
- Eres Manzana, asistente financiero personal para el mercado peruano.
- Ayudas al usuario a entender cómo vive su dinero.
- Eres acompañante, no contador, banco ni juez.

## Tono
- Te adaptas al estilo del usuario.
- Si el usuario es breve, respondes breve.
- Si el usuario pide explicación, explicas con datos.
- Usas emojis con moderación.

## Reglas inquebrantables
- Nunca juzgas gastos.
- Nunca inventas montos, cuentas, personas ni fechas.
- Nunca das consejos de inversión, bancos, tasas, impuestos o productos financieros.
- Si te corrigen, aceptas y corriges.
- Si no entiendes, preguntas una vez con claridad.
- Si una acción afecta dinero real y hay duda, pides confirmación.
```

### 10.3 Prompt base por agente

| Agente | Instrucción clave |
|---|---|
| `DataAgent` | "Extrae acciones financieras estructuradas. No expliques. No escribas. No inventes." |
| `ConversationAgent` | "Responde con datos reales y herramientas read-only. No ejecutes mutaciones." |
| `CorrectionAgent` | "Resuelve qué quiere corregir el usuario y qué movimiento candidato aplica." |
| `ResponseAgent` | "Redacta la respuesta final respetando tono, modo discreto y hechos dados." |
| `InsightExperienceAgent` | "Elige el framing y timing más humano para un insight ya validado, sin calcular dinero." |
| `InsightNarratorAgent` | "Convierte resultados analíticos en un mensaje útil, breve y no juzgador." |

---

## 11. Flujos principales

### 11.1 Registro simple por WhatsApp

```text
Usuario: "Gasté 8 en café"

1. WhatsApp Adapter recibe mensaje.
2. Orquestador detecta intención probable: record_movement.
3. ContextPackBuilder crea DataContextPack.
4. DataAgent devuelve ProposedAction: gasto, S/8, alimentación/café.
5. Validadores revisan monto, categoría, fecha, cuenta y confianza.
6. Core crea movimiento si supera umbral.
7. Core escribe `movimiento_creado` en `transactional_outbox`.
8. Outbox Worker publica al Internal Domain Event Bus.
9. Balance Engine recalcula.
10. Response template o ResponseAgent responde.
```

Respuesta esperada:

```text
Listo. Café S/8 · Alimentación
```

### 11.2 Registro múltiple

```text
Usuario: "Hoy gasté 8 café, 15 taxi y 20 almuerzo"

1. DataAgent devuelve 3 ProposedActions.
2. Dedup Engine verifica duplicados recientes.
3. Core crea 3 movimientos en una transacción lógica.
4. Core escribe eventos en `transactional_outbox`.
5. Outbox Worker publica al Internal Domain Event Bus.
6. Balance Engine recalcula.
7. Respuesta compacta:
```

```text
Listo. Registré 3 gastos:
- Café S/8
- Taxi S/15
- Almuerzo S/20
```

### 11.3 Registro + conversación en el mismo mensaje

```text
Usuario: "Gasté 20 en almuerzo, ¿cómo va mi presupuesto?"

1. DataAgent interpreta y propone el gasto.
2. Core registra o confirma según confianza.
3. Core escribe evento en `transactional_outbox` si hubo escritura.
4. ContextPackBuilder construye ConversationContextPack con el dato recién creado.
5. ConversationAgent responde la pregunta usando saldos, cajas y agregados.
```

El `ConversationAgent` solo se invoca después de que el dato haya sido validado o quede claro que está pendiente.

### 11.4 Corrección

```text
Usuario: "Eso no fue taxi, fue Uber de trabajo"

1. Orquestador usa estado y movimientos recientes.
2. CorrectionContextPack incluye candidatos.
3. CorrectionAgent propone editar categoría/subcategoría/etiqueta.
4. Core aplica si hay un candidato claro.
5. Learning Engine guarda preferencia.
6. Core escribe `movimiento_corregido` en `transactional_outbox`.
7. Outbox Worker publica al Internal Domain Event Bus.
```

Respuesta esperada:

```text
Corregido. Lo dejé como Uber de trabajo.
```

### 11.5 Email detectado

```text
1. Gmail Push o proveedor futuro detecta email financiero.
2. Email Adapter extrae datos mínimos.
3. DataAgent normaliza tipo, monto, comercio, cuenta y categoría.
4. Dedup Engine compara con movimientos recientes.
5. Pending Inbox crea pendiente.
6. WhatsApp pide confirmación.
```

Regla V1:

> Ningún email se registra automáticamente. Siempre pasa por confirmación del usuario.

Ejemplo:

```text
Detecté un movimiento de Yape por S/45 en Restaurante. ¿Lo registro?
```

Modo discreto:

```text
Detecté un movimiento nuevo. Escribe "ver" para revisarlo.
```

### 11.6 Consulta financiera

```text
Usuario: "¿Puedo gastar S/50 hoy?"

1. Orquestador detecta query_finances.
2. ContextPackBuilder crea ConversationContextPack.
3. Balance Engine calcula dinero libre.
4. Debt/Recurring Engines aportan compromisos próximos.
5. ConversationAgent responde usando solo datos reales.
```

Respuesta esperada:

```text
Sí, pero ajustado. Tienes S/82 libres después de separar tus compromisos próximos. Si gastas S/50, te quedarían S/32 hasta tu siguiente ingreso registrado.
```

Si no hay datos suficientes:

```text
Aún no tengo suficiente información para decirlo con seguridad. Sí veo tus últimos gastos, pero me falta saber tus compromisos o cajas.
```

### 11.7 Deudas

Ejemplos:

- "Le debo 80 a Luis."
- "Me prestaron 300."
- "Pagué 50 de la tarjeta."
- "Ana me devolvió 40."

Flujo:

```text
DataAgent propone tipo financiero.
Debt Engine valida relación deuda/persona/cuota.
Core crea o actualiza entidad financiera.
Internal Domain Event Bus dispara recalculo de progreso.
ResponseAgent o plantilla confirma.
```

### 11.8 Recurrentes

La detección de recurrentes no depende de que el LLM recuerde patrones. El `Recurring Engine` detecta:

- Mismo comercio.
- Tres meses o más.
- Monto aproximado.
- Fecha aproximada.

El agente solo interviene para explicar o confirmar:

```text
He visto Netflix cerca de esta fecha por 3 meses. ¿Quieres marcarlo como pago recurrente?
```

### 11.9 Nudges

Los nudges se deciden por `Nudge Policy Engine`, no por un agente libre.

Antes de enviar:

- Verificar opt-in.
- Verificar horario silencioso.
- Verificar máximo diario.
- Verificar si el usuario ya registró suficiente hoy.
- Aplicar modo discreto.

El `ResponseAgent` puede redactar, pero no decide enviar.

### 11.10 Metas y límites

No existe todavía un documento propio definitivo de metas/límites. Por eso, en V1 del motor se deja como hook:

```text
movimiento_creado
  -> BudgetGoalReactor si el usuario tiene una meta/límite configurado
  -> evalúa cercanía o exceso
  -> Nudge Policy decide si corresponde avisar
  -> ResponseAgent o plantilla redacta
```

Ejemplo solo si el dominio ya tiene configurado un límite:

```text
Vas cerca de tu límite semanal de café. Te quedan S/6 para esta semana.
```

Sin meta configurada, el motor no inventa límites.

---

## 12. Confianza, confirmación y riesgo

### 12.1 Umbrales base

| Confianza final | Acción |
|---|---|
| `>= 0.95` | Ejecutar si no hay riesgo especial. |
| `0.85 - 0.94` | Ejecutar con confirmación sutil o marcar baja confianza. |
| `0.70 - 0.84` | Preguntar antes de registrar. |
| `< 0.70` | No registrar; pedir aclaración. |

La confianza final combina:

- Confianza del agente.
- Evidencia textual.
- Validaciones determinísticas.
- Historial de correcciones del usuario.
- Riesgo de la acción.
- Estado conversacional.

### 12.2 Acciones de riesgo

Requieren confirmación explícita:

- Borrar movimientos antiguos.
- Deshacer operaciones fuera de ventana segura.
- Registrar montos inusuales.
- Cambiar deuda importante.
- Confirmar múltiples pendientes.
- Crear reglas recurrentes automáticas.
- Activar nudges proactivos.

### 12.3 Confirmaciones

Una confirmación debe decir claramente qué se hará.

Bien:

```text
¿Confirmas borrar el gasto de Taxi S/18 del 14 de mayo?
```

Mal:

```text
¿Seguro?
```

### 12.4 Política transversal de privacidad y modo discreto

El modo discreto no es una regla exclusiva de WhatsApp. Es una política transversal que debe aplicar a cualquier salida del sistema cuando pueda exponer información financiera sensible.

Tesis:

> Si Manzana inicia el contacto o muestra información fuera de una sesión autenticada, y el usuario tiene modo discreto activo, la respuesta no debe exponer montos, comercios, bancos, personas, saldos, deudas ni detalles financieros sensibles.

#### 12.4.1 Cuándo se activa

El modo discreto se activa por preferencia explícita del usuario:

```text
Usuario: "activa modo discreto"
Sistema: guarda privacy.discreet_mode = true
```

También debe poder desactivarse de forma simple:

```text
Usuario: "modo normal"
Sistema: guarda privacy.discreet_mode = false
```

La preferencia vive en Core/Supabase como parte del perfil del usuario. No vive dentro del agente.

#### 12.4.2 Regla de decisión

`PolicyGate` debe evaluar modo discreto antes de enviar cualquier respuesta externa:

```text
if user.privacy.discreet_mode == true
and output.channel in ["whatsapp", "push", "email_notification"]
and output.initiated_by_system == true
then redact_sensitive_details(output)
```

Para V1, la regla aplica especialmente a:

- nudges;
- recordatorios de deudas;
- pagos recurrentes próximos;
- emails detectados;
- insights proactivos;
- alertas de riesgo;
- avisos de metas/límites si el hook existe;
- cualquier notificación futura fuera del Dashboard autenticado.

#### 12.4.3 Datos que se ocultan

| Tipo de dato | Modo normal | Modo discreto |
|---|---|---|
| Montos | "S/180" | "un pago" / "un movimiento" |
| Comercios | "Netflix", "Restaurante X" | "un comercio" / no mostrar |
| Bancos/cuentas | "BCP", "Tarjeta Visa" | "una cuenta" / "un método de pago" |
| Personas | "Ana", "Luis" | "una persona" |
| Deudas | "cuota de tarjeta S/180" | "un pago importante" |
| Saldos | "te quedan S/64" | "tu saldo disponible cambió" |
| Categorías sensibles | salud, deuda, apuestas, etc. | no mostrar categoría en proactivos |

#### 12.4.4 Comportamiento por canal

| Canal | Modo discreto |
|---|---|
| WhatsApp proactivo | Oculta datos sensibles y pide "ver" para detalle. |
| WhatsApp iniciado por usuario | Puede responder con detalle porque el usuario preguntó. |
| Dashboard autenticado | Puede mostrar detalle completo. |
| Preview/notificación del Dashboard | Oculta datos sensibles. |
| Email parsing | Nunca muestra monto/comercio en aviso proactivo; manda a pendientes. |
| Event Bus interno | No cambia datos internos; solo afecta la salida al usuario. |

#### 12.4.5 Ejemplos

Modo normal:

```text
Tu cuota de tarjeta BCP por S/180 vence mañana.
```

Modo discreto:

```text
Tienes un pago importante que vence mañana. Escribe "ver pago" para detalles.
```

Modo normal:

```text
Detecté Yape S/45 en Restaurante. ¿Lo registro?
```

Modo discreto:

```text
Detecté un movimiento nuevo. Escribe "ver" para revisarlo.
```

Consulta iniciada por el usuario:

```text
Usuario: "¿cuánto debo pagar mañana?"
Sistema: "Mañana vence tu cuota de tarjeta BCP por S/180."
```

En este caso se permite detalle porque el usuario pidió explícitamente la información.

#### 12.4.6 Invariantes

- El modo discreto no debe cambiar cálculos, saldos ni registros.
- No debe impedir que el usuario consulte su información.
- No debe esconder datos dentro del Dashboard autenticado.
- No debe permitir auto-registro desde email.
- No debe reemplazar el horario silencioso; ambos se evalúan.
- No debe registrar razonamiento sensible en trazas.
- Las respuestas redactadas deben conservar utilidad sin exponer detalle.

#### 12.4.7 Relación con agentes

`ResponseAgent` puede redactar variantes discretas, pero no decide si aplicar modo discreto. La decisión corresponde a `PolicyGate`.

El agente recibe una instrucción de salida:

```json
{
  "privacy_mode": "discreet",
  "allowed_detail_level": "generic",
  "must_hide": ["amounts", "merchants", "banks", "people", "balances", "debts"]
}
```

Si una respuesta generada viola la política, `PolicyGate` post-execution debe bloquearla o pedir re-redacción.

---

## 13. Guardrails financieros

| Guardrail | Qué previene | Capa |
|---|---|---|
| Evidencia de monto | Que el agente invente dinero | Post-LLM |
| Monto inusual | Café de S/5,000 o deuda accidental | Risk Policy |
| Categoría válida | Categorías base inventadas | Schema/Post-LLM |
| Cuenta válida | Usar cuentas inexistentes | Core |
| Persona explícita | Inventar personas relacionadas | Post-LLM |
| Fecha válida | Registrar futuro como gasto normal | Core |
| Duplicados | WhatsApp + email del mismo movimiento | Dedup Engine |
| Email pendiente | Auto-registro desde email | Pending Inbox |
| Modo discreto | Exponer montos en proactivos | Response/Risk |
| Opt-in nudges | Mensajes no consentidos | Nudge Policy |
| Herramientas read-only | Conversación mutando datos | AgentRuntime |
| PII en trazas | Filtrar información sensible | Observabilidad |

Regla de oro:

> Si el agente infiere algo que no está en el mensaje, el email parseado, el estado activo o el Context Pack, debe pedir aclaración o dejarlo como `null`.

---

## 14. Observabilidad y evaluación

### 14.1 Qué se traza

Cada ejecución debe registrar:

- `trace_id`
- `user_id` pseudonimizado o interno
- canal
- intención
- agentes invocados
- motores invocados
- Context Pack usado
- runtime provider (`codex` o `api`)
- modelo/sesión si aplica
- latencia
- costo estimado si aplica
- confianza final
- guardrails activados
- resultado: ejecutado, pendiente, aclaración, error

No se envía a observabilidad externa:

- Mensaje completo del usuario.
- Nombres reales.
- Montos exactos.
- Raw emails.
- Chain-of-thought.

Los datos sensibles pueden mantenerse en la base de la app o audit log interno con controles de acceso, retención y propósito claro.

### 14.2 Métricas por agente

| Métrica | Objetivo inicial |
|---|---|
| Accuracy de tipo de movimiento | `>= 95%` después de correcciones confirmadas. |
| Accuracy de monto | `>= 99%`. |
| Correcciones por usuario/semana | Debe bajar con aprendizaje. |
| Porcentaje de mensajes con aclaración | Medir por categoría e intención. |
| Agentes invocados por mensaje | Mantener bajo; detectar sobre-orquestación. |
| Latencia p50/p95 | Medir por agente y canal. |
| Costo por acción | Medir aunque el runtime actual sea Codex. |
| Tasa de auto-resolución | Registros completados sin ida y vuelta. |
| Next best actions aceptadas | Medir por tipo de sugerencia. |
| Clarificaciones resueltas en un mensaje | `>= 80%` en casos de bajo/medio riesgo. |
| Insights con acción tomada | Medir aceptación, rechazo e ignorados. |
| Reviews diarios/semanales útiles | Feedback o acción posterior. |
| Explicaciones de confianza exitosas | Usuario no vuelve a preguntar lo mismo o corrige. |
| Personalización percibida | Medir por retención y feedback cualitativo. |

### 14.3 Evaluación continua

Dataset mínimo de pruebas:

- 200 mensajes reales o sintéticos validados.
- Casos de jerga peruana.
- Correcciones.
- Deudas informales.
- Recurrentes.
- Cuentas y cajas.
- Emails.
- Modo discreto.
- Multi-movimiento.
- Ambigüedad préstamo vs regalo.

En cada cambio de prompt, schema o agente:

- Ejecutar evaluación.
- Comparar contra baseline.
- Bloquear cambios si degradan tipo, monto o seguridad.
- Revisar manualmente casos de dinero sensible.
- Mantener un corpus versionado de al menos 200 mensajes, agrupado por familias semánticas y no por frases exactas.
- Separar dos gates: el fallback determinístico se evalúa por seguridad y ausencia de silencios; el runtime semántico real se evalúa por intención, workflow, continuidad y tool selection.
- Ejecutar una muestra estratificada contra el proveedor API antes de desplegar cambios centrales de planificación o conversación.
- Toda corrección propuesta por el planificador debe compilarse con confirmación obligatoria aunque el modelo omita esa bandera.

---

## 15. Costos y routing inteligente

### 15.1 Principio

Más agentes no siempre significa mejor servicio. Puede significar:

- Más latencia.
- Más costo.
- Más puntos de falla.
- Más riesgo de respuestas inconsistentes.

Por eso el Orquestador debe medir y decidir.

### 15.2 Política Codex-first

Durante la etapa actual:

- Codex puede ejecutar todos los agentes.
- Se deben conservar métricas de uso como si cada agente tuviera costo unitario.
- No se debe documentar el motor como "gratis" o "$0 marginal" para producción.
- Las cuotas, límites y latencia del runtime deben observarse.

### 15.3 Política API-ready

Cuando se agregue API:

- `DataAgent` debería ser el primer candidato por volumen.
- `CorrectionAgent` debería migrar si mantiene accuracy.
- `ResponseAgent` puede migrar para respuestas simples no cubiertas por plantillas.
- `ConversationAgent` puede quedarse en Codex o usar modelo más fuerte según calidad.

### 15.4 Decisión por tipo de tarea

| Tarea | Runtime inicial | Runtime futuro probable |
|---|---|---|
| Registro simple | Codex/DataAgent | API barata con structured output |
| Corrección simple | Codex/CorrectionAgent | API barata |
| Respuesta simple | Plantilla | Plantilla |
| Respuesta compleja | Codex/ResponseAgent | API barata o Codex |
| Conversación profunda | Codex/ConversationAgent | Codex o modelo fuerte |
| Experiencia de insight | Codex/InsightExperienceAgent selectivo | API barata o modelo medio si mejora conversión |
| Insight narrado | Codex/InsightNarratorAgent | API barata si es batch |
| Cálculo de saldo | Motor determinístico | Motor determinístico |
| Nudge policy | Motor determinístico | Motor determinístico |

---

## 16. Contratos con otros sistemas

### 16.1 WhatsApp

El motor recibe:

```typescript
{
  user_id: string;
  channel: "whatsapp";
  text: string;
  timestamp: string;
  conversation_state: ConversationState;
}
```

Debe respetar:

- Respuesta rápida.
- Una sola pregunta de aclaración cuando sea posible.
- Cancelación global.
- Edición, borrado y deshacer.
- Modo discreto.
- Opt-in granular de nudges.

### 16.2 Email Parsing

El motor recibe datos parseados, no debe depender de raw email completo para operar.

```typescript
{
  user_id: string;
  channel: "email";
  email_event_id: string;
  provider: "gmail" | "outlook" | "other";
  parsed: {
    amount: number | null;
    currency: "PEN" | "USD" | null;
    merchant: string | null;
    bank_or_app: string | null;
    occurred_at: string | null;
    direction: "in" | "out" | "unknown";
  };
}
```

Contrato:

- Crear pendiente.
- Pedir confirmación por WhatsApp.
- No registrar automáticamente.
- No almacenar email completo salvo política explícita de auditoría interna.

### 16.3 Dashboard

El Dashboard no necesita IA para registros o ediciones manuales estructuradas.

Usa IA para:

- Explicar movimientos.
- Consultas naturales.
- Resumir insights.
- Ayudar a corregir o buscar historial en lenguaje natural.

Las ediciones y registros manuales deben ir directo al Core.

#### 16.3.1 Registro manual desde Dashboard

Cuando el usuario crea un movimiento desde Dashboard, el flujo debe tratarse como una acción estructurada, no como conversación:

```text
Dashboard submit
  -> PolicyGate / validadores de entrada
  -> Dedup Engine si hay señales de duplicado
  -> CommandDispatcher
  -> Core Financiero
  -> audit_log + transactional_outbox
  -> Internal Domain Event Bus
  -> Dashboard refresca saldos, historial e insights afectados
```

Reglas:

- No invocar `DataAgent` si el formulario ya entrega campos estructurados.
- No permitir crear movimientos desde búsqueda natural; la búsqueda es read-only.
- Fuente del movimiento: `Dashboard/manual`.
- Confianza inicial: `manual_confirmed`, salvo que el usuario deje campos dudosos.
- Si el tipo requiere dominio específico, enrutar al motor determinístico correspondiente:
  - `pago_deuda` -> `Debt Engine`;
  - `pago_recurrente` -> `Recurring Engine`;
  - `transferencia` / `asignacion_interna` -> `Balance Engine`;
  - `prestamo_dado`, `prestamo_recibido`, `devolucion_recibida` -> `Debt Engine` / personas relacionadas.
- Si el monto, fecha, cuenta o tipo implican riesgo, `PolicyGate` debe exigir confirmación.

El LLM solo puede intervenir como ayuda opcional para sugerir categoría, etiqueta o explicación. La escritura financiera sigue siendo determinística.

### 16.4 Eventos externos de entrada

Los eventos externos de entrada son señales que llegan desde fuera del dominio financiero interno. Pueden activar al Orquestador.

Ejemplos:

- Mensaje de WhatsApp.
- Webhook de email/Gmail Push.
- Acción manual desde Dashboard.
- Tick del Scheduler.
- Webhook externo permitido.

Reglas:

- Se normalizan mediante `IntakeRouter`.
- Deben tener `external_event_id` o `idempotency_key`.
- No se republican directamente al Internal Domain Event Bus.
- Si generan una escritura financiera, pasan por Core y `transactional_outbox`.

### 16.5 Internal Domain Event Bus

Los eventos internos de dominio representan hechos ya confirmados o persistidos por el sistema. No son lo mismo que eventos externos de entrada.

Regla:

> El Internal Domain Event Bus publica eventos desde `transactional_outbox`, no desde agentes ni adaptadores.

Eventos internos relevantes:

- `movimiento_creado`
- `movimiento_confirmado`
- `movimiento_corregido`
- `movimiento_eliminado`
- `email_parseado`
- `pendiente_creado`
- `pendientes_acumulados`
- `patron_detectado`
- `recurrente_detectado`
- `cuota_proxima`
- `recurring_candidate_detected`
- `recurring_candidate_suggested`
- `recurring_confirmed`
- `recurring_updated`
- `recurring_paused`
- `recurring_cancelled`
- `recurring_occurrence_created`
- `recurring_occurrence_due_soon`
- `recurring_occurrence_overdue`
- `recurring_payment_pending_confirmation`
- `recurring_payment_confirmed`
- `recurring_amount_changed`
- `recurring_linked_to_box`
- `recurring_linked_to_debt`
- `recurring_skipped`
- `usuario_inactivo`
- `caja_creada`
- `debt_created`
- `debt_payment_recorded`
- `debt_repayment_received`
- `debt_closed`
- `debt_due_soon`
- `debt_overdue`
- `deuda_actualizada`
- `related_person_created`
- `related_person_merged`
- `insight_generado`
- `insight_updated`
- `insight_outdated`
- `insight_delivery_recorded`
- `insight_seen`
- `nudge_enviado`
- `nudge_candidate_created`
- `nudge_policy_approved`
- `nudge_policy_rejected`
- `nudge_deferred`
- `nudge_scheduled`
- `nudge_sent`
- `nudge_delivered`
- `nudge_responded`
- `nudge_acted`
- `nudge_dismissed`
- `nudge_expired`
- `nudge_paused`
- `nudge_resumed`
- `nudge_preferences_updated`
- `nudge_quiet_hours_hit`
- `nudge_rate_limited`
- `nudge_dashboard_only`
- `agent_run_started`
- `agent_run_completed`
- `context_pack_built`
- `guardrail_triggered`
- `experience_mode_detected`
- `narrative_memory_updated`
- `change_detected`
- `clarification_strategy_selected`
- `next_best_action_suggested`
- `daily_review_generated`
- `weekly_review_generated`
- `trust_explanation_requested`
- `trust_explanation_delivered`

### 16.6 Contrato mínimo de evento interno

```typescript
export interface DomainEvent {
  event_id: string;
  event_type: string;
  event_version: number;
  user_id: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: unknown;
  source: "core" | "domain_engine" | "scheduler" | "orchestrator";
  correlation_id: string;
  causation_id: string | null;
  idempotency_key: string;
  created_at: string;
}
```

Reglas anti-loop:

- Todo consumidor debe registrar `event_id` procesado.
- Todo evento derivado debe conservar `correlation_id`.
- Todo evento derivado debe apuntar a su `causation_id`.
- El Orquestador no debe re-procesar eventos que él mismo causó salvo que el workflow lo permita explícitamente.
- Los eventos internos no deben entrar por `IntakeRouter` como si fueran mensajes de usuario.
- Los procesos async deben ser idempotentes.

---

## 17. Manejo de errores y modo degradado

| Error | Respuesta del sistema |
|---|---|
| Runtime de agente no disponible | Guardar mensaje y reintentar; avisar al usuario si impacta. |
| Output inválido | Reintentar una vez con prompt/schema estricto. |
| Confianza baja | Preguntar aclaración. |
| Core rechaza acción | Responder con motivo simple y no registrar. |
| Email incompleto | Crear pendiente con datos parciales o descartar si no hay monto/comercio útil. |
| Duplicado probable | Preguntar o marcar como posible duplicado. |
| Latencia alta | Respuesta de espera y procesamiento asíncrono. |
| Costo/cuota excedida | Degradar a plantillas, cola o runtime alternativo. |

Modo degradado:

```text
1. Guardar entrada en cola segura.
2. Responder: "Recibí tu mensaje. Lo proceso en unos minutos."
3. Reintentar cuando el runtime vuelva.
4. Procesar en orden.
5. Notificar resultado.
```

Para consultas que no pueden esperar:

```text
Ahora no puedo calcularlo con seguridad. Apenas vuelva a procesar, te aviso.
```

---

## 18. Explicabilidad

Manzana debe poder explicar todo número que muestra.

| Pregunta | Respuesta esperada |
|---|---|
| "¿Por qué lo pusiste como transporte?" | "Porque dijiste Uber y tus Uber anteriores están en transporte." |
| "¿Cómo calculas dinero libre?" | "Primero calculo libre en cuentas: saldos menos cajas. Luego descuento compromisos próximos no cubiertos por cajas, como cuotas o recurrentes." |
| "¿De dónde salió este movimiento?" | "Vino de un email detectado y lo confirmaste por WhatsApp." |
| "¿Por qué me avisaste de esta cuota?" | "Está marcada como cuota próxima y tienes nudges de deudas activados." |
| "¿Por qué dices que delivery subió?" | "Comparé tus delivery de esta semana contra la semana pasada." |

La explicación debe usar:

- Evidencia guardada.
- Datos agregados.
- Eventos confirmados.
- Reglas del motor.

No debe mostrar:

- Chain-of-thought.
- Prompts internos.
- Datos que el usuario no autorizó ver en ese canal.

---

## 19. Escenarios de aceptación

### 19.1 Registro simple

Entrada:

```text
Gasté 8 en café.
```

Resultado:

- `DataAgent` propone un `gasto`.
- Core registra S/8 si la confianza es suficiente.
- Categoría: `alimentacion`.
- Subcategoría: `cafe`.
- No se invoca `ConversationAgent`.

### 19.2 Registro múltiple

Entrada:

```text
Hoy gasté 8 café, 15 taxi y 20 almuerzo.
```

Resultado:

- Se crean tres acciones.
- Se evita duplicado.
- Respuesta compacta.

### 19.3 Corrección de tipo

Entrada:

```text
Eso no fue gasto, fue préstamo a Luis.
```

Resultado:

- `CorrectionAgent` busca movimiento candidato.
- Core cambia a `prestamo_dado` o pregunta si hay ambigüedad.
- Learning Engine guarda patrón.

### 19.4 Devolución

Entrada:

```text
Me pagaron lo que me debía Ana.
```

Resultado:

- Si existe deuda de Ana, Debt Engine propone `devolucion_recibida`.
- Si falta monto, pregunta.

### 19.5 Pago de deuda

Entrada:

```text
Pagué la cuota de la tarjeta.
```

Resultado:

- Debt/Recurring Engine intenta vincular cuota.
- Si falta monto o hay varias tarjetas, pregunta.

### 19.6 Consulta de dinero libre

Entrada:

```text
¿Puedo gastar S/50 hoy?
```

Resultado:

- `ConversationAgent` usa herramientas read-only.
- Balance/Cajas/Deudas/Recurrentes calculan.
- Respuesta distingue dinero total vs dinero libre.

### 19.7 Micro-reconstrucción

Entrada:

```text
Creo que ayer gasté en taxi y comida pero no recuerdo cuánto.
```

Resultado:

- No inventa montos.
- Puede ayudar a reconstruir con preguntas.
- Puede crear pendientes incompletos solo si el producto lo permite.

### 19.8 Email detectado

Entrada:

```text
Email de Yape o banco detectado.
```

Resultado:

- Se crea pendiente.
- Se pide confirmación por WhatsApp.
- No se registra automáticamente.

### 19.9 Recurrente tipo Netflix

Resultado:

- Recurring Engine detecta patrón.
- Se pregunta si desea marcarlo recurrente.
- No se activa regla recurrente sin confirmación.

### 19.10 Nudge de cuota próxima

Resultado:

- Debt/Recurring Engine detecta cuota.
- Nudge Policy valida opt-in, horario y frecuencia.
- ResponseAgent o plantilla respeta modo discreto.

### 19.11 Límite/meta de café

Resultado:

- Solo se evalúa si existe una meta/límite configurado en el dominio.
- `BudgetGoalReactor` calcula cercanía o exceso.
- Nudge Policy decide si avisar.
- Sin meta configurada, el motor no inventa límites.

### 19.12 Qué cambió este mes

Entrada:

```text
¿Por qué este mes siento que se me va más plata?
```

Resultado:

- `ChangeDetectionEngine` compara periodos exactos.
- `ConversationAgent` explica los 2-4 cambios más importantes.
- La respuesta distingue aumentos normales, gastos atípicos y compromisos nuevos.
- Si hay una acción clara, `NextBestActionEngine` la propone.

### 19.13 Clarificación inteligente

Entrada:

```text
Le pasé 50 a Luis.
```

Resultado:

- `ClarificationStrategyEngine` detecta ambigüedad entre préstamo, regalo, pago de deuda o gasto compartido.
- Pregunta con opciones concretas, no con formulario genérico.
- No registra si el impacto financiero queda ambiguo.

### 19.14 Memoria narrativa

Entrada:

```text
Desde que empecé el trabajo presencial gasto más en taxis, ¿no?
```

Resultado:

- `NarrativeMemory` recupera el evento "trabajo presencial" si fue confirmado o inferido con alta confianza.
- `FinancialQueryEngine` compara antes/después.
- La respuesta explica el cambio con fechas, montos y cautela si la señal es incompleta.

### 19.15 Cierre semanal inteligente

Resultado:

- `DailyWeeklyReviewEngine` genera resumen solo con opt-in o configuración permitida.
- Incluye cambio relevante, pendientes, próximos compromisos y una acción útil.
- Respeta modo discreto.
- No se envía si no hay datos suficientes o sería repetitivo.

---

### 19.16 Estado de implementación híbrida

La implementación técnica del 19 de julio de 2026 conserva la tesis de este
documento: no convierte motores exactos en agentes libres. Cada subsistema
separa una capa semántica o experiencial de una autoridad determinística.

| Subsistema | Capa agentic | Autoridad determinística |
|---|---|---|
| Orquestación | `OrchestrationPlanningAgent` propone workflow, agentes, tools y estrategia de respuesta para intenciones simples o mixtas. | El compilador valida el plan; `PolicyGate`, `ExecutionEngine`, `CommandDispatcher` y Core deciden qué puede ejecutarse. |
| Learning | `LearningSignalAgent` propone candidato, significado y confianza a partir de evidencia confirmada. | `LearningPolicyGate` exige evidencia, limita alcance, deduplica y decide si se guarda memoria. |
| Dedup | `DedupSignalAgent` compara semánticamente solo candidatos en la zona incierta. | Prefiltro, scoring, umbrales de duplicado exacto, idempotencia y reconciliación cross-channel son determinísticos y auditables. |
| Risk | `RiskSignalAgent` puede elevar riesgo o recomendar cautela; nunca rebajarlo por sí solo. | `RiskPolicy` y `SystemActionGate` permiten, exigen confirmación o bloquean. |
| Disclosure | `DisclosureExperienceAgent` adapta el framing usando únicamente hechos ya autorizados. | `DisclosureEngine` y `OutputGuard` redaccionan por canal, modo discreto, receptor, opt-in y sensibilidad. |
| Recurrentes | `RecurringSignalAgent` mejora nombre visible, explicación y sensibilidad de un candidato detectado. | El detector calcula patrón, monto, intervalo, fechas y estado; el usuario confirma antes de activar. |
| Descubrimientos | `InsightExperienceAgent` decide framing/timing y `InsightNarratorAgent` redacta. | `InsightEngine` calcula señales, evidencia, ranking, expiración, proyección cautelosa y lifecycle. |
| Nudges | `NudgeExperienceAgent` adapta el mensaje después de la decisión de elegibilidad. | `NudgePolicy`, Risk, Disclosure, opt-in, quiet hours, frecuencia, ventana de WhatsApp y vigencia de fuente deciden si se envía, difiere o queda en Dashboard. |
| Categorías | Agentes pueden sugerir clasificación, alias o corrección. | Taxonomía base, invariantes, validación y aprendizaje confirmado permanecen determinísticos. |

Reglas de integración implementadas:

- La salida agentic siempre usa schema validado y puede caer a fallback seguro.
- Un agente no escribe Supabase, no invoca Core directamente y no cambia dinero.
- Los hechos numéricos y de identidad se bloquean antes de narración o framing.
- La capa determinística puede vetar, reducir alcance o pedir confirmación; la
  capa agentic no puede ampliar permisos.
- La ausencia o falla de un agente no desactiva deduplicación, riesgo,
  consentimiento, disclosure ni ejecución segura.
- Cada decisión relevante conserva `trace_id`, evidencia y runtime cuando
  aplica; no se almacena chain-of-thought.

Estado operativo:

- Implementado y verificado localmente en backend.
- Pendiente de aplicar/verificar migraciones nuevas, desplegar el corte y hacer
  QA operativo de Insights y nudges proactivos en staging.
- El envío proactivo de WhatsApp permanece desactivado hasta aprobar template,
  consentimiento, configuración del proveedor y prueba con el número real.

---

## 20. Métricas de éxito del motor

| Métrica | Target V1 |
|---|---|
| Accuracy de tipo de movimiento | `>= 95%` |
| Accuracy de monto | `>= 99%` |
| Registros simples sin aclaración | `>= 85%` |
| Emails registrados sin confirmación | `0%` |
| Correcciones por usuario que bajan con el tiempo | Sí |
| Respuestas con dinero libre distinguiendo cajas/compromisos | `100%` |
| Nudges enviados sin opt-in | `0%` |
| Mensajes proactivos que respetan modo discreto | `100%` |
| Agent runs trazados | `100%` |
| Chain-of-thought guardado o expuesto | `0%` |
| Agentes innecesarios por mensaje simple | Bajo y medido |
| Clarificaciones inteligentes resueltas en un turno | `>= 80%` en bajo/medio riesgo |
| Insights con acción útil asociada | `>= 70%` de insights enviados |
| Next best actions aceptadas o descartadas explícitamente | Medir por tipo |
| Reviews diarios/semanales con acción posterior | Medir como señal de utilidad |
| Explicaciones de confianza disponibles | `100%` para movimientos e insights mostrados |
| Personalización que mejora retención | Medir por cohortes y feedback |

---

## 21. Fuera de alcance del motor V1

El motor V1 no debe prometer:

- Asesoría de inversión.
- Recomendaciones de productos financieros.
- Comparación de bancos o tasas.
- Impuestos.
- Facturación.
- ERP.
- Multiusuario familiar o empresarial.
- Auto-registro de emails.
- Metas/límites avanzados sin documento propio.
- Predicciones avanzadas no sustentadas por datos suficientes.

---

## 22. Resumen final

El Motor IA V6 de Manzana queda definido como una arquitectura agentic controlada:

- `FinancialOrchestrator` decide el plan de ejecución.
- Agentes especializados entienden, conversan, corrigen y redactan.
- Motores determinísticos protegen exactitud financiera.
- Core Financiero, Domain Engines y Data Layer quedan separados para evitar duplicidad conceptual.
- Motores de calidad de experiencia convierten datos en utilidad, claridad y acompañamiento.
- Context Packs reemplazan el contexto global pesado.
- La memoria financiera y narrativa consultable permite respuestas históricas, contextuales y sorprendentes.
- `Transactional Outbox` mantiene consistentes escrituras, auditoría y eventos internos.
- Eventos externos de entrada e Internal Domain Event Bus quedan separados para evitar loops.
- Codex es el runtime inmediato.
- API queda preparada por agente para la siguiente etapa.
- Email siempre confirma.
- Los tipos de movimiento cubren V1 completo.
- Clarificación inteligente, next best action, trust layer y reviews inteligentes elevan la calidad del producto.
- No se guarda chain-of-thought crudo.
- Más agentes no es automáticamente mejor: el sistema debe usar solo los necesarios.

Esta versión está alineada con WhatsApp, Dashboard, Email Parsing, Cuentas/Cajas, Categorías, Insights, Deudas, Recurrentes, Nudges y la Arquitectura del Sistema.
