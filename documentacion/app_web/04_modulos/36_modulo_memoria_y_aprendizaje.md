# 36 — Módulo: Memoria y aprendizaje

**ID de módulo:** `MOD-MEMORIA`
**Bloque:** 04 — Módulos
**Alcance:** V1
**Fecha:** 26 de julio de 2026
**Docs fuente:** ninguno — **módulo nuevo**. Gobierna las §15 de los once módulos anteriores. Se apoya en `20c_perfil_del_usuario_y_voz.md`, las migraciones `044_learning_governance` y `054`, y `WEB-D023`
**Documentos que dependen de este:** `41` (asistente), `45` (privacidad), `48` (ayuda)

---

## 1. Tesis y qué NO es

Cada uno de los once módulos anteriores declara en su §15 lo que aprende.
Ninguno declara **quién gobierna eso**, qué pasa cuando dos aprendizajes se
contradicen, ni cómo hace el usuario para desactivar uno. Este módulo es esa
respuesta, y es lo que convierte "el producto aprende de ti" de una promesa de
marketing en algo verificable.

La tesis: **un aprendizaje que el usuario no puede ver es un aprendizaje que
no debería existir.** No por principio abstracto, sino porque un sistema que
deduce cosas en silencio acaba equivocándose en silencio, y el usuario nota
que algo va mal sin poder señalar qué.

De leer las once §15 juntas sale la estructura del módulo: **lo que se aprende
no es una sola cosa, son tres, y necesitan gobiernos distintos**
(`RUL-MEM-01`). Tratarlas igual produce uno de dos productos malos: uno
insoportable, que pide confirmar que prefieres ver tablas; o uno peligroso,
que da por hecho en silencio que cobras el 15 y proyecta tu mes encima.

Y la parte que cierra `C-08`: **ver, corregir, deshacer y olvidar** son cuatro
acciones obligatorias sobre cualquier cosa aprendida (`RUL-MEM-06` a
`RUL-MEM-09`). Las cuatro, no tres. Que falte "olvidar" es exactamente el
estado actual, donde la memoria es reversible en el modelo de datos y no hay
forma de llegar a ella desde la interfaz.

**Qué NO es:**

- **No es el perfil.** `20c` define **qué** se sabe de la persona y cómo
  cambia la conversación. Este módulo define **cómo se guarda, se muestra y se
  revoca**. Uno es la voz, el otro es el control.
- **No es un historial de actividad.** No registra qué hizo el usuario, sino
  qué concluyó el sistema a partir de ello.
- **No es un motor de recomendación.** No hay perfilado con fines de
  segmentación, publicidad ni puntuación.
- **No es memoria conversacional.** Lo que se dijo en un hilo vive en el hilo
  (`41`); aquí solo llega lo que se convirtió en un hecho.

## 2. Alcance

| Nivel | Funcionalidad |
|---|---|
| **IN** | Las tres clases de aprendizaje de `RUL-MEM-01` con su gobierno. Todo lo aprendido, visible y explicable. Evidencia a favor **y en contra** de cada aprendizaje. Las cuatro acciones obligatorias: ver, corregir, deshacer, olvidar. Estados completos, incluidos `suspendido` y `caducado`. Degradación por contradicción, no solo refuerzo. Lápidas que impiden reaprender lo olvidado. Auditoría de todo cambio. Exportación de lo aprendido (vía `35`). |
| **V1.1** | Explicación de cómo un aprendizaje concreto afectó una clasificación específica del pasado. Deshacer con ventana más larga. Reglas de memoria escritas por el usuario. |
| **FUERA** | Perfilado con fines publicitarios o de scoring. Compartir aprendizajes entre usuarios. Entrenar modelos con datos del usuario. Inferir atributos protegidos (salud, ideología, orientación, religión). Conclusiones sobre terceros. |

## 3. Vocabulario

| Interno | Visible |
|---|---|
| `financial_memory_item` | Algo que aprendí |
| `learning_candidate` | Algo que creo haber notado |
| `user_profile_fact` | Algo que sé de ti |
| `positive_evidence` / `negative_evidence` | "Lo vi N veces" / "Me corregiste N veces" |
| `lifecycle_status: suspended` | "Dejé de aplicarlo" |
| `revoked` | Olvidado |
| `tombstone` | — (nunca visible) |
| `confidence`, `weight` | — (**nunca visibles**, `C-11`) |

Prohibido frente al usuario: `aprendizaje`, `modelo`, `entrenar`, `inferir`,
`candidato`, `confianza`, `peso`, `perfilado`, `segmento`, además de la lista
general de `04_glosario_y_lenguaje_visible.md` §10.

La memoria se enuncia **en primera persona y como algo revisable**, nunca como
un veredicto sobre la persona:

```text
Correcto:   Aprendí que "Rappi" lo pones en Alimentación.
            Lo vi 12 veces. [Está bien]  [Corregir]  [Olvidar]
Correcto:   Me dijiste que cobras el 15 y el último día del mes.
Incorrecto: Perfil: usuario de gasto alto en delivery.
Incorrecto: Detectamos que eres un comprador impulsivo.
```

## 4. Entidades y datos

### 4.1 Las tres clases y dónde vive cada una

| Clase | Tabla confirmada | Tabla de candidatos | Migración |
|---|---|---|---|
| **Clasificatorio** | `financial_memory_items` | `learning_candidates` | `044` |
| **Hecho de perfil** | `user_profile_facts` | `user_profile_candidates` | `054` |
| **Preferencia de uso** | `learned_preferences` | — (no hay candidatos) | `061`, nueva |

Las preferencias no tienen tabla de candidatos porque no se confirman: se
observan y se aplican. Ver `RUL-MEM-01`.

**`learned_preferences` no es `user_preferences`.** La tabla de la migración
`002` guarda lo que el usuario **eligió**: tono, modo discreto, horario
silencioso, cuenta por defecto. Esta guarda lo que el sistema **observó** que
suele hacer. Son cosas distintas y no deben compartir tabla, porque entre
ellas hay una jerarquía (`RUL-MEM-14`) que se pierde si se mezclan.

### 4.2 `financial_memory_items` — lo clasificatorio

Ya existe. La migración `044` le añadió lo que hace posible este módulo:

```sql
lifecycle_status        text   -- confirmed | suspended | revoked | expired | superseded
positive_evidence_refs  text[]
negative_evidence_refs  text[]
positive_evidence_count integer
negative_evidence_count integer
explanation             text
review_at, last_used_at, suspended_at
revoked_at, revoked_reason
sensitive_confirmed_at
source_candidate_id     → learning_candidates
supersedes_memory_id    → financial_memory_items
```

Las dos columnas de **evidencia negativa** son la pieza que distingue este
diseño de una tabla de reglas: un aprendizaje puede **degradarse**, no solo
reforzarse. Sin ellas, corregir una clasificación diez veces deja intacta la
regla que la produjo.

`supersedes_memory_id` encadena las versiones: corregir no borra, encadena. Es
lo que permite deshacer.

### 4.3 `learning_candidates` — lo observado sin confirmar

```sql
status  text  -- observed | pending_confirmation | accepted
              -- | rejected | superseded | suspended | expired
positive_evidence_refs, negative_evidence_refs
positive_evidence_count, negative_evidence_count
positive_evidence_weight, negative_evidence_weight
last_evidence_at, last_conflict_at, review_at
promoted_memory_id  → financial_memory_items
```

### 4.4 `user_profile_facts` y `user_profile_candidates` — la persona

Documentadas en `13` §7.5b. Lo que importa aquí:

- `origin` distingue `dicho` de `observado_confirmado`. **Un hecho observado y
  no confirmado nunca entra en esta tabla**: vive como candidato.
- `status` incluye `en_duda`: ante contradicción se suspende, no se borra, y
  el usuario puede restaurarlo con su historia intacta.
- `validity` separa lo permanente de lo revisable y lo volátil.
- `ask_count` en candidatos: si el usuario ignora dos veces, no se vuelve a
  preguntar (`20c` §3).

### 4.5 Migración `061` — preferencias observadas, lápidas y auditoría

**`learned_preferences`** — lo que el sistema observó sobre cómo usa la app:

```sql
id                uuid pk
user_id           uuid not null
source_module     text not null    -- '30' | '32' | '34' | '35'
key               text not null    -- 'reporte.periodo', 'reporte.vista',
                                   -- 'sugerencias.tolerancia'
value             jsonb not null
observation_count integer not null default 1
last_observed_at  timestamptz not null default now()
created_at, updated_at
```

Único por `(user_id, key)`: una observación nueva **reemplaza** a la anterior,
no se acumula (`RUL-MEM-03`, tercera fila).

`source_module` existe para la métrica de §16 que localiza dónde se corrige
más: sin él, "las correcciones se concentran en el módulo 28" no se puede
consultar.

**`memory_tombstones`** — lo que impide reaprender lo olvidado:

```sql
id          uuid pk
user_id     uuid not null
scope       memory_scope not null   -- clasificacion | perfil | preferencia
subject_key text not null           -- 'comercio:Rappi', 'vida:trabajo'
reason      text null
created_at  timestamptz not null default now()
lifted_at   timestamptz null
lifted_by   text null               -- 'accion_explicita_del_usuario'
```

Único por `(user_id, scope, subject_key)` cuando `lifted_at is null`.

**Por qué existe.** Sin lápida, "olvidar" borra una fila y el sistema
reaprende lo mismo mañana desde los mismos movimientos, que siguen ahí. El
usuario lo olvida, reaparece, lo olvida otra vez, reaparece. Es el fallo que
convierte una función de control en una broma. La lápida es lo que hace que
olvidar signifique algo (`RUL-MEM-09`).

**`memory_events`** — auditoría de las cuatro acciones:

```sql
id, user_id
scope        memory_scope not null
subject_id   uuid not null
action       memory_action not null  -- visto | corregido | deshecho | olvidado
                                     -- | suspendido | restaurado | aplicado
previous     jsonb null
next         jsonb null
actor        text not null           -- usuario | sistema
idempotency_key text null
created_at
```

Mismo patrón que `user_profile_events` (`054`) y
`experience_preference_events` (`045`), unificado para las tres clases: sin
una tabla común, "muéstrame todo lo que ha cambiado en tu memoria sobre mí"
requeriría tres consultas con tres formas distintas.

### 4.6 De dónde vienen los aprendizajes

Agregación de las §15 de los once módulos anteriores. **Esta tabla es el
contrato:** ningún módulo aprende nada que no esté aquí.

| Origen | Qué aporta | Clase |
|---|---|---|
| `24` Cuentas | Cuenta habitual, cómo llama a sus cuentas, qué caja usa para qué | Clasificatorio |
| `24` Cuentas | Dónde entran ingresos regulares → **cómo le pagan** | Perfil |
| `25` Categorías | **Comercio → categoría, texto → categoría, vocabulario propio** | Clasificatorio |
| `26` Movimientos | Comercio habitual, montos típicos, cómo describe | Clasificatorio |
| `27` Pendientes | Confirmaciones y descartes como evidencia ± sobre cada patrón | Clasificatorio |
| `28` Correo | Comercio → cuenta, remitentes por banco, **contexto aportado** | Clasificatorio |
| `29` Captura | **Abreviaturas propias**, patrones repetidos | Clasificatorio |
| `30` Recurrentes | Comercios que se repiten, montos típicos, tolerancia a sugerencias | Clasificatorio + Preferencia |
| `31` Deudas | Personas recurrentes, cómo llama a sus deudas, ritmo de pago | Clasificatorio |
| `32` Presupuestos | Montos habituales, si ajusta al superar, tolerancia | Preferencia |
| `33` Proyecciones | **Cuándo y cuánto cobra** (solo confirmado) | Perfil |
| `34` Descubrimientos | Qué tipos le sirven, qué le resulta sensible | Preferencia |
| `35` Reportes | Periodo, agrupación y vista preferidos | Preferencia |
| `20c` Perfil | Las cuatro capas: estilo, vida, vínculo, hilo | Perfil |

El **contexto aportado** del módulo 28 es la entrada más rica de toda la
tabla, y la única que es texto del usuario explicando su propio dinero. Se
trata como `dicho`, no como observado: no necesita confirmación porque ya la
tiene.

## 5. Máquina de estados

### 5.1 Un aprendizaje clasificatorio

```text
   observado
       │  se repite
       ▼
   candidato ──rechazado──► descartado
       │
       │ se aplica y no lo corrigen
       ▼
   ┌───────────┐  contradicciones   ┌────────────┐
   │ confirmado│──────────────────► │ suspendido │
   └─────┬─────┘                    └─────┬──────┘
         │                                │ el usuario dice que sí valía
         │ el usuario corrige             ▼
         ├──► reemplazado (encadena) ─► confirmado (nuevo)
         │
         └──► olvidado ──► deja lápida, no se reaprende
```

| Estado | Significado | ¿Se aplica? |
|---|---|---|
| `observed` | Se vio una vez | No |
| `pending_confirmation` | Se repitió lo bastante para preguntarse | No |
| `confirmed` | Se aplica | **Sí** |
| `suspended` | Demasiadas contradicciones; **deja de aplicarse** y se conserva | No |
| `superseded` | El usuario corrigió; encadenado al nuevo | No |
| `revoked` | Olvidado por el usuario, con lápida | No, **nunca** |
| `expired` | Caducó por desuso | No |

`suspended` y `revoked` se ven idénticos por fuera y son muy distintos por
dentro: el suspendido puede volver si la evidencia cambia; el revocado no
vuelve nunca sin una acción explícita del usuario.

### 5.2 Un hecho de perfil

```text
   observado ──► candidato ──preguntado──► vigente
                     │                        │
                     │ ignorado 2 veces       │ contradicción
                     ▼                        ▼
                 abandonado               en duda ──► vigente (lo restaura)
                                              │
                                              ├──► suspendido
                                              └──► olvidado (lápida)
```

La diferencia con lo clasificatorio: **un hecho de perfil no pasa a vigente
sin que el usuario lo confirme**. Nunca. Es `WEB-D023` y es lo que impide que
el sistema proyecte el mes de alguien sobre un día de cobro que se inventó.

### 5.3 Una preferencia

```text
   observada ──► aplicada ──► reemplazada por otra observación
                     │
                     └──► olvidada (vuelve al default)
```

Sin confirmación y sin estados intermedios. Ver `RUL-MEM-01`.

## 6. Reglas de negocio

**`RUL-MEM-01` — Tres clases de aprendizaje, tres gobiernos**

La regla que estructura el módulo. Sale de leer juntas las once §15
anteriores, donde conviven cosas que no se parecen en nada.

| | **Clasificatorio** | **Hecho de perfil** | **Preferencia de uso** |
|---|---|---|---|
| Qué es | Cómo interpretar un dato | Algo sobre la persona | Cómo usa la app |
| Ejemplo | "Rappi" → Alimentación | "Cobra el 15 y fin de mes" | Prefiere ver la tabla |
| Se aplica | Automáticamente | **Solo tras confirmar** | Automáticamente |
| ¿Se pregunta? | No: corregir es la confirmación | **Sí, explícitamente** | No |
| Contradicción | Evidencia negativa; degrada y suspende | Pasa a `en duda` | Se reemplaza |
| ¿Afecta al dinero? | Indirectamente (clasifica) | **Sí** (proyecciones, periodos) | No |
| Dónde se ve | Agrupado por tipo | Uno a uno, con su frase | Agrupado, al final |

**La columna que justifica todo el diseño es "¿afecta al dinero?".** Un hecho
de perfil equivocado —creer que alguien cobra el 15— entra en las
proyecciones, en los periodos y en cómo se lee su mes entero. Una
clasificación equivocada se ve en pantalla y se corrige en un clic. Una
preferencia equivocada muestra una pestaña que no era.

Por eso solo la clase del medio pregunta antes de creer. Preguntar por todo
haría el producto insoportable; no preguntar por nada lo haría peligroso justo
donde más cuesta detectarlo.

**`RUL-MEM-02` — Todo aprendizaje lleva su evidencia, a favor y en contra**

No basta con "lo vi 12 veces". Se guardan las referencias concretas, de las
dos clases:

```text
Aprendí que "Rappi" lo pones en Alimentación.
  A favor:  12 movimientos que clasificaste así  [ver los 12]
  En contra: 1 vez que lo pusiste en Ocio        [ver ese]
  La última vez que lo apliqué: hace 2 días
```

La evidencia negativa es lo que permite que un aprendizaje **se degrade**. Sin
ella, un sistema solo acumula certeza y nunca duda, que es la forma más rápida
de equivocarse con confianza.

**`RUL-MEM-03` — La contradicción suspende, nunca borra**

Cuando la evidencia negativa supera el umbral, el aprendizaje pasa a
`suspended`: **deja de aplicarse y se conserva con toda su historia.**

| Clase | Umbral de suspensión |
|---|---|
| Clasificatorio | 3 correcciones seguidas, o negativa ≥ positiva |
| Hecho de perfil | 1 contradicción explícita del usuario → `en duda` |
| Preferencia | No suspende: la observación nueva reemplaza a la vieja |

La asimetría de la segunda fila es deliberada: para un hecho sobre la persona,
**una sola contradicción basta**. Si alguien dice "ya no trabajo ahí", no hace
falta una tercera confirmación para dejar de asumirlo.

Se suspende y no se borra porque el usuario puede querer restaurarlo: "no, sí
sigue igual, fue un mes raro". Con la historia conservada, restaurar es un
clic; con la fila borrada, hay que reaprender desde cero.

**`RUL-MEM-04` — El pasado no se reescribe**

Olvidar o corregir un aprendizaje **afecta a lo que venga, nunca a lo ya
registrado**.

```text
"Rappi" → Alimentación, aplicado a 30 movimientos.
El usuario lo olvida.
  → Los 30 movimientos siguen en Alimentación.
  → El próximo Rappi llega sin categoría sugerida.
```

Coherente con `RUL-PRES-13` (editar un presupuesto no reescribe periodos
cerrados) y con `35` §19 caso 2 (un reporte del pasado no se reescribe). Es la
misma idea en tres módulos: **el historial es un registro de lo que pasó, no
una vista de lo que ahora creemos.**

Si el usuario quiere reclasificar los 30, existe la acción explícita en el
módulo 26 y se le ofrece:

```text
Olvidado. Los 30 movimientos que ya clasifiqué así se quedan como están.
[Reclasificar esos 30 también]
```

**`RUL-MEM-05` — Nada se aprende de un dato que el usuario no confirmó**

Un pendiente sin confirmar (`27`), un movimiento eliminado, un correo sin
resolver: **ninguno genera evidencia**. Aprender de datos no confirmados
significa aprender de lo que el sistema supuso, y eso es un bucle donde el
error se refuerza a sí mismo.

Corolario: cuando el usuario **edita antes de confirmar**, se genera evidencia
positiva de lo corregido y **negativa de lo propuesto** (`27` §15). Ese doble
registro es lo que hace que el detector mejore en vez de repetir el mismo
fallo.

**`RUL-MEM-06` — Ver: todo lo aprendido, en un solo sitio**

La primera de las cuatro acciones de `C-08`. Requisitos verificables:

1. **Todo** aprendizaje activo es alcanzable desde `/configuracion/memoria`.
   No hay memoria que solo se pueda ver desde el módulo que la generó.
2. Cada uno se muestra con su enunciado en primera persona, su evidencia y sus
   cuatro acciones.
3. Se agrupa por clase, y dentro por tipo, con conteo.
4. Lo suspendido y lo olvidado son visibles en una sección aparte: **ocultar
   lo que se dejó de usar impide comprobar que se dejó de usar.**

**`RUL-MEM-07` — Corregir: decir cuál era la respuesta buena**

Corregir **encadena, no sobrescribe**: el aprendizaje anterior pasa a
`superseded` con `supersedes_memory_id` apuntando al nuevo. Se puede hacer
desde la pantalla de memoria o desde el flujo normal del módulo de origen
—reclasificar un movimiento corrige el aprendizaje— y **las dos vías producen
exactamente el mismo efecto**.

Que las dos vías converjan es lo que evita el fallo clásico: corregir en la
pantalla de memoria y que el sistema siga aplicando lo viejo porque la
corrección solo tocó una tabla.

**`RUL-MEM-08` — Deshacer: volver atrás lo reciente**

Ventana de **30 días** desde el cambio, y solo sobre cambios registrados en
`memory_events`. Deshacer una corrección restaura el aprendizaje anterior con
su evidencia; deshacer un olvido levanta la lápida.

Treinta días y no cinco minutos porque el usuario **no descubre el efecto de
haber olvidado algo en el momento de olvidarlo**: lo descubre la siguiente vez
que registra un gasto y el sistema ya no lo clasifica. Una ventana de minutos,
como la de deshacer un movimiento (`23` §5b), sería la ventana equivocada para
esta acción.

**`RUL-MEM-09` — Olvidar: que no vuelva**

La cuarta acción, y la que más fácil se implementa mal.

Olvidar hace tres cosas, y las tres son necesarias:

1. El aprendizaje pasa a `revoked`, con `revoked_at` y `revoked_reason`.
2. **Se crea una lápida** en `memory_tombstones` con su `subject_key`.
3. El proceso de aprendizaje **consulta las lápidas antes de crear cualquier
   candidato**, y no crea ninguno cuya clave tenga lápida vigente.

Sin el paso 2 y el 3, olvidar borra una fila y el sistema reaprende lo mismo
mañana desde los mismos movimientos, que siguen ahí. El usuario olvida,
reaparece, olvida, reaparece. Es lo que convierte una función de control en
una broma, y es el fallo que hay que impedir por construcción.

**La lápida se levanta con una acción explícita del usuario sobre la misma
clave.** Si alguien olvida "Rappi → Alimentación" y luego clasifica Rappi como
Alimentación manualmente, el sistema puede volver a aprenderlo: el usuario ha
cambiado de opinión y lo ha dicho con sus actos. Lo que la lápida impide es
que vuelva **solo**.

```text
Olvidar   ≠  Corregir
Corregir dice "la respuesta buena es esta otra".
Olvidar dice "no tengas opinión sobre esto".

Sin la segunda, el usuario no tiene forma de hacer que el
producto se calle sobre algo. Solo puede cambiarle de tema.
```

**`RUL-MEM-10` — Todo cambio queda auditado**

Las cuatro acciones, más suspender, restaurar y aplicar, escriben en
`memory_events` con estado anterior, estado siguiente y actor. La auditoría
sirve para tres cosas concretas, no para cumplir un formalismo:

- Que deshacer sea posible (`RUL-MEM-08` lee de aquí).
- Que el usuario pueda ver **qué cambió en lo que el sistema cree de él y
  cuándo**.
- Que ante una queja —"me clasificó mal esto"— exista la respuesta.

**`RUL-MEM-11` — Lo sensible se aprende con más cuidado, o no se aprende**

| Qué | Regla |
|---|---|
| Categorías sensibles (salud, farmacia, y las marcadas en `45`) | Se aprende la clasificación, **no se generan hechos de perfil** |
| Atributos protegidos (salud, ideología, orientación, religión) | **Nunca se infieren**, ni como candidato |
| Personas relacionadas (`31`) | Se guarda el nombre que el usuario puso; **no se concluye nada sobre ellas** |
| Contexto aportado sobre terceros | Se guarda como texto del usuario, no se procesa para deducir |

La segunda fila es un límite duro y no una preferencia. Un patrón de gasto
puede correlacionar con un atributo protegido —una farmacia recurrente, una
cuota mensual a una organización— y **la correlación no es permiso**. El
sistema clasifica el gasto y ahí se detiene.

`sensitive_confirmed_at` en `financial_memory_items` registra que el usuario
aceptó explícitamente que se recuerde algo de una categoría sensible.

**`RUL-MEM-12` — Los datos del usuario no entrenan ningún modelo**

En V1-web **no existe ningún consentimiento de entrenamiento, y por tanto no
se entrena con datos de nadie.** Los datos del usuario se usan para
responderle a él, en su sesión, y para nada más.

Lo que no ocurre, dicho explícitamente porque el silencio en esto se
interpreta mal: no se agregan aprendizajes entre usuarios, no se construyen
catálogos globales de comercios a partir de clasificaciones de nadie, no se
usan conversaciones para ajustar ningún modelo.

Y una observación de diseño que hace innecesario el aprendizaje compartido:
**"Rappi es una app de delivery" no es un aprendizaje, es conocimiento del
mundo**, y por `WEB-D021b` lo aporta el modelo. El único caso que parecía
justificar cruzar datos entre usuarios se resuelve sin cruzar nada.

Si alguna vez se ofreciera, exigiría consentimiento explícito, granular,
revocable, con efecto retroactivo al revocarlo, y **desactivado por defecto**.
Nada de eso existe en V1.

**`RUL-MEM-13` — Caducidad por desuso**

| Clase | Caduca |
|---|---|
| Clasificatorio | 12 meses sin aplicarse (`last_used_at`) |
| Perfil `permanente` | No caduca |
| Perfil `revisable` | Se reconfirma a los 6 meses |
| Perfil `volatil` | Caduca en su `expires_at` |
| Preferencia | No caduca; se reemplaza |

Caducar no es olvidar: pasa a `expired`, sigue visible en la sección de
inactivos y puede reactivarse. Un comercio al que el usuario vuelve tras un
año no debería obligarle a enseñárselo todo de nuevo.

**`RUL-MEM-14` — Lo declarado gana a lo observado, siempre**

Cuando un ajuste que el usuario eligió (`user_preferences`, migración `002`) y
una preferencia observada (`learned_preferences`) hablan de lo mismo, **manda
el declarado**, sin importar cuántas observaciones acumule el otro.

```text
El usuario fijó "empezar siempre en la vista mensual".
Abre la vista semanal quince veces seguidas.
  → Al entrar sigue viendo la mensual.
  → La observación se guarda, pero no se aplica.
```

Parece contraintuitivo y es lo correcto: un ajuste explícito es una
instrucción, y quince observaciones son una estadística. Un producto que
deshace en silencio lo que el usuario configuró a mano es un producto en el
que no se puede configurar nada, porque nada se queda quieto.

La misma jerarquía vale dentro del perfil: un hecho `dicho` no se suspende por
contradicción con los datos; se pregunta (§19, caso 4).

## 7. Validaciones

| Campo | Regla |
|---|---|
| `subject_key` | Obligatorio, no vacío, formato `ambito:valor` |
| `positive_evidence_refs` | Al menos una para pasar a `confirmed` |
| Contadores de evidencia | Enteros no negativos; coherentes con la longitud de sus arrays |
| `lifecycle_status` | Del enum; transiciones solo las de §5.1 |
| `revoked_reason` | Obligatorio si `lifecycle_status = 'revoked'` |
| `supersedes_memory_id` | Debe existir, ser del usuario y no ser el mismo |
| `user_profile_facts.origin` | `observado_confirmado` exige `last_confirmed_at` |
| Lápida | Única por `(user_id, scope, subject_key)` sin levantar |
| `memory_events.actor` | `usuario` o `sistema`; nunca vacío |
| Atributo protegido | **Rechazado en escritura**, no filtrado al mostrar |

La última fila importa: la lista de claves prohibidas se comprueba **al
intentar crear el candidato**, no al pintarlo. Filtrar en la superficie deja el
dato guardado.

## 8. Superficies

**Referencia visual: no existe frame previo.** La configuración de `05c` no
tenía sección de memoria; `docs/fase_6_visual/32_especificacion_hifi.md` no la
contempla. Es una pantalla nueva. Tokens y primitivas de
`16_design_system_web.md`.

### `SCR-MEM-01` — Lo que sé de ti

**Ruta:** `/configuracion/memoria`
**Estado en URL:** `clase`, `inactivos`

```text
┌──────────────────────────────────────────────────┐
│ Lo que sé de ti                                  │
│ Todo esto lo puedes corregir o borrar.           │
├──────────────────────────────────────────────────┤
│ SOBRE TI                                    (4)  │
│                                                  │
│ Cobras el 15 y el último día del mes.            │
│ Me lo dijiste el 3 de julio.                     │
│ [Está bien]  [Corregir]  [Olvidar]               │
│                                                  │
│ Trabajas de forma independiente.                 │
│ Lo confirmaste el 8 de julio.                    │
│ [Está bien]  [Corregir]  [Olvidar]               │
├──────────────────────────────────────────────────┤
│ CÓMO CLASIFICO TUS GASTOS                  (37)  │
│                                                  │
│ "Rappi" → Alimentación                           │
│ Lo vi 12 veces, me corregiste 1.  [Ver cuáles]   │
│ [Corregir]  [Olvidar]                            │
│                                                  │
│ "alm" → Almuerzo                                 │
│ Lo escribiste así 4 veces.        [Ver cuáles]   │
│ [Corregir]  [Olvidar]                            │
│                                    [Ver las 37]  │
├──────────────────────────────────────────────────┤
│ CÓMO USAS MANZANA                           (6)  │
│ Sueles mirar el mes, agrupado por categoría.     │
│ Prefieres la tabla al gráfico.                   │
│                                    [Ver las 6]   │
├──────────────────────────────────────────────────┤
│ Dejé de usar estas (5)                           │
│ Olvidadas por ti (2) · Suspendidas (2) ·         │
│ Caducadas (1)                        [Ver]       │
└──────────────────────────────────────────────────┘
```

Detalles que importan:

- **Las tres clases se ven distintas porque lo son.** Lo de arriba pregunta
  ("¿está bien?"); lo del medio informa y deja corregir; lo de abajo solo
  informa. Es `RUL-MEM-01` hecho pantalla.
- El primer bloque **no tiene botón de "ver evidencia"** porque su evidencia
  es una frase del usuario, y ya está ahí.
- El bloque de clasificaciones muestra ambos conteos, positivo y negativo. La
  corrección no se esconde.
- "Dejé de usar estas" está abajo pero **existe y es alcanzable**
  (`RUL-MEM-06`).
- Ningún porcentaje, ninguna barra de confianza, ningún "95% seguro".

### `SCR-MEM-02` — Un aprendizaje en detalle

**Ruta:** `/configuracion/memoria/[id]`

```text
Aprendí que "Rappi" lo pones en Alimentación.

A favor        12 movimientos   [ver los 12]
En contra       1 movimiento    [ver ese]
Desde           14 de junio
Última vez que lo usé   hace 2 días

[Corregir a otra categoría]  [Olvidar esto]  [Deshacer el último cambio]

Historial
  26 jul  Lo apliqué a "Rappi S/32.00"
  18 jul  Me corregiste: lo pusiste en Ocio
  14 jun  Empecé a aprenderlo
```

El historial es lo que hace la memoria auditable de verdad, y sale de
`memory_events`. En V1 llega al nivel de "lo apliqué"; **saber a qué
clasificación concreta del pasado afectó es V1.1** (`07` §3.13).

### `SCR-MEM-03` — Confirmar algo observado

Tarjeta, mostrada en la conversación o en el Inicio, nunca como interrupción
modal:

```text
Vi que te entra dinero el 15 y el último día del mes.
¿Es así como cobras?
[Sí, es así]  [No exactamente]  [No preguntar esto]
```

Es la puerta de `RUL-MEM-01` para los hechos de perfil, y la única superficie
del módulo que pregunta algo. `[No preguntar esto]` cuenta como el segundo
ignorado y cierra el tema (`20c` §3).

### `SCR-MEM-04` — Inactivos

**Ruta:** `/configuracion/memoria?inactivos=1`

Olvidados, suspendidos y caducados, con su fecha y su motivo. Los suspendidos
y caducados se pueden reactivar; **los olvidados no tienen botón de reactivar**
—se reactivan usando la clasificación en el flujo normal, que es lo que levanta
la lápida (`RUL-MEM-09`)—.

Esa ausencia es deliberada y se explica en la pantalla: un botón de "volver a
aprender esto" justo al lado de lo que el usuario acaba de borrar convierte el
olvido en un interruptor, y el olvido debería costar un poco más que eso.

## 9. Acciones

| ID | Acción | ¿Confirma? | Deshacer | Evento |
|---|---|---|---|---|
| `ACT-MEM-01` | Ver todo lo aprendido | No | — | `memoria.consultada` |
| `ACT-MEM-02` | Ver la evidencia de uno | No | — | `memoria.evidencia_vista` |
| `ACT-MEM-03` | Confirmar un hecho de perfil | No | Corrigiendo | `memoria.confirmada` |
| `ACT-MEM-04` | Rechazar un hecho observado | No | — | `memoria.rechazada` |
| `ACT-MEM-05` | No preguntar por esto | No | En esta pantalla | `memoria.pregunta_silenciada` |
| `ACT-MEM-06` | Corregir un aprendizaje | No | 30 días | `memoria.corregida` |
| `ACT-MEM-07` | **Olvidar un aprendizaje** | **Sí** | 30 días | `memoria.olvidada` |
| `ACT-MEM-08` | Deshacer el último cambio | No | — | `memoria.deshecha` |
| `ACT-MEM-09` | Reactivar uno suspendido o caducado | No | Suspendiendo | `memoria.reactivada` |
| `ACT-MEM-10` | Reclasificar el pasado tras corregir | **Sí** | Por el módulo 26 | `memoria.pasado_reclasificado` |
| `ACT-MEM-11` | Olvidar todo lo aprendido | **Sí, escribiendo** | No | `memoria.borrado_total` |

`ACT-MEM-07` confirma porque es destructivo y deja lápida. La confirmación
dice qué se pierde y qué no:

```text
Voy a olvidar que "Rappi" va en Alimentación.
Los 30 movimientos que ya clasifiqué así se quedan como están.
Los próximos llegarán sin categoría sugerida.
[Olvidar]  [Cancelar]
```

`ACT-MEM-11` exige escribir una palabra de confirmación, es la única del
corpus que lo pide, y **ofrece exportar antes** (`35`). Es irreversible y
afecta a las tres clases a la vez.

## 10. API

| Método y ruta | Notas |
|---|---|
| `GET /memory` | Todo lo aprendido, agrupado por clase. Filtro `scope`, `include_inactive` |
| `GET /memory/[id]` | Detalle con evidencia e historial |
| `PATCH /memory/[id]` | Corregir. Encadena, no sobrescribe. `Idempotency-Key` |
| `DELETE /memory/[id]` | Olvidar. **Crea la lápida.** `Idempotency-Key` |
| `POST /memory/[id]/undo` | Deshacer dentro de la ventana |
| `POST /memory/[id]/reactivate` | Reactivar suspendido o caducado |
| `GET /memory/candidates` | Lo observado pendiente de confirmar |
| `POST /memory/candidates/[id]/confirm` · `/reject` · `/never-ask` | Resolución |
| `GET /memory/events` | Auditoría del usuario, paginada por cursor |
| `DELETE /memory` | Borrado total. Exige cuerpo con confirmación explícita |

La ruta `/api/v1/memory` **ya existe** en el código y cubre parte de esto. Su
veredicto de reutilización se emite en el documento 52, no aquí.

`DELETE /memory/[id]` crea la lápida **en la misma transacción** que revoca el
aprendizaje. Separarlas dejaría una ventana en la que el proceso de
aprendizaje podría recrear lo que se acaba de borrar.

## 11. Permisos y RLS

- Cliente autenticado en todas las rutas, sin excepción. RLS por `user_id` en
  las seis tablas del módulo.
- **Ninguna excepción de service-role.** El proceso de aprendizaje corre en el
  contexto del usuario cuyo dato lo disparó; no hay ningún trabajo que
  necesite leer la memoria de varios usuarios a la vez, y **que no lo haya es
  la garantía estructural de `RUL-MEM-12`**.
- La memoria de otro usuario devuelve 404.
- Eliminar la cuenta elimina las seis tablas, incluidas las lápidas y la
  auditoría (`45`).

La segunda viñeta es la más importante del módulo desde el punto de vista de
privacidad: mientras no exista ningún camino de código que pueda leer la
memoria de más de un usuario, el aprendizaje compartido no puede introducirse
por accidente ni por refactor.

## 12. Estados de datos

| Estado | Qué se muestra |
|---|---|
| **Cuenta nueva, nada aprendido** | "Todavía no sé nada de ti. A medida que registres, iré aprendiendo, y todo lo que aprenda aparecerá aquí." |
| **Solo preferencias** | Solo ese bloque. No se inventan las otras dos secciones vacías |
| **Muchos aprendizajes (>50)** | Los 5 más usados por clase, con "Ver los N" y buscador |
| **Todo suspendido** | Se dice, y se ofrece reactivar en bloque |
| **Tras borrado total** | Estado de cuenta nueva, con nota de cuándo se borró |
| **Candidato pendiente** | Tarjeta de `SCR-MEM-03`, máximo una a la vez |
| **Cargando** | Esqueleto con la forma de las tarjetas |
| **Modo discreto** | Los enunciados son visibles; los montos dentro de la evidencia, ocultos |

La última fila tiene su razón: lo que se aprende **no son cifras**, son
relaciones. "Rappi va en Alimentación" no revela cuánto gana nadie, y ocultarlo
dejaría la pantalla inservible sin proteger nada.

## 13. Errores

| ID | Causa | Mensaje visible | Salida |
|---|---|---|---|
| `ERR-MEM-01` | Aprendizaje no encontrado | "Eso ya no está en mi memoria." | Ver todo |
| `ERR-MEM-02` | Deshacer fuera de la ventana de 30 días | "Ese cambio es de hace más de un mes y ya no puedo deshacerlo. Puedes corregirlo a mano." | Corregir |
| `ERR-MEM-03` | Corregir uno olvidado | "Eso lo olvidaste. Si vuelves a clasificarlo así, lo aprendo otra vez." | Ir a movimientos |
| `ERR-MEM-04` | Confirmar un candidato ya resuelto | "Eso ya lo habías respondido." | Ver la memoria |
| `ERR-MEM-05` | Borrado total sin la confirmación escrita | "Escribe OLVIDAR para confirmar." | Corregir el texto |
| `ERR-MEM-06` | Intento de guardar un atributo protegido | — (**no visible**: se rechaza en el servidor y se registra) | — |

`ERR-MEM-06` no tiene mensaje porque no lo provoca el usuario: es la
validación de `RUL-MEM-11` impidiendo que el sistema guarde algo que no debe
inferir. Se registra como incidente de observabilidad, no como error de la
persona.

## 14. Integración con el motor IA

### 14.1 Consultas que expone

| Dimensión | Notas |
|---|---|
| `clase_aprendizaje` | Clasificatorio, perfil, preferencia |
| `estado_aprendizaje` | Confirmado, suspendido, olvidado, caducado |
| `origen_aprendizaje` | Dicho o observado y confirmado |
| `capa_perfil` | Estilo, vida, vínculo, hilo |
| `tiene_contradiccion` | Si acumula evidencia negativa |

| Medida | Notas |
|---|---|
| `aprendizajes_activos` | Por clase |
| `evidencia_positiva` / `evidencia_negativa` | Conteos, **nunca pesos ni confianza** |
| `dias_desde_ultimo_uso` | |

### 14.2 Comandos que acepta

| Comando | Confirmación |
|---|---|
| `confirmar_hecho_perfil` | No: el usuario acaba de decirlo |
| `corregir_aprendizaje` | Tarjeta con lo anterior y lo nuevo |
| `olvidar_aprendizaje` | **Tarjeta**, diciendo qué se conserva |
| `no_preguntar_mas` | No |
| `reactivar_aprendizaje` | No |

**`olvidar_todo` no está en el catálogo del motor.** El borrado total es
irreversible y afecta a las tres clases; se hace en su pantalla, con su
confirmación escrita y con la exportación ofrecida. Que una frase mal
interpretada pueda dispararlo es un riesgo sin contrapartida.

### 14.3 Qué se puede pedir en lenguaje natural

```text
"¿qué sabes de mí?"                     → la memoria, agrupada
"¿por qué clasificaste esto así?"       → el aprendizaje que lo produjo
"olvida que compro en Rappi"            → olvidar_aprendizaje
"ya no trabajo ahí"                     → contradice el hecho → en duda
"no, sigo trabajando ahí"               → restaura el hecho
"deja de preguntarme por esto"          → no_preguntar_mas
```

La cuarta y la quinta son el mismo mecanismo en las dos direcciones, y las dos
tienen que funcionar. Un producto que acepta la corrección pero no la
rectificación de la corrección obliga al usuario a ir a buscarla a mano.

### 14.4 Lo que el motor NO puede hacer aquí

- **Dar por cierto un hecho de perfil que no se confirmó.** Puede usar
  candidatos para preguntar; nunca para calcular.
- Borrar toda la memoria.
- Mostrar pesos, confianzas o conteos internos distintos de la evidencia.
- **Inferir atributos protegidos**, ni siquiera para no guardarlos. La
  prohibición es sobre la inferencia, no sobre el almacenamiento.
- Leer la memoria de otro usuario. No existe la vía técnica (§11).

## 15. Memoria y aprendizaje

Sí: este módulo aprende sobre sí mismo, y conviene declararlo.

| Qué aprende | De dónde | Cómo se corrige |
|---|---|---|
| Su tolerancia a que le pregunten | Candidatos ignorados o rechazados | Respondiendo uno |
| Qué clases revisa | Secciones que abre | — |
| Si corrige mucho una fuente | Correcciones agrupadas por módulo de origen | — |

Los tres son **preferencias**, no hechos de perfil, y por tanto no se
confirman. Ninguno alimenta `20c`.

El tercero es una señal de producto, no de usuario: si las correcciones se
concentran en el módulo 28, el problema está en la detección de correo, no en
la memoria. Se vigila en §16.

## 16. Eventos y telemetría

Eventos: `memoria.consultada`, `.evidencia_vista`, `.confirmada`,
`.rechazada`, `.corregida`, `.olvidada`, `.deshecha`, `.reactivada`,
`.suspendida`, `.caducada`, `.pregunta_silenciada`, `.pasado_reclasificado`,
`.borrado_total`, `.aprendizaje_bloqueado_por_lapida`.

Sin montos, sin contenido de lo aprendido. Sí clase, tipo, módulo de origen y
`trace_id`.

| Métrica | Qué indica |
|---|---|
| **Usuarios que abren `/configuracion/memoria`** | Si la promesa de transparencia es visible o está enterrada |
| Correcciones por módulo de origen | **Dónde falla la detección**, no la memoria |
| Tasa de confirmación de candidatos de perfil | Si se pregunta lo pertinente |
| Candidatos silenciados con "no preguntar" | Si se pregunta demasiado |
| Aprendizajes suspendidos por contradicción | Salud de la clasificación |
| Olvidos por usuario | Volumen normal bajo; un pico es señal de que algo molesta |
| **Bloqueos por lápida** | Que `RUL-MEM-09` funciona: cada bloqueo es un reaprendizaje evitado |
| Borrados totales | Cualquiera merece revisarse: alguien decidió que era más fácil empezar de cero |

La séptima es la métrica que valida la decisión de diseño más específica del
módulo. Si su valor es cero, o las lápidas no se están consultando, o nadie
olvida nada.

## 17. Rendimiento

- Índices nuevos en la migración `061`:
  `memory_tombstones (user_id, scope, subject_key) where lifted_at is null` —
  se consulta **en cada intento de aprendizaje**, así que es el índice más
  caliente del módulo;
  `memory_events (user_id, created_at desc)` para la auditoría paginada.
- Los existentes de `044` y `054` se conservan.
- **La consulta de lápidas se agrupa por lote**, no una por candidato: un
  registro que genera cinco candidatos hace una consulta, no cinco.
- La memoria activa de un usuario cabe holgadamente en el panorama de `20b`
  §4 y se carga con él; no requiere consulta aparte por turno.
- `GET /memory` bajo 300 ms con 200 aprendizajes.
- El aprendizaje ocurre **después** de confirmar el dato, fuera de la petición
  del usuario. Nunca en el camino crítico de guardar un movimiento: aprender
  no puede hacer que registrar un gasto sea más lento.
- Coste de modelo: **cero**. Todo el módulo es determinista.

## 18. Accesibilidad específica

- Cada aprendizaje es un `article` con encabezado propio; las tres clases son
  `section` con `h2`, navegables por encabezados.
- Los conteos de evidencia se anuncian con palabras: "lo vi doce veces, me
  corregiste una vez", no "12 / 1".
- Los botones dicen qué hacen sobre qué: `aria-label="Olvidar que Rappi va en
  Alimentación"`, nunca solo "Olvidar".
- El diálogo de confirmación de olvido devuelve el foco a su disparador al
  cerrarse, y si el elemento desapareció, al encabezado de su sección.
- El resultado de una acción se anuncia en `aria-live="polite"`: "Olvidado.
  Los movimientos anteriores se quedan como estaban."
- La confirmación escrita de `ACT-MEM-11` tiene `label` visible, no solo
  marcador de posición.
- Estado suspendido y caducado se distinguen **con texto**, no solo con opacidad
  o color.

## 19. Casos borde

1. **Olvidar algo y volver a clasificarlo igual manualmente.** La lápida se
   levanta y el sistema puede reaprender. Es el comportamiento correcto: el
   usuario cambió de opinión con sus actos.
2. **Corregir un aprendizaje suspendido.** Se reactiva con el valor corregido y
   la evidencia negativa se archiva.
3. **Dos aprendizajes que se contradicen entre sí** ("Rappi"→Alimentación y
   "Rappi"→Ocio). Imposible por diseño: son la misma `subject_key` y el segundo
   supersede al primero.
4. **Hecho de perfil contradicho por los datos, no por el usuario.** Pasa a
   `en duda` y **se pregunta**; no se corrige solo. Los datos pueden estar
   incompletos, la persona no.
5. **Usuario que responde "no exactamente" a un candidato.** Se abre el campo
   para que lo diga con sus palabras, y lo que escriba entra como `dicho`.
6. **Deshacer un olvido cuyo aprendizaje fue reaprendido entretanto.** Se
   detecta y se dice: "esto ya lo volví a aprender", sin duplicar.
7. **Movimiento borrado que era la única evidencia positiva.** El aprendizaje
   pierde su respaldo y pasa a `suspended`, no a `revoked`: no fue una decisión
   del usuario sobre la memoria.
8. **Categoría eliminada con aprendizajes que apuntan a ella.** Pasan a
   `suspended` con motivo, y si el usuario recrea la categoría se ofrecen
   reactivar.
9. **Usuario que pide olvidar todo y luego deshacer.** No se puede: el borrado
   total es irreversible y la confirmación lo dice. Por eso se ofrece exportar
   antes.
10. **Aprendizaje aplicado hace 11 meses y 29 días.** Sigue vigente. Al día
    siguiente caduca, y aparece en inactivos, no desaparece.
11. **Candidato de perfil sobre una categoría sensible.** No se crea
    (`RUL-MEM-11`). La clasificación sí se aprende; el hecho sobre la persona,
    no.
12. **Exportar los datos con la memoria a medias** (candidatos sin resolver).
    Se exportan también los candidatos, marcados como no confirmados. Ocultar
    lo que el sistema sospecha sería exportar menos de lo que sabe.

El caso 12 es el que más fácil se implementa mal y el más significativo: un
candidato es algo que el sistema piensa sobre el usuario. Que no esté
confirmado no lo hace menos suyo.

## 20. Criterios de aceptación

- `AC-MEM-01` — Todo aprendizaje activo de las tres clases es alcanzable desde
  `/configuracion/memoria`. Evidencia: `TEST` + `USER`.
- `AC-MEM-02` — Las cuatro acciones —ver, corregir, deshacer, olvidar— existen
  y funcionan sobre cualquier aprendizaje. Cierra `C-08`.
  Evidencia: `TEST` + `USER`.
- `AC-MEM-03` — Un hecho de perfil **nunca** pasa a vigente sin confirmación
  explícita del usuario. Evidencia: `TEST`.
- `AC-MEM-04` — Un hecho de perfil sin confirmar no entra en ninguna
  proyección ni cálculo. Evidencia: `TEST`.
- `AC-MEM-05` — Cada aprendizaje guarda evidencia positiva **y negativa** con
  referencias que resuelven. Evidencia: `TEST`.
- `AC-MEM-06` — Tras el umbral de contradicción, el aprendizaje pasa a
  `suspended` y **deja de aplicarse**, conservando su historia.
  Evidencia: `TEST`.
- `AC-MEM-07` — **Olvidar crea una lápida en la misma transacción**, y el
  proceso de aprendizaje no crea candidatos con lápida vigente.
  Evidencia: `TEST`.
- `AC-MEM-08` — Un aprendizaje olvidado **no reaparece** tras un ciclo completo
  de aprendizaje sobre los mismos datos. Evidencia: `TEST`.
- `AC-MEM-09` — La lápida se levanta con una acción explícita del usuario sobre
  la misma clave, y solo así. Evidencia: `TEST`.
- `AC-MEM-10` — Olvidar o corregir **no reescribe el pasado**: los movimientos
  ya clasificados no cambian. Evidencia: `TEST`.
- `AC-MEM-11` — Corregir desde la pantalla de memoria y corregir desde el
  módulo de origen producen **el mismo efecto**. Evidencia: `TEST`.
- `AC-MEM-12` — Corregir encadena con `supersedes_memory_id`; no sobrescribe.
  Evidencia: `TEST`.
- `AC-MEM-13` — Deshacer funciona dentro de 30 días y lo dice claramente
  fuera de ellos. Evidencia: `TEST`.
- `AC-MEM-14` — Las cuatro acciones quedan en `memory_events` con estado
  anterior, siguiente y actor. Evidencia: `TEST`.
- `AC-MEM-15` — Nada se aprende de un dato sin confirmar. Evidencia: `TEST`.
- `AC-MEM-16` — Editar antes de confirmar genera evidencia positiva de lo
  corregido y **negativa de lo propuesto**. Evidencia: `TEST`.
- `AC-MEM-17` — Ningún atributo protegido se infiere ni se almacena; el intento
  se rechaza en el servidor. Evidencia: `TEST`.
- `AC-MEM-18` — **No existe ninguna ruta de código que lea la memoria de más de
  un usuario.** Evidencia: `CODE` + `TEST`.
- `AC-MEM-19` — No se muestra confianza, peso ni porcentaje en ninguna
  superficie ni respuesta de API. Evidencia: `TEST`.
- `AC-MEM-20` — El motor no puede borrar toda la memoria. Evidencia: `TEST`.
- `AC-MEM-21` — La exportación completa incluye lo aprendido **y los
  candidatos sin confirmar**, marcados como tales. Evidencia: `TEST`.
- `AC-MEM-22` — Eliminar la cuenta elimina las seis tablas, lápidas y
  auditoría incluidas. Evidencia: `TEST`.
- `AC-MEM-23` — El aprendizaje ocurre fuera de la petición de guardar un
  movimiento. Evidencia: `CODE` + `TEST`.
- `AC-MEM-24` — Un ajuste declarado en `user_preferences` **prevalece** sobre
  cualquier preferencia observada que hable de lo mismo, sin importar el
  conteo de observaciones. Evidencia: `TEST`.

## 21. Fuera de alcance y puente a WhatsApp

**Diferido a V1.1:** trazar a qué clasificación concreta del pasado afectó un
aprendizaje, ventana de deshacer más larga, reglas de memoria escritas por el
usuario ("todo lo de Wong es Alimentación aunque no lo confirme").

**Prohibido, no diferido:** perfilado publicitario o de scoring, compartir
aprendizajes entre usuarios, entrenar modelos con datos del usuario, inferir
atributos protegidos, y sacar conclusiones sobre las personas relacionadas que
el usuario menciona.

Puente a WhatsApp: **la memoria es lo que más limpiamente cruza de canal**,
porque es exactamente lo que el motor agnóstico necesita y no depende de
ninguna superficie. En la fase 2, "olvida que compro en Rappi" escrito por
WhatsApp ejecuta el mismo comando, con la misma tarjeta de confirmación
traducida por el presentador, contra las mismas tablas.

Lo que **no** cruza sin rediseño es `SCR-MEM-01`: treinta y siete
clasificaciones agrupadas en tres secciones no son un mensaje de chat. En
conversación se responde con las más usadas y un enlace, igual que con los
reportes (`35` §21).

Y una regla que la fase 2 debe heredar sin discusión: **el canal no cambia
quién puede olvidar.** Olvidar por WhatsApp es tan definitivo como olvidar en
la app, y deja la misma lápida.

## 22. Trazabilidad

**Documentos de `docs/` consumidos:** ninguno como especificación. El corpus
histórico no tenía documento de memoria: la capacidad existía en el código
—migración `044` y `/api/v1/memory`— **sin especificación de producto ni
superficie**, que es precisamente la forma de `C-08`.

De `docs/fase_5_proteccion/24_privacidad_proteccion_datos.md` se hereda la
obligación de reversibilidad y auditoría, que aquí pasa de declaración a
`RUL-MEM-10` con tabla, acciones y criterios.

**Contradicciones que cierra:**

`C-08` — *"Memoria reversible y auditable vs. sin API ni UI de revocar u
olvidar: promesa no accesible al usuario."* Se cierra con las cuatro acciones
de `RUL-MEM-06` a `RUL-MEM-09`, sus superficies en §8, sus rutas en §10 y
`AC-MEM-02`. La mitad de portabilidad la aporta `35` (`RUL-REP-11`), que
incluye el perfil aprendido en la exportación.

La contradicción se cierra **porque la promesa era cierta en el modelo de
datos y falsa en la experiencia**. La migración `044` ya tenía `revoked_at` y
`revoked_reason` desde antes de este documento; lo que faltaba era una pantalla
donde llegar a ellos y una regla que impidiera que lo revocado volviera solo.

**Aporte al conjunto:** este documento es el que hace exigibles las §15 de los
once módulos anteriores. Antes de él, cada uno declaraba lo que aprendía y
nadie declaraba quién lo gobernaba.

**Decisiones tomadas en este documento**, registradas en
`03_decisiones_producto_web.md`:

| Decisión | ID | Alternativa descartada | Razón |
|---|---|---|---|
| Tres clases de aprendizaje con gobiernos distintos | `WEB-D057` | Un solo régimen para todo lo aprendido | Un régimen único da un producto insoportable (confirmar que prefieres tablas) o peligroso (creer en silencio que cobras el 15) |
| Solo los hechos de perfil se confirman antes de creerse | `WEB-D058` | Confirmar todo, o no confirmar nada | Es la única clase que afecta a cálculos de dinero, y su error es el más difícil de detectar desde fuera |
| Olvidar deja lápida | `WEB-D059` | Borrar la fila | Sin lápida el sistema reaprende lo mismo mañana desde los mismos datos, y olvidar deja de significar nada |
| La lápida se levanta solo con un acto explícito del usuario | `WEB-D060` | Botón de reactivar junto al olvido | Un interruptor de "volver a aprender" convierte el olvido en un ajuste; volver a clasificarlo a mano es una decisión, no un clic |
| El pasado no se reescribe al olvidar o corregir | `WEB-D061` | Reclasificar retroactivamente | El historial registra lo que pasó, no lo que ahora creemos. Reclasificar existe como acción explícita y aparte |
| Ninguna ruta de código lee la memoria de más de un usuario | `WEB-D062` | Prohibir el aprendizaje compartido por política | Una garantía estructural sobrevive a los refactors; una política, no. Y `WEB-D021b` ya resuelve el único caso que lo justificaba: el conocimiento del mundo lo pone el modelo |
| Ventana de deshacer de 30 días, no de minutos | `WEB-D063` | La ventana corta del resto del producto | El efecto de haber olvidado algo no se descubre al olvidarlo, sino la próxima vez que el sistema no clasifica |
| Lo declarado gana a lo observado, siempre | `WEB-D064` | Que la observación repetida acabe imponiéndose | Un ajuste explícito es una instrucción; quince observaciones son una estadística. Un producto donde los ajustes se revierten solos es un producto donde no se puede configurar nada |
| `olvidar_todo` no está en el catálogo del motor | `WEB-D065` | Permitirlo con confirmación | Es irreversible y afecta a las tres clases; que una frase mal interpretada pueda dispararlo es riesgo sin contrapartida |
