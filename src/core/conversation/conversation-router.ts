import type {
  ConversationDateRange,
  ConversationQuery,
  ConversationQueryKind,
  ConversationReferencedMovement,
} from "@/agents/conversation-agent";

export function classifyConversationQuery(input: {
  text: string;
  receivedAt: string;
  timezone: string;
  activeState?: {
    last_query_kind: ConversationQueryKind | null;
    last_query_date_range: ConversationDateRange | null;
    referenced_movements: ConversationReferencedMovement[];
    referenced_entities?: Array<Record<string, unknown>>;
    continuity_hint: string | null;
  } | null;
}): ConversationQuery {
  const normalized = normalizeText(input.text);
  const dateRange = resolveDateRange({
    text: normalized,
    receivedAt: input.receivedAt,
    timezone: input.timezone,
  });
  const requestedAmount = extractRequestedAmount(normalized);
  const activeState = input.activeState ?? null;

  if (
    activeState?.last_query_kind &&
    activeState.last_query_kind !== "unsupported" &&
    isActiveContinuationQuestion(normalized, activeState) &&
    !hasExplicitNewQuestion(normalized, activeState.last_query_kind)
  ) {
    return {
      kind: activeState.last_query_kind,
      normalized_text: normalized,
      requested_amount: requestedAmount,
      date_range: dateRange ?? activeState.last_query_date_range,
      confidence: activeStateHasReferences(activeState) ? 0.88 : 0.78,
    };
  }

  if (
    activeState?.last_query_kind === "movement_search" &&
    isMovementContinuityQuestion(normalized, activeState)
  ) {
    return {
      kind: "movement_search",
      normalized_text: normalized,
      requested_amount: null,
      date_range: dateRange ?? activeState.last_query_date_range,
      confidence: activeState.referenced_movements.length > 0 ? 0.88 : 0.78,
    };
  }

  if (isDebtQuestion(normalized)) {
    return {
      kind: "debt_summary",
      normalized_text: normalized,
      requested_amount: requestedAmount,
      date_range: dateRange,
      confidence: 0.84,
    };
  }

  if (isHistoricalMovementLookupQuestion(normalized)) {
    return {
      kind: "movement_search",
      normalized_text: normalized,
      requested_amount: null,
      date_range: dateRange,
      confidence: dateRange ? 0.86 : 0.78,
    };
  }

  if (isRecurringQuestion(normalized)) {
    return {
      kind: "recurring_summary",
      normalized_text: normalized,
      requested_amount: requestedAmount,
      date_range: dateRange,
      confidence: 0.84,
    };
  }

  if (isFinancialMemoryQuestion(normalized)) {
    return {
      kind: "financial_memory_search",
      normalized_text: normalized,
      requested_amount: null,
      date_range: null,
      confidence: 0.78,
    };
  }

  if (isBalanceQuestion(normalized)) {
    return {
      kind: "balance_snapshot",
      normalized_text: normalized,
      requested_amount: requestedAmount,
      date_range: null,
      confidence: 0.86,
    };
  }

  if (isMovementSearchQuestion(normalized, activeState)) {
    return {
      kind: "movement_search",
      normalized_text: normalized,
      requested_amount: null,
      date_range: dateRange,
      confidence: dateRange ? 0.84 : 0.75,
    };
  }

  if (isPendingQuestion(normalized)) {
    return {
      kind: "pending_summary",
      normalized_text: normalized,
      requested_amount: null,
      date_range: null,
      confidence: 0.8,
    };
  }

  return {
    kind: "unsupported",
    normalized_text: normalized,
    requested_amount: null,
    date_range: null,
    confidence: 0.25,
  };
}

function isBalanceQuestion(text: string): boolean {
  return /\b(dinero libre|cuanto tengo|cuanto me queda|me queda|disponible|saldo|puedo gastar|puedo usar|alcanza)\b/.test(
    text
  );
}

function isDebtQuestion(text: string): boolean {
  return (
    /\b(deuda|deudas|debo|debes|debe|deben|me deben|me debe|le debo|te debo|prestamo|prestamos|cuota|cuotas)\b/.test(
      text
    ) &&
    !/\b(netflix|spotify|suscripcion|suscripciones|recurrente|recurrentes|pagos que vienen)\b/.test(
      text
    )
  );
}

function isRecurringQuestion(text: string): boolean {
  return /\b(pagos que vienen|pagos vienen|pago que viene|recurrente|recurrentes|suscripcion|suscripciones|netflix|spotify|compromisos|comprometido|vencimientos|proximo pago|pagos proximos|este mes debo pagar|que viene este mes)\b/.test(
    text
  );
}

function isFinancialMemoryQuestion(text: string): boolean {
  return /\b(que recuerdas|recuerdas de mi|que sabes de mi|que sabes de|sabes sobre mi|sabes algo de|preferencias|mis preferencias|personas frecuentes|correcciones|que aprendiste|cosas que aprendiste|como suelo|como acostumbro|como gasto|forma de gastar|mis habitos|mis patrones|alias|apodos|personas que menciono|mi contexto|mi memoria)\b/.test(
    text
  );
}

function isMovementSearchQuestion(
  text: string,
  activeState: {
    referenced_movements: ConversationReferencedMovement[];
    continuity_hint: string | null;
  } | null
): boolean {
  return (
    /\b(que gaste|que gastos|gastos hice|movimientos hice|movimientos tengo|historial|en que gaste|cuanto gaste|sin clasificar|sin categoria)\b/.test(
      text
    ) ||
    isMovementTimeQuestion(text, activeState) ||
    isFinancialReconstructionQuestion(text) ||
    isHistoricalMovementLookupQuestion(text) ||
    isSemanticMovementLookupQuestion(text)
  );
}

function isHistoricalMovementLookupQuestion(text: string): boolean {
  return (
    /\b(cuando fue|ultima vez|ultimo pago|cuando pague|cuando compre|cuando gaste|cuando registre|cuando hice)\b/.test(
      text
    ) &&
    /\b(pague|pago|pagar|compre|compra|gaste|gasto|registre|registro|netflix|spotify|laptop|medico|clinica|farmacia|taxi|delivery|cafe)\b/.test(
      text
    )
  );
}

function isSemanticMovementLookupQuestion(text: string): boolean {
  return (
    /\b(lo de|ese gasto|esa compra|gasto grande|compra grande|movimiento raro|movimientos raros|gastos raros|dia que fui|cuando fui|fui al)\b/.test(
      text
    ) &&
    /\b(gasto|gastos|compra|movimiento|movimientos|pago|pague|laptop|medico|clinica|farmacia|taxi|delivery|cafe)\b/.test(
      text
    )
  );
}

function isFinancialReconstructionQuestion(text: string): boolean {
  return (
    /\b(creo|no recuerdo|no se|nose|tal vez|talvez|mas o menos)\b/.test(text) &&
    /\b(gaste|gasto|pague|taxi|comida|almuerzo|cena|desayuno|delivery|movimiento|plata)\b/.test(
      text
    )
  );
}

function isPendingQuestion(text: string): boolean {
  return /\b(pendiente|pendientes|por revisar|por confirmar|bandeja)\b/.test(text);
}

function isActiveContinuationQuestion(
  text: string,
  activeState: {
    last_query_kind: ConversationQueryKind | null;
    referenced_movements: ConversationReferencedMovement[];
    referenced_entities?: Array<Record<string, unknown>>;
    continuity_hint: string | null;
  }
): boolean {
  if (!activeState.last_query_kind) return false;

  const hasGenericReference =
    /\b(cada uno|cada una|esos|esas|eso|ese|esa|anterior|lo anterior|ultimo|ultima|primero|primer|segundo|tercero|tercer|cuarto|quinto|los mismos|las mismas|el de|la de|y el|y la|tambien|ademas|dime|puedes decirme|me puedes decir)\b/.test(
      text
    );
  const asksFollowUpDetail =
    /\b(hora|horas|fecha|cuando|vence|vencen|detalle|detalles|fuente|origen|de donde|cuenta|categoria|monto|total|suma|estado|por que|como|cual|cuales|quien|quienes)\b/.test(
      text
    );

  return (
    Boolean(activeState.continuity_hint) &&
    activeStateHasReferences(activeState) &&
    (hasGenericReference || asksFollowUpDetail)
  );
}

function activeStateHasReferences(activeState: {
  referenced_movements: ConversationReferencedMovement[];
  referenced_entities?: Array<Record<string, unknown>>;
}): boolean {
  return (
    activeState.referenced_movements.length > 0 ||
    (activeState.referenced_entities?.length ?? 0) > 0
  );
}

function hasExplicitNewQuestion(
  text: string,
  activeKind: ConversationQueryKind
): boolean {
  if (isCancelLike(text)) return true;
  if (activeKind !== "balance_snapshot" && isBalanceQuestion(text)) return true;
  if (activeKind !== "debt_summary" && isDebtQuestion(text)) return true;
  if (activeKind !== "recurring_summary" && isRecurringQuestion(text)) return true;
  if (activeKind !== "pending_summary" && isPendingQuestion(text)) return true;
  if (
    activeKind !== "movement_search" &&
    (isMovementSearchQuestion(text, null) || hasExplicitDateReference(text))
  ) {
    return true;
  }
  return false;
}

function isCancelLike(text: string): boolean {
  return /\b(cancela|cancelar|olvida|dejalo|ya no|no hagas nada)\b/.test(text);
}

function isMovementTimeQuestion(
  text: string,
  activeState: { referenced_movements: ConversationReferencedMovement[] } | null
): boolean {
  const hasTimeIntent = /\b(hora|horas|a que hora|a que horas|cuando|fecha)\b/.test(
    text
  );
  const hasExplicitMovementSubject =
    /\b(movimiento|movimientos|gasto|gastos|registro|registros)\b/.test(text);
  const hasGenericGroupReference = /\b(cada uno|cada una|cada movimiento|cada gasto)\b/.test(
    text
  );
  const hasActiveReferencedMovements = Boolean(
    activeState && activeState.referenced_movements.length > 0
  );

  return (
    hasTimeIntent &&
    (hasExplicitMovementSubject ||
      (hasGenericGroupReference && hasActiveReferencedMovements))
  );
}

function isMovementContinuityQuestion(
  text: string,
  activeState: {
    referenced_movements: ConversationReferencedMovement[];
    continuity_hint: string | null;
  }
): boolean {
  if (isMovementTimeQuestion(text, activeState)) return true;

  const hasReferences =
    /\b(cada uno|cada una|esos|esas|eso|ese|esa|anterior|ultimo|ultima|primero|primer|segundo|tercero|tercer|cuarto|quinto|los mismos|las mismas)\b/.test(
      text
    );
  const asksDetail =
    /\b(hora|horas|detalle|detalles|fuente|de donde|cuando|cual|cuales|monto|total|suma|categoria|rubro|cuenta|tarjeta|efectivo|por que)\b/.test(
      text
    );
  const asksSpecificReferencedMovement = activeState.referenced_movements.some(
    (movement) => {
      const description = movement.description
        ? normalizeText(movement.description)
        : "";
      const category = movement.category_id ? normalizeText(movement.category_id) : "";
      return (
        (description.length > 2 && text.includes(description)) ||
        (category.length > 2 && text.includes(category))
      );
    }
  );

  return (
    activeState.referenced_movements.length > 0 &&
    ((hasReferences && asksDetail) || asksSpecificReferencedMovement)
  );
}

function extractRequestedAmount(text: string): number | null {
  const match = text.match(/(?:s\/|\bsoles?\b|\bgastar\b|\busar\b)?\s*(\d+(?:[.,]\d{1,2})?)/);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function resolveDateRange(input: {
  text: string;
  receivedAt: string;
  timezone: string;
}): ConversationDateRange | null {
  const today = localIsoDate(new Date(input.receivedAt), input.timezone);

  if (/\bhoy\b/.test(input.text)) {
    return dateRangeForLocalDate(today, "hoy", input.timezone);
  }

  if (/\bayer\b/.test(input.text)) {
    return dateRangeForLocalDate(addDays(today, -1), "ayer", input.timezone);
  }

  if (/\b(esta semana|semana)\b/.test(input.text)) {
    const start = startOfWeek(today);
    const end = addDays(start, 6);
    return {
      start: startOfLocalDate(start, input.timezone),
      end: endOfLocalDate(end, input.timezone),
      label: "esta semana",
    };
  }

  if (/\b(este mes|mes actual)\b/.test(input.text)) {
    const start = startOfMonth(today);
    const end = endOfMonth(today);
    return {
      start: startOfLocalDate(start, input.timezone),
      end: endOfLocalDate(end, input.timezone),
      label: "este mes",
    };
  }

  if (/\b(proximo mes|siguiente mes|mes que viene)\b/.test(input.text)) {
    const reference = addMonths(today, 1);
    const start = startOfMonth(reference);
    const end = endOfMonth(reference);
    return {
      start: startOfLocalDate(start, input.timezone),
      end: endOfLocalDate(end, input.timezone),
      label: "el proximo mes",
    };
  }

  const lastFridayMonthsAgo = input.text.match(
    /\b(?:ultimo|último)\s+viernes\s+de\s+hace\s+(\d{1,2})\s+meses?\b/
  );
  if (lastFridayMonthsAgo) {
    const months = Number(lastFridayMonthsAgo[1]);
    if (Number.isFinite(months)) {
      const reference = addMonths(today, -months);
      const friday = previousOrSameWeekday(reference, 5);
      return dateRangeForLocalDate(
        friday,
        `el ultimo viernes de hace ${months} meses`,
        input.timezone
      );
    }
  }

  if (/\b(?:ultimo|último)\s+viernes\b/.test(input.text)) {
    const friday = previousOrSameWeekday(today, 5);
    return dateRangeForLocalDate(friday, "el ultimo viernes", input.timezone);
  }

  return null;
}

function dateRangeForLocalDate(
  date: string,
  label: string,
  timezone: string
): ConversationDateRange {
  return {
    start: startOfLocalDate(date, timezone),
    end: endOfLocalDate(date, timezone),
    label,
  };
}

function startOfLocalDate(date: string, timezone: string): string {
  return `${date}T00:00:00.000${offsetForTimezone(timezone)}`;
}

function endOfLocalDate(date: string, timezone: string): string {
  return `${date}T23:59:59.999${offsetForTimezone(timezone)}`;
}

function offsetForTimezone(timezone: string): string {
  return timezone === "America/Lima" ? "-05:00" : "Z";
}

function localIsoDate(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function addDays(date: string, days: number): string {
  const utc = new Date(`${date}T00:00:00.000Z`);
  utc.setUTCDate(utc.getUTCDate() + days);
  return toIsoDate(utc);
}

function addMonths(date: string, months: number): string {
  const utc = new Date(`${date}T00:00:00.000Z`);
  utc.setUTCMonth(utc.getUTCMonth() + months);
  return toIsoDate(utc);
}

function previousOrSameWeekday(date: string, targetDay: number): string {
  const utc = new Date(`${date}T00:00:00.000Z`);
  const diff = (utc.getUTCDay() - targetDay + 7) % 7;
  utc.setUTCDate(utc.getUTCDate() - diff);
  return toIsoDate(utc);
}

function startOfWeek(date: string): string {
  const utc = new Date(`${date}T00:00:00.000Z`);
  const mondayBasedDay = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - mondayBasedDay);
  return toIsoDate(utc);
}

function startOfMonth(date: string): string {
  const utc = new Date(`${date}T00:00:00.000Z`);
  utc.setUTCDate(1);
  return toIsoDate(utc);
}

function endOfMonth(date: string): string {
  const utc = new Date(`${date}T00:00:00.000Z`);
  utc.setUTCMonth(utc.getUTCMonth() + 1, 0);
  return toIsoDate(utc);
}

function hasExplicitDateReference(text: string): boolean {
  return /\b(hoy|ayer|esta semana|semana pasada|este mes|proximo mes|mes que viene|ultimo viernes|viernes|hace \d{1,2} meses|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/.test(
    text
  );
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
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
