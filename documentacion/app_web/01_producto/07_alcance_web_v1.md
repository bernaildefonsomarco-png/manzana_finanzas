# 07 — Alcance de la aplicación web V1

**Bloque:** 01 — Producto
**Estado:** V1 (reescritura)
**Fecha:** 25 de julio de 2026
**Depende de:** `06_tesis_app_web.md`, `03_decisiones_producto_web.md`
**Documentos que dependen de este:** todos los de `04_modulos/` — ninguno se escribe sin que su alcance esté fijado aquí
**Fuentes:** `docs/fase_2_estrategia/alcance_v1/05c_dashboard.md` §20 (invertido), `docs/fase_2_estrategia/alcance_v1/indice.md` §4-5

---

## 1. Para qué existe este documento

Este es el **candado de alcance**. Ningún documento de módulo puede
especificar una funcionalidad que no esté marcada `IN` aquí, y ningún
documento puede omitir una que sí lo esté. Reemplaza al §20 de
`05c_dashboard.md`, que dejaba fuera de V1 casi todo lo que hace vendible a
una app financiera web.

Tres niveles, sin ambigüedad:

| Nivel | Significado |
|---|---|
| **IN** | Entra en V1-web. Se documenta completo y se implementa antes de considerar la app terminada. |
| **V1.1** | Reconocido como valioso, pero no bloquea el lanzamiento. Se documenta lo mínimo para no cerrarle la puerta en el modelo de datos. |
| **FUERA** | No entra. Si se quiere, requiere cambio explícito de alcance registrado en `03_decisiones_producto_web.md`. |

## 2. Los cuatro trabajos y sus módulos

Cobertura de los trabajos definidos en `06_tesis_app_web.md` §2:

| Trabajo | Módulos que lo cubren |
|---|---|
| 1. Saber dónde estoy | `24` Cuentas y cajas · `39` Home · `31` Deudas · `30` Pagos que vienen |
| 2. Registrar sin que duela | `26` Movimientos · `29` Captura sin fricción e importación · `28` Email y detección bancaria · `27` Pendientes · `41` Asistente |
| 3. Entender qué pasa | `25` Categorías · `34` Descubrimientos · `35` Reportes y gráficos · `36` Memoria y aprendizaje · `38` Búsqueda |
| 4. Decidir hacia adelante | `32` Presupuestos, metas y límites · `33` Proyecciones y simulación · `37` Recordatorios |

Los cuatro trabajos quedan cubiertos. El trabajo 4, inexistente en el corpus
anterior, aporta tres módulos nuevos.

## 3. Alcance por módulo

### 3.1 `MOD-CUENTAS` — Cuentas y cajas (doc 24)

| Nivel | Funcionalidad |
|---|---|
| **IN** | Crear, editar, archivar cuentas (digital, banco, físico, tarjeta débito/prepago). Crear, editar, eliminar cajas (compromiso, objetivo, emergencia). Cálculo de libre en cuentas y dinero libre operativo. Transferencias entre cuentas. Asignación interna a cajas. Saldo negativo permitido con aviso. Vinculación de caja a deuda o pago recurrente. Ajuste manual de saldo. |
| **V1.1** | Cajas compartidas entre cuentas como entidad propia (hoy la agregación cross-account es solo visual). Historial de saldo por cuenta a lo largo del tiempo. |
| **FUERA** | Multi-moneda con UI completa (el modelo conserva el campo `currency`). Conexión bancaria directa / open banking. Tarjeta de crédito como cuenta de saldo (vive en Deudas). |

### 3.2 `MOD-CATEGORIAS` — Categorías, subcategorías y etiquetas (doc 25)

| Nivel | Funcionalidad |
|---|---|
| **IN** | Las 12 categorías canónicas. Subcategorías propias del usuario (crear, renombrar, fusionar, eliminar). Etiquetas contextuales. Clasificación automática con corrección. Distinción entre `otros` (clasificado, no encaja) y `sin clasificar` (`category_id: null` + `needs_review`). Reclasificación masiva desde un listado filtrado. |
| **V1.1** | Reglas de clasificación definidas explícitamente por el usuario ("todo lo de X va a Y"). Iconos y colores personalizados por subcategoría. |
| **FUERA** | Cambiar el conjunto de 12 categorías base (son canónicas). Jerarquías de más de dos niveles. |

### 3.3 `MOD-MOVIMIENTOS` — Movimientos (doc 26)

| Nivel | Funcionalidad |
|---|---|
| **IN** | **Los 11 tipos canónicos guardables desde la propia pantalla** (cierra `C-05`). Listado con paginación por cursor, filtros server-side (tipo, estado, categoría, cuenta, rango de fechas, monto) y búsqueda por texto. Detalle completo con fuente y estado. Edición. Eliminación con confirmación. **Restauración** de eliminados. Historial de cambios por movimiento. Duplicar movimiento. Adjuntar nota. Selección múltiple para acciones en lote (recategorizar, etiquetar, eliminar). |
| **V1.1** | Adjuntar imagen de comprobante. Movimientos divididos entre categorías (split). |
| **FUERA** | OCR de boletas. Reconocimiento por voz. Movimientos compartidos entre usuarios. |

### 3.4 `MOD-PENDIENTES` — Pendientes y confirmaciones (doc 27)

| Nivel | Funcionalidad |
|---|---|
| **IN** | Bandeja unificada de pendientes de cualquier origen (correo, importación, detección de recurrentes, asistente). **Regla dura: todo pendiente nace confirmable o no nace** (cierra el P0.5 de la auditoría). Confirmar, editar antes de confirmar, descartar. Confirmación en lote con selección explícita. Agrupación por origen y por similitud. "Ya lo registré" que alimenta la deduplicación. Detección de duplicados antes de confirmar. |
| **V1.1** | Reglas de auto-confirmación para orígenes de alta confianza, siempre bajo opt-in explícito por origen. |
| **FUERA** | Auto-registro sin confirmación humana en cualquier circunstancia (regla no negociable heredada). |

### 3.5 `MOD-EMAIL` — Email y detección bancaria (doc 28)

| Nivel | Funcionalidad |
|---|---|
| **IN** | Conexión de Gmail por OAuth oficial. **Multi-buzón** (contrato ya implementado, cierra `C-15`). Detección de correos financieros de Yape y bancos por plantilla institucional versionada. Extracción con evidencia por campo. Deduplicación. Creación de pendientes (nunca movimientos directos). **Enriquecimiento: el usuario puede aportar contexto al confirmar, y ese contexto alimenta la memoria.** Backfill controlado. Salud del pipeline visible. Desconexión con archivado de pendientes abiertos. |
| **V1.1** | Outlook / Microsoft Graph. Reenvío manual de correos a una dirección de Manzana. |
| **FUERA** | IMAP con contraseña, contraseñas de aplicación, scraping o automatización no oficial del buzón (no negociable). Almacenar el cuerpo completo del correo por defecto. |

### 3.6 `MOD-CAPTURA` — Captura sin fricción e importación (doc 29)

| Nivel | Funcionalidad |
|---|---|
| **IN** | Registro rápido en una línea con parseo ("taxi 15", "almuerzo 22 yape"). Atajos de teclado globales. Plantillas de movimientos frecuentes. Duplicar desde el historial. Importación de CSV y extractos con mapeo de columnas, previsualización, detección de duplicados y confirmación por lote. **Deshacer una importación completa.** Procesamiento independiente por ítem: lo claro se registra, lo ambiguo queda pendiente (cierra `C-06`). |
| **V1.1** | Importación desde formatos propietarios de bancos peruanos específicos. Plantillas recurrentes programadas. |
| **FUERA** | Importación desde otras apps de finanzas (migración asistida). Captura por foto. |

### 3.7 `MOD-RECURRENTES` — Recurrentes y pagos que vienen (doc 30)

| Nivel | Funcionalidad |
|---|---|
| **IN** | Detección automática de pagos que se repiten, siempre como **sugerencia que el usuario confirma**. Creación manual. Estados: activo, sugerido, pausado, vencido, cancelado. Ocurrencias con marcado de pago. Calendario de compromisos. Vinculación con deudas y con cajas. Cambios de monto mostrados explícitamente. Saltar un periodo. Efecto sobre el dinero libre operativo sin doble descuento si hay caja que lo cubre. |
| **V1.1** | Predicción de monto variable a partir del historial. Negociación de fechas ("muévelo al día 5"). |
| **FUERA** | Pago automático real de servicios. Integración con pasarelas de pago. |

### 3.8 `MOD-DEUDAS` — Deudas (doc 31)

| Nivel | Funcionalidad |
|---|---|
| **IN** | Deuda informal, deuda a favor, préstamo bancario, tarjeta de crédito, cuota fija, préstamo dado y recibido. Creación atómica. Pagos parciales y totales con conciliación determinista de cuotas. Devoluciones. Interés y mora. Renegociación. Cierre. Personas relacionadas (ligeras y privadas: nombre, alias, relación). Progreso y calendario de vencimientos. |
| **V1.1** | Amortización con tabla de intereses calculada. Simulación de pago anticipado. |
| **FUERA** | Contactar a terceros por cualquier medio. Cobranza. Reporte a centrales de riesgo. Asesoría sobre refinanciamiento. |

### 3.9 `MOD-PRESUPUESTOS` — Presupuestos, metas y límites (doc 32) — **NUEVO**

| Nivel | Funcionalidad |
|---|---|
| **IN** | Presupuesto por categoría y periodo (semanal, quincenal, mensual). Metas de ahorro con monto objetivo y fecha, vinculables a una caja. Límites blandos (avisan) y duros (avisan y destacan). Semáforo de avance. Comportamiento definido al superarlos, sin lenguaje de culpa. Presupuesto sugerido a partir del historial del usuario. Relación explícita con el dinero libre. Copiar presupuesto del periodo anterior. **Renovación automática al cerrar el periodo, desactivable por presupuesto. Traspaso del sobrante al periodo siguiente, apagado por defecto.** |
| **V1.1** | Presupuesto de base cero. Reasignación entre categorías dentro del mismo periodo. Metas colaborativas. **Presupuestos por subcategoría. Aportes programados a metas. Alineación del periodo con el día de cobro del usuario.** |
| **FUERA** | Presupuestos por persona o grupo, incluidos los compartidos (V1 es usuario individual). Inversión de excedentes. **Bloqueo de gastos, gamificación, comparación social y recomendación de recortes: prohibidos, no diferidos.** |

Las dos funciones añadidas a IN vienen del doc 32 y amplían este documento
según `01_convenciones_y_plantillas.md` §2. Ambas son mecánica del ciclo de
vida de un presupuesto, no funcionalidad nueva: sin renovación, un presupuesto
mensual habría que recrearlo a mano cada mes.

### 3.10 `MOD-PROYECCIONES` — Proyecciones y simulación (doc 33) — **NUEVO**

| Nivel | Funcionalidad |
|---|---|
| **IN** | Proyección de cierre de periodo a partir del ritmo actual y los compromisos conocidos. **"¿Puedo permitirme X?"** con respuesta fundamentada en compromisos reales. Simulación de un gasto puntual sobre el dinero libre. Indicador de salud financiera explicado (nunca un número desnudo). **Todo supuesto declarado explícitamente junto a la cifra.** |
| **V1.1** | Escenarios guardados y comparables. Proyección a 3 y 6 meses. Simulación de cambio de ingreso. |
| **FUERA** | Asesoría de inversión de cualquier tipo. Predicción de ingresos no declarados por el usuario. Recomendación de productos financieros o bancos. |

### 3.11 `MOD-DESCUBRIMIENTOS` — Descubrimientos e insights (doc 34)

| Nivel | Funcionalidad |
|---|---|
| **IN** | Descubrimientos accionables con evidencia trazable a movimientos concretos. **Umbrales rediseñados para el patrón de uso web** (cierra la brecha señalada en `06_tesis_app_web.md` §7). Descubrimientos ligados a presupuestos y proyecciones, no solo comparativos históricos. Marcar como visto, útil o no útil. Recalculo y expiración cuando el usuario corrige datos base. Explicación de por qué se generó. |
| **V1.1** | Descubrimientos comparativos entre periodos largos. Resumen semanal como pieza narrativa. |
| **FUERA** | Comparación con otros usuarios o promedios de mercado. Diagnóstico de la persona (se observan patrones, no se diagnostica). |

### 3.12 `MOD-REPORTES` — Reportes, gráficos y exportación (doc 35) — **NUEVO**

| Nivel | Funcionalidad |
|---|---|
| **IN** | Reporte por periodo con desglose por categoría, cuenta y tipo. Comparativa entre periodos. Gráficos accesibles (con tabla equivalente y no dependientes solo del color). Exportación de movimientos a CSV. Exportación completa de todos los datos del usuario (obligación de privacidad). Filtros del reporte compartibles por URL. |
| **V1.1** | Exportación a PDF con formato de reporte. Reportes programados por correo. Exportación a XLSX. |
| **FUERA** | Reportes fiscales o tributarios. Estados financieros formales. Gráficos decorativos sin decisión asociada. |

### 3.13 `MOD-MEMORIA` — Memoria y aprendizaje (doc 36) — **NUEVO**

| Nivel | Funcionalidad |
|---|---|
| **IN** | Qué aprendió Manzana, visible y explicable (comercios, categorías habituales, hábitos, preferencias de lenguaje). Evidencia a favor y en contra de cada aprendizaje. Las cuatro acciones obligatorias: **ver, corregir, deshacer, olvidar** (cierra `C-08`). Estados de aprendizaje incluyendo suspendido y expirado. Reducción de confianza ante contradicción, no solo aumento. Exportación de lo aprendido. |
| **V1.1** | Explicación de cómo un aprendizaje concreto afectó una clasificación específica del pasado. |
| **FUERA** | Perfilado con fines publicitarios o de scoring. Compartir aprendizajes entre usuarios. Entrenar modelos con datos del usuario sin consentimiento explícito y revocable. |

### 3.14 `MOD-RECORDATORIOS` — Recordatorios in-app (doc 37)

| Nivel | Funcionalidad |
|---|---|
| **IN** | Centro de recordatorios dentro de la app. Configuración granular por tipo (pagos que vienen, cuotas de deuda, presupuesto en riesgo, pendientes acumulados). Política anti-fatiga heredada (máximo por día, horario silencioso, no repetir lo ya resuelto). Silenciar y pausar. Badge de conteo. Entrega por correo bajo opt-in explícito. **Ningún canal activado por defecto** (cierra `C-17`). |
| **V1.1** | Notificaciones push del navegador. Digest semanal por correo. |
| **FUERA** | SMS. WhatsApp (es la fase 2). Recordatorios que ejecuten acciones automáticamente. |

### 3.15 `MOD-BUSQUEDA` — Búsqueda y navegación rápida (doc 38)

| Nivel | Funcionalidad |
|---|---|
| **IN** | Búsqueda global sobre movimientos, deudas, cajas, pagos que vienen y categorías. Paleta de comandos con teclado. Búsqueda en lenguaje natural con evidencia y **sin mostrar porcentaje de confianza** (cierra `C-11`). Búsquedas guardadas. Resultados que distinguen movimientos confirmados de pendientes. |
| **V1.1** | Búsqueda por rango de monto en lenguaje natural. Sugerencias predictivas mientras se escribe. |
| **FUERA** | Búsqueda sobre el contenido de correos originales. |

### 3.16 `MOD-HOME` — Home y resumen financiero (doc 39)

| Nivel | Funcionalidad |
|---|---|
| **IN** | Estado financiero actual con dinero libre como cifra principal. Siguiente mejor acción priorizada. Pendientes destacados. Próximos compromisos. Descubrimiento destacado. Movimientos recientes. Avance de presupuestos. Estados progresivos: vacío, temprano, funcional, completo. Adaptación al uso real (si no usa deudas, no se le llena la pantalla de deudas). |
| **V1.1** | Personalización del orden de las secciones por el usuario. Widgets configurables. |
| **FUERA** | Panel de administración. Vista comparativa con otros periodos como pantalla principal (vive en Reportes). |

### 3.17 `MOD-ASISTENTE` — Asistente IA en la app (docs 20-23, 40-42) — **NUEVO**

| Nivel | Funcionalidad |
|---|---|
| **IN** | Asistente conversacional dentro de la app que **consulta, registra, corrige y explica**. Toda escritura pasa por tarjeta de confirmación explícita (`WEB-D013`). Respuestas fundamentadas: ninguna cifra sin evidencia trazable. Acciones inline sobre los resultados. Historial de conversación. Estados degradados honestos (si el motor no puede responder, lo dice; no inventa). Motor agnóstico de canal. |
| **V1.1** | Adjuntar un archivo al asistente para que lo interprete. Conversaciones guardadas y renombrables. |
| **FUERA** | Asistente que ejecute operaciones de dinero sin confirmación. Asistente con acceso de escritura directo a la base de datos. Voz. |

### 3.18 Transversales (docs 43-48)

| Módulo | IN | FUERA |
|---|---|---|
| `43` Auth y cuenta | Registro, login, verificación de correo, **recuperación de contraseña, reenvío de verificación, `/auth/callback`**, cierre de sesión, eliminación de cuenta. Errores en español (cierra `C-13`). | Multiusuario, roles, organizaciones. |
| `44` Onboarding web | Primer valor sin WhatsApp: cuenta financiera → primer movimiento o importación → correo opcional. | Onboarding guiado por WhatsApp (fase 2). |
| `45` Configuración y privacidad | Configuración en secciones navegables. Consentimientos granulares. **Modo discreto como preferencia de servidor** (cierra `C-04`). Exportar todo. Eliminar cuenta y datos. Declaración Limited Use publicada (cierra `C-16`). | Configuración de organización o equipo. |
| `46` Notificaciones y correo saliente | Correo transaccional. Preferencias por tipo. Anti-fatiga. Baja en un clic. | Marketing por correo sin opt-in. Push (V1.1). |
| `47` Ciclo de vida del dato | Comportamiento de cada módulo por **tramo de presentación** —vacío 0, temprano 1-10, funcional 11-50, completo 51+— y por **tramo de volumen** —normal, denso, muy denso—. | — |
| `48` Ayuda y explicabilidad | "¿De dónde sale esta cifra?" como patrón transversal reutilizable. Ayuda contextual. | Chat de soporte humano en vivo. |

## 4. Fuera de alcance global de V1-web

Se mantiene sin cambios respecto del corpus anterior, salvo donde se indica:

- Contabilidad formal, facturación, impuestos.
- Inversiones y asesoría financiera personalizada.
- Recomendación de bancos o productos financieros.
- Integración bancaria directa / open banking.
- Multiusuario: parejas, familias, equipos, roles y permisos.
- División de pagos entre personas.
- Voz y OCR.
- Shareables.
- UI multi-moneda completa (el modelo conserva `currency`).
- **WhatsApp como canal** — es la fase 2 completa, no un recorte.

## 5. Qué cambió respecto de `05c_dashboard.md` §20

Comparación explícita, para que quede registro de la inversión de alcance:

| Funcionalidad | En `05c` §20 | En V1-web |
|---|---|---|
| Presupuestos y metas | FUERA ("sin documento propio") | **IN** — doc 32 |
| Proyecciones | FUERA | **IN** — doc 33 |
| Reportes y gráficos | FUERA ("gráficos decorativos sin decisión") | **IN** — doc 35, con la condición de que todo gráfico habilite una decisión |
| Exportaciones | FUERA ("exportaciones complejas") | **IN** — doc 35, incluida la exportación total obligatoria por privacidad |
| IA de escritura en la app | FUERA (§15, read-only por decreto) | **IN** — doc 41, con confirmación explícita obligatoria |
| Reporting financiero avanzado | FUERA | Sigue FUERA (estados financieros formales) |
| Contabilidad, impuestos, inversiones, multiusuario | FUERA | Sigue FUERA |

Se invierten cinco exclusiones; las que respondían a la identidad del
producto ("no es contable", "no es multiusuario") se mantienen.

## 6. Criterios de aceptación

- `AC-ALCANCE-01` — Cada uno de los 16 documentos de módulo declara en su §2
  un alcance idéntico al fijado aquí; cualquier divergencia se resuelve
  actualizando este documento primero. Evidencia: `DOC`.
- `AC-ALCANCE-02` — Ninguna funcionalidad marcada `FUERA` aparece
  especificada como activa en ningún documento del corpus. Evidencia: `DOC`.
- `AC-ALCANCE-03` — Las funcionalidades `V1.1` no bloquean el modelo de datos:
  `13_modelo_datos_web_v1.md` deja el espacio necesario sin implementarlas.
  Evidencia: `DOC`.
- `AC-ALCANCE-04` — Los cuatro trabajos de `06_tesis_app_web.md` §2 tienen
  cobertura completa por los módulos `IN`. Evidencia: `DOC`.
