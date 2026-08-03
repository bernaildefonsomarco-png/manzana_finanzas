// Las cuatro capas del perfil (`20c` §2, `W-16`). `subject_key` (formato
// `ambito:valor`, `36` §7) no tiene una columna `layer` propia en
// `user_profile_facts`/`user_profile_candidates` (`WEB-D260`) — la capa
// vive en el prefijo. Este módulo es la única fuente de verdad para leer
// ese prefijo, en vez de que cada llamador repita la convención a mano.

export const PROFILE_LAYERS = ["estilo", "vida", "vinculo", "hilo"] as const;
export type ProfileLayer = (typeof PROFILE_LAYERS)[number];

const SUBJECT_KEY_PATTERN = /^([a-z0-9_]+):[^:\s].*$/;

/**
 * Devuelve la capa de un `subject_key` de perfil, o `null` si el prefijo no
 * es una de las cuatro capas de `20c` §2 (por ejemplo, un `subject_key` de
 * otro ámbito de memoria, como `comercio:Rappi`, `36` §4.1).
 */
export function capaDelHecho(subjectKey: string): ProfileLayer | null {
  const coincidencia = SUBJECT_KEY_PATTERN.exec(subjectKey);
  const prefijo = coincidencia?.[1];
  return prefijo && (PROFILE_LAYERS as readonly string[]).includes(prefijo)
    ? (prefijo as ProfileLayer)
    : null;
}

/** `subject_key` bien formado y con una capa de perfil real. */
export function esSubjectKeyDePerfilValido(subjectKey: string): boolean {
  return capaDelHecho(subjectKey) !== null;
}

// `20c` §41-46 (tabla §2): con qué ritmo cambia cada capa — usado para
// elegir cada cuánto se puede volver a preguntar por hechos de esa capa
// (no un plazo de caducidad; eso es `validity`, en `23` §5b.3).
export const RITMO_DE_CAMBIO_DE_LA_CAPA: Record<ProfileLayer, "lento" | "ocasional" | "muy_lento" | "cada_conversacion"> = {
  estilo: "lento",
  vida: "ocasional",
  vinculo: "muy_lento",
  hilo: "cada_conversacion",
};
