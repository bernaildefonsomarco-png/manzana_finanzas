# 11 — Confianza, errores y reversibilidad

**Bloque:** 01 — Producto
**Estado:** V1 (migración con mejoras)
**Fecha:** 25 de julio de 2026
**Depende de:** `08_principios_experiencia_web.md`, `09_modelo_mental_dinero.md`
**Documentos que dependen de este:** §5, §9, §12 y §13 de todos los módulos; `22_grounding_evidencia_y_politica.md`; `48_ayuda_explicabilidad_y_soporte.md`
**Fuentes:** `docs/fase_3_producto/16_confianza_errores.md` (V1.1) — se conserva casi íntegro; se añade la separación entre reparar respuesta y corregir dinero, y el contrato de errores en español

---

## 1. Tesis

Un error financiero destruye confianza más rápido de lo que una función
nueva la construye. La app no evita los errores fingiendo precisión: los
hace visibles, corregibles y reversibles.

> Manzana no necesita tener siempre razón. Necesita que el usuario siempre
> pueda corregirla, y que corregirla sea tan fácil como registrar.

## 2. Las cinco capas de confianza

Todo dato financiero visible debe poder responder al menos las tres primeras.
Los datos importantes deben responder las cinco.

```text
1. Fuente        → ¿de dónde salió este dato?
2. Estado        → ¿confirmado, pendiente, corregido, eliminado, estimado?
3. Impacto       → ¿afecta saldo, caja, deuda, presupuesto, o solo el historial?
4. Control       → ¿puedo corregirlo, deshacerlo, borrarlo, confirmarlo?
5. Explicación   → ¿puedo entenderlo sin recibir el razonamiento interno del sistema?
```

La capa 5 tiene una restricción heredada que sigue vigente: explicar **no**
significa exponer el razonamiento crudo del modelo. Se explica con datos y
reglas ("así clasificaste 8 de tus últimos 10 pedidos"), nunca con la
cadena de pensamiento interna.

## 3. Estados de confianza de un dato

| Estado visible | Significado | ¿Afecta saldos? | Acciones disponibles |
|---|---|---|---|
| Confirmado | El usuario o una regla segura lo aceptó. | Sí, si el tipo aplica. | Editar, corregir, borrar. |
| Por confirmar | Falta aprobación o un dato clave. | **No.** | Confirmar, editar, descartar. |
| Por revisar | Existe el movimiento, pero algún campo es dudoso. | Depende del Core; se muestra el límite. | Revisar el campo señalado. |
| Corregido | Fue cambiado después de registrarse. | Sí, recalcula si aplica. | Ver historial, deshacer si está disponible. |
| Eliminado | Fue borrado con confirmación. | No; su impacto se revierte. | Ver historial, **restaurar**. |
| Estimado | Solo orienta; no es un dato contable. | No. | Completar los datos que faltan. |
| Archivado | Ya no está activo, pero conserva historial. | No. | Ver historial. |

Regla no negociable heredada: **un pendiente nunca se ve como gasto
confirmado ni afecta el dinero libre.**

Novedad respecto al corpus anterior: el estado "Eliminado" ahora ofrece
**restaurar** como acción de primera clase, no solo consultar el registro de
auditoría. La capacidad ya existe en el modelo de datos (migración
`046_movement_restore`) y cierra la contradicción `C-07`.

## 4. Taxonomía de errores

| Tipo | Ejemplo | Respuesta esperada |
|---|---|---|
| Dato faltante | Se registra un gasto sin monto. | Preguntar una sola cosa: el monto. |
| Ambigüedad semántica | "le di 50 a Luis" | Preguntar si fue gasto, préstamo, regalo o pago de deuda. |
| Clasificación dudosa | Taxi personal o de trabajo. | Registrar si es seguro y permitir corregir después. |
| Cuenta desconocida | Pago con un medio que no existe como cuenta. | Registrar con cuenta `null` y sugerir crearla o vincularla. |
| Duplicado probable | El mismo pago detectado por correo y registrado a mano. | Avisar antes de confirmar, con el candidato a la vista. |
| Acción riesgosa | Borrar varios movimientos. | Confirmación explícita que diga exactamente qué se borra. |
| Saldo inconsistente | La cuenta queda negativa. | Permitir con aviso; no bloquear. |
| Correo no interpretable | El banco cambió el formato. | No molestar al usuario con ruido; registrar internamente y monitorear salud del pipeline. |
| Descubrimiento obsoleto | Una corrección cambia la evidencia que lo sustentaba. | Actualizar, expirar o marcar como desactualizado. |
| Importación parcial | 40 filas correctas, 2 ilegibles. | Procesar las 40, dejar las 2 como pendientes. Nunca bloquear el lote entero. |
| Fallo del motor IA | El asistente no puede responder. | Decirlo con honestidad y ofrecer la vía manual. Nunca inventar la cifra. |
| Política bloquea la salida | Modo discreto activo, sin opt-in, horario silencioso. | No enviar, o enviar la versión segura. |

Las tres últimas filas son nuevas: corresponden a la importación, al
asistente y a los canales de salida propios de la app web.

## 5. La distinción crítica: reparar una respuesta ≠ corregir el dinero

Este es el hallazgo P0.6 de la auditoría del 23 de julio, y la app web debe
nacer con la distinción resuelta.

Cuando el usuario dice "eso está mal", puede querer decir dos cosas
completamente distintas:

| Intención | Ejemplo | Qué debe pasar |
|---|---|---|
| **Reparar la respuesta** | "Ese taxi no es alimentación, ¿no?" — el usuario cuestiona cómo el sistema **agrupó o explicó** algo en una respuesta. | Se corrige la respuesta y, si aplica, la clasificación. **No se toca ningún saldo.** |
| **Corregir el dinero** | "El taxi fueron 18, no 15." — el usuario corrige un **hecho financiero**. | Se ejecuta un comando de corrección sobre el Core, se recalculan saldos y se registra en el historial. |

Confundirlas produce dos fallos opuestos y ambos graves: tratar una queja
sobre el fraseo como una corrección financiera altera dinero que estaba
bien; tratar una corrección financiera como un ajuste de respuesta deja el
dato mal para siempre.

Reglas:

1. Son **dos operaciones distintas**, con permisos distintos y registros
   distintos. Nunca comparten el mismo camino de ejecución.
2. Ante duda, la app pregunta una vez, con las dos opciones explícitas.
3. Reparar una respuesta nunca requiere confirmación de riesgo. Corregir el
   dinero sí, cuando el impacto lo justifica.
4. El detalle técnico de cómo el motor distingue ambas intenciones vive en
   `22_grounding_evidencia_y_politica.md`.

## 6. Corrección

Corregir debe ser tan fácil como registrar. En la app web hay tres vías, y
las tres desembocan en el mismo comando del Core:

| Vía | Dónde |
|---|---|
| Edición directa | Detalle del movimiento, deuda, caja o presupuesto. |
| Corrección en lote | Selección múltiple en un listado (recategorizar, etiquetar). |
| Asistente | "el taxi de ayer fueron 18" → propuesta → confirmación. |

Qué aprende el sistema de una corrección: el patrón corregido alimenta la
memoria (`36_modulo_memoria_y_aprendizaje.md`) con evidencia **a favor de la
nueva clasificación y en contra de la anterior**. Esto es una mejora
concreta sobre el comportamiento actual, donde la confianza de un
aprendizaje solo podía aumentar.

## 7. Deshacer, borrar, cancelar, descartar y archivar

Cinco acciones que se confunden con facilidad:

| Acción | Significado | ¿Confirmación? |
|---|---|---|
| **Cancelar** | Detener un flujo activo que aún no persistió nada. | No, si no escribió datos. |
| **Deshacer** | Revertir la última acción dentro de la ventana disponible. | Depende del impacto. |
| **Borrar** | Eliminar o anular un dato ya persistido. | Sí, si afecta dinero o historial. |
| **Descartar** | No aceptar un pendiente. | Simple; no afecta saldos. |
| **Archivar** | Sacar de la vista sin borrar el historial. | Depende del dato. |
| **Restaurar** | Recuperar algo eliminado. | Simple; recalcula el impacto. |

Reglas al borrar:
- Decir exactamente qué se borra, con monto y fecha.
- Nunca borrar varios elementos tras una confirmación ambigua.
- Dejar registro de auditoría siempre.
- Recalcular saldos, presupuestos, deudas, recurrentes y descubrimientos
  afectados.

Reglas al deshacer:
- Si no se puede deshacer automáticamente, decirlo y ofrecer la corrección
  manual. Nunca fingir que se deshizo.
- El deshacer inmediato tras una acción se ofrece como acción en el aviso de
  confirmación (patrón de "deshacer en el toast"), definido en
  `17_patrones_datos_formularios_y_listados.md`.

## 8. Confirmaciones de riesgo

Requieren confirmación explícita con contexto completo:

- Borrar un movimiento confirmado.
- Borrar varios movimientos a la vez.
- Cambiar el tipo financiero de un movimiento ya registrado.
- Cerrar una deuda.
- Eliminar una cuenta o una caja con saldo.
- Deshacer una importación completa.
- Desconectar un buzón de correo.
- Olvidar un aprendizaje de memoria.
- Exportar todos los datos.
- Eliminar la cuenta y todos los datos.

Formato de la confirmación: qué se va a hacer, sobre qué elemento concreto
(con monto y fecha si aplica), qué consecuencias tiene, y si es reversible o
no. El botón de confirmación nombra la acción ("Borrar movimiento"), nunca
dice solo "Aceptar".

## 9. Contrato de mensajes de error

Cierra la contradicción `C-13`, donde `auth-screen.tsx` publica literalmente
`Invalid login credentials` — el mensaje crudo del proveedor, en inglés.

Todo error visible cumple tres condiciones, sin excepción:

| Condición | Regla |
|---|---|
| **En español** | Nunca se propaga el mensaje crudo de Supabase, OAuth, la base de datos ni ningún proveedor externo. |
| **Explica qué pasó** | En términos del usuario, no del sistema. "No pude guardar el movimiento", no "500 Internal Server Error". |
| **Ofrece salida** | Reintentar, corregir un campo señalado, o contactar soporte. Un error sin salida es un callejón. |

Cada módulo declara sus errores con identificador `ERR-<MOD>-NN` en su
sección 13, siguiendo la plantilla de `01_convenciones_y_plantillas.md`.

Ejemplos del contraste:

```text
Incorrecto: Invalid login credentials
Correcto:   El correo o la contraseña no coinciden.
            ¿Olvidaste tu contraseña?

Incorrecto: Error 409: duplicate key value violates unique constraint
Correcto:   Ya tienes un movimiento igual el 14 de julio.
            [Ver el existente]  [Registrar de todas formas]

Incorrecto: Failed to fetch
Correcto:   No pude cargar tus movimientos ahora.
            Tus datos siguen guardados. [Reintentar]
```

## 10. Fallas técnicas y modo degradado

| Tipo de falla | Comportamiento |
|---|---|
| Error de red puntual | Reintento con aviso discreto; los datos anteriores permanecen visibles. |
| Servidor caído | Aviso claro, sin perder el trabajo en curso del formulario. |
| Recálculo en proceso | Se muestran los datos anteriores con indicador de "actualizando", nunca una pantalla vacía. |
| Motor IA no disponible | El asistente lo dice y la app sigue funcionando completa por la vía manual. |
| Detección por correo caída | Silenciosa para el usuario; visible en la salud del pipeline en configuración. |

Regla que atraviesa todas: **nunca mostrar una pantalla vacía cuando existen
datos previos.** Perder de vista el dinero propio por un error transitorio
es una de las peores sensaciones que puede producir una app financiera.

Regla del asistente: si el motor no puede fundamentar una cifra, **no la
emite**. Prefiere decir que no puede responder antes que inventar. Es el
invariante de evidencia de `22_grounding_evidencia_y_politica.md`.

## 11. Fuentes y trazabilidad

Cada movimiento muestra su origen de forma legible:

| Origen interno | Visible |
|---|---|
| `dashboard/manual` | Registrado por ti |
| `import/csv` | Importado el 14 de julio |
| `email/<institución>` | Detectado en tu correo del BCP |
| `assistant` | Registrado con el Asistente |
| `recurring` | Pago que se repite |
| `whatsapp` (fase 2) | Registrado por WhatsApp |

Además del origen, el detalle de cada movimiento muestra su historial de
cambios: qué cambió, cuándo y desde dónde. El registro interno de auditoría
guarda más detalle del que se muestra, pero **nunca guarda el razonamiento
crudo del modelo**.

## 12. Consistencia y datos incompletos

Datos incompletos válidos, que se aceptan sin bloquear:

- Movimiento sin cuenta asignada: afecta categorías y presupuestos, no
  saldos por cuenta. Se indica en el detalle.
- Movimiento sin categoría: `category_id: null` con estado "por revisar".
  No es la categoría "Otros" — son cosas distintas.
- Deuda sin fecha de vencimiento: existe y se sigue, pero no genera avisos
  de vencimiento.
- Cuenta sin saldo inicial: se puede registrar movimientos; el dinero libre
  advierte que falta el saldo.

Regla general: **un dato incompleto es mejor que un dato inventado.** La app
muestra el límite de lo que sabe en vez de rellenar el hueco con una
suposición.

## 13. Recuperación emocional tras un error

Cuando la app se equivoca, la secuencia es: reconocer sin dramatizar,
corregir, confirmar el efecto y seguir.

```text
Correcto:   Corregido. Lo cambié a Uber de trabajo, y lo tendré en cuenta.
Incorrecto: ¡Lo siento muchísimo! Cometí un error grave. Disculpa las molestias.
```

Ni minimizar ni exagerar. El usuario quiere que el dato quede bien, no una
disculpa larga.

## 14. Criterios de aceptación

- `AC-CONFIANZA-01` — Todo dato financiero visible puede responder fuente, estado
  e impacto desde su propio detalle. Evidencia: `TEST` + `USER`. **No cierra en
  `W-07`** (`WEB-D189`): depende de pantallas de detalle reales que ese corte
  no construye (solo su esqueleto de ruta).
- `AC-CONFIANZA-02` — Ningún mensaje de error visible está en inglés ni proviene
  crudo de un proveedor externo. Evidencia: `TEST`. Clase: `unidad`. **Cierra en
  `W-07`** (`WEB-D189`, medido antes de asumir lo contrario): `src/features/auth/auth-screen.tsx`
  ya traduce los mensajes de Supabase vía `toAuthErrorMessage()`, con prueba
  (`auth-screen.test.ts`) que ya existía en el commit base — moverla a `/entrar`
  tal cual (`WEB-D151`) conserva esta traducción intacta.
- `AC-CONFIANZA-03` — Todo error visible ofrece al menos una acción de salida.
  Evidencia: `TEST`. No cierra en `W-07`: depende de pantallas reales con sus
  propios errores; `(app)/error.tsx` sí ofrece salida (botón "Reintentar"),
  pero el criterio pide esto de cada error, no solo del genérico de segmento.
- `AC-CONFIANZA-04` — Reparar una respuesta y corregir un dato financiero son
  operaciones distintas, con registros distintos. Evidencia: `TEST`. No cierra
  en `W-07`: depende del asistente conversacional (`34`, `W-13`).
- `AC-CONFIANZA-05` — Un movimiento eliminado puede restaurarse y su impacto se
  recalcula correctamente. Evidencia: `TEST`. No cierra en `W-07`: el comando
  ya existe (`POST /api/v1/movements/[id]/restore`), pero ninguna pantalla del
  árbol nuevo lo dispara todavía (`W-09`).
- `AC-CONFIANZA-06` — Ante un fallo transitorio, la app nunca muestra una pantalla
  vacía si existían datos previos. Evidencia: `TEST` + `USER`. Clase: `unidad`
  (la parte `TEST`). `src/shared/data/optimistic-mutation.test.tsx` (`W-07`):
  un `refetch` fallido conserva el dato anterior visible, con aviso de error,
  en vez de una pantalla vacía. El `USER` no cierra (`WEB-D149`).
- `AC-CONFIANZA-07` — El asistente nunca emite una cifra que no pueda fundamentar.
  Evidencia: `TEST`. No cierra en `W-07`: depende del asistente (`34`, `W-13`).
- `AC-CONFIANZA-08` — Toda acción de la lista de §8 exige confirmación explícita
  que nombra el elemento concreto afectado. Evidencia: `TEST`. No cierra en
  `W-07`: depende de confirmaciones reales sobre elementos concretos (borrar
  un movimiento, cerrar una deuda) que sus pantallas de módulo no construyen
  todavía; `AlertDialog` (`W-06`) ya exige título+descripción, pero no
  "nombrar el elemento concreto" sin un llamador real.
