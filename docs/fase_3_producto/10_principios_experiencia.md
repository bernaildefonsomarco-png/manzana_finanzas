# 10 - Principios de Experiencia

**Fase:** 3 - Producto  
**Estado:** V1  
**Ultima actualizacion:** 23 de mayo, 2026

---

## 1. Tesis

Manzana no debe sentirse como una app contable con IA encima.

Debe sentirse como una inteligencia financiera personal que entiende como habla el usuario, tolera datos imperfectos, protege el dinero con reglas exactas y devuelve claridad sin culpa.

Principio central:

> La experiencia de Manzana debe mover al usuario de confusion a claridad, de culpa a alivio, de desorden a patron visible y de ansiedad a un siguiente paso pequeno.

---

## 2. Promesa de experiencia

Manzana debe sentirse:

- rapida para registrar,
- humana para conversar,
- clara para entender,
- tranquila frente a errores,
- discreta con informacion sensible,
- inteligente sin ser invasiva,
- y util incluso con datos incompletos.

La experiencia falla si el usuario siente:

- que esta llenando formularios,
- que lo estan juzgando,
- que tiene que entender contabilidad,
- que el sistema inventa precision,
- que lo persiguen con mensajes,
- que corregir es dificil,
- o que la IA "sabe" demasiado de forma incomoda.

---

## 3. Principios rectores

| # | Principio | Implicacion |
|---|---|---|
| 1 | Conversacion primero | Registrar y preguntar debe sentirse como escribirle a alguien que entiende. |
| 2 | Claridad antes que contabilidad | El objetivo no es registrar cada centavo perfecto; es generar claridad util. |
| 3 | Dinero con reglas exactas | Saldos, deudas, cajas, pagos que vienen y dinero libre se calculan deterministicamente. |
| 4 | Cero culpa | Manzana describe cambios, no juzga comportamiento. |
| 5 | Correccion natural | Corregir debe ser tan facil como registrar. |
| 6 | Datos imperfectos son validos | El sistema puede trabajar con cuenta `null`, montos faltantes o pendientes, mostrando limites. |
| 7 | Uso parcial es valido | El usuario puede usar solo gastos, solo deudas, solo pagos que vienen o solo dashboard. |
| 8 | Progresion gradual | No mostrar todo al inicio; revelar capacidades cuando el contexto las vuelve utiles. |
| 9 | Confianza visible | Cada dato importante debe poder explicar fuente, estado y posibilidad de correccion. |
| 10 | Proactividad respetuosa | Recordatorios deben ayudar, no perseguir. |
| 11 | Privacidad como experiencia | Modo discreto, sensibilidad y canal importan tanto como el calculo. |
| 12 | Wow con sentido | Sorprender es hacer que el usuario se reconozca en un patron util, no impresionar por impresionar. |

---

## 4. La formula de experiencia

```text
experiencia Manzana =
  baja friccion
  + claridad financiera
  + confianza corregible
  + lenguaje humano
  + autodescubrimiento amable
```

Formula de wow:

```text
wow = espejo personal + verdad concreta + alivio emocional + siguiente paso pequeno
```

Ejemplo de wow correcto:

```text
Tu gasto no subio por todo. Subio sobre todo por transporte: fueron S/75 mas que la semana pasada.
```

Por que funciona:

- es especifico,
- reduce ruido,
- no culpa,
- muestra una verdad concreta,
- permite actuar.

---

## 5. Jerarquia de calidad

Cuando haya tension entre objetivos, priorizar asi:

1. Seguridad financiera y privacidad.
2. Confianza y trazabilidad.
3. Claridad para el usuario.
4. Baja friccion.
5. Personalizacion.
6. Wow.
7. Complejidad funcional.

Regla:

> Ningun wow justifica exponer datos sensibles, inventar certeza o romper confianza.

---

## 6. Canales y sensacion esperada

### 6.1 WhatsApp

Debe sentirse como:

- rapido,
- directo,
- conversacional,
- tolerante a lenguaje natural,
- bueno pidiendo aclaraciones,
- y facil de corregir.

No debe sentirse como:

- formulario por chat,
- bot que exige formato,
- asistente que responde largo todo el tiempo,
- o sistema que confirma de mas.

Ejemplo correcto:

```text
Listo. Cafe S/8 registrado.
```

Ejemplo cuando falta algo:

```text
Me falta el monto. ¿Cuanto fue el taxi?
```

### 6.2 Dashboard

Debe sentirse como:

- calma visual,
- control,
- revision,
- contexto,
- explicacion,
- y edicion segura.

No debe competir con WhatsApp como canal principal de captura, pero si debe permitir registro manual estructurado cuando el usuario ya esta navegando.

### 6.3 Email parsing

Debe sentirse como:

- ayuda pasiva,
- bandeja de pendientes,
- deteccion que pide permiso,
- nunca registro automatico sin aprobacion.

Mensaje mental buscado:

```text
Manzana encontro algo por mi, pero no lo registro sin preguntarme.
```

### 6.4 Descubrimientos

`Insights` no deben sentirse como reportes. Deben sentirse como:

- "Manzana noto algo",
- "mi semana tiene mas sentido",
- "ahora veo que paso",
- "esto puedo corregirlo o vigilarlo".

### 6.5 Recordatorios

`Nudges` deben sentirse como:

- avisos utiles,
- pocos,
- pausables,
- oportunos,
- discretos cuando haga falta.

Si el usuario piensa "me estan molestando", el sistema fallo aunque la regla tecnica sea correcta.

### 6.6 Pagos que vienen y deudas

Deben reducir ansiedad, no aumentarla.

El usuario debe sentir:

```text
Ya se que viene. No me va a agarrar de sorpresa.
```

No:

```text
Tengo otra app recordandome que debo plata.
```

---

## 7. Lenguaje emocional permitido

Manzana puede sonar:

- cercana,
- clara,
- tranquila,
- inteligente,
- breve,
- amable,
- peruana si el contexto lo pide,
- y humana sin exagerar.

Manzana no debe sonar:

- moralista,
- dramaticamente emocional,
- infantil,
- coach financiero agresivo,
- banco,
- app contable,
- o IA que intenta impresionar.

---

## 8. Patrones de copy

### 8.1 Confirmar

```text
Listo. Taxi S/15 registrado.
```

### 8.2 Pedir aclaracion

```text
¿Fue gasto o prestamo a Luis?
```

### 8.3 Corregir

```text
Corregido. Lo cambie de taxi a Uber de trabajo.
```

### 8.4 Reconocer limite de datos

```text
Puedo estimarlo, pero me falta saber desde que cuenta pagaste.
```

### 8.5 Explicar sin juzgar

```text
Delivery subio esta semana. Fueron 4 pedidos mas que la anterior.
```

### 8.6 Proactividad respetuosa

```text
Tu internet suele pagarse esta semana. ¿Quieres marcarlo si ya lo pagaste?
```

### 8.7 Modo discreto

```text
Tienes un compromiso financiero proximo. ¿Quieres verlo?
```

---

## 9. Anti-principios

No construir experiencias que dependan de:

- obligar al usuario a clasificar todo,
- exigir cuentas perfectas desde el dia 1,
- mostrar dashboards vacios como fracaso,
- enviar recordatorios por defecto sin control,
- llamar "insights" a cualquier metrica,
- esconder errores del sistema,
- usar IA para inventar seguridad,
- convertir todo calculo en agente,
- llenar la UI de tarjetas sin jerarquia,
- o usar lenguaje tecnico como label principal.

---

## 10. Estados que deben sentirse cuidados

### 10.1 Usuario nuevo

Debe sentir:

```text
Puedo empezar con poco.
```

No:

```text
Tengo que configurar todo antes de recibir valor.
```

### 10.2 Usuario con pocos datos

Debe ver aprendizaje progresivo:

```text
Estoy aprendiendo tus gastos. Con unos registros mas podre mostrarte patrones.
```

### 10.3 Usuario con error de IA

Debe sentir que corregir mejora el sistema:

```text
Gracias. Lo corrijo y lo tendre en cuenta para la proxima.
```

### 10.4 Usuario endeudado

Debe recibir claridad sin verguenza:

```text
Tienes 3 cuotas activas. La mas proxima vence el viernes.
```

### 10.5 Usuario inactivo

Debe recibir una puerta suave de regreso:

```text
Si quieres, reconstruimos esta semana en 1 minuto.
```

No:

```text
Hace dias que no registras nada.
```

---

## 11. Relacion con arquitectura

Estos principios no son solo copy. Deben afectar decisiones tecnicas:

| Decision tecnica | Principio de experiencia |
|---|---|
| Context Packs | Evitan que cada agente reciba todo y responda de forma invasiva. |
| FinancialOrchestrator | Decide profundidad, riesgo, canal y herramientas necesarias. |
| Motores deterministicos | Protegen confianza en calculos de dinero. |
| Pending Inbox | Evita registrar datos detectados sin permiso. |
| Transactional Outbox | Evita inconsistencias entre movimiento, evento y respuesta. |
| NudgePolicyEngine | Evita que recordatorios se vuelvan spam. |
| DisclosureEngine | Controla que se puede mostrar segun canal y sensibilidad. |
| Learning Engine | Personaliza sin saltarse consentimiento. |

---

## 12. Checklist de experiencia

Antes de implementar una pantalla, flujo o respuesta, preguntar:

- El usuario entiende que paso?
- Sabe que puede corregirlo?
- Se muestra fuente o estado cuando importa?
- Hay una accion clara?
- Se evita culpa?
- Se evita lenguaje tecnico innecesario?
- Se respeta modo discreto si aplica?
- Se evita enviar mensajes sin permiso?
- Se degrada bien si faltan datos?
- Se siente como Manzana o como una app generica?

---

## 13. Metricas de experiencia

| Metrica | Que indica |
|---|---|
| Tiempo al primer registro | Friccion de entrada. |
| Correcciones completadas | Confianza y recuperacion. |
| Pendientes resueltos | Claridad y utilidad de bandeja. |
| Primer descubrimiento visto | Primer wow. |
| Respuesta a recordatorios | Utilidad sin molestia. |
| Pausa/opt-out de recordatorios | Riesgo de spam. |
| Uso parcial retenido | Producto util sin exigir todo. |
| Preguntas de "por que?" resueltas | Confianza explicable. |
| Retorno D7/D30 | Valor sostenido. |

---

## 14. Criterios de aceptacion

- La experiencia no exige configuracion completa para comenzar.
- WhatsApp permite registrar, corregir y consultar en lenguaje natural.
- Dashboard muestra claridad y control, no solo datos.
- Todo dato importante puede corregirse.
- Datos incompletos se explican sin bloquear todo.
- Insights se muestran como descubrimientos, no reportes frios.
- Pagos que vienen reducen sorpresa, no ansiedad.
- Recordatorios son consentidos, pausables y pocos.
- Modo discreto protege mensajes proactivos sensibles.
- Errores se recuperan con humildad y accion clara.
- El lenguaje visible evita tecnicismos cuando existe una alternativa humana.

---

*Fase 3 Producto - Documento 10 - V1*
