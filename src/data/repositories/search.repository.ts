import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import type { CategoryId } from "@/shared/types/domain";
import type { ParsedQuery } from "@/core/search/query-parser";
import type { MovementStatus } from "@/shared/types/domain";

type Client = SupabaseClient<Database>;

// 38 §4.3: entidades pequeñas se buscan por nombre con ILIKE, no se indexan.
const CATEGORY_LABELS: Record<CategoryId, string> = {
  alimentacion: "Alimentación",
  transporte: "Transporte",
  vivienda_hogar: "Vivienda y hogar",
  servicios_suscripciones: "Servicios y suscripciones",
  salud: "Salud",
  educacion: "Educación",
  ocio_salidas: "Ocio y salidas",
  compras_personales: "Compras personales",
  familia_apoyo: "Familia y apoyo",
  deudas: "Deudas",
  trabajo_productividad: "Trabajo y productividad",
  otros: "Otros",
};

export type SearchMovementResult = {
  id: string;
  description: string | null;
  merchant: string | null;
  amount: number;
  currency: string;
  occurred_at: string;
  category_id: CategoryId | null;
  confirmed: boolean;
};

export type SearchAccountResult = { id: string; name: string; kind: "cuenta" | "caja" };
export type SearchCategoryResult = { id: CategoryId; label: string };
export type SearchDebtResult = { id: string; name: string; related_person_name: string | null };
export type SearchCommitmentResult = { id: string; name: string };

export type SearchResults = {
  movements: SearchMovementResult[];
  pending: SearchMovementResult[];
  accounts: SearchAccountResult[];
  categories: SearchCategoryResult[];
  debts: SearchDebtResult[];
  commitments: SearchCommitmentResult[];
};

// RUL-BUS-05: confirmados y pendientes no se mezclan — un movimiento
// `needs_review` es "sin confirmar", no "confirmado", así que va en un
// único de los dos conjuntos, nunca en ambos.
const CONFIRMED_STATUSES = ["confirmed", "corrected"] as const satisfies readonly MovementStatus[];
const PENDING_STATUSES = ["needs_review"] as const satisfies readonly MovementStatus[];

// RUL-BUS-01: la identidad del usuario se inyecta aquí, nunca en el texto.
export async function searchAll(
  client: Client,
  userId: string,
  query: ParsedQuery,
  limitPerEntity = 20,
): Promise<SearchResults> {
  const [movements, pending, accounts, boxes, debts, commitments] = await Promise.all([
    searchMovements(client, userId, query, CONFIRMED_STATUSES, limitPerEntity),
    searchMovements(client, userId, query, PENDING_STATUSES, limitPerEntity, {
      pendingOnly: true,
    }),
    query.freeText
      ? client.from("accounts").select("id,name").eq("user_id", userId).is("deleted_at", null).ilike("name", `%${query.freeText}%`).limit(limitPerEntity)
      : Promise.resolve({ data: [], error: null }),
    query.freeText
      ? client.from("boxes").select("id,name").eq("user_id", userId).is("deleted_at", null).ilike("name", `%${query.freeText}%`).limit(limitPerEntity)
      : Promise.resolve({ data: [], error: null }),
    query.freeText
      ? client
          .from("debts")
          .select("id,name,related_persons(display_name)")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .ilike("name", `%${query.freeText}%`)
          .limit(limitPerEntity)
      : Promise.resolve({ data: [], error: null }),
    query.freeText
      ? client
          .from("recurring_rules")
          .select("id,name")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .ilike("name", `%${query.freeText}%`)
          .limit(limitPerEntity)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const categories: SearchCategoryResult[] = query.freeText
    ? (Object.entries(CATEGORY_LABELS) as [CategoryId, string][])
        .filter(([, label]) => label.toLowerCase().includes(query.freeText.toLowerCase()))
        .map(([id, label]) => ({ id, label }))
    : [];

  type AccountRow = { id: string; name: string };
  type DebtRow = { id: string; name: string; related_persons: { display_name: string } | null };
  type CommitmentRow = { id: string; name: string };

  return {
    movements,
    pending,
    accounts: [
      ...((accounts.data ?? []) as AccountRow[]).map((a) => ({ id: a.id, name: a.name, kind: "cuenta" as const })),
      ...((boxes.data ?? []) as AccountRow[]).map((b) => ({ id: b.id, name: b.name, kind: "caja" as const })),
    ],
    categories,
    debts: ((debts.data ?? []) as DebtRow[]).map((d) => ({
      id: d.id,
      name: d.name,
      related_person_name: d.related_persons?.display_name ?? null,
    })),
    commitments: ((commitments.data ?? []) as CommitmentRow[]).map((c) => ({ id: c.id, name: c.name })),
  };
}

async function searchMovements(
  client: Client,
  userId: string,
  query: ParsedQuery,
  statuses: readonly MovementStatus[],
  limit: number,
  options: { pendingOnly?: boolean } = {},
): Promise<SearchMovementResult[]> {
  let builder = client
    .from("movements")
    .select("id,description,merchant,amount,currency,occurred_at,category_id,status")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("status", statuses)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (query.freeText) {
    builder = builder.textSearch("search_vector", query.freeText, { type: "websearch", config: "spanish" });
  }
  if (query.amount) {
    if (query.amount.kind === "exact") builder = builder.eq("amount", query.amount.amount);
    if (query.amount.kind === "gt") builder = builder.gt("amount", query.amount.amount);
    if (query.amount.kind === "lt") builder = builder.lt("amount", query.amount.amount);
  }
  if (query.dateRange) {
    builder = builder
      .gte("occurred_at", `${query.dateRange.from}T00:00:00`)
      .lte("occurred_at", `${query.dateRange.to}T23:59:59`);
  }

  const { data, error } = await builder;
  if (error) throw error;

  type Row = {
    id: string;
    description: string | null;
    merchant: string | null;
    amount: number;
    currency: string;
    occurred_at: string;
    category_id: CategoryId | null;
    status: string;
  };
  return ((data ?? []) as Row[]).map((row) => ({
    id: row.id,
    description: row.description,
    merchant: row.merchant,
    amount: row.amount,
    currency: row.currency,
    occurred_at: row.occurred_at,
    category_id: row.category_id,
    confirmed: !options.pendingOnly,
  }));
}

export type PaletteDestination = { label: string; route: string };

// RUL-BUS-06: bloque IR A — destinos conocidos que coinciden con el texto.
export const PALETTE_DESTINATIONS: PaletteDestination[] = [
  { label: "Mi Dinero", route: "/mi-dinero" },
  { label: "Movimientos", route: "/movimientos" },
  { label: "Categorías", route: "/mi-dinero/categorias" },
  { label: "Pendientes", route: "/pendientes" },
  { label: "Pagos que vienen", route: "/pagos-que-vienen" },
  { label: "Deudas", route: "/deudas" },
  { label: "Presupuestos", route: "/presupuestos" },
  { label: "Proyecciones", route: "/proyecciones" },
  { label: "Descubrimientos", route: "/descubrimientos" },
  { label: "Recordatorios", route: "/recordatorios" },
  { label: "Reportes", route: "/reportes" },
  { label: "Buscar", route: "/buscar" },
];

export type PaletteAction = { label: string; action_url: string };

// RUL-BUS-06/RUL-BUS-08: bloque HACER — siempre abre, nunca ejecuta.
export const PALETTE_ACTIONS: PaletteAction[] = [
  { label: "Registrar gasto", action_url: "/movimientos/nuevo?tipo=gasto" },
  { label: "Registrar ingreso", action_url: "/movimientos/nuevo?tipo=ingreso" },
  { label: "Crear un presupuesto", action_url: "/presupuestos/nuevo" },
  { label: "Crear una deuda", action_url: "/deudas/nueva" },
];

export function matchPalette(freeText: string): { destinations: PaletteDestination[]; actions: PaletteAction[] } {
  if (!freeText) return { destinations: [], actions: [] };
  const needle = freeText.toLowerCase();
  return {
    destinations: PALETTE_DESTINATIONS.filter((d) => d.label.toLowerCase().includes(needle)),
    actions: PALETTE_ACTIONS.filter((a) => a.label.toLowerCase().includes(needle)),
  };
}
