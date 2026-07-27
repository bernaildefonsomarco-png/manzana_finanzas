# 45 — Configuración, privacidad y control de datos

**Bloque:** 06 — Transversales
**Alcance:** V1 (migración con mejoras)
**Fecha:** 26 de julio de 2026
**Docs fuente:** `docs/fase_5_proteccion/24_privacidad_proteccion_datos.md`, migración `045_experience_privacy_preferences`, `src/features/settings/settings-screen.tsx` (2.081 líneas, antipatrón), páginas públicas `/privacidad`, `/terminos`, `/eliminar-datos`
**Documentos que dependen de este:** `46` (correo saliente), `48` (ayuda), `53` (deuda técnica)

---

## 1. Tesis y qué NO es

Este documento cierra **tres contradicciones**, y las tres tienen la misma
forma: **el producto puede hacer algo y su documentación pública dice otra
cosa.**

| | Qué dice el producto | Qué dice la página |
|---|---|---|
| `C-14` | La cuenta se elimina desde la aplicación | "puede que no esté disponible dentro de la app" |
| `C-16` | Se leen correos con permisos restringidos de Google | Nada sobre Limited Use |
| `C-04` | El modo discreto es una preferencia | Cada pantalla decide por su cuenta |

Las dos primeras se comprobaron leyendo los archivos: `/privacidad` no
menciona Limited Use ni una vez, y `/eliminar-datos` dice literalmente que el
borrado "no esté disponible dentro de la app" mientras
`/api/v1/privacy/account` existe y funciona.

Una promesa de privacidad desactualizada no es un descuido de redacción: es
exactamente el documento que alguien leerá cuando desconfíe, y es donde una
imprecisión cuesta más.

De ahí la tesis: **lo que el producto hace y lo que declara se versionan
juntos, con un test que falla el build si divergen** (`RUL-CONF-09`).

Y la segunda mitad del documento, que es de estructura: la configuración
actual son **2.081 líneas en un archivo, con un solo componente de 1.740**.
Eso no es un problema estético; es la razón de que añadir un ajuste sea caro y
de que el modo discreto se aplique distinto en cada pantalla.

**Qué NO es:**

- **No es la exportación ni el borrado.** Esos mecanismos son de `35`
  (`RUL-REP-11`) y `43` (`RUL-AUTH-10`); aquí está dónde se encuentran y qué
  se declara sobre ellos.
- **No es la memoria.** Ver y olvidar lo aprendido es `36`; aquí es una
  sección más del índice.
- **No es configuración de equipo.** Una cuenta, una persona (`43` §2).

## 2. Alcance

| Nivel | Funcionalidad |
|---|---|
| **IN** | Configuración en secciones navegables con ruta propia. **Modo discreto como preferencia de servidor con un único punto de decisión** (cierra `C-04`). Consentimientos granulares con registro y revocación. Acceso a exportar y eliminar. **Página pública de privacidad con la declaración Limited Use** (cierra `C-16`). **Página de eliminación de datos sincronizada con la capacidad real** (cierra `C-14`). Historial de eventos de cuenta y de consentimiento. |
| **V1.1** | Preferencias por dispositivo. Exportación programada. Sesiones nombradas. |
| **FUERA** | Configuración de organización o equipo. Ajustes que cambien el comportamiento del motor más allá de la voz. Venta o cesión de datos a terceros: **no está fuera de V1, está prohibido**. |

## 3. Vocabulario

| Interno | Visible |
|---|---|
| `experience_preferences` | Preferencias |
| `discreet_mode_enabled` | Modo discreto |
| `consent_event` | Permisos que diste |
| `data_subject_request` | — |
| `PII`, `scope`, `restricted scope` | — (**nunca visible**) |

Prohibido frente al usuario: `preferencias de experiencia`, `consentimiento
granular`, `scope`, `PII`, `tratamiento de datos`, `interesado`, `responsable
del tratamiento`. Son términos de cumplimiento, no de producto.

```text
Correcto:   Modo discreto — oculta los montos de la pantalla.
Correcto:   Le diste permiso a Manzana para leer los correos de BCP.
Incorrecto: Gestión del consentimiento para el tratamiento de datos.
```

## 4. Entidades y datos

### 4.1 Lo que ya existe

| Tabla | Migración | Qué guarda |
|---|---|---|
| `user_preferences` | `002` | Tono, modo discreto, horario silencioso, opt-ins, cuenta por defecto |
| `experience_preference_events` | `045` | Auditoría de cambios de preferencia |

La migración `045` ya tiene `discreet_mode_enabled` en su función de
preferencias, así que **el modo discreto ya es una preferencia de servidor**.
Lo que falta no es la columna: es que las pantallas la usen (`RUL-CONF-03`).

### 4.2 Migración `065` — consentimientos

```sql
create table if not exists public.consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind consent_kind not null,       -- correo_gmail | correo_saliente_<tipo>
                                    -- | terminos | privacidad
  granted boolean not null,
  version text not null,            -- versión del documento aceptado
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index on public.consent_events (user_id, kind, created_at desc);
```

**Es un registro de eventos, no un estado.** El estado vigente de un
consentimiento es su último evento. Guardarlo como estado mutable perdería la
historia, y la historia es justamente lo que hace falta para responder "¿desde
cuándo tiene permiso?" y "¿cuándo lo quité?".

`version` es lo que hace verificable `RUL-CONF-09`: si los términos cambian, se
sabe qué versión aceptó cada persona.

### 4.3 Las páginas públicas

`/privacidad`, `/terminos`, `/eliminar-datos`, `/empresa`, `/contacto` ya
existen como rutas. Su **contenido** es lo que este documento gobierna, en
`RUL-CONF-08` y `RUL-CONF-09`.

## 5. Reglas

**`RUL-CONF-01` — La configuración es un índice de secciones, no una pantalla**

Cada sección tiene **ruta propia**, se carga sola y se puede enlazar.

| Ruta | Qué contiene |
|---|---|
| `/configuracion` | Índice |
| `/configuracion/perfil` | Cuenta, contraseña, correo, sesiones (`43`) |
| `/configuracion/privacidad` | Modo discreto, categorías sensibles, permisos |
| `/configuracion/recordatorios` | Tipos y canales (`37`) |
| `/configuracion/correo` | Buzones y remitentes (`28`) |
| `/configuracion/memoria` | Lo aprendido (`36`) |
| `/configuracion/datos` | Exportar y eliminar (`35`, `43`) |
| `/configuracion/voz` | Cómo habla Manzana (`20c`) |

Hoy son 2.081 líneas en un archivo. La consecuencia práctica de partirlo no es
la limpieza: es que **una sección se puede enlazar desde donde importa**. El
recordatorio que molesta lleva a `/configuracion/recordatorios`, no a una
pantalla donde hay que buscar.

**`RUL-CONF-02` — Todo ajuste se guarda solo, y se dice**

Sin botón de guardar y sin formulario que se pueda abandonar a medias. Cada
cambio se persiste y se confirma con un aviso discreto.

Si falla, **se revierte visualmente y se dice**. Un interruptor que se queda
encendido en pantalla y apagado en el servidor es la peor forma de fallar aquí:
el usuario cree que configuró algo que no configuró.

**`RUL-CONF-03` — Modo discreto: una preferencia, un punto de decisión**

La corrección de `C-04`.

```text
Preferencia en servidor  →  un único resolvedor  →  todas las superficies
```

Reglas duras:

1. Vive en `user_preferences.discreet_mode_enabled` y **se lee en el
   servidor**. Nunca se guarda solo en el navegador.
2. **Ninguna pantalla decide por su cuenta** si oculta o no. Consultan al
   mismo punto de decisión, que también determina **qué** se oculta.
3. Al activarlo en un dispositivo, **se activa en todos**. Es una preferencia
   de la persona, no de la sesión.
4. Se alterna desde el Inicio, sin entrar en configuración (`RUL-HOME-10`):
   se usa cuando alguien se acerca, y para entonces navegar tres pantallas es
   tarde.

Qué oculta y qué no, decidido una vez y aplicado en todas partes:

| Se oculta | Se conserva |
|---|---|
| Montos, en cifra y en texto | Descripciones y comercios |
| Ejes con valores en gráficos | Barras, proporciones y porcentajes |
| Montos en las respuestas del asistente | La estructura de la respuesta |
| Bloques de categorías sensibles, enteros | El resto de la pantalla |

La segunda columna es la que hace el modo usable: **la forma de un gráfico no
revela cuánto gana nadie**, y ocultarla dejaría la pantalla inservible sin
proteger nada (`RUL-REP-14`).

Y una excepción declarada: **exportar sigue disponible en modo discreto**
(`RUL-REP-14`). El modo protege de quien mira la pantalla, no del propio
usuario.

**`RUL-CONF-04` — Categorías sensibles: las elige el usuario**

Hay dos por defecto —**salud** y **farmacia**— y el usuario puede añadir o
quitar las que quiera.

Efectos de marcar una categoría como sensible, ya declarados en sus módulos y
recogidos aquí:

| Efecto | Dónde |
|---|---|
| No aparece en el Inicio | `RUL-DESC-13`, `RUL-HOME-10` |
| No genera hechos de perfil | `RUL-MEM-11` |
| No sale por correo, ni con opt-in | `RUL-NOTIF-12` |
| Se oculta entera en modo discreto | `RUL-CONF-03` |
| Nunca se enuncia como cambio de comportamiento | `RUL-DESC-13` |

**Los movimientos siguen siendo suyos y siguen viéndose** en su pantalla,
buscándose y exportándose (`RUL-BUS-11`). Sensible significa discreto, no
oculto al dueño.

**`RUL-CONF-05` — Cada permiso se pide, se registra y se puede quitar**

| Permiso | Cuándo se pide | Cómo se quita |
|---|---|---|
| Leer correos de un banco | Al conectar el buzón (`28`) | Desconectar, o pausar la fuente |
| Escribir al correo, por tipo | Al activarlo (`37`, `RUL-NOTIF-04`) | Un interruptor, o baja en un clic |
| Términos y privacidad | Al registrarse | No aplica: es condición de uso |

Los tres primeros se registran en `consent_events` con su versión y su fecha,
y el usuario **ve la lista**:

```text
Permisos que diste

  Leer los correos de BCP en marco@gmail.com
  Desde el 14 de julio                    [Quitar]

  Escribirte cuando venza una cuota
  Desde el 20 de julio                    [Quitar]

  Términos y privacidad, versión del 26 de julio
  Aceptados el 12 de julio                [Ver]
```

Quitar un permiso tiene efecto **inmediato**, y en el caso del correo se lee
**en el momento del envío** (`WEB-D073`). No se puede recibir un correo
después de haberlos desactivado.

**`RUL-CONF-06` — Revocar un permiso no borra lo que ya se registró**

Desconectar un buzón no elimina los movimientos que llegaron por él, y se dice:

```text
Desconecté marco@gmail.com. Dejo de leer sus correos desde ahora.
Los 47 movimientos que ya registraste siguen siendo tuyos.
[Eliminarlos también]
```

Se ofrece borrarlos como acción aparte y explícita. Borrarlos solo sería
decidir por el usuario que sus datos dependen de dónde vinieron, y no es así.

**`RUL-CONF-07` — Nada se comparte, se vende ni se cede**

No es una decisión de alcance: es una prohibición.

- No hay integraciones de terceros que reciban datos financieros.
- No hay analítica que envíe montos, descripciones ni contenido a nadie
  (`19`).
- No se entrenan modelos con datos del usuario (`RUL-MEM-12`).
- No hay publicidad, ni segmentación, ni perfilado con esos fines.

Y la garantía estructural que lo sostiene: **no existe ninguna ruta de código
que lea los datos de más de un usuario a la vez** (`WEB-D062`). Una política
sobrevive hasta el primer refactor razonable; una imposibilidad, no.

**`RUL-CONF-08` — La página pública dice lo que el producto hace, hoy**

Requisitos de contenido, verificables uno a uno.

`/privacidad` debe contener:

| Requisito | Por qué |
|---|---|
| Qué datos se recogen, por categoría | Base de cualquier política |
| **La declaración Limited Use de Google**, con el texto que exige su política vigente | Cierra `C-16`. Es obligatorio para permisos restringidos de Gmail |
| Que no se guarda el cuerpo de los correos | Es cierto (`28` §4.4) y es lo que más tranquiliza |
| Que no se venden ni ceden datos | `RUL-CONF-07` |
| Que no se entrenan modelos con datos del usuario | `RUL-MEM-12` |
| Cómo exportar, y qué incluye | `RUL-REP-11` |
| Cómo eliminar la cuenta, **y que se puede desde la aplicación** | Cierra `C-14` |
| Retención: qué se conserva tras eliminar y por cuánto | `43` §4.3 |
| Contacto para ejercer derechos | Obligación legal |
| Fecha de última actualización y versión | `RUL-CONF-09` |

`/eliminar-datos` debe describir **el flujo real**: entrar, ir a
`/configuracion/datos`, exportar si se quiere, escribir `ELIMINAR`. Y ofrecer
la vía por correo **solo como alternativa para quien no puede entrar**, no
como vía principal.

Hoy dice que el borrado "puede que no esté disponible dentro de la app". Eso
era cierto antes de que existiera `/api/v1/privacy/account`; ahora no lo es.

**El texto exacto de la declaración Limited Use lo fija la política vigente de
Google**, y se copia de ella, no se redacta. Este documento fija que **tiene
que estar**, no cómo se escribe: inventarlo sería peor que no ponerlo.

**`RUL-CONF-09` — Lo que se declara y lo que se hace se versionan juntos**

La regla que cierra `C-14` y `C-16` para que no vuelvan.

1. Las páginas legales llevan **versión y fecha** en su contenido.
2. Cada afirmación verificable de `/privacidad` tiene **un criterio de
   aceptación asociado** (§10).
3. **Un test comprueba las afirmaciones comprobables** contra el
   comportamiento real, y falla el build:
   - si `/privacidad` no contiene la declaración Limited Use,
   - si `/eliminar-datos` dice que el borrado no está en la aplicación
     mientras la ruta existe,
   - si declara que no se guarda el cuerpo de los correos y el esquema tiene
     una columna que lo guarda.
4. Cambiar la capacidad **obliga** a revisar la página en el mismo cambio.

El punto 3 es lo que convierte esto en algo que se mantiene. Las dos
contradicciones que este documento cierra nacieron de que **el producto avanzó
y la página no**, y eso vuelve a pasar salvo que algo lo impida.

**`RUL-CONF-10` — La voz se ajusta; el comportamiento del motor no**

`/configuracion/voz` permite ajustar longitud, formalidad, trato, uso de
emojis y nivel de detalle (`20c` §5, `WEB-D024`).

**No permite** desactivar las confirmaciones, permitir que el asistente
ejecute solo, subir el nivel de riesgo aceptado, ni desactivar el verificador.

Son las reglas que protegen el dinero del usuario, y ofrecerlas como ajuste
significaría que alguien puede apagarlas. La precisión nunca se adapta.

## 6. Superficies

**Referencia visual: parcial.** `SETTINGS` existe en
`docs/fase_6_visual/30_app_flow.md`, como pantalla única. El índice por
secciones es nuevo.

| ID | Pantalla | Ruta |
|---|---|---|
| `SCR-CONF-01` | Índice | `/configuracion` |
| `SCR-CONF-02` | Privacidad | `/configuracion/privacidad` |
| `SCR-CONF-03` | Permisos que diste | `/configuracion/privacidad#permisos` |
| `SCR-CONF-04` | Tus datos | `/configuracion/datos` |
| `SCR-CONF-05` | Cómo habla Manzana | `/configuracion/voz` |
| `SCR-CONF-06` | Historial de la cuenta | `/configuracion/perfil#actividad` |
| `SCR-CONF-07` | Página pública de privacidad | `/privacidad` |
| `SCR-CONF-08` | Página pública de eliminación | `/eliminar-datos` |

### `SCR-CONF-01` — Índice

```text
┌──────────────────────────────────────────────┐
│ Configuración                                │
├──────────────────────────────────────────────┤
│ Tu cuenta                                  → │
│   Correo, contraseña, sesiones               │
├──────────────────────────────────────────────┤
│ Privacidad                                 → │
│   Modo discreto, categorías sensibles,       │
│   permisos que diste                         │
├──────────────────────────────────────────────┤
│ Recordatorios                              → │
│   De qué te aviso y por dónde                │
├──────────────────────────────────────────────┤
│ Tu correo                                  → │
│   2 buzones conectados                       │
├──────────────────────────────────────────────┤
│ Lo que sé de ti                            → │
│   47 cosas aprendidas                        │
├──────────────────────────────────────────────┤
│ Cómo te hablo                              → │
├──────────────────────────────────────────────┤
│ Tus datos                                  → │
│   Descargar todo, eliminar la cuenta         │
└──────────────────────────────────────────────┘
```

Cada sección lleva **una línea que dice qué hay dentro**, con cifras reales
donde las hay. Un índice de siete palabras sueltas obliga a entrar en todas
para encontrar una.

### `SCR-CONF-02` — Privacidad

```text
┌──────────────────────────────────────────────┐
│ Privacidad                                   │
├──────────────────────────────────────────────┤
│ Modo discreto                        [  ○]   │
│ Oculta los montos de la pantalla. Las barras │
│ y los porcentajes se quedan.                 │
│ Se aplica en todos tus dispositivos.         │
├──────────────────────────────────────────────┤
│ Categorías discretas                         │
│ Estas no aparecen en el Inicio, no salen     │
│ por correo y no genero conclusiones sobre    │
│ ti a partir de ellas.                        │
│   Salud            [✓]                       │
│   Farmacia         [✓]                       │
│   Ocio             [ ]                       │
│                        [+ Añadir otra]       │
├──────────────────────────────────────────────┤
│ Permisos que diste                         → │
├──────────────────────────────────────────────┤
│ Qué hago con tus datos                     → │
│   Leer la política de privacidad             │
└──────────────────────────────────────────────┘
```

- Cada ajuste dice **qué hace y qué no**, en su sitio. Sin iconos de
  interrogación.
- "Se aplica en todos tus dispositivos" está escrito porque es la corrección
  de `C-04` y el usuario tiene que poder confiar en ella.

### `SCR-CONF-08` — `/eliminar-datos`, corregida

Página pública, accesible **sin sesión**, porque quien ya no puede entrar
también tiene derecho a que le borren.

```text
Eliminar tus datos de Manzana

Puedes eliminar tu cuenta y todos tus datos desde la aplicación,
sin pedírselo a nadie:

  1. Entra en Manzana
  2. Ve a Configuración → Tus datos
  3. Descarga tus datos si quieres conservarlos
  4. Pulsa "Eliminar mi cuenta" y confirma

Se elimina todo de inmediato y no se puede deshacer: movimientos,
cuentas, deudas, lo aprendido y tus conversaciones. Si tenías un
correo conectado, revocamos también el permiso con Google.

Si no puedes entrar en tu cuenta, escríbenos a [contacto] y lo
hacemos nosotros. Te pediremos confirmar que la dirección es tuya.
```

El cambio respecto de hoy es el primer párrafo. La vía por correo pasa a ser
**la alternativa**, no la principal.

## 7. Acciones

| ID | Acción | ¿Confirma? | Deshacer | Evento |
|---|---|---|---|---|
| `ACT-CONF-01` | Alternar modo discreto | No | Alternando | `discreto.alternado` |
| `ACT-CONF-02` | Marcar una categoría como discreta | No | Desmarcando | `privacidad.categoria_marcada` |
| `ACT-CONF-03` | Ver los permisos dados | No | — | `privacidad.permisos_vistos` |
| `ACT-CONF-04` | Quitar un permiso | **Sí** | Volviéndolo a dar | `privacidad.permiso_revocado` |
| `ACT-CONF-05` | Ajustar la voz | No | Ajustando | `voz.cambiada` |
| `ACT-CONF-06` | Ir a exportar | No | — | `datos.exportar_abierto` |
| `ACT-CONF-07` | Ir a eliminar la cuenta | No | — | `datos.eliminar_abierto` |
| `ACT-CONF-08` | Ver el historial de la cuenta | No | — | `cuenta.actividad_vista` |
| `ACT-CONF-09` | Eliminar los datos de un buzón revocado | **Sí** | No | `privacidad.datos_origen_eliminados` |

`ACT-CONF-04` confirma porque tiene consecuencias que el usuario puede no
prever: quitar el permiso de un buzón detiene la captura. La tarjeta dice qué
deja de pasar y qué se conserva (`RUL-CONF-06`).

## 8. API

| Método y ruta | Notas |
|---|---|
| `GET /preferences` · `PATCH` | Preferencias, incluida `discreet_mode_enabled` |
| `GET /preferences/discreet` | Solo el modo discreto. **Punto único de decisión** |
| `GET /consents` | Lista con versión y fecha |
| `POST /consents/[kind]/revoke` | Revoca. Efecto inmediato |
| `GET /privacy/sensitive-categories` · `PATCH` | Categorías discretas |
| `GET /account/events` | Historial (`43` §4.3) |
| `GET /api/v1/privacy/export` | Ya existe (`35`) |
| `DELETE /api/v1/privacy/account` | Ya existe (`43`) |

`GET /preferences/discreet` es una ruta propia y no un campo de otra respuesta
porque **es el punto único de `RUL-CONF-03`**. Que sea un endpoint separado
hace evidente en el código quién lo consulta, y hace posible el test de
`AC-CONF-03`.

## 9. Estados de datos

| Estado | Qué se muestra |
|---|---|
| **Sin permisos dados** | "Todavía no me diste ningún permiso." Sin lista vacía |
| **Sin buzones** | La sección de correo dice "ninguno conectado" y lleva a `28` |
| **Sin nada aprendido** | La sección de memoria dice qué aparecerá aquí (`36` §12) |
| **Modo discreto activo** | Se indica en el índice, no solo dentro de la sección |
| **Ajuste que falla al guardar** | Se revierte visualmente y se dice (`RUL-CONF-02`) |
| **Página legal desactualizada** | **No es un estado posible**: el build falla antes (`RUL-CONF-09`) |

## 10. Errores

| ID | Causa | Mensaje visible | Salida |
|---|---|---|---|
| `ERR-CONF-01` | Un ajuste no se guarda | "No pude guardar ese cambio. Lo dejé como estaba." | Reintentar |
| `ERR-CONF-02` | Revocar un permiso ya revocado | "Ese permiso ya no estaba activo." | Ver la lista |
| `ERR-CONF-03` | Quitar una categoría discreta que no lo era | "Esa categoría no estaba marcada." | Ver la lista |
| `ERR-CONF-04` | Fallo al revocar con Google | "Quité el permiso aquí, pero Google no respondió. Puedes quitarlo también desde tu cuenta de Google." | Enlace a Google |

`ERR-CONF-04` es honesto sobre un fallo parcial en vez de fingir éxito. Y da
la vía alternativa, porque el permiso en Google es del usuario y puede
revocarlo él.

## 11. Integración con el motor IA

### 11.1 Consultas que expone

| Dimensión | Notas |
|---|---|
| `modo_discreto` | Activo o no |
| `categoria_sensible` | Cuáles marcó |
| `permiso_activo` | Por tipo |

### 11.2 Comandos que acepta

| Comando | Confirmación |
|---|---|
| `activar_modo_discreto` / `desactivar` | `ninguna` |
| `marcar_categoria_sensible` | `tarjeta` |
| `ajustar_voz` | `ninguna`: el usuario acaba de decirlo |
| `revocar_permiso` | **`tarjeta`**, diciendo qué deja de pasar |

```text
"activa el modo discreto"           → activar_modo_discreto
"no me hables de salud"             → marcar_categoria_sensible
"háblame más corto"                 → ajustar_voz
"deja de leer mi correo del trabajo"→ revocar_permiso
```

### 11.3 Lo que el motor NO puede hacer aquí

- **Eliminar la cuenta** ni llevar a hacerlo sin que lo pidan (`43` §14).
- **Desactivar una confirmación**, subir el riesgo aceptado o apagar el
  verificador (`RUL-CONF-10`). No existen como comandos.
- Aceptar términos ni políticas en nombre del usuario.
- Cambiar un permiso sin tarjeta.

La segunda es la importante: **no basta con que el asistente se niegue; los
comandos no existen en el catálogo** (`WEB-D094`).

## 12. Memoria y aprendizaje

| Qué aprende | De dónde | Cómo se corrige |
|---|---|---|
| Cuándo usa el modo discreto | Momentos de activación | — |
| Qué categorías le resultan sensibles | Marcadas, y descartes en `34` | Marcándolas |

Los dos son **preferencias** (`RUL-MEM-01`). El segundo tiene un límite
explícito: **descartar descubrimientos de una categoría sugiere marcarla como
discreta, y se pregunta**; nunca se marca sola. Decidir por alguien qué le
avergüenza es peor que no notarlo.

## 13. Eventos y métricas

Eventos: `discreto.alternado`, `privacidad.categoria_marcada`,
`.permisos_vistos`, `.permiso_revocado`, `.datos_origen_eliminados`,
`voz.cambiada`, `cuenta.actividad_vista`, `datos.exportar_abierto`,
`datos.eliminar_abierto`, `legal.pagina_vista`.

Sin montos, sin categorías concretas —solo el conteo—, sin contenido.

| Métrica | Qué indica |
|---|---|
| Uso del modo discreto | Si la función hacía falta y dónde se activa |
| Categorías marcadas como discretas | Qué considera sensible la gente de verdad |
| Permisos revocados por tipo | Dónde el producto pidió de más |
| **Visitas a `/privacidad` desde dentro de la aplicación** | Si la política se lee o solo se enlaza |
| Exportaciones abiertas desde configuración | Si el control se ejerce |
| Eliminaciones tras ver el detalle | Si las salvaguardas de `43` funcionan |

## 14. Rendimiento y accesibilidad

- Cada sección **carga sola**. Hoy son 2.081 líneas en un archivo, y eso
  significa descargar la configuración entera para cambiar un interruptor.
- `GET /preferences/discreet` bajo 100 ms: lo consulta el resolvedor en cada
  carga.
- El modo discreto se aplica **en el servidor** al renderizar. Aplicarlo en el
  cliente produce un instante en que los montos son visibles, que es
  exactamente el instante que el modo evita.
- Índice y secciones navegables por encabezados; cada sección con su `h1`.
- Cada interruptor con `<label>` que incluye el efecto: "Modo discreto, oculta
  los montos de la pantalla".
- Los cambios se anuncian en `aria-live="polite"`: "Modo discreto activado".
- Las páginas legales son documentos con estructura de encabezados real,
  no bloques de texto corrido.

El tercer punto es el que más fácil se implementa mal y el que anula la
función entera: un parpadeo de montos visibles al cargar la página es
suficiente para que alguien vea lo que no debía.

## 15. Casos borde

1. **Modo discreto activo y se abre en otro dispositivo.** Ya está activo: es
   preferencia de persona.
2. **Se marca como sensible una categoría con presupuesto.** El presupuesto
   sigue funcionando; sus avisos dejan de salir por correo y no aparecen en el
   Inicio (`RUL-DESC-13`).
3. **Se revoca el permiso de un buzón con detecciones sin confirmar.** Los
   pendientes abiertos se archivan (`28`); los movimientos ya confirmados se
   quedan (`RUL-CONF-06`).
4. **Google revoca el permiso desde su lado.** Se detecta al fallar la lectura
   y se avisa como `correo_desconectado` (`RUL-NOTIF-01`).
5. **Se cambian los términos.** Se pide aceptar la versión nueva al entrar,
   con qué cambió resumido. No se bloquea el acceso a exportar ni a eliminar:
   **esos derechos no dependen de aceptar nada.**
6. **Ajuste cambiado en dos pestañas a la vez.** Gana el último; la otra se
   actualiza al enfocar.
7. **Modo discreto activo al exportar.** La exportación **no oculta nada**: es
   para el usuario (`RUL-REP-14`).
8. **Usuario que marca todas sus categorías como sensibles.** Permitido. El
   Inicio se queda sin bloque de descubrimientos y se dice por qué.

El caso 5 es el que separa una política honesta de una coartada: condicionar
el derecho a exportar o borrar a aceptar unos términos nuevos sería usar el
consentimiento como palanca.

## 16. Criterios de aceptación

- `AC-CONF-01` — Cada sección de configuración tiene ruta propia y carga sola.
  Evidencia: `CODE` + `TEST`.
- `AC-CONF-02` — El modo discreto se lee del servidor y **se aplica en todos
  los dispositivos**. Cierra `C-04`. Evidencia: `TEST`.
- `AC-CONF-03` — **Ninguna pantalla decide por su cuenta qué ocultar**: todas
  consultan el mismo punto de decisión. Evidencia: `CODE` + `TEST`.
- `AC-CONF-04` — El modo discreto se aplica al renderizar en servidor, sin
  ningún instante con montos visibles. Evidencia: `TEST`.
- `AC-CONF-05` — Exportar sigue disponible con modo discreto activo, y la
  exportación no oculta nada. Evidencia: `TEST`.
- `AC-CONF-06` — Cada permiso queda registrado con su versión y su fecha, y
  revocarlo tiene efecto inmediato. Evidencia: `TEST`.
- `AC-CONF-07` — Revocar un permiso **no borra** los datos ya registrados, y
  se dice. Evidencia: `TEST` + `USER`.
- `AC-CONF-08` — **`/privacidad` contiene la declaración Limited Use de
  Google.** Cierra `C-16`. Evidencia: `TEST` sobre el contenido publicado.
- `AC-CONF-09` — **`/eliminar-datos` describe el flujo en la aplicación como
  vía principal.** Cierra `C-14`. Evidencia: `TEST` + `USER`.
- `AC-CONF-10` — El build falla si una afirmación comprobable de las páginas
  legales contradice el comportamiento real. Evidencia: `TEST`.
- `AC-CONF-11` — Las páginas legales llevan versión y fecha, y el
  consentimiento registra la versión aceptada. Evidencia: `TEST`.
- `AC-CONF-12` — No existe ningún ajuste que desactive confirmaciones, suba el
  riesgo aceptado o apague el verificador. Evidencia: `CODE`.
- `AC-CONF-13` — Ningún comando del catálogo permite eliminar la cuenta ni
  aceptar términos. Evidencia: `TEST`.
- `AC-CONF-14` — Exportar y eliminar funcionan **sin aceptar términos nuevos**.
  Evidencia: `TEST`.
- `AC-CONF-15` — Ningún dato financiero sale hacia terceros por analítica ni
  integraciones. Evidencia: `CODE` + `TEST`.
- `AC-CONF-16` — Una categoría no se marca como sensible sin que el usuario lo
  decida. Evidencia: `TEST`.

## 17. Fuera de alcance y puente a WhatsApp

**Diferido a V1.1:** preferencias por dispositivo, exportación programada,
sesiones nombradas.

**Prohibido, no diferido:** vender o ceder datos, entrenar modelos con datos
del usuario, publicidad o segmentación, ajustes que apaguen las protecciones
del motor, y condicionar el derecho a exportar o borrar a cualquier otra cosa.

Puente a WhatsApp: la fase 2 añade **un consentimiento más** —escribir al
teléfono— con el mismo tratamiento: se pide, se registra con versión y fecha,
y se quita en un clic. Y el modo discreto pasa a tener un significado nuevo,
porque un mensaje con un monto llega a una pantalla de bloqueo. La regla de
`RUL-NOTIF-12` —el asunto nunca lleva monto ni categoría— es la que se hereda
para eso.

## 18. Trazabilidad

**Documentos consumidos:**
`docs/fase_5_proteccion/24_privacidad_proteccion_datos.md` (obligaciones de
privacidad), migración `045`, y las páginas públicas actuales.

**Código y contenido leídos:** `/privacidad` (cero menciones de Limited Use),
`/eliminar-datos` ("no esté disponible dentro de la app"),
`/api/v1/privacy/account` y `/api/v1/privacy/export` (existen), migración `045`
(`discreet_mode_enabled` ya presente), `settings-screen.tsx` (2.081 líneas).

**Contradicciones que cierra:**

`C-04` — *"Modo discreto transversal vs. toggles locales."* Se cierra con
`RUL-CONF-03`: preferencia de servidor, un único resolvedor, aplicada al
renderizar. La columna ya existía en la migración `045`; lo que faltaba era
que las pantallas la usaran en vez de decidir cada una.

`C-14` — *"Eliminación automática disponible vs. página pública dice que puede
no estar disponible."* Confirmada leyendo el archivo. Se cierra reescribiendo
`/eliminar-datos` (`SCR-CONF-08`) y, sobre todo, con `AC-CONF-10`: el build
falla si vuelven a divergir.

`C-16` — *"Limited Use exigido vs. ausente en `/privacidad`."* Confirmada: cero
menciones. Se cierra con `RUL-CONF-08` y `AC-CONF-08`, verificado contra el
contenido publicado y no contra el que se pretendía publicar.

Las tres nacieron de lo mismo —**el producto avanzó y la declaración no**— y
por eso las tres se cierran con el mismo mecanismo: versionar juntas la
capacidad y su declaración, con un test que lo impone.

**Decisiones tomadas en este documento**, registradas en
`03_decisiones_producto_web.md`:

| Decisión | ID | Alternativa descartada | Razón |
|---|---|---|---|
| El modo discreto tiene un único punto de decisión | `no_negociable` `WEB-D121` | Que cada pantalla resuelva qué ocultar | Es `C-04`: con decisión distribuida, la exposición es desigual y nadie puede verificar la promesa. Y se aplica al renderizar en servidor, porque hacerlo en cliente deja un instante con los montos visibles |
| Lo declarado y lo hecho se versionan juntos, con test | `no_negociable` `WEB-D122` | Revisar las páginas legales periódicamente | `C-14` y `C-16` nacieron de que el producto avanzó y la página no. Una revisión periódica se salta; un build que falla, no |
| Revocar un permiso no borra lo ya registrado | `WEB-D123` | Borrar los datos de esa fuente al revocar | Borrarlos sería decidir que los datos del usuario dependen de dónde vinieron. Se ofrece como acción aparte y explícita |
| No existen ajustes que apaguen las protecciones del motor | `no_negociable` `WEB-D124` | Ofrecer un modo experto sin confirmaciones | Ofrecerlas como ajuste significa que alguien puede apagarlas, y son las reglas que protegen su dinero. La precisión nunca se adapta |
| Exportar y eliminar no dependen de aceptar nada | `no_negociable` `WEB-D125` | Bloquear la aplicación hasta aceptar términos nuevos | Condicionar esos derechos a aceptar unos términos sería usar el consentimiento como palanca, que es lo contrario de lo que un consentimiento es |
| Una categoría no se marca como sensible sola | `WEB-D126` | Marcarla al detectar descartes repetidos | Se sugiere y se pregunta. Decidir por alguien qué le avergüenza es peor que no notarlo |
