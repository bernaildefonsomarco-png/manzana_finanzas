# 46 — Notificaciones y correo saliente

**Bloque:** 06 — Transversales
**Alcance:** V1
**Fecha:** 26 de julio de 2026
**Docs fuente:** `37_modulo_recordatorios_in_app.md` (la política), `43_auth_y_cuenta.md` (los transaccionales), `45` (consentimientos), `docs/fase_2_estrategia/alcance_v1/05j_nudges.md` §9 y §10 (fatiga)
**Documentos que dependen de este:** `53` (deuda técnica), `54` (plan de implementación)

---

## 1. Tesis y qué NO es

En V1-web **el correo es el único canal que sale de la aplicación**. No hay
push, no hay SMS, no hay WhatsApp. Todo lo que Manzana pueda decirle a alguien
que no está mirando la pantalla, se lo dice por correo.

Eso concentra en un sitio una decisión que suele estar dispersa: **cuándo es
legítimo escribirle a una persona**. Y la respuesta de este documento tiene dos
mitades que no se parecen en nada, y que confundirlas es el error clásico:

| | **Transaccional** | **De notificación** |
|---|---|---|
| Qué es | Respuesta a algo que el usuario acaba de hacer | Aviso de algo que pasó sin él |
| Ejemplo | Confirma tu correo, tu descarga está lista | Tu cuota vence el 15 |
| ¿Opt-in? | **No**: lo pidió | **Sí, por tipo** (`RUL-NOTIF-04`) |
| ¿Horario silencioso? | **No** | **Sí** |
| ¿Baja? | No aplica: sin ella no funciona la cuenta | **Un clic** |
| Quién manda | `43` | `37` |

Tratar un transaccional como notificación deja al usuario sin poder confirmar
su correo. Tratar una notificación como transaccional es, literalmente, correo
no solicitado.

**Qué NO es:**

- **No decide qué se avisa.** Eso es `37`: los diez tipos, sus umbrales y su
  política. Aquí está **cómo sale y cómo llega**.
- **No es marketing.** No hay boletines, ni novedades de producto, ni
  campañas. No está fuera de V1: está prohibido (`RUL-MAIL-09`).
- **No es soporte.** El correo de contacto vive en `48`.

## 2. Alcance

| Nivel | Funcionalidad |
|---|---|
| **IN** | Correo transaccional (verificación, recuperación, cambio de correo, descarga lista). Correo de notificación por tipo, con opt-in (`37`). Plantillas con las reglas de contenido de `RUL-MAIL-05`. Baja en un clic desde cualquier correo. Entrega fiable: outbox, reintentos, idempotencia. Autenticación de dominio. Registro de lo enviado. |
| **V1.1** | Resumen semanal. Push del navegador. Correo en el idioma del sistema si algún día hay otro. |
| **FUERA** | SMS, WhatsApp (fase 2), boletines, novedades de producto, campañas, correo a terceros, seguimiento de apertura con píxel. |

## 3. Vocabulario

| Interno | Visible |
|---|---|
| `outbox`, `delivery`, `bounce` | — (**nunca visible**) |
| Correo transaccional | — (no se nombra: se manda) |
| Baja | "Dejar de recibir esto" |

Prohibido en un correo saliente, además de la lista de
`04_glosario_y_lenguaje_visible.md` §10: `notificación`, `alerta`, `no
responder a este correo`, `este es un mensaje automático`, y cualquier
exclamación.

El correo se escribe **como escribe Manzana**, no como escribe un sistema:

```text
Correcto:   Tu cuota de la laptop vence el viernes.
Incorrecto: ⚠️ ALERTA: Recordatorio de pago pendiente
Incorrecto: Este es un mensaje automático, no responda a este correo.
```

La tercera es la peor: dice que no hay nadie al otro lado justo cuando el
producto intenta parecer alguien.

## 4. Entidades y datos

### 4.1 Lo que ya existe

`nudge_deliveries` (migración `017`, ampliada en `053`) registra qué se
entregó, por qué canal y cuándo. Su `channel` ya admite `email`.

### 4.2 Migración `066` — cola de salida y entregabilidad

```sql
create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind email_kind not null,           -- transaccional | notificacion
  template text not null,
  subject text not null,
  idempotency_key text not null,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz null,
  status email_status not null,       -- pendiente | enviado | rebotado
                                      -- | fallido | descartado
  attempts smallint not null default 0,
  last_error text null,
  discard_reason text null,
  created_at timestamptz not null default now()
);

create unique index email_outbox_idem_idx
  on public.email_outbox (user_id, idempotency_key);

create index email_outbox_pending_idx
  on public.email_outbox (scheduled_for)
  where status = 'pendiente';
```

**No guarda el cuerpo del mensaje**, solo la plantilla y sus datos mínimos. Un
registro de correos enviados con su contenido sería una copia del estado
financiero del usuario en una tabla más.

`discard_reason` existe porque **descartar un correo es un resultado legítimo
y frecuente**: la causa se resolvió, el usuario apagó ese tipo, o la dirección
rebota. Sin él, un correo no enviado parece un fallo.

El único parcial sobre `idempotency_key` es lo que hace verificable
`RUL-MAIL-07`. Un correo duplicado es peor que un correo tarde.

### 4.3 Migración `066` — direcciones con problemas

```sql
create table if not exists public.email_suppressions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason suppression_reason not null,  -- rebote_duro | queja | baja_total
  detail text null,
  created_at timestamptz not null default now()
);
```

Una dirección que rebota de forma permanente o desde la que llega una queja
**deja de recibir**, y se le dice al usuario dentro de la aplicación
(`RUL-MAIL-08`). Seguir enviando a una dirección que rebota destruye la
reputación del dominio y con ella la entrega de todos los demás.

## 5. Reglas

**`RUL-MAIL-01` — Transaccional y notificación no comparten reglas**

La distinción de §1, hecha regla.

Los cuatro transaccionales de V1, todos de `43` y `35`:

| Correo | Cuándo | Opt-in |
|---|---|---|
| Confirma tu correo | Al registrarse y al reenviar | No |
| Recupera tu contraseña | Al pedirlo | No |
| Aviso de cambio de correo | A la dirección **antigua** | No |
| Tu descarga está lista | Al terminar una exportación | No |

Ninguno lleva enlace de baja, y es correcto: **sin ellos la cuenta no
funciona**. Lo que sí llevan es una línea que explica por qué llegaron.

Los de notificación son los diez tipos de `RUL-NOTIF-01`, cada uno con su
interruptor, todos apagados al crear la cuenta (`C-17`).

**`RUL-MAIL-02` — La preferencia se lee al enviar, no al encolar**

Ya decidido en `WEB-D073` y repetido aquí porque es donde se implementa:

```text
Al sacar un correo de la cola, y antes de entregarlo:
  1. ¿Sigue activo el tipo para este usuario?    si no → descartado
  2. ¿Sigue vigente la causa?                    si no → descartado
  3. ¿Está la dirección suprimida?               si sí → descartado
  4. ¿Estamos en horario silencioso?             si sí → reprogramar
  5. ¿Se pasó el límite diario?                  si sí → reprogramar
```

Los cinco se comprueban **en el envío**. Lo comprobado al encolar no vale:
entre encolar y enviar puede haber horas, y en ese hueco cabe que el usuario
apague el interruptor o pague la cuota.

**`RUL-MAIL-03` — Horario silencioso y límites, solo para notificaciones**

Heredado de `37` `RUL-NOTIF-05` y `RUL-NOTIF-01`:

- **22:00 a 08:00** en `America/Lima`, configurable.
- Lo que caería dentro **se difiere**, no se descarta.
- Varios diferidos **se agrupan en uno solo** al abrirse la ventana.
- Límites diarios por clase: 2 de vencimiento, 1 de acumulación, 1 cada 7
  días de ausencia.

**Los transaccionales ignoran las cinco reglas.** Pedir una recuperación de
contraseña a las once de la noche y recibirla a las ocho de la mañana sería
absurdo.

**`RUL-MAIL-04` — Baja en un clic, sin entrar en la cuenta**

Todo correo de notificación lleva un enlace de baja que funciona **con un solo
clic y sin iniciar sesión**, con un token firmado por usuario y tipo.

Al pulsarlo:

```text
Listo. Dejaré de escribirte cuando venza una cuota.

Sigues recibiendo:  pagos que vienen · presupuestos en su límite
                                        [Cambiar todo esto]
                                        [Dejar de recibir todos]
```

Tres cosas que importan:

- **Un clic, no un formulario.** Una baja que exige entrar es una baja que no
  se completa, y produce quejas de correo no deseado en vez de bajas.
- Se dice **qué sigue llegando**, para que quien solo quería quitar uno no
  crea que los quitó todos.
- "Dejar de recibir todos" está a la vista. Esconderlo es lo que convierte una
  molestia en una queja.

También se incluye la cabecera `List-Unsubscribe` con `One-Click`, que es lo
que hace que el botón de "cancelar suscripción" del cliente de correo funcione
de verdad. Sin ella, ese botón marca como spam.

**`RUL-MAIL-05` — Qué puede y qué no puede llevar un correo**

| Elemento | Regla |
|---|---|
| **Asunto** | **Nunca un monto ni una categoría** (`RUL-NOTIF-12`) |
| Cuerpo | El dato concreto, sí. Es el correo del usuario |
| Categorías sensibles | **No salen por correo**, ni con opt-in (`RUL-CONF-04`) |
| Enlaces | Solo a rutas internas de Manzana; el de baja es la excepción |
| Imágenes remotas | **Ninguna.** Sin logotipo cargado de un servidor |
| Píxel de seguimiento | **Prohibido** |
| Adjuntos | Ninguno. La exportación va por enlace firmado (`RUL-REP-13`) |
| Remitente | Dirección real del dominio, con `Reply-To` que llega a alguien |

Dos merecen explicación.

**Sin imágenes remotas ni píxel** no es solo privacidad: una imagen remota le
dice al servidor que la sirve cuándo y desde dónde se abrió el correo. Y como
efecto práctico, un correo sin imágenes se ve igual con las imágenes
bloqueadas, que es como lo tiene mucha gente.

**El asunto sin monto** es la regla que más cuesta mantener porque un asunto
específico funciona mejor. Funciona mejor y filtra datos financieros a la
pantalla de bloqueo de un teléfono que puede estar sobre una mesa.

**`RUL-MAIL-06` — El dominio se autentica, o no se envía**

SPF, DKIM y DMARC configurados antes del primer envío a un usuario real.

No es una tarea de infraestructura que se pueda dejar para después: **un
dominio sin autenticar acaba en spam**, y un correo de verificación en spam es
una cuenta perdida en el primer minuto (`44`).

Además:

- Remitente **del dominio propio**, nunca de un proveedor de terceros.
- `Reply-To` a una dirección que alguien lee.
- Versión en texto plano junto a la HTML.
- Se vigila la tasa de rebotes y de quejas; si sube, se para y se investiga.

**`RUL-MAIL-07` — Un correo duplicado es peor que un correo tarde**

Idempotencia por `(user_id, idempotency_key)`, donde la clave se compone del
tipo, el sujeto y el día:

```text
recordatorio · cuota:debt_31c#4 · 2026-07-26
```

Si el trabajo se reintenta, se cae a mitad o se ejecuta dos veces por un
despliegue, **el correo sale una vez**.

Recibir dos veces el mismo aviso es el defecto que más rápido hace que alguien
desactive un canal entero, porque sugiere que el sistema no se controla.

Los reintentos van con espera creciente, máximo **3 intentos**. Al tercer
fallo se marca `fallido` y **se avisa dentro de la aplicación** si era algo
que el usuario esperaba: una descarga lista cuyo correo no salió tiene que
verse en la bandeja de `37`.

**`RUL-MAIL-08` — Una dirección que rebota deja de recibir, y se dice**

| Situación | Qué pasa |
|---|---|
| Rebote transitorio | Se reintenta según `RUL-MAIL-07` |
| Rebote permanente | Se suprime la dirección y **se avisa en la aplicación** |
| Queja de correo no deseado | Se suprime **todo** para ese usuario, sin excepción |

El aviso en la aplicación es lo que evita el fallo silencioso: alguien que
cambió de correo deja de recibir avisos y no sabe por qué.

```text
No consigo escribirte a marco@ejemplo.com; los correos rebotan.
[Revisar mi correo]
```

Y una regla dura: **una queja de correo no deseado apaga todos los tipos, no
solo el que la provocó.** Quien marca un correo como spam está diciendo que no
quiere ninguno, y discutirlo con una preferencia granular es exactamente cómo
se pierde un dominio.

**`RUL-MAIL-09` — Prohibido el correo que no pidió**

No es alcance diferido: es prohibición.

- Sin boletines, sin novedades de producto, sin encuestas.
- Sin correos de reactivación más allá del tipo `sin_registrar` de `37`, que
  viene apagado y es de clase U (`WEB-D072`).
- Sin correos a terceros: **Manzana no escribe a las personas que aparecen en
  las deudas del usuario** (`31` §14.4).
- Sin compartir la dirección con nadie.

La tercera merece estar escrita aunque parezca obvia: el módulo de deudas
guarda nombres de personas, y un producto de cobranza es exactamente lo que
Manzana no es.

**`RUL-MAIL-10` — Alcance real del ciclo de vida en V1**

Cierre de la parte de `C-09` que corresponde aquí.

En V1-web, todo lo que sale del producto es:

1. Los cuatro transaccionales de `RUL-MAIL-01`.
2. Los diez tipos de notificación de `37`, apagados por defecto.

**Y nada más.** No hay secuencia de bienvenida, ni serie de activación, ni
recordatorios de configuración incompleta (`RUL-ONB-05`), ni reactivación por
inactividad más allá del tipo apagado.

El sistema de retención D1-D30 de `docs/fase_3_producto/15_retencion_lifecycle.md`
**se difiere a la fase 2** y se declara aquí para que conste que no se olvidó:
se decidió no hacerlo, porque un ciclo de vida por correo sin el canal
principal es una campaña, y las campañas están prohibidas por `RUL-MAIL-09`.

## 6. Superficies

El correo no tiene pantallas, pero sí superficies dentro de la aplicación.

| ID | Superficie | Ruta |
|---|---|---|
| `SCR-MAIL-01` | Preferencias por tipo | `/configuracion/recordatorios` (`37`) |
| `SCR-MAIL-02` | Baja en un clic | `/baja?t=<token>` |
| `SCR-MAIL-03` | Aviso de dirección con problemas | Componente, en el Inicio |
| `SCR-MAIL-04` | Historial de lo enviado | `/configuracion/recordatorios#enviados` |

### Plantilla de un correo de notificación

```text
De:      Manzana <hola@manzana.pe>
Asunto:  Tienes un pago esta semana

Hola,

Tu cuota de la laptop vence el viernes 15.
Son S/180.00 y no la veo apartada en ninguna caja.

  [Ver mis pagos]

Te escribo esto porque activaste los avisos de cuotas.
Dejar de recibirlos · Cambiar mis avisos
```

- El asunto no dice cuánto ni de qué (`RUL-MAIL-05`).
- **"Te escribo esto porque…"** aparece en todos. Un correo que no explica por
  qué llegó se percibe como no solicitado aunque no lo sea.
- Un botón, uno solo, a una ruta interna.
- Sin logotipo remoto, sin pie legal de cinco párrafos, sin redes sociales.

### `SCR-MAIL-04` — Historial

Lo que Manzana le ha escrito al usuario, con fecha, tipo y estado. Sirve para
responder "¿me avisaste?" con algo más que una impresión, y para que el
descartado sea visible: **"no te escribí porque ya lo habías pagado"** es
información útil.

## 7. Acciones

| ID | Acción | ¿Confirma? | Deshacer | Evento |
|---|---|---|---|---|
| `ACT-MAIL-01` | Activar el correo de un tipo | **Consentimiento** | Desactivando | `correo.tipo_activado` |
| `ACT-MAIL-02` | Desactivar el correo de un tipo | No | Activando | `correo.tipo_desactivado` |
| `ACT-MAIL-03` | Baja desde el correo | No | En configuración | `correo.baja_un_clic` |
| `ACT-MAIL-04` | Baja total desde el correo | **Sí** | En configuración | `correo.baja_total` |
| `ACT-MAIL-05` | Ver el historial | No | — | `correo.historial_visto` |
| `ACT-MAIL-06` | Corregir la dirección tras un rebote | No | Cambiándola | `cuenta.correo_cambiado` |

`ACT-MAIL-01` es `consentimiento` en el sentido de `40` §3: se registra en
`consent_events` con su versión y su fecha (`45` `RUL-CONF-05`).

## 8. API

| Método y ruta | Notas |
|---|---|
| `GET /email/preferences` · `PATCH` | Es la misma de `37`; se nombra aquí por completitud |
| `GET /baja` | Baja en un clic. **Sin sesión**, token firmado |
| `POST /baja/todos` | Baja total |
| `GET /email/history` | Lo enviado, por cursor |
| `POST /email/webhook` | Rebotes y quejas del proveedor. **Firma verificada** |

`POST /email/webhook` es la única ruta pública que escribe. Su firma se
verifica **antes de leer el cuerpo**: un webhook sin verificar es una vía para
que cualquiera suprima el correo de cualquier usuario.

El token de `/baja` incluye usuario, tipo y caducidad, y **solo puede dar de
baja**. No inicia sesión ni da acceso a nada: un enlace de correo que
autentica es un enlace que reenviado da acceso a la cuenta.

## 9. Permisos

- **Dos excepciones de service-role, en la lista blanca de `15` §4:** el
  trabajador que envía y el que procesa rebotes. Ninguno lee datos
  financieros: solo la cola y las preferencias.
- `email_outbox` y `email_suppressions` con RLS por `user_id`.
- El trabajador **compone el cuerpo en el momento del envío**, consultando lo
  mínimo. No hay cuerpos precompuestos esperando en una tabla.

## 10. Estados de datos

| Estado | Qué se muestra |
|---|---|
| **Sin ningún tipo activo** | La sección lo dice, sin insistir en activar |
| **Dirección suprimida por rebote** | `SCR-MAIL-03` en el Inicio, hasta corregirla |
| **Dirección suprimida por queja** | Se dice, y reactivar exige un paso explícito |
| **Correo fallido de algo esperado** | Aparece en la bandeja de `37` |
| **Sin historial** | "Todavía no te he escrito nada." |
| **En horario silencioso con algo diferido** | Se ve en el historial como programado |

## 11. Errores

| ID | Causa | Mensaje visible | Salida |
|---|---|---|---|
| `ERR-MAIL-01` | Token de baja caducado | "Ese enlace ya caducó, pero puedes cambiarlo desde tu cuenta." | Entrar |
| `ERR-MAIL-02` | Token de baja inválido | "Ese enlace no es válido." | Entrar |
| `ERR-MAIL-03` | Activar sin correo verificado | "Antes necesito confirmar tu correo." | Verificar |
| `ERR-MAIL-04` | Envío fallido tras 3 intentos | Dentro de la aplicación, no por correo | Ver en la bandeja |
| `ERR-MAIL-05` | Dirección suprimida | "No consigo escribirte; los correos rebotan." | Revisar el correo |

`ERR-MAIL-04` no se comunica por correo, obviamente. Se comunica dentro, que
es donde el usuario puede verlo.

## 12. Integración con el motor IA

### 12.1 Comandos que acepta

| Comando | Confirmación |
|---|---|
| `activar_correo_recordatorios` | **`consentimiento`** (ya en `40` §7.14) |
| `desactivar_correo_recordatorios` | `ninguna` |
| `cambiar_horario_silencioso` | `tarjeta` |

```text
"avísame por correo de las cuotas"     → activar, con tarjeta
"deja de escribirme"                   → desactivar todos, con tarjeta
"no me escribas de noche"              → horario silencioso
```

### 12.2 Lo que el motor NO puede hacer

- **Redactar y enviar un correo.** Las plantillas son fijas.
- Escribir a una dirección distinta de la del usuario.
- Activar un tipo sin tarjeta de consentimiento.
- Saltarse el horario silencioso ni los límites.
- **Enviar una exportación a ningún destino** (`WEB-D055`).

La primera es un límite duro y del mismo tipo que `WEB-D055`: un correo cuyo
contenido y destinatario decide un modelo es una vía de salida de datos
gobernada por texto.

## 13. Métricas

Eventos: `correo.encolado`, `.enviado`, `.diferido`, `.descartado`,
`.rebotado`, `.queja`, `.baja_un_clic`, `.baja_total`, `.tipo_activado`,
`.tipo_desactivado`, `.fallido`.

Sin contenido, sin asuntos, sin direcciones en claro.

| Métrica | Qué indica |
|---|---|
| **Tasa de entrega de transaccionales** | La más crítica: un correo de verificación que no llega es una cuenta perdida |
| Tiempo hasta la entrega del de verificación | Si el proveedor o el dominio fallan |
| **Tasa de quejas** | Por encima del 0,1% es un incidente, no una métrica |
| Tasa de rebotes | Salud de las direcciones |
| Bajas por tipo | Qué tipo molesta |
| Bajas totales | Si el volumen general es demasiado |
| Descartados por causa resuelta | Que `RUL-MAIL-02` funciona: correos que **no** se mandaron porque ya no hacían falta |
| Diferidos por horario | Si el horario por defecto es el bueno |

La séptima es la que mide la calidad del sistema en positivo: cada correo
descartado por causa resuelta es una molestia que no ocurrió.

**No se mide apertura.** Requeriría un píxel, y está prohibido
(`RUL-MAIL-05`). Se acepta la ceguera: se sabe qué se entregó y qué se pulsó,
no qué se abrió.

## 14. Accesibilidad

- **Versión en texto plano siempre**, junto a la HTML. No es un extra: hay
  quien lee el correo así.
- Estructura de encabezados real; sin maquetación por tablas anidadas.
- Contraste AA en el cuerpo, y legible sin cargar imágenes — que es
  automático, porque no hay imágenes.
- El botón es un enlace con texto que dice a dónde va, no "haz clic aquí".
- Tamaño de fuente mínimo 16px y ancho máximo cómodo.
- El enlace de baja **no es más pequeño ni más claro** que el resto del pie.
  Achicarlo es una forma de esconderlo.

## 15. Casos borde

1. **La causa se resuelve entre encolar y enviar.** Se descarta y se registra
   con su motivo (`RUL-MAIL-02`).
2. **El usuario apaga el tipo mientras el correo está en cola.** No se envía.
3. **Tres avisos diferidos por horario silencioso.** Se agrupan en uno solo al
   abrirse la ventana.
4. **Cambia su correo con avisos en cola.** Se envían a la dirección nueva;
   los transaccionales de cambio van a las dos (`RUL-AUTH-08`).
5. **Marca un correo como spam.** Se suprime todo, sin excepción, y se dice en
   la aplicación.
6. **Elimina su cuenta con correos en cola.** Se descartan y se borra la fila.
7. **El proveedor de correo se cae.** Los correos se acumulan en la cola con
   su `scheduled_for`; al volver, se comprueban las cinco condiciones antes de
   enviar, así que los que ya no aplican se descartan en vez de llegar tarde.
8. **Un aviso de categoría sensible.** No sale por correo ni con opt-in
   (`RUL-CONF-04`). Queda en la bandeja.
9. **Recuperación de contraseña a las 3 de la madrugada.** Se envía de
   inmediato: es transaccional (`RUL-MAIL-03`).
10. **Dos despliegues disparan el mismo trabajo.** La idempotencia garantiza
    un solo correo (`RUL-MAIL-07`).

El caso 7 es el que distingue una cola bien hecha: al recuperarse, la
tentación es vaciarla. Vaciarla manda avisos de cosas que el usuario ya
resolvió.

## 16. Criterios de aceptación

- `AC-MAIL-01` — Ningún correo de notificación se envía sin consentimiento
  registrado para ese tipo. Evidencia: `TEST`.
- `AC-MAIL-02` — Los transaccionales se envían sin opt-in y **sin horario
  silencioso**. Evidencia: `TEST`.
- `AC-MAIL-03` — Las cinco condiciones se comprueban **al enviar**, no al
  encolar. Evidencia: `CODE` + `TEST`.
- `AC-MAIL-04` — La baja funciona con **un clic y sin sesión**, y el token
  solo sirve para dar de baja. Evidencia: `TEST`.
- `AC-MAIL-05` — Todo correo de notificación incluye `List-Unsubscribe` con
  `One-Click`. Evidencia: `TEST`.
- `AC-MAIL-06` — Ningún asunto contiene un monto ni una categoría.
  Evidencia: `TEST`.
- `AC-MAIL-07` — Ningún correo contiene imágenes remotas ni píxel de
  seguimiento. Evidencia: `CODE` + `TEST`.
- `AC-MAIL-08` — Las categorías sensibles no salen por correo ni con opt-in.
  Evidencia: `TEST`.
- `AC-MAIL-09` — El envío es idempotente: un trabajo repetido no duplica.
  Evidencia: `TEST`.
- `AC-MAIL-10` — Una queja suprime **todos** los tipos para ese usuario.
  Evidencia: `TEST`.
- `AC-MAIL-11` — Una dirección suprimida se avisa dentro de la aplicación.
  Evidencia: `TEST` + `USER`.
- `AC-MAIL-12` — SPF, DKIM y DMARC están configurados antes del primer envío
  a un usuario real. Evidencia: `LIVE`.
- `AC-MAIL-13` — Todo correo lleva versión en texto plano.
  Evidencia: `TEST`.
- `AC-MAIL-14` — El motor no puede redactar un correo ni cambiar su
  destinatario. Evidencia: `CODE` + `TEST`.
- `AC-MAIL-15` — No existe ningún correo de marketing, boletín ni campaña.
  Evidencia: `CODE`.
- `AC-MAIL-16` — Manzana nunca escribe a una persona que no sea el usuario.
  Evidencia: `CODE` + `TEST`.
- `AC-MAIL-17` — El webhook verifica la firma antes de leer el cuerpo.
  Evidencia: `TEST`.
- `AC-MAIL-18` — Tras una caída, los correos cuya causa se resolvió se
  descartan en vez de enviarse tarde. Evidencia: `TEST`.

## 17. Fuera de alcance y puente a WhatsApp

**Diferido a V1.1:** resumen semanal, push del navegador.

**Prohibido, no diferido:** SMS, boletines, novedades de producto, campañas,
correo a terceros, píxel de seguimiento, y cualquier correo cuyo contenido o
destinatario decida el modelo.

Puente a WhatsApp: la fase 2 añade un canal, **no cambia las reglas**. El
consentimiento por tipo, el horario silencioso, los límites diarios, la
comprobación al enviar y la idempotencia son de la política, no del correo.

Lo que sí cambia es el peso de cada regla. En correo, un mensaje de más es
una molestia; en WhatsApp, es una intrusión en un espacio personal. Los
límites de `05j` §10.1 —máximo 2 no solicitados al día— están calibrados para
ese canal y se rescatan entonces (`37` §21).

Y una regla que se hereda sin discusión: **dar un número de teléfono no
autoriza a escribir a ese número.** Es lo mismo que `C-17` decidió para el
correo.

## 18. Trazabilidad

**Documentos consumidos:** `37` (la política de qué se avisa), `43` (los
transaccionales), `45` (consentimientos), y de `docs/` la lógica de fatiga y
horario silencioso de `05j_nudges.md` §9 y §10.

**Contradicciones:**

`C-17` — ya cerrada en `37` (`RUL-NOTIF-04`). Este documento la implementa en el
canal: la columna de correo empieza vacía y cada activación registra su
consentimiento.

`C-09` — *"Lifecycle V1 documentado vs. solo onboarding inicial + drafts."*
Se cierra aquí junto con `44`. `RUL-MAIL-10` declara el alcance real: cuatro
transaccionales y diez tipos apagados, **y nada más**. El sistema D1-D30 de
`15_retencion_lifecycle.md` se difiere a la fase 2, y la razón está escrita:
un ciclo de vida por correo sin el canal principal es una campaña, y las
campañas están prohibidas.

Declarar que algo **no se va a hacer y por qué** es lo que cierra la
contradicción; dejarlo como pendiente indefinido es lo que la mantenía abierta.

**Decisiones tomadas en este documento**, registradas en
`03_decisiones_producto_web.md`:

| Decisión | ID | Alternativa descartada | Razón |
|---|---|---|---|
| Transaccional y notificación no comparten reglas | `no_negociable` `WEB-D127` | Una sola política para todo el correo saliente | Tratar un transaccional como notificación deja al usuario sin poder confirmar su correo; tratar una notificación como transaccional es correo no solicitado |
| Baja en un clic, sin sesión, con `List-Unsubscribe` | `no_negociable` `WEB-D128` | Baja tras iniciar sesión | Una baja que exige entrar no se completa, y produce quejas de spam en vez de bajas. Sin la cabecera, el botón del cliente de correo marca como spam |
| Sin imágenes remotas ni píxel de seguimiento | `no_negociable` `WEB-D129` | Medir aperturas como todo el mundo | Una imagen remota informa a un servidor de cuándo y desde dónde se abrió el correo. Se acepta la ceguera: se sabe qué se entregó y qué se pulsó, no qué se abrió |
| Una queja apaga todos los tipos | `no_negociable` `WEB-D130` | Apagar solo el tipo que la provocó | Quien marca como spam está diciendo que no quiere ninguno. Discutirlo con una preferencia granular es cómo se pierde la reputación de un dominio |
| El ciclo de vida de V1 son cuatro transaccionales y diez tipos apagados | `aprobada_producto` `WEB-D131` | Portar el sistema de retención D1-D30 | Un ciclo de vida por correo sin el canal principal es una campaña, y están prohibidas. Declarar que no se hace y por qué es lo que cierra `C-09`; dejarlo pendiente es lo que la mantenía abierta |
| El motor no redacta ni dirige correos | `no_negociable` `WEB-D132` | Permitir componer el mensaje | Un correo cuyo contenido y destinatario decide un modelo es una vía de salida de datos gobernada por texto. Mismo criterio que `WEB-D055` |
