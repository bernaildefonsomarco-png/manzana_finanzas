# 23 — Runtime, costo y degradación

**Bloque:** 03 — Motor IA
**Estado:** V1
**Fecha:** 25 de julio de 2026
**Depende de:** `20_arquitectura_motor_conversacional.md`, `19_observabilidad_y_telemetria_web.md`
**Documentos que dependen de este:** `41_asistente_ia_en_la_app.md`, `42_reutilizacion_del_codigo_existente_motor.md`, `54_plan_de_implementacion_web.md`

---

## 1. Qué resuelve este documento

El motor funciona cuando el modelo responde. Este documento cubre lo demás:
cuánto cuesta, cuánto tarda, qué pasa cuando falla, y cómo se garantiza que
lo que atiende a un usuario real es el motor real y no una versión de
prueba.

Esa última garantía no es teórica. En este proyecto ya ocurrió: un
componente heredó una configuración de prueba en producción, falló en
silencio, y el pipeline cerró sin crear nada ni avisar a nadie. Nadie podía
ver qué proveedor estaba activo. El diseño de abajo hace que eso sea
imposible de repetir sin que salte una alarma.

## 2. Principios

1. **En producción sirve el motor real o no sirve nada.** No hay término
   medio silencioso.
2. **Un turno, una sesión.** El costo por turno es predecible.
3. **La latencia percibida importa más que la total.** Se transmite mientras
   se genera.
4. **Degradar es decirlo.** Nunca una respuesta peor presentada como normal.
5. **El costo se mide por resultado, no por llamada.** Un turno que resuelve
   algo vale lo que cuesta; diez turnos que no resuelven nada son caros
   aunque sean baratos.

## 3. Sustitución de motor: prohibida en producción

Durante el desarrollo y las pruebas es útil sustituir el modelo por
respuestas fijas: hace los tests rápidos y deterministas. En producción, ese
mismo mecanismo es un riesgo de primer orden, porque produce respuestas
plausibles que nadie identifica como falsas.

Reglas:

| Regla |
|---|
| El proveedor de respuestas fijas **no puede activarse en producción**, ni por defecto ni por herencia de configuración |
| **El proceso no arranca** si detecta que en producción el proveedor por defecto es el de prueba |
| No existe recurso automático al proveedor de prueba cuando el real falla. Si el real falla, se degrada declarándolo (§7) |
| Cada componente que use el modelo declara su proveedor **explícitamente**; ninguno hereda un valor global |
| Una traza en producción con proveedor de prueba es un **incidente**, no una advertencia |

La cuarta fila es la que evita el fallo que ya ocurrió: un componente sin
configuración propia heredó la global y nadie lo notó. La configuración por
herencia es cómoda y es exactamente el mecanismo del fallo.

## 4. Verificación de estado

Un punto de comprobación que responde, por cada componente que usa el
modelo:

```text
componente
proveedor efectivo        el que está activo de verdad, no el configurado
modelo
credenciales presentes    sí | no
apto para producción      sí | no
```

Devuelve error si algún componente no está apto. Se comprueba en el
despliegue y de forma periódica.

La distinción entre "proveedor efectivo" y "proveedor configurado" es
deliberada: el fallo anterior existió porque lo configurado y lo efectivo no
coincidían y nada lo mostraba.

## 5. Presupuesto de turno

| Métrica | Objetivo |
|---|---|
| Sesiones con el modelo por turno | **1** |
| Consultas dentro de la sesión | Hasta 5; más de 5 se investiga |
| Primer contenido visible | Menos de 1,5 s |
| Turno completo, consulta simple | Menos de 4 s |
| Turno completo, operación masiva | Menos de 8 s (la previsualización lo justifica) |

Cómo se sostiene el objetivo de una sola sesión con un catálogo completo de
50-60 comandos: el catálogo es **estable**, así que se cachea. El costo de
entrada por turno se vuelve marginal y predecible, y a cambio se evita el
punto de fallo de un filtro previo que deje al asistente sin capacidades que
sí tiene.

## 6. Latencia percibida

- La respuesta se transmite mientras se genera; el usuario ve las primeras
  palabras enseguida.
- Mientras el motor consulta datos, se indica qué está haciendo en lenguaje
  del usuario ("revisando tus movimientos de julio"), no con jerga técnica.
- Los bloques se muestran conforme están listos: el texto no espera a que
  esté lista la tabla.
- Una operación masiva muestra el conteo en cuanto se resuelve, antes de
  terminar de componer la respuesta.

## 7. Degradación

Cuatro grados, todos declarados. El usuario siempre sabe en cuál está.

| Grado | Cuándo | Qué hace |
|---|---|---|
| **Normal** | Todo bien | Todas las capacidades |
| **Lento** | El modelo tarda más de lo previsto | Avisa que está tardando y ofrece esperar o usar la vía manual |
| **Sin modelo** | No disponible o falla | Lo dice y ofrece la vía manual concreta |
| **Solo lectura** | El Core rechaza escrituras o hay incidencia | Consulta y explica; no propone acciones y lo dice |

En el grado **sin modelo**:

```text
No puedo ayudarte con eso ahora mismo.
Puedes registrarlo directamente:   [Nuevo movimiento]
```

Reglas: el asistente **no se oculta** (desaparecer sin explicación
desconcierta más que un fallo declarado), **no inventa** una respuesta, y
**nunca deja sin salida**. El resto de la aplicación funciona completa —
esa es la razón por la que la app tiene que ser plenamente usable sin el
asistente.

La vía manual que se ofrece es **concreta**, no genérica: el botón que abre
el formulario correspondiente a lo que el usuario intentaba hacer.

## 8. Costo

### 8.1 Qué se mide

Por turno: sesiones, consultas, tokens de entrada y salida, aciertos de
caché, duración, y **resultado** (resuelto, desambiguado, degradado,
rechazado por el verificador).

La última dimensión es la que hace útil la medición. El costo por turno solo
tiene sentido junto a si el turno sirvió de algo.

### 8.2 Qué se vigila

| Señal | Por qué importa |
|---|---|
| Turnos que terminan en acción confirmada | Si el asistente sirve para actuar o solo para charlar |
| Turnos que requieren desambiguar | Un valor alto indica que se pregunta de más |
| Turnos rechazados por el verificador | Cada uno es un defecto del agente, no funcionamiento normal |
| Turnos degradados | Salud del proveedor |
| Consultas por turno | Si sube, el agente está buscando a ciegas |
| Costo por turno resuelto | La métrica económica real |

### 8.3 Cómo se contiene sin bajar calidad

- Cachear el catálogo y las instrucciones estables, que son la mayor parte
  de la entrada.
- No consultar lo que ya está en el espacio de trabajo del turno.
- No repetir consultas equivalentes dentro del mismo turno.
- Límite de uso por usuario y ventana (`14_contratos_api_web.md` §8).
- Cortar un turno que supera un número razonable de consultas y responder
  con lo que tiene, declarándolo.

Lo que **no** se hace para ahorrar: reducir el catálogo, saltarse el
verificador, omitir evidencia, o sustituir el modelo por uno peor sin
decirlo. Todas esas bajan calidad de forma invisible, que es la peor manera
de bajarla.

## 9. Elección de modelo

Se separa la decisión del contrato: el motor funciona contra una interfaz,
no contra un proveedor concreto. Criterios para elegir:

| Requisito | Por qué |
|---|---|
| Salida estructurada fiable | El agente devuelve estructuras tipadas, no texto libre |
| Uso de herramientas con varias iteraciones | Una sola sesión debe poder consultar varias veces |
| Caché de entrada | El catálogo completo depende de ello para ser viable |
| Transmisión progresiva | La latencia percibida depende de ello |
| Buen español rioplatense/peruano | El producto es en español, con vocabulario local |

Se recomienda un modelo capaz para el turno conversacional, y modelos más
pequeños para tareas acotadas y sin conversación (extracción de correos,
generación de resúmenes de hilo). La elección concreta se registra en
`03_decisiones_producto_web.md` cuando se tome, y puede cambiar sin tocar el
motor.

Regla de aislamiento: la extracción de datos desde correos **no comparte
sesión** con el asistente conversacional. Recibe contenido de terceros y
debe estar aislada: sin herramientas, sin acceso a datos del usuario, sin
capacidad de proponer acciones. Solo devuelve datos estructurados con
evidencia textual.

## 10. Evaluación

Un motor conversacional sin evaluación honesta parece mejor de lo que es.
Tres niveles:

| Nivel | Qué comprueba |
|---|---|
| **Invariantes** | Que las reglas de `22_grounding_evidencia_y_politica.md` se cumplen siempre: sin evidencia no hay cifra, sin comando no hay propuesta, sin confirmación no hay escritura |
| **Casos** | Un conjunto de conversaciones reales con resultado esperado, incluidas las ambiguas, las de varios turnos y las masivas |
| **Agnosticismo** | La prueba de `21_contrato_de_canal_y_presentadores.md` §8 |

Regla que evita autoengaño: la evaluación **no puede inyectar contexto que
el motor no tendría en producción**. Si un caso necesita que el foco esté
poblado, el caso debe poblarlo con un turno real de consulta, no
sintéticamente. Una evaluación que prepara el terreno mide un sistema que no
existe.

Un caso solo se marca resuelto si el resultado es correcto **y** la
evidencia lo sustenta. Acertar la cifra sin poder mostrarla no cuenta.

## 11. Criterios de aceptación

- `AC-RT-01` — El proceso no arranca si en producción el proveedor por
  defecto es el de prueba. Evidencia: `TEST` + `LIVE`.
- `AC-RT-02` — Cada componente declara su proveedor explícitamente; ninguno
  lo hereda. Evidencia: `CODE` + `TEST`.
- `AC-RT-03` — La verificación de estado devuelve error si algún componente
  no es apto para producción. Evidencia: `SMOKE` + `LIVE`.
- `AC-RT-04` — Una traza en producción con proveedor de prueba genera alerta
  de incidente. Evidencia: `LIVE`.
- `AC-RT-05` — Un turno consume una sola sesión con el modelo.
  Evidencia: `TEST` + `METRIC`.
- `AC-RT-06` — El primer contenido visible aparece en menos de 1,5 s en el
  percentil 95. Evidencia: `METRIC`.
- `AC-RT-07` — Con el modelo caído, la aplicación sigue plenamente usable y
  el asistente lo declara con una vía manual concreta. Evidencia: `TEST` + `USER`.
- `AC-RT-08` — No existe recurso automático al proveedor de prueba ante un
  fallo del real. Evidencia: `TEST`.
- `AC-RT-09` — La evaluación no inyecta contexto que no existiría en
  producción. Evidencia: `CODE`.
- `AC-RT-10` — La extracción desde correos corre aislada, sin herramientas ni
  acceso a datos del usuario. Evidencia: `TEST`.
- `AC-RT-11` — Se mide costo por turno resuelto, no solo por llamada.
  Evidencia: `METRIC`.
