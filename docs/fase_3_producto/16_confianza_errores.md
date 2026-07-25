# Confianza, Errores y Correcciones V1

**Documento:** `16_confianza_errores.md`  
**Fase:** 3 - Producto / Experiencia  
**Estado:** V1.1  
**Ultima actualizacion:** 25 de mayo, 2026

---

## 1. Tesis

En Manzana, la confianza no se gana prometiendo que la IA nunca falla. Se gana haciendo que cada dato importante pueda ser entendido, corregido, confirmado o revertido.

La experiencia debe hacer sentir:

> "Si Manzana se equivoca, no pasa nada grave. Lo puedo corregir facil y el sistema aprende."

Por eso V1 debe tratar los errores como parte del producto:

- ambiguedad,
- datos incompletos,
- errores de clasificacion,
- duplicados,
- fallas tecnicas,
- acciones riesgosas,
- datos sensibles,
- cambios que afectan dinero real.

Regla central:

> La IA puede equivocarse en interpretar; el sistema no debe equivocarse en proteger dinero, confirmaciones, auditoria y recuperacion.

---

## 2. Principios

| Principio | Regla |
|---|---|
| Error visible, no dramatico | Si algo falla, decirlo con calma y dar siguiente paso. |
| Corregir es parte del flujo | La correccion no debe sentirse como soporte tecnico. |
| Confirmar antes de riesgo | Borrar, cambiar saldo, cerrar deuda o confirmar varios pendientes requiere confirmacion clara. |
| Pendiente antes que inventar | Si falta informacion, dejar pendiente o pedir un dato minimo. |
| Explicar sin exponer razonamiento | Mostrar fuente, evidencia y resumen; nunca chain-of-thought. |
| Auditar cambios financieros | Toda escritura sensible deja audit log. |
| Recuperar confianza rapido | Despues de un error, resolver primero y explicar solo si ayuda. |
| No culpar al usuario | Mensajes ambiguos, incompletos o caoticos son normales. |
| Politicas antes que creatividad | Riesgo, privacidad y modo discreto ganan sobre tono bonito. |

---

## 3. Modelo de confianza V1

La confianza se sostiene con cinco capas:

```text
1. Fuente
   -> de donde salio el dato?

2. Estado
   -> confirmado, pendiente, corregido, eliminado, estimado?

3. Impacto
   -> afecta saldo, caja, deuda, recurrente, insight o solo historial?

4. Control
   -> puedo corregir, deshacer, borrar, confirmar o rechazar?

5. Explicacion
   -> puedo entenderlo sin recibir razonamiento interno?
```

Todo dato financiero visible debe poder responder al menos las primeras tres capas. Los datos importantes deben responder las cinco.

---

## 4. Estados de confianza de un dato

| Estado visible | Significado | Afecta saldos? | Acciones |
|---|---|---|---|
| Confirmado | El usuario o una regla segura lo acepto. | Si, si el tipo aplica. | Editar, corregir, borrar. |
| Pendiente | Falta aprobacion o dato clave. | No. | Confirmar, editar, rechazar. |
| Necesita revision | Hay movimiento, pero algun campo es dudoso. | Depende del Core; mostrar limite. | Revisar campo. |
| Corregido | Fue cambiado despues de registrarse. | Si recalcula si aplica. | Ver historial, deshacer si disponible. |
| Eliminado | Fue borrado o anulado con confirmacion. | No, o se revierte impacto. | Ver audit trail si aplica. |
| Estimado | Solo sirve para conversacion o orientacion. | No como dato contable. | Completar datos. |
| Archivado | Ya no esta activo, pero queda historial/auditoria. | No activo. | Ver historial si corresponde. |

Regla: un pendiente nunca debe verse como gasto confirmado ni afectar dinero libre.

---

## 5. Taxonomia de errores

| Tipo | Ejemplo | Respuesta esperada |
|---|---|---|
| Dato faltante | "gaste en taxi" | Preguntar una sola cosa: monto. |
| Ambiguedad semantica | "le di 50 a Luis" | Preguntar si fue gasto, prestamo, regalo o pago. |
| Clasificacion dudosa | Taxi personal vs trabajo | Registrar si es seguro y permitir corregir. |
| Cuenta desconocida | "pague con Plin" sin cuenta Plin | Registrar con cuenta `null` y sugerir crear/vincular. |
| Duplicado probable | WhatsApp + email del mismo pago | Marcar o resolver con Dedup Engine. |
| Accion riesgosa | Borrar varios movimientos | Confirmacion explicita. |
| Saldo inconsistente | Cuenta queda negativa | Permitir con advertencia, no bloquear. |
| Email no parseable | Banco cambio formato | No molestar al usuario con ruido; log interno. |
| Falla de envio | WhatsApp no entrega | Reintentar y mover a Dashboard si falla. |
| Insight obsoleto | Correccion cambia evidencia | Actualizar, expirar o marcar outdated. |
| Politica bloquea salida | Modo discreto/opt-in/horario | No enviar o enviar version segura. |

---

## 6. Umbrales de confianza y decision

La confianza no debe ser un numero decorativo. Debe cambiar el comportamiento del sistema.

| Nivel | Decision V1 | Ejemplo |
|---|---|---|
| Alta confianza + bajo riesgo | Ejecutar y permitir correccion. | "gaste 8 en cafe". |
| Media confianza | Ejecutar si el impacto es bajo o pedir aclaracion si afecta dinero importante. | Categoria dudosa. |
| Baja confianza | Preguntar o dejar pendiente. | "creo que gaste algo ayer". |
| Alta confianza + alto riesgo | Pedir confirmacion explicita. | Borrar movimiento o cerrar deuda. |
| Riesgo/politica bloquea | No ejecutar o degradar a version segura. | Modo discreto, opt-in, horario silencioso. |

Acciones internas recomendadas:

| Accion | Uso |
|---|---|
| `silent_accept` | Registrar dato claro y corregible de bajo riesgo. |
| `ask_clarification` | Pedir un dato minimo. |
| `create_pending` | Guardar para revisar si el dominio lo permite. |
| `require_confirmation` | Confirmar antes de escribir o cambiar impacto financiero. |
| `risk_block` | Bloquear accion hasta que se cumpla politica o permiso. |
| `dashboard_only` | Mostrar en Dashboard sin interrumpir por WhatsApp. |

Regla: un score alto no puede saltarse politicas de riesgo, privacidad, opt-in o confirmacion.

---

## 7. Manejo de ambiguedad

### 7.1 Regla de una pregunta

Cuando falta un dato, Manzana debe pedir solo lo necesario para avanzar.

```text
Usuario: gaste en taxi
Manzana: Me falta el monto. ¿Cuanto fue?
```

No hacer:

```text
Necesito monto, cuenta, categoria, fecha y metodo de pago.
```

### 7.2 Ambiguedad financiera

Si el texto puede cambiar el tipo financiero, no asumir.

```text
Usuario: le di 50 a Luis
Manzana: ¿Fue un gasto, un prestamo a Luis o un pago de deuda?
```

Reglas:

- Si afecta deuda, saldo o tipo canonico, preguntar.
- Si es monto pequeno y solo falta cuenta, puede registrar con cuenta `null`.
- Si hay contexto activo, usarlo pero confirmar si el riesgo es alto.
- No convertir prestamos, pagos de deuda o transferencias en gasto por defecto.

### 7.3 Ambiguedad temporal

```text
Usuario: el viernes gaste 30 en comida
Manzana: ¿Te refieres al viernes pasado?
```

Reglas:

- Fechas relativas usan contexto conversacional.
- Si hay riesgo de fecha equivocada, pedir confirmacion.
- No registrar futuro como gasto normal sin validacion.

---

## 8. Expiracion de estados conversacionales

Los estados conversacionales no deben vivir para siempre. Si pasa tiempo, Manzana debe confirmar antes de asumir continuidad.

| Estado | Activo | Suave | Archivado |
|---|---|---|---|
| Aclaracion simple | Hasta 2 horas | Hasta 24 horas | 7 dias |
| Confirmacion de email | Hasta 24 horas | Hasta 3 dias | 14 dias o regla de Pending Inbox |
| Accion riesgosa | Hasta 10 min | Hasta 1 hora | No ejecutar |
| Correccion activa | Hasta 2 horas | Hasta 24 horas | Pedir referencia nueva |
| Deuda multi-paso | Hasta 24 horas | Hasta 7 dias | Convertir a draft o pedir retomar |

Ejemplo:

```text
Usuario, 3 dias despues: si, ese
Manzana: Para estar seguro, ¿te refieres al gasto de Taxi S/18 del 14 de mayo?
```

Reglas:

- Una confirmacion ambigua fuera de ventana no ejecuta acciones de riesgo.
- Si el usuario cambia de intencion, el flujo anterior queda pendiente o archivado con claridad.
- El Orquestador maneja expiracion; los agentes no deben inventar continuidad.

---

## 9. Correcciones

### 9.1 Tesis

La correccion debe ser una interaccion normal, no una falla vergonzosa.

El usuario debe poder decir:

```text
eso era Uber de trabajo
no fue gasto, fue prestamo a Luis
ponlo en salud
fue ayer, no hoy
era 18, no 15
```

### 9.2 Flujo

```text
Usuario corrige
  -> CorrectionAgent interpreta referencia
  -> Core localiza dato candidato
  -> PolicyGate evalua riesgo
  -> Core actualiza si procede
  -> audit_log + transactional_outbox
  -> Learning Engine aprende patron confirmado
  -> ResponseAgent confirma con calma
```

### 9.3 Respuestas

Correccion simple:

```text
Corregido. Lo cambie a Uber de trabajo.
```

Correccion que cambia tipo:

```text
Suena a prestamo a Luis. ¿Lo cambio asi?
```

Correccion incierta:

```text
Creo que te refieres al taxi de ayer por S/18. ¿Ese es?
```

### 9.4 Que aprende el sistema

Puede aprender:

- alias del usuario,
- categoria corregida,
- cuenta usada,
- etiqueta contextual,
- persona relacionada,
- patron de clasificacion.

No debe aprender:

- una correccion no confirmada,
- un dato sensible como regla general sin evidencia,
- una excepcion como patron global.

---

## 10. Deshacer, borrar y cancelar

### 10.1 Diferencias

| Accion | Significado | Confirmacion |
|---|---|---|
| Cancelar | Detener flujo activo no persistido. | No, si no escribio datos. |
| Deshacer | Revertir ultima accion dentro de ventana disponible. | Depende del impacto. |
| Borrar | Eliminar/anular dato persistido. | Si, si afecta dinero o historial. |
| Rechazar | No aceptar pendiente. | Simple; no afecta saldo. |
| Archivar | Sacar de vista sin borrar historial. | Depende del dato. |

### 10.2 Cancelar

```text
Usuario: olvidalo
Manzana: Listo, no registre nada.
```

Si ya habia dato persistido:

```text
Ya habia registrado Cafe S/8. ¿Quieres borrarlo?
```

### 10.3 Borrar

```text
Usuario: borra el taxi de ayer
Manzana: ¿Confirmas borrar el gasto de Taxi S/18 del 14 de mayo?
```

Reglas:

- Decir exactamente que se borra.
- No borrar varios elementos con un "ok?" ambiguo.
- Dejar audit log.
- Recalcular saldos, insights, deudas y recurrentes afectados.

### 10.4 Deshacer

```text
Usuario: deshaz eso
Manzana: Listo. Deshice el ultimo cambio.
```

Si no se puede:

```text
No puedo deshacerlo automaticamente, pero puedo ayudarte a corregirlo.
```

---

## 11. Confirmaciones de riesgo

### 11.1 Acciones que requieren confirmacion explicita

- borrar movimiento confirmado,
- borrar varios movimientos,
- cambiar tipo financiero,
- cambiar saldo de cuenta,
- cerrar deuda,
- aplicar sobrepago,
- fusionar personas relacionadas,
- confirmar multiples pendientes,
- activar recordatorios proactivos,
- desconectar email,
- eliminar cuenta/caja con saldo o historial,
- ajuste manual que afecta dinero libre.

### 11.2 Formato de confirmacion

Una confirmacion debe incluir:

- accion,
- objeto,
- monto si aplica,
- fecha si aplica,
- impacto,
- opciones claras.

Ejemplo:

```text
Esto ajustara el saldo de Yape a S/120 y recalculara tu dinero libre. ¿Confirmas?
```

No usar:

```text
¿Seguro?
```

sin contexto.

---

## 12. Explicabilidad

### 12.1 Que puede preguntar el usuario

```text
de donde salio eso?
por que lo pusiste en transporte?
como calculas dinero libre?
por que me avisaste de esta cuota?
por que dice pendiente?
que cambio despues de corregirlo?
```

### 12.2 Contrato de respuesta

La respuesta debe incluir:

- fuente,
- datos usados,
- estado de confirmacion,
- limite o incertidumbre,
- accion disponible.

Ejemplo:

```text
Vino de un email detectado y lo confirmaste por WhatsApp. Por eso aparece como movimiento confirmado.
```

```text
Lo calcule con tus saldos, cajas y compromisos proximos. No inclui pendientes de email porque aun no estan confirmados.
```

### 12.3 No exponer razonamiento interno

No mostrar:

- chain-of-thought,
- prompts internos,
- scores crudos si no aportan,
- logs tecnicos,
- datos privados innecesarios.

Preferir:

```text
Lo puse en transporte porque el comercio y tus correcciones anteriores apuntan a taxi. Puedes cambiarlo si no corresponde.
```

---

## 13. Fuentes y trazabilidad

Cada dato importante debe tener fuente visible o consultable.

| Fuente | Label visible |
|---|---|
| WhatsApp | WhatsApp |
| Dashboard/manual | Dashboard |
| Email confirmado | Email confirmado |
| Pago que viene confirmado | Pago que viene |
| Correccion del usuario | Corregido |
| Ajuste manual | Ajuste |
| Sistema / recalculo | Recalculo |

### 13.1 Detalle de movimiento

Debe mostrar:

- fuente,
- fecha de creacion,
- fecha del movimiento,
- estado,
- impacto,
- ultima correccion si existe,
- si esta vinculado a deuda, caja, cuenta, recurrente o pendiente.

### 13.2 Audit trail interno

Debe registrar:

- quien/que inicio el cambio,
- antes/despues,
- motivo o comando,
- canal,
- timestamp,
- correlation id,
- outbox/evento asociado.

No necesariamente todo audit trail es visible al usuario, pero debe existir para soporte, depuracion y confianza.

---

## 14. Pendientes y datos incompletos

### 14.1 Pendiente como estado sano

Pendiente no es fracaso. Es el sistema evitando inventar.

```text
Lo dejo pendiente para revisar despues.
```

### 14.2 Reglas

- Pendiente no afecta saldos.
- Pendiente no alimenta insights fuertes.
- Pendiente puede aparecer en Dashboard y busqueda con estado claro.
- Pendiente puede expirar o archivarse segun regla del dominio.
- Pendiente de email nunca se registra sin aprobacion.

### 14.3 Datos incompletos validos

| Dato faltante | Permitido? | Regla |
|---|---|---|
| Cuenta | Si en registros simples. | `account_id = null`; no afecta saldo por cuenta. |
| Categoria | Si como needs_review. | No usar `otros` como sustituto de "sin clasificar". |
| Monto | No para gasto confirmado. | Preguntar o dejar pendiente. |
| Fecha | Default hoy si no hay señal contraria. | Pedir si hay ambiguedad fuerte. |
| Persona | Requerida para deuda/prestamo/devolucion. | Preguntar si falta. |
| Origen/destino | Requerido en transferencia/asignacion. | Preguntar. |

---

## 15. Fallas tecnicas y modo degradado

### 15.1 Tipos de falla

| Falla | Comportamiento |
|---|---|
| LLM no responde | Usar plantilla o pedir reintento breve. |
| Baja confianza del agente | Preguntar o dejar pendiente. |
| Core rechaza validacion | Explicar dato faltante o regla. |
| Email parser falla | No crear pendiente incomprensible; log interno. |
| WhatsApp delivery falla | Reintentar y mover a Dashboard si corresponde. |
| Event Bus falla | Transactional Outbox conserva evento para worker. |
| Dashboard no carga datos | Mostrar estado de error con reintento y no inventar. |
| Duplicado sospechoso | Advertir antes de crear o marcar probable duplicado. |

### 15.2 Copy

```text
No pude registrarlo bien ahora. No hice ningun cambio.
```

```text
Hay un problema cargando tus movimientos. Tus datos no se perdieron; intenta de nuevo en un momento.
```

```text
No estoy seguro de ese dato. Prefiero preguntarte antes de registrarlo mal.
```

### 15.3 No hacer

- Simular exito si no se guardo.
- Ocultar que no se hizo un cambio.
- Reintentar indefinidamente.
- Mostrar errores tecnicos crudos.
- Perder un evento financiero por publicar antes de persistir.

---

## 16. Idempotencia y consistencia tecnica

Confianza no solo es tono. Tambien es que el sistema no duplique, pierda o contradiga movimientos cuando llegan eventos por WhatsApp, Email, Dashboard o workers internos.

### 16.1 Regla general

Toda entrada externa que pueda crear o modificar informacion financiera debe tener una clave de idempotencia.

| Fuente | Clave sugerida |
|---|---|
| WhatsApp | `provider_message_id` + `user_id` |
| Email | `email_event_id` o `message_id` + `user_id` |
| Dashboard | `client_request_id` + `user_id` |
| Automatizacion | `job_id` + entidad objetivo + ventana de tiempo |

Si llega dos veces el mismo evento:

- no se crea doble movimiento,
- se responde o registra como duplicado ignorado,
- se conserva traza interna para diagnostico,
- no se culpa al usuario.

### 16.2 Escrituras financieras

Las escrituras sensibles siguen este orden:

```text
Core ejecuta transaccion
  -> guarda movimiento/cambio valido
  -> guarda audit_log
  -> guarda evento en transactional_outbox
  -> responde exito solo si la transaccion cerro bien
  -> worker publica al Internal Domain Event Bus
```

Si falla la publicacion al Event Bus:

- el movimiento no se pierde,
- el evento queda en outbox,
- el worker reintenta,
- el usuario no ve un error si la escritura ya fue confirmada,
- TraceCollector registra el retraso.

### 16.3 Consumidores internos

Los consumidores de eventos tambien deben ser idempotentes.

Ejemplos:

- Balance Engine no recalcula dos veces con efecto acumulativo.
- Insight Engine no crea dos insights iguales por el mismo evento.
- Nudge Policy no agenda dos recordatorios iguales.
- Recurring Engine no marca dos veces el mismo pago.

Regla: todo handler debe poder recibir el mismo evento mas de una vez sin romper saldos, estados ni experiencia.

---

## 17. Errores por dominio

### 17.1 Email Parsing

| Caso | Comportamiento |
|---|---|
| Token de email expiro | Avisar sin registrar nada; pedir reconexion. |
| Webhook/push duplicado | Ignorar por idempotencia. |
| Email no coincide con plantilla conocida | Usar parser generico o descartar con log; no crear pendiente confuso. |
| Email ambiguo | Crear pendiente solo si hay datos suficientes para revisar. |
| Backfill historico | Agrupar pendientes; no enviar confirmacion individual por cada email antiguo. |
| Usuario no confirma | Pendiente expira/archiva segun regla; nunca afecta saldo. |

Copy:

```text
Detecte un movimiento para revisar, pero necesito tu confirmacion antes de registrarlo.
```

Si el email no puede leerse:

```text
No pude revisar ese correo con suficiente seguridad. No hice ningun cambio.
```

### 17.2 Pagos que vienen y recurrentes

| Caso | Comportamiento |
|---|---|
| Patron probable | Crear candidato o pendiente; no obligacion activa sin confirmacion si falta evidencia. |
| Pago esperado no aparece | Mostrar como pendiente/proximo; no descontar saldo como si ya hubiera ocurrido. |
| Usuario paga antes del nudge | Cancelar o actualizar nudge programado. |
| Monto cambia | Pedir confirmacion si el cambio es relevante. |
| Recurrente vinculado a deuda | Debt Engine decide impacto; no tratar como gasto comun. |
| Recurrente sensible | Modo discreto y PolicyGate antes de proactivo. |

### 17.3 Deudas y personas relacionadas

| Caso | Comportamiento |
|---|---|
| Sobrepago de deuda | Bloquear en V1 y pedir corregir el monto antes de escribir. |
| Varias deudas con misma persona | Preguntar a cual se refiere. |
| Persona ambigua | Preguntar o sugerir coincidencia sin fusionar automaticamente. |
| Alias de persona | Fusionar solo con confirmacion. |
| Deuda en borrador | No generar nudges ni afectar dinero libre hasta confirmarse. |
| Cerrar deuda | Confirmacion explicita con monto/persona/contexto. |

Copy:

```text
Tienes mas de una deuda con Luis. ¿A cual quieres aplicar este pago?
```

### 17.4 Cuentas y cajas

| Caso | Comportamiento |
|---|---|
| Cuenta no especificada | Permitir `account_id = null` en registro simple; sugerir despues si aporta. |
| Saldo negativo | Permitido con advertencia; no bloquear datos imperfectos. |
| Nombre de cuenta duplicado | Pedir aclaracion o sugerir renombrar. |
| Eliminar caja con saldo | Pedir destino del dinero o crear asignacion interna auditada. |
| Transferencia/asignacion | No clasificar como gasto. |
| Caja vinculada a compromiso | No descontar dos veces. |

Copy:

```text
Lo registro sin cuenta por ahora. Despues puedo ayudarte a ordenarlo si quieres.
```

---

## 18. Consistencia entre canales

El usuario no debe sentir que WhatsApp, Dashboard y Email son productos separados. Si corrige o confirma algo en un canal, el resto debe reflejarlo.

### 18.1 Reglas

- Correccion por WhatsApp actualiza Dashboard.
- Edicion en Dashboard afecta respuestas futuras de WhatsApp.
- Pendiente de Email confirmado por WhatsApp aparece como movimiento confirmado.
- Pendiente rechazado desaparece de pendientes activos en todos los canales.
- Insight afectado por correccion se actualiza, expira o marca outdated.
- Si una vista esta desfasada, mostrar estado de actualizacion o refrescar.

### 18.2 Consistencia eventual

Puede haber trabajo asincrono despues de una escritura:

- recalculo de insights,
- actualizacion de agregados,
- cancelacion de nudges,
- deteccion de duplicados tardios.

Durante ese lapso, el sistema puede mostrar:

```text
Ya lo corregi. Estoy actualizando tus resumenes.
```

Pero no debe mostrar un numero viejo como verdad definitiva si sabe que hay un recalculo pendiente.

---

## 19. Reportar problema y soporte ligero

El usuario debe tener una salida clara cuando siente que Manzana se equivoco.

### 19.1 Frases que activan el flujo

- "esto esta mal"
- "eso no es asi"
- "te equivocaste"
- "reportar problema"
- "quiero ayuda"
- "hablar con soporte"

### 19.2 Comportamiento

El sistema debe:

1. reconocer el problema sin discutir,
2. pedir el dato minimo para ubicarlo si falta,
3. ofrecer corregir si es accionable,
4. registrar `support_issue_reported` con correlacion interna,
5. no exponer logs, prompts, stack traces ni IDs tecnicos innecesarios.

Copy:

```text
Gracias por avisarme. Lo reviso contigo. ¿Te refieres al ultimo movimiento o a otro?
```

Si el problema es tecnico:

```text
Gracias. Lo deje marcado para revisar. No hice cambios en tus datos.
```

### 19.3 Trazabilidad interna

El reporte debe guardar:

- `user_id`,
- canal,
- entidad afectada si existe,
- mensaje original,
- ultima accion del sistema,
- `trace_id` interno,
- estado: abierto, resuelto, descartado o necesita_soporte.

---

## 20. Recuperacion emocional despues de error

### 20.1 Secuencia recomendada

```text
1. Reconocer sin dramatizar.
2. Resolver o pedir el dato minimo.
3. Confirmar que paso.
4. Ofrecer correccion/explicacion si aporta.
```

Ejemplo:

```text
Tienes razon, eso no era taxi. Lo corregi a Uber de trabajo.
```

Si Manzana cometio el error:

```text
Gracias por corregirme. Lo cambie y lo tendre en cuenta para la proxima.
```

### 20.2 Tono

Usar:

- "Lo corrijo."
- "Gracias por avisarme."
- "Prefiero preguntarte antes de registrarlo mal."
- "No hice ningun cambio."

Evitar:

- "Error del sistema."
- "Input invalido."
- "No se pudo procesar."
- "Debiste especificar..."
- "Segun mi razonamiento..."

---

## 21. Privacidad, sensibilidad y modo discreto

Confianza tambien significa no exponer al usuario.

### 21.1 Datos sensibles

- montos,
- bancos/cuentas,
- saldos,
- deudas,
- personas,
- comercios sensibles,
- salud,
- apuestas,
- compras intimas,
- categorias delicadas.

### 21.2 Regla

Si la salida es proactiva o fuera de sesion autenticada, `PolicyGate` debe evaluar modo discreto.

Normal:

```text
Detecte Yape S/45 en Restaurante. ¿Lo registro?
```

Modo discreto:

```text
Detecte un movimiento para revisar. ¿Quieres verlo?
```

### 21.3 Errores de privacidad

Si Manzana expone algo que no debia:

- registrar incidente,
- corregir politica,
- no repetir el mismo canal/copy,
- si aplica, informar con lenguaje claro y responsable.

---

## 22. Relacion con sistemas internos

| Sistema | Rol en confianza |
|---|---|
| FinancialOrchestrator | Coordina flujo, riesgo y respuesta. |
| PolicyGate | Decide confirmacion, privacidad, opt-in y bloqueo. |
| Core financiero | Ejecuta escrituras validas y consistentes. |
| Validators | Rechazan datos invalidos o incompletos. |
| Dedup Engine | Evita duplicados cross-channel. |
| Pending Inbox | Protege datos no confirmados. |
| Balance Engine | Recalcula saldos y dinero libre. |
| Debt Engine | Mantiene deuda, pagos y saldos pendientes. |
| Recurring Engine | Maneja pagos que vienen confirmados. |
| Learning Engine | Aprende de correcciones confirmadas. |
| Transactional Outbox | Evita perder eventos despues de escrituras. |
| TraceCollector | Mide errores, confianza, latencia y outcomes. |

Regla: agentes no escriben directamente datos financieros. Proponen; el dominio valida; el Core ejecuta.

---

## 23. Metricas de confianza

| Metrica | Que mide |
|---|---|
| Correction success rate | Correcciones resueltas sin soporte. |
| Post-correction retention | Usuario sigue usando despues de corregir. |
| Undo success rate | Acciones reversibles completadas. |
| Risk confirmation accuracy | Confirmaciones pedidas cuando correspondia. |
| Duplicate prevented rate | Duplicados evitados. |
| Pending resolution rate | Pendientes confirmados/editados/rechazados. |
| Explanation success rate | Usuario entiende fuente/por que. |
| Low-confidence fallback rate | Casos en que Manzana pregunta en vez de inventar. |
| Privacy violation rate | Debe ser 0. |
| Discreet mode violation rate | Debe ser 0. |
| Event loss rate | Debe ser 0 para escrituras financieras. |
| User-visible technical error rate | Errores tecnicos que llegan al usuario. |
| Cross-channel consistency delay | Tiempo hasta que Dashboard/WhatsApp/Email reflejan el mismo estado. |
| Support issue resolution rate | Problemas reportados que se resuelven sin abandono. |

### 23.1 Eventos sugeridos

- `clarification_requested`
- `low_confidence_detected`
- `movement_corrected`
- `movement_correction_confirmed`
- `movement_delete_requested`
- `movement_deleted_confirmed`
- `undo_requested`
- `undo_completed`
- `risk_confirmation_shown`
- `risk_confirmation_accepted`
- `risk_confirmation_cancelled`
- `source_explanation_requested`
- `source_explanation_answered`
- `pending_created`
- `pending_resolved`
- `duplicate_detected`
- `duplicate_prevented`
- `validation_failed`
- `technical_error_user_visible`
- `privacy_policy_blocked_output`
- `discreet_mode_applied`
- `audit_log_written`
- `conversation_state_expired`
- `idempotency_duplicate_ignored`
- `outbox_event_written`
- `outbox_retry_scheduled`
- `outbox_event_published`
- `channel_consistency_refreshed`
- `stale_view_refreshed`
- `insight_outdated_after_correction`
- `email_token_refresh_failed`
- `email_template_fallback_used`
- `email_pending_expired`
- `recurring_candidate_needs_confirmation`
- `recurring_nudge_cancelled_after_payment`
- `recurring_amount_change_needs_confirmation`
- `person_alias_confirmation_requested`
- `account_missing_allowed`
- `support_issue_reported`

---

## 24. Escenarios de prueba

### Escenario 1: dato faltante

```text
Usuario: gaste en taxi
```

Resultado:

- Manzana pregunta monto,
- no registra gasto confirmado,
- puede dejar pendiente si el flujo expira.

### Escenario 2: ambiguedad prestamo/gasto

```text
Usuario: le di 50 a Luis
```

Resultado:

- pregunta si fue gasto, prestamo, regalo o pago,
- no asume gasto.

### Escenario 3: correccion simple

```text
Usuario: eso era Uber de trabajo
```

Resultado:

- localiza movimiento,
- actualiza categoria/etiqueta,
- aprende si se confirma.

### Escenario 4: correccion de tipo

```text
Usuario: eso no fue gasto, fue prestamo a Luis
```

Resultado:

- pide confirmacion si cambia impacto financiero,
- activa Debt Engine,
- recalcula saldos si aplica.

### Escenario 5: borrar movimiento

```text
Usuario: borra el taxi de ayer
```

Resultado:

- pide confirmacion con monto/fecha,
- borra solo si usuario confirma,
- audit log y recalculo.

### Escenario 6: email pendiente

Email detectado por Yape.

Resultado:

- crea pendiente,
- no afecta saldo,
- usuario puede confirmar, editar, rechazar o marcar ya registrado.

### Escenario 7: duplicado probable

Usuario registro por WhatsApp y llega email similar.

Resultado:

- Dedup Engine evita duplicado o marca probable duplicado,
- no crea gasto doble.

### Escenario 8: pregunta de fuente

```text
Usuario: de donde salio ese gasto?
```

Resultado:

- responde fuente, estado y canal,
- no muestra razonamiento interno.

### Escenario 9: dinero libre con pendientes

Resultado:

- no incluye pendientes no confirmados,
- explica limite.

### Escenario 10: modo discreto

Resultado:

- proactivo no expone monto/comercio/persona/deuda,
- Dashboard autenticado puede mostrar detalle.

### Escenario 11: falla tecnica al guardar

Resultado:

- no simula exito,
- dice que no hizo cambios,
- permite reintentar.

### Escenario 12: insight queda obsoleto por correccion

Resultado:

- insight se actualiza, expira o marca outdated,
- no sigue mostrando dato viejo como verdad.

### Escenario 13: sobrepago de deuda

Resultado:

- bloquea el registro y pide corregir el monto,
- no crea movimiento ni modifica deuda/cuotas,
- no cierra deuda incorrectamente.

### Escenario 14: ajuste de saldo

Resultado:

- pide confirmacion,
- escribe audit log,
- recalcula dinero libre.

### Escenario 15: confirmacion expirada

```text
Usuario: si
```

Tres dias despues de una pregunta de confirmacion.

Resultado:

- Manzana no aplica la accion vieja,
- explica que la confirmacion expiro,
- pide reenviar o confirmar de nuevo.

### Escenario 16: email duplicado

Llega dos veces el mismo push de Yape o banco.

Resultado:

- se ignora por idempotencia,
- no se crea doble pendiente,
- queda traza interna.

### Escenario 17: pago recurrente pagado antes del nudge

Usuario paga Netflix antes del recordatorio programado.

Resultado:

- Core registra pago confirmado,
- Recurring Engine actualiza estado,
- Nudge Policy cancela el nudge pendiente.

### Escenario 18: edicion en Dashboard y consulta por WhatsApp

Usuario cambia categoria en Dashboard y luego pregunta por WhatsApp.

Resultado:

- WhatsApp responde con dato actualizado,
- no usa cache antigua,
- si el recalculo sigue en proceso, lo indica.

### Escenario 19: usuario dice "esto esta mal"

Resultado:

- Manzana reconoce sin discutir,
- pregunta a que movimiento o dato se refiere si falta contexto,
- crea traza de soporte ligera,
- permite corregir o explicar fuente.

### Escenario 20: error de email por token expirado

Resultado:

- no crea pendientes nuevos,
- avisa que necesita reconectar email,
- no pierde movimientos ya confirmados.

---

## 25. Criterios de aceptacion

- El documento define estados de confianza para datos financieros.
- Los umbrales de confianza separan baja, media, alta y alto riesgo.
- Los estados conversacionales tienen expiracion y no permiten confirmaciones viejas peligrosas.
- Pendientes no afectan saldos ni se mezclan con confirmados.
- Las correcciones son parte del flujo normal y alimentan aprendizaje solo si se confirman.
- Borrar, deshacer, cancelar, rechazar y archivar quedan diferenciados.
- Acciones riesgosas tienen confirmacion explicita con contexto.
- Explicabilidad muestra fuente, estado, datos usados y limites sin chain-of-thought.
- Todo dato importante tiene fuente visible o consultable.
- Errores tecnicos no simulan exito ni exponen logs crudos.
- Modo discreto y privacidad aplican antes de redactar salidas sensibles.
- Agentes no escriben directamente datos financieros.
- Audit log y transactional outbox protegen escrituras financieras.
- La idempotencia evita duplicados desde WhatsApp, Email, Dashboard y jobs.
- Email, recurrentes, deudas, cuentas y cajas tienen reglas de error propias.
- La consistencia entre canales queda definida para correcciones, pendientes e insights.
- Existe flujo para "esto esta mal" o reporte de problema sin exponer logs tecnicos.
- Hay metricas y eventos para medir confianza, errores y recuperacion.
- Los escenarios cubren dato faltante, ambiguedad, correccion, borrado, email, duplicado, fuente, modo discreto, fallas, expiracion, recurrentes y consistencia cross-channel.

---

*Fase 3 Producto - Documento 16 - V1.1*
