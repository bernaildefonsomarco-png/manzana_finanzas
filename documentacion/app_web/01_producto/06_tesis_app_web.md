# 06 — Tesis de la aplicación web

**Bloque:** 01 — Producto
**Estado:** V1 (reescritura)
**Fecha:** 25 de julio de 2026
**Depende de:** `02_mapa_herencia_corpus_legacy.md`, `03_decisiones_producto_web.md`
**Documentos que dependen de este:** `07_alcance_web_v1.md`, `08_principios_experiencia_web.md`, y todo `04_modulos/`
**Fuentes:** `docs/fase_1_identidad/01_user_personas.md` (reutilizada), `docs/fase_2_estrategia/alcance_v1/05c_dashboard.md` §1 y §22 (usada como antítesis), `especificacion_producto_finanzas_personales_ia.md` §5

---

## 1. La tesis que se invierte

El corpus anterior definió el Dashboard así:

> "El Dashboard de Manzana no debe competir con WhatsApp como canal
> principal de registro."
> — `docs/fase_2_estrategia/alcance_v1/05c_dashboard.md` §1

> "Su trabajo no es capturar más rápido que WhatsApp."
> — `docs/fase_2_estrategia/alcance_v1/05c_dashboard.md` §22

Esa definición era coherente con un producto cuyo cerebro vivía en WhatsApp.
Pero produjo tres consecuencias que hoy son medibles:

1. La app se especificó como **capa de revisión**, no como producto. Su
   ambición se definió por lo que *no* debía hacer.
2. `05c_dashboard.md` §15 prohibió que la IA escriba desde la app: la
   búsqueda natural quedó read-only por decreto. Toda la inteligencia
   interactiva (2.815 líneas de especificación de motor IA) se asignó a
   WhatsApp.
3. `05c_dashboard.md` §20 dejó fuera de V1 presupuestos, metas, proyecciones,
   reportes, exportaciones y gráficos — es decir, casi todo lo que una
   persona espera de una aplicación de finanzas personales en la web.

**La tesis nueva:**

> La aplicación web de Manzana es el producto completo. Registra, entiende,
> proyecta, explica y acompaña por sí sola. WhatsApp, cuando llegue, será
> otro canal sobre el mismo cerebro — no el cerebro.

Esto no degrada a WhatsApp. Al contrario: construir primero el motor
agnóstico de canal es lo que permitirá que WhatsApp sea un canal completo y
no un intérprete de comandos atornillado por un costado.

## 2. Qué es la aplicación web

Una inteligencia financiera personal que funciona en el navegador y que
resuelve cuatro trabajos, en este orden de importancia:

| # | Trabajo | Pregunta del usuario |
|---|---|---|
| 1 | **Saber dónde estoy** | ¿Cuánto tengo realmente disponible, después de lo que ya está comprometido? |
| 2 | **Registrar sin que duela** | ¿Cómo anoto lo que gasté sin que se sienta contabilidad? |
| 3 | **Entender qué pasa** | ¿En qué se me está yendo? ¿Qué cambió? ¿Por qué? |
| 4 | **Decidir hacia adelante** | ¿Puedo permitirme esto? ¿Cómo voy con lo que planeé? ¿Qué viene? |

El corpus anterior cubría bien los trabajos 1 y 3, parcialmente el 2, y no
cubría el 4 en absoluto. El trabajo 4 es lo que convierte un registro de
gastos en una herramienta por la que alguien paga.

## 3. Qué NO es

- **No es un libro contable.** No busca que cada centavo cuadre. Busca
  claridad utilizable a partir de datos imperfectos. Este principio, heredado
  de `especificacion_producto_finanzas_personales_ia.md` §5, sigue intacto.
- **No es un panel de métricas.** Los números sin decisión asociada son ruido.
  Cada cifra que la app muestra debe habilitar una acción o una comprensión.
- **No es un coach financiero que regaña.** El principio de cero culpa se
  mantiene: la app describe cambios, no juzga comportamiento.
- **No es un asistente autónomo con acceso al dinero.** El asistente propone,
  el usuario confirma, el Core escribe. Sin excepción (`WEB-D013`).
- **No es una app que exige configuración completa antes de servir.** El uso
  parcial sigue siendo válido: alguien que solo usa deudas, o solo registra
  gastos, debe recibir valor real.

## 4. Por qué alguien pagaría por ella sin WhatsApp

Esta es la pregunta que el corpus anterior nunca tuvo que responder, porque
el producto se vendía por el canal. Ahora hay que responderla.

| Razón | Qué la sostiene |
|---|---|
| **Sabe cuánto puede gastar de verdad** | La distinción entre dinero total, libre en cuentas y dinero libre operativo (compromisos ya descontados) es el diferencial más concreto frente a cualquier app que solo muestra un saldo. Ver `09_modelo_mental_dinero.md`. |
| **Aprende y se lo puede explicar** | La app recuerda cómo el usuario clasifica sus comercios y hábitos, y puede mostrar la evidencia de cada cosa que aprendió — con la opción de corregirla u olvidarla. Casi ninguna app financiera ofrece control sobre lo que infirió. |
| **Captura sin fricción real** | Detección bancaria por correo (Yape, bancos) con confirmación, importación de extractos, registro rápido en una línea. El registro manual puro es la razón #1 de abandono; atacarlo es condición de supervivencia. |
| **Proyecta, no solo reporta** | "¿Puedo permitirme esto?" respondido con los compromisos reales del usuario, no con un promedio genérico. |
| **Se le puede preguntar en español** | El asistente conversacional dentro de la app permite consultar, registrar y corregir hablando, sin aprender la interfaz. |
| **No usa sus datos en su contra** | Sin publicidad, sin scoring crediticio, sin venta a terceros. Heredado de `docs/fase_5_proteccion/24_privacidad_proteccion_datos.md`. |

## 5. Para quién

Se conservan los tres arquetipos conductuales de
`docs/fase_1_identidad/01_user_personas.md`, que son de comportamiento y no
demográficos, y por eso sobreviven al cambio de canal. Lo que cambia es el
punto de entrada.

| Arquetipo | Dolor principal | Qué le da la app web |
|---|---|---|
| **El que siente que la plata se le va** | No sabe en qué se va; gastos pequeños frecuentes. | Captura sin fricción + categorías que se aprenden solas + descubrimientos concretos sobre qué cambió. |
| **El que tiene compromisos que recordar** | Cuotas, deudas informales, suscripciones; miedo a que algo se le pase. | Deudas como entidad propia, pagos que vienen, recordatorios configurables sin invadir. |
| **El que quiere ordenarse sin Excel** | Intentó hojas de cálculo y las abandonó; quiere estructura sin trabajo manual. | Presupuestos y metas ligeros, proyecciones, reportes y exportación cuando los necesita. |

**Anti-usuario:** quien busca contabilidad formal, facturación, gestión de
negocio, inversiones o asesoría tributaria. Todo eso sigue explícitamente
fuera de alcance.

**Cambio respecto al corpus anterior:** las tres personas originales entraban
al producto *por WhatsApp*. Ninguna tenía un recorrido "llego por la web,
me registro y obtengo valor el primer día". Ese recorrido es ahora el
principal y se especifica en `44_onboarding_web.md`.

## 6. La promesa emocional

Se conserva sin cambios, porque es independiente del canal:

```text
Tu dinero explicado como si alguien realmente te conociera.
```

Y el movimiento que la app debe producir en la persona:

```text
de confusión         → a claridad
de culpa             → a alivio
de desorden          → a patrón visible
de ansiedad          → a un siguiente paso pequeño
```

## 7. La definición de "wow" (heredada, sin cambios)

`wow` no es espectáculo, animación ni IA intentando impresionar:

```text
wow = espejo personal + verdad concreta + alivio emocional + siguiente paso pequeño
```

Ejemplo correcto:

```text
Tu gasto no subió por todo. Subió sobre todo por transporte:
fueron S/75 más que la semana pasada.
```

Es específico, reduce ruido, no culpa, y permite actuar.

**Regla que sí cambia:** en el corpus anterior el primer "wow" se activaba a
los 5 movimientos confirmados y los patrones temporales exigían 40+
movimientos y 4 semanas de datos. Esos umbrales asumían captura sin fricción
por WhatsApp. En una app web con registro manual, esperar 4 semanas significa
un mes sintiendo que el producto no hace nada.

La solución, diseñada en `34_modulo_descubrimientos_e_insights.md` §6, **no
fue rebajar los umbrales**: fue descubrir que sobraban para la mayoría de los
casos. Buena parte de lo que se le puede decir a alguien sobre su dinero sale
de lo que **esa persona ya declaró** —un presupuesto, una deuda, un
compromiso, una caja— y eso no necesita ningún historial. Los umbrales
inferenciales se mantienen donde son honestos (un patrón temporal sigue
necesitando cuatro semanas, porque con menos sería falso), pero dejan de
gobernar la experiencia. Ver también
`47_ciclo_de_vida_del_dato_y_estados_vacios.md`.

## 8. Qué debe ser cierto para que la tesis se sostenga

Condiciones de verdad, verificables, que los documentos siguientes deben
garantizar. Si alguna falla, la app vuelve a ser un CRUD bonito:

1. Un usuario nuevo obtiene una respuesta útil sobre su dinero **el primer
   día**, no a las cuatro semanas.
2. Registrar un movimiento cuesta menos de 10 segundos por al menos una vía
   (registro rápido, importación, detección por correo o asistente).
3. Toda cifra que la app muestra puede explicar de dónde sale.
4. Todo lo que la app aprendió se puede ver, corregir, deshacer y olvidar.
5. Ninguna operación sobre dinero ocurre sin confirmación explícita.
6. El usuario puede irse con sus datos (exportación completa) sin pedir
   permiso a nadie.
7. La app es utilizable con el teclado y con lector de pantalla.
8. Cada pantalla tiene una URL propia que se puede compartir y a la que el
   botón "atrás" del navegador responde correctamente.

La condición 8 parece menor y no lo es: hoy la app entera vive en
`src/app/page.tsx` con navegación por `?view=`, sin URLs reales ni historial
de navegación. Se corrige en `10_sitemap_rutas_y_navegacion.md`.

## 9. Relación con la fase WhatsApp

WhatsApp sigue siendo el producto principal de la visión de largo plazo. Lo
que cambia es el orden de construcción y la arquitectura:

| Antes | Ahora |
|---|---|
| WhatsApp es el cerebro; la app es la capa de revisión. | El motor es el cerebro; la app y WhatsApp son canales sobre él. |
| La app no puede escribir con IA. | La app tiene asistente completo; WhatsApp heredará el mismo. |
| La inteligencia conversacional vive acoplada al canal. | El canal es un adaptador de entrada/salida (`21_contrato_de_canal_y_presentadores.md`). |

El compromiso concreto que este corpus asume: cuando WhatsApp entre, no debe
requerir reescribir el motor. Entra implementando un puerto de canal y un
presentador. El checklist de lo que queda listo para ese momento vive en
`56_puente_a_fase_whatsapp.md`.

## 10. Criterios de aceptación de esta tesis

- `AC-TESIS-01` — Ningún documento del corpus define una capacidad de la app
  web por contraste con WhatsApp ("no debe competir con", "no tan rápido
  como"). Evidencia: `DOC`.
- `AC-TESIS-02` — Los cuatro trabajos de §2 tienen al menos un módulo
  asignado en `07_alcance_web_v1.md`. Evidencia: `DOC`.
- `AC-TESIS-03` — Las ocho condiciones de verdad de §8 tienen documento
  responsable asignado y criterio de aceptación propio. Evidencia: `DOC`.
- `AC-TESIS-04` — Un usuario nuevo real obtiene una respuesta útil sobre su
  dinero en su primera sesión. Evidencia: `USER`.
