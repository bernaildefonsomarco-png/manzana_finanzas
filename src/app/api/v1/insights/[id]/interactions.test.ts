import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as POST_SEEN } from "./seen/route";
import { POST as POST_DISMISS } from "./dismiss/route";
import { POST as POST_ACTION } from "./action/route";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  createServiceClient: vi.fn(),
  assertSystemActionAllowed: vi.fn(),
  recordInsightSeen: vi.fn(),
  dismissInsight: vi.fn(),
  recordInsightAction: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock("@/core/risk/system-action-gate", () => ({
  assertSystemActionAllowed: mocks.assertSystemActionAllowed,
}));
vi.mock("@/data/repositories/insights.repository", () => ({
  recordInsightSeen: mocks.recordInsightSeen,
  dismissInsight: mocks.dismissInsight,
  recordInsightAction: mocks.recordInsightAction,
}));

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.createServiceClient.mockReturnValue({ service: true });
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "user-1" });
});

describe("insight interaction routes", () => {
  it("marca visto sin ejecutar una accion financiera", async () => {
    mocks.recordInsightSeen.mockResolvedValue({ id: insightId, status: "displayed" });
    const response = await POST_SEEN(request("/seen"), context());
    expect(response.status).toBe(200);
    expect(mocks.assertSystemActionAllowed).toHaveBeenCalledWith(
      expect.objectContaining({ actionKind: "experience_feedback" }),
    );
    expect(mocks.recordInsightSeen).toHaveBeenCalled();
  });

  it("registra descarte con motivo", async () => {
    mocks.dismissInsight.mockResolvedValue({ id: insightId, status: "dismissed" });
    const response = await POST_DISMISS(
      request("/dismiss", { reason: "No me sirve ahora" }),
      context(),
    );
    expect(response.status).toBe(200);
    expect(mocks.dismissInsight).toHaveBeenCalledWith(
      { service: true },
      "user-1",
      insightId,
      expect.objectContaining({ reason: "No me sirve ahora" }),
    );
  });

  it("registra el CTA pero no ejecuta dinero", async () => {
    mocks.recordInsightAction.mockResolvedValue({ id: insightId, status: "acted" });
    const response = await POST_ACTION(
      request("/action", { action_key: "view_movements" }),
      context(),
    );
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data.note).toContain("Core");
    expect(mocks.recordInsightAction).toHaveBeenCalledWith(
      { service: true },
      "user-1",
      insightId,
      expect.objectContaining({ actionKey: "view_movements" }),
    );
  });

  it("responde 404 si el descubrimiento no pertenece al usuario", async () => {
    mocks.dismissInsight.mockResolvedValue(null);
    const response = await POST_DISMISS(request("/dismiss", {}), context());
    expect(response.status).toBe(404);
  });

  it("rechaza feedback sin sesion", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const response = await POST_SEEN(request("/seen"), context());
    expect(response.status).toBe(401);
    expect(mocks.recordInsightSeen).not.toHaveBeenCalled();
  });
});

const insightId = "11111111-1111-4111-8111-111111111111";
function request(path: string, body?: Record<string, unknown>) {
  return new Request(`http://localhost/api/v1/insights/${insightId}${path}`, {
    method: "POST",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}
function context() {
  return { params: Promise.resolve({ id: insightId }) };
}
