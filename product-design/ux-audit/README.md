# Auditoría UX de Manzana

## Diagnóstico ejecutivo

**Manzana no está lista para aprobación de experiencia.** La implementación contiene fundamentos valiosos para construir confianza financiera dentro de varias superficies: procedencia y exclusiones, incertidumbre explícita, modo discreto, protección contra duplicados, reversibilidad en movimientos, sugerencias recurrentes basadas en evidencia, confirmaciones proporcionales al riesgo y lenguaje no punitivo. Sin embargo, los bordes entre recorridos son débiles: existen afirmaciones de éxito no sustentadas, controles primarios sin efecto, pérdidas de contexto, cierres divergentes y recuperaciones incompletas.

El problema principal no es de acabado visual. Es de **continuidad entre intención, acción, consecuencia y siguiente paso**. El caso más grave es `/cuenta-eliminada`: una URL pública y accesible directamente afirma que la cuenta y los datos fueron eliminados sin demostrar una acción previa. En el asistente, varios controles visibles no ejecutan la acción anunciada o navegan al destino equivocado. En Pendientes, errores reales comparten el tratamiento visual de éxito. Estas brechas contradicen el contrato del brief: una acción fallida no puede presentarse como exitosa, y una afirmación financiera o irreversible debe exponer evidencia, consecuencia y control.

Los patrones sólidos se reconocen como **fundamentos de implementación**, no como prueba de que las personas alcancen calma, claridad o confianza. Esos resultados emocionales siguen siendo hipótesis que requieren evidencia directa de usuarios.

## Estado de la auditoría

| Dimensión | Estado | Qué significa |
|---|---|---|
| Cobertura estática de implementación | **Completa** | Se inventariaron 53 URL visuales representadas por 54 módulos `page.tsx`; se revisaron rutas, navegación, componentes y familias de acciones consecuenciales. |
| Runtime público | **Observado** | Se observaron 13 rutas públicas seguras en escritorio 1440×900 y móvil 390×844, con 26 capturas. `/` redirigió a `/entrar?redirigir=%2F`; no se observaron fallas de consola, página o solicitudes seguras durante la carga inicial. |
| Runtime autenticado | **Pendiente** | Ningún recorrido autenticado ni envío de formulario fue ejecutado en esta auditoría. La evaluación autenticada es estática. |
| Validación con usuarios | **Pendiente** | No se realizaron entrevistas ni pruebas de usabilidad; no se afirma ningún resultado emocional como hecho. |
| Aprobación de experiencia | **No recomendada** | Deben resolverse y validarse al menos `UX-C-001` y los hallazgos `UX-H-*`, seguidos por una pasada autenticada aislada. |

## Qué leer primero

1. Lea este diagnóstico y la tabla de hallazgos principales.
2. Revise [`04-hallazgos-priorizados.md`](04-hallazgos-priorizados.md), comenzando por `UX-C-001` y `UX-H-001` a `UX-H-009`.
3. Use [`02-recorridos-criticos.md`](02-recorridos-criticos.md) para entender cómo los defectos rompen trabajos completos, no solo pantallas.
4. Compruebe que ninguna superficie quedó omitida en [`01-inventario-y-cobertura.md`](01-inventario-y-cobertura.md).
5. Revise la deuda de componentes, contenido y accesibilidad en [`03-componentes-contenido-y-accesibilidad.md`](03-componentes-contenido-y-accesibilidad.md).
6. Antes de aprobar correcciones, ejecute el protocolo aislado de [`05-plan-de-validacion.md`](05-plan-de-validacion.md).

## Alcance

La auditoría evalúa la experiencia implementada contra `product-design/experience-brief.md`. La unidad de análisis es el recorrido completo en sus dimensiones funcional, cognitiva y emocional. Incluye:

- Las 53 URL visuales y los 54 módulos de página, incluida la variante interceptada de `/movimientos/[id]`.
- Las 14 familias de recorridos obligatorias.
- Las 14 destinaciones autenticadas reconocidas por la navegación compartida.
- Componentes reutilizables y elementos directos: acciones, enlaces, formularios, listas, tablas, tarjetas, navegación, paneles, diálogos, estados, contenido y semántica.
- Familias de acciones consecuenciales: autenticación, onboarding, movimientos, pendientes, cuentas, cajas, deudas, pagos próximos, presupuestos, metas, descubrimientos, memoria, asistente, recordatorios, configuración, exportación, eliminación, categorías, soporte y baja pública.
- Evidencia pública en escritorio y móvil, sin autenticación ni mutaciones.

Quedan fuera de alcance la implementación, el rediseño visual final, la elección del trabajo inicial, los cambios de producto, la producción, el corpus histórico `docs/` y cualquier inferencia emocional basada únicamente en interfaz o telemetría.

## Método

1. Se leyó primero el brief autoritativo y se conservaron sus decisiones abiertas.
2. Se reconcilió el árbol de rutas con la navegación y los módulos visuales.
3. Se revisó estáticamente cada página, los componentes compartidos y cada familia de acción con consecuencias.
4. Se contrastaron los hallazgos severos con fuente actual y referencias `ruta:línea`.
5. Se incorporó la observación pública existente como una capa separada de la evidencia estática.
6. Se deduplicaron problemas sistémicos y se enlazaron con recorridos, rutas y componentes.
7. Se formularon transiciones emocionales solo como hipótesis y se definió qué evidencia humana falta.

La presencia de 12 especificaciones Playwright no prueba los recorridos: todas están declaradas con `test.fixme` en `tests/e2e/`.

## Límite de evidencia

| Tipo | Qué permite afirmar | Qué no permite afirmar |
|---|---|---|
| Fuente estática | Que un control tiene o no handler, qué destino usa, qué estados y semántica declara, y qué recuperación está programada. | Que el backend, la sesión, el foco, el lector de pantalla o el recorrido completo funcionan en runtime. |
| Runtime público | Que las 13 rutas seguras renderizaron en las dos vistas observadas y cómo se presentó su carga inicial. | Que los formularios fueron enviados, que los tokens son válidos o que cualquier flujo autenticado funciona. |
| Captura aportada por el usuario | Que la imagen muestra HTTP 500 repetidos en `/api/v1/memory`, un `POST /api/v1/assistant/turns` con 500, un `ApiClientError` no capturado y una advertencia CSP. | La fecha, recurrencia actual, causa raíz o alcance del incidente. La imagen permanece en `fotos para que veas/image.png` y no se copió al audit. |
| Especificaciones `test.fixme` | Que existe intención documental de cubrir 12 escenarios. | Que esos escenarios se ejecutan o pasan. |
| Hipótesis emocional | Que una transición es deseable o que un patrón podría construir o erosionar confianza. | Que una persona sintió calma, culpa, seguridad, agencia o confianza. |

Capturas de referencia: [cuenta eliminada, escritorio](evidence/runtime/public/cuenta-eliminada--desktop--1440x900.png), [restablecimiento, móvil](evidence/runtime/public/restablecer-clave--mobile--390x844.png), [entrada, escritorio](evidence/runtime/public/entrar--desktop--1440x900.png).

## Rúbrica de severidad

| Severidad | Criterio aplicado |
|---|---|
| `Critical` | Estado accesible que afirma un resultado irreversible no demostrado, con potencial de inducir una comprensión materialmente falsa. |
| `High` | Bloquea un recorrido principal, daña de forma relevante la confianza o deja inaccesible una acción primaria. |
| `Medium` | Introduce fricción material, recuperación incompleta, inconsistencia sistémica o riesgo de accesibilidad que requiere validación. |
| `Low` | Deuda acotada de terminología, pulido o consistencia sin bloqueo inmediato demostrado. |

La severidad no se eleva por una hipótesis emocional no verificada.

## Hallazgos principales

| ID | Severidad | Diagnóstico resumido | Estado de evidencia |
|---|---|---|---|
| `UX-C-001` | `Critical` | `/cuenta-eliminada` afirma públicamente una eliminación irreversible sin acción precedente demostrada. | Fuente + runtime público escritorio/móvil. |
| `UX-H-001` | `High` | Los bloques `accion` y `lista` del asistente pueden mostrarse como accionables sin efecto; `mostrar` dirige cualquier entidad a Movimientos. | Fuente estática, no verificado autenticado. |
| `UX-H-002` | `High` | El backend admite una segunda confirmación de duplicado, pero la tarjeta del asistente no puede enviarla. | Fuente estática, no verificado autenticado. |
| `UX-H-003` | `High` | Pendientes almacena errores y éxitos en el mismo mensaje y los representa siempre en verde con icono de éxito. | Fuente estática, no verificado autenticado. |
| `UX-H-004` | `High` | `/restablecer-clave` presenta un formulario activo antes de validar una sesión de recuperación. | Fuente + runtime público escritorio/móvil; envío no ejecutado. |
| `UX-H-005` | `High` | En Memoria, búsqueda, recordatorios y el menú Más dependen de un callback omitido; varios controles móviles quedan inertes. | Fuente estática, no verificado autenticado. |
| `UX-H-006` | `High` | Onboarding navega aunque falle o sea rechazada la persistencia del avance. | Fuente estática, no verificado autenticado. |
| `UX-H-007` | `High` | La eliminación de cuenta está duplicada con salvaguardas y cierres divergentes. | Fuente estática, no verificado autenticado. |
| `UX-H-008` | `High` | El detalle interceptado de movimiento parece un diálogo/panel superpuesto, pero no declara semántica ni gestión de foco, Escape o retorno. | Fuente estática, no verificado autenticado. |
| `UX-H-009` | `High` | Buscar entrega una pregunta mediante `?q=`, pero el asistente solo lee `?hilo=` y pierde el contexto. | Fuente estática, no verificado autenticado. |

## Fundamentos que conviene conservar

| Fundamento observado | Evidencia estática | Límite de la afirmación |
|---|---|---|
| Procedencia, elementos contados/no contados y navegación a filas | `src/ui/domain/money-with-provenance.tsx:6-60`; `src/ui/domain/provenance-panel.tsx:10-39,95-136` | No prueba que las personas comprendan la procedencia. |
| Incertidumbre y proyecciones acotadas por rango y supuestos | `src/ui/domain/confirmation-card.tsx:9-18`; `src/features/projections/projection-summary-card.tsx:13-36` | No prueba calibración real de confianza. |
| Modo discreto transversal | `src/features/app-shell/app-shell.tsx:149-149,262-278`; `src/ui/domain/provenance-panel.tsx:54-55` | Requiere verificar todas las superficies y transiciones en runtime. |
| Eliminación/restauración de movimientos con feedback de error | `src/app/(app)/movimientos/movement-detail-view.tsx:60-90,100-138` | No se ejecutó el ciclo completo. |
| Propuestas recurrentes basadas en evidencia y confirmación explícita | `src/features/upcoming/upcoming-screen.tsx:737-784,1008-1030` | No se validó si la evidencia es suficiente o comprensible. |
| Confirmación proporcional al riesgo y detalle de consentimiento | `src/ui/domain/confirmation-card.tsx:21-46,101-142` | Algunas superficies específicas eluden este contrato. |
| Estado compartido entre propuesta del asistente y Pendientes | `src/app/(app)/asistente/use-assistant-pending-item.ts:7-13`; `src/app/(app)/asistente/use-assistant-proposal-actions.ts:13-31` | Existe divergencia en la segunda confirmación de duplicado. |
| Reversión de mutaciones optimistas | `src/shared/data/optimistic-mutation.ts:19-44` | No todas las mutaciones usan este helper. |
| Regreso sin culpa y sin puesta al día total | `src/core/nudges/nudge-evaluator.ts:339-365` | Es lenguaje implementado; no demuestra el efecto emocional deseado. |

## Decisión de revisión

La auditoría recomienda **no aprobar aún** la experiencia. El orden de decisión es:

1. Eliminar los falsos éxitos y restablecer correspondencia entre affordance, acción y destino.
2. Unificar contratos de confirmación, error, recuperación y cierre en acciones de alto riesgo.
3. Verificar los recorridos autenticados en un entorno aislado y sembrado.
4. Validar comprensión, carga, control y transiciones emocionales con participantes del segmento conductual definido en el brief.
5. Solo después, decidir si la experiencia cumple el contrato y qué trabajo inicial merece priorización.
