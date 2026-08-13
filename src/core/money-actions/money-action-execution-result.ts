import type { MoneyActionOperation } from "./money-action-proposal";

/**
 * Resultado de ejecutar un movimiento de dinero ya confirmado.
 *
 * Vive en su propio modulo por la misma razon que `DebtActionExecutionResult`:
 * lo comparten el ejecutor, la resolucion del turno y el planificador de
 * respuesta, y tenerlo en el ejecutor les crearia una dependencia con el
 * cliente de Supabase que ninguno de los tres necesita.
 */
export type MoneyActionExecutionResult =
  | {
      kind: "applied";
      operation: MoneyActionOperation;
      /** Nombre de catalogo (`40` §7.1) que se acaba de ejecutar. */
      catalog_command: string;
      /** Id del movimiento que quedo escrito. */
      entity_id: string;
      /** Frase corta y concreta de lo que quedo escrito. */
      summary: string;
      /** `true` cuando el comando ya se habia ejecutado con esta misma clave. */
      idempotent: boolean;
    }
  | {
      kind: "failed";
      operation: MoneyActionOperation;
      catalog_command: string;
      reason:
        | "invalid_command"
        | "reference_not_found"
        | "conflict"
        | "risk_policy"
        | "core_error";
      error_code: string;
      /** Detalle listo para mostrar cuando el motivo es del usuario, no del sistema. */
      detail: string | null;
    };
