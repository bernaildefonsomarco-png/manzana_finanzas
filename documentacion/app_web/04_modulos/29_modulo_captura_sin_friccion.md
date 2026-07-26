# 29 — Módulo: Captura sin fricción

**ID de módulo:** `MOD-CAPTURA`
**Bloque:** 04 — Módulos
**Estado:** V1
**Fecha:** 26 de julio de 2026
**Docs fuente:** `docs/fase_3_producto/14_flujos_usuario_v1.md`, `26_modulo_movimientos.md`, `20b_capa_semantica_y_consulta_abierta.md`
**Documentos que dependen de este:** `39` (home), `41` (asistente), `44` (onboarding)

---

## 1. Tesis y qué NO es

**La fricción del registro es la causa número uno de abandono** en las apps
de finanzas personales. Alguien que tarda 40 segundos y ocho toques en anotar
un café deja de anotar cafés a la semana siguiente.

Este módulo existe para que anotar un gasto cueste **menos de 10 segundos**
por al menos una vía. No añade capacidades nuevas al producto: hace que las
que ya existen se puedan usar sin que duela.

Cuatro vías, para cuatro momentos distintos:

| Vía | Cuándo sirve |
|---|---|
| **Registro rápido** | El usuario ya está en la app y quiere anotar algo puntual |
| **Atajos de teclado** | Uso frecuente desde escritorio |
| **Plantillas** | Movimientos que se repiten con los mismos datos |
| **Duplicar** | "Lo mismo de la semana pasada" |

**Qué NO es:**

- No reemplaza el formulario completo. Es el camino corto; el formulario
  sigue existiendo para lo que necesita precisión.
- No adivina lo que no puede saber. Ante duda, deja el campo vacío y lo marca
  — nunca inventa la cuenta o la categoría.
- No es el asistente. El registro rápido interpreta una línea; el asistente
  conversa. Comparten el parseo, no la superficie.

## 2. Alcance

| Nivel | Funcionalidad |
|---|---|
| **IN V1-web** | Registro rápido en una línea con parseo híbrido (reglas primero, modelo si hace falta). Atajos de teclado globales. Plantillas de movimientos frecuentes, creadas a mano o sugeridas por repetición. Duplicar un movimiento desde el historial. Previsualización antes de guardar. Corrección en el sitio sin abrir otro formulario. |
| **V1.1** | **Importación de archivos** (CSV, Excel, plantillas de bancos peruanos). Su diseño queda en §21 para no cerrarle la puerta al modelo de datos. Plantillas programadas. Registro por lotes desde texto pegado. |
| **FUERA** | OCR de boletas. Voz. Captura por foto. Integración con el portapapeles del sistema. |

## 3. Vocabulario

| Interno | Visible |
|---|---|
| `quick_add` | Registro rápido |
| `template` | Plantilla / Movimiento frecuente |
| `parse_result` | No visible |
| `duplicate_from` | Repetir |
| Parseo | "Lo entendí así" — nunca "parseé" ni "analicé" |

## 4. Entidades y datos

### 4.1 `movement_templates`

```sql
id              uuid pk
user_id         uuid not null
name            text not null
type            movement_type not null
amount          numeric(14,2) null      -- null = se pide al usar
merchant        text null
description     text null
category_id     text null
subcategory_id  uuid null
account_id      uuid null
box_id          uuid null
origin          template_origin not null   -- usuario | sugerida
use_count       integer not null default 0
last_used_at    timestamptz null
created_at, updated_at, deleted_at, metadata
```

`amount` nulo es deliberado: muchas plantillas útiles tienen todo fijo menos
el monto ("almuerzo en el menú de siempre"). Al usarla se pide solo eso.

Único parcial `(user_id, lower(name))` entre activas.

### 4.2 Migración requerida

**`059` — plantillas de movimientos:**

```sql
create type template_origin as enum ('usuario', 'sugerida');

create table if not exists public.movement_templates (
  -- campos de §4.1
);

alter table public.movement_templates enable row level security;
-- política de aislamiento por user_id

create index movement_templates_user_use_idx
  on public.movement_templates (user_id, use_count desc, last_used_at desc)
  where deleted_at is null;
```

El índice ordena por uso porque las plantillas se muestran siempre por
frecuencia: la que más usas debe estar primero sin que la busques.

### 4.3 Lo que NO se persiste

El resultado del parseo **no se guarda**. Es efímero: se interpreta, se
muestra, el usuario confirma o corrige, y se crea un movimiento normal. No
existe una entidad "borrador de registro rápido".

Razón: un borrador persistido es un estado más que mantener, sincronizar y
caducar, para un flujo que dura segundos.

## 5. Máquina de estados

### 5.1 Registro rápido

```text
   el usuario escribe una línea
              │
              ▼
      parseo por reglas
              │
      ┌───────┴────────┐
      │                │
   resuelto      no resuelto
      │                │
      │                ▼
      │        parseo con el modelo
      │                │
      │        ┌───────┴────────┐
      │        │                │
      │     resuelto      no resuelto
      │        │                │
      ▼        ▼                ▼
   previsualización        formulario completo
   con lo dudoso           precargado con lo que se entendió
   resaltado
      │
      ├── confirmar ──► movimiento creado
      ├── corregir en el sitio ──► confirmar
      └── abrir formulario ──► formulario completo precargado
```

**Nunca se llega a un callejón sin salida.** Si nada se entiende, se abre el
formulario con el texto en la descripción — el usuario no pierde lo que
escribió.

### 5.2 Plantilla

```text
   creada (por el usuario o sugerida)
       │
       ├── usada ──► use_count++, last_used_at
       ├── editada
       └── archivada
```

Una plantilla sugerida que el usuario no acepta en 30 días se descarta sola y
no se vuelve a sugerir para el mismo patrón en 90 días.

## 6. Reglas de negocio

**`RUL-CAP-01` — Parseo híbrido: reglas primero, modelo después**

| Capa | Qué resuelve | Costo | Latencia |
|---|---|---|---|
| **Reglas** | La mayoría de casos reales: `taxi 15`, `40 super`, `almuerzo 22 yape` | Cero | Instantánea |
| **Modelo** | Lo que las reglas no alcanzan: `pagué la mitad del alquiler con lo que me devolvió juan` | Sí | ~1 s |

Las reglas se intentan **siempre primero**. El modelo solo entra si fallan.

Razón: el 80% de los registros rápidos reales son dos o tres palabras y un
número. Pagar una llamada al modelo para interpretar `taxi 15` es tirar
dinero y añadir un segundo de espera a la operación que más queremos que sea
instantánea.

**`RUL-CAP-02` — Qué reconocen las reglas**

| Patrón | Ejemplo | Se extrae |
|---|---|---|
| Número suelto | `40` | monto |
| Texto + número | `taxi 15` | monto, descripción |
| Número + texto | `15 taxi` | monto, descripción |
| Con moneda | `s/15 taxi`, `15 soles` | monto normalizado |
| Con decimales | `15.50`, `15,50` | monto normalizado |
| Con cuenta conocida | `taxi 15 yape` | monto, descripción, cuenta |
| Con fecha relativa | `taxi 15 ayer` | monto, descripción, fecha |
| Con comercio conocido | `rappi 28` | monto, comercio, y categoría **aprendida** |
| Signo de ingreso | `+2000 sueldo` | tipo ingreso, monto, descripción |

La penúltima fila conecta con la memoria: si el usuario ya clasificó Rappi
como Alimentación ocho veces, el registro rápido lo propone. No es una regla
codificada sobre Rappi — es el aprendizaje del propio usuario
(`36_modulo_memoria_y_aprendizaje.md`).

**`RUL-CAP-03` — Por defecto es gasto, y se puede cambiar sin volver a escribir**

Sin señal en contra, una línea se interpreta como gasto. El tipo es visible y
editable en la previsualización con un clic, sin reescribir nada.

Un `+` delante del número indica ingreso.

**`RUL-CAP-04` — Lo que no se sabe queda vacío y marcado, nunca inventado**

Si no se puede determinar la cuenta, queda vacía con procedencia `supuesto`
si se usó la de por defecto, o vacía sin más. **Nunca se elige una cuenta al
azar** ni se asume una categoría sin evidencia.

Es la misma regla de procedencia del motor (`22` §3) aplicada aquí.

**`RUL-CAP-05` — Previsualización siempre, antes de guardar**

Nada se registra sin que el usuario vea qué se entendió. La previsualización
resalta los campos dudosos y permite corregirlos en el sitio.

Salvo una excepción explícita: si el usuario usa el atajo de "guardar
directo" (`Ctrl+Enter`) tras haber visto la previsualización, se guarda. El
atajo no salta el paso, lo acelera.

**`RUL-CAP-06` — Corregir sin cambiar de superficie**

Los campos de la previsualización son editables **ahí mismo**. Solo se abre
el formulario completo si el usuario lo pide o si el tipo requiere campos que
la previsualización no muestra (una deuda, un recurrente).

**`RUL-CAP-07` — Fecha por defecto: hoy, en `America/Lima`**

Se aceptan expresiones relativas: `ayer`, `anteayer`, `el lunes`, `hace 3
días`. Se resuelven contra la zona horaria del usuario, no la del servidor
(`RUL-MOV-08`).

**`RUL-CAP-08` — Aviso de duplicado también aquí**

El registro rápido pasa por la misma detección de duplicados que el
formulario (`RUL-MOV-04`). Ser rápido no exime de avisar.

**`RUL-CAP-09` — Sugerencia de plantilla por repetición**

Si el usuario registra **3 movimientos casi idénticos** (mismo comercio,
mismo monto ±10%, misma categoría) en 60 días, se ofrece crear una plantilla.

Se ofrece **una vez**. Si la rechaza, no se vuelve a ofrecer para ese patrón
en 90 días.

**`RUL-CAP-10` — Duplicar copia todo menos la fecha**

Repetir un movimiento copia tipo, monto, comercio, categoría, cuenta y
etiquetas, y pone la fecha de hoy. Abre la previsualización para que el
usuario ajuste antes de guardar.

**`RUL-CAP-11` — Todo lo registrado aquí es un movimiento normal**

No hay movimientos "de segunda". Un registro rápido produce exactamente el
mismo movimiento que el formulario completo, con `source: dashboard_manual`,
y se puede editar, eliminar y restaurar igual.

## 7. Validaciones

| Elemento | Regla |
|---|---|
| Línea de entrada | 1–140 caracteres. Vacía no hace nada |
| Monto extraído | Debe cumplir las validaciones de `26` §7 |
| Fecha resuelta | No futura (`RUL-MOV-10`) |
| Nombre de plantilla | 1–40 caracteres, único por usuario |
| Plantilla sin monto | Válida; se pide al usar |
| Plantilla con tipo que exige campos | Debe tenerlos todos o pedirlos al usar |

## 8. Superficies

**Referencia visual: no existe frame previo.** Ninguna de estas cinco
superficies está en `docs/fase_6_visual/32_especificacion_hifi.md`, ni en el
inventario numerado de 151 frames de
`docs/fase_6_visual/33_stitch_handoff_v1.md` §6.13, ni por tanto en
`stitch_manzana_v1/`. La captura del Hi-Fi es el FAB que abre el formulario
completo (`MOVEMENT_NEW` y `DRAWER_MOVEMENT_NEW`, frames 44-59 y 149-150,
§6 y §21.10), que es la superficie del módulo `26`: ni `HOME` (§3.1) ni
`MOVEMENTS` (§4.1) tienen barra de registro rápido, y no hay frame de
plantillas, de paleta de comandos ni de ayuda de atajos. Es coherente con
§22: ninguna fuente contemplaba el registro rápido ni las plantillas, así
que no había nada que dibujar cuando se generaron los frames. Los bloques de
abajo son la especificación de layout; tokens y primitivas salen de
`16_design_system_web.md`.

### `SCR-CAP-01` — Barra de registro rápido

Componente, presente en Inicio y en Movimientos.

```text
┌──────────────────────────────────────────────────┐
│ ✏️  taxi 15 ayer                          [↵]    │
└──────────────────────────────────────────────────┘
        ↓ al escribir y confirmar
┌──────────────────────────────────────────────────┐
│ Lo entendí así:                                  │
│                                                  │
│   Gasto ▾     S/15.00      ayer, 25 jul          │
│   Taxi                                           │
│   Transporte ▾            BCP ▾ (tu cuenta habitual)│
│                                                  │
│   [Guardar]   [Abrir formulario]   [Cancelar]    │
└──────────────────────────────────────────────────┘
```

Detalles que importan:

- Cada campo es editable en el sitio; los selectores son reales.
- "tu cuenta habitual" declara la procedencia del dato supuesto.
- El foco tras guardar vuelve a la barra, vacía, lista para otro registro.
- `Escape` cancela sin perder lo escrito si se reabre.

### `SCR-CAP-02` — Plantillas

**Ruta:** `/configuracion/plantillas`

Lista ordenada por uso, con conteo y última vez. Acciones: usar, editar,
archivar. Desde el registro rápido se accede con `Ctrl+K` o escribiendo el
nombre de la plantilla.

### `SCR-CAP-03` — Usar una plantilla

Abre la previsualización precargada. Si a la plantilla le falta el monto,
el foco entra directamente en ese campo.

### `SCR-CAP-04` — Sugerencia de plantilla

Tarjeta discreta tras el tercer movimiento repetido:

```text
Has registrado "Almuerzo menú" 3 veces este mes con el mismo monto.
¿Quieres guardarlo como movimiento frecuente?
[Sí, guardar]  [No, gracias]
```

Aparece **después** de guardar, nunca interrumpiendo el registro.

### `SCR-CAP-05` — Atajos de teclado

| Atajo | Acción |
|---|---|
| `N` | Enfocar el registro rápido |
| `Ctrl/Cmd + K` | Paleta de comandos, incluidas las plantillas |
| `Ctrl/Cmd + Enter` | Guardar sin salir de la previsualización |
| `Escape` | Cancelar |
| `Ctrl/Cmd + D` desde un movimiento | Duplicarlo |

Todos descubribles desde una ayuda de atajos (`?`), y ninguno interfiere con
los del navegador (`18_accesibilidad_i18n_y_formatos.md` §3).

## 9. Acciones

| ID | Acción | ¿Confirma? | Deshacer | Evento |
|---|---|---|---|---|
| `ACT-CAP-01` | Registrar desde una línea | Previsualización | Eliminando | `registro_rapido.usado` |
| `ACT-CAP-02` | Corregir en la previsualización | No | — | `registro_rapido.corregido` |
| `ACT-CAP-03` | Abrir formulario desde la previsualización | No | — | `registro_rapido.escalado` |
| `ACT-CAP-04` | Crear plantilla | No | Archivando | `plantilla.creada` |
| `ACT-CAP-05` | Usar plantilla | Previsualización | Eliminando | `plantilla.usada` |
| `ACT-CAP-06` | Editar plantilla | No | Editando | `plantilla.editada` |
| `ACT-CAP-07` | Archivar plantilla | No | Restaurando | `plantilla.archivada` |
| `ACT-CAP-08` | Aceptar plantilla sugerida | No | Archivando | `plantilla.sugerida_aceptada` |
| `ACT-CAP-09` | Rechazar plantilla sugerida | No | — | `plantilla.sugerida_rechazada` |
| `ACT-CAP-10` | Duplicar movimiento | Previsualización | Eliminando | `movimiento.duplicado` |

## 10. API

| Método y ruta | Notas |
|---|---|
| `POST /capture/parse` | Interpreta una línea. **No escribe nada.** Devuelve la interpretación con procedencia por campo |
| `GET /templates` | Ordenadas por uso |
| `POST /templates` | Crea |
| `PATCH /templates/[id]` | Edita |
| `DELETE /templates/[id]` | Archiva |
| `POST /templates/[id]/use` | Devuelve la previsualización precargada. **No escribe** |
| `GET /templates/suggestions` | Sugerencias pendientes |
| `POST /templates/suggestions/[id]/accept` | Crea la plantilla |
| `POST /templates/suggestions/[id]/dismiss` | Descarta |

El registro final **no tiene endpoint propio**: usa `POST /api/v1/movements`
del módulo 26, con las mismas validaciones, idempotencia y detección de
duplicados. Es la misma regla que aplica al asistente (`14` §12): **ninguna
vía de captura tiene un camino privilegiado de escritura**.

`POST /capture/parse` declara en su respuesta qué capa resolvió:

```jsonc
{
  "resolved_by": "reglas | modelo | parcial",
  "fields": {
    "amount":  { "value": "15.00", "provenance": "dicho" },
    "type":    { "value": "gasto", "provenance": "supuesto" },
    "account": { "value": "acc_bcp", "provenance": "supuesto", "reason": "tu cuenta habitual" }
  },
  "unresolved": ["category"]
}
```

`provenance` alimenta directamente el resaltado de la previsualización: lo
`supuesto` se muestra como editable y con su razón.

## 11. Permisos y RLS

- Cliente autenticado en todas las rutas. **Sin excepciones de service-role.**
- RLS por `user_id` en `movement_templates`.
- `POST /capture/parse` **no escribe nada** y por tanto no requiere
  idempotencia; sí está sujeto al límite de peticiones del asistente cuando
  escala al modelo (`14` §8).
- Una plantilla de otro usuario devuelve 404.

## 12. Estados de datos

| Estado | Qué se muestra |
|---|---|
| **Sin plantillas** | La barra funciona igual. En `/configuracion/plantillas`: "Cuando registres algo varias veces, te ofreceré guardarlo aquí" |
| **Primera vez usando la barra** | Marcador de posición con un ejemplo real: "taxi 15" |
| **Parseo por reglas** | Previsualización inmediata, sin indicador de carga |
| **Escalando al modelo** | Indicador breve: "Un momento…" — solo si supera 300 ms |
| **Nada entendido** | Formulario completo con el texto en la descripción. Sin mensaje de error |
| **Modelo no disponible** | Las reglas siguen funcionando. Si no alcanzan, se abre el formulario y se dice por qué |
| **Modo discreto** | La previsualización oculta el monto hasta confirmar el foco en el campo |

La penúltima fila importa: **la captura rápida sigue funcionando sin el
modelo**, degradada pero útil. Es lo que hace que la app no dependa del motor
para su función más básica (`23` §7).

## 13. Errores

| ID | Causa | Mensaje visible | Salida |
|---|---|---|---|
| `ERR-CAP-01` | Línea sin ningún número | "No encontré un monto ahí." | Formulario precargado |
| `ERR-CAP-02` | Monto no interpretable | "No entendí el monto. Escríbelo como 15 o 15.50." | Corregir en el sitio |
| `ERR-CAP-03` | Fecha relativa ambigua | "¿Qué lunes? Elige la fecha." | Selector de fecha |
| `ERR-CAP-04` | Fecha futura resuelta | "Esa fecha todavía no llega. ¿Es un pago que viene?" | Ir a Pagos que vienen |
| `ERR-CAP-05` | Cuenta mencionada inexistente | "No tengo una cuenta que se llame así." | Elegir o crear |
| `ERR-CAP-06` | Plantilla duplicada | "Ya tienes una plantilla con ese nombre." | Cambiar nombre |
| `ERR-CAP-07` | Plantilla de un tipo que exige campos ausentes | "Para esta plantilla necesito saber la deuda." | Completar |
| `ERR-CAP-08` | Duplicado probable | "Ya tienes un movimiento igual hoy." | Ver / Registrar igual |

Ninguno es un callejón: todos terminan en el formulario o en una acción.

## 14. Integración con el motor IA

### 14.1 Consultas que expone

| Dimensión | Notas |
|---|---|
| `origen_captura` | rápido, formulario, plantilla, duplicado |
| `plantilla_usada` | Cuál |
| `resuelto_por` | reglas, modelo, parcial |

| Medida | Notas |
|---|---|
| `uso_por_plantilla` | Conteo |
| `tiempo_hasta_guardar` | Métrica de fricción |

### 14.2 Comandos que acepta

| Comando | Confirmación |
|---|---|
| `crear_plantilla` | Tarjeta |
| `usar_plantilla` | Previsualización |
| `editar_plantilla` | Tarjeta |
| `archivar_plantilla` | Tarjeta |

El registro en sí **no es un comando de este módulo**: es
`crear_movimiento` del módulo 26. Este módulo aporta el parseo, no la
escritura.

### 14.3 Relación con el asistente

El registro rápido y el asistente **comparten el parseo y no la superficie**:

| | Registro rápido | Asistente |
|---|---|---|
| Entrada | Una línea | Conversación |
| Salida | Previsualización | Bloques de respuesta |
| Estado | Sin memoria entre usos | Hilo, foco, perfil |
| Alcance | Crear un movimiento | Todo el producto |

Cuando la línea no se resuelve ni con reglas ni con el modelo en modo
"interpretar una línea", **no se escala al asistente automáticamente**: se
abre el formulario. Escalar sin avisar convertiría un registro de 5 segundos
en una conversación, que no es lo que el usuario pidió.

## 15. Memoria y aprendizaje

| Qué aprende | De dónde | Cómo se corrige |
|---|---|---|
| Cómo escribe sus registros | Líneas repetidas | — |
| Abreviaturas propias ("alm" = almuerzo) | Correcciones tras el parseo | Corrigiendo otra vez |
| Comercio → categoría | Confirmaciones | Reclasificando (módulo 25) |
| Cuenta habitual | Confirmaciones | Cambiando la de por defecto |
| Patrones repetidos | 3 movimientos casi idénticos | Rechazando la plantilla sugerida |

Las abreviaturas propias son el aprendizaje más específico de este módulo:
un usuario que escribe `alm 18` tres veces y lo corrige a "Almuerzo" debe
dejar de tener que corregirlo.

## 16. Eventos y telemetría

Eventos: `registro_rapido.usado`, `.corregido`, `.escalado`,
`.resuelto_por_reglas`, `.resuelto_por_modelo`, `plantilla.creada`, `.usada`,
`.sugerida_aceptada`, `.sugerida_rechazada`, `movimiento.duplicado`,
`atajo.usado`.

Nunca llevan el texto escrito ni el monto. Sí llevan qué capa resolvió y
cuántos campos hubo que corregir.

Métricas clave de este módulo:

| Métrica | Qué indica |
|---|---|
| **Tiempo desde escribir hasta guardar** | La métrica principal. Objetivo: bajo 10 s |
| Proporción resuelta solo por reglas | Objetivo alto: cada punto es latencia y costo ahorrados |
| Campos corregidos por registro | Si sube, el parseo o el aprendizaje fallan |
| Registros por vía | Cuál funciona de verdad |
| Tasa de escalado al formulario | Si sube, la barra no está sirviendo |
| Plantillas sugeridas aceptadas | Si la detección de repetición acierta |

## 17. Rendimiento

- El parseo por reglas es **síncrono y local**: sin llamada de red, sin
  espera perceptible.
- La escalada al modelo tiene tope de 2 s; superado, se abre el formulario
  con lo que se entendió.
- Las plantillas se cargan con el panorama, no en cada apertura de la barra.
- El índice ordena por `use_count` para no ordenar en memoria.
- Presupuesto: previsualización por reglas bajo 50 ms; con modelo bajo 1,5 s.

## 18. Accesibilidad específica

- La barra es un campo de texto con etiqueta accesible y descripción de qué
  se puede escribir.
- La previsualización aparece como región activa: se anuncia lo que se
  entendió sin robar el foco.
- El orden de foco en la previsualización sigue el orden visual: tipo, monto,
  fecha, descripción, categoría, cuenta.
- Todos los atajos tienen alternativa por interfaz; ninguno es la única vía.
- Tras guardar, el foco vuelve a la barra y se anuncia "Movimiento
  registrado".

## 19. Casos borde

1. **Solo un número: `40`.** Se interpreta como gasto de S/40.00 sin
   descripción, con la categoría vacía y marcada.
2. **Dos números: `taxi 15 20`.** Se toma el primero como monto y se avisa;
   el segundo queda en la descripción.
3. **Texto sin número: `almuerzo`.** `ERR-CAP-01` con formulario precargado.
4. **Monto con formato local: `15,50`.** Se normaliza a `15.50`.
5. **Cuenta mencionada que no existe: `taxi 15 plin`.** Se ofrece crear la
   cuenta o elegir otra, sin perder el resto.
6. **`+2000 sueldo`.** Ingreso de S/2.000,00.
7. **Línea que describe dos movimientos: `taxi 15 y almuerzo 20`.** Las
   reglas no lo resuelven; el modelo propone **dos** movimientos en una
   previsualización múltiple, con confirmación única.
8. **Plantilla cuya cuenta fue archivada.** Al usarla se avisa y se pide otra.
9. **Duplicar un movimiento de tipo `pago_deuda` cuya deuda ya se cerró.** Se
   avisa y se ofrece elegir otra deuda o cambiar el tipo.
10. **El usuario escribe y navega antes de confirmar.** La previsualización
    se descarta; el texto no se persiste. Se avisa antes de salir si había
    algo escrito.
11. **Fecha relativa en fin de semana largo: `el lunes`.** Se resuelve al
    lunes más reciente pasado, no al próximo, porque no se aceptan fechas
    futuras.
12. **El modelo devuelve algo incoherente** (monto que no aparece en el
    texto). Las comprobaciones de sanidad lo rechazan y se cae al formulario.

## 20. Criterios de aceptación

- `AC-CAP-01` — Un registro rápido típico se completa en menos de 10
  segundos. Evidencia: `USER` + `METRIC`.
- `AC-CAP-02` — `taxi 15` se resuelve **solo con reglas**, sin llamada al
  modelo. Evidencia: `TEST`.
- `AC-CAP-03` — Nada se guarda sin previsualización.
  Evidencia: `TEST`.
- `AC-CAP-04` — Un campo no determinado queda vacío o marcado como supuesto,
  con su razón visible. Nunca se inventa. Evidencia: `TEST` + `USER`.
- `AC-CAP-05` — Todos los campos de la previsualización son editables sin
  cambiar de superficie. Evidencia: `TEST`.
- `AC-CAP-06` — Si nada se entiende, se abre el formulario con el texto
  conservado. Nunca un callejón sin salida. Evidencia: `TEST`.
- `AC-CAP-07` — Con el modelo caído, las reglas siguen funcionando.
  Evidencia: `TEST`.
- `AC-CAP-08` — El registro rápido pasa por la misma detección de duplicados
  que el formulario. Evidencia: `TEST`.
- `AC-CAP-09` — Un movimiento creado aquí es idéntico a uno del formulario y
  se puede editar, eliminar y restaurar igual. Evidencia: `TEST`.
- `AC-CAP-10` — La escritura usa `POST /api/v1/movements`, sin endpoint
  privilegiado. Evidencia: `TEST`.
- `AC-CAP-11` — Una plantilla se sugiere tras 3 repeticiones, una sola vez, y
  se respeta el rechazo 90 días. Evidencia: `TEST`.
- `AC-CAP-12` — Las fechas relativas se resuelven en `America/Lima`.
  Evidencia: `TEST`.
- `AC-CAP-13` — Todos los atajos tienen alternativa por interfaz.
  Evidencia: `TEST`.
- `AC-CAP-14` — Tras guardar, el foco vuelve a la barra y se anuncia el
  resultado. Evidencia: `TEST`.
- `AC-CAP-15` — Ninguna ruta de este módulo usa service-role.
  Evidencia: `TEST`.

## 21. Fuera de alcance y puente

### 21.1 Importación de archivos — diferida a V1.1

Se difiere por decisión de producto, no por dificultad. Su diseño queda aquí
para que el modelo de datos no le cierre la puerta:

- **Formatos:** CSV genérico con mapeo de columnas; plantillas automáticas
  para bancos peruanos; Excel.
- **Flujo:** subir → mapear → previsualizar → confirmar por lote → **deshacer
  la importación completa**.
- **Regla heredada de `C-06`:** cada fila se resuelve por separado. Un lote
  con 40 filas claras y 2 ambiguas registra 40 y deja 2 pendientes; **nunca
  se bloquea entero**.
- **Tablas:** `import_batches` e `import_rows`, documentadas en
  `13_modelo_datos_web_v1.md` §7.2 y **marcadas como diferidas**. La
  migración `049` no se aplica hasta activar la funcionalidad.
- **Enum:** `movement_source` ya contempla `import_confirmed` (migración
  `047`), que queda sin uso hasta entonces.

Qué la desbloquea: que el registro rápido y la detección por correo no basten
para que un usuario nuevo tenga historial suficiente el primer mes.

### 21.2 Puente a WhatsApp

El registro rápido **es el precursor directo del registro por WhatsApp**: una
línea de texto que se interpreta y se confirma. El parseo por reglas y el
contrato de `POST /capture/parse` se reutilizan tal cual; solo cambia el
presentador de la previsualización, que en WhatsApp será un mensaje con
botones en vez de una tarjeta editable.

## 22. Trazabilidad

**Documentos de `docs/` consumidos:**
`docs/fase_3_producto/14_flujos_usuario_v1.md` (flujo de registro simple),
`docs/fase_2_estrategia/alcance_v1/05d_email_parsing.md` (parsers
reutilizables).

**Contradicciones que cierra:** `C-06` parcialmente — el registro múltiple de
una línea con dos movimientos se resuelve por ítem, sin bloquear. El cierre
completo de `C-06` queda con la importación en V1.1.

**Diferencias frente a los documentos fuente:** ninguna fuente contemplaba el
registro rápido con parseo híbrido ni las plantillas; ambos son nuevos. La
importación de archivos, que en la planificación inicial de este corpus era
parte del alcance V1, **se difiere a V1.1 por decisión del usuario** el 26 de
julio de 2026.
