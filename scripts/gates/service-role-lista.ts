// Lista blanca de `createServiceClient` para `/api/` (`15` §4, §9; `AC-SEG-01`).
//
// Dos listas, con gobierno distinto (`51` §7.1):
//
// - `LISTA_BLANCA_PERMANENTE` — rutas que de verdad no tienen sesión de
//   usuario que usar (trabajadores, webhooks, salud). No caducan.
// - `EXCEPCIONES_TEMPORALES` — las rutas de `/api/v1` que hoy usan
//   service-role porque `15` §9 decidió no migrarlas dos veces: se migran
//   junto con el rediseño de paginación y filtros de `14`, en `W-05` y en
//   cada corte de módulo (`WEB-D168`). `AC-SEG-07` exige que esta lista
//   quede vacía antes del lanzamiento — cada entrada que se migra sale de
//   aquí, no se marca.

export interface EntradaLista {
  /** Ruta relativa a `src/app/api/`, sin `/route.ts` final. Admite `*` como comodín de un segmento. */
  patron: string;
  justificacion: string;
}

/**
 * `15` §4: workers y jobs, webhooks entrantes, y comprobaciones de salud.
 * Cubre las 17 rutas de fuera de `/api/v1` por categoría, no una por una —
 * es la distinción que hace el gate cumplible (`53` §2.2).
 */
export const LISTA_BLANCA_PERMANENTE: EntradaLista[] = [
  {
    patron: "internal/workers/*",
    justificacion: "Trabajador de fondo disparado por el outbox, sin sesión de usuario en la petición.",
  },
  {
    patron: "internal/workers/*/*",
    justificacion: "Trabajador de fondo disparado por el outbox, sin sesión de usuario en la petición.",
  },
  {
    patron: "internal/jobs/*",
    justificacion: "Trabajo programado por cron, sin sesión de usuario en la petición.",
  },
  {
    patron: "webhooks/*",
    justificacion: "El emisor es un proveedor externo (Gmail, WhatsApp), no un usuario autenticado.",
  },
  {
    patron: "health",
    justificacion: "Comprobación de salud: no devuelve datos de usuario.",
  },
  {
    patron: "health/*",
    justificacion: "Comprobación de salud: no devuelve datos de usuario.",
  },
  {
    patron: "v1/onboarding",
    justificacion:
      "Registro de usuario nuevo: crea el perfil y las preferencias iniciales antes de que exista contexto de sesión completo (`15` §4).",
  },
  {
    patron: "v1/privacy/account",
    justificacion:
      "Eliminación de cuenta: debe borrar datos de todas las tablas, incluidas las que el usuario no puede escribir (`15` §4).",
  },
];

const MIGRA_CON_CONTRATOS_DE_API =
  "Pendiente de migrar a cliente autenticado junto con su rediseño de " +
  "paginación y filtros de contratos de API (`15` §9, `WEB-D168`). No se " +
  "toca dos veces: se migra cuando la familia recibe su contrato nuevo.";

/**
 * `15` §9 paso 1: las rutas de `/api/v1` que hoy esquivan RLS, declaradas
 * como excepción temporal —no permanente— con la misma justificación de
 * fondo. Agrupadas por familia para que quede legible quién es cada una,
 * aunque el motivo de todas es el mismo.
 */
export const EXCEPCIONES_TEMPORALES: EntradaLista[] = [
  // Cuentas y cajas (24)
  "v1/accounts",
  "v1/accounts/*",
  "v1/accounts/*/restore",
  "v1/boxes",
  "v1/boxes/*",
  "v1/money/actions",
  "v1/dashboard/home",
  // Categorías (25)
  "v1/subcategories",
  "v1/subcategories/*",
  "v1/tags",
  "v1/tags/*",
  // Movimientos (26)
  "v1/movements",
  "v1/movements/*",
  "v1/movements/*/restore",
  // Pendientes (27)
  "v1/pending/*",
  "v1/pending/*/confirm",
  "v1/pending/*/discard",
  "v1/pending/*/already-registered",
  "v1/pending/*/context",
  "v1/pending/batch-confirm",
  "v1/pending/batch-discard",
  "v1/pending/batch/*/undo",
  // Email y detección bancaria (28)
  "v1/email/ai-consent",
  "v1/email/disconnect",
  "v1/email/history",
  "v1/email/oauth/callback",
  "v1/email/sources",
  "v1/email/status",
  "v1/email/suggestions",
  "v1/email/suggestions/*/accept",
  "v1/email/suggestions/*/reject",
  "v1/email/suggestions/*/silence",
  // Recurrentes (30)
  "v1/recurring",
  "v1/recurring/*",
  "v1/recurring/*/cancel",
  "v1/recurring/*/occurrences/*/mark-paid",
  "v1/recurring/*/occurrences/*/skip",
  "v1/recurring/*/pause",
  "v1/recurring/*/resume",
  "v1/recurring/candidates/*/confirm",
  "v1/recurring/candidates/*/discard",
  "v1/recurring/detect",
  // Deudas (31)
  "v1/debts",
  "v1/debts/*",
  "v1/debts/*/payments",
  "v1/debts/*/close",
  "v1/debts/*/reopen",
  "v1/debts/*/installments/*/reschedule",
  "v1/debts/*/installments/*/skip",
  "v1/related-persons",
  "v1/related-persons/*",
  // Descubrimientos (34)
  "v1/insights/*/action",
  "v1/insights/*/dismiss",
  "v1/insights/*/seen",
  // Memoria (36)
  "v1/memory",
  // Recordatorios (37)
  "v1/nudges/*/dismiss",
  "v1/preferences/nudges",
  "v1/preferences/nudges/whatsapp",
  // Búsqueda (38)
  "v1/search/natural",
  // Configuración y auth (43, 45) — v1/onboarding y v1/privacy/account son
  // lista blanca permanente, no temporal: ver arriba, 15 §4.
  "v1/preferences/experience",
  "v1/privacy/export",
  "v1/profile",
].map((patron) => ({ patron, justificacion: MIGRA_CON_CONTRATOS_DE_API }));
