# 43 — Autenticación y cuenta

**Bloque:** 06 — Transversales
**Alcance:** V1
**Fecha:** 26 de julio de 2026
**Docs fuente:** `10_sitemap_rutas_y_navegacion.md` §3.1, `11_confianza_errores_y_reversibilidad.md`, `15_seguridad_autorizacion_y_rls.md`, `src/features/auth/auth-screen.tsx` (estado actual)
**Documentos que dependen de este:** `44` (onboarding), `45` (privacidad), `46` (correo saliente)

---

## 1. Tesis y qué NO es

La autenticación es la primera pantalla del producto y la única que **todo el
mundo ve antes de tener ninguna razón para confiar**. Un error en inglés, un
correo de verificación que no llega, o un "no puedo recuperar mi contraseña"
ocurren antes de que el usuario haya visto nada de valor, y son de las pocas
cosas que hacen abandonar sin volver.

Este documento cubre las seis piezas del ciclo —entrar, registrarse,
verificar, recuperar, cerrar sesión, eliminar la cuenta— y una que hoy no
existe: **`/auth/callback`**, sin la cual el OAuth de Supabase no puede
completar.

Sobre `C-13` hay que decir algo antes de nada, porque la lectura del código
lo corrigió: **la traducción de errores ya existe** en
`src/features/auth/auth-screen.tsx` y funciona. Lo que no funciona es **cómo**
traduce: por coincidencia de subcadenas sobre los mensajes en inglés del
proveedor. El día que Supabase cambie una palabra, el mensaje correcto se
convierte en el genérico sin que nadie se entere. El arreglo está en
`RUL-AUTH-05`, y no es traducir: es dejar de traducir.

**Qué NO es:**

- **No es multiusuario.** Una cuenta, una persona. Sin roles, sin
  organizaciones, sin invitar a nadie.
- **No es gestión de identidad.** No hay perfiles públicos ni nombre visible
  para otros: no hay otros.
- **No es la privacidad.** Qué se guarda, cómo se exporta y qué significa
  eliminar está en `45`; aquí está el mecanismo.

## 2. Alcance

| Nivel | Funcionalidad |
|---|---|
| **IN** | Registro con correo y contraseña. Inicio de sesión. Verificación de correo con reenvío. **Recuperación de contraseña.** **`/auth/callback`.** Cierre de sesión, en este dispositivo y en todos. Cambio de contraseña. Cambio de correo. Eliminación de cuenta. Todos los errores en español, mapeados por código. |
| **V1.1** | Entrar con Google. Segundo factor. Sesiones nombradas por dispositivo. |
| **FUERA** | Multiusuario, roles, organizaciones, invitaciones. Inicio de sesión con teléfono. Cuentas compartidas. |

Entrar con Google está en V1.1 y no en V1 por una razón concreta: el módulo
`28` ya pide permisos de Gmail, y mezclar "entrar con Google" con "dejar que
Manzana lea tus correos del banco" en el mismo flujo hace que el usuario no
sepa a qué está diciendo que sí. Se separan en el tiempo a propósito.

## 3. Vocabulario

| Interno | Visible |
|---|---|
| `session`, `token`, `refresh_token` | — (**nunca visible**) |
| `sign_in` | Entrar |
| `sign_up` | Crear cuenta |
| `email_confirmation` | Confirmar tu correo |
| `password_reset` | Recuperar tu contraseña |
| `sign_out` | Salir |
| `account_deletion` | Eliminar mi cuenta |

Prohibido frente al usuario: `auth`, `token`, `sesión expirada`,
`credenciales`, `autenticación`, `OAuth`, `callback`, `provider`, además de la
lista de `04_glosario_y_lenguaje_visible.md` §10.

```text
Correcto:   El correo o la contraseña no coinciden.
Correcto:   Pasó un rato sin actividad. Vuelve a entrar.
Incorrecto: Credenciales inválidas.
Incorrecto: Token expirado. Error 401.
```

## 4. Entidades y datos

### 4.1 Lo que gestiona Supabase

`auth.users` es de Supabase y **no se toca directamente**: correo, contraseña
cifrada, confirmación, sesiones y tokens.

### 4.2 Lo nuestro

`user_preferences` (migración `002`) y `profiles` cuelgan de `auth.users` con
`on delete cascade`. Eso es lo que hace que eliminar la cuenta elimine todo
sin un barrido manual.

### 4.3 Migración `064` — auditoría de cuenta

```sql
create table if not exists public.account_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind account_event_kind not null,   -- creada | verificada | clave_cambiada
                                      -- | clave_recuperada | correo_cambiado
                                      -- | sesiones_cerradas | eliminacion_solicitada
  ip_hash text null,
  user_agent_hash text null,
  created_at timestamptz not null default now()
);

create index on public.account_events (user_id, created_at desc);
```

**Se guardan hashes, no la IP ni el agente en claro.** Sirven para que el
usuario reconozca "esto fui yo" comparando, no para identificar el
dispositivo. Guardar la IP en claro sería recoger un dato de localización que
el producto no necesita.

`eliminacion_solicitada` se registra y **sobrevive al borrado en cascada**
porque el borrado es lo último: se escribe el evento, se anonimiza su
`user_id` a nulo, y luego se elimina el usuario. Es el único rastro que queda,
y existe para poder responder "sí, esta cuenta se eliminó el 26 de julio" si
alguna vez hace falta.

## 5. Máquina de estados

```text
   (nadie) ──registro──► sin verificar ──confirma──► activa
                              │                        │
                              │ caduca (7 días)        │ elimina
                              ▼                        ▼
                          expirada                 eliminada
                              │                    (irreversible)
                              └──reenvío──► sin verificar
```

| Estado | Puede |
|---|---|
| `sin verificar` | **Entrar y usar la aplicación**, con dos límites: no conectar correo y no recibir notificaciones |
| `activa` | Todo |
| `expirada` | Solo pedir un reenvío |
| `eliminada` | Nada. No existe |

**Que se pueda usar la aplicación sin verificar es una decisión**
(`RUL-AUTH-03`). Bloquear hasta confirmar pone un correo entre el usuario y su
primer movimiento, y el primer valor es lo que decide si vuelve (`44`).

## 6. Reglas de negocio

**`RUL-AUTH-01` — Nunca se revela si un correo tiene cuenta**

Ni al registrarse, ni al recuperar la contraseña, ni al entrar.

```text
Recuperar contraseña:
  Correcto:   Si ese correo tiene una cuenta, te mandé el enlace.
              Revisa tu bandeja y el spam.
  Incorrecto: No existe ninguna cuenta con ese correo.

Registro con correo ya usado:
  Correcto:   Ese correo ya tiene una cuenta. Prueba entrar con tu
              contraseña. [Entrar]  [Recuperar contraseña]
```

La asimetría entre los dos casos es deliberada y conviene explicarla, porque
parece una incoherencia. En el registro **el usuario ya demostró que quiere
esa dirección** y decírselo le ahorra un callejón sin salida; en la
recuperación, cualquiera puede escribir cualquier correo y la respuesta sería
un oráculo para averiguar quién usa Manzana.

El coste aceptado: alguien que se equivoca de correo al recuperar espera un
mensaje que no llega. Se mitiga diciendo "revisa el spam" y dejando reenviar.

**`RUL-AUTH-02` — La contraseña se valida por longitud, no por ceremonia**

Mínimo **8 caracteres**. Nada más: ni mayúscula obligatoria, ni número, ni
símbolo.

Las reglas de composición producen contraseñas peores —`Password1!` cumple
todas y es de las primeras que se prueban— y empujan a reutilizar. Se muestra
un indicador de fuerza **como información, sin bloquear**, y se permiten
frases largas.

Se comprueba contra la lista de contraseñas filtradas de Supabase si está
disponible, y si aparece **se avisa sin bloquear**: es información útil, y
convertirla en un muro deja fuera a gente por una lista que no controlamos.

**`RUL-AUTH-03` — Sin verificar se puede usar la aplicación**

Con dos límites, ambos por buenas razones:

| Bloqueado sin verificar | Por qué |
|---|---|
| Conectar un buzón (`28`) | OAuth exige una identidad confirmada |
| Recibir correo de recordatorios (`37`, `46`) | Escribir a una dirección no confirmada es enviar correo a quien no lo pidió |

Todo lo demás funciona. Un aviso discreto y persistente recuerda confirmar, y
**no es modal ni bloquea nada**.

Si a los 7 días sigue sin confirmar, el enlace caduca y se ofrece reenviar. La
cuenta no se borra: los datos que el usuario ya registró son suyos.

**`RUL-AUTH-04` — Todo enlace por correo es de un solo uso y caduca**

| Enlace | Caduca | Usos |
|---|---|---|
| Verificación de correo | 7 días | 1 |
| Recuperación de contraseña | **1 hora** | 1 |
| Cambio de correo | 1 hora | 1 |

Una hora para la recuperación y no un día porque es el enlace que, en manos de
otro, **da acceso a la cuenta entera**. Pedir otro cuesta un clic.

Usar un enlace ya usado o caducado **no es un error del usuario**: se dice qué
pasó y se ofrece pedir otro en la misma pantalla, sin volver a escribir el
correo.

**`RUL-AUTH-05` — Los errores se mapean por código, nunca por su texto**

La corrección real de `C-13`.

El código actual traduce buscando subcadenas en inglés:

```ts
if (message.includes("invalid login credentials")) { … }
if (message.includes("email not confirmed")) { … }
```

Funciona hoy y **falla en silencio el día que el proveedor cambie una
palabra**: el mensaje específico se convierte en el genérico y nadie se entera,
porque no hay error, solo una respuesta peor.

La regla:

1. Se mapea por el **código** del error del proveedor, no por su mensaje.
2. Cada código conocido tiene su `ERR-AUTH-` con mensaje en español y salida.
3. Un código **desconocido** produce el mensaje genérico **y emite una alerta
   de observabilidad** (`19`). Un error sin traducir es un defecto que hay que
   ver, no un caso normal.
4. **Nunca se muestra el mensaje del proveedor**, ni siquiera como detalle o
   entre paréntesis.

El punto 3 es lo que convierte esto en un sistema que se mantiene solo: si
Supabase añade un código, la alerta lo dice antes de que un usuario se queje.

**`RUL-AUTH-06` — Límite de intentos, y se dice cuánto falta**

| Acción | Límite |
|---|---|
| Intentos de entrar | 5 en 15 minutos, por correo y por IP |
| Recuperación de contraseña | 3 por hora y por correo |
| Reenvío de verificación | 3 por hora |
| Registro | 5 por hora y por IP |

Al alcanzarlo se dice **cuándo se puede volver a intentar**, con la hora, no
"inténtalo más tarde". Y nunca se bloquea la cuenta: se ralentiza el intento.
Bloquear una cuenta por intentos fallidos convierte un ataque en una
denegación de servicio contra su dueño.

**`RUL-AUTH-07` — Cambiar la contraseña cierra las demás sesiones**

Cambiarla o recuperarla invalida **todas las sesiones excepto la actual**, y
se dice:

```text
Contraseña cambiada. Cerré las sesiones abiertas en otros dispositivos.
```

Quien cambia su contraseña suele hacerlo porque sospecha algo. Cerrar solo la
suya sería lo contrario de lo que quería.

**`RUL-AUTH-08` — Cambiar el correo exige confirmar los dos**

Se envía a la dirección **nueva** para confirmarla y a la **antigua** para
avisar del cambio, con un enlace para revertirlo durante 24 horas.

El aviso a la antigua es lo que impide el secuestro silencioso: quien entre en
una sesión ajena y cambie el correo deja rastro en la bandeja del dueño.

**`RUL-AUTH-09` — La sesión caduca, y volver no pierde nada**

Duración: **30 días** con renovación por actividad; caducidad dura a los 90
días sin usar.

Al caducar durante el uso, se dice en lenguaje normal y **se vuelve a donde
estaba** tras entrar:

```text
Pasó un rato sin actividad. Vuelve a entrar y sigues donde estabas.
```

Si había un formulario a medias, **su contenido se conserva** y se restaura.
Perder un movimiento a medio escribir por una sesión caducada es exactamente
el momento en que alguien decide que la aplicación no es de fiar.

**`RUL-AUTH-10` — Eliminar la cuenta es inmediato e irreversible**

Sin periodo de gracia. Antes de ejecutarlo, tres salvaguardas:

1. **Se ofrece exportar** todos los datos (`35`, `RUL-REP-11`), y se espera a
   que termine si el usuario lo pide.
2. **Se enumera qué se pierde**, con cifras reales: "1.847 movimientos, 3
   deudas, 2 buzones conectados, 37 cosas aprendidas".
3. **Se escribe una palabra** para confirmar.

Y entonces se elimina de verdad: `auth.users` en cascada arrastra todas las
tablas, se revocan los tokens de Google, se borran los archivos de exportación
pendientes y se cierran las sesiones.

**Por qué sin periodo de gracia**, que es la práctica común: un periodo de
gracia significa que los datos que el usuario pidió borrar **siguen
existiendo**, y que "eliminé mi cuenta" es falso durante treinta días. El
coste aceptado es que un borrado por error no se puede deshacer; se compensa
con las tres salvaguardas, que son bastante más de lo que suele pedirse.

**`RUL-AUTH-11` — Cerrar sesión no borra nada del dispositivo que importe**

Salir limpia la sesión y las búsquedas recientes (`38`, `RUL-BUS-11`).
**No** limpia las preferencias de vista ni los borradores de formulario: son
del navegador y de esa persona, que va a volver.

Se ofrece además **"salir en todos los dispositivos"**, en un control aparte y
claramente distinto.

## 7. Validaciones

| Campo | Regla |
|---|---|
| Correo | Formato válido; normalizado a minúsculas; sin espacios |
| Contraseña | Mínimo 8 caracteres; máximo 200 |
| Contraseña nueva | Distinta de la actual |
| Palabra de confirmación de borrado | Exacta, sensible a mayúsculas: `ELIMINAR` |
| Token de enlace | Un solo uso; comprobado en el servidor |

## 8. Superficies

**Referencia visual: parcial.** `AUTH_LOGIN` existe en
`docs/fase_6_visual/30_app_flow.md`. Las pantallas de recuperación,
restablecimiento y `/auth/callback` son nuevas y no tienen frame.

| ID | Pantalla | Ruta |
|---|---|---|
| `SCR-AUTH-01` | Entrar | `/entrar` |
| `SCR-AUTH-02` | Crear cuenta | `/crear-cuenta` |
| `SCR-AUTH-03` | Confirmar correo | `/verificar` |
| `SCR-AUTH-04` | Recuperar contraseña | `/recuperar-clave` |
| `SCR-AUTH-05` | Definir contraseña nueva | `/restablecer-clave` |
| `SCR-AUTH-06` | Retorno de OAuth | `/auth/callback` |
| `SCR-AUTH-07` | Cuenta y seguridad | `/configuracion/perfil` |
| `SCR-AUTH-08` | Eliminar mi cuenta | `/configuracion/datos` |

### `SCR-AUTH-01` — Entrar

```text
┌──────────────────────────────────────┐
│ Manzana                              │
│                                      │
│ Correo    [                    ]     │
│ Clave     [                ] [👁]    │
│                                      │
│           [Entrar]                   │
│                                      │
│ ¿Olvidaste tu contraseña?            │
│ ¿No tienes cuenta? Crear una         │
└──────────────────────────────────────┘
```

- "¿Olvidaste tu contraseña?" **está visible desde el principio**, no aparece
  tras fallar. Quien la olvidó ya lo sabe antes de escribirla.
- El ojo muestra la contraseña. Sin él, una contraseña larga se escribe mal y
  el usuario concluye que no la recuerda.
- Sin enlaces a redes sociales ni a nada externo.

### `SCR-AUTH-06` — `/auth/callback`

Ruta que **hoy no existe** y sin la cual el OAuth de Supabase no puede
completar (`10` §3.1).

Intercambia el código por sesión en el **servidor**, nunca en el cliente, y
redirige:

| Situación | Destino |
|---|---|
| Éxito, con `next` válido | Esa ruta |
| Éxito, sin `next` | `/inicio` |
| Éxito, primera vez | `/bienvenida` (`44`) |
| Error | `/entrar` con `ERR-AUTH-` explicado |

**`next` se valida contra una lista de rutas internas.** Un parámetro de
redirección sin validar es una vulnerabilidad de redirección abierta, y en una
pantalla de autenticación es de las peores: el usuario acaba de escribir su
contraseña y confía en dónde le lleves.

### `SCR-AUTH-08` — Eliminar mi cuenta

```text
┌──────────────────────────────────────────────┐
│ Eliminar mi cuenta                           │
│                                              │
│ Esto no se puede deshacer.                   │
│                                              │
│ Vas a perder:                                │
│   1.847 movimientos                          │
│   3 deudas y su historial                    │
│   2 correos conectados                       │
│   37 cosas que aprendí sobre tu dinero       │
│   Todas tus conversaciones                   │
│                                              │
│ Antes, puedes llevarte todo:                 │
│   [Descargar mis datos]                      │
│                                              │
│ Escribe ELIMINAR para confirmar:             │
│   [                    ]                     │
│                                              │
│   [Eliminar mi cuenta]      [Cancelar]       │
│        (secundario)         (primario)       │
└──────────────────────────────────────────────┘
```

Las cifras son **reales, consultadas en ese momento**. Un texto genérico
—"todos tus datos"— no comunica nada; "1.847 movimientos" sí.

Jerarquía de botones según `WEB-D099`: el primario es cancelar.

## 9. Acciones

| ID | Acción | ¿Confirma? | Deshacer | Evento |
|---|---|---|---|---|
| `ACT-AUTH-01` | Entrar | No | Saliendo | `cuenta.sesion_iniciada` |
| `ACT-AUTH-02` | Crear cuenta | No | Eliminando | `cuenta.creada` |
| `ACT-AUTH-03` | Reenviar verificación | No | — | `cuenta.verificacion_reenviada` |
| `ACT-AUTH-04` | Confirmar correo | No | — | `cuenta.verificada` |
| `ACT-AUTH-05` | Pedir recuperación | No | — | `cuenta.recuperacion_solicitada` |
| `ACT-AUTH-06` | Definir contraseña nueva | No | Cambiándola | `cuenta.clave_cambiada` |
| `ACT-AUTH-07` | Cambiar contraseña | No | Cambiándola | `cuenta.clave_cambiada` |
| `ACT-AUTH-08` | Cambiar correo | **Sí** | 24 h desde el correo antiguo | `cuenta.correo_cambiado` |
| `ACT-AUTH-09` | Salir | No | Entrando | `cuenta.sesion_cerrada` |
| `ACT-AUTH-10` | Salir en todos los dispositivos | **Sí** | Entrando | `cuenta.sesiones_cerradas` |
| `ACT-AUTH-11` | **Eliminar la cuenta** | **Sí, escribiendo** | **No** | `cuenta.eliminada` |

`ACT-AUTH-11` es una de las dos acciones irreversibles del producto. La otra
es `ACT-MEM-11`, y las dos exigen escribir una palabra.

## 10. API

| Método y ruta | Notas |
|---|---|
| `POST /auth/sign-in` · `/sign-up` | Con límite de intentos |
| `POST /auth/sign-out` · `/sign-out-all` | |
| `POST /auth/resend-verification` | Idempotente por ventana |
| `POST /auth/request-reset` | **Responde igual exista o no la cuenta** |
| `POST /auth/reset` | Token de un solo uso |
| `PATCH /auth/password` · `/email` | Sesión activa obligatoria |
| `GET /auth/callback` | Intercambio en servidor; valida `next` |
| `DELETE /api/v1/privacy/account` | Ya existe. Exige confirmación en el cuerpo |
| `GET /auth/events` | Historial de `account_events` del usuario |

`POST /auth/request-reset` responde exactamente lo mismo —código, cuerpo y
**tiempo de respuesta**— exista o no la cuenta. Una diferencia de latencia es
un oráculo tan bueno como una diferencia de mensaje.

## 11. Permisos y RLS

- Las rutas de autenticación son públicas por necesidad; el resto exige
  sesión.
- **Una excepción de service-role, en la lista blanca de `15` §4:** la
  eliminación de cuenta, que necesita borrar de `auth.users`.
- `account_events` con RLS por `user_id`; solo lectura para el usuario.
- Cookies de sesión `httpOnly`, `secure`, `sameSite=lax`. **El token nunca
  llega a JavaScript del cliente.**
- La verificación de sesión ocurre en el servidor, en el layout autenticado.
  Nunca solo en el cliente: una comprobación de cliente esconde la interfaz,
  no protege los datos.

## 12. Estados de datos

| Estado | Qué se muestra |
|---|---|
| **Sin sesión en ruta privada** | Redirección a `/entrar` con `next` a donde iba |
| **Sesión caducada durante el uso** | Aviso, y al volver, la misma pantalla con el formulario conservado |
| **Sin verificar** | Banda discreta persistente, no modal, con reenviar |
| **Verificación caducada** | "Ese enlace ya caducó." + reenviar en la misma pantalla |
| **Enlace de recuperación usado** | "Ese enlace ya se usó." + pedir otro |
| **Límite de intentos** | La hora exacta a la que se puede reintentar |
| **Sin conexión al enviar** | El formulario **conserva lo escrito** y ofrece reintentar |
| **Cuenta recién eliminada** | Pantalla de despedida, sin formulario de recuperación |

## 13. Errores

Todos en español, mapeados **por código** (`RUL-AUTH-05`).

| ID | Código del proveedor | Mensaje visible | Salida |
|---|---|---|---|
| `ERR-AUTH-01` | `invalid_credentials` | "El correo o la contraseña no coinciden. Revísalos, o crea una cuenta si aún no tienes." | Reintentar · Recuperar · Crear cuenta |
| `ERR-AUTH-02` | `email_not_confirmed` | "Aún falta confirmar tu correo. Te reenvío el enlace si quieres." | Reenviar |
| `ERR-AUTH-03` | `user_already_exists` | "Ese correo ya tiene una cuenta." | Entrar · Recuperar |
| `ERR-AUTH-04` | `weak_password` | "Elige una contraseña de al menos 8 caracteres." | Corregir |
| `ERR-AUTH-05` | `over_request_rate_limit` | "Demasiados intentos seguidos. Prueba otra vez a las 14:32." | Esperar · Recuperar |
| `ERR-AUTH-06` | `otp_expired` | "Ese enlace ya caducó." | Pedir otro |
| `ERR-AUTH-07` | `otp_already_used` | "Ese enlace ya se usó." | Pedir otro · Entrar |
| `ERR-AUTH-08` | `session_expired` | "Pasó un rato sin actividad. Vuelve a entrar y sigues donde estabas." | Entrar |
| `ERR-AUTH-09` | `same_password` | "Esa es la contraseña que ya tienes." | Corregir |
| `ERR-AUTH-10` | `invalid_redirect` | "Ese enlace no es válido." | Ir al inicio |
| `ERR-AUTH-11` | Desconocido | "No pude completar eso ahora. Tus datos están a salvo; inténtalo de nuevo." | Reintentar |
| `ERR-AUTH-12` | Sin conexión | "Parece que no hay conexión. Lo que escribiste sigue aquí." | Reintentar |

`ERR-AUTH-11` **emite alerta de observabilidad**. Un error sin traducir no es
un caso normal: es un código nuevo del proveedor que hay que mapear.

`ERR-AUTH-01` no distingue entre correo inexistente y contraseña equivocada
(`RUL-AUTH-01`).

## 14. Integración con el motor IA

**Ninguna.** El asistente no participa en la autenticación, ni antes de haber
sesión ni después.

No es una omisión: es que **ninguna operación de este documento debería poder
originarse en texto libre**. Cambiar el correo, cerrar sesiones o eliminar la
cuenta por conversación abriría una vía de secuestro gobernada por
interpretación, exactamente lo que `WEB-D102` cierra en el otro sentido.

Si el usuario lo pide en la conversación, el asistente **lleva a la
pantalla**: es un bloque `mostrar`, no un comando.

```text
"cambia mi correo"     → mostrar: /configuracion/perfil
"borra mi cuenta"      → mostrar: /configuracion/datos
```

## 15. Memoria y aprendizaje

**Nada.** Este módulo no aprende: no genera aprendizajes clasificatorios, ni
hechos de perfil, ni preferencias (`RUL-MEM-01`).

Lo único que se registra es `account_events`, que es auditoría y no memoria:
no alimenta ninguna respuesta ni cambia ningún comportamiento.

## 16. Eventos y telemetría

Eventos: `cuenta.creada`, `.verificada`, `.verificacion_reenviada`,
`.sesion_iniciada`, `.sesion_cerrada`, `.sesiones_cerradas`,
`.recuperacion_solicitada`, `.clave_cambiada`, `.correo_cambiado`,
`.eliminada`, `.error_sin_traducir`.

**Sin correos, sin IP en claro, sin contraseñas obviamente.** Sí resultado,
código de error y `trace_id`.

| Métrica | Qué indica |
|---|---|
| Registros que llegan a verificar | Si el correo llega y se entiende |
| Tiempo hasta verificar | Si el correo tarda o va a spam |
| **Recuperaciones pedidas sobre inicios de sesión** | Si el flujo de entrada funciona |
| Recuperaciones completadas sobre pedidas | Si el enlace llega y funciona |
| **`error_sin_traducir`** | **Cualquier valor por encima de cero es un defecto**: un código del proveedor sin mapear |
| Sesiones caducadas durante el uso | Si 30 días es la duración correcta |
| Eliminaciones con exportación previa | Si la salvaguarda se usa |

La quinta es la métrica de salud de `C-13`. Que sea cero significa que la
traducción cubre lo que ocurre de verdad.

## 17. Rendimiento

- `/entrar` y `/crear-cuenta` **por debajo de 1 s hasta interactivo**. Son las
  únicas pantallas que se ven sin ninguna razón previa para esperar.
- Sin JavaScript pesado: los formularios funcionan como formularios.
- La comprobación de sesión del layout autenticado **no bloquea la
  renderización** de lo que no depende de ella.
- El correo de verificación se encola por el outbox transaccional, con
  reintentos. **Un correo de verificación que no llega es una cuenta perdida.**
- `account_events` se escribe fuera de la petición.

## 18. Accesibilidad

- Los formularios usan `<form>` real con `action`: funcionan sin JavaScript.
- Cada campo con `<label>` visible, nunca solo marcador de posición: el
  marcador desaparece al escribir y quien se distrae pierde la referencia.
- `autocomplete` correcto: `email`, `current-password`, `new-password`. Sin
  ellos los gestores de contraseñas no funcionan, y eso empuja a contraseñas
  peores.
- Los errores se asocian al campo con `aria-describedby` y se anuncian en
  `aria-live="assertive"` — es el único sitio del corpus donde `assertive` es
  correcto: el usuario acaba de actuar y espera respuesta.
- El botón de mostrar contraseña anuncia su estado.
- El indicador de fuerza se anuncia con palabras, no solo con color.
- El foco entra en el primer campo con error tras un envío fallido.

## 19. Casos borde

1. **Registro con un correo que ya existe sin verificar.** Se reenvía la
   verificación en vez de crear otra cuenta, y se dice.
2. **Recuperación de una cuenta sin verificar.** Funciona, y confirma el
   correo de paso: demostró que lo controla.
3. **Enlace de verificación abierto en otro navegador.** Funciona: verifica y
   pide entrar.
4. **Dos pestañas, se cierra sesión en una.** La otra lo detecta al siguiente
   fetch y muestra `ERR-AUTH-08` sin perder lo escrito.
5. **Cambio de correo a uno ya registrado.** Se rechaza sin decir de quién es
   (`RUL-AUTH-01`).
6. **Eliminar la cuenta con un buzón conectado.** Se revocan los tokens de
   Google **antes** de borrar. Si la revocación falla, se registra y el borrado
   continúa: no se puede retener la cuenta de alguien porque un tercero no
   responde.
7. **Eliminar con una exportación en curso.** Se cancela y se borra el archivo
   (`35` §19 caso 10).
8. **Reloj del dispositivo desfasado.** La validez del token la comprueba el
   servidor; el reloj del cliente no participa.
9. **Contraseña de 200 caracteres.** Válida. Los gestores generan largas.
10. **Correo con mayúsculas o alias con punto.** Se normaliza a minúsculas; los
    puntos **no** se normalizan (son significativos fuera de Gmail).
11. **Sesión caducada con un movimiento a medio escribir.** Se conserva y se
    restaura tras entrar (`RUL-AUTH-09`).
12. **`next` apuntando fuera del dominio.** Se ignora y se va a `/inicio`
    (`SCR-AUTH-06`).

El caso 6 es el que más fácil se implementa mal: encadenar el borrado a que un
servicio externo responda deja al usuario atrapado en una cuenta que pidió
eliminar.

## 20. Criterios de aceptación

- `AC-AUTH-01` — **Ningún mensaje del proveedor llega al usuario.** Todos se
  mapean por código. Cierra `C-13`. Evidencia: `CODE` + `TEST`.
- `AC-AUTH-02` — Un código desconocido produce el genérico **y emite alerta**.
  Evidencia: `TEST`.
- `AC-AUTH-03` — Todos los mensajes visibles están en español y tienen salida.
  Evidencia: `TEST` + `USER`.
- `AC-AUTH-04` — La recuperación responde igual —cuerpo, código y latencia—
  exista o no la cuenta. Evidencia: `TEST`.
- `AC-AUTH-05` — `/auth/callback` existe, intercambia en el servidor y valida
  `next` contra rutas internas. Evidencia: `TEST`.
- `AC-AUTH-06` — Los enlaces de recuperación caducan en 1 hora y son de un
  solo uso. Evidencia: `TEST`.
- `AC-AUTH-07` — Cambiar o recuperar la contraseña cierra las demás sesiones.
  Evidencia: `TEST`.
- `AC-AUTH-08` — Cambiar el correo avisa a la dirección antigua con opción de
  revertir 24 h. Evidencia: `TEST`.
- `AC-AUTH-09` — Se puede usar la aplicación sin verificar, salvo conectar
  buzón y recibir correo. Evidencia: `TEST`.
- `AC-AUTH-10` — Una sesión caducada **no pierde el contenido de un formulario
  a medias**. Evidencia: `TEST` + `USER`.
- `AC-AUTH-11` — Eliminar la cuenta ofrece exportar, enumera lo que se pierde
  con cifras reales y exige escribir `ELIMINAR`. Evidencia: `TEST` + `USER`.
- `AC-AUTH-12` — Eliminar borra en cascada, revoca los tokens de Google y
  cierra sesiones; **si la revocación falla, el borrado continúa**.
  Evidencia: `TEST`.
- `AC-AUTH-13` — El token de sesión **nunca es accesible desde JavaScript**.
  Evidencia: `CODE` + `TEST`.
- `AC-AUTH-14` — La sesión se verifica en el servidor, no solo en el cliente.
  Evidencia: `CODE`.
- `AC-AUTH-15` — Los límites de intento no bloquean cuentas, y dicen la hora
  exacta de reintento. Evidencia: `TEST`.
- `AC-AUTH-16` — Los formularios funcionan sin JavaScript.
  Evidencia: `TEST`.
- `AC-AUTH-17` — Los campos llevan `autocomplete` correcto y `<label>` visible.
  Evidencia: `TEST`.
- `AC-AUTH-18` — El motor no puede ejecutar ninguna acción de este documento.
  Evidencia: `CODE` + `TEST`.
- `AC-AUTH-19` — No se guarda ninguna IP en claro. Evidencia: `CODE`.

## 21. Fuera de alcance y puente a WhatsApp

**Diferido a V1.1:** entrar con Google, segundo factor, sesiones nombradas por
dispositivo.

**Prohibido, no diferido:** multiusuario, cuentas compartidas, revelar si un
correo tiene cuenta, propagar mensajes del proveedor, bloquear cuentas por
intentos fallidos, y ejecutar cualquier acción de cuenta desde la conversación.

Puente a WhatsApp: en la fase 2, **el número de teléfono se vincula a una
cuenta que ya existe**, nunca la crea. Vincular exige estar dentro de la
aplicación y confirmar; un número que escribe a Manzana sin vincular no tiene
acceso a nada.

La razón es la misma que la de §14: si el canal conversacional pudiera crear o
recuperar cuentas, la identidad del producto dependería de quién controla un
número de teléfono.

## 22. Trazabilidad

**Documentos consumidos:** `10` §3.1 (las rutas, incluida `/auth/callback` que
marca como inexistente), `11` (contrato de errores), `15` (política de sesión
y RLS).

**Código leído:** `src/features/auth/auth-screen.tsx`, y la existencia de
`/api/v1/privacy/account` y `/api/v1/privacy/export`.

**Contradicción que cierra:**

`C-13` — *"Errores humanos en español vs. Auth publicando `error.message` del
proveedor en inglés."* **La lectura del código matizó la contradicción:** la
traducción ya existe y cubre cinco casos, con un mensaje genérico de reserva
que nunca deja pasar el texto crudo. El defecto real no es que publique
mensajes en inglés —no lo hace— sino que **traduce por coincidencia de
subcadenas**, lo que falla en silencio si el proveedor cambia una palabra.

Se cierra con `RUL-AUTH-05` —mapeo por código— y sobre todo con la alerta de
observabilidad de `AC-AUTH-02`, que convierte un fallo silencioso en uno
visible.

Es el tercer caso del corpus donde el código estaba mejor de lo que la
contradicción sugería, después de `C-01` y de `C-08`. Merece anotarse: las
contradicciones se escribieron leyendo documentación, no código.

**Decisiones tomadas en este documento**, registradas en
`03_decisiones_producto_web.md`:

| Decisión | ID | Alternativa descartada | Razón |
|---|---|---|---|
| Los errores se mapean por código, no por texto | `WEB-D108` | Seguir traduciendo por subcadenas | Falla en silencio cuando el proveedor cambia una palabra: el mensaje bueno se vuelve genérico y nadie se entera. Con alerta en el desconocido, el sistema se mantiene solo |
| Se puede usar la aplicación sin verificar el correo | `WEB-D109` | Bloquear hasta confirmar | Bloquear pone un correo entre el usuario y su primer movimiento, y el primer valor es lo que decide si vuelve. Los dos límites que quedan tienen razones concretas |
| Eliminar la cuenta es inmediato e irreversible | `WEB-D110` | Periodo de gracia de 30 días | Un periodo de gracia significa que los datos que pidió borrar siguen existiendo y que "eliminé mi cuenta" es falso durante un mes. Se compensa con exportación, cifras reales y palabra escrita |
| La contraseña se valida por longitud, no por composición | `WEB-D111` | Exigir mayúscula, número y símbolo | Las reglas de composición producen contraseñas peores y empujan a reutilizar. La lista de filtradas avisa, no bloquea |
| Nunca se revela si un correo tiene cuenta | `no_negociable` `WEB-D112` | Decirlo para ser útil | La recuperación sería un oráculo para averiguar quién usa Manzana. En el registro sí se dice, porque el usuario ya demostró que quiere esa dirección |
| El motor no puede ejecutar ninguna acción de cuenta | `no_negociable` `WEB-D113` | Permitirlo con confirmación | Cambiar correo o eliminar cuenta por conversación abre una vía de secuestro gobernada por interpretación. El asistente lleva a la pantalla; no actúa |
