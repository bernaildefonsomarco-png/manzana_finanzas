import { randomUUID } from "node:crypto";

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  GET as listBudgets,
  POST as createBudget,
} from "@/app/api/v1/budgets/route";
import { POST as copyPreviousBudgets } from "@/app/api/v1/budgets/copy-previous/route";
import { GET as listBudgetSuggestions } from "@/app/api/v1/budgets/suggestions/route";
import { POST as acceptBudgetSuggestion } from "@/app/api/v1/budgets/suggestions/[id]/accept/route";
import { POST as dismissBudgetSuggestion } from "@/app/api/v1/budgets/suggestions/[id]/dismiss/route";
import { GET as getBudgetSummary } from "@/app/api/v1/budgets/summary/route";
import {
  DELETE as archiveBudget,
  GET as getBudget,
  PATCH as updateBudget,
} from "@/app/api/v1/budgets/[id]/route";
import { POST as pauseBudget } from "@/app/api/v1/budgets/[id]/pause/route";
import { POST as restoreBudget } from "@/app/api/v1/budgets/[id]/restore/route";
import { POST as resumeBudget } from "@/app/api/v1/budgets/[id]/resume/route";
import { GET as listGoals, POST as createGoal } from "@/app/api/v1/goals/route";
import {
  DELETE as archiveGoal,
  GET as getGoal,
  PATCH as updateGoal,
} from "@/app/api/v1/goals/[id]/route";
import { POST as linkGoalBox } from "@/app/api/v1/goals/[id]/link-box/route";
import { POST as pauseGoal } from "@/app/api/v1/goals/[id]/pause/route";
import { POST as restoreGoal } from "@/app/api/v1/goals/[id]/restore/route";
import { POST as resumeGoal } from "@/app/api/v1/goals/[id]/resume/route";
import { POST as unlinkGoalBox } from "@/app/api/v1/goals/[id]/unlink-box/route";
import { GET as getProjectionHealth } from "@/app/api/v1/projections/health/route";
import { GET as getPeriodProjection } from "@/app/api/v1/projections/period/route";
import { GET as getProjectionBreakdown } from "@/app/api/v1/projections/period/breakdown/route";
import { POST as simulateExpense } from "@/app/api/v1/simulate/route";
import {
  budgetPeriodContaining,
  previousBudgetPeriod,
  type BudgetPeriodKind,
} from "@/core/budgets";
import { isoDateInLima } from "@/shared/dates/lima";

import {
  admin,
  crearUsuarioDePrueba,
  limpiarUsuariosDePrueba,
  type UsuarioDePrueba,
} from "./lib/entorno";

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/app/api/_lib/auth", () => ({
  getApiAuth: authMock,
}));

type JsonRecord = Record<string, unknown>;
type RouteContext = { params: Promise<{ id: string }> };
type ContextHandler = (
  request: Request,
  context: RouteContext,
) => Promise<Response>;

type PreparedRead = {
  call: () => Promise<Response>;
  assert?: (body: JsonRecord) => void;
};

type PreparedMutation = {
  call: (idempotencyKey: string) => Promise<Response>;
  assert?: (body: JsonRecord) => void;
};

type EndpointContract = {
  name: string;
  happy: () => Promise<void>;
  unauthorized: () => Promise<Response>;
  isolation: () => Promise<void>;
  validation: () => Promise<Response>;
  idempotency: () => Promise<void>;
};

const TRACE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SPANISH_VALIDATION_PATTERN =
  /(campos|cursor|falta|fecha|monto|presupuesto|meta|sugerencia|indica|valida)/i;
const TODAY = isoDateInLima();

let owner: UsuarioDePrueba;
let intruder: UsuarioDePrueba;
let ownerAccountId: string;
let intruderAccountId: string;
let budgetYear = 2060;
let acceptCategoryIndex = 0;
let dismissCategoryIndex = 0;

const ACCEPT_CATEGORIES = ["transporte", "salud"] as const;
const DISMISS_CATEGORIES = ["educacion", "ocio_salidas"] as const;

beforeAll(async () => {
  owner = await crearUsuarioDePrueba("w12-api-owner");
  intruder = await crearUsuarioDePrueba("w12-api-intruder");
  ownerAccountId = await seedAccount(owner, 1_000);
  intruderAccountId = await seedAccount(intruder, 900_000);

  await seedBudget(owner, {
    amount: 700,
    categoryId: null,
    date: TODAY,
  });
  await seedGoal(owner);
});

beforeEach(() => {
  authenticateAs(owner);
});

afterAll(async () => {
  await limpiarUsuariosDePrueba();
});

function authenticateAs(user: UsuarioDePrueba | null) {
  authMock.mockReset();
  authMock.mockResolvedValue(
    user ? { client: user.client, userId: user.id } : null,
  );
}

function readContract(input: {
  name: string;
  prepare: () => Promise<PreparedRead>;
  unauthorized: () => Promise<Response>;
  isolation: () => Promise<void>;
  validation: () => Promise<Response>;
}): EndpointContract {
  return {
    name: input.name,
    happy: async () => {
      const prepared = await input.prepare();
      const body = await expectOk(prepared.call(), 200);
      prepared.assert?.(body);
    },
    unauthorized: input.unauthorized,
    isolation: input.isolation,
    validation: input.validation,
    idempotency: async () => {
      const prepared = await input.prepare();
      const before = await mutationFootprint(owner.id);
      const first = await expectOk(prepared.call(), 200);
      const second = await expectOk(prepared.call(), 200);
      const after = await mutationFootprint(owner.id);
      expect(record(second.data)).toEqual(record(first.data));
      expect(after).toEqual(before);
    },
  };
}

function mutationContract(input: {
  name: string;
  firstStatus: 200 | 201;
  prepare: () => Promise<PreparedMutation>;
  unauthorized: () => Promise<Response>;
  isolation: () => Promise<void>;
  validation: () => Promise<Response>;
}): EndpointContract {
  return {
    name: input.name,
    happy: async () => {
      const prepared = await input.prepare();
      const body = await expectOk(
        prepared.call(`happy-${randomUUID()}`),
        input.firstStatus,
      );
      prepared.assert?.(body);
    },
    unauthorized: input.unauthorized,
    isolation: input.isolation,
    validation: input.validation,
    idempotency: async () => {
      const prepared = await input.prepare();
      const key = `replay-${randomUUID()}`;
      const first = await expectOk(prepared.call(key), input.firstStatus);
      const afterFirst = await mutationFootprint(owner.id);
      const second = await expectOk(prepared.call(key), 200);
      const afterSecond = await mutationFootprint(owner.id);

      expect(record(second.meta).idempotent_replay).toBe(true);
      expect(second.data).toEqual(first.data);
      expect(afterSecond).toEqual(afterFirst);
    },
  };
}

async function expectOk(
  responsePromise: Promise<Response>,
  expectedStatus: number,
): Promise<JsonRecord> {
  const response = await responsePromise;
  const body = record(await response.json());
  expect(response.status).toBe(expectedStatus);
  expect(body.ok).toBe(true);
  expect(body).toHaveProperty("data");
  expect(record(body.meta).trace_id).toEqual(
    expect.stringMatching(TRACE_ID_PATTERN),
  );
  return body;
}

async function expectAuthRequired(responsePromise: Promise<Response>) {
  const response = await responsePromise;
  const body = record(await response.json());
  expect(response.status).toBe(401);
  expect(record(body.error)).toMatchObject({
    code: "AUTH_REQUIRED",
  });
  expect(record(body.meta).trace_id).toEqual(
    expect.stringMatching(TRACE_ID_PATTERN),
  );
}

async function expectValidation(responsePromise: Promise<Response>) {
  const response = await responsePromise;
  const body = record(await response.json());
  const error = record(body.error);
  expect(response.status).toBe(400);
  expect(error.code).toBe("VALIDATION_ERROR");
  expect(error.message).toEqual(
    expect.stringMatching(SPANISH_VALIDATION_PATTERN),
  );
  expect(record(body.meta).trace_id).toEqual(
    expect.stringMatching(TRACE_ID_PATTERN),
  );
}

async function expectNotFound(responsePromise: Promise<Response>) {
  const response = await responsePromise;
  const body = record(await response.json());
  expect(response.status).toBe(404);
  expect(response.status).not.toBe(403);
  expect(record(body.error).code).toBe("NOT_FOUND");
}

async function assertAggregateIsolation(
  call: () => Promise<Response>,
  seedForeignState: () => Promise<void>,
) {
  authenticateAs(owner);
  const before = await expectOk(call(), 200);
  await seedForeignState();
  authenticateAs(owner);
  const after = await expectOk(call(), 200);
  expect(after.data).toEqual(before.data);
}

function request(path: string) {
  return new Request(`http://localhost${path}`);
}

function jsonRequest(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body: unknown,
  idempotencyKey?: string,
) {
  const headers = new Headers({ "content-type": "application/json" });
  if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);
  return new Request(`http://localhost${path}`, {
    method,
    headers,
    body: JSON.stringify(body),
  });
}

function invokeWithId(
  handler: ContextHandler,
  requestValue: Request,
  id: string,
) {
  return handler(requestValue, { params: Promise.resolve({ id }) });
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function nextBudgetDate() {
  const year = budgetYear;
  budgetYear += 1;
  return `${year}-07-15`;
}

function nextCopyDates() {
  const year = budgetYear;
  budgetYear += 1;
  return {
    previous: `${year}-06-15`,
    target: `${year}-07-15`,
  };
}

async function seedAccount(user: UsuarioDePrueba, balance: number) {
  const { data, error } = await admin
    .from("accounts")
    .insert({
      user_id: user.id,
      name: `Cuenta API ${randomUUID().slice(0, 8)}`,
      type: "banco",
      currency: "PEN",
      initial_balance: balance,
      current_balance: balance,
    })
    .select("id")
    .single();
  if (error || !data)
    throw new Error(`No pude crear cuenta: ${error?.message}`);
  return data.id;
}

async function seedBox(
  user: UsuarioDePrueba,
  accountId: string,
  balance = 125,
) {
  const { data, error } = await admin
    .from("boxes")
    .insert({
      user_id: user.id,
      account_id: accountId,
      name: `Caja API ${randomUUID().slice(0, 8)}`,
      type: "objetivo",
      current_balance: balance,
      target_amount: 900,
      target_date: "2099-12-31",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`No pude crear caja: ${error?.message}`);
  return data.id;
}

async function seedBudget(
  user: UsuarioDePrueba,
  input: {
    amount?: number;
    categoryId?: string | null;
    date?: string;
    status?: "activo" | "pausado" | "archivado";
  } = {},
) {
  const created = await commitBudgetRpc(user, {
    operation: "create",
    budgetId: null,
    payload: {
      amount: input.amount ?? 250,
      category_id: input.categoryId ?? null,
      period_kind: "mensual",
      kind: "presupuesto",
      rollover: false,
      auto_renew: true,
      date: input.date ?? nextBudgetDate(),
      currency: "PEN",
      source: "manual",
    },
  });
  let budget = record(record(created).budget);
  const budgetId = String(budget.id);

  if (input.status === "pausado") {
    budget = record(
      record(
        await commitBudgetRpc(user, {
          operation: "pause",
          budgetId,
          payload: {},
        }),
      ).budget,
    );
  } else if (input.status === "archivado") {
    budget = record(
      record(
        await commitBudgetRpc(user, {
          operation: "archive",
          budgetId,
          payload: {},
        }),
      ).budget,
    );
  }
  return budget;
}

async function seedGoal(
  user: UsuarioDePrueba,
  input: {
    status?: "activa" | "pausada" | "archivada";
    boxId?: string;
  } = {},
) {
  const created = await commitGoalRpc(user, {
    operation: "create",
    goalId: null,
    payload: {
      name: `Meta API ${randomUUID().slice(0, 8)}`,
      target_amount: 900,
      target_date: "2099-12-31",
      box_id: input.boxId ?? null,
      currency: "PEN",
    },
  });
  let goal = record(record(created).goal);
  const goalId = String(goal.id);

  if (input.status === "pausada") {
    goal = record(
      record(
        await commitGoalRpc(user, {
          operation: "pause",
          goalId,
          payload: {},
        }),
      ).goal,
    );
  } else if (input.status === "archivada") {
    goal = record(
      record(
        await commitGoalRpc(user, {
          operation: "archive",
          goalId,
          payload: {},
        }),
      ).goal,
    );
  }
  return goal;
}

async function commitBudgetRpc(
  user: UsuarioDePrueba,
  input: {
    operation: string;
    budgetId: string | null;
    payload: JsonRecord;
  },
) {
  const { data, error } = await user.client.rpc("commit_budget_operation", {
    p_operation: input.operation,
    p_budget_id: input.budgetId,
    p_payload: { ...input.payload, trace_id: randomUUID() },
    p_idempotency_key: `seed-budget-${randomUUID()}`,
  });
  if (error) throw new Error(`No pude sembrar presupuesto: ${error.message}`);
  return data;
}

async function commitGoalRpc(
  user: UsuarioDePrueba,
  input: {
    operation: string;
    goalId: string | null;
    payload: JsonRecord;
  },
) {
  const { data, error } = await user.client.rpc("commit_goal_operation", {
    p_operation: input.operation,
    p_goal_id: input.goalId,
    p_payload: { ...input.payload, trace_id: randomUUID() },
    p_idempotency_key: `seed-goal-${randomUUID()}`,
  });
  if (error) throw new Error(`No pude sembrar meta: ${error.message}`);
  return data;
}

async function seedSuggestion(
  user: UsuarioDePrueba,
  categoryId: string,
  periodKind: BudgetPeriodKind = "mensual",
) {
  const current = budgetPeriodContaining(TODAY, periodKind);
  const recent = previousBudgetPeriod(current, periodKind);
  const older = previousBudgetPeriod(recent, periodKind);
  await seedMovement(user.id, categoryId, older.start, 100);
  await seedMovement(user.id, categoryId, recent.start, 140);

  const { data, error } = await user.client.rpc("get_budget_suggestions", {
    p_period_kind: periodKind,
    p_as_of: TODAY,
  });
  if (error) throw new Error(`No pude calcular sugerencia: ${error.message}`);
  const suggestion = array(data)
    .map(record)
    .find((row) => row.category_id === categoryId);
  if (!suggestion) {
    throw new Error(`No apareció la sugerencia para ${categoryId}`);
  }
  return String(suggestion.suggestion_key);
}

async function seedMovement(
  userId: string,
  categoryId: string,
  date: string,
  amount: number,
) {
  const { error } = await admin.from("movements").insert({
    id: randomUUID(),
    user_id: userId,
    type: "gasto",
    status: "confirmed",
    amount,
    currency: "PEN",
    occurred_at: `${date}T17:00:00.000Z`,
    category_id: categoryId,
    source: "dashboard_manual",
    idempotency_key: `w12-api-movement-${randomUUID()}`,
  });
  if (error) throw new Error(`No pude crear movimiento: ${error.message}`);
}

async function seedForeignProjectionNoise() {
  await seedAccount(intruder, 800_000 + budgetYear);
}

async function mutationFootprint(userId: string) {
  const [
    budgets,
    goals,
    accounts,
    boxes,
    decisions,
    budgetReceipts,
    goalReceipts,
    outbox,
    snapshots,
    movements,
  ] = await Promise.all([
    admin
      .from("budgets")
      .select("id,status,amount,updated_at,deleted_at")
      .eq("user_id", userId)
      .order("id"),
    admin
      .from("goals")
      .select(
        "id,status,box_id,target_amount,target_date,updated_at,deleted_at",
      )
      .eq("user_id", userId)
      .order("id"),
    admin
      .from("accounts")
      .select("id,current_balance,updated_at,deleted_at")
      .eq("user_id", userId)
      .order("id"),
    admin
      .from("boxes")
      .select(
        "id,current_balance,target_amount,target_date,updated_at,deleted_at",
      )
      .eq("user_id", userId)
      .order("id"),
    admin
      .from("budget_suggestion_decisions")
      .select("id,suggestion_key,resolution,budget_id")
      .eq("user_id", userId)
      .order("id"),
    admin
      .from("budget_operation_receipts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    admin
      .from("goal_operation_receipts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    admin
      .from("transactional_outbox")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    admin
      .from("budget_progress_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    admin
      .from("movements")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  for (const result of [
    budgets,
    goals,
    accounts,
    boxes,
    decisions,
    budgetReceipts,
    goalReceipts,
    outbox,
    snapshots,
    movements,
  ]) {
    if (result.error) {
      throw new Error(`No pude medir idempotencia: ${result.error.message}`);
    }
  }

  return {
    budgets: budgets.data,
    goals: goals.data,
    accounts: accounts.data,
    boxes: boxes.data,
    decisions: decisions.data,
    budgetReceipts: budgetReceipts.count,
    goalReceipts: goalReceipts.count,
    outbox: outbox.count,
    snapshots: snapshots.count,
    movements: movements.count,
  };
}

const READ_CONTRACTS: EndpointContract[] = [
  readContract({
    name: "GET /api/v1/budgets",
    prepare: async () => ({
      call: () => listBudgets(request(`/api/v1/budgets?date=${TODAY}`)),
      assert: (body) => {
        expect(array(record(body.data).budgets).length).toBeGreaterThan(0);
      },
    }),
    unauthorized: () => listBudgets(request(`/api/v1/budgets?date=${TODAY}`)),
    validation: () => listBudgets(request("/api/v1/budgets?campo_ajeno=1")),
    isolation: () =>
      assertAggregateIsolation(
        () => listBudgets(request(`/api/v1/budgets?date=${TODAY}`)),
        async () => {
          await seedBudget(intruder, {
            amount: 91_001,
            categoryId: "vivienda_hogar",
            date: TODAY,
          });
        },
      ),
  }),
  readContract({
    name: "GET /api/v1/budgets/:id",
    prepare: async () => {
      const budget = await seedBudget(owner);
      const id = String(budget.id);
      return {
        call: () =>
          invokeWithId(getBudget, request(`/api/v1/budgets/${id}`), id),
        assert: (body) => {
          expect(record(record(body.data).budget).id).toBe(id);
        },
      };
    },
    unauthorized: () =>
      invokeWithId(
        getBudget,
        request(`/api/v1/budgets/${randomUUID()}`),
        randomUUID(),
      ),
    validation: () =>
      invokeWithId(
        getBudget,
        request("/api/v1/budgets/no-es-uuid"),
        "no-es-uuid",
      ),
    isolation: async () => {
      const foreign = await seedBudget(intruder);
      const id = String(foreign.id);
      authenticateAs(owner);
      await expectNotFound(
        invokeWithId(getBudget, request(`/api/v1/budgets/${id}`), id),
      );
    },
  }),
  readContract({
    name: "GET /api/v1/budgets/summary",
    prepare: async () => ({
      call: () =>
        getBudgetSummary(request(`/api/v1/budgets/summary?date=${TODAY}`)),
      assert: (body) => {
        expect(record(record(body.data).summary).total).toEqual(
          expect.any(Number),
        );
      },
    }),
    unauthorized: () =>
      getBudgetSummary(request(`/api/v1/budgets/summary?date=${TODAY}`)),
    validation: () =>
      getBudgetSummary(request("/api/v1/budgets/summary?horizon=90")),
    isolation: () =>
      assertAggregateIsolation(
        () =>
          getBudgetSummary(request(`/api/v1/budgets/summary?date=${TODAY}`)),
        async () => {
          await seedBudget(intruder, {
            amount: 92_002,
            categoryId: "servicios_suscripciones",
            date: TODAY,
          });
        },
      ),
  }),
  readContract({
    name: "GET /api/v1/budgets/suggestions",
    prepare: async () => {
      await seedSuggestion(owner, "alimentacion");
      return {
        call: () =>
          listBudgetSuggestions(
            request(
              `/api/v1/budgets/suggestions?period_kind=mensual&date=${TODAY}`,
            ),
          ),
        assert: (body) => {
          expect(
            array(record(body.data).suggestions)
              .map(record)
              .some((item) => item.category_id === "alimentacion"),
          ).toBe(true);
        },
      };
    },
    unauthorized: () =>
      listBudgetSuggestions(
        request(`/api/v1/budgets/suggestions?date=${TODAY}`),
      ),
    validation: () =>
      listBudgetSuggestions(
        request("/api/v1/budgets/suggestions?period_kind=anual"),
      ),
    isolation: () =>
      assertAggregateIsolation(
        () =>
          listBudgetSuggestions(
            request(
              `/api/v1/budgets/suggestions?period_kind=mensual&date=${TODAY}`,
            ),
          ),
        async () => {
          await seedSuggestion(intruder, "familia_apoyo");
        },
      ),
  }),
  readContract({
    name: "GET /api/v1/goals",
    prepare: async () => ({
      call: () => listGoals(request("/api/v1/goals")),
      assert: (body) => {
        expect(array(record(body.data).goals).length).toBeGreaterThan(0);
      },
    }),
    unauthorized: () => listGoals(request("/api/v1/goals")),
    validation: () => listGoals(request("/api/v1/goals?estado_ajeno=1")),
    isolation: () =>
      assertAggregateIsolation(
        () => listGoals(request("/api/v1/goals")),
        async () => {
          await seedGoal(intruder);
        },
      ),
  }),
  readContract({
    name: "GET /api/v1/goals/:id",
    prepare: async () => {
      const goal = await seedGoal(owner);
      const id = String(goal.id);
      return {
        call: () => invokeWithId(getGoal, request(`/api/v1/goals/${id}`), id),
        assert: (body) => {
          expect(record(record(body.data).goal).id).toBe(id);
        },
      };
    },
    unauthorized: () =>
      invokeWithId(
        getGoal,
        request(`/api/v1/goals/${randomUUID()}`),
        randomUUID(),
      ),
    validation: () =>
      invokeWithId(getGoal, request("/api/v1/goals/no-es-uuid"), "no-es-uuid"),
    isolation: async () => {
      const foreign = await seedGoal(intruder);
      const id = String(foreign.id);
      authenticateAs(owner);
      await expectNotFound(
        invokeWithId(getGoal, request(`/api/v1/goals/${id}`), id),
      );
    },
  }),
  readContract({
    name: "GET /api/v1/projections/period",
    prepare: async () => ({
      call: () => getPeriodProjection(request("/api/v1/projections/period")),
      assert: (body) => {
        expect(record(body.data)).toHaveProperty("projection");
      },
    }),
    unauthorized: () =>
      getPeriodProjection(request("/api/v1/projections/period")),
    validation: () =>
      getPeriodProjection(request("/api/v1/projections/period?horizon=90")),
    isolation: () =>
      assertAggregateIsolation(
        () => getPeriodProjection(request("/api/v1/projections/period")),
        seedForeignProjectionNoise,
      ),
  }),
  readContract({
    name: "GET /api/v1/projections/period/breakdown",
    prepare: async () => ({
      call: () =>
        getProjectionBreakdown(request("/api/v1/projections/period/breakdown")),
      assert: (body) => {
        expect(record(body.data)).toHaveProperty("breakdown");
      },
    }),
    unauthorized: () =>
      getProjectionBreakdown(request("/api/v1/projections/period/breakdown")),
    validation: () =>
      getProjectionBreakdown(
        request("/api/v1/projections/period/breakdown?horizon=90"),
      ),
    isolation: () =>
      assertAggregateIsolation(
        () =>
          getProjectionBreakdown(
            request("/api/v1/projections/period/breakdown"),
          ),
        seedForeignProjectionNoise,
      ),
  }),
  readContract({
    name: "GET /api/v1/projections/health",
    prepare: async () => ({
      call: () => getProjectionHealth(request("/api/v1/projections/health")),
      assert: (body) => {
        expect(record(body.data)).toHaveProperty("situation");
      },
    }),
    unauthorized: () =>
      getProjectionHealth(request("/api/v1/projections/health")),
    validation: () =>
      getProjectionHealth(request("/api/v1/projections/health?horizon=90")),
    isolation: () =>
      assertAggregateIsolation(
        () => getProjectionHealth(request("/api/v1/projections/health")),
        seedForeignProjectionNoise,
      ),
  }),
  readContract({
    name: "POST /api/v1/simulate",
    prepare: async () => ({
      call: () =>
        simulateExpense(
          jsonRequest("/api/v1/simulate", "POST", { amount: 123.45 }),
        ),
      assert: (body) => {
        expect(record(body.data)).toHaveProperty("simulation");
        expect(record(body.data)).toHaveProperty("budget_effect");
      },
    }),
    unauthorized: () =>
      simulateExpense(
        jsonRequest("/api/v1/simulate", "POST", { amount: 123.45 }),
      ),
    validation: () =>
      simulateExpense(jsonRequest("/api/v1/simulate", "POST", { amount: 0 })),
    isolation: () =>
      assertAggregateIsolation(
        () =>
          simulateExpense(
            jsonRequest("/api/v1/simulate", "POST", { amount: 123.45 }),
          ),
        seedForeignProjectionNoise,
      ),
  }),
];

function budgetActionContract(input: {
  name: string;
  handler: ContextHandler;
  sourceStatus?: "activo" | "pausado" | "archivado";
  expectedStatus: "activo" | "pausado";
}): EndpointContract {
  const path = input.name.slice(input.name.indexOf("/api/"));
  return mutationContract({
    name: input.name,
    firstStatus: 200,
    prepare: async () => {
      const budget = await seedBudget(owner, { status: input.sourceStatus });
      const id = String(budget.id);
      return {
        call: (key) =>
          invokeWithId(
            input.handler,
            jsonRequest(path.replace(":id", id), "POST", {}, key),
            id,
          ),
        assert: (body) => {
          expect(record(record(body.data).budget).status).toBe(
            input.expectedStatus,
          );
        },
      };
    },
    unauthorized: () => {
      const id = randomUUID();
      return invokeWithId(
        input.handler,
        jsonRequest(
          path.replace(":id", id),
          "POST",
          {},
          `auth-${randomUUID()}`,
        ),
        id,
      );
    },
    validation: () => {
      const id = randomUUID();
      return invokeWithId(
        input.handler,
        jsonRequest(
          path.replace(":id", id),
          "POST",
          { campo_ajeno: true },
          `invalid-${randomUUID()}`,
        ),
        id,
      );
    },
    isolation: async () => {
      const foreign = await seedBudget(intruder, {
        status: input.sourceStatus,
      });
      const id = String(foreign.id);
      authenticateAs(owner);
      await expectNotFound(
        invokeWithId(
          input.handler,
          jsonRequest(
            path.replace(":id", id),
            "POST",
            {},
            `foreign-${randomUUID()}`,
          ),
          id,
        ),
      );
    },
  });
}

function goalStatusActionContract(input: {
  name: string;
  handler: ContextHandler;
  sourceStatus?: "activa" | "pausada" | "archivada";
  expectedStatus: "activa" | "pausada";
}): EndpointContract {
  const path = input.name.slice(input.name.indexOf("/api/"));
  return mutationContract({
    name: input.name,
    firstStatus: 200,
    prepare: async () => {
      const goal = await seedGoal(owner, { status: input.sourceStatus });
      const id = String(goal.id);
      return {
        call: (key) =>
          invokeWithId(
            input.handler,
            jsonRequest(path.replace(":id", id), "POST", {}, key),
            id,
          ),
        assert: (body) => {
          expect(record(record(body.data).goal).status).toBe(
            input.expectedStatus,
          );
        },
      };
    },
    unauthorized: () => {
      const id = randomUUID();
      return invokeWithId(
        input.handler,
        jsonRequest(
          path.replace(":id", id),
          "POST",
          {},
          `auth-${randomUUID()}`,
        ),
        id,
      );
    },
    validation: () => {
      const id = randomUUID();
      return invokeWithId(
        input.handler,
        jsonRequest(
          path.replace(":id", id),
          "POST",
          { campo_ajeno: true },
          `invalid-${randomUUID()}`,
        ),
        id,
      );
    },
    isolation: async () => {
      const foreign = await seedGoal(intruder, {
        status: input.sourceStatus,
      });
      const id = String(foreign.id);
      authenticateAs(owner);
      await expectNotFound(
        invokeWithId(
          input.handler,
          jsonRequest(
            path.replace(":id", id),
            "POST",
            {},
            `foreign-${randomUUID()}`,
          ),
          id,
        ),
      );
    },
  });
}

const BUDGET_MUTATION_CONTRACTS: EndpointContract[] = [
  mutationContract({
    name: "POST /api/v1/budgets",
    firstStatus: 201,
    prepare: async () => {
      const date = nextBudgetDate();
      return {
        call: (key) =>
          createBudget(
            jsonRequest(
              "/api/v1/budgets",
              "POST",
              {
                amount: 321.45,
                category_id: null,
                period_kind: "mensual",
                kind: "presupuesto",
                date,
              },
              key,
            ),
          ),
        assert: (body) => {
          expect(record(record(body.data).budget)).toMatchObject({
            amount: 321.45,
            currency: "PEN",
            period_kind: "mensual",
          });
        },
      };
    },
    unauthorized: () =>
      createBudget(
        jsonRequest(
          "/api/v1/budgets",
          "POST",
          { amount: 100, date: nextBudgetDate() },
          `auth-${randomUUID()}`,
        ),
      ),
    validation: () =>
      createBudget(
        jsonRequest(
          "/api/v1/budgets",
          "POST",
          { amount: 0 },
          `invalid-${randomUUID()}`,
        ),
      ),
    isolation: async () => {
      authenticateAs(intruder);
      const response = await expectOk(
        createBudget(
          jsonRequest(
            "/api/v1/budgets",
            "POST",
            {
              amount: 654.32,
              category_id: null,
              period_kind: "mensual",
              date: nextBudgetDate(),
            },
            `scoped-${randomUUID()}`,
          ),
        ),
        201,
      );
      const id = String(record(record(response.data).budget).id);
      const stored = await admin
        .from("budgets")
        .select("user_id")
        .eq("id", id)
        .single();
      expect(stored.error).toBeNull();
      expect(stored.data?.user_id).toBe(intruder.id);

      authenticateAs(owner);
      await expectNotFound(
        invokeWithId(getBudget, request(`/api/v1/budgets/${id}`), id),
      );
    },
  }),
  mutationContract({
    name: "PATCH /api/v1/budgets/:id",
    firstStatus: 200,
    prepare: async () => {
      const budget = await seedBudget(owner);
      const id = String(budget.id);
      return {
        call: (key) =>
          invokeWithId(
            updateBudget,
            jsonRequest(
              `/api/v1/budgets/${id}`,
              "PATCH",
              { amount: 333.33 },
              key,
            ),
            id,
          ),
        assert: (body) => {
          expect(record(record(body.data).budget).amount).toBe(333.33);
        },
      };
    },
    unauthorized: () => {
      const id = randomUUID();
      return invokeWithId(
        updateBudget,
        jsonRequest(
          `/api/v1/budgets/${id}`,
          "PATCH",
          { amount: 333 },
          `auth-${randomUUID()}`,
        ),
        id,
      );
    },
    validation: () => {
      const id = randomUUID();
      return invokeWithId(
        updateBudget,
        jsonRequest(
          `/api/v1/budgets/${id}`,
          "PATCH",
          { amount: 0 },
          `invalid-${randomUUID()}`,
        ),
        id,
      );
    },
    isolation: async () => {
      const foreign = await seedBudget(intruder);
      const id = String(foreign.id);
      authenticateAs(owner);
      await expectNotFound(
        invokeWithId(
          updateBudget,
          jsonRequest(
            `/api/v1/budgets/${id}`,
            "PATCH",
            { amount: 444 },
            `foreign-${randomUUID()}`,
          ),
          id,
        ),
      );
    },
  }),
  mutationContract({
    name: "DELETE /api/v1/budgets/:id",
    firstStatus: 200,
    prepare: async () => {
      const budget = await seedBudget(owner);
      const id = String(budget.id);
      return {
        call: (key) =>
          invokeWithId(
            archiveBudget,
            jsonRequest(`/api/v1/budgets/${id}`, "DELETE", {}, key),
            id,
          ),
        assert: (body) => {
          expect(record(record(body.data).budget).status).toBe("archivado");
        },
      };
    },
    unauthorized: () => {
      const id = randomUUID();
      return invokeWithId(
        archiveBudget,
        jsonRequest(
          `/api/v1/budgets/${id}`,
          "DELETE",
          {},
          `auth-${randomUUID()}`,
        ),
        id,
      );
    },
    validation: () =>
      invokeWithId(
        archiveBudget,
        jsonRequest(
          "/api/v1/budgets/no-es-uuid",
          "DELETE",
          {},
          `invalid-${randomUUID()}`,
        ),
        "no-es-uuid",
      ),
    isolation: async () => {
      const foreign = await seedBudget(intruder);
      const id = String(foreign.id);
      authenticateAs(owner);
      await expectNotFound(
        invokeWithId(
          archiveBudget,
          jsonRequest(
            `/api/v1/budgets/${id}`,
            "DELETE",
            {},
            `foreign-${randomUUID()}`,
          ),
          id,
        ),
      );
    },
  }),
  budgetActionContract({
    name: "POST /api/v1/budgets/:id/pause",
    handler: pauseBudget,
    expectedStatus: "pausado",
  }),
  budgetActionContract({
    name: "POST /api/v1/budgets/:id/resume",
    handler: resumeBudget,
    sourceStatus: "pausado",
    expectedStatus: "activo",
  }),
  budgetActionContract({
    name: "POST /api/v1/budgets/:id/restore",
    handler: restoreBudget,
    sourceStatus: "archivado",
    expectedStatus: "activo",
  }),
  mutationContract({
    name: "POST /api/v1/budgets/copy-previous",
    firstStatus: 201,
    prepare: async () => {
      const dates = nextCopyDates();
      await seedBudget(owner, {
        amount: 275,
        categoryId: null,
        date: dates.previous,
      });
      return {
        call: (key) =>
          copyPreviousBudgets(
            jsonRequest(
              "/api/v1/budgets/copy-previous",
              "POST",
              { period_kind: "mensual", date: dates.target },
              key,
            ),
          ),
        assert: (body) => {
          expect(array(record(body.data).budgets)).toHaveLength(1);
          expect(record(array(record(body.data).budgets)[0]).amount).toBe(275);
        },
      };
    },
    unauthorized: () =>
      copyPreviousBudgets(
        jsonRequest(
          "/api/v1/budgets/copy-previous",
          "POST",
          { period_kind: "mensual", date: nextBudgetDate() },
          `auth-${randomUUID()}`,
        ),
      ),
    validation: () =>
      copyPreviousBudgets(
        jsonRequest(
          "/api/v1/budgets/copy-previous",
          "POST",
          { period_kind: "anual" },
          `invalid-${randomUUID()}`,
        ),
      ),
    isolation: async () => {
      const dates = nextCopyDates();
      await seedBudget(intruder, {
        amount: 88_888,
        categoryId: null,
        date: dates.previous,
      });
      authenticateAs(owner);
      await expectNotFound(
        copyPreviousBudgets(
          jsonRequest(
            "/api/v1/budgets/copy-previous",
            "POST",
            { period_kind: "mensual", date: dates.target },
            `foreign-${randomUUID()}`,
          ),
        ),
      );
    },
  }),
  mutationContract({
    name: "POST /api/v1/budgets/suggestions/:id/accept",
    firstStatus: 201,
    prepare: async () => {
      const category = ACCEPT_CATEGORIES[acceptCategoryIndex];
      acceptCategoryIndex += 1;
      if (!category) throw new Error("Falta categoría aislada para aceptar");
      const suggestionKey = await seedSuggestion(owner, category);
      return {
        call: (key) =>
          invokeWithId(
            acceptBudgetSuggestion,
            jsonRequest(
              `/api/v1/budgets/suggestions/${encodeURIComponent(suggestionKey)}/accept`,
              "POST",
              { amount: 155, rollover: false, auto_renew: true },
              key,
            ),
            suggestionKey,
          ),
        assert: (body) => {
          expect(record(record(body.data).decision).resolution).toBe(
            "accepted",
          );
          expect(record(record(body.data).budget)).toMatchObject({
            category_id: category,
            source: "sugerido",
          });
        },
      };
    },
    unauthorized: () =>
      invokeWithId(
        acceptBudgetSuggestion,
        jsonRequest(
          "/api/v1/budgets/suggestions/bs_ajena/accept",
          "POST",
          {},
          `auth-${randomUUID()}`,
        ),
        "bs_ajena",
      ),
    validation: () =>
      invokeWithId(
        acceptBudgetSuggestion,
        jsonRequest(
          "/api/v1/budgets/suggestions//accept",
          "POST",
          {},
          `invalid-${randomUUID()}`,
        ),
        "",
      ),
    isolation: async () => {
      const foreignKey = await seedSuggestion(intruder, "compras_personales");
      authenticateAs(owner);
      await expectNotFound(
        invokeWithId(
          acceptBudgetSuggestion,
          jsonRequest(
            `/api/v1/budgets/suggestions/${foreignKey}/accept`,
            "POST",
            {},
            `foreign-${randomUUID()}`,
          ),
          foreignKey,
        ),
      );
    },
  }),
  mutationContract({
    name: "POST /api/v1/budgets/suggestions/:id/dismiss",
    firstStatus: 200,
    prepare: async () => {
      const category = DISMISS_CATEGORIES[dismissCategoryIndex];
      dismissCategoryIndex += 1;
      if (!category) throw new Error("Falta categoría aislada para descartar");
      const suggestionKey = await seedSuggestion(owner, category);
      return {
        call: (key) =>
          invokeWithId(
            dismissBudgetSuggestion,
            jsonRequest(
              `/api/v1/budgets/suggestions/${encodeURIComponent(suggestionKey)}/dismiss`,
              "POST",
              {},
              key,
            ),
            suggestionKey,
          ),
        assert: (body) => {
          expect(record(record(body.data).decision).resolution).toBe(
            "dismissed",
          );
          expect(record(body.data).budget).toBeNull();
        },
      };
    },
    unauthorized: () =>
      invokeWithId(
        dismissBudgetSuggestion,
        jsonRequest(
          "/api/v1/budgets/suggestions/bs_ajena/dismiss",
          "POST",
          {},
          `auth-${randomUUID()}`,
        ),
        "bs_ajena",
      ),
    validation: () =>
      invokeWithId(
        dismissBudgetSuggestion,
        jsonRequest(
          "/api/v1/budgets/suggestions//dismiss",
          "POST",
          {},
          `invalid-${randomUUID()}`,
        ),
        "",
      ),
    isolation: async () => {
      const foreignKey = await seedSuggestion(intruder, "compras_personales");
      authenticateAs(owner);
      await expectNotFound(
        invokeWithId(
          dismissBudgetSuggestion,
          jsonRequest(
            `/api/v1/budgets/suggestions/${foreignKey}/dismiss`,
            "POST",
            {},
            `foreign-${randomUUID()}`,
          ),
          foreignKey,
        ),
      );
    },
  }),
];

const GOAL_MUTATION_CONTRACTS: EndpointContract[] = [
  mutationContract({
    name: "POST /api/v1/goals",
    firstStatus: 201,
    prepare: async () => {
      const name = `Meta route ${randomUUID().slice(0, 8)}`;
      return {
        call: (key) =>
          createGoal(
            jsonRequest(
              "/api/v1/goals",
              "POST",
              {
                name,
                target_amount: 1_250,
                target_date: "2099-12-31",
              },
              key,
            ),
          ),
        assert: (body) => {
          expect(record(record(body.data).goal)).toMatchObject({
            name,
            target_amount: 1_250,
            currency: "PEN",
          });
        },
      };
    },
    unauthorized: () =>
      createGoal(
        jsonRequest(
          "/api/v1/goals",
          "POST",
          {
            name: `Meta auth ${randomUUID().slice(0, 8)}`,
            target_amount: 500,
          },
          `auth-${randomUUID()}`,
        ),
      ),
    validation: () =>
      createGoal(
        jsonRequest(
          "/api/v1/goals",
          "POST",
          { name: "", target_amount: 0 },
          `invalid-${randomUUID()}`,
        ),
      ),
    isolation: async () => {
      const foreignBoxId = await seedBox(intruder, intruderAccountId);
      authenticateAs(owner);
      await expectNotFound(
        createGoal(
          jsonRequest(
            "/api/v1/goals",
            "POST",
            {
              name: `Meta caja ajena ${randomUUID().slice(0, 8)}`,
              target_amount: 900,
              target_date: "2099-12-31",
              box_id: foreignBoxId,
            },
            `foreign-${randomUUID()}`,
          ),
        ),
      );
    },
  }),
  mutationContract({
    name: "PATCH /api/v1/goals/:id",
    firstStatus: 200,
    prepare: async () => {
      const goal = await seedGoal(owner);
      const id = String(goal.id);
      return {
        call: (key) =>
          invokeWithId(
            updateGoal,
            jsonRequest(
              `/api/v1/goals/${id}`,
              "PATCH",
              { target_amount: 1_333 },
              key,
            ),
            id,
          ),
        assert: (body) => {
          expect(record(record(body.data).goal).target_amount).toBe(1_333);
        },
      };
    },
    unauthorized: () => {
      const id = randomUUID();
      return invokeWithId(
        updateGoal,
        jsonRequest(
          `/api/v1/goals/${id}`,
          "PATCH",
          { target_amount: 800 },
          `auth-${randomUUID()}`,
        ),
        id,
      );
    },
    validation: () => {
      const id = randomUUID();
      return invokeWithId(
        updateGoal,
        jsonRequest(
          `/api/v1/goals/${id}`,
          "PATCH",
          { target_amount: 0 },
          `invalid-${randomUUID()}`,
        ),
        id,
      );
    },
    isolation: async () => {
      const foreign = await seedGoal(intruder);
      const id = String(foreign.id);
      authenticateAs(owner);
      await expectNotFound(
        invokeWithId(
          updateGoal,
          jsonRequest(
            `/api/v1/goals/${id}`,
            "PATCH",
            { target_amount: 999 },
            `foreign-${randomUUID()}`,
          ),
          id,
        ),
      );
    },
  }),
  mutationContract({
    name: "DELETE /api/v1/goals/:id",
    firstStatus: 200,
    prepare: async () => {
      const goal = await seedGoal(owner);
      const id = String(goal.id);
      return {
        call: (key) =>
          invokeWithId(
            archiveGoal,
            jsonRequest(`/api/v1/goals/${id}`, "DELETE", {}, key),
            id,
          ),
        assert: (body) => {
          expect(record(record(body.data).goal).status).toBe("archivada");
        },
      };
    },
    unauthorized: () => {
      const id = randomUUID();
      return invokeWithId(
        archiveGoal,
        jsonRequest(
          `/api/v1/goals/${id}`,
          "DELETE",
          {},
          `auth-${randomUUID()}`,
        ),
        id,
      );
    },
    validation: () =>
      invokeWithId(
        archiveGoal,
        jsonRequest(
          "/api/v1/goals/no-es-uuid",
          "DELETE",
          {},
          `invalid-${randomUUID()}`,
        ),
        "no-es-uuid",
      ),
    isolation: async () => {
      const foreign = await seedGoal(intruder);
      const id = String(foreign.id);
      authenticateAs(owner);
      await expectNotFound(
        invokeWithId(
          archiveGoal,
          jsonRequest(
            `/api/v1/goals/${id}`,
            "DELETE",
            {},
            `foreign-${randomUUID()}`,
          ),
          id,
        ),
      );
    },
  }),
  goalStatusActionContract({
    name: "POST /api/v1/goals/:id/pause",
    handler: pauseGoal,
    expectedStatus: "pausada",
  }),
  goalStatusActionContract({
    name: "POST /api/v1/goals/:id/resume",
    handler: resumeGoal,
    sourceStatus: "pausada",
    expectedStatus: "activa",
  }),
  goalStatusActionContract({
    name: "POST /api/v1/goals/:id/restore",
    handler: restoreGoal,
    sourceStatus: "archivada",
    expectedStatus: "activa",
  }),
  mutationContract({
    name: "POST /api/v1/goals/:id/link-box",
    firstStatus: 200,
    prepare: async () => {
      const goal = await seedGoal(owner);
      const id = String(goal.id);
      const boxId = await seedBox(owner, ownerAccountId);
      return {
        call: (key) =>
          invokeWithId(
            linkGoalBox,
            jsonRequest(
              `/api/v1/goals/${id}/link-box`,
              "POST",
              { box_id: boxId },
              key,
            ),
            id,
          ),
        assert: (body) => {
          expect(record(record(body.data).goal).box_id).toBe(boxId);
        },
      };
    },
    unauthorized: () => {
      const id = randomUUID();
      return invokeWithId(
        linkGoalBox,
        jsonRequest(
          `/api/v1/goals/${id}/link-box`,
          "POST",
          { box_id: randomUUID() },
          `auth-${randomUUID()}`,
        ),
        id,
      );
    },
    validation: () => {
      const id = randomUUID();
      return invokeWithId(
        linkGoalBox,
        jsonRequest(
          `/api/v1/goals/${id}/link-box`,
          "POST",
          { box_id: "no-es-uuid" },
          `invalid-${randomUUID()}`,
        ),
        id,
      );
    },
    isolation: async () => {
      const goal = await seedGoal(owner);
      const id = String(goal.id);
      const foreignBoxId = await seedBox(intruder, intruderAccountId);
      authenticateAs(owner);
      await expectNotFound(
        invokeWithId(
          linkGoalBox,
          jsonRequest(
            `/api/v1/goals/${id}/link-box`,
            "POST",
            { box_id: foreignBoxId },
            `foreign-${randomUUID()}`,
          ),
          id,
        ),
      );
    },
  }),
  mutationContract({
    name: "POST /api/v1/goals/:id/unlink-box",
    firstStatus: 200,
    prepare: async () => {
      const boxId = await seedBox(owner, ownerAccountId);
      const goal = await seedGoal(owner, { boxId });
      const id = String(goal.id);
      return {
        call: (key) =>
          invokeWithId(
            unlinkGoalBox,
            jsonRequest(`/api/v1/goals/${id}/unlink-box`, "POST", {}, key),
            id,
          ),
        assert: (body) => {
          expect(record(record(body.data).goal).box_id).toBeNull();
        },
      };
    },
    unauthorized: () => {
      const id = randomUUID();
      return invokeWithId(
        unlinkGoalBox,
        jsonRequest(
          `/api/v1/goals/${id}/unlink-box`,
          "POST",
          {},
          `auth-${randomUUID()}`,
        ),
        id,
      );
    },
    validation: () => {
      const id = randomUUID();
      return invokeWithId(
        unlinkGoalBox,
        jsonRequest(
          `/api/v1/goals/${id}/unlink-box`,
          "POST",
          { campo_ajeno: true },
          `invalid-${randomUUID()}`,
        ),
        id,
      );
    },
    isolation: async () => {
      const foreignBoxId = await seedBox(intruder, intruderAccountId);
      const foreign = await seedGoal(intruder, { boxId: foreignBoxId });
      const id = String(foreign.id);
      authenticateAs(owner);
      await expectNotFound(
        invokeWithId(
          unlinkGoalBox,
          jsonRequest(
            `/api/v1/goals/${id}/unlink-box`,
            "POST",
            {},
            `foreign-${randomUUID()}`,
          ),
          id,
        ),
      );
    },
  }),
];

const CONTRACTS = [
  ...READ_CONTRACTS,
  ...BUDGET_MUTATION_CONTRACTS,
  ...GOAL_MUTATION_CONTRACTS,
];

describe.sequential(
  "W-12: handlers reales contra Supabase local (51 §6.2)",
  () => {
    it.each(CONTRACTS)("$name :: camino feliz y envelope", async (contract) => {
      await contract.happy();
    });

    it.each(CONTRACTS)("$name :: sin sesión devuelve 401", async (contract) => {
      authenticateAs(null);
      await expectAuthRequired(contract.unauthorized());
    });

    it.each(CONTRACTS)(
      "$name :: aislamiento real no filtra recursos ni agregados",
      async (contract) => {
        await contract.isolation();
      },
    );

    it.each(CONTRACTS)(
      "$name :: validación devuelve VALIDATION_ERROR en español",
      async (contract) => {
        authenticateAs(owner);
        await expectValidation(contract.validation());
      },
    );

    it.each(CONTRACTS)(
      "$name :: idempotencia real no duplica estado",
      async (contract) => {
        authenticateAs(owner);
        await contract.idempotency();
      },
    );
  },
);
