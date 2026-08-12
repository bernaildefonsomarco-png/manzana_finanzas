# Recorridos críticos

## Cómo leer las fichas

Cada ficha evalúa una transformación completa en tres dimensiones:

- **Funcional:** qué progreso consigue la persona y qué consecuencia queda registrada.
- **Cognitiva:** qué entiende sobre datos, evidencia, incertidumbre, opciones y siguiente paso.
- **Emocional:** qué transición sería deseable favorecer sin manipulación. Siempre se formula como **hipótesis pendiente**, nunca como emoción observada.

`Público observado` se limita al render inicial de las rutas indicadas. `Estático autenticado` significa que el recorrido se reconstruyó desde la implementación, sin iniciar sesión ni ejecutar acciones. Los IDs remiten a [`04-hallazgos-priorizados.md`](04-hallazgos-priorizados.md).

## J01. Descubrimiento público, autenticación y recuperación

**Estado de verificación:** render público observado en escritorio/móvil; autenticación, envíos, recuperación con token y soporte autenticado no verificados en vivo.

| Dimensión obligatoria | Evaluación |
|---|---|
| Desencadenante y trabajo | Una persona necesita entender qué es Manzana, decidir si puede confiarle información financiera, entrar o recuperar acceso. Busca llegar a una sesión utilizable sin perder su intención original. |
| Pasos actuales | `/empresa`, `/privacidad`, `/terminos`, `/contacto` o `/estado` → `/entrar` o `/crear-cuenta` → acceso/alta → posible `/verificar`; si perdió acceso: `/recuperar-clave` → enlace/callback → `/restablecer-clave` → `/inicio`; soporte adicional en `/ayuda*`. |
| Contexto inicial funcional/cognitivo/emocional | Funcional: sin sesión o sin acceso. Cognitivo: necesita comprender propósito, tratamiento de datos y requisitos. Emocional: puede llegar con cautela o frustración; esta condición es una hipótesis, no una observación. |
| Estado final deseado | Funcional: sesión recuperada o decisión informada de no continuar. Cognitivo: sabe qué ocurrió, qué falta y qué datos entregó. Emocional: hipótesis de pasar de cautela a seguridad suficiente para el siguiente paso, sin falsa tranquilidad. |
| Decisiones, esfuerzo y carga | Elegir entrar/crear cuenta, recordar credenciales, interpretar verificación opcional, buscar contacto y completar recuperación. La navegación pública desaparece en móvil y el contacto no es accionable, elevando la búsqueda manual (`UX-M-009`). Las reglas de contraseña no son visibles antes de enviar (`UX-L-002`). |
| Momentos de verdad, confianza y abandono | Promesas de privacidad; manejo de errores; preservación de `redirigir`; validez del enlace de recuperación. `/restablecer-clave` presenta un formulario antes de probar sesión (`UX-H-004`), lo que puede erosionar comprensión incluso si el backend rechaza después. |
| Agencia y feedback | Auth expone errores con `role="alert"` y mensajes de estado; recuperación permite reenviar. Falta demostrar expiración, enlace inválido, rate limit y retorno al destino original en runtime. |
| Recuperación | Hay rutas dedicadas para recuperar y restablecer. No está visible un estado inicial de token ausente/expirado. La página `/estado` es manual y no debe usarse para inferir salud actual (`UX-L-004`). |
| Cierre y siguiente paso | El éxito debería confirmar sesión y destino. En recuperación, debe distinguir “clave cambiada” de “formulario disponible”. La implementación declara cierre de otras sesiones después del cambio, pero no se ejecutó. |
| Evidencia, confianza y validación | Fuente: `src/features/auth/auth-screen.tsx:106-225`, `src/features/auth/reset-password-screen.tsx:15-24,41-43,81-123`, `src/features/public-site/public-site.tsx:17-86,186-211`. Runtime: 13 rutas seguras D/M. Confianza alta sobre render y estática; baja sobre resultado completo. Validar envíos, callback, expiración, redirección, teclado y comprensión. |

### Mapa emocional hipotético

| Etapa | Hipótesis de partida | Transición deseada | Señal a investigar |
|---|---|---|---|
| Explorar | Cautela ante propósito y datos | Comprensión suficiente para decidir libremente | Puede explicar qué hace Manzana y qué no promete. |
| Identificarse | Fricción o temor a quedar bloqueado | Control sobre acceso y errores | Entiende el error y el próximo intento seguro. |
| Recuperar | Frustración por pérdida de acceso | Confianza calibrada en el estado del enlace | Distingue enlace válido, expirado y ausente. |
| Cerrar | Incertidumbre sobre si ya entró | Confirmación clara y continuidad | Sabe dónde está y por qué llegó allí. |

## J02. Onboarding y primer valor

**Estado de verificación:** **estático autenticado; no verificado en vivo**.

| Dimensión obligatoria | Evaluación |
|---|---|
| Desencadenante y trabajo | Tras crear una cuenta, la persona necesita obtener valor sin configurar un sistema completo. Debe elegir una puerta: registrar un gasto, declarar dinero, conectar correo o mirar primero. |
| Pasos actuales | Alta → `/bienvenida` → `POST /api/v1/onboarding` → `/movimientos/nuevo`, `/mi-dinero`, `/bienvenida/correo` o `/inicio`; `/inicio` consulta estado y puede redirigir de vuelta. |
| Contexto inicial funcional/cognitivo/emocional | Funcional: cuenta nueva y contexto financiero aún vacío. Cognitivo: no conoce el modelo de Manzana ni qué puerta ofrece valor antes. Emocional: podría existir cautela ante otra configuración; hipótesis derivada del brief, no de usuarios observados. |
| Estado final deseado | Funcional: obtiene una primera claridad o acción útil, no solo un dato almacenado. Cognitivo: comprende qué usó Manzana y qué falta. Emocional: hipótesis de pasar de esfuerzo anticipado a capacidad manejable. |
| Decisiones, esfuerzo y carga | Una decisión inicial entre cuatro opciones. El copy declara una propuesta específica de “dinero de verdad”, aunque el trabajo inicial del brief sigue abierto. Cada puerta añade carga distinta y no se observó cuál entrega valor suficiente. |
| Momentos de verdad, confianza y abandono | Persistir avance antes de navegar evita repetir onboarding. El código ignora fallas de red y estados HTTP antes de navegar (`UX-H-006`); `/inicio` puede devolver a `/bienvenida`, creando una contradicción visible. |
| Agencia y feedback | Se puede elegir o “mirar primero”; los botones bloquean acciones paralelas mientras cargan. No hay feedback de error ni recuperación si guardar el avance falla. |
| Recuperación | Si el guard conserva `not_started`, la persona vuelve a bienvenida. No se explica por qué ni se preserva la puerta elegida. No hay prueba de retorno tras cierre/interrupción a mitad de una puerta. |
| Cierre y siguiente paso | El recorrido no debería cerrar con “onboarding completado”, sino con evidencia de primera utilidad. La implementación no define una verificación transversal de ese valor y el brief mantiene abierta su definición. |
| Evidencia, confianza y validación | `src/features/onboarding/welcome-screen.tsx:10-36,51-87`; `src/app/(app)/inicio/page.tsx:10-40`. Confianza alta en el defecto de persistencia; resultado del recorrido no verificado. Probar las cuatro puertas con respuestas 2xx/4xx/5xx/offline, reentrada y entrevistas sobre utilidad. |

### Mapa emocional hipotético

| Etapa | Hipótesis de partida | Transición deseada | Señal a investigar |
|---|---|---|---|
| Elegir puerta | Duda sobre cuánto trabajo exigirá | Percepción de una elección acotada | Puede anticipar el beneficio y cambiar de opción. |
| Aportar contexto | Exposición ante información sensible | Control y ausencia de juicio | Entrega solo lo necesario y entiende su uso. |
| Recibir valor | Incertidumbre sobre si el esfuerzo valió | Claridad concreta, no celebración genérica | Puede describir una comprensión o acción nueva. |
| Retomar | Posible frustración si vuelve a bienvenida | Continuidad sin repetir trabajo | La elección previa se conserva o se explica su pérdida. |

## J03. Conversación, propuesta y resultado del asistente

**Estado de verificación:** **estático autenticado; no verificado en vivo**. La captura aportada por el usuario muestra un 500 histórico/no fechado en `POST /api/v1/assistant/turns`; recurrencia y causa desconocidas.

| Dimensión obligatoria | Evaluación |
|---|---|
| Desencadenante y trabajo | La persona expresa una pregunta o intención en lenguaje natural y espera que Manzana aclare, muestre evidencia, proponga una acción y confirme su consecuencia. |
| Pasos actuales | Abrir panel global o `/asistente` → enviar mensaje → revisar bloques (`pregunta`, `lista`, `mostrar`, `accion`, `propuesta`, evidencia, límites) → corregir/confirmar/descartar → ver resultado → continuar o consultar hilos. |
| Contexto inicial funcional/cognitivo/emocional | Funcional: intención no estructurada. Cognitivo: no debería aprender comandos ni traducir su situación. Emocional: puede existir incertidumbre al delegar interpretación; hipótesis pendiente. |
| Estado final deseado | Funcional: respuesta útil o acción confirmada. Cognitivo: sabe qué entendió Manzana, qué evidencia usó, qué es incierto y qué cambió. Emocional: hipótesis de confianza calibrada y agencia, no obediencia ciega. |
| Decisiones, esfuerzo y carga | Decidir entre opciones, revisar propuesta, corregir campos inciertos y confirmar. La carga aumenta cuando controles visibles no actúan o llevan a una entidad distinta (`UX-H-001`) y cuando una duplicidad no permite la segunda confirmación (`UX-H-002`). |
| Momentos de verdad, confianza y abandono | Correspondencia entre texto del botón y resultado; persistencia del hilo; evidencia; recuperación de error. `accion` es no-op, `lista` no recibe handler y `mostrar` siempre va a Movimientos. El asistente a pantalla completa oculta navegación móvil sin salida propia (`UX-M-003`). |
| Agencia y feedback | La `ConfirmationCard` permite confirmar, descartar y editar; el mismo `pending_item` se comparte con Pendientes. La API puede exigir confirmación adicional, pero la tarjeta solo repite la llamada inicial. Los errores de envío deben conservar borrador; falta validar runtime. |
| Recuperación | Debe permitir reintentar sin duplicar, corregir interpretación, usar vía manual y retomar hilo. Existen idempotencia y rutas manuales, pero los controles rotos y el historial no probado impiden confirmar continuidad. |
| Cierre y siguiente paso | Una propuesta resuelta permanece en el hilo y debería mostrar una consecuencia verificable en la superficie correspondiente. El destino genérico `/movimientos` rompe el cierre para deuda, presupuesto, pago, descubrimiento o reporte. |
| Evidencia, confianza y validación | `src/app/(app)/asistente/assistant-message.tsx:40-60`; `src/ui/domain/blocks/accion-block-view.tsx:8-19`; `lista-block-view.tsx:6-27`; `mostrar-block-view.tsx:25-43`; `assistant-api.ts:70-81`; `use-assistant-proposal-actions.ts:23-31`; `assistant-proposal-card.tsx:68-93`. Alta confianza estática; runtime autenticado pendiente. |

### Mapa emocional hipotético

| Etapa | Hipótesis de partida | Transición deseada | Señal a investigar |
|---|---|---|---|
| Expresar | Duda sobre cómo formular la situación | Sentirse comprendido sin aprender comandos | Usa palabras propias y reconoce la interpretación. |
| Aclarar | Frustración posible por malentendido | Corrección normal y sin pérdida | Corrige sin reiniciar ni temer consecuencias. |
| Revisar | Incertidumbre ante propuesta | Confianza calibrada por evidencia | Explica datos, incertidumbre y efecto antes de confirmar. |
| Confirmar | Riesgo de ceder control | Agencia deliberada | Puede aplazar, editar, descartar o confirmar conscientemente. |
| Cerrar | Duda sobre si algo cambió | Consecuencia verificable y continuidad | Encuentra el resultado correcto y sabe qué sigue. |

## J04. Movimientos

**Estado de verificación:** **estático autenticado; no verificado en vivo**.

| Dimensión obligatoria | Evaluación |
|---|---|
| Desencadenante y trabajo | Registrar, encontrar, clasificar, corregir, eliminar o restaurar una transacción para que la visión financiera represente mejor la realidad. |
| Pasos actuales | `/movimientos` → buscar/filtrar → `/movimientos/nuevo` o selección de fila → `/movimientos/[id]` interceptado/completo → editar/clasificar/historial/eliminar/restaurar; categorías en `/configuracion/categorias*`; importación deriva a placeholder. |
| Contexto inicial funcional/cognitivo/emocional | Funcional: dato faltante o incorrecto. Cognitivo: necesita diferenciar movimiento real, pago futuro, deuda y transferencia. Emocional: podría temer alterar saldos; hipótesis pendiente. |
| Estado final deseado | Funcional: movimiento correcto y saldos reconciliados. Cognitivo: entiende clasificación, procedencia, vínculos y reversibilidad. Emocional: hipótesis de control tras corregir sin castigo. |
| Decisiones, esfuerzo y carga | Tipo, monto, fecha, cuenta, categoría y duplicidad. La protección contra duplicados reduce riesgo. El `DatePicker` dificulta escritura progresiva y borrado (`UX-M-004`); importar termina en placeholder (`UX-M-011`). |
| Momentos de verdad, confianza y abandono | Prevención de fecha futura, confirmación de duplicado, especialización de deudas/recurrentes y reversión. El overlay interceptado no gestiona semántica/foco (`UX-H-008`), lo que puede bloquear teclado/lector de pantalla. |
| Agencia y feedback | Edición, eliminación confirmada, restauración, historial y reclasificación por lote con deshacer. Los errores de borrar/restaurar se guardan como texto visible, aunque falta verificar anuncio y foco. |
| Recuperación | Error de carga ofrece reintento; eliminación puede restaurarse; transacciones especializadas remiten a su dominio. Debe probarse el retorno de foco al cerrar overlay y el comportamiento tras recarga directa. |
| Cierre y siguiente paso | Debe mostrar el movimiento actualizado y reflejar saldos/proyecciones. El detalle ofrece “Volver a movimientos”; no se validó actualización cruzada. |
| Evidencia, confianza y validación | `src/app/(app)/movimientos/movement-detail-view.tsx:45-90,93-138`; `src/app/(app)/movimientos/@panel/(.)[id]/page.tsx:20-38`; `src/ui/primitivas/date-picker.tsx:18-24,56-69`. Alta confianza estática; probar teclado, duplicados, reversión y derivados. |

### Mapa emocional hipotético

| Etapa | Hipótesis de partida | Transición deseada | Señal a investigar |
|---|---|---|---|
| Registrar | Temor a equivocarse o a mantener demasiado | Esfuerzo proporcional y campo corregible | Completa lo mínimo y sabe qué puede cambiar. |
| Revisar | Duda sobre impacto en saldos | Comprensión de procedencia y vínculos | Explica por qué cambió una cifra. |
| Corregir/eliminar | Riesgo percibido de pérdida | Agencia por confirmación y restauración | Distingue borrar, archivar, restaurar y efecto real. |
| Cerrar | Incertidumbre sobre sincronización | Resultado visible en superficies relacionadas | Verifica la consecuencia sin repetir navegación. |

## J05. Revisión de Pendientes

**Estado de verificación:** **estático autenticado; no verificado en vivo**.

| Dimensión obligatoria | Evaluación |
|---|---|
| Desencadenante y trabajo | Revisar inferencias o entradas detectadas antes de que afecten saldos: completar, confirmar, descartar, marcar duplicado o resolver por lote. |
| Pasos actuales | `/pendientes` → identificar origen/confianza → seleccionar o editar → confirmar/descartar/marcar ya registrado → posible segunda confirmación de duplicado → feedback; `/pendientes/[id]` es placeholder. |
| Contexto inicial funcional/cognitivo/emocional | Funcional: elementos separados de saldos. Cognitivo: necesita saber origen, datos faltantes y consecuencia. Emocional: puede existir recelo ante automatización; hipótesis pendiente. |
| Estado final deseado | Funcional: elemento convertido en movimiento o resuelto sin duplicar. Cognitivo: distingue qué cambió y qué quedó intacto. Emocional: hipótesis de control informado. |
| Decisiones, esfuerzo y carga | Revisar individualmente o por lote, resolver duplicados, editar campos. La búsqueda visible no hace nada (`UX-M-002`) y el detalle por URL no existe aún (`UX-M-011`). |
| Momentos de verdad, confianza y abandono | El principio “nada toca saldos sin confirmar” es fuerte. Sin embargo, errores de carga/mutación se presentan con check verde y estilo de éxito (`UX-H-003`), por lo que el estado real puede interpretarse mal. |
| Agencia y feedback | Confirmar, descartar, marcar ya registrado, editar y lotes. La segunda confirmación existe aquí, un buen patrón que el asistente no comparte. Feedback no distingue tono ni live-region. |
| Recuperación | Error de carga ofrece reintento; duplicidad conserva el elemento y solicita revisar. Error de actualización puede propagarse sin feedback específico. Falta probar selección, foco y parcialidad de lotes. |
| Cierre y siguiente paso | El copy indica movimiento creado o trazabilidad conservada; debería enlazar o exponer la consecuencia concreta. No se observó el estado posterior. |
| Evidencia, confianza y validación | `src/features/pending/pending-screen.tsx:124-135,138-180,186-199,233-259,302-361`; placeholder `src/app/(app)/pendientes/[id]/page.tsx:1-13`. Alta confianza en defectos estáticos; validar resultados parciales y anuncio. |

### Mapa emocional hipotético

| Etapa | Hipótesis de partida | Transición deseada | Señal a investigar |
|---|---|---|---|
| Abrir bandeja | Recelo ante elementos detectados | Comprensión de que están separados | Explica que aún no afectan saldos. |
| Revisar | Carga por ambigüedad | Decisión acotada con evidencia | Distingue confirmar, corregir y descartar. |
| Resolver duplicado | Miedo a duplicar | Confianza en revisión y segunda confirmación | Identifica coincidencia y efecto de insistir. |
| Cerrar | Duda sobre éxito/error | Estado inequívoco | Puede decir qué se registró y qué quedó pendiente. |

## J06. Dinero, cuentas y cajas

**Estado de verificación:** **estático autenticado; no verificado en vivo**.

| Dimensión obligatoria | Evaluación |
|---|---|
| Desencadenante y trabajo | Declarar dónde está el dinero, organizarlo en cuentas/cajas y comprender saldo, compromisos y dinero libre. |
| Pasos actuales | `/mi-dinero` → crear/revisar cuenta o caja → `/mi-dinero/cuentas/[id]` o `/mi-dinero/cajas/[id]` → editar, mover, archivar/restaurar o vincular; revisar procedencia de cifras. |
| Contexto inicial funcional/cognitivo/emocional | Funcional: saldos dispersos o no declarados. Cognitivo: debe distinguir cuenta, caja, saldo y dinero libre. Emocional: compartir montos puede sentirse sensible; hipótesis pendiente. |
| Estado final deseado | Funcional: representación útil, aunque parcial. Cognitivo: conoce qué se contó, qué se excluyó y por qué. Emocional: hipótesis de claridad calibrada, no certeza artificial. |
| Decisiones, esfuerzo y carga | Tipo de cuenta, moneda, saldo inicial, cuenta predeterminada, asignación de cajas y archivo. La procedencia y modo discreto son fundamentos; se necesita comprobar si el modelo cuenta/caja es comprendido. |
| Momentos de verdad, confianza y abandono | Cifra de dinero libre y sus exclusiones; efecto de archivar/restaurar; consistencia con deudas y pagos futuros. Una cifra sin evidencia comprensible puede producir falsa confianza aunque el componente exista. |
| Agencia y feedback | Panel de procedencia ofrece contado/no contado y filas; cuentas archivadas pueden restaurarse junto con cajas. Deben verificarse confirmaciones y errores de transferencias/asignaciones. |
| Recuperación | Estados de carga/error y restauración están implementados. Falta probar fallas parciales, moneda mixta, cuenta predeterminada y regreso tras interrupción. |
| Cierre y siguiente paso | Debe quedar una cifra explicable y una acción manejable, no obligación de completar todo. El trabajo inicial exacto sigue abierto, por lo que no se aprueba “dinero libre” como valor principal. |
| Evidencia, confianza y validación | `src/ui/domain/money-with-provenance.tsx:6-60`; `src/ui/domain/provenance-panel.tsx:10-39,57-79,95-136`; rutas en inventario. Confianza media-alta estática; validar modelo mental y exactitud cruzada. |

### Mapa emocional hipotético

| Etapa | Hipótesis de partida | Transición deseada | Señal a investigar |
|---|---|---|---|
| Declarar | Exposición o duda sobre exactitud | Permiso para empezar con parcialidad | Entiende que puede corregir y qué falta. |
| Organizar | Confusión entre cuenta/caja | Modelo mental manejable | Predice efecto de mover o archivar. |
| Interpretar | Riesgo de confiar en una cifra | Confianza calibrada por procedencia | Explica contados, excluidos y supuestos. |
| Cerrar | Duda sobre próxima acción | Siguiente paso acotado | Decide una acción sin reconstruir toda su historia. |

## J07. Deudas

**Estado de verificación:** **estático autenticado; no verificado en vivo**.

| Dimensión obligatoria | Evaluación |
|---|---|
| Desencadenante y trabajo | Registrar una obligación o préstamo, comprender saldo/cuotas, pagar, reprogramar, cerrar o reabrir. |
| Pasos actuales | `/deudas` → crear/seleccionar → `/deudas/[id]` → registrar pago, revisar cuotas/historial, reprogramar/saltar, cerrar o reabrir. Movimientos especializados remiten a este dominio. |
| Contexto inicial funcional/cognitivo/emocional | Funcional: obligación dispersa o cambiante. Cognitivo: distingue dirección, principal, pago, cuota y estado. Emocional: información difícil puede resultar amenazante; hipótesis pendiente. |
| Estado final deseado | Funcional: deuda y pagos coherentes. Cognitivo: sabe cuánto, a quién, cuándo y qué cambió. Emocional: hipótesis de claridad manejable sin juicio ni minimización. |
| Decisiones, esfuerzo y carga | Dirección de deuda, interés, cuotas, cuenta, cobertura, fecha, cierre irreversible/reapertura. El número de operaciones aumenta carga, pero los diálogos específicos muestran detalle y errores. |
| Momentos de verdad, confianza y abandono | Consecuencia de pago y cierre, asignación de cuotas, reversión. La especificación E2E de cierre está deshabilitada, por lo que el comportamiento real no está probado. |
| Agencia y feedback | Diálogos para editar, pagar, cerrar, reabrir, reprogramar y saltar; estados de error locales. Las confirmaciones son proporcionales en varias operaciones, fundamento a conservar. |
| Recuperación | Carga y detalle exponen reintento; errores de mutación preservan diálogo. Debe verificarse idempotencia, fallas parciales, pago duplicado y retorno de foco. |
| Cierre y siguiente paso | Debe mostrar saldo/estado actualizado, historial y efecto en dinero libre. Falta validación cruzada con Movimientos, Pagos que vienen y proyecciones. |
| Evidencia, confianza y validación | `src/features/debts/debts-screen.tsx:71-175,245-374`; `src/features/debts/debts-dialogs.tsx:469-777,798-1072`; `tests/e2e/irreversibles/cerrar-deuda.spec.ts:4`. Confianza media estática; recorrido completo pendiente. |

### Mapa emocional hipotético

| Etapa | Hipótesis de partida | Transición deseada | Señal a investigar |
|---|---|---|---|
| Registrar | Posible vergüenza o evitación | Lenguaje neutral y control | Describe la deuda sin sentirse calificado. |
| Revisar | Incertidumbre sobre obligación | Claridad sobre hechos y supuestos | Explica saldo, cuotas y fechas. |
| Actuar | Temor a registrar pago/cierre incorrecto | Agencia por previsualización | Predice la consecuencia antes de confirmar. |
| Cerrar | Duda sobre resolución real | Cierre visible y siguiente compromiso | Comprueba estado e historial coherentes. |

## J08. Pagos recurrentes y próximos

**Estado de verificación:** **estático autenticado; no verificado en vivo**.

| Dimensión obligatoria | Evaluación |
|---|---|
| Desencadenante y trabajo | Evitar olvidar un compromiso, confirmar un patrón detectado, registrar una ocurrencia o ajustar una regla recurrente. |
| Pasos actuales | `/pagos-que-vienen` → revisar calendario/compromisos/sugerencias → aceptar con evidencia, descartar, crear o editar → marcar pago/omitir → `/pagos-que-vienen/[id]` para regla e historial. Conexión de correo puede generar Pendientes. |
| Contexto inicial funcional/cognitivo/emocional | Funcional: obligación futura o patrón posible. Cognitivo: debe distinguir estimación de hecho y compromiso de movimiento ocurrido. Emocional: puede existir preocupación por olvidar; hipótesis pendiente. |
| Estado final deseado | Funcional: compromiso visible y controlable sin crear un movimiento prematuro. Cognitivo: sabe evidencia, variabilidad, próxima fecha y efecto en dinero libre. Emocional: hipótesis de previsión sin alarmismo. |
| Decisiones, esfuerzo y carga | Confirmar patrón, monto fijo/variable, frecuencia, cuenta, categoría, ocurrencia y archivo. Las sugerencias exponen evidencia y no se activan sin confirmación, fundamento fuerte. |
| Momentos de verdad, confianza y abandono | Evidencia concreta, límites de estimación, registro de ocurrencia y actualización de siguiente fecha. Desbordes de calendario/listas requieren runtime (`UX-L-003`). |
| Agencia y feedback | Aceptar/descartar sugerencia, editar regla, registrar/omitir pago. Confirmación explícita protege saldos. Deben probarse errores y estados simultáneos. |
| Recuperación | Estados de carga/error y diálogos conservan datos en varios casos. Falta validar offline, idempotencia y retorno tras interrupción de una edición. |
| Cierre y siguiente paso | Debe distinguir “regla activada”, “ocurrencia pagada” y “movimiento creado”. La consecuencia debe reflejarse en recordatorios, dinero libre y detalle. |
| Evidencia, confianza y validación | `src/features/upcoming/upcoming-screen.tsx:737-784,1008-1030`; rutas de detalle. Confianza alta en patrón estático de evidencia; recorrido completo pendiente. |

### Mapa emocional hipotético

| Etapa | Hipótesis de partida | Transición deseada | Señal a investigar |
|---|---|---|---|
| Detectar | Duda sobre si el patrón es real | Confianza calibrada por evidencia | Diferencia sugerencia de compromiso activo. |
| Confirmar | Riesgo de automatización no deseada | Consentimiento explícito | Explica qué se activó y cómo revocarlo. |
| Acercarse fecha | Posible preocupación | Información específica y manejable | Identifica monto, fecha y acción sin alarma. |
| Resolver | Duda sobre registro | Cierre coherente entre regla y movimiento | Verifica la ocurrencia y la próxima fecha. |

## J09. Presupuestos y metas

**Estado de verificación:** **estático autenticado; no verificado en vivo**.

| Dimensión obligatoria | Evaluación |
|---|---|
| Desencadenante y trabajo | Planificar un límite o una meta, revisar progreso y adaptar el plan sin confundirlo con dinero apartado. |
| Pasos actuales | `/presupuestos` → alternar Presupuestos/Metas y periodo → crear/copiar/aceptar sugerencia → pausar/reanudar/archivar → `/presupuestos/[id]`; vincular meta a caja cuando corresponda. |
| Contexto inicial funcional/cognitivo/emocional | Funcional: intención de reservar o limitar. Cognitivo: necesita distinguir presupuesto, meta y caja. Emocional: podría temer “fallar” un presupuesto; hipótesis pendiente. |
| Estado final deseado | Funcional: plan y progreso correctos. Cognitivo: entiende alcance, periodo, evidencia y diferencia entre plan/apartado. Emocional: hipótesis de capacidad sin calificación moral. |
| Decisiones, esfuerzo y carga | Tipo, periodo, monto, categorías, copia anterior, caja y estado. Varias mutaciones de archivo/pausa no exponen error visible (`UX-M-005`). |
| Momentos de verdad, confianza y abandono | Progreso, sobrepaso, sugerencia y efecto de archivar. El copy aclara que planificar no aparta dinero, un fundamento; se debe validar comprensión. |
| Agencia y feedback | Crear, editar, copiar, pausar, reanudar y archivar; feedback de éxito. Las mutaciones de estado carecen de `onError`, de modo que una falla puede dejar solo ausencia de cambio. |
| Recuperación | Carga global ofrece reintento; diálogos muestran varios errores. Falta recuperación visible para acciones de lista y reconciliación de optimismo. |
| Cierre y siguiente paso | Debe confirmar el plan y enlazar progreso con movimientos/caja. No debe premiar interacción por sí misma ni definir el trabajo inicial. |
| Evidencia, confianza y validación | `src/features/budgets/budgets-screen.tsx:81-136,147-219`; `tests/e2e/recorridos/07-crear-presupuesto.spec.ts:4`. Confianza alta en ausencia de handlers de error; runtime pendiente. |

### Mapa emocional hipotético

| Etapa | Hipótesis de partida | Transición deseada | Señal a investigar |
|---|---|---|---|
| Planificar | Incertidumbre sobre cuánto fijar | Decisión proporcional y revisable | Entiende supuestos y puede ajustar. |
| Revisar progreso | Riesgo de interpretar juicio | Información neutral y accionable | Describe desviación sin lenguaje de fracaso. |
| Cambiar estado | Duda sobre efecto de pausar/archivar | Control y feedback inequívoco | Sabe qué dejó de mostrarse y qué se conserva. |
| Cerrar | Confusión plan/apartado | Modelo mental coherente | Predice efecto en caja y dinero libre. |

## J10. Descubrimientos, búsqueda, reportes y proyecciones

**Estado de verificación:** **estático autenticado; no verificado en vivo**.

| Dimensión obligatoria | Evaluación |
|---|---|
| Desencadenante y trabajo | Entender adónde fue el dinero, responder una pregunta, revisar un hallazgo o explorar un escenario futuro con evidencia y límites. |
| Pasos actuales | `/buscar` o cabecera → resultados/filtros → `/movimientos` o `/asistente`; `/descubrimientos` → detalle/evidencia/acción; `/reportes` → periodo; `/proyecciones` → rango, supuestos y simulación. |
| Contexto inicial funcional/cognitivo/emocional | Funcional: pregunta o necesidad de interpretación. Cognitivo: necesita separar hechos, inferencias, exclusiones y escenarios. Emocional: puede buscar claridad ante incertidumbre; hipótesis pendiente. |
| Estado final deseado | Funcional: respuesta o decisión informada. Cognitivo: puede explicar evidencia, alcance y límites. Emocional: hipótesis de claridad calibrada, sin falsa certeza. |
| Decisiones, esfuerzo y carga | Elegir filtros, periodos, detalle, evidencia y escenario. El handoff de pregunta a `/asistente?q=...` pierde `q` (`UX-H-009`), obligando a repetir contexto. |
| Momentos de verdad, confianza y abandono | Procedencia de cifras, rango de proyección, exclusiones y continuidad entre búsqueda/conversación. `/estado` no participa y no debe confundirse con datos actuales. |
| Agencia y feedback | Búsqueda ofrece ruta alternativa a Movimientos; descubrimientos enlazan evidencia; proyección expone rango/supuesto. Falta verificar si la simulación se distingue claramente de una predicción. |
| Recuperación | Buscar muestra error y alternativa manual; reportes/proyecciones tienen estados de error. El handoff roto carece de recuperación automática. |
| Cierre y siguiente paso | La respuesta debería conservar la pregunta y conducir a evidencia o acción correspondiente, no a una lista genérica. El trabajo inicial exacto sigue abierto. |
| Evidencia, confianza y validación | `src/features/search/search-screen.tsx:91-107`; `src/app/(app)/asistente/page.tsx:8-23`; `src/features/projections/projection-summary-card.tsx:13-36`; procedencia compartida. Alta confianza en pérdida de query; comprensión de reportes/proyecciones pendiente. |

### Mapa emocional hipotético

| Etapa | Hipótesis de partida | Transición deseada | Señal a investigar |
|---|---|---|---|
| Preguntar | Confusión o curiosidad | Reconocimiento de intención | La pregunta llega intacta a la respuesta. |
| Revisar evidencia | Duda sobre fiabilidad | Confianza calibrada | Distingue hecho, inferencia y ausencia. |
| Simular | Riesgo de tomar escenario como certeza | Comprensión de rango y supuesto | Explica qué cambiaría el resultado. |
| Actuar | Sobrecarga de opciones | Siguiente paso manejable | Elige una acción pertinente sin repetir contexto. |

## J11. Recordatorios y regreso tras un lapso

**Estado de verificación:** **estático autenticado; no verificado en vivo**.

| Dimensión obligatoria | Evaluación |
|---|---|
| Desencadenante y trabajo | Un compromiso requiere atención o una persona regresa después de inactividad y necesita valor presente sin ponerse al día con todo. |
| Pasos actuales | Badge/cabecera o nudge → `/recordatorios` → enlace de acción, posponer o descartar → destino; preferencias en `/configuracion/recordatorios`; retorno por `/inicio` o `/pendientes`. |
| Contexto inicial funcional/cognitivo/emocional | Funcional: aviso pendiente o historial incompleto. Cognitivo: necesita saber por qué se le interrumpe y qué puede ignorar. Emocional: la culpa por acumulación es una hipótesis del brief, no un hecho observado. |
| Estado final deseado | Funcional: resolver o aplazar un objetivo propio. Cognitivo: entiende evidencia, control y consecuencia. Emocional: hipótesis de retorno sin castigo ni presión. |
| Decisiones, esfuerzo y carga | Abrir, actuar, posponer, descartar, pausar canales o cambiar preferencia. “Ver resueltos” lleva a un filtro ignorado (`UX-M-001`). “Ir” no describe el destino (`UX-L-001`). |
| Momentos de verdad, confianza y abandono | Pertinencia del aviso, permiso y control. El copy de regreso dice que no hace falta ponerse al día, una buena base; no se ha probado si el destino mantiene esa promesa. |
| Agencia y feedback | Posponer, descartar, pausar todo y configurar canales. Varias promesas rechazadas no tienen feedback visible (`UX-M-005`). |
| Recuperación | La bandeja ofrece reintento de carga; no hay experiencia global de reconexión. Debe probarse retorno con muchos pendientes, sin datos y con canal desconectado. |
| Cierre y siguiente paso | Debe confirmar resolución/posposición y actualizar badge; el filtro de cerrados debería permitir verificar cierre. Hoy esa verificación está rota. |
| Evidencia, confianza y validación | `src/features/reminders/reminders-screen.tsx:23-42,47-83,100-145`; `src/features/reminders/reminder-preferences-screen.tsx:65-73,121-135`; `src/core/nudges/nudge-evaluator.ts:339-365`. Alta confianza estática; efecto y pertinencia requieren usuarios. |

### Mapa emocional hipotético

| Etapa | Hipótesis de partida | Transición deseada | Señal a investigar |
|---|---|---|---|
| Ser interrumpido | Posible presión o recelo | Pertinencia y permiso | Explica por qué llegó el aviso y cómo detenerlo. |
| Regresar | Posible carga por acumulación | Valor presente sin puesta al día | Puede empezar por una sola necesidad. |
| Resolver/aplazar | Duda sobre control | Agencia sin penalización | Posponer/descartar funciona y se entiende. |
| Cerrar | Duda sobre aviso resuelto | Verificación y silencio esperado | Encuentra el estado cerrado y predice próximos avisos. |

## J12. Configuración, privacidad, memoria y eliminación de datos

**Estado de verificación:** páginas públicas de privacidad/eliminación observadas; **acciones autenticadas no verificadas en vivo**.

| Dimensión obligatoria | Evaluación |
|---|---|
| Desencadenante y trabajo | Revisar qué sabe Manzana, corregir/olvidar memoria, controlar canales, exportar datos o abandonar el producto eliminando la cuenta. |
| Pasos actuales | `/configuracion` y subrutas → memoria `/configuracion/memoria[/id]`, recordatorios, categorías, datos → exportar → escribir frase → eliminar → `/cuenta-eliminada`; baja pública en `/baja`; información en `/privacidad` y `/eliminar-datos`. |
| Contexto inicial funcional/cognitivo/emocional | Funcional: necesidad de control o salida. Cognitivo: debe distinguir memoria, datos históricos, preferencias, exportación y eliminación. Emocional: puede existir sensibilidad o desconfianza; hipótesis pendiente. |
| Estado final deseado | Funcional: control aplicado o salida completa. Cognitivo: sabe qué cambió, qué se conserva y qué es irreversible. Emocional: hipótesis de agencia y cierre, no retención forzada. |
| Decisiones, esfuerzo y carga | Corregir, confirmar candidato, olvidar, deshacer, reactivar, olvidar todo, exportar y eliminar. Duplicación entre configuración general, memoria dedicada y datos introduce modelos distintos (`UX-M-006`). Cinco subrutas incluyen tres placeholders de configuración (`UX-M-011`). |
| Momentos de verdad, confianza y abandono | Evidencia de memoria; frase irreversible; impacto real; cierre de sesión; revocación. Hay dos flujos de eliminación con salvaguardas/cierre divergentes (`UX-H-007`) y una URL de éxito pública falsa (`UX-C-001`). |
| Agencia y feedback | Memoria muestra evidencia y permite corregir/olvidar; eliminación dedicada enumera impacto. Los `prompt`/`confirm` nativos no comparten semántica ni feedback; varias promesas pueden rechazar sin estado visible. |
| Recuperación | Olvido individual declara deshacer por 30 días; “olvidar todo” es irreversible. Exportación puede fallar sin feedback en la superficie dedicada. Una eliminación fallida debe mantener datos y sesión, pendiente de prueba. |
| Cierre y siguiente paso | La salida debe estar ligada causalmente a una eliminación confirmada. `/cuenta-eliminada` no verifica esa causalidad y afirma borrado directo. |
| Evidencia, confianza y validación | `src/features/memory/memory-screen.tsx:25-96,114-163,165-230`; `src/features/reports/delete-account-section.tsx:14-49,65-115`; `src/features/settings/settings-screen.tsx:533-562,1702-1791`; `src/app/(publico)/cuenta-eliminada/page.tsx:7-17`; `src/proxy.ts:18-42`. Alta confianza estática y pública; mutaciones pendientes. |

### Mapa emocional hipotético

| Etapa | Hipótesis de partida | Transición deseada | Señal a investigar |
|---|---|---|---|
| Revisar memoria | Inquietud por inferencias | Comprensión y capacidad de corregir | Explica qué se sabe y de dónde salió. |
| Exportar | Deseo de portabilidad | Confianza en control de datos | Obtiene archivo y entiende alcance. |
| Eliminar | Decisión sensible o definitiva | Agencia deliberada sin fricción manipulativa | Comprende impacto y puede cancelar. |
| Cerrar | Necesidad de certeza | Confirmación causal y verificable | Sabe que la acción ocurrió, no solo que vio una URL. |

## J13. Recuperación ante fallas, offline e interrupciones

**Estado de verificación:** observación pública sin fallas de carga inicial; **estados autenticados, offline y mutaciones no verificados en vivo**.

| Dimensión obligatoria | Evaluación |
|---|---|
| Desencadenante y trabajo | Una solicitud falla, la conexión se corta, la sesión expira o la persona interrumpe una tarea y vuelve. Necesita recuperar sin duplicar, perder contexto ni aceptar un falso éxito. |
| Pasos actuales | Falla de carga → `ErrorState`/reintento en varias pantallas; falla de auth → error mapeado/offline; falla de mutación → feedback específico en algunos dominios; retorno de ventana → refetch; reentrada → ruta/estado local. |
| Contexto inicial funcional/cognitivo/emocional | Funcional: estado parcial o desconocido. Cognitivo: no sabe si la acción llegó al servidor. Emocional: frustración o temor a repetir una acción son hipótesis, no observaciones. |
| Estado final deseado | Funcional: reanudar o confirmar el estado real sin duplicar. Cognitivo: sabe qué se guardó, qué no y qué puede hacer. Emocional: hipótesis de recuperación y control. |
| Decisiones, esfuerzo y carga | Reintentar, esperar, volver, cancelar o verificar resultado. No existe experiencia global autenticada de offline/reconexión/interrupción (`UX-M-010`); varias mutaciones no muestran error (`UX-M-005`). |
| Momentos de verdad, confianza y abandono | Diferenciar error de éxito (`UX-H-003`), conservar onboarding (`UX-H-006`), evitar duplicado y no afirmar eliminación (`UX-C-001`). La captura del usuario muestra 500 y `ApiClientError` no capturado, pero no establece estado actual. |
| Agencia y feedback | `ErrorState` ofrece reintento y auth mapea offline; TanStack Query reintenta una vez y refetchea al enfocar. Falta banner/estado global y comprobación de resultado incierto. |
| Recuperación | Idempotencia y helper de rollback son bases técnicas. No todos los dominios los usan; la restauración de borrador/hilo y el retorno de foco requieren runtime. |
| Cierre y siguiente paso | Tras una falla, el cierre debe declarar resultado real o incertidumbre, no solo ocultar el spinner. Debe ofrecer la acción segura mínima. |
| Evidencia, confianza y validación | `src/shared/data/query-client-provider.tsx:16-28`; `src/shared/data/optimistic-mutation.ts:19-44`; `src/ui/primitivas/states.tsx:38-88`; captura externa en `fotos para que veas/image.png`. Confianza alta en ausencia de capa global; incidencia actual desconocida. |

### Mapa emocional hipotético

| Etapa | Hipótesis de partida | Transición deseada | Señal a investigar |
|---|---|---|---|
| Fallar | Frustración o temor a perder datos | Comprensión del estado | Identifica si fue carga, envío o sesión. |
| Decidir | Duda sobre repetir | Acción segura y acotada | Sabe si reintentar puede duplicar. |
| Recuperar | Pérdida potencial de contexto | Continuidad con datos conservados | Borrador, selección o corrección permanece. |
| Cerrar | Incertidumbre residual | Confirmación o límite honesto | Puede verificar el resultado real. |

## J14. Continuidad entre superficies

**Estado de verificación:** **estático autenticado; no verificado en vivo**.

| Dimensión obligatoria | Evaluación |
|---|---|
| Desencadenante y trabajo | Una persona cambia entre conversación, listas, detalle, evidencia, recordatorio y configuración sin traducir términos ni repetir contexto. |
| Pasos actuales | Cualquier superficie → AppShell/panel global → búsqueda, asistente, entidad o configuración → detalle/acción → retorno. El asistente se monta globalmente en rutas autenticadas salvo `/asistente*`. |
| Contexto inicial funcional/cognitivo/emocional | Funcional: trabajo ya iniciado. Cognitivo: espera conservar pregunta, entidad, filtros y estado. Emocional: repetir contexto podría erosionar confianza; hipótesis pendiente. |
| Estado final deseado | Funcional: completar el mismo trabajo en la superficie adecuada. Cognitivo: reconoce el mismo estado, lenguaje y consecuencia. Emocional: hipótesis de continuidad y control. |
| Decisiones, esfuerzo y carga | Elegir superficie, entender navegación, regresar al origen. Los fallos principales son query perdida (`UX-H-009`), destinos genéricos del asistente (`UX-H-001`), navegación inerte en Memoria (`UX-H-005`) y overlay sin retorno de foco (`UX-H-008`). |
| Momentos de verdad, confianza y abandono | Que una pregunta llegue intacta; que una propuesta comparta estado con Pendientes; que el detalle vuelva al disparador; que el cierre aparezca en el dominio correcto. |
| Agencia y feedback | El AppShell y el panel global crean una arquitectura común; `pending_item` compartido reduce divergencia. Los callbacks opcionales y rutas especiales rompen esa base. |
| Recuperación | Volver atrás, cerrar panel, reabrir hilo y navegar a entidad deberían preservar estado y foco. Solo algunos paneles, como procedencia, implementan Escape y retorno. |
| Cierre y siguiente paso | La consecuencia debe ser visible tanto en conversación como en superficie visual sin repetir la intención. No se verificó sincronización cruzada en runtime. |
| Evidencia, confianza y validación | `src/app/(app)/layout.tsx:19-45`; `src/app/(app)/asistente/assistant-panel.tsx:18-63`; `src/features/search/search-screen.tsx:91-107`; `src/app/(app)/asistente/page.tsx:8-23`; `src/features/app-shell/app-shell.tsx:163-165,251-261,302-365,503-522`. Alta confianza en cableado; resultado completo pendiente. |

### Mapa emocional hipotético

| Etapa | Hipótesis de partida | Transición deseada | Señal a investigar |
|---|---|---|---|
| Cambiar superficie | Duda sobre perder trabajo | Continuidad reconocible | Pregunta, entidad y filtros se conservan. |
| Revisar detalle | Necesidad de evidencia sin abandonar contexto | Control sobre profundidad | Puede abrir/cerrar y volver al disparador. |
| Actuar | Riesgo de consecuencias divergentes | Estado compartido y explícito | Mismo resultado aparece en ambos canales. |
| Retomar | Posible desorientación | Reentrada en el punto correcto | Sabe dónde está y qué falta. |

## Síntesis transversal

| Dimensión | Fortaleza estática | Brecha que impide aprobación |
|---|---|---|
| Funcional | Amplia cobertura de dominios, propuestas compartidas, reversibilidad e idempotencia. | Falsos éxitos, controles muertos, filtros ignorados, placeholders y acciones sin recuperación. |
| Cognitiva | Procedencia, exclusiones, evidencia recurrente, rangos y copy no punitivo. | Pérdida de contexto, destinos genéricos, estados de error representados como éxito y modelos duplicados. |
| Emocional | La implementación evita lenguaje abiertamente culpabilizador y formula retornos sin puesta al día total. | No existe evidencia de usuarios para afirmar calma/confianza; varias rupturas podrían erosionarlas, hipótesis que debe validarse. |

Ningún recorrido autenticado queda aprobado por revisión estática. La validación necesaria se especifica en [`05-plan-de-validacion.md`](05-plan-de-validacion.md).
