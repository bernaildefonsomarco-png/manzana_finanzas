# UX del Dashboard V1

**Documento:** `17_dashboard_ux.md`  
**Fase:** 3 - Producto / Experiencia  
**Estado:** V1.1  
**Ultima actualizacion:** 25 de mayo, 2026

---

## 1. Tesis

El Dashboard de Manzana no es el lugar donde el usuario "hace contabilidad". Es el lugar donde recupera claridad, control y confianza cuando quiere ver su dinero con mas calma que en WhatsApp.

WhatsApp captura y conversa. Dashboard ordena, explica, corrige y muestra el panorama.

La experiencia debe hacer sentir:

> "Puedo entender que paso con mi dinero, corregirlo si algo esta mal y seguir sin tener que configurar todo perfecto."

El Dashboard debe ser util incluso si el usuario:

- solo registro pocos movimientos,
- no tiene cuentas completas,
- usa solo deudas,
- usa solo email/pendientes,
- vuelve despues de tiempo,
- prefiere revisar sin recibir mensajes proactivos.

---

## 2. Rol Del Dashboard

| Superficie | Rol |
|---|---|
| WhatsApp | Captura rapida, conversacion, confirmaciones, correcciones y recordatorios. |
| Dashboard | Revision visual, control, historial, explicabilidad, registro manual y configuracion progresiva. |
| Email Parsing | Deteccion pasiva que siempre entra a Pendientes. |
| Motor IA | Busqueda natural, explicaciones, preguntas financieras y narrativa de descubrimientos. |
| Core financiero | Fuente de verdad para movimientos, saldos, cuentas, cajas, deudas y pagos que vienen. |

Reglas:

- Dashboard no reemplaza a WhatsApp como flujo principal de captura.
- Dashboard si debe permitir registrar manualmente cuando el usuario ya esta revisando.
- Dashboard no debe mostrar datos sin fuente, estado o posibilidad de correccion.
- Dashboard no debe mezclar pendientes con movimientos confirmados sin marcar estado.
- Dashboard no debe usar IA para calculos finales de dinero.

---

## 3. Sensacion Esperada

El Dashboard debe sentirse:

- tranquilo,
- escaneable,
- util en menos de 10 segundos,
- confiable,
- corregible,
- progresivo,
- menos "panel financiero" y mas "mi dinero en claro".

Debe evitar sentirse:

- como Excel,
- como un banco,
- como un dashboard SaaS generico,
- como una app que exige completar todo,
- como una pantalla llena de graficos sin decision,
- como una IA que presume analisis sin evidencia.

Principio:

> Mostrar menos cosas, pero mejor elegidas.

---

## 4. Arquitectura De Navegacion

### 4.1 Mobile

Mobile es prioritario porque Manzana nace desde WhatsApp.

Navegacion principal:

```text
Home | Movimientos | Pendientes | Mi Dinero | Mas
```

Dentro de `Mas`:

```text
Deudas
Pagos que vienen
Descubrimientos
Configuracion
```

Reglas:

- `Pendientes` muestra badge si hay elementos por revisar.
- `Mas` no debe sentirse como cajon de features muertas.
- Si el usuario es debt-first, puede promoverse `Deudas` como acceso visible o card fuerte en Home.
- Si el usuario no usa una seccion, no llenar la pantalla con bloques vacios.

### 4.2 Desktop

Desktop es para revision mas calmada.

Navegacion:

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

Reglas:

- Sidebar lateral, no navegacion escondida.
- Home siempre disponible.
- Pendientes debe ser facil de encontrar.
- Configuracion va al final.
- No usar labels tecnicos como `Insights`, `Recurrentes`, `Nudges` como visibles principales.

---

## 5. Jerarquia Del Primer Pantallazo

El primer pantallazo de Home debe priorizar:

1. Dinero libre si hay datos suficientes.
2. Pendientes relevantes.
3. Que cambio o que aprendio Manzana.
4. Proximo compromiso.
5. Movimientos recientes.
6. Accion sugerida.

No priorizar:

- graficos decorativos,
- modulos vacios,
- onboarding largo,
- configuracion,
- comparativas sin evidencia,
- features que el usuario aun no usa.

Regla:

> Si el usuario no entiende "como estoy" en 10 segundos, Home esta fallando.

---

## 6. Pantallas V1

| Pantalla | Trabajo principal | Pregunta que responde |
|---|---|---|
| Home | Estado actual y siguiente accion | "Como estoy hoy?" |
| Movimientos | Historial, fuente y correccion | "Que registre y puedo corregirlo?" |
| Pendientes | Confirmar o descartar detecciones | "Que necesita mi aprobacion?" |
| Mi Dinero | Cuentas, cajas, dinero libre y compromisos | "Cuanto puedo usar realmente?" |
| Deudas | Obligaciones y pagos | "Que debo, que me deben y como voy?" |
| Pagos que vienen | Recurrentes y pagos esperados | "Que viene pronto?" |
| Descubrimientos | Cambios y patrones utiles | "Que noto Manzana?" |
| Configuracion | Preferencias, privacidad y canales | "Que quiero activar, pausar o ajustar?" |

---

## 7. Home

Home es una superficie de claridad, no un resumen de todo.

### 7.1 Componentes

| Componente | Mostrar cuando | Regla |
|---|---|---|
| Dinero libre | Hay saldo/cuenta suficiente para calcularlo. | Distinguir de dinero total y explicar limites. |
| Estado de aprendizaje | Hay pocos datos. | No fingir patrones. |
| Pendiente principal | Hay algo que requiere aprobacion. | No afecta saldo hasta confirmar. |
| Descubrimiento destacado | Hay evidencia suficiente. | Maximo 1 destacado. |
| Proximo compromiso | Hay deuda, cuota o pago que viene. | Respetar sensibilidad. |
| Movimientos recientes | Hay movimientos confirmados. | Mostrar fuente y accion de correccion. |
| Accion sugerida | Hay señal fuerte. | Maximo 1 accion principal. |

### 7.2 Estados De Home

| Estado | Home debe mostrar | Home no debe mostrar |
|---|---|---|
| Vacio | CTA unico, ejemplo de registro, opcion secundaria. | Graficos falsos, S/0 inventado, modulos muertos. |
| Temprano | Ultimos movimientos, estado de aprendizaje, correccion facil. | Diagnosticos, comparativas fuertes. |
| Funcional | Dinero libre si aplica, pendientes, primer descubrimiento. | Todo al mismo nivel. |
| Completo | Cambios, compromisos, deudas, acciones relevantes. | Ruido o recomendaciones sin accion. |
| Vuelta tras silencio | Retomar contexto y accion pequena. | Culpa, "te atrasaste", reiniciar onboarding. |

### 7.3 Accion Sugerida

Home puede mostrar una accion sugerida si existe una razon concreta.

Prioridad:

1. Pendiente importante o antiguo.
2. Compromiso proximo.
3. Deuda/cuota vencida.
4. Pago que viene no pagado.
5. Correccion o dato dudoso.
6. Descubrimiento nuevo con accion clara.

Reglas:

- Maximo 1 accion sugerida visible.
- Si hay varias, agrupar o elegir la mas util.
- Si no hay señal fuerte, no mostrar accion.
- No usar accion sugerida para empujar configuracion sin beneficio claro.

---

## 8. Movimientos

Movimientos es la pantalla de confianza.

Debe permitir:

- ver historial confirmado,
- filtrar,
- buscar,
- crear movimiento manual,
- editar,
- borrar con confirmacion,
- corregir categoria/cuenta/caja/persona,
- ver fuente,
- ver estado,
- preguntar "por que?".

### 8.1 Lista

Cada fila debe mostrar:

- descripcion,
- monto,
- tipo,
- categoria/subcategoria si aplica,
- fecha,
- fuente,
- estado,
- cuenta/caja si aplica,
- indicacion de correccion o duda.

Regla:

> La fila debe ser escaneable; el detalle guarda la explicacion larga.

### 8.2 Filtros

Filtros V1:

- periodo,
- tipo de movimiento,
- categoria,
- cuenta,
- caja,
- persona,
- fuente,
- estado,
- confianza,
- etiqueta,
- texto/busqueda natural.

Tipos canonicos:

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

### 8.3 Detalle De Movimiento

El detalle debe responder:

- De donde salio?
- Cuando se registro?
- Fue confirmado?
- Afecta saldo, caja, deuda o pago que viene?
- Por que tiene esa categoria?
- Que cambio si fue corregido?
- Puedo editar, borrar o explicar?

Debe mostrar:

- fuente visible,
- texto original o evidencia resumida,
- estado,
- confianza,
- audit trail resumido,
- vinculos a deuda/caja/pago/email si aplica.

No mostrar:

- chain-of-thought,
- prompts internos,
- logs tecnicos,
- scores crudos sin contexto.

---

## 9. Nuevo Movimiento Manual

El Dashboard debe permitir registro manual porque el usuario puede estar revisando y querer actuar sin volver a WhatsApp.

Principio:

> No debe ser un formulario contable pesado, pero debe pedir lo necesario para registrar dinero real con confianza.

### 9.1 UX

- Abrir como modal o drawer.
- Mostrar solo campos relevantes segun tipo.
- Prellenar fecha hoy.
- Sugerir cuenta/categoria solo si hay evidencia.
- Mostrar impacto antes de guardar.
- Permitir `Guardar`, `Guardar y otro`, `Cancelar`.
- Advertir duplicados antes de crear.
- Pedir confirmacion si cambia saldo, deuda, caja o varios datos sensibles.

### 9.2 Campos

| Campo | Regla |
|---|---|
| Tipo | Requerido. Enum canonico V1. |
| Monto | Requerido para movimiento confirmado. |
| Moneda | Default del usuario. |
| Fecha | Default hoy, editable. |
| Descripcion | Recomendada para memoria y busqueda. |
| Categoria | Segun tipo; requerida para gasto/ingreso salvo revision. |
| Cuenta/caja origen | Segun tipo; puede ser `null` en registros simples permitidos. |
| Cuenta/caja destino | Requerida en transferencia/asignacion interna. |
| Persona relacionada | Requerida en deuda, prestamo y devolucion. |
| Nota/etiquetas | Opcional. |

### 9.3 Reglas

- Fuente del movimiento: `Dashboard/manual`.
- No depende de IA para guardar.
- Puede usar IA para sugerencias, nunca para escribir directo.
- Pasa por Core, validadores, Dedup Engine, audit log y transactional outbox.
- Transferencia, asignacion interna y pago de deuda no se muestran como gasto generico.
- La barra de busqueda natural es read-only; no crea datos.

---

## 10. Pendientes

Pendientes es la bandeja de control.

Definicion visible:

```text
Cosas que Manzana detecto pero necesitan tu confirmacion.
```

### 10.1 Tipos

| Tipo | Ejemplo | Accion |
|---|---|---|
| Email detectado | Yape o banco detectado. | Confirmar, editar, rechazar, ya registrado. |
| Movimiento dudoso | "Le pase 50 a Luis". | Elegir tipo correcto. |
| Pago que viene sugerido | Netflix detectado 3 meses. | Confirmar o ignorar. |
| Batch | 7 emails similares. | Revisar en grupo. |
| Accion de riesgo | Borrar varios movimientos. | Confirmacion explicita. |

### 10.2 Reglas

- Pendiente no afecta saldo.
- Pendiente no alimenta descubrimientos fuertes.
- Email nunca se registra sin aprobacion.
- Batch debe explicar que contiene.
- Si hay muchos pendientes, agrupar.
- Si son antiguos, decir que no afectaron saldos.
- Rechazar no debe sentirse como error.

---

## 11. Mi Dinero

Mi Dinero responde:

```text
Cuanto puedo usar realmente?
```

### 11.1 Jerarquia Visible

```text
Dinero total
  - Cajas / dinero separado
  = Libre en cuentas
  - Compromisos proximos no cubiertos
  = Dinero libre
```

Reglas:

- `Dinero libre` es el numero principal si hay datos suficientes.
- `Libre en cuentas` es subcalculo de detalle.
- No mostrar `Dinero libre = S/0` si faltan datos.
- Si faltan cuentas o saldos, explicar limite.
- Cajas no son compromisos; son dinero separado.
- Compromisos agrupa deudas, cuotas y pagos que vienen.

### 11.2 Componentes

- cuentas,
- cajas,
- dinero libre,
- libre en cuentas,
- compromisos,
- proximos pagos,
- progreso de deudas si aplica,
- explicacion de calculo.

Copy:

```text
Puedo mostrarte historial. Para calcular dinero libre mejor, me falta al menos un saldo.
```

---

## 12. Deudas

Deudas es pantalla propia porque las deudas no son solo categoria.

Debe mostrar:

- total que debo,
- total que me deben,
- saldo neto si aplica,
- deudas activas,
- progreso,
- proximos pagos,
- personas relacionadas,
- historial de pagos.

Acciones:

- crear deuda,
- registrar pago,
- registrar cobro recibido,
- editar condiciones,
- cerrar deuda,
- archivar.

Reglas:

- Una deuda puede existir sin tracking completo de gastos.
- `pago_deuda` no es gasto generico.
- Si pago de deuda no tiene cuenta, puede actualizar deuda sin afectar saldo por cuenta.
- Cerrar deuda requiere confirmacion.
- Personas relacionadas no guardan datos de contacto en V1.
- Deudas sensibles usan modo discreto en proactivos y cuidado visual en previews.

---

## 13. Pagos Que Vienen

`Pagos que vienen` es la vista visible para recurrentes.

Debe mostrar:

- pagos activos,
- proximo vencimiento,
- monto fijo o estimado,
- estado,
- fuente,
- sugeridos,
- cambios de monto,
- vinculos con caja o deuda.

Estados:

- activo,
- sugerido,
- pausado,
- pagado,
- pendiente,
- vencido,
- archivado.

Acciones:

- confirmar sugerido,
- marcar pagado,
- editar fecha/monto,
- pausar,
- desactivar,
- vincular a caja,
- ver historial.

Reglas:

- Detectar patron no activa pago que viene automaticamente.
- Pago esperado no afecta saldo hasta pago confirmado.
- Cambio de monto relevante requiere confirmacion.
- Si esta vinculado a deuda, Debt Engine decide impacto.
- No usar `Recurrentes` como label visible principal.

---

## 14. Descubrimientos

`Descubrimientos` es el lenguaje visible para insights.

Debe sentirse como:

```text
Manzana noto algo util en tus datos.
```

No como:

```text
Sistema de insights accionables.
```

### 14.1 Reglas

- Home muestra maximo 1 descubrimiento destacado.
- La pantalla puede listar recientes, actualizados y guardados.
- No mostrar descubrimientos sin datos suficientes.
- No diagnosticar ni juzgar.
- Mostrar evidencia y fuente.
- Permitir ignorar, no volver a mostrar o ver movimientos relacionados.
- Si cambia por correccion, marcar actualizado u outdated.
- Primer descubrimiento seguro aparece con 5 movimientos confirmados si aplica.

### 14.2 Tipos V1

- aprendizaje temprano,
- que cambio,
- categoria principal,
- patron temporal,
- gasto atipico,
- cambio de pago que viene,
- liquidez/dinero libre,
- deuda,
- progreso positivo,
- calidad de datos.

---

## 15. Busqueda Natural

El Dashboard puede tener una busqueda natural global.

Ubicacion:

- topbar en desktop,
- boton o barra compacta en mobile.

Placeholder:

```text
Pregunta algo sobre tu dinero...
```

### 15.1 Lo Que Puede Hacer

| Consulta | Resultado esperado |
|---|---|
| "gastos de transporte esta semana" | Movimientos filtrados + total. |
| "cuanto le debo a Luis?" | Respuesta read-only desde Debt Engine. |
| "pendientes de email" | Navega a Pendientes filtrado. |
| "cuanto tengo libre?" | Explica Dinero libre si hay datos. |
| "movimientos sin clasificar" | Lista filtrada. |
| "por que bajo mi dinero libre?" | Explicacion con fuentes. |

### 15.2 Reglas

- Es read-only en V1.
- No crea, edita ni borra datos.
- Si el usuario intenta una accion, redirigir al flujo correcto.
- Usa Motor IA y herramientas read-only, no acceso libre a base de datos.
- Si falla IA, degrada a busqueda textual.
- Resultados deben mostrar fuente, periodo y limites.

Ejemplo:

```text
No encontre movimientos confirmados de Netflix ese dia.
Tambien hay 1 pendiente parecido por revisar.
```

### 15.3 No Es Chatbot

La busqueda natural no debe convertir el Dashboard en un chat dentro de la app.

Debe sentirse como:

- buscar,
- filtrar,
- explicar,
- navegar,
- responder una duda concreta.

No debe sentirse como:

- una conversacion abierta sin limite,
- un asistente flotante que compite con WhatsApp,
- un lugar para dar comandos de escritura,
- una segunda interfaz principal de captura.

Reglas:

- Para preguntas simples, responder inline.
- Para listas, navegar a la vista filtrada.
- Para explicaciones, abrir panel o detalle.
- Para acciones de escritura, mostrar CTA hacia el flujo estructurado.
- Para conversacion larga, sugerir continuar por WhatsApp si tiene sentido.

---

## 16. Configuracion

Configuracion debe ser simple y progresiva.

Incluye:

- email,
- recordatorios,
- horario silencioso,
- modo discreto,
- cuentas,
- cajas,
- preferencias de comunicacion,
- memoria/aprendizajes visibles,
- exportacion basica si aplica,
- eliminar o desconectar datos si aplica.

Reglas:

- No pedir configurar todo al inicio.
- Las preferencias sensibles deben ser explicitas y reversibles.
- Opt-in y opt-out deben ser faciles.
- Modo discreto aplica a salidas proactivas; en Dashboard autenticado se puede mostrar detalle, cuidando previews y estados compartidos.

---

## 17. Estados De UX

### 17.1 Estado Vacio

Debe decir:

```text
Empieza por una cosa.
```

Debe mostrar:

- CTA principal: `Registrar movimiento`,
- opcion: `Abrir WhatsApp`,
- opcion secundaria: `Conectar email`,
- opcion secundaria: `Agregar cuenta`,
- ejemplo de mensaje,
- ninguna metrica falsa.

No debe mostrar:

- graficos vacios,
- dinero libre inventado,
- cards muertas,
- juicio por no tener datos.

### 17.2 Estado De Carga

- Skeletons ligeros.
- Mantener navegacion disponible.
- No bloquear toda la app por una consulta IA.
- Mostrar ultimo dato conocido si aplica.

### 17.3 Estado De Error

Debe explicar:

- que paso,
- que dato sigue siendo valido,
- que puede hacer el usuario.

Ejemplo:

```text
No pude actualizar tus movimientos ahora. Tus datos anteriores siguen guardados.
```

### 17.4 Estado De Recalculo

Despues de editar o corregir:

```text
Ya lo corregi. Estoy actualizando tus resumenes.
```

Regla: no mostrar un numero viejo como verdad definitiva si el sistema sabe que esta recalculando.

### 17.5 Estados Vacios Por Pantalla

Los estados vacios deben ser utiles, no decorativos.

| Pantalla | Mensaje | Accion principal | No hacer |
|---|---|---|---|
| Home | "Empieza por una cosa." | Registrar movimiento. | Mostrar graficos falsos. |
| Movimientos | "Cuando registres algo por WhatsApp o Dashboard, aparecera aqui." | Nuevo movimiento. | Mostrar tabla vacia fria. |
| Pendientes | "No tienes nada por revisar." | Volver a Home. | Sugerir problemas inexistentes. |
| Mi Dinero | "Puedo calcular tu dinero libre cuando tenga al menos un saldo." | Agregar cuenta/saldo. | Mostrar S/0 como dinero libre. |
| Deudas | "No tienes deudas registradas." | Crear deuda si quiere. | Forzar registro de gastos. |
| Pagos que vienen | "No tienes pagos que vienen registrados." | Agregar pago que viene. | Inventar recurrentes por pocos datos. |
| Descubrimientos | "Todavia no hay datos suficientes para notar cambios utiles." | Registrar o revisar movimientos. | Mostrar insight debil. |
| Configuracion | "Ajusta solo lo que te sirva ahora." | Ver privacidad o recordatorios. | Pedir configurar todo. |

Reglas:

- Un estado vacio ofrece un siguiente paso pequeno.
- No debe mostrar todas las features como checklist.
- Si el usuario ya usa WhatsApp, reconocer continuidad.
- Si el usuario viene de onboarding, no repetir tour.

---

## 18. Consistencia Entre Canales

Dashboard, WhatsApp y Email deben sentirse como una sola memoria de Manzana.

### 18.1 Reglas

- Movimiento creado en Dashboard aparece en respuestas futuras de WhatsApp.
- Correccion hecha por WhatsApp actualiza Dashboard.
- Pendiente confirmado en Dashboard no vuelve a pedirse por WhatsApp.
- Pendiente rechazado por WhatsApp desaparece de Pendientes activos.
- Email detectado entra a Pendientes y puede revisarse en Dashboard.
- Descubrimiento afectado por correccion se actualiza o marca como actualizado.
- Nudge guardado como `dashboard_only` aparece en Home sin interrumpir por WhatsApp.

### 18.2 Estados De Sincronizacion

| Estado | UX |
|---|---|
| Actualizado | Mostrar dato normal. |
| Recalculando | Mostrar indicador breve y no afirmar dato viejo como definitivo. |
| Desfasado | Ofrecer refrescar o mostrar timestamp. |
| Fallo de sincronizacion | Explicar que no se hizo cambio o que el dato anterior sigue guardado. |

Copy:

```text
Ya lo actualice. Estoy refrescando tus resumenes.
```

---

## 19. Privacidad, Sesion Y Modo Discreto

Modo discreto en V1 afecta sobre todo salidas proactivas, previews y notificaciones. En Dashboard autenticado puede mostrarse detalle, pero la UI debe estar preparada para ocultar montos si se decide activarlo mas adelante.

V1 debe contemplar:

- textos proactivos sin monto/comercio/persona sensible,
- previews discretos,
- tarjetas sensibles que no griten informacion en primer plano,
- deuda/salud/apuestas/personas con cuidado de copy,
- opcion visible para activar/desactivar modo discreto.

No V1 obligatorio:

- blur universal en cada monto de todas las vistas.

Regla:

> No diseñar componentes que hagan imposible ocultar montos despues.

### 19.1 Privacidad De Sesion

El Dashboard es una superficie autenticada, pero puede verse en espacios compartidos.

Reglas:

- No poner montos sensibles en `title` del navegador.
- No mostrar datos sensibles en previews externas.
- No exponer comercios/personas sensibles en banners grandes si modo discreto esta activo.
- Exportaciones o descargas requieren confirmacion.
- Acciones destructivas o sensibles requieren contexto y confirmacion.
- Si la sesion expira, ocultar datos antes de pedir re-login.

---

## 20. Accesibilidad E Interaccion

Un Dashboard de alto nivel no solo se ve bien; se puede usar con calma, rapido y sin friccion.

Reglas V1:

- Navegacion usable con teclado.
- Estados de foco visibles.
- Botones con labels accesibles.
- Acciones icon-only tienen tooltip o `aria-label`.
- Contraste suficiente en texto, montos y estados.
- No depender solo del color para estados como pendiente, vencido o corregido.
- Targets tactiles comodos en mobile.
- Modales/drawers deben poder cerrarse con cancelar, escape o boton claro.
- Tablas en desktop deben tener equivalentes escaneables en mobile.
- Errores de formulario deben estar junto al campo afectado.
- Inputs de dinero deben evitar errores de separador decimal/moneda.

---

## 21. Responsividad Y Densidad

Dashboard debe ser operativo y escaneable.

Lineamientos:

- mobile-first,
- listas antes que tablas densas en mobile,
- tablas compactas solo en desktop,
- cards solo para unidades reales,
- no cards dentro de cards,
- sin hero marketing,
- sin graficos decorativos,
- acciones cercanas al dato,
- texto compacto y claro,
- iconos para acciones conocidas,
- estados visuales sobrios.

---

## 22. Relacion Con El Prototipo

Fase 6 visual ya existe como fuente documental V1 para identidad, tokens, componentes, estados y handoff.

Referencia visual vigente:

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

Referencias anteriores:

```text
dashboard-v2 eliminado como carpeta local
```

```text
prototypes/manzana-v3/ (descartado/no usar)
```

Uso correcto:

- ayuda visual,
- prueba de jerarquia,
- navegacion,
- copy,
- estados,
- componentes esperados,
- base para aplicar Fase 6 visual y validar un prototipo aprobado.

No es:

- diseño final obligatorio,
- fuente de verdad superior al spec,
- implementacion productiva.

Si el prototipo contradice este documento, gana este documento en UX, estructura y comportamiento. Fase 6 gana en identidad visual, tokens, componentes y estados visuales.

Estado actual:

- `dashboard-v2` queda solo como antecedente historico de flujo y contenido, no como carpeta local ni diseño final.
- `prototypes/manzana-v3` fue un intento local descartado y no debe usarse como referencia visual.
- Fase 6 visual V1 es la fuente documental vigente; cualquier candidato visual previo queda como antecedente no oficial.

Validaciones a mantener en cada iteracion:

- `Recurrentes` debe mostrarse como `Pagos que vienen`.
- `Insights` debe mostrarse como `Descubrimientos`.
- Debe reflejar estados vacios, no solo estado con datos.
- Debe probar modo discreto/previews sensibles.
- Debe mostrar registro manual con tipos canonicos completos.
- Debe aplicar identidad visual, tokens, paleta y tipografia de Fase 6 visual V1.

---

## 23. Eventos De Producto

Eventos sugeridos:

- `dashboard_opened`
- `dashboard_home_seen`
- `dashboard_empty_cta_clicked`
- `dashboard_empty_state_seen`
- `dashboard_manual_movement_started`
- `dashboard_manual_movement_saved`
- `dashboard_manual_movement_cancelled`
- `dashboard_search_used`
- `dashboard_search_result_opened`
- `dashboard_search_fallback_used`
- `dashboard_natural_search_action_redirected`
- `dashboard_keyboard_shortcut_used`
- `movement_detail_opened`
- `movement_source_viewed`
- `movement_explanation_viewed`
- `movement_corrected_from_dashboard`
- `pending_review_opened`
- `pending_confirmed_dashboard`
- `pending_rejected_dashboard`
- `money_free_explanation_opened`
- `debt_dashboard_opened`
- `recurring_dashboard_opened`
- `discovery_dashboard_seen`
- `dashboard_discreet_mode_applied`
- `dashboard_sensitive_preview_hidden`
- `dashboard_cross_channel_refreshed`
- `dashboard_stale_data_refreshed`

---

## 24. Metricas

| Metrica | Que mide |
|---|---|
| Home understood in 10s | Claridad del primer pantallazo. |
| Dashboard empty to first action | Estado vacio convertido en valor. |
| Manual movement completion | Si el registro manual no frena. |
| Pending resolution rate Dashboard | Pendientes resueltos desde Dashboard. |
| Movement correction success | Correcciones sin soporte. |
| Source/explanation usage | Confianza y trazabilidad. |
| Search success rate | Busqueda natural util. |
| Search fallback rate | IA no entendio, pero busqueda textual ayudo. |
| Money free explanation success | Usuario entiende dinero libre. |
| Dashboard weekly return | Valor sostenido. |
| Dashboard-only user activation | Uso parcial valido. |
| Sensitive preview incidents | Debe ser 0. |
| Cross-channel freshness | Tiempo hasta reflejar cambios entre WhatsApp/Dashboard. |
| Empty-state conversion by screen | Si cada estado vacio lleva a valor. |
| Accessibility issue rate | Bloqueos de uso por foco, contraste, teclado o labels. |

---

## 25. Escenarios De Prueba

1. Usuario abre Dashboard sin datos.
2. Usuario registra movimiento manual simple.
3. Usuario registra transferencia manual.
4. Usuario registra pago de deuda desde Deudas.
5. Usuario confirma email pendiente.
6. Usuario rechaza pendiente.
7. Usuario busca "gastos de taxi de abril".
8. Usuario intenta crear movimiento desde busqueda natural.
9. Usuario pregunta "por que mi dinero libre es S/220?"
10. Usuario corrige categoria desde detalle.
11. Usuario borra movimiento confirmado.
12. Usuario ve pendiente antiguo y entiende que no afecto saldo.
13. Usuario solo usa deudas.
14. Usuario solo usa Dashboard, sin WhatsApp activo.
15. Usuario tiene modo discreto activo.
16. Usuario vuelve despues de 30 dias.
17. Usuario tiene 5 movimientos y ve primer descubrimiento seguro.
18. Usuario tiene pago que viene sugerido.
19. Usuario tiene dato recalculando despues de correccion.
20. Motor IA falla y busqueda degrada a texto.
21. Usuario confirma pendiente en Dashboard y luego pregunta por WhatsApp.
22. Usuario corrige por WhatsApp y Dashboard muestra dato actualizado.
23. Usuario navega con teclado y abre detalle de movimiento.
24. Usuario usa busqueda natural para intentar borrar un movimiento.
25. Sesion expira con Dashboard abierto.
26. Usuario abre Mi Dinero sin cuentas.
27. Usuario abre Descubrimientos sin datos suficientes.
28. Usuario usa pantalla en mobile y las acciones no se solapan.

---

## 26. Criterios De Aceptacion

- Dashboard queda definido como claridad, control y confianza, no como app contable.
- Navegacion mobile y desktop quedan especificadas.
- Labels visibles usan `Pagos que vienen`, `Descubrimientos`, `Pendientes`, `Mi Dinero` y `Dinero libre`.
- Home prioriza dinero libre, pendientes, descubrimiento, compromiso y movimientos recientes.
- Estado vacio no muestra datos falsos ni pantallas muertas.
- Registro manual existe y soporta los 11 tipos canonicos.
- Registro manual no depende de IA para escribir dinero.
- Busqueda natural es read-only en V1.
- Busqueda natural no se comporta como chatbot ni compite con WhatsApp.
- Pendientes no afectan saldo y no se mezclan con confirmados.
- Mi Dinero distingue Dinero total, Libre en cuentas, Cajas, Compromisos y Dinero libre.
- Deudas y Pagos que vienen tienen pantallas propias.
- Descubrimientos se muestran con evidencia, sin juicio y con control.
- Fuente, explicacion, estado y correccion estan disponibles para datos importantes.
- Estados vacios existen por pantalla y no inventan datos.
- Cambios entre WhatsApp, Dashboard y Email mantienen consistencia visible.
- Modo discreto queda contemplado sin exigir blur universal V1.
- Privacidad de sesion y previews sensibles queda contemplada.
- Accesibilidad minima de teclado, foco, contraste, labels y mobile queda definida.
- Prototipo queda como ayuda visual, no como fuente de verdad superior.
- Eventos, metricas y escenarios permiten validar implementacion.

---

*Fase 3 Producto - Documento 17 - V1.1*
