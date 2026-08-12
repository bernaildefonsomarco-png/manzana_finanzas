# Hallazgos priorizados

## Registro maestro

| Severidad | Cantidad | IDs |
|---|---:|---|
| `Critical` | 1 | `UX-C-001` |
| `High` | 9 | `UX-H-001` a `UX-H-009` |
| `Medium` | 12 | `UX-M-001` a `UX-M-012` |
| `Low` | 4 | `UX-L-001` a `UX-L-004` |

Los hallazgos están deduplicados por causa y contrato de experiencia. Cuando una misma causa afecta varias superficies, se conserva un solo ID y se enumeran todas las excepciones relevantes. La severidad describe el impacto demostrado o razonablemente derivado del comportamiento implementado, no una emoción supuesta.

## Critical

### UX-C-001. Éxito irreversible accesible sin acción precedente

| Campo | Detalle |
|---|---|
| Severidad | `Critical` |
| Tipo de evidencia | Fuente estática + runtime público escritorio/móvil |
| Afirmación neutral | `/cuenta-eliminada` es una ruta pública que, al acceder directamente, renderiza “Tu cuenta se eliminó” y “Borramos tus datos” sin comprobar ni recibir evidencia de una eliminación precedente. |
| Impacto para el usuario | Presenta como hecho un resultado irreversible no demostrado. La persona no puede distinguir una eliminación real de la simple visita a una URL, lo que invalida el cierre y el contrato de confianza. |
| Recorridos afectados | J12 Configuración/privacidad/eliminación; J13 fallas/recuperación; J01 por exposición pública. |
| Rutas/componentes | `/cuenta-eliminada`; proxy de rutas públicas; cierre de eliminación dedicada. |
| Evidencia exacta | `src/app/(publico)/cuenta-eliminada/page.tsx:7-17`; `src/proxy.ts:18-42`; el flujo dedicado navega allí en `src/features/reports/delete-account-section.tsx:39-48`. Capturas: [D](evidence/runtime/public/cuenta-eliminada--desktop--1440x900.png) · [M](evidence/runtime/public/cuenta-eliminada--mobile--390x844.png). |
| Confianza/validación | **Alta, confirmado en runtime público** para acceso directo y copy. No se ejecutó una eliminación real. |
| Dirección de recomendación | Vincular cualquier estado de éxito irreversible a una prueba verificable y efímera de la operación precedente; si esa prueba no existe, mostrar un estado neutral que no afirme borrado. Mantener una única semántica de cierre para todos los flujos de eliminación. |

## High

### UX-H-001. Affordances del asistente sin acción o con destino incorrecto

| Campo | Detalle |
|---|---|
| Severidad | `High` |
| Tipo de evidencia | Fuente estática |
| Afirmación neutral | El asistente entrega `onTriggerAction: () => undefined`, no entrega `onSelectListItem` y define `onFollowShow` para navegar siempre a `/movimientos`. Por ello, un bloque `accion` no actúa, las filas `lista` no actúan y un bloque `mostrar` para deuda, presupuesto, pago, descubrimiento o reporte abre Movimientos. |
| Impacto para el usuario | Una acción primaria visible puede no producir consecuencia o llevar a una superficie distinta de la nombrada, bloqueando la conversación como recorrido y dañando la correspondencia entre propuesta y control. |
| Recorridos afectados | J03 Asistente; J07 Deudas; J08 Pagos próximos; J09 Presupuestos/metas; J10 Descubrimientos/reportes; J14 continuidad. |
| Rutas/componentes | `/asistente`, panel global; `AssistantMessage`; `AccionBlockView`; `ListaBlockView`; `MostrarBlockView`. |
| Evidencia exacta | `src/app/(app)/asistente/assistant-message.tsx:40-60`; `src/ui/domain/blocks/accion-block-view.tsx:8-19`; `src/ui/domain/blocks/lista-block-view.tsx:6-27`; `src/ui/domain/blocks/mostrar-block-view.tsx:25-43`. |
| Confianza/validación | **Alta** sobre el cableado; autenticado no verificado en vivo. Validar todos los tipos de bloque con entidades reales y foco de retorno. |
| Dirección de recomendación | Exigir un contrato exhaustivo entre tipo de bloque, handler y destino; una affordance sin implementación debe renderizarse como información, no como control. Resolver destinos por entidad/ID y verificar la consecuencia en la superficie correspondiente. |

### UX-H-002. Segunda confirmación de duplicado imposible desde el asistente

| Campo | Detalle |
|---|---|
| Severidad | `High` |
| Tipo de evidencia | Fuente estática de cliente y API |
| Afirmación neutral | `confirmAssistantProposal` admite `confirmDuplicate`, y el endpoint responde 409 con `requires_confirmation`; el hook siempre llama sin opción y la tarjeta no ofrece una acción diferenciada para reenviar con confirmación. |
| Impacto para el usuario | Una propuesta válida queda bloqueada cuando el sistema detecta un posible duplicado, aunque la capacidad backend existe y Pendientes sí implementa el segundo paso. |
| Recorridos afectados | J03 Asistente; J04 Movimientos; J05 Pendientes; J14 continuidad. |
| Rutas/componentes | `/asistente`, panel global; propuesta del asistente; endpoint de confirmación. |
| Evidencia exacta | `src/app/(app)/asistente/assistant-api.ts:70-81`; `src/app/api/v1/assistant/proposals/[id]/confirm/route.ts:98-106,124-133`; `src/app/(app)/asistente/use-assistant-proposal-actions.ts:23-31`; `src/app/(app)/asistente/assistant-proposal-card.tsx:68-93`. |
| Confianza/validación | **Alta** sobre la imposibilidad del segundo payload; autenticado no verificado. |
| Dirección de recomendación | Alinear el contrato de duplicados del asistente con Pendientes: mostrar coincidencia y consecuencia, preservar correcciones y permitir una confirmación adicional explícita e idempotente. |

### UX-H-003. Errores de Pendientes representados como éxito

| Campo | Detalle |
|---|---|
| Severidad | `High` |
| Tipo de evidencia | Fuente estática |
| Afirmación neutral | Pendientes almacena éxitos, advertencias de duplicado y errores en la misma variable `feedback`; el bloque de render siempre usa borde/fondo de éxito y un check verde. |
| Impacto para el usuario | Una mutación fallida o una carga rechazada puede interpretarse como completada. La persona podría abandonar la revisión creyendo que un saldo o pendiente cambió. |
| Recorridos afectados | J05 Pendientes; J13 recuperación; J14 continuidad. |
| Rutas/componentes | `/pendientes`; acciones individuales y por lote; feedback. |
| Evidencia exacta | Errores asignados en `src/features/pending/pending-screen.tsx:124-135,172-180,193-199,255-256`; render único de éxito en `src/features/pending/pending-screen.tsx:349-361`. |
| Confianza/validación | **Alta** estática; provocar 4xx/5xx en runtime para comprobar copy, anuncio y persistencia de selección. |
| Dirección de recomendación | Separar estado semántico y contenido por resultado real: éxito, advertencia, error e incertidumbre. El estilo, icono, rol, siguiente paso y reconciliación deben derivarse del tipo, no de una cadena común. |

### UX-H-004. Formulario de restablecimiento antes de validar recuperación

| Campo | Detalle |
|---|---|
| Severidad | `High` |
| Tipo de evidencia | Fuente estática + runtime público escritorio/móvil |
| Afirmación neutral | `/restablecer-clave` asume que el callback ya estableció una sesión de recuperación y renderiza directamente campos activos; no hay comprobación inicial ni estado visible para sesión ausente, inválida o expirada. |
| Impacto para el usuario | La interfaz comunica que el cambio es posible y solo revela la invalidez después de invertir esfuerzo en el formulario. La acción primaria resulta inaccesible para quien llega con un enlace inválido. |
| Recorridos afectados | J01 Auth/recuperación; J13 fallas. |
| Rutas/componentes | `/restablecer-clave`; `ResetPasswordScreen`. |
| Evidencia exacta | `src/features/auth/reset-password-screen.tsx:15-24,41-43,81-123`; exposición pública en `src/proxy.ts:18-32`. Capturas: [D](evidence/runtime/public/restablecer-clave--desktop--1440x900.png) · [M](evidence/runtime/public/restablecer-clave--mobile--390x844.png). |
| Confianza/validación | **Alta** sobre render directo; sesión válida/expirada y envío no probados. |
| Dirección de recomendación | Resolver el estado de recuperación antes de habilitar la acción; distinguir carga, sesión válida, ausencia, expiración, consumo previo y error, con una salida segura a solicitar otro enlace. |

### UX-H-005. Navegación de AppShell dependiente de callback e inerte en Memoria

| Campo | Detalle |
|---|---|
| Severidad | `High` |
| Tipo de evidencia | Fuente estática |
| Afirmación neutral | Buscar, Recordatorios y los elementos de Más solo invocan `onNavigate`; Memoria monta AppShell sin ese callback. Los cuatro destinos inferiores conservan fallback de enlace, pero esos controles y Configuración no. |
| Impacto para el usuario | En móvil, se vuelven inaccesibles nueve destinos de Más y dos acciones de cabecera desde una superficie sensible. Configuración usa además `#configuracion` como fallback de escritorio. |
| Recorridos afectados | J12 Memoria/configuración; J11 Recordatorios; J14 continuidad. |
| Rutas/componentes | `/configuracion/memoria`, `/configuracion/memoria/[id]`; AppShell móvil/escritorio. |
| Evidencia exacta | Callback opcional y fallback de Configuración: `src/features/app-shell/app-shell.tsx:124-147,163-165,183-192`; acciones: `src/features/app-shell/app-shell.tsx:251-261,317-365,503-522`; Memoria sin callback: `src/features/memory/memory-screen.tsx:52-96,189-199`. |
| Confianza/validación | **Alta** estática; probar ambos breakpoints y navegación por teclado. |
| Dirección de recomendación | Hacer que cada destino tenga navegación real independiente del callback o volver obligatorio el contrato; ningún control debe depender silenciosamente de una prop opcional. Preservar foco al cerrar Más. |

### UX-H-006. Onboarding navega sin confirmar persistencia

| Campo | Detalle |
|---|---|
| Severidad | `High` |
| Tipo de evidencia | Fuente estática |
| Afirmación neutral | La elección de onboarding espera un `fetch`, captura únicamente rechazo de red como `undefined`, no inspecciona `response.ok` y navega siempre. `/inicio` puede volver a `/bienvenida` si el estado continúa `not_started`. |
| Impacto para el usuario | La selección parece aceptada, pero puede no persistir; al regresar a Inicio, el recorrido puede repetirse sin explicación y perder continuidad de primera configuración. |
| Recorridos afectados | J02 Onboarding; J13 recuperación; J14 continuidad. |
| Rutas/componentes | `/bienvenida`, sus tres puertas, “mirar primero”, `/inicio`. |
| Evidencia exacta | `src/features/onboarding/welcome-screen.tsx:23-36`; `src/app/(app)/inicio/page.tsx:10-18,33-40`. |
| Confianza/validación | **Alta** estática; validar 2xx, 4xx, 5xx, timeout, offline, doble clic y reentrada. |
| Dirección de recomendación | Condicionar la transición a una respuesta persistida o declarar claramente un estado recuperable; conservar puerta e intención para reintentar sin repetir decisiones. |

### UX-H-007. Eliminación de cuenta con salvaguardas y cierres divergentes

| Campo | Detalle |
|---|---|
| Severidad | `High` |
| Tipo de evidencia | Fuente estática |
| Afirmación neutral | `/configuracion` y `/configuracion/datos` exponen flujos distintos hacia el mismo endpoint. Ambos exigen frase, pero solo el dedicado calcula y enumera impacto; el general muestra éxito y llama `onSignOut`, mientras el dedicado navega a `/cuenta-eliminada`. |
| Impacto para el usuario | Una misma decisión irreversible cambia de contexto, evidencia y cierre según dónde se inicia. Esto dificulta anticipar consecuencias y verificar la salida. |
| Recorridos afectados | J12 Configuración/privacidad/eliminación; J13 fallas. |
| Rutas/componentes | `/configuracion`, `/configuracion/datos`, `SettingsScreen`, `DeleteAccountSection`; relación con `UX-C-001`. |
| Evidencia exacta | Flujo general: `src/features/settings/settings-screen.tsx:547-562,1702-1791`; flujo dedicado: `src/features/reports/delete-account-section.tsx:14-49,51-115`. |
| Confianza/validación | **Alta** sobre divergencia; eliminación real no ejecutada. |
| Dirección de recomendación | Definir un único contrato de entrada, impacto, confirmación, resultado, sesión y recuperación para la eliminación; todas las entradas deben converger en él. Resolver `UX-C-001` como parte del cierre, sin duplicarlo aquí. |

### UX-H-008. Overlay de movimiento sin contrato semántico ni de foco

| Campo | Detalle |
|---|---|
| Severidad | `High` |
| Tipo de evidencia | Fuente estática + comparación con primitiva compartida |
| Afirmación neutral | La variante interceptada de `/movimientos/[id]` renderiza un `div` fijo con backdrop y panel visual, pero no declara diálogo/región, título asociado, foco inicial, Escape ni retorno de foco. El `Dialog` compartido sí implementa esos contratos. |
| Impacto para el usuario | Usuarios de teclado o lector de pantalla pueden no reconocer la apertura, navegar al contenido de fondo o no recuperar su posición al cerrar; el detalle primario puede resultar inaccesible. |
| Recorridos afectados | J04 Movimientos; J14 continuidad. |
| Rutas/componentes | `/movimientos/[id]` cuando se intercepta desde la lista; `MovimientoPanelPage`. |
| Evidencia exacta | Overlay: `src/app/(app)/movimientos/@panel/(.)[id]/page.tsx:20-38`; contrato compartido de referencia: `src/ui/primitivas/dialog.tsx:23-39,48-114`; panel no modal accesible comparable: `src/ui/domain/provenance-panel.tsx:42-79`. |
| Confianza/validación | **Alta** estática; validar secuencia Tab/Shift+Tab, Escape, lector de pantalla, back/forward y recarga directa. |
| Dirección de recomendación | Clasificar explícitamente la capa como modal o panel no modal y aplicar el contrato correspondiente de nombre, límites, foco, Escape, fondo y retorno. Mantener coherencia entre versión interceptada y carga directa. |

### UX-H-009. Pérdida de la pregunta entre Buscar y Asistente

| Campo | Detalle |
|---|---|
| Severidad | `High` |
| Tipo de evidencia | Fuente estática |
| Afirmación neutral | Buscar enlaza preguntas a `/asistente?q=<consulta>`, pero la página del asistente solo lee el parámetro `hilo` y no consume `q`. |
| Impacto para el usuario | La persona debe repetir su pregunta después de aceptar el handoff recomendado; se rompe el principio de un solo producto y la conversación no recibe la intención original. |
| Recorridos afectados | J03 Asistente; J10 Búsqueda/insights; J14 continuidad. |
| Rutas/componentes | `/buscar` → `/asistente`; `SearchScreen`; `AsistentePage`. |
| Evidencia exacta | `src/features/search/search-screen.tsx:91-107`; `src/app/(app)/asistente/page.tsx:8-23`. |
| Confianza/validación | **Alta** estática; validar texto, caracteres especiales, historial, refresh y envío único. |
| Dirección de recomendación | Definir un handoff explícito que preserve intención, permita revisarla antes de enviar y evite duplicar turnos al recargar. La superficie receptora debe consumir o rechazar de forma visible el contexto recibido. |

## Medium

### UX-M-001. El filtro de recordatorios resueltos se ignora

| Campo | Detalle |
|---|---|
| Severidad | `Medium` |
| Tipo de evidencia | Fuente estática |
| Afirmación neutral | “Ver resueltos” enlaza `?filtro=cerrados`, pero la pantalla siempre llama `listReminders("abiertos")` y no lee el query param. |
| Impacto para el usuario | No puede verificar cierre ni consultar avisos resueltos desde la affordance disponible. |
| Recorridos/rutas/componentes | J11; `/recordatorios`; `RemindersScreen`. |
| Evidencia exacta | `src/features/reminders/reminders-screen.tsx:23-37,47-57,77-83`. |
| Confianza/validación | **Alta** estática; validar URL directa y navegación cliente. |
| Dirección de recomendación | Hacer que filtro, consulta, título, estado vacío y navegación reflejen la misma vista; preservar el filtro en recarga y retorno. |

### UX-M-002. Buscar Pendientes es una acción inerte

| Campo | Detalle |
|---|---|
| Severidad | `Medium` |
| Tipo de evidencia | Fuente estática |
| Afirmación neutral | El botón con nombre accesible “Buscar pendientes” no tiene `onClick`, enlace ni formulario asociado. |
| Impacto para el usuario | Introduce una vía aparente para reducir carga en una bandeja potencialmente grande, pero no produce resultado. |
| Recorridos/rutas/componentes | J05; `/pendientes`; cabecera de `PendingScreen`. |
| Evidencia exacta | `src/features/pending/pending-screen.tsx:311-319`. |
| Confianza/validación | **Alta** estática. |
| Dirección de recomendación | Implementar una búsqueda coherente con filtros/datos disponibles o retirar la affordance hasta que exista; no conservar controles decorativos con rol de botón. |

### UX-M-003. Asistente full-screen sin salida móvil propia

| Campo | Detalle |
|---|---|
| Severidad | `Medium` |
| Tipo de evidencia | Fuente estática |
| Afirmación neutral | `/asistente` oculta la navegación móvil y monta `AssistantPanelContent` sin `onClose`; el panel global sí ofrece cierre, pero se excluye en `/asistente*`. |
| Impacto para el usuario | En móvil, salir depende del historial del navegador o navegación externa, sin control visible dentro del producto. |
| Recorridos/rutas/componentes | J03, J14; `/asistente`; `AsistentePage`, `AssistantPanel`. |
| Evidencia exacta | `src/app/(app)/asistente/page.tsx:14-24`; exclusión/cierre del panel global en `src/app/(app)/asistente/assistant-panel.tsx:18-38,53-63`. |
| Confianza/validación | **Alta** estática; verificar móvil con entrada directa y desde hilo. |
| Dirección de recomendación | Mantener una salida explícita y predecible al cambiar a la superficie full-screen, con destino y retorno de contexto definidos. |

### UX-M-004. DatePicker impide edición textual progresiva y asociación externa

| Campo | Detalle |
|---|---|
| Severidad | `Medium` |
| Tipo de evidencia | Fuente estática |
| Afirmación neutral | El input controlado solo propaga valores que ya parsean como fecha completa; caracteres parciales y cadena vacía no actualizan el valor. El tipo de props no acepta `id`. |
| Impacto para el usuario | Escribir o borrar una fecha carácter por carácter puede parecer imposible; `FieldShell` no puede asociar una etiqueta mediante `htmlFor` al input interno. |
| Recorridos/rutas/componentes | J04, J07, J08, J09; formularios con fecha; `DatePicker`. |
| Evidencia exacta | `src/ui/primitivas/date-picker.tsx:18-24,31-40,56-69`. |
| Confianza/validación | **Alta** estática; validar teclado, pegar, borrar, fecha inválida, lector de pantalla y móvil. |
| Dirección de recomendación | Separar borrador textual de valor fecha confirmado, permitir vacío/progreso y exponer identificador/descripción/error al formulario contenedor. |

### UX-M-005. Mutaciones sin feedback visible de rechazo

| Campo | Detalle |
|---|---|
| Severidad | `Medium` |
| Tipo de evidencia | Fuente estática sistémica |
| Afirmación neutral | Varias acciones esperan o encadenan promesas con `finally`/`then` pero sin `catch`/`onError` visible: posponer/descartar recordatorio; cambiar/pausar preferencias; solicitar/descargar exportación; acciones de memoria; archivar/pausar presupuestos y metas. |
| Impacto para el usuario | Ante 4xx/5xx/offline, el control deja de cargar o no cambia, pero la causa, el estado real y el siguiente paso no se explican. |
| Recorridos/rutas/componentes | J09, J11, J12, J13; `/recordatorios`, `/configuracion/recordatorios`, `/configuracion/datos`, Memoria, Presupuestos/Metas. |
| Evidencia exacta | `src/features/reminders/reminders-screen.tsx:100-119`; `src/features/reminders/reminder-preferences-screen.tsx:65-73,121-135`; `src/features/reports/export-data-screen.tsx:53-66,79-110`; `src/features/memory/memory-screen.tsx:88-94,114-163,202-230`; `src/features/budgets/budgets-screen.tsx:87-136,188-218`. |
| Confianza/validación | **Alta** sobre ausencia de feedback local; comportamiento global de promesas/runtime pendiente. |
| Dirección de recomendación | Adoptar un contrato común de mutación: estado en curso, error contextual, preservación/rollback, reintento seguro y reconciliación con servidor. |

### UX-M-006. Modelos duplicados y diálogos nativos en configuración/memoria

| Campo | Detalle |
|---|---|
| Severidad | `Medium` |
| Tipo de evidencia | Fuente estática |
| Afirmación neutral | Memoria aparece en Configuración general y en rutas dedicadas; exportación también tiene caminos distintos. Corrección/olvido individual usan `window.prompt`/`window.confirm`, mientras acciones equivalentes usan componentes del sistema. |
| Impacto para el usuario | Cambian términos, evidencia, feedback, foco y recuperación para el mismo objeto o intención; resulta más difícil predecir qué se modifica y dónde verificarlo. |
| Recorridos/rutas/componentes | J12, J14; `/configuracion`, `/configuracion/memoria*`, `/configuracion/datos`. |
| Evidencia exacta | Memoria dedicada y nativos: `src/features/memory/memory-screen.tsx:25-96,114-163,202-230`; configuración monolítica y datos: `src/features/settings/settings-screen.tsx:533-562,1689-1792`; exportación dedicada: `src/features/reports/export-data-screen.tsx:12-66`. |
| Confianza/validación | **Alta** estática; comprensión comparada pendiente. |
| Dirección de recomendación | Definir una fuente canónica por objeto/acción y un contrato compartido de evidencia, confirmación y cierre; las entradas alternativas deben converger, no reimplementar. |

### UX-M-007. Landmarks principales anidados o mal contenidos

| Campo | Detalle |
|---|---|
| Severidad | `Medium` |
| Tipo de evidencia | Fuente estática de semántica |
| Afirmación neutral | AppShell ya renderiza `<main>`, pero varias pantallas hijas renderizan otro `<main>`. PublicPageShell usa `<main>` como contenedor de header, contenido y footer. |
| Impacto para el usuario | La navegación por landmarks puede anunciar múltiples regiones principales anidadas o incluir cabecera/pie dentro del contenido principal, dificultando orientación. |
| Recorridos/rutas/componentes | Transversal; AppShell; Ayuda, Recordatorios, Reportes, Memoria, Descubrimientos, Buscar; sitio público. |
| Evidencia exacta | `src/features/app-shell/app-shell.tsx:284-299`; ejemplos `src/features/reminders/reminders-screen.tsx:47-85`, `src/features/memory/memory-screen.tsx:52-96`; público `src/features/public-site/public-site.tsx:17-86`. |
| Confianza/validación | **Alta** estática; validar rotor/lista de landmarks con NVDA/VoiceOver. |
| Dirección de recomendación | Asignar un único `main` por documento y usar `section`/contenedores para contenido interno; header/nav/footer deben ser landmarks hermanos apropiados. |

### UX-M-008. Feedback dinámico sin semántica live uniforme

| Campo | Detalle |
|---|---|
| Severidad | `Medium` |
| Tipo de evidencia | Fuente estática |
| Afirmación neutral | `LoadingBlock`, `ErrorState` y varios mensajes de mutación no declaran `role`/`aria-live`; otros dominios y `Toast` sí. La primitiva `Toast` no tiene consumidores de producción. |
| Impacto para el usuario | Usuarios de lector de pantalla pueden no enterarse de carga, error o finalización, o recibir comportamientos distintos entre dominios. |
| Recorridos/rutas/componentes | Transversal; estados compartidos; Pendientes, Configuración, Presupuestos y Memoria. |
| Evidencia exacta | `src/ui/primitivas/states.tsx:38-88`; contrato disponible `src/ui/primitivas/toast.tsx:50-93`; feedback sin rol en Pendientes `src/features/pending/pending-screen.tsx:349-361`; ejemplo con rol en Auth `src/features/auth/auth-screen.tsx:192-217`. |
| Confianza/validación | **Alta** estática; prioridad/anuncio real requiere lectores de pantalla. |
| Dirección de recomendación | Definir qué transiciones merecen `status`, `alert`, `aria-busy` o ningún anuncio; centralizar sin generar ruido repetido. |

### UX-M-009. Navegación pública móvil ausente y contacto no accionable

| Campo | Detalle |
|---|---|
| Severidad | `Medium` |
| Tipo de evidencia | Fuente estática + runtime público móvil |
| Afirmación neutral | El nav público se oculta debajo de `sm`; las páginas largas conservan enlaces solo en el footer. Correos y teléfono se imprimen como texto sin `mailto:`/`tel:`. |
| Impacto para el usuario | En móvil, explorar políticas/empresa/contacto exige llegar al final; contactar requiere copiar o transcribir información. |
| Recorridos/rutas/componentes | J01, J12; `/empresa`, `/privacidad`, `/terminos`, `/contacto`, `/estado`, `/eliminar-datos`. |
| Evidencia exacta | `src/features/public-site/public-site.tsx:10-47,51-76,186-211`; capturas públicas móviles en `evidence/runtime/public/`. |
| Confianza/validación | **Alta** sobre render/código; intención de navegación y tarea de contacto pendientes. |
| Dirección de recomendación | Mantener acceso móvil persistente o temprano a la navegación esencial y exponer datos de contacto mediante acciones semánticas compatibles con el dispositivo. |

### UX-M-010. Sin contrato global de offline, reconexión o resultado incierto

| Campo | Detalle |
|---|---|
| Severidad | `Medium` |
| Tipo de evidencia | Inventario estático por ausencia + configuración de datos |
| Afirmación neutral | El árbol autenticado contiene QueryClient, modo discreto y asistente, pero no una superficie global de conexión/interrupción. Query reintenta una vez y refetchea al enfocar; los dominios resuelven fallas de forma local y desigual. |
| Impacto para el usuario | Tras desconexión o expiración de sesión, no existe una explicación común de qué se conservó, si una acción llegó al servidor ni cómo reanudar sin duplicar. |
| Recorridos/rutas/componentes | J13 y transversal; layout autenticado, formularios, mutaciones y paneles. |
| Evidencia exacta | Árbol global `src/app/(app)/layout.tsx:36-45`; defaults `src/shared/data/query-client-provider.tsx:16-28`; rollback disponible pero optativo `src/shared/data/optimistic-mutation.ts:19-44`. |
| Confianza/validación | **Media-alta** sobre ausencia de componente global; service worker/navegador y comportamiento real deben confirmarse. |
| Dirección de recomendación | Definir estados globales y por acción para offline, reconexión, sesión expirada y resultado incierto; preservar borradores y ofrecer solo reintentos idempotentes. |

### UX-M-011. Cinco placeholders visibles crean deuda de arquitectura de información

| Campo | Detalle |
|---|---|
| Severidad | `Medium` |
| Tipo de evidencia | Fuente estática |
| Afirmación neutral | Cinco URL declaradas renderizan el mismo marcador informativo en lugar del trabajo nombrado. Tres apuntan a contenido que aún vive en Configuración general. |
| Impacto para el usuario | La navegación promete destinos de importación, detalle o configuración que no permiten completar la tarea; aumenta exploración y retorno. |
| Recorridos/rutas/componentes | J04, J05, J12; `/movimientos/importar`, `/pendientes/[id]`, `/configuracion/correo`, `/configuracion/perfil`, `/configuracion/privacidad`. |
| Evidencia exacta | `src/app/(app)/movimientos/importar/page.tsx:1-13`; `src/app/(app)/pendientes/[id]/page.tsx:1-13`; `src/app/(app)/configuracion/correo/page.tsx:1-10`; `src/app/(app)/configuracion/perfil/page.tsx:1-13`; `src/app/(app)/configuracion/privacidad/page.tsx:1-10`; común `src/shared/placeholder-section.tsx:4-35`. |
| Confianza/validación | **Alta** estática. |
| Dirección de recomendación | No exponer una destinación como funcional hasta que pueda completar su trabajo, o redirigir de forma explícita a la superficie canónica actual conservando contexto. |

### UX-M-012. Evidencia aportada de 500 autenticados sin vigencia ni causa confirmadas

| Campo | Detalle |
|---|---|
| Severidad | `Medium` provisional; elevar si se reproduce en flujo principal |
| Tipo de evidencia | Captura de runtime aportada por el usuario, sin fecha/entorno verificables |
| Afirmación neutral | `fotos para que veas/image.png` muestra dos respuestas 500 de `/api/v1/memory`, un 500 de `POST /api/v1/assistant/turns`, un `ApiClientError` no capturado y una advertencia CSP para Vercel Live. Esta auditoría no reprodujo esos endpoints. |
| Impacto para el usuario | Si continúa, Memoria y el envío conversacional pueden quedar inaccesibles y sin recuperación visible. No se afirma que continúe. |
| Recorridos/rutas/componentes | J03, J12, J13; Memoria y Asistente autenticados. |
| Evidencia exacta | Captura original `fotos para que veas/image.png` (no copiada); llamadas cliente `src/features/memory/memory-api.ts:14-25,77-80`; `src/app/(app)/asistente/assistant-api.ts:38-49`. |
| Confianza/validación | **Alta** sobre lo visible en la captura; **baja** sobre fecha, recurrencia, entorno y causa. |
| Dirección de recomendación | Reproducir de forma aislada con trazas y datos sintéticos, correlacionar status/trace ID y validar feedback del cliente. No corregir por inferencia ni atribuir causa a CSP. |

## Low

### UX-L-001. Terminología y ortografía inconsistentes

| Campo | Detalle |
|---|---|
| Severidad | `Low` |
| Tipo de evidencia | Fuente estática de contenido |
| Afirmación neutral | Navegación usa “Home”, la pantalla usa “Inicio” y copy de Configuración usa “Dashboard”; aparecen “Ir” genérico y palabras sin tilde como “Terminos”, “Pais”, “Telefono”, “Configuracion”, “accion”. |
| Impacto para el usuario | Añade traducción cognitiva y reduce consistencia profesional, sin bloqueo inmediato demostrado. |
| Recorridos/rutas/componentes | Transversal; navegación, público, Configuración y Recordatorios. |
| Evidencia exacta | `src/features/app-shell/app-shell.tsx:56-122`; `src/features/home/home-screen.tsx:153-180`; `src/features/settings/settings-screen.tsx:564-589,1695-1699`; `src/features/public-site/public-site.tsx:10-15,60-63,186-208`; `src/features/reminders/reminders-screen.tsx:131-139`. |
| Confianza/validación | **Alta** estática; validar vocabulario con usuarios antes de fijar taxonomía. |
| Dirección de recomendación | Crear un léxico de entidades, destinos y verbos consecuenciales; usar tildes y nombres de acción/destino específicos. |

### UX-L-002. Nombres duplicados en alta y reglas de contraseña no visibles

| Campo | Detalle |
|---|---|
| Severidad | `Low` |
| Tipo de evidencia | Fuente estática + runtime público |
| Afirmación neutral | En modo alta, el tab y el submit pueden compartir el nombre “Crear cuenta”. La contraseña exige `minLength={8}`, pero no hay hint visible antes del envío, también en reset. |
| Impacto para el usuario | Lista de botones ambigua para tecnología asistiva y error evitable al elegir contraseña. |
| Recorridos/rutas/componentes | J01; `/crear-cuenta`, `/restablecer-clave`; `AuthScreen`, `ResetPasswordScreen`. |
| Evidencia exacta | `src/features/auth/auth-screen.tsx:123-141,168-180,219-221`; `src/features/auth/reset-password-screen.tsx:89-112`. |
| Confianza/validación | **Alta** estática; comprobar nombres accesibles y validación nativa en navegadores. |
| Dirección de recomendación | Diferenciar selector de modo y acción final mediante nombre/contexto; mostrar reglas antes de que puedan fallar. |

### UX-L-003. Primitivas sin adopción y overflow autenticado pendiente

| Campo | Detalle |
|---|---|
| Severidad | `Low` |
| Tipo de evidencia | Búsqueda estática + riesgo de runtime no verificado |
| Afirmación neutral | `Table`, `Tooltip` y `Toast` existen y tienen pruebas, pero la búsqueda estática no encontró consumidores de producción. Preferencias usa tabla directa; proyecciones, calendarios y recordatorios tienen densidad variable sin capturas autenticadas. |
| Impacto para el usuario | Consistencia, ayuda contextual, anuncios y desborde pueden variar; el impacto concreto aún requiere runtime. |
| Recorridos/rutas/componentes | J08, J10, J11, J12; tablas, proyecciones, calendarios, feedback. |
| Evidencia exacta | `src/ui/primitivas/table.tsx:4-38`; `src/ui/primitivas/tooltip.tsx:21-60`; `src/ui/primitivas/toast.tsx:11-14,50-93`; tabla directa `src/features/reminders/reminder-preferences-screen.tsx:86-119`. |
| Confianza/validación | **Alta** sobre ausencia de imports de producción; **media-baja** sobre impacto responsivo. |
| Dirección de recomendación | Adoptar las primitivas solo donde su contrato resuelva una necesidad real; probar 320–768 px y zoom antes de atribuir un defecto concreto. |

### UX-L-004. `/estado` es manual y no representa salud actual

| Campo | Detalle |
|---|---|
| Severidad | `Low` sistémico |
| Tipo de evidencia | Fuente estática + runtime público |
| Afirmación neutral | La página declara explícitamente actualización manual, una fecha fija y todos los componentes como operativos. |
| Impacto para el usuario | Puede quedar desactualizada; usarla como evidencia operacional produciría una conclusión incorrecta. El propio copy mitiga parte del riesgo. |
| Recorridos/rutas/componentes | J01, J13; `/estado`. |
| Evidencia exacta | `src/app/(publico)/estado/page.tsx:3-15,17-40`; capturas [D](evidence/runtime/public/estado--desktop--1440x900.png) · [M](evidence/runtime/public/estado--mobile--390x844.png). |
| Confianza/validación | **Alta** sobre naturaleza manual; estado real de servicios desconocido. |
| Dirección de recomendación | Mantener la distinción visible entre comunicación editorial y telemetría; no usar esta página para aprobar salud o cerrar incidentes. |

## Orden de resolución y prueba

1. `UX-C-001` debe resolverse antes de cualquier aprobación o prueba de eliminación con usuarios.
2. `UX-H-001`, `UX-H-002`, `UX-H-003`, `UX-H-005` y `UX-H-009` restauran correspondencia básica entre intención, control y consecuencia.
3. `UX-H-004`, `UX-H-006`, `UX-H-007` y `UX-H-008` restauran contratos de recuperación, riesgo y accesibilidad.
4. Los `UX-M-*` deben resolverse por contrato sistémico, no como parches visuales independientes.
5. Los `UX-L-*` se abordan después de validar lenguaje, breakpoints y tecnología asistiva, salvo correcciones ortográficas inequívocas.

La dirección de recomendación no selecciona un trabajo inicial ni prescribe una interfaz final. Define el contrato mínimo que una solución posterior debe satisfacer.
