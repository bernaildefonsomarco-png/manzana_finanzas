import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));

const movementId = "00000000-0000-4000-8000-000000000001";
const userId = "11111111-1111-4111-8111-111111111111";

/** Mock encadenable minimo del query builder, con una tabla por `.from()`. */
function fakeClient(tables: Record<string, { rows: unknown[]; single?: unknown }>) {
  const builders: Record<string, Record<string, unknown>> = {};

  for (const [table, config] of Object.entries(tables)) {
    const builder: Record<string, unknown> = {};
    const chainMethods = ["select", "eq", "order", "or"];
    for (const method of chainMethods) {
      builder[method] = vi.fn(() => builder);
    }
    builder.limit = vi.fn((n: number) => {
      builder._lastLimit = n;
      return builder;
    });
    builder.maybeSingle = vi.fn(async () => ({
      data: config.single ?? null,
      error: null,
    }));
    builder.then = (resolve: (value: { data: unknown[]; error: null }) => void) =>
      resolve({
        data: config.rows.slice(0, (builder._lastLimit as number) ?? config.rows.length),
        error: null,
      });
    builders[table] = builder;
  }

  return {
    from: vi.fn((table: string) => builders[table]),
  };
}

function auditLogRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: overrides.id ?? "audit-1",
    user_id: userId,
    movement_id: movementId,
    entity_type: "movement",
    entity_id: movementId,
    action: "created",
    field_name: null,
    old_value: null,
    new_value: { amount: 40 },
    source: "dashboard_manual",
    actor_type: "user",
    actor_id: userId,
    trace_id: "trace-1",
    created_at: "2026-07-14T10:00:00Z",
    metadata: {},
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/v1/movements/[id]/history", () => {
  it("camino feliz: devuelve el historial del movimiento propio", async () => {
    mocks.getApiAuth.mockResolvedValue({
      client: fakeClient({
        movements: { rows: [], single: { id: movementId } },
        movement_audit_log: { rows: [auditLogRow()] },
      }),
      userId,
    });
    const { GET } = await import("./route");

    const response = await GET(
      new Request(`http://localhost/api/v1/movements/${movementId}/history`),
      { params: Promise.resolve({ id: movementId }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.history).toHaveLength(1);
    expect(payload.data.history[0].action).toBe("created");
  });

  it("sin sesion: responde 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET(
      new Request(`http://localhost/api/v1/movements/${movementId}/history`),
      { params: Promise.resolve({ id: movementId }) },
    );

    expect(response.status).toBe(401);
  });

  it("recurso de otro usuario: responde 404, nunca 403", async () => {
    mocks.getApiAuth.mockResolvedValue({
      client: fakeClient({
        movements: { rows: [], single: null },
        movement_audit_log: { rows: [auditLogRow()] },
      }),
      userId,
    });
    const { GET } = await import("./route");

    const response = await GET(
      new Request(`http://localhost/api/v1/movements/${movementId}/history`),
      { params: Promise.resolve({ id: movementId }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe("NOT_FOUND");
  });

  it("validacion: un cursor corrupto devuelve VALIDATION_ERROR", async () => {
    mocks.getApiAuth.mockResolvedValue({
      client: fakeClient({
        movements: { rows: [], single: { id: movementId } },
        movement_audit_log: { rows: [] },
      }),
      userId,
    });
    const { GET } = await import("./route");

    const response = await GET(
      new Request(
        `http://localhost/api/v1/movements/${movementId}/history?cursor=no-valido-@@@`,
      ),
      { params: Promise.resolve({ id: movementId }) },
    );

    expect(response.status).toBe(400);
  });

  it("se pagina: pide limit+1 y no trae el historial completo de una vez", async () => {
    const rows = Array.from({ length: 3 }, (_, i) =>
      auditLogRow({ id: `audit-${i}`, created_at: `2026-07-${20 - i}T10:00:00Z` }),
    );
    mocks.getApiAuth.mockResolvedValue({
      client: fakeClient({
        movements: { rows: [], single: { id: movementId } },
        movement_audit_log: { rows },
      }),
      userId,
    });
    const { GET } = await import("./route");

    const response = await GET(
      new Request(
        `http://localhost/api/v1/movements/${movementId}/history?limit=2`,
      ),
      { params: Promise.resolve({ id: movementId }) },
    );
    const payload = await response.json();

    expect(payload.data.history).toHaveLength(2);
    expect(payload.meta.page.has_more).toBe(true);
  });
});
