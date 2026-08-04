# Material de apoyo para W-20 — checklist de criterios G3

Generado el 2026-08-04T08:48:24.649Z con `npm run matriz:listar-g3`.

`W-20` no construye (`54` §7.2): este listado no cierra ningún criterio, es el material para correr el protocolo `USER` (`49` §8, tres personas, tarea sin ayuda, tres de tres) y abrir las series `METRIC` (`49` §9, objetivo declarado antes de mirar). El registro real va en `55_ledger_construccion_web.md`, con el ID de cada criterio.

**Total: 135 criterios G3** — 117 con `USER`, 19 con `METRIC`.

## Cómo registrar un resultado

**`USER`** (`49` §8, `WEB-D149`): tres personas, ninguna autora del documento ni de la implementación, hacen la tarea **sin guía verbal** y sin que se les diga dónde está el control. Cierra cuando **las tres** completan la tarea — dos de tres no cierra: se corrige y se repite. Se registra en `55_ledger_construccion_web.md`: fecha, qué se pidió, qué hizo cada persona, dónde se atascó, y el veredicto por persona.

**`METRIC`** (`49` §9, `WEB-D150`): la serie, el objetivo declarado **antes** de mirar el dato, y la decisión tomada — los tres, no dos. Un `METRIC` no bloquea el lanzamiento; bloquea la afirmación de que el producto funciona.

Ninguno de los dos protocolos lo puede cerrar quien escribió el código (`RUL-HECHO-05`): la evidencia la produce quien observa a la persona real, no quien implementó el criterio.

## W-01 (1)

| Criterio | Protocolo | Enunciado | Documento |
|---|---|---|---|
| `AC-TESIS-04` | `USER` | Un usuario nuevo real obtiene una respuesta útil sobre su dinero en su primera sesión. | `documentacion/app_web/01_producto/06_tesis_app_web.md` |

## W-02 (1)

| Criterio | Protocolo | Enunciado | Documento |
|---|---|---|---|
| `AC-DATOS-11` | `METRIC` | El panorama completo de un usuario se arma por debajo de su presupuesto de tokens sin importar los años de uso. | `documentacion/app_web/02_fundaciones/13_modelo_datos_web_v1.md` |

## W-03 (1)

| Criterio | Protocolo | Enunciado | Documento |
|---|---|---|---|
| `AC-PRUEBA-14` | `METRIC` | Los módulos `37` y `46` tienen ventana de observación con umbral declarado antes de mirarla. | `documentacion/app_web/07_calidad_y_ejecucion/51_estrategia_de_pruebas_web.md` |

## W-04 (1)

| Criterio | Protocolo | Enunciado | Documento |
|---|---|---|---|
| `AC-CANAL-06` | `USER` | Una `impresion` se distingue visualmente de una `afirmacion`. | `documentacion/app_web/03_motor_ia/21_contrato_de_canal_y_presentadores.md` |

## W-06 (3)

| Criterio | Protocolo | Enunciado | Documento |
|---|---|---|---|
| `AC-A11Y-04` | `USER` | Ningún estado se comunica solo por color. | `documentacion/app_web/02_fundaciones/18_accesibilidad_i18n_y_formatos.md` |
| `AC-A11Y-06` | `USER` | Los montos se anuncian con moneda y signo. | `documentacion/app_web/02_fundaciones/18_accesibilidad_i18n_y_formatos.md` |
| `AC-DS-08` | `USER` | Ningún estado se comunica únicamente por color. | `documentacion/app_web/02_fundaciones/16_design_system_web.md` |

## W-07 (8)

| Criterio | Protocolo | Enunciado | Documento |
|---|---|---|---|
| `AC-CONFIANZA-01` | `USER` | Todo dato financiero visible puede responder fuente, estado e impacto desde su propio detalle. | `documentacion/app_web/01_producto/11_confianza_errores_y_reversibilidad.md` |
| `AC-CONFIANZA-06` | `USER` | Ante un fallo transitorio, la app nunca muestra una pantalla vacía si existían datos previos. | `documentacion/app_web/01_producto/11_confianza_errores_y_reversibilidad.md` |
| `AC-EXP-01` | `USER` | Toda cifra financiera visible tiene una vía de explicación accesible desde la propia pantalla. | `documentacion/app_web/01_producto/08_principios_experiencia_web.md` |
| `AC-EXP-03` | `USER` | Toda superficie de memoria ofrece ver, corregir, deshacer y olvidar. | `documentacion/app_web/01_producto/08_principios_experiencia_web.md` |
| `AC-EXP-04` | `USER` | Ningún copy visible culpa al usuario ni usa lenguaje de fracaso ante presupuestos superados, deudas o inactividad. | `documentacion/app_web/01_producto/08_principios_experiencia_web.md` |
| `AC-NAV-06` | `USER` | El menú "Más" en móvil expone todas las secciones que no están en la barra inferior. | `documentacion/app_web/01_producto/10_sitemap_rutas_y_navegacion.md` |
| `AC-PAT-05` | `USER` | "Vacío" y "sin resultados" son estados distintos con mensajes y acciones distintos. | `documentacion/app_web/02_fundaciones/17_patrones_datos_formularios_y_listados.md` |
| `AC-PAT-08` | `USER` | Los 11 tipos de movimiento se guardan desde el propio formulario. | `documentacion/app_web/02_fundaciones/17_patrones_datos_formularios_y_listados.md` |

## W-08 (8)

| Criterio | Protocolo | Enunciado | Documento |
|---|---|---|---|
| `AC-CAT-01` | `USER` | `sin clasificar` y `otros` son estados distintos en datos y en interfaz. | `documentacion/app_web/04_modulos/25_modulo_categorias_subcategorias_y_etiquetas.md` |
| `AC-CAT-08` | `USER` | Una reclasificación masiva muestra conteo real y muestra antes de ejecutar, y se puede deshacer entera. | `documentacion/app_web/04_modulos/25_modulo_categorias_subcategorias_y_etiquetas.md` |
| `AC-CAT-10` | `USER` | El usuario puede ver por qué se clasificó algo, con evidencia concreta y sin jerga. | `documentacion/app_web/04_modulos/25_modulo_categorias_subcategorias_y_etiquetas.md` |
| `AC-CUENTAS-04` | `USER` | Sin cuentas, no se muestra "Dinero libre: S/0.00". | `documentacion/app_web/04_modulos/24_modulo_cuentas_y_cajas.md` |
| `AC-CUENTAS-05` | `USER` | El desglose de las cuatro capas está accesible desde donde se muestre el dinero libre. | `documentacion/app_web/04_modulos/24_modulo_cuentas_y_cajas.md` |
| `AC-CUENTAS-18` | `USER` | El asistente puede ejecutar los 12 comandos de §14.2 con confirmación. | `documentacion/app_web/04_modulos/24_modulo_cuentas_y_cajas.md` |
| `AC-DINERO-04` | `USER` | El dinero total nunca se presenta como la cifra principal de una pantalla de resumen. | `documentacion/app_web/01_producto/09_modelo_mental_dinero.md` |
| `AC-DINERO-06` | `USER` | El desglose completo de las cuatro capas está disponible desde cualquier lugar donde se muestre el dinero libre. | `documentacion/app_web/01_producto/09_modelo_mental_dinero.md` |

## W-09 (5)

| Criterio | Protocolo | Enunciado | Documento |
|---|---|---|---|
| `AC-MOV-01` | `USER` | Los 11 tipos se guardan desde `/movimientos/nuevo` sin redirigir a otra pantalla. | `documentacion/app_web/04_modulos/26_modulo_movimientos.md` |
| `AC-MOV-09` | `USER` | Un duplicado probable se advierte antes de guardar y ofrece las dos salidas. | `documentacion/app_web/04_modulos/26_modulo_movimientos.md` |
| `AC-MOV-11` | `USER` | Cambiar el tipo muestra el efecto sobre saldos antes de confirmar. | `documentacion/app_web/04_modulos/26_modulo_movimientos.md` |
| `AC-MOV-14` | `USER` | "Vacío" y "sin resultados" son estados distintos. | `documentacion/app_web/04_modulos/26_modulo_movimientos.md` |
| `AC-MOV-16` | `USER` | El detalle explica el impacto del movimiento en lenguaje del usuario. | `documentacion/app_web/04_modulos/26_modulo_movimientos.md` |

## W-10 (14)

| Criterio | Protocolo | Enunciado | Documento |
|---|---|---|---|
| `AC-CAP-01` | `USER+METRIC` | Un registro rápido típico se completa en menos de 10 segundos. | `documentacion/app_web/04_modulos/29_modulo_captura_sin_friccion.md` |
| `AC-CAP-04` | `USER` | Un campo no determinado queda vacío o marcado como supuesto, con su razón visible. Nunca se inventa. | `documentacion/app_web/04_modulos/29_modulo_captura_sin_friccion.md` |
| `AC-EMAIL-03` | `USER` | Un usuario puede conectar varios buzones y vigilar la misma institución en más de uno. | `documentacion/app_web/04_modulos/28_modulo_email_y_deteccion_bancaria.md` |
| `AC-EMAIL-05` | `USER` | La sugerencia de remitente usa solo metadatos y lo declara al usuario. | `documentacion/app_web/04_modulos/28_modulo_email_y_deteccion_bancaria.md` |
| `AC-EMAIL-10` | `USER` | El backfill es opcional, se ofrece al conectar y también después, y se puede cancelar. | `documentacion/app_web/04_modulos/28_modulo_email_y_deteccion_bancaria.md` |
| `AC-EMAIL-11` | `USER` | Los pendientes de backfill se agrupan por mes y no generan avisos. | `documentacion/app_web/04_modulos/28_modulo_email_y_deteccion_bancaria.md` |
| `AC-EMAIL-15` | `USER` | El consentimiento de IA es separado del de Gmail y revocable. | `documentacion/app_web/04_modulos/28_modulo_email_y_deteccion_bancaria.md` |
| `AC-EMAIL-16` | `USER` | El contexto aportado al confirmar alimenta la memoria y es visible y borrable desde ella. | `documentacion/app_web/04_modulos/28_modulo_email_y_deteccion_bancaria.md` |
| `AC-PEND-04` | `USER` | En búsqueda, los pendientes aparecen separados y marcados, nunca mezclados con confirmados. | `documentacion/app_web/04_modulos/27_modulo_pendientes_y_confirmaciones.md` |
| `AC-PEND-07` | `USER` | El duplicado se advierte antes de las acciones de confirmación, también en el orden de lectura. | `documentacion/app_web/04_modulos/27_modulo_pendientes_y_confirmaciones.md` |
| `AC-PEND-09` | `USER` | Con más de 10 pendientes se agrupan por origen y similitud. | `documentacion/app_web/04_modulos/27_modulo_pendientes_y_confirmaciones.md` |
| `AC-PEND-13` | `USER` | La bandeja vacía se presenta como estado bueno, no como fracaso. | `documentacion/app_web/04_modulos/27_modulo_pendientes_y_confirmaciones.md` |
| `AC-PEND-15` | `USER` | Un pendiente no confirmable comunica por texto qué le falta. | `documentacion/app_web/04_modulos/27_modulo_pendientes_y_confirmaciones.md` |
| `AC-PEND-16` | `USER` | La suma de pendientes nunca se presenta junto al gasto real sin distinguirse. | `documentacion/app_web/04_modulos/27_modulo_pendientes_y_confirmaciones.md` |

## W-11 (8)

| Criterio | Protocolo | Enunciado | Documento |
|---|---|---|---|
| `AC-DEUDAS-03` | `USER` | Un sobrepago se rechaza ofreciendo las dos salidas. | `documentacion/app_web/04_modulos/31_modulo_deudas.md` |
| `AC-DEUDAS-05` | `USER` | Cerrar con saldo exige elegir entre pagada y condonada. | `documentacion/app_web/04_modulos/31_modulo_deudas.md` |
| `AC-DEUDAS-06` | `USER` | El usuario ve cómo se aplicará el pago antes de confirmar. | `documentacion/app_web/04_modulos/31_modulo_deudas.md` |
| `AC-DEUDAS-11` | `USER` | El motor no recomienda qué deuda pagar primero. | `documentacion/app_web/04_modulos/31_modulo_deudas.md` |
| `AC-DEUDAS-16` | `USER` | El saldo debido y el saldo a favor no se presentan restados sin decirlo. | `documentacion/app_web/04_modulos/31_modulo_deudas.md` |
| `AC-REC-06` | `USER` | Un cambio de monto se muestra explícitamente y nunca se actualiza el esperado en silencio. | `documentacion/app_web/04_modulos/30_modulo_recurrentes_y_pagos_que_vienen.md` |
| `AC-REC-08` | `USER` | La regla de "vencido" vs "pendiente" se aplica según `RUL-REC-10`. | `documentacion/app_web/04_modulos/30_modulo_recurrentes_y_pagos_que_vienen.md` |
| `AC-REC-10` | `USER` | Una sugerencia muestra su evidencia concreta, nunca un porcentaje. | `documentacion/app_web/04_modulos/30_modulo_recurrentes_y_pagos_que_vienen.md` |

## W-12 (11)

| Criterio | Protocolo | Enunciado | Documento |
|---|---|---|---|
| `AC-PRES-06` | `USER` | Ningún copy usa las palabras prohibidas de §3 ni presenta el superado como fracaso. | `documentacion/app_web/04_modulos/32_modulo_presupuestos_metas_y_limites.md` |
| `AC-PRES-07` | `USER` | "Ajustar el presupuesto" aparece con la misma jerarquía que las demás salidas al superar. | `documentacion/app_web/04_modulos/32_modulo_presupuestos_metas_y_limites.md` |
| `AC-PRES-08` | `USER` | La sugerencia usa la mediana de al menos 2 periodos y muestra su evidencia. | `documentacion/app_web/04_modulos/32_modulo_presupuestos_metas_y_limites.md` |
| `AC-PRES-11` | `USER` | Una meta sin caja no muestra barra de progreso. | `documentacion/app_web/04_modulos/32_modulo_presupuestos_metas_y_limites.md` |
| `AC-PRES-12` | `USER` | El ritmo necesario de una meta se presenta como dato, nunca como exigencia. | `documentacion/app_web/04_modulos/32_modulo_presupuestos_metas_y_limites.md` |
| `AC-PRES-13` | `USER` | El motor no recomienda reducir gastos. | `documentacion/app_web/04_modulos/32_modulo_presupuestos_metas_y_limites.md` |
| `AC-PROY-01` | `USER` | Ninguna proyección se emite sin declarar sus supuestos en el mismo bloque visual. | `documentacion/app_web/04_modulos/33_modulo_proyecciones_y_simulacion.md` |
| `AC-PROY-05` | `USER` | Con menos de 7 días de movimientos no se proyecta y se dice por qué. | `documentacion/app_web/04_modulos/33_modulo_proyecciones_y_simulacion.md` |
| `AC-PROY-06` | `USER` | La respuesta a "¿puedo permitirme X?" no contiene veredicto. | `documentacion/app_web/04_modulos/33_modulo_proyecciones_y_simulacion.md` |
| `AC-PROY-12` | `USER` | El detalle desglosa la aritmética línea por línea con referencias navegables. | `documentacion/app_web/04_modulos/33_modulo_proyecciones_y_simulacion.md` |
| `AC-PROY-17` | `USER` | Un dinero libre negativo se proyecta sin dramatizar. | `documentacion/app_web/04_modulos/33_modulo_proyecciones_y_simulacion.md` |

## W-13 (7)

| Criterio | Protocolo | Enunciado | Documento |
|---|---|---|---|
| `AC-DESC-07` | `USER` | Ningún texto de descubrimiento contiene las palabras prohibidas de §3 ni un consejo sobre qué hacer con el dinero. | `documentacion/app_web/04_modulos/34_modulo_descubrimientos_e_insights.md` |
| `AC-DESC-08` | `USER` | Corregir un movimiento que sostiene un descubrimiento mostrado lo pasa a `outdated` y muestra que cambió, sin corregir en silencio. | `documentacion/app_web/04_modulos/34_modulo_descubrimientos_e_insights.md` |
| `AC-DESC-13` | `METRIC` | Al menos 1 de cada 3 mostrados es de clase C cuando hay material. | `documentacion/app_web/04_modulos/34_modulo_descubrimientos_e_insights.md` |
| `AC-DESC-16` | `USER` | El detalle muestra qué se contó y qué no se contó. | `documentacion/app_web/04_modulos/34_modulo_descubrimientos_e_insights.md` |
| `AC-DESC-20` | `METRIC` | La mediana de días hasta el primer descubrimiento de clase A es menor que 1. | `documentacion/app_web/04_modulos/34_modulo_descubrimientos_e_insights.md` |
| `AC-MEM-01` | `USER` | Todo aprendizaje activo de las tres clases es alcanzable desde `/configuracion/memoria`. | `documentacion/app_web/04_modulos/36_modulo_memoria_y_aprendizaje.md` |
| `AC-MEM-02` | `USER` | Las cuatro acciones —ver, corregir, deshacer, olvidar— existen y funcionan sobre cualquier aprendizaje. Cierra `C-08`. | `documentacion/app_web/04_modulos/36_modulo_memoria_y_aprendizaje.md` |

## W-14 (4)

| Criterio | Protocolo | Enunciado | Documento |
|---|---|---|---|
| `AC-BUS-06` | `USER` | Los filtros reconocidos se muestran como etiquetas quitables. | `documentacion/app_web/04_modulos/38_modulo_busqueda_y_navegacion_rapida.md` |
| `AC-BUS-14` | `METRIC` | `GET /search/palette` responde por debajo de 150 ms con 5.000 movimientos. | `documentacion/app_web/04_modulos/38_modulo_busqueda_y_navegacion_rapida.md` |
| `AC-REP-04` | `USER` | Ninguna serie se distingue solo por color, y ningún eje de dinero empieza fuera de cero. | `documentacion/app_web/04_modulos/35_modulo_reportes_graficos_y_exportacion.md` |
| `AC-REP-19` | `USER` | Un periodo sin gastos pero con transferencias explica el S/0.00 en vez de mostrarlo desnudo. | `documentacion/app_web/04_modulos/35_modulo_reportes_graficos_y_exportacion.md` |

## W-15 (7)

| Criterio | Protocolo | Enunciado | Documento |
|---|---|---|---|
| `AC-HOME-02` | `USER` | Nunca se muestra `S/0.00` como dinero libre cuando no se puede calcular; se dice qué falta. | `documentacion/app_web/04_modulos/39_modulo_home_resumen_financiero.md` |
| `AC-HOME-03` | `USER` | El dinero libre nunca aparece sin su composición. | `documentacion/app_web/04_modulos/39_modulo_home_resumen_financiero.md` |
| `AC-HOME-07` | `USER` | Ninguna "siguiente cosa que hacer" es una acción de uso del producto. | `documentacion/app_web/04_modulos/39_modulo_home_resumen_financiero.md` |
| `AC-HOME-08` | `USER` | Registrar un movimiento está a un clic en los cuatro estados progresivos y en los dos tamaños de pantalla. | `documentacion/app_web/04_modulos/39_modulo_home_resumen_financiero.md` |
| `AC-HOME-13` | `METRIC` | La primera cifra visible aparece por debajo de 800 ms. | `documentacion/app_web/04_modulos/39_modulo_home_resumen_financiero.md` |
| `AC-HOME-15` | `USER` | El estado vacío no ofrece ningún canal externo y ofrece tres puertas propias. | `documentacion/app_web/04_modulos/39_modulo_home_resumen_financiero.md` |
| `AC-HOME-16` | `USER` | No hay ningún saludo con nombre, emoji de celebración ni signo de exclamación. | `documentacion/app_web/04_modulos/39_modulo_home_resumen_financiero.md` |

## W-16 (27)

| Criterio | Protocolo | Enunciado | Documento |
|---|---|---|---|
| `AC-EVID-02` | `USER` | Todo filtro temporal supuesto se declara en la respuesta. | `documentacion/app_web/03_motor_ia/22_grounding_evidencia_y_politica.md` |
| `AC-EVID-10` | `USER` | El motor no emite consejo financiero ni de inversión. | `documentacion/app_web/03_motor_ia/22_grounding_evidencia_y_politica.md` |
| `AC-MOTOR-06` | `USER` | Las opciones de una pregunta de desambiguación provienen de los datos reales del usuario. | `documentacion/app_web/03_motor_ia/20_arquitectura_motor_conversacional.md` |
| `AC-MOTOR-07` | `USER` | Una operación masiva muestra conteo y muestra real antes de ejecutarse, y se puede deshacer entera. | `documentacion/app_web/03_motor_ia/20_arquitectura_motor_conversacional.md` |
| `AC-MOTOR-10` | `USER` | Cualquier cosa que se pueda hacer en la interfaz se puede pedir hablando. | `documentacion/app_web/03_motor_ia/20_arquitectura_motor_conversacional.md` |
| `AC-PERF-01` | `USER` | Un hecho observado no se da por cierto sin confirmación del usuario. | `documentacion/app_web/03_motor_ia/20c_perfil_del_usuario_y_voz.md` |
| `AC-PERF-05` | `USER` | Los rasgos invariantes de la voz no cambian con ningún perfil. | `documentacion/app_web/03_motor_ia/20c_perfil_del_usuario_y_voz.md` |
| `AC-PERF-06` | `USER` | Dos usuarios con estilos opuestos reciben respuestas de registro claramente distinto ante los mismos datos. | `documentacion/app_web/03_motor_ia/20c_perfil_del_usuario_y_voz.md` |
| `AC-PERF-08` | `USER` | Mensajes fragmentados se componen en una sola intención cuando el estilo del usuario lo indica. | `documentacion/app_web/03_motor_ia/20c_perfil_del_usuario_y_voz.md` |
| `AC-PERF-09` | `USER` | Un mensaje emocional se responde a la persona antes que al dato. | `documentacion/app_web/03_motor_ia/20c_perfil_del_usuario_y_voz.md` |
| `AC-PERF-11` | `USER` | El usuario puede ver, corregir, borrar y desactivar todo el perfil, y la app sigue funcionando. | `documentacion/app_web/03_motor_ia/20c_perfil_del_usuario_y_voz.md` |
| `AC-PERF-12` | `METRIC` | Se revisan periódicamente los hechos que nunca se usan y se deja de recogerlos. | `documentacion/app_web/03_motor_ia/20c_perfil_del_usuario_y_voz.md` |
| `AC-PERF-13` | `USER` | El asistente nunca responde "solo puedo ayudarte con temas financieros" a un comentario o pregunta conversacional. | `documentacion/app_web/03_motor_ia/20c_perfil_del_usuario_y_voz.md` |
| `AC-PERF-14` | `USER` | Un hecho de vida mencionado al pasar (cambio de trabajo, mudanza, viaje) se registra y se usa después, sin interrumpir el momento para preguntar. | `documentacion/app_web/03_motor_ia/20c_perfil_del_usuario_y_voz.md` |
| `AC-REU-08` | `METRIC` | El presupuesto de llamadas al modelo por turno baja de cuatro a dos como máximo. | `documentacion/app_web/05_asistente/42_reutilizacion_del_codigo_existente_motor.md` |
| `AC-RT-05` | `METRIC` | Un turno consume una sola sesión con el modelo. | `documentacion/app_web/03_motor_ia/23_runtime_ia_modos_costo_y_degradacion.md` |
| `AC-RT-06` | `METRIC` | El primer contenido visible aparece en menos de 1,5 s en el percentil 95. | `documentacion/app_web/03_motor_ia/23_runtime_ia_modos_costo_y_degradacion.md` |
| `AC-RT-07` | `USER` | Con el modelo caído, la aplicación sigue plenamente usable y el asistente lo declara con una vía manual concreta. | `documentacion/app_web/03_motor_ia/23_runtime_ia_modos_costo_y_degradacion.md` |
| `AC-RT-11` | `METRIC` | Se mide costo por turno resuelto, no solo por llamada. | `documentacion/app_web/03_motor_ia/23_runtime_ia_modos_costo_y_degradacion.md` |
| `AC-RT-15` | `METRIC` | El panorama se carga una vez por conversación, no una vez por turno. | `documentacion/app_web/03_motor_ia/23_runtime_ia_modos_costo_y_degradacion.md` |
| `AC-SEM-03` | `USER` | Cuando el motor usa conocimiento del mundo en un cálculo, lo declara como supuesto visible. | `documentacion/app_web/03_motor_ia/20b_capa_semantica_y_consulta_abierta.md` |
| `AC-SEM-04` | `METRIC` | El panorama cargado se mantiene por debajo de su presupuesto de tokens independientemente de los años de uso. | `documentacion/app_web/03_motor_ia/20b_capa_semantica_y_consulta_abierta.md` |
| `AC-SEM-08` | `USER` | Todo resultado calculado explica su procedimiento y sus supuestos en lenguaje del usuario. | `documentacion/app_web/03_motor_ia/20b_capa_semantica_y_consulta_abierta.md` |
| `AC-SEM-09` | `USER` | Las siete preguntas de §8 se responden correctamente sin código específico para ninguna. | `documentacion/app_web/03_motor_ia/20b_capa_semantica_y_consulta_abierta.md` |
| `AC-SEM-11` | `USER` | Cuando nada alcanza, el motor lo dice y ofrece la alternativa más cercana; nunca estima. | `documentacion/app_web/03_motor_ia/20b_capa_semantica_y_consulta_abierta.md` |
| `AC-SEM-14` | `METRIC` | Se registra cada cálculo generado con su frecuencia de uso y número de usuarios, para alimentar el ciclo de promoción. | `documentacion/app_web/03_motor_ia/20b_capa_semantica_y_consulta_abierta.md` |
| `AC-SEM-16` | `METRIC` | La proporción de turnos que requieren cálculo aislado se revisa periódicamente y tiende a bajar. | `documentacion/app_web/03_motor_ia/20b_capa_semantica_y_consulta_abierta.md` |

## W-17 (9)

| Criterio | Protocolo | Enunciado | Documento |
|---|---|---|---|
| `AC-ASI-01` | `USER` | El asistente nunca es modal y no impide usar la aplicación. | `documentacion/app_web/05_asistente/41_asistente_ia_en_la_app.md` |
| `AC-ASI-04` | `USER` | Una propuesta sin confirmar nunca se muestra en pasado. | `documentacion/app_web/05_asistente/41_asistente_ia_en_la_app.md` |
| `AC-ASI-05` | `USER` | En nivel `riesgo`, el botón primario es la salida segura y el de confirmar nombra el objeto. | `documentacion/app_web/05_asistente/41_asistente_ia_en_la_app.md` |
| `AC-ASI-09` | `USER` | Una masiva muestra conteo, muestra, exclusiones y casillas, y el botón refleja el número vigente. | `documentacion/app_web/05_asistente/41_asistente_ia_en_la_app.md` |
| `AC-ASI-11` | `USER` | Si el verificador rechaza un bloque tras emitir prosa, el texto se enmienda visiblemente y no se borra. | `documentacion/app_web/05_asistente/41_asistente_ia_en_la_app.md` |
| `AC-ASI-13` | `USER` | Una `impresion` se distingue de una `afirmacion` en el texto y en el estilo. | `documentacion/app_web/05_asistente/41_asistente_ia_en_la_app.md` |
| `AC-ASI-15` | `USER` | Con el modelo caído, el asistente no se oculta, no inventa y ofrece la vía manual concreta. | `documentacion/app_web/05_asistente/41_asistente_ia_en_la_app.md` |
| `AC-ASI-26` | `METRIC` | El primer fragmento de texto llega bajo 1,2 s. | `documentacion/app_web/05_asistente/41_asistente_ia_en_la_app.md` |
| `AC-ASI-27` | `USER` | Toda función del asistente tiene equivalente en la interfaz normal. | `documentacion/app_web/05_asistente/41_asistente_ia_en_la_app.md` |

## W-18 (11)

| Criterio | Protocolo | Enunciado | Documento |
|---|---|---|---|
| `AC-AUTH-03` | `USER` | Todos los mensajes visibles están en español y tienen salida. | `documentacion/app_web/06_transversales/43_auth_y_cuenta.md` |
| `AC-AUTH-10` | `USER` | Una sesión caducada no pierde el contenido de un formulario a medias. | `documentacion/app_web/06_transversales/43_auth_y_cuenta.md` |
| `AC-AUTH-11` | `USER` | Eliminar la cuenta ofrece exportar, enumera lo que se pierde con cifras reales y exige escribir `ELIMINAR`. | `documentacion/app_web/06_transversales/43_auth_y_cuenta.md` |
| `AC-CONF-07` | `USER` | Revocar un permiso no borra los datos ya registrados, y se dice. | `documentacion/app_web/06_transversales/45_configuracion_privacidad_y_control_de_datos.md` |
| `AC-CONF-09` | `USER` | `/eliminar-datos` describe el flujo en la aplicación como vía principal. Cierra `C-14`. | `documentacion/app_web/06_transversales/45_configuracion_privacidad_y_control_de_datos.md` |
| `AC-ONB-01` | `USER` | No existe ninguna barra de progreso ni lista de pasos obligatorios. | `documentacion/app_web/06_transversales/44_onboarding_web.md` |
| `AC-ONB-02` | `USER` | Las tres puertas se muestran a la vez, sin orden ni jerarquía entre ellas. | `documentacion/app_web/06_transversales/44_onboarding_web.md` |
| `AC-ONB-04` | `USER` | El siguiente paso ofrecido completa la ruta usada, y no es nunca una acción de uso del producto. | `documentacion/app_web/06_transversales/44_onboarding_web.md` |
| `AC-ONB-05` | `USER` | No se pide ningún dato que no se use en la misma sesión. | `documentacion/app_web/06_transversales/44_onboarding_web.md` |
| `AC-ONB-09` | `USER` | La pantalla de permiso de correo declara qué no se hace, antes de la pantalla de Google. | `documentacion/app_web/06_transversales/44_onboarding_web.md` |
| `AC-ONB-13` | `METRIC` | La mediana de tiempo hasta el primer valor está bajo 3 minutos, medida por ruta. | `documentacion/app_web/06_transversales/44_onboarding_web.md` |

## W-19 (9)

| Criterio | Protocolo | Enunciado | Documento |
|---|---|---|---|
| `AC-AYUDA-01` | `USER` | Toda cifra visible tiene procedencia navegable. Sin excepciones, en todas las superficies. | `documentacion/app_web/06_transversales/48_ayuda_explicabilidad_y_soporte.md` |
| `AC-AYUDA-02` | `USER` | La procedencia declara qué se contó y qué no. | `documentacion/app_web/06_transversales/48_ayuda_explicabilidad_y_soporte.md` |
| `AC-AYUDA-09` | `USER` | El usuario ve exactamente qué se adjunta antes de enviar, y puede quitarlo. | `documentacion/app_web/06_transversales/48_ayuda_explicabilidad_y_soporte.md` |
| `AC-AYUDA-10` | `USER` | El asistente no improvisa respuestas sobre el producto: deriva al artículo o admite que no lo hay. | `documentacion/app_web/06_transversales/48_ayuda_explicabilidad_y_soporte.md` |
| `AC-MAIL-11` | `USER` | Una dirección suprimida se avisa dentro de la aplicación. | `documentacion/app_web/06_transversales/46_notificaciones_y_correo_saliente.md` |
| `AC-OBS-05` | `USER` | El usuario puede reportar un problema y el reporte incluye `trace_id` sin datos financieros. | `documentacion/app_web/02_fundaciones/19_observabilidad_y_telemetria_web.md` |
| `AC-VIDA-04` | `USER` | `vacío` y `sin resultados` producen mensajes distintos, y nunca se dice "no tienes movimientos" a quien tiene y filtró. | `documentacion/app_web/06_transversales/47_ciclo_de_vida_del_dato_y_estados_vacios.md` |
| `AC-VIDA-05` | `USER` | Ningún estado vacío describe la ausencia: todos explican qué aparecerá. | `documentacion/app_web/06_transversales/47_ciclo_de_vida_del_dato_y_estados_vacios.md` |
| `AC-VIDA-11` | `METRIC` | Con 5.000 movimientos, el producto responde dentro de los presupuestos de latencia de cada módulo. | `documentacion/app_web/06_transversales/47_ciclo_de_vida_del_dato_y_estados_vacios.md` |

