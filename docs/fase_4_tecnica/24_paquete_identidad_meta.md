# 24. Paquete De Identidad Publica Para Meta/Kapso

**Estado:** V1.2 - Paquete publico vigente; proveedor operativo WhatsApp V1 es Kapso  
**Ultima actualizacion:** 13 de junio, 2026  
**Decision relacionada:** Kapso como proveedor oficial WhatsApp V1 via `WhatsAppAdapter`; Meta directo queda como escape tecnico futuro.

---

## 1. Proposito

Este documento define el paquete minimo de identidad publica que Manzana debe mantener para operar con proveedores oficiales de WhatsApp, incluyendo Kapso ahora y Meta directo si se reabre despues.

El objetivo no es "pasar como sea". El objetivo es que Meta, un usuario o un revisor externo pueda responder sin confusion:

- que es Manzana,
- quien la opera,
- donde contactarla,
- que datos trata,
- como pedir eliminacion de datos,
- y que el sitio publico coincide con la informacion declarada en Meta.

---

## 2. Problema Actual

Manzana aun esta en construccion y no tiene identidad publica completa.

Riesgos detectados durante setup de WhatsApp:

- Meta no acepta dominios genericos o compartidos como prueba solida de negocio.
- `vercel.app` puede servir para staging tecnico, pero no deberia usarse como identidad final.
- Un dominio que solo "pasa el formato" pero no resuelve correctamente no sirve como prueba real.
- No se deben seleccionar registros publicos de terceros que no pertenecen al operador real.
- No se deben subir documentos inventados o que no coincidan con el operador legal.

---

## 3. Principio

```text
La marca puede ser Manzana.
El operador legal debe ser real y verificable.
```

Si Manzana todavia no esta formalizada como empresa, la web y Meta deben tratarla como un producto/proyecto operado por una persona natural o figura legal real.

Ejemplo de posicionamiento valido:

```text
Manzana es un producto digital de finanzas personales operado por [NOMBRE LEGAL].
```

No afirmar que existe una empresa formal llamada Manzana si aun no existe respaldo documental.

---

## 4. Rutas Publicas Creadas

Estas rutas quedan abiertas sin login:

| Ruta | Proposito |
|---|---|
| `/empresa` | Explica que es Manzana, quien la opera y que politicas publicas existen. |
| `/privacidad` | Politica publica de privacidad y datos financieros. |
| `/terminos` | Terminos de uso, limites y no asesoria financiera. |
| `/contacto` | Contacto oficial, soporte, privacidad y datos publicos. |
| `/eliminar-datos` | Instrucciones publicas para pedir eliminacion de datos. |

Tambien se mantiene publico:

| Ruta | Proposito |
|---|---|
| `/api/health` | Healthcheck tecnico. |
| `/api/webhooks/whatsapp` | Webhook publico de Meta, protegido por token/firma. |

---

## 5. Variables De Identidad

Completar en Vercel y local antes de reenviar verificacion:

```env
NEXT_PUBLIC_MANZANA_APP_URL=https://tudominio.com
MANZANA_APP_URL=https://tudominio.com

NEXT_PUBLIC_MANZANA_LEGAL_OPERATOR=Nombre legal real
NEXT_PUBLIC_MANZANA_LEGAL_STATUS=Persona natural / empresa privada / figura real aplicable
NEXT_PUBLIC_MANZANA_LEGAL_COUNTRY=Peru
NEXT_PUBLIC_MANZANA_PUBLIC_ADDRESS=Direccion publica que coincida con documentos
NEXT_PUBLIC_MANZANA_CONTACT_EMAIL=contacto@tudominio.com
NEXT_PUBLIC_MANZANA_SUPPORT_EMAIL=soporte@tudominio.com
NEXT_PUBLIC_MANZANA_PRIVACY_EMAIL=privacidad@tudominio.com
NEXT_PUBLIC_MANZANA_CONTACT_PHONE=+51XXXXXXXXX
NEXT_PUBLIC_MANZANA_POLICY_EFFECTIVE_DATE=10 de junio de 2026
```

Regla:

```text
La informacion visible en la web debe coincidir con lo que se declara en Meta y con los documentos que se suben.
```

---

## 6. Checklist Antes De Reintentar Meta

### 6.1 Dominio

- Comprar dominio propio.
- Conectarlo a Vercel.
- Verificar que `https://tudominio.com/empresa` responde 200.
- No usar `vercel.com` si no apunta realmente al proyecto.
- Evitar depender de `vercel.app` como identidad final.

### 6.2 Correo

- Crear correo del dominio.
- Recomendado:
  - `contacto@tudominio.com`
  - `soporte@tudominio.com`
  - `privacidad@tudominio.com`
- Confirmar que se pueden recibir correos.

### 6.3 Operador Legal

- Elegir una identidad real:
  - persona natural,
  - empresa formal,
  - u otra figura permitida por Meta y respaldada por documentos.
- La identidad usada en Meta debe coincidir con documentos.
- Si se usa persona natural, no declarar una empresa formal inexistente.

### 6.4 Documentos

Los documentos deben validar:

- nombre legal,
- direccion o telefono oficial,
- y relacion con el operador.

No usar:

- documentos de otra persona,
- registros publicos que solo coinciden con la palabra "Manzana",
- capturas editadas,
- datos que no coincidan con la web.

### 6.5 WhatsApp

- Usar numero dedicado.
- No registrar ese numero en la app movil de WhatsApp Business si se usara como numero Cloud API exclusivo.
- Mantener Kapso como proveedor operativo V1 via `WhatsAppAdapter`; no usar QR, WhatsApp Web automation ni proveedores grises.
- No activar envios reales hasta que:
  - WABA este usable,
  - token este listo,
  - webhook este validado,
  - `WHATSAPP_APP_SECRET` este configurado,
  - y `WHATSAPP_SEND_RESPONSES=true` sea una decision explicita.

---

## 7. Que Pegar En Meta

Cuando Meta pida informacion:

| Campo Meta | Valor recomendado |
|---|---|
| Nombre para mostrar WhatsApp | `Manzana` si cumple politicas de nombre y coincide con la marca publica. |
| Sitio web | `https://tudominio.com/empresa` o `https://tudominio.com`. |
| Telefono | Numero dedicado que puedas verificar. |
| Email | Correo del dominio, idealmente `contacto@tudominio.com`. |
| Pais | Peru, si esa es la jurisdiccion real. |
| Direccion | La misma que aparezca en documentos. |
| Tipo de empresa | La figura real que puedas documentar. |

Si Meta muestra un registro publico que no corresponde:

```text
Seleccionar "Mi empresa no figura en la lista".
```

No seleccionar terceros.

---

## 8. Criterio De Listo

El paquete esta listo cuando:

- la ruta `/empresa` no muestra datos pendientes,
- `/privacidad`, `/terminos`, `/contacto` y `/eliminar-datos` existen y cargan sin login,
- el dominio propio funciona,
- el correo del dominio recibe mensajes,
- los datos de Meta, web y documentos coinciden,
- no hay informacion de terceros,
- y el numero dedicado esta preparado para operar por Kapso o por Meta directo si se reabre esa ruta.

---

## 9. Decision

Continuar construyendo Manzana aunque Meta este pendiente.

La verificacion de Meta es un desbloqueo externo de canal, no una razon para detener:

- Core financiero,
- Dashboard,
- pendientes,
- AgentRuntime,
- email,
- movimientos,
- deudas,
- recurrentes,
- insights,
- ni experiencia V1.

---

## 10. Fuentes De Referencia

- Meta Business Help: verificacion de negocio, datos legales, documentos y metodos de contacto.
- Meta for Developers: WhatsApp Cloud API, numeros de telefono y webhooks.
- Kapso: configuracion de WhatsApp Business Platform, webhooks y mensajes.
- Documentos internos: `21_decision_whatsapp_provider.md`, `18_api_spec.md`, `23_plan_implementacion_v1.md`.

*Paquete de Identidad Meta/Kapso - V1.2*
