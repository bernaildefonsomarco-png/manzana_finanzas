# 17 — Patrones de datos, formularios y listados

**Bloque:** 02 — Fundaciones
**Estado:** V1
**Fecha:** 25 de julio de 2026
**Depende de:** `12_arquitectura_app_web.md`, `14_contratos_api_web.md`, `16_design_system_web.md`
**Documentos que dependen de este:** §8, §9 y §12 de todos los módulos

---

## 1. El problema

Sin un estándar, cada pantalla resuelve lo mismo a su manera. La evidencia
actual:

- Cada pantalla reimplementa el mismo bloque: `useEffect` + bandera de
  cancelación + estado `loading | loaded | error`.
- Tras cada mutación se recarga el listado completo (`reloadMovements()`
  después de crear).
- `money-screen.tsx` acumula 59 llamadas a hooks; `upcoming-screen.tsx` 52;
  `movements-screen.tsx` 47.
- Los formularios grandes gestionan decenas de `useState` sueltos: el modal
  de nuevo movimiento ocupa 715 líneas.
- Helpers de fecha duplicados entre pantallas: `todayInputDate()`,
  `toPaymentIso()`, `formatMovementDate()`, `toLocalDateTimeInput()`.
- Ningún listado tiene paginación funcional: se piden 50 elementos y se
  filtran en el cliente, aunque la API soporta filtros en el servidor.
- Controles decorativos sin manejador: el botón "Ver más movimientos"
  (`movements-screen.tsx:413`), un chip de filtro siempre activo (`:316`) y
  dos lupas de búsqueda sin acción (`:279` y `pending-screen.tsx:313`).

Este documento fija un solo patrón para cada uno de estos casos.

## 2. Obtención de datos

### 2.1 Reglas

1. La carga inicial ocurre en el servidor (Server Component). El cliente
   recibe datos, no un estado vacío que rellenar.
2. Las recargas posteriores usan la librería de data-fetching, con clave de
   caché e invalidación selectiva.
3. **Prohibido copiar datos de servidor a `useState`.** Crea dos fuentes de
   verdad que se desincronizan.
4. Prohibido escribir a mano el patrón `useEffect` + bandera de cancelación.
5. Una mutación invalida las claves afectadas, nunca toda la caché.

### 2.2 Claves de caché

Jerárquicas, para poder invalidar por familia:

```text
["movimientos", { filtros }]        una página concreta
["movimientos"]                     todas las páginas
["resumen"]                         dinero libre y desglose
["presupuestos", periodo]
["deuda", id]
```

### 2.3 Qué invalida cada escritura

| Escritura | Invalida |
|---|---|
| Crear, editar o eliminar movimiento | `["movimientos"]`, `["resumen"]`, `["presupuestos"]`, descubrimientos afectados |
| Confirmar pendiente | `["pendientes"]`, más lo mismo que un movimiento |
| Crear o editar cuenta o caja | `["cuentas"]`, `["cajas"]`, `["resumen"]` |
| Pagar deuda | `["deudas"]`, `["deuda", id]`, `["movimientos"]`, `["resumen"]` |
| Editar presupuesto | `["presupuestos"]` |
| Confirmar importación | `["movimientos"]`, `["pendientes"]`, `["resumen"]`, `["presupuestos"]` |
| Cambiar preferencia | `["preferencias"]` |

La regla explícita que rompe con el patrón actual: **crear un movimiento no
invalida las deudas, la configuración ni los hilos del asistente.**

## 3. Mutaciones y actualización optimista

Secuencia estándar:

```text
1. Validar en el cliente con el mismo esquema Zod del servidor
2. Aplicar el cambio de forma optimista en la caché
3. Enviar con Idempotency-Key
4. Éxito → reconciliar con la respuesta real del servidor
   Error  → revertir y mostrar el error junto al campo o en aviso
5. Invalidar solo las claves afectadas
```

Cuándo **no** aplicar actualización optimista: operaciones cuyo resultado el
cliente no puede predecir — conciliación de pagos de deuda, confirmación de
importaciones, cualquier cálculo del Core con reglas de asignación. En esos
casos se muestra estado de carga y se espera la respuesta real.

### 3.1 Deshacer

Toda acción destructiva o fácilmente equivocada ofrece deshacer en el propio
aviso de confirmación, durante 5 a 10 segundos:

```text
Movimiento eliminado.   [Deshacer]
```

Si la ventana expira, el elemento sigue siendo restaurable desde su propia
pantalla (`11_confianza_errores_y_reversibilidad.md` §7). El aviso no es la
única vía de recuperación.

## 4. Listados

### 4.1 Contrato

Todo listado de la aplicación implementa lo mismo:

| Capacidad | Regla |
|---|---|
| Paginación | Por cursor, contra el servidor. Nunca "traer todo y cortar". |
| Filtros | En el servidor. Se reflejan en la URL. |
| Orden | En el servidor, contra una lista blanca de campos. |
| Búsqueda | En el servidor, con retardo de 300 ms. |
| Selección múltiple | Opcional por módulo; si existe, con acciones en lote. |
| Estados | Cargando, vacío, sin resultados por filtro, error, modo discreto. |

### 4.2 Vacío ≠ sin resultados

Dos estados distintos que hoy se confunden:

| Estado | Mensaje | Acción |
|---|---|---|
| **Vacío** (no hay datos en absoluto) | "Cuando registres algo, aparecerá aquí." | Registrar movimiento |
| **Sin resultados** (hay datos, los filtros no coinciden) | "No encontré movimientos con esos filtros." | Limpiar filtros |

Mostrar "no tienes movimientos" a alguien que tiene 300 y filtró mal es un
error que erosiona la confianza en los datos.

### 4.3 Paginación

Se prefiere el botón explícito "Cargar más" sobre el desplazamiento
infinito, por tres razones concretas: permite llegar al pie de página,
funciona con teclado sin trampas, y evita cargas involuntarias de datos.

El botón debe **tener manejador y estados reales**: normal, cargando, y
oculto cuando `has_more` es falso. Un botón decorativo es peor que ninguno,
porque promete algo que no ocurre.

### 4.4 Filtros en la URL

Los filtros activos viven en la URL (`10_sitemap_rutas_y_navegacion.md`
§3.3). Consecuencias que hay que respetar:

- Aplicar un filtro entra al historial (`push`); escribir en la búsqueda no
  (`replace` con retardo).
- Volver desde un detalle conserva los filtros, porque nunca se perdieron.
- Los filtros activos se muestran como chips **con acción de quitar
  funcional**, y cada chip refleja un filtro real.

### 4.5 Virtualización

A partir de 200 filas visibles simultáneas se virtualiza. Por debajo, no:
la virtualización complica la accesibilidad y el buscador del navegador, y
no aporta con listas cortas.

## 5. Formularios

### 5.1 Reglas

1. Un esquema Zod por formulario, **compartido entre cliente y servidor**.
   La validación del cliente es comodidad; la del servidor es la que manda.
2. La gestión de estado la hace la librería de formularios, no `useState`
   sueltos.
3. Validación al salir del campo, no en cada tecla. Los errores se limpian
   al corregir.
4. Los errores del servidor se asignan al campo correspondiente cuando la
   respuesta los identifica (`details.issues[].path`).
5. Al enviar: botón en estado de carga, campos bloqueados, sin doble envío.
6. Al fallar: el formulario **conserva lo escrito**. Perder un formulario
   lleno es inaceptable.
7. El foco va al primer campo con error, y el error se anuncia.

### 5.2 Formularios de tipo variable

El formulario de movimiento cambia sus campos según el tipo elegido, entre
11 posibilidades. El patrón:

```text
esquema base (monto, fecha, descripción)
  + esquema por tipo (cuentas, deuda, persona, caja según corresponda)
  = esquema efectivo, compuesto
```

Se define como una tabla de configuración por tipo, no como una cadena de
condicionales dentro del componente. Regla derivada de `C-05`: **todos los
tipos deben poder guardarse desde el propio formulario.** Un tipo cuyo botón
de envío se sustituye por un enlace a otra pantalla es un formulario que no
termina su trabajo.

### 5.3 Aviso de duplicado

Cuando el servidor responde `409` con `requires_confirmation`, el formulario
no falla: muestra el candidato duplicado con sus datos y ofrece dos salidas
claras, "Ver el existente" y "Registrar de todas formas".

## 6. Fechas

Un solo módulo de utilidades de fecha para toda la aplicación. Prohibido
declarar helpers de fecha dentro de una pantalla.

| Necesidad | Regla |
|---|---|
| Zona horaria | `America/Lima` para toda presentación y para "hoy" |
| Almacenamiento | Siempre `timestamptz` en UTC |
| Entrada del usuario | Se interpreta en su zona local y se convierte al enviar |
| "Hoy" | Se calcula en `America/Lima`, no con la hora del navegador |
| Formatos | Definidos en `16_design_system_web.md` §6 |

El detalle de por qué importa: un movimiento registrado a las 23:30 del 14 de
julio en Lima no debe aparecer como del 15 de julio porque el servidor
calculó en UTC.

## 7. Dinero

| Regla | Detalle |
|---|---|
| Representación | Decimal con 2 posiciones, nunca coma flotante |
| Transporte | Cadena o entero en centavos, nunca `number` con decimales en JSON |
| Redondeo | Al céntimo, siempre en el mismo sentido, definido en el Core |
| Entrada | Acepta `1250.5`, `1,250.50`, `S/1250.50` y normaliza |
| Presentación | Solo a través del componente de dinero, que respeta el modo discreto |

Prohibido operar con dinero en el cliente. Los totales, saldos y avances los
calcula el servidor o el Core. El cliente muestra.

## 8. Carga y percepción

| Situación | Patrón |
|---|---|
| Carga inicial | Esqueleto con la forma real del contenido |
| Recarga en segundo plano | Los datos anteriores siguen visibles, con indicador sutil |
| Recálculo tras corregir | Aviso "Actualizando…" y datos anteriores como referencia |
| Acción del usuario | Estado de carga en el propio botón, no bloqueo global |
| Operación larga | Progreso real cuando se conoce; nunca una barra falsa |

Regla transversal ya fijada en `11_confianza_errores_y_reversibilidad.md`:
**nunca una pantalla vacía cuando existen datos previos.**

## 9. Errores en la interfaz

| Alcance | Dónde se muestra |
|---|---|
| Campo | Debajo del campo, con el campo marcado |
| Formulario | Encima de las acciones, sin perder lo escrito |
| Sección | Aviso en línea con reintento, sin tumbar la pantalla |
| Pantalla | `error.tsx` del segmento |
| Aplicación | `global-error.tsx` |

Todos siguen el contrato de tres partes: en español, explica qué pasó,
ofrece salida.

## 10. Qué se prohíbe explícitamente

- Copiar datos de servidor a `useState`.
- Escribir a mano `useEffect` + bandera de cancelación para obtener datos.
- Recargar el listado completo tras una mutación.
- Filtrar u ordenar en el cliente datos que el servidor puede filtrar.
- Declarar helpers de fecha o de moneda dentro de una pantalla.
- Renderizar un control sin manejador funcional.
- Perder lo escrito en un formulario ante un error.
- Operar con dinero en el cliente.
- Mostrar "no hay datos" cuando lo que hay es "no hay resultados".

## 11. Criterios de aceptación

- `AC-PAT-01` — Ninguna pantalla implementa a mano el patrón de obtención de
  datos. Evidencia: `TEST` (regla de lint).
- `AC-PAT-02` — Ninguna mutación invalida claves no relacionadas.
  Evidencia: `CODE` + `TEST`.
- `AC-PAT-03` — Todo listado recorre su conjunto completo mediante cursor.
  Evidencia: `TEST` (E2E).
- `AC-PAT-04` — Ningún filtro se aplica en el cliente sobre datos ya
  descargados. Evidencia: `TEST`.
- `AC-PAT-05` — "Vacío" y "sin resultados" son estados distintos con
  mensajes y acciones distintos. Evidencia: `TEST` + `USER`.
- `AC-PAT-06` — Ningún control interactivo carece de manejador.
  Evidencia: `TEST`.
- `AC-PAT-07` — Un formulario que falla conserva todos los valores escritos.
  Evidencia: `TEST`.
- `AC-PAT-08` — Los 11 tipos de movimiento se guardan desde el propio
  formulario. Evidencia: `TEST` + `USER`.
- `AC-PAT-09` — Existe un único módulo de utilidades de fecha y otro de
  moneda. Evidencia: `CODE`.
- `AC-PAT-10` — Un movimiento registrado a las 23:30 hora de Lima queda con
  la fecha de ese día. Evidencia: `TEST`.
