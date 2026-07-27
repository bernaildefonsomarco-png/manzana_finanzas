# Prompt para iniciar la implementación

Copia todo lo que hay debajo de la línea en un chat nuevo de Claude Code,
abierto en `C:\Users\HP\Desktop\Manzana`.

---

Vas a empezar a implementar la aplicación web de Manzana, una app de finanzas
personales para Perú (soles, `America/Lima`). El producto está **documentado
por completo antes de escribir una línea de código de features**, y esa
decisión es deliberada: `documentacion/app_web/` contiene 59 documentos y
30.359 líneas escritas para que no tengas que tomar decisiones de producto
mientras programas.

**Tu primera tarea es `W-01`.** Pero antes lee, en este orden:

1. `documentacion/app_web/00_gobierno/00_indice_maestro.md` — qué hay y dónde.
2. `documentacion/app_web/07_calidad_y_ejecucion/54_plan_de_implementacion_web.md`
   — los veinte cortes. Lee entero el §2 (cómo se declara un corte), el §4
   (bloque A) y el §10 (el prompt de corte, que es tu guion de trabajo).
3. `documentacion/app_web/07_calidad_y_ejecucion/49_criterios_de_aceptacion_globales.md`
   §4 (los tres portones y qué significa "hecho") y §10 (las cinco reglas
   anti-autoengaño).
4. `documentacion/app_web/07_calidad_y_ejecucion/51_estrategia_de_pruebas_web.md`
   §4 (el árbol de decisión de clase de prueba) y §7 (las seis comprobaciones
   que fallan el build).
5. Los documentos que `W-01` declara en "Implementa".

## Lo que tienes que saber antes de tocar nada

**Esta no es la versión de Next.js que conoces.** El proyecto usa Next.js
16.2.7 y hay cambios de convención respecto a lo que tengas en memoria. El
caso que ya costó caro: **Middleware se llama Proxy**, el fichero es
`src/proxy.ts` y exporta una función `proxy`. Si creas `middleware.ts` no se
ejecuta y no avisa. Lee `node_modules/next/dist/docs/` antes de escribir
cualquier cosa que dependa de una convención del framework. Está también en
`AGENTS.md`.

**El backend se conserva, la capa web se reconstruye.** `src/core/` (25.475
líneas), `src/data/` y la mayoría de `src/app/api/v1/` sobreviven.
`src/features/` (18.142 líneas, 13 pantallas) se reemplaza casi entero. El
veredicto fichero a fichero está en `52_inventario_reutilizacion_codigo_src.md`.

**La línea base está verde y compila.** Comprobado el 26 de julio de 2026:

```
npm run typecheck    0 errores
npm run lint         0 problemas
npm run build        OK
npm test             863 pasan, 7 saltados (los 7 son de humo con API real)
```

Si algo de esto se rompe con un cambio tuyo, lo has roto tú.

**El corpus anterior, `docs/`, está congelado.** No lo edites y no lo uses
como fuente. Si lo necesitas para entender algo, el mapa de qué se heredó y
qué no está en `00_gobierno/02_mapa_herencia_corpus_legacy.md`. Un documento
de `docs/` que contradiga a uno de `documentacion/app_web/` **pierde siempre**.

## Cómo trabajas cada corte

El guion completo está en `54` §10. En resumen:

- Cada `RUL-` con ejemplo numérico se convierte en una prueba que usa ese
  ejemplo. Los ejemplos ya están escritos, en soles, revisados.
- Cada endpoint lleva los cinco casos de `51` §6.2, incluido el 404 —no 403—
  cuando el recurso es de otro usuario.
- Cada criterio que implementes recibe su clase de prueba según el árbol de
  `51` §4.
- **Antes de dar por buena una prueba, revierte el cambio que implementa su
  criterio y comprueba que la prueba falla.** Una prueba que pasa con y sin la
  funcionalidad no verifica nada.
- Ningún test se marca `skip`.
- No copies un criterio transversal de los documentos `14`–`19`, `47` o `48`
  dentro de un módulo. Se heredan sin nombrarlos.
- No arregles nada de un fichero que el `52` marcó REEMPLAZAR o DESCARTAR: va
  a desaparecer.

Al cerrar el corte, anota en
`documentacion/app_web/07_calidad_y_ejecucion/55_ledger_construccion_web.md`
qué entregaste, **qué te sorprendió** y qué quedó abierto. El formato está en
su §2. Esa sección de sorpresas no es decorativa: el ledger anterior dejó de
escribirse y cinco migraciones quedaron sin documentar durante meses.

## Cuándo tienes que parar y preguntar

- **Si un documento no dice algo que necesitas.** No inventes reglas de
  producto. El corpus se escribió para que no tuvieras que hacerlo; si falta
  algo, es un defecto del corpus y hay que corregirlo ahí primero.
- **Si un documento dice algo que crees que está mal.** Pasará y es sano.
  Se corrige el documento y la corrección va a
  `00_gobierno/03_decisiones_producto_web.md`. Lo que no puede pasar es
  reescribir un criterio en silencio hasta que el código lo cumpla.
- **Si dos documentos se contradicen.** Ha pasado cuatro veces durante la
  escritura y siempre significaba algo. Dilo antes de elegir uno.

## `W-01` — La verdad del repositorio

**Entrega:** el repositorio describe lo que contiene.

1. **Una sola rama de migraciones.** `src/data/migrations/` y
   `supabase/migrations/` tienen hoy 46 ficheros `.sql` idénticos byte a byte.
   `supabase/migrations/` es la única fuente (`WEB-D163`);
   `src/data/migrations/migrations.test.ts` pasa a leer de ella. Añade un test
   que falle si vuelven a existir dos árboles.
2. **Carpetas con solo `.gitkeep`.** Hay diez. Se conservan cuatro porque el
   diseño va a llenarlas —`src/core/commands/`, `src/core/engines/`,
   `src/core/validators/`, `src/shared/dates/`— y desaparecen las otras seis.
   Detalle en `52` §11.
3. **El `README.md` tiene ocho afirmaciones falsas** sobre el árbol, listadas
   en `53` §4. La peor dice que `adapters/whatsapp/` no está implementado
   cuando tiene 2.639 líneas. Corrígelas y añade un test que compare el README
   con el árbol real.
4. **`src/proxy.ts`:** completa `PUBLIC_PATHS` con las ocho rutas públicas que
   faltan (`/entrar`, `/crear-cuenta`, `/recuperar-clave`,
   `/restablecer-clave`, `/verificar`, `/auth/callback`, `/baja`, `/estado`) y
   añade la redirección de `/` — sin sesión a `/entrar`, con sesión a
   `/inicio` (`WEB-D151`).

**Cierra:** `AC-INV-07`, `AC-INV-08`, `AC-INV-09`, `AC-INV-10`, `AC-DEUDA-04`,
`AC-DEUDA-08`.

Es el corte más pequeño de los veinte y va primero porque todo lo demás se
apoya en creer lo que el repositorio dice.

## Lo que viene después, para que sepas hacia dónde vas

`W-02` RLS y arranque seguro · `W-03` infraestructura de pruebas · `W-04` sacar
el canal del núcleo · `W-05` contratos de API · `W-06` sistema de diseño ·
`W-07` esqueleto de rutas y patrones. **Los siete primeros no entregan ninguna
función de producto**, y es a propósito: es exactamente la parte que la
construcción anterior se saltó, y por eso hoy hay 17 modales hechos a mano,
cero rutas reales y 48 rutas de API esquivando RLS.

A partir de `W-08` cada corte entrega producto.

## Tres cosas que el corpus da por ciertas y todavía no lo son

Están en `53` §2 como deuda bloqueante, y las tres tienen corte asignado. Te
las digo ahora para que no te sorprendan:

- **El canal está dentro del núcleo.** 28 ficheros de `src/core/` mencionan
  WhatsApp. La prueba de agnosticismo del documento `21` no se puede escribir
  contra el árbol actual. Se arregla en `W-04`.
- **48 de las 58 rutas de `/api/v1` esquivan RLS** con `createServiceClient` y
  nada lo impide. Se arregla en `W-02`, y va antes que cualquier módulo.
- **Ninguna prueba verifica el aislamiento entre usuarios.** Hay 43 tablas con
  RLS y una sola comprobación, de humo, que cubre tres. Se arregla en `W-02`.

Empieza leyendo. Cuando tengas claro `W-01`, dime qué vas a hacer antes de
hacerlo.
