# Manzana — Especificación de Producto V1.0

**Producto:** Inteligencia financiera personal conversacional  
**Ultima actualizacion:** 2 de junio, 2026  
**Estado:** Sincronizada con alcance V1.0 actual, Fase 5 y Fase 6 visual V1  

---

## 1. Resumen general

Manzana es una plataforma de inteligencia financiera personal para usuarios individuales. Su interfaz principal es WhatsApp y su promesa central es ayudar al usuario a entender su dinero sin hacer contabilidad.

El producto permite registrar movimientos financieros de forma natural, consultar su situación financiera, corregir errores, recibir claridad sobre patrones y avanzar progresivamente hacia funciones más profundas como cuentas, cajas, deudas, recurrentes, insights, email parsing y nudges.

La experiencia debe sentirse:

- rápida,
- humana,
- flexible,
- no contable,
- no juzgadora,
- y cada vez más inteligente con el uso.

El producto no busca registrar cada centavo de forma perfecta. Busca convertir información financiera imperfecta en claridad útil.

---

## 2. Estado real de la especificación

Esta especificación refleja el alcance actual del proyecto completo, pero reconoce distintos niveles de madurez documental.

| Área | Estado actual | Documento fuente |
|---|---|---|
| WhatsApp conversacional | Especificación avanzada | `docs/fase_2_estrategia/alcance_v1/05a_whatsapp.md` |
| Motor IA | Especificación avanzada | `docs/fase_2_estrategia/alcance_v1/05b_motor_ia.md` |
| Dashboard | Especificación avanzada + contrato UX | `docs/fase_2_estrategia/alcance_v1/05c_dashboard.md`, `docs/fase_3_producto/17_dashboard_ux.md`, `docs/fase_3_producto/18_wireframes_prototipo.md` |
| Email parsing | Especificación avanzada | `docs/fase_2_estrategia/alcance_v1/05d_email_parsing.md` |
| Cuentas y cajas | Especificación avanzada | `docs/fase_2_estrategia/alcance_v1/05e_cuentas_cajas.md` |
| Categorías y etiquetas | Especificación avanzada | `docs/fase_2_estrategia/alcance_v1/05f_categorias.md` |
| Insights | Especificación avanzada | `docs/fase_2_estrategia/alcance_v1/05g_insights.md` |
| Deudas | Especificación avanzada | `docs/fase_2_estrategia/alcance_v1/05h_deudas.md` |
| Recurrentes / Pagos que vienen | Especificación avanzada | `docs/fase_2_estrategia/alcance_v1/05i_recurrentes.md` |
| Nudges / Recordatorios | Especificación avanzada | `docs/fase_2_estrategia/alcance_v1/05j_nudges.md` |
| Arquitectura sistema | Sincronizada con Motor IA, Fase 3 y decision log tecnico | `docs/fase_4_tecnica/06_arquitectura_sistema.md` |
| Fase 4 tecnica | Arquitectura, decision log, stack base aprobado, decisiones WhatsApp/Email, contrato logico de datos, eventos, API, AgentRuntime y plan de implementacion V1 | `docs/fase_4_tecnica/indice.md` |
| Fase 5 proteccion | Privacidad, proteccion de datos, consentimiento, retencion, derechos del usuario, unit economics, costos sostenibles, GTM de lanzamiento V1 directo, legal operativo y calidad sin friccion | `docs/fase_5_proteccion/indice.md` |
| Fase 6 identidad visual | Reconstruida como fuente visual documental V1: identidad, design system, app flow, wireflows, especificacion Hi-Fi y handoff Stitch | `docs/fase_6_visual/indice.md` |

Principio de lectura:

> WhatsApp, Motor IA, Email Parsing, Cuentas/Cajas, Categorias/Etiquetas, Insights, Deudas, Recurrentes, Nudges, Fase 3 Producto, Fase 4 Tecnica, Fase 5 Proteccion y Fase 6 Visual ya quedan sincronizados como base para implementacion inicial.

Nota visual:

> Fase 6 visual ya existe como fuente documental V1. El prototipo visual generado en Stitch o herramienta equivalente puede seguir pendiente de aprobacion final, pero la identidad visual, tokens, componentes, estados y handoff ya deben tomarse desde `docs/fase_6_visual/`. Esto no cambia alcance V1, reglas funcionales, reglas financieras, arquitectura ni email parsing.

---

## 3. Problema principal

Muchas personas sienten que el dinero se les va, pero no logran sostener el hábito de registrarlo.

El usuario suele abandonar porque:

- registrar da flojera,
- clasificar manualmente fricciona,
- las apps financieras parecen contables,
- los presupuestos rígidos generan culpa,
- la vida financiera real es irregular,
- y los datos perfectos son difíciles de mantener.

El enemigo principal del producto es la fricción. El segundo enemigo es la culpa.

Manzana debe resolver:

> "No sé en qué se me va la plata"  
> transformándolo en:  
> "Ahora entiendo cómo vivo mi dinero."

---

## 4. Propuesta de valor

### Propuesta principal

**Entiende tu dinero sin hacer contabilidad.**

### Propuesta extendida

Manzana registra, interpreta y explica la vida financiera del usuario usando conversación, memoria contextual y motores de análisis. No solo guarda movimientos: ayuda a entender patrones, compromisos, dinero libre, deudas, recurrentes y cambios relevantes.

### Diferencial

El diferencial no es registrar gastos. El diferencial es:

- WhatsApp como interfaz principal,
- IA conversacional personalizada,
- memoria financiera consultable,
- experiencia progresiva,
- aprendizaje por correcciones,
- deudas personales e informales,
- dinero disponible real,
- y claridad sin culpa.

---

## 5. Filosofía del producto

Manzana debe:

- acompañar, no juzgar;
- explicar, no regañar;
- preguntar cuando hay duda, no asumir;
- adaptarse al usuario, no forzarlo;
- permitir uso parcial;
- revelar funciones progresivamente;
- mostrar confianza y fuente;
- permitir corregir todo;
- distinguir dinero total de dinero libre;
- y respetar privacidad.

Ejemplo incorrecto:

```text
Superaste tu presupuesto.
```

Ejemplo correcto:

```text
Tus gastos en comida subieron esta semana. ¿Quieres ver qué cambió?
```

### 5.1 Principio transversal: experiencia que entiende a la persona

Manzana no debe construirse como una suma de features. Debe sentirse como una experiencia coherente que entiende a la persona, su contexto, su forma de hablar, sus dudas, sus hábitos y su relación emocional con el dinero.

Este principio aplica a todo:

| Área | Cómo se aplica |
|---|---|
| Diseño de app | La UI no debe sentirse contable ni fría. Debe mostrar claridad, control y calma. |
| WhatsApp | La conversación debe sonar natural, breve, útil y adaptada al estilo del usuario. |
| Motor IA | El Orchestrator no solo decide intención; también decide profundidad, tono, momento y nivel de acompañamiento. |
| Registro | Registrar debe sentirse fácil, tolerante a datos incompletos y corregible. |
| Dashboard | Debe ayudar a revisar, entender y actuar, no solo mostrar tablas. |
| Insights | Deben sentirse como descubrimientos personales, no como métricas genéricas. |
| Deudas y recurrentes | Deben reducir ansiedad y olvido, no aumentar presión. |
| Nudges | Deben acompañar con respeto, no perseguir. |
| Errores y ambigüedad | El sistema debe preguntar con humildad y explicar qué necesita. |

Regla de producto:

> Cada decisión de implementación debe preguntarse: ¿esto ayuda a que el usuario se sienta entendido, con más claridad y con menos fricción?

Si una feature es técnicamente correcta pero se siente fría, invasiva, rígida o culpabilizante, todavía no está bien resuelta para Manzana.

### 5.2 Definición de wow en Manzana

Wow no significa espectáculo, animaciones, copy exagerado ni IA intentando impresionar.

Wow tiene dos capas:

1. **Capa funcional:** personal, sorprendente, explicable, accionable y amable.
2. **Capa psicológica:** autodescubrimiento financiero amable.

La segunda no reemplaza la primera. La eleva.

Wow profundo significa:

> El usuario se reconoce en una explicación útil sobre su dinero y siente alivio, no juicio.

Fórmula interna:

```text
wow = claridad útil + autodescubrimiento amable
```

Versión psicológica:

```text
wow = espejo personal + verdad concreta + alivio emocional + siguiente paso pequeño
```

La reacción buscada:

- "Ah, esto era lo que me estaba pasando."
- "Me leyó bien."
- "No soy un desastre; ahora veo el patrón."
- "Puedo hacer algo pequeño con esto."

Regla psicológica:

> Manzana observa patrones, no diagnostica a la persona.

El producto debe mover al usuario de confusión a claridad, de culpa a alivio, de desorden a patrón visible y de ansiedad a un control pequeño.

---

## 6. Usuario objetivo inicial

Manzana empieza con usuarios individuales, no parejas, familias, equipos ni negocios.

Perfil psicológico:

- quieren ordenarse,
- usan WhatsApp constantemente,
- tienen gastos pequeños frecuentes,
- abandonan herramientas complejas,
- no quieren contabilidad,
- aceptan datos imperfectos si reciben claridad,
- y valoran una experiencia que se siente humana.

Segmentos iniciales:

- personas que sienten que la plata se les va,
- personas con gastos hormiga,
- personas con ingresos variables,
- personas con deudas personales o cuotas,
- personas que quieren recordar pagos,
- personas que quieren ordenarse sin Excel.

---

## 7. Principio de uso parcial

El usuario no tiene que usar todo Manzana para recibir valor.

Casos válidos:

- usar solo WhatsApp para registrar gastos,
- usar solo deudas,
- usar solo recurrentes y recordatorios,
- usar cuentas/cajas para saber dinero libre,
- usar email parsing para capturar pagos olvidados,
- usar dashboard para revisar historial,
- usar insights cuando ya hay datos suficientes.

El sistema debe adaptarse a la intención principal del usuario.

---

## 8. Entidad central: Movimiento Financiero

Todo gira alrededor del movimiento financiero.

Un movimiento financiero es cualquier evento que mueve, cambia, registra o explica dinero del usuario.

No todo movimiento es gasto.

Ejemplos:

- gastar S/15 en taxi,
- recibir S/500,
- pasar S/100 de Yape a BCP,
- separar S/200 para una caja,
- deberle S/50 a Luis,
- pagar una cuota,
- recibir una devolución,
- corregir un movimiento.

---

## 9. Tipos canónicos de movimiento V1.0

Estos tipos son controlados por el sistema. La IA no crea tipos libremente.

Tipos V1.0:

1. `gasto`
2. `ingreso`
3. `transferencia`
4. `asignacion_interna`
5. `deuda_adquirida`
6. `pago_deuda`
7. `prestamo_dado`
8. `prestamo_recibido`
9. `devolucion_recibida`
10. `pago_recurrente`
11. `ajuste`

Cambios frente al spec anterior:

- `ahorro` deja de ser tipo principal y se modela como `asignacion_interna` hacia una caja.
- `deuda` se separa en deuda adquirida, pago de deuda, préstamo dado/recibido y devolución recibida.
- `pago_recurrente` se incorpora como tipo V1.0.
- `inversion` queda fuera de alcance.

---

## 10. Mapa de features V1.0

### P0 — Core de experiencia

| Feature | Rol | Estado |
|---|---|---|
| WhatsApp conversacional | Interfaz principal de captura, consulta, corrección y confirmación | Avanzado |
| Motor IA agentic controlado | Orquesta agentes, memoria, contexto, políticas y respuestas | Avanzado |
| Dashboard inteligente | Revisión, historial, registro manual estructurado, estados progresivos y confianza visual | Avanzado |
| Email parsing | Captura pasiva por email con confirmación por WhatsApp | Avanzado |
| Cuentas y cajas | Dinero disponible real, compromisos y separación mental del dinero | Avanzado |

### P1 — Profundidad financiera

| Feature | Rol | Estado |
|---|---|---|
| Categorías y subcategorías | Clasificación base, personalización y aprendizaje por usuario | Avanzado |
| Etiquetas contextuales | Capa humana de significado, corregible y protegida por políticas | Avanzado |
| Insights | Descubrimientos accionables con evidencia, umbrales y privacidad | Avanzado |
| Historial de movimientos | Búsqueda, filtros, fuente, correcciones y creación manual desde Dashboard | Base dentro de Dashboard |
| Deudas | Entidad financiera propia con pagos, cuotas, personas, estados y privacidad | Avanzado |
| Recurrentes / Pagos que vienen | Pagos esperados, cuotas, suscripciones, detección, confirmación, ocurrencias y dinero libre | Avanzado |

### P2 — Retención y acompañamiento

| Feature | Rol | Estado |
|---|---|---|
| Nudges / Recordatorios | Avisos proactivos con opt-in, anti-spam, modo discreto, prioridad y medición | Avanzado |
| Personas relacionadas | Entidades ligeras privadas para deudas y préstamos | Avanzado dentro de Deudas |

---

## 11. WhatsApp conversacional

WhatsApp es la interfaz principal de Manzana.

Debe permitir:

- registrar movimientos simples,
- registrar múltiples movimientos,
- corregir,
- borrar,
- deshacer,
- consultar,
- confirmar emails,
- revisar pendientes,
- crear deudas,
- crear cajas,
- manejar nudges,
- y cambiar preferencias.

Principios:

- no pedir confirmación si el mensaje es claro y de bajo riesgo,
- preguntar una sola vez cuando haya duda,
- permitir cambio de intención,
- respetar cancelación global,
- mantener estado conversacional,
- responder breve cuando el usuario es breve,
- y nunca ocultar errores.

---

## 12. Motor IA

El motor IA de Manzana es agentic controlado.

No es un LLM decidiendo todo. Es:

- `FinancialOrchestrator` modular,
- agentes especializados,
- `ContextPackBuilder`,
- `ToolGateway`,
- memoria financiera consultable,
- motores de calidad de experiencia,
- Domain Engines determinísticos,
- `PolicyGate`,
- `CommandDispatcher`,
- Core Financiero,
- `transactional_outbox`,
- Internal Domain Event Bus,
- observabilidad.

Tesis:

> IA para entender lenguaje, contexto e intención.  
> Determinismo para cuidar el dinero real.

Agentes principales:

- `DataAgent`
- `ConversationAgent`
- `CorrectionAgent`
- `ResponseAgent`
- `InsightExperienceAgent`
- `InsightNarratorAgent`

Runtime:

- etapa actual: Codex-first;
- etapa futura: API-ready por agente;
- híbrido posible: algunos agentes en Codex, otros vía API.

---

## 13. Memoria y contexto

La memoria no vive dentro del modelo. Vive en la base de datos, Core y capas derivadas.

El agente no recibe todo el historial. Recibe `Context Packs` mínimos y consulta memoria mediante herramientas read-only.

Capas de memoria:

- memoria estructurada,
- memoria agregada,
- memoria semántica,
- memoria narrativa,
- memoria de patrones,
- memoria conversacional activa.

Herramientas de memoria:

- `DateResolver`,
- `FinancialQueryEngine`,
- `TimelineMemory`,
- `SemanticMemorySearch`,
- `PatternMemory`,
- `NarrativeMemory`,
- `ExplanationEngine`.

Esto permite respuestas como:

```text
"¿Por qué este mes siento que se me va más plata?"
```

sin meter todo el historial en el prompt.

---

## 14. Motores de calidad de experiencia

Manzana debe sentirse más útil con el uso. Para eso, el motor IA incorpora motores de calidad:

| Función | Motores |
|---|---|
| Contexto y personalización | `ExperienceIntelligenceEngine`, `PersonalizationLoopEngine`, `NarrativeMemoryEngine` |
| Diagnóstico y comprensión | `ChangeDetectionEngine`, `MicroReconstructionEngine` |
| Decisión conversacional | `ClarificationStrategyEngine`, `TrustExperienceLayer` |
| Acción y utilidad | `NextBestActionEngine`, `ActionableInsightEngine` |
| Retención y acompañamiento | `DailyWeeklyReviewEngine` |

Estos motores no son features visuales sueltas. Son mecanismos que hacen que la experiencia se sienta inteligente, personalizada y útil.

---

## 15. Dashboard inteligente

El Dashboard no reemplaza WhatsApp. Es el espacio de revisión, claridad y control.

Debe mostrar progresivamente:

- resumen actual,
- dinero disponible,
- movimientos recientes,
- historial con filtros,
- creación manual estructurada de movimientos,
- categorías,
- cuentas,
- cajas,
- deudas,
- recurrentes,
- pendientes,
- fuente de cada movimiento,
- confianza,
- y acciones de corrección.

Estados progresivos:

- vacío,
- temprano,
- funcional,
- completo.

El Dashboard debe adaptarse al uso real: si el usuario nunca usa deudas, no debe abrumarlo con deudas; si tiene pendientes, debe mostrarlos claramente.

### Registro manual desde Dashboard

WhatsApp es el flujo principal de captura, pero el Dashboard debe permitir registrar un movimiento cuando el usuario ya está revisando su dinero.

Esta capacidad no debe ser un formulario contable pesado ni una pantalla principal de captura. Debe ser una acción disponible en Movimientos y en contextos donde tenga sentido.

Alcance V1:

- crear gasto,
- crear ingreso,
- crear transferencia,
- crear asignación interna,
- registrar pago de deuda,
- registrar préstamo dado/recibido/devolución,
- registrar pago recurrente,
- crear ajuste cuando aplique.

Reglas:

- usa el enum canónico de movimientos V1.0;
- pide los campos necesarios según tipo;
- no depende de IA para guardar;
- va directo al Core Financiero con validadores, audit log y transactional outbox;
- fuente visible: `Dashboard/manual`;
- si parece duplicado, el sistema advierte antes de guardar;
- si es deuda, recurrente, caja o transferencia, se apoya en el motor determinístico correspondiente;
- la búsqueda natural del Dashboard sigue siendo read-only.

---

## 16. Email parsing

Email parsing es captura pasiva, no registro automático.

Principio:

> Todo movimiento detectado por email siempre pide confirmación por WhatsApp. No existe auto-registro en V1.

Decision tecnica V1:

> El proveedor inicial es Gmail API + Pub/Sub via `EmailAdapter`. Outlook/IMAP/forwarding quedan como futuros proveedores posibles. Manzana no pide contrasenas de email, no usa scraping y no guarda el cuerpo completo del email por defecto.

Flujo:

```text
Email detectado
-> Email Adapter extrae datos mínimos
-> DataAgent normaliza
-> Dedup Engine revisa duplicado
-> Pending Inbox crea pendiente
-> WhatsApp pide confirmación
-> Core registra solo si usuario confirma
```

Reglas:

- no almacenar email completo por defecto,
- leer solo emails financieros permitidos,
- manejar duplicados,
- no asumir ingreso cuando hay duda,
- enviar a pendientes si no hay respuesta,
- permitir revisión batch.
- aplicar estrategia de ventana 24h: WhatsApp confirma cuando hay conversacion activa; si el usuario no responde, los nuevos pendientes se acumulan en Centro de Confirmaciones/app en vez de enviar un WhatsApp por cada email.
- incluir link/Flow a Pendientes cuando conviene, sin reemplazar WhatsApp como canal principal de confirmacion.

---

## 17. Cuentas y cajas

Principio:

> Dinero disponible no es dinero total.

Cuenta = dónde está el dinero.  
Caja = para qué está separado.

Ejemplos de cuentas:

- Yape,
- BCP,
- efectivo,
- Plin,
- Interbank.

Ejemplos de cajas:

- alquiler,
- emergencia,
- viaje,
- cuota laptop.

`Libre` no es una caja guardada. Es un cálculo: saldo de cuentas menos dinero separado en cajas.

La IA debe poder responder mejor preguntas como:

```text
¿Puedo gastar S/50 hoy?
```

usando saldos, compromisos, cajas, deudas y recurrentes.

---

## 18. Categorías, subcategorías y etiquetas

Las categorías convierten movimientos sueltos en claridad financiera. No reemplazan saldos, cuentas, cajas, deudas ni recurrentes.

Categorías base V1.0, fijas y canónicas:

1. Alimentación
2. Transporte
3. Vivienda / Hogar
4. Servicios / Suscripciones
5. Salud
6. Educación
7. Ocio / Salidas
8. Compras personales
9. Familia / Apoyo
10. Deudas
11. Trabajo / Productividad
12. Otros

Regla importante:

- `otros` significa que el movimiento es claro, pero no encaja bien en las 12 categorías.
- `sin clasificar` no es categoría. Se modela como `category_id: null` + `classification_status: needs_review`.

Las subcategorías crecen por usuario y no son globales:

- café,
- delivery,
- taxi,
- Uber,
- menú,
- farmacia,
- Netflix,
- internet.

Etiquetas contextuales base:

- necesario,
- gusto,
- impulso,
- recurrente,
- social,
- trabajo,
- estrés,
- fin_de_semana.

La IA puede sugerir categoría, subcategoría y etiquetas; el Core valida; el usuario puede corregir; el Learning Engine aprende patrones personales.

En V1, Dashboard y WhatsApp deben permitir revisar y corregir clasificación. Email parsing solo puede crear pendientes con sugerencia, nunca registrar automáticamente sin aprobación.

---

## 19. Deudas

Las deudas son entidad financiera propia. No son solo una categoría ni un gasto. Pueden existir aunque el usuario no registre todos sus gastos.

Principio:

> Manzana ayuda a recordar, entender y ordenar deudas. No cobra, no contacta terceros y no juzga.

Tipos V1:

- deuda informal personal,
- deuda a favor,
- deuda bancaria o préstamo,
- tarjeta de crédito,
- cuota fija,
- préstamo recibido,
- préstamo dado.

Reglas clave:

- `pago_deuda` no es un gasto genérico.
- `prestamo_dado`, `prestamo_recibido` y `devolucion_recibida` tienen tratamiento propio.
- tarjeta de crédito no es cuenta de dinero disponible.
- email no confirmado no actualiza deuda.
- una deuda puede actualizarse aunque el pago tenga cuenta `null`; en ese caso no afecta saldos por cuenta.
- personas relacionadas son ligeras y privadas: nombre, alias y relación; no teléfono, cuenta bancaria ni contacto.

Operaciones:

- registrar deuda,
- pagar parcial,
- pagar total,
- recibir devolución,
- aplicar interés/mora,
- renegociar,
- cerrar deuda,
- vincular cuota recurrente.

Debt Engine mantiene:

- saldo pendiente,
- monto pagado,
- cuotas,
- vencimientos,
- estados,
- pagos,
- ajustes,
- vínculos con cajas, recurrentes, emails confirmados e insights.

---

## 20. Recurrentes / Pagos que vienen

`Recurrentes` es el nombre tecnico. Frente al usuario, la experiencia debe hablar de **Pagos que vienen** o **Compromisos**, segun contexto.

Los pagos que vienen son pagos esperados que el usuario sabe que vienen o que el sistema detecta por patrón.

Principio:

> Un recurrente es una expectativa financiera. No es un movimiento real hasta que el usuario lo paga, confirma o existe una fuente aprobada.

Regla de lenguaje:

- En codigo, contratos y arquitectura: `Recurrentes`, `Recurring Engine`, `pago_recurrente`.
- En Dashboard si agrupa deudas, cuotas y pagos esperados: **Compromisos**.
- En Dashboard si muestra solo pagos periodicos: **Pagos que vienen**.
- En WhatsApp: "pagos que vienen", "pagos que se repiten", "lo que vuelve cada mes".
- Evitar pedirle al usuario que entienda la palabra "recurrente".

Tipos:

- monto fijo, fecha fija,
- monto fijo, fecha aproximada,
- monto variable, fecha fija,
- monto variable, fecha aproximada,
- suscripción,
- servicio,
- alquiler,
- cuota vinculada a deuda,
- pago manual,
- pago detectado por email pendiente de confirmación.

Reglas:

- detectar recurrente no significa activarlo sin permiso,
- email no registra pago recurrente automáticamente en V1,
- un recurrente activo puede afectar dinero libre operativo como compromiso próximo,
- un recurrente esperado no modifica saldo de cuenta hasta pago confirmado,
- si está cubierto por caja compromiso, no debe descontarse dos veces,
- si está vinculado a deuda, Debt Engine conserva el saldo y progreso,
- el usuario puede pausar, cancelar, saltar un periodo o editar condiciones,
- cambios de monto deben mostrarse explícitamente,
- Dashboard debe mostrar activos, próximos, vencidos y sugeridos.

Ejemplo:

```text
He visto Netflix cerca de esta fecha por 3 meses. ¿Quieres marcarlo como pago recurrente?
```

Ejemplo de pago:

```text
Usuario: pagué internet
Manzana: Listo. Marqué Internet como pagado por S/89.
```

---

## 21. Insights y nudges

Los insights no son reportes. Son descubrimientos accionables calculados por motores determinísticos y narrados por IA cuando aporta claridad.

Para elevar calidad de producto, Insights puede usar dos agentes:

- `InsightExperienceAgent`: decide framing, timing, profundidad y potencial de autodescubrimiento/wow sobre insights ya validados. No calcula dinero.
- `InsightNarratorAgent`: redacta el mensaje final de forma breve, clara, amable y explicable.

Tipos de insight:

- aprendizaje temprano,
- comparativo,
- categórico,
- patrón temporal,
- anomalía,
- proyección,
- emocional,
- deuda,
- progreso/refuerzo positivo,
- ahorro/caja,
- liquidez/dinero libre,
- recurrente,
- calidad de datos.

Reglas:

- no enviar si no hay datos suficientes,
- explicar fuente,
- no juzgar,
- ser accionable cuando sea posible,
- no contar emails sin confirmar como gasto real,
- no contar transferencias/asignaciones internas como gasto,
- recalcular o expirar insights cuando el usuario corrige movimientos,
- marcar como desactualizados los insights ya mostrados si cambian los datos base,
- respetar frecuencia máxima por canal,
- pasar por Nudge Policy, Risk Policy, modo discreto y opt-in antes de cualquier envío proactivo.

Dashboard es el canal principal para explorarlos. WhatsApp solo debe usarse para resumen semanal o insight puntual si el usuario lo permite y el contexto no es sensible.

Desde producto/marketing, el lenguaje externo debe sentirse más humano que técnico. Internamente pueden llamarse insights, pero para el usuario conviene hablar de "Descubrimientos", "Lo que Manzana notó", "Tu semana en claro" o "Algo que cambió".

El primer wow debe llegar temprano con micro-descubrimientos seguros: mostrar que Manzana está aprendiendo, sin inventar patrones antes de tener evidencia. En V1, el primer descubrimiento útil se activa cuando el usuario alcanza 5 movimientos confirmados y se muestra principalmente en Dashboard Home. La prioridad no es mostrar la métrica más compleja, sino la que más ayude al usuario a reconocerse en un patrón útil, concreto y no culpabilizante.

`Nudges` es nombre interno. Para el usuario, conviene hablar de **Recordatorios**, **Avisos** o "te aviso si...".

Los recordatorios proactivos deben sentirse como ayuda oportuna, no como persecución.

Reglas de nudges:

- opt-in granular,
- máximo 2 por día,
- horario silencioso,
- pausa/cancelación,
- modo discreto,
- no enviar si sería repetitivo o invasivo,
- priorizar si varios avisos compiten,
- agrupar pendientes en batch,
- no enviar datos ya resueltos,
- enviar insights por WhatsApp solo si pasan Nudge Policy,
- permitir Dashboard-only cuando no conviene interrumpir,
- medir respuesta, acción, ignorados, pausas y opt-outs.

La decisión de enviar la toma `NudgePolicyEngine`, no un agente libre. Los agentes pueden redactar o explicar, pero no decidir interrumpir al usuario.

### Modo discreto como política transversal

Modo discreto no es solo una opción de WhatsApp. Es una política de privacidad para toda comunicación proactiva de Manzana.

Si el usuario tiene modo discreto activo, Manzana debe ocultar detalles sensibles cuando el sistema inicia el contacto o muestra información fuera de una sesión autenticada.

Datos que no deben aparecer en mensajes proactivos discretos:

- montos,
- nombres de comercios,
- bancos o cuentas,
- nombres de personas,
- saldos,
- deudas específicas,
- categorías sensibles.

Ejemplo:

```text
Normal: Tu cuota de tarjeta BCP por S/180 vence mañana.
Discreto: Tienes un pago importante que vence mañana. Escribe "ver pago" para detalles.
```

Excepciones:

- si el usuario pregunta directamente, Manzana puede responder con detalle;
- en Dashboard autenticado se puede mostrar información completa;
- en previews, push notifications o mensajes proactivos se debe aplicar redacción discreta.

La decisión operativa la toma `PolicyGate` dentro del Motor IA. El `ResponseAgent` puede redactar, pero no decide saltarse la política.

---

## 22. Metas y límites

El spec anterior mencionaba ejemplos de límites, como cafés o delivery.

Estado actual:

- no existe documento propio definitivo de metas/límites;
- el Motor IA tiene `BudgetGoalReactor` como hook opcional;
- no debe prometerse como feature V1 completa hasta tener documento específico.

Sí puede existir como caso puntual si el usuario configuró un límite o si otro dominio lo soporta.

Ejemplo permitido solo si existe configuración:

```text
Vas cerca de tu límite semanal de café. Te quedan S/6.
```

---

## 23. Shareability

El spec anterior incluía shareables como parte de una versión inicial antigua.

Estado actual:

> Shareability no está cubierto en el alcance V1.0 actual y debe considerarse futuro.

Puede volver como V1.2 o etapa posterior, cuando existan:

- datos suficientes,
- privacidad clara,
- triggers de generación,
- reglas de no exponer dinero sensible,
- y sub-sistema visual propio basado en Fase 6 si se decide retomarlo como feature futura.

No debe bloquear el V1.0.

---

## 24. Qué queda fuera de V1.0

Fuera de alcance:

- ERP,
- negocios,
- equipos,
- parejas/familias,
- roles y permisos multiusuario,
- división de pagos,
- contactos como red social,
- inversiones,
- asesoría tributaria,
- recomendación de bancos o productos financieros,
- facturación,
- contabilidad avanzada,
- integración bancaria directa compleja,
- voz,
- OCR,
- shareables,
- multi-moneda UI completa,
- metas/límites avanzados sin documento propio.

Notas:

- PEN es moneda principal.
- USD puede existir a nivel de modelo de datos, pero UI multi-moneda completa queda fuera de V1.0.
- Email parsing no es integración bancaria directa.

---

## 25. Estrategia V1.0

Objetivo V1.0:

Validar que Manzana puede crear hábito, confianza y claridad financiera usando WhatsApp + IA.

Hipótesis principales:

- Las personas registran más si usan WhatsApp.
- La IA reduce fricción.
- La corrección/aprendizaje aumenta confianza.
- El dinero disponible real es más valioso que el balance total.
- Los insights accionables aumentan retención.
- Email parsing aumenta captura sin quitar control.
- Deudas y recurrentes dan valor incluso sin registro perfecto.

---

## 26. Métricas principales

| Área | Métrica | Meta inicial |
|---|---|---|
| WhatsApp | Mensajes interpretados sin aclaración | `>= 80%` |
| Motor IA | Accuracy tipo + monto | `>= 95%` tipo, `>= 99%` monto |
| Dashboard | Visitas semanales por usuario activo | `>= 1` |
| Email parsing | Transacciones útiles capturadas | `>= 85%` |
| Cuentas/Cajas | Usuarios que crean al menos 1 caja | `>= 30%` al D30 |
| Deudas | Pagos o actualizaciones de deuda | `>= 1/semana` en usuarios con deudas |
| Recurrentes | Recurrentes detectados correctamente | `>= 80%` |
| Nudges | Respuesta post-nudge | `>= 30%` |
| Confianza | Correcciones resueltas sin abandono | Alta retención post-corrección |

---

## 27. Brechas detectadas frente al spec anterior

Estas funcionalidades aparecían en la especificación antigua, pero no están cubiertas como alcance completo actual:

| Funcionalidad | Estado recomendado |
|---|---|
| Shareables básicos | Mover a futuro/V1.2. |
| Voz | Futuro. |
| OCR | Futuro. |
| Integraciones bancarias directas | Futuro; V1 usa email parsing. |
| Ahorro como tipo de movimiento | Reemplazar por cajas/asignación interna. |
| Inversión | Fuera de alcance. |
| Metas/límites avanzados | Requiere documento propio. |
| App/PWA como registro completo | Aclarado: Dashboard permite registro manual estructurado, pero WhatsApp sigue siendo el flujo principal. No se busca equivalencia conversacional completa en V1. |
| Monetización/planes | Preliminar; no debe condicionar V1.0 hasta definir unit economics. |
| Identidad visual/UI | Resuelta como fuente documental V1 en Fase 6; prototipo visual generado sujeto a aprobacion contra esos documentos. |

---

## 28. Definición final del producto

### Definición resumida

Manzana es una inteligencia financiera personal conversacional que ayuda al usuario a registrar, entender y recordar su dinero sin hacer contabilidad.

### Definición emocional

```text
Tu dinero explicado como si alguien realmente te conociera.
```

### Definición técnica

Sistema centrado en movimientos financieros personales, con WhatsApp como interfaz principal, Motor IA agentic controlado, memoria financiera consultable, Core financiero determinístico, experiencia progresiva y automatizaciones respetuosas.
