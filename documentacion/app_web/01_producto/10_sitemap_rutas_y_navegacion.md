# 10 — Sitemap, rutas y navegación

**Bloque:** 01 — Producto
**Estado:** V1 (reescritura)
**Fecha:** 25 de julio de 2026
**Depende de:** `07_alcance_web_v1.md`, `09_modelo_mental_dinero.md`
**Documentos que dependen de este:** `12_arquitectura_app_web.md`, `16_design_system_web.md`, §8 de todos los módulos
**Fuentes:** `docs/fase_6_visual/30_app_flow.md` (inventario de pantallas y estados, reutilizado), `docs/fase_3_producto/17_dashboard_ux.md` (navegación, fusionado), `docs/fase_3_producto/18_wireframes_prototipo.md`

---

## 1. El problema que este documento resuelve

Hoy la aplicación autenticada completa vive en `src/app/page.tsx` (23 líneas)
que renderiza `<DashboardApp />`, un router manual de 263 líneas que cambia
de pantalla leyendo `?view=` del query string. `src/app/(dashboard)/`
contiene únicamente un `.gitkeep`.

Las consecuencias son concretas y todas de primer orden:

- No hay URLs por pantalla. Todo es `/?view=movements`.
- El botón "atrás" del navegador no funciona como el usuario espera, porque
  la navegación usa `router.replace(..., { scroll: false })`.
- No se puede compartir ni marcar como favorito el enlace a una sección.
- No hay code-splitting: las nueve pantallas (más de 13.000 líneas) se
  descargan juntas aunque el usuario solo abra el Home.
- No existen `error.tsx`, `loading.tsx` ni `not-found.tsx` en ninguna ruta.

El documento fuente original contribuyó a esto. `docs/fase_6_visual/30_app_flow.md`
§9 establece literalmente:

> "No existe un botón 'Atrás' de navegador-estilo en desktop. La navegación
> es por sidebar."

Esa regla es válida para una aplicación móvil nativa. Para una aplicación
web es un error: el historial del navegador no es una función opcional que
el producto decide ofrecer, es parte del contrato de la plataforma. **Esa
regla queda derogada.**

## 2. Principios de navegación de la app web

1. **Cada pantalla tiene una URL propia, legible y estable.** Si el usuario
   la copia y la pega en otra pestaña, llega al mismo sitio.
2. **El historial del navegador funciona.** Atrás y adelante hacen lo que el
   usuario espera, en escritorio y en móvil.
3. **El estado que importa vive en la URL.** Filtros activos, página actual,
   término de búsqueda, pestaña seleccionada y detalle abierto son
   compartibles y sobreviven a un refresco.
4. **El estado efímero no vive en la URL.** Texto a medio escribir en un
   formulario, scroll, orden de una tabla sin significado semántico.
5. **Las rutas están en español**, igual que el resto de la interfaz.
6. **Ninguna ruta expone identificadores internos innecesarios** ni datos
   personales en el query string.

## 3. Mapa de rutas

### 3.1 Rutas públicas (sin sesión)

| Ruta | Pantalla | Notas |
|---|---|---|
| `/` | Solo redirección | Sin sesión, a `/entrar`. Con sesión, a `/inicio`. **No renderiza nada propio en V1**; la portada pública de venta es `V1.1` (`WEB-D151`). |
| `/entrar` | Iniciar sesión | `AUTH_LOGIN` |
| `/crear-cuenta` | Registro | |
| `/recuperar-clave` | Solicitar recuperación de contraseña | Hoy inexistente. |
| `/restablecer-clave` | Definir nueva contraseña | Con token en la URL, de un solo uso. |
| `/verificar` | Verificación de correo | Incluye reenvío. |
| `/auth/callback` | Retorno de OAuth | Hoy inexistente; requerido por Supabase. |
| `/privacidad`, `/terminos`, `/empresa`, `/contacto`, `/eliminar-datos` | Páginas legales | Ya existen. |

### 3.2 Rutas de la aplicación (con sesión)

| Ruta | Pantalla | ID heredado |
|---|---|---|
| `/inicio` | Home y resumen financiero | `HOME` |
| `/movimientos` | Listado de movimientos | `MOVEMENTS` |
| `/movimientos/[id]` | Detalle de un movimiento | `MOVEMENT_DETAIL` |
| `/movimientos/nuevo` | Registrar movimiento | `MOVEMENT_NEW` |
| `/movimientos/importar` | Importación de archivo | nuevo |
| `/pendientes` | Bandeja de pendientes | `PENDING` |
| `/pendientes/[id]` | Detalle de un pendiente | `PENDING_DETAIL` |
| `/mi-dinero` | Cuentas, cajas y desglose | `MY_MONEY` |
| `/mi-dinero/cuentas/[id]` | Detalle de cuenta | nuevo |
| `/mi-dinero/cajas/[id]` | Detalle de caja | nuevo |
| `/presupuestos` | Presupuestos, metas y límites | nuevo |
| `/presupuestos/[id]` | Detalle de presupuesto o meta | nuevo |
| `/deudas` | Listado de deudas | `DEBTS` |
| `/deudas/[id]` | Detalle de deuda | `DEBT_DETAIL` |
| `/pagos-que-vienen` | Recurrentes y compromisos | `UPCOMING` |
| `/pagos-que-vienen/[id]` | Detalle de un pago que viene | `UPCOMING_DETAIL` |
| `/descubrimientos` | Listado de descubrimientos | `DISCOVERIES` |
| `/descubrimientos/[id]` | Detalle con evidencia | `DISCOVERY_DETAIL` |
| `/reportes` | Reportes y gráficos | nuevo |
| `/proyecciones` | Proyecciones y simulación | nuevo |
| `/asistente` | Asistente conversacional | nuevo |
| `/buscar` | Búsqueda | `SEARCH` |
| `/configuracion` | Configuración (índice) | `SETTINGS` |
| `/configuracion/perfil` | Perfil y cuenta | nuevo |
| `/configuracion/privacidad` | Privacidad y modo discreto | nuevo |
| `/configuracion/recordatorios` | Preferencias de recordatorios | nuevo |
| `/configuracion/correo` | Conexión de buzones | nuevo |
| `/configuracion/memoria` | Lo que Manzana aprendió | nuevo |
| `/configuracion/datos` | Exportar y eliminar | nuevo |
| `/bienvenida` | Onboarding | `ONBOARDING_*` |

**Cambio relevante:** `/configuracion` se convierte en un índice con
subrutas propias. Hoy es un único componente de 1.740 líneas
(`settings-screen.tsx`); dividirlo en rutas hace que cada sección se cargue
sola, tenga URL propia y sea mantenible.

### 3.3 Estado en la URL

| Pantalla | Parámetros | Ejemplo |
|---|---|---|
| Movimientos | `tipo`, `categoria`, `cuenta`, `desde`, `hasta`, `estado`, `q`, `cursor`, `orden` | `/movimientos?tipo=gasto&categoria=alimentacion&desde=2026-07-01` |
| Pendientes | `origen`, `cursor` | `/pendientes?origen=correo` |
| Reportes | `periodo`, `desde`, `hasta`, `agrupar` | `/reportes?periodo=mes&agrupar=categoria` |
| Descubrimientos | `estado` | `/descubrimientos?estado=nuevos` |
| Presupuestos | `periodo` | `/presupuestos?periodo=2026-07` |
| Búsqueda | `q` | `/buscar?q=netflix` |
| Deudas | `estado` | `/deudas?estado=activas` |

Reglas: un filtro aplicado cambia la URL con `push` (entra al historial); un
cambio de página dentro del mismo filtro también. Escribir en un campo de
búsqueda usa `replace` con retardo, para no llenar el historial con cada
tecla.

## 4. Modales, paneles y su relación con las rutas

Decidir qué es una ruta y qué es un modal es la fuente de bugs de navegación
más común. La regla:

| Es una ruta propia si… | Es un modal/panel si… |
|---|---|
| Tiene contenido que el usuario querría compartir o volver a abrir | Es una acción de un solo paso sobre el contexto actual |
| Requiere carga de datos propia | Se resuelve y desaparece |
| Se puede llegar desde una notificación o un enlace externo | Depende de la pantalla que hay detrás |

| Superficie | Tratamiento |
|---|---|
| Detalle de movimiento, pendiente, deuda, pago que viene, descubrimiento | **Ruta.** En escritorio puede presentarse como panel lateral sobre el listado, pero con URL propia y navegable. |
| Registrar movimiento | **Ruta** (`/movimientos/nuevo`), presentada como modal sobre el listado en escritorio. Tener URL permite enlazarla desde el Home, desde un recordatorio o desde el asistente. |
| Editar movimiento | Modal sobre el detalle. No necesita URL propia. |
| Confirmación de riesgo (eliminar, cerrar deuda) | Modal. Nunca ruta. |
| Filtros en móvil | Panel inferior. El resultado sí modifica la URL. |
| Asistente | **Ruta** (`/asistente`) y además panel invocable desde cualquier pantalla con atajo de teclado. |

Patrón de ruta interceptada: en escritorio, abrir un detalle desde un
listado muestra un panel sin perder el listado de fondo; una carga directa
de esa misma URL muestra la pantalla completa. El detalle de implementación
vive en `12_arquitectura_app_web.md`.

## 5. Navegación en escritorio

```text
┌──────────────────────────────────────────────────────────────┐
│ BARRA LATERAL (240px)      │ CABECERA (64px)                 │
│                            │ [Título] [Buscar] [Asistente]   │
│ Manzana                    ├─────────────────────────────────┤
│                            │                                 │
│ Inicio                     │  CONTENIDO                      │
│ Movimientos                │                                 │
│ Pendientes         [3]     │                                 │
│ Mi Dinero                  │                                 │
│ Presupuestos               │                                 │
│ Deudas                     │                                 │
│ Pagos que vienen           │                                 │
│ Descubrimientos            │                                 │
│ Reportes                   │                                 │
│ ─────────────              │                                 │
│ Configuración              │                                 │
│ [Perfil]                   │                                 │
└──────────────────────────────────────────────────────────────┘
```

- La barra lateral colapsa a solo iconos por debajo de 1280px de ancho.
- Nunca desaparece por encima de 1024px.
- El elemento activo se marca con indicador lateral y fondo, **y además con
  `aria-current="page"`** — no solo con color.
- Pendientes muestra contador cuando hay elementos por revisar.
- Proyecciones y Asistente se alcanzan desde la cabecera y desde el Home; no
  ocupan lugar fijo en la barra lateral para no saturarla.

## 6. Navegación en móvil

```text
┌──────────────────────────────┐
│ [←] Título      [buscar] [⋯] │  cabecera 56px
├──────────────────────────────┤
│                              │
│  CONTENIDO                   │
│                              │
├──────────────────────────────┤
│ Inicio  Movim.  Pend.  Más   │  barra inferior 56px
└──────────────────────────────┘
```

Dentro de "Más": Mi Dinero, Presupuestos, Deudas, Pagos que vienen,
Descubrimientos, Reportes, Proyecciones, Asistente, Configuración.

- Máximo 4 elementos fijos más "Más".
- "Más" muestra contador si alguna sección interna tiene algo pendiente.
- La flecha de la cabecera usa el historial real del navegador.
- Botón flotante `+` para registrar movimiento en Inicio y Movimientos.

**Corrección respecto al corpus anterior:** la matriz de cumplimiento
señaló como P1 que "la navegación móvil no expone todas las secciones
principales". El menú "Más" debe listar **todas** las secciones restantes,
no un subconjunto.

## 7. Rutas de sistema por segmento

Cada segmento de ruta define sus propios estados. Hoy no existe ninguno.

| Archivo | Qué hace |
|---|---|
| `loading.tsx` | Esqueleto de carga por sección, no un spinner global. |
| `error.tsx` | Error recuperable, con reintento, sin perder la navegación. |
| `not-found.tsx` | Recurso inexistente, con salida clara hacia la sección padre. |
| `global-error.tsx` | Fallo total de la aplicación. Uno solo, en la raíz. |

Regla: ninguna ruta llega a producción sin `loading.tsx` y `error.tsx`
propios o heredados de un segmento superior de forma deliberada.

## 8. Puntos de entrada externos

| Origen | Destino | Sin sesión |
|---|---|---|
| Enlace directo o favorito | La ruta solicitada | `/entrar?redirigir=<ruta>` y luego la ruta original |
| Enlace desde correo de recordatorio | La ruta específica del elemento | Igual |
| Enlace de confirmación de pendiente | `/pendientes/[id]` | Igual |
| Verificación de correo | `/verificar` con token | — |
| OAuth de Gmail | `/auth/callback` → `/configuracion/correo` | — |
| Sesión expirada durante el uso | Aviso sobre la pantalla actual, sin perder el contexto | Se conserva la ruta para volver tras iniciar sesión |

El parámetro `redirigir` solo acepta rutas internas de la propia aplicación,
validadas contra la lista de rutas conocidas — nunca URLs absolutas, para
evitar redirecciones abiertas.

## 9. Reglas de navegación

- El historial del navegador funciona en toda la aplicación. **Deroga
  `docs/fase_6_visual/30_app_flow.md` §9.**
- Los filtros de un listado se conservan al volver desde un detalle, porque
  viven en la URL.
- Confirmar o descartar un pendiente devuelve al listado, no al Inicio.
- Guardar un movimiento nuevo cierra el modal y actualiza el listado de
  fondo sin recargar la página entera.
- Una notificación de fondo nunca interrumpe un formulario abierto: solo
  actualiza contadores.
- `Escape` cierra modales y paneles, excepto los de confirmación de riesgo,
  que exigen decisión explícita.
- El foco vuelve al elemento que abrió un modal cuando este se cierra.

## 10. Estados por pantalla

Los estados definidos en `docs/fase_6_visual/30_app_flow.md` §4 (carga,
vacío, temprano, funcional, recalculando, error, modo discreto) se conservan
íntegros y se especifican por módulo en la sección 12 de cada documento de
`04_modulos/`. Los estados de las pantallas nuevas (Presupuestos,
Proyecciones, Reportes, Asistente, Memoria) se definen en
`47_ciclo_de_vida_del_dato_y_estados_vacios.md`.

## 11. Criterios de aceptación

- `AC-NAV-01` — Toda pantalla listada en §3.2 responde en su propia URL y se
  puede cargar directamente. Evidencia: `TEST`. Clase: `e2e`.
- `AC-NAV-02` — El botón atrás del navegador devuelve a la pantalla anterior
  con sus filtros intactos. Evidencia: `TEST`. Clase: `e2e`.
- `AC-NAV-03` — Copiar la URL de un listado filtrado y abrirla en otra
  pestaña reproduce exactamente el mismo resultado. Evidencia: `TEST`. Clase: `e2e`.
- `AC-NAV-04` — Ninguna ruta de la aplicación usa `?view=`. Evidencia: `TEST`.
- `AC-NAV-05` — Cada segmento tiene `loading.tsx` y `error.tsx`, propios o
  heredados deliberadamente. Evidencia: `CODE`.
- `AC-NAV-06` — El menú "Más" en móvil expone todas las secciones que no
  están en la barra inferior. Evidencia: `TEST` + `USER`.
- `AC-NAV-07` — El parámetro `redirigir` rechaza cualquier destino que no sea
  una ruta interna conocida. Evidencia: `TEST`.
- `AC-NAV-08` — El elemento de navegación activo se anuncia con
  `aria-current`, no solo con color. Evidencia: `TEST`.
