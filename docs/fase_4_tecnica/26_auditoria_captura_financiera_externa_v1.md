# 26 - Auditoria Integral De Captura Financiera Externa V1

**Estado:** V1.2 - Agente extractor controlado incorporado; Gate F externo  
**Fecha:** 23 de julio, 2026  
**Alcance auditado:** documentacion raiz, Fases 1 a 6, handoff Stitch, codigo `src/`, migraciones y estado productivo sanitizado  
**Fuente viva de implementacion:** `23b_seguimiento_construccion_v1.md`

---

## 1. Proposito

Esta auditoria evita reducir la captura financiera externa a un parche para
Yape o BCP.

La capacidad documentada es:

```text
fuente financiera compatible
  -> proveedor oficial y permiso explicito
  -> filtro deterministico de remitente
  -> contexto/template institucional versionado
  -> EmailExtractionAgent sin tools ni autoridad financiera
  -> grounding deterministico por campo
  -> normalizacion semantica
  -> deduplicacion cross-channel
  -> Pending Inbox
  -> confirmacion humana
  -> motor de dominio especializado cuando corresponda
  -> Core + outbox + trazabilidad
```

En V1, la entrada externa aprobada es Gmail API + Pub/Sub detras de
`EmailAdapter`. No es una integracion bancaria directa y no autoriza
open banking, scraping, passwords, app passwords, IMAP, forwarding, OCR,
adjuntos ni auto-registro.

### 1.1 Decision complementaria: quien extrae y quien decide

La extraccion flexible del asunto/cuerpo pertenece a
`EmailExtractionAgent`. No se crea un agente hardcodeado por Yape, BCP u otra
marca; el mismo agente recibe contexto institucional versionado despues del
filtro deterministico de remitente.

Su autoridad termina al producir Structured Output con evidencia textual
literal. No recibe IDs internos, no usa tools, no consulta DB, no deduplica, no
crea Pendientes, no confirma y no llama al Core. Un validador deterministico
rechaza campos sin grounding; despues, los motores existentes resuelven
cuenta/deuda/recurrente/transferencia, deduplican y crean como maximo un
Pendiente para confirmacion humana.

Los templates permanecen como control operacional de sender, subject,
institucion, version, shadow/active, rollback y aliases. El parser
deterministico permanece como fallback seguro, no como fuente primaria cuando
el agente esta habilitado.

---

## 2. Corpus Revisado

La revision previa al corte cubrio:

| Bloque | Documentos | Uso en esta auditoria |
|---|---|---|
| Raiz | `README.md`, roadmap, especificacion maestra, instrucciones del repo | Promesa de producto, precedencia documental y estado historico. |
| Fase 1 | `01` a `04` | Personas, captura imperfecta, calidad suficiente y valor local de Yape/WhatsApp. |
| Fase 2 | indice y `05a` a `05j` | Alcance funcional, email parsing, cuentas, clasificacion, deudas, recurrentes, dedup, nudges y calidad. |
| Fase 3 | indice y `10` a `18` | Confirmacion, confianza, errores, onboarding, Pendientes, batching, fuente y explicabilidad. |
| Fase 4 | indice y `06`, `15` a `25`, incluido `23b` completo | Arquitectura, datos, eventos, API, runtime, proveedores, plan y estado real. |
| Fase 5 | indice y `24` a `27` | Privacidad, retencion, costos, soporte, lanzamiento y legal operativo. |
| Fase 6 | indice y `28` a `33` | Estados visuales, modo discreto, Settings Gmail, detalle y batch de Pendientes. |
| Handoff | auditoria Stitch y design system recibido | Limites entre prototipo recibido y fuentes documentales vigentes. |
| Implementacion | `src/`, `scripts/`, `supabase/migrations`, estado remoto sanitizado | Diferencia entre contrato, codigo y operacion real. |

Regla de precedencia usada:

1. `20_decisiones_tecnicas.md` para decisiones no negociables.
2. `16_modelo_datos.md`, `17_eventos_workers.md`, `18_api_spec.md` y
   `19_agent_runtime_tools.md` para contratos tecnicos.
3. Fase 3 para experiencia y Fase 6 para expresion visual.
4. `23_plan_implementacion_v1.md` para la ruta base.
5. `23b_seguimiento_construccion_v1.md` para el estado construido real.

---

## 3. Contrato Vigente Consolidado

### 3.1 Seguridad financiera

- Email nunca crea un movimiento confirmado.
- Todo hallazgo externo crea, como maximo, un `pending_item`.
- Un Pendiente no afecta saldos, deudas, recurrentes, cajas, reportes ni
  insights financieros reales.
- La confirmacion debe terminar en el Core correcto.
- `gasto` e `ingreso` pueden usar el Core de movimientos.
- Transferencias, pagos de deuda, devoluciones, pagos recurrentes y otras
  acciones especializadas no pueden degradarse a un movimiento generico.
- Idempotencia, auditabilidad y outbox son obligatorios.

### 3.2 Proveedor y privacidad

- Gmail V1 usa OAuth oficial con `gmail.readonly`.
- El cuerpo se procesa en memoria y no se persiste por defecto.
- Remitentes no permitidos se ignoran antes de solicitar contenido.
- Los tokens se cifran y se eliminan al desconectar.
- Al desconectar, los Pendientes de email abiertos se archivan y los
  movimientos ya confirmados se conservan.
- El usuario debe poder entender el permiso, desconectar, borrar/exportar
  datos y activar modo discreto.

### 3.3 Parsers y fuentes

- La allowlist y los parsers viven en base de datos.
- Un cambio de template no requiere deploy.
- Cada template es versionado, desactivable y medible.
- La seleccion usa remitente + patron de asunto.
- Las reglas de extraccion deben conducir monto, moneda, fecha, direccion,
  comercio y pista de cuenta cuando existan.
- Si un remitente permitido cambia formato, se permite fallback generico de
  baja confianza; si no hay monto util, se registra solo metadata minimizada.
- Un remitente no se activa por una direccion copiada de la documentacion:
  requiere autenticacion DKIM/DMARC alineada, consentimiento versionado,
  shadow, metricas revisadas y monitoreo de la primera semana. No existe una
  cuota fija de muestras para que el agente pueda extraer.

### 3.4 Cobertura V1

La documentacion funcional define:

| Prioridad | Instituciones |
|---|---|
| P0 | Yape, BCP |
| P1 | Interbank, BBVA, Plin |
| P2 | Scotiabank |

El compromiso V1 documentado es P0 + P1. P2 queda preparado por el mismo
contrato, pero no es requisito de activacion V1.

La lista expresa cobertura de producto; no certifica remitentes ni formatos.
Cada activacion permanece bloqueada hasta tener evidencia real consentida.

### 3.5 Confirmacion y experiencia

- WhatsApp es el canal principal cuando hay opt-in, ventana y politica.
- Dashboard/Pendientes sostiene la confirmacion cuando WhatsApp no conviene.
- Backfill es de 30 dias, acotado y Dashboard-only.
- Maximo cinco confirmaciones individuales por hora, dos batches por dia y,
  con mas de diez Pendientes abiertos, solo batch/Dashboard.
- "Confirmar todos" aplica unicamente al lote visible y procesa cada elemento
  de forma individual e idempotente.
- El usuario puede confirmar, editar, rechazar o marcar "Ya lo registre".
- El detalle muestra fuente, fecha, campos editables, evidencia resumida y la
  frase de proteccion de saldo.
- El modo discreto oculta monto, comercio, persona, banco/cuenta y otros datos
  sensibles sin romper el flujo.

### 3.6 Calidad y operacion

Targets documentados:

| Metrica | Target |
|---|---|
| Parsing exitoso por institucion/semana | `>95%` |
| Emails permitidos procesados vs recibidos | `>98%` |
| Fallback generico | `<10%` |
| Push a pendiente/confirmacion | `<60 s` objetivo; alerta si p95 `>120 s` |
| Pendientes utiles confirmados | `>=85%` |
| Fallos silenciosos | `0` |

Tambien se requiere salud por template/version, `last_matched_at`, errores sin
contenido financiero, token/watch health, retries, dead letters, costos por
Pendiente confirmado y criterios de pausa.

---

## 4. Contradicciones Resueltas

| Contradiccion | Resolucion para construir |
|---|---|
| `03_analisis_competitivo.md` describe registro automatico por email. | Es contexto historico. Pierde frente a la especificacion maestra, `05d`, `20_decisiones_tecnicas.md`, Fase 4 y Fase 5: siempre Pending + confirmacion. |
| Fase 6 indica en un flujo que los Pendientes permanecen al desconectar, mientras `05d`, privacidad y Corte 28 los archivan. | Gana el contrato funcional/privacidad y la implementacion atomica vigente: archivar Pendientes abiertos, conservar confirmados. Fase 6 debe sincronizar el copy. |
| `16_modelo_datos.md` espera seeds para Yape, BCP, BBVA e Interbank, pero `05d` compromete tambien Plin en P1. | La cobertura V1 es P0 + P1, incluido Plin. No se crean seeds productivos sin muestras verificadas. |
| `05a_whatsapp.md` trata algunas confirmaciones de email como siempre activas, mientras privacidad/nudges exigen consentimiento para contacto externo. | Detectar y crear Pendiente depende del consentimiento Gmail; iniciar mensajes WhatsApp depende ademas del consentimiento del canal, ventana y politica. Dashboard sigue disponible. |
| README y estados internos de algunos specs muestran cortes o avances antiguos. | Son snapshots historicos. `23b` manda para estado construido y debe sincronizarse al cerrar cada gate. |

---

## 5. Estado Real Antes Del Corte 31

### 5.1 Implementado y verificado

- OAuth Gmail `gmail.readonly`.
- Token cifrado, watch, Pub/Sub OIDC, History y backfill acotado.
- Filtro exacto de remitente antes de leer contenido.
- Contenido solo en memoria.
- Persistencia idempotente de email + Pendiente + outbox.
- Dedup cross-channel contra movimientos confirmados.
- Desconexion con eliminacion de token y archivo de Pendientes email.
- Settings Gmail y Centro de Pendientes base.
- Confirmacion de `gasto`/`ingreso` por Core.

### 5.2 Brechas confirmadas en codigo

- `parser_config` se carga desde DB pero el parser no lo usa.
- No existe seleccion real por `subject_patterns`.
- El parser es un regex generico hardcodeado para `gasto`/`ingreso`.
- No existe fallback distinguible ni medido por template/institucion.
- No se actualiza `last_matched_at` ni salud del template.
- No hay metricas/SLO de parsing, latencia, fallback o fallos silenciosos.
- No existe corpus versionado de fixtures por institucion.
- No hay parsers productivos habilitados.
- No existe activacion P0/P1 validada con cinco muestras por institucion.
- No se resuelve cuenta por institucion/pista de cuenta.
- No se conecta el hallazgo a deudas/recurrentes/transferencias mediante el
  motor especializado correspondiente.
- La edicion visual del Pendiente solo cubre nombre, monto y categoria; falta
  fecha, moneda, cuenta y tipo.
- Falta la accion explicita "Ya lo registre".
- El batch actual confirma hasta 50 elementos cargados, no un lote visible con
  identidad y seleccion explicitas.
- Falta historial minimizado de emails procesados en Settings.

### 5.3 Estado remoto sanitizado

Al abrir el corte:

- una conexion Gmail real permanece con watch activo;
- existe un `email_message` fixture ya procesado;
- su Pendiente esta archivado;
- existen cero filas en `email_parse_templates`;
- no hay allowlist productiva activa.

Por lo tanto, Gmail esta conectado como transporte seguro, pero la captura
bancaria real permanece apagada.

---

## 6. Corte 31 - Captura Financiera Externa Por Email V1

### Objetivo

Cerrar la capacidad completa documentada de captura financiera externa por
email, con calidad medible y activacion institucional controlada, sin ampliar
V1 a open banking ni convertir parsers fixture en produccion.

### Gate A - Contrato de parser y corpus

- Schema versionado de `parser_config`.
- Matching por sender + subject.
- Reglas de extraccion desde DB, sin logica institucional hardcodeada.
- Fallback generico identificado como tal y de baja confianza.
- Validacion de regex/config para impedir templates invalidos.
- Fixtures sanitizados y golden tests por tipo de operacion.
- Versionamiento, muestra minima, estado de verificacion y rollback.

### Gate B - Semantica financiera

- Monto, moneda, fecha, direccion, comercio, institucion y pista de cuenta.
- Resolucion conservadora de cuenta.
- Deteccion/sugerencia de transferencia, deuda, devolucion y recurrente.
- Ambiguedad permanece en Pendientes.
- Ninguna accion especializada pasa por `CreateMovementCommand` generico.

### Gate C - Pending, Core y dedup

- Confirmar, editar, rechazar y "Ya lo registre".
- Batch visible/seleccionado con idempotencia por elemento.
- Confirmacion especializada llega al motor/Core correcto.
- Dedup intra-email y WhatsApp↔Email en ambas direcciones.
- Confirmacion doble no duplica efectos.

### Gate D - Canales y lifecycle

- Prompt transaccional por WhatsApp solo con consentimiento, ventana y politica.
- Rate limits, quiet hours, modo discreto y retries documentados.
- Backfill Dashboard-only y un unico resumen permitido.
- TTL, agrupacion y degradacion segura a Dashboard.

### Gate E - Operacion, privacidad y costos

- Metricas y health por institucion/template/version.
- Alertas por parse rate, fallback, latencia, watch, token y fallo silencioso.
- Logs sin cuerpo, monto, comercio, cuenta ni token.
- Historial minimizado visible al usuario.
- Desconexion, borrado/exportacion y retencion probados.
- Costo por email procesado y Pendiente confirmado instrumentable.

### Gate F - Activacion institucional

Por cada institucion P0/P1:

1. verificar remitente exacto y DKIM/DMARC alineados desde Gmail;
2. registrar consentimiento separado para procesamiento con IA;
3. habilitar contexto/template primero en modo shadow;
4. observar correos naturales sin crear Pendientes ni escrituras;
5. revisar grounding, fallback, falsos positivos y errores criticos;
6. exigir cero errores criticos, grounding >=99%, fallback <10% y rollback;
7. activar para cohorte minima;
8. monitorear una semana y conservar rollback inmediato.

Un rechazo de sender por DKIM/DMARC se observa por separado y no reduce la
precision del parser: el extractor nunca recibio ese correo. Si un rechazo de
autenticacion descarga contenido, omite una razon controlada o llega al agente,
el health se degrada inmediatamente.

No se usa una direccion de la documentacion como evidencia de produccion.

Evidencia disponible al 23 de julio de 2026:

- cuatro correos reales BCP fueron inspeccionados localmente con autorizacion
  del usuario y transformados en fixtures completamente sinteticos;
- el conjunto representa dos compras completadas, una transferencia entre
  cuentas propias y una compra rechazada;
- en la inspeccion inicial ningun cuerpo, valor real, direccion personal ni hash
  de los originales se incorporo al repositorio o se envio a un proveedor de IA;
- despues del consentimiento, el usuario autorizo explicitamente un backfill de
  los cuatro EML: sus cuerpos se procesaron transitoriamente con el runtime API,
  con reintentos tecnicos durante el hardening, pero no se persistieron en DB,
  repositorio, logs ni fixtures;
- el corpus sanitizado paso unit tests y un smoke real del runtime API;
- los cuatro headers coinciden en sender exacto, resultado emitido por
  `mx.google.com`, DKIM pass y DMARC pass alineados. Esto basta para configurar
  BCP en shadow; no basta para activarlo como soporte publico sin consentimiento
  versionado y metricas naturales revisadas.

---

## 7. Regla De Cierre

El Corte 31 no se considera completado por:

- tener Gmail conectado;
- insertar seeds;
- parsear un fixture;
- reconocer solo Yape o BCP;
- crear un Pendiente;
- pasar tests unitarios sin QA real;
- o habilitar templates sin autenticidad, consentimiento y metricas shadow.

Se cierra cuando Gates A a E pasan tests, migracion, RLS, typecheck, lint,
build y QA; y Gate F queda activado y medido para P0 + P1 o cada institucion
no activada queda declarada como bloqueo externo sin prometer soporte publico.

Direct open banking permanece fuera de V1 y requiere una decision tecnica,
legal y de producto separada.

---

## 8. Resultado Del Cierre Tecnico

El 23 de julio de 2026 quedaron implementados, migrados, desplegados y probados
los Gates A a E:

- parser `gmail_parser_v1` configurable y versionado, sin bancos hardcodeados;
- enriquecimiento financiero conservador y fallback trazable;
- confirmacion especializada para deuda, recurrente y transferencia;
- confirmacion/rechazo batch con seleccion explicita e idempotencia;
- dedup por provider ID, hash de contenido en 24 horas y reconciliacion
  WhatsApp-Email;
- backfill separado y exclusivo del Dashboard;
- health operacional con parse rate, fallback, p95, watch, token, eventos
  atascados, `failed`/`dead_letter`, uso de API y conversion;
- exportacion y eliminacion self-service con minimizacion de datos.

Las migraciones `034`, `035` y `036` estan aplicadas en produccion. La suite
final paso 729 tests en 134 archivos, typecheck, lint sin errores y build. Los
smokes HTTP reales cubrieron Gmail, Core especializado y privacidad; el QA
visual de produccion cubrio Settings, confirmacion segura de borrado y batch de
Pendientes sin ejecutar una accion financiera.

Ampliacion agentic controlada:

- `EmailExtractionAgent` es ahora el extractor primario cuando el runtime esta
  habilitado; los templates conservan allowlist, contexto, version y activacion;
- Structured Output estricto y grounding literal bloquean valores sin
  evidencia y contradicciones de estado, incluido un aviso rechazado presentado
  como completado;
- el agente corre tambien sobre templates `shadow`, pero ese camino nunca crea
  Pendiente, dedup ni movimiento;
- el corpus BCP sintetico paso el runtime API real sin tools ni fallback;
- la migracion `037_email_extraction_agent_health.sql` agrega tasas de exito,
  fallback, grounding y p95 sin persistir evidencia o contenido financiero;
- la validacion de cierre paso 741 tests en 135 archivos, typecheck, build y
  lint sin errores (dos warnings preexistentes fuera del corte).

Gate F sigue sin declarar soporte publico. BCP puede entrar en shadow porque su
sender y autenticacion Gmail fueron verificados, pero no pasa a `active` sin
consentimiento versionado, cero errores criticos, grounding >=99%, fallback
<10%, revision, cohorte minima y monitoreo semanal.

Tras habilitar el consentimiento versionado el 23 de julio, el primer mensaje
BCP evaluado desde History fue rechazado antes de descargar el cuerpo. El
diagnostico posterior mostro que Gmail reporta la identidad DKIM alineada en
`header.i`, mientras el verificador inicial solo leia `header.d`; no era un
fallo criptografico del correo. El parser ahora acepta ambas propiedades sin
dejar de exigir DKIM + DMARC pass alineados.

El backfill real autorizado clasifico correctamente dos compras completadas,
una transferencia interna entre cuentas propias y una compra rechazada, sin
tools ni escritura financiera. El grounding ahora soporta fechas textuales,
caracteres invisibles y reparacion literal deterministica; un campo opcional de
un aviso no completado se elimina si no puede fundamentarse de forma
inequivoca. La migracion `040_email_extraction_repair_health.sql` registra solo
conteos agregados, agrega tasas de reparacion/normalizacion al health y mantiene
BCP en `shadow`.

El cierre desplegado quedo READY como
`dpl_8UrBxHvEU2RYC7rFNC3ffcCUSREJ` bajo `https://manzana.website`; el health
publico posterior respondio HTTP 200 con estado `ok` y Supabase saludable. El
backfill autorizado se limito a los cuatro EML entregados: no se escaneo toda la
bandeja Gmail ni se reabrio por fuerza el evento productivo ya deduplicado. La
transferencia entre cuentas propias se conservo como `internal`, sin convertirla
en gasto o ingreso y sin escritura financiera.

La primera observacion natural posterior al fix autentico correctamente un nuevo
correo BCP y elevo `shadow_match_count` a 1. El aviso fue reconocido como
transferencia completada, pero el extractor habia heredado
`AGENT_RUNTIME_DEFAULT_PROVIDER=local_fixture` porque faltaba su override
especifico en Production; el grounding fallo y el pipeline cerro sin Pendiente
ni escritura. Se agrego
`AGENT_RUNTIME_EMAIL_EXTRACTION_AGENT_PROVIDER=api`, se desplego
`dpl_Hp2Rbg3CgXrVi9WHcNZHcmq6fBYg` y el health publico quedo saludable. La
siguiente observacion natural debe confirmar provider API y grounding antes de
aprobar Gate F.
