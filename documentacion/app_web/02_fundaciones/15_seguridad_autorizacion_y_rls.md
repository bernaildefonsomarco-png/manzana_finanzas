# 15 — Seguridad, autorización y RLS

**Bloque:** 02 — Fundaciones
**Estado:** V1
**Fecha:** 25 de julio de 2026
**Depende de:** `13_modelo_datos_web_v1.md`, `14_contratos_api_web.md`
**Documentos que dependen de este:** §11 de todos los módulos, `51_estrategia_de_pruebas_web.md`, `54_plan_de_implementacion_web.md`
**Fuentes:** `docs/fase_4_tecnica/16_modelo_datos.md` §17, `docs/fase_5_proteccion/24_privacidad_proteccion_datos.md`

---

## 1. El problema

El esquema tiene RLS bien hecho: 43 tablas con RLS activo y 65 políticas. Y
la API lo esquiva casi siempre.

Verificación del 25 de julio de 2026: **48 de las 58 rutas de `/api/v1` usan
`createServiceClient()`**, el cliente con rol de servicio que ignora RLS por
completo. Solo diez rutas usan el cliente autenticado:

```text
categories · classification/catalog · dashboard/upcoming · debts/[id]
email/oauth/start · insights · insights/[id] · insights/[id]/evidence
money · pending
```

Consecuencia: el aislamiento entre usuarios **no lo garantiza la base de
datos**, lo garantiza que cada repositorio recuerde filtrar por `user_id` a
mano. Funciona hoy porque los repositorios están bien escritos. Falla el día
que alguien añada una consulta y olvide el filtro — y no habrá nada debajo
que lo detenga.

Esto no es un defecto abstracto: es la diferencia entre "un error de código
muestra datos incorrectos" y "un error de código muestra los datos
financieros de otra persona".

## 2. Principio: RLS primero

> El cliente autenticado es el modo por defecto. El rol de servicio es una
> excepción que se justifica caso por caso y se verifica en el proceso de
> integración continua.

Tres capas de defensa, no una:

| Capa | Qué garantiza |
|---|---|
| **RLS en PostgreSQL** | Aunque la consulta olvide el filtro, la base no devuelve datos de otro usuario. |
| **Repositorios** | Filtran por `user_id` de forma explícita. Sigue siendo obligatorio. |
| **Rutas** | Autentican y validan antes de tocar nada. |

Hoy solo existen las capas 2 y 3 en la mayoría de rutas. La capa 1 está
construida pero desconectada.

## 3. Los tres clientes de base de datos

| Cliente | Cuándo se usa | RLS |
|---|---|---|
| **Navegador** | Nunca para datos financieros. Solo autenticación. | Sí |
| **Servidor autenticado** | Modo por defecto de toda ruta y Server Component. Actúa como el usuario. | Sí |
| **Rol de servicio** | Solo en la lista blanca de §4. | **No** |

Regla: una ruta que atiende una petición de un usuario y devuelve sus datos
usa el cliente autenticado. Sin excepciones que no estén en §4.

## 4. Lista blanca del rol de servicio

Solo estos casos justifican saltarse RLS. Cada uno tiene una razón que no se
puede resolver con el cliente autenticado.

| Caso | Por qué | Dónde |
|---|---|---|
| **Workers y trabajos programados** | No hay usuario en la petición: los dispara un cron o el outbox. | `/api/internal/workers/*`, `/api/internal/jobs/*` |
| **Webhooks entrantes** | El emisor es un proveedor externo, no un usuario autenticado. | `/api/webhooks/*` |
| **Escrituras del Core con múltiples tablas** | Funciones atómicas que tocan movimientos, saldos, auditoría y outbox en una transacción. El usuario no tiene permiso de escritura directa sobre esas tablas **por diseño**. | Funciones `manzana.commit_*` |
| **Registro de usuario nuevo** | Crear el perfil y las preferencias iniciales ocurre antes de que exista contexto de sesión completo. | `/api/v1/onboarding` |
| **Eliminación de cuenta** | Debe borrar datos de todas las tablas, incluidas las que el usuario no puede escribir. | `/api/v1/privacy/account` |
| **Comprobaciones de salud** | No devuelven datos de usuario. | `/api/health/*` |

Todo lo demás usa el cliente autenticado. Las 48 rutas actuales se migran
según el plan de §9.

## 5. La regla que lo vuelve verificable

Una política de seguridad que depende de que alguien la recuerde no es una
política. Se convierte en una prueba que **falla la compilación**:

```text
Regla: ningún archivo bajo src/app/api/v1/ puede importar createServiceClient
       salvo los que figuran en la lista blanca explícita.
```

La lista blanca vive en un único archivo, versionada. Añadir una entrada
exige justificación escrita en el propio archivo y queda en el historial de
git — que ahora existe (`WEB-D009`).

Una segunda prueba complementa a la primera: para cada tabla con datos de
usuario, un test intenta leer y escribir filas de otro usuario con el
cliente autenticado y **debe fallar**. Esa prueba detecta políticas mal
escritas, que es lo que una regla de importación no puede ver.

## 6. Escrituras: por qué `authenticated` no escribe dinero

Regla heredada y correcta, que se mantiene: el rol `authenticated` **no
tiene permiso de escritura directa** sobre `movements`, `accounts.balance`,
`boxes.balance`, `debts` ni las tablas de saldos.

Escribir dinero pasa siempre por funciones del Core (`manzana.commit_*`),
que se ejecutan con permisos elevados y de forma atómica: movimiento,
saldos, auditoría y evento de outbox en la misma transacción.

Esto es correcto y no cambia. Lo que cambia es que **las lecturas** dejen de
usar el rol de servicio sin motivo.

## 7. Autenticación

| Aspecto | Regla |
|---|---|
| Proveedor | Supabase Auth |
| Transporte | Cookie `HttpOnly`, `Secure`, `SameSite=Lax` |
| Alternativa | `Authorization: Bearer` para clientes no navegador |
| Refresco | Proxy en cada petición (`src/proxy.ts`; en Next 16 el middleware se llama Proxy) |
| Verificación de sesión | Una vez en el layout de `(app)`, no en cada página |
| Expiración | Aviso sobre la pantalla actual sin destruir el trabajo en curso |

Reglas de mensajes de autenticación, que cierran `C-13`:

- Nunca se propaga el mensaje del proveedor (hoy se publica literalmente
  `Invalid login credentials`).
- El error de credenciales no revela si el correo existe.
- La recuperación de contraseña responde igual exista o no la cuenta.
- Los mensajes están en español y ofrecen la acción siguiente.

## 8. Contra qué se protege

| Riesgo | Mitigación |
|---|---|
| Acceso a datos de otro usuario | RLS activo + cliente autenticado por defecto + pruebas de aislamiento |
| Enumeración de recursos por ID | Un recurso de otro usuario devuelve 404, nunca 403 (no confirma su existencia) |
| Fuerza bruta en el acceso | Límite de peticiones por correo y por IP (`14_contratos_api_web.md` §8) |
| CSRF | Verificación de origen en escrituras por cookie |
| XSS | React escapa por defecto; prohibido `dangerouslySetInnerHTML` con contenido de usuario; CSP |
| Redirección abierta | `redirigir` solo acepta rutas internas conocidas |
| Inyección SQL | Consultas parametrizadas; prohibida la concatenación de SQL |
| Inyección de instrucciones vía correo | El extractor de correos no tiene herramientas ni autoridad: devuelve datos estructurados con evidencia y nada más |
| Fuga por registros | Nunca se registran montos, nombres de personas ni contenido de correos en texto plano |
| Escalada por el asistente | El asistente propone; el Core ejecuta; el usuario confirma |

## 9. Plan de migración de las 48 rutas

No se ejecuta durante la fase de documentación (`WEB-D010`), porque
`14_contratos_api_web.md` va a redefinir esas mismas rutas con cursor,
filtros y límite de peticiones. Tocarlas dos veces sería peor.

Orden de ejecución, en `54_plan_de_implementacion_web.md`:

1. Escribir la prueba de importación y la lista blanca, **con 46 de las 48
   rutas listadas como excepciones temporales** (`W-02`, `WEB-D168`). Las
   otras dos —`/api/v1/onboarding` y `/api/v1/privacy/account`— ya están
   justificadas como permanentes en §4 y no entran en la lista que este plan
   quiere vaciar: nunca van a migrar a cliente autenticado, por las mismas
   dos razones de §4. Así la regla existe desde el principio y ninguna ruta
   nueva nace mal.
2. Escribir las pruebas de aislamiento por tabla. Detectan políticas mal
   escritas antes de confiar en ellas.
3. Migrar por familia de endpoints, junto con su rediseño de paginación y
   filtros, quitando cada ruta de la lista de excepciones al migrarla.
4. La lista de excepciones temporales debe quedar vacía antes de considerar
   la app lista para vender.

Riesgo aceptado mientras tanto, registrado en `WEB-D010` y en
`53_deuda_tecnica_y_saneamiento.md`: durante la fase de documentación el
aislamiento sigue dependiendo de los repositorios.

## 10. Datos que nunca se guardan

Heredado de `docs/fase_5_proteccion/24_privacidad_proteccion_datos.md`:

- Contraseñas de correo, contraseñas de aplicación o credenciales bancarias.
- Números completos de tarjeta o de cuenta bancaria.
- El cuerpo completo de los correos, por defecto.
- Datos de contacto de terceros (las personas relacionadas guardan nombre,
  alias y relación; nunca teléfono ni cuenta).
- El razonamiento interno crudo del modelo de IA.

Los tokens de OAuth se guardan cifrados
(`src/adapters/email/token-crypto.ts`) y se pueden anular a `null` al
desconectar, sin que el esquema obligue a conservar un secreto.

## 11. Criterios de aceptación

- `AC-SEG-01` — Ninguna ruta de `/api/v1` importa `createServiceClient`
  salvo las de la lista blanca justificada. Evidencia: `TEST`. Clase: `build`.
- `AC-SEG-02` — Para cada tabla con datos de usuario existe una prueba que
  verifica que el cliente autenticado no puede leer ni escribir filas de
  otro usuario. Evidencia: `TEST`. Clase: `integracion`.
- `AC-SEG-03` — El rol `authenticated` no puede escribir directamente
  columnas de saldo ni insertar en `movements`. Evidencia: `TEST`.
  Clase: `integracion`.
- `AC-SEG-04` — Un recurso de otro usuario devuelve 404, nunca 403.
  Evidencia: `TEST`. Clase: `lint`. **Agregado** (`51` §5, cierra en `W-02`):
  su conjunto son las 58 rutas de `/api/v1`, y la prueba lee cada fichero de
  ruta buscando un `403` que no sea de autenticación de trabajador. Vuelve a
  medirse cuando el conjunto de 58 cambie.
- `AC-SEG-05` — Ningún mensaje de autenticación revela si un correo existe.
  Evidencia: `TEST`.
- `AC-SEG-06` — Ningún registro contiene montos, nombres de personas ni
  contenido de correos en texto plano. Evidencia: `TEST` + `LIVE`.
- `AC-SEG-07` — La lista de excepciones temporales está vacía antes del
  lanzamiento. Evidencia: `CODE`.
- `AC-SEG-08` — Una escritura por cookie desde un origen distinto es
  rechazada. Evidencia: `TEST`.
