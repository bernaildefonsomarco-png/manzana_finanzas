# Plan de validación

## Propósito

Este plan convierte los límites de la auditoría estática en evidencia verificable sin tocar producción. La validación debe responder tres preguntas separadas:

1. **Funcional:** ¿la persona puede completar el trabajo y verificar la consecuencia real?
2. **Cognitiva:** ¿puede explicar qué entendió Manzana, qué evidencia usó, qué es incierto y qué puede corregir?
3. **Emocional:** ¿qué transición describe la persona durante el recorrido y qué condiciones la favorecen o la erosionan?

La tercera pregunta solo puede responderse con evidencia directa de participantes. La interfaz y la telemetría no autorizan a afirmar calma, confianza, culpa, ansiedad o agencia.

## Prohibiciones

**No usar credenciales, sesiones, tokens, correos, teléfonos, cuentas financieras, datos personales ni datos financieros de producción.**

**No copiar una base de producción a un entorno de prueba, incluso si se eliminan nombres visibles.** Utilizar datos completamente sintéticos y cuentas desechables.

**No ejecutar eliminación de cuenta, baja, envíos, conexión Gmail/WhatsApp ni mutaciones contra producción.**

**No usar telemetría, frecuencia de uso, clics, tiempo de sesión o abandono como prueba de emociones.** Esos datos solo pueden señalar dónde investigar.

**No tratar `/estado` como salud en tiempo real.** Es una página actualizada manualmente (`src/app/(publico)/estado/page.tsx:3-15`).

## Qué no puede probar la revisión estática

| Área | Pregunta no resuelta |
|---|---|
| Sesión y autorización | ¿Los redirects, refresh de sesión, expiración y retorno a `redirigir` funcionan en cada navegador? |
| Backend y datos | ¿Las mutaciones persisten una sola vez, invalidan las vistas correctas y mantienen integridad entre dominios? |
| Tokens | ¿Verificación, recuperación y baja distinguen tokens válidos, inválidos, expirados, usados y ausentes? |
| Foco | ¿El foco entra, queda limitado cuando corresponde y vuelve al disparador después de navegación, diálogo o panel? |
| Lectores de pantalla | ¿Landmarks, nombres, estados, tablas y live regions se anuncian en orden y con prioridad adecuada? |
| Teclado | ¿Todo control es alcanzable y operable sin trampas, saltos o pérdida de contexto? |
| Responsive | ¿Teclado virtual, zoom, orientación, contenido largo y densidad variable producen solapamiento u overflow? |
| Red y fallas | ¿La experiencia diferencia carga, timeout, offline, 4xx, 5xx, sesión expirada y resultado incierto? |
| Idempotencia | ¿Reintentar después de timeout evita duplicados y presenta el resultado real? |
| Continuidad | ¿Pregunta, filtros, selección, borrador, entidad, hilo y posición se conservan entre superficies? |
| Datos parciales | ¿El producto aporta valor sin exigir completar historial, categorías, cuentas o pendientes? |
| Comprensión | ¿Las personas distinguen saldo, dinero libre, caja, compromiso, movimiento, pendiente, presupuesto, meta e inferencia? |
| Resultado emocional | ¿Las personas describen mayor claridad/control o, por el contrario, confusión, presión o desconfianza? |

## Prerrequisitos seguros para runtime autenticado

La validación autenticada solo puede comenzar cuando estén disponibles todos estos prerrequisitos:

- Un deployment aislado o entorno local construido desde el mismo commit a validar, con dominio claramente no productivo.
- Un proyecto de base de datos/autenticación exclusivo de pruebas, sin enlaces, réplicas ni credenciales de producción.
- Variables de entorno de prueba separadas y rotables; ningún secreto de producción en shell, CI o navegador.
- Cuentas sintéticas desechables por escenario, creadas mediante un fixture documentado y eliminables al finalizar.
- Datos sintéticos deterministas en PEN y USD que cubran historial parcial, duplicados, cuentas/cajas, deudas, recurrentes, presupuestos, metas, pendientes, memoria y conversaciones.
- Buzón de correo sandbox y callbacks de Auth apuntando solo al dominio aislado.
- Integraciones Gmail, WhatsApp, correo saliente y webhooks sustituidas por dobles/sandboxes que no contacten personas reales.
- Capacidad de resetear el estado entre casos y de inspeccionar el resultado real en base de prueba.
- Inyección controlada de 400, 401, 403, 404, 409, 422, 429, 500, timeout y desconexión sin modificar producción.
- Trazas correlacionables por `trace_id`, sin PII ni contenido financiero sensible.
- Reloj/zonas horarias controlables para vencimientos, recordatorios, expiraciones y America/Lima.
- Cuentas específicas para acciones irreversibles, sin reutilizar una cuenta entre eliminación y otros casos.
- Evidencia previa de que el entorno no puede resolver endpoints de producción por error.

### Fixtures mínimos

| Fixture | Estado sintético requerido | Recorridos |
|---|---|---|
| `usuario_nuevo` | Cuenta sin onboarding ni datos | J01, J02 |
| `historial_parcial` | 8–12 movimientos, categorías incompletas, dos meses con huecos | J03, J04, J10, J11 |
| `pendientes_mixtos` | Confirmable, incompleto, duplicado probable, ya registrado, origen correo/WhatsApp | J03, J05 |
| `dinero_comprometido` | Dos cuentas, dos cajas, deuda, pago próximo y saldo parcial | J06, J07, J08, J10 |
| `planificacion` | Presupuesto activo/sobre límite, meta con/sin caja, periodo anterior | J09 |
| `memoria_mixta` | Recuerdo confirmado, candidato, contradicción, inactivo, historial | J12 |
| `retorno_lapso` | 2, 7 y 15 días sintéticos de inactividad; con/sin pendientes | J11, J13 |
| `cuenta_eliminable` | Datos mínimos y export job, sin conexión real | J12, J13 |
| `token_auth` | Enlace válido, expirado, usado, inválido y ausente | J01, J13 |
| `token_baja` | Token válido, expirado, repetido e inválido | J11, J12 |

## Estrategia de validación

### Fase 0. Corregir riesgos que invalidan la prueba

No exponer participantes a un falso éxito irreversible ni a affordances primarias deliberadamente muertas. Antes de investigación moderada:

1. Resolver `UX-C-001`.
2. Resolver o neutralizar `UX-H-001`, `UX-H-002` y `UX-H-003`.
3. Resolver el acceso por teclado al overlay `UX-H-008`.
4. Instrumentar resultados y fallas sin datos sensibles.

Las demás brechas pueden probarse de forma diagnóstica si el moderador evita consecuencias reales y documenta el riesgo.

### Fase 1. Smoke público reproducible

Repetir las 13 rutas seguras y añadir `/baja` solo con tokens sandbox. Para cada viewport:

- Registrar URL solicitada/final, status, redirects y título.
- Capturar consola, page errors, requests fallidas y respuestas ≥400.
- Verificar landmarks, encabezado principal, nombres de controles, tab order inicial y overflow.
- No enviar formularios contra producción; en aislado, validar éxito/error con datos sintéticos.
- Comparar `/cuenta-eliminada` por acceso directo y tras eliminación aislada.

### Fase 2. Contratos de componentes

Validar los componentes antes de recorridos largos:

| Contrato | Casos |
|---|---|
| Acción | Cada botón/enlace ejecuta exactamente la acción/destino nombrado; `accion`, `lista`, `mostrar`, Buscar Pendientes y Más. |
| Confirmación | Normal, editable, riesgo, consentimiento, masiva y segunda confirmación de duplicado. |
| Estado | Carga, vacío, éxito, advertencia, error, resultado incierto, offline y reintento. |
| Overlay | Dialog, AlertDialog, Sheet, procedencia, asistente y detalle interceptado; foco, Escape, fondo y retorno. |
| Formularios | Etiqueta, hint, requerido, error, preservación, fecha progresiva, pegar/borrar, teclado virtual. |
| Navegación | Sidebar, cabecera, barra inferior, Más, back/forward, deep link, refresh y callback ausente. |
| Listas/tablas | Encabezados, scroll, selección, actualización, foco y lector de pantalla. |
| Feedback | `status`/`alert` sin duplicación, prioridad correcta y mensajes específicos. |

### Fase 3. Recorridos autenticados completos

| Prioridad | Recorrido | Escenario mínimo de prueba | Evidencia de cierre |
|---:|---|---|---|
| 0 | J12 Eliminación | Exportar → revisar impacto → cancelar → repetir → eliminar cuenta sintética → intentar acceso directo/refresh/back | Usuario de prueba inexistente, sesión cerrada y cierre causal, nunca por URL sola. |
| 0 | J03 Asistente | Pregunta → aclaración → evidencia → propuesta → corrección → duplicado → segunda confirmación → resultado | Turno e intención conservados, resultado en entidad correcta y mismo estado en Pendientes. |
| 0 | J05 Pendientes | Confirmar, descartar, editar, lote parcial, duplicado y fallas | Estados inequívocos; movimientos/saldos solo cambian cuando corresponde. |
| 0 | J01 Recuperación | Token válido, expirado, usado, inválido y ausente; cambio y cierre de otras sesiones | Estado inicial correcto y salida segura; sesión real comprobada. |
| 0 | J02 Onboarding | Cada puerta con 2xx, 4xx, 5xx, timeout y reentrada | Elección persistida o recuperación visible; primera utilidad identificable. |
| 1 | J04 Movimientos | Crear, conflicto duplicado, editar, clasificar, eliminar/restaurar, deep link/interceptado | Historial y saldos coherentes; foco vuelve; no hay duplicado. |
| 1 | J06 Dinero | Crear cuenta/caja, mover/asignar, archivar/restaurar, revisar procedencia | Cifra explicable y cambios cruzados consistentes. |
| 1 | J07 Deudas | Crear, pagar, reprogramar, cerrar/reabrir y fallo parcial | Deuda, cuotas, movimiento y dinero libre coherentes. |
| 1 | J08 Recurrentes | Aceptar evidencia, editar, pagar/omitir, archivar y siguiente ocurrencia | Regla y movimiento distinguidos; recordatorio actualizado. |
| 1 | J09 Planificación | Crear/copy, sobrepasar, pausar/reanudar/archivar, meta-caja | Estado y feedback coherentes; error recuperable. |
| 1 | J10 Interpretación | Buscar pregunta → asistente; descubrimiento → evidencia; reporte; simulación | Query conservada y hechos/inferencias/rangos comprendidos. |
| 1 | J11 Regreso | Retorno a 2/7/15 días, resueltos, posponer/descartar, pausa/canal | Valor presente antes de puesta al día; filtro cerrado verificable. |
| 1 | J13 Fallas | Offline antes/durante/después de submit, 401, 409, 422, 429, 500, timeout | Borrador conservado, resultado real comprobable y reintento seguro. |
| 1 | J14 Continuidad | Panel ↔ full-screen ↔ entidad ↔ back; búsqueda ↔ asistente; memoria ↔ shell | Pregunta, entidad, filtro, hilo, foco y consecuencia conservados. |

### Fase 4. Pruebas con usuarios

La investigación debe seguir el segmento conductual del brief: personas que intentaron una forma estructurada de gestionar ingresos/gastos y dejaron de mantenerla por un mecanismo específico. Los datos demográficos se registran para análisis, no como criterio implícito de persona.

**Muestra inicial sugerida:** 8–12 sesiones moderadas para detectar patrones de recorrido, con diversidad de mecanismos de abandono, familiaridad digital, dispositivos y regularidad de ingresos. La cantidad final depende de saturación y de las decisiones que deban tomarse; no es un objetivo de éxito aprobado.

**Tareas basadas en episodios, no instrucciones de UI:**

1. “Acaba de ocurrir algo con tu dinero que quieres entender o registrar. Empieza como lo harías normalmente.”
2. “Parte de tu historia está incompleta y no quieres reconstruirla toda. Busca una claridad útil para hoy.”
3. “Manzana interpretó algo de forma incorrecta. Corrígelo y comprueba qué cambió.”
4. “Aparece un movimiento parecido. Decide si es duplicado y explica la consecuencia.”
5. “Vuelves después de un tiempo. Encuentra algo útil sin ponerte al día con todo.”
6. “Revisa qué sabe Manzana sobre ti, corrige algo y decide si quieres olvidarlo.”
7. “Decides llevarte tus datos y abandonar el producto.” Solo con cuenta sintética desechable.

**Preguntas de comprensión después de cada momento de verdad:**

- ¿Qué cree Manzana que ocurrió?
- ¿Qué evidencia usó y qué no contó?
- ¿Qué información es segura, estimada, ausente o pendiente?
- ¿Qué cambiaría si confirma? ¿Qué no cambiaría?
- ¿Cómo corregiría, aplazaría o desharía esto?
- ¿Qué espera que ocurra a continuación?
- ¿Qué parte exigió más esfuerzo del valor que recibió?

**Preguntas emocionales no inductivas:**

- ¿Cómo describiría este momento con sus propias palabras?
- ¿Hubo algún punto en que quiso detenerse? ¿Qué ocurrió?
- ¿Qué aumentó o redujo su disposición a continuar?
- ¿En qué momento sintió que tenía o no tenía control? Si no usa términos emocionales, no imponerlos.
- ¿Qué le haría confiar más o menos en esta conclusión?

No preguntar “¿Esto le dio calma?” como única medida: induce el resultado deseado. Contrastar relato, comprensión y decisiones sin convertir la conducta en inferencia emocional automática.

## Matriz de navegadores y dispositivos

### Viewports mínimos

| Clase | Viewport | Objetivo |
|---|---:|---|
| Móvil compacto | 320×568 | Copy largo, controles, dialogs y navegación sin ancho sobrante. |
| Móvil común | 360×800 | Android pequeño/medio. |
| Móvil observado | 390×844 | Comparabilidad con evidencia existente. |
| Móvil grande | 412×915 | Paneles y teclado virtual. |
| Tablet vertical | 768×1024 | Breakpoints, tabla y navegación. |
| Tablet/híbrido horizontal | 1024×768 | Cambio de AppShell y capas. |
| Laptop | 1280×800 | Altura limitada y diálogos largos. |
| Escritorio observado | 1440×900 | Comparabilidad con evidencia existente. |
| Escritorio amplio | 1920×1080 | Longitud de línea, panel lateral y densidad. |

### Motores y equipos

- Chromium/Chrome estable en Windows y Android.
- Firefox estable en Windows o Linux.
- WebKit/Safari estable en macOS y Safari real en iOS.
- Navegador con teclado físico y con teclado virtual real.
- Al menos un dispositivo Android real y un iPhone real; emulación no sustituye barras del navegador, teclado, zoom y lector de pantalla.
- Modo claro/oscuro si ambos están soportados por el producto.
- `prefers-reduced-motion: reduce`.
- Zoom de navegador 200 % y 400 % donde aplique WCAG; tamaño de texto aumentado en móvil.
- Orientación vertical/horizontal en móvil y tablet.

## Protocolo de teclado

Para cada ruta y estado crítico:

1. Cargar la URL sin ratón y comprobar que el primer foco útil es predecible.
2. Recorrer con Tab y Shift+Tab; registrar controles omitidos, orden visual/DOM y trampas.
3. Activar enlaces/botones con Enter y botones nativos también con Space.
4. Operar tabs, radios, menús, lista de opciones, calendario y combobox con teclas esperadas.
5. Abrir cada Dialog/AlertDialog/Sheet/panel; comprobar foco inicial, límites, Escape y retorno.
6. Probar Más, panel del asistente y overlay de movimiento desde el control disparador.
7. Enviar formularios con Enter cuando corresponda y comprobar que no hay doble envío.
8. Provocar error y éxito; confirmar que el foco/anuncio llega sin saltos destructivos.
9. Usar back/forward y recarga; comprobar preservación de query, hilo, filtro, borrador y selección.
10. Confirmar que todos los icon-buttons tienen nombre específico en el árbol accesible.

## Protocolo de lectores de pantalla

| Combinación | Cobertura prioritaria |
|---|---|
| NVDA + Firefox, Windows | Landmarks, formularios, tablas, dialogs, live regions y navegación autenticada. |
| NVDA + Chrome, Windows | Compatibilidad de componentes compuestos y feedback. |
| VoiceOver + Safari, macOS | Rotor de encabezados/landmarks, capas, tablas y navegación. |
| VoiceOver + Safari, iOS | Barra inferior, Más, teclado virtual, panel del asistente y formularios públicos. |
| TalkBack + Chrome, Android | Orden táctil, nombres, estados, overlays y scroll. |

En cada combinación:

- Enumerar landmarks y confirmar un solo `main`.
- Enumerar encabezados y verificar jerarquía/nombre de página.
- Enumerar enlaces, botones y campos; detectar nombres duplicados o genéricos.
- Leer estados de carga, error, advertencia y éxito una sola vez y con prioridad correcta.
- Comprobar `aria-busy`, selección, expansión, tab activo y `aria-current`.
- Operar tabla de preferencias y listas con actualizaciones dinámicas.
- Abrir/cerrar overlay interceptado, dialogs, procedencia y asistente.
- Confirmar que valores en modo discreto no se filtran en nombre accesible, descripción o anuncio.

## Fallas, offline e interrupciones

### Casos de red por cada acción `Critical`/`High`

| Falla | Momento | Resultado esperado a verificar |
|---|---|---|
| Offline | Antes de abrir | Estado global/local comprensible; acción no parece disponible si no puede completarse. |
| Offline | Después de editar, antes de enviar | Borrador conservado; opción de esperar/cancelar. |
| Desconexión | Durante envío | Estado incierto explícito; no afirmar éxito; reintento idempotente. |
| Timeout | Servidor puede haber procesado | Verificación del resultado antes de repetir. |
| 401/403 | Sesión expirada/permisos | Retorno autenticado seguro con intención preservada, sin bucle. |
| 404 | Entidad eliminada/ajena | Mensaje neutral y salida a lista. |
| 409 | Duplicado/conflicto | Evidencia del conflicto y segunda decisión explícita. |
| 422 | Datos incompletos | Campos concretos, valores preservados y foco al error. |
| 429 | Límite | Tiempo/acción de espera comprensible, sin bloqueo ambiguo. |
| 500 | Error interno | Datos conservados, no falso éxito, trace correlacionable y reintento seguro. |
| Respuesta malformada | JSON/shape inesperado | Error recuperable, sin excepción no capturada. |

### Interrupciones

- Cerrar/reabrir pestaña durante onboarding, formulario, propuesta, edición y export job.
- Cambiar ruta con diálogo abierto y usar back.
- Recargar `/movimientos/[id]` abierto como interceptado para comparar página completa.
- Cambiar panel global a `/asistente` y volver.
- Suspender/reanudar móvil con sesión próxima a expirar.
- Abrir dos pestañas y mutar la misma entidad.
- Cambiar modo discreto durante panel, diálogo y lector de pantalla.
- Dejar pasar expiración de token, export link, olvido reversible y recordatorio pospuesto.

## Casos específicos para hallazgos severos

| ID | Prueba de aceptación mínima |
|---|---|
| `UX-C-001` | Acceso directo, back, refresh y URL compartida nunca afirman eliminación; solo una operación aislada confirmada produce cierre verificable. |
| `UX-H-001` | Cada `accion`, fila `lista` y `mostrar` produce la consecuencia/destino específico; no quedan botones sin handler. |
| `UX-H-002` | Conflicto 409 muestra coincidencia, preserva cambios y permite confirmar duplicado una vez sin duplicación accidental. |
| `UX-H-003` | Error, advertencia y éxito son semántica y visualmente distintos; lector de pantalla anuncia el estado real. |
| `UX-H-004` | Sesión ausente/expirada no muestra formulario activo; sesión válida permite cambio y confirma sesiones cerradas. |
| `UX-H-005` | Todos los destinos funcionan desde Memoria en móvil/escritorio y el foco vuelve al disparador de Más. |
| `UX-H-006` | 4xx/5xx/offline no navegan como éxito; puerta e intención permanecen para reintentar. |
| `UX-H-007` | Todas las entradas a eliminación convergen en igual impacto, confirmación, cancelación, error y cierre. |
| `UX-H-008` | Overlay tiene nombre/rol correctos, fondo gestionado, Escape y retorno de foco; carga directa conserva acceso. |
| `UX-H-009` | La pregunta llega completa, revisable y una sola vez al asistente; refresh/back no duplican turnos. |

## Evidencia a conservar por ejecución

- ID de caso, commit/deployment aislado y fecha.
- Navegador, sistema, dispositivo, viewport, zoom, contraste/movimiento y lector de pantalla.
- Fixture sintético y estado inicial, sin secretos.
- Pasos, resultado esperado y resultado real.
- Capturas o video solo con datos sintéticos.
- Snapshot accesible y secuencia de foco para capas/errores.
- Requests relevantes con método/status/trace ID, redactando cuerpos sensibles.
- Estado de base antes/después para acciones con consecuencias.
- Defecto vinculado a ID estable del audit.
- Límite: qué no quedó demostrado por ese caso.

## Conversión de las especificaciones `test.fixme`

Las 12 especificaciones existentes son un mapa de intención, no una suite válida. Solo deben habilitarse después de explorar el flujo real en el entorno aislado y confirmar selectores semánticos. Orden sugerido:

1. Primero, los cuatro irreversibles: cierre de deuda, eliminación/restauración de movimiento, exportación/eliminación de cuenta y olvido de memoria.
2. Después, registro rápido, crear cuenta y dinero libre.
3. Luego, deuda, recurrente, buzón, presupuesto y primer descubrimiento.
4. Añadir casos que hoy faltan: asistente completo, duplicado en asistente, Pendientes parcial/error, recuperación de clave, retorno tras lapso, offline y continuidad entre superficies.

Cada prueba debe usar rol/label real, fixture sintético aislado, resultado en base y UI, y limpieza segura. Una prueba habilitada tampoco demuestra comprensión o resultado emocional.

## Plan de análisis con usuarios

| Dimensión | Evidencia aceptable | Evidencia insuficiente por sí sola |
|---|---|---|
| Funcional | Tarea completada y consecuencia comprobada; salida intencional también puede ser éxito. | Clic, pageview o tiempo de sesión. |
| Cognitiva | Explicación en palabras propias de estado, evidencia, incertidumbre, consecuencia y corrección. | Que no haya pedido ayuda. |
| Emocional | Relato directo, lenguaje espontáneo y reflexión posterior contextualizada. | Facial coding aislado, abandono, velocidad, frecuencia o evento de telemetría. |
| Esfuerzo/valor | Comparación expresada por la persona y observación de pasos/repetición. | Cantidad bruta de interacciones sin contexto. |
| Confianza calibrada | Predicción correcta del resultado y justificación acorde a evidencia/límites. | Declaración genérica de “confío” o uso repetido. |

Registrar contradicciones entre lo que una persona dice, comprende y hace como material de investigación, no como engaño ni incompetencia. Revisar el arco emocional si la evidencia contradice las hipótesis del brief.

## Criterio para recomendar aprobación

La experiencia solo puede volver a revisión de aprobación cuando:

- `UX-C-001` está cerrado con evidencia de acceso directo y operación real aislada.
- Los nueve `UX-H-*` tienen prueba funcional y accesible en los recorridos afectados.
- No hay acciones primarias visibles sin consecuencia ni errores representados como éxito.
- Los recorridos J01–J14 tienen al menos un camino principal y fallas de alto riesgo verificados en runtime aislado.
- Teclado y lectores de pantalla pueden completar las acciones primarias y volver de cada capa.
- Móvil 320–412 px, tablet y escritorio no presentan bloqueos ni solapamientos críticos.
- Offline, timeout, 401, 409 y 500 preservan contexto y evitan duplicados/falsos cierres.
- Participantes pueden explicar evidencia, incertidumbre, consecuencia y corrección en los recorridos prioritarios.
- Cualquier afirmación emocional está respaldada por investigación directa o permanece etiquetada como hipótesis.
- El propietario aún decide por separado el trabajo inicial; la aprobación UX no puede resolver esa decisión de producto implícitamente.

## Limitaciones que seguirán abiertas

Incluso después de esta validación, una muestra cualitativa no demostrará prevalencia poblacional, causalidad ni retención saludable. Las integraciones sandbox no reproducen toda la variabilidad de proveedores reales. La instrumentación puede demostrar eventos y resultados técnicos, no emociones. Estas limitaciones deben acompañar cualquier decisión posterior.
