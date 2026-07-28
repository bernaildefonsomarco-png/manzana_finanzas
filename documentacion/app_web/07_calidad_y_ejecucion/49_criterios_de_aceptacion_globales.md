# 49 — Criterios de aceptación globales

**Bloque:** 07 — Calidad y ejecución
**Alcance:** V1
**Fecha:** 26 de julio de 2026
**Docs fuente:** las §20 de los dieciséis módulos y las secciones de criterios de los otros veintinueve documentos con `AC-`
**Documentos que dependen de este:** `50` (trazabilidad), `51` (pruebas), `54` (plan de implementación), `55` (ledger)

---

## 1. Qué es este documento

Es la **tercera agregación** del corpus, después de `40` (tools y comandos) y
`47` (ciclo de vida del dato). No inventa criterios: recoge los 625 que ya
estaban escritos en 45 documentos y los pone en un solo cuadro.

Y hace lo que las dos agregaciones anteriores demostraron que hay que hacer:
buscar activamente el defecto que **solo existe entre documentos**. Cada
documento fue escrito desde dentro, con su autor mirando su propio alcance. El
coste conocido de ese método son los contratos entre piezas — y esta vez
salieron cuatro cosas, tres de ellas graves.

Además responde a la pregunta que ningún documento del corpus había
respondido todavía y que el plan de implementación necesita antes de existir:

> **¿Qué significa exactamente que algo está hecho?**

Con 625 criterios, "hecho" no puede ser un booleano. 138 de ellos exigen un
usuario real o una serie operativa: si "hecho" significa "todos los criterios
cerrados", nada se declara hecho nunca y el plan de implementación no puede
tener cortes. Si significa "el código compila", entonces la quinta parte del
corpus es decorativa. Este documento define el punto medio y lo hace
verificable.

---

## 2. El inventario

**625 criterios de aceptación, en 45 documentos**, escritos antes de este.
Los seis de `00_gobierno/` no tienen: gobiernan el proceso de escritura, no
el producto.

| Bloque | Documentos | Criterios |
|---|---|---|
| `01_producto/` | 06–11 | 36 |
| `02_fundaciones/` | 12–19 | 79 |
| `03_motor_ia/` | 20, 20b, 20c, 21–23 | 79 |
| `04_modulos/` | 24–39 | 292 |
| `05_asistente/` | 40–42 | 47 |
| `06_transversales/` | 43–48 | 92 |
| **Total agregado aquí** | **45** | **625** |

**Este documento no lleva el total del corpus.** Los documentos del bloque
`07` añaden criterios propios y seguirán añadiéndolos, así que un total
escrito aquí nace desactualizado. El censo vivo —criterios, identificadores,
tokens— vive en `50_matriz_de_trazabilidad_web.md` §3, que es el único
documento `vivo` de este bloque y el único autorizado a publicarlo.

Las 625 son las que se agregaron para buscar defectos entre documentos, y son
las que gobiernan §2.1, §3 y §7. Donde hace falta una cifra del corpus
completo, este documento cita al `50`.

### 2.1 Por documento, con su perfil de portón

Los portones (`G1`, `G2`, `G3`) se definen en §4. La columna `G1` cuenta los
criterios que se cierran con código y pruebas locales; `G2` los que exigen
infraestructura real; `G3` los que exigen un usuario o una serie operativa.

| Doc | Prefijo | Total | G1 | G2 | G3 |
|---|---|---|---|---|---|
| `06` | `AC-TESIS` | 4 | 3 | 0 | 1 |
| `07` | `AC-ALCANCE` | 4 | 4 | 0 | 0 |
| `08` | `AC-EXP` | 6 | 3 | 0 | 3 |
| `09` | `AC-DINERO` | 6 | 4 | 0 | 2 |
| `10` | `AC-NAV` | 8 | 7 | 0 | 1 |
| `11` | `AC-CONFIANZA` | 8 | 6 | 0 | 2 |
| `12` | `AC-ARQ` | 8 | 8 | 0 | 0 |
| `13` | `AC-DATOS` | 15 | 14 | 0 | 1 |
| `14` | `AC-API` | 10 | 10 | 0 | 0 |
| `15` | `AC-SEG` | 8 | 7 | 1 | 0 |
| `16` | `AC-DS` | 10 | 9 | 0 | 1 |
| `17` | `AC-PAT` | 10 | 8 | 0 | 2 |
| `18` | `AC-A11Y` | 10 | 8 | 0 | 2 |
| `19` | `AC-OBS` | 8 | 4 | 3 | 1 |
| `20` | `AC-MOTOR` | 12 | 9 | 0 | 3 |
| `20b` | `AC-SEM` | 16 | 9 | 0 | 7 |
| `20c` | `AC-PERF` | 14 | 5 | 0 | 9 |
| `21` | `AC-CANAL` | 9 | 8 | 0 | 1 |
| `22` | `AC-EVID` | 12 | 9 | 1 | 2 |
| `23` | `AC-RT` | 16 | 8 | 3 | 5 |
| `24` | `AC-CUENTAS` | 18 | 15 | 0 | 3 |
| `25` | `AC-CAT` | 15 | 12 | 0 | 3 |
| `26` | `AC-MOV` | 20 | 15 | 0 | 5 |
| `27` | `AC-PEND` | 16 | 10 | 0 | 6 |
| `28` | `AC-EMAIL` | 18 | 11 | 1 | 6 |
| `29` | `AC-CAP` | 15 | 13 | 0 | 2 |
| `30` | `AC-REC` | 15 | 12 | 0 | 3 |
| `31` | `AC-DEUDAS` | 17 | 12 | 0 | 5 |
| `32` | `AC-PRES` | 17 | 11 | 0 | 6 |
| `33` | `AC-PROY` | 17 | 12 | 0 | 5 |
| `34` | `AC-DESC` | 20 | 15 | 0 | 5 |
| `35` | `AC-REP` | 20 | 14 | 1 | 5 |
| `36` | `AC-MEM` | 24 | 22 | 0 | 2 |
| `37` | `AC-NOTIF` | 20 | 20 | 0 | 0 |
| `38` | `AC-BUS` | 19 | 16 | 0 | 3 |
| `39` | `AC-HOME` | 21 | 14 | 0 | 7 |
| `40` | `AC-CATALOGO` | 10 | 10 | 0 | 0 |
| `41` | `AC-ASI` | 27 | 18 | 0 | 9 |
| `42` | `AC-REU` | 10 | 9 | 0 | 1 |
| `43` | `AC-AUTH` | 19 | 16 | 0 | 3 |
| `44` | `AC-ONB` | 14 | 8 | 0 | 6 |
| `45` | `AC-CONF` | 16 | 14 | 0 | 2 |
| `46` | `AC-MAIL` | 18 | 16 | 1 | 1 |
| `47` | `AC-VIDA` | 12 | 9 | 0 | 3 |
| `48` | `AC-AYUDA` | 13 | 9 | 0 | 4 |
| **Total** | | **625** | **476** | **11** | **138** |

Los criterios de los documentos del bloque `07` no entran en esta tabla: se
agregan en `50` §3, con el resto del censo vivo.

### 2.2 Por nivel de evidencia

Sobre las 625, y con las reasignaciones de §6.2 y §6.3 **aplicadas en los
documentos donde vive cada criterio**, no solo declaradas aquí. Un criterio
puede exigir más de un nivel; la suma de la columna supera 625.

| Nivel | Criterios que lo exigen | Antes de §6.2 y §6.3 |
|---|---|---|
| `DOC` | 8 | 18 |
| `CODE` | 66 | 66 |
| `TEST` | 567 | 557 |
| `SMOKE` | 2 | 2 |
| `LIVE` | 10 | 10 |
| `USER` | 121 | 121 |
| `METRIC` | 18 | 18 |

Los diez que cambian son ocho `DOC` de §6.3 y dos "revisión" de §6.2.

**567 de las 625 exigen una prueba automatizada.** Es la cifra que gobierna el
documento `51`: no es un objetivo de cobertura porcentual, es un inventario
nominal. Cada una tiene nombre y dueño.

---

## 3. Lo que apareció al verlos juntos

### 3.1 Dos módulos ocupaban el mismo espacio de identificadores

El defecto más grave del corpus hasta ahora, y estaba invisible porque ningún
documento lo veía desde dentro.

`30_modulo_recurrentes_y_pagos_que_vienen.md` y
`37_modulo_recordatorios_in_app.md` acortaron su nombre al mismo token, `REC`.
No en una familia de identificadores: en **las cinco**.

| Familia | Doc `30` | Doc `37` | Números duplicados |
|---|---|---|---|
| `SCR-REC-` | 5 | 5 | 5 |
| `ACT-REC-` | 12 | 9 | 9 |
| `RUL-REC-` | 13 | 12 | 12 |
| `ERR-REC-` | 9 | 5 | 5 |
| `AC-REC-` | 15 | 20 | 15 |
| **Total** | | | **46** |

Cuarenta y seis identificadores con dos significados incompatibles cada uno.
`RUL-REC-11` era *"Horizonte de compromisos: 30 días"* en el módulo 30 y *"Un
recordatorio no ejecuta nada"* en el 37. **Once documentos los citaban**, y la
mitad de esas citas eran ambiguas para cualquiera que no supiera de memoria
qué módulo estaba leyendo.

No es un problema estético. La matriz de trazabilidad del documento `50` mapea
`requisito → doc → ruta → endpoint → componente → test`. Una matriz construida
sobre identificadores ambiguos no vale nada: dos filas distintas apuntando al
mismo ID hacen que el primer test que se escriba cierre el criterio
equivocado.

**Corregido.** El módulo 37 pasa a `NOTIF`, que es el nombre de su entidad
real (`in_app_notifications`, migración `062`). El 30 conserva `REC`, porque
es el más citado y el que llegó primero. Las 46 definiciones y las 36 citas
externas están reescritas — el detalle en §14.

**Por qué `NOTIF` y no `AVISO`:** el glosario (`04` §5.7) marca "avisos" como
alternativa *no recomendada* para el término visible, que es "recordatorios".
Un token de identificador que contradice el glosario introduce el mismo tipo
de deriva que `47` §1 encontró con los cuatro nombres del tramo vacío. Los
identificadores nunca se ven, así que se alinean con la tabla, no con la
pantalla.

### 3.2 Y otras tres colisiones más pequeñas

| Prefijo | Documento A | Documento B | IDs ambiguos |
|---|---|---|---|
| `RUL-CAT-` | `25` (categorías) | `40` (catálogo) | 5 |
| `AC-CAT-` | `25` (categorías) | `40` (catálogo) | 10 |
| `AC-CONF-` | `11` (confianza) | `45` (configuración) | 8 |

`RUL-CAT-03` era *"La clasificación automática nunca es definitiva"* en el 25
y *"Cada medida tiene un solo dueño"* en el 40 — y **cuatro módulos citaban la
segunda** creyendo estar citando una regla inequívoca.

**Corregido.** El 40 pasa a `CATALOGO` y el 11 a `CONFIANZA`. En total, con
las de §3.1, **69 identificadores desambiguados**.

### 3.3 La causa: el token se infería, no se asignaba

Las cuatro colisiones tienen el mismo origen. La convención `01` §3 dice que
`<MOD>` es *"el nombre corto del módulo en mayúsculas"*. Inferir un nombre
corto es una operación que dos autores distintos resuelven distinto y que un
mismo autor resuelve distinto en dos días distintos. "Recurrentes" y
"Recordatorios" abrevian igual. "Categorías" y "Catálogo" también.

Prohibir la colisión no sirve: nadie colisiona a propósito, colisiona porque
no ve el otro documento. Es el mismo patrón que el corpus ya aplicó cinco
veces (`WEB-D046`, `WEB-D062`, `WEB-D074`, `WEB-D094`, `WEB-D105`): **hacerlo
imposible en vez de prohibirlo.**

`WEB-D143` — **el token no se infiere, se asigna.** El registro de tokens vive
en `50_matriz_de_trazabilidad_web.md` §2, es la única fuente, y un test sobre
el corpus falla si aparece un identificador cuyo token no está registrado o si
un token aparece definido en dos documentos. Con el registro, la colisión deja
de ser un error que hay que detectar y pasa a ser un estado que no se puede
alcanzar.

### 3.4 Cinco módulos recordaron el criterio de service-role; once lo olvidaron

`AC-CUENTAS-13`, `AC-CAT-15`, `AC-MOV-18` y `AC-CAP-15` dicen exactamente lo
mismo: *"Ninguna ruta de este módulo usa service-role"*. Los otros once
módulos no lo dicen.

La lectura fácil es que faltan once criterios. La correcta es la contraria:
**sobran cuatro.** `AC-SEG-01` ya lo cubre para todo el árbol de rutas, con un
test que **falla la compilación**. Un criterio por módulo es más débil que uno
global, porque su cobertura es exactamente la memoria del autor del módulo —
y aquí la memoria acertó 5 de 16.

`AC-PEND-14` es la excepción legítima: no repite la regla, **declara la
excepción** de su módulo (la creación por trabajador de fondo). Eso sí es
contenido propio.

De aquí sale el concepto de **criterio derivado** (§7): un criterio que hereda
su verificación de uno transversal y no genera prueba propia. No se borra —
la convención `01` §3 prohíbe reutilizar números y borrarlo dejaría huecos
raros en tres módulos— pero se marca, y el documento `51` no escribe cuatro
tests donde uno basta.

### 3.5 El nivel de evidencia se escribió de 25 maneras para 7 niveles

Mismo hallazgo que `40` §9 encontró con las confirmaciones (44 fraseos para 6
niveles) y que `47` §1 encontró con los tramos.

Los 625 criterios declaraban su evidencia con 25 cadenas distintas. Así: Pero al
mirarlas de cerca, la mayor parte de la variación **no es ruido: es
información que no tenía dónde ir.**

```text
Evidencia: `TEST` (E2E)                          ×7
Evidencia: `TEST` (regla de lint)                ×5
Evidencia: `TEST` (falla la compilación)         ×1
Evidencia: `TEST` (presupuesto de bundle)        ×1
Evidencia: `TEST` (cobertura del catálogo)       ×1
Evidencia: `TEST` sobre el contenido publicado   ×1
```

Todos son `TEST`. Lo que el paréntesis dice no es *cuánta* evidencia hace
falta, sino **qué clase de prueba** la produce — y esa es una pregunta
distinta, con respuesta distinta, que el documento `51` necesita y que la
plantilla nunca pidió.

Aparte hay tres casos que sí son un problema: `DOC` + revisión (×2), `TEST` +
revisión (×1) y `DOC` (historial de git) (×1). "Revisión" **no está en el
enum**. Es un octavo nivel de facto, inventado sobre la marcha, que significa
"alguien lo mira" — y lo que significa en la práctica es que nadie lo mira.

La solución en §6: se separan los dos ejes, la clase de prueba pasa a ser un
campo con enum propio, y "revisión" se elimina reasignando los cuatro
criterios a un nivel real.

---

## 4. Los tres portones: qué significa "hecho"

Un criterio no se cierra cuando alguien cree que está; se cierra cuando existe
la evidencia del nivel que él mismo declaró. Y como los niveles se producen en
momentos muy distintos del proyecto, se agrupan en tres portones.

| Portón | Nombre | Niveles que cierra | Cuándo puede cerrarse | Criterios |
|---|---|---|---|---|
| `G1` | **Construido** | `DOC`, `CODE`, `TEST` | En cada corte, en CI | 476 |
| `G2` | **Probado en real** | `SMOKE`, `LIVE` | Contra staging o proveedor real | 11 |
| `G3` | **Validado** | `USER`, `METRIC` | Con usuarios reales y con operación | 138 |

**`WEB-D144` — Un corte del plan de implementación está hecho cuando pasa
`G1` y `G2`, nunca antes, y `G3` no lo bloquea.**

Sin esta separación el plan `54` no puede existir: el corte que construye
presupuestos no puede esperar a que un usuario real use presupuestos durante
un mes, porque hasta que el corte termine no hay presupuestos que usar. Pero
la separación tiene un precio evidente, y es que los 138 criterios de `G3` se
evaporan en cuanto alguien dice "corte cerrado".

**`WEB-D145` — Un criterio de `G3` no se cierra ni se pierde: cambia de
estado y se registra.** Cuando un corte pasa `G1` y `G2`, sus criterios de
`G3` pasan a `verificado, sin validar` en la matriz del documento `50`, con
dueño y fecha de revisión. Un módulo con criterios `G3` abiertos **no se
declara "hecho" en el ledger**: se declara `construido`. La palabra "hecho"
queda reservada para cuando los tres portones están cerrados.

Esto importa más de lo que parece. De los 138 criterios de `G3`, los que más
pesan no son los de rendimiento: son los de tono, carga y comprensión — que
`08`, `20c`, `39`, `41` y `44` declararon precisamente porque son los que
deciden si la app se siente inteligente o se siente un CRUD. Perderlos al
cerrar cortes sería reproducir el error original del producto por la vía
administrativa.

### 4.1 La regla dura, heredada

De `01` §4, sin cambios y sin excepción:

> Un criterio no se marca `Cumple USER` a partir de evidencia `TEST` o
> `SMOKE`. Cada nivel es necesario pero no sustituye al siguiente.

Añadido aquí, porque el corpus ahora tiene portones y los portones invitan a
saltarse escalones:

**`WEB-D146` — Un portón no se cierra parcialmente.** No existe "`G1` al
90 %". Si un criterio de `G1` no pasa, el portón está abierto y el corte no
está construido. La alternativa —dejar pasar un porcentaje— convierte el
inventario de 625 en una estimación, y una estimación no sirve para decidir si
se lanza.

---

## 5. Los estados de un criterio

| Estado | Significa | Quién lo pone |
|---|---|---|
| `pendiente` | Escrito, sin implementación | Por defecto |
| `derivado` | Lo verifica un criterio transversal; no genera prueba propia | Este documento, §7 |
| `implementado` | Hay código; la prueba aún no existe o no pasa | Implementación |
| `verificado` | Su evidencia de `G1`/`G2` existe y pasa | CI |
| `validado` | Su evidencia de `G3` existe y está registrada | Producto |
| `retirado` | Ya no aplica; el número queda muerto | Decisión registrada en `03` |

El estado vive en la matriz del documento `50`, nunca en el documento que
define el criterio — misma razón que llevó a sacar el estado de revisión de
las 60 cabeceras (`01` §5): duplicarlo garantiza que se desincronice.

`retirado` exige una entrada en el decision log. Un criterio que desaparece
sin decisión es un requisito abandonado en silencio, que es exactamente lo que
pasó con `05c` §15 y §20 en el corpus anterior.

---

## 6. La clase de prueba — el eje que faltaba

Un criterio declara ahora **dos campos**, no uno. Sintaxis única en todo el
corpus, sin variantes entre paréntesis ni comas:

```text
- `AC-XXX-NN` — Enunciado verificable. Evidencia: `TEST`. Clase: `unidad`.
- `AC-XXX-NN` — Enunciado verificable. Evidencia: `TEST` + `USER`. Clase: `e2e`.
- `AC-XXX-NN` — Enunciado verificable. Evidencia: `CODE`.
```

`Evidencia:` es obligatoria siempre y sale del enum de 7 de `01` §4.
`Clase:` es obligatoria **si y solo si** el nivel incluye `TEST`, y sale del
enum de §6.1. Un criterio con clase y sin `TEST` es un error de forma, igual
que uno con `TEST` y sin clase.

### 6.1 El enum de clases

| Clase | Qué es | Dónde vive |
|---|---|---|
| `unidad` | Función o regla de negocio aislada | `*.test.ts` junto al código |
| `integracion` | Ruta de API contra base de datos de prueba | `tests/api/` |
| `e2e` | Recorrido de usuario en navegador | `tests/e2e/` (Playwright) |
| `lint` | Regla estática sobre el árbol de código | `eslint` local |
| `build` | Falla la compilación, no solo la suite | Gate de arranque |
| `presupuesto` | Límite numérico sobre un artefacto (bundle, consultas, llamadas) | CI |
| `contenido` | Assert sobre texto publicado (páginas legales) | `tests/contenido/` |
| `corpus` | Assert sobre los documentos de `documentacion/app_web/` | `tests/corpus/` |

De las 625, **567 exigen `TEST` y solo 27 tienen clase decidible sin abrir el
árbol de pruebas**: las diecisiete que ya venían anotadas entre paréntesis y
las diez que §6.2 y §6.3 convierten. El reparto vivo, con los criterios del
bloque `07` incluidos, está en `50` §3.

**Las 540 restantes las asigna el documento `51`**, que es quien define el
árbol de pruebas y sabe qué se puede probar dónde. Este documento fija el enum
y exige que el campo exista.

Este documento **no deja el cambio declarado**: los diez criterios de §6.2 y
§6.3 están reescritos en los documentos donde viven, y los diecisiete que
usaban anotaciones entre paréntesis están normalizados a la sintaxis de
arriba. Declarar una corrección sin aplicarla es la forma más limpia de tener
dos verdades, y es lo que este documento acaba de reprochar en §3.

`AC-MOTOR-10` — *"cualquier cosa que se pueda hacer en la interfaz se puede
pedir hablando"* — venía anotado como "cobertura del catálogo" y es
exactamente un test de corpus: cruza los `ACT-` declarados en las §9 de los
dieciséis módulos contra los 95 comandos de `40` §7. Sigue además exigiendo
`USER`, así que vive en `G3`.

La única de clase `contenido` es `AC-CONF-08`, que verifica la mención de
Limited Use **contra el texto publicado en `/privacidad`**, no contra el que
debería estar. Es el criterio que cierra `C-16`, y su clase es justamente la
diferencia entre cerrarla y volver a abrirla en seis meses.

**Por qué importa separarlo.** `AC-SEG-01` y `AC-CUENTAS-13` dicen casi lo
mismo y ambos son `TEST`, pero uno **falla la compilación** y el otro falla
una suite. Un equipo que no distingue los dos casos escribe los dos igual, y
el que falla la compilación —el único que de verdad impide que el bypass de
RLS vuelva a entrar— acaba siendo un test más que alguien puede marcar como
`skip` un viernes.

### 6.2 Los cuatro criterios con "revisión" — reasignados

| Criterio | Decía | Pasa a |
|---|---|---|
| `AC-DATOS-14` | `TEST` + revisión | `TEST`, clase `unidad` — el assert es que `conversation_summaries` no contiene transcripción; eso se verifica sobre el registro generado, no leyéndolo |
| `AC-SEM-02` | `DOC` + revisión | `TEST`, clase `corpus` — el vocabulario del dominio es una lista cerrada; el test comprueba que no contiene entradas de conocimiento del mundo |
| `AC-SEM-15` | `DOC` + revisión | `TEST`, clase `corpus` — mismo test, sobre el mecanismo de promoción |
| `AC-REU-01` | `DOC` (historial de git) | `DOC` sin clase — es el único legítimo: la evidencia **es** el historial, y comprobarlo es leer las fechas de commit de los documentos `20`–`23` contra la del `42` |

"Revisión" queda eliminada del corpus. Tres de los cuatro casos eran tests que
nadie había visto como tales.

### 6.3 Ocho criterios `DOC` que en realidad son tests

De los 18 criterios en `DOC`, ocho hacen una afirmación sobre el **corpus
mismo** que un script comprueba en segundos:

| Criterio | Afirmación | Cómo se verifica |
|---|---|---|
| `AC-TESIS-01` | Ningún documento define una capacidad por contraste con WhatsApp | Búsqueda de "no debe competir", "no tan rápido como" y variantes |
| `AC-TESIS-02` | Los cuatro trabajos de `06` §2 tienen módulo asignado | Cruce contra la matriz de `07` §3 |
| `AC-TESIS-03` | Las ocho condiciones de verdad tienen documento y criterio propio | Cruce contra el inventario de §2 de este documento |
| `AC-ALCANCE-01` | Las 16 §2 declaran alcance idéntico al de `07` | Comparación de las tablas IN/V1.1/FUERA |
| `AC-ALCANCE-02` | Nada marcado `FUERA` aparece como activo | Búsqueda de cada función `FUERA` en los 60 documentos |
| `AC-ALCANCE-04` | Los cuatro trabajos tienen cobertura por módulos `IN` | Cruce de `06` §2 contra `07` §3 |
| `AC-VIDA-02` | Ninguna §12 usa "pocos"/"muchos" sin declarar el corte | Búsqueda en las 16 §12 |
| `AC-DATOS-07` | Las capacidades de `042`–`046` tienen módulo responsable | Cruce contra las §4 de los módulos |

**`WEB-D147` — Un criterio sobre el corpus se verifica con un test sobre el
corpus.** Pasan a `TEST`, clase `corpus`.

La razón no es purismo. Un criterio `DOC` es verdadero el día que se escribe y
nadie vuelve a mirarlo — y el corpus ya tiene dos casos documentados de
exactamente eso: `C-14` (`/eliminar-datos` decía que el borrado podía no estar
disponible mientras la ruta funcionaba) y `C-16` (Limited Use exigido en la
Fase 5 y ausente de `/privacidad`). Los dos se cerraron con un test que falla
si el documento y la realidad divergen (`45` `RUL-CONF-08`). Aplicar el mismo
remedio aquí es coherente: **lo declarado y lo hecho se versionan juntos, con
test** (`WEB-D122`), y el corpus no es una excepción a su propia regla.

Los diez restantes se quedan en `DOC` porque su evidencia es genuinamente
documental: `AC-ALCANCE-03` (que `13` deje espacio a las funciones `V1.1` es
un juicio sobre el diseño del esquema), `AC-REU-09`, `AC-REU-10` y
`AC-REU-01`, más los seis que combinan `DOC` con otro nivel.

---

## 7. Criterios transversales y criterios derivados

### 7.1 Los 81 que todo módulo hereda sin nombrarlos

| Documento | Qué gobierna | Criterios |
|---|---|---|
| `14` | Envelope, cursor, idempotencia, errores de API | 10 |
| `15` | RLS, service-role, 404 en vez de 403, CSRF | 8 |
| `16` | Tokens, primitivas, foco, teclado | 10 |
| `17` | Fetching, formularios, listados, deshacer | 10 |
| `18` | WCAG AA, PEN, `America/Lima`, español | 10 |
| `19` | `trace_id`, eventos, ausencia de datos sensibles en registros | 8 |
| `47` | Tramos de presentación y de volumen, estados vacíos | 12 |
| `48` | Procedencia, explicabilidad, soporte | 13 |
| **Total** | | **81** |

Un módulo no repite estos criterios. Los cumple porque están, y el documento
`50` los enlaza a cada pantalla en la matriz. Los 292 criterios de módulo son
**adicionales**, no un superconjunto: un módulo con 18 criterios propios tiene
en realidad 99 que aplicar.

**`WEB-D148` — Un módulo no reescribe un criterio transversal.** Si lo
necesita distinto, no lo copia: declara la excepción, con la justificación,
como hace `AC-PEND-14` con service-role. Copiar un criterio transversal a un
módulo crea dos fuentes que divergen, y la divergencia siempre gana.

### 7.2 Los cuatro derivados

| Criterio | Deriva de | Efecto |
|---|---|---|
| `AC-CUENTAS-13` | `AC-SEG-01` | Sin prueba propia |
| `AC-CAT-15` | `AC-SEG-01` | Sin prueba propia |
| `AC-MOV-18` | `AC-SEG-01` | Sin prueba propia |
| `AC-CAP-15` | `AC-SEG-01` | Sin prueba propia |

Se mantienen escritos, con estado `derivado`. Cierran cuando cierra
`AC-SEG-01`. El documento `51` no escribe cuatro tests para ellos, y la matriz
del `50` los muestra apuntando al mismo test.

---

## 8. Cómo se cierra un `USER`

121 criterios lo exigen. Sin un protocolo, "lo probó un usuario" acaba
significando "se lo enseñé a alguien y le pareció bien", que es la forma más
barata de convertir 121 criterios en cero.

**`WEB-D149` — Un `USER` cierra con tres personas, tarea sin ayuda y registro
escrito, incluidas las que fallaron.**

| Requisito | Concreto |
|---|---|
| Cuántos | **Tres personas**, ninguna de ellas quien escribió el documento ni quien implementó |
| Qué hacen | La tarea que el criterio describe, **sin guía verbal** y sin que se les diga dónde está el control |
| Qué se registra | Fecha, qué se pidió, qué hizo cada uno, dónde se atascó, y el veredicto por persona |
| Cuándo cierra | Cuando **las tres** completan la tarea. Dos de tres no cierra: se corrige y se repite |
| Dónde vive | `55_ledger_construccion_web.md`, con el ID del criterio |

Tres es poco para medir preferencias y suficiente para detectar que algo no se
entiende: si tres de tres encuentran el control, el cuarto casi siempre
también; si uno de tres se atasca, hay algo que arreglar. La cifra es
revisable y está registrada como decisión precisamente para poder subirla si
se demuestra corta.

**Lo que un `USER` no puede cerrar.** Un criterio de la forma "no molesta",
"no se siente intrusivo", "el tono no regaña" **no se cierra con tres
personas en una sesión**. La molestia es acumulativa y una sesión no la
produce. Esos criterios exigen `METRIC` y así están declarados en `32` §16
(presupuestos archivados tras superarlos), `34` (descubrimientos marcados
`no_util`) y `41`.

### 8.1 El módulo 37 no tiene ni un solo `USER`, y debería

Los 20 criterios de `37_modulo_recordatorios_in_app.md` son de `G1`. Es el
único módulo del corpus en esa situación, y es precisamente el módulo cuyo
riesgo entero es **cansar a la gente**.

Sus reglas están bien: `RUL-NOTIF-02` (la fatiga gobierna lo que sale),
`RUL-NOTIF-04` (ningún canal que interrumpa viene activado), `RUL-NOTIF-08`
(prioridad cuando compiten). Y todas son verificables con tests, porque están
escritas como límites duros. El problema es que un test demuestra que el
límite se respeta, no que el límite sea el correcto.

`46_notificaciones_y_correo_saliente.md` está casi igual: 18 criterios, uno
solo en `G3`.

**No se añaden criterios aquí.** Este documento agrega, no diseña — y añadir
un criterio nuevo desde fuera del módulo rompe la regla de que cada documento
es dueño de lo suyo. Lo que sí hace es dejarlo registrado como hueco conocido,
con nombre, para que el documento `51` lo cubra desde su lado (§9 de este
documento) y el `54` no cierre el corte de recordatorios creyendo que 20 de 20
verificados significa que el módulo funciona.

---

## 9. Cómo se cierra un `METRIC`

18 criterios lo exigen. Un `METRIC` es el único nivel que **no depende del
equipo**: depende de que haya usuarios usando el producto durante suficiente
tiempo.

**`WEB-D150` — Un `METRIC` cierra con la serie, el objetivo declarado de
antemano y la decisión tomada.** Los tres, no dos.

| Parte | Sin ella |
|---|---|
| La serie | No hay medición, hay una anécdota |
| El objetivo, declarado **antes** de mirar | La medición se interpreta a conveniencia, siempre |
| La decisión tomada | Es un número en un panel, no un criterio cerrado |

El objetivo declarado de antemano es la parte que se salta siempre. Una
métrica sin umbral previo confirma cualquier cosa: `32` §16 declara que
*"presupuestos archivados tras superarlos"* es la señal de que el tono falla,
pero si el umbral se fija después de ver el dato, el tono nunca falla.

Los `METRIC` **no bloquean el lanzamiento**. Bloquean la afirmación de que el
producto funciona, que es distinto y llega después.

---

## 10. Reglas anti-autoengaño

Los criterios solo valen si cerrarlos cuesta más que no cerrarlos. Cinco
reglas, todas nacidas de formas concretas en que este proyecto ya se engañó o
podría hacerlo.

**`RUL-HECHO-01` — Un test marcado `skip` cuenta como `pendiente`.**
La suite en verde con tests desactivados es peor que la suite en rojo, porque
comunica lo contrario de lo que pasa. El informe de CI lista los `skip` con
el ID del criterio que dejan abierto.

**`RUL-HECHO-02` — Un test que pasaría sin la funcionalidad no verifica nada.**
Antes de dar por cerrado un criterio, se revierte el cambio que lo implementa
y se comprueba que el test **falla**. Un test que pasa con y sin la función
mide la existencia del archivo, no el comportamiento.

**`RUL-HECHO-03` — La evidencia se declara con nivel y clase, y las dos son
obligatorias.**
Un criterio sin clase de prueba no entra en la matriz del `50`, y lo que no
entra en la matriz no se implementa. Es el mismo mecanismo que `40` §2 usa
para el catálogo: la desincronización falla el build en vez de acumularse.

**`RUL-HECHO-04` — Un criterio no se reescribe para que pase.**
Si al implementarlo se descubre que estaba mal planteado, se cambia — pero el
cambio va al decision log con el motivo, y el criterio anterior queda
`retirado`, no editado en silencio. Editar el criterio hasta que el código lo
cumpla es la forma más limpia de tener todos los criterios cumplidos y un producto
que no funciona.

**`RUL-HECHO-05` — El corte no se declara cerrado por quien lo implementó.**
`G1` lo cierra CI, que no tiene opinión. `G2` y `G3` los cierra quien produce
la evidencia, y esa persona no es la que escribió el código.

### 10.1 Ejemplo completo: cerrar `AC-CUENTAS-01`

El criterio dice: *"El ejemplo de §6 produce exactamente S/800.00 / S/580.00 /
S/220.00 / S/170.00. Evidencia: `TEST`."*

```text
1. Clase asignada:        unidad
2. Test escrito:          calcula las cuatro capas con el fixture de 24 §6
3. RUL-CUENTAS-02:        se cambia la fórmula de dinero libre a la anterior
                          (con la resta duplicada de compromisos) → el test
                          debe fallar. Si pasa, el test no mide la fórmula.
4. Estado:                verificado
5. Portón:                G1
6. Matriz (doc 50):       AC-CUENTAS-01 → 24 §6 → RUL-CUENTAS-05
                          → /api/v1/money/summary → tests/core/free-money.test.ts
```

Cinco pasos, ninguno opcional. El paso 3 es el que separa un criterio cerrado
de un criterio marcado.

---

## 11. Qué falta para que el corpus sea implementable

El inventario deja tres huecos nominales, que este documento **no llena** —
los nombra para que los llenen sus dueños:

| Hueco | Dónde se resuelve |
|---|---|
| Los 540 criterios `TEST` sin clase asignada | `51_estrategia_de_pruebas_web.md` |
| Los 138 criterios de `G3` no tienen dueño ni fecha | `50_matriz_de_trazabilidad_web.md` |
| Los módulos `37` y `46` no tienen criterios de `G3` pese a ser los de mayor riesgo de fatiga | `51`, desde el lado de la estrategia de validación |

---

## 12. Criterios de aceptación de este documento

- `AC-HECHO-01` — Ningún identificador del corpus (`SCR-`, `ACT-`, `RUL-`,
  `ERR-`, `AC-`) está definido en más de un documento. Evidencia: `TEST`.
  Clase: `corpus`.
- `AC-HECHO-02` — Todo token de identificador usado en el corpus está en el
  registro de `50` §2. Evidencia: `TEST`. Clase: `corpus`.
- `AC-HECHO-03` — Todo criterio del corpus declara nivel de evidencia y, si incluye
  `TEST`, clase de prueba. Evidencia: `TEST`. Clase: `corpus`.
- `AC-HECHO-04` — Ningún criterio declara "revisión" como evidencia.
  Evidencia: `TEST`. Clase: `corpus`.
- `AC-HECHO-05` — Todo criterio del corpus aparece en la matriz de `50` con
  estado. Evidencia: `TEST`. Clase: `corpus`.
- `AC-HECHO-06` — Ningún corte del plan `54` se declara cerrado con un
  criterio de `G1` en estado distinto de `verificado` o `derivado`.
  Evidencia: `TEST`. Clase: `build`.
- `AC-HECHO-07` — Los criterios de `G3` de un corte cerrado figuran con dueño
  y fecha, no como cerrados. Evidencia: `TEST`. Clase: `corpus`.
- `AC-HECHO-08` — La suite reporta los tests `skip` con el ID del criterio que
  dejan abierto. Evidencia: `CODE` + `TEST`.
- `AC-HECHO-09` — Ningún módulo reescribe un criterio transversal sin
  declararlo como excepción justificada. Evidencia: `TEST`. Clase: `corpus`.
- `AC-HECHO-10` — Un criterio `retirado` tiene entrada en
  `03_decisiones_producto_web.md`. Evidencia: `TEST`. Clase: `corpus`.
- `AC-HECHO-11` — Los cuatro criterios derivados de §7.2 apuntan al mismo test
  que `AC-SEG-01` en la matriz. Evidencia: `TEST`. Clase: `corpus`.
- `AC-HECHO-12` — Un `USER` cerrado tiene registro de tres personas en el
  ledger `55`, incluidas las que no completaron la tarea. Evidencia: `DOC`.

---

## 13. Fuera de alcance y puente a WhatsApp

Este documento **no** asigna clases de prueba una por una (es del `51`), no
define los cortes (es del `54`), y no lleva el estado de cada criterio (es del
`50`).

Para la fase de WhatsApp: los tres portones, los estados, el enum de clases y
las cinco reglas anti-autoengaño son **agnósticos de canal** y se heredan tal
cual. Lo que cambia es el inventario: los criterios de `SCR-` no aplican a un
canal sin pantallas, y aparecen los del presentador de WhatsApp. La prueba de
agnosticismo de `21` es la que garantiza que esa sustitución sea posible sin
tocar el motor.

---

## 14. Correcciones aplicadas a otros documentos

Ejecutadas en este mismo paso, no pendientes.

### 14.1 Renombrados de identificador

| Documento | Cambio | Alcance |
|---|---|---|
| `37_modulo_recordatorios_in_app.md` | `SCR/ACT/RUL/ERR/AC-REC-` → `-NOTIF-` | 46 definiciones, 82 apariciones |
| `40_catalogo_de_tools_y_comandos.md` | `RUL-CAT-01..05` → `RUL-CATALOGO-01..05` y `AC-CAT-` → `AC-CATALOGO-` | 15 definiciones, 22 apariciones |
| `11_confianza_errores_y_reversibilidad.md` | `AC-CONF-` → `AC-CONFIANZA-` | 8 definiciones, 8 apariciones |

`40` conserva una cita a `RUL-CAT-11`, que sí es del módulo 25 ("Categorías
por tipo de movimiento"). No se toca.

### 14.2 Citas externas reescritas

51 citas en 14 documentos: 50 renombradas y una corregida por otro motivo
(§14.3). `AC-CONFIANZA` no aparece porque nadie fuera del documento 11 citaba
esos ocho criterios — lo cual es, por sí solo, una señal de que el bloque de
producto se lee poco desde los módulos.

| Documento | → `37` | → `40` | Dónde |
|---|---|---|---|
| `03_decisiones_producto_web.md` | 14 | 8 | `WEB-D066`–`D073`, `WEB-D090`–`D094` |
| `05_contradicciones_heredadas_cierre.md` | 4 | 3 | `C-17`, `C-03` |
| `13_modelo_datos_web_v1.md` | 1 | — | §9 |
| `24_modulo_cuentas_y_cajas.md` | — | 1 | §14 medidas |
| `28_modulo_email_y_deteccion_bancaria.md` | — | 1 | §14 medidas |
| `33_modulo_proyecciones_y_simulacion.md` | — | 1 | §14 medidas |
| `35_modulo_reportes_graficos_y_exportacion.md` | — | 1 | §14 medidas |
| `38_modulo_busqueda_y_navegacion_rapida.md` | 1 | — | §6 |
| `39_modulo_home_resumen_financiero.md` | 3 | — | §4, §6, §19 |
| `40_catalogo_de_tools_y_comandos.md` | 1 | — | §5 dimensiones |
| `44_onboarding_web.md` | 1 | — | §6 |
| `45_configuracion_privacidad_y_control_de_datos.md` | 4 | — | §5, §15, §17 |
| `46_notificaciones_y_correo_saliente.md` | 6 | — | §1, §5, §18 |
| `47_ciclo_de_vida_del_dato_y_estados_vacios.md` | 1 | — | §4 — ver §14.3 |

Las tres citas de `31_modulo_deudas.md` (`RUL-REC-09`, `RUL-REC-10`) **no se
tocan**: apuntan al módulo 30, que conserva el token.

### 14.3 Una cita que estaba mal en cualquiera de las dos lecturas

`47_ciclo_de_vida_del_dato_y_estados_vacios.md` §4 citaba `RUL-REC-09` como la
regla de caducidad de los recordatorios. En el módulo 30 esa regla es
*"Vinculación con deudas"*; en el 37, *"El badge cuenta lo abierto y sin
leer"*. Ninguna habla de caducidad.

La caducidad de un recordatorio vive en `37` §5 (estado `caducado`) y §7
(`expires_at`, máximo 30 días), que no tienen `RUL-` propio. La cita se
reescribe apuntando a las secciones.

Es un buen ejemplo de por qué la colisión importaba: la cita era ambigua **y**
falsa, y ninguna de las dos cosas se veía leyendo el documento 47 solo.

---

## 15. Trazabilidad

| Elemento | Origen |
|---|---|
| Niveles de evidencia, enum de 7 | `01_convenciones_y_plantillas.md` §4, heredado de `docs/fase_4_tecnica/matriz_cumplimiento_integral_v1_2026-07-24.md` §2.2 |
| Sistema de identificadores | `01_convenciones_y_plantillas.md` §3 |
| La §20 obligatoria de cada módulo | `01_convenciones_y_plantillas.md` §8 |
| Los 625 criterios | Las secciones de criterios de los 45 documentos |
| Método de agregación | `40_catalogo_de_tools_y_comandos.md` §2, `47_ciclo_de_vida_del_dato_y_estados_vacios.md` §1 |
| Patrón "imposible en vez de prohibido" | `WEB-D046`, `WEB-D062`, `WEB-D074`, `WEB-D094`, `WEB-D105` |
| Lo declarado y lo hecho se versionan juntos | `WEB-D122`, `45` `RUL-CONF-08` |
| Decisiones nuevas | `WEB-D143` a `WEB-D150` |

| Documento que depende de este | Qué toma |
|---|---|
| `50_matriz_de_trazabilidad_web.md` | El registro de tokens, el inventario de 625, los estados |
| `51_estrategia_de_pruebas_web.md` | Los 567 `TEST` —540 sin clase—, el enum, los huecos de §11 |
| `54_plan_de_implementacion_web.md` | Los tres portones y la definición de corte cerrado |
| `55_ledger_construccion_web.md` | El registro de `USER` y `METRIC` |
