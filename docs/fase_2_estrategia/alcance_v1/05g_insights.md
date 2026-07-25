# Feature 8: Insights Accionables

**Parte del Paso 5/20 - Alcance V1.0**  
**Prioridad:** P1  
**Estado:** V2.1 - Especificacion avanzada y backend sincronizado  
**Ultima actualizacion:** 19 de julio, 2026

---

## 1. Tesis

Los insights no son reportes. Son descubrimientos utiles que el usuario probablemente no habria notado solo.

La tesis de V1 es:

> Manzana debe convertir datos financieros imperfectos en claridad accionable, sin inventar patrones, sin juzgar y sin abrumar.

Un buen insight produce una de estas reacciones:

- "Ah, no sabia eso."
- "Eso explica por que senti que no me alcanzo."
- "Esto si puedo revisarlo ahora."
- "Quiero que Manzana vigile esto por mi."

---

## 2. Principios

1. **Descubrimiento, no dashboard pesado.**  
   Un insight revela algo relevante. No repite un total obvio.

2. **Motor calcula, agentes elevan experiencia.**  
   Los calculos los hacen motores deterministas. `InsightExperienceAgent` decide framing/calidad experiencial cuando aporta valor y `InsightNarratorAgent` redacta y explica.

3. **Datos suficientes o silencio.**  
   Si la evidencia no alcanza, se muestra estado de aprendizaje, no un insight falso.

4. **Accionable cuando tenga sentido.**  
   Un insight puede terminar en revisar, confirmar, vigilar, crear caja, marcar recurrente o ignorar.

5. **No juicio.**  
   "Delivery subio 38%" es valido. "Gastaste demasiado" no.

6. **Explicable.**  
   Todo insight mostrado debe poder responder: "de donde sale esto?"

7. **No todos los insights son nudges.**  
   Un insight puede vivir solo en Dashboard. Para enviarlo por WhatsApp debe pasar por Nudge Policy.

8. **Privacidad y modo discreto.**  
   Insights sensibles no deben exponerse en mensajes proactivos sin politica adecuada.

9. **Aprende del feedback.**  
   Si el usuario ignora, descarta o toma accion, eso ajusta futuras prioridades.

### 2.1 Capa de wow: elevar, no reemplazar

La diferenciacion de Manzana no debe sentirse como "tenemos insights" ni como "tenemos IA". Debe sentirse como una experiencia que combina claridad practica con autodescubrimiento financiero amable.

El wow tiene dos capas:

1. **Capa funcional:** el insight es personal, sorprendente, explicable, accionable y amable.
2. **Capa psicologica:** el usuario se reconoce en el patron, siente alivio y ve un siguiente paso pequeno.

La segunda capa no reemplaza la primera. La eleva.

Definicion profunda:

> "Ah... esto soy yo. Esto era lo que me estaba pasando con mi dinero."

En Manzana, wow no significa espectaculo, animaciones, frases exageradas ni inteligencia invasiva.

Wow significa:

```text
claridad util + autodescubrimiento amable
```

Version psicologica:

```text
espejo personal + verdad concreta + alivio emocional + siguiente paso pequeno
```

La reaccion buscada no es "que app tan tecnologica", sino:

- "Me leyo bien."
- "Eso explica mi sensacion."
- "No soy un desastre; ahora veo el patron."
- "Puedo hacer algo pequeno con esto."

Esta capa guia naming, copy, priorizacion, conversacion, UI, agentes y marketing.

#### 2.1.0 Transformacion emocional buscada

Un buen descubrimiento debe mover al usuario de:

| Antes | Despues |
|---|---|
| Confusion | Claridad |
| Culpa | Alivio |
| Desorden | Patron visible |
| Ansiedad | Control pequeno |
| "La plata desaparece" | "Ahora veo que esta pasando" |

Regla psicologica:

> Manzana observa patrones, no diagnostica a la persona.

No debe decir:

```text
Estas gastando por ansiedad.
```

Debe decir:

```text
Este tipo de gasto aparece mas en ciertos dias o momentos. Puede valer la pena mirarlo.
```

La experiencia debe sentirse como un espejo amable: muestra algo real, pero no acusa.

#### 2.1.1 Naming externo

Internamente se puede usar `Insights`. Para el usuario final, evitar que toda la experiencia se sienta como una pantalla SaaS de "insights".

Nombres recomendados en UI/copy:

- "Descubrimientos"
- "Lo que Manzana noto"
- "Tu semana en claro"
- "Algo que cambio"
- "Patrones"
- "Dato util"

Regla:

> `Insights` es lenguaje interno. `Descubrimientos` o frases humanas son lenguaje de producto.

#### 2.1.2 Primer wow rapido

No se debe esperar meses para que el usuario sienta inteligencia. Aunque los insights fuertes requieren datos, Manzana puede mostrar micro-descubrimientos tempranos con bajo riesgo.

El primer wow no necesita ser profundo. Debe demostrar que Manzana esta aprendiendo y que cada registro mejora la experiencia.

Ejemplos:

```text
Ya veo tus primeras categorias fuertes: alimentacion y transporte. Con unos registros mas podre decirte que esta cambiando.
```

```text
Registraste 5 gastos esta semana. El mas repetido fue cafe. Todavia no lo llamaria patron, pero lo estoy siguiendo.
```

```text
Estoy aprendiendo tus movimientos. Por ahora, lo mas claro es que registras mas rapido por WhatsApp que desde el Dashboard.
```

Reglas:

- No afirmar patron si todavia no hay evidencia.
- Mostrar progreso de aprendizaje.
- Hacer que el usuario sienta que cada registro mejora el producto.
- Usar lenguaje de acompanamiento, no de reporte.

#### 2.1.3 Lo personal gana sobre lo complejo

Un insight simple pero especifico del usuario suele generar mas wow que una metrica sofisticada.

Menos potente:

```text
Gastaste S/95 en alimentacion.
```

Mas potente:

```text
No subio tu comida en general: subieron cafe y delivery. Fueron 6 gastos pequenos que juntos hicieron S/72.
```

Mas profundo, si hay evidencia suficiente:

```text
Este patron aparece sobre todo en dias de oficina: cafe, taxi y delivery se juntan en montos pequenos. No parece un gasto grande en el momento, pero al final de la semana pesa.
```

Regla de priorizacion:

> Si dos insights tienen confianza suficiente, priorizar el que suena mas personal, concreto y reconocible para el usuario, aunque sea menos sofisticado estadisticamente.

#### 2.1.4 Narrativa, no solo numero

El insight debe contar una mini-historia:

```text
Que paso -> por que importa -> que puedes hacer
```

Ejemplo:

```text
Delivery subio 38% esta semana. No fue por pedidos grandes, fueron mas pedidos pequenos. ¿Quieres que lo vigilemos 7 dias?
```

Esta estructura crea percepcion de inteligencia porque conecta numero, causa probable y siguiente paso.

#### 2.1.5 Inteligente sin ser invasivo

El insight debe sentirse observador, no controlador.

Preferir:

```text
Noté que tus gastos impulso aparecen mas los lunes.
```

Evitar:

```text
Estas gastando por estres.
```

Reglas:

- No diagnosticar emociones.
- No atribuir intenciones internas como hechos.
- No usar tono de vigilancia.
- No mostrar categorias sensibles en proactivos sin modo discreto/politicas.

#### 2.1.6 Criterios de wow

Los criterios originales siguen siendo validos. La version psicologica los profundiza:

| Criterio base | Profundizacion psicologica |
|---|---|
| Personal | Espejo personal: el usuario puede reconocerse en esto. |
| Sorprendente | Sorpresa util: revela algo que no era obvio, pero tiene sentido. |
| Explicable | Verdad concreta: el dato es claro, especifico y trazable. |
| Accionable | Siguiente paso pequeno: hay una accion liviana, no abrumadora. |
| Amable | Alivio y respeto: da claridad sin culpa, diagnostico ni invasion. |

Un insight tiene potencial de wow si cumple los 5 criterios base. Cuando ademas activa reconocimiento y alivio, se convierte en autodescubrimiento financiero amable.

El objetivo de marketing/producto:

> Manzana no te dice solo cuanto gastaste. Te ayuda a reconocerte en tus patrones de dinero sin culpa y con un siguiente paso claro.

---

## 3. Que no es Insights

No es:

- business intelligence avanzado,
- una pantalla de graficos infinitos,
- prediccion exacta del futuro,
- consejo financiero profesional,
- un motor de culpa,
- un reemplazo de Cuentas/Cajas,
- un reemplazo de Deudas o Recurrentes,
- un nudge automatico,
- un resumen semanal obligatorio aunque no haya nada importante.

---

## 4. Relacion con otros sistemas

| Sistema | Relacion |
|---|---|
| Core financiero | Fuente de movimientos confirmados, auditados y corregidos. |
| Balance Engine | Provee saldos, dinero libre y cambios en cuentas/cajas. |
| Categorias/Etiquetas | Permiten detectar concentracion, cambios, patrones y contexto. |
| Cuentas/Cajas | Permiten insights de liquidez, caja libre, ahorro y compromisos. |
| Debt Engine | Provee progreso, vencimientos, pagos parciales y deuda pendiente. |
| Recurring Engine | Provee pagos esperados, patrones y cambios de monto. |
| Pending Inbox | Provee insights de calidad de datos y pendientes que pueden cambiar saldos. |
| Motor IA | Orquesta, narra y explica; no calcula saldos ni patrones desde cero. |
| Dashboard | Canal principal para explorar insights sin interrumpir. |
| WhatsApp | Canal proactivo solo si hay opt-in, timing adecuado y PolicyGate aprueba. |
| Nudges | Decide si un insight se convierte en mensaje proactivo. |
| Learning Engine | Aprende que tipos de insight el usuario valora, ignora o corrige. |

---

## 5. Arquitectura

Insights se divide en motores y agentes.

```text
Eventos internos / batch
  -> InsightSignalEngine
  -> InsightCandidateStore
  -> InsightQualityGate
  -> InsightRanker
  -> ActionableInsightEngine
  -> InsightExperienceAgent (selectivo)
  -> InsightNarratorAgent
  -> DeliveryPlanner
  -> Dashboard / WhatsApp / Event Bus
```

### 5.1 InsightSignalEngine

Detecta senales con reglas y agregados:

- cambios por categoria,
- patrones temporales,
- anomalias,
- gasto recurrente,
- dinero libre,
- deuda,
- cajas,
- pendientes,
- calidad de datos.

No redacta mensajes. No decide canal.

### 5.2 InsightCandidateStore

Guarda candidatos antes de mostrarlos.

Sirve para:

- evitar duplicados,
- comparar contra insights anteriores,
- medir si se repite demasiado,
- esperar mas evidencia,
- auditar por que se mostro o no.

### 5.3 InsightQualityGate

Valida:

- datos suficientes,
- ventanas comparables,
- confianza,
- sensibilidad,
- freshness,
- no duplicacion,
- no contradiccion con saldos/deudas/recurrentes.

### 5.4 InsightRanker

Prioriza que insight mostrar primero.

Variables:

- impacto en dinero,
- sorpresa/novelty,
- accionabilidad,
- confianza,
- relevancia para el usuario,
- frescura,
- sensibilidad,
- feedback previo.

### 5.5 ActionableInsightEngine

Conecta el insight con una accion posible.

Ejemplos:

- revisar pendiente,
- confirmar recurrente,
- crear caja,
- vigilar categoria,
- revisar deuda,
- reconstruir dia,
- corregir categoria,
- ignorar insight.

### 5.6 InsightExperienceAgent

Agente especializado en calidad de experiencia. No calcula ni valida datos. Decide si un insight, ya validado por motores, se siente personal, oportuno, claro y diferencial para este usuario.

Responsabilidades:

- Elegir el framing mas humano entre varios candidatos validos.
- Priorizar el insight que probablemente genere mas claridad o wow para ese usuario.
- Ajustar profundidad: breve, explicativo, accionable o exploratorio.
- Detectar si un insight suena frio, obvio, invasivo o culpabilizante.
- Recomendar si conviene mostrar ahora, esperar mas evidencia o dejarlo solo en Dashboard.
- Proponer el angulo narrativo: "gastos pequenos acumulados", "cambio de patron", "olvido probable", "progreso", "riesgo suave".
- Considerar preferencias, feedback historico, etapa del usuario y sensibilidad.

No hace:

- Calcular montos.
- Validar saldos.
- Crear insights desde cero.
- Saltarse `InsightQualityGate`, `Risk Policy` o `Nudge Policy`.
- Decidir envio proactivo final.
- Exponer razonamiento interno al usuario.

Se invoca selectivamente cuando:

- hay varios insights candidatos de calidad similar,
- el insight es sensible,
- el insight podria ser enviado por WhatsApp,
- se busca un micro-descubrimiento temprano,
- la experiencia necesita personalizacion fuerte,
- el insight tiene potencial de wow pero requiere mejor framing,
- el usuario ha dado feedback previo sobre insights similares.

Ejemplo:

Motores detectan:

```text
1. Alimentacion subio 12%.
2. Cafe aparece 5 veces esta semana.
3. Gastos chicos sumaron S/72.
```

`InsightExperienceAgent` puede recomendar:

```text
Mostrar el insight 3 porque es mas personal y reconocible: no fue un gasto grande, fueron varios gastos pequenos acumulados.
```

### 5.7 InsightNarratorAgent

Convierte un resultado ya calculado en una explicacion breve, humana y no juzgadora.

No debe:

- calcular totales,
- inventar evidencia,
- decidir si enviar por WhatsApp,
- crear nudges saltandose PolicyGate,
- exponer razonamiento interno.

### 5.8 DeliveryPlanner

Decide donde aparece el insight:

- Home Dashboard,
- pantalla Insights,
- detalle de categoria,
- WhatsApp semanal,
- WhatsApp puntual si es importante y permitido.

### 5.9 Decision de agentes

No todo insight necesita todos los agentes.

```text
Insight validado + rankeado
  -> ¿Tiene alto potencial de wow, es sensible, compite con otros candidatos o podria ir por WhatsApp?
      -> Si: InsightExperienceAgent -> InsightNarratorAgent
      -> No: InsightNarratorAgent directo o plantilla
```

Reglas:

- `InsightExperienceAgent` se usa cuando puede mejorar framing, timing, profundidad o seguridad emocional.
- `InsightNarratorAgent` se usa para redactar el mensaje final cuando no basta una plantilla.
- Insights rutinarios, de bajo riesgo y con copy predefinido pueden usar plantilla sin LLM.

---

## 6. Ciclo de vida de un insight

```text
candidate
  -> validated
  -> ranked
  -> narrated
  -> displayed
  -> acted | dismissed | ignored | outdated | expired
```

| Estado | Significado |
|---|---|
| `candidate` | Senal detectada, aun no validada. |
| `validated` | Paso reglas minimas de calidad. |
| `ranked` | Tiene prioridad calculada. |
| `narrated` | Tiene copy listo para UI/canal. |
| `displayed` | Fue mostrado en Dashboard. |
| `sent` | Fue enviado por WhatsApp u otro canal proactivo. |
| `acted` | Usuario tomo accion sugerida. |
| `dismissed` | Usuario lo descarto. |
| `ignored` | Fue visto o entregado sin accion. |
| `outdated` | Fue mostrado o enviado, pero los datos base cambiaron. |
| `expired` | Ya no es relevante. |

### 6.1 Mutacion por cambios de datos

Los insights dependen de datos vivos. Si el usuario corrige movimientos, confirma emails, asigna cuentas, paga deudas o cambia categorias, los insights afectados deben recalcularse.

Reglas por estado:

| Estado actual | Comportamiento si cambian datos |
|---|---|
| `candidate`, `validated`, `ranked` | Recalcular silenciosamente o descartar si pierde evidencia. |
| `narrated` | Regenerar copy si cambian numeros o framing. |
| `displayed` | Marcar como `outdated` internamente y mostrar version actualizada en Dashboard. |
| `sent` | No se puede des-enviar. Dashboard debe mostrar nota de actualizacion si el usuario abre detalle. |
| `acted` | Mantener historial y recalcular impacto si la accion depende del dato. |
| `dismissed` | No revivir salvo cambio material. |
| `expired` | Mantener archivado; crear insight nuevo solo si vuelve a ser relevante. |

Ejemplo:

```text
Insight enviado: Delivery subio 38%.
Luego el usuario corrige 3 movimientos.
Dashboard muestra: Actualizado: delivery en realidad subio 22% con los datos corregidos.
```

### 6.2 Expiracion temporal

| Tipo | Regla de expiracion V1 |
|---|---|
| `learning_progress` | Expira cuando aparece el primer insight fuerte o a los 7 dias. |
| `comparative` semanal | Expira al iniciar la siguiente semana. |
| `category_concentration` | Expira al cerrar el periodo analizado o si cambia la categoria base. |
| `temporal_pattern` | Expira en 30 dias si no se refuerza. |
| `anomaly` | Expira en 7 dias o cuando el comportamiento vuelve a normalidad. |
| `projection` | Expira cuando cambian saldos/compromisos relevantes o al cerrar periodo. |
| `free_money` | Expira cuando cambia saldo, caja, deuda o recurrente relevante. |
| `recurring` | Expira si el usuario confirma, rechaza o el patron deja de repetirse. |
| `debt` | No expira mientras la deuda este activa, salvo que el insight puntual sea de una cuota pasada. |
| `progress` | Expira al cerrar periodo o cuando se genera progreso mas reciente. |
| `data_quality` | Expira cuando se resuelve el pendiente/dato incompleto. |

---

## 7. Datos que pueden alimentar insights

### 7.1 Datos incluidos

- movimientos confirmados,
- movimientos manuales del Dashboard,
- emails confirmados por el usuario,
- correcciones aplicadas,
- deudas activas,
- pagos de deuda,
- recurrentes confirmados,
- cajas y asignaciones internas,
- pendientes,
- categorias, subcategorias y etiquetas,
- preferencias y opt-ins.

### 7.2 Datos con cuidado

| Dato | Regla |
|---|---|
| Movimiento con cuenta `null` | Puede alimentar gasto/categoria, pero no saldos por cuenta ni dinero libre. |
| Movimiento `needs_review` | No usar para insights fuertes; puede alimentar insight de "pendientes por revisar". |
| Email no confirmado | No cuenta como gasto/ingreso real. Solo puede generar pendiente. |
| Transferencias | No cuentan como gasto. |
| Asignaciones internas | No cuentan como gasto. Sirven para cajas/ahorro. |
| Prestamos | Se analizan por Debt Engine/personas, no como gasto comun. |
| Devoluciones | Deben ajustar analisis de deuda/prestamo o categoria segun vinculo. |
| Movimientos eliminados | No cuentan. |

---

## 8. Taxonomia V1 de insights

### 8.1 Comparativo

Compara periodos equivalentes.

Ejemplo:

```text
Gastaste S/30 mas en transporte que la semana pasada.
```

Debe evitar comparar una semana parcial contra una semana completa sin explicarlo.

Acciones posibles:

- ver movimientos,
- vigilar categoria,
- corregir clasificacion.

### 8.1.1 Learning progress

Micro-descubrimiento temprano para usuarios nuevos. No afirma patrones fuertes; muestra que Manzana esta aprendiendo.

Trigger V1:

```text
Usuario alcanza 5 movimientos confirmados
  -> InsightSignalEngine genera candidato `learning_progress`
  -> InsightQualityGate verifica que no invente patron fuerte
  -> Se muestra en Dashboard Home
  -> WhatsApp solo si hay opt-in y no hay mejor mensaje pendiente
```

Ejemplo:

```text
Ya veo tus primeras categorias fuertes: alimentacion y transporte. Con unos registros mas podre decirte que esta cambiando.
```

Reglas:

- No usar lenguaje de certeza fuerte.
- No llamar "patron" a evidencia debil.
- Debe hacer sentir progreso de aprendizaje.
- Debe aparecer temprano para evitar que el usuario sienta que Manzana "no hace nada".

### 8.2 Categoria principal

Detecta concentracion de gasto.

Ejemplo:

```text
Alimentacion fue el 38% de tus gastos esta semana.
```

Acciones posibles:

- ver categoria,
- revisar subcategorias,
- crear caja o limite futuro si existe feature.

### 8.3 Patron temporal

Detecta dias, horarios o momentos donde cambia el gasto.

Ejemplo:

```text
Tus gastos suben los viernes. En las ultimas 4 semanas, viernes fue tu dia mas alto 3 veces.
```

Acciones posibles:

- vigilar viernes,
- ver movimientos,
- configurar recordatorio de revision.

### 8.4 Anomalia

Detecta valores fuera del comportamiento normal del usuario.

Ejemplo:

```text
Delivery esta 2.1x por encima de tu promedio mensual.
```

Acciones posibles:

- ver movimientos,
- vigilar categoria,
- ignorar si fue algo puntual.

### 8.5 Proyeccion simple

Proyecta tendencia con cuidado.

Ejemplo:

```text
Si sigues a este ritmo, terminarias el mes con cerca de S/180 libres.
```

Reglas:

- siempre decir que es una proyeccion,
- usar datos de Balance Engine,
- no prometer exactitud,
- no usar si hay muchos pendientes o cuenta `null` afecta saldo.

### 8.6 Dinero libre / liquidez

Explica cambios en dinero disponible.

Ejemplo:

```text
Tu dinero libre bajo S/120 esta semana, principalmente por transporte y una cuota pagada.
```

Depende de:

- Balance Engine,
- cuentas,
- cajas,
- compromisos proximos,
- deudas y recurrentes.

### 8.7 Recurrente

Detecta o explica pagos repetidos.

Ejemplo:

```text
Netflix aparece cerca de esta fecha por 3 meses. Puedes marcarlo como recurrente.
```

Regla:

> El insight no crea el recurrente. Solo sugiere accion. Recurring Engine decide y el usuario confirma.

### 8.8 Deuda

Explica progreso, riesgo o vencimientos.

Ejemplo:

```text
Ya pagaste 65% de la deuda con Ana. Te falta S/140.
```

Acciones posibles:

- ver deuda,
- registrar pago,
- configurar recordatorio,
- revisar persona relacionada.

### 8.9 Caja / ahorro

Explica cambios en cajas y separacion mental.

Ejemplo:

```text
Tu caja de emergencia crecio S/200 este mes.
```

Acciones posibles:

- ver caja,
- asignar dinero,
- revisar dinero libre.

### 8.10 Contextual / emocional

Usa etiquetas como `impulso`, `estres`, `social` o `fin_de_semana`.

Ejemplo:

```text
Tus gastos impulso aparecieron mas los lunes que otros dias.
```

Reglas:

- requiere suficiente evidencia,
- tono muy cuidadoso,
- no diagnosticar emociones,
- respetar opt-in y modo discreto,
- mostrar como posibilidad, no verdad absoluta.

### 8.11 Calidad de datos

Ayuda a mejorar confiabilidad.

Ejemplo:

```text
Tienes 3 movimientos sin cuenta. Si los completas, puedo calcular mejor tu dinero libre.
```

Acciones posibles:

- revisar pendientes,
- asignar cuenta,
- confirmar email,
- corregir categoria.

### 8.12 Progress / refuerzo positivo

Detecta mejoras, constancia o progreso. Es clave para que Manzana no se sienta como una app que solo vigila problemas.

Ejemplos:

```text
Tus gastos en delivery bajaron 20% esta semana. Van 2 semanas seguidas de reduccion.
```

```text
Ya pagaste 3 cuotas seguidas a tiempo. Llevas un buen ritmo.
```

Acciones posibles:

- ver progreso,
- mantener vigilancia,
- celebrar sin exagerar,
- ajustar nudge si el usuario ya esta cumpliendo.

Reglas:

- No infantilizar.
- No usar celebracion excesiva.
- Reforzar claridad y continuidad.
- Puede ser mas valioso para retencion que un insight de problema.

---

## 9. Umbrales V1

Estos umbrales son defaults iniciales. Deben ajustarse con datos reales.

| Nivel de datos | Comportamiento |
|---|---|
| 0-4 movimientos | No mostrar insights. Mostrar estado "estoy aprendiendo". |
| 5-9 movimientos | Insights simples de calidad de datos o resumen basico. |
| 10+ movimientos | Categoria principal y primeros comparativos simples. |
| 20+ movimientos y 2 semanas | Comparativos semanales con mas confianza. |
| 40+ movimientos y 4 semanas | Patrones temporales y anomalias iniciales. |
| 2+ meses comparables | Anomalias mensuales y proyecciones mas utiles. |
| 2 ocurrencias similares | Candidato a recurrente. |
| 3 ocurrencias similares | Recurrente sugerido con mayor confianza. |
| 8+ movimientos con etiquetas en periodo | Posible insight contextual. |

### 9.1 Primer insight util V1

El primer insight util debe tener flujo propio.

| Elemento | Regla |
|---|---|
| Trigger principal | 5 movimientos confirmados. |
| Tipo | `learning_progress`. |
| Canal default | Dashboard Home. |
| WhatsApp | Opcional, solo con opt-in y si no hay riesgo de saturacion. |
| Tono | "Estoy aprendiendo", no "ya detecte un patron fuerte". |
| Objetivo | Hacer visible que Manzana esta entendiendo al usuario. |

Si el usuario llega a 5 movimientos pero los datos son muy dispersos, mostrar un insight de aprendizaje:

```text
Ya tengo tus primeros movimientos. Todavia no hay un patron claro, pero estoy aprendiendo tus categorias y formas de registrar.
```

### 9.2 Regla de suficiencia

No basta con tener muchos movimientos. El insight debe tener evidencia en la dimension que analiza.

Ejemplo:

- 40 movimientos totales, pero solo 1 de delivery: no generar insight de delivery.
- 25 gastos con cuenta `null`: no generar insight fuerte de liquidez.
- 3 emails de banco sin confirmar: no sumar como gasto real.

---

## 10. Scoring de calidad

Cada insight candidato debe obtener un score.

```text
insight_score =
  impact_score
  + novelty_score
  + actionability_score
  + confidence_score
  + relevance_score
  - sensitivity_penalty
  - repetition_penalty
```

| Score | Que mide |
|---|---|
| `impact_score` | Cuanto dinero, frecuencia o riesgo representa. |
| `novelty_score` | Si el usuario aun no lo sabe o no se mostro recientemente. |
| `actionability_score` | Si hay algo razonable que hacer. |
| `confidence_score` | Calidad de datos y fuerza estadistica. |
| `relevance_score` | Ajuste a preferencias, etapa y uso del usuario. |
| `sensitivity_penalty` | Riesgo de privacidad o tono delicado. |
| `repetition_penalty` | Evita repetir lo mismo demasiadas veces. |

V1 debe priorizar pocos insights de alta calidad sobre muchos insights medianos.

---

## 11. Explicabilidad

Todo insight debe poder explicar:

- periodo analizado,
- numero de movimientos incluidos,
- filtros aplicados,
- baseline de comparacion,
- exclusiones relevantes,
- fuente de datos,
- nivel de confianza resumido.

Ejemplo:

```text
Lo calculé con 12 gastos confirmados de esta semana y lo comparé con 10 gastos de la semana pasada. No incluí transferencias ni pendientes de email.
```

No se debe exponer chain-of-thought ni razonamiento interno del LLM.

---

## 12. Acciones sugeridas

Un insight puede proponer una accion ligera.

| Accion | Cuando aplica |
|---|---|
| `view_movements` | Ver movimientos que sustentan el insight. |
| `review_pending` | Hay emails o movimientos pendientes que afectan claridad. |
| `watch_category` | Categoria/subcategoria subio y el usuario podria querer vigilarla. |
| `confirm_recurring` | Patron recurrente detectado. |
| `review_debt` | Hay progreso, vencimiento o inconsistencia de deuda. |
| `create_box` | Hay compromiso repetido que podria separarse mentalmente. |
| `assign_account` | Movimientos sin cuenta impiden calcular liquidez. |
| `correct_classification` | Categoria/subcategoria dudosa afecta insight. |
| `dismiss` | No volver a mostrar este insight. |

### 12.1 Regla

No todo insight necesita CTA. A veces el valor es solo claridad.

Ejemplo sin CTA:

```text
Este mes tu mayor cambio fue transporte: subio S/42 frente al mes pasado.
```

Ejemplo con CTA:

```text
Delivery subio 38% esta semana. ¿Quieres que lo vigilemos durante 7 dias?
```

---

## 13. Entrega por canal

### 13.1 Dashboard

Canal principal para insights.

Debe mostrar:

- insight destacado en Home,
- lista de insights recientes,
- filtros por tipo,
- evidencia resumida,
- CTA si aplica,
- "por que veo esto?",
- descartar / no mostrar otra vez.

### 13.2 WhatsApp

Canal proactivo, solo con permisos.

WhatsApp no debe perder el "wow" por una decision de costo. Si un descubrimiento es realmente personal, claro y oportuno, WhatsApp puede ser el mejor canal para narrarlo. Dashboard queda como profundidad, evidencia y exploracion; WhatsApp mantiene la relacion principal.

Puede enviar:

- resumen semanal,
- insight puntual importante,
- accion sugerida con bajo riesgo.

Debe pasar por:

- opt-in,
- horario silencioso,
- modo discreto,
- Nudge Policy,
- Risk Policy,
- limite de frecuencia.

Patron recomendado:

```text
WhatsApp narra el descubrimiento.
Flow/link permite actuar o ver evidencia breve.
Dashboard muestra detalle completo.
```

Ejemplo:

```text
Note algo util: esta semana no fue un gasto grande,
sino varios gastos pequenos los que movieron tu dinero libre.
Quieres ver cuales?
```

### 13.2.1 Frecuencia maxima V1

| Canal | Frecuencia maxima |
|---|---|
| Dashboard Home | 1 insight destacado + lista de recientes. |
| Pantalla Insights | Lista historica/reciente, ordenada por relevancia y frescura. |
| WhatsApp semanal | 1 resumen por semana. |
| WhatsApp puntual | Maximo 1 insight por dia, solo si importancia/urgencia supera threshold. |
| WhatsApp sensible | Solo si opt-in, modo discreto/Risk Policy lo permiten y no expone datos sensibles. |

Reglas:

- Si varios insights compiten por WhatsApp, enviar solo el de mayor prioridad.
- No reenviar por WhatsApp un insight que el usuario ya vio y entendio en Dashboard, salvo urgencia.
- Si hay duda de valor, guardar en Dashboard.
- Si hay claridad alta, buen timing y bajo riesgo, WhatsApp puede ser el canal principal del descubrimiento.
- El costo no debe ser la unica razon para ocultar un insight de alto valor en Dashboard.

### 13.3 Email

Email resumen queda fuera de V1 completo. Puede quedar como fase posterior.

### 13.4 API / eventos

Los insights generados deben emitir eventos internos para Dashboard, Nudges y metricas.

```text
insight_candidate_created
insight_validated
insight_displayed
insight_sent
insight_seen
insight_delivery_recorded
insight_updated
insight_outdated
insight_acted
insight_dismissed
insight_expired
```

---

## 14. Cadencia

| Cadencia | Uso |
|---|---|
| Event-driven | Recalcular cuando hay movimiento confirmado, correccion, pago de deuda, cambio de caja o recurrente confirmado. |
| Diario | Detectar pendientes, anomalias tempranas y estado de aprendizaje. |
| Semanal | Generar resumen principal y comparativos. |
| Mensual | Detectar tendencias mas fuertes y proyecciones. |

### 14.1 No recalcular todo siempre

El sistema debe recalcular solo las dimensiones afectadas:

- cambio de categoria -> insights de categoria y patrones relacionados,
- cambio de cuenta -> liquidez y dinero libre,
- pago de deuda -> deuda y dinero libre,
- confirmacion de email -> gastos/categorias del periodo,
- recurrente confirmado -> recurrentes y proyecciones.

---

## 15. Privacidad y sensibilidad

### 15.1 Insights sensibles

Son sensibles:

- deudas,
- salud,
- estres,
- impulso,
- familia/apoyo,
- compras personales delicadas,
- patrones que podrian avergonzar al usuario.

### 15.2 Reglas

- En Dashboard pueden mostrarse con cuidado si el usuario esta autenticado.
- En WhatsApp deben pasar por modo discreto y Risk Policy.
- No usar tono invasivo.
- No inferir emociones como hechos.
- No enviar insights sensibles en mensajes proactivos si no hay opt-in claro.

Ejemplo seguro:

```text
Detecté un cambio relevante en una categoría sensible. ¿Quieres verlo?
```

Ejemplo no seguro:

```text
Tus gastos por estrés subieron esta semana.
```

---

## 16. Copy y tono

### 16.1 Formula recomendada

```text
[Cambio o descubrimiento] + [evidencia breve] + [accion opcional]
```

Ejemplo:

```text
Delivery subió 38% esta semana. Fueron 4 pedidos más que la anterior. ¿Quieres que lo vigilemos esta semana?
```

### 16.2 Evitar

- "malgastaste",
- "deberias",
- "te estas excediendo",
- "no sabes controlar",
- predicciones exactas sin base,
- conclusiones emocionales fuertes.

### 16.3 Preferir

- "subio",
- "bajo",
- "aparece mas",
- "parece un patron",
- "podria ayudarte",
- "si quieres",
- "lo calculo con..."

---

## 17. Contratos de datos

### 17.1 Tipos

```ts
type InsightType =
  | "learning_progress"
  | "comparative"
  | "category_concentration"
  | "temporal_pattern"
  | "anomaly"
  | "projection"
  | "free_money"
  | "recurring"
  | "debt"
  | "box_saving"
  | "contextual"
  | "progress"
  | "data_quality";

type InsightStatus =
  | "candidate"
  | "validated"
  | "ranked"
  | "narrated"
  | "displayed"
  | "sent"
  | "acted"
  | "dismissed"
  | "ignored"
  | "outdated"
  | "expired";

type InsightSensitivity =
  | "low"
  | "medium"
  | "high";

type InsightDeliveryChannel =
  | "dashboard_home"
  | "dashboard_insights"
  | "whatsapp"
  | "email";

type InsightDelivery = {
  channel: InsightDeliveryChannel;
  delivered_at: string;
  seen_at: string | null;
  acted_at: string | null;
  delivery_status: "delivered" | "seen" | "acted" | "failed";
};
```

### 17.2 Insight

```ts
type Insight = {
  id: string;
  user_id: string;
  type: InsightType;
  status: InsightStatus;
  title: string;
  summary: string;
  period_start: string;
  period_end: string;
  comparison_period_start: string | null;
  comparison_period_end: string | null;
  subject_type:
    | "category"
    | "subcategory"
    | "tag"
    | "account"
    | "box"
    | "debt"
    | "recurring"
    | "person"
    | "global";
  subject_id: string | null;
  current_value: number | null;
  baseline_value: number | null;
  delta_value: number | null;
  delta_percent: number | null;
  confidence: number;
  insight_score: number;
  sensitivity: InsightSensitivity;
  evidence_summary: string;
  excluded_data_summary: string | null;
  suggested_action: InsightAction | null;
  deliveries: InsightDelivery[];
  last_delivered_at: string | null;
  outdated_by_insight_id: string | null;
  update_note: string | null;
  source_engine: string;
  trace_id: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};
```

### 17.3 Accion

```ts
type InsightActionType =
  | "view_movements"
  | "review_pending"
  | "watch_category"
  | "confirm_recurring"
  | "review_debt"
  | "create_box"
  | "assign_account"
  | "correct_classification"
  | "dismiss";

type InsightAction = {
  type: InsightActionType;
  label: string;
  target_route: string | null;
  command_type: string | null;
  requires_confirmation: boolean;
};
```

### 17.4 Evidencia

```ts
type InsightEvidence = {
  insight_id: string;
  movement_ids: string[];
  account_ids: string[];
  box_ids: string[];
  debt_ids: string[];
  recurring_ids: string[];
  aggregate_query_id: string | null;
  sample_size: number;
  baseline_sample_size: number | null;
};
```

---

## 18. Reglas de validacion

El sistema no debe mostrar un insight si:

- no tiene evidencia trazable,
- se basa en emails no confirmados como gasto real,
- compara periodos no equivalentes sin explicarlo,
- incluye transferencias como gasto,
- depende de saldos con muchas cuentas `null`,
- repite un insight descartado recientemente,
- tiene sensibilidad alta y canal proactivo no permitido,
- contradice un dato del Core financiero,
- no puede explicar su fuente.

---

## 19. Ejemplos V1

### 19.1 Categoria

```text
Alimentacion fue tu categoria mas alta esta semana: S/95 de S/245.
```

Fuente:

```text
12 movimientos confirmados, semana actual, sin transferencias.
```

### 19.2 Anomalia

```text
Delivery subio 38% esta semana. Fueron 4 pedidos mas que la anterior.
```

Accion:

```text
Vigilar delivery esta semana.
```

### 19.3 Dinero libre

```text
Tu dinero libre bajo S/120 esta semana. La mayor parte viene de una cuota y transporte.
```

### 19.4 Recurrente

```text
Netflix aparece cerca de esta fecha por 3 meses. Puedes marcarlo como recurrente.
```

### 19.5 Calidad de datos

```text
Tienes 3 movimientos sin cuenta. Si los completas, puedo calcular mejor tu dinero libre.
```

### 19.6 Estado de aprendizaje

```text
Todavia estoy aprendiendo tus patrones. Con unos movimientos mas podre mostrarte cambios reales.
```

---

## 20. WhatsApp semanal

El resumen semanal por WhatsApp debe ser compacto.

Ejemplo:

```text
Tu semana en numeros:

Gastaste S/245, S/30 mas que la semana pasada.

Top 3:
1. Alimentacion: S/95
2. Transporte: S/68
3. Ocio: S/45

Dato util: delivery subio 38%.
Libre estimado para esta semana: ~S/180.
```

Reglas:

- maximo 1 resumen semanal,
- solo si el usuario tiene opt-in,
- no enviar si no hay datos suficientes,
- respetar horario silencioso,
- respetar modo discreto,
- incluir "ver detalle" o CTA equivalente.

---

## 21. Interaccion del usuario

El usuario debe poder:

- ver detalle,
- preguntar "por que?",
- descartar,
- no volver a mostrar similares,
- corregir datos que sustentan el insight,
- tomar accion sugerida,
- configurar preferencias de insights.

### 21.1 Feedback

Feedback posible:

| Feedback | Efecto |
|---|---|
| Actua sobre insight | Subir relevancia de tipo similar. |
| Descarta | Bajar repeticion. |
| "No me sirve" | Bajar prioridad de ese tipo. |
| Corrige movimiento | Recalcular insight afectado. |
| Pregunta "por que?" | Mostrar evidencia y fuente. |

---

## 22. Metricas

| Metrica | Objetivo |
|---|---|
| Insight read rate | Medir si se consume. |
| Action rate | Medir si genera utilidad. |
| Dismiss rate | Detectar ruido. |
| Repeat suppression rate | Evitar insistencia. |
| Explanation open rate | Medir necesidad de confianza. |
| Correction after insight | Detectar insights basados en datos malos. |
| False positive feedback | Medir calidad. |
| Time to first useful insight | Reducir tiempo hasta aha moment. |
| First useful insight shown rate | Medir si los usuarios nuevos reciben claridad temprana. |
| Weekly insight retention | Relacion entre insight leido y regreso. |
| Progress insight engagement | Medir si los refuerzos positivos generan retorno o accion. |
| Outdated insight rate | Detectar insights que cambian por datos corregidos o pendientes. |
| WhatsApp insight frequency violations | Verificar que se respete la frecuencia maxima por canal. |
| Delivery channel performance | Comparar Dashboard, WhatsApp y otros canales por lectura/accion. |

---

## 23. Escenarios de prueba

### Escenario 1: pocos datos

Usuario tiene 3 movimientos.

Resultado:

- no mostrar insight fuerte,
- mostrar estado "estoy aprendiendo".

### Escenario 2: categoria principal

Usuario tiene 15 gastos confirmados en la semana.

Resultado:

- mostrar categoria principal si hay concentracion clara,
- explicar periodo y cantidad de movimientos.

### Escenario 3: email sin confirmar

Hay 4 emails de banco pendientes.

Resultado:

- no sumarlos a gasto real,
- generar posible insight de calidad: "tienes pendientes por revisar".

### Escenario 4: transferencia

Usuario transfiere S/500 de BCP a Yape.

Resultado:

- no contarlo como gasto,
- no generar anomalia de gasto.

### Escenario 5: cuenta `null`

Hay gastos con cuenta desconocida.

Resultado:

- pueden alimentar categorias,
- no deben sostener insight fuerte de dinero libre por cuenta.

### Escenario 6: recurrente Netflix

Netflix aparece 3 meses seguidos.

Resultado:

- insight sugiere marcar recurrente,
- Recurring Engine maneja confirmacion.

### Escenario 7: deuda

Usuario paga una cuota.

Resultado:

- Debt Engine recalcula progreso,
- insight puede mostrar porcentaje pagado si hay entidad de deuda.

### Escenario 8: categoria sensible

Insight sobre salud o deuda por WhatsApp.

Resultado:

- PolicyGate revisa modo discreto y opt-in,
- si no cumple, no se envia o se redacta de forma generica.

### Escenario 9: correccion

Usuario corrige 3 movimientos de delivery a almuerzo.

Resultado:

- insight de delivery se recalcula,
- si pierde evidencia, expira o se actualiza.

### Escenario 10: insight repetido

Usuario descarto "delivery subio" dos veces.

Resultado:

- aplicar repetition penalty,
- no insistir salvo cambio muy significativo.

### Escenario 11: usuario solo con deudas

Usuario tiene 0 gastos, 3 deudas activas y 2 pagos registrados.

Resultado:

- generar insights de tipo `debt` y `progress` si hay evidencia suficiente,
- no generar insights de categoria, patrones de consumo o anomalias de gasto,
- mostrar dinero libre solo si existe cuenta configurada,
- respetar que el uso parcial del producto tambien es valido.

### Escenario 12: primer insight util

Usuario nuevo alcanza 5 movimientos confirmados.

Resultado:

- generar candidato `learning_progress`,
- mostrarlo en Home como primer descubrimiento seguro,
- no afirmar patrones fuertes todavia,
- enviarlo por WhatsApp solo si hay opt-in y no compite con un mensaje mas importante.

### Escenario 13: insight enviado que cambia

Se envio por WhatsApp: "Delivery subio 38%". Luego el usuario corrige varios movimientos.

Resultado:

- no intentar des-enviar el mensaje,
- marcar el insight anterior como `outdated` si corresponde,
- crear o mostrar version actualizada en Dashboard,
- mostrar nota tipo: "Actualizado: con los datos corregidos, delivery subio 22%".

---

## 23.1 Estado de implementacion tecnica

Estado al 19 de julio de 2026: backend, migraciones, APIs y pantalla de
Descubrimientos implementados, desplegados y verificados en staging. La entrega
proactiva por WhatsApp permanece apagada hasta completar su puerta operativa.

Implementado:

- `InsightEngine` deterministico para señales trazables, incluidos comparativos,
  anomalias, progreso, deudas, recurrentes, calidad de datos, dinero libre,
  proyeccion cautelosa y contexto por tags.
- La proyeccion solo aparece con cuenta configurada, origen de cuenta suficiente,
  sin pendientes activos y con historia comparable. No promete un cierre exacto.
- El insight contextual exige tags reales, volumen minimo y concentracion
  temporal verificable. No hace diagnosticos personales o de salud.
- Expiracion por naturaleza de señal: comparativos semanales al siguiente
  periodo, anomalias y learning en 7 dias, proyecciones en 1 dia, contexto en 30
  dias y señales ligadas a entidades cuando cambia o desaparece la fuente.
- Lifecycle `candidate -> validated/ranked -> narrated -> displayed/sent`, mas
  `outdated`, `expired`, `dismissed` y `acted`.
- Feedback persistente: dismiss/acted suprime la misma evidencia; ignores
  recientes evitan repeticion; dismissals repetidos penalizan ranking salvo un
  cambio material claramente mas importante.
- `InsightExperienceAgent` e `InsightNarratorAgent` reciben hechos y evidencia
  ya calculados. Los guardrails impiden introducir cifras o fuentes nuevas.
- Entregas por canal y conexion a `NudgePolicy` sin duplicar la autoridad de
  envio.
- API real: lista, detalle, evidencia, seen, dismiss y action.
- Pantalla real de Descubrimientos con lista, filtros, destacado, detalle,
  evidencia trazable, feedback, version actualizada y modo discreto.
- Estados de carga, error y vacio honestos; el vacio no inventa patrones ni
  propone una accion sin datos suficientes.
- Evidencia de movimientos limitada a registros confirmados del mismo usuario.
  Los CTA registran engagement y navegan a la superficie segura; no escriben
  dinero.
- Migracion `027_advanced_insights.sql` aplicada y APIs/jobs desplegados en
  `https://manzana.website`.

Regla de seguridad de `action`:

> Registrar que el usuario pulso un CTA no ejecuta una accion financiera. Si el
> CTA mueve dinero o cambia una entidad financiera, debe continuar por el
> endpoint de dominio, `CommandDispatcher` y Core correspondientes.

Pendiente:

- medir utilidad, falsos positivos, repeticiones y conversion por tipo con uso
  real;
- aprobar templates, consentimiento y piloto limitado antes de habilitar
  WhatsApp; Risk, Disclosure, ventana, horario silencioso y frecuencia deben
  revalidarse en cada envio;
- completar la integracion Gmail para evaluar deduplicacion cross-channel con
  pendientes de email reales.

---

## 24. Out of scope V1

Queda fuera de V1:

- recomendaciones financieras profesionales,
- scoring crediticio,
- inversiones,
- predicciones exactas de fin de mes,
- insights sociales comparando contra otros usuarios,
- shareables virales,
- resumen por email completo,
- presupuestos formales por categoria,
- metas/limites completos,
- analisis tributario.

Metas/limites pueden conectarse en el futuro:

```text
Tu cafe va al 80% del limite semanal.
```

Pero solo si la feature formal existe y el usuario configuro ese limite.

---

## 25. Criterios de aceptacion

- Los insights se calculan desde motores/agregados, no desde razonamiento libre del LLM.
- `InsightExperienceAgent` e `InsightNarratorAgent` solo trabajan con insights ya calculados y validados.
- `InsightNarratorAgent` solo narra resultados ya calculados.
- No se muestran insights sin datos suficientes.
- Todo insight tiene evidencia trazable.
- Transferencias y asignaciones internas no cuentan como gasto.
- Email no confirmado no cuenta como movimiento real.
- Cuentas `null` no sostienen insights fuertes de liquidez.
- Hay taxonomia V1 clara.
- Hay umbrales iniciales.
- Hay scoring de calidad.
- Hay acciones sugeridas cuando aportan valor.
- `InsightExperienceAgent` mejora framing, timing y calidad percibida sin calcular ni validar dinero.
- `InsightExperienceAgent` se invoca de forma selectiva, no para todos los insights.
- La experiencia diferencia lenguaje interno (`Insights`) de lenguaje de usuario (`Descubrimientos`, `Lo que Manzana noto`, etc.).
- Existen micro-descubrimientos tempranos que muestran aprendizaje sin inventar patrones.
- La priorizacion favorece insights personales, concretos y reconocibles cuando tienen suficiente confianza.
- Dashboard puede mostrar, explicar, descartar y actuar sobre insights.
- WhatsApp solo envia insights si Nudge Policy, opt-in, horario silencioso, modo discreto y Risk Policy lo permiten.
- Correcciones recalculan o expiran insights afectados.
- Insights ya mostrados o enviados pueden quedar `outdated` y deben mostrar actualizacion segura en Dashboard.
- El primer insight util tiene flujo definido cuando el usuario alcanza 5 movimientos confirmados.
- Existen insights de progreso/refuerzo positivo, no solo alertas de problemas.
- La frecuencia maxima por canal esta definida y debe respetarse.
- El contrato registra historial de entregas por canal.
- Un usuario que solo usa deudas puede recibir insights utiles sin requerir gastos.
- El usuario puede preguntar "por que?" y recibir explicacion segura.

---

*Feature 8/10 del Paso 5 - V2.1*
