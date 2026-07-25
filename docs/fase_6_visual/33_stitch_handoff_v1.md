# 33 - Handoff Stitch V1

**Fase:** 6 - Visual  
**Estado:** V1  
**Ultima actualizacion:** 5 de junio, 2026  
**Inputs:** Doc 28 (identidad), Doc 29 (design system), Doc 30 (App Flow), Doc 31 (WireFlows), Doc 32 (Hi-Fi)

---

## 1. Proposito

Este documento convierte Fase 6 en un brief operativo para generar el prototipo visual V1 en Stitch o una herramienta equivalente.

Doc 28-32 definen la identidad, componentes, navegacion, flujos y composicion Hi-Fi. Este Doc 33 define:

- que pantallas generar;
- que estados visuales no se pueden omitir;
- en que orden generarlas;
- que debe copiarse exactamente de Fase 6;
- que no debe inventar la herramienta;
- como evaluar si el resultado tiene calidad suficiente para ser referencia de V1.

La meta no es una demo bonita. La meta es una referencia visual profesional para construir la V1.

---

## 2. Principio rector

Manzana debe sentirse como:

> Alguien ordeno mi dinero conmigo, sin hacerme sentir torpe.

Toda pantalla debe producir al menos una de estas sensaciones:

| Sensacion | Como se ve en UI |
|---|---|
| Alivio | Pocos focos, estados claros, copy calmado, errores recuperables. |
| Control | Fuente visible, confirmacion antes de afectar saldos, acciones reversibles cuando aplique. |
| Inteligencia | Entiende contexto, separa movimientos, explica evidencia sin mostrar razonamiento interno. |
| Confianza | Pendientes no afectan saldos, datos sensibles protegidos, saldos con origen claro. |
| Cercania premium | Calida, precisa, sobria; no banco, no Excel, no SaaS generico, no app infantil. |

---

## 2.1 Direccion visual corregida para HOME desktop

La pantalla Home desktop debe parecer una app financiera usable y cercana, no una plantilla editorial de "financial dashboard".

La composicion objetivo es:

```text
Sidebar sobria 240px
Topbar limpia con marca e iconos discretos
Contenido max-width 1220px
Saludo humano arriba: "Hola, Juan" o "Tu resumen de hoy"

Grid 2 columnas:
  Columna izquierda 40%:
    Card dinero libre
    Card pendientes principales
    Card descubrimiento destacado

  Columna derecha 60%:
    Card movimientos recientes
    CTA "Registrar nuevo movimiento"
```

Esta composicion tiene prioridad sobre una version con dinero libre gigante a todo el ancho.

**Debe sentirse como la segunda direccion visual validada por producto:**
- mas app operativa;
- mas compacta;
- mas clara;
- mas humana;
- con bloques de peso visual balanceado;
- con movimientos recientes como continuidad del dia;
- con dinero libre como foco importante, pero no como cartel financiero gigante.

**No repetir la direccion que producto rechazo:**
- serif editorial en titulos o montos;
- exceso de espacio vacio;
- sidebar demasiado ancha o con lenguaje corporativo;
- tagline en ingles;
- CTA "Añadir Transacción";
- card de dinero libre demasiado grande y solitaria;
- tarjetas laterales pequeñas que parecen widgets sueltos;
- estetica de banca privada, contabilidad o dashboard financiero generico.

---

## 2.2 Direccion visual global bloqueada

Esta direccion aplica a toda la app: onboarding, login, Home, movimientos, pendientes, Mi Dinero, deudas, pagos que vienen, descubrimientos, busqueda, configuracion, modales, drawers y estados.

Stitch no tiene libertad para reinterpretar el estilo base. Puede componer dentro de los layouts definidos, pero debe mantener esta direccion global.

### 2.2.1 Personalidad visual

Manzana debe sentirse como una app operativa premium, calida y precisa.

```text
Premium silencioso
Calido, humano y preciso
Util antes que decorativo
Finanzas sin culpa
Control sin friccion
```

No debe sentirse como:

```text
Banco tradicional
Contabilidad personal
Excel visual
Dashboard SaaS generico
Plantilla administrativa
Coach motivacional
App infantil/gamificada
Landing page
```

### 2.2.2 Ritmo y densidad

- La app debe tener densidad media: suficiente informacion para operar, sin saturar.
- Cada pantalla debe tener un bloque protagonista y 2-4 bloques secundarios maximo.
- No crear mosaicos de muchas tarjetas con el mismo peso visual.
- No dejar grandes vacios por composiciones demasiado editoriales.
- Usar espacio en blanco para calma, no para hacer la pantalla parecer incompleta.
- En desktop, preferir grids balanceados de 2 columnas cuando haya suficiente contenido.
- En mobile, preferir stack vertical con una accion principal clara.

### 2.2.3 Tipografia global

- Headings, labels de navegacion y botones: `DM Sans`.
- Cuerpo, metadata y numeros: `Inter`.
- Montos: `Inter` con `tabular-nums`.
- Prohibido usar serif en cualquier pantalla.
- Prohibido usar tipografia editorial para titulos o montos.
- No usar titulos gigantes salvo pantallas de onboarding/auth. En dashboard, los titulos deben ser de producto operativo.

### 2.2.4 Superficies y cards

- Las cards son contenedores de decision o claridad, no decoracion.
- Radio principal: 12px para cards importantes, 8px para elementos secundarios.
- Sombras suaves; nunca sombras duras o flotantes tipo plantilla.
- Bordes sutiles, preferiblemente `--color-border-default`.
- Las cards deben tener jerarquia: una primaria, secundarias claramente subordinadas.
- No poner cards dentro de cards salvo modales/drawers o detalles muy concretos.
- No usar widgets laterales sueltos si no estan conectados a una accion.
- No usar barras verticales laterales como acento de card (`border-left`) en pendientes, insights, deudas, pagos o alertas.
- Los estados semanticos se expresan con badge, icono, tono de superficie y copy, no con una linea lateral.
- Si se necesita enfasis, usar una combinacion suave: fondo sutil + badge + icono en contenedor circular + borde normal de 1px.
- Las lineas verticales solo pueden existir en navegacion activa de sidebar o timeline/historial, nunca como decoracion de card.

### 2.2.5 Color global

- Fondo principal: crema/calido, no blanco puro.
- Verde Manzana es acento y CTA, no debe inundar toda la UI.
- Amarillo/ocre se usa para pendientes y atencion suave, no alarma.
- Rojo solo para error real o accion destructiva.
- Azul suave solo para informacion neutral, no como color dominante.
- No usar degradados decorativos, orbs, fondos abstractos ni blobs.
- No usar paleta azul bancaria, morado startup, negro lujo, beige excesivo ni verde neon.

### 2.2.6 Navegacion global

- Sidebar desktop: sobria, clara, 240px, con iconos lineales y labels en español.
- Bottom nav mobile: Home, Movm., Pend., MiDin, Mas.
- `+` no es item de bottom nav; es FAB o boton contextual para nuevo movimiento.
- Topbar debe ser ligera. No debe competir con el contenido principal.
- La busqueda natural no debe parecer chatbot principal; debe sentirse como lupa inteligente.
- Labels visibles siempre en español.

### 2.2.7 Lenguaje visual por modulo

| Modulo | Direccion visual |
|---|---|
| Auth/Login | Confianza, privacidad, entrada rapida. Nada bancario ni corporativo. |
| Onboarding | Conversacional y ligero. Primer valor antes de configuracion pesada. |
| Home | Resumen del dia, foco en dinero libre y continuidad. No dashboard contable. |
| Movimientos | Historial confiable y corregible. Lista clara, filtros potentes sin intimidar. |
| Nuevo movimiento | Formulario necesario y profesional. Impacto visible antes de guardar. |
| Pendientes | Proteccion. Debe verse como bandeja de revision, no como gasto confirmado. |
| Mi Dinero | Explicacion calma de total, separado, comprometido y libre. |
| Deudas | Reduce ansiedad. Progreso claro, lenguaje sin cobranza. |
| Pagos que vienen | Anticipacion tranquila. Evitar alarma visual. |
| Descubrimientos | Autodescubrimiento con evidencia. No regaño ni grafico frio. |
| Busqueda | Lupa inteligente read-only, con fuentes. No otro chatbot. |
| Configuracion | Control progresivo, secciones limpias, nada de panel tecnico. |

### 2.2.8 Botones y acciones

- Una accion primaria por contexto.
- Botones primarios solo para avanzar, confirmar o guardar.
- Botones secundarios para editar, revisar, conectar o abrir detalle.
- Ghost para cancelar, volver, ignorar o acciones livianas.
- Danger solo para borrar, rechazar sensible o desconectar/eliminar.
- Todo boton debe tener respuesta visible: loading, success, error o cierre de modal.
- No usar botones porque "llenan" una tarjeta.

### 2.2.9 Iconografia

- Usar iconos lineales consistentes, estilo lucide.
- Iconos sin rellenos pesados.
- Icono siempre debe representar la funcion real.
- No usar iconos decorativos grandes si no ayudan a entender.
- En estados vacios, una ilustracion lineal simple es valida; no usar escenas complejas.

### 2.2.10 Estados globales

Todos los estados deben verse profesionales:

| Estado | Direccion visual |
|---|---|
| Loading | Skeleton calmado, no spinners gigantes salvo splash/auth. |
| Empty | Invitacion a un paso pequeño, nunca "No hay datos" seco. |
| Error | Recuperable, con boton claro. No dramatizar. |
| Success | Toast o feedback breve. No celebracion excesiva. |
| Recalculando | Mantener datos anteriores visibles y avisar suavemente. |
| Discreto | Ocultar datos sensibles sin deformar layout. |
| Pendiente | Proteger, pedir confirmacion y explicar que no afecta saldo. |

### 2.2.11 Criterio global de aceptacion visual

Una pantalla esta bien si el usuario puede pensar:

> Se que esta pasando, se que puedo hacer, y no me siento juzgado.

Una pantalla esta mal si se ve:

- mas bonita que util;
- mas financiera que humana;
- mas corporativa que cercana;
- mas explicativa que operativa;
- mas decorativa que clara;
- mas generica que Manzana.

---

## 3. Reglas no negociables para Stitch

- No generar landing page, pricing, blog, marketing site, marketplace ni pantallas fuera de V1.
- No usar "MVP", "beta", "demo" ni lenguaje de producto incompleto.
- No inventar categorias base, monedas, canales, providers, integraciones bancarias directas ni features no documentadas.
- No convertir Pendientes en movimientos confirmados visualmente.
- No mostrar un email detectado como impacto en saldo antes de confirmacion.
- No usar paletas frias de banco, azules corporativos dominantes, morados genericos, gradients decorativos ni estilo de plantilla SaaS.
- No usar fuentes serif para titulos, montos, navegacion ni tarjetas. Usar DM Sans para headings/UI e Inter para cuerpo/numeros.
- No usar ingles en UI visible. La marca habla en español: "Tranquilidad financiera", no "Financial Tranquility".
- No usar "transaccion" como label principal. Usar "movimiento", "gasto", "ingreso", "pago" o "pendiente" segun contexto.
- No esconder errores. Todo error debe tener accion de recuperacion.
- No usar cards decorativas sin funcion.
- No usar texto visible para explicar "como usar la app" si puede resolverse con jerarquia, estado o accion clara.
- No usar emojis decorativos.
- No mostrar chain-of-thought, razonamiento interno ni contenido sensible completo de emails.

---

## 4. Prompt maestro para Stitch

Usar este prompt como punto de partida. Si la herramienta permite adjuntar documentos, adjuntar Doc 28-33 completos y pegar este prompt como instruccion principal.

```text
Construye el prototipo visual V1 de Manzana usando exclusivamente los documentos de Fase 6:

- 28_identidad_visual_marca.md
- 29_design_system_ui.md
- 30_app_flow.md
- 31_wireflows.md
- 32_especificacion_hifi.md
- 33_stitch_handoff_v1.md

Manzana es una app de finanzas personales donde WhatsApp es el canal principal de captura y el Dashboard es el lugar de control, revision y profundidad.

El prototipo debe sentirse premium, calido, claro y humano. No debe parecer banco, Excel, dashboard SaaS generico, app infantil ni plantilla.

Aplica la direccion visual global bloqueada del Doc 33 seccion 2.2 a TODAS las pantallas: auth, onboarding, Home, movimientos, pendientes, Mi Dinero, deudas, pagos, descubrimientos, busqueda, configuracion, modales, drawers y estados.

Para HOME desktop, usa la composicion validada: sidebar sobria, saludo humano arriba, grid 40/60, columna izquierda con dinero libre + pendientes + descubrimiento, columna derecha con movimientos recientes y CTA de registro. No hagas una card gigante de dinero libre a todo el ancho.

Usa solo DM Sans e Inter. No uses serif. No uses ingles visible. No uses "Añadir Transacción"; usa "Registrar nuevo movimiento" o "Nuevo movimiento".

Genera solo pantallas V1. No generar landing, pricing, blog, marketing site ni features no documentadas.

Respeta la paleta, tipografia, radios, sombras, layout, componentes, copy y estados definidos en Fase 6.

Genera primero el lenguaje visual maestro con:
1. AUTH_SPLASH
2. AUTH_LOGIN
3. ONBOARDING_WELCOME
4. HOME funcional mobile
5. HOME funcional desktop
6. PENDING funcional
7. PENDING_DETAIL
8. MY_MONEY funcional
9. MOVEMENT_NEW gasto

Luego expande a todas las pantallas y estados del inventario del Doc 33.

La entrega completa debe contener exactamente 151 frames/variantes visuales, siguiendo la numeracion de la seccion 6.13. No entregar solo 2, 3, 25 o 50 pantallas. Si no puedes generar las 151 en una sola pasada, genera por bloques, pero conserva numeracion y continua hasta completar las 151.

Cada pantalla debe tener foco emocional y funcional. Cada boton debe tener una razon de existir. Cada estado vacio debe invitar a una accion concreta sin culpa.

Pendientes no afectan saldo. Email nunca registra automaticamente. Modo discreto oculta montos/personas/comercios sensibles sin romper layout.

Si falta un dato visual, usa Doc 32 seccion 20. No inventes nuevas categorias, monedas, providers o pantallas.
```

---

## 5. Orden recomendado de generacion

Stitch no debe generar todo en una sola pasada si eso baja calidad. Se trabaja por bloques visuales.

### 5.1 Bloque A - Lenguaje visual maestro

Estas pantallas definen la identidad visual completa:

| Orden | Pantalla | Por que importa |
|---|---|---|
| 1 | `AUTH_SPLASH` | Define primera impresion, logo, calma y privacidad. |
| 2 | `AUTH_LOGIN` | Define confianza inicial y friccion baja. |
| 3 | `ONBOARDING_WELCOME` | Define tono humano sin parecer tutorial pesado. |
| 4 | `HOME` funcional mobile | Define jerarquia principal de Manzana. |
| 5 | `HOME` funcional desktop | Define adaptacion al Dashboard completo. |
| 6 | `PENDING` funcional | Define proteccion y confirmacion. |
| 7 | `PENDING_DETAIL` | Define control antes de afectar dinero. |
| 8 | `MY_MONEY` funcional | Define claridad financiera. |
| 9 | `MOVEMENT_NEW` tipo gasto | Define formularios profesionales. |

No avanzar al Bloque B si este bloque se siente generico.

### 5.2 Bloque B - Operacion diaria

| Pantalla | Estados minimos |
|---|---|
| `MOVEMENTS` | funcional, vacio, sin resultados, loading, error, discreto |
| `MOVEMENT_DETAIL` | confirmado, por corregir, corregido, loading, error, discreto |
| `MOVEMENT_EDIT` | default, validacion, duplicado, guardando, error |
| `PENDING` | vacio, batch, loading, error, discreto |
| `PENDING_DETAIL` | detalle, editando, confirmando, rechazando, loading, error |
| `SEARCH` | inicial, escribiendo, resultados, sin resultados, intento de accion, error IA |

### 5.3 Bloque C - Profundidad financiera

| Pantalla | Estados minimos |
|---|---|
| `DEBTS` | funcional, vacio, loading, error, discreto |
| `DEBT_DETAIL` | activa, saldada, historial vacio, loading, error, discreto |
| `UPCOMING` | funcional, vacio, sugeridos, vencidos, loading, error, discreto |
| `UPCOMING_DETAIL` | activo, sugerido, vencido, pausado |
| `DISCOVERIES` | funcional, sin datos suficientes, actualizados, loading, error, discreto |
| `DISCOVERY_DETAIL` | normal, actualizado, feedback, discreto |

### 5.4 Bloque D - Configuracion y modales

| Pantalla/pieza | Estados minimos |
|---|---|
| `SETTINGS` | funcional, email conectado, email no conectado, guardando preferencia, error |
| `MODAL_CONFIRM` | confirmacion normal |
| `MODAL_RISK` | accion destructiva |
| `MODAL_DETAIL_QUICK` | preview de movimiento, pendiente y deuda |
| `DRAWER_MORE` | menu mobile |
| `DRAWER_FILTERS` | filtros sin aplicar, aplicando, error |
| `AUTH_SESSION_EXPIRED` | sesion vencida con datos ocultos |

---

## 6. Inventario exacto de estados visuales

Cada fila de esta matriz representa una variante que debe existir en el prototipo, aunque algunas se representen como overlays, modales o drawers sobre una pantalla base.

### 6.1 Autenticacion y reapertura

| ID visual | Pantalla | Estado | Cuando aparece | Bloque protagonista | Accion principal | Copy exacto recomendado |
|---|---|---|---|---|---|---|
| `AUTH_SPLASH_LOADING` | `AUTH_SPLASH` | Loading inicial | Al abrir app | Logo + spinner | Ninguna | "Preparando tu espacio..." |
| `AUTH_SPLASH_RETURN_VALID` | `AUTH_SPLASH` | Sesion valida | Reapertura con sesion activa | Logo + transicion | Ir a Home | No agregar copy extra. |
| `AUTH_SPLASH_NEW_USER` | `AUTH_SPLASH` | Usuario nuevo | Primer acceso autenticado | Logo + transicion | Ir a onboarding | No agregar copy extra. |
| `AUTH_SPLASH_NETWORK_ERROR` | `AUTH_SPLASH` | Error de red | No carga sesion | Error calmado | Reintentar | "No pude conectar ahora." |
| `AUTH_LOGIN_DEFAULT` | `AUTH_LOGIN` | Default | Sin sesion | Form telefono | Continuar | "Ingresa con tu numero de WhatsApp" |
| `AUTH_LOGIN_INVALID` | `AUTH_LOGIN` | Campo invalido | Telefono incompleto | Input con error | Corregir | "Revisa el numero. Debe tener 9 digitos." |
| `AUTH_LOGIN_SENDING` | `AUTH_LOGIN` | Enviando codigo | Tap en continuar | Boton loading | Esperar | "Enviando codigo..." |
| `AUTH_LOGIN_RATE_LIMIT` | `AUTH_LOGIN` | Reintentos limitados | Muchos intentos | Banner warning | Esperar | "Espera un momento antes de pedir otro codigo." |
| `AUTH_VERIFY_DEFAULT` | `AUTH_VERIFY` | Esperando OTP | Codigo enviado | OTP input | Verificar | "Enviamos un codigo al +51 9XX XXX XXX." |
| `AUTH_VERIFY_ERROR` | `AUTH_VERIFY` | OTP incorrecto | Codigo invalido | OTP con error | Reintentar | "Ese codigo no coincide. Intenta otra vez." |
| `AUTH_VERIFY_COOLDOWN` | `AUTH_VERIFY` | Reenvio bloqueado | Timer activo | Caption timer | Esperar | "Reenviar en 27s" |
| `AUTH_VERIFY_CHECKING` | `AUTH_VERIFY` | Verificando | Submit OTP | Boton loading | Esperar | "Verificando..." |
| `AUTH_SESSION_EXPIRED_OVERLAY` | `AUTH_SESSION_EXPIRED` | Sesion vencida | Vuelve tras inactividad o token vence | Overlay privacidad | Continuar | "Por seguridad oculte tus datos. Confirma tu acceso para continuar." |

### 6.2 Onboarding

| ID visual | Pantalla | Estado | Cuando aparece | Bloque protagonista | Accion principal | Copy exacto recomendado |
|---|---|---|---|---|---|---|
| `ONBOARDING_WELCOME_DEFAULT` | `ONBOARDING_WELCOME` | Bienvenida | Primer login | Promesa simple | Empezar | "Manzana organiza tu dinero sin que tengas que esforzarte." |
| `ONBOARDING_WHATSAPP_DEFAULT` | `ONBOARDING_WHATSAPP` | Conectar WhatsApp | Paso 2 | Numero de Manzana | Ya lo guarde | "Agregalo como 'Manzana' en tu celular." |
| `ONBOARDING_WHATSAPP_HELP` | `ONBOARDING_WHATSAPP` | Ayuda | Tap "Como funciona" | Mini explicacion | Entendido | "Escribes natural por WhatsApp y revisas aqui cuando quieras." |
| `ONBOARDING_FIRST_MOVE_DEFAULT` | `ONBOARDING_FIRST_MOVE` | Primer movimiento | Paso 3 | Eleccion WhatsApp/Dashboard | Registrar algo | "Puedes hacerlo por WhatsApp ahora mismo o desde aqui." |
| `ONBOARDING_FIRST_MOVE_WHATSAPP_EXAMPLE` | `ONBOARDING_FIRST_MOVE` | Ejemplo WhatsApp | Tap ghost | Burbuja mensaje | Abrir WhatsApp | "gasté 8 café" |
| `ONBOARDING_EMAIL_OPT_DEFAULT` | `ONBOARDING_EMAIL_OPT` | Gmail opcional | Paso 4 | Privacidad y control | Conectar Gmail | "Siempre te pregunto antes de registrar." |
| `ONBOARDING_EMAIL_OPT_SKIP` | `ONBOARDING_EMAIL_OPT` | Omitido | Usuario no conecta | Confirmacion ligera | Continuar | "Puedes conectarlo despues desde Configuracion." |
| `ONBOARDING_COMPLETE_DEFAULT` | `ONBOARDING_COMPLETE` | Listo | Fin onboarding | Check + calma | Ir al inicio | "Manzana esta lista." |

### 6.3 Home

| ID visual | Pantalla | Estado | Cuando aparece | Bloque protagonista | Accion principal | Copy exacto recomendado |
|---|---|---|---|---|---|---|
| `HOME_EMPTY` | `HOME` | Sin datos | Usuario sin movimientos/cuentas | Empty state | Registrar movimiento | "Empieza por una cosa" |
| `HOME_EARLY` | `HOME` | Temprano | 1-4 movimientos | Movimientos recientes + aprendizaje | Registrar otro | "Aprendiendo tus gastos. Con mas registros vere patrones." |
| `HOME_FUNCTIONAL` | `HOME` | Funcional | Datos suficientes | Dinero libre | Ver desglose | "Dinero libre" |
| `HOME_WITH_PENDING` | `HOME` | Pendiente destacado | Hay pendientes | Card pendiente | Revisar pendientes | "Tienes movimientos por revisar" |
| `HOME_WITH_INSIGHT` | `HOME` | Descubrimiento | Insight activo | Descubrimiento destacado | Ver movimientos | "Manzana noto algo" |
| `HOME_WITH_UPCOMING` | `HOME` | Compromiso proximo | Pago/deuda proxima | Proximo compromiso | Ver detalle | "Vence pronto" |
| `HOME_LOADING` | `HOME` | Carga | Fetch inicial | Skeleton principal | Ninguna | No usar texto largo. |
| `HOME_ERROR` | `HOME` | Error | Falla carga | Banner error | Reintentar | "No pude actualizar ahora. Tus datos siguen guardados." |
| `HOME_RECALCULATING` | `HOME` | Recalculando | Correccion o evento interno | Banner + datos anteriores | Esperar | "Actualizando tus resumenes..." |
| `HOME_DISCREET` | `HOME` | Modo discreto | Privacidad activa | Montos ocultos | Ver detalle | "Tienes algo por revisar." |

### 6.4 Movimientos y formulario manual

| ID visual | Pantalla | Estado | Cuando aparece | Bloque protagonista | Accion principal | Copy exacto recomendado |
|---|---|---|---|---|---|---|
| `MOVEMENTS_FUNCTIONAL` | `MOVEMENTS` | Lista | Hay movimientos | Lista + filtros | Nuevo movimiento | "Movimientos" |
| `MOVEMENTS_EMPTY` | `MOVEMENTS` | Vacio | Sin movimientos | Empty list | Nuevo movimiento | "Cuando registres algo, aparecera aqui." |
| `MOVEMENTS_NO_RESULTS` | `MOVEMENTS` | Sin resultados | Filtros sin match | Empty filtrado | Limpiar filtros | "No encontre movimientos con esos filtros." |
| `MOVEMENTS_LOADING` | `MOVEMENTS` | Carga | Fetch | Skeleton 6 filas | Ninguna | No usar copy principal. |
| `MOVEMENTS_ERROR` | `MOVEMENTS` | Error | Falla carga | Banner inline | Reintentar | "No pude cargar movimientos." |
| `MOVEMENTS_DISCREET` | `MOVEMENTS` | Discreto | Privacidad activa | Lista con montos ocultos | Abrir detalle | Montos como `...` o `•••` segun Doc 29. |
| `MOVEMENT_DETAIL_CONFIRMED` | `MOVEMENT_DETAIL` | Confirmado | Movimiento normal | Header + evidencia | Editar | "Puedes corregirlo si no era asi." |
| `MOVEMENT_DETAIL_TO_CORRECT` | `MOVEMENT_DETAIL` | Por corregir | Baja confianza/correccion pendiente | Campo resaltado | Corregir ahora | "Manzana no estaba seguro de esta categoria." |
| `MOVEMENT_DETAIL_CORRECTED` | `MOVEMENT_DETAIL` | Corregido | Movimiento editado | Historial de cambio | Ver cambio | "Cambio registrado" |
| `MOVEMENT_DETAIL_LOADING` | `MOVEMENT_DETAIL` | Carga | Abriendo detalle | Skeleton detalle | Ninguna | No usar copy largo. |
| `MOVEMENT_DETAIL_ERROR` | `MOVEMENT_DETAIL` | Error | No carga detalle | Error state | Reintentar | "No pude cargar el detalle." |
| `MOVEMENT_DETAIL_DISCREET` | `MOVEMENT_DETAIL` | Discreto | Privacidad activa | Datos protegidos | Editar | No mostrar personas/comercios sensibles si aplica. |
| `MOVEMENT_NEW_GASTO` | `MOVEMENT_NEW` | Gasto | Tipo gasto | Form dinamico | Guardar gasto | "Sale de Yape y reduce tu dinero libre." |
| `MOVEMENT_NEW_INGRESO` | `MOVEMENT_NEW` | Ingreso | Tipo ingreso | Form dinamico | Guardar ingreso | "Aumenta el saldo de la cuenta elegida." |
| `MOVEMENT_NEW_TRANSFERENCIA` | `MOVEMENT_NEW` | Transferencia | Tipo transferencia | Origen/destino | Guardar transferencia | "Mueve dinero entre cuentas. No cambia tu dinero total." |
| `MOVEMENT_NEW_ASIGNACION_INTERNA` | `MOVEMENT_NEW` | `asignacion_interna` | Separar dinero en caja | Cuenta + caja | Guardar asignacion | "Baja tu dinero libre, no tu saldo total." |
| `MOVEMENT_NEW_DEUDA_ADQUIRIDA` | `MOVEMENT_NEW` | Deuda adquirida | Nueva deuda | Persona + condiciones | Crear deuda | "No descuenta saldo hasta registrar un pago." |
| `MOVEMENT_NEW_PAGO_DEUDA` | `MOVEMENT_NEW` | Pago deuda | Pago vinculado | Deuda vinculada | Registrar pago | "Reduce la deuda y, si eliges cuenta, reduce ese saldo." |
| `MOVEMENT_NEW_PRESTAMO_DADO` | `MOVEMENT_NEW` | Prestamo dado | Dinero que me deben | Persona | Guardar prestamo | "Registra dinero que te deben." |
| `MOVEMENT_NEW_PRESTAMO_RECIBIDO` | `MOVEMENT_NEW` | Prestamo recibido | Dinero recibido que debo | Persona/entidad | Guardar prestamo | "Registra dinero que recibiste y podrias deber." |
| `MOVEMENT_NEW_DEVOLUCION_RECIBIDA` | `MOVEMENT_NEW` | Devolucion recibida | Me pagan deuda | Persona/deuda | Guardar devolucion | "Reduce lo que te debian y puede aumentar tu saldo." |
| `MOVEMENT_NEW_PAGO_RECURRENTE` | `MOVEMENT_NEW` | Pago recurrente | Crear pago que viene | Frecuencia + fecha | Crear pago | "No afecta saldo hasta que se pague." |
| `MOVEMENT_NEW_AJUSTE` | `MOVEMENT_NEW` | Ajuste | Corregir saldo | Motivo + riesgo | Guardar ajuste | "Corrige un saldo. Requiere confirmacion." |
| `MOVEMENT_FORM_VALIDATION` | `MOVEMENT_NEW/EDIT` | Validacion | Campo requerido vacio | Campo error | Corregir | Mensaje bajo el campo. |
| `MOVEMENT_FORM_DUPLICATE` | `MOVEMENT_NEW/EDIT` | Duplicado posible | Dedup detecta similar | Warning | Ver similar | "Este movimiento parece similar a uno del 14 de mayo." |
| `MOVEMENT_FORM_SAVING` | `MOVEMENT_NEW/EDIT` | Guardando | Submit | Boton loading | Esperar | "Guardando..." |
| `MOVEMENT_FORM_ERROR` | `MOVEMENT_NEW/EDIT` | Error guardar | Falla API | Toast error | Reintentar | "No pude guardar. Intenta de nuevo." |
| `MOVEMENT_FORM_SUCCESS` | `MOVEMENT_NEW/EDIT` | Exito | Guardado | Toast success | Continuar | "Movimiento guardado." |

### 6.5 Pendientes

| ID visual | Pantalla | Estado | Cuando aparece | Bloque protagonista | Accion principal | Copy exacto recomendado |
|---|---|---|---|---|---|---|
| `PENDING_FUNCTIONAL` | `PENDING` | Lista | Hay pendientes | Por confirmar | Confirmar | "No afecta tu saldo hasta que confirmes." |
| `PENDING_EMPTY` | `PENDING` | Vacio | Sin pendientes | Empty inbox | Volver a Home | "No tienes nada por revisar." |
| `PENDING_BATCH` | `PENDING` | Batch | Varios similares | Grupo | Revisar en grupo | "Tienes movimientos similares por revisar." |
| `PENDING_LOADING` | `PENDING` | Carga | Fetch | Skeleton 3 filas | Ninguna | No usar copy largo. |
| `PENDING_ERROR` | `PENDING` | Error | Falla carga | Banner error | Reintentar | "No pude cargar pendientes." |
| `PENDING_DISCREET` | `PENDING` | Discreto | Privacidad activa | Datos ocultos | Revisar | "Tienes un movimiento por revisar." |
| `PENDING_DETAIL_DEFAULT` | `PENDING_DETAIL` | Detalle | Abre pendiente | Resumen + evidencia | Confirmar | "Movimiento detectado" |
| `PENDING_DETAIL_EDITING` | `PENDING_DETAIL` | Editando | Usuario cambia campos | Form editable | Confirmar | "No afecta tu saldo hasta que confirmes." |
| `PENDING_DETAIL_CONFIRMING` | `PENDING_DETAIL` | Confirmando | Tap confirmar | Boton loading | Esperar | "Confirmando..." |
| `PENDING_DETAIL_REJECTING` | `PENDING_DETAIL` | Rechazando | Tap rechazar | Confirmacion ligera | Rechazar | "Lo quitare de pendientes." |
| `PENDING_DETAIL_ALREADY_REGISTERED` | `PENDING_DETAIL` | Ya registrado | Tap ya lo registre | Confirmacion | Marcar revisado | "Lo marco como revisado sin tocar tu saldo." |
| `PENDING_DETAIL_LOADING` | `PENDING_DETAIL` | Carga | Deep link o apertura | Skeleton | Ninguna | No usar copy largo. |
| `PENDING_DETAIL_ERROR` | `PENDING_DETAIL` | Error | No carga | Error state | Reintentar | "No pude cargar este pendiente." |
| `PENDING_DETAIL_DISCREET` | `PENDING_DETAIL` | Discreto | Privacidad activa | Fuente + fecha | Confirmar | Ocultar monto y comercio. |

### 6.6 Mi Dinero, cuentas y cajas

| ID visual | Pantalla | Estado | Cuando aparece | Bloque protagonista | Accion principal | Copy exacto recomendado |
|---|---|---|---|---|---|---|
| `MY_MONEY_FUNCTIONAL` | `MY_MONEY` | Funcional | Cuentas configuradas | Desglose dinero libre | Como se calcula | "Dinero libre" |
| `MY_MONEY_NO_ACCOUNTS` | `MY_MONEY` | Sin cuentas | No hay saldos | Empty wallet | Agregar cuenta o saldo | "Puedo calcular tu dinero libre cuando tenga al menos un saldo." |
| `MY_MONEY_PARTIAL_NO_BOXES` | `MY_MONEY` | Parcial | Cuentas sin cajas | Cuentas + dinero libre | Nueva caja | "No tienes cajas configuradas." |
| `MY_MONEY_LOADING` | `MY_MONEY` | Carga | Fetch | Skeleton desglose | Ninguna | No usar S/0 falso. |
| `MY_MONEY_ERROR` | `MY_MONEY` | Error | Falla carga | Banner error | Reintentar | "No pude actualizar. Tus datos anteriores siguen guardados." |
| `MY_MONEY_RECALCULATING` | `MY_MONEY` | Recalculando | Movimiento/correccion | Spinner junto monto | Esperar | "Actualizando..." |
| `MY_MONEY_DISCREET` | `MY_MONEY` | Discreto | Privacidad activa | Montos ocultos | Ver cuentas | Todos los montos `•••`. |
| `ACCOUNT_CREATE` | Modal/drawer | Crear cuenta | CTA cuenta | Form cuenta | Guardar cuenta | "Esto ayuda a calcular tu dinero libre." |
| `ACCOUNT_EDIT` | Modal/drawer | Editar cuenta | Desde cuenta | Form cuenta | Guardar cambios | "Actualiza el saldo si cambio." |
| `BOX_CREATE` | Modal/drawer | Crear caja | CTA caja | Form caja | Guardar caja | "Este dinero seguira en tu cuenta, pero dejara de contarse como libre." |
| `BOX_EDIT` | Modal/drawer | Editar caja | Desde caja | Form caja | Guardar cambios | Mismo copy de impacto. |

### 6.7 Deudas

| ID visual | Pantalla | Estado | Cuando aparece | Bloque protagonista | Accion principal | Copy exacto recomendado |
|---|---|---|---|---|---|---|
| `DEBTS_FUNCTIONAL` | `DEBTS` | Funcional | Hay deudas | Resumen debo/me deben | Nueva deuda | "Saldo neto" |
| `DEBTS_EMPTY` | `DEBTS` | Vacio | Sin deudas | Empty debt | Crear deuda | "Puedes usarme solo para deudas si eso te sirve." |
| `DEBTS_LOADING` | `DEBTS` | Carga | Fetch | Skeleton cards | Ninguna | No usar S/0 como protagonista. |
| `DEBTS_ERROR` | `DEBTS` | Error | Falla carga | Banner inline | Reintentar | "No pude cargar deudas." |
| `DEBTS_DISCREET` | `DEBTS` | Discreto | Privacidad activa | Montos ocultos | Ver detalle | Ocultar montos y personas sensibles. |
| `DEBT_DETAIL_ACTIVE` | `DEBT_DETAIL` | Activa | Deuda pendiente | Hero + progreso | Registrar pago | "Proxima cuota" |
| `DEBT_DETAIL_PAID` | `DEBT_DETAIL` | Saldada | Deuda cerrada | Hero success | Ver movimientos | "Saldada" |
| `DEBT_DETAIL_EMPTY_HISTORY` | `DEBT_DETAIL` | Sin pagos | No hay pagos vinculados | Historial vacio | Registrar pago | "Aun no hay pagos registrados para esta deuda." |
| `DEBT_DETAIL_LOADING` | `DEBT_DETAIL` | Carga | Abre detalle | Skeleton | Ninguna | No usar copy largo. |
| `DEBT_DETAIL_ERROR` | `DEBT_DETAIL` | Error | No carga | Error state | Reintentar | "No pude cargar esta deuda." |
| `DEBT_DETAIL_DISCREET` | `DEBT_DETAIL` | Discreto | Privacidad activa | Progreso oculto | Registrar pago | Montos `•••`. |
| `DEBT_CREATE` | Modal/drawer | Crear deuda | CTA deuda | Form deuda | Guardar deuda | Evitar culpa, cobranza o amenaza. |
| `DEBT_EDIT` | Modal/drawer | Editar deuda | Desde detalle | Form deuda | Guardar cambios | Mantener tono calmado. |

### 6.8 Pagos que vienen

| ID visual | Pantalla | Estado | Cuando aparece | Bloque protagonista | Accion principal | Copy exacto recomendado |
|---|---|---|---|---|---|---|
| `UPCOMING_FUNCTIONAL` | `UPCOMING` | Funcional | Hay pagos | Activos/sugeridos/vencidos | Agregar pago | "Pagos que vienen" |
| `UPCOMING_EMPTY` | `UPCOMING` | Vacio | Sin pagos | Empty | Agregar pago | "No tienes pagos que vienen registrados." |
| `UPCOMING_WITH_SUGGESTED` | `UPCOMING` | Sugeridos | Patron detectado | Seccion sugeridos | Confirmar | "Detectado 3 meses consecutivos" |
| `UPCOMING_WITH_OVERDUE` | `UPCOMING` | Vencidos | Fecha paso | Seccion vencidos | Marcar pagado | Usar urgencia sin culpa. |
| `UPCOMING_LOADING` | `UPCOMING` | Carga | Fetch | Skeleton cards | Ninguna | No usar copy largo. |
| `UPCOMING_ERROR` | `UPCOMING` | Error | Falla carga | Banner inline | Reintentar | "No pude cargar pagos que vienen." |
| `UPCOMING_DISCREET` | `UPCOMING` | Discreto | Privacidad activa | Montos ocultos | Ver detalle | Montos `•••`. |
| `UPCOMING_DETAIL_ACTIVE` | `UPCOMING_DETAIL` | Activo | Pago recurrente activo | Hero | Marcar pagado | "Manzana lo muestra para ayudarte a anticiparlo." |
| `UPCOMING_DETAIL_SUGGESTED` | `UPCOMING_DETAIL` | Sugerido | Patron no confirmado | Patron | Confirmar pago recurrente | "Detectado 3 meses consecutivos" |
| `UPCOMING_DETAIL_OVERDUE` | `UPCOMING_DETAIL` | Vencido | Fecha paso | Estado vencido | Marcar pagado | No usar culpa. |
| `UPCOMING_DETAIL_PAUSED` | `UPCOMING_DETAIL` | Pausado | Usuario pausa | Estado pausado | Reactivar | "Pausado" |
| `UPCOMING_CREATE` | Modal/drawer | Crear pago | CTA pago | Form pago | Guardar pago | "Te avisare para que no se te pase." |
| `UPCOMING_EDIT` | Modal/drawer | Editar pago | Desde detalle | Form pago | Guardar cambios | Mantener impacto claro. |

### 6.9 Descubrimientos

| ID visual | Pantalla | Estado | Cuando aparece | Bloque protagonista | Accion principal | Copy exacto recomendado |
|---|---|---|---|---|---|---|
| `DISCOVERIES_FUNCTIONAL` | `DISCOVERIES` | Funcional | Insights activos | Recientes | Ver detalle | "Descubrimientos" |
| `DISCOVERIES_NOT_ENOUGH_DATA` | `DISCOVERIES` | Sin datos | Pocos movimientos | Empty insight | Registrar movimiento | "Todavia no hay datos suficientes para notar cambios utiles." |
| `DISCOVERIES_UPDATED` | `DISCOVERIES` | Actualizados | Insight recalculado | Seccion actualizados | Ver detalle | Badge "Actualizado" |
| `DISCOVERIES_LOADING` | `DISCOVERIES` | Carga | Fetch | Skeleton cards | Ninguna | No usar copy largo. |
| `DISCOVERIES_ERROR` | `DISCOVERIES` | Error | Falla carga | Banner inline | Reintentar | "No pude cargar descubrimientos." |
| `DISCOVERIES_DISCREET` | `DISCOVERIES` | Discreto | Privacidad activa | Insights sin montos | Ver detalle | "Tu gasto en esta categoria cambio." |
| `DISCOVERY_DETAIL_NORMAL` | `DISCOVERY_DETAIL` | Normal | Insight validado | Hero + evidencia | Ver movimientos | "De donde sale" |
| `DISCOVERY_DETAIL_UPDATED` | `DISCOVERY_DETAIL` | Actualizado | Correccion cambia dato | Banner actualizado | Ver movimientos | "Actualizado despues de una correccion." |
| `DISCOVERY_DETAIL_FEEDBACK` | `DISCOVERY_DETAIL` | Feedback | Usuario evalua | Util/no util | Marcar feedback | Tooltips obligatorios. |
| `DISCOVERY_DETAIL_LOADING` | `DISCOVERY_DETAIL` | Carga | Abre detalle | Skeleton | Ninguna | No usar copy largo. |
| `DISCOVERY_DETAIL_ERROR` | `DISCOVERY_DETAIL` | Error | No carga | Error state | Reintentar | "No pude cargar este descubrimiento." |
| `DISCOVERY_DETAIL_DISCREET` | `DISCOVERY_DETAIL` | Discreto | Privacidad activa | Evidencia resumida | Ver movimientos | "Hay un cambio en esta categoria." |

### 6.10 Busqueda natural

| ID visual | Pantalla | Estado | Cuando aparece | Bloque protagonista | Accion principal | Copy exacto recomendado |
|---|---|---|---|---|---|---|
| `SEARCH_INITIAL` | `SEARCH` | Inicial | Abre busqueda | Input + sugerencias | Escribir | "Busca algo de tu dinero" |
| `SEARCH_TYPING` | `SEARCH` | Escribiendo | Input activo | Input | Esperar submit | Sin resultados hasta enviar. |
| `SEARCH_LOADING` | `SEARCH` | Cargando | Query enviada | Spinner panel | Esperar | "Buscando..." |
| `SEARCH_RESULTS` | `SEARCH` | Resultados | Query con datos | Resultado rapido + fuentes | Ver movimientos filtrados | "Resultado rapido" |
| `SEARCH_NO_RESULTS` | `SEARCH` | Sin resultados | Query sin match | Empty search | Revisar pendientes si aplica | "No encontre movimientos sobre eso." |
| `SEARCH_WRITE_ATTEMPT` | `SEARCH` | Intento accion | Usuario pide borrar/editar | Guardrail | Abrir movimiento | "Para borrar un movimiento, abrelo y confirma la accion." |
| `SEARCH_AI_ERROR` | `SEARCH` | Error IA | Falla motor | Error calmado | Filtrar manualmente | "No pude procesar esa busqueda ahora." |
| `SEARCH_DISCREET` | `SEARCH` | Discreto | Privacidad activa | Resultado sin datos sensibles | Ver fuente | No mostrar personas/comercios sensibles. |

### 6.11 Configuracion y Gmail

| ID visual | Pantalla | Estado | Cuando aparece | Bloque protagonista | Accion principal | Copy exacto recomendado |
|---|---|---|---|---|---|---|
| `SETTINGS_FUNCTIONAL` | `SETTINGS` | Funcional | Configuracion | Secciones | Guardar preferencias | "Configuracion" |
| `SETTINGS_EMAIL_CONNECTED` | `SETTINGS` | Gmail conectado | OAuth activo | Estado email | Desconectar | Badge "Conectado" |
| `SETTINGS_EMAIL_NOT_CONNECTED` | `SETTINGS` | Gmail no conectado | Sin OAuth | CTA email | Conectar Gmail | "Conecta Gmail para deteccion automatica." |
| `SETTINGS_SAVING_TOGGLE` | `SETTINGS` | Guardando preferencia | Toggle cambia | Toggle loading | Esperar | No bloquear toda pantalla. |
| `SETTINGS_SAVE_ERROR` | `SETTINGS` | Error guardar | Falla preferencia | Inline/toast | Reintentar | "No pude guardar este cambio." |
| `SETTINGS_DISCREET_ON` | `SETTINGS` | Modo discreto activo | Toggle on | Privacidad | Desactivar | "Modo discreto" |
| `GMAIL_CONNECT` | Modal | Conectar Gmail | CTA Gmail | Explicacion privacidad | Conectar Gmail | "Nunca registra desde email sin tu aprobacion." |
| `GMAIL_DISCONNECT` | Modal | Desconectar Gmail | CTA desconectar | Consecuencia clara | Desconectar | "Tus movimientos ya confirmados se mantienen." |

### 6.12 Modales y drawers

| ID visual | Pieza | Estado | Cuando aparece | Bloque protagonista | Accion principal | Copy exacto recomendado |
|---|---|---|---|---|---|---|
| `MODAL_CONFIRM_DEFAULT` | `MODAL_CONFIRM` | Confirmacion | Accion normal | Consecuencia | Confirmar accion | Texto especifico por accion. |
| `MODAL_RISK_DELETE_MOVEMENT` | `MODAL_RISK` | Borrar movimiento | Accion destructiva | Alerta | Si, borrar | "Esta accion no se puede deshacer." |
| `MODAL_RISK_ADJUSTMENT` | `MODAL_RISK` | Ajuste saldo | Ajuste financiero | Alerta | Confirmar ajuste | "Esto cambiara un saldo base." |
| `MODAL_DETAIL_QUICK_MOVEMENT` | `MODAL_DETAIL_QUICK` | Preview movimiento | Lista/Home/Search | Resumen | Abrir detalle | Maximo 4 filas clave. |
| `MODAL_DETAIL_QUICK_PENDING` | `MODAL_DETAIL_QUICK` | Preview pendiente | Pendientes/Home | Resumen protegido | Revisar | "No afecta tu saldo hasta que confirmes." |
| `MODAL_DETAIL_QUICK_DEBT` | `MODAL_DETAIL_QUICK` | Preview deuda | Deudas/Home | Progreso | Ver deuda | Mostrar progreso sin culpa. |
| `DRAWER_MORE_DEFAULT` | `DRAWER_MORE` | Menu mobile | Tap Mas | Lista destinos | Navegar | Deudas, Pagos que vienen, Descubrimientos, Configuracion. |
| `DRAWER_FILTERS_DEFAULT` | `DRAWER_FILTERS` | Filtros | Tap Filtrar | Filtros completos | Aplicar filtros | "Filtrar movimientos" |
| `DRAWER_FILTERS_APPLYING` | `DRAWER_FILTERS` | Aplicando | Tap aplicar | Boton loading | Esperar | "Aplicando..." |
| `DRAWER_FILTERS_ERROR` | `DRAWER_FILTERS` | Error | Falla filtro | Toast | Reintentar | "No pude aplicar filtros." |
| `DRAWER_MOVEMENT_NEW` | `DRAWER_MOVEMENT_NEW` | Nuevo mobile | FAB mobile | Form dinamico | Guardar | Sigue variantes de MOVEMENT_NEW. |
| `DRAWER_MOVEMENT_EDIT` | `DRAWER_MOVEMENT_EDIT` | Editar mobile | Editar mobile | Form dinamico | Guardar cambios | Sigue variantes de MOVEMENT_EDIT. |
| `DRAWER_PENDING_DETAIL` | `DRAWER_PENDING_DETAIL` | Pendiente mobile | Tap pendiente | Detalle protegido | Confirmar | Sigue variantes de PENDING_DETAIL. |

### 6.13 Conteo oficial y orden numerado de frames

El prototipo visual V1 completo debe contener exactamente **151 frames/variantes visuales**.

Esta cantidad no es aproximada. Si Stitch o una herramienta equivalente no puede generar los 151 frames en una sola pasada, debe generarlos por bloques, pero la entrega final debe conservar este orden y esta numeracion.

No es aceptable entregar solo 2, 3, 25 o 50 pantallas. Las 25 pantallas base y sus versiones mobile/desktop no reemplazan este inventario de estados. Cada fila de esta lista representa un frame, variante, modal, drawer u overlay que debe existir visualmente.

| # | ID visual | Pantalla/pieza | Estado |
|---:|---|---|---|
| 1 | `AUTH_SPLASH_LOADING` | `AUTH_SPLASH` | Loading inicial |
| 2 | `AUTH_SPLASH_RETURN_VALID` | `AUTH_SPLASH` | Sesion valida |
| 3 | `AUTH_SPLASH_NEW_USER` | `AUTH_SPLASH` | Usuario nuevo |
| 4 | `AUTH_SPLASH_NETWORK_ERROR` | `AUTH_SPLASH` | Error de red |
| 5 | `AUTH_LOGIN_DEFAULT` | `AUTH_LOGIN` | Default |
| 6 | `AUTH_LOGIN_INVALID` | `AUTH_LOGIN` | Campo invalido |
| 7 | `AUTH_LOGIN_SENDING` | `AUTH_LOGIN` | Enviando codigo |
| 8 | `AUTH_LOGIN_RATE_LIMIT` | `AUTH_LOGIN` | Reintentos limitados |
| 9 | `AUTH_VERIFY_DEFAULT` | `AUTH_VERIFY` | Esperando OTP |
| 10 | `AUTH_VERIFY_ERROR` | `AUTH_VERIFY` | OTP incorrecto |
| 11 | `AUTH_VERIFY_COOLDOWN` | `AUTH_VERIFY` | Reenvio bloqueado |
| 12 | `AUTH_VERIFY_CHECKING` | `AUTH_VERIFY` | Verificando |
| 13 | `AUTH_SESSION_EXPIRED_OVERLAY` | `AUTH_SESSION_EXPIRED` | Sesion vencida |
| 14 | `ONBOARDING_WELCOME_DEFAULT` | `ONBOARDING_WELCOME` | Bienvenida |
| 15 | `ONBOARDING_WHATSAPP_DEFAULT` | `ONBOARDING_WHATSAPP` | Conectar WhatsApp |
| 16 | `ONBOARDING_WHATSAPP_HELP` | `ONBOARDING_WHATSAPP` | Ayuda |
| 17 | `ONBOARDING_FIRST_MOVE_DEFAULT` | `ONBOARDING_FIRST_MOVE` | Primer movimiento |
| 18 | `ONBOARDING_FIRST_MOVE_WHATSAPP_EXAMPLE` | `ONBOARDING_FIRST_MOVE` | Ejemplo WhatsApp |
| 19 | `ONBOARDING_EMAIL_OPT_DEFAULT` | `ONBOARDING_EMAIL_OPT` | Gmail opcional |
| 20 | `ONBOARDING_EMAIL_OPT_SKIP` | `ONBOARDING_EMAIL_OPT` | Omitido |
| 21 | `ONBOARDING_COMPLETE_DEFAULT` | `ONBOARDING_COMPLETE` | Listo |
| 22 | `HOME_EMPTY` | `HOME` | Sin datos |
| 23 | `HOME_EARLY` | `HOME` | Temprano |
| 24 | `HOME_FUNCTIONAL` | `HOME` | Funcional |
| 25 | `HOME_WITH_PENDING` | `HOME` | Pendiente destacado |
| 26 | `HOME_WITH_INSIGHT` | `HOME` | Descubrimiento |
| 27 | `HOME_WITH_UPCOMING` | `HOME` | Compromiso proximo |
| 28 | `HOME_LOADING` | `HOME` | Carga |
| 29 | `HOME_ERROR` | `HOME` | Error |
| 30 | `HOME_RECALCULATING` | `HOME` | Recalculando |
| 31 | `HOME_DISCREET` | `HOME` | Modo discreto |
| 32 | `MOVEMENTS_FUNCTIONAL` | `MOVEMENTS` | Lista |
| 33 | `MOVEMENTS_EMPTY` | `MOVEMENTS` | Vacio |
| 34 | `MOVEMENTS_NO_RESULTS` | `MOVEMENTS` | Sin resultados |
| 35 | `MOVEMENTS_LOADING` | `MOVEMENTS` | Carga |
| 36 | `MOVEMENTS_ERROR` | `MOVEMENTS` | Error |
| 37 | `MOVEMENTS_DISCREET` | `MOVEMENTS` | Discreto |
| 38 | `MOVEMENT_DETAIL_CONFIRMED` | `MOVEMENT_DETAIL` | Confirmado |
| 39 | `MOVEMENT_DETAIL_TO_CORRECT` | `MOVEMENT_DETAIL` | Por corregir |
| 40 | `MOVEMENT_DETAIL_CORRECTED` | `MOVEMENT_DETAIL` | Corregido |
| 41 | `MOVEMENT_DETAIL_LOADING` | `MOVEMENT_DETAIL` | Carga |
| 42 | `MOVEMENT_DETAIL_ERROR` | `MOVEMENT_DETAIL` | Error |
| 43 | `MOVEMENT_DETAIL_DISCREET` | `MOVEMENT_DETAIL` | Discreto |
| 44 | `MOVEMENT_NEW_GASTO` | `MOVEMENT_NEW` | Gasto |
| 45 | `MOVEMENT_NEW_INGRESO` | `MOVEMENT_NEW` | Ingreso |
| 46 | `MOVEMENT_NEW_TRANSFERENCIA` | `MOVEMENT_NEW` | Transferencia |
| 47 | `MOVEMENT_NEW_ASIGNACION_INTERNA` | `MOVEMENT_NEW` | asignacion_interna |
| 48 | `MOVEMENT_NEW_DEUDA_ADQUIRIDA` | `MOVEMENT_NEW` | Deuda adquirida |
| 49 | `MOVEMENT_NEW_PAGO_DEUDA` | `MOVEMENT_NEW` | Pago deuda |
| 50 | `MOVEMENT_NEW_PRESTAMO_DADO` | `MOVEMENT_NEW` | Prestamo dado |
| 51 | `MOVEMENT_NEW_PRESTAMO_RECIBIDO` | `MOVEMENT_NEW` | Prestamo recibido |
| 52 | `MOVEMENT_NEW_DEVOLUCION_RECIBIDA` | `MOVEMENT_NEW` | Devolucion recibida |
| 53 | `MOVEMENT_NEW_PAGO_RECURRENTE` | `MOVEMENT_NEW` | Pago recurrente |
| 54 | `MOVEMENT_NEW_AJUSTE` | `MOVEMENT_NEW` | Ajuste |
| 55 | `MOVEMENT_FORM_VALIDATION` | `MOVEMENT_NEW/EDIT` | Validacion |
| 56 | `MOVEMENT_FORM_DUPLICATE` | `MOVEMENT_NEW/EDIT` | Duplicado posible |
| 57 | `MOVEMENT_FORM_SAVING` | `MOVEMENT_NEW/EDIT` | Guardando |
| 58 | `MOVEMENT_FORM_ERROR` | `MOVEMENT_NEW/EDIT` | Error guardar |
| 59 | `MOVEMENT_FORM_SUCCESS` | `MOVEMENT_NEW/EDIT` | Exito |
| 60 | `PENDING_FUNCTIONAL` | `PENDING` | Lista |
| 61 | `PENDING_EMPTY` | `PENDING` | Vacio |
| 62 | `PENDING_BATCH` | `PENDING` | Batch |
| 63 | `PENDING_LOADING` | `PENDING` | Carga |
| 64 | `PENDING_ERROR` | `PENDING` | Error |
| 65 | `PENDING_DISCREET` | `PENDING` | Discreto |
| 66 | `PENDING_DETAIL_DEFAULT` | `PENDING_DETAIL` | Detalle |
| 67 | `PENDING_DETAIL_EDITING` | `PENDING_DETAIL` | Editando |
| 68 | `PENDING_DETAIL_CONFIRMING` | `PENDING_DETAIL` | Confirmando |
| 69 | `PENDING_DETAIL_REJECTING` | `PENDING_DETAIL` | Rechazando |
| 70 | `PENDING_DETAIL_ALREADY_REGISTERED` | `PENDING_DETAIL` | Ya registrado |
| 71 | `PENDING_DETAIL_LOADING` | `PENDING_DETAIL` | Carga |
| 72 | `PENDING_DETAIL_ERROR` | `PENDING_DETAIL` | Error |
| 73 | `PENDING_DETAIL_DISCREET` | `PENDING_DETAIL` | Discreto |
| 74 | `MY_MONEY_FUNCTIONAL` | `MY_MONEY` | Funcional |
| 75 | `MY_MONEY_NO_ACCOUNTS` | `MY_MONEY` | Sin cuentas |
| 76 | `MY_MONEY_PARTIAL_NO_BOXES` | `MY_MONEY` | Parcial |
| 77 | `MY_MONEY_LOADING` | `MY_MONEY` | Carga |
| 78 | `MY_MONEY_ERROR` | `MY_MONEY` | Error |
| 79 | `MY_MONEY_RECALCULATING` | `MY_MONEY` | Recalculando |
| 80 | `MY_MONEY_DISCREET` | `MY_MONEY` | Discreto |
| 81 | `ACCOUNT_CREATE` | `Modal/drawer` | Crear cuenta |
| 82 | `ACCOUNT_EDIT` | `Modal/drawer` | Editar cuenta |
| 83 | `BOX_CREATE` | `Modal/drawer` | Crear caja |
| 84 | `BOX_EDIT` | `Modal/drawer` | Editar caja |
| 85 | `DEBTS_FUNCTIONAL` | `DEBTS` | Funcional |
| 86 | `DEBTS_EMPTY` | `DEBTS` | Vacio |
| 87 | `DEBTS_LOADING` | `DEBTS` | Carga |
| 88 | `DEBTS_ERROR` | `DEBTS` | Error |
| 89 | `DEBTS_DISCREET` | `DEBTS` | Discreto |
| 90 | `DEBT_DETAIL_ACTIVE` | `DEBT_DETAIL` | Activa |
| 91 | `DEBT_DETAIL_PAID` | `DEBT_DETAIL` | Saldada |
| 92 | `DEBT_DETAIL_EMPTY_HISTORY` | `DEBT_DETAIL` | Sin pagos |
| 93 | `DEBT_DETAIL_LOADING` | `DEBT_DETAIL` | Carga |
| 94 | `DEBT_DETAIL_ERROR` | `DEBT_DETAIL` | Error |
| 95 | `DEBT_DETAIL_DISCREET` | `DEBT_DETAIL` | Discreto |
| 96 | `DEBT_CREATE` | `Modal/drawer` | Crear deuda |
| 97 | `DEBT_EDIT` | `Modal/drawer` | Editar deuda |
| 98 | `UPCOMING_FUNCTIONAL` | `UPCOMING` | Funcional |
| 99 | `UPCOMING_EMPTY` | `UPCOMING` | Vacio |
| 100 | `UPCOMING_WITH_SUGGESTED` | `UPCOMING` | Sugeridos |
| 101 | `UPCOMING_WITH_OVERDUE` | `UPCOMING` | Vencidos |
| 102 | `UPCOMING_LOADING` | `UPCOMING` | Carga |
| 103 | `UPCOMING_ERROR` | `UPCOMING` | Error |
| 104 | `UPCOMING_DISCREET` | `UPCOMING` | Discreto |
| 105 | `UPCOMING_DETAIL_ACTIVE` | `UPCOMING_DETAIL` | Activo |
| 106 | `UPCOMING_DETAIL_SUGGESTED` | `UPCOMING_DETAIL` | Sugerido |
| 107 | `UPCOMING_DETAIL_OVERDUE` | `UPCOMING_DETAIL` | Vencido |
| 108 | `UPCOMING_DETAIL_PAUSED` | `UPCOMING_DETAIL` | Pausado |
| 109 | `UPCOMING_CREATE` | `Modal/drawer` | Crear pago |
| 110 | `UPCOMING_EDIT` | `Modal/drawer` | Editar pago |
| 111 | `DISCOVERIES_FUNCTIONAL` | `DISCOVERIES` | Funcional |
| 112 | `DISCOVERIES_NOT_ENOUGH_DATA` | `DISCOVERIES` | Sin datos |
| 113 | `DISCOVERIES_UPDATED` | `DISCOVERIES` | Actualizados |
| 114 | `DISCOVERIES_LOADING` | `DISCOVERIES` | Carga |
| 115 | `DISCOVERIES_ERROR` | `DISCOVERIES` | Error |
| 116 | `DISCOVERIES_DISCREET` | `DISCOVERIES` | Discreto |
| 117 | `DISCOVERY_DETAIL_NORMAL` | `DISCOVERY_DETAIL` | Normal |
| 118 | `DISCOVERY_DETAIL_UPDATED` | `DISCOVERY_DETAIL` | Actualizado |
| 119 | `DISCOVERY_DETAIL_FEEDBACK` | `DISCOVERY_DETAIL` | Feedback |
| 120 | `DISCOVERY_DETAIL_LOADING` | `DISCOVERY_DETAIL` | Carga |
| 121 | `DISCOVERY_DETAIL_ERROR` | `DISCOVERY_DETAIL` | Error |
| 122 | `DISCOVERY_DETAIL_DISCREET` | `DISCOVERY_DETAIL` | Discreto |
| 123 | `SEARCH_INITIAL` | `SEARCH` | Inicial |
| 124 | `SEARCH_TYPING` | `SEARCH` | Escribiendo |
| 125 | `SEARCH_LOADING` | `SEARCH` | Cargando |
| 126 | `SEARCH_RESULTS` | `SEARCH` | Resultados |
| 127 | `SEARCH_NO_RESULTS` | `SEARCH` | Sin resultados |
| 128 | `SEARCH_WRITE_ATTEMPT` | `SEARCH` | Intento accion |
| 129 | `SEARCH_AI_ERROR` | `SEARCH` | Error IA |
| 130 | `SEARCH_DISCREET` | `SEARCH` | Discreto |
| 131 | `SETTINGS_FUNCTIONAL` | `SETTINGS` | Funcional |
| 132 | `SETTINGS_EMAIL_CONNECTED` | `SETTINGS` | Gmail conectado |
| 133 | `SETTINGS_EMAIL_NOT_CONNECTED` | `SETTINGS` | Gmail no conectado |
| 134 | `SETTINGS_SAVING_TOGGLE` | `SETTINGS` | Guardando preferencia |
| 135 | `SETTINGS_SAVE_ERROR` | `SETTINGS` | Error guardar |
| 136 | `SETTINGS_DISCREET_ON` | `SETTINGS` | Modo discreto activo |
| 137 | `GMAIL_CONNECT` | `Modal` | Conectar Gmail |
| 138 | `GMAIL_DISCONNECT` | `Modal` | Desconectar Gmail |
| 139 | `MODAL_CONFIRM_DEFAULT` | `MODAL_CONFIRM` | Confirmacion |
| 140 | `MODAL_RISK_DELETE_MOVEMENT` | `MODAL_RISK` | Borrar movimiento |
| 141 | `MODAL_RISK_ADJUSTMENT` | `MODAL_RISK` | Ajuste saldo |
| 142 | `MODAL_DETAIL_QUICK_MOVEMENT` | `MODAL_DETAIL_QUICK` | Preview movimiento |
| 143 | `MODAL_DETAIL_QUICK_PENDING` | `MODAL_DETAIL_QUICK` | Preview pendiente |
| 144 | `MODAL_DETAIL_QUICK_DEBT` | `MODAL_DETAIL_QUICK` | Preview deuda |
| 145 | `DRAWER_MORE_DEFAULT` | `DRAWER_MORE` | Menu mobile |
| 146 | `DRAWER_FILTERS_DEFAULT` | `DRAWER_FILTERS` | Filtros |
| 147 | `DRAWER_FILTERS_APPLYING` | `DRAWER_FILTERS` | Aplicando |
| 148 | `DRAWER_FILTERS_ERROR` | `DRAWER_FILTERS` | Error |
| 149 | `DRAWER_MOVEMENT_NEW` | `DRAWER_MOVEMENT_NEW` | Nuevo mobile |
| 150 | `DRAWER_MOVEMENT_EDIT` | `DRAWER_MOVEMENT_EDIT` | Editar mobile |
| 151 | `DRAWER_PENDING_DETAIL` | `DRAWER_PENDING_DETAIL` | Pendiente mobile |

---

## 7. Pantallas maestras que deben tener mobile y desktop

Stitch debe generar mobile y desktop para estas pantallas:

| Pantalla | Mobile | Desktop |
|---|---|---|
| `AUTH_SPLASH` | Si | Si |
| `AUTH_LOGIN` | Si | Si |
| `AUTH_VERIFY` | Si | Si |
| `AUTH_SESSION_EXPIRED` | Si | Si |
| `ONBOARDING_WELCOME` | Si | Si |
| `ONBOARDING_WHATSAPP` | Si | Si |
| `ONBOARDING_FIRST_MOVE` | Si | Si |
| `ONBOARDING_EMAIL_OPT` | Si | Si |
| `ONBOARDING_COMPLETE` | Si | Si |
| `HOME` | Si | Si |
| `MOVEMENTS` | Si | Si |
| `MOVEMENT_DETAIL` | Si | Si |
| `MOVEMENT_NEW` | Si, drawer | Si, modal |
| `MOVEMENT_EDIT` | Si, drawer | Si, modal |
| `PENDING` | Si | Si |
| `PENDING_DETAIL` | Si, drawer | Si, modal/panel |
| `MY_MONEY` | Si | Si |
| `DEBTS` | Si | Si |
| `DEBT_DETAIL` | Si | Si |
| `UPCOMING` | Si | Si |
| `UPCOMING_DETAIL` | Si | Si |
| `DISCOVERIES` | Si | Si |
| `DISCOVERY_DETAIL` | Si | Si |
| `SEARCH` | Si, pantalla | Si, panel |
| `SETTINGS` | Si | Si |

Modales y drawers deben generarse en el contexto visual que corresponda.

---

## 8. Criterios de calidad visual

Antes de aprobar un resultado de Stitch, revisar:

| Criterio | Pregunta de aceptacion |
|---|---|
| Identidad | Se reconoce como Manzana sin leer el logo? |
| Calma | La pantalla reduce ansiedad o agrega ruido? |
| Foco | Hay una sola accion principal por contexto? |
| Confianza | Se entiende que pendientes no afectan saldos? |
| Claridad financiera | Dinero libre, cuentas, cajas y compromisos se distinguen? |
| Correccion | El usuario siente que puede arreglar errores facil? |
| Privacidad | Modo discreto oculta datos sin romper layout? |
| Premium calido | Evita banco, Excel, SaaS generico y app infantil? |
| Consistencia | Botones, cards, estados y espaciado siguen Doc 29? |
| Alcance | No se inventaron pantallas o features fuera de V1? |
| Estados | Loading, error, vacio, discreto y recalculando estan representados? |
| Accion | Cada pantalla permite continuar, corregir, confirmar o volver? |

Si falla en identidad, calma, confianza o alcance, no aprobar.

---

## 9. Checklist de entrega de Stitch

La entrega visual se considera completa solo si incluye:

- Exactamente 151 frames/variantes visuales, numerados del 1 al 151 segun la seccion 6.13.
- Bloque A completo y aprobado como lenguaje visual maestro.
- Todas las pantallas principales mobile.
- Todas las pantallas principales desktop.
- Estados vacios de `HOME`, `MOVEMENTS`, `PENDING`, `MY_MONEY`, `DEBTS`, `UPCOMING`, `DISCOVERIES`.
- Estados loading de pantallas principales.
- Estados error de pantallas principales.
- Estado `AUTH_SESSION_EXPIRED`.
- Reapertura desde `AUTH_SPLASH`.
- `PENDING_DETAIL` con proteccion visible.
- `MOVEMENT_NEW` con los 11 tipos canonicos o al menos una pantalla maestra + variantes claramente generadas.
- `SEARCH` con resultado, sin resultado e intento de accion.
- Modo discreto aplicado en Home, Movimientos, Pendientes, Mi Dinero, Deudas, Pagos y Descubrimientos.
- Modales de confirmacion y riesgo.
- Drawers mobile: Mas, Filtros, Nuevo movimiento, Editar movimiento, Detalle pendiente.
- Formularios de cuenta, caja, deuda, pago que viene y Gmail.

---

## 10. Criterios de rechazo inmediato

Rechazar el prototipo si:

- entrega menos o mas de 151 frames/variantes visuales sin explicar y corregir el inventario;
- entrega solo 2, 3, 25 o 50 pantallas como si fuera la V1 completa;
- parece landing page en vez de app usable;
- se centra en marketing en lugar de operacion financiera;
- usa fuentes serif en titulos, montos, sidebar o cards;
- usa ingles visible en marca o labels principales;
- usa una estetica bancaria fria;
- usa una estetica infantil o gamificada;
- usa una plantilla SaaS generica;
- muestra Home desktop como un dashboard editorial/contable con una card de dinero libre gigante;
- usa "Añadir Transacción" en vez de "Nuevo movimiento" o "Registrar nuevo movimiento";
- usa barras verticales laterales en cards de pendientes, insights, deudas, pagos o alertas;
- no muestra estados vacios;
- no muestra errores recuperables;
- los pendientes parecen movimientos confirmados;
- los saldos cambian por pendientes de email;
- el modo discreto solo oculta un numero y deja expuestos nombres sensibles;
- la navegacion mobile usa `+` como item de bottom nav en lugar de `Mas`;
- inventa multi-moneda UI completa, integraciones bancarias directas, pricing, beta, MVP o features no documentadas;
- los botones no tienen jerarquia clara;
- cada pantalla tiene demasiadas cards del mismo peso;
- el usuario no puede saber que hacer despues.

---

## 11. Resultado esperado

Al terminar, Stitch debe producir una familia visual coherente que pueda usarse como referencia profesional de V1.

No tiene que ser codigo final. Si debe servir para:

- validar look and feel;
- revisar experiencia de pantallas y estados;
- entregar a Cursor/Claude como referencia visual;
- construir componentes con menos interpretacion;
- detectar contradicciones antes de implementar.

El prototipo visual no reemplaza las specs funcionales, tecnicas ni financieras. Es una capa de claridad para construir mejor.

---

*Fase 6 Visual - Documento 33 - V1*
