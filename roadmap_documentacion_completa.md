# 📋 Roadmap de Documentación — Orden de Ejecución

**Principio de orden:** Cada paso desbloquea decisiones para los siguientes. Ningún paso debe ejecutarse sin tener resuelto el anterior.

**Total actual:** Fases 1-6 completas como base documental V1. Fase 6 reconstruida con documentos 28-33.

---

## Fase 1 — IDENTIDAD: ¿Quién somos y para quién?
> *Sin esto, todo lo demás son suposiciones*

| Paso | Tema | Pregunta que responde | Entregable | Dependencias |
|---|---|---|---|---|
| **1** | 🎯 **User Personas** | ¿Para QUIÉN exactamente construimos? | `user_personas.md` | Ninguna |
| **2** | 🏷️ **Nombre del producto** | ¿Cómo nos llamamos? ¿Qué dominio/redes aseguramos? | `branding.md` | Ninguna |
| **3** | 🔍 **Análisis competitivo** | ¿Contra quién competimos? ¿Qué hacen bien/mal? | `competitive_analysis.md` | Paso 1 |
| **4** | 📐 **TAM/SAM/SOM** | ¿Qué tan grande es la oportunidad? | `market_sizing.md` | Pasos 1, 3 |

### Detalle por paso:

#### Paso 1 — User Personas
- 2-3 personas con nombre, edad, ciudad, ingreso, dolor principal
- Comportamiento digital (apps, WhatsApp, redes)
- Historia de 1 párrafo ("Un día típico de...")
- Qué ha intentado antes y por qué abandonó
- **Criterio de completitud:** Cualquier persona del equipo puede describir al usuario sin ambigüedad

#### Paso 2 — Nombre del producto
- 5-10 candidatos evaluados (memorabilidad, dominio .com/.pe, redes sociales)
- Nombre elegido + justificación
- Verificación de dominio y handles sociales
- Tono de marca (3-5 adjetivos que definen la personalidad)

#### Paso 3 — Análisis competitivo
- Mapa de 8-10 competidores directos e indirectos (Fintonic, Monefy, Wallet, Excel/Notion DIY, "nota de WhatsApp")
- Matriz comparativa: features, precio, canal, UX, IA, retención
- Oportunidades no cubiertas por nadie
- **Competidor real #1:** El hábito de no registrar nada

#### Paso 4 — TAM/SAM/SOM
- TAM: Mercado total finanzas personales LATAM
- SAM: Usuarios WhatsApp 18-35 en Perú con smartphone
- SOM: Meta realista año 1 (ej: 1,000-5,000 usuarios activos)
- Datos de penetración de apps financieras en Perú

---

## Fase 2 — ESTRATEGIA: ¿Es viable como negocio?
> *Sin esto, cada usuario es un centro de costos*

| Paso | Tema | Pregunta que responde | Entregable | Dependencias |
|---|---|---|---|---|
| **5** | 📦 **Alcance V1** | ¿Qué alcance construimos para la V1 directa y en qué cortes internos? | Actualizar especificación | Pasos 1-4 |
| **6** | 💰 **Costos de IA + WhatsApp** | ¿Cuánto cuesta cada usuario activo sin bajar calidad? | `docs/fase_5_proteccion/25_unit_economics_costos.md` | Paso 5, Fase 4 |
| **7** | **Modelo de negocio** | Como generamos ingresos sin bajar calidad? | Hipotesis en `25_unit_economics_costos.md` + `26_gtm_lanzamiento_v1_primeros_usuarios.md` | Pasos 4, 6 |
| **8** | **Metricas de exito** | Como sabemos si funciona y que no es solo curiosidad? | North Star y metricas en producto, Fase 3, Fase 4 y Fase 5 | Pasos 5, 7 |
| **9** | **Moat defendible** | Que hace dificil copiar Manzana si valida? | Diferenciacion en `03_analisis_competitivo.md`, experiencia, datos y canal WhatsApp | Pasos 3, 7 |

### Detalle por paso:

#### Paso 5 — Alcance V1
- Definir la V1 directa y sus cortes internos de construcción: WhatsApp, Motor IA, Dashboard, Email, Cuentas/Cajas, Categorías, Descubrimientos, Deudas, Pagos que vienen y Recordatorios.
- Para cada feature: qué incluye en V1 y qué NO incluye.
- Definir qué pasa con deudas, recurrentes y shareables (→ Fase 2 del producto).
- Multi-moneda UI completa queda fuera de V1; el modelo puede dejar base para USD si no complica la experiencia.

#### Paso 6 — Costos de IA + WhatsApp
- Resuelto en `docs/fase_5_proteccion/25_unit_economics_costos.md`.
- Costos de Kapso/WhatsApp Business Platform, IA, email, Supabase, hosting, workers, observabilidad y soporte.
- Runtime IA: `AgentRuntime` Codex-first/API-ready, con medicion de costo, latencia y calidad por agente.
- Medicion por outcome: movimiento confirmado, pendiente resuelto, insight util, conversacion resuelta y usuario retenido.
- Principio: no bajar calidad por ahorrar; reducir ruido, duplicacion, spam y runtime incorrecto.

#### Paso 7 — Modelo de negocio
- No queda como pricing final cerrado.
- Hipotesis inicial vive en `25_unit_economics_costos.md` y `26_gtm_lanzamiento_v1_primeros_usuarios.md`.
- Validar disposicion a pagar por claridad recurrente, no por curiosidad.
- No prometer ilimitado antes de medir costo por segmento.
- Pricing publico requiere legal operativo, unit economics y señales reales de uso de V1.

#### Paso 8 — Métricas de éxito
- Metricas distribuidas en especificacion de producto, Fase 3, Fase 4 y Fase 5.
- North Star recomendada: `Weekly Clarity Actions`.
- Medir activacion, retencion, confianza, costo por outcome, calidad IA, fatiga WhatsApp y feedback.
- No usar solo registros o mensajes como senal de traccion.

#### Paso 9 — Moat defendible
- Moat inicial: canal WhatsApp + baja friccion + memoria financiera + experiencia emocional + Core confiable.
- Moat acumulativo: datos corregidos por usuario, habito, contexto historico, confianza, lenguaje local y workflows financieros.
- Si un competidor copia la superficie, Manzana debe ganar por calidad de experiencia, continuidad y confianza.

---

## Fase 3 — PRODUCTO: ¿Cómo se siente usarlo?
> *Sin esto, cada desarrollador interpreta la UX diferente*

| Paso | Tema | Pregunta que responde | Entregable | Dependencias |
|---|---|---|---|---|
| **10** | **Principios de experiencia** | ¿Qué debe sentirse como Manzana en cualquier canal? | `docs/fase_3_producto/10_principios_experiencia.md` | Pasos 1-5 |
| **11** | **Personalidad y conversación** | ¿Cómo habla, pregunta, corrige y acompaña Manzana? | `docs/fase_3_producto/11_personalidad_conversacion.md` | Paso 10 |
| **12** | **Lenguaje de producto** | ¿Cómo traducimos nombres técnicos a lenguaje humano? | `docs/fase_3_producto/12_lenguaje_producto.md` | Pasos 5, 10 |
| **13** | **Onboarding y activación** | ¿Cómo llega el usuario al primer valor sin fricción? | `docs/fase_3_producto/13_onboarding_activacion.md` | Pasos 10-12 |
| **14** | **Flujos de usuario V1** | ¿Qué pasa paso a paso en cada interacción crítica? | `docs/fase_3_producto/14_flujos_usuario_v1.md` | Pasos 5, 10-13 |
| **15** | **Retención y lifecycle** | ¿Qué hace que vuelva en D1, D3, D7, D30? | `docs/fase_3_producto/15_retencion_lifecycle.md` | Pasos 10-14 |
| **16** | **Confianza, errores y correcciones** | ¿Cómo se recupera confianza cuando hay duda, error o dato incompleto? | `docs/fase_3_producto/16_confianza_errores.md` | Pasos 5, 10, 14 |
| **17** | **Dashboard UX** | ¿Cómo se organiza la experiencia visual y de control? | `docs/fase_3_producto/17_dashboard_ux.md` | Paso 14 |
| **18** | **Wireframes y prototipo** | ¿Cómo se ve la experiencia core antes de código? | `docs/fase_3_producto/18_wireframes_prototipo.md` | Pasos 14, 17 |

### Detalle por paso:

#### Paso 10 — Principios de experiencia
- Sensación general del producto.
- Jerarquía: seguridad, confianza, claridad, fricción, personalización, wow.
- Principios por canal: WhatsApp, Dashboard, Email, Descubrimientos, Recordatorios.
- Antiprincipios: culpa, tecnicismo, spam, formularios innecesarios, falsa precisión.

#### Paso 11 — Personalidad y conversación
- Voz de Manzana.
- Tono por situación: registro, duda, error, deuda, pago próximo, insight, recordatorio.
- Cuándo responder corto y cuándo explicar.
- Cómo pedir aclaraciones sin fricción.
- Cómo disculparse y recuperarse.

#### Paso 12 — Lenguaje de producto
- `Insights` -> Descubrimientos / Lo que Manzana notó.
- `Recurrentes` -> Pagos que vienen.
- `Nudges` -> Recordatorios / Avisos.
- Criterios para labels de Dashboard y WhatsApp.
- Glosario técnico vs lenguaje visible.

#### Paso 13 — Onboarding y activación
- Primeros 3 minutos.
- Primer registro.
- Primer dato opcional.
- Primer valor.
- Primer descubrimiento útil.
- Cómo introducir cuentas, cajas, deudas y pagos que vienen sin abrumar.

#### Paso 14 — Flujos de usuario V1
- Registro simple.
- Registro múltiple.
- Corrección.
- Email pendiente.
- Consulta de dinero libre.
- Deuda.
- Pago que viene.
- Recordatorio.
- Descubrimiento.
- Dashboard review.

#### Paso 15 — Retención y lifecycle
- Aha moment.
- D1/D3/D7/D14/D30.
- Re-engagement.
- Uso parcial.
- Cómo volver sin culpa.
- Cómo evitar recordatorios invasivos.

#### Paso 16 — Confianza, errores y correcciones
- Fuente de datos.
- Explicación "por qué".
- Corrección.
- Undo.
- Estados incompletos.
- Ambigüedad.
- Errores de IA.

#### Paso 17 — Dashboard UX
- Navegación mobile/desktop.
- Home.
- Movimientos.
- Pendientes.
- Mi Dinero.
- Deudas.
- Pagos que vienen.
- Descubrimientos.
- Recordatorios/configuración.

#### Paso 18 — Wireframes y prototipo
- Consolidar prototipo existente.
- Actualizar labels humanos.
- Validar estados vacíos, cargando, error, datos incompletos y detalles.
- Shareables quedan como futuro fuera de V1 salvo decisión posterior.

---

## Fase 4 — TÉCNICA: ¿Cómo se construye?
> *Sin esto, no hay código implementable con seguridad*

Fase 4 define arquitectura, reglas no negociables, decisiones base aprobadas, recomendaciones tecnicas y ruta de implementacion. El decision log evita confundir una regla financiera con una marca o proveedor intercambiable.

| Documento | Tema | Pregunta que responde | Entregable | Dependencias |
|---|---|---|---|---|
| **06** | 🧭 **Arquitectura del sistema** | ¿Cómo se conectan canales, orquestador, agentes, Core, eventos y experiencia? | `docs/fase_4_tecnica/06_arquitectura_sistema.md` | Fase 2, Fase 3 |
| **15** | 🧱 **Stack tecnológico** | ¿Qué tecnologías usamos y qué rol cumple cada capa? | `docs/fase_4_tecnica/15_stack_tecnologico.md` | Fase 2, Fase 3, arquitectura |
| **16** | 🗄️ **Modelo de datos** | ¿Qué tablas, enums, relaciones, RLS, constraints e índices existen? | `docs/fase_4_tecnica/16_modelo_datos.md` | Arquitectura, stack |
| **17** | 🔁 **Eventos y workers** | ¿Cómo se procesan eventos externos, outbox, retries, schedules e idempotencia? | `docs/fase_4_tecnica/17_eventos_workers.md` | Modelo de datos, Core |
| **18** | 🔌 **API spec** | ¿Qué endpoints, webhooks, comandos internos, errores e idempotencia expone el sistema? | `docs/fase_4_tecnica/18_api_spec.md` | Modelo de datos, eventos |
| **19** | 🤖 **Agent Runtime y Tools** | ¿Cómo corren los agentes, qué herramientas usan y qué nunca pueden escribir? | `docs/fase_4_tecnica/19_agent_runtime_tools.md` | Motor IA, arquitectura, API |
| **20** | 🧾 **Decisiones técnicas** | ¿Qué está aprobado, recomendado, pendiente o fuera de V1? | `docs/fase_4_tecnica/20_decisiones_tecnicas.md` | Arquitectura, stack |
| **21** | WhatsApp Provider Decision | Como operamos WhatsApp V1 con Kapso sin improvisar costos, templates, webhooks ni ventana 24h? | `docs/fase_4_tecnica/21_decision_whatsapp_provider.md` | WhatsApp, arquitectura, stack |
| **22** | Email Provider Decision | Como operamos Gmail, OAuth, Pub/Sub, privacidad y proveedores futuros sin improvisar? | `docs/fase_4_tecnica/22_decision_email_provider.md` | Email, arquitectura, stack, API |
| **23** | Plan de Implementacion V1 | En que orden construimos la V1 sin romper Core, outbox, RLS ni experiencia? | `docs/fase_4_tecnica/23_plan_implementacion_v1.md` | Fase 4 completa |
| **23b** | Seguimiento de Construccion V1 | Que se construyo realmente, que esta mockeado, que pruebas pasaron y cual es el siguiente paso? | `docs/fase_4_tecnica/23b_seguimiento_construccion_v1.md` | Plan de implementacion + codigo |

### Detalle por documento:

#### Documento 15 — Stack tecnológico
- Stack base aprobado: Next.js App Router + React + TypeScript.
- Backend aprobado: Next.js Route Handlers y server functions controladas.
- Base/Auth aprobada: Supabase PostgreSQL + Supabase Auth + RLS.
- Workers aprobados: worker TypeScript durable; Trigger.dev o equivalente.
- IA: `AgentRuntime` Codex-first ahora y API-ready después.
- WhatsApp y Gmail entran por adapters, no por lógica financiera directa.
- Gmail V1 usa API oficial + Pub/Sub; Outlook/IMAP/forwarding quedan futuro o pendiente.

#### Documento 16 — Modelo de datos
- Tablas core: usuarios, preferencias, cuentas, cajas, movimientos, pendientes, categorías, deudas, recurrentes, insights, nudges, conversaciones, email, eventos y learning.
- Enums canónicos de movimientos V1.
- Contrato logico con constraints, índices y orden de migraciones.
- SQL real se genera al iniciar implementacion.
- RLS obligatorio para tablas con datos de usuario.
- `transactional_outbox`, `external_event_log` e `internal_event_log` como base de consistencia.

#### Documento 17 — Eventos y workers
- Separación entre External Input Events e Internal Domain Events.
- Transactional Outbox obligatorio para hechos financieros persistidos.
- Workers idempotentes para balances, pendientes, email, dedup, recurrentes, insights, nudges y learning.
- Retry/backoff, dead letter y observabilidad.
- Supresión de loops entre eventos internos y entradas externas.

#### Documento 18 — API spec
- Dashboard API para Home, movimientos, pendientes, cuentas/cajas, deudas, pagos que vienen, descubrimientos, búsqueda natural y configuración.
- Webhooks de WhatsApp y Gmail Pub/Sub.
- Internal API para workers.
- Core Commands como contrato de escritura financiera.
- Estilo V1 aprobado: REST + Core Commands.
- Búsqueda natural read-only por defecto.

#### Documento 19 — Agent Runtime y Tools
- Agentes detrás de `AgentRuntime`, no acoplados a Codex ni a API específica.
- Context Packs por tarea.
- ToolGateway read-only para agentes conversacionales.
- Agentes proponen acciones; `CommandDispatcher` y Core ejecutan escrituras aprobadas.
- Sin chain-of-thought crudo en salidas ni trazas.

#### Documento 20 — Decisiones técnicas
- Clasifica reglas no negociables, decisiones aprobadas, recomendaciones, pendientes y fuera de V1.
- Deja aprobado el stack base y mantiene equivalentes donde la marca concreta no es obligatoria.
- Mantiene firmes las reglas financieras y de seguridad.

#### Documento 21 - WhatsApp Provider Decision
- Deja aprobado Kapso como proveedor oficial operativo de WhatsApp V1 detras de `WhatsAppAdapter`.
- Mantiene Meta WhatsApp Cloud API directo como escape tecnico futuro, no como ruta principal actual.
- Descarta Twilio, 360dialog, WATI, Zoko, respond.io, Evolution API, sesiones QR y automatizacion de WhatsApp Web para WhatsApp V1.
- Aterriza webhooks, firma, templates, costos, setup, lanzamiento V1, observabilidad y criterios para revisar la decision en una fase posterior.

#### Documento 22 - Email Provider Decision
- Deja aprobado Gmail API + Pub/Sub como default V1 detras de `EmailAdapter`.
- Define Outlook/Microsoft Graph, IMAP y forwarding como rutas futuras o pendientes, no V1 inicial.
- Prohibe passwords, app passwords, scraping y automatizacion no oficial del inbox.
- Aterriza OAuth, scopes restringidos, Limited Use, watch renewal, Pub/Sub, backfill y privacidad.

#### Documento 23 - Plan de Implementacion V1
- Ordena la construccion por cortes: base tecnica, datos/RLS, Core, Dashboard, outbox, WhatsApp, agentes, pendientes, email, conversacion, insights y nudges.
- Define que puede quedar mockeado temporalmente y que debe ser real desde el inicio.
- Deja prompts concretos para Cursor/Claude Code.
- Sirve como puente entre specs y codigo.

#### Documento 23b - Seguimiento de Construccion V1
- Registra el avance real de implementacion por cortes.
- Distingue implementado, parcial, mock temporal y no iniciado.
- Guarda evidencia de pruebas, capturas, deuda tecnica y siguiente paso recomendado.
- Debe actualizarse al cerrar pantallas, migraciones, endpoints o cambios importantes de arquitectura.

#### Nota sobre multi-moneda
- El modelo puede tener campo `currency`.
- La UI multi-moneda completa queda fuera de V1.
- No es un paso técnico principal de Fase 4 V1.

#### Nota sobre numeracion
- Los documentos 21, 22 y 23 son anexos tecnicos/implementables agregados a Fase 4.
- `23b` es un documento vivo de seguimiento, compañero del plan `23`, para no duplicar la numeracion global de Fase 5.
- Fase 5 usa documentos 24 a 27.
- Fase 6 usa documentos 28 a 33 y ya fue reconstruida como fuente visual documental V1.

---

## Fase 5 - PROTECCION: Como nos protegemos sin bajar calidad?
> *Sin esto, hay riesgo legal, reputacional y de confianza*

| Paso | Tema | Pregunta que responde | Entregable | Dependencias |
|---|---|---|---|---|
| **24** | Privacidad y proteccion de datos | Como protegemos datos financieros sin volver torpe la experiencia? | `docs/fase_5_proteccion/24_privacidad_proteccion_datos.md` | Fase 2, Fase 3, Fase 4 |
| **25** | Unit economics y costos | Cuanto cuesta dar buena calidad por usuario? | `docs/fase_5_proteccion/25_unit_economics_costos.md` | Fase 4, documento 24 |
| **26** | Go-to-Market lanzamiento V1 directo | Como llegamos a los primeros usuarios correctos con una V1 completa? | `docs/fase_5_proteccion/26_gtm_lanzamiento_v1_primeros_usuarios.md` | Fase 1, Fase 2, Fase 3 |
| **27** | Legal operativo V1 | Que politicas, terminos, soporte e incidentes necesitamos antes del lanzamiento V1 publico? | `docs/fase_5_proteccion/27_legal_operativo_v1.md` | Documento 24 |

### Detalle por paso:

#### Documento 24 - Privacidad y proteccion de datos
- Define datos guardados, datos prohibidos, consentimiento, Gmail, WhatsApp, IA, ToolGateway, modo discreto, retencion y derechos del usuario.
- Mantiene el principio: privacidad no debe bajar calidad.
- Deja checklist antes del lanzamiento V1 y escenarios de prueba.

#### Documento 25 - Unit economics y costos
- Costos de IA, WhatsApp, email, Supabase, hosting, workers, observabilidad y soporte.
- Estrategia para sostener calidad sin hacer spam ni esconder valor.
- Define formulas, CostEvent, OutcomeEvent, semaforos y presupuestos de calidad por feature.

#### Documento 26 - Go-to-Market lanzamiento V1 directo
- Posicionamiento, segmentos, canales, landing, invitaciones, feedback, activacion y metricas.
- Define lanzamiento V1 directo: construccion por cortes internos, QA privado, release candidate y apertura V1 completa.
- Mantiene el principio: primero V1 completa y confiable, despues crecimiento, despues escala.

#### Documento 27 - Legal operativo V1
- Politica de privacidad publica, terminos, disclaimers, soporte, incidentes y revision legal.
- Define paquete legal por etapa: pruebas internas, release candidate, lanzamiento V1 publico, cobro y escala.
- Mantiene que el documento no es asesoria legal y que se requiere revision externa antes de publico/pago.
- Aterriza WhatsApp, Gmail, IA, soporte humano, incident response, marketing y cambios que requieren revision legal.

---

## Fase 6 - IDENTIDAD VISUAL: Como debe verse Manzana?
> *Fuente visual documental V1 para identidad, design system, flujos, estados y handoff*

Estado actual:

```text
Fase 6 reconstruida. Documentos 28-33 activos como fuente visual documental V1.
El prototipo generado en Stitch/herramienta visual puede seguir pendiente de aprobacion final.
```

Decision:

- Fase 6 define identidad visual, paleta, tipografia, tokens, componentes, navegacion, flujos, estados y handoff.
- Fase 6 no modifica reglas funcionales, financieras, arquitectura, email parsing ni alcance V1.
- Si un prototipo visual contradice Fase 6, gana Fase 6.
- Si Fase 6 contradice reglas financieras, arquitectura o alcance, ganan Fases 2, 3 y 4 segun corresponda.
- `prototypes/manzana-v3/` queda descartado/no usar.
- Stitch o una herramienta equivalente se usa como ayuda visual, no como fuente superior a los documentos.

Documentos:

| Paso | Tema | Pregunta que responde | Estado |
|---|---|---|---|
| **28** | Identidad visual y marca | Como se ve, se reconoce y se recuerda Manzana? | V1 - `docs/fase_6_visual/28_identidad_visual_marca.md` |
| **29** | Design system UI | Que tokens, componentes, estados y reglas visuales debe usar la app? | V1 - `docs/fase_6_visual/29_design_system_ui.md` |
| **30** | App Flow | Que pantallas, rutas y estados existen en la app? | V1 - `docs/fase_6_visual/30_app_flow.md` |
| **31** | Wireflows | Como se comportan los flujos en happy path, error, carga, discreto y primera vez? | V1 - `docs/fase_6_visual/31_wireflows.md` |
| **32** | Especificacion Hi-Fi | Como debe verse cada pantalla, drawer, formulario, estado y detalle? | V1 - `docs/fase_6_visual/32_especificacion_hifi.md` |
| **33** | Handoff Stitch V1 | Como generar los 151 frames/variantes visuales exactas? | V1 - `docs/fase_6_visual/33_stitch_handoff_v1.md` |

---

## Resumen Visual

```
FASE 1 - IDENTIDAD
  01. User Personas
  02. Nombre producto
  03. Analisis competitivo
  04. TAM/SAM/SOM
        |

FASE 2 - ALCANCE V1
  05a. WhatsApp conversacional
  05b. Motor IA agentic controlado
  05c. Dashboard
  05d. Email parsing
  05e. Cuentas y cajas
  05f. Categorias y etiquetas
  05g. Insights
  05h. Deudas
  05i. Recurrentes / pagos que vienen
  05j. Nudges / recordatorios
        |

FASE 3 - PRODUCTO / EXPERIENCIA
  10. Principios de experiencia
  11. Personalidad y conversacion
  12. Lenguaje de producto
  13. Onboarding y activacion
  14. Flujos de usuario V1
  15. Retencion y lifecycle
  16. Confianza, errores y correcciones
  17. Dashboard UX
  18. Wireframes y prototipo
        |

FASE 4 - TECNICA / IMPLEMENTACION
  06. Arquitectura sistema
  15. Stack tecnologico
  16. Modelo de datos
  17. Eventos y workers
  18. API spec
  19. Agent Runtime / Tools
  20. Decision log
  21. WhatsApp provider
  22. Email provider
  23. Plan implementacion V1
        |

FASE 5 - PROTECCION / NEGOCIO RESPONSABLE
  24. Privacidad y proteccion
  25. Unit economics
  26. Go-to-Market lanzamiento V1 directo
  27. Legal operativo V1
        |

FASE 6 - IDENTIDAD VISUAL / DESIGN SYSTEM
  28. Identidad visual y marca
  29. Design system UI
  30. App Flow
  31. Wireflows
  32. Especificacion Hi-Fi
  33. Handoff Stitch V1
        |

LISTO PARA IMPLEMENTACION INICIAL POR CORTES
```

---

## Como trabajar desde aqui

La documentacion ya puede usarse como base para implementacion inicial, con una regla:

```text
No pasar todos los documentos a un agente y pedir "construye todo".
Usar el plan de implementacion V1 y avanzar por cortes pequenos.
```

Orden recomendado:

1. Leer `especificacion_producto_finanzas_personales_ia.md`.
2. Leer `docs/fase_2_estrategia/alcance_v1/indice.md`.
3. Leer Fase 3 para experiencia.
4. Leer Fase 4 para arquitectura e implementacion.
5. Leer Fase 5 para privacidad, costos, GTM y legal operativo.
6. Leer Fase 6 para identidad visual, tokens, componentes, estados y handoff.
7. Ejecutar `docs/fase_4_tecnica/23_plan_implementacion_v1.md` por cortes.

> [!IMPORTANT]
> Fase 5 no reemplaza revision legal externa antes de lanzamiento publico, cobro o escala. Fase 6 es fuente visual documental V1; cualquier prototipo generado debe aprobarse contra sus documentos antes de tratarse como referencia final.

---

*Roadmap de documentacion - sincronizado con Fase 6 visual V1.*

