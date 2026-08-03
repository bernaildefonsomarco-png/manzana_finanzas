// Generado por `npm run catalogo:generar` a partir de
// `documentacion/app_web/05_asistente/40_catalogo_de_tools_y_comandos.md`
// (`scripts/catalogo/generar.ts`, `40` §2, `WEB-D254`). No editar a mano:
// `tests/corpus/catalogo-generado.test.ts` falla el build si este archivo
// queda desincronizado de una regeneración fresca.

import type { Dimension, Medida, Alias, Comando, CensoCatalogo } from "./types.ts";

export const CATALOGO_GENERADO: {
  dimensiones: Dimension[];
  medidas: Medida[];
  alias: Alias[];
  comandos: Comando[];
  censo: CensoCatalogo;
} = {
  "dimensiones": [
    {
      "nombre": "tipo_movimiento",
      "valores": "Los 11 de `26` §4",
      "dueño": "26"
    },
    {
      "nombre": "estado_movimiento",
      "valores": "confirmado, por revisar, corregido, eliminado",
      "dueño": "26"
    },
    {
      "nombre": "origen_movimiento",
      "valores": "manual, correo, importación, asistente, recurrente, whatsapp",
      "dueño": "26"
    },
    {
      "nombre": "comercio",
      "valores": "Texto",
      "dueño": "26"
    },
    {
      "nombre": "cuenta",
      "valores": "Referencia",
      "dueño": "26"
    },
    {
      "nombre": "caja",
      "valores": "Referencia",
      "dueño": "26"
    },
    {
      "nombre": "fecha",
      "valores": "Rangos arbitrarios",
      "dueño": "26"
    },
    {
      "nombre": "dia_semana",
      "valores": "Aritmética de fechas",
      "dueño": "26"
    },
    {
      "nombre": "quincena",
      "valores": "Aritmética de fechas",
      "dueño": "26"
    },
    {
      "nombre": "franja_horaria",
      "valores": "Aritmética de fechas",
      "dueño": "26"
    },
    {
      "nombre": "semana_del_mes",
      "valores": "Aritmética de fechas",
      "dueño": "26"
    },
    {
      "nombre": "frecuencia_comercio",
      "valores": "única vez, ocasional, habitual, recurrente",
      "dueño": "26"
    },
    {
      "nombre": "es_primera_vez",
      "valores": "sí/no",
      "dueño": "26"
    },
    {
      "nombre": "dias_desde_anterior_igual",
      "valores": "Entero",
      "dueño": "26"
    },
    {
      "nombre": "desviacion_de_su_promedio",
      "valores": "Proporción",
      "dueño": "26"
    },
    {
      "nombre": "afecta_saldo",
      "valores": "Derivada del tipo",
      "dueño": "26"
    },
    {
      "nombre": "tiene_adjunto",
      "valores": "sí/no",
      "dueño": "26"
    },
    {
      "nombre": "tiene_nota",
      "valores": "sí/no",
      "dueño": "26"
    },
    {
      "nombre": "movimiento_cubierto_por_caja",
      "valores": "sí/no",
      "dueño": "24"
    },
    {
      "nombre": "categoria",
      "valores": "Las 12 + \"sin clasificar\"",
      "dueño": "25"
    },
    {
      "nombre": "subcategoria",
      "valores": "Del usuario",
      "dueño": "25"
    },
    {
      "nombre": "etiqueta",
      "valores": "Base y propias; varias por movimiento",
      "dueño": "25"
    },
    {
      "nombre": "estado_clasificacion",
      "valores": "clasificado, por revisar",
      "dueño": "25"
    },
    {
      "nombre": "origen_clasificacion",
      "valores": "usuario, sistema, aprendizaje",
      "dueño": "25"
    },
    {
      "nombre": "admite_categoria",
      "valores": "Derivada de `RUL-CAT-11`",
      "dueño": "25"
    },
    {
      "nombre": "tipo_cuenta",
      "valores": "digital, banco, físico, tarjeta",
      "dueño": "24"
    },
    {
      "nombre": "institucion",
      "valores": "Texto",
      "dueño": "24"
    },
    {
      "nombre": "es_cuenta_default",
      "valores": "sí/no",
      "dueño": "24"
    },
    {
      "nombre": "tiene_cajas",
      "valores": "sí/no",
      "dueño": "24"
    },
    {
      "nombre": "saldo_negativo",
      "valores": "sí/no",
      "dueño": "24"
    },
    {
      "nombre": "tipo_caja",
      "valores": "compromiso, objetivo, emergencia",
      "dueño": "24"
    },
    {
      "nombre": "caja_tiene_meta",
      "valores": "sí/no",
      "dueño": "24"
    },
    {
      "nombre": "progreso_caja",
      "valores": "Proporción 0–1 sobre la meta **de la caja**",
      "dueño": "24"
    },
    {
      "nombre": "caja_vinculada_a_deuda",
      "valores": "sí/no",
      "dueño": "24"
    },
    {
      "nombre": "estado_recurrente",
      "valores": "sugerido, activo, pausado, cancelado",
      "dueño": "30"
    },
    {
      "nombre": "frecuencia_recurrente",
      "valores": "Enum de frecuencias",
      "dueño": "30"
    },
    {
      "nombre": "variabilidad_monto",
      "valores": "fijo, variable",
      "dueño": "30"
    },
    {
      "nombre": "compromiso_cubierto_por_caja",
      "valores": "sí/no — **la que evita el doble descuento**",
      "dueño": "30"
    },
    {
      "nombre": "recurrente_vinculado_a_deuda",
      "valores": "sí/no",
      "dueño": "30"
    },
    {
      "nombre": "dias_hasta_vencimiento",
      "valores": "Entero",
      "dueño": "30"
    },
    {
      "nombre": "estado_ocurrencia",
      "valores": "esperada, pagada, saltada, vencida",
      "dueño": "30"
    },
    {
      "nombre": "origen_recurrente",
      "valores": "manual, detectado, email",
      "dueño": "30"
    },
    {
      "nombre": "direccion_deuda",
      "valores": "debes / te deben",
      "dueño": "31"
    },
    {
      "nombre": "tipo_deuda",
      "valores": "informal, banco, tarjeta, cuotas, préstamo",
      "dueño": "31"
    },
    {
      "nombre": "estado_deuda",
      "valores": "activa, vence pronto, vencida, cerrada, condonada",
      "dueño": "31"
    },
    {
      "nombre": "persona",
      "valores": "Referencia",
      "dueño": "31"
    },
    {
      "nombre": "tiene_calendario",
      "valores": "sí/no",
      "dueño": "31"
    },
    {
      "nombre": "deuda_cubierta_por_caja",
      "valores": "sí/no",
      "dueño": "31"
    },
    {
      "nombre": "dias_hasta_proxima_cuota",
      "valores": "Entero",
      "dueño": "31"
    },
    {
      "nombre": "progreso_pago",
      "valores": "Proporción pagada",
      "dueño": "31"
    },
    {
      "nombre": "estado_cuota",
      "valores": "Los seis de `31` §5",
      "dueño": "31"
    },
    {
      "nombre": "categoria_presupuestada",
      "valores": "Referencia",
      "dueño": "32"
    },
    {
      "nombre": "tipo_presupuesto",
      "valores": "presupuesto, límite, límite estricto",
      "dueño": "32"
    },
    {
      "nombre": "periodo_presupuesto",
      "valores": "semanal, quincenal, mensual",
      "dueño": "32"
    },
    {
      "nombre": "tramo_avance",
      "valores": "holgado, atención, cerca, superado",
      "dueño": "32"
    },
    {
      "nombre": "tiene_traspaso",
      "valores": "sí/no",
      "dueño": "32"
    },
    {
      "nombre": "origen_presupuesto",
      "valores": "manual, sugerido",
      "dueño": "32"
    },
    {
      "nombre": "estado_meta",
      "valores": "activa, alcanzada, pausada",
      "dueño": "32"
    },
    {
      "nombre": "meta_respaldada",
      "valores": "Si tiene caja vinculada",
      "dueño": "32"
    },
    {
      "nombre": "horizonte",
      "valores": "Días hasta el fin del periodo",
      "dueño": "33"
    },
    {
      "nombre": "tiene_datos_suficientes",
      "valores": "sí/no",
      "dueño": "33"
    },
    {
      "nombre": "dispersion_gasto",
      "valores": "baja, media, alta",
      "dueño": "33"
    },
    {
      "nombre": "componente_situacion",
      "valores": "cobertura, gasto/ingreso, reserva, deudas",
      "dueño": "33"
    },
    {
      "nombre": "origen_pendiente",
      "valores": "correo, importación, recurrente, asistente, sistema",
      "dueño": "27"
    },
    {
      "nombre": "tipo_pendiente",
      "valores": "Los seis de `27` §4.1",
      "dueño": "27"
    },
    {
      "nombre": "estado_pendiente",
      "valores": "pendiente, confirmado, descartado, ya registrado, caducado",
      "dueño": "27"
    },
    {
      "nombre": "confirmable",
      "valores": "sí/no",
      "dueño": "27"
    },
    {
      "nombre": "nivel_riesgo",
      "valores": "bajo, medio, alto",
      "dueño": "27"
    },
    {
      "nombre": "tiene_duplicado",
      "valores": "sí/no",
      "dueño": "27"
    },
    {
      "nombre": "antiguedad_pendiente",
      "valores": "Días",
      "dueño": "27"
    },
    {
      "nombre": "buzon",
      "valores": "Cuál de los conectados",
      "dueño": "28"
    },
    {
      "nombre": "remitente",
      "valores": "Dirección",
      "dueño": "28"
    },
    {
      "nombre": "origen_fuente",
      "valores": "catálogo, usuario, sugerido",
      "dueño": "28"
    },
    {
      "nombre": "estado_fuente",
      "valores": "shadow, activa, pausada, desactivada",
      "dueño": "28"
    },
    {
      "nombre": "dias_sin_deteccion",
      "valores": "Entero",
      "dueño": "28"
    },
    {
      "nombre": "origen_captura",
      "valores": "rápido, formulario, plantilla, duplicado",
      "dueño": "29"
    },
    {
      "nombre": "plantilla_usada",
      "valores": "Referencia",
      "dueño": "29"
    },
    {
      "nombre": "resuelto_por",
      "valores": "reglas, modelo, parcial",
      "dueño": "29"
    },
    {
      "nombre": "tipo_descubrimiento",
      "valores": "Los 17 de `RUL-DESC-01`",
      "dueño": "34"
    },
    {
      "nombre": "clase_descubrimiento",
      "valores": "A, B, C",
      "dueño": "34"
    },
    {
      "nombre": "estado_descubrimiento",
      "valores": "mostrado, descartado, expirado, obsoleto",
      "dueño": "34"
    },
    {
      "nombre": "periodo_analizado",
      "valores": "Rango",
      "dueño": "34"
    },
    {
      "nombre": "fue_util",
      "valores": "sí/no",
      "dueño": "34"
    },
    {
      "nombre": "tuvo_accion",
      "valores": "sí/no",
      "dueño": "34"
    },
    {
      "nombre": "periodo_reporte",
      "valores": "semana, quincena, mes, rango",
      "dueño": "35"
    },
    {
      "nombre": "agrupacion",
      "valores": "categoría, subcategoría, cuenta, tipo",
      "dueño": "35"
    },
    {
      "nombre": "tiene_comparacion",
      "valores": "sí/no",
      "dueño": "35"
    },
    {
      "nombre": "estado_exportacion",
      "valores": "pendiente, procesando, listo, expirado, fallido",
      "dueño": "35"
    },
    {
      "nombre": "clase_aprendizaje",
      "valores": "clasificatorio, perfil, preferencia",
      "dueño": "36"
    },
    {
      "nombre": "estado_aprendizaje",
      "valores": "confirmado, suspendido, olvidado, caducado",
      "dueño": "36"
    },
    {
      "nombre": "origen_aprendizaje",
      "valores": "dicho, observado y confirmado",
      "dueño": "36"
    },
    {
      "nombre": "capa_perfil",
      "valores": "estilo, vida, vínculo, hilo",
      "dueño": "36"
    },
    {
      "nombre": "tiene_contradiccion",
      "valores": "sí/no",
      "dueño": "36"
    },
    {
      "nombre": "tipo_recordatorio",
      "valores": "Los 10 de `RUL-NOTIF-01`",
      "dueño": "37"
    },
    {
      "nombre": "clase_recordatorio",
      "valores": "T, V, A, U",
      "dueño": "37"
    },
    {
      "nombre": "estado_recordatorio",
      "valores": "abierto, leído, pospuesto, resuelto, descartado, caducado",
      "dueño": "37"
    },
    {
      "nombre": "canal_entrega",
      "valores": "bandeja, correo",
      "dueño": "37"
    },
    {
      "nombre": "fue_resuelto_solo",
      "valores": "sí/no",
      "dueño": "37"
    },
    {
      "nombre": "coincide_texto",
      "valores": "Filtro de texto libre, **combinable con cualquier consulta**",
      "dueño": "38"
    },
    {
      "nombre": "estado_progresivo",
      "valores": "vacío, temprano, funcional, completo",
      "dueño": "39"
    },
    {
      "nombre": "bloques_visibles",
      "valores": "Contexto de pantalla",
      "dueño": "39"
    }
  ],
  "medidas": [
    {
      "nombre": "suma",
      "descripcion": "Agregaciones sobre movimientos",
      "dueño": "26",
      "advertencia": false
    },
    {
      "nombre": "conteo",
      "descripcion": "Agregaciones sobre movimientos",
      "dueño": "26",
      "advertencia": false
    },
    {
      "nombre": "promedio",
      "descripcion": "Agregaciones sobre movimientos",
      "dueño": "26",
      "advertencia": false
    },
    {
      "nombre": "mediana",
      "descripcion": "Agregaciones sobre movimientos",
      "dueño": "26",
      "advertencia": false
    },
    {
      "nombre": "maximo",
      "descripcion": "Agregaciones sobre movimientos",
      "dueño": "26",
      "advertencia": false
    },
    {
      "nombre": "minimo",
      "descripcion": "Agregaciones sobre movimientos",
      "dueño": "26",
      "advertencia": false
    },
    {
      "nombre": "percentil",
      "descripcion": "Agregaciones sobre movimientos",
      "dueño": "26",
      "advertencia": false
    },
    {
      "nombre": "conteo_comercios_distintos",
      "descripcion": "",
      "dueño": "26",
      "advertencia": false
    },
    {
      "nombre": "proporcion_del_total",
      "descripcion": "",
      "dueño": "26",
      "advertencia": false
    },
    {
      "nombre": "sin_clasificar",
      "descripcion": "Conteo y suma pendientes de revisar",
      "dueño": "25",
      "advertencia": false
    },
    {
      "nombre": "saldo_total",
      "descripcion": "Suma de saldos de cuentas activas",
      "dueño": "24",
      "advertencia": false
    },
    {
      "nombre": "separado_total",
      "descripcion": "Suma de saldos de cajas activas",
      "dueño": "24",
      "advertencia": false
    },
    {
      "nombre": "libre_en_cuentas",
      "descripcion": "`RUL-CUENTAS-02`",
      "dueño": "24",
      "advertencia": false
    },
    {
      "nombre": "dinero_libre",
      "descripcion": "`RUL-CUENTAS-03`",
      "dueño": "24",
      "advertencia": false
    },
    {
      "nombre": "conteo_pendientes",
      "descripcion": "Agrupable por origen y tipo",
      "dueño": "27",
      "advertencia": false
    },
    {
      "nombre": "suma_propuesta",
      "descripcion": "**Nunca se presenta como gasto real**",
      "dueño": "27",
      "advertencia": true
    },
    {
      "nombre": "tasa_confirmacion_pendientes",
      "descripcion": "Confirmados sobre resueltos",
      "dueño": "27",
      "advertencia": false
    },
    {
      "nombre": "detecciones",
      "descripcion": "Conteo por fuente y periodo",
      "dueño": "28",
      "advertencia": false
    },
    {
      "nombre": "tasa_confirmacion_detecciones",
      "descripcion": "Confirmadas sobre creadas",
      "dueño": "28",
      "advertencia": false
    },
    {
      "nombre": "tasa_descarte_detecciones",
      "descripcion": "Señal de ruido",
      "dueño": "28",
      "advertencia": false
    },
    {
      "nombre": "uso_por_plantilla",
      "descripcion": "",
      "dueño": "29",
      "advertencia": false
    },
    {
      "nombre": "tiempo_hasta_guardar",
      "descripcion": "",
      "dueño": "29",
      "advertencia": false
    },
    {
      "nombre": "total_comprometido",
      "descripcion": "Compromisos del periodo",
      "dueño": "30",
      "advertencia": false
    },
    {
      "nombre": "total_no_cubierto",
      "descripcion": "**La que entra en el dinero libre**",
      "dueño": "30",
      "advertencia": false
    },
    {
      "nombre": "variacion_vs_esperado",
      "descripcion": "",
      "dueño": "30",
      "advertencia": false
    },
    {
      "nombre": "saldo_total_debido",
      "descripcion": "",
      "dueño": "31",
      "advertencia": false
    },
    {
      "nombre": "saldo_total_a_favor",
      "descripcion": "**Nunca se resta del anterior sin decirlo**",
      "dueño": "31",
      "advertencia": true
    },
    {
      "nombre": "pagado_en_periodo",
      "descripcion": "",
      "dueño": "31",
      "advertencia": false
    },
    {
      "nombre": "proximo_vencimiento",
      "descripcion": "",
      "dueño": "31",
      "advertencia": false
    },
    {
      "nombre": "gastado_en_presupuesto",
      "descripcion": "Con sus referencias",
      "dueño": "32",
      "advertencia": false
    },
    {
      "nombre": "restante",
      "descripcion": "Puede ser negativo",
      "dueño": "32",
      "advertencia": false
    },
    {
      "nombre": "porcentaje_avance",
      "descripcion": "",
      "dueño": "32",
      "advertencia": false
    },
    {
      "nombre": "total_presupuestado",
      "descripcion": "",
      "dueño": "32",
      "advertencia": false
    },
    {
      "nombre": "desviacion_vs_periodo_anterior",
      "descripcion": "",
      "dueño": "32",
      "advertencia": false
    },
    {
      "nombre": "progreso_meta",
      "descripcion": "Saldo de la caja sobre el objetivo de la meta",
      "dueño": "32",
      "advertencia": false
    },
    {
      "nombre": "proyeccion_cierre",
      "descripcion": "**Con sus supuestos obligatorios**",
      "dueño": "33",
      "advertencia": true
    },
    {
      "nombre": "ritmo_diario",
      "descripcion": "Mediana de 14 días, sin compromisos",
      "dueño": "33",
      "advertencia": false
    },
    {
      "nombre": "impacto_simulado",
      "descripcion": "Efecto de un gasto hipotético",
      "dueño": "33",
      "advertencia": false
    },
    {
      "nombre": "descubrimientos_activos",
      "descripcion": "",
      "dueño": "34",
      "advertencia": false
    },
    {
      "nombre": "tasa_de_utilidad",
      "descripcion": "",
      "dueño": "34",
      "advertencia": false
    },
    {
      "nombre": "tasa_de_accion",
      "descripcion": "",
      "dueño": "34",
      "advertencia": false
    },
    {
      "nombre": "variacion_entre_periodos",
      "descripcion": "Absoluta y relativa",
      "dueño": "35",
      "advertencia": false
    },
    {
      "nombre": "movimientos_excluidos",
      "descripcion": "Cuántos y por qué",
      "dueño": "35",
      "advertencia": false
    },
    {
      "nombre": "aprendizajes_activos",
      "descripcion": "Por clase",
      "dueño": "36",
      "advertencia": false
    },
    {
      "nombre": "evidencia_positiva",
      "descripcion": "Conteos, **nunca pesos**",
      "dueño": "36",
      "advertencia": false
    },
    {
      "nombre": "evidencia_negativa",
      "descripcion": "Conteos, **nunca pesos**",
      "dueño": "36",
      "advertencia": false
    },
    {
      "nombre": "dias_desde_ultimo_uso",
      "descripcion": "",
      "dueño": "36",
      "advertencia": false
    },
    {
      "nombre": "recordatorios_abiertos",
      "descripcion": "",
      "dueño": "37",
      "advertencia": false
    },
    {
      "nombre": "tasa_de_resolucion",
      "descripcion": "",
      "dueño": "37",
      "advertencia": false
    },
    {
      "nombre": "dias_hasta_resolucion",
      "descripcion": "",
      "dueño": "37",
      "advertencia": false
    }
  ],
  "alias": [
    {
      "nombre": "gasto_por_categoria",
      "equivaleA": "`suma` + `agrupar: categoria`",
      "dueño": "25"
    },
    {
      "nombre": "conteo_por_categoria",
      "equivaleA": "`conteo` + `agrupar: categoria`",
      "dueño": "25"
    },
    {
      "nombre": "proporcion_del_gasto",
      "equivaleA": "`proporcion_del_total` + `agrupar: categoria`",
      "dueño": "25"
    },
    {
      "nombre": "libre_por_cuenta",
      "equivaleA": "`libre_en_cuentas` + `agrupar: cuenta`",
      "dueño": "24"
    },
    {
      "nombre": "total_por_grupo",
      "equivaleA": "`suma` + la agrupación pedida",
      "dueño": "35"
    }
  ],
  "comandos": [
    {
      "nombre": "crear_cuenta",
      "niveles": [
        "tarjeta_editable"
      ],
      "detalle": "",
      "dueño": "24"
    },
    {
      "nombre": "editar_cuenta",
      "niveles": [
        "tarjeta_editable"
      ],
      "detalle": "",
      "dueño": "24"
    },
    {
      "nombre": "archivar_cuenta",
      "niveles": [
        "riesgo"
      ],
      "detalle": "Qué pasa con sus cajas",
      "dueño": "24"
    },
    {
      "nombre": "ajustar_saldo",
      "niveles": [
        "riesgo"
      ],
      "detalle": "La diferencia",
      "dueño": "24"
    },
    {
      "nombre": "crear_caja",
      "niveles": [
        "tarjeta_editable"
      ],
      "detalle": "",
      "dueño": "24"
    },
    {
      "nombre": "editar_caja",
      "niveles": [
        "tarjeta_editable"
      ],
      "detalle": "",
      "dueño": "24"
    },
    {
      "nombre": "eliminar_caja",
      "niveles": [
        "riesgo"
      ],
      "detalle": "Destino del dinero, si tiene saldo",
      "dueño": "24"
    },
    {
      "nombre": "transferir",
      "niveles": [
        "tarjeta_editable"
      ],
      "detalle": "Efecto previo",
      "dueño": "24"
    },
    {
      "nombre": "separar_en_caja",
      "niveles": [
        "tarjeta_editable"
      ],
      "detalle": "Efecto previo",
      "dueño": "24"
    },
    {
      "nombre": "devolver_a_libre",
      "niveles": [
        "tarjeta_editable"
      ],
      "detalle": "Efecto previo",
      "dueño": "24"
    },
    {
      "nombre": "mover_entre_cajas",
      "niveles": [
        "tarjeta_editable"
      ],
      "detalle": "Efecto previo",
      "dueño": "24"
    },
    {
      "nombre": "clasificar_movimiento",
      "niveles": [
        "tarjeta_editable"
      ],
      "detalle": "",
      "dueño": "25"
    },
    {
      "nombre": "corregir_clasificacion",
      "niveles": [
        "tarjeta_editable"
      ],
      "detalle": "",
      "dueño": "25"
    },
    {
      "nombre": "crear_subcategoria",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "25"
    },
    {
      "nombre": "renombrar_subcategoria",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "25"
    },
    {
      "nombre": "fusionar_subcategorias",
      "niveles": [
        "riesgo",
        "masiva"
      ],
      "detalle": "Conteo de afectados",
      "dueño": "25"
    },
    {
      "nombre": "mover_subcategoria",
      "niveles": [
        "riesgo",
        "masiva"
      ],
      "detalle": "Conteo",
      "dueño": "25"
    },
    {
      "nombre": "agregar_etiqueta",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "25"
    },
    {
      "nombre": "quitar_etiqueta",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "25"
    },
    {
      "nombre": "reclasificar_lote",
      "niveles": [
        "masiva"
      ],
      "detalle": "Conteo, muestra, exclusión, deshacer",
      "dueño": "25"
    },
    {
      "nombre": "crear_movimiento",
      "niveles": [
        "tarjeta_editable"
      ],
      "detalle": "Lo dudoso resaltado",
      "dueño": "26"
    },
    {
      "nombre": "editar_movimiento",
      "niveles": [
        "tarjeta_editable"
      ],
      "detalle": "",
      "dueño": "26"
    },
    {
      "nombre": "cambiar_tipo",
      "niveles": [
        "riesgo"
      ],
      "detalle": "El efecto sobre saldos",
      "dueño": "26"
    },
    {
      "nombre": "eliminar_movimiento",
      "niveles": [
        "riesgo"
      ],
      "detalle": "Nombrando el movimiento",
      "dueño": "26"
    },
    {
      "nombre": "restaurar_movimiento",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "26"
    },
    {
      "nombre": "duplicar_movimiento",
      "niveles": [
        "tarjeta_editable"
      ],
      "detalle": "",
      "dueño": "26"
    },
    {
      "nombre": "recategorizar_lote",
      "niveles": [
        "masiva"
      ],
      "detalle": "",
      "dueño": "26"
    },
    {
      "nombre": "etiquetar_lote",
      "niveles": [
        "masiva"
      ],
      "detalle": "",
      "dueño": "26"
    },
    {
      "nombre": "eliminar_lote",
      "niveles": [
        "masiva",
        "riesgo"
      ],
      "detalle": "",
      "dueño": "26"
    },
    {
      "nombre": "confirmar_pendiente",
      "niveles": [
        "tarjeta_editable"
      ],
      "detalle": "La propuesta",
      "dueño": "27"
    },
    {
      "nombre": "editar_y_confirmar",
      "niveles": [
        "tarjeta_editable"
      ],
      "detalle": "",
      "dueño": "27"
    },
    {
      "nombre": "descartar_pendiente",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "27"
    },
    {
      "nombre": "marcar_ya_registrado",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "27"
    },
    {
      "nombre": "completar_pendiente",
      "niveles": [
        "tarjeta_editable"
      ],
      "detalle": "El campo que falta",
      "dueño": "27"
    },
    {
      "nombre": "confirmar_lote",
      "niveles": [
        "masiva"
      ],
      "detalle": "Conteo, muestra, **exclusión de riesgo alto**",
      "dueño": "27"
    },
    {
      "nombre": "editar_remitente",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "Que vuelve a shadow",
      "dueño": "28"
    },
    {
      "nombre": "pausar_fuente",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "28"
    },
    {
      "nombre": "aceptar_sugerencia_remitente",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "28"
    },
    {
      "nombre": "iniciar_backfill",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "Volumen estimado",
      "dueño": "28"
    },
    {
      "nombre": "desconectar_buzon",
      "niveles": [
        "riesgo"
      ],
      "detalle": "Qué se conserva",
      "dueño": "28"
    },
    {
      "nombre": "crear_plantilla",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "29"
    },
    {
      "nombre": "usar_plantilla",
      "niveles": [
        "tarjeta_editable"
      ],
      "detalle": "",
      "dueño": "29"
    },
    {
      "nombre": "editar_plantilla",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "29"
    },
    {
      "nombre": "archivar_plantilla",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "29"
    },
    {
      "nombre": "crear_recurrente",
      "niveles": [
        "tarjeta_editable"
      ],
      "detalle": "",
      "dueño": "30"
    },
    {
      "nombre": "aceptar_sugerencia_recurrente",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "Su evidencia",
      "dueño": "30"
    },
    {
      "nombre": "marcar_pagado",
      "niveles": [
        "tarjeta_editable"
      ],
      "detalle": "**El monto que se va a registrar**",
      "dueño": "30"
    },
    {
      "nombre": "saltar_periodo",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "30"
    },
    {
      "nombre": "pausar_recurrente",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "30"
    },
    {
      "nombre": "reactivar_recurrente",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "30"
    },
    {
      "nombre": "cancelar_recurrente",
      "niveles": [
        "riesgo"
      ],
      "detalle": "",
      "dueño": "30"
    },
    {
      "nombre": "actualizar_monto_esperado",
      "niveles": [
        "tarjeta_editable"
      ],
      "detalle": "",
      "dueño": "30"
    },
    {
      "nombre": "vincular_caja_a_compromiso",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "30"
    },
    {
      "nombre": "crear_deuda",
      "niveles": [
        "tarjeta_editable"
      ],
      "detalle": "Previsualización de cuotas",
      "dueño": "31"
    },
    {
      "nombre": "registrar_pago_deuda",
      "niveles": [
        "tarjeta_editable"
      ],
      "detalle": "**La aplicación a cuotas, visible**",
      "dueño": "31"
    },
    {
      "nombre": "registrar_devolucion",
      "niveles": [
        "tarjeta_editable"
      ],
      "detalle": "",
      "dueño": "31"
    },
    {
      "nombre": "registrar_interes",
      "niveles": [
        "riesgo"
      ],
      "detalle": "",
      "dueño": "31"
    },
    {
      "nombre": "renegociar_deuda",
      "niveles": [
        "riesgo"
      ],
      "detalle": "Calendarios lado a lado",
      "dueño": "31"
    },
    {
      "nombre": "cerrar_deuda",
      "niveles": [
        "riesgo"
      ],
      "detalle": "Pagada o condonada: las dos opciones",
      "dueño": "31"
    },
    {
      "nombre": "reabrir_deuda",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "31"
    },
    {
      "nombre": "vincular_caja_a_deuda",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "31"
    },
    {
      "nombre": "reprogramar_cuota",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "31"
    },
    {
      "nombre": "saltar_cuota",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "31"
    },
    {
      "nombre": "crear_persona",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "31"
    },
    {
      "nombre": "crear_presupuesto",
      "niveles": [
        "tarjeta_editable"
      ],
      "detalle": "Monto sugerido precargado",
      "dueño": "32"
    },
    {
      "nombre": "editar_presupuesto",
      "niveles": [
        "tarjeta_editable"
      ],
      "detalle": "",
      "dueño": "32"
    },
    {
      "nombre": "ajustar_presupuesto",
      "niveles": [
        "tarjeta_editable"
      ],
      "detalle": "",
      "dueño": "32"
    },
    {
      "nombre": "pausar_presupuesto",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "32"
    },
    {
      "nombre": "archivar_presupuesto",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "32"
    },
    {
      "nombre": "copiar_presupuestos_periodo_anterior",
      "niveles": [
        "masiva"
      ],
      "detalle": "Conteo y muestra",
      "dueño": "32"
    },
    {
      "nombre": "aceptar_sugerencia_presupuesto",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "Su evidencia",
      "dueño": "32"
    },
    {
      "nombre": "crear_meta",
      "niveles": [
        "tarjeta_editable"
      ],
      "detalle": "",
      "dueño": "32"
    },
    {
      "nombre": "vincular_caja_a_meta",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "32"
    },
    {
      "nombre": "aportar_a_meta",
      "niveles": [
        "tarjeta_editable"
      ],
      "detalle": "Efecto sobre el dinero libre",
      "dueño": "32"
    },
    {
      "nombre": "activar_renovacion",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "32"
    },
    {
      "nombre": "desactivar_renovacion",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "32"
    },
    {
      "nombre": "descartar_descubrimiento",
      "niveles": [
        "ninguna"
      ],
      "detalle": "",
      "dueño": "34"
    },
    {
      "nombre": "marcar_descubrimiento",
      "niveles": [
        "ninguna"
      ],
      "detalle": "",
      "dueño": "34"
    },
    {
      "nombre": "silenciar_tipo_descubrimiento",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "34"
    },
    {
      "nombre": "guardar_vista_reporte",
      "niveles": [
        "ninguna"
      ],
      "detalle": "",
      "dueño": "35"
    },
    {
      "nombre": "eliminar_vista_reporte",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "35"
    },
    {
      "nombre": "exportar_movimientos",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "Conteo y filtros",
      "dueño": "35"
    },
    {
      "nombre": "exportar_datos_completos",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "**La lista de lo que incluye**",
      "dueño": "35"
    },
    {
      "nombre": "confirmar_hecho_perfil",
      "niveles": [
        "ninguna"
      ],
      "detalle": "El usuario acaba de decirlo",
      "dueño": "36"
    },
    {
      "nombre": "corregir_aprendizaje",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "Lo anterior y lo nuevo",
      "dueño": "36"
    },
    {
      "nombre": "olvidar_aprendizaje",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "**Qué se conserva**",
      "dueño": "36"
    },
    {
      "nombre": "no_preguntar_mas",
      "niveles": [
        "ninguna"
      ],
      "detalle": "",
      "dueño": "36"
    },
    {
      "nombre": "reactivar_aprendizaje",
      "niveles": [
        "ninguna"
      ],
      "detalle": "",
      "dueño": "36"
    },
    {
      "nombre": "posponer_recordatorio",
      "niveles": [
        "ninguna"
      ],
      "detalle": "",
      "dueño": "37"
    },
    {
      "nombre": "descartar_recordatorio",
      "niveles": [
        "ninguna"
      ],
      "detalle": "",
      "dueño": "37"
    },
    {
      "nombre": "silenciar_tipo_recordatorio",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "37"
    },
    {
      "nombre": "cambiar_horario_silencioso",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "El horario resultante",
      "dueño": "37"
    },
    {
      "nombre": "pausar_recordatorios",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "Fecha de reanudación",
      "dueño": "37"
    },
    {
      "nombre": "activar_correo_recordatorios",
      "niveles": [
        "consentimiento"
      ],
      "detalle": "Tipo, frecuencia máxima, cómo apagarlo",
      "dueño": "37"
    },
    {
      "nombre": "guardar_busqueda",
      "niveles": [
        "ninguna"
      ],
      "detalle": "",
      "dueño": "38"
    },
    {
      "nombre": "eliminar_busqueda_guardada",
      "niveles": [
        "tarjeta"
      ],
      "detalle": "",
      "dueño": "38"
    },
    {
      "nombre": "ocultar_bloque_inicio",
      "niveles": [
        "ninguna"
      ],
      "detalle": "",
      "dueño": "39"
    },
    {
      "nombre": "mostrar_bloque_inicio",
      "niveles": [
        "ninguna"
      ],
      "detalle": "",
      "dueño": "39"
    },
    {
      "nombre": "posponer_siguiente",
      "niveles": [
        "ninguna"
      ],
      "detalle": "",
      "dueño": "39"
    }
  ],
  "censo": {
    "totalDimensiones": 101,
    "totalMedidas": 50,
    "totalAlias": 5,
    "totalLecturas": 156,
    "totalComandos": 99,
    "porNivel": {
      "ninguna": 12,
      "tarjeta": 40,
      "tarjeta_editable": 28,
      "riesgo": 13,
      "masiva": 8,
      "consentimiento": 1
    }
  }
} as const;
