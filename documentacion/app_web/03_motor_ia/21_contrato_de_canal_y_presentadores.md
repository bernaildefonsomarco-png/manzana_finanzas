# 21 — Contrato de canal y presentadores

**Bloque:** 03 — Motor IA
**Estado:** V1
**Fecha:** 25 de julio de 2026
**Depende de:** `20_arquitectura_motor_conversacional.md`
**Documentos que dependen de este:** `41_asistente_ia_en_la_app.md`, `56_puente_a_fase_whatsapp.md`, `16_design_system_web.md`

---

## 1. El compromiso

Cuando WhatsApp entre como canal, **no se reescribe el motor**. Se
implementa un puerto de entrada y un presentador de salida, y nada más.

Ese compromiso no se cumple con buenas intenciones: se cumple porque el
núcleo nunca sabe qué canal lo está atendiendo. Si en el agente, en el
verificador o en las consultas aparece la palabra "web" o "whatsapp", el
diseño falló.

## 2. Por qué el canal no puede ser un parámetro

La tentación es escribir `if (canal === "web")` en el sitio donde la
diferencia se nota. Es cómodo y es exactamente el error: cada condicional
así multiplica los caminos que hay que probar, y con el tiempo el
comportamiento de los dos canales se separa sin que nadie lo decida.

La alternativa: el canal **traduce**, no configura. El núcleo produce una
intención; el canal decide cómo materializarla con lo que tiene.

```text
El motor dice:        "muestra estos 12 movimientos de julio en comida"
La web lo hace:       navega y filtra la pantalla de Movimientos
WhatsApp lo hará:     lista los primeros y ofrece un enlace
Un canal futuro:      lo que pueda
```

## 3. Puerto de entrada

Todo lo que llega al motor tiene esta forma, venga de donde venga:

```text
entrada {
  actor            quién habla (siempre el usuario en V1)
  texto            lo que escribió, si escribió algo
  eleccion         qué opción eligió, si respondía a una pregunta
  confirmacion     qué propuesta confirmó o descartó
  adjuntos         archivos, si los hay
  contexto         qué está mirando (§4)
  canal            de dónde viene — solo para el registro, nunca para decidir
}
```

`canal` está para poder medir y depurar por canal, no para ramificar
comportamiento. La regla es explícita porque el campo existe y la tentación
también.

Cuatro formas de entrada, todas normalizadas igual:

| Origen | Se convierte en |
|---|---|
| El usuario escribe | `texto` |
| El usuario pulsa una opción de una pregunta | `eleccion` |
| El usuario confirma o descarta una propuesta | `confirmacion` |
| El usuario adjunta un archivo | `adjuntos` |

En la web, pulsar un botón y escribir "sí" producen la misma entrada
normalizada. En WhatsApp también. El motor no distingue.

## 4. Contexto

```text
contexto {
  dónde          qué sección tiene abierta
  filtros        los que están aplicados
  seleccionado   el elemento abierto, si hay uno
  visible        las referencias que tiene delante
}
```

Cada canal lo llena con lo que tiene:

| Campo | Web | WhatsApp |
|---|---|---|
| `dónde` | La ruta actual | La última sección mencionada, si la hubo |
| `filtros` | Los de la URL | Los del último resultado listado |
| `seleccionado` | El detalle abierto | El último elemento del que se habló |
| `visible` | Los elementos en pantalla | Los enviados en el último mensaje |

WhatsApp llena menos campos. El motor funciona igual, solo con menos
precisión al resolver "esto" — que es exactamente lo que corresponde, porque
en WhatsApp el usuario tampoco tiene nada delante.

## 5. Salida: bloques

El motor no devuelve texto. Devuelve una lista de bloques que cada canal
renderiza con lo que tiene.

| Bloque | Qué contiene | En la web | En WhatsApp |
|---|---|---|---|
| `texto` | Una frase | Párrafo | Texto del mensaje |
| `cifra` | Monto o número **con sus referencias** | Cifra destacada con enlace a su origen | Cifra, con "escribe *ver* para el detalle" |
| `lista` | Elementos con sus referencias | Filas navegables | Lista numerada |
| `pregunta` | Pregunta con opciones derivadas de los datos | Opciones pulsables | Botones o lista numerada |
| `propuesta` | Acción a confirmar, con sus campos | Tarjeta editable | Resumen con "confirmar" / "cambiar" |
| `previsualizacion` | Operación masiva: conteo, muestra, exclusiones | Tabla con casillas | Conteo + primeros ejemplos |
| `hallazgo` | Algo que se notó, con su nivel de certeza | Tarjeta con estilo según sea afirmación o impresión | Frase, con la impresión marcada como tal |
| `mostrar` | Intención de llevar al usuario a algo | Navega y filtra | Lista resultados o envía enlace |
| `accion` | Un siguiente paso ofrecido | Botón | Sugerencia de qué escribir |
| `limite` | El motor no puede o no debe responder | Aviso con la vía manual | Texto con la alternativa |

Tres reglas sobre los bloques:

1. **`cifra` sin referencias no es un bloque válido.** El verificador lo
   rechaza antes de que salga.
2. **`propuesta` sin comando ejecutable no es un bloque válido.** No se
   propone lo que no se puede hacer.
3. **`hallazgo` declara su nivel**: `afirmacion` (viene de un motor
   determinístico, con evidencia) o `impresion` (observación del modelo). El
   presentador está obligado a distinguirlos visualmente.

## 6. Qué hace un presentador

Traduce bloques a la superficie de su canal. Nada más.

**Puede:** elegir componentes, agrupar, decidir el orden visual, adaptar el
formato a su ancho, resolver cómo se ve una opción pulsable.

**No puede:** cambiar el contenido de un bloque, omitir un bloque `limite`,
inventar bloques, mostrar una `propuesta` como ya ejecutada, o presentar una
`impresion` con el mismo peso que una `afirmacion`.

El presentador web usa el catálogo de `16_design_system_web.md`; el bloque
`propuesta` se materializa en el componente `ConfirmationCard`, y el bloque
`cifra` en `EvidenceLink`. Esos dos componentes existen precisamente para
que los principios de control y procedencia tengan una forma concreta en la
interfaz.

## 7. El bloque `mostrar` en detalle

Es el que hace posible "conducir la app" sin acoplar el núcleo a las
pantallas.

```text
mostrar {
  qué        movimientos | deuda | presupuesto | pago | descubrimiento | reporte
  cuál       referencia concreta, si es un elemento
  filtros    si es un conjunto
  por qué    la frase que explica la navegación
}
```

El campo `por qué` importa: llevar al usuario a otra pantalla sin decirle
para qué es desorientador. La web navega **y** muestra la frase.

Regla de cortesía: `mostrar` nunca interrumpe un formulario abierto ni una
edición en curso. Si el usuario está en medio de algo, el bloque se ofrece
como acción en vez de ejecutarse.

## 8. La prueba de agnosticismo

Este documento no sirve de nada si no es verificable. La prueba:

> El mismo caso de uso, ejecutado por dos presentadores de prueba distintos,
> produce **el mismo espacio de trabajo, los mismos comandos y las mismas
> referencias de evidencia**. Solo difiere el renderizado.

Casos que la prueba debe cubrir:

| Caso | Qué verifica |
|---|---|
| "gasté 40 en el súper" | Registro simple con propuesta |
| "le di 50 a Luis" | Desambiguación con opciones derivadas de los datos |
| "de esos, ¿cuáles fueron el finde?" | Continuidad del foco entre turnos |
| "reclasifica mis Rappi a Comida" | Operación masiva con previsualización |
| "¿por qué dices que me quedan 170?" | Explicación con evidencia |
| "¿puedo permitirme 300?" | Proyección con supuestos declarados |
| Modelo no disponible | Bloque `limite` con vía manual |

Si esta prueba no se puede escribir, el diseño no es agnóstico y hay que
corregirlo antes de seguir. Es el criterio que impide que WhatsApp requiera
reescribir el motor.

## 9. Lo que cada canal aporta y lo que no

| Capacidad | Web | WhatsApp (fase 2) |
|---|---|---|
| Contexto de pantalla rico | Sí | Parcial |
| Confirmación con un gesto | Sí | Sí, con botones |
| Editar campos antes de confirmar | Sí, en línea | Por conversación |
| Previsualización de operación masiva | Tabla completa | Conteo y muestra |
| Conducir a otra vista | Navegación real | Enlace o listado |
| Conversación sin abrir la app | No | Sí |
| Registro sin fricción en movimiento | Parcial | Sí |

La tabla deja ver algo útil: **los canales no son redundantes, son
complementarios**, y ninguno es una versión degradada del otro. La web es
mejor para revisar, corregir y operar en lote; WhatsApp será mejor para
capturar en el momento. El motor compartido es lo que hace que ambas
experiencias sean la misma inteligencia.

## 10. Continuidad entre canales

El foco de la conversación es del usuario, no del canal
(`13_modelo_datos_web_v1.md` §6.1). Si alguien consulta algo por WhatsApp y
abre la app, puede continuar:

```text
Usuario, en WhatsApp: "¿cuánto llevo en comida?"
Usuario, luego en la app: "muéstrame esos"
→ el foco sigue vigente; la app muestra los mismos movimientos
```

Con dos salvaguardas: el foco tiene vigencia limitada (`23` §5b.1), y la continuidad
nunca expone en un canal algo que el modo discreto oculta en el otro.

## 11. Criterios de aceptación

- `AC-CANAL-01` — La prueba de agnosticismo de §8 pasa para los siete casos.
  Evidencia: `TEST`.
- `AC-CANAL-02` — Ni el agente ni el verificador ni las consultas contienen
  referencias a un canal concreto. Evidencia: `TEST`. Clase: `lint`.
- `AC-CANAL-03` — Un bloque `cifra` sin referencias no llega a ningún
  presentador. Evidencia: `TEST`.
- `AC-CANAL-04` — Un bloque `propuesta` sin comando ejecutable no llega a
  ningún presentador. Evidencia: `TEST`.
- `AC-CANAL-05` — Ningún presentador puede omitir un bloque `limite`.
  Evidencia: `TEST`.
- `AC-CANAL-06` — Una `impresion` se distingue visualmente de una
  `afirmacion`. Evidencia: `TEST` + `USER`.
- `AC-CANAL-07` — Pulsar una opción y escribir su texto producen la misma
  entrada normalizada. Evidencia: `TEST`.
- `AC-CANAL-08` — `mostrar` no interrumpe un formulario abierto.
  Evidencia: `TEST`.
- `AC-CANAL-09` — Un foco abierto en un canal se puede retomar en el otro
  dentro de su vigencia. Evidencia: `TEST`.
