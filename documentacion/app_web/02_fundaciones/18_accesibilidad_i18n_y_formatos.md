# 18 — Accesibilidad, idioma y formatos

**Bloque:** 02 — Fundaciones
**Estado:** V1
**Fecha:** 25 de julio de 2026
**Depende de:** `16_design_system_web.md`, `04_glosario_y_lenguaje_visible.md`
**Documentos que dependen de este:** §18 de todos los módulos, `51_estrategia_de_pruebas_web.md`

---

## 1. Para qué existe

La accesibilidad y el formato de datos se deciden una vez y se aplican en
todas partes. Cuando se dejan a criterio de cada pantalla, aparece lo que
hay hoy: un `MutationObserver` global parcheando modales escritos sin
accesibilidad, mensajes de error en inglés en una app en español, y helpers
de fecha duplicados con criterios distintos.

Objetivo declarado: **WCAG 2.2 nivel AA**, verificado, no aspiracional.

## 2. Por qué importa aquí en particular

Una aplicación de finanzas personales tiene tres agravantes:

1. **Los números son el contenido.** Si un lector de pantalla lee "menos
   ciento veinte" sin decir la moneda ni de qué cuenta, la información se
   pierde.
2. **Los errores tienen consecuencias.** Confirmar el movimiento equivocado
   porque el foco saltó a otro botón afecta el dinero real del usuario.
3. **Se usa en cualquier condición.** En el bus, con una mano, con poca
   batería, con la pantalla al sol. Las mismas condiciones que se benefician
   del diseño accesible.

## 3. Teclado

Todo lo que se puede hacer con ratón se puede hacer con teclado.

| Tecla | Comportamiento |
|---|---|
| `Tab` / `Shift+Tab` | Recorre en orden visual lógico |
| `Enter` | Activa botones y enlaces |
| `Espacio` | Activa botones, marca casillas |
| `Escape` | Cierra diálogos, paneles y menús — **excepto confirmaciones de riesgo** |
| Flechas | Navegan dentro de pestañas, menús, listas y calendarios |
| `Home` / `End` | Extremos de una lista o grupo |

Reglas:

- Foco visible siempre: contorno de 2px con separación. **Prohibido
  `outline: none` sin reemplazo equivalente.**
- Orden de foco coincide con el orden visual. Prohibido `tabindex` positivo.
- El foco no queda atrapado fuera de un diálogo, y sí queda atrapado dentro
  mientras está abierto.
- Al cerrar un diálogo, el foco vuelve al elemento que lo abrió.
- Enlace "Saltar al contenido" como primer elemento enfocable.

Atajos globales (definidos en `38_modulo_busqueda_y_navegacion_rapida.md`):
paleta de comandos, búsqueda, nuevo movimiento y asistente. Todos
descubribles desde una ayuda de atajos, y ninguno interfiere con los del
navegador ni con los de tecnologías asistivas.

## 4. Lectores de pantalla

| Requisito | Regla |
|---|---|
| Estructura | Encabezados jerárquicos sin saltar niveles; un solo `h1` por página |
| Puntos de referencia | `header`, `nav`, `main`, `aside`, `footer` correctos |
| Nombres accesibles | Todo control tiene nombre; los botones de solo icono llevan etiqueta |
| Imágenes | Texto alternativo descriptivo, o vacío si son decorativas |
| Formularios | Etiqueta asociada a cada campo; error vinculado con `aria-describedby` |
| Estados | `aria-current`, `aria-expanded`, `aria-selected`, `aria-invalid` según corresponda |
| Cambios dinámicos | Región activa: `polite` para avisos, `assertive` solo para errores críticos |
| Contenido en carga | `aria-busy`, y el esqueleto no se lee como contenido real |

Casos específicos de este producto:

| Elemento | Cómo se anuncia |
|---|---|
| Monto | Con moneda y signo: "menos S/120.50" o "120.50 soles de gasto" |
| Estado de un movimiento | Como texto, no solo por color: "por confirmar" |
| Avance de presupuesto | Valor y contexto: "68 por ciento de S/400 usado" |
| Gráfico | Descripción textual y tabla equivalente accesible |
| Modo discreto | El monto oculto se anuncia como "monto oculto", no como puntos |
| Notificación nueva | Región activa `polite`, sin interrumpir lo que el usuario hace |

## 5. Color y contraste

| Requisito | Valor |
|---|---|
| Texto normal | 4.5:1 mínimo |
| Texto grande (18pt o 14pt en negrita) | 3:1 mínimo |
| Elementos de interfaz y bordes | 3:1 mínimo |
| Indicador de foco | 3:1 contra el fondo adyacente |

**Regla fundamental: el color nunca es el único portador de significado.**

| Significado | Además del color |
|---|---|
| Gasto e ingreso | Signo y etiqueta de tipo |
| Presupuesto superado | Texto explícito e icono |
| Estado de un pago | Etiqueta textual |
| Series de un gráfico | Patrón, forma de marcador o etiqueta directa |
| Campo con error | Icono, texto del error y `aria-invalid` |

Verificado en modo claro **y** oscuro. Un token cuyo par oscuro no cumple
contraste es un defecto.

## 6. Movimiento y tiempo

- Se respeta `prefers-reduced-motion`: sin transiciones de posición ni
  animaciones de entrada; los cambios de estado siguen siendo perceptibles.
- Nada parpadea más de tres veces por segundo.
- Ninguna acción tiene límite de tiempo, salvo la sesión, que avisa antes de
  expirar y permite extenderla.
- Los avisos con acción de deshacer permanecen al menos 5 segundos y no se
  cierran si el foco está dentro.

## 7. Objetivos táctiles y zoom

- Mínimo 44×44px en móvil, con al menos 8px de separación entre objetivos
  adyacentes.
- La aplicación funciona con zoom del navegador al 200% sin pérdida de
  contenido ni desplazamiento horizontal.
- Funciona con ancho de 320px sin desplazamiento horizontal.
- Prohibido `user-scalable=no`.

## 8. Idioma

La aplicación es monolingüe en español, con vocabulario peruano cuando
aporta naturalidad. No hay infraestructura de traducción en V1, pero sí tres
reglas que evitan cerrarse la puerta:

1. Ningún texto visible se escribe dentro de la lógica de negocio.
2. Los textos de dominio (nombres de categorías, estados) tienen su
   equivalente visible en un solo lugar
   (`04_glosario_y_lenguaje_visible.md`).
3. **Ningún mensaje de proveedor externo llega al usuario sin traducir.**

El tercero cierra `C-13`: hoy `auth-screen.tsx` publica literalmente
`Invalid login credentials`.

`<html lang="es">` en la raíz. Los textos en otro idioma dentro del
contenido (por ejemplo, el nombre de un comercio) no requieren marcado
especial.

## 9. Formatos

### 9.1 Moneda

| Caso | Formato | Ejemplo |
|---|---|---|
| Estándar | `S/` + miles con coma + 2 decimales | `S/1,250.50` |
| Compacto | Sin decimales si son `.00` | `S/1,250` |
| Negativo | Signo menos delante del símbolo | `-S/120.50` |
| Cero | Explícito, nunca vacío | `S/0.00` |
| Modo discreto | Puntos conservando el ancho | `S/•••` |
| Sin dato | Guion, nunca `S/0.00` | `—` |

La última fila importa: mostrar `S/0.00` cuando el dato no existe es afirmar
algo falso sobre el dinero del usuario. Se distingue "no tiene" de "no sé".

### 9.2 Fechas

| Caso | Formato | Ejemplo |
|---|---|---|
| Reciente (≤7 días) | Relativo | `hoy`, `ayer`, `hace 3 días` |
| Mismo año | `D MMM` | `14 jul` |
| Otro año | `D MMM YYYY` | `14 jul 2025` |
| Con hora | `D MMM, HH:mm` | `14 jul, 15:30` |
| Rango | `D–D MMM` | `1–14 jul` |
| Periodo mensual | `MMMM YYYY` | `julio 2026` |

Zona horaria de presentación: `America/Lima` (UTC−5, sin horario de verano).
"Hoy" se calcula en esa zona, no con la del navegador.

En elementos `<time>` se incluye siempre `datetime` en ISO, para que la
fecha exacta esté disponible aunque se muestre relativa.

### 9.3 Números y porcentajes

- Separador de miles: coma. Separador decimal: punto.
- Porcentajes sin decimales salvo que aporten: `68%`, `4.5%`.
- Cantidades con su unidad: "3 movimientos", "2 cuotas".
- Cifras en tablas y listados con variante tipográfica tabular, para que las
  columnas alineen.

## 10. Verificación

| Nivel | Cómo |
|---|---|
| Automática | Análisis de accesibilidad en las pruebas de componente y E2E; falla la compilación ante infracciones serias |
| Contraste | Verificación de todos los pares de tokens en ambos modos |
| Teclado | Recorrido completo de cada flujo crítico solo con teclado, en E2E |
| Lector de pantalla | Revisión manual de los flujos críticos por versión |
| Zoom y viewport | 200% y 320px en las pruebas visuales |

Las herramientas automáticas detectan una parte de los problemas. Los flujos
críticos — registrar, confirmar un pendiente, pagar una deuda, eliminar y
restaurar — se verifican manualmente antes de cada lanzamiento.

## 11. Criterios de aceptación

- `AC-A11Y-01` — Todo flujo crítico se completa solo con teclado.
  Evidencia: `TEST`. Clase: `e2e`. **No cierra en `W-06`** (`WEB-D185`):
  los doce recorridos de `tests/e2e/recorridos/` e `irreversibles/` son
  `test.fixme()` con su propio corte dueño anotado (`W-07` en adelante);
  ninguno es de `W-06`.
- `AC-A11Y-02` — Ningún elemento elimina el indicador de foco sin
  reemplazarlo. Evidencia: `TEST`. Clase: `lint`.
  `tests/lint/foco-sin-reemplazo.test.ts` (`W-06`; sobre `src/` fuera de
  `src/features/**`, `WEB-D164`).
- `AC-A11Y-03` — Todo par de tokens cumple contraste AA en modo claro y
  oscuro. Evidencia: `TEST`. Clase: `lint`.
  Mismo mecanismo que `AC-DS-03`: `tests/lint/contraste.test.ts` (`W-06`).
- `AC-A11Y-04` — Ningún estado se comunica solo por color.
  Evidencia: `TEST` + `USER`. Clase: `unidad` (la parte `TEST`, igual
  alcance que `AC-DS-08`). La parte `USER` no cierra en `W-06`
  (`WEB-D185`).
- `AC-A11Y-05` — Todo control tiene nombre accesible.
  Evidencia: `TEST`. Clase: `unidad`.
  `src/ui/primitivas/button.test.tsx` (`W-06`): un `Button size="icon"`
  oculta el texto visualmente (`sr-only`) pero nunca lo omite del DOM.
- `AC-A11Y-06` — Los montos se anuncian con moneda y signo.
  Evidencia: `USER`. No cierra en `W-06` (`WEB-D185`): evidencia
  enteramente `USER`, protocolo de tres personas de `WEB-D149`.
- `AC-A11Y-07` — Ningún texto visible está en inglés ni proviene sin traducir
  de un proveedor. Evidencia: `TEST`. Criterio agregado (`WEB-D185`):
  cierra para `src/ui/primitivas/` (ya en español, verificado al escribir
  cada componente) y crece con cada corte de módulo que reemplaza su
  porción de `src/features/**`.
- `AC-A11Y-08` — La aplicación funciona a 200% de zoom y a 320px de ancho sin
  desplazamiento horizontal. Evidencia: `TEST`. **No cierra en `W-06`**
  (`WEB-D185`): la evidencia es visual/e2e sobre pantallas reales, que
  hoy son `REEMPLAZAR` o no existen.
- `AC-A11Y-09` — Un dato inexistente se muestra como `—`, nunca como
  `S/0.00`. Evidencia: `TEST`. Clase: `unidad`.
  `src/ui/primitivas/money.test.tsx` (`W-06`).
- `AC-A11Y-10` — Se respeta `prefers-reduced-motion`. Evidencia: `TEST`.
  Clase: `lint`. `tests/lint/movimiento-reducido.test.ts` (`W-06`; la
  regla en `globals.css` ya existía, ahora tiene prueba).
