# 25 - Scheduler Externo V1

**Estado:** V1.0 - Decision operativa aprobada para outbox frecuente  
**Ultima actualizacion:** 5 de julio, 2026  
**Depende de:** `17_eventos_workers.md`, `18_api_spec.md`, `20_decisiones_tecnicas.md`, `23b_seguimiento_construccion_v1.md`  

---

## 1. Tesis

Manzana necesita que el `outbox_publisher` corra con frecuencia sin depender de
que un usuario abra WhatsApp o el Dashboard.

Para V1, la solucion mas equilibrada es:

```text
Scheduler externo
  -> llama endpoint interno protegido
  -> outbox_publisher publica eventos pending
  -> worker_job_runs audita la ejecucion
```

Esto evita meter una cola dedicada antes de tener volumen real y evita pagar
Vercel Pro solo por despertar un endpoint frecuente.

---

## 2. Que Cierra Esta Decision

Queda aprobado para V1:

- usar un scheduler externo para el outbox frecuente,
- mantener Vercel Cron diario para jobs lentos ya existentes,
- mantener `transactional_outbox` como fuente de verdad,
- no mover logica financiera al scheduler,
- no usar el scheduler para escribir movimientos, saldos, cajas o deudas,
- medir cada ejecucion en `worker_job_runs`.

No queda aprobado todavia:

- proveedor unico obligatorio de scheduler,
- cola dedicada tipo queue/worker permanente,
- UI admin de operaciones,
- alertas externas definitivas tipo Slack/email.

---

## 3. Contrato Del Scheduler

### Endpoint

```http
GET https://manzana.website/api/internal/workers/outbox?limit=25&include_snapshot=true
Authorization: Bearer <CRON_SECRET>
```

### Frecuencia V1

```text
Cada 1 minuto.
```

Si el volumen aumenta:

- bajar a 30 segundos solo con proveedor que soporte no solapamiento,
- subir `limit` de 25 a 50 o 100 antes de crear mas complejidad,
- pasar a cola dedicada solo si el backlog crece de forma sostenida.

### Timeout

```text
20 a 30 segundos.
```

### Reintentos Del Scheduler

Para V1:

- retry externo maximo: 1 intento adicional,
- delay sugerido: 30-60 segundos,
- no usar reintentos agresivos si el proveedor puede solapar ejecuciones.

La recuperacion principal vive en:

- `transactional_outbox.next_attempt_at`,
- `claim_outbox_events`,
- `mark_outbox_failed`,
- `worker_job_runs`,
- `outbox_replay`.

---

## 4. Proveedores Permitidos

El proveedor externo puede cambiar sin tocar Core si cumple:

- HTTPS con metodo `GET`,
- header custom `Authorization`,
- frecuencia de 1 minuto,
- timeout configurable,
- historial de ejecuciones,
- alerta por no-2xx o timeout,
- no expone secretos en logs publicos.

Ejemplos aceptables:

- cron-job externo simple con headers,
- Upstash QStash Scheduler,
- Trigger.dev schedule,
- Inngest cron,
- Cloudflare Worker Cron que llame el endpoint.

La regla importante no es la marca. La regla importante es que el scheduler
solo despierte un worker interno protegido.

---

## 5. Configuracion Exacta V1

Crear un job:

```text
Nombre:
Manzana Outbox Publisher

URL:
https://manzana.website/api/internal/workers/outbox?limit=25&include_snapshot=true

Metodo:
GET

Headers:
Authorization: Bearer <CRON_SECRET>

Frecuencia:
Cada 1 minuto

Timeout:
20-30 segundos

Retry:
0-1 retry

Alerta:
Si status HTTP no es 2xx o hay timeout
```

No poner secretos en query params.

Incorrecto:

```text
?secret=...
```

Correcto:

```text
Authorization: Bearer ...
```

---

## 6. Verificacion

### Readiness Local

```bash
npm run smoke:outbox:scheduler
```

Esto valida que existe URL y secreto, pero no ejecuta el worker.

### Smoke Real Controlado

```bash
npm run smoke:outbox:scheduler -- --run
```

Esto llama el endpoint real con `limit=1`.

Para probar con mas eventos:

```bash
npm run smoke:outbox:scheduler -- --run --limit=25
```

Salida esperada:

```json
{
  "ok": true,
  "mode": "run",
  "worker": "outbox_publisher",
  "trigger": "cron_get",
  "job_run_id": "...",
  "result": {
    "claimed": 0,
    "published": 0,
    "failed": 0,
    "skipped": 0
  }
}
```

`claimed` puede ser mayor que cero si habia eventos pendientes. Eso es correcto.

---

## 7. Operacion Diaria

### Senales Buenas

- `worker_job_runs.status = succeeded`.
- `transactional_outbox.pending` baja o se mantiene pequeno.
- `failed` y `dead_letter` no crecen.
- `oldest_pending_lag_seconds` no crece sostenidamente.

### Senales De Alerta

- muchos `worker_job_runs.status = failed`,
- `dead_letter > 0`,
- lag alto durante varios minutos,
- errores repetidos del mismo `event_type`,
- el scheduler deja de ejecutar.

### Respuesta Operativa

1. Revisar ultimo `worker_job_runs`.
2. Revisar snapshot de outbox.
3. Si hay evento recuperable, usar `POST /api/internal/workers/outbox/replay`.
4. Si el fallo viene de un handler, corregir handler antes de reintentar en lote.

---

## 8. Que No Debe Hacer

El scheduler externo nunca debe:

- llamar endpoints publicos de usuario,
- llamar `CommandDispatcher` directamente,
- ejecutar SQL,
- usar `service_role`,
- confirmar pendientes,
- crear movimientos,
- recalcular saldos por su cuenta,
- enviar WhatsApp sin pasar por outbox/adapter/policy.

El scheduler solo despierta:

```text
outbox_publisher
```

---

## 9. Evolucion Futura

Pasar a cola/workers dedicados cuando ocurra alguno:

- backlog de outbox frecuente aun con `limit=100`,
- jobs tardan mas que el timeout razonable del scheduler,
- handlers de email/IA necesitan ejecuciones largas,
- se requiere concurrencia controlada por tipo de evento,
- se necesita observabilidad/alertas avanzadas por usuario/evento.

En ese momento:

```text
transactional_outbox
  -> queue
  -> worker dedicado
  -> worker_job_runs / traces
```

No debe cambiar el Core financiero.

---

## 10. Checklist De Cierre

- [ ] Elegir proveedor externo compatible.
- [ ] Crear job `Manzana Outbox Publisher`.
- [ ] Configurar URL exacta.
- [ ] Configurar header `Authorization`.
- [ ] Frecuencia 1 minuto.
- [ ] Timeout 20-30 segundos.
- [ ] Alerta por timeout/no-2xx.
- [ ] Ejecutar `npm run smoke:outbox:scheduler -- --run`.
- [ ] Confirmar `worker_job_runs` nuevo.
- [ ] Confirmar que `transactional_outbox` no acumula backlog.

---

*Fase 4 Tecnica - Documento 25 - Scheduler Externo V1*
