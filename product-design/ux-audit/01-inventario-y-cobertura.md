# Inventario y cobertura

## Resultado de cobertura

| Métrica | Resultado |
|---|---:|
| URL visuales distintas | 53 |
| Módulos `page.tsx` | 54 |
| Diferencia explicada | `/movimientos/[id]` tiene página completa y variante interceptada `@panel/(.)[id]` para la misma URL. |
| URL públicas o de autenticación, incluida `/` | 14 |
| URL autenticadas | 39 |
| Destinaciones autenticadas reconocidas por navegación | 14 |
| Rutas dinámicas visuales | 11 |
| Placeholders visibles | 5 |
| Capturas públicas | 26, 13 rutas × 2 viewports |
| Especificaciones E2E | 12, todas `test.fixme`; cobertura ejecutable demostrada: 0 |

**Convención de runtime.** `Live público D/M` significa carga inicial observada en 1440×900 y 390×844. `Estático autenticado` significa revisión de fuente sin sesión ni interacción en vivo. `Token omitido` significa que el recorrido público requiere un token y no fue ejecutado. `Redirección/no visual` significa que el módulo no tiene superficie propia. `Placeholder` significa que la URL renderiza deliberadamente `src/shared/placeholder-section.tsx`.

## Matriz completa de URL

### Públicas, autenticación y recuperación

| # | URL visual | Módulo | Clase | Implementación | Estado runtime | Recorridos |
|---:|---|---|---|---|---|---|
| 1 | `/` | `src/app/page.tsx` | Pública, redirección | Sin UI propia; sesión → `/inicio`, sin sesión → `/entrar` | `Redirección/no visual`; observada D/M, destino `/entrar?redirigir=%2F` | J01, J14 |
| 2 | `/entrar` | `src/app/(publico)/entrar/page.tsx` | Auth pública | Formulario de acceso | `Live público D/M`; no enviado | J01 |
| 3 | `/crear-cuenta` | `src/app/(publico)/crear-cuenta/page.tsx` | Auth pública | Formulario de alta | `Live público D/M`; no enviado | J01, J02 |
| 4 | `/recuperar-clave` | `src/app/(publico)/recuperar-clave/page.tsx` | Auth pública | Solicitud de enlace | `Live público D/M`; no enviada | J01, J13 |
| 5 | `/restablecer-clave` | `src/app/(publico)/restablecer-clave/page.tsx` | Auth pública | Formulario de nueva clave | `Live público D/M`; token/sesión y envío no verificados | J01, J13 |
| 6 | `/verificar` | `src/app/(publico)/verificar/page.tsx` | Auth pública | Reenvío de verificación | `Live público D/M`; no enviado | J01 |
| 7 | `/empresa` | `src/app/(publico)/empresa/page.tsx` | Pública | Información corporativa | `Live público D/M` | J01 |
| 8 | `/privacidad` | `src/app/(publico)/privacidad/page.tsx` | Pública | Política de privacidad | `Live público D/M` | J01, J12 |
| 9 | `/terminos` | `src/app/(publico)/terminos/page.tsx` | Pública | Términos | `Live público D/M` | J01 |
| 10 | `/contacto` | `src/app/(publico)/contacto/page.tsx` | Pública | Contacto oficial | `Live público D/M` | J01 |
| 11 | `/eliminar-datos` | `src/app/(publico)/eliminar-datos/page.tsx` | Pública | Explicación de eliminación | `Live público D/M`; sin mutación | J12 |
| 12 | `/cuenta-eliminada` | `src/app/(publico)/cuenta-eliminada/page.tsx` | Pública, cierre irreversible | Estado de éxito fijo | `Live público D/M`; acceso directo confirmado | J12, J13 |
| 13 | `/baja` | `src/app/(publico)/baja/page.tsx` | Pública tokenizada | Baja de correo saliente | `Token omitido`; revisión estática | J11, J12 |
| 14 | `/estado` | `src/app/(publico)/estado/page.tsx` | Pública | Estado actualizado manualmente | `Live público D/M`; no es telemetría de salud | J01, J13 |

### Aplicación autenticada

| # | URL visual | Módulo(s) | Clase | Implementación | Estado runtime | Recorridos |
|---:|---|---|---|---|---|---|
| 15 | `/inicio` | `src/app/(app)/inicio/page.tsx` | Autenticada | Inicio/resumen; guard de onboarding en cliente | `Estático autenticado` | J02, J11, J14 |
| 16 | `/bienvenida` | `src/app/(app)/bienvenida/page.tsx` | Autenticada | Elección de puerta inicial | `Estático autenticado` | J02 |
| 17 | `/bienvenida/correo` | `src/app/(app)/bienvenida/correo/page.tsx` | Autenticada | Permiso/conexión inicial de correo | `Estático autenticado` | J02, J08 |
| 18 | `/movimientos` | `src/app/(app)/movimientos/page.tsx` | Autenticada | Lista, filtros, clasificación y alta contextual | `Estático autenticado` | J04, J10, J14 |
| 19 | `/movimientos/nuevo` | `src/app/(app)/movimientos/nuevo/page.tsx` | Autenticada | Alta de movimiento | `Estático autenticado` | J02, J04 |
| 20 | `/movimientos/importar` | `src/app/(app)/movimientos/importar/page.tsx` | Autenticada | **Placeholder** de importación | `Placeholder`; estático autenticado | J04 |
| 21 | `/movimientos/[id]` | `src/app/(app)/movimientos/[id]/page.tsx`; `src/app/(app)/movimientos/@panel/(.)[id]/page.tsx` | Autenticada, dinámica, interceptada | Detalle completo al cargar; overlay al navegar desde lista | `Estático autenticado`; 2 módulos, 1 URL | J04, J14 |
| 22 | `/pendientes` | `src/app/(app)/pendientes/page.tsx` | Autenticada | Bandeja, edición, confirmación y lotes | `Estático autenticado` | J03, J05, J14 |
| 23 | `/pendientes/[id]` | `src/app/(app)/pendientes/[id]/page.tsx` | Autenticada, dinámica | **Placeholder** de detalle | `Placeholder`; estático autenticado | J05 |
| 24 | `/mi-dinero` | `src/app/(app)/mi-dinero/page.tsx` | Autenticada | Resumen de cuentas, cajas y dinero libre | `Estático autenticado` | J06, J10 |
| 25 | `/mi-dinero/cuentas/[id]` | `src/app/(app)/mi-dinero/cuentas/[id]/page.tsx` | Autenticada, dinámica | Detalle y gestión de cuenta | `Estático autenticado` | J06 |
| 26 | `/mi-dinero/cajas/[id]` | `src/app/(app)/mi-dinero/cajas/[id]/page.tsx` | Autenticada, dinámica | Detalle y gestión de caja | `Estático autenticado` | J06, J09 |
| 27 | `/deudas` | `src/app/(app)/deudas/page.tsx` | Autenticada | Lista y creación/gestión de deudas | `Estático autenticado` | J07 |
| 28 | `/deudas/[id]` | `src/app/(app)/deudas/[id]/page.tsx` | Autenticada, dinámica | Detalle, pagos, cuotas y estados | `Estático autenticado` | J07 |
| 29 | `/pagos-que-vienen` | `src/app/(app)/pagos-que-vienen/page.tsx` | Autenticada | Compromisos, calendario y sugerencias | `Estático autenticado` | J08, J11 |
| 30 | `/pagos-que-vienen/[id]` | `src/app/(app)/pagos-que-vienen/[id]/page.tsx` | Autenticada, dinámica | Regla recurrente e historial | `Estático autenticado` | J08 |
| 31 | `/presupuestos` | `src/app/(app)/presupuestos/page.tsx` | Autenticada | Presupuestos, metas y sugerencias | `Estático autenticado` | J09 |
| 32 | `/presupuestos/[id]` | `src/app/(app)/presupuestos/[id]/page.tsx` | Autenticada, dinámica | Detalle de presupuesto o meta | `Estático autenticado` | J09 |
| 33 | `/descubrimientos` | `src/app/(app)/descubrimientos/page.tsx` | Autenticada | Lista de hallazgos con evidencia | `Estático autenticado` | J10 |
| 34 | `/descubrimientos/[id]` | `src/app/(app)/descubrimientos/[id]/page.tsx` | Autenticada, dinámica | Detalle, evidencia y acción | `Estático autenticado` | J10, J14 |
| 35 | `/buscar` | `src/app/(app)/buscar/page.tsx` | Autenticada | Búsqueda natural y handoff al asistente | `Estático autenticado` | J10, J14 |
| 36 | `/reportes` | `src/app/(app)/reportes/page.tsx` | Autenticada | Reporte por periodo | `Estático autenticado` | J10 |
| 37 | `/proyecciones` | `src/app/(app)/proyecciones/page.tsx` | Autenticada | Rangos, supuestos y simulación | `Estático autenticado` | J10 |
| 38 | `/recordatorios` | `src/app/(app)/recordatorios/page.tsx` | Autenticada | Bandeja de recordatorios | `Estático autenticado` | J11, J13 |
| 39 | `/asistente` | `src/app/(app)/asistente/page.tsx` | Autenticada | Conversación a pantalla completa | `Estático autenticado` | J03, J10, J14 |
| 40 | `/asistente/hilos` | `src/app/(app)/asistente/hilos/page.tsx` | Autenticada | Historial/archivo de hilos | `Estático autenticado` | J03, J14 |
| 41 | `/configuracion` | `src/app/(app)/configuracion/page.tsx` | Autenticada | Configuración general monolítica | `Estático autenticado` | J11, J12 |
| 42 | `/configuracion/memoria` | `src/app/(app)/configuracion/memoria/page.tsx` | Autenticada | Memoria, candidatos y olvido | `Estático autenticado` | J12 |
| 43 | `/configuracion/memoria/[id]` | `src/app/(app)/configuracion/memoria/[id]/page.tsx` | Autenticada, dinámica | Evidencia e historial de un recuerdo | `Estático autenticado` | J12 |
| 44 | `/configuracion/perfil` | `src/app/(app)/configuracion/perfil/page.tsx` | Autenticada | **Placeholder**; contenido aún en configuración general | `Placeholder`; estático autenticado | J12 |
| 45 | `/configuracion/datos` | `src/app/(app)/configuracion/datos/page.tsx` | Autenticada | Exportaciones y eliminación de cuenta | `Estático autenticado` | J12, J13 |
| 46 | `/configuracion/categorias` | `src/app/(app)/configuracion/categorias/page.tsx` | Autenticada | Lista y gestión de categorías | `Estático autenticado` | J04, J12 |
| 47 | `/configuracion/categorias/[id]` | `src/app/(app)/configuracion/categorias/[id]/page.tsx` | Autenticada, dinámica | Detalle/edición de categoría | `Estático autenticado` | J04, J12 |
| 48 | `/configuracion/correo` | `src/app/(app)/configuracion/correo/page.tsx` | Autenticada | **Placeholder**; conexión aún en configuración general | `Placeholder`; estático autenticado | J02, J08, J12 |
| 49 | `/configuracion/recordatorios` | `src/app/(app)/configuracion/recordatorios/page.tsx` | Autenticada | Preferencias y pausa de avisos | `Estático autenticado` | J11, J12 |
| 50 | `/configuracion/privacidad` | `src/app/(app)/configuracion/privacidad/page.tsx` | Autenticada | **Placeholder**; privacidad aún en configuración general | `Placeholder`; estático autenticado | J12 |
| 51 | `/ayuda` | `src/app/(app)/ayuda/page.tsx` | Autenticada | Índice de ayuda | `Estático autenticado` | J01, J13 |
| 52 | `/ayuda/[tema]` | `src/app/(app)/ayuda/[tema]/page.tsx` | Autenticada, dinámica | Artículo de ayuda | `Estático autenticado` | J01, J13 |
| 53 | `/ayuda/contacto` | `src/app/(app)/ayuda/contacto/page.tsx` | Autenticada | Formulario de soporte | `Estático autenticado`; no enviado | J01, J13 |

## Inventario de módulos y conteo

El conteo de 54 módulos se obtiene así:

- 14 módulos para las 14 URL públicas, incluida la raíz.
- 40 módulos dentro de `(app)`.
- Esos 40 módulos representan 39 URL autenticadas porque `/movimientos/[id]` posee dos implementaciones de página para contextos de navegación distintos.
- Total: 14 + 40 = 54 módulos; 14 + 39 = 53 URL visuales.

No se cuentan rutas API, layouts, `loading.tsx`, `error.tsx`, callbacks no visuales ni archivos históricos como URL visuales.

## Grafo de navegación

### Destinaciones autenticadas reconocidas

La fuente compartida reconoce 14 vistas en `src/features/app-shell/app-shell.tsx:28-42` y las traduce a URL en `src/shared/legacy-nav/legacy-view-routes.ts:11-26`:

| Vista | URL | Exposición escritorio | Exposición móvil |
|---|---|---|---|
| Home | `/inicio` | Lateral | Barra inferior |
| Movimientos | `/movimientos` | Lateral | Barra inferior |
| Pendientes | `/pendientes` | Lateral | Barra inferior |
| Mi Dinero | `/mi-dinero` | Lateral | Barra inferior |
| Deudas | `/deudas` | Lateral | Más |
| Pagos que vienen | `/pagos-que-vienen` | Lateral | Más |
| Descubrimientos | `/descubrimientos` | Lateral | Más |
| Presupuestos | `/presupuestos` | Lateral | Más |
| Reportes | `/reportes` | Lateral | Más |
| Proyecciones | `/proyecciones` | Lateral | Más |
| Asistente | `/asistente` | Lateral | Más |
| Recordatorios | `/recordatorios` | Lateral + cabecera | Más + cabecera |
| Configuración | `/configuracion` | Lateral separado | Más |
| Buscar | `/buscar` | Formulario de cabecera | Botón de cabecera |

La barra inferior móvil expone Home, Movimientos, Pendientes y Mi Dinero; el menú Más contiene las ocho secciones restantes del arreglo principal más Configuración (`src/features/app-shell/app-shell.tsx:302-365`). Buscar permanece en la cabecera. En rutas de Memoria, la omisión de `onNavigate` rompe los controles basados en callback, aunque los cuatro enlaces inferiores sí conservan su `href`; véase `UX-H-005`.

### Entradas y transiciones principales

| Origen | Transición | Destino/resultado | Observación |
|---|---|---|---|
| `/` | Redirección por sesión | `/inicio` o `/entrar` | Runtime sin sesión observado hacia `/entrar?redirigir=%2F`. |
| Alta | Cuenta creada | `/bienvenida` y luego una puerta inicial | Persistencia previa a navegación no es confiable, `UX-H-006`. |
| Inicio/Global | Acción de nueva entrada | `/movimientos/nuevo` | Implementado; no probado en vivo. |
| Lista de movimientos | Selección de fila | `/movimientos/[id]` interceptado | Semántica/foco del overlay insuficientes, `UX-H-008`. |
| Pregunta en Buscar | Handoff | `/asistente?q=...` | El asistente pierde `q`, `UX-H-009`. |
| Asistente global | Expandir/historial | `/asistente`, `/asistente/hilos` | Panel global excluido en `/asistente*`. |
| Propuesta del asistente | Confirmar/descartar/editar | Mismo `pending_item` de Pendientes | Estado compartido, pero segunda confirmación imposible, `UX-H-002`. |
| Recordatorio | `action_url` | Entidad o vista específica | El enlace visible se llama genéricamente “Ir”. |
| Configuración | Datos | `/configuracion/datos` | Exportación y eliminación dedicadas, además de flujos duplicados en `/configuracion`. |
| Configuración | Memoria | `/configuracion/memoria[/id]` | Corrección, olvido, reactivación e historial. |
| Ayuda | Tema/Contacto | `/ayuda/[tema]`, `/ayuda/contacto` | Soporte autenticado separado del contacto público. |

## Placeholders e información arquitectónica visible

| URL | Evidencia | Deuda de experiencia |
|---|---|---|
| `/movimientos/importar` | `src/app/(app)/movimientos/importar/page.tsx:1-13` | Promete una capacidad de importación aún no disponible. |
| `/pendientes/[id]` | `src/app/(app)/pendientes/[id]/page.tsx:1-13` | La URL de detalle existe, pero no permite revisar el pendiente individual. |
| `/configuracion/correo` | `src/app/(app)/configuracion/correo/page.tsx:1-10` | La sección anunciada sigue concentrada en Configuración general. |
| `/configuracion/perfil` | `src/app/(app)/configuracion/perfil/page.tsx:1-13` | La estructura de información y el contenido real divergen. |
| `/configuracion/privacidad` | `src/app/(app)/configuracion/privacidad/page.tsx:1-10` | La expectativa de privacidad dedicada termina en un marcador. |

Los cinco usan `src/shared/placeholder-section.tsx:4-35`. No se consideran “sin implementar” silenciosamente: son superficies visibles y se tratan como deuda de arquitectura de información (`UX-M-011`).

## Cobertura de acciones consecuenciales

| Familia | Superficies principales | Cobertura estática | Cobertura runtime |
|---|---|---|---|
| Autenticación y recuperación | `/entrar`, `/crear-cuenta`, `/recuperar-clave`, `/restablecer-clave`, `/verificar` | Completa | Solo render público; sin envíos/tokens |
| Onboarding | `/bienvenida`, `/bienvenida/correo`, `/inicio` | Completa | No verificada |
| Movimientos y categorías | `/movimientos*`, `/configuracion/categorias*` | Completa | No verificada |
| Pendientes | `/pendientes*` | Completa | No verificada |
| Cuentas y cajas | `/mi-dinero*` | Completa | No verificada |
| Deudas | `/deudas*` | Completa | No verificada |
| Pagos próximos/recurrentes | `/pagos-que-vienen*` | Completa | No verificada |
| Presupuestos y metas | `/presupuestos*` | Completa | No verificada |
| Descubrimientos, búsqueda, reportes y proyecciones | `/descubrimientos*`, `/buscar`, `/reportes`, `/proyecciones` | Completa | No verificada |
| Memoria | `/configuracion/memoria*`, memoria dentro de `/configuracion` | Completa | No verificada; captura aportada muestra 500 históricos/no fechados |
| Asistente | `/asistente*` y panel global | Completa | No verificada; captura aportada muestra 500 histórico/no fechado |
| Recordatorios y regreso | `/recordatorios`, `/configuracion/recordatorios` | Completa | No verificada |
| Configuración, exportación y eliminación | `/configuracion*`, `/eliminar-datos`, `/cuenta-eliminada` | Completa | Solo páginas públicas; sin mutación autenticada |
| Soporte | `/contacto`, `/ayuda*` | Completa | Contacto público renderizado; formulario no enviado |
| Baja pública | `/baja` | Completa | Token omitido |

## Cobertura pública observada

| Ruta solicitada | Resultado | Capturas |
|---|---|---|
| `/` | Redirigió a `/entrar?redirigir=%2F` | [D](evidence/runtime/public/home--desktop--1440x900.png) · [M](evidence/runtime/public/home--mobile--390x844.png) |
| `/entrar` | Render inicial | [D](evidence/runtime/public/entrar--desktop--1440x900.png) · [M](evidence/runtime/public/entrar--mobile--390x844.png) |
| `/crear-cuenta` | Render inicial | [D](evidence/runtime/public/crear-cuenta--desktop--1440x900.png) · [M](evidence/runtime/public/crear-cuenta--mobile--390x844.png) |
| `/recuperar-clave` | Render inicial | [D](evidence/runtime/public/recuperar-clave--desktop--1440x900.png) · [M](evidence/runtime/public/recuperar-clave--mobile--390x844.png) |
| `/restablecer-clave` | Formulario activo visible | [D](evidence/runtime/public/restablecer-clave--desktop--1440x900.png) · [M](evidence/runtime/public/restablecer-clave--mobile--390x844.png) |
| `/verificar` | Render inicial | [D](evidence/runtime/public/verificar--desktop--1440x900.png) · [M](evidence/runtime/public/verificar--mobile--390x844.png) |
| `/empresa` | Render inicial | [D](evidence/runtime/public/empresa--desktop--1440x900.png) · [M](evidence/runtime/public/empresa--mobile--390x844.png) |
| `/privacidad` | Render inicial | [D](evidence/runtime/public/privacidad--desktop--1440x900.png) · [M](evidence/runtime/public/privacidad--mobile--390x844.png) |
| `/terminos` | Render inicial | [D](evidence/runtime/public/terminos--desktop--1440x900.png) · [M](evidence/runtime/public/terminos--mobile--390x844.png) |
| `/contacto` | Render inicial | [D](evidence/runtime/public/contacto--desktop--1440x900.png) · [M](evidence/runtime/public/contacto--mobile--390x844.png) |
| `/eliminar-datos` | Render inicial | [D](evidence/runtime/public/eliminar-datos--desktop--1440x900.png) · [M](evidence/runtime/public/eliminar-datos--mobile--390x844.png) |
| `/cuenta-eliminada` | Éxito irreversible visible por acceso directo | [D](evidence/runtime/public/cuenta-eliminada--desktop--1440x900.png) · [M](evidence/runtime/public/cuenta-eliminada--mobile--390x844.png) |
| `/estado` | Render inicial de contenido manual | [D](evidence/runtime/public/estado--desktop--1440x900.png) · [M](evidence/runtime/public/estado--mobile--390x844.png) |

No se observaron fallas de carga inicial en consola, página ni solicitudes seguras en este conjunto. Esto no cubre acciones, tokens, mutaciones, autenticación ni estados posteriores.

## Especificaciones Playwright

Las 12 especificaciones siguientes están presentes, pero cada caso está marcado `test.fixme` y no constituye evidencia de funcionamiento:

| Grupo | Archivo |
|---|---|
| Recorrido | `tests/e2e/recorridos/01-registro-rapido.spec.ts` |
| Recorrido | `tests/e2e/recorridos/02-crear-cuenta.spec.ts` |
| Recorrido | `tests/e2e/recorridos/03-dinero-libre.spec.ts` |
| Recorrido | `tests/e2e/recorridos/04-registrar-deuda.spec.ts` |
| Recorrido | `tests/e2e/recorridos/05-registrar-recurrente.spec.ts` |
| Recorrido | `tests/e2e/recorridos/06-conectar-buzon.spec.ts` |
| Recorrido | `tests/e2e/recorridos/07-crear-presupuesto.spec.ts` |
| Recorrido | `tests/e2e/recorridos/08-primer-descubrimiento.spec.ts` |
| Irreversible | `tests/e2e/irreversibles/cerrar-deuda.spec.ts` |
| Irreversible | `tests/e2e/irreversibles/eliminar-y-restaurar-movimiento.spec.ts` |
| Irreversible | `tests/e2e/irreversibles/exportar-y-eliminar-cuenta.spec.ts` |
| Irreversible | `tests/e2e/irreversibles/olvidar-aprendizaje.spec.ts` |

Evidencia: `tests/e2e/**/*.spec.ts:4-5` según archivo; los 12 resultados de búsqueda corresponden a `test.fixme`.

## Lista de omisiones silenciosas

- [x] Se reconciliaron 53 URL visuales con 54 módulos de página.
- [x] Se explicó la duplicidad de módulo en `/movimientos/[id]`.
- [x] Se enumeraron individualmente las 14 URL públicas/auth, incluida `/`.
- [x] Se enumeraron individualmente las 39 URL autenticadas.
- [x] Se identificaron las 11 URL dinámicas.
- [x] Se identificaron los cinco placeholders y su componente común.
- [x] Se marcó `/baja` como tokenizada y omitida en runtime.
- [x] Se marcó `/` como redirección/no visual.
- [x] Se registraron las 14 destinaciones de navegación y su exposición móvil.
- [x] Se cubrieron todas las familias de acciones consecuenciales requeridas.
- [x] Se distinguió `Live público D/M` de `Estático autenticado`.
- [x] Se dejó explícito que no se hizo clic en todos los botones autenticados.
- [x] Se dejó explícito que 12 archivos `test.fixme` no prueban recorridos.
- [x] Se preservó `evidence/`; ninguna captura fue movida o duplicada.
- [x] No se usó `/estado` como evidencia de salud en tiempo real.
