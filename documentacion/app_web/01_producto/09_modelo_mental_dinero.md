# 09 — Modelo mental del dinero

**Bloque:** 01 — Producto
**Estado:** V1
**Fecha:** 25 de julio de 2026
**Depende de:** `06_tesis_app_web.md`, `08_principios_experiencia_web.md`
**Documentos que dependen de este:** `24_modulo_cuentas_y_cajas.md`, `32_modulo_presupuestos_metas_y_limites.md`, `33_modulo_proyecciones_y_simulacion.md`, `39_modulo_home_resumen_financiero.md`
**Fuentes:** `docs/fase_2_estrategia/alcance_v1/05e_cuentas_cajas.md` §5 (fórmulas), `docs/fase_3_producto/12_lenguaje_producto.md` §6.1

---

## 1. Para qué existe este documento

Toda la interfaz de Manzana descansa sobre una idea: **el dinero que tienes
no es el dinero que puedes gastar.** Si esa distinción no está clara en la
cabeza del usuario, ninguna pantalla funciona — el Home muestra un número
que no significa nada, las proyecciones parten de una base equivocada y los
presupuestos compiten con los compromisos sin que nadie sepa cuál gana.

Este documento fija ese modelo mental una sola vez, para que los módulos no
lo redefinan cada uno a su manera. Es la razón por la que se escribe antes
que cualquier documento de módulo.

## 2. Las cuatro capas del dinero

```text
Dinero total
  − Cajas / dinero separado
  = Libre en cuentas
  − Compromisos próximos no cubiertos por cajas
  = Dinero libre
```

| Capa | Qué es | Nombre visible |
|---|---|---|
| **Dinero total** | La suma de los saldos de todas las cuentas reales. | "Total" |
| **Separado en cajas** | Dinero que sigue en la cuenta pero el usuario ya destinó a algo. | "Separado" / "Cajas" |
| **Libre en cuentas** | Total menos lo separado. Es un cálculo, no una entidad. | "Libre en cuentas" |
| **Dinero libre** | Libre en cuentas menos los compromisos próximos que ninguna caja cubre. Es la cifra que responde "¿puedo gastar esto?". | **"Dinero libre"** — es el número principal |

Regla de nomenclatura heredada y no negociable: el usuario ve **"Dinero
libre"**; internamente ese número es el `dinero_libre_operativo`. La palabra
"operativo" nunca aparece en la interfaz.

## 3. Las fórmulas

Tomadas de `docs/fase_2_estrategia/alcance_v1/05e_cuentas_cajas.md` §5.1, que
se reutiliza sin cambios de fondo:

```text
libre_en_cuenta        = saldo_cuenta − Σ cajas_de_esa_cuenta

libre_en_cuentas_global = Σ libre_en_cuenta
                        = Σ saldos − Σ todas_las_cajas

dinero_libre           = libre_en_cuentas_global
                       − compromisos_próximos_no_cubiertos_por_cajas
```

Tres reglas que evitan errores de doble conteo:

1. **"Libre" es siempre un cálculo, nunca una fila en la base de datos.** Si
   entra un ingreso a una cuenta, el libre se ajusta solo. No hay que
   actualizar ninguna entidad adicional.
2. **Si una caja ya cubre un compromiso, ese compromiso no se descuenta otra
   vez.** El alquiler apartado en una caja no vuelve a restar como
   "compromiso próximo".
3. **Las cajas no son compromisos.** Una caja es dinero separado que *puede
   cubrir* un compromiso. Confundirlos hace que el mismo dinero se reste dos
   veces.

## 4. Ejemplo numérico completo

El caso de referencia que todos los módulos deben producir igual:

```text
Cuentas
  BCP                     S/630.00
  Yape                    S/120.00
  Efectivo                 S/50.00
  ─────────────────────────────────
  Dinero total            S/800.00

Cajas
  Emergencia (BCP)        S/100.00
  Cuota laptop (BCP)      S/180.00
  Alquiler (BCP)          S/300.00
  ─────────────────────────────────
  Separado                S/580.00

  Libre en cuentas        S/220.00     (800.00 − 580.00)

Compromisos próximos
  Internet, vence en 4 días     S/50.00   ← ninguna caja lo cubre
  Cuota laptop, vence en 6 días S/180.00  ← cubierta por su caja, NO se descuenta
  ─────────────────────────────────
  No cubiertos             S/50.00

  Dinero libre            S/170.00     (220.00 − 50.00)
```

Verificación de la regla 2: la cuota de laptop de S/180.00 aparece como
compromiso próximo, pero su caja tiene exactamente S/180.00 separados. Si se
descontara igual, el dinero libre daría S/-10.00 en lugar de S/170.00. Ese
error de doble conteo es el más fácil de cometer y el más difícil de
detectar mirando la pantalla.

## 5. Qué responde cada cifra

Cada número tiene una pregunta asignada. Si una cifra no responde ninguna,
no debería estar en pantalla.

| Cifra | Pregunta que responde | Dónde vive |
|---|---|---|
| Dinero libre | ¿Puedo gastar esto hoy? | Home (principal), asistente |
| Libre en cuentas | ¿Cuánto tengo sin destinar todavía? | Mi Dinero (detalle) |
| Dinero total | ¿Cuánto tengo en total? | Mi Dinero (contexto) |
| Saldo por cuenta | ¿Cuánto hay en Yape / BCP / efectivo? | Mi Dinero |
| Saldo de caja | ¿Cuánto llevo apartado para esto? | Mi Dinero, Metas |
| Compromisos próximos | ¿Qué me va a salir pronto? | Home, Pagos que vienen |
| Avance de presupuesto | ¿Cómo voy respecto a lo que planeé? | Home, Presupuestos |
| Proyección de cierre | ¿Cómo terminaría el mes a este ritmo? | Home, Proyecciones |

## 6. Jerarquía visual que se deriva

El orden de importancia de la información en cualquier pantalla de resumen
se deriva directamente del modelo mental. No es una decisión estética:

1. **Dinero libre** — la cifra que habilita decisiones.
2. **Lo que requiere acción del usuario** — pendientes por confirmar,
   presupuesto en riesgo, cuota que vence.
3. **Lo que viene** — compromisos próximos ordenados por cercanía.
4. **Lo que cambió** — descubrimientos, movimientos recientes.
5. **El detalle** — desglose de cuentas, cajas, historial.

Regla derivada: **el dinero total nunca es la cifra principal.** Mostrar
S/800.00 como número grande cuando el usuario solo puede gastar S/170.00 es
exactamente el error que Manzana existe para corregir.

## 7. El horizonte temporal

"Compromisos próximos" necesita una definición operativa, o cada módulo
elegiría la suya.

| Concepto | Definición V1 |
|---|---|
| **Horizonte de compromisos** | Los próximos 30 días naturales desde hoy, en zona horaria `America/Lima`. |
| **Próximo inmediato** | Los próximos 7 días — es lo que se destaca en Home. |
| **Vencido** | Fecha pasada, con la regla de lenguaje heredada: 0-2 días después de la ventana se dice "pendiente"; 3+ días con fecha confirmada se dice "vencido". |
| **Periodo de presupuesto** | Configurable por el usuario: semanal, quincenal o mensual. Por defecto mensual, del día 1 al último día del mes. |

El horizonte de 30 días es una decisión de producto, no una constante
técnica escondida: se declara aquí, se implementa como configuración en
`24_modulo_cuentas_y_cajas.md`, y el usuario puede verlo cuando pregunta de
dónde sale su dinero libre.

## 8. Cómo conviven presupuestos, cajas y compromisos

Tres conceptos que parecen lo mismo y no lo son. La confusión entre ellos es
el riesgo conceptual más grande de la ambición ampliada de V1-web.

| Concepto | Qué es | Efecto sobre el dinero libre |
|---|---|---|
| **Caja** | Dinero real ya separado dentro de una cuenta. | **Sí** — reduce el libre en cuentas. |
| **Compromiso** (deuda, cuota, pago que viene) | Una salida de dinero esperada, todavía no ocurrida. | **Sí, si no está cubierto por una caja** — reduce el dinero libre. |
| **Presupuesto** | Una intención de gasto máximo para una categoría en un periodo. | **No** — es una referencia para comparar, no dinero apartado ni comprometido. |
| **Meta** | Un objetivo de ahorro, normalmente vinculado a una caja. | **Indirectamente** — a través de la caja que la respalda, si existe. |

La regla que evita el error: **un presupuesto no reserva dinero.** Si el
usuario presupuesta S/400.00 en comida, su dinero libre no baja S/400.00. El
presupuesto solo dice "planeé gastar hasta esto"; el gasto real se descuenta
cuando ocurre, como cualquier movimiento.

Si un usuario quiere que ese dinero sí quede apartado, la herramienta
correcta es una caja, no un presupuesto. La app debe saber explicar esta
diferencia cuando el usuario la encuentre por primera vez
(`48_ayuda_explicabilidad_y_soporte.md`).

## 9. Estados incompletos del modelo

El modelo tiene que funcionar cuando faltan datos, porque casi siempre
faltan. Estos son los casos y su comportamiento:

| Situación | Comportamiento |
|---|---|
| Sin cuentas registradas | No se muestra "Dinero libre: S/0.00". Se dice: "Puedo calcular tu dinero libre cuando tenga al menos un saldo." |
| Con cuentas pero sin cajas | Dinero libre = libre en cuentas − compromisos. Sección de cajas con estado vacío informativo. |
| Con cajas pero sin compromisos conocidos | Dinero libre = libre en cuentas. Se muestran iguales, sin inventar una diferencia. |
| Movimiento con cuenta `null` | Se registra y afecta categorías y presupuestos, pero **no** afecta saldos por cuenta. La app lo indica en el detalle del movimiento. |
| Saldo de cuenta desactualizado | Se permite. El usuario puede ajustar el saldo, y ese ajuste queda registrado como movimiento tipo `ajuste`, no como una edición silenciosa. |
| Saldo negativo en una cuenta | Se permite y se muestra con aviso, sin bloquear. La vida real tiene sobregiros. |

## 10. Qué NO hace este modelo

- No cuenta pendientes sin confirmar como dinero movido. Un pendiente no
  afecta ningún saldo (regla no negociable heredada).
- No cuenta transferencias ni asignaciones internas como gasto. Mover dinero
  entre cuentas propias o hacia una caja no reduce el patrimonio.
- No trata la tarjeta de crédito como cuenta con saldo disponible. Vive en
  Deudas.
- No proyecta ingresos que el usuario no declaró.
- No incluye inversiones ni activos no líquidos.

## 11. Criterios de aceptación

- `AC-DINERO-01` — El cálculo del ejemplo de §4 produce exactamente
  S/800.00 / S/580.00 / S/220.00 / S/170.00 en todos los módulos que lo
  exhiban. Evidencia: `TEST`.
- `AC-DINERO-02` — Un compromiso cubierto por una caja con saldo suficiente
  no se descuenta dos veces del dinero libre. Evidencia: `TEST`.
- `AC-DINERO-03` — Un presupuesto no modifica el dinero libre bajo ninguna
  circunstancia. Evidencia: `TEST`.
- `AC-DINERO-04` — El dinero total nunca se presenta como la cifra principal
  de una pantalla de resumen. Evidencia: `DOC` + `USER`.
- `AC-DINERO-05` — Sin cuentas registradas, la app no muestra "S/0.00" como
  dinero libre. Evidencia: `TEST`.
- `AC-DINERO-06` — El desglose completo de las cuatro capas está disponible
  desde cualquier lugar donde se muestre el dinero libre. Evidencia: `TEST` + `USER`.
