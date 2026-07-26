# 48 — Ayuda, explicabilidad y soporte

**Bloque:** 06 — Transversales
**Alcance:** V1
**Fecha:** 26 de julio de 2026
**Docs fuente:** `22_grounding_evidencia_y_politica.md` §2 y §3, `08_principios_experiencia_web.md` (procedencia), `44_onboarding_web.md` `RUL-ONB-04`, y las §8 de los dieciséis módulos
**Documentos que dependen de este:** `54` (plan de implementación)

---

## 1. Tesis y qué NO es

Un producto que dice **"tienes S/560 libres"** está pidiendo que le crean. La
única forma honesta de pedirlo es poder responder, siempre y en un clic,
**de dónde sale esa cifra**.

Ese es el patrón que este documento convierte en algo reutilizable. No es
ayuda en el sentido habitual —artículos, preguntas frecuentes, un buscador de
soporte—: es que **cada número del producto sea navegable hasta las filas que
lo componen**.

La ayuda tradicional existe, pero es la segunda mitad y la más pequeña. La
primera mitad es que **haya menos que explicar**: un producto que necesita un
artículo para justificar una cifra tiene un problema de diseño, no de
documentación.

De ahí las tres capas del documento, en orden de valor:

| Capa | Qué es | Cuándo aparece |
|---|---|---|
| **Procedencia** | De dónde sale esta cifra | Siempre, en toda cifra |
| **Explicación en sitio** | Qué es esto | La primera vez que aparece un concepto |
| **Ayuda y soporte** | Cómo se hace algo, y a quién escribir | Cuando el usuario la busca |

**Qué NO es:**

- **No es un chat de soporte en vivo.** Está FUERA (`07` §3.18) y no hay
  personal para sostenerlo.
- **No es el asistente.** Manzana responde sobre el dinero del usuario; la
  ayuda responde sobre el producto. Se distinguen en `RUL-AYUDA-07`.
- **No es un centro de conocimiento.** Nueve artículos, no noventa.

## 2. Alcance

| Nivel | Funcionalidad |
|---|---|
| **IN** | El patrón de procedencia como componente reutilizable, presente en toda cifra. Explicaciones en sitio de los conceptos propios, una vez cada una. Un conjunto acotado de artículos de ayuda. Contacto por correo con contexto adjunto. Página de estado del producto cuando algo falla. |
| **V1.1** | Buscador dentro de la ayuda. Vídeos cortos. Ayuda contextual sugerida por el asistente. |
| **FUERA** | Chat de soporte en vivo. Foro o comunidad. Base de conocimiento extensa. Tutoriales interactivos. |

## 3. Vocabulario

| Interno | Visible |
|---|---|
| `evidence_refs`, `provenance` | — (**nunca visible**) |
| `EvidenceLink` | "¿De dónde sale?" · "Ver el detalle" |
| Explicación en sitio | — |
| Artículo de ayuda | Ayuda |

Prohibido frente al usuario: `evidencia`, `procedencia`, `trazabilidad`,
`grounding`, `referencia`, además de la lista de
`04_glosario_y_lenguaje_visible.md` §10.

```text
Correcto:   ¿De dónde sale?
Correcto:   Ver los 14 movimientos
Incorrecto: Ver evidencia
Incorrecto: Trazabilidad del cálculo
```

## 4. La procedencia

**`RUL-AYUDA-01` — Toda cifra es navegable hasta sus filas**

La aplicación en la interfaz de la invariante de `22` §2. Sin excepciones y en
todas las superficies: Inicio, módulos, reportes, descubrimientos, asistente.

```text
Nivel 1  la cifra              S/560.00
Nivel 2  su composición        De S/1,140 en cuentas: S/500 en cajas
                               y S/89 de compromisos sin apartar
Nivel 3  las filas             las 3 cuentas, las 4 cajas, el compromiso
Nivel 4  cada fila             su detalle, y de dónde salió ese movimiento
```

**El nivel 2 no está tras un clic: está debajo de la cifra** (`RUL-HOME-01`).
Los niveles 3 y 4 sí.

Y el nivel 4 es el que cierra el círculo: un movimiento que vino del correo
dice de qué correo vino; uno que vino del asistente, de qué frase.

**`RUL-AYUDA-02` — La explicación dice qué se contó y qué no**

La mitad que se olvida, y la que más confianza construye.

```text
De dónde sale este S/318

Qué conté         14 gastos de Alimentación, del 1 al 26 de julio
Qué no conté      2 transferencias entre tus cuentas
                  1 pendiente del correo sin confirmar
Cómo lo calculé   La suma de los 14
Los movimientos   [lista navegable]
```

Alguien que ve que excluimos las transferencias entiende que sabemos lo que
hacemos. Alguien que solo ve el resultado tiene que creernos.

Y el pendiente sin confirmar es un puente, no una nota: **si hay algo sin
confirmar, la cifra está incompleta y el usuario puede arreglarlo desde ahí**
(`RUL-REP-02`).

**`RUL-AYUDA-03` — Una cifra sin procedencia no se muestra**

No es una regla de interfaz: **el verificador rechaza el bloque antes de que
salga** (`21` §5, `22` §11).

Si una cifra no puede explicarse, no se emite. Se dice qué falta y se ofrece la
vía manual. Es preferible no dar un número a dar uno que no se sostiene.

**`RUL-AYUDA-04` — Las cifras del futuro explican sus supuestos, no sus filas**

Una proyección no tiene filas que la compongan: tiene supuestos. Su
procedencia es distinta y está en `SCR-PROY-02`:

```text
Dinero libre hoy                     S/560.00  [ver desglose]
  Libre en cuentas        S/649.00
  − Compromisos sin caja  − S/89.00            [ver cuáles]
− Ritmo estimado (5 días × S/62)    − S/310.00 [ver los 14 días]
─────────────────────────────────────────────
= Proyección de cierre               S/250.00
```

Cada línea es navegable, y la sangría comunica la aritmética. **Es la
diferencia entre explicar un cálculo y enseñar sus entradas.**

## 5. Las explicaciones en sitio

**`RUL-AYUDA-05` — Cada concepto se explica donde aparece, una vez**

Heredado de `RUL-ONB-04` y ampliado a todo el producto, no solo al primer día.

| Concepto | Dónde se explica | Por qué hace falta |
|---|---|---|
| Dinero libre | La primera vez que se muestra | Es la cifra que gobierna el producto |
| Caja | Al crear la primera | Se confunde con presupuesto |
| Presupuesto que no reserva | Al crear el primero | Es contraintuitivo (`RUL-PRES-01`) |
| Compromiso cubierto | Al vincular la primera caja | Explica por qué no baja el dinero libre |
| Pendiente | Al llegar el primero | Explica por qué no se registró solo |
| Procedencia | La primera vez que se pulsa una cifra | Enseña que el patrón existe |
| Memoria | La primera vez que se aplica algo aprendido | Es cuando el usuario nota que el sistema decidió |
| Tramo de presupuesto | Al cruzar el primer umbral | Distingue estado de aviso (`WEB-D032`) |
| Modo discreto | Al activarlo | Qué oculta y qué no |

Nueve conceptos, y **son los nueve que el producto inventa o resignifica**. Lo
que se entiende solo no se explica: no hay una explicación de qué es un gasto.

La séptima merece atención: **el momento en que el sistema aplica un
aprendizaje es el momento en que el usuario descubre que hay un sistema.** Si
eso pasa sin explicación, la primera reacción es "¿por qué puso esto en
Alimentación?", y esa pregunta merece respuesta antes de que se haga.

**`RUL-AYUDA-06` — Una explicación no tapa lo que explica**

- Anclada al elemento, nunca superpuesta encima.
- Cerrable, y **una sola vez** por concepto.
- No roba el foco (`AC-ONB-14`).
- Con enlace a su artículo permanente.
- Se puede volver a ver desde la ayuda, para quien la cerró sin leer.

## 6. La ayuda y el soporte

**`RUL-AYUDA-07` — La ayuda responde sobre el producto; Manzana, sobre tu dinero**

La frontera, que sin declararla se borra sola:

| Pregunta | Quién responde |
|---|---|
| "¿Cuánto gasté en julio?" | **Manzana** (`41`) |
| "¿Por qué mi dinero libre es 560?" | **Manzana**, con procedencia |
| "¿Cómo conecto mi correo?" | **La ayuda** |
| "¿Manzana lee todos mis correos?" | **La ayuda** |
| "¿Por qué no me detectó este pago?" | **Manzana**, con el diagnóstico de `28` §14.3 |
| "¿Cómo elimino mi cuenta?" | **La ayuda**, que lleva a la pantalla |

La cuarta y la sexta importan: son preguntas **sobre el producto**, y el
asistente no las responde inventando. Las deriva a la ayuda con un bloque
`mostrar`, igual que deriva a las pantallas de cuenta (`43` §14).

Y el reverso, que es `WEB-D025`: el asistente **nunca dice "solo puedo
ayudarte con temas financieros"**. Deriva, que es distinto de negarse.

**`RUL-AYUDA-08` — Nueve artículos, no noventa**

La ayuda de V1 es un conjunto cerrado, alcanzable en `/ayuda`:

| Artículo | Responde |
|---|---|
| Qué es el dinero libre | La pregunta que más se hace |
| Cajas, compromisos y presupuestos: en qué se diferencian | Los tres se confunden |
| Cómo conecto mi correo y qué leo de él | El permiso más delicado |
| Por qué nada se registra solo | La promesa central de `27` |
| Cómo corrijo algo mal clasificado | El control más usado |
| Qué recuerdo de ti y cómo lo borras | `C-08` explicado |
| Cómo me llevo mis datos | `RUL-REP-11` |
| Cómo elimino mi cuenta | `C-14` explicado |
| Qué hago cuando no puedo responder | Los límites, dichos de frente |

**Nueve porque son los nueve que la gente va a preguntar**, y porque una base
de conocimiento grande es una que nadie mantiene. Cada artículo se escribe
cuando su función existe, y si una función necesita tres artículos, la función
está mal diseñada.

El noveno es inusual y deliberado: un producto que documenta lo que **no**
hace y por qué es más creíble que uno que solo lista virtudes.

**`RUL-AYUDA-09` — El contacto lleva contexto, y el usuario lo ve antes de enviarlo**

Sin chat en vivo, el contacto es por correo desde `/ayuda/contacto`.

Al escribir se adjunta automáticamente, **mostrándolo**:

```text
Voy a enviar esto con tu mensaje, para poder ayudarte:
  · Tu correo
  · La pantalla en la que estabas
  · La hora y el identificador del último error
  · Versión de la aplicación y del navegador

No envío tus movimientos, tus montos ni tus conversaciones.
                                          [Ver exactamente qué]
```

Dos reglas:

1. **Nunca datos financieros.** Ni montos, ni descripciones, ni conversaciones.
   El `trace_id` permite encontrar el fallo en los registros sin llevar el
   contenido.
2. **El usuario ve qué se envía antes de enviarlo**, y puede quitarlo. Adjuntar
   contexto en silencio en un producto de finanzas es exactamente lo que no se
   puede hacer.

**`RUL-AYUDA-10` — Cuando algo falla, se dice dónde mirar**

Página de estado en `/estado`, pública y sin sesión.

Se enlaza desde los errores que lo justifican —`ERR-ASI-01`, `ERR-HOME-03`—
para que "no puedo cargar" tenga a dónde ir. Una aplicación que falla sin
decir si es ella o el usuario obliga a probar cosas al azar.

En V1 se actualiza a mano. Es aceptable: **una página de estado desactualizada
es peor que ninguna**, así que se declara cuándo se actualizó y no se promete
tiempo real.

## 7. Superficies

| ID | Superficie | Ruta |
|---|---|---|
| `SCR-AYUDA-01` | Procedencia de una cifra | Panel, desde cualquier cifra |
| `SCR-AYUDA-02` | Explicación en sitio | Componente |
| `SCR-AYUDA-03` | Índice de ayuda | `/ayuda` |
| `SCR-AYUDA-04` | Artículo | `/ayuda/[tema]` |
| `SCR-AYUDA-05` | Contacto | `/ayuda/contacto` |
| `SCR-AYUDA-06` | Estado del producto | `/estado` |

### `SCR-AYUDA-01` — Procedencia

Panel lateral, **no modal**, para poder comparar con lo que hay detrás. Es el
mismo criterio que el asistente (`RUL-ASI-01`) y por la misma razón: la
explicación de una cifra se lee mirando la cifra.

```text
┌────────────────────────────────────────┐
│ De dónde sale este S/318          [✕]  │
├────────────────────────────────────────┤
│ Qué conté                              │
│   14 gastos de Alimentación            │
│   Del 1 al 26 de julio                 │
│                                        │
│ Qué no conté                           │
│   2 transferencias entre tus cuentas   │
│   1 pendiente del correo sin confirmar │
│   [Revisar ese pendiente]              │
│                                        │
│ Los 14 movimientos                     │
│   26 jul  Rappi          S/32.00    →  │
│   24 jul  Mercado        S/58.00    →  │
│   …                                    │
└────────────────────────────────────────┘
```

### `SCR-AYUDA-03` — Índice

Nueve artículos en una lista, sin categorías ni buscador. **Con nueve
elementos, un buscador es peor que la lista.**

## 8. Acciones

| ID | Acción | ¿Confirma? | Deshacer | Evento |
|---|---|---|---|---|
| `ACT-AYUDA-01` | Ver la procedencia de una cifra | No | — | `evidencia.consultada` |
| `ACT-AYUDA-02` | Abrir un movimiento desde la procedencia | No | Atrás | `evidencia.fila_abierta` |
| `ACT-AYUDA-03` | Resolver lo que falta desde la procedencia | No | La de destino | `evidencia.pendiente_resuelto` |
| `ACT-AYUDA-04` | Cerrar una explicación | No | Desde la ayuda | `ayuda.explicacion_cerrada` |
| `ACT-AYUDA-05` | Abrir un artículo | No | — | `ayuda.articulo_abierto` |
| `ACT-AYUDA-06` | Escribir a soporte | **Sí** | — | `ayuda.contacto_enviado` |
| `ACT-AYUDA-07` | Quitar contexto del mensaje | No | Volviéndolo a marcar | `ayuda.contexto_quitado` |
| `ACT-AYUDA-08` | Ver el estado del producto | No | — | `ayuda.estado_visto` |

`ACT-AYUDA-06` confirma porque envía datos fuera del producto, aunque no sean
financieros. Es la única acción del documento que sale.

## 9. Integración con el motor IA

### 9.1 Comandos

| Comando | Confirmación |
|---|---|
| `mostrar_ayuda` | `ninguna`: navega |

Uno solo, y navega. Este documento no tiene escrituras.

### 9.2 Qué se puede pedir

```text
"¿de dónde sale ese número?"      → procedencia de la última cifra
"¿qué es el dinero libre?"        → artículo, y la explicación en sitio
"¿lees todos mis correos?"        → artículo, no una respuesta inventada
"no entiendo esto"                → procedencia de lo que hay en pantalla
```

La cuarta usa el contexto de pantalla (`RUL-ASI-11`): "esto" es lo que el
usuario tiene delante.

### 9.3 Lo que el motor NO puede hacer

- **Improvisar respuestas sobre el producto.** Las preguntas sobre qué hace
  Manzana se responden con el artículo, no con lo que el modelo suponga. Es lo
  que impide que el asistente prometa funciones que no existen.
- Emitir una cifra sin procedencia (`RUL-AYUDA-03`).
- Enviar un mensaje a soporte.
- Decir que hay una incidencia sin que `/estado` lo diga.

La primera es la más importante y la menos obvia: **un asistente que explica
el producto de memoria acaba describiendo el producto que le parece
razonable**, no el que existe.

## 10. Métricas

Eventos: `evidencia.consultada`, `.fila_abierta`, `.pendiente_resuelto`,
`ayuda.explicacion_vista`, `.explicacion_cerrada`, `.articulo_abierto`,
`.contacto_enviado`, `.contexto_quitado`, `.estado_visto`.

Sin montos, sin contenido de mensajes.

| Métrica | Qué indica |
|---|---|
| **Consultas de procedencia por usuario** | Si el patrón se descubre y se usa |
| **Procedencias que terminan resolviendo un pendiente** | Que `RUL-AYUDA-02` funciona como puente |
| Artículos abiertos, por artículo | Qué confunde de verdad |
| Explicaciones cerradas de inmediato | Cuáles estorban |
| Mensajes a soporte, por pantalla de origen | **Dónde el producto no se explica solo** |
| Contexto quitado antes de enviar | Si adjuntamos de más |

La quinta es la métrica de calidad de todo el producto, no solo de este
documento: **cada mensaje a soporte es una pantalla que no se explicó sola.**

Y la primera tiene un matiz que conviene decir: **un valor bajo no significa
que la procedencia sobre.** Significa que la gente confía en las cifras, que
es lo que se buscaba. Lo que hay que vigilar es que quien la busca la
encuentre.

## 11. Accesibilidad

- El control de procedencia es un botón con etiqueta completa:
  `aria-label="De dónde sale este total de 318 soles"`, nunca solo "?".
- El panel es un `dialog` no modal con foco gestionado; `Esc` cierra y
  devuelve el foco a la cifra.
- "Qué conté" y "Qué no conté" son encabezados reales.
- Las explicaciones en sitio se anuncian en `aria-live="polite"` y **no roban
  el foco**.
- Los artículos son documentos con estructura de encabezados, legibles con el
  navegador ampliado al 200%.
- El formulario de contacto dice qué se adjunta **en el texto**, no solo en un
  icono.
- `/estado` es legible sin JavaScript.

## 12. Casos borde

1. **Cifra compuesta de otra cifra compuesta.** La procedencia baja un nivel
   por vez, con migas para volver.
2. **Movimiento borrado que formaba parte de una cifra ya vista.** La
   procedencia lo muestra tachado y dice cuándo se borró.
3. **Procedencia de una cifra de hace tres meses.** Funciona: los datos no
   caducan (`RUL-VIDA-09`).
4. **Cifra de una proyección.** No lleva filas, lleva supuestos
   (`RUL-AYUDA-04`).
5. **Explicación cerrada sin leer y buscada después.** Está en su artículo.
6. **Soporte desde una pantalla sin errores.** Se adjunta el contexto sin
   `trace_id` de error, y se dice.
7. **Usuario que quita todo el contexto.** Se envía solo su mensaje y su
   correo. Se acepta: es su decisión.
8. **`/estado` desactualizada.** Muestra su fecha de actualización, siempre.
9. **Pregunta sobre el producto que no tiene artículo.** El asistente lo dice y
   ofrece escribir a soporte. **No improvisa.**
10. **Procedencia de una cifra en modo discreto.** El panel también oculta los
    montos (`RUL-CONF-03`); las descripciones y el conteo se ven.

El caso 9 es el que sostiene `RUL-AYUDA-07`: es preferible admitir que no hay
respuesta escrita a inventar una descripción del producto.

## 13. Criterios de aceptación

- `AC-AYUDA-01` — **Toda cifra visible tiene procedencia navegable.** Sin
  excepciones, en todas las superficies. Evidencia: `TEST` + `USER`.
- `AC-AYUDA-02` — La procedencia declara **qué se contó y qué no**.
  Evidencia: `TEST` + `USER`.
- `AC-AYUDA-03` — Una cifra sin procedencia **no se emite**: el verificador la
  rechaza. Evidencia: `TEST`.
- `AC-AYUDA-04` — La procedencia de una proyección muestra sus supuestos línea
  por línea, navegables. Evidencia: `TEST`.
- `AC-AYUDA-05` — Si hay pendientes sin confirmar que afectan la cifra, la
  procedencia lo dice y lleva a resolverlos. Evidencia: `TEST`.
- `AC-AYUDA-06` — Cada uno de los nueve conceptos se explica en su sitio la
  primera vez, una sola vez. Evidencia: `TEST`.
- `AC-AYUDA-07` — Ninguna explicación tapa lo que explica ni roba el foco.
  Evidencia: `TEST`.
- `AC-AYUDA-08` — El mensaje a soporte **nunca incluye montos, descripciones
  ni conversaciones**. Evidencia: `CODE` + `TEST`.
- `AC-AYUDA-09` — El usuario ve exactamente qué se adjunta antes de enviar, y
  puede quitarlo. Evidencia: `TEST` + `USER`.
- `AC-AYUDA-10` — El asistente **no improvisa respuestas sobre el producto**:
  deriva al artículo o admite que no lo hay. Evidencia: `TEST` + `USER`.
- `AC-AYUDA-11` — `/estado` es pública, funciona sin sesión y sin JavaScript, y
  declara cuándo se actualizó. Evidencia: `TEST`.
- `AC-AYUDA-12` — Los nueve artículos existen y ninguno describe una función
  inexistente. Evidencia: `DOC` + `TEST`.
- `AC-AYUDA-13` — La procedencia respeta el modo discreto.
  Evidencia: `TEST`.

`AC-AYUDA-01` es el criterio más transversal del corpus: se comprueba en las
dieciséis pantallas de módulo, en el Inicio, en los reportes y en el
asistente. Y es el que hace exigible el principio de procedencia de `08`, que
sin él sería una declaración de intenciones.

## 14. Fuera de alcance y puente a WhatsApp

**Diferido a V1.1:** buscador dentro de la ayuda, vídeos, ayuda contextual
sugerida por el asistente.

**Prohibido, no diferido:** chat de soporte en vivo, foro, adjuntar datos
financieros a un mensaje de soporte, y que el asistente improvise
descripciones del producto.

Puente a WhatsApp: **la procedencia es lo que peor cruza de canal**, y merece
decirse. En pantalla, "de dónde sale" es un panel con catorce filas
navegables; en un chat no hay panel ni navegación.

`21` §5 ya lo resolvió para el bloque `cifra`: en WhatsApp se responde con la
cifra y *"escribe ver para el detalle"*, y el detalle son tres o cuatro líneas
más un enlace a la aplicación. **La promesa se mantiene —toda cifra se puede
explicar— y la forma cambia por completo.**

Las explicaciones en sitio no cruzan: no hay sitio. Su equivalente es que el
concepto se explique la primera vez que aparece en una respuesta, con la misma
regla de una sola vez.

## 15. Trazabilidad

**Documentos consumidos:** `22` §2 y §3 (la invariante de evidencia y la
procedencia), `08` (el principio), `RUL-ONB-04` (las explicaciones en sitio),
y las §8 de los dieciséis módulos, de donde salen las superficies donde el
patrón tiene que existir.

**Qué aporta al conjunto:** los dieciséis módulos exigen procedencia en sus
cifras, cada uno por su cuenta. Este documento la convierte en **un componente
con un contrato**, de modo que "toda cifra se puede explicar" pase de ser
dieciséis promesas separadas a una sola comprobable (`AC-AYUDA-01`).

**Contradicciones:** ninguna de las 17. Refuerza el cierre de `C-08` —qué se
recuerda y cómo se borra tiene su artículo— y de `C-14` —cómo se elimina la
cuenta también—, que es lo que hace que esos cierres sean encontrables por
alguien que no lee documentación técnica.

**Decisiones tomadas en este documento**, registradas en
`03_decisiones_producto_web.md`:

| Decisión | ID | Alternativa descartada | Razón |
|---|---|---|---|
| La procedencia es un componente, no una promesa por módulo | `no_negociable` `WEB-D138` | Que cada módulo resuelva cómo explicar sus cifras | Con dieciséis implementaciones, "toda cifra se puede explicar" son dieciséis promesas separadas y ninguna comprobable. Con una, es un criterio de aceptación |
| La procedencia declara qué **no** se contó | `no_negociable` `WEB-D139` | Mostrar solo lo incluido | Es la mitad que construye la confianza: quien ve que excluimos las transferencias entiende que sabemos lo que hacemos. Y si hay pendientes sin confirmar, la cifra está incompleta y desde ahí se arregla |
| Nueve artículos, no una base de conocimiento | `aprobada_producto` `WEB-D140` | Documentación extensa del producto | Una base grande es una que nadie mantiene y que documenta funciones que cambiaron. Si una función necesita tres artículos, la función está mal diseñada |
| El asistente no improvisa respuestas sobre el producto | `no_negociable` `WEB-D141` | Dejar que responda con lo que sabe | Un asistente que explica el producto de memoria acaba describiendo el producto que le parece razonable, no el que existe. Prometería funciones inexistentes |
| El contacto de soporte nunca lleva datos financieros, y se ve antes de enviar | `no_negociable` `WEB-D142` | Adjuntar un volcado de diagnóstico completo | El `trace_id` permite encontrar el fallo sin llevar el contenido. Y adjuntar en silencio en un producto de finanzas es exactamente lo que no se puede hacer |
