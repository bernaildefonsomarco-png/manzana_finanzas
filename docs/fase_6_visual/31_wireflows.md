# 31 - WireFlows

**Fase:** 6 - Visual  
**Estado:** V1  
**Ultima actualizacion:** 5 de junio, 2026  
**Inputs:** Doc 14 (21 flujos usuario), Doc 30 (App Flow con estados), Doc 17 (dashboard UX)

---

## 1. Formato de documentación

Cada flujo usa el siguiente formato por paso:

```
Paso N: [nombre]
  Pantalla: [ID del App Flow]
  Estado visual: [qué ve el usuario]
  Interacción: [qué hace el usuario]
  Evento: [qué dispara la transición]
  → Éxito: [siguiente paso]
  → Error [tipo]: [pantalla/estado + cómo recuperar]
  → Carga: [qué se muestra mientras procesa]
  → Discreto: [qué cambia si modo discreto activo]
  → Cancelar: [qué pasa si el usuario sale]
```

---

## 2. Flujo 1 — Registro simple por WhatsApp

**Canal principal:** WhatsApp (fuera del Dashboard)  
**Resultado esperado:** Movimiento confirmado aparece en MOVEMENTS y badge de HOME actualiza

### Happy path

```
Paso 1: Usuario envía mensaje a WhatsApp
  Pantalla: N/A (WhatsApp nativo)
  Estado visual: Chat de WhatsApp abierto con Manzana
  Interacción: Escribe "gaste 8 en cafe" y envía
  Evento: Mensaje recibido por webhook
  → Éxito: Paso 2

Paso 2: Manzana confirma el registro
  Pantalla: N/A (respuesta en WhatsApp)
  Estado visual: "Listo. Café S/8 registrado."
  Interacción: Usuario lee confirmación
  Evento: Respuesta enviada
  → Éxito: Paso 3 (si abre Dashboard) o flujo termina

Paso 3: Movimiento aparece en Dashboard
  Pantalla: MOVEMENTS o HOME
  Estado visual: Nueva fila en MOVEMENTS; HOME muestra movimiento reciente
  Interacción: Usuario puede ver o editar
  Evento: Sincronización en background
```

### Error

```
→ Error (monto faltante):
  Manzana responde: "¿Cuánto fue el café?"
  Usuario responde con monto → continúa happy path

→ Error (ambigüedad tipo): 
  Manzana: "¿Fue gasto o préstamo?"
  Usuario responde → continúa

→ Error (API caída):
  Manzana: "No pude registrarlo ahora. ¿Lo intentamos de nuevo?"
  Si sí: reintento → happy path
  Si no: flujo cancelado, nada persiste

→ Error (cuenta no existe):
  Se registra con account_id = null
  No bloquea el registro
  Manzana puede sugerir crear la cuenta después
```

### Primera vez

```
Paso 1 igual. En el Dashboard, la primera fila de MOVEMENTS aparece con:
  - Badge "¡Primer registro!" — solo si es el primer movimiento del usuario
  - Empty state de HOME desaparece y muestra estado "Temprano"
```

### Carga

```
Al abrir MOVEMENTS o HOME después del registro:
  Skeleton brief (300ms) → datos actualizados
  Si recálculo de saldo fue necesario: banner "Actualizando tus resúmenes…" (se va automáticamente)
```

### Modo discreto

```
La confirmación de WhatsApp cambia de:
  "Café S/8 registrado."
a:
  "Listo. Movimiento registrado."
  (sin monto ni descripción en el mensaje proactivo)
```

---

## 3. Flujo 2 — Registro múltiple por WhatsApp

### Happy path

```
Paso 1: Usuario envía múltiples ítems
  Interacción: "hoy gasté 8 café, 15 taxi y 20 almuerzo"
  → Éxito: Paso 2

Paso 2: Manzana confirma todos
  Respuesta: "Listo. Registré 3 gastos: café S/8, taxi S/15 y almuerzo S/20."
  → Éxito: 3 movimientos en MOVEMENTS

Paso 3: Dashboard muestra todos
  MOVEMENTS: 3 nuevas filas agrupadas por fecha
```

### Error

```
→ Error (uno ambiguo):
  "Registré café S/8 y almuerzo S/20. Del taxi no estoy seguro del monto. ¿Cuánto fue?"
  Usuario responde → se registra el taxi también
  Los dos ya confirmados no se vuelven a confirmar

→ Error (API parcial):
  Los que se guardaron quedan; el que falló genera pendiente o nuevo intento
  Manzana informa cuáles se guardaron: "Guardé 2 de 3."
```

### Modo discreto

```
Confirmación: "Listo. Registré 3 movimientos." (sin montos ni descripciones)
```

---

## 4. Flujo 3 — Registro manual desde Dashboard

### Happy path

```
Paso 1: Abrir formulario
  Pantalla: HOME o MOVEMENTS
  Interacción: Tap en "Nuevo movimiento" o FAB "+"
  → Éxito: MOVEMENT_NEW se abre (modal desktop / drawer mobile)

Paso 2: Seleccionar tipo
  Pantalla: MOVEMENT_NEW
  Estado visual: Select "Tipo de movimiento" con lista de 11 tipos
  Interacción: Selecciona "Gasto"
  Evento: onChange en select → campos condicionales aparecen
  → Éxito: Paso 3

Paso 3: Completar campos
  Monto: "S/ 8"
  Cuenta: "Yape" (select con opciones existentes + "Nueva cuenta")
  Categoría: "Alimentación" (select)
  Descripción: "Café antes de la oficina"
  Fecha: "Hoy" (por defecto, editable)
  → Éxito: Paso 4

Paso 4: Ver impacto
  Estado visual: Bloque de impacto: "Sale de Yape y afecta dinero libre."
  Interacción: Usuario revisa
  → Éxito: Paso 5

Paso 5: Guardar
  Interacción: Tap "Guardar"
  Evento: API POST /movements
  → Carga: Botón en loading, campos bloqueados (250ms typical)
  → Éxito: Modal cierra, toast "Movimiento guardado.", MOVEMENTS y HOME recargan
```

### Error

```
→ Error validación (monto vacío):
  Campo monto resaltado en rojo: "El monto es requerido."
  Usuario puede corregir y reintentar, formulario permanece abierto

→ Error API (500):
  Toast error: "No pude guardar. Intenta de nuevo."
  Formulario permanece abierto con datos intactos

→ Error duplicado detectado:
  Banner warning: "Este movimiento parece similar a uno del 14 de mayo. [Ver]"
  Usuario puede ignorar y guardar igual, o ver el duplicado y cancelar

→ Error timeout:
  Toast warning: "Tardó más de lo esperado. Puedes reintentar o cerrar."
  Botón "Reintentar" visible
```

### Primera vez

```
Si no hay cuentas creadas:
  Select de cuenta muestra solo "Nueva cuenta" y opción null ("No especificar")
  Después de guardar: prompt suave "¿Quieres crear tu primera cuenta para ordenar mejor tus saldos?" 
  → botón "Crear cuenta" (opcional) o "Luego" (no bloquea)
```

### Carga

```
Al abrir el formulario: campos aparecen inmediatamente (sin loading)
Al cargar sugerencias de categoría (IA): skeleton en el select de categoría por 200ms
Al guardar: botón spinner + campos disabled
```

### Modo discreto

```
Formulario funciona igual (dashboard autenticado)
Bloque de impacto: "Afecta tu balance." (sin monto específico en el resumen visible)
```

### Cancelar

```
Tap en "Cancelar" o Escape (desktop) o swipe-down (drawer mobile):
  Si el formulario está vacío → cierra sin preguntar
  Si hay datos completados → MODAL_CONFIRM "¿Descartar este movimiento?" 
  [Descartar] = cierra sin guardar
  [Seguir editando] = regresa al formulario
```

---

## 5. Flujo 4 — Corrección de movimiento

### Happy path (desde Dashboard)

```
Paso 1: Abrir detalle
  Pantalla: MOVEMENTS → MOVEMENT_DETAIL
  Interacción: Tap en fila, tap en "Editar"
  → Éxito: MOVEMENT_EDIT se abre

Paso 2: Modificar campo
  Interacción: Cambia categoría de "Transporte" a "Transporte > Uber de trabajo"
  → Éxito: Paso 3

Paso 3: Guardar corrección
  Tap "Guardar"
  → Carga: Botón loading
  → Éxito: Modal cierra, toast "Movimiento actualizado.", fila en MOVEMENTS actualiza
  → Recálculo: si el cambio afecta saldo, banner "Actualizando resúmenes…" en HOME/MY_MONEY
```

### Happy path (desde WhatsApp)

```
Paso 1: Usuario escribe corrección
  "eso no fue taxi, fue Uber de trabajo"
  → FinancialOrchestrator + CorrectionAgent identifican movimiento referenciado
  → Corrección simple: aplica directamente
  → Manzana: "Corregido. Lo cambié a Uber de trabajo."
  → Dashboard: fila actualizada, badge "Corregido" visible

Paso 2 (si afecta tipo financiero):
  "eso no fue gasto, fue préstamo a Luis"
  → Manzana: "Suena a préstamo a Luis. ¿Lo cambio así?"
  → Usuario: "Sí"
  → Corrección aplicada, deuda creada, movimiento actualizado
```

### Error

```
→ Error (referencia ambigua "eso"):
  Manzana: "¿Te refieres al taxi del 14 de mayo por S/15?"
  Usuario confirma o aclara → aplica corrección

→ Error API al guardar:
  Toast error, formulario permanece con datos
  → reintentar o cancelar

→ Error (corrección crea inconsistencia):
  Banner warning en MOVEMENT_EDIT: "Cambiar este tipo afecta el saldo de tu cuenta."
  Usuario debe confirmar explícitamente antes de guardar
```

### Modo discreto

```
WhatsApp: "Corregido." (sin detalles del movimiento)
Dashboard: funciona igual (autenticado)
```

---

## 6. Flujo 5 — Borrar, cancelar o deshacer

### Borrar movimiento (happy path)

```
Paso 1: Activar borrado
  Pantalla: MOVEMENT_DETAIL
  Interacción: Tap "Borrar"
  → Éxito: MODAL_RISK abre

Paso 2: Modal de riesgo
  Estado: "¿Confirmas borrar? Taxi S/15 · 14 de mayo. Esta acción no se puede deshacer."
  Botones: [Cancelar] (secondary) | [Sí, borrar] (danger)
  → Cancelar: modal cierra, MOVEMENT_DETAIL permanece
  → Confirmar: Paso 3

Paso 3: Ejecutar borrado
  → Carga: spinner en modal, botones disabled
  → Éxito: modal cierra, toast "Movimiento eliminado.", regresa a MOVEMENTS
  → Recálculo si afecta saldo: banner en HOME/MY_MONEY
  → Audit log registrado
```

### Borrar múltiples (batch)

```
Selección múltiple en MOVEMENTS:
  Checkbox aparece en cada fila al activar modo selección
  [N seleccionados] barra de acciones aparece en fondo
  Tap en "Borrar seleccionados" → MODAL_RISK con lista de ítems
  Confirmar → todos se borran + toast "N movimientos eliminados"
```

### Error

```
→ Error API al borrar:
  Toast error: "No pude eliminar. Intenta de nuevo."
  MODAL_RISK permanece abierto o reabre desde MOVEMENT_DETAIL
```

---

## 7. Flujo 6 — Pendientes de email

### Happy path

```
Paso 1: Email detectado (background)
  Sistema: Email Adapter detecta email financiero permitido
  Resultado: Pendiente creado en inbox, badge de PENDING +1
  WhatsApp (si opt-in): "Detecté un movimiento de Yape por S/45 en Restaurante. ¿Lo registro?"

Paso 2: Usuario revisa en PENDING
  Pantalla: PENDING
  Estado visual: Fila de pendiente con badge "Por revisar"
  Interacción: Tap en fila → PENDING_DETAIL (drawer mobile / modal desktop)
  Estado: fuente (email), fecha, monto, comercio, acción sugerida, "No afecta saldo"

Paso 3: Confirmar pendiente
  Interacción: Tap "Confirmar"
  → Carga: botón loading
  → Éxito: movimiento creado, pendiente removido de lista, toast "Movimiento registrado desde email."
  → MOVEMENTS actualiza

Paso 3 (alternativa): Editar antes de confirmar
  Tap "Editar" → MOVEMENT_NEW pre-cargado con datos del email
  Usuario ajusta → Guardar → mismo resultado que paso 3

Paso 3 (alternativa): Rechazar
  Tap "Rechazar" → toast "Ignorado. No afectará tus registros."
  Pendiente removido de lista
  Audit log registrado (rejections también se loguean)

Paso 3 (alternativa): "Ya lo registré"
  Tap "Ya lo registré" → sistema busca duplicado probable
  Si encuentra: confirma match y descarta pendiente
  Si no encuentra: pregunta cuál movimiento coincide o descarta de todos modos
```

### Error

```
→ Error (email mal parseado):
  Pendiente muestra "Algunos datos no están claros. Revísalo antes de confirmar."
  Campos con baja confianza marcados con ícono de advertencia
  Usuario puede editar todos antes de confirmar

→ Error API al confirmar:
  Toast error, pendiente permanece en lista para reintentar

→ Batch de emails (múltiples similares):
  PENDING muestra sección "N similares" con botón "Revisar en grupo"
  Modal/pantalla de batch review con lista
  Acciones por ítem + "Confirmar todos" + "Rechazar todos"
```

### Primera vez

```
Si el usuario nunca conectó email:
  PENDING muestra estado vacío con mensaje: "Conecta tu Gmail para que Manzana detecte movimientos automáticamente. Siempre te pregunto antes de registrar."
  CTA: "Conectar Gmail" → SETTINGS > Email
```

### Modo discreto

```
WhatsApp notificación: "Detecté un movimiento para revisar. ¿Quieres verlo?"
  (sin monto, sin comercio, sin banco)
PENDING: card muestra "Movimiento de email" sin monto/comercio hasta que usuario abre
```

---

## 8. Flujo 7 — Consulta financiera (WhatsApp)

### Happy path

```
Paso 1: Usuario pregunta
  "¿Cuánto gasté ayer?"
  → Éxito: Paso 2

Paso 2: Manzana responde
  "Ayer registraste S/43 en 3 movimientos: café, taxi y almuerzo."
  → Fin del flujo (read-only)

Variante (dashboard):
  SEARCH: "gastos de ayer" → panel de resultados con total + lista de movimientos filtrados
```

### Error

```
→ Error (faltan datos):
  "Puedo ayudarte, pero me falta tu saldo actual. Si me dices cuánto tienes disponible, lo calculo mejor."
  → Usuario provee saldo → nuevo intento de respuesta

→ Error (IA no puede responder):
  "No pude calcular eso con seguridad ahora. Puedes ver tus movimientos en el Dashboard."
  → No inventa datos

→ Error (modo discreto):
  Si la respuesta incluiría dato sensible: responde sin ese dato + nota: "Hay detalles que no puedo incluir en este mensaje."
```

---

## 9. Flujo 8 — Búsqueda natural Dashboard

### Happy path

```
Paso 1: Activar búsqueda
  Pantalla: cualquier pantalla con topbar
  Interacción: Tap en ícono búsqueda → SEARCH activa
  Estado visual: Input con placeholder "Pregunta algo sobre tu dinero…"

Paso 2: Escribir consulta
  "gastos de transporte en abril"
  Evento: submit (Enter o tap en ícono)

Paso 3: Ver resultados
  Panel de resultados:
    - Resultado rápido: "Gastaste S/120 en transporte en abril. [Ver movimientos]"
    - Lista de movimientos filtrados
    - Pendientes relacionados si los hay

Paso 4: Navegar a resultado
  Tap en "Ver movimientos" → MOVEMENTS pre-filtrado por categoría=Transporte, mes=abril
```

### Error

```
→ Sin resultados:
  "No encontré movimientos sobre eso."
  "También hay 1 pendiente sin confirmar. [Revisar]"

→ Intento de acción de escritura:
  "borra el taxi de ayer" →
  "Para borrar un movimiento, ábrelo y confirma la acción. [Ver taxi de ayer →]"
  No ejecuta ninguna escritura

→ Error IA:
  "No pude procesar esa búsqueda. Puedes filtrar manualmente."
  Busqueda textual básica como fallback

→ Timeout:
  Spinner por máx 5 segundos, luego: "Tardó más de lo esperado. [Intentar de nuevo]"
```

### Modo discreto

```
Resultados: montos en •••
Respuesta rápida: "Tuviste gastos en transporte en abril." (sin monto)
```

---

## 10. Flujo 9 — Deuda nueva

### Happy path (WhatsApp)

```
Paso 1: "le debo 50 a Luis"
  → Manzana: "Lo anoto como deuda con Luis por S/50. ¿Quieres agregar fecha o lo dejamos sin fecha?"
  → Usuario: "sin fecha"
  → Deuda creada, movimiento tipo deuda_adquirida creado
  → Respuesta: "Listo. Deuda con Luis por S/50 registrada."

Paso 2 (Dashboard): DEBTS actualiza con nueva deuda
```

### Happy path (Dashboard)

```
Paso 1: DEBTS → tap "Crear deuda"
  → MOVEMENT_NEW pre-cargado con tipo "deuda_adquirida"
  Campos: Persona/entidad (req.), Monto, Condiciones (opcional), Fecha límite (opcional)

Paso 2: Guardar
  → Deuda creada, aparece en DEBTS con estado "Activa"
```

### Error

```
→ Ambigüedad (regalo vs. deuda):
  Manzana: "¿Fue préstamo a Luis o le regalaste el dinero?"
  Usuario responde → registra según tipo

→ Error API:
  Toast error, formulario permanece con datos

→ Deuda sin monto:
  No se puede crear deuda sin monto. Campo requerido siempre.
```

### Primera vez

```
Si nunca usó Deudas:
  DEBTS muestra empty state con texto positivo
  Después de primera deuda: contexto "Esta deuda no cuenta como gasto. Manzana la trackea por separado."
```

---

## 11. Flujo 10 — Pago de deuda / devolución

### Happy path

```
Paso 1: "pagué 30 de lo de Luis" (WhatsApp) o tap "Registrar pago" en DEBT_DETAIL
  → Tipo: pago_deuda, Deuda vinculada: Luis, Monto: S/30

Paso 2: Confirmación
  WhatsApp: "Listo. Reduje tu deuda con Luis en S/30. Queda S/20."
  Dashboard: toast + DEBTS actualiza progreso

Paso 3 (si el pago cierra la deuda):
  DEBT_DETAIL muestra badge "Saldada"
  Opcional: "¿Quieres cerrar esta deuda?" → MODAL_CONFIRM
```

### Error

```
→ Múltiples deudas con Luis:
  "Tienes 2 deudas con Luis. ¿A cuál aplica este pago?"
  Lista de opciones → usuario elige → continúa

→ Sobrepago:
  "Este pago supera la deuda (S/20 restante). Corrige el monto para continuar."
  V1 bloquea Guardar; no crea movimiento ni actualiza deuda/cuotas

→ Pago sin cuenta definida:
  Deuda se actualiza, pero saldo por cuenta no cambia (se registra con account_id = null)
  Nota en el detalle: "El pago no especificó cuenta; el saldo por cuenta no se actualizó."
```

---

## 12. Flujo 11 — Pago que viene

### Happy path (sugerido por sistema)

```
Paso 1: Sistema detecta patrón
  Background: Recurring Engine detecta Netflix 3 meses seguidos
  WhatsApp (opt-in): "Netflix suele pagarse esta semana. ¿Quieres marcarlo como pago que viene?"

Paso 2: Usuario confirma
  WhatsApp: "sí" o tap "Confirmar" en UPCOMING (sugerido)
  → Pago que viene creado, estado "Activo"
  → Aparece en UPCOMING con próxima fecha estimada

Paso 3: Cuando llega la fecha
  Push / WhatsApp: "Netflix está próximo. ¿Lo marcas como pagado?"
  Dashboard: badge en UPCOMING si está vencido
```

### Happy path (creado manualmente)

```
UPCOMING → tap "Agregar pago"
  → Formulario: Nombre, Monto (o estimado), Fecha (día del mes o rango)
  → Guardar → aparece como "Activo"
```

### Error

```
→ Usuario rechaza sugerencia:
  "Ignorar" → sugerencia desaparece, sistema no vuelve a sugerir este en 30 días

→ Cambio de monto detectado:
  "El monto de Netflix cambió de S/33 a S/35. ¿Confirmas la actualización?"
  Si sí: actualiza, si no: mantiene monto anterior con nota de diferencia

→ Error API al marcar pagado:
  Toast error, estado no cambia, Retry disponible
```

---

## 13. Flujo 12 — Recordatorio

### Happy path

```
Condiciones previas verificadas:
  - Opt-in activo para este tipo de recordatorio
  - Horario permitido (no horario silencioso)
  - Frecuencia disponible (no spam)
  - Modo discreto evaluado

Paso 1: Sistema envía recordatorio
  WhatsApp normal: "Tu cuota de tarjeta vence esta semana. ¿Quieres revisarla?"
  Modo discreto: "Tienes un compromiso próximo para revisar."
  Dashboard (nudge): card en HOME con próximo compromiso

Paso 2: Usuario actúa o ignora
  Actúa → navega al ítem relevante → flujo correspondiente
  Ignora → recordatorio se descarta, no se repite en la misma sesión
  "No me avises" → opt-out guardado para este tipo
```

### Error

```
→ Usuario responde "no me avises":
  Opt-out guardado, confirmación: "Listo. No te enviaré recordatorios de cuotas."
  Configurable de vuelta en SETTINGS

→ Recordatorio en horario incorrecto (edge case sistema):
  Se encola y envía en la próxima ventana permitida, no de inmediato
```

---

## 14. Flujo 13 — Descubrimiento

### Happy path

```
Paso 1: Sistema genera insight
  Background: InsightEngine detecta patrón con evidencia suficiente
  Umbral mínimo: 5 movimientos confirmados

Paso 2: Insight aparece en Dashboard
  HOME: card de descubrimiento destacado (máx. 1)
  DISCOVERIES: lista completa

Paso 3: Usuario interactúa
  Tap "Ver movimientos" → MOVEMENTS pre-filtrado
  Tap "Ignorar" → card desaparece, no vuelve a mostrarse ese insight
  WhatsApp (solo si hay opt-in y baja saturación): texto discreto del insight
```

### Error

```
→ Insight desactualizado por corrección:
  Card muestra badge "Actualizado" o desaparece si ya no es válido
  No se muestra dato viejo como verdad

→ Sin datos suficientes:
  DISCOVERIES muestra estado vacío: "Todavía no hay datos suficientes para notar cambios útiles."
  No se inventa insight débil
```

### Modo discreto

```
Insight con monto: "Tu gasto en transporte cambió." (sin monto específico)
WhatsApp: no se envía si el insight contiene datos sensibles sin opt-in explícito
```

---

## 15. Flujo 14 — Ayuda y explicación

### Happy path

```
Paso 1: Usuario pregunta
  WhatsApp: "¿cómo registro una deuda?"
  Dashboard SEARCH: "¿cómo funciona dinero libre?"

Paso 2: Manzana responde brevemente
  WhatsApp: "Puedes escribirlo natural: 'le debo 50 a Luis'. Si quieres, también puedes agregar fecha."
  Dashboard: respuesta inline + CTA "Ir a Deudas"

Paso 3: Acción pequeña disponible
  Usuario puede actuar directamente o seguir en flujo correspondiente
```

### Error

```
→ IA no entiende la pregunta:
  "No estoy seguro de entenderte. ¿Quieres registrar algo, buscar un movimiento o entender cómo funciona algo?"
  Opciones accionables, no "No entendí"
```

---

## 16. Flujo 15 — Modo discreto

### Activar

```
Paso 1: WhatsApp: "activa modo discreto" / Dashboard: SETTINGS > Privacidad > toggle
Paso 2: Manzana: "Listo. En mensajes proactivos ocultaré montos, comercios, bancos, personas y saldos."
Paso 3: Toggle activo en SETTINGS. Cambio inmediato en todos los canales proactivos.
```

### Desactivar

```
Paso 1: WhatsApp: "desactiva modo discreto" / Dashboard: toggle OFF
Paso 2: Confirmación: "Listo. Los mensajes proactivos volverán a incluir detalle."
```

### Error

```
→ Error al guardar preferencia:
  Toast error. El toggle regresa a su estado anterior. Retry disponible.
```

---

## 17. Flujo 16 — Reconstrucción con datos incompletos

### Happy path

```
Paso 1: "creo que ayer gasté en taxi y comida pero no recuerdo cuánto"
  → Manzana: "Puedo ayudarte a reconstruirlo. ¿Recuerdas al menos un monto aproximado o dónde fue?"

Paso 2: Usuario da pista parcial
  "el taxi fue como 15 creo"
  → Manzana: "¿Lo registro como S/15 de taxi?"

Paso 3: Confirma o ajusta → movimiento creado
  Comida sin monto → Pendiente abierto: "Tienes un gasto de comida sin monto por confirmar."
```

### Error

```
→ Ningún dato suficiente:
  "No puedo crear un movimiento sin monto. Si lo recuerdas después, escríbeme."
  No crea movimiento con datos inventados

→ Email relacionado posible:
  "¿Revisaste si tienes un email de Yape o similar de ayer? Tengo un pendiente que podría coincidir."
```

---

## 18. Flujo 17 — Cuenta o caja desde el uso

### Happy path (cuenta)

```
Paso 1: "gasté 20 con Plin"
  → Movimiento registrado. Manzana: "Listo. Plin no está creado como cuenta. ¿Quieres agregarlo?"

Paso 2: Usuario confirma → cuenta Plin creada, movimiento vinculado retroactivamente
  O: "Luego" → movimiento queda con account_id = null
```

### Happy path (caja)

```
Paso 1: "separa 200 para emergencia"
  → Manzana: "¿En qué cuenta quieres separarlo?"

Paso 2: Usuario especifica: "de Yape"
  → Asignación interna registrada, caja "Emergencia" creada o existente actualizada
  → Dashboard MY_MONEY actualiza desglose
```

### Error

```
→ Cuenta sin saldo suficiente para la caja:
  "Yape tiene S/150. ¿Quieres separar solo eso o agregar desde otra cuenta?"
  No ejecuta sin confirmar
```

---

## 19. Flujo 18 — Clasificación, subcategorías y etiquetas

### Happy path

```
Caso 1 (corrección de categoría):
  "el taxi de ayer era de trabajo"
  → Manzana: "Listo. Lo marqué como transporte con etiqueta trabajo."
  → Movimiento actualizado, Learning Engine registra patrón

Caso 2 (categoría dudosa en registro):
  Registro con baja confianza → classification_status = needs_review
  En MOVEMENTS: badge amarillo "Por revisar" en la fila
  Usuario tap "Por qué" → "Puse 'Otros' porque no estaba seguro. ¿Puedes precisarlo?"
  Usuario corrige → badge desaparece, Learning Engine aprende
```

### Error

```
→ Subcategoría duplicada intentada:
  "Ya existe 'Transporte > Taxi'. ¿Quieres usarla?"
  No crea duplicados automáticamente
```

---

## 20. Flujo 19 — Transferencia, asignación interna y ajuste

### Transferencia happy path

```
Paso 1: "pasé 100 de BCP a Yape" / Dashboard: Nuevo movimiento tipo "transferencia"
  Campos: Cuenta origen (BCP), Cuenta destino (Yape), Monto (S/100)
  → Éxito: Registro, BCP −100, Yape +100, dinero libre sin cambio
  → Movimiento no aparece como "gasto" en filtros estándar

Paso 2: Confirmación en ambas cuentas refleja en MY_MONEY
```

### Ajuste de saldo happy path

```
Paso 1: "mi Yape en realidad tiene 120"
  → Manzana: "Ajusto el saldo de Yape a S/120. ¿Confirmas?"

Paso 2: Confirmación → MODAL_CONFIRM o respuesta "sí" en WhatsApp
  → Ajuste registrado con audit log
  → MY_MONEY actualiza
```

### Error

```
→ Transferencia sin origen o destino:
  Dashboard: campos requeridos marcados en rojo
  WhatsApp: "Para la transferencia, ¿de qué cuenta a qué cuenta?"

→ Ajuste crea saldo negativo:
  Warning visible: "Yape quedaría con saldo negativo (−S/30). ¿Confirmas?"
  No bloquea, pero requiere confirmación explícita
```

---

## 21. Flujo 20 — Configuración y preferencias

### Happy path

```
Pantalla: SETTINGS
  Secciones: Privacidad (modo discreto), Recordatorios (por tipo, horario silencioso), Email (conectar/desconectar), Datos y memoria

Cada toggle/acción:
  → Cambio inmediato con spinner en el control afectado
  → Toast confirma: "Recordatorios de pagos pausados."
  → Preferencias reversibles: mismo toggle para deshacer
```

### Error

```
→ Error al guardar preferencia:
  Toast error. Control regresa a estado anterior.
  No existe estado inconsistente

→ Desconectar email:
  MODAL_CONFIRM: "¿Desconectar Gmail? No seguiré detectando movimientos nuevos. Los ya confirmados se conservan."
  Confirmar → conexión cortada
  Los pendientes de email abiertos se archivan; los ya confirmados se conservan
```

---

## 22. Flujo 21 — Detalle, fuente y explicabilidad

### Happy path

```
Paso 1: Usuario abre detalle de movimiento
  Pantalla: MOVEMENT_DETAIL
  Muestra: tipo, monto, fecha, categoría, fuente, estado, confianza, impacto, acciones

Paso 2: Usuario toca "¿Por qué?"
  Panel se expande: texto original, evidencia resumida, límites del sistema
  "Texto original: 'gaste 15 taxi'. Evidencia: monto + palabra taxi."
  "Puedes corregirlo si no era así."

Paso 3 (WhatsApp):
  "¿de dónde salió ese gasto?"
  → "Vino de un email detectado y lo confirmaste por WhatsApp el 14 de mayo."
```

### Error

```
→ Fuente ya no disponible (email borrado):
  "La fuente original ya no está disponible. El dato fue confirmado el 14 de mayo."
  No rompe el movimiento; solo indica ausencia de evidencia original
```

### Modo discreto

```
Panel "¿Por qué?" funciona igual en dashboard autenticado
WhatsApp: "Este movimiento fue registrado por ti." (sin fuente detallada si es sensible)
```

---

## 23. Flujos transversales

### 23.1 Onboarding completo (primer acceso → primer valor)

```
AUTH_LOGIN
  → nuevo usuario → ONBOARDING_WELCOME
  → tap "Empezar" → ONBOARDING_WHATSAPP
    Instrucción: "Guarda este número en tu celular: +51 XXX XXX XXX como 'Manzana'"
    CTA: "Ya lo guardé" / "¿Cómo funciona?"
  → ONBOARDING_FIRST_MOVE
    CTA principal: "Registrar mi primer movimiento" → MOVEMENT_NEW
    CTA secundario: "Prefiero hacerlo por WhatsApp" → instrucción de mensaje
  → ONBOARDING_EMAIL_OPT (opcional, puede omitirse)
    "Conectar Gmail para detección automática" / "Luego" (skip sin fricción)
  → ONBOARDING_COMPLETE
    "Manzana está lista. Todo lo que registres aparecerá aquí."
    → HOME (estado Temprano o Empty según si registró algo)
```

### 23.2 Login / Re-autenticación

```
Sin sesión → AUTH_LOGIN
  Input: Número de WhatsApp o email
  Tap "Continuar" → AUTH_VERIFY
    Input: Código de 6 dígitos enviado por WhatsApp o SMS
    Reenviar: "No recibí el código [Reenviar en 30s]"
    Éxito: → HOME (si ya registrado) o ONBOARDING_WELCOME (si nuevo)
    Error código incorrecto: "Código incorrecto. [Reintentar]" (máx 3 intentos)
    Error límite: "Demasiados intentos. Intenta en 10 minutos."
```

### 23.3 Sesión expirada durante uso

```
Usuario tiene el Dashboard abierto → sesión expira
  Overlay AUTH_SESSION_EXPIRED aparece sobre el contenido (datos no visibles debajo)
  Mensaje: "Tu sesión expiró. Ingresa de nuevo para continuar."
  CTA: "Volver a ingresar" → AUTH_LOGIN inline o redirect
  Éxito: overlay desaparece, usuario regresa a la pantalla donde estaba
  Estado del formulario: si había un formulario abierto, se perdió (Warning previo no obligatorio en V1)
```

### 23.4 Llegada desde entry point externo

```
Push notification → tap → app abre
  Con sesión: → pantalla destino de la notificación
  Sin sesión: → AUTH_LOGIN → (post-login) → pantalla destino

WhatsApp deeplink → tap
  Con sesión: → HOME
  Sin sesión: → AUTH_LOGIN → HOME

Email link de confirmación de pendiente → tap
  Con sesión: → PENDING_DETAIL del ítem específico
  Sin sesión: → AUTH_LOGIN → PENDING_DETAIL del ítem específico
  Ítem ya resuelto: → PENDING con mensaje "Este pendiente ya fue resuelto."

Bookmark / link directo
  Con sesión: → pantalla correspondiente
  Sin sesión: → AUTH_LOGIN → pantalla original
```

---

## 24. Criterios de aceptación

- Los 21 flujos de Doc 14 están documentados con happy path completo.
- Cada flujo tiene camino de error, carga, primera vez, modo discreto y cancelación.
- Cada paso especifica pantalla del App Flow, estado visual, interacción y evento.
- Las bifurcaciones (ambigüedades, duplicados, confirmaciones) están todas mapeadas.
- Los 4 flujos transversales (onboarding, login, sesión expirada, entry points externos) están completos.
- No existe paso que deje al usuario sin camino de recuperación.
- No existe paso que invente datos o ejecute escrituras sin confirmación del usuario.
- Modo discreto está especificado en los flujos donde aplica.

---

*Fase 6 Visual - Documento 31 - V1*
