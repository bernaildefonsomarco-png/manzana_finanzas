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
| `C-03` | 14 tools vs. 15 tools — documentación de capacidades desactualizada. | **Cerrada, cambiando el método y no el número.** El catálogo se genera por agregación desde las §14 de los dieciséis módulos y **un test falla el build** si se desincroniza (`40` §2, `AC-CAT-01`). Contar bien una vez no habría servido: el defecto era mantener dos listas a mano. La cifra real son 95 comandos y 145 entradas de lectura; la antigua contaba "tools" de otra arquitectura. Al agregar aparecieron además 7 colisiones de nombre, 1 de comando, 5 medidas con dos dueños y 3 módulos sin declarar sus prohibiciones — todo corregido en la Ola 10 (`40` §9). | `40_catalogo_de_tools_y_comandos.md` | `TEST` (`AC-CAT-01` a `AC-CAT-03`) |
| `C-04` | Modo discreto transversal vs. toggles locales — exposición desigual y preferencia no persistente. | **Cerrada.** `RUL-CONF-03`: preferencia de servidor, **un único resolvedor**, aplicada al renderizar en servidor y activa en todos los dispositivos. Ninguna pantalla decide por su cuenta qué ocultar (`AC-CONF-03`). La columna `discreet_mode_enabled` ya existía en la migración `045`; lo que faltaba era que las pantallas la usaran. Se aplica en servidor y no en cliente porque hacerlo en cliente deja un instante con los montos visibles, que es justo el instante que el modo evita (`AC-CONF-04`). | `45_configuracion_privacidad_y_control_de_datos.md` | `TEST` + `USER` |
| `C-05` | Once tipos manuales vs. tres no guardables — capacidad visible que no termina el trabajo. (Nota: la verificación de código encontró 9, no 3, tipos no guardables — el número real es peor que el documentado por la matriz.) | Los 11 tipos canónicos de movimiento deben ser guardables desde la misma pantalla de Movimientos, sin expulsar al usuario a otra sección. | `26_modulo_movimientos.md` | `TEST` + `USER` |
| `C-06` | Registrar lo claro y preguntar lo ambiguo vs. lote bloqueado completo — fricción y pérdida de captura. | Cada ítem se procesa de forma independiente: lo claro se registra, lo ambiguo se marca pendiente, sin bloquear el lote entero. **Cierre parcial en V1**: aplica al registro múltiple y a los pendientes. El cierre completo llega con la importación de archivos, diferida a V1.1 (`29` §21.1). | `29_modulo_captura_sin_friccion.md`, `27_modulo_pendientes_y_confirmaciones.md` | `TEST` |
| `C-07` | Usuario puede corregir todo dato importante vs. Movimientos sin editar/borrar/detalle — control incompleto. | Detalle, edición, eliminación y restauración (ya modelada en la migración `046_movement_restore`) son parte obligatoria del módulo desde el diseño, no un añadido posterior. | `26_modulo_movimientos.md`, `11_confianza_errores_y_reversibilidad.md` | `TEST` + `USER` |
| `C-08` | Memoria reversible/auditable vs. sin API/UI de revocar/olvidar — promesa no accesible al usuario. | **Cerrada.** Ver, corregir, deshacer y olvidar son las cuatro acciones obligatorias, ya especificadas: `RUL-MEM-06` a `RUL-MEM-09`, superficies `SCR-MEM-01` a `SCR-MEM-04`, rutas en `36` §10, y `AC-MEM-02`. Olvidar deja **lápida** (`WEB-D059`), sin la cual el sistema reaprendía lo mismo al día siguiente. La portabilidad la aporta `35` (`RUL-REP-11`), que incluye el perfil aprendido en la exportación. La promesa era cierta en el modelo de datos —`044` ya tenía `revoked_at`— y falsa en la experiencia. | `36_modulo_memoria_y_aprendizaje.md`, `35` §6 | `TEST` + `USER` |
| `C-09` | Lifecycle V1 documentado vs. solo onboarding inicial + drafts — retención no implementada como sistema. | Se acota el alcance real de lifecycle a lo que la app web puede sostener sin WhatsApp (onboarding + notificaciones por correo); el sistema completo de retención multi-canal se difiere a fase 2. | `44_onboarding_web.md`, `46_notificaciones_y_correo_saliente.md` — **diferido a WhatsApp**: sistema de lifecycle D1-D30 completo en `docs/fase_3_producto/15_retencion_lifecycle.md` (congelado) | `DOC` para V1-web; `LIVE`/`METRIC` diferido |
| `C-10` | Inteligencia compartida entre canales (promesa) vs. working set por canal (implementación) — Core común, conversación no común. | Se diseña el motor agnóstico de canal desde cero (`WEB-D003`), con un `TurnWorkspace`/foco compartido explícito y una prueba de agnosticismo escribible como test. Esta contradicción es precisamente la que la separación web/WhatsApp busca prevenir de raíz. | `20_arquitectura_motor_conversacional.md`, `21_contrato_de_canal_y_presentadores.md` | `TEST` (prueba de agnosticismo) |
| `C-11` | Confianza humana (lenguaje) vs. porcentaje visible en búsqueda — lenguaje técnico visible. | **Cerrada, y por construcción.** El porcentaje era el síntoma de una búsqueda que adivina: `RUL-BUS-02` la hace determinista —filtros y coincidencia literal, orden por fecha— así que **no se calcula ninguna relevancia y no existe el campo** en ninguna respuesta (`AC-BUS-01`). Se refuerza con `WEB-D046`: los scores de los descubrimientos tampoco se serializan al cliente. La regla de lenguaje del glosario §7.3 sigue vigente para el resto del producto; aquí ya no hace falta, porque no hay nada que ocultar. | `38_modulo_busqueda_y_navegacion_rapida.md`, `34` §10, `04_glosario_y_lenguaje_visible.md` | `TEST` + `USER` |
| `C-12` | Dark mode especificado (diseño) vs. solo light implementado en CSS — estado visual documentado, no implementado. | El design system especifica los tokens de modo oscuro como obligatorios desde el primer corte de implementación de UI, no como mejora posterior. | `16_design_system_web.md` | `CODE` + `TEST` |
| `C-13` | Errores humanos en español vs. Auth publicando `error.message` del proveedor en inglés — error real sin traducir y sin siguiente paso. | **Cerrada, y la lectura del código la matizó.** La traducción ya existe en `auth-screen.tsx` y cubre cinco casos, con un genérico de reserva que nunca deja pasar el texto crudo: el defecto real no es que publique inglés —no lo hace— sino que **traduce por coincidencia de subcadenas**, y eso falla en silencio si el proveedor cambia una palabra. `RUL-AUTH-05` mapea por **código**, y `AC-AUTH-02` exige **alerta de observabilidad** ante un código desconocido, que convierte un fallo silencioso en visible. | `43_auth_y_cuenta.md` | `CODE` + `TEST` |
| `C-14` | Eliminación automática disponible (Settings/API) vs. página pública dice que puede no estar disponible — guía legal desactualizada. | **Cerrada, y confirmada leyendo el archivo:** `/eliminar-datos` dice literalmente que el borrado "no esté disponible dentro de la app" mientras `/api/v1/privacy/account` existe y funciona. Se reescribe la página con el flujo real como vía principal y el correo como alternativa para quien no puede entrar (`45` `SCR-CONF-08`). Y sobre todo `AC-CONF-10`: **el build falla si vuelven a divergir**. | `45_configuracion_privacidad_y_control_de_datos.md` | `TEST` + `USER` |
| `C-15` | Una cuenta de email por usuario (`05d_email_parsing.md`) vs. Corte 32 multi-buzón ya implementado — la spec de feature quedó detrás del contrato real. | El módulo nuevo documenta el contrato multi-buzón que ya existe en código (migración `041_email_multi_mailbox_sources`), no la versión de una sola cuenta. | `28_modulo_email_y_deteccion_bancaria.md` | `CODE` (ya implementado, solo falta documentarlo correctamente) |
| `C-16` | Limited Use exigido (Fase 5 y política vigente de Google) vs. ausente en la política pública `/privacidad` — requisito documentado pero no publicado. | **Cerrada, y confirmada leyendo el archivo:** cero menciones de Limited Use en `/privacidad`. `RUL-CONF-08` lo fija como requisito obligatorio de contenido y `AC-CONF-08` lo verifica **contra el texto publicado**, no contra el que se pretendía publicar. El texto exacto se copia de la política vigente de Google; este corpus fija que tiene que estar, no cómo se redacta. | `45_configuracion_privacidad_y_control_de_datos.md` | `TEST` |
| `C-17` | Proactivos "activados por defecto" (tabla antigua de `05a`) vs. consentimiento atómico y gate live posteriores — se resuelve a favor de la regla posterior. | **Cerrada.** `RUL-REC-04` fija que ningún canal que interrumpa viene activado, y el consentimiento del correo es **por tipo, no global** (`WEB-D070`): diez interruptores, los diez apagados al crear la cuenta, visibles vacíos en `SCR-REC-03`. Se verifica con `AC-REC-01` y `AC-REC-02`. Y `WEB-D073` lo completa por el otro lado: la preferencia se lee **al enviar**, no al encolar, para que apagar el interruptor tenga efecto inmediato. La tabla antigua de `05a` que los daba por activados no se hereda. | `37_modulo_recordatorios_in_app.md`, `46_notificaciones_y_correo_saliente.md` | `TEST` + `USER` |

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
