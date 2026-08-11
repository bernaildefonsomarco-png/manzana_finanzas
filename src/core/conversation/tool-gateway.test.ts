import { describe, expect, it, vi } from "vitest";
import type { ConversationQuery, ConversationTurnState } from "@/agents/conversation-agent";
import type { ConversationMemoryState } from "@/data/repositories/conversation-memory.repository";
import type { SemanticQuery } from "@/core/semantics/query";
import {
  filterMovementsForConversationQuery,
  shouldUseActiveReferencedMovements,
  ToolGateway,
} from "./tool-gateway";

const repos = vi.hoisted(() => ({
  listBudgetsWithProgress: vi.fn(),
  listGoals: vi.fn(),
  getReportPeriod: vi.fn(),
  getProjectionSnapshot: vi.fn(),
  getActiveAccounts: vi.fn(),
  getActiveBoxes: vi.fn(),
  getClassificationCatalog: vi.fn(),
}));

vi.mock("@/data/repositories/budgets.repository", () => ({
  listBudgetsWithProgress: repos.listBudgetsWithProgress,
  listGoals: repos.listGoals,
}));
vi.mock("@/data/repositories/reports.repository", () => ({
  getReportPeriod: repos.getReportPeriod,
}));
vi.mock("@/data/repositories/projections.repository", () => ({
  getProjectionSnapshot: repos.getProjectionSnapshot,
}));
vi.mock("@/data/repositories/accounts.repository", () => ({
  getActiveAccounts: repos.getActiveAccounts,
  getActiveBoxes: repos.getActiveBoxes,
}));
vi.mock("@/data/repositories/classification.repository", () => ({
  getClassificationCatalog: repos.getClassificationCatalog,
}));

const followUpQuery: ConversationQuery = {
  kind: "movement_search",
  normalized_text: "y a que hora fue ese?",
  requested_amount: null,
  date_range: null,
  confidence: 0.96,
};

describe("shouldUseActiveReferencedMovements", () => {
  it("continua una referencia creada por una captura aunque no haya consulta previa", () => {
    expect(
      shouldUseActiveReferencedMovements(
        followUpQuery,
        activeCaptureMemory(),
        true
      )
    ).toBe(true);
  });

  it("respeta un cambio explicito de periodo y no arrastra el movimiento anterior", () => {
    expect(
      shouldUseActiveReferencedMovements(
        {
          ...followUpQuery,
          normalized_text: "y que movimientos hice hoy?",
        },
        activeCaptureMemory(),
        true
      )
    ).toBe(false);
  });

  it("no usa referencias si el ConversationKernel no autorizo continuidad", () => {
    expect(
      shouldUseActiveReferencedMovements(
        followUpQuery,
        activeCaptureMemory(),
        false
      )
    ).toBe(false);
  });

  it("usa focus_set aunque la lista legada de referencias este vacia", () => {
    const state = activeCaptureMemory();
    state.referenced_movements = [];
    state.working_set = {
      ...state.working_set!,
      focus_set: {
        version: "v1",
        revision: 3,
        focus_id: "focus-food",
        subject: "movements",
        ordered_ids: ["food-1", "food-2", "food-3", "food-4", "food-5"],
        visible_order: "tool_result_order",
        query: followUpQuery,
        tool_provenance: [],
        slot_provenance: [],
        state_hash: "fnv1a32:12345678",
        created_at: "2026-07-24T10:00:00.000-05:00",
        updated_at: "2026-07-24T10:00:00.000-05:00",
        expires_at: "2099-07-24T12:00:00.000-05:00",
      },
    };

    expect(
      shouldUseActiveReferencedMovements(followUpQuery, state, true)
    ).toBe(true);
  });
});

describe("filterMovementsForConversationQuery", () => {
  it("no convierte una expresion temporal en un filtro de contenido", () => {
    const movements = [movement({ description: "Desayuno" })];

    expect(
      filterMovementsForConversationQuery(movements, {
        kind: "movement_search",
        normalized_text: "y antes de ayer?",
        requested_amount: null,
        date_range: {
          start: "2026-07-16T05:00:00.000Z",
          end: "2026-07-17T04:59:59.999Z",
          label: "antes de ayer, 16 de julio de 2026",
        },
        movement_filters: emptyMovementFilters(),
        confidence: 0.98,
      }),
    ).toEqual(movements);
  });

  it("no trata el nombre del mes como comercio o categoria", () => {
    const movements = [
      movement({ id: "movement-14", description: "Prestamo a Luis" }),
      movement({ id: "movement-15", description: "Almuerzo" }),
    ];

    expect(
      filterMovementsForConversationQuery(movements, {
        kind: "movement_search",
        normalized_text: "y el 14 de julio?",
        requested_amount: null,
        date_range: {
          start: "2026-07-14T05:00:00.000Z",
          end: "2026-07-15T04:59:59.999Z",
          label: "14 de julio de 2026",
        },
        movement_filters: emptyMovementFilters(),
        confidence: 0.98,
      }),
    ).toEqual(movements);
  });

  it("aplica solo los filtros financieros declarados semanticamente", () => {
    const taxi = movement({ id: "taxi", description: "Taxi" });
    const desayuno = movement({ id: "desayuno", description: "Desayuno" });

    expect(
      filterMovementsForConversationQuery([taxi, desayuno], {
        kind: "movement_search",
        normalized_text: "que gaste en taxi antes de ayer?",
        requested_amount: null,
        date_range: {
          start: "2026-07-16T05:00:00.000Z",
          end: "2026-07-17T04:59:59.999Z",
          label: "antes de ayer, 16 de julio de 2026",
        },
        movement_filters: {
          ...emptyMovementFilters(),
          search_terms: ["taxi"],
        },
        confidence: 0.98,
      }),
    ).toEqual([taxi]);
  });

  it("combina subcategoria, persona y tags sin depender del texto literal del mensaje", () => {
    const desayuno = movement({
      id: "desayuno",
      description: "Compra de la manana",
      subcategory_label: "Desayuno",
      related_person_name: "Luis",
      tag_labels: ["trabajo"],
    });
    const almuerzo = movement({
      id: "almuerzo",
      description: "Menu ejecutivo",
      subcategory_label: "Almuerzo",
      related_person_name: "Ana",
      tag_labels: ["personal"],
    });

    expect(
      filterMovementsForConversationQuery([desayuno, almuerzo], {
        kind: "movement_search",
        normalized_text: "lo de Luis del trabajo",
        requested_amount: null,
        date_range: null,
        movement_filters: {
          ...emptyMovementFilters(),
          subcategory_terms: ["desayuno"],
          person_terms: ["luis"],
          tag_terms: ["trabajo"],
        },
        confidence: 0.98,
      }),
    ).toEqual([desayuno]);
  });

  it("conserva el parser legado solo para el fallback sin plan semantico", () => {
    const taxi = movement({ id: "taxi", description: "Taxi" });
    const desayuno = movement({ id: "desayuno", description: "Desayuno" });

    expect(
      filterMovementsForConversationQuery([taxi, desayuno], {
        kind: "movement_search",
        normalized_text: "gastos de taxi ayer",
        requested_amount: null,
        date_range: null,
        confidence: 0.6,
      }),
    ).toEqual([taxi]);
  });
});

function emptyMovementFilters(): NonNullable<
  ConversationQuery["movement_filters"]
> {
  return {
    search_terms: [],
    movement_types: [],
    category_ids: [],
    sources: [],
    account_terms: [],
    uncategorized_only: false,
  };
}

function movement(overrides: Record<string, unknown> = {}) {
  return {
    id: "movement-1",
    type: "gasto" as const,
    amount: 20,
    currency: "PEN" as const,
    description: "Desayuno",
    merchant: null,
    category_id: "alimentacion" as const,
    category_label: "Alimentacion",
    occurred_at: "2026-07-16T19:14:00.000-05:00",
    created_at: "2026-07-16T19:14:00.000-05:00",
    status: "confirmed" as const,
    source: "whatsapp" as const,
    source_ref: "event-1",
    confidence: 0.98,
    requires_review: false,
    account_origin_id: null,
    account_origin_name: "Efectivo",
    account_destination_id: null,
    account_destination_name: null,
    ...overrides,
  };
}

function activeCaptureMemory(): ConversationMemoryState {
  return {
    id: "memory-1",
    user_id: "user-1",
    channel: "whatsapp",
    scope: "default",
    thread_key: "",
    last_intent: "record_movement",
    last_query_kind: null,
    last_query_text: "gaste 20 en desayuno y dime como voy esta semana",
    last_query_date_range: null,
    last_tool_name: null,
    last_result_summary: "Desayuno por S/20.00 registrado.",
    referenced_movements: [
      {
        id: "movement-1",
        type: "gasto",
        amount: 20,
        currency: "PEN",
        description: "Desayuno",
        merchant: null,
        category_id: "alimentacion",
        category_label: "Alimentacion",
        occurred_at: "2026-07-17T17:07:29.657-05:00",
        source: "whatsapp",
        source_ref: "event-1",
        account_origin_id: null,
        account_origin_name: null,
        account_destination_id: null,
        account_destination_name: null,
        confidence: 0.98,
        requires_review: false,
      },
    ],
    referenced_entities: [],
    continuity_hint: null,
    source_ref: "event-1",
    expires_at: "2026-07-18T17:07:29.657-05:00",
    updated_at: "2026-07-17T17:07:29.657-05:00",
    metadata: {},
    working_set: {
      version: "v1",
      topic: "movement",
      goal: "capture",
      last_user_message_summary:
        "Gaste 20 en desayuno y dime como voy esta semana",
      last_assistant_result_summary: "Desayuno por S/20.00 registrado.",
      last_action: {
        kind: "movement_created",
        status: "completed",
        source_ref: "event-1",
        movement_ids: ["movement-1"],
        pending_item_ids: [],
        command_ids: [],
      },
      unresolved_slots: [],
      movement_referents: ["movement-1"],
      entity_referents: [],
      active_read_operation: null,
      conversation_style: null,
      updated_at: "2026-07-17T17:07:29.657-05:00",
    },
  };
}

const userId = "00000000-0000-4000-8000-000000000001";
const turnState: ConversationTurnState = {
  act: "financial_question",
  continuity: "new_topic",
  emotional_state: "curious",
  experience_mode: "read_only_answer",
  should_use_active_memory: false,
  should_route_to_conversation_agent: true,
  should_ask_clarification_first: false,
  response_guidance: [],
  personalization_cues: [],
  risk_notes: [],
};

/** Mock encadenable minimo del query builder de supabase-js. */
function fakeSupabaseClient(rows: unknown[]) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const builder: Record<string, unknown> = {};
  const chainMethods = ["select", "eq", "neq", "gt", "gte", "lt", "lte", "in", "is", "ilike", "order"];
  for (const method of chainMethods) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    });
  }
  builder.limit = vi.fn((n: number) => {
    calls.push({ method: "limit", args: [n] });
    return builder;
  });
  builder.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
    resolve({ data: rows, error: null });

  return { client: { from: vi.fn(() => builder) }, calls };
}

describe("ToolGateway.executeAuthorizedTool: consultar_datos_abiertos (20b S5, W-16 fase 5)", () => {
  it("compila y ejecuta una consulta abierta real, con referencias", async () => {
    const { client } = fakeSupabaseClient([{ id: "m1", amount: 20 }, { id: "m2", amount: 8 }]);
    const gateway = new ToolGateway(client as never);
    const semanticQuery: SemanticQuery = {
      de: "movimientos",
      donde: { kind: "comparacion", dimension: "tipo_movimiento", comparador: "=", valor: "gasto" },
      agrupar_por: [],
      medir: ["suma"],
      ordenar: null,
      limitar: null,
      comparar_con: null,
      a_partir_de: null,
    };

    const result = await gateway.executeAuthorizedTool({
      toolName: "consultar_datos_abiertos",
      userId,
      query: null,
      semanticQuery,
      activeMemoryState: null,
      turnState,
    });

    expect(result.status).toBe("called");
    expect(result.data.referencias).toEqual(["movimientos:m1", "movimientos:m2"]);
    expect(result.facts).toContain("filas=2");
  });

  it("falla limpio (sin lanzar) cuando la consulta no compila", async () => {
    const { client } = fakeSupabaseClient([]);
    const gateway = new ToolGateway(client as never);
    const semanticQuery: SemanticQuery = {
      de: "movimientos",
      donde: { kind: "comparacion", dimension: "signo_zodiacal", comparador: "=", valor: "leo" },
      agrupar_por: [],
      medir: ["suma"],
      ordenar: null,
      limitar: null,
      comparar_con: null,
      a_partir_de: null,
    };

    const result = await gateway.executeAuthorizedTool({
      toolName: "consultar_datos_abiertos",
      userId,
      query: null,
      semanticQuery,
      activeMemoryState: null,
      turnState,
    });

    expect(result.status).toBe("failed");
    expect(result.warnings.some((w) => w.includes("dimension_desconocida"))).toBe(true);
  });

  it("falla limpio cuando se llama sin semantic_query", async () => {
    const { client } = fakeSupabaseClient([]);
    const gateway = new ToolGateway(client as never);

    const result = await gateway.executeAuthorizedTool({
      toolName: "consultar_datos_abiertos",
      userId,
      query: null,
      semanticQuery: null,
      activeMemoryState: null,
      turnState,
    });

    expect(result.status).toBe("failed");
  });

  it("una tool cerrada sin query devuelve failed sin tocar el cliente de datos", async () => {
    const { client } = fakeSupabaseClient([]);
    const gateway = new ToolGateway(client as never);

    const result = await gateway.executeAuthorizedTool({
      toolName: "get_balance_snapshot",
      userId,
      query: null,
      activeMemoryState: null,
      turnState,
    });

    expect(result.status).toBe("failed");
    // La comprobacion ocurre antes de llegar al switch: si esto se rompe,
    // "get_balance_snapshot" seguiria adelante y llamaria al cliente real.
    expect(client.from).not.toHaveBeenCalled();
  });
});

// --- Las cuatro entidades semanticas nuevas (`20b` §5.1) --------------------
//
// Una consulta real, una vacia y el aislamiento por usuario, por entidad. Lo
// que se prueba no es el motor —ya tiene sus tests— sino que la **spec**
// declarada apunte a la tabla y a las columnas correctas: un mapeo mal escrito
// aqui no rompe el build, devuelve los datos de otra cosa.

function semanticQueryFor(
  de: string,
  donde: SemanticQuery["donde"],
  medir: string[],
): SemanticQuery {
  return {
    de,
    donde,
    agrupar_por: [],
    medir,
    ordenar: null,
    limitar: null,
    comparar_con: null,
    a_partir_de: null,
  };
}

describe("consultar_datos_abiertos: deudas, presupuestos, cajas y recurrentes", () => {
  const casos = [
    {
      entidad: "deudas",
      tabla: "debts",
      dimension: "estado_deuda",
      valor: "activa",
      columna: "status",
      medida: "saldo_total_debido",
      fila: { id: "d1", status: "activa" },
    },
    {
      entidad: "presupuestos",
      tabla: "budgets",
      dimension: "periodo_presupuesto",
      valor: "mensual",
      columna: "period_kind",
      medida: "total_presupuestado",
      fila: { id: "p1", period_kind: "mensual" },
    },
    {
      entidad: "cajas",
      tabla: "boxes",
      dimension: "tipo_caja",
      valor: "objetivo",
      columna: "type",
      medida: "separado_total",
      fila: { id: "c1", type: "objetivo" },
    },
    {
      entidad: "recurrentes",
      tabla: "recurring_rules",
      dimension: "estado_recurrente",
      valor: "activo",
      columna: "status",
      medida: "total_comprometido",
      fila: { id: "r1", status: "activo" },
    },
  ] as const;

  for (const caso of casos) {
    it(`${caso.entidad}: una consulta real lee ${caso.tabla} por ${caso.columna} y devuelve referencias`, async () => {
      const { client, calls } = fakeSupabaseClient([caso.fila]);
      const gateway = new ToolGateway(client as never);

      const result = await gateway.executeAuthorizedTool({
        toolName: "consultar_datos_abiertos",
        userId,
        query: null,
        semanticQuery: semanticQueryFor(
          caso.entidad,
          {
            kind: "comparacion",
            dimension: caso.dimension,
            comparador: "=",
            valor: caso.valor,
          },
          [caso.medida],
        ),
        activeMemoryState: null,
        turnState,
      });

      expect(result.status).toBe("called");
      expect(client.from).toHaveBeenCalledWith(caso.tabla);
      expect(result.data.referencias).toEqual([
        `${caso.entidad}:${caso.fila.id}`,
      ]);
      expect(result.facts).toContain("filas=1");
      expect(result.facts).toContain(`entidad=${caso.entidad}`);
      // La dimension se tradujo a la columna real, no se paso tal cual.
      expect(calls).toContainEqual({
        method: "eq",
        args: [caso.columna, caso.valor],
      });
      // Una consulta con filas no lleva el aviso de vacio: si lo llevara, la
      // respuesta pediria disculpas por unos datos que si existen.
      expect(result.warnings).toEqual([]);
    });

    it(`${caso.entidad}: una consulta vacia avisa que no es un cero afirmable`, async () => {
      const { client } = fakeSupabaseClient([]);
      const gateway = new ToolGateway(client as never);

      const result = await gateway.executeAuthorizedTool({
        toolName: "consultar_datos_abiertos",
        userId,
        query: null,
        semanticQuery: semanticQueryFor(caso.entidad, null, [caso.medida]),
        activeMemoryState: null,
        turnState,
      });

      expect(result.status).toBe("called");
      expect(result.facts).toContain("filas=0");
      expect(result.data.referencias).toEqual([]);
      expect(
        result.warnings.some((aviso) => aviso.includes("no que el resultado sea cero")),
      ).toBe(true);
    });

    it(`${caso.entidad}: filtra siempre por el user_id del turno`, async () => {
      const { client, calls } = fakeSupabaseClient([caso.fila]);
      const gateway = new ToolGateway(client as never);

      await gateway.executeAuthorizedTool({
        toolName: "consultar_datos_abiertos",
        userId: otherUserId,
        query: null,
        semanticQuery: semanticQueryFor(
          caso.entidad,
          // `AC-SEM-01`: aunque la consulta intente nombrar otra persona, el
          // `user_id` no es expresable en este lenguaje y el filtro real sale
          // del turno.
          {
            kind: "comparacion",
            dimension: caso.dimension,
            comparador: "=",
            valor: caso.valor,
          },
          [caso.medida],
        ),
        activeMemoryState: null,
        turnState,
      });

      expect(calls).toContainEqual({
        method: "eq",
        args: ["user_id", otherUserId],
      });
      expect(
        calls.some(
          (call) => call.method === "eq" && call.args[0] === "user_id" && call.args[1] === userId,
        ),
      ).toBe(false);
    });
  }

  it("rechaza `fecha` en las entidades nuevas en vez de mapearla a una columna cualquiera", async () => {
    const { client } = fakeSupabaseClient([]);
    const gateway = new ToolGateway(client as never);

    const result = await gateway.executeAuthorizedTool({
      toolName: "consultar_datos_abiertos",
      userId,
      query: null,
      semanticQuery: semanticQueryFor(
        "deudas",
        {
          kind: "comparacion",
          dimension: "fecha",
          comparador: "entre",
          valor: { desde: "2026-01-01", hasta: "2026-01-31" },
        },
        ["conteo"],
      ),
      activeMemoryState: null,
      turnState,
    });

    expect(result.status).toBe("failed");
    expect(
      result.warnings.some((aviso) => aviso.includes("dimension_no_compilable")),
    ).toBe(true);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("una dimension de otra entidad no cuela: `tipo_caja` sobre deudas se rechaza", async () => {
    const { client } = fakeSupabaseClient([]);
    const gateway = new ToolGateway(client as never);

    const result = await gateway.executeAuthorizedTool({
      toolName: "consultar_datos_abiertos",
      userId,
      query: null,
      semanticQuery: semanticQueryFor(
        "deudas",
        {
          kind: "comparacion",
          dimension: "tipo_caja",
          comparador: "=",
          valor: "objetivo",
        },
        ["conteo"],
      ),
      activeMemoryState: null,
      turnState,
    });

    expect(result.status).toBe("failed");
    expect(client.from).not.toHaveBeenCalled();
  });
});

// --- Tools de dominio completo: presupuestos, reportes, proyeccion, metas ---
// Cada tool es una puerta delgada a un motor de `src/core/` que ya tiene sus
// propios tests. Lo que se prueba aqui es la puerta: que el usuario correcto
// llegue al repositorio, que la evidencia (`facts`) exista para el compilador
// y que el caso vacio no se confunda con un cero afirmable.

const otherUserId = "00000000-0000-4000-8000-0000000000ff";

function emptyClient() {
  return { from: vi.fn() } as never;
}

function budgetRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "budget-1",
    user_id: userId,
    category_id: "alimentacion",
    category_name: "Alimentacion",
    currency: "PEN",
    period_kind: "mensual",
    period_start: "2026-08-01",
    period_end: "2026-08-31",
    base_amount: 600,
    rollover_amount: 0,
    amount: 600,
    kind: "presupuesto",
    rollover: false,
    auto_renew: true,
    alerted_thresholds: [],
    source: "manual",
    status: "activo",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    deleted_at: null,
    metadata: {},
    spent: 450,
    remaining: 150,
    pct: 0.75,
    percentage: 75,
    percentage_exact: 75,
    band: "cerca",
    movement_ids: ["m1", "m2"],
    ...overrides,
  };
}

function reportResult(overrides: Record<string, unknown> = {}) {
  return {
    gastoTotal: 1200,
    ingresoTotal: 3000,
    gastoMovementCount: 18,
    ingresoMovementCount: 2,
    byCategory: [
      { category_id: "alimentacion", total: 800, movement_count: 12 },
      { category_id: null, total: 400, movement_count: 6 },
    ],
    exclusions: [{ reason: "transferencia", count: 3 }],
    countedMovementIds: ["m1", "m2"],
    ...overrides,
  };
}

function projectionSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    has_pen_accounts: true,
    breakdown: { currency: "PEN", lines: [] },
    projection: {
      currency: "PEN",
      period_start: "2026-08-01",
      period_end: "2026-08-31",
      as_of: "2026-08-09",
      free_money_cents: 120_000,
      uncovered_commitments_cents: 45_000,
      observed_days: 9,
      sample_start: "2026-08-01",
      sample_end: "2026-08-09",
      daily_spend_cents: [],
      daily_pace_cents: 3_500,
      q1_cents: 0,
      q3_cents: 0,
      iqr_cents: 0,
      days_remaining: 22,
      sufficient_data: true,
      insufficiency_reason: null,
      projection_cents: 43_000,
      range: null,
      assumptions: [
        { kind: "daily_pace", amount_cents: 3_500, basis: "median_14_lima_calendar_days", refs: ["m1"] },
        { kind: "days_remaining", value: 22, refs: [] },
      ],
      ...(overrides.projection as Record<string, unknown> | undefined),
    },
    situation: {
      currency: "PEN",
      period_start: "2026-08-01",
      period_end: "2026-08-31",
      as_of: "2026-08-09",
      coverage: { availability: "available", uncovered_cents: 45_000, covered: false, refs: [] },
      spending_income: {
        availability: "available",
        spending_cents: 90_000,
        income_cents: 300_000,
        ratio_basis_points: 3_000,
        refs: [],
      },
      reserve: { availability: "available", total_cents: 250_000, refs: [] },
      debts: { availability: "available", overdue_count: 1, due_this_month_count: 2, refs: [] },
      summary_facts: ["cobertura=descubierta"],
    },
  };
}

describe("ToolGateway.executeAuthorizedTool: get_budget_summary", () => {
  it("responde el periodo con lo gastado, la banda y evidencia citable", async () => {
    repos.listBudgetsWithProgress.mockResolvedValue([
      budgetRow(),
      budgetRow({ id: "budget-2", category_name: "Transporte", spent: 700, amount: 500, remaining: -200, percentage: 140, band: "superado" }),
    ]);
    const gateway = new ToolGateway(emptyClient());

    const result = await gateway.executeAuthorizedTool({
      toolName: "get_budget_summary",
      userId,
      query: augustQuery(),
      activeMemoryState: null,
      turnState,
    });

    expect(result.status).toBe("called");
    expect(result.facts).toContain("budget_count=2");
    expect(result.facts).toContain("exceeded_count=1");
    expect(result.facts).toContain("period=2026-08-01..2026-08-31");
    expect(
      result.facts.some((fact) => fact.startsWith("budget:Transporte=")),
    ).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.data.budget_count).toBe(2);
  });

  it("sin presupuestos avisa en vez de dejar que el modelo afirme un limite", async () => {
    repos.listBudgetsWithProgress.mockResolvedValue([]);
    const gateway = new ToolGateway(emptyClient());

    const result = await gateway.executeAuthorizedTool({
      toolName: "get_budget_summary",
      userId,
      query: augustQuery(),
      activeMemoryState: null,
      turnState,
    });

    expect(result.status).toBe("called");
    expect(result.facts).toContain("budget_count=0");
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("no tiene presupuestos");
  });

  it("consulta con el cliente autenticado del gateway y solo el usuario del turno", async () => {
    repos.listBudgetsWithProgress.mockResolvedValue([]);
    const client = emptyClient();
    const gateway = new ToolGateway(client);

    await gateway.executeAuthorizedTool({
      toolName: "get_budget_summary",
      userId: otherUserId,
      query: augustQuery(),
      activeMemoryState: null,
      turnState,
    });

    expect(repos.listBudgetsWithProgress).toHaveBeenCalledWith(
      client,
      otherUserId,
      expect.objectContaining({ periodKind: "mensual", date: "2026-08-01" }),
    );
  });

  it("un rango de una semana usa el periodo semanal, no el mensual", async () => {
    repos.listBudgetsWithProgress.mockResolvedValue([]);
    const gateway = new ToolGateway(emptyClient());

    await gateway.executeAuthorizedTool({
      toolName: "get_budget_summary",
      userId,
      query: {
        ...augustQuery(),
        date_range: {
          start: "2026-08-03T05:00:00.000Z",
          end: "2026-08-09T23:59:59.000Z",
          label: "esta semana",
        },
      },
      activeMemoryState: null,
      turnState,
    });

    expect(repos.listBudgetsWithProgress).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      expect.objectContaining({ periodKind: "semanal" }),
    );
  });
});

describe("ToolGateway.executeAuthorizedTool: get_report_period", () => {
  it("devuelve el total oficial, el desglose etiquetado y la comparacion previa", async () => {
    repos.getReportPeriod
      .mockResolvedValueOnce(reportResult())
      .mockResolvedValueOnce(reportResult({ gastoTotal: 1000, byCategory: [] }));
    repos.getClassificationCatalog.mockResolvedValue({
      version: 1,
      categories: [{ id: "alimentacion", label: "Alimentacion", is_sensitive: false }],
      subcategories: [],
      tags: [],
      related_people: [],
    });
    const gateway = new ToolGateway(emptyClient());

    const result = await gateway.executeAuthorizedTool({
      toolName: "get_report_period",
      userId,
      query: augustQuery(),
      activeMemoryState: null,
      turnState,
    });

    expect(result.status).toBe("called");
    expect(result.facts).toContain("expense_total=S/1200.00");
    expect(result.facts).toContain("income_total=S/3000.00");
    expect(result.facts).toContain("previous_expense_total=S/1000.00");
    expect(result.facts).toContain("expense_difference=S/200.00");
    expect(result.facts).toContain("excluded:transferencia=3");
    expect(
      result.facts.some((fact) => fact.startsWith("category:Alimentacion=")),
    ).toBe(true);
    // Una categoria vacia se nombra, no se pierde.
    expect(
      result.facts.some((fact) => fact.startsWith("category:Sin categoria=")),
    ).toBe(true);
    expect(result.warnings).toContain(
      "3 movimiento(s) excluido(s) por transferencia: no son gasto del periodo.",
    );
  });

  it("un periodo sin movimientos avisa en vez de reportar un cero limpio", async () => {
    repos.getReportPeriod.mockResolvedValue(
      reportResult({
        gastoTotal: 0,
        ingresoTotal: 0,
        gastoMovementCount: 0,
        ingresoMovementCount: 0,
        byCategory: [],
        exclusions: [],
        countedMovementIds: [],
      }),
    );
    repos.getClassificationCatalog.mockResolvedValue({
      version: 1,
      categories: [],
      subcategories: [],
      tags: [],
      related_people: [],
    });
    const gateway = new ToolGateway(emptyClient());

    const result = await gateway.executeAuthorizedTool({
      toolName: "get_report_period",
      userId,
      query: augustQuery(),
      activeMemoryState: null,
      turnState,
    });

    expect(result.status).toBe("called");
    expect(result.facts).toContain("expense_total=S/0.00");
    expect(result.warnings[0]).toContain("No hay movimientos contables");
  });

  it("pide los dos periodos con el cliente del gateway y el usuario del turno", async () => {
    repos.getReportPeriod.mockResolvedValue(reportResult());
    repos.getClassificationCatalog.mockResolvedValue({
      version: 1,
      categories: [],
      subcategories: [],
      tags: [],
      related_people: [],
    });
    const client = emptyClient();
    const gateway = new ToolGateway(client);

    await gateway.executeAuthorizedTool({
      toolName: "get_report_period",
      userId: otherUserId,
      query: augustQuery(),
      activeMemoryState: null,
      turnState,
    });

    expect(repos.getReportPeriod).toHaveBeenCalledWith(client, otherUserId, {
      from: "2026-08-01",
      to: "2026-08-31",
    });
    // `RUL-REP-04`: el periodo anterior viaja en la misma llamada, no en otra
    // ronda de tools.
    expect(repos.getReportPeriod).toHaveBeenCalledWith(client, otherUserId, {
      from: "2026-07-01",
      to: "2026-07-31",
    });
    expect(repos.getClassificationCatalog).toHaveBeenCalledWith(
      client,
      otherUserId,
    );
  });
});

describe("ToolGateway.executeAuthorizedTool: get_projection_snapshot", () => {
  it("expone dinero libre, ritmo, cierre proyectado y sus supuestos", async () => {
    repos.getProjectionSnapshot.mockResolvedValue(projectionSnapshot());
    const gateway = new ToolGateway(emptyClient());

    const result = await gateway.executeAuthorizedTool({
      toolName: "get_projection_snapshot",
      userId,
      query: augustQuery(),
      activeMemoryState: null,
      turnState,
    });

    expect(result.status).toBe("called");
    expect(result.facts).toContain("free_money=S/1200.00");
    expect(result.facts).toContain("daily_pace=S/35.00");
    expect(result.facts).toContain("days_remaining=22");
    expect(result.facts).toContain("projected_close=S/430.00");
    expect(
      result.facts.some((fact) => fact.startsWith("assumption:daily_pace=")),
    ).toBe(true);
    expect(result.facts).toContain("cobertura=descubierta");
    expect(result.warnings).toEqual([]);
  });

  it("sin datos suficientes prohibe afirmar un cierre de mes", async () => {
    repos.getProjectionSnapshot.mockResolvedValue(
      projectionSnapshot({
        projection: {
          sufficient_data: false,
          insufficiency_reason: "fewer_than_7_observable_days",
          projection_cents: null,
          range: null,
          assumptions: [],
          period_start: "2026-08-01",
          period_end: "2026-08-31",
          as_of: "2026-08-09",
          free_money_cents: 0,
          uncovered_commitments_cents: 0,
          observed_days: 2,
          daily_pace_cents: 0,
          days_remaining: 22,
        },
      }),
    );
    const gateway = new ToolGateway(emptyClient());

    const result = await gateway.executeAuthorizedTool({
      toolName: "get_projection_snapshot",
      userId,
      query: augustQuery(),
      activeMemoryState: null,
      turnState,
    });

    expect(result.status).toBe("called");
    expect(result.facts).toContain(
      "projected_close=no_disponible:fewer_than_7_observable_days",
    );
    expect(result.warnings[0]).toContain("No hay datos suficientes");
  });

  it("proyecta con el cliente del gateway y solo para el usuario del turno", async () => {
    repos.getProjectionSnapshot.mockResolvedValue(projectionSnapshot());
    const client = emptyClient();
    const gateway = new ToolGateway(client);

    await gateway.executeAuthorizedTool({
      toolName: "get_projection_snapshot",
      userId: otherUserId,
      query: augustQuery(),
      activeMemoryState: null,
      turnState,
    });

    expect(repos.getProjectionSnapshot).toHaveBeenCalledWith(
      client,
      otherUserId,
    );
  });
});

describe("ToolGateway.executeAuthorizedTool: get_financial_structure con metas", () => {
  it("responde cuentas, cajas y el avance de cada meta en una sola llamada", async () => {
    repos.getActiveAccounts.mockResolvedValue([
      {
        id: "account-1",
        name: "BCP",
        type: "banco",
        currency: "PEN",
        current_balance: 3200,
        is_default: true,
      },
    ]);
    repos.getActiveBoxes.mockResolvedValue([
      {
        id: "box-1",
        account_id: "account-1",
        name: "Viaje",
        type: "meta",
        current_balance: 900,
        target_amount: 3000,
        target_date: "2026-12-31",
      },
    ]);
    repos.listGoals.mockResolvedValue([
      {
        id: "goal-1",
        name: "Viaje a Cusco",
        status: "activa",
        target_amount: 3000,
        target_date: "2026-12-31",
        box_id: "box-1",
        box: { name: "Viaje" },
        current_balance: 900,
        progress_pct: 30,
        monthly_pace: 525,
      },
    ]);
    const gateway = new ToolGateway(emptyClient());

    const result = await gateway.executeAuthorizedTool({
      toolName: "get_financial_structure",
      userId,
      query: augustQuery(),
      activeMemoryState: null,
      turnState,
    });

    expect(result.status).toBe("called");
    expect(result.facts).toContain("account_count=1");
    expect(result.facts).toContain("box_count=1");
    expect(result.facts).toContain("goal_count=1");
    expect(
      result.facts.some(
        (fact) =>
          fact.startsWith("goal:Viaje a Cusco=") &&
          fact.includes("30%") &&
          fact.includes("ritmo S/525.00/mes"),
      ),
    ).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("sin metas responde cero sin advertencias, porque cero es la verdad", async () => {
    repos.getActiveAccounts.mockResolvedValue([]);
    repos.getActiveBoxes.mockResolvedValue([]);
    repos.listGoals.mockResolvedValue([]);
    const gateway = new ToolGateway(emptyClient());

    const result = await gateway.executeAuthorizedTool({
      toolName: "get_financial_structure",
      userId,
      query: augustQuery(),
      activeMemoryState: null,
      turnState,
    });

    expect(result.facts).toContain("goal_count=0");
    expect(result.warnings).toEqual([]);
    expect(result.data.goals).toEqual([]);
  });

  it("si las metas fallan, cuentas y cajas siguen respondiendo y se avisa", async () => {
    repos.getActiveAccounts.mockResolvedValue([
      {
        id: "account-1",
        name: "BCP",
        type: "banco",
        currency: "PEN",
        current_balance: 3200,
        is_default: true,
      },
    ]);
    repos.getActiveBoxes.mockResolvedValue([]);
    repos.listGoals.mockRejectedValue(new Error("rls denied"));
    const gateway = new ToolGateway(emptyClient());

    const result = await gateway.executeAuthorizedTool({
      toolName: "get_financial_structure",
      userId,
      query: augustQuery(),
      activeMemoryState: null,
      turnState,
    });

    expect(result.status).toBe("called");
    expect(result.facts).toContain("account_count=1");
    expect(result.warnings[0]).toContain("no afirmes que el usuario no tiene metas");
  });

  it("lee metas con el cliente del gateway y solo para el usuario del turno", async () => {
    repos.getActiveAccounts.mockResolvedValue([]);
    repos.getActiveBoxes.mockResolvedValue([]);
    repos.listGoals.mockResolvedValue([]);
    const client = emptyClient();
    const gateway = new ToolGateway(client);

    await gateway.executeAuthorizedTool({
      toolName: "get_financial_structure",
      userId: otherUserId,
      query: augustQuery(),
      activeMemoryState: null,
      turnState,
    });

    expect(repos.listGoals).toHaveBeenCalledWith(
      client,
      otherUserId,
      expect.objectContaining({ statuses: ["activa", "alcanzada", "pausada"] }),
    );
  });
});

function augustQuery(): ConversationQuery {
  return {
    kind: "movement_search",
    normalized_text: "como voy este mes",
    requested_amount: null,
    date_range: {
      start: "2026-08-01T05:00:00.000Z",
      end: "2026-08-31T23:59:59.000Z",
      label: "agosto de 2026",
    },
    confidence: 0.95,
  };
}

describe("get_report_period: eleccion del periodo anterior", () => {
  it("un rango de una semana se compara contra la semana inmediatamente previa", async () => {
    repos.getReportPeriod.mockResolvedValue(reportResult());
    repos.getClassificationCatalog.mockResolvedValue({
      version: 1,
      categories: [],
      subcategories: [],
      tags: [],
      related_people: [],
    });
    const gateway = new ToolGateway(emptyClient());

    await gateway.executeAuthorizedTool({
      toolName: "get_report_period",
      userId,
      query: {
        ...augustQuery(),
        date_range: {
          start: "2026-08-03T05:00:00.000Z",
          end: "2026-08-09T23:59:59.000Z",
          label: "esta semana",
        },
      },
      activeMemoryState: null,
      turnState,
    });

    expect(repos.getReportPeriod).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      { from: "2026-07-27", to: "2026-08-02" },
    );
  });
});

describe("get_projection_snapshot sin query", () => {
  it("responde igual sin query, porque la proyeccion no tiene parametros", async () => {
    repos.getProjectionSnapshot.mockResolvedValue(projectionSnapshot());
    const gateway = new ToolGateway(emptyClient());

    const result = await gateway.executeAuthorizedTool({
      toolName: "get_projection_snapshot",
      userId,
      query: null,
      activeMemoryState: null,
      turnState,
    });

    expect(result.status).toBe("called");
    expect(result.facts).toContain("free_money=S/1200.00");
  });
});
