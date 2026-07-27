# 12 — Arquitectura de la aplicación web

**Bloque:** 02 — Fundaciones
**Estado:** V1
**Fecha:** 25 de julio de 2026
**Depende de:** `10_sitemap_rutas_y_navegacion.md`, `07_alcance_web_v1.md`
**Documentos que dependen de este:** `14_contratos_api_web.md`, `17_patrones_datos_formularios_y_listados.md`, §8 y §17 de todos los módulos
**Fuentes:** `docs/fase_4_tecnica/06_arquitectura_sistema.md`, `docs/fase_4_tecnica/15_stack_tecnologico.md`

---

## 1. Para qué existe este documento

`06_arquitectura_sistema.md` define bien las capas del sistema completo
(datos → Core → eventos → experiencia) y sigue vigente. Lo que nunca se
documentó es **cómo se construye la capa web sobre Next.js App Router**: qué
corre en el servidor, qué en el cliente, dónde vive cada tipo de estado,
cómo se cachea y cómo se divide el código.

Esa ausencia tiene consecuencias medibles hoy: cero Server Components de
datos, cero `Suspense`, cero `next/dynamic`, y las nueve pantallas se
empaquetan juntas aunque el usuario solo abra el Inicio.

## 2. Stack

Heredado de `15_stack_tecnologico.md` y ya en uso. No cambia:

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16, App Router |
| UI | React 19, TypeScript |
| Estilos | Tailwind CSS v4 con `@theme inline` |
| Base de datos | Supabase PostgreSQL con RLS |
| Autenticación | Supabase Auth |
| Validación | Zod (compartido entre cliente y servidor) |
| Iconos | lucide-react |
| Pruebas | Vitest + Testing Library; Playwright para E2E (a incorporar) |

Dependencias que se incorporan y por qué:

| Necesidad | Decisión | Razón |
|---|---|---|
| Estado de servidor en cliente | Una librería de data-fetching con caché e invalidación | Hoy cada pantalla reimplementa `useEffect` + bandera de cancelación + estado de carga, y recarga todo tras cada mutación. `money-screen.tsx` acumula 59 hooks. |
| Formularios | Una librería de formularios integrada con Zod | Hoy los formularios grandes gestionan decenas de `useState` a mano: el modal de nuevo movimiento ocupa 715 líneas. |
| Fechas | Una librería de fechas con zonas horarias | Hoy hay helpers propios duplicados entre pantallas (`todayInputDate`, `toPaymentIso`, `formatMovementDate`). |
| Gráficos | Una librería de gráficos accesible | Requerida por `35_modulo_reportes_graficos_y_exportacion.md`. |

Las marcas concretas se eligen en `54_plan_de_implementacion_web.md`; lo que
este documento fija es que **esas cuatro responsabilidades no se resuelven a
mano en cada pantalla**.

## 3. Las capas y su frontera

```text
┌─────────────────────────────────────────────────────────────┐
│  Navegador                                                  │
│  Client Components: interacción, formularios, estado local  │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  Next.js — capa web                                         │
│  Server Components (lectura) · Route Handlers (/api/v1)     │
│  Middleware de sesión · Layouts · loading/error/not-found   │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  Core financiero  (src/core)                                │
│  CommandDispatcher · motores de dominio · validadores       │
│  ÚNICA capa que escribe dinero                              │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  Datos  (src/data)                                          │
│  Repositorios · Supabase · RLS · migraciones · outbox       │
└─────────────────────────────────────────────────────────────┘
```

Reglas de frontera, heredadas y no negociables:

- `core/` no importa React, Next.js ni SDKs de UI.
- Las rutas de API no contienen lógica financiera: llaman a comandos.
- Toda escritura financiera pasa por `CommandDispatcher` (`WEB-D012`).
- El motor IA consulta por `ToolGateway`; nunca escribe directo.
- Nada asíncrono sin `transactional_outbox`.

## 4. Server Components y Client Components

La regla que evita el problema actual: **lectura en el servidor, interacción
en el cliente.**

| Corre en el servidor | Corre en el cliente |
|---|---|
| Carga inicial de cualquier listado o detalle | Formularios y sus validaciones en vivo |
| Cálculos de resumen (dinero libre, avance de presupuesto) | Filtros, orden y paginación tras la carga inicial |
| Comprobación de sesión y permisos | Modales, paneles, menús |
| Composición de layouts | Estado optimista y deshacer |
| Cualquier acceso a secretos | El asistente conversacional |

Consecuencia práctica: una pantalla típica es un Server Component que carga
los datos y renderiza un Client Component que gestiona la interacción. El
Server Component nunca recibe `"use client"`, y el Client Component nunca
importa repositorios ni clientes de base de datos.

**Regla de límite:** `"use client"` se declara lo más abajo posible en el
árbol. Marcar un layout entero como cliente anula el beneficio para todo lo
que cuelga de él.

## 5. Estructura de rutas

```text
src/app/
├── layout.tsx                    raíz: fuentes, tokens, providers globales
├── global-error.tsx              fallo total (único en toda la app)
├── (publico)/                    sin sesión
│   ├── page.tsx                  solo redirige: `/entrar` o `/inicio`
│   ├── entrar/, crear-cuenta/, recuperar-clave/, restablecer-clave/
│   ├── verificar/, auth/callback/
│   └── privacidad/, terminos/, empresa/, contacto/, eliminar-datos/
└── (app)/                        con sesión — layout con navegación
    ├── layout.tsx                barra lateral, cabecera, providers de sesión
    ├── loading.tsx               esqueleto genérico de sección
    ├── error.tsx                 error recuperable de sección
    ├── inicio/
    ├── movimientos/
    │   ├── page.tsx  loading.tsx  error.tsx
    │   ├── [id]/                  detalle
    │   ├── nuevo/                 registro (ruta + modal interceptada)
    │   └── importar/
    ├── pendientes/  ├── [id]/
    ├── mi-dinero/   ├── cuentas/[id]/  ├── cajas/[id]/
    ├── presupuestos/ ├── [id]/
    ├── deudas/      ├── [id]/
    ├── pagos-que-vienen/ ├── [id]/
    ├── descubrimientos/  ├── [id]/
    ├── reportes/    ├── proyecciones/  ├── asistente/  ├── buscar/
    ├── configuracion/
    │   ├── page.tsx (índice)
    │   └── perfil/  privacidad/  recordatorios/  correo/  memoria/  datos/
    └── bienvenida/
```

Dos grupos de rutas, `(publico)` y `(app)`, porque tienen layouts distintos
y requisitos de sesión opuestos. El grupo `(app)` verifica sesión una sola
vez en su layout, no en cada página.

## 6. Rutas paralelas e interceptadas

Para cumplir la regla de `10_sitemap_rutas_y_navegacion.md` §4 — que un
detalle tenga URL propia pero se vea como panel sobre el listado:

```text
movimientos/
├── page.tsx                    listado
├── [id]/page.tsx               detalle a pantalla completa (carga directa)
├── @panel/                     ranura paralela
│   ├── default.tsx             vacío por defecto
│   └── (.)[id]/page.tsx        intercepta la navegación → panel lateral
```

Comportamiento resultante:

| Cómo llega el usuario | Qué ve |
|---|---|
| Clic en una fila del listado | Panel lateral sobre el listado, URL cambia a `/movimientos/[id]` |
| Pega la URL o recarga | Pantalla completa del detalle |
| Pulsa atrás | Se cierra el panel y vuelve al listado con sus filtros |

Este patrón se aplica a movimientos, pendientes, deudas, pagos que vienen y
descubrimientos. No se aplica a confirmaciones de riesgo, que son modales
puros sin URL.

## 7. Estado: dónde vive cada cosa

Cinco tipos de estado, cinco lugares. Mezclarlos es la causa de que
`money-screen.tsx` tenga 59 hooks.

| Tipo | Dónde vive | Ejemplo |
|---|---|---|
| **Estado de servidor** | Caché de la librería de data-fetching, con clave e invalidación | Lista de movimientos, saldos, presupuestos |
| **Estado de navegación** | La URL | Filtros activos, página, término de búsqueda, pestaña |
| **Estado de formulario** | La librería de formularios, local al formulario | Campos a medio llenar, errores de validación |
| **Estado de UI efímero** | `useState` local al componente | Menú abierto, tooltip visible |
| **Estado global de sesión** | Contexto de React, solo lectura | Usuario, preferencias, modo discreto |

Regla: **si el dato viene del servidor, no se copia a `useState`.** Copiarlo
crea dos fuentes de verdad que se desincronizan — el origen de la mayoría de
bugs de datos obsoletos.

## 8. Caché e invalidación

| Dato | Estrategia |
|---|---|
| Listados y detalles | Caché con clave por filtros; se revalida al enfocar la ventana y tras una mutación relacionada |
| Resúmenes (dinero libre, avance de presupuesto) | Caché corta; se invalida ante cualquier escritura financiera |
| Catálogos (categorías, cuentas) | Caché larga; se invalida solo al modificarlos |
| Datos del usuario y preferencias | Caché de sesión |
| Páginas públicas y legales | Estáticas, revalidadas por despliegue |

Regla de invalidación tras escribir: una mutación invalida **las claves
afectadas**, no toda la caché. Escribir un movimiento invalida el listado de
movimientos, los saldos y el presupuesto de su categoría — no las deudas ni
la configuración.

Regla contra el patrón actual: **nunca recargar el listado completo tras
cada mutación.** Se aplica actualización optimista y se reconcilia con la
respuesta del servidor.

## 9. Carga, streaming y división de código

- Cada segmento de ruta tiene `loading.tsx` con un esqueleto que refleja la
  forma real del contenido, no un spinner genérico.
- Las secciones lentas de una pantalla se envuelven en `Suspense` propio,
  para que el resto se muestre antes.
- El código se divide por ruta automáticamente; además se carga bajo demanda
  lo pesado y poco usado: gráficos, importador de archivos, asistente.
- Presupuesto inicial de JavaScript por ruta: se define en
  `51_estrategia_de_pruebas_web.md` y se verifica en el proceso de
  integración continua.

## 10. Sesión y protección de rutas

- El middleware refresca la sesión de Supabase en cada petición. Ya existe
  (`src/proxy.ts`) y es correcto.
- El layout de `(app)` verifica la sesión una sola vez; sin sesión redirige
  a `/entrar?redirigir=<ruta>`.
- El middleware **no** decide permisos de datos. Eso es responsabilidad de
  RLS y de los repositorios (`15_seguridad_autorizacion_y_rls.md`).
- Una sesión que expira durante el uso muestra un aviso sobre la pantalla
  actual sin destruir el trabajo en curso.

## 11. Organización del código

```text
src/
├── app/            rutas, layouts, estados de ruta, route handlers
├── modulos/        un directorio por módulo funcional (reemplaza features/)
│   └── movimientos/
│       ├── componentes/     piezas de UI del módulo
│       ├── hooks/           lógica de cliente
│       ├── api.ts           cliente tipado de sus endpoints
│       └── esquemas.ts      Zod compartido cliente/servidor
├── ui/             design system (reemplaza shared/ui)
├── core/           dominio financiero — se conserva
├── data/           repositorios, Supabase, migraciones — se conserva
└── shared/         utilidades transversales
```

Reglas de tamaño, para evitar la repetición del problema actual
(`settings-screen.tsx` tiene un componente de 1.740 líneas):

- Un componente de UI no supera ~150 líneas. Si crece, se divide.
- Un archivo no exporta más de un componente de pantalla.
- La lógica de negocio no vive en componentes: vive en `core/` o en hooks.
- Un módulo no importa componentes internos de otro módulo; comparte a
  través de `ui/` o de `shared/`.

## 12. Rendimiento

| Aspecto | Regla |
|---|---|
| Listados | Paginación por cursor desde el servidor; nunca traer 50 y filtrar en el cliente |
| Filtros | Se aplican en el servidor, no sobre datos ya descargados |
| Imágenes | Componente de imagen de Next con dimensiones explícitas |
| Fuentes | Autoalojadas con `next/font`, precargadas, sin salto de texto |
| Tablas largas | Virtualización a partir del umbral que fije `17_patrones_datos_formularios_y_listados.md` |
| Cálculos financieros | En el servidor o en el Core; nunca recalculados en cada render |

## 13. Errores y degradación

| Nivel | Archivo | Cubre |
|---|---|---|
| Segmento | `error.tsx` | Fallo en una sección; el resto de la navegación sigue viva |
| Ruta inexistente | `not-found.tsx` | Recurso que no existe, con salida a la sección padre |
| Aplicación | `global-error.tsx` | Fallo total; único, en la raíz |

Ningún límite de error muestra el mensaje técnico crudo. Muestra el mensaje
en español del contrato de `11_confianza_errores_y_reversibilidad.md` §9, con
el `trace_id` disponible para soporte.

## 14. Qué cambia respecto a la implementación actual

| Hoy | Objetivo |
|---|---|
| Toda la app en `src/app/page.tsx` con `?view=` | Rutas reales por sección |
| `src/app/(dashboard)/` con solo un `.gitkeep` | Grupo `(app)` con todas las rutas |
| Sin `loading.tsx`, `error.tsx`, `not-found.tsx` | Uno por segmento |
| Sin `Suspense`, sin `next/dynamic`, sin code-splitting | División por ruta y carga bajo demanda de lo pesado |
| `useEffect` + bandera de cancelación en cada pantalla | Librería de data-fetching con caché e invalidación |
| Recarga completa tras cada mutación | Invalidación selectiva y actualización optimista |
| Filtrado en cliente sobre `limit=50` | Filtros y cursor en el servidor |
| Componentes de 700–2.360 líneas | Componentes de ~150 líneas |
| `src/features/` | `src/modulos/` con estructura interna consistente |

## 15. Criterios de aceptación

- `AC-ARQ-01` — Ninguna ruta usa `?view=` para decidir qué pantalla mostrar.
  Evidencia: `TEST`.
- `AC-ARQ-02` — Cada segmento de `(app)` tiene `loading.tsx` y `error.tsx`,
  propios o heredados deliberadamente. Evidencia: `CODE`.
- `AC-ARQ-03` — Abrir el Inicio no descarga el código de reportes, del
  importador ni del asistente. Evidencia: `TEST` (presupuesto de bundle).
- `AC-ARQ-04` — Ningún componente de UI supera 150 líneas sin justificación
  registrada. Evidencia: `TEST` (regla de lint).
- `AC-ARQ-05` — Ningún Client Component importa repositorios ni clientes de
  base de datos. Evidencia: `TEST` (regla de lint).
- `AC-ARQ-06` — Ninguna mutación recarga el listado completo; invalida solo
  las claves afectadas. Evidencia: `CODE` + `TEST`.
- `AC-ARQ-07` — `core/` no importa React ni Next.js. Evidencia: `TEST`.
- `AC-ARQ-08` — Abrir un detalle desde un listado muestra un panel y cambia
  la URL; recargar esa URL muestra la pantalla completa. Evidencia: `TEST` (E2E).
