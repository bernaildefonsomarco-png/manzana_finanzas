# Wireframes y Prototipo V1

**Documento:** `18_wireframes_prototipo.md`  
**Fase:** 3 - Producto / Experiencia  
**Estado:** V2.2 - Wireframes vigentes; sincronizado con Fase 6 visual V1  
**Ultima actualizacion:** 3 de junio, 2026

---

## 1. Tesis

Este documento conecta la especificacion de UX del Dashboard con una representacion visual concreta.

No reemplaza a `17_dashboard_ux.md`. Lo vuelve visible.

Debe responder:

- Como se ve cada pantalla principal?
- Que debe aparecer en desktop y mobile?
- Que estados hay que prototipar?
- Que pantallazos sirven como referencia?
- Que partes de las referencias actuales estan alineadas o desalineadas?
- Que debe recibir Cursor/Claude/OpenSpec como contexto visual?

Principio:

> El prototipo ayuda a entender la experiencia, pero la fuente de verdad sigue siendo la especificacion.

Estado de completitud:

> Este documento queda como contrato de wireframes y estructura. Fase 6 visual V1 define identidad, tokens, componentes, estados y handoff. Los pantallazos generados quedan sujetos a aprobacion contra Fase 6.

---

## 2. Fuentes De Verdad

| Fuente | Rol |
|---|---|
| `17_dashboard_ux.md` | Contrato UX del Dashboard. Gana ante cualquier contradiccion. |
| `05c_dashboard.md` | Alcance funcional y arquitectura del Dashboard. |
| `12_lenguaje_producto.md` | Labels visibles, nombres humanos y estados vacios. |
| `16_confianza_errores.md` | Fuente, explicacion, correccion, idempotencia y consistencia. |
| `15_retencion_lifecycle.md` | Home como superficie de retencion pasiva. |
| Fase 6 visual V1 | Fuente documental de identidad, design system, app flow, wireflows, especificacion Hi-Fi y handoff. |
| Prototipo visual generado | Referencia profesional solo despues de aprobacion explicita contra Fase 6. |
| `dashboard-v2` | Eliminado como carpeta local; queda solo como antecedente historico de flujo y contenido, no fuente final. |
| `prototypes/manzana-v3/` | Intento local descartado; no usar como referencia visual. |

Regla:

> Si el prototipo muestra `Recurrentes` pero la spec dice `Pagos que vienen`, gana la spec.

---

## 3. Que Va Aqui Y Que No

### 3.1 Si Va

- Wireframes textuales.
- Mapa de pantallas.
- Estados por pantalla.
- Checklist de pantallazos.
- Desalineaciones del prototipo.
- Criterios visuales de validacion.
- Handoff para implementacion.

### 3.2 No Va

- Codigo HTML/CSS completo.
- Diseño visual final de marca.
- Capturas pegadas sin contexto.
- Decisiones funcionales nuevas que contradigan specs anteriores.
- Pantallas marketing.
- Documentacion tecnica de backend.

---

## 4. Relacion Con Pantallazos

Si, este es el documento donde pueden vivir pantallazos o referencias visuales.

Pero deben usarse con orden:

- Primero wireframe textual.
- Luego pantallazo del prototipo.
- Luego notas de alineacion/desalineacion.
- Luego accion requerida.

Formato recomendado:

```text
Pantallazo: Home desktop - estado funcional
Archivo sugerido: prototypes/[prototipo-aprobado]/screenshots/home-desktop-functional.png
Estado: referencia visual parcial
Notas:
- Alineado: dinero libre, pendientes, movimientos recientes.
- Desalineado: falta estado de recalculo y modo discreto.
```

Regla:

> Un pantallazo sin nota no es especificacion; es decoracion.

---

## 5. Mapa De Pantallas V1

| Pantalla | Desktop | Mobile | Requiere pantallazo? |
|---|---|---|---|
| Home | Si | Si | Si |
| Movimientos | Si | Si | Si |
| Nuevo movimiento | Si | Si | Si |
| Pendientes | Si | Si | Si |
| Mi Dinero | Si | Si | Si |
| Deudas | Si | Si | Si |
| Pagos que vienen | Si | Si | Si |
| Descubrimientos | Si | Si | Si |
| Configuracion | Si | Opcional V1 | Si, minimo desktop |
| Busqueda natural | Si | Si | Si |
| Detalle de movimiento | Si | Si | Si |
| Estados vacios | Si | Si | Si |
| Modo discreto / preview sensible | Si | Si | Si |
| Error / recalculo | Si | Opcional V1 | Si |

---

## 6. Viewports Y Matriz De Captura

Los pantallazos deben validar desktop y mobile. No basta una sola captura bonita.

### 6.1 Viewports Minimos

| Tipo | Viewport sugerido | Uso |
|---|---|---|
| Desktop | 1440 x 900 | Revision principal y sidebar. |
| Laptop | 1280 x 800 | Densidad realista. |
| Tablet | 768 x 1024 | Navegacion intermedia si aplica. |
| Mobile | 390 x 844 | Mobile moderno comun. |
| Mobile compacto | 360 x 740 | Detectar textos/CTAs que se rompen. |

### 6.2 Reglas De Captura

- Capturar cada pantalla en estado funcional y estado vacio cuando aplique.
- Capturar modales/drawers abiertos.
- Capturar busqueda con resultados y sin resultados.
- Capturar modo discreto o preview sensible.
- Capturar error/recalculo.
- Nombrar archivos con pantalla + viewport + estado.
- No considerar validado un flujo si solo existe desktop.

Ejemplo:

```text
home-mobile-empty.png
manual-movement-desktop-transfer.png
search-mobile-no-results.png
```

---

## 7. Wireframe Global

### 7.1 Desktop

```text
┌──────────────────────────────────────────────────────────────┐
│ Sidebar             │ Topbar: titulo + busqueda + acciones    │
│                     ├─────────────────────────────────────────┤
│ Home                │                                         │
│ Movimientos         │ Contenido principal                     │
│ Pendientes [3]      │ segun pantalla                          │
│ Mi Dinero           │                                         │
│ Deudas              │                                         │
│ Pagos que vienen    │                                         │
│ Descubrimientos     │                                         │
│ Configuracion       │                                         │
└──────────────────────────────────────────────────────────────┘
```

Reglas:

- Sidebar visible.
- Busqueda natural global.
- Acciones globales discretas.
- Pendientes con badge.
- No usar `Insights` ni `Recurrentes` como labels visibles.

### 7.2 Mobile

```text
┌─────────────────────────────┐
│ Topbar compacto             │
│ Busqueda / acceso rapido    │
├─────────────────────────────┤
│ Contenido de pantalla       │
│ en listas escaneables       │
├─────────────────────────────┤
│ Home Movimientos Pendientes │
│ Mi Dinero Mas               │
└─────────────────────────────┘
```

Reglas:

- Bottom nav con 5 accesos maximo.
- `Mas` agrupa Deudas, Pagos que vienen, Descubrimientos y Configuracion.
- No ocultar Pendientes si hay pendientes activos.
- Targets tactiles comodos.

---

## 8. Home

### 8.1 Estado Funcional

```text
┌─────────────────────────────────────┐
│ Home                                │
│ Dinero libre                         │
│ S/220                                │
│ Total S/800 - separado/comprometido │
├─────────────────────────────────────┤
│ Pendientes                           │
│ 3 movimientos por revisar            │
│ [Revisar pendientes]                 │
├─────────────────────────────────────┤
│ Descubrimiento                       │
│ Transporte subio S/75 esta semana    │
│ [Ver explicacion]                    │
├─────────────────────────────────────┤
│ Proximo compromiso                   │
│ Cuota laptop S/400 - 26 mayo         │
├─────────────────────────────────────┤
│ Movimientos recientes                │
│ Cafe S/8 - WhatsApp - Confirmado     │
│ Taxi S/15 - Dashboard - Corregible   │
└─────────────────────────────────────┘
```

### 8.2 Estado Vacio

```text
┌─────────────────────────────────────┐
│ Home                                │
│ Empieza por una cosa                 │
│ Registra un gasto, ingreso o deuda   │
│ para que Manzana empiece a ordenar.  │
│ [Registrar movimiento]               │
│ [Abrir WhatsApp]                     │
│ [Conectar email]                     │
└─────────────────────────────────────┘
```

No mostrar:

- S/0 como dinero libre,
- graficos vacios,
- diagnosticos,
- tarjetas de features muertas.

---

## 9. Movimientos

```text
┌─────────────────────────────────────┐
│ Movimientos                         │
│ [Nuevo movimiento]                   │
│ [Buscar] [Periodo] [Tipo] [Fuente]  │
├─────────────────────────────────────┤
│ Cafe                         S/8    │
│ Gasto · Alimentacion · WhatsApp     │
│ Confirmado · [Editar] [Por que]     │
├─────────────────────────────────────┤
│ Taxi                         S/15   │
│ Transporte · Dashboard/manual       │
│ Corregido · [Ver detalle]           │
└─────────────────────────────────────┘
```

### 9.1 Detalle De Movimiento

```text
┌─────────────────────────────────────┐
│ Taxi                         S/15   │
├─────────────────────────────────────┤
│ Tipo: Gasto                         │
│ Categoria: Transporte > Taxi        │
│ Fuente: WhatsApp                    │
│ Estado: Confirmado                  │
│ Cuenta: Yape                        │
│ Confianza: Alta                     │
├─────────────────────────────────────┤
│ Por que?                            │
│ Texto original: "gaste 15 taxi"     │
│ Evidencia: monto + palabra taxi      │
│ Limite: puedes corregirlo si no era.│
├─────────────────────────────────────┤
│ [Editar] [Eliminar] [Reportar]      │
└─────────────────────────────────────┘
```

Regla:

- El detalle muestra evidencia resumida, no chain-of-thought.

---

## 10. Nuevo Movimiento

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
│ Cuenta/caja origen                  │
│ [Yape v]                            │
│ Categoria                           │
│ [Alimentacion v]                    │
│ Descripcion                         │
│ [Cafe antes de oficina]             │
├─────────────────────────────────────┤
│ Impacto                             │
│ Sale de Yape y afecta dinero libre. │
│ [Guardar] [Guardar y otro] [Cancelar]│
└─────────────────────────────────────┘
```

Variaciones obligatorias:

| Tipo | Campos visuales extra |
|---|---|
| `transferencia` | Cuenta origen + cuenta destino. |
| `asignacion_interna` | Caja origen/destino + impacto en libre. |
| `deuda_adquirida` | Persona/entidad + condiciones. |
| `pago_deuda` | Deuda vinculada + monto aplicado. |
| `prestamo_dado` | Persona + si afecta saldo. |
| `prestamo_recibido` | Persona/entidad + deuda creada. |
| `devolucion_recibida` | Persona/deuda vinculada. |
| `pago_recurrente` | Pago que viene vinculado. |
| `ajuste` | Motivo + confirmacion de riesgo. |

Regla:

- El formulario cambia por tipo. No mostrar todos los campos siempre.

---

## 11. Pendientes

```text
┌─────────────────────────────────────┐
│ Pendientes                          │
│ 3 por revisar                        │
├─────────────────────────────────────┤
│ Email detectado                      │
│ Yape S/45 · Restaurante              │
│ No afecta saldo                      │
│ [Confirmar] [Editar] [Ya registrado]│
├─────────────────────────────────────┤
│ Duda                                 │
│ "Le pase 50 a Luis"                  │
│ Prestamo, regalo o pago?             │
│ [Prestamo] [Regalo] [Pago deuda]     │
├─────────────────────────────────────┤
│ Pago que viene sugerido              │
│ Netflix detectado 3 meses            │
│ [Confirmar] [Ignorar]                │
└─────────────────────────────────────┘
```

Estado vacio:

```text
No tienes nada por revisar.
Cuando Manzana detecte algo que necesite tu confirmacion, aparecera aqui.
```

---

## 12. Mi Dinero

```text
┌─────────────────────────────────────┐
│ Mi Dinero                           │
│ Dinero libre                         │
│ S/220                                │
├─────────────────────────────────────┤
│ Desglose                             │
│ Total: S/800                         │
│ - Cajas: S/300                       │
│ = Libre en cuentas: S/500            │
│ - Compromisos: S/280                 │
│ = Dinero libre: S/220                │
├─────────────────────────────────────┤
│ Cuentas                              │
│ Yape S/260 · BCP S/520               │
├─────────────────────────────────────┤
│ Cajas                                │
│ Emergencia S/100 · Alquiler S/300    │
└─────────────────────────────────────┘
```

Sin cuentas:

```text
Puedo calcular tu dinero libre cuando tenga al menos un saldo.
[Agregar cuenta o saldo]
```

No mostrar:

- dinero libre como S/0,
- saldo falso,
- compromisos inventados.

---

## 13. Deudas

```text
┌─────────────────────────────────────┐
│ Deudas                              │
│ Debo S/2,550 · Me deben S/200       │
├─────────────────────────────────────┤
│ Laptop en cuotas                    │
│ S/1,200 pagado / S/2,400 total      │
│ Progreso 50%                         │
│ Proxima cuota S/400 · 26 mayo       │
│ [Registrar pago] [Ver detalle]      │
├─────────────────────────────────────┤
│ Luis                                │
│ Deuda informal · S/150 pendiente    │
│ Sin fecha definida                  │
│ [Pagar] [Editar]                    │
└─────────────────────────────────────┘
```

Estado vacio:

```text
No tienes deudas registradas.
Puedes usar Manzana solo para deudas si eso te sirve.
[Crear deuda]
```

---

## 14. Pagos Que Vienen

```text
┌─────────────────────────────────────┐
│ Pagos que vienen                    │
│ 4 activos · S/584/mes estimado      │
├─────────────────────────────────────┤
│ Internet                            │
│ S/89 · entre 12 y 15                │
│ Activo · Proximo 12 junio           │
│ [Marcar pagado] [Editar]            │
├─────────────────────────────────────┤
│ Cuota laptop                        │
│ S/400 · dia 26                      │
│ Vinculado a deuda                   │
│ [Marcar pagado] [Ver deuda]         │
├─────────────────────────────────────┤
│ Netflix                             │
│ Sugerido · detectado 3 meses        │
│ [Confirmar] [Ignorar]               │
└─────────────────────────────────────┘
```

Reglas visuales:

- No usar `Recurrentes`.
- Sugeridos van separados de activos.
- Cambio de monto debe ser visible.
- Pago esperado no se ve como gasto confirmado.

---

## 15. Descubrimientos

```text
┌─────────────────────────────────────┐
│ Descubrimientos                     │
│ Manzana noto algo util              │
├─────────────────────────────────────┤
│ Transporte subio S/75               │
│ La mayor parte fue Uber de trabajo  │
│ [Ver movimientos] [Ignorar]         │
├─────────────────────────────────────┤
│ Progreso                            │
│ Pagaste 2 cuotas seguidas a tiempo  │
│ [Ver deuda]                         │
└─────────────────────────────────────┘
```

Sin datos suficientes:

```text
Todavia no hay datos suficientes para notar cambios utiles.
Con unos movimientos mas, Manzana podra mostrarte algo con mas sentido.
```

No mostrar:

- insights debiles,
- diagnosticos,
- culpa,
- graficos para llenar espacio.

---

## 16. Busqueda Natural

```text
┌─────────────────────────────────────┐
│ Pregunta algo sobre tu dinero...    │
├─────────────────────────────────────┤
│ Resultado rapido                    │
│ Gastaste S/120 en transporte en abril│
│ [Ver movimientos filtrados]          │
├─────────────────────────────────────┤
│ Pendientes parecidos                 │
│ 1 pendiente de taxi sin confirmar    │
│ [Revisar pendiente]                  │
└─────────────────────────────────────┘
```

Intento de escritura:

```text
Usuario busca: borra el taxi de ayer

Respuesta visual:
Para borrar un movimiento, abre el detalle y confirma la accion.
[Ver taxi de ayer]
```

Regla:

- Busqueda natural es read-only y no se comporta como chatbot.

---

## 17. Configuracion

```text
┌─────────────────────────────────────┐
│ Configuracion                       │
├─────────────────────────────────────┤
│ Privacidad                          │
│ Modo discreto [Activado/Desactivado]│
├─────────────────────────────────────┤
│ Recordatorios                       │
│ Pagos que vienen · Deudas · Resumen │
├─────────────────────────────────────┤
│ Email                               │
│ Conectar / desconectar              │
├─────────────────────────────────────┤
│ Datos y memoria                     │
│ Ver lo que Manzana aprendio         │
└─────────────────────────────────────┘
```

Regla:

- Configuracion no debe sentirse como requisito para empezar.

---

## 18. Modo Discreto Y Privacidad

Wireframe de preview discreto:

```text
┌─────────────────────────────────────┐
│ Tienes un movimiento por revisar.   │
│ [Ver en Dashboard]                  │
└─────────────────────────────────────┘
```

Dashboard autenticado:

```text
┌─────────────────────────────────────┐
│ Movimiento sensible                 │
│ Detalle visible solo dentro de sesion│
│ [Ocultar montos] [Ver detalle]      │
└─────────────────────────────────────┘
```

Reglas:

- V1 no exige blur universal.
- La UI debe permitir ocultar montos despues.
- No mostrar datos sensibles en title, preview o notificacion.

---

## 19. Error, Carga Y Recalculo

### 19.1 Carga

```text
┌─────────────────────────────────────┐
│ Cargando movimientos...             │
│ Skeleton de lista                   │
└─────────────────────────────────────┘
```

### 19.2 Error

```text
No pude actualizar tus movimientos ahora.
Tus datos anteriores siguen guardados.
[Reintentar]
```

### 19.3 Recalculo

```text
Ya lo corregi. Estoy actualizando tus resumenes.
```

Regla:

- No mostrar numero viejo como verdad definitiva si hay recalculo pendiente.

---

## 20. Inventario De Componentes

Estos componentes deben existir en wireframe/prototipo para no inventarlos durante implementacion.

| Componente | Uso | Reglas |
|---|---|---|
| Sidebar desktop | Navegacion principal. | Labels visibles humanos. |
| Bottom nav mobile | Accesos principales. | Maximo 5 items. |
| Topbar | Titulo, busqueda, acciones. | No saturar con botones. |
| Busqueda natural | Consulta read-only. | Resultados inline o navegacion filtrada. |
| Card de estado | Dinero libre, pendiente, compromiso. | Una idea por card. |
| Fila de movimiento | Historial escaneable. | Fuente/estado visibles. |
| Badge de estado | Pendiente, corregido, vencido. | No depender solo del color. |
| Drawer/modal | Detalle, explicacion, nuevo movimiento. | Cierre claro y foco controlado. |
| Formulario dinamico | Nuevo movimiento. | Campos segun tipo. |
| Empty state | Pantallas sin datos. | Una accion pequena. |
| Toast/banner | Recalculo, guardado, error. | Breve y no invasivo. |
| Confirmacion sensible | Borrar, ajustar, cerrar deuda. | Contexto completo antes de aceptar. |
| Filtros | Movimientos y busqueda. | Compactos en mobile. |

Regla:

> Si un componente se repite en 3+ pantallas, debe tener comportamiento consistente.

---

## 21. Pantallazos Requeridos

Los pantallazos deben capturarse despues de actualizar el prototipo para alinearlo con `17_dashboard_ux.md`.

Ruta sugerida:

```text
prototypes/[prototipo-aprobado]/screenshots/
```

### 21.1 Desktop

| Archivo sugerido | Estado |
|---|---|
| `home-desktop-functional.png` | Home con datos. |
| `home-desktop-empty.png` | Home sin datos. |
| `movements-desktop-list.png` | Lista y filtros. |
| `movement-detail-desktop.png` | Detalle con fuente y explicacion. |
| `manual-movement-desktop.png` | Nuevo movimiento. |
| `pending-desktop-batch.png` | Pendientes con email/batch. |
| `money-desktop-with-accounts.png` | Mi Dinero con desglose. |
| `money-desktop-empty.png` | Mi Dinero sin cuentas. |
| `debts-desktop.png` | Deudas activas. |
| `upcoming-payments-desktop.png` | Pagos que vienen. |
| `discoveries-desktop.png` | Descubrimientos. |
| `search-desktop-results.png` | Busqueda natural. |
| `settings-desktop-privacy.png` | Configuracion y modo discreto. |
| `recalculation-desktop.png` | Estado recalculando. |

### 21.2 Mobile

| Archivo sugerido | Estado |
|---|---|
| `home-mobile-functional.png` | Home con datos. |
| `home-mobile-empty.png` | Home sin datos. |
| `movements-mobile-list.png` | Lista mobile. |
| `manual-movement-mobile.png` | Drawer/modal mobile. |
| `pending-mobile.png` | Pendientes mobile. |
| `money-mobile.png` | Mi Dinero mobile. |
| `more-mobile-menu.png` | Menu Mas. |
| `search-mobile.png` | Busqueda mobile. |
| `discreet-mobile-preview.png` | Preview discreto. |

Regla:

> Si no hay pantallazo mobile, el prototipo no esta validado.

---

## 22. Versionado De Pantallazos

Los pantallazos deben versionarse como evidencia, no como imagenes sueltas.

Cada captura debe tener:

- archivo,
- fecha,
- viewport,
- pantalla,
- estado de datos,
- commit/version del prototipo si aplica,
- nota de alineacion.

Formato sugerido:

```text
Archivo: home-mobile-empty.png
Fecha: 2026-05-26
Viewport: 390x844
Estado: vacio
Version prototipo: [nombre-version-aprobada]
Alineacion: completa / parcial / desalineada
Notas: falta accion secundaria de WhatsApp
```

Regla:

> Un pantallazo viejo no debe usarse como referencia si contradice el documento actual.

---

## 23. Estado Actual Del Prototipo

Estado:

```text
Fase 6 visual V1 activa como fuente documental.
Prototipo visual generado pendiente de aprobacion final contra Fase 6.
```

### 23.0 Estado Visual Actual

```text
Fase 6 documental V1 activa.
Sin prototipo visual aprobado como referencia superior a documentos.
Sin ruta local de referencia visual aprobada.
```

Cualquier candidato visual previo queda como antecedente no oficial y no cambia wireframes funcionales, alcance V1, reglas financieras, email parsing ni arquitectura.

### 23.1 Referencia Anterior Util

Antecedente:

```text
dashboard-v2
```

`dashboard-v2` fue eliminado como carpeta local. Sirvio para entender flujo, contenido base y modulos esperados. No debe usarse como diseño final ni como referencia profesional.

### 23.2 Intento Local Descartado

Ruta:

```text
prototypes/manzana-v3/ (descartado/no usar)
```

`manzana-v3` fue descartado porque no elevo suficientemente la direccion visual y repitio demasiado la estructura anterior. Puede eliminarse y no debe usarse como referencia visual para implementacion.

### 23.3 Pendientes Visuales

- Generar o aprobar prototipo visual contra Fase 6.
- Usar Fase 6 como direccion visual antes de codificar UI final.
- Capturar versiones desktop/mobile.
- Hacer QA visual con estados funcional, vacio, pendiente, sensible, error y recalculando.
- Aplicar logo o direccion de logo profesional.
- Revisar con criterio de diseño antes de lanzamiento publico amplio.

### 23.4 Decision

La implementacion puede avanzar con Core/backend y estructura funcional. La UI final debe usar Fase 6 como fuente visual documental y cualquier prototipo debe aprobarse contra esa fase antes de tratarse como referencia final.

---

## 24. QA Visual Antes De Aceptar Prototipo

Antes de aceptar una iteracion visual, revisar:

### 24.1 Layout

- No hay solapes.
- No hay texto cortado.
- CTAs caben en mobile compacto.
- Cards no saltan de tamaño por hover o contenido.
- La bottom nav no tapa acciones principales.
- Drawers/modales caben en alto mobile.

### 24.2 Contenido

- No aparecen `Insights`, `Recurrentes` o `Nudges` como labels principales.
- No hay S/0 falso en dinero libre.
- Pendientes no parecen movimientos confirmados.
- Estados vacios no muestran todas las features.
- Descubrimientos no suenan a diagnostico.

### 24.3 Interaccion

- Teclado puede navegar.
- Focus visible.
- Escape/cancelar cierra drawers.
- Busqueda no ejecuta escrituras.
- Borrar/ajustar/cerrar deuda pide confirmacion.

### 24.4 Privacidad

- No hay montos sensibles en title/browser preview.
- Modo discreto/previews no exponen persona, comercio o monto sensible.
- Sesion expirada oculta datos.

---

## 25. Checklist De Validacion Visual

Antes de considerar el prototipo alineado:

- Home se entiende en 10 segundos.
- No hay labels tecnicos visibles.
- Pendientes tiene badge y estado claro.
- Los pendientes no parecen movimientos confirmados.
- Dinero libre no se muestra si faltan datos.
- Nuevo movimiento cambia campos por tipo.
- Busqueda natural no ejecuta escrituras.
- Mobile no tiene solapes ni CTAs cortados.
- Estados vacios ofrecen una accion pequeña.
- Modo discreto no expone datos sensibles en previews.
- Error/recalculo no dejan pantalla rota.
- Cada dato importante tiene fuente o acceso a explicacion.
- El prototipo no usa graficos decorativos para llenar espacio.

---

## 26. Handoff A OpenSpec / Cursor / Claude

Cuando se use para construir, el orden correcto de contexto es:

1. `especificacion_producto_finanzas_personales_ia.md`
2. `docs/fase_2_estrategia/alcance_v1/05c_dashboard.md`
3. `docs/fase_3_producto/17_dashboard_ux.md`
4. `docs/fase_3_producto/18_wireframes_prototipo.md`
5. Fase 6 visual V1 (`docs/fase_6_visual/28` a `33`)
6. Prototipo visual aprobado contra Fase 6 como referencia de implementacion visual

Instruccion recomendada:

```text
Implementa el Dashboard siguiendo la especificacion.
Usa Fase 6 visual V1 como fuente visual de marca, tokens y componentes.
Si ya existe un prototipo visual aprobado, usalo como referencia principal.
No uses prototypes/manzana-v3 como referencia visual; fue descartado.
Si el prototipo contradice los docs, sigue los docs.
```

No decir:

```text
Copia este prototipo tal cual.
```

---

## 27. Eventos Y Validacion

Eventos visuales/producto a validar:

- `dashboard_home_seen`
- `dashboard_empty_state_seen`
- `dashboard_empty_cta_clicked`
- `dashboard_manual_movement_started`
- `dashboard_manual_movement_saved`
- `dashboard_search_used`
- `dashboard_natural_search_action_redirected`
- `movement_detail_opened`
- `movement_explanation_viewed`
- `pending_review_opened`
- `pending_confirmed_dashboard`
- `money_free_explanation_opened`
- `dashboard_discreet_mode_applied`
- `dashboard_cross_channel_refreshed`

Metricas:

- Home understood in 10s.
- Empty-state conversion by screen.
- Manual movement completion.
- Search success rate.
- Pending resolution rate Dashboard.
- Mobile usability issue rate.
- Sensitive preview incidents.

---

## 28. Escenarios De Prueba Visual

1. Home desktop con datos.
2. Home mobile con datos.
3. Home vacio.
4. Movimientos con filtros abiertos.
5. Detalle de movimiento con fuente y explicacion.
6. Nuevo movimiento tipo gasto.
7. Nuevo movimiento tipo transferencia.
8. Nuevo movimiento tipo pago de deuda.
9. Pendientes con email, duda y pago que viene sugerido.
10. Pendientes vacio.
11. Mi Dinero con cuentas/cajas/compromisos.
12. Mi Dinero sin cuentas.
13. Deudas debt-first.
14. Pagos que vienen con sugerido y cambio de monto.
15. Descubrimientos con evidencia.
16. Descubrimientos sin datos suficientes.
17. Busqueda natural con resultado.
18. Busqueda natural intentando borrar.
19. Modo discreto / preview sensible.
20. Recalculo despues de correccion.
21. Error de carga.
22. Mobile menu `Mas`.
23. Sesion expirada.
24. Accesibilidad con teclado.

---

## 29. Criterios De Aceptacion

- El documento define wireframes textuales para las pantallas V1.
- El documento declara que los pantallazos reales siguen pendientes hasta actualizar el prototipo.
- Queda claro donde si van pantallazos y como documentarlos.
- El prototipo queda subordinado a las specs.
- Se identifican desalineaciones actuales del prototipo.
- Se definen viewports minimos para captura desktop/mobile.
- Se define inventario de componentes reutilizables.
- Se define versionado de pantallazos.
- Se define QA visual antes de aceptar el prototipo.
- Se define lista de pantallazos desktop/mobile requeridos.
- Se cubren estados funcional, vacio, error, recalculo y modo discreto.
- Se cubre busqueda natural read-only.
- Se cubre registro manual y sus variaciones por tipo.
- Se cubren Mi Dinero, Deudas, Pagos que vienen, Descubrimientos y Pendientes.
- El handoff a OpenSpec/Cursor/Claude queda claro.
- Los escenarios permiten validar que la UI no contradice experiencia, lenguaje ni confianza.

---

*Fase 3 Producto - Documento 18 - V2.2*
