# 📱 Feature 1: WhatsApp Conversacional Inteligente

**Parte del Paso 5/20 — Alcance V1.0**  
**Prioridad:** P0  
**Última actualización:** 14 de Mayo, 2026

---

## Filosofía

> **WhatsApp no es un canal secundario. Es la interfaz conversacional principal de Manzana.** La IA no tiene límite de mensajes. Es conversacional e inteligente. Su objetivo es **entender al usuario**, no terminar rápido. Pero tampoco es redundante — reduce fricción, no la crea.

---

## Principios de conversación

| Principio | Significado |
|---|---|
| **Sin límite artificial de mensajes** | La conversación dura lo que necesite |
| **Prioriza entender, no asumir** | Si hay duda, pregunta. Pero una vez, no tres |
| **No ser redundante** | Si el usuario dijo "gasté 15 en taxi", no pidas confirmación |
| **Ser proactivo** | Si detecta patrón, lo menciona |
| **Adaptarse al estilo del usuario** | Algunos envían mensajes largos, otros cortos |
| **Nunca ocultar errores financieros** | Si algo sale mal, resolver con mínima fricción pero sin esconder. "Creo que registré esto mal. ¿Lo corregimos?" |
| **Tono personalizado** | Aprende si el usuario es formal o informal (ligado a `docs/fase_3_producto/11_personalidad_conversacion.md`) |

---

## Tipos de interacción

### Registros directos (la IA entiende sin preguntar)

```
User: "gasté 15 en taxi"
IA:   "Listo ✅ Taxi S/15 · Transporte"

User: "hoy gasté 8 café, 15 taxi, 20 almuerzo"
IA:   "Listo ✅ 3 gastos:
       ☕ Café S/8 · Alimentación
       🚕 Taxi S/15 · Transporte
       🍽️ Almuerzo S/20 · Alimentación
       Total: S/43"

User: "me pagaron 2000"
IA:   "Listo ✅ Ingreso S/2,000 💰"
```

### Conversación cuando hay ambigüedad

```
User: "le pasé 50 a mi hermano"
IA:   "¿Se lo prestaste o fue un regalo/pago? 🤔"
User: "prestado"
IA:   "Listo ✅ Préstamo a tu hermano · S/50
       Te aviso cuando quieras registrar que te devolvió 👍"
```

### Conversación proactiva (la IA inicia)

> Los mensajes proactivos no son solo notificaciones — son **oportunidades para recopilar contexto** que enriquece los datos del usuario. La IA no juzga, pero sí aprovecha para entender mejor.

```
# En vez de "¿Todo bien?" (moralizante), recopilar contexto:
IA:   "Tus gastos en delivery van S/85 esta semana.
       La semana pasada fueron S/45.
       ¿Fue por trabajo, por gusto, o porque no hubo tiempo de cocinar? 🤔"
User: "no tuve tiempo de cocinar"
IA:   "Entendido 👍 Etiqueto los deliveries de esta semana como 'falta de tiempo'.
       Así podrás ver si es un patrón."

# Recordatorio de pago (modo normal):
IA:   "Tu cuota del banco vence en 3 días (S/180). 
       ¿Quieres que te recuerde el día antes?"

# Reconstrucción nocturna:
IA:   "¿Cómo estuvo hoy? 🌙"
User: "gasté bastante en comida y taxi"
IA:   "¿Algo así?
       🍽️ Almuerzo ~S/15
       🚕 Taxi ~S/12"
User: "sí pero el taxi fue 18"
IA:   "Listo ✅ Almuerzo S/15 + Taxi S/18 = S/33"
```

### Consultas inteligentes

```
User: "¿cuánto gasté esta semana?"
IA:   "Esta semana llevas S/245:
       🍽️ Alimentación: S/95 (39%)
       🚕 Transporte: S/68 (28%)
       🎮 Ocio: S/45 (18%)
       📦 Otros: S/37 (15%)
       
       Vas S/30 más que la semana pasada,
       principalmente por delivery (+S/25) 📊"

User: "¿cuánto le debo a Luis?"
IA:   "Le debes S/150 a Luis:
       • S/100 del 5 de mayo (cena)
       • S/50 del 10 de mayo (taxi compartido)
       ¿Quieres registrar un pago? 💸"

User: "¿cuánto tengo libre?"
IA:   "Tienes S/800 en total:
       💰 Yape: S/120
       💵 Efectivo: S/50
       🏦 BCP: S/630
       
       Pero comprometido: S/600
       📦 Cuota laptop: S/180
       🏠 Alquiler: S/300
       📶 Internet: S/89
       🚨 Emergencia: S/100 (reserva)
       
       Libre para gastar: ~S/200 👈"
```

### Manejo de errores (NUNCA frustrar)

```
User: "sjdkfhskjdf"
IA:   "No entendí eso 😅 ¿Querías registrar un gasto o consultar algo?"

User: "registra algo"
IA:   "¡Claro! ¿Qué gastaste y cuánto fue? 
       Ejemplo: 'gasté 20 en almuerzo'"

User: "la app del banco dice que gasté 45.30"
IA:   "Registro S/45.30 como gasto. ¿En qué fue? 
       (comida, transporte, etc.)"
User: "farmacia"
IA:   "Listo ✅ Farmacia S/45.30 · Salud 💊"
```

---

## Comandos y acciones desde WhatsApp

### Edición y eliminación

```
User: "borra el último gasto"
IA:   "Eliminado ✅ (Café S/8 del 14 de mayo)
       ¿Fue un error mío o no querías registrarlo?"

User: "corrige el taxi, fue 18 no 15"
IA:   "Corregido ✅ Taxi S/18 · Transporte"

User: "el almuerzo no fue alimentación, fue reunión de trabajo"
IA:   "Corregido ✅ Almuerzo S/20 · Trabajo/Productividad
       La próxima vez que almuerces en ese lugar, ¿lo clasifico como trabajo? 🤔"

User: "deshaz eso"
IA:   "Deshecho ✅ Volvió a: Almuerzo S/20 · Alimentación"
```

### Consultas rápidas

```
User: "muéstrame mis gastos de hoy"
IA:   "Hoy llevas S/53:
       🚕 Taxi S/18
       🍽️ Almuerzo S/20
       ☕ Café S/8
       💊 Farmacia S/7"

User: "¿cuánto gasté en delivery este mes?"
IA:   "Este mes llevas S/180 en delivery 🛵
       Eso es 15% de tus gastos totales.
       El mes pasado fueron S/120."

User: "¿cuánto me queda para la semana?"
IA:   "Basándome en tu dinero libre (S/200) 
       y que faltan 4 días para el viernes:
       ~S/50/día si quieres llegar parejo 📊"
```

### Control de nudges y preferencias

```
User: "pausa recordatorios"
IA:   "Pausados ⏸️ ¿Por cuánto tiempo?
       • Hasta mañana
       • Esta semana
       • Hasta que yo te diga"

User: "no me mandes mensajes después de las 10pm"
IA:   "Listo ✅ Horario silencioso: 10pm - 8am 🌙
       Puedes cambiarlo cuando quieras."

User: "ya no me preguntes por los cafés"
IA:   "Entendido ✅ Los cafés los registro automáticamente sin confirmar ☕"
```

### Cuentas y cajas desde WhatsApp

```
User: "pasé 100 de BCP a Yape"
IA:   "Listo ✅ Transferencia S/100: BCP → Yape
       (No cuenta como gasto)"

User: "separa 180 para la cuota de laptop"
IA:   "Listo ✅ S/180 apartados para cuota laptop 📦
       Libre: S/200 → S/20"

User: "guarda 100 para emergencia"
IA:   "Listo ✅ S/100 → Caja Emergencia 🚨
       Total emergencia: S/300"
```

---

## Mensaje de ayuda

Cuando el usuario está perdido o escribe "ayuda" / "help" / "qué puedo hacer":

```
IA:   "¡Hola! Soy Manzana 🍎 Puedo ayudarte con:

       📝 Registrar gastos/ingresos
       → 'gasté 15 en taxi'
       
       💳 Manejar deudas
       → 'le debo 50 a Luis'
       
       📊 Ver tu dinero
       → '¿cuánto gasté hoy?'
       → '¿cuánto tengo libre?'
       
       ✏️ Corregir o borrar
       → 'corrige el taxi, fue 18'
       → 'borra el último'
       
       💰 Mover dinero
       → 'pasé 100 de BCP a Yape'
       → 'separa 200 para emergencia'
       
       ⏸️ Configurar
       → 'pausa recordatorios'
       → 'horario silencioso'
       
       O simplemente háblame como le hablarías a un amigo 😊"
```

---

## Recuperación cuando el usuario se pierde

| Situación | Respuesta |
|---|---|
| Mensaje sin contexto financiero | "¿Querías registrar algo o consultar tu dinero?" |
| Mensaje muy largo y confuso | Extrae lo que puede, pregunta por lo demás |
| Usuario frustrado | "Perdón, ¿puedes decirme qué necesitas y lo resuelvo?" |
| 3+ mensajes sin entender | "Parece que no estamos conectando 😅 ¿Quieres que te muestre ejemplos?" |
| Usuario nuevo (primer mensaje) | Onboarding guiado (se define en Paso 11 — Flujos) |

---

## Consentimiento y privacidad en WhatsApp

| Aspecto | Regla |
|---|---|
| **Nudges** | El usuario da consentimiento en onboarding. Puede pausar/cancelar en cualquier momento |
| **Horarios silenciosos** | Configurable. Default V1: no enviar entre 10pm-8am |
| **Anti-spam** | Máximo 2 nudges no solicitados por día |
| **Desuscripción** | "No me escribas más" → pausa todo excepto confirmaciones de email parsing |

### Opt-in granular de mensajes proactivos

> No todos los mensajes proactivos deberían activarse juntos. El usuario elige cuáles quiere.

| Tipo de mensaje | Default | Configurable |
|---|---|---|
| Confirmación de email parsing | ✅ Siempre activo | No se puede desactivar |
| Recordatorios de pagos/cuotas | ✅ Activado | Sí |
| Resumen nocturno / reconstrucción | ✅ Activado | Sí |
| Insights semanales | ✅ Activado | Sí |
| Alertas de gasto inusual | ✅ Activado | Sí |
| Mensajes motivacionales | ❌ Desactivado | Sí |
| Re-engagement (usuario inactivo) | ✅ Activado | Sí |

```
User: "solo avísame de cuotas y emails, nada más"
IA:   "Listo ✅ Solo te enviaré:
       • Confirmaciones de emails detectados
       • Recordatorios de pagos/cuotas
       Todo lo demás pausado. Puedes cambiarlo cuando quieras."
```

---

## Ventana 24h y costo/calidad

WhatsApp sigue siendo la interfaz principal. La ventana de 24h no debe usarse para bajar calidad, sino para elegir mejor el momento y evitar insistencia innecesaria.

Reglas:

- Si el usuario escribio recientemente, Manzana resuelve por WhatsApp con conversacion natural.
- Si la ventana sigue abierta y hay algo accionable, puede enviar continuidad a las 12h aprox; a las 20h aprox solo como prompt opcional, no default.
- El mensaje de continuidad puede abrir un WhatsApp Flow si eso facilita confirmar, editar o revisar varios pendientes.
- Si la ventana esta cerrada, Manzana usa templates utility solo para abrir una conversacion util.
- Si el usuario no responde a pendientes de email, Manzana guarda acumulados en Pendientes/Centro de Confirmaciones en vez de enviar un mensaje por cada nuevo email.
- Insights de alto valor pueden ir por WhatsApp si pasan permisos, privacidad y Nudge Policy.
- El Dashboard/app profundiza y acumula; no reemplaza el rol principal de WhatsApp.

Ejemplo:

```text
IA: "Tienes 3 movimientos guardados para revisar.
     Responde 'ver' y los vemos aqui mismo."
```

Principio:

```text
Pagar WhatsApp cuando abre claridad.
No pagar WhatsApp para repetir algo que el usuario ya ignoro.
```

---

## Modo Discreto (privacidad)

> **No es el modo default.** Es una opción para usuarios que comparten pantalla, prestan su celular, o simplemente quieren más privacidad. En WhatsApp, la app no controla la preview de notificación — el mensaje completo puede verse.

> En V1, WhatsApp implementa la política transversal de modo discreto definida en el Motor IA. La decisión de ocultar detalles la aplica `PolicyGate`; WhatsApp solo recibe la versión segura para enviar.

### Modo normal (default)
```
IA: "Tu cuota del banco vence en 3 días (S/180)."
IA: "📧 Detectamos: Yape S/45 → Restaurante. ¿Lo registro?"
```

### Modo discreto (activado por el usuario)
```
IA: "Tienes un pago próximo en 3 días. Escribe 'ver pago' para detalles."
IA: "📧 Detectamos un movimiento. Escribe 'ver' para detalles."
```

### Cómo se activa
```
User: "activa modo discreto"
IA:   "Listo ✅ Modo discreto activado 🔒
       No enviaré montos ni detalles en los mensajes.
       Para ver info, escribe 'ver' o entra al dashboard.
       Desactívalo con 'modo normal'."
```

### Reglas del modo discreto

| Aspecto | Comportamiento |
|---|---|
| Mensajes proactivos | Sin montos, sin nombres de comercios |
| Confirmaciones de email | "Detectamos un movimiento" (sin monto) |
| Correcciones | Funcionan normal (el usuario inicia la conversación) |
| Consultas del usuario | Responde normal (el usuario preguntó, sabe que está mirando) |
| Dashboard | No cambia (el usuario ya está en la app) |

---

## Contexto insuficiente

> Si la IA no tiene datos suficientes para responder, **nunca inventa**. Pide lo que necesita.

```
User: "¿puedo gastar 50 hoy?"

# Si NO tiene cuentas/saldos registrados:
IA:   "Puedo ayudarte, pero todavía no sé cuánto dinero tienes disponible.
       Si quieres, dime cuánto tienes en Yape, efectivo o banco,
       y te calculo una respuesta más real."

# Si NO tiene suficiente historial:
User: "¿cuánto gasto en delivery normalmente?"
IA:   "Aún no tengo suficientes datos para decirte un promedio.
       Llevo 5 días de registro. En 2-3 semanas más
       podré darte un patrón real. 📊"

# Si la pregunta es fuera de alcance:
User: "¿debería invertir en crypto?"
IA:   "Eso está fuera de lo que puedo ayudarte 😅
       Yo me enfoco en tus gastos, ingresos y deudas.
       ¿Querías registrar algo?"
```

---

## Trazabilidad: "¿por qué me dices eso?"

> Manzana debe poder **explicar** cualquier insight o dato que muestre. El usuario tiene derecho a preguntar "¿de dónde sale eso?".

### Comandos de explicación

```
User: "¿por qué dices que delivery subió?"
IA:   "Porque esta semana registraste 4 deliveries por S/85.
       La semana pasada fueron 2 por S/45.
       Eso es un aumento del 89%. 📊"

User: "¿de dónde sale que gasto más los viernes?"
IA:   "En las últimas 4 semanas, tus gastos promedio por día:
       Lunes-Jueves: ~S/25/día
       Viernes: ~S/52/día
       Fin de semana: ~S/38/día
       Los viernes consistentemente estás arriba. 📈"

User: "explícame el dinero libre"
IA:   "Tu dinero libre se calcula así:
       Total en cuentas: S/800
       - Cuota laptop: S/180
       - Alquiler: S/300
       - Emergencia: S/100
       = Libre: S/220
       Es lo que puedes gastar sin afectar compromisos."
```

### Comandos que activan explicación

| Comando | Acción |
|---|---|
| "¿por qué?" / "¿por qué dices eso?" | Explica el último insight |
| "explícame" / "explica" | Explica el último dato mencionado |
| "¿de dónde sale eso?" | Muestra las fuentes de datos |
| "¿cómo calculas eso?" | Muestra la fórmula/lógica |

---

## Multimedia (Voz + OCR) — V1.2

> Voz y OCR se pospusieron a V1.2 por complejidad (ver indice.md). Sin embargo, WhatsApp está preparado para soportarlos cuando lleguen.

### Voz (V1.2)
```
User: [audio] "gasté veinte soles en taxi y ocho en café"
IA:   "Listo ✅ Taxi S/20 + Café S/8"
```
> Riesgos: errores de transcripción, ruido, frases largas, privacidad en público.

### OCR (V1.2)
```
User: [foto de boleta]
IA:   "Detecté una compra de S/45.30 en farmacia.
       ¿La registro en Salud? 💊"
```
> Riesgos: fotos borrosas, boletas largas, múltiples items, IGV vs total, comercio sin nombre.

### Preparación en V1.0
- La arquitectura de canales ya soporta multimedia
- Los flujos se definirán cuando se activen estas features
- El WhatsApp Adapter solo necesita agregar handlers de audio/imagen

---

## Estado de conversación (Conversation State)

> Definido en detalle en la arquitectura (`fase_4_tecnica/06_arquitectura_sistema.md`). Aquí el resumen de estados y reglas clave.

### Estados principales

| Estado | Cuándo | Ejemplo |
|---|---|---|
| `idle` | Sin conversación activa | Esperando mensaje |
| `processing` | IA analizando | Extrayendo intención |
| `awaiting_clarification` | IA preguntó, espera respuesta | "¿Se lo prestaste o fue regalo?" |
| `awaiting_confirmation` | Confirmación de email parsing | "¿Lo registro? (sí/no)" |
| `awaiting_risk_confirmation` | Acción peligrosa | "Esto borrará 5 movimientos. ¿Confirmas?" |
| `editing_movement` | Corrigiendo movimiento | "corrige el taxi, fue 18" |
| `creating_debt` | Deuda multi-paso | "¿De cuánto es? ¿En cuántas cuotas?" |
| `creating_pocket` | Creando caja | "¿Cuánto quieres juntar?" |
| `onboarding` | Primer uso | Flujo guiado |
| `reviewing_pending` | Batch de pendientes email | "Hoy detectamos 4 movimientos..." |
| `error_recovery` | IA no entiende 2+ veces | "¿Quieres que te muestre ejemplos?" |
| `cancelled` | Usuario canceló | "Listo, no registré nada" |
| `completed` | Acción exitosa | "Listo ✅" → idle |

### Cancelación (desde cualquier estado)

```
User: "olvídalo" / "cancela" / "ya no" / "déjalo"
IA:   "Listo, no registré nada. ¿Necesitas algo más?"
```

### Cambio de intención

```
IA:   "¿Se lo prestaste o fue regalo?"
User: "¿cuánto gasté hoy?"
IA:   "Dejé pendiente lo de tu hermano.
       Hoy llevas S/53: ..."
```

### Expiración suave

> Los estados no desaparecen de golpe. Tienen 3 niveles: **activo** (asume continuidad), **suave** (recuerda pero confirma), **archivado** (no asume, puede sugerir).

| Estado | Activo | Suave | Archivo |
|---|---|---|---|
| Aclaración simple | 2 horas | 24 horas | 7 días |
| Confirmación email | 24 horas | 3 días | 14 días |
| Crear deuda/caja | 24 horas | 7 días | 30 días |
| **Acción riesgosa** | **10 min** | **1 hora** | **no ejecutar** |

### Acciones de alto riesgo

Requieren confirmación explícita con frase específica:
- Borrar múltiples movimientos
- Eliminar cuenta
- Mover dinero de emergencia
- Cerrar deuda
- Conectar/desconectar email

```
User: "borra todos mis gastos de hoy"
IA:   "Esto eliminará 5 movimientos de hoy.
       ¿Confirmas? Responde 'sí, borrar'."
User: "sí, borrar"
IA:   "Listo, eliminados ✅"
```

---

## Auditoría y logs (por cada interacción)

> Cada acción desde WhatsApp debe guardar un registro para mejorar IA, depurar errores, y entender abandono.

### Datos que se registran

```json
{
  "timestamp": "2026-05-14T08:45:00Z",
  "user_id": "usr_001",
  "channel": "whatsapp",
  "conversation_state": "idle",
  "mensaje_original": "gasté 15 en taxi",
  "intencion_detectada": "registro_gasto",
  "datos_extraidos": {
    "tipo": "gasto",
    "monto": 15,
    "categoria": "transporte",
    "subcategoria": "taxi"
  },
  "confianza_ia": 0.97,
  "requirio_confirmacion": false,
  "accion_ejecutada": "crear_movimiento",
  "movimiento_id": "mov_042",
  "respuesta_enviada": "Listo ✅ Taxi S/15 · Transporte 🚕",
  "tiempo_respuesta_ms": 1200
}
```

### Para qué sirve

| Uso | Cómo |
|---|---|
| **Mejorar IA** | Analizar mensajes con baja confianza |
| **Depurar errores** | Rastrear qué entendió vs qué era |
| **Entender abandono** | Si 3+ mensajes sin resolver → usuario se va |
| **Auditar confianza** | Estadísticas de accuracy real |
| **Entrenar prompts** | Usar logs reales para mejorar prompt engineering |

---

## Tono adaptativo

> El tono completo de la IA se define en `docs/fase_3_producto/11_personalidad_conversacion.md`. Aquí se documenta cómo se adapta en WhatsApp.

| Si el usuario es... | La IA responde... |
|---|---|
| Formal: "Registra un gasto de 50 soles en transporte" | "Registrado ✅ Transporte S/50" |
| Informal: "we gasté 50 en taxi jaja" | "Listo ✅ Taxi S/50 🚕" |
| Rápido: "taxi 15" | "✅ Taxi S/15" |
| Detallado: "Hoy tomé un taxi del trabajo a mi casa porque llovía y me costó 15 soles" | "✅ Taxi S/15 · Transporte. Registré que fue del trabajo a casa 🌧️" |

> La IA detecta el estilo del usuario en los primeros 5-10 mensajes y se adapta progresivamente.

---

## Métrica principal

| Métrica | Target | Cómo se mide |
|---|---|---|
| % mensajes interpretados sin aclaración | ≥80% | Mensajes registro directo / total |
| Tiempo promedio de respuesta | <3 segundos | Desde envío hasta confirmación |
| Satisfacción post-corrección | ≥90% siguen usando | Usuarios que corrigen y no abandonan |
| Tasa de explicación exitosa | ≥95% | "¿por qué?" respondido con datos reales |

---

*Feature 1/10 del Paso 5 — V2 post-auditoría ✅*
