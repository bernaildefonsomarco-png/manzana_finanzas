# 22 — Evidencia, procedencia y política

**Bloque:** 03 — Motor IA
**Estado:** V1
**Fecha:** 25 de julio de 2026
**Depende de:** `20_arquitectura_motor_conversacional.md`, `08_principios_experiencia_web.md`
**Documentos que dependen de este:** `40`, `41`, `42`, §14 de todos los módulos

---

## 1. Qué protege este documento

Un asistente que puede operar todo el producto tiene poder real sobre el
dinero de una persona. Las reglas de abajo son las que hacen que ese poder
sea seguro, y son **invariantes**: si una implementación no las cumple, está
mal aunque funcione.

Tres afirmaciones que el sistema debe poder sostener siempre:

1. Todo lo que digo sobre tu dinero puedo mostrártelo.
2. Nada que toque tu dinero ocurre sin que lo apruebes.
3. Cuando no sé algo, te lo digo.

## 2. Invariante de evidencia

> **Ninguna cifra sale sin las referencias de lo que la compone.**

No es una recomendación de calidad: es una condición de emisión. El
verificador rechaza la respuesta que la incumple.

| Tipo de afirmación | Qué debe acompañarla |
|---|---|
| Un total | Los identificadores de los elementos sumados |
| Un saldo | La cuenta o cuentas, y el momento de cálculo |
| Una comparación | Los dos conjuntos comparados |
| Una proyección | Los datos base **y los supuestos** |
| Una clasificación | Por qué se clasificó así |
| Un conteo | Los identificadores contados |

Consecuencia práctica: cada consulta devuelve resultado **y** referencias
(`20_arquitectura_motor_conversacional.md` §7). Una consulta que solo
devuelve un número deja al motor sin poder responder "¿de dónde sale eso?",
y por tanto sin poder emitir la cifra.

### 2.0 Evidencia en las tres capas de conocimiento

`20b_capa_semantica_y_consulta_abierta.md` da al motor tres formas de saber
algo: el panorama cargado, la consulta abierta y el cálculo aislado. El
invariante de evidencia **no se relaja en ninguna**; se sostiene con cuatro
reglas:

1. **El panorama lleva referencias.** Cada cifra de la situación actual y
   cada patrón calculado apunta a los movimientos que lo componen
   (`20b` §4.3). Que el motor "ya lo supiera" no lo exime de poder mostrarlo.
2. **La consulta devuelve referencias por construcción.** No es una opción
   del agente: la forma de la respuesta las incluye siempre.
3. **El cálculo aislado hereda las referencias de sus datos de entrada.**
   Como solo opera sobre lo que el panorama o la consulta ya trajeron, la
   cadena de procedencia no se rompe.
4. **Un resultado calculado que falla una comprobación de sanidad no se
   emite.** Una suma parcial que supera su total, un porcentaje fuera de
   rango o un valor no numérico son defectos, no respuestas.

La primera regla es la menos obvia y la más fácil de olvidar al implementar:
una cifra que viene precargada se siente como un hecho dado, y sigue
necesitando poder responder "¿de dónde sale?".

Además, todo resultado de cálculo aislado debe poder explicar **su
procedimiento** en lenguaje del usuario ("tomé tus movimientos de los
últimos 3 meses, los agrupé por semana y comparé las que tienen feriado
contra las demás"). Una cifra que no puede explicar cómo se obtuvo está en
la misma situación que una cifra sin referencias: no se emite.

### 2.1 Qué pasa cuando no hay evidencia

El motor dice que no puede, y ofrece la vía que sí funciona:

```text
Correcto:   No puedo darte esa cifra con los datos que tengo.
            Te faltan saldos en dos cuentas. [Completar saldos]

Incorrecto: Tienes aproximadamente S/200 libres.
```

Es preferible una respuesta corta a una cifra que no se sostiene. En dinero,
una estimación presentada con seguridad es más dañina que un "no sé".

## 3. Procedencia

Todo dato que el motor usa lleva de dónde vino:

| Procedencia | Significado | Cómo se presenta |
|---|---|---|
| `dicho` | El usuario lo dijo en este turno | Como un hecho |
| `heredado` | Viene de un turno anterior de la conversación | Como contexto, recordable |
| `consultado` | Salió de una consulta a los datos | Con su referencia |
| `supuesto` | Lo puso el motor por defecto | **Visiblemente editable** |

La fila `supuesto` es la que evita el error más silencioso: el motor asigna
la cuenta por defecto, el usuario no se fija, y el saldo equivocado se
descubre semanas después. Un dato supuesto nunca se presenta como dicho.

### 3.1 Filtros temporales

Caso específico porque es donde más fácil se cuela una suposición
indetectable. Si el usuario pregunta "¿cuánto gasté en comida?" sin decir
cuándo, el motor elige un periodo. Ese periodo es `supuesto` y **se dice en
la respuesta**:

```text
Correcto:   Este mes llevas S/420 en comida.
Incorrecto: Llevas S/420 en comida.
```

Un rango que nadie pidió, presentado sin declararlo, produce respuestas
correctas a preguntas distintas de la que se hizo.

## 4. El foco

Cuando el usuario dice "esos", "los 5", "el primero", el motor tiene que
saberlo con exactitud.

```text
foco {
  tipo              qué clase de elementos son
  referencias       la lista concreta, en orden
  de_dónde_salió    qué consulta la produjo
  filtros           los que se aplicaron
  vigente_hasta     cuándo caduca        (valores en 23 §5b.1)
}
```

Reglas:

1. **Solo una consulta puede establecer el foco.** Un turno que no consulta
   no cambia el foco: lo hereda o lo pierde, nunca lo inventa.
2. **Si el foco tiene N elementos, "los N" son exactamente esos.** Si el
   usuario dice un número distinto, el motor lo dice en vez de rellenar:
   *"tengo 4 movimientos de esa consulta, no 5. ¿Amplío la búsqueda?"*
3. **El foco caduca** (valores en `23` §5b.1). Pasado su tiempo o cambiado el tema, "esos" ya no
   resuelve y el motor pregunta a qué se refiere.
4. **El foco es del usuario, no del canal**, y se puede retomar desde otro
   canal dentro de su vigencia.

Sin la regla 1, un turno intermedio deja el foco vacío y el siguiente
"esos" se resuelve con lo que haya a mano — que es como se acaba incluyendo
un movimiento que no era y omitiendo uno que sí.

## 5. Reparar la respuesta ≠ corregir el dinero

Dos intenciones que suenan igual y tienen consecuencias opuestas.

| El usuario dice | Quiere | Qué ocurre |
|---|---|---|
| "ese taxi no es alimentación" | Que el sistema corrija cómo agrupó o explicó algo | Se corrige la respuesta y, si aplica, la clasificación. **Ningún saldo cambia.** |
| "el taxi fueron 18, no 15" | Corregir un hecho financiero | Comando de corrección al Core, recálculo de saldos, registro en el historial |

Son **dos caminos distintos**, con permisos y registros distintos. Nunca
comparten ejecución.

Ante duda, el motor pregunta una vez con las dos opciones explícitas:

```text
¿Quieres que corrija cómo lo agrupé, o que cambie el movimiento?
```

Confundirlas produce dos fallos, ambos graves: tratar una queja sobre el
fraseo como corrección financiera altera dinero que estaba bien; tratar una
corrección financiera como ajuste de respuesta deja el dato mal para
siempre.

## 6. Confirmabilidad

> **No se propone lo que no se puede ejecutar.**

Antes de que una propuesta llegue al usuario, el verificador comprueba que
existe un comando real capaz de llevarla a cabo con los datos disponibles.

| Comprobación |
|---|
| Existe un comando para esa operación |
| Están todos los campos que el comando exige |
| El usuario tiene permiso |
| Las precondiciones se cumplen (la deuda existe, la cuenta existe, la cuota está abierta) |
| El comando es idempotente y tiene su clave |

Si algo falta, no se muestra una tarjeta de confirmación: se pregunta lo que
falta o se explica por qué no se puede.

Una propuesta que el usuario confirma y luego falla es peor que no haberla
ofrecido: rompe la confianza en todas las siguientes.

## 7. Confirmación

Ninguna escritura ocurre sin aprobación explícita. Sin excepciones, ni para
acciones pequeñas ni repetitivas.

| Clase | Confirmación |
|---|---|
| Simple | Tarjeta con los datos, campos editables, botón que nombra la acción |
| Compuesta | Todas las acciones visibles, una sola confirmación |
| Compuesta con alguna de riesgo | La de riesgo se separa y se confirma aparte |
| Masiva | Conteo real, muestra de ejemplos, posibilidad de excluir, y deshacer completo |

Reglas transversales:

- El botón nombra la acción ("Registrar gasto", "Reclasificar 200
  movimientos"), nunca dice solo "Aceptar".
- El texto no afirma que algo ocurrió antes de que el Core lo confirme.
- Una propuesta sin confirmar caduca (`23` §5b.1); al caducar se dice, no se ejecuta.
- Descartar una propuesta no requiere justificación.

### 7.1 Operaciones masivas

El conjunto afectado lo resuelve **una consulta determinística, no una
estimación del modelo**:

```text
1. El agente propone el criterio            "los Rappi sin categoría"
2. El sistema resuelve el conjunto real     → 187 movimientos
3. Se muestra conteo + 5 ejemplos reales + opción de excluir
4. El usuario confirma
5. El Core ejecuta en lote con identificador de lote
6. Queda deshacer completo
```

El paso 2 es la salvaguarda: el usuario ve **cuántos son de verdad**, no
cuántos cree el modelo que son.

## 8. Los cuatro límites duros

Ninguna implementación puede relajarlos, ni con permiso del usuario.

| Límite | Por qué |
|---|---|
| **No elimina la cuenta ni borra todos los datos** | Irreversible y sobre la existencia misma de la cuenta. Se pide por interfaz, con sus salvaguardas propias. |
| **No ejecuta nada sin confirmación** | El control es del usuario. Automatizar la confirmación sería quitarle exactamente lo que este diseño protege. |
| **No afirma cifras que no pueda sustentar** | En dinero, una cifra segura y equivocada destruye más confianza que un "no sé". |
| **No da consejo financiero ni de inversión** | Puede explicar qué pasó con tu dinero y proyectar con tus datos. No recomienda qué hacer con él, ni productos, ni bancos, ni inversiones. |

Sobre el cuarto, la frontera práctica:

```text
Permitido:  A este ritmo terminarías el mes con S/180 libres.
Permitido:  Tu gasto en delivery subió S/120 frente al mes pasado.
Permitido:  Con lo que tienes, comprarlo te dejaría S/70 libres.

Prohibido:  Deberías reducir tu gasto en delivery.
Prohibido:  Te conviene pagar primero la deuda del banco.
Prohibido:  Con ese dinero podrías invertir en...
```

La diferencia: describir la situación y sus consecuencias aritméticas es
información; decir qué debería hacer la persona con su dinero es consejo.

## 9. Hallazgos y sus dos niveles

| Nivel | Origen | Requisito |
|---|---|---|
| `afirmacion` | Motor determinístico | Evidencia obligatoria; acción disponible cuando la haya |
| `impresion` | Observación del modelo | Marcada como tal; **toda cifra que contenga debe venir de datos consultados en ese turno** |

Una impresión sin cifra es legítima ("parece que sales más los viernes").
Una impresión con una cifra que no se consultó es un defecto que el
verificador rechaza.

El agente **no produce** hallazgos determinísticos: los calculan los motores
del dominio. Solo decide si mencionar uno y cómo redactarlo. No puede
inventar lo que no genera.

Máximo un hallazgo por turno.

## 10. Privacidad en el turno

- El agente recibe solo lo que el turno necesita, no el historial completo.
- Con modo discreto activo, la salida omite montos, comercios, personas y
  bancos, salvo dentro de un detalle que el usuario abrió deliberadamente.
- No se registra el contenido de la conversación en los registros técnicos:
  solo identificadores (`19_observabilidad_y_telemetria_web.md` §4.1).
- No se guarda el razonamiento interno del modelo. Se guardan bloques de
  respuesta y referencias de evidencia.
- El usuario puede borrar hilos y resúmenes desde `/configuracion/memoria`.

## 11. Qué hace el verificador

Determinístico, entre el agente y el usuario, con autoridad para rechazar:

| Comprueba | Rechaza |
|---|---|
| Evidencia | Cifra sin referencias |
| Foco | "Los 5" cuando el foco tiene 4 |
| Procedencia | Filtro supuesto presentado como dicho |
| Confirmabilidad | Propuesta sin comando ejecutable |
| Límites | Consejo financiero, eliminación de cuenta, ejecución sin confirmación |
| Honestidad | "Registrado" antes de que el Core confirme |
| Hallazgos | Impresión con cifra no consultada; más de un hallazgo |
| Modo discreto | Dato sensible en una salida que debía ser discreta |
| Sanidad del cálculo | Resultado calculado que no supera las comprobaciones de `20b` §6.3 |
| Explicabilidad del cálculo | Resultado de cálculo aislado que no puede describir su procedimiento |

Cuando rechaza, el usuario recibe una respuesta honesta y el rechazo se
registra como defecto a investigar — no como funcionamiento normal. Un
verificador que rechaza a menudo indica un problema en el agente, y esa
señal debe ser visible.

## 12. Criterios de aceptación

- `AC-EVID-01` — Ninguna cifra se emite sin referencias que la sustenten.
  Evidencia: `TEST`. Ya cerraba antes de `W-16` para claims del agente
  (`claim_without_known_evidence`); cierra en `W-16` fase 4 además para la
  consulta abierta (`AC-SEM-05`).
- `AC-EVID-02` — Todo filtro temporal supuesto se declara en la respuesta.
  Evidencia: `TEST` + `USER`. No tocado por `W-16`: no hay código que marque
  un rango de fechas como `supuesto` en la respuesta.
- `AC-EVID-03` — Un dato supuesto nunca se presenta como dicho por el
  usuario. Evidencia: `TEST`. No tocado por `W-16`: la procedencia
  `dicho`/`heredado`/`consultado`/`supuesto` de `§3` no tiene representación
  en `ConversationalExecutiveOutput` — ningún campo distingue las cuatro.
- `AC-EVID-04` — Un turno sin consulta no establece foco nuevo.
  Evidencia: `TEST`. No tocado por `W-16` en esta fase; es responsabilidad de
  `buildConversationFocusSet` (anterior a este corte).
- `AC-EVID-05` — Si el foco tiene N elementos, el motor no afirma otro
  número al referirse a ellos. Evidencia: `TEST`. No cierra — mismo hueco que
  `AC-MOTOR-03`: nada compara un número afirmado en el texto contra
  `ordered_ids.length`.
- `AC-EVID-06` — Reparar respuesta y corregir dinero son caminos distintos,
  con registros distintos. Evidencia: `TEST`. No tocado por `W-16`.
- `AC-EVID-07` — Ninguna propuesta se muestra sin comando ejecutable
  verificado. Evidencia: `TEST`. Cierra en `W-16` fase 3 la comprobación de
  catálogo (`command_outside_catalog`, `WEB-D256`). No cierra completo: el
  resto de `22` §6 (campos exigidos, permisos, precondiciones, idempotencia)
  no se verifica en código.
- `AC-EVID-08` — Ninguna escritura ocurre sin confirmación explícita.
  Evidencia: `TEST`. No tocado por `W-16`; es responsabilidad del flujo de
  confirmación del Core (anterior a este corte).
- `AC-EVID-09` — El conjunto de una operación masiva lo resuelve una
  consulta, no una estimación. Evidencia: `TEST`. No tocado por `W-16` —
  mismo hueco que `AC-MOTOR-07`.
- `AC-EVID-10` — El motor no emite consejo financiero ni de inversión.
  Evidencia: `TEST` + `USER`. No tocado por `W-16`: es comportamiento del
  modelo en el turno, sin verificador estructural que lo detecte.
- `AC-EVID-11` — Una impresión no contiene cifras no consultadas en el turno.
  Evidencia: `TEST`. Cierra en `W-16` fase 3: `world_knowledge_promoted`
  (`WEB-D256`), mismo mecanismo que `AC-MOTOR-08`.
- `AC-EVID-12` — Los rechazos del verificador se registran como defectos y
  son visibles. Evidencia: `LIVE`. No tocado por `W-16`: los rechazos existen
  (`compilation.issues`) pero no hay un tablero o alerta que los muestre como
  defectos a investigar.
