# 🔍 Análisis Competitivo — Manzana

**Paso 3/20 del Roadmap de Documentación**  
**Estado:** ✅ Completado  
**Última actualización:** 12 de Mayo, 2026

---

## Principio

> El competidor real de Manzana **no es otra app**. Es el **hábito de no registrar nada** — o la nota de WhatsApp que el usuario ya se manda a sí mismo.

---

## Mapa del mercado

### 3 niveles de competencia

```
Nivel 1 — Competidores directos
  Apps de finanzas personales que operan en LATAM
  
Nivel 2 — Competidores indirectos
  Apps globales de finanzas con presencia parcial en LATAM
  
Nivel 3 — Competidores invisibles
  Lo que el usuario REALMENTE usa hoy en vez de una app
```

---

## Nivel 1 — Competidores Directos (LATAM)

### Monefy

| Aspecto | Detalle |
|---|---|
| **Qué es** | App de registro manual de gastos con interfaz visual |
| **Canal** | App móvil (Android/iOS) |
| **Fortaleza** | Interfaz extremadamente simple, entrada rápida |
| **Debilidad** | Sin IA, sin insights, sin WhatsApp, sin conversación |
| **Precio** | Free + Premium (~$2.99/mes) |
| **Mercado** | Global, popular en LATAM |
| **Por qué la gente la abandona** | Registro manual se vuelve tarea. Sin valor de retorno (no te dice nada nuevo). |

**Manzana vs Monefy:**
> Monefy es lo que Manzana sería si le quitaras la IA, WhatsApp y los insights. Monefy registra. Manzana entiende.

---

### Fintonic

| Aspecto | Detalle |
|---|---|
| **Qué es** | Agregador bancario con categorización automática |
| **Canal** | App móvil |
| **Fortaleza** | Conexión directa a bancos, visión global de cuentas |
| **Debilidad** | Orientado a España, funcionalidad LATAM limitada. Se siente invasivo (publicidad financiera). |
| **Precio** | Free (monetiza con productos financieros) |
| **Mercado** | España principal, presencia parcial LATAM |
| **Por qué la gente la abandona** | Funciones LATAM limitadas. Se siente como un banco, no como un amigo. |

**Manzana vs Fintonic:**
> Fintonic necesita acceso bancario. Manzana funciona con un mensaje de WhatsApp. En Perú, donde Yape domina y la integración bancaria es limitada, Manzana gana por canal.

---

### Wallet (BudgetBakers)

| Aspecto | Detalle |
|---|---|
| **Qué es** | Gestor financiero completo con presupuestos y proyecciones |
| **Canal** | App móvil + web |
| **Fortaleza** | Muy completo: presupuestos, gráficos, sincronización bancaria (premium) |
| **Debilidad** | Complejo. Curva de aprendizaje alta. Se siente como contabilidad. |
| **Precio** | Free limitado + Premium (~$4.99/mes) |
| **Mercado** | Global |
| **Por qué la gente la abandona** | Demasiadas opciones. El usuario promedio de Manzana (Camila) lo abre una vez y dice "esto es mucho". |

**Manzana vs Wallet:**
> Wallet es para quienes quieren control total. Manzana es para quienes quieren claridad sin esfuerzo. Públicos completamente diferentes.

---

### Splitwise

| Aspecto | Detalle |
|---|---|
| **Qué es** | App para dividir gastos entre amigos/grupos |
| **Canal** | App móvil |
| **Fortaleza** | Estándar de la industria para gastos compartidos |
| **Debilidad** | Solo deudas grupales. No es finanzas personales. |
| **Precio** | Free + Pro (~$4.99/mes) |
| **Mercado** | Global, muy popular en universitarios LATAM |

**Manzana vs Splitwise:**
> No compiten directamente. Pero Valentina podría preferir Manzana si el tracking de deudas personales es lo suficientemente bueno. Splitwise no da insights ni analiza hábitos.

---

### Clever ⚠️ (Referencia importante)

| Aspecto | Detalle |
|---|---|
| **Qué es** | App de registro de gastos con conexión bancaria por email |
| **Canal** | App móvil |
| **Fortaleza** | Registro automático — lee emails de notificación bancaria y registra sin que el usuario haga nada |
| **Debilidad** | Sin IA conversacional, sin WhatsApp, insights limitados |
| **Mercado** | LATAM |
| **Lo que hacen MUY bien** | El registro pasivo. El usuario yapea y el gasto aparece registrado automáticamente. |

**Manzana vs Clever:**
> Clever resolvió algo que Manzana todavía no tiene: **registro sin fricción CERO** — ni siquiera un mensaje de WhatsApp. El usuario no tiene que recordar nada. Esto es extremadamente valioso porque resuelve el problema de raíz: el hábito de no registrar.

**Insight estratégico descubierto:**
> El registro automático por email/notificaciones bancarias debe ser una feature de Manzana. No reemplaza WhatsApp — lo complementa. WhatsApp es para gastos en efectivo, contexto emocional y conversación. El registro automático es para capturar TODO lo que el usuario olvida.

---

### 🔑 Canales de Registro — Estrategia combinada para Manzana

Manzana no debería elegir entre registro manual y automático. Debería combinar ambos:

| Canal | Tipo | Qué captura | Fricción |
|---|---|---|---|
| **WhatsApp** | Activo | Gastos en efectivo, contexto, emociones, deudas | Baja (1 mensaje) |
| **Email parsing** | Pasivo | Transacciones bancarias, Yape, transferencias | Zero (automático) |
| **SMS parsing** | Pasivo | Notificaciones de bancos peruanos | Zero (automático) |
| **App/PWA** | Activo | Registro manual, consulta, dashboard | Media |

#### Cómo funcionaría el registro automático

```
1. Usuario conecta su email (Gmail) con permisos de lectura
2. Manzana lee emails de: BCP, Interbank, BBVA, Yape, etc.
3. IA parsea: monto, tipo, fecha, comercio
4. Movimiento se registra automáticamente
5. Usuario puede ver, corregir o agregar contexto después
```

#### Lo que esto cambia para cada persona

| Persona | Sin registro automático | Con registro automático |
|---|---|---|
| **Camila** | Registra 5/25 gastos semanales | Captura 20/25 automáticamente + 5 en efectivo por WA |
| **Diego** | Registra 3/semana | Todos sus ingresos y pagos se capturan solos |
| **Valentina** | Solo deudas | Sus Yapes se registran sin que haga nada |

> **Principio:** El registro automático NO reemplaza WhatsApp. WhatsApp agrega lo que el banco no sabe: contexto, emoción, etiquetas. "Gasté 15 en taxi" el banco lo sabe. "Gasté 15 en taxi porque me quedé dormida" solo lo sabe el usuario.

---

## Nivel 2 — Competidores Indirectos (Globales, IA-first)

### Cleo AI ⭐ (El más relevante para benchmarking)

| Aspecto | Detalle |
|---|---|
| **Qué es** | App financiera con chatbot conversacional como interfaz principal |
| **Canal** | App móvil (chat-first) |
| **Fortaleza** | IA conversacional divertida ("roast mode"), auto-categorización, tono Gen-Z |
| **Debilidad** | Solo mercado anglosajón. Requiere conexión bancaria. No tiene WhatsApp. |
| **Precio** | Free + Cleo Plus ($5.99/mes) + Cleo Builder ($14.99/mes) |
| **Mercado** | USA/UK |
| **Lo que hacen MUY bien** | El tono. La IA se siente como un amigo que te regaña con humor. |

**Manzana vs Cleo:**
> Cleo es la referencia más cercana al concepto de Manzana. Pero Cleo requiere banco, opera en inglés, y no está en LATAM. **Manzana es "Cleo para LATAM, por WhatsApp, sin necesitar cuenta bancaria".**

---

### Copilot Money

| Aspecto | Detalle |
|---|---|
| **Qué es** | App premium de finanzas con IA y diseño excepcional |
| **Canal** | iOS/Mac (recientemente web) |
| **Fortaleza** | Mejor diseño del mercado. IA que mejora con el tiempo. |
| **Debilidad** | Solo Apple. Sin tier free. No LATAM. |
| **Precio** | ~$10.99/mes (sin versión gratuita) |
| **Mercado** | USA |

**Manzana vs Copilot:**
> Copilot demuestra que el mercado paga por IA financiera premium. Es el benchmark de a dónde podría evolucionar Manzana Oro para usuarios como Diego.

---

### Monarch Money

| Aspecto | Detalle |
|---|---|
| **Qué es** | Reemplazo de Mint (descontinuado 2024). Dashboard financiero completo. |
| **Canal** | App + Web |
| **Fortaleza** | Visión integral, inversiones, net worth, presupuestos para parejas |
| **Debilidad** | Complejo. Pago obligatorio. No LATAM. |
| **Precio** | ~$14.99/mes |

**Manzana vs Monarch:**
> Monarch es "demasiado" para nuestro usuario. Pero valida que hay mercado dispuesto a pagar $15/mes por finanzas personales.

---

## Nivel 3 — Competidores Invisibles (Los reales)

> ⚠️ **Estos son los competidores que realmente importan.** No son apps — son comportamientos.

### 1. No hacer nada 🏆 (Competidor #1)

| Aspecto | Detalle |
|---|---|
| **Qué es** | El usuario simplemente no registra gastos |
| **Por qué "funciona"** | Cero fricción. Cero esfuerzo. |
| **Por qué falla** | Ansiedad financiera creciente. "¿En qué se me fue la plata?" |
| **Cómo ganar** | Hacer que registrar sea MÁS fácil que no registrar. WhatsApp + IA lo logra. |

### 2. La nota de WhatsApp a sí mismo

| Aspecto | Detalle |
|---|---|
| **Qué es** | El usuario se manda mensajes a sí mismo con gastos |
| **Por qué "funciona"** | Ya está en WhatsApp. Cero apps nuevas. |
| **Por qué falla** | No suma, no categoriza, no genera insights, se pierde en el chat. |
| **Cómo ganar** | Manzana ES esa nota, pero que piensa. Mismo canal, 100x más inteligente. |

### 3. Excel / Google Sheets / Notion

| Aspecto | Detalle |
|---|---|
| **Qué es** | Hoja de cálculo manual para finanzas |
| **Por qué "funciona"** | Control total. Personalizable. Gratis. |
| **Por qué falla** | Requiere disciplina constante. Se abandona en 2-3 semanas. |
| **Cómo ganar** | Manzana hace lo mismo pero automáticamente con un mensaje. |

### 4. Revisar Yape/BCP app

| Aspecto | Detalle |
|---|---|
| **Qué es** | El usuario revisa su historial de Yape o su banca móvil |
| **Por qué "funciona"** | Ya tiene los datos reales de transacciones. |
| **Por qué falla** | No categoriza, no da insights, no incluye efectivo, no aprende. |
| **Cómo ganar** | Manzana agrega contexto que el banco no puede: "ese taxi fue por estrés, ese café fue social". |

---

## Matriz Comparativa Completa

| Feature | Manzana 🍎 | Monefy | Cleo AI | Wallet | Splitwise | No hacer nada |
|---|---|---|---|---|---|---|
| **Canal WhatsApp** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Lenguaje natural** | ✅ | ❌ | ✅ | ❌ | ❌ | N/A |
| **IA clasificación** | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Insights personalizados** | ✅ | ❌ | ✅ | Básicos | ❌ | ❌ |
| **Sin conexión bancaria** | ✅ | ✅ | ❌ | Free sí | ✅ | ✅ |
| **Tono no-judgmental** | ✅ | N/A | Parcial (roast) | N/A | N/A | N/A |
| **LATAM / Español** | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Shareables** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Deudas personales** | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Registro diferido (bloque)** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Nudges adaptativos** | ✅ | ❌ | Parcial | ❌ | ❌ | ❌ |
| **Micro-reconstrucción** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Free tier funcional** | ✅ | ✅ | ✅ | Limitado | ✅ | ✅ |
| **Precio LATAM-friendly** | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |

---

## Oportunidades NO cubiertas por nadie

| Oportunidad | Quién la necesita | Estado del mercado |
|---|---|---|
| **Finanzas por WhatsApp en LATAM** | Todos — WA es la app #1 | Nadie lo hace bien |
| **IA que reconstruye tu día** | Usuarios de registro diferido | No existe |
| **Insights emocionales** ("gastaste por estrés") | Camila, millennials | Cleo lo intenta en inglés, nadie en español |
| **Shareables financieros** (Spotify Wrapped style) | Gen-Z, Valentina | No existe en finanzas |
| **Tracking de deudas informales** (entre amigos) | Valentina, universitarios | Splitwise es grupal, no personal |
| **Multi-moneda PEN/USD sin complejidad** | Diego, freelancers | Apps globales lo tienen, las LATAM no |

---

## Conclusión estratégica

### El posicionamiento de Manzana

```
         PROFUNDIDAD
              ↑
              │
   Monarch ── │ ── Copilot
   Wallet     │        
              │        
              │   Cleo     ← Manzana apunta aquí
              │              pero en LATAM + WhatsApp
   Fintonic ──│        
              │        
   Monefy ────│        
              │        
              │        
   ───────────┼──────────────→ FACILIDAD DE USO
   Complejo   │           Súper fácil
              │
              │  "No hacer nada"
              │  "Nota de WA"
```

### El espacio vacío de Manzana

> **No existe una app que combine: WhatsApp + IA conversacional + registro automático por email + español + LATAM + insights emocionales + shareables.**
>
> Ese espacio está completamente vacío. Manzana tiene 3 capas de captura que nadie combina:
> 1. **Pasiva** — Email/SMS parsing (como Clever, pero mejor)
> 2. **Activa ligera** — WhatsApp conversacional (como Cleo, pero en español)
> 3. **Activa completa** — App/PWA con dashboard
>
> La conexión bancaria es **opcional** — Manzana funciona sin ella, pero es 10x mejor con ella.

---

*Paso 3/20 completado ✅ — Siguiente: Paso 4 — TAM/SAM/SOM.*
