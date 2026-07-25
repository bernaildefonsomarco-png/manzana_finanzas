# Matriz De Cumplimiento Integral V1

**Fecha de corte:** 24 de julio de 2026  
**Estado:** auditoría integral de producto, arquitectura, agentes, datos, pruebas y evidencia operativa  
**Documento relacionado:** `auditoria_integral_arquitectura_ia_conversacional_2026-07-23.md`

---

## 1. Propósito

Esta matriz cierra la brecha entre una auditoría técnica del motor de IA y una
auditoría integral de Manzana como producto.

No considera equivalentes:

- una intención documentada;
- una clase o ruta implementada;
- una prueba unitaria;
- un smoke con fixture;
- una validación contra un proveedor real;
- una conversación real con el usuario;
- una métrica sostenida con volumen.

La unidad de evaluación es el criterio atómico:

```text
requisito
  -> autoridad documental
  -> implementación
  -> política/Core
  -> prueba
  -> evidencia live
  -> experiencia visible
  -> estado y gate de cierre
```

---

## 2. Corpus y método

El inventario actual contiene:

| Artefacto | Cantidad localizada |
|---|---:|
| Documentos Markdown en `docs/` | 54 |
| Archivos bajo `src/` | 552 |
| Archivos de pruebas | 145 |
| Migraciones SQL | 41 |
| Directorios de agentes | 14 |
| Tools conversacionales declaradas | 15 |

Fuentes normativas principales:

1. `especificacion_producto_finanzas_personales_ia.md`;
2. Fase 3 Producto, especialmente documentos 10 a 17;
3. Fase 2 Estrategia, documentos 05a a 05j;
4. Fase 4 Técnica, documentos 06 y 15 a 26;
5. Fase 5 Protección, especialmente documento 24;
6. Fase 6 Visual, documentos 28 a 33;
7. `23b_seguimiento_construccion_v1.md` para el estado vivo;
8. código, migraciones, tests y smokes como evidencia ejecutable;
9. conversaciones reales aportadas por el usuario.

### 2.1 Estados

| Estado | Significado |
|---|---|
| `Cumple` | Existe el recorrido completo y la evidencia exigida para el nivel declarado. |
| `Parcial` | Existe una parte útil, pero falta al menos una variante, canal, control o evidencia esencial. |
| `Documentado` | El requisito está definido, pero no se localizó implementación suficiente. |
| `Bloqueado externo` | El código está preparado y el bloqueo depende de un tercero identificado. |
| `No localizado` | No se encontró la capacidad después de revisar documentos, código y pruebas relevantes. |
| `Contradictorio` | Dos fuentes o dos capas producen contratos incompatibles. |

### 2.2 Niveles de evidencia

| Código | Evidencia |
|---|---|
| `DOC` | Documento o contrato. |
| `CODE` | Código localizado. |
| `TEST` | Prueba automatizada local. |
| `SMOKE` | Smoke contra infraestructura real o staging. |
| `LIVE` | Recorrido real con proveedor/canal real. |
| `USER` | Resultado observado y evaluado por el usuario. |
| `METRIC` | Serie operativa con volumen, objetivo y decisión. |

Un criterio no se marca `Cumple USER` a partir de `TEST` o `SMOKE`.

---

## 3. Topología real de extremo a extremo

### 3.1 Turno interactivo por WhatsApp

```text
Kapso / webhook autenticado
  -> external_event_log + outbox
  -> FinancialOrchestrator
     -> ConversationKernel determinista
     -> OrchestrationPlanningAgent
     -> resolución de Pending / capture draft
     -> DataAgent
     -> CorrectionAgent o ConversationAgent
     -> RiskSignalAgent + DedupSignalAgent cuando hay propuesta financiera
     -> PolicyGate / compiladores
     -> CommandDispatcher + Core o Pending
     -> ResponsePlanner
     -> ResponseAgent
  -> WindowManager / sender / delivery attempts
  -> Kapso / WhatsApp
```

Una consulta financiera ordinaria puede requerir cuatro llamadas semánticas:

1. planificación;
2. extracción general con `DataAgent`, aunque no exista escritura;
3. respuesta con tools read-only;
4. reescritura con `ResponseAgent`.

Una captura puede añadir evaluaciones semánticas de riesgo y deduplicación.
La cantidad de handoffs, por sí sola, no aporta inteligencia: crea latencia,
contradicciones y pérdida de foco si no hay una autoridad única del turno.

### 3.2 Autoridad financiera

La frontera correcta sí está presente:

```text
modelo propone
  -> schema valida forma
  -> compilador acota IDs/capacidades
  -> política determinista decide
  -> CommandDispatcher
  -> Core/RPC transaccional
  -> outbox e idempotencia
```

Los agentes no reciben escritura libre a Supabase. `ToolGateway` es read-only y
acota consultas por usuario. Esta separación debe conservarse en cualquier
simplificación.

### 3.3 Canales y memoria

`conversation_memory_states` mantiene un working set resumido con TTL de dos
horas. La clave incluye `user_id`, `channel` y `scope`.

Consecuencias:

- existe continuidad dentro de WhatsApp;
- existe continuidad dentro de Dashboard;
- no existe un working set conversacional compartido entre ambos canales;
- el Core financiero común evita dos verdades monetarias, pero no conserva por
  sí solo referencias como `eso`, `los cinco` o `el anterior` entre canales.

Estado: `Parcial CODE TEST`.

---

## 4. Inventario de agentes y autoridad

| Componente | Momento | Autoridad actual | Tools | Escritura financiera | Hallazgo |
|---|---|---|---|---|---|
| `OrchestrationPlanningAgent` | síncrono | propone objetivo, ruta, tools y resolución | catálogo, sin ejecución directa | no | Compite con Kernel/DataAgent y es una llamada adicional. |
| `DataAgent` | síncrono | extrae acciones y ambigüedades | no | no | Se invoca también en consultas; fragmenta interpretación. |
| `CorrectionAgent` | síncrono | resuelve referencia y propone corrección | no | no | Su schema/compilador son valiosos; no necesita seguir como segunda autoridad LLM. |
| `ConversationAgent` | síncrono | consulta y redacta respuesta factual | 15 read-only | no | Puede reparar dos veces y luego componer con fixture local. |
| `ResponseAgent` | síncrono | reescribe copy final | no | no | Puede duplicar interpretación y agregar latencia tras una respuesta ya fundada. |
| `RiskSignalAgent` | síncrono en captura | eleva señales semánticas | no | no | Correcto como propuesta; la política exacta conserva autoridad. |
| `DedupSignalAgent` | síncrono/preflight | propone relación semántica | no | no | Correcto solo para casos inciertos; dedup exacto debe seguir determinista. |
| `EmailExtractionAgent` | asíncrono | extrae campos de contenido autenticado | no | no | Debe permanecer aislado por seguridad y naturaleza no confiable del email. |
| `LearningSignalAgent` | post-corrección | propone candidatos | no | no | Solo se conecta desde correcciones confirmadas. |
| `RecurringSignalAgent` | job | enriquece candidato recurrente | no | no | Señal opcional; la regla se activa solo por confirmación/política. |
| `InsightExperienceAgent` | job | framing/sensibilidad | no | no | Separación válida por ser asíncrono y no tocar dinero. |
| `InsightNarratorAgent` | job | narración con hechos permitidos | no | no | Validador rechaza cifras/hechos inventados. |
| `DisclosureExperienceAgent` | job proactivo | propone disclosure | no | no | La política determinista mantiene autoridad. |
| `NudgeExperienceAgent` | job proactivo | adapta copy aprobado | no | no | No decide elegibilidad ni envío. |

### 4.1 Veredicto sobre el número de agentes

No conviene convertir los 14 componentes en un agente monolítico. Tampoco
conviene mantener cinco autoridades semánticas secuenciales en un turno.

La arquitectura objetivo usa tres contextos separados:

1. **`ConversationalExecutiveAgent`**: única autoridad semántica del turno
   interactivo. Interpreta, resuelve referencias, solicita lecturas, propone
   acciones y compone la respuesta sobre resultados reales.
2. **Extractores aislados**: email y futuras entradas no confiables; sin tools ni
   memoria general.
3. **Agentes asíncronos de propuesta/experiencia**: learning, insights, nudges,
   recurring, riesgo y dedup semánticos; nunca autorizan dinero.

La unidad importante es la autoridad y la sesión, no la cantidad de archivos.
Los schemas, validadores y compiladores de `DataAgent` y `CorrectionAgent`
deben conservarse como módulos internos tipados.

### 4.2 Conexión efectiva de cada agente

| Agente | Lo invoca | Salida consumida por | Provider Production efectivo |
|---|---|---|---|
| `OrchestrationPlanningAgent` | `FinancialOrchestrator` al planear el turno | compilador del plan y selección de ruta/tools | ledger: `api`; valor live no revalidado |
| `DataAgent` | `FinancialOrchestrator`, incluidos drafts y consultas | `data-action-policy`, drafts, preflight y ResponsePlanner | ledger: `api`; valor live no revalidado |
| `CorrectionAgent` | `FinancialOrchestrator` en intención de corrección | compilador de corrección, confirmación/Core y ResponsePlanner | ledger: `api`; valor live no revalidado |
| `ConversationAgent` | `FinancialOrchestrator` y `/api/v1/search/natural` | respuesta grounded y luego ResponsePlanner/enhancer | ledger: `api`; valor live no revalidado |
| `ResponseAgent` | `response-agent-enhancer` desde el orquestador | OutputGuard y sender del canal | ledger: `api`; valor live no revalidado |
| `RiskSignalAgent` | `financial-action-preflight` | política determinista de riesgo; no ejecuta | `local_fixture` observado en traza humana |
| `DedupSignalAgent` | preflight financiero y `cross-channel-preflight` | política/dedup determinista; no ejecuta | hereda default; no hay readiness live |
| `EmailExtractionAgent` | `email-ingestion` tras fuente exacta, auth y consentimiento | grounding/clasificación determinista y, si procede, Pending | `api` en ledger/traza de Gate F |
| `LearningSignalAgent` | `LearningEngine` después de evidencia confirmada | `LearningPolicyGate`, candidato y memoria; no escribe solo | hereda default; no hay evidencia live |
| `RecurringSignalAgent` | enriquecedor/repositorio de candidatos recurrentes | validador y candidato; activación exige política/usuario | hereda default; no hay evidencia live |
| `InsightExperienceAgent` | repositorio/job de Descubrimientos | framing/sensibilidad de insight calculado | hereda default; no hay evidencia live |
| `InsightNarratorAgent` | repositorio/job de Descubrimientos | copy validado contra hechos permitidos | hereda default; no hay evidencia live |
| `DisclosureExperienceAgent` | worker proactivo | propuesta de disclosure antes de salida | hereda default; no hay evidencia live |
| `NudgeExperienceAgent` | worker proactivo | copy de candidato ya elegible; policy/sender conservan autoridad | hereda default; no hay evidencia live |

Vercel confirma la existencia de las claves para los cinco agentes centrales,
default, fallback, modelo y Email. No permite leer mediante CLI las variables
marcadas como sensibles: un valor vacío devuelto por `env run` no prueba que el
deployment lo tenga vacío. Por eso la tabla distingue ledger/traza de un valor
live no revalidado. El control que falta es un readiness del propio deployment
que publique, sin secretos, provider/model/fallback efectivo por agente.

---

## 5. Inventario de tools conversacionales

| Tool | Fuente | Tipo | Observación |
|---|---|---|---|
| `get_balance_snapshot` | cuentas, cajas, compromisos | read-only | Dinero determinista. |
| `query_movements` | movimientos confirmados | read-only | Filtros tipados de fecha, tipo, categoría, cuenta, persona, tag y fuente. |
| `get_pending_summary` | Pending | read-only | Separa detectado de confirmado. |
| `get_debt_summary` | Debt Engine | read-only | Resumen de debe/me deben. |
| `get_debt_details` | Debt Engine | read-only | Cuotas y pagos. |
| `get_recurring_summary` | recurrentes/cuotas | read-only | Pagos que vienen. |
| `search_financial_memory` | memoria confirmada | read-only | No es autorización. |
| `get_classification_catalog` | clasificación | read-only | Catálogo del usuario. |
| `get_pending_details` | Pending | read-only | Revisión detallada. |
| `get_financial_structure` | cuentas/cajas | read-only | Estructura financiera. |
| `get_insights` | Descubrimientos | read-only | Hechos ya calculados. |
| `get_insight_evidence` | evidencia de insight | read-only | Explicabilidad. |
| `get_record_provenance` | auditoría/fuente | read-only | Procedencia. |
| `get_user_context_summary` | preferencias/contexto | read-only | Contexto minimizado. |
| `get_spending_summary` | movimientos | read-only | Excluye transferencias y otras no-salidas. |

Hallazgo documental: el ledger todavía describe catorce tools en una entrada,
pero el contrato actual declara quince. La fuente técnica vigente es el schema
de `ConversationToolName`.

---

## 6. Auditoría de los 21 flujos

Leyenda compacta:

- `H`: happy path;
- `A`: ambigüedad/dato faltante;
- `C`: confirmación/control;
- `S`: seguridad/Core;
- `X`: continuidad entre canales;
- `UI`: estados y responsive;
- `E`: evidencia máxima localizada.

| # | Flujo | H | A | C | S | X | UI | E | Estado integral |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | Registro simple por WhatsApp | sí | sí | sí | sí | parcial | n/a | LIVE/USER + traza runtime | `Parcial crítico`: Core probado, pero Production no garantiza cero fixture y ya hubo una señal local. |
| 2 | Registro múltiple por WhatsApp | sí | parcial | parcial | sí | parcial | n/a | TEST | `Parcial`: un lote mixto claro+ambiguo queda bloqueado como lote completo. |
| 3 | Registro manual Dashboard | parcial | parcial | parcial | parcial | parcial | parcial | CODE/TEST mínimo | `Parcial`: tres tipos no guardables y vínculos especializados incompletos. |
| 4 | Corrección de movimiento | sí en WhatsApp | sí | sí | sí | parcial | no en Movimientos | LIVE/TEST | `Parcial`: fuerte en WhatsApp, ausente en la pantalla de Movimientos. |
| 5 | Borrar, cancelar o deshacer | parcial | parcial | sí | sí | parcial | parcial | TEST | `Parcial`: borrar/cancelar existen; “deshacer” se interpreta como borrar, no restaurar. |
| 6 | Pendientes de email | sí | sí | sí | sí | sí por estado Core | sí | LIVE/USER | `Parcial avanzado`: fuera de ventana depende de template externo pendiente. |
| 7 | Consulta financiera | sí | parcial | n/a | read-only | parcial | n/a | LIVE/USER | `Parcial`: tools sólidas, inteligencia/foco fallan en conversación real. |
| 8 | Búsqueda natural Dashboard | sí | parcial | bloquea mutaciones | read-only | parcial | parcial | TEST | `Parcial`: comparte motor, pero muestra confianza numérica y no comparte working set con WhatsApp. |
| 9 | Deuda nueva | sí Dashboard | parcial WhatsApp | sí | sí | parcial | sí | TEST | `Parcial`: creación estructurada; captura natural no llega al motor especializado. |
| 10 | Pago de deuda/devolución | sí | sí | sí | sí | sí por Core | sí | LIVE/USER histórico + ENV actual | `Parcial avanzado`: comando/Core probados; runtime semántico actual y devolución completa no están certificados. |
| 11 | Pago que viene | sí | sí | sí | sí | parcial | sí | TEST/QA | `Parcial avanzado`: combinación recurrente+cuota sólida; continuidad/proactividad no cerradas. |
| 12 | Recordatorio | sí | sí | parcial | sí | parcial | parcial | LIVE piloto | `Parcial`: política fuerte, controles visibles y lifecycle completos faltan. |
| 13 | Descubrimiento | sí Dashboard | sí | sí para feedback | sí | parcial | sí | TEST/QA | `Parcial`: no hay consentimiento/superficie completa de envío por WhatsApp. |
| 14 | Ayuda y explicación | parcial | parcial | n/a | read-only | parcial | parcial | TEST | `Parcial`: ayuda básica/provenance existen; no hay caso de soporte humano operativo. |
| 15 | Modo discreto | parcial | n/a | parcial | política parcial | no | parcial | TEST | `Parcial crítico`: toggles locales no persistentes y cobertura desigual por pantalla/canal. |
| 16 | Reconstrucción incompleta | parcial | sí | parcial | no confirma sin datos | parcial | no dedicada | TEST | `Parcial`: conversación segura, sin workspace de reconstrucción/revisión completo. |
| 17 | Cuenta o caja desde el uso | sí Dashboard | parcial | sí | sí | parcial | sí | TEST/QA | `Parcial`: CRUD real, pero progressive disclosure contextual no está cerrado. |
| 18 | Clasificación/subcategoría/tags | sí | sí | sí | sí | parcial | parcial | TEST | `Parcial avanzado`: catálogo y Core existen; edición y aprendizaje transversal incompletos. |
| 19 | Transferencia/asignación/ajuste | sí en Mi Dinero | parcial | sí | sí | parcial | parcial | SMOKE/LIVE email | `Parcial`: acciones especializadas existen, formulario manual/WhatsApp no las cubren todas. |
| 20 | Configuración/preferencias | parcial | n/a | sí en lo expuesto | sí | mismo perfil parcial | parcial | TEST/QA | `Parcial`: faltan discreto global, memoria, insights WA, resumen y controles granulares. |
| 21 | Detalle/fuente/explicabilidad | parcial | parcial | n/a | read-only | parcial | parcial | TEST | `Parcial`: insights/deudas fuertes; Movimientos no ofrece detalle/editar/eliminar. |

### 6.1 Flujo 1 — Registro simple por WhatsApp

Evidencia:

- webhook firmado, idempotencia y ventana;
- `DataAgent` propone;
- PolicyGate decide;
- `CreateMovementCommand` ejecuta;
- outbox y respuesta confirman el hecho;
- QA real de capturas simples.

Gap:

- Production permite `local_fixture` y ya lo usó en una señal de una
  interacción humana;
- no existe una métrica continua de comprensión sin aclaración;
- la calidad del registro no autoriza extrapolar calidad a consultas.

### 6.2 Flujo 2 — Registro múltiple

`DataAgent` extrae múltiples acciones. El defecto está después:

```text
acción A ready_for_core
acción B requires_confirmation
  -> summarizeDataActionPlan = requires_confirmation
  -> executeReadyDataActionPlan rechaza todo plan que no sea ready_for_core
```

El requisito documental pide registrar lo claro y separar solo lo ambiguo.
Actualmente el lote mixto no lo hace. No hay test de regresión para esa
combinación.

Gate:

- ejecución idempotente por acción lista;
- Pending solo para las ambiguas;
- respuesta compacta que distinga registradas y por revisar;
- retry del lote sin duplicados.

### 6.3 Flujo 3 — Formulario manual

`movementFormConfig` muestra once tipos, pero:

- `transferencia`, `asignacion_interna` y `ajuste` tienen
  `canSaveNow: false`;
- cuenta y vínculos de deuda/recurrente/persona están deshabilitados o
  postergados;
- el payload envía varios IDs especializados como `null`;
- tipos como pago/deuda pueden terminar como movimiento genérico en vez de
  ejecutar el motor especializado.

Mostrar once opciones no equivale a soportar once recorridos.

### 6.4 Flujos 4 y 5 — Corrección, borrado y deshacer

Fortalezas:

- referencias acotadas a candidatos;
- confirmación explícita;
- soft delete y auditoría;
- correcciones de monto/categoría/cuenta/tipo a préstamo;
- aprendizaje solo después de corrección confirmada.

Brechas:

- `MovementsScreen` no expone detalle, edición ni eliminación;
- “deshacer” cae en el conjunto de verbos de eliminación;
- no se localizó restauración de una versión anterior;
- el contrato visible no distingue con precisión cancelar propuesta, borrar
  confirmado y revertir un cambio.

### 6.5 Flujo 6 — Email a Pending

Es el recorrido más completo:

```text
Gmail OAuth
  -> fuente banco+buzón+sender exacto
  -> DKIM/DMARC
  -> consentimiento IA versionado
  -> extracción sin tools/store
  -> grounding
  -> Pending
  -> WhatsApp/Dashboard
  -> revisión
  -> confirmación humana
  -> Core especializado
```

`P-2483A40C` fue descartado sin escritura y `P-34EA2DFD` fue reclasificado,
reconfirmado y ejecutado una sola vez. La ruta fuera de ventana continúa
condicionada por la aprobación externa del template correspondiente.

### 6.6 Flujos 7 y 8 — Consulta y búsqueda

Fortalezas:

- quince tools read-only;
- filtros temporales/financieros tipados;
- grounding y reparación;
- mutaciones bloqueadas en búsqueda;
- memoria financiera consultable.

Brechas observadas:

- pérdida del conjunto exacto de cinco gastos entre turnos;
- reconsulta no solicitada;
- cambio arbitrario de periodo;
- inclusión de Taxi en Alimentación;
- pregunta innecesaria después de una referencia resoluble;
- `NaturalSearchScreen` muestra `Confianza XX%`, contrario al lenguaje de
  certeza humano del documento 11;
- working set separado por canal.

### 6.7 Flujos 9 y 10 — Deudas

La entidad, calendario, cuotas, pagos, asignaciones, sobrepago, moneda,
idempotencia y outbox son fuertes. `RecordDebtPaymentCommand` llega al RPC
atómico especializado. El QA humano histórico conserva valor para ese Core,
pero no certifica el runtime conversacional actual mientras Data/Planner/
Correction/Response hereden fixture.

El alta natural de una deuda nueva no está cerrada: tipos no directos se
bloquean con `movement_type_requires_specialized_engine`, pero no existe un
puerto conversacional equivalente al pago ya implementado.

### 6.8 Flujos 11 a 13 — Próximos, recordatorios y descubrimientos

Los motores deterministas y repositorios existen. Los agentes de experiencia
solo enmarcan hechos ya aprobados. Esto es correcto.

Falta:

- lifecycle canónico D0–D30;
- controles completos de pausa/reanudación y fatiga visibles;
- opt-in separado de Descubrimientos por WhatsApp;
- métricas de utilidad percibida;
- coherencia de modo discreto en todas las superficies.

### 6.9 Flujos 14 a 16 — Ayuda, discreto y reconstrucción

No se localizó:

- escalamiento de soporte con permiso temporal y audit log;
- caso/ticket de recuperación después de fallos repetidos;
- modo discreto global persistente accesible desde Settings/topbar;
- aplicación uniforme a Home, Mi Dinero, Deudas y Pagos que vienen;
- workspace de reconstrucción que agrupe recuerdos incompletos antes de
  confirmar.

### 6.10 Flujos 17 a 21 — Estructura, clasificación y control

La capa de dominio supera a algunas pantallas. Hay APIs/Core para cuentas,
cajas, clasificación, transferencias, asignaciones, ajustes, detalle y
procedencia, pero la experiencia no ofrece todas esas capacidades de forma
coherente en Movimientos, WhatsApp y Dashboard.

---

## 7. Aprendizaje y memoria

### 7.1 Camino implementado

```text
corrección confirmada por Core
  -> LearningEngine
  -> propuesta determinista
  -> LearningSignalAgent propone candidatos adicionales
  -> learning_candidates
  -> LearningPolicyGate
  -> financial_memory_items confirmada
```

En conversación:

```text
Conversational path
  -> search_financial_memory read-only
  -> contexto relevante
  -> nunca autorización de escritura
```

Esto implementa correctamente el principio “el agente propone, la política
decide”.

### 7.2 Estados reales

| Capa | Estados actuales |
|---|---|
| sesión | activa hasta TTL / expirada |
| candidato | observed, pending_confirmation, accepted, rejected, superseded |
| memoria | confirmed, revoked + `superseded_at` + `valid_until` |

La presencia de columnas no significa que existan recorridos para moverlas.

### 7.3 Brechas verificadas

| Requisito | Estado | Evidencia/gap |
|---|---|---|
| Aprender solo con evidencia | `Parcial avanzado` | Corrección confirmada sí; otras fuentes casi no están conectadas. |
| Acumular evidencia | `Parcial` | RPC acumula refs y count. |
| No contar retry como evidencia nueva | `Cumple CODE` | Dedup por `evidence_ref`. |
| Contradicciones | `No localizado` | Se fusiona por key y se conserva la confianza máxima; no existe evidencia negativa/contradictoria. |
| Reducir confianza | `No localizado` | `greatest(old,new)` solo aumenta. |
| Expirar | `Parcial` | `valid_until` se filtra al leer; no hay política/job general de expiración o renovación. |
| Información sensible | `Parcial` | Pasa a `pending_confirmation`; no existe recorrido visible para decidirla. |
| Ver recuerdos | `Parcial` | Se pueden consultar por búsqueda natural; no hay centro de memoria. |
| Corregir/olvidar | `No localizado` | No hay API/UI de revoke/supersede/forget por recuerdo. |
| Memoria de sesión vs permanente | `Cumple CODE` | Tablas y TTL separados. |
| Exportación | `No cumple` | Export actual omite memoria financiera, candidatos y estado conversacional. |
| Aprendizaje por preferencia explícita | `Contradictorio` | Estilo persistente se escribe directo en metadata, fuera del LearningEngine. |
| Métricas de aprendizaje | `No localizado` | No hay tablero de propuestas/promociones/contradicciones/olvidos. |

### 7.4 Riesgo de confianza

`record_learning_candidate` usa:

```text
confidence = greatest(confidence_anterior, confidence_nueva)
```

Por tanto:

- nueva evidencia débil no reduce confianza;
- una contradicción no tiene representación;
- un candidato rechazado puede volver a `observed`;
- no hay suspensión por conflicto;
- el usuario no puede ver por qué una memoria sigue activa.

El Learning actual es una base segura, no un sistema de aprendizaje completo.

### 7.5 Arquitectura objetivo

```text
evento de dominio confirmado
  -> extractores deterministas de señales
  -> modelo semántico solo cuando el significado es incierto
  -> candidato con evidencia positiva/negativa
  -> política determinista
  -> candidate | confirmed | suspended | revoked | expired
```

Cada memoria debe registrar:

- afirmación canónica;
- alcance;
- sensibilidad;
- evidencias a favor y en contra;
- procedencia;
- confianza calculada por política;
- fecha de revisión/expiración;
- estado;
- explicación visible;
- historial de corrección/olvido.

---

## 8. `local_fixture` y degradación

### 8.1 Estado verificado en código, configuración y trazas

`readAgentRuntimeConfig` usa:

```text
defaultProvider = local_fixture
fallbackToLocal = true
```

si el entorno no declara otra cosa.

La configuración local actual declara:

- default `local_fixture`;
- fallback local `true`;
- API para Data, EmailExtraction y Response;
- Planner, Conversation, Correction y signal agents heredan fixture.

Vercel Production contiene claves específicas para Data, Response,
Conversation, Correction, Planner y EmailExtraction, además de default,
fallback y modelo. La CLI no puede revelar variables marcadas como sensibles:
los vacíos que devuelve fuera del build no demuestran un valor vacío en el
deployment. El ledger afirma API para los cinco agentes centrales y las trazas
de Gate F prueban API para EmailExtraction.

Referencia del proveedor:
[Vercel — Sensitive environment variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables).

Lo que sí está probado en Production:

- una traza humana usó `RiskSignalAgent=local_fixture`;
- los signal agents no tienen overrides visibles en el inventario de claves y
  dependen del default efectivo;
- no existe un readiness público/interno localizado que reporte provider,
  modelo y fallback efectivos por cada agente del deployment;
- el código permite fallback silencioso y composición local incluso si el
  provider primario fuera API.

Estado: `No cumple control de Production`, severidad `P0`. No se afirma que los
catorce agentes estén hoy en fixture; se afirma que el proyecto no puede
demostrar ni impedir de forma operativa que un fixture atienda al usuario.

### 8.2 Sustituciones localizadas

1. `RuntimeRouter` cae a fixture ante ausencia o error de provider.
2. `CorrectionAgent` tiene además un fallback local propio.
3. `ConversationAgent`, después de dos respuestas con grounding inválido,
   compone una respuesta local aunque el provider externo estuviera activo.
4. Tests celebran explícitamente la caída a fixture cuando falta endpoint o
   modelo.

Los safety flags hacen la degradación observable para logs, pero no para el
usuario. Esto contradice la regla solicitada:

> conservar fixtures para desarrollo y pruebas, no como sustituto silencioso de
> la IA en producción.

La traza humana de Risk ya incumplió precisamente esa regla. Para el resto, la
ausencia de fail-fast/readiness impide certificar que no vuelva a ocurrir.

### 8.3 Política objetivo obligatoria

| Entorno | Default | Fallback |
|---|---|---|
| test | `local_fixture` permitido | permitido |
| development | explícito | permitido con banner/log |
| staging | API explícita | solo en escenarios de resiliencia marcados |
| production | API explícita por capacidad | `false` para comprensión semántica |

Una degradación de producción debe ser honesta:

- captura: dejar borrador/Pending y pedir el dato mínimo;
- consulta: informar indisponibilidad temporal, sin inventar respuesta;
- corrección: no ejecutar y conservar la propuesta;
- response styling: enviar el texto determinista factual ya aprobado;
- signals opcionales: omitir la señal, nunca rebajar una política;
- telemetría: alerta, métrica y razón visible internamente.

No se debe usar un fixture de comprensión para aparentar que el modelo respondió.

---

## 9. Onboarding, lifecycle y uso parcial

### 9.1 Onboarding

Implementado:

```text
not_started -> started -> first_value_reached
```

Fortalezas:

- inicio explícito;
- una CTA principal;
- no exige cuenta;
- primer valor por movimiento/Pending/deuda confirmados;
- transición monotónica e idempotente;
- evita mostrar `S/0` sin datos.

Falta respecto del contrato de producto:

- `activated_light`;
- `activated_strong`;
- `completed`;
- primer wow con al menos cinco movimientos cuando aplique;
- rutas parciales formalizadas;
- D1–D7;
- cohorte y conversión.

Estado: `Parcial LIVE`.

### 9.2 Lifecycle

Existen drafts de lifecycle para:

- revisión semanal;
- reconstrucción;
- inactividad;
- quiet/at-risk/dormant;
- Pending y compromisos.

No existe una entidad canónica persistida con:

- estado actual de lifecycle;
- transición y causa;
- `returned`;
- playbook elegido;
- cooldown por playbook;
- owner/experimento;
- métricas D1/D7/D14/D30.

Estado: `Documentado/Parcial CODE`.

### 9.3 Uso parcial

Rutas que funcionan parcialmente:

- registro sin cuenta;
- WhatsApp sin configuración completa;
- Dashboard sin Gmail;
- deudas sin cajas;
- consulta con datos incompletos;
- email como fuente opcional.

No existe una suite que certifique de forma independiente:

- solo WhatsApp;
- solo Dashboard;
- solo deudas;
- solo Pendientes;
- retorno después de silencio;
- uso sin saldos;
- desactivación de cada capacidad.

---

## 10. Transformación emocional y conversación

Los documentos exigen:

```text
confusión -> claridad
culpa -> alivio
desorden -> patrón visible
ansiedad -> siguiente paso pequeño/control
```

Implementado:

- `ConversationEmotionalState`;
- inferencia determinista del Kernel;
- guidance para incertidumbre, ansiedad y frustración;
- `ResponseContextPack`;
- reglas de estilo, sensibilidad y emojis;
- pruebas de preservación de hechos.

No implementado:

- métrica pre/post de claridad;
- recuperación percibida después de error;
- alivio/control reportado;
- evaluación humana recurrente;
- clasificación de respuestas que aumentaron ansiedad;
- gate que impida release por degradación emocional.

Las capturas reales demuestran que una respuesta puede ser financieramente
segura y emocionalmente mala: obliga al usuario a repetir, cambia el foco y
parece no comprender. Por eso el estado es `Parcial USER`.

Rubrica mínima por conversación:

| Dimensión | Pregunta |
|---|---|
| Comprensión | ¿Interpretó el objetivo real y sus referencias? |
| Foco | ¿Conservó el conjunto y periodo vigentes? |
| Inteligencia | ¿Derivó lo obvio sin pedir datos ya presentes? |
| Humildad | ¿Reconoció y reparó su error? |
| Claridad | ¿El usuario entiende total, evidencia y límites? |
| Control | ¿Sabe qué puede corregir/cancelar? |
| Emoción | ¿Redujo fricción, culpa o ansiedad? |
| Brevedad | ¿Dijo lo mínimo suficiente? |

---

## 11. Lenguaje, visual y accesibilidad

### 11.1 Cumplimientos

- navegación usa `Pagos que vienen`, `Descubrimientos` y `Pendientes`;
- tokens base de color, tipografía, espacio, radio, sombras y foco están
  trasladados a `globals.css`;
- existen componentes compartidos de botón, card, badge, estado, monto y switch;
- focus visible global;
- layouts responsive y modales con roles en varias pantallas;
- estados empty/loading/error existen en superficies principales.

### 11.2 Brechas

| Requisito | Evidencia | Estado |
|---|---|---|
| No mostrar confidence numérica | Búsqueda muestra porcentaje | `No cumple` |
| Modo oscuro documentado | `html` fuerza `color-scheme: light`; no hay overrides dark | `Documentado` |
| Modo discreto global | Solo toggles locales en Movimientos/Pending/Descubrimientos | `Parcial crítico` |
| Topbar con discreto | Topbar tiene búsqueda y campana sin control global | `No cumple` |
| Navegación mobile completa | Bottom nav muestra Home, Movs., Pend., Dinero y Más; no ofrece menú real a Deudas/Próximos/Descubrimientos | `Parcial` |
| Notificaciones | Botón visible sin acción | `Placeholder visible` |
| Movimiento editable por swipe/detalle | No localizado en screen | `No cumple` |
| Todos los tipos manuales | Tres deshabilitados | `No cumple` |
| Focus trap/Escape en todos los modales | roles presentes; no se localizó infraestructura común de focus trap | `Parcial` |
| WCAG AA verificado | especificado, sin reporte automatizado/localizado | `No probado` |
| 151 frames/variantes | handoff documentado; implementación no certificada frame por frame | `Parcial` |

### 11.3 Comprobación visual de Production

El 24/07/2026 se abrió `https://manzana.website` en viewport móvil
`390 × 844`. La pantalla pública de acceso se adapta sin overflow visible,
con jerarquía, campos y llamadas a la acción legibles.

Al intentar entrar con credenciales de QA inválidas, la interfaz mostró
literalmente `Invalid login credentials`. `auth-screen.tsx` publica
`error.message` directamente, por lo que un error técnico del proveedor rompe
el idioma del producto y no ofrece una recuperación contextual en español.

También se recorrieron en Production `/privacidad`, `/terminos` y
`/eliminar-datos`. Son públicas, estructuradas y navegables, pero el contenido
visible omite sistemáticamente tildes y signos de apertura. Además:

- Privacidad promete que el usuario puede activar modo discreto, aunque el
  producto no lo ofrece como preferencia global persistente;
- Eliminar datos dice que el camino automático todavía puede no estar
  disponible, mientras el Dashboard ya implementa eliminación desde Settings;
- esto convierte páginas legales operativas en otra fuente de verdad que hoy
  puede derivar del producto.

Estado de esta comprobación:

- `LIVE`: acceso público y responsive de la pantalla de autenticación;
- `LIVE`: páginas públicas de privacidad, términos y eliminación;
- `USER`: error real en inglés ante credenciales inválidas y copy público sin
  ortografía canónica;
- `No probado live en este corte`: superficies autenticadas, porque no había
  una sesión autorizada y no se creó una cuenta como efecto colateral de la
  auditoría;
- las superficies autenticadas se evaluaron mediante código, pruebas y
  evidencia `QA/LIVE` trazada en el ledger, sin presentarlas como observación
  visual nueva.

---

## 12. Privacidad, consentimiento y control

### 12.1 Fortalezas

- RLS y service role acotado;
- tokens Gmail cifrados;
- webhooks autenticados;
- `store:false` para Responses API;
- cuerpo de email no persistido por defecto;
- Pending separado de movimiento;
- exportación y eliminación de cuenta;
- desconexión Gmail;
- consentimiento IA por buzón versionado;
- opt-in, quiet hours, caps y disclosure para proactividad;
- idempotencia y logs minimizados.

### 12.2 Brechas de experiencia

| Control | Estado |
|---|---|
| Exportar finanzas básicas | `Cumple TEST` |
| Exportar memoria/aprendizaje | `No cumple` |
| Borrar cuenta y detener nudges/Gmail | `Cumple TEST` |
| Ver y olvidar recuerdos | `No localizado` |
| Modo discreto persistente | `No localizado en UI/API de preferencias` |
| Insights por WhatsApp | `No localizado como consentimiento separado` |
| Resumen semanal | `No localizado como control visible` |
| Pausa temporal granular | existe en modelo/política, cobertura UI incompleta |
| Soporte con permiso temporal y auditoría | `Documentado`, no localizado |
| Retención automática de traces/logs | política documentada, job/gate no localizado |
| Runbook de incidentes | documentado, artefacto operativo no localizado |

La exportación actual tampoco incluye:

- `financial_memory_items`;
- `learning_candidates`;
- `conversation_memory_states`;
- historial de consentimiento y decisiones de aprendizaje.

### 12.3 Revalidación normativa y de proveedor

La revalidación del 24/07/2026 confirma:

- el Reglamento peruano aprobado por DS 016-2024-JUS está vigente desde el
  31/03/2025; la ANPD también mantiene como obligación que los bancos de datos
  personales inscritos estén actualizados;
- `gmail.readonly` continúa siendo un scope restringido;
- Google exige minimización, transparencia, atención de eliminación y una
  declaración afirmativa de cumplimiento de Limited Use;
- transmitir o almacenar datos de scopes restringidos en servidores puede
  exigir OAuth verification y security assessment;
- Google permite transferir datos para una función visible que beneficia al
  usuario cuando existe consentimiento, pero no para publicidad, scoring
  crediticio o entrenamiento general.

Fuentes primarias:

- [ANPD: nuevo Reglamento de Protección de Datos Personales](https://www.gob.pe/institucion/anpd/campa%C3%B1as/128319-nuevo-reglamento-de-proteccion-de-datos-personales);
- [ANPD: actualización de bancos de datos personales](https://www.gob.pe/institucion/anpd/pages/9251-modificar-banco-de-datos-inscrito-en-el-registro-nacional-de-proteccion-de-datos-personales);
- [Google: Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes);
- [Google Workspace API User Data Policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy);
- [OpenAI API data controls](https://platform.openai.com/docs/models/default-usage-policies-by-endpoint).

El código usa `store:false` y consentimiento versionado antes de enviar
contenido autenticado al extractor, lo que está bien encaminado. Sin embargo,
la política pública live no contiene la declaración Limited Use que los propios
documentos 24/27 marcan pendiente, y no se localizó evidencia de cierre de
OAuth verification/security assessment ni de revisión del banco de datos
personales. No se afirma incumplimiento legal definitivo —eso requiere revisión
profesional—, pero sí un `gate de lanzamiento público no probado`.

---

## 13. Métricas y observabilidad

### 13.1 Lo que existe

- trazas por agente con provider/modelo/latencia;
- eventos externos y outbox;
- job runs, lag y replay;
- delivery WhatsApp;
- salud de email/extractor;
- métricas del piloto proactivo;
- eventos de onboarding inicial;
- interacción con Descubrimientos;
- tests/evals y smokes.

### 13.2 Lo que falta

No se localizó un sistema que cierre:

```text
evento -> cálculo -> tablero -> valor actual -> objetivo -> owner -> decisión
```

para:

- comprensión sin aclaración;
- precisión por tipo;
- falsos vacíos;
- pérdida de foco;
- respuesta sin evidencia;
- corrección exitosa;
- reparación emocional;
- activación fuerte;
- D1/D7/D30;
- uso parcial retenido;
- memoria promovida/contradicha/olvidada;
- utilidad de Descubrimientos;
- fatiga/opt-out por tipo;
- p50/p95/costo/fallback por agente;
- latencia total del turno y cantidad de handoffs.

Estado: `Parcial operacional`; no hay `METRIC` integral.

---

## 14. Contradicciones y deriva

| ID | Contradicción | Fuente A | Fuente B | Impacto |
|---|---|---|---|---|
| C-01 | Fixture solo degradado vs fallback por defecto | ledger/auditoría | `config.ts` y `runtime-router.ts` | Calidad de producción puede cambiar silenciosamente. |
| C-02 | Cinco agentes API en Production vs runtime no autocertificable | ledger | Vercel oculta valores sensibles; no hay readiness por agente; Risk tuvo traza local | No puede probarse configuración efectiva ni impedir degradación silenciosa. |
| C-03 | 14 tools vs 15 tools | ledger corte 24 | schema actual | Documentación de capacidades desactualizada. |
| C-04 | Modo discreto transversal vs toggles locales | privacidad/diseño | screens/settings | Exposición desigual y preferencia no persistente. |
| C-05 | Once tipos manuales vs tres no guardables | flujo/HiFi | formulario actual | Capacidad visible que no termina el trabajo. |
| C-06 | Registrar claro y preguntar ambiguo vs lote bloqueado | flujo 2 | data action policy/executor | Fricción y pérdida de captura. |
| C-07 | Usuario puede corregir todo dato importante | producto | Movimientos sin editar/borrar/detalle | Control incompleto. |
| C-08 | Memoria reversible/auditable | ledger | sin API/UI revoke/forget | Promesa no accesible al usuario. |
| C-09 | Lifecycle V1 | docs producto | solo onboarding inicial + drafts | Retención no implementada como sistema. |
| C-10 | Inteligencia compartida entre canales | promesa de experiencia | working set por canal | Core común, conversación no común. |
| C-11 | Confidence humana | lenguaje | porcentaje en búsqueda | Lenguaje técnico visible. |
| C-12 | Dark mode especificado | diseño | solo light en CSS | Estado visual documentado, no implementado. |
| C-13 | Errores humanos en español | lenguaje de producto | Auth publica `error.message` del proveedor | Error real en inglés y sin siguiente paso contextual. |
| C-14 | Eliminación automática disponible | Settings/API | página pública dice que puede no estar disponible | La guía legal puede estar desactualizada respecto del producto. |
| C-15 | Una cuenta email por usuario | `05d_email_parsing.md` | Corte 32 multi-buzón | La spec de feature quedó detrás del contrato implementado por banco+buzón+sender. |
| C-16 | Limited Use exigido | Fase 5 y política vigente de Google | página pública `/privacidad` | El requisito está documentado pero no aparece en la política pública live. |
| C-17 | Proactivos “activados por defecto” | tabla antigua de `05a` | `05j`, consentimiento atómico y gate live | Se resuelve a favor de la regla posterior: ningún default interno constituye opt-in externo. |

---

## 15. Hallazgos priorizados

### P0

1. Production no tiene fail-fast/readiness que garantice cero `local_fixture`;
   Risk ya apareció local en una traza humana y `ConversationAgent` conserva
   una composición local silenciosa tras reparaciones.
2. No existe un `focus_set` autoritativo que sobreviva a todos los handoffs; las
   conversaciones reales pierden el conjunto consultado.
3. El formulario manual muestra tipos que no puede completar y puede eludir
   motores especializados.
4. El modo discreto no es una política visible, persistente y transversal.
5. La memoria permanente no puede verse, corregirse ni olvidarse desde producto.
6. Un lote múltiple mixto no ejecuta las acciones claras de manera independiente.
7. La política pública no incluye todavía la declaración Limited Use requerida
   para datos obtenidos con scopes Google Workspace.

### P1

1. Cuatro o más llamadas semánticas pueden intervenir en un turno interactivo.
2. No hay continuidad conversacional cross-channel.
3. El alta natural de deuda carece de puerto especializado.
4. Movimientos no ofrece detalle/corrección/eliminación en Dashboard.
5. Lifecycle D0–D30 y activación fuerte no están implementados como estado.
6. Métricas de calidad conversacional/emocional no existen como operación.
7. Navegación mobile no expone todas las secciones principales.
8. Soporte humano con permiso mínimo no está implementado.
9. Autenticación expone mensajes técnicos del proveedor en inglés y sin
   recuperación contextual.

### P2

1. Deriva de conteo de tools/migraciones/estados en documentos.
2. Dark mode y parte de accesibilidad están documentados, no verificados.
3. Exportación de datos no incluye memoria/aprendizaje.
4. Botón de notificaciones visible sin recorrido.
5. Confidence numérica visible contradice el lenguaje de producto.
6. Páginas legales públicas omiten tildes y su copy no se versiona junto con
   las capacidades reales.

---

## 16. Arquitectura objetivo

```text
Entrada normalizada
  -> TurnCoordinator
     -> carga TurnWorkspace
        - mensaje y canal
        - working set/focus set
        - evidencia y procedencia
        - preferencias/consentimiento
        - candidatos financieros acotados
     -> ConversationalExecutiveAgent
        - interpreta el turno
        - resuelve referencias
        - solicita tools read-only
        - propone operaciones tipadas
        - define la respuesta necesaria
     -> EvidenceAndPolicyCompiler
        - valida IDs, evidencia, riesgo, consentimiento y estado
     -> Core/Pending o lecturas
     -> mismo Executive compone sobre resultados reales
     -> OutputGuard + canal
```

Módulos internos, no agentes LLM independientes:

```text
ConversationalExecutiveAgent
├── TurnInterpreterSchema
├── ReferenceResolverSchema
├── ToolRequestSchema
├── FinancialProposalSchema
├── CorrectionProposalSchema
└── ResponseCompositionSchema
```

Separados:

- `EmailExtractionAgent`;
- motores Core;
- PolicyGate/Disclosure/NudgePolicy;
- jobs y outbox;
- signal agents asíncronos/híbridos;
- LearningEngine y memoria;
- narradores asíncronos de insights/nudges.

### 16.1 Invariantes del `TurnWorkspace`

- un `focus_set` con IDs, filtro, periodo, orden y versión;
- cada slot incluye `value`, `source`, `confidence`, `confirmed_at` y
  `evidence_ref`;
- un resultado de tool no puede ser reemplazado por memoria o inferencia;
- una corrección semántica no cambia dinero sin confirmación;
- toda respuesta factual lista las evidencias utilizadas internamente;
- un cambio de tema suspende el foco, no lo destruye;
- WhatsApp y Dashboard pueden retomar un foco compartido cuando el usuario lo
  solicita, con límites de privacidad.

---

## 17. Plan de cierre recomendado

### Corte A — Seguridad de runtime y foco

- Production con provider explícito y fallback semántico desactivado;
- `focus_set`/provenance por resultado;
- test de las conversaciones reales aportadas;
- telemetría de fallback y handoffs;
- lote múltiple por acción.

### Corte B — Executive en shadow

- schema único;
- ejecutar planner/data/correction antiguos en paralelo sin autoridad;
- comparar objetivo, referencias, tools y propuestas;
- no cambiar Core.

### Corte C — Migración interactiva

- query y follow-up primero;
- captura simple y múltiple;
- corrección;
- flujos mixtos;
- retirar llamadas LLM antiguas, conservar compiladores.

### Corte D — Learning gobernado

- estados suspended/expired/revoked;
- contradicciones y reducción de confianza;
- API/UI ver/corregir/olvidar;
- exportación;
- métricas.

### Corte E — Producto transversal

- modo discreto global;
- edición/detalle de Movimientos;
- once tipos manuales vía motores correctos;
- navegación mobile;
- soporte/recuperación;
- lifecycle D0–D30;
- consentimientos faltantes.

### Corte F — Certificación

- tests, typecheck, lint y build;
- QA visual desktop/mobile;
- eval semántico;
- journeys cross-channel;
- QA humano;
- tablero de métricas;
- actualización de ledger y documentos derivados.

### 17.1 Owners funcionales

Hasta asignar personas concretas, cada brecha debe tener al menos una autoridad
funcional inequívoca:

| Área/gap | Owner funcional | Gate |
|---|---|---|
| provider, fallback, costo y trazas | Agent Runtime / Plataforma | Corte A |
| foco, referencias y Executive | Arquitectura conversacional | Cortes A–C |
| lotes y comandos especializados | Orchestrator + Core financiero | Cortes A/C/E |
| learning y memoria reversible | Learning + Privacidad | Corte D |
| modo discreto y consentimientos | Producto + Privacidad + Canales | Corte E |
| Movimientos, once tipos y navegación | Dashboard + Core de dominio | Corte E |
| onboarding y lifecycle | Producto + Growth responsable | Corte E |
| métricas/evals/tableros | Data/Observabilidad + Producto | Cortes E/F |
| OAuth, Limited Use, ANPD y soporte | Privacidad/Legal operativo | antes de lanzamiento público |
| certificación de 21 flujos | QA de producto, con validación del usuario | Corte F |

Una persona accountable y fecha objetivo deben incorporarse al ledger cuando
estos cortes sean aprobados para implementación; la auditoría no inventa nombres
ni compromisos que el proyecto aún no asignó.

---

## 18. Gates de aceptación

### Runtime

- cero `local_fixture` en una respuesta semántica Production;
- fallback externo medido y alertado;
- provider/modelo/config visibles por agente;
- p95 y costo total por turno.

### Conversación

- cero pérdida de foco en el corpus crítico;
- una sola pregunta indispensable;
- cero periodos inventados;
- cero elementos fuera del conjunto;
- reparación explícita después de error;
- respuesta sustentada en evidencia.

### Finanzas

- ninguna escritura desde modelo;
- Pending no afecta saldo;
- comando especializado por tipo;
- idempotencia por acción;
- retry sin duplicado;
- cancelación previa y auditoría posterior.

### Learning

- ninguna memoria estable sin evidencia;
- contradicción suspendida;
- sensibilidad confirmada;
- ver/corregir/olvidar;
- exportación y revocación efectivas.

### Producto

- 21 flujos con happy/error/loading/cancel/discreet;
- mobile y desktop;
- lenguaje visible canónico;
- uso parcial;
- modo discreto transversal;
- D1/D7/D30 medibles;
- calidad emocional evaluada por conversación.

---

## 19. Validación ejecutada en este corte

| Gate | Resultado 24/07/2026 |
|---|---|
| `npm run typecheck` | `OK` |
| `npm run lint` | `0 errores`, 2 warnings preexistentes |
| `npm test` | 141 archivos pasaron, 4 omitidos; 788 tests pasaron, 7 omitidos |
| `npm run build` | `OK`, Next.js 16.2.7 |
| Production pública | Auth móvil, Privacidad, Términos y Eliminación inspeccionados live |
| Runtime Production | claves inventariadas; valores sensibles no legibles por CLI; traza Risk local y ausencia de readiness registradas |
| Smokes con escritura/proveedores | no se repitieron: se usa la evidencia fechada del ledger y se mantiene su nivel `SMOKE/LIVE` |

Estos resultados prueban salud técnica del snapshot, no cumplimiento funcional
de los 21 flujos ni calidad sostenida con usuarios.

---

## 20. Veredicto integral

Manzana tiene una base financiera y operativa notablemente más madura que su
experiencia conversacional integral. Core, Pending, idempotencia, outbox,
deudas, Gmail autenticado y varias políticas de seguridad están bien
encaminados y algunos tienen evidencia live.

La V1 integral todavía no cumple el contrato completo:

- 0 de 21 flujos alcanza hoy cumplimiento integral extremo a extremo;
- 2 conservan evidencia técnica/live fuerte en un alcance acotado, pero la
  regresión de runtime y las variantes pendientes impiden marcarlos `Cumple`;
- los 21 permanecen parciales por canal, control, runtime, experiencia,
  evidencia o variantes;
- el aprendizaje es seguro en su semilla, pero incompleto como producto;
- la arquitectura interactiva tiene demasiadas autoridades semánticas;
- `local_fixture` incumple la política de Production solicitada;
- onboarding fuerte, lifecycle, métricas y modo discreto transversal siguen
  abiertos.

La recomendación no es “más agentes” ni “un archivo gigante”. Es una autoridad
semántica única para el turno, módulos internos tipados, Core determinista,
extractores aislados y agentes asíncronos sin autoridad financiera.

---

## 21. Registro de cobertura documental

La auditoría no trató los índices o documentos antiguos como prueba de
implementación. Se inventariaron sus contratos y criterios de aceptación y se
contrastaron con el código, pruebas y el ledger vivo. La siguiente tabla deja
explícito para qué se usó cada fuente.

### 21.1 Fuentes raíz y Fase 1

| Documento | Uso en la auditoría |
|---|---|
| `especificacion_producto_finanzas_personales_ia.md` | promesa, alcance, uso parcial, 11 tipos, memoria, métricas y definición final |
| `README.md` | comandos, stack, estructura y reglas resumidas |
| `roadmap_documentacion_completa.md` | jerarquía y dependencias entre fases |
| `fase_1_identidad/01_user_personas.md` | perfiles, ansiedad, registro diferido, uso parcial y micro-reconstrucción |
| `fase_1_identidad/02_nombre_producto.md` | identidad, tono de marca y planes preliminares |
| `fase_1_identidad/03_analisis_competitivo.md` | diferenciación WhatsApp/Latam/acompañamiento |
| `fase_1_identidad/04_tam_sam_som.md` | hipótesis de mercado y metas de escala; no prueba de producto |

### 21.2 Fase 2 — alcance funcional

| Documento | Uso en la auditoría |
|---|---|
| `05a_whatsapp.md` | conversación, ayuda, discreto, contexto insuficiente, trazabilidad y métricas |
| `05b_motor_ia.md` | grafo agentic, agentes, Core, tools, learning y calidad |
| `05c_dashboard.md` | pantallas, estados, control, uso parcial y métricas |
| `05d_email_parsing.md` | OAuth, Pending, dedup y confirmación; contiene deriva “un email” frente a Corte 32 |
| `05e_cuentas_cajas.md` | dinero libre, cuentas/cajas, null válido y reconciliación |
| `05f_categorias.md` | clasificación, corrección, learning y búsqueda |
| `05g_insights.md` | cálculo, evidencia, cadencia, acción y sensibilidad |
| `05h_deudas.md` | entidad propia, Debt Engine, pagos, cuotas y personas |
| `05i_recurrentes.md` | candidatos, confirmación, estados y agente híbrido |
| `05j_nudges.md` | opt-in, quiet hours, caps, discreto y readiness |
| `alcance_v1/indice.md` | mapa vivo de features y brechas declaradas |

### 21.3 Fase 3 — producto y experiencia

| Documento | Uso en la auditoría |
|---|---|
| `10_principios_experiencia.md` | jerarquía de calidad, emoción, recuperación y aceptación |
| `11_personalidad_conversacion.md` | voz, foco, humildad, sensibilidad, memoria y checklist por respuesta |
| `12_lenguaje_producto.md` | nombres visibles, términos prohibidos y lenguaje de incertidumbre |
| `13_onboarding_activacion.md` | primer valor, activación mínima/fuerte, rutas parciales y eventos |
| `14_flujos_usuario_v1.md` | autoridad de los 21 flujos y escenarios de prueba |
| `15_retencion_lifecycle.md` | estados D0–D30, playbooks, re-engagement y métricas |
| `16_confianza_errores.md` | confianza, expiración, corrección, rollback, origen y consistencia cross-channel |
| `17_dashboard_ux.md` | navegación, detalle, once tipos, estados, mobile y accesibilidad |
| `18_wireframes_prototipo.md` | matriz visual, estados y QA; prototipo subordinado a specs |
| `fase_3_producto/indice.md` | orden y fuentes de verdad de experiencia |

### 21.4 Fase 4 — arquitectura y estado vivo

| Documento | Uso en la auditoría |
|---|---|
| `06_arquitectura_sistema.md` | capas, autoridad, eventos, memoria, privacidad y escenarios |
| `15_stack_tecnologico.md` | fronteras de stack, ambientes, observabilidad y prohibiciones |
| `16_modelo_datos.md` | tablas, estados, RLS, learning, Pending y trazas |
| `17_eventos_workers.md` | gateway, outbox, jobs, idempotencia, DLQ y métricas |
| `18_api_spec.md` | endpoints, Core Commands, auth, errores e idempotencia |
| `19_agent_runtime_tools.md` | runtime, agentes, context packs, ToolGateway y evaluación |
| `20_decisiones_tecnicas.md` | decisiones aprobadas/no negociables; D036 conserva fallback local y requiere corrección |
| `21_decision_whatsapp_provider.md` | Kapso, ventana 24 h, templates, entrega y bloqueo externo |
| `22_decision_email_provider.md` | Gmail restricted scope, Limited Use, adapter y confirmación |
| `23_plan_implementacion_v1.md` | cortes, gates y qué podía mockearse temporalmente |
| `23b_seguimiento_construccion_v1.md` | estado vivo y evidencia fechada; prevalece sobre planes antiguos, no sobre runtime live posterior |
| `24_paquete_identidad_meta.md` | identidad pública y páginas requeridas |
| `25_scheduler_externo_v1.md` | contrato del scheduler y checklist operativo |
| `26_auditoria_captura_financiera_externa_v1.md` | Gate F, sender auth, grounding y captura fail-closed |
| `fase_4_tecnica/indice.md` | jerarquía y regla de mantenimiento |

### 21.5 Fases 5 y 6 — protección y visual

| Documento | Uso en la auditoría |
|---|---|
| `24_privacidad_proteccion_datos.md` | consentimiento, retención, derechos, soporte, discreto y checklist prelaunch |
| `25_unit_economics_costos.md` | costo por outcome, calidad por agente/canal y tablero faltante |
| `26_gtm_lanzamiento_v1_primeros_usuarios.md` | readiness, pausa, North Star y calidad antes de escala |
| `27_legal_operativo_v1.md` | ARCO, Limited Use, security assessment, soporte e incidentes |
| `fase_5_proteccion/indice.md` | criterio de cierre de confianza/protección |
| `28_identidad_visual_marca.md` | calma, anti-patrones, contraste, dark mode y marca |
| `29_design_system_ui.md` | tokens, componentes, estados, focus trap y modo discreto |
| `30_app_flow.md` | pantallas, navegación, entry points y estados |
| `31_wireflows.md` | 21 flujos + 4 transversales con variantes |
| `32_especificacion_hifi.md` | pantallas/estados obligatorios, once tipos y formularios |
| `33_stitch_handoff_v1.md` | 151 variantes, criterios de rechazo y QA visual |
| `fase_6_visual/indice.md` | orden de implementación visual |

Los dos documentos de auditoría son resultados de este corpus, no fuentes para
autovalidarse:

- `auditoria_integral_arquitectura_ia_conversacional_2026-07-23.md`;
- `matriz_cumplimiento_integral_v1_2026-07-24.md`.
