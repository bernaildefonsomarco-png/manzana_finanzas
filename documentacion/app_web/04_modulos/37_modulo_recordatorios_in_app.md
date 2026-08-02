# 37 — Módulo: Recordatorios in-app

**ID de módulo:** `MOD-RECORDATORIOS`
**Bloque:** 04 — Módulos
**Alcance:** V1
**Fecha:** 26 de julio de 2026
**Docs fuente:** `docs/fase_2_estrategia/alcance_v1/05j_nudges.md` (solo su lógica de fatiga y prioridad — ver §22), migraciones `017`, `019`, `028` y `053`
**Documentos que dependen de este:** `39` (home), `45` (privacidad), `46` (correo saliente)

---

## 1. Tesis y qué NO es

Un recordatorio existe para que **algo con fecha no se pase**. Esa es toda su
justificación, y también su límite: si no hay nada que se pueda pasar, no hay
nada que recordar.

La tesis de la reescritura es que el documento heredado resolvía un problema
que en V1-web no existe. `05j` está diseñado entero alrededor de **interrumpir
a alguien por WhatsApp**: horario silencioso, máximo de mensajes al día,
diferir al siguiente bloque permitido, competencia entre candidatos por el
derecho a sonar. En una app web sin canal push, nada de eso interrumpe a
nadie. La bandeja está donde el usuario la va a buscar.

Eso no significa que la disciplina sobre. Significa que **cambia de sitio**
(`RUL-NOTIF-02`): los límites de frecuencia y el horario silencioso gobiernan lo
que **sale por correo**, que sí es interrupción; la bandeja se gobierna con
otra cosa, que es que **lo resuelto desaparece solo** (`RUL-NOTIF-06`). Una
bandeja que acumula cuarenta avisos de cosas ya hechas no cansa por
frecuencia, cansa por inutilidad.

Y la promesa que cierra `C-17`: **ningún canal que interrumpa viene activado.**
El correo está apagado hasta que el usuario lo encienda, tipo por tipo.

**Qué NO es:**

- **No es un descubrimiento.** Un recordatorio es algo que **vence o espera
  resolución**; un descubrimiento es algo que no sabías. El primero se
  resuelve y desaparece, el segundo se lee y expira. La frontera está en
  `RUL-NOTIF-03` porque es la que más fácil se borra.
- **No ejecuta nada.** Recordar un pago no lo paga. Es la misma frontera de
  `WEB-D047` y `WEB-D038`: lo que aparece sin que nadie lo pida no cambia
  nada.
- **No es marketing.** No hay avisos de funciones nuevas, ni de promociones,
  ni de "descubre lo que puedes hacer".
- **No es WhatsApp.** Ese canal es la fase 2, y la política que lo gobierna se
  rescata de `05j` intacta en §21.

## 2. Alcance

| Nivel | Funcionalidad |
|---|---|
| **IN** | Bandeja de recordatorios en la app con badge de conteo. Los diez tipos de `RUL-NOTIF-01`, en cuatro clases con reglas distintas. Configuración granular por tipo y por canal. Política anti-fatiga para el correo. Horario silencioso. Silenciar, pausar y posponer. Resolución automática cuando la causa desaparece. Entrega por correo bajo opt-in explícito por tipo. **Ningún canal que interrumpa activado por defecto.** |
| **V1.1** | Notificaciones push del navegador. Resumen semanal por correo. Recordatorios con fecha elegida por el usuario. |
| **FUERA** | SMS. WhatsApp (fase 2). Recordatorios que ejecuten acciones. Avisos de producto, promociones o novedades. Recordatorios sobre terceros. |

## 3. Vocabulario

| Interno | Visible |
|---|---|
| `nudge`, `nudge_candidate` | — (**nunca visible**) |
| `in_app_notification` | Recordatorio |
| La bandeja | Recordatorios · "Lo que te espera" |
| `quiet_hours` | Horario en que no te escribo |
| `dismissed` | Descartado |
| `suppressed_by_activity` | — |

Prohibido frente al usuario: `nudge`, `notificación push`, `campaña`,
`engagement`, `re-engagement`, `digest`, `candidato`, además de la lista
general de `04_glosario_y_lenguaje_visible.md` §10.

Un recordatorio se enuncia **por el hecho, no por el aviso**:

```text
Correcto:   El alquiler (S/850) vence el viernes.
Correcto:   Tienes 6 movimientos del banco sin confirmar.
Incorrecto: 🔔 Recordatorio: pago próximo
Incorrecto: ¡No olvides revisar tus pendientes!
```

La tercera nombra el mecanismo. La cuarta usa la exclamación y el imperativo,
que en este módulo es donde más rápido se convierte en regaño.

## 4. Entidades y datos

### 4.1 Lo que ya existe

| Tabla | Migración | Qué guarda |
|---|---|---|
| `nudge_preferences` | `017`, `019` | Consentimiento por tipo y canal |
| `nudge_candidates` | `017`, `028` | Lo detectado, antes de decidir si se entrega |
| `nudge_deliveries` | `017` | Qué se entregó, por dónde y cuándo |
| `in_app_notifications` | `053` | **La bandeja visible** |

```sql
-- in_app_notifications, migración 053
id, user_id
nudge_delivery_id  uuid null
kind               text not null
title, body        text not null
action_url         text null
read_at            timestamptz null
dismissed_at       timestamptz null
created_at, expires_at
```

`nudge_delivery_id` es nulo en los recordatorios transaccionales, que no pasan
por el motor de decisión: una descarga lista no compite con nada
(`RUL-NOTIF-01`, clase T).

### 4.2 Migración `062` — lo que falta

**Resolución automática**, que es lo que impide que la bandeja se convierta en
un cementerio:

```sql
alter table public.in_app_notifications
  add column if not exists subject_key   text null,
  add column if not exists resolved_at   timestamptz null,
  add column if not exists snoozed_until timestamptz null;

create index if not exists in_app_notifications_open_idx
  on public.in_app_notifications (user_id, created_at desc)
  where dismissed_at is null and resolved_at is null;

create index if not exists in_app_notifications_subject_idx
  on public.in_app_notifications (user_id, subject_key)
  where resolved_at is null;
```

`subject_key` identifica **la cosa del mundo** a la que se refiere el
recordatorio (`compromiso:rec_9f2`, `cuota:debt_31c#4`,
`presupuesto:b_31f#90`). Es lo que permite resolver el recordatorio cuando esa
cosa deja de aplicar, sin que el usuario tenga que descartarlo.

Es el mismo patrón que el `fingerprint` de los descubrimientos (`WEB-D048`) y
por la misma razón: sin una identidad estable del sujeto, no se puede saber si
un aviso nuevo es el mismo de antes.

El índice parcial `open_idx` es el que sostiene el badge, que se consulta en
cada carga de página.

### 4.3 De dónde vienen los recordatorios

| Origen | Qué genera |
|---|---|
| `30` Pagos que vienen | `pago_proximo`, `pago_vencido` |
| `31` Deudas | `cuota_proxima`, `cuota_vencida` |
| `32` Presupuestos | `presupuesto_umbral` — el destino de `RUL-PRES-06` |
| `27` Pendientes | `pendientes_acumulados` |
| `28` Correo | `correo_desconectado` |
| `35` Reportes | `descarga_lista` |
| `36` Memoria | `confirmar_hecho` |
| — | `sin_registrar` (ausencia) |

Ningún módulo entrega directamente: **todos proponen y este decide**. Es lo
que hace posible que exista un límite global, y no diez límites que se ignoran
entre sí.

## 5. Máquina de estados

```text
   propuesto (nudge_candidate)
        │
        ├──► suprimido      (política, o la causa ya se resolvió)
        │
        ▼
   en bandeja ──────► leído ──────► descartado
        │  │                            (el usuario lo cierra)
        │  └──► pospuesto ──► en bandeja
        │
        └──► resuelto        (la causa desapareció, sin tocar nada)
                 │
                 ▼
             caducado        (pasó su expires_at sin resolverse)
```

| Estado | Significado | ¿Cuenta en el badge? |
|---|---|---|
| `propuesto` | Detectado, sin decidir | No |
| `suprimido` | La política o la realidad lo descartaron | No |
| `en bandeja` | Visible y sin leer | **Sí** |
| `leído` | Visto, sin resolver | No |
| `pospuesto` | El usuario pidió más tarde | No, hasta que vuelva |
| `resuelto` | La causa desapareció | No |
| `descartado` | El usuario lo cerró | No |
| `caducado` | Venció sin resolverse | No |

**`resuelto` y `descartado` se ven igual y significan lo contrario.** El
primero es el sistema diciendo "ya no hace falta"; el segundo es el usuario
diciendo "no me importa". La diferencia se usa en §16 para saber si los
recordatorios sirven.

## 6. Reglas de negocio

**`RUL-NOTIF-01` — Diez tipos en cuatro clases, con reglas distintas**

| Clase | Qué es | Canal correo | Límite diario |
|---|---|---|---|
| **T — Transaccional** | El usuario lo pidió o le concierne directamente | Opt-in | Sin límite |
| **V — De vencimiento** | Algo tiene fecha | Opt-in por tipo | 2 |
| **A — De acumulación** | Algo se está juntando | Opt-in por tipo | 1 |
| **U — De ausencia** | No has registrado nada | Opt-in, **el más restringido** | 1 cada 7 días |

| Tipo | Clase | Cuándo | Sujeto |
|---|---|---|---|
| `descarga_lista` | T | La exportación terminó | `export:<id>` |
| `correo_desconectado` | T | El buzón dejó de funcionar | `buzon:<id>` |
| `confirmar_hecho` | T | Hay un hecho de perfil que confirmar | `perfil:<key>` |
| `pago_proximo` | V | 3 días antes del vencimiento | `compromiso:<id>` |
| `pago_vencido` | V | 1 día después, si no se registró | `compromiso:<id>` |
| `cuota_proxima` | V | 3 días antes | `cuota:<debt>#<n>` |
| `cuota_vencida` | V | 1 día después | `cuota:<debt>#<n>` |
| `presupuesto_umbral` | V | Al cruzar un umbral (`RUL-PRES-06`) | `presupuesto:<id>#<umbral>` |
| `pendientes_acumulados` | A | 5 o más sin resolver, y ninguno tocado en 3 días | `pendientes` |
| `sin_registrar` | U | 7 días sin registrar nada | `ausencia` |

**Sobre `sin_registrar`, dicho sin adornos.** Es el único tipo que sirve más
al producto que al usuario: nadie necesita que le recuerden que no ha usado
una aplicación. Por eso es el más restringido de los diez, viene apagado en
todos los canales incluida la bandeja, y se suprime ante cualquier señal de
actividad (`RUL-NOTIF-07`). Se documenta como lo que es en vez de disfrazarlo de
utilidad financiera.

**`RUL-NOTIF-02` — La fatiga gobierna lo que sale, no lo que se guarda**

La corrección estructural respecto de `05j`.

| | Bandeja | Correo |
|---|---|---|
| ¿Interrumpe? | No: está donde el usuario va a buscarla | **Sí** |
| Horario silencioso | No aplica | **Aplica** |
| Límite diario | No aplica | **Aplica** (`RUL-NOTIF-01`) |
| Consentimiento | Activa por defecto | **Apagado por defecto** |
| Qué la mantiene sana | Resolución automática (`RUL-NOTIF-06`) | La política de arriba |

`05j` aplicaba una sola política a todo porque en su mundo todo era push.
Aplicarla igual aquí produciría el absurdo de **no guardar en la bandeja un
aviso relevante porque son las once de la noche**, cuando la bandeja no suena,
no vibra y no la ve nadie hasta que el usuario entra.

Que la bandeja venga activa **no contradice `C-17`**: `C-17` prohíbe activar
canales que interrumpen, y una sección de la aplicación no interrumpe a nadie.
Lo que viene apagado es el correo, tipo por tipo.

**`RUL-NOTIF-03` — Recordatorio no es descubrimiento**

| | Recordatorio (37) | Descubrimiento (34) |
|---|---|---|
| Qué es | Algo que vence o espera | Algo que no sabías |
| Tiene | Fecha o cola | Evidencia |
| Termina | **Se resuelve** y desaparece | Expira |
| Si no actúas | Puede costarte dinero | No pasa nada |
| Dónde vive | Bandeja | Su pantalla |

Prueba para decidir dónde va algo: **¿el usuario puede llegar tarde?** Si sí,
es recordatorio. Si no, es descubrimiento.

```text
"El alquiler vence el viernes"          → recordatorio: puedes llegar tarde
"Gastas más los viernes"                → descubrimiento: no hay tarde
"Vas al 90% de tu presupuesto"          → recordatorio: aún puedes decidir
"Cerraste julio dentro del presupuesto" → descubrimiento: ya pasó
```

El tercer caso es el que confunde, y por eso está resuelto en dos sitios
coherentes: el **tramo** del presupuesto es estado permanente que se ve en su
pantalla (`WEB-D032`), y el **aviso** de haber cruzado el umbral es un
recordatorio que llega una vez a esta bandeja.

**`RUL-NOTIF-04` — Ningún canal que interrumpa viene activado**

Cierra `C-17`. En el alta de una cuenta:

| Canal | Estado inicial |
|---|---|
| Bandeja en la app | Activa |
| Correo | **Apagado, en todos los tipos** |
| Push del navegador | No existe en V1 |
| WhatsApp, SMS | No existen |

El consentimiento del correo es **por tipo, no global**. Alguien puede querer
que le escriban cuando una cuota vence y no cuando se acumulan pendientes, y
tener que elegir entre todo o nada empuja a apagarlo entero.

Encenderlo se ofrece **en el momento en que tiene sentido** —al registrar la
primera deuda con cuotas, por ejemplo— y nunca como una pantalla de permisos
en el onboarding, donde nadie decide nada informadamente.

**`RUL-NOTIF-05` — Horario silencioso: 22:00 a 08:00, y solo para el correo**

Heredado de `05j` §9, con su valor por defecto intacto y su ámbito reducido.

- Un correo que caería dentro del horario silencioso **se difiere** al primer
  momento permitido, no se descarta.
- Si al abrirse la ventana hay varios pendientes, **se agrupan en uno solo**.
- Todo en `America/Lima`.
- El usuario lo puede cambiar, y decírselo al asistente basta:
  *"no me escribas después de las 10"*.
- **No aplica a nada que el usuario haya iniciado.** Pedir una exportación a
  las once de la noche y recibir el aviso a las once y un minuto es lo
  correcto.

**`RUL-NOTIF-06` — Lo resuelto desaparece solo**

La regla que mantiene la bandeja usable, y la que sustituye a la política de
frecuencia para este canal.

Cuando la causa de un recordatorio deja de aplicar, el recordatorio pasa a
`resuelto` **sin que el usuario haga nada**:

| Recordatorio | Se resuelve cuando |
|---|---|
| `pago_proximo`, `pago_vencido` | Se registra el pago, o se cancela el compromiso |
| `cuota_proxima`, `cuota_vencida` | Se registra el pago de la cuota |
| `presupuesto_umbral` | Termina el periodo, o se archiva el presupuesto |
| `pendientes_acumulados` | Quedan menos de 5 sin resolver |
| `correo_desconectado` | Se reconecta el buzón |
| `descarga_lista` | Se descarga el archivo, o caduca |
| `confirmar_hecho` | Se confirma, se rechaza o se silencia |
| `sin_registrar` | Se registra cualquier cosa |

Es lo que hace `subject_key` (§4.2): la escritura que resuelve la causa busca
por sujeto y cierra lo que corresponda, en la misma transacción.

```text
El usuario paga el alquiler y lo registra.
  → El recordatorio "El alquiler vence el viernes" pasa a resuelto.
  → El badge baja de 3 a 2.
  → Nadie descartó nada.
```

**Un recordatorio que sigue ahí después de haber hecho la cosa** es la forma
más rápida de enseñarle a alguien a ignorar la bandeja entera.

**`RUL-NOTIF-07` — Supresión por actividad**

Rescatada de `05j` §10.3 y ampliada. No se genera un recordatorio si el
usuario **ya está haciendo eso mismo**:

| Tipo | No se genera si |
|---|---|
| `pendientes_acumulados` | Resolvió pendientes en las últimas 24 h |
| `sin_registrar` | Registró algo, conversó con el asistente o corrigió datos en 7 días |
| `pago_proximo` | Ya hay uno vigente del mismo compromiso |
| Cualquiera | Existe uno sin resolver con el mismo `subject_key` |

La última fila es la general y hace innecesarias muchas reglas particulares:
**un sujeto, un recordatorio abierto.** No se apilan.

**`RUL-NOTIF-08` — Prioridad cuando compiten**

Solo importa para el correo, que tiene límite diario. Orden heredado de `05j`
§10.2, adaptado a los tipos de V1-web:

```text
1. Transaccional que el usuario pidió      (descarga_lista)
2. Algo roto que él no sabe                (correo_desconectado)
3. Vencido                                 (pago_vencido, cuota_vencida)
4. Próximo a vencer                        (pago_proximo, cuota_proxima)
5. Presupuesto en umbral
6. Acumulación                             (pendientes_acumulados)
7. Ausencia                                (sin_registrar)
```

Y la regla de desempate de `05j`, que se conserva porque es buena:

> Ante la duda entre interrumpir y guardar en la bandeja, **guardar en la
> bandeja**.

`correo_desconectado` está en segundo lugar por una razón concreta: es el
único tipo que avisa de que **el producto ha dejado de funcionar sin que se
note**. Es exactamente el fallo que `WEB-D028` describe, y descubrirlo tarde
cuesta movimientos perdidos.

**`RUL-NOTIF-09` — El badge cuenta lo abierto y sin leer, y se acota**

```text
badge = recordatorios sin leer, sin resolver, sin descartar y sin posponer
```

- Máximo mostrado: **9+**. Un número de tres cifras es ansiedad, no
  información.
- Leer la bandeja pone todo en `leído` y el badge baja a cero, aunque quede
  trabajo por hacer. **El badge mide novedad, no deuda pendiente.**
- Si el badge pasa de 9 dos veces en una semana, se registra como señal de
  producto (§16): algo está generando de más.

La segunda viñeta es una decisión: un badge que solo baja cuando resuelves
todo es un badge que se queda alto para siempre, y un indicador que nunca
llega a cero deja de mirarse.

**`RUL-NOTIF-10` — Posponer es una respuesta legítima**

Posponer mueve `snoozed_until` y el recordatorio vuelve. Opciones fijas:
**mañana, en 3 días, la semana que viene.**

No se ofrece posponer indefinidamente: para eso está descartar, que es
honesto. Y un recordatorio pospuesto que se **resuelve** mientras tanto no
vuelve nunca (`RUL-NOTIF-06` gana).

**`RUL-NOTIF-11` — Un recordatorio no ejecuta nada**

Lleva a la pantalla donde el usuario actúa, con lo que haga falta precargado.
Nunca registra el pago, nunca confirma el pendiente, nunca ajusta el
presupuesto.

Misma frontera que `WEB-D047` (descubrimientos) y `WEB-D038` (proyecciones), y
aquí es más importante que en ninguno: un recordatorio de pago que pudiera
registrar el pago convertiría un aviso en una operación de dinero disparada
por un temporizador.

**`RUL-NOTIF-12` — Modo discreto y sensibilidad**

- En modo discreto, el cuerpo del recordatorio **oculta los montos**, no el
  recordatorio: "El alquiler vence el viernes" sigue siendo útil sin el S/850.
- Los recordatorios de categorías sensibles (`RUL-DESC-13`) **no se envían por
  correo nunca**, ni con opt-in. Quedan en la bandeja.
- El asunto de un correo **nunca contiene un monto ni una categoría**: "Tienes
  un pago esta semana", no "Alquiler S/850 vence el viernes". El correo pasa
  por servidores que no controlamos y se previsualiza en pantallas de bloqueo.

La tercera es la que más fácil se incumple porque un asunto específico
funciona mejor. Funciona mejor y filtra datos financieros a la pantalla de
bloqueo de un teléfono que puede estar sobre una mesa.

## 7. Validaciones

| Campo | Regla |
|---|---|
| `kind` | De los diez tipos de `RUL-NOTIF-01` |
| `subject_key` | Obligatorio salvo en clase T sin sujeto; formato `ambito:id` |
| `title` | 1–80 caracteres, sin signos de exclamación |
| `body` | 1–200 caracteres |
| `action_url` | Ruta interna de la app; **nunca una URL externa** |
| `expires_at` | Obligatorio; máximo 30 días |
| `snoozed_until` | Futuro; máximo 30 días |
| `quiet_hours_start` / `_end` | Horas válidas; si son iguales, no hay horario silencioso |
| Preferencia de correo | Solo `true` si hay un evento de consentimiento explícito |

`action_url` restringido a rutas internas es una validación de seguridad: un
recordatorio con enlace externo sería un vector de suplantación dentro de la
propia aplicación.

## 8. Superficies

**Referencia visual: parcial.** El Dashboard de `05c` tenía una zona de avisos
descrita en `docs/fase_6_visual/32_especificacion_hifi.md` (Inicio). La
bandeja como pantalla propia y su configuración son nuevas y no tienen frame.

### `SCR-NOTIF-01` — Bandeja

**Ruta:** `/recordatorios`
**Estado en URL:** `filtro`

```text
┌──────────────────────────────────────────────────┐
│ Lo que te espera                    [Ajustes]    │
├──────────────────────────────────────────────────┤
│ El alquiler (S/850) vence el viernes.            │
│ [Registrar el pago]        [Más tarde ▾]  [✕]    │
├──────────────────────────────────────────────────┤
│ Tu cuota de la laptop (S/180) venció el 15 y no  │
│ la veo registrada.                               │
│ [Registrar el pago]  [Ya la pagué]        [✕]    │
├──────────────────────────────────────────────────┤
│ Tienes 6 movimientos del banco sin confirmar.    │
│ [Revisarlos]                              [✕]    │
├──────────────────────────────────────────────────┤
│ Dejé de recibir correos de BCP desde el 20.      │
│ Puede que hayan cambiado la dirección.           │
│ [Revisar la conexión]                     [✕]    │
├──────────────────────────────────────────────────┤
│ Resueltos esta semana (4)                 [Ver]  │
└──────────────────────────────────────────────────┘
```

Detalles que importan:

- **Ningún icono de campana, ningún color de alarma, ninguna exclamación.**
  Cada recordatorio es una frase sobre el dinero del usuario.
- El vencido no se pinta de rojo ni se pone arriba con urgencia visual: va
  primero por orden, y su texto ya dice que venció.
- "Ya la pagué" es un atajo a registrar con los datos precargados, no una
  confirmación silenciosa (`RUL-NOTIF-11`).
- "Resueltos esta semana" existe para que se vea que **la bandeja se vacía
  sola**. Sin esa prueba, el usuario no confía en que desaparezcan.

### `SCR-NOTIF-02` — Badge y acceso

Componente en la navegación. Punto con conteo hasta `9+`, con
`aria-label` que dice el número real. Abre `SCR-NOTIF-01`.

Sin conteo, el punto no aparece: **un indicador vacío que siempre está
presente enseña a ignorarlo.**

### `SCR-NOTIF-03` — Ajustes de recordatorios

**Ruta:** `/configuracion/recordatorios`

```text
┌──────────────────────────────────────────────────┐
│ Recordatorios                                    │
│ Elige de qué te aviso y por dónde.               │
├──────────────────────────────────────────────────┤
│                              En la app   Correo  │
│ Pagos que vienen                 [✓]      [ ]    │
│ Cuotas de deudas                 [✓]      [ ]    │
│ Presupuesto en su límite         [✓]      [ ]    │
│ Pendientes acumulados            [✓]      [ ]    │
│ Cuando algo deja de funcionar    [✓]      [ ]    │
│ Cuando no registras nada         [ ]      [ ]    │
├──────────────────────────────────────────────────┤
│ Por correo no te escribo entre                   │
│ [22:00] y [08:00]                                │
├──────────────────────────────────────────────────┤
│ [Pausar todo durante una semana]                 │
└──────────────────────────────────────────────────┘
```

- Toda la columna de correo **empieza vacía** (`RUL-NOTIF-04`).
- "Cuando no registras nada" empieza apagado en **las dos** columnas: es el
  tipo de clase U.
- "Pausar todo" existe porque hay semanas en las que alguien no quiere saber
  nada, y la alternativa a un pausado temporal es que lo apague todo para
  siempre.

### `SCR-NOTIF-04` — Resueltos y descartados

**Ruta:** `/recordatorios?filtro=cerrados`

Historial de solo lectura, con la distinción entre resuelto y descartado
visible. Sirve para "¿me avisaste de esto?".

### `SCR-NOTIF-05` — Recordatorios en el Inicio

Componente. **Como máximo dos**, los de mayor prioridad sin leer, con enlace a
la bandeja. Si no hay ninguno, no aparece nada (`39`).

## 9. Acciones

| ID | Acción | ¿Confirma? | Deshacer | Evento |
|---|---|---|---|---|
| `ACT-NOTIF-01` | Abrir la bandeja | No | — | `recordatorio.bandeja_abierta` |
| `ACT-NOTIF-02` | Ir a resolver | No | La de destino | `recordatorio.accion_tomada` |
| `ACT-NOTIF-03` | Posponer | No | Volviendo a la bandeja | `recordatorio.pospuesto` |
| `ACT-NOTIF-04` | Descartar | No | Restaurando 30 días | `recordatorio.descartado` |
| `ACT-NOTIF-05` | Silenciar un tipo | No | Reactivando | `recordatorio.tipo_silenciado` |
| `ACT-NOTIF-06` | Activar el correo de un tipo | **Sí** | Desactivando | `recordatorio.correo_activado` |
| `ACT-NOTIF-07` | Cambiar el horario silencioso | No | — | `recordatorio.horario_cambiado` |
| `ACT-NOTIF-08` | Pausar todo una semana | No | Reanudando | `recordatorio.pausado` |
| `ACT-NOTIF-09` | Ver los cerrados | No | — | `recordatorio.historial_visto` |

`ACT-NOTIF-06` confirma porque es un **consentimiento**: el usuario está
autorizando que le escriban a su correo. La tarjeta dice qué tipo, con qué
frecuencia máxima y que puede apagarlo cuando quiera. Queda registrado como
evento de consentimiento (`45`).

## 10. API

| Método y ruta | Notas |
|---|---|
| `GET /reminders` | Abiertos, ordenados por prioridad. Filtro `estado` |
| `GET /reminders/count` | Solo el badge. Bajo 100 ms |
| `POST /reminders/[id]/read` | Marca leído. Idempotente |
| `POST /reminders/[id]/snooze` | `{ until }`. Idempotente |
| `POST /reminders/[id]/dismiss` | Idempotente |
| `POST /reminders/read-all` | Al abrir la bandeja |
| `GET /reminder-preferences` · `PATCH` | Por tipo y canal |
| `POST /reminder-preferences/pause` · `/resume` | Pausa temporal |

`GET /reminders/count` es una ruta aparte y no un campo de otra respuesta
porque **se llama en cada carga de página**. Mezclarla con una consulta más
cara haría que el badge dependa de la latencia de todo lo demás.

Ninguna ruta crea recordatorios: los crea el motor de decisión, disparado por
eventos de dominio y por un trabajo periódico. **Un `POST /reminders` público
sería una vía para que cualquier cosa escriba en la bandeja.**

## 11. Permisos y RLS

- Cliente autenticado en todas las rutas. RLS por `user_id` en las cuatro
  tablas.
- **Dos excepciones de service-role, en la lista blanca de `15` §4:** el
  trabajo periódico que evalúa vencimientos y el que envía los correos.
  Ninguno de los dos escribe datos financieros.
- El envío de correo lee `nudge_preferences` **en el momento del envío**, no
  al encolar. Una preferencia apagada entre una cosa y la otra debe respetarse.
- Un recordatorio de otro usuario devuelve 404.

La tercera viñeta es la que evita el fallo más embarazoso de este módulo:
recibir un correo justo después de haber desactivado los correos.

## 12. Estados de datos

| Estado | Qué se muestra |
|---|---|
| **Bandeja vacía, cuenta nueva** | "Aquí te avisaré de lo que venza. Por ahora no hay nada." |
| **Bandeja vacía, con historial** | "Nada pendiente." + enlace a los cerrados |
| **Todo leído, sin resolver** | Se muestran igual, sin badge |
| **Todo pausado** | Se dice, con la fecha en que se reanuda y opción de reanudar ya |
| **Un tipo silenciado** | Se dice en ajustes; no se insiste en reactivarlo |
| **Más de 9 abiertos** | Se muestran todos, agrupados por tipo; el badge dice `9+` |
| **Cargando** | Esqueleto de dos tarjetas |
| **Modo discreto** | Textos visibles, montos ocultos (`RUL-NOTIF-12`) |

La primera fila importa: una bandeja vacía en una cuenta nueva **no es un
error ni un hueco**, es el estado correcto, y decirlo evita que parezca que
algo no cargó.

## 13. Errores

| ID | Causa | Mensaje visible | Salida |
|---|---|---|---|
| `ERR-NOTIF-01` | Recordatorio no encontrado | "Ese recordatorio ya no está." | Ver la bandeja |
| `ERR-NOTIF-02` | Posponer más de 30 días | "Puedo recordártelo hasta dentro de un mes." | Elegir otra fecha |
| `ERR-NOTIF-03` | Activar correo sin correo verificado | "Antes necesito confirmar tu correo." | Ir a verificarlo |
| `ERR-NOTIF-04` | Actuar sobre uno ya resuelto | "Eso ya está resuelto." | Ver la bandeja |
| `ERR-NOTIF-05` | Horario silencioso inválido | "Necesito una hora de inicio y una de fin." | Corregir |

## 14. Integración con el motor IA

### 14.1 Consultas que expone

| Dimensión | Notas |
|---|---|
| `tipo_recordatorio` | Los diez |
| `clase_recordatorio` | T, V, A, U |
| `estado_recordatorio` | Abierto, leído, pospuesto, resuelto, descartado, caducado |
| `canal_entrega` | Bandeja o correo |
| `fue_resuelto_solo` | Si se cerró sin que el usuario lo tocara |

| Medida | Notas |
|---|---|
| `recordatorios_abiertos` | El badge |
| `tasa_de_resolucion` | Resueltos sobre entregados |
| `dias_hasta_resolucion` | |

### 14.2 Comandos que acepta

| Comando | Confirmación |
|---|---|
| `posponer_recordatorio` | No |
| `descartar_recordatorio` | No: es reversible |
| `silenciar_tipo_recordatorio` | Tarjeta, por ser persistente |
| `cambiar_horario_silencioso` | Tarjeta con el horario resultante |
| `pausar_recordatorios` | Tarjeta con la fecha de reanudación |
| `activar_correo_recordatorios` | **Tarjeta de consentimiento** |

### 14.3 Qué se puede pedir en lenguaje natural

```text
"¿qué tengo pendiente?"                  → los abiertos
"recuérdamelo el lunes"                  → posponer_recordatorio
"no me escribas de noche"                → cambiar_horario_silencioso
"deja de avisarme de los presupuestos"   → silenciar_tipo_recordatorio
"no me molestes esta semana"             → pausar_recordatorios
"avísame por correo de las cuotas"       → activar_correo_recordatorios
```

La tercera y la quinta se ejecutan de verdad y se confirma que se hizo. Este
es el módulo donde un "entendido" sin efecto real se detecta al día siguiente
y se paga con la confianza en todo lo demás.

### 14.4 Lo que el motor NO puede hacer aquí

- **Crear un recordatorio.** Solo el motor de decisión los crea, desde eventos
  de dominio (`RUL-NOTIF-01`).
- Resolver uno sin que la causa se resuelva de verdad.
- Ejecutar la acción que el recordatorio sugiere (`RUL-NOTIF-11`).
- Activar un canal de correo sin la tarjeta de consentimiento.
- Saltarse el horario silencioso ni los límites diarios.

## 15. Memoria y aprendizaje

| Qué aprende | De dónde | Cómo se corrige |
|---|---|---|
| Qué tipos resuelve y cuáles descarta | Resolución vs. descarte | — |
| Cuánto tarda en resolver cada tipo | Tiempos | — |
| Si prefiere posponer o descartar | Acciones repetidas | — |
| Su horario real de uso | Cuándo abre la bandeja | Fijando el horario a mano |

Los cuatro son **preferencias** (`RUL-MEM-01`), no hechos de perfil: se
aplican como ajustes y no se confirman.

Efecto concreto del primero: un tipo descartado **cinco veces seguidas sin
resolverse nunca** deja de generarse y se dice en ajustes, con opción de
reactivarlo. No se pregunta; se actúa y se informa.

Efecto del cuarto, con su límite: si alguien nunca abre la app antes de las 10
de la mañana, los correos diferidos salen a esa hora en vez de a las 8. Pero
**el horario que el usuario haya fijado a mano manda siempre** (`WEB-D064`).

## 16. Eventos y telemetría

Eventos: `recordatorio.propuesto`, `.suprimido`, `.entregado`, `.leido`,
`.accion_tomada`, `.pospuesto`, `.descartado`, `.resuelto_solo`, `.caducado`,
`.tipo_silenciado`, `.correo_activado`, `.correo_desactivado`, `.pausado`,
`.diferido_por_horario`.

Sin montos, sin descripciones. Sí tipo, clase, canal y `trace_id`.

| Métrica | Qué indica |
|---|---|
| **Tasa de resolución por tipo** | Si el recordatorio sirve para algo |
| **Tasa de descarte por tipo** | Si molesta. Alta y sostenida = retirar el tipo |
| Resueltos solos sobre el total | Que `RUL-NOTIF-06` funciona |
| Tipos silenciados | Dónde se pasa de la raya |
| Usuarios que activan el correo | Si el opt-in por tipo era la forma correcta de pedirlo |
| Usuarios que pausan todo | Señal fuerte: el volumen es demasiado |
| Badge por encima de 9 | Que algo genera de más |
| Correos diferidos por horario | Si el horario por defecto es el bueno |

Las dos primeras se leen juntas y son el juicio sobre cada tipo. Resolución
alta y descarte bajo: el tipo sirve. Descarte alto: molesta. **Ambas bajas es
el peor caso**, porque significa que ni sirve ni molesta lo bastante para que
alguien lo apague — se queda ahí gastando atención.

## 17. Rendimiento

- Índices de la migración `062`:
  `in_app_notifications (user_id, created_at desc) where dismissed_at is null
  and resolved_at is null` — sostiene el badge, es el más caliente;
  `(user_id, subject_key) where resolved_at is null` — sostiene la resolución
  automática.
- `GET /reminders/count` bajo 100 ms. Es una consulta de conteo sobre índice
  parcial, no un agregado.
- La resolución automática se ejecuta **en la misma transacción** que la
  escritura que resuelve la causa, no en un trabajo posterior. Un recordatorio
  que tarda un minuto en desaparecer después de pagar es un recordatorio que
  el usuario ya descartó a mano.
- La evaluación de vencimientos es un trabajo **diario**, no continuo: nada de
  lo que avisa este módulo cambia cada minuto.
- El envío de correos va por el outbox transaccional, con idempotencia por
  `(user_id, subject_key, día)`. **Un correo duplicado es peor que un correo
  tarde.**
- Coste de modelo: **cero**. Todo determinista.

## 18. Accesibilidad específica

- El badge tiene `aria-label` con el número real y su significado: "3
  recordatorios sin leer". No solo un punto de color.
- La bandeja es una lista con `role="list"`; cada recordatorio, un `listitem`
  con encabezado.
- **Ningún recordatorio usa `role="alert"`.** Nada de lo que hay aquí es una
  emergencia, y `alert` interrumpe al lector de pantalla.
- Descartar anuncia el resultado en `aria-live="polite"` y **mueve el foco al
  siguiente recordatorio**, no al principio de la lista.
- El menú de posponer se abre con teclado y devuelve el foco a su disparador.
- Las casillas de ajustes tienen etiqueta que incluye tipo y canal: "Cuotas de
  deudas, por correo".
- El estado vencido se distingue **con texto** ("venció el 15"), nunca solo
  con color.

## 19. Casos borde

1. **El usuario paga el alquiler antes de que llegue el recordatorio.** No se
   genera: `RUL-NOTIF-07` lo suprime al no existir ya la causa.
2. **Paga después de que el recordatorio esté en la bandeja.** Pasa a
   `resuelto` en la misma transacción del registro.
3. **Compromiso eliminado con recordatorio abierto.** Se resuelve, no se
   descarta: su causa desapareció.
4. **Recordatorio pospuesto que se resuelve mientras tanto.** No vuelve
   (`RUL-NOTIF-10`).
5. **Presupuesto que cruza dos umbrales el mismo día.** Dos recordatorios con
   `subject_key` distinto —el umbral forma parte de la clave—, y ambos son
   correctos.
6. **Usuario con el correo activado que lo desactiva mientras hay uno
   encolado.** No se envía: la preferencia se lee al enviar (§11).
7. **Horario silencioso que cubre 24 horas.** Se rechaza en validación: sería
   apagar el correo por la puerta de atrás, y para eso está el interruptor.
8. **Pausa que caduca durante el horario silencioso.** Los recordatorios
   vuelven a la bandeja de inmediato; los correos esperan a la ventana.
9. **Diez pendientes acumulados durante dos semanas.** Un solo recordatorio
   abierto, actualizado con el conteo. No uno por semana.
10. **Cuenta sin ningún compromiso, deuda ni presupuesto.** No se genera nada
    de clase V, y la bandeja vacía es el estado correcto.
11. **Buzón que deja de recibir por vacaciones del usuario, no por avería.**
    Se avisa igual: el sistema no puede distinguirlo, y el aviso es barato
    frente al fallo silencioso.
12. **Correo diferido cuya causa se resuelve antes de la ventana permitida.**
    No se envía. Se comprueba la vigencia **en el momento del envío**.

Los casos 6 y 12 son la misma disciplina aplicada dos veces: **lo que se
comprueba al encolar no vale; hay que comprobarlo al enviar.**

## 20. Criterios de aceptación

- `AC-NOTIF-01` — Ningún canal que interrumpa viene activado en una cuenta
  nueva. El correo está apagado en los diez tipos. Cierra `C-17`.
  Evidencia: `TEST`. Clase: `integracion`. Cierra en `W-14`:
  `tests/rls/w14-reminders-and-search.test.ts` prueba que sin fila en
  `nudge_preferences` el canal `email` responde apagado por defecto.
- `AC-NOTIF-02` — El consentimiento del correo es por tipo, y activar uno no
  activa los demás. Evidencia: `CODE`. No cierra la parte `TEST`: el diseño
  (una fila `(user_id, nudge_type, channel)` independiente por tipo en
  `nudge_preferences`) lo garantiza por construcción, pero no hay una prueba
  que active un tipo y confirme explícitamente que otro sigue apagado.
- `AC-NOTIF-03` — Activar el correo de un tipo registra un evento de
  consentimiento explícito. Evidencia: `TEST`. Clase: `integracion`. Cierra
  en `W-14`: el evento se encola en `transactional_outbox`
  (`reminder_email_consent_granted`) porque el módulo de privacidad (`45`,
  `W-19`) todavía no tiene tabla propia de consentimientos (`WEB-D247`).
- `AC-NOTIF-04` — El horario silencioso y los límites diarios **no afectan a la
  bandeja**, solo al correo. Evidencia: `TEST`. No cierra: `WEB-D248` — el
  envío real de correo es de `46`/`W-19`; W-14 no construye la cola de
  entrega donde esta regla se aplicaría.
- `AC-NOTIF-05` — Un correo que caería en horario silencioso se difiere, y
  varios diferidos se agrupan en uno. Evidencia: `TEST`. No cierra:
  `WEB-D248`.
- `AC-NOTIF-06` — Resolver la causa resuelve el recordatorio **en la misma
  transacción**, sin intervención del usuario. Evidencia: `TEST`. Clase:
  `integracion`. Cierra en `W-14`: ocho triggers `AFTER` en la migración
  `063` (cuotas, deudas, ocurrencias recurrentes, reglas canceladas,
  presupuestos, pendientes, correo, movimientos) verificados contra
  Postgres real, con `RUL-HECHO-02` (trigger deshabilitado a propósito,
  la prueba de resolución falló, restaurado).
- `AC-NOTIF-07` — No existen dos recordatorios abiertos con el mismo
  `subject_key`. Evidencia: `TEST`. Clase: `integracion`. Cierra en `W-14`:
  índice único parcial `in_app_notifications_open_subject_unique_idx`,
  verificado con `RUL-HECHO-02` (índice comentado, la prueba de duplicado
  falló, restaurado) y con el evaluador corriendo dos veces sin duplicar.
- `AC-NOTIF-08` — Un recordatorio pospuesto que se resuelve no vuelve.
  Evidencia: `TEST`. Clase: `unidad`. Cierra en `W-14`:
  `domain.reminder-status.test.ts` prueba que `resolved_at` gana sobre
  `snoozed_until` en `computeReminderStatus`.
- `AC-NOTIF-09` — El badge cuenta solo lo abierto y sin leer, y muestra `9+`
  como máximo. Evidencia: `CODE`. No cierra la parte `TEST`: el mecanismo
  existe (`countOpenReminders`, `GET /reminders/count` con
  `Math.min(count, 9)`), pero no hay una prueba dedicada que ejercite el
  límite de exhibición.
- `AC-NOTIF-10` — Ningún recordatorio ejecuta una acción; todos navegan.
  Evidencia: `CODE`. No cierra la parte `TEST`: `action_url` siempre se
  renderiza como `<Link>`, nunca como un botón que despacha un comando, mas
  no hay una prueba automatizada que lo verifique.
- `AC-NOTIF-11` — `action_url` es siempre una ruta interna. Evidencia:
  `CODE`. No cierra la parte `TEST`: la restricción
  `in_app_notifications_action_url_internal` de la migración `063` la
  impone en la base, pero ninguna prueba intenta insertar una URL externa
  para confirmar el rechazo.
- `AC-NOTIF-12` — El asunto de un correo no contiene montos ni categorías.
  Evidencia: `TEST`. No cierra: `WEB-D248`.
- `AC-NOTIF-13` — Los recordatorios de categorías sensibles no salen por correo
  ni con opt-in. Evidencia: `TEST`. No cierra: `WEB-D248`; tampoco existe
  todavía el filtro de categoría sensible sobre el envío.
- `AC-NOTIF-14` — La preferencia de canal se lee **en el momento del envío**, no
  al encolar. Evidencia: `TEST`. No cierra: `WEB-D248`.
- `AC-NOTIF-15` — El envío es idempotente por `(user_id, subject_key, día)`.
  Evidencia: `TEST`. No cierra: `WEB-D248`.
- `AC-NOTIF-16` — `sin_registrar` viene apagado en todos los canales, incluida
  la bandeja. Evidencia: `CODE` + `TEST` parcial. No cierra completo: el
  motor (`reminder-engine.ts`) genera el candidato de forma determinista,
  y `reminders-evaluate.repository.ts::isDashboardEnabled` lo apaga por
  defecto para este tipo — pero no hay una prueba de integración que
  ejercite ese apagado por defecto de punta a punta.
- `AC-NOTIF-17` — Un tipo descartado 5 veces seguidas sin resolverse deja de
  generarse, y se dice en ajustes. Evidencia: `TEST`. No cierra: no se
  construyó en este corte — el aprendizaje de descartes repetidos queda
  abierto.
- `AC-NOTIF-18` — Ningún recordatorio usa `role="alert"` ni signos de
  exclamación. Evidencia: `TEST` (título, constraint DB +
  `reminder-engine.test.ts`) + `CODE` (la bandeja usa `role="listitem"`,
  nunca `role="alert"`). Clase: `unidad`. Cierra en `W-14`.
- `AC-NOTIF-19` — El motor no puede crear un recordatorio ni saltarse el horario
  silencioso. Evidencia: `TEST`. No cierra: verificable solo cuando exista
  el motor conversacional que podría intentarlo (`W-16`/`W-17`); hoy es
  cierto por ausencia, no por una prueba que lo demuestre.
- `AC-NOTIF-20` — No existe ninguna ruta pública que cree recordatorios.
  Evidencia: `CODE`. Cierra en `W-14`: `POST /reminders` no existe; toda
  creación pasa por los triggers de la migración `063` (service-role) o el
  evaluador diario (`src/app/api/internal/jobs/reminders-evaluate/`,
  lista blanca permanente de `15` §4).

## 21. Fuera de alcance y puente a WhatsApp

**Diferido a V1.1:** push del navegador, resumen semanal por correo,
recordatorios con fecha elegida por el usuario ("recuérdame esto el 12").

**Prohibido, no diferido:** SMS, recordatorios que ejecuten acciones, avisos
de producto o promociones, recordatorios sobre terceros, y activar cualquier
canal sin consentimiento explícito por tipo.

Puente a WhatsApp: **este es el módulo que más cambia en la fase 2**, porque
es el único cuya naturaleza depende del canal. En V1-web casi nada interrumpe;
en WhatsApp todo interrumpe.

Lo que se rescata de `05j` cuando llegue ese momento, y que aquí se deja
documentado en vez de perdido:

| De `05j` | Por qué sigue siendo bueno |
|---|---|
| Máximo 2 no solicitados al día, 1 sensible (§10.1) | Calibrado para un canal que suena |
| La competencia entre candidatos (§10.2) | `RUL-NOTIF-08` es su versión reducida |
| Máximo 2 por ocurrencia de un mismo pago (§10.1) | Antes y después, nunca más |
| Re-engagement máximo 1 cada 7 días (§10.1) | Coincide con `sin_registrar` |
| Agrupar al abrir la ventana (§9) | `RUL-NOTIF-05` ya lo aplica al correo |

Y la regla que **no** cambia con el canal: ningún tipo se activa solo. Un
usuario que dio su número no autorizó que le escriban.

## 22. Trazabilidad

**Documento de `docs/` parcialmente reescrito:**
`docs/fase_2_estrategia/alcance_v1/05j_nudges.md` (1.2k líneas). Se conserva
**su lógica de fatiga, prioridad y consentimiento**, y se descarta su premisa:
que el canal principal interrumpe.

**Qué se rescata:**

| De `05j` | Dónde vive ahora |
|---|---|
| Horario silencioso 22:00–08:00, diferir y agrupar (§9) | `RUL-NOTIF-05`, aplicado solo al correo |
| Competencia entre candidatos (§10.2) | `RUL-NOTIF-08` |
| "Ante la duda, guardar en el Dashboard" (§10.2) | `RUL-NOTIF-08`, literal |
| Supresión por actividad (§10.3) | `RUL-NOTIF-07`, ampliada |
| Consentimiento por tipo y canal (§8) | `RUL-NOTIF-04` |
| Modo discreto en avisos (§11) | `RUL-NOTIF-12` |
| Las tablas `nudge_*` de las migraciones `017`, `019`, `028` | §4.1, intactas |

**Qué se descarta:**

| De `05j` | Razón |
|---|---|
| Aplicar la política de frecuencia a todo por igual (§10) | Su premisa era que todo interrumpe. Aplicarla a la bandeja produciría no guardar un aviso relevante porque son las once de la noche |
| Todo el bloque de WhatsApp (§13, §15) | Es la fase 2; lo aprovechable queda en §21 |
| El vocabulario `nudge` en superficie (§2) | `04` §10 lo prohíbe |
| La reconstrucción diaria como tipo normal (§10.1) | Sobrevive como `sin_registrar`, de clase U, apagado por defecto y documentado como lo que es |

**Contradicciones que cierra:**

`C-17` — *"Proactivos activados por defecto vs. consentimiento atómico y gate
live posteriores."* Se cierra a favor de la regla posterior con `RUL-NOTIF-04`,
`SCR-NOTIF-03` —donde la columna de correo se ve vacía— y `AC-NOTIF-01`. La
tabla antigua de `05a` que los daba por activados no se hereda.

**Decisiones tomadas en este documento**, registradas en
`03_decisiones_producto_web.md`:

| Decisión | ID | Alternativa descartada | Razón |
|---|---|---|---|
| La fatiga gobierna el correo, no la bandeja | `WEB-D066` | Una sola política para todos los canales, como `05j` | La bandeja no interrumpe: está donde el usuario va a buscarla. La política única produciría no guardar un aviso relevante por la hora que es |
| Lo resuelto desaparece solo | `WEB-D067` | Que el usuario descarte lo ya hecho | Un recordatorio que sigue ahí después de haber hecho la cosa enseña a ignorar la bandeja entera |
| Recordatorio y descubrimiento se separan por "¿puedes llegar tarde?" | `WEB-D068` | Una sola bandeja de avisos | Sin la frontera, todo acaba interrumpiendo o nada acaba avisando |
| El badge mide novedad, no deuda | `WEB-D069` | Que cuente todo lo no resuelto | Un indicador que nunca llega a cero deja de mirarse |
| El correo se consiente por tipo, no en bloque | `WEB-D070` | Un interruptor global | Elegir entre todo o nada empuja a apagarlo entero, y se pierde el aviso que sí importaba |
| El asunto del correo nunca lleva monto ni categoría | `WEB-D071` | Asuntos específicos, que funcionan mejor | Funcionan mejor y filtran datos financieros a la pantalla de bloqueo de un teléfono sobre una mesa |
| `sin_registrar` se documenta como lo que es | `WEB-D072` | Presentarlo como ayuda financiera | Es el único tipo que sirve más al producto que al usuario. Reconocerlo es lo que justifica que sea el más restringido de los diez |
| La preferencia de canal se lee al enviar, no al encolar | `WEB-D073` | Comprobarla al encolar | Recibir un correo justo después de haberlos desactivado es el fallo que destruye la confianza en el interruptor |
