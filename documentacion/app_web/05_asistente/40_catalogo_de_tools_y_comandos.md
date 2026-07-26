# 40 — Catálogo de consultas y comandos

**Bloque:** 05 — Asistente
**Alcance:** V1
**Fecha:** 26 de julio de 2026
**Docs fuente:** las §14 de los dieciséis módulos (`24` a `39`). **Este documento no diseña nada: agrega.**
**Documentos que dependen de este:** `41` (asistente en la app), `42` (reutilización del código), `51` (pruebas)

---

## 1. Qué es y qué no es

Este documento es **la superficie completa que el motor puede tocar**: todo lo
que puede leer, todo lo que puede escribir, y todo lo que tiene prohibido.

No inventa capacidades. Cada línea sale de la §14 de un módulo, y ese módulo
sigue siendo su dueño: si aquí y allí discrepan, manda el módulo y esto es un
defecto de sincronización.

**Su valor está en lo que aparece al ver las dieciséis §14 juntas**, que es
justo lo que ningún módulo podía ver desde dentro. Al agregarlas salieron
siete colisiones de nombre, una de comando, tres módulos sin declarar sus
prohibiciones, cinco medidas con dos dueños y cuarenta y cuatro formas
distintas de escribir cinco niveles de confirmación. Todo eso está resuelto en
§9, y los módulos afectados se corrigieron en la misma ola.

**Qué NO es:**

- **No es una lista de funciones a implementar.** Es el contrato entre el
  motor y el dominio. La implementación de cada comando vive en el Core.
- **No se mantiene a mano.** Ver §2, que es lo que cierra `C-03`.
- **No es el catálogo de lecturas cerrado.** Las lecturas son un **vocabulario
  componible** (`WEB-D021`): las dimensiones y medidas de §5 y §6 se combinan
  libremente con filtros, agrupaciones y rangos. Lo que sí es catálogo cerrado
  son las escrituras de §7.

Esa última distinción es la más importante del documento. **Leer se compone;
escribir se enumera.** Un usuario puede preguntar algo que nadie previó y
obtener respuesta; nadie puede ejecutar una operación que no esté en §7.

## 2. Cómo se genera este documento

`C-03` era *"14 tools vs. 15 tools — documentación de capacidades
desactualizada"*: dos documentos contando cosas distintas porque los dos se
mantenían a mano.

**La solución no es contar mejor: es no contar.** Este catálogo se genera por
agregación mecánica desde las §14 de los módulos, y su corrección se verifica
en cada compilación:

```text
1. Se leen las §14.1, §14.2 y §14.4 de los dieciséis módulos de 04_modulos/.
2. Se agregan en las tablas de §5, §6, §7 y §8.
3. El test de sincronización comprueba tres cosas:
   a) toda dimensión, medida y comando de un módulo aparece aquí,
   b) todo lo que aparece aquí existe en algún módulo,
   c) el nivel de confirmación declarado coincide en los dos sitios.
4. Si alguna falla, el build falla.
```

Un catálogo que puede desincronizarse **se desincroniza**. La única forma de
que dos documentos digan siempre lo mismo es que uno se derive del otro y un
test lo compruebe.

`51_estrategia_de_pruebas_web.md` recoge ese test junto con los demás que
fallan el build.

## 3. Los seis niveles de confirmación

Las §14.2 escribían el nivel de confirmación en prosa libre, con **cuarenta y
cuatro formulaciones distintas** para lo que son seis cosas. "Tarjeta con
efecto previo", "Tarjeta con la aplicación visible" y "Tarjeta con monto
editable" son todas `tarjeta_editable` con un detalle distinto.

Taxonomía cerrada. El nivel es un enum; el detalle es texto libre que se
muestra en la tarjeta.

| Nivel | Qué exige | Se deshace |
|---|---|---|
| `ninguna` | Se ejecuta directamente | En un clic, sin ventana |
| `tarjeta` | Muestra lo que va a pasar; el usuario acepta | Sí, con acción inversa |
| `tarjeta_editable` | Igual, y **los campos se pueden corregir antes de aceptar** | Sí |
| `riesgo` | Acción de confirmación **distinta de aceptar**, nombrando el objeto | Sí, dentro de su ventana |
| `masiva` | Conteo, muestra de ejemplos, exclusiones declaradas y deshacer del lote | Sí, el lote entero |
| `consentimiento` | Autoriza algo continuo o externo; **se registra como evento de consentimiento** | Revocable en cualquier momento |

### 3.1 Qué nivel corresponde a qué comando

Regla determinista, para que nadie tenga que decidirlo por intuición:

| Si el comando… | Nivel |
|---|---|
| No toca dinero y se deshace en un clic | `ninguna` |
| Solo cambia un estado, un vínculo o una preferencia | `tarjeta` |
| Crea o modifica un movimiento, un saldo o un compromiso | `tarjeta_editable` |
| Elimina, archiva algo con saldo, cambia el tipo de un movimiento, o **mueve dinero sin que haya ocurrido una transacción real** | `riesgo` |
| Afecta a más de un elemento | `masiva`, combinado con el anterior si aplica |
| Autoriza un canal externo o un tratamiento continuo de datos | `consentimiento` |

La cuarta fila es la que importa entender: `ajustar_saldo` y `registrar_interes`
son de riesgo **no por ser difíciles de deshacer**, sino porque cambian el
dinero del usuario sin corresponder a ningún movimiento del mundo real. Son las
dos operaciones donde el sistema afirma algo que nadie observó.

`ninguna` **nunca aplica a nada que toque dinero.** Sin excepción, y es
`WEB-D013`.

## 4. Reglas del vocabulario

Las cinco salieron de las colisiones de §9. Se declaran aquí porque valen para
todo lo que se añada en el futuro.

**`RUL-CAT-01` — Toda dimensión lleva su sujeto en el nombre**

Prohibidos los nombres desnudos: `tipo`, `estado`, `origen`, `periodo`,
`frecuencia`, `conteo`. Se escriben `tipo_movimiento`, `estado_pendiente`,
`origen_recurrente`.

Resuelve seis de las siete colisiones encontradas y, más importante, **impide
que vuelvan a aparecer**. Un módulo escrito desde dentro no puede saber que
otro ya usó `origen`; con el sujeto en el nombre, no hace falta que lo sepa.

**`RUL-CAT-02` — Un nombre, un género, una grafía**

`cubierto_por_caja` y `cubierta_por_caja` no son dos dimensiones. El
identificador se escribe en masculino singular por convención, aunque su sujeto
sea femenino: `caja_vinculada_a_deuda` **no**, `caja_vinculada_a_deuda` sí
—el género que manda es el del sujeto declarado en el prefijo, y una vez
elegido no varía entre módulos.

**`RUL-CAT-03` — Cada medida tiene un solo dueño**

Si dos módulos declaran la misma cifra, uno la calcula y el otro la consume.
Nunca los dos.

Es la generalización de `WEB-D049` (el reporte no tiene aritmética propia) y
`WEB-D088` (el Inicio no calcula) a todo el vocabulario. Y la razón es la
misma: dos dueños son dos implementaciones, y dos implementaciones acaban
dando dos números.

**`RUL-CAT-04` — Una medida agrupada no es una medida nueva**

`gasto_por_categoria` es `suma` con `agrupar: categoria`. No es una medida
distinta: es un **alias**, y así se declara.

La diferencia importa porque las lecturas son componibles (`WEB-D021`).
Declarar cada combinación útil como medida propia reintroduce por la puerta de
atrás el catálogo cerrado que esa decisión eliminó: al final habría
`gasto_por_categoria`, `gasto_por_cuenta`, `gasto_por_comercio`, y el
asistente seguiría sin poder agrupar por algo que nadie anticipó.

Los alias se mantienen porque se leen mejor. Se declaran como lo que son.

**`RUL-CAT-05` — Un comando, un nombre, un dueño**

Si tres módulos necesitan vincular una caja a algo, no hay tres
`vincular_caja`: hay `vincular_caja_a_deuda`, `vincular_caja_a_compromiso` y
`vincular_caja_a_meta`, y cada uno pertenece al módulo dueño del **destino**,
no al de la caja.

Corolario de nombres: el verbo describe la operación y el sufijo describe el
objeto. `aceptar_sugerencia_recurrente`, no `confirmar_sugerencia`.

## 5. Catálogo de lecturas — dimensiones

Se combinan libremente entre sí y con las medidas de §6. La identidad del
usuario **la inyecta el compilador**; el vocabulario no puede expresarla
(`WEB-D021`).

### 5.1 Movimientos y clasificación

| Dimensión | Valores | Dueño |
|---|---|---|
| `tipo_movimiento` | Los 11 de `26` §4 | `26` |
| `estado_movimiento` | confirmado, por revisar, corregido, eliminado | `26` |
| `origen_movimiento` | manual, correo, importación, asistente, recurrente, whatsapp | `26` |
| `comercio` | Texto | `26` |
| `cuenta`, `caja` | Referencia | `26` |
| `fecha` | Rangos arbitrarios | `26` |
| `dia_semana`, `quincena`, `franja_horaria`, `semana_del_mes` | Aritmética de fechas | `26` |
| `frecuencia_comercio` | única vez, ocasional, habitual, recurrente | `26` |
| `es_primera_vez` | sí/no | `26` |
| `dias_desde_anterior_igual` | Entero | `26` |
| `desviacion_de_su_promedio` | Proporción | `26` |
| `afecta_saldo` | Derivada del tipo | `26` |
| `tiene_adjunto`, `tiene_nota` | sí/no | `26` |
| `movimiento_cubierto_por_caja` | sí/no | `24` |
| `categoria` | Las 12 + "sin clasificar" | `25` |
| `subcategoria` | Del usuario | `25` |
| `etiqueta` | Base y propias; varias por movimiento | `25` |
| `estado_clasificacion` | clasificado, por revisar | `25` |
| `origen_clasificacion` | usuario, sistema, aprendizaje | `25` |
| `admite_categoria` | Derivada de `RUL-CAT-11` | `25` |

**Regla del compilador, no del agente:** las consultas de gasto excluyen por
defecto `transferencia`, `asignacion_interna` y `ajuste`. Incluirlos exige
pedirlo. Es una decisión del dominio y por eso vive en el compilador
(`25` §14.1, `26` §14.1).

### 5.2 Dinero: cuentas, cajas y compromisos

| Dimensión | Valores | Dueño |
|---|---|---|
| `tipo_cuenta` | digital, banco, físico, tarjeta | `24` |
| `institucion` | Texto | `24` |
| `es_cuenta_default` | sí/no | `24` |
| `tiene_cajas`, `saldo_negativo` | sí/no | `24` |
| `tipo_caja` | compromiso, objetivo, emergencia | `24` |
| `caja_tiene_meta` | sí/no | `24` |
| `progreso_caja` | Proporción 0–1 sobre la meta **de la caja** | `24` |
| `caja_vinculada_a_deuda` | sí/no | `24` |
| `estado_recurrente` | sugerido, activo, pausado, cancelado | `30` |
| `frecuencia_recurrente` | Enum de frecuencias | `30` |
| `variabilidad_monto` | fijo, variable | `30` |
| `compromiso_cubierto_por_caja` | sí/no — **la que evita el doble descuento** | `30` |
| `recurrente_vinculado_a_deuda` | sí/no | `30` |
| `dias_hasta_vencimiento` | Entero | `30` |
| `estado_ocurrencia` | esperada, pagada, saltada, vencida | `30` |
| `origen_recurrente` | manual, detectado, email | `30` |

### 5.3 Deudas

| Dimensión | Valores | Dueño |
|---|---|---|
| `direccion_deuda` | debes / te deben | `31` |
| `tipo_deuda` | informal, banco, tarjeta, cuotas, préstamo | `31` |
| `estado_deuda` | activa, vence pronto, vencida, cerrada, condonada | `31` |
| `persona` | Referencia | `31` |
| `tiene_calendario` | sí/no | `31` |
| `deuda_cubierta_por_caja` | sí/no | `31` |
| `dias_hasta_proxima_cuota` | Entero | `31` |
| `progreso_pago` | Proporción pagada | `31` |
| `estado_cuota` | Los seis de `31` §5 | `31` |

### 5.4 Planificación

| Dimensión | Valores | Dueño |
|---|---|---|
| `categoria_presupuestada` | Referencia | `32` |
| `tipo_presupuesto` | presupuesto, límite, límite estricto | `32` |
| `periodo_presupuesto` | semanal, quincenal, mensual | `32` |
| `tramo_avance` | holgado, atención, cerca, superado | `32` |
| `tiene_traspaso` | sí/no | `32` |
| `origen_presupuesto` | manual, sugerido | `32` |
| `estado_meta` | activa, alcanzada, pausada | `32` |
| `meta_respaldada` | Si tiene caja vinculada | `32` |
| `horizonte` | Días hasta el fin del periodo | `33` |
| `tiene_datos_suficientes` | sí/no | `33` |
| `dispersion_gasto` | baja, media, alta | `33` |
| `componente_situacion` | cobertura, gasto/ingreso, reserva, deudas | `33` |

### 5.5 Captura y correo

| Dimensión | Valores | Dueño |
|---|---|---|
| `origen_pendiente` | correo, importación, recurrente, asistente, sistema | `27` |
| `tipo_pendiente` | Los seis de `27` §4.1 | `27` |
| `estado_pendiente` | pendiente, confirmado, descartado, ya registrado, caducado | `27` |
| `confirmable` | sí/no | `27` |
| `nivel_riesgo` | bajo, medio, alto | `27` |
| `tiene_duplicado` | sí/no | `27` |
| `antiguedad_pendiente` | Días | `27` |
| `buzon` | Cuál de los conectados | `28` |
| `remitente` | Dirección | `28` |
| `origen_fuente` | catálogo, usuario, sugerido | `28` |
| `estado_fuente` | shadow, activa, pausada, desactivada | `28` |
| `dias_sin_deteccion` | Entero | `28` |
| `origen_captura` | rápido, formulario, plantilla, duplicado | `29` |
| `plantilla_usada` | Referencia | `29` |
| `resuelto_por` | reglas, modelo, parcial | `29` |

### 5.6 Producto: lo que el sistema hace y aprende

| Dimensión | Valores | Dueño |
|---|---|---|
| `tipo_descubrimiento` | Los 17 de `RUL-DESC-01` | `34` |
| `clase_descubrimiento` | A, B, C | `34` |
| `estado_descubrimiento` | mostrado, descartado, expirado, obsoleto | `34` |
| `periodo_analizado` | Rango | `34` |
| `fue_util`, `tuvo_accion` | sí/no | `34` |
| `periodo_reporte` | semana, quincena, mes, rango | `35` |
| `agrupacion` | categoría, subcategoría, cuenta, tipo | `35` |
| `tiene_comparacion` | sí/no | `35` |
| `estado_exportacion` | pendiente, procesando, listo, expirado, fallido | `35` |
| `clase_aprendizaje` | clasificatorio, perfil, preferencia | `36` |
| `estado_aprendizaje` | confirmado, suspendido, olvidado, caducado | `36` |
| `origen_aprendizaje` | dicho, observado y confirmado | `36` |
| `capa_perfil` | estilo, vida, vínculo, hilo | `36` |
| `tiene_contradiccion` | sí/no | `36` |
| `tipo_recordatorio` | Los 10 de `RUL-REC-01` | `37` |
| `clase_recordatorio` | T, V, A, U | `37` |
| `estado_recordatorio` | abierto, leído, pospuesto, resuelto, descartado, caducado | `37` |
| `canal_entrega` | bandeja, correo | `37` |
| `fue_resuelto_solo` | sí/no | `37` |
| `coincide_texto` | Filtro de texto libre, **combinable con cualquier consulta** | `38` |
| `estado_progresivo` | vacío, temprano, funcional, completo | `39` |
| `bloques_visibles` | Contexto de pantalla | `39` |

`coincide_texto` es la más transversal del catálogo: permite *"¿cuánto llevo
en cosas que digan 'taxi'?"* combinando el filtro léxico de `38` con la
agregación de la capa semántica.

## 6. Catálogo de lecturas — medidas

### 6.1 Medidas base

| Medida | Qué calcula | Dueño |
|---|---|---|
| `suma`, `conteo`, `promedio`, `mediana`, `maximo`, `minimo`, `percentil` | Agregaciones sobre movimientos | `26` |
| `conteo_comercios_distintos` | | `26` |
| `proporcion_del_total` | | `26` |
| `sin_clasificar` | Conteo y suma pendientes de revisar | `25` |
| `saldo_total` | Suma de saldos de cuentas activas | `24` |
| `separado_total` | Suma de saldos de cajas activas | `24` |
| `libre_en_cuentas` | `RUL-CUENTAS-02` | `24` |
| `dinero_libre` | `RUL-CUENTAS-03` | `24` |
| `conteo_pendientes` | Agrupable por origen y tipo | `27` |
| `suma_propuesta` | **Nunca se presenta como gasto real** | `27` |
| `tasa_confirmacion_pendientes` | Confirmados sobre resueltos | `27` |
| `detecciones` | Conteo por fuente y periodo | `28` |
| `tasa_confirmacion_detecciones` | Confirmadas sobre creadas | `28` |
| `tasa_descarte_detecciones` | Señal de ruido | `28` |
| `uso_por_plantilla`, `tiempo_hasta_guardar` | | `29` |
| `total_comprometido` | Compromisos del periodo | `30` |
| `total_no_cubierto` | **La que entra en el dinero libre** | `30` |
| `variacion_vs_esperado` | | `30` |
| `saldo_total_debido` | | `31` |
| `saldo_total_a_favor` | **Nunca se resta del anterior sin decirlo** | `31` |
| `pagado_en_periodo`, `proximo_vencimiento` | | `31` |
| `gastado_en_presupuesto` | Con sus referencias | `32` |
| `restante` | Puede ser negativo | `32` |
| `porcentaje_avance`, `total_presupuestado` | | `32` |
| `desviacion_vs_periodo_anterior` | | `32` |
| `progreso_meta` | Saldo de la caja sobre el objetivo de la meta | `32` |
| `proyeccion_cierre` | **Con sus supuestos obligatorios** | `33` |
| `ritmo_diario` | Mediana de 14 días, sin compromisos | `33` |
| `impacto_simulado` | Efecto de un gasto hipotético | `33` |
| `descubrimientos_activos`, `tasa_de_utilidad`, `tasa_de_accion` | | `34` |
| `variacion_entre_periodos` | Absoluta y relativa | `35` |
| `movimientos_excluidos` | Cuántos y por qué | `35` |
| `aprendizajes_activos` | Por clase | `36` |
| `evidencia_positiva`, `evidencia_negativa` | Conteos, **nunca pesos** | `36` |
| `dias_desde_ultimo_uso` | | `36` |
| `recordatorios_abiertos`, `tasa_de_resolucion`, `dias_hasta_resolucion` | | `37` |

### 6.2 Alias: medidas agrupadas

No son medidas nuevas (`RUL-CAT-04`). Se conservan porque se leen mejor.

| Alias | Equivale a | Declarado en |
|---|---|---|
| `gasto_por_categoria` | `suma` + `agrupar: categoria` | `25` |
| `conteo_por_categoria` | `conteo` + `agrupar: categoria` | `25` |
| `proporcion_del_gasto` | `proporcion_del_total` + `agrupar: categoria` | `25` |
| `libre_por_cuenta` | `libre_en_cuentas` + `agrupar: cuenta` | `24` |
| `total_por_grupo` | `suma` + la agrupación pedida | `35` |

### 6.3 Reglas de presentación que viajan con la medida

Tres medidas llevan advertencia obligatoria: **si se emiten sin ella, es un
defecto**, no una decisión de estilo.

| Medida | Advertencia |
|---|---|
| `suma_propuesta` | Es dinero **no confirmado**. Presentarlo junto al gasto real sin distinguirlo viola `RUL-PEND-02` |
| `saldo_total_a_favor` | **No se resta** de `saldo_total_debido` sin decirlo. Un "neto" mezcla compromisos de naturaleza distinta |
| `proyeccion_cierre` | No se devuelve sin sus `assumptions`. Es la única familia que habla del futuro |

**Ninguna medida se devuelve sin sus referencias de evidencia** (`22` §2). No
hay excepciones y no hace falta declararlo por medida.

## 7. Catálogo de escrituras — los 95 comandos

**Esto sí es un catálogo cerrado.** Lo que no esté aquí, no se puede ejecutar.

Todos son **idempotentes** por clave, y todos pasan por el Core: el agente
propone, el usuario confirma, el Core ejecuta (`WEB-D013`).

### 7.1 Cuentas y cajas — `24`

| Comando | Nivel | Detalle de la tarjeta |
|---|---|---|
| `crear_cuenta` | `tarjeta_editable` | |
| `editar_cuenta` | `tarjeta_editable` | |
| `archivar_cuenta` | `riesgo` | Qué pasa con sus cajas |
| `ajustar_saldo` | `riesgo` | La diferencia |
| `crear_caja` | `tarjeta_editable` | |
| `editar_caja` | `tarjeta_editable` | |
| `eliminar_caja` | `riesgo` | Destino del dinero, si tiene saldo |
| `transferir` | `tarjeta_editable` | Efecto previo |
| `separar_en_caja` | `tarjeta_editable` | Efecto previo |
| `devolver_a_libre` | `tarjeta_editable` | Efecto previo |
| `mover_entre_cajas` | `tarjeta_editable` | Efecto previo |

### 7.2 Clasificación — `25`

| Comando | Nivel | Detalle |
|---|---|---|
| `clasificar_movimiento` | `tarjeta_editable` | |
| `corregir_clasificacion` | `tarjeta_editable` | |
| `crear_subcategoria` | `tarjeta` | |
| `renombrar_subcategoria` | `tarjeta` | |
| `fusionar_subcategorias` | `riesgo` + `masiva` | Conteo de afectados |
| `mover_subcategoria` | `riesgo` + `masiva` | Conteo |
| `agregar_etiqueta` / `quitar_etiqueta` | `tarjeta` | |
| `reclasificar_lote` | `masiva` | Conteo, muestra, exclusión, deshacer |

### 7.3 Movimientos — `26`

| Comando | Nivel | Detalle |
|---|---|---|
| `crear_movimiento` | `tarjeta_editable` | Lo dudoso resaltado |
| `editar_movimiento` | `tarjeta_editable` | |
| `cambiar_tipo` | `riesgo` | El efecto sobre saldos |
| `eliminar_movimiento` | `riesgo` | Nombrando el movimiento |
| `restaurar_movimiento` | `tarjeta` | |
| `duplicar_movimiento` | `tarjeta_editable` | |
| `recategorizar_lote` | `masiva` | |
| `etiquetar_lote` | `masiva` | |
| `eliminar_lote` | `masiva` + `riesgo` | |

### 7.4 Pendientes — `27`

| Comando | Nivel | Detalle |
|---|---|---|
| `confirmar_pendiente` | `tarjeta_editable` | La propuesta |
| `editar_y_confirmar` | `tarjeta_editable` | |
| `descartar_pendiente` | `tarjeta` | |
| `marcar_ya_registrado` | `tarjeta` | |
| `completar_pendiente` | `tarjeta_editable` | El campo que falta |
| `confirmar_lote` | `masiva` | Conteo, muestra, **exclusión de riesgo alto** |

### 7.5 Correo — `28`

| Comando | Nivel | Detalle |
|---|---|---|
| `añadir_fuente` | `tarjeta` | |
| `editar_remitente` | `tarjeta` | Que vuelve a shadow |
| `pausar_fuente` | `tarjeta` | |
| `aceptar_sugerencia_remitente` | `tarjeta` | |
| `iniciar_backfill` | `tarjeta` | Volumen estimado |
| `desconectar_buzon` | `riesgo` | Qué se conserva |

**El motor no puede conectar un buzón.** OAuth exige la interacción directa
del usuario con Google.

### 7.6 Captura — `29`

| Comando | Nivel |
|---|---|
| `crear_plantilla` | `tarjeta` |
| `usar_plantilla` | `tarjeta_editable` |
| `editar_plantilla` | `tarjeta` |
| `archivar_plantilla` | `tarjeta` |

El registro en sí **no es un comando de este módulo**: es `crear_movimiento`.
`29` aporta el parseo, no la escritura.

### 7.7 Recurrentes y compromisos — `30`

| Comando | Nivel | Detalle |
|---|---|---|
| `crear_recurrente` | `tarjeta_editable` | |
| `aceptar_sugerencia_recurrente` | `tarjeta` | Su evidencia |
| `marcar_pagado` | `tarjeta_editable` | **El monto que se va a registrar** |
| `saltar_periodo` | `tarjeta` | |
| `pausar_recurrente` | `tarjeta` | |
| `reactivar_recurrente` | `tarjeta` | |
| `cancelar_recurrente` | `riesgo` | |
| `actualizar_monto_esperado` | `tarjeta_editable` | |
| `vincular_caja_a_compromiso` | `tarjeta` | |

### 7.8 Deudas — `31`

| Comando | Nivel | Detalle |
|---|---|---|
| `crear_deuda` | `tarjeta_editable` | Previsualización de cuotas |
| `registrar_pago_deuda` | `tarjeta_editable` | **La aplicación a cuotas, visible** |
| `registrar_devolucion` | `tarjeta_editable` | |
| `registrar_interes` | `riesgo` | |
| `renegociar_deuda` | `riesgo` | Calendarios lado a lado |
| `cerrar_deuda` | `riesgo` | Pagada o condonada: las dos opciones |
| `reabrir_deuda` | `tarjeta` | |
| `vincular_caja_a_deuda` | `tarjeta` | |
| `reprogramar_cuota` / `saltar_cuota` | `tarjeta` | |
| `crear_persona` | `tarjeta` | |

### 7.9 Presupuestos y metas — `32`

| Comando | Nivel | Detalle |
|---|---|---|
| `crear_presupuesto` | `tarjeta_editable` | Monto sugerido precargado |
| `editar_presupuesto` | `tarjeta_editable` | |
| `ajustar_presupuesto` | `tarjeta_editable` | |
| `pausar_presupuesto` / `archivar_presupuesto` | `tarjeta` | |
| `copiar_presupuestos_periodo_anterior` | `masiva` | Conteo y muestra |
| `aceptar_sugerencia_presupuesto` | `tarjeta` | Su evidencia |
| `crear_meta` | `tarjeta_editable` | |
| `vincular_caja_a_meta` | `tarjeta` | |
| `aportar_a_meta` | `tarjeta_editable` | Efecto sobre el dinero libre |
| `activar_renovacion` / `desactivar_renovacion` | `tarjeta` | |

### 7.10 Proyecciones — `33`

**Ninguno.** Único módulo del corpus sin comandos, y es deliberado: proyectar
nunca debe poder cambiar nada (`WEB-D038`). Registrar el gasto simulado es
`crear_movimiento`.

### 7.11 Descubrimientos — `34`

| Comando | Nivel |
|---|---|
| `descartar_descubrimiento` | `ninguna` |
| `marcar_descubrimiento` | `ninguna` |
| `silenciar_tipo_descubrimiento` | `tarjeta` |

**Ningún comando genera descubrimientos.**

### 7.12 Reportes y exportación — `35`

| Comando | Nivel | Detalle |
|---|---|---|
| `guardar_vista_reporte` | `ninguna` | |
| `eliminar_vista_reporte` | `tarjeta` | |
| `exportar_movimientos` | `tarjeta` | Conteo y filtros |
| `exportar_datos_completos` | `tarjeta` | **La lista de lo que incluye** |

**El motor no puede enviar una exportación a ningún destino** (`WEB-D055`).

### 7.13 Memoria — `36`

| Comando | Nivel | Detalle |
|---|---|---|
| `confirmar_hecho_perfil` | `ninguna` | El usuario acaba de decirlo |
| `corregir_aprendizaje` | `tarjeta` | Lo anterior y lo nuevo |
| `olvidar_aprendizaje` | `tarjeta` | **Qué se conserva** |
| `no_preguntar_mas` | `ninguna` | |
| `reactivar_aprendizaje` | `ninguna` | |

**`olvidar_todo` no está en el catálogo** (`WEB-D065`).

### 7.14 Recordatorios — `37`

| Comando | Nivel | Detalle |
|---|---|---|
| `posponer_recordatorio` | `ninguna` | |
| `descartar_recordatorio` | `ninguna` | |
| `silenciar_tipo_recordatorio` | `tarjeta` | |
| `cambiar_horario_silencioso` | `tarjeta` | El horario resultante |
| `pausar_recordatorios` | `tarjeta` | Fecha de reanudación |
| `activar_correo_recordatorios` | `consentimiento` | Tipo, frecuencia máxima, cómo apagarlo |

### 7.15 Búsqueda — `38`

| Comando | Nivel |
|---|---|
| `guardar_busqueda` | `ninguna` |
| `eliminar_busqueda_guardada` | `tarjeta` |

### 7.16 Inicio — `39`

| Comando | Nivel |
|---|---|
| `ocultar_bloque_inicio` | `ninguna` |
| `mostrar_bloque_inicio` | `ninguna` |
| `posponer_siguiente` | `ninguna` |

### 7.17 Reparto por nivel

| Nivel | Comandos |
|---|---|
| `ninguna` | 13 |
| `tarjeta` | 39 |
| `tarjeta_editable` | 26 |
| `riesgo` | 12 |
| `masiva` | 8 (4 combinados con `riesgo`) |
| `consentimiento` | 1 |

Trece comandos con `ninguna` y **ninguno de ellos toca dinero**: son
descartes, marcas, preferencias y confirmaciones de algo que el usuario acaba
de decir. Que la lista de `ninguna` no contenga nada financiero es
verificable, y es `AC-CAT-04`.

## 8. Lo que el motor NO puede hacer — agregado

Agregación de las §14.4. **Esta lista es tan vinculante como la de
capacidades**, y en algunos módulos más importante que ella.

### 8.1 Prohibiciones transversales

Los cuatro límites duros de `22` §8, que valen en todos los módulos:

1. **Ningún consejo financiero.** No se recomienda gastar menos, ahorrar más,
   pagar una deuda antes que otra, ni ningún producto financiero, banco o
   inversión.
2. **Ninguna cifra sin evidencia.** Si no se puede sustentar, no se emite.
3. **Ninguna escritura sin confirmación explícita.**
4. **Ninguna comparación con otros usuarios** ni con promedios de mercado.

Y tres más que salen de la agregación:

5. **Ninguna confianza, peso, score ni ranking visible**, en superficie o en
   respuesta de API (`WEB-D046`, `WEB-D074`, `C-11`).
6. **Ninguna conclusión sobre terceros.** Las personas relacionadas de `31` y
   lo que el usuario cuenta de otros se guardan; no se procesan para deducir.
7. **Ningún mensaje dirigido a un tercero**, por ningún canal.

### 8.2 Prohibiciones por módulo

| Módulo | El motor no puede |
|---|---|
| `24` | Editar `current_balance` directamente. Archivar una cuenta sin riesgo. Crear cuentas en moneda distinta de PEN |
| `25` | Reclasificar en lote sin previsualización ni exclusiones |
| `26` | Escribir `affects_*`, `status` o `confidence`. Crear movimientos con fecha futura. Eliminar sin riesgo. Ejecutar un lote sin previsualización |
| `27` | Confirmar sin mostrar la propuesta. Confirmar en lote incluyendo riesgo alto. Crear un pendiente confirmable sin `confirm_command` — **la base lo impide**. Presentar `suma_propuesta` como gasto real |
| `28` | Conectar un buzón (OAuth exige al usuario). Leer el cuerpo de un correo para sugerir un remitente — solo metadatos |
| `29` | Escalar al asistente un registro rápido que no se resolvió; se abre el formulario |
| `30` | Activar una sugerencia sin confirmación. Marcar pagado sin mostrar el monto. Poner `requires_confirmation_for_payment` en false |
| `31` | **Recomendar qué deuda pagar primero.** Cerrar una deuda sin resolver si fue pagada o condonada. Registrar un sobrepago. Generar mensajes a terceros |
| `32` | **Recomendar reducir un gasto.** Crear un presupuesto sin confirmación. Presentar el avance como logro o fracaso |
| `33` | **Emitir veredicto** sobre si puede permitirse algo. Recomendar nada. Proyectar ingresos no declarados. Dar una proyección sin supuestos. Juzgar a la persona |
| `34` | Inventar un descubrimiento. Cambiar una cifra al narrarlo. Convertirlo en consejo al reformularlo |
| `35` | Interpretar el reporte. **Enviar una exportación a ningún destino.** Cambiar el formato del CSV |
| `36` | Dar por cierto un hecho de perfil sin confirmar. Borrar toda la memoria. **Inferir atributos protegidos**, ni siquiera para no guardarlos |
| `37` | Crear un recordatorio. Resolver uno sin que la causa se resuelva. Saltarse el horario silencioso ni los límites |
| `38` | Mostrar relevancia o puntuación — **el campo no existe**. Buscar en correos: no se almacenan |
| `39` | Cambiar la precedencia de `RUL-HOME-03`. Inventar una "siguiente cosa que hacer" |

La prohibición de `36` merece leerse dos veces: **la prohibición es sobre la
inferencia, no sobre el almacenamiento.** Un patrón de gasto puede
correlacionar con un atributo protegido, y la correlación no es permiso.

## 9. Colisiones y huecos encontrados

Esta sección es el trabajo real del documento. Nada de lo que sigue era
visible desde dentro de un módulo.

### 9.1 Siete colisiones de nombre

| Nombre | Módulos | Resolución |
|---|---|---|
| `origen` | `26` `27` `30` `32` | `origen_movimiento`, `origen_pendiente`, `origen_recurrente`, `origen_presupuesto` |
| `estado` | `26` `27` | `estado_movimiento`, `estado_pendiente` |
| `tipo` | `26` `27` | `tipo_movimiento`, `tipo_pendiente` |
| `cubierto_por_caja` | `24` `30` | Son sujetos distintos: `movimiento_cubierto_por_caja`, `compromiso_cubierto_por_caja` |
| `tasa_confirmacion` | `27` `28` | Denominadores distintos: `tasa_confirmacion_pendientes`, `tasa_confirmacion_detecciones` |
| `progreso_meta` | `24` `32` | Cosas distintas: `progreso_caja` (sobre la meta de la caja) y `progreso_meta` (sobre el objetivo de la meta) |
| `institucion` | `24` `28` | **No es colisión**: mismo concepto. Dueño `24`; `28` la consume |

Las cuatro primeras son el mismo defecto: un módulo escrito desde dentro no
puede saber qué nombres usó otro. `RUL-CAT-01` lo previene de forma
estructural.

### 9.2 Tres variantes de grafía

| Variantes | Resolución |
|---|---|
| `cubierto_por_caja` / `cubierta_por_caja` | Renombradas por sujeto (arriba) |
| `vinculada_a_deuda` / `vinculado_a_deuda` | `caja_vinculada_a_deuda`, `recurrente_vinculado_a_deuda` |
| `confirmar_sugerencia` / `aceptar_sugerencia` / `aceptar_sugerencia_presupuesto` | `aceptar_sugerencia_*`, con sufijo siempre |

### 9.3 Una colisión de comando

`vincular_caja` estaba declarado en `24`, `30` y `31` con el mismo nombre y
tres destinos distintos. Resuelto con `RUL-CAT-05`:

| Antes | Ahora | Dueño |
|---|---|---|
| `vincular_caja` (`24`) | Eliminado: su destino era una deuda, y ese comando es de `31` | — |
| `vincular_caja` (`30`) | `vincular_caja_a_compromiso` | `30` |
| `vincular_caja` (`31`) | `vincular_caja_a_deuda` | `31` |
| `vincular_meta_caja` (`32`) | `vincular_caja_a_meta` | `32` |

El dueño es el módulo del **destino**, no el de la caja. Vincular es una
propiedad de lo que se vincula.

### 9.4 Cinco medidas con dos dueños

| Medida | Dueños | Resolución |
|---|---|---|
| `compromisos_restantes` (`33`) | Duplica `total_no_cubierto` (`30`) | Eliminada de `33`, que la consume |
| `gasto_por_categoria` (`25`) | Es `suma` (`26`) agrupada | Alias (`RUL-CAT-04`) |
| `conteo_por_categoria` (`25`) | Es `conteo` (`26`) agrupada | Alias |
| `proporcion_del_gasto` (`25`) | Es `proporcion_del_total` (`26`) agrupada | Alias |
| `total_por_grupo` (`35`) | Es `suma` agrupada | Alias |

La primera es la grave y es del mismo tipo que el doble descuento que la
auditoría encontró en `RUL-PROY-02`: **el módulo 33 volvía a declarar como
suya una cifra que ya calculaba el 30.** Dos dueños son dos implementaciones,
y dos implementaciones acaban dando dos números.

### 9.5 Tres módulos sin declarar sus prohibiciones

`25`, `28` y `29` no tenían §14.4. La plantilla de `01` §8 la exige.

**No es un olvido de formato:** un módulo que no declara qué no puede hacer el
motor está delegando esa decisión en quien implemente. Se añadieron las tres
en esta misma ola, y aparecen en §8.2.

### 9.6 Cuarenta y cuatro formas de decir seis cosas

El nivel de confirmación se escribía en prosa libre. `§3` lo cierra en un enum
de seis valores más un campo de detalle.

Sin el enum, el test de sincronización de §2 no se puede escribir: no se puede
comparar "Tarjeta con efecto previo" con "Tarjeta con monto editable" y saber
si son el mismo nivel.

## 10. Verificación

- `AC-CAT-01` — Toda dimensión, medida y comando declarado en la §14 de un
  módulo aparece en este catálogo, y viceversa. El build falla si no.
  Evidencia: `TEST`.
- `AC-CAT-02` — El nivel de confirmación de cada comando coincide entre el
  módulo y este documento. Evidencia: `TEST`.
- `AC-CAT-03` — No existen dos dimensiones ni dos medidas con el mismo nombre
  y distinto dueño. Evidencia: `TEST`.
- `AC-CAT-04` — **Ningún comando de nivel `ninguna` toca dinero.**
  Evidencia: `CODE` + `TEST`.
- `AC-CAT-05` — Ningún comando de nivel `riesgo` se puede ejecutar con la
  misma acción que uno de nivel `tarjeta`. Evidencia: `TEST`.
- `AC-CAT-06` — Todo comando es idempotente por clave. Evidencia: `TEST`.
- `AC-CAT-07` — Ninguna medida se devuelve sin sus referencias de evidencia.
  Evidencia: `TEST`.
- `AC-CAT-08` — `suma_propuesta`, `saldo_total_a_favor` y `proyeccion_cierre`
  no se emiten sin su advertencia. Evidencia: `TEST`.
- `AC-CAT-09` — Cada módulo declara su §14.4, y sus prohibiciones aparecen en
  §8.2. Evidencia: `TEST`.
- `AC-CAT-10` — Ningún comando fuera de este catálogo se puede ejecutar. El
  ejecutor rechaza lo desconocido en vez de intentarlo. Evidencia: `TEST`.

`AC-CAT-10` es el que convierte "catálogo cerrado" de una afirmación en una
propiedad: la lista blanca vive en el ejecutor, no en el prompt.

## 11. Trazabilidad

**Documentos consumidos:** las §14.1, §14.2, §14.3 y §14.4 de
`24_modulo_cuentas_y_cajas.md` a `39_modulo_home_resumen_financiero.md`.

**Contradicción que cierra:**

`C-03` — *"14 tools vs. 15 tools — documentación de capacidades
desactualizada."* Se cierra cambiando el método, no el número: el catálogo se
genera por agregación y un test falla el build si se desincroniza (§2,
`AC-CAT-01`). Contar bien una vez no habría servido de nada; el defecto era
mantener dos listas a mano.

El número real, verificado contando las §14 de los dieciséis módulos: **95
comandos y 145 entradas de lectura** entre dimensiones, medidas y alias. No 14
ni 15. La cifra antigua contaba "tools" de una arquitectura de agentes
distinta, y ese es justo el problema: dos documentos contaban cosas que ni
siquiera eran lo mismo.

**Correcciones aplicadas a los módulos en esta ola:** renombrados de §9.1 a
§9.3 en `24`, `26`, `27`, `28`, `30`, `31`, `32`; medida eliminada en `33`;
alias declarados en `24`, `25`, `35`; comando eliminado en `24` y renombrados
en `30`, `31`, `32`; §14.4 añadida a `25`, `28` y `29`.

**Decisiones tomadas en este documento**, registradas en
`03_decisiones_producto_web.md`:

| Decisión | ID | Alternativa descartada | Razón |
|---|---|---|---|
| El catálogo se genera, no se mantiene | `WEB-D089` | Mantenerlo a mano con cuidado | Un catálogo que puede desincronizarse se desincroniza. `C-03` nació así |
| Seis niveles de confirmación en enum cerrado | `WEB-D090` | Seguir describiéndolo en prosa | Cuarenta y cuatro formulaciones para seis cosas hacían imposible el test de sincronización |
| Toda dimensión lleva su sujeto en el nombre | `WEB-D091` | Resolver las colisiones una a una | Resolverlas no impide que vuelvan: un módulo escrito desde dentro no puede saber qué nombres usó otro |
| Cada medida tiene un solo dueño | `WEB-D092` | Permitir que dos módulos declaren la misma cifra | Generaliza `WEB-D049` y `WEB-D088` a todo el vocabulario. Dos dueños son dos implementaciones y acaban dando dos números |
| Una medida agrupada es un alias, no una medida | `WEB-D093` | Declarar cada combinación útil | Declararlas reintroduce el catálogo cerrado que `WEB-D021` eliminó, por la puerta de atrás |
| La lista blanca de comandos vive en el ejecutor | `WEB-D094` | Confiar en que el modelo solo pida lo que existe | "Catálogo cerrado" solo es cierto si algo rechaza lo desconocido en vez de intentarlo |
