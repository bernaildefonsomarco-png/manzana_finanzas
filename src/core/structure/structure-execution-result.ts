import type { StructureEntity, StructureOperation } from "./structure-commands";

/**
 * Resultado de ejecutar un comando de estructura ya confirmado.
 *
 * Vive en su propio modulo —y no dentro de `structure-executor.ts`— porque lo
 * comparten el despachador y los ejecutores por dominio (`recurring-executor`,
 * `account-executor`), y tenerlo en el despachador les crearia una dependencia
 * circular con el.
 */
export type StructureExecutionResult =
  | {
      kind: "applied";
      entity: StructureEntity;
      operation: StructureOperation;
      entity_id: string;
      /** Frase corta y concreta de lo que quedo escrito. */
      summary: string;
      /** `true` cuando el comando ya se habia ejecutado con esta misma clave. */
      idempotent: boolean;
    }
  | {
      kind: "failed";
      entity: StructureEntity;
      operation: StructureOperation;
      reason:
        | "invalid_command"
        | "reference_not_found"
        | "conflict"
        | "insufficient_free_balance"
        | "risk_policy"
        | "core_error";
      error_code: string;
      /** Detalle listo para mostrar cuando el motivo es del usuario, no del sistema. */
      detail: string | null;
    };

export function formatMoney(amount: number): string {
  return `S/${amount.toFixed(2)}`;
}
