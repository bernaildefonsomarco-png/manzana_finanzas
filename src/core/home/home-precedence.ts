import type { ReminderKind } from "@/shared/types/domain";

/**
 * `39` `RUL-HOME-03`: los niveles 1 a 4 son "lo siguiente" (`RUL-HOME-04`
 * destaca solo el de mayor precedencia); 5 y 6 quedan como contexto, nunca
 * destacados. `descarga_lista` (exportación lista) no aparece en la lista de
 * `39` §6 y `sin_registrar` es exactamente la "acción de crecimiento del
 * producto" que `RUL-HOME-04` prohíbe destacar (`WEB-D250`): ambos quedan
 * fuera del mapa a propósito.
 */
const NEXT_ACTION_LEVEL_BY_KIND: Partial<Record<ReminderKind, 1 | 2 | 3 | 4>> = {
  correo_desconectado: 1,
  pago_vencido: 2,
  cuota_vencida: 2,
  pago_proximo: 3,
  cuota_proxima: 3,
  pendientes_acumulados: 4,
  confirmar_hecho: 4,
};

export type NextActionCandidate = {
  id: string;
  kind: ReminderKind;
};

export function nextActionLevel(kind: ReminderKind): 1 | 2 | 3 | 4 | null {
  return NEXT_ACTION_LEVEL_BY_KIND[kind] ?? null;
}

/**
 * Elige "lo siguiente" entre los recordatorios abiertos: el de menor nivel
 * (1 gana a 4); a igual nivel, el primero de la lista de entrada (ya viene
 * ordenada por prioridad de `37`, `reminder-engine.ts`). Ninguno de niveles
 * 1-4 abierto → `null`, y `RUL-HOME-04` dice que el bloque no aparece.
 */
export function selectNextAction<T extends NextActionCandidate>(candidates: T[]): T | null {
  let winner: T | null = null;
  let winnerLevel = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const level = nextActionLevel(candidate.kind);
    if (level === null) continue;
    if (level < winnerLevel) {
      winner = candidate;
      winnerLevel = level;
    }
  }

  return winner;
}
