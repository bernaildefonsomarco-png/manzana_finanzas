import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  admin,
  crearUsuarioDePrueba,
  limpiarUsuariosDePrueba,
  type UsuarioDePrueba,
} from "./lib/entorno";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  getApiAuth: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({
  getApiAuth: mocks.getApiAuth,
}));
vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));

import { GET } from "@/app/api/v1/privacy/export/route";

let owner: UsuarioDePrueba;
let intruder: UsuarioDePrueba;
let ownerBudgetId: string;
let intruderBudgetId: string;
let ownerGoalId: string;

beforeAll(async () => {
  owner = await crearUsuarioDePrueba("w12-export-owner");
  intruder = await crearUsuarioDePrueba("w12-export-intruder");
  ownerBudgetId = randomUUID();
  intruderBudgetId = randomUUID();
  ownerGoalId = randomUUID();

  for (const row of [
    budgetRow(ownerBudgetId, owner.id),
    budgetRow(intruderBudgetId, intruder.id),
  ]) {
    const inserted = await admin.from("budgets").insert(row);
    expect(inserted.error).toBeNull();
  }
  const goalInsert = await admin.from("goals").insert({
    id: ownerGoalId,
    user_id: owner.id,
    name: "Meta exportable",
    target_amount: 900,
    currency: "PEN",
    status: "activa",
  });
  const snapshotInsert = await admin.from("budget_progress_snapshots").insert({
    user_id: owner.id,
    budget_id: ownerBudgetId,
    as_of: "2028-07-15",
    spent: 150,
    remaining: 150,
    pct: 0.5,
  });
  const decisionInsert = await admin
    .from("budget_suggestion_decisions")
    .insert({
      user_id: owner.id,
      suggestion_key: `export-${randomUUID()}`,
      category_id: "alimentacion",
      period_kind: "mensual",
      evidence_start: "2028-04-01",
      evidence_end: "2028-06-30",
      evidence: [{ period_start: "2028-06-01", spent: 300 }],
      proposed_amount: 300,
      resolution: "accepted",
      idempotency_key: `export-${randomUUID()}`,
      request_hash: "hash-export-w12",
      budget_id: ownerBudgetId,
      result: { budget_id: ownerBudgetId },
    });
  expect(goalInsert.error).toBeNull();
  expect(snapshotInsert.error).toBeNull();
  expect(decisionInsert.error).toBeNull();
});

beforeEach(() => {
  mocks.createServiceClient.mockReset();
  mocks.getApiAuth.mockReset();
  mocks.createServiceClient.mockReturnValue(admin);
  mocks.getApiAuth.mockResolvedValue({
    client: owner.client,
    userId: owner.id,
  });
});

afterAll(async () => {
  await limpiarUsuariosDePrueba();
});

describe("GET /api/v1/privacy/export con datos W-12", () => {
  it("camino feliz: descarga los cuatro bloques nuevos", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(
      "manzana-datos-",
    );
    const payload = await response.json();
    expect(payload.budgets).toEqual([
      expect.objectContaining({ id: ownerBudgetId }),
    ]);
    expect(payload.goals).toEqual([
      expect.objectContaining({ id: ownerGoalId }),
    ]);
    expect(payload.budget_progress_snapshots).toHaveLength(1);
    expect(payload.budget_suggestion_decisions).toHaveLength(1);
  });

  it("sin sesión: responde 401 sin consultar con service-role", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it("aislamiento: una exportación propia no filtra filas de otro usuario", async () => {
    const payload = await (await GET(request())).json();
    expect(payload.budgets.map((row: { id: string }) => row.id)).toEqual([
      ownerBudgetId,
    ]);
    expect(JSON.stringify(payload)).not.toContain(intruderBudgetId);
  });

  it("validación: rechaza parámetros desconocidos con mensaje en español", async () => {
    const response = await GET(request("?usuario=otro"));
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.code).toBe("VALIDATION_ERROR");
    expect(payload.error.message).toMatch(/parámetros|parametros/i);
  });

  it("idempotencia de lectura: repetir no crea ni altera datos", async () => {
    const before = await ownRows();
    const first = await (await GET(request())).json();
    const second = await (await GET(request())).json();
    const after = await ownRows();
    delete first.generated_at;
    delete second.generated_at;
    expect(second).toEqual(first);
    expect(after).toEqual(before);
  });
});

function request(query = "") {
  return new Request(`http://localhost/api/v1/privacy/export${query}`);
}

function budgetRow(id: string, userId: string) {
  return {
    id,
    user_id: userId,
    category_id: "alimentacion",
    currency: "PEN",
    period_kind: "mensual" as const,
    period_start: "2028-07-01",
    period_end: "2028-07-31",
    base_amount: 300,
    rollover_amount: 0,
    amount: 300,
    kind: "presupuesto" as const,
    rollover: false,
    auto_renew: true,
    source: "manual" as const,
    status: "activo" as const,
  };
}

async function ownRows() {
  const [budget, goal, snapshots, decisions] = await Promise.all([
    admin.from("budgets").select("*").eq("id", ownerBudgetId),
    admin.from("goals").select("*").eq("id", ownerGoalId),
    admin
      .from("budget_progress_snapshots")
      .select("*")
      .eq("budget_id", ownerBudgetId),
    admin
      .from("budget_suggestion_decisions")
      .select("*")
      .eq("budget_id", ownerBudgetId),
  ]);
  for (const result of [budget, goal, snapshots, decisions]) {
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
  }
  return {
    budget: budget.data,
    goal: goal.data,
    snapshots: snapshots.data,
    decisions: decisions.data,
  };
}
