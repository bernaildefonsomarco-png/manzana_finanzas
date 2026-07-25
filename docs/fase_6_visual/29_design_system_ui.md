# 29 - Design System UI

**Fase:** 6 - Visual  
**Estado:** V1  
**Ultima actualizacion:** 5 de junio, 2026  
**Inputs:** Doc 28 (identidad visual), Doc 18 (inventario de componentes y wireframes)

---

## 1. Propósito

Este documento define los tokens de diseño exactos y las especificaciones completas de cada componente de la UI de Manzana. Es la fuente de verdad para implementación.

Cada valor aquí es un contrato. No una sugerencia.

---

## 2. Tokens de Diseño

### 2.1 Tokens de color (roles semánticos)

Los valores hex provienen de Doc 28. Aquí se asignan a nombres de token usables en código (CSS custom properties / Tailwind config).

#### Modo claro (light)

```
--color-bg-primary:        #F9F8F6   /* Fondo base */
--color-bg-surface:        #F0EFEA   /* Cards, contenedores secundarios */
--color-bg-surface-raised: #FFFFFF   /* Modales, drawers, tooltips */
--color-bg-discrete:       #EDECEA   /* Elementos en modo discreto */
--color-bg-inverse:        #2D312E   /* Tooltips oscuros, inversión */

--color-brand-primary:     #4A7C59   /* CTAs primarios, acentos de marca */
--color-brand-hover:       #3D6A4A   /* Hover sobre elementos brand */
--color-brand-active:      #336040   /* Active/pressed brand */
--color-brand-subtle:      #D6E8DC   /* Fondo sutil de elementos brand */

--color-accent:            #C96A52   /* Acento secundario, Terracota */
--color-accent-hover:      #B45B44   /* Hover acento */
--color-accent-subtle:     #F5E0DA   /* Fondo sutil acento */

--color-text-primary:      #2D312E   /* Texto principal */
--color-text-secondary:    #5A5F5C   /* Texto secundario */
--color-text-muted:        #8A8F8B   /* Texto deshabilitado, placeholders */
--color-text-disabled:     #B0AFA9   /* Texto en estado disabled */
--color-text-inverse:      #F9F8F6   /* Texto sobre fondos oscuros */
--color-text-discrete:     #B0AFA9   /* Texto enmascarado modo discreto */
--color-text-brand:        #4A7C59   /* Links, texto con color de marca */

--color-border-default:    #E5E4E0   /* Bordes de cards, inputs */
--color-border-strong:     #C8C7C3   /* Bordes de separadores, dividers */
--color-border-focus:      #4A7C59   /* Anillo de foco */
--color-border-error:      #C95252   /* Bordes de inputs con error */

--color-success:           #349964   /* Éxito, ingresos, deuda pagada */
--color-success-subtle:    #D4EDDF   /* Fondo sutil éxito */
--color-warning:           #E5A93D   /* Advertencia, pendiente */
--color-warning-subtle:    #FDF0D5   /* Fondo sutil advertencia */
--color-error:             #C95252   /* Error, destructivo */
--color-error-subtle:      #F9DEDE   /* Fondo sutil error */
--color-info:              #6B9EC5   /* Informativo neutro */
--color-info-subtle:       #DCECf5   /* Fondo sutil info */

--color-debt:              #7A3E2B   /* Etiquetas deuda activa */
--color-debt-subtle:       #F2E0D8   /* Fondo sutil deuda */
--color-debt-paid:         #349964   /* Deuda saldada */
--color-progress-fill:     #4A7C59   /* Relleno barra de progreso */
--color-progress-low:      #E5A93D   /* Progreso < 30% */
--color-progress-track:    #E5E4E0   /* Track de barra de progreso */
```

#### Modo oscuro (dark) — overrides

```
--color-bg-primary:        #181A19
--color-bg-surface:        #222523
--color-bg-surface-raised: #2C2E2D
--color-bg-discrete:       #1E201F
--color-bg-inverse:        #E8EBE9

--color-brand-primary:     #6A9C78
--color-brand-hover:       #7CAE89
--color-brand-active:      #5A8A68
--color-brand-subtle:      #1E3328

--color-text-primary:      #E8EBE9
--color-text-secondary:    #BABDB9
--color-text-muted:        #6B6F6D
--color-text-disabled:     #4A4D4B
--color-text-inverse:      #181A19
--color-text-discrete:     #4A4D4B

--color-border-default:    #353835
--color-border-strong:     #4A4D4B
--color-border-focus:      #6A9C78
--color-border-error:      #D97575

--color-success:           #5DB88A
--color-success-subtle:    #1A3D2B
--color-warning:           #D4A043
--color-warning-subtle:    #3D2F10
--color-error:             #D97575
--color-error-subtle:      #3D1E1E
--color-info:              #7BB3D4
--color-info-subtle:       #1A2D3D

--color-debt:              #C8805A
--color-debt-subtle:       #3D2318
--color-progress-fill:     #6A9C78
--color-progress-track:    #353835
```

---

### 2.2 Tokens de tipografía

```
--font-family-heading:  "DM Sans", system-ui, sans-serif
--font-family-body:     "Inter", system-ui, sans-serif

/* Nivel: Display */
--text-display-size:    2rem        /* 32px */
--text-display-weight:  700
--text-display-lh:      1.2
--text-display-ls:      -0.03125em  /* ~-0.5px at 16px base */

/* Nivel: H1 */
--text-h1-size:         1.5rem      /* 24px */
--text-h1-weight:       600
--text-h1-lh:           1.3
--text-h1-ls:           -0.0125em

/* Nivel: H2 */
--text-h2-size:         1.25rem     /* 20px */
--text-h2-weight:       600
--text-h2-lh:           1.35
--text-h2-ls:           -0.01em

/* Nivel: H3 */
--text-h3-size:         1.0625rem   /* 17px */
--text-h3-weight:       500
--text-h3-lh:           1.4
--text-h3-ls:           0

/* Nivel: Body */
--text-body-size:       0.9375rem   /* 15px */
--text-body-weight:     400
--text-body-lh:         1.5
--text-body-ls:         0

/* Nivel: Body-small */
--text-body-sm-size:    0.8125rem   /* 13px */
--text-body-sm-weight:  400
--text-body-sm-lh:      1.5
--text-body-sm-ls:      0.00625em

/* Nivel: Caption */
--text-caption-size:    0.75rem     /* 12px */
--text-caption-weight:  400
--text-caption-lh:      1.4
--text-caption-ls:      0.0125em

/* Nivel: Label/Button */
--text-label-size:      0.875rem    /* 14px */
--text-label-weight:    500
--text-label-lh:        1.2
--text-label-ls:        0.00625em

/* Montos */
--text-amount-lg-size:  1.75rem     /* 28px */
--text-amount-lg-weight:600
--text-amount-lg-lh:    1.1
--text-amount-lg-ls:    -0.03125em

--text-amount-sm-size:  0.9375rem   /* 15px */
--text-amount-sm-weight:500
--text-amount-sm-lh:    1.3
--text-amount-sm-ls:    -0.0125em

/* Micro */
--text-micro-size:      0.6875rem   /* 11px */
--text-micro-weight:    400
--text-micro-lh:        1.4
--text-micro-ls:        0.01875em

/* Numérico tabular */
--font-variant-numeric: tabular-nums
--font-feature-numeric: "tnum"
```

---

### 2.3 Tokens de espaciado

Sistema base de 4px.

```
--space-0:   0px
--space-1:   4px    /* xs — separación mínima entre elementos inline */
--space-2:   8px    /* sm — separación entre elementos relacionados */
--space-3:   12px   /* sm-md — padding interno compacto */
--space-4:   16px   /* md — padding interno estándar de cards */
--space-5:   20px   /* md-lg — margen entre grupos */
--space-6:   24px   /* lg — separación entre secciones */
--space-8:   32px   /* xl — margen de sección, padding de pantalla */
--space-10:  40px   /* 2xl — separación grande entre bloques */
--space-12:  48px   /* 3xl */
--space-16:  64px   /* 4xl — hero, header height */
--space-20:  80px   /* máximo espaciado en desktop */
```

**Reglas de aplicación:**
- Padding interno de card: `--space-4` (16px) en mobile, `--space-5` (20px) en desktop
- Separación entre cards en lista: `--space-2` (8px) en mobile, `--space-3` (12px) en desktop
- Separación entre secciones: `--space-6` (24px)
- Margen horizontal de pantalla en mobile: `--space-4` (16px)
- Gutter de grilla en desktop: `--space-6` (24px)

---

### 2.4 Tokens de border-radius

```
--radius-none:   0px
--radius-xs:     2px    /* Tags inline, micro-chips */
--radius-sm:     4px    /* Badges, etiquetas pequeñas */
--radius-md:     8px    /* Inputs, elementos secundarios */
--radius-lg:     12px   /* Cards principales */
--radius-xl:     16px   /* Modales, drawers, paneles */
--radius-2xl:    24px   /* Bottom sheets */
--radius-full:   9999px /* Pills, avatares, botones circulares */
```

---

### 2.5 Tokens de sombra

```
--shadow-none:  none
--shadow-xs:    0 1px 2px rgba(45,49,46,0.04)
--shadow-sm:    0 2px 8px rgba(45,49,46,0.06)
--shadow-md:    0 4px 16px rgba(45,49,46,0.08)
--shadow-lg:    0 8px 32px rgba(45,49,46,0.12)
--shadow-xl:    0 16px 48px rgba(45,49,46,0.16)

/* Dark mode overrides */
--shadow-xs-dark: 0 1px 2px rgba(0,0,0,0.16)
--shadow-sm-dark: 0 2px 8px rgba(0,0,0,0.24)
--shadow-md-dark: 0 4px 16px rgba(0,0,0,0.32)
```

Regla: cards usan `--shadow-sm`. Modales/drawers usan `--shadow-lg`. Tooltips usan `--shadow-md`.

---

### 2.6 Breakpoints

```
--bp-mobile:   < 768px    /* mobile-first, default */
--bp-tablet:   768px      /* tablet y landscape mobile */
--bp-desktop:  1024px     /* sidebar visible, layout de 2 columnas */
--bp-wide:     1280px     /* layout con más respiro en desktop */
--bp-max:      1440px     /* max-width del contenedor principal */
```

---

### 2.7 Z-index

```
--z-base:       0
--z-above:      10    /* Elementos sobre contenido normal */
--z-sticky:     20    /* Sidebar, topbar sticky */
--z-overlay:    30    /* Fondos de modal/drawer */
--z-drawer:     40    /* Drawers laterales y bottom sheets */
--z-modal:      50    /* Modales de confirmación */
--z-toast:      60    /* Toasts y banners de notificación */
--z-tooltip:    70    /* Tooltips */
--z-popover:    80    /* Popovers, dropdowns */
```

---

### 2.8 Transiciones y animaciones

```
/* Duraciones */
--duration-instant: 80ms    /* Feedback táctil inmediato (ripple, press) */
--duration-fast:    150ms   /* Hover, toggle, estado de botón */
--duration-normal:  250ms   /* Entrada/salida de tooltips, dropdowns */
--duration-slow:    350ms   /* Modales, drawers, transiciones de pantalla */
--duration-slower:  500ms   /* Animaciones de onboarding, progress bars */

/* Easings */
--ease-default:     cubic-bezier(0.2, 0, 0, 1)      /* Material You standard */
--ease-enter:       cubic-bezier(0.0, 0.0, 0.2, 1)  /* Elementos que entran */
--ease-exit:        cubic-bezier(0.4, 0.0, 1, 1)    /* Elementos que salen */
--ease-spring:      cubic-bezier(0.34, 1.56, 0.64, 1) /* Micro-interacciones */
```

---

### 2.9 Grid y layout

```
/* Mobile (< 768px) */
--grid-cols-mobile:   4
--grid-gutter-mobile: 16px
--grid-margin-mobile: 16px

/* Tablet (768–1023px) */
--grid-cols-tablet:   8
--grid-gutter-tablet: 24px
--grid-margin-tablet: 24px

/* Desktop (≥ 1024px) */
--grid-cols-desktop:  12
--grid-gutter-desktop: 24px
--grid-margin-desktop: 32px

/* Anchos máximos */
--container-max:      1440px
--content-max:        1200px   /* Área de contenido sin sidebar */
--sidebar-width:      240px    /* Sidebar desktop expandida */
--sidebar-collapsed:  64px     /* Sidebar colapsada (solo íconos) */
```

---

## 3. Componentes

### 3.1 Button

**Variantes:** `primary`, `secondary`, `ghost`, `danger`, `icon-only`  
**Tamaños:** `sm`, `md`, `lg`

#### Especificación de tamaños

| Tamaño | Altura | Padding H | Padding V | Font | Icon size |
|---|---|---|---|---|---|
| sm | 32px | 12px | 6px | Label 14px/500 | 16px |
| md | 40px | 16px | 8px | Label 14px/500 | 18px |
| lg | 48px | 20px | 12px | Label 15px/500 | 20px |

Tap target mínimo: siempre 44×44px. Si el botón es visualmente más pequeño, usar padding invisible adicional.

#### Estados por variante

**Primary (`bg-brand-primary`, texto blanco)**

| Estado | Background | Border | Text | Shadow | Cursor |
|---|---|---|---|---|---|
| Default | `#4A7C59` | none | `#F9F8F6` | `shadow-sm` | pointer |
| Hover | `#3D6A4A` | none | `#F9F8F6` | `shadow-md` | pointer |
| Active/Pressed | `#336040` | none | `#F9F8F6` | `shadow-xs` | pointer |
| Focused | `#4A7C59` | `2px solid #4A7C59`, `outline-offset: 2px` | `#F9F8F6` | `shadow-sm` | pointer |
| Disabled | `#C8C7C3` | none | `#8A8F8B` | none | not-allowed |
| Loading | `#4A7C59` + spinner | none | transparent | `shadow-sm` | wait |

Dark mode: Default `#6A9C78`, Hover `#7CAE89`, Active `#5A8A68`.

**Secondary (`bg-surface`, borde brand)**

| Estado | Background | Border | Text | Shadow |
|---|---|---|---|---|
| Default | `#F0EFEA` | `1.5px solid #4A7C59` | `#4A7C59` | none |
| Hover | `#D6E8DC` | `1.5px solid #4A7C59` | `#3D6A4A` | none |
| Active | `#C5DDD0` | `1.5px solid #336040` | `#336040` | none |
| Focused | `#F0EFEA` | `2px solid #4A7C59`, `outline-offset: 2px` | `#4A7C59` | none |
| Disabled | `#F0EFEA` | `1.5px solid #B0AFA9` | `#B0AFA9` | none |
| Loading | `#F0EFEA` + spinner | `1.5px solid #8A8F8B` | `#8A8F8B` | none |

**Ghost (sin fondo visible)**

| Estado | Background | Border | Text |
|---|---|---|---|
| Default | transparent | none | `#4A7C59` |
| Hover | `#D6E8DC` (8% opac) | none | `#3D6A4A` |
| Active | `#C5DDD0` | none | `#336040` |
| Focused | transparent | `2px solid #4A7C59` | `#4A7C59` |
| Disabled | transparent | none | `#B0AFA9` |

**Danger**

| Estado | Background | Border | Text |
|---|---|---|---|
| Default | `#C95252` | none | `#FFFFFF` |
| Hover | `#B04545` | none | `#FFFFFF` |
| Active | `#963B3B` | none | `#FFFFFF` |
| Focused | `#C95252` | `2px solid #C95252`, `outline-offset: 2px` | `#FFFFFF` |
| Disabled | `#C8C7C3` | none | `#8A8F8B` |
| Loading | `#C95252` + spinner | none | transparent |

**Icon-only** (circular o cuadrado con radio)
- Mismos colores que Ghost por defecto
- Tamaño md: 40×40px, radio `--radius-full` para circular, `--radius-md` para cuadrado
- Icon color: hereda text color del estado
- Tooltip obligatorio con `aria-label`

#### Comportamiento responsive
- Mobile: ancho completo (`width: 100%`) salvo que estén en fila de acciones
- Desktop: ancho por contenido (`width: auto`, min 120px)
- Grupo de botones: gap de `--space-2` (8px)

#### Modo discreto
- No aplica directamente a botones. Los botones no contienen datos sensibles.

---

### 3.2 Input

**Tipos:** `text`, `number/monto`, `date`, `select/dropdown`, `textarea`, `search`

#### Especificación base (md — default)

| Propiedad | Valor |
|---|---|
| Altura | 44px (text, number, date, select) |
| Padding horizontal | 12px |
| Padding vertical | 10px |
| Font | Body 15px/400, `--font-family-body` |
| Border | `1.5px solid --color-border-default` |
| Border-radius | `--radius-md` (8px) |
| Background | `--color-bg-surface-raised` (#FFFFFF claro) |

#### Estados

| Estado | Border | Background | Label color | Texto | Icono |
|---|---|---|---|---|---|
| Default | `#E5E4E0` 1.5px | `#FFFFFF` | `#8A8F8B` | `#2D312E` | `#8A8F8B` |
| Focused | `#4A7C59` 2px | `#FFFFFF` | `#4A7C59` | `#2D312E` | `#4A7C59` |
| Filled | `#C8C7C3` 1.5px | `#FFFFFF` | `#5A5F5C` (small, arriba) | `#2D312E` | `#5A5F5C` |
| Hover (vacío) | `#8A8F8B` 1.5px | `#FAFAF9` | `#8A8F8B` | — | `#8A8F8B` |
| Error | `#C95252` 1.5px | `#FFF8F8` | `#C95252` | `#2D312E` | `#C95252` |
| Disabled | `#E5E4E0` 1px | `#F0EFEA` | `#B0AFA9` | `#B0AFA9` | `#B0AFA9` |
| Loading | `#E5E4E0` 1.5px | `#FFFFFF` | `#8A8F8B` | `#8A8F8B` | spinner |
| Success (post-validate) | `#349964` 1.5px | `#F8FFF9` | `#349964` | `#2D312E` | `#349964` |

**Focus ring:** `outline: 2px solid #4A7C59; outline-offset: 2px`

#### Input de monto (number/monto)

- Prefijo fijo: `S/` con color `#8A8F8B`, a la izquierda del input
- Placeholder: `0.00`
- Alineación: derecha del campo para el número
- `font-feature-settings: "tnum"` activado
- Teclado numérico en mobile (`inputmode="decimal"`)
- No permite letras; solo números y punto decimal
- Separador de miles: espacio fino (`\u202f`) — solo visual, no afecta valor
- Valor negativo: mismo campo, color `--color-error` en el número

#### Select/Dropdown

- Ícono de chevron-down a la derecha (`16px`, color `--color-text-muted`)
- Al abrirse: borde cambia a `--color-border-focus`, shadow `--shadow-md`, lista debajo con `--radius-md`, `--shadow-lg`
- Cada opción: padding 12px 16px, hover `--color-bg-surface`, selected `--color-brand-subtle`
- Max height lista: `240px` con scroll

#### Textarea

- Altura mínima: `80px` (mobile), `96px` (desktop)
- Resize: `vertical` only
- Mismos estados que text input

#### Search

- Ícono de search a la izquierda (`16px`, color `--color-text-muted`)
- Al escribir: ícono de X a la derecha para limpiar
- No tiene label flotante — solo placeholder
- Fondo: `--color-bg-surface` (no blanco puro, para diferenciarlo del contenido)

#### Responsive
- Mobile: ancho completo
- Desktop: ancho de contenedor, max 480px en formularios estándar

#### Accesibilidad
- `<label>` siempre asociado con `for`/`id` o envolviendo el input
- Error: `role="alert"` en el texto de error, `aria-describedby` desde el input
- `aria-invalid="true"` en estado de error
- Focus ring visible siempre

---

### 3.3 Card

**Variantes:** `estado-financiero`, `movimiento`, `pendiente`, `insight`, `deuda`, `pago-que-viene`

#### Especificación base

| Propiedad | Valor |
|---|---|
| Background | `--color-bg-surface` (`#F0EFEA`) |
| Border | `1px solid --color-border-default` (`#E5E4E0`) |
| Border-radius | `--radius-lg` (12px) |
| Shadow | `--shadow-sm` |
| Padding | 16px (mobile), 20px (desktop) |

Regla global de cards: no usar barras verticales laterales (`border-left`) como acento visual. Los estados se comunican con badge, icono, fondo sutil y borde normal.

#### Estados de card

| Estado | Background | Border | Shadow | Cambio |
|---|---|---|---|---|
| Default | `#F0EFEA` | `#E5E4E0` 1px | `shadow-sm` | — |
| Hover (interactiva) | `#E8E7E2` | `#C8C7C3` 1px | `shadow-md` | cursor: pointer |
| Active/Pressed | `#E0DFD9` | `#C8C7C3` 1px | `shadow-xs` | scale: 0.99 |
| Focused | `#F0EFEA` | `#4A7C59` 2px | `shadow-sm` | outline: 2px |
| Disabled | `#F5F4F2` | `#E5E4E0` 1px | none | opacity: 0.5, pointer-events: none |
| Loading | `#F0EFEA` | `#E5E4E0` 1px | `shadow-sm` | skeleton overlay |
| Error | `#FFF5F5` | `#C95252` 1px | `shadow-sm` | — |
| Success | `#F5FFF8` | `#349964` 1px | `shadow-sm` | — |

#### Card: Estado financiero (Dinero libre, Mi Dinero)

```
┌─────────────────────────────────┐
│ [Label H3] Dinero libre          │  ← text-h3, color text-secondary
│ [Display] S/220                  │  ← text-display, color text-primary, tabular-nums
│ [Caption] De S/800 total         │  ← text-caption, color text-muted
│ ─────────────────────────────── │  ← divider 1px border-default
│ [CTA ghost sm] Ver desglose      │  ← button ghost sm, color brand
└─────────────────────────────────┘
```

Altura variable. Mínimo 96px.

#### Card: Movimiento (fila en lista)

```
┌─────────────────────────────────┐
│ [Ícono 20px] [Body/500] Cafe  S/8│  ← ícono categoría + descripción + monto derecho
│ [Caption] Gasto · Alimentación   │  ← tipo · categoría
│ [Caption] WhatsApp · Confirmado  │  ← fuente · estado
│                    [Editar] [?]  │  ← acciones ghost icon-only sm
└─────────────────────────────────┘
```

Altura: 72px (con una línea de acciones), 84px (si hay estado de corrección).

Modo discreto: monto reemplazado por `•••`, comercio por texto genérico si aplica política.

#### Card: Pendiente

```
┌─────────────────────────────────┐
│ [Badge warning] Por revisar      │  ← badge estado
│ [Body/500] Email detectado       │  ← título tipo pendiente
│ [Body] Yape S/45 · Restaurante   │  ← dato
│ [Caption] No afecta saldo        │  ← aclaración
│ [Btn secondary sm] Confirmar     │  ← acción primaria
│ [Btn ghost sm] Editar  Rechazar  │  ← acciones secundarias
└─────────────────────────────────┘
```

Sin barra lateral. El estado se comunica con badge warning, icono circular suave y background `--color-warning-subtle` con borde normal `1px solid --color-border-default`.

#### Card: Insight/Descubrimiento

```
┌─────────────────────────────────┐
│ [Ícono 16px] Manzana notó algo   │  ← caption brand, ícono spark
│ [Body/500] Transporte subió S/75 │  ← título del insight
│ [Body-small] La mayor parte fue  │  ← evidencia resumida
│              Uber de trabajo     │
│ [Btn ghost sm] Ver movimientos   │  ← CTA accionable
│ [Ghost sm] Ignorar               │  ← descarte
└─────────────────────────────────┘
```

Sin barra lateral. El insight se comunica con icono `sparkles`, label brand, fondo `--color-brand-subtle` al 35-45% y borde normal `1px solid --color-border-default`.

#### Card: Deuda

```
┌─────────────────────────────────┐
│ [Body/600] Laptop en cuotas      │  ← nombre deuda
│ [Monto-lg] S/1,200 / S/2,400     │  ← pagado / total
│ [Progress bar 8px alto]  50%     │  ← barra de progreso
│ [Caption] Próxima S/400 · 26 may │  ← próximo pago
│ [Btn primary sm] Registrar pago  │  ← CTA
│ [Ghost sm] Ver detalle           │
└─────────────────────────────────┘
```

Barra de progreso:
- Track: `--color-progress-track` (#E5E4E0)
- Relleno: `--color-progress-fill` (#4A7C59)
- Si < 30%: relleno `--color-progress-low` (#E5A93D)
- Border-radius: `--radius-full`

#### Card: Pago que viene

```
┌─────────────────────────────────┐
│ [Badge] Activo  ·  [Caption] S/89│  ← estado + monto alineado derecha
│ [Body/500] Internet              │  ← nombre
│ [Caption] Entre 12 y 15 de junio │  ← fecha estimada
│ [Btn secondary sm] Marcar pagado │
└─────────────────────────────────┘
```

Badge "Sugerido": color `--color-warning-subtle`, texto `--color-warning`.
Badge "Activo": color `--color-success-subtle`, texto `--color-success`.
Badge "Vencido": color `--color-error-subtle`, texto `--color-error`.

---

### 3.4 Badge / Tag

**Variantes:** `estado`, `categoria`, `fuente`, `tipo-financiero`

| Propiedad | Valor |
|---|---|
| Padding | 2px 8px (xs) o 4px 10px (sm) |
| Font | Micro 11px/400 (xs) o Label 12px/500 (sm) |
| Border-radius | `--radius-sm` (4px) o `--radius-full` para pills |
| Altura | 18px (xs) o 22px (sm) |

#### Badges de estado

| Estado | Background | Text color |
|---|---|---|
| Confirmado | `--color-success-subtle` | `--color-success` |
| Pendiente | `--color-warning-subtle` | `--color-warning` |
| Por revisar | `--color-warning-subtle` | `--color-warning` |
| Corregido | `--color-info-subtle` | `--color-info` |
| Error | `--color-error-subtle` | `--color-error` |
| Eliminado | `--color-bg-surface` | `--color-text-muted` |
| Activo | `--color-success-subtle` | `--color-success` |
| Vencido | `--color-error-subtle` | `--color-error` |
| Sugerido | `--color-warning-subtle` | `--color-warning` |
| Estimado | `--color-bg-surface` + dashed border | `--color-text-muted` |

#### Badges de fuente

| Fuente | Background | Text | Ícono |
|---|---|---|---|
| WhatsApp | `#D4EDDF` | `#2D7A4A` | WhatsApp 12px |
| Email | `--color-info-subtle` | `--color-info` | Mail 12px |
| Dashboard | `--color-bg-surface` | `--color-text-secondary` | Monitor 12px |
| Auto-detectado | `--color-warning-subtle` | `--color-warning` | Sparkles 12px |

#### Badges de tipo financiero (no usar solo color — siempre texto también)

| Tipo | Background | Text |
|---|---|---|
| Gasto | `#F5E0DA` | `#7A2B1E` |
| Ingreso | `--color-success-subtle` | `--color-success` |
| Deuda | `--color-debt-subtle` | `--color-debt` |
| Transferencia | `--color-info-subtle` | `--color-info` |
| Pago deuda | `--color-success-subtle` | `--color-success` |
| Ajuste | `--color-bg-surface` | `--color-text-muted` |

---

### 3.5 Toast / Banner

**Variantes:** `success`, `error`, `warning`, `info`, `recalculo`  
**Posición:** esquina inferior derecha en desktop (bottom: 24px, right: 24px); bottom center en mobile (bottom: 80px para no tapar bottom nav)

| Propiedad | Valor |
|---|---|
| Ancho | 320px (desktop) / calc(100% - 32px) (mobile) |
| Padding | 12px 16px |
| Border-radius | `--radius-lg` (12px) |
| Shadow | `--shadow-lg` |
| Font | Body-small 13px/400 para mensaje; Label 14px/500 para acción |
| Ícono | 20px alineado arriba-izquierda |
| Z-index | `--z-toast` |
| Duración visible | 4000ms (auto-dismiss), 8000ms si tiene acción |
| Animación entrada | slide-up 250ms `--ease-enter` |
| Animación salida | fade-out 200ms `--ease-exit` |

| Variante | Background | Ícono | Border |
|---|---|---|---|
| Success | `--color-success-subtle` | check-circle, `--color-success` | `1px solid --color-success-subtle` |
| Error | `--color-error-subtle` | alert-circle, `--color-error` | `1px solid --color-error-subtle` |
| Warning | `--color-warning-subtle` | alert-triangle, `--color-warning` | `1px solid --color-warning-subtle` |
| Info | `--color-info-subtle` | info, `--color-info` | `1px solid --color-info-subtle` |
| Recálculo | `--color-brand-subtle` | refresh-cw, `--color-brand-primary` | `1px solid --color-brand-subtle` |

Accesibilidad: `role="status"` para success/info/recálculo; `role="alert"` para error/warning.

---

### 3.6 Modal / Drawer

**Variantes:** `confirmacion`, `detalle`, `formulario`, `riesgo`

#### Modal (desktop)

| Propiedad | Valor |
|---|---|
| Overlay | `rgba(45,49,46,0.5)`, `backdrop-filter: blur(2px)` |
| Background | `--color-bg-surface-raised` (#FFFFFF) |
| Border-radius | `--radius-xl` (16px) |
| Shadow | `--shadow-xl` |
| Ancho | 480px (confirmación), 560px (formulario), 640px (detalle) |
| Padding | 24px |
| Max-height | 80vh con scroll interno |
| Z-index | `--z-modal` |
| Animación entrada | scale de 0.96 → 1 + fade, 250ms `--ease-enter` |
| Cierre | Escape, click overlay, botón X, botón Cancelar |

#### Drawer (mobile — bottom sheet)

| Propiedad | Valor |
|---|---|
| Background | `--color-bg-surface-raised` |
| Border-radius | `--radius-2xl` (24px) top-left y top-right únicamente |
| Handle | barra 4px × 32px, `--color-border-strong`, centrada, margin-top 8px |
| Padding | 0 16px 24px |
| Max-height | 90vh |
| Z-index | `--z-drawer` |
| Animación entrada | slide-up desde bottom, 350ms `--ease-enter` |
| Cierre | swipe-down, botón X, backdrop tap |

#### Modal de confirmación

```
┌──────────────────────────────────┐
│ [H2] ¿Confirmas borrar?           │
│ [Body] Taxi S/15 · 14 de mayo    │  ← contexto claro
│ [Caption] Esta acción no se puede │
│           deshacer.               │  ← consecuencia
│ ────────────────────────────────  │
│ [Btn secondary] Cancelar          │
│ [Btn danger] Sí, borrar           │  ← peligroso a la derecha
└──────────────────────────────────┘
```

Regla: acción destructiva siempre a la derecha. Cancelar no usa estilo ghost en modales de riesgo (debe ser prominente).

#### Modal de riesgo (sensible)

Misma estructura pero:
- Fondo overlay más oscuro: `rgba(45,49,46,0.7)`
- Borde de modal: `2px solid --color-error` 
- Ícono alert `24px --color-error` al inicio del título

---

### 3.7 Sidebar desktop

| Propiedad | Valor |
|---|---|
| Ancho expandida | 240px |
| Ancho colapsada | 64px |
| Background | `--color-bg-surface` |
| Border-right | `1px solid --color-border-default` |
| Padding | 16px 12px |
| Z-index | `--z-sticky` |

#### Item de navegación

| Estado | Background | Text color | Icon color | Indicador izq. |
|---|---|---|---|---|
| Default | transparent | `--color-text-secondary` | `--color-text-muted` | none |
| Hover | `--color-brand-subtle` | `--color-text-primary` | `--color-brand-primary` | none |
| Active | `--color-brand-subtle` | `--color-brand-primary` | `--color-brand-primary` | 3px `--color-brand-primary` |
| Focused | transparent | `--color-text-primary` | `--color-brand-primary` | outline 2px |
| Disabled | transparent | `--color-text-disabled` | `--color-text-disabled` | none |

Altura de ítem: 44px (cumple tap target). Ícono 20px. Label: Label 14px/500. Border-radius del ítem: `--radius-md`.

**Badge de pendientes:** pill rojo (`--color-error`), texto blanco, posición top-right del ícono. Máximo 2 dígitos (si >99 mostrar "99+").

#### Colapsada (solo íconos)
- Ícono centrado
- Tooltip con label al hacer hover (delay 500ms)
- Badge sigue visible

---

### 3.8 Bottom nav mobile

| Propiedad | Valor |
|---|---|
| Background | `--color-bg-surface-raised` |
| Border-top | `1px solid --color-border-default` |
| Height | 56px + safe-area-inset-bottom |
| Padding bottom | max(8px, env(safe-area-inset-bottom)) |
| Shadow | `0 -2px 8px rgba(45,49,46,0.06)` |
| Z-index | `--z-sticky` |

Máximo 5 ítems. Ícono 24px. Label: Micro 11px/400. Ícono + label apilados, centrados.

| Estado | Ícono color | Label color | Background |
|---|---|---|---|
| Default | `--color-text-muted` | `--color-text-muted` | transparent |
| Active | `--color-brand-primary` | `--color-brand-primary` | transparent |
| Pressed | `--color-brand-active` | `--color-brand-active` | `--color-brand-subtle` circular |
| Focused | `--color-brand-primary` | `--color-brand-primary` | outline 2px |

Badge de "Mas": si hay pendientes agrupados en el menú más, mismo badge rojo que sidebar.

---

### 3.9 Topbar

| Propiedad | Valor |
|---|---|
| Height | 56px (mobile), 64px (desktop) |
| Background | `--color-bg-surface-raised` |
| Border-bottom | `1px solid --color-border-default` |
| Padding | 0 16px (mobile), 0 24px (desktop) |
| Shadow | `--shadow-xs` |
| Z-index | `--z-sticky` |

Contenido:
- Izquierda: título de sección — H2 20px/600 en mobile, H1 24px/600 en desktop
- Centro (desktop): barra de búsqueda natural (`Input search`, max-width 400px)
- Derecha: acciones ghost icon-only (máx. 3 íconos: búsqueda en mobile, modo discreto, perfil/config)

En mobile la búsqueda está en la derecha como ícono que expande o navega a Búsqueda.

---

### 3.10 Fila de movimiento

Componente de lista para pantalla Movimientos.

| Propiedad | Valor |
|---|---|
| Altura | 72px (default), 84px (con estado extendido) |
| Padding | 12px 16px |
| Border-bottom | `1px solid --color-border-default` |
| Background | `--color-bg-surface-raised` |

Layout:
```
[Ícono categoría 36px] | [Columna texto flex-1] | [Monto 72px derecha]
                       | Body/500: descripción   | Monto-sm
                       | Caption: tipo · cat      | Caption: fecha
                       | Caption: fuente · estado |
```

- Ícono de categoría: 36×36px, background `--color-brand-subtle`, ícono Lucide 20px `--color-brand-primary`, `--radius-md`
- Monto positivo (ingreso): `--color-success`
- Monto negativo o gasto: `--color-text-primary` (no rojo — gastar no es error)
- Monto de deuda/pago deuda: `--color-debt`
- Estado "Por corregir": indicador punto amarillo `8px` a la derecha del estado label
- Swipe actions en mobile: izquierda = Eliminar (danger, ícono trash), derecha = Editar (secondary, ícono edit)

Modo discreto: monto reemplazado por `•••` con color `--color-text-discrete`.

---

### 3.11 Fila de pendiente

Similar a fila de movimiento pero con acciones de resolución.

| Propiedad | Valor |
|---|---|
| Indicador semántico | Badge warning + icono circular warning |
| Background | `--color-warning-subtle` (6-10% opac) |
| Border | `1px solid --color-border-default` |

Acciones inline debajo del contenido:
- `[Confirmar]` — button secondary sm
- `[Editar]` — button ghost sm
- `[Ya registrado]` — button ghost sm
- `[Rechazar]` — button ghost sm, color texto `--color-error`

---

### 3.12 Empty state

| Propiedad | Valor |
|---|---|
| Container | centrado vertical y horizontal, max-width 320px |
| Ilustración | 120×120px, estilo lineal brand |
| Título | H2 20px/600, `--color-text-primary` |
| Descripción | Body 15px/400, `--color-text-secondary`, max 2 líneas |
| CTA principal | button primary md |
| CTA secundario | button ghost md o link |
| Espacio entre elementos | `--space-4` (16px) |

Regla: nunca mostrar vacío como fracaso. Copy siempre con dirección positiva ("Empieza por una cosa", no "No hay datos").

---

### 3.13 Formulario dinámico de movimiento

Abre como modal (desktop) o bottom drawer (mobile).

Estructura:
```
[Header: "Nuevo movimiento" H2] [X cerrar]
─────────────────────────────────────────
[Select: Tipo de movimiento] ← siempre visible
[Input monto: S/ ___] ← siempre visible
[Input fecha: Hoy] ← siempre visible, editable
[Campos condicionales según tipo]
─────────────────────────────────────────
[Bloque impacto] ← resumen antes de guardar
─────────────────────────────────────────
[Btn secondary: Cancelar] [Btn primary: Guardar]
[Btn ghost: Guardar y registrar otro] ← debajo
```

**Campos condicionales por tipo:**

| Tipo | Campos adicionales |
|---|---|
| gasto | Cuenta/caja origen, Categoría (requerida), Descripción |
| ingreso | Cuenta/caja destino, Categoría |
| transferencia | Cuenta origen (req.), Cuenta destino (req.), Descripción |
| asignacion_interna | Cuenta origen (req.), Caja destino (req.) |
| deuda_adquirida | Persona/entidad (req.), Condiciones (opcional) |
| pago_deuda | Deuda vinculada (req.), Cuenta origen |
| prestamo_dado | Persona (req.), Cuenta origen |
| prestamo_recibido | Persona/entidad (req.), Cuenta destino |
| devolucion_recibida | Persona/deuda vinculada |
| pago_recurrente | Pago que viene vinculado |
| ajuste | Cuenta (req.), Motivo, confirmación de riesgo obligatoria |

**Bloque de impacto:** fondo `--color-brand-subtle`, texto `--color-text-secondary`, body-small. Ejemplo: "Sale de Yape y afecta dinero libre."

---

### 3.14 Filtros

#### Desktop (expandidos)

Panel horizontal debajo del topbar de pantalla Movimientos.

```
[Período ▼] [Tipo ▼] [Categoría ▼] [Fuente ▼] [Estado ▼] [Limpiar filtros]
```

- Cada filtro: button secondary sm con chevron
- Filtro activo: background `--color-brand-subtle`, texto `--color-brand-primary`, border `--color-brand-primary`
- Dropdown: same as select
- Limpiar filtros: ghost sm, visible solo si hay filtros activos

#### Mobile (compactos)

Fila horizontal scrollable con chips:

```
[scroll horizontal →]
[Esta semana ×] [Gastos ×] [+ Filtrar]
```

- Chips: badge pill, height 32px, padding 6px 12px
- Chip activo: background `--color-brand-subtle`, texto brand, × para quitar
- Botón "+ Filtrar": abre drawer con todos los filtros

---

### 3.15 Confirmación sensible

Pantalla completa de confirmación para acciones destructivas en mobile, o modal grande en desktop.

Estructura:
```
[Ícono alert-triangle 48px --color-error o warning, centrado]
[H1: ¿Confirmas borrar este movimiento?]
[Body: Detalles de lo que se borrará con contexto completo]
[Caption: Esta acción no se puede deshacer.]
────────────────────────────────────────
[Btn danger lg: Sí, borrar]
[Btn secondary lg: Cancelar] ← más prominente que en modales normales
```

Regla de oro: el usuario debe entender qué se borra y qué consecuencia tiene antes de confirmar.

---

### 3.16 Skeleton / Loading

Componente de placeholder para estados de carga.

| Propiedad | Valor |
|---|---|
| Color base | `--color-border-default` (#E5E4E0) |
| Color shimmer | `--color-bg-surface` (#F0EFEA) |
| Border-radius | matching al componente que reemplaza |
| Animación | shimmer de izquierda a derecha, 1.5s infinite `ease-in-out` |

Por componente:
- **Fila de movimiento:** rectángulo 36×36 (ícono) + 2 líneas (descripción + caption)
- **Card financiera:** rectángulo altura 96px
- **Topbar:** línea H2 + rectángulo de búsqueda
- **Sidebar:** N ítems con ícono + línea
- **Valor principal:** rectángulo 80×40px (simula Display)
- **Lista completa:** mostrar 4 filas skeleton al cargar

Regla: nunca bloquear toda la app. Mostrar skeleton solo en la sección que carga. Mantener navegación operativa.

---

### 3.17 Error state

#### Por pantalla

```
[Ícono wifi-off o alert 48px --color-text-muted]
[H2: No pude actualizar tus movimientos]
[Body: Tus datos anteriores siguen guardados.]
[Btn secondary: Reintentar]
```

#### Por componente (inline)

- Franja fina de error en la parte superior de la sección fallida
- Fondo `--color-error-subtle`, borde `1px --color-error`, ícono alert-circle 16px
- Texto: Body-small, color `--color-error`
- CTA: link o ghost sm

---

### 3.18 Búsqueda natural

#### Input global (topbar desktop / pantalla en mobile)

```
[Ícono search 18px] [Placeholder: "Pregunta algo sobre tu dinero..."] [X si hay texto]
```

- Fondo: `--color-bg-surface`
- Al activarse: border `--color-border-focus`, fondo `--color-bg-surface-raised`
- Panel de resultados: aparece debajo, shadow `--shadow-lg`, `--radius-md`, max-height 400px

#### Panel de resultados

```
[H3: Resultado rápido]
[Card con respuesta]
[Ver movimientos filtrados →]
────────────────────────────
[H3: Pendientes relacionados]  ← si aplica
[Fila de pendiente]
```

Sin resultados:
```
[Ícono search-x 32px --color-text-muted]
[Body: No encontré movimientos sobre eso.]
[Caption: También hay 1 pendiente sin confirmar.]
[Link: Revisar pendiente]
```

Intento de acción de escritura:
```
[Body: Para borrar un movimiento, ábrelo y confirma.]
[Link: Ver taxi de ayer →]
```

---

### 3.19 Desglose financiero (Mi Dinero)

```
┌──────────────────────────────────────┐
│ Dinero libre                          │  ← H3 label
│ S/220                                 │  ← Display, tabular-nums
│ ──────────────────────────────────── │
│ Total en cuentas          S/800      │  ← Body + Monto-sm derecha
│   − Cajas                 S/300      │  ← Body-small indentado + monto
│   = Libre en cuentas      S/500      │  ← Body/500 + monto
│   − Compromisos próximos  S/280      │  ← Body-small + monto
│   = Dinero libre          S/220      │  ← Body/600 brand + monto brand
│ ──────────────────────────────────── │
│ [Btn ghost sm] Ver cómo se calcula   │
└──────────────────────────────────────┘
```

Reglas visuales:
- Dato principal: `--text-display`, `--color-text-primary`
- Subtotales: `--text-body-sm`, `--color-text-secondary`
- Dinero libre final: `--color-brand-primary`
- Si hay dato estimado o incompleto: `--color-text-muted` + ícono info 12px

---

### 3.20 Progreso de deuda

```
[Barra full-width, 8px alto]
[Track: --color-progress-track]
[Relleno: --color-progress-fill si > 30%, --color-progress-low si ≤ 30%]
[Border-radius: --radius-full]
[Texto debajo: "S/1,200 pagado de S/2,400 (50%)"]
```

Animación: al entrar en viewport, el relleno hace grow de 0% a valor real, 500ms `--ease-spring`.

---

### 3.21 Pago que viene (activo vs. sugerido vs. vencido)

Ver sección 3.3 Card: Pago que viene.

Diferencias adicionales:
- **Activo:** badge "Activo", icono en contenedor `--color-success-subtle`, borde normal `1px solid --color-border-default`
- **Sugerido:** badge "Sugerido", icono en contenedor `--color-warning-subtle`, borde normal `1px solid --color-border-default`
- **Vencido:** badge "Vencido", icono en contenedor `--color-error-subtle`, monto en `--color-error`, borde normal `1px solid --color-error-subtle`
- **Pausado:** opacidad 0.6, badge "Pausado", sin CTA primario

---

### 3.22 Descubrimiento / Insight

Ver sección 3.3 Card: Insight/Descubrimiento.

Diferencias por tipo:
- **Gasto atípico:** ícono `trending-up`, badge warning, fondo `--color-warning-subtle`
- **Progreso positivo:** ícono `award`, badge success, fondo `--color-success-subtle`
- **Cambio de pago:** ícono `refresh-cw`, badge info, fondo `--color-info-subtle`
- **Aprendizaje temprano:** ícono `sparkles`, badge brand, fondo `--color-brand-subtle`
- **Liquidez:** ícono `coins`, badge brand, fondo `--color-brand-subtle`

---

## 4. Reglas globales

### 4.1 Grid y layout

| Breakpoint | Columnas | Gutter | Márgenes |
|---|---|---|---|
| Mobile (< 768px) | 4 | 16px | 16px |
| Tablet (768–1023px) | 8 | 24px | 24px |
| Desktop (≥ 1024px) | 12 | 24px | 32px (área contenido sin sidebar) |

Ancho máximo de contenedor: `1440px`. Centrado con `margin: 0 auto`.

---

### 4.2 Contenedores máximos por pantalla

| Pantalla | Max-width contenido |
|---|---|
| Home | 800px |
| Movimientos | 900px |
| Detalle movimiento | 640px |
| Nuevo movimiento (modal) | 560px |
| Pendientes | 800px |
| Mi Dinero | 720px |
| Deudas | 800px |
| Pagos que vienen | 800px |
| Descubrimientos | 800px |
| Búsqueda natural | 640px (panel resultados) |
| Configuración | 640px |

---

### 4.3 Truncado de texto

- Descripciones de movimiento: 1 línea en lista, `text-overflow: ellipsis`
- Nombre de persona/comercio: 1 línea máximo en fila de lista
- Copy de insight: 2 líneas máximo en card de Home; sin límite en pantalla de Descubrimientos
- Montos: nunca truncar — ajustar layout si el monto es largo (usar Monto-sm en filas si es necesario)

---

### 4.4 Formato de montos

- Prefijo: `S/` sin espacio antes del número (Soles peruanos)
- Decimales: siempre 2 decimales en inputs; opcional en displays si .00 (ocultar si es entero en UI principal; mostrar en detalle)
- Negativos: `−S/15` (guión largo `\u2212`, no guión corto)
- Miles: separador de espacio fino `\u202f` — `S/1 200` (no coma americana, no punto europeo)
- Color positivo (ingresos cuando se muestra semánticamente): `--color-success`
- Color negativo/deuda cuando aplica: `--color-debt` o `--color-error` según contexto
- Montos no confirmados/estimados: `~S/15` con color `--color-text-muted`

---

### 4.5 Formato de fechas

| Contexto | Formato | Ejemplo |
|---|---|---|
| Fila de movimiento (reciente) | relativo | "hace 2 horas", "ayer" |
| Fila de movimiento (> 7 días) | `D MMM` | "14 may" |
| Fila de movimiento (otro año) | `D MMM YYYY` | "3 ene 2025" |
| Fecha exacta (detalle) | `D de MMMM de YYYY` | "14 de mayo de 2026" |
| Pago que viene | `Entre D y D` o `Día D` | "Entre 12 y 15" o "Día 26" |
| Vencimiento | `D de MMMM` con urgencia si < 7 días | "26 de mayo" |

---

### 4.6 Contraste y accesibilidad

- Texto normal (< 18px o < 14px bold): ratio mínimo 4.5:1 (WCAG 2.1 AA)
- Texto grande (≥ 18px o ≥ 14px bold): ratio mínimo 3:1
- Íconos con significado: ratio mínimo 3:1
- Focus ring visible en todos los elementos interactivos: `outline: 2px solid --color-border-focus`, `outline-offset: 2px`
- No depender solo del color para estados (siempre acompañar con ícono, texto o forma)
- Tap target mínimo: 44×44px en mobile
- Todos los botones icon-only tienen `aria-label`
- Inputs tienen `<label>` o `aria-label`
- Errores de formulario tienen `role="alert"` y `aria-describedby`
- Imágenes decorativas: `alt=""`; imágenes con significado: `alt` descriptivo
- Modales/drawers: `role="dialog"`, `aria-modal="true"`, focus trap, Escape cierra

---

### 4.7 Reglas de modo discreto

- Montos: reemplazar con `•••` usando `--color-text-discrete`
- Comercios/personas: texto genérico ("un comercio", "alguien")
- Fondo de elemento con dato oculto: `--color-bg-discrete`
- No desactivar interacciones — el usuario puede aún navegar y hacer clic para ver en contexto autenticado

---

## 5. Criterios de aceptación

- Cada token tiene un nombre semántico usable en código y un valor exacto en hex / px / ms.
- Todos los colores de modo claro tienen override de modo oscuro.
- Cada componente tiene especificación de al menos 5 estados: default, hover, active, focused, disabled.
- Componentes con datos financieros tienen spec de estado loading, error y modo discreto.
- Todos los tap targets en mobile son ≥ 44×44px.
- Contraste WCAG 2.1 AA verificado para texto/fondo en colores primarios y de estado.
- Formatos de monto y fecha siguen estándar peruano definido.
- Los 22 componentes del inventario (Doc 18, sección 20) están especificados.
- Cursor puede implementar cualquier componente directamente desde este documento sin adivinar valores.

---

*Fase 6 Visual - Documento 29 - V1*
