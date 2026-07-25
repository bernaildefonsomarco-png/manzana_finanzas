import {
  ConversationalAnswerSchema,
  type ConversationalAnswer,
  type ConversationContextPack,
  type ConversationMemoryCorrection,
  type ConversationMemoryPerson,
  type ConversationToolResult,
} from "@/agents/conversation-agent/types";

type BalanceSnapshotData = {
  total_balance?: number;
  separated_in_boxes?: number;
  free_in_accounts?: number;
  operational_free_money?: number;
  upcoming_uncovered_commitments?: number;
  has_accounts?: boolean;
};

type MovementSearchData = {
  movements?: Array<{
    type?: string;
    amount?: number;
    currency?: "PEN" | "USD";
    description?: string | null;
    merchant?: string | null;
    category_id?: string | null;
    category_label?: string | null;
    occurred_at?: string;
    source?: string | null;
    source_ref?: string | null;
    account_origin_id?: string | null;
    account_origin_name?: string | null;
    account_destination_id?: string | null;
    account_destination_name?: string | null;
    confidence?: number | null;
    requires_review?: boolean;
  }>;
  date_label?: string | null;
  reference_source?: string | null;
  net_amount?: number;
};

type PendingSummaryData = {
  active_count?: number;
};

type DebtSummaryData = {
  debts?: Array<{
    type?: string;
    id?: string;
    name?: string;
    person_name?: string | null;
    direction?: "i_owe" | "they_owe_me";
    amount?: number;
    currency?: "PEN" | "USD";
    status?: string;
    due_date?: string | null;
    next_payment_date?: string | null;
  }>;
  installments?: Array<{
    type?: string;
    id?: string;
    title?: string;
    name?: string;
    direction?: "i_owe" | "they_owe_me";
    amount?: number;
    currency?: "PEN" | "USD";
    due_at?: string;
  }>;
  totals?: {
    i_owe_total?: number;
    they_owe_me_total?: number;
    i_owe_count?: number;
    they_owe_me_count?: number;
  };
  details?: Array<{
    id?: string;
    name?: string;
    person_name?: string | null;
    direction?: "i_owe" | "they_owe_me";
    currency?: "PEN" | "USD";
    current_balance?: number;
    schedule?: {
      installment_count?: number;
      configured_installment_count?: number | null;
      expected_total?: number;
      paid_total?: number;
      remaining_total?: number;
      balance_gap?: number;
    };
    installments?: Array<{
      id?: string;
      number?: number;
      due_date?: string;
      expected_amount?: number;
      paid_amount?: number;
      remaining_amount?: number;
      status?: string;
      allocation_count?: number;
    }>;
    payments?: Array<{
      id?: string;
      amount?: number;
      currency?: "PEN" | "USD";
      paid_at?: string;
      allocation_count?: number;
    }>;
  }>;
  date_label?: string | null;
};

type RecurringSummaryData = {
  commitments?: Array<{
    type?: string;
    id?: string;
    title?: string;
    name?: string;
    amount?: number;
    currency?: "PEN" | "USD";
    due_at?: string;
    kind?: string;
  }>;
  rules?: Array<{
    type?: string;
    id?: string;
    name?: string;
    expected_amount?: number;
    currency?: "PEN" | "USD";
    frequency?: string;
    next_expected_date?: string | null;
  }>;
  suggested_count?: number;
  total_amount?: number;
  date_label?: string | null;
};

type FinancialMemoryData = {
  query_text?: string;
  requested_facets?: string[];
  memory_levels_available?: string[];
  memory_levels_limited?: string[];
  preferences?: {
    tone_style?: string | null;
    discreet_mode?: boolean;
    whatsapp_opt_in?: boolean;
    email_opt_in?: boolean;
    quiet_hours?: { start?: string | null; end?: string | null } | null;
    default_account_id?: string | null;
  };
  frequent_people?: ConversationMemoryPerson[];
  matched_people?: ConversationMemoryPerson[];
  recent_corrections?: ConversationMemoryCorrection[];
  matched_corrections?: ConversationMemoryCorrection[];
  active_conversation?: {
    last_query_kind?: string | null;
    last_query_text?: string | null;
    last_result_summary?: string | null;
    referenced_movements_count?: number;
    referenced_entities?: Array<Record<string, unknown>>;
    continuity_hint?: string | null;
  } | null;
};

export function composeConversationAnswer(
  context: ConversationContextPack
): ConversationalAnswer {
  if (context.query.kind === "balance_snapshot") {
    return ConversationalAnswerSchema.parse(
      composeBalanceAnswer(context, getTool(context, "get_balance_snapshot"))
    );
  }

  if (context.query.kind === "movement_search") {
    return ConversationalAnswerSchema.parse(
      composeMovementSearchAnswer(context, getTool(context, "query_movements"))
    );
  }

  if (context.query.kind === "pending_summary") {
    return ConversationalAnswerSchema.parse(
      composePendingAnswer(context, getTool(context, "get_pending_summary"))
    );
  }

  if (context.query.kind === "debt_summary") {
    return ConversationalAnswerSchema.parse(
      composeDebtAnswer(
        context,
        getTool(context, "get_debt_summary"),
        getTool(context, "get_debt_details")
      )
    );
  }

  if (context.query.kind === "recurring_summary") {
    return ConversationalAnswerSchema.parse(
      composeRecurringAnswer(context, getTool(context, "get_recurring_summary"))
    );
  }

  if (context.query.kind === "financial_memory_search") {
    return ConversationalAnswerSchema.parse(
      composeMemoryAnswer(context, getTool(context, "search_financial_memory"))
    );
  }

  return ConversationalAnswerSchema.parse({
    response_text: composeUnsupportedText(context),
    answer_kind: "unsupported",
    confidence: 0.45,
    cited_facts: [],
    used_tools: [],
    follow_up_question: context.turn_state.should_ask_clarification_first
      ? "Que parte quieres revisar: movimientos, dinero libre o pendientes?"
      : null,
    safety_flags: ["read_only", "no_financial_write", "no_invented_data"],
  });
}

function composeBalanceAnswer(
  context: ConversationContextPack,
  tool: ConversationToolResult | null
): ConversationalAnswer {
  const data = (tool?.data ?? {}) as BalanceSnapshotData;
  const citedFacts = tool?.facts ?? [];
  const warnings = tool?.warnings ?? [];
  const requestedAmount = context.query.requested_amount;

  if (!data.has_accounts) {
    const opening = softOpening(context);
    return {
      response_text:
        `${opening}Todavia no tengo cuentas configuradas, asi que no puedo calcular dinero libre sin inventar. Tus movimientos pueden estar guardados, pero para saldos necesito una cuenta.`,
      answer_kind: "balance_snapshot",
      confidence: 0.86,
      cited_facts: citedFacts,
      used_tools: tool ? [tool.tool_name] : [],
      follow_up_question: "¿Quieres crear una cuenta en Mi Dinero?",
      safety_flags: ["read_only", "no_financial_write", "data_limit_explained"],
    };
  }

  const operationalFreeMoney = numberOrZero(data.operational_free_money);
  const freeInAccounts = numberOrZero(data.free_in_accounts);
  const separated = numberOrZero(data.separated_in_boxes);
  const commitments = numberOrZero(data.upcoming_uncovered_commitments);
  const total = numberOrZero(data.total_balance);
  const detail =
    `Saldo total: ${formatMoney(total)}. ` +
    `Separado en cajas: ${formatMoney(separated)}. ` +
    `Compromisos proximos sin caja: ${formatMoney(commitments)}.`;

  const decision =
    requestedAmount === null
      ? `Tienes ${formatMoney(operationalFreeMoney)} de dinero libre.`
      : operationalFreeMoney >= requestedAmount
        ? `Con los datos actuales, si puedes cubrir ${formatMoney(requestedAmount)} de tus ${formatMoney(operationalFreeMoney)} de dinero libre. Te quedarian aprox. ${formatMoney(operationalFreeMoney - requestedAmount)}.`
        : `Con los datos actuales, no te lo recomendaria: ${formatMoney(requestedAmount)} supera tu dinero libre de ${formatMoney(operationalFreeMoney)}.`;
  const opening = softOpening(context);

  return {
    response_text: `${opening}${decision}\n${detail}${warnings.length > 0 ? `\nOjo: ${warnings[0]}` : ""}`,
    answer_kind: "balance_snapshot",
    confidence: 0.9,
    cited_facts: [
      ...citedFacts,
      `free_in_accounts=${formatMoney(freeInAccounts)}`,
      `operational_free_money=${formatMoney(operationalFreeMoney)}`,
    ],
    used_tools: tool ? [tool.tool_name] : [],
    follow_up_question: null,
    safety_flags: ["read_only", "no_financial_write", "confirmed_data_only"],
  };
}

function composeMovementSearchAnswer(
  context: ConversationContextPack,
  tool: ConversationToolResult | null
): ConversationalAnswer {
  const data = (tool?.data ?? {}) as MovementSearchData;
  const movements = data.movements ?? [];
  const label = data.date_label ?? context.query.date_range?.label ?? "ese periodo";
  const dimensions = inferMovementFollowUpDimensions(context.query.normalized_text);

  if (movements.length === 0) {
    const opening = softOpening(context);
    return {
      response_text:
        `${opening}No encontre movimientos confirmados para ${label}. Si algo quedo dudoso, puede estar en Pendientes y no cuenta como saldo hasta confirmarlo.`,
      answer_kind: "movement_summary",
      confidence: 0.84,
      cited_facts: tool?.facts ?? [],
      used_tools: tool ? [tool.tool_name] : [],
      follow_up_question: "¿Quieres que revise tus pendientes?",
      safety_flags: ["read_only", "no_financial_write", "confirmed_data_only"],
    };
  }

  const total = movements.reduce(
    (sum, movement) =>
      movement.type === "ingreso"
        ? sum + numberOrZero(movement.amount)
        : sum - numberOrZero(movement.amount),
    0
  );
  const movementLimit = dimensions.kind === "detail" ? 3 : 5;
  const rows = movements
    .slice(0, movementLimit)
    .map((movement, index) =>
      formatMovementAnswerRow({
        movement,
        index,
        timezone: context.timezone,
        dimensions,
      })
    )
    .join("\n");
  const referenceIntro =
    data.reference_source === "active_conversation_state" ||
    data.reference_source === "focus_set"
      ? context.turn_state.continuity === "follow_up"
        ? "Si, tomando la respuesta anterior"
        : "Tomando la respuesta anterior"
      : context.turn_state.continuity === "follow_up"
        ? "Si, con ese contexto"
        : "Con los datos confirmados";
  const totalLine =
    dimensions.includeTotal || dimensions.kind === "summary"
      ? `\nNeto del periodo: ${formatMoney(total)}.`
      : "";
  const limitLine =
    movements.length > movementLimit
      ? `\nMostre ${movementLimit} de ${movements.length} para no hacerlo pesado.`
      : "";

  return {
    response_text: `${referenceIntro}, encontre ${movements.length} movimientos confirmados para ${label}:\n${rows}${totalLine}${limitLine}`,
    answer_kind: "movement_summary",
    confidence: 0.88,
    cited_facts: tool?.facts ?? [],
    used_tools: tool ? [tool.tool_name] : [],
    follow_up_question: null,
    safety_flags: ["read_only", "no_financial_write", "confirmed_data_only"],
  };
}

function composePendingAnswer(
  context: ConversationContextPack,
  tool: ConversationToolResult | null
): ConversationalAnswer {
  const data = (tool?.data ?? {}) as PendingSummaryData;
  const activeCount = data.active_count ?? 0;
  const opening = softOpening(context);

  return {
    response_text:
      activeCount === 0
        ? `${opening}No tienes pendientes por revisar. Nada pendiente esta tocando tu saldo.`
        : `${opening}Tienes ${activeCount} pendientes por revisar. No tocan tu saldo hasta que confirmes, edites o descartes.`,
    answer_kind: "pending_summary",
    confidence: 0.9,
    cited_facts: tool?.facts ?? [],
    used_tools: tool ? [tool.tool_name] : [],
    follow_up_question:
      activeCount > 0 ? 'Puedes escribir "ver pendientes" para resolverlos.' : null,
    safety_flags: ["read_only", "no_financial_write", "pending_not_confirmed"],
  };
}

function composeDebtAnswer(
  context: ConversationContextPack,
  summaryTool: ConversationToolResult | null,
  detailTool: ConversationToolResult | null
): ConversationalAnswer {
  const data = (summaryTool?.data ?? {}) as DebtSummaryData;
  const detailData = (detailTool?.data ?? {}) as DebtSummaryData;
  const debts = data.debts ?? [];
  const installments = data.installments ?? [];
  const details = detailData.details ?? data.details ?? [];
  const totals = data.totals ?? {};
  const label = data.date_label ?? context.query.date_range?.label ?? "proximos dias";
  const opening = softOpening(context);

  const usedTools = [summaryTool, detailTool]
    .filter((tool): tool is ConversationToolResult => tool !== null)
    .map((tool) => tool.tool_name);
  const citedFacts = [
    ...(summaryTool?.facts ?? []),
    ...(detailTool?.facts ?? []),
  ];

  if (debts.length === 0 && installments.length === 0 && details.length === 0) {
    return {
      response_text:
        `${opening}No veo deudas activas ni cuotas proximas para ${label}. Si algo esta pendiente de confirmar, todavia no cuenta como deuda hasta pasar por el flujo seguro.`,
      answer_kind: "debt_summary",
      confidence: 0.84,
      cited_facts: citedFacts,
      used_tools: usedTools,
      follow_up_question: null,
      safety_flags: ["read_only", "no_financial_write", "confirmed_data_only"],
    };
  }

  const lines: string[] = [];
  const iOweTotal = numberOrZero(totals.i_owe_total);
  const theyOweTotal = numberOrZero(totals.they_owe_me_total);

  if (iOweTotal > 0) {
    lines.push(`Por pagar: ${formatMoney(iOweTotal)}.`);
  }

  if (theyOweTotal > 0) {
    lines.push(`Por cobrar: ${formatMoney(theyOweTotal)}.`);
  }

  const debtRows = debts.slice(0, 4).map((debt, index) =>
    `${index + 1}. ${formatDebtName(debt)}: ${formatMoney(numberOrZero(debt.amount), debt.currency ?? "PEN")}${formatDebtMeta(debt, context.timezone)}`
  );
  const installmentRows = installments.slice(0, 3).map((installment, index) =>
    `Cuota ${index + 1}: ${humanize(installment.title) ?? humanize(installment.name) ?? "Cuota"} por ${formatMoney(numberOrZero(installment.amount), installment.currency ?? "PEN")}${formatDueDate(installment.due_at, context.timezone)}`
  );

  if (debtRows.length > 0) {
    lines.push(`Deudas activas:\n${debtRows.join("\n")}`);
  }

  if (installmentRows.length > 0) {
    lines.push(`Cuotas proximas:\n${installmentRows.join("\n")}`);
  }

  for (const detail of details.slice(0, 3)) {
    const debtName =
      detail.person_name ?? humanize(detail.name) ?? "esta deuda";
    const currency = detail.currency ?? "PEN";
    const installmentDetails = detail.installments ?? [];
    const openInstallments = installmentDetails.filter(
      (installment) => numberOrZero(installment.remaining_amount) > 0
    );
    const schedule = detail.schedule ?? {};
    const detailLines = [
      `${debtName}: saldo actual ${formatMoney(numberOrZero(detail.current_balance), currency)}.`,
      `Calendario: ${openInstallments.length} de ${installmentDetails.length} cuotas con saldo pendiente; restante programado ${formatMoney(numberOrZero(schedule.remaining_total), currency)}.`,
    ];

    if (installmentDetails.length > 0) {
      detailLines.push(
        ...installmentDetails.slice(0, 8).map((installment) =>
          `Cuota ${installment.number ?? "-"}: ${humanize(installment.status) ?? "sin estado"}, esperado ${formatMoney(numberOrZero(installment.expected_amount), currency)}, pagado ${formatMoney(numberOrZero(installment.paid_amount), currency)}, pendiente ${formatMoney(numberOrZero(installment.remaining_amount), currency)}${formatDueDate(installment.due_date, context.timezone)}`
        )
      );
    } else {
      detailLines.push(
        "No hay filas individuales de cuotas disponibles; no voy a deducirlas multiplicando campos agregados."
      );
    }

    if (Math.abs(numberOrZero(schedule.balance_gap)) > 0.01) {
      detailLines.push(
        "El saldo actual y el calendario no coinciden. Los muestro por separado para no asumir que significan lo mismo."
      );
    }

    lines.push(`Detalle de ${debtName}:\n${detailLines.join("\n")}`);
  }

  const warnings = [...(summaryTool?.warnings ?? []), ...(detailTool?.warnings ?? [])];
  if (warnings.length > 0) {
    lines.push(`Dato por revisar: ${warnings[0]}`);
  }

  return {
    response_text: `${opening}${lines.join("\n")}`,
    answer_kind: "debt_summary",
    confidence: 0.88,
    cited_facts: citedFacts,
    used_tools: usedTools,
    follow_up_question: null,
    safety_flags: ["read_only", "no_financial_write", "confirmed_data_only"],
  };
}

function composeRecurringAnswer(
  context: ConversationContextPack,
  tool: ConversationToolResult | null
): ConversationalAnswer {
  const data = (tool?.data ?? {}) as RecurringSummaryData;
  const commitments = data.commitments ?? [];
  const rules = data.rules ?? [];
  const label = data.date_label ?? context.query.date_range?.label ?? "proximos dias";
  const total = numberOrZero(data.total_amount);
  const opening = softOpening(context);

  if (commitments.length === 0 && rules.length === 0) {
    return {
      response_text:
        `${opening}No veo pagos que vienen para ${label}. Si Manzana detecta uno nuevo, lo separa como pendiente o sugerencia antes de tocar saldos.`,
      answer_kind: "recurring_summary",
      confidence: 0.84,
      cited_facts: tool?.facts ?? [],
      used_tools: tool ? [tool.tool_name] : [],
      follow_up_question: null,
      safety_flags: ["read_only", "no_financial_write", "confirmed_data_only"],
    };
  }

  const commitmentRows = commitments.slice(0, 5).map((commitment, index) => {
    const name = humanize(commitment.title) ?? humanize(commitment.name) ?? "Pago";
    return `${index + 1}. ${name}: ${formatMoney(numberOrZero(commitment.amount), commitment.currency ?? "PEN")}${formatDueDate(commitment.due_at, context.timezone)}`;
  });
  const ruleRows = rules.slice(0, 3).map((rule) => {
    const amount =
      typeof rule.expected_amount === "number"
        ? ` de ${formatMoney(rule.expected_amount, rule.currency ?? "PEN")}`
        : "";
    return `${humanize(rule.name) ?? "Pago recurrente"}${amount}${rule.next_expected_date ? formatDueDate(rule.next_expected_date, context.timezone) : ""}`;
  });
  const parts: string[] = [];

  if (commitmentRows.length > 0) {
    parts.push(`Veo ${commitments.length} compromisos para ${label}:\n${commitmentRows.join("\n")}`);
  }

  if (total > 0) {
    parts.push(`Total aproximado: ${formatMoney(total)}.`);
  }

  if (ruleRows.length > 0 && commitmentRows.length === 0) {
    parts.push(`Reglas activas:\n${ruleRows.join("\n")}`);
  }

  if (data.suggested_count && data.suggested_count > 0) {
    parts.push(`Tambien hay ${data.suggested_count} sugerencias por revisar antes de activarlas.`);
  }

  return {
    response_text: `${opening}${parts.join("\n")}`,
    answer_kind: "recurring_summary",
    confidence: 0.88,
    cited_facts: tool?.facts ?? [],
    used_tools: tool ? [tool.tool_name] : [],
    follow_up_question: null,
    safety_flags: ["read_only", "no_financial_write", "confirmed_data_only"],
  };
}

function composeMemoryAnswer(
  context: ConversationContextPack,
  tool: ConversationToolResult | null
): ConversationalAnswer {
  const data = (tool?.data ?? {}) as FinancialMemoryData;
  const preferences = data.preferences ?? {};
  const requestedFacets = data.requested_facets ?? [];
  const frequentPeople = data.frequent_people ?? [];
  const matchedPeople = data.matched_people ?? [];
  const recentCorrections = data.recent_corrections ?? [];
  const matchedCorrections = data.matched_corrections ?? [];
  const activeConversation = data.active_conversation ?? null;
  const limitedLevels = data.memory_levels_limited ?? [];
  const lines: string[] = [];
  const opening = softOpening(context);

  const wantsPreferences =
    requestedFacets.length === 0 || requestedFacets.includes("preferences");
  const wantsPeople =
    requestedFacets.length === 0 || requestedFacets.includes("people");
  const wantsCorrections =
    requestedFacets.length === 0 || requestedFacets.includes("corrections");
  const wantsActiveConversation =
    requestedFacets.length === 0 ||
    requestedFacets.includes("active_conversation");
  const wantsPatterns =
    requestedFacets.includes("patterns") ||
    requestedFacets.includes("narrative");

  if (wantsPreferences) {
    const preferenceLines = formatPreferenceMemory(preferences);
    lines.push(...preferenceLines);
  }

  if (wantsPeople) {
    const people = matchedPeople.length > 0 ? matchedPeople : frequentPeople;
    if (people.length > 0) {
      const intro =
        matchedPeople.length > 0
          ? "Sobre las personas que mencionaste:"
          : "Personas que aparecen seguido:";
      lines.push(
        `${intro} ${people.slice(0, 4).map(formatPersonMemory).join("; ")}.`
      );
    }
  }

  if (wantsCorrections) {
    const corrections =
      matchedCorrections.length > 0 ? matchedCorrections : recentCorrections;
    if (corrections.length > 0) {
      lines.push(
        `Ultimas correcciones que uso como pista: ${corrections
          .slice(0, 3)
          .map((correction) => correction.summary)
          .join("; ")}.`
      );
    }
  }

  if (wantsPatterns) {
    lines.push(
      "Para patrones o historia personal todavia soy prudente: uso movimientos confirmados, preferencias, personas y correcciones; no invento una lectura profunda si no hay evidencia suficiente."
    );
  }

  if (wantsActiveConversation && activeConversation?.continuity_hint) {
    lines.push(`Del hilo actual: ${activeConversation.continuity_hint}`);
  } else if (wantsActiveConversation && activeConversation?.last_query_text) {
    lines.push(`Del hilo actual, venimos de: "${activeConversation.last_query_text}".`);
  }

  if (limitedLevels.length > 0 && !wantsPatterns) {
    lines.push(
      "Hay memoria avanzada limitada en V1; por ahora respondo con memoria estructurada y fuentes seguras."
    );
  }

  if (lines.length === 0) {
    lines.push(
      "Todavia tengo poca memoria util sobre tus preferencias. A medida que corrijas, nombres personas o uses categorias, la uso como pista para responder mejor sin inventar."
    );
  }

  return {
    response_text: `${opening}${lines.join("\n")}`,
    answer_kind: "memory_summary",
    confidence: 0.82,
    cited_facts: tool?.facts ?? [],
    used_tools: tool ? [tool.tool_name] : [],
    follow_up_question: null,
    safety_flags: ["read_only", "no_financial_write", "no_raw_history"],
  };
}

function formatPreferenceMemory(
  preferences: NonNullable<FinancialMemoryData["preferences"]>
): string[] {
  const lines: string[] = [];

  if (preferences.discreet_mode) {
    lines.push(
      "Tienes modo discreto activo, asi que evito mostrar detalles sensibles de mas."
    );
  }

  if (preferences.tone_style) {
    lines.push(
      `Tu estilo de respuesta preferido esta marcado como ${preferences.tone_style}.`
    );
  }

  if (preferences.quiet_hours?.start || preferences.quiet_hours?.end) {
    const start = preferences.quiet_hours.start ?? "sin inicio";
    const end = preferences.quiet_hours.end ?? "sin fin";
    lines.push(`Tus horas tranquilas estan configuradas de ${start} a ${end}.`);
  }

  if (preferences.default_account_id) {
    lines.push("Tienes una cuenta por defecto guardada para sugerencias futuras.");
  }

  if (preferences.whatsapp_opt_in || preferences.email_opt_in) {
    const channels = [
      preferences.whatsapp_opt_in ? "WhatsApp" : null,
      preferences.email_opt_in ? "email" : null,
    ].filter(Boolean);
    lines.push(`Canales con permiso: ${channels.join(" y ")}.`);
  }

  return lines;
}

function formatPersonMemory(person: ConversationMemoryPerson): string {
  const parts = [person.display_name];

  if (person.relationship_label) {
    parts.push(person.relationship_label);
  } else if (person.kind) {
    parts.push(person.kind);
  }

  if (person.aliases.length > 0) {
    parts.push(`alias ${person.aliases.slice(0, 2).join(", ")}`);
  }

  return parts.join(" - ");
}

function getTool(
  context: ConversationContextPack,
  toolName: string
): ConversationToolResult | null {
  return context.tool_results.find((tool) => tool.tool_name === toolName) ?? null;
}

function composeUnsupportedText(context: ConversationContextPack): string {
  if (context.turn_state.act === "smalltalk") {
    return "Estoy por aqui para ayudarte con gastos, pendientes, correcciones y dudas de dinero.";
  }

  if (context.turn_state.should_ask_clarification_first) {
    return "Puedo ayudarte, pero necesito un poco mas de contexto. Puedo revisar movimientos, dinero libre, deudas, pagos que vienen o pendientes sin tocar tus saldos.";
  }

  return "Te puedo ayudar con consultas sobre dinero libre, movimientos confirmados, deudas, pagos que vienen y pendientes. Que quieres revisar?";
}

function softOpening(context: ConversationContextPack): string {
  if (
    context.turn_state.emotional_state === "anxious" ||
    context.turn_state.emotional_state === "frustrated"
  ) {
    return "Lo reviso con calma. ";
  }

  if (context.turn_state.emotional_state === "uncertain") {
    return "Lo reviso sin inventar. ";
  }

  if (context.turn_state.continuity === "follow_up") {
    return "Si. ";
  }

  return "";
}

function formatMoney(amount: number, currency: "PEN" | "USD" = "PEN"): string {
  const sign = amount < 0 ? "-" : "";
  const absolute = Math.abs(amount);
  const symbol = currency === "USD" ? "$" : "S/";
  return `${sign}${symbol}${absolute.toFixed(2)}`;
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function humanize(value: string | null | undefined): string | null {
  const text = value?.replace(/_/g, " ").trim();
  if (!text) return null;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDebtName(
  debt: NonNullable<DebtSummaryData["debts"]>[number]
): string {
  const person = humanize(debt.person_name);
  const name = humanize(debt.name);
  const direction =
    debt.direction === "they_owe_me"
      ? person
        ? `${person} te debe`
        : "Te deben"
      : person
        ? `Debes a ${person}`
        : "Debes";

  return name ? `${direction} (${name})` : direction;
}

function formatDebtMeta(
  debt: NonNullable<DebtSummaryData["debts"]>[number],
  timezone: string
): string {
  const dueDate = debt.next_payment_date ?? debt.due_date;
  const dueText = formatDueDate(dueDate ?? undefined, timezone);
  const status = humanize(debt.status);
  const statusText = status ? `, estado ${status}` : "";
  return `${dueText}${statusText}`;
}

function formatDueDate(
  value: string | undefined,
  timezone: string
): string {
  if (!value) return "";
  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00.000Z` : value
  );
  if (Number.isNaN(date.getTime())) return "";

  const formatted = new Intl.DateTimeFormat("es-PE", {
    timeZone: timezone,
    day: "2-digit",
    month: "short",
  }).format(date);

  return `, vence ${formatted}`;
}

type MovementFollowUpDimensions = {
  kind: "summary" | "detail";
  includeTime: boolean;
  includeSource: boolean;
  includeAccount: boolean;
  includeCategory: boolean;
  includeTotal: boolean;
};

function inferMovementFollowUpDimensions(
  text: string
): MovementFollowUpDimensions {
  const includeTime =
    /\b(hora|horas|a que hora|a que horas|cuando|fecha)\b/.test(text);
  const includeSource = /\b(fuente|de donde|origen|salio|registr[oa]|como lo sabes|evidencia)\b/.test(
    text
  );
  const includeAccount = /\b(cuenta|tarjeta|efectivo|yape|banco)\b/.test(text);
  const includeCategory = /\b(categoria|categorias|rubro|rubros)\b/.test(text);
  const includeTotal = /\b(total|suman|suma|neto|cuanto fue|cuanto salio)\b/.test(
    text
  );
  const kind =
    /\b(detalle|detalles|explica|explicame|mas info|informacion)\b/.test(text) ||
    includeSource ||
    includeAccount ||
    includeCategory
      ? "detail"
      : "summary";

  return {
    kind,
    includeTime,
    includeSource,
    includeAccount,
    includeCategory,
    includeTotal,
  };
}

function formatMovementAnswerRow(input: {
  movement: NonNullable<MovementSearchData["movements"]>[number];
  index: number;
  timezone: string;
  dimensions: MovementFollowUpDimensions;
}): string {
  const { movement, index, timezone, dimensions } = input;
  const description =
    humanize(movement.merchant) ??
    humanize(movement.description) ??
    humanize(movement.category_label) ??
    humanize(movement.category_id) ??
    "Movimiento";
  const amount = formatMoney(
    numberOrZero(movement.amount),
    movement.currency ?? "PEN"
  );
  const details: string[] = [];

  if (dimensions.includeTime) {
    const time = formatMovementTime(movement.occurred_at, timezone);
    details.push(time ? `hora ${time}` : "hora no registrada");
  }

  if (dimensions.includeCategory) {
    details.push(
      `categoria ${humanize(movement.category_label) ?? humanize(movement.category_id) ?? "sin categoria"}`
    );
  }

  if (dimensions.includeAccount) {
    details.push(`cuenta ${formatMovementAccount(movement)}`);
  }

  if (dimensions.includeSource) {
    details.push(`origen ${formatMovementSource(movement)}`);
  }

  if (dimensions.kind === "detail" && details.length === 0) {
    const time = formatMovementTime(movement.occurred_at, timezone);
    details.push(time ? `hora ${time}` : "hora no registrada");
    details.push(
      `categoria ${humanize(movement.category_label) ?? humanize(movement.category_id) ?? "sin categoria"}`
    );
    details.push(`cuenta ${formatMovementAccount(movement)}`);
    details.push(`origen ${formatMovementSource(movement)}`);
  }

  const detailText = details.length > 0 ? ` (${details.join("; ")})` : "";
  return `${index + 1}. ${description}: ${amount}${detailText}`;
}

function formatMovementAccount(
  movement: NonNullable<MovementSearchData["movements"]>[number]
): string {
  const origin = movement.account_origin_name ?? movement.account_origin_id;
  const destination =
    movement.account_destination_name ?? movement.account_destination_id;

  if (origin && destination) return `${origin} -> ${destination}`;
  if (origin) return origin;
  if (destination) return destination;
  return "sin cuenta vinculada";
}

function formatMovementSource(
  movement: NonNullable<MovementSearchData["movements"]>[number]
): string {
  if (movement.source === "whatsapp") return "WhatsApp";
  if (movement.source === "dashboard_manual") return "Dashboard";
  if (movement.source === "email_confirmed") return "Email confirmado";
  if (movement.source === "recurring_confirmed") return "Pago recurrente confirmado";
  if (movement.source === "backfill_confirmed") return "Reconstruccion";
  if (movement.source === "system_adjustment") return "Ajuste de sistema";
  return movement.source ?? "registro confirmado";
}

function formatMovementTime(
  occurredAt: string | undefined,
  timezone: string
): string | null {
  if (!occurredAt) return null;
  const date = new Date(occurredAt);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("es-PE", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
