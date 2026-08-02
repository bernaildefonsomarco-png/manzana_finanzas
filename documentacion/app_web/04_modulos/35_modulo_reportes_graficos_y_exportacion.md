# 35 — Módulo: Reportes, gráficos y exportación

**ID de módulo:** `MOD-REPORTES`
**Bloque:** 04 — Módulos
**Alcance:** V1
**Fecha:** 26 de julio de 2026
**Docs fuente:** ninguno — **módulo nuevo**. `docs/fase_2_estrategia/alcance_v1/05c_dashboard.md` §20 dejaba reportes, gráficos y exportaciones fuera de V1; `WEB-D002` los incorpora. Se apoya en `18_accesibilidad_i18n_y_formatos.md` §5 y §9, `13_modelo_datos_web_v1.md` §7.4 y `docs/fase_5_proteccion/24_privacidad_proteccion_datos.md`
**Documentos que dependen de este:** `39` (home), `45` (privacidad), `48` (ayuda)

---

## 1. Tesis y qué NO es

Un reporte responde una pregunta que el usuario **sí hizo**. Es la diferencia
exacta con el módulo 34: un descubrimiento le cuenta algo que no preguntó; un
reporte le deja mirar lo que quiera, como quiera, con la certeza de que lo que
ve cuadra con el resto de la aplicación.

Ese "cuadra" es la tesis entera. Un reporte que dice S/318 en Alimentación
mientras el presupuesto de la misma categoría dice S/320 no tiene un error de
S/2: tiene un error de credibilidad que contamina todo lo demás. Por eso
**este módulo no tiene aritmética propia** (`RUL-REP-01`): agrega usando
exactamente las mismas reglas que los módulos que reporta.

La segunda mitad del módulo es la exportación, y no es una funcionalidad: es
una obligación. Los datos son del usuario. Debe poder llevárselos completos,
en un formato que otro programa entienda, sin pedir permiso y sin que nadie
tenga que aprobarlo. Eso cambia cómo se diseña: una funcionalidad puede
degradarse bajo carga, una obligación no (`RUL-REP-11`).

Y una regla que gobierna todo lo visual: **un gráfico que no habilita una
decisión no se dibuja** (`RUL-REP-05`). Es lo único que `05c` §20 dejaba fuera
con razón —"gráficos decorativos sin decisión"— y esa parte de la exclusión
sigue vigente palabra por palabra.

**Qué NO es:**

- **No es un reporte contable ni fiscal.** No produce estados financieros
  formales, no calcula impuestos, no sirve para presentar ante nadie. Quien lo
  necesite se lleva el CSV y usa una herramienta de contabilidad.
- **No es un panel de analítica.** No hay métricas configurables, ni
  dimensiones arbitrarias, ni gráficos que el usuario compone. Cinco vistas
  fijas que responden preguntas reales.
- **No es el asistente.** Si la pregunta no cabe en las vistas fijas, se
  pregunta en la conversación, donde la capa semántica sí compone libremente
  (`20b`). El reporte es lo que se mira sin escribir.
- **No es un descubrimiento.** No interpreta, no destaca, no concluye. Muestra
  y deja mirar.

## 2. Alcance

| Nivel | Funcionalidad |
|---|---|
| **IN** | Reporte por periodo con desglose por categoría, cuenta y tipo. Comparativa entre dos periodos. Los cinco gráficos de `RUL-REP-05`, todos accesibles con tabla equivalente. Exportación de movimientos a CSV con filtros aplicados. **Exportación completa de todos los datos del usuario.** Reportes guardados. Filtros en URL. |
| **V1.1** | Exportación a PDF con formato de reporte. Reportes programados por correo. Exportación a XLSX. Comparativa de más de dos periodos. |
| **FUERA** | Reportes fiscales o tributarios. Estados financieros formales. Gráficos decorativos sin decisión asociada. Métricas o dimensiones configurables por el usuario. |

## 3. Vocabulario

| Interno | Visible |
|---|---|
| `saved_report` | Vista guardada |
| `export_job` | Descarga |
| `datos_completos` | "Todos mis datos" |
| `aggregation` | Desglose |
| `bucket`, `serie`, `dataset` | — (nunca visibles) |

Prohibido frente al usuario: `dashboard`, `métrica`, `dimensión`, `dataset`,
`drill-down`, `pivot`, `agregación`, `serie temporal`, además de la lista
general de `04_glosario_y_lenguaje_visible.md` §10.

Y un matiz de nombre: la sección se llama **Reportes**, pero los títulos
internos hablan del periodo, no del artefacto.

```text
Correcto:   Julio 2026
Correcto:   Julio comparado con junio
Incorrecto: Reporte mensual de gastos por categoría
```

## 4. Entidades y datos

### 4.1 `saved_reports` — vistas guardadas

```sql
id, user_id
name    text not null
config  jsonb not null
created_at, updated_at, deleted_at
```

Documentada en `13` §7.4. **Guarda la configuración, nunca los datos.** Un
reporte con sus datos dentro queda obsoleto en cuanto el usuario registra algo,
y mostrar una foto vieja como si fuera actual es peor que no guardarla.

Forma de `config`, validada con Zod compartido entre cliente y servidor:

```jsonc
{
  "periodo":  { "tipo": "mes", "valor": "2026-07" },
  "agrupar":  "categoria",              // categoria | cuenta | tipo | subcategoria
  "comparar": { "tipo": "mes", "valor": "2026-06" },   // o null
  "filtros":  { "categorias": ["alimentacion"], "cuentas": [], "tipos": [] },
  "grafico":  "barras_categoria"
}
```

`name` es único por usuario entre las no borradas, 1–60 caracteres.

### 4.2 `export_jobs` — trazabilidad de descargas

```sql
id, user_id
kind          export_kind      -- movimientos | datos_completos | reporte
format        export_format    -- csv | xlsx | pdf | json
status        export_status    -- pendiente | procesando | listo | expirado | fallido
row_count     integer null
requested_at, completed_at, expires_at
metadata      jsonb
```

Documentada en `13` §7.4. Registrar la solicitud es **obligación de auditoría
de privacidad**, no telemetría: si alguien pregunta alguna vez qué datos suyos
salieron y cuándo, la respuesta tiene que existir.

`metadata` guarda los filtros aplicados y el conteo, nunca el contenido.

**El archivo no se conserva más allá de `expires_at`.** Ver `RUL-REP-13`.

### 4.3 Migración

`051`, documentada en `13` §7.4. **Sin cambios**: las dos tablas cubren lo que
este módulo necesita. Los formatos `xlsx` y `pdf` del enum quedan sin usar en
V1 y se activan en V1.1.

### 4.4 De dónde salen los datos

Este módulo **no tiene datos propios más allá de sus dos tablas de
configuración**. Todo lo que muestra se agrega de otros:

| Fuente | Qué aporta |
|---|---|
| `26` Movimientos | La materia prima de todo reporte |
| `25` Categorías | El árbol de agrupación |
| `24` Cuentas y cajas | Desglose por cuenta, saldos de referencia |
| `32` Presupuestos | La línea de referencia sobre las barras de categoría |
| `31` Deudas, `30` Recurrentes | Sus movimientos, ya contados como tales |
| `36` Memoria, `20c` Perfil | Solo para la exportación completa |

## 5. Máquina de estados

### 5.1 Reporte

No aplica. Un reporte es una consulta, no una entidad con ciclo de vida. Lo
que sí tiene estado es su exportación.

### 5.2 Exportación

```text
   solicitar
       │
       ▼
  ┌───────────┐      ┌─────────────┐      ┌────────┐
  │ pendiente │─────►│ procesando  │─────►│ listo  │
  └───────────┘      └──────┬──────┘      └───┬────┘
                            │                 │ pasan 24 h
                            ▼                 ▼
                       ┌─────────┐      ┌──────────┐
                       │ fallido │      │ expirado │
                       └─────────┘      └──────────┘
```

`fallido` es un estado terminal con causa registrada, y **el usuario puede
volver a pedirlo** sin que nadie intervenga. `expirado` no es un error: es la
política de retención cumpliéndose.

## 6. Reglas de negocio

**`RUL-REP-01` — El reporte no tiene aritmética propia**

La regla que gobierna el módulo. Un reporte **agrega**; nunca define cómo se
calcula algo.

| Qué se pregunta | Quién manda |
|---|---|
| Qué movimientos cuentan como gasto | `26` §6 |
| Qué cuenta en un presupuesto | `RUL-PRES-02` |
| Qué es dinero libre | `RUL-CUENTAS-03` |
| Qué es un pago de deuda | `31` §6 |
| Cómo se reparte un movimiento sin categoría | `25` §6 |

Consecuencia verificable: **el gasto de Alimentación en julio debe dar
exactamente el mismo número en el reporte, en la pantalla de presupuestos y en
la respuesta del asistente.** Si difieren, es un defecto de este módulo, no
una diferencia de criterio.

```text
Reporte de julio, Alimentación:     S/318.00
Presupuesto de julio, Alimentación: S/318.00 de S/400.00
Asistente, "cuánto llevo en comida": S/318.00

Los tres salen de la misma función de agregación. No hay tres.
```

Esta es la razón por la que el módulo se escribe después de los diez que
reporta y no antes.

**`RUL-REP-02` — Todo reporte declara qué dejó fuera**

Igual que un descubrimiento (`RUL-DESC-04`) y por el mismo motivo: la
credibilidad no está en el número, está en saber cómo se hizo.

```text
Julio 2026 · Gastos por categoría
Total: S/1,847.50 en 63 movimientos

No conté: 4 transferencias entre tus cuentas, 2 asignaciones a cajas,
          1 ajuste de saldo, y 3 pendientes que no has confirmado.
          [Ver los 3 pendientes]
```

La última línea es un puente, no una nota al pie: si hay pendientes sin
confirmar, el número del reporte está incompleto y el usuario puede
arreglarlo en un clic.

**`RUL-REP-03` — Los periodos son los mismos de toda la app**

| Periodo | Definición |
|---|---|
| Semana | Lunes a domingo |
| Quincena | Del 1 al 15, y del 16 al último día |
| Mes | Del 1 al último día |
| Rango libre | Dos fechas, máximo 366 días |

Idénticos a `RUL-PRES-09`, en `America/Lima`. **No se inventa un cuarto
criterio de periodo aquí**; si mañana los presupuestos se alinean con el día
de cobro (V1.1), los reportes heredan ese cambio sin tocar este documento.

El rango libre tiene tope de 366 días por rendimiento y porque más allá de un
año la comparación deja de ser legible. Quien quiera más, exporta.

**`RUL-REP-04` — La comparativa es entre dos periodos equivalentes**

Solo se compara mes con mes, semana con semana, quincena con quincena. **Julio
contra la primera semana de junio no es una comparación, es un error de
lectura esperando a ocurrir.**

Con periodos de distinta longitud —febrero contra marzo, o un mes en curso
contra uno cerrado— se dice explícitamente:

```text
Julio (26 días transcurridos) comparado con junio (30 días).
Los días no son los mismos: julio va por la mitad.
```

Nunca se normaliza en silencio a "gasto diario equivalente". Normalizar es una
decisión de análisis, y tomarla sin decirlo produce un número que el usuario
no puede reproducir.

**`RUL-REP-05` — Cinco gráficos, y cada uno habilita una decisión**

| Gráfico | Qué pregunta responde | Qué decisión habilita |
|---|---|---|
| Barras por categoría | ¿Dónde se va mi dinero? | Ponerle presupuesto a la que más pesa |
| Línea de evolución | ¿Estoy gastando más que antes? | Mirar el mes que se sale |
| Barras comparadas | ¿Qué cambió entre estos dos meses? | Abrir la categoría que más cambió |
| Ingreso contra gasto | ¿El mes cierra? | Ver el margen real del periodo |
| Barras apiladas por cuenta | ¿De dónde sale lo que gasto? | Detectar la cuenta que se vacía |

**No hay un sexto.** Y ninguno se dibuja si su decisión no aplica: el de
ingreso contra gasto no aparece si el usuario no registra ingresos.

Prohibidos explícitamente: gráficos de sectores con más de 5 porciones
(ilegibles y sin decisión asociada), medidores de "salud" (`WEB-D037`),
minigráficos decorativos junto a cifras, animaciones de entrada que retrasan
la lectura, y cualquier gráfico cuyo eje no empiece en cero cuando representa
dinero.

El último es el que más engaña: un eje truncado convierte una subida del 4% en
una montaña.

**`RUL-REP-06` — Todo gráfico tiene su tabla, y la tabla no es un premio de consolación**

Cada gráfico va acompañado de una tabla con **los mismos datos exactos**,
alcanzable con un control visible —no escondida tras un icono de
accesibilidad— y navegable con teclado.

```text
[ Gráfico ]  [ Tabla ]     ← dos pestañas del mismo peso

Categoría        Julio      Junio    Cambio
Alimentación   S/318.00   S/286.00    +S/32.00
Transporte     S/230.00   S/188.00    +S/42.00
Ocio            S/92.00   S/140.00    −S/48.00
```

Que la tabla sea una pestaña normal y no un "modo accesible" tiene una razón
práctica además de la evidente: **mucha gente prefiere la tabla**, y quien
quiere copiar un número al portapapeles la necesita. Diseñarla como rampa de
accesibilidad la condena a estar peor hecha.

**`RUL-REP-07` — Ningún gráfico comunica solo por color**

Aplicación de `18` §5 en la superficie donde más fácil se incumple:

- Cada serie lleva **etiqueta directa** o patrón de relleno, además del color.
- Los valores se muestran sobre las barras cuando caben, no solo en la leyenda.
- El aumento y la disminución se distinguen por **signo y palabra**
  (`+S/32.00`, "subió"), nunca solo por rojo y verde.
- La paleta cumple contraste AA contra el fondo en ambos temas.

La tercera importa más de lo que parece: rojo y verde es precisamente la
distinción que no ve una parte apreciable de la población, y es la que todo
producto financiero usa por defecto.

**`RUL-REP-08` — El reporte no interpreta**

Muestra y ordena. **No destaca, no concluye, no felicita, no advierte.**

```text
Correcto:   Transporte    S/230.00    +S/42.00 que en junio
Incorrecto: ⚠️ Transporte se disparó un 22% este mes
Incorrecto: Tu categoría más problemática fue Transporte
```

Interpretar es el trabajo del módulo 34, que lo hace con umbrales, evidencia y
la posibilidad de que el usuario diga que no le sirve. Un reporte que
interpreta lo hace sin ninguna de esas tres salvaguardas.

**`RUL-REP-09` — Los filtros viven en la URL, los datos no**

El estado completo del reporte —periodo, agrupación, comparación, filtros— se
serializa en la URL, para que funcione el botón atrás, se pueda guardar en
marcadores y se pueda abrir en otro dispositivo.

```text
/reportes?periodo=mes&valor=2026-07&agrupar=categoria&comparar=2026-06
```

**En la URL van criterios, nunca cifras ni identificadores de movimiento.** Y
una consecuencia que conviene decir en voz alta: esa URL **no comparte nada**.
Quien la abra verá sus propios datos, o nada si no tiene sesión. Es un enlace
a una vista, no a unos números. En V1-web **no existe forma de compartir un
reporte con otra persona**, y no es un olvido.

**`RUL-REP-10` — La exportación de movimientos respeta los filtros vigentes**

Lo que se descarga es exactamente lo que está en pantalla, ni más ni menos, y
el archivo lo dice en su nombre:

```text
manzana-movimientos-2026-07-01-a-2026-07-31.csv
manzana-movimientos-alimentacion-2026-07.csv
```

Formato del CSV, especificado para que no haya que adivinar:

| Aspecto | Decisión |
|---|---|
| Codificación | UTF-8 **con BOM** |
| Separador | Coma |
| Entrecomillado | RFC 4180: comillas dobles, duplicadas para escapar |
| Fin de línea | `CRLF` |
| Fechas | ISO 8601 (`2026-07-14`), no el formato de presentación |
| Montos | Punto decimal, sin separador de miles, sin `S/` (`318.50`) |
| Signo | Negativo para salidas de dinero, positivo para entradas |
| Cabecera | Siempre, en español |

El BOM es la decisión menos obvia y la que más problemas evita: sin él, Excel
abre el archivo en la codificación local y destroza todas las tildes y las
eñes. Con él, abre bien. El coste es que algunas herramientas de línea de
comandos ven tres bytes extra al principio, que es un problema mucho menor y
de un público mucho más capaz de resolverlo.

Los montos van sin `S/` y con punto decimal porque el archivo es **para otro
programa**, no para leerlo. El formato de presentación de `18` §9.1 gobierna
la pantalla, no el fichero.

Columnas: `fecha`, `tipo`, `descripcion`, `monto`, `moneda`, `categoria`,
`subcategoria`, `cuenta`, `caja`, `etiquetas`, `origen`, `estado`,
`id_movimiento`.

**`RUL-REP-11` — La exportación completa es una obligación, no una función**

Consecuencias de tratarla así, y las tres son verificables:

1. **Está siempre disponible**, incluso en modo degradado. Si el asistente
   está caído, exportar sigue funcionando.
2. **No requiere aprobación de nadie** ni tiene límite de uso razonable
   (`RUL-REP-12` acota el abuso, no el derecho).
3. **Incluye todo**, no un resumen. La lista es cerrada y está en §6 bajo este
   mismo identificador.

Qué incluye la exportación completa, en JSON estructurado:

| Bloque | Contenido |
|---|---|
| `cuenta` | Correo, fecha de alta, preferencias, modo discreto |
| `movimientos` | Todos, incluidos los eliminados, con su estado |
| `cuentas_y_cajas` | Con saldos e historial de ajustes |
| `categorias` | El árbol completo, incluidas las propias |
| `etiquetas` | Todas |
| `presupuestos_y_metas` | Con sus periodos históricos y snapshots |
| `deudas` | Con cuotas, pagos y personas relacionadas |
| `recurrentes` | Reglas y ocurrencias |
| `pendientes` | Confirmados y sin confirmar |
| `correo` | Buzones conectados y remitentes vigilados, **nunca el contenido de los correos** |
| `perfil` | Todos los hechos aprendidos, con su evidencia y estado (`36`) |
| `descubrimientos` | Historial completo, incluidos los expirados |
| `conversaciones` | Hilos y mensajes del asistente |
| `descargas` | El historial de `export_jobs` |

El bloque `perfil` es el que cumple `AC-DATOS-15` y cierra la mitad de `C-08`
que corresponde a este módulo: no basta con poder ver lo aprendido dentro de
la app, hay que poder llevárselo.

**No se incluye el contenido de los correos** porque nunca se almacena: el
módulo 28 extrae metadatos y datos de la transacción, y el cuerpo no se
guarda. El JSON lo dice explícitamente en vez de omitirlo en silencio, porque
una ausencia sin explicar parece una ocultación.

Junto al JSON, el mismo archivo comprimido lleva **los movimientos también en
CSV**, porque es lo que la mayoría va a querer abrir.

**`RUL-REP-12` — Las descargas se acotan, el derecho no**

| Límite | Valor | Por qué |
|---|---|---|
| Exportación completa | 1 cada 24 h | Es cara y nadie la necesita más seguido |
| Exportación de movimientos | 10 al día | Uso normal generoso |
| Movimientos por exportación | Sin límite | Recortar el propio historial no tiene justificación |
| Vigencia del enlace | 24 h | `RUL-REP-13` |

Al alcanzar el límite **no se rechaza sin más**: se dice cuándo estará
disponible otra vez, y si hay una descarga vigente se ofrece.

Ninguno de estos límites aplica a la exportación que acompaña a una
**eliminación de cuenta** (`45`). Ahí el usuario se está yendo, y ponerle un
límite de frecuencia a su último acto sería indefendible.

**`RUL-REP-13` — El archivo generado caduca y se borra**

Un `export_jobs` en `listo` tiene `expires_at` a **24 horas**. Pasadas, el
archivo se elimina del almacenamiento y el registro pasa a `expirado`,
conservando la fila para auditoría.

El enlace de descarga es **de un solo uso, firmado y con caducidad propia de
15 minutos** desde que se genera. Se genera al pulsar descargar, no al crear
el trabajo.

La razón de todo esto: ese archivo es la copia más completa y menos protegida
que existirá nunca de la vida financiera del usuario. Un enlace permanente a
él en el historial de un navegador compartido es exactamente el escenario que
hay que impedir.

**`RUL-REP-14` — Modo discreto: las proporciones se quedan, los montos se van**

| Elemento | En modo discreto |
|---|---|
| Barras y líneas | **Visibles**, con sus proporciones intactas |
| Ejes con valores | Ocultos |
| Montos en tablas | `S/•••` |
| Porcentajes y cambios relativos | **Visibles** |
| Categorías sensibles (`RUL-DESC-13`) | Ocultas enteras, con su fila contada como "otras" |
| Exportar | **Disponible**: descargar no es mostrar |

La primera fila es la decisión: la forma de un gráfico no revela cuánto gana
alguien, y ocultarla dejaría la pantalla inútil sin proteger nada. Es el mismo
criterio de `32` §12 con las barras de presupuesto.

La última también: modo discreto protege de quien mira la pantalla, no del
propio usuario. Bloquear la exportación sería confundir las dos cosas.

## 7. Validaciones

| Campo | Regla |
|---|---|
| `periodo.tipo` | `semana`, `quincena`, `mes` o `rango` |
| `periodo.valor` | Coherente con el tipo; lo resuelve el servidor, no el cliente |
| Rango libre | `hasta >= desde`; máximo 366 días; ambas fechas no futuras |
| `agrupar` | `categoria`, `subcategoria`, `cuenta` o `tipo` |
| `comparar` | Mismo tipo de periodo que el principal, o nulo |
| `filtros.categorias` | Existentes y del usuario |
| `grafico` | De los cinco de `RUL-REP-05`, y compatible con `agrupar` |
| `saved_report.name` | 1–60 caracteres, único por usuario entre las no borradas |
| `export.kind` / `.format` | Del enum. En V1 solo `csv` y `json` |

## 8. Superficies

**Referencia visual: no existe frame previo.** `05c` §20 excluía reportes,
gráficos y exportaciones de V1, así que no hay nada en
`docs/fase_6_visual/32_especificacion_hifi.md` ni en `stitch_manzana_v1/`.
Tokens, tipografía tabular y primitivas de tabla salen de
`16_design_system_web.md`.

### `SCR-REP-01` — Reportes

**Ruta:** `/reportes`
**Estado en URL:** `periodo`, `valor`, `desde`, `hasta`, `agrupar`,
`comparar`, `categorias`, `cuentas`, `tipos`, `grafico`

```text
┌──────────────────────────────────────────────────┐
│ Julio 2026            [◄] [mes ▾] [►]  [Guardar] │
│ Comparar con: [junio 2026 ▾]                     │
├──────────────────────────────────────────────────┤
│ Gastaste S/1,847.50 en 63 movimientos            │
│ Te entraron S/2,400.00                           │
│ No conté 4 transferencias, 2 asignaciones y      │
│ 3 pendientes sin confirmar.  [Ver los 3]         │
├──────────────────────────────────────────────────┤
│ [ Gráfico ] [ Tabla ]        Agrupar: [categoría]│
│                                                  │
│ Alimentación ████████████████ S/318  +S/32       │
│ Transporte   ███████████▌     S/230  +S/42       │
│ Servicios    █████████        S/180   −S/4       │
│ Ocio         ████▌            S/ 92  −S/48       │
│ Otras (7)    ██████████▌      S/210  +S/18       │
│                                                  │
│ ─── presupuesto de Alimentación: S/400 ───       │
├──────────────────────────────────────────────────┤
│ [Descargar CSV]                                  │
└──────────────────────────────────────────────────┘
```

Detalles que importan:

- Las dos primeras cifras son **gasto e ingreso, en ese orden**, porque la
  pregunta que la gente trae a un reporte es "cuánto se me fue".
- "No conté" está arriba, junto al total, no al pie. Una exclusión que se
  descubre después de creer un número llega tarde.
- La línea de presupuesto aparece **solo si existe** para esa categoría, y es
  una referencia visual, no una evaluación (`RUL-REP-08`).
- "Otras (7)" agrupa la cola: nunca más de 5 barras más una agrupación.
  Veinte barras no son un gráfico, son una tabla mal dibujada.
- Los cambios llevan signo y magnitud, nunca solo color (`RUL-REP-07`).

### `SCR-REP-02` — Tabla del reporte

Misma ruta, pestaña. Tabla completa, ordenable por cualquier columna, con
cifras en tipografía tabular y totales al pie. Cada fila lleva a los
movimientos que la componen.

Es la superficie que el usuario usará para copiar números, así que **el texto
es seleccionable y los montos se copian sin el símbolo de moneda**.

### `SCR-REP-03` — Vistas guardadas

**Ruta:** `/reportes/guardadas`

Lista de configuraciones guardadas, con su nombre y una línea que describe qué
muestran. Abrir una restaura la URL completa.

### `SCR-REP-04` — Descargar mis datos

**Ruta:** `/configuracion/datos`

Vive en configuración y no en reportes, porque es una función de la cuenta y
ahí es donde la gente la busca. El módulo 45 la enmarca; aquí se especifica.

```text
┌──────────────────────────────────────────────────┐
│ Tus datos                                        │
├──────────────────────────────────────────────────┤
│ Puedes llevarte todo lo que Manzana sabe de ti,  │
│ en un formato que otros programas entienden.     │
│                                                  │
│ Incluye tus movimientos, cuentas, presupuestos,  │
│ deudas, lo que Manzana aprendió sobre ti y tus   │
│ conversaciones.        [Ver la lista completa]   │
│                                                  │
│ [Preparar mi descarga]                           │
├──────────────────────────────────────────────────┤
│ Descargas anteriores                             │
│ 24 jul · Todos mis datos · caducó                │
│ 12 jul · Movimientos de julio · caducó           │
└──────────────────────────────────────────────────┘
```

- El texto dice **qué incluye antes de pedirlo**, con la lista completa a un
  clic. Nadie debería tener que descargar un archivo para saber qué contiene.
- El historial muestra las caducadas y **no ofrece volver a descargarlas**:
  eso sería una descarga nueva, con su registro nuevo.
- Preparar una descarga muestra progreso y avisa al terminar. No bloquea la
  pantalla.

### `SCR-REP-05` — Resumen del periodo en el Inicio

Componente compacto: gastado, entrado y la categoría que más pesa, con enlace
al reporte. Sin gráfico —en el Inicio no cabe uno que habilite una decisión— y
sin comparativa.

## 9. Acciones

| ID | Acción | ¿Confirma? | Deshacer | Evento |
|---|---|---|---|---|
| `ACT-REP-01` | Cambiar periodo | No | Volviendo atrás | `reporte.periodo_cambiado` |
| `ACT-REP-02` | Cambiar agrupación | No | Ídem | `reporte.agrupacion_cambiada` |
| `ACT-REP-03` | Activar comparación | No | Desactivándola | `reporte.comparacion_activada` |
| `ACT-REP-04` | Aplicar filtros | No | Quitándolos | `reporte.filtrado` |
| `ACT-REP-05` | Alternar gráfico y tabla | No | — | `reporte.vista_cambiada` |
| `ACT-REP-06` | Abrir los movimientos de una fila | No | — | `reporte.detalle_abierto` |
| `ACT-REP-07` | Guardar la vista | No | Eliminándola | `reporte.vista_guardada` |
| `ACT-REP-08` | Eliminar una vista guardada | Sí | Restaurando | `reporte.vista_eliminada` |
| `ACT-REP-09` | Descargar movimientos en CSV | No | — | `exportacion.solicitada` |
| `ACT-REP-10` | Preparar la descarga completa | **Sí** | — | `exportacion.completa_solicitada` |
| `ACT-REP-11` | Descargar un archivo listo | No | — | `exportacion.descargada` |

`ACT-REP-10` confirma, y es la única de la lista que lo hace. No porque sea
peligrosa —es un derecho del usuario— sino porque conviene que sepa qué está
generando antes de tener un archivo con toda su vida financiera en la carpeta
de descargas. La tarjeta de confirmación es informativa, no disuasoria.

**Ninguna acción de este módulo escribe datos financieros.** Las once son
lectura, configuración de vista o generación de archivo.

## 10. API

| Método y ruta | Notas |
|---|---|
| `GET /reports/period` | Agregado del periodo con desglose, exclusiones y referencias |
| `GET /reports/compare` | Dos periodos equivalentes con sus diferencias |
| `GET /reports/chart` | Series listas para dibujar, con su tabla equivalente en la misma respuesta |
| `GET /saved-reports` · `POST` · `PATCH` · `DELETE` | Vistas guardadas |
| `POST /exports` | Crea un `export_job`. `Idempotency-Key` obligatoria |
| `GET /exports` | Historial del usuario, con estado |
| `GET /exports/[id]` | Estado de uno |
| `POST /exports/[id]/link` | Genera el enlace firmado de un solo uso, 15 min |

`GET /reports/chart` devuelve **el gráfico y su tabla en la misma respuesta**,
no en dos peticiones. Es lo que hace posible que la pestaña Tabla sea
instantánea, y lo que impide que alguien implemente la tabla como una llamada
distinta que un día devuelve números distintos.

Todas las rutas de lectura devuelven `evidence_refs` (`22` §2): un total de
reporte es una cifra como cualquier otra y debe poder abrirse.

`POST /exports` responde `202` con el identificador del trabajo. **Nunca
genera el archivo dentro de la petición**: la exportación completa de un
usuario con años de historial no cabe en un tiempo de respuesta razonable.

## 11. Permisos y RLS

- Cliente autenticado en todas las rutas. RLS por `user_id` en `saved_reports`
  y `export_jobs`.
- **Una excepción de service-role, en la lista blanca de `15` §4:** el
  trabajador que genera los archivos de exportación y el que los borra al
  caducar. Ninguno de los dos escribe datos financieros.
- Los enlaces de descarga son firmados, de un solo uso y con caducidad propia
  (`RUL-REP-13`). **Un enlace no autenticado nunca da acceso a datos**: la
  firma incluye el usuario y el trabajo, y se invalida al usarse.
- Un reporte o una exportación de otro usuario devuelve 404.

## 12. Estados de datos

| Estado | Qué se muestra |
|---|---|
| **Sin movimientos** | "Cuando registres algo, aquí verás en qué se te va." + registrar. Sin gráfico vacío |
| **Menos de 5 movimientos en el periodo** | Tabla sí, gráfico no: cuatro barras no son un gráfico |
| **Periodo sin movimientos, con otros que sí tienen** | "En julio no registraste nada." + saltar al último periodo con datos |
| **Sin ingresos registrados** | El gráfico de ingreso contra gasto no aparece (`RUL-REP-05`) |
| **Sin periodo anterior comparable** | La comparación se ofrece desactivada, diciendo por qué |
| **Todo en una sola categoría** | Se muestra igual, sin sugerir que es un problema |
| **Cargando** | Esqueleto con la forma de las barras, no un spinner centrado |
| **Exportación en curso** | Progreso, y la pantalla sigue usable |
| **Exportación fallida** | Causa y botón de reintentar, sin perder los filtros |
| **Modo discreto** | `RUL-REP-14` |

## 13. Errores

| ID | Causa | Mensaje visible | Salida |
|---|---|---|---|
| `ERR-REP-01` | Rango mayor de 366 días | "Puedo mostrarte hasta un año a la vez. Para más, descarga el CSV." | Acortar o descargar |
| `ERR-REP-02` | Fecha final anterior a la inicial | "La fecha de fin va después de la de inicio." | Corregir |
| `ERR-REP-03` | Comparar periodos de distinto tipo | "Solo puedo comparar meses con meses, o semanas con semanas." | Elegir otro |
| `ERR-REP-04` | Vista guardada no encontrada | "Esa vista guardada ya no existe." | Ver las demás |
| `ERR-REP-05` | Nombre de vista duplicado | "Ya tienes una vista con ese nombre." | Cambiar nombre |
| `ERR-REP-06` | Límite de descargas alcanzado | "Ya preparaste tus datos hoy. Puedes volver a pedirlo mañana a las 9:14." | Ver la descarga vigente |
| `ERR-REP-07` | Enlace de descarga caducado | "Ese enlace ya caducó. Preparo uno nuevo." | Generar otro |
| `ERR-REP-08` | Enlace ya usado | "Ese enlace ya se usó. Preparo uno nuevo." | Generar otro |
| `ERR-REP-09` | Generación fallida | "No pude preparar tu descarga. Ya lo estoy revisando; vuelve a intentarlo." | Reintentar |

`ERR-REP-06` da la hora exacta, no "más tarde". Y `ERR-REP-07` y `ERR-REP-08`
no son callejones: generar otro enlace es un clic y no cuenta como descarga
nueva contra el límite, porque el trabajo ya existía.

## 14. Integración con el motor IA

### 14.1 Consultas que expone

Este módulo aporta al vocabulario semántico **la capacidad de agrupar**, que es
transversal:

| Dimensión | Notas |
|---|---|
| `periodo_reporte` | Semana, quincena, mes, rango |
| `agrupacion` | Categoría, subcategoría, cuenta, tipo |
| `tiene_comparacion` | |
| `estado_exportacion` | |

| Medida | Notas |
|---|---|
| `total_por_grupo` | **Alias** de `suma` con la agrupación pedida (`RUL-CATALOGO-04`). Con las referencias de cada grupo |
| `variacion_entre_periodos` | Absoluta y relativa |
| `movimientos_excluidos` | Cuántos y por qué |

`movimientos_excluidos` es una medida rara y deliberada: permite que el
asistente responda *"¿por qué tu reporte dice 1,847 y tú creías 1,900?"* sin
que nadie tenga que programar esa pregunta.

### 14.2 Comandos que acepta

| Comando | Confirmación |
|---|---|
| `guardar_vista_reporte` | No: es reversible y no toca dinero |
| `eliminar_vista_reporte` | Tarjeta |
| `exportar_movimientos` | Tarjeta con el conteo y los filtros |
| `exportar_datos_completos` | **Tarjeta**, con la lista de lo que incluye |

`exportar_datos_completos` confirma por la misma razón que `ACT-REP-10`: que
el usuario sepa qué archivo va a existir.

### 14.3 Qué se puede pedir en lenguaje natural

```text
"¿en qué se me fue julio?"                  → reporte agrupado por categoría
"compárame julio con junio"                 → comparativa
"¿por qué dice 1,847 y no 1,900?"           → exclusiones del reporte
"descárgame mis movimientos de julio"       → exportar_movimientos
"quiero todos mis datos"                    → exportar_datos_completos
"guárdame esta vista como 'mes normal'"     → guardar_vista_reporte
```

La quinta se atiende **siempre y sin fricción**. Un asistente que responde a
"quiero mis datos" con preguntas de por qué o con una sugerencia de que quizá
no le hagan falta está poniéndose entre el usuario y sus datos, que es
exactamente lo que `RUL-REP-11` prohíbe.

### 14.4 Lo que el motor NO puede hacer aquí

- **Interpretar el reporte.** Puede leerlo y describirlo; concluir es del 34.
- Inventar una agrupación que no esté en el vocabulario. Si la pregunta no
  cabe, va por la consulta abierta de `20b`, no por aquí.
- Enviar una exportación a ningún destino. **Genera un enlace para el usuario
  y nada más**: no manda correos, no sube a ningún servicio, no comparte.
- Cambiar el formato del CSV.

La tercera es un límite duro. Una exportación que puede enviarse a un destino
que el modelo elige es una vía de salida de todos los datos del usuario
gobernada por texto, y ninguna cantidad de instrucciones lo hace seguro.

## 15. Memoria y aprendizaje

| Qué aprende | De dónde | Cómo se corrige |
|---|---|---|
| Qué periodo mira habitualmente | Periodo más usado | — |
| Qué agrupación prefiere | Agrupación más usada | — |
| Si prefiere gráfico o tabla | Pestaña que abre | — |
| Qué categorías filtra a menudo | Filtros repetidos | — |

Los cuatro son preferencias de vista, no hechos sobre la persona: se aplican
como valores por defecto y **no alimentan el perfil de `20c`**. Que alguien
mire siempre la tabla dice cómo lee, no cómo vive.

Efecto práctico: al abrir `/reportes` sin parámetros, se restaura la última
combinación usada en vez de un default genérico.

## 16. Eventos y telemetría

Eventos: `reporte.abierto`, `.periodo_cambiado`, `.agrupacion_cambiada`,
`.comparacion_activada`, `.filtrado`, `.vista_cambiada`, `.detalle_abierto`,
`.vista_guardada`, `.vista_eliminada`, `exportacion.solicitada`,
`.completa_solicitada`, `.lista`, `.descargada`, `.fallida`, `.expirada`.

Sin montos. Sí periodo, agrupación, si había comparación, conteo de filas y
`trace_id`.

| Métrica | Qué indica |
|---|---|
| Uso de la pestaña Tabla | Si `RUL-REP-06` acertó al no tratarla como rampa |
| Reportes con comparación activa | Si la comparativa aporta o es ruido |
| Vistas guardadas por usuario | Si la función se usa o sobra |
| **Exportaciones completas que terminan en `listo`** | **Salud de una obligación, no de una función** |
| Tiempo de generación de la exportación completa | Si escala con el historial |
| Exportaciones fallidas | Cualquier valor sostenido por encima de cero es un incidente |
| Clics desde una fila a sus movimientos | Si el reporte lleva a algún lado |

Las dos de exportación se vigilan distinto que el resto: un reporte lento es
una molestia, una exportación que falla es un derecho incumplido.

## 17. Rendimiento

- Índices: los de `movements` por `(user_id, occurred_at desc, id desc)` y
  `(user_id, category_id, occurred_at)` que ya exige `26` §17. Este módulo
  **no añade índices nuevos**: agrega sobre los mismos datos que el listado.
- El agregado del periodo es **una sola consulta con `group by`**, no una por
  categoría. Con comparación, dos consultas, no `2 × n`.
- `GET /reports/period` bajo 400 ms para un año de datos; `/reports/chart`
  bajo 400 ms; `/reports/summary` del Inicio bajo 200 ms.
- Los agregados de periodos **cerrados** se pueden cachear indefinidamente:
  julio de 2025 no va a cambiar salvo que el usuario edite un movimiento de
  julio de 2025, y eso invalida la entrada. El periodo en curso no se cachea.
- La exportación se genera **en streaming, por lotes**, y nunca carga el
  historial completo en memoria. Es lo que permite no poner límite de filas
  (`RUL-REP-12`).
- Coste de modelo: **cero**. Todo el módulo es determinista. El asistente
  puede describir un reporte, pero el reporte no necesita al asistente.

## 18. Accesibilidad específica

- Cada gráfico es un `figure` con `figcaption` que **describe el hallazgo en
  texto**, no el tipo de gráfico: "Alimentación fue la categoría con más
  gasto, S/318 de S/1,847", no "gráfico de barras de gastos".
- `role="img"` con `aria-label` en el SVG, y la tabla equivalente como
  contenido alternativo real, alcanzable con teclado.
- Las pestañas Gráfico y Tabla siguen el patrón de tabs de `16`: flechas para
  moverse, `Home` y `End`, y el panel asociado con `aria-controls`.
- La tabla usa `th` con `scope`, tiene `caption` y sus totales van en `tfoot`.
- Ordenar una columna anuncia el nuevo orden en una región `aria-live`
  discreta.
- Ningún cambio de filtro roba el foco ni desplaza la página.
- El progreso de una exportación se anuncia en `aria-live="polite"`, y su
  finalización también: quien no ve la pantalla debe enterarse de que su
  archivo está listo.
- Contraste AA en todas las series, en tema claro y oscuro.

## 19. Casos borde

1. **Movimiento editado dentro de un periodo cerrado y cacheado.** Invalida esa
   entrada de caché; el reporte del periodo vuelve a calcularse.
2. **Categoría eliminada con movimientos históricos.** Aparece en los reportes
   de los periodos en que existía, marcada como eliminada. Un reporte del
   pasado no se reescribe.
3. **Movimiento sin categoría.** Fila propia "Sin categoría", con enlace para
   clasificarlos. Nunca se reparte entre las demás.
4. **Movimiento con cuenta `null`** en agrupación por cuenta. Fila "Sin cuenta
   asignada", con enlace a asignarla.
5. **Periodo con un solo movimiento.** Tabla sí, gráfico no.
6. **Rango libre que cruza dos años.** Válido si no supera 366 días.
7. **Usuario que pide la exportación completa dos veces seguidas.** La segunda
   devuelve la vigente en vez de generar otra (`ERR-REP-06`).
8. **Exportación completa de un usuario recién registrado.** Se genera igual,
   con las secciones vacías presentes. Un JSON con claves vacías es más útil
   que uno incompleto.
9. **Exportación que caduca mientras se descarga.** La descarga en curso
   termina; el enlace ya no sirve para otra.
10. **Usuario que elimina su cuenta con una exportación en curso.** El trabajo
    se cancela y el archivo se borra. Los datos ya no existen.
11. **Comparar julio con febrero.** Permitido: son dos meses. Se advierte de la
    diferencia de días (`RUL-REP-04`).
12. **Mes en curso comparado con el anterior completo.** Permitido, con el
    aviso de días transcurridos. Nunca se extrapola el mes en curso.
13. **Más de 20 categorías con gasto.** Cinco barras y "Otras (n)", que se
    puede abrir en la tabla.
14. **Todos los movimientos del periodo son transferencias.** El total de gasto
    es S/0.00 y se explica: "No registraste gastos en julio; sí 8
    transferencias entre tus cuentas."

El caso 14 es el que más fácil se implementa mal: mostrar `S/0.00` sin
explicación parece un error del sistema en vez de un hecho sobre el mes.

## 20. Criterios de aceptación

**Nota de alcance de `W-14`:** este corte entrega `GET /reports/period`,
`/compare`, `/chart` (un solo gráfico: `barras_categoria`, no los cinco),
`saved-reports` y el flujo de exportación (`POST /exports`, worker de
generación, enlace firmado). No entrega: renderizado visual de los otros
cuatro gráficos de `RUL-REP-05`, sincronización de filtros con la URL, modo
discreto en `/reportes`, ni la exportación real en streaming (ver
`AC-REP-12`). Se documenta cada gap en su criterio, no en silencio.

- `AC-REP-01` — El total de una categoría en un periodo es **idéntico** en el
  reporte, en el módulo de presupuestos y en la respuesta del asistente, y los
  tres salen de la misma función. Evidencia: `TEST`. Clase: `unidad`. Cierra
  en `W-14`: `report-engine.test.ts` reutiliza `movementCountsForBudget` de
  `budgets/budget-progress.ts` (el mismo filtro de Presupuestos), verificado
  con `RUL-HECHO-02` (mutado a un filtro propio, la prueba de exclusiones
  falló, restaurado). La respuesta del asistente no existe todavía
  (`W-16`/`17`): esa tercera pata queda sin verificar hasta que exista.
- `AC-REP-02` — Todo reporte declara qué movimientos excluyó y por qué.
  Evidencia: `TEST`. Clase: `unidad`. Cierra la parte `TEST` en `W-14`:
  `report-engine.test.ts` prueba las seis razones de exclusión. La mitad
  `USER` no cierra: no hubo sesión de tres personas.
- `AC-REP-03` — Cada gráfico tiene tabla equivalente con los mismos datos,
  alcanzable con teclado y devuelta en la misma respuesta de API. Evidencia:
  `TEST`. No cierra completo: `GET /reports/chart` sí devuelve `bars` y
  `table` en la misma respuesta (RUL-REP-06), pero solo para
  `barras_categoria` — los otros cuatro gráficos no tienen ruta ni interfaz.
- `AC-REP-04` — Ninguna serie se distingue solo por color, y ningún eje de
  dinero empieza fuera de cero. Evidencia: `TEST` + `USER`. No cierra: no
  hay renderizado visual de gráfico en este corte, solo la tabla
  (`reports-screen.tsx`).
- `AC-REP-05` — No existe ningún gráfico sin decisión asociada en
  `RUL-REP-05`. Evidencia: `TEST` parcial. `applicableCharts()` en
  `report-engine.test.ts` prueba que el de ingreso-contra-gasto no aparece
  sin ingresos y que nunca hay un sexto — pero solo un gráfico tiene
  interfaz real (ver `AC-REP-03`).
- `AC-REP-06` — El reporte no destaca, concluye ni advierte. Evidencia:
  `CODE`. No cierra `TEST`: `reports-screen.tsx` solo muestra cifras y una
  lista de exclusiones, sin juicio, pero no hay una prueba dedicada.
- `AC-REP-07` — El estado completo del reporte se restaura desde la URL, y la
  URL no contiene cifras ni identificadores de movimiento. Evidencia: `TEST`.
  No cierra: no construido — `/reportes` usa el mes actual fijo, sin leer ni
  escribir `periodo`/`valor`/`agrupar`/`comparar` en la URL.
- `AC-REP-08` — El CSV se abre en Excel con las tildes correctas: UTF-8 con
  BOM, `CRLF`, RFC 4180. Evidencia: `TEST`. Clase: `unidad`. Cierra la parte
  `TEST` en `W-14`: `csv-export.test.ts` verifica BOM, `CRLF` y el escapado
  RFC 4180. La evidencia `SMOKE` que el documento pedía (abrir el archivo en
  Excel de verdad) no se ejecutó.
- `AC-REP-09` — Los montos del CSV van sin símbolo, con punto decimal y sin
  separador de miles. Evidencia: `TEST`. Clase: `unidad`. Cierra en `W-14`.
- `AC-REP-10` — La exportación completa incluye los catorce bloques de
  `RUL-REP-11`, incluido el perfil aprendido. Evidencia: `TEST`. No cierra
  completo: doce de
  catorce bloques traen datos reales (movimientos, cuentas y cajas,
  etiquetas, deudas, recurrentes, pendientes, correo, perfil,
  descubrimientos, descargas, cuenta); `categorias` y
  `presupuestos_y_metas` quedan como texto de referencia a otro endpoint,
  no el contenido real, por el tiempo del corte. `conversaciones` está
  vacío porque el motor del asistente (`41`) no existe todavía — eso sí es
  correcto declararlo así, no un gap.
- `AC-REP-11` — La exportación completa funciona con el asistente caído y en
  modo degradado. Evidencia: `CODE`. No cierra `TEST`: la exportación no
  tiene ninguna dependencia del motor del asistente por diseño (no lo
  importa en ningún punto), pero no hay una prueba que lo demuestre
  activamente.
- `AC-REP-12` — La exportación no tiene límite de filas y se genera en
  streaming, sin cargar el historial en memoria. Evidencia: `CODE` + `TEST`.
  **No cierra, y es una contradicción real con lo construido**:
  `buildMovementsCsvContent` trae
  hasta 50.000 filas con un solo `.select()` y arma el CSV completo en
  memoria antes de subirlo — ni streaming ni sin límite. Se documenta como
  brecha nueva en vez de maquillarla; candidato a deuda de `53` en el
  siguiente corte que toque exportaciones.
- `AC-REP-13` — El enlace de descarga es de un solo uso, caduca en 15 minutos
  y no da acceso sin la firma del usuario correcto. Evidencia: `CODE`. No
  cierra `TEST`: se apoya en `createSignedUrl` de Supabase Storage
  (mecanismo de la plataforma, no propio) con TTL de 900s y verificación de
  propiedad previa por RLS; no hay una prueba que ejercite el enlace en sí.
- `AC-REP-14` — El archivo se borra al caducar el trabajo, y la fila de
  `export_jobs` se conserva. Evidencia: `TEST`. No cierra: no existe un
  worker que borre archivos de Storage al cumplirse `expires_at` — la fila
  queda con estado `listo` indefinidamente hoy.
- `AC-REP-15` — Toda solicitud de exportación queda registrada con su tipo,
  filtros y momento. Evidencia: `TEST`. Clase: `integracion`. Cierra en
  `W-14`: `tests/rls/w14-reminders-and-search.test.ts` prueba
  `create_export_job` (idempotencia y ownership); cada llamada deja fila en
  `export_jobs` con `kind`, `metadata` y `requested_at`.
- `AC-REP-16` — El motor no puede enviar una exportación a ningún destino.
  Evidencia: `CODE`. No cierra `TEST`: no existe ninguna función que envíe a
  un destino elegido por el modelo (el único mecanismo es el enlace servido
  al propio usuario), pero verificable de fondo solo cuando exista el motor
  conversacional (`W-16`/`17`).
- `AC-REP-17` — En modo discreto las proporciones siguen visibles y los montos
  no, y exportar sigue disponible. Evidencia: `TEST`. No cierra:
  `reports-screen.tsx` no invoca `useDiscreetMode` — el modo discreto no
  está conectado a esta pantalla todavía.
- `AC-REP-18` — El agregado de un periodo se resuelve en una sola consulta,
  dos con comparación. Evidencia: `CODE` + `TEST`. No cierra, y es otra
  contradicción real: `getReportPeriod` trae las filas del periodo con
  `.select()` y agrega en JavaScript (`computeReportPeriod`), no con
  `group by` en SQL. Funciona, pero no cumple el criterio de rendimiento
  tal como está escrito.
- `AC-REP-19` — Un periodo sin gastos pero con transferencias explica el
  S/0.00 en vez de mostrarlo desnudo. Evidencia: `TEST` + `USER`. No cierra:
  `reports-screen.tsx` solo distingue "sin movimientos" (`EmptyState`) de
  "con movimientos"; el caso intermedio (solo transferencias) no tiene su
  propio texto.
- `AC-REP-20` — Ninguna acción de este módulo escribe datos financieros.
  Evidencia: `CODE`. Cierra en `W-14`: las rutas de `reports`,
  `saved-reports` y `exports` son lectura, configuración de vista o
  generación de archivo — ninguna escribe en `movements`, `accounts` ni
  tablas equivalentes.

## 21. Fuera de alcance y puente a WhatsApp

**Diferido a V1.1:** exportación a PDF y XLSX, reportes programados por
correo, comparativa de más de dos periodos.

**Prohibido, no diferido:** reportes fiscales o tributarios, estados
financieros formales, gráficos decorativos, comparación con otros usuarios,
métricas configurables por el usuario, y cualquier vía por la que una
exportación salga a un destino que el usuario no eligió explícitamente.

Puente a WhatsApp: los reportes **no cruzan como reportes**. Una tabla de
quince filas en un chat es ilegible, y un gráfico enviado como imagen no es
accesible ni navegable. Lo que sí cruza es la pregunta: *"¿en qué se me fue
julio?"* se responde en conversación con las tres o cuatro cifras que
importan y un enlace a la app para el detalle. Es un caso claro de
`21_contrato_de_canal_y_presentadores.md`: el mismo dato agregado, con las
mismas referencias, presentado de forma completamente distinta.

La exportación sí cruza sin cambios: en la fase 2, "mándame mis datos"
generará el mismo enlace firmado, y **lo entregará por el canal, no por
correo a una dirección que el modelo elija** (`RUL-REP-11`, §14.4).

## 22. Trazabilidad

**Documentos de `docs/` consumidos:** ninguno como especificación.
`docs/fase_2_estrategia/alcance_v1/05c_dashboard.md` §20 se cita como
**antítesis**: excluía de V1 los gráficos, los reportes y las exportaciones
por no tener documento propio. Este es ese documento.

De `docs/fase_5_proteccion/24_privacidad_proteccion_datos.md` se hereda la
obligación de portabilidad, que aquí deja de ser una declaración legal y pasa
a ser `RUL-REP-11` con catorce bloques enumerados y seis criterios de
aceptación.

De `docs/fase_6_visual/29_design_system_ui.md` se hereda la exigencia de
contraste y de no comunicar solo por color, aplicada en `RUL-REP-07`.

**Contradicciones que cierra:** ninguna de las 17 por sí solo. Aporta la mitad
de `C-08` que corresponde a la portabilidad: `RUL-REP-11` incluye el perfil
aprendido en la exportación, de modo que "ver lo aprendido" no se queda dentro
de la aplicación. La otra mitad —ver, corregir, deshacer y olvidar dentro de
la app— la cierra el módulo 36.

**Brecha documental que cierra:**
`docs/fase_2_estrategia/alcance_v1/indice.md` no listaba ningún documento de
reportes. Era la única de las cuatro funciones que `05c` §20 excluía sin dejar
siquiera una nota de "documento propio si se decide".

**Decisiones tomadas en este documento**, registradas en
`03_decisiones_producto_web.md`:

| Decisión | ID | Alternativa descartada | Razón |
|---|---|---|---|
| El reporte no tiene aritmética propia | `WEB-D049` | Agregación optimizada e independiente | Dos números distintos para la misma pregunta destruyen la credibilidad de los dos |
| Cinco gráficos fijos, cada uno con su decisión | `WEB-D050` | Gráficos configurables por el usuario | Un panel de analítica configurable es un producto distinto, y la mayoría de sus combinaciones no responden ninguna pregunta |
| La tabla es una pestaña de igual peso, no un modo accesible | `WEB-D051` | Tabla escondida tras un icono de accesibilidad | Mucha gente la prefiere; diseñada como rampa, estaría peor hecha |
| La exportación completa es una obligación | `WEB-D052` | Tratarla como una función más | Una función se degrada bajo carga; un derecho no. Cambia disponibilidad, límites y prioridad |
| Enlace de un solo uso, 15 minutos, archivo borrado a las 24 h | `WEB-D053` | Enlace permanente en el historial | Ese archivo es la copia más completa y menos protegida que existirá de la vida financiera del usuario |
| CSV en UTF-8 con BOM | `WEB-D054` | UTF-8 sin BOM | Sin BOM, Excel destroza tildes y eñes. El coste recae en herramientas de línea de comandos, cuyo público sabe resolverlo |
| El motor no puede enviar una exportación a ningún destino | `WEB-D055` | Permitir "mándamelo por correo" | Sería una vía de salida de todos los datos del usuario gobernada por texto, y ninguna instrucción la hace segura |
| La URL lleva criterios, nunca datos; y no comparte nada | `WEB-D056` | Enlaces de reporte compartibles | Compartir un reporte exige decidir qué ve el receptor y por cuánto tiempo. Es un producto aparte, no un parámetro más |
