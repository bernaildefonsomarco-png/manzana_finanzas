# Feature 6-7: Categorias Inteligentes, Subcategorias y Etiquetas Contextuales

**Parte del Paso 5/20 - Alcance V1.0**  
**Prioridad:** P1  
**Estado:** V2 - Especificacion avanzada  
**Ultima actualizacion:** 21 de mayo, 2026

---

## 1. Tesis

Las categorias, subcategorias y etiquetas no son solo filtros. Son el idioma con el que Manzana convierte movimientos sueltos en claridad financiera.

La tesis de V1 es:

> La IA ayuda a entender como habla el usuario; el Core financiero guarda datos consistentes; el Learning Engine aprende preferencias; el usuario siempre puede corregir.

El sistema debe clasificar sin exigir friccion, pero sin inventar certezas cuando el mensaje no da suficiente evidencia.

---

## 2. Principios de diseno

1. **Categorias base estables.**  
   Las 12 categorias base son canonicas para analytics, filtros, insights y comparabilidad.

2. **Subcategorias personalizadas.**  
   Las subcategorias crecen por usuario. No se fuerzan globalmente.

3. **Etiquetas como contexto humano.**  
   Las etiquetas explican el "por que" o el contexto del movimiento: impulso, trabajo, social, recurrente, etc.

4. **IA propone, Core valida.**  
   La IA puede sugerir categoria, subcategoria y etiquetas, pero los validadores impiden valores invalidos.

5. **Correccion facil.**  
   Si el usuario corrige, el movimiento se actualiza y el Learning Engine aprende el patron.

6. **No bloquear el registro por clasificacion imperfecta.**  
   Si el monto, tipo y fecha son claros, el movimiento puede guardarse aunque la categoria quede pendiente.

7. **Sin juicio moral.**  
   La categoria o etiqueta nunca debe sonar a culpa. "Impulso" es una senal de patron, no una critica.

8. **Privacidad primero.**  
   Categorias sensibles no deben aparecer en nudges o respuestas proactivas si el modo discreto o las politicas lo restringen.

---

## 3. Que no es este sistema

No es:

- un plan contable empresarial,
- un sistema tributario,
- un reemplazo de Cuentas/Cajas,
- un reemplazo de Deudas o Recurrentes,
- un clasificador 100% automatico e infalible,
- una lista infinita de categorias creadas por IA,
- una pantalla pesada que el usuario deba configurar antes de usar Manzana.

Las categorias ayudan a entender el dinero. No son la fuente de verdad del saldo ni de obligaciones.

---

## 4. Relacion con otros sistemas

| Sistema | Relacion |
|---|---|
| WhatsApp | Captura lenguaje natural y permite corregir clasificaciones en conversacion. |
| Motor IA | DataAgent propone clasificacion; CorrectionAgent interpreta cambios; Learning Engine aprende. |
| Dashboard | Permite filtrar, revisar, editar y confirmar categorias, subcategorias y etiquetas. |
| Cuentas/Cajas | Determinan de donde salio o entro el dinero; categorias explican para que fue. |
| Deudas | El Debt Engine controla deuda, cuotas y pagos; la categoria "Deudas" solo clasifica la naturaleza del movimiento. |
| Recurrentes | Recurring Engine detecta patrones; puede anadir etiqueta `recurrente` o sugerir subcategoria. |
| Email Parsing | Emails crean pendientes con categoria sugerida, nunca movimientos definitivos sin aprobacion. |
| Insights | Usa categorias, subcategorias y etiquetas para detectar patrones utiles. |
| Nudges | Puede usar categorias/etiquetas, pero pasa por opt-in, horario silencioso, modo discreto y Risk Policy. |
| Core financiero | Persiste la clasificacion final y mantiene auditabilidad. |

---

## 5. Modelo conceptual

### 5.1 Categoria base

Categoria canonica, fija y comun a todos los usuarios.

Ejemplos:

- `alimentacion`
- `transporte`
- `servicios_suscripciones`

Se usa para:

- reportes,
- filtros,
- graficos,
- insights,
- comparaciones por periodo,
- reglas de calidad de datos.

### 5.2 Subcategoria

Clasificacion mas especifica, personalizada por usuario.

Ejemplos:

- `cafe`
- `delivery`
- `uber`
- `netflix`
- `farmacia`

Se usa para:

- busqueda natural,
- patrones personales,
- insights mas precisos,
- aprendizaje de comercios y frases frecuentes.

### 5.3 Etiqueta contextual

Senal adicional que describe contexto, intencion o patron.

Ejemplos:

- `trabajo`
- `impulso`
- `social`
- `recurrente`

Un movimiento puede tener cero, una o varias etiquetas.

### 5.4 Estado de clasificacion

La clasificacion puede estar:

| Estado | Significado |
|---|---|
| `confirmed` | Confirmada por usuario o por evidencia alta. |
| `suggested` | Sugerida con confianza razonable, visible y editable. |
| `needs_review` | No hay suficiente evidencia o hay ambiguedad relevante. |
| `corrected` | Fue modificada por el usuario despues de guardarse. |

---

## 6. Categorias base V1.0

Las categorias base son 12 y no deben crecer automaticamente.

| ID canonico | Nombre visible | Incluye | No debe confundirse con |
|---|---|---|---|
| `alimentacion` | Alimentacion | cafe, delivery, restaurante, menu, mercado, snacks | salud nutricional o compras de cocina grande si se decide separar luego |
| `transporte` | Transporte | taxi, Uber, bus, gasolina, peajes, estacionamiento | viajes completos o turismo |
| `vivienda_hogar` | Vivienda / Hogar | alquiler, mantenimiento, limpieza, muebles basicos | servicios mensuales como luz/internet si se registran como servicio |
| `servicios_suscripciones` | Servicios / Suscripciones | Netflix, Spotify, internet, luz, agua, celular, software mensual | compras puntuales de tecnologia |
| `salud` | Salud | farmacia, doctor, terapia, examenes, seguro medico | bienestar/ocio si no es gasto medico |
| `educacion` | Educacion | universidad, cursos, libros, materiales, certificaciones | productividad laboral si es herramienta de trabajo |
| `ocio_salidas` | Ocio / Salidas | cine, bares, videojuegos, eventos, hobbies | alimentacion cotidiana |
| `compras_personales` | Compras personales | ropa, tecnologia personal, belleza, accesorios | herramientas de trabajo |
| `familia_apoyo` | Familia / Apoyo | regalos, apoyo a padres, ayuda familiar, aportes | prestamos formales a personas |
| `deudas` | Deudas | cuotas, intereses, pagos de prestamo, pagos de tarjeta | el estado real de la deuda, que vive en Debt Engine |
| `trabajo_productividad` | Trabajo / Productividad | herramientas, coworking, SaaS laboral, materiales de trabajo | servicios personales recurrentes |
| `otros` | Otros | movimientos claros que no encajan en ninguna categoria base | movimientos sin clasificar |

### Regla clave: `otros` no es `sin clasificar`

`otros` significa:

> "Sabemos que movimiento es, pero no encaja bien en las 12 categorias."

`sin clasificar` significa:

> "Todavia no sabemos que categoria corresponde."

Por eso `sin clasificar` no debe ser una categoria base. Debe modelarse como:

```ts
category_id: null
classification_status: "needs_review"
```

---

## 7. Subcategorias

Las subcategorias permiten que Manzana se vuelva mas personal sin romper la taxonomia base.

### 7.1 Reglas

- Son por usuario.
- Pertenecen a una categoria base.
- Pueden ser creadas por el usuario, sugeridas por IA o aprendidas por patrones.
- Deben normalizar variantes comunes.
- Deben poder archivarse si dejan de usarse.
- No deben contaminar a otros usuarios.

### 7.2 Ejemplos iniciales

| Categoria | Subcategorias sugeridas |
|---|---|
| Alimentacion | `cafe`, `delivery`, `menu`, `restaurante`, `mercado`, `snacks` |
| Transporte | `taxi`, `uber`, `bus`, `gasolina`, `peaje` |
| Servicios / Suscripciones | `netflix`, `spotify`, `internet`, `luz`, `agua`, `celular` |
| Salud | `farmacia`, `doctor`, `terapia`, `seguro_medico` |
| Deudas | `tarjeta_credito`, `prestamo_banco`, `prestamo_personal`, `cuota` |
| Trabajo / Productividad | `coworking`, `software`, `herramientas`, `materiales` |

### 7.3 Normalizacion

El sistema debe mapear expresiones frecuentes:

| Usuario escribe | Subcategoria sugerida |
|---|---|
| cafecito, cafe, starbucks | `cafe` |
| taxi, uber, indrive, cabify | `taxi` o `uber` segun evidencia |
| menu, almuerzo, comida del dia | `menu` o `almuerzo` |
| netflix, nf, suscripcion netflix | `netflix` |

Si hay duda entre dos subcategorias, no se debe crear una nueva automaticamente.

### 7.4 Cuando crear una subcategoria nueva

Crear o sugerir nueva subcategoria cuando:

- aparece repetidamente,
- tiene utilidad analitica,
- el usuario la menciona explicitamente,
- mejora la busqueda o insights,
- no duplica una subcategoria existente.

No crear subcategoria nueva cuando:

- parece un typo,
- es una descripcion unica,
- es demasiado sensible sin confirmacion,
- duplicaria un alias existente,
- solo existe por falta de contexto.

---

## 8. Etiquetas contextuales

Las etiquetas son capas de significado. No reemplazan categoria ni tipo de movimiento.

| ID | Nombre visible | Que detecta | Como ayuda |
|---|---|---|---|
| `necesario` | Necesario | Gasto dificil de evitar | Separar base de gasto discrecional. |
| `gusto` | Gusto | Gasto elegido para disfrute | Entender placer sin culpa. |
| `impulso` | Impulso | Gasto no planeado o reactivo | Detectar patrones de decision. |
| `recurrente` | Recurrente | Movimiento que se repite | Conectar con proyecciones y pagos esperados. |
| `social` | Social | Gasto con amigos, pareja, familia o colegas | Entender gasto social. |
| `trabajo` | Trabajo | Relacionado a trabajo o productividad | Separar personal/laboral. |
| `estres` | Estres | Posible gasto ligado a tension o cansancio | Insights emocionales con cuidado. |
| `fin_de_semana` | Fin de semana | Patron temporal de sabado/domingo | Analizar cambios por dia. |

### 8.1 Reglas de etiquetas

- Pueden ser inferidas por IA, reglas o motores de experiencia.
- Pueden ser corregidas por el usuario.
- Pueden coexistir varias etiquetas en un movimiento.
- No deben bloquear el registro.
- No deben exponerse en mensajes proactivos si son sensibles o si el modo discreto aplica.
- No deben tratarse como verdades psicologicas.

### 8.2 Etiquetas inferidas vs confirmadas

Una etiqueta inferida debe guardar fuente y confianza.

Ejemplo:

```ts
tags: [
  { id: "trabajo", source: "llm", confidence: 0.87, status: "suggested" },
  { id: "fin_de_semana", source: "rule", confidence: 1.0, status: "confirmed" }
]
```

En la UI se puede simplificar mostrando solo las etiquetas visibles.

---

## 9. Flujo de clasificacion

### 9.1 Registro por WhatsApp

```text
Usuario
  -> WhatsApp Adapter
  -> FinancialOrchestrator
  -> Context Manager construye DataContextPack
  -> DataAgent extrae movimiento y propone clasificacion
  -> Validadores revisan categoria/subcategoria/tags
  -> Core financiero guarda movimiento
  -> Transactional Outbox
  -> Event Bus interno
  -> ResponsePlanner confirma o pide aclaracion
```

Ejemplo:

```text
Gasté 8 en café.
```

Resultado esperado:

```json
{
  "movement_type": "gasto",
  "amount": 8,
  "category_id": "alimentacion",
  "subcategory": "cafe",
  "tags": ["gusto"],
  "classification_status": "suggested"
}
```

Si el usuario suele marcar cafe como `necesario`, el Learning Engine puede ajustar la sugerencia.

### 9.2 Registro multiple

Mensaje:

```text
Hoy gasté 8 café, 15 taxi y 20 almuerzo.
```

El DataAgent debe devolver tres propuestas separadas:

| Monto | Categoria | Subcategoria |
|---:|---|---|
| 8 | `alimentacion` | `cafe` |
| 15 | `transporte` | `taxi` |
| 20 | `alimentacion` | `almuerzo` |

El Core guarda movimientos separados. La respuesta debe ser compacta.

### 9.3 Dashboard manual

El formulario manual no depende de IA para funcionar.

Debe permitir:

- tipo de movimiento,
- monto,
- fecha,
- cuenta si aplica,
- categoria,
- subcategoria,
- etiquetas,
- nota,
- persona relacionada si aplica.

La IA puede sugerir categoria/subcategoria a partir de la nota, pero el usuario debe ver el resultado antes de guardar.

### 9.4 Email parsing

En V1, un email no debe crear un movimiento definitivo sin aprobacion.

Flujo:

```text
Email Adapter
  -> Parser
  -> DataAgent sugiere tipo/categoria/cuenta
  -> Pending Inbox
  -> WhatsApp o Dashboard pide confirmacion
  -> Core guarda solo si el usuario aprueba
```

---

## 10. Confianza y confirmacion

La clasificacion se maneja por umbrales.

| Confianza | Accion |
|---|---|
| Alta | Guardar clasificacion como sugerida/confirmada segun fuente. |
| Media | Guardar si el movimiento es claro, pero mostrar como editable. |
| Baja | Guardar movimiento con `category_id: null` y `needs_review`, o pedir aclaracion si afecta el flujo. |
| Ambigua y sensible | Preguntar antes de etiquetar o exponer. |

### 10.1 Cuando preguntar

Preguntar cuando:

- la categoria cambia el tipo real de movimiento,
- puede ser deuda, prestamo, transferencia o gasto,
- se detecta categoria sensible con baja confianza,
- el usuario esta creando una regla recurrente,
- el resultado afectara un insight o nudge importante,
- el movimiento viene de email y requiere aprobacion.

### 10.2 Cuando no preguntar

No preguntar solo para perfeccionar clasificacion si:

- el movimiento basico esta claro,
- el usuario esta en captura rapida,
- la clasificacion puede quedar editable,
- el costo de interrumpir es mayor que el beneficio.

Ejemplo:

```text
Gasté 8 café
```

No hace falta preguntar "¿es alimentacion?". Se registra y se deja corregible.

---

## 11. Correccion y aprendizaje

Las correcciones son parte del producto, no errores raros.

Ejemplos:

```text
No era taxi, era Uber de trabajo.
```

```text
Eso no fue gasto, fue préstamo a Luis.
```

```text
El café de hoy márcalo como trabajo.
```

### 11.1 Flujo de correccion

```text
Usuario corrige
  -> CorrectionAgent interpreta cambio
  -> Core actualiza movimiento
  -> audit_log registra antes/despues
  -> Learning Engine guarda patron si corresponde
  -> Event Bus recalcula agregados e insights
  -> ResponsePlanner confirma
```

### 11.2 Que aprende el sistema

Puede aprender:

- aliases del usuario,
- comercios frecuentes,
- subcategorias preferidas,
- etiquetas recurrentes,
- categoria por descripcion,
- categoria por cuenta,
- categoria por persona relacionada,
- categoria por dia u horario si hay evidencia.

Ejemplos:

| Patron observado | Aprendizaje posible |
|---|---|
| "cafecito" corregido varias veces a `cafe` | Alias personal. |
| "Uber oficina" corregido a `trabajo` | Etiqueta `trabajo` cuando aparezca oficina. |
| Netflix confirmado mensual | Subcategoria `netflix` + etiqueta `recurrente`. |
| "Luis" suele ser prestamo | Preguntar antes de clasificar como gasto. |

### 11.3 Limites del aprendizaje

El Learning Engine no debe:

- cambiar movimientos historicos sin permiso,
- crear categorias base nuevas,
- convertir una preferencia en regla universal,
- inferir temas sensibles con baja evidencia,
- ocultar al usuario que algo fue corregido.

---

## 12. Deudas, prestamos y transferencias

La clasificacion no debe tapar el tipo de movimiento.

### 12.1 Deudas

```text
Pagué la cuota de la tarjeta.
```

Debe interpretarse principalmente como:

```ts
movement_type: "pago_deuda"
```

Puede llevar:

```ts
category_id: "deudas"
subcategory: "tarjeta_credito"
```

Pero el estado de la deuda lo controla Debt Engine.

### 12.2 Prestamos

```text
Le presté 50 a Luis.
```

Debe ser:

```ts
movement_type: "prestamo_dado"
```

No debe clasificarse automaticamente como `familia_apoyo` si la intencion real es recuperarlo.

### 12.3 Transferencias

```text
Pasé 200 de Yape a BCP.
```

Debe ser:

```ts
movement_type: "transferencia"
```

Normalmente no requiere categoria de gasto.

### 12.4 Asignaciones internas

```text
Mandé 100 a mi caja de alquiler.
```

Debe ser:

```ts
movement_type: "asignacion_interna"
```

La categoria puede quedar nula porque no es gasto real.

---

## 13. Recurrentes

"Recurrente detectado" significa que el sistema encontro un patron probable de repeticion.

Ejemplos:

- Netflix cada mes,
- alquiler cada inicio de mes,
- plan celular mensual,
- cuota de prestamo,
- suscripcion de software.

El Recurring Engine detecta el patron. La etiqueta `recurrente` solo lo hace visible para insights y filtros.

Regla:

> La etiqueta `recurrente` no crea por si sola una obligacion futura. La obligacion/proyeccion vive en Recurring Engine o Debt Engine.

---

## 14. Busqueda natural

Categorias, subcategorias y etiquetas alimentan busqueda natural en Dashboard y WhatsApp.

Ejemplos:

| Consulta | Interpretacion |
|---|---|
| "gastos en cafe de abril" | categoria `alimentacion`, subcategoria `cafe`, periodo abril |
| "cuanto gaste en transporte el ultimo viernes" | categoria `transporte`, fecha resuelta por Motor IA |
| "gastos de trabajo este mes" | etiqueta `trabajo`, periodo actual |
| "impulsos de fin de semana" | tags `impulso` + `fin_de_semana` |

El agente conversacional puede consultar la base usando herramientas read-only. No necesita cargar todo el historial en contexto.

---

## 15. Dashboard UX

El Dashboard debe permitir:

- filtrar por categoria,
- filtrar por subcategoria,
- filtrar por etiqueta,
- ver movimientos sin clasificar,
- editar clasificacion desde detalle de movimiento,
- revisar pendientes de clasificacion,
- buscar en lenguaje natural,
- ver insights por categoria y subcategoria.

### 15.1 Movimiento sin clasificar

Debe mostrarse como:

```text
Sin clasificar
```

No como "Otros".

### 15.2 Correccion rapida

En el detalle de movimiento:

- categoria editable,
- subcategoria editable o creable,
- etiquetas editables,
- fuente de clasificacion visible de forma simple,
- opcion para aplicar aprendizaje futuro cuando tenga sentido.

Ejemplo de microcopy:

```text
Guardar y recordar para próximos movimientos parecidos
```

---

## 16. Privacidad y modo discreto

Algunas categorias o etiquetas pueden ser sensibles:

- salud,
- deudas,
- estres,
- familia/apoyo,
- compras personales,
- posibles gastos impulsivos.

Reglas:

- En WhatsApp, respuestas proactivas deben respetar modo discreto.
- En nudges, no mostrar categoria sensible si puede exponer al usuario.
- En Dashboard V1, modo discreto global no es obligatorio; pero debe existir base de politica para ocultar montos/categorias sensibles en comunicaciones externas.
- Los insights emocionales deben ser opt-in o mostrarse con tono cuidadoso.

Ejemplo permitido en modo discreto:

```text
Tienes un pendiente financiero próximo. ¿Quieres verlo?
```

Ejemplo no permitido en modo discreto:

```text
Tu deuda de tarjeta vence mañana por S/420.
```

---

## 17. Contratos de datos

### 17.1 Categoria base

```ts
type BaseCategoryId =
  | "alimentacion"
  | "transporte"
  | "vivienda_hogar"
  | "servicios_suscripciones"
  | "salud"
  | "educacion"
  | "ocio_salidas"
  | "compras_personales"
  | "familia_apoyo"
  | "deudas"
  | "trabajo_productividad"
  | "otros";
```

### 17.2 Movimiento clasificado

```ts
type ClassificationStatus =
  | "confirmed"
  | "suggested"
  | "needs_review"
  | "corrected";

type ClassificationSource =
  | "user"
  | "manual"
  | "llm"
  | "rule"
  | "learning"
  | "email_parser"
  | "recurring_engine";

type MovementClassification = {
  category_id: BaseCategoryId | null;
  subcategory_id: string | null;
  tags: string[];
  classification_status: ClassificationStatus;
  classification_source: ClassificationSource;
  classification_confidence: number | null;
  evidence_summary: string | null;
  corrected_from?: {
    category_id?: BaseCategoryId | null;
    subcategory_id?: string | null;
    tags?: string[];
  };
};
```

### 17.3 Subcategoria de usuario

```ts
type UserSubcategory = {
  id: string;
  user_id: string;
  category_id: BaseCategoryId;
  name: string;
  normalized_name: string;
  aliases: string[];
  source: "user" | "llm" | "learning" | "import";
  status: "active" | "archived";
  usage_count: number;
  last_used_at: string | null;
};
```

### 17.4 Etiqueta

```ts
type MovementTag = {
  id: string;
  source: ClassificationSource;
  confidence: number | null;
  status: "confirmed" | "suggested" | "corrected";
};
```

---

## 18. Validaciones

El Core debe validar:

- `category_id` pertenece a las 12 categorias o es `null`,
- `subcategory_id` pertenece al usuario y a la categoria base,
- `tags` pertenecen al set permitido o a etiquetas custom habilitadas,
- `classification_confidence` esta entre 0 y 1,
- `otros` no se usa para falta de informacion,
- `category_id: null` debe acompanarse de `needs_review`,
- movimientos no-gasto pueden tener categoria nula,
- cambios quedan auditados.

---

## 19. Metricas de calidad

| Metrica | Para que sirve |
|---|---|
| Tasa de correccion por categoria | Detectar categorias mal clasificadas. |
| Tasa de `needs_review` | Medir ambiguedad y calidad del DataAgent. |
| Uso de subcategorias | Saber si aportan valor real. |
| Precision por fuente | Comparar LLM, reglas, learning y manual. |
| Tiempo hasta correccion | Medir friccion de UX. |
| Porcentaje de movimientos con etiqueta util | Evaluar si etiquetas alimentan insights. |
| Tasa de "otros" | Detectar si faltan subcategorias o si la taxonomia base no alcanza. |
| Correcciones repetidas | Alimentar Learning Engine. |

---

## 20. Casos borde

| Caso | Comportamiento esperado |
|---|---|
| "Le pase 50 a Luis" | Preguntar si fue gasto, prestamo o devolucion si no hay contexto. |
| "Me pagaron lo que me debia Ana" | `devolucion_recibida`, no ingreso normal. |
| "Pague tarjeta" | `pago_deuda`; categoria `deudas` opcional. |
| "Movi 100 a ahorros" | `transferencia` o `asignacion_interna`; categoria nula. |
| "Ayer gaste en taxi y comida pero no recuerdo cuanto" | Crear pendiente o pedir montos; no inventar. |
| Email de banco con comercio ambiguo | Crear pendiente con sugerencia, no registrar. |
| Netflix mensual detectado | Subcategoria `netflix`, etiqueta `recurrente`, candidato a Recurring Engine. |
| Usuario corrige "taxi" a "Uber de trabajo" | Actualizar subcategoria y etiqueta; aprender si se repite. |
| "Otros" usado muchas veces con mismo comercio | Sugerir subcategoria o revisar categoria. |

---

## 21. Out of scope V1

Queda fuera de V1:

- presupuestos formales por categoria,
- metas/limites por categoria como feature completa,
- contabilidad tributaria,
- split detallado por productos dentro de una boleta,
- categorias compartidas globalmente entre usuarios,
- marketplace de taxonomias,
- reglas avanzadas por empresa,
- OCR de recibos con line items.

Si luego existe una feature formal de metas/limites, podra usar categorias y subcategorias como dimensiones:

```text
Limite de cafe mensual
Limite de delivery semanal
Meta de reducir transporte por app
```

Por ahora eso vive como hook extensible, no como promesa completa de V1.

---

## 22. Escenarios de prueba

### Escenario 1: gasto simple

```text
Gasté 8 en café.
```

Debe producir:

- `movement_type: gasto`,
- `category_id: alimentacion`,
- `subcategory: cafe`,
- categoria editable,
- sin pregunta innecesaria.

### Escenario 2: gasto multiple

```text
Hoy gasté 8 café, 15 taxi y 20 almuerzo.
```

Debe crear tres movimientos con clasificacion separada.

### Escenario 3: correccion de categoria

```text
No era taxi, era Uber de trabajo.
```

Debe actualizar subcategoria y etiqueta, y aprender el patron si corresponde.

### Escenario 4: prestamo

```text
Eso no fue gasto, fue préstamo a Luis.
```

Debe cambiar el tipo a `prestamo_dado`. La categoria no debe tapar el movimiento real.

### Escenario 5: devolucion

```text
Me pagaron lo que me debía Ana.
```

Debe registrar `devolucion_recibida` y vincular persona/deuda si existe.

### Escenario 6: deuda

```text
Pagué la cuota de la tarjeta.
```

Debe activar Debt Engine. Categoria `deudas` es secundaria.

### Escenario 7: busqueda natural

```text
¿Cuánto gasté en café el último viernes?
```

ConversationAgent debe consultar movimientos por fecha y subcategoria, no depender de contexto cargado completo.

### Escenario 8: email

Email de Yape o banco detectado.

Debe crear pendiente con categoria sugerida y pedir aprobacion.

### Escenario 9: recurrente

Netflix detectado por patron mensual.

Debe sugerir subcategoria `netflix`, etiqueta `recurrente` y candidato a Recurring Engine.

### Escenario 10: sin clasificar

```text
Gasté 40 en eso de ayer.
```

Si no hay contexto suficiente, guardar como `category_id: null` + `needs_review` o pedir aclaracion si el movimiento no es claro.

---

## 23. Criterios de aceptacion

- Las 12 categorias base estan definidas con IDs canonicos.
- `otros` y `sin clasificar` no se mezclan.
- Subcategorias son por usuario y no globales.
- Etiquetas son corregibles y no bloquean registro.
- La IA no puede crear categorias base nuevas.
- Correcciones alimentan Learning Engine.
- Dashboard puede filtrar y editar categoria/subcategoria/etiquetas.
- WhatsApp puede registrar y corregir clasificaciones.
- Email crea pendientes con sugerencia, no registros automaticos.
- Deudas, prestamos, transferencias y asignaciones internas no se deforman para entrar en categorias de gasto.
- Modo discreto y Risk Policy protegen categorias/etiquetas sensibles.
- El sistema soporta busqueda natural usando herramientas read-only.

---

*Feature 6-7/10 del Paso 5 - V2*
