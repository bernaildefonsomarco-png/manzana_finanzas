# Brief de experiencia de Manzana

| Campo | Valor |
|---|---|
| Estado | Borrador para aprobación del propietario |
| Versión | 0.1 |
| Fecha | 2026-08-11 |
| Alcance | Dirección del producto y de la experiencia para la próxima auditoría UX |

## Decisión ejecutiva

**Dirección actual.** Manzana se evaluará y rediseñará como un producto centrado en el usuario que convierte un contexto financiero desordenado o incompleto en claridad confiable y un siguiente paso manejable. Debe hacerlo sin exigir que las personas mantengan otro sistema contable.

**Dirección actual.** La conversación es el modelo de interacción principal del producto, no un chatbot auxiliar. Las superficies visuales respaldan la conversación al facilitar la revisión de la evidencia, el estado, la incertidumbre, el historial, las correcciones y el control, así como la actuación sobre ellos.

**Decisión abierta.** El trabajo inicial no está aprobado: entender adónde fue el dinero, saber cuánto se puede gastar con seguridad o evitar compromisos olvidados. Esta decisión es una condición previa al rediseño; el trabajo paraguas provisional no asigna la misma prioridad en la V1 a las tres opciones.

## Propósito y alcance de las decisiones

Este brief es el contrato de evaluación para la auditoría UX: audiencia, modelo del problema, experiencia requerida y afirmaciones sin resolver. La auditoría puede identificar brechas y necesidades de investigación, pero no debe resolver decisiones de producto mediante el diseño de la interfaz.

**Dirección actual.** La unidad de evaluación es el recorrido crítico completo, desde la situación que lo activa hasta su consecuencia y el siguiente paso. La auditoría no debe reducir la experiencia a pantallas aisladas, estados simples de vacío, carga o error, ni higiene visual: debe comprobar qué puede hacer y comprender la persona, qué confianza puede justificar y cómo evoluciona su experiencia funcional, cognitiva y emocional a lo largo del recorrido.

**Fuera de alcance.** Implementación, funcionalidades, despliegue por canales, modelo comercial, lenguaje visual y objetivos numéricos. Nada de lo aquí expuesto reactiva decisiones de `docs/`.

Las etiquetas de estado distinguen la **Dirección actual** aprobada por el propietario, la **Hipótesis respaldada por investigación** externa, la **Hipótesis histórica** congelada, la **Decisión abierta** y lo que está **Fuera de alcance**. Una hipótesis permanece sin validar para Manzana salvo que se indique lo contrario.

## Audiencia principal

**Dirección actual.** El segmento principal probó al menos una forma estructurada de gestionar ingresos o gastos, pero no pudo mantenerla debido a la curva de aprendizaje, la configuración o el registro recurrentes, la categorización, la conciliación, la puesta al día, los olvidos, la falta de practicidad, la pérdida de información o el desorden.

Este segmento se define por el comportamiento previo y el mecanismo de falla, no por datos demográficos ni por un perfil ficticio. Un intento anterior demuestra intención, no falta de disciplina.

### Supuestos no adoptados

- **Dirección actual.** No describir a la audiencia como indisciplinada, perezosa, irresponsable o descuidada con sus finanzas.
- **Decisión abierta.** No se ha aprobado como principal ningún perfil demográfico, de ingresos, geográfico ni de etapa de vida.
- **Decisión abierta.** La evidencia regional no permite establecer quién abandona las herramientas de finanzas personales ni por qué.
- **Decisión abierta.** No se presupone ningún canal de adquisición, dispositivo, plataforma ni frecuencia de interacción.
- **Hipótesis respaldada por investigación.** Los ingresos irregulares pueden intensificar la dificultad, pero todavía no son un atributo obligatorio del segmento.
- **Hipótesis histórica.** Los perfiles de persona definidos anteriormente y sus comportamientos numéricos no son definiciones validadas de la audiencia; véase `docs/fase_1_identidad/01_user_personas.md`.

## Modelo del problema

La clasificación siguiente refleja la confianza en el mecanismo, no la prioridad de implementación.

| Posición | Estado | Mecanismo | Evidencia e implicación |
|---:|---|---|---|
| 1 | **Hipótesis respaldada por investigación** | El esfuerzo recurrente supera el valor obtenido. | La recopilación, la configuración, el registro, la categorización y la conciliación se convierten en trabajo continuo, mientras que el valor llega tarde o no permite actuar. Epstein et al. documentan la carga asociada a la informática personal; Lush, Meagher y Fontes identifican la falta de valor percibido en el desuso y el abandono. Se debe minimizar el mantenimiento y aportar valor a partir del contexto disponible. |
| 2 | **Hipótesis respaldada por investigación** | Una interrupción crea una barrera para retomar el uso. | Tras las interrupciones pueden aparecer tareas acumuladas, culpa, cambios de circunstancias y dudas sobre la calidad de los datos. El regreso con información parcial debe resultar útil, en lugar de exigir una reconstrucción perfecta. |
| 3 | **Hipótesis respaldada por investigación** | La actividad no es un resultado. | Un informe de campo de Common Cents Lab/Irrational Labs encontró una mayor interacción con las funciones de presupuesto sin mejores resultados de gasto. La interacción por sí sola no demuestra valor. |
| 4 | **Hipótesis respaldada por investigación** | La vergüenza puede aumentar el retraimiento. | Gladstone et al. relacionan la vergüenza financiera con el retraimiento y las dificultades económicas. No es evidencia sobre retención en aplicaciones, pero respalda evitar los juicios y los estados de falla expuestos. |
| 5 | **Hipótesis respaldada por investigación** | La imprevisibilidad de los ingresos aumenta la dificultad. | Zhang y Sussman informan de una asociación con una menor participación en la elaboración de presupuestos y con una mayor dificultad o desagrado. La causalidad y la transferencia al contexto local siguen sin resolverse. |
| 6 | **Hipótesis respaldada por investigación** | Las habilidades, la confianza y el costo de transacción condicionan la adopción. | La evidencia específica de Perú aportada por Robles, Miranda y Colan se refiere a servicios financieros digitales, no al abandono de herramientas de finanzas personales. Debe tratarse como punto de partida para la investigación. |

**Hipótesis histórica.** El corpus congelado propuso anteponer la claridad a la contabilidad, tolerar datos imperfectos, permitir la corrección natural, utilizar una configuración progresiva, evitar los juicios y admitir el uso parcial (`docs/fase_3_producto/10_principios_experiencia.md`, `docs/fase_3_producto/13_onboarding_activacion.md`, `docs/fase_3_producto/16_confianza_errores.md`). Estas propuestas son evidencia, no requisitos.

**Hipótesis respaldada por investigación.** El abandono puede deberse a un aprendizaje suficiente o a un cambio de circunstancias. La retención no es el objetivo cuando se alcanza el resultado previsto.

## Trabajo por realizar provisional

**Dirección actual, trabajo paraguas provisional:**

> Cuando mi realidad financiera esté dispersa, incompleta o desactualizada, ayúdame a convertir lo que pueda aportar en una visión confiable y un siguiente paso manejable, para que pueda avanzar sin mantener otro sistema contable.

**Decisión abierta.** Este trabajo paraguas es intencionalmente más amplio que un trabajo inicial del producto. Antes del rediseño, la investigación y la aprobación del propietario deben seleccionar un resultado inicial:

| Trabajo inicial candidato | Evidencia necesaria | Riesgo si es incorrecto |
|---|---|---|
| Entender adónde fue el dinero | Un historial incompleto aun puede proporcionar claridad que permita actuar. | Un registro retrospectivo que no ayuda a tomar la siguiente decisión. |
| Saber cuánto se puede gastar con seguridad | Las personas confían en una respuesta acotada basada en saldos, compromisos, plazos e incertidumbre. | Una falsa confianza causa perjuicios o exige un mantenimiento de rigor contable. |
| Evitar compromisos olvidados | Las obligaciones incumplidas son lo bastante frecuentes y relevantes como para sustentar el valor. | Una herramienta de recordatorios sustituye la comprensión genuina. |

### Resultados deseados

| Tipo | Resultado |
|---|---|
| Funcional | Convertir información parcial en un estado comprensible que distinga la información conocida, ausente, estimada y pendiente. |
| Funcional | Recibir un siguiente paso proporcionado y corregir o rechazar interpretaciones importantes. |
| Funcional | Retomar el uso tras una interrupción sin completar primero las tareas acumuladas. |
| Emocional | Sentir mayor claridad y capacidad, sin recibir calificaciones ni reprimendas. |
| Emocional | Confiar en una incertidumbre visible y conservar el control sobre las acciones con consecuencias. |
| Emocional | Reducir la carga mental en lugar de añadir una obligación recurrente. |

Los resultados emocionales expresan una dirección de experiencia por validar, no sentimientos garantizados ni atribuibles a una persona sin evidencia.

## Tesis de valor y experiencia

**Dirección actual.** La propuesta de valor de Manzana no es «un registro de gastos más fácil». Es obtener claridad financiera útil a pesar de disponer de información imperfecta: Manzana organiza y explica el contexto disponible, mientras el usuario conserva la autoridad sobre la verdad y las acciones. Un esfuerzo reducido debe ofrecer una visión más clara, un límite honesto, una corrección o una acción manejable.

**Hipótesis histórica.** El trabajo anterior propuso calma y claridad (`docs/fase_6_visual/28_identidad_visual_marca.md`). Este brief conserva esos resultados, no sus prescripciones de estilo.

## Principios de experiencia

| Principio | Regla de evaluación |
|---|---|
| Valor antes que mantenimiento | La configuración o la conciliación deben desbloquear un beneficio inmediato y comprensible. |
| Utilidad con contexto parcial | Distinguir entre «insuficiente para esta respuesta» e «insuficiente para aportar cualquier valor». |
| Un siguiente paso manejable | Reducir el espacio de decisión; no crear una lista de tareas financieras. |
| Incertidumbre honesta | Mostrar las estimaciones, los datos ausentes y los límites allí donde afecten al significado. |
| La corrección es normal | Permitir que los usuarios modifiquen la interpretación sin recurrir a soporte ni a flujos contables. |
| Las interrupciones son esperables | Partir de la necesidad presente; hacer que la reconstrucción sea opcional y acotada. |
| El resultado por encima de la interacción | Tratar la frecuencia y el tiempo de uso como indicadores de diagnóstico, no de éxito. |
| La proactividad se gana el permiso | Interrumpir solo con un propósito específico, pertinente y controlable. |
| Un solo producto | La conversación y los elementos visuales comparten estado, lenguaje, evidencia y controles. |
| El recorrido por encima de la pantalla | Evaluar la continuidad funcional, cognitiva y emocional desde la necesidad inicial hasta la consecuencia y el siguiente paso. |
| Dignidad sin manipulación | Favorecer la calma, la agencia, la confianza calibrada y la recuperación sin inducir emociones ni permanencia en beneficio del producto. |

### Antiprincipios

- No exigir una incorporación exhaustiva, un historial completo ni categorías perfectas antes de aportar valor.
- No convertir la conversación en un formulario ni relegarla a servir de soporte para un panel de control.
- No ocultar la evidencia incompleta detrás de respuestas expresadas con seguridad.
- No tratar las interrupciones ni los elementos sin resolver como fallas del usuario.
- No usar vergüenza, miedo, urgencia falsa, infantilización ni celebraciones desproporcionadas ante hechos financieros sensibles para orientar decisiones o permanencia.
- No ofrecer falsa tranquilidad ni recurrir al alarmismo o la minimización al comunicar información difícil.
- No diseñar retención basada en la dependencia ni emplear recordatorios, rachas, volumen de notificaciones o gamificación sin valor para el usuario con el fin de fabricar interacción.
- No declarar alcanzada una emoción deseada sin evidencia directa de los usuarios.
- No dificultar más la corrección que el registro ni equiparar el acabado visual con la calidad centrada en el usuario.

## Contrato de confianza y recuperación tras interrupciones

**Dirección actual.** Ante cualquier afirmación con relevancia financiera, el usuario debe poder determinar qué cree Manzana, cuál es su evidencia e incertidumbre, qué consecuencias tiene y cómo corregirla o rechazarla.

El contrato de experiencia es el siguiente:

1. Las estimaciones y las visiones incompletas no constituyen una verdad establecida.
2. Los cambios con consecuencias se previsualizan o confirman en proporción al riesgo.
3. Las correcciones actualizan la comprensión visible y las conclusiones derivadas.
4. Las acciones fallidas no se presentan como exitosas; los datos sensibles se mantienen bajo un control adecuado al contexto.
5. Tras una interrupción, se retoma el uso a partir de la necesidad presente; la reconstrucción de las tareas acumuladas es opcional y acotada.
6. Si la evidencia no permite respaldar una respuesta, se declara el límite y se solicita la menor cantidad de información que resulte útil.

**Hipótesis histórica.** La fuente, el estado, el impacto, el control y la explicación se propusieron como capas de confianza en `docs/fase_3_producto/16_confianza_errores.md`. La auditoría debe comprobar si esos conceptos son visibles y comprensibles para los usuarios sin incorporar el modelo histórico de implementación.

## Conversación y superficies visuales

| Superficie | Función principal | No debe convertirse en |
|---|---|---|
| Conversación | Recibir intenciones desordenadas; aclarar, explicar, proponer, corregir y guiar. | Un intérprete de comandos, un asistente guiado con guion, un informe o una capa de chat sobre formularios. |
| Superficies visuales | Permitir revisar la evidencia, el historial, el estado, la incertidumbre y los controles. | Un panel decorativo, una verdad independiente o un destino obligatorio. |

**Dirección actual.** Pasar de una superficie a otra no debe exigir traducir términos ni repetir el contexto. Los elementos visuales refuerzan la confianza en la conversación; la conversación facilita la navegación por la complejidad visual.

## Recorrido general hasta el primer valor

| Etapa | Necesidad del usuario | Respuesta requerida de la experiencia | Evidencia de valor |
|---|---|---|---|
| 1. Llegar | Expresar una preocupación real sin aprender un esquema. | Responder a la intención con una forma de comenzar. | La persona comienza con sus propias palabras. |
| 2. Aportar | Compartir contexto parcial. | Organizarlo; preguntar solo lo que cambie el resultado. | La respuesta aporta más que un comprobante de registro de datos. |
| 3. Revisar | Saber qué se infirió y qué información falta. | Mostrar la evidencia, el estado y los límites. | La persona puede explicar qué cree Manzana. |
| 4. Corregir | Conservar la autoridad sobre el significado. | Facilitar directamente la corrección, el rechazo o el aplazamiento. | Una interpretación incorrecta no obliga a comenzar de nuevo. |
| 5. Actuar | Convertir la claridad en progreso. | Ofrecer una acción vinculada con el trabajo inicial seleccionado. | La persona obtiene claridad o completa una acción útil. |

**Decisión abierta.** La etapa 5 no puede especificarse más allá de este nivel hasta que se seleccione el trabajo inicial.

## Experiencia emocional en recorridos completos

**Dirección actual.** La auditoría debe evaluar cada recorrido crítico como una transformación funcional, cognitiva y emocional, no como una secuencia de pantallas. Debe abarcar la necesidad que lo activa, las transiciones entre conversación y superficies visuales, las decisiones y recuperaciones, la consecuencia visible y la claridad sobre lo que sucede después.

El arco siguiente es reutilizable en los recorridos críticos. Describe transiciones deseadas e hipótesis de experiencia, no emociones que Manzana pueda prometer:

| Momento del recorrido | Estado de partida relevante | Transición deseada (hipótesis) |
|---|---|---|
| Llegada con confusión o ansiedad | La persona no sabe cómo expresar su situación ni si puede avanzar con información imperfecta. | Sentirse comprendida y segura para comenzar, y percibir una esperanza realista sin falsa tranquilidad. |
| Aporte de contexto incompleto o sensible | Compartir información puede generar exposición, incertidumbre o temor a ser juzgada. | Sentirse respetada, conservar el control sobre lo que aporta y no sentirse interrogada. |
| Aclaración o malentendido | Una interpretación incorrecta puede provocar frustración o duda sobre la capacidad de recuperación. | Corregir con facilidad, sin vergüenza, castigo ni pérdida del progreso útil. |
| Revisión de evidencia e incertidumbre | La persona necesita distinguir hechos, inferencias, ausencias y límites. | Alcanzar confianza informada y calibrada, no confianza ciega. |
| Confirmación de una acción con consecuencias | La velocidad o la ambigüedad pueden debilitar el control sobre la decisión. | Ejercer una agencia deliberada mediante una previsualización y una reversibilidad proporcionales al riesgo. |
| Recepción de información financiera difícil | La información puede resultar confusa, amenazante o paralizante. | Obtener claridad y una respuesta manejable, sin juicio, alarmismo ni minimización. |
| Finalización de un recorrido | El cierre puede ser ambiguo o no mostrar si algo cambió realmente. | Reconocer el cierre, la consecuencia visible y lo que sucederá a continuación. |
| Regreso tras una interrupción | Las tareas acumuladas pueden evocar culpa o hacer que retomar el uso parezca costoso. | Ser recibida desde el valor presente, sin castigo mediante tareas acumuladas ni culpa. |

Una experiencia emocional ética respalda la dignidad, la calma, la agencia, la confianza calibrada y la recuperación; no intenta forzar a la persona a sentir algo ni a permanecer. Estos resultados son hipótesis que deben validarse mediante entrevistas y pruebas de usabilidad. El equipo no debe inferir sentimientos únicamente a partir de la revisión de la interfaz o de la telemetría, y debe revisar el arco cuando la evidencia de los usuarios lo contradiga.

### Ficha obligatoria de cada recorrido crítico

La auditoría debe producir una ficha por recorrido crítico y un mapa del recorrido emocional vinculado con sus pasos. Cada ficha debe documentar, de forma proporcional al riesgo, estas dimensiones:

| Dimensión | Contenido requerido |
|---|---|
| Situación desencadenante y trabajo del usuario | Qué ocurre, por qué la persona inicia el recorrido y qué progreso busca. |
| Estado inicial | Situación funcional, comprensión disponible y estado emocional relevante al comenzar. |
| Estado final deseado | Qué debe poder hacer y comprender la persona, y qué transición emocional se espera favorecer. |
| Pasos y continuidad entre superficies | Secuencia de extremo a extremo, cambios de canal o superficie, contexto conservado y consecuencias visibles. |
| Preguntas, decisiones y carga | Preguntas que surgen, decisiones necesarias, esfuerzo y carga cognitiva en cada tramo. |
| Momentos de verdad y riesgos | Puntos que construyen o erosionan la confianza, riesgos de interpretación y posibles abandonos. |
| Agencia, control y respuesta del sistema | Opciones disponibles, consentimiento, posibilidad de corregir o aplazar y retroalimentación comprensible. |
| Recuperación | Respuesta ante malentendidos, fallas, interrupciones o regresos tras un lapso, sin pérdida innecesaria de progreso. |
| Cierre y siguiente paso | Señal de finalización, consecuencia confirmada y claridad sobre lo que ocurre después. |
| Evidencia y validación | Evidencia disponible, supuestos pendientes y entrevistas o pruebas de usabilidad necesarias para validar resultados funcionales, cognitivos y emocionales. |
| Mapa emocional | Transiciones deseadas por etapa, señales observables y evidencia de usuario disponible o todavía necesaria. |

## Medidas de éxito y salvaguardas

Este brief no aprueba ningún objetivo numérico. Las líneas de base y los umbrales deben definirse después de la investigación y de validar la instrumentación.

| Medida | Definición | Salvaguarda |
|---|---|---|
| Primera claridad útil | Los usuarios pueden explicar qué entendió Manzana, qué es incierto y por qué les resulta útil. | El almacenamiento o la finalización de la incorporación no cumplen el criterio. |
| Esfuerzo hasta el primer valor | Tiempo y acciones necesarios para alcanzar claridad o realizar una acción útil. | La velocidad no puede ocultar la incertidumbre ni el control. |
| Carga de mantenimiento por valor | Configuración, registro, corrección y puesta al día por cada resultado valorado. | No sacrificar la integridad. |
| Utilidad del siguiente paso | Los usuarios consideran que el paso es pertinente, viable y proporcionado. | Los clics no son suficientes. |
| Recuperación tras una corrección | Un error relevante se corrige y se comprende. | Un menor número de correcciones puede indicar errores ocultos. |
| Recuperación tras una interrupción | El regreso aporta valor sin exigir una puesta al día. | La frecuencia de regreso no es el resultado. |
| Calibración de la confianza | El grado de confianza se corresponde con la integridad y la incertidumbre. | Las respuestas incorrectas expresadas con seguridad son perjudiciales. |
| Continuidad del resultado | Los usuarios realizan el trabajo seleccionado, incluida una salida intencional. | No penalizar un abandono exitoso. |

Las salvaguardas incluyen recordatorios no deseados, correcciones sin resolver, falsos éxitos, exposición de datos sensibles, manifestaciones de vergüenza o presión y decisiones tomadas a partir de una certeza exagerada.

## Registro de supuestos y evidencia

| Afirmación | Estado | Evidencia / limitación |
|---|---|---|
| El segmento principal ha realizado y abandonado un intento estructurado. | **Dirección actual** | Definición conductual aprobada por el propietario; requiere un filtro de selección de participantes e investigación sobre su prevalencia. |
| La falla en la relación entre esfuerzo y valor es el mecanismo central. | **Hipótesis respaldada por investigación** | [Epstein et al., CHI 2016](https://dl.acm.org/doi/10.1145/2858036.2858045); [Lush, Meagher y Fontes, 2020](https://acci.memberclicks.net/assets/docs/CIA/CIA2020/LushMarkCIA2020.pdf). El segundo estudio se realizó en EE. UU. y no establece causalidad. |
| La vergüenza puede contribuir al distanciamiento. | **Hipótesis respaldada por investigación** | [Gladstone et al., 2021](https://www.hbs.edu/faculty/Pages/item.aspx?num=60588). No es un estudio sobre retención en aplicaciones. |
| La imprevisibilidad de los ingresos puede aumentar la dificultad para elaborar presupuestos. | **Hipótesis respaldada por investigación** | [Zhang y Sussman, 2024](https://onlinelibrary.wiley.com/doi/10.1111/joca.12568). Evidencia transversal de EE. UU. |
| Los recordatorios específicos pueden respaldar un objetivo ya elegido. | **Hipótesis respaldada por investigación** | [Karlan et al., 2016](https://poverty-action.org/publication/getting-top-mind-how-reminders-increase-saving). Incluye Perú, pero no justifica recordatorios genéricos para fomentar la interacción. |
| Las percepciones sobre habilidades, confianza y costos de transacción importan en el contexto de adopción de Perú. | **Hipótesis respaldada por investigación** | [Robles, Miranda y Colan, 2024](https://www.sbs.gob.pe/Portals/0/jer/DDT_ANO2024/DT%2004%202024%20VF.pdf). Se refiere a la adopción de servicios financieros digitales, no al abandono de herramientas de finanzas personales. |
| Una mayor interacción con la elaboración de presupuestos no garantiza mejores resultados de gasto. | **Hipótesis respaldada por investigación** | [Common Cents Lab/Irrational Labs, 2021](https://irrationallabs.com/blog/money-budgeting-experiment/). Experimento de campo documentado; sin revisión por pares. |
| La conversación puede aceptar información imperfecta mientras los elementos visuales proporcionan control. | **Dirección actual** | Tesis aprobada por el propietario. Existe respaldo histórico en `docs/fase_3_producto/10_principios_experiencia.md` y `docs/fase_3_producto/13_onboarding_activacion.md`; la usabilidad permanece sin validar. |
| Los perfiles de persona históricos, las afirmaciones sobre competidores, los flujos y las reglas visuales no son requisitos activos. | **Dirección actual** | Son únicamente evidencia congelada: `docs/fase_1_identidad/01_user_personas.md`, `docs/fase_1_identidad/03_analisis_competitivo.md` y `docs/fase_6_visual/28_identidad_visual_marca.md`; véase `docs/AVISO_CORPUS_HISTORICO.md`. |

## Objetivos excluidos

- **Fuera de alcance.** Seleccionar funcionalidades, arquitectura, modelos, fuentes de datos o métodos de automatización.
- **Fuera de alcance.** Prescribir la disposición, el color, la tipografía, la ilustración, los sistemas de componentes o la identidad visual de la marca.
- **Fuera de alcance.** Revalidar por repetición los perfiles de persona históricos o las comparaciones con competidores.
- **Fuera de alcance.** Optimizar la adquisición, la monetización, la viralidad o el uso diario habitual.
- **Fuera de alcance.** Prometer contabilidad integral, asesoramiento financiero o una reconstrucción perfecta.
- **Fuera de alcance.** Usar la auditoría UX para elegir el trabajo inicial sin evidencia explícita ni aprobación del propietario.

## Condiciones para decidir

1. **Decisión abierta: seleccionar el trabajo inicial.** Comparar la frecuencia, las consecuencias, la falla de las alternativas existentes, el valor obtenido con datos incompletos y el riesgo para la confianza. La aprobación del propietario precede al rediseño priorizado.
2. **Decisión abierta: definir un primer valor suficiente.** Indicar qué deben comprender o lograr los usuarios; el registro por sí solo es insuficiente.
3. **Decisión abierta: definir el contrato de evidencia.** Separar la información necesaria, opcional y no segura de inferir.
4. **Decisión abierta: definir el límite entre canales.** Decidir cuándo los elementos visuales mejoran la revisión o el control sin relegar la conversación.
5. **Decisión abierta: aprobar las líneas de base.** Establecer objetivos solo después de una validación cualitativa y una medición confiable.

## Criterios de la auditoría UX

La auditoría debe registrar evidencia para cada criterio en lugar de asignar una puntuación estética genérica.

- [ ] La experiencia sirve a la audiencia conductual sin inventar un perfil demográfico.
- [ ] Cada recorrido crítico se documenta de extremo a extremo mediante la ficha requerida y se evalúa como una transformación funcional, cognitiva y emocional.
- [ ] Cada recorrido crítico incluye un mapa emocional que formula transiciones deseadas, riesgos y evidencia necesaria, sin presentar sentimientos como resultados garantizados.
- [ ] Una preocupación real alcanza claridad útil sin una configuración completa ni un historial exhaustivo.
- [ ] Cada solicitud recurrente de información ofrece un retorno de valor inmediato y comprensible.
- [ ] La conversación maneja contexto natural e incompleto sin convertirse en un formulario ni en una interfaz de comandos.
- [ ] Las superficies visuales muestran evidencia, estado, incertidumbre, corrección y control, en lugar de limitarse a resumir la actividad.
- [ ] La conversación y las superficies visuales usan estados, terminología y consecuencias coherentes.
- [ ] La información ausente se solicita solo cuando cambia la respuesta o la acción.
- [ ] Las estimaciones, las exclusiones y la evidencia insuficiente están visibles cuando tienen consecuencias.
- [ ] Los errores relevantes pueden corregirse sin soporte, sin repetir la incorporación y sin duplicar trabajo.
- [ ] El regreso tras una interrupción aporta valor presente antes de la reconstrucción opcional de las tareas acumuladas.
- [ ] La proactividad es específica, consentida, controlable y está vinculada con un objetivo del usuario.
- [ ] Ningún patrón recurre a manipulación emocional, falsa tranquilidad, retención basada en la dependencia ni gamificación sin valor para el usuario.
- [ ] Los estados aislados de vacío, carga o error y las pantallas visualmente cuidadas se evalúan dentro del recorrido; ningún recorrido se aprueba si fallan su continuidad, comprensión, confianza, agencia, recuperación o cierre.
- [ ] Las conclusiones emocionales se respaldan con entrevistas o pruebas de usabilidad, o se registran como hipótesis pendientes; no se infieren solo de la interfaz o la telemetría.
- [ ] El éxito se evalúa mediante la claridad, la capacidad de actuar, la confianza y la relación entre esfuerzo y valor, no solo por la interacción.
- [ ] Las recomendaciones no eligen de manera implícita un trabajo inicial ni priorizan el acabado por encima de la utilidad, la confianza y la recuperación.

## Próximas acciones de investigación

1. Seleccionar participantes por comportamiento: un intento estructurado previo, una necesidad reciente y una falla específica. Registrar los datos demográficos para el análisis, no como supuestos.
2. Realizar entrevistas en torno a artefactos y episodios: último valor obtenido, primera interrupción, respuesta ante las tareas acumuladas, valor percibido y si dejar de usar la herramienta fue perjudicial o exitoso.
3. Comparar los tres trabajos candidatos mediante entrevistas y pruebas de baja fidelidad: frecuencia, consecuencias, alternativas existentes, evidencia mínima y valor obtenido a partir de información imperfecta.
4. Crear un prototipo de la misma tarea en una conversación y en una superficie visual de apoyo; probar la revisión de la evidencia, la corrección y la continuidad.
5. Comparar la recuperación tras interrupciones centrada en el presente con flujos que exijan primero ponerse al día; observar la carga, la confianza y el valor.
6. Probar la calibración de la confianza con información incompleta e incorrecta; preguntar qué sabe Manzana y qué acción es segura.
7. Validar los arcos emocionales mediante entrevistas y pruebas de usabilidad sobre recorridos completos; contrastar lo que las personas expresan con su comprensión, sus decisiones y su control, sin atribuir sentimientos a partir de telemetría aislada.
8. Probar recordatorios solo para compromisos u objetivos explícitos, no para fomentar una interacción genérica.
9. Obtener una decisión explícita del propietario sobre el trabajo inicial y luego revisar este brief antes del rediseño y de establecer objetivos.

## Lista de verificación para aprobación del propietario

- [ ] Aprobar o revisar la audiencia principal basada en el comportamiento.
- [ ] Aprobar la falla en la relación entre esfuerzo y valor como hipótesis central de investigación, no como un hecho demostrado para Manzana.
- [ ] Aprobar el trabajo paraguas provisional.
- [ ] Mantener abierto el trabajo inicial exacto hasta cumplir la condición de decisión definida.
- [ ] Aprobar la conversación como el producto y las superficies visuales como medios para aportar evidencia, comprensión, corrección y control.
- [ ] Aprobar el contrato de confianza y recuperación tras interrupciones.
- [ ] Aprobar que cada recorrido crítico se evalúe de extremo a extremo, con transformación funcional, cognitiva y emocional, mapa emocional validable y límites explícitos contra la manipulación.
- [ ] Aprobar los criterios de la auditoría UX y las próximas acciones de investigación.
- [ ] Confirmar que ninguna hipótesis histórica ni objetivo numérico se ha elevado a verdad activa.
