import { describe, expect, it } from "vitest";
import { CorrectionAgent, isCorrectionLikeText } from "./correction-agent";
import type {
  AgentRuntime,
  AgentRuntimeRequest,
  AgentRuntimeResponse,
} from "@/agents/runtime";
import type { SemanticCorrectionInterpretation } from "./types";
import type {
  CorrectionContextPack,
  CorrectionMovementCandidate,
  CorrectionSubcategoryCandidate,
} from "./types";

function movement(
  overrides: Partial<CorrectionMovementCandidate> = {}
): CorrectionMovementCandidate {
  return {
    id: "00000000-0000-4000-8000-000000000010",
    type: "gasto",
    amount: 20,
    currency: "PEN",
    description: "almuerzo",
    merchant: "almuerzo",
    category_id: "alimentacion",
    occurred_at: "2026-07-05T15:00:00.000Z",
    created_at: "2026-07-05T15:01:00.000Z",
    status: "confirmed",
    account_origin_id: "00000000-0000-4000-8000-000000000020",
    account_destination_id: null,
    metadata: {},
    ...overrides,
  };
}

function context(
  overrides: Partial<CorrectionContextPack> = {}
): CorrectionContextPack {
  return {
    context_pack_type: "correction_context",
    version: "v1",
    user_id: "00000000-0000-4000-8000-000000000002",
    locale: "es-PE",
    timezone: "America/Lima",
    channel: "whatsapp",
    original_message: "eso no fue gasto, fue prestamo a Luis",
    received_at: "2026-07-05T15:02:00.000Z",
    recent_movements: [movement()],
    accounts: [
      {
        id: "00000000-0000-4000-8000-000000000020",
        name: "Efectivo",
        type: "fisico",
        is_default: true,
      },
      {
        id: "00000000-0000-4000-8000-000000000021",
        name: "Tarjeta BCP",
        type: "tarjeta",
        is_default: false,
      },
    ],
    categories: [
      { id: "alimentacion", label: "Alimentacion", is_sensitive: false },
      { id: "transporte", label: "Transporte", is_sensitive: false },
      { id: "otros", label: "Otros", is_sensitive: false },
    ],
    subcategories: [],
    active_conversation_state: {
      last_response_summary: null,
      continuity_hint: null,
      referenced_movement_ids: [],
      working_set: null,
    },
    recent_changes: [],
    undo_rules: ["Toda correccion requiere confirmacion."],
    ...overrides,
  };
}

describe("CorrectionAgent", () => {
  it("propone confirmar un cambio seguro a prestamo dado", async () => {
    const agent = new CorrectionAgent();

    const result = await agent.propose(context(), "trace");

    expect(result.output).toMatchObject({
      kind: "requires_confirmation",
      reason: "single_candidate",
      command: {
        movement_id: "00000000-0000-4000-8000-000000000010",
        command_id:
          "corr:loan_to:00000000-0000-4000-8000-000000000010:luis",
        operation: "patch",
        correction_type: "loan",
        delete_mode: null,
        target_type: "prestamo_dado",
        target_label: "prestamo a Luis",
        related_person_name: "Luis",
        movement_label: "Almuerzo S/20",
        corrected_fields: {
          type: "prestamo_dado",
          description: "Prestamo a Luis",
          merchant: null,
          category_id: null,
          related_person_id: null,
          debt_id: null,
        },
      },
    });
  });

  it("pide elegir cuando hay varios movimientos recientes posibles", async () => {
    const agent = new CorrectionAgent();

    const result = await agent.propose(
      context({
        recent_movements: [
          movement({
            id: "00000000-0000-4000-8000-000000000011",
            description: "almuerzo",
            amount: 20,
            created_at: "2026-07-05T15:01:30.000Z",
          }),
          movement({
            id: "00000000-0000-4000-8000-000000000012",
            description: "taxi",
            category_id: "transporte",
            amount: 15,
            created_at: "2026-07-05T15:01:20.000Z",
          }),
          movement({
            id: "00000000-0000-4000-8000-000000000013",
            description: "cafe",
            amount: 8,
            created_at: "2026-07-05T15:01:10.000Z",
          }),
        ],
      }),
      "trace"
    );

    expect(result.output).toMatchObject({
      kind: "candidate_selection_required",
      reason: "multiple_candidates",
    });

    if (result.output.kind !== "candidate_selection_required") {
      throw new Error("Expected candidate selection");
    }

    expect(result.output.commands).toHaveLength(3);
    expect(result.output.commands.map((command) => command.button_title)).toEqual([
      "Almuerzo S/20",
      "Taxi S/15",
      "Cafe S/8",
    ]);
  });

  it("propone corregir monto sin ejecutar cambios", async () => {
    const agent = new CorrectionAgent();

    const result = await agent.propose(
      context({ original_message: "no fueron 20, fueron 25.50" }),
      "trace"
    );

    expect(result.output).toMatchObject({
      kind: "requires_confirmation",
      command: {
        command_id: "corr:amount:00000000-0000-4000-8000-000000000010:25_50",
        operation: "patch",
        correction_type: "amount",
        target_label: "monto S/25.50",
        corrected_fields: {
          amount: 25.5,
        },
      },
    });
  });

  it("propone corregir categoria usando categorias canonicas", async () => {
    const agent = new CorrectionAgent();

    const result = await agent.propose(
      context({ original_message: "eso no era comida, era transporte" }),
      "trace"
    );

    expect(result.output).toMatchObject({
      kind: "requires_confirmation",
      command: {
        command_id:
          "corr:category:00000000-0000-4000-8000-000000000010:transporte",
        operation: "patch",
        correction_type: "category",
        target_label: "categoria Transporte",
        corrected_fields: {
          category_id: "transporte",
          subcategory_id: null,
        },
      },
    });
  });

  it("propone corregir cuenta cuando reconoce una cuenta activa", async () => {
    const agent = new CorrectionAgent();

    const result = await agent.propose(
      context({ original_message: "fue con tarjeta bcp" }),
      "trace"
    );

    expect(result.output).toMatchObject({
      kind: "requires_confirmation",
      command: {
        command_id:
          "corr:acct_origin:00000000-0000-4000-8000-000000000010:00000000-0000-4000-8000-000000000021",
        operation: "patch",
        correction_type: "account",
        target_label: "cuenta Tarjeta BCP",
        corrected_fields: {
          account_origin_id: "00000000-0000-4000-8000-000000000021",
        },
      },
    });
  });

  it("propone eliminacion segura con confirmacion explicita", async () => {
    const agent = new CorrectionAgent();

    const result = await agent.propose(
      context({ original_message: "borra ese gasto" }),
      "trace"
    );

    expect(result.output).toMatchObject({
      kind: "requires_confirmation",
      command: {
        command_id: "corr:delete:00000000-0000-4000-8000-000000000010",
        operation: "delete",
        correction_type: "delete",
        delete_mode: "soft_delete",
        corrected_fields: null,
        target_label: "eliminar este movimiento",
      },
    });
  });

  it("reconoce mover algo a un sitio como posible correccion segura", () => {
    // Sin estos verbos, "ponlo en Animales" no llegaba al agente de
    // correcciones: caia en el camino de captura y contestaba "no encontre
    // algo reciente para registrar", que es lo contrario de lo que pasaba.
    expect(isCorrectionLikeText("ponlo en Animales")).toBe(true);
    expect(isCorrectionLikeText("metelo en la subcategoria de gatos")).toBe(true);
    expect(isCorrectionLikeText("muevelo a Mascotas")).toBe(true);
  });

  it("reconoce descartes contextuales como posible correccion segura", () => {
    expect(isCorrectionLikeText("descartalo")).toBe(true);
    expect(isCorrectionLikeText("deshaz eso")).toBe(true);
    expect(isCorrectionLikeText("olvidalo")).toBe(true);
  });

  it("propone eliminar el ultimo movimiento con mensajes cortos de descarte", async () => {
    const agent = new CorrectionAgent();

    const result = await agent.propose(
      context({ original_message: "descartalo" }),
      "trace"
    );

    expect(result.output).toMatchObject({
      kind: "requires_confirmation",
      command: {
        command_id: "corr:delete:00000000-0000-4000-8000-000000000010",
        operation: "delete",
        correction_type: "delete",
        delete_mode: "soft_delete",
        movement_label: "Almuerzo S/20",
      },
    });
  });

  it("compila una referencia semantica sin depender de una frase exacta", async () => {
    const agent = new CorrectionAgent(
      semanticRuntime({
        is_correction: true,
        command_id: null,
        operation: "delete",
        correction_type: "delete",
        candidate_movement_ids: ["00000000-0000-4000-8000-000000000010"],
        target_amount: null,
        target_category_id: null,
        target_subcategory_id: null,
        target_subcategory_label: null,
        target_account_id: null,
        target_movement_type: null,
        related_person_name: null,
        reference_resolution: "single",
        confidence: 0.94,
        requires_confirmation: true,
        ambiguities: [],
        safe_explanation: "La referencia apunta al desayuno recien registrado.",
        evidence_signals: ["descripcion=almuerzo", "orden=ultimo"],
      }),
      "api",
      false
    );

    const result = await agent.propose(
      context({ original_message: "mejor quita lo que acabamos de anotar" }),
      "trace-semantic"
    );

    expect(result.output).toMatchObject({
      kind: "requires_confirmation",
      command: {
        operation: "delete",
        movement_id: "00000000-0000-4000-8000-000000000010",
      },
    });
    expect(result.safety.policy_flags).toContain(
      "candidate_ids_bounded_by_context_pack"
    );
  });

  it("rechaza IDs de movimientos inventados por el runtime", async () => {
    const agent = new CorrectionAgent(
      semanticRuntime({
        is_correction: true,
        command_id: null,
        operation: "delete",
        correction_type: "delete",
        candidate_movement_ids: ["00000000-0000-4000-8000-000000000099"],
        target_amount: null,
        target_category_id: null,
        target_subcategory_id: null,
        target_subcategory_label: null,
        target_account_id: null,
        target_movement_type: null,
        related_person_name: null,
        reference_resolution: "single",
        confidence: 0.99,
        requires_confirmation: true,
        ambiguities: [],
        safe_explanation: "Supuesto candidato.",
        evidence_signals: [],
      }),
      "api",
      false
    );

    const result = await agent.propose(
      context({ original_message: "elimina el desayuno" }),
      "trace-invented-id"
    );

    expect(result.output).toMatchObject({
      kind: "needs_clarification",
      reason: "ambiguous_reference",
    });
  });

  it("no sustituye una API fallida por el parser local cuando fallback esta apagado", async () => {
    const failingRuntime: AgentRuntime = {
      async run() {
        throw new Error("semantic api unavailable");
      },
    };
    const agent = new CorrectionAgent(failingRuntime, "api", false);

    await expect(
      agent.propose(context(), "trace-no-correction-fallback")
    ).rejects.toThrow("semantic api unavailable");
  });
});

function semanticRuntime(
  output: SemanticCorrectionInterpretation
): AgentRuntime {
  return {
    async run<TContext, TOutput>(
      _request: AgentRuntimeRequest<TContext>
    ): Promise<AgentRuntimeResponse<TOutput>> {
      void _request;
      return {
        output: output as TOutput,
        confidence: output.confidence,
        tool_calls: [],
        runtime: {
          provider: "api",
          model_name: "semantic-correction-test",
          latency_ms: 1,
        },
        safety: {
          policy_flags: ["structured_outputs"],
          redaction_applied: false,
        },
      };
    },
  };
}

/**
 * `RUL-CAT`: una subcategoria cuelga siempre de una de las 12 categorias y es
 * propia de cada persona. Mover ahi un movimiento ya registrado es una
 * correccion de como quedo clasificado —igual que cambiarle la categoria— y
 * por eso vive en esta superficie y no en una nueva.
 *
 * El caso real que lo motiva: la persona creo "Animales" dentro de "Vivienda /
 * Hogar" y quiere meter ahi la comida de sus gatos, que ya estaba guardada.
 */
const ANIMALES_VIVIENDA = "00000000-0000-4000-8000-0000000000c1";
const ANIMALES_SALUD = "00000000-0000-4000-8000-0000000000c2";

function subcategoria(
  overrides: Partial<CorrectionSubcategoryCandidate> = {}
): CorrectionSubcategoryCandidate {
  return {
    id: ANIMALES_VIVIENDA,
    category_id: "vivienda_hogar",
    label: "Animales",
    normalized_label: "animales",
    ...overrides,
  };
}

function moverAUnaSubcategoria(
  message: string,
  subcategories: CorrectionSubcategoryCandidate[]
) {
  return new CorrectionAgent().propose(
    context({
      original_message: message,
      subcategories,
      recent_movements: [
        movement({ description: "comida de los gatos", amount: 45 }),
      ],
    }),
    "trace-subcategoria"
  );
}

describe("mover un movimiento a una subcategoria hablando", () => {
  it("propone el cambio cuando el nombre existe y es unico", async () => {
    const result = await moverAUnaSubcategoria("ponlo en Animales", [
      subcategoria(),
    ]);

    expect(result.output).toMatchObject({
      kind: "requires_confirmation",
      command: {
        command_id: `corr:subcategory:00000000-0000-4000-8000-000000000010:${ANIMALES_VIVIENDA}`,
        operation: "patch",
        correction_type: "subcategory",
        target_label: "Animales, dentro de Vivienda / Hogar",
        corrected_fields: {
          // La categoria madre se escribe junto con la subcategoria: dejar el
          // gasto en "Alimentación" apuntando a una etiqueta de "Vivienda /
          // Hogar" seria justo la incoherencia que la pantalla rechaza.
          category_id: "vivienda_hogar",
          subcategory_id: ANIMALES_VIVIENDA,
        },
      },
    });
  });

  it("dice que esa subcategoria no existe en vez de elegir la mas parecida", async () => {
    const result = await moverAUnaSubcategoria("ponlo en Animales", [
      subcategoria({
        id: "00000000-0000-4000-8000-0000000000c9",
        label: "Mascotas",
        normalized_label: "mascotas",
      }),
    ]);

    expect(result.output).toMatchObject({
      kind: "needs_clarification",
      reason: "subcategory_not_found",
      subcategory_clarification: { kind: "not_found", label: "Animales" },
    });
  });

  it("no elige por la persona cuando ese nombre cuelga de dos categorias", async () => {
    const result = await moverAUnaSubcategoria("ponlo en Animales", [
      subcategoria(),
      subcategoria({ id: ANIMALES_SALUD, category_id: "salud" }),
    ]);

    expect(result.output).toMatchObject({
      kind: "needs_clarification",
      reason: "ambiguous_subcategory",
      subcategory_clarification: {
        kind: "ambiguous",
        label: "Animales",
        category_labels: ["Vivienda / Hogar", "Salud"],
      },
    });
  });

  it("nombrar la categoria deshace la ambiguedad en el turno siguiente", async () => {
    const result = await moverAUnaSubcategoria(
      "ponlo en Animales de Vivienda / Hogar",
      [subcategoria(), subcategoria({ id: ANIMALES_SALUD, category_id: "salud" })]
    );

    expect(result.output).toMatchObject({
      kind: "requires_confirmation",
      command: {
        command_id: `corr:subcategory:00000000-0000-4000-8000-000000000010:${ANIMALES_VIVIENDA}`,
      },
    });
  });

  it("no confunde una categoria canonica con una subcategoria que falta", async () => {
    // "cambia a transporte" nombra una de las 12 categorias, no una etiqueta
    // propia: contestar "no tienes esa subcategoria" seria responder algo que
    // nadie pregunto. Este extractor corre antes que el de categoria, asi que
    // apartarse a tiempo es responsabilidad suya.
    const result = await moverAUnaSubcategoria("cambia a transporte", [
      subcategoria(),
    ]);

    expect(result.output).toMatchObject({
      kind: "requires_confirmation",
      command: { correction_type: "category" },
    });
  });
});
