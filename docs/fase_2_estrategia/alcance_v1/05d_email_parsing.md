# 📧 Feature 4: Email Parsing con Confirmación

**Parte del Paso 5/20 — Alcance V1.0**  
**Prioridad:** P0  
**Última actualización:** 29 de mayo, 2026  
**Estado:** V2 — Especificación avanzada

---

## 1. Tesis

> Captura pasiva de transacciones. Cuando el usuario paga con banco/Yape/tarjeta, el banco envía un email → Manzana lo detecta **al instante** → le envía confirmación por WhatsApp. El usuario solo confirma. **Nada se registra sin su aprobación.**

Email parsing es el canal más poderoso para capturar lo que el usuario olvida registrar por WhatsApp. No reemplaza WhatsApp; lo complementa. WhatsApp es el canal donde el usuario habla activamente de su dinero. Email parsing es el canal donde el sistema escucha pasivamente lo que los bancos reportan.

La combinación es deliberada: WhatsApp captura la intención y el contexto humano ("almuerzo con colegas"). Email captura los datos exactos que el banco conoce (monto, fecha, comercio). Juntos, producen un registro financiero más completo que cualquier canal por separado.

Principios:

| # | Principio | Implicación |
|---|---|---|
| 1 | **Captura pasiva** | El usuario no hace nada para que Manzana detecte emails bancarios. |
| 2 | **Siempre confirmar** | Nada se registra automáticamente. Cada transacción pide confirmación. |
| 3 | **Complemento, no reemplazo** | WhatsApp sigue siendo la interfaz principal de registro activo. |
| 4 | **Solo emails financieros** | Solo se procesan emails financieros permitidos; no se procesan ni guardan emails personales, de trabajo ni newsletters. |
| 5 | **Contexto en la confirmación** | La confirmación es el momento donde el usuario agrega contexto que el email no tiene. |
| 6 | **Dedup inteligente** | Si el usuario ya registró algo por WhatsApp, el email duplicado se descarta silenciosamente. |
| 7 | **Datos imperfectos son válidos** | Si el parsing no encuentra todo, lo que hay alcanza para preguntar. |

---

## 2. Qué NO debe ser

> Email parsing no es un lector de emails. Es un detector de transacciones financieras con confirmación obligatoria.

- **No es registro automático.** Nada se registra sin que el usuario confirme.
- **No es un lector de emails general.** Solo procesa emails de remitentes bancarios conocidos.
- **No es un bot que spamea confirmaciones.** Hay rate limiting, batch nocturno y horario silencioso.
- **No es obligatorio.** Manzana funciona completa sin email conectado. Email es un amplificador, no un requisito.
- **No debe procesar emails personales, de trabajo o newsletters.** El permiso tecnico puede ser de solo lectura, pero Manzana filtra y procesa solo bancos/apps financieras conocidas.
- **No debe almacenar el cuerpo del email.** Solo los campos financieros extraídos.
- **No debe tomar decisiones financieras.** El Email Adapter parsea; el Motor IA clasifica; el usuario decide.

---

## 3. Relación con WhatsApp, Motor IA y Core

Email parsing no es un sistema aislado. Depende de y alimenta a los mismos sistemas que procesan registros de WhatsApp. La diferencia principal es el canal de entrada y la obligación de confirmar.

| Sistema | Rol en email parsing | Documento fuente |
|---|---|---|
| **Email Adapter** | Recibe push/webhook, filtra por remitente, parsea con templates, produce datos mínimos. | `06_arquitectura_sistema.md` Capa 5 |
| **IntakeRouter** | Normaliza la entrada de email al formato común del Orquestador. | `05b_motor_ia.md` §3.1 |
| **DataAgent** | Enriquece datos parseados: tipo, categoría, cuenta, confianza. | `05b_motor_ia.md` §5.1 |
| **Dedup Engine** | Evita duplicados cross-channel (WhatsApp ↔ Email). | `05b_motor_ia.md` §6.2 |
| **Pending Inbox** | Gestiona pendientes hasta confirmación o expiración. | `06_arquitectura_sistema.md` §Bandeja |
| **WhatsApp** | Canal de confirmación principal (individual y batch nocturno). | `05a_whatsapp.md` |
| **Dashboard** | Canal de confirmación secundario, revisión batch y backfill. | `05c_dashboard.md` |
| **Core Financiero** | Registra movimiento solo después de confirmación del usuario. | `05b_motor_ia.md` §6.1 |
| **Learning Engine** | Aprende de correcciones en confirmaciones de email. | `05b_motor_ia.md` §6.2 |
| **PolicyGate** | Aplica modo discreto, rate limiting y reglas de privacidad. | `05b_motor_ia.md` §12.4 |

```text
Flujo de sistemas:

  Gmail Push → Email Adapter → IntakeRouter → DataAgent → Dedup Engine
                                                            │
                                    ┌───────────────────────┤
                                    │                       │
                              (duplicado)             (no duplicado)
                                    │                       │
                              Descartar              Pending Inbox
                              silencioso                    │
                                                    ┌───────┴───────┐
                                                    │               │
                                               WhatsApp        Dashboard
                                               confirmar       revisar
                                                    │               │
                                                    └───────┬───────┘
                                                            │
                                                     Core Financiero
                                                     registrar mov.
                                                            │
                                                     Learning Engine
```

---

### 3.1 Decisión de implementación 2026: extracción agentic controlada

Esta decisión reemplaza las descripciones posteriores donde el template o el
Email Adapter aparecen como responsables de extraer por sí solos:

```text
Gmail Push
  -> Email Adapter: filtra remitente verificado y selecciona contexto/template
  -> EmailExtractionAgent: extrae campos + evidencia literal, sin tools ni DB
  -> Grounding determinístico por campo
  -> Enriquecimiento financiero determinístico
  -> Dedup Engine
  -> Pending Inbox
  -> confirmación humana
  -> Core especializado
```

No existe un agente hardcodeado por banco. Existe un solo
`EmailExtractionAgent`; cada institución aporta contexto versionado, aliases,
sender y patrones autorizados. El agente no decide si una operación se
registra, no resuelve IDs internos, no llama al Core y no persiste el correo.

El correo se trata como contenido no confiable: instrucciones, enlaces o
solicitudes presentes en el cuerpo nunca se ejecutan. Cada valor no nulo debe
citar una porción literal del asunto/cuerpo. Si Structured Output, campos
requeridos o grounding fallan, el resultado del agente se descarta y se usa el
fallback determinístico o revisión segura.

Los avisos rechazados, pendientes o informativos se separan antes de dedup y
Pending. Una extracción válida solo alimenta el resto del proceso ya
documentado; no equivale a una decisión financiera.

### 3.2 Contrato conversacional cuando faltan datos

La confirmación no puede reducirse a `sí/no` cuando el correo no alcanza para
resolver una cuenta, categoría o naturaleza de la operación. En esos casos,
Manzana debe conservar el hecho como Pendiente y abrir una revisión
conversacional:

1. El agente de planificación interpreta si el usuario quiere revisar,
   completar, reclasificar, confirmar o descartar.
2. Solo propone cuentas activas y categorías canónicas que realmente existen
   para ese usuario; nunca inventa IDs ni obliga a crear una cuenta llamada como
   el banco, tarjeta o billetera.
3. El usuario puede elegir sus cuentas por el nombre que ya les dio. Una
   transferencia propia necesita dos cuentas reales distintas y de la misma
   moneda; si no existen y el usuario no desea crearlas, puede descartar el
   Pendiente.
4. Si el aviso era en realidad un pago a un tercero o un depósito externo, el
   usuario puede reclasificarlo como gasto o ingreso. La cuenta es opcional en
   esos dos casos; `sin cuenta` no bloquea el registro.
5. `Descartar` significa no registrar el movimiento y no tocar saldos.
6. Completar o reclasificar solo edita la propuesta. Después se vuelve a pedir
   confirmación explícita y únicamente Core puede escribir el movimiento.
7. Una relación persistente entre una pista bancaria enmascarada y una cuenta
   del usuario se aprende solo cuando el usuario pide recordarla o establece la
   asociación de forma explícita. La selección de una cuenta para un único
   Pendiente no se convierte silenciosamente en memoria.

Regla de arquitectura:

> La IA interpreta y propone; el dominio resuelve IDs, valida pertenencia,
> moneda y consistencia; Core ejecuta solo después de confirmación.

## 4. Flujo principal

### 4.1 Flujo visual (experiencia del usuario)

```
TÚ PAGAS                    BANCO                    MANZANA
   │                          │                         │
   │  Yapeas S/45             │                         │
   │  ──────────────────────▶ │                         │
   │                          │                         │
   │                          │  Email notificación     │
   │   (llega a tu Gmail)     │  "Pagaste S/45..."     │
   │  ◀────────────────────── │                         │
   │                          │                         │
   │                          │  Gmail Push Notification│
   │                          │  (webhook instantáneo)  │
   │                          │  ───────────────────▶   │
   │                          │                         │
   │                          │  Manzana detecta email  │
   │                          │  Extrae: S/45, Yape,    │
   │                          │  Restaurante            │
   │                          │                         │
   │   ◀──────────────────────────────────────────────  │
   │   WhatsApp (instantáneo):                          │
   │   "📧 Detectamos: Yape S/45 → Restaurante          │
   │    ¿Lo registro? (sí / no / ya lo registré)"       │
   │                                                    │
   │   "sí"                                             │
   │   ─────────────────────────────────────────────▶   │
   │                                                    │
   │   "Listo ✅ Restaurante S/45 · Alimentación 🍽️"    │
```

### 4.2 Flujo técnico detallado

```text
1. Gmail Push (Pub/Sub) notifica nuevo email.
2. Email Adapter recibe webhook.
3. Email Adapter filtra por remitente (whitelist de bancos conocidos).
   → Si remitente no está en whitelist: descartar, no procesar.
4. Email Adapter selecciona template de parsing por remitente + subject.
5. Email Adapter ejecuta template: extrae amount, currency, merchant, direction, occurred_at.
   → Si template no matchea: intenta fallback genérico.
   → Si fallback tampoco extrae datos útiles: descartar con log de metadata.
6. Email Adapter emite EmailParsedEvent al IntakeRouter.
7. IntakeRouter normaliza al formato común del Orquestador.
8. DataAgent enriquece: suggested_type, suggested_category_id, suggested_subcategory_id, account, confidence.
9. Dedup Engine verifica duplicados cross-channel.
   → Si duplicado confirmado (high confidence): descartar silenciosamente.
   → Si probable duplicado (medium confidence): crear pendiente con label.
   → Si único: crear pendiente normal.
10. Pending Inbox crea el pendiente.
11. PolicyGate evalúa: rate limit, horario silencioso, modo discreto.
12. WhatsApp envía confirmación (o Dashboard si rate limit excedido).
13. Usuario confirma → Core Financiero registra movimiento.
14. Learning Engine guarda señal de confirmación.
```

Puntos clave:

1. **Detección en tiempo real** — No polling cada 30-60 min. Usamos Gmail Push Notifications (Google Cloud Pub/Sub). Cuando llega el email, Google nos avisa al instante.
2. **Siempre pide confirmación** — Nada se registra automáticamente por default. El usuario siempre decide.
3. **3 opciones de respuesta:**
   - **"sí"** → se registra como movimiento confirmado.
   - **"no"** → se descarta (no era un movimiento relevante).
   - **"ya lo registré"** → se descarta porque el usuario ya lo puso por WhatsApp (alimenta dedup).

Nota tecnica:

> Pub/Sub no trae el email completo. Trae una notificacion con `historyId`. El Email Worker usa ese `historyId` para recuperar solo los cambios necesarios desde Gmail API, filtrar remitentes financieros y parsear lo minimo.

---

## 5. Email Adapter

### 5.1 Responsabilidad

El Email Adapter es un **adaptador de canal**, no un clasificador financiero. Vive en la Capa 5 (Canales) según `06_arquitectura_sistema.md`.

Hace:

- Recibir webhooks de Gmail Pub/Sub (y otros proveedores futuros).
- Filtrar emails por remitente usando whitelist de bancos conocidos.
- Parsear emails con templates específicos por banco.
- Producir datos mínimos estructurados (`EmailParsedEvent`).
- Manejar OAuth tokens y refresh.
- Manejar fallback si push falla.

No hace:

- Clasificación financiera (tipo, categoría, subcategoría) → eso es DataAgent.
- Deduplicación → eso es Dedup Engine.
- Enviar confirmaciones → eso es el Orquestador vía WhatsApp/Dashboard.
- Almacenar el cuerpo del email.
- Leer emails que no sean de remitentes en la whitelist.

### 5.2 Filtrado de emails relevantes

El filtrado es por **whitelist de remitentes**, no por análisis de contenido. Solo los emails de remitentes conocidos de bancos/apps financieras se procesan.

```text
Email llega
  → ¿Remitente está en whitelist?
    → Sí: procesar con template
    → No: ignorar completamente (no log, no proceso)
```

Esta decisión es deliberada: filtrar por remitente es barato, determinístico y no requiere IA. Filtrar por contenido es costoso, riesgoso (falsos positivos) y puede exponer emails personales.

### 5.3 Remitentes conocidos por banco

| Banco/App | Remitentes conocidos | Nota |
|---|---|---|
| **Yape** | `notificaciones@yape.com.pe` | Pagos enviados y recibidos >S/10 |
| **BCP** | `alertas@bcp.com.pe`, `notificaciones@viabcp.com` | Movimientos de cuenta y tarjeta |
| **Interbank** | `alertas@interbank.pe`, `notificaciones@interbank.com.pe` | Movimientos y alertas |
| **BBVA** | `notificaciones@bbva.pe`, `alertabcp@bbva.pe` | Movimientos y tarjeta |
| **Plin** | `notificaciones@plin.pe` | Pagos enviados y recibidos |
| **Scotiabank** | `alertas@scotiabank.com.pe` | Movimientos |

> ⚠️ **Nota:** Los remitentes exactos deben verificarse contra emails reales antes de implementación. Los bancos pueden cambiar remitentes sin aviso. El sistema debe soportar agregar/modificar remitentes sin deploy.

### 5.4 Parsing strategy

El parsing usa **template matching** por banco. Cada banco tiene uno o más templates que definen cómo extraer datos de sus emails.

```text
Cadena de parsing:

1. Buscar template por sender + subject pattern.
   → Match: aplicar extraction_rules del template.
   → No match: paso 2.

2. Fallback genérico: regex universal para monto + comercio.
   → Extrae al menos amount: busca patrón S/\d+ o USD\d+.
   → Extrae merchant si hay algo reconocible.
   → Si al menos hay amount: emitir con confidence "low".
   → Si no hay ni amount: paso 3.

3. Descartar con log de metadata (sender, subject, timestamp).
   NO loguear contenido del email.
```

### 5.5 Fallback

Si un email de un remitente conocido no matchea ningún template (el banco cambió su formato):

- Intentar regex genérico (paso 2 arriba).
- Si no se extrae nada útil, loguear metadata para detección de formato nuevo.
- No molestar al usuario con un email incomprensible.
- La tasa de fallback se monitorea por banco (ver §19).

---

## 6. Contrato de datos

### 6.1 Output del Email Adapter (raw parsed)

Este es el evento que el Email Adapter produce después de parsear un email. Es el input para el IntakeRouter del Orquestador.

Referencia cruzada: el contrato §16.2 de `05b_motor_ia.md` define lo que el Motor IA espera recibir. Este contrato es compatible y lo extiende con metadata de parsing.

```typescript
interface EmailParsedEvent {
  user_id: string;
  channel: "email";
  email_event_id: string;               // ID único del email (Gmail message ID)
  provider: "gmail" | "outlook";        // V1 implementa gmail; outlook queda futuro
  parsed: {
    amount: number | null;
    currency: "PEN" | "USD" | null;
    merchant: string | null;
    bank_or_app: "yape" | "bcp" | "interbank" | "bbva" | "plin" | string;
    occurred_at: string | null;          // ISO 8601
    direction: "out" | "in" | "unknown";
  };
  metadata: {
    sender: string;                      // email address del remitente
    subject: string;                     // subject del email
    received_at: string;                 // ISO 8601 (cuando llegó el email)
    template_id: string | null;          // template usado para parsear
    template_version: string | null;     // versión del template
    content_hash: string;                // hash del cuerpo para dedup intra-email
  };
}
```

Regla de privacidad:

- `subject` puede existir en memoria para parsing, pero por defecto se persiste como `subject_hash`.
- El cuerpo completo del email no se guarda; solo `content_hash` y campos extraidos.
- Si se necesita conservar un fragmento para depuracion, debe ser redaccion/sanitizado y con retencion corta definida en Fase 5.

### 6.2 Output del DataAgent (enriched)

Después de que el DataAgent enriquece los datos parseados:

```typescript
interface EnrichedEmailEvent extends EmailParsedEvent {
  enriched: {
    suggested_type: MovementType;        // gasto, ingreso, transferencia, etc.
    suggested_category_id: string | null;    // categoria canonica de 05f_categorias.md
    suggested_subcategory_id: string | null; // subcategoria del usuario, si existe o se sugiere
    matched_account: string | null;      // cuenta del usuario que matchea
    confidence: "high" | "medium" | "low";
    dedup_status: "unique" | "probable_duplicate" | "confirmed_duplicate";
    dedup_match_id: string | null;       // ID del movimiento existente si hay match
  };
}
```

### 6.3 Mapeo banco → campos disponibles

No todos los bancos incluyen la misma información en sus emails. Este mapeo define qué esperar de cada uno:

| Campo | Yape | BCP Cuenta | BCP Tarjeta | Interbank | BBVA |
|---|---|---|---|---|---|
| **amount** | ✅ siempre | ✅ siempre | ✅ siempre | ✅ siempre | ✅ siempre |
| **merchant** | ✅ nombre receptor | ⚠️ a veces | ✅ comercio | ⚠️ a veces | ✅ comercio |
| **occurred_at** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **direction** | ✅ claro | ✅ claro | ✅ siempre out | ✅ claro | ✅ claro |
| **currency** | PEN siempre | PEN/USD | PEN/USD | PEN | PEN/USD |
| **account_hint** | N/A | últimos 4 dígitos | últimos 4 dígitos | últimos 4 dígitos | últimos 4 dígitos |

Leyenda: ✅ = siempre disponible, ⚠️ = a veces disponible, depende del tipo de alerta.

---

## 7. Templates de parsing

### 7.1 Estructura de un template

Cada template define cómo parsear un tipo de email de un banco específico:

```json
{
  "template_id": "yape_pago_enviado_v2",
  "bank_id": "yape",
  "version": "2",
  "active": true,
  "sender_patterns": ["notificaciones@yape.com.pe"],
  "subject_patterns": ["Yapeo exitoso", "Pago enviado", "Enviaste un pago"],
  "extraction_rules": {
    "amount": { "pattern": "S/\\s?([\\d,.]+)", "type": "number" },
    "merchant": { "pattern": "a\\s+(.+?)\\s+fue", "type": "string" },
    "occurred_at": { "pattern": "(\\d{2}/\\d{2}/\\d{4}\\s+\\d{2}:\\d{2})", "type": "datetime", "format": "DD/MM/YYYY HH:mm" },
    "direction": "out"
  },
  "created_at": "2026-05-01",
  "last_matched_at": null
}
```

### 7.2 Ejemplo: Yape pago enviado

Email de ejemplo:

```text
From: notificaciones@yape.com.pe
Subject: Yapeo exitoso

Hola Juan,

Tu pago a Restaurante El Huarique fue exitoso.

Monto: S/ 45.00
Fecha: 19/05/2026 13:45
Referencia: YAP-2026051900123

Gracias por usar Yape.
```

Datos extraídos:

```json
{
  "amount": 45.00,
  "currency": "PEN",
  "merchant": "Restaurante El Huarique",
  "direction": "out",
  "occurred_at": "2026-05-19T13:45:00-05:00"
}
```

### 7.3 Ejemplo: BCP alerta de movimiento

Email de ejemplo:

```text
From: alertas@bcp.com.pe
Subject: Alerta BCP - Movimiento en tu cuenta

Se ha realizado un cargo en tu tarjeta terminada en *4521.

Comercio: WONG MONTERRICO
Monto: S/ 180.50
Fecha: 19/05/2026 18:30

Si no reconoces este movimiento, llama al 311-9898.
```

Datos extraídos:

```json
{
  "amount": 180.50,
  "currency": "PEN",
  "merchant": "WONG MONTERRICO",
  "direction": "out",
  "occurred_at": "2026-05-19T18:30:00-05:00",
  "account_hint": "4521"
}
```

### 7.4 Mantenimiento y versionamiento

- Templates almacenados en base de datos, no hardcodeados en código.
- **Hot-reloadable:** actualizar un template no requiere deploy.
- Cada template tiene versión numérica. Cuando un banco cambia formato, se crea nueva versión; la anterior se conserva para referencia histórica.
- Campo `last_matched_at` se actualiza en cada uso exitoso. Si un template no matchea en >14 días con emails del mismo remitente, alertar internamente.
- Campo `active` permite desactivar templates sin borrarlos.

### 7.5 Agregar nuevo banco

Proceso para agregar soporte de un nuevo banco:

1. Verificar el remitente exacto y exigir `Authentication-Results` de Gmail con
   DKIM y DMARC pass alineados antes de descargar el cuerpo. Para DKIM se
   acepta la identidad firmante estándar de Gmail en `header.i` o el dominio
   en `header.d`; ambos deben alinear con el dominio de `From`.
2. Crear el contexto/template institucional en modo `shadow`.
3. Pedir consentimiento separado y versionado antes de enviar asunto/cuerpo al
   proveedor de IA.
4. Observar correos que lleguen naturalmente; no exigir una cuota manual de
   muestras para que el agente pueda extraer.
5. Revisar grounding, fallbacks, reparaciones determinísticas, falsos positivos
   y errores críticos. Un aviso
   rechazado tratado como completado bloquea activación.
6. Activar una cohorte mínima solo con métricas aceptadas y rollback listo.
7. Monitorear la primera semana y volver a shadow ante degradación.

---

## 8. Deduplicación

### 8.1 Por qué es necesaria

> El usuario escribe "gasté 15 en taxi" por WhatsApp. 10 minutos después llega el email de Yape por los mismos S/15. Sin dedup, el usuario recibiría una confirmación innecesaria por algo que ya registró. Y si confirma ambos, tendría un gasto duplicado.

La deduplicación no es un nice-to-have. Es una función crítica de calidad. Sin ella, el email parsing se convierte en una fuente de ruido y error, no de valor.

Referencia: `Dedup Engine` definido en `05b_motor_ia.md` §6.2. Este documento especifica las reglas aplicadas al canal email.

### 8.2 Dedup automático (cross-channel)

El caso más común: el usuario registra algo por WhatsApp y después llega el email del banco por la misma transacción (o viceversa).

**Caso 1: WhatsApp → Email (más frecuente)**

```text
13:00 — Usuario escribe "gasté 45 en restaurante" por WhatsApp.
         Core registra movimiento: S/45, gasto, alimentación.

13:10 — Llega email de Yape: "Pagaste S/45 a Restaurante El Huarique".
         Dedup Engine detecta match: mismo monto, ventana temporal, dirección.
         → Descartar email silenciosamente. No molestar al usuario.
```

**Caso 2: Email → WhatsApp**

```text
13:00 — Llega email de Yape: "Pagaste S/45 a Restaurante El Huarique".
         Pending Inbox crea pendiente. WhatsApp envía confirmación.

13:05 — Usuario escribe "gasté 45 en restaurante" por WhatsApp.
         Dedup Engine detecta que hay un pendiente similar.
         → Auto-resolver pendiente. Registrar solo el movimiento de WhatsApp
            (que tiene más contexto del usuario).
```

### 8.3 Dedup intra-email

Algunos bancos envían el mismo email más de una vez (duplicados de push, reintentos del servidor de correo). BCP es conocido por esto.

- Dedup por `email_event_id` (Gmail message ID): si el ID ya fue procesado, ignorar.
- Dedup por `content_hash`: si el hash del cuerpo coincide con uno procesado en las últimas 24h, ignorar.

### 8.4 Dedup con recurrentes

Si Netflix está configurado como recurrente del usuario y llega un email de BCP por "NETFLIX S/25.90":

- Dedup Engine detecta que coincide con un recurrente confirmado.
- En vez de crear pendiente nuevo: sugerir "confirmar pago recurrente de Netflix S/25.90".
- Si el monto cambió: alertar "Netflix cambió de S/25.90 a S/29.90. ¿Actualizo el recurrente?"

### 8.5 Criterios de match

| Criterio | Regla | Requerido |
|---|---|---|
| **Monto** | Exacto (no aproximado). S/45.00 = S/45.00. | ✅ Sí |
| **Ventana temporal** | ±30 minutos entre registro WhatsApp y timestamp del email. | ✅ Sí |
| **Dirección** | Misma (gasto con gasto, ingreso con ingreso). | ✅ Sí |
| **Merchant/descripción** | Similitud > 70% (fuzzy match). "restaurante" ↔ "Restaurante El Huarique". | ⚠️ Señal adicional |
| **Cuenta** | Misma cuenta si disponible en ambos lados. | ⚠️ Señal adicional |

Regla: los 3 criterios requeridos (monto + ventana temporal + dirección) deben coincidir para considerar dedup. Merchant y cuenta son señales de confianza adicionales.

### 8.6 Qué pasa cuando se detecta duplicado

| Confianza del match | Acción | Notificación al usuario |
|---|---|---|
| **Alta** (3 requeridos + merchant match) | Descartar silenciosamente | Ninguna. No molestar. |
| **Media** (3 requeridos, sin merchant) | Crear pendiente con label "probable duplicado" | Confirmar mostrando: "Parece similar a [movimiento existente]. ¿Es el mismo?" |
| **Baja** (monto coincide pero ventana >30min) | Crear pendiente normal | Confirmación estándar |

### 8.7 Aprendizaje desde "ya lo registré"

Cuando el usuario responde "ya lo registré" a una confirmación de email:

1. Dedup Engine busca el movimiento existente que matchea.
2. Si lo encuentra: vincula email con movimiento existente (confirma que fue duplicado).
3. Si no lo encuentra: descarta el pendiente pero no penaliza.
4. Learning Engine guarda la señal para fortalecer futuros matches similares.

---

## 9. Pending Inbox para Email

Referencia cruzada: `06_arquitectura_sistema.md` define la Bandeja de Pendientes general. Esta sección especifica el comportamiento para emails.

### 9.1 Estados y transiciones

```text
DETECTADO
  │
  ▼
ENVIADO_CONFIRMACIÓN ──────────────────┐
  │                                     │
  ├── Usuario: "sí" ──────▶ CONFIRMADO (terminal)
  │                                     │
  ├── Usuario: "no" ──────▶ RECHAZADO  (terminal)
  │                                     │
  ├── Usuario: "ya lo registré" ──▶ DESCARTADO_DEDUP (terminal)
  │                                     │
  └── Sin respuesta (24h) ──▶ SIN_RESPUESTA
                                  │
                                  ▼
                          INCLUIDO_EN_BATCH
                                  │
                          ┌───────┼───────┐
                          │       │       │
                    CONFIRMADO RECHAZADO  SIN_RESPUESTA
                    (terminal) (terminal)      │
                                               │ (14 días)
                                               ▼
                                          ARCHIVADO
                                    (terminal, recuperable
                                     desde Dashboard)
```

### 9.2 Batch nocturno

Si el usuario no respondió a las confirmaciones individuales durante el día:

- Cada noche (hora configurable, default 21:00) se evalúa si conviene enviar resumen batch por WhatsApp o guardar en Centro de Confirmaciones/app.
- Incluye: pendientes del día sin confirmar + pendientes de días anteriores sin confirmar.
- El usuario puede: confirmar todos, rechazar todos, o revisar individualmente.
- Si el usuario no responde al batch: incluir en el batch de la noche siguiente.

```text
IA: "🌙 Hoy detectamos 4 movimientos de tus emails
     que no confirmaste:

     1. ⏳ Yape S/45 → Restaurante
     2. ⏳ Yape S/15 → Pago recibido
     3. ⏳ Yape S/15 → Pago recibido
     4. ⏳ BCP S/180 → Cuota préstamo

     ¿Confirmo todos? ¿O hay alguno que no va?"

User: "los de 15 son ventas, son ingresos"
IA: "Listo ✅ 2 pagos de S/15 como ingresos.
     S/45 restaurante y S/180 cuota confirmados.
     
     💡 ¿Quieres que aprenda a sugerir esos pagos
     como ingresos la próxima vez?"
```

Nota: aprender una sugerencia no equivale a auto-registrar. En V1, aunque el sistema sugiera mejor, el usuario sigue confirmando antes de que el Core registre.

### 9.2.1 Estrategia de ventana 24h y Centro de Confirmaciones

El batch nocturno no debe entenderse como "mandar WhatsApp cada noche pase lo que pase". La regla V1 es calidad primero y costo inteligente:

```text
Si la ventana de 24h esta abierta:
  Confirmar por WhatsApp como canal principal.

Si la ventana esta cerrada y llega el primer pendiente importante:
  Enviar 1 template utility con confirmacion por WhatsApp + link a Pendientes.

Si llega un segundo pendiente y el usuario no respondio:
  Enviar 1 mensaje acumulativo con link al Centro de Confirmaciones.
  Pedir que responda "ver" o "confirmo" para revisarlo por WhatsApp.

Si siguen llegando pendientes y no responde:
  Guardar en Centro de Confirmaciones.
  Notificar por app/PWA si existe.
  Mostrar badge en Dashboard.
  No mandar un WhatsApp por cada pendiente nuevo.
```

El objetivo no es ahorrar bajando calidad. El objetivo es que WhatsApp siga siendo el canal principal cuando hay conversacion, y que Dashboard/app sostenga acumulacion cuando el usuario no responde.

Ejemplos:

```text
Primer pendiente fuera de ventana:
"Detecte un movimiento por revisar.
Responde 'confirmo' o 'ver', o revisalo aqui:
[Ver pendiente]"

Segundo pendiente sin respuesta:
"Ya tienes 2 movimientos guardados para revisar.
Responde 'ver' y los vemos aqui, o entra a Pendientes:
[Ver pendientes]"
```

Regla de seguridad:

```text
"Confirmo todos" solo aplica al lote visible o al ultimo batch enviado.
No confirma pendientes historicos ocultos sin resumen previo.
```

### 9.3 TTL y expiración

| Tiempo | Acción |
|---|---|
| **0-24h** | Confirmación individual por WhatsApp. Si no responde, incluir en batch nocturno. |
| **1-7 días** | Visible en Centro de Confirmaciones. WhatsApp batch solo si aporta valor y respeta estrategia de ventana/costo. |
| **7 días** | Recordatorio especial: "Tienes 5 pendientes de hace una semana. ¿Los revisamos?" |
| **14 días** | Auto-archivo. Dejar de recordar. Recuperable desde Dashboard. |
| **>14 días archivado** | No se muestra activamente. Accesible en Dashboard sección "Archivados". |

> **Regla clave:** Los pendientes archivados **nunca** afectan saldo. Solo los movimientos confirmados afectan saldo.

### 9.4 Canales de confirmación

| Canal | Caso de uso | Cuándo |
|---|---|---|
| WhatsApp individual | Pendiente único, envío instantáneo | Tiempo real, post-detección |
| WhatsApp batch nocturno | Acumulados del día sin confirmar | 21:00 (configurable) |
| Dashboard individual | Revisar uno a uno en sección Pendientes | Cuando el usuario entra al Dashboard |
| Dashboard batch | Revisar y confirmar por lote | Backfill o acumulados de varios días |

### 9.5 Prioridad de pendientes

Cuando hay múltiples pendientes, se muestran en este orden:

1. Más recientes primero.
2. Dentro del mismo día: montos más altos primero (mayor impacto financiero).
3. Pendientes con label "probable duplicado" al final (menos urgentes).

---

## 10. Rate limiting y anti-spam

> Manzana no debe convertirse en spam. Cada mensaje de WhatsApp tiene un costo operativo (WhatsApp Business API) y un costo de atención del usuario.

| Regla | Límite | Qué pasa si se excede |
|---|---|---|
| Confirmaciones individuales por hora | Máximo 5 | Las siguientes van directo al batch nocturno |
| Mensajes batch por día | Máximo 2 | No enviar más batches; pendientes esperan en Dashboard |
| Horario silencioso | 22:00-08:00 (heredado de nudges config, `05a_whatsapp.md`) | No enviar nada. Acumular para después de las 08:00 |
| Pendientes sin confirmar acumulados | Si >10 pendientes sin confirmar | Dejar de enviar WhatsApp individual → solo batch o Dashboard |
| Backfill (escaneo inicial) | NUNCA por WhatsApp | Todo va a Dashboard para revisión agrupada |

Reglas adicionales de costo/calidad:

- Si el usuario no respondio a 2 templates de pendientes, no enviar mas templates individuales por nuevos emails hasta que responda o hasta un resumen de alto valor.
- Si la ventana sigue abierta y hay pendientes accionables, se permite un prompt de continuidad dentro de ventana:
  - a las 12h aprox para dar tiempo real de responder,
  - a las 20h aprox solo como prompt opcional, no default, si el valor lo justifica y no sobrecarga al usuario.
- Si hay varios pendientes, el prompt puede abrir un WhatsApp Flow o el Centro de Confirmaciones para resolver sin varios mensajes.
- Si el usuario responde, la conversacion vuelve a WhatsApp y se puede resolver el lote completo sin templates adicionales.
- Si no responde, el Centro de Confirmaciones mantiene el valor del producto sin convertir WhatsApp en insistencia.

Consideración de costos: cada template message de WhatsApp Business API tiene costo (~$0.005-0.08 USD según región). El rate limiting protege al usuario de spam y a Manzana de costos innecesarios.

---

## 11. Backfill (escaneo inicial)

Cuando el usuario conecta su email por primera vez, el sistema escanea los últimos 30 días de emails bancarios para capturar transacciones históricas.

### 11.1 Flujo técnico

```text
1. Usuario conecta email (OAuth exitoso).
2. Gmail API: buscar emails de remitentes conocidos, últimos 30 días.
3. Procesar máximo 50 emails por minuto (rate limit de API).
4. Cada email pasa por el mismo pipeline: template → parse → enrich → dedup.
5. Emails que matchean con movimientos ya registrados: descartar (dedup).
6. Emails únicos: crear pendientes agrupados por semana/banco.
7. Emitir evento "backfill_completed" con resumen.
```

### 11.2 UX

El backfill se muestra **solo en Dashboard**, nunca en WhatsApp.

```text
Dashboard: "📧 Escaneando 30 días de emails...
            23/47 procesados"

[████████████░░░░░░░░] 49%
```

Al completar:

```text
Dashboard: "📧 Escaneo inicial completado
Encontramos 47 movimientos en tus emails de los últimos 30 días.

Semana del 19-25 mayo: 12 movimientos
Semana del 12-18 mayo: 15 movimientos
Semana del 5-11 mayo: 11 movimientos
Semana del 28 abr - 4 mayo: 9 movimientos

[Revisar todos]  [Confirmar todos]  [Revisar por semana]"
```

### 11.3 Regla: siempre agrupado

> **REGLA CRÍTICA:** El backfill NUNCA envía confirmaciones individuales por WhatsApp. Todos los resultados del backfill van a Dashboard para revisión agrupada. Esto evita inundar WhatsApp con 40+ mensajes.

Después de que el backfill se completa, un solo mensaje de WhatsApp es aceptable:

```text
IA: "📧 Listo. Encontré 47 movimientos en tus emails de los últimos 30 días.
     Revísalos desde el dashboard cuando quieras.
     Desde ahora, los nuevos movimientos te los confirmo aquí por WhatsApp."
```

---

## 12. Proveedores de email

La decision tecnica de proveedor vive en `docs/fase_4_tecnica/22_decision_email_provider.md`.

Regla V1:

```text
Gmail primero.
Outlook/IMAP/forwarding despues, solo via EmailAdapter.
Nada de passwords, app passwords, scraping ni APIs no oficiales.
```

### 12.1 Gmail (P0 V1 aprobado)

| Aspecto | Detalle |
|---|---|
| **Método de detección** | Google Cloud Pub/Sub (push instantáneo) |
| **Latencia objetivo** | <60 segundos push -> pendiente creado |
| **OAuth scope** | `gmail.readonly` como scope minimo operativo si se necesita leer cuerpo/snippet de emails financieros |
| **Compliance** | Scope restringido: requiere OAuth consent correcto, privacy policy, Limited Use y validacion antes de produccion abierta |
| **Fallback** | Gmail History polling si Pub/Sub falla o hay gap de `historyId` |
| **API para backfill** | Gmail API `messages.list` con filtro `from:` |
| **Webhook** | Pub/Sub topic + subscription → HTTP push al Email Adapter |
| **Watch renewal** | Worker diario renueva `users.watch` antes de expirar; Gmail exige renovarlo al menos cada 7 dias |

### 12.2 Outlook/Hotmail (futuro)

| Aspecto | Detalle |
|---|---|
| **Método de detección** | Microsoft Graph API webhooks |
| **Estado V1** | No implementado en V1 inicial |
| **OAuth scope** | `mail.read` — solo lectura |
| **Fallback** | Polling/delta query segun Microsoft Graph si se aprueba en fase futura |
| **Webhook** | Microsoft Graph subscription → HTTP push |
| **Regla** | Solo via `EmailAdapter`, no logica paralela |

### 12.3 Yahoo/IMAP generico (fuera de V1)

| Aspecto | Detalle |
|---|---|
| **Estado V1** | Fuera de V1 |
| **Razon** | Mayor fragilidad, peor setup y mas variantes de proveedor |
| **Regla** | Si se decide futuro, debe usar OAuth oficial; nunca password/app password |

### 12.4 Email forwarding (pendiente decision)

Una alternativa futura es dar al usuario una direccion unica de Manzana para reenviar alertas financieras.

Ventajas:

- evita pedir acceso OAuth al inbox;
- reduce sensibilidad de permisos;
- puede servir si Google verification se vuelve demasiado pesada.

Desventajas:

- mas friccion para el usuario;
- depende de que configure forwarding correctamente;
- puede perder contexto de `historyId`, dedup y backfill.

No entra en V1 inicial, pero queda como opcion si Gmail OAuth bloquea despliegue.

---

## 13. Bancos y apps soportados

| Entidad | Tipo de notificación | Prioridad |
|---|---|---|
| **Yape** | Pagos enviados/recibidos (>S/10) | P0 |
| **BCP** | Movimientos de cuenta, tarjeta | P0 |
| **Interbank** | Movimientos, alertas | P1 |
| **BBVA** | Movimientos, tarjeta | P1 |
| **Plin** | Pagos enviados/recibidos | P1 |
| **Scotiabank** | Movimientos | P2 |

> **Nota:** Yape solo envía notificaciones por email para pagos mayores a S/10. Los gastos menores (café, snacks) se capturan por WhatsApp.

---

## 14. Flujo de conexión

```
1. Usuario en Dashboard → "Conectar email"
2. OAuth con Gmail (NO pide contraseña, solo permisos)
3. Permisos: solo lectura de emails
4. Escaneo inicial: últimos 30 días de emails bancarios (ver §11)
5. "Encontramos 47 transacciones de Yape y BCP. ¿Las importamos?"
6. Desde ahora: detección en tiempo real (push)
```

### ⚠️ Aviso al conectar cuentas

Al momento de conectar, mostrar:

```
📢 Información importante:

• Yape solo envía notificaciones por email para pagos mayores a S/10.
  Los gastos menores (café, snacks) los puedes registrar por WhatsApp.

• BCP envía alertas para todos los movimientos de cuenta y tarjeta.

• Para que funcione, asegúrate de tener activadas las alertas 
  por email en tu banco/app.

• Solo procesamos emails financieros detectados de bancos/apps compatibles.
  No guardamos emails personales, de trabajo o newsletters.

• Puedes desconectar tu email en cualquier momento.
```

---

## 15. Seguridad OAuth

| Aspecto | Regla |
|---|---|
| **Scope V1** | `gmail.readonly` para Gmail si el parser necesita leer cuerpo/snippet de emails financieros. Solo lectura, nunca escritura. |
| **Scope prohibido** | No pedir `https://mail.google.com/`, `gmail.modify`, `gmail.send`, Drive, Calendar ni Contacts. |
| **Compliance Google** | Tratar `gmail.readonly` como scope restringido: OAuth consent, privacy policy, Limited Use y posible security assessment antes de produccion abierta. |
| **Tokens** | Encriptados at rest (AES-256). |
| **Refresh token** | Encriptado y renovado segun reglas del proveedor. Si el proveedor devuelve un refresh token nuevo, reemplazar el anterior. |
| **Revocación externa** | Si el usuario revoca desde Google/Microsoft, detectar en siguiente API call. Notificar: "Tu email se desconectó. ¿Quieres reconectar?" |
| **Storage** | Tokens encriptados en BD. Nunca en logs. Nunca en cliente. |
| **Multi-cuenta** | V1 soporta solo 1 cuenta de email por usuario. |
| **Desconexión** | Token eliminado inmediatamente. Pendientes no confirmados se archivan. Movimientos confirmados persisten. |
| **Audit** | Cada conexión/desconexión se registra en audit log. |

Reglas no negociables:

- Manzana nunca pide contrasena de Gmail/Outlook.
- Manzana nunca pide app password.
- Manzana nunca usa scraping ni automatizacion del inbox.
- Manzana no usa datos de email para publicidad, credit scoring ni entrenamiento de modelos generales.
- El usuario puede desconectar email en cualquier momento.

---

## 16. Modo discreto

Referencia: `05b_motor_ia.md` §12.4 define la política transversal de modo discreto. `05a_whatsapp.md` §Modo Discreto define la implementación en WhatsApp.

Cuando el modo discreto está activo, las confirmaciones de email no muestran datos sensibles:

### Modo normal (default)

```text
IA: "📧 Detectamos: Yape S/45 → Restaurante. ¿Lo registro?"
```

### Modo discreto

```text
IA: "📧 Detectamos un movimiento nuevo. Escribe 'ver' para revisarlo."
```

### Batch nocturno discreto

```text
IA: "Tienes 4 movimientos por revisar. Escribe 'ver' para detalles."
```

### Dashboard

El Dashboard **siempre** muestra montos y detalles (el usuario está autenticado y decidió entrar a la app).

---

## 17. Casos problemáticos y soluciones

| Caso | Problema | Solución |
|---|---|---|
| **Recarga de Yape** | Se ve como ingreso pero es transferencia | IA sugiere "transferencia interna" en la confirmación |
| **Yape solo notifica >S/10** | Gastos <S/10 no llegan | Se capturan por WhatsApp. Aviso mostrado al conectar |
| **Transferencia entre cuentas propias** | BCP a Interbank no es gasto | IA detecta ambas cuentas → sugiere "transferencia" |
| **Devoluciones** | No es ingreso | IA detecta monto similar a gasto reciente → sugiere "devolución" |
| **Duplicado con WhatsApp** | Ya lo registró manualmente | Dedup automático (§8). Opción "ya lo registré" como fallback |
| **Compra con tarjeta en cuotas** | Solo se ve la cuota | IA vincula a deuda existente o sugiere crear deuda |
| **Notificaciones incompletas** | Email sin monto o comercio | Pide info faltante en la confirmación |
| **Emails en inglés** | PayPal, Amazon | Templates multilingual, IA parsea en cualquier idioma |
| **Email llega pero WhatsApp no funciona** | No se puede enviar confirmación | Pendiente se crea y queda en Dashboard. Retry WhatsApp 2x con backoff |
| **Banco envía resumen mensual** | No es email transaccional | Template no matchea (subject pattern no incluye "resumen"). Se ignora |
| **Email en formato HTML complejo** | Parser no puede extraer de HTML | Parser prioriza texto plano alternativo. Si no hay, strip HTML antes de regex |
| **Monto en email no coincide con real** | Cuota vs total en compras a plazos | IA sugiere vincular a deuda existente si el monto coincide con una cuota |

### Regla de oro

> **Nunca asumir ingreso.** Cuando hay duda → sugiere "transferencia" en la confirmación y deja que el usuario decida.

---

## 18. Recuperación de errores

| Error | Comportamiento | Retry |
|---|---|---|
| **WhatsApp delivery falla** | Reintentar 2x con backoff (1min, 5min). Si falla, mover pendiente a Dashboard. | Sí, 2x |
| **Parsing falla** | Log metadata (remitente, asunto, NO contenido). Alertar si tasa sube. | No |
| **Gmail API quota excedida** | Backoff exponencial. Fallback a polling cada 10 min. | Sí, auto |
| **Email duplicado vía push** | Idempotencia por `email_event_id`. Segundo intento se ignora. | No |
| **Confirmación doble** (WhatsApp + Dashboard) | Idempotencia: primera confirmación gana, segunda se ignora. | N/A |
| **OAuth token expirado** | Auto-refresh. Si refresh falla, notificar: "Reconecta tu email en configuración". | Sí, 1x |
| **OAuth token revocado externamente** | Detectar en siguiente API call. Notificar usuario. Desactivar push. | No |
| **Pub/Sub webhook falla** | Heartbeat cada 5 min. Si no hay heartbeat, activar polling como fallback. | Automático |
| **Template no matchea** | Intentar fallback genérico (§5.4). Si nada, loguear y descartar. | No |

---

## 19. Monitoreo y detección de fallos

| Métrica | Target | Alerta |
|---|---|---|
| **Tasa de parsing exitoso por banco/semana** | >95% | Alerta interna si cae debajo de 90% |
| **Emails procesados vs emails recibidos** | >98% | Alerta si hay emails en whitelist no procesados |
| **Templates con last_matched_at >14 días** | 0 | Alerta: "Template X de banco Y no matchea hace 2 semanas" |
| **Latencia push → confirmación enviada** | <60 seg | Alerta si p95 >120 seg |
| **Tasa de fallback genérico** | <10% | Alerta si sube: posible cambio de formato en banco |

Alertas al usuario:

- Si no hay emails de un banco conectado en 2 semanas: "No hemos detectado emails de BCP últimamente. ¿Siguen activas tus alertas por email?"
- Si OAuth token falla: "Tu email se desconectó. Reconéctalo desde configuración."

Logs internos:

- Emails no parseados: solo metadata (sender, subject, timestamp). **Nunca contenido.**
- Template health: dashboard interno con tasa de match por template/versión.
- Parsing errors: stack trace sin datos financieros.

---

## 20. Privacidad y datos

| Aspecto | Regla |
|---|---|
| **Datos almacenados** | Solo campos financieros extraídos. NUNCA el email completo. |
| **Parsing en memoria** | El cuerpo del email se procesa in-memory y se descarta. No se persiste ni temporalmente en disco. |
| **Desconexión** | Tokens eliminados. Pendientes no confirmados archivados. Movimientos confirmados persisten. |
| **Eliminación de cuenta** | Todo se borra: tokens, pendientes, movimientos, learning signals. |
| **Cumplimiento legal** | Ley 29733 de Protección de Datos Personales (Perú). |
| **Logging** | Solo metadata de operaciones. Nunca contenido financiero en logs. Nunca montos, comercios o cuentas en logs. |
| **Transparencia** | El usuario puede ver qué emails fueron procesados (sender + date) desde Dashboard > Configuración > Email. |
| **Consentimiento** | Explícito al conectar email. Aviso de qué se lee y qué no. Desconexión en cualquier momento. |
| **Cada movimiento muestra fuente** | "📧 Fuente: Email" visible en detalle de movimiento. |

> **Principio:** Si el usuario desconecta email, los movimientos que ya confirmó se mantienen (son suyos). Los pendientes no confirmados se archivan. Los tokens se eliminan inmediatamente.

---

## 21. Multi-cuenta

> Decision sustituida el 23 de julio de 2026: V1 admite multiples cuentas Gmail
> por usuario y las vincula por institucion.

Contrato:

1. El usuario conecta uno o mas Gmail por OAuth oficial.
2. En Configuracion elige banco/app, el Gmail que recibe sus avisos y el
   remitente exacto del banco.
3. Puede editar el Gmail o el remitente de cada banco sin perder las demas
   configuraciones.
4. Un remitente editado vuelve a modo sombra hasta coincidir con un template
   exacto activo y verificado. La seleccion del usuario no sustituye
   DKIM/DMARC ni el Gate institucional.
5. El filtro inicial sigue siendo deterministico por
   `connection_id + sender exacto`; no se pasan todos los correos al agente.
6. El agente solo recibe el contenido del aviso financiero que supero ese
   filtro, autenticidad y consentimiento.
7. Un aviso apto crea `Pending`; WhatsApp/Dashboard pide confirmacion y solo la
   respuesta explicita llega al Core.
8. Desconectar un Gmail archiva solamente los pendientes que nacieron en ese
   buzon. Movimientos confirmados y otras conexiones se conservan.

Outlook y otros proveedores siguen fuera de alcance hasta implementar su
adapter oficial. Multi-correo no significa multi-proveedor.

---

## 22. Métricas de éxito

| Métrica | Target | Cómo se mide |
|---|---|---|
| Emails bancarios detectados correctamente | >= 95% | Emails de whitelist parseados exitosamente / total recibidos |
| Transacciones útiles confirmadas por usuario | >= 85% | Pendientes confirmados / total pendientes creados |
| Tasa de dedup exitoso | >= 90% | Duplicados detectados / duplicados reales |
| Tiempo de detección (email → confirmación enviada) | < 60 seg | p50 del pipeline completo |
| Pendientes confirmados vs archivados | > 70% confirmados | Confirmados / (confirmados + archivados) |
| Usuarios con email conectado al D30 | >= 40% | Usuarios con conexión activa a 30 días del registro |
| Fallos de parsing silenciosos no detectados | 0 (target) | Emails de whitelist que pasan sin log ni proceso |

---

## 23. Fuera de alcance V1

| Feature excluida | Razón |
|---|---|
| Auto-registro sin confirmación | Principio fundamental: nada sin aprobación del usuario. |
| Lectura de emails no financieros | No es un lector de emails. Solo finanzas. |
| Parsing de PDF adjuntos | Complejidad técnica alta (estados de cuenta, facturas). Futuro. |
| Parsing de screenshots/imágenes | OCR pospuesto a V1.2 (ver `05a_whatsapp.md`). |
| Multi-cuenta email | 1 cuenta por usuario en V1 (ver §21). |
| Outlook/Yahoo/IMAP generico | Futuros proveedores via `EmailAdapter`; V1 inicial solo Gmail. |
| Password/app password/scraping de email | Prohibido por seguridad y confianza. |
| Templates para todos los bancos peruanos | V1 cubre P0 y P1 (Yape, BCP, Interbank, BBVA, Plin). |
| Integración bancaria directa (open banking) | V1 usa email parsing. Open banking es fase futura. |
| Reglas de auto-confirmación | "Confirma automáticamente todos los Netflix" requiere confianza alta en dedup. Futuro. |

---

## 24. Resumen final

Email parsing V1 es **captura pasiva con confirmación**. Su valor es capturar lo que el usuario olvida, sin quitar control.

La experiencia debe sentirse:

- **Automática pero respetuosa:** detecta sin molestar excesivamente.
- **Útil pero no invasiva:** complementa WhatsApp, no lo reemplaza.
- **Inteligente pero transparente:** dedup evita duplicados, pero el usuario siempre sabe qué pasó.
- **Segura pero no paranoica:** usa permiso de solo lectura y procesa solo emails financieros permitidos.

El flujo completo es:

```text
Banco envía email → Manzana detecta → Parsea → Enriquece → Dedup
  → Si duplicado: silencio
  → Si nuevo: confirmar por WhatsApp o Dashboard
  → Usuario decide → Core registra → Learning aprende
```

> **La regla de oro:** Cada movimiento detectado por email es una oportunidad de capturar un dato que el usuario hubiera olvidado. Pero esa oportunidad no justifica quitar control. El usuario siempre decide.

---

*Feature 4/10 del Paso 5 — V2 Especificación avanzada ✅*
