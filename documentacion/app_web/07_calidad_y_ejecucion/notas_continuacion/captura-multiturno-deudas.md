# Continuación: capacidad general de captura multi-turno (no solo deudas)

## Contexto para quien retome esto

Manzana (finanzas personales, Next.js + Supabase, desplegada en
`https://manzana.website` vía `vercel --prod`; el repo local no tiene
remoto de git, así que "desplegar" es literalmente correr ese comando
desde el checkout local) terminó su plan de implementación web (los 20
"cortes" de `54_plan_de_implementacion_web.md`) y recién está pasando por
pruebas reales de usuario en producción — que es exactamente lo que
`55c_w20_checklist_g3.md` dejó pendiente a propósito: una lista de
criterios `USER` que el autor del código no puede autodeclarar
(`RUL-HECHO-05`). Este documento nace de la primera prueba real: pedirle
al asistente que registre una deuda por chat, algo que la doc especifica
como soportado en un solo mensaje y que en la práctica se rompe.

**No conviertas esto en un parche de "deudas" nada más.** El pedido
explícito de quien abre esta continuación es: el problema es que la
capacidad de *captura multi-turno* (recordar entre un mensaje y el
siguiente qué datos ya dio el usuario) está construida ad hoc para el
caso de movimientos simples, y cualquier otra intención financiera que
necesite más de un mensaje para completarse va a tropezar con el mismo
hueco — deudas hoy, lo próximo que se pruebe mañana. La tarea es evaluar
si vale la pena generalizar el mecanismo antes de tocar el caso de
deudas específicamente.

## Reproducción exacta

Conversación real en producción (capturada en captura de pantalla, no
inventada):

1. Usuario: "puedes registrarme una deuda porfa?"
2. Asistente: "Sí, puedo ayudarte con la deuda. Para continuar, dime
   solo: ¿cuál es el monto y quién te debe o a quién le debes? Aún no se
   ha registrado ni confirmado ninguna operación."
3. Usuario: "le debo 5 soles a mi amigo fabrizio"
4. Asistente: "Todavía no. No se registró ni confirmó ninguna operación.
   Para continuar con la deuda de Fabrizio, dime solo el monto y si él
   te debe a ti o tú le debes a él." — **ya había monto y persona en el
   mensaje anterior; los volvió a pedir.**
5. Usuario: "le debo 5 soles yo a el"
6. Asistente cae al mensaje genérico: "Te entendí, pero no lo registré
   todavía: me falta un dato para hacerlo sin asumir. Escríbeme algo
   como: 'gasté 20 en desayuno'." — **el ejemplo es de un gasto, no de
   una deuda; señal de que en este punto el sistema ya perdió el hilo de
   que se trataba de una deuda.**

## Qué dice la documentación (la especificación, no una interpretación)

- `documentacion/app_web/04_modulos/31_modulo_deudas.md` §14.3 —
  ejemplo explícito: `"le debo 200 a mi hermano"` → `crear_deuda`
  (informal, a deber), con confirmación de "Tarjeta con previsualización
  de cuotas". No dice que necesite tres turnos para un caso tan simple.
- `documentacion/app_web/03_motor_ia/20_arquitectura_motor_conversacional.md`
  — `AC-MOTOR-10`: "Cualquier cosa que se pueda hacer en la interfaz se
  puede pedir hablando." Protocolo `USER` en
  `55c_w20_checklist_g3.md`.
- `55c_w20_checklist_g3.md` — `AC-CUENTAS-18`: "El asistente puede
  ejecutar los 12 comandos de §14.2 con confirmación." También `USER`,
  nunca verificado con un usuario real hasta ahora.

## Lo que confirmé en el código (rastreado de punta a punta, no supuesto)

La cadena real es: `src/agents/data-agent/` (extrae la intención del
texto) → `src/core/orchestrator/capture-draft-memory.ts` (decide qué
recordar y qué falta entre turnos) → `src/core/orchestrator/financial-orchestrator.ts`
(orquesta el turno completo) → `src/core/response/response-planner.ts`
(compone el texto que ve el usuario).

1. **El esquema y el prompt real sí soportan crear una deuda en un
   mensaje.** `src/agents/data-agent/types.ts` (`DebtHintSchema`) tiene
   `operation: "create_debt"`, `direction`, `person_name`,
   `installment_count`, `first_due_date`. El prompt real (no el fixture
   de pruebas) en `src/agents/runtime/openai-agent-runtime.ts:362` ya le
   instruye al modelo exactamente cuándo usar
   `debt_hint.operation=create_debt`. Este no parece ser el punto roto.

2. **El hueco real: `getCaptureDraftMissingFacts` en
   `src/core/orchestrator/capture-draft-memory.ts:283-309`.** Esta
   función decide qué campos declarar como "faltantes" para el próximo
   turno. Hoy solo sabe de tres cosas: `amount` (universal),
   `description` (universal) y `debt_reference` — pero esta última
   **solo se activa cuando `movement_type === "pago_deuda"`** (pagar una
   deuda que ya existe). No hay ninguna rama para
   `debt_hint?.operation === "create_debt"`: nunca declara que falta la
   `direction` (¿tú le debes o él te debe?) ni el `person_name`, aunque
   el usuario ya los haya dado.

3. **No hay merge estructurado entre turnos, solo texto crudo.** En
   `financial-orchestrator.ts` (alrededor de la línea 1656-1705), lo que
   se le pasa al siguiente paso de planificación es el
   `captureDraft.original_message` (el texto crudo del primer mensaje) y
   la lista de `missing_facts` (strings), **no** los valores ya
   extraídos (`debt_hint.person_name`, `debt_hint.direction`, etc.) del
   turno anterior. Para movimientos simples esto puede funcionar porque
   el modelo re-lee el mensaje original completo y vuelve a extraer
   todo; para una conversación de varios turnos sobre una deuda, cada
   turno nuevo compite con — o reemplaza a — lo ya dicho, en vez de
   acumularlo con garantía.

4. **Cero cobertura de pruebas para este caso.** Existen tests unitarios
   para piezas sueltas (`data-agent.test.ts`,
   `data-action-executor.test.ts`, `data-action-policy.test.ts`,
   `conversational-executive-agent.test.ts`) que sí mencionan
   `create_debt`, pero corren contra el `local-fixture-runtime` (el
   modelo de prueba), no contra el modelo real, y ninguno prueba una
   conversación de *varios turnos* acumulando una deuda.
   `capture-draft-memory.test.ts` solo tiene una mención de `debt_hint`
   y es un valor `null` de relleno — no hay ninguna prueba de
   acumulación multi-turno para deudas ni para nada más.

## La pregunta de diseño que hay que resolver antes de escribir código

`getCaptureDraftMissingFacts` hoy es una función con reglas cableadas a
mano por tipo de movimiento (`amount`, `description`, y el caso especial
de `pago_deuda`). Agregarle un `if (operation === "create_debt")` más
sería exactamente el parche que no se quiere. Antes de tocar código,
vale la pena decidir con el usuario:

- **Opción A — generalizar de verdad:** que cada tipo de acción
  financiera (movimiento simple, pago de deuda, *crear* deuda, y lo que
  venga después: metas, reglas recurrentes por chat, etc.) declare sus
  propios campos obligatorios y cómo verificarlos, y que
  `getCaptureDraftMissingFacts` — y el merge entre turnos — lean esa
  declaración en vez de tener una rama por caso. Esto es más trabajo
  ahora pero evita que este mismo bug reaparezca con la próxima
  intención nueva.
- **Opción B — arreglar el caso de deudas ahora, dejar la
  generalización documentada como deuda técnica explícita** (en
  `53_deuda_tecnica_y_saneamiento.md`, si no está ya) para no bloquear
  otras pruebas de usuario mientras tanto.

No asumas cuál prefiere el usuario — pregúntale antes de empezar a
escribir código. Lo que sí es no negociable: si se elige la opción B,
**declarar explícitamente en el ledger o en `53`** que la generalización
quedó pendiente, para que no se pierda como este mismo hueco se perdió
la primera vez.

## Disciplina de verificación de este proyecto (no te la saltes)

- `RUL-HECHO-02`: antes de confiar en que un test nuevo prueba lo que
  dice probar, revértelo y confirma que falla primero.
- `RUL-HECHO-05`: el autor del código no puede autodeclarar un criterio
  `USER`/`METRIC` como cerrado. Las pruebas unitarias contra
  `local-fixture-runtime` no cierran `AC-CUENTAS-18` ni `AC-MOTOR-10` —
  solo una conversación real, de varios turnos, contra el modelo real
  desplegado, lo hace. Después de programar el arreglo, pide al usuario
  que repita la conversación exacta de la sección "Reproducción exacta"
  contra `https://manzana.website` antes de dar esto por cerrado.
- El despliegue es manual: `git add`/`commit` local (sin remoto) y
  luego `vercel --prod` desde el checkout. Los logs en vivo se revisan
  con `vercel logs manzana.website --json` (más fácil filtrar con
  `grep` sobre el JSON que con la tabla por defecto).
- Contexto de la sesión anterior, por si el patrón se repite: se
  encontraron y arreglaron dos bugs de permisos de base de datos en el
  mismo canal del asistente web (`src/core/assistant/handle-web-turn.ts`)
  — `external_event_log` y el motor completo (`FinancialOrchestrator`)
  solo conceden acceso a `service_role`, no al cliente del usuario
  autenticado; el canal de WhatsApp ya lo hacía bien, el canal web no.
  Si aparece un error 500 nuevo en este mismo archivo, revisa primero si
  es el mismo patrón (una tabla nueva sin grant para `authenticated`)
  antes de asumir que es otra cosa.
