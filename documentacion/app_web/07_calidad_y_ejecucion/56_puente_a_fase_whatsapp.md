# 56 — Puente a la fase WhatsApp

**Bloque:** 07 — Calidad y ejecución
**Alcance:** V1 · cierra el corpus de la app web
**Fecha:** 26 de julio de 2026
**Docs fuente:** `02` (herencia legacy), `21` (contrato de canal), `52` (veredictos), `54` (los veinte cortes)
**Documentos que dependen de este:** los de `documentacion/whatsapp/`, cuando exista

---

## 1. Qué cierra y qué abre

Este es el último documento del corpus de la app web. Hace tres cosas:

1. Declara **qué queda listo** para la fase 2 al cerrar `W-20`.
2. Declara **qué documentos de `docs/` se descongelan** y cuáles no.
3. Declara **qué no se ha resuelto** y la fase 2 tendrá que resolver.

`WEB-D001` separó el producto en dos fases: primero una app web completa y
vendible sin WhatsApp, después WhatsApp como canal conversacional sobre el
mismo motor. Este documento es la costura entre las dos.

**No planifica la fase 2.** Un plan escrito hoy para un trabajo que empieza
después de veinte cortes sería ficción, y este corpus ya sabe lo que pasa
cuando se documenta desde una tesis y no desde la realidad.

---

## 2. Qué queda listo

### 2.1 El motor, agnóstico de canal y probado

Es lo que hace posible la fase 2, y no es un subproducto: es una decisión que
se tomó al principio y se sostuvo durante cincuenta documentos.

| Qué | Dónde se construyó |
|---|---|
| Diez bloques neutrales de canal | `21` |
| Prueba de agnosticismo con siete casos | `21`, cerrada en `W-04` |
| El canal fuera del núcleo, con test que lo impide | `WEB-D105`, `WEB-D162`, `AC-INV-04` |
| Evidencia por construcción: ninguna cifra sin `evidence_refs` | `22` |
| Los 99 comandos con su nivel de confirmación | `40` |
| Capa semántica y consulta abierta | `20b` |
| Perfil del usuario y voz | `20c` |

Un presentador de WhatsApp consume los mismos bloques que el presentador web.
Si al escribirlo hay que tocar el motor, el diseño falló y el test lo dirá.

### 2.2 El código que la fase 2 hereda intacto

El `52` marcó como REUTILIZAR-aislado todo lo de WhatsApp, y `WEB-D160` lo
sacó de la suite web sin borrarlo.

| Qué | Líneas | Estado |
|---|---|---|
| `src/adapters/whatsapp/` | 2.639 | Intacto |
| `whatsapp-delivery.repository.ts` | 723 | Intacto |
| `whatsapp-window.repository.ts` | 360 | Intacto |
| Scripts de humo de WhatsApp | 11 ficheros | Fuera de CI, sin borrar |
| Migraciones `010`, `011`, `029` | 273 | Aplicadas |

**Y una corrección al `README.md` que importa aquí más que en ningún sitio.**
Decía *"adapters/whatsapp (reservado; sin implementación aún)"* sobre 2.639
líneas implementadas (`53` §4). Quien planifique la fase 2 leyendo eso
concluiría que hay que empezar de cero.

### 2.3 El proceso

Se hereda entero porque el problema que resuelve es del proceso, no del canal:

- Los tres portones y la definición de "hecho" (`49` §4).
- Los estados de criterio y la matriz generada (`50`).
- Las ocho clases de prueba y el árbol de decisión (`51` §4).
- Los cuatro veredictos de código (`WEB-D161`).
- El registro de tokens (`WEB-D143`).
- Los protocolos de `USER` y `METRIC` (`WEB-D149`, `WEB-D150`).
- Los tres mecanismos anti-parada del ledger (`55` §5).

---

## 3. Qué se descongela

`docs/` quedó congelado por `WEB-D007`. Siete de sus 54 documentos están
clasificados `CONGELAR-WHATSAPP` en `02`, y son los que la fase 2 abre.

| Documento | Qué contiene | Cuánto sirve |
|---|---|---|
| `05a_whatsapp.md` | Comandos, ventana de 24 h, modo conversacional | **Se relee entero, no se hereda.** Su tabla de proactivos "activados por defecto" contradice `RUL-NOTIF-04` y ya se cerró como `C-17` |
| `21_decision_whatsapp_provider.md` | Elección de proveedor | Vigente si el proveedor no cambió |
| `24_paquete_identidad_meta.md` | Identidad pública para verificación de Meta | Vigente. Las cinco páginas legales existen y `45` las mantiene |
| `11_personalidad_conversacion.md` | Matriz de tono, cuándo responder corto | **Parcialmente superado** por `20c`, que diseñó la voz sin canal |
| `15_retencion_lifecycle.md` | Ciclo de vida y retención | Se relee contra `WEB-D131`, que prohibió las campañas |
| `19_agent_runtime_tools.md` | Runtime de agentes y herramientas | **Superado** por `23` y por `20b`, que eliminó el enum cerrado de tools |
| `05j_nudges.md` | Nudges y fatiga | Su lógica de fatiga ya se reutilizó en `37`; lo que queda congelado es la parte de canal |

**Descongelar no es heredar.** Cuatro de los siete están total o parcialmente
superados por decisiones de este corpus, y el que peor envejeció es
`05a_whatsapp.md`: contiene la tesis que `WEB-D001` invirtió.

**`RUL-PUENTE-01` — Un documento descongelado se relee contra el decision log
antes de usarse.** Las 170 decisiones de `03` se tomaron después de que esos
siete documentos se escribieran, y varias los contradicen de frente.

---

## 4. Qué NO se descongela

`05c_dashboard.md` sigue congelado y **no se descongela nunca**. Su §1 declara
que el Dashboard no debe competir con WhatsApp como canal de registro, su §15
prohíbe que la IA escriba desde la app y su §20 deja fuera presupuestos,
proyecciones, reportes y exportación.

Ese documento es la causa raíz que abrió este corpus. Descongelarlo en la fase
2 sería reintroducir la tesis que cincuenta documentos invirtieron.

Lo mismo para los otros diez `REESCRIBIR`: ya tienen sucesor en
`documentacion/app_web/`, y el sucesor gana.

---

## 5. Lo que la fase 2 tendrá que resolver

Cinco cosas que este corpus dejó fuera **a propósito**, con la razón.

### 5.1 El presentador de WhatsApp

`21` define el contrato y el presentador web lo implementa. El de WhatsApp no
existe y no se diseñó: hacerlo sin un canal real delante habría producido
exactamente el tipo de documento que este corpus tuvo que reescribir.

Lo que sí está fijado: **el presentador convierte bloques, no decide.** Si
necesita saber algo que el bloque no lleva, falta información en el bloque, no
en el presentador.

### 5.2 La ventana de 24 horas

Es la restricción que más forma da al producto en WhatsApp y **no tiene
equivalente en web**. Ningún documento de este corpus la modela, y modelarla
desde aquí habría sido diseñar contra una API que nadie ha vuelto a mirar.

### 5.3 La identidad entre canales

Una persona con cuenta web que escribe por WhatsApp es la misma persona. Cómo
se vinculan las dos identidades —y qué pasa si alguien escribe desde un número
que no está vinculado— es trabajo de la fase 2. `43` cubre auth web; no cubre
esto.

### 5.4 Los recordatorios que salen por WhatsApp

`37` diseñó la bandeja in-app y `46` el correo. Los diez tipos, la fatiga, el
horario silencioso y el consentimiento por tipo se heredan tal cual; lo que
falta es el tercer canal, con su propia ventana y sus propias plantillas.

`RUL-NOTIF-04` ya lo cubre por adelantado: **ningún canal que interrumpa viene
activado.** WhatsApp entra apagado.

### 5.5 Qué pasa con `e2e`

La clase `e2e` de `51` no aplica a un canal sin navegador. Se sustituye por
pruebas de conversación completa contra un presentador de prueba, y **la prueba
de agnosticismo del `21` pasa a ser el criterio que valida que el motor no se
enteró del cambio**.

---

## 6. Cómo nace `documentacion/whatsapp/`

Hermana de `app_web/`, mismo padre, mismo patrón (`WEB-D007`).

```text
documentacion/
├── app_web/        cerrado al terminar W-20
└── whatsapp/       nace aquí
```

**`RUL-PUENTE-02` — El corpus de WhatsApp no reescribe lo que el de la app web
ya decidió.** Si necesita cambiar una decisión, la cambia en
`03_decisiones_producto_web.md` con una entrada nueva, no con una decisión
paralela en otro archivo. Dos decision logs son dos productos.

**`RUL-PUENTE-03` — El registro de tokens es uno solo.** Los tokens de la fase
2 se añaden a `50` §2, que sigue siendo la fuente única. Un `SCR-` de WhatsApp
y uno web no pueden colisionar, y ya sabemos lo que cuesta cuando colisionan:
46 identificadores ambiguos entre dos módulos (`49` §3.1).

**`RUL-PUENTE-04` — La matriz añade columna de canal, no se duplica.** Las
filas de `SCR-` web quedan marcadas como no aplicables al canal WhatsApp, sin
borrarse. La prueba de agnosticismo necesita que las dos columnas existan a la
vez.

---

## 7. El corpus queda cerrado

**Cincuenta y nueve documentos**, escritos entre el 25 y el 26 de julio de
2026: los numerados `00` a `56`, más `20b` y `20c`, que amplían el `20` y
conservan su número por el mismo criterio con el que el corpus anterior usó
`23b`.

| Bloque | Documentos |
|---|---|
| `00_gobierno/` | 6 |
| `01_producto/` | 6 |
| `02_fundaciones/` | 8 |
| `03_motor_ia/` | 6 |
| `04_modulos/` | 16 |
| `05_asistente/` | 3 |
| `06_transversales/` | 6 |
| `07_calidad_y_ejecucion/` | 8 |
| **Total** | **59** |

Las cifras vivas —identificadores, criterios, portones— están en `50` §3, que
es el único censo del corpus.

### 7.1 Las diecisiete contradicciones

`C-01` a `C-17` quedaron todas con destino asignado en `05`. Las que se
cerraron con un mecanismo verificable —y no con una promesa— son las que
cuentan: `C-03` con el catálogo generado, `C-04` con un resolvedor único,
`C-05` con los once tipos guardables, `C-13` con el mapeo por código,
`C-14` y `C-16` con tests sobre el texto publicado, `C-17` con el
consentimiento por tipo.

### 7.2 Lo que este corpus aprendió sobre sí mismo

Cinco veces apareció el mismo defecto, en cinco sitios distintos, y ninguna
se resolvió pidiendo más cuidado:

| Dónde | Dos listas que divergieron |
|---|---|
| `C-03` | El catálogo de tools contra las §14 de los módulos |
| `C-14`, `C-16` | Las páginas legales contra el producto |
| `50` §5.3 | El mapa de rutas contra las §8 de los módulos |
| `WEB-D163` | Dos ramas de migraciones |
| `02` §10 | El resumen de clasificaciones contra su propia tabla |

Las cinco se cierran igual: **la lista derivada se genera y un test falla si
diverge.** Es, con diferencia, la lección más transferible de todo el corpus, y
la fase 2 la hereda antes que cualquier decisión de producto.

---

## 8. Criterios de aceptación

- `AC-PUENTE-01` — Al cerrar `W-20`, la prueba de agnosticismo del `21` pasa.
  Evidencia: `TEST`.
- `AC-PUENTE-02` — Ningún documento descongelado se usa sin relectura contra
  el decision log. Evidencia: `DOC`.
- `AC-PUENTE-03` — `05c_dashboard.md` no se descongela. Evidencia: `TEST`.
  Clase: `corpus`.
- `AC-PUENTE-04` — Existe un solo decision log y un solo registro de tokens
  entre las dos fases. Evidencia: `TEST`. Clase: `corpus`.
- `AC-PUENTE-05` — El código de WhatsApp llega a la fase 2 sin modificaciones
  hechas durante la fase web. Evidencia: `DOC` (historial de git).
- `AC-PUENTE-06` — El `README.md` describe `adapters/whatsapp/` como
  implementado. Evidencia: `TEST`. Clase: `lint`.
- `AC-PUENTE-07` — Las filas de `SCR-` web quedan marcadas como no aplicables
  al canal WhatsApp, sin borrarse. Evidencia: `TEST`. Clase: `corpus`.

---

## 9. Trazabilidad

| Elemento | Origen |
|---|---|
| Separación en dos fases | `WEB-D001` |
| Congelamiento de `docs/` | `WEB-D007`, `docs/AVISO_CORPUS_HISTORICO.md` |
| Clasificación de los 54 legacy | `02` |
| Contrato de canal y prueba de agnosticismo | `21` |
| Canal fuera del núcleo | `WEB-D105`, `WEB-D162` |
| Código de WhatsApp aislado | `WEB-D160`, `52` §10 |
| Ningún canal que interrumpa viene activado | `RUL-NOTIF-04`, `C-17` |
| Prohibición de campañas | `WEB-D131` |
| Registro de tokens | `WEB-D143`, `50` §2 |
| Las cinco listas que divergieron | `C-03`, `C-14`, `C-16`, `50` §5.3, `WEB-D163`, `02` §10 |
