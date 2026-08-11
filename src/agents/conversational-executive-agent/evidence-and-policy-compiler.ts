import type { ConversationToolResult } from "@/agents/conversation-agent/types";
import { esComandoConocido } from "@/core/catalog";
import type {
  ConversationalExecutiveContextPack,
  ConversationalExecutiveOutput,
} from "./types";

export type ExecutivePolicyIssueCode =
  | "amount_without_evidence"
  | "date_without_evidence"
  | "category_outside_context"
  | "category_without_evidence"
  | "reference_outside_focus"
  | "tool_declared_not_executed"
  | "tool_used_not_executed"
  | "claim_without_known_evidence"
  | "claim_source_tool_not_executed"
  | "missing_grounded_claims"
  | "premature_write_claim"
  | "invalid_composition_stage"
  | "debt_action_without_specialized_hint"
  | "command_outside_catalog"
  | "figure_without_assumptions"
  | "world_knowledge_promoted"
  | "focus_expired"
  // `WEB-D297`: la coherencia entre modulos dejo de lanzar por su cuenta y
  // entrega incidencias con la misma forma que las de evidencia. Un fallo de
  // grounding es tan "esta mal dicho" como un claim sin evidencia, y hasta
  // ahora salia por otra puerta que tiraba el turno entero.
  | "interpretation_plan_mismatch"
  | "semantic_query_mismatch"
  | "reference_ids_invented"
  | "tool_request_not_planned"
  | "grounding_without_evidence";

/**
 * `WEB-D297`: los cinco modulos por los que el ejecutivo dice **que pidio hacer
 * la persona**, separados de los modulos que dicen **como se le contesta**.
 *
 * La distincion no es cosmetica: hasta ahora un solo reproche sobre la
 * redaccion —un claim citando evidencia desconocida, por ejemplo— tiraba la
 * salida entera, y con ella la orden de olvidar un recuerdo o de pausar los
 * avisos que la persona acababa de dar. El turno contestaba amable y la accion
 * no se hacia ni se mencionaba. En una app de dinero ese es el peor modo de
 * fallo: peor que un error visible.
 */
export const EXECUTIVE_ACTION_SURFACES = [
  "memory_control",
  "structure_proposal",
  "light_action",
  "profile_signal",
  "preference_change",
] as const;

export type ExecutiveActionSurface = (typeof EXECUTIVE_ACTION_SURFACES)[number];

/**
 * A que modulo de la salida apunta una incidencia. `unknown` es el caso que
 * importa: una ruta que este mapa no sabe clasificar **no** se asume inocua.
 */
export type ExecutiveOutputSurface =
  | ExecutiveActionSurface
  | "turn_interpretation"
  | "reference_resolution"
  | "tool_requests"
  | "financial_proposals"
  | "correction_proposal"
  | "response_composition"
  | "orchestration_plan"
  | "findings"
  | "unknown";

const KNOWN_SURFACES = new Set<string>([
  ...EXECUTIVE_ACTION_SURFACES,
  "turn_interpretation",
  "reference_resolution",
  "tool_requests",
  "financial_proposals",
  "correction_proposal",
  "response_composition",
  "orchestration_plan",
  "findings",
]);

/**
 * Superficies que ponen en duda **la lectura del turno entera**, no un modulo
 * suelto. Si el modelo no se pone de acuerdo consigo mismo sobre que turno es
 * este, tampoco se le cree lo que dice que la persona pidio hacer.
 */
const TURN_WIDE_SURFACES = new Set<ExecutiveOutputSurface>([
  "turn_interpretation",
  "unknown",
]);

export type ExecutivePolicyIssue = {
  code: ExecutivePolicyIssueCode;
  path: string;
  /** Derivada de `path`, nunca declarada a mano: una sola fuente de verdad. */
  surface: ExecutiveOutputSurface;
  message: string;
};

/** Incidencia tal como la escriben las reglas: la superficie se deriva luego. */
type RawPolicyIssue = Omit<ExecutivePolicyIssue, "surface">;

export type ExecutivePolicyCompilation = {
  accepted: boolean;
  issues: ExecutivePolicyIssue[];
  /** Los modulos que quedaron reprochados, sin repetir. */
  rejected_surfaces: ExecutiveOutputSurface[];
  executed_tools: string[];
  known_evidence_refs: string[];
};

/**
 * `WEB-D297`: el primer segmento de `path` es el modulo. Todo lo que no
 * reconozcamos cae en `unknown`, que aguas arriba se trata como si reprochara
 * el turno entero: una regla nueva del compilador no puede colar una accion
 * por olvidarse de actualizar este mapa.
 */
export function executiveSurfaceFromPath(path: string): ExecutiveOutputSurface {
  const head = path.split(/[.[]/, 1)[0]?.trim() ?? "";
  return KNOWN_SURFACES.has(head)
    ? (head as ExecutiveOutputSurface)
    : "unknown";
}

/** Anota cada incidencia con el modulo al que apunta. */
export function withExecutiveSurfaces(
  issues: RawPolicyIssue[],
): ExecutivePolicyIssue[] {
  return issues.map((issue) => ({
    ...issue,
    surface: executiveSurfaceFromPath(issue.path),
  }));
}

/**
 * `WEB-D297`: de los cinco modulos de accion, cuales **no** se pueden honrar
 * con estas incidencias encima.
 *
 * Una intencion sobrevive si, y solo si, ninguna incidencia apunta a su propio
 * modulo y ninguna pone en duda la lectura del turno entera. Es deliberadamente
 * fail-closed: la duda cierra la accion, no la abre.
 */
export function rejectedExecutiveActionSurfaces(
  issues: ExecutivePolicyIssue[],
): ExecutiveActionSurface[] {
  if (issues.length === 0) return [];
  if (issues.some((issue) => TURN_WIDE_SURFACES.has(issue.surface))) {
    return [...EXECUTIVE_ACTION_SURFACES];
  }
  const reproached = new Set(issues.map((issue) => issue.surface));
  return EXECUTIVE_ACTION_SURFACES.filter((surface) =>
    reproached.has(surface),
  );
}

export function compileExecutiveEvidenceAndPolicy(input: {
  contextPack: ConversationalExecutiveContextPack;
  output: ConversationalExecutiveOutput;
  toolResults: ConversationToolResult[];
}): ExecutivePolicyCompilation {
  const issues: RawPolicyIssue[] = [];
  const executedTools = new Set(
    input.toolResults
      .filter((result) => result.status === "called")
      .map((result) => result.tool_name),
  );
  const knownEvidenceRefs = buildKnownEvidenceRefs(input.toolResults);
  const knownEvidenceSet = new Set(knownEvidenceRefs);
  const categoryIds = new Set(
    input.contextPack.data_context.categories.map((category) => category.id),
  );
  const focus =
    input.contextPack.conversation_context.active_conversation_state.working_set
      ?.focus_set ?? null;

  input.output.financial_proposals.result.forEach((action, index) => {
    const evidenceFields = new Set(
      action.source_evidence.map((evidence) => evidence.field),
    );

    if (action.amount !== null && !evidenceFields.has("amount")) {
      issues.push({
        code: "amount_without_evidence",
        path: `financial_proposals.result[${index}].amount`,
        message: "Todo monto propuesto debe citar evidencia de amount.",
      });
    }

    if (action.occurred_at !== null && !evidenceFields.has("occurred_at")) {
      issues.push({
        code: "date_without_evidence",
        path: `financial_proposals.result[${index}].occurred_at`,
        message: "Toda fecha propuesta debe citar evidencia de occurred_at.",
      });
    }

    if (action.category_id !== null && !categoryIds.has(action.category_id)) {
      issues.push({
        code: "category_outside_context",
        path: `financial_proposals.result[${index}].category_id`,
        message: "La categoria no pertenece al catalogo entregado.",
      });
    }

    if (action.category_id !== null && !evidenceFields.has("category_id")) {
      issues.push({
        code: "category_without_evidence",
        path: `financial_proposals.result[${index}].category_id`,
        message: "Toda categoria inferida debe citar evidencia de category_id.",
      });
    }

    if (
      (action.movement_type === "pago_deuda" ||
        action.movement_type === "prestamo_dado" ||
        action.movement_type === "prestamo_recibido") &&
      action.debt_hint === null
    ) {
      issues.push({
        code: "debt_action_without_specialized_hint",
        path: `financial_proposals.result[${index}].debt_hint`,
        message:
          "Las acciones de deuda deben transportar el hint para un comando especializado.",
      });
    }

    if (action.command_id !== null && !esComandoConocido(action.command_id)) {
      issues.push({
        code: "command_outside_catalog",
        path: `financial_proposals.result[${index}].command_id`,
        message: `El comando ${action.command_id} no existe en el catalogo de 40 S7.`,
      });
    }
  });

  if (
    input.output.correction_proposal.command_id !== null &&
    !esComandoConocido(input.output.correction_proposal.command_id)
  ) {
    issues.push({
      code: "command_outside_catalog",
      path: "correction_proposal.command_id",
      message: `El comando ${input.output.correction_proposal.command_id} no existe en el catalogo de 40 S7.`,
    });
  }

  if (
    focus &&
    input.output.reference_resolution.resolution === "focus_set"
  ) {
    // `23` S5b.1/`AC-RT-12`: un foco caducado no resuelve referencias. Se
    // compara contra `received_at` del turno, no contra el reloj de la
    // verificacion, para que la comprobacion sea determinista y probable.
    const turnReceivedAt = Date.parse(
      input.contextPack.conversation_context.received_at,
    );
    const focusExpiresAt = Date.parse(focus.expires_at);
    if (
      Number.isFinite(turnReceivedAt) &&
      Number.isFinite(focusExpiresAt) &&
      focusExpiresAt <= turnReceivedAt
    ) {
      issues.push({
        code: "focus_expired",
        path: "reference_resolution.resolution",
        message: `El foco caduco el ${focus.expires_at}; no puede resolver referencias (23 S5b.1).`,
      });
    } else {
      const focusIds = new Set(focus.ordered_ids);
      const outsideFocus =
        input.output.reference_resolution.candidate_movement_ids.filter(
          (id) => !focusIds.has(id),
        );
      if (outsideFocus.length > 0) {
        issues.push({
          code: "reference_outside_focus",
          path: "reference_resolution.candidate_movement_ids",
          message: `La referencia incluyo IDs fuera del focus_set: ${outsideFocus.join(", ")}.`,
        });
      }
    }
  }

  for (const request of input.output.tool_requests) {
    if (request.required_for_response && !executedTools.has(request.tool_name)) {
      issues.push({
        code: "tool_declared_not_executed",
        path: `tool_requests.${request.request_id}`,
        message: `La tool requerida ${request.tool_name} no fue ejecutada.`,
      });
    }
  }

  for (const toolName of input.output.response_composition.used_tools) {
    if (!executedTools.has(toolName)) {
      issues.push({
        code: "tool_used_not_executed",
        path: "response_composition.used_tools",
        message: `La respuesta declaro ${toolName}, pero no se ejecuto.`,
      });
    }
  }

  const factualReadOnlyResponse =
    input.output.response_composition.answer_kind !== "clarification" &&
    input.output.response_composition.answer_kind !== "unsupported";
  if (
    factualReadOnlyResponse &&
    input.output.response_composition.grounded_claims.length === 0
  ) {
    issues.push({
      code: "missing_grounded_claims",
      path: "response_composition.grounded_claims",
      message: "Una respuesta factual necesita claims con evidencia.",
    });
  }

  input.output.response_composition.grounded_claims.forEach((claim, index) => {
    for (const evidenceRef of claim.evidence_refs) {
      if (
        claim.claim_type !== "non_financial" &&
        !knownEvidenceSet.has(evidenceRef)
      ) {
        issues.push({
          code: "claim_without_known_evidence",
          path: `response_composition.grounded_claims[${index}].evidence_refs`,
          message: `El claim cita evidencia desconocida: ${evidenceRef}.`,
        });
      }
    }
    for (const toolName of claim.source_tools) {
      if (!executedTools.has(toolName)) {
        issues.push({
          code: "claim_source_tool_not_executed",
          path: `response_composition.grounded_claims[${index}].source_tools`,
          message: `El claim atribuye una tool no ejecutada: ${toolName}.`,
        });
      }
    }
    if (claim.claim_type === "projection" && claim.assumptions.length === 0) {
      issues.push({
        code: "figure_without_assumptions",
        path: `response_composition.grounded_claims[${index}].assumptions`,
        message:
          "Toda proyeccion debe citar los supuestos ademas de los datos base (22 S2).",
      });
    }
  });

  input.output.findings.forEach((finding, index) => {
    if (finding.level !== "impresion" || !finding.has_figure) return;
    const groundedInThisTurn =
      finding.evidence_refs.length > 0 &&
      finding.evidence_refs.every((ref) => knownEvidenceSet.has(ref));
    if (!groundedInThisTurn) {
      issues.push({
        code: "world_knowledge_promoted",
        path: `findings[${index}].evidence_refs`,
        message:
          "Una impresion con cifra debe venir de datos consultados en este turno (22 S9).",
      });
    }
  });

  const hasProposedWrite =
    input.output.financial_proposals.result.length > 0 ||
    input.output.correction_proposal.is_correction;
  if (hasProposedWrite) {
    if (input.output.response_composition.composition_stage !== "pre_core_draft") {
      issues.push({
        code: "invalid_composition_stage",
        path: "response_composition.composition_stage",
        message: "Una propuesta de escritura solo puede emitir copy pre-Core.",
      });
    }
    if (claimsWriteAlreadyApplied(input.output.response_composition.response_text)) {
      issues.push({
        code: "premature_write_claim",
        path: "response_composition.response_text",
        message:
          "El copy previo al Core no puede afirmar que una escritura ya ocurrio.",
      });
    }
  }

  const surfacedIssues = withExecutiveSurfaces(issues);
  return {
    accepted: surfacedIssues.length === 0,
    issues: surfacedIssues,
    rejected_surfaces: [
      ...new Set(surfacedIssues.map((issue) => issue.surface)),
    ],
    executed_tools: [...executedTools],
    known_evidence_refs: knownEvidenceRefs,
  };
}

export function buildKnownEvidenceRefs(
  toolResults: ConversationToolResult[],
): string[] {
  const refs: string[] = [];
  for (const result of toolResults) {
    if (result.status !== "called") continue;
    result.facts.forEach((_fact, index) => {
      refs.push(`tool:${result.tool_name}:fact:${index}`);
    });
    refs.push(`tool:${result.tool_name}:result`);
  }
  return refs;
}

function claimsWriteAlreadyApplied(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const withoutExplicitNegations = normalized.replace(
    /\b(?:no|sin|antes de)\b[^.!?\n]{0,100}\b(?:registre|registrado|registrada|creado|creada|corregi|corregido|corregida|elimine|eliminado|eliminada|confirme|confirmado|confirmada|descarte|descartado|descartada)\b/g,
    "",
  );
  return [
    /\b(?:ya\s+|listo[,:]?\s*)?(?:lo\s+|la\s+)?(?:registre|cree|corregi|elimine|confirme|descarte)\b/,
    /\b(?:ya\s+)?(?:quedo|esta|fue)\s+(?:registrado|registrada|creado|creada|corregido|corregida|eliminado|eliminada|confirmado|confirmada|descartado|descartada)\b/,
  ].some((pattern) => pattern.test(withoutExplicitNegations));
}
