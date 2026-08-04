# 44 — Onboarding de la aplicación web

**Bloque:** 06 — Transversales
**Alcance:** V1 (reescritura)
**Fecha:** 26 de julio de 2026
**Docs fuente:** `docs/fase_3_producto/13_onboarding_activacion.md` §3 (reutilizado), §6 y §7 (reescritos), `39_modulo_home_resumen_financiero.md` §5
**Documentos que dependen de este:** `47` (ciclo de vida del dato), `54` (plan de implementación)

---

## 1. Tesis y qué NO es

El corpus anterior tenía dos flujos de alta, y el recomendado se llamaba
**"Flujo recomendado: WhatsApp primero"** (`13_onboarding_activacion.md` §6).
El de la aplicación era el §7, el alternativo.

Aquí no hay otro canal. Y eso cambia menos de lo que parece, porque la parte
buena de ese documento —su §3, *"Primer valor por ruta"*— no dependía del
canal: decía que **la gente entra por sitios distintos y el primer valor es
distinto en cada uno**. Esa idea se conserva entera.

La tesis: **el onboarding no es una secuencia, es un conjunto de puertas.** No
hay paso 1 de 5. Hay tres formas de empezar, ninguna obligatoria, y el
producto reconoce por cuál entró la persona y **completa esa ruta** en vez de
empujarla por todas.

De ahí sale la regla que gobierna el documento, heredada literal de `§3.4` del
original porque estaba bien dicha:

> Si el usuario solo usa una ruta, Manzana no debe empujarlo a completar todo
> el sistema antes de darle valor.

Y una segunda, que es la que evita el onboarding que todo el mundo abandona:
**no se pregunta nada que el producto no vaya a usar en el minuto siguiente**
(`RUL-ONB-03`).

**Qué NO es:**

- **No es un asistente de configuración.** No hay pasos numerados, ni barra de
  progreso, ni "completa tu perfil".
- **No es un cuestionario.** No se pregunta por metas, ingresos ni hábitos.
  Eso se aprende usando (`36`), o no se sabe.
- **No es una pantalla.** Es el estado vacío del Inicio (`39` `SCR-HOME-02`)
  más lo que ocurre en los primeros días.
- **No termina.** Se desvanece conforme hay datos, según los estados
  progresivos de `39` §5.

## 2. Alcance

| Nivel | Funcionalidad |
|---|---|
| **IN** | Tres puertas de entrada sin orden. Detección de la ruta y siguiente paso que **completa esa ruta**. Primer valor definido y medido por ruta. Ayuda contextual en el primer uso de cada concepto. Desvanecimiento progresivo. Reanudación: quien vuelve al día siguiente no empieza de cero. |
| **V1.1** | Importación de un extracto como cuarta puerta (depende de `WEB-D026`). Plantillas de arranque por tipo de usuario. |
| **FUERA** | Onboarding guiado por WhatsApp (fase 2). Cuestionario de objetivos. Barra de progreso de configuración. Tour guiado con superposiciones. |

## 3. Vocabulario

| Interno | Visible |
|---|---|
| `onboarding`, `activación`, `ruta` | — (**nunca visible**) |
| Estado vacío | — |
| Primer valor | — |

Prohibido frente al usuario: `onboarding`, `configuración inicial`,
`completa tu perfil`, `paso 1 de 3`, `empecemos a configurar`, `activación`.

El producto **nunca habla de sí mismo instalándose**:

```text
Correcto:   Empecemos por lo tuyo.
Correcto:   ¿Cuánto tienes ahora?
Incorrecto: Vamos a configurar tu cuenta. Paso 1 de 4.
Incorrecto: Completa tu perfil para desbloquear todas las funciones.
```

La segunda incorrecta es especialmente dañina: convierte la aplicación en algo
que el usuario le debe al producto.

## 4. Las tres puertas

Ninguna es obligatoria, ninguna precede a otra, y **las tres se muestran a la
vez** (`39` `SCR-HOME-02`).

| Puerta | Qué pide | Para quién |
|---|---|---|
| **Registrar un movimiento** | Un monto y una descripción | Quien quiere probar si esto sirve |
| **Agregar una cuenta** | Nombre y saldo | Quien quiere saber cuánto tiene |
| **Conectar el correo** | Un permiso de Gmail | Quien no quiere anotar nada |

Y en la misma pantalla, sin ser puerta, la frase que explica hacia dónde va
todo esto:

```text
Cuando tenga tus cuentas te diré cuánto tienes libre de verdad:
lo que queda después de lo que ya está comprometido.
```

Explicar el dinero libre **antes de poder calcularlo** es lo que hace que
cuando aparezca signifique algo. Sin esa frase, "S/560" es un número más.

## 5. Primer valor por ruta

Rescatado de `13_onboarding_activacion.md` §3.4, con la columna de canal
eliminada y las rutas actualizadas a los módulos que ahora existen.

| Ruta | Primer valor | Cuándo llega |
|---|---|---|
| **Registro rápido** | Su movimiento, guardado y corregible | 1 movimiento |
| **Cuentas** | *"Tienes S/X"*, con su composición | 1 cuenta con saldo |
| **Liquidez** | Dinero libre real, distinto del saldo | 1 cuenta + 1 compromiso |
| **Deudas** | Cuánto debe, a quién y cuándo vence | 1 deuda |
| **Compromisos** | Qué pagos vienen y si están cubiertos | 1 pago recurrente |
| **Correo** | Pendientes detectados, sin registrar nada solo | Buzón + 1 detección |
| **Presupuestos** | Cuánto lleva contra lo que planeó | 1 presupuesto + 3 gastos |
| **Gasto habitual** | El primer descubrimiento con evidencia | Según `RUL-DESC-01` |

**Las seis primeras rutas dan valor con un solo dato.** Es la consecuencia
directa de `WEB-D042`: la clase A de descubrimientos funciona sobre lo
declarado, no sobre el historial. Alguien que registra una deuda el primer día
ve inmediatamente una cuota que vence y si está cubierta o no.

Esa es la diferencia más grande respecto del corpus anterior, donde el primer
descubrimiento llegaba a los 5 movimientos y los patrones a los 40.

## 6. Reglas

**`RUL-ONB-01` — Ningún paso es obligatorio, y no hay progreso que mostrar**

Sin barra, sin lista de tareas, sin porcentaje de perfil completo.

Una barra de progreso convierte una configuración a medias en **una deuda
pendiente**, y produce dos comportamientos malos: completar pasos sin
entenderlos para que el indicador llegue al final, o abandonar porque quedan
tres cosas que no interesan.

Lo que sí hay es el bloque **"lo siguiente"** del Inicio (`RUL-HOME-04`), que
muestra **una** cosa, la de esa ruta, y desaparece cuando no hay ninguna.

**`RUL-ONB-02` — El siguiente paso completa la ruta que el usuario eligió**

No el paso siguiente de una lista genérica.

| Si el usuario acaba de… | Se ofrece | **No** se ofrece |
|---|---|---|
| Registrar su primer movimiento | Registrar otro, o clasificar ese | Conectar el correo |
| Agregar su primera cuenta | Su primer compromiso, para ver dinero libre | Crear un presupuesto |
| Registrar una deuda | Vincular una caja que la cubra | Registrar gastos |
| Conectar el correo | Confirmar el primer pendiente | Agregar cuentas |
| Crear un presupuesto | Nada. Ya está: se ve al gastar | — |

La última fila importa tanto como las otras: **a veces el siguiente paso
correcto es ninguno.**

Y una prohibición explícita: el siguiente paso **nunca es una acción de uso
del producto** (`WEB-D083`). No existe "vuelve mañana", "registra algo hoy" ni
"prueba el asistente".

**`RUL-ONB-03` — No se pregunta nada que no se use en el minuto siguiente**

Prohibido en V1: preguntar por ingresos mensuales, metas financieras, nivel de
experiencia, motivo de uso, edad, ocupación o cualquier segmentación.

El motivo no es solo privacidad: **es que no se usarían**. Un dato que se pide
y no cambia nada enseña que el producto pregunta por preguntar, y a partir de
ahí las preguntas que sí importan se responden con menos cuidado.

Lo que el producto necesita saber de la persona lo aprende usándolo (`36`,
`20c`), con confirmación previa para los hechos de perfil (`WEB-D058`).

**Excepción única:** el saldo de una cuenta se pide al crearla, porque se usa
en la misma pantalla para calcular el dinero libre.

**`RUL-ONB-04` — Se explica cada concepto la primera vez que aparece, en su sitio**

No hay tour guiado. La explicación va **donde está la cosa**, la primera vez, y
se puede cerrar:

| Concepto | Cuándo se explica |
|---|---|
| Dinero libre | La primera vez que se muestra la cifra |
| Caja | Al crear la primera |
| Pendiente | Al llegar el primero del correo |
| Presupuesto que no reserva | Al crear el primero (`RUL-PRES-01`) |
| Evidencia | La primera vez que se pulsa una cifra |
| Memoria | La primera vez que el sistema aplica algo aprendido |

Un tour al principio explica seis cosas que aún no existen; una explicación en
sitio explica una cosa que el usuario está mirando. La segunda se recuerda.

Cada explicación aparece **una vez**, se marca como vista, y vive después en
`48` para quien la busque.

**`RUL-ONB-05` — Volver al día siguiente no es empezar de cero**

Quien se va a mitad y vuelve encuentra lo que dejó: la cuenta que creó, el
movimiento que registró, y el mismo "lo siguiente" si sigue aplicando.

**Nunca se reinicia la bienvenida** ni se vuelve a mostrar el estado vacío si
hay algún dato. Y no se manda un correo de "no terminaste de configurar": eso
es lo que `RUL-NOTIF-01` clasifica como clase U, apagado por defecto.

**`RUL-ONB-06` — El onboarding se desvanece; no se completa**

No hay momento de "ya está configurado". Las puertas dejan de mostrarse cuando
dejan de hacer falta, y los estados progresivos de `39` §5 gobiernan el resto.

| Deja de mostrarse | Cuando |
|---|---|
| La puerta de registrar | Hay 1 movimiento |
| La puerta de cuentas | Hay 1 cuenta |
| La puerta de correo | Hay un buzón, o se rechazó dos veces |
| La frase que explica el dinero libre | Se puede calcular y se está mostrando |
| Las explicaciones en sitio | Cada una, tras verse |

"Se rechazó dos veces" es el mismo criterio que `RUL-DESC-12` y `RUL-MEM-01`
para todo lo demás: dos rechazos son señal, no casualidad.

**`RUL-ONB-07` — El correo se ofrece, no se empuja**

Conectar Gmail es la puerta más valiosa y la más delicada: pide acceso al
correo de alguien que lleva dos minutos en el producto.

- Se ofrece **desde el primer momento**, junto a las otras dos, sin destacarla.
- Se explica **qué se lee y qué no** antes de pedir el permiso, no en la
  pantalla de Google: solo remitentes autorizados, nunca el cuerpo completo,
  nunca registro automático (`28`).
- Si se rechaza, **no se vuelve a ofrecer como puerta**; queda en
  configuración.
- Se ofrece de nuevo **una sola vez** si el usuario lleva 10 movimientos
  manuales, porque entonces la propuesta tiene un argumento concreto: *"llevas
  10 registrados a mano; podría traerlos yo"*.

**`RUL-ONB-08` — Activación: qué contamos y qué no**

Rescatado de `13_onboarding_activacion.md` §3.1 y §3.2, adaptado.

**Activación mínima** —el umbral real del producto—:

1. Un dato propio registrado: movimiento, cuenta, deuda o compromiso.
2. Ha visto una cifra que **no es la que escribió** (dinero libre, un total,
   un descubrimiento).
3. Sabe que puede corregir: ha visto una acción de corrección.

El punto 2 es el que define el producto. Escribir un gasto y verlo en una
lista es un cuaderno; ver una cifra derivada de lo que escribiste es Manzana.

**Activación fuerte** — al menos tres de:

- 5 movimientos confirmados
- una corrección hecha
- un descubrimiento de clase A visto
- un buzón conectado con un pendiente confirmado
- un presupuesto, una deuda o un compromiso creado
- una conversación con el asistente que terminó en una acción confirmada

**No se mide como progreso visible.** Es telemetría (§10), no un indicador
para el usuario.

## 7. Superficies

**Referencia visual: parcial.** El estado vacío del Dashboard existe en
`docs/fase_6_visual/30_app_flow.md` §4.1, con "Abrir WhatsApp" como acción
secundaria — que es lo que este documento elimina.

| ID | Superficie | Ruta |
|---|---|---|
| `SCR-ONB-01` | Estado vacío del Inicio | `/inicio` — es `39` `SCR-HOME-02` |
| `SCR-ONB-02` | Bienvenida tras el primer acceso | `/bienvenida` |
| `SCR-ONB-03` | Explicación en sitio | Componente |
| `SCR-ONB-04` | Permiso de correo explicado | `/bienvenida/correo` |

### `SCR-ONB-02` — Bienvenida

Se muestra **una vez**, tras completar el registro, antes de llegar al Inicio.
Es la única pantalla dedicada de todo el onboarding.

```text
┌──────────────────────────────────────────────┐
│ Hola.                                        │
│                                              │
│ Manzana te dice cuánto dinero tienes         │
│ de verdad: lo que queda después de lo        │
│ que ya está comprometido.                    │
│                                              │
│ Para eso necesito que empecemos por algo.    │
│ Elige por dónde:                             │
│                                              │
│   [Registrar un gasto]                       │
│   [Decirte cuánto tengo]                     │
│   [Conectar mi correo]                       │
│                                              │
│   Prefiero mirar primero →                   │
└──────────────────────────────────────────────┘
```

- **Tres frases antes de la primera decisión.** Ni una más.
- La promesa está enunciada en la primera: es la que hay que cumplir en los
  tres minutos siguientes.
- "Prefiero mirar primero" lleva al Inicio vacío, con las mismas tres puertas.
  **Es una salida legítima**, no un enlace escondido: hay gente que necesita
  ver antes de dar.
- Sin ilustración, sin animación, sin carrusel de funciones.

### `SCR-ONB-03` — Explicación en sitio

```text
┌────────────────────────────────────┐
│ Esto es tu dinero libre.       [✕] │
│ De lo que tienes en cuentas, le    │
│ resto lo que ya está apartado y    │
│ lo que vas a pagar pronto.         │
│ [Ver cómo sale]                    │
└────────────────────────────────────┘
```

Anclada al elemento que explica, cerrable, **una sola vez**, y con enlace a la
ayuda permanente de `48`.

Nunca superpuesta al elemento ni bloqueando la pantalla: si tapa lo que
explica, no explica nada.

### `SCR-ONB-04` — Permiso de correo explicado

Pantalla propia **antes** de la de Google, porque la de Google no la
controlamos y su lenguaje es de permisos, no de producto.

```text
┌──────────────────────────────────────────────┐
│ Conectar tu correo                           │
│                                              │
│ Tu banco y Yape ya te avisan de cada         │
│ movimiento. Puedo leerlos y anotarlos por ti.│
│                                              │
│ Lo que hago:                                 │
│   Leo solo los correos de los bancos que     │
│   tú autorices.                              │
│   Todo lo que detecte espera tu confirmación.│
│   Nunca registro nada solo.                  │
│                                              │
│ Lo que no hago:                              │
│   No guardo el contenido de tus correos.     │
│   No leo nada de otros remitentes.           │
│   No escribo ni envío correos desde tu cuenta│
│                                              │
│   [Continuar]        [Ahora no]              │
└──────────────────────────────────────────────┘
```

**"Lo que no hago" pesa tanto como "lo que hago"**, y va después, que es donde
se lee. Es el momento de mayor desconfianza legítima del producto entero.

## 8. Acciones

| ID | Acción | ¿Confirma? | Deshacer | Evento |
|---|---|---|---|---|
| `ACT-ONB-01` | Elegir una puerta | No | Atrás | `onboarding.puerta_elegida` |
| `ACT-ONB-02` | Saltar a mirar primero | No | — | `onboarding.mirar_primero` |
| `ACT-ONB-03` | Cerrar una explicación | No | En `48` | `onboarding.explicacion_cerrada` |
| `ACT-ONB-04` | Rechazar el correo | No | En configuración | `onboarding.correo_rechazado` |
| `ACT-ONB-05` | Seguir el paso ofrecido | No | La de destino | `onboarding.paso_seguido` |
| `ACT-ONB-06` | Descartar el paso ofrecido | No | Reaparece si cambia el estado | `onboarding.paso_descartado` |

**Ninguna es propia:** todas navegan o delegan en el módulo dueño. Este
documento no crea entidades ni escribe datos financieros.

## 9. Estados de datos

| Estado | Qué se muestra |
|---|---|
| **Recién registrado** | `SCR-ONB-02`, una vez |
| **Cero datos** | `SCR-ONB-01`: tres puertas y la frase del dinero libre |
| **Un dato de una ruta** | El siguiente paso **de esa ruta** (`RUL-ONB-02`) |
| **Datos de dos rutas** | Las puertas usadas desaparecen; el resto sigue |
| **Correo rechazado** | Esa puerta no vuelve; queda en configuración |
| **Vuelve al día siguiente sin datos** | El mismo estado vacío, **sin bienvenida** |
| **Vuelve al día siguiente con datos** | El Inicio normal, en su estado progresivo |
| **Cuenta sin verificar** | Todo funciona, con la banda de `RUL-AUTH-03` |

## 10. Eventos y métricas

Eventos: `onboarding.bienvenida_vista`, `.puerta_elegida`, `.mirar_primero`,
`.primer_dato`, `.primer_valor`, `.explicacion_vista`, `.explicacion_cerrada`,
`.correo_ofrecido`, `.correo_rechazado`, `.paso_seguido`,
`.activacion_minima`, `.activacion_fuerte`.

Sin montos, sin contenido. Sí ruta, puerta y `trace_id`.

| Métrica | Qué indica |
|---|---|
| **Tiempo hasta el primer valor, por ruta** | **La métrica que juzga este documento.** Objetivo: mediana bajo 3 minutos |
| Reparto de puertas elegidas | Cuál importa de verdad, y si alguna sobra |
| Activación mínima a 24 h | Si el primer valor engancha |
| Activación mínima a 7 días | Si vuelve |
| Abandono en la bienvenida | Si tres frases son demasiadas |
| Uso de "prefiero mirar primero" | Si la salida hacía falta |
| Aceptación del correo, y a los 10 movimientos | Si la segunda oferta con argumento funciona |
| Explicaciones cerradas sin leer | Cuáles estorban |

La primera se mide **por ruta y no en agregado**, porque el agregado esconde
justo lo que importa: si la ruta de deudas da valor en 40 segundos y la de
gasto habitual tarda una semana, la media no dice nada de ninguna.

## 11. Accesibilidad

- La bienvenida es una página normal con `h1`, no un modal: se puede recorrer,
  ampliar y volver atrás.
- Las tres puertas son botones en el orden en que se leen.
- Las explicaciones en sitio se anuncian al aparecer con `aria-live="polite"`,
  **no roban el foco**, y su cierre devuelve el foco al elemento que explican.
- La pantalla de permiso de correo tiene las dos listas como listas reales,
  con encabezados: quien navega por encabezados oye "lo que hago" y "lo que no
  hago" como dos secciones.
- Ningún paso depende de arrastrar, pasar el ratón por encima ni de un gesto.
- "Prefiero mirar primero" es alcanzable con teclado sin pasar por las tres
  puertas.

## 12. Casos borde

1. **Registra un movimiento y no vuelve en un mes.** Al volver: el Inicio con
   su movimiento, sin bienvenida y sin reproche.
2. **Conecta el correo y no llega ninguna detección en una semana.** Se dice
   —puede que su banco no escriba, o que el remitente no esté vigilado— y se
   ofrece revisar (`28`). No se deja en silencio.
3. **Crea una cuenta con saldo cero.** Válido. El dinero libre es S/0.00 real,
   y se muestra (`39` §19 caso 2).
4. **Rechaza el correo y luego lo conecta desde configuración.** Funciona; la
   puerta no reaparece porque ya no hace falta.
5. **Registra 10 movimientos a mano sin conectar el correo.** Se ofrece una
   segunda vez, con el argumento concreto (`RUL-ONB-07`). Si vuelve a
   rechazar, nunca más.
6. **Empieza en móvil y sigue en escritorio.** El estado es del servidor: las
   puertas usadas siguen usadas.
7. **Elige "mirar primero" y no hace nada en 5 minutos.** No pasa nada. Sin
   avisos, sin animaciones, sin insistir.
8. **Registra una deuda como primer y único dato.** Recibe valor completo:
   cuota, vencimiento y cobertura. No se le pide nada más.
9. **Borra su único movimiento.** Vuelve al estado vacío con las tres puertas,
   **sin bienvenida**: ya la vio.
10. **Cuenta creada por OAuth de Google en V1.1.** El correo ya está
    verificado; la puerta de conectar buzón sigue siendo una decisión aparte
    (§2).

El caso 8 es la prueba del documento: es la ruta que el diseño anterior no
podía servir, porque su primer descubrimiento exigía cinco movimientos.

## 13. Criterios de aceptación

- `AC-ONB-01` — **No existe ninguna barra de progreso ni lista de pasos
  obligatorios.** Evidencia: `CODE` + `USER`.
- `AC-ONB-02` — Las tres puertas se muestran a la vez, sin orden ni jerarquía
  entre ellas. Evidencia: `TEST` + `USER`.
- `AC-ONB-03` — Ninguna pantalla ofrece un canal externo.
  Evidencia: `TEST`.
- `AC-ONB-04` — El siguiente paso ofrecido **completa la ruta usada**, y no es
  nunca una acción de uso del producto. Evidencia: `TEST` + `USER`.
- `AC-ONB-05` — No se pide ningún dato que no se use en la misma sesión.
  Evidencia: `DOC` + `USER`.
- `AC-ONB-06` — Un usuario que registra **solo una deuda** recibe valor
  completo sin ningún paso adicional. Evidencia: `TEST`.
- `AC-ONB-07` — La bienvenida se muestra una sola vez, y no reaparece aunque
  el usuario borre todos sus datos. Evidencia: `TEST`.
- `AC-ONB-08` — Cada explicación en sitio aparece una vez y queda disponible
  después en la ayuda. Evidencia: `TEST`.
- `AC-ONB-09` — La pantalla de permiso de correo declara **qué no se hace**,
  antes de la pantalla de Google. Evidencia: `TEST` + `USER`.
- `AC-ONB-10` — El correo rechazado no vuelve a ofrecerse como puerta; se
  ofrece una segunda y última vez a los 10 movimientos manuales.
  Evidencia: `TEST`.
- `AC-ONB-11` — No se envía ningún correo de "no terminaste de configurar".
  Evidencia: `TEST`.
- `AC-ONB-12` — Volver al día siguiente conserva el estado y no reinicia nada.
  Evidencia: `TEST`.
- `AC-ONB-13` — La mediana de tiempo hasta el primer valor está bajo 3
  minutos, medida por ruta. Evidencia: `METRIC`.
- `AC-ONB-14` — Las explicaciones no roban el foco ni tapan lo que explican.
  Evidencia: `TEST`.

## 14. Fuera de alcance y puente a WhatsApp

**Diferido a V1.1:** importación de un extracto como cuarta puerta, plantillas
de arranque, alta con Google.

**Prohibido, no diferido:** cuestionario de objetivos o segmentación, barra de
progreso de configuración, tour guiado con superposiciones, correos de
recuperación de onboarding, y ofrecer cualquier canal externo como vía de
entrada.

Puente a WhatsApp: en la fase 2 aparece una cuarta puerta —vincular el
teléfono—, y **el flujo no se invierte**. `13_onboarding_activacion.md` §6
ponía WhatsApp primero; eso ya no vuelve. La cuenta se crea en la aplicación
(`43` §21) y el canal se vincula a una cuenta que existe.

Lo que sí cambia en la fase 2: la ruta de registro rápido pasa a tener su
primer valor **fuera de la aplicación**, y eso obliga a que el primer mensaje
de vuelta cumpla lo mismo que aquí cumple la pantalla — mostrar una cifra que
el usuario no escribió.

## 15. Trazabilidad

**Documento parcialmente reescrito:**
`docs/fase_3_producto/13_onboarding_activacion.md`.

**Qué se rescata:**

| De `13_onboarding_activacion` | Dónde vive ahora |
|---|---|
| §3.1 Activación mínima | `RUL-ONB-08`, con el punto 2 reformulado |
| §3.2 Activación fuerte | `RUL-ONB-08` |
| §3.4 Primer valor por ruta | §5, sin la columna de canal |
| La regla de no empujar a completar todo el sistema (§3.4) | §1, literal |
| §11 Progresión de disclosure | `RUL-ONB-04` y `RUL-ONB-06` |
| §12 Lo que no debe hacer V1 | Distribuido en las prohibiciones |

**Qué se descarta:**

| De `13_onboarding_activacion` | Razón |
|---|---|
| §6 "Flujo recomendado: WhatsApp primero" | No hay otro canal en V1 |
| §7 como flujo alternativo | Pasa a ser el único, y por tanto deja de ser "alternativo" |
| §9 Recordatorios y consentimiento durante el onboarding | Vive en `37` y `46`, y ninguno se activa aquí (`C-17`) |
| El trigger de primer wow a los 5 movimientos (§3.3) | `WEB-D042` lo adelanta: la clase A da valor con un dato |

**Contradicción que informa:**

`C-09` — *"Lifecycle V1 documentado vs. solo onboarding inicial + drafts."*
Este documento acota el alcance real: **en V1-web el ciclo de vida es el
onboarding y el correo transaccional**, nada más. El sistema completo de
retención multicanal se difiere a la fase 2, y decirlo explícitamente es lo
que cierra la parte que corresponde aquí. La otra mitad está en `46`.

**Decisiones tomadas en este documento**, registradas en
`03_decisiones_producto_web.md`:

| Decisión | ID | Alternativa descartada | Razón |
|---|---|---|---|
| El onboarding es un conjunto de puertas, no una secuencia | `WEB-D114` | Asistente de configuración por pasos | La gente entra por sitios distintos y el primer valor es distinto en cada uno. Empujarla por todos antes de darle valor es lo que hace abandonar |
| Sin barra de progreso ni lista de pasos | `no_negociable` `WEB-D115` | Indicador de perfil completo | Convierte una configuración a medias en una deuda con el producto, y produce completar sin entender o abandonar por lo que no interesa |
| El siguiente paso completa la ruta elegida | `WEB-D116` | El siguiente paso de una lista genérica | A veces el paso correcto es ninguno, y una lista genérica nunca puede decir eso |
| No se pregunta nada que no se use en el minuto siguiente | `no_negociable` `WEB-D117` | Cuestionario de metas e ingresos al empezar | No es solo privacidad: un dato que se pide y no cambia nada enseña que el producto pregunta por preguntar, y contamina las preguntas que sí importan |
| Se explica cada concepto en su sitio, no en un tour | `WEB-D118` | Tour guiado al entrar | Un tour explica seis cosas que aún no existen; una explicación en sitio explica una que el usuario está mirando |
| El correo se ofrece dos veces como máximo | `WEB-D119` | Insistir, o no volver a ofrecer nunca | La segunda oferta tiene un argumento concreto —diez movimientos a mano— que la primera no podía tener. Una tercera sería insistencia |
| El onboarding se desvanece; nunca se completa | `WEB-D120` | Un momento de "configuración terminada" | No existe ese momento: las puertas dejan de hacer falta a ritmos distintos, y declararlo terminado obligaría a definir un mínimo que no hay |
