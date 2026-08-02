import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as POST_SEEN } from "./seen/route";
import { POST as POST_DISMISS } from "./dismiss/route";
import { POST as POST_ACTION } from "./action/route";
import { POST as POST_FEEDBACK } from "./feedback/route";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  assertSystemActionAllowed: vi.fn(),
  commitInsightInteraction: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/core/risk/system-action-gate", () => ({ assertSystemActionAllowed: mocks.assertSystemActionAllowed }));
vi.mock("@/data/repositories/insights.repository", () => ({
  commitInsightInteraction: mocks.commitInsightInteraction,
  InsightOperationError: class InsightOperationError extends Error {},
  toPublicInsight: (insight: unknown) => insight,
}));

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "user-1" });
  mocks.commitInsightInteraction.mockResolvedValue({
    insight: { id: insightId, status: "displayed" },
    idempotent: false,
  });
});

const cases = [
  { name: "seen", post: POST_SEEN, body: undefined, operation: "seen", invalidBody: undefined },
  { name: "dismiss", post: POST_DISMISS, body: { reason: "No me sirve ahora" }, operation: "dismiss", invalidBody: { extra: true } },
  { name: "action", post: POST_ACTION, body: { action_key: "view_movements" }, operation: "acted", invalidBody: { extra: true } },
  { name: "feedback", post: POST_FEEDBACK, body: { value: "util" }, operation: "feedback", invalidBody: { value: "tal_vez" } },
] as const;

describe.each(cases)("POST /insights/[id]/$name", ({ post, body, operation, invalidBody }) => {
  it("camino feliz registra solo experiencia y nunca dinero", async () => {
    const response = await post(request(body), context());
    expect(response.status).toBe(200);
    expect(mocks.commitInsightInteraction).toHaveBeenCalledWith(
      {},
      "user-1",
      expect.objectContaining({
        insightId,
        operation,
        idempotencyKey: "insight-test-key",
      }),
    );
  });

  it("sin sesion devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await post(request(body), context())).status).toBe(401);
    expect(mocks.commitInsightInteraction).not.toHaveBeenCalled();
  });

  it("recurso de otro usuario devuelve 404 y nunca 403", async () => {
    mocks.commitInsightInteraction.mockResolvedValue(null);
    expect((await post(request(body), context())).status).toBe(404);
  });

  it("error de validacion no muta", async () => {
    const response = invalidBody === undefined
      ? await post(request(body, false), context())
      : await post(request(invalidBody), context());
    expect(response.status).toBe(400);
    expect(mocks.commitInsightInteraction).not.toHaveBeenCalled();
  });

  it("replay idempotente se anuncia y devuelve el mismo dominio", async () => {
    mocks.commitInsightInteraction.mockResolvedValue({
      insight: { id: insightId, status: "displayed" },
      idempotent: true,
    });
    const response = await post(request(body), context());
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.meta.idempotent_replay).toBe(true);
    expect(payload.data.insight.id).toBe(insightId);
  });
});

const insightId = "11111111-1111-4111-8111-111111111111";
function request(body?: Record<string, unknown>, includeKey = true) {
  return new Request(`http://localhost/api/v1/insights/${insightId}`, {
    method: "POST",
    headers: {
      ...(includeKey ? { "Idempotency-Key": "insight-test-key" } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
function context() { return { params: Promise.resolve({ id: insightId }) }; }
