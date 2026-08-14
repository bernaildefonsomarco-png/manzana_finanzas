import type {
  AccountType,
  CategoryId,
  Movement,
  MovementType,
} from "@/shared/types/domain";
import type { MovementPatch } from "@/core/finance/commands";
import { z } from "zod";
import { CATEGORY_IDS, MOVEMENT_TYPES } from "@/shared/types/domain";
import type { ConversationWorkingSet } from "@/agents/conversation-agent";

export type CorrectionMovementCandidate = Pick<
  Movement,
  | "id"
  | "type"
  | "amount"
  | "currency"
  | "description"
  | "merchant"
  | "category_id"
  | "occurred_at"
  | "created_at"
  | "status"
  | "account_origin_id"
  | "account_destination_id"
  | "metadata"
>;

export type CorrectionContextPack = {
  context_pack_type: "correction_context";
  version: "v1";
  user_id: string;
  locale: "es-PE";
  timezone: string;
  channel: "whatsapp" | "dashboard";
  original_message: string;
  received_at: string;
  recent_movements: CorrectionMovementCandidate[];
  accounts: CorrectionAccountCandidate[];
  categories: CorrectionCategoryCandidate[];
  /**
   * Las subcategorias activas de esta persona, que son las unicas que existen:
   * a diferencia de las 12 categorias, `user_subcategories` es un catalogo
   * propio de cada uno (`RUL-CAT`). Viajan aqui porque el agente compila
   * siempre contra ids del Context Pack: asi "ponlo en Animales" se resuelve
   * contra lo que la persona tiene de verdad, y nunca contra un id inventado
   * ni contra la etiqueta de otra cuenta (`SEG-04`).
   */
  subcategories: CorrectionSubcategoryCandidate[];
  active_conversation_state: {
    last_response_summary: string | null;
    continuity_hint: string | null;
    referenced_movement_ids: string[];
    working_set: ConversationWorkingSet | null;
  };
  recent_changes: Array<{
    movement_id: string | null;
    action: string;
    field_name: string | null;
    created_at: string;
  }>;
  undo_rules: string[];
};

export type CorrectionAccountCandidate = {
  id: string;
  name: string;
  type: AccountType;
  is_default: boolean;
};

export type CorrectionCategoryCandidate = {
  id: CategoryId;
  label: string;
  is_sensitive: boolean;
};

export type CorrectionSubcategoryCandidate = {
  id: string;
  category_id: CategoryId;
  label: string;
  normalized_label: string;
};

export type CorrectionCommandOperation = "patch" | "delete";

export type CorrectionCommandType =
  | "loan"
  | "amount"
  | "category"
  | "subcategory"
  | "account"
  | "delete";

export type CorrectionCommand = {
  command_id: string;
  movement_id: string;
  operation: CorrectionCommandOperation;
  correction_type: CorrectionCommandType;
  corrected_fields: MovementPatch | null;
  delete_mode: "soft_delete" | "reverse" | null;
  user_correction_text: string;
  summary: string;
  button_title: string;
  movement_label: string;
  target_label: string;
  target_type: MovementType | null;
  related_person_name: string | null;
};

export type SubcategoryClarification =
  | { kind: "not_found"; label: string }
  /** Etiquetas de las categorias donde ese mismo nombre existe. */
  | { kind: "ambiguous"; label: string; category_labels: string[] };

export type CorrectionAgentOutput =
  | {
      kind: "not_correction";
      reason: "message_not_supported";
      confidence: number;
    }
  | {
      kind: "unsupported";
      reason: "unsupported_correction_type";
      confidence: number;
      safe_explanation: string;
    }
  | {
      kind: "no_candidate";
      reason: "no_recent_movements";
      confidence: number;
      safe_explanation: string;
    }
  | {
      kind: "needs_clarification";
      reason:
        | "too_many_candidates"
        | "ambiguous_reference"
        /**
         * La persona nombro una subcategoria que no tiene. No se crea sola ni
         * se elige "la mas parecida": se le dice cual nombro y se le ofrece
         * crearla, que es la superficie que ya existe (`RUL-ESTR-01`).
         */
        | "subcategory_not_found"
        /**
         * Ese nombre existe colgando de dos categorias distintas ("Animales"
         * en Vivienda / Hogar y en Salud). Elegir una seria adivinar sobre el
         * dinero de alguien.
         */
        | "ambiguous_subcategory";
      confidence: number;
      safe_explanation: string;
      /**
       * Los datos con los que el planificador nombra el problema con
       * honestidad. Van estructurados y no como frase hecha porque la copia
       * que ve la persona la redacta el nucleo, nunca el modelo.
       */
      subcategory_clarification?: SubcategoryClarification;
    }
  | {
      kind: "requires_confirmation";
      reason: "single_candidate";
      confidence: number;
      command: CorrectionCommand;
      safe_explanation: string;
    }
  | {
      kind: "candidate_selection_required";
      reason: "multiple_candidates";
      confidence: number;
      commands: CorrectionCommand[];
      safe_explanation: string;
    };

export type CorrectionAgentRunResult = {
  output: CorrectionAgentOutput;
  runtime: {
    provider: string;
    model_name?: string;
    latency_ms: number;
    cost_estimate?: number;
  };
  safety: {
    policy_flags: string[];
    redaction_applied: boolean;
  };
};

/**
 * Semantic interpretation only. The model never emits a Core command or patch;
 * CorrectionAgent compiles this bounded proposal against Context Pack IDs.
 */
export const SemanticCorrectionInterpretationSchema = z.object({
  is_correction: z.boolean(),
  command_id: z.string().trim().min(1).max(80).nullable().default(null),
  operation: z.enum(["patch", "delete", "none"]),
  correction_type: z.enum([
    "loan",
    "amount",
    "category",
    "subcategory",
    "account",
    "delete",
    "unsupported",
    "none",
  ]),
  candidate_movement_ids: z.array(z.string().uuid()).max(3),
  target_amount: z.number().positive().nullable(),
  target_category_id: z.enum(CATEGORY_IDS).nullable(),
  /**
   * Id de una subcategoria **del Context Pack**. Nullable con `default` para
   * que un estado o fixture anterior a esta correccion siga validando: la
   * ausencia es "este turno no habla de ninguna subcategoria".
   *
   * El modelo no puede inventarlo: `compileSemanticCorrection` lo busca en
   * `subcategories` y, si no esta, no compila ningun comando (`SEG-04`).
   */
  target_subcategory_id: z.string().uuid().nullable().default(null),
  /**
   * El nombre tal cual lo dijo la persona, para poder contestarle con esa
   * misma palabra cuando la subcategoria no existe. Sin esto, el unico "no la
   * tengo" posible seria generico.
   */
  target_subcategory_label: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .nullable()
    .default(null),
  target_account_id: z.string().uuid().nullable(),
  target_movement_type: z.enum(MOVEMENT_TYPES).nullable(),
  related_person_name: z.string().min(1).max(120).nullable(),
  reference_resolution: z.enum([
    "single",
    "multiple",
    "ambiguous",
    "no_candidate",
  ]),
  confidence: z.number().min(0).max(1),
  requires_confirmation: z.boolean(),
  ambiguities: z.array(z.string().min(1).max(240)).max(5),
  safe_explanation: z.string().min(1).max(500),
  evidence_signals: z.array(z.string().min(1).max(240)).max(8),
});

export type SemanticCorrectionInterpretation = z.infer<
  typeof SemanticCorrectionInterpretationSchema
>;
