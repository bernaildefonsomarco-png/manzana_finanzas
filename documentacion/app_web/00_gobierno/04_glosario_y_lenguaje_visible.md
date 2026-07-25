# 04 — Glosario y lenguaje visible

**Bloque:** 00 — Gobierno
**Estado:** V1 (migración con mejoras)
**Fecha:** 25 de julio de 2026
**Depende de:** `02_mapa_herencia_corpus_legacy.md`
**Fuente principal:** `docs/fase_3_producto/12_lenguaje_producto.md` (V1.1, 24 de mayo de 2026) — se conserva casi íntegro; se añade el vocabulario nuevo de los módulos que no existían en V1.0 (§8 de este documento)

---

## 1. Tesis

El lenguaje de Manzana convierte complejidad financiera en palabras que el
usuario ya usa o entiende. El sistema puede tener nombres técnicos como
`Insight`, `RecurringRule` o `PendingItem`, pero el usuario nunca debe sentir
que está usando un panel interno.

> Si una palabra es correcta técnicamente pero enfría la experiencia, se
> queda en código y se traduce en producto.

Este principio no cambia con la separación web/WhatsApp. Cambia el canal
donde se aplica: hoy todo el lenguaje se diseñaba pensando en conversación
por WhatsApp primero; este documento lo trata como agnóstico de canal, con
una columna específica para "Dashboard/app" en vez de asumir que WhatsApp es
el formato por defecto.

## 2. Principios de lenguaje

| # | Principio | Regla |
|---|---|---|
| 1 | Humano antes que técnico | Usar la palabra que el usuario entiende, no la que usa el backend. |
| 2 | Claridad antes que poesía | No sacrificar comprensión por sonar bonito. |
| 3 | Cero culpa | Evitar palabras que sugieran fallo personal. |
| 4 | Preciso sin ser contable | Explicar dinero con exactitud, sin lenguaje de contador. |
| 5 | Consistente por canal | Un concepto se siente igual en la app y en WhatsApp (fase 2), aunque el formato cambie. |
| 6 | Progresivo | No introducir términos hasta que el usuario los necesite. |
| 7 | Discreto en sensibilidad | Deuda, salud, personas, bancos y saldos requieren lenguaje cuidadoso. |
| 8 | Accionable | Si se muestra información, debe quedar claro qué puede hacer el usuario. |
| 9 | Con procedencia | Toda cifra que el sistema muestra puede explicar de dónde sale (ver `08_principios_experiencia_web.md`). |

## 3. Diccionario interno vs. visible (V1.0, heredado)

| Interno / técnico | Visible principal | Alternativas | Notas |
|---|---|---|---|
| `Insights` | Descubrimientos | Lo que Manzana notó, Algo que cambió, Tu semana en claro | Evitar "Insights" como label principal. |
| `Nudges` | Recordatorios | Avisos, Te aviso si... | En configuración usar "Recordatorios". |
| `Recurrentes` | Pagos que vienen | Pagos que se repiten, Lo que viene | Parte de Compromisos cuando se ve junto a deudas/cuotas. |
| `Pending Inbox` | Pendientes | Por revisar | Debe sentirse como control, no bandeja técnica. |
| `Movements` | Movimientos | Gastos, ingresos, pagos, transferencias | En copy usar el tipo concreto. |
| `Account` | Cuenta | Yape, BCP, efectivo | "Cuenta" está bien si es clara. |
| `Box` | Caja | Separado para..., Reserva, Apartado | Funciona si se explica visualmente. |
| `Free money` | Libre en cuentas | Dinero sin separar, saldo libre | Uso de detalle, no número principal. |
| `Operational free money` | Dinero libre | Libre para usar, Te queda libre | Número principal visible. Nunca "operativo" frente al usuario. |
| `Debt` | Deuda / compromiso | Lo que debes, Te deben | "Deuda" es correcto, pero sensible. |
| `Related person` | Persona | Luis, Ana, tu hermano | No mostrar como entidad técnica. |
| `Recurring occurrence` | Pago esperado | Pago de este mes, cuota de este mes | No usar "ocurrencia". |
| `NudgePolicy` | Preferencias de recordatorios | Reglas de avisos | No mostrar como policy. |
| `Confidence` | Seguridad / por confirmar | Parece, confirmado, falta revisar | No mostrar porcentaje salvo modo avanzado (contradicción `C-11` a corregir). |
| `Audit log` | Historial de cambios | Cambios recientes | Técnico. |
| `Outbox/Event Bus` | No visible | No visible | Nunca mostrar al usuario. |

## 4. Nombres de navegación V1-web

La navegación heredada de `12_lenguaje_producto.md` §5 se amplía con los
módulos nuevos (WEB-D002). Los nombres exactos de ruta y jerarquía completa
viven en `10_sitemap_rutas_y_navegacion.md`; este documento fija solo el
**label visible**.

```text
Home | Movimientos | Pendientes | Mi Dinero | Presupuestos | Deudas |
Pagos que vienen | Descubrimientos | Reportes | Asistente | Configuración
```

Regla heredada, sigue vigente:

> No usar "Insights", "Recurrentes" ni "Nudges" como labels visibles
> principales.

Regla nueva:

> No usar "IA", "Chat", "Bot" ni "Asistente virtual" como label del
> asistente conversacional en la app — usar **Asistente** a secas. Ver §8.6.

## 5. Conceptos principales (heredado, sin cambios de fondo)

### 5.1 Dinero libre

```text
Dinero total
  - Cajas / dinero separado
  = Libre en cuentas
  - Compromisos próximos no cubiertos
  = Dinero libre
```

Copy recomendado:

```text
Tienes S/220 libres.
```

Con explicación:

```text
Total: S/800
- Cajas: S/300
= Libre en cuentas: S/500
- Compromisos próximos: S/280
= Dinero libre: S/220
```

Evitar: `Saldo operativo neto disponible`.

### 5.2 Cajas

Visible: `Dinero separado para algo`. Copy: `Caja Emergencia`, `Separado
para alquiler`. Evitar: `Bucket financiero`, `Subcuenta virtual`.

### 5.3 Compromisos

Término paraguas para obligaciones y pagos esperados que reducen la
disponibilidad real:

```text
Compromisos
  ├── Deudas
  ├── Cuotas
  └── Pagos que vienen
```

Las cajas no son compromisos — son dinero separado que puede cubrirlos.

### 5.4 Pendientes

```text
Pendientes = bandeja de revisión
Movimientos = historial confirmado/corregido
```

Un pendiente puede convertirse en movimiento cuando el usuario confirma.
Antes de eso no afecta saldo y no se mezcla visualmente con movimientos
confirmados.

### 5.5 Descubrimientos

Visible: `Cosas útiles que Manzana notó en tus datos`. Copy: `Manzana notó
algo`, `Algo cambió esta semana`. Evitar: `Insight accionable detectado`.

### 5.6 Pagos que vienen

Visible: `Pagos que suelen volver o que esperas pagar pronto`. Copy: `Tu
internet suele pagarse esta semana`. Evitar: `Recurrente mensual
detectado`.

### 5.7 Recordatorios

Visible: `Avisos que Manzana puede enviarte si tú lo permites`. Copy:
`¿Quieres que te avise?`. Evitar: `Activar nudge`.

## 6. Lenguaje por canal (heredado, adaptado)

| Concepto | En la app (canal principal V1-web) | Proactivo (correo, fase futura push) | Modo discreto |
|---|---|---|---|
| Descubrimiento | Sección "Descubrimientos" | "Hay un cambio que puede servirte ver." | "Hay algo por revisar." |
| Pago que viene | Sección "Pagos que vienen" | "Tienes un pago que viene esta semana." | "Tienes un compromiso próximo." |
| Recordatorio | Centro de recordatorios | "Te aviso porque lo activaste." | "Tienes un aviso pendiente." |
| Pendiente | Sección "Pendientes" | "Tienes pendientes por revisar." | "Tienes movimientos por revisar." |
| Dinero libre | Número principal en Home | Evitar proactivo salvo opt-in claro. | No mostrar monto. |
| Deuda/cuota | Sección "Deudas" | "Tienes una cuota próxima." | "Tienes un compromiso financiero próximo." |

Nota de migración: la columna "WhatsApp" de `12_lenguaje_producto.md` §7.1
se congela para `documentacion/whatsapp/`; se reemplaza aquí por "En la app"
como canal principal de V1-web, y "Proactivo" pasa a referirse a
notificaciones por correo (`46_notificaciones_y_correo_saliente.md`), no a
mensajes de WhatsApp.

### 6.1 Modo discreto

Usar lenguaje genérico: `Tienes un movimiento por revisar`, `Tienes un
compromiso financiero próximo`. No mostrar montos, bancos, personas,
comercios, categorías sensibles, saldos ni deudas específicas.

## 7. Acciones, estados, incertidumbre y sensibilidad (heredado sin cambios)

### 7.1 Acciones recomendadas

| Acción | Label visible |
|---|---|
| Confirmar pendiente | Confirmar |
| Rechazar pendiente | No era eso |
| Ver detalle | Ver |
| Corregir | Corregir |
| Borrar | Borrar |
| Deshacer | Deshacer |
| Marcar pago recurrente | Marcar pagado |
| Crear caja | Separar dinero |
| Vincular caja | Usar caja |
| Pausar recordatorio | Pausar recordatorio |
| Activar modo discreto | Activar modo discreto |
| Ver explicación | ¿Por qué? |

Evitar en botones: `Procesar`, `Ejecutar`, `Validar entidad`, `Resolver
evento`, `Commit`, `Aceptar predicción`, `Activar nudge`, `Generar insight`.

### 7.2 Estados visibles

| Estado técnico | Visible |
|---|---|
| `confirmed` | Confirmado |
| `pending_confirmation` | Por confirmar |
| `needs_review` | Por revisar |
| `suggested` | Sugerido |
| `active` | Activo |
| `paused` | Pausado |
| `cancelled` | Desactivado |
| `overdue` | Pendiente / vencido según contexto (ver regla en `12_lenguaje_producto.md` §9.1, se mantiene) |
| `outdated` | Actualizado |
| `dismissed` | Ignorado / descartado |

### 7.3 Lenguaje de incertidumbre

| Situación | Lenguaje recomendado |
|---|---|
| Alta confianza | "Parece..." |
| Baja confianza | "No estoy seguro..." |
| Dato faltante | "Me falta..." |
| Estimación | "Aprox." / "Con los datos que tengo..." |
| Pendiente | "Por revisar" |
| Email detectado | "Detecté..." pero nunca "lo registré sin confirmar". |

Evitar siempre: `Detectado automáticamente con 82% de confianza`.

### 7.4 Lenguaje sensible

Deudas: `Tienes una cuota próxima` / `Le debes S/150 a Luis`. Evitar: `Estás
endeudado` / `Deberías pagarle a Luis`.

Categorías sensibles (heredado de `12_lenguaje_producto.md` §11.2, tabla de
niveles): alta sensibilidad (apuestas, casino, préstamos, salud mental,
terapia, compras íntimas) → lenguaje genérico o solo visible en la app
autenticada, nunca en notificación proactiva.

## 8. Vocabulario nuevo — módulos que no existían en V1.0

Vocabulario incorporado por la ambición ampliada de la app web (decisión
`WEB-D002`). Sigue los mismos principios de §2.

### 8.1 Presupuestos, metas y límites

| Interno | Visible | Copy ejemplo | Evitar |
|---|---|---|---|
| `Budget` | Presupuesto | "Presupuesto de Comida: S/400 al mes" | "Budget", "Alocación" |
| `Goal` | Meta | "Meta: Viaje a Cusco, S/2,000" | "Objetivo financiero" (suena corporativo) |
| `Limit` (hard) | Límite | "Límite de Delivery: S/150" | "Tope", "Cap" |
| `Limit` (soft) | Aviso de límite | "Estás cerca de tu límite de Ocio" | "Alerta de presupuesto" |
| Excedido | Superado | "Superaste tu presupuesto de Transporte por S/30" | "Excediste", "Rojo" como único indicador |

Regla de tono (hereda el principio "cero culpa" §2.3): nunca `"Fallaste tu
presupuesto"`; sí `"Vas S/30 arriba de lo que planeaste en Transporte. ¿Quieres
ajustarlo o ver qué subió?"`.

### 8.2 Proyecciones y simulación

| Interno | Visible | Copy ejemplo | Evitar |
|---|---|---|---|
| `Projection` | Proyección | "A este ritmo, terminarías el mes con S/180 libres" | "Forecast", "Predicción" (implica certeza) |
| `Simulation scenario` | Simulación | "Si gastas S/50 más en Salidas, te quedarían S/130 libres" | "Escenario what-if" |
| `Affordability check` | "¿Puedo permitírmelo?" | "Con lo que tienes ahora, sí puedes — te quedarían S/70 libres" | "Análisis de asequibilidad" |
| `Financial health score` | Salud financiera | "Tu salud financiera este mes: Estable" | Un número desnudo sin explicación ("Score: 72") |

Regla: toda proyección declara su supuesto en el mismo mensaje (ver
principio de procedencia, `08_principios_experiencia_web.md`) — nunca una
cifra de proyección sin decir de qué datos sale.

### 8.3 Reportes, gráficos y exportación

| Interno | Visible | Copy ejemplo | Evitar |
|---|---|---|---|
| `Report` | Reporte | "Reporte de Julio" | "Informe" (más formal/frío) |
| `Export` | Descargar / Exportar | "Descargar movimientos (CSV)" | "Export data" |
| `Chart` | Gráfico | "Gráfico por categoría" | "Visualización de datos" |

### 8.4 Captura sin fricción e importación

| Interno | Visible | Copy ejemplo | Evitar |
|---|---|---|---|
| `Quick-add` | Registro rápido | "Registra en una línea: 'taxi 15'" | "Quick add", "Entrada rápida" |
| `Import batch` | Importación | "Importaste 42 movimientos de tu extracto" | "Batch upload" |
| `Import rollback` | Deshacer importación | "Deshacer esta importación completa" | "Rollback" |
| `Duplicate candidate` | Posible duplicado | "Esto se parece a un movimiento que ya tienes" | "Duplicate detected" |

### 8.5 Memoria y aprendizaje

| Interno | Visible | Copy ejemplo | Evitar |
|---|---|---|---|
| `Learned preference` | Lo que Manzana aprendió | "Manzana aprendió que 'Rappi' suele ser Comida" | "Preferencia inferida" |
| `Evidence` | Por qué lo dice | "Lo dice porque así clasificaste 8 de tus últimos 10 pedidos de Rappi" | "Evidence trace" |
| `Forget` | Olvidar | "Olvidar esto que aprendiste" | "Reset learning", "Borrar modelo" |
| `Positive/negative evidence` | Confirmaciones / correcciones | "Confirmado 8 veces, corregido 1 vez" | "Positive/negative signal" |

Regla dura (hereda `WEB-D013`): toda pantalla de memoria ofrece las cuatro
acciones — **ver, corregir, deshacer, olvidar** — nunca solo "ver".

### 8.6 Asistente IA en la app

| Interno | Visible | Copy ejemplo | Evitar |
|---|---|---|---|
| `Conversational assistant` | Asistente | "Pregúntale al Asistente" | "Chatbot", "IA", "Bot" |
| `Confirmation card` | Tarjeta de confirmación | "¿Confirmas registrar Taxi S/15?" | "Acción propuesta" |
| `Grounded response` | Respuesta con evidencia | Cifra + link a los movimientos que la sustentan | Cifra sin fuente visible |
| `Degraded mode` | "El Asistente no puede ayudarte con esto ahora" | — | Nunca inventar una cifra cuando el motor está degradado (ver `23_runtime_ia_modos_costo_y_degradacion.md`) |

### 8.7 Detección bancaria por email

| Interno | Visible | Copy ejemplo | Evitar |
|---|---|---|---|
| `Bank email detection` | Detección por correo | "Detecté un pago de Yape por correo" | "Email parsing", "Bank sync" |
| `Enrichment context` | Más contexto | "¿Quieres contarme algo más sobre este pago?" | "Enriquecer entidad" |

## 9. Estados vacíos (heredado, referencia)

Los 11 estados vacíos de `12_lenguaje_producto.md` §12 (Home, Movimientos,
Pendientes, Mi Dinero, Dinero libre, Cajas, Deudas, Pagos que vienen,
Descubrimientos, Recordatorios, Email) siguen vigentes tal cual. Se amplían
con los estados vacíos de los módulos nuevos en
`47_ciclo_de_vida_del_dato_y_estados_vacios.md`, que cubre Presupuestos,
Proyecciones, Reportes y el Asistente sin historial.

## 10. Palabras a evitar o limitar (heredado + ampliado)

Evitar frente al usuario: `insight`, `nudge`, `recurrente` como label
principal, `pipeline`, `orchestrator`, `policy`, `confidence score`,
`outbox`, `event bus`, `runtime`, `schema`, `determinístico`,
`clasificación semántica`, `modelo`, y ahora también: `chatbot`, `bot`,
`prompt`, `token`, `LLM`, `alucinación`, `focus set`, `grounding`,
`evidence_ref` (estos últimos son términos internos del motor IA, nunca
visibles — ver `21_contrato_de_canal_y_presentadores.md`).

## 11. Criterios de aceptación

- Los labels principales usan lenguaje humano, no técnico, incluidos los
  módulos nuevos (presupuestos, proyecciones, reportes, asistente, memoria).
- `Insights`, `Recurrentes`, `Nudges`, `Chatbot` y `Bot` no aparecen como
  label visible principal en ninguna pantalla V1-web.
- El asistente nunca se presenta como "IA" frente al usuario — se presenta
  como "Asistente" con lenguaje de acompañamiento, no de automatización.
- Toda pantalla de memoria/aprendizaje ofrece ver, corregir, deshacer y
  olvidar — nunca solo lectura.
- Toda proyección o simulación declara su supuesto en el mismo mensaje.
- Las categorías o señales sensibles siguen los niveles de referencia
  heredados para lenguaje discreto.
- Cada término visible nuevo tiene equivalente técnico claro documentado
  en la tabla correspondiente de §8.
