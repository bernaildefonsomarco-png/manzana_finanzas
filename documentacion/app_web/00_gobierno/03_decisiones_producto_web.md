# 03 — Decisiones de producto web

**Bloque:** 00 — Gobierno
**Estado:** vivo
**Fecha de última actualización:** 25 de julio de 2026
**Depende de:** `02_mapa_herencia_corpus_legacy.md`
**Formato heredado de:** `docs/fase_4_tecnica/20_decisiones_tecnicas.md`

---

## 1. Tesis

Este documento separa tres cosas que no deben mezclarse, igual que hacía su
antecesor en Fase 4:

- reglas necesarias para proteger dinero, datos y confianza del usuario,
- decisiones de producto ya tomadas por el usuario en esta conversación,
- recomendaciones técnicas que todavía pueden cambiar.

Cada decisión que cambie algo ya escrito en otro documento del corpus se
registra aquí primero, con fecha y motivo, y luego se propaga al documento
técnico afectado — nunca al revés.

## 2. Estados permitidos

| Estado | Significado |
|---|---|
| `no_negociable` | Regla necesaria para seguridad, consistencia financiera o confianza. No cambia sin rediseñar la arquitectura. |
| `aprobada_producto` | Decisión ya aceptada por el usuario. Se implementa como contrato V1. |
| `recomendada` | Recomendación técnica fuerte, opción preferida actual, requiere aprobación explícita antes de tratarse como cerrada. |
| `pendiente_decision` | Necesita definición futura antes de implementación productiva. |
| `fuera_v1` | No pertenece a la implementación V1-web inicial. |

## 3. Decision log

| ID | Tema | Estado | Decisión | Razón | Riesgo si se ignora | Docs afectados |
|---|---|---|---|---|---|---|
| WEB-D001 | Separación de fases del producto | `aprobada_producto` | Primero se documenta y construye la app web completa, vendible sin WhatsApp. WhatsApp se conecta después como canal conversacional completo sobre el mismo motor. | Construir todo a la vez repitió el patrón que generó el problema actual: 70% del esfuerzo reciente fue a WhatsApp/IA y la app web quedó sin routing ni primitivas de UI. | Repetir el desbalance; volver a lanzar algo simple y sin terminar. | `06_tesis_app_web.md`, `56_puente_a_fase_whatsapp.md` |
| WEB-D002 | Ambición funcional de la app web | `aprobada_producto` | La app web incluye: memoria financiera con control (ver/corregir/deshacer/olvidar), detección de recurrentes y cuotas, detección bancaria por email con confirmación y enriquecimiento de contexto, presupuestos/metas/límites, proyecciones y simulación, reportes/gráficos/exportación, y captura sin fricción. | `05c_dashboard.md` §20 dejaba todo esto fuera de V1 por diseño; sin esto la app web es un CRUD financiero bonito, no vendible sola. | Repetir el "producto demasiado simple" que motivó esta reestructuración. | `07_alcance_web_v1.md`, docs 24-39 |
| WEB-D003 | IA completa dentro de la app web | `aprobada_producto` | La app web lleva un asistente conversacional completo (registra, corrige, consulta, explica), no solo búsqueda read-only. El motor se construye agnóstico de canal; WhatsApp es después solo otro adaptador de canal sobre el mismo motor. | `05c_dashboard.md` §15 prohibía IA de escritura en la app por decreto. El usuario quiere el motor bien diseñado desde el inicio, no un parche para cuando llegue WhatsApp. | Repetir la fragmentación de autoridad semántica que la auditoría del 23 de julio identificó como el problema P0 real de WhatsApp. | `20_arquitectura_motor_conversacional.md` a `23_runtime_ia_modos_costo_y_degradacion.md`, `41_asistente_ia_en_la_app.md` |
| WEB-D004 | El motor se diseña antes de mirar el código existente | `no_negociable` | Los documentos 20-23 y 41 (arquitectura del motor conversacional) se escriben sin abrir `src/agents/` ni `src/core/conversation/`. La auditoría del 23 de julio se usa solo como diagnóstico de qué salió mal, nunca como especificación heredada. Solo el documento 42, después de que 20-23/40-41 estén cerrados, abre el código y decide qué se reutiliza. | El usuario pidió explícitamente: "primero lo planificamos y agarramos lo que nos sirve de lo que tenemos" — no partir de lo que existe. | Terminar re-documentando el diseño actual (fragmentado, con 4 llamadas LLM por turno) en vez de mejorarlo. | `03_motor_ia/` completo, `42_reutilizacion_del_codigo_existente_motor.md` |
| WEB-D005 | Estrategia de código: conservar backend, reconstruir web | `aprobada_producto` | Se conservan `src/core/` (25.475 líneas, 827 tests), `src/data/` (46 migraciones, RLS), y la mayoría de `src/app/api/v1/`. Se reconstruye la capa `src/features/` y el routing (`src/app/(dashboard)/` está vacío hoy). | El backend está por encima del promedio del proyecto; tirarlo repetiría trabajo probado. El daño real está en la UI y en la ausencia de rutas. | Reescribir 25k líneas de dominio testeado sin necesidad, o conservar una UI monolítica sin routing. | `52_inventario_reutilizacion_codigo_src.md` |
| WEB-D006 | Documentar todo antes de implementar | `aprobada_producto` | Se escribe el corpus completo (57 documentos, ~50.000 líneas estimadas) antes de tocar código de features. | Es la petición explícita del usuario: "primero documentaremos para luego construir", evitando volver a improvisar. | Volver al patrón que produjo componentes de 2.000+ líneas sin especificación previa. | `00_indice_maestro.md` (orden de olas) |
| WEB-D007 | Nombre y ubicación del corpus nuevo | `aprobada_producto` | `documentacion/app_web/` como carpeta hermana de `docs/`. `docs/` se congela (ver `docs/AVISO_CORPUS_HISTORICO.md`), no se edita ninguno de sus 54 documentos. Cuando abra la fase 2 nace `documentacion/whatsapp/` como hermana de `app_web/`. | El corpus nuevo invierte la tesis de `05c_dashboard.md`; escribirlo dentro de `docs/` heredaría autoridad de documentos que va a contradecir. Nombre elegido por el usuario sobre la opción inicial `docs_app_web_v1/`. | Ambigüedad sobre cuál corpus es la fuente de verdad activa. | Estructura de carpetas completa |
| WEB-D008 | El número de archivo es el orden de escritura | `aprobada_producto` | Cada documento se numera según cuándo se escribe, no según cuándo se lee. El orden de lectura por rol vive en `00_indice_maestro.md`. | Evita el problema de `docs/`, donde `05c_dashboard.md` es anterior a `17_dashboard_ux.md` pero éste lo solapa en 60-70%, sin que el número lo advierta. | Repetir duplicación de contenido entre documentos con numeración que no refleja dependencia real. | `01_convenciones_y_plantillas.md` §2 |
| WEB-D009 | Saneamiento previo (Ola 0) ejecutado | `aprobada_producto` | Antes de escribir el corpus se resolvieron dos bloqueantes: `.git` estaba vacío (ahora hay commit baseline `e8c0e3c` y tag `baseline-pre-web-v1`) y las migraciones estaban desincronizadas (`src/data/migrations/` sincronizado contra `supabase/migrations/`, que queda como fuente canónica). También se limpió basura de raíz y se corrigió el `README.md`. | Reconstruir 116k líneas sin control de versiones es jugar sin red; escribir un modelo de datos sobre dos fuentes divergentes produce un documento poco fiable. | Perder trabajo sin forma de revertir; documentar un modelo de datos que no coincide con ninguna de las dos ramas reales. | `53_deuda_tecnica_y_saneamiento.md` |
| WEB-D010 | Bypass de RLS por service-role: se documenta ahora, se ejecuta después | `aprobada_producto` | El hallazgo de que ~50 de 58 rutas `/api/v1` usan `createServiceClient()` (bypass total de RLS) no se corrige durante la fase de documentación. Se define la política en `15_seguridad_autorizacion_y_rls.md` y se ejecuta como corte temprano en `54_plan_de_implementacion_web.md`, con un test que falla el build si una ruta se sale de la lista blanca. | El documento 14 va a redefinir esas mismas rutas (paginación por cursor, filtros server-side, rate limiting); tocarlas dos veces es peor que tocarlas una vez con el diseño final. | Riesgo de seguridad aceptado conscientemente durante el periodo de documentación — registrado aquí para que no se olvide. | `15_seguridad_autorizacion_y_rls.md`, `53_deuda_tecnica_y_saneamiento.md` |
| WEB-D011 | Core Financiero como dominio propio | `no_negociable` (heredado de F4-D001) | El Core sigue siendo la única capa que escribe dinero real, separada de UI, adapters y agentes. | Sigue vigente sin cambios: el dinero requiere reglas trazables y reproducibles, con o sin WhatsApp. | Escrituras financieras sin validación central. | `12_arquitectura_app_web.md`, `13_modelo_datos_web_v1.md` |
| WEB-D012 | `CommandDispatcher` como única vía de escritura | `no_negociable` (heredado de F4-D003) | Toda escritura financiera aprobada, venga de un formulario, una importación o el asistente IA, pasa por comandos del Core. | Unifica validación, auditoría, idempotencia y permisos sin importar el origen de la acción. | Doble lógica de escritura y reglas divergentes entre UI y motor IA. | `14_contratos_api_web.md`, `22_grounding_evidencia_y_politica.md` |
| WEB-D013 | Ninguna operación de dinero sin confirmación explícita del usuario | `no_negociable` | Igual que email nunca auto-registra (F4-D007/F4-D008), el asistente IA de la app tampoco ejecuta movimientos, presupuestos o cambios de configuración sin que el usuario los confirme explícitamente. | Extiende el principio de control ya validado en email al nuevo canal de asistente en la app; es condición explícita del usuario en la decisión WEB-D003. | El asistente ejecuta acciones no deseadas, replicando el hallazgo P0.5 de la auditoría (pendientes creados como confirmables sin serlo). | `22_grounding_evidencia_y_politica.md`, `41_asistente_ia_en_la_app.md` |

---

## 4. Cómo usar este log

1. Antes de escribir cualquier documento del corpus, revisar si la decisión
   relevante ya existe aquí.
2. Si es `no_negociable`, se implementa como regla sin excepción.
3. Si es `aprobada_producto`, se implementa como contrato V1-web.
4. Si es `recomendada`, se usa como default técnico, sin presentarla como
   aprobación final hasta que el usuario la confirme explícitamente.
5. Si es `pendiente_decision`, se pregunta al usuario antes de construir
   sobre ella en el documento correspondiente.
6. Si es `fuera_v1`, no se documenta como funcionalidad activa salvo cambio
   explícito de alcance registrado aquí primero.

## 5. Resumen

```text
Separación web/WhatsApp: aprobada.
Ambición funcional de la app web: aprobada y amplia.
Motor IA agnóstico, diseñado desde cero: no negociable en el proceso de escritura.
Backend: se conserva. UI y routing: se reconstruyen.
Documentar todo antes de implementar: aprobada.
Saneamiento de git y migraciones: ejecutado.
Bypass de RLS: documentado, pendiente de ejecución con gate de test.
```
