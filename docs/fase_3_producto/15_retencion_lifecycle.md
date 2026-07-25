# Retencion y Lifecycle V1

**Documento:** `15_retencion_lifecycle.md`  
**Fase:** 3 - Producto / Experiencia  
**Estado:** V1.1  
**Ultima actualizacion:** 25 de mayo, 2026

---

## 1. Tesis

La retencion de Manzana no debe depender de perseguir al usuario. Debe depender de que el usuario sienta:

> "Cada vez que vuelvo, Manzana me devuelve mas claridad con menos esfuerzo."

Retener no significa mandar mas mensajes. Significa construir una relacion donde Manzana:

- recuerda lo importante,
- no juzga el desorden,
- reduce carga mental,
- muestra progreso,
- ayuda a cerrar pendientes,
- respeta silencio, privacidad y contexto.

El lifecycle de V1 debe lograr que el usuario pase de:

```text
Lo probe una vez
  -> me resolvio algo pequeno
  -> volvi porque me era util
  -> confio en corregirlo
  -> lo uso a mi manera
```

---

## 2. Que es y que no es retencion en Manzana

### 2.1 Si es

| Tipo | Ejemplo |
|---|---|
| Continuidad util | "Ayer dejaste un gasto pendiente. ¿Lo revisamos?" |
| Resumen con claridad | "Esta semana registraste 8 movimientos y hay 2 pendientes." |
| Recordatorio consentido | "Tienes un pago que viene esta semana." |
| Progreso positivo | "Ya pagaste 2 cuotas seguidas a tiempo." |
| Reentrada amable | "Cuando quieras, puedes seguir con una sola cosa." |
| Dashboard vivo | Home muestra pendientes, ultimos movimientos y descubrimientos cuando hay datos. |

### 2.2 No es

| Anti-patron | Por que rompe confianza |
|---|---|
| Spam financiero | Hace sentir persecucion. |
| Culpa | El usuario evita abrir la app. |
| Rachas agresivas | Infantiliza un tema sensible. |
| Proactivos sin opt-in | Rompe privacidad y control. |
| Mensajes sin accion clara | Parecen ruido. |
| Recordatorios repetidos de algo ya resuelto | Manzana parece desatenta. |
| Insights con poca evidencia | Se siente inventado. |

Regla:

> Si un contacto no da claridad, control, alivio o una accion concreta, no debe enviarse.

---

## 3. Modelo psicologico de retencion

Manzana retiene cuando mejora el estado emocional del usuario.

| Momento | Riesgo emocional | Respuesta de Manzana | Resultado deseado |
|---|---|---|---|
| D0 primer uso | "Esto sera mucho trabajo." | Una accion pequena y resultado real. | "Puedo usarlo." |
| D1 primer retorno | "No se que hacer ahora." | Mostrar siguiente paso simple. | "Puedo seguir sin configurar todo." |
| D3 datos imperfectos | "Lo deje incompleto." | Normalizar pendientes/correcciones. | "No pasa nada, lo ordeno despues." |
| D7 primera semana | "¿Sirvio de algo?" | Resumen o descubrimiento seguro. | "Esto me devuelve claridad." |
| D14 continuidad | "Se me olvida usarlo." | Ruta personal segun uso real. | "Manzana se adapta a mi." |
| D30 valor sostenido | "¿Vale la pena seguir?" | Claridad acumulada y control. | "Esto ya entiende mi ritmo." |
| Vuelta tras silencio | "Me atrasé / me da flojera." | Reentrada sin culpa. | "Puedo volver por una cosa." |

### 3.1 Motores psicologicos

| Motor | Como se activa |
|---|---|
| Alivio | Permitir registrar sin datos perfectos. |
| Control | Corregir, cancelar, pausar y confirmar. |
| Progreso | Mostrar pequenas mejoras o datos acumulados. |
| Autodescubrimiento | Descubrimientos con evidencia y tono amable. |
| Anticipacion util | Avisos de pagos, deudas o pendientes importantes. |
| Confianza | Fuentes, explicaciones, auditabilidad y no inventar. |

---

## 4. Estados de lifecycle

Lifecycle no debe depender solo de dias desde registro. Debe combinar tiempo + comportamiento + calidad de datos.

| Estado interno | Definicion | Producto debe hacer |
|---|---|---|
| `registered_no_value` | Usuario se registro pero no obtuvo resultado real. | Llevar a primera accion simple. |
| `first_value_reached` | Ya obtuvo un registro, consulta, deuda o pendiente util. | Mostrar control y siguiente paso. |
| `activated_min` | Cumple activacion minima del onboarding. | No saturar; consolidar habito. |
| `activated_strong` | Tiene 3+ senales de uso o primer descubrimiento util. | Abrir valor avanzado progresivo. |
| `active_capture` | Registra seguido, pero consulta poco. | Mostrar historial, correccion y resumen ligero. |
| `active_clarity` | Pregunta por dinero libre, resumen o gastos. | Mejorar saldos, cuentas y compromisos. |
| `active_debt` | Usa deudas/pagos como ruta principal. | Priorizar progreso, cuotas y personas. |
| `active_email` | Usa email/pendientes como captura principal. | Optimizar confirmaciones y batch. |
| `quiet` | No usa por algunos dias, sin senal negativa. | Esperar o mostrar valor en Dashboard. |
| `at_risk` | Ignora pendientes, errores o mensajes repetidos. | Reducir friccion, pedir menos, pausar si molesta. |
| `dormant` | No vuelve por periodo prolongado. | Reentrada sin culpa y una accion pequena. |
| `returned` | Vuelve despues de silencio. | Retomar contexto, no reiniciar onboarding. |

### 4.1 Transiciones principales

```text
registered_no_value
  -> first_value_reached
  -> activated_min
  -> activated_strong
  -> active_capture / active_clarity / active_debt / active_email
  -> quiet / at_risk / dormant
  -> returned
```

Regla: un usuario que vuelve despues de silencio no debe ser tratado como nuevo. Manzana debe reconocer continuidad si hay datos previos.

### 4.2 Señales de lifecycle

Lifecycle no debe inferirse solo por dias. Debe leer señales de uso, valor, confianza y friccion.

| Señal | Fuente | Uso |
|---|---|---|
| Primer valor logrado | Onboarding, Core, Dashboard | Pasar de `registered_no_value` a `first_value_reached`. |
| Movimiento confirmado | Core financiero | Medir habito de captura. |
| Consulta respondida | ConversationAgent / herramientas read-only | Detectar ruta de claridad financiera. |
| Pendiente confirmado/rechazado | Pending Inbox | Medir valor de email/olvido convertido en control. |
| Correccion exitosa | CorrectionAgent + Core | Medir confianza recuperada. |
| Deuda creada/pagada | Debt Engine | Activar ruta debt-first. |
| Pago que viene confirmado | Recurring Engine | Activar ruta de compromisos. |
| Descubrimiento visto | Insight Engine / Dashboard | Medir primer wow util. |
| Mensaje ignorado | Canal / Nudge Policy | Reducir frecuencia, no insistir. |
| Pausa/opt-out | Preferencias | Bloquear proactivos no transaccionales. |

### 4.3 Propiedad del lifecycle

Lifecycle es una capa de experiencia, no un agente conversacional autonomo.

```text
Eventos de producto/Core
  -> Lifecycle evaluator
  -> estado lifecycle + señales de oportunidad
  -> NudgeCandidate o Dashboard card
  -> NudgePolicyEngine / PolicyGate
  -> ResponseAgent o plantilla si corresponde
  -> TraceCollector mide outcome
```

Reglas:

- Lifecycle no escribe movimientos, deudas, saldos ni pendientes.
- Lifecycle no envia mensajes directo; genera candidatos o superficies.
- Lifecycle no puede saltarse opt-in, horario silencioso, frecuencia, modo discreto ni sensibilidad.
- Lifecycle usa memoria y preferencias como lectura; no inventa intenciones emocionales como hechos.
- Si hay conflicto entre "retener" y "proteger confianza", gana confianza.

---

## 5. Canales y permisos

| Canal | Rol en retencion | Regla |
|---|---|---|
| Dashboard Home | Retencion pasiva y control visual. | Puede mostrar pendientes, resumen, descubrimientos y CTA sin interrumpir. |
| WhatsApp iniciado por usuario | Conversacion, registro, consulta y recuperacion. | Responder con detalle si la politica lo permite. |
| WhatsApp proactivo | Recordatorios y reentrada selectiva. | Requiere opt-in aplicable, PolicyGate, horario y frecuencia. |
| Email parsing | Captura pasiva que genera pendientes. | Nunca registra sin confirmacion. |
| Notificaciones futuras | Fuera o limitado en V1. | Deben seguir modo discreto y opt-in. |

### 5.1 Tipos de contacto

| Tipo | Requiere opt-in? | Ejemplo | Nota |
|---|---|---|---|
| Respuesta directa | No, usuario inicio. | "¿Cuanto gaste ayer?" | No es nudge. |
| Confirmacion transaccional | Segun canal/permisos, pero no es marketing. | Email detectado por confirmar. | Igual respeta horario, batch y privacidad. |
| Recordatorio proactivo | Si. | Pago que viene, cuota, pendiente. | Pasa por Nudge Policy. |
| Resumen semanal por WhatsApp | Si. | Cierre semanal. | Maximo frecuencia definida por policy. |
| Dashboard card | No opt-in externo. | Card en Home. | No interrumpe; respeta privacidad visual del Dashboard. |

Regla: lifecycle no puede saltarse `NudgePolicyEngine`.

### 5.2 Cadencia y supresion V1

Lifecycle debe tener limites propios, ademas de los limites globales de Nudges.

| Contacto | Limite V1 |
|---|---|
| Reentrada por silencio | Maximo 1 cada 7 dias despues de inactividad. |
| Resumen semanal por WhatsApp | Maximo 1 por semana y solo con opt-in. |
| Resumen mensual | Maximo 1 por mes y solo si hay valor real. |
| Misma razon de reentrada | Cooldown minimo de 14 dias si fue ignorada. |
| Usuario ignora 3 contactos del mismo tipo | Reducir frecuencia o sugerir pausa. |
| Usuario tuvo accion reciente | No enviar reentrada generica el mismo dia. |
| Evento transaccional importante | Puede desplazar resumen/reentrada. |

Reglas:

- Si el usuario ya resolvio el tema, suprimir el contacto.
- Si el usuario acaba de corregir un error, priorizar confianza y no vender valor.
- Si hay un pago/deuda proxima y un resumen semanal, gana el compromiso.
- Si el mensaje no tiene accion concreta, va a Dashboard o no se muestra.

---

## 6. Timeline V1: D0 a D30

El timeline es una guia, no una automatizacion ciega. Cada contacto depende de actividad, opt-in, canal, sensibilidad y valor real.

### 6.1 D0 - Primer valor

Objetivo:

- que el usuario haga una accion real,
- que vea control,
- que no sienta setup pesado.

Señales deseadas:

- `first_value_reached`,
- `first_movement_confirmed`,
- `first_debt_created`,
- `first_query_answered`,
- `first_pending_confirmed`,
- `dashboard_empty_cta_clicked`.

Experiencia:

```text
Listo. Cafe S/8 registrado.
Si me equivoco en algo, puedes decirme "corrige eso".
```

No hacer:

- pedir email, cuenta, caja y recordatorios de golpe,
- mandar resumen sin datos,
- prometer patrones.

### 6.2 D1 - Continuidad suave

Objetivo:

- ayudar a volver por una segunda accion,
- reforzar que no hace falta ordenar todo.

Si el usuario abre Dashboard:

```text
Tus primeros movimientos estan aqui. Puedes registrar otro o corregir cualquiera.
```

Si WhatsApp proactivo esta permitido y hay valor:

```text
Si quieres seguir, puedes mandarme otro gasto o preguntarme cuanto llevas hoy.
```

Si no hay opt-in:

- no enviar WhatsApp proactivo,
- usar Dashboard Home como superficie.

No hacer:

- "Te falta completar tu perfil."
- "Aun no configuraste cuentas."

### 6.3 D3 - Primer habito o rescate temprano

Objetivo:

- detectar si el usuario esta formando habito,
- rescatar sin culpa si no volvio,
- cerrar pendientes si existen.

Ramas:

| Situacion | Accion |
|---|---|
| 2+ movimientos | Mostrar estado de aprendizaje. |
| Pendientes de email | Sugerir revision batch. |
| Deuda activa | Mostrar estado y proximo paso opcional. |
| Sin segundo uso | Reentrada con una accion pequena si policy lo permite. |
| Error/correccion reciente | Reforzar confianza, no pedir mas setup. |

Copy posible:

```text
Puedes seguir con una sola cosa. Si recuerdas algun gasto de estos dias, me lo mandas como salga.
```

### 6.4 D7 - Primera semana de claridad

Objetivo:

- que el usuario sienta que sus datos ya devuelven valor,
- producir un primer resumen o descubrimiento seguro.

Dashboard Home debe priorizar:

- movimientos confirmados,
- pendientes por revisar,
- dinero libre si hay datos,
- primer descubrimiento `learning_progress`,
- deudas/pagos que vienen si existen.

WhatsApp semanal solo si hay opt-in:

```text
Esta semana registraste 8 movimientos. Hay 2 pendientes por revisar. ¿Quieres verlos?
```

Si hay pocos datos:

```text
Todavia estoy aprendiendo tu ritmo. Con unos movimientos mas podre mostrarte patrones utiles.
```

No hacer:

- comparativas fuertes con poca evidencia,
- culpar por no registrar,
- enviar resumen si no hay nada util.

### 6.5 D14 - Personalizacion por ruta

Objetivo:

- adaptar la experiencia a como el usuario realmente usa Manzana.

Rutas:

| Ruta detectada | Experiencia D14 |
|---|---|
| Registro rapido | Mostrar historial, busqueda y correccion facil. |
| Claridad financiera | Sugerir cuenta/saldo si falta para dinero libre. |
| Deuda-first | Mostrar progreso, cuotas y personas relacionadas. |
| Email-first | Mejorar batch de pendientes y dedup. |
| Dashboard-first | Mostrar filtros, detalle y primer descubrimiento. |
| Usuario quiet | Reentrada de baja presion. |

Copy de reentrada:

```text
Cuando quieras, podemos retomar por una cosa: un gasto, una deuda o revisar pendientes.
```

### 6.6 D30 - Valor sostenido

Objetivo:

- demostrar acumulacion de valor,
- abrir features mas profundas solo si hay evidencia.

Superficies recomendadas:

- Dashboard: resumen mensual, cambios, categorias principales, deudas, pagos que vienen.
- WhatsApp opt-in: resumen mensual compacto o invitacion a revisar.
- Configuracion: recordatorios/email/cuentas solo si hay beneficio claro.

Copy:

```text
Ya hay suficiente historial para ver algunos cambios del mes. Te muestro lo mas claro, sin asumir de mas.
```

No hacer:

- lanzar "diagnosticos financieros" grandilocuentes,
- empujar metas/limites si no existen configuradas,
- activar recordatorios nuevos sin consentimiento.

---

## 7. Playbooks por perfil de uso

### 7.1 Usuario de registro rapido

Senales:

- registra gastos simples,
- casi no pregunta,
- usa WhatsApp mas que Dashboard.

Retencion:

- confirmaciones rapidas,
- resumen semanal opt-in,
- recordatorio de correccion,
- Dashboard con historial simple.

No empujar:

- categorias manuales,
- cajas,
- email temprano si no aporta.

### 7.2 Usuario de claridad financiera

Senales:

- pregunta "cuanto tengo", "puedo gastar", "por que me queda poco".

Retencion:

- pedir saldo/cuenta minimo,
- explicar limites,
- mostrar dinero libre solo con datos suficientes,
- sugerir cajas/compromisos cuando el beneficio sea claro.

### 7.3 Usuario debt-first

Senales:

- registra deudas, pagos, cuotas o personas.

Retencion:

- progreso de deuda,
- recordatorio de cuota solo con opt-in,
- resumen de personas,
- estado de deuda sin juicio.

Copy:

```text
Tu deuda con Luis bajo a S/70. Si quieres, puedo recordarte el proximo pago.
```

No hacer:

- llamar "moroso" al usuario,
- enviar recordatorios a terceros,
- convertir deuda en gasto generico.

### 7.4 Usuario email-first

Senales:

- conecta email,
- confirma pendientes,
- usa menos registro manual.

Retencion:

- pendientes agrupados,
- confirmacion simple,
- dedup silencioso,
- recordatorio batch si hay acumulacion y policy lo permite.

No hacer:

- notificar cada email si hay saturacion,
- registrar sin confirmar,
- mostrar contenido privado del email.

### 7.5 Usuario Dashboard-first

Senales:

- entra a revisar,
- usa filtros, detalle o registro manual.

Retencion:

- Home vivo,
- movimientos recientes,
- pendientes visibles,
- detalle confiable,
- descubrimientos en Dashboard antes que WhatsApp.

### 7.6 Usuario quiet o intermitente

Senales:

- usa por rachas,
- vuelve despues de varios dias,
- no responde recordatorios.

Retencion:

- reentrada sin culpa,
- una accion pequena,
- pausar si no responde,
- no reiniciar onboarding.

Copy:

```text
Podemos retomarlo por una cosa. Si recuerdas un gasto o deuda, me lo dices como salga.
```

---

## 8. Re-engagement despues de silencio

Re-engagement no es insistir. Es abrir una puerta util.

### 8.1 Estados por silencio

| Estado | Señal | Comportamiento |
|---|---|---|
| `quiet` | 2-6 dias sin accion, sin pendientes criticos. | No molestar; Dashboard espera. |
| `at_risk` | 7-14 dias sin accion o errores no resueltos. | Una reentrada si policy lo permite. |
| `dormant` | 15-30+ dias sin accion. | Mensaje muy ligero o Dashboard only. |
| `returned` | Usuario vuelve despues de silencio. | Retomar contexto sin culpa. |

### 8.2 Reglas

- No mencionar "abandonaste".
- No decir "te atrasaste".
- No acumular culpa por pendientes.
- No enviar mas de una reentrada si no hay respuesta, salvo evento transaccional importante.
- Si el usuario ignora varios recordatorios, sugerir pausar.
- Si modo discreto esta activo, ocultar detalles sensibles.

### 8.3 Copies

```text
Cuando quieras, podemos retomar por una sola cosa.
```

```text
Tienes pendientes por revisar. Si prefieres, los vemos juntos en un resumen.
```

```text
Veo que estos recordatorios no te estan sirviendo mucho. ¿Los pauso?
```

No usar:

```text
Hace dias que no registras gastos.
```

```text
Estas perdiendo control de tus finanzas.
```

---

## 9. Superficies de retencion

### 9.1 Dashboard Home

Home debe ser la superficie principal de retencion pasiva.

Puede mostrar:

- accion sugerida,
- pendientes,
- ultimos movimientos,
- dinero libre si hay datos,
- compromisos proximos,
- deuda/progreso si aplica,
- primer descubrimiento,
- estado de aprendizaje.

No debe mostrar:

- graficos vacios,
- alertas de culpa,
- todos los modulos a la vez,
- recomendaciones sin evidencia.

### 9.2 WhatsApp

WhatsApp retiene cuando:

- el usuario inicia,
- hay confirmacion transaccional,
- hay recordatorio consentido,
- hay resumen opt-in,
- hay reentrada con valor claro.

Cada mensaje proactivo debe tener:

- motivo,
- accion concreta,
- permiso/policy,
- sensibilidad evaluada,
- opcion de pausar si corresponde.

### 9.3 Pendientes

Pendientes retiene porque convierte olvido en control.

Reglas:

- Pendiente no afecta saldo.
- Pendiente debe poder confirmarse, editarse, rechazarse o marcarse como ya registrado.
- Si hay muchos, agrupar.
- Si son antiguos, explicar que siguen sin afectar saldos.

### 9.4 Descubrimientos

Descubrimientos retienen cuando el usuario siente:

- "esto me mostro algo util",
- "esto no me juzgo",
- "esto sale de mis datos".

Reglas:

- Dashboard primero.
- WhatsApp solo con opt-in y valor claro.
- No repetir el mismo insight.
- Actualizar si los datos cambian.

---

## 10. Relacion con Nudge Policy

Lifecycle puede generar candidatos, pero no decide enviarlos libremente.

```text
Lifecycle signal
  -> NudgeCandidate
  -> NudgePolicyEngine
  -> PolicyGate
  -> canal permitido
  -> ResponseAgent/plantilla
```

Gates obligatorios:

- opt-in,
- horario silencioso,
- frecuencia,
- sensibilidad,
- modo discreto,
- duplicados,
- si el usuario ya resolvio el tema,
- si hay un candidato mas importante compitiendo.

Regla: si varios lifecycle prompts compiten, gana el de mayor utilidad concreta o se agrupan. No se envian todos.

### 10.1 Quality Gate de retencion

Antes de crear contacto proactivo, lifecycle debe pasar estas preguntas:

| Pregunta | Si falla |
|---|---|
| ¿Hay valor concreto para el usuario ahora? | No enviar. |
| ¿Hay evidencia suficiente? | Dashboard only o esperar. |
| ¿Hay una accion clara? | No enviar. |
| ¿El canal tiene permiso? | No enviar por ese canal. |
| ¿Puede exponer informacion sensible? | Modo discreto o Dashboard only. |
| ¿El tema ya fue resuelto? | Suprimir. |
| ¿Hay otro candidato mas importante? | Agrupar, diferir o descartar. |
| ¿El usuario viene ignorando este tipo? | Reducir frecuencia o pausar. |

> La meta de lifecycle no es aumentar mensajes. Es aumentar momentos utiles.

### 10.2 Prioridad de candidatos

Cuando compiten varios candidatos, la prioridad V1 es:

1. Confirmacion transaccional necesaria agrupada.
2. Pago/deuda vencida o proxima.
3. Pendientes importantes de email o revision.
4. Correccion/error reciente que requiere recuperar confianza.
5. Resumen semanal o mensual con valor real.
6. Primer descubrimiento seguro.
7. Progreso positivo.
8. Reentrada por silencio.

Regla: si hay duda entre interrumpir o guardar en Dashboard, guardar en Dashboard.

---

## 11. Lifecycle y datos incompletos

Manzana no debe esperar datos perfectos para retener, pero tampoco debe fingir precision.

| Situacion | Comportamiento |
|---|---|
| Sin cuenta | Puede mostrar historial, no dinero libre completo. |
| Cuenta `null` en varios movimientos | Sugerir revisar "sin cuenta asignada" si aporta. |
| Sin categorias claras | Mostrar aprendizaje, no patrones. |
| Pocos movimientos | Primer insight de progreso, no diagnostico. |
| Deuda sin fecha | Mostrar deuda activa, fecha opcional. |
| Email conectado con pendientes | Mostrar pendientes, no saldos afectados. |

Copy:

```text
Puedo mostrarte el historial. Para calcular dinero libre mejor, me falta saber al menos un saldo.
```

---

## 12. Learning y personalizacion

La retencion mejora cuando Manzana aprende preferencias reales.

Puede aprender:

- horario en que responde mejor,
- canal preferido,
- temas que le interesan,
- sensibilidad a recordatorios,
- categorias corregidas,
- cuentas usadas,
- si prefiere resumen o mensajes puntuales,
- si es usuario de deudas, email, Dashboard o captura rapida.

No debe aprender:

- patrones no confirmados como verdad,
- preferencias inferidas de datos sensibles sin cuidado,
- que silencio significa permiso para insistir,
- que ignorar un mensaje permite aumentar frecuencia.

Regla: personalizacion debe reducir friccion, no aumentar manipulacion.

### 12.1 Loops de valor por ruta

La retencion debe nacer de loops de valor, no de recordatorios artificiales.

| Ruta | Loop de valor |
|---|---|
| Registro rapido | Registrar -> ver historial -> corregir facil -> registrar de nuevo. |
| Claridad financiera | Preguntar -> recibir respuesta honesta -> completar dato minimo -> obtener mejor claridad. |
| Debt-first | Registrar deuda/pago -> ver saldo/progreso -> recibir aviso consentido -> pagar/actualizar. |
| Email-first | Detectar -> revisar batch -> confirmar/rechazar -> reducir olvido. |
| Dashboard-first | Entrar -> ver resumen vivo -> revisar detalle -> descubrir o corregir. |
| Quiet/intermitente | Volver -> retomar contexto -> hacer una accion pequeña -> recuperar continuidad. |

Cada loop debe tener:

- disparador natural,
- accion pequeña,
- recompensa de claridad,
- control para corregir/pausar,
- siguiente paso opcional.

### 12.2 Lineas rojas

Lifecycle no debe usar tecnicas que generen ansiedad artificial.

No hacer:

- rachas punitivas,
- contadores de culpa,
- "estas perdiendo control",
- "te estas atrasando",
- presion por configurar features,
- mensajes diseñados solo para subir engagement,
- insistir mas porque el usuario no respondio.

Si una estrategia mejora una metrica pero empeora confianza, no va.

---

## 13. Metricas de retencion V1

| Metrica | Que mide |
|---|---|
| D1 return | Usuario vuelve tras primer valor. |
| D7 active | Usuario registra, consulta, confirma pendiente o abre Dashboard en 7 dias. |
| D30 retained | Usuario obtiene valor despues de 30 dias. |
| 3 movimientos en 7 dias | Habito inicial de captura. |
| Dashboard weekly visit | Claridad visual como habito. |
| Pendientes resueltos | Email/olvido convertido en control. |
| Post-correction retention | Confianza despues de error. |
| Nudge response | Si un recordatorio fue util. |
| Nudge opt-out rate | Si Manzana esta molestando. |
| Quiet user return | Vuelta sin culpa despues de silencio. |
| First insight engagement | Primer wow util. |
| Debt-first retention | Valor para usuarios que solo usan deudas. |
| Lifecycle contact usefulness | Si el contacto genero accion util o respuesta positiva. |
| Fatigue rate | Ignorados, pausas y opt-outs por tipo de lifecycle. |
| Route accuracy | Si la ruta detectada coincide con el comportamiento posterior. |
| Value loop completion | Si el usuario completa el loop de valor de su ruta. |
| Dashboard-only save rate | Casos en que se evito interrumpir y se guardo en Home. |

### 13.1 Eventos sugeridos

- `lifecycle_state_changed`
- `lifecycle_signal_generated`
- `lifecycle_candidate_ranked`
- `d1_returned`
- `d3_active`
- `d7_active`
- `d14_route_detected`
- `d30_retained`
- `weekly_review_viewed`
- `weekly_review_sent`
- `weekly_review_acted`
- `reengagement_candidate_created`
- `reengagement_sent`
- `reengagement_responded`
- `reengagement_suppressed`
- `lifecycle_contact_suppressed_by_policy`
- `lifecycle_contact_suppressed_by_fatigue`
- `quiet_user_returned`
- `returned_context_resumed`
- `nudge_paused_from_lifecycle`
- `dashboard_home_value_seen`
- `lifecycle_dashboard_card_seen`
- `lifecycle_prompt_dismissed`
- `retention_risk_detected`
- `route_detected`
- `route_changed`
- `value_loop_completed`
- `retention_contact_helpful`

---

## 14. Escenarios de prueba

### Escenario 1: D1 con primer registro

Usuario registro un gasto en D0 y vuelve en D1.

Resultado:

- ve historial o puede registrar otro,
- no se le exige configurar cuenta,
- se le recuerda suavemente que puede corregir.

### Escenario 2: D3 sin segundo uso

Usuario tuvo primer valor pero no volvio.

Resultado:

- si no hay opt-in, no WhatsApp proactivo,
- Dashboard muestra una accion simple,
- si policy permite reentrada, copy sin culpa.

### Escenario 3: D7 con pocos datos

Usuario tiene 2 movimientos.

Resultado:

- no hay insight fuerte,
- se muestra estado de aprendizaje,
- se invita a registrar o revisar pendientes.

### Escenario 4: D7 con 5+ movimientos

Resultado:

- aparece `learning_progress`,
- Dashboard lo muestra,
- WhatsApp solo si opt-in y frecuencia disponible.

### Escenario 5: deuda-first

Usuario solo registra deudas y pagos.

Resultado:

- lifecycle usa deudas como ruta valida,
- no fuerza categorias de gasto,
- puede mostrar progreso de deuda.

### Escenario 6: email-first con muchos pendientes

Resultado:

- se agrupan pendientes,
- no se envian 10 mensajes individuales,
- nada afecta saldos hasta confirmacion.

### Escenario 7: usuario ignora recordatorios

Resultado:

- no aumenta frecuencia,
- puede sugerir pausar,
- registra opt-out si responde negativamente.

### Escenario 8: modo discreto activo

Resultado:

- reengagement y recordatorios no exponen montos, comercios, bancos, saldos, personas o deudas.

### Escenario 9: vuelve despues de 30 dias

Resultado:

- Manzana retoma contexto,
- no reinicia onboarding,
- propone una accion pequena.

### Escenario 10: correccion reciente

Usuario corrigio un error.

Resultado:

- no se envia insight basado en dato viejo,
- Learning Engine actualiza patron,
- retencion mide si sigue usando despues del error.

### Escenario 11: usuario dice "no me escribas"

Resultado:

- se pausan proactivos no transaccionales,
- se confirma control de forma breve,
- lifecycle no crea reentradas hasta que el usuario reactive.

### Escenario 12: varios candidatos compiten

Hay resumen semanal, cuota proxima y reentrada por silencio.

Resultado:

- gana cuota proxima si policy lo permite,
- resumen se guarda en Dashboard o se difiere,
- reentrada se suprime.

### Escenario 13: usuario vuelve despues de 30 dias con pendientes antiguos

Resultado:

- no se le culpa,
- se explica que pendientes no afectaron saldos,
- se ofrece revisar en batch o empezar por un movimiento nuevo.

### Escenario 14: usuario solo usa Dashboard

Resultado:

- lifecycle usa Home como superficie principal,
- no fuerza WhatsApp,
- mide visitas, revisiones, registros manuales y correcciones.

### Escenario 15: primer valor fue una pregunta, no un gasto

Resultado:

- `first_value_reached` puede activarse por respuesta util,
- D1/D3 sugieren otra pregunta o un dato minimo,
- no se fuerza registro si el usuario busca claridad primero.

### Escenario 16: tema sensible

Hay deuda, salud, apuesta o compra delicada.

Resultado:

- proactivo usa modo discreto o Dashboard only,
- no expone monto, comercio, persona ni banco,
- si no hay valor claro, no se envia.

---

## 15. Criterios de aceptacion

- El documento distingue retencion de spam.
- D0, D1, D3, D7, D14 y D30 tienen objetivo claro.
- Lifecycle depende de comportamiento, no solo dias desde registro.
- Existen estados internos de lifecycle.
- Lifecycle define señales, propiedad y limites: no escribe dinero ni envia mensajes directo.
- Usuarios de gastos, deudas, email, Dashboard y claridad financiera tienen playbooks propios.
- Re-engagement no usa culpa ni presion.
- WhatsApp proactivo respeta opt-in, horario silencioso, frecuencia y modo discreto.
- Cadencia, cooldown y supresion evitan insistencia.
- Quality Gate define cuando enviar, guardar en Dashboard o suprimir.
- Dashboard Home funciona como superficie principal de retencion pasiva.
- Pendientes, descubrimientos, deudas y pagos que vienen pueden alimentar retencion sin romper sus reglas.
- No se envian recordatorios de datos ya resueltos.
- Los silencios del usuario reducen o pausan insistencia; no aumentan frecuencia.
- Retencion puede funcionar con datos incompletos, pero sin inventar precision.
- Los loops de valor por ruta explican por que el usuario vuelve.
- Lifecycle evita estrategias manipulativas aunque mejoren engagement.
- Eventos y metricas permiten medir utilidad real, molestia y retorno.

---

*Fase 3 Producto - Documento 15 - V1.1*
