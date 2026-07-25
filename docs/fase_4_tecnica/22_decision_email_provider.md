# 22 - Decision Email Provider V1

**Estado:** V1.2 - Gmail first auditado con privacidad fuerte y copy preciso  
**Ultima actualizacion:** 30 de mayo, 2026  
**Depende de:** `05d_email_parsing.md`, `06_arquitectura_sistema.md`, `15_stack_tecnologico.md`, `16_modelo_datos.md`, `17_eventos_workers.md`, `18_api_spec.md`, `20_decisiones_tecnicas.md`  

---

## 1. Decision Ejecutiva

Manzana V1 usara **Gmail API + Google Cloud Pub/Sub** como primer proveedor de email parsing, siempre detras de `EmailAdapter`.

La decision no es "leer el inbox del usuario". La decision es:

```text
Gmail oficial
  -> OAuth explicito
  -> permisos minimos operativos
  -> deteccion de emails financieros conocidos
  -> extraccion minima
  -> Pending Inbox
  -> confirmacion del usuario
  -> Core solo si confirma
```

Reglas firmes:

- Gmail es el proveedor inicial V1.
- Outlook/Microsoft Graph queda como proveedor futuro via adapter.
- IMAP generico queda fuera de V1 salvo decision posterior.
- No se piden contrasenas de email.
- No se usa scraping, browser automation ni APIs no oficiales.
- No se registra ningun movimiento desde email sin aprobacion del usuario.
- No se almacena el cuerpo completo del email por defecto.

---

## 2. Fuentes Oficiales Revisadas

Fuentes revisadas el 29 de mayo de 2026:

| Fuente | Implicacion para Manzana |
|---|---|
| Gmail Push Notifications: `https://developers.google.com/workspace/gmail/api/guides/push` | Gmail puede notificar cambios via Pub/Sub; el sistema debe usar `historyId`, reconocer retries y renovar el watch. |
| Gmail `users.watch`: `https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/watch` | `watch` devuelve `historyId` y `expiration`; se debe llamar otra vez antes de expirar. |
| Gmail OAuth scopes: `https://developers.google.com/workspace/gmail/api/auth/scopes` | `gmail.readonly` y `gmail.metadata` son scopes restringidos; si se almacenan/transmiten datos restringidos puede requerirse verificacion y security assessment. |
| Google API Services User Data Policy: `https://developers.google.com/terms/api-services-user-data-policy` | Hay que representar identidad, datos pedidos y proposito de forma clara; pedir solo permisos necesarios. |
| Google Workspace API User Data Policy: `https://developers.google.com/workspace/workspace-api-user-data-developer-policy` | Limited Use: usar datos solo para features visibles al usuario, no vender, no publicidad, no credit scoring, no entrenar modelos generales. |
| Gmail API Usage Limits: `https://developers.google.com/workspace/gmail/api/reference/quota` | Hay cuotas por proyecto/usuario; no asumir "gratis e ilimitado" como contrato de produccion. |

---

## 3. Por Que Gmail Primero

Gmail primero conviene porque:

- es el caso de uso mas concreto para usuarios individuales;
- permite OAuth oficial sin pedir contrasena;
- permite notificaciones push via Pub/Sub;
- encaja con `email_connections`, `last_history_id` y `watch_expiration`;
- permite construir aprendizaje de templates bancarios antes de soportar mas proveedores;
- reduce combinatoria en V1: un proveedor bien hecho es mejor que tres proveedores incompletos.

Esto no significa casarse con Gmail. Significa que `EmailAdapter` debe esconder el proveedor.

```text
EmailAdapter
  GmailProvider V1
  OutlookProvider futuro
  ForwardingProvider futuro opcional
```

---

## 4. Opciones Evaluadas

| Opcion | Estado V1 | Evaluacion |
|---|---|---|
| Gmail API + Pub/Sub | `aprobada_producto` | Default V1. Oficial, push, OAuth, buena base tecnica. |
| Gmail API polling | `fallback_tecnico` | Sirve si Pub/Sub falla o para backfill controlado; no es modo principal. |
| Microsoft Graph / Outlook | `futuro` | Buen candidato P1, pero no entra en V1 inicial para evitar multi-proveedor prematuro. |
| Email forwarding a casilla de Manzana | `pendiente_decision` | Puede reducir OAuth en futuro, pero aumenta friccion de setup y pierde control de inbox/history. |
| IMAP generico con OAuth | `fuera_v1` | Posible futuro para casos especificos, pero mas fragil y peor DX que Gmail/Graph. |
| IMAP con password/app password | `prohibido` | Mala seguridad, mala experiencia y alto riesgo reputacional. |
| Scraping/browser automation | `prohibido` | Fragil, invasivo y contrario al nivel de confianza requerido. |

---

## 5. Contrato V1

### 5.1 Proveedor

```text
provider = "gmail"
detection = "gmail_pubsub"
fallback = "gmail_history_polling"
account_limit_v1 = multiple Gmail accounts per user
institution_binding = one connected mailbox per configured institution
```

### 5.1.1 Decision de corte 2026-07-23: multi-correo por institucion

La restriccion historica de una sola cuenta queda sustituida por este contrato:

- un usuario puede conectar varias cuentas Gmail mediante OAuth oficial;
- cada banco/app configurado elige una de esas conexiones como buzon de
  notificaciones;
- bancos distintos pueden usar buzones distintos;
- el usuario puede cambiar el buzon y el remitente exacto de cada institucion;
- un mismo buzon puede servir a varias instituciones;
- una combinacion `buzon + remitente exacto` no puede apuntar a dos
  instituciones a la vez;
- cambiar el remitente no lo vuelve confiable automaticamente: si no coincide
  con un template institucional activo y verificado, la fuente vuelve a
  `shadow/pending`;
- solo una fuente activa, un remitente autenticado con DKIM/DMARC y un template
  activo/verificado pueden crear `Pending`;
- desconectar un buzon solo archiva los pendientes originados en ese buzon. Los
  demas buzones y los movimientos ya confirmados se conservan.

La IA sigue sin autoridad. `EmailExtractionAgent` extrae datos de un aviso ya
filtrado; Policy/Core conservan la decision y toda escritura requiere
confirmacion explicita del usuario.

### 5.2 Adapter

`EmailAdapter` encapsula:

- OAuth start/callback;
- almacenamiento seguro de refresh token;
- renovacion de access token;
- creacion/renovacion de Gmail watch;
- recepcion de Pub/Sub;
- consulta de Gmail History API;
- fetch minimo de mensajes necesarios;
- filtro por whitelist de remitentes financieros;
- parser por template;
- idempotencia;
- emision de `email.detected` como evento externo.

No encapsula:

- clasificacion financiera final;
- dedup cross-channel final;
- decision de confirmar por WhatsApp/app;
- escritura en Core;
- nudges;
- insights.

---

## 6. Flujo Tecnico V1

```text
Usuario conecta Gmail
  -> OAuth consent screen
  -> EmailAdapter guarda conexion y token cifrado
  -> EmailAdapter llama Gmail users.watch
  -> guarda last_history_id y watch_expiration

Nuevo email llega a Gmail
  -> Gmail publica Pub/Sub notification
  -> /api/webhooks/gmail-pubsub responde 200 rapido
  -> External Event Gateway guarda idempotency
  -> Email Ingestion Worker lee historyId
  -> Gmail History API trae cambios desde last_history_id
  -> EmailAdapter filtra sender/subject
  -> solo si es remitente financiero conocido, obtiene contenido necesario
  -> parser extrae monto/comercio/fecha/direccion
  -> Dedup Engine revisa duplicados
  -> Pending Inbox crea pendiente
  -> WhatsApp Window Strategy decide confirmacion
  -> usuario confirma
  -> Core registra movimiento
```

Regla operativa:

```text
Pub/Sub no contiene el email completo.
Pub/Sub avisa que hubo cambio.
Manzana usa historyId para buscar solo lo necesario.
```

---

## 7. OAuth, Scopes Y Compliance

### 7.1 Scope minimo operativo

Para V1, el scope practico es:

```text
https://www.googleapis.com/auth/gmail.readonly
```

Razon: para extraer monto, comercio y fecha normalmente se necesita leer el cuerpo o snippet del email financiero. `gmail.metadata` ayuda para headers/labels, pero no basta si el dato financiero esta en el cuerpo.

Reglas:

- No pedir `https://mail.google.com/`.
- No pedir `gmail.modify`.
- No pedir `gmail.send`.
- No pedir scopes de Drive, Calendar, Contacts u otros productos.
- Evaluar si algun flujo puede bajar a `gmail.metadata`, pero no prometerlo si impide parsear.

### 7.2 Verificacion

`gmail.readonly` es un scope restringido. Antes de lanzamiento publico se debe completar el proceso que corresponda:

- OAuth consent screen correcto;
- privacy policy publica;
- disclosure claro dentro de producto;
- Limited Use statement;
- storage seguro;
- posible security assessment si Google lo exige por almacenamiento/transmision de restricted-scope data.

Esto no bloquea prototipos o QA interno, pero si debe estar en el plan antes de produccion abierta.

### 7.3 Consentimiento visible

El usuario debe entender:

- que Manzana solo usa Gmail para detectar emails financieros;
- que no registra nada sin confirmacion;
- que no lee emails para publicidad;
- que no vende datos;
- que no usa emails para credit scoring;
- que no entrena modelos generales con sus emails;
- que puede desconectar Gmail cuando quiera.

---

## 8. Privacidad Y Minimizacion De Datos

### 8.1 Que se puede guardar

Guardar:

- provider;
- email address;
- scopes aprobados;
- refresh token cifrado;
- watch expiration;
- last history id;
- provider message id;
- provider thread id;
- sender si es whitelisted;
- subject hash;
- extracted fields;
- parse status;
- content hash para dedup;
- trazas tecnicas sin contenido sensible.

### 8.2 Que no se guarda por defecto

No guardar:

- cuerpo completo del email;
- HTML completo;
- attachments;
- imagenes;
- inbox completo;
- emails no financieros;
- tokens en logs;
- montos/comercios en logs tecnicos no protegidos;
- contenido para entrenar modelos generales.

### 8.3 Procesamiento de contenido

El contenido del email se procesa en memoria solo cuando:

1. el mensaje viene de remitente financiero permitido, o
2. el subject/header coincide con un template financiero permitido.

Regla de comunicacion:

- No prometer que el permiso tecnico impide acceder a todo el inbox si se usa `gmail.readonly`.
- Si se comunica al usuario, decir: "Manzana solo procesa y guarda emails financieros detectados de bancos/apps compatibles; no guarda emails personales, de trabajo ni newsletters."

Si no coincide, se descarta sin fetch profundo cuando sea tecnicamente posible.

---

## 9. Gmail Watch Y Pub/Sub

### 9.1 Watch

Al conectar:

```text
users.watch(labelIds: ["INBOX"], topicName)
```

Guardar:

- `last_history_id`;
- `watch_expiration`;
- `last_watch_renewed_at`;
- `watch_status`.

### 9.2 Renovacion

Gmail exige renovar el watch antes de que expire. La guia oficial indica renovarlo al menos cada 7 dias y recomienda hacerlo diariamente. En V1:

```text
email_watch_renewal worker -> diario
```

Reglas:

- renovar diariamente mientras la conexion este activa;
- si falla, reintentar con backoff;
- si expira, activar polling de recuperacion;
- si token fue revocado, marcar conexion como `revoked` y avisar al usuario.

### 9.3 Pub/Sub

Webhook:

```http
POST /api/webhooks/gmail-pubsub
```

Debe:

- validar origen/token configurado;
- decodificar `message.data`;
- extraer `emailAddress` y `historyId`;
- responder 200 rapido;
- crear trabajo async;
- evitar duplicados por Pub/Sub message id + Gmail history id.

### 9.4 Fallback

Si Pub/Sub se retrasa o cae:

```text
periodic history sync
  -> usa last_history_id
  -> recupera cambios faltantes
  -> no reprocesa duplicados
```

No hacer polling completo del inbox si no es necesario.

---

## 10. Costos Y Cuotas

Email no tiene el mismo modelo de costo que WhatsApp templates, pero no es "gratis infinito".

Costos reales V1:

- Google Cloud Pub/Sub;
- ejecucion de workers;
- llamadas Gmail API bajo cuotas;
- Supabase/storage;
- invocacion de IA si el parsing requiere enrichment;
- costo de compliance/verificacion;
- costo de WhatsApp si el pendiente requiere template fuera de ventana.

Regla:

```text
Medir emails procesados, API calls, Pub/Sub events, worker time, AI calls y conversion a pendiente confirmado.
```

Metricas:

- emails recibidos de remitentes whitelisted;
- emails parseados;
- emails descartados;
- fallback generic rate;
- Gmail API quota usage;
- Pub/Sub delay;
- watch renewal failures;
- pendientes confirmados;
- pendientes archivados;
- costo por pendiente confirmado.

---

## 11. UX De Conexion

### 11.1 Entrada

Dashboard:

```text
Conectar Gmail
```

Copy base:

```text
Manzana puede revisar alertas de tus bancos en Gmail para detectar movimientos que podrias olvidar registrar.
Nada se guarda como gasto real sin que tu lo confirmes.
Solo usamos esto para tu experiencia financiera dentro de Manzana.
```

### 11.2 Despues de conectar

```text
Listo. Voy a buscar alertas financieras de los ultimos 30 dias.
Si encuentro algo, lo dejo en Pendientes para que lo revises.
```

### 11.3 Desconexion

Al desconectar:

- revocar/desactivar conexion;
- eliminar refresh token;
- detener watch;
- archivar pendientes no confirmados o dejar que el usuario decida si revisarlos antes;
- conservar movimientos ya confirmados porque son datos financieros del usuario, no datos de Gmail.

---

## 12. Backfill V1

Backfill inicial:

```text
scope = ultimos 30 dias
senders = whitelist financiera
delivery = Dashboard / Centro de Confirmaciones
WhatsApp = un resumen maximo, nunca 40 mensajes
```

Reglas:

- no hacer backfill de todo el inbox;
- no enviar confirmaciones individuales por WhatsApp para cada item historico;
- agrupar por semana/banco;
- dedup antes de mostrar;
- confirmar por lote solo con resumen visible.

---

## 13. Relacion Con WhatsApp Window Strategy

Email parsing y WhatsApp se conectan asi:

```text
Email detecta.
Pending conserva.
WhatsApp conversa cuando hay ventana o valor alto.
Centro de Confirmaciones acumula cuando el usuario no responde.
```

Reglas:

- Si la ventana de 24h esta abierta, confirmar por WhatsApp como canal principal.
- Si esta cerrada y es el primer pendiente importante, puede enviarse template utility.
- Si ya se enviaron 2 templates sin respuesta, acumular en Centro de Confirmaciones.
- Si hay varios pendientes, usar link/Flow/lote visible.
- No mandar un WhatsApp pagado por cada email nuevo si el usuario no responde.

---

## 14. Modelo De Datos Afectado

Tablas afectadas:

- `email_connections`;
- `email_institutions`;
- `user_email_sources`;
- `email_messages`;
- `pending_items`;
- `external_event_log`;
- `agent_traces`;
- `audit_log`;
- `whatsapp_window_states`.

Campos clave en `email_connections`:

```text
provider
email_address
status
scopes
encrypted_refresh_token (null si esta desconectado)
watch_expiration
last_history_id
last_watch_renewed_at
watch_status
provider_account_id
metadata
```

Campos clave en `email_messages`:

```text
provider_message_id
provider_thread_id
received_at
sender
subject_hash
content_hash
parsed_status
metadata
```

---

## 15. Estados De Conexion

```text
connected
watch_active
watch_expired
syncing
needs_reconnect
revoked
disconnected
error
```

Reglas:

- `needs_reconnect` no borra movimientos ya confirmados.
- `revoked` detiene ingestion hasta nueva autorizacion.
- `disconnected` elimina token y watch.
- errores de watch no deben crear movimientos ni borrar pendientes.

---

## 16. Escenarios De Prueba

| Escenario | Resultado esperado |
|---|---|
| Usuario conecta Gmail | Se guarda conexion, scopes, token cifrado, `last_history_id` y `watch_expiration`. |
| Llega email de Yape whitelisted | Se crea pendiente, no movimiento. |
| Llega newsletter | Se ignora sin fetch profundo ni log de contenido. |
| Pub/Sub envia duplicado | Idempotencia evita doble pendiente. |
| Watch expira | Worker renueva o marca `watch_expired` y activa recuperacion. |
| Token revocado en Google | Conexion pasa a `needs_reconnect`/`revoked`; usuario recibe aviso. |
| Usuario desconecta Gmail | Token eliminado, watch detenido, pendientes no confirmados archivados o revisables segun UX. |
| Backfill encuentra 40 emails | Dashboard muestra lote; WhatsApp no envia 40 confirmaciones. |
| Email confirma gasto de banco | Core registra solo despues de confirmacion. |
| Email parece duplicado de WhatsApp | Dedup descarta o marca probable duplicado. |

---

## 17. Criterios De Aceptacion

- Gmail API + Pub/Sub queda como proveedor V1 aprobado.
- Outlook/IMAP/forwarding quedan como futuro o pendiente, no como V1 comprometido.
- `EmailAdapter` evita acoplar el producto a Gmail.
- No se piden contrasenas ni se usa scraping.
- OAuth y Limited Use quedan reconocidos como requisito de produccion.
- `gmail.readonly` se trata como scope restringido, no como permiso trivial.
- Watch renewal diario queda definido.
- Pub/Sub no se confunde con contenido completo de email.
- Email no registra movimientos sin confirmacion.
- No se almacena cuerpo completo del email por defecto.
- Backfill va a Dashboard/Centro de Confirmaciones, no a spam por WhatsApp.
- WhatsApp Window Strategy gobierna confirmaciones de pendientes.

---

## 18. Resumen

La mejor decision para V1 no es soportar todos los correos. Es soportar **Gmail muy bien**, con confianza, privacidad y confirmacion.

```text
Un proveedor oficial.
Un adapter reemplazable.
Un scope justificado.
Un pipeline idempotente.
Una bandeja de pendientes.
Un Core que solo escribe cuando el usuario confirma.
```

*Fase 4 Tecnica - Documento 22 - V1.2*
