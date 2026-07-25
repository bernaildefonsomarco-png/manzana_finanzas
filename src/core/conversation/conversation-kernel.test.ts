import { describe, expect, it } from "vitest";
import { analyzeConversationTurn } from "./conversation-kernel";

const receivedAt = "2026-07-15T12:00:00.000Z";
const timezone = "America/Lima";

const activeMovementState = {
  last_query_kind: "movement_search" as const,
  last_query_date_range: {
    start: "2026-07-15T00:00:00.000-05:00",
    end: "2026-07-15T23:59:59.999-05:00",
    label: "hoy",
  },
  referenced_movements: [
    {
      id: "mov-1",
      type: "gasto",
      amount: 8,
      currency: "PEN" as const,
      description: "Cafe",
      category_id: "alimentacion",
      occurred_at: "2026-07-15T09:30:00.000-05:00",
    },
  ],
  continuity_hint: "El usuario puede referirse a 1 movimiento de hoy.",
};

describe("ConversationKernel", () => {
  it("clasifica una captura financiera natural como captura rapida", () => {
    const turn = analyzeConversationTurn({
      text: "Hice un gasto de 20 soles comprando desayuno",
      receivedAt,
      timezone,
    });

    expect(turn.turn_state).toMatchObject({
      act: "financial_capture",
      experience_mode: "quick_capture",
      should_route_to_conversation_agent: true,
    });
    expect(turn.turn_state.response_guidance).toContain(
      "detectar captura rapida y evitar respuesta larga"
    );
  });

  it("mantiene una pregunta con monto como consulta read-only", () => {
    const turn = analyzeConversationTurn({
      text: "puedo gastar 50 hoy?",
      receivedAt,
      timezone,
    });

    expect(turn.query.kind).toBe("balance_snapshot");
    expect(turn.turn_state).toMatchObject({
      act: "financial_question",
      experience_mode: "read_only_answer",
      should_route_to_conversation_agent: true,
    });
  });

  it("entiende seguimientos usando memoria activa sin convertirlos en frases hardcodeadas", () => {
    const turn = analyzeConversationTurn({
      text: "me puedes decir la hora de cada uno?",
      receivedAt,
      timezone,
      activeState: activeMovementState,
    });

    expect(turn.query.kind).toBe("movement_search");
    expect(turn.query.date_range?.label).toBe("hoy");
    expect(turn.turn_state).toMatchObject({
      act: "financial_follow_up",
      continuity: "follow_up",
      experience_mode: "read_only_answer",
      should_use_active_memory: true,
      should_route_to_conversation_agent: true,
    });
    expect(turn.turn_state.response_guidance).toContain(
      "usar la respuesta anterior como contexto activo"
    );
  });

  it("mantiene continuidad para detalles, origen y fuentes sin reiniciar el hilo", () => {
    const turn = analyzeConversationTurn({
      text: "y de donde salio ese gasto?",
      receivedAt,
      timezone,
      activeState: activeMovementState,
    });

    expect(turn.query.kind).toBe("movement_search");
    expect(turn.query.date_range?.label).toBe("hoy");
    expect(turn.turn_state).toMatchObject({
      act: "financial_follow_up",
      continuity: "follow_up",
      should_use_active_memory: true,
      should_route_to_conversation_agent: true,
    });
    expect(turn.turn_state.response_guidance).toContain(
      "responder sobre el hilo activo sin repetir todo"
    );
  });

  it("entiende preguntas historicas y semanticas como memoria financiera consultable", () => {
    const historical = analyzeConversationTurn({
      text: "cuando fue la ultima vez que pague Netflix?",
      receivedAt,
      timezone,
    });
    const semantic = analyzeConversationTurn({
      text: "que gastos hice el dia que fui al medico?",
      receivedAt,
      timezone,
    });

    expect(historical.query.kind).toBe("movement_search");
    expect(semantic.query.kind).toBe("movement_search");
    expect(historical.turn_state).toMatchObject({
      act: "financial_question",
      experience_mode: "read_only_answer",
      should_route_to_conversation_agent: true,
    });
    expect(semantic.turn_state.response_guidance).toContain(
      "mostrar periodo interpretado y fuente de datos"
    );
  });

  it("detecta reconstruccion financiera cuando el usuario no recuerda datos", () => {
    const turn = analyzeConversationTurn({
      text: "creo que ayer gaste en taxi y comida pero no recuerdo cuanto",
      receivedAt,
      timezone,
    });

    expect(turn.query.kind).toBe("movement_search");
    expect(turn.query.date_range?.label).toBe("ayer");
    expect(turn.turn_state).toMatchObject({
      act: "financial_reconstruction",
      emotional_state: "uncertain",
      experience_mode: "reconstruction",
      should_route_to_conversation_agent: true,
    });
    expect(turn.turn_state.response_guidance).toContain(
      "ayudar a reconstruir sin crear movimientos confirmados sin datos"
    );
  });

  it("marca ansiedad o culpa para que la respuesta baje tension antes del detalle", () => {
    const turn = analyzeConversationTurn({
      text: "ya se que gaste mucho en delivery, no me juzgues",
      receivedAt,
      timezone,
    });

    expect(turn.turn_state.emotional_state).toBe("anxious");
    expect(turn.turn_state.should_route_to_conversation_agent).toBe(true);
    expect(turn.turn_state.response_guidance).toContain(
      "bajar ansiedad antes de dar detalle"
    );
    expect(turn.turn_state.response_guidance).toContain(
      "evitar tono alarmista o defensivo"
    );
  });

  it("agrega guia emocional y funcional para consultas de deuda", () => {
    const turn = analyzeConversationTurn({
      text: "cuanto le debo a Luis?",
      receivedAt,
      timezone,
    });

    expect(turn.query.kind).toBe("debt_summary");
    expect(turn.turn_state).toMatchObject({
      act: "financial_question",
      experience_mode: "read_only_answer",
      should_route_to_conversation_agent: true,
    });
    expect(turn.turn_state.response_guidance).toContain(
      "separar lo que el usuario debe de lo que le deben"
    );
    expect(turn.turn_state.response_guidance).toContain(
      "reducir ansiedad y evitar tono de cobranza"
    );
  });

  it("agrega guia para pagos que vienen sin alarmar", () => {
    const turn = analyzeConversationTurn({
      text: "que pagos vienen este mes?",
      receivedAt,
      timezone,
    });

    expect(turn.query.kind).toBe("recurring_summary");
    expect(turn.query.date_range?.label).toBe("este mes");
    expect(turn.turn_state.response_guidance).toContain(
      "anticipar pagos que vienen sin sonar alarmista"
    );
    expect(turn.turn_state.response_guidance).toContain(
      "no marcar pagos como hechos sin confirmacion del Core"
    );
  });

  it("agrega guia para memoria consultable sin historial crudo", () => {
    const turn = analyzeConversationTurn({
      text: "que recuerdas de mis preferencias?",
      receivedAt,
      timezone,
      activeState: activeMovementState,
    });

    expect(turn.query.kind).toBe("financial_memory_search");
    expect(turn.turn_state.response_guidance).toContain(
      "usar memoria resumida sin exponer historial crudo"
    );
    expect(turn.turn_state.personalization_cues).toContain(
      "hay memoria conversacional activa"
    );
  });

  it("saluda sin borrar la pista de que hay una conversacion activa", () => {
    const turn = analyzeConversationTurn({
      text: "hola",
      receivedAt,
      timezone,
      activeState: activeMovementState,
    });

    expect(turn.turn_state).toMatchObject({
      act: "greeting",
      continuity: "new_topic",
      emotional_state: "curious",
      should_use_active_memory: false,
    });
    expect(turn.turn_state.personalization_cues).toContain(
      "hay memoria conversacional activa"
    );
    expect(turn.turn_state.personalization_cues).toContain(
      "saludar breve y ofrecer una accion facil"
    );
  });
});
