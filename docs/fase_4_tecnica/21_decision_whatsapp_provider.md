# 21 - Decision WhatsApp Provider V1

**Estado:** V1.4 - Kapso aprobado como proveedor oficial WhatsApp V1  
**Ultima actualizacion:** 16 de junio, 2026  
**Depende de:** `05a_whatsapp.md`, `05b_motor_ia.md`, `06_arquitectura_sistema.md`, `15_stack_tecnologico.md`, `18_api_spec.md`, `20_decisiones_tecnicas.md`  

---

## 1. Decision

Manzana usara **Kapso** como proveedor oficial operativo de WhatsApp V1, siempre detras de `WhatsAppAdapter`.

La decision no cambia la arquitectura de producto:

```text
WhatsApp
  -> WhatsAppAdapter
  -> External Event Gateway
  -> FinancialOrchestrator
  -> Core / Pending / Response
```

Kapso es transporte. No decide categorias, saldos, deuda, riesgo, confirmaciones, nudges ni reglas de dinero.

Meta WhatsApp Cloud API directo queda como escape tecnico futuro detras del mismo adapter. YCloud queda reemplazado/pausado como proveedor operativo por friccion de onboarding/correo corporativo. No se usaran proveedores no oficiales, sesiones QR, WhatsApp Web automation, Baileys ni `whatsapp-web.js`.

---

## 2. Por Que Kapso

Kapso encaja mejor con el momento actual de Manzana porque:

- mantiene una ruta oficial sobre WhatsApp Business Platform;
- expone endpoints compatibles con payloads de WhatsApp Cloud;
- permite usar API key y `phone_number_id` sin acoplar el dominio a Meta directo;
- soporta webhooks de mensajes y delivery status;
- mantiene espacio para mensajes interactivos, templates y Flows;
- reduce friccion operativa frente a YCloud en esta etapa.

La razon **no** es bajar calidad. La calidad se mantiene con:

- `WhatsAppWindowManager`;
- `Nudge Policy`;
- `Pending Inbox`;
- `ResponsePlanner`;
- `ResponseAgent`;
- `TraceCollector`;
- control de saldos por Core deterministico.

---

## 3. Contrato De Provider

```ts
type WhatsAppProvider = "kapso" | "ycloud" | "meta_cloud";
```

Proveedor operativo por defecto:

```env
WHATSAPP_PROVIDER=kapso
```

Regla:

```text
El dominio financiero nunca importa SDKs ni detalles de Kapso.
Solo WhatsAppAdapter conoce headers, endpoints, payloads y errores del proveedor.
```

---

## 4. Variables De Entorno

```env
WHATSAPP_PROVIDER=kapso

KAPSO_API_KEY=
KAPSO_WHATSAPP_PHONE_NUMBER_ID=
KAPSO_WEBHOOK_SECRET=

# Opcional. Si queda vacio usa:
# https://api.kapso.ai/meta/whatsapp/v24.0
KAPSO_API_BASE_URL=
```

Variables de escape tecnico Meta directo:

```env
WHATSAPP_PROVIDER=meta_cloud
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_APP_SECRET=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
```

Variables legacy YCloud:

```env
YCLOUD_API_KEY=
YCLOUD_WHATSAPP_FROM_PHONE=
YCLOUD_WEBHOOK_SECRET=
YCLOUD_API_BASE_URL=
```

YCloud no debe configurarse en V1 salvo prueba controlada y decision explicita.

---

## 5. Envio Outbound

Endpoint Kapso V1:

```text
POST https://api.kapso.ai/meta/whatsapp/v24.0/{phone_number_id}/messages
```

Headers:

```text
Content-Type: application/json
X-API-Key: {KAPSO_API_KEY}
```

Payloads soportados por Manzana V1:

- `text` para respuestas dentro de ventana de 24h;
- `interactive.button` para confirmaciones simples cuando convenga;
- `template` para mensajes fuera de ventana, siempre con politica de frecuencia.

Ejemplo conceptual:

```json
{
  "messaging_product": "whatsapp",
  "to": "51912345678",
  "type": "text",
  "text": {
    "body": "Listo. Cafe S/8 registrado.",
    "preview_url": false
  }
}
```

---

## 6. Webhooks Inbound

URL de Manzana:

```text
POST /api/webhooks/whatsapp
```

Headers Kapso esperados:

```text
X-Webhook-Event
X-Webhook-Signature
X-Webhook-Timestamp
X-Webhook-Id
```

Eventos esperados:

| Evento Kapso | Uso Manzana |
|---|---|
| `message.received` | Entrada de usuario a WhatsApp. |
| `message.sent` | Trazabilidad outbound. |
| `message.delivered` | Delivery status. |
| `message.read` | Lectura, confianza y ventana conversacional. |
| `message.failed` | Error, retry o fallback. |

Firma:

```text
HMAC-SHA256(rawBody, KAPSO_WEBHOOK_SECRET)
```

En `production` y `staging`, la firma es obligatoria si existe `KAPSO_WEBHOOK_SECRET`.

---

## 7. Normalizacion Interna

Kapso debe convertirse al contrato interno:

```ts
type InboundWhatsAppEvent = {
  provider: "kapso";
  providerMessageId: string;
  waPhoneNumberId: string;
  fromPhone: string;
  toPhone: string;
  receivedAt: string;
  messageType: "text" | "button" | "interactive" | "image" | "audio" | "document" | "unknown";
  text: string | null;
  payload: Record<string, unknown>;
};
```

Status:

```ts
type WhatsAppStatusEvent = {
  provider: "kapso";
  providerMessageId: string;
  recipientPhone: string;
  status: "sent" | "delivered" | "read" | "failed" | "unknown";
  receivedAt: string;
  conversationId: string | null;
  pricingCategory: string | null;
  errors: Record<string, unknown>[];
};
```

Idempotencia:

```text
kapso:message:{providerMessageId}
kapso:status:{providerMessageId}:{status}:{receivedAt}
```

---

## 8. Ventana De 24 Horas Y Calidad

La estrategia no debe degradar calidad por ahorrar mensajes.

Reglas:

- Dentro de ventana de 24h, responder con freeform si aporta claridad o continuidad.
- Fuera de ventana, usar templates solo si hay valor real, opt-in y politica de frecuencia.
- Email detectado crea pendiente; no registra dinero sin confirmacion.
- Si se acumulan pendientes, WhatsApp puede invitar a revisar el Centro de Confirmaciones.
- La app/Dashboard no reemplaza WhatsApp como canal principal; complementa control, batch y profundidad.
- Mensajes proactivos deben pasar por `Nudge Policy`, horario silencioso, modo discreto y opt-ins.

---

## 9. Confirmaciones Y Flows

V1 debe soportar:

- confirmar un pendiente por WhatsApp;
- cancelar un pendiente;
- ver pendientes;
- confirmar/cancelar por codigo estable;
- usar link al Centro de Confirmaciones cuando hay varios pendientes;
- usar interactive buttons cuando el mensaje es simple y no sensible.

Flows o experiencias interactivas avanzadas son deseables, pero no bloquean V1.

Regla:

```text
Si un Flow no esta disponible, Manzana conserva calidad con texto, botones simples y Dashboard.
```

---

## 10. Costos Y Observabilidad

Medir por proveedor:

- mensajes enviados;
- mensajes por tipo (`freeform`, `template`, `interactive`);
- status de delivery;
- errores;
- latencia;
- templates fuera de ventana;
- mensajes evitados por batching/window strategy;
- outcomes de usuario.

No asumir costo marginal cero. Aunque Kapso simplifique operacion, el producto debe medir costo real por usuario y por flujo.

Para la activacion proactiva, Manzana no confia solo en una variable manual.
Consulta el template por nombre e idioma en Kapso y solo considera listo el
estado live `APPROVED`. `PENDING`, `REJECTED`, ausencia del template, error de
red o configuracion incompleta bloquean el piloto.

El endpoint interno de readiness es read-only, requiere secreto de worker/cron
y nunca devuelve API keys, WABA ID ni phone number ID. Distingue:

- `configuration_ready`: las dependencias operativas estan preparadas;
- `sending_active`: ademas existe modo `pilot` y kill switch habilitado;
- `pilot_ready`: un usuario concreto esta en allowlist, tiene telefono y dio
  consentimiento maestro y granular;
- `eligible_now`: ademas no esta dentro del horario silencioso.

---

## 11. Proveedores Descartados V1

Descartados para V1:

- Twilio;
- 360dialog;
- WATI;
- Zoko;
- respond.io;
- YCloud como proveedor operativo;
- Evolution API;
- Baileys;
- `whatsapp-web.js`;
- sesiones QR;
- automatizacion de WhatsApp Web;
- scraping.

Motivo:

```text
Manzana maneja datos financieros. El canal debe ser oficial, auditable y estable.
```

---

## 12. Checklist De Setup

- [x] Crear cuenta Kapso.
- [x] Configurar WhatsApp/WABA/numero en Kapso.
- [x] Obtener `KAPSO_API_KEY`.
- [x] Obtener `KAPSO_WHATSAPP_PHONE_NUMBER_ID`.
- [x] Crear/obtener `KAPSO_WEBHOOK_SECRET`.
- [x] Configurar webhook a `/api/webhooks/whatsapp`.
- [x] Activar eventos minimos `message.received` y `message.sent`.
- [x] Configurar variables en Vercel/staging.
- [x] Ejecutar readiness/smoke de WhatsApp.
- [x] Probar mensaje freeform dentro de ventana.
- [x] Probar mensaje interactive button.
- [x] Probar status `delivered`/`failed`.
- [x] Confirmar que `whatsapp_delivery_attempts.provider = kapso`.
- [x] Implementar comprobacion live de template por nombre e idioma.
- [x] Implementar readiness read-only y metricas limitadas a la cohorte.
- [x] Crear en Meta/Kapso el template Utility definitivo del piloto.
- [x] Esperar estado live `APPROVED` del template Utility del piloto.
- [x] Confirmar metodo de pago operativo para templates.
- [x] Ejecutar piloto con una cohorte allowlisted y opt-in explicito.

Nota 2026-07-20:

El pipeline real Kapso quedo validado para inbound, respuesta interactiva,
confirmacion por boton y creacion de movimiento por Core. El primer template
Utility versionado, `manzana_compromiso_financiero_v1`, fue creado y permanece
`PENDING`; el modo operativo sigue en `planned` y no envia. Siguen pendientes
su aprobacion live, metodo de pago atestado, cohorte/opt-in, status
`delivered/read/failed` y WhatsApp Flow avanzado.

Nota 2026-07-23:

El template live paso a `UTILITY/APPROVED`, el metodo de pago fue atestado y se
ejecuto un piloto allowlisted de un usuario con opt-in explicito. Kapso acepto
exactamente un mensaje (`HTTP 200`) y el usuario confirmo su recepcion. El
sistema volvio inmediatamente a `planned` con kill switch apagado. Al cierre
inicial la fila tecnica permanecio `sent/accepted` porque el adapter legacy
ignoro los webhooks V2. Corte 30 corrigio la normalizacion y recupero desde la
API oficial el historial real `sent/delivered/read`; delivery y candidato
quedaron reconciliados como `delivered/read` sin fabricar otro envio. WhatsApp
Flow avanzado sigue fuera del bloqueo de V1.

---

## 13. Fuentes Operativas

- Kapso send text: `https://docs.kapso.ai/docs/whatsapp/send-messages/text`
- Kapso buttons: `https://docs.kapso.ai/docs/whatsapp/send-messages/buttons`
- Kapso receive messages: `https://docs.kapso.ai/docs/whatsapp/receive-messages`
- Kapso webhooks overview/security: `https://docs.kapso.ai/docs/platform/webhooks/overview`
- Kapso webhook event types: `https://docs.kapso.ai/docs/platform/webhooks/event-types`
- Kapso list message templates: `https://docs.kapso.ai/api/meta/whatsapp/templates/list-message-templates`
- Kapso template lifecycle: `https://docs.kapso.ai/docs/whatsapp/templates/lifecycle`

---

## 14. Resumen

Kapso queda como proveedor WhatsApp V1.

La arquitectura sigue siendo:

```text
Proveedor reemplazable.
Adapter obligatorio.
Core protegido.
Pendientes antes que escritura financiera.
Calidad de experiencia por encima de ahorro ciego.
```
