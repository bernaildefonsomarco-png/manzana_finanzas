import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as POST_MUTE } from "./route";
import { POST as POST_UNMUTE } from "../unmute/route";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  setInsightTypeMuted: vi.fn(),
}));
vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/insights.repository", () => ({
  InsightOperationError: class InsightOperationError extends Error {},
  setInsightTypeMuted: mocks.setInsightTypeMuted,
}));

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "user-1" });
  mocks.setInsightTypeMuted.mockResolvedValue({ preference: { muted: true }, idempotent: false });
});

describe.each([
  ["mute", POST_MUTE, true],
  ["unmute", POST_UNMUTE, false],
] as const)("POST /insights/types/[type]/%s", (_name, post, muted) => {
  it("camino feliz guarda la preferencia", async () => {
    expect((await post(request(), context())).status).toBe(200);
    expect(mocks.setInsightTypeMuted).toHaveBeenCalledWith({}, "user-1", expect.objectContaining({ type: "anomaly", muted }));
  });
  it("sin sesion devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await post(request(), context())).status).toBe(401);
  });
  it("aisla la escritura por el usuario autenticado", async () => {
    await post(request(), context());
    expect(mocks.setInsightTypeMuted).toHaveBeenCalledWith(expect.anything(), "user-1", expect.anything());
  });
  it("tipo desconocido o Idempotency-Key ausente devuelve 400", async () => {
    expect((await post(request(), { params: Promise.resolve({ type: "inventado" }) })).status).toBe(400);
    expect((await post(request(false), context())).status).toBe(400);
  });
  it("replay idempotente se anuncia", async () => {
    mocks.setInsightTypeMuted.mockResolvedValue({ preference: { muted }, idempotent: true });
    const payload = await (await post(request(), context())).json();
    expect(payload.meta.idempotent_replay).toBe(true);
  });
});

function request(includeKey = true) {
  return new Request("http://localhost/api/v1/insights/types/anomaly/mute", {
    method: "POST",
    headers: includeKey ? { "Idempotency-Key": "insight-mute-key" } : {},
  });
}
function context() { return { params: Promise.resolve({ type: "anomaly" }) }; }
