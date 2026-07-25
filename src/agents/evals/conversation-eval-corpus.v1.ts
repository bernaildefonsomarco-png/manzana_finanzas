import type {
  ConversationContinuity,
  ConversationQueryKind,
  ConversationTurnAct,
} from "@/agents/conversation-agent";
import type {
  PlanningGoal,
  PlanningWorkflow,
} from "@/agents/orchestration-planning-agent/types";

export type ConversationEvalCase = {
  id: string;
  family: string;
  message: string;
  has_active_movement_context: boolean;
  expected: {
    acts: ConversationTurnAct[];
    continuities: ConversationContinuity[];
    query_kinds: ConversationQueryKind[];
    goals: PlanningGoal[];
    workflows: PlanningWorkflow[];
    requires_confirmation: boolean | null;
    financial_write_must_use_core: boolean;
    direct_write_forbidden: boolean;
  };
};

type Family = Omit<ConversationEvalCase, "id" | "message"> & {
  messages: string[];
};

const families: Family[] = [
  family("capture_expense", [
    "gaste 20 en desayuno",
    "hice un gasto de 20 soles comprando desayuno",
    "compre desayuno por 20",
    "me salio 15 el taxi",
    "anota 8 cafe",
    "apunta 12 de combi",
    "registre 35 en almuerzo",
    "pague 40 por internet",
    "20 soles en menu",
    "hoy fueron 18 en farmacia",
  ], ["financial_capture"], ["new_topic"], ["unsupported"], ["record"], ["financial_capture"], false, true),
  family("capture_income", [
    "me pagaron 300 por un trabajo",
    "recibi 120 de Ana",
    "me entro un ingreso de 500",
    "anota 80 que me pagaron",
    "registre 150 de freelance",
    "me depositaron 200 de sueldo",
    "me yapearon 35 por la entrada",
    "ingreso 90 por venta",
    "me devolvieron 60",
    "hoy cobre 400",
  ], ["financial_capture"], ["new_topic"], ["unsupported"], ["record"], ["financial_capture"], false, true),
  family("capture_multiple", [
    "gaste 8 cafe, 15 taxi y 20 almuerzo",
    "anota 10 desayuno y 25 movilidad",
    "hoy 12 combi, 18 menu y 7 agua",
    "pague 40 internet y 30 celular",
    "compre pan por 6 y leche por 8",
    "registre 20 comida, 15 taxi, 5 cafe",
    "fueron 45 mercado y 12 pasaje",
    "apunta 9 desayuno mas 22 almuerzo",
    "gaste 14 farmacia y 11 movilidad",
    "me salio 30 cena y 8 taxi",
  ], ["financial_capture"], ["new_topic"], ["unsupported"], ["record"], ["financial_capture"], false, true),
  family("hypothetical_money", [
    "puedo gastar 50 hoy?",
    "si gasto 80 cuanto me queda?",
    "me alcanza para comprar algo de 120?",
    "podria usar 30 para almorzar?",
    "cuanto tengo libre ahorita?",
    "tengo plata para un taxi de 25?",
    "si pago 100 sigo cubriendo mis pagos?",
    "me quedan 60 libres?",
    "puedo separar 40 sin quedarme corto?",
    "como esta mi dinero libre?",
  ], ["financial_question"], ["new_topic"], ["balance_snapshot"], ["query"], ["conversation_read_only"], false, false),
  family("movement_search", [
    "que movimientos hice hoy?",
    "que gaste ayer?",
    "muestrame mis gastos de esta semana",
    "cuanto llevo en comida este mes?",
    "busca mis taxis recientes",
    "que compras registre el lunes?",
    "dime mis ultimos movimientos",
    "cuanto gaste en cafe?",
    "que ingresos tuve esta semana?",
    "revisa mis movimientos de hoy",
  ], ["financial_question"], ["new_topic"], ["movement_search"], ["query"], ["conversation_read_only"], false, false),
  family("movement_follow_up", [
    "a que hora fue cada uno?",
    "en que cuenta fue el primero?",
    "de donde salio el segundo?",
    "cual fue la categoria de esos?",
    "dime el detalle del ultimo",
    "y cuanto suman?",
    "quien aparece en el tercero?",
    "cuales fueron por whatsapp?",
    "y las fechas de cada uno?",
    "el primero fue confirmado?",
  ], ["financial_follow_up"], ["follow_up"], ["movement_search"], ["query"], ["conversation_read_only"], false, false, true),
  family("correction_delete", [
    "descarta el ultimo gasto",
    "borra el desayuno de hoy",
    "elimina ese movimiento",
    "quita el taxi anterior",
    "anula el ultimo registro",
    "deshaz lo que acabo de registrar",
    "no quiero ese gasto, descartalo",
    "borra los movimientos de ayer",
    "elimina el primero de la lista",
    "cancela ese registro",
  ], ["correction"], ["repair_or_clarification", "cancel"], ["unsupported", "movement_search"], ["correction"], ["correction_review"], true, true, true, true),
  family("correction_reclassify", [
    "eso no fue gasto, fue prestamo a Luis",
    "no era taxi, era Uber de trabajo",
    "cambia el almuerzo a comida de trabajo",
    "corrige ese ingreso, fue devolucion",
    "el ultimo no fue pago, fue transferencia",
    "me equivoque, eran 18 y no 80",
    "pon el cafe en alimentacion",
    "no fue para Ana, fue para Luis",
    "la cuenta correcta era Yape",
    "corrige la fecha al viernes",
  ], ["correction"], ["repair_or_clarification"], ["unsupported", "movement_search"], ["correction"], ["correction_review"], true, true, true, true),
  family("mixed_capture_query", [
    "registre 20 en desayuno, como voy esta semana?",
    "gaste 15 en taxi, cuanto llevo hoy?",
    "anota 8 cafe, cuanto me queda libre?",
    "pague 40 internet, como va mi mes?",
    "registre 30 comida, cuanto llevo en comida?",
    "gaste 12 en combi, como voy con transporte?",
    "anota 25 mercado, me alcanza para hoy?",
    "registre 50 de ingreso, cuanto tengo libre?",
    "pague 20 celular, que movimientos hice hoy?",
    "gaste 18 almuerzo, cuanto llevo esta semana?",
  ], ["financial_capture"], ["new_topic", "topic_shift"], ["movement_search", "balance_snapshot", "unsupported"], ["mixed"], ["mixed_capture_and_query"], false, true),
  family("debt_query", [
    "cuanto le debo a Luis?",
    "quien me debe dinero?",
    "como van mis deudas?",
    "que cuotas me faltan?",
    "cuanto me debe Ana?",
    "muestrame mis prestamos",
    "que deuda tengo pendiente?",
    "cuanto debo en total?",
    "quienes me deben?",
    "como va la deuda con Juan?",
  ], ["financial_question"], ["new_topic"], ["debt_summary"], ["query"], ["conversation_read_only"], false, false),
  family("recurring_query", [
    "que pagos vienen este mes?",
    "cuando toca Netflix?",
    "que recurrentes tengo?",
    "que pago se acerca?",
    "muestrame mis suscripciones",
    "que tengo que pagar esta semana?",
    "cuando vence internet?",
    "que compromisos vienen pronto?",
    "hay alguna cuota proxima?",
    "que pagos habituales detectaste?",
  ], ["financial_question"], ["new_topic"], ["recurring_summary"], ["query"], ["conversation_read_only"], false, false),
  family("pending_query", [
    "que tengo pendiente?",
    "muestrame lo que falta revisar",
    "hay movimientos por confirmar?",
    "cuantos pendientes tengo?",
    "que detecto el correo?",
    "revisa mis pendientes",
    "que falta aprobar?",
    "tengo algo por revisar?",
    "dime los pendientes de hoy",
    "que movimientos aun no cuentan?",
  ], ["financial_question"], ["new_topic"], ["pending_summary"], ["query"], ["conversation_read_only"], false, false),
  family("memory_query", [
    "que recuerdas de mis preferencias?",
    "como prefiero que me respondas?",
    "quienes aparecen seguido en mis movimientos?",
    "que correcciones aprendiste?",
    "que sabes de mi forma de gastar?",
    "recuerdas como llamo a Luis?",
    "que aliases tengo guardados?",
    "que aprendiste de mis Uber?",
    "que contexto tienes sobre Ana?",
    "que tienes en memoria sobre mi?",
  ], ["financial_question"], ["new_topic"], ["financial_memory_search"], ["query"], ["conversation_read_only"], false, false),
  family("reconstruction", [
    "creo que ayer gaste en taxi y comida pero no recuerdo cuanto",
    "se me fue algo en almuerzo, no se el monto",
    "tal vez pague transporte ayer",
    "no recuerdo cuanto costo la cena",
    "creo que hice dos gastos el viernes",
    "ayer compre algo pero no se que fue",
    "me parece que pague taxi y cafe",
    "no recuerdo si fueron 20 o 30 en comida",
    "creo que gaste mas o menos 50",
    "ayudame a reconstruir lo de ayer",
  ], ["financial_reconstruction", "financial_question"], ["new_topic"], ["movement_search", "unsupported"], ["query"], ["conversation_read_only"], false, false),
  family("greeting", [
    "hola", "buenas", "buenos dias", "buenas tardes", "buenas noches",
    "hey", "hola manzana", "holi", "que tal", "como estas",
  ], ["greeting", "smalltalk"], ["new_topic"], ["unsupported"], ["help"], ["support"], false, false),
  family("help", [
    "ayuda", "que puedes hacer?", "como funciona?", "como uso Manzana?",
    "para que sirves?", "como empiezo?", "que puedo registrar?",
    "puedes ayudarme con mi dinero?", "explicame como usar esto", "necesito orientacion",
  ], ["help", "unsupported"], ["new_topic"], ["unsupported"], ["help"], ["support"], false, false),
  family("frustrated_repair", [
    "no eso, me referia al taxi",
    "otra vez te equivocaste",
    "eso esta mal, corrigelo",
    "no funciona, era el primero",
    "me entendiste mal",
    "no era eso lo que pedi",
    "perdon, quise decir almuerzo",
    "mejor dicho fue transferencia",
    "ese resultado no cuadra",
    "te dije que no era gasto",
  ], ["correction", "unsupported"], ["repair_or_clarification"], ["unsupported", "movement_search"], ["correction", "help"], ["correction_review", "support"], true, true, true, true),
  family("ambiguous_transfer_or_loan", [
    "le pase 50 a Luis",
    "mande 100 a Ana",
    "yapee 30 a Juan",
    "le di 80 a mi hermano",
    "recibi 60 de Luis",
    "me pasaron 45",
    "puse 200 para la casa",
    "movi 100 a otra cuenta",
    "le devolvi 70 a Ana",
    "me entregaron 90",
  ], ["financial_capture", "unsupported"], ["new_topic"], ["unsupported"], ["record", "help"], ["financial_capture", "support"], null, true),
  family("historical_query", [
    "que gaste el ultimo viernes de hace 4 meses?",
    "muestrame mis gastos del 12 de marzo",
    "que movimientos hice hace tres semanas?",
    "cuanto gaste en enero?",
    "que compre el viernes pasado?",
    "dime mis gastos de hace 90 dias",
    "que ingresos tuve el mes pasado?",
    "busca mis taxis de abril",
    "cuanto pague la primera semana de mayo?",
    "que movimientos hubo ayer hace un mes?",
  ], ["financial_question"], ["new_topic"], ["movement_search"], ["query"], ["conversation_read_only"], false, false),
  family("topic_shift", [
    "y ahora cuanto tengo libre?",
    "cambiando de tema, que pagos vienen?",
    "ademas, cuanto le debo a Luis?",
    "ahora muestrame mis pendientes",
    "dejando eso, que gaste hoy?",
    "otra cosa, como van mis deudas?",
    "bien, y que recuerdas de mis preferencias?",
    "pasemos a mis pagos que vienen",
    "ahora quiero ver mis movimientos",
    "y mi dinero libre como esta?",
  ], ["financial_question", "financial_follow_up"], ["topic_shift", "follow_up"], ["balance_snapshot", "recurring_summary", "debt_summary", "pending_summary", "movement_search", "financial_memory_search"], ["query"], ["conversation_read_only"], false, false, true),
];

export const CONVERSATION_EVAL_CORPUS_V1: ConversationEvalCase[] = families.flatMap(
  ({ messages, ...definition }) =>
    messages.map((message, index) => ({
      ...definition,
      id: `${definition.family}-${String(index + 1).padStart(2, "0")}`,
      message,
    }))
);

function family(
  name: string,
  messages: string[],
  acts: ConversationTurnAct[],
  continuities: ConversationContinuity[],
  queryKinds: ConversationQueryKind[],
  goals: PlanningGoal[],
  workflows: PlanningWorkflow[],
  requiresConfirmation: boolean | null,
  financialWriteMustUseCore: boolean,
  directWriteForbidden = true,
  hasActiveMovementContext = false
): Family {
  return {
    family: name,
    messages,
    has_active_movement_context: hasActiveMovementContext,
    expected: {
      acts,
      continuities,
      query_kinds: queryKinds,
      goals,
      workflows,
      requires_confirmation: requiresConfirmation,
      financial_write_must_use_core: financialWriteMustUseCore,
      direct_write_forbidden: directWriteForbidden,
    },
  };
}
