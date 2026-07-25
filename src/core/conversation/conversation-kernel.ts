import type {
  ConversationDateRange,
  ConversationQuery,
  ConversationQueryKind,
  ConversationReferencedMovement,
  ConversationTurnState,
} from "@/agents/conversation-agent";
import { classifyConversationQuery } from "./conversation-router";

type ActiveConversationStateInput = {
  last_query_kind: ConversationQueryKind | null;
  last_query_date_range: ConversationDateRange | null;
  referenced_movements: ConversationReferencedMovement[];
  referenced_entities?: Array<Record<string, unknown>>;
  continuity_hint: string | null;
} | null;

export type ConversationTurnAnalysis = {
  query: ConversationQuery;
  turn_state: ConversationTurnState;
};

export function analyzeConversationTurn(input: {
  text: string;
  receivedAt: string;
  timezone: string;
  activeState?: ActiveConversationStateInput;
}): ConversationTurnAnalysis {
  const normalized = normalizeText(input.text);
  const activeState = input.activeState ?? null;
  const query = classifyConversationQuery({
    text: input.text,
    receivedAt: input.receivedAt,
    timezone: input.timezone,
    activeState,
  });
  const hasActiveMemory =
    Boolean(activeState?.last_query_kind) ||
    Boolean(activeState?.continuity_hint) ||
    (activeState?.referenced_movements.length ?? 0) > 0 ||
    (activeState?.referenced_entities?.length ?? 0) > 0;
  const shouldUseActiveMemory =
    hasActiveMemory && isContextualReference(normalized);
  const act = inferAct(normalized, query, shouldUseActiveMemory);
  const continuity = inferContinuity({
    normalized,
    act,
    query,
    hasActiveMemory,
    shouldUseActiveMemory,
  });
  const emotionalState = inferEmotionalState(normalized, act);
  const experienceMode = inferExperienceMode(act, query, normalized);
  const shouldRouteToConversationAgent =
    query.kind !== "unsupported" ||
    act === "financial_follow_up" ||
    act === "financial_reconstruction" ||
    act === "financial_capture" ||
    (act === "unsupported" && isQuestionLike(normalized));
  const shouldAskClarificationFirst =
    (act === "financial_reconstruction" && query.kind === "unsupported") ||
    (act === "financial_capture" && query.kind === "unsupported") ||
    (act === "unsupported" && isQuestionLike(normalized));

  return {
    query,
    turn_state: {
      act,
      continuity,
      emotional_state: emotionalState,
      experience_mode: experienceMode,
      should_use_active_memory: shouldUseActiveMemory,
      should_route_to_conversation_agent: shouldRouteToConversationAgent,
      should_ask_clarification_first: shouldAskClarificationFirst,
      response_guidance: buildResponseGuidance({
        act,
        continuity,
        emotionalState,
        experienceMode,
        query,
        shouldUseActiveMemory,
      }),
      personalization_cues: buildPersonalizationCues({
        act,
        continuity,
        hasActiveMemory,
        shouldUseActiveMemory,
      }),
      risk_notes: buildRiskNotes(normalized, query),
    },
  };
}

function inferAct(
  text: string,
  query: ConversationQuery,
  shouldUseActiveMemory: boolean
): ConversationTurnState["act"] {
  if (isGreeting(text)) return "greeting";
  if (isHelp(text)) return "help";
  if (isThanks(text)) return "gratitude";
  if (isCorrection(text)) return "correction";
  if (isFinancialReconstruction(text)) return "financial_reconstruction";
  if (shouldUseActiveMemory) return "financial_follow_up";
  if (query.kind !== "unsupported") return "financial_question";
  if (isFinancialCapture(text)) return "financial_capture";
  if (isSmalltalk(text)) return "smalltalk";
  return "unsupported";
}

function inferContinuity(input: {
  normalized: string;
  act: ConversationTurnState["act"];
  query: ConversationQuery;
  hasActiveMemory: boolean;
  shouldUseActiveMemory: boolean;
}): ConversationTurnState["continuity"] {
  if (isCancel(input.normalized)) return "cancel";
  if (isResume(input.normalized)) return "resume";
  if (input.act === "correction" || isRepair(input.normalized)) {
    return "repair_or_clarification";
  }
  if (input.shouldUseActiveMemory) return "follow_up";
  if (input.hasActiveMemory && hasExplicitNewTopic(input.normalized, input.query)) {
    return "topic_shift";
  }
  return "new_topic";
}

function inferEmotionalState(
  text: string,
  act: ConversationTurnState["act"]
): ConversationTurnState["emotional_state"] {
  if (act === "gratitude") return "relieved";
  if (act === "greeting" || act === "help") return "curious";
  if (/\b(no recuerdo|no se|nose|creo|tal vez|talvez|mas o menos|aprox|aproximad)\b/.test(text)) {
    return "uncertain";
  }
  if (/\b(rapido|rapida|ahorita|ya mismo|urgente|apurado|apuro)\b/.test(text)) {
    return "rushed";
  }
  if (/\b(ansiedad|preocupa|preocupado|culpa|verguenza|me pase|se me fue la mano|no me juzgues)\b/.test(text)) {
    return "anxious";
  }
  if (/\b(mal|fallo|no funciona|otra vez|molesto|molesta|error|equivocaste)\b/.test(text)) {
    return "frustrated";
  }
  return "neutral";
}

function inferExperienceMode(
  act: ConversationTurnState["act"],
  query: ConversationQuery,
  text: string
): ConversationTurnState["experience_mode"] {
  if (act === "correction") return "correction";
  if (act === "financial_capture") return "quick_capture";
  if (act === "financial_reconstruction") return "reconstruction";
  if (
    query.kind === "movement_search" &&
    /\b(por que|cambio|compar|siento|patron|raro|raros|tendencia)\b/.test(text)
  ) {
    return "deep_analysis";
  }
  if (query.kind !== "unsupported" || act === "financial_follow_up") {
    return "read_only_answer";
  }
  return "support";
}

function buildResponseGuidance(input: {
  act: ConversationTurnState["act"];
  continuity: ConversationTurnState["continuity"];
  emotionalState: ConversationTurnState["emotional_state"];
  experienceMode: ConversationTurnState["experience_mode"];
  query: ConversationQuery;
  shouldUseActiveMemory: boolean;
}): string[] {
  const guidance = [
    "responder sin culpa",
    "no inventar datos",
    "mantener read-only salvo que el flujo pase por Core",
  ];

  if (input.continuity === "follow_up" || input.shouldUseActiveMemory) {
    guidance.push("usar la respuesta anterior como contexto activo");
    guidance.push("no explicar desde cero si el seguimiento es claro");
    guidance.push("responder sobre el hilo activo sin repetir todo");
  }

  if (input.emotionalState === "uncertain") {
    guidance.push("reducir incertidumbre y preguntar solo un dato si falta evidencia");
  }

  if (input.emotionalState === "anxious" || input.emotionalState === "frustrated") {
    guidance.push("bajar ansiedad antes de dar detalle");
    guidance.push("evitar tono alarmista o defensivo");
  }

  if (input.experienceMode === "reconstruction") {
    guidance.push("ayudar a reconstruir sin crear movimientos confirmados sin datos");
  }

  if (input.experienceMode === "quick_capture") {
    guidance.push("detectar captura rapida y evitar respuesta larga");
    guidance.push("si falta monto, cuenta o fecha, pedir solo el dato minimo necesario");
  }

  if (input.query.kind === "movement_search") {
    guidance.push("separar confirmados de pendientes si aparecen");
    guidance.push("mostrar fuente o periodo cuando aporte confianza");
    guidance.push("mostrar periodo interpretado y fuente de datos");
  }

  if (input.query.kind === "balance_snapshot") {
    guidance.push("explicar limites de dinero libre con claridad breve");
  }

  if (input.query.kind === "debt_summary") {
    guidance.push("separar lo que el usuario debe de lo que le deben");
    guidance.push("reducir ansiedad y evitar tono de cobranza");
  }

  if (input.query.kind === "recurring_summary") {
    guidance.push("anticipar pagos que vienen sin sonar alarmista");
    guidance.push("no marcar pagos como hechos sin confirmacion del Core");
  }

  if (input.query.kind === "financial_memory_search") {
    guidance.push("usar memoria resumida sin exponer historial crudo");
    guidance.push("personalizar solo con datos relevantes para la pregunta");
  }

  return guidance;
}

function buildPersonalizationCues(input: {
  act: ConversationTurnState["act"];
  continuity: ConversationTurnState["continuity"];
  hasActiveMemory: boolean;
  shouldUseActiveMemory: boolean;
}): string[] {
  const cues = ["personalizacion ligera"];

  if (input.hasActiveMemory) {
    cues.push("hay memoria conversacional activa");
  }
  if (input.shouldUseActiveMemory || input.continuity === "follow_up") {
    cues.push("continuar el hilo anterior sin repetir introducciones");
  }
  if (input.act === "greeting") {
    cues.push("saludar breve y ofrecer una accion facil");
  }
  if (input.act === "gratitude") {
    cues.push("cerrar con calidez breve");
  }

  return cues;
}

function buildRiskNotes(
  text: string,
  query: ConversationQuery
): string[] {
  const notes: string[] = [];

  if (query.kind !== "unsupported") {
    notes.push("consulta read-only");
  }
  if (/\b(borra|elimina|confirma|descarta|cambia|corrige|prestamo|deuda|transferencia)\b/.test(text)) {
    notes.push("posible accion financiera: debe pasar por Core/PolicyGate");
  }
  if (/\b(salud|medico|clinica|farmacia|apuesta|casino|licor|deuda)\b/.test(text)) {
    notes.push("posible informacion sensible: aplicar discrecion");
  }

  return notes;
}

function isContextualReference(text: string): boolean {
  return /\b(eso|ese|esa|esos|esas|esto|esta|estas|estos|lo anterior|anterior|lo de|cada uno|cada una|los mismos|las mismas|primero|primer|segundo|tercero|tercer|cuarto|quinto|el de|la de|y la|y el|y eso|tambien|ademas|me puedes decir|puedes decirme|dime|cuentame|detallame|detalle|detalles|hora|fecha|cuando|cuenta|categoria|rubro|fuente|origen|de donde|monto|total|suma|quien|quienes)\b/.test(
    text
  );
}

function hasExplicitNewTopic(text: string, query: ConversationQuery): boolean {
  return (
    Boolean(query.date_range) ||
    /\b(hoy|ayer|esta semana|semana pasada|este mes|proximo mes|dinero libre|saldo|pendientes|deudas|pagos que vienen|recurrentes|compromisos)\b/.test(
      text
    )
  );
}

function isGreeting(text: string): boolean {
  return /^(hola|ola|holi|buenas|buenos dias|buenas tardes|buenas noches|hey|hello|hi|manzana)( manzana)?[.!?]*$/.test(
    text
  );
}

function isHelp(text: string): boolean {
  return /^(ayuda|help|que puedes hacer|que haces|como funciona|como uso manzana|para que sirves|que puedo hacer|como empiezo)[.!?]*$/.test(
    text
  );
}

function isThanks(text: string): boolean {
  return /^(gracias|muchas gracias|ok gracias|listo gracias|vale gracias|genial gracias|perfecto gracias|thanks)[.!?]*$/.test(
    text
  );
}

function isCorrection(text: string): boolean {
  return /\b(no fue|no era|corrige|corregir|correccion|cambia|cambiar|era|fue prestamo|fue deuda)\b/.test(
    text
  );
}

function isFinancialCapture(text: string): boolean {
  return /\b(gaste|gasto|hice un gasto|pague|pago|compre|comprando|me salio|me costo|me pagaron|recibi|ingreso|anota|apunta|registra|registre|registralo|guarda|guardalo|separa|transferi|preste|me prestaron)\b/.test(
    text
  );
}

function isFinancialReconstruction(text: string): boolean {
  return (
    /\b(creo|no recuerdo|no se|nose|tal vez|talvez|mas o menos)\b/.test(text) &&
    /\b(gaste|gasto|pague|taxi|comida|almuerzo|cena|desayuno|delivery|movimiento|plata)\b/.test(
      text
    )
  );
}

function isSmalltalk(text: string): boolean {
  return /\b(como estas|todo bien|que tal|quien eres)\b/.test(text);
}

function isCancel(text: string): boolean {
  return /\b(cancela|cancelar|olvida|dejalo|ya no|no hagas nada)\b/.test(text);
}

function isResume(text: string): boolean {
  return /\b(sigamos|continua|retoma|volvamos|dale con eso)\b/.test(text);
}

function isRepair(text: string): boolean {
  return /\b(no eso|me referia|quise decir|perdon|mejor dicho)\b/.test(text);
}

function isQuestionLike(text: string): boolean {
  return (
    /\?/.test(text) ||
    /\b(me puedes|puedes|podrias|dime|cuentame|explicame|quiero saber|necesito saber|sabes|como|cuando|cuanto|que)\b/.test(
      text
    )
  );
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s/.,?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
