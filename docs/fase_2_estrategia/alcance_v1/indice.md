# Manzana V1.0 — Índice Vivo del Alcance

**Paso 5/20 del Roadmap de Documentación**  
**Ultima actualizacion:** 2 de junio, 2026  
**Estado:** V22 - Sincronizado con especificacion de producto, Fase 3, Fase 4, Fase 5 Proteccion y Fase 6 visual V1

---

## 1. Propósito de este índice

Este documento es el mapa vivo del alcance V1.0. No reemplaza los documentos por feature; sirve para mostrar:

- qué features existen en V1.0,
- qué tan madura está cada especificación,
- qué sistemas transversales conectan todo,
- qué queda fuera de V1.0,
- y qué brechas documentales siguen abiertas.

Estado real actual:

> WhatsApp, Motor IA, Dashboard, Email Parsing, Cuentas/Cajas, Categorias/Etiquetas, Insights, Deudas, Recurrentes, Nudges, Fase 3 Producto, Fase 4 Tecnica, Fase 5 Proteccion y Fase 6 Visual ya estan sincronizados como base para implementacion inicial.

Nota visual:

> Fase 6 Visual ya existe como fuente documental V1 para identidad, design system, app flow, wireflows, especificacion Hi-Fi y handoff. El prototipo visual generado en Stitch o herramienta equivalente puede seguir pendiente de aprobacion final contra esos documentos.

---

## 2. Filosofía del V1.0

Manzana V1.0 no es una app contable. Es una inteligencia financiera personal conversacional.

Principios:

| # | Principio | Implicación |
|---|---|---|
| 1 | WhatsApp captura | La interfaz principal de entrada es conversacional. |
| 2 | Dashboard da claridad y control | No compite con WhatsApp; revisa, explica, corrige y confirma. |
| 3 | IA acompaña, no decide todo | El Motor IA entiende lenguaje, pero el dinero se protege con reglas. |
| 4 | Todo es movimiento financiero | El sistema modela gastos, ingresos, deudas, transferencias, cajas, recurrentes y ajustes. |
| 5 | Datos imperfectos son válidos | El sistema trabaja con información incompleta y ayuda a reconstruir. |
| 6 | Experiencia progresiva | Features aparecen cuando el contexto las hace relevantes. |
| 7 | Uso parcial es válido | Un usuario puede usar solo gastos, solo deudas, solo recurrentes o todo. |
| 8 | Confianza primero | Fuente, corrección, explicación y confirmación son parte del producto. |
| 9 | Dinero libre no es dinero total | El valor real es saber cuánto se puede usar. |
| 10 | Nada de culpa | Manzana explica cambios sin juzgar. |
| 11 | Experiencia que entiende a la persona | Cada flujo, pantalla, agente y mensaje debe hacer que el usuario se sienta entendido, no procesado. |

Principio transversal:

> Manzana no se implementa como una lista de features. Se implementa como una experiencia que conecta con la persona: entiende su lenguaje, respeta su contexto, reduce fricción, explica con calma y vuelve útil la información financiera imperfecta.

---

## 3. Estado de documentos V1.0

| Archivo | Feature | Estado actual |
|---|---|---|
| `05a_whatsapp.md` | WhatsApp Conversacional Inteligente | Avanzado |
| `05b_motor_ia.md` | Motor IA Agentic Controlado | Avanzado |
| `05c_dashboard.md` | Dashboard Inteligente | Avanzado |
| `05d_email_parsing.md` | Email Parsing con Confirmación | Avanzado |
| `05e_cuentas_cajas.md` | Cuentas y Cajas Inteligentes | Avanzado |
| `05f_categorias.md` | Categorías + Subcategorías + Etiquetas | Avanzado |
| `05g_insights.md` | Insights Accionables | Avanzado |
| `05h_deudas.md` | Deudas + Personas Relacionadas | Avanzado |
| `05i_recurrentes.md` | Pagos Recurrentes / Pagos que vienen | Avanzado |
| `05j_nudges.md` | Nudges Inteligentes / Recordatorios | Avanzado |

Leyenda:

- **Avanzado:** especificación profunda, con arquitectura, flujos, reglas, criterios claros o contrato UX complementario.
- **Base funcional:** define intención y reglas principales, pero aún falta profundización.

---

## 4. Mapa de features V1.0

### P0 — Core de experiencia

| # | Feature | Documento | Estado |
|---|---|---|---|
| 1 | WhatsApp Conversacional Inteligente | `05a_whatsapp.md` | Avanzado |
| 2 | Motor IA Agentic Controlado | `05b_motor_ia.md` | Avanzado |
| 3 | Dashboard Inteligente | `05c_dashboard.md` | Avanzado; incluye registro manual estructurado y contrato UX en Fase 3 |
| 4 | Email Parsing con Confirmación | `05d_email_parsing.md` | Avanzado |
| 5 | Cuentas y Cajas Inteligentes | `05e_cuentas_cajas.md` | Avanzado |

### P1 — Profundidad financiera

| # | Feature | Documento | Estado |
|---|---|---|---|
| 6 | Categorías Inteligentes + Subcategorías | `05f_categorias.md` | Avanzado |
| 7 | Etiquetas Contextuales | `05f_categorias.md` | Avanzado |
| 8 | Insights Accionables | `05g_insights.md` | Avanzado |
| 9 | Historial de Movimientos | `05c_dashboard.md` | Actualizado dentro de Dashboard; búsqueda, filtros y creación manual |
| 10 | Gestión de Deudas | `05h_deudas.md` | Avanzado |
| 11 | Pagos Recurrentes / Pagos que vienen | `05i_recurrentes.md` | Avanzado |

### P2 — Retención y acompañamiento

| # | Feature | Documento | Estado |
|---|---|---|---|
| 12 | Nudges Inteligentes / Recordatorios | `05j_nudges.md` | Avanzado |
| 13 | Personas Relacionadas | `05h_deudas.md` | Avanzado dentro de Deudas |

---

## 5. Pospuestos fuera de V1.0

| Feature | Estado | Razón |
|---|---|---|
| Voz | Futuro / V1.2 | Transcripción, ruido, mensajes largos y ambigüedad. |
| OCR | Futuro / V1.2 | Boletas, fotos borrosas, múltiples items, IGV. |
| Shareables | Futuro / V1.2 | Requiere estrategia, privacidad y sub-sistema visual propio basado en Fase 6 si se retoma. |
| Multi-moneda UI completa | Futuro / V1.2 | Modelo puede soportar USD, pero UI completa no es V1. |
| Integraciones bancarias directas | Futuro | V1 usa email parsing, no open banking complejo. |
| Inversiones | Fuera de alcance | No dar asesoría financiera/inversión. |
| Parejas/familias/equipos | Fuera de alcance | V1 es usuario individual. |
| Metas/límites avanzados | Pendiente de documento | Solo existe hook opcional en Motor IA. |

---

## 6. Sistemas transversales

### 6.1 Bandeja de pendientes

Principio:

> Nada detectado por email se registra sin aprobación del usuario.

Flujo:

```text
Email detectado
  -> Email Adapter extrae datos mínimos
  -> DataAgent normaliza
  -> Dedup Engine revisa duplicados
  -> Pending Inbox crea pendiente
  -> WhatsApp/Dashboard pide confirmación
  -> Usuario confirma o rechaza
```

Reglas:

- Pendiente no afecta saldo.
- Si el usuario no responde, queda en Bandeja.
- Batch grande requiere revisión clara.
- "Ya lo registré" descarta y alimenta deduplicación.

### 6.2 Corrección y aprendizaje

Principio:

> Un error financiero destruye confianza más rápido que una feature faltante.

Capacidades:

- corregir desde WhatsApp,
- corregir desde Dashboard,
- borrar,
- deshacer,
- editar categoría/cuenta/caja,
- guardar aprendizaje por usuario,
- reducir errores repetidos,
- explicar por qué se clasificó algo.

### 6.3 Diseño de confianza

Cada dato sensible debe poder responder:

- ¿De dónde salió?
- ¿Fue confirmado?
- ¿Qué confianza tiene?
- ¿Puedo corregirlo?
- ¿Cómo afecta mi dinero libre?
- ¿Por qué Manzana dice esto?

Superficies:

- WhatsApp,
- Dashboard,
- Detalle de movimiento,
- Pendientes,
- Insights,
- Mi Dinero.

### 6.4 Motor IA Agentic Controlado

Resumen:

- `FinancialOrchestrator` modular.
- `AgentRuntime` Codex-first/API-ready.
- Agentes especializados.
- `ContextPackBuilder`.
- `ToolGateway`.
- Memoria financiera consultable.
- Motores de calidad de experiencia.
- Core Financiero + Domain Engines + Data Layer.
- `Transactional Outbox`.
- Internal Domain Event Bus.

El índice no detalla esta arquitectura; la fuente de verdad es `05b_motor_ia.md`.

### 6.5 Eventing seguro

El sistema distingue:

- eventos externos de entrada,
- eventos internos de dominio.

Regla:

> Las escrituras financieras se persisten con audit log y `transactional_outbox`; luego un worker publica al Internal Domain Event Bus.

Esto evita pérdida de eventos, duplicados y loops.

### 6.6 Identidad visual y sistema UI

Principio:

> Manzana no debe implementarse como una UI generica. La claridad financiera tambien se construye con jerarquia visual, color, tipografia, componentes y estados.

Estado:

- Fase 6 fue reconstruida como fuente visual documental V1.
- Existen documentos activos de identidad visual, design system, app flow, wireflows, especificacion Hi-Fi y handoff.
- El prototipo visual generado puede seguir pendiente de aprobacion final.
- Fase 6 define marca, paleta, tipografia, design system, modo discreto visual, estados y handoff.

Reglas:

- el Dashboard usa identidad visual propia,
- la app no debe parecer banco, SaaS generico ni demo de IA,
- modo discreto tiene tratamiento visual transversal,
- Tailwind/headless son mecanismo tecnico, no identidad,
- y el prototipo final queda sujeto a aprobacion visual contra Fase 6.

---

## 7. Tipos canónicos de movimiento V1.0

| Tipo | Ejemplo | Nota |
|---|---|---|
| `gasto` | "gasté 15 en taxi" | Reduce saldo/disponible. |
| `ingreso` | "me pagaron 2000" | Aumenta saldo/disponible. |
| `transferencia` | "pasé 100 de BCP a Yape" | No es gasto. |
| `asignacion_interna` | "separa 200 para emergencia" | Mueve dinero mental a caja. |
| `deuda_adquirida` | "le debo 50 a Luis" | Crea obligación. |
| `pago_deuda` | "le pagué 50 a Luis" | Reduce deuda y saldo. |
| `prestamo_dado` | "le presté 200 a mi hermano" | Dinero sale, queda por cobrar. |
| `prestamo_recibido` | "mi hermano me prestó 100" | Dinero entra, queda por devolver. |
| `devolucion_recibida` | "me devolvieron 30" | Reduce deuda a favor o aumenta saldo. |
| `pago_recurrente` | "pagué internet S/89" | Pago esperado o detectado. |
| `ajuste` | corrección manual | Depende del caso. |

Notas:

- `ahorro` no es tipo principal; se modela como caja/asignación interna.
- `inversión` queda fuera de V1.
- Metas/límites no tienen tipo propio en V1.

---

## 8. Experiencia progresiva

```text
Semana 1-2: Captura simple
  - Registra por WhatsApp
  - Corrige rápido
  - Ve últimos movimientos
  - Manzana aprende patrones básicos

Semana 3-4: Claridad financiera
  - Ve categorías principales
  - Primeros insights reales
  - Crea primera caja si aplica
  - Entiende dinero libre

Mes 2: Hábitos y compromisos
  - Recurrentes detectados
  - Deudas si las usa
  - Email parsing captura olvidos
  - Pendientes se vuelven parte del hábito

Mes 3+: Profundidad
  - Qué cambió
  - Patrones multi-semana
  - Memoria narrativa
  - Dashboard avanzado
  - IA se siente personalizada
```

Principio:

> El usuario no desbloquea features. Las features aparecen cuando el contexto las hace relevantes.

---

## 9. Hipótesis que valida V1.0

| # | Hipótesis | Métrica | Target |
|---|---|---|---|
| H1 | WhatsApp aumenta constancia de registro | Registros/semana/usuario | `>= 3` |
| H2 | IA reduce fricción | Mensajes sin aclaración | `>= 80%` |
| H3 | IA mantiene confianza | Accuracy tipo + monto | `>= 95%` tipo, `>= 99%` monto |
| H4 | Corrección evita abandono | Retención post-corrección | Alta |
| H5 | Email parsing aumenta captura sin quitar control | Pendientes útiles confirmados | Medir |
| H6 | Dashboard genera retorno semanal | Visitas dashboard/semana | `>= 1` |
| H7 | Dinero libre es más valioso que balance total | Usuarios que crean caja | `>= 30%` al D30 |
| H8 | Nudges aumentan actividad | Respuesta post-nudge | `>= 30%` |
| H9 | Insights accionables generan utilidad | Acción tomada o feedback | Medir |
| H10 | Uso parcial retiene usuarios distintos | Retención por perfil de uso | Medir |

---

## 10. Métricas por feature

| Feature | Métrica principal | Target inicial |
|---|---|---|
| WhatsApp | Mensajes interpretados sin aclaración | `>= 80%` |
| Motor IA | Accuracy tipo + monto | `>= 95%` tipo, `>= 99%` monto |
| Dashboard | Visitas semanales por usuario activo | `>= 1` |
| Email parsing | Transacciones útiles capturadas/confirmadas | `>= 85%` útil |
| Cuentas/Cajas | Usuarios que crean al menos 1 caja | `>= 30%` al D30 |
| Deudas | Pagos o actualizaciones de deuda | `>= 1/semana` en usuarios con deudas |
| Recurrentes | Recurrentes detectados correctamente | `>= 80%` |
| Nudges | Respuesta post-nudge | `>= 30%` |
| Insights | Insight leído + acción/feedback | Medir |
| Confianza | Correcciones resueltas sin abandono | Alta retención |

---

## 11. Brechas documentales abiertas

Estas áreas existen en V1. Algunas ya fueron profundizadas y otras siguen abiertas:

| Área | Qué falta |
|---|---|
| ~~Email parsing~~ | ~~Contratos, proveedores, dedup, UX de pendientes y límites de privacidad.~~ ✅ Resuelto en V2. |
| ~~Cuentas/Cajas~~ | ~~Modelo operativo final, afectación de movimientos, UI y edge cases.~~ ✅ Resuelto en V2. |
| ~~Categorías/Etiquetas~~ | ~~Reglas de creación, aprendizaje y corrección por usuario.~~ ✅ Resuelto en V2. |
| ~~Insights~~ | ~~Taxonomía final, thresholds, calidad, acciones y cadencia.~~ ✅ Resuelto en V2. |
| ~~Deudas~~ | ~~Estados, pagos parciales, intereses, cuotas, personas y dashboard.~~ ✅ Resuelto en V2. |
| ~~Recurrentes~~ | ~~Detección, confirmación, cambios de monto, atrasos y vínculo con deudas.~~ ✅ Resuelto en V2. |
| ~~Nudges~~ | ~~Opt-in, anti-spam, personalización, horarios y medición.~~ ✅ Resuelto en V2. |
| Metas/límites | Documento propio si se decide convertirlo en feature formal. |
| ~~Unit economics~~ | ~~Costos IA, WhatsApp, email, infra, soporte y planes.~~ Resuelto en `docs/fase_5_proteccion/25_unit_economics_costos.md`. |
| ~~GTM lanzamiento V1 directo~~ | ~~Primeros usuarios, activacion, feedback, canales y criterios de apertura.~~ Resuelto en `docs/fase_5_proteccion/26_gtm_lanzamiento_v1_primeros_usuarios.md`. |
| ~~Privacidad~~ | ~~Retencion, consentimiento, datos sensibles, exportacion/eliminacion.~~ Resuelto en `docs/fase_5_proteccion/24_privacidad_proteccion_datos.md`. |
| ~~Legal operativo~~ | ~~Politicas publicas, terminos, disclaimers, soporte, incidentes y revision legal.~~ Resuelto en `docs/fase_5_proteccion/27_legal_operativo_v1.md`. |
| Identidad visual/UI | Resuelta como fuente documental V1 en `docs/fase_6_visual/`; prototipo visual final sujeto a aprobacion. |

---

## 12. Timeline estimado V1.0

El timeline anterior de 19-26 semanas sigue siendo una referencia gruesa, no un compromiso cerrado.

| Fase | Entregable |
|---|---|
| Motor IA + WhatsApp | Bot conversacional, clasificación, corrección, estado y confianza. |
| Dashboard | Home, movimientos, pendientes, Mi Dinero, insights, configuración. |
| Cuentas/Cajas + Movimientos | Core financiero y dinero libre. |
| Email parsing + Pendientes | Gmail, bancos/apps prioritarios, dedup, confirmación. |
| Deudas + Recurrentes | Tracking, pagos, cuotas, detección y confirmaciones. |
| Insights + Nudges | Retención, acciones sugeridas, cadencia y opt-in. |
| Identidad visual + Prototipo | Marca, tokens, componentes, modo discreto visual y capturas de handoff. |
| QA + evaluación IA | Accuracy, regresiones, privacidad, experiencia. |

---

## 13. Resumen final

Manzana V1.0 queda definida como un producto conversacional de inteligencia financiera personal.

El estado actual de madurez documental es:

1. WhatsApp Conversacional: avanzado.
2. Motor IA Agentic Controlado: avanzado.
3. Dashboard Inteligente: avanzado, con UX y wireframes en Fase 3.
4. Email Parsing con Confirmación: avanzado.
5. Cuentas y Cajas Inteligentes: avanzado.
6. Categorías, Insights, Deudas, Recurrentes y Nudges: avanzado.
7. Fase 4 Tecnica: arquitectura, decision log, stack base aprobado, decisiones WhatsApp/Email, contrato logico de datos, eventos/workers, API, AgentRuntime y plan de implementacion V1 creados.
8. Fase 5 Proteccion: privacidad, datos, consentimiento, retencion, derechos del usuario, IA, Gmail, WhatsApp, modo discreto, unit economics, costos de calidad, GTM de lanzamiento V1 directo, primeros usuarios, legal operativo, soporte, incidentes y calidad sin friccion creados como base inicial.
9. Fase 6 Identidad Visual: reconstruida como fuente documental V1; prototipo visual generado sujeto a aprobacion.

Este índice debe actualizarse cada vez que un documento de feature avance de base a especificación profunda.

*Paso 5/20 - Indice V22 sincronizado con Fase 6 visual V1.*
