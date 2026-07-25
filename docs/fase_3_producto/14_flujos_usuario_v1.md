# Flujos de Usuario V1

**Documento:** `14_flujos_usuario_v1.md`  
**Fase:** 3 - Producto / Experiencia  
**Estado:** V1.1  
**Ultima actualizacion:** 25 de mayo, 2026

---

## 1. Tesis

Los flujos de Manzana no deben sentirse como usar modulos separados. El usuario no piensa en "Motor IA", "Dashboard", "Debt Engine" o "Pending Inbox". Piensa:

> "Quiero anotar algo, entender algo, corregir algo o que Manzana me ayude a no olvidarlo."

V1 debe convertir cada intencion en un camino corto, claro y controlable.

Regla central:

> Manzana responde primero a la intencion del usuario. Despues, solo si aporta valor, enseña, sugiere o pide configuracion.

---

## 2. Principios de flujo

| Principio | Regla |
|---|---|
| Intencion antes que pantalla | El flujo empieza por lo que el usuario quiere lograr, no por donde esta. |
| Menos pasos con mas criterio | Pedir solo el dato que desbloquea la accion actual. |
| Control visible | El usuario puede corregir, cancelar, confirmar, pausar o revisar. |
| Dinero exacto | Saldos, deudas, cajas, recurrentes y pagos usan motores deterministicos. |
| IA como traductor | IA entiende lenguaje, contexto e intencion; no inventa dinero ni ejecuta reglas financieras sola. |
| Canales complementarios | WhatsApp captura y conversa; Dashboard revisa, corrige y da control visual. |
| Pendiente no es confirmado | Nada pendiente afecta saldos o deudas hasta confirmacion. |
| Uso parcial valido | Cada flujo debe funcionar aunque el usuario no use todas las features. |
| Privacidad por defecto | Modo discreto, opt-ins y sensibilidad pueden cambiar la salida visible. |
| Experiencia agradable | Cada flujo debe dejar alivio, claridad, control o ganas de volver. |

---

## 3. Anatomia de un flujo V1

Todo flujo debe documentarse con este contrato:

| Campo | Pregunta |
|---|---|
| Intencion | Que quiere lograr el usuario? |
| Estado emocional | Como llega probablemente? |
| Entrada | WhatsApp, Dashboard, Email, Scheduler o ayuda conversacional. |
| Respuesta visible | Que ve o lee el usuario? |
| Sistema interno | Que agente, motor o politica interviene? |
| Confirmacion | Hace falta confirmar antes de escribir o afectar dinero? |
| Resultado | Que queda persistido, mostrado o actualizado? |
| Siguiente paso | Que opcion pequena queda disponible? |
| No hacer | Que rompería confianza, privacidad o calidad? |

---

## 4. Mapa general de flujos V1

| # | Flujo | Canal principal | Resultado esperado |
|---|---|---|---|
| 1 | Registro simple por WhatsApp | WhatsApp | Movimiento confirmado o aclaracion minima. |
| 2 | Registro multiple por WhatsApp | WhatsApp | Varios movimientos separados y resumen compacto. |
| 3 | Registro manual desde Dashboard | Dashboard | Movimiento estructurado creado por Core. |
| 4 | Correccion de movimiento | WhatsApp / Dashboard | Movimiento corregido + aprendizaje. |
| 5 | Borrar, cancelar o deshacer | WhatsApp / Dashboard | Accion revertida o confirmacion de riesgo. |
| 6 | Pendientes de email | Email + WhatsApp / Dashboard | Pendiente confirmado, rechazado o revisado. |
| 7 | Consulta financiera | WhatsApp / Dashboard | Respuesta con datos, limites y fuentes. |
| 8 | Busqueda natural | Dashboard | Resultados filtrados o pregunta de aclaracion. |
| 9 | Deuda nueva | WhatsApp / Dashboard | Deuda activa o draft con siguiente dato. |
| 10 | Pago de deuda / devolucion | WhatsApp / Dashboard | Deuda actualizada y movimiento vinculado. |
| 11 | Pago que viene | Scheduler / Dashboard / WhatsApp | Recurrente confirmado, ignorado o revisado. |
| 12 | Recordatorio | Scheduler + WhatsApp | Aviso permitido, discreto y pausable. |
| 13 | Descubrimiento | Dashboard / WhatsApp opt-in | Insight mostrado con evidencia y accion pequena. |
| 14 | Ayuda y explicacion | WhatsApp / Dashboard | Duda respondida y accion siguiente. |
| 15 | Modo discreto | WhatsApp / Configuracion | Preferencia aplicada a salidas sensibles. |
| 16 | Reconstruccion con datos incompletos | WhatsApp / Dashboard | Pendiente o estimacion limitada, no dato inventado. |
| 17 | Cuenta o caja desde el uso | WhatsApp / Dashboard | Cuenta/caja creada o sugerida sin bloquear registro. |
| 18 | Clasificacion, subcategorias y etiquetas | WhatsApp / Dashboard | Movimiento mejor clasificado sin romper tipo financiero. |
| 19 | Transferencia, asignacion interna y ajuste | WhatsApp / Dashboard | Movimiento no contado como gasto y saldos recalculados. |
| 20 | Configuracion y preferencias | Dashboard / WhatsApp | Preferencias aplicadas sin friccion ni spam. |
| 21 | Detalle, fuente y explicabilidad | Dashboard / WhatsApp | Usuario entiende de donde salio un dato y puede corregirlo. |

### 4.1 Matriz de cobertura del alcance V1

| Documento fuente | Cobertura en este documento |
|---|---|
| `05a_whatsapp.md` | Registro, correccion, consulta, ayuda, cancelacion, modo discreto. |
| `05b_motor_ia.md` | Orquestacion, agentes, motores deterministicos, confirmacion, contextos, guardrails. |
| `05c_dashboard.md` | Registro manual, movimientos, pendientes, busqueda natural, Mi Dinero, detalle y control. |
| `05d_email_parsing.md` | Email detectado, Pending Inbox, confirmacion, rechazo, batch y modo discreto. |
| `05e_cuentas_cajas.md` | Cuentas, cajas, dinero libre, transferencias, asignaciones, ajustes y cuenta `null`. |
| `05f_categorias.md` | Categoria, subcategoria, etiquetas, sin clasificar, correccion y aprendizaje. |
| `05g_insights.md` | Descubrimientos, evidencia, canal, feedback, expiracion/actualizacion. |
| `05h_deudas.md` | Deudas, prestamos, pagos, devoluciones, personas y sensibilidad. |
| `05i_recurrentes.md` | Pagos que vienen, candidatos, confirmacion, cambios y vinculo con deuda. |
| `05j_nudges.md` | Recordatorios, opt-in, horario silencioso, anti-spam, pausas y re-engagement. |

---

## 5. Flujo 1: Registro simple por WhatsApp

### Intencion

El usuario quiere anotar algo rapido sin abrir una app.

### Estado emocional

Quiere velocidad. Si Manzana pregunta demasiado, siente friccion.

### Ejemplo

```text
Usuario: gaste 8 en cafe
Manzana: Listo. Cafe S/8 registrado.
```

### Pasos

```text
WhatsApp recibe mensaje
  -> FinancialOrchestrator clasifica intencion
  -> DataAgent interpreta movimiento
  -> validadores revisan monto, tipo, fecha y confianza
  -> Core crea movimiento
  -> audit_log + transactional_outbox
  -> ResponseAgent o plantilla confirma
```

### Reglas

- No pedir cuenta si no es necesaria.
- No pedir categoria si la inferencia es suficiente.
- Si falta monto, preguntar solo monto.
- Si hay duda entre gasto, prestamo o pago de deuda, preguntar antes de registrar.
- Si cuenta no existe, puede quedar `account_id = null`.

### No hacer

```text
Para registrar necesito: cuenta, categoria, fecha, nota y metodo de pago.
```

---

## 6. Flujo 2: Registro multiple por WhatsApp

### Intencion

El usuario quiere registrar varias cosas en un solo mensaje.

### Ejemplo

```text
Usuario: hoy gaste 8 cafe, 15 taxi y 20 almuerzo
Manzana: Listo. Registre 3 gastos: cafe S/8, taxi S/15 y almuerzo S/20.
```

### Pasos

```text
Mensaje multiple
  -> DataAgent devuelve ProposedActions[]
  -> validadores revisan cada accion por separado
  -> Core crea movimientos separados
  -> Dedup Engine revisa duplicados probables
  -> respuesta compacta
```

### Reglas

- Cada movimiento debe tener su propio tipo, monto, fecha, categoria y cuenta si aplica.
- Si solo una parte es ambigua, registrar lo claro y preguntar por lo dudoso.
- No convertir el mensaje en un movimiento agrupado.

### Variante con ambiguedad

```text
Usuario: gaste 8 cafe y creo que taxi pero no recuerdo cuanto
Manzana: Registre cafe S/8. Dejo taxi pendiente hasta que recuerdes el monto.
```

---

## 7. Flujo 3: Registro manual desde Dashboard

### Intencion

El usuario esta revisando su dinero y quiere registrar algo sin volver a WhatsApp.

### Estado emocional

Busca control y precision, no conversacion larga.

### Pasos visibles

```text
Dashboard -> Nuevo movimiento
  -> tipo de movimiento
  -> campos relevantes al tipo
  -> previsualizacion de impacto
  -> guardar
  -> historial y saldos se actualizan
```

### Sistemas

- Dashboard form.
- Core financiero.
- Validadores.
- Debt Engine, Recurring Engine o Balance Engine si aplica.
- Dedup Engine.
- Audit log + transactional outbox.

### Reglas

- No depende de IA para guardar.
- Puede usar IA para sugerir categoria, etiqueta o cuenta, pero el usuario ve el resultado.
- Debe soportar los 11 tipos canonicos V1.
- Todo registro manual queda con fuente `Dashboard/manual`.

### No hacer

- Crear movimientos desde busqueda natural sin confirmacion estructurada.
- Ocultar el impacto en cuenta, caja, deuda o saldo cuando aplica.

---

## 8. Flujo 4: Correccion de movimiento

### Intencion

El usuario detecta un error o quiere ajustar un dato.

### Estado emocional

Puede estar frustrado. La respuesta debe bajar tension.

### Ejemplos

```text
Usuario: eso no fue taxi, fue Uber de trabajo
Manzana: Corregido. Lo cambie a Uber de trabajo.
```

```text
Usuario: eso no fue gasto, fue prestamo a Luis
Manzana: Suena a prestamo a Luis. ¿Lo cambio asi?
```

### Pasos

```text
CorrectionAgent interpreta referencia
  -> Core localiza movimiento candidato
  -> PolicyGate decide si requiere confirmacion
  -> Core actualiza movimiento/deuda si aplica
  -> Learning Engine guarda patron confirmado
  -> Event Bus recalcula saldos, insights y confianza
```

### Reglas

- Resolver referencias como "eso", "el taxi", "lo de ayer".
- Si cambia tipo financiero, pedir confirmacion cuando afecte saldos, deuda o categoria sensible.
- Aprender solo de correcciones confirmadas.

### No hacer

- Defender el error.
- Decir "no entendi" sin ofrecer una forma de corregir.

---

## 9. Flujo 5: Borrar, cancelar o deshacer

### Intencion

El usuario quiere revertir una accion o detener un flujo.

### Casos

| Caso | Regla |
|---|---|
| Cancelar flujo activo | Cancelar sin confirmar si no afecta datos persistidos. |
| Borrar movimiento | Requiere confirmacion clara. |
| Deshacer ultima accion | Permitido si existe ventana/estado reversible. |
| Borrar varios movimientos | Confirmacion de riesgo. |
| Eliminar deuda | Confirmacion explicita y audit log. |

### Ejemplo

```text
Usuario: borra el taxi de ayer
Manzana: ¿Confirmas borrar el gasto de Taxi S/18 del 14 de mayo?
```

### Reglas

- Explicar que se borrara antes de borrar.
- No usar confirmaciones ambiguas como "ok?" en acciones riesgosas.
- Registrar audit log.

---

## 10. Flujo 6: Pendientes de email

### Intencion

El sistema detecta posibles movimientos, pero el usuario conserva control.

### Regla de oro

> En V1, ningun email se registra sin aprobacion del usuario.

### Pasos

```text
Email Adapter detecta email financiero permitido
  -> template/parser extrae datos
  -> DataAgent normaliza campos
  -> Dedup Engine compara contra movimientos existentes
  -> Pending Inbox crea pendiente
  -> PolicyGate decide canal/frecuencia/modo discreto
  -> WhatsApp o Dashboard invita a revisar
```

### Ejemplo WhatsApp

```text
Manzana: Detecte un movimiento de Yape por S/45 en Restaurante. ¿Lo registro?
```

Modo discreto:

```text
Manzana: Detecte un movimiento para revisar. ¿Quieres verlo?
```

### Dashboard

Pendientes debe mostrar:

- fuente,
- fecha,
- monto si corresponde,
- comercio/categoria si corresponde,
- por que esta pendiente,
- acciones: confirmar, editar, rechazar, ya lo registre.

### No hacer

- Afectar saldos con pendientes.
- Mezclar pendientes con movimientos confirmados sin marcar estado.
- Enviar demasiadas confirmaciones individuales si hay batch.

---

## 11. Flujo 7: Consulta financiera

### Intencion

El usuario quiere entender su dinero, no solo registrar.

### Ejemplos

```text
Usuario: puedo gastar S/50 hoy?
Manzana: Puedo ayudarte, pero me falta tu saldo actual. Si me dices cuanto tienes disponible, lo calculo mejor.
```

```text
Usuario: cuanto gaste ayer?
Manzana: Ayer registraste S/43 en 3 movimientos: cafe, taxi y almuerzo.
```

### Pasos

```text
ConversationAgent interpreta pregunta
  -> FinancialQueryEngine consulta datos read-only
  -> Balance/Debt/Recurring Engines calculan si aplica
  -> ResponseAgent responde con fuente, limite y tono
```

### Reglas

- Si faltan datos, decir que falta y pedir el minimo.
- No inventar saldos, compromisos o cuentas.
- Diferenciar dinero total, libre en cuentas y dinero libre.
- Si el usuario pide detalle sensible, respetar modo discreto segun canal.

---

## 12. Flujo 8: Busqueda natural en Dashboard

### Intencion

El usuario quiere encontrar algo sin construir filtros.

### Ejemplos

```text
"gastos de transporte de abril"
"movimientos de email sin confirmar"
"lo de la laptop"
"ultimos 5 gastos"
```

### Pasos

```text
Usuario escribe busqueda
  -> ConversationAgent o Search Interpreter transforma a filtros
  -> FinancialQueryEngine consulta
  -> Dashboard muestra resultados con filtros visibles
```

### Reglas

- La busqueda natural es read-only en V1.
- Si quiere crear datos, abrir flujo estructurado.
- Mostrar filtros interpretados para generar confianza.
- Si no hay resultados, explicar sin sonar a error.

### No hacer

```text
Buscar: "registra taxi 15"
  -> crear movimiento directamente
```

Debe abrir o sugerir registro, no crear sin confirmacion.

---

## 13. Flujo 9: Deuda nueva

### Intencion

El usuario quiere recordar una obligacion o dinero pendiente con alguien/entidad.

### Estado emocional

Puede haber ansiedad o verguenza. El flujo debe ser sobrio.

### Ejemplos

```text
Usuario: le debo 50 a Luis
Manzana: Lo anoto como deuda con Luis por S/50. ¿Quieres agregar fecha o lo dejamos sin fecha?
```

```text
Usuario: Ana me debe 80
Manzana: Listo. Ana te debe S/80. Puedes agregar fecha despues si quieres.
```

### Reglas

- Una deuda puede existir sin cuenta, categoria o historial completo.
- `pago_deuda` no es gasto generico.
- `devolucion_recibida` no es ingreso generico si reduce deuda a favor.
- Si hay ambiguedad entre regalo, gasto compartido, prestamo o deuda, preguntar.
- No enviar recordatorios de deuda sin opt-in.

---

## 14. Flujo 10: Pago de deuda o devolucion recibida

### Intencion

El usuario quiere actualizar una deuda existente.

### Ejemplos

```text
Usuario: pague 30 de lo de Luis
Manzana: Listo. Reduje tu deuda con Luis en S/30.
```

```text
Usuario: Ana me pago lo que me debia
Manzana: Listo. Marco la deuda de Ana como pagada.
```

### Pasos

```text
DataAgent detecta pago/devolucion
  -> Debt Engine busca deuda compatible
  -> si hay una clara, actualiza
  -> si hay varias, pregunta cual
  -> Core crea movimiento vinculado
  -> saldos solo cambian si cuenta/caja conocida
```

### Reglas

- Pagos con cuenta `null` pueden actualizar deuda, pero no saldos por cuenta.
- Sobrepago se bloquea en V1 y pide corregir el monto.
- Email no confirmado no actualiza deuda.

---

## 15. Flujo 11: Pago que viene

### Intencion

El usuario quiere recordar o confirmar pagos repetidos o compromisos proximos.

### Ejemplo

```text
Manzana: Netflix suele pagarse esta semana. ¿Quieres marcarlo como pago que viene?
```

### Pasos

```text
Recurring Engine detecta patron o el usuario lo crea
  -> si es candidato, pedir confirmacion
  -> si se confirma, crear recurrente
  -> si llega fecha, generar aviso permitido o pendiente
```

### Reglas

- No activar recurrente sin confirmacion si solo hay patron.
- Un pago que viene no es una deuda por defecto.
- Si se vincula a deuda/cuota, Debt Engine conserva saldo real.
- En lenguaje visible usar "Pagos que vienen", no "recurrentes".

---

## 16. Flujo 12: Recordatorio

### Intencion

Manzana avisa algo util sin sentirse invasiva.

### Condiciones previas

- Opt-in aplicable.
- Horario permitido.
- Frecuencia disponible.
- Modo discreto evaluado.
- Entidad vinculada: deuda, pago que viene, pendiente o descubrimiento accionable.

### Ejemplo normal

```text
Manzana: Tu cuota de tarjeta vence esta semana. ¿Quieres revisarla?
```

### Modo discreto

```text
Manzana: Tienes un compromiso proximo para revisar.
```

### Reglas

- No enviar recordatorios proactivos sin consentimiento.
- Siempre debe poder pausarse.
- No exponer montos, comercios, bancos, personas o saldos si modo discreto aplica.
- Si el usuario dice "no me avises", guardar opt-out.

---

## 17. Flujo 13: Descubrimiento

### Intencion

Manzana muestra algo util que el usuario no habia visto con claridad.

### Estado emocional

Debe generar autodescubrimiento, no culpa.

### Ejemplo temprano

```text
Ya tengo tus primeros movimientos. Todavia no hay un patron fuerte, pero ya veo tus primeras categorias.
```

### Ejemplo con evidencia

```text
Esta semana delivery subio frente a tu ritmo normal. Puede ser algo puntual; si quieres, lo revisamos.
```

### Reglas

- Dashboard es el canal principal.
- WhatsApp solo si hay opt-in, baja saturacion y valor claro.
- Si los datos cambian por correccion, actualizar o marcar outdated segun estado.
- Incluir evidencia trazable sin mostrar razonamiento interno.
- Debe tener accion pequena o utilidad clara.

---

## 18. Flujo 14: Ayuda y explicacion

### Intencion

El usuario necesita entender como usar Manzana o como interpretar su dinero.

### Ejemplos

```text
Usuario: como registro una deuda?
Manzana: Puedes escribirlo natural: "le debo 50 a Luis". Si quieres, tambien puedes agregar fecha.
```

```text
Usuario: por que me queda tan poco?
Manzana: Lo revisamos. Puedo comparar tus gastos confirmados, cajas y pagos que vienen. Si falta algun saldo, te lo dire.
```

### Reglas

- Responder la duda inmediata.
- Proponer una accion pequena.
- No mandar a documentacion.
- No dar tutorial largo.
- Si requiere escritura financiera, pasar a flujo con confirmacion.

---

## 19. Flujo 15: Modo discreto

### Intencion

El usuario quiere mas privacidad en mensajes y avisos.

### Activacion

```text
Usuario: activa modo discreto
Manzana: Listo. En mensajes proactivos ocultare montos, comercios, bancos, personas y saldos.
```

### Reglas

- Aplica principalmente a salidas no autenticadas: WhatsApp proactivo, push, email notification.
- No cambia calculos, saldos ni registros.
- No debe esconder datos dentro del Dashboard autenticado.
- Si el usuario inicia una consulta por WhatsApp, puede recibir detalle si la politica lo permite.

---

## 20. Flujo 16: Reconstruccion con datos incompletos

### Intencion

El usuario recuerda algo parcialmente.

### Ejemplo

```text
Usuario: creo que ayer gaste en taxi y comida pero no recuerdo cuanto
Manzana: Puedo ayudarte a reconstruirlo. ¿Recuerdas al menos un monto aproximado o donde fue?
```

### Reglas

- No crear gasto confirmado sin monto.
- Se puede crear pendiente si el dominio lo permite.
- Usar rangos solo como ayuda conversacional, no como registro confirmado.
- Si hay email pendiente compatible, sugerir revisarlo.

---

## 21. Flujo 17: Cuenta o caja desde el uso

### Intencion

El usuario menciona una cuenta o quiere separar dinero sin pasar por configuracion pesada.

### Cuenta desde uso

```text
Usuario: gaste 20 con Plin
Manzana: Listo. Lo registre como gasto. Plin no esta creado como cuenta. ¿Quieres agregarlo para ordenar mejor tus saldos?
```

Regla: si confirma, se crea cuenta y se vincula al movimiento existente.

### Caja desde uso

```text
Usuario: separa 200 para emergencia
Manzana: ¿En que cuenta quieres separarlo?
```

Reglas:

- Una caja siempre se vincula a una cuenta real.
- Si no hay cuenta suficiente o no se sabe cuenta, preguntar.
- La asignacion interna no es gasto.

---

## 22. Flujo 18: Clasificacion, subcategorias y etiquetas

### Intencion

El usuario quiere que sus movimientos queden mejor ordenados sin convertirse en contador.

### Casos principales

| Caso | Regla |
|---|---|
| Categoria inferida con alta confianza | Registrar sin preguntar. |
| Categoria dudosa | Registrar si el movimiento es claro y marcar `classification_status = needs_review`. |
| Usuario corrige categoria | Actualizar y aprender patron confirmado. |
| Subcategoria nueva | Crear solo si aporta agrupacion real y no duplica una existente. |
| Etiqueta contextual | Puede inferirse como sugerida; confirmada si el usuario la acepta/corrige. |
| Sin clasificar | No usar `otros` como sustituto. Mostrar como "por revisar". |

### Ejemplos

```text
Usuario: el taxi de ayer era de trabajo
Manzana: Listo. Lo marque como transporte con etiqueta trabajo.
```

```text
Usuario: eso no era otros, era farmacia
Manzana: Corregido. Lo tendre en cuenta para gastos parecidos.
```

### Reglas

- La categoria nunca debe tapar el tipo financiero real.
- `prestamo_dado`, `pago_deuda`, `transferencia` y `asignacion_interna` no deben aparecer como gasto comun por culpa de una categoria.
- Las 12 categorias base no crecen automaticamente.
- Subcategorias y etiquetas pueden crecer de forma controlada.
- Categorias sensibles deben respetar lenguaje discreto en salidas externas.

---

## 23. Flujo 19: Transferencia, asignacion interna y ajuste

### Intencion

El usuario mueve dinero entre cuentas, separa dinero en una caja o corrige un saldo.

### Transferencia

```text
Usuario: pase 100 de BCP a Yape
Manzana: Listo. Registre transferencia de BCP a Yape por S/100.
```

Reglas:

- No cuenta como gasto.
- Requiere origen y destino si afecta saldos.
- Si falta origen/destino importante, preguntar antes de confirmar.

### Asignacion interna

```text
Usuario: separa 200 para emergencia
Manzana: ¿En que cuenta quieres separarlo?
```

Reglas:

- No cuenta como gasto.
- Mueve dinero libre hacia caja.
- Una caja siempre vive dentro de una cuenta.
- Transferencias cross-account de cajas no son operacion unica en V1.

### Ajuste de saldo

```text
Usuario: mi Yape en realidad tiene 120
Manzana: Ajusto el saldo de Yape a S/120. ¿Confirmas?
```

Reglas:

- `ajuste` requiere confirmacion si cambia saldo.
- Debe quedar audit log.
- Saldo negativo se permite con advertencia, no bloquea movimientos.
- No usar ajuste para esconder errores de clasificacion; primero sugerir corregir el movimiento si se identifica.

---

## 24. Flujo 20: Configuracion y preferencias

### Intencion

El usuario quiere controlar como Manzana se comporta: recordatorios, privacidad, cuentas, email o preferencias de experiencia.

### Entradas

- Dashboard Configuracion.
- WhatsApp con comandos naturales.
- Prompt contextual despues de una accion.

### Ejemplos

```text
Usuario: no me recuerdes cafes
Manzana: Listo. No te enviare recordatorios sobre cafes.
```

```text
Usuario: pausa recordatorios una semana
Manzana: Listo. Pauso recordatorios por 7 dias.
```

```text
Usuario: desconecta email
Manzana: Para desconectar email, ve a Configuracion. No seguire detectando movimientos nuevos cuando lo hagas.
```

### Reglas

- Preferencias sensibles deben ser reversibles.
- Opt-in debe ser granular.
- Opt-out debe respetarse sin insistir.
- Configuracion de email no debe borrar movimientos ya confirmados.
- Cambios que afecten privacidad o notificaciones deben confirmarse o mostrarse claramente.

---

## 25. Flujo 21: Detalle, fuente y explicabilidad

### Intencion

El usuario quiere confiar en un dato: de donde salio, si fue confirmado, que afecta y como corregirlo.

### Dashboard

El detalle de movimiento debe mostrar:

- tipo,
- monto,
- fecha,
- categoria/subcategoria/etiquetas,
- cuenta/caja si aplica,
- fuente: WhatsApp, Email confirmado, Dashboard/manual o pago que viene,
- estado: confirmado, pendiente, corregido, eliminado,
- impacto en saldo/caja/deuda,
- acciones: editar, corregir, borrar, ver historial si aplica.

### WhatsApp

```text
Usuario: de donde salio ese gasto?
Manzana: Vino de un email detectado y lo confirmaste por WhatsApp.
```

```text
Usuario: por que dices que puedo gastar 50?
Manzana: Lo calculo con tus saldos, cajas y compromisos proximos. Si falta una cuenta, te aviso.
```

### Reglas

- Explicar con fuentes y resumen, no con razonamiento interno.
- No exponer chain-of-thought.
- Si el dato cambio por correccion, mostrar version actualizada.
- Si el dato esta pendiente, decir que todavia no afecta saldos.

---

## 26. Flujos por tipo de usuario

### 26.1 Registro rapido

```text
WhatsApp -> registro simple -> confirmacion -> tip de correccion -> historial en Dashboard
```

Exito: usuario registra sin sentir que configuro una app.

### 26.2 Claridad financiera

```text
Pregunta de liquidez -> pedir saldo minimo si falta -> calcular con limites -> explicar fuentes
```

Exito: usuario entiende que Manzana no inventa y puede mejorar con mas datos.

### 26.3 Deuda-first

```text
Deuda -> persona/monto -> estado -> pago/recordatorio opcional -> Dashboard de deudas
```

Exito: usuario siente alivio sin registrar todos sus gastos.

### 26.4 Email-first

```text
Conectar email -> pendientes -> confirmar/rechazar -> historial confirmado
```

Exito: usuario siente captura pasiva con control, no invasion.

### 26.5 Dashboard-first

```text
Dashboard vacio -> nuevo movimiento o ayuda -> historial -> filtros/busqueda -> primer descubrimiento
```

Exito: usuario entiende que Dashboard es claridad y control.

### 26.6 Ayuda-first

```text
Pregunta -> respuesta breve -> accion pequena -> flujo correspondiente
```

Exito: usuario no necesita manual para empezar.

---

## 27. Guardrails transversales

- No registrar email sin confirmacion.
- No tratar pendientes como movimientos confirmados.
- No inventar montos, cuentas, personas, saldos, fechas o deudas.
- No convertir transferencias, asignaciones internas o pagos de deuda en gasto generico.
- No enviar proactivos sin opt-in aplicable.
- No exponer datos sensibles cuando modo discreto aplica.
- No usar IA para calculos finales de saldo, deuda, caja o dinero libre.
- No activar todos los agentes en todos los flujos.
- No bloquear uso por datos incompletos si el registro puede ser valido con `null`.
- No forzar onboarding cuando el usuario ya tiene una intencion clara.

---

## 28. Eventos de producto sugeridos

| Evento | Cuando ocurre |
|---|---|
| `flow_started` | Usuario inicia flujo identificable. |
| `flow_completed` | Flujo termina con resultado util. |
| `flow_cancelled` | Usuario cancela o dice "luego". |
| `flow_clarification_requested` | Manzana pide un dato minimo. |
| `movement_created_whatsapp` | Movimiento creado por WhatsApp. |
| `movement_created_dashboard` | Movimiento creado desde Dashboard. |
| `movement_corrected` | Correccion completada. |
| `movement_deleted_confirmed` | Borrado confirmado. |
| `pending_email_created` | Email genera pendiente. |
| `pending_confirmed` | Pendiente confirmado. |
| `pending_rejected` | Pendiente rechazado. |
| `financial_query_answered` | Consulta respondida con datos/fuentes. |
| `debt_created` | Deuda creada. |
| `debt_payment_recorded` | Pago/devolucion aplicado. |
| `recurring_candidate_detected` | Patron recurrente detectado. |
| `recurring_confirmed` | Pago que viene confirmado. |
| `reminder_sent` | Recordatorio enviado. |
| `reminder_paused` | Recordatorio pausado. |
| `insight_displayed` | Descubrimiento mostrado. |
| `discreet_mode_enabled` | Modo discreto activado. |
| `help_to_action_converted` | Ayuda termina en accion real. |
| `classification_corrected` | Categoria, subcategoria o etiqueta corregida. |
| `tag_confirmed` | Etiqueta sugerida confirmada por usuario. |
| `transfer_created` | Transferencia registrada. |
| `internal_assignment_created` | Dinero separado o liberado de caja. |
| `balance_adjustment_confirmed` | Ajuste de saldo confirmado. |
| `preference_updated` | Preferencia de usuario actualizada. |
| `source_explanation_viewed` | Usuario revisa fuente/explicacion de dato. |

---

## 29. Escenarios de prueba V1

1. "Gaste 8 en cafe."
2. "Hoy gaste 8 cafe, 15 taxi y 20 almuerzo."
3. "Gaste en taxi."
4. "Eso no fue gasto, fue prestamo a Luis."
5. "Borra el taxi de ayer."
6. Email de Yape detectado y enviado a Pendientes.
7. Usuario confirma pendiente de email.
8. Usuario rechaza pendiente de email.
9. "Puedo gastar S/50 hoy?"
10. "Cuanto gaste ayer?"
11. "Le debo 50 a Luis."
12. "Ana me pago lo que me debia."
13. "Pague la cuota de la tarjeta."
14. Netflix detectado como pago que viene.
15. Recordatorio de cuota respetando opt-in, horario y modo discreto.
16. Descubrimiento mostrado en Dashboard.
17. "Que puedes hacer?"
18. "Activa modo discreto."
19. "Creo que ayer gaste en taxi y comida pero no recuerdo cuanto."
20. "Separa 200 para emergencia."
21. "El taxi de ayer era de trabajo."
22. "Pase 100 de BCP a Yape."
23. "Mi Yape en realidad tiene 120."
24. "No me recuerdes cafes."
25. "De donde salio ese gasto?"
26. Usuario ve detalle de movimiento en Dashboard y corrige categoria.
27. Usuario busca "movimientos sin clasificar".
28. Usuario intenta transferencia sin origen o destino.

---

## 30. Criterios de aceptacion

- Cada flujo define intencion, salida visible, sistemas internos y guardrails.
- WhatsApp y Dashboard quedan conectados sin competir.
- Registro manual del Dashboard no depende de IA para escribir dinero.
- Email siempre pasa por Pendientes y confirmacion.
- Correcciones actualizan datos y aprendizaje sin exponer razonamiento interno.
- Deudas, pagos, recurrentes, cajas y saldos usan motores deterministicos.
- Consultas financieras responden con datos, limites y fuentes.
- Busqueda natural es read-only en V1.
- Modo discreto afecta salidas sensibles sin cambiar calculos.
- Recordatorios respetan opt-in, horario, frecuencia y privacidad.
- El usuario puede pedir ayuda y recibir una accion pequena, no documentacion larga.
- Los flujos funcionan con datos incompletos cuando el dominio lo permite.
- El documento permite implementar V1 sin inventar comportamiento entre features.
- Categorias, subcategorias y etiquetas tienen flujo propio de correccion y aprendizaje.
- Transferencias, asignaciones internas y ajustes no se confunden con gastos.
- Configuracion y preferencias cubren opt-in, opt-out, pausas, email y privacidad.
- Detalle/fuente/explicabilidad permite confiar y corregir cada dato importante.
- Existe matriz de cobertura contra todos los documentos de Fase 2 V1.

---

*Fase 3 Producto - Documento 14 - V1.1*
