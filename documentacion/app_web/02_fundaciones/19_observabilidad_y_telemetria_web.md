# 19 — Observabilidad y telemetría

**Bloque:** 02 — Fundaciones
**Estado:** V1
**Fecha:** 25 de julio de 2026
**Depende de:** `14_contratos_api_web.md`, `15_seguridad_autorizacion_y_rls.md`
**Documentos que dependen de este:** §16 de todos los módulos, `50_matriz_de_trazabilidad_web.md`
**Fuentes:** `docs/fase_4_tecnica/17_eventos_workers.md`, `docs/fase_4_tecnica/25_scheduler_externo_v1.md`

---

## 1. Para qué existe

Sin observabilidad no se puede responder a tres preguntas que van a
aparecer el primer día con usuarios reales: ¿por qué a este usuario le falló
el registro?, ¿está funcionando la detección por correo?, ¿la gente usa lo
que construimos?

Y una cuarta, específica de este proyecto: **¿el motor de IA está sirviendo
respuestas reales o degradadas?** El incidente documentado en
`docs/fase_4_tecnica/26_auditoria_captura_financiera_externa_v1.md` — donde
el extractor de correos heredó `local_fixture` en producción y el pipeline
se cerró sin crear pendientes ni escribir nada — ocurrió porque nadie podía
ver qué proveedor estaba activo.

## 2. Principios

1. **Todo se correlaciona con `trace_id`.** Del clic del usuario al registro
   del servidor, pasando por el Core y los workers.
2. **Nunca se registran datos financieros en claro.** Ni montos, ni nombres
   de personas, ni comercios, ni contenido de correos.
3. **Se mide lo que informa una decisión.** Una métrica que nadie va a mirar
   es ruido que cuesta dinero.
4. **La degradación silenciosa es un incidente**, no una advertencia.
5. **El usuario puede reportar un problema con contexto**, sin tener que
   describir lo que pasó.

## 3. Correlación con `trace_id`

Ya implementado y correcto: `src/app/api/_lib/http.ts` toma `x-trace-id` de
la cabecera si es un UUID válido, o genera uno, y lo devuelve en `meta`.

Se extiende de extremo a extremo:

```text
Cliente genera trace_id
  → cabecera x-trace-id en la petición
  → registro del servidor con trace_id
  → CommandDispatcher y Core lo propagan
  → transactional_outbox lo guarda en el evento
  → el worker que consume el evento lo conserva
  → si algo falla, el error del cliente lleva el mismo trace_id
```

El `trace_id` se muestra al usuario solo en errores no recuperables, para
que soporte pueda encontrar el caso sin pedirle que describa el problema.

## 4. Registros del servidor

Formato estructurado, nunca texto libre concatenado:

```jsonc
{
  "nivel": "error",
  "trace_id": "0f9c...",
  "user_id": "a1b2...",          // identificador, no datos personales
  "ruta": "/api/v1/movements",
  "metodo": "POST",
  "codigo": "CORE_REJECTED",
  "core_code": "MOVEMENT_REQUIRES_SPECIALIZED_ENGINE",
  "duracion_ms": 142,
  "ts": "2026-07-25T10:30:00Z"
}
```

### 4.1 Qué nunca se registra

| Prohibido | Alternativa |
|---|---|
| Montos | Rango o nada: `"rango": "100-500"` |
| Nombres de comercios | Solo el identificador de categoría |
| Nombres de personas relacionadas | Solo el identificador |
| Contenido o asunto de correos | Solo el identificador del mensaje y la institución |
| Texto de la conversación con el asistente | Solo el identificador del hilo y del mensaje |
| Tokens, contraseñas, claves | Nunca, en ningún nivel |
| Razonamiento interno del modelo | Nunca (regla heredada de privacidad) |

Regla operativa: si un campo pudiera avergonzar al usuario si alguien de
soporte lo leyera, no va al registro.

### 4.2 Niveles

| Nivel | Cuándo |
|---|---|
| `error` | Algo falló y el usuario lo notó |
| `warn` | Algo falló y el sistema se recuperó |
| `info` | Hecho de negocio relevante: movimiento creado, importación confirmada |
| `debug` | Solo en entorno local |

## 5. Eventos de producto

Miden si el producto funciona, no si el código funciona. Se emiten desde el
servidor cuando el hecho es de negocio, y desde el cliente cuando es de
interacción.

### 5.1 Convención

```text
<dominio>.<accion>        movimiento.creado · presupuesto.superado
```

Propiedades comunes: `user_id`, `trace_id`, `ts`, `origen` (`web`, `correo`,
`importacion`, `asistente`), y las específicas del evento — **nunca montos ni
descripciones**.

### 5.2 Catálogo mínimo por módulo

| Dominio | Eventos |
|---|---|
| Activación | `cuenta.creada`, `onboarding.paso_completado`, `onboarding.terminado`, `primer_movimiento.registrado` |
| Movimientos | `movimiento.creado`, `.editado`, `.eliminado`, `.restaurado`, `duplicado.advertido`, `duplicado.confirmado_igual` |
| Captura | `registro_rapido.usado`, `importacion.previsualizada`, `.confirmada`, `.deshecha`, `plantilla.usada` |
| Pendientes | `pendiente.creado`, `.confirmado`, `.descartado`, `.editado_antes_de_confirmar`, `lote.confirmado` |
| Correo | `correo.conectado`, `.desconectado`, `deteccion.creada`, `deteccion.confirmada`, `contexto.aportado` |
| Dinero | `cuenta.creada`, `caja.creada`, `desglose.consultado` |
| Presupuestos | `presupuesto.creado`, `.superado`, `.ajustado`, `meta.creada`, `.alcanzada` |
| Proyecciones | `proyeccion.vista`, `simulacion.ejecutada`, `puedo_permitirme.consultado` |
| Descubrimientos | `descubrimiento.mostrado`, `.abierto`, `.util`, `.no_util`, `evidencia.consultada` |
| Memoria | `memoria.consultada`, `aprendizaje.corregido`, `aprendizaje.olvidado` |
| Asistente | `asistente.turno`, `accion.propuesta`, `accion.confirmada`, `accion.descartada`, `respuesta.degradada` |
| Recordatorios | `recordatorio.enviado`, `.abierto`, `.accionado`, `.silenciado`, `canal.desactivado` |
| Confianza | `explicacion.consultada`, `correccion.realizada`, `deshacer.usado` |

### 5.3 Las métricas que importan

Derivadas de las condiciones de verdad de `06_tesis_app_web.md` §8:

| Pregunta | Métrica |
|---|---|
| ¿El usuario obtiene valor el primer día? | Porcentaje que registra o importa algo en su primera sesión |
| ¿Registrar cuesta poco? | Tiempo desde abrir el formulario hasta guardar; proporción de uso de cada vía de captura |
| ¿Se confía en los datos? | Frecuencia de consulta de explicaciones; correcciones por cada 100 movimientos |
| ¿La detección por correo sirve? | Proporción de detecciones confirmadas frente a descartadas |
| ¿El asistente ayuda? | Turnos que terminan en acción confirmada; proporción de respuestas degradadas |
| ¿Los recordatorios molestan? | Tasa de silenciado y de desactivación de canal |
| ¿La gente vuelve? | Retorno a 7 y a 30 días, por perfil de uso |

La segunda columna de la última fila —"por perfil de uso"— importa porque el
uso parcial es válido: alguien que solo usa deudas y vuelve cada semana es un
usuario retenido, aunque no registre gastos.

## 6. Salud del sistema

| Qué se vigila | Umbral de alerta |
|---|---|
| Cola del outbox | Eventos sin publicar con más de 5 minutos |
| Workers | Ejecución fallida o ausente en su ventana esperada |
| Detección por correo | Caída de la tasa de éxito de extracción; renovación de suscripción vencida |
| Errores 5xx | Proporción por encima del umbral en una ventana móvil |
| Latencia de API | Percentil 95 por familia de endpoint |
| **Proveedor del motor IA** | **Cualquier componente sirviendo con `local_fixture` en producción** |

La última fila es la que faltaba y provocó el incidente del extractor de
correos. Se trata como incidente, no como advertencia
(`23_runtime_ia_modos_costo_y_degradacion.md`).

`worker_job_runs` ya existe y registra cada ejecución. Se aprovecha como
fuente de la vigilancia de workers en vez de construir algo nuevo.

## 7. Errores del cliente

Se capturan errores no controlados del navegador con: `trace_id`, ruta,
navegador, y una traza **sin datos del usuario**. Se descartan los errores
de extensiones del navegador y los de red del propio usuario, que no son
defectos del producto.

Ningún error del cliente incluye el contenido de un formulario.

## 8. Reportar un problema

El usuario puede reportar desde cualquier pantalla. El reporte adjunta
automáticamente: `trace_id` de la última operación, ruta actual, e
identificador de usuario. **No adjunta datos financieros.** Si el problema
los requiere, soporte los pide con consentimiento explícito.

Esto convierte "no me funciona" en un caso investigable sin obligar al
usuario a explicar lo que ya vivió.

## 9. Privacidad de la telemetría

- Los eventos de producto llevan identificador de usuario, no datos
  personales.
- El usuario puede desactivar la telemetría de producto; la de errores y la
  operativa se mantienen, porque son necesarias para el servicio, y así se
  declara.
- Retención: eventos de producto 12 meses, registros de error 90 días,
  registros de acceso 30 días.
- La exportación completa de datos del usuario incluye sus eventos de
  producto (`45_configuracion_privacidad_y_control_de_datos.md`).
- Al eliminar la cuenta se eliminan también sus eventos.

## 10. Qué NO se hace

- No se instalan rastreadores de terceros con fines publicitarios.
- No se graban sesiones ni movimientos del cursor sobre datos financieros.
- No se comparte telemetría con terceros con fines comerciales.
- No se usa la telemetría para perfilado crediticio ni para segmentación
  publicitaria (compromiso de `06_tesis_app_web.md` §4).

## 11. Criterios de aceptación

- `AC-OBS-01` — Toda petición tiene `trace_id` correlacionable de extremo a
  extremo, incluidos los workers. Evidencia: `TEST` + `LIVE`.
- `AC-OBS-02` — Ningún registro contiene montos, nombres de personas,
  comercios ni contenido de correos. Evidencia: `TEST` + `LIVE`.
- `AC-OBS-03` — Existe alerta activa si algún componente del motor IA sirve
  con `local_fixture` en producción. Evidencia: `LIVE`.
- `AC-OBS-04` — Cada módulo emite al menos los eventos de su fila en §5.2.
  Evidencia: `CODE`.
- `AC-OBS-05` — El usuario puede reportar un problema y el reporte incluye
  `trace_id` sin datos financieros. Evidencia: `TEST` + `USER`.
- `AC-OBS-06` — La telemetría de producto se puede desactivar y la app sigue
  funcionando igual. Evidencia: `TEST`.
- `AC-OBS-07` — La exportación de datos incluye los eventos de producto del
  usuario. Evidencia: `TEST`.
- `AC-OBS-08` — Eliminar la cuenta elimina sus eventos de telemetría.
  Evidencia: `TEST`.
