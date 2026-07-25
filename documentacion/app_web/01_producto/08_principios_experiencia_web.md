# 08 — Principios de experiencia de la aplicación web

**Bloque:** 01 — Producto
**Estado:** V1 (migración con mejoras)
**Fecha:** 25 de julio de 2026
**Depende de:** `06_tesis_app_web.md`
**Documentos que dependen de este:** `16_design_system_web.md`, `17_patrones_datos_formularios_y_listados.md`, todos los de `04_modulos/` (§12 y §19)
**Fuente:** `docs/fase_3_producto/10_principios_experiencia.md` (V1, 23 de mayo de 2026) — se conserva casi íntegro; se añaden tres principios y se reemplaza la sección de canales

---

## 1. Tesis

Manzana no debe sentirse como una app contable con IA encima. Debe sentirse
como una inteligencia financiera personal que entiende cómo habla el usuario,
tolera datos imperfectos, protege el dinero con reglas exactas y devuelve
claridad sin culpa.

> La experiencia debe mover al usuario de confusión a claridad, de culpa a
> alivio, de desorden a patrón visible y de ansiedad a un siguiente paso
> pequeño.

## 2. Promesa de experiencia

La app debe sentirse: rápida para registrar, clara para entender, tranquila
frente a errores, discreta con información sensible, inteligente sin ser
invasiva, y útil incluso con datos incompletos.

La experiencia falla si el usuario siente que está llenando formularios, que
lo están juzgando, que tiene que entender contabilidad, que el sistema
inventa precisión, que corregir es difícil, o que la IA "sabe" demasiado de
forma incómoda.

## 3. Principios rectores

Los doce principios heredados se conservan. El primero se reformula, porque
"conversación primero" describía un producto cuyo canal principal era el
chat; en la app web la conversación es **una** vía de entrada, no la única.

| # | Principio | Implicación |
|---|---|---|
| 1 | **Entrada sin fricción, por la vía que el usuario prefiera** | Registrar debe ser igual de fácil escribiendo una línea, importando un archivo, confirmando una detección o hablándole al asistente. Ninguna vía es "la de verdad". |
| 2 | Claridad antes que contabilidad | El objetivo no es registrar cada centavo perfecto; es generar claridad útil. |
| 3 | Dinero con reglas exactas | Saldos, deudas, cajas, pagos que vienen y dinero libre se calculan determinísticamente, nunca por inferencia de un modelo. |
| 4 | Cero culpa | Manzana describe cambios, no juzga comportamiento. |
| 5 | Corrección natural | Corregir debe ser tan fácil como registrar. |
| 6 | Datos imperfectos son válidos | El sistema trabaja con cuenta `null`, montos faltantes o pendientes, mostrando sus límites. |
| 7 | Uso parcial es válido | El usuario puede usar solo gastos, solo deudas, solo presupuestos o solo el resumen. |
| 8 | Progresión gradual | No mostrar todo al inicio; revelar capacidades cuando el contexto las vuelve útiles. |
| 9 | Confianza visible | Cada dato importante puede explicar fuente, estado y posibilidad de corrección. |
| 10 | Proactividad respetuosa | Los recordatorios ayudan, no persiguen. |
| 11 | Privacidad como experiencia | Modo discreto y sensibilidad importan tanto como el cálculo. |
| 12 | Wow con sentido | Sorprender es hacer que el usuario se reconozca en un patrón útil, no impresionar. |

## 4. Los tres principios nuevos

Estos tres no existían en el corpus anterior. Son consecuencia directa de la
ambición ampliada de la app (`WEB-D002`, `WEB-D003`) y de los hallazgos de
las auditorías. No son matices de los doce anteriores: son condiciones que
cualquier pantalla debe cumplir.

### 4.1 Procedencia — toda cifra explica de dónde sale

Ningún número que la app muestre puede ser un dato huérfano. Todo monto,
porcentaje, proyección o clasificación debe poder responder **"¿de dónde
sale esto?"** con evidencia concreta: los movimientos que lo componen, la
fórmula aplicada, la fecha de cálculo, y qué supuesto se usó si es una
estimación.

Por qué importa: la auditoría del 23 de julio encontró que el sistema podía
afirmar cifras sin poder señalar los movimientos que las sustentaban — el
hallazgo P0.4, "no existe invariante de grounding". En una app donde el
usuario ve los números directamente en pantalla, ese problema es aún más
visible que en una conversación.

Aplicación concreta:

| Superficie | Cómo se cumple |
|---|---|
| Dinero libre en Home | Desglose completo disponible en un clic: total → cajas → libre en cuentas → compromisos → dinero libre. |
| Cifra de un descubrimiento | Enlace a los movimientos exactos que la componen. |
| Proyección | El supuesto se muestra junto a la cifra, en el mismo bloque visual, no en un tooltip escondido. |
| Categoría asignada automáticamente | El usuario puede ver por qué se clasificó así y qué evidencia lo sostiene. |
| Respuesta del asistente | Toda cifra lleva su referencia; si no hay evidencia, no se emite la cifra. |

**Antipatrón prohibido:** mostrar un porcentaje de confianza numérico como
sustituto de la explicación (contradicción `C-11`). "82% de confianza" no es
procedencia; "así clasificaste 8 de tus últimos 10 pedidos" sí lo es.

### 4.2 Control — nada importante ocurre sin aprobación

El sistema puede detectar, sugerir, proponer y preparar. **No ejecuta
operaciones sobre el dinero, ni cambios de configuración relevantes, sin que
el usuario lo confirme explícitamente.**

Este principio ya existía en el corpus anterior pero solo para email ("email
nunca auto-registra"). Se eleva a principio transversal porque ahora hay
tres orígenes nuevos que podrían saltárselo: la importación de archivos, la
detección de recurrentes y el asistente conversacional.

| Acción | Requiere confirmación |
|---|---|
| Registrar un movimiento detectado por correo | Sí, siempre |
| Registrar movimientos de una importación | Sí, con previsualización previa |
| Activar un pago recurrente detectado | Sí — detectar no es activar |
| Cualquier escritura propuesta por el asistente | Sí, con tarjeta de confirmación |
| Eliminar un movimiento, deuda o cuenta | Sí, con confirmación de riesgo |
| Activar un canal de notificación | Sí, opt-in explícito por canal y tipo |
| Aplicar un aprendizaje de memoria a datos pasados | Sí |
| Filtrar, ordenar, navegar, consultar | No — son acciones sin efecto |

**Corolario:** una acción que requiere confirmación nunca se presenta como
ya ejecutada. El copy "Registrado" solo aparece cuando el Core confirmó la
escritura, jamás como texto optimista anticipado.

### 4.3 Reversibilidad — todo lo aprendido y lo hecho se puede deshacer

El usuario debe poder revertir tanto sus acciones como lo que el sistema
infirió sobre él. Para los datos: deshacer, restaurar, historial de cambios.
Para la memoria: ver, corregir, deshacer y **olvidar**.

Por qué importa: la matriz de cumplimiento marcó como `No localizado` la
capacidad de reducir la confianza de un aprendizaje o de olvidarlo
(contradicción `C-08`); el sistema solo sabía aumentar confianza
(`confidence = greatest(anterior, nueva)`). Un sistema que solo aprende y
nunca desaprende acumula errores que el usuario no puede corregir.

| Elemento | Cómo se revierte |
|---|---|
| Movimiento eliminado | Restaurable, con historial visible |
| Movimiento editado | Historial de cambios con valores anteriores |
| Importación completa | Deshacer el lote entero en una acción |
| Confirmación de un pendiente | Deshacer dentro de una ventana razonable |
| Aprendizaje de memoria | Corregir, suspender u olvidar por completo |
| Consentimiento otorgado | Revocable en cualquier momento, sin penalización funcional oculta |
| La cuenta completa | Exportación total + eliminación definitiva |

**Regla de honestidad:** si algo es genuinamente irreversible (por ejemplo,
la eliminación definitiva de la cuenta), se dice con claridad antes de
ejecutar, no después.

## 5. La fórmula de experiencia

```text
experiencia Manzana =
  baja fricción
  + claridad financiera
  + confianza corregible
  + lenguaje humano
  + autodescubrimiento amable
```

```text
wow = espejo personal + verdad concreta + alivio emocional + siguiente paso pequeño
```

## 6. Jerarquía de calidad

Cuando haya tensión entre objetivos, se prioriza en este orden:

1. Seguridad financiera y privacidad
2. Confianza y trazabilidad
3. Claridad para el usuario
4. Baja fricción
5. Personalización
6. Wow
7. Complejidad funcional

> Ningún wow justifica exponer datos sensibles, inventar certeza o romper
> confianza.

## 7. Sensación esperada por superficie

Reemplaza la §6 del documento original, que organizaba las expectativas por
canal (WhatsApp, Dashboard, Email). Aquí se organizan por superficie dentro
de la app.

### 7.1 La app en general

Calma visual, control, contexto, explicación y edición segura. El usuario
debe poder escanear una pantalla en segundos y saber si algo requiere su
atención.

### 7.2 Registro y captura

Debe sentirse ligero. Escribir "taxi 15" y que funcione. Importar un archivo
y ver exactamente qué va a pasar antes de que pase. Nunca un formulario de
doce campos obligatorios para anotar un café.

No debe sentirse como: planilla, declaración de impuestos, ni sistema que
exige completar todo para aceptar algo.

### 7.3 El asistente

Debe sentirse como escribirle a alguien que entiende de tu dinero y tiene
los datos a la mano. Breve cuando la pregunta es breve. Explicativo cuando
hace falta. Honesto cuando no puede responder.

No debe sentirse como: chatbot que exige formato, asistente que responde
largo siempre, ni IA que confirma de más. Y nunca debe presentarse como
autónomo: propone, el usuario decide.

### 7.4 Detección por correo

Ayuda pasiva. Bandeja de pendientes. Detección que pide permiso.

```text
Manzana encontró algo por mí, pero no lo registró sin preguntarme.
```

### 7.5 Presupuestos y metas

Deben sentirse como un plan propio, no como una dieta impuesta. Superar un
presupuesto es información, no un fracaso.

```text
Correcto:   Vas S/30 arriba de lo que planeaste en Transporte.
            ¿Quieres ajustarlo o ver qué subió?
Incorrecto: Superaste tu presupuesto. ⚠️
```

### 7.6 Proyecciones

Deben reducir incertidumbre sin fingir certeza. Siempre con el supuesto
visible.

```text
Correcto:   A este ritmo terminarías el mes con S/180 libres.
            Cuento tus 3 pagos que vienen y tu ritmo de las últimas 2 semanas.
Incorrecto: Terminarás el mes con S/180.
```

### 7.7 Descubrimientos

No deben sentirse como reportes, sino como "Manzana notó algo", "ahora veo
qué pasó", "esto puedo corregirlo o vigilarlo".

### 7.8 Recordatorios

Pocos, pausables, oportunos, discretos cuando haga falta. Si el usuario
piensa "me están molestando", el sistema falló aunque la regla técnica sea
correcta.

### 7.9 Deudas y pagos que vienen

Deben reducir ansiedad, no aumentarla.

```text
Buscado:  Ya sé qué viene. No me va a agarrar de sorpresa.
Evitar:   Tengo otra app recordándome que debo plata.
```

## 8. Lenguaje emocional permitido

Manzana puede sonar cercana, clara, tranquila, inteligente, breve, amable,
peruana cuando el contexto lo pide, y humana sin exagerar.

No debe sonar moralista, dramáticamente emocional, infantil, coach financiero
agresivo, banco, app contable, ni IA que intenta impresionar.

## 9. Anti-principios

No construir experiencias que dependan de:

- obligar al usuario a clasificar todo,
- exigir cuentas perfectas desde el día 1,
- mostrar dashboards vacíos como fracaso,
- activar recordatorios por defecto sin control,
- llamar "descubrimiento" a cualquier métrica,
- esconder errores del sistema,
- usar IA para inventar seguridad,
- convertir todo cálculo en una llamada a un modelo,
- llenar la UI de tarjetas sin jerarquía,
- usar lenguaje técnico como label principal,
- **mostrar una cifra sin poder explicar de dónde sale** (nuevo),
- **ejecutar algo sobre el dinero sin confirmación** (nuevo),
- **aprender algo del usuario que él no pueda ver ni borrar** (nuevo).

## 10. Estados que deben sentirse cuidados

| Situación | Debe sentir | No debe sentir |
|---|---|---|
| Usuario nuevo | "Puedo empezar con poco." | "Tengo que configurar todo antes de recibir valor." |
| Pocos datos | "Estoy aprendiendo tus gastos. Con unos registros más veré patrones." | Pantallas vacías presentadas como fracaso. |
| Error de la IA | "Gracias. Lo corrijo y lo tendré en cuenta." | Que corregir sea más trabajo que registrar de nuevo. |
| Usuario endeudado | "Tienes 3 cuotas activas. La más próxima vence el viernes." | Vergüenza o tono de cobranza. |
| Usuario que vuelve tras ausencia | "Si quieres, reconstruimos esta semana en 1 minuto." | "Hace días que no registras nada." |
| Presupuesto superado | "Vas S/30 arriba en Transporte. ¿Ajustamos?" | Alarma roja sin salida. |
| El asistente no puede responder | "No puedo responder eso ahora con los datos que tengo." | Una respuesta inventada que suene segura. |

## 11. Relación con decisiones técnicas

Estos principios no son solo copy — condicionan la arquitectura:

| Decisión técnica | Principio que la sostiene |
|---|---|
| Invariante de evidencia en el motor (`22_grounding_evidencia_y_politica.md`) | Procedencia (§4.1) |
| Tarjeta de confirmación obligatoria antes de escribir | Control (§4.2) |
| Estados de memoria con evidencia negativa y expiración | Reversibilidad (§4.3) |
| Motores determinísticos para todo cálculo de dinero | Dinero con reglas exactas (§3.3) |
| Bandeja de pendientes como paso obligatorio de toda detección | Control (§4.2) |
| Paginación por cursor y filtros server-side | Baja fricción con volumen real de datos |
| Modo discreto como preferencia de servidor | Privacidad como experiencia (§3.11) |
| Política anti-fatiga en recordatorios | Proactividad respetuosa (§3.10) |

## 12. Checklist antes de implementar cualquier pantalla

- ¿El usuario entiende qué pasó?
- ¿Sabe que puede corregirlo?
- ¿Se muestra fuente o estado cuando importa?
- ¿Puede preguntar de dónde sale cada cifra?
- ¿Hay una acción clara?
- ¿Se evita culpa?
- ¿Se evita lenguaje técnico innecesario?
- ¿Se respeta modo discreto si aplica?
- ¿Nada se ejecuta sin confirmación?
- ¿Se degrada bien si faltan datos?
- ¿Funciona con teclado y lector de pantalla?
- ¿Se siente como Manzana o como una app genérica?

## 13. Criterios de aceptación

- `AC-EXP-01` — Toda cifra financiera visible tiene una vía de explicación
  accesible desde la propia pantalla. Evidencia: `TEST` + `USER`.
- `AC-EXP-02` — Ninguna operación de escritura financiera se ejecuta sin
  confirmación explícita del usuario, sea cual sea su origen. Evidencia: `TEST`.
- `AC-EXP-03` — Toda superficie de memoria ofrece ver, corregir, deshacer y
  olvidar. Evidencia: `TEST` + `USER`.
- `AC-EXP-04` — Ningún copy visible culpa al usuario ni usa lenguaje de
  fracaso ante presupuestos superados, deudas o inactividad. Evidencia: `USER`.
- `AC-EXP-05` — No aparece ningún porcentaje de confianza numérico en
  superficies estándar. Evidencia: `TEST`.
- `AC-EXP-06` — Ningún texto afirma que algo se registró antes de que el Core
  lo confirme. Evidencia: `TEST`.
