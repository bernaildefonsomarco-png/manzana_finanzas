import type { DebtActionOperation } from "./debt-action-proposal";

/**
 * Resultado de ejecutar una operacion de deuda ya confirmada.
 *
 * Vive en su propio modulo —y no dentro del ejecutor— por la misma razon que
 * `StructureExecutionResult`: lo comparten el ejecutor, la resolucion del turno
 * y el planificador de respuesta, y tenerlo en el ejecutor les crearia una
 * dependencia con el cliente de Supabase que ninguno de los tres necesita.
 */
export type DebtActionExecutionResult =
  | {
      kind: "applied";
      operation: DebtActionOperation;
      /** Nombre de catalogo (`40` §7.11) que se acaba de ejecutar. */
      catalog_command: string;
      entity_id: string;
      /** Frase corta y concreta de lo que quedo escrito. */
      summary: string;
      /** `true` cuando el comando ya se habia ejecutado con esta misma clave. */
      idempotent: boolean;
    }
  | {
      kind: "failed";
      operation: DebtActionOperation;
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
