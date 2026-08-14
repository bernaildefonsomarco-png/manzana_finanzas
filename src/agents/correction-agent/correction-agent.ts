import type { MovementPatch } from "@/core/finance/commands";
import {
  createDefaultAgentRuntime,
  getAgentRuntimeTimeoutMs,
  getAgentRuntimeProvider,
  readAgentRuntimeConfig,
  type AgentRuntime,
  type RuntimeProvider,
} from "@/agents/runtime";
import type { CategoryId, MovementType } from "@/shared/types/domain";
import type {
  CorrectionAccountCandidate,
  CorrectionAgentOutput,
  CorrectionAgentRunResult,
  CorrectionCategoryCandidate,
  CorrectionCommand,
  CorrectionContextPack,
  CorrectionMovementCandidate,
  CorrectionSubcategoryCandidate,
  SemanticCorrectionInterpretation,
  SubcategoryClarification,
} from "./types";
import { getCategoryLabel } from "@/shared/copy/category-copy";
import { SemanticCorrectionInterpretationSchema } from "./types";

const CORRECTION_WINDOW_MINUTES = 15;
const MAX_SELECTABLE_CANDIDATES = 3;

type AccountField = "account_origin_id" | "account_destination_id";

type CorrectionTarget =
  | {
      kind: "loan";
      targetType: Extract<MovementType, "prestamo_dado" | "prestamo_recibido">;
      relatedPersonName: string;
      targetLabel: string;
    }
  | {
      kind: "amount";
      amount: number;
      targetLabel: string;
    }
  | {
      kind: "category";
      categoryId: CategoryId;
      categoryLabel: string;
      targetLabel: string;
    }
  /**
   * Mover un movimiento ya registrado a una subcategoria suya. Lleva tambien
   * la categoria de la que cuelga porque el movimiento se corrige entero: una
   * subcategoria sin su categoria madre deja la fila incoherente (`RUL-CAT`).
   */
  | {
      kind: "subcategory";
      subcategoryId: string;
      subcategoryLabel: string;
      categoryId: CategoryId;
      categoryLabel: string;
      targetLabel: string;
    }
  | {
      kind: "account";
      account: CorrectionAccountCandidate;
      targetLabel: string;
    }
  | {
      kind: "delete";
      targetLabel: string;
    };

const CATEGORY_SYNONYMS: Record<CategoryId, string[]> = {
  alimentacion: [
    "alimentacion",
    "comida",
    "desayuno",
    "almuerzo",
    "cena",
    "cafe",
    "cafeteria",
    "restaurante",
    "delivery",
    "menu",
  ],
  transporte: [
    "transporte",
    "taxi",
    "uber",
    "cabify",
    "bus",
    "pasaje",
    "metro",
    "metropolitano",
    "movilidad",
  ],
  vivienda_hogar: [
    "vivienda",
    "hogar",
    "casa",
    "alquiler",
    "renta",
    "mantenimiento",
  ],
  servicios_suscripciones: [
    "servicio",
    "servicios",
    "suscripcion",
    "suscripciones",
    "netflix",
    "spotify",
    "internet",
    "luz",
    "agua",
    "telefono",
  ],
  salud: ["salud", "farmacia", "medicina", "doctor", "medico", "clinica"],
  educacion: ["educacion", "curso", "libro", "universidad", "clase"],
  ocio_salidas: ["ocio", "salida", "salidas", "cine", "bar", "fiesta"],
  compras_personales: [
    "compra",
    "compras",
    "ropa",
    "zapatos",
    "personal",
    "tienda",
  ],
  familia_apoyo: ["familia", "apoyo", "ayuda", "mama", "papa", "hijo"],
  deudas: ["deuda", "deudas", "cuota", "prestamo"],
  trabajo_productividad: [
    "trabajo",
    "oficina",
    "productividad",
    "herramienta",
    "software",
  ],
  otros: ["otros", "otro", "varios"],
};

export class CorrectionAgent {
  constructor(
    private readonly runtime: AgentRuntime = createDefaultAgentRuntime(),
    private readonly provider: RuntimeProvider = getAgentRuntimeProvider(
      "correction_agent"
    ),
    private readonly fallbackToLocal: boolean = (() => {
      const config = readAgentRuntimeConfig();
      return config.localFixtureAllowed && config.fallbackToLocal;
    })()
  ) {}

  async propose(
    contextPack: CorrectionContextPack,
    traceId: string
  ): Promise<CorrectionAgentRunResult> {
    if (this.provider !== "local_fixture") {
      try {
        const response = await this.runtime.run<
          CorrectionContextPack,
          SemanticCorrectionInterpretation
        >({
          agent_name: "correction_agent",
          provider: this.provider,
          model_hint: "balanced",
          context_pack: contextPack,
          tools: [],
          output_schema: "SemanticCorrectionInterpretationSchema@v1",
          trace_id: traceId,
          timeout_ms: getAgentRuntimeTimeoutMs("correction_agent", 15_000),
        });
        const interpretation = SemanticCorrectionInterpretationSchema.parse(
          response.output
        );

        return {
          output: compileSemanticCorrection(contextPack, interpretation),
          runtime: response.runtime,
          safety: {
            ...response.safety,
            policy_flags: [
              ...response.safety.policy_flags,
              "semantic_correction_interpretation",
              "candidate_ids_bounded_by_context_pack",
              "no_direct_financial_write",
              "requires_user_confirmation",
              "core_command_required",
            ],
          },
        };
      } catch (error) {
        if (!this.fallbackToLocal) throw error;

        return localCorrectionResult(contextPack, [
          `runtime_fallback_from_${this.provider}`,
          "runtime_fallback_reason_semantic_correction_failed",
        ]);
      }
    }

    return localCorrectionResult(contextPack);
  }
}

function localCorrectionResult(
  contextPack: CorrectionContextPack,
  extraPolicyFlags: string[] = []
): CorrectionAgentRunResult {
    const startedAt = Date.now();
    const output = proposeCorrection(contextPack);

    return {
      output,
      runtime: {
        provider: "local_deterministic",
        model_name: "correction-agent-local-v1",
        latency_ms: Date.now() - startedAt,
      },
      safety: {
        policy_flags: [
          "no_direct_financial_write",
          "requires_user_confirmation",
          "core_command_required",
          ...extraPolicyFlags,
        ],
        redaction_applied: false,
      },
    };
}

export function compileSemanticCorrection(
  contextPack: CorrectionContextPack,
  interpretation: SemanticCorrectionInterpretation
): CorrectionAgentOutput {
  if (!interpretation.is_correction || interpretation.operation === "none") {
    return {
      kind: "not_correction",
      reason: "message_not_supported",
      confidence: interpretation.confidence,
    };
  }

  if (interpretation.correction_type === "unsupported") {
    return {
      kind: "unsupported",
      reason: "unsupported_correction_type",
      confidence: interpretation.confidence,
      safe_explanation: interpretation.safe_explanation,
    };
  }

  const candidatesById = new Map(
    contextPack.recent_movements
      .filter(isEligibleCorrectionCandidate)
      .map((movement) => [movement.id, movement])
  );
  const candidates = interpretation.candidate_movement_ids
    .map((id) => candidatesById.get(id))
    .filter((movement): movement is CorrectionMovementCandidate => Boolean(movement));

  if (
    interpretation.reference_resolution === "no_candidate" ||
    contextPack.recent_movements.length === 0
  ) {
    return {
      kind: "no_candidate",
      reason: "no_recent_movements",
      confidence: interpretation.confidence,
      safe_explanation: interpretation.safe_explanation,
    };
  }

  if (candidates.length === 0) {
    return {
      kind: "needs_clarification",
      reason: "ambiguous_reference",
      confidence: Math.min(interpretation.confidence, 0.69),
      safe_explanation:
        "No pude vincular la referencia con un movimiento disponible de forma segura.",
    };
  }

  if (interpretation.reference_resolution === "ambiguous") {
    return {
      kind: "needs_clarification",
      reason: "ambiguous_reference",
      confidence: Math.min(interpretation.confidence, 0.69),
      safe_explanation: interpretation.safe_explanation,
    };
  }

  const resolution = semanticTarget(contextPack, interpretation);
  if (!resolution) {
    return {
      kind: "needs_clarification",
      reason: "ambiguous_reference",
      confidence: Math.min(interpretation.confidence, 0.69),
      safe_explanation:
        "Entendi que quieres corregir algo, pero falta un dato seguro para preparar el cambio.",
    };
  }

  if (resolution.kind === "subcategory_clarification") {
    return subcategoryClarificationOutput(resolution.clarification);
  }

  const target = resolution.target;

  const commands = candidates.map((movement) =>
    buildCorrectionCommandForTarget({
      movement,
      target,
      userCorrectionText: contextPack.original_message,
    })
  );

  if (commands.length === 1 && commands[0]) {
    return {
      kind: "requires_confirmation",
      reason: "single_candidate",
      confidence: interpretation.confidence,
      command: commands[0],
      safe_explanation: interpretation.safe_explanation,
    };
  }

  return {
    kind: "candidate_selection_required",
    reason: "multiple_candidates",
    confidence: interpretation.confidence,
    commands: commands.slice(0, MAX_SELECTABLE_CANDIDATES),
    safe_explanation: interpretation.safe_explanation,
  };
}

function isEligibleCorrectionCandidate(
  movement: CorrectionMovementCandidate
): boolean {
  return (
    movement.status !== "deleted" &&
    movement.status !== "reversed" &&
    movement.type !== "transferencia" &&
    movement.type !== "asignacion_interna"
  );
}

/**
 * `ERR-ASI-01`: cuando el problema es la subcategoria, el turno lo dice con esa
 * palabra en vez de esconderlo en "no pude elegir un movimiento". La confianza
 * queda por debajo del umbral de accion a proposito: esto no ejecuta nada.
 */
function subcategoryClarificationOutput(
  clarification: SubcategoryClarification
): CorrectionAgentOutput {
  return {
    kind: "needs_clarification",
    reason:
      clarification.kind === "not_found"
        ? "subcategory_not_found"
        : "ambiguous_subcategory",
    confidence: 0.6,
    safe_explanation:
      clarification.kind === "not_found"
        ? `No existe una subcategoria llamada "${clarification.label}".`
        : `"${clarification.label}" existe en mas de una categoria.`,
    subcategory_clarification: clarification,
  };
}

function semanticTarget(
  contextPack: CorrectionContextPack,
  interpretation: SemanticCorrectionInterpretation
): CorrectionTargetResolution | null {
  if (
    interpretation.operation === "delete" &&
    interpretation.correction_type === "delete"
  ) {
    return asTarget({ kind: "delete", targetLabel: "eliminar este movimiento" });
  }

  if (
    interpretation.operation !== "patch" ||
    interpretation.correction_type === "delete"
  ) {
    return null;
  }

  if (
    interpretation.correction_type === "amount" &&
    interpretation.target_amount !== null
  ) {
    const amount = roundToTwoDecimals(interpretation.target_amount);
    return asTarget({
      kind: "amount",
      amount,
      targetLabel: `monto ${formatMoney(amount, "PEN")}`,
    });
  }

  if (interpretation.correction_type === "subcategory") {
    return semanticSubcategoryTarget(contextPack, interpretation);
  }

  if (
    interpretation.correction_type === "category" &&
    interpretation.target_category_id
  ) {
    const category = contextPack.categories.find(
      (candidate) => candidate.id === interpretation.target_category_id
    );
    if (!category) return null;
    return asTarget({
      kind: "category",
      categoryId: category.id,
      categoryLabel: category.label,
      targetLabel: `categoria ${category.label}`,
    });
  }

  if (
    interpretation.correction_type === "account" &&
    interpretation.target_account_id
  ) {
    const account = contextPack.accounts.find(
      (candidate) => candidate.id === interpretation.target_account_id
    );
    if (!account) return null;
    return asTarget({
      kind: "account",
      account,
      targetLabel: `cuenta ${account.name}`,
    });
  }

  if (
    interpretation.correction_type === "loan" &&
    (interpretation.target_movement_type === "prestamo_dado" ||
      interpretation.target_movement_type === "prestamo_recibido") &&
    interpretation.related_person_name
  ) {
    const relatedPersonName = interpretation.related_person_name.trim();
    return asTarget({
      kind: "loan",
      targetType: interpretation.target_movement_type,
      relatedPersonName,
      targetLabel:
        interpretation.target_movement_type === "prestamo_dado"
          ? `prestamo a ${relatedPersonName}`
          : `prestamo de ${relatedPersonName}`,
    });
  }

  return null;
}

/**
 * El modelo puede senalar la subcategoria por id o solo repetir el nombre que
 * oyo. En los dos casos manda el Context Pack: un id que no este en la lista
 * **no se usa** —seria escribir sobre una etiqueta que este turno no leyo, y
 * podria no ser de esta persona (`SEG-04`)— y un nombre se resuelve contra el
 * catalogo propio con las mismas reglas que el camino local.
 */
function semanticSubcategoryTarget(
  contextPack: CorrectionContextPack,
  interpretation: SemanticCorrectionInterpretation
): CorrectionTargetResolution | null {
  const spokenLabel = interpretation.target_subcategory_label?.trim() ?? null;

  if (interpretation.target_subcategory_id) {
    const known = contextPack.subcategories.find(
      (candidate) => candidate.id === interpretation.target_subcategory_id
    );
    if (known) return asTarget(subcategoryTarget(known));
    if (!spokenLabel) return null;
  }

  if (!spokenLabel) return null;

  const homonyms = contextPack.subcategories.filter(
    (candidate) =>
      normalize(candidate.label) === normalize(spokenLabel) ||
      containsPhrase(normalize(spokenLabel), normalize(candidate.label))
  );

  if (homonyms.length === 0) {
    return {
      kind: "subcategory_clarification",
      clarification: { kind: "not_found", label: spokenLabel },
    };
  }

  if (homonyms.length > 1) {
    return {
      kind: "subcategory_clarification",
      clarification: {
        kind: "ambiguous",
        label: homonyms[0]!.label,
        category_labels: homonyms.map((candidate) =>
          categoryLabelOf(candidate.category_id)
        ),
      },
    };
  }

  return asTarget(subcategoryTarget(homonyms[0]!));
}

export function proposeCorrection(
  contextPack: CorrectionContextPack
): CorrectionAgentOutput {
  const resolution = extractCorrectionTarget(contextPack);
  if (!resolution) {
    return {
      kind: "not_correction",
      reason: "message_not_supported",
      confidence: 0.1,
    };
  }

  if (resolution.kind === "subcategory_clarification") {
    return subcategoryClarificationOutput(resolution.clarification);
  }

  const target = resolution.target;

  if (target.kind === "account" && contextPack.accounts.length === 0) {
    return {
      kind: "unsupported",
      reason: "unsupported_correction_type",
      confidence: 0.68,
      safe_explanation:
        "No encontre cuentas activas para aplicar esa correccion con seguridad.",
    };
  }

  if (contextPack.recent_movements.length === 0) {
    return {
      kind: "no_candidate",
      reason: "no_recent_movements",
      confidence: 0.72,
      safe_explanation:
        "No encontre un movimiento reciente para corregir con seguridad.",
    };
  }

  const candidates = pickRecentCandidates(contextPack);
  if (candidates.length === 0) {
    return {
      kind: "no_candidate",
      reason: "no_recent_movements",
      confidence: 0.72,
      safe_explanation:
        "No encontre un movimiento reciente para corregir con seguridad.",
    };
  }

  if (candidates.length > MAX_SELECTABLE_CANDIDATES) {
    return {
      kind: "needs_clarification",
      reason: "too_many_candidates",
      confidence: 0.7,
      safe_explanation:
        "Hay demasiados movimientos recientes para elegir uno con seguridad.",
    };
  }

  const commands = candidates.map((movement) =>
    buildCorrectionCommandForTarget({
      movement,
      target,
      userCorrectionText: contextPack.original_message,
    })
  );

  if (commands.length === 1 && commands[0]) {
    return {
      kind: "requires_confirmation",
      reason: "single_candidate",
      confidence: 0.87,
      command: commands[0],
      safe_explanation:
        "Encontre un movimiento reciente que coincide, pero necesito confirmacion antes de corregirlo.",
    };
  }

  if (commands.length <= MAX_SELECTABLE_CANDIDATES) {
    return {
      kind: "candidate_selection_required",
      reason: "multiple_candidates",
      confidence: 0.82,
      commands,
      safe_explanation:
        "Hay varios movimientos recientes posibles. El usuario debe elegir cual corregir.",
    };
  }

  return {
    kind: "needs_clarification",
    reason: "ambiguous_reference",
    confidence: 0.7,
    safe_explanation: "No pude elegir el movimiento con seguridad.",
  };
}

export function buildLoanCorrectionCommand(params: {
  movement: CorrectionMovementCandidate;
  targetType: Extract<MovementType, "prestamo_dado" | "prestamo_recibido">;
  relatedPersonName: string;
  userCorrectionText: string;
}): CorrectionCommand {
  const patch = buildLoanCorrectionPatch({
    targetType: params.targetType,
    relatedPersonName: params.relatedPersonName,
  });
  const personSlug = slugifyPersonName(params.relatedPersonName);
  const movementLabel = buildMovementLabel(params.movement);
  const targetLabel =
    params.targetType === "prestamo_dado"
      ? `prestamo a ${params.relatedPersonName}`
      : `prestamo de ${params.relatedPersonName}`;

  return {
    command_id: `corr:${params.targetType === "prestamo_dado" ? "loan_to" : "loan_from"}:${params.movement.id}:${personSlug}`,
    movement_id: params.movement.id,
    operation: "patch",
    correction_type: "loan",
    corrected_fields: patch,
    delete_mode: null,
    user_correction_text: params.userCorrectionText,
    summary:
      params.targetType === "prestamo_dado"
        ? `Cambiar a prestamo a ${params.relatedPersonName}`
        : `Cambiar a prestamo de ${params.relatedPersonName}`,
    button_title: truncateButtonTitle(movementLabel),
    movement_label: movementLabel,
    target_label: targetLabel,
    target_type: params.targetType,
    related_person_name: params.relatedPersonName,
  };
}

export function buildLoanCorrectionPatch(params: {
  targetType: Extract<MovementType, "prestamo_dado" | "prestamo_recibido">;
  relatedPersonName: string;
}): MovementPatch {
  const isLoanGiven = params.targetType === "prestamo_dado";
  const description = isLoanGiven
    ? `Prestamo a ${params.relatedPersonName}`
    : `Prestamo de ${params.relatedPersonName}`;

  return {
    type: params.targetType,
    description,
    merchant: null,
    category_id: null,
    related_person_id: null,
    debt_id: null,
    metadata: {
      generated_by: "correction_agent",
      correction_target_type: params.targetType,
      related_person_name: params.relatedPersonName,
    },
  };
}

export function buildAmountCorrectionPatch(params: {
  amount: number;
}): MovementPatch {
  return {
    amount: params.amount,
    metadata: {
      generated_by: "correction_agent",
      correction_target_type: "amount",
      corrected_amount: params.amount,
    },
  };
}

export function buildCategoryCorrectionPatch(params: {
  categoryId: CategoryId;
  categoryLabel: string;
}): MovementPatch {
  return {
    category_id: params.categoryId,
    subcategory_id: null,
    metadata: {
      generated_by: "correction_agent",
      correction_target_type: "category",
      corrected_category_id: params.categoryId,
      corrected_category_label: params.categoryLabel,
    },
  };
}

/**
 * Mover un movimiento a una subcategoria escribe **las dos** columnas: la
 * subcategoria y la categoria de la que cuelga. Escribir solo la primera
 * dejaria un gasto de "Alimentacion" apuntando a una etiqueta de "Vivienda /
 * Hogar", que es justo la incoherencia que `commit_movement_classification`
 * rechaza en la pantalla (`SUBCATEGORY_NOT_FOUND` cuando `category_id` no
 * coincide). Por el mismo motivo `buildCategoryCorrectionPatch` limpia la
 * subcategoria: cambiar de categoria invalida la etiqueta anterior.
 */
export function buildSubcategoryCorrectionPatch(params: {
  subcategoryId: string;
  subcategoryLabel: string;
  categoryId: CategoryId;
  categoryLabel: string;
}): MovementPatch {
  return {
    category_id: params.categoryId,
    subcategory_id: params.subcategoryId,
    metadata: {
      generated_by: "correction_agent",
      correction_target_type: "subcategory",
      corrected_category_id: params.categoryId,
      corrected_category_label: params.categoryLabel,
      corrected_subcategory_id: params.subcategoryId,
      corrected_subcategory_label: params.subcategoryLabel,
    },
  };
}

export function buildAccountCorrectionPatch(params: {
  accountId: string;
  accountName: string;
  accountField: AccountField;
}): MovementPatch {
  const patch: MovementPatch = {
    metadata: {
      generated_by: "correction_agent",
      correction_target_type: "account",
      corrected_account_id: params.accountId,
      corrected_account_name: params.accountName,
      corrected_account_field: params.accountField,
    },
  };

  patch[params.accountField] = params.accountId;

  return patch;
}

export function isCorrectionLikeText(value: string): boolean {
  const text = normalize(value);
  if (!text) return false;
  // "ponlo en Animales" no lleva ningun verbo de correccion clasico y sin
  // embargo pide exactamente eso: cambiar como quedo clasificado algo que ya
  // esta registrado. Sin estos verbos el turno se iba por el camino de
  // captura y respondia "no encontre algo reciente para registrar".
  return /\b(no fue|no era|fue|era|eran|fueron|corrige|corregir|correccion|cambia|cambiar|monto|categoria|subcategoria|cuenta|tarjeta|efectivo|prestamo|preste|me presto|ponlo|ponla|metelo|metela|muevelo|muevela|pasalo|pasala|mandalo|mandala|clasificalo|clasificala|borra|borralo|elimina|eliminalo|anula|anulalo|quita|quitalo|cancela|cancelalo|descarta|descartar|descartalo|deshaz|deshacer|deshazlo|olvida|olvidalo)\b/.test(
    text
  );
}

export function restorePersonNameFromSlug(slug: string): string {
  const normalized = slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .trim();

  return normalized || "esa persona";
}

function buildCorrectionCommandForTarget(params: {
  movement: CorrectionMovementCandidate;
  target: CorrectionTarget;
  userCorrectionText: string;
}): CorrectionCommand {
  const { movement, target } = params;

  if (target.kind === "loan") {
    return buildLoanCorrectionCommand({
      movement,
      targetType: target.targetType,
      relatedPersonName: target.relatedPersonName,
      userCorrectionText: params.userCorrectionText,
    });
  }

  if (target.kind === "amount") {
    return buildAmountCorrectionCommand({
      movement,
      amount: target.amount,
      targetLabel: target.targetLabel,
      userCorrectionText: params.userCorrectionText,
    });
  }

  if (target.kind === "category") {
    return buildCategoryCorrectionCommand({
      movement,
      categoryId: target.categoryId,
      categoryLabel: target.categoryLabel,
      targetLabel: target.targetLabel,
      userCorrectionText: params.userCorrectionText,
    });
  }

  if (target.kind === "subcategory") {
    return buildSubcategoryCorrectionCommand({
      movement,
      target,
      userCorrectionText: params.userCorrectionText,
    });
  }

  if (target.kind === "account") {
    return buildAccountCorrectionCommand({
      movement,
      account: target.account,
      targetLabel: target.targetLabel,
      userCorrectionText: params.userCorrectionText,
    });
  }

  return buildDeleteCorrectionCommand({
    movement,
    targetLabel: target.targetLabel,
    userCorrectionText: params.userCorrectionText,
  });
}

function buildAmountCorrectionCommand(params: {
  movement: CorrectionMovementCandidate;
  amount: number;
  targetLabel: string;
  userCorrectionText: string;
}): CorrectionCommand {
  const movementLabel = buildMovementLabel(params.movement);
  const formattedAmount = formatMoney(params.amount, params.movement.currency);

  return {
    command_id: `corr:amount:${params.movement.id}:${encodeAmountToken(
      params.amount
    )}`,
    movement_id: params.movement.id,
    operation: "patch",
    correction_type: "amount",
    corrected_fields: buildAmountCorrectionPatch({ amount: params.amount }),
    delete_mode: null,
    user_correction_text: params.userCorrectionText,
    summary: `Cambiar monto a ${formattedAmount}`,
    button_title: truncateButtonTitle(movementLabel),
    movement_label: movementLabel,
    target_label: params.targetLabel,
    target_type: null,
    related_person_name: null,
  };
}

function buildCategoryCorrectionCommand(params: {
  movement: CorrectionMovementCandidate;
  categoryId: CategoryId;
  categoryLabel: string;
  targetLabel: string;
  userCorrectionText: string;
}): CorrectionCommand {
  const movementLabel = buildMovementLabel(params.movement);

  return {
    command_id: `corr:category:${params.movement.id}:${params.categoryId}`,
    movement_id: params.movement.id,
    operation: "patch",
    correction_type: "category",
    corrected_fields: buildCategoryCorrectionPatch({
      categoryId: params.categoryId,
      categoryLabel: params.categoryLabel,
    }),
    delete_mode: null,
    user_correction_text: params.userCorrectionText,
    summary: `Cambiar categoria a ${params.categoryLabel}`,
    button_title: truncateButtonTitle(movementLabel),
    movement_label: movementLabel,
    target_label: params.targetLabel,
    target_type: null,
    related_person_name: null,
  };
}

function buildSubcategoryCorrectionCommand(params: {
  movement: CorrectionMovementCandidate;
  target: Extract<CorrectionTarget, { kind: "subcategory" }>;
  userCorrectionText: string;
}): CorrectionCommand {
  const movementLabel = buildMovementLabel(params.movement);
  const { target } = params;

  return {
    // El id de la subcategoria viaja entero en el comando y no su nombre: el
    // boton se pulsa turnos despues, y para entonces la etiqueta puede
    // haberse renombrado. El id es lo unico que sigue senalando lo mismo.
    command_id: `corr:subcategory:${params.movement.id}:${target.subcategoryId}`,
    movement_id: params.movement.id,
    operation: "patch",
    correction_type: "subcategory",
    corrected_fields: buildSubcategoryCorrectionPatch({
      subcategoryId: target.subcategoryId,
      subcategoryLabel: target.subcategoryLabel,
      categoryId: target.categoryId,
      categoryLabel: target.categoryLabel,
    }),
    delete_mode: null,
    user_correction_text: params.userCorrectionText,
    summary: `Mover a ${target.subcategoryLabel}`,
    button_title: truncateButtonTitle(movementLabel),
    movement_label: movementLabel,
    target_label: target.targetLabel,
    target_type: null,
    related_person_name: null,
  };
}

function buildAccountCorrectionCommand(params: {
  movement: CorrectionMovementCandidate;
  account: CorrectionAccountCandidate;
  targetLabel: string;
  userCorrectionText: string;
}): CorrectionCommand {
  const movementLabel = buildMovementLabel(params.movement);
  const accountField = chooseAccountField(params.movement);

  return {
    command_id: `corr:${accountField === "account_origin_id" ? "acct_origin" : "acct_destination"}:${params.movement.id}:${params.account.id}`,
    movement_id: params.movement.id,
    operation: "patch",
    correction_type: "account",
    corrected_fields: buildAccountCorrectionPatch({
      accountId: params.account.id,
      accountName: params.account.name,
      accountField,
    }),
    delete_mode: null,
    user_correction_text: params.userCorrectionText,
    summary: `Cambiar cuenta a ${params.account.name}`,
    button_title: truncateButtonTitle(movementLabel),
    movement_label: movementLabel,
    target_label: params.targetLabel,
    target_type: null,
    related_person_name: null,
  };
}

function buildDeleteCorrectionCommand(params: {
  movement: CorrectionMovementCandidate;
  targetLabel: string;
  userCorrectionText: string;
}): CorrectionCommand {
  const movementLabel = buildMovementLabel(params.movement);

  return {
    command_id: `corr:delete:${params.movement.id}`,
    movement_id: params.movement.id,
    operation: "delete",
    correction_type: "delete",
    corrected_fields: null,
    delete_mode: "soft_delete",
    user_correction_text: params.userCorrectionText,
    summary: "Eliminar movimiento",
    button_title: truncateButtonTitle(movementLabel),
    movement_label: movementLabel,
    target_label: params.targetLabel,
    target_type: null,
    related_person_name: null,
  };
}

/**
 * Lo que el mensaje pide corregir, o —cuando lo pide sobre una subcategoria
 * que no se puede resolver— por que no se puede. Ese segundo caso no es "no
 * entendi": es "entendi, y esto es lo que pasa", y se contesta con nombre
 * propio en vez de caer en la aclaracion generica.
 */
type CorrectionTargetResolution =
  | { kind: "target"; target: CorrectionTarget }
  | {
      kind: "subcategory_clarification";
      clarification: SubcategoryClarification;
    };

function extractCorrectionTarget(
  contextPack: CorrectionContextPack
): CorrectionTargetResolution | null {
  const loanTarget = extractLoanCorrectionTarget(contextPack.original_message);
  if (loanTarget) {
    return asTarget({
      kind: "loan",
      targetType: loanTarget.type,
      relatedPersonName: loanTarget.relatedPersonName,
      targetLabel:
        loanTarget.type === "prestamo_dado"
          ? `prestamo a ${loanTarget.relatedPersonName}`
          : `prestamo de ${loanTarget.relatedPersonName}`,
    });
  }

  const amountTarget = extractAmountCorrectionTarget(contextPack.original_message);
  if (amountTarget) return asTarget(amountTarget);

  // La subcategoria va **antes** que la categoria porque es la lectura mas
  // especifica de la misma frase: "ponlo en Mascotas" nombra una etiqueta
  // propia de la persona, y solo si ninguna coincide tiene sentido leer esa
  // palabra como una de las 12 categorias del catalogo.
  const subcategoryResolution = extractSubcategoryCorrectionTarget(
    contextPack.original_message,
    contextPack.subcategories,
    contextPack.categories
  );
  if (subcategoryResolution) return subcategoryResolution;

  const categoryTarget = extractCategoryCorrectionTarget(
    contextPack.original_message,
    contextPack.categories
  );
  if (categoryTarget) return asTarget(categoryTarget);

  const accountTarget = extractAccountCorrectionTarget(
    contextPack.original_message,
    contextPack.accounts
  );
  if (accountTarget) return asTarget(accountTarget);

  const deleteTarget = extractDeleteCorrectionTarget(contextPack.original_message);
  if (deleteTarget) return asTarget(deleteTarget);

  return null;
}

function asTarget(target: CorrectionTarget): CorrectionTargetResolution {
  return { kind: "target", target };
}

/**
 * Verbos con los que se pide mover algo ya registrado a un sitio: "ponlo en",
 * "metelo en", "muevelo a", "pasalo a". La preposicion es obligatoria porque
 * sin ella "cambia" tambien abre correcciones de monto y de cuenta, y este
 * extractor corre antes que aquellos.
 */
const SUBCATEGORY_ASSIGNMENT_CUE =
  /\b(?:ponlo|ponla|pon|metelo|metela|mete|meter|muevelo|muevela|mueve|mover|mandalo|mandala|manda|pasalo|pasala|pasa|clasificalo|clasificala|clasifica|cambialo|cambiala|cambia|va|van|guardalo|guardala)\s+(?:en|a|al|para|dentro\s+de)\s+(?:la\s+|el\s+|los\s+|las\s+)?(?:sub\s?categoria\s+(?:de\s+)?)?(.+)$/;

/** "en la subcategoria Animales", sin verbo de movimiento delante. */
const SUBCATEGORY_NOUN_CUE =
  /\bsub\s?categoria\s+(?:de\s+)?(?:la\s+|el\s+)?(.+)$/;

/**
 * Resuelve "ponlo en Animales" contra el catalogo propio de la persona.
 *
 * Devuelve `null` —y no una aclaracion— cuando el nombre que sigue al verbo es
 * una de las 12 categorias: ahi la frase no habla de ninguna subcategoria y le
 * toca a `extractCategoryCorrectionTarget`. Decir "no tienes esa
 * subcategoria" ante "ponlo en transporte" seria contestar una pregunta que
 * nadie hizo.
 */
function extractSubcategoryCorrectionTarget(
  value: string,
  subcategories: CorrectionSubcategoryCandidate[],
  categories: CorrectionCategoryCandidate[]
): CorrectionTargetResolution | null {
  const text = normalize(value);
  if (!text) return null;

  const spokenName =
    text.match(SUBCATEGORY_ASSIGNMENT_CUE)?.[1] ??
    text.match(SUBCATEGORY_NOUN_CUE)?.[1];
  if (!spokenName) return null;

  const named = subcategories.filter((subcategory) =>
    containsPhrase(text, normalize(subcategory.label))
  );

  if (named.length === 0) {
    // Sin coincidencia propia, la frase puede seguir hablando de una categoria
    // canonica. Si es asi, este extractor se aparta en silencio.
    if (matchesKnownCategory(spokenName, categories)) return null;
    return {
      kind: "subcategory_clarification",
      clarification: {
        kind: "not_found",
        label: titleCasePersonName(spokenName.trim()),
      },
    };
  }

  // La mencion mas larga gana: entre "Animales" y "Animales de granja", la
  // segunda es la que la persona dijo entera.
  const longest = named.reduce((best, candidate) =>
    candidate.label.length > best.label.length ? candidate : best
  );
  const homonyms = named.filter(
    (candidate) => candidate.normalized_label === longest.normalized_label
  );

  const disambiguated =
    homonyms.length > 1
      ? homonyms.filter((candidate) =>
          containsPhrase(text, normalize(categoryLabelOf(candidate.category_id)))
        )
      : homonyms;

  if (disambiguated.length !== 1) {
    return {
      kind: "subcategory_clarification",
      clarification: {
        kind: "ambiguous",
        label: longest.label,
        category_labels: homonyms.map((candidate) =>
          categoryLabelOf(candidate.category_id)
        ),
      },
    };
  }

  return asTarget(subcategoryTarget(disambiguated[0]!));
}

function subcategoryTarget(
  subcategory: CorrectionSubcategoryCandidate
): CorrectionTarget {
  const categoryLabel = categoryLabelOf(subcategory.category_id);
  return {
    kind: "subcategory",
    subcategoryId: subcategory.id,
    subcategoryLabel: subcategory.label,
    categoryId: subcategory.category_id,
    categoryLabel,
    targetLabel: `${subcategory.label}, dentro de ${categoryLabel}`,
  };
}

/**
 * La categoria se nombra siempre como la nombra el catalogo —"Vivienda /
 * Hogar"— y nunca con su id. `getCategoryLabel` solo devuelve `null` con la
 * cadena vacia, que el tipo `CategoryId` ya impide.
 */
function categoryLabelOf(categoryId: CategoryId): string {
  return getCategoryLabel(categoryId) ?? categoryId;
}

function matchesKnownCategory(
  spokenName: string,
  categories: CorrectionCategoryCandidate[]
): boolean {
  const text = normalize(spokenName);
  if (!text) return false;

  const knownCategories = new Map(
    categories.map((category) => [category.id, category])
  );
  return (Object.entries(CATEGORY_SYNONYMS) as Array<[CategoryId, string[]]>).some(
    ([categoryId, synonyms]) => {
      const label =
        knownCategories.get(categoryId)?.label ?? categoryLabelOf(categoryId);
      return [label, ...synonyms]
        .map(normalize)
        .some((phrase) => phrase !== "" && containsPhrase(text, phrase));
    }
  );
}

function extractLoanCorrectionTarget(
  value: string
): {
  type: Extract<MovementType, "prestamo_dado" | "prestamo_recibido">;
  relatedPersonName: string;
} | null {
  const text = normalize(value);
  if (!text) return null;

  const loanTo =
    text.match(
      /\b(?:fue|era|es|como)\s+(?:un\s+)?prestamo\s+(?:a|para)\s+([a-z0-9]+(?:\s+[a-z0-9]+){0,3})\b/
    ) ??
    text.match(/\b(?:le\s+)?preste\s+(?:a|para)\s+([a-z0-9]+(?:\s+[a-z0-9]+){0,3})\b/);

  if (loanTo?.[1]) {
    return {
      type: "prestamo_dado",
      relatedPersonName: titleCasePersonName(loanTo[1]),
    };
  }

  const loanFrom =
    text.match(
      /\b(?:fue|era|es|como)\s+(?:un\s+)?prestamo\s+(?:de|del)\s+([a-z0-9]+(?:\s+[a-z0-9]+){0,3})\b/
    ) ?? text.match(/\bme\s+presto\s+([a-z0-9]+(?:\s+[a-z0-9]+){0,3})\b/);

  if (loanFrom?.[1]) {
    return {
      type: "prestamo_recibido",
      relatedPersonName: titleCasePersonName(loanFrom[1]),
    };
  }

  return null;
}

function extractAmountCorrectionTarget(value: string): CorrectionTarget | null {
  const text = normalizeForAmount(value);
  if (!text) return null;

  const looksLikeAmountCorrection =
    /\b(monto|fueron|eran|era|fue|corrige|cambia|cambiar|no fueron|no era)\b/.test(
      text
    ) && /\d/.test(text);

  if (!looksLikeAmountCorrection) return null;

  const values = [...text.matchAll(/(?:s\/?\s*)?(\d+(?:\.\d{1,2})?)/g)]
    .map((match) => Number(match[1]))
    .filter((amount) => Number.isFinite(amount) && amount > 0);

  const amount = values.at(-1);
  if (!amount) return null;

  return {
    kind: "amount",
    amount: roundToTwoDecimals(amount),
    targetLabel: `monto ${formatMoney(roundToTwoDecimals(amount), "PEN")}`,
  };
}

function extractCategoryCorrectionTarget(
  value: string,
  categories: CorrectionCategoryCandidate[]
): CorrectionTarget | null {
  const text = normalize(value);
  if (!text) return null;

  const shouldTryCategory =
    /\b(categoria|categorizar|fue|era|es|como|cambia|corrige)\b/.test(text) &&
    !/\b(cuenta|tarjeta|efectivo|monto|fueron|eran)\b/.test(text);

  if (!shouldTryCategory) return null;

  const knownCategories = new Map(categories.map((category) => [category.id, category]));
  let bestMatch: { id: CategoryId; label: string; score: number } | null = null;

  for (const [categoryId, synonyms] of Object.entries(CATEGORY_SYNONYMS) as Array<
    [CategoryId, string[]]
  >) {
    const category = knownCategories.get(categoryId);
    const label = category?.label ?? humanize(categoryId.replace(/_/g, " "));
    const phrases = [label, ...synonyms].map(normalize).filter(Boolean);
    const score = phrases.reduce((max, phrase) => {
      if (!phrase || !containsPhrase(text, phrase)) return max;
      return Math.max(max, phrase.length);
    }, 0);

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { id: categoryId, label, score };
    }
  }

  if (!bestMatch) return null;

  return {
    kind: "category",
    categoryId: bestMatch.id,
    categoryLabel: bestMatch.label,
    targetLabel: `categoria ${bestMatch.label}`,
  };
}

function extractAccountCorrectionTarget(
  value: string,
  accounts: CorrectionAccountCandidate[]
): CorrectionTarget | null {
  const text = normalize(value);
  if (!text || accounts.length === 0) return null;

  const shouldTryAccount =
    /\b(cuenta|tarjeta|efectivo|banco|pague|pague con|fue con|desde|con)\b/.test(
      text
    ) || accounts.some((account) => containsPhrase(text, normalize(account.name)));

  if (!shouldTryAccount) return null;

  const ranked = accounts
    .map((account) => {
      const normalizedName = normalize(account.name);
      let score = containsPhrase(text, normalizedName) ? normalizedName.length : 0;

      if (account.type === "fisico" && /\befectivo\b/.test(text)) score += 20;
      if (account.type === "tarjeta" && /\btarjeta\b/.test(text)) score += 10;
      if (account.type === "banco" && /\bbanco\b/.test(text)) score += 8;
      if (account.is_default && score > 0) score += 1;

      return { account, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  const top = ranked[0];
  if (!top) return null;

  if (ranked[1] && ranked[1].score === top.score) {
    return null;
  }

  return {
    kind: "account",
    account: top.account,
    targetLabel: `cuenta ${top.account.name}`,
  };
}

function extractDeleteCorrectionTarget(value: string): CorrectionTarget | null {
  const text = normalize(value);
  if (!text) return null;

  const hasDeleteVerb = /\b(borra|borrar|borralo|elimina|eliminar|eliminalo|anula|anular|anulalo|quita|quitar|quitalo|cancela|cancelar|cancelalo|descarta|descartar|descartalo|deshaz|deshacer|deshazlo|olvida|olvidar|olvidalo)\b/.test(
    text
  );
  const hasReference =
    /\b(eso|esto|ese|esa|este|esta|lo|movimiento|gasto|ingreso|registro)\b/.test(
      text
    ) ||
    /\b(borralo|eliminalo|anulalo|quitalo|cancelalo|descartalo|deshazlo|olvidalo)\b/.test(
      text
    );

  if (!hasDeleteVerb || !hasReference) return null;

  return {
    kind: "delete",
    targetLabel: "eliminar este movimiento",
  };
}

function pickRecentCandidates(
  contextPack: CorrectionContextPack
): CorrectionMovementCandidate[] {
  const receivedAt = Date.parse(contextPack.received_at);
  const correctionWindowMs = CORRECTION_WINDOW_MINUTES * 60 * 1000;
  const eligible = contextPack.recent_movements.filter(
    (movement) =>
      movement.status !== "deleted" &&
      movement.status !== "reversed" &&
      movement.type !== "transferencia" &&
      movement.type !== "asignacion_interna"
  );

  if (!Number.isFinite(receivedAt)) {
    return eligible;
  }

  const recent = eligible.filter((movement) => {
    const createdAt = Date.parse(movement.created_at);
    return (
      Number.isFinite(createdAt) &&
      createdAt <= receivedAt &&
      receivedAt - createdAt <= correctionWindowMs
    );
  });

  return recent.length > 0 ? recent : eligible.slice(0, MAX_SELECTABLE_CANDIDATES);
}

function chooseAccountField(movement: CorrectionMovementCandidate): AccountField {
  if (
    movement.type === "ingreso" ||
    movement.type === "prestamo_recibido" ||
    movement.type === "devolucion_recibida"
  ) {
    return "account_destination_id";
  }

  return "account_origin_id";
}

function buildMovementLabel(movement: CorrectionMovementCandidate): string {
  const description = humanize(
    movement.description ?? movement.merchant ?? movement.type
  );
  return `${description} ${formatMoney(movement.amount, movement.currency)}`;
}

function formatMoney(amount: number, currency: "PEN" | "USD"): string {
  const symbol = currency === "USD" ? "$" : "S/";
  const value = amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2);
  return `${symbol}${value}`;
}

function humanize(value: string): string {
  const text = value.trim() || "Movimiento";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function truncateButtonTitle(value: string): string {
  if (value.length <= 20) return value;
  return value.slice(0, 17).trimEnd() + "...";
}

function titleCasePersonName(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function slugifyPersonName(value: string): string {
  return normalize(value)
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48)
    .replace(/^-|-$/g, "");
}

function containsPhrase(text: string, phrase: string): boolean {
  if (!phrase) return false;
  return new RegExp(`\\b${escapeRegExp(phrase)}\\b`).test(text);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function encodeAmountToken(amount: number): string {
  return amount.toFixed(2).replace(".", "_");
}

function roundToTwoDecimals(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function normalizeForAmount(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/,/g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
