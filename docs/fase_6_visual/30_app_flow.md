# 30 - App Flow

**Fase:** 6 - Visual  
**Estado:** V1  
**Ultima actualizacion:** 5 de junio, 2026  
**Inputs:** Doc 14 (flujos usuario), Doc 17 (dashboard UX), Doc 13 (onboarding), Doc 18 (mapa pantallas)

---

## 1. Propósito

Este documento define el mapa completo de pantallas de Manzana, cómo se navega entre ellas, qué estados tiene cada una, qué eventos disparan transiciones, desde dónde puede llegar el usuario y qué condiciones bifurcan el flujo.

Es la fuente de verdad para arquitectura de navegación e implementación del router.

---

## 2. Inventario completo de pantallas

### 2.1 Autenticación y acceso

| ID | Pantalla | Descripción |
|---|---|---|
| `AUTH_SPLASH` | Splash / loading inicial | Primera pantalla al abrir la app. Logo + loading. |
| `AUTH_LOGIN` | Login / inicio de sesión | Ingreso con número de WhatsApp o email. |
| `AUTH_VERIFY` | Verificación OTP | Código de verificación enviado por WhatsApp o SMS. |
| `AUTH_SESSION_EXPIRED` | Sesión expirada | Overlay/pantalla cuando la sesión vence con datos abiertos. |

### 2.2 Onboarding

| ID | Pantalla | Descripción |
|---|---|---|
| `ONBOARDING_WELCOME` | Bienvenida | Primera pantalla post-login para usuario nuevo. |
| `ONBOARDING_WHATSAPP` | Conectar WhatsApp | Instrucciones para guardar el número de Manzana. |
| `ONBOARDING_FIRST_MOVE` | Primer movimiento | Invitación a registrar el primer movimiento. |
| `ONBOARDING_EMAIL_OPT` | Conectar email (opcional) | Invitación a conectar Gmail. Completamente opcional. |
| `ONBOARDING_COMPLETE` | Onboarding completado | Confirmación + acceso al Dashboard. |

### 2.3 Dashboard principal

| ID | Pantalla | Descripción |
|---|---|---|
| `HOME` | Home | Estado financiero actual, pendientes destacados, descubrimiento. |
| `MOVEMENTS` | Movimientos | Historial completo de movimientos con filtros. |
| `MOVEMENT_DETAIL` | Detalle de movimiento | Vista completa de un movimiento: fuente, estado, impacto, acciones. |
| `MOVEMENT_NEW` | Nuevo movimiento | Modal/drawer para registrar movimiento manual. |
| `MOVEMENT_EDIT` | Editar movimiento | Modal/drawer para corregir movimiento existente. |
| `PENDING` | Pendientes | Bandeja de detecciones pendientes de confirmación. |
| `PENDING_DETAIL` | Detalle de pendiente | Vista completa de un ítem pendiente con acciones de resolución. |
| `MY_MONEY` | Mi Dinero | Desglose de cuentas, cajas, dinero libre y compromisos. |
| `DEBTS` | Deudas | Lista de deudas activas y finalizadas. |
| `DEBT_DETAIL` | Detalle de deuda | Vista de una deuda: progreso, pagos, historial. |
| `UPCOMING` | Pagos que vienen | Lista de recurrentes y cuotas de deuda activas, sugeridas o vencidas. |
| `UPCOMING_DETAIL` | Detalle pago que viene | Vista de un pago: monto, fecha, estado, historial. |
| `DISCOVERIES` | Descubrimientos | Lista de insights con evidencia. |
| `DISCOVERY_DETAIL` | Detalle descubrimiento | Vista completa de un insight: evidencia, movimientos relacionados. |
| `SEARCH` | Búsqueda natural | Input + resultados + respuestas read-only. |
| `SETTINGS` | Configuración | Privacidad, recordatorios, email, datos. |

### 2.4 Modales y drawers (no pantallas propias en mobile)

| ID | Tipo | Descripción |
|---|---|---|
| `MODAL_CONFIRM` | Modal | Confirmación de acción (genérico). |
| `MODAL_RISK` | Modal | Confirmación de acción destructiva o sensible. |
| `MODAL_DETAIL_QUICK` | Modal | Detalle rápido de movimiento/pendiente sin navegar. |
| `DRAWER_MOVEMENT_NEW` | Drawer (mobile) | Nuevo movimiento en mobile. |
| `DRAWER_MOVEMENT_EDIT` | Drawer (mobile) | Editar movimiento en mobile. |
| `DRAWER_FILTERS` | Drawer (mobile) | Filtros de movimientos en mobile. |
| `DRAWER_MORE` | Drawer (mobile) | Menú "Más" del bottom nav. |
| `DRAWER_PENDING_DETAIL` | Drawer (mobile) | Detalle de pendiente en mobile. |

---

## 3. Mapa de navegación global

### 3.1 Desktop — Sidebar siempre visible

```
┌────────────────────────────────────────────────────────────────┐
│ SIDEBAR (240px fija)          │  TOPBAR (64px)                 │
│                               │  [Título pantalla] [Búsqueda]  │
│ [Logo Manzana]                ├────────────────────────────────┤
│                               │                                │
│ → Home                        │  CONTENIDO PRINCIPAL           │
│ → Movimientos                 │  (max-width segun pantalla)    │
│ → Pendientes [badge]          │                                │
│ → Mi Dinero                   │                                │
│ → Deudas                      │                                │
│ → Pagos que vienen            │                                │
│ → Descubrimientos             │                                │
│ ─────────────────             │                                │
│ → Configuración               │                                │
│                               │                                │
│ [Avatar / perfil]             │                                │
└────────────────────────────────────────────────────────────────┘
```

Reglas:
- Sidebar colapsa a 64px si el viewport < 1280px (solo íconos + tooltips)
- Sidebar nunca desaparece en desktop (≥ 1024px)
- Item activo: indicador 3px izquierda + fondo brand-subtle
- Pendientes siempre muestra badge si hay ítems pendientes

### 3.2 Mobile — Bottom nav + drawer "Más"

```
┌──────────────────────────────────────┐
│ TOPBAR (56px)                        │
│ [← Atrás] [Título]  [🔍] [•••]      │
├──────────────────────────────────────┤
│                                      │
│  CONTENIDO DE PANTALLA               │
│  (scroll vertical)                   │
│                                      │
├──────────────────────────────────────┤
│ Home | Movm. | Pend. | MiDin. | Más │  ← bottom nav 56px
└──────────────────────────────────────┘
```

Drawer "Más" (al tocar "Más"):
```
┌──────────────────────────────────────┐
│ ─────── (handle)                     │
│ Deudas                               │
│ Pagos que vienen                     │
│ Descubrimientos                      │
│ Configuración                        │
└──────────────────────────────────────┘
```

Reglas mobile:
- Máximo 5 ítems en bottom nav: Home, Movimientos, Pendientes, Mi Dinero, Más
- "Más" muestra badge si alguna pantalla dentro tiene notificación pendiente
- Topbar muestra botón "← Atrás" al navegar a sub-pantalla (detalle, formulario)
- Search es icono en topbar que lleva a `SEARCH`
- Nuevo movimiento: FAB (floating action button) `+` en pantallas relevantes (Home, Movimientos)

---

## 4. Estados del sistema por pantalla

### 4.1 HOME

| Estado | Qué se muestra |
|---|---|
| **Loading** | Skeleton de: Display (dinero libre), 2 filas de movimientos, 1 card de pendiente, 1 card de descubrimiento |
| **Empty (sin datos)** | CTA "Registrar movimiento", botón secundario "Abrir WhatsApp", botón terciario "Conectar email". Sin métricas, sin S/0 |
| **Temprano (1–4 movimientos)** | Últimos movimientos + mensaje "Aprendiendo tus gastos. Con más registros veré patrones." |
| **Funcional** | Dinero libre (si hay saldo), tarjeta de pendiente si hay, descubrimiento destacado, próximo compromiso, movimientos recientes |
| **Recalculando** | Banner informativo: "Actualizando tus resúmenes…" + spinner pequeño + datos anteriores visibles como referencia |
| **Error** | Banner de error: "No pude actualizar ahora. Tus datos siguen guardados." + botón Reintentar |
| **Modo discreto** | Montos reemplazados por `•••`. Texto de compromiso: "Tienes un compromiso próximo." Card de pendiente: "Tienes algo por revisar." |

### 4.2 MOVEMENTS

| Estado | Qué se muestra |
|---|---|
| **Loading** | Skeleton de 6 filas de movimiento |
| **Empty** | "Cuando registres algo, aparecerá aquí." + CTA Nuevo movimiento |
| **Sin resultados (filtros)** | "No encontré movimientos con esos filtros." + botón Limpiar filtros |
| **Funcional** | Lista de movimientos con filtros activos visibles, badge de contador activo |
| **Error** | Banner inline: "No pude cargar movimientos. [Reintentar]" |
| **Modo discreto** | Montos en `•••` en todas las filas |

### 4.3 MOVEMENT_DETAIL

| Estado | Qué se muestra |
|---|---|
| **Loading** | Skeleton del detalle completo |
| **Funcional (confirmado)** | Todos los campos + fuente + estado + acciones Editar/Borrar/Por qué |
| **Pendiente de corrección** | Badge amarillo "Por corregir" + campo resaltado con duda + sugerencia de corrección |
| **Corregido** | Badge info "Corregido" + historial de cambio |
| **Error al cargar** | "No pude cargar el detalle. [Reintentar]" |
| **Modo discreto** | Monto visible (dashboard autenticado), pero CTA de compartir deshabilitado |

### 4.4 MOVEMENT_NEW / MOVEMENT_EDIT (modal/drawer)

| Estado | Qué se muestra |
|---|---|
| **Default** | Campos del formulario según tipo seleccionado |
| **Cargando campos** | Skeleton breve mientras se cargan sugerencias de categoría/cuenta |
| **Validación error** | Campo en rojo con mensaje de error debajo |
| **Advertencia duplicado** | Banner warning: "Este movimiento parece similar a uno del 14 de mayo. [Ver]" |
| **Guardando** | Botón en loading, campos bloqueados |
| **Éxito** | Modal/drawer cierra, toast success "Movimiento guardado." |
| **Error al guardar** | Toast error: "No pude guardar. Intenta de nuevo." Campos siguen disponibles |

### 4.5 PENDING

| Estado | Qué se muestra |
|---|---|
| **Loading** | Skeleton de 3 filas de pendiente |
| **Empty** | "No tienes nada por revisar." + link "Volver a Home" |
| **Funcional** | Lista de pendientes agrupados por tipo. Badge de conteo en título |
| **Batch activo** | Sección "N similares" con botón "Revisar en grupo" |
| **Error** | Banner inline de error + Reintentar |
| **Modo discreto** | Pendiente email: "Tienes un movimiento por revisar." Sin monto ni comercio |

### 4.6 MY_MONEY

| Estado | Qué se muestra |
|---|---|
| **Loading** | Skeleton del desglose completo |
| **Sin cuentas** | "Puedo calcular tu dinero libre cuando tenga al menos un saldo." + CTA "Agregar cuenta o saldo" |
| **Parcial (sin cajas)** | Muestra cuentas y dinero libre. Cajas: "No tienes cajas configuradas." + CTA opcional |
| **Funcional** | Desglose completo: total → libre en cuentas → dinero libre. Lista de cuentas y cajas |
| **Recalculando** | Spinner pequeño junto al monto principal + texto "Actualizando…" |
| **Error** | Banner: "No pude actualizar. Tus datos anteriores siguen guardados." |
| **Modo discreto** | Todos los montos en `•••` |

### 4.7 DEBTS

| Estado | Qué se muestra |
|---|---|
| **Loading** | Skeleton de 2 tarjetas de deuda |
| **Empty** | "No tienes deudas registradas. Puedes registrar una deuda si quieres empezar por ahí." + CTA opcional |
| **Funcional** | Resumen (debo / me deben / neto), lista de deudas activas, sección de finalizadas |
| **Error** | Banner inline + Reintentar |
| **Modo discreto** | Montos en `•••`. Nombre de persona/entidad visible solo si no es sensible |

### 4.8 UPCOMING

| Estado | Qué se muestra |
|---|---|
| **Loading** | Skeleton de 3 tarjetas |
| **Empty** | "No tienes pagos que vienen registrados." + CTA "Agregar pago" |
| **Funcional** | Activos + sugeridos (sección separada) + vencidos (sección separada) |
| **Error** | Banner inline + Reintentar |
| **Modo discreto** | Montos en `•••` |

### 4.9 DISCOVERIES

| Estado | Qué se muestra |
|---|---|
| **Loading** | Skeleton de 2 cards |
| **Sin datos suficientes** | "Todavía no hay datos suficientes para notar cambios útiles. Con unos movimientos más, veré algo con sentido." |
| **Funcional** | Lista de insights recientes + sección de actualizados + sección de guardados |
| **Error** | Banner inline + Reintentar |
| **Modo discreto** | Montos en `•••`. Copy del insight sin monto ("Tu gasto en esta categoría cambió.") |

### 4.10 SEARCH

| Estado | Qué se muestra |
|---|---|
| **Inicial** | Input con placeholder + sugerencias de búsquedas recientes (si aplica) |
| **Escribiendo** | Input activo, sin resultados todavía |
| **Cargando resultados** | Spinner en el panel de resultados |
| **Con resultados** | Respuesta principal + lista de movimientos relacionados + CTA de navegación |
| **Sin resultados** | "No encontré movimientos sobre eso." + sugerencia de pendiente si existe |
| **Intento de acción** | "Para [acción], ábrelo y confirma. [Ver movimiento]" — no ejecuta acción |
| **Error IA** | "No pude procesar esa búsqueda ahora. Puedes filtrar los movimientos manualmente." |

### 4.11 SETTINGS

| Estado | Qué se muestra |
|---|---|
| **Loading** | Skeleton de las secciones |
| **Funcional** | Secciones: Privacidad, Recordatorios, Email, Datos y memoria |
| **Email conectado** | Badge "Conectado" + botón "Desconectar" |
| **Email no conectado** | CTA "Conectar Gmail" |
| **Modo discreto activo** | Toggle encendido + descripción de qué está activo |
| **Guardando preferencia** | Spinner en el toggle afectado, sin bloquear el resto |
| **Error al guardar** | Toast error debajo del campo afectado |

---

## 5. Eventos que disparan transiciones

### 5.1 Acciones del usuario (UI events)

| Evento | Origen | Destino |
|---|---|---|
| Tap en ítem del sidebar / bottom nav | Cualquier pantalla | Pantalla correspondiente |
| Tap en "Nuevo movimiento" o FAB "+" | Home, Movements | MOVEMENT_NEW modal/drawer |
| Tap en fila de movimiento | MOVEMENTS | MOVEMENT_DETAIL |
| Tap en "Editar" en detalle | MOVEMENT_DETAIL | MOVEMENT_EDIT modal/drawer |
| Tap en "Borrar" en detalle | MOVEMENT_DETAIL | MODAL_RISK → si confirma, elimina y regresa a MOVEMENTS |
| Tap en fila de pendiente | PENDING | PENDING_DETAIL drawer/modal |
| Tap en "Confirmar" en pendiente | PENDING, PENDING_DETAIL | Cierra drawer + toast success + recarga lista |
| Tap en "Rechazar" en pendiente | PENDING, PENDING_DETAIL | Cierra drawer + toast info + elimina fila |
| Tap en card de descubrimiento | HOME, DISCOVERIES | DISCOVERY_DETAIL |
| Tap en "Ver movimientos" en discovery | DISCOVERY_DETAIL | MOVEMENTS (pre-filtrado) |
| Tap en fila de deuda | DEBTS | DEBT_DETAIL |
| Tap en "Registrar pago" | DEBTS, DEBT_DETAIL | MOVEMENT_NEW (pre-cargado tipo pago_deuda) |
| Tap en "Registrar pago/cobro" de cuota | UPCOMING | DEBTS con deuda/cuota validada + modal de pago Core |
| Tap en "Ver deuda" de cuota | UPCOMING | DEBTS con DEBT_DETAIL especifico |
| Tap en "Ver cuota/cobro" de aviso | HOME | DEBTS con deuda/cuota especifica validada |
| Tap en fila de pago que viene | UPCOMING | UPCOMING_DETAIL |
| Tap en "Marcar pagado" | UPCOMING, UPCOMING_DETAIL | MODAL_CONFIRM → si confirma, actualiza estado |
| Tap en búsqueda (topbar o nav) | Cualquier pantalla | SEARCH |
| Submit búsqueda | SEARCH | SEARCH (actualiza resultados) |
| Tap en resultado de búsqueda | SEARCH | Pantalla correspondiente |
| Tap en "Más" del bottom nav | Mobile | DRAWER_MORE |
| Tap en ítem de DRAWER_MORE | DRAWER_MORE | Pantalla correspondiente + cierra drawer |
| Swipe-down en drawer | Mobile con drawer abierto | Cierra drawer |
| Tap en overlay de modal | Desktop con modal abierto | Cierra modal (excepto modal de riesgo) |
| Tap en "Cancelar" | Cualquier modal/drawer | Cierra sin guardar |
| Presionar Escape | Desktop con modal/drawer | Cierra modal/drawer |
| Tap en toggle de modo discreto | SETTINGS | Aplica modo + toast "Modo discreto activado" |
| Tap en toggle "Pagos que vienen" | SETTINGS | Guarda preferencia Dashboard + retira/restaura avisos recurrentes |
| Tap en toggle "Cuotas de deuda" | SETTINGS | Guarda preferencia Dashboard + retira/restaura avisos `debt_due` |
| Tap en "Conectar Gmail" | SETTINGS | OAuth flow externo + regresa a SETTINGS |
| Tap en "Desconectar email" | SETTINGS | MODAL_CONFIRM → si confirma, desconecta |

### 5.2 Respuestas del sistema (API / async events)

| Evento | Pantalla afectada | Resultado |
|---|---|---|
| API success (guardar movimiento) | MOVEMENT_NEW/EDIT | Cierra modal + toast success + recarga HOME y MOVEMENTS |
| API error (guardar movimiento) | MOVEMENT_NEW/EDIT | Toast error + modal/drawer permanece abierto |
| API success (confirmar pendiente) | PENDING/PENDING_DETAIL | Cierra ítem + recarga lista + actualiza badge |
| API error (confirmar pendiente) | PENDING/PENDING_DETAIL | Toast error |
| API timeout (cualquier operación) | Cualquier pantalla activa | Toast warning "Tardó más de lo esperado. [Reintentar]" |
| Recálculo completado post-corrección | HOME, MY_MONEY, MOVEMENTS | Actualiza valores + dismiss banner "Recalculando" |
| Recálculo iniciado | HOME, MY_MONEY | Muestra banner "Actualizando tus resúmenes…" |
| Error de servidor 5xx | Cualquier pantalla | Toast error genérico + datos anteriores se mantienen |
| Error de validación 4xx | MOVEMENT_NEW/EDIT | Highlight del campo con error + mensaje inline |
| Nuevo pendiente creado (background) | Cualquier pantalla | Badge de Pendientes +1 (sin interrumpir flujo actual) |
| Cuota abierta dentro del horizonte | HOME | Un aviso `debt_due` para la cuota mas antigua de cada deuda |

### 5.3 Push notifications y deep links

| Tipo de entrada | Pantalla destino | Condición |
|---|---|---|
| Push: "Tienes un pendiente" | PENDING | Sesión activa → directo; sesión expirada → AUTH_LOGIN → PENDING |
| Push: "Manzana notó algo" | DISCOVERIES | Idem |
| Push: "Tu pago de internet vence pronto" | UPCOMING_DETAIL (específico) | Idem |
| WhatsApp deep link | HOME | Siempre a HOME, nunca directamente a sub-sección sensible |
| Email link (confirmar pendiente) | PENDING_DETAIL (específico) | Autenticación requerida si no hay sesión |
| Link directo / bookmark | Pantalla correspondiente | Autenticación requerida |
| Regreso post-inactividad | Última pantalla activa | Sesión válida → continúa; sesión expirada → AUTH_SESSION_EXPIRED overlay |

---

## 6. Entry points

### 6.1 Flujos de entrada principales

```
Acceso directo / bookmark
    └─ sesión válida → HOME
    └─ sin sesión → AUTH_LOGIN → onboarding si nuevo → HOME

Notificación push
    └─ sesión válida → pantalla destino
    └─ sin sesión → AUTH_LOGIN → pantalla destino

WhatsApp deep link (link compartido desde chat)
    └─ sesión válida → HOME
    └─ sin sesión → AUTH_LOGIN → HOME

Email link de confirmación de pendiente
    └─ sesión válida → PENDING_DETAIL del ítem
    └─ sin sesión → AUTH_LOGIN → PENDING_DETAIL del ítem

Re-apertura de app tras inactividad
    └─ sesión válida (< 24h) → última pantalla activa
    └─ sesión expirada → overlay AUTH_SESSION_EXPIRED
```

---

## 7. Decisiones y bifurcaciones

```
¿Tiene sesión activa?
├─ NO → AUTH_LOGIN
│       └─ ¿Primera vez? → ONBOARDING_WELCOME
│       └─ Ya registrado → HOME
└─ SÍ → continúa navegación normal
         └─ ¿Sesión expiró durante uso?
            └─ SÍ → Overlay AUTH_SESSION_EXPIRED (oculta datos, no rompe estado)
            └─ NO → continúa

¿Es primera vez en HOME?
├─ SÍ y sin movimientos → Estado Empty con 3 CTAs
└─ NO o con movimientos → Estado funcional o temprano

¿Tiene datos suficientes para dinero libre?
├─ SÍ (hay cuentas con saldo) → Muestra Display con monto
└─ NO → Omite sección dinero libre de HOME, muestra placeholder en MY_MONEY

¿Hay pendientes activos?
├─ SÍ → Badge visible en Pendientes (sidebar, bottom nav)
└─ NO → Sin badge

¿Modo discreto activo?
├─ SÍ → Aplica enmascarado en montos, copy discreto en cards proactivas
└─ NO → Muestra datos completos

¿Hay recálculo en proceso?
├─ SÍ → Banner "Actualizando…" en HOME y MY_MONEY. Datos anteriores visibles.
└─ NO → Datos definitivos normales

¿El usuario es debt-first? (solo usa Deudas)
├─ SÍ → HOME puede promover Deudas como primer card o acción sugerida
└─ NO → HOME normal

¿La acción es destructiva o sensible?
├─ SÍ (borrar, ajustar, cerrar deuda) → MODAL_RISK con contexto completo
└─ NO → MODAL_CONFIRM simple o ejecución directa si no requiere confirmación

¿El usuario intenta acción de escritura en SEARCH?
├─ SÍ → Mostrar CTA hacia flujo estructurado. No ejecutar.
└─ NO → Responder inline con datos read-only

¿Ventana de WhatsApp activa en el momento del deep link?
├─ Siempre lleva a HOME Dashboard; WhatsApp es canal separado
└─ No hay estado compartido de sesión entre canales

¿Email conectado?
├─ SÍ → Email Adapter activo; pendientes de email aparecen en PENDING
└─ NO → PENDING solo muestra pendientes de WhatsApp/sistema; sin email items
```

---

## 8. Diagrama de navegación simplificado (flujo principal)

```
[AUTH_SPLASH]
    │
    ├─ sin sesión ──→ [AUTH_LOGIN] ──→ nuevo: [ONBOARDING_WELCOME → ... → HOME]
    │                               └→ existente: [HOME]
    │
    └─ con sesión ──→ [HOME]

[HOME]
    ├─ Movimientos ──────────────────────→ [MOVEMENTS]
    │                                          ├─ fila ──→ [MOVEMENT_DETAIL]
    │                                          │               ├─ editar ──→ [MOVEMENT_EDIT]
    │                                          │               └─ borrar ──→ [MODAL_RISK]
    │                                          └─ nuevo ──→ [MOVEMENT_NEW]
    │
    ├─ Pendientes ───────────────────────→ [PENDING]
    │                                          └─ ítem ──→ [PENDING_DETAIL]
    │
    ├─ Mi Dinero ────────────────────────→ [MY_MONEY]
    │
    ├─ Deudas ───────────────────────────→ [DEBTS]
    │                                          └─ ítem ──→ [DEBT_DETAIL]
    │                                                          └─ pago ──→ [MOVEMENT_NEW]
    │
    ├─ Pagos que vienen ─────────────────→ [UPCOMING]
    │                                          └─ ítem ──→ [UPCOMING_DETAIL]
    │
    ├─ Descubrimientos ──────────────────→ [DISCOVERIES]
    │                                          └─ ítem ──→ [DISCOVERY_DETAIL]
    │
    ├─ Búsqueda ─────────────────────────→ [SEARCH]
    │                                          └─ resultado ──→ [pantalla destino]
    │
    └─ Configuración ────────────────────→ [SETTINGS]
```

---

## 9. Reglas de navegación

- No existe un botón "Atrás" de navegador-estilo en desktop. La navegación es por sidebar.
- En mobile, el botón "←" del topbar regresa al contexto anterior (stack de navegación).
- Los modales/drawers son contextuales — no cambian la pantalla de fondo.
- El estado de los filtros de MOVEMENTS se conserva durante la sesión.
- SEARCH no tiene historial de navegación propio — es una capa sobre la pantalla actual.
- Al confirmar o rechazar un pendiente, el usuario regresa a la lista de PENDING (no a HOME).
- Al guardar un movimiento nuevo, el modal/drawer cierra y la pantalla de fondo se recarga.
- Las notificaciones push no interrumpen un modal/drawer abierto. Actualizan badges silenciosamente.

---

## 10. Criterios de aceptación

- Cada pantalla tiene ID único, descripción y estados definidos (loading, empty, error, success, discreto).
- Cada evento de UI que dispara transición está documentado con origen y destino.
- Las respuestas de API success y error tienen comportamiento definido por pantalla.
- Los 4 entry points externos (push, WhatsApp deeplink, email link, directo) tienen flujo documentado.
- Todas las bifurcaciones condicionantes están listadas con sus dos caminos.
- El mapa de navegación cubre desktop (sidebar) y mobile (bottom nav + drawers).
- Ninguna pantalla queda sin estado de carga y estado vacío definidos.
- Modo discreto está contemplado en todas las pantallas con datos financieros.

---

*Fase 6 Visual - Documento 30 - V1*
