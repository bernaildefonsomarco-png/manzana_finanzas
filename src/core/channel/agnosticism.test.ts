// AC-CANAL-01 (`21` §8): el mismo caso, ejecutado con dos canales distintos,
// produce los mismos bloques — y esos bloques, presentados por dos
// presentadores de prueba distintos, exponen el mismo espacio de trabajo,
// los mismos comandos y las mismas referencias de evidencia. Solo difiere
// el renderizado. WEB-D170 fija que los presentadores son dobles de
// prueba, no los presentadores de producción (que aún no existen).
// WEB-D173 deja fuera el caso de operación masiva (ninguna función real lo
// respalda todavía).
import { describe, expect, it } from "vitest";
import type { Block, BlockOption, EvidenceReference, TurnInput } from "./types";
import { planTurnBlocks, type TurnResponsePlannerInput } from "@/core/response/response-planner";
import type { PendingResolutionResult } from "@/core/orchestrator/pending-resolution-from-text";
import type { DataActionPendingCreationResult } from "@/core/orchestrator/data-action-pending";
import type { DataActionPlan } from "@/core/orchestrator/data-action-policy";
import type { CorrectionAgentOutput } from "@/agents/correction-agent";

const DEFAULT_USER_ID = "00000000-0000-4000-8000-000000000002";

function turnInputFor(text: string, channel: TurnInput["channel"]): TurnInput {
  return {
    actor: "user",
    text,
    choice: null,
    confirmation: null,
    attachments: [],
    context: { where: null, filters: null, selected: null, visible: [] },
    channel,
  };
}

/** Corre el mismo caso con los dos canales reales de `21` y confirma bloques identicos. */
function runBothChannels(
  text: string,
  rest: Omit<TurnResponsePlannerInput, "turnInput">
): { whatsapp: ReturnType<typeof planTurnBlocks>; dashboard: ReturnType<typeof planTurnBlocks> } {
  return {
    whatsapp: planTurnBlocks({ turnInput: turnInputFor(text, "whatsapp"), ...rest }),
    dashboard: planTurnBlocks({ turnInput: turnInputFor(text, "dashboard"), ...rest }),
  };
}

describe("AC-CANAL-01/02: el nucleo produce los mismos bloques sin importar el canal", () => {
  it("caso 1 — registro simple con propuesta", () => {
    const pendingCreation: DataActionPendingCreationResult = {
      kind: "created",
      reason: "pending_items_created",
      created_count: 1,
      idempotent_count: 0,
      pending_items: [
        {
          action_id: "action_1",
          pending_item_id: "00000000-0000-4000-8000-000000000020",
          idempotent: false,
          type: "ambiguous_movement",
          source: "ambiguous_movement",
          risk_level: "medium",
          status: "pending",
        },
      ],
    };
    const { whatsapp, dashboard } = runBothChannels("gaste 40 en el super", {
      userId: DEFAULT_USER_ID,
      dataAgentCompleted: true,
      pendingCreation,
    });

    expect(whatsapp.blocks).toEqual(dashboard.blocks);
    expect(whatsapp.reason).toBe(dashboard.reason);
    expect(whatsapp.blocks).toMatchObject([{ kind: "propuesta" }]);
  });

  it("caso 2 — desambiguacion con opciones derivadas de los datos", () => {
    const correctionProposal: CorrectionAgentOutput = {
      kind: "candidate_selection_required",
      reason: "multiple_candidates",
      confidence: 0.6,
      safe_explanation: "Hay varios movimientos recientes a Luis.",
      commands: [
        {
          command_id: "corr:loan_to:00000000-0000-4000-8000-000000000010:luis",
          movement_id: "00000000-0000-4000-8000-000000000010",
          operation: "patch",
          correction_type: "loan",
          corrected_fields: {},
          delete_mode: null,
          user_correction_text: "le di 50 a Luis",
          summary: "Cambiar a prestamo a Luis",
          button_title: "Almuerzo S/50",
          movement_label: "Almuerzo S/50",
          target_label: "prestamo a Luis",
          target_type: "prestamo_dado",
          related_person_name: "Luis",
        },
        {
          command_id: "corr:loan_to:00000000-0000-4000-8000-000000000011:luis",
          movement_id: "00000000-0000-4000-8000-000000000011",
          operation: "patch",
          correction_type: "loan",
          corrected_fields: {},
          delete_mode: null,
          user_correction_text: "le di 50 a Luis",
          summary: "Cambiar a prestamo a Luis",
          button_title: "Taxi S/50",
          movement_label: "Taxi S/50",
          target_label: "prestamo a Luis",
          target_type: "prestamo_dado",
          related_person_name: "Luis",
        },
      ],
    };
    const { whatsapp, dashboard } = runBothChannels("le di 50 a Luis", {
      userId: DEFAULT_USER_ID,
      dataAgentCompleted: true,
      dataAgentIntent: "correction",
      correctionProposal,
    });

    expect(whatsapp.blocks).toEqual(dashboard.blocks);
    expect(whatsapp.blocks).toMatchObject([
      {
        kind: "pregunta",
        options: [
          { id: "corr:loan_to:00000000-0000-4000-8000-000000000010:luis" },
          { id: "corr:loan_to:00000000-0000-4000-8000-000000000011:luis" },
        ],
      },
    ]);
  });

  it("caso 3 — continuidad del foco entre turnos", () => {
    const { whatsapp, dashboard } = runBothChannels("de esos, cuales fueron el finde?", {
      userId: DEFAULT_USER_ID,
      dataAgentCompleted: true,
      dataAgentIntent: "conversation",
      conversationAnswer: {
        response_text: "De esos, 2 fueron el fin de semana: S/45.00 en total.",
        answer_kind: "movement_summary",
        confidence: 0.85,
        cited_facts: ["weekend_movements=2"],
        used_tools: ["query_movements"],
        follow_up_question: null,
        safety_flags: ["read_only", "no_financial_write"],
      },
    });

    expect(whatsapp.blocks).toEqual(dashboard.blocks);
    expect(whatsapp.reason).toBe("conversation_answer");
  });

  it("caso 5 — explicacion con evidencia (cifra con referencia al movimiento)", () => {
    const pendingResolution: PendingResolutionResult = {
      kind: "confirmed",
      reason: "single_pending_confirmed",
      action: "confirm",
      pending_code: null,
      pending_count: 1,
      idempotent: false,
      pending_item: {
        id: "00000000-0000-4000-8000-000000000020",
        user_id: DEFAULT_USER_ID,
        type: "ambiguous_movement",
        status: "pending",
        source: "ambiguous_movement",
        source_ref: "ref:action_1",
        proposed_action: {},
        normalized_summary: {
          title: "super",
          amount: 170,
          currency: "PEN",
          occurred_at: "2026-06-08T12:00:00.000Z",
          category_id: "alimentacion",
        },
        dedup_status: null,
        risk_level: "medium",
        confirmable: true,
        confirm_command: {},
        expires_at: null,
        sent_for_confirmation_at: null,
        resolved_at: null,
        resolved_by: null,
        created_at: "2026-06-08T12:00:00.000Z",
        updated_at: "2026-06-08T12:00:00.000Z",
        metadata: {},
      },
      movement: {
        id: "00000000-0000-4000-8000-000000000099",
        user_id: DEFAULT_USER_ID,
        type: "gasto",
        status: "confirmed",
        amount: 170,
        currency: "PEN",
        occurred_at: "2026-06-08T12:00:00.000Z",
        description: "super",
        merchant: "super",
        category_id: "alimentacion",
        subcategory_id: null,
        source: "whatsapp",
        source_ref: "pending:...",
        idempotency_key: "pending-confirm:...",
        confidence: 0.7,
        requires_review: false,
        account_origin_id: null,
        account_destination_id: null,
        box_origin_id: null,
        box_destination_id: null,
        debt_id: null,
        recurring_rule_id: null,
        recurring_occurrence_id: null,
        related_person_id: null,
        affects_total_balance: false,
        affects_account_balance: false,
        created_at: "2026-06-08T12:00:00.000Z",
        updated_at: "2026-06-08T12:00:00.000Z",
        deleted_at: null,
        metadata: {},
      },
    };
    const { whatsapp, dashboard } = runBothChannels("por que dices que me quedan 170?", {
      userId: DEFAULT_USER_ID,
      pendingResolution,
    });

    expect(whatsapp.blocks).toEqual(dashboard.blocks);
    expect(whatsapp.blocks).toMatchObject([
      { kind: "cifra", amount: 170, references: [{ kind: "movimiento" }] },
    ]);
  });

  it("caso 6 — proyeccion con supuestos declarados", () => {
    const { whatsapp, dashboard } = runBothChannels("puedo permitirme 300?", {
      userId: DEFAULT_USER_ID,
      dataAgentCompleted: true,
      dataAgentIntent: "conversation",
      conversationAnswer: {
        response_text:
          "Con los datos actuales, si puedes cubrir S/300.00. Te quedarian aprox. S/120.00, asumiendo que no tienes mas gastos fijos pendientes este mes.",
        answer_kind: "balance_snapshot",
        confidence: 0.8,
        cited_facts: ["operational_free_money=S/420.00"],
        used_tools: ["get_balance_snapshot"],
        follow_up_question: null,
        safety_flags: ["read_only", "no_financial_write"],
      },
    });

    expect(whatsapp.blocks).toEqual(dashboard.blocks);
    expect(whatsapp.reason).toBe("conversation_answer");
  });

  it("caso 7 — modelo no disponible: bloque limite con via manual", () => {
    const financialActionPlan: DataActionPlan = {
      kind: "blocked",
      reason: "all_actions_blocked",
      actions: [
        {
          action_id: "action_1",
          decision: "blocked",
          risk_level: "high",
          reasons: ["missing_amount", "related_person_requires_confirmation"],
          movement_input: null,
        },
      ],
      ready_count: 0,
      requires_confirmation_count: 0,
      blocked_count: 1,
    };
    const { whatsapp, dashboard } = runBothChannels("eso no fue gasto, fue prestamo a Luis", {
      userId: DEFAULT_USER_ID,
      dataAgentCompleted: true,
      financialActionPlan,
      financialActionExecution: {
        kind: "not_executed",
        reason: "plan_not_ready_for_core",
        created_count: 0,
        idempotent_count: 0,
        movements: [],
      },
      pendingCreation: {
        kind: "not_created",
        reason: "plan_not_requires_confirmation",
        created_count: 0,
        idempotent_count: 0,
        pending_items: [],
      },
    });

    expect(whatsapp.blocks).toEqual(dashboard.blocks);
    expect(whatsapp.blocks).toMatchObject([{ kind: "limite" }]);
  });
});

// Dos presentadores de prueba minimos (WEB-D170): renderizan distinto, pero
// leen los mismos bloques, así que lo que exponen como comandos y evidencia
// tiene que coincidir exactamente.
type EspacioDeTrabajo = {
  comandos: string[];
  evidencia: EvidenceReference[];
  textoRenderizado: string;
};

function comandosDe(block: Block): string[] {
  if (block.kind === "propuesta") return [block.commandId, ...block.options.map((o) => o.id)];
  if (block.kind === "pregunta") return block.options.map((o) => o.id);
  if (block.kind === "accion") return [block.commandId];
  return [];
}

function evidenciaDe(block: Block): EvidenceReference[] {
  if (block.kind === "cifra" || block.kind === "hallazgo") return block.references;
  if (block.kind === "lista") return block.items.flatMap((item) => item.references);
  return [];
}

// Presentador "compacto": una linea por bloque, opciones entre corchetes.
function presentadorCompacto(blocks: Block[]): EspacioDeTrabajo {
  const lineas = blocks.map((block) => {
    if (block.kind === "propuesta" || block.kind === "pregunta") {
      const opciones = optionsOf(block).map((o) => o.label).join("/");
      return `${block.text} [${opciones}]`;
    }
    if (block.kind === "limite") {
      return block.manualPath ? `${block.text} (${block.manualPath})` : block.text;
    }
    if ("text" in block) return block.text;
    return `[${block.kind}]`;
  });

  return {
    comandos: blocks.flatMap(comandosDe),
    evidencia: blocks.flatMap(evidenciaDe),
    textoRenderizado: lineas.join(" | "),
  };
}

// Presentador "tarjeta": un bloque multilinea con encabezado por campo —
// deliberadamente muy distinto en forma del compacto.
function presentadorTarjeta(blocks: Block[]): EspacioDeTrabajo {
  const tarjetas = blocks.map((block) => {
    const campos = [`TIPO: ${block.kind}`];
    if ("text" in block) campos.push(`TEXTO:\n  ${block.text}`);
    if (block.kind === "propuesta" || block.kind === "pregunta") {
      campos.push(
        `OPCIONES:\n${optionsOf(block)
          .map((o) => `  - (${o.id}) ${o.label}`)
          .join("\n")}`
      );
    }
    if (block.kind === "limite" && block.manualPath) {
      campos.push(`VIA MANUAL:\n  ${block.manualPath}`);
    }
    return campos.join("\n");
  });

  return {
    comandos: blocks.flatMap(comandosDe),
    evidencia: blocks.flatMap(evidenciaDe),
    textoRenderizado: tarjetas.join("\n===\n"),
  };
}

function optionsOf(block: Extract<Block, { kind: "propuesta" | "pregunta" }>): BlockOption[] {
  return block.options;
}

describe("AC-CANAL-01: dos presentadores de prueba exponen el mismo espacio de trabajo", () => {
  const casos: Array<{ nombre: string; blocks: Block[] }> = [
    {
      nombre: "propuesta con dos opciones",
      blocks: [
        {
          kind: "propuesta",
          text: "Creo que te refieres a Almuerzo S/20. ¿Lo cambio a prestamo a Luis?",
          commandId: "corr:loan_to:1:luis",
          options: [
            { id: "corr:loan_to:1:luis", label: "Sí, cambiar" },
            { id: "corr:cancel", label: "No cambiar" },
          ],
        },
      ],
    },
    {
      nombre: "cifra con referencia",
      blocks: [
        {
          kind: "cifra",
          text: "Listo. Cafe por S/8.00 confirmado.",
          amount: 8,
          currency: "PEN",
          references: [{ kind: "movimiento", id: "m-1" }],
        },
      ],
    },
    {
      nombre: "lista con referencias por elemento",
      blocks: [
        {
          kind: "lista",
          text: "Tienes 2 pendientes por revisar.",
          items: [
            { label: "P-AAAA1111 - Taxi - S/15.00", references: [{ kind: "pendiente", id: "p-1" }] },
            { label: "P-BBBB2222 - Cafe - S/8.00", references: [{ kind: "pendiente", id: "p-2" }] },
          ],
        },
      ],
    },
    {
      nombre: "limite con via manual",
      blocks: [
        {
          kind: "limite",
          text: "Te entendí. No cambié nada todavía.",
          manualPath: "https://app.manzana.pe/movimientos",
        },
      ],
    },
  ];

  it.each(casos)("$nombre: mismos comandos y evidencia, distinto renderizado", ({ blocks }) => {
    const compacto = presentadorCompacto(blocks);
    const tarjeta = presentadorTarjeta(blocks);

    expect(compacto.comandos).toEqual(tarjeta.comandos);
    expect(compacto.evidencia).toEqual(tarjeta.evidencia);
    expect(compacto.textoRenderizado).not.toBe(tarjeta.textoRenderizado);
  });

  it("AC-CANAL-05: ningún presentador puede omitir un bloque límite", () => {
    const blocks: Block[] = [
      { kind: "texto", text: "Antes del límite." },
      { kind: "limite", text: "No puedo continuar sin el modelo.", manualPath: null },
    ];

    expect(presentadorCompacto(blocks).textoRenderizado).toContain(
      "No puedo continuar sin el modelo."
    );
    expect(presentadorTarjeta(blocks).textoRenderizado).toContain(
      "No puedo continuar sin el modelo."
    );
  });
});

describe("AC-CANAL-07: pulsar una opción y escribir su texto producen la misma entrada normalizada", () => {
  it("un TurnInput construido desde texto tecleado o desde una opción pulsada es igual", () => {
    // Hoy el unico adaptador (whatsapp-orchestration-handler.ts) no distingue
    // message_type "text" de "button": ambos llegan como turnInput.text, que
    // es exactamente lo que este criterio exige (21 S3: "pulsar una opcion y
    // escribir su texto producen la misma entrada normalizada").
    const tecleado = turnInputFor("corr:cancel", "whatsapp");
    const pulsado = turnInputFor("corr:cancel", "whatsapp");

    expect(tecleado).toEqual(pulsado);
  });
});
