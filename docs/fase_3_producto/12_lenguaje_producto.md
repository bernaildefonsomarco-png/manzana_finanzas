# 12 - Lenguaje de Producto

**Fase:** 3 - Producto  
**Estado:** V1.1  
**Ultima actualizacion:** 24 de mayo, 2026

---

## 1. Tesis

El lenguaje de Manzana debe convertir complejidad financiera en palabras que el usuario ya usa o entiende.

El sistema puede tener nombres tecnicos como `Insight`, `RecurringRule`, `NudgeCandidate` o `Pending Inbox`, pero el usuario no debe sentir que esta usando un panel interno.

Principio:

> Si una palabra es correcta tecnicamente pero enfria la experiencia, se queda en codigo y se traduce en producto.

---

## 2. Objetivo

Este documento define:

- nombres visibles,
- nombres internos,
- labels de navegacion,
- copy de acciones,
- terminos prohibidos o de uso limitado,
- lenguaje por canal,
- y reglas para decidir cuando una palabra tecnica puede aparecer.

No reemplaza:

- contratos de datos,
- enums,
- arquitectura,
- ni modelos de base de datos.

---

## 3. Principios de lenguaje

| # | Principio | Regla |
|---|---|---|
| 1 | Humano antes que tecnico | Usar la palabra que el usuario entiende, no la que usa el backend. |
| 2 | Claridad antes que poesia | No sacrificar comprension por sonar bonito. |
| 3 | Cero culpa | Evitar palabras que sugieran fallo personal. |
| 4 | Preciso sin ser contable | Explicar dinero con exactitud, sin lenguaje de contador. |
| 5 | Consistente por canal | Un concepto debe sentirse igual en WhatsApp y Dashboard, aunque el formato cambie. |
| 6 | Progresivo | No introducir terminos hasta que el usuario los necesite. |
| 7 | Discreto en sensibilidad | Deuda, salud, personas, bancos y saldos requieren lenguaje cuidadoso. |
| 8 | Accionable | Si se muestra informacion, debe quedar claro que puede hacer el usuario. |

---

## 4. Diccionario interno vs visible

| Interno / tecnico | Visible principal | Alternativas | Notas |
|---|---|---|---|
| `Insights` | Descubrimientos | Lo que Manzana noto, Algo que cambio, Tu semana en claro | Evitar "Insights" como label principal. |
| `Nudges` | Recordatorios | Avisos, Te aviso si... | En configuracion usar "Recordatorios". |
| `Recurrentes` | Pagos que vienen | Pagos que se repiten, Lo que viene | Es una parte de Compromisos cuando se ve junto a deudas/cuotas. |
| `Pending Inbox` | Pendientes | Por revisar | Debe sentirse como control, no bandeja tecnica. |
| `Movements` | Movimientos | Gastos, ingresos, pagos, transferencias | En UI general puede ser "Movimientos"; en copy usar tipo concreto. |
| `Account` | Cuenta | Yape, BCP, efectivo | "Cuenta" esta bien si es clara. |
| `Box` | Caja | Separado para..., Reserva, Apartado | "Caja" funciona si se explica visualmente. |
| `Free money` | Libre en cuentas | Dinero sin separar, saldo libre | Uso de detalle, no numero principal. |
| `Operational free money` | Dinero libre | Libre para usar, Te queda libre | Numero principal visible. No usar "operativo" frente al usuario. |
| `Debt` | Deuda / compromiso | Lo que debes, Te deben | "Deuda" es correcto, pero sensible. |
| `Related person` | Persona | Luis, Ana, tu hermano | No mostrar como entidad tecnica. |
| `Recurring occurrence` | Pago esperado | Pago de este mes, cuota de este mes | No usar "ocurrencia". |
| `NudgePolicy` | Preferencias de recordatorios | Reglas de avisos | No mostrar como policy. |
| `Confidence` | Seguridad / por confirmar | Parece, confirmado, falta revisar | No mostrar porcentaje salvo modo avanzado. |
| `Audit log` | Historial de cambios | Cambios recientes | Tecnico. |
| `Outbox/Event Bus` | No visible | No visible | Nunca mostrar al usuario. |

---

## 5. Nombres de navegacion V1

### 5.1 Mobile

```text
Home | Movimientos | Pendientes | Mi Dinero | Mas
```

Dentro de Mas:

```text
Deudas
Pagos que vienen
Descubrimientos
Configuracion
```

### 5.2 Desktop

```text
Home
Movimientos
Pendientes
Mi Dinero
Deudas
Pagos que vienen
Descubrimientos
Configuracion
```

Regla:

> No usar "Insights", "Recurrentes" ni "Nudges" como labels visibles principales.

---

## 6. Conceptos principales

### 6.1 Dinero libre

Es uno de los conceptos mas importantes del producto.

Definicion visible:

```text
Lo que puedes usar despues de separar cajas y considerar compromisos.
```

Regla de producto:

> El usuario ve **Dinero libre** como numero principal. Internamente ese numero corresponde al dinero libre despues de cajas y compromisos proximos no cubiertos. No usar "dinero libre operativo" como label visible normal.

Jerarquia:

```text
Dinero total
  - Cajas / dinero separado
  = Libre en cuentas
  - Compromisos proximos no cubiertos
  = Dinero libre
```

Uso visible:

| Contexto | Label | Uso |
|---|---|---|
| Home / resumen | Dinero libre | Numero principal. |
| Mi Dinero detalle | Libre en cuentas | Subcalculo antes de compromisos. |
| Explicacion / "por que?" | Desglose completo | Total, cajas, libre en cuentas, compromisos, dinero libre. |
| Conversacion rapida | Dinero libre | Respuesta directa. |

Copy recomendado:

```text
Tienes S/220 libres.
```

Con explicacion:

```text
Tienes S/800 en total, pero S/580 estan separados o comprometidos. Libre: S/220.
```

Version mas clara en detalle:

```text
Total: S/800
- Cajas: S/300
= Libre en cuentas: S/500
- Compromisos proximos: S/280
= Dinero libre: S/220
```

Evitar:

```text
Saldo operativo neto disponible.
```

### 6.2 Cajas

Definicion visible:

```text
Dinero separado para algo.
```

Copy:

```text
Caja Emergencia
Separado para alquiler
Reserva para laptop
```

Evitar:

```text
Bucket financiero
Subcuenta virtual
```

### 6.3 Compromisos

`Compromisos` es termino paraguas. Usar cuando se agrupan obligaciones o pagos esperados que reducen la disponibilidad real.

Jerarquia:

```text
Compromisos
  ├── Deudas
  ├── Cuotas
  └── Pagos que vienen
```

Las cajas no son compromisos. Las cajas son dinero separado que puede cubrir compromisos.

Copy:

```text
Compromisos de este mes
```

Reglas:

- Si la vista muestra solo suscripciones/servicios esperados, usar **Pagos que vienen**.
- Si la vista agrupa deudas, cuotas y pagos esperados, usar **Compromisos**.
- Si una caja cubre un compromiso, decir "cubierto por caja" o "separado", no sumar como compromiso nuevo.

### 6.4 Pendientes

Definicion visible:

```text
Cosas que Manzana detecto pero necesitan tu confirmacion.
```

Pendientes no son movimientos confirmados.

Regla:

```text
Pendientes = bandeja de revision
Movimientos = historial confirmado/corregido
```

Un pendiente puede convertirse en movimiento cuando el usuario confirma. Antes de eso:

- no afecta saldo,
- no debe aparecer mezclado como gasto confirmado,
- puede aparecer en busqueda como resultado separado.

Ejemplo de busqueda:

```text
No encontre movimientos confirmados de Netflix ese dia.
Tambien hay 1 pendiente parecido por revisar.
```

Copy:

```text
Tienes 3 pendientes por revisar.
```

Evitar:

```text
Inbox de validaciones
Eventos pendientes
```

### 6.5 Descubrimientos

Definicion visible:

```text
Cosas utiles que Manzana noto en tus datos.
```

Copy:

```text
Manzana noto algo.
```

```text
Algo cambio esta semana.
```

Evitar:

```text
Insight accionable detectado.
```

### 6.6 Pagos que vienen

Definicion visible:

```text
Pagos que suelen volver o que esperas pagar pronto.
```

Copy:

```text
Tu internet suele pagarse esta semana.
```

Evitar:

```text
Recurrente mensual detectado.
```

### 6.7 Recordatorios

Definicion visible:

```text
Avisos que Manzana puede enviarte si tu lo permites.
```

Copy:

```text
¿Quieres que te avise?
```

Evitar:

```text
Activar nudge.
```

---

## 7. Lenguaje por canal

La consistencia por canal no significa usar exactamente las mismas palabras. Significa conservar el mismo concepto y adaptar el framing al formato.

| Concepto | WhatsApp | Dashboard | Proactivo | Modo discreto |
|---|---|---|---|---|
| Descubrimiento | "Manzana noto algo..." | Descubrimientos | "Hay un cambio que puede servirte ver." | "Hay algo por revisar." |
| Pago que viene | "Tu internet suele pagarse esta semana." | Pagos que vienen | "Tienes un pago que viene esta semana." | "Tienes un compromiso proximo." |
| Recordatorio | "¿Quieres que te avise?" | Recordatorios | "Te aviso porque lo activaste." | "Tienes un aviso pendiente." |
| Pendiente | "Detecte 3 movimientos para revisar." | Pendientes | "Tienes pendientes por revisar." | "Tienes movimientos por revisar." |
| Dinero libre | "Tienes ~S/220 libres." | Dinero libre | Evitar proactivo salvo opt-in claro. | No mostrar monto. |
| Deuda/cuota | "Tu cuota vence en 2 dias." | Deudas / Cuotas | "Tienes una cuota proxima." | "Tienes un compromiso financiero proximo." |

### 7.1 WhatsApp

Debe ser:

- mas natural,
- mas corto,
- mas parecido a conversacion,
- menos explicativo salvo que haya duda.

Ejemplo:

```text
Listo. Cafe S/8 registrado.
```

### 7.2 Dashboard

Puede ser:

- mas estructurado,
- mas escaneable,
- con labels consistentes,
- con estados visibles.

Ejemplo:

```text
Pendientes
3 por revisar
```

### 7.3 Mensajes proactivos

Debe ser:

- discreto,
- breve,
- opcional,
- pausable.

Ejemplo:

```text
Tienes un pago que viene esta semana. ¿Quieres verlo?
```

### 7.4 Modo discreto

Usar lenguaje generico:

```text
Tienes un movimiento por revisar.
```

```text
Tienes un compromiso financiero proximo.
```

No mostrar:

- montos,
- bancos,
- personas,
- comercios,
- categorias sensibles,
- saldos,
- deudas especificas.

---

## 8. Acciones y botones

### 8.1 Acciones recomendadas

| Accion | Label visible |
|---|---|
| Confirmar pendiente | Confirmar |
| Rechazar pendiente | No era eso |
| Ver detalle | Ver |
| Ver movimientos | Ver movimientos |
| Corregir | Corregir |
| Borrar | Borrar |
| Deshacer | Deshacer |
| Marcar pago recurrente | Marcar pagado |
| Crear caja | Separar dinero |
| Vincular caja | Usar caja |
| Pausar nudge | Pausar recordatorio |
| Activar modo discreto | Activar modo discreto |
| Ver explicacion | Por que? |

### 8.2 Evitar en botones

- "Procesar",
- "Ejecutar",
- "Validar entidad",
- "Resolver evento",
- "Commit",
- "Aceptar prediccion",
- "Activar nudge",
- "Generar insight".

---

## 9. Estados visibles

| Estado tecnico | Visible |
|---|---|
| `confirmed` | Confirmado |
| `pending_confirmation` | Por confirmar |
| `needs_review` | Por revisar |
| `suggested` | Sugerido |
| `active` | Activo |
| `paused` | Pausado |
| `cancelled` | Desactivado |
| `overdue` | Pendiente / vencido segun contexto |
| `outdated` | Actualizado |
| `dismissed` | Ignorado / descartado |

Regla:

> No todos los estados internos merecen aparecer. Mostrar solo los que ayudan al usuario a confiar o actuar.

### 9.1 Regla para `overdue`

`Vencido` tiene mas carga emocional que `pendiente`. Usarlo solo cuando aporta claridad y accion.

| Contexto | Visible recomendado | Regla |
|---|---|---|
| Pago que viene con 0-2 dias despues de ventana | Pendiente | Evita urgencia excesiva. |
| Pago que viene con 3+ dias despues de ventana | Vencido | Solo si hay fecha clara y opt-in/contexto. |
| Cuota/deuda formal con fecha pasada | Vencido | Si hay fecha confirmada. |
| Deuda informal entre personas | Pendiente | Evitar tono de cobranza salvo que el usuario lo pida. |
| Pendiente de email/revision | Pendiente / por revisar | Nunca "vencido". |
| Modo discreto | Compromiso pendiente | No exponer detalle. |

Ejemplo:

```text
Internet esta pendiente desde esta semana.
```

```text
Tu cuota figura vencida desde el viernes.
```

---

## 10. Lenguaje de incertidumbre

| Situacion | Lenguaje recomendado |
|---|---|
| Alta confianza | "Parece..." |
| Baja confianza | "No estoy seguro..." |
| Dato faltante | "Me falta..." |
| Estimacion | "Aprox." / "Con los datos que tengo..." |
| Pendiente | "Por revisar" |
| Email detectado | "Detecte..." pero "no lo registro sin confirmar". |

Ejemplos:

```text
Parece Netflix, pero quiero confirmarlo antes de marcarlo como pago que viene.
```

```text
Con los datos que tengo, tienes ~S/220 libres.
```

Evitar:

```text
Detectado automaticamente con 82% de confianza.
```

---

## 11. Lenguaje sensible

### 11.1 Deudas

Permitido:

```text
Tienes una cuota proxima.
```

```text
Le debes S/150 a Luis.
```

Modo discreto:

```text
Tienes un compromiso financiero proximo.
```

Evitar:

```text
Estas endeudado.
```

```text
Deberias pagarle a Luis.
```

### 11.2 Salud, apuestas o compras delicadas

Usar:

```text
Hay un movimiento sensible por revisar.
```

Categorias o señales de referencia:

| Sensibilidad | Ejemplos | Lenguaje |
|---|---|---|
| Alta | apuestas, casino, prestamos, deuda sensible, salud mental, terapia, compras intimas, farmacia delicada | Generico o Dashboard only. |
| Media | farmacia general, clinica, banco, tarjeta, persona relacionada, licoreria | Cuidar canal, monto y contexto. |
| Baja | supermercado, taxi, cafe, almuerzo, servicios comunes | Lenguaje normal. |

Reglas:

- Farmacia no siempre es alta sensibilidad, pero en proactivos debe tratarse al menos como media.
- Psicologo/terapia/salud mental es alta sensibilidad.
- Apuestas/casino es alta sensibilidad.
- Bancos, tarjetas y deudas son sensibles por exposicion financiera.
- Personas relacionadas son sensibles si el mensaje es proactivo o modo discreto esta activo.

Evitar:

```text
Tu gasto en [categoria sensible] subio.
```

### 11.3 Personas

Usar nombres solo cuando:

- el usuario inicio la consulta,
- el dato no es proactivo sensible,
- modo discreto no esta activo,
- y aporta claridad.

---

## 12. Estados vacios

Los estados vacios son parte de la experiencia, no espacios muertos. Deben explicar que pasa, reducir ansiedad y ofrecer un siguiente paso pequeno.

Reglas:

- No decir "no hay data" como mensaje principal.
- No culpar al usuario por no haber configurado algo.
- No mostrar tours largos dentro del estado vacio.
- Dar maximo un siguiente paso claro.
- Si el usuario ya uso WhatsApp, permitir continuar por WhatsApp o Dashboard.
- Si la ausencia de datos impide calcular algo, decir que falta con naturalidad.

### 12.1 Home / inicio nuevo

```text
Empieza registrando un gasto, ingreso o saldo. Con unos datos, Manzana empieza a ordenarte el dia.
```

Accion sugerida:

```text
Registrar movimiento
```

### 12.2 Movimientos sin historial

```text
Todavia no hay movimientos confirmados.
```

```text
Cuando registres algo por WhatsApp o Dashboard, aparecera aqui.
```

### 12.3 Pendientes vacio

```text
No tienes pendientes por revisar.
```

```text
Cuando Manzana detecte algo que necesita confirmacion, lo veras aqui.
```

### 12.4 Mi Dinero sin cuentas

```text
Aun no se cuanto dinero tienes disponible.
```

```text
Agrega una cuenta o dime tu saldo por WhatsApp.
```

### 12.5 Dinero libre no calculable

```text
Puedo calcular tu dinero libre cuando tenga al menos un saldo o una cuenta.
```

Evitar:

```text
Dinero libre: S/0
```

si no hay datos suficientes.

### 12.6 Cajas vacias

```text
No has separado dinero todavia.
```

```text
Puedes crear una caja cuando quieras apartar plata para algo concreto.
```

### 12.7 Deudas sin registros

```text
No tienes deudas registradas.
```

```text
Si le debes a alguien, te deben o tienes una cuota, puedes anotarlo aqui.
```

### 12.8 Pagos que vienen vacio

```text
No tienes pagos que vienen registrados.
```

```text
Cuando aparezca un pago repetido o lo agregues manualmente, Manzana lo pondra aqui.
```

### 12.9 Descubrimientos sin datos suficientes

```text
Estoy aprendiendo tu ritmo.
```

```text
Con unos movimientos mas podre mostrarte patrones utiles.
```

No prometer descubrimientos inmediatos si todavia no hay evidencia suficiente.

### 12.10 Recordatorios vacio o desactivados

```text
No tienes recordatorios activos.
```

```text
Si quieres, Manzana puede avisarte antes de pagos o compromisos importantes.
```

Si el usuario no dio opt-in:

```text
No te enviare recordatorios sin que los actives.
```

### 12.11 Email no conectado o sin pendientes

Sin email conectado:

```text
Puedes conectar tu correo para que Manzana detecte movimientos por revisar.
```

Sin pendientes:

```text
No hay movimientos de email por revisar.
```

Regla: email nunca debe sonar como registro automatico; siempre debe reforzar que el usuario confirma.

---

## 13. Microcopy por feature

### 13.1 Registro

```text
Listo. Taxi S/15 registrado.
```

```text
Me falta el monto. ¿Cuanto fue?
```

### 13.2 Correccion

```text
Corregido. Lo cambie a Uber de trabajo.
```

```text
Deshecho. Volvio al dato anterior.
```

### 13.3 Email parsing

```text
Detecte 3 movimientos para revisar. ¿Quieres verlos juntos?
```

```text
No lo registro sin que lo confirmes.
```

### 13.4 Dinero libre

```text
Tienes S/220 libres despues de cajas y compromisos.
```

### 13.5 Descubrimientos

```text
Manzana noto algo.
```

```text
Algo cambio esta semana.
```

### 13.6 Pagos que vienen

```text
Tu internet suele pagarse esta semana.
```

```text
¿Quieres marcarlo como pagado?
```

### 13.7 Recordatorios

```text
¿Quieres que te avise?
```

```text
Listo. Pauso estos recordatorios por 7 dias.
```

---

## 14. Glosario recomendado V1

| Concepto | Usar |
|---|---|
| Gasto | Gasto |
| Ingreso | Ingreso |
| Transferencia | Transferencia |
| Pago de deuda | Pago de deuda / cuota |
| Prestamo dado | Prestamo |
| Prestamo recibido | Prestamo recibido |
| Devolucion recibida | Devolucion |
| Ajuste | Ajuste |
| Categoria | Categoria |
| Subcategoria | Detalle / subcategoria |
| Etiqueta | Etiqueta |
| Cuenta | Cuenta |
| Caja | Caja |
| Pendiente | Pendiente |
| Descubrimiento | Descubrimiento |
| Pago que viene | Pago que viene |
| Recordatorio | Recordatorio |

---

## 15. Palabras a evitar o limitar

Evitar frente al usuario:

- `insight`,
- `nudge`,
- `recurrente` como label principal,
- `pipeline`,
- `orchestrator`,
- `policy`,
- `confidence score`,
- `outbox`,
- `event bus`,
- `runtime`,
- `schema`,
- `deterministico`,
- `clasificacion semantica`,
- `modelo`.

Uso permitido si el usuario es tecnico o en docs:

- arquitectura,
- implementacion,
- soporte,
- auditoria,
- logs internos.

---

## 16. Reglas de consistencia

- Si una pantalla usa "Pagos que vienen", no mezclar con "Recurrentes" en el mismo contexto visible.
- Si una pantalla usa "Descubrimientos", no titular otra seccion "Insights".
- Si se habla de "Recordatorios", no decir "Nudges" en configuracion.
- "Dinero libre" debe distinguirse siempre de saldo total y de "Libre en cuentas".
- "Libre en cuentas" es detalle; "Dinero libre" es el numero principal consolidado.
- "Compromisos" agrupa deudas, cuotas y pagos que vienen; no debe incluir cajas como obligacion.
- "Pendientes" siempre implica que el usuario puede revisar, confirmar o rechazar.
- "Pendientes" no debe mezclarse visualmente con movimientos confirmados sin marcar su estado.
- "Vencido" solo se usa cuando la regla de `overdue` lo permite.
- No llamar "gasto" a transferencia, asignacion interna o pago de deuda si no corresponde.
- Los estados vacios deben ofrecer un siguiente paso pequeno, no una lista completa de funciones.

---

## 17. Criterios de aceptacion

- Los labels principales usan lenguaje humano, no tecnico.
- `Insights` no aparece como label visible principal en V1.
- `Recurrentes` no aparece como label visible principal en V1.
- `Nudges` no aparece como label visible principal en V1.
- Dashboard y WhatsApp usan nombres consistentes.
- Modo discreto tiene lenguaje generico y seguro.
- Acciones usan verbos simples.
- Estados visibles ayudan a decidir o confiar.
- El lenguaje evita culpa, vigilancia y falsa precision.
- Cada termino visible tiene equivalente tecnico claro para implementacion.
- `Dinero libre` queda definido como numero principal visible; `Libre en cuentas` queda como subcalculo de detalle.
- `Compromisos` tiene jerarquia explicita: deudas, cuotas y pagos que vienen.
- `Pendientes` queda separado de movimientos confirmados y puede aparecer en busqueda como resultado por revisar.
- `overdue` tiene regla concreta para decidir entre "pendiente" y "vencido".
- Las categorias o senales sensibles tienen niveles de referencia para lenguaje discreto.
- Las pantallas principales tienen estado vacio V1 definido.

---

*Fase 3 Producto - Documento 12 - V1.1*
