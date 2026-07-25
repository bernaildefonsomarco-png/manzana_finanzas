# Feature 3: Dashboard Inteligente

**Parte del Paso 5/20 — Alcance V1.0**  
**Prioridad:** P0  
**Última actualización:** 3 de junio, 2026  
**Estado:** V2.1 — Estrategia alineada con WhatsApp + Motor IA + labels visibles V1

---

## 1. Tesis

WhatsApp captura. El Dashboard da claridad, control y confianza.

El Dashboard de Manzana no debe competir con WhatsApp como canal principal de registro. Debe ser el lugar donde el usuario revisa, entiende, corrige y toma control cuando quiere ver el panorama completo.

No es un panel contable. Es un espejo financiero inteligente.

Debe responder rápido:

- ¿Cómo estoy?
- ¿Qué cambió?
- ¿Qué tengo pendiente?
- ¿Cuánto puedo gastar realmente?
- ¿Qué debo revisar?
- ¿De dónde salió este dato?
- ¿Puedo corregirlo?
- ¿Qué sabe Manzana de mi dinero?

---

## 2. Qué NO debe ser

El Dashboard no debe convertirse en:

- Excel con gráficos.
- Un panel lleno de números desde el día 1.
- Una app contable.
- Un lugar que exige configurar todo.
- Un reemplazo de WhatsApp.
- Una pantalla vacía cuando no hay datos.
- Un reporte largo sin acción.
- Un lugar que muestra features no usadas como secciones muertas.

Principio:

> El Dashboard debe mostrar claridad útil, no complejidad disponible.

---

## 3. Relación con WhatsApp y Motor IA

| Sistema | Rol |
|---|---|
| WhatsApp | Captura, conversación, confirmaciones rápidas, correcciones y recordatorios. |
| Dashboard | Revisión, control, historial, confianza, configuración y claridad visual. |
| Motor IA | Explicación, memoria consultable, insights, búsqueda natural y respuestas contextuales. |
| Core Financiero | Fuente de verdad de movimientos, saldos, cajas, deudas y recurrentes. |

Reglas:

- Las ediciones y registros manuales estructurados pueden ir directo al Core.
- Las explicaciones, consultas naturales y búsquedas semánticas usan Motor IA.
- Las confirmaciones pendientes pueden hacerse desde Dashboard o WhatsApp.
- Todo dato mostrado debe poder explicar fuente y cálculo.
- El Dashboard no debe registrar emails automáticamente.

---

## 4. Jobs principales del Dashboard

### 4.1 Estado actual

Responder:

```text
¿Cómo estoy ahora?
```

Muestra:

- dinero disponible real,
- dinero total,
- compromisos próximos,
- pendientes importantes,
- último cambio relevante,
- insight destacado,
- movimientos recientes.

### 4.2 Revisión y corrección

Responder:

```text
¿Qué registré y puedo corregirlo?
```

Permite:

- ver historial,
- filtrar,
- buscar,
- crear un movimiento manual estructurado,
- editar,
- borrar,
- corregir categoría/cuenta/caja,
- ver fuente,
- ver confianza,
- preguntar "¿por qué?".

### 4.2.1 Registro manual desde Dashboard

WhatsApp sigue siendo el flujo principal de captura, pero el Dashboard debe permitir registrar movimientos cuando el usuario ya está revisando su dinero y quiere actuar sin volver a WhatsApp.

Principio:

> El registro manual del Dashboard no debe ser un formulario contable pesado, pero sí debe pedir los datos necesarios para que el Core pueda registrar dinero real con confianza.

Debe llamarse preferentemente:

```text
Nuevo movimiento
```

No:

```text
Formulario contable
```

#### Cuándo se usa

- El usuario está revisando movimientos y recuerda algo que no registró.
- El usuario quiere registrar un ingreso, gasto, transferencia o ajuste desde la app.
- El usuario está corrigiendo su historial y necesita crear el movimiento faltante.
- El usuario quiere registrar un pago de deuda o recurrente desde su pantalla correspondiente.
- El usuario no quiere usar WhatsApp en ese momento.

#### Campos necesarios

| Campo | Requerido | Regla |
|---|---|---|
| Tipo de movimiento | Sí | Usa el enum canónico V1. |
| Monto | Sí | Debe ser positivo y válido para la moneda. |
| Moneda | Sí | Default del usuario; editable si el dominio lo soporta. |
| Fecha | Sí | Default hoy; puede cambiarse. |
| Cuenta/caja origen | Depende | Requerida si afecta salida de dinero. |
| Cuenta/caja destino | Depende | Requerida en transferencias/asignaciones internas. |
| Categoría | Depende | Requerida para gasto/ingreso salvo pendiente de clasificación. |
| Persona relacionada | Depende | Requerida para préstamos, deudas o devoluciones. |
| Descripción/nota | Recomendado | Ayuda a recordar y buscar. |
| Etiquetas | Opcional | Contexto humano. |

#### Tipos soportados

El selector debe soportar los 11 tipos canónicos:

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

#### UX esperada

- Abrir como modal/drawer desde Movimientos y desde acciones contextuales.
- Mostrar solo campos relevantes al tipo elegido.
- Prellenar fecha actual y cuenta preferida si existe.
- Mostrar impacto antes de guardar: cuenta afectada, caja afectada, deuda afectada o saldo estimado.
- Permitir guardar, cancelar o seguir registrando otro.
- Si hay riesgo o datos incompletos, pedir confirmación clara.

#### Reglas

- No usa la barra de búsqueda natural para crear datos.
- No requiere LLM para funcionar.
- Puede sugerir categoría/cuenta si existe confianza suficiente, pero el usuario ve y confirma.
- Todo registro manual queda con fuente `Dashboard/manual`.
- Todo registro manual pasa por Core, validadores, audit log y transactional outbox.
- Si el registro parece duplicado, `Dedup Engine` debe advertir antes de guardar.
- Si el tipo implica deuda, recurrente o caja, se usa el motor determinístico correspondiente.

### 4.3 Confirmación

Responder:

```text
¿Qué necesita mi aprobación?
```

Muestra:

- emails pendientes,
- movimientos dudosos,
- pagos que vienen sugeridos,
- acciones de riesgo,
- batches de pendientes.

Regla:

> Pendiente no afecta saldo hasta confirmación.

### 4.4 Claridad

Responder:

```text
¿Qué cambió y qué significa?
```

Muestra:

- cambios por periodo,
- categorías principales,
- patrones,
- anomalías,
- deudas,
- pagos que vienen,
- cajas,
- próximos pagos.

### 4.5 Configuración progresiva

Responder:

```text
¿Qué puedo activar o ajustar ahora?
```

Permite:

- conectar email,
- crear caja,
- configurar nudge,
- marcar recurrente,
- revisar deuda,
- ajustar modo discreto,
- gestionar preferencias.

---

## 5. Pantallas V1

V1 debe ser compacto. No se debe crear una pantalla por cada idea.

| Pantalla | Propósito |
|---|---|
| Home | Estado actual, pendientes, insight principal, próximos pagos y acción sugerida. |
| Movimientos | Historial, filtros, corrección, fuente, confianza y detalle. |
| Pendientes | Emails, movimientos dudosos, pagos que vienen sugeridos y acciones por confirmar. |
| Mi Dinero | Cuentas, cajas, dinero libre y compromisos generales. |
| Deudas | Seguimiento de deudas, progreso, personas relacionadas, pagos. |
| Compromisos / Pagos que vienen | Pagos esperados, calendario, detección, estado. Internamente: Recurrentes. |
| Descubrimientos | Qué cambió, patrones, anomalías y explicación accionable. Internamente: Insights. |
| Configuración | Email, recordatorios, preferencias y privacidad. |

---

## 6. Home

Home debe ser útil en menos de 10 segundos.

### 6.1 Componentes

| Componente | Qué muestra | Regla |
|---|---|---|
| Dinero libre | Cuánto puede usar realmente | Siempre distinguir de dinero total. |
| Estado del periodo | Gasto/ingreso/resumen actual | No saturar con métricas. |
| Pendiente principal | Email o acción que requiere aprobación | Si no hay pendientes, no mostrar bloque vacío. |
| Descubrimiento destacado | Cambio o patrón más relevante | Solo si hay datos suficientes. |
| Próximo compromiso | Cuota, recurrente o deuda próxima | Mostrar si existe y es relevante. |
| Movimientos recientes | Últimos registros confirmados | Con fuente y acción de corrección. |
| Acción sugerida | Next best action | Solo si hay señal fuerte. |

### 6.2 Ejemplos

Usuario temprano:

```text
Registraste 4 movimientos esta semana. Aún estoy aprendiendo tus patrones.
```

Usuario con cajas:

```text
Tienes S/220 libres después de separar alquiler, emergencia y cuota laptop.
```

Usuario con pendientes:

```text
Tienes 3 movimientos de email por confirmar. Revisarlos puede mejorar tu resumen de esta semana.
```

Usuario avanzado:

```text
Lo más distinto esta semana fue transporte: subió S/75. La mayor parte fue Uber de trabajo.
```

### 6.3 Acción sugerida

Home puede mostrar una acción sugerida (next best action) cuando hay una señal fuerte.

#### Señales que activan una acción sugerida

| Señal | Descripción |
|---|---|
| Pendientes sin resolver | Hay emails o movimientos dudosos sin confirmar hace más de 24h. |
| Compromiso próximo (<3 días) | Una cuota, recurrente o deuda tiene vencimiento en los próximos 3 días. |
| Descubrimiento relevante nuevo | Se detectó un patrón nuevo, anomalía o cambio significativo que requiere atención. |
| Deuda con cuota vencida | Una deuda tiene un pago que ya venció y no fue registrado. |
| Pago que viene no pagado | Un pago esperado activo pasó su fecha esperada sin registro de pago. |

#### Ejemplos concretos

```text
Tienes 4 emails por confirmar. Uno es de hace 3 días.
[Revisar pendientes]
```

```text
Tu cuota de la laptop vence mañana (S/400).
[Ver deuda]
```

```text
Tu internet venció hace 2 días. ¿Ya lo pagaste?
[Marcar pagado]
```

```text
Esta semana gastaste 40% más en delivery que la anterior.
[Ver detalle]
```

```text
La cuota del banco venció hace 3 días.
[Registrar pago]
```

#### Priorización

Máximo 1 acción sugerida visible en Home. Orden de prioridad:

1. Pendientes sin resolver (>24h).
2. Compromisos próximos (<3 días).
3. Deudas con cuota vencida.
4. Pagos que vienen no pagados.
5. Descubrimientos relevantes nuevos.

#### Qué muestra

| Elemento | Descripción |
|---|---|
| Ícono | Indicador visual del tipo de señal. |
| Descripción corta | Una línea que explica la situación. |
| Botón CTA | Una sola acción principal. |

#### Regla

> Si ninguna señal es lo suficientemente fuerte, no mostrar nada. No inventar acciones para llenar espacio.

---

## 7. Movimientos

Movimientos es la pantalla de confianza.

### 7.1 Filtros

| Filtro | Opciones |
|---|---|
| Periodo | Hoy, ayer, esta semana, este mes, rango personalizado. |
| Tipo | Gasto, ingreso, transferencia, asignación interna, deuda, pago deuda, préstamo, devolución, recurrente, ajuste. |
| Categoría | 12 categorías base, subcategorías y "Sin clasificar". |
| Cuenta | Yape, BCP, efectivo, Plin, etc. |
| Caja | Libre, emergencia, alquiler, viaje, etc. |
| Persona | Luis, Ana, papá, etc. |
| Fuente | WhatsApp, email confirmado, dashboard/manual, recurrente. |
| Confianza | Todos, dudosos, corregidos, pendientes. |
| Etiqueta | trabajo, social, impulso, recurrente, etc. |
| Búsqueda | Texto libre o búsqueda natural. |

### 7.2 Cada movimiento muestra

| Campo | Ejemplo |
|---|---|
| Tipo | Gasto |
| Monto | S/15.00 |
| Descripción | Taxi |
| Categoría/subcategoría | Transporte > Taxi |
| Fecha y hora | 14 mayo, 8:45am |
| Fuente | WhatsApp |
| Cuenta | Yape |
| Caja | Libre |
| Confianza | Alta / Dudoso |
| Etiquetas | trabajo, recurrente |
| Estado | Confirmado, pendiente, corregido, eliminado |
| Acciones | Editar, eliminar, corregir, explicar |

### 7.3 Detalle de movimiento

El detalle debe responder:

- ¿De dónde salió?
- ¿Por qué se clasificó así?
- ¿Qué cambió si lo corrijo?
- ¿Afecta saldo, caja o deuda?
- ¿Fue confirmado por el usuario?
- ¿Hay historial de cambios?

El detalle debe mostrar:

- fuente,
- evidencia,
- confidence,
- estado de clasificación,
- audit trail,
- cambios anteriores,
- vínculo con email/recurrente/deuda/caja si existe.

---

## 8. Pendientes

Pendientes es una pantalla crítica para email parsing y confianza.

Tambien funciona como Centro de Confirmaciones cuando WhatsApp no debe insistir con nuevos templates. Si el usuario no responde por WhatsApp, los pendientes siguen vivos, visibles y accionables en Dashboard/app.

### 8.1 Tipos de pendientes

| Tipo | Ejemplo |
|---|---|
| Email detectado | Yape S/45 en restaurante. |
| Movimiento dudoso | "Le pasé 50 a Luis" sin saber si es préstamo o regalo. |
| Recurrente sugerido | Netflix detectado 3 meses seguidos. |
| Batch de emails | 4 movimientos detectados hoy. |
| Acción de riesgo | Borrar 5 movimientos. |

### 8.2 Acciones

- Confirmar.
- Rechazar.
- Editar antes de confirmar.
- Marcar como ya registrado.
- Revisar uno por uno.
- Confirmar lote si el riesgo lo permite.
- Abrir lote compartido desde link de WhatsApp.
- Volver a WhatsApp con contexto si el usuario prefiere conversar.

Reglas:

- Pendiente no afecta saldo.
- Batch grande requiere confirmación clara.
- "Confirmar todos" solo aplica al lote visible o a ids seleccionados.
- Confirmar recurrente no debe crear pagos futuros sin explicación.
- Email siempre requiere aprobación.
- Si hay modo discreto, ocultar montos en notificaciones pero mostrar en Dashboard autenticado.

---

## 9. Mi Dinero

Mi Dinero responde:

```text
¿Cuánto puedo usar realmente?
```

### 9.1 Componentes

| Componente | Qué muestra |
|---|---|
| Dinero total | Suma por cuentas. |
| Libre en cuentas | Total en cuentas menos cajas separadas. |
| Dinero libre operativo | Libre en cuentas menos cuotas/deudas/pagos que vienen no cubiertos por cajas. |
| Cuentas | Dónde está el dinero. |
| Cajas | Para qué está separado. |
| Compromisos | Deudas, cuotas y pagos que vienen. |
| Próximos pagos | Lo que viene y cuándo. |
| Progreso de deudas | Debes, te deben, pagado, falta. |

### 9.2 Reglas

- Si no usa cajas, no forzar cajas.
- Si crea caja, mostrar dinero comprometido vs libre.
- Si tiene deudas, mostrar progreso y próximos pagos.
- Si tiene pagos que vienen, mostrar calendario o lista próxima.
- Si faltan datos, explicar la limitación.

### 9.3 Pantalla Deudas

Deudas es una pantalla independiente para el seguimiento completo de obligaciones financieras.

Referencia detallada: `05h_deudas.md`.

#### 9.3.1 Propósito

Permitir al usuario:

- hacer seguimiento de todas sus deudas activas,
- visualizar progreso de pago,
- gestionar pagos individuales y parciales,
- entender sus obligaciones (qué debe, qué le deben).

Referencia detallada: `05h_deudas.md`.

#### 9.3.2 Componentes

| Componente | Qué muestra |
|---|---|
| Resumen | Total que debo, total que me deben, saldo neto. |
| Lista de deudas activas | Cada deuda con barra de progreso visual. |
| Próximos pagos de deudas | Cuotas o pagos que vienen, ordenados por fecha. |
| Personas relacionadas | Entidades ligeras vinculadas a deudas personales. |

#### 9.3.3 Cada deuda muestra

| Campo | Ejemplo |
|---|---|
| Tipo | Informal, bancaria, tarjeta, cuota fija, préstamo recibido, préstamo dado. |
| Persona/entidad | Luis, BCP, mamá. |
| Monto total | S/2,400 |
| Monto pagado | S/1,200 |
| Monto pendiente | S/1,200 |
| Próximo pago | S/400 · 26 mayo |
| Progreso visual | Barra de progreso con porcentaje. |
| Estado | Borrador, activa, por vencer, vencida, pagada, cancelada, archivada. |

#### 9.3.4 Acciones

- Registrar pago (total o parcial).
- Ver historial de pagos de esa deuda.
- Renegociar (cambiar condiciones: cuotas, monto, fecha).
- Cerrar deuda (marcar como saldada).
- Marcar cobro recibido (si alguien me debe).

#### 9.3.5 Reglas

- Las deudas no requieren que el usuario tenga tracking completo de gastos. Una deuda puede existir de forma standalone.
- Las deudas pueden crearse desde WhatsApp o desde Dashboard.
- Las personas relacionadas son entidades ligeras (nombre + alias + relación). No se guardan datos de contacto.
- Si una deuda tiene recurrente vinculado, pagar el recurrente actualiza la deuda automáticamente.
- Deudas cerradas se archivan pero no se eliminan.
- `pago_deuda` no debe mostrarse como gasto genérico; debe verse como pago vinculado a obligación.
- Si el pago no tiene cuenta, puede actualizar deuda pero no saldos por cuenta.

### 9.4 Pantalla Compromisos / Pagos que vienen

`Recurrentes` es el nombre tecnico. En UI, la experiencia debe llamarse **Compromisos** cuando agrupa deudas, cuotas y pagos esperados, o **Pagos que vienen** cuando se enfoca solo en pagos periodicos.

Referencia detallada: `05i_recurrentes.md`.

#### 9.4.1 Propósito

Permitir al usuario:

- ver todos sus pagos que vienen en un solo lugar,
- conocer el estado de cada uno (pagado, pendiente, vencido),
- anticipar fechas de pago próximas,
- confirmar o ignorar pagos detectados automáticamente.

#### 9.4.2 Componentes

| Componente | Qué muestra |
|---|---|
| Pagos que vienen activos | Todos los pagos esperados confirmados con estado actual. |
| Próximos pagos | Timeline o lista de pagos que vienen, ordenados cronológicamente. |
| Sugeridos | Pagos detectados por patrones pero no confirmados por el usuario. |
| Resumen mensual | Total estimado de pagos esperados para el mes. |

#### 9.4.3 Cada pago que viene muestra

| Campo | Ejemplo |
|---|---|
| Nombre | Internet, Netflix, Cuota laptop. |
| Monto | S/89 (fijo) o ~S/25 (estimado). |
| Fecha próxima | 12 junio, entre 12-15 del mes. |
| Estado | Activo, pausado, sugerido, vencido. |
| Fuente | WhatsApp, email, detección automática. |
| Vínculo | Caja compromiso o deuda asociada. |

#### 9.4.4 Acciones

- Confirmar sugerido (activar un pago que viene detectado).
- Marcar como pagado (registrar pago del periodo actual).
- Pausar (desactivar temporalmente sin borrar).
- Editar monto/fecha (ajustar condiciones).
- Desactivar ("ya no pago esto" — se desactiva sin borrar historial).
- Vincular a caja (asociar a una caja compromiso para afectar dinero libre).

#### 9.4.5 Reglas

- Detectar un pago que vuelve no lo activa automáticamente. El usuario debe confirmar.
- Los sugeridos aparecen en una sección separada con contexto ("Detectado 3 meses seguidos").
- Si el monto cambia, mostrar el cambio explícitamente (ej: "S/18 → S/22").
- Un pago que viene puede estar vinculado a una deuda (ej: cuota mensual de préstamo).
- Pagar un compromiso vinculado a deuda actualiza ambos registros.
- El resumen mensual debe sumar solo pagos activos confirmados.
- No usar "Recurrentes" como label principal visible si "Pagos que vienen" o "Compromisos" comunica mejor.

---

## 10. Descubrimientos

Descubrimientos no es reporting avanzado. Es claridad accionable.

El detalle completo de taxonomía, umbrales, scoring, evidencia y entrega vive en `05g_insights.md`.

En UI, evitar que la experiencia se sienta como una pantalla técnica de "Insights". El label visible principal es "Descubrimientos". Frases como "Lo que Manzana notó" o "Tu semana en claro" pueden usarse como copy secundario, aunque internamente el módulo siga llamándose Insights.

### 10.1 Tipos

- Aprendizaje temprano.
- Qué cambió.
- Categoría principal.
- Patrón temporal.
- Gasto atípico.
- Cambio de recurrente.
- Proyección simple.
- Liquidez / dinero libre.
- Recurrente sugerido.
- Deuda.
- Progreso / refuerzo positivo.
- Caja/ahorro.
- Calidad de datos.

### 10.2 Reglas

- No mostrar insight sin datos suficientes.
- Explicar fuente.
- Evitar juicio.
- Mostrar acción sugerida cuando tenga sentido.
- Permitir ignorar o no volver a mostrar un insight.
- No contar emails sin confirmar como gasto real.
- No contar transferencias ni asignaciones internas como gasto.
- Home muestra 1 descubrimiento destacado y lista de recientes si aplica.
- Si un insight ya mostrado cambia por correcciones, Dashboard debe mostrar la versión actualizada o una nota de actualización.
- El primer descubrimiento útil puede aparecer al llegar a 5 movimientos confirmados, sin afirmar patrones fuertes todavía.

Ejemplo:

```text
Delivery subió 38% esta semana. Fueron 4 pedidos más que la anterior.
¿Quieres que lo vigilemos esta semana?
```

---

## 11. Configuración

Configuración debe ser simple y progresiva.

Incluye:

- conectar/desconectar email,
- preferencias de recordatorios,
- horario silencioso,
- tono de respuesta,
- cuentas,
- cajas,
- privacidad,
- datos/memoria que Manzana aprendió,
- exportar o eliminar datos si aplica.

Regla:

> Las preferencias sensibles deben ser explícitas, editables y reversibles.

> Modo discreto aplica a WhatsApp (notificaciones sin montos). En Dashboard V1, todos los datos se muestran normalmente al estar autenticado.

---

## 12. Estados progresivos

### 12.1 Estado vacío

No debe verse triste ni roto.

Muestra:

- guía para registrar por WhatsApp,
- ejemplo de primer mensaje,
- opción de conectar email,
- explicación breve de dinero libre,
- acceso a crear primera cuenta/caja si quiere.

No muestra:

- gráficos vacíos,
- insights falsos,
- métricas inventadas,
- secciones no usadas.

### 12.2 Estado temprano: 1-10 movimientos

Muestra:

- últimos movimientos,
- total simple del periodo,
- fuente de datos,
- mensaje "estoy aprendiendo tus patrones",
- corrección fácil.

No muestra:

- comparativas profundas,
- proyecciones,
- patrones débiles como si fueran certeza.

### 12.3 Estado funcional: 11-50 movimientos

Muestra:

- categorías principales,
- filtros,
- primer insight real,
- dinero libre si hay cuentas/cajas suficientes,
- pendientes.

### 12.4 Estado completo: 50+ movimientos

Muestra:

- qué cambió,
- tendencias,
- patrones,
- pagos que vienen,
- próximos pagos,
- deudas,
- dinero libre,
- acciones sugeridas.

### 12.5 Estados de error y degradación

El Dashboard debe manejar errores sin dejar al usuario sin contexto.

| Escenario | Comportamiento |
|---|---|
| Error de conexión | Mostrar últimos datos conocidos con timestamp ("Datos de hace 2 horas"). Explicar que está offline y que se actualizará al reconectar. |
| Motor IA no disponible | Degradar la función "¿por qué?" a mostrar metadata cruda (fuente, regla aplicada, confianza) en lugar de explicación narrativa. |
| Datos inconsistentes | Mostrar pill de advertencia en el dato afectado. Sugerir corrección con acción directa ("Este monto parece incorrecto. ¿Quieres corregirlo?"). |
| Sin datos nuevos | No mostrar "no hay novedades" como si algo estuviera mal. Simplemente no mostrar la sección de cambios. El Dashboard se adapta al silencio. |
| Timeout de consulta | Mostrar mensaje breve con opción de reintentar. No bloquear la pantalla completa. |

Regla general:

> Nunca mostrar un estado de error vacío sin guía. Si algo falla, explicar qué pasó, qué puede hacer el usuario, y qué datos siguen siendo válidos.

---

## 13. Uso parcial y adaptativo

El Dashboard se adapta al uso real.

| Uso del usuario | Priorizar | Ocultar o minimizar |
|---|---|---|
| Solo registro de gastos | Movimientos, categorías, patrones simples | Deudas/cajas si no existen. |
| Solo deudas | Deudas, próximos pagos, personas, progreso | Categorías de gasto. |
| Solo pagos que vienen | Próximos pagos, calendario, confirmaciones | Análisis de categorías. |
| Gastos + cajas | Dinero libre, cajas, movimientos | Deudas si no existen. |
| Email conectado | Pendientes, fuente, dedup, confirmaciones | Bloques vacíos. |
| Usuario avanzado | Qué cambió, insights, memoria consultable | Onboarding básico. |

Esto se alimenta del `ExperienceIntelligenceEngine` y del `Disclosure Engine`.

---

## 14. Confianza, fuente y explicación

El Dashboard debe hacer visible el control.

Cada dato importante debe poder responder:

- ¿De dónde salió?
- ¿Cuándo se registró?
- ¿Fue confirmado?
- ¿Qué confianza tiene?
- ¿Quién o qué lo corrigió?
- ¿Cómo afecta mi dinero libre?
- ¿Por qué Manzana dice esto?

### 14.1 Indicadores

| Indicador | Uso |
|---|---|
| Fuente | WhatsApp, Email confirmado, Dashboard/manual, recurrente. |
| Confianza | Alta, media, dudosa. |
| Estado | Confirmado, pendiente, corregido, eliminado. |
| Explicación | "¿Por qué?" con evidencia y reglas. |
| Audit trail | Historial de cambios. |

### 14.2 Regla de confianza

> Si el usuario no puede corregir o entender un dato, el Dashboard falla.

---

## 15. IA dentro del Dashboard

El Dashboard puede usar IA, pero no para todo.

Usa Motor IA para:

- preguntas naturales,
- búsqueda semántica,
- explicación de movimientos,
- explicar dinero libre,
- resumir cambios,
- narrar insights,
- ayudar a corregir en lenguaje natural.

No usa IA para:

- registros y ediciones manuales estructuradas,
- cálculos de saldo,
- afectación de cajas,
- actualizar deudas,
- confirmar email sin usuario.

Las consultas naturales deben usar memoria consultable mediante `ToolGateway`, no acceso libre a base de datos.

### 15.1 Búsqueda natural en Dashboard

El Dashboard incluye una barra de búsqueda natural como capa de IA accesible globalmente.

#### Ubicación

Barra de búsqueda en el topbar, visible en todas las pantallas.

#### Cómo funciona

1. El usuario escribe una pregunta o consulta en lenguaje natural.
2. El Motor IA interpreta la intención.
3. El sistema devuelve resultados inline o navega a la vista filtrada correspondiente.

#### Tipos de consultas soportadas

| Consulta de ejemplo | Tipo |
|---|---|
| "gastos de esta semana en transporte" | Filtro por periodo + categoría. |
| "¿cuánto le debo a Luis?" | Consulta de deuda por persona. |
| "movimientos de email sin confirmar" | Filtro por fuente + estado. |
| "¿cuánto gasté en delivery el mes pasado?" | Resumen por categoría + periodo anterior. |
| "últimos 5 gastos" | Lista reciente con límite. |
| "¿cuánto tengo libre?" | Consulta de dinero disponible. |

#### UX

- Placeholder: "Pregunta algo sobre tu dinero..."
- Mostrar indicador de carga mientras el Motor IA procesa.
- Resultados se muestran inline debajo de la barra o navegan a vista filtrada según el tipo de consulta.
- Si la consulta produce un dato simple (monto, conteo), mostrarlo directamente.
- Si la consulta implica una lista, navegar a Movimientos con filtros aplicados.

#### Fallback

Si el Motor IA no puede interpretar la consulta, degradar a búsqueda textual en movimientos (descripción, categoría, persona, etiqueta).

#### Reglas

- Solo consultas de lectura. No se permiten comandos que modifiquen datos desde la barra de búsqueda (no crear, no editar, no eliminar).
- Los resultados deben mostrar fuente y contexto.
- La búsqueda pasa por `ToolGateway` para acceder a datos, no por acceso directo a base de datos.
- Si no hay resultados, explicar por qué ("No encontré gastos en transporte esta semana").

---

## 16. Acciones permitidas desde Dashboard

| Acción | Ruta |
|---|---|
| Crear movimiento manual | Core directo con validadores, audit log, dedup y outbox. |
| Editar movimiento | Core directo con audit log. |
| Eliminar movimiento | Core directo con soft delete + audit log. |
| Confirmar pendiente | Core confirma pendiente. |
| Rechazar pendiente | Pending Inbox descarta. |
| Crear caja | Core crea caja. |
| Editar caja | Core actualiza caja. |
| Revisar deuda | Debt Engine/Core. |
| Marcar recurrente | Recurring Engine + confirmación. |
| Configurar recordatorio | Preferencias + Nudge Policy. |
| Preguntar "por qué" | Motor IA + ExplanationEngine. |

Toda acción sensible debe pasar por `PolicyGate`.

### 16.1 Crear movimiento manual

Flujo:

```text
Usuario abre "Nuevo movimiento"
  -> Dashboard muestra formulario estructurado
  -> Usuario completa datos necesarios
  -> Validadores revisan monto, fecha, tipo, cuenta, categoría y duplicados
  -> PolicyGate evalúa riesgo
  -> Core ejecuta CreateMovementCommand
  -> audit_log + transactional_outbox
  -> Dashboard actualiza historial, saldos y estado visual
```

El formulario manual no debe depender de IA. Si el usuario escribe una nota o descripción, el sistema puede sugerir categoría, etiqueta o cuenta, pero guardar requiere que el usuario vea el resultado.

No se permite crear movimientos desde la barra de búsqueda natural. La búsqueda es read-only.

---

## 17. Arquitectura UX

### 17.1 Navegación V1

El Dashboard debe ser mobile-first porque Manzana nace desde WhatsApp, pero debe funcionar bien en desktop para revisión.

Navegación mobile:

- barra inferior fija,
- accesos principales visibles + menú "Más" para pantallas secundarias,
- Configuración dentro de menú/perfil.

```text
Home | Movimientos | Pendientes | Mi Dinero | Más (Deudas, Pagos que vienen, Descubrimientos, Config)
```

Si se prefiere, mostrar las 5 pantallas más importantes en la barra inferior y ubicar el resto en sidebar o menú lateral.

Navegación desktop:

- sidebar lateral,
- Home como entrada,
- acceso persistente a Pendientes si hay elementos por revisar,
- Deudas y Pagos que vienen como secciones propias,
- Configuración visible al final.

```text
Home
Movimientos
Pendientes
Mi Dinero
Deudas
Pagos que vienen
Descubrimientos
Configuración
```

Reglas:

- Pendientes debe mostrar badge si hay elementos por revisar.
- La navegación no debe mostrar pantallas vacías como si fueran features activas.
- Deudas y Pagos que vienen son pantallas independientes con acceso directo.
- El usuario debe poder volver a Home desde cualquier pantalla.

### 17.2 Jerarquía visual

El primer pantallazo debe priorizar:

1. Dinero libre.
2. Pendientes relevantes.
3. Qué cambió.
4. Próximo compromiso.
5. Movimientos recientes.
6. Acción sugerida.

No priorizar:

- gráficos decorativos,
- métricas secundarias,
- tablas densas,
- onboarding largo,
- configuración.

### 17.3 Densidad

El Dashboard debe sentirse operativo y claro, no editorial.

Lineamientos:

- títulos compactos,
- cards solo para unidades de información,
- no cards dentro de cards,
- tablas/listas escaneables,
- acciones visibles pero no invasivas,
- colores usados para estado, no decoración.

---

## 18. Wireframes textuales V1

### 18.1 Home

```text
┌─────────────────────────────────────┐
│ Home                                │
│ Dinero libre: S/220                 │
│ Total: S/800 · Comprometido: S/580  │
├─────────────────────────────────────┤
│ Pendientes                          │
│ 3 movimientos por confirmar         │
│ [Revisar]                           │
├─────────────────────────────────────┤
│ Qué cambió                          │
│ Transporte subió S/75 esta semana   │
│ Principal: Uber de trabajo          │
│ [Ver explicación]                   │
├─────────────────────────────────────┤
│ Próximo compromiso                  │
│ Cuota laptop · S/180 · martes       │
├─────────────────────────────────────┤
│ Movimientos recientes               │
│ Café S/8 · WhatsApp · Alta          │
│ Taxi S/15 · WhatsApp · Alta         │
└─────────────────────────────────────┘
```

### 18.2 Movimientos

```text
┌─────────────────────────────────────┐
│ Movimientos                         │
│ [Nuevo movimiento]                  │
│ [Buscar] [Periodo] [Tipo] [Fuente]  │
├─────────────────────────────────────┤
│ Taxi · S/15                         │
│ Transporte · WhatsApp · Alta        │
│ [Editar] [¿Por qué?]                │
├─────────────────────────────────────┤
│ Restaurante · S/45                  │
│ Pendiente email · No afecta saldo   │
│ [Confirmar] [Rechazar]              │
└─────────────────────────────────────┘
```

### 18.2.1 Nuevo movimiento

```text
┌─────────────────────────────────────┐
│ Nuevo movimiento                    │
├─────────────────────────────────────┤
│ Tipo                                │
│ [Gasto v]                           │
│ Monto                               │
│ [S/ 0.00]                           │
│ Fecha                               │
│ [Hoy]                               │
│ Cuenta / caja                       │
│ [Yape v]                            │
│ Categoría                           │
│ [Alimentación v]                    │
│ Descripción                         │
│ [Café antes de oficina]             │
│ Etiquetas                           │
│ [trabajo] [gusto]                   │
├─────────────────────────────────────┤
│ Impacto: sale de Yape y afecta      │
│ dinero libre de hoy.                │
│ [Guardar] [Guardar y otro] [Cancelar]│
└─────────────────────────────────────┘
```

El contenido cambia según el tipo. Por ejemplo, `transferencia` muestra origen/destino; `prestamo_dado` pide persona relacionada; `pago_deuda` pide deuda vinculada.

### 18.3 Pendientes

```text
┌─────────────────────────────────────┐
│ Pendientes                          │
│ Email · Yape S/45 · Restaurante     │
│ [Confirmar] [Editar] [Ya registrado]│
├─────────────────────────────────────┤
│ Duda · "Le pasé 50 a Luis"          │
│ ¿Préstamo o regalo?                 │
│ [Préstamo] [Regalo]                 │
├─────────────────────────────────────┤
│ Recurrente sugerido                 │
│ Netflix detectado 3 meses           │
│ [Marcar recurrente] [Ignorar]       │
└─────────────────────────────────────┘
```

### 18.4 Mi Dinero

```text
┌─────────────────────────────────────┐
│ Mi Dinero                           │
│ Total S/800                         │
│ - Cajas S/300                       │
│ - Compromisos S/280                 │
│ = Libre S/220                       │
├─────────────────────────────────────┤
│ Cuentas                             │
│ Yape S/260 · BCP S/520 · Efectivo 20│
├─────────────────────────────────────┤
│ Cajas                               │
│ Emergencia S/100                    │
│ Alquiler S/300                      │
├─────────────────────────────────────┤
│ Compromisos                         │
│ Laptop S/180 · Internet S/90        │
└─────────────────────────────────────┘
```

### 18.5 Descubrimientos

```text
┌─────────────────────────────────────┐
│ Descubrimientos                     │
│ Qué cambió                          │
│ Transporte +S/75                    │
│ [Explicar] [Vigilar]                │
├─────────────────────────────────────┤
│ Patrón                              │
│ Gastas más los viernes por la noche │
│ [Ver movimientos] [Ignorar]         │
└─────────────────────────────────────┘
```

### 18.6 Deudas

```text
┌─────────────────────────────────────┐
│ Deudas                              │
│ Debo: S/2,550 · Me deben: S/200     │
├─────────────────────────────────────┤
│ Laptop en cuotas                    │
│ S/1,200 pagado / S/2,400 total      │
│ ████████░░░░ 50%                    │
│ Próxima cuota: S/400 · 26 mayo      │
│ [Registrar pago] [Ver detalle]      │
├─────────────────────────────────────┤
│ Luis · Deuda informal               │
│ S/0 pagado / S/150 total            │
│ ░░░░░░░░░░░░ 0%                     │
│ Sin fecha definida                  │
│ [Pagar] [Ver detalle]               │
├─────────────────────────────────────┤
│ Tu hermano te debe S/200            │
│ Hace 2 semanas                      │
│ [Marcar cobrado]                    │
└─────────────────────────────────────┘
```

### 18.7 Pagos que vienen

```text
┌─────────────────────────────────────┐
│ Pagos que vienen                    │
│ 4 activos · S/584/mes estimado      │
├─────────────────────────────────────┤
│ Internet · S/89 · entre 12-15       │
│ Activo · Próximo: 12 junio          │
│ [Marcar pagado] [Editar]            │
├─────────────────────────────────────┤
│ Cuota laptop · S/400 · día 26       │
│ Activo · Vinculado a deuda          │
│ [Marcar pagado] [Ver deuda]         │
├─────────────────────────────────────┤
│ Netflix · ~S/25 · ~día 15           │
│ ⚡ Sugerido · Detectado 3 meses     │
│ [Confirmar] [Ignorar]               │
├─────────────────────────────────────┤
│ Spotify · S/18 → S/22               │
│ Activo · Cambio de monto detectado  │
│ [Actualizar] [Ver historial]        │
└─────────────────────────────────────┘
```

### 18.8 Detalle de movimiento

```text
┌─────────────────────────────────────┐
│ Taxi                    S/15.00     │
├─────────────────────────────────────┤
│ Tipo: Gasto                         │
│ Categoría: Transporte > Taxi        │
│ Fecha: 14 mayo, 8:45am             │
│ Fuente: WhatsApp                    │
│ Cuenta: Yape                        │
│ Caja: Libre                         │
│ Confianza: Alta                     │
│ Estado: Confirmado                  │
│ Etiquetas: trabajo                  │
├─────────────────────────────────────┤
│ ¿Por qué se clasificó así?          │
│ Texto original: "gasté 15 en taxi   │
│ al trabajo"                         │
│ Regla: keyword taxi + monto claro   │
│ Aprendizaje: taxi de trabajo        │
│ confirmado 4 veces.                 │
├─────────────────────────────────────┤
│ [Editar] [Eliminar] [Corregir]      │
└─────────────────────────────────────┘
```

---

## 19. Prototipo navegable

Se debe mantener un prototipo estatico para validar estructura antes de implementacion. La identidad visual, tokens, paleta, componentes, estados y handoff final viven en Fase 6 visual V1.

Ruta profesional vigente:

```text
docs/fase_6_visual/28_identidad_visual_marca.md
docs/fase_6_visual/29_design_system_ui.md
docs/fase_6_visual/30_app_flow.md
docs/fase_6_visual/31_wireflows.md
docs/fase_6_visual/32_especificacion_hifi.md
docs/fase_6_visual/33_stitch_handoff_v1.md
```

Estado visual actual:

```text
Fase 6 documental V1 activa.
Prototipo generado sujeto a aprobacion contra Fase 6.
```

Referencias:

```text
dashboard-v2 eliminado como carpeta local
```

```text
prototypes/manzana-v3/ (descartado/no usar)
```

`dashboard-v2` queda solo como antecedente historico de flujo y contenido. `manzana-v3` fue un intento local descartado y no debe usarse como referencia visual final. Cualquier candidato visual previo queda como antecedente no oficial y no cambia alcance V1, email parsing, arquitectura ni reglas financieras.

Objetivo del prototipo:

- validar si Home se entiende en 10 segundos,
- validar navegación mobile-first,
- probar Pendientes,
- revisar Movimientos sin que parezca Excel,
- explicar dinero libre,
- probar "¿por qué?",
- validar que los insights son accionables.

El prototipo por si solo valida jerarquia, estructura, copy, estados y acciones. Fase 6 define marca visual, design system, experiencia pantalla/bloque/boton y proceso de handoff visual.

---

## 20. Fuera de alcance V1

No incluir en Dashboard V1:

- reporting financiero avanzado,
- exportaciones complejas,
- contabilidad,
- impuestos,
- inversiones,
- comparador de bancos,
- shareables,
- gráficos decorativos sin decisión,
- multiusuario,
- gestión empresarial,
- presupuestos/metas avanzadas sin documento propio.

---

## 21. Métricas de éxito

| Métrica | Target inicial |
|---|---|
| Visitas semanales por usuario activo | `>= 1` |
| Correcciones realizadas sin abandonar | Alta retención post-corrección |
| Pendientes confirmados desde Dashboard | Medir tasa y tiempo |
| Usuarios que entienden dinero libre | Feedback o acción posterior |
| Uso de filtros/historial | Medir recurrencia |
| Clicks en "¿por qué?" resueltos | Alta resolución sin soporte |
| Acciones sugeridas aceptadas/rechazadas | Medir por tipo |
| Usuarios con caja creada | `>= 30%` al D30 si aplica |
| Dashboard vacío convertido a primer registro | Medir conversión |

---

## 22. Resumen final

El Dashboard V1 de Manzana debe ser una capa de claridad, control y confianza.

Su trabajo no es capturar más rápido que WhatsApp. Su trabajo es ayudar al usuario a entender qué pasó, qué cambió, qué falta confirmar, cuánto puede gastar realmente y cómo corregir cualquier dato.

La estrategia correcta:

- Home útil en 10 segundos.
- Movimientos como capa de confianza.
- Pendientes como centro de confirmación.
- Mi Dinero como dinero libre real.
- Deudas como pantalla de seguimiento.
- Pagos que vienen como pantalla de compromisos.
- Descubrimientos accionables, no reportes.
- Búsqueda natural como capa de IA.
- Configuración progresiva.
- Experiencia adaptada al uso real.

*Feature 3/10 del Paso 5 — Dashboard Inteligente V2.1.*
