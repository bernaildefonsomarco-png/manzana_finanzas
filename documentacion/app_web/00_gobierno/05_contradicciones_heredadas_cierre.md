# 05 — Cierre de contradicciones heredadas

**Bloque:** 00 — Gobierno
**Estado:** vivo (se actualiza el campo "Cierre real" a medida que avanza la implementación)
**Fecha:** 25 de julio de 2026
**Depende de:** `02_mapa_herencia_corpus_legacy.md`
**Fuente:** `docs/fase_4_tecnica/matriz_cumplimiento_integral_v1_2026-07-24.md` §14

---

## 1. Para qué existe este documento

La matriz de cumplimiento del 24 de julio identificó 17 contradicciones
(`C-01` a `C-17`) entre lo que el producto promete y lo que hace. Este
documento decide, para cada una, en qué documento del corpus nuevo se
cierra, si se difiere a la fase WhatsApp, o si en realidad la contradicción
era falsa. Ninguna de las 17 queda sin resolución explícita.

Formato por fila: la contradicción tal como la describió la matriz, la
resolución (dónde se cierra), y el nivel de evidencia que se exigirá para
declararla cerrada de verdad (ver niveles en `01_convenciones_y_plantillas.md`
§4).

---

## 2. Tabla de cierre

| ID | Contradicción original | Resolución en el corpus nuevo | Se cierra en | Evidencia exigida |
|---|---|---|---|---|
| `C-01` | Fixture solo degradado vs. fallback por defecto — la calidad de producción puede cambiar silenciosamente. | Se prohíbe `local_fixture` en producción por diseño, con gate de arranque: el proceso no arranca si el proveedor por defecto es fixture. | `23_runtime_ia_modos_costo_y_degradacion.md` | `TEST` (test que falla el build) + `LIVE` (verificación en producción) |
| `C-02` | Cinco agentes API en Production vs. runtime no autocertificable — no puede probarse configuración efectiva ni impedir degradación silenciosa. | Se especifica un endpoint de readiness por componente del motor (ya existe parcialmente en `src/agents/runtime/readiness.ts`, evaluado en el doc 42) que reporta proveedor efectivo y bloquea si no es seguro. | `23_runtime_ia_modos_costo_y_degradacion.md`, `42_reutilizacion_del_codigo_existente_motor.md` | `SMOKE` + `LIVE` |
| `C-03` | 14 tools vs. 15 tools — documentación de capacidades desactualizada. | El catálogo de tools se genera por agregación mecánica desde los módulos, no se mantiene a mano; no puede desincronizarse porque no hay una segunda fuente. | `40_catalogo_de_tools_y_comandos.md` | `DOC` (el mecanismo de generación evita la reaparición del problema) |
| `C-04` | Modo discreto transversal vs. toggles locales — exposición desigual y preferencia no persistente. | Modo discreto se especifica como preferencia de servidor, aplicada por un único punto de decisión (no por cada pantalla individualmente), y su función ya existe parcialmente en la migración `045_experience_privacy_preferences`. | `45_configuracion_privacidad_y_control_de_datos.md`, `08_principios_experiencia_web.md` | `TEST` + `USER` |
| `C-05` | Once tipos manuales vs. tres no guardables — capacidad visible que no termina el trabajo. (Nota: la verificación de código encontró 9, no 3, tipos no guardables — el número real es peor que el documentado por la matriz.) | Los 11 tipos canónicos de movimiento deben ser guardables desde la misma pantalla de Movimientos, sin expulsar al usuario a otra sección. | `26_modulo_movimientos.md` | `TEST` + `USER` |
| `C-06` | Registrar lo claro y preguntar lo ambiguo vs. lote bloqueado completo — fricción y pérdida de captura. | La importación y el registro múltiple procesan cada ítem de forma independiente: lo claro se registra, lo ambiguo se marca pendiente, sin bloquear el lote entero. | `29_modulo_captura_sin_friccion_e_importacion.md`, `27_modulo_pendientes_y_confirmaciones.md` | `TEST` |
| `C-07` | Usuario puede corregir todo dato importante vs. Movimientos sin editar/borrar/detalle — control incompleto. | Detalle, edición, eliminación y restauración (ya modelada en la migración `046_movement_restore`) son parte obligatoria del módulo desde el diseño, no un añadido posterior. | `26_modulo_movimientos.md`, `11_confianza_errores_y_reversibilidad.md` | `TEST` + `USER` |
| `C-08` | Memoria reversible/auditable vs. sin API/UI de revocar/olvidar — promesa no accesible al usuario. | Ver, corregir, deshacer y olvidar son las cuatro acciones obligatorias de toda superficie de memoria (regla ya fijada en `WEB-D013` y en el glosario §8.5). | `36_modulo_memoria_y_aprendizaje.md` | `TEST` + `USER` |
| `C-09` | Lifecycle V1 documentado vs. solo onboarding inicial + drafts — retención no implementada como sistema. | Se acota el alcance real de lifecycle a lo que la app web puede sostener sin WhatsApp (onboarding + notificaciones por correo); el sistema completo de retención multi-canal se difiere a fase 2. | `44_onboarding_web.md`, `46_notificaciones_y_correo_saliente.md` — **diferido a WhatsApp**: sistema de lifecycle D1-D30 completo en `docs/fase_3_producto/15_retencion_lifecycle.md` (congelado) | `DOC` para V1-web; `LIVE`/`METRIC` diferido |
| `C-10` | Inteligencia compartida entre canales (promesa) vs. working set por canal (implementación) — Core común, conversación no común. | Se diseña el motor agnóstico de canal desde cero (`WEB-D003`), con un `TurnWorkspace`/foco compartido explícito y una prueba de agnosticismo escribible como test. Esta contradicción es precisamente la que la separación web/WhatsApp busca prevenir de raíz. | `20_arquitectura_motor_conversacional.md`, `21_contrato_de_canal_y_presentadores.md` | `TEST` (prueba de agnosticismo) |
| `C-11` | Confianza humana (lenguaje) vs. porcentaje visible en búsqueda — lenguaje técnico visible. | Se prohíbe mostrar porcentaje de confianza numérico en cualquier superficie estándar (regla ya en el glosario §3, fila `Confidence`); se usa lenguaje de incertidumbre (§7.3 del glosario). | `38_modulo_busqueda_y_navegacion_rapida.md`, `04_glosario_y_lenguaje_visible.md` | `TEST` + `USER` |
| `C-12` | Dark mode especificado (diseño) vs. solo light implementado en CSS — estado visual documentado, no implementado. | El design system especifica los tokens de modo oscuro como obligatorios desde el primer corte de implementación de UI, no como mejora posterior. | `16_design_system_web.md` | `CODE` + `TEST` |
| `C-13` | Errores humanos en español (lenguaje de producto) vs. Auth publicando `error.message` del proveedor en inglés — error real sin traducir y sin siguiente paso. | Todo mensaje de error visible pasa por el contrato `ERR-` de la plantilla de módulo (§9 de `01_convenciones_y_plantillas.md`): causa, mensaje en español, acción de salida. Prohibido propagar mensajes crudos de proveedor. | `43_auth_y_cuenta.md` | `TEST` + `USER` |
| `C-14` | Eliminación automática disponible (Settings/API) vs. página pública dice que puede no estar disponible — guía legal desactualizada. | Se sincroniza el texto legal público con la capacidad real del producto al momento de redactar `45_configuracion_privacidad_y_control_de_datos.md`; ambos se versionan juntos. | `45_configuracion_privacidad_y_control_de_datos.md` | `DOC` + `LIVE` (verificación de la página pública real) |
| `C-15` | Una cuenta de email por usuario (`05d_email_parsing.md`) vs. Corte 32 multi-buzón ya implementado — la spec de feature quedó detrás del contrato real. | El módulo nuevo documenta el contrato multi-buzón que ya existe en código (migración `041_email_multi_mailbox_sources`), no la versión de una sola cuenta. | `28_modulo_email_y_deteccion_bancaria.md` | `CODE` (ya implementado, solo falta documentarlo correctamente) |
| `C-16` | Limited Use exigido (Fase 5 y política vigente de Google) vs. ausente en la política pública `/privacidad` — requisito documentado pero no publicado. | La declaración Limited Use de Google se incluye como requisito obligatorio de contenido en la página pública de privacidad, verificado contra el texto real antes de cerrar el documento. | `45_configuracion_privacidad_y_control_de_datos.md` | `LIVE` (verificación de la página pública real) |
| `C-17` | Proactivos "activados por defecto" (tabla antigua de `05a`) vs. consentimiento atómico y gate live posteriores — se resuelve a favor de la regla posterior. | Ningún canal de salida (correo, en la fase actual) tiene opt-in por defecto. Se hereda expresamente la regla ya correcta: ningún default interno constituye opt-in externo. | `46_notificaciones_y_correo_saliente.md` | `TEST` + `USER` |

---

## 3. Resumen por tipo de cierre

| Tipo de cierre | Cantidad | IDs |
|---|---|---|
| Se cierra en un documento de módulo de V1-web | 14 | `C-02` a `C-08`, `C-11` a `C-17` (salvo `C-09` parcial) |
| Se cierra en documento de gobierno/transversal | 3 | `C-01`, `C-03`, `C-04` |
| Se difiere parcialmente a fase WhatsApp | 1 | `C-09` (el sistema de lifecycle multi-canal completo) |

Ninguna contradicción se ignora ni se descarta sin resolución explícita. La
`C-09` es la única con cierre parcial: la app web resuelve la parte que le
corresponde (onboarding y notificaciones por correo), y dejamos anotado en
`56_puente_a_fase_whatsapp.md` que el sistema completo de lifecycle
multi-canal (D1 a D30 con reenganche vía WhatsApp) espera a la fase 2.

## 4. Regla de mantenimiento

Cuando un documento de módulo cierre su contradicción correspondiente con
evidencia real (no solo `DOC`), se actualiza la columna implícita de estado
en `50_matriz_de_trazabilidad_web.md`, que es el sucesor vivo de este
documento para el seguimiento durante la implementación. Este documento
(`05`) queda fijo como el registro de la decisión de dónde se cierra cada
una; `50` registra si ya se cerró de verdad.
