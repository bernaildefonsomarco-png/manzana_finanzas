# Auditoria De Arquitectura IA, Calidad Conversacional Y Cobertura De Producto

**Fecha de corte:** 24 de julio de 2026  
**Alcance ejecutado:** arquitectura tecnica de Manzana de extremo a extremo,
con profundidad especial en WhatsApp, agentes, herramientas, memoria, Core
financiero, Pendientes, deudas, runtime y calidad de evaluacion. La cobertura
integral de los 21 flujos, producto, visual, privacidad, lifecycle y métricas
se cierra en la matriz complementaria
`matriz_cumplimiento_integral_v1_2026-07-24.md`.  
**Limite explícito:** este informe es la auditoría profunda del motor y la
conversación; debe leerse junto con la matriz complementaria, que diferencia
DOC, CODE, TEST, SMOKE, LIVE, USER y METRIC y evita presentar una capa como
cumplimiento integral.  
**Tipo de documento:** auditoria independiente. No reemplaza ni reescribe los
documentos fuente.

---

## 1. Veredicto ejecutivo

Manzana no tiene un problema principal de falta de agentes. Tiene un problema
de **fragmentacion de autoridad semantica** y de **perdida de evidencia entre
agentes y turnos**.

La arquitectura financiera es considerablemente mas segura que la experiencia
conversacional:

- Core, PolicyGate, comandos especializados, idempotencia, outbox y la
  separacion entre Pendientes y movimientos confirmados estan bien orientados.
- La conversacion interactiva puede encadenar Planner, DataAgent,
  ConversationAgent y ResponseAgent para resolver una sola pregunta.
- Cada transferencia entre agentes comprime, reinterpreta o pierde parte del
  objetivo, el conjunto de resultados visible y la evidencia.
- El sistema tiene memoria persistente, pero no conserva de forma autoritativa
  el conjunto exacto que acaba de mostrar al usuario.
- El compilador valida que un rango de fechas sea sintacticamente valido, pero
  no que haya sido expresado por el usuario o heredado de una consulta real.
- El corpus de 200 mensajes cubre familias aisladas y seguridad estructural,
  pero no demuestra fidelidad sobre conversaciones completas con datos reales.
- `local_fixture` continúa permitido como provider por defecto y como fallback
  silencioso en producción. Las trazas revisadas prueban además que
  `RiskSignalAgent` usó `local_fixture` en una interacción humana. Vercel
  confirma las claves de los agentes centrales, pero sus valores sensibles no
  son legibles por CLI y no existe un readiness del deployment que certifique
  provider/modelo/fallback efectivo por agente.
- El aprendizaje desde correcciones confirmadas esta conectado en codigo, pero
  la base real tiene cero candidatos y cero memorias financieras promovidas.
  Hoy existe infraestructura de learning; todavia no existe evidencia de que
  una memoria aprendida haya cambiado una conversacion posterior.
- La auditoria tecnica y agentic es profunda, pero por si sola no demuestra la
  experiencia integral del producto. Onboarding completo, activacion fuerte,
  retorno D1-D30, transformacion emocional, consistencia de lenguaje,
  continuidad entre canales y cobertura de los 21 flujos requieren una matriz
  de trazabilidad separada.

La recomendacion es:

> Un solo agente semantico cabeza por turno interactivo, no un LLM gigante con
> autoridad financiera y tampoco una cadena de LLMs subordinados. Ese agente
> interpreta, consulta tools read-only y produce una propuesta/respuesta
> estructurada. Un coordinador deterministico valida evidencia, PolicyGate y
> Core ejecutan el dinero, y el canal presenta el resultado.

No se recomienda agregar mas agentes. Se recomienda reducir la ruta
interactiva de cinco roles LLM posibles a un unico
`ConversationalExecutiveAgent`, manteniendo como componentes separados solo
los que requieren aislamiento real, como `EmailExtractionAgent`.

---

## 2. Corpus revisado y jerarquia de verdad

Se inventario el corpus completo de `docs/` por fases y se contrastaron sus
contratos, dependencias y estados:

- Fase 1: identidad, usuarios y mercado.
- Fase 2: WhatsApp, Motor IA, Dashboard, email, cuentas, categorias,
  Descubrimientos, deudas, recurrentes y nudges.
- Fase 3: experiencia, personalidad, lenguaje, flujos, confianza, errores,
  retencion, Dashboard y wireframes.
- Fase 4: arquitectura, stack, datos, eventos, API, runtime, decisiones,
  providers, plan y ledger vivo.
- Fase 5: privacidad, costos, GTM y legal.
- Fase 6: identidad visual, design system, app flow, wireflows y especificacion
  Hi-Fi.

La lectura profunda se concentro en los documentos que gobiernan directamente
la arquitectura auditada:

- `docs/fase_2_estrategia/alcance_v1/05a_whatsapp.md`
- `docs/fase_2_estrategia/alcance_v1/05b_motor_ia.md`
- `docs/fase_2_estrategia/alcance_v1/05d_email_parsing.md`
- `docs/fase_2_estrategia/alcance_v1/05h_deudas.md`
- `docs/fase_3_producto/10_principios_experiencia.md`
- `docs/fase_3_producto/11_personalidad_conversacion.md`
- `docs/fase_3_producto/12_lenguaje_producto.md`
- `docs/fase_3_producto/13_onboarding_activacion.md`
- `docs/fase_3_producto/14_flujos_usuario_v1.md`
- `docs/fase_3_producto/15_retencion_lifecycle.md`
- `docs/fase_3_producto/16_confianza_errores.md`
- `docs/fase_4_tecnica/06_arquitectura_sistema.md`
- `docs/fase_4_tecnica/16_modelo_datos.md`
- `docs/fase_4_tecnica/17_eventos_workers.md`
- `docs/fase_4_tecnica/18_api_spec.md`
- `docs/fase_4_tecnica/19_agent_runtime_tools.md`
- `docs/fase_4_tecnica/20_decisiones_tecnicas.md`
- `docs/fase_4_tecnica/23_plan_implementacion_v1.md`
- `docs/fase_6_visual/31_wireflows.md`
- `docs/fase_4_tecnica/23b_seguimiento_construccion_v1.md`
- `docs/fase_4_tecnica/26_auditoria_captura_financiera_externa_v1.md`
- `docs/fase_5_proteccion/24_privacidad_proteccion_datos.md`
- `docs/fase_5_proteccion/25_unit_economics_costos.md`

Jerarquia aplicada:

1. Las invariantes financieras de Core, privacidad y confianza son
   no negociables.
2. `23b_seguimiento_construccion_v1.md` manda sobre el estado implementado.
3. Los documentos de alcance y producto mandan sobre la experiencia deseada.
4. El codigo y las trazas reales mandan sobre lo que el sistema hace hoy.
5. Una afirmacion del ledger no se considera vigente si la contradicen codigo
   o evidencia operativa posterior.

---

## 3. Arquitectura real de extremo a extremo

### 3.1 Entrada WhatsApp

```text
WhatsApp/Meta
  -> Kapso
  -> POST /api/webhooks/whatsapp
  -> autenticacion, normalizacion, dedup e idempotencia
  -> external_event_log
  -> transactional_outbox
  -> OutboxPublisher
  -> WhatsAppOrchestrationHandler
  -> FinancialOrchestrator
```

Esta frontera es saludable. La entrada externa se persiste antes de ejecutar
trabajo asincrono y el evento se puede reintentar sin duplicar el efecto
financiero.

### 3.2 Ruta interactiva actual

La ruta efectiva puede invocar:

```text
ConversationKernel + memoria
  -> OrchestrationPlanningAgent
  -> compilador de plan
  -> DataAgent
  -> CorrectionAgent, si aplica
  -> RiskSignalAgent / DedupSignalAgent, si aplica
  -> PolicyGate
  -> CommandDispatcher o comando especializado
  -> Core / Domain Engine
  -> ToolGateway
  -> ConversationAgent
  -> ResponsePlanner
  -> ResponseAgent
  -> WhatsAppResponseSender
```

No todos aparecen en cada turno, pero en una pregunta read-only aparentemente
simple de la sesion auditada aparecieron Planner, DataAgent,
ConversationAgent y ResponseAgent, todos secuenciales.

### 3.3 Core y motores deterministas

La capa deterministica cubre correctamente responsabilidades que no deben
delegarse al modelo:

- validacion de movimientos;
- balances y dinero libre;
- deudas, cuotas y pagos;
- recurrentes y `Pagos que vienen`;
- riesgo;
- deduplicacion;
- confirmacion de Pendientes;
- idempotencia;
- audit log;
- transactional outbox;
- eventos y workers;
- privacidad y modo discreto.

El principio correcto sigue siendo:

> La IA propone. El dominio valida. El Core ejecuta. El usuario puede corregir
> o deshacer.

### 3.4 Runtime de agentes

El contrato actual declara 14 agentes:

| Grupo | Agentes |
|---|---|
| Conversacion interactiva | OrchestrationPlanning, Data, Conversation, Correction, Response |
| Captura aislada | EmailExtraction |
| Señales y experiencia | LearningSignal, DedupSignal, RiskSignal, DisclosureExperience, RecurringSignal, NudgeExperience, InsightExperience, InsightNarrator |

El catalogo actual expone 15 tools read-only:

1. `get_balance_snapshot`
2. `query_movements`
3. `get_pending_summary`
4. `get_debt_summary`
5. `get_debt_details`
6. `get_recurring_summary`
7. `search_financial_memory`
8. `get_classification_catalog`
9. `get_pending_details`
10. `get_financial_structure`
11. `get_insights`
12. `get_insight_evidence`
13. `get_record_provenance`
14. `get_user_context_summary`
15. `get_spending_summary`

El arsenal es suficiente. La brecha no es falta de tools; es seleccion,
continuidad, grounding y composicion.

### 3.5 Datos, memoria y referencias

Existen:

- `conversation_memory_state`;
- `ConversationWorkingSet`;
- referencias de movimientos y entidades;
- borradores de captura;
- Pendientes;
- memoria financiera aprendida;
- aliases, personas, preferencias y correcciones;
- trazas por agente, tool y resultado.

El problema es que estas piezas no forman todavia un unico contrato
autoritativo de turno. El sistema distingue memoria persistente y working set,
pero varias rutas consumen solo una representacion parcial.

### 3.6 Estado real del aprendizaje y la personalizacion

El circuito implementado es:

```text
Correccion aplicada y confirmada por el usuario
  -> FinancialOrchestrator
  -> LearningEngine
  -> propuesta deterministica + LearningSignalAgent
  -> LearningPolicyGate
  -> learning_candidates
  -> financial_memory_items
  -> search_financial_memory / DataContextPack
  -> contexto read-only para turnos futuros
```

La estructura es conceptualmente correcta:

- `LearningSignalAgent` solo propone candidatos.
- `LearningPolicyGate` decide de forma deterministica si se observan, requieren
  confirmacion o pueden promoverse.
- La memoria confirmada conserva evidencia, confianza, sensibilidad,
  expiracion y estado de confirmacion.
- DataAgent recibe `learned_vocabulary` con aliases y patrones de correccion
  relevantes para el mensaje actual.
- ConversationAgent puede consultar memoria confirmada mediante
  `search_financial_memory` o `get_user_context_summary`.
- Ningun agente puede escribir memoria directamente ni tratarla como permiso
  para ejecutar dinero.

Sin embargo, la cobertura real es mucho menor que la amplitud del schema:

- el unico productor conectado a `LearningEngine` es una correccion financiera
  confirmada por WhatsApp;
- `explicit_user_statement`, `explicit_feedback` y `repeated_behavior` existen
  en contratos y politica, pero no tienen un pipeline general que los produzca;
- `preference`, `alias`, `person_context` y `narrative_fact` se pueden guardar y
  buscar, pero no cuentan con una ingestion completa de uso cotidiano;
- las eliminaciones no se aprenden, correctamente, porque borrar un registro no
  demuestra una preferencia;
- `getFrequentPeople` devuelve las cinco personas actualizadas mas
  recientemente; no calcula frecuencia real;
- el estilo conversacional persistente funciona solo desde una peticion
  explicita del usuario, no como inferencia automatica;
- las pistas bancarias enmascaradas se aprenden solo si el usuario pide
  recordarlas o establece explicitamente la asociacion. Una seleccion puntual
  no autoriza aprendizaje.

Comprobacion read-only de la base real al 24 de julio de 2026:

| Evidencia | Resultado |
|---|---:|
| `financial_memory_items` | 0 |
| `learning_candidates` | 0 |
| usuarios con estilo persistente | 0 |
| cuentas con pistas email aprendidas explicitamente | 0 |
| personas relacionadas con aliases | 0 |
| campos auditados como corregidos | 7 |

Los siete campos corregidos pertenecen a una sola correccion del 14 de julio,
anterior al despliegue del Learning Engine. Por eso el cero actual no demuestra
que el codigo falle, pero tampoco permite afirmar que el producto ya aprende en
produccion.

El estado correcto es:

> Manzana tiene memoria conversacional, preferencias explicitas y una
> infraestructura segura para aprender de correcciones confirmadas. Todavia no
> tiene aprendizaje integral del usuario funcionando y validado en produccion.

Hay además un riesgo de runtime confirmado: Production no declara
`AGENT_RUNTIME_LEARNING_SIGNAL_AGENT_PROVIDER`. El agente hereda el default
global, cuyo valor efectivo no es visible por CLI y para el que no existe
readiness. Por tanto no puede certificarse que Learning use API ni que quede
fuera del fallback local.

---

## 4. Lo que las conversaciones reales demostraron

### 4.1 “Cuanto gasto en alimentacion normalmente”

Respuesta observada:

- tomo cinco movimientos recientes;
- sumo S/68;
- reconocio que no tenia un periodo suficiente para hablar de “normalmente”.

Problema:

- `DataAgent` detecto correctamente una ambiguedad de periodo;
- el flujo no uso esa ambiguedad para pedir una aclaracion;
- `get_spending_summary` devolvio grupos, cantidad y total, pero elimino del
  resultado final los movimientos e IDs que originaron ese resumen.

Consecuencia:

- la primera respuesta parece razonable;
- el sistema no deja un `focus_set` exacto para las preguntas siguientes;
- el usuario cree que Manzana recuerda “esos cinco”, pero internamente ya no
  existe esa misma lista como objeto visible y autoritativo.

Causa en codigo:

- `getSpendingSummary` llama internamente a `queryMovements`, pero devuelve
  solo agregados en `src/core/conversation/tool-gateway.ts:907`.
- `extractReferencedMovements` solo extrae resultados cuya tool visible sea
  `query_movements` en
  `src/core/conversation/conversation-memory.ts:423`.

### 4.2 “De donde sale que gaste 68”

Esta respuesta fue correcta:

- consulto cinco gastos de Alimentacion;
- mostro sus montos y fechas;
- la suma dio S/68.

Esto prueba que las tools y los datos pueden responder bien. No prueba que el
estado conversacional posterior quede bien enlazado.

### 4.3 “Que dias de la semana caen”

El sistema pidio que el usuario repitiera fechas concretas.

Problema:

- la frase era una referencia inmediata a la lista anterior;
- no debia convertirse en un tema nuevo;
- el kernel local reconoce “fecha”, “cuando” y “cada uno”, pero no el concepto
  semantico “dias de la semana”.

Causa:

- la continuidad sigue dependiendo parcialmente de patrones en
  `src/core/conversation/conversation-kernel.ts:280`.
- el planner no recibio un `focus_set` exacto que obligara a interpretar la
  pregunta respecto de los cinco movimientos visibles.

### 4.4 “De los 5 gastos que dias de la semana caen”

El sistema incluyo un Taxi y omitio uno de los cafes.

Esta es la falla mas importante de la secuencia. No fue solo una mala frase:

1. el turno de aclaracion no uso `query_movements`;
2. la memoria superior guardo `referenced_movements=[]`;
3. el working set podia conservar referencias anteriores, pero ToolGateway
   consulta la lista superior para decidir continuidad;
4. sin IDs activos, `query_movements` recupero movimientos recientes;
5. el modelo eligio cinco de una lista mayor y los presento como “los cinco”.

Se violaron dos invariantes que deberian existir:

- “los N” debe enlazar con el ultimo conjunto visible de N elementos;
- ningun elemento puede aparecer en la respuesta si no pertenece al
  `focus_set` o a una tool ejecutada expresamente para ampliar ese conjunto.

### 4.5 “Taxi? eso no viene a ser alimentacion?”

El sistema interpreto la protesta como una solicitud para reclasificar el Taxi.

El usuario no estaba corrigiendo el movimiento financiero. Estaba corrigiendo
la respuesta de Manzana: el Taxi nunca debio ser incluido en la lista de
Alimentacion.

La arquitectura mezcla dos clases distintas:

- `assistant_answer_repair`: Manzana interpreto o explico mal;
- `financial_record_correction`: el dato persistido esta mal.

Solo la segunda debe activar `CorrectionAgent`, confirmacion y una posible
escritura.

### 4.6 “Me refiero a que me muestres los gastos de alimentacion...”

El planner agrego “esta semana”, aunque el usuario no expreso ningun periodo.
La consulta devolvio cero.

Causa:

- `validateSemanticQuery` comprueba formato, orden y duracion maxima del rango;
- no comprueba de donde salio el rango;
- el schema no tiene procedencia de slots.

Un rango temporal necesita:

```ts
{
  value: DateRange,
  provenance: "explicit" | "inherited" | "default",
  evidence_ref: string | null
}
```

Si la procedencia no es explicita ni heredada de un turno vigente, el
compilador debe eliminar el rango o exigir aclaracion. Una fecha inventada no
se vuelve valida por tener ISO correcto.

### 4.7 “Juan me presto 100 soles, le voy a pagar en 5 cuotas”

El sistema dijo que creo una deuda pendiente y que las cinco cuotas quedaron
pendientes. Cuando el usuario confirmo, respondio que faltaban datos
financieros y no pudo completar.

La fila inspeccionada contenia:

- monto S/100;
- movimiento propuesto `deuda_adquirida`;
- `related_person_id=null`;
- `debt_id=null`;
- el dato de cinco cuotas solo en evidencia textual;
- razones de politica que exigian motor especializado y confirmacion.

El problema no es que Core haya bloqueado una escritura incompleta. Ese bloqueo
fue correcto. El problema es que la experiencia vendio el objeto como un
Pendiente confirmable cuando el payload no podia confirmar una deuda.

Causas en codigo:

- `DebtHint` no modela creacion de deuda ni un plan nuevo de cuotas en
  `src/agents/data-agent/types.ts:38`.
- `buildMovementInput` descarta persona y deuda en
  `src/core/orchestrator/data-action-policy.ts:716`.
- `buildPendingInputFromDataAction` persiste el movimiento generico, no un
  `CreateDebtDraft`, en
  `src/core/orchestrator/data-action-pending.ts:103`.
- la confirmacion generica acepta gasto, ingreso y devolucion; rechaza
  `deuda_adquirida` sin motor especializado en
  `src/core/pending/confirm-pending.ts:781`.

La documentacion de deudas si define el caso:

- monto + persona bastan para una deuda personal;
- cantidad de cuotas forma parte del minimo de una compra/plan en cuotas;
- los drafts son validos si falta informacion;
- Debt Engine, no un movimiento generico, debe crear la deuda y sus cuotas.

La implementacion de pagos de deuda es especializada y segura. La creacion de
deuda desde WhatsApp no tiene aun un contrato equivalente.

---

## 5. Hallazgos priorizados

### P0 — Bloqueantes de calidad o contrato

#### P0.1 `local_fixture` puede sustituir IA real en produccion

Evidencia:

- `readAgentRuntimeConfig` usa `local_fixture` como default si falta
  configuracion.
- `fallbackToLocal` tiene default `true`.
- `RuntimeRouter` captura errores de API y ejecuta el fixture de forma
  transparente.
- `.env.local.example` propone
  `AGENT_RUNTIME_DEFAULT_PROVIDER=local_fixture` y
  `AGENT_RUNTIME_FALLBACK_LOCAL=true`.
- Production contiene claves para default, fallback, modelo y overrides de los
  cinco agentes centrales; los valores sensibles no pueden auditarse mediante
  `vercel env run` fuera del build;
- el ledger afirma API para Planner, Data, Conversation, Correction y Response,
  pero no hay endpoint de readiness que lo contraste con el deployment actual;
- EmailExtraction tiene evidencia de provider API en las trazas de Gate F;
- `WHATSAPP_SEND_RESPONSES=true`, así que la selección local no queda confinada
  a un entorno sin tráfico;
- Production no tiene provider explícito para `RiskSignalAgent`.
- una traza humana revisada muestra
  `risk_signal_agent_provider=local_fixture`.

Dictamen:

`local_fixture` es valido para tests y desarrollo. No es un modo degradado
aceptable de comprension en produccion. Una respuesta deterministica limitada
puede ser un fallback de producto; un fixture que imita a la IA no.

#### P0.2 No existe `focus_set` visible y autoritativo

El conjunto exacto mostrado al usuario debe persistirse con:

- IDs;
- orden visible;
- filtros y periodo usados;
- tool y trace que lo produjeron;
- expiracion;
- hash/version de la respuesta.

Hoy se guardan referencias, pero una tool agregada o un turno intermedio puede
vaciar o desalinear la representacion consumida.

#### P0.3 Los slots semanticos no tienen procedencia

Fechas, categorias, cuentas, personas, IDs y cantidades deben declarar si
provienen del mensaje, de memoria activa, de una tool o de un default permitido.
Sin esa procedencia, el compilador valida sintaxis, no verdad.

#### P0.4 No existe invariante de grounding para cada afirmacion

Montos, conteos, categorias, fechas y entidades de la respuesta necesitan
`evidence_refs`. La respuesta “los cinco” no debio aprobarse porque el Taxi no
pertenecia a la evidencia que originaba S/68.

#### P0.5 Se crean Pendientes que no son realmente confirmables

Todo Pendiente presentado con “Confirmar” debe compilar a un comando de dominio
valido con los datos existentes. Si falta un dato:

- crear `draft` con slots faltantes y una pregunta minima; o
- crear un Pendiente de revision, nunca afirmar que esta listo para confirmar.

#### P0.6 Reparar una respuesta se confunde con corregir dinero

Se requiere un objetivo separado `assistant_answer_repair`. Debe reconstruir la
evidencia y corregir la explicacion sin tocar el registro financiero.

### P1 — Arquitectura y operacion

#### P1.1 Exceso de handoffs LLM en la ruta interactiva

Una consulta simple puede pagar cuatro interpretaciones:

1. Planner decide el flujo.
2. DataAgent vuelve a interpretar el mensaje.
3. ConversationAgent decide como usar la evidencia.
4. ResponseAgent vuelve a redactar.

Mas agentes no significa mas inteligencia. Aqui aumenta:

- latencia;
- costo;
- puntos de inconsistencia;
- compresion de contexto;
- dificultad para saber quien tuvo la autoridad final.

#### P1.2 `FinancialOrchestrator` concentra demasiadas decisiones

El documento rector dice que no debe ser una funcion gigante. El archivo
actual supera dos mil lineas y conoce agentes, repositorios, memoria,
Pendientes, pagos de deuda, tools, respuestas y telemetria.

No es necesario eliminar el coordinador. Es necesario convertirlo en una
maquina de estados pequeña que ejecute un `TurnPlan` tipado y delegue handlers
de dominio.

#### P1.3 La ambiguedad se detecta y luego se ignora

En “normalmente”, DataAgent detecto el periodo faltante, pero la ruta read-only
continuo. Una ambiguedad no sirve si no gobierna la ejecucion.

#### P1.4 El contrato de tools pierde evidencia util

`get_spending_summary` necesita devolver:

- agregados;
- IDs de movimientos fuente;
- orden;
- periodo;
- filtros;
- exclusiones;
- cobertura y limites.

El resumen no debe destruir la trazabilidad de sus componentes.

#### P1.5 La evaluacion conversacional da una confianza mayor a la real

El corpus de 200 mensajes:

- comprueba cantidad, unicidad y familias;
- ejecuta casos aislados;
- en el baseline solo exige que `semanticMatches > 0`, no que cada caso cumpla;
- inyecta un estado activo sintetico para follow-ups;
- no reproduce la persistencia real entre turnos;
- no valida la lista exacta visible;
- no consulta datos reales para verificar precision de la respuesta.

El API smoke multivuelta tambien preconstruye el `workingSet`; no demuestra que
el primer turno real lo haya persistido correctamente.

#### P1.6 Los smokes de provider observan solo una parte de los agentes

El auditor de deuda califica principalmente DataAgent y ResponseAgent. Un
turno puede aprobar ese gate mientras RiskSignalAgent, Planner u otro agente
usa fixture o fallback.

### P2 — Deuda tecnica y deriva documental

#### P2.1 El catalogo conceptual supera la implementacion efectiva

Los documentos describen Experience Engine, ChangeDetection,
MicroReconstruction, NarrativeMemory y otros componentes como una arquitectura
rica. Parte existe como motores o contratos; parte es objetivo conceptual.

El inventario debe marcar cada pieza como:

- activa en la ruta;
- implementada pero asincrona;
- implementada solo como señal;
- contrato/documentacion;
- propuesta futura.

#### P2.2 Hay tres fuentes de autoridad conversacional

Compiten:

- planner semantico;
- kernel/router deterministico;
- DataAgent.

Los documentos dicen que el planner es autoridad y los demas fallback, pero el
flujo real todavia usa sus resultados para desviar, completar o reinterpretar
la ruta.

#### P2.3 ResponseAgent puede degradar una respuesta ya fundamentada

Cuando ConversationAgent ya tiene hechos y copy correcto, una reescritura
adicional aporta poco. Las plantillas deterministas y el formateador de canal
deben cubrir confirmaciones simples. El agente de respuesta solo debe
participar en narrativas de alto valor.

---

## 6. Scorecard

Escala heuristica de 0 a 10, basada en documentos, codigo, pruebas y trazas
revisadas:

| Dimension | Nota | Lectura |
|---|---:|---|
| Seguridad financiera | 8.5 | Core, PolicyGate, comandos, idempotencia y outbox son fuertes. |
| Durabilidad de canal/eventos | 8.0 | Webhook, log externo y outbox estan bien separados. |
| Separacion Pending/confirmado | 8.5 | La regla existe y se respeta; falla el copy de confirmabilidad. |
| Continuidad conversacional | 3.5 | El estado existe, pero no conserva siempre el conjunto visible exacto. |
| Grounding y explicabilidad | 4.0 | Hay tools y trazas, pero faltan claims enlazados a evidencia. |
| Simplicidad arquitectonica | 4.0 | Demasiados handoffs y coordinador demasiado ancho. |
| Higiene de runtime en produccion | 2.5 | Fixture/fallback siguen permitidos y observados. |
| Calidad de evaluacion | 4.5 | Mucha cobertura estructural, poca fidelidad multivuelta con datos reales. |
| Observabilidad | 7.5 | Las trazas permitieron encontrar causas; los gates no cubren todos los agentes. |
| Honestidad UX | 4.5 | Algunas respuestas prometen continuidad o confirmabilidad que el payload no posee. |
| Aprendizaje y personalizacion | 3.5 | El pipeline de correcciones existe, pero no hay memoria real promovida ni productores generales de preferencias, aliases o comportamiento repetido. |

**Resultado global aproximado: 5.6/10.**

No significa que el producto este “a la mitad”. Significa que la base financiera
es buena, pero la capa que el usuario percibe como inteligencia no convierte
esa base en una conversacion confiable.

---

## 7. Arquitectura objetivo recomendada

### 7.1 Decision

No usar:

- un solo agente autonomo con acceso a dinero;
- un enjambre de agentes que negocian entre si;
- un Planner LLM que encarga tareas a otros tres LLMs en cada mensaje.

Usar:

```text
Canal + Event Gateway
  -> TurnCoordinator deterministico
  -> TurnWorkspace
  -> ConversationalExecutiveAgent
       <-> ToolGateway read-only
  -> EvidenceAndPolicyCompiler
  -> Domain Command Handler, solo si aplica
  -> Core / Domain Engine
  -> ChannelPresenter
  -> Outbox / respuesta
```

### 7.2 `TurnCoordinator`

Responsabilidades:

- cargar estado y permisos;
- construir `TurnWorkspace`;
- invocar el agente cabeza;
- ejecutar tools autorizadas;
- compilar propuestas;
- aplicar PolicyGate;
- despachar un comando especializado;
- persistir el nuevo estado;
- enviar el resultado.

No interpreta lenguaje financiero por regex. No redacta. No conoce cada
repositorio de dominio directamente.

### 7.3 `TurnWorkspace`

Contrato minimo:

```ts
type TurnWorkspace = {
  turn_id: string;
  user_message: string;
  received_at: string;
  timezone: string;
  active_goal: string | null;
  focus_set: {
    kind: string;
    ordered_refs: string[];
    source_tool_call_id: string;
    filters: Record<string, unknown>;
    expires_at: string;
  } | null;
  unresolved_slots: Array<{
    name: string;
    required_for: string;
    current_value: unknown;
    provenance: "explicit" | "inherited" | "tool" | "default";
    evidence_ref: string | null;
  }>;
  pending_operation: {
    kind: string;
    target_ref: string;
    confirmable: boolean;
  } | null;
  recent_claims: Array<{
    claim_id: string;
    value: unknown;
    evidence_refs: string[];
  }>;
  allowed_capabilities: string[];
};
```

### 7.4 `ConversationalExecutiveAgent`

Unifica para la ruta interactiva:

- planificacion semantica;
- captura estructurada;
- consulta y tool calling;
- correccion semantica;
- redaccion final.

Su output:

```ts
type ExecutiveTurnOutput = {
  goal:
    | "query"
    | "capture"
    | "financial_correction"
    | "assistant_answer_repair"
    | "pending_resolution"
    | "help";
  tool_requests: ReadOnlyToolRequest[];
  proposed_domain_actions: ProposedDomainAction[];
  slot_bindings: SlotBinding[];
  focus_set_update: FocusSetUpdate | null;
  response: {
    text: string;
    claims: GroundedClaim[];
    follow_up_question: string | null;
  };
  confidence: number;
};
```

El runtime puede requerir mas de una ronda de function calling, pero sigue
siendo una sola sesion y una sola autoridad semantica.

#### 7.4.1 Autoridad unica no significa fusion fisica

`ConversationalExecutiveAgent` no debe convertirse en:

- un archivo enorme;
- un prompt monolitico que resuelva todo sin estructura;
- una clase que conozca repositorios, PolicyGate y comandos de todos los
  dominios;
- una excusa para eliminar schemas especializados.

Debe ser una **sesion semantica unica** compuesta por modulos y contratos
internos:

```text
ConversationalExecutiveAgent
  |-- TurnInterpreter
  |-- ReferenceResolver
  |-- ToolRequestPlanner
  |-- FinancialProposalComposer
  `-- GroundedResponseComposer
```

Estos nombres representan responsabilidades y pueden vivir en archivos,
schemas y tests separados. La unidad que se busca es la autoridad sobre el
significado del turno, no la cantidad de archivos.

DataAgent y CorrectionAgent pueden desaparecer como llamadas LLM
independientes, pero deben conservarse y evolucionar:

- `ProposedActionSchema`;
- `DebtHintSchema`;
- schemas de correccion;
- validadores de campos financieros;
- resolucion tipada de referencias;
- policy reasons;
- compiladores a comandos de dominio;
- corpus y tests especializados.

El agente cabeza puede producir secciones tipadas equivalentes a esos
contratos. El compilador deterministico sigue validandolas por separado. Esto
reduce handoffs sin diluir especializacion ni seguridad.

### 7.5 `EvidenceAndPolicyCompiler`

Debe rechazar:

- montos sin evidencia;
- “los N” si el focus set no tiene N;
- una categoria que no coincide con los IDs fuente;
- fechas sin procedencia;
- tools declaradas pero no ejecutadas;
- acciones sin comando especializado;
- un Pendiente marcado confirmable sin `confirm_command`;
- copy que diga “registrado” si Core no confirmo;
- copy que diga “creado” si solo existe draft.

Puede solicitar una unica regeneracion con feedback estructurado. Si vuelve a
fallar, usa una aclaracion segura y honesta.

### 7.6 Autoridad financiera

No cambia:

```text
Agente propone
  -> EvidenceAndPolicyCompiler valida
  -> PolicyGate autoriza o exige confirmacion
  -> CommandDispatcher elige comando tipado
  -> Core/Domain Engine ejecuta
  -> respuesta usa el resultado real del Core
```

### 7.7 Componentes que permanecen separados

| Componente | Decision |
|---|---|
| EmailExtractionAgent | Mantener separado por aislamiento, prompt injection, privacidad y grounding literal. |
| InsightNarratorAgent | Opcional y asincrono; solo sobre insights ya validados. |
| LearningSignalAgent | Mantener separado y event-driven. Solo propone candidatos desde evidencia; nunca escribe memoria. |
| Signal agents | Aplicar arquitectura hibrida: deteccion/reglas deterministas y modelo solo para ambiguedad semantica real. |
| ResponseAgent | Retirar de confirmaciones simples; conservar temporalmente para narrativas complejas durante migracion. |
| DataAgent/CorrectionAgent/ConversationAgent/Planner | Eliminar progresivamente como llamadas LLM separadas, conservando sus schemas, validadores, compiladores y tests como modulos internos. |

### 7.8 Arquitectura objetivo de aprendizaje

El learning no debe ocurrir dentro de la llamada interactiva como una mutacion
del agente cabeza. Debe nacer de resultados confirmados y eventos de dominio:

```text
Resultado confirmado por Core
  -> evento de dominio con evidence_ref
  -> LearningEngine
  -> detectores deterministas generan candidatos base
  -> LearningSignalAgent propone significado semantico adicional
  -> LearningPolicyGate valida evidencia, sensibilidad y contradicciones
  -> memoria observada / pendiente / confirmada / suspendida
  -> outbox y auditoria
```

Durante una conversacion:

```text
ConversationalExecutiveAgent
  -> solicita search_financial_memory read-only
  -> ToolGateway filtra por usuario, vigencia, sensibilidad y relevancia
  -> agente usa memoria como contexto
  -> EvidenceAndPolicyCompiler impide tratarla como permiso financiero
```

#### 7.8.1 Memoria de sesion y aprendizaje permanente

No deben mezclarse:

| Capa | Contenido | Duracion | Escritura |
|---|---|---|---|
| Memoria de turno | focus set, claims, tools y slots | Turno | TurnCoordinator |
| Memoria de sesion | objetivo activo, estilo de sesion, operacion incompleta | Horas/dias segun flujo | TurnCoordinator |
| Preferencia explicita | tono, horario, privacidad, alias solicitado | Hasta revocacion/expiracion | Servicio deterministico |
| Aprendizaje candidato | patron o significado aun no estable | Hasta reunir evidencia o expirar | LearningEngine |
| Memoria confirmada | hecho/preferencia respaldado por politica | Segun tipo y vigencia | LearningPolicyGate |

El agente cabeza puede leer las cinco capas segun permisos, pero no promover
ninguna por si mismo.

#### 7.8.2 Estados canonicos de una memoria

El modelo objetivo debe representar explicitamente:

```text
session_only
observed
pending_confirmation
confirmed
suspended
revoked
expired
superseded
rejected
```

Reglas:

- `observed`: evidencia insuficiente; no personaliza decisiones importantes.
- `pending_confirmation`: informacion sensible o de alto impacto que necesita
  consentimiento explicito.
- `confirmed`: puede incorporarse al contexto dentro de su alcance.
- `suspended`: existe evidencia contradictoria; no se usa hasta resolverla.
- `revoked`: el usuario pidio olvidar o corregir.
- `expired`: supero su vigencia.
- `superseded`: una memoria mas nueva y confirmada la reemplazo.
- `rejected`: la politica concluyo que no debe aprenderse.

Los estados actuales `observed`, `pending_confirmation`, `accepted`,
`rejected` y `superseded` deben migrarse o mapearse a este contrato sin perder
auditoria.

#### 7.8.3 Acumulacion y contradiccion de evidencia

Cada candidato necesita:

- `evidence_refs` idempotentes;
- evidencia a favor y evidencia en contra;
- tipo de fuente;
- fecha y vigencia;
- alcance: comercio, persona, categoria, canal o preferencia global;
- sensibilidad;
- confianza calculada por politica;
- memoria contradicha o reemplazada.

Una repeticion del mismo evento no aumenta confianza. Una correccion posterior
puede reducirla, suspender la memoria o reemplazarla. Una sola inferencia del
modelo nunca crea memoria estable.

La politica sugerida:

- declaracion explicita del usuario: evidencia fuerte, salvo sensibilidad;
- correccion confirmada: evidencia fuerte y acotada al sujeto corregido;
- feedback explicito: evidencia fuerte sobre la experiencia, no necesariamente
  sobre un hecho financiero;
- comportamiento repetido: exige umbral por tipo y ventanas temporales
  distintas;
- inferencia semantica: solo propone significado, nunca decide promocion.

#### 7.8.4 Confianza, expiracion y sensibilidad

La confianza no es la autoconfianza del modelo. Debe derivarse de:

- cantidad de evidencias unicas;
- calidad de la fuente;
- recencia cuando aplique;
- consistencia;
- confirmacion del usuario;
- contradicciones;
- alcance.

No toda memoria debe decaer igual:

- un estilo o preferencia puede mantenerse hasta cambio o revocacion;
- un patron de comercio debe suspenderse si aparecen correcciones
  contradictorias;
- un hecho narrativo temporal debe expirar;
- un alias confirmado suele ser estable, pero siempre revocable;
- salud, deuda, relaciones personales y otra informacion sensible requieren
  confirmacion explicita antes de persistencia o uso amplio.

#### 7.8.5 Derecho a ver, corregir y olvidar

El usuario debe poder preguntar:

```text
Que recuerdas de mi?
Por que aprendiste eso?
No recuerdes mas ese alias.
Eso ya no es asi.
Olvida mis preferencias de estilo.
```

Se requiere una superficie en WhatsApp y Dashboard para:

- listar memorias por tipo y alcance;
- mostrar resumen y fuente comprensible;
- corregir;
- revocar;
- olvidar;
- suspender aprendizaje opcional si producto lo permite.

Olvidar debe revocar o eliminar segun politica de privacidad, retirar la memoria
de Context Packs y dejar solo la auditoria minima legalmente permitida.

#### 7.8.6 Reality check actual

La arquitectura objetivo de esta auditoria estaba aproximadamente al 90% como
direccion conceptual: autoridad semantica unica, tools read-only y Core
deterministico eran correctos. La principal especificacion insuficiente era el
learning.

La definicion general del learning estaba aproximadamente al 70-75%:

- contratos, tablas, gate, agente de señal y lectura existen;
- falta el ciclo operacional para fuentes distintas de correcciones;
- faltan contradiccion, suspension, expiracion por tipo, gestion del usuario y
  QA real de reutilizacion;
- falta un provider API explicito y la prohibicion de fixture;
- falta demostrar `correccion -> memoria -> siguiente turno mejor`.

### 7.9 Arquitectura hibrida de señales

No todas las señales deben convertirse en motores puramente deterministas.
La separacion correcta es por naturaleza de la decision.

Determinismo directo:

- deduplicacion exacta por IDs o source refs;
- umbrales y limites de riesgo;
- consentimiento y permisos;
- frecuencia y ventanas de recurrentes;
- expiraciones;
- caps de mensajes;
- idempotencia;
- estados y transiciones.

Comprension semantica acotada:

- si dos descripciones significan lo mismo;
- si una correccion declara un alias;
- si el usuario expresa una preferencia persistente;
- si una frase contiene contexto personal sensible;
- si dos movimientos parecen conceptualmente relacionados;
- si un cambio de lenguaje contradice una memoria previa.

Pipeline recomendado:

```text
Motor determinista detecta candidatos
  -> si la evidencia es exacta, politica decide sin LLM
  -> si existe ambiguedad semantica, SignalAgent propone interpretacion
  -> politica determinista valida evidencia, alcance y accion
  -> Core o memoria se actualizan solo por la ruta autorizada
```

El SignalAgent no debe entrar automaticamente en cada turno. Se invoca solo en
la zona incierta, con Context Pack minimo, sin tools de escritura y fuera de la
ruta critica cuando el resultado pueda procesarse asincronamente.

---

## 8. Politica obligatoria para `local_fixture`

### 8.1 Permitido

- tests unitarios;
- tests de integracion controlados;
- desarrollo local;
- demos explicitamente marcadas;
- fixtures de resultados financieros read-only dentro de un test;
- snapshots reproducibles.

### 8.2 Prohibido

- provider por defecto en Production;
- fallback silencioso de un agente real;
- generar una respuesta que el usuario pueda confundir con IA real;
- evaluar calidad linguistica de produccion;
- decidir riesgo, clasificacion, continuidad o copy de un usuario real.

### 8.3 Configuracion objetivo

```text
Production:
  AGENT_RUNTIME_DEFAULT_PROVIDER=api
  AGENT_RUNTIME_FALLBACK_LOCAL=false
  ALLOW_LOCAL_FIXTURE=false

Development/Test:
  ALLOW_LOCAL_FIXTURE=true
```

Guardas requeridas:

1. El proceso no inicia en `production` si el default es `local_fixture`.
2. El proceso no inicia en `production` si `FALLBACK_LOCAL=true`.
3. `LocalFixtureAgentRuntime` no se registra en el router de produccion.
4. Cada agente activo debe tener provider efectivo resuelto en readiness.
5. Deployment smoke exige cero agentes sin provider API aprobado.
6. Una traza `provider=local_fixture` en produccion es incidente, no warning.

### 8.4 Modo degradado correcto

Si la API falla:

```text
persistir evento
  -> no mutar dinero basandose en fixture
  -> reintento acotado si es seguro
  -> respuesta deterministica honesta
  -> "No pude revisarlo bien ahora. No hice ningun cambio."
  -> alerta y metrica
```

Para una escritura que Core ya ejecuto antes de fallar la redaccion, usar el
resultado real del Core y una plantilla deterministica. No revertir ni fingir.

---

## 9. Plan de migracion por cortes

### Corte A — Cerrar riesgos P0 sin cambiar aun el numero de agentes

1. Prohibir `local_fixture` en produccion.
2. Introducir `focus_set` y persistir los IDs exactos de toda lista mostrada.
3. Hacer que `get_spending_summary` conserve sus movimientos fuente.
4. Agregar procedencia a fecha, categoria, cuenta, persona y cantidad.
5. Separar `assistant_answer_repair` de `financial_record_correction`.
6. Reemplazar el Pendiente falso de creacion de deuda por:
   - comando especializado confirmable; o
   - draft honesto con slots faltantes.
7. Agregar regresiones exactas para las conversaciones auditadas.

Este corte debe ejecutarse primero aunque luego se unifiquen agentes.

### Corte B — Contrato unico de evidencia

1. Crear `TurnWorkspace`.
2. Crear claims con `evidence_refs`.
3. Agregar `EvidenceAndPolicyCompiler`.
4. Validar numeros, conteos, fechas, categorias y entidades.
5. Hacer que el presenter solo use claims aprobados.

### Corte B2 — Learning gobernado y verificable

1. Declarar provider API explicito para `LearningSignalAgent` y prohibir
   fixture.
2. Separar memoria de sesion, candidatos y memoria confirmada.
3. Incorporar estados `suspended`, `revoked` y `expired`.
4. Modelar evidencia a favor, contradicciones y reemplazos.
5. Conectar productores para:
   - declaraciones explicitas;
   - feedback explicito;
   - comportamiento repetido;
   - correcciones confirmadas.
6. Implementar consulta, explicacion, correccion y olvido de memoria.
7. Ejecutar un E2E real:
   - registrar;
   - corregir y confirmar;
   - comprobar candidato y memoria;
   - enviar un caso equivalente;
   - verificar que el aprendizaje mejora el resultado;
   - revocar la memoria;
   - comprobar que deja de utilizarse.

### Corte C — Agente cabeza en shadow

1. Implementar `ConversationalExecutiveAgent` detras de feature flag.
2. Ejecutarlo en shadow sobre conversaciones reales consentidas.
3. Comparar:
   - objetivo;
   - tools;
   - focus set;
   - claims;
   - respuesta;
   - latencia;
   - costo;
   - correcciones del usuario.
4. No permitir escrituras desde la ruta shadow.

### Corte D — Migracion progresiva

Orden:

1. consultas read-only;
2. reparacion de respuestas;
3. captura simple;
4. correcciones financieras;
5. flujos mixtos;
6. resolucion de Pendientes;
7. creacion de deuda especializada.

Cada paso conserva Core y PolicyGate.

### Corte E — Retiro de handoffs antiguos

Cuando la ruta nueva supere los gates:

- retirar Planner separado de la ruta interactiva;
- retirar ConversationAgent separado;
- retirar ResponseAgent de respuestas simples;
- absorber Data/Correction como schemas/modos;
- dividir `FinancialOrchestrator` en handlers de turno y dominio;
- conservar adaptadores temporales solo mientras existan trazas que los usen.

---

## 10. Quality gates obligatorios

### Runtime

- 0 trazas `local_fixture` en produccion.
- 0 fallbacks silenciosos.
- 100% de agentes activos con provider efectivo declarado.

### Conversacion

- 100% de fidelidad del `focus_set` en pruebas.
- 0 fechas, cuentas, categorias o personas sin procedencia.
- 100% de afirmaciones numericas con evidencia.
- 0 elementos ajenos en listas referenciadas.
- tasa de follow-up que pierde contexto menor a 2%.
- tasa de reparacion convertida erroneamente en correccion financiera: 0%.

### Pendientes y Core

- 100% de Pendientes con boton Confirmar tienen comando compilable.
- 0 drafts presentados como confirmables.
- 0 mutaciones desde Pending sin confirmacion y Core.
- 0 pagos de deuda por movimiento generico.
- 0 deudas creadas solo como `deuda_adquirida` sin entidad Debt cuando el
  usuario pidio una deuda.

### Aprendizaje y personalizacion

- 0 memorias promovidas sin evidencia confirmada o umbral de politica.
- 0 memorias sensibles persistidas sin confirmacion explicita.
- 0 eventos duplicados que aumenten artificialmente `evidence_count`.
- 100% de memorias usadas con `evidence_ref`, vigencia y alcance validos.
- 100% de contradicciones suspenden o recalculan la memoria afectada.
- 100% de solicitudes de olvidar dejan de aparecer en Context Packs.
- 0 escrituras de memoria directas desde agentes.
- 0 `local_fixture` en LearningSignalAgent de produccion.
- E2E `correccion -> memoria -> reutilizacion -> revocacion` aprobado.

### Latencia y costo

- registro simple WhatsApp p95 menor a 3 s;
- consulta simple p95 menor a 5 s;
- media de invocaciones LLM por turno interactivo menor o igual a 1.3;
- tool calls solo cuando aportan evidencia;
- costo medido por conversacion resuelta, no por llamada.

### Evaluacion

El nuevo corpus debe incluir:

- conversaciones completas, no solo mensajes;
- persistencia real entre turnos;
- fixtures financieros con IDs y orden;
- respuestas esperadas por hechos, no copy exacto;
- perturbaciones de lenguaje peruano;
- cambio de tema y retorno;
- reparacion del asistente;
- creacion y pago de deuda;
- ausencia de datos;
- provider y fallback;
- simulacion de timeout en cada punto;
- replay de transcripciones humanas anonimizadas.

Cada conversacion debe fallar si:

- se altera el conjunto visible;
- se agrega un filtro no expresado;
- cambia el periodo;
- se afirma una tool no ejecutada;
- el copy contradice Core;
- un Pending no puede confirmarse.

---

## 11. Casos de regresion nacidos de esta auditoria

### Caso 1 — Promedio sin periodo

```text
U: cuanto gasto en alimentacion normalmente?
```

Esperado:

- si el historial no permite patron, explicar cobertura;
- mostrar periodo exacto usado;
- preguntar una sola vez si necesita elegir periodo;
- no llamar “normal” a una muestra reciente.

### Caso 2 — Explicacion y follow-up de lista

```text
U: de donde sale ese total?
M: [cinco movimientos]
U: que dias de la semana caen?
```

Esperado:

- usar exactamente los cinco IDs;
- conservar el orden;
- responder el dia de cada uno;
- no pedir repetir fechas.

### Caso 3 — Protesta por elemento incorrecto

```text
U: Taxi? eso no viene a ser alimentacion?
```

Esperado:

- reconocer que Taxi no debio aparecer;
- reparar la respuesta;
- no ofrecer reclasificar si el movimiento ya era Transporte;
- no tocar Core.

### Caso 4 — Sin periodo inventado

```text
U: muestrame esos gastos de alimentacion con su dia de semana
```

Esperado:

- heredar `focus_set`;
- no agregar “esta semana”;
- no convertir S/68 en S/0.

### Caso 5 — Crear deuda en cuotas

```text
U: Juan me presto 100 soles, le voy a pagar en 5 cuotas
```

Esperado:

- interpretar `i_owe`, persona Juan, principal S/100 y cinco cuotas;
- preguntar solo un dato realmente obligatorio si falta;
- si el dominio permite draft, llamarlo draft;
- al confirmar, crear entidad Debt y calendario mediante comando
  especializado;
- no crear un Pending que solo contiene un movimiento generico.

### Caso 6 — Falla de runtime

Esperado:

- API falla;
- no se ejecuta fixture;
- no se muta dinero por inferencia degradada;
- respuesta honesta o retry acotado;
- traza e incidente visibles.

---

## 12. Que no debe cambiar

La simplificacion conversacional no autoriza debilitar:

- Supabase Auth y RLS;
- External Event Gateway;
- idempotencia de webhooks;
- transactional outbox;
- separacion Pending/Core;
- comandos especializados;
- Debt Engine;
- confirmacion humana;
- privacidad y modo discreto;
- trazabilidad;
- aprendizaje solo desde evidencia confirmada;
- nombres visibles como `Pagos que vienen` y `Descubrimientos`.

La arquitectura objetivo reduce LLMs y handoffs, no controles financieros.

---

## 13. Decision final

La arquitectura actual fue correcta al proteger el dinero con determinismo,
pero llevo demasiado lejos la especializacion de agentes en la conversacion.
La calidad se perdio en las fronteras:

- Planner entendio una cosa;
- DataAgent detecto otra;
- memoria guardo una representacion incompleta;
- ToolGateway consulto un conjunto distinto;
- ConversationAgent reconstruyo;
- ResponseAgent lo volvio a redactar.

Agregar mas agentes haria mas probable ese fallo.

La direccion recomendada es:

1. cerrar inmediatamente fixture, focus set, procedencia, grounding y deuda
   confirmable;
2. introducir un contrato unico de turno y evidencia;
3. migrar a un solo agente semantico cabeza por turno;
4. conservar schemas y validadores especializados aunque se reduzcan llamadas
   LLM;
5. completar el learning event-driven con evidencia, contradiccion,
   sensibilidad, vigencia y derecho a olvidar;
6. usar señales hibridas: semantica para interpretar zonas inciertas y
   politica determinista para decidir;
7. conservar todos los controles financieros deterministas;
8. medir calidad sobre conversaciones completas reales.

La meta no es que Manzana tenga menos archivos o menos nombres de componentes.
La meta es que exista una sola interpretacion semantica del turno, una sola
evidencia autoritativa y una sola ruta segura hacia el dinero.

---

## 14. Brecha de cobertura para una auditoria integral del producto V1

### 14.1 Veredicto sobre el alcance

La objecion es correcta: revisar como Manzana interpreta, consulta, aprende,
decide y ejecuta no equivale a revisar toda la relacion que el producto crea
con el usuario.

Esta auditoria responde con bastante profundidad:

- como entra un turno;
- que agentes lo reinterpretan;
- que tools consultan datos;
- donde vive la autoridad financiera;
- como se conserva o pierde evidencia;
- como se aprende desde correcciones;
- como falla el runtime;
- por que la conversacion real observada perdio inteligencia.

Pero hasta esta ampliacion no respondia con igual profundidad:

- como empieza la relacion con el usuario;
- como llega al primer valor y a activacion fuerte;
- como vuelve en D1, D3, D7, D14 y D30;
- si cada contacto produce claridad, alivio o control;
- si WhatsApp, Dashboard, email y Pendientes cuentan la misma historia;
- si el lenguaje visible es consistente;
- si todos los controles y salidas estan disponibles;
- si los 21 flujos V1 cumplen realmente;
- si las metricas de producto existen y son operables;
- si la privacidad se entiende y se controla desde la experiencia.

Por tanto, el estado correcto es:

> Auditoria de arquitectura IA y calidad conversacional: profunda. Auditoria
> exhaustiva de cumplimiento integral del producto V1: iniciada, no cerrada.

No se debe usar la palabra `integral` para afirmar cumplimiento global hasta
cerrar la matriz descrita a continuacion.

### 14.2 Estados canonicos de auditoria

La auditoria de producto debe usar estados que no mezclen existencia tecnica
con valor demostrado:

| Estado | Significado |
|---|---|
| `Cumple` | Requisito trazado y aprobado en todos los niveles exigidos. |
| `Cumple parcialmente` | Existe una parte, pero faltan capacidades o evidencia. |
| `Solo documentado` | Hay contrato de producto, pero no implementacion localizada. |
| `Bloqueado externo` | La implementacion depende de proveedor, aprobacion o credencial externa. |
| `No localizado` | La auditoria no encontro implementacion ni evidencia suficiente. |
| `No probado` | Hay implementacion, pero no una prueba que demuestre el criterio. |
| `Probado tecnicamente` | Tests, build, migracion o smoke tecnico aprobados. |
| `Validado con usuario` | La experiencia fue observada con usuario real en el canal real. |

`Probado tecnicamente` y `Validado con usuario` son dimensiones de evidencia,
no sinonimos de `Cumple`. Un flujo puede ser tecnicamente correcto y aun ser
confuso, poco util o emocionalmente torpe.

### 14.3 Matriz preliminar de dimensiones

Esta matriz no sustituye la trazabilidad requisito por requisito. Sirve para
impedir que una zona fuerte oculte las zonas todavia no auditadas.

| Dimension | Contrato documentado | Codigo localizado | Prueba/evidencia localizada | Estado preliminar |
|---|---|---|---|---|
| Arquitectura IA y autoridad financiera | Si | Si | Tests, smokes y trazas; tambien fallos reales | Auditada en profundidad, con P0/P1 abiertos |
| Aprendizaje y memoria | Si | Si | Tests tecnicos; cero uso real promovido observado | Cumple parcialmente; no validado con usuario |
| Onboarding inicial | Si | Si | Smoke real, outbox, QA desktop/mobile | Probado tecnicamente; cumple el primer valor |
| Activacion fuerte y retorno temprano | Si | Estados tipados, sin ciclo completo | El ledger excluye `activated_light`, `activated_strong`, `completed` y D1-D7 | Cumple parcialmente |
| Lifecycle y retencion D0-D30 | Si | Candidatos de nudge de lifecycle, inactividad y policy | Tests de `quiet`, `at_risk`, `dormant`, cooldown y canales | Cumple parcialmente; no hay estado canonico D1-D30 ni cohortes demostradas |
| Transformacion emocional | Si | Estado emocional, guidance y politicas de copy | Tests de ansiedad, incertidumbre y frustracion | Probado tecnicamente como adaptacion; resultado emocional no medido |
| Lenguaje de producto | Si | Nombres y copies visibles distribuidos | Sin matriz exhaustiva multicanal | No auditado de extremo a extremo |
| Continuidad WhatsApp/Dashboard/email/Pendientes | Si | Si, en varios caminos | Evidencia live en caminos especificos de email y Pendientes | Cumple parcialmente; no trazado para todos los flujos |
| Uso parcial y progressive disclosure | Si | Disclosure Engine y experiencias sin configuracion total | Pruebas parciales | Cumple parcialmente; no auditado por perfil de uso |
| Control, reversibilidad y derecho a salir | Si | Correccion, descarte, preferencias, pausa, desconexion y eliminacion parcial/localizada | Tests tecnicos en varios controles | Cumple parcialmente; falta matriz de control por estado |
| Ayuda, confusion y recuperacion | Si | Router, Kernel, planes de respuesta y fallbacks | Corpus y tests parciales | Cumple parcialmente; no validado tras fallos repetidos |
| Cobertura de los 21 flujos V1 | Si | Implementacion dispersa | No existe una matriz unica de 21 filas con evidencia | No auditado exhaustivamente |
| Privacidad como experiencia | Si | Modo discreto, consentimientos, desconexion y eliminacion | QA y tests parciales | Cumple parcialmente |
| Consentimiento y proactividad | Si, con documentos de distintas fechas | Gates, opt-in, quiet hours, frecuencia, cohortes y kill switch | Tests y piloto controlado en tipos especificos | Probado tecnicamente en alcance especifico; fuente de verdad global no consolidada |
| Metricas de producto | Eventos y metricas sugeridos | Eventos operativos y metricas de algunos subsistemas | Sin tablero integral, valores actuales, objetivo y owner por metrica | Cumple parcialmente; valor de producto no demostrado |
| Dashboard y estados visuales | Si | Si | QA desktop/mobile en cortes especificos | Cumple parcialmente; no contrastado completo contra los 21 wireflows |

### 14.4 Matriz de trazabilidad obligatoria

El entregable que falta no es otro resumen narrativo. Es una matriz auditable
con una fila por criterio atomico:

| Campo | Contenido obligatorio |
|---|---|
| `requirement_id` | ID estable, por ejemplo `FLOW-07-REF-02`. |
| `dimension` | Onboarding, lifecycle, lenguaje, privacidad, etc. |
| `source_document` | Documento y seccion exacta que gobiernan el requisito. |
| `criterion` | Comportamiento observable, no intencion abstracta. |
| `code_evidence` | Archivo, simbolo, migracion o endpoint que lo implementa. |
| `test_evidence` | Test automatizado, smoke o QA visual que lo prueba. |
| `live_evidence` | Run, traza, captura o dato real, si corresponde. |
| `status` | Uno de los estados canonicos de 14.2. |
| `gap` | Diferencia exacta entre contrato y evidencia. |
| `owner` | Subsistema responsable de cerrar la brecha. |
| `next_gate` | Condicion objetiva para cambiar el estado. |

Reglas:

1. Una referencia a un archivo no demuestra que el criterio cumpla.
2. Un test unitario no demuestra continuidad entre canales.
3. Un smoke con datos controlados no demuestra utilidad sostenida.
4. Una captura visual no demuestra autoridad financiera ni idempotencia.
5. Un evento definido no demuestra que se emita, persista, consulte y use.
6. Un flujo no queda validado con usuario solo porque paso por el numero real;
   debe evaluarse si fue entendido y resolvio la necesidad sin ayuda externa.

### 14.5 Onboarding y activacion

El repositorio y el ledger prueban una primera progresion real:

```text
not_started -> started -> first_value_reached
```

Tambien prueban que:

- iniciar no escribe dinero;
- el primer valor puede venir de movimiento, Pending o deuda;
- la transicion es monotona e idempotente;
- Home ofrece una sola accion principal;
- el primer uso puede ocurrir sin cuenta, categoria o email;
- existe QA desktop/mobile y smoke con eventos.

Pero el mismo ledger excluye expresamente:

- `activated_light`;
- `activated_strong`;
- `completed`;
- retorno D1-D7;
- cohortes y conversion historica con usuarios reales.

Conclusion: el onboarding inicial esta implementado y probado; el journey de
activacion completo no lo esta. La auditoria integral debe medir al menos:

- tiempo real hasta primer valor;
- porcentaje que llega a primer valor;
- segundo uso sin asistencia;
- correccion exitosa del primer dato;
- siguiente paso entendido;
- activacion fuerte por ruta de uso;
- retorno D1 y D7;
- abandono por punto y por canal.

### 14.6 Lifecycle y retencion

`15_retencion_lifecycle.md` define D0, D1, D3, D7, D14, D30 y los estados
`quiet`, `at_risk`, `dormant` y `returned`.

La implementacion localizada es mas avanzada que una simple especificacion:

- `buildLifecycleNudgeDrafts` genera candidatos desde hechos confirmados;
- el repositorio de nudges lo ejecuta junto a recurrentes y cuotas;
- existen estados derivados de inactividad `quiet`, `at_risk` y `dormant`;
- `NudgePolicy` aplica consentimiento, pausas, quiet hours, frecuencia y
  cooldown de reengagement;
- Dashboard y el worker proactivo conservan gates separados.

Sin embargo, eso no equivale al lifecycle completo del usuario:

- no se localizo un estado canonico persistido para D1-D30;
- `returned` no aparece como transicion general persistida;
- activacion fuerte no se calcula como estado operativo;
- no hay cohortes D1/D7/D30 demostradas;
- no hay evidencia de efectividad, fatiga o retorno con volumen real;
- los candidatos de nudge describen una oportunidad de contacto, no el estado
  integral de la relacion.

La arquitectura objetivo debe separar:

```text
LifecycleEvaluator determinista
  -> estado de relacion y transicion auditable
  -> candidato de experiencia
  -> NudgePolicy
  -> canal permitido o silencio
  -> evento de resultado
  -> metrica de retorno/fatiga
```

El silencio tambien es una decision valida y debe quedar trazado.

### 14.7 Transformacion emocional y calidad percibida

La experiencia fuente exige mover al usuario:

```text
confusion -> claridad
culpa -> alivio
ansiedad -> control
desorden -> patron visible
```

El codigo ya estima estados como ansiedad, frustracion e incertidumbre y los
propaga hacia guidance, StylePolicy y ResponseAgent. Eso es una buena
capacidad de entrada.

Lo que no esta demostrado es la salida: que la respuesta realmente produjo
claridad, alivio o control. No basta con incluir la frase `sin culpa`.

Cada conversacion evaluada debe tener una rubrica humana o de juez controlado:

| Criterio | Pregunta de evaluacion |
|---|---|
| Fidelidad | Respondio sobre los datos y el periodo correctos? |
| Continuidad | Entendio referencias como `esos cinco` o `de ahi`? |
| Claridad | El usuario sabe que ocurrio y que sigue? |
| Control | Quedo claro que puede corregir, cancelar o no continuar? |
| Carga | Pidio solo el dato indispensable? |
| Tono | Redujo friccion sin sonar paternalista ni defensivo? |
| Reparacion | Reconocio su error antes de proponer otra accion? |
| Resultado emocional | La respuesta probablemente reduce confusion, culpa o ansiedad? |

La rubrica debe aplicarse a conversaciones completas y a transcripciones
anonimizadas del canal real, no solo a mensajes aislados.

### 14.8 Lenguaje de producto

`12_lenguaje_producto.md` es un contrato transversal, no una guia opcional de
copy. Debe auditarse contra:

- WhatsApp;
- Dashboard;
- Settings;
- Pendientes;
- estados vacios;
- errores;
- botones;
- templates Utility;
- email y consentimiento;
- ayuda y privacidad.

La matriz debe verificar, entre otros:

- `Pagos que vienen` y no una variante tecnica expuesta;
- `Descubrimientos` y no `insights` en UI;
- `Pendientes` solo cuando existe control para revisar, confirmar o rechazar;
- diferencia visible entre registrado, detectado, propuesto y confirmado;
- ningun `S/ 0` presentado como dinero real cuando faltan datos;
- una misma accion con el mismo nombre y consecuencia en todos los canales;
- errores que explican que ocurrio sin culpar al usuario.

Hasta ejecutar ese contraste completo, el lenguaje se considera localizado y
parcialmente probado, no certificado.

### 14.9 Continuidad entre canales

La arquitectura de Core, Pending, outbox y deduplicacion permite continuidad,
y existen caminos reales probados de email a Pending, WhatsApp y Core. Eso es
una fortaleza.

La experiencia integral debe probar ademas, flujo por flujo:

```text
accion en canal A
  -> mismo estado autoritativo
  -> explicacion consistente en canal B
  -> misma capacidad de corregir o salir
  -> sin duplicado ni perdida de contexto
```

Casos minimos:

- registrar por WhatsApp y corregir en Dashboard;
- detectar por email, revisar por WhatsApp y confirmar en Pendientes;
- descartar en WhatsApp y verificar estado en Dashboard;
- pausar un aviso en Settings y comprobar silencio en WhatsApp;
- desconectar Gmail y conservar movimientos ya confirmados;
- resolver una deuda o cuota y verla igual en Home, Deudas y Pagos que vienen;
- cambiar modo discreto y verificar disclosure por canal.

La continuidad tecnica existe en caminos especificos; la continuidad de los
21 flujos no esta todavia certificada.

### 14.10 Uso parcial y progressive disclosure

Manzana documenta que el usuario puede obtener valor sin configurar todo. La
auditoria debe ejecutar rutas independientes:

- solo WhatsApp;
- solo Dashboard;
- solo deudas;
- solo Pendientes de email;
- solo consultas;
- solo registro sin cuenta;
- regreso despues de silencio;
- uso con datos incompletos.

Para cada ruta debe comprobarse:

- que no aparece una configuracion obligatoria innecesaria;
- que la primera accion entrega valor;
- que el siguiente paso es opcional y contextual;
- que la precision limitada se explica;
- que el sistema no inventa saldos, cuentas ni autorizaciones;
- que una capacidad avanzada aparece cuando aporta valor, no antes.

### 14.11 Control, reversibilidad, ayuda y recuperacion

Se localizaron controles reales: correccion financiera, descarte de Pending,
pausa y preferencias de nudges, modo discreto, desconexion de Gmail,
exportacion/eliminacion de cuenta y conservacion de confirmados al desconectar
el canal.

La matriz integral debe cubrir cada estado, no solo la existencia del boton:

- cancelar antes de ejecutar;
- deshacer o corregir despues de ejecutar, si el dominio lo permite;
- eliminar con explicacion del impacto;
- pausar y reanudar;
- rechazar sugerencias;
- olvidar una memoria aprendida;
- cambiar preferencias;
- desactivar proactividad;
- desconectar una fuente;
- ver origen, version actual e historial relevante;
- recuperarse de timeout, dato insuficiente, tool fallida o tres intentos
  conversacionales fallidos.

Debe verificarse tambien que el control use la misma autoridad en WhatsApp y
Dashboard. Un copy que dice `listo` sin cambio de Core es un fallo; un Core que
cambio sin confirmacion visible tambien.

### 14.12 Cobertura de los 21 flujos V1

`14_flujos_usuario_v1.md` y `31_wireflows.md` definen los mismos 21 flujos:

1. registro simple por WhatsApp;
2. registro multiple por WhatsApp;
3. registro manual desde Dashboard;
4. correccion de movimiento;
5. borrar, cancelar o deshacer;
6. Pendientes de email;
7. consulta financiera;
8. busqueda natural en Dashboard;
9. deuda nueva;
10. pago de deuda o devolucion;
11. Pago que viene;
12. recordatorio;
13. Descubrimiento;
14. ayuda y explicacion;
15. modo discreto;
16. reconstruccion con datos incompletos;
17. cuenta o caja desde el uso;
18. clasificacion, subcategorias y etiquetas;
19. transferencia, asignacion interna y ajuste;
20. configuracion y preferencias;
21. detalle, fuente y explicabilidad.

La auditoria actual profundizo en varias partes de 1, 4, 6, 7, 9, 10, 14 y
21, pero eso no autoriza extrapolar cumplimiento a los 21.

Cada flujo debe descomponerse como minimo en:

- entrada feliz;
- dato faltante;
- ambiguedad;
- cancelacion;
- retry;
- conflicto o duplicado;
- continuidad multicanal;
- modo discreto;
- explicabilidad;
- evento y observabilidad;
- QA mobile/desktop cuando exista UI;
- validacion en canal real cuando corresponda.

El resultado debe permitir filtrar por:

- implementado;
- parcial;
- solo documentado;
- bloqueado externo;
- no localizado;
- no probado;
- probado tecnicamente;
- validado con usuario.

### 14.13 Privacidad, consentimiento y proactividad

La privacidad no se agota en RLS o en una pagina legal. Debe sentirse antes,
durante y despues de cada accion sensible.

La arquitectura ya contiene piezas valiosas:

- modo discreto;
- Disclosure Engine y OutputGuard;
- consentimiento versionado;
- opt-in maestro y granular;
- quiet hours;
- frecuencia;
- pausas;
- cohortes;
- kill switch;
- templates Utility;
- desconexion de fuentes;
- eliminacion de cuenta.

La brecha es de consolidacion y prueba transversal:

- que dato se enviara al proveedor antes de consentir;
- que deja de ocurrir al revocar;
- cuanto se conserva y por que;
- que se borra y que debe conservarse por integridad financiera/legal;
- que canal puede mostrar cada nivel de detalle;
- que documento gobierna cuando dos defaults antiguos se contradicen;
- que proactividad esta activa por tipo, canal y cohorte;
- como el usuario ve, pausa o revoca esa decision.

La fuente de verdad operativa debe ser una politica versionada unica. El ledger
vivo describe el estado implementado, pero no debe ser la unica forma de
descubrir el comportamiento actual.

### 14.14 Metricas como evidencia operativa

Para cada metrica de producto no basta con que el nombre exista en un
documento. Debe probarse esta cadena:

```text
evento definido
  -> evento emitido
  -> evento persistido
  -> metrica calculada
  -> tablero o consulta operable
  -> valor actual
  -> objetivo
  -> owner
  -> decision asociada
```

Metricas minimas:

- tiempo a primer valor;
- conversion a `first_value_reached`;
- activacion fuerte;
- retorno D1/D7/D30;
- correcciones por primer uso;
- conversaciones resueltas sin repeticion;
- aclaraciones evitables;
- respuestas sin evidencia;
- reparacion despues de error;
- follow-ups que preservan `focus_set`;
- Pendientes confirmados/rechazados/abandonados;
- nudges enviados, ignorados, pausados y utiles;
- fatiga y opt-out;
- memorias propuestas, promovidas, contradichas, suspendidas y olvidadas;
- utilidad percibida de Descubrimientos;
- continuidad y duplicados entre canales.

Hoy hay eventos operativos y metricas por subsistema. No se localizo un tablero
integral con valores actuales, objetivos y owners para toda esta lista. Por
eso no se puede afirmar retencion, aprendizaje util o calidad sostenida a
partir de tests y smokes.

### 14.15 Quality gates de producto que se agregan

La arquitectura objetivo no se considera lista solo por pasar los gates de la
seccion 10. Tambien debe cumplir:

#### Activacion

- primer valor en menos de un minuto en las rutas principales;
- ningun requisito de cuenta, categoria o canal cuando no sea necesario;
- evento de etapa exactamente una vez;
- activacion fuerte definida con hechos, no con impresion del modelo;
- D1 y D7 medibles por cohorte.

#### Relacion y conversacion

- rubrica emocional aprobada en conversaciones completas;
- cero perdida de referencia en follow-ups del corpus critico;
- reparacion explicita cuando Manzana se equivoca;
- una sola pregunta indispensable por turno;
- ayuda o salida visible despues de fallos repetidos.

#### Lenguaje y continuidad

- nombres visibles conformes a `12_lenguaje_producto.md`;
- estados detectado/propuesto/pendiente/confirmado no se confunden;
- misma consecuencia visible en WhatsApp y Dashboard;
- ningun flujo multicanal duplica, contradice o pierde el estado;
- estados vacios explican cobertura sin inventar `S/ 0`.

#### Control y privacidad

- cada accion sensible permite cancelar antes de ejecutar;
- cada memoria visible puede corregirse u olvidarse;
- revocar consentimiento detiene el uso correspondiente;
- desconectar una fuente no borra silenciosamente confirmados;
- modo discreto y disclosure se prueban por canal;
- opt-out y pausa son efectivos e idempotentes.

#### Evidencia de producto

- los 21 flujos tienen fila y estado;
- cada criterio enlaza documento, codigo y prueba;
- los gaps tienen owner y gate de cierre;
- QA tecnico y validacion con usuario se reportan por separado;
- ninguna dimension se declara `Cumple` a partir de documentacion solamente.

### 14.16 Entregable de cierre

El cierre real de la auditoria requiere un artefacto complementario versionado:

```text
Matriz de cumplimiento integral V1
  -> 21 flujos
  -> criterios atomicos
  -> evidencia documental
  -> evidencia de codigo
  -> tests y QA
  -> evidencia live
  -> estado, gap, owner y gate
```

Orden recomendado:

1. extraer criterios de onboarding, lenguaje, flujos, lifecycle, confianza,
   Dashboard, privacidad y wireflows;
2. asignar IDs estables y eliminar duplicados semanticos;
3. mapear codigo y tests sin asumir cumplimiento;
4. ejecutar los casos no cubiertos;
5. validar con usuario los journeys de mayor riesgo;
6. publicar score por dimension y lista de P0/P1/P2;
7. convertir cada brecha aprobada en corte del ledger vivo.

La matriz complementaria solicitada ya se encuentra versionada en:

`docs/fase_4_tecnica/matriz_cumplimiento_integral_v1_2026-07-24.md`.

Ese documento materializa:

- la topologia real de agentes y tools;
- la evaluacion atomica de los 21 flujos;
- learning, memoria y `local_fixture`;
- onboarding, lifecycle, privacidad, lenguaje, visual y metricas;
- contradicciones entre documentos y codigo;
- la arquitectura objetivo y los gates de cierre.

Por tanto, el entregable documental de auditoría integral queda cerrado entre
ambos archivos. Sus brechas siguen abiertas como trabajo de producto: una fila
`Documentado`, `CODE` o `TEST` no se convierte por ello en calidad `USER` o
`METRIC`.
