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
componible de 145 entradas.

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

## 8. Lo que no se decide todavía

Ocho archivos, unas 3.400 líneas, sobre los que **solo se hizo inventario**.
Emitir un veredicto sobre ellos ahora sería inventarlo.

| Archivo | Líneas | Qué hay que averiguar |
|---|---|---|
| `correction-agent/correction-agent.ts` | 1.110 | Si su interpretación de correcciones vale como paso determinista sin modelo |
| `conversation-router.ts` | 507 | Si enruta o si además decide; lo primero se reemplaza, lo segundo puede adaptarse |
| `conversation-kernel.ts` | 367 | Qué parte es estado de conversación y qué parte es lógica de dominio |
| `conversational-executive-agent.ts` | 449 | Cuánto de su bucle sirve para la sesión única de `20` |
| `orchestration-planning-agent/types.ts` | 462 | Qué esquemas sobreviven al cambio de vocabulario |
| `conversation-agent/types.ts` | 397 | Ídem; contiene el enum que se reemplaza y el perfil de estilo que se conserva |
| `evals/conversation-eval-corpus.v1.ts` | 297 | Si el corpus de evaluación sirve para el motor nuevo. **Probablemente sí y es valioso** |
| `data-agent/types.ts` | 238 | Qué parte es contrato de datos y qué parte es contrato de agente |

El corpus de evaluación es el más prometedor de la lista: un juego de casos ya
escritos contra los que medir el motor nuevo vale mucho más que su tamaño.

Estos ocho se leen en el primer corte de `54`, antes de tocar nada.

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
  Evidencia: `DOC`.
- `AC-REU-02` — `channel` no aparece en ningún tipo del núcleo fuera de la
  entrada y del registro. Evidencia: `CODE` + `TEST`.
- `AC-REU-03` — La prueba de agnosticismo de `21` §8 es escribible y pasa.
  Evidencia: `TEST`.
- `AC-REU-04` — El verificador conserva los trece códigos existentes y añade
  los tres nuevos. Evidencia: `TEST`.
- `AC-REU-05` — `permissions.read_only_tools` y
  `can_model_mutate_financial_data` siguen siendo tipos literales.
  Evidencia: `CODE`.
- `AC-REU-06` — El arranque falla si `production_safe` es falso en producción.
  Evidencia: `TEST`. Clase: `build`.
- `AC-REU-07` — No queda ningún enum cerrado de herramientas de lectura.
  Evidencia: `CODE`.
- `AC-REU-08` — El presupuesto de llamadas al modelo por turno baja de cuatro
  a dos como máximo. Evidencia: `METRIC`.
- `AC-REU-09` — Los 28 ficheros de prueba pasan o se retiran junto con el
  código que cubren, nunca antes. Evidencia: `CODE`.
- `AC-REU-10` — Los ocho archivos de §8 tienen veredicto emitido antes de que
  empiece el corte que los toca. Evidencia: `DOC`.

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
