// `20c` §8/§2.3: categorías sensibles no generan hechos de perfil
// automáticamente, en ninguna capa. La sensibilidad de una categoría ya es
// un dato del dominio (`categories[].is_sensitive`, `DataContextPack`) —
// este módulo no mantiene su propia lista de categorías "sensibles": eso
// duplicaría una fuente de verdad que ya existe.

import type { ProfileLayer } from "./layers";

export type ProfileFactGenerationContext = {
  /** `categories[].is_sensitive` de la categoría que originó la observación, si aplica. */
  categoriaOrigenEsSensible: boolean;
  capa: ProfileLayer;
};

/**
 * `AC-PERF-10`: una observación ligada a una categoría sensible nunca se
 * convierte en candidato de perfil, sin excepción de capa.
 */
export function puedeGenerarHechoDePerfilAutomatico(
  contexto: ProfileFactGenerationContext,
): boolean {
  return !contexto.categoriaOrigenEsSensible;
}
