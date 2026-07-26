# 20c — Perfil del usuario y voz

**Bloque:** 03 — Motor IA
**Estado:** V1
**Fecha:** 25 de julio de 2026
**Depende de:** `20_arquitectura_motor_conversacional.md`, `20b_capa_semantica_y_consulta_abierta.md`
**Documentos que dependen de este:** `36_modulo_memoria_y_aprendizaje.md`, `41`, `45`
**Amplía:** la §12 del documento 20, que trataba la memoria solo como historial

---

## 1. El problema que resuelve

El documento 20 definió la memoria como hilo, resúmenes y aprendizaje sobre
los datos financieros. Con eso, el asistente recuerda **lo que pasó con el
dinero** pero no sabe nada **de la persona**. Y sin la persona, dos usuarios
con los mismos movimientos reciben exactamente la misma conversación.

La diferencia se ve enseguida:

```text
Sin perfil:
  Usuario: "este mes fatal"
  → Tu gasto de julio fue S/2,340, un 12% más que junio.

Con perfil:
  (sabe que le pagan quincenal, que el dinero le genera ansiedad,
   y que escribe corto)
  Usuario: "este mes fatal"
  → Subió S/250, casi todo en la primera quincena.
    Lo de siempre: la semana que cobras.
    ¿Miramos esa semana?
```

Mismos datos. La segunda entiende a quién le habla.

## 2. Las cuatro capas del perfil

Separadas porque tienen ritmos de cambio, usos y controles distintos.

| Capa | Qué guarda | Cambia | Para qué sirve |
|---|---|---|---|
| **Estilo** | Cómo escribe y cómo quiere que le hablen | Lento | Ajustar el registro de cada respuesta |
| **Vida** | Su contexto financiero real | Ocasional | Interpretar correctamente sus movimientos |
| **Vínculo** | Su relación con el dinero | Muy lento | Elegir el tono y la profundidad |
| **Hilo** | De qué hablaron y qué quedó abierto | Cada conversación | Retomar con continuidad |

### 2.1 Estilo

| Rasgo | Valores |
|---|---|
| Longitud | Escribe corto · normal · largo |
| Registro | Informal · neutro · formal |
| Trato | Tuteo · usted |
| Emojis | Usa · no usa |
| Detalle esperado | Directo · con contexto · explicado |
| Vocabulario | Términos que usa: *yape*, *plin*, *chibolo*, *luca*, *pe* |
| Conocimiento financiero | Básico · medio · alto |
| Ritmo | Mensajes sueltos y fragmentados · mensajes completos |

El último rasgo importa más de lo que parece. Mucha gente escribe así:

```text
"gaste 20"
"en taxi"
"ayer"
```

Tres mensajes, un movimiento. Un motor que trata cada mensaje como un turno
independiente pregunta tres veces y frustra. El rasgo `ritmo` le dice al
motor que espere y componga.

### 2.2 Vida

Los hechos que cambian cómo se leen los mismos números.

| Hecho | Por qué cambia la interpretación |
|---|---|
| Cómo le pagan | Quincenal, mensual o variable cambia qué es "normal" y habilita `dias_desde_el_pago` |
| Días de cobro | Habilita `es_dia_de_pago` y el `momento_del_ciclo` |
| A qué se dedica | Un repartidor con gasto alto en combustible no tiene un problema, tiene un negocio |
| Con quién vive | Alguien que aporta a la casa no gasta de más, comparte |
| A quién mantiene | Cambia por completo qué es un gasto discrecional |
| Rutina laboral | Quien trabaja fines de semana no tiene "findes" en el sentido habitual |
| Periodos especiales | Viajes, mudanzas, meses atípicos: explican picos que si no parecen anomalías |

Los periodos especiales son la conexión con `20b` §4.4: alimentan la
dimensión `periodo_declarado`, que es lo que permite responder "¿gasto más
cuando viajo?".

### 2.3 Vínculo

| Rasgo | Efecto en la conversación |
|---|---|
| Carga emocional | Si el tema le angustia: menos cifras de golpe, más un paso a la vez |
| Estilo de control | Metódico: acepta detalle. Evitativo: mejor lo esencial y una acción |
| Preocupación principal | Llegar a fin de mes, salir de deudas, ahorrar para algo, entender en qué se va |
| Tolerancia al detalle | Cuánto profundizar sin abrumar |
| Objetivo declarado | Lo que dijo que quería lograr |

Esta capa es la más delicada y la que más cambia la sensación. También la
que exige más cuidado: se guarda **lo que la persona dijo o confirmó**,
nunca un diagnóstico psicológico inferido de sus gastos. Manzana observa
patrones, no diagnostica a la persona.

### 2.4 Hilo

| Elemento | Uso |
|---|---|
| Temas tratados | "Lo que vimos la semana pasada" |
| Preocupación expresada | "¿Cómo vas con lo del delivery?" |
| Decisiones tomadas | Recordar lo que la persona dijo que iba a hacer |
| Asuntos abiertos | Retomar sin que el usuario repita |
| Cómo terminó | Resuelto, a medias, o el usuario se fue |

Regla de contenido: el hilo guarda **de qué se habló, no lo que se dijo**.
Temas y conclusiones, no transcripción. Y nunca detalle de categorías
sensibles: guarda "revisó sus gastos de salud", no cuáles.

## 3. Cómo se aprende

Dos vías, con trato distinto:

| Origen | Trato |
|---|---|
| **Dicho** — el usuario lo cuenta | Se guarda directamente, sin preguntar |
| **Observado** — el motor lo deduce | **Se confirma antes de darlo por cierto** |

```text
Dicho:
  Usuario: "me pagan los 15 y fin de mes"
  → se guarda. No hace falta preguntar lo que acaban de decirte.

Observado:
  El motor nota ingresos regulares el 15 y el 30.
  → "Veo que sueles recibir plata los 15 y fin de mes.
     ¿Es tu sueldo?"     [Sí]  [No]  [Es otra cosa]
```

Nada relevante se asume a espaldas del usuario. La confirmación no es
burocracia: es lo que hace que el perfil sea de la persona y no una teoría
que el sistema se hizo sobre ella.

**Cuándo se pregunta y cuándo no.** Un motor que confirma cada observación
se vuelve un interrogatorio. Reglas:

- Máximo una confirmación de perfil por conversación, y nunca en el primer
  turno.
- Se pregunta cuando el hecho **desbloquea algo concreto** ("si me confirmas
  cuándo cobras, puedo decirte si llegas a fin de mes").
- No se pregunta lo que no se va a usar.
- Se puede posponer sin insistir; si el usuario ignora dos veces, no se
  vuelve a preguntar por ese hecho.

## 4. Validez temporal

Un perfil que no caduca hace daño. Si alguien cambió de trabajo hace tres
meses y el asistente sigue razonando con el anterior, cada respuesta suya
está mal de una forma que el usuario no ve venir.

Todo hecho del perfil lleva:

```text
hecho {
  qué
  origen              dicho | observado-confirmado
  cuándo se supo
  última confirmación
  vigencia            permanente | revisable | volátil
  estado              vigente | en duda | suspendido | caducado
}
```

| Vigencia | Ejemplos | Comportamiento |
|---|---|---|
| Permanente | Cómo escribe, su vocabulario | No caduca; se refina |
| Revisable | Trabajo, con quién vive, cómo le pagan | Se reconfirma con baja frecuencia |
| Volátil | Viaje en curso, preocupación puntual, meta activa | Caduca sola |

**Ante contradicción se suspende, no se borra.** Si los datos dejan de
encajar con un hecho del perfil, pasa a *en duda* y el motor pregunta cuando
venga a cuento:

```text
Antes me dijiste que te pagaban quincenal, pero los últimos dos meses
veo un solo ingreso. ¿Cambió algo?
```

Suspender en vez de borrar conserva la posibilidad de que el usuario diga
"no, sigue igual, fue un mes raro" — y entonces el hecho se restaura con su
historia intacta.

## 5. Voz: qué es fijo y qué se adapta

Manzana es siempre la misma; habla distinto con cada persona.

**Invariante — no cambia nunca, con nadie:**

- Cero culpa. Describe, no juzga.
- Claridad antes que simpatía.
- Honesta sobre lo que no sabe.
- Cada cifra puede explicarse.
- Nunca moraliza ni presiona.
- Nunca finge emoción que no corresponde.

**Adaptable — se ajusta a cada persona:**

| Dimensión | Rango |
|---|---|
| Longitud | Una línea ↔ párrafo con desglose |
| Formalidad | Coloquial ↔ neutra |
| Trato | Tú ↔ usted |
| Vocabulario | Local ↔ estándar |
| Detalle | Solo la cifra ↔ cifra + contexto + comparación |
| Emojis | Ninguno ↔ ocasional |
| Iniciativa | Solo lo pedido ↔ ofrece siguiente paso |

La misma respuesta, dos personas:

```text
A quien escribe corto e informal:
  Subió S/250. Casi todo la primera quincena.
  ¿Vemos esa semana?

A quien escribe largo y pide contexto:
  Julio cerró en S/2,340, unos S/250 más que junio.
  La diferencia está concentrada en la primera quincena: S/180 de esa
  subida son salidas y delivery entre el 15 y el 21.
  El resto del mes se mantuvo en tu promedio.
  ¿Quieres ver esa semana en detalle?
```

Es la misma Manzana: misma honestidad, misma evidencia, cero culpa. Cambia
el registro, no el carácter.

### 5.1 Los límites de la adaptación

- El registro se adapta; **la precisión nunca**. Una respuesta corta sigue
  siendo exacta.
- No se imitan errores de escritura ni se fuerza jerga que la persona no usó.
- En momentos delicados —una deuda vencida, una cifra preocupante— el
  registro sube medio punto de cuidado aunque la persona escriba informal.
  Una mala noticia no se da con emoji.
- La adaptación es gradual: nunca cambia de golpe por un solo mensaje.

## 6. Conversación real

La gente no escribe como en los ejemplos de documentación. El motor tiene
que aguantar cómo se escribe de verdad.

| Situación | Comportamiento |
|---|---|
| **Mensajes fragmentados** | Espera y compone antes de responder, si el estilo de la persona lo indica |
| **Errores de tipeo y abreviaturas** | Se interpretan sin corregir al usuario ni comentarlo |
| **Cambio brusco de tema** | Se sigue al usuario; lo anterior queda disponible por si vuelve |
| **Mensajes que son solo desahogo** | Se responde a la persona antes que al dato. "uf, este mes fatal" no se contesta con una tabla |
| **Corregirse a mitad** | "no espera, fueron 25" — se ajusta la propuesta abierta, no se crea otra |
| **Pregunta sin contexto** | Se usa el contexto de pantalla; si no alcanza, se pregunta una vez |
| **Varias cosas en un mensaje** | Plan con todas, una confirmación |
| **Silencio tras una propuesta** | La propuesta caduca; al volver se dice, no se ejecuta |
| **Volver tras semanas** | Se retoma sin reproche ni resumen no pedido |

La cuarta fila es la que más separa un asistente de un formulario. Alguien
que escribe "este mes me fue horrible" está diciendo algo sobre cómo se
siente, no pidiendo un informe. Se le responde a eso primero.

## 6b. Ámbito: conversa como amigo, actúa solo en finanzas

El asistente **no responde "solo puedo ayudarte con temas financieros"**. Ese
es exactamente el momento en que deja de sentirse como alguien y vuelve a
sentirse como un formulario.

| Situación | Comportamiento |
|---|---|
| Comentario personal ("me fue horrible en el trabajo") | Responde como persona: breve, humano, sin fingir emoción. No lo convierte en una lección financiera. |
| Pregunta suelta no financiera | Contesta si puede, con naturalidad y sin extenderse. No se declara incapaz. |
| Conversación que se aleja mucho | Acompaña un momento y vuelve a lo suyo cuando toca, sin cortar en seco. |
| Petición de actuar fuera de finanzas | Ahí sí explica que no puede hacerlo, pero como quien no tiene esa herramienta, no como quien tiene prohibido hablar. |

La distinción es entre **conversar** y **actuar**: conversar es abierto,
actuar está acotado al producto.

### 6b.1 Lo "no financiero" suele ser la mejor información financiera

Cuando alguien cuenta que lo despidieron, que se muda, que tuvo un hijo, que
se va tres semanas de viaje o que empezó un trabajo nuevo, **eso no es charla
suelta: es información financiera de primer orden**. Cambia qué es normal
para esa persona, qué gastos esperar, y cómo interpretar cualquier
desviación de aquí en adelante.

Por eso las conversaciones aparentemente ajenas al dinero son la mejor
fuente de la capa **Vida** del perfil (§2.2).

```text
Usuario: "estoy con todo, me acaban de ascender 😅"

→ Responde a la persona primero.
→ Registra el hecho: cambio de trabajo/ingreso, origen `dicho`.
→ Más adelante, cuando venga a cuento y no en ese momento:
  "Oye, con lo del ascenso, ¿cambió lo que te entra?
   Así ajusto tus proyecciones."
```

Reglas de esta captura:

- Se registra en el momento; **se pregunta después**, no ahí mismo. Convertir
  una confidencia en un formulario inmediato es lo contrario de escuchar.
- Se guarda el hecho, no la conversación entera.
- Se aplican los mismos límites de sensibilidad: temas de salud, situación
  legal o problemas personales no generan hechos de perfil automáticos.
- El usuario puede ver y borrar todo lo que se aprendió de esta vía, igual
  que el resto del perfil.

## 7. Dónde vive el perfil

En la base de datos del usuario, no en el modelo. El motor recibe cada turno
solo la parte del perfil que necesita.

Control del usuario, en `/configuracion/memoria`:

- Ver todo el perfil, en lenguaje claro y por capas.
- Corregir cualquier hecho.
- Borrar hechos individuales.
- Ver de dónde salió cada uno: qué dijo, o qué observó el motor y cuándo lo
  confirmó.
- Desactivar el aprendizaje del perfil por completo, manteniendo la app
  funcional.
- Exportarlo con el resto de sus datos.

El módulo `36_modulo_memoria_y_aprendizaje.md` desarrolla esta superficie.

## 8. Privacidad

- El perfil se construye con **lo que la persona dice o confirma**. No se
  infieren en silencio rasgos sensibles a partir de sus gastos.
- Categorías sensibles (salud, apuestas, préstamos personales) no generan
  hechos de perfil automáticamente.
- Con modo discreto activo, el perfil no se usa para hacer una respuesta más
  personal de lo que el contexto permite.
- El perfil no sale nunca de la cuenta: ni se comparte, ni se agrega con el
  de otros usuarios, ni entrena nada.
- Los registros técnicos no contienen contenido del perfil, solo
  identificadores.

## 9. Cómo se nota que funciona

Señales medibles de que la personalización sirve:

| Señal | Qué indica |
|---|---|
| Longitud de respuesta correlacionada con la del usuario | El registro se está adaptando |
| Confirmaciones de perfil aceptadas | Las observaciones son acertadas |
| Correcciones de perfil | Sano en baja proporción; alta indica que se infiere mal |
| Turnos que usan un hecho del perfil | Que el perfil se aprovecha y no solo se acumula |
| Retorno tras una conversación | Que la experiencia se siente propia |

Y una que importa por lo contrario: **hechos de perfil que nunca se usan**.
Guardar algo de alguien y no usarlo nunca es coste de privacidad sin
beneficio. Se revisa y se deja de recoger.

## 10. Criterios de aceptación

- `AC-PERF-01` — Un hecho observado no se da por cierto sin confirmación del
  usuario. Evidencia: `TEST` + `USER`.
- `AC-PERF-02` — Máximo una confirmación de perfil por conversación, nunca en
  el primer turno. Evidencia: `TEST`.
- `AC-PERF-03` — Todo hecho lleva origen, fecha, vigencia y estado.
  Evidencia: `TEST`.
- `AC-PERF-04` — Un hecho contradicho pasa a *en duda*; no se borra ni se
  mantiene como cierto. Evidencia: `TEST`.
- `AC-PERF-05` — Los rasgos invariantes de la voz no cambian con ningún
  perfil. Evidencia: `TEST` + `USER`.
- `AC-PERF-06` — Dos usuarios con estilos opuestos reciben respuestas de
  registro claramente distinto ante los mismos datos. Evidencia: `USER`.
- `AC-PERF-07` — Una respuesta corta es tan exacta y tan explicable como una
  larga. Evidencia: `TEST`.
- `AC-PERF-08` — Mensajes fragmentados se componen en una sola intención
  cuando el estilo del usuario lo indica. Evidencia: `TEST` + `USER`.
- `AC-PERF-09` — Un mensaje emocional se responde a la persona antes que al
  dato. Evidencia: `USER`.
- `AC-PERF-10` — Las categorías sensibles no generan hechos de perfil
  automáticos. Evidencia: `TEST`.
- `AC-PERF-11` — El usuario puede ver, corregir, borrar y desactivar todo el
  perfil, y la app sigue funcionando. Evidencia: `TEST` + `USER`.
- `AC-PERF-12` — Se revisan periódicamente los hechos que nunca se usan y se
  deja de recogerlos. Evidencia: `METRIC`.
- `AC-PERF-13` — El asistente nunca responde "solo puedo ayudarte con temas
  financieros" a un comentario o pregunta conversacional. Evidencia: `TEST` + `USER`.
- `AC-PERF-14` — Un hecho de vida mencionado al pasar (cambio de trabajo,
  mudanza, viaje) se registra y se usa después, sin interrumpir el momento
  para preguntar. Evidencia: `TEST` + `USER`.
