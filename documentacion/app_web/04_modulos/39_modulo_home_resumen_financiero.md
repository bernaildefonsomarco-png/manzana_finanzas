# 39 — Módulo: Inicio y resumen financiero

**ID de módulo:** `MOD-HOME`
**Bloque:** 04 — Módulos
**Alcance:** V1 (reescritura)
**Fecha:** 26 de julio de 2026
**Docs fuente:** `docs/fase_2_estrategia/alcance_v1/05c_dashboard.md` y `docs/fase_3_producto/17_dashboard_ux.md`, fusionados y con su tesis invertida — ver §22
**Documentos que dependen de este:** `44` (onboarding), `47` (ciclo de vida del dato), `54` (plan de implementación)

---

## 1. Tesis y qué NO es

Este documento invierte la frase que causó el problema del producto entero.
`05c` §1 decía:

> El Dashboard de Manzana no debe competir con WhatsApp como canal principal
> de registro. Debe ser el lugar donde el usuario revisa, entiende, corrige y
> toma control.

**Revisar, entender, corregir.** Tres verbos de segunda línea, ninguno de
primera. Con esa tesis escrita en la cabecera, todo lo demás siguió: la IA no
podía escribir desde la app (§15), y presupuestos, proyecciones, reportes y
exportaciones quedaron fuera de V1 (§20). No fue un accidente de
implementación. Estaba en el documento.

La tesis nueva:

> **El Inicio es el producto entero en una pantalla.** No hay otro canal. Aquí
> se registra, se entiende, se decide y se actúa.

Y de ahí sale lo que este módulo tiene que resolver, que no es qué mostrar
—eso lo aportan los quince módulos anteriores— sino **en qué orden y hasta
dónde**. Una pantalla que lo enseña todo no ayuda a decidir nada; una que
enseña poco obliga a buscar. La respuesta está en `RUL-HOME-03`: el Inicio
muestra **lo que tiene consecuencias**, en un orden declarado, y nada más.

Las ocho preguntas que `05c` §1 quería responder siguen siendo las correctas,
y ahora sí se pueden responder todas:

```text
¿Cómo estoy?                    → dinero libre, y de qué se compone
¿Qué cambió?                    → descubrimiento destacado
¿Qué tengo pendiente?           → pendientes y recordatorios
¿Cuánto puedo gastar realmente? → dinero libre y proyección de cierre
¿Qué debo revisar?              → siguiente cosa que hacer
¿De dónde salió este dato?      → evidencia en todas las cifras
¿Puedo corregirlo?              → sí, desde aquí
¿Qué sabe Manzana de mi dinero? → memoria, alcanzable en un clic
```

Las tres que `05c` no podía responder de verdad —cuánto puedo gastar, qué debo
revisar, qué sabe de mí— son exactamente las que necesitaban los módulos que
su §20 dejaba fuera.

**Qué NO es:**

- **No es un panel de control.** No hay rejilla de widgets, ni métricas
  configurables, ni gráficos. Los gráficos viven en Reportes (`35`), donde
  cada uno tiene su decisión asociada.
- **No es un resumen del pasado.** Mira hacia adelante: qué viene, qué falta,
  qué se puede decidir hoy. Lo comparativo está en Reportes.
- **No tiene aritmética propia.** Igual que `RUL-REP-01`: cada cifra la calcula
  su módulo. El Inicio compone, no calcula.
- **No es una bandeja.** Muestra lo más consecuente; la lista completa de
  recordatorios está en `37`.

## 2. Alcance

| Nivel | Funcionalidad |
|---|---|
| **IN** | Dinero libre como cifra principal, con su composición. Siguiente cosa que hacer, priorizada. Pendientes destacados. Compromisos próximos. Descubrimiento destacado. Avance de presupuestos. Movimientos recientes. Registro rápido siempre alcanzable. Asistente presente. Estados progresivos: vacío, temprano, funcional, completo. Adaptación al uso real. Degradación por bloques. |
| **V1.1** | Orden de las secciones elegido por el usuario. Widgets configurables. Saludo con resumen narrativo. |
| **FUERA** | Panel de administración. Comparativa entre periodos como pantalla principal (vive en Reportes). Gráficos. Métricas de uso del producto. |

## 3. Vocabulario

| Interno | Visible |
|---|---|
| `home`, `dashboard` | Inicio |
| `next_best_action` | Lo siguiente · "Esto te espera" |
| `block`, `widget`, `slot` | — (**nunca visibles**) |
| `free_money` | Dinero libre |
| Estado progresivo | — |

Prohibido frente al usuario: `dashboard`, `panel`, `widget`, `métrica`, `KPI`,
`resumen ejecutivo`, además de la lista general de
`04_glosario_y_lenguaje_visible.md` §10.

El Inicio habla **del dinero del usuario, no de sí mismo**:

```text
Correcto:   Tienes S/560 libres.
Correcto:   Te faltan 6 movimientos por confirmar.
Incorrecto: Tu resumen financiero de hoy
Incorrecto: Panel de control · Actualizado hace 2 minutos
```

## 4. Entidades y datos

### 4.1 No tiene entidades propias

El Inicio **no crea ni guarda nada**. Es una composición de lo que ya existe:

| Bloque | De dónde sale |
|---|---|
| Dinero libre y su composición | `24` (`RUL-CUENTAS-03`) |
| Proyección de cierre | `33` (`RUL-PROY-02`) |
| Lo siguiente que hacer | `27`, `30`, `31`, `37` |
| Pendientes | `27` |
| Compromisos próximos | `30`, `31` |
| Descubrimiento destacado | `34` (`SCR-DESC-03`) |
| Avance de presupuestos | `32` (`SCR-PRES-05`) |
| Movimientos recientes | `26` |
| Resumen del periodo | `35` (`SCR-REP-05`) |
| Recordatorios | `37` (`SCR-NOTIF-05`) |
| Asistente | `41` |

Que no tenga datos propios es lo que hace exigible `RUL-HOME-02`: **el Inicio
no puede discrepar de ninguna otra pantalla**, porque no tiene de dónde sacar
un número distinto.

### 4.2 Preferencias de composición

Lo único que se persiste son preferencias, y viven en `learned_preferences`
(migración `061`, módulo 36):

| Clave | Qué guarda |
|---|---|
| `home.bloques_ocultos` | Bloques que el usuario cerró |
| `home.uso_detectado` | Perfil de uso para `RUL-HOME-06` |

Son **preferencias** en el sentido de `RUL-MEM-01`: se observan, se aplican y
no se confirman. Y siguen `WEB-D064`: si el usuario ocultó un bloque a mano,
ninguna observación lo devuelve.

**Sin migración nueva.** Es el único módulo del corpus que no la necesita.

## 5. Máquina de estados

Los cuatro estados progresivos, heredados de `05c` §12 con sus umbrales
recalibrados según `WEB-D042` y `WEB-D043`:

```text
   vacío ──► temprano ──► funcional ──► completo
     0        1-10          11-50         50+
```

| Estado | Qué muestra | Qué NO muestra |
|---|---|---|
| **Vacío** | Registrar, conectar el correo, crear la primera cuenta, y qué es el dinero libre | Gráficos vacíos, `S/0.00` como si fuera un dato, secciones sin contenido |
| **Temprano** | Movimientos recientes, total simple del periodo, de dónde salen los datos, qué va aprendiendo | Comparativas, patrones débiles presentados como certeza |
| **Funcional** | Dinero libre si hay cuentas, pendientes, presupuestos, primeros descubrimientos | Tendencias largas |
| **Completo** | Todo lo aplicable, con proyección de cierre y compromisos | Lo que su uso no incluya (`RUL-HOME-06`) |

**Los umbrales son de presentación, no de capacidad.** Un usuario en estado
`temprano` que registró una deuda ve sus compromisos desde el primer día,
porque la clase A de `RUL-DESC-01` no depende del volumen. Lo que gradúa el
estado es cuánta interpretación del historial cabe, no qué funciones existen.

Esa distinción es la que `05c` no hacía, y por eso su estado `vacío` decía
"registra por WhatsApp" y su estado `funcional` empezaba a los 11 movimientos.

## 6. Reglas de negocio

**`RUL-HOME-01` — El dinero libre es la cifra principal, y se explica**

Una sola cifra grande, y debajo de qué se compone. Nunca sola.

```text
Tienes libres
    S/560.00

De S/1,140 en tus cuentas: S/500 están apartados
en cajas y S/89 son compromisos sin apartar.
[Ver el desglose]
```

Reglas duras:

- **Si no se puede calcular, no se muestra `S/0.00`.** Se dice qué falta:
  "para calcularlo necesito al menos el saldo de una cuenta". Mostrar cero
  cuando no se sabe es afirmar algo falso sobre el dinero de alguien
  (`18` §9.1).
- Se distingue siempre de **dinero total**. Son dos números distintos y
  confundirlos es el error más caro de esta pantalla.
- La composición está **debajo de la cifra, no tras un icono**.
- La cifra lleva sus referencias de evidencia (`22` §2).

**`RUL-HOME-02` — El Inicio no tiene aritmética propia**

Cada cifra la calcula su módulo, con su función. El Inicio compone.

Consecuencia verificable: **el dinero libre del Inicio, el de Mi Dinero y el
que responde el asistente son el mismo número, siempre**, porque salen de la
misma llamada. Si difieren, es un defecto de este módulo.

Es la misma regla que `RUL-REP-01` para los reportes, y por el mismo motivo:
esta pantalla es la que más gente mira y la primera que se abre. Una
discrepancia aquí contamina la credibilidad de todo lo demás.

**`RUL-HOME-03` — Se muestra lo que tiene consecuencias, en orden declarado**

El orden no es un score aprendido ni una relevancia calculada: es una **lista
de precedencia declarada**, y por tanto explicable y probable.

```text
1. Algo roto que el usuario no sabe        (correo desconectado)
2. Algo vencido                            (pago, cuota)
3. Algo que vence en 3 días
4. Algo que espera confirmación            (pendientes, hecho de perfil)
5. Un presupuesto en su límite
6. Un descubrimiento nuevo
7. Estado y contexto                       (dinero libre, presupuestos, recientes)
```

De 1 a 5 es **lo que tiene consecuencias si se ignora**. 6 es información
nueva. 7 es el contexto permanente, que siempre está.

Un score aprendido habría sido más flexible y no se habría podido explicar ni
probar. Con una lista declarada, "¿por qué me muestra esto primero?" tiene
respuesta, y `AC-HOME-05` la verifica.

**`RUL-HOME-04` — Una sola "siguiente cosa que hacer", y solo si la hay**

De la lista de `RUL-HOME-03`, **el primer elemento de los niveles 1 a 4 se
destaca**, con su acción. Uno. No tres, no una lista.

```text
Lo siguiente
  Tu cuota de la laptop (S/180) venció el 15 y no la veo registrada.
  [Registrar el pago]   [Ya la pagué]        [Ahora no]
```

Reglas que impiden que esto se convierta en un regaño:

- **Si no hay nada de los niveles 1 a 4, el bloque no aparece.** No se rellena
  con "revisa tus gastos" ni con "registra algo hoy".
- Nunca es una acción de uso del producto. No existe "vuelve mañana", "usa más
  la app" ni "completa tu perfil".
- "Ahora no" la oculta **hasta que cambie el estado del mundo**, no durante un
  rato. Si el usuario dice ahora no a una cuota vencida, no reaparece hasta que
  algo cambie.
- Nunca ejecuta: navega con lo que haga falta precargado (`RUL-HOME-08`).

La segunda es la que separa esto de una pantalla de crecimiento. Una "siguiente
mejor acción" que sirve al producto en vez de al usuario se detecta al tercer
día y se ignora para siempre, arrastrando consigo las que sí importaban.

**`RUL-HOME-05` — Un bloque vacío no se muestra**

Sin excepción, y sin marcador de posición.

```text
Correcto:   (el bloque de deudas simplemente no está)
Incorrecto: Deudas
            No tienes deudas registradas.
            [Registrar una deuda]
```

La versión incorrecta ocupa espacio para decir que no hay nada, y a la vez
sugiere que debería haberlo. Un usuario sin deudas no tiene un hueco en su
vida financiera.

Excepción única: en estado `vacío`, donde **todo** está vacío, la pantalla es
un onboarding (`44`) y no un Inicio con huecos.

**`RUL-HOME-06` — El Inicio se adapta al uso real**

Heredado de `05c` §13, que era bueno, con sus fuentes actualizadas:

| Uso detectado | Se prioriza | No aparece |
|---|---|---|
| Solo registra gastos | Movimientos, presupuestos, resumen del periodo | Deudas, cajas |
| Solo deudas | Deudas, cuotas próximas, progreso | Categorías de gasto |
| Solo compromisos | Pagos que vienen, calendario | Análisis de categorías |
| Gastos y cajas | Dinero libre, cajas, movimientos | Deudas |
| Correo conectado | Pendientes, procedencia | Bloques vacíos |
| Uso maduro | Descubrimientos, proyección, memoria | Ayuda de primeros pasos |

La detección es **por existencia de datos, no por inferencia**: si no hay
ninguna deuda, no hay bloque de deudas. No hace falta un motor para eso, y
tratarlo como un problema de aprendizaje sería complicar lo que se resuelve
contando filas.

**`RUL-HOME-07` — Registrar está siempre a un clic**

Es la inversión literal de `05c`. Su estado vacío ofrecía *"Abrir WhatsApp"*
como acción principal; aquí la acción principal es **registrar un movimiento**,
en todos los estados y en todos los tamaños de pantalla.

- En escritorio, botón visible en la cabecera del Inicio.
- En móvil, botón flotante que no tapa contenido al desplazarse.
- Desde el teclado, la paleta de comandos (`38`).
- Desde la conversación, escribiéndolo.

Cuatro vías, y ninguna es un canal externo.

**`RUL-HOME-08` — El Inicio no ejecuta operaciones de dinero**

Todos sus bloques navegan o abren un formulario. Ninguno registra, confirma ni
paga.

Es la cuarta vez que aparece esta frontera —`WEB-D038` en proyecciones,
`WEB-D047` en descubrimientos, `RUL-NOTIF-11` en recordatorios, `RUL-BUS-08` en
la paleta— y aquí cierra el conjunto: **ninguna superficie que el usuario no
pidió abrir puede cambiar su dinero.** El Inicio se abre solo, al entrar.

La excepción es el asistente, que sí escribe **y siempre con confirmación
explícita** (`WEB-D013`). La diferencia es que ahí el usuario pidió algo.

**`RUL-HOME-09` — Cada bloque falla solo**

Si el módulo que alimenta un bloque no responde, **ese bloque muestra su
error y el resto de la pantalla funciona**. Nunca una pantalla en blanco.

| Fallo | Comportamiento |
|---|---|
| Un bloque no responde | Ese bloque dice que no pudo cargar, con reintentar. Los demás, normales |
| Sin conexión | Últimos datos conocidos, con su antigüedad: "hace 2 horas" |
| Asistente caído | El resto del Inicio funciona igual; el asistente dice que no está |
| Consulta lenta | El bloque muestra esqueleto; no bloquea la pantalla |

Heredado de `05c` §12.5, cuya regla general se conserva literal:

> Nunca mostrar un estado de error vacío sin guía. Si algo falla, explicar qué
> pasó, qué puede hacer el usuario, y qué datos siguen siendo válidos.

En una pantalla compuesta de nueve fuentes, la alternativa —que un fallo tumbe
todo— haría que la disponibilidad del Inicio fuera el producto de las
disponibilidades de nueve módulos.

**`RUL-HOME-10` — Modo discreto**

- Los montos se ocultan; **la estructura y las proporciones se quedan**, igual
  que en `RUL-REP-14` y en `32` §12.
- El dinero libre se muestra como `S/•••`, no desaparece: saber que hay una
  cifra ahí es parte de la orientación.
- Los bloques sensibles (`RUL-DESC-13`) **no aparecen en el Inicio** ni con el
  modo desactivado.
- Se activa y desactiva desde el propio Inicio, en un control alcanzable sin
  entrar en configuración: se usa cuando alguien se acerca, y para entonces ya
  es tarde para navegar tres pantallas.

**`RUL-HOME-11` — Ningún saludo que finja una relación**

```text
Correcto:   (ningún saludo; se entra directo al dinero)
Correcto:   Julio, hasta hoy
Incorrecto: ¡Buenos días, Marco! ☀️ ¿Listo para tomar el control?
Incorrecto: ¡Vas genial este mes! 🎉
```

Un saludo entusiasta cada vez que alguien abre su aplicación de finanzas
envejece en dos días y ocupa el espacio de la cifra que venía a ver. El
resumen narrativo con nombre es **V1.1**, y si llega será medido.

## 7. Validaciones

No aplica en el sentido habitual: el Inicio no tiene formularios ni entrada de
datos propia. Toda validación ocurre en el módulo de destino de cada acción.

Lo que sí se valida es la **composición**:

| Regla | Comprobación |
|---|---|
| Número de bloques visibles | Máximo 8; si hay más candidatos, se recorta por precedencia |
| Bloques vacíos | No se renderizan (`RUL-HOME-05`) |
| Dinero libre sin datos | No se muestra como `S/0.00` (`RUL-HOME-01`) |
| Bloques ocultos por el usuario | Se respetan sobre cualquier observación (`WEB-D064`) |
| Siguiente cosa que hacer | Como máximo una, y solo de los niveles 1 a 4 |

## 8. Superficies

**Referencia visual: existe y se reinterpreta.** El Inicio está descrito en
`docs/fase_6_visual/32_especificacion_hifi.md` (Inicio) y en
`docs/fase_6_visual/30_app_flow.md` §4.1, con sus estados. La composición y la
jerarquía cambian según §22; los tokens, la tipografía de la cifra grande y
las tarjetas se conservan de `16_design_system_web.md`.

### `SCR-HOME-01` — Inicio

**Ruta:** `/`

```text
┌──────────────────────────────────────────────────┐
│ Manzana        [Buscar ⌘K]  [👁]  [+ Registrar]  │
├──────────────────────────────────────────────────┤
│ Tienes libres                                    │
│      S/560.00                                    │
│ De S/1,140 en tus cuentas: S/500 apartados en    │
│ cajas y S/89 de compromisos sin apartar.         │
│ [Ver el desglose]                                │
├──────────────────────────────────────────────────┤
│ LO SIGUIENTE                                     │
│ Tu cuota de la laptop (S/180) venció el 15 y no  │
│ la veo registrada.                               │
│ [Registrar el pago] [Ya la pagué] [Ahora no]     │
├──────────────────────────────────────────────────┤
│ 6 movimientos del banco sin confirmar            │
│ [Revisarlos]                                     │
├──────────────────────────────────────────────────┤
│ ESTE MES                                         │
│ Alimentación  S/318 de S/400  ▓▓▓▓▓▓▓░  80%      │
│ Transporte    S/230 de S/200  ▓▓▓▓▓▓▓▓  +S/30    │
│ A este ritmo cerrarías julio con unos S/250.     │
├──────────────────────────────────────────────────┤
│ TE VIENEN                                        │
│ 28 jul  Internet          S/89   sin apartar     │
│  1 ago  Alquiler          S/850  apartado        │
├──────────────────────────────────────────────────┤
│ ALGO QUE NOTÉ                                    │
│ Este mes, 4 de cada 10 soles que gastaste fueron │
│ en comida. Son S/318 en 14 compras.              │
│ [Ver las 14]  [Ponerle presupuesto]              │
├──────────────────────────────────────────────────┤
│ ÚLTIMOS MOVIMIENTOS                              │
│ 26 jul  Rappi        S/32.00   Alimentación      │
│ 25 jul  Taxi         S/18.00   Transporte        │
│ 24 jul  Sueldo    +S/2,400.00  Ingreso           │
│                              [Ver todos]         │
├──────────────────────────────────────────────────┤
│                                      [💬 Manzana]│
└──────────────────────────────────────────────────┘
```

Detalles que importan:

- **Se entra directo a la cifra.** Sin saludo, sin fecha grande, sin
  bienvenida (`RUL-HOME-11`).
- El ojo de la cabecera es el modo discreto, a un clic (`RUL-HOME-10`).
- "Registrar" está arriba a la derecha y es la acción de mayor peso visual de
  la pantalla. Es la inversión de `05c` hecha píxeles.
- "Lo siguiente" solo aparece porque hay algo. Sin cuota vencida ni pendientes,
  ese bloque no existe.
- "Este mes" mezcla presupuestos y proyección **en un bloque**, porque son la
  misma pregunta: cómo va el mes.
- El asistente es persistente y no modal: acompaña, no interrumpe.
- **Ningún gráfico.** El de barras de los presupuestos es una barra de
  progreso, no un gráfico: no tiene ejes ni series.

### `SCR-HOME-02` — Inicio en estado vacío

Cuenta nueva, cero movimientos. **No es esta pantalla con huecos**: es el
onboarding del módulo 44.

```text
┌──────────────────────────────────────────────────┐
│ Empecemos por lo tuyo.                           │
│                                                  │
│ [Registrar mi primer movimiento]                 │
│                                                  │
│ O si prefieres que llegue solo:                  │
│ [Conectar mi correo]                             │
│                                                  │
│ ¿Cuánto tienes ahora?                            │
│ [Agregar una cuenta]                             │
│                                                  │
│ Cuando tenga tus cuentas te diré cuánto tienes   │
│ libre de verdad: lo que queda después de lo que  │
│ ya está comprometido.                            │
└──────────────────────────────────────────────────┘
```

- **Tres puertas, ninguna obligatoria**, y ninguna es un canal externo.
- El último párrafo explica el dinero libre **antes** de poder mostrarlo, para
  que cuando aparezca signifique algo.
- Sin `S/0.00`, sin gráficos vacíos, sin barra de progreso de configuración.

### `SCR-HOME-03` — Desglose del dinero libre

Panel. Es `24` `SCR-CUENTAS-xx` abierto desde aquí, no una pantalla propia de
este módulo: la aritmética y su navegación pertenecen a Cuentas y cajas.

### `SCR-HOME-04` — Inicio en móvil

Mismo contenido, mismo orden, una columna. El botón de registrar es flotante y
**se retrae al desplazarse hacia abajo**, reapareciendo al subir.

El asistente pasa a ser un botón que abre una hoja inferior, no una columna
lateral.

## 9. Acciones

| ID | Acción | ¿Confirma? | Deshacer | Evento |
|---|---|---|---|---|
| `ACT-HOME-01` | Abrir el Inicio | No | — | `inicio.visto` |
| `ACT-HOME-02` | Registrar un movimiento | Por el módulo 26 | Ídem | `movimiento.creado` |
| `ACT-HOME-03` | Ver el desglose del dinero libre | No | — | `inicio.desglose_visto` |
| `ACT-HOME-04` | Actuar sobre "lo siguiente" | Por el módulo destino | Ídem | `inicio.siguiente_tomada` |
| `ACT-HOME-05` | Posponer "lo siguiente" | No | Reapareciendo al cambiar el estado | `inicio.siguiente_pospuesta` |
| `ACT-HOME-06` | Ir a un bloque completo | No | Atrás | `inicio.bloque_abierto` |
| `ACT-HOME-07` | Ocultar un bloque | No | Reactivando en `45` | `inicio.bloque_ocultado` |
| `ACT-HOME-08` | Alternar modo discreto | No | Alternando | `discreto.alternado` |
| `ACT-HOME-09` | Abrir el asistente | No | Cerrándolo | `asistente.abierto` |

**Ninguna acción es propia de este módulo.** Las nueve navegan, alternan una
preferencia o delegan en el módulo dueño con sus reglas. Es `RUL-HOME-08` en
forma de tabla.

## 10. API

| Método y ruta | Notas |
|---|---|
| `GET /home` | Composición completa del Inicio, en una llamada |
| `GET /home/next` | Solo "lo siguiente", para refrescarlo sin recargar |
| `POST /home/next/[id]/postpone` | Posponer. Idempotente |
| `PATCH /home/preferences` | Ocultar o mostrar bloques |

`GET /home` devuelve **todo en una llamada** y no nueve peticiones desde el
cliente. Es deliberado y va contra la costumbre: nueve peticiones desde el
navegador significan nueve viajes de ida y vuelta, nueve oportunidades de
fallo parcial mal manejado, y una cascada de esqueletos que aparecen en orden
aleatorio.

Del lado del servidor, las nueve consultas **se lanzan en paralelo y cada una
puede fallar sola**: la respuesta trae cada bloque con su estado propio
(`RUL-HOME-09`).

```jsonc
{
  "blocks": [
    { "kind": "free_money", "status": "ok",    "data": { } },
    { "kind": "budgets",    "status": "error", "retryable": true },
    { "kind": "movements",  "status": "ok",    "data": { } }
  ],
  "state": "completo"
}
```

Un bloque con `status: "error"` se pinta con su mensaje y su reintento, sin
tocar los demás.

Todas las cifras llegan con sus `evidence_refs` (`22` §2).

## 11. Permisos y RLS

- Cliente autenticado. **Ninguna excepción de service-role**: el Inicio solo
  lee, y siempre en el contexto del usuario.
- RLS heredado de cada tabla consultada. Este módulo no añade tablas.
- `GET /home` **no es cacheable en CDN ni en proxy**: su respuesta contiene el
  estado financiero completo de una persona. Cabeceras `private, no-store`.

La tercera es el tipo de detalle que se olvida y que convierte una pantalla en
un incidente de privacidad en cuanto alguien pone una caché delante.

## 12. Estados de datos

| Estado | Qué se muestra |
|---|---|
| **Vacío** | `SCR-HOME-02`, el onboarding de `44` |
| **Temprano (1-10)** | Movimientos, total del periodo, procedencia, qué va aprendiendo |
| **Funcional (11-50)** | Dinero libre si hay cuentas, pendientes, presupuestos, descubrimientos |
| **Completo (50+)** | Todo lo aplicable a su uso |
| **Sin cuentas, con movimientos** | Sin dinero libre; se dice qué falta y se ofrece agregar una cuenta |
| **Sin nada que hacer** | Sin bloque "lo siguiente". La pantalla es más corta y está bien |
| **Un bloque falla** | Ese bloque con su error; el resto normal (`RUL-HOME-09`) |
| **Sin conexión** | Últimos datos conocidos con su antigüedad |
| **Cargando** | Esqueleto con la forma real: cifra grande, dos tarjetas, tres filas |
| **Modo discreto** | Estructura visible, montos ocultos |

La sexta fila merece énfasis: **un Inicio corto no es un Inicio roto.** Un día
sin nada pendiente debe verse como un día tranquilo, no como una pantalla que
no cargó.

## 13. Errores

| ID | Causa | Mensaje visible | Salida |
|---|---|---|---|
| `ERR-HOME-01` | Un bloque no carga | "No pude cargar esta parte." | Reintentar ese bloque |
| `ERR-HOME-02` | Sin conexión | "Sin conexión. Esto es de hace 2 horas." | Reintentar |
| `ERR-HOME-03` | Todo falla | "No pude cargar tu información. Vuelve a intentarlo." | Reintentar, y registrar movimientos sigue disponible |
| `ERR-HOME-04` | Dinero libre no calculable | "Para decirte cuánto tienes libre necesito el saldo de al menos una cuenta." | Agregar cuenta |

`ERR-HOME-03` conserva la acción de registrar aunque falle todo lo demás:
**registrar no depende de leer**, y dejar al usuario sin poder anotar un gasto
porque una consulta de lectura falló sería perder el dato para siempre.

`ERR-HOME-04` no es un error del usuario y por eso no usa lenguaje de error:
explica qué falta y ofrece la vía.

## 14. Integración con el motor IA

### 14.1 Consultas que expone

Ninguna propia: todas sus cifras pertenecen a otros módulos y ya están
expuestas por ellos.

Lo único que aporta es contexto de pantalla:

| Dimensión | Notas |
|---|---|
| `estado_progresivo` | Vacío, temprano, funcional, completo |
| `bloques_visibles` | Qué está viendo el usuario ahora |

`bloques_visibles` alimenta el `contexto_de_pantalla` del contrato de canal
(`21`): permite que *"¿y esto qué significa?"* escrito desde el Inicio se
resuelva contra lo que hay delante, sin que el usuario tenga que repetirlo.

### 14.2 Comandos que acepta

| Comando | Confirmación |
|---|---|
| `ocultar_bloque_inicio` | No: es reversible |
| `mostrar_bloque_inicio` | No |
| `posponer_siguiente` | No |

Tres comandos, ninguno toca dinero. Todo lo demás que se pida desde el Inicio
lo ejecuta el módulo dueño con su tarjeta.

### 14.3 Qué se puede pedir en lenguaje natural

```text
"¿cómo estoy?"                     → dinero libre y su composición
"¿qué me toca hacer?"              → lo siguiente
"¿de dónde sale ese número?"       → evidencia del dinero libre
"no me muestres las deudas aquí"   → ocultar_bloque_inicio
"gasté 20 en el taxi"              → registrar, con tarjeta (módulo 26)
```

La quinta es la tesis del módulo en una línea: **desde el Inicio se registra
hablando**, y `05c` §15 lo prohibía explícitamente.

### 14.4 Lo que el motor NO puede hacer aquí

- Cambiar el orden de precedencia de `RUL-HOME-03`. Es declarado, no
  negociable en tiempo de ejecución.
- Inventar una "siguiente cosa que hacer" que no salga de los niveles 1 a 4.
- Escribir dinero **sin la tarjeta de confirmación** del módulo dueño
  (`WEB-D013`).
- Mostrar una cifra que no venga de la composición de `GET /home` o de una
  consulta con evidencia.

## 15. Memoria y aprendizaje

| Qué aprende | De dónde | Cómo se corrige |
|---|---|---|
| Qué bloques abre y cuáles ignora | Clics por bloque | Ocultando o mostrando |
| Su perfil de uso | Qué entidades tiene y usa | — |
| Si pospone siempre lo mismo | Posposiciones repetidas | — |
| A qué hora entra | Sesiones | — |

Los cuatro son **preferencias** (`RUL-MEM-01`). Ordenan bloques y no se
confirman.

El tercero tiene un efecto concreto: si el usuario pospone el mismo tipo de
"siguiente cosa" **cuatro veces**, ese tipo deja de destacarse en el Inicio y
se queda en la bandeja de `37`. No se pregunta; se actúa y se dice en `45`.

Y el límite: **lo que se ve en el Inicio no genera hechos de perfil.** Que
alguien mire mucho el bloque de deudas dice cómo lee su pantalla, no cómo vive
(`RUL-MEM-11`).

## 16. Eventos y telemetría

Eventos: `inicio.visto`, `.bloque_mostrado`, `.bloque_abierto`,
`.bloque_ocultado`, `.desglose_visto`, `.siguiente_mostrada`,
`.siguiente_tomada`, `.siguiente_pospuesta`, `.registro_iniciado`,
`.bloque_fallido`.

Sin montos. Sí tipo de bloque, estado progresivo, posición y `trace_id`.

| Métrica | Qué indica |
|---|---|
| **Registros iniciados desde el Inicio** | **La métrica que valida la inversión de la tesis** |
| Tasa de acción sobre "lo siguiente" | Si la precedencia declarada acierta |
| Posposiciones de "lo siguiente" | Si molesta |
| Bloques ocultados, por tipo | Dónde sobra contenido |
| Bloques mostrados y nunca abiertos | Dónde sobra contenido, de otra forma |
| Fallos por bloque | Qué módulo es el eslabón débil |
| Tiempo hasta la primera cifra visible | El presupuesto de §17 cumpliéndose |
| Uso del modo discreto desde la cabecera | Si `RUL-HOME-10` acertó al ponerlo ahí |

La primera es el juicio sobre el documento entero. `05c` decía que la app no
debía competir como canal de registro; si la gente no registra desde aquí, o
la inversión fue equivocada o está mal ejecutada.

## 17. Rendimiento

- **Presupuesto: la primera cifra visible por debajo de 800 ms** en conexión
  normal. Es la pantalla que todo el mundo abre todos los días y la primera
  impresión del producto en cada sesión.
- `GET /home` bajo 500 ms en el servidor, con las nueve consultas **en
  paralelo**. En serie serían la suma de nueve latencias.
- El dinero libre y su composición se resuelven primero y se transmiten
  primero: **la cifra principal no espera a los movimientos recientes**.
- Los bloques de abajo se cargan de forma diferida al desplazarse.
- El esqueleto tiene **la forma real** del contenido, no rectángulos
  genéricos: así el desplazamiento no salta cuando llegan los datos.
- Sin caché compartida (§11). Caché privada del navegador con revalidación.
- Coste de modelo: **cero** para componer el Inicio. El asistente solo consume
  cuando el usuario le escribe.
- Los índices son los de cada módulo. Este no añade ninguno, y ese es un
  criterio de aceptación (`AC-HOME-14`): si el Inicio necesitara un índice
  propio, sería que está calculando algo por su cuenta.

## 18. Accesibilidad específica

- La cifra principal es un `h1` con su composición en el texto asociado, de
  modo que un lector de pantalla la lea entera: "Tienes libres, quinientos
  sesenta soles. De mil ciento cuarenta en tus cuentas…".
- Cada bloque es una `section` con `h2`; la pantalla se recorre por
  encabezados sin tabular por todo.
- El orden del DOM **coincide con el orden visual**, que a su vez es el de
  `RUL-HOME-03`. Reordenar con CSS rompería la navegación por teclado.
- "Lo siguiente" **no usa `role="alert"`**: es importante, no urgente.
- El botón de registrar es el primer elemento tabulable después de la
  navegación.
- El modo discreto anuncia su cambio de estado y los montos ocultos se leen
  como "monto oculto".
- Un bloque que falla se anuncia en `aria-live="polite"` una sola vez, no una
  por bloque.
- El botón flotante de móvil no tapa el último elemento de la lista: la página
  reserva su altura.

## 19. Casos borde

1. **Usuario con movimientos y sin ninguna cuenta.** Sin dinero libre; se
   explica qué falta (`ERR-HOME-04`). No se muestra `S/0.00`.
2. **Todo apartado en cajas: dinero libre exactamente S/0.00.** **Sí se
   muestra**, porque es un dato real y distinto de "no sé". La diferencia
   entre no tener y no saber (`18` §9.1).
3. **Dinero libre negativo.** Se muestra con su signo y su composición. No se
   maquilla ni se pinta de rojo.
4. **Nada pendiente, nada que vence, sin descubrimientos nuevos.** La pantalla
   es corta: cifra, presupuestos, movimientos. Es correcta.
5. **Usuario que oculta todos los bloques.** Quedan la cifra y el registro.
   Se ofrece restaurar desde `45`, sin insistir.
6. **Cuota vencida y correo desconectado a la vez.** "Lo siguiente" muestra el
   correo desconectado: nivel 1 gana a nivel 2 (`RUL-HOME-03`).
7. **Usuario que registró 60 movimientos en un día** (estreno intensivo). Pasa
   a estado `completo` de inmediato: el umbral es de volumen, no de tiempo.
8. **Presupuesto superado y proyección negativa a la vez.** Se muestran los
   dos en "Este mes", sin lenguaje de alarma en ninguno.
9. **Sesión abierta desde dos dispositivos con datos distintos en caché.** Se
   revalida al enfocar la ventana; nunca se muestran dos verdades sin decir su
   antigüedad.
10. **"Ahora no" sobre una cuota vencida, y al día siguiente se paga.** No
    reaparece: su causa se resolvió (`RUL-NOTIF-06`).
11. **Modo discreto activado con el asistente abierto.** El asistente también
    oculta montos; no hay una superficie que se salte el modo.
12. **Bloque de presupuestos con nueve presupuestos activos.** Se muestran
    tres (`SCR-PRES-05`), no nueve. El Inicio informa, no audita.

El caso 2 es el que más veces se implementa mal, y es la diferencia entre un
producto que sabe lo que no sabe y uno que rellena.

## 20. Criterios de aceptación

- `AC-HOME-01` — El dinero libre del Inicio es **idéntico** al de Mi Dinero y
  al que responde el asistente, y los tres salen de la misma llamada.
  Evidencia: `TEST`.
- `AC-HOME-02` — Nunca se muestra `S/0.00` como dinero libre cuando no se
  puede calcular; se dice qué falta. Evidencia: `TEST` + `USER`.
- `AC-HOME-03` — El dinero libre nunca aparece sin su composición.
  Evidencia: `TEST` + `USER`.
- `AC-HOME-04` — Ningún bloque vacío se renderiza. Evidencia: `TEST`.
- `AC-HOME-05` — El orden de los bloques respeta la precedencia declarada de
  `RUL-HOME-03`, y es reproducible en un test. Evidencia: `TEST`.
- `AC-HOME-06` — Se muestra **como máximo una** "siguiente cosa que hacer", y
  ninguna si no hay nada de los niveles 1 a 4. Evidencia: `TEST`.
- `AC-HOME-07` — Ninguna "siguiente cosa que hacer" es una acción de uso del
  producto. Evidencia: `TEST` + `USER`.
- `AC-HOME-08` — Registrar un movimiento está a un clic en los cuatro estados
  progresivos y en los dos tamaños de pantalla. Evidencia: `TEST` + `USER`.
- `AC-HOME-09` — Ningún bloque del Inicio ejecuta una operación de dinero; el
  asistente lo hace solo con confirmación explícita. Evidencia: `CODE` + `TEST`.
- `AC-HOME-10` — El fallo de un bloque no impide que los demás se muestren, y
  registrar sigue disponible aunque fallen todos. Evidencia: `TEST`.
- `AC-HOME-11` — `GET /home` responde con cada bloque y su estado propio en
  una sola llamada, con las consultas en paralelo. Evidencia: `CODE` + `TEST`.
- `AC-HOME-12` — La respuesta de `GET /home` no es cacheable por ningún
  intermediario. Evidencia: `TEST`.
- `AC-HOME-13` — La primera cifra visible aparece por debajo de 800 ms.
  Evidencia: `METRIC`.
- `AC-HOME-14` — El Inicio **no añade ningún índice ni tabla**: si los
  necesitara, estaría calculando por su cuenta. Evidencia: `CODE`.
- `AC-HOME-15` — El estado vacío no ofrece ningún canal externo y ofrece tres
  puertas propias. Evidencia: `TEST` + `USER`.
- `AC-HOME-16` — No hay ningún saludo con nombre, emoji de celebración ni
  signo de exclamación. Evidencia: `TEST` + `USER`.
- `AC-HOME-17` — En modo discreto la estructura se conserva y los montos se
  ocultan, incluido el asistente. Evidencia: `TEST`.
- `AC-HOME-18` — El orden del DOM coincide con el orden visual.
  Evidencia: `TEST`.
- `AC-HOME-19` — Un bloque oculto por el usuario no reaparece por ninguna
  observación de uso. Evidencia: `TEST`.
- `AC-HOME-20` — Ningún gráfico aparece en el Inicio. Evidencia: `CODE`.
- `AC-HOME-21` — Un usuario con dinero libre S/0.00 real **sí** ve la cifra.
  Evidencia: `TEST`.

## 21. Fuera de alcance y puente a WhatsApp

**Diferido a V1.1:** orden de secciones elegido por el usuario, widgets
configurables, resumen narrativo con saludo (si se mide que aporta).

**Prohibido, no diferido:** panel de administración, gráficos, comparativas
como pantalla principal, métricas de uso del producto mostradas al usuario,
acciones de crecimiento presentadas como "siguiente cosa que hacer", y
cualquier bloque que ejecute dinero sin confirmación.

Puente a WhatsApp: **el Inicio no cruza, y eso es una conclusión, no una
carencia.** Una pantalla es una superficie donde nueve cosas coexisten y el
usuario elige dónde mirar; una conversación es lineal y solo cabe una cosa a
la vez.

Lo que sí cruza es la **precedencia de `RUL-HOME-03`**: es una regla de
producto sobre qué importa más, y sirve igual para decidir el primer bloque de
una pantalla que la primera frase de un mensaje. En la fase 2, *"¿cómo estoy?"*
se responde con el dinero libre, su composición y **lo siguiente que hacer**,
en ese orden, porque es el mismo orden.

Es un ejemplo limpio de `21_contrato_de_canal_y_presentadores.md`: la misma
decisión de producto, dos presentaciones que no se parecen en nada.

## 22. Trazabilidad

**Documentos de `docs/` fusionados y reescritos:**
`docs/fase_2_estrategia/alcance_v1/05c_dashboard.md` (1.3k líneas) y
`docs/fase_3_producto/17_dashboard_ux.md`, que se solapaban entre el 60 y el
70% describiendo las mismas ocho pantallas desde dos fases distintas. Esa
duplicación es la que motivó `WEB-D008` —el número de archivo es el orden de
escritura— y la que hace que este documento se escriba **el último de los
dieciséis módulos** y no el primero, que fue el error original.

**La tesis que se invierte, literal:**

| `05c` §1 | Este documento |
|---|---|
| "El Dashboard no debe competir con WhatsApp como canal principal de registro" | El Inicio **es** el canal de registro. No hay otro |
| "Revisa, entiende, corrige y toma control" | Registra, entiende, decide y actúa |
| §15: la IA no escribe desde el Dashboard | El asistente escribe, siempre con confirmación (`WEB-D013`) |
| §20: fuera presupuestos, proyecciones, gráficos, reportes y exportaciones | Los cinco existen: módulos `32`, `33`, `35` |
| §12.1: estado vacío con "guía para registrar por WhatsApp" | Tres puertas propias, ningún canal externo |

**Qué se rescata, porque era bueno:**

| De `05c` / `17` | Dónde vive ahora |
|---|---|
| Las ocho preguntas que el Inicio debe responder (`05c` §1) | §1, ahora respondibles todas |
| Los cuatro estados progresivos (`05c` §12) | §5, con umbrales recalibrados |
| La tabla de uso parcial y adaptativo (`05c` §13) | `RUL-HOME-06` |
| "Nunca un estado de error vacío sin guía" (`05c` §12.5) | `RUL-HOME-09`, literal |
| Degradación con datos y antigüedad (`05c` §12.5) | `RUL-HOME-09` |
| Dinero libre como número principal, nunca `S/0` si faltan datos (`17_dashboard_ux` §5, §11.1) | `RUL-HOME-01` |
| Distinguir dinero libre de dinero total (`17_dashboard_ux` §11.1) | `RUL-HOME-01` |
| La jerarquía del primer pantallazo (`17_dashboard_ux` §5) | `RUL-HOME-03`, formalizada como precedencia declarada |

> **Aviso de numeración.** En este bloque, `17_dashboard_ux` se refiere al
> documento histórico `docs/fase_3_producto/17_dashboard_ux.md`. En el corpus
> nuevo, `17` es `17_patrones_datos_formularios_y_listados.md`. Los números de
> los dos corpus no se corresponden y nunca deben citarse a secas.

**Qué se descarta:**

| De `05c` / `17` | Razón |
|---|---|
| La tesis de §1 y todo lo que colgaba de ella | Es la causa raíz documentada del problema del producto |
| `05c` §15, la IA read-only en el Dashboard | Contradice `WEB-D003` |
| `05c` §20, las cinco exclusiones | Contradice `WEB-D002`; los módulos ya existen |
| El `ExperienceIntelligenceEngine` y el `Disclosure Engine` (`05c` §13) | La adaptación se resuelve contando filas (`RUL-HOME-06`); no hacía falta un motor |
| El estado vacío con WhatsApp (`05c` §12.1) | `SCR-HOME-02` |
| La duplicación entre `05c` y `17` | Un solo documento |

**Contradicciones que cierra:** ninguna de las 17 por sí solo. Es el documento
que **hace visible** el cierre de las demás: `C-05` (los once tipos
registrables) se comprueba desde el registro rápido del Inicio, `C-07` (poder
corregir) desde los movimientos recientes, `C-08` (memoria accesible) desde el
enlace a `/configuracion/memoria`, y `C-17` (canales apagados) desde que el
Inicio no pide ningún permiso de notificación al abrirse.

**Cierre del bloque de módulos.** Con este documento terminan los dieciséis de
`04_modulos/`. El orden en que se escribieron —cuentas primero, Inicio último—
es el inverso del corpus anterior, donde `05c` se escribió antes que casi todo
lo que resume. Escribir el resumen antes que lo resumido es lo que permitió
que su §20 excluyera funciones que ningún documento defendía todavía.

**Decisiones tomadas en este documento**, registradas en
`03_decisiones_producto_web.md`:

| Decisión | ID | Alternativa descartada | Razón |
|---|---|---|---|
| El Inicio es el canal de registro, no una capa de revisión | `WEB-D081` | Mantener la tesis de `05c` §1 | Esa frase es la causa raíz documentada de que el producto se sintiera simple: de ella colgaban la IA read-only y las cinco exclusiones de §20 |
| El orden es una precedencia declarada, no un score | `WEB-D082` | Ordenar con relevancia aprendida | Un score sería más flexible y no se podría explicar ni probar. Con una lista declarada, "¿por qué me muestra esto primero?" tiene respuesta y un test |
| Una sola "siguiente cosa que hacer", y ninguna si no hay | `WEB-D083` | Una lista de sugerencias, o rellenar siempre | Rellenar obliga a inventar, y lo inventado acaba siendo una acción de uso del producto. Al tercer día se ignora, arrastrando las que sí importaban |
| Un bloque vacío no se muestra | `WEB-D084` | Estado vacío por bloque con su llamada a la acción | Ocupa espacio para decir que no hay nada y sugiere que debería haberlo. Un usuario sin deudas no tiene un hueco en su vida financiera |
| Cada bloque falla solo | `WEB-D085` | Que un fallo tumbe la pantalla | Con nueve fuentes, la disponibilidad del Inicio sería el producto de nueve disponibilidades. Y registrar no depende de leer |
| Una sola llamada con bloques independientes | `WEB-D086` | Nueve peticiones desde el cliente | Nueve viajes, nueve fallos parciales mal manejados y una cascada de esqueletos en orden aleatorio. El paralelismo va en el servidor |
| Sin saludo, sin gráficos, sin celebración | `WEB-D087` | Saludo con nombre y resumen narrativo | Un saludo entusiasta en una app de finanzas envejece en dos días y ocupa el sitio de la cifra que la persona venía a ver |
| El Inicio no añade ninguna tabla ni índice | `WEB-D088` | Tabla de composición o caché propia | Si necesitara un índice sería que está calculando por su cuenta, y entonces podría discrepar de las demás pantallas |
