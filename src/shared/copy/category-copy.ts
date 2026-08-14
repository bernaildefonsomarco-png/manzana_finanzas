import { type CategoryId } from "@/shared/types/domain";

/**
 * Etiquetas visibles de las 12 categorias canonicas. Son exactamente las que
 * siembra `supabase/migrations/003_categories_tags.sql` en `categories.label`,
 * o sea las mismas que devuelve `GET /api/v1/categories` y pinta la tarjeta del
 * asistente. El nucleo compone texto sin tocar la base, asi que necesita esta
 * copia local: si divergiera, el mismo movimiento se llamaria distinto segun si
 * lo lees en la tarjeta o en la frase.
 */
export const CATEGORY_LABELS: Record<CategoryId, string> = {
  alimentacion: "Alimentación",
  transporte: "Transporte",
  vivienda_hogar: "Vivienda / Hogar",
  servicios_suscripciones: "Servicios / Suscripciones",
  salud: "Salud",
  educacion: "Educación",
  ocio_salidas: "Ocio / Salidas",
  compras_personales: "Compras personales",
  familia_apoyo: "Familia / Apoyo",
  deudas: "Deudas",
  trabajo_productividad: "Trabajo / Productividad",
  otros: "Otros",
};

/**
 * Resuelve un `category_id` a la etiqueta que la persona reconoce. El tipo dice
 * `CategoryId`, pero `normalized_summary` viaja como JSON y puede traer un id
 * que ya no existe; en ese caso se suaviza el slug en vez de escupir
 * `vivienda_hogar` en medio de una frase.
 */
export function getCategoryLabel(
  categoryId: string | null | undefined
): string | null {
  if (!categoryId) return null;

  const known = CATEGORY_LABELS[categoryId as CategoryId];
  if (known) return known;

  const humanized = categoryId.replace(/_/g, " ").trim();
  if (!humanized) return null;
  return humanized.charAt(0).toUpperCase() + humanized.slice(1);
}
