# 32 - Especificación Hi-Fi pantalla por pantalla

**Fase:** 6 - Visual  
**Estado:** V1  
**Ultima actualizacion:** 5 de junio, 2026  
**Inputs:** Doc 28 (marca), Doc 29 (design system), Doc 30 (App Flow), Doc 31 (WireFlows), Doc 17 (Dashboard UX), Doc 18 (wireframes)  
**Salida relacionada:** Doc 33 (Handoff Stitch V1)

---

## 1. Propósito y principio

Este documento define exactamente cómo se ve cada pantalla de Manzana en cada estado, con los valores precisos de posición, tamaño, color, tipografía e interacción.

> Specs tan exactas que Cursor puede implementar directamente y v0/Emergent/Stitch pueden reproducir el resultado visual sin ambigüedad.

Las referencias a tokens usan los nombres definidos en Doc 29. Los IDs de pantalla provienen del App Flow (Doc 30).

---

## 2. Convenciones del documento

- `[Token]` → referencia a token de Doc 29
- `px` → valores en píxeles (mobile-first salvo que diga "desktop:")
- `→` → transición o acción
- Datos de ejemplo: siempre en español peruano, realistas

---

## 3. HOME

### 3.1 Layout general

**Mobile (< 768px):**
```
┌─────────────────────────────────────┐  ← bg: --color-bg-primary (#F9F8F6)
│ TOPBAR (56px)                        │  ← bg: --color-bg-surface-raised, border-bottom 1px --color-border-default
│ "Home"  H2/600/20px                  │  ← color: --color-text-primary
│                     [🔍] [⋯]         │  ← icon-only buttons ghost sm, icons 20px
├─────────────────────────────────────┤
│ SCROLL AREA (padding 16px h, 16px t)│
│                                     │
│  [CARD: Dinero libre]               │  ← ver sección 3.2
│  [CARD: Pendiente principal]         │  ← ver sección 3.3, si hay pendientes
│  [CARD: Descubrimiento destacado]    │  ← ver sección 3.4, si hay insight
│  [CARD: Próximo compromiso]          │  ← ver sección 3.5, si hay pago/deuda
│  [SECCIÓN: Movimientos recientes]   │  ← ver sección 3.6
│                                     │
├─────────────────────────────────────┤
│ BOTTOM NAV (56px)                    │
│ Home | Movm. | Pend.[3] | MiDin | Más │
└─────────────────────────────────────┘
```

**Desktop (≥ 1024px):**
```
┌──────────┬────────────────────────────────────────────┐
│ SIDEBAR  │ TOPBAR (64px)                              │
│ (240px)  │ "Manzana" brand left      [icons]          │
│          ├────────────────────────────────────────────┤
│ Home ←   │ SCROLL (padding 32px h, 32px t)            │
│ Movim.   │                                            │
│ Pending  │  [H1] "Hola, Juan"                         │
│ MiDin.   │  [Body] "Aquí tienes tu resumen de hoy."   │
│ Deudas   │                                            │
│ Pagos    │  ┌────────────────┐ ┌────────────────────┐ │
│ Descubr. │  │ COLUMNA 40%    │ │ COLUMNA 60%        │ │
│ ───────  │  │ Dinero libre   │ │ Movimientos        │ │
│ Config.  │  │ Pendientes     │ │ recientes          │ │
│          │  │ Descubrimiento │ │ + CTA registrar    │ │
│          │  └────────────────┘ └────────────────────┘ │
└──────────┴────────────────────────────────────────────┘
```

**Reglas de composición desktop para HOME:**
- El objetivo visual es app usable, no panel contable ni landing.
- Layout principal: dos columnas dentro de un contenedor máximo de 1220px.
- Columna izquierda: 40% / min 360px / max 480px. Contiene dinero libre, pendiente principal y descubrimiento destacado en stack vertical.
- Columna derecha: 60% / min 560px. Contiene movimientos recientes como bloque protagonista de continuidad.
- No usar una card gigante de dinero libre atravesando todo el ancho.
- No usar una columna derecha con cards pequeñas flotantes si deja mucho vacío inferior.
- La búsqueda global no debe competir con el estado financiero; en Home desktop puede vivir como icono o input discreto en topbar, max-width 320px.
- El título de pantalla no debe ser solo "Home" como pieza principal. Usar saludo humano con nombre si está disponible: "Hola, Juan". Si no hay nombre: "Tu resumen de hoy".
- La marca no debe mostrar subtítulos en inglés. Prohibido "Financial Tranquility" en UI visible.
- Evitar lenguaje contable: usar "Nuevo movimiento" o "Registrar movimiento", no "Añadir transacción".

### 3.2 Card: Dinero libre

**Mobile:**
- Width: 100%, border-radius: `--radius-lg` (12px)
- Background: `--color-bg-surface` (#F0EFEA)
- Border: 1px `--color-border-default` (#E5E4E0)
- Shadow: `--shadow-sm`
- Padding: 16px

**Contenido (estado funcional):**
```
Label:  "Dinero libre"          → font: --font-family-heading/DM Sans, 17px/500, color: --color-text-secondary (#5A5F5C)
Monto:  "S/220"                 → font: Inter, 32px/700 (Display), color: --color-text-primary, tabular-nums
Sub:    "De S/800 en cuentas"   → font: Inter, 12px/400 (Caption), color: --color-text-muted (#8A8F8B)
────────────────────────────────────── (divider 1px --color-border-default, margin 12px v)
CTA:    "Ver desglose →"        → Button ghost sm, DM Sans 14px/500, color: --color-brand-primary
```

**Estado recalculando:**
- Monto: sustituido por spinner 24px centrado + texto Caption "Actualizando…" color `--color-text-muted`
- Fondo del bloque del monto: `--color-bg-discrete`

**Estado sin datos (sin cuentas):**
- Card entera reemplazada por texto: Body 15px/400 color `--color-text-secondary` "Agrega un saldo para calcular tu dinero disponible." + Button secondary sm "Agregar cuenta"

**Modo discreto:**
- Monto: `•••` color `--color-text-discrete`, mismo tamaño tipográfico
- Sub: "De tu balance en cuentas"

**Desktop:** width max 560px, padding 20px. Mismos valores.

### 3.3 Card: Pendiente principal

Visible solo si hay ≥ 1 pendiente activo.

```
Badge:   "3 por revisar"         → badge warning pill, Micro 11px/400
Título:  "Tienes movimientos por revisar"
                                  → Body/500/15px, color: --color-text-primary
Sub:     "Algunos emails esperan tu confirmación."
                                  → Body-small/13px, color: --color-text-secondary
CTA:     "Revisar pendientes →"  → Button secondary sm
```

Sin barra lateral. Usar badge warning, icono circular warning y background `--color-warning-subtle` con borde normal `1px solid --color-border-default`.

**Modo discreto:**
```
Título: "Tienes algo por revisar."
Sub: (omitido)
CTA: igual
```

### 3.4 Card: Descubrimiento destacado

Visible solo si hay insight activo con evidencia suficiente. Máximo 1 en HOME.

```
Label:  "Manzana notó algo"      → Caption/12px/400, color: --color-brand-primary, ícono sparkles 12px izquierda
Título: "Transporte subió S/75"  → Body/500/15px, color: --color-text-primary
Sub:    "La mayor parte fue Uber de trabajo esta semana."
                                  → Body-small/13px, color: --color-text-secondary
CTA:    "Ver movimientos"        → Button ghost sm
Dismiss: "Ignorar"               → Button ghost sm, color: --color-text-muted
```

Sin barra lateral. Usar icono `sparkles`, label brand y fondo `--color-brand-subtle` al 35-45% con borde normal `1px solid --color-border-default`.

**Modo discreto:**
```
Sub: "Hay un cambio en tu gasto de esta semana."
```

### 3.5 Card: Próximo compromiso

```
Badge:   "Vence pronto"          → badge warning (si < 5 días) o info (si ≥ 5 días)
Título:  "Cuota laptop"          → Body/500/15px, color: --color-text-primary
Monto:   "S/400 · 26 de mayo"    → Monto-sm/15px/500, color: --color-text-primary, tabular-nums
Sub:     "Vinculado a deuda activa" → Body-small/13px, color: --color-text-muted
CTA:     "Ver detalle →"         → Button ghost sm
```

**Modo discreto:**
```
Título: "Tienes un compromiso próximo."
Monto: "•••"
```

### 3.6 Sección: Movimientos recientes

Título sección: H3/17px/500 "Movimientos recientes" + link "Ver todos →" (ghost sm, alineado derecha).

Muestra máximo 3–5 filas de movimiento (componente Fila de movimiento de Doc 29 §3.10).

**Estado vacío de sección:** Caption "Aún no tienes movimientos. Registra uno →" (ghost sm link).

### 3.7 HOME — Estado completamente vacío (sin ningún dato)

```
┌───────────────────────────────────────┐
│ [Ilustración 120×120px, estilo lineal]│  ← centrada, margen-top 48px
│                                       │
│ "Empieza por una cosa"                │  ← H2/600/20px, --color-text-primary, text-center
│ "Registra un gasto, ingreso o deuda   │  ← Body/400/15px, --color-text-secondary
│  para que Manzana empiece a ordenar." │  ← max-width 280px, text-center
│                                       │
│ [Btn primary md: Registrar movimiento]│  ← full-width mobile
│ [Btn secondary md: Abrir WhatsApp]    │  ← full-width mobile
│ [Btn ghost sm: Conectar email]        │  ← centrado
└───────────────────────────────────────┘
```

Padding horizontal: 24px. Espacio entre elementos: `--space-4` (16px).

---

## 4. MOVEMENTS (Movimientos)

### 4.1 Layout

**Mobile:**
```
TOPBAR: "Movimientos" + [🔍] [+ Nuevo]
─────────────────────────────────────
FILTROS CHIPS (scroll h, padding 16px h):
[Esta semana ×] [Gastos ×] [+ Filtrar]
─────────────────────────────────────
LISTA DE MOVIMIENTOS (scroll v)
  [Fila movimiento] × N
─────────────────────────────────────
FAB "+" fijo: bottom-right, 56px circular, bg --color-brand-primary, ícono plus blanco 24px
  bottom: 72px (sobre bottom nav), right: 16px
```

**Desktop:**
```
TOPBAR DE PANTALLA: "Movimientos" H1/600/24px | [Btn primary: + Nuevo movimiento] alineado derecha
─────────────────────────────────────────────────────────────────────────────────────────────────
BARRA DE FILTROS:
[Período: Esta semana ▼] [Tipo ▼] [Categoría ▼] [Fuente ▼] [Estado ▼]  Limpiar (solo si activos)
─────────────────────────────────────────────────────────────────────────────────────────────────
LISTA DE MOVIMIENTOS (max-width 900px)
  [Fila movimiento] × N
```

### 4.2 Fila de movimiento — spec completa

```
Altura: 72px, padding: 12px 16px, border-bottom: 1px --color-border-default

[Col Ícono — 36×36px]
  Fondo: --color-brand-subtle (#D6E8DC)
  Border-radius: --radius-md (8px)
  Ícono Lucide 20px: color --color-brand-primary
  (Ejemplo: utensils para café, car para taxi, dollar-sign para ingreso)

[Col Texto — flex: 1, padding-left: 12px]
  Fila 1: "Café"  → Body/500/15px, color --color-text-primary, max-1-line ellipsis
  Fila 2: "Gasto · Alimentación"  → Caption/12px/400, color --color-text-secondary
  Fila 3: "WhatsApp · Confirmado" → Caption/12px/400, color --color-text-muted

[Col Monto + Fecha — width 80px, text-align right]
  Fila 1: "S/8"   → Monto-sm/15px/500, color --color-text-primary (gasto), tabular-nums
  Fila 2: "hoy"   → Caption/12px/400, color --color-text-muted
```

**Variaciones de color de monto:**
- Gasto: `--color-text-primary`
- Ingreso: `--color-success`
- Deuda/pago deuda: `--color-debt`
- Transferencia: `--color-info`
- Estimado: `--color-text-muted` con `~` prefijo

**Acciones (swipe en mobile, hover en desktop):**
- Mobile swipe-left: Eliminar (fondo `--color-error`, ícono trash 20px blanco)
- Mobile swipe-right: Editar (fondo `--color-info`, ícono edit 20px blanco)
- Desktop hover: mostrar botones icon-only ghost sm a la derecha (edit 16px, trash 16px)

**Modo discreto:**
- Monto: `•••` (tabular-nums mantenido para consistencia de layout)

### 4.3 MOVEMENTS — Estado vacío

```
[Ícono list 48px, color --color-text-muted, centrado]
"Cuando registres algo, aparecerá aquí."   → H2/600/20px, text-center
"Puedes registrar por WhatsApp o aquí."    → Body/400/15px, --color-text-secondary, text-center
[Btn secondary md: Nuevo movimiento]
```

### 4.4 MOVEMENTS — Sin resultados de filtros

```
[Ícono filter-x 32px, --color-text-muted]
"No encontré movimientos con esos filtros."  → H3/17px/500
[Btn ghost sm: Limpiar filtros]
```

---

## 5. MOVEMENT_DETAIL (Detalle de movimiento)

### 5.1 Layout

**Mobile (pantalla completa con scroll):**
```
TOPBAR: [← Atrás] "Detalle" [Editar btn ghost sm]
─────────────────────────────────────────────────
HEADER DEL MOVIMIENTO:
  [Ícono categoría 48×48px, --radius-lg]
  "Café"                     → H1/600/24px, --color-text-primary
  "S/8"                      → Display/32px/700, --color-text-primary, tabular-nums
  "14 de mayo de 2026"       → Caption/12px/400, --color-text-muted
─────────────────────────────────────────────────
SECCIÓN: Información
  Fila: "Tipo"        | "Gasto"           → [Label] | [Value] Body/15px
  Fila: "Categoría"   | "Alimentación"
  Fila: "Subcategoría"| "Café / Bebidas"
  Fila: "Fuente"      | [Badge fuente WhatsApp]
  Fila: "Estado"      | [Badge confirmado]
  Fila: "Cuenta"      | "Yape"
  Fila: "Confianza"   | "Alta"
  Fila: "Impacto"     | "−S/8 de Yape · −S/8 dinero libre"
─────────────────────────────────────────────────
SECCIÓN: Evidencia (colapsable, "¿Por qué?")
  "Texto original: 'gaste 8 en cafe'"     → Body-small/13px, --color-text-secondary
  "Evidencia: monto + palabra café"
  "Puedes corregirlo si no era así."
─────────────────────────────────────────────────
ACCIONES (fixed bottom o al final del scroll):
  [Btn secondary: Editar]  [Btn danger ghost: Borrar]
```

**Desktop:** Modal 640px ancho, padding 24px. Misma estructura en 2 columnas donde aplica.

### 5.2 Fila de información en detalle

```
Cada fila: height 44px, border-bottom 1px --color-border-default (salvo última)
  Col label: Body/400/15px, --color-text-secondary, width 120px
  Col valor: Body/500/15px, --color-text-primary, flex-1
```

### 5.3 Estado: Movimiento por corregir

```
Badge arriba del header: "Por corregir" → badge warning
Campo dudoso (ej. Categoría): borde completo `1px solid --color-warning`, fondo `--color-warning-subtle` (5%) y badge "Revisar"
Texto adicional: "Manzana no estaba seguro de esta categoría." → Caption/12px/400, --color-warning
CTA adicional: [Btn primary sm: Corregir ahora]
```

### 5.4 Estado: Movimiento corregido

```
Badge: "Corregido" → badge info
Sección adicional "Cambio registrado":
  "Categoría: Transporte → Transporte > Uber de trabajo"  → Body-small/13px, --color-text-muted
  "Corregido el 15 de mayo"
```

---

## 6. MOVEMENT_NEW / MOVEMENT_EDIT

### 6.1 Layout Mobile (Bottom drawer: DRAWER_MOVEMENT_NEW / DRAWER_MOVEMENT_EDIT)

```
Handle: 4×32px, --color-border-strong, centrado, margin-top 8px
Título: "Nuevo movimiento"  → H2/600/20px, padding 16px h, 12px t
Scroll (max-height 85vh):
  [Formulario dinámico]
  [Bloque de impacto]
─────────────────────────────────────────────────
ACCIONES (sticky bottom, bg --color-bg-surface-raised, padding 12px 16px, border-top 1px):
  [Btn ghost sm: Guardar y registrar otro]   ← arriba
  [Btn secondary md: Cancelar] [Btn primary md: Guardar]  ← fila, full-width split
```

### 6.2 Layout Desktop (Modal 560px)

```
Header: "Nuevo movimiento" H2/600/20px | [X cerrar 24px icon-only]
Body scroll (max-height calc(80vh - 120px)):
  [Formulario dinámico]
  [Bloque de impacto]
Footer (border-top 1px, padding 16px):
  [Btn ghost sm: Guardar y registrar otro]
  flex-end: [Btn secondary: Cancelar] [Btn primary: Guardar]
```

### 6.3 Formulario — tipo Gasto (spec completa)

```
[Select: Tipo de movimiento]
  Valor default: "Gasto"
  Ancho: 100%
  Ícono: chevron-down 16px derecha
  Options: 11 tipos canónicos

[Input monto: S/ ___]
  Label: "Monto"
  Prefijo S/: color --color-text-muted, no editable
  Placeholder: "0.00"
  Input: text-align right, Monto-sm font, tabular-nums
  Teclado: inputmode="decimal"

[Input fecha]
  Label: "Fecha"
  Default: "Hoy · 14 de mayo"
  Al tap: date picker nativo (mobile) o popover calendario (desktop)

[Select: Cuenta/caja]
  Label: "Cuenta"
  Opciones: Yape, BCP, Efectivo, + "Nueva cuenta", "No especificar"

[Select: Categoría]
  Label: "Categoría"
  Opciones: 12 categorías base + subcategorías si han sido creadas
  Loading state si IA sugiere: skeleton 200ms

[Input texto: Descripción]
  Label: "Descripción"
  Placeholder: "Ej: café antes de la oficina"
  Opcional

[Bloque de impacto]
  Fondo: --color-brand-subtle (#D6E8DC)
  Border-radius: --radius-md (8px)
  Padding: 12px
  Texto: "Sale de Yape y reduce tu dinero libre." → Body-small/13px, --color-text-secondary
  Ícono: info 14px izquierda, --color-brand-primary
```

### 6.4 Bloque de advertencia de duplicado

```
Fondo: --color-warning-subtle
Border-radius: --radius-sm
Padding: 10px 12px
Ícono: alert-triangle 16px, --color-warning
Texto: "Este movimiento parece similar a uno del 14 de mayo por S/8. ¿Ver?" → Body-small
Link: [Ver movimiento similar] → Body-small, --color-brand-primary underline
```

---

## 7. PENDING (Pendientes)

### 7.1 Layout

**Mobile:**
```
TOPBAR: "Pendientes" [badge N] + [⋯]
─────────────────────────────────────
SCROLL:
  [Sección: Por confirmar (N)]
    [Fila pendiente] × N
  [Sección: Sugeridos (N)]  ← si aplica
    [Fila pendiente sugerida] × N
```

**Desktop:**
```
TÍTULO DE PÁGINA: "Pendientes" H1 | counter "3 por revisar" Caption badge warning
[Btn ghost sm: Limpiar todos] alineado derecha (solo si hay pendientes)
─────────────────────────────────────
GRID 2 columnas (≥ 1280px) o lista (desktop < 1280px):
  [Card pendiente] × N
```

### 7.2 Fila / Card de pendiente — spec completa

```
Background: --color-warning-subtle (6% opacity sobre --color-bg-surface)
Indicador semántico: badge warning + icono circular warning
Border-radius: --radius-lg (12px)
Padding: 14px 16px
Border: 1px --color-border-default

[Badge] "Email detectado"    → badge warning pill, Micro 11px
[Body/500] "Yape S/45"       → 15px, --color-text-primary
[Body-small] "Restaurante · 14 de mayo"  → 13px, --color-text-secondary
[Caption] "No afecta tu saldo hasta que confirmes."  → 12px, --color-text-muted
─────────────────────────
[Row de acciones, gap 8px]:
  [Btn secondary sm: Confirmar]
  [Btn ghost sm: Editar]
  [Btn ghost sm: Ya lo registré]
  [Btn ghost sm, color error: Rechazar]
```

**Modo discreto:**
```
Título: "Movimiento de email"
Sub: "Fecha: 14 de mayo" (sin monto ni comercio)
Acciones: igual
```

### 7.3 PENDING — Estado vacío

```
[Ícono inbox 48px, --color-text-muted]
"No tienes nada por revisar."          → H2/600/20px
"Cuando Manzana detecte algo que necesite tu confirmación, aparecerá aquí."
                                        → Body/400/15px, --color-text-secondary, max-width 300px
[Btn ghost sm: Volver a Home]
```

---

## 8. MY_MONEY (Mi Dinero)

### 8.1 Layout completo (con datos)

**Mobile:**
```
TOPBAR: "Mi Dinero" + [⋯]
─────────────────────────────────────
CARD PRINCIPAL: Dinero libre
  "Dinero libre"              → H3/17px/500, --color-text-secondary
  "S/220"                     → Display/32px/700, --color-brand-primary, tabular-nums
  ──────────────────────── (divider 1px)
  DESGLOSE:
  "Total en cuentas  S/800"   → Body/15px/400 + Monto-sm/500, flex space-between
  "  − Cajas         S/300"   → Body-small/13px, indent 16px, color --color-text-secondary
  "  = Libre en cuentas S/500"→ Body/15px/500, color --color-text-primary
  "  − Compromisos   S/280"   → Body-small/13px, indent 16px, --color-text-secondary
  "  = Dinero libre  S/220"   → Body/15px/600, --color-brand-primary
  ──────────────────────── (divider)
  [Btn ghost sm: ¿Cómo se calcula? →]

SECCIÓN: Cuentas
  H3: "Cuentas"
  [Card cuenta]: "Yape · S/260"  → ícono Yape + nombre Body/500 + Monto-sm
  [Card cuenta]: "BCP  · S/540"

SECCIÓN: Cajas
  H3: "Cajas"
  [Card caja]: "Emergencia · S/100 (de Yape)"  → nombre + monto + cuenta padre
  [Card caja]: "Alquiler   · S/200 (de BCP)"
  [Btn ghost sm: + Nueva caja]

SECCIÓN: Compromisos próximos
  H3: "Compromisos próximos"
  [Fila]: "Cuota laptop S/400 · 26 may"  → Body/500 + Monto-sm + Caption fecha
  [Fila]: "Internet S/89 · entre 12 y 15"
```

### 8.2 Estado sin cuentas

```
[Ícono wallet 48px, --color-text-muted]
"Puedo calcular tu dinero libre cuando tenga al menos un saldo."  → H2/600/20px
"Agrega una cuenta con su saldo para empezar."  → Body/400/15px
[Btn secondary md: Agregar cuenta o saldo]
```

### 8.3 Modo discreto

Todos los montos `•••`. Labels de secciones y nombres de cuentas/cajas visibles. Desglose usa `•••` en cada valor numérico.

---

## 9. DEBTS (Deudas)

### 9.1 Layout

**Mobile:**
```
TOPBAR: "Deudas" + [+ Nueva deuda btn ghost sm]
─────────────────────────────────────
RESUMEN:
  ┌──────────────┐ ┌──────────────────┐
  │ Debo S/2,550 │ │ Me deben S/200   │
  └──────────────┘ └──────────────────┘
  "Saldo neto: debes S/2,350" → Caption, --color-debt

SECCIÓN: Deudas activas
  [Card deuda] × N

SECCIÓN: Deudas saldadas (colapsable)
  [Card deuda saldada] × N
```

### 9.2 Card de deuda — spec completa

```
Background: --color-bg-surface
Indicador semántico: badge deuda + icono circular en `--color-debt-subtle`
Border-radius: --radius-lg
Padding: 16px
Border: 1px --color-border-default

[Body/600] "Laptop en cuotas"      → --color-text-primary
[Row]:
  [Monto-sm] "S/1,200 pagado"      → --color-success, tabular-nums
  [Caption] " de S/2,400 total"    → --color-text-muted
[Barra de progreso]
  altura: 8px, full-width, border-radius --radius-full
  track: --color-progress-track
  fill: --color-progress-fill (50%) o --color-progress-low (si < 30%)
  animación: grow de 0% a valor al entrar en viewport, 500ms --ease-spring
[Caption]: "50% pagado"            → --color-text-muted
[Row]:
  [Caption]: "Próxima cuota S/400 · 26 de mayo"  → --color-text-secondary
─────────────────────────
[Row de acciones]:
  [Btn primary sm: Registrar pago]
  [Btn ghost sm: Ver detalle]
```

### 9.3 Estado vacío

```
"No tienes deudas registradas."  → H2/600/20px
"Puedes usarme solo para deudas si eso te sirve."  → Body/400/15px
[Btn secondary md: Crear deuda]
```

---

## 10. UPCOMING (Pagos que vienen)

### 10.1 Layout

```
TOPBAR: "Pagos que vienen" + [+ Agregar btn ghost sm]
─────────────────────────────────────
RESUMEN: "4 activos · S/584/mes estimado"  → Caption/12px, --color-text-muted
─────────────────────────────────────
SECCIÓN: Activos
  [Card pago] × N

SECCIÓN: Sugeridos
  [Card pago sugerido] × N  ← badge "Sugerido" + fondo warning sutil

SECCIÓN: Vencidos
  [Card pago vencido] × N   ← badge "Vencido" + fondo error sutil
```

### 10.2 Card de pago que viene — spec completa

```
Background: --color-bg-surface
Indicador semántico: badge de estado + icono circular con fondo sutil según estado
Border-radius: --radius-lg
Padding: 14px 16px
Border: 1px --color-border-default

[Row]: [Badge estado] · [Monto-sm alineado derecha]
[Body/500]: "Internet"  → --color-text-primary
[Caption]: "Entre 12 y 15 de junio"  → --color-text-secondary
────────────────────────
[Row de acciones]:
  [Btn secondary sm: Marcar pagado]
  [Btn ghost sm: Editar]
  [Btn ghost sm: Pausar]
```

**Pago sugerido extra:**
```
[Caption] "Detectado 3 meses consecutivos"  → --color-text-muted
Acciones: [Btn primary sm: Confirmar] [Btn ghost sm: Ignorar]
```

**Cuota de deuda:**
```
[Badge] "Vinculada a deuda"
[Body/500] "Cuota 1: Laptop"
[Caption] fecha de vencimiento
[Monto-sm] pendiente real de la cuota
[Btn secondary sm] "Registrar pago" o "Registrar cobro" solo en la cuota abierta mas antigua
[Btn ghost sm] "Ver deuda"
```

Reglas:
- El deep-link transporta IDs, nunca un monto confiable.
- DEBTS vuelve a leer la deuda autenticada y calcula el pendiente real.
- Una cuota posterior no muestra accion de pago mientras exista una anterior abierta.
- El modal reutiliza `POST /api/v1/debts/:id/payments` y el Core financiero.
- En mobile, bottom nav y FAB quedan ocultos mientras el modal esta abierto.

---

## 11. DISCOVERIES (Descubrimientos)

### 11.1 Layout

```
TOPBAR: "Descubrimientos"
─────────────────────────────────────
SECCIÓN: Recientes
  [Card insight] × N

SECCIÓN: Actualizados
  [Card insight badge "Actualizado"] × N

SECCIÓN: Guardados  (colapsable)
  [Card insight] × N
```

### 11.2 Card de insight — spec completa

```
Background: --color-bg-surface
Indicador semántico: icono + badge según tipo (brand, warning, success, info), sin barra lateral
Border-radius: --radius-lg
Padding: 16px
Border: 1px --color-border-default

[Caption] [Ícono 12px] "Manzana notó algo"  → --color-brand-primary o variante según tipo
[Body/500] "Transporte subió S/75 esta semana"  → --color-text-primary
[Body-small] "La mayor parte fue Uber de trabajo."  → --color-text-secondary, max 2 líneas
────────────────────────
[Row de acciones]:
  [Btn ghost sm: Ver movimientos →]
  [Btn ghost sm: Ignorar]  → color --color-text-muted
```

### 11.3 Estado sin datos suficientes

```
[Ícono sparkles 48px, --color-text-muted]
"Todavía no hay datos suficientes para notar cambios útiles."  → H2
"Con unos movimientos más, Manzana podrá mostrarte algo con más sentido."  → Body
[Btn ghost sm: Registrar movimiento →]
```

---

## 12. SEARCH (Búsqueda natural)

### 12.1 Layout Mobile (pantalla completa)

```
TOPBAR: [← Cerrar] [Input search full-width activado] [Limpiar ×]
─────────────────────────────────────
ÁREA DE RESULTADOS (scroll):
  [Estado inicial o resultados]
```

### 12.2 Layout Desktop (panel inline expandible)

```
Input en topbar → al click expande panel debajo
Panel: max-width 640px, bg --color-bg-surface-raised, shadow --shadow-lg, --radius-md. Posición fija debajo del input global, alineado al centro del topbar.
Cierre: click fuera del panel o Escape
```

### 12.3 Estado con resultados — spec

```
[H3] "Resultado rápido"
[Card resultado]:
  "Gastaste S/120 en transporte en abril."  → Body/500, --color-text-primary
  [Btn ghost sm: Ver movimientos filtrados →]

[Divider 1px --color-border-default, margin 16px v]

[H3] "Pendientes relacionados" (si aplica)
  [Fila pendiente compacta]

[H3] "Movimientos" (si hay lista)
  [Fila movimiento compacta] × N
```

### 12.4 Estado sin resultados

```
[Ícono search-x 32px, --color-text-muted]
"No encontré movimientos sobre eso."  → Body/500, --color-text-primary
"También hay 1 pendiente sin confirmar de ese período. [Revisar]"  → Body-small, link brand
```

### 12.5 Intento de acción de escritura

```
[Ícono info 20px, --color-info]
"Para borrar un movimiento, ábrelo y confirma la acción."  → Body/400
[Btn ghost sm: Ver taxi de ayer →]
```

---

## 13. SETTINGS (Configuración)

### 13.1 Layout

```
TOPBAR: "Configuración"
─────────────────────────────────────
SECCIÓN: Privacidad
  Header: H3 "Privacidad"
  Row: "Modo discreto"  [Toggle ON/OFF]
  Sub: "Oculta montos, personas y comercios en mensajes automáticos."  → Caption
  ────────────
  Row: "Ocultar montos en Dashboard"  [Toggle]

SECCIÓN: Recordatorios
  Header: H3 "Recordatorios"
  Row: "Pagos que vienen"  [Toggle]
  Row: "Cuotas de deuda"   [Toggle]
  Row: "Resumen semanal"   [Toggle]
  ────────────
  Row: "Horario silencioso"  [22:00 – 08:00 ▼]  → Caption sub: "No recibirás mensajes en este horario."

SECCIÓN: Email
  Header: H3 "Email"
  [Estado email]
    Conectado: Badge "Conectado" green + email "juan@gmail.com" + [Btn ghost sm: Desconectar]
    No conectado: Caption "Conecta Gmail para detección automática." + [Btn secondary sm: Conectar Gmail]

SECCIÓN: Datos y memoria
  Header: H3 "Datos y memoria"
  Row: "Lo que Manzana aprendió"  [Btn ghost sm: Ver →]
  Row: "Exportar datos"            [Btn ghost sm: Exportar →]
  Row: "Eliminar mi cuenta"        [Btn danger ghost sm: Eliminar →]
```

**Implementacion Dashboard V1 (Corte 19):**
- Se muestran `Pagos que vienen` y `Cuotas de deuda`.
- Ambos toggles controlan tarjetas internas de Home y nacen encendidos mientras no exista una preferencia explicita.
- Apagar un toggle retira sus avisos abiertos; encenderlo reevalua fuentes vigentes.
- No habilitan mensajes de WhatsApp/email, no registran pagos y no cambian saldos/deudas.
- `Resumen semanal`, horario silencioso y pausa temporal permanecen para un corte posterior.

### 13.2 Fila de toggle — spec

```
Altura: 52px, padding: 0 16px, border-bottom: 1px --color-border-default
  [Body/400/15px]: label, --color-text-primary, flex-1
  [Toggle]: a la derecha
    ON: fondo --color-brand-primary, círculo blanco, transición 150ms
    OFF: fondo --color-border-strong, círculo blanco
    Width: 44px, Height: 24px, border-radius --radius-full
```

---

## 14. AUTH_LOGIN / AUTH_VERIFY

### 14.1 Login

```
Background: --color-bg-primary
Content: centrado, max-width 400px, margin auto, padding-top 10vh

[Logo Manzana: símbolo + wordmark, 48px alto]
[H1] "Hola, bienvenido/a"  → 24px/600, text-center
[Body] "Ingresa con tu número de WhatsApp"  → text-center, --color-text-secondary

[Input: "Número de WhatsApp"]
  Prefijo: "+51" (fijo, no editable) + flag pe emoji
  Type: tel, inputmode: numeric
  Placeholder: "9XX XXX XXX"

[Btn primary lg full-width: Continuar]

[Caption text-center]: "Al continuar aceptas los términos de uso."  → --color-text-muted
```

### 14.2 Verificación OTP

```
[← Atrás link]
[H1] "Confirma que eres tú"
[Body] "Enviamos un código al +51 9XX XXX XXX."  → --color-text-secondary

[OTP Input: 6 cajas individuales de 48×56px]
  Cada caja: Input single digit, font Monto-lg/600, centrado, border --radius-md
  Estado vacío: border --color-border-default
  Estado activo (focused): border --color-brand-primary
  Estado lleno: border --color-border-strong, bg --color-brand-subtle
  Estado error: border --color-error, bg --color-error-subtle

[Caption]: "¿No recibiste el código? [Reenviar en 27s]"  → timer countdown

[Btn primary lg full-width: Verificar]
  Disabled hasta que 6 dígitos estén completos
```

---

## 15. ONBOARDING (pasos)

### Estructura general de cada paso

```
Background: --color-bg-primary
Progress indicator: N de M dots en la parte superior (--color-brand-primary activo, --color-border-default inactivo)
Content area: centrado, max-width 360px, padding 24px

[Ilustración 140×140px]  ← centrada
[H1] Título del paso      ← 24px/600, text-center
[Body] Descripción         ← 15px/400, text-center, --color-text-secondary

[Btn primary lg full-width: Acción principal]
[Btn ghost md: Acción secundaria / Omitir]  ← si aplica
```

### ONBOARDING_WELCOME

```
Ilustración: hojas y fruta estilizadas (paleta de marca)
H1: "Manzana organiza tu dinero sin que tengas que esforzarte."
Body: "Registra por WhatsApp, revisa aquí. Sin categorías complicadas."
Btn primary: "Empezar"
```

### ONBOARDING_WHATSAPP

```
Ilustración: teléfono con logo de WhatsApp + número
H1: "Guarda este número"
Body: "+51 900 000 000\nAgrégalo como 'Manzana' en tu celular."
Btn primary: "Ya lo guardé"
Btn ghost: "¿Cómo funciona?"
```

### ONBOARDING_FIRST_MOVE

```
Ilustración: mano escribiendo en celular
H1: "Registra tu primer movimiento"
Body: "Puedes hacerlo por WhatsApp ahora mismo o desde aquí."
Btn primary: "Registrar algo"  → abre MOVEMENT_NEW
Btn ghost: "Prefiero hacerlo por WhatsApp"  → muestra ejemplo de mensaje
```

### ONBOARDING_EMAIL_OPT

```
Ilustración: sobre de email con hoja Manzana
H1: "Detección automática de gastos" (opcional)
Body: "Conecta Gmail y Manzana detectará movimientos. Siempre te pregunto antes de registrar."
Btn primary: "Conectar Gmail"
Btn ghost: "Prefiero no conectar"  → avanza al siguiente paso sin fricción
```

### ONBOARDING_COMPLETE

```
Ilustración: manzana brillante / check mark
H1: "Manzana está lista."
Body: "Todo lo que registres aparecerá aquí. Empieza cuando quieras."
Btn primary: "Ir al inicio"  → HOME
```

---

## 16. Modales y Drawers — specs

### 16.1 MODAL_CONFIRM genérico

```
Overlay: rgba(45,49,46,0.5) + blur(2px)
Modal: 480px ancho, --radius-xl, --shadow-xl, padding 24px, bg --color-bg-surface-raised

[H2/600/20px] Título de la acción
[Body/400/15px] Descripción de lo que se hará y consecuencias
──────────────────────────────────────────
[Row footer, gap 12px, justify-end]:
  [Btn secondary: Cancelar]
  [Btn primary: Confirmar acción]
```

### 16.2 MODAL_RISK (destructivo)

```
Overlay: rgba(45,49,46,0.7)
Modal: igual + border: 2px --color-error

[Ícono alert-triangle 32px, --color-error, centrado o header]
[H2] Título con consecuencia clara
[Body] Detalle de qué se elimina (con nombre, monto, fecha como datos de ejemplo)
[Caption, --color-error] "Esta acción no se puede deshacer."
──────────────────────────────────────────
[Row footer]:
  [Btn secondary: Cancelar]  ← visible y prominente
  [Btn danger: Sí, [acción]]
```

### 16.3 DRAWER_MORE (mobile)

```
Handle: 4×32px centrado, margin-top 8px
Padding: 0 16px 24px
Background: --color-bg-surface-raised
──────────────────────────────────────
[Fila nav]: [Ícono 20px] "Deudas"          → height 52px, Body/400/15px, --color-text-primary
[Fila nav]: [Ícono 20px] "Pagos que vienen"
[Fila nav]: [Ícono 20px] "Descubrimientos"
────────────────────────────────────
[Fila nav]: [Ícono 20px] "Configuración"   → separador antes
```

---

## 17. Toast/Banner — specs

Ver Doc 29 §3.5 para especificación completa.

**Datos de ejemplo por variante:**

| Variante | Mensaje de ejemplo |
|---|---|
| Success | "Café S/8 guardado." |
| Error | "No pude guardar. Intenta de nuevo." |
| Warning | "Este movimiento parece duplicado." |
| Info | "Filtros aplicados: Gastos · Abril." |
| Recálculo | "Actualizando tus resúmenes…" |

---

## 18. Micro-interacciones y animaciones

### 18.1 Transiciones de pantalla (mobile)

- Navegación a sub-pantalla (detalle, formulario): slide-left, 300ms `--ease-default`
- Regreso: slide-right, 250ms `--ease-exit`
- Apertura de drawer: slide-up, 350ms `--ease-enter`
- Cierre de drawer: slide-down, 250ms `--ease-exit`
- Apertura de modal: scale(0.96→1) + fade(0→1), 250ms `--ease-enter`
- Cierre de modal: fade(1→0), 200ms `--ease-exit`

### 18.2 Feedback de botón

- Hover: color change, 150ms `--duration-fast`
- Pressed: scale(0.97), 80ms `--duration-instant`
- Release: scale(1), 150ms `--ease-spring`

### 18.3 Loading states

- Skeleton shimmer: izquierda → derecha, 1.5s infinite ease-in-out
- Spinner (botón en loading): rotate 360°, 1s linear infinite, 18px, color hereda del contexto
- Progress bar al entrar en viewport: grow de 0 → valor, 500ms `--ease-spring`

### 18.4 Toast

- Entrada: translateY(16px → 0) + opacity(0 → 1), 250ms `--ease-enter`
- Salida: translateY(0 → -8px) + opacity(1 → 0), 200ms `--ease-exit`
- Auto-dismiss: 4000ms (simple), 8000ms (con acción)

### 18.5 Badge de pendientes

- Al incrementar: pulse corto (scale 1 → 1.3 → 1), 300ms `--ease-spring`
- Color: `--color-error` (#C95252) en modo claro

### 18.6 Barra de progreso de deuda

- Al entrar en viewport: IntersectionObserver trigger
- Animación: width: 0% → 50% (o valor real), 500ms `--ease-spring`
- Delay: 100ms después de entrada visible

---

## 19. Responsive — cambios clave por breakpoint

| Elemento | Mobile (< 768px) | Desktop (≥ 1024px) |
|---|---|---|
| Navegación | Bottom nav + Drawer "Más" | Sidebar fija 240px |
| Topbar | 56px, título + íconos | 64px, título + barra búsqueda central |
| HOME layout | Stack vertical, cards full-width | 2 columnas: financiero + secundario |
| MOVEMENTS layout | Lista + FAB | Lista + botón inline en header |
| Formulario nuevo movimiento | Bottom drawer 85vh | Modal 560px centrado |
| Detalle de movimiento | Pantalla completa | Modal 640px |
| Confirmación sensible | Pantalla completa | Modal 480px |
| Filtros | Chips scrollables horizontal | Barra de filtros desplegables |
| Búsqueda | Pantalla propia | Panel inline expandible |
| Modales de confirmación | Drawer desde bottom | Modal centrado |
| Font sizes H1 | 24px | 28px (×1.17) |
| Font sizes Display | 32px | 40px (×1.25) |
| Padding de pantalla | 16px h | 32px h (dentro de área de contenido sin sidebar) |
| Cards en grid | 1 columna | 2 columnas (algunas secciones) |

---

## 20. Datos de ejemplo — catálogo

Todos los estados de pantalla deben usar estos datos para demos, prototipos y tests:

```
Usuario: Juan (apodo usado en onboarding, no en UI interna)
Número WhatsApp: +51 999 888 777

Cuentas:
  Yape: S/260
  BCP (ahorros): S/540
  Efectivo: S/0 (no mostrar si es 0)

Cajas:
  Emergencia: S/100 (en Yape)
  Alquiler: S/200 (en BCP)

Dinero libre: S/220
  (de 260+540=800 − cajas 300 = 500 libre en cuentas − compromisos 280 = 220 libre)

Movimientos recientes:
  Café · S/8 · hoy · WhatsApp · Confirmado · Alimentación
  Taxi S/15 · ayer · WhatsApp · Confirmado · Transporte
  Almuerzo S/20 · ayer · WhatsApp · Confirmado · Alimentación
  Yape ingreso S/2,000 · lunes · Email confirmado · Ingreso

Pendientes:
  Email Yape S/45 Restaurante · 14 mayo · Por confirmar
  Duda "Le pasé 50 a Luis" · Préstamo, regalo o pago?
  Netflix detectado 3 meses · Sugerido

Deudas:
  Laptop en cuotas: S/2,400 total / S/1,200 pagado / próxima S/400 el 26 mayo
  Luis (informal): S/150 / sin fecha

Pagos que vienen:
  Internet S/89 · entre 12 y 15 de junio · Activo
  Cuota laptop S/400 · día 26 · Activo (vinculado a deuda)
  Netflix S/35 · Sugerido (detectado 3 meses)

Descubrimientos:
  "Transporte subió S/75 esta semana. La mayor parte fue Uber de trabajo."
  "Pagaste 2 cuotas seguidas a tiempo. [Ver deuda]"
```

---

## 21. Cobertura exacta V1 para handoff visual

Esta sección cierra la brecha entre el inventario del App Flow y la especificación Hi-Fi. Todo ID listado en Doc 30 debe existir aquí como pantalla, modal, drawer o variante invocable. Si una herramienta visual como Stitch necesita generar la V1 completa, debe usar esta sección junto con las secciones 3-20.

### 21.1 Regla de navegación mobile final

Bottom nav mobile definitivo:

| Posición | Label | Icono Lucide | Destino | Notas |
|---|---|---|---|---|
| 1 | Home | home | `HOME` | Siempre visible. |
| 2 | Movm. | list | `MOVEMENTS` | Historial y filtros. |
| 3 | Pend. | inbox | `PENDING` | Badge si hay pendientes. |
| 4 | MiDin | wallet | `MY_MONEY` | Dinero, cuentas y cajas. |
| 5 | Más | menu | `DRAWER_MORE` | Abre Deudas, Pagos, Descubrimientos y Configuración. |

El botón `+` no pertenece al bottom nav. El `+` es FAB de acción y abre `MOVEMENT_NEW` en `HOME`, `MOVEMENTS`, `MY_MONEY`, `DEBTS`, `UPCOMING` y `PENDING` cuando el contexto lo permite. En desktop, la acción equivalente vive como botón primario o secundario en el header de pantalla.

### 21.2 AUTH_SPLASH

**Propósito:** resolver carga inicial sin mostrar datos antes de validar sesión.

```
Background: --color-bg-primary
Container: full viewport, flex center, padding 24px

[Logo símbolo Manzana] 56x56px
  Forma: manzana abstracta minimal, stroke 2px, color --color-brand-primary
  Hoja: stroke --color-success, 14x10px, inclinada 18deg
  Interior: dos líneas sutiles tipo registro financiero, stroke --color-brand-primary 40%

[Wordmark] "Manzana" -> DM Sans 24px/600, color --color-text-primary, margin-top 12px
[Spinner] 20px, border 2px, color --color-brand-primary, margin-top 24px
[Caption] "Preparando tu espacio..." -> 12px/400, --color-text-muted, margin-top 8px
```

**Estados:**
- Loading normal: spinner visible, máximo 1200ms antes de resolver ruta.
- Sesión válida: fade 180ms -> `HOME`.
- Usuario nuevo: fade 180ms -> `ONBOARDING_WELCOME`.
- Sesión inválida: fade 180ms -> `AUTH_LOGIN`.
- Error de red: reemplazar caption por "No pude conectar ahora." + Button secondary sm "Reintentar".

### 21.3 AUTH_SESSION_EXPIRED

**Propósito:** proteger privacidad cuando la sesión vence y evitar que datos financieros queden visibles.

**Mobile y desktop:**
```
Overlay: --color-bg-primary, opacity 100%, sin blur de datos debajo
Modal/card centrado: max-width 400px, padding 24px, bg --color-bg-surface-raised, radius --radius-xl, shadow --shadow-lg

[Icono lock] 40px, color --color-brand-primary
[H2] "Vuelve a entrar"
[Body] "Por seguridad oculté tus datos. Confirma tu acceso para continuar."
[Btn primary lg full-width] "Continuar"
[Btn ghost md full-width] "Salir"
```

**Regla:** nunca mostrar saldos, nombres de personas, comercios ni montos detrás del overlay.

### 21.4 PENDING_DETAIL / DRAWER_PENDING_DETAIL

**Mobile:** bottom drawer 92vh, snap alto, `z-modal`. **Desktop:** modal 680px, max-height 82vh.

```
Header:
  [Badge warning] "Por confirmar"
  [H2] "Movimiento detectado"
  [X cerrar]

Resumen:
  [Icono fuente] email / whatsapp / sistema, 40x40px
  [H1/Monto] "S/45" -> Display 32px/700, tabular-nums
  [Body/500] "Restaurante"
  [Caption] "Email de Yape · 14 de mayo"

Protección:
  Banner info, bg --color-info-subtle:
  "No afecta tu saldo hasta que lo confirmes."

Campos editables antes de confirmar:
  Tipo de movimiento
  Monto
  Fecha
  Cuenta
  Categoría
  Descripción

Evidencia:
  Accordion "Origen"
  Texto: "Detectado desde email. Señales: monto, comercio y fecha."
  No mostrar chain-of-thought ni contenido sensible completo del email.

Acciones sticky bottom:
  [Btn primary] "Confirmar"
  [Btn secondary] "Editar"
  [Btn ghost] "Ya lo registré"
  [Btn ghost danger] "Rechazar"
```

**Batch:** si el usuario llega desde link con varios pendientes, arriba del listado mostrar:
```
Banner: "Tienes 4 movimientos por confirmar."
[Btn primary sm] "Confirmar todos revisados"
[Btn ghost sm] "Ver uno por uno"
```

**Modo discreto:**
- Monto: `•••`
- Comercio: "Movimiento detectado"
- Fuente visible: "Email"
- Botones iguales.

### 21.5 DEBT_DETAIL

**Mobile:** pantalla completa con topbar atrás. **Desktop:** página de detalle dentro del shell, max-width 920px.

```
Topbar: [Atrás] "Detalle de deuda" [Editar]

Hero:
  [Badge] Activa / Saldada / Me deben / Debo
  [H1] "Laptop en cuotas"
  [Monto principal] "S/1,200 pendiente" -> Display 32px/700
  [Caption] "50% pagado de S/2,400"
  [Progress bar] altura 10px, fill --color-progress-fill

Siguiente acción:
  Card brand-subtle:
  "Próxima cuota: S/400 · 26 de mayo"
  [Btn primary sm] "Registrar pago"
  [Btn ghost sm] "Recordarme"

Detalle:
  Persona/entidad
  Tipo: deuda adquirida / préstamo dado / préstamo recibido
  Cuenta asociada
  Fecha inicial
  Fecha límite
  Condiciones

Cuotas:
  Lista ordenada por vencimiento con estado, esperado, pagado y pendiente
  Abono parcial mantiene cuota abierta y muestra monto restante
  Pago completo cambia badge a "Pagada"
  Varios abonos muestran cantidad de pagos vinculados

Historial:
  Lista de pagos vinculados, 64px alto cada fila
  Cada pago indica a qué cuota o cuotas fue aplicado
  Estado vacío: "Aún no hay pagos registrados para esta deuda."

Acciones finales:
  [Btn secondary] "Editar deuda"
  [Btn ghost danger] "Cerrar o eliminar"
```

**Estado saldada:** hero cambia a `--color-success-subtle`, badge "Saldada", CTA principal desaparece y aparece "Ver movimientos".

### 21.6 UPCOMING_DETAIL

**Mobile:** pantalla completa. **Desktop:** modal/página secundaria 720px según entrada: desde lista abre página; desde card rápida puede abrir modal.

```
Topbar: [Atrás] "Pago que viene" [Editar]
Hero:
  [Badge estado] Activo / Sugerido / Vencido / Pausado
  [H1] "Internet"
  [Monto] "S/89" -> Display 32px/700
  [Caption] "Entre 12 y 15 de junio"

Bloque de claridad:
  "Manzana lo muestra para ayudarte a anticiparlo. No es una deuda registrada."

Patrón:
  "Detectado 3 meses consecutivos" si viene de patrón.
  Chips: "Mensual", "Estimado", "Email"

Acciones:
  Activo: [Btn primary] "Marcar pagado" [Btn secondary] "Editar" [Btn ghost] "Pausar"
  Sugerido: [Btn primary] "Confirmar pago recurrente" [Btn ghost] "Ignorar"
  Vencido: [Btn primary] "Marcar pagado" [Btn secondary] "Cambiar fecha"

Historial:
  Movimientos relacionados o pagos anteriores.
```

### 21.7 DISCOVERY_DETAIL

**Propósito emocional:** autodescubrimiento sin culpa.

```
Topbar: [Atrás] "Descubrimiento" [Guardar]
Hero:
  [Caption brand] "Manzana notó algo"
  [H1] "Transporte subió S/75 esta semana"
  [Body] "La mayor parte fue Uber de trabajo."

Evidencia visible:
  Card "De dónde sale"
  - "Comparé tus movimientos de transporte de esta semana con la anterior."
  - "Encontré 5 movimientos relacionados."
  - "No incluye pendientes sin confirmar."

Lista:
  [Fila movimiento compacta] x 5
  [Btn ghost sm] "Ver todos filtrados"

Siguiente paso pequeño:
  Card bg --color-brand-subtle:
  "Si fue una semana distinta, puedes dejarlo así. Si no, revisa Uber de trabajo."
  [Btn secondary sm] "Revisar categoría"
  [Btn ghost sm] "Ignorar"

Feedback:
  [Btn ghost icon] útil / no útil, tooltips obligatorios
```

**Actualizado:** si cambió por corrección de datos, mostrar banner info:
`"Actualizado después de una corrección. Antes mostraba S/75; ahora S/52."`

**Modo discreto:** reemplazar montos por `•••` y texto: `"Hay un cambio en esta categoría."`

### 21.8 MODAL_DETAIL_QUICK

Uso: preview rápido desde Home, búsqueda o listas densas sin abandonar contexto.

```
Desktop modal: 520px, padding 20px
Mobile: drawer 70vh
Header: título corto + X
Body:
  Monto / estado / fuente
  4 filas clave máximo
  Evidencia resumida en 1 línea
Footer:
  [Btn primary] "Abrir detalle"
  [Btn secondary] acción contextual
  [Btn ghost] "Cerrar"
```

Regla: no reemplaza a `MOVEMENT_DETAIL`, `PENDING_DETAIL`, `DEBT_DETAIL` ni `DISCOVERY_DETAIL`. Solo preview.

### 21.9 DRAWER_FILTERS

**Mobile:** drawer 88vh, sticky footer.

```
Header: "Filtrar movimientos" + [Limpiar]

Secciones:
  Período: Hoy, Esta semana, Este mes, Personalizado
  Tipo: 11 tipos canónicos con checkbox
  Categoría: 12 categorías base + subcategorías creadas
  Cuenta/caja: cuentas activas
  Fuente: WhatsApp, Dashboard, Email, Sistema
  Estado: Confirmado, Pendiente, Corregido, Estimado
  Monto: rango mínimo/máximo

Footer:
  [Btn secondary] "Cancelar"
  [Btn primary] "Aplicar filtros"
```

Estados:
- Sin filtros: botón "Limpiar" disabled.
- Aplicando: primary loading.
- Error: toast "No pude aplicar filtros. Intenta de nuevo."

### 21.10 Variantes completas de MOVEMENT_NEW / MOVEMENT_EDIT

Todos los formularios comparten campos base: Tipo, Monto, Fecha, Descripción opcional, Fuente "Dashboard", bloque de impacto y acciones sticky. El tipo seleccionado decide campos adicionales, texto de impacto y validación.

| Tipo | Campos requeridos | Campos opcionales | Impacto antes de guardar | CTA primario |
|---|---|---|---|---|
| `gasto` | Monto, fecha, categoría | Cuenta/caja, descripción, etiqueta | "Reduce tu dinero libre y el saldo de la cuenta elegida." | Guardar gasto |
| `ingreso` | Monto, fecha | Cuenta destino, categoría, descripción | "Aumenta el saldo de la cuenta elegida." | Guardar ingreso |
| `transferencia` | Monto, cuenta origen, cuenta destino, fecha | Descripción | "Mueve dinero entre cuentas. No cambia tu dinero total." | Guardar transferencia |
| `asignacion_interna` | Monto, cuenta origen, caja destino, fecha | Descripción | "Separa dinero en una caja. Baja tu dinero libre, no tu saldo total." | Guardar asignación |
| `deuda_adquirida` | Monto, persona/entidad, fecha | Fecha límite, cuotas, condiciones, cuenta | "Crea una deuda activa. No descuenta saldo hasta registrar un pago." | Crear deuda |
| `pago_deuda` | Monto, deuda vinculada, fecha | Cuenta origen, descripción | "Reduce la deuda y, si eliges cuenta, reduce ese saldo." | Registrar pago |
| `prestamo_dado` | Monto, persona, fecha | Cuenta origen, fecha esperada | "Registra dinero que te deben. Puede afectar saldo si eliges cuenta." | Guardar préstamo |
| `prestamo_recibido` | Monto, persona/entidad, fecha | Cuenta destino, condiciones | "Registra dinero que recibiste y podrías deber." | Guardar préstamo |
| `devolucion_recibida` | Monto, persona o deuda vinculada, fecha | Cuenta destino, descripción | "Reduce lo que te debían y puede aumentar tu saldo." | Guardar devolución |
| `pago_recurrente` | Monto, nombre, frecuencia, próxima fecha | Cuenta sugerida, categoría, recordatorio | "Crea un pago que viene. No afecta saldo hasta que se pague." | Crear pago |
| `ajuste` | Monto, cuenta, motivo, fecha | Nota | "Corrige un saldo. Requiere confirmación porque altera datos base." | Guardar ajuste |

**Validación visual por tipo:**
- Campo requerido vacío: borde `--color-error`, texto 12px debajo.
- Cuenta no especificada permitida en gasto/ingreso/prestamo: mostrar banner info "Puedes guardarlo sin cuenta y corregirlo después."
- `ajuste`: siempre muestra `MODAL_RISK` antes de guardar.
- Transferencia con misma cuenta origen/destino: error inline.
- Pago de deuda mayor al pendiente: warning con opción "Guardar como pago parcial + excedente" queda fuera de V1; en V1 bloquear y pedir corregir monto.

### 21.11 Formularios de entidades invocados desde pantallas

Estas piezas no son pantallas del bottom nav, pero sí son necesarias para que la V1 no dependa de formularios genéricos incompletos.

**ACCOUNT_CREATE / ACCOUNT_EDIT**
```
Drawer mobile 82vh / Modal desktop 520px
Campos: Nombre, tipo (Yape, banco, efectivo, otro), saldo inicial, moneda PEN fija V1, color opcional
Copy: "Esto ayuda a calcular tu dinero libre."
CTA: "Guardar cuenta"
Estado sin saldo: permitir S/0, mostrar "Puedes actualizarlo luego."
```

**BOX_CREATE / BOX_EDIT**
```
Campos: Nombre de caja, monto separado, cuenta origen, objetivo opcional
Impacto: "Este dinero seguirá en tu cuenta, pero dejará de contarse como libre."
CTA: "Guardar caja"
Error: monto mayor al saldo disponible de cuenta -> warning y bloquear guardar.
```

**DEBT_CREATE / DEBT_EDIT**
```
Campos: Tipo (debo / me deben), persona/entidad, monto total, monto ya pagado opcional, fecha, fecha límite, condiciones
CTA: "Guardar deuda"
Copy sensible: evitar "moroso", "atrasado" o culpa.
```

**UPCOMING_CREATE / UPCOMING_EDIT**
```
Campos: Nombre, monto estimado, frecuencia, rango de fecha, cuenta sugerida, categoría, recordatorio ON/OFF
CTA: "Guardar pago"
Copy: "Te avisaré para que no se te pase, sin descontarlo de tu saldo."
```

**GMAIL_CONNECT / GMAIL_DISCONNECT**
```
Connect: modal informativo antes de OAuth.
Texto: "Manzana detecta posibles movimientos y los manda a Pendientes. Nunca registra desde email sin tu aprobación."
CTA primary: "Conectar Gmail"
CTA ghost: "Ahora no"

Disconnect: MODAL_CONFIRM.
Texto: "Dejaré de detectar movimientos desde Gmail. Tus movimientos ya confirmados se mantienen."
CTA primary: "Desconectar"
```

### 21.12 Estados Hi-Fi obligatorios por pantalla

Cada pantalla principal debe tener, como mínimo, estos estados construidos con tokens de Doc 29:

| Pantalla | Funcional | Vacío | Loading | Error | Recalculando | Sensible/discreto |
|---|---|---|---|---|---|---|
| `HOME` | Cards de dinero, pendiente, insight, compromiso y recientes | Empty state central con registrar/WhatsApp/email | Skeleton de card + filas | Banner error arriba | Banner "Actualizando..." | Montos `•••`, copy genérico |
| `MOVEMENTS` | Lista + filtros + FAB | Empty list | 6 skeleton rows | Banner inline | No aplica | Montos `•••` |
| `MOVEMENT_DETAIL` | Header + info + evidencia + acciones | No aplica | Skeleton detalle | Error con reintentar | Banner si viene de corrección | Montos/personas según política |
| `MOVEMENT_NEW/EDIT` | Formulario dinámico | No aplica | Skeleton de selects | Validación inline | No aplica | No ocultar campos al editar, sí ocultar previews sensibles |
| `PENDING` | Lista agrupada + batch | Empty inbox | 3 skeleton pending | Banner inline | Badge actualiza | Oculta monto/comercio |
| `PENDING_DETAIL` | Detalle editable + evidencia + acciones | No aplica | Skeleton detalle | Error con reintentar | No aplica | Oculta monto/comercio |
| `MY_MONEY` | Desglose + cuentas + cajas + compromisos | Sin cuentas | Skeleton desglose | Banner error | Spinner junto a dinero libre | Todos los montos `•••` |
| `DEBTS` | Resumen + activas/saldadas | Empty con CTA crear deuda | Skeleton cards | Banner error | Barra progreso actualiza | Montos `•••`, nombres sensibles protegidos |
| `DEBT_DETAIL` | Hero + pagos + acciones | Historial vacío permitido | Skeleton detalle | Error con reintentar | Progreso recalcula | Montos `•••` |
| `UPCOMING` | Activos/sugeridos/vencidos | Empty con CTA agregar | Skeleton cards | Banner error | No aplica | Montos `•••` |
| `UPCOMING_DETAIL` | Hero + patrón + acciones | Historial vacío permitido | Skeleton detalle | Error | No aplica | Montos `•••` |
| `DISCOVERIES` | Recientes/actualizados/guardados | Sin datos suficientes | Skeleton cards | Banner error | Banner "Actualizado" | Copy sin monto exacto |
| `DISCOVERY_DETAIL` | Insight + evidencia + movimientos | No aplica | Skeleton detalle | Error | Banner actualizado | Monto `•••` y evidencia resumida |
| `SEARCH` | Respuesta + fuentes | Sugerencias iniciales | Spinner panel | Error IA | No aplica | Respuesta sin datos sensibles |
| `SETTINGS` | Secciones completas | No aplica | Skeleton secciones | Toast/inline | Toggle loading | Modo discreto visible |

### 21.13 Instrucción para Stitch / herramientas visuales

Para generar prototipo visual, usar:
- Doc 28 para marca, paleta, logo, tono visual e iconografía.
- Doc 29 para tokens y componentes.
- Doc 30 para inventario, navegación y entry points.
- Doc 31 para comportamiento de flujos.
- Doc 32 secciones 3-21 para composición exacta por pantalla.
- Doc 33 para prompt maestro, orden de generación, inventario exacto de 151 frames/variantes visuales y criterios de aceptación/rechazo.

No generar landing, pricing, blog, marketing site ni pantallas fuera de V1. WhatsApp es canal principal de captura; Dashboard es control, revisión y profundidad. El prototipo debe incluir mobile y desktop para: `HOME`, `MOVEMENTS`, `PENDING`, `MY_MONEY`, `DEBTS`, `UPCOMING`, `DISCOVERIES`, `SEARCH`, `SETTINGS`, onboarding, login, detalles y formularios anteriores.

Si una pantalla necesita un dato no definido, usar el catálogo de la sección 20 y no inventar nuevas categorías, monedas, canales ni providers.

## 22. Criterios de aceptación

- Cada pantalla principal tiene layout especificado para mobile y desktop.
- Cada ID del inventario de Doc 30 tiene cobertura visual en este documento como pantalla, modal, drawer o variante invocable.
- Cada pantalla tiene especificación de todos sus estados: funcional, vacío, carga, error, modo discreto.
- Los 11 tipos canónicos de movimiento tienen campos, validaciones, impacto y CTA definidos.
- Las entidades necesarias de V1 (cuenta, caja, deuda, pago que viene y Gmail) tienen formularios o modales definidos.
- Los valores de tokens (colores, tipografía, espaciado) referenciados existen en Doc 29.
- Las micro-interacciones tienen duración y easing definidos.
- Los datos de ejemplo son realistas, en español peruano, y coherentes entre pantallas.
- El documento permite implementar el Dashboard completo sin preguntar valores visuales.
- Stitch o una herramienta equivalente no debe inventar pantallas, categorías, monedas, canales, providers ni landing pages fuera de V1.
- v0, Emergent, Stitch o similar puede reproducir el resultado a partir de este documento.
- Si el prototipo se pierde, este documento permite regenerarlo sin pérdida de información.

---

*Fase 6 Visual - Documento 32 - V1*
