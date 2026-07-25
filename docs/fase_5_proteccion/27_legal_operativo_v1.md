# 27 - Legal Operativo V1

**Estado:** V1.4 - Contrato operativo legal sincronizado con Kapso WhatsApp V1  
**Ultima actualizacion:** 13 de junio, 2026  
**Depende de:** `24_privacidad_proteccion_datos.md`, `25_unit_economics_costos.md`, `26_gtm_lanzamiento_v1_primeros_usuarios.md`, `21_decision_whatsapp_provider.md`, `22_decision_email_provider.md`, Fase 3 Producto, Fase 4 Tecnica  

---

## 1. Tesis

Manzana maneja informacion financiera, conversaciones privadas, emails financieros, deudas, personas relacionadas, habitos, recordatorios e inferencias de IA.

Por eso no puede llegar a lanzamiento publico V1 con legal improvisado.

La tesis:

```text
Legal operativo no debe volver fria a Manzana.
Debe convertir confianza, privacidad y responsabilidad en reglas concretas que el producto pueda cumplir.
```

Este documento no es asesoria legal. Es el contrato operativo que prepara a Manzana para trabajar con abogados, proveedores, usuarios reales y lanzamiento V1 directo sin improvisar.

---

## 2. No Es Asesoria Legal

Este documento no reemplaza revision de abogado ni opinion formal sobre cumplimiento.

Antes de lanzamiento publico, cobro o escala se debe validar con asesoria legal local:

- Ley N. 29733, Ley de Proteccion de Datos Personales;
- Reglamento vigente de la LPDP;
- obligaciones ante la Autoridad Nacional de Proteccion de Datos Personales;
- registro o gestion de banco de datos personales si corresponde;
- terminos y condiciones;
- politica de privacidad;
- consentimiento informado;
- tratamiento de datos sensibles;
- derechos ARCO;
- transferencia internacional de datos;
- contratos con proveedores/subencargados;
- Google OAuth/Gmail restricted scopes;
- Kapso, Meta WhatsApp Business Terms y Messaging Policy;
- pagos, facturacion, reembolsos e impuestos si se cobra.

Regla:

```text
Este documento prepara el sistema.
El abogado valida el texto legal final y las obligaciones formales.
```

---

## 3. Principios No Negociables

| Principio | Regla |
|---|---|
| Transparencia humana | El usuario debe entender que datos se usan, para que y como puede controlarlos. |
| Consentimiento contextual | Pedir permisos cuando el usuario entiende el beneficio, no en bloque. |
| Control real | Exportar, borrar, desconectar Gmail, pausar WhatsApp y cambiar opt-ins debe ser posible. |
| No asesoria financiera | Manzana organiza, recuerda y explica; no da asesoramiento financiero, legal, tributario, crediticio ni de inversion. |
| No entidad financiera | Manzana no es banco, billetera, broker, cobrador, asesor de inversiones ni entidad de credito. |
| Email siempre confirma | Ningun email crea movimiento confirmado sin aprobacion del usuario. |
| Pendientes no afectan saldos | Lo detectado no confirmado queda separado del Core financiero confirmado. |
| Oficial sobre atajos | WhatsApp y Gmail usan vias oficiales; no scraping, sesiones QR ni passwords. |
| Soporte con minimo acceso | Soporte humano no ve datos financieros completos salvo necesidad justificada y auditada. |
| Incidentes sin ocultar | Si hay exposicion, perdida o tratamiento indebido de datos, se contiene, documenta y comunica segun corresponda. |
| Marketing sin culpa | No usar miedo, verguenza ni promesas de ahorro garantizado. |
| Calidad protegida | Cumplimiento no debe ser excusa para romper la experiencia; se disena mejor. |

---

## 4. Estados De Preparacion Legal

Manzana debe distinguir entre probar internamente, lanzar V1 y cobrar.

| Estado | Puede hacer | No puede hacer |
|---|---|---|
| Pruebas internas | Probar con datos ficticios o usuarios del equipo. | Prometer disponibilidad publica. |
| Release candidate V1 | Validar internamente la V1 completa antes de abrir. | Presentarlo como producto disponible al publico. |
| Lanzamiento V1 publico | Operar con politicas, terminos, soporte y proveedores revisados. | Lanzar con legal improvisado o soporte insuficiente. |
| Cobro V1 | Cobrar con terminos, cancelacion, soporte y facturacion claros. | Cobrar por promesas no estables o juridicamente ambiguas. |
| Escala | Abrir mas usuarios con procesos, monitoreo y cumplimiento revisados. | Tratar legal como pagina estatica abandonada. |

Regla:

```text
Cada estado requiere mas formalidad.
No se debe confundir QA interno con lanzamiento publico.
```

---

## 5. Paquete Legal Minimo Por Etapa

### 5.1 Pruebas Internas

Requiere:

- datos de prueba o usuarios internos informados;
- no usar emails personales reales sin consentimiento;
- no conectar cuentas Gmail de terceros;
- no enviar mensajes proactivos a usuarios externos;
- no guardar datos sensibles reales innecesarios;
- lista interna de riesgos conocidos.

### 5.2 Release Candidate V1

Requiere:

- aviso de prueba interna/release candidate si hay usuarios de confianza;
- politica de privacidad preparada para V1;
- terminos V1 preparados;
- consentimiento para WhatsApp;
- consentimiento para mensajes proactivos si aplican;
- soporte definido;
- proceso manual de eliminacion/exportacion;
- proceso de desconexion Gmail si se prueba;
- registro de incidentes;
- lista de proveedores;
- disclaimer de no asesoria financiera.

### 5.3 Lanzamiento V1 Publico

Requiere todo lo anterior, mas:

- politica de privacidad revisada por abogado;
- terminos de uso revisados;
- matriz de datos y finalidades;
- procesos ARCO;
- contratos/terminos de proveedores revisados;
- evaluacion de transferencia internacional;
- verificacion Google OAuth si aplica;
- flujo claro de consentimiento Gmail;
- flujo claro de opt-in/opt-out WhatsApp;
- soporte con tiempos de respuesta;
- incident response plan formal.

### 5.4 Cobro V1

Requiere todo lo anterior, mas:

- terminos de pago;
- precios, impuestos y moneda;
- cancelacion;
- reembolsos;
- suspension de cuenta;
- cambios de plan;
- facturacion/boleta si corresponde;
- soporte para reclamos comerciales;
- definicion de que pasa con datos al cancelar.

### 5.5 Escala Post-Lanzamiento

Requiere:

- asesor legal local;
- politicas publicas finales;
- registro/gestion de banco de datos personales si corresponde;
- seguridad y retencion revisadas;
- auditoria de proveedores criticos;
- procesos de incidentes probados;
- soporte operativo;
- responsable interno de privacidad;
- revision periodica de cambios legales/proveedores.

---

## 6. Documentos Publicos Requeridos

Nota de implementacion:

```text
El paquete publico minimo para Meta vive en `docs/fase_4_tecnica/24_paquete_identidad_meta.md`
y en las rutas `/empresa`, `/privacidad`, `/terminos`, `/contacto` y `/eliminar-datos`.
Ese paquete sirve para verificacion operativa y staging; no reemplaza la revision legal final
antes de lanzamiento publico, cobro o escala.
```

| Documento | Etapa minima | Proposito |
|---|---|---|
| Politica de privacidad V1 | Lanzamiento V1 | Explicar datos, finalidades, derechos y control. |
| Terminos V1 | Lanzamiento V1 | Definir uso, limites, soporte y responsabilidades. |
| Consentimiento WhatsApp | Lanzamiento V1 | Autorizar canal, proactivos, opt-out y modo discreto. |
| Consentimiento Gmail | Solo si Gmail se activa | Explicar scopes, lectura limitada, confirmacion y desconexion. |
| Lista de proveedores | Lanzamiento V1 | Mostrar subencargados y servicios. |
| Disclaimer de IA | Lanzamiento V1 | Explicar que IA ayuda, pero Core valida y el usuario puede corregir. |
| Disclaimer financiero | Lanzamiento V1 | Manzana no es asesor financiero ni entidad financiera. |
| Politica de soporte | Lanzamiento V1 | Definir canales, tiempos y prioridad. |
| Politica de eliminacion/exportacion | Lanzamiento V1 | Dar control real de datos. |
| Politica de incidentes | Interna, antes de lanzamiento publico | Operar filtraciones o errores graves. |
| Cookie/analytics notice | Si dashboard usa cookies/analytics | Explicar tracking y opciones. |
| Terminos de pago | Cobro V1 | Precios, cancelacion, reembolso e impuestos. |

---

## 7. Politica De Privacidad - Contenido Minimo

La politica de privacidad publica debe explicar en lenguaje claro:

- quien es responsable de Manzana;
- que datos se recolectan;
- de donde vienen los datos;
- para que se usan;
- que datos no se recolectan;
- como funciona WhatsApp;
- como funciona Gmail;
- como funciona IA;
- como se usan proveedores;
- donde pueden tratarse los datos;
- cuanto tiempo se guardan;
- como se protegen;
- derechos del usuario;
- como exportar, borrar o corregir;
- como desconectar Gmail;
- como pausar mensajes;
- como contactar soporte/privacidad;
- cambios de politica.

### 7.1 Datos Que Debe Nombrar

| Tipo | Ejemplos |
|---|---|
| Cuenta | nombre, email, telefono, timezone, idioma. |
| WhatsApp | numero, mensajes, status de entrega, opt-ins, ventana. |
| Financiero | movimientos, montos, categorias, cuentas, cajas, saldos derivados. |
| Deudas | personas relacionadas, montos, cuotas, pagos, estado. |
| Email derivado | remitente permitido, fecha, monto, comercio y datos necesarios para pendiente. |
| IA/trazas | outputs estructurados, confianza, errores, tool calls, version de prompt/modelo. |
| Preferencias | modo discreto, horarios, nudges, canales. |
| Soporte | mensajes de soporte, solicitudes, estado de resolucion. |
| Analytics | eventos de producto, activacion, errores, costos, calidad. |

### 7.2 Datos Que Debe Decir Que No Guarda

Por defecto:

- CVV;
- PIN;
- claves bancarias;
- contrasenas de email;
- contrasenas de bancos;
- cuerpo completo de email permanente;
- emails personales, laborales o newsletters no financieros;
- contactos telefonicos de personas relacionadas;
- cuenta bancaria de terceros;
- ubicacion precisa salvo decision futura explicita;
- datos para publicidad financiera externa;
- chain-of-thought crudo de agentes.

### 7.3 Copy Base

```text
Manzana usa tus datos para ayudarte a registrar, recordar y entender tu dinero.
No vendemos tus datos financieros ni los usamos para publicidad de terceros.
Puedes corregir, exportar, borrar, pausar mensajes o desconectar integraciones.
```

---

## 8. Terminos De Uso - Contenido Minimo

Los terminos deben definir:

- que es Manzana;
- que no es Manzana;
- elegibilidad;
- cuenta de usuario;
- uso permitido;
- uso prohibido;
- disponibilidad, limites y soporte;
- exactitud de datos;
- correcciones;
- limites de IA;
- limites de WhatsApp/Gmail;
- responsabilidad del usuario;
- soporte;
- suspension/cierre de cuenta;
- cambios del servicio;
- propiedad intelectual;
- pagos si aplica;
- limitacion de responsabilidad validada por abogado;
- ley aplicable y canal de reclamos.

### 8.1 Que Es Manzana

```text
Manzana es una herramienta de organizacion e inteligencia financiera personal.
Ayuda a registrar movimientos, recordar compromisos y entender informacion financiera personal.
```

### 8.2 Que No Es Manzana

```text
Manzana no es banco, entidad financiera, broker, asesor de inversiones,
asesor tributario, asesor legal, cobrador, billetera digital ni proveedor de credito.
```

### 8.3 Responsabilidad Del Usuario

Debe quedar claro que:

- el usuario debe revisar datos importantes;
- puede haber errores de interpretacion;
- debe corregir informacion incorrecta;
- las decisiones financieras finales son del usuario;
- Manzana no garantiza ahorro ni mejora financiera;
- Manzana no cobra deudas a terceros;
- Manzana no contacta a personas relacionadas por deuda en V1.

---

## 9. Disclaimer Financiero

Manzana puede decir:

```text
Manzana te ayuda a ordenar y entender tu informacion financiera personal.
No reemplaza asesoria financiera, legal, contable ni tributaria.
Las decisiones finales sobre pagos, gastos, deudas o inversiones son tuyas.
```

No debe decir:

```text
Manzana te dira exactamente que hacer con tu dinero.
```

```text
Manzana garantiza que ahorraras.
```

```text
Manzana administra tu dinero automaticamente.
```

Reglas:

- Insights son observaciones, no instrucciones financieras.
- Nudges son recordatorios, no obligaciones.
- Dinero libre es estimacion segun datos disponibles.
- Deudas registradas son memoria personal, no prueba legal de deuda.
- Proyecciones son orientativas, no garantias.

---

## 10. Disclaimer De IA

Manzana usa IA para entender lenguaje, contexto e intencion, pero el dinero se protege con reglas y validaciones.

Copy base:

```text
Manzana usa IA para interpretar mensajes y ayudarte a entender tu dinero.
Los movimientos importantes pueden corregirse y ciertas acciones requieren confirmacion.
```

Reglas:

- no presentar la IA como infalible;
- no decir que la IA "sabe" la verdad financiera;
- no guardar chain-of-thought crudo;
- no usar outputs de IA como escritura financiera directa;
- no usar datos de usuario para entrenar modelos propios sin consentimiento explicito;
- documentar proveedores de IA si procesan datos;
- permitir correcciones.

---

## 11. WhatsApp Legal Operativo

WhatsApp es canal principal, pero es un canal externo.

### 11.1 Reglas

- usar Kapso via `WhatsAppAdapter` como proveedor operativo WhatsApp V1 sobre WhatsApp Business Platform;
- mantener Meta directo solo como escape tecnico futuro detras del adapter;
- no usar WhatsApp Web automation, sesiones QR, scraping ni APIs no oficiales;
- explicar que los mensajes pasan por WhatsApp/Meta;
- obtener opt-in para mensajes proactivos cuando aplique;
- permitir opt-out;
- respetar horario silencioso y Nudge Policy;
- usar modo discreto en mensajes sensibles;
- no enviar datos bancarios completos;
- no pedir CVV, PIN, claves ni codigos bancarios;
- no mandar marketing templates en V1 salvo decision GTM/legal separada;
- registrar consentimiento y cambios de preferencia;
- mantener templates aprobados y revisados.

### 11.2 Opt-In Base

```text
Puedo enviarte mensajes por WhatsApp para confirmar movimientos, recordarte pagos o avisarte cosas importantes de Manzana.
Puedes pausar estos mensajes cuando quieras.
```

Opciones:

- aceptar confirmaciones;
- aceptar recordatorios;
- aceptar resumen semanal;
- pausar mensajes;
- modo discreto.

### 11.3 Opt-Out

Comandos humanos soportados:

- "pausar";
- "no me escribas";
- "desactivar recordatorios";
- "solo cuando yo escriba";
- "modo discreto";
- "cancelar".

Regla:

```text
Si el usuario expresa rechazo razonable, Manzana debe reducir o detener proactivos sin discutir.
```

### 11.4 Modo Discreto

WhatsApp no controla previews del sistema operativo. Por eso:

- explicar que el telefono puede mostrar previews;
- ofrecer modo discreto;
- ocultar monto/comercio/persona/categoria sensible en proactivos;
- no enviar detalles sensibles fuera de ventana si no hay necesidad.

Copy:

```text
Puedo usar modo discreto para no mostrar montos o detalles sensibles en mensajes proactivos.
```

---

## 12. Gmail Legal Operativo

Gmail es sensible. Debe tratarse como integracion de alto cuidado.

### 12.1 Reglas

- usar OAuth oficial;
- no pedir password;
- no pedir app password;
- no scraping;
- pedir scopes minimos;
- explicar que se procesan solo emails financieros compatibles;
- no guardar cuerpo completo por defecto;
- crear pendientes, no movimientos confirmados;
- permitir desconectar Gmail;
- permitir borrar datos derivados;
- cumplir Limited Use y politicas de Google API Services;
- completar verification/security assessment si aplica antes de produccion abierta.

### 12.2 Consentimiento Gmail

Copy base:

```text
Si conectas Gmail, Manzana buscara correos financieros de bancos o apps compatibles para crear pendientes por revisar.
No registra nada automaticamente: tu confirmas antes.
Puedes desconectar Gmail cuando quieras.
```

### 12.3 Disclosure Requerido En Producto

Debe quedar claro:

- que se lee;
- que no se lee;
- para que se usa;
- que se guarda;
- como se desconecta;
- que pasa con datos derivados;
- que proveedores procesan datos;
- que no se usa para publicidad;
- que no se vende.

### 12.4 Regla De Confirmacion

```text
Email detectado
  -> pending_item
  -> confirmacion por WhatsApp o Centro de Confirmaciones
  -> Core solo si usuario aprueba
```

No cambiar esto para mejorar conversion.

---

## 13. Derechos Del Usuario

Manzana debe preparar procesos para:

- acceso;
- rectificacion;
- cancelacion/eliminacion;
- oposicion;
- exportacion;
- desconexion de integraciones;
- revocacion de consentimiento;
- pausa de mensajes;
- cierre de cuenta.

### 13.1 Solicitudes ARCO

Proceso operativo:

```text
Usuario solicita derecho
  -> soporte verifica identidad razonablemente
  -> se registra solicitud
  -> se clasifica tipo
  -> se ejecuta o se pide aclaracion
  -> se responde dentro del plazo legal aplicable
  -> se deja evidencia
```

El plazo exacto debe validarse con abogado segun la normativa vigente.

### 13.2 Exportacion

Exportacion minima:

- movimientos;
- cuentas/cajas;
- deudas;
- recurrentes;
- pendientes;
- preferencias;
- consentimientos;
- resumen de fuentes;
- formato legible.

No exportar:

- secretos;
- tokens;
- datos internos de seguridad;
- chain-of-thought;
- payloads crudos de terceros salvo que legalmente corresponda y sea seguro.

### 13.3 Eliminacion

Debe cubrir:

- cuenta;
- datos financieros;
- datos derivados;
- tokens OAuth;
- preferencias;
- datos de soporte segun retencion;
- logs minimizados/anonymizados cuando sea legal y tecnicamente necesario.

Regla:

```text
Eliminar no debe romper obligaciones de auditoria minima,
pero la retencion debe ser justificada y explicada.
```

---

## 14. Soporte Humano

Soporte es parte de la confianza, pero tambien es una superficie de riesgo.

### 14.1 Principios

- acceso minimo;
- motivo obligatorio;
- audit log;
- no ver mas datos de los necesarios;
- no copiar datos sensibles a canales externos;
- no pedir claves, PIN, CVV ni codigos;
- no resolver dudas financieras como asesor;
- escalar incidentes de privacidad.

### 14.2 Niveles De Acceso

| Nivel | Acceso | Uso |
|---|---|---|
| Nivel 0 | Sin datos financieros, solo estado general. | Preguntas generales. |
| Nivel 1 | Datos minimizados y ultimos eventos relevantes. | Soporte normal. |
| Nivel 2 | Datos financieros especificos del caso. | Correccion/bug con permiso o necesidad. |
| Nivel 3 | Break-glass auditado. | Incidente grave o investigacion critica. |

Regla:

```text
Nivel 2 y 3 deben quedar auditados con usuario, operador, motivo, fecha y datos vistos.
```

### 14.3 Respuestas De Soporte

Ejemplo error de interpretacion:

```text
Gracias por avisar. Lo reviso como error de interpretacion.
Mientras tanto puedes corregirlo diciendo "corrige eso" o editarlo desde Movimientos.
```

Ejemplo privacidad:

```text
Entiendo la preocupacion. Puedo ayudarte a activar modo discreto, revisar que datos guarda Manzana o iniciar eliminacion/exportacion.
```

---

## 15. Incidentes

Un incidente es cualquier evento que pueda afectar confidencialidad, integridad, disponibilidad o confianza.

### 15.1 Tipos

| Tipo | Ejemplo |
|---|---|
| Privacidad | Dato de un usuario visible para otro. |
| Seguridad | Token expuesto, acceso no autorizado. |
| Financiero | Saldo incorrecto por bug del Core. |
| Canal | WhatsApp envio detalle sensible sin modo discreto. |
| Email | Email no financiero procesado indebidamente. |
| IA | Respuesta inventa certeza o revela contexto sensible. |
| Soporte | Operador accede sin motivo suficiente. |
| Proveedor | Caida o filtracion de subprocesador. |

### 15.2 Severidad

| Severidad | Definicion | Accion |
|---|---|---|
| S0 | Riesgo critico: datos sensibles expuestos, acceso cruzado, credenciales. | Contener inmediato, lider de incidente, revision legal. |
| S1 | Error financiero o privacidad relevante sin exposicion masiva. | Corregir, auditar, comunicar si corresponde. |
| S2 | Bug que afecta experiencia/confianza pero no datos sensibles. | Corregir y monitorear. |
| S3 | Incidente menor o degradacion temporal. | Registrar y resolver. |

### 15.3 Flujo

```text
Detectar
  -> contener
  -> clasificar severidad
  -> preservar evidencia
  -> evaluar usuarios afectados
  -> corregir
  -> decidir notificacion legal/usuarios
  -> comunicar con claridad
  -> postmortem
  -> actualizar controles
```

### 15.4 Comunicacion

Principios:

- no ocultar;
- no exagerar;
- decir que paso;
- decir que datos pudieron afectarse;
- decir que se hizo;
- decir que puede hacer el usuario;
- dar canal de soporte;
- evitar lenguaje defensivo.

Template base:

```text
Detectamos un problema que pudo afectar la privacidad de cierta informacion de tu cuenta.
Ya lo contuvimos y estamos revisando el alcance.
Te avisaremos que datos estuvieron involucrados y que pasos recomendamos.
```

### 15.5 Plazos

Los plazos legales exactos deben validarse con abogado.

Como regla operativa interna:

- S0 se evalua el mismo dia;
- privacy/security lead se activa de inmediato;
- se busca completar evaluacion inicial en menos de 24 horas;
- se prepara notificacion si corresponde dentro de la ventana legal aplicable;
- se documenta todo.

---

## 16. Marketing, Testimonios Y Referidos

### 16.1 Permitido

- explicar beneficios con ejemplos ficticios;
- usar datos agregados anonimos si no reidentifican;
- usar testimonios con permiso claro;
- mostrar conversaciones simuladas;
- decir "por WhatsApp";
- hablar de claridad, alivio y menos friccion.

### 16.2 Prohibido

- usar datos financieros reales en anuncios sin consentimiento explicito;
- mostrar nombres, montos, deudas o comercios reales;
- usar verguenza financiera como gancho;
- prometer ahorro garantizado;
- prometer asesoramiento financiero;
- decir que Manzana reemplaza al banco;
- usar datos financieros para audiencias publicitarias;
- incentivar referidos exponiendo deudas.

### 16.3 Copy Seguro

```text
Manzana te ayuda a registrar y entender tu dinero desde WhatsApp.
No necesitas hacer contabilidad.
```

### 16.4 Copy Riesgoso

```text
Manzana te dice exactamente que hacer con tu dinero.
```

```text
Con Manzana ahorraras mas cada mes.
```

```text
Conecta todo y olvidate de revisar.
```

---

## 17. Pagos, Planes Y Reembolsos

Solo aplica si se activa cobro V1 o plan publico.

Antes de cobrar:

- definir proveedor de pagos;
- definir moneda;
- definir precio visible;
- definir impuestos/boleta/factura si corresponde;
- definir reembolso;
- definir cancelacion;
- definir periodo de prueba;
- definir cambios de plan;
- definir que pasa con datos al dejar de pagar;
- definir soporte comercial;
- validar terminos con abogado/contador.

Regla:

```text
No cobrar por una promesa que todavia depende de operacion manual inestable.
```

---

## 18. Menores De Edad

V1 debe evitar dirigirse a menores.

Reglas:

- no hacer marketing a menores;
- no posicionar Manzana como producto escolar para menores;
- usar elegibilidad 18+ mientras no exista revision legal especifica;
- si se decide soportar menores, crear documento legal/producto separado.

Razon:

```text
Manzana maneja datos financieros y conversaciones sensibles.
El tratamiento de menores requiere reglas especificas.
```

---

## 19. Proveedores Y Subencargados

Manzana debe mantener lista actualizada de proveedores que pueden procesar datos.

### 19.1 Lista V1 Esperada

| Proveedor/capa | Uso | Riesgo |
|---|---|---|
| Kapso / WhatsApp Business Platform | Mensajeria WhatsApp | Canal externo, webhooks, envio y politicas de WhatsApp/Meta. |
| Meta WhatsApp Cloud API directo | Escape tecnico futuro | Solo si se reabre decision de proveedor detras del adapter. |
| Google Gmail API/PubSub | Email parsing si usuario conecta Gmail | Scopes restringidos y Limited Use. |
| Supabase/PostgreSQL/Auth | DB, auth, RLS, storage | Datos financieros y cuenta. |
| Vercel o hosting | App, API, webhooks | Logs y hosting. |
| OpenAI/API o Codex runtime | Agentes/IA | Datos enviados a runtime segun tarea. |
| Workers/Trigger equivalente | Jobs, retries, outbox | Procesamiento asincrono. |
| Observabilidad | Errores/producto/traces | Riesgo de logs sensibles. |
| Pagos futuro | Cobro si aplica | Datos comerciales y pagos. |

### 19.2 Reglas

- revisar terminos/DPA cuando aplique;
- documentar ubicacion o transferencia internacional si corresponde;
- no enviar mas datos de los necesarios;
- redaccion de logs;
- acceso por roles;
- revisiones periodicas;
- actualizar politica de privacidad si cambia proveedor relevante.

---

## 20. Cambios De Producto Que Requieren Revision Legal

Requieren revision antes de lanzar:

- integracion bancaria directa;
- open banking/aggregators;
- credito;
- inversiones;
- recomendaciones financieras personalizadas;
- scoring;
- venta de datos;
- publicidad basada en datos financieros;
- menores de edad;
- multi-pais fuera de Peru;
- sharing de deudas con terceros;
- cobro/recordatorio enviado a otra persona;
- uso de datos para entrenar modelos propios;
- procesamiento amplio de emails;
- WhatsApp marketing templates;
- automatizacion financiera sin confirmacion.

---

## 21. Matriz De Riesgo Legal Operativo

| Riesgo | Probabilidad V1 | Impacto | Control |
|---|---|---|---|
| Usuario cree que Manzana da asesoria financiera | Media | Alto | Disclaimer, copy, ResponseAgent rules. |
| Gmail se percibe invasivo | Alta | Alto | Consentimiento contextual y scopes minimos. |
| WhatsApp expone datos en preview | Media | Alto | Modo discreto y proactivos seguros. |
| Email auto-registra por error | Baja si se respeta arquitectura | Alto | Pending Inbox + Core confirmation gate. |
| Soporte ve datos de mas | Media | Alto | RBAC, audit log, minimo acceso. |
| Logs guardan datos sensibles | Media | Alto | Redaccion, retencion corta, no raw prompts. |
| Marketing promete ahorro garantizado | Media | Medio/alto | Copy guardrails. |
| Usuario menor entra | Media | Medio/alto | 18+, no targeting a menores. |
| Proveedor cambia terminos | Media | Medio/alto | Revision trimestral. |
| Incidente sin proceso | Media | Alto | Incident response plan. |

---

## 22. Textos Base Para Producto

### 22.1 Aviso De Lanzamiento V1

```text
Manzana V1 organiza informacion financiera personal para darte claridad.
Puede cometer errores al interpretar mensajes, pero puedes corregirlos.
Usa Manzana para ordenar tu dinero, no como reemplazo de asesoria financiera.
```

### 22.2 Aviso De No Asesoria

```text
Manzana organiza y explica informacion financiera personal.
No es asesor financiero, banco ni entidad de credito.
```

### 22.3 Aviso Gmail

```text
Si conectas Gmail, Manzana buscara correos financieros compatibles para crear pendientes.
Nada se registra como movimiento hasta que tu lo confirmes.
```

### 22.4 Aviso WhatsApp

```text
Usaremos WhatsApp para responderte, confirmar movimientos y enviarte recordatorios si los aceptas.
Puedes pausar mensajes cuando quieras.
```

### 22.5 Aviso De Modo Discreto

```text
Modo discreto oculta detalles sensibles en mensajes proactivos.
Tu telefono igual puede mostrar previews de WhatsApp segun su configuracion.
```

### 22.6 Aviso De Borrado

```text
Puedes pedir que eliminemos tu cuenta y datos asociados.
Algunos registros tecnicos o legales pueden conservarse por el tiempo necesario y de forma minimizada.
```

---

## 23. Checklists

### 23.1 Antes De Lanzamiento V1

- [ ] Aviso de lanzamiento V1 escrito.
- [ ] Politica de privacidad V1 escrita.
- [ ] Terminos V1 escritos.
- [ ] Disclaimer financiero visible.
- [ ] Consentimiento WhatsApp implementado.
- [ ] Opt-out/pausa implementado.
- [ ] Proceso manual de exportacion/borrado.
- [ ] Soporte definido.
- [ ] Incident log creado.
- [ ] Lista de proveedores documentada.
- [ ] No se promete Gmail si no esta listo.
- [ ] No se prometen integraciones bancarias.
- [ ] No se usan datos reales en marketing.

### 23.2 Antes De Gmail Publico

- [ ] Scopes minimos definidos.
- [ ] Disclosure Gmail claro.
- [ ] Disconnect Gmail implementado.
- [ ] Borrado de tokens implementado.
- [ ] No guardar cuerpo completo por defecto.
- [ ] Pending confirmation obligatorio.
- [ ] Google OAuth verification evaluado.
- [ ] Limited Use revisado.
- [ ] Politica de privacidad actualizada.
- [ ] Security assessment si aplica.

### 23.3 Antes De WhatsApp Proactivo

- [ ] Opt-in registrado.
- [ ] Opt-out funcionando.
- [ ] Modo discreto aplicable.
- [ ] Horario silencioso.
- [ ] Nudge Policy activa.
- [ ] Templates revisados.
- [ ] No marketing templates sin decision separada.
- [ ] No detalles sensibles fuera de contexto.
- [ ] Comandos de pausa/cancelacion probados.

### 23.4 Antes De Cobro V1

- [ ] Terminos de pago.
- [ ] Politica de reembolso.
- [ ] Cancelacion.
- [ ] Facturacion/impuestos revisados.
- [ ] Soporte comercial.
- [ ] Planes y limites claros.
- [ ] No prometer ilimitado si unit economics no lo soporta.
- [ ] Legal/contador revisan.

### 23.5 Antes De Lanzamiento Publico

- [ ] Politica de privacidad revisada por abogado.
- [ ] Terminos revisados por abogado.
- [ ] Procesos ARCO validados.
- [ ] Banco de datos/obligaciones ANPD revisadas.
- [ ] Proveedores y transferencias internacionales revisados.
- [ ] Incident response probado.
- [ ] Soporte y escalamiento operativos.
- [ ] Seguridad revisada.
- [ ] Google/Meta compliance revisado.
- [ ] Copy publico auditado.

---

## 24. Fuentes Oficiales A Revisar

Estas fuentes deben revalidarse antes de lanzamiento publico y escala:

| Tema | Fuente |
|---|---|
| Ley N. 29733 | `https://www.gob.pe/institucion/congreso-de-la-republica/normas-legales/243470-29733` |
| Autoridad Nacional de Proteccion de Datos Personales | `https://www.gob.pe/anpd` |
| Nuevo Reglamento LPDP / DS 016-2024-JUS | `https://www.gob.pe/institucion/anpd/campa%C3%B1as/128319-nuevo-reglamento-de-proteccion-de-datos-personales` |
| Google API Services User Data Policy | `https://developers.google.com/terms/api-services-user-data-policy` |
| OAuth app verification | `https://support.google.com/cloud/answer/13463073` |
| Gmail API usage limits | `https://developers.google.com/workspace/gmail/api/reference/quota` |
| WhatsApp Business Terms | `https://www.whatsapp.com/legal/business-terms` |
| WhatsApp Business Messaging Policy | `https://business.whatsapp.com/policy` |
| WhatsApp Platform Pricing | `https://whatsappbusiness.com/products/platform-pricing/` |
| OpenAI API pricing/data docs | `https://openai.com/api/pricing/` |

---

## 25. Criterios De Aceptacion

Este documento queda aceptado si:

- no se presenta como asesoria legal;
- define que necesita Manzana antes de lanzamiento V1, cobro y escala;
- mantiene privacidad como experiencia, no solo compliance;
- define politica de privacidad, terminos, disclaimers, soporte e incidentes;
- mantiene no asesoria financiera;
- mantiene email con confirmacion obligatoria;
- mantiene WhatsApp oficial y opt-in/opt-out;
- mantiene Gmail por OAuth oficial;
- define procesos ARCO, exportacion, borrado y desconexion;
- define soporte humano con acceso minimo;
- define incident response;
- define marketing legalmente prudente;
- define cambios que requieren revision legal;
- deja claro que abogado debe revisar antes de publico/pago.

---

## 26. Resumen Operativo

Manzana debe sonar humana, pero operar con seriedad.

Legal no debe matar la experiencia. Debe protegerla.

La regla final:

```text
No prometer mas de lo que Manzana puede cumplir.
No ocultar riesgos que el usuario tiene derecho a entender.
No convertir confianza en letra chica.
```

*Fase 5 Proteccion - Documento 27 - V1.3*
