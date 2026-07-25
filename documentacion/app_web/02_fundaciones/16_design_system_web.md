# 16 — Design system

**Bloque:** 02 — Fundaciones
**Estado:** V1 (migración con mejoras)
**Fecha:** 25 de julio de 2026
**Depende de:** `10_sitemap_rutas_y_navegacion.md`, `08_principios_experiencia_web.md`
**Documentos que dependen de este:** §8 y §18 de todos los módulos, `17_patrones_datos_formularios_y_listados.md`
**Fuentes:** `docs/fase_6_visual/29_design_system_ui.md` (tokens y 22 componentes), `docs/fase_6_visual/28_identidad_visual_marca.md`, `src/app/globals.css` (181 variables ya implementadas)

---

## 1. Estado actual y qué falta

Los tokens están bien y ya viven en código: `src/app/globals.css` define 181
variables CSS con `@theme inline` de Tailwind v4, cubriendo color, tipografía,
espaciado, radios, sombras, z-index, transiciones y layout. Esa parte se
conserva sin cambios.

El problema es el catálogo de componentes. `src/shared/ui/` tiene ocho
archivos:

```text
button.tsx (61)  card.tsx (45)  field.tsx (71)  states.tsx (99)
money.tsx (94)   badge.tsx (31) switch.tsx (46) cn.ts (4)
```

No existen Modal, Tabs, Dropdown, Tooltip, Toast, Table, Pagination,
Checkbox, Radio, Textarea, DatePicker, Popover ni Accordion. Las
consecuencias son medibles:

- **17 modales escritos a mano** con `fixed inset-0` y `role="dialog"`
  duplicados: 7 en Mi Dinero, 4 en Pagos que vienen, 3 en Deudas, 2 en
  Movimientos, 1 en Pendientes.
- Un parche global de accesibilidad, `modal-accessibility-guard.tsx`, que
  usa un `MutationObserver` recorriendo el DOM para inyectar atrapado de
  foco en modales que se escribieron sin él. Su propio comentario menciona
  "los legados".
- Miles de líneas de clases de Tailwind repetidas dentro de las pantallas,
  porque no hay componente que las encapsule.

El sistema de tokens es maduro; el catálogo que los consume es raquítico.
Este documento cierra esa brecha.

## 2. Principios

1. **Un componente por patrón.** Si dos pantallas necesitan lo mismo, existe
   un componente. No se copia.
2. **Accesible por construcción, no por parche.** El atrapado de foco, las
   etiquetas y los roles viven dentro del componente. El
   `modal-accessibility-guard` desaparece cuando exista `Dialog`.
3. **Los tokens son la única fuente de valores.** Ningún componente escribe
   un color, un espaciado o un radio literal.
4. **Estados completos desde el diseño.** Todo componente interactivo define
   reposo, hover, foco, activo, deshabilitado, cargando y error.
5. **Modo claro y oscuro desde el primer día.** El modo oscuro está
   especificado en Fase 6 y no implementado (`C-12`); nace con el componente,
   no después.
6. **Composición sobre configuración.** Un componente con quince props
   booleanas es dos componentes mal separados.

## 3. Tokens

Se conservan íntegros los de `src/app/globals.css`. Resumen de lo relevante
para decidir:

| Grupo | Contenido |
|---|---|
| Fondo | `bg-primary` `#F9F8F6`, `bg-surface`, `bg-surface-raised`, `bg-discrete`, `bg-inverse` |
| Marca | `brand-primary` `#316342`, hover, active, subtle |
| Acento | `accent` `#C96A52` (terracota), hover, subtle |
| Texto | primary, secondary, muted, disabled, inverse, discrete, brand |
| Bordes | default, strong, focus, error |
| Semánticos | success, warning, error, info, cada uno con su variante `subtle` |
| Deuda | `debt` `#7A3E2B`, subtle, paid |
| Progreso | fill, low, track |
| Tipografía | DM Sans (títulos), Inter (cuerpo) |
| Espaciado | base 4px, escala de `--space-0` a `--space-20` |
| Radios | de `xs` 2px a `2xl` 24px, más `full` |
| Sombras | de `xs` a `xl`, todas con tinte verde-gris coherente con la marca |
| Z-index | base, above, sticky, overlay, drawer, modal, toast, tooltip, popover |
| Transiciones | instant 80ms a slower 500ms, con cuatro curvas |
| Layout | `sidebar-width` 240px, `sidebar-collapsed` 64px |

**Ampliación requerida.** Faltan tokens para los módulos nuevos:

| Nuevo grupo | Para qué |
|---|---|
| Gráficos: paleta categórica de 8 colores | `35_modulo_reportes_graficos_y_exportacion.md`. Debe distinguirse sin depender solo del color y funcionar en ambos modos. |
| Presupuesto: `budget-ok`, `budget-warning`, `budget-over` | Semáforo de avance. Reutiliza los semánticos, pero con nombre propio para no acoplar significado a color. |
| Superficies del asistente: burbuja de usuario y de respuesta | `41_asistente_ia_en_la_app.md` |

### 3.1 Modo oscuro

`globals.css` ya tiene un bloque `@media (prefers-color-scheme: dark)`. Se
completa con dos requisitos:

1. **Selección manual además de la del sistema.** El usuario puede forzar
   claro u oscuro; se persiste como preferencia de servidor junto al resto
   (`experience_preference_events`).
2. **Todos los tokens semánticos tienen valor en ambos modos**, incluidos los
   de deuda, progreso y gráficos. Un token sin par oscuro es un defecto.

Regla de contraste: mínimo 4.5:1 para texto normal y 3:1 para texto grande y
elementos de interfaz, **verificado en ambos modos**.

## 4. Catálogo de componentes

### 4.1 Existentes — se conservan y amplían

| Componente | Estado | Qué falta |
|---|---|---|
| `Button` | Correcto | Estado de carga, variante destructiva, tamaño icono |
| `Card` | Correcto | Variante interactiva (toda la tarjeta es un enlace) |
| `Field` (Label, Input, Select) | Base correcta | Descripción, mensaje de error, prefijo/sufijo, estado requerido |
| `States` (Empty, Error, Loading, Skeleton) | Muy bien resuelto | Esqueletos con la forma real de cada contenido |
| `Money` (MoneyText, DiscreetValue) | Correcto | Variante compacta, signo explícito según tipo |
| `Badge` | Correcto | Variantes por estado de dominio |
| `Switch` | Correcto | Estado de carga mientras se guarda |

### 4.2 Faltantes — se crean

Cada uno con su API, sus estados y su comportamiento de teclado.

| Componente | Reemplaza | Teclado |
|---|---|---|
| **Dialog** | Los 17 modales a mano y el `modal-accessibility-guard` | `Escape` cierra; foco atrapado; al cerrar vuelve al disparador |
| **Sheet** | Paneles laterales y hojas inferiores de móvil | Igual que Dialog; en móvil, arrastrar hacia abajo cierra |
| **AlertDialog** | Confirmaciones de riesgo | `Escape` **no** cierra; exige decisión explícita |
| **Toast** | Avisos de éxito y error dispersos | Anuncia por región activa; incluye acción "Deshacer" |
| **Tabs** | Secciones dentro de una pantalla | Flechas navegan, `Home`/`End` van a extremos |
| **DropdownMenu** | Menús de acciones por fila | Flechas navegan, `Escape` cierra, se escribe para buscar |
| **Popover** | Contenido contextual no modal | `Escape` cierra; no atrapa el foco |
| **Tooltip** | Ayuda breve | Aparece con foco de teclado, no solo con ratón |
| **Table** | Listados tabulares de Reportes | Navegación por celdas; cabeceras asociadas |
| **Pagination** | El botón "Ver más" que hoy no tiene manejador | Botones reales, estado deshabilitado correcto |
| **Checkbox** / **RadioGroup** | Selección múltiple en listados y opciones de formulario | Estándar; estado indeterminado en Checkbox |
| **Textarea** | Notas y contexto de enriquecimiento | Autoajuste de altura, contador si hay límite |
| **DatePicker** / **DateRangePicker** | Fechas de movimientos, filtros, periodos | **Entrada por texto siempre disponible**, no solo el calendario |
| **Combobox** | Selección de categoría, cuenta, persona con búsqueda | Se escribe para filtrar; anuncia resultados |
| **Command** | Paleta de comandos (`38_modulo_busqueda_y_navegacion_rapida.md`) | Atajo global; flechas y `Enter` |
| **Progress** | Avance de presupuesto, meta y deuda | Valor accesible; no depende solo del color |
| **Avatar** | Perfil e iniciales | — |
| **Separator**, **ScrollArea**, **VisuallyHidden** | Utilidades | — |

### 4.3 Componentes de dominio

Encapsulan patrones específicos de Manzana. Viven en `src/ui/dominio/` y
componen sobre las primitivas:

| Componente | Qué resuelve |
|---|---|
| `MovementRow` | Fila de movimiento con tipo, monto, categoría, estado y origen |
| `PendingRow` | Fila de pendiente con acciones de confirmar y descartar |
| `MoneyBreakdown` | El desglose de las 4 capas de `09_modelo_mental_dinero.md` |
| `SourceBadge` | Origen legible del dato ("Detectado en tu correo del BCP") |
| `StatusBadge` | Estado de confianza según `11_confianza_errores_y_reversibilidad.md` §3 |
| `EvidenceLink` | El "¿de dónde sale esta cifra?" transversal |
| `ConfirmationCard` | Tarjeta de confirmación del asistente antes de escribir |
| `BudgetMeter` | Avance de presupuesto con semáforo y lenguaje sin culpa |
| `DebtProgress` | Progreso de pago de una deuda |
| `UpcomingCard` | Pago que viene, en sus estados activo, sugerido y vencido |
| `DiscoveryCard` | Descubrimiento con su evidencia |
| `Chart` | Envoltura accesible de gráfico con tabla equivalente |

`EvidenceLink` y `ConfirmationCard` son los dos componentes que
materializan los principios de procedencia y control
(`08_principios_experiencia_web.md` §4.1 y §4.2). Si no existen como
componentes, esos principios quedan como buenas intenciones.

## 5. Contrato de Dialog

Detallado porque reemplaza 17 implementaciones y un parche global.

```tsx
<Dialog open onOpenChange>
  <DialogContent size="sm | md | lg" dismissible>
    <DialogHeader>
      <DialogTitle />        {/* obligatorio: nombra el diálogo */}
      <DialogDescription />  {/* opcional */}
    </DialogHeader>
    {/* contenido */}
    <DialogFooter />
  </DialogContent>
</Dialog>
```

Garantías que el componente ofrece, y que hoy provee un `MutationObserver`
externo:

- `role="dialog"` y `aria-modal="true"`.
- `aria-labelledby` apuntando al título. **Un diálogo sin título es un error
  en tiempo de desarrollo.**
- Foco atrapado mientras está abierto.
- El foco vuelve al elemento disparador al cerrar.
- Fondo inerte: el contenido detrás no es alcanzable con teclado ni lector.
- Se bloquea el desplazamiento del fondo sin que la página salte.
- En móvil se presenta como hoja inferior por defecto.

`AlertDialog` cambia dos cosas: `Escape` y el clic fuera **no** cierran, y el
botón de confirmación nombra la acción ("Borrar movimiento"), nunca dice
"Aceptar".

## 6. Formato de datos

| Dato | Formato | Ejemplo |
|---|---|---|
| Moneda | `S/` + separador de miles + 2 decimales | `S/1,250.50` |
| Moneda compacta | Sin decimales si son `.00` | `S/1,250` |
| Modo discreto | Puntos, conservando el ancho | `S/•••` |
| Fecha corta | `D MMM` | `14 jul` |
| Fecha con año | `D MMM YYYY` | `14 jul 2025` |
| Fecha relativa | Hasta 7 días | `hoy`, `ayer`, `hace 3 días` |
| Fecha y hora | `D MMM, HH:mm` | `14 jul, 15:30` |
| Porcentaje | Sin decimales salvo que aporten | `68%` |

Reglas: la zona horaria de presentación es `America/Lima`. Los montos
negativos se distinguen por signo y color, **nunca solo por color**. Las
cifras principales usan variante tabular para que las columnas alineen.

## 7. Reglas de layout

| Pantalla | Ancho máximo del contenido |
|---|---|
| Inicio | 1200px |
| Listados | 1200px |
| Detalles | 800px |
| Formularios | 640px |
| Configuración | 800px |
| Reportes | 1400px (los gráficos necesitan aire) |

Puntos de corte: móvil hasta 640px, tableta hasta 1024px, escritorio desde
1024px, ancho desde 1280px. La barra lateral colapsa por debajo de 1280px y
desaparece por debajo de 1024px, donde entra la navegación inferior.

## 8. Modo discreto

Es una política transversal, no un ajuste por pantalla (cierra `C-04`).
Cuando está activo:

- Los montos se sustituyen por puntos conservando el ancho, para que la
  interfaz no salte.
- Los nombres de comercios, personas y bancos se ocultan en tarjetas
  proactivas y en la bandeja de notificaciones.
- Las categorías sensibles usan lenguaje genérico.
- Dentro de un detalle abierto deliberadamente por el usuario, la
  información sí se muestra: el modo discreto protege miradas de reojo, no
  bloquea el uso.

La implementación es un proveedor único que consume la preferencia de
servidor. Ningún componente decide por su cuenta si oculta o no: consulta.

## 9. Accesibilidad

Requisitos que todo componente cumple antes de considerarse terminado:

- Alcanzable y operable con teclado.
- Foco visible con contorno de al menos 2px y separación, nunca eliminado.
- Nombre accesible correcto: los botones de solo icono llevan etiqueta.
- Estado comunicado por texto o atributo, no solo por color.
- Los cambios dinámicos se anuncian por región activa.
- Objetivos táctiles de al menos 44×44px en móvil.
- Respeta la preferencia de movimiento reducido.

El detalle transversal vive en `18_accesibilidad_i18n_y_formatos.md`.

## 10. Organización

```text
src/ui/
├── primitivas/      Button, Dialog, Table, Toast…
├── dominio/         MovementRow, MoneyBreakdown, ConfirmationCard…
├── graficos/        envolturas accesibles
└── tokens.ts        acceso tipado a los tokens
```

Reglas: un componente por archivo; ninguna primitiva importa de `dominio/`
ni de `modulos/`; ningún módulo redefine una primitiva.

## 11. Migración

| Paso | Qué |
|---|---|
| 1 | Crear las primitivas faltantes, empezando por `Dialog`, `Toast`, `Table` y `Pagination` |
| 2 | Migrar los 17 modales a `Dialog` / `AlertDialog` |
| 3 | **Eliminar `modal-accessibility-guard.tsx`** — su existencia es el indicador de que la migración terminó |
| 4 | Sustituir el botón "Ver más" sin manejador por `Pagination` real |
| 5 | Completar los tokens de modo oscuro y añadir la selección manual |
| 6 | Extraer los componentes de dominio de las pantallas actuales |

El paso 3 es el criterio de cierre: mientras ese archivo exista, hay modales
sin accesibilidad propia.

## 12. Criterios de aceptación

- `AC-DS-01` — Ningún componente escribe un color, espaciado o radio literal;
  todos usan tokens. Evidencia: `TEST` (regla de lint).
- `AC-DS-02` — Todo token semántico tiene valor en modo claro y oscuro.
  Evidencia: `TEST`.
- `AC-DS-03` — Todo contraste de texto cumple 4.5:1 en ambos modos.
  Evidencia: `TEST`.
- `AC-DS-04` — No existe ningún `role="dialog"` fuera del componente
  `Dialog`. Evidencia: `TEST`.
- `AC-DS-05` — `modal-accessibility-guard.tsx` ha sido eliminado.
  Evidencia: `CODE`.
- `AC-DS-06` — Un `Dialog` sin título accesible falla en desarrollo.
  Evidencia: `TEST`.
- `AC-DS-07` — Todo componente interactivo es operable solo con teclado.
  Evidencia: `TEST`.
- `AC-DS-08` — Ningún estado se comunica únicamente por color.
  Evidencia: `TEST` + `USER`.
- `AC-DS-09` — El modo discreto se aplica desde un único proveedor, no por
  decisión de cada pantalla. Evidencia: `CODE`.
- `AC-DS-10` — Ningún control visible carece de manejador funcional.
  Evidencia: `TEST`.
