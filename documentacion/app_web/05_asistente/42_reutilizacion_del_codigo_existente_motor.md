# 42 — Qué se reutiliza del motor que ya existe

**Bloque:** 05 — Asistente
**Alcance:** V1
**Fecha:** 26 de julio de 2026
**Docs fuente:** el diseño de `20`, `20b`, `20c`, `21`, `22`, `23`, `40` y `41`, contrastado contra `src/agents/` y `src/core/conversation/`
**Documentos que dependen de este:** `52` (inventario de `src/`), `53` (deuda técnica), `54` (plan de implementación)

---

## 1. El primer documento que mira el código

Los ocho documentos del motor se escribieron **sin abrir `src/agents/` ni
`src/core/conversation/`**. Fue la decisión `WEB-D004`, y su razón era evitar
que un diseño existente se colara como restricción antes de saber qué
queríamos.

Este es el documento donde se levanta esa venda. El orden importa: **primero
qué queremos, después qué de lo que hay sirve.** Al revés, cualquier cosa
implementada parece un requisito.

El sesgo por defecto es **reutilizar**. Hay 16.933 líneas de motor y 7.255
líneas de prueba sobre ellas, y tirar eso sería el error opuesto al que
`WEB-D004` evitaba. Pero el veredicto se emite comparando con el diseño, no
con el esfuerzo invertido.

**Qué NO es este documento:**

- **No es un plan de migración.** Los cortes y su orden viven en `54`.
- **No es una auditoría línea por línea.** §3 explica hasta dónde llega la
  lectura de cada archivo, y §8 lista lo que queda pendiente de leer antes de
  poder decidir.
- **No cubre todo `src/`.** Solo el motor conversacional. El resto —dominio,
  repositorios, rutas— se evalúa en `52`.

## 2. Los cuatro veredictos

| Veredicto | Significa |
|---|---|
| **REUTILIZAR** | Se conserva. Cambios cosméticos como mucho |
| **ADAPTAR** | La idea y buena parte del código sirven; hay que cambiar su contrato o su alcance |
| **REEMPLAZAR** | El problema que resuelve sigue existiendo; esta solución no es la del diseño nuevo |
| **DESCARTAR** | El problema que resolvía ya no existe |

Y un quinto estado, que es honestidad y no indecisión:

| **LEER ANTES DE DECIDIR** | Solo se hizo lectura de superficie. El veredicto exige leerlo entero |

## 3. Alcance de la lectura

**Leídos enteros:** `turn-coordinator.ts`, `runtime-router.ts`,
`evidence-and-policy-compiler.ts` (parcial: 120 de 237 líneas, suficiente para
el veredicto), `turn-workspace.ts` (tipos completos).

**Leídos en superficie** —exportaciones, firmas, esquemas, estructura de
métodos—: `tool-gateway.ts`, `readiness.ts`, `conversation-agent/types.ts`,
`conversational-executive-agent/types.ts`, `executive-adapters.ts`,
`conversation-memory.ts`, `grounded-response-composer.ts`.

**Solo inventariados** —nombre, tamaño y ubicación—: el resto.

Los veredictos de §4 a §7 se emiten sobre lo leído. Los de §8 no se emiten.
Decir "reutilizar 1.110 líneas" tras haber visto solo el nombre del archivo
sería exactamente el tipo de afirmación sin evidencia que todo este corpus
prohíbe.

## 4. Lo que se reutiliza

### 4.1 `evidence-and-policy-compiler.ts` — 237 líneas — **REUTILIZAR**

**El hallazgo del documento.** Implementa casi literalmente el verificador de
`22`, y se escribió antes de que `22` existiera.

Sus trece códigos de incumplimiento mapean uno a uno con reglas que nuestro
diseño derivó por su cuenta:

| Código en el código | Regla del diseño |
|---|---|
| `amount_without_evidence` | `22` §2 — invariante de evidencia |
| `date_without_evidence` | `22` §2 |
| `category_without_evidence` | `22` §2 |
| `category_outside_context` | El catálogo entregado acota lo proponible |
| `reference_outside_focus` | `22` §4 — el foco es autoritativo |
| `tool_declared_not_executed` | `22` §11 — el verificador |
| `tool_used_not_executed` | `22` §11 |
| `claim_without_known_evidence` | `22` §2 |
| `claim_source_tool_not_executed` | `22` §11 |
| `missing_grounded_claims` | `22` §2 |
| `premature_write_claim` | `WEB-D013` — el agente propone, el Core ejecuta |
| `invalid_composition_stage` | `20` §7 |
| `debt_action_without_specialized_hint` | `31` §14 |

Se conserva íntegro. Lo único que cambia es que se le añaden los códigos que
el diseño nuevo introduce: `figure_without_assumptions` para `33`,
`world_knowledge_promoted` para `WEB-D022b`, y `command_outside_catalog` para
`WEB-D094`.

**Por qué importa este hallazgo más allá de las 237 líneas.** Que dos diseños
independientes —uno escrito con la venda puesta, otro escrito antes— lleguen a
la misma lista de comprobaciones es la mejor evidencia de que la lista es la
correcta. No es coincidencia: es que el problema tiene una forma.

### 4.2 `turn-workspace.ts` — 212 líneas — **ADAPTAR, casi reutilizar**

El 90% de nuestro `TurnWorkspace` ya está aquí: `focus_set` con
`ordered_refs`, `state_hash` y `expires_at`; `unresolved_slots` con `source`,
`confidence`, `confirmed_at` y `evidence_ref`; `pending_operation` con
`confirmable`; `recent_claims` con `evidence_refs`.

Y una cosa **mejor que lo que nuestro diseño pedía**:

```ts
permissions: {
  read_only_tools: true;
  can_model_mutate_financial_data: false;
};
```

Son tipos literales, no booleanos. **El compilador de TypeScript rechaza
cualquier código que intente ponerlos en otro valor.** Nuestro diseño enunció
esa frontera como regla; aquí está impuesta por el sistema de tipos, que es
una garantía más fuerte. Es exactamente el criterio de `WEB-D046` y
`WEB-D062`: preferir una imposibilidad estructural a una prohibición.

Se conserva. **Lo único que cambia es una línea**, y está en §6.1.

### 4.3 `runtime-router.ts` + `readiness.ts` — 323 líneas — **ADAPTAR**

`C-01` decía que el fallback a fixture podía degradar la calidad de producción
en silencio. **El código ya lo impide:**

```ts
if (request.provider === "local_fixture" && !this.options.localFixtureAllowed) {
  throw new AgentRuntimeError("RUNTIME_LOCAL_FIXTURE_FORBIDDEN", …);
}
```

Y `readiness.ts` calcula un `production_safe` que es falso si algún agente
resuelve a `local_fixture`.

**La contradicción estaba peor descrita que resuelta.** Lo que falta es
pequeño y está en `23` §3: el bloqueo ocurre **en la petición**, no **al
arrancar**. Un gate de arranque falla rápido y ruidosamente; uno de petición
falla en la primera petición de un usuario real.

Adaptación: leer `getAgentRuntimeReadiness()` en el arranque y **negarse a
levantar** si `production_safe` es falso en producción. Unas decenas de líneas
sobre algo que ya funciona.

### 4.4 `openai-agent-runtime.ts` + `http-agent-runtime.ts` + `config.ts` — 2.433 líneas — **REUTILIZAR**

Es el cliente del modelo y su configuración. Nada del diseño nuevo lo toca:
`23` habla de presupuesto de turno, degradación y elección de modelo, no de
cómo se hace la llamada.

### 4.5 `ConversationStyleProfileSchema` — **REUTILIZAR**

```ts
response_length, formality, warmth, playfulness, directness, emoji_policy
scope: "turn" | "session" | "persistent"
source: literal("explicit_user_request")
```

Es `20c` §5 —qué se adapta y qué no— con una decisión que coincide con
`WEB-D023`: `source` es un literal, así que **solo lo pedido explícitamente se
guarda**. Lo observado no entra por aquí.

### 4.6 Los 28 ficheros de prueba — 7.255 líneas — **REUTILIZAR**

Se conservan como red durante toda la migración, incluso los que prueban
código que se va a reemplazar: **son la definición ejecutable del
comportamiento actual**, y sirven para saber qué se rompe.

Se retiran uno a uno, junto con el código que cubren, y solo cuando su
sustituto tenga los suyos.

## 5. Lo que se adapta

### 5.1 `tool-gateway.ts` — 2.540 líneas — **ADAPTAR**

Veinte métodos privados, uno por herramienta: `getBalanceSnapshot`,
`queryMovements`, `getPendingSummary`, `getDebtSummary`, `searchFinancialMemory`…

**La lógica de acceso a datos sirve entera.** Lo que no sirve es su forma: son
veinte respuestas fijas, y `WEB-D021` sustituyó eso por un vocabulario
componible de 156 entradas (`WEB-D254`).

La adaptación no es tirar los métodos: es **cambiar quién decide la forma de
la respuesta**. Hoy `queryMovements` devuelve lo que decidió `queryMovements`;
mañana devuelve lo que pidió la consulta, con las dimensiones y medidas de
`40` §5 y §6.

Hay además dos cosas que ganar por el camino:

- **`enrichMovements` (líneas 476-543) es un enriquecedor** que ya calcula
  cosas derivadas. Es el sitio natural de las dimensiones derivadas de `20b`
  §5.1.
- **`filterMovementsForConversationQuery` (2098)** es una función exportada y
  pura sobre filas ya traídas. Es literalmente la forma que `WEB-D022` exige
  para el cálculo aislado: pura, sobre datos ya obtenidos, sin tocar la base.

Es el archivo más grande y el de adaptación más laboriosa. También el que más
valor conserva.

### 5.2 `grounded-response-composer.ts` — 929 líneas — **ADAPTAR**

Compone una respuesta con sus referencias. El diseño nuevo no compone
respuestas: **compone bloques** (`21` §5), y el presentador decide cómo se ven
(`41` §4).

La lógica de fundamentar cada afirmación sirve; su salida cambia de texto a
lista de bloques. Es una adaptación de contrato, no de sustancia.

### 5.3 `conversation-memory.ts` — 785 líneas — **ADAPTAR**

`rememberConversationTurn`, `rememberConversationOutcome`,
`rememberConversationPlanningState`. Recuerda lo que pasó en la conversación.

El módulo `36` define un gobierno que este código no tiene: **tres clases de
aprendizaje con reglas distintas** (`WEB-D057`), confirmación previa para los
hechos de perfil (`WEB-D058`), y lápidas (`WEB-D059`). Lo que hay recuerda; lo
que hace falta gobierna.

Se conserva la persistencia y se le añade el gobierno.

## 6. Lo que se reemplaza

### 6.1 El canal dentro del núcleo — **una línea**

```ts
channel: "whatsapp" | "dashboard";
```

Está en `TurnWorkspace`. Es la única contaminación de canal que la lectura
encontró en el núcleo, y contradice directamente `21` §2: *"si en el núcleo
aparece 'web' o 'whatsapp' fuera de un presentador, el diseño falló"*.

Reemplazo: el canal sale del espacio de trabajo y viaja en la entrada, **solo
para registro y depuración** (`21` §3). Que sea un tipo unión en el núcleo es
precisamente lo que invita a ramificar por él.

Una línea, y es la que hace que la prueba de agnosticismo de `21` §8 sea
escribible o no.

### 6.2 `ConversationToolNameSchema` — 15 herramientas en un enum — **REEMPLAZAR**

```ts
z.enum([
  "get_balance_snapshot", "query_movements", "get_pending_summary",
  "get_debt_summary", "get_debt_details", "get_recurring_summary",
  "search_financial_memory", "get_classification_catalog",
  "get_pending_details", "get_financial_structure", "get_insights",
  "get_insight_evidence", "get_record_provenance",
  "get_user_context_summary", "get_spending_summary",
])
```

**Aquí está el techo de expresividad**, y además el origen literal de `C-03`:
son quince, y otro documento decía catorce.

Un enum cerrado significa que el asistente responde lo previsto y calla en el
resto, sin que el usuario sepa dónde está el límite. Es el problema que
`WEB-D021` resolvió con un vocabulario componible, y es la razón de que el
producto "se sienta inteligente hasta la primera pregunta no anticipada".

Se reemplaza por el vocabulario de `40` §5 y §6. **Los métodos del gateway
sobreviven; el enum que los enumera, no.**

### 6.3 `turn-coordinator.ts` — 139 líneas — **REEMPLAZAR**

No es lo que su nombre sugiere. Es un **arnés de migración**: ejecuta el
agente ejecutivo nuevo y el planificador antiguo, los compara
(`compareExecutiveWithLegacy`) y elige según un modo `off | shadow | active`.

Es buen trabajo y cumplió su función —migrar sin apagar lo anterior—. Pero el
coordinador de `20` §3 hace otra cosa: arma el panorama, construye el espacio
de trabajo, abre **una** sesión y pasa el resultado al verificador. No compara
dos implementaciones.

Se reemplaza cuando el legacy se retire, que es lo que hace que este arnés
sobre. Y su lógica de comparación **se conserva como herramienta de
migración** en `54`: comparar el motor nuevo con el actual durante el corte es
exactamente para lo que sirve.

### 6.4 `conversation-router.ts` y `conversation-kernel.ts` — 874 líneas — **LEER ANTES DE DECIDIR, con veredicto probable REEMPLAZAR**

Enrutamiento y núcleo de conversación anteriores al diseño de `20`. Por
tamaño y posición parecen la capa que `20` §3 sustituye, pero no se han leído
lo suficiente para afirmarlo. Ver §8.

### 6.5 `executive-adapters.ts` — 177 líneas — **DESCARTAR al cerrar la migración**

Siete funciones que traducen entre el agente ejecutivo y los tipos del
sistema anterior: `dataAgentResultFromExecutive`,
`correctionResultFromExecutive`, `conversationResultFromExecutive`…

Existe **solo** para que los dos convivan. Cuando el antiguo se retire, no
tiene a quién traducir.

## 7. Lo que se descarta

### 7.1 La arquitectura de cuatro agentes — **DESCARTAR**

`conversation-agent`, `data-agent`, `correction-agent`, `response-agent` y
`orchestration-planning-agent` son agentes separados, cada uno con su llamada
al modelo.

**Ahí están las cuatro llamadas por turno** que `23` §5 quiere bajar a una o
dos. No es un problema de eficiencia del prompt: es la arquitectura.

El diseño nuevo tiene **una sesión con el catálogo completo**, decidida con el
usuario durante el diseño del motor. Cuatro agentes son cuatro decisiones
parciales, cuatro oportunidades de perder contexto entre una y otra, y cuatro
veces el coste.

`orchestration-planning-agent` es el más claro: es el planificador que el
agente ejecutivo vino a sustituir, y el `TurnCoordinator` existe para
compararlos. Cuando el ejecutivo gane, sobra.

**Precisión importante:** se descartan **como agentes**, no necesariamente su
lógica. `correction-agent` tiene 1.110 líneas de interpretación de
correcciones que pueden valer como paso determinista; eso está en §8.

### 7.2 Los siete `local-fixture-runtime.ts` — unas 2.242 líneas — **DESCARTAR seis**

Hay uno por agente: data (877), conversational-executive (399),
orchestration-planning (290), email-extraction (236), response (191), genérico
(151), learning-signal (98).

Son andamiaje de desarrollo: respuestas simuladas para trabajar sin llamar al
modelo. Con una sola sesión, seis de ellos pierden su agente.

Se conserva **el genérico** (`runtime/local-fixture-runtime.ts`, 151 líneas)
para pruebas, con la prohibición de producción de `23` §3 intacta.

**Con una salvedad:** `email-extraction-agent/local-fixture-runtime.ts` y sus
`fixtures/bcp-sanitized.ts` sirven al módulo `28`, que no es el motor
conversacional. Se evalúan en `52`, no aquí.

## 8. Los ocho, leídos enteros y con veredicto (`W-16`)

Ocho archivos, 3.827 líneas, leídos **completos** al abrir `W-16`, antes de
tocar nada — tal como exigía `AC-REU-10`. Lo que sigue no es inventario: es
el veredicto que este documento pospuso.

**El hallazgo que cambia la lectura de los ocho.** `turn-coordinator.ts`
conecta `ConversationalExecutiveAgent` y `OrchestrationPlanningAgent`, y **al
segundo lo nombra literalmente `legacyPlanningAgent`**. El código ya
atravesó una migración interna — de `orchestration-planning-agent` a
`conversational-executive-agent` — antes de que este rediseño existiera.
No se parte de cero contra un sistema de cuatro agentes: se continúa una
migración que ya llevaba un paso de camino.

| Archivo | Pregunta de `§8` original | Veredicto |
|---|---|---|
| `correction-agent/correction-agent.ts` | ¿Su interpretación vale sin modelo? | **DESCARTAR como agente, REUTILIZAR su lógica** |
| `conversation-router.ts` | ¿Enruta o decide? | **REEMPLAZAR** la clasificación por enum cerrado; **ADAPTAR** la resolución de fechas y la continuidad de tema |
| `conversation-kernel.ts` | ¿Estado o lógica de dominio? | **REEMPLAZAR** como mecanismo principal; **ADAPTAR** las heurísticas de riesgo como salvaguarda del verificador |
| `conversational-executive-agent.ts` | ¿Cuánto sirve de su bucle? | **ADAPTAR — es el esqueleto de la sesión única** |
| `orchestration-planning-agent/types.ts` | ¿Qué esquemas sobreviven? | **REEMPLAZAR** el archivo; **ADAPTAR** cuatro sub-esquemas |
| `conversation-agent/types.ts` | Confirmar enum vs. perfil de estilo | **REUTILIZAR** (más de lo esperado — ver abajo) / **REEMPLAZAR** el enum |
| `evals/conversation-eval-corpus.v1.ts` | ¿Sirve el corpus? | **ADAPTAR — confirmado, es valioso** |
| `data-agent/types.ts` | ¿Contrato de datos o de agente? | **REUTILIZAR** los contratos de datos; **DESCARTAR como agente** el envoltorio |

### 8.1 `correction-agent.ts` (1.110 líneas) — DESCARTAR como agente, REUTILIZAR su lógica

`proposeCorrection()` y sus `extract*Target` (préstamo, monto, categoría,
cuenta, borrado) más `isCorrectionLikeText` son heurísticas de español por
regex, **sin llamada al modelo**: es exactamente la ruta que hoy usa el
`local_fixture` de este agente. Sobrevive como módulo determinista, invocable
como paso previo o dentro del verificador — no como agente con su propia
sesión.

**Hallazgo:** la ruta basada en modelo
(`SemanticCorrectionInterpretationSchema`) casi nunca hace falta: la ruta
determinista ya cubre préstamo/monto/categoría/cuenta/borrado de punta a
punta. La interpretación de correcciones probablemente no necesita vivir
dentro de la sesión única en absoluto.

### 8.2 `conversation-router.ts` (507 líneas) — REEMPLAZAR / ADAPTAR

`classifyConversationQuery()` es 100% regex, sin modelo, y hace dos cosas:
clasifica en un enum cerrado (`ConversationQueryKind` — esto se reemplaza,
es el mismo techo de expresividad que `40` § 6.2 cierra) y **decide**:
continuidad de tema (`isActiveContinuationQuestion`,
`hasExplicitNewQuestion`) y resolución de fechas relativas con aritmética de
calendario real ("el último viernes de hace 4 meses").

**Sobrevive:** `resolveDateRange` y sus ayudantes de fecha, como parser
determinista de frases temporales que alimenta los filtros `donde` del
lenguaje de consulta de `20b` §5.2; las heurísticas de continuidad, como
paso de resolución de referencias previo a la sesión.

### 8.3 `conversation-kernel.ts` (367 líneas) — REEMPLAZAR / ADAPTAR

`analyzeConversationTurn()` es casi entero lógica de dominio (heurísticas de
interpretación), no estado: infiere `act`, `continuity`, `emotional_state`,
`experience_mode`, todo por regex, sin modelo. Lo único que es estado
propiamente es el `activeState` que recibe como entrada.

**Sobrevive:** el constructor de `risk_notes` (disparadores regex de
acción financiera / tema sensible) como comprobación determinista adicional
que alimenta al verificador, independiente de la sesión.

### 8.4 `conversational-executive-agent.ts` (449 líneas) — ADAPTAR, es el esqueleto

El artefacto existente más parecido a lo que `20` §6 pide. Una llamada a
`runtime.run()` por intento (máximo 2, con reintento de regeneración
estructurada) produce **una** salida tipada con `turn_interpretation`,
`orchestration_plan`, `reference_resolution`, `tool_requests`,
`response_composition` — exactamente entender→resolver→planificar→proponer→
redactar colapsado en una sesión, como pide el diseño nuevo. Va emparejado
con un verificador determinista tras la llamada
(`validateExecutiveConsistency`) que cruza los módulos entre sí (¿la
interpretación coincide con el plan? ¿ningún id de movimiento inventado
fuera del `focus_set`? ¿las peticiones de herramienta las autorizó el plan?)
y rechaza/regenera vía `compileExecutiveEvidenceAndPolicy` antes de aceptar.

**Sobrevive:** la forma completa — salida multi-módulo tipada + verificador
determinista + regeneración acotada al rechazar — como punto de partida
para adaptar la sesión única. Lo que hay que reemplazar es más estrecho de
lo que parecía: solo las idas y vueltas de herramienta dentro de la sesión
(`max_tool_rounds: 8` contra el `ConversationToolNameSchema`/`EXECUTIVE_TOOLS`
cerrado) necesitan el vocabulario abierto nuevo.

### 8.5 `orchestration-planning-agent/types.ts` (462 líneas) — REEMPLAZAR el archivo, ADAPTAR cuatro sub-esquemas

`PlanningCapabilitySchema` mezcla los cuatro agentes viejos como
"capacidades" con el enum cerrado de 15 herramientas — exactamente el
modelo de enrutamiento por catálogo cerrado que este rediseño elimina.

**Sobrevive:** `PlanningGoalSchema` (registrar/consultar/corregir/confirmar/
revisar/ayuda/mixto) y `PlanningWorkflowSchema`, independientes del
vocabulario; la forma de `PlanningFinancialResolutionSchema` (resolución de
pendientes: asignar/clasificar/confirmar/descartar + cuenta/categoría); el
bloque `style_update` (referencia a `ConversationStyleProfileSchema`) — los
cuatro como sub-módulos tipados de la salida de la sesión única, sin los
enums de herramienta/capacidad.

### 8.6 `conversation-agent/types.ts` (397 líneas) — confirmado, y más de lo esperado

Confirmado: `ConversationToolNameSchema` (enum cerrado de 15) se reemplaza;
`ConversationStyleProfileSchema` se reutiliza (`§4.5`).

**El hallazgo real.** `ConversationFocusSetSchema` +
`ConversationFocusSlotProvenanceSchema` + `ConversationWorkingSetSchema` son
una implementación **ya casi 1:1** del `TurnWorkspace` nuevo:
`ConversationFocusSetSchema` tiene `ordered_ids`/`state_hash`/`expires_at`/
`tool_provenance` (≈ `focus_set` de `20` §5); `ConversationFocusSlotProvenanceSchema`
tiene `source` (enum con `explicit_user_message`/`conversation_memory`/
`tool_result`/`core_confirmed`)/`confidence`/`confirmed_at`/`evidence_ref`
(≈ `unresolved_slots[].procedencia`). También confirma, en directo, la
contaminación de canal de `§6.1`: `ConversationContextPackSchema` declara
`channel: z.enum(["whatsapp","dashboard"])`.

**Veredicto ampliado:** `REUTILIZAR` los tres esquemas de foco/conjunto de
trabajo además del perfil de estilo; `ADAPTAR`
`ConversationTurnActSchema`/`ConversationContinuitySchema`/
`ConversationEmotionalStateSchema`/`ConversationExperienceModeSchema` como
contrato tipado del paso "entender" de la sesión; `ADAPTAR`
`ConversationMovementFiltersSchema` como semilla de la forma
`donde`/`agrupar_por` del lenguaje de `20b` §5.2; `REEMPLAZAR`
`ConversationToolNameSchema` y `ConversationQueryKindSchema`.

### 8.7 `evals/conversation-eval-corpus.v1.ts` (297 líneas) — confirmado, valioso

20 familias de mensajes (~180 mensajes reales en español peruano):
captura, preguntas hipotéticas de dinero, búsqueda y seguimiento de
movimientos, correcciones de borrado/reclasificación, captura+consulta
mixta, consultas de deudas/recurrentes/pendientes/memoria, saludo/ayuda,
reparación tras frustración, transferencia-vs-préstamo ambigua ("le pasé 50
a Luis"), fechas históricas ("el último viernes de hace 4 meses"), cambios
de tema.

**Sobrevive entero** el listado de `families` (mensajes). Solo la forma de
`expected` (`query_kinds`, `goals`, `workflows` — todos atados a los enums
viejos) necesita re-anotarse contra el vocabulario y el catálogo de `40`.
Reconstruir este corpus de cero habría costado más que su tamaño.

### 8.8 `data-agent/types.ts` (238 líneas) — separable con nitidez

Contratos de datos (formas de dominio, sin semántica de llamada a agente):
`EvidenceSignalSchema`, `AmbiguitySchema`, `DebtHintSchema`,
`ProposedActionSchema` (la forma real de la propuesta de escritura de un
movimiento: monto/moneda/fecha/categoría/etiquetas/cuenta/caja/pista de
deuda/confianza), `DataContextPack` (paquete de contexto: categorías,
cuentas, cajas, subcategorías, etiquetas, personas relacionadas, deudas
activas, movimientos recientes). Contratos de agente (envoltorio atado a
una invocación puntual): `DataAgentIntentSchema`, `DataAgentOutputSchema`.

**Veredicto:** `REUTILIZAR` los cuatro contratos de datos; `DESCARTAR como
agente` el envoltorio — sus campos sobreviven como sub-módulo de la salida
de la sesión única, no como resultado de un agente aparte.

**Hallazgo adicional:** `DataContextPack.channel` está tipado
`"whatsapp" | "dashboard" | "email" | "worker"` — una **tercera** aparición
de canal filtrándose en contratos cercanos al núcleo, además de las dos ya
señaladas (`TurnWorkspace`, `ConversationContextPackSchema`). `WEB-D105` no
alcanza con tocar un archivo.

### 8.9 Resumen

De las 3.827 líneas leídas: ~45% sobrevive en alguna forma (esquemas,
contratos de datos, parsers/heurísticas deterministas, el corpus de
evaluación); ~55% es forma arquitectónica atada al enum cerrado / los
agentes separados, y se reemplaza o se descarta como agente.

El hallazgo más importante de los ocho: `conversational-executive-agent.ts`
**ya hace** "una llamada al modelo → salida tipada multi-módulo →
verificador determinista que puede rechazar y forzar regeneración" — la
forma exacta que `20` §6 pide — y ya sustituyó en producción a un diseño de
planificador anterior (`orchestration-planning-agent`, hoy
`legacyPlanningAgent` en el propio código). Combinado con que
`ConversationFocusSetSchema`/`ConversationFocusSlotProvenanceSchema` ya
modelan la mayor parte de `focus_set`/`unresolved_slots`, `W-16` no empieza
desde cero: continúa una migración que ya llevaba un paso.

## 9. Reparto aproximado

De las 16.933 líneas de `src/agents/` y `src/core/conversation/` sin contar
pruebas, **1.700 no son del motor conversacional**: extracción de correo
(sirve al módulo `28`), señales de aprendizaje, avisos y corpus de
evaluación. Se evalúan en `52`.

Quedan **15.233 líneas** de motor propiamente dicho:

| Veredicto | Líneas | Proporción | Qué incluye |
|---|---|---|---|
| REUTILIZAR | ~2.670 | 18% | Verificador de evidencia, clientes de modelo, configuración |
| ADAPTAR | ~4.790 | 31% | Gateway de datos, compositor, memoria, espacio de trabajo, readiness |
| REEMPLAZAR | ~150 | 1% | El enum de herramientas, el arnés de migración, la línea del canal |
| DESCARTAR | ~2.340 | 15% | Seis andamios de fixture, adaptadores de migración, planificador legacy |
| Sin decidir | ~3.830 | 25% | Los ocho de §8 |
| No enumerado | ~1.450 | 10% | Archivos pequeños que la lectura no alcanzó |

**Son cuentas de inventario, no de auditoría**, y §3 dice hasta dónde llegó la
lectura de cada uno.

Dos lecturas de esta tabla:

**Casi la mitad sobrevive** —reutilizar más adaptar, 49%—, y es bastante más
de lo que cabía esperar de un motor construido bajo una tesis de producto que
este corpus invirtió.

**Y lo que se reemplaza son 150 líneas.** Eso es lo llamativo: el techo de
expresividad, la contaminación de canal y el arnés de migración —los tres
problemas conceptuales del motor actual— suman menos del 1% del código. Lo
grande no es sustituir: es adaptar el gateway, y eso es trabajo de contrato,
no de rediseño.

## 10. Las cuatro sorpresas

Lo que la lectura cambió respecto de lo que se esperaba encontrar.

**1. El verificador ya existía, y es el mismo.** `evidence-and-policy-compiler`
implementa trece comprobaciones que `22` derivó por su cuenta, y coinciden.
Dos diseños independientes llegando a la misma lista es la mejor evidencia de
que la lista es correcta.

**2. La frontera de escritura está impuesta por el compilador.** Nuestro
diseño la enunció como regla; el código la tiene como tipos literales
`true`/`false`. Es más fuerte de lo que pedíamos.

**3. `C-01` estaba peor descrito que resuelto.** La contradicción decía que el
fallback podía degradar producción en silencio; el `RuntimeRouter` ya lo
prohíbe y `readiness.ts` ya lo mide. Falta un gate de arranque, no un
mecanismo.

**4. El canal contamina el núcleo, y son cinco palabras.** `channel:
"whatsapp" | "dashboard"` en `TurnWorkspace` es la única violación real de
agnosticismo encontrada. El resto del núcleo está limpio.

Y una que no es sorpresa pero conviene decir: **el techo de expresividad era
literal y estaba en un `z.enum` de quince cadenas.** El problema que motivó la
mitad del rediseño del motor cabe en diecisiete líneas de código.

## 11. Riesgos

| Riesgo | Mitigación |
|---|---|
| Adaptar `tool-gateway` es el trabajo más largo y toca todo | Se hace por familias de consulta, no de golpe; los 28 tests son la red |
| Quitar el canal del núcleo puede romper llamadas en cascada | Es un cambio de tipos: el compilador enumera todos los puntos afectados |
| Retirar el legacy antes de que el ejecutivo esté probado | El arnés de `turn-coordinator` en modo `shadow` **es exactamente la herramienta** para esa comparación; se usa antes de descartarlo |
| Descartar los cuatro agentes de golpe | Se colapsa a una sesión por partes, midiendo calidad con el corpus de evaluación |
| Los ocho sin decidir esconden trabajo no previsto | Se leen en el primer corte de `54`, antes de estimar nada |

El tercero merece énfasis: **el arnés de migración se usa para migrar y se
descarta después**, en ese orden. Descartarlo primero por parecer legacy sería
tirar la herramienta antes de hacer el trabajo.

## 12. Criterios de aceptación

- `AC-REU-01` — Ningún documento del bloque `03_motor_ia/` se modificó después
  de leer el código. El diseño no se ajustó a lo implementado.
  Evidencia: `DOC`. Cierra: `WEB-D004` mantuvo la venda puesta durante la
  redacción de `20`-`23`; las únicas ediciones posteriores de este corte a
  esos documentos son las anotaciones de este mismo §20/§17/§12 y las cifras
  de `WEB-D254`, ambas posteriores al cierre del diseño, no correcciones de
  diseño por lo encontrado en el código.
- `AC-REU-02` — `channel` no aparece en ningún tipo del núcleo fuera de la
  entrada y del registro. Evidencia: `CODE` + `TEST`. Cierra en `W-16` fase
  2: ver `AC-MOTOR-11`.
- `AC-REU-03` — La prueba de agnosticismo de `21` §8 es escribible y pasa.
  Evidencia: `TEST`. Cierra en `W-16` fase 2, como consecuencia directa de
  `AC-REU-02`: con `channel` fuera de `TurnWorkspace`/los context packs, la
  prueba de `21` §8 ya no tiene un tipo unión de canal contra el que
  ramificar; `tests/lint/inv-04-sin-canal-en-el-nucleo.test.ts` la sostiene.
- `AC-REU-04` — El verificador conserva los trece códigos existentes y añade
  los tres nuevos. Evidencia: `TEST`. Cierra en `W-16` fase 3: los 13
  códigos originales de `evidence-and-policy-compiler.ts` siguen intactos
  (ninguna prueba previa dejó de pasar) y se añadieron
  `command_outside_catalog`, `figure_without_assumptions`,
  `world_knowledge_promoted` — tres, no más, tal como pedía este criterio
  cuando se escribió. (Fase 7 añadió un cuarto código, `focus_expired`, por
  un hueco real encontrado después; `AC-REU-04` se declaró antes de que ese
  hueco se descubriera y no lo previó.)
- `AC-REU-05` — `permissions.read_only_tools` y
  `can_model_mutate_financial_data` siguen siendo tipos literales.
  Evidencia: `CODE`. Cierra: ninguna fase de `W-16` tocó
  `ConversationContextPackSchema.permissions`; siguen siendo
  `z.literal(true)`/`z.literal(false)`.
- `AC-REU-06` — El arranque falla si `production_safe` es falso en producción.
  Evidencia: `TEST`. Clase: `build`. Ver `AC-RT-01`/`AC-RT-03` en `23` §11 —
  ya cerraba antes de `W-16`.
- `AC-REU-07` — No queda ningún enum cerrado de herramientas de lectura.
  Evidencia: `CODE`. **No cierra.** `WEB-D259` decidió explícitamente no
  reemplazar las 15 herramientas cerradas: siguen siendo un enum fijo, con
  una 16ª herramienta abierta añadida al lado. Este criterio se escribió
  antes de que `WEB-D257` limitara la capa semántica a una entidad, y quedó
  desalineado con la decisión real — se documenta aquí en vez de forzar un
  cierre falso.
- `AC-REU-08` — El presupuesto de llamadas al modelo por turno baja de cuatro
  a dos como máximo. Evidencia: `METRIC`. Cierra la parte estructural (no
  `METRIC`): el bucle de `ConversationalExecutiveAgent.run` ya tenía tope de
  2 intentos antes de `W-16` (ver `AC-MOTOR-01`); no se midió en producción.
- `AC-REU-09` — Los 28 ficheros de prueba pasan o se retiran junto con el
  código que cubren, nunca antes. Evidencia: `CODE`. No verificado en
  `W-16`: ninguna fase retiró código de los ocho archivos de §8 todavía
  (fase 5 solo adaptó `evidence-and-policy-compiler.ts`/`types.ts`, no
  descartó ninguno de los cuatro agentes legados).
- `AC-REU-10` — Los ocho archivos de §8 tienen veredicto emitido antes de que
  empiece el corte que los toca. Evidencia: `DOC`. Cierra: los ocho
  veredictos de §8.1-§8.9 se emitieron antes de la fase 1 de `W-16`.

`AC-REU-01` es el que protege retroactivamente a `WEB-D004`: si el diseño se
hubiera ajustado al código después de leerlo, la venda no habría servido de
nada.

## 13. Trazabilidad

**Código leído:** `src/agents/` (11.219 líneas sin pruebas) y
`src/core/conversation/` (5.714). Alcance de la lectura declarado en §3.

**Trabajo del agente anterior.** Todo lo evaluado aquí es material que se
implementó sin documentar: el ledger `23b` del corpus histórico se detuvo el
23 de julio de 2026 y por eso las migraciones `042`–`046` y este motor
quedaron fuera de la documentación. Este documento es la primera vez que ese
trabajo se evalúa por escrito.

El juicio general, para que conste junto a los veredictos: **es trabajo serio
y de buena calidad**, hecho bajo una tesis de producto que este corpus
invirtió. Casi la mitad sobrevive, y la pieza más valiosa —el compilador de
evidencia— coincide con lo que diseñamos a ciegas.

**Contradicciones que informa:**

- `C-01` — el código está más avanzado que la contradicción; falta el gate de
  arranque (§4.3).
- `C-03` — el origen literal está en `ConversationToolNameSchema` (§6.2), y ya
  quedó cerrado por método en `40` §2.
- `C-10` — la prueba de agnosticismo pasa a ser escribible en cuanto se quite
  el canal del núcleo (§6.1).

**Decisiones tomadas en este documento**, registradas en
`03_decisiones_producto_web.md`:

| Decisión | ID | Alternativa descartada | Razón |
|---|---|---|---|
| El diseño no se ajusta a lo encontrado | `WEB-D103` | Revisar `20`–`23` con el código delante | Ajustar el diseño después de mirar es exactamente lo que `WEB-D004` evitaba, y anularía retroactivamente el valor de haberlo escrito a ciegas |
| Se emite veredicto solo sobre lo leído | `WEB-D104` | Clasificar los 17k de líneas por tamaño e intuición | Un veredicto sobre un archivo del que solo se vio el nombre es una afirmación sin evidencia, que es justo lo que este corpus prohíbe en todas partes |
| El canal sale del espacio de trabajo | `no_negociable` `WEB-D105` | Dejarlo y no ramificar por él por convención | Un tipo unión en el núcleo invita a ramificar. Y es la diferencia entre poder escribir la prueba de agnosticismo y no poder |
| El arnés de migración se usa antes de descartarse | `WEB-D106` | Retirar `turn-coordinator` por ser andamiaje | Su comparación entre motor nuevo y antiguo es exactamente la herramienta del corte. Tirarla primero sería descartar la herramienta antes de hacer el trabajo |
| Los cuatro agentes se colapsan en una sesión | `WEB-D107` | Conservar la separación y optimizar cada uno | Ahí están las cuatro llamadas por turno que `23` §5 quiere bajar a dos. No es un problema de prompt, es la arquitectura: cuatro decisiones parciales y cuatro ocasiones de perder contexto |
| La limpieza de canal alcanza tres archivos, no uno | `no_negociable` `WEB-D252` | Dar `WEB-D105` por cumplido al limpiar solo `TurnWorkspace` | La lectura completa de los ocho de `§8` encontró `channel` también en `ConversationContextPackSchema` y en `DataContextPack` (este con cuatro valores). `WEB-D105` no cambia de regla; cambia su alcance de limpieza |
| La sesión única se adapta desde `conversational-executive-agent.ts` | `no_negociable` `WEB-D253` | Escribir la sesión única de `20` §6 desde cero | Ese archivo ya implementa la forma exacta que `20` §6 pide y ya sustituyó en producción a `orchestration-planning-agent` (`legacyPlanningAgent` en el propio código). Lo que sobra es el enum cerrado de herramientas, no el bucle |
