import type { MovementActionOperation } from "./movement-action-proposal";

/**
 * Resultado de ejecutar `restaurar_movimiento` o `duplicar_movimiento` ya
 * confirmados. Vive en su propio modulo por la misma razon que
 * `DebtActionExecutionResult` y `MoneyActionExecutionResult`: lo comparten el
 * ejecutor, la resolucion del turno y el planificador de respuesta.
 */
export type MovementActionExecutionResult =
  | {
      kind: "applied";
      operation: MovementActionOperation;
      /** Nombre de catalogo (`40` §7.3) que se acaba de ejecutar. */
      catalog_command: string;
      /** Id del movimiento restaurado o del movimiento nuevo duplicado. */
      entity_id: string;
      /** Frase corta y concreta de lo que quedo escrito. */
      summary: string;
      /** `true` cuando el comando ya se habia ejecutado con esta misma clave. */
      idempotent: boolean;
    }
  | {
      kind: "failed";
      operation: MovementActionOperation;
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
