# 01 — Convenciones y plantillas

**Bloque:** 00 — Gobierno
**Estado:** V1
**Fecha:** 25 de julio de 2026
**Depende de:** ninguno
**Documentos que dependen de este:** todos los de `02_fundaciones/` en adelante

---

## 1. Para qué existe este documento

Todos los documentos de `documentacion/app_web/` a partir del bloque
`02_fundaciones/` siguen las mismas reglas de forma: mismo sistema de IDs,
mismos niveles de evidencia, misma plantilla de módulo, mismo criterio para
saber cuándo un documento está terminado.

Esto no es burocracia decorativa. El problema que resolvemos viene de
`docs/`: tres documentos (`05c_dashboard.md`, `17_dashboard_ux.md`,
`32_especificacion_hifi.md`) describen las mismas 8 pantallas con 60-70% de
solapamiento y sin un criterio único de qué sección vive dónde. Con una
plantilla fija, cada tema tiene **un solo lugar** donde vive.

---

## 2. Sistema de numeración del corpus

El número de archivo **es el orden de escritura**, no el orden de lectura.
El orden de lectura recomendado por rol vive en `00_indice_maestro.md`.

Regla práctica: si al escribir el documento `N` descubrimos que necesitamos
un concepto que debería vivir en un documento anterior (por ejemplo, un
módulo necesita una primitiva de UI que `16_design_system_web.md` no
contempla), **se amplía el documento anterior**, no se inventa localmente
una solución ad-hoc dentro del documento `N`. El corpus no crece por
duplicación de reglas.

---

## 3. Sistema de identificadores

Todo elemento que otro documento, un test o una tarea de implementación
necesite referenciar tiene un ID estable con este formato:

```
<PREFIJO>-<MOD>-<NN>
```

| Prefijo | Qué identifica | Ejemplo |
|---|---|---|
| `MOD-` | Un módulo funcional completo (uno por documento de `04_modulos/`) | `MOD-MOVIMIENTOS` |
| `SCR-` | Una pantalla o superficie de UI dentro de un módulo | `SCR-MOVIMIENTOS-01` (listado), `SCR-MOVIMIENTOS-02` (detalle) |
| `ACT-` | Una acción que el usuario puede disparar | `ACT-MOVIMIENTOS-03` (eliminar movimiento) |
| `RUL-` | Una regla de negocio verificable | `RUL-CUENTAS-05` (fórmula de dinero libre) |
| `ERR-` | Un error de dominio con mensaje visible | `ERR-DEUDAS-02` (cuota ya pagada) |
| `AC-` | Un criterio de aceptación | `AC-PENDIENTES-04` |

`<MOD>` es el **token del módulo**, en mayúsculas (ej. `MOVIMIENTOS`,
`CUENTAS`, `DEUDAS`, `PRESUPUESTOS`). `<NN>` es un número de dos dígitos,
correlativo dentro del módulo, que **nunca se reutiliza** aunque el elemento
se elimine — si `RUL-CUENTAS-03` se retira, ese número queda muerto y el
siguiente es `RUL-CUENTAS-04` en adelante.

**El token se asigna, no se infiere** (`WEB-D143`). Sale del registro de
`50_matriz_de_trazabilidad_web.md` §2, que es la única fuente, y un test sobre
el corpus falla si aparece un token no registrado o si un token se define en
dos documentos.

Esta regla llegó tarde y costó caro. La redacción anterior decía "el nombre
corto del módulo", y abreviar un nombre es una operación que dos autores
resuelven distinto: "recurrentes" y "recordatorios" abrevian igual, y también
"categorías" y "catálogo". El resultado fueron **69 identificadores con dos
significados**, 46 de ellos entre los módulos 30 y 37 en las cinco familias a
la vez. El inventario completo y su corrección están en
`49_criterios_de_aceptacion_globales.md` §3 y §14.

Estos IDs se agregan mecánicamente en tres documentos:
- `40_catalogo_de_tools_y_comandos.md` agrega los `ACT-` que exponen tools/comandos al motor IA.
- `49_criterios_de_aceptacion_globales.md` agrega los `AC-` y define qué significa cerrarlos.
- `50_matriz_de_trazabilidad_web.md` agrega todos los IDs contra su implementación real, y aloja el registro de tokens.

---

## 4. Niveles de evidencia

Heredado de `docs/fase_4_tecnica/matriz_cumplimiento_integral_v1_2026-07-24.md`
§2.2, porque ya demostró ser el criterio correcto para no confundir una
intención documentada con una capacidad real:

| Código | Evidencia | Quién la produce |
|---|---|---|
| `DOC` | Existe como documento o contrato, nada más. | El propio corpus |
| `CODE` | Hay código que lo implementa. | Implementación |
| `TEST` | Hay una prueba automatizada local que lo verifica. | Implementación |
| `SMOKE` | Se verificó contra infraestructura real o staging. | Implementación |
| `LIVE` | Recorrido real con proveedor o canal real (Gmail real, Supabase real). | Implementación + QA |
| `USER` | Resultado observado y evaluado por un usuario real. | QA / producto |
| `METRIC` | Serie operativa con volumen, objetivo y decisión tomada sobre ella. | Producto en operación |

**Regla dura, sin excepción:** un criterio no se marca `Cumple USER` a partir
de evidencia `TEST` o `SMOKE`. Cada nivel es necesario pero no sustituye al
siguiente. Todo criterio de aceptación (`AC-`) en los documentos de módulo
debe declarar qué nivel de evidencia exige antes de considerarse cumplido.

**El enum es cerrado: siete niveles y ninguno más.** No existe "revisión", ni
"validado por el equipo", ni ninguna variante que signifique "alguien lo
mira" — que en la práctica significa que nadie lo mira. El corpus llegó a
tener cuatro criterios con "revisión" inventada sobre la marcha; tres de ellos
eran tests que nadie había visto como tales
(`49_criterios_de_aceptacion_globales.md` §6.2).

**Segundo eje: la clase de prueba.** El nivel dice *cuánta* evidencia hace
falta; no dice *quién la produce*. Un criterio que falla la compilación y otro
que falla una suite son ambos `TEST` y no cuestan lo mismo ni protegen igual.
Por eso todo criterio cuyo nivel incluya `TEST` declara además su clase, del
enum de `49` §6.1.

**Los tres portones.** Los siete niveles se agrupan en `G1` construido
(`DOC`/`CODE`/`TEST`), `G2` probado en real (`SMOKE`/`LIVE`) y `G3` validado
(`USER`/`METRIC`). Un corte del plan de implementación cierra con `G1` y `G2`;
los de `G3` no se pierden, cambian de estado (`WEB-D144`, `WEB-D145`). La
definición completa está en `49` §4.

---

## 5. Estados de documento

| Estado | Significado |
|---|---|
| `borrador` | En escritura, puede tener secciones incompletas marcadas explícitamente. |
| `revisión` | Completo según la plantilla, pendiente de que el usuario lo apruebe. |
| `aprobado` | Aceptado como fuente de verdad para implementación. |
| `vivo` | Se actualiza continuamente durante la implementación (índices, ledger, matriz de trazabilidad, decision log). |

**Dónde vive el estado.** No en el encabezado de cada documento, sino en la
tabla de `00_indice_maestro.md`. El encabezado de un documento declara su
**alcance** (`V1`, `V1.1`, `V1 (reescritura)`), que es una propiedad estable
del contenido; el estado de revisión cambia con cada ronda y duplicarlo en 60
cabeceras garantiza que se desincronice. Los documentos `vivo` sí llevan en su
encabezado una fecha de última actualización, que se cambia en cada edición
real y no en las cosméticas.

---

## 6. Reglas de estilo

- **Idioma:** español, sin anglicismos evitables. Términos técnicos en inglés
  solo cuando no tienen traducción natural en el dominio (ej. `webhook`).
- **Moneda:** siempre `S/` seguido del monto con separador de miles por coma
  y dos decimales cuando aplique: `S/1,250.50`. Ningún ejemplo numérico de
  regla de negocio se escribe sin esta notación.
- **Fechas:** formato `DD de mes de AAAA` en prosa, `AAAA-MM-DD` en tablas y
  ejemplos técnicos. Zona horaria de referencia: `America/Lima` (UTC-5, sin
  horario de verano) — se declara explícitamente en cualquier regla que
  dependa de "hoy", "esta semana" o "vencimiento".
- **Mensajes de error visibles:** siempre en español, sin exponer mensajes
  crudos de proveedor (Supabase, OAuth, etc.). Ver `ERR-` en la plantilla de
  módulo, §9 de este documento.
- **Palabras prohibidas frente al usuario:** heredadas de
  `docs/fase_3_producto/12_lenguaje_producto.md` §15 — `insight`, `nudge`,
  `recurrente` como label principal, `pipeline`, `orchestrator`, `policy`,
  `confidence score`, `outbox`, `event bus`, `runtime`, `schema`,
  `determinístico`, `clasificación semántica`, `modelo`. El glosario completo
  vive en `04_glosario_y_lenguaje_visible.md`.
- **Ejemplos numéricos obligatorios:** toda regla de negocio (`RUL-`) se
  acompaña de al menos un ejemplo numérico completo en soles, no solo la
  fórmula abstracta.

---

## 7. Versionado

Cada documento nace en `V1`. Un cambio de alcance o de regla sube la versión
(`V1.1`, `V2`); una corrección de redacción sin cambio de contenido no la
sube. Todo cambio de versión que afecte una decisión ya tomada se registra
también en `03_decisiones_producto_web.md`, con fecha y motivo — igual que
`docs/fase_4_tecnica/20_decisiones_tecnicas.md` lo hacía para el corpus
anterior.

---

## 8. La plantilla obligatoria de módulo (22 secciones)

Todo documento de `04_modulos/` (24 a 39) sigue exactamente esta estructura.
**Las 22 secciones son obligatorias.** Si una no aplica al módulo, se escribe
`No aplica` seguido de una frase que explique por qué — está prohibido
omitir la sección completa, porque un documento con secciones ausentes no
permite saber si algo se olvidó o si de verdad no aplicaba.

### Encabezado (frontmatter)

```
ID de módulo: MOD-<NOMBRE>
Versión, estado, fecha
Docs fuente (rutas exactas de docs/ o de otros documentos de este corpus)
Docs que dependen de este
```

### Las 22 secciones

1. **Tesis y qué NO es** — el problema que resuelve en un párrafo, y qué
   trabajo explícitamente no hace este módulo.
2. **Alcance** — tabla `IN V1-web` / `V1.1` / `FUERA`, función por función.
3. **Vocabulario** — interno ↔ visible, con enlace a `04_glosario_y_lenguaje_visible.md`.
4. **Entidades y datos** — tablas, campos, tipos, enums, invariantes,
   relaciones; migraciones nuevas requeridas con número tentativo.
5. **Máquina de estados** — estados, transiciones, quién las dispara, efectos,
   cuáles son irreversibles.
6. **Reglas de negocio** — cada una con ID `RUL-<MOD>-NN`, fórmula y **ejemplo
   numérico en soles**.
7. **Validaciones** — por campo: obligatoriedad, rango, normalización, zona
   horaria, redondeo, colisiones.
8. **Superficies** — por pantalla, ID `SCR-<MOD>-NN`, **una sola ruta URL
   real** (no dos candidatas separadas por "o"), layout, jerarquía,
   mobile/desktop, y **referencia visual**: o bien
   `docs/fase_6_visual/32_especificacion_hifi.md` con su carpeta de frames en
   `stitch_manzana_v1/`, o bien la declaración explícita de que **no existe
   frame previo** porque la pantalla es nueva. Lo segundo es el caso de todo
   lo que `05c` §20 dejaba fuera de V1: presupuestos, proyecciones, reportes.
   Enlazar a un frame que no existe es peor que decir que no lo hay.
9. **Acciones** — ID `ACT-<MOD>-NN`: precondición, dónde se dispara, si
   requiere confirmación, resultado, **cómo se deshace** (si se puede),
   evento de dominio emitido.
10. **API** — endpoints con request/response, paginación por cursor, filtros
    server-side, orden, idempotencia, códigos de error.
11. **Permisos y RLS** — quién ve qué; cliente autenticado por defecto vs
    service-role **con justificación explícita** si se pide excepción.
12. **Estados de datos** — vacío, primera vez, pocos datos, muchos datos,
    cargando, error, degradado, modo discreto.
13. **Errores** — ID `ERR-<MOD>-NN`: causa, mensaje visible en español,
    acción de salida disponible, si es recuperable.
14. **Integración con el motor IA** — tools read-only expuestas, comandos de
    escritura aceptados, qué evidencia devuelve cada una, qué se puede pedir
    en lenguaje natural, qué exige confirmación explícita. Alimenta
    `40_catalogo_de_tools_y_comandos.md`.
15. **Memoria y aprendizaje** — qué aprende el sistema en este módulo, con
    qué evidencia, cómo se corrige, cómo se olvida. Alimenta
    `36_modulo_memoria_y_aprendizaje.md`.
16. **Eventos y telemetría** — eventos de dominio, métricas de producto, qué
    se registra y qué explícitamente no.
17. **Rendimiento** — tamaño de página, límites, índices requeridos,
    presupuesto de latencia.
18. **Accesibilidad específica** — teclado, foco, anuncios de lector de
    pantalla, tablas y gráficos si aplica.
19. **Casos borde** — numerados, con comportamiento esperado explícito.
20. **Criterios de aceptación** — ID `AC-<MOD>-NN`, verificables, cada uno con
    su nivel de evidencia exigido (§4) y, si ese nivel incluye `TEST`, su
    **clase de prueba** del enum de
    `49_criterios_de_aceptacion_globales.md` §6.1 (`unidad`, `integracion`,
    `e2e`, `lint`, `build`, `presupuesto`, `contenido`, `corpus`). Los dos
    campos son obligatorios: el nivel dice cuánta evidencia hace falta, la
    clase dice quién la produce. Un criterio transversal de `14`–`19`, `47` o
    `48` **no se copia aquí** (`WEB-D148`); si el módulo necesita algo
    distinto, declara la excepción con su justificación.
21. **Fuera de alcance y puente a WhatsApp** — qué queda fuera de V1-web y
    qué se reserva explícitamente para cuando WhatsApp entre como canal.
22. **Trazabilidad** — qué documentos de `docs/` consume (rutas exactas de
    `docs/`), qué contradicciones `C-xx` de
    `05_contradicciones_heredadas_cierre.md` cierra.

### Gate de calidad (cuándo un módulo está terminado)

Un documento de módulo está terminado cuando una persona que **no ha leído
`docs/`** puede implementarlo completo sin hacer una sola pregunta de
producto. Prueba práctica: las secciones 6 (reglas), 9 (acciones), 13
(errores) y 20 (criterios de aceptación) deben bastar, por sí solas, para
escribir los tests de ese módulo antes de escribir el código.

---

## 9. Nota sobre errores visibles

Todo `ERR-` sigue este contrato mínimo: causa técnica interna, mensaje en
español dirigido al usuario (nunca el mensaje crudo del proveedor — ver
contradicción `C-13`, donde hoy `auth-screen.tsx` publica literalmente
`Invalid login credentials` en inglés), y una acción de salida clara
("reintentar", "contactar soporte", "revisar el dato"). Ningún `ERR-` se
declara terminado si le falta cualquiera de los tres.
