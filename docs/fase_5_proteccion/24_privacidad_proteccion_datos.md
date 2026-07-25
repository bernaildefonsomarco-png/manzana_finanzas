# 24 - Privacidad Y Proteccion De Datos V1

**Estado:** V1.2 - Contrato de privacidad actualizado con Kapso WhatsApp V1  
**Ultima actualizacion:** 13 de junio, 2026  
**Depende de:** `05a_whatsapp.md`, `05b_motor_ia.md`, `05d_email_parsing.md`, `05g_insights.md`, `05j_nudges.md`, Fase 3 Producto, Fase 4 Tecnica  

---

## 1. Tesis

Manzana no puede tratar la privacidad como un texto legal al final del producto.

Manzana maneja informacion intima: dinero, deudas, habitos, personas, emails financieros, conversaciones y patrones de vida. Por eso privacidad debe ser parte de la experiencia.

La tesis:

```text
Mas privacidad no debe significar menos inteligencia.
Debe significar inteligencia mas controlada, mas clara y mas confiable.
```

El usuario no debe sentir:

- "me piden permisos para espiarme",
- "si activo privacidad, la app se vuelve tonta",
- "no entiendo que guardan",
- "me van a juzgar o vender algo con mi informacion".

Debe sentir:

- "se por que Manzana necesita esto",
- "puedo apagarlo",
- "puedo corregirlo",
- "puedo borrar/exportar",
- "Manzana me ayuda sin exponerme".

---

## 2. No Es Asesoria Legal

Este documento define criterio de producto y arquitectura.

Antes de lanzamiento publico se debe revisar con asesoria legal local:

- Ley N. 29733, Ley de Proteccion de Datos Personales;
- Reglamento vigente de la LPDP;
- obligaciones de banco de datos personales;
- politica de privacidad publica;
- terminos de uso;
- consentimiento informado;
- derechos ARCO;
- transferencia internacional/subencargados;
- obligaciones especificas de Google Workspace/Gmail y Meta/WhatsApp.

---

## 3. Principios No Negociables

| Principio | Regla |
|---|---|
| Calidad con proteccion | La privacidad no se usa como excusa para quitar valor; se disena una forma segura de darlo. |
| Minimo necesario | Pedir y guardar solo lo necesario para la funcion activa. |
| Consentimiento contextual | Pedir permisos cuando el usuario entiende el beneficio. |
| Control del usuario | Exportar, borrar, desconectar y cambiar preferencias debe ser posible. |
| Transparencia sin tecnicismo | Explicar que se usa y para que, en lenguaje humano. |
| Separacion pending/movement | Lo detectado no confirmado no afecta saldos. |
| Sin venta de datos | No vender, alquilar ni compartir datos financieros para publicidad, scoring o data brokers. |
| IA controlada | Agentes no tienen acceso libre a DB; consultan por `ToolGateway`. |
| Logs minimizados | No guardar prompts completos, payloads crudos o cuerpos de email salvo necesidad clara y retencion corta. |
| Modo discreto transversal | Aplica en WhatsApp, Dashboard, notificaciones, nudges, insights y previews. |

---

## 4. Calidad Que No Debe Bajar

Privacidad mal aplicada puede romper Manzana:

- si no recuerda nada, deja de sentirse inteligente;
- si pide permiso a cada paso, aumenta friccion;
- si oculta demasiado, deja de ser util;
- si muestra demasiado, pierde confianza.

La estrategia correcta es privacidad por capas:

```text
Datos completos protegidos en Core/Supabase
  -> Context Packs minimos por tarea
  -> ToolGateway con scopes
  -> Respuestas visibles filtradas por PolicyGate
  -> Modo discreto cuando el contexto lo exige
```

Esto permite mantener calidad sin exponer todo.

Ejemplo:

```text
Usuario: "Puedo gastar S/50 hoy?"

Manzana no necesita enviar todo su historial al agente.
Necesita un resumen: saldos, compromisos, deudas proximas, recurrentes y dinero libre.
```

---

## 5. Clasificacion De Datos

| Nivel | Ejemplos | Uso permitido | Regla |
|---|---|---|---|
| Publico | textos de marketing, docs publicos | Mostrar sin restriccion | No contiene datos de usuario. |
| Cuenta | nombre, telefono, email, timezone | Auth, soporte, personalizacion basica | RLS y acceso minimo. |
| Financiero | movimientos, montos, categorias, cuentas, cajas | Core, dashboard, insights, consultas | Cifrado en transito, RLS, auditabilidad. |
| Sensible contextual | deudas, salud, apuestas, personas, comercios delicados | Solo si aporta valor claro | Modo discreto y RiskPolicy. |
| Canal | WhatsApp IDs, delivery status, Gmail message IDs | Webhooks, dedup, trazas | No usar como perfil comercial externo. |
| Email derivado | monto, comercio, fecha, sender, snippet necesario | Crear pendiente y dedup | No guardar cuerpo completo por defecto. |
| IA/trazas | agent traces, confidence, tool calls, errores | Debug, evaluacion, calidad | Redactar y minimizar. |
| Secretos | refresh tokens, API keys, webhook secrets | Integracion tecnica | Cifrado fuerte, nunca logs. |

---

## 6. Datos Que Manzana Guarda

### Usuario Y Preferencias

- `user_id`,
- nombre visible si el usuario lo da,
- telefono WhatsApp,
- email/login,
- timezone,
- idioma,
- modo discreto,
- opt-ins de nudges/email/WhatsApp,
- preferencias de horario.

Uso:

- autenticar,
- personalizar sin exagerar,
- respetar privacidad y horarios.

### Finanzas Confirmadas

- movimientos confirmados,
- cuentas,
- cajas,
- categorias/subcategorias/tags,
- deudas,
- recurrentes,
- pagos,
- ajustes,
- audit log.

Uso:

- saldos,
- dinero libre,
- historial,
- insights,
- consultas.

### Pendientes

- detecciones de email,
- candidatos recurrentes,
- ambiguedades,
- risk confirmations,
- payload normalizado,
- estado de confirmacion.

Regla:

```text
Pendiente no es movimiento.
Pendiente no afecta saldo.
```

### Conversacion

Guardar lo minimo necesario para continuidad:

- thread/conversation id,
- estado conversacional,
- ultima intencion,
- referencias a movimientos/pending items,
- mensajes normalizados o resumidos cuando haga falta.

No guardar por defecto:

- chain-of-thought,
- razonamiento interno,
- prompts completos con datos sensibles,
- audios/imagenes crudas sin politica especifica.

---

## 7. Datos Que Manzana No Debe Guardar En V1

| Dato | Regla |
|---|---|
| CVV | Nunca pedir ni almacenar. |
| Passwords bancarios | Nunca pedir ni almacenar. |
| Passwords de email | Nunca pedir ni almacenar. |
| App passwords | No usar. |
| Cuerpo completo de emails | No guardar por defecto. |
| Payloads crudos permanentes | No guardar. Usar `payload_ref` solo cifrado y con retencion corta si hace falta. |
| Chain-of-thought | No guardar ni mostrar. |
| Datos para scoring crediticio | No usar. |
| Datos para publicidad/retargeting | No usar. |
| Datos de contactos completos | No guardar salvo feature futura con consentimiento explicito. |

---

## 8. Consentimiento Y Permisos

### 8.1 Regla General

Pedir consentimiento cuando el usuario entiende el beneficio.

No pedir todos los permisos en onboarding.

### 8.2 Consentimientos V1

| Consentimiento | Momento correcto | Copy de producto |
|---|---|---|
| WhatsApp conversacional | Al iniciar conversacion | "Te puedo ayudar por WhatsApp a registrar, corregir y consultar tu dinero." |
| Nudges | Cuando haya valor claro | "Quieres que te avise solo cuando haya algo util?" |
| Modo discreto | Onboarding ligero + settings | "Oculto detalles sensibles cuando Manzana te escriba primero." |
| Gmail/email parsing | Cuando el usuario quiera deteccion automatica | "Conecta Gmail para detectar avisos financieros de instituciones compatibles. Un agente de IA puede extraer campos del aviso de forma transitoria, pero no decide ni registra nada. Siempre confirmas antes de afectar tus saldos." |
| Insights por WhatsApp | Primer insight o settings | "Puedo mandarte descubrimientos utiles por WhatsApp si lo permites." |

### 8.3 Permisos Granulares

El usuario debe poder activar/desactivar:

- email parsing,
- nudges,
- insights por WhatsApp,
- recordatorios de deudas,
- recordatorios de recurrentes,
- modo discreto,
- resumen semanal,
- horario silencioso.

---

## 9. Gmail Y Email Parsing

### Decision V1

Gmail V1 usa OAuth/API oficial.

Prohibido:

- pedir password,
- pedir app password,
- scraping,
- browser automation,
- IMAP en V1,
- forwarding en V1,
- leer/usar emails no financieros como producto.

### Scope

`gmail.readonly` puede ser necesario si el parser necesita leer cuerpo/snippet de emails financieros.

Regla de comunicacion:

```text
No decir: "nunca tenemos acceso tecnico a tu inbox".
Si el scope lo permite, eso seria impreciso.

Decir: "Manzana solo procesa y guarda emails financieros detectados
de bancos/apps compatibles. No guarda emails personales, de trabajo
ni newsletters."
```

### Limited Use

Los datos recibidos desde Gmail:

- se usan solo para funciones visibles al usuario,
- no se venden,
- no se usan para publicidad,
- no se usan para scoring crediticio,
- no se usan para entrenar modelos generales,
- no se transfieren salvo proveedores necesarios para operar la funcion y con politica clara.

Cuando `EmailExtractionAgent` usa un proveedor de IA:

- solo recibe el asunto, cuerpo del aviso financiero ya filtrado por remitente
  exacto, DKIM/DMARC alineados y contexto minimo de institucion/template;
- requiere consentimiento separado y versionado; sin el, no se descarga el
  cuerpo para el agente;
- el contenido se usa transitoriamente para Structured Output y no se persiste
  en Manzana ni en las trazas del agente; las llamadas Responses API deben usar
  `store:false`;
- el proveedor debe estar identificado en el disclosure/consentimiento vigente,
  sujeto a contrato y configurado sin entrenamiento general con estos datos;
- OpenAI API no usa inputs/outputs para entrenamiento por defecto. Sin Zero Data
  Retention, puede conservar contenido en logs de abuso hasta 30 dias; el
  producto debe informarlo y no afirmar retencion cero si no esta verificada;
- si el agente falla, alucina o no puede citar evidencia literal, su resultado
  se descarta y el flujo degrada al parser deterministico o a revision;
- ningun resultado del agente autoriza por si mismo una escritura financiera.

### Retencion Email

| Dato | Retencion V1 |
|---|---|
| OAuth refresh token | Mientras email este conectado; borrar al desconectar. |
| Gmail message id/history id | Mientras sea necesario para dedup/auditoria. |
| Campos financieros extraidos | Mientras el pendiente/movimiento exista. |
| Cuerpo completo del email | No guardar por defecto. |
| Snippet temporal | Solo en memoria o retencion corta si debug autorizado lo requiere. |

---

## 10. WhatsApp

### Decision V1

WhatsApp V1 usa Kapso via `WhatsAppAdapter` como proveedor oficial operativo sobre WhatsApp Business Platform.

Meta WhatsApp Cloud API directo queda como escape tecnico futuro detras del mismo adapter, no como ruta principal actual.

Prohibido:

- Twilio/360dialog/WATI/Zoko/respond.io en V1,
- Evolution API,
- APIs no oficiales,
- sesiones QR,
- WhatsApp Web automation,
- scraping.

### Datos De WhatsApp

Guardar:

- phone number id,
- wa id/telefono normalizado,
- provider message id,
- timestamps,
- delivery status,
- idempotency key,
- contenido normalizado necesario para conversacion.

Minimizar:

- payloads crudos,
- previews sensibles,
- logs con contenido financiero.

### Ventana 24h Sin Bajar Calidad

La estrategia de ventana no debe perseguir al usuario.

Regla:

```text
Usar WhatsApp cuando abre claridad.
No usar WhatsApp para insistir sin respuesta.
```

Si hay varios pendientes y el usuario no responde:

- agrupar,
- enviar link/Flow al Centro de Confirmaciones si corresponde,
- guardar en Dashboard/app,
- no mandar un mensaje por cada email detectado.

---

## 11. IA, Agentes Y ToolGateway

### Regla

Los agentes no acceden libremente a la base de datos.

Flujo:

```text
Agent -> ToolGateway -> consulta autorizada -> resultado limitado
```

### Context Packs

Cada agente recibe solo lo necesario:

| Agente | Datos permitidos |
|---|---|
| EmailExtractionAgent | Remitente ya verificado, asunto y cuerpo del aviso financiero en memoria, institucion/template y fecha de recepcion. Sin DB, tools ni historial del usuario. |
| DataAgent | categorias, cuentas relevantes, ultimas correcciones, preferencias necesarias. |
| ConversationAgent | resumen financiero, tools read-only, estado conversacional. |
| CorrectionAgent | movimiento/pending objetivo, historial cercano, patron de correccion. |
| ResponseAgent | resultado aprobado, tono, modo discreto, canal. |
| InsightExperienceAgent | insight candidato, sensibilidad, canal, contexto emocional. |

### Prohibido

- guardar chain-of-thought,
- exponer razonamiento interno,
- dar SQL libre al agente,
- usar datos de todos los usuarios para entrenar modelos generales,
- enviar datos innecesarios a un modelo.

### Calidad Conservada

La IA puede seguir siendo inteligente si consulta bien.

Ejemplo:

```text
Pregunta historica:
"Que gastos hice el ultimo viernes de hace 4 meses?"

No se carga todo el historial.
ConversationAgent usa ToolGateway con rango de fechas y filtros.
```

---

## 12. Modo Discreto

Modo discreto no es "ocultar todo".

Es una politica de salida:

| Contexto | Sin modo discreto | Con modo discreto |
|---|---|---|
| WhatsApp proactivo | "Tu cuota de tarjeta S/180 vence mañana." | "Tienes un compromiso por revisar mañana." |
| Insight sensible | "Casino subio esta semana." | "Hay un gasto sensible que cambio esta semana." |
| Dashboard autenticado | Puede mostrar montos. | Montos ocultos/blur hasta revelar. |
| Notificacion/push | Sin detalles sensibles. | Siempre generica. |
| Email pendiente | Puede mostrar comercio si no sensible. | Mostrar resumen neutro. |

Regla:

- Dentro de una sesion autenticada, el usuario puede revelar.
- En mensajes proactivos, previews y notificaciones, priorizar discrecion.
- Si una respuesta pierde utilidad por ocultar demasiado, ofrecer accion segura: "Quieres verlo en el Dashboard?"

---

## 13. Retencion De Datos

Retencion V1 sugerida:

| Dato | Retencion |
|---|---|
| Movimientos confirmados | Hasta que el usuario elimine cuenta/datos o borre movimiento. |
| Audit log financiero | Mantener para trazabilidad mientras la cuenta exista; evaluar retencion legal antes de produccion publica. |
| Pendientes descartados | Metadata minima para dedup/aprendizaje; borrar payload sensible. |
| Agent traces | 30-90 dias, redacted, segun necesidad de calidad. |
| External payloads crudos | No por defecto; si `payload_ref`, retencion corta y cifrada. |
| Gmail tokens | Hasta desconexion. |
| WhatsApp delivery logs | 30-180 dias segun necesidad operativa y costos. |
| Learning signals | Mientras aporten calidad y el usuario no borre datos. |

Regla:

```text
Retener lo suficiente para calidad, correccion y auditoria.
No retener por curiosidad.
```

---

## 14. Derechos Del Usuario

V1 debe preparar:

- exportar datos,
- borrar cuenta,
- desconectar Gmail,
- desactivar nudges,
- desactivar insights por WhatsApp,
- activar/desactivar modo discreto,
- pedir revision/correccion,
- consultar que datos se usan para un insight.

### Exportacion

Formato minimo:

- CSV/JSON de movimientos,
- cuentas/cajas,
- deudas,
- recurrentes,
- categorias/tags custom,
- pendientes activos,
- preferencias.

### Eliminacion

Debe definir:

- borrar/anonymizar datos personales,
- borrar tokens,
- cancelar watchers Gmail,
- dejar auditabilidad tecnica minima si es legalmente necesario,
- borrar payloads temporales,
- detener nudges.

---

## 15. Soporte Humano

Soporte humano debe tener acceso minimo.

Por defecto:

- ver estado tecnico,
- errores,
- timestamps,
- ids,
- estado de conexion,
- no ver montos ni contenido sensible completo.

Solo con permiso explicito del usuario o incidente justificado:

- ver detalle necesario,
- dejar audit log de acceso,
- limitar tiempo,
- registrar motivo.

Copy sugerido:

```text
Puedo revisar este caso con mas detalle si me das permiso.
Solo se vera la informacion necesaria para resolverlo.
```

---

## 16. Seguridad Tecnica Minima

Requisitos V1:

- HTTPS en todo canal.
- RLS en Supabase.
- Service role solo backend controlado.
- Tokens cifrados en reposo.
- Secrets fuera del repo.
- Webhooks verificados.
- Idempotency keys.
- Logs sin secretos.
- Backups con acceso restringido.
- Principio de menor privilegio.
- Ambientes separados: local/staging/produccion.
- Tests de RLS.
- Tests de no-registro automatico desde email.

---

## 17. Incidentes

Incidente puede ser:

- acceso no autorizado,
- envio proactivo con dato sensible,
- Gmail token expuesto,
- webhook spoofing,
- bug que muestra datos de otro usuario,
- agente responde con informacion que no debia,
- logging accidental de payload sensible.

Respuesta minima:

1. Contener.
2. Revocar tokens/secrets si aplica.
3. Identificar usuarios afectados.
4. Corregir bug.
5. Auditar logs.
6. Comunicar con claridad si corresponde.
7. Crear postmortem interno.

Tono:

```text
Claro, directo, sin esconder, sin culpar al usuario.
```

---

## 18. UX De Privacidad

Privacidad debe aparecer en momentos naturales:

| Momento | UX correcta |
|---|---|
| Onboarding | Explicar lo minimo; no abrumar. |
| Conectar Gmail | Explicar beneficio, scope y confirmacion obligatoria. |
| Primer nudge | Pedir permiso y mostrar control. |
| Insight sensible | Dar opcion de ver detalle seguro. |
| Settings | Centro claro de privacidad y datos. |
| Desconexion | Confirmar consecuencias sin asustar. |

Antipatrones:

- textos legales enormes antes del primer valor,
- permisos todos juntos,
- "acepta todo o no funciona",
- ocultar demasiado y volver inutil la app,
- usar miedo para activar features,
- prometer privacidad absoluta que tecnicamente no existe.

---

## 19. Checklist Antes De Lanzamiento V1

- [ ] Politica de privacidad publica redactada.
- [ ] Disclosure Gmail claro.
- [ ] Limited Use statement incluido.
- [ ] OAuth consent screen alineado.
- [ ] RLS probado.
- [ ] Exportacion basica definida.
- [ ] Eliminacion/desconexion definida.
- [ ] Modo discreto implementado en mensajes proactivos.
- [ ] Logs redacted.
- [ ] No guardar chain-of-thought.
- [ ] No guardar cuerpo completo de email por defecto.
- [ ] Webhooks verificados.
- [ ] Tokens cifrados.
- [ ] Soporte humano con acceso minimo.
- [ ] Incidentes tienen runbook.

---

## 20. Escenarios De Prueba

1. Usuario conecta Gmail y entiende que nada se registra sin confirmar.
2. Usuario desconecta Gmail y se borran tokens.
3. Email de Yape crea pendiente, no movimiento.
4. Usuario activa modo discreto y recibe nudge sin monto ni comercio sensible.
5. Usuario pregunta por gastos antiguos y el agente usa ToolGateway.
6. Soporte intenta ver detalle financiero sin permiso y el sistema lo bloquea.
7. Log de error no contiene token, cuerpo de email ni numero completo.
8. Usuario borra cuenta y se detienen nudges/watchers.
9. Insight sensible se guarda en Dashboard pero no se envia por WhatsApp.
10. Payload externo con `payload_ref` expira segun retencion corta.

---

## 21. Fuentes Normativas Y Politicas A Revalidar

Estas fuentes deben revisarse antes de produccion publica porque pueden cambiar:

- Ley N. 29733, Ley de Proteccion de Datos Personales: `https://www.gob.pe/institucion/congreso-de-la-republica/normas-legales/243470-29733`.
- Nuevo Reglamento LPDP / DS 016-2024-JUS: `https://www.gob.pe/institucion/anpd/campa%C3%B1as/128319-nuevo-reglamento-de-proteccion-de-datos-personales`.
- Google API Services User Data Policy: `https://developers.google.com/terms/api-services-user-data-policy`.
- Google Workspace API Services User Data and Developer Policy: `https://developers.google.com/workspace/workspace-api-user-data-developer-policy`.
- Meta WhatsApp Business Platform / Cloud API docs: `https://developers.facebook.com/docs/whatsapp/cloud-api/get-started`.
- Kapso WhatsApp API/webhooks: `https://docs.kapso.ai/docs/whatsapp/send-messages/text`.

---

## 22. Resumen

Manzana no debe elegir entre calidad y privacidad.

Debe construir una experiencia donde la privacidad haga que la inteligencia se sienta mas segura:

```text
Menos datos donde no hacen falta.
Mas contexto donde si ayuda.
Mas control para el usuario.
Mas claridad en cada permiso.
Mas cuidado en cada salida proactiva.
```

*Fase 5 Proteccion - Documento 24 - V1.1*
