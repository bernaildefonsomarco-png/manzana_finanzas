# 14 — Contratos de API

**Bloque:** 02 — Fundaciones
**Estado:** V1 (reescritura)
**Fecha:** 25 de julio de 2026
**Depende de:** `13_modelo_datos_web_v1.md`, `12_arquitectura_app_web.md`
**Documentos que dependen de este:** §10 de todos los módulos, `17_patrones_datos_formularios_y_listados.md`
**Fuentes:** `docs/fase_4_tecnica/18_api_spec.md` §5, `src/app/api/_lib/http.ts` (envelope ya implementado y correcto)

---

## 1. Qué se conserva y qué se reescribe

La API actual tiene aciertos que no se tocan: envelope consistente,
`trace_id` propagado, idempotencia real en movimientos, validación con Zod
en 15 archivos de esquemas y autenticación en las 58 rutas.

Se reescriben cuatro cosas que faltan y que bloquean el producto:

| Falta hoy | Consecuencia |
|---|---|
| Paginación real | Solo existe `limit`. Con más de 50 movimientos, el usuario no puede ver el resto: no hay forma de pedir la página siguiente. |
| Uso de filtros server-side | La API los soporta, la interfaz no los usa: descarga 50 y filtra en el cliente. |
| Límite de peticiones | Cero protección ante abuso o bucles. |
| Protección CSRF | Cero. |

## 2. Principios

1. Contrato estable y versionado: `/api/v1`.
2. Toda respuesta usa el mismo envelope, incluidos los errores.
3. Toda escritura financiera pasa por el Core, nunca por SQL directo desde
   la ruta (`WEB-D012`).
4. Toda escritura es idempotente.
5. Todo listado se pagina por cursor y filtra en el servidor.
6. Todo mensaje de error visible está en español y no expone internos
   (`11_confianza_errores_y_reversibilidad.md` §9).
7. Ninguna ruta confía en el cliente para determinar de quién son los datos.

## 3. Envelope

Se conserva el implementado en `src/app/api/_lib/http.ts`, con una
ampliación en `meta`.

**Éxito:**

```jsonc
{
  "ok": true,
  "data": { /* payload */ },
  "meta": {
    "trace_id": "0f9c...",
    "page": {                    // solo en listados
      "next_cursor": "eyJvIjoi...",
      "has_more": true,
      "limit": 25
    }
  }
}
```

**Error:**

```jsonc
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Falta el monto del movimiento.",
    "details": { "issues": [{ "path": "amount", "message": "Requerido" }] }
  },
  "meta": { "trace_id": "0f9c..." }
}
```

`trace_id` se toma de la cabecera `x-trace-id` si es un UUID válido; si no,
se genera. Se propaga a los registros del servidor y se muestra al usuario
en los errores no recuperables, para soporte.

## 4. Códigos de error

Se conservan los ocho existentes y se añaden dos:

| Código | HTTP | Cuándo |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Campos inválidos o incompletos |
| `AUTH_REQUIRED` | 401 | Sin sesión válida |
| `FORBIDDEN` | 403 | Con sesión, sin permiso sobre el recurso |
| `NOT_FOUND` | 404 | El recurso no existe o no es del usuario |
| `NOT_CONFIGURED` | 409 | Falta configuración previa (por ejemplo, sin cuentas) |
| `CONFLICT` | 409 | Choque de estado: duplicado, ya procesado, idempotencia |
| `CORE_REJECTED` | 422 | El Core rechazó la operación por una regla de dominio |
| `RATE_LIMITED` | 429 | **Nuevo.** Se superó el límite de peticiones |
| `PAYLOAD_TOO_LARGE` | 413 | **Nuevo.** Cuerpo o archivo demasiado grande |
| `INTERNAL_ERROR` | 500 | Fallo inesperado |

Regla heredada y correcta: el mensaje interno solo se expone cuando
`APP_ENV === "local"`. En producción se devuelve el mensaje genérico y el
detalle queda en los registros con su `trace_id`.

## 5. Paginación por cursor

**El cambio más importante de este documento.** Se elimina la paginación por
`limit` suelto.

```http
GET /api/v1/movements?limit=25&cursor=eyJvIjoiMjAyNi0wNy0xNCIsImkiOiJhYmMifQ
```

| Parámetro | Regla |
|---|---|
| `limit` | Por defecto 25, máximo 100. Un valor mayor se recorta, no da error. |
| `cursor` | Opaco para el cliente. Codifica el valor de orden y el `id` del último elemento. |

Respuesta: `meta.page.next_cursor` (null si no hay más) y
`meta.page.has_more`.

Por qué cursor y no `offset`: con `offset`, insertar un movimiento mientras
el usuario pagina desplaza los resultados y repite o salta filas. En una app
donde llegan movimientos por correo en segundo plano, eso ocurre de verdad.

**Orden estable obligatorio.** Todo listado ordena por un campo con
desempate por `id`, para que el cursor sea determinista:

```sql
order by occurred_at desc, id desc
```

Ningún endpoint devuelve el total de elementos por defecto: contar toda la
tabla en cada página es caro y casi nunca se usa. Cuando la interfaz lo
necesita, se pide con `include_total=true` y se devuelve en `meta.page.total`.

## 6. Filtros, orden y búsqueda

Se aplican **siempre en el servidor**. Nunca se descarga un conjunto para
filtrarlo en el cliente.

Filtros comunes a los listados:

| Parámetro | Tipo | Ejemplo |
|---|---|---|
| `q` | texto libre | `q=netflix` |
| `from`, `to` | fecha ISO | `from=2026-07-01&to=2026-07-31` |
| `status` | enum, repetible | `status=confirmed&status=needs_review` |
| `order` | campo y dirección | `order=occurred_at.desc` |

Filtros específicos de movimientos: `type`, `category_id`,
`subcategory_id`, `account_id`, `box_id`, `debt_id`, `tag`, `source`,
`amount_min`, `amount_max`.

Reglas:

- Un filtro desconocido devuelve `VALIDATION_ERROR`; no se ignora en
  silencio, porque un filtro ignorado muestra datos que el usuario cree
  filtrados.
- Los valores se validan contra los enums canónicos.
- `order` solo acepta campos de una lista blanca por endpoint.
- Los filtros de la URL de la interfaz se traducen uno a uno a estos
  parámetros (`10_sitemap_rutas_y_navegacion.md` §3.3).

## 7. Idempotencia

Toda escritura que cree o modifique dinero exige la cabecera
`Idempotency-Key` de al menos 8 caracteres.

```http
POST /api/v1/movements
Idempotency-Key: 5f2b9c1e-...
```

Comportamiento: si la clave ya existe para ese usuario, se devuelve el
resultado original con HTTP 200 y `meta.idempotent_replay: true`. No se crea
un duplicado ni se devuelve error.

Ya está implementado para movimientos y para el pago de deudas. Se extiende
a: creación de deudas (la migración `043` ya añadió la columna), confirmación
de pendientes, confirmación de lotes de importación, ejecución de acciones
del asistente y cambios de preferencias (la migración `045` ya lo contempla).

## 8. Límite de peticiones

No existe hoy. Se define por familia de operación, con ventana deslizante
por usuario:

| Familia | Límite |
|---|---|
| Lecturas | 300 por minuto |
| Escrituras financieras | 60 por minuto |
| Asistente (turnos de conversación) | 20 por minuto |
| Importación de archivos | 5 por hora |
| Exportación completa de datos | 3 por hora |
| Autenticación (intentos de acceso) | 10 por 15 minutos, por correo y por IP |
| Recuperación de contraseña | 5 por hora, por correo |

Respuesta al superarlo: `429` con `RATE_LIMITED`, cabecera `Retry-After`, y
mensaje en español que dice cuándo reintentar. Los límites de autenticación
no revelan si el correo existe.

## 9. Protección CSRF y cabeceras

- Las escrituras autenticadas por cookie verifican el origen: `Origin` o
  `Referer` debe coincidir con el dominio de la aplicación.
- Las peticiones con `Authorization: Bearer` no requieren esta verificación,
  porque no se envían automáticamente por el navegador.
- Cookies de sesión: `HttpOnly`, `Secure`, `SameSite=Lax`.
- Cabeceras de respuesta: `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, y Content Security
  Policy definida en `54_plan_de_implementacion_web.md`.
- Ningún dato personal viaja en la query string de una URL que pueda quedar
  en registros o historiales compartidos.

## 10. Familias de endpoints

Cada módulo detalla los suyos en su §10. Aquí queda el mapa y la forma.

| Familia | Base | Notas |
|---|---|---|
| Movimientos | `/api/v1/movements` | Listado con cursor, detalle, crear, actualizar, eliminar, restaurar, lote |
| Pendientes | `/api/v1/pending` | Listado, detalle, confirmar, descartar, confirmar en lote |
| Cuentas y cajas | `/api/v1/accounts`, `/api/v1/boxes` | CRUD y acciones de dinero |
| Resumen | `/api/v1/summary` | Dinero libre y desglose de las 4 capas |
| Categorías | `/api/v1/categories`, `/subcategories`, `/tags` | Catálogo y personalización |
| Deudas | `/api/v1/debts` | CRUD, pagos, cuotas, personas relacionadas |
| Recurrentes | `/api/v1/recurring` | Reglas, ocurrencias, candidatos |
| Presupuestos | `/api/v1/budgets`, `/api/v1/goals` | **Nuevo** |
| Proyecciones | `/api/v1/projections`, `/api/v1/simulate` | **Nuevo**, solo lectura y cálculo |
| Reportes | `/api/v1/reports`, `/api/v1/exports` | **Nuevo** |
| Descubrimientos | `/api/v1/insights` | Listado, detalle, evidencia, acciones |
| Memoria | `/api/v1/memory` | Ver, corregir, olvidar |
| Importación | `/api/v1/imports` | **Nuevo**: previsualizar, confirmar, deshacer |
| Asistente | `/api/v1/assistant` | **Nuevo**: hilos, turnos, confirmar acción |
| Notificaciones | `/api/v1/notifications` | **Nuevo**: bandeja in-app |
| Correo | `/api/v1/email` | Conexión, fuentes, estado, historial |
| Preferencias | `/api/v1/preferences` | Experiencia, privacidad, recordatorios |
| Privacidad | `/api/v1/privacy` | Exportar todo, eliminar cuenta |
| Búsqueda | `/api/v1/search` | Estructurada y natural, solo lectura |

## 11. Contrato de escritura financiera

Toda ruta que escriba dinero sigue exactamente esta secuencia:

```text
1. Autenticar            → sin sesión, 401
2. Validar con Zod       → inválido, 400 con el detalle del campo
3. Comprobar idempotencia→ ya procesado, 200 con el resultado original
4. Detectar duplicados   → sospecha, 409 con requires_confirmation
5. Llamar al Core        → CommandDispatcher, nunca SQL directo
6. Traducir CoreError    → 404 / 409 / 422 según el código
7. Responder             → envelope con trace_id
```

El paso 4 ya está implementado en movimientos y devuelve
`requires_confirmation` para que la interfaz pregunte antes de duplicar.

## 12. El asistente y la API

El asistente **no tiene una ruta privilegiada**. Cuando propone una acción y
el usuario la confirma, la escritura entra por el mismo endpoint que usaría
un formulario, con las mismas validaciones, la misma idempotencia y el mismo
Core.

```text
POST /api/v1/assistant/turns          → propone (sin escribir nada)
POST /api/v1/movements                → ejecuta al confirmar el usuario
   Idempotency-Key: <de la propuesta>
   source: assistant_confirmed
```

Esto garantiza que ninguna ruta de escritura pueda saltarse una validación
solo porque el origen sea el asistente (`WEB-D013`).

## 13. Solo lectura, sin excepción

Los siguientes endpoints nunca escriben, aunque el usuario lo pida en
lenguaje natural:

- `/api/v1/search/natural`
- `/api/v1/projections`, `/api/v1/simulate`
- `/api/v1/reports`
- `/api/v1/summary`

Si una consulta natural expresa intención de escribir, la respuesta incluye
un enlace al flujo estructurado correspondiente y no ejecuta nada.

## 14. Versionado

`/api/v1` es estable. Cambios permitidos sin cambiar de versión: añadir
campos opcionales, añadir endpoints, añadir valores a un enum de salida.
Cambios que exigen `/api/v2`: eliminar o renombrar campos, cambiar tipos,
cambiar el significado de un valor existente, cambiar el envelope.

## 15. Criterios de aceptación

- `AC-API-01` — Todo listado devuelve `next_cursor` y `has_more`, y permite
  recorrer el conjunto completo. Evidencia: `TEST`.
- `AC-API-02` — Ningún endpoint de listado devuelve más de 100 elementos.
  Evidencia: `TEST`.
- `AC-API-03` — Los filtros se aplican en el servidor; ningún cliente
  descarga un conjunto para filtrarlo. Evidencia: `CODE` + `TEST`.
- `AC-API-04` — Un filtro desconocido devuelve `VALIDATION_ERROR` en vez de
  ignorarse. Evidencia: `TEST`.
- `AC-API-05` — Repetir una escritura con la misma `Idempotency-Key` no crea
  duplicados y devuelve el resultado original. Evidencia: `TEST`.
- `AC-API-06` — Superar el límite devuelve 429 con `Retry-After` y mensaje en
  español. Evidencia: `TEST`.
- `AC-API-07` — Una escritura por cookie desde otro origen es rechazada.
  Evidencia: `TEST`.
- `AC-API-08` — Ningún mensaje de error en producción expone detalles
  internos, SQL ni mensajes de proveedor. Evidencia: `TEST`.
- `AC-API-09` — Las escrituras del asistente pasan por los mismos endpoints
  y validaciones que los formularios. Evidencia: `TEST`.
- `AC-API-10` — Los endpoints de solo lectura no escriben bajo ninguna
  entrada. Evidencia: `TEST`.
