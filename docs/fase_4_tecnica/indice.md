# Fase 4 Tecnica - Implementacion V1

**Pregunta central:** Como se construye Manzana sin improvisar la arquitectura?  
**Estado:** V1.14 - Auditoria integral de arquitectura, producto y calidad publicada  
**Ultima actualizacion:** 24 de julio, 2026  

---

## 1. Proposito

Fase 4 traduce el producto, la experiencia y la arquitectura en contratos tecnicos implementables.

Fase 2 define que existe.  
Fase 3 define como se siente.  
Fase 4 define como se construye.

Esta fase existe para que Cursor, Claude Code o cualquier equipo tecnico no invente:

- criterios de stack,
- tablas,
- RLS,
- eventos,
- workers,
- endpoints,
- schemas de agentes,
- herramientas,
- idempotencia,
- outbox,
- ni rutas de escritura al Core.

Tambien existe para que una recomendacion tecnica fuerte no se confunda con una aprobacion final del usuario.

---

## 2. Documentos De Fase 4

| Archivo | Tema | Estado | Proposito |
|---|---|---|---|
| `indice.md` | Indice y cierre de auditoria | V1.5 auditado | Ordena Fase 4, resume decisiones y deja checklist de cierre. |
| `06_arquitectura_sistema.md` | Arquitectura del sistema | V3.2 auditado | Mapa transversal de canales, orquestador, agentes, motores, Core, eventos y experiencia. |
| `15_stack_tecnologico.md` | Stack tecnologico | V1.8 auditado | Define stack base aprobado, herramientas equivalentes, responsabilidades, limites por runtime, Kapso para WhatsApp V1 y relacion con Fase 6 visual V1. |
| `16_modelo_datos.md` | Modelo de datos | V1.4 auditado | Define tablas, enums con valores V1, relaciones, RLS, constraints, indices y orden de migraciones. |
| `17_eventos_workers.md` | Eventos y workers | V1.5 | Define outbox, eventos internos, eventos externos, jobs, retries, idempotencia y scheduler externo V1. |
| `18_api_spec.md` | API spec | V1.6 | Define endpoints, contratos, errores, comandos, webhooks y rutas internas. |
| `19_agent_runtime_tools.md` | Agent Runtime y Tools | V1.1 auditado | Define runtimes, Context Packs tecnicos, herramientas read-only, schemas y evaluacion. |
| `20_decisiones_tecnicas.md` | Decision log | V1.7 auditado | Clasifica decisiones como no negociables, aprobadas, recomendadas, pendientes o fuera de V1. |
| `21_decision_whatsapp_provider.md` | Decision WhatsApp Provider | V1.4 auditado | Define Kapso como proveedor oficial WhatsApp V1, adapter, webhooks, templates, costos, setup, lanzamiento V1 y descartes de alternativas. |
| `22_decision_email_provider.md` | Decision Email Provider | V1.2 auditado | Define Gmail V1, OAuth, Pub/Sub, privacidad, watch renewal, fallback y criterios para proveedores futuros. |
| `23_plan_implementacion_v1.md` | Plan de Implementacion V1 | V1.3 | Ordena cortes de construccion, dependencias, mocks permitidos, gates y prompts para agentes de codigo. |
| `23b_seguimiento_construccion_v1.md` | Seguimiento de Construccion V1 | Vivo | Registra avance real, mocks, pruebas, capturas, deuda tecnica y siguiente paso durante la implementacion. |
| `24_paquete_identidad_meta.md` | Paquete de identidad Meta | V1.0 | Define rutas publicas, datos, dominio, correo y checklist para reintentar verificacion WhatsApp sin inconsistencias. |
| `25_scheduler_externo_v1.md` | Scheduler externo V1 | V1.0 | Define el contrato para ejecutar `outbox_publisher` cada minuto sin mover logica financiera fuera de Core. |
| `26_auditoria_captura_financiera_externa_v1.md` | Auditoria integral de captura financiera externa | V1.1 | Consolida el contrato documental, contradicciones, Gates A-F y el cierre tecnico real del Corte 31 sin fingir activacion institucional. |
| `auditoria_integral_arquitectura_ia_conversacional_2026-07-23.md` | Auditoria profunda del motor IA y conversacion | Cierre 24/07/2026 | Traza agentes, tools, runtime, learning, conversaciones reales, arquitectura objetivo y gates. |
| `matriz_cumplimiento_integral_v1_2026-07-24.md` | Matriz integral de cumplimiento V1 | Cierre 24/07/2026 | Contrasta los 21 flujos y dimensiones transversales contra DOC, CODE, TEST, SMOKE, LIVE, USER y METRIC. |

---

## 3. Orden Recomendado De Lectura

Para implementar:

1. `06_arquitectura_sistema.md`
2. `20_decisiones_tecnicas.md`
3. `15_stack_tecnologico.md`
4. `21_decision_whatsapp_provider.md`
5. `22_decision_email_provider.md`
6. `16_modelo_datos.md`
7. `17_eventos_workers.md`
8. `18_api_spec.md`
9. `19_agent_runtime_tools.md`
10. `23_plan_implementacion_v1.md`
11. `23b_seguimiento_construccion_v1.md`
12. `25_scheduler_externo_v1.md` cuando se configure el publisher frecuente de outbox.
13. `24_paquete_identidad_meta.md` cuando se configure Meta, dominio, WhatsApp o verificacion publica.
14. `26_auditoria_captura_financiera_externa_v1.md` antes de implementar o activar parsers financieros externos.
15. `auditoria_integral_arquitectura_ia_conversacional_2026-07-23.md` antes de modificar agentes, runtime o conversacion.
16. `matriz_cumplimiento_integral_v1_2026-07-24.md` antes de declarar una capacidad V1 como completa.

Para construir con un agente de codigo:

1. Darle primero producto y alcance: `especificacion_producto_finanzas_personales_ia.md` + Fase 2.
2. Luego experiencia: Fase 3, especialmente `10`, `11`, `12`, `16`, `17`, `18`.
3. Luego tecnica: Fase 4 completa.
4. Cerrar con `23_plan_implementacion_v1.md`.
5. Pedir implementacion por cortes pequenos, empezando por Corte 0.
6. Leer Fase 6 antes de implementar UI visual final.
7. Actualizar `23b_seguimiento_construccion_v1.md` al cerrar cada corte, pantalla, migracion o endpoint importante.

---

## 4. Matriz Resumida De Decisiones

El detalle completo vive en `20_decisiones_tecnicas.md`.

| Decision | Estado |
|---|---|
| Core Financiero como dominio propio | `no_negociable` |
| Agentes sin acceso directo a DB/Core | `no_negociable` |
| `CommandDispatcher` como via de escritura | `no_negociable` |
| `ToolGateway` para consultas de agentes | `no_negociable` |
| Transactional Outbox | `no_negociable` |
| External Event Gateway separado del Internal Domain Event Bus | `no_negociable` |
| Email sin auto-registro | `no_negociable` |
| Pendientes no afectan saldos | `no_negociable` |
| AgentRuntime Codex-first/API-ready | `aprobada_producto` |
| OpenAI Responses API como primer runtime API de agentes | `recomendada` |
| TypeScript-first | `aprobada_producto` |
| Next.js fullstack para Dashboard/API/webhooks | `aprobada_producto` |
| Supabase/PostgreSQL/Auth/RLS | `aprobada_producto` |
| SQL migrations como camino de implementacion | `aprobada_producto` |
| Workers TypeScript durables | `aprobada_producto` |
| Kapso como proveedor oficial WhatsApp V1 via adapter | `aprobada_producto` |
| APIs no oficiales de WhatsApp prohibidas | `no_negociable` |
| Proveedores alternos Twilio/360dialog/respond.io/Evolution/QR descartados para WhatsApp V1 | `aprobada_producto` |
| WhatsApp Window Strategy | `aprobada_producto` |
| Gmail API + Pub/Sub primero via EmailAdapter | `aprobada_producto` |
| Email por OAuth oficial, sin passwords ni scraping | `no_negociable` |
| REST + Core Commands | `aprobada_producto` |
| Modelo de datos logico en Fase 4 | `aprobada_producto` |
| Tailwind/headless para Dashboard siguiendo Fase 3 y Fase 6 visual V1 | `aprobada_producto` |
| Vercel Cron solo como disparador | `recomendada` |
| Scheduler externo para outbox frecuente | `aprobada_producto` |

---

## 5. Que Queda Fuera De Esta Fase

Fase 4 no decide aun:

- pricing final,
- unit economics detallado,
- legal/privacidad completa,
- go to market,
- definicion de identidad visual y design system dentro de Fase 4 (vive en Fase 6),
- integraciones bancarias directas,
- voz/OCR,
- shareables,
- multiusuario,
- multi-moneda UI completa,
- metas/limites formales como feature completa.

Algunos de esos temas pertenecen a Fase 5, Fase 6 o documentos futuros.

---

## 6. Criterio De Cierre

Fase 4 esta lista para implementacion inicial cuando un agente de codigo pueda responder sin inventar:

- Que reglas no son negociables?
- Que stack base esta aprobado y que herramientas siguen como equivalentes/recomendadas?
- Donde vive cada capa?
- Que tablas existen?
- Que escribe Core?
- Que nunca escribe un agente?
- Como se publica un evento?
- Como se reintenta un worker?
- Como entra WhatsApp?
- Que proveedor WhatsApp se usa y cuando se cambia?
- Que proveedor Email se usa y que accesos quedan prohibidos?
- Como entra Email?
- Como guarda Dashboard?
- Como consulta un agente?
- Como se protege RLS?
- Como se evita duplicado?
- Como se mide calidad y costo?
- Por donde empieza la implementacion y que se deja para despues?

---

## 7. Cierre De Auditoria

Ultima auditoria integral: 24 de julio, 2026.

Checklist verificado:

- Todos los documentos de Fase 4 existen: `06`, `15`, `16`, `17`, `18`, `19`, `20`, `21`, `22`, `23` e `indice`.
- `20_decisiones_tecnicas.md` contiene decision log vivo con estados validos.
- WhatsApp tiene decision propia: Kapso como proveedor oficial V1 via `WhatsAppAdapter`, con Meta directo solo como escape tecnico futuro.
- Email tiene decision propia: Gmail API + Pub/Sub via `EmailAdapter`.
- APIs no oficiales, passwords, app passwords, scraping y sesiones QR quedan prohibidas donde aplica.
- Email no tiene auto-registro: crea pendientes y Core registra solo si el usuario confirma.
- Pendientes no afectan saldos.
- Agentes no escriben DB ni Core; consultan por `ToolGateway`.
- Toda escritura financiera pasa por `CommandDispatcher` y Core.
- Eventos externos e internos estan separados.
- `Transactional Outbox` queda como regla no negociable.
- `whatsapp_window_states` y `email_connections/messages` quedan modelados para las decisiones de proveedor.
- `encrypted_refresh_token` puede quedar `null` al desconectar email; no se conserva secreto por obligacion de schema.
- Metas/limites formales, multi-moneda UI completa, integraciones bancarias directas, legal completo, pricing y unit economics siguen fuera de Fase 4 V1.
- No quedan referencias antiguas a nombres legacy de stack/data model, stack frontend anterior como decision, ni arquitectura IA antigua por capas.
- `23_plan_implementacion_v1.md` conecta las specs con una ruta de construccion por cortes.
- `23b_seguimiento_construccion_v1.md` registra el avance real de implementacion, mocks, QA, deuda tecnica y siguiente paso.
- Fase 6 define identidad visual, design system y prototipo/handoff; Fase 4 solo define el mecanismo tecnico para implementarlo.
- `24_paquete_identidad_meta.md` define el paquete publico minimo para reintentar verificacion Meta sin usar datos incompletos, dominios incorrectos o documentos de terceros.
- La auditoria integral inventaria 14 agentes, 15 tools, 21 flujos, learning, `local_fixture`, lifecycle, privacidad, lenguaje, visual y metricas.
- La matriz distingue evidencia documental, codigo, tests, smokes, live, usuario y metricas; ningun nivel sustituye al siguiente.
- Las conclusiones de arquitectura objetivo son recomendaciones auditadas. No reemplazan el decision log ni autorizan implementacion hasta aprobar los cortes correspondientes.

Regla de mantenimiento:

```text
Si cambia una decision de proveedor, stack, Core, eventos, AgentRuntime o datos,
actualizar primero `20_decisiones_tecnicas.md` y luego el documento tecnico afectado.
```

---

## 8. Resumen

Fase 4 no busca hacer la arquitectura mas compleja. Busca que Manzana sea implementable sin perder la calidad de producto definida en Fase 2 y Fase 3.

La arquitectura financiera queda firme. El stack base V1 queda aprobado, con herramientas equivalentes permitidas cuando no rompen el contrato.

La regla:

```text
Specs primero.
Implementacion por cortes pequenos.
Nada financiero sin Core.
Nada proactivo sin politica.
Nada agentic sin tools controladas.
Nada async sin outbox.
```

*Fase 4 Tecnica - Indice V1.10 auditado*
