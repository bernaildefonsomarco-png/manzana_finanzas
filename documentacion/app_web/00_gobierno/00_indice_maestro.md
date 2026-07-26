# 00 — Índice maestro

**Bloque:** 00 — Gobierno
**Estado:** vivo
**Fecha de última actualización:** 26 de julio de 2026
**Depende de:** ninguno (es la puerta de entrada al corpus)

---

## 1. Qué es este corpus

`documentacion/app_web/` es la fuente de verdad para la reconstrucción de la
aplicación web de Manzana, separada del canal WhatsApp (decisión `WEB-D001`
en `03_decisiones_producto_web.md`). El corpus anterior, `docs/`, queda
congelado como referencia histórica — ver `docs/AVISO_CORPUS_HISTORICO.md`.

Se documenta todo el producto antes de tocar código de features (decisión
`WEB-D006`). El plan completo de olas de escritura vive en el plan de
sesión; este índice es el que se actualiza en vivo a medida que cada
documento avanza de estado.

## 2. Cómo leer la numeración

**El número del archivo es el orden en que se escribió, no el orden en que
se debe leer.** El orden de lectura recomendado por rol está en §5.

## 3. Estados posibles

Definidos en `01_convenciones_y_plantillas.md` §5: `borrador`, `revisión`,
`aprobado`, `vivo`.

## 4. Estado de todos los documentos

### 00 — Gobierno

| # | Documento | Estado | Notas |
|---|---|---|---|
| 00 | `00_indice_maestro.md` | vivo | Este documento. |
| 01 | `01_convenciones_y_plantillas.md` | aprobado | Plantilla de 22 secciones, sistema de IDs, niveles de evidencia. |
| 02 | `02_mapa_herencia_corpus_legacy.md` | aprobado | Clasificación de los 56 documentos legacy (54 de `docs/` + 2 raíz). |
| 03 | `03_decisiones_producto_web.md` | vivo | 29 decisiones. `WEB-D014` a `WEB-D025` son el diseño del motor, tomadas con el usuario. |
| 04 | `04_glosario_y_lenguaje_visible.md` | aprobado | Migración de `12_lenguaje_producto.md` + vocabulario de los módulos nuevos. |
| 05 | `05_contradicciones_heredadas_cierre.md` | vivo | Las 17 contradicciones `C-01`..`C-17` con destino de cierre asignado. |

### 01 — Producto

| # | Documento | Estado | Notas |
|---|---|---|---|
| 06 | `06_tesis_app_web.md` | aprobado | Invierte la tesis de `05c_dashboard.md` §1/§22. Define los 4 trabajos y las 8 condiciones de verdad. |
| 07 | `07_alcance_web_v1.md` | aprobado | Candado de alcance IN/V1.1/FUERA para los 17 módulos. Invierte 5 exclusiones de `05c` §20. |
| 08 | `08_principios_experiencia_web.md` | aprobado | 12 principios heredados + 3 nuevos: procedencia, control, reversibilidad. |
| 09 | `09_modelo_mental_dinero.md` | aprobado | Las 4 capas del dinero, fórmulas y la distinción caja/compromiso/presupuesto. |
| 10 | `10_sitemap_rutas_y_navegacion.md` | aprobado | Mapa de rutas URL reales. Deroga `30_app_flow.md` §9 (sin historial de navegador). |
| 11 | `11_confianza_errores_y_reversibilidad.md` | aprobado | Separa reparar respuesta de corregir dinero. Contrato de errores en español. |

### 02 — Fundaciones

| # | Documento | Estado | Notas |
|---|---|---|---|
| 12 | `12_arquitectura_app_web.md` | aprobado | App Router real: frontera servidor/cliente, rutas interceptadas, dónde vive cada tipo de estado. |
| 13 | `13_modelo_datos_web_v1.md` | aprobado | Documenta por primera vez las migraciones 042-046. Añade 17 tablas y 22 enums (migraciones 047-056), incluidas las del panorama, el perfil y el ciclo de promoción. |
| 14 | `14_contratos_api_web.md` | aprobado | Paginación por cursor, filtros server-side, límite de peticiones, CSRF. |
| 15 | `15_seguridad_autorizacion_y_rls.md` | aprobado | Política RLS-first. 48 de 58 rutas usan service-role hoy; lista blanca + test que falla el build. |
| 16 | `16_design_system_web.md` | aprobado | 18 primitivas faltantes + 12 componentes de dominio. Elimina el `modal-accessibility-guard`. |
| 17 | `17_patrones_datos_formularios_y_listados.md` | aprobado | Un solo patrón para fetching, mutaciones, listados, formularios, fechas y dinero. |
| 18 | `18_accesibilidad_i18n_y_formatos.md` | aprobado | WCAG 2.2 AA verificado. Formatos de moneda, fecha y número. |
| 19 | `19_observabilidad_y_telemetria_web.md` | aprobado | `trace_id` de extremo a extremo. Alerta si el motor IA sirve con `local_fixture`. |

### 03 — Motor IA

Diseñado desde cero con el usuario, sin consultar `src/agents/` ni el diseño
de motor anterior (`WEB-D004`). Las catorce decisiones de producto están en
`03_decisiones_producto_web.md` (`WEB-D014` a `WEB-D025`).

| # | Documento | Estado | Notas |
|---|---|---|---|
| 20 | `20_arquitectura_motor_conversacional.md` | aprobado | Coordinador determinístico → espacio de trabajo → una sesión con el modelo → verificador. El agente propone; el Core ejecuta. |
| 20b | `20b_capa_semantica_y_consulta_abierta.md` | aprobado | **Elimina el techo de expresividad.** Panorama cargado + consulta abierta + cálculo aislado. El conocimiento del mundo lo aporta el modelo. Ciclo de promoción: el vocabulario crece con el uso real. |
| 20c | `20c_perfil_del_usuario_y_voz.md` | aprobado | Las 4 capas del perfil de la persona, validez temporal, y qué es invariante y qué se adapta en la voz. |
| 21 | `21_contrato_de_canal_y_presentadores.md` | aprobado | Bloques neutrales de canal + prueba de agnosticismo con 7 casos. |
| 22 | `22_grounding_evidencia_y_politica.md` | aprobado | Invariante de evidencia, procedencia, foco exacto, confirmabilidad y los 4 límites duros. |
| 23 | `23_runtime_ia_modos_costo_y_degradacion.md` | aprobado | Sustitución de motor prohibida en producción con arranque bloqueado. 4 grados de degradación declarados. |

Nota de numeración: `20b` y `20c` se escribieron después del `23`, al detectar
que la §7 y la §12 del documento 20 se quedaban cortas. Conservan el número
`20` porque amplían ese documento, siguiendo el mismo criterio con el que el
corpus anterior usó `23b`.

### 04 — Módulos

Siguen la plantilla obligatoria de 22 secciones
(`01_convenciones_y_plantillas.md` §8). El gate de calidad: alguien que no ha
leído `docs/` debe poder implementarlos sin una sola pregunta de producto.

| # | Documento | Estado | Notas |
|---|---|---|---|
| 24 | `24_modulo_cuentas_y_cajas.md` | aprobado | Las 4 capas del dinero implementables. 15 reglas con ejemplo numérico. Sin excepciones de service-role. |
| 25 | `25_modulo_categorias_subcategorias_y_etiquetas.md` | aprobado | 12 canónicas + subcategorías + 8 etiquetas. `otros` ≠ `sin clasificar` en datos y UI. |
| 26 | `26_modulo_movimientos.md` | aprobado | Los 11 tipos guardables (cierra C-05). Cursor, filtros server-side, restauración. |
| 27 | `27_modulo_pendientes_y_confirmaciones.md` | aprobado | "Todo pendiente nace confirmable o no nace", impuesto por constraint de BD (migración 057). |
| 28 | `28_modulo_email_y_deteccion_bancaria.md` | aprobado | Multi-buzón, remitentes editables y detección de remitente nuevo por metadatos. Backfill opcional. |
| 29 | `29_modulo_captura_sin_friccion.md` | aprobado | Parseo híbrido: reglas primero, modelo solo si hacen falta. Importación de archivos diferida a V1.1. |
| 30 | `30_modulo_recurrentes_y_pagos_que_vienen.md` | aprobado | Detectar no es activar. Un pago esperado no toca saldos, solo el dinero libre. |
| 31 | `31_modulo_deudas.md` | aprobado | Conciliación determinista con previsualización. Tarjeta como deuda simple. No cobra ni contacta a nadie. |
| 32 | `32_modulo_presupuestos_metas_y_limites.md` | aprobado | **Nuevo.** Un presupuesto no reserva dinero. Ningún tipo bloquea gastos. El tramo es permanente, el aviso llega una vez. *Corregido en auditoría 26 jul.* |
| 33 | `33_modulo_proyecciones_y_simulacion.md` | aprobado | **Nuevo.** Sin veredictos ni score. Los compromisos se descuentan una sola vez. Único módulo sin comandos de escritura. *Corregido en auditoría 26 jul.* |
| 34 | `34_modulo_descubrimientos_e_insights.md` | aprobado | **Reescritura.** Tres clases: lo declarado funciona el primer día, lo inferido espera. Umbrales por dimensión, nunca globales. Accionable = una herramienta, no un consejo. |
| 35 | `35_modulo_reportes_graficos_y_exportacion.md` | aprobado | **Nuevo.** El reporte no tiene aritmética propia. Cinco gráficos, cada uno con su decisión. Exportar es una obligación, no una función. |
| 36 | `36_modulo_memoria_y_aprendizaje.md` | no iniciado |
| 37 | `37_modulo_recordatorios_in_app.md` | no iniciado |
| 38 | `38_modulo_busqueda_y_navegacion_rapida.md` | no iniciado |
| 39 | `39_modulo_home_resumen_financiero.md` | no iniciado |

### 05 — Asistente

| # | Documento | Estado |
|---|---|---|
| 40 | `40_catalogo_de_tools_y_comandos.md` | no iniciado |
| 41 | `41_asistente_ia_en_la_app.md` | no iniciado |
| 42 | `42_reutilizacion_del_codigo_existente_motor.md` | no iniciado |

### 06 — Transversales

| # | Documento | Estado |
|---|---|---|
| 43 | `43_auth_y_cuenta.md` | no iniciado |
| 44 | `44_onboarding_web.md` | no iniciado |
| 45 | `45_configuracion_privacidad_y_control_de_datos.md` | no iniciado |
| 46 | `46_notificaciones_y_correo_saliente.md` | no iniciado |
| 47 | `47_ciclo_de_vida_del_dato_y_estados_vacios.md` | no iniciado |
| 48 | `48_ayuda_explicabilidad_y_soporte.md` | no iniciado |

### 07 — Calidad y ejecución

| # | Documento | Estado |
|---|---|---|
| 49 | `49_criterios_de_aceptacion_globales.md` | no iniciado |
| 50 | `50_matriz_de_trazabilidad_web.md` | no iniciado |
| 51 | `51_estrategia_de_pruebas_web.md` | no iniciado |
| 52 | `52_inventario_reutilizacion_codigo_src.md` | no iniciado |
| 53 | `53_deuda_tecnica_y_saneamiento.md` | no iniciado |
| 54 | `54_plan_de_implementacion_web.md` | no iniciado |
| 55 | `55_ledger_construccion_web.md` | no iniciado |
| 56 | `56_puente_a_fase_whatsapp.md` | no iniciado |

**Progreso: 38/60 documentos aprobados o vivos (Olas 1 a 7 completas, Ola 8 en curso; 12 de los 16 modulos).**

## 5. Orden de lectura por rol

Una vez que el corpus avance, cada rol puede entrar por aquí sin leer los 57
documentos en orden de escritura:

| Rol | Orden de lectura recomendado |
|---|---|
| **Producto** | 06, 07, 08, 09, 04, luego cualquier módulo de interés en `04_modulos/` |
| **Backend / datos** | 12, 13, 14, 15, luego §4 y §10-11 de cada módulo que implemente |
| **Frontend** | 16, 17, 18, 10, luego §8-9-12 de cada módulo que implemente |
| **Motor IA** | 20, 21, 22, 23, 40, 41, y solo entonces 42 |
| **QA / calidad** | 01 (plantilla), 49, 50, 51, luego §20 (criterios de aceptación) de cada módulo |
| **Nuevo en el proyecto** | 00 (este documento) → 06 → 02 → 07 → el resto según su rol |

## 6. Orden de escritura (olas) y dependencias

```
OLA 0   SANEAMIENTO — completada (ver 53_deuda_tecnica_y_saneamiento.md cuando exista;
        evidencia provisional en 03_decisiones_producto_web.md, WEB-D009)
OLA 1   00 01 02 03 04 05         — COMPLETADA (25 de julio de 2026)
OLA 2   06 07 08 09 10 11         — COMPLETADA (25 de julio de 2026)
OLA 3   12 13 14 15 16 17 18 19   — COMPLETADA (25 de julio de 2026)
OLA 4   20 20b 20c 21 22 23       — COMPLETADA (25 de julio de 2026), disenada con el usuario
OLA 5   24 25 26 27               — COMPLETADA (26 de julio de 2026)
OLA 6   28 29 30 31               — COMPLETADA (26 de julio de 2026)
OLA 7   32 33                     — COMPLETADA (26 de julio de 2026)
OLA 8   34 35 36
OLA 9   37 38 39
OLA 10  40 41
OLA 11  42                        — primer contacto autorizado con el código del motor
OLA 12  43 44 45 46 47 48
OLA 13  49 50 51 52 53 54 55 56
```

Aristas que no se pueden invertir (detalle completo en el plan de sesión):
`02` antes de todo · `07` antes de cualquier módulo · `13`/`14`/`15`/`16`/`17`
antes de los módulos · `20`-`23` antes de los módulos · `40` después de los
módulos (es agregación) · `42` después de `41` · `39` (Home) es el último
módulo porque agrega a todos los demás.

## 7. Punto de control tras cada ola

Al cerrar cada ola: actualizar la tabla de §4 de este documento, y una vez
exista, actualizar `07_calidad_y_ejecucion/50_matriz_de_trazabilidad_web.md`.
Ningún documento se marca `aprobado` sin cumplir el gate de calidad de
`01_convenciones_y_plantillas.md` §8 (para módulos) o sin revisión explícita
del usuario para los documentos de gobierno y producto.

## 8. Referencias externas al corpus

- `docs/AVISO_CORPUS_HISTORICO.md` — declara el congelamiento de `docs/`.
- Repositorio: commit baseline `e8c0e3c`, tag `baseline-pre-web-v1` (ver
  `03_decisiones_producto_web.md`, `WEB-D009`).
- `stitch_manzana_v1/` — 161 carpetas de frames visuales generados, referenciados
  desde §8 de cada documento de módulo vía `docs/fase_6_visual/32_especificacion_hifi.md`.
