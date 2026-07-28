# 52 — Inventario y reutilización del código de `src/`

**Bloque:** 07 — Calidad y ejecución
**Alcance:** V1
**Fecha:** 26 de julio de 2026
**Docs fuente:** el árbol de `src/` medido el 26 de julio de 2026; `42_reutilizacion_del_codigo_existente_motor.md` (motor conversacional, ya emitido); `51_estrategia_de_pruebas_web.md` (pruebas)
**Documentos que dependen de este:** `53` (deuda técnica), `54` (plan de implementación)

---

## 1. Qué decide este documento

El `42` emitió veredicto sobre el motor conversacional: `src/agents/` y
`src/core/conversation/`. Este emite veredicto sobre **todo lo demás**, que es
la mayor parte: 116.769 líneas en 517 ficheros.

Las cifras salen de medir el árbol, no de recordarlo. Donde el veredicto se
apoya en lectura de superficie —nombre, tamaño, exportaciones— se dice, igual
que hizo el `42` §3. Decir "reutilizar 14.000 líneas" tras mirar una lista de
ficheros sería precisamente la afirmación sin evidencia que el corpus prohíbe.

---

## 2. Un solo vocabulario de veredictos

`WEB-D161` — **El corpus tiene cuatro veredictos, no ocho.**

El plan de sesión proponía `CONSERVAR / ADAPTAR / RECONSTRUIR / BORRAR` para
este documento, mientras el `42` ya había fijado
`REUTILIZAR / ADAPTAR / REEMPLAZAR / DESCARTAR`. Son las mismas cuatro
decisiones con dos nombres, y dos vocabularios para lo mismo es exactamente el
defecto que este corpus lleva encontrando desde el `40`: 44 fraseos para 6
niveles de confirmación, 4 nombres para el tramo vacío, 25 formas de escribir
la evidencia.

Gana el del `42`, porque llegó primero y ya está aplicado sobre 15.233 líneas.

| Veredicto | Significa |
|---|---|
| **REUTILIZAR** | Se conserva. Cambios cosméticos como mucho |
| **ADAPTAR** | La idea y buena parte del código sirven; hay que cambiar su contrato o su alcance |
| **REEMPLAZAR** | El problema que resuelve sigue existiendo; esta solución no es la del diseño nuevo |
| **DESCARTAR** | El problema que resolvía ya no existe |
| **LEER ANTES DE DECIDIR** | Solo hubo lectura de superficie. El veredicto exige leerlo entero |

---

## 3. El árbol medido

| Área | Producción | Pruebas | Ficheros |
|---|---|---|---|
| `src/core/` | 25.475 | 12.314 | 118 |
| `src/features/` | 18.142 | 1.959 | 53 |
| `src/data/` | 14.915 | 1.088 | 37 + 46 `.sql` |
| `src/agents/` | 11.219 | 5.662 | 94 |
| `src/app/` | 10.268 | 4.312 | 138 |
| `src/adapters/` | 4.297 | 1.994 | 33 |
| `src/shared/` | 1.953 | 357 | 25 |
| `src/workers/` | 1.839 | 915 | 17 |
| `src/proxy.ts` | 59 | 0 | 1 |
| **Total** | **88.168** | **28.601** | **517** |

Una proporción sana: **una línea de prueba por cada tres de producción**. Está
mal repartida —§7 y `51` §2.1 lo detallan— pero existe, y eso es más de lo que
suele haber.

---

## 4. `src/core/` — 25.475 líneas · **REUTILIZAR con una auditoría**

Es el activo del proyecto y el corpus lo dijo desde el `06`. 118 ficheros, 49
de ellos de prueba, con los motores de dominio que ningún documento nuevo
pretende rehacer.

| Subcarpeta | Producción | Veredicto |
|---|---|---|
| `orchestrator/` | 6.236 | ADAPTAR — ver §4.1 |
| `conversation/` | 5.714 | Ya juzgado en `42` |
| `response/` | 2.101 | ADAPTAR — contiene formato y envío de WhatsApp |
| `email/` | 1.880 | REUTILIZAR — sirve al módulo `28` |
| `insights/` | 1.542 | ADAPTAR — el `34` cambia umbrales y clases, no el motor |
| `pending/` | 1.507 | ADAPTAR — el `27` añade confirmabilidad por constraint |
| `finance/` | 1.326 | REUTILIZAR |
| `learning/` | 1.131 | ADAPTAR — el `36` añade lápidas y gobierno |
| `nudges/` | 1.116 | ADAPTAR — el `37` cambia el canal, no la fatiga |
| `debts/` | 809 | REUTILIZAR |
| `dedup/` | 640 | REUTILIZAR |
| `recurring/` | 588 | REUTILIZAR |
| `risk/` | 286 | REUTILIZAR |
| `classification/` | 248 | REUTILIZAR |
| `disclosure/` | 172 | ADAPTAR |
| `onboarding/` | 106 | REEMPLAZAR — el `44` lo rehace sin canal |
| `events/` | 73 | REUTILIZAR |
| `commands/`, `engines/`, `validators/` | **0** | Vacías. Ver §9 |

### 4.1 La auditoría que `core/` necesita, y por qué no es opcional

**28 ficheros de producción de `src/core/` mencionan WhatsApp.** Suman 15.196
líneas —el 60 % de la capa— y seis llevan el canal en el nombre:

```text
src/core/orchestrator/whatsapp-pending-confirmation.ts     605
src/core/orchestrator/whatsapp-correction.ts               562
src/core/learning/whatsapp-memory-control.ts               256
src/core/response/whatsapp-response-sender.ts              175
src/core/pending/whatsapp-pending-code.ts                   29
src/core/response/whatsapp-formatting.ts                     5
```

`financial-orchestrator.ts` menciona el canal **102 veces**.

Esto contradice de frente el principio central del bloque `03_motor_ia/`:
*"el canal es un adaptador de E/S, nunca un parámetro del núcleo"*
(`WEB-D105`). La prueba de agnosticismo del `21` —el mismo caso ejecutado por
dos presentadores produce el mismo espacio de trabajo, los mismos comandos y
las mismas referencias de evidencia— **no se puede escribir contra este árbol**.

No significa borrar 15.196 líneas. Significa que el veredicto de `core/` es
REUTILIZAR **con una auditoría de canal declarada como trabajo**, y que esa
auditoría es un corte del `54`, no una limpieza que alguien hará de paso.

`WEB-D162` — **La auditoría de canal en `core/` es un corte propio, y su
criterio de cierre es que la prueba de agnosticismo del `21` compile.** No un
porcentaje de menciones eliminadas: un test que hoy no se puede escribir y
después sí.

---

## 5. `src/features/` — 18.142 líneas · **RECONSTRUIR casi entero**

Catorce carpetas. Trece ficheros `.tsx` de producción suman 14.072 líneas.

| Carpeta | Producción | Pruebas | Veredicto |
|---|---|---|---|
| `upcoming/` | 2.937 | 2 | REEMPLAZAR |
| `money/` | 2.737 | 1 | REEMPLAZAR |
| `settings/` | 2.564 | 1 | REEMPLAZAR |
| `movements/` | 2.249 | 3 | REEMPLAZAR |
| `debts/` | 2.098 | 2 | REEMPLAZAR |
| `pending/` | 1.662 | 1 | REEMPLAZAR |
| `home/` | 1.102 | 2 | REEMPLAZAR |
| `insights/` | 1.038 | 1 | REEMPLAZAR |
| `search/` | 571 | 1 | REEMPLAZAR |
| `app-shell/` | 429 | 1 | ADAPTAR |
| `dashboard/` | 263 | 1 | **DESCARTAR** |
| `public-site/` | 232 | 0 | REUTILIZAR |
| `auth/` | 225 | 1 | ADAPTAR |
| `onboarding/` | 35 | 0 | REEMPLAZAR |

**REEMPLAZAR, no DESCARTAR.** El problema que estas pantallas resuelven sigue
existiendo entero: hay que mostrar movimientos, cuentas, deudas. Lo que no
sirve es la solución —un componente por pantalla, sin rutas, sin primitivas—.
Y el contenido de cada una es la mejor fuente de casos borde que existe, así
que se lee antes de tirarla.

**`dashboard/` es el único DESCARTAR** (263 líneas). Es el router manual: lee
`?view=` del query string y llama a `router.replace(..., { scroll: false })`.
El problema que resolvía —enrutar sin rutas— deja de existir en cuanto el `12`
§5 pone rutas reales. `AC-ARQ-01` y `AC-NAV-04` lo prohíben con una regla de
lint (`51` §6.4).

**`public-site/` se reutiliza** (232 líneas): es la cabecera y el pie de las
cinco páginas legales, no una portada. `WEB-D151` no lo toca.

### 5.1 Lo que hay que leer antes de tirar

De las nueve pantallas grandes salen tres cosas que ningún documento del
corpus contiene y que se perderían al borrarlas:

| Qué | Dónde vive hoy |
|---|---|
| Casos borde reales de conciliación de deudas | `debts-screen.tsx` (1.421 líneas) |
| El formulario de movimiento con sus 11 tipos | `movements-screen.tsx` y su modal de 715 líneas |
| Estados vacíos y de error ya redactados en español | Las nueve |

**`RUL-INV-01` — Antes de reemplazar una pantalla se extraen sus casos borde
al §19 de su módulo.** Reemplazar no es empezar de cero: es quedarse con lo
aprendido y tirar la forma.

### 5.2 Controles muertos

`48` elementos `<button>` en `src/features`. La revisión de superficie
encontró controles sin manejador —el "Ver más" del listado de movimientos, la
lupa de la bandeja de pendientes, un chip de filtro decorativo— y `AC-DS-10` y
`AC-PAT-06` ya los prohíben. Como todas las pantallas se reemplazan, **no se
arreglan: desaparecen con su fichero.** Arreglar un control de un componente
condenado es trabajo tirado.

---

## 6. `src/data/` — 14.915 líneas · **REUTILIZAR**

| Parte | Contenido | Veredicto |
|---|---|---|
| `repositories/` | 33 ficheros, 11.280 líneas | REUTILIZAR |
| `supabase/` | 3 ficheros, 4.060 líneas | ADAPTAR — `15` cambia qué cliente usa cada ruta |
| `migrations/` | 46 `.sql` | REUTILIZAR. Ver §10 |

Dos repositorios son de WhatsApp: `whatsapp-delivery.repository.ts` (723) y
`whatsapp-window.repository.ts` (360). **Se conservan intactos** y salen de la
suite web (`WEB-D160`). La fase 2 los necesita tal cual.

---

## 7. `src/app/` — 10.268 líneas · **partido en dos**

### 7.1 `src/app/api/` — 9.724 líneas · **ADAPTAR**

**72 ficheros `route.ts`**: 58 bajo `/api/v1` repartidos en 22 recursos, y 14
fuera —2 de salud, 10 de trabajos internos, 2 de webhooks—.

El corpus especifica **187 endpoints** (`50` §6). La diferencia no es trabajo
nuevo en su mayor parte: son operaciones que hoy viven dentro de rutas más
grandes y que los módulos separan.

Lo que cambia en todas: envelope y `trace_id` ya están bien (`14`), pero hay
que añadir cursor, filtros en servidor, límite de peticiones y CSRF, y hay que
sacar `createServiceClient` de las **48 rutas** que lo usan sin justificación
(`15`, `AC-SEG-01`).

Las 14 rutas de fuera de `/api/v1` se **REUTILIZAN**: 12 usan service-role y
es correcto, porque un trabajador de fondo no tiene sesión de usuario. Entran
en la lista blanca por categoría (`51` §7.1).

### 7.2 `src/app/` páginas — 490 líneas · **REUTILIZAR con dos correcciones**

Las cinco páginas legales existen y funcionan. Dos tienen contenido
desactualizado, ya documentado: `/privacidad` sin la declaración Limited Use
(`C-16`) y `/eliminar-datos` diciendo que el borrado puede no estar disponible
mientras la ruta funciona (`C-14`). Se corrigen con `AC-CONF-08` y
`AC-CONF-09`, de clase `contenido`.

`src/app/page.tsx` (23 líneas) pasa a ser la redirección de `WEB-D151`.
`src/app/(dashboard)/` contiene **solo un `.gitkeep`** y es donde el `12` §5
pone el grupo `(app)`.

---

## 8. `src/proxy.ts` — 59 líneas · **ADAPTAR**

Aquí había un error de terminología en el corpus que habría costado caro.

**En Next.js 16, Middleware se llama Proxy.** El fichero va en la raíz o en
`src/`, al mismo nivel que `app/`, y exporta una función llamada `proxy`. Solo
se admite uno por proyecto. Los documentos `12` §10 y `15` §7 decían
"middleware"; quien hubiera seguido esa palabra habría creado `middleware.ts`,
**un fichero que no se ejecuta y no avisa de nada**. Corregido en los dos.

El proxy actual refresca la sesión de Supabase y su manejo de cookies es
correcto. Le faltan dos cosas:

| Falta | Consecuencia hoy |
|---|---|
| Ocho rutas públicas en `PUBLIC_PATHS` | Se hace refresco de sesión en `/entrar`, `/crear-cuenta`, `/verificar`, `/auth/callback`, `/recuperar-clave`, `/restablecer-clave`, `/baja` y `/estado` |
| La redirección de `/` | `WEB-D151` no está implementado |

---

## 9. `src/agents/` — lo que el `42` dejó para aquí

El `42` juzgó el motor conversacional. Quedaban dos bolsas.

### 9.1 Los agentes que no son del motor — 2.460 líneas

| Agente | Líneas | Veredicto | Dueño |
|---|---|---|---|
| `email-extraction-agent/` | 1.072 | REUTILIZAR | módulo `28` |
| `evals/` | 297 | ADAPTAR | `51` |
| `learning-signal-agent/` | 214 | ADAPTAR | módulo `36` |
| `insight-experience-agent/` | 148 | ADAPTAR | módulo `34` |
| `risk-signal-agent/` | 137 | REUTILIZAR | módulo `33` |
| `recurring-signal-agent/` | 132 | REUTILIZAR | módulo `30` |
| `insight-narrator-agent/` | 125 | ADAPTAR | módulo `34` |
| `nudge-experience-agent/` | 117 | ADAPTAR | módulo `37` |
| `dedup-signal-agent/` | 115 | REUTILIZAR | módulo `27` |
| `disclosure-experience-agent/` | 103 | ADAPTAR | `45` |

El `42` §9 estimó "1.700 líneas que no son del motor". Medidas una por una son
**2.460**. La diferencia no cambia ningún veredicto y se registra porque el
corpus no redondea hacia el lado cómodo.

`email-extraction-agent` es el más grande y el más claro: extrae campos de un
correo con respaldo literal, que es exactamente lo que el módulo `28` pide.
Sobrevive entero.

### 9.2 Los ocho de `42` §8 — siguen sin decidir

`AC-REU-10` exige veredicto **antes de que empiece el corte que los toca**, no
antes. Este documento no lo adelanta: seguirían siendo veredictos emitidos
sobre lectura de superficie, que es lo que el `42` §3 se negó a hacer.

---

## 10. `src/adapters/` y `src/workers/`

| Área | Líneas | Veredicto |
|---|---|---|
| `adapters/whatsapp/` | 2.639 | REUTILIZAR, aislado (`WEB-D160`) |
| `adapters/email/` | 1.658 | REUTILIZAR |
| `workers/outbox/` | ~1.800 | REUTILIZAR |
| `workers/nudges/` | ~200 | ADAPTAR — el `37` cambia el canal |

El adaptador de WhatsApp es el único sitio donde el canal **debería** estar, y
está bien hecho. El problema no es este fichero: es que el canal también está
en 28 ficheros de `core/` (§4.1).

---

## 11. Las diez carpetas con solo un `.gitkeep`

```text
src/agents/insights          src/core/validators       src/workers/insights
src/app/(dashboard)          src/shared/dates          src/workers/pending
src/core/commands            src/workers/email         src/workers/recurring
src/core/engines
```

El `README.md` las documenta como si tuvieran código. Cuatro de ellas
—`commands`, `engines`, `validators`, `dates`— nombran conceptos que el corpus
sí usa: el `12` §3 dibuja `CommandDispatcher` y validadores dentro de `core/`,
y el `17` `AC-PAT-09` exige *"un único módulo de utilidades de fecha"*.

**Se conservan las cuatro y desaparecen las seis restantes.** Una carpeta vacía
que el diseño va a llenar es un marcador; una que nadie va a llenar es ruido
que hace mentir al README.

`src/app/(dashboard)/` está entre las seis que desaparecen. El grupo `(app)`
que dibuja `12` §5 **lo crea `W-07` con rutas dentro**, no se hereda
renombrando una carpeta vacía: renombrarla dejaría un marcador de un grupo de
rutas que todavía no existe, y los grupos de rutas de Next no son directorios
opcionales sino parte del árbol de enrutado.

---

## 12. Las dos ramas de migraciones

`src/data/migrations/` y `supabase/migrations/` tienen **46 ficheros `.sql`
cada una, con los mismos nombres y contenido byte a byte idéntico.**
Comprobado fichero a fichero: cero diferencias.

La divergencia que el diagnóstico inicial encontró —45 contra 46, y un índice
distinto en la `026`— **está resuelta**: se arregló en el saneamiento previo y
el decision log lo registra.

Pero **siguen siendo dos ramas**, y dos listas mantenidas a mano vuelven a
divergir. Es el mismo patrón que `C-03`, que las páginas legales y que el mapa
de rutas.

`WEB-D163` — **`supabase/migrations/` es la única rama.** `src/data/migrations/`
se sustituye por un enlace o desaparece, y `migrations.test.ts` —que hoy lee de
`src/data/migrations/`— pasa a leer de la rama única. Un test de clase `build`
falla si reaparecen dos árboles.

---

## 13. Reparto total

| Veredicto | Líneas de producción | Proporción |
|---|---|---|
| REUTILIZAR | ~36.000 | 41 % |
| ADAPTAR | ~29.000 | 33 % |
| REEMPLAZAR | ~18.000 | 20 % |
| DESCARTAR | ~300 | 0,3 % |
| Sin decidir (`42` §8) | ~3.830 | 4 % |
| Motor, ya repartido en `42` | resto | |

Son cuentas de inventario. La lectura que importa es doble.

**Tres de cada cuatro líneas sobreviven** —reutilizar más adaptar—, y eso
confirma la decisión de `WEB-D005`: el backend no era el problema.

**Y lo que se reemplaza es casi todo capa web.** De las ~18.000 líneas a
reemplazar, 16.000 están en `src/features/`. El diagnóstico que abrió este
corpus —*"backend sólido, capa web sin routing ni primitivas"*— se sostiene
tras medir el árbol entero, que no era obvio de antemano.

---

## 14. Lo que este documento no decide

- Los ocho ficheros de `42` §8: su veredicto llega en su corte (`AC-REU-10`).
- El orden de los cortes: es del `54`.
- Qué deuda es bloqueante y cuál no: es del `53`.
- Las marcas concretas de las cuatro librerías que el `12` §2 declara
  necesarias: es del `54`.

---

## 15. Criterios de aceptación

- `AC-INV-01` — Todo fichero de producción de `src/` tiene veredicto, o consta
  como "sin decidir" con su corte asignado. Evidencia: `TEST`. Clase: `corpus`.
- `AC-INV-02` — Ningún documento del corpus usa un vocabulario de veredictos
  distinto de los cuatro de §2. Evidencia: `TEST`. Clase: `corpus`.
- `AC-INV-03` — La prueba de agnosticismo del `21` compila contra el árbol.
  Evidencia: `TEST`.
- `AC-INV-04` — Ningún fichero de `src/core/` menciona un canal concreto.
  Evidencia: `TEST`. Clase: `lint`.
- `AC-INV-05` — Antes de reemplazar una pantalla, sus casos borde constan en
  el §19 de su módulo. Evidencia: `DOC`.
- `AC-INV-06` — `src/features/dashboard/` no existe y ninguna ruta lee
  `?view=`. Evidencia: `TEST`. Clase: `lint`.
- `AC-INV-07` — Existe un solo árbol de migraciones y un test lo verifica.
  Evidencia: `TEST`. Clase: `build`.
- `AC-INV-08` — Las seis carpetas con solo `.gitkeep` que nada va a llenar han
  desaparecido, y el `README.md` no documenta carpetas inexistentes.
  Evidencia: `TEST`. Clase: `lint`.
- `AC-INV-09` — El fichero de sesión se llama `proxy.ts` y exporta `proxy`; no
  existe `middleware.ts`. Evidencia: `TEST`. Clase: `lint`.
- `AC-INV-10` — `PUBLIC_PATHS` del proxy contiene todas las rutas que `10`
  §3.1 declara públicas, más `/estado` y `/baja` (`50` §5.2). Evidencia:
  `TEST`. Clase: `lint`.
- `AC-INV-11` — Los repositorios y adaptadores de WhatsApp se conservan sin
  cambios y no bloquean ningún corte web. Evidencia: `CODE`.
- `AC-INV-12` — Ninguna pantalla reemplazada deja controles sin manejador en
  su sustituta. Evidencia: `TEST`. Clase: `lint`.
- `AC-INV-13` — Todo resumen cuantitativo del corpus coincide con las filas de
  las que se deriva. Evidencia: `TEST`. Clase: `corpus`.

---

## 16. Fuera de alcance y puente a WhatsApp

Todo lo marcado REUTILIZAR-aislado —el adaptador, los dos repositorios, los 11
scripts y los 14 comandos de `package.json`— es el punto de partida de la fase
2 y se conserva sin tocar.

La auditoría de canal de §4.1 **no es trabajo perdido para WhatsApp**: es lo
que permite que el canal vuelva a entrar como presentador en vez de como
dependencia. Un `core/` que sabe de WhatsApp no puede servir a dos canales; uno
que no sabe de ninguno, sí.

---

## 17. Trazabilidad

| Elemento | Origen |
|---|---|
| Los cuatro veredictos | `42` §2 |
| Veredicto del motor conversacional | `42` §4 a §8 |
| Canal fuera del núcleo | `WEB-D105`, `21` (prueba de agnosticismo) |
| Backend se conserva, capa web se reconstruye | `WEB-D005` |
| Cursor, filtros, límite y CSRF en la API | `14` |
| Lista blanca de service-role | `15` §4, `AC-SEG-01` |
| Rutas reales y grupos | `10` §3, `12` §5 |
| Pruebas de WhatsApp aisladas | `WEB-D160`, `51` §12 |
| `C-14` y `C-16` en páginas legales | `05`, `45` `RUL-CONF-08` |
| Convención Proxy de Next 16 | `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` |
| Medición del árbol | Ejecutada el 26 de julio de 2026 |
| Decisiones nuevas | `WEB-D161`, `WEB-D162`, `WEB-D163` |

| Documento que depende de este | Qué toma |
|---|---|
| `53_deuda_tecnica_y_saneamiento.md` | Las 28 líneas de acoplamiento de canal, las dos ramas de migraciones, las carpetas vacías |
| `54_plan_de_implementacion_web.md` | El reparto por área, el corte de auditoría de canal, el orden de reemplazo de pantallas |
