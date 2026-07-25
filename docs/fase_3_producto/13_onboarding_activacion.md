# Onboarding y Activacion V1

**Documento:** `13_onboarding_activacion.md`  
**Fase:** 3 - Producto / Experiencia  
**Estado:** V1.3  
**Ultima actualizacion:** 25 de mayo, 2026

---

## 1. Tesis

El onboarding de Manzana no debe sentirse como configurar una app financiera. Debe sentirse como empezar una relacion util con alguien que puede ayudarte a ordenar tu dinero desde el primer mensaje.

La activacion no ocurre cuando el usuario termina un formulario. Ocurre cuando siente:

> "Puedo usar esto sin esfuerzo, y cada dato que doy vuelve en claridad."

Por eso V1 debe priorizar:

- primer uso en menos de 1 minuto,
- primer registro exitoso,
- primer gesto de inteligencia visible,
- primer alivio emocional,
- confianza para corregir,
- consentimiento claro para mensajes proactivos,
- progresion natural hacia Dashboard, email, cuentas, cajas, deudas y pagos que vienen.

La experiencia debe gustar porque reduce carga mental. El usuario no debe sentir que "llenó una app"; debe sentir que Manzana agarro un pedazo pequeno de su caos y lo devolvio mas claro.

---

## 2. Principios

| Principio | Regla |
|---|---|
| Uso antes que configuracion | El usuario debe poder registrar algo antes de crear cuentas, cajas o categorias. |
| Una pregunta a la vez | No pedir todo al inicio. Pedir solo lo que desbloquea valor inmediato. |
| Activacion por accion real | El primer valor viene de registrar, corregir, consultar o revisar algo real. |
| Progresivo, no exhaustivo | Cuentas, email, recordatorios y cajas aparecen cuando el uso los justifica. |
| Confianza visible | Desde el inicio debe quedar claro que puede corregir, cancelar y controlar recordatorios. |
| No juicio | El usuario puede llegar con caos, deuda, ansiedad o cero datos. Manzana no lo penaliza. |
| Uso parcial valido | Si solo usa WhatsApp, solo deudas o solo Dashboard, el producto sigue siendo valido. |
| Alivio antes que explicacion | Primero reducir friccion o ansiedad; despues explicar si aporta confianza. |
| Pequenas recompensas de claridad | Cada accion debe devolver algo util: confirmacion, control, contexto o siguiente paso. |
| Gusto sin gamificacion falsa | La experiencia puede sentirse agradable sin puntos, rachas agresivas ni celebraciones vacias. |

---

## 3. Objetivo de activacion V1

### 3.1 Activacion minima

Un usuario se considera activado cuando cumple:

1. Completa el primer registro confirmado, o confirma el primer pendiente.
2. Entiende que puede escribir en lenguaje natural.
3. Sabe que puede corregir.
4. Tiene al menos un siguiente paso claro.

### 3.2 Activacion fuerte

Un usuario se considera fuertemente activado cuando cumple al menos 3:

- registra 3+ movimientos confirmados,
- corrige o confirma un dato sin friccion,
- abre Dashboard y entiende sus ultimos movimientos,
- configura o acepta un tipo de recordatorio,
- conecta email y confirma al menos un pendiente,
- registra una deuda, pago que viene o caja,
- ve el primer descubrimiento util.

### 3.3 Primer wow

El primer wow no debe prometer analisis profundo. Debe demostrar aprendizaje o utilidad concreta segun la ruta real del usuario.

Trigger recomendado para usuario de registro de gastos:

```text
5 movimientos confirmados
  -> InsightSignalEngine genera learning_progress
  -> Dashboard Home muestra primer descubrimiento seguro
  -> WhatsApp solo si hay opt-in y baja saturacion
```

Ejemplo:

```text
Ya tengo tus primeros movimientos. Todavia no hay un patron fuerte, pero ya veo tus primeras categorias y formas de registrar.
```

### 3.4 Primer valor por ruta

No todos los usuarios llegan al primer valor por el mismo camino. V1 debe reconocer rutas parciales validas.

| Ruta de usuario | Primer valor esperado | Trigger recomendado | Canal principal |
|---|---|---|---|
| Registro rapido | Primer movimiento confirmado y corregible. | 1 movimiento confirmado. | WhatsApp. |
| Gastos frecuentes | Primer descubrimiento de aprendizaje. | 5 movimientos confirmados. | Dashboard Home. |
| Deudas | Deuda activa con persona y estado claro. | 1 deuda registrada. | WhatsApp o Dashboard. |
| Liquidez | Explicar que falta saldo/cuenta y pedir el dato minimo. | Primera pregunta de dinero libre. | Conversacion. |
| Email | Pendientes detectados, sin registro automatico. | Email conectado + 1 pendiente encontrado. | Pendientes / WhatsApp. |
| Dashboard | Primer registro manual o primer historial visible. | CTA completado desde estado vacio. | Dashboard. |
| Cajas | Dinero separado para algo concreto. | Primera caja creada o asignacion interna. | Mi Dinero. |

Regla: si el usuario solo usa una ruta, Manzana no debe empujarlo a completar todo el sistema antes de darle valor.

---

## 4. Transformacion emocional del onboarding

El onboarding no solo debe mover al usuario de "sin datos" a "primer registro". Debe moverlo de una emocion inicial a una emocion mejor.

Objetivo psicologico:

```text
Confusion / flojera / ansiedad
  -> una accion pequena
  -> respuesta clara
  -> sensacion de control
  -> ganas de volver a usarlo
```

### 4.1 Mapa emocional

| Momento | Como llega el usuario | Riesgo psicologico | Que debe sentir despues | Intervencion de Manzana |
|---|---|---|---|---|
| Primer contacto | Curioso, esceptico o cansado de apps que piden configurar todo. | "Esto sera otra app pesada." | "Puedo probar sin compromiso." | Bienvenida breve + ejemplo accionable. |
| Primer registro | Quiere rapidez y cero friccion. | "Si me pregunta mucho, lo dejo." | "Lo pude usar como hablo." | Confirmar sin pedir datos extra si no son necesarios. |
| Primer error o ambiguedad | Puede frustrarse o pensar que la IA no sirve. | "No me entendio." | "No pasa nada, se corrige facil." | Una sola pregunta o correccion simple. |
| Primer Dashboard vacio | Puede sentir que no hay valor todavia. | "No hay nada que ver." | "Puedo empezar por una cosa." | Estado vacio con CTA unico y sin graficos falsos. |
| Primera deuda | Puede sentir verguenza, tension o urgencia. | "Me van a juzgar o presionar." | "Puedo mirarlo con calma." | Lenguaje sobrio, deuda clara y siguiente paso opcional. |
| Primer email | Puede temer invasion de privacidad. | "Van a leer mi correo." | "Yo controlo que se registra." | Promesa de privacidad + pendientes con confirmacion. |
| Primer opt-in | Puede temer spam. | "Me van a molestar." | "Me avisa solo si yo quiero." | Consentimiento granular, pausa y horario silencioso. |
| Primer descubrimiento | Busca utilidad, no sermon. | "Me van a reganar por gastar." | "Esto me ayuda a verme mejor." | Observacion concreta, amable y accion pequena. |
| Primer dato sensible | Puede sentir exposicion. | "No quiero que esto aparezca en cualquier lado." | "Mi privacidad esta cuidada." | Modo discreto y lenguaje generico si aplica. |

### 4.2 Momentos que hacen que la experiencia guste

Manzana debe crear pequenos momentos de agrado, no por decoracion, sino porque la interaccion se siente mas facil que la vida financiera real.

| Momento de gusto | Que lo provoca | Ejemplo |
|---|---|---|
| "Fue rapido" | No pedir configuracion antes de registrar. | "Listo. Cafe S/8 registrado." |
| "Me entendio" | Aceptar lenguaje natural, jerga y mensajes imperfectos. | "Suena a prestamo a Luis. ¿Lo registro asi?" |
| "No me juzgo" | Evitar culpa en gastos, deuda o errores. | "Lo dejamos anotado. Puedes agregar fecha despues." |
| "Tengo control" | Confirmar, corregir, cancelar y pausar. | "Listo, no active recordatorios." |
| "Me ahorro cabeza" | Resolver siguiente paso sin hacerlo grande. | "Puedo dejarlo pendiente para revisar despues." |
| "Esto vuelve con claridad" | Cada dato aporta historial, dinero libre, pendiente o descubrimiento. | "Ya veo tus primeros movimientos por categoria." |

### 4.3 Reglas psicologicas de la experiencia

- Una interaccion debe tener una victoria pequena, no una lista de tareas.
- Si el usuario esta confundido, Manzana debe reducir opciones.
- Si el usuario esta ansioso, Manzana debe dar control.
- Si el usuario esta avergonzado, Manzana debe bajar intensidad y evitar juicio.
- Si el usuario esta curioso, Manzana debe mostrar utilidad rapido.
- Si el usuario rechaza algo, Manzana debe aceptar sin insistir en la misma sesion.
- Si el sistema no sabe, debe decir que falta sin sonar incompetente.
- El tono agradable no debe depender de emojis; debe venir de claridad, ritmo y respeto.

Evitar:

```text
Configura tus cuentas, categorias y recordatorios para aprovechar mejor Manzana.
```

Preferir:

```text
Puedes empezar con una sola cosa. Luego ordenamos lo demas si hace falta.
```

### 4.4 Definicion de wow emocional

En onboarding, wow no significa sorprender con un analisis complejo. Significa que el usuario siente una de estas cosas:

- "Esto no me hizo sentir mal."
- "Esto entendio lo que quise decir."
- "Esto me dio claridad sin pedirme todo."
- "Esto me dejo corregir sin drama."
- "Esto puede acompañarme sin invadir."
- "Esto me ayuda a conocerme un poco mejor."

Regla: si una mejora no produce alivio, claridad, control o deseo de volver, no cuenta como wow de onboarding.

---

## 5. Entradas al producto

Manzana puede empezar desde varios canales, pero la experiencia debe converger en el mismo objetivo: uso real rapido.

| Entrada | Primer objetivo | No hacer |
|---|---|---|
| WhatsApp | Registrar o preguntar algo en lenguaje natural. | Pedir configurar todo antes de usar. |
| Dashboard | Mostrar estado vacio util y permitir primer registro manual. | Mostrar paneles vacios o graficos falsos. |
| Email | Conectar, detectar pendientes y pedir confirmacion. | Registrar automaticamente desde email. |
| Invitacion / link | Llevar a primera accion. | Mandar a documentacion o tour largo. |

### 5.1 Onboarding completo: del registro al uso activo

El onboarding completo no empieza cuando el usuario manda su primer gasto; empieza cuando decide probar Manzana y termina cuando ya sabe volver por su cuenta para registrar, preguntar, revisar o corregir.

Flujo completo recomendado:

```text
1. Registro / acceso
   -> usuario crea cuenta, entra por invitacion o abre enlace desde WhatsApp/Dashboard.

2. Bienvenida ligera
   -> Manzana explica en una frase que puede registrar, preguntar o revisar dinero en lenguaje natural.

3. Primera accion elegida
   -> registrar gasto/ingreso, preguntar algo, registrar deuda, revisar Dashboard, conectar email o pedir ayuda.

4. Primer resultado real
   -> movimiento confirmado, respuesta honesta, deuda creada, pendiente detectado o estado vacio util.

5. Control inmediato
   -> mostrar que puede corregir, cancelar, confirmar, pausar o saltar configuraciones.

6. Direccion adaptativa
   -> Manzana detecta ruta: registro rapido, claridad financiera, deudas, email, Dashboard, cajas o ayuda.

7. Setup progresivo
   -> pedir cuenta, saldo, email, recordatorios o cajas solo cuando desbloquean valor claro.

8. Primer retorno de claridad
   -> historial visible, dinero libre si hay datos, pendientes por revisar o primer descubrimiento seguro.

9. Uso activo temprano
   -> el usuario vuelve sin que Manzana lo fuerce, porque ya entiende para que sirve.
```

Regla: cada paso debe responder a una intencion del usuario o desbloquear valor inmediato. Si un paso solo sirve para completar una configuracion interna, no pertenece al onboarding inicial.

### 5.2 Estados del usuario durante onboarding

| Estado | Que significa | Producto debe hacer |
|---|---|---|
| Registrado sin uso | Tiene cuenta, pero no hizo accion real. | Llevar a una primera accion simple. |
| Primer contacto | Escribe o abre Manzana por primera vez. | Responder a su intencion antes que explicar. |
| Primer valor | Ya obtuvo un resultado real. | Mostrar control y siguiente paso suave. |
| Activacion minima | Registro/pendiente/consulta completada + sabe corregir. | No saturar con setup. |
| Activacion fuerte | 3+ senales de uso o primer descubrimiento util. | Abrir progresivamente Dashboard, email, cajas o recordatorios. |
| Uso activo temprano | Vuelve en D1-D7 o usa una segunda ruta. | Empezar lifecycle/retencion, no seguir tratandolo como nuevo. |

---

## 6. Flujo recomendado: WhatsApp primero

### 6.1 Primer mensaje de Manzana

```text
Hola, soy Manzana. Puedes escribirme tus gastos, ingresos o dudas de dinero como te salga.
Prueba con algo simple: "gaste 8 en cafe".
```

Reglas:

- No pedir categorias.
- No pedir cuentas.
- No pedir presupuesto.
- No pedir conectar email.
- No abrir con un formulario.

### 6.2 Si el usuario registra algo simple

```text
Usuario: gaste 8 en cafe
Manzana: Listo. Cafe S/8 registrado.
```

Siguiente paso suave:

```text
Si me equivoco en algo, puedes decirme "corrige eso".
```

Mostrar este tip solo una vez o en los primeros usos, no en cada registro.

### 6.3 Si falta un dato clave

```text
Usuario: gaste en cafe
Manzana: Me falta el monto. ¿Cuanto fue?
```

Si el usuario no responde, crear pendiente solo cuando el dominio lo permita:

```text
Lo dejo pendiente para revisar despues.
```

### 6.4 Si menciona cuenta desconocida

No bloquear el registro.

```text
Usuario: gaste 20 con Yape
Manzana: Listo. Lo registre como gasto. Yape no esta creado como cuenta. ¿Quieres que lo agregue para ordenar mejor tus saldos?
```

Si responde si:

```text
Listo. Cuenta Yape creada y vinculada a este gasto.
```

Si no responde:

```text
El gasto queda registrado igual.
```

Reglas de dominio:

- No forzar cuentas en onboarding.
- El movimiento se registra una sola vez.
- Si la cuenta no existe, el movimiento queda inicialmente con cuenta `null` y referencia humana a la cuenta mencionada.
- Si el usuario confirma crear la cuenta, se vincula el movimiento existente; no se crea un segundo movimiento.
- Si el usuario no confirma, el movimiento sigue siendo valido para historial e insights, pero no para saldos por cuenta.

### 6.5 Si el primer mensaje es consulta

```text
Usuario: cuanto puedo gastar hoy?
Manzana: Todavia no tengo saldos suficientes para calcularlo bien. Si me dices cuanto tienes disponible, puedo empezar desde ahi.
```

No inventar dinero libre.

### 6.6 Si el primer mensaje es deuda

```text
Usuario: le debo 50 a Luis
Manzana: Lo anoto como deuda con Luis por S/50. ¿Quieres agregar fecha o lo dejamos sin fecha?
```

No llevarlo a categorias de gasto si claramente es deuda.

### 6.7 Si el primer mensaje es ayuda

Muchos usuarios no empezaran registrando un gasto. Algunos preguntaran que puede hacer Manzana, como empezar o como ordenar una parte concreta de su dinero.

Regla: responder la duda inmediata y proponer una accion pequena. No mandar a documentacion ni dar un tour largo.

Ejemplos:

```text
Usuario: que puedes hacer?
Manzana: Puedes escribirme gastos, ingresos, deudas o dudas de dinero como te salga. Si quieres probar, dime algo simple como "gaste 8 en cafe".
```

```text
Usuario: como empiezo?
Manzana: Empieza con una cosa. Puedes registrar un gasto, decirme cuanto tienes disponible o anotar una deuda.
```

```text
Usuario: ayudame a ordenar mis deudas
Manzana: Claro. Empecemos por una: ¿a quien le debes o quien te debe?
```

```text
Usuario: no entiendo como funciona
Manzana: No tienes que configurar todo. Me escribes algo de tu dinero, yo lo ordeno y puedes corregirme si hace falta.
```

Tipos de ayuda:

| Tipo de ayuda | Ejemplo de usuario | Respuesta esperada |
|---|---|---|
| Uso del producto | "como registro una deuda?" | Dar ejemplo natural y accion inmediata. |
| Ayuda financiera contextual | "puedo gastar 50 hoy?" | Responder con datos si existen o pedir dato minimo. |
| Recuperacion de confusion | "no entiendo" | Reducir opciones y proponer una sola accion. |
| Control y privacidad | "puedes borrar algo?" | Explicar confirmacion, correccion y limites. |
| Ruta personal | "quiero ordenar mis deudas" | Entrar a modo deuda sin forzar gastos/categorias. |

Si la ayuda implica escribir datos, corregir, borrar o activar algo, el Orquestador debe cambiar de conversacion a flujo de accion con confirmacion cuando corresponda.

---

## 7. Flujo recomendado: Dashboard primero

### 7.1 Estado vacio inicial

Dashboard debe mostrar:

- CTA principal: registrar movimiento,
- ejemplo de WhatsApp,
- opcion secundaria: conectar email,
- opcion secundaria: agregar cuenta,
- mensaje de aprendizaje,
- nada de graficos vacios.

Copy recomendado:

```text
Empieza registrando un gasto, ingreso o saldo. Con unos datos, Manzana empieza a ordenarte el dia.
```

Acciones:

```text
Registrar movimiento
Conectar email
Agregar cuenta
```

### 7.2 Registro manual desde Dashboard

El formulario no debe ser "simple" al punto de ser inutil, ni avanzado al punto de frenar.

Campos V1:

| Campo | Obligatorio | Regla |
|---|---|---|
| Tipo de movimiento | Si | Debe usar el enum canonico V1 completo. |
| Monto | Si, salvo pendiente de reconstruccion | Debe ser positivo y valido para la moneda. No registrar gasto confirmado sin monto. |
| Moneda | Si | Default del usuario; editable si el dominio lo soporta. |
| Descripcion | Recomendado | Ayuda a memoria y busqueda. |
| Fecha | Si | Default hoy, editable. |
| Categoria | Depende | Requerida para gasto/ingreso salvo pendiente de clasificacion. Sugerida por IA o seleccionada. |
| Cuenta/caja origen | Depende | Requerida si afecta salida de dinero con impacto relevante o si el tipo lo exige. Puede ser `null` en registros simples. |
| Cuenta/caja destino | Depende | Requerida en transferencias y asignaciones internas. |
| Persona relacionada | Depende | Requerida para deudas, prestamos y devoluciones. |
| Nota | Opcional | Contexto libre. |

Tipos canonicos V1:

- `gasto`
- `ingreso`
- `transferencia`
- `asignacion_interna`
- `deuda_adquirida`
- `pago_deuda`
- `prestamo_dado`
- `prestamo_recibido`
- `devolucion_recibida`
- `pago_recurrente`
- `ajuste`

Regla: si el usuario esta navegando Dashboard y quiere registrar algo, debe poder hacerlo sin volver obligatoriamente a WhatsApp.

### 7.3 Primer Dashboard con 1-4 movimientos

Mostrar:

- ultimos movimientos,
- total simple del periodo,
- estado "estoy aprendiendo",
- correccion facil,
- CTA para registrar otro movimiento.

No mostrar:

- insights fuertes,
- comparativas,
- proyecciones,
- juicios de gasto.

### 7.4 Primer Dashboard con 5 movimientos

Mostrar primer descubrimiento seguro:

```text
Ya tengo tus primeros movimientos. Estoy empezando a ver tus categorias principales.
```

Si hay categorias claras:

```text
Por ahora, lo mas repetido aparece en alimentacion y transporte.
```

No decir:

```text
Tu patron financiero es...
```

---

## 8. Email durante onboarding

Email es acelerador de datos, no puerta obligatoria.

### 8.1 Cuando sugerir conectar email

Sugerir email cuando:

- el usuario quiere menos registro manual,
- el Dashboard esta vacio y busca acelerar,
- ya hizo 1-3 registros y entiende el producto,
- pregunta por movimientos pasados,
- quiere revisar Yape/banco/correos.

No sugerir email como primer requisito.

### 8.2 Promesa correcta

```text
Puedo revisar correos bancarios y dejar movimientos por confirmar.
Nada se registra sin que lo apruebes.
```

Promesa de privacidad:

- Email es opcional.
- Solo se procesan remitentes financieros permitidos.
- No se usa como lector de correo general.
- No se leen ni procesan correos personales, laborales o newsletters.
- El cuerpo completo del email no debe mostrarse ni guardarse como parte del producto V1.
- Todo lo detectado entra primero a Pendientes.

### 8.3 Primer backfill

Cuando conecta email:

```text
Revise los ultimos 30 dias y encontre movimientos para revisar.
```

Acciones:

```text
Revisar pendientes
Omitir por ahora
```

Regla V1: todo email detectado entra a Pendientes. No afecta saldos ni movimientos confirmados hasta aprobacion del usuario.

---

## 9. Recordatorios y consentimiento

Los recordatorios no deben activarse como sorpresa. Deben sentirse elegidos y pausables.

Durante onboarding, la promesa no es "te vamos a avisar mucho". La promesa es:

```text
Te aviso solo si lo activas, en horarios razonables y con opcion de pausar.
```

### 9.1 Momento recomendado

Pedir consentimiento despues de que el usuario ya entendio el valor basico:

- tras 1-3 registros exitosos,
- al detectar un pago que viene,
- al registrar deuda/cuota,
- al conectar email,
- desde configuracion.

### 9.2 Copy recomendado

```text
¿Quieres que te avise solo de cosas importantes, como cuotas o pagos que vienen?
Puedes pausarlo cuando quieras.
```

Opciones:

```text
Si, avisame
Solo cuotas y pagos
Por ahora no
```

Reglas de consentimiento:

- El opt-in debe ser explicito por tipo de recordatorio.
- Debe respetar horario silencioso.
- Debe respetar modo discreto en canales no autenticados.
- Debe tener pausa facil.
- Debe evitar repetir una pregunta de opt-in si el usuario ya dijo que no recientemente.
- Confirmaciones necesarias para completar acciones no cuentan como marketing ni recordatorio proactivo.

### 9.3 Defaults V1

| Tipo | Default durante onboarding | Regla |
|---|---|---|
| Confirmaciones transaccionales | Activo | Necesarias para completar acciones. |
| Pagos que vienen | Preguntar / activar con consentimiento | Pausable. |
| Deudas/cuotas | Preguntar / activar con consentimiento | Alta utilidad, cuidado emocional. |
| Resumen semanal | Preguntar / activar con consentimiento | Baja frecuencia. |
| Alertas de gasto inusual | Preguntar despues de uso | No activar antes de tener datos. |
| Progreso/motivacion | Desactivado por defecto | Solo si el usuario lo quiere. |
| Horario silencioso | Activo por politica | No enviar proactivos fuera de horario permitido. |
| Modo discreto | Respetar preferencia del usuario | Ocultar montos, comercios, bancos, personas y saldos en salidas no autenticadas. |

---

## 10. Activacion por tipo de usuario

### 10.1 Usuario de registro rapido

Quiere capturar sin pensar.

Ruta:

```text
WhatsApp -> primer registro -> confirmacion -> tip de correccion -> 3 registros -> Dashboard con historial
```

No pedir:

- categorias manuales,
- cuentas,
- email,
- metas,
- recordatorios antes de valor.

### 10.2 Usuario de claridad financiera

Pregunta "cuanto tengo" o "puedo gastar".

Ruta:

```text
Pregunta -> explicar que falta saldo/cuentas -> pedir dato minimo -> calcular con limites -> sugerir Dashboard
```

### 10.3 Usuario de deudas

Empieza con "le debo", "me deben", "pague cuota".

Ruta:

```text
Deuda -> persona/monto -> fecha opcional -> estado activo -> recordatorio opcional
```

No obligar a registrar gastos diarios.

### 10.4 Usuario de email

Quiere automatizar o revisar pasado.

Ruta:

```text
Conectar email -> detectar ultimos 30 dias -> pendientes -> confirmacion -> movimientos confirmados
```

No registrar automatico.

### 10.5 Usuario de Dashboard

Quiere ver y controlar.

Ruta:

```text
Dashboard vacio -> registrar manualmente o WhatsApp -> ultimos movimientos -> primeros estados -> descubrimiento al llegar a datos suficientes
```

### 10.6 Usuario que pide ayuda

Quiere entender que hacer, como empezar o como resolver una duda concreta.

Ruta:

```text
Pregunta de ayuda -> respuesta breve -> una accion sugerida -> flujo segun intencion
```

No hacer:

- responder con una lista larga de funciones,
- mandar a documentacion,
- usar lenguaje tecnico,
- obligar a elegir entre muchas opciones,
- fingir certeza financiera si faltan datos.

Regla: la ayuda en Manzana debe ser operativa. Si el usuario pregunta "como empiezo?", la respuesta debe dejarlo a un mensaje de conseguir valor.

---

## 11. Progresion de disclosure

Manzana no muestra todo desde el dia 1.

| Nivel | Condicion | Mostrar |
|---|---|---|
| Nivel 0 | Sin datos | Primer registro, ejemplo WhatsApp, conectar email opcional. |
| Nivel 1 | 1-4 movimientos | Historial, correccion, estado de aprendizaje. |
| Nivel 2 | 5-9 movimientos | Primer descubrimiento de aprendizaje. |
| Nivel 3 | 10+ movimientos | Categorias principales y filtros. |
| Nivel 4 | Cuenta o saldo disponible | Dinero libre con limites claros. |
| Nivel 5 | Deuda/pago que viene | Compromisos, recordatorio opcional. |
| Nivel 6 | Email conectado | Pendientes y revision por lotes. |

Regla: el Disclosure Engine decide que mostrar segun datos, canal, sensibilidad y estado del usuario.

### 11.1 Salidas suaves del onboarding

El usuario puede rechazar, pausar o saltarse cualquier parte no esencial del onboarding sin perder la relacion con Manzana.

| Usuario dice | Respuesta esperada | Sistema |
|---|---|---|
| "luego" | "Listo, lo dejamos para despues." | No insistir en la misma sesion. |
| "no quiero conectar nada" | "Bien. Puedes usar Manzana solo registrando cuando quieras." | Ocultar CTA de email por un tiempo. |
| "solo quiero registrar gastos" | "Perfecto. Empezamos con eso." | Activar ruta de registro rapido. |
| "olvidalo" / "cancela" | "Listo, no registre nada." | Volver a `idle` o dejar pendiente seguro. |
| "no me mandes avisos" | "Listo. No activare recordatorios proactivos." | Guardar opt-out. |

Regla: saltarse onboarding no debe bloquear registro, consulta, correccion ni revision de pendientes.

---

## 12. Lo que no debe hacer V1

- No obligar a crear cuenta para registrar gasto.
- No pedir presupuesto completo al inicio.
- No pedir categorias manualmente como requisito.
- No registrar emails sin confirmacion.
- No mandar recordatorios proactivos sin consentimiento aplicable.
- No mostrar insights fuertes con menos evidencia.
- No mostrar `S/0` como dinero libre si no hay datos.
- No convertir onboarding en tour largo.
- No decir que Manzana "ya entendio tus habitos" con pocos movimientos.
- No mezclar pendientes con movimientos confirmados.
- No volver a pedir email, recordatorios o configuracion si el usuario acaba de decir que no.
- No duplicar movimientos al crear una cuenta despues de registrar con cuenta `null`.

---

## 13. Escenarios V1

### Escenario 1: primer registro simple

```text
Usuario: gaste 8 en cafe
Manzana: Listo. Cafe S/8 registrado.
```

Resultado:

- movimiento confirmado,
- estado `completed -> idle`,
- no pide cuenta,
- no pide categoria.

### Escenario 2: primer registro sin monto

```text
Usuario: gaste en taxi
Manzana: Me falta el monto. ¿Cuanto fue?
```

Resultado:

- no registra gasto confirmado,
- conserva estado de aclaracion,
- puede dejar pendiente si el usuario no responde.

### Escenario 3: Dashboard vacio

Resultado:

- muestra primer CTA,
- no muestra graficos vacios,
- permite registrar manualmente,
- sugiere WhatsApp como canal principal.

### Escenario 4: primer email conectado

Resultado:

- escanea ultimos 30 dias segun regla de email,
- crea pendientes,
- pide aprobacion,
- no afecta saldos.

### Escenario 5: primera deuda

```text
Usuario: le debo 50 a Luis
Manzana: Lo anoto como deuda con Luis por S/50. ¿Quieres agregar fecha o lo dejamos sin fecha?
```

Resultado:

- deuda activa,
- persona relacionada,
- fecha opcional,
- recordatorio solo con opt-in.

### Escenario 6: primera pregunta de dinero libre

```text
Usuario: puedo gastar 50 hoy?
Manzana: Todavia no tengo saldos suficientes para responderlo bien. Si me dices cuanto tienes disponible, puedo ayudarte a calcularlo.
```

Resultado:

- no inventa,
- pide dato minimo,
- puede crear cuenta/saldo despues.

### Escenario 7: 5 movimientos confirmados

Resultado:

- primer descubrimiento `learning_progress`,
- Dashboard Home lo muestra,
- WhatsApp solo si hay opt-in y frecuencia disponible.

### Escenario 8: primer mensaje pide ayuda

```text
Usuario: que puedes hacer?
Manzana: Puedes escribirme gastos, ingresos, deudas o dudas de dinero como te salga. Si quieres probar, dime algo simple como "gaste 8 en cafe".
```

Resultado:

- no abre tutorial largo,
- no exige configuracion,
- ofrece una accion pequena,
- queda listo para registro, consulta o deuda.

### Escenario 9: onboarding completo desde registro

Resultado esperado:

```text
Registro/acceso
  -> bienvenida ligera
  -> primera accion elegida
  -> primer resultado real
  -> control inmediato
  -> direccion adaptativa
  -> setup progresivo si aporta valor
  -> primer retorno de claridad
  -> uso activo temprano
```

El sistema no debe tratar igual a un usuario registrado sin uso, un usuario que ya registro algo y un usuario que vuelve en D1-D7.

---

## 14. Metricas de activacion

| Metrica | Que mide |
|---|---|
| Tiempo al primer registro | Friccion real de entrada. |
| % usuarios con primer registro confirmado | Activacion minima. |
| % usuarios que corrigen sin abandonar | Confianza tras error. |
| 3 movimientos en 7 dias | Hábito inicial. |
| Primer Dashboard abierto | Puente WhatsApp -> control visual. |
| Pendientes confirmados | Valor de email y confianza. |
| Opt-in informado | Aceptacion de recordatorios sin spam. |
| Primer descubrimiento visto | Primer wow. |
| Retorno D7 | Valor sostenido temprano. |
| Rechazo sin abandono | El usuario dice "luego/no" y aun puede seguir usando Manzana. |
| Alivio percibido | El usuario siente menos carga mental despues de la primera accion. |
| Confianza para corregir | El usuario entiende que un error no rompe el sistema. |
| Ayuda convertida en accion | Una pregunta de ayuda termina en registro, consulta, deuda, pendiente o Dashboard. |
| Registro a primer valor | Tiempo desde acceso inicial hasta primer resultado real. |

Eventos sugeridos:

- `onboarding_started`
- `first_message_sent`
- `first_movement_confirmed`
- `first_pending_created`
- `first_correction_completed`
- `dashboard_empty_cta_clicked`
- `manual_movement_created`
- `email_connected`
- `first_email_pending_confirmed`
- `reminder_opt_in_set`
- `reminder_opt_out_set`
- `first_insight_seen`
- `onboarding_skipped`
- `optional_setup_declined`
- `onboarding_recovered_after_error`
- `onboarding_relief_feedback`
- `onboarding_return_after_skip`
- `help_question_received`
- `help_answer_action_clicked`
- `first_value_reached`
- `onboarding_stage_changed`

---

## 15. Criterios de aceptacion

- El usuario puede empezar sin configurar cuentas, categorias, email, cajas o recordatorios.
- El primer mensaje existe y no parece formulario.
- WhatsApp permite primer registro en lenguaje natural.
- Dashboard vacio ofrece accion clara y no muestra paneles falsos.
- Registro manual en Dashboard existe y cubre campos necesarios sin ser flujo principal.
- Email aparece como acelerador opcional y siempre confirma antes de registrar.
- Recordatorios tienen consentimiento, pausa y frecuencia controlada.
- Dinero libre no se calcula ni se muestra como `S/0` sin datos suficientes.
- El primer descubrimiento util se activa con 5 movimientos confirmados y tono de aprendizaje.
- Cuentas pueden nacer del uso; no son obligatorias para registrar.
- Uso parcial es valido: gastos, deudas, email o Dashboard pueden activar por separado.
- El onboarding reduce ansiedad y aumenta claridad, no empuja configuracion.
- El registro manual del Dashboard usa los 11 tipos canonicos V1.
- Una cuenta desconocida durante onboarding no duplica movimientos; crea/vincula cuenta sobre el movimiento existente.
- Email onboarding comunica privacidad: opcional, remitentes financieros permitidos y confirmacion obligatoria.
- Recordatorios respetan opt-in, horario silencioso, modo discreto y pausa.
- La activacion contempla rutas parciales: gastos, deudas, liquidez, email, Dashboard y cajas.
- El usuario puede saltar onboarding sin perder registro, consulta o correccion.
- El onboarding define transformacion emocional esperada por momento.
- Cada paso importante produce alivio, claridad, control o deseo de volver.
- El primer wow no depende solo de analisis; tambien puede venir de sentirse entendido, respetado y en control.
- La experiencia evita gamificacion falsa y celebraciones vacias.
- Si el usuario pide ayuda, Manzana responde con una accion pequena y no con documentacion larga.
- El documento define el onboarding completo desde registro/acceso hasta uso activo temprano.
- El sistema distingue etapas del usuario: registrado sin uso, primer contacto, primer valor, activacion minima, activacion fuerte y uso activo temprano.

---

*Fase 3 Producto - Documento 13 - V1.3*
