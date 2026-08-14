import { describe, expect, it } from "vitest";
import type { TurnInput } from "@/core/channel/types";
import type { ExecutiveActionSurface } from "@/agents/conversational-executive-agent";
import type { StructureProposal } from "@/core/structure/structure-proposal";
import { planTurnBlocks } from "./response-planner";

const DEFAULT_USER_ID = "00000000-0000-4000-8000-000000000002";
const PROPOSAL_ID = "00000000-0000-4000-8000-0000000000c1";

function structureProposal(): StructureProposal {
  return {
    proposal_id: PROPOSAL_ID,
    entity: "caja",
    operation: "create",
    command_type: "CreateBoxCommand",
    payload: {},
    summary: "¿Creo la caja Viaje en BCP y aparto S/500 de tu saldo libre?",
    confirm_label: "Sí, crear la caja",
    proposed_at: "2026-08-09T10:00:00.000-05:00",
  };
}

function turnInput(text = "cambia la categoria y anula el recordatorio"): TurnInput {
  return {
    actor: "user",
    text,
    choice: null,
    confirmation: null,
    attachments: [],
    context: { where: null, filters: null, selected: null, visible: [] },
    channel: "whatsapp",
  };
}

/**
 * Un turno que ejecuto una accion ligera —la rama que gana antes que
 * estructura, deudas, dinero y movimientos— con lo demas que se pidio.
 */
function lightActionTurn(requestedActionIntents: ExecutiveActionSurface[]) {
  return planTurnBlocks({
    turnInput: turnInput(),
    userId: DEFAULT_USER_ID,
    dataAgentCompleted: true,
    dataAgentIntent: "conversation",
    lightActionText: "Listo, anulé el recordatorio de mañana.",
    requestedActionIntents,
  });
}

function textos(blocks: ReturnType<typeof planTurnBlocks>["blocks"]): string {
  return blocks.map((block) => ("text" in block ? block.text : "")).join("\n");
}

describe("ERR-ASI-01: lo que el turno no atendio se nombra", () => {
  it("nombra la superficie que quedo fuera cuando se pidieron dos cosas", () => {
    const plan = lightActionTurn(["light_action", "structure_proposal"]);

    expect(plan.reason).toBe("light_action_answered");
    // Lo que si se hizo sigue siendo el primer bloque: el aviso se anade, no
    // sustituye.
    expect(textos(plan.blocks)).toContain("anulé el recordatorio");
    // Se afirma que la superficie queda nombrada, no la redaccion exacta: la
    // lista de `STRUCTURE_ENTITIES` crece y el test no deberia romperse por eso.
    expect(textos(plan.blocks)).toMatch(
      /También me pediste .*caja.*\. Eso no lo hice en este turno/
    );
  });

  it("no dice nada cuando lo unico pedido es lo que acaba de hacer", () => {
    const plan = lightActionTurn(["light_action"]);

    expect(textos(plan.blocks)).not.toContain("También me pediste");
  });

  it("no dice nada cuando el turno no venia de una intencion de accion", () => {
    const plan = lightActionTurn([]);

    expect(textos(plan.blocks)).not.toContain("También me pediste");
  });

  it("enumera varias superficies en una sola frase", () => {
    const plan = lightActionTurn([
      "light_action",
      "structure_proposal",
      "money_action",
    ]);

    // Lo que se prueba es el enlace de la enumeracion —la ultima va con "y"—,
    // no el texto de cada etiqueta.
    expect(textos(plan.blocks)).toMatch(/También me pediste .+ y mover dinero\./);
  });

  it("deja el aviso en su propio bloque y no dentro de la tarjeta", () => {
    // Meter el aviso dentro de una propuesta confundiria que se esta
    // confirmando: es la misma razon por la que `appendSupplementalAnswer` se
    // niega a tocar un bloque con opciones.
    const plan = planTurnBlocks({
      turnInput: turnInput(),
      userId: DEFAULT_USER_ID,
      structureProposal: structureProposal(),
      requestedActionIntents: ["structure_proposal", "money_action"],
    });

    const propuesta = plan.blocks.find((block) => "options" in block);
    expect(propuesta).toBeDefined();
    expect("text" in propuesta! ? propuesta.text : "").not.toContain(
      "También me pediste"
    );

    const ultimo = plan.blocks[plan.blocks.length - 1];
    expect("text" in ultimo ? ultimo.text : "").toContain(
      "También me pediste mover dinero"
    );
  });

  it("no repite el aviso en un turno que ya dice que no pudo hacer nada", () => {
    const plan = planTurnBlocks({
      turnInput: turnInput(),
      userId: DEFAULT_USER_ID,
      unhonoredActionIntents: ["structure_proposal"],
      requestedActionIntents: ["structure_proposal", "money_action"],
    });

    expect(plan.reason).toBe("executive_action_not_honored");
    expect(textos(plan.blocks)).not.toContain("También me pediste");
  });
});

/**
 * `debt_action`, `money_action` y `movement_action` no tenian aviso: sin
 * entrada en el mapa, el turno terminaba en silencio justo en las tres
 * superficies donde creer que algo ocurrio cuesta dinero.
 */
describe("ERR-ASI-01: ninguna superficie de accion se cae en silencio", () => {
  const SUPERFICIES: ExecutiveActionSurface[] = [
    "memory_control",
    "preference_change",
    "structure_proposal",
    "light_action",
    "debt_action",
    "money_action",
    "movement_action",
  ];

  it.each(SUPERFICIES)("%s tiene aviso propio cuando no se pudo", (surface) => {
    const plan = planTurnBlocks({
      turnInput: turnInput(),
      userId: DEFAULT_USER_ID,
      unhonoredActionIntents: [surface],
    });

    expect(plan.reason).toBe("executive_action_not_honored");
    expect(textos(plan.blocks).length).toBeGreaterThan(0);
  });

  it("profile_signal sigue sin aviso, a proposito", () => {
    // `20c` §9: no es un pedido de la persona sino algo que el motor creyo
    // notar sobre ella. Anunciarlo seria contarle lo que iba a deducir a sus
    // espaldas.
    const plan = planTurnBlocks({
      turnInput: turnInput(),
      userId: DEFAULT_USER_ID,
      unhonoredActionIntents: ["profile_signal"],
    });

    expect(plan.reason).not.toBe("executive_action_not_honored");
  });
});
