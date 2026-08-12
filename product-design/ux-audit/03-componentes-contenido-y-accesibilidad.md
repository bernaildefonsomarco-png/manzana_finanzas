# Componentes, contenido y accesibilidad

## Dictamen del sistema de interfaz

La base compartida es más sólida que varias integraciones de producto. Existen primitivas con contratos adecuados de foco, semántica, estados y riesgo, pero las superficies específicas no siempre las usan. El resultado es una experiencia desigual: un diálogo compartido gestiona `role="dialog"`, `aria-modal`, Escape y trampa de foco, mientras el panel interceptado de movimiento recrea visualmente el patrón sin esos comportamientos; el `Toast` posee live region, pero no tiene consumidores de producción y el feedback se reconstruye de forma incompatible en cada dominio.

La recomendación sistémica no es “crear más componentes”. Es consolidar contratos ya existentes, retirar affordances sin acción y hacer que cada acción consecuencial comparta estados de inicio, confirmación, resultado, error, recuperación y foco.

## Inventario de primitivas únicas

Inventario de `src/ui/primitivas/`, excluyendo archivos de prueba. `cn.ts` y `dialog-parts.tsx` se registran como infraestructura, no como superficies independientes.

| Familia | Primitivas | Contrato observado | Estado de uso/auditoría |
|---|---|---|---|
| Acción y contenido | `button.tsx`, `card.tsx`, `badge.tsx`, `avatar.tsx`, `separator.tsx` | Variantes visuales, tamaños, loading, iconos y contenedores. | Uso amplio; botones directos fuera de la primitiva introducen divergencias. |
| Formularios | `field.tsx`, `textarea.tsx`, `checkbox.tsx`, `radio-group.tsx`, `switch.tsx`, `combobox.tsx` | Etiqueta, ayuda/error, controles nativos o compuestos. | Base adecuada; asociación y error dependen de integración. |
| Fecha y dinero | `date-picker.tsx`, `date-range-picker.tsx`, `money.tsx` | Calendario/entrada textual, rango y formato monetario con modo discreto. | `DatePicker` bloquea escritura progresiva y no acepta `id`, `UX-M-004`. |
| Capas y menús | `dialog.tsx`, `dialog-parts.tsx`, `alert-dialog.tsx`, `sheet.tsx`, `popover.tsx`, `dropdown-menu.tsx`, `tooltip.tsx`, `command.tsx` | Portales, foco, Escape, títulos, popovers, menús y ayuda por foco/hover. | Los contratos compartidos son una fortaleza; overlays específicos los eluden. |
| Navegación/organización | `tabs.tsx`, `pagination.tsx`, `scroll-area.tsx`, `table.tsx` | Tabs semánticos, paginación, scroll y tabla con desborde horizontal. | `Table` no tiene consumidor de producción; tablas directas divergen. |
| Estado y feedback | `states.tsx`, `progress.tsx`, `toast.tsx` | Vacío, error, carga, skeleton, progreso y toast con live region. | `Toast` no tiene consumidor de producción; `states.tsx` carece de live/status propio. |
| Utilidad accesible | `visually-hidden.tsx` | Contenido solo para tecnología asistiva. | Disponible; también se usa `sr-only` directamente. |
| Infraestructura | `cn.ts` | Composición de clases. | No visual. |

### Contratos positivos de las primitivas

- `Button` centraliza variantes, tamaño de icono y estado loading; las etiquetas visibles se preservan para nombre accesible.
- `Dialog` exige título y declara `role="dialog"`, `aria-modal`, descripción, Escape y trampa de foco (`src/ui/primitivas/dialog.tsx:23-39,48-114`).
- `Tooltip` aparece tanto por hover como por foco y enlaza `aria-describedby` (`src/ui/primitivas/tooltip.tsx:21-60`).
- `Table` incorpora su propio contenedor de scroll horizontal y `scope="col"` por defecto (`src/ui/primitivas/table.tsx:4-38`).
- `Toast` usa `aria-live="polite"`, `role="status"`, pausa por foco y una acción opcional (`src/ui/primitivas/toast.tsx:11-14,50-93`).
- `states.tsx` ofrece estados consistentes y skeletons con forma del contenido, aunque no anuncia cambios por sí mismo (`src/ui/primitivas/states.tsx:6-134`).

## Inventario de componentes de dominio únicos

| Grupo | Componentes | Propósito | Evaluación |
|---|---|---|---|
| Evidencia y procedencia | `evidence-link.tsx`, `provenance-row.tsx`, `provenance-panel.tsx`, `money-with-provenance.tsx` | Conectar cifras/afirmaciones con fuentes, incluidos contados y no contados. | Fundamento fuerte; el panel gestiona foco, Escape y retorno (`provenance-panel.tsx:42-79`). |
| Confirmación | `confirmation-card.tsx`, `confirmation-card-actions.tsx`, `confirmation-card-field-row.tsx`, `massive-preview-card.tsx` | Previsualizar, editar, confirmar, cancelar y explicar consentimiento/riesgo. | Contrato apropiado; el asistente no completa el caso de duplicado. |
| Representación financiera | `budget-meter.tsx` | Progreso de presupuesto. | Requiere validar comprensión sin depender solo del color. |
| Render conversacional | `block-renderer.tsx` | Despachar bloques del canal a vistas. | La interfaz de handlers permite acciones, pero la integración del asistente entrega no-op o destinos genéricos. |
| Bloques conversacionales | `blocks/enfasis.tsx`, `hallazgo-block-view.tsx`, `limite-block-view.tsx`, `pregunta-block-view.tsx`, `propuesta-block-view.tsx`, `proposal-skeleton.tsx` | Explicar, limitar, preguntar, proponer y cargar. | Estructura semántica útil; runtime autenticado pendiente. |
| Bloques con affordance | `blocks/accion-block-view.tsx`, `lista-block-view.tsx`, `mostrar-block-view.tsx` | Disparar atajo, seleccionar fila y navegar a entidad. | Defectos de integración `UX-H-001`: no-op, handler ausente y destino incorrecto. |

## Sistemas de superficie compartida

| Sistema | Ruta de fuente | Alcance | Evaluación |
|---|---|---|---|
| AppShell | `src/features/app-shell/app-shell.tsx` | Lateral, cabecera, búsqueda, recordatorios, modo discreto, barra móvil y Más. | 14 destinaciones reconocidas; callbacks opcionales generan controles inertes en Memoria (`UX-H-005`). |
| Panel global del asistente | `src/app/(app)/asistente/assistant-panel.tsx` | Todas las rutas autenticadas salvo `/asistente*`. | Declara `section`, Escape y retorno al trigger; la ruta full-screen carece de salida móvil (`UX-M-003`). |
| Sitio público | `src/features/public-site/public-site.tsx` | Header, footer, hero, tarjetas, contacto y listas de confianza. | Header/footer están dentro de `main`; nav desaparece en móvil; contacto es texto plano. |
| Estados compartidos | `src/ui/primitivas/states.tsx` | Carga, error, vacío y skeleton. | Consistencia visual; anuncios dinámicos incompletos (`UX-M-008`). |
| Placeholder | `src/shared/placeholder-section.tsx` | Cinco URL declaradas sin contenido funcional. | Honesto en copy, pero constituye deuda de IA visible (`UX-M-011`). |
| Procedencia | `src/ui/domain/money-with-provenance.tsx`, `provenance-panel.tsx` | Cifras financieras en superficies compatibles. | Conserva evidencia, exclusiones y foco; validar comprensión. |
| Confirmación de riesgo | `src/ui/domain/confirmation-card.tsx`, primitivas `Dialog`/`AlertDialog` | Propuestas y acciones sensibles. | Buena base; las excepciones específicas deben migrar al contrato. |

## Auditoría exhaustiva por tipo de elemento

### Botones y acciones

**Patrón compartido.** `Button` admite `type`, `variant`, `size`, `loading`, `disabled`, icono y nombre visible. Muchas superficies lo usan correctamente para acciones primarias, secundarias, ghost y danger.

**Excepciones que cambian el resultado del usuario:**

| Excepción | Superficie | Evidencia | Impacto | Hallazgo |
|---|---|---|---|---|
| Botón de bloque `accion` ejecuta un no-op | Mensaje del asistente | `src/app/(app)/asistente/assistant-message.tsx:40-60`; `src/ui/domain/blocks/accion-block-view.tsx:8-19` | La acción anunciada no ocurre. | `UX-H-001` |
| Filas de `lista` son botones, pero el asistente no suministra `onSelectListItem` | Mensaje del asistente | `src/ui/domain/blocks/lista-block-view.tsx:6-27`; handlers de `assistant-message.tsx:40-60` | Controles accesibles por rol aparentan funcionalidad sin consecuencia. | `UX-H-001` |
| `mostrar` ignora el tipo de entidad | Asistente | `src/ui/domain/blocks/mostrar-block-view.tsx:25-43`; `assistant-message.tsx:49-58` | Deuda, presupuesto, pago, descubrimiento o reporte termina en Movimientos. | `UX-H-001` |
| Confirmación de propuesta no puede repetir con `confirmDuplicate` | Tarjeta de asistente | `src/app/(app)/asistente/assistant-proposal-card.tsx:68-93`; `use-assistant-proposal-actions.ts:23-31` | La persona no puede completar una operación válida ante conflicto. | `UX-H-002` |
| Buscar pendientes no tiene handler | Pendientes | `src/features/pending/pending-screen.tsx:311-319` | Acción de cabecera inerte. | `UX-M-002` |
| Buscar/Recordatorios/Más dependen de callback ausente | Memoria/AppShell | `src/features/memory/memory-screen.tsx:52-96,189-199`; `src/features/app-shell/app-shell.tsx:251-261,317-365,503-522` | Navegación móvil parcial o totalmente inerte. | `UX-H-005` |
| Posponer/descartar no muestran error | Recordatorios | `src/features/reminders/reminders-screen.tsx:100-119,131-145` | Un rechazo puede parecer ausencia de respuesta. | `UX-M-005` |
| Preferencias, pausa y reanudación no muestran error de mutación | Preferencias de recordatorios | `src/features/reminders/reminder-preferences-screen.tsx:65-73,121-135` | No se confirma si el permiso cambió. | `UX-M-005` |
| Solicitud/descarga de exportación no muestra error de acción | Datos | `src/features/reports/export-data-screen.tsx:53-66,79-110` | La persona no sabe si se generó o inició la descarga. | `UX-M-005` |
| Acciones de archivo/pausa de presupuesto/meta no tienen `onError` visible | Presupuestos | `src/features/budgets/budgets-screen.tsx:87-136,188-218` | Estado incierto y recuperación ausente. | `UX-M-005` |
| Memoria encadena promesas sin `catch` en varias acciones | Memoria | `src/features/memory/memory-screen.tsx:88-94,114-163,202-230` | Error no visible y posible promesa rechazada. | `UX-M-005`, `UX-M-006` |

**Acciones directas aceptables.** Botones nativos se usan cuando la semántica es simple, por ejemplo tabs de auth, controles de navegación y filas. El problema no es usar `<button>` directamente, sino hacerlo sin acción, estado, nombre contextual o recuperación.

### Enlaces

| Aspecto | Resultado |
|---|---|
| Navegación real | La mayoría usa `Link`/`href`, lo que preserva apertura y navegación estándar. Los cuatro destinos móviles principales tienen fallback de enlace cuando `onNavigate` falta (`src/features/app-shell/app-shell.tsx:440-475`). |
| Enlaces dependientes de contexto | Búsqueda construye `/asistente?q=...`, pero el receptor no consume `q` (`UX-H-009`). |
| Nombres genéricos | Recordatorios usa “Ir” para cualquier `action_url` (`src/features/reminders/reminders-screen.tsx:131-139`), y varias superficies repiten “Ir a Manzana”; deuda de contenido `UX-L-001`. |
| Contacto público | Correo, soporte, privacidad y teléfono se presentan como texto, no `mailto:`/`tel:` (`src/features/public-site/public-site.tsx:186-211`). |
| Exportación desde Memoria | Enlaza directamente a `/api/v1/privacy/export` (`src/features/memory/memory-screen.tsx:88-93`), mientras `/configuracion/datos` usa jobs; los modelos divergen. |
| Cierre de overlay | El overlay interceptado combina botón de fondo y `Link` de cierre, pero no retorno de foco ni Escape (`UX-H-008`). |

### Formularios y campos

**Fundamentos:**

- `FieldShell` permite etiqueta, `htmlFor`, hint, error y requerido; Auth asocia correctamente campos básicos.
- Errores de Auth usan `role="alert"`, `aria-live="assertive"` y foco programático en el contenedor (`src/features/auth/auth-screen.tsx:192-217`).
- Varios formularios de dominio conservan valores ante error y muestran mensajes dentro del diálogo.
- Los montos usan `inputMode` y prefijos; la moneda se representa mediante componentes compartidos.

**Deuda y excepciones:**

| Problema | Evidencia | Impacto | ID |
|---|---|---|---|
| `DatePicker` solo llama `onValueChange` cuando la cadena completa ya parsea | `src/ui/primitivas/date-picker.tsx:18-24,56-69` | No permite escribir progresivamente ni borrar; tampoco acepta `id` para `FieldShell`. | `UX-M-004` |
| Reglas de contraseña no visibles antes de enviar | `src/features/auth/auth-screen.tsx:168-180`; `src/features/auth/reset-password-screen.tsx:89-112` | `minLength=8` existe, pero la persona debe inferir la regla. | `UX-L-002` |
| Reset muestra formulario sin guard inicial de sesión | `src/features/auth/reset-password-screen.tsx:15-24,41-43,81-123` | Una superficie activa puede ser inválida desde el inicio. | `UX-H-004` |
| Corrección de memoria usa `window.prompt` | `src/features/memory/memory-screen.tsx:145-163,228-232` | Sin contexto, hint, error inline, foco controlado ni consistencia con formularios. | `UX-M-006` |
| Olvido individual usa `window.confirm` | `src/features/memory/memory-screen.tsx:152-156` | Contrato visual/semántico depende del navegador y diverge de riesgo compartido. | `UX-M-006` |
| Onboarding no valida `response.ok` | `src/features/onboarding/welcome-screen.tsx:23-36` | El formulario implícito progresa aunque la persistencia sea rechazada. | `UX-H-006` |

### Listas, tablas y tarjetas

| Tipo | Inventario y patrón | Evaluación |
|---|---|---|
| Listas de entidades | Movimientos, pendientes, cuentas, deudas, pagos, presupuestos, metas, descubrimientos, hilos, memoria y recordatorios. | Estructuras `ul`/`ol`/`article` frecuentes. Debe verificarse anuncio de actualización y preservación de foco tras mutación. |
| Listas conversacionales | `ListaBlockView` genera botones por fila. | Semántica de acción sin integración real en el asistente, `UX-H-001`. |
| Tablas | Primitiva `Table`; tabla directa de preferencias; otras presentaciones tabulares directas. | `Table` no tiene consumidores de producción según búsqueda estática; preferencias usa `<table>` sin el wrapper de overflow (`src/features/reminders/reminder-preferences-screen.tsx:86-119`). |
| Tarjetas | `Card`, `ConfirmationCard`, `MassivePreviewCard`, tarjetas de procedencia, sugerencia, resumen y detalle. | Buena agrupación visual; varias tarjetas actúan como superficies de estado sin live-region. |
| Proyección y recordatorios | Calendarios/listas con contenido variable. | Overflow y densidad en 320–768 px requieren runtime (`UX-L-003`). |

No se detectó evidencia suficiente para afirmar que toda tabla o lista mantiene encabezados, orden de lectura y scroll con zoom 200–400 %. Es una obligación del plan de validación.

### Navegación

**Escritorio.** AppShell expone 12 destinos en lateral, Configuración separada, búsqueda en cabecera y Recordatorios también como icono. `aria-current="page"` se aplica a destino activo.

**Móvil.** La barra inferior expone Home, Movimientos, Pendientes, Mi Dinero y Más. Más contiene Deudas, Pagos que vienen, Descubrimientos, Presupuestos, Reportes, Proyecciones, Asistente, Recordatorios y Configuración. Buscar queda en cabecera. El menú mueve foco al primer botón y responde a Escape, pero no restaura explícitamente el foco al disparador.

**Excepciones:**

- Memoria no pasa `onNavigate`; búsqueda, recordatorios y todos los botones de Más quedan sin efecto (`UX-H-005`).
- Configuración tiene fallback `href="#configuracion"`, no `/configuracion` (`src/features/app-shell/app-shell.tsx:183-192,345-360`).
- `/asistente` oculta la barra móvil y no pasa `onClose` a `AssistantPanelContent` (`src/app/(app)/asistente/page.tsx:14-24`), `UX-M-003`.
- El sitio público oculta por completo el nav de cabecera bajo `sm` (`src/features/public-site/public-site.tsx:17-47`), `UX-M-009`.
- Nombres de navegación mezclan Home, Inicio y Dashboard (`UX-L-001`).

### Diálogos, paneles y capas

| Superficie | Semántica/foco implementados | Resultado |
|---|---|---|
| `Dialog` compartido | `role="dialog"`, `aria-modal`, título/descripción, focus trap, Escape, portal. | Fundamento fuerte. |
| `AlertDialog` compartido | Decisión explícita no dismissible y contrato de riesgo. | Fundamento fuerte; validar retorno de foco. |
| `Sheet` compartido | Contrato de panel modal con foco. | Fundamento fuerte. |
| Panel de procedencia | `section`, `tabIndex=-1`, foco inicial, Escape y retorno al trigger. | Adecuado para panel no modal junto a cifra. |
| Panel global del asistente | `section`, título, Escape y retorno al trigger; deliberadamente no modal. | Adecuado como superficie paralela; validar solapamiento y orden móvil. |
| Detalle interceptado de movimiento | Solo `div` fijo, backdrop-button y enlace de cierre. | No hay región/dialog, título asociado, foco, Escape ni retorno, `UX-H-008`. |
| Diálogo manual de Pendientes | Implementación específica extensa. | Debe compararse en runtime con primitivas compartidas; riesgo de divergencia. |
| `prompt`/`confirm` de Memoria | Semántica nativa del navegador. | Inconsistente con copy, evidencia, error y foco del producto, `UX-M-006`. |

### Contenido y descripciones

**Fortalezas:**

- Lenguaje mayormente calmado y no punitivo: “Tus saldos no cambian”, “sin culpa”, “solo si te sirve”.
- Se explicitan exclusiones, evidencia y límites en procedencia, recurrentes y proyecciones.
- Varias acciones sensibles anticipan reversibilidad, impacto o ausencia de movimiento de dinero.
- Pendientes comunica que los elementos están separados hasta confirmación.

**Deuda:**

| Tema | Ejemplos | Riesgo |
|---|---|---|
| Terminología | `Home`, `Inicio`, “Dashboard”; `Mi Dinero`; “Lo que te espera”; “Configuracion” sin tilde en código/copy. | El cambio de vocabulario aumenta traducción cognitiva. |
| Acciones genéricas | “Ir”, “Ver”, “Actualizar”. | El nombre no siempre anticipa destino o consecuencia. |
| Ortografía y tildes | “Terminos”, “Pais”, “Telefono”, “rapida”, “accion”, entre otros. | Deuda de profesionalidad y consistencia, no bloqueo demostrado. |
| Nombre accesible duplicado | En alta, tab y submit pueden llamarse “Crear cuenta” (`src/features/auth/auth-screen.tsx:123-141,219-221`). | Navegación por lista de botones puede resultar ambigua. |
| Reglas ocultas | Contraseña requiere mínimo 8, pero no se describe. | Error evitable y recuperación tardía. |
| Éxito absoluto | “Tu cuenta se eliminó” y “Borramos tus datos” en URL directa. | Afirmación material falsa sin causalidad, `UX-C-001`. |

### Iconos, badges y tooltips

- Los iconos decorativos suelen acompañar texto o etiqueta accesible; varios declaran `aria-hidden`, pero no todos lo hacen de manera uniforme.
- `Button size="icon"` mantiene contenido textual para nombre accesible en AppShell.
- Badges usan texto además de color en la mayoría de estados; el punto de Pendientes combina número y etiqueta visible.
- `Tooltip` tiene contrato de foco, pero la búsqueda estática solo encontró su archivo y pruebas, no consumidores de producción. No debe suponerse que iconos ambiguos reciben ayuda.
- `Toast` también carece de consumidores de producción; los mensajes se implementan localmente con contratos divergentes.
- El badge de recordatorios oculta su fallo de carga por diseño (`src/features/app-shell/app-shell.tsx:478-522`); es razonable para un indicador auxiliar, pero el botón sigue dependiendo de `onNavigate`.

### Componentes de estado

| Estado | Base existente | Brecha |
|---|---|---|
| Carga | `LoadingBlock`, skeletons, `aria-busy` en algunos componentes. | `LoadingBlock` no declara `role="status"` ni `aria-live`; no todas las cargas anuncian inicio/fin. |
| Error | `ErrorState` con reintento, errores inline y `role="alert"` en varios formularios. | `ErrorState` compartido no tiene `role="alert"`; algunos errores son solo color/texto. |
| Vacío | `EmptyState` con título, descripción y acción. | Adecuado como contenido estático; validar foco al sustituir carga/error. |
| Éxito | Mensajes `role="status"` en algunos dominios. | Pendientes aplica éxito también a error (`UX-H-003`); otros mensajes no son live. |
| Offline | Error específico en Auth y reintentos de Query. | No hay contrato global de desconexión, cola, reconexión o estado incierto (`UX-M-010`). |
| Interrupción | Query cache y algunas rutas/hilos. | Formularios locales y overlays pueden perder estado al navegar o recargar. |

### Responsividad

**Evidencia pública.** Las 13 rutas seguras renderizaron en 1440×900 y 390×844 sin overflow horizontal observado. Las capturas no prueban interacción, zoom, teclado virtual ni tamaños intermedios.

**Patrones estáticos positivos:**

- Contenedores máximos, grids `sm`/`md`/`lg`, botones con altura de 40–48 px y navegación inferior móvil.
- Diálogos pasan de borde inferior a tarjeta centrada según breakpoint.
- Tabla compartida incorpora scroll horizontal.
- `prefers-reduced-motion` y foco global están definidos en `src/app/globals.css`; deben verificarse en runtime.

**Riesgos pendientes:**

- Navegación pública ausente en móvil (`UX-M-009`).
- Tabla directa de preferencias sin wrapper compartido.
- Calendarios, proyecciones, chips y listados densos deben probarse a 320, 360, 390, 768 y con zoom.
- Panel del asistente, navegación inferior y teclado virtual pueden solaparse.
- La ruta full-screen del asistente elimina la salida móvil (`UX-M-003`).

### Semántica, foco y accesibilidad

| Área | Resultado estático | Estado |
|---|---|---|
| Landmarks | AppShell renderiza `main`; numerosas pantallas hijas renderizan otro `main`. PublicPageShell coloca header/footer dentro de `main`. | Deuda `UX-M-007`. |
| Encabezados | La mayoría de superficies incluye `h1`; cards y secciones usan `h2`/`h3`. | Validar jerarquía completa en rutas complejas. |
| Foco visible | Clases globales y componentes compuestos incluyen focus ring. | Fundamento; verificar contraste y clipping. |
| Foco en capas | Dialog/Sheet/procedencia implementan gestión; panel interceptado no. | `UX-H-008`. |
| Escape | Dialog, procedencia, panel global y Más lo implementan; overlay interceptado no. | Inconsistente. |
| Retorno de foco | Procedencia y panel global lo declaran; Más y overlay requieren validación/corrección. | Riesgo material. |
| Live regions | Auth, algunos formularios y Toast tienen roles; estados compartidos y feedback local no son uniformes. | `UX-M-008`. |
| Nombres accesibles | Muchos icon-buttons tienen texto/aria-label. | “Crear cuenta” duplicado y “Ir” genérico son deuda. |
| Asociaciones de campo | `FieldShell` + id funciona generalmente. | `DatePicker` no acepta id; asociación incompleta. |
| Tablas | `scope` en primitiva; tabla directa usa `th` sin `scope` explícito, aunque el navegador puede inferir columna. | Consolidar y validar lector de pantalla. |
| Reducción de movimiento | CSS contiene tratamiento global; skeleton/spinners usan animación. | Verificar preferencia real, no solo presencia de regla. |
| Contraste | Hay tokens específicos `*-on-subtle` y comentarios de medición. | No sustituye una auditoría de contraste renderizado en todos los estados. |

## Matriz de acciones consecuenciales

La matriz identifica cada familia y sus excepciones individualmente. `Base sólida` describe código existente, no prueba de runtime.

| Familia | Acciones auditadas | Salvaguarda/base | Excepción o validación pendiente |
|---|---|---|---|
| Autenticación | Entrar, crear cuenta, salir local, verificar, recuperar, cambiar clave | Errores mapeados, rate limit auxiliar, cierre de otras sesiones declarado | Reset sin guard inicial `UX-H-004`; reglas invisibles `UX-L-002`; envíos no probados. |
| Onboarding | Elegir gasto, cuenta, correo o mirar primero | Elección acotada y botones bloqueados durante carga | Respuesta/estado de persistencia ignorado `UX-H-006`. |
| Movimientos | Crear, editar, clasificar, eliminar, restaurar, lote, confirmar duplicado | Idempotencia, protección de duplicado, diálogo y restauración | Overlay inaccesible `UX-H-008`; fecha `UX-M-004`; importación placeholder. |
| Pendientes | Confirmar, segunda confirmación, descartar, ya registrado, editar, lotes | Elementos separados de saldos; duplicado conservado | Error verde `UX-H-003`; búsqueda inerte `UX-M-002`; detalle placeholder. |
| Cuentas | Crear, editar, predeterminar, archivar, restaurar | Estados y restauración de cuenta/cajas | Recorrido no probado; validar saldos y moneda. |
| Cajas | Crear, editar, asignar, retirar, archivar/restaurar, vincular meta | Separación conceptual del saldo | Recorrido no probado; validar modelo mental y fallas parciales. |
| Deudas | Crear, editar, pagar, cerrar, reabrir, reprogramar, omitir cuota | Diálogos específicos y errores locales | Todos los E2E relevantes deshabilitados; validar irreversibilidad y derivados. |
| Pagos próximos | Crear, editar, sugerir, aceptar, descartar, pagar, omitir, archivar | Evidencia antes de activar; no mueve dinero al crear regla | Error/offline y overflow pendientes. |
| Presupuestos | Crear, editar, copiar, sugerir, pausar, reanudar, archivar | Copy distingue plan de dinero apartado | Mutaciones de estado sin error visible `UX-M-005`. |
| Metas | Crear, editar, vincular caja, pausar, reanudar, archivar | Vinculación explícita con caja | Mutaciones de estado sin error visible `UX-M-005`. |
| Descubrimientos | Abrir evidencia, aceptar/descartar acción, navegar a fuente | Evidencia y detalle dedicados | Continuidad y destino deben probarse. |
| Búsqueda | Buscar entidades/filtros, entregar pregunta al asistente | Alternativa a Movimientos | `q` se pierde en el asistente `UX-H-009`. |
| Reportes/proyecciones | Cambiar periodo, revisar procedencia, simular | Rangos, supuestos y exclusiones | Comprensión/overflow pendiente; no tratar escenario como certeza. |
| Memoria | Confirmar/rechazar candidato, corregir, olvidar, reactivar, deshacer, olvidar todo | Evidencia, historial, frase para olvido total | Prompt/confirm, promesas sin catch y navegación inerte `UX-H-005`, `UX-M-005`, `UX-M-006`. |
| Asistente | Enviar, elegir opción, ejecutar acción, abrir lista/evidencia/entidad, editar/confirmar/descartar propuesta, archivar hilo | Propuesta compartida con Pendientes; ConfirmationCard | Tres affordances rotas `UX-H-001`; duplicado sin segunda confirmación `UX-H-002`; salida móvil `UX-M-003`. |
| Recordatorios | Abrir destino, posponer, descartar, marcar leídos | Lenguaje no alarmista; preferencias y pausa | Filtro ignorado `UX-M-001`; mutaciones sin error `UX-M-005`; “Ir” genérico. |
| Configuración | Perfil, WhatsApp, Gmail, bancos/correo, modo discreto, preferencias | Feedback local y copy de impacto en varias acciones | Superficie monolítica y tres placeholders; contratos duplicados. |
| Exportación | Exportar JSON directo, solicitar CSV/completa, descargar job | Describe alcance de datos | Modelos duplicados; solicitud/descarga sin error visible `UX-M-005`. |
| Eliminación de cuenta | Abrir, calcular impacto, escribir frase, cancelar, eliminar, cerrar sesión | Frase exacta; flujo dedicado enumera impacto | Flujos divergentes `UX-H-007`; éxito público falso `UX-C-001`. |
| Categorías | Crear, editar, archivar/restaurar, clasificar | Superficies dedicadas y vínculos a movimientos | Runtime pendiente; validar impacto en histórico. |
| Soporte | Consultar ayuda, enviar contacto autenticado, usar contacto público | Error/éxito en formulario autenticado | Envío no probado; contacto público no accionable `UX-M-009`. |
| Baja pública | Confirmar baja mediante token | Estado de éxito/error implementado | Ruta tokenizada omitida; validar token válido, inválido, expirado y repetido. |

## Consolidación recomendada de contratos

Sin prescribir una UI final, las direcciones de sistema son:

1. Toda affordance visible debe ejecutar la acción nombrada, navegar a la entidad correcta o presentarse como no interactiva.
2. Toda acción consecuencial debe distinguir inicio, confirmación, éxito, error, resultado incierto y recuperación.
3. Toda capa visual debe declarar si es diálogo modal, sheet o panel no modal y cumplir su contrato de foco/Escape/retorno.
4. Toda mutación debe usar una política común de error y reconciliación; el helper optimista existente ofrece una base.
5. Los componentes de estado deben anunciar cambios relevantes sin convertir contenido estático en ruido de lector de pantalla.
6. La terminología debe mapear una entidad/acción a un nombre estable entre conversación, navegación y superficies.
7. Los placeholders deben tratarse como deuda visible, no como cobertura funcional.
8. Las primitivas `Table`, `Tooltip` y `Toast` deben adoptarse donde resuelvan un contrato real o retirarse; su mera existencia no aporta consistencia.
