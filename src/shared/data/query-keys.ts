// Claves de caché jerárquicas de `17` §2.2, para poder invalidar por
// familia. Un único lugar que las declara evita que cada pantalla invente
// su propia clave y rompa la invalidación selectiva de `17` §2.3.
export const queryKeys = {
  movements: {
    all: ["movimientos"] as const,
    list: (filtros: Record<string, unknown>) => ["movimientos", filtros] as const,
    detail: (id: string) => ["movimientos", "detalle", id] as const,
  },
  summary: ["resumen"] as const,
  budgets: {
    all: ["presupuestos"] as const,
    period: (periodo: string) => ["presupuestos", periodo] as const,
    detail: (id: string) => ["presupuestos", "detalle", id] as const,
    suggestions: ["presupuestos", "sugerencias"] as const,
    summary: ["presupuestos", "resumen"] as const,
  },
  goals: {
    all: ["metas"] as const,
    detail: (id: string) => ["metas", "detalle", id] as const,
  },
  projections: {
    all: ["proyecciones"] as const,
    period: ["proyecciones", "periodo"] as const,
    situation: ["proyecciones", "situacion"] as const,
    breakdown: ["proyecciones", "desglose"] as const,
  },
  debts: {
    all: ["deudas"] as const,
    detail: (id: string) => ["deuda", id] as const,
  },
  recurringRules: {
    all: ["reglas-recurrentes"] as const,
  },
  relatedPersons: {
    all: ["personas-relacionadas"] as const,
  },
  pending: {
    all: ["pendientes"] as const,
    detail: (id: string) => ["pendientes", "detalle", id] as const,
  },
  accounts: ["cuentas"] as const,
  boxes: ["cajas"] as const,
  categories: ["categorias"] as const,
  subcategories: {
    all: ["subcategorias"] as const,
    list: (categoryId?: string) => ["subcategorias", categoryId ?? "todas"] as const,
  },
  discoveries: {
    all: ["descubrimientos"] as const,
  },
  preferences: ["preferencias"] as const,
  assistant: {
    threads: ["asistente", "hilos"] as const,
    thread: (id: string) => ["asistente", "hilos", id] as const,
    health: ["asistente", "salud"] as const,
  },
} as const;
