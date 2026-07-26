# 20 — Arquitectura del motor conversacional

**Bloque:** 03 — Motor IA
**Estado:** V1
**Fecha:** 25 de julio de 2026
**Depende de:** `07_alcance_web_v1.md`, `08_principios_experiencia_web.md`, `13_modelo_datos_web_v1.md`
**Documentos que dependen de este:** `21`, `22`, `23`, `40`, `41`, `42`, y la §14 de todos los módulos

> **Nota de método.** Este documento y los tres siguientes se escribieron
> **sin consultar `src/agents/`, `src/core/conversation/` ni el diseño de
> motor del corpus anterior** (decisión `WEB-D004`). El diseño parte del
> problema. La evaluación de qué del código existente encaja y se reutiliza
> ocurre en `42_reutilizacion_del_codigo_existente_motor.md`, después de que
> este bloque esté cerrado.

---

## 1. Qué tiene que lograr el motor

Un usuario debe poder operar Manzana entera hablando. No como atajo, sino
como forma completa de usar el producto:

```text
"gasté 40 en el súper"
"¿cuánto llevo en comida este mes?"
"el taxi de ayer fueron 18, no 15"
"reclasifica todos mis Rappi a Comida"
"¿puedo permitirme unas zapatillas de 300?"
"pónme presupuestos según lo que gasté los últimos 3 meses"
"¿por qué dices que me quedan 170?"
```

Las tres últimas son las que separan un asistente real de un intérprete de
comandos: una toca cientos de registros, otra razona sobre el futuro con
compromisos reales, y la última exige que el sistema pueda explicarse.

## 2. Las siete decisiones que definen este motor

Tomadas explícitamente. Cada una condiciona la arquitectura.

| # | Decisión | Consecuencia arquitectónica |
|---|---|---|
| 1 | El asistente puede hacer **todo** lo que la app permite, más operaciones compuestas que la interfaz no ofrece | El catálogo de comandos debe cubrir el 100% del producto |
| 2 | Responde, ofrece el siguiente paso y **señala lo que nota** | Hace falta una fuente de hallazgos separada del turno |
| 3 | Las respuestas llevan **elementos interactivos y pueden conducir la app** | La salida no es texto: es una estructura de bloques |
| 4 | Es una **capa** disponible en toda la app y puede reemplazar la navegación | El contexto de pantalla es una entrada más del turno |
| 5 | Las operaciones masivas se **previsualizan con muestra** y se pueden deshacer enteras | Existe un tipo de operación distinto del comando simple |
| 6 | Los hallazgos vienen de **motores determinísticos** y, marcadas aparte, de **observaciones del modelo** | Dos niveles de certeza, visualmente distintos |
| 7 | Ante ambigüedad **pregunta**, con opciones **derivadas de los datos reales del usuario** | La desambiguación consulta antes de preguntar |

Y cuatro límites duros, que ninguna implementación puede relajar:

- Nunca elimina la cuenta ni borra todos los datos.
- Nunca ejecuta nada sin confirmación del usuario.
- Nunca afirma una cifra que no pueda sustentar.
- Nunca da consejo financiero ni de inversión.

## 3. Forma del motor

```text
        Canal (web hoy, WhatsApp mañana)
                    │
                    ▼
        ┌───────────────────────┐
        │  Puerto de entrada    │  normaliza lo que llega
        └───────────┬───────────┘
                    ▼
        ┌───────────────────────┐
        │  Coordinador de turno │  determinístico, sin modelo
        │  · carga el contexto  │
        │  · abre el espacio    │
        │  · aplica límites     │
        └───────────┬───────────┘
                    ▼
        ┌───────────────────────┐      ┌──────────────────┐
        │  Espacio de trabajo   │◄────►│  Consultas       │
        │  del turno            │      │  (solo lectura)  │
        └───────────┬───────────┘      └──────────────────┘
                    ▼
        ┌───────────────────────┐
        │  Agente               │  UNA sesión con el modelo
        │  · entiende           │  catálogo completo
        │  · consulta           │  itera hasta poder responder
        │  · propone            │
        │  · redacta            │
        └───────────┬───────────┘
                    ▼
        ┌───────────────────────┐
        │  Verificador          │  determinístico
        │  · evidencia          │  puede rechazar la salida
        │  · límites            │
        │  · confirmabilidad    │
        └───────────┬───────────┘
                    ▼
        ┌───────────────────────┐
        │  Salida en bloques    │  neutral de canal
        └───────────┬───────────┘
                    ▼
              Presentador del canal
                    │
      ── el usuario confirma ──►  Core financiero
```

La regla que ordena todo: **el modelo entiende y propone; el código
determinístico consulta, verifica y ejecuta.**

## 4. Coordinador de turno

Determinístico. No llama al modelo. Hace cinco cosas antes de que el agente
entre en acción:

1. **Reconoce el turno.** Le asigna identificador y `trace_id`.
2. **Carga el contexto**: el hilo actual, el resumen de conversaciones
   anteriores, lo aprendido sobre el usuario, y el contexto de pantalla que
   envió el canal.
3. **Resuelve lo pendiente.** Si el turno anterior dejó una pregunta abierta
   o una acción propuesta sin confirmar, lo pone en el espacio de trabajo
   antes de nada.
4. **Aplica límites de uso** (`14_contratos_api_web.md` §8).
5. **Abre el espacio de trabajo** y se lo entrega al agente.

Por qué es determinístico: el estado de la conversación es demasiado
importante para dejarlo a la interpretación. Si el usuario dice "sí" hay que
saber a qué está diciendo que sí, y eso lo sabe el coordinador porque lo
guardó, no el modelo porque lo dedujo.

## 5. Espacio de trabajo del turno

La estructura que viaja por todo el turno. Es la memoria de trabajo
explícita: si algo no está aquí, no existe para el turno.

```text
espacio_de_trabajo {
  entrada          lo que llegó del canal
  contexto_pantalla  qué mira el usuario ahora
  hilo             mensajes anteriores de esta conversación
  memoria          resumen de conversaciones previas + lo aprendido

  foco {                      qué son "esos", "los 5", "eso"
    tipo                      movimientos | deudas | pagos | presupuestos…
    referencias               identificadores en orden
    de_dónde_salió            qué consulta lo produjo
    filtros                   los que se aplicaron
    vigente_hasta             cuándo caduca
  }

  huecos [ {                  lo que falta para poder actuar
    campo
    procedencia               dicho | heredado | consultado | supuesto
    opciones                  derivadas de los datos del usuario
  } ]

  consultado [ ]              resultados con su referencia de origen
  afirmaciones [ ]            lo que se va a decir, con su evidencia
  propuesta                   la acción o el plan a confirmar
}
```

Tres campos merecen explicación, porque son los que evitan los errores más
caros:

**`foco`** — cuando el usuario dice "de esos, ¿cuáles fueron el fin de
semana?", el motor tiene que saber qué son "esos" **con exactitud**, no por
aproximación. El foco guarda la lista concreta de identificadores y de qué
consulta salieron. Si el foco tiene 5 elementos y el usuario dice "los 5",
coinciden. Si tiene 4, el motor lo dice en vez de inventar el quinto.

**`huecos[].procedencia`** — distingue lo que el usuario dijo de lo que el
motor supuso. Un dato supuesto nunca se presenta como dicho. Cuando el
usuario escribe "gasté 40" y el motor asigna la cuenta por defecto, la
cuenta es `supuesto` y debe ser visiblemente editable.

**`afirmaciones[].evidencia`** — toda frase con una cifra apunta a lo que la
sustenta. Es lo que hace verificable el límite de "nunca afirmar una cifra
que no puedas sustentar" (`22_grounding_evidencia_y_politica.md`).

## 6. El agente

**Una sola sesión con el modelo, con el catálogo completo de capacidades.**

Dentro de esa sesión puede: entender qué quiere el usuario, resolver a qué
se refiere, pedir los datos que necesite, decidir si falta algo, componer
una propuesta de acción y redactar la respuesta. No hay entregas entre
modelos ni reinterpretaciones sucesivas: **una autoridad semántica por
turno.**

Por qué el catálogo completo y no filtrado: un catálogo estable se cachea, y
el costo de tenerlo entero es predecible y bajo. Un filtro previo que se
equivoca produce el peor fallo posible de un asistente — "no sé hacer eso"
cuando sí sabe. Preferimos pagar tokens estables antes que introducir un
punto donde el asistente pierda capacidades sin motivo.

Internamente el agente tiene responsabilidades separadas — interpretar,
resolver referencias, planificar consultas, componer la propuesta, redactar
— pero son **módulos de una misma sesión**, con salidas tipadas, no llamadas
independientes al modelo.

El agente **no escribe nada**. Su salida es una propuesta.

## 7. Consultas

> **Ampliado en `20b_capa_semantica_y_consulta_abierta.md`.** Un catálogo de
> consultas predefinidas pone un techo: el asistente responde lo previsto y
> se queda mudo en el resto. Las lecturas no son un catálogo cerrado, son un
> **vocabulario del dominio que el agente compone libremente**, con un
> escalón de cálculo aislado cuando el vocabulario no alcanza. Leer ese
> documento antes de implementar esta sección.

El agente accede a los datos solo en **modo lectura**. Dos reglas de diseño
que evitan un fallo concreto y que se conservan sea cual sea la forma de la
consulta:

1. **Toda consulta devuelve, junto al resultado, las referencias de lo que lo
   compone.** Una consulta de "cuánto gasté en comida" no devuelve solo
   `S/420.00`: devuelve el total **y** los identificadores de los movimientos
   sumados. Sin eso, el motor puede decir una cifra correcta y ser incapaz de
   mostrar de dónde sale — y en el turno siguiente, incapaz de saber a qué se
   refiere el usuario cuando dice "esos".
2. **Toda consulta declara su alcance temporal y sus filtros en la
   respuesta.** Así el motor sabe si el "este mes" que usó lo dijo el usuario
   o lo puso él.

La identidad del usuario la inyecta el compilador de consultas, nunca el
agente: no existe forma de expresar en el lenguaje una consulta sobre datos
ajenos.

## 8. Comandos

Las escrituras son comandos, no consultas. El agente **propone**; el usuario
confirma; el Core ejecuta.

Tres clases, con tratamiento distinto:

| Clase | Qué es | Cómo se confirma |
|---|---|---|
| **Simple** | Una operación sobre un elemento: registrar, corregir, marcar pagado | Tarjeta con los datos, editable |
| **Compuesta** | Varias operaciones pedidas juntas | Una tarjeta con todas; **una sola confirmación**, salvo que alguna sea de riesgo alto, que se separa |
| **Masiva** | Una operación sobre un conjunto grande: reclasificar, cerrar deudas saldadas, generar presupuestos | Previsualización con el conteo, una muestra de ejemplos reales, posibilidad de excluir, y **deshacer completo** tras ejecutar |

Las masivas son la parte peligrosa del alcance elegido. Su contrato:

```text
1. El agente propone la operación con su criterio de selección
2. El sistema resuelve el conjunto real y devuelve conteo + muestra
3. El usuario ve cuántos, ve ejemplos concretos, puede excluir
4. Confirma
5. El Core ejecuta en lote, con un identificador de lote
6. Queda deshacer completo por lote
```

El paso 2 lo hace código determinístico, no el modelo: **quién entra en el
conjunto lo decide una consulta, no una estimación.**

## 9. Verificador

Determinístico, entre el agente y el usuario. Puede rechazar la salida del
modelo. Comprueba:

| Comprobación | Qué rechaza |
|---|---|
| Evidencia | Una cifra sin referencias que la sustenten |
| Coherencia de foco | Decir "los 5" cuando el foco tiene 4 |
| Procedencia | Un filtro temporal que nadie pidió, presentado como si el usuario lo hubiera dicho |
| Confirmabilidad | Una propuesta que no se puede ejecutar realmente |
| Límites | Consejo financiero, eliminación de cuenta, ejecución sin confirmación |
| Honestidad de estado | Decir "registrado" antes de que el Core lo confirme |

Si rechaza, el turno no falla en silencio: el usuario recibe una respuesta
honesta ("no puedo darte esa cifra con los datos que tengo") y el rechazo
queda registrado como defecto a investigar.

La cuarta fila es la que evita un fallo específico y grave: **proponer algo
que no se puede confirmar.** Antes de mostrar una tarjeta de confirmación,
el verificador comprueba que existe un comando real capaz de ejecutarla. Una
propuesta que no se puede ejecutar es peor que no proponer nada.

## 10. Hallazgos

El asistente señala lo que nota. Vienen de dos fuentes, y **nunca se
mezclan**:

| Fuente | Qué produce | Cómo se presenta |
|---|---|---|
| **Motores determinísticos** | Duplicado detectado, presupuesto en riesgo, cuota que vence, anomalía de gasto, dato incompleto | Afirmación, con evidencia y acción disponible |
| **Observación del modelo** | Patrones cualitativos que nota al leer los datos consultados | Marcada como impresión, visualmente distinta, con opción de comprobar |

**Regla dura que resuelve la tensión entre ambas:** una observación del
modelo puede señalar un patrón cualitativo ("parece que sales más los
viernes"), pero **cualquier cifra que aparezca en ella tiene que venir de
datos realmente consultados en ese turno**. Una impresión sin cifra es una
impresión; una impresión con cifra inventada es un defecto que el
verificador rechaza.

Los hallazgos determinísticos los calculan los motores del dominio, no el
agente. El agente solo decide **si vale la pena mencionarlo ahora** y cómo
redactarlo. Nunca los produce, así que no puede inventarlos.

Límite de volumen: máximo un hallazgo por turno. Un asistente que comenta
tres cosas cada vez deja de acompañar y empieza a interrumpir.

## 11. Ambigüedad

Ante una ambigüedad real, el asistente **pregunta**. Y la pregunta se
construye con los datos del usuario, no con un menú fijo.

```text
Usuario: "le di 50 a Luis"

Con una deuda registrada con Luis:
  ¿Fue un gasto, un préstamo, o el pago de lo que le debes?

Sin ninguna deuda ni préstamo con Luis:
  ¿Fue un gasto o un préstamo?

Con Luis desconocido para el sistema:
  ¿Fue un gasto o le prestaste? Si quieres, lo anoto como préstamo
  y le hago seguimiento.
```

Preguntar por un "pago de deuda" a alguien que no tiene deudas registradas
es ruido, y hace que el asistente parezca un formulario en vez de alguien
que conoce tu situación. **La desambiguación consulta antes de preguntar.**

Reglas:

- **Una sola pregunta por turno.** Si faltan dos datos, se pregunta el que
  bloquea; el otro se propone con procedencia `supuesto` y editable.
- Las opciones salen de los datos reales: personas conocidas, deudas
  abiertas, cuentas existentes, categorías que el usuario ya usa.
- La pregunta ofrece las opciones como elementos elegibles, no solo como
  texto: en la web se pulsa, en WhatsApp se responde.
- Si el usuario cambia de tema, la pregunta pendiente no se pierde ni
  bloquea: se retoma o se descarta explícitamente.
- No se pregunta lo que se puede consultar. Si hay una sola cuenta, no se
  pregunta desde qué cuenta.

## 12. Memoria

> **Ampliado en `20c_perfil_del_usuario_y_voz.md`.** Las tres capas de abajo
> guardan lo que pasó con el dinero, pero no a la persona — y sin la persona,
> dos usuarios con los mismos movimientos reciben la misma conversación. El
> perfil añade cuatro capas: cómo escribe, su contexto de vida, su relación
> con el dinero, y el hilo de la relación.

Tres capas de memoria conversacional, con controles distintos:

| Capa | Qué guarda | Vigencia | Control del usuario |
|---|---|---|---|
| **Hilo** | Todos los mensajes de la conversación actual | La conversación | Puede borrar el hilo |
| **Resúmenes** | De qué trató cada conversación anterior | Configurable | Puede verlos y borrarlos individualmente |
| **Aprendido** | Cómo clasifica sus comercios, sus hábitos, sus preferencias | Hasta que se contradiga o expire | Ver, corregir, deshacer, olvidar |

El resumen de conversaciones anteriores da continuidad real ("lo que vimos
la semana pasada") y por eso mismo es la capa con más superficie de
privacidad. Tres salvaguardas:

1. El resumen guarda **de qué se habló, no lo que se dijo**. Temas y
   conclusiones, no transcripción.
2. Es visible y borrable por conversación, desde
   `/configuracion/memoria`.
3. No se genera con datos sensibles al detalle: guarda "revisó sus gastos de
   salud", no el detalle de esos gastos.

La capa **aprendido** vive en `36_modulo_memoria_y_aprendizaje.md`, que es
su documento propio.

## 13. Contexto de pantalla

Cuando el usuario tiene Movimientos abierto filtrado por julio y comida, y
pregunta "¿cuánto es esto?", el asistente debe saber a qué se refiere.

El canal envía el contexto como **una entrada más del turno**, no como una
excepción del núcleo:

```text
contexto_pantalla {
  dónde              qué sección está abierta
  filtros            los que están aplicados
  seleccionado       el elemento abierto, si hay uno
  visible            las referencias que el usuario tiene delante
}
```

`visible` es lo que permite que "esto" funcione: si el usuario ve 12
movimientos filtrados, "esto" son esos 12, no una interpretación.

WhatsApp enviará su propio contexto, más pobre (el último mensaje, el último
elemento mencionado), y el núcleo no notará la diferencia porque la
estructura es la misma.

## 14. Conducir la app

El asistente puede llevar al usuario a donde ocurre la acción. Se expresa
como **intención, no como instrucción de interfaz**:

```text
El motor emite:      mostrar { qué: movimientos, filtros: {mes: julio, categoría: comida} }
La web lo traduce:   navegar a /movimientos?desde=…&categoria=comida
WhatsApp lo traduce: listar los resultados, o enviar un enlace
```

El núcleo nunca dice "navega a esta ruta". Dice qué quiere mostrar. Cada
canal decide cómo. Es lo que hace que WhatsApp sea después un adaptador y no
una reimplementación (`21_contrato_de_canal_y_presentadores.md`).

## 15. Degradación

Cuando el modelo no está disponible o falla, el asistente **lo dice y ofrece
la vía manual concreta**:

```text
No puedo ayudarte con eso ahora mismo.
Puedes registrarlo directamente:  [Nuevo movimiento]
```

Nunca se oculta, nunca inventa una respuesta, y nunca deja al usuario sin
salida. El resto de la app funciona completa. El detalle de modos y
umbrales vive en `23_runtime_ia_modos_costo_y_degradacion.md`.

## 16. Lo que este motor deliberadamente no hace

- **No decide interrumpir al usuario.** Los recordatorios proactivos son de
  otro sistema, con su propia política (`37_modulo_recordatorios_in_app.md`).
- **No calcula dinero.** Los saldos, proyecciones y avances los calculan
  motores determinísticos. El agente pregunta y explica.
- **No escribe.** Propone.
- **No decide qué es un hallazgo.** Elige si mencionar uno ya calculado.
- **No guarda su razonamiento interno.** Guarda bloques de respuesta y
  referencias de evidencia.

## 17. Criterios de aceptación

- `AC-MOTOR-01` — Un turno consume **una sola sesión** con el modelo, con las
  consultas que necesite dentro de ella. Evidencia: `TEST`.
- `AC-MOTOR-02` — Toda cifra de una respuesta tiene referencias que la
  sustentan; sin ellas, la respuesta no se emite. Evidencia: `TEST`.
- `AC-MOTOR-03` — Si el foco tiene N elementos, el motor nunca afirma un
  número distinto de N al referirse a ellos. Evidencia: `TEST`.
- `AC-MOTOR-04` — Ninguna propuesta llega al usuario sin que exista un
  comando real capaz de ejecutarla. Evidencia: `TEST`.
- `AC-MOTOR-05` — El agente no puede escribir en la base de datos por
  ninguna vía. Evidencia: `TEST`.
- `AC-MOTOR-06` — Las opciones de una pregunta de desambiguación provienen de
  los datos reales del usuario. Evidencia: `TEST` + `USER`.
- `AC-MOTOR-07` — Una operación masiva muestra conteo y muestra real antes de
  ejecutarse, y se puede deshacer entera. Evidencia: `TEST` + `USER`.
- `AC-MOTOR-08` — Una observación del modelo nunca contiene una cifra que no
  provenga de datos consultados en ese turno. Evidencia: `TEST`.
- `AC-MOTOR-09` — Como máximo un hallazgo por turno. Evidencia: `TEST`.
- `AC-MOTOR-10` — Cualquier cosa que se pueda hacer en la interfaz se puede
  pedir hablando. Evidencia: `TEST` (cobertura del catálogo) + `USER`.
- `AC-MOTOR-11` — El motor no contiene ninguna referencia a un canal
  concreto fuera del puerto y los presentadores. Evidencia: `TEST`.
- `AC-MOTOR-12` — Ningún texto afirma que algo se registró antes de que el
  Core lo confirme. Evidencia: `TEST`.
