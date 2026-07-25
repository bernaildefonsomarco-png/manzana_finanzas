import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  createServiceClient: vi.fn(() => ({})),
  exportUserData: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock("@/data/repositories/privacy.repository", async (original) => ({
  ...(await original()),
  exportUserData: mocks.exportUserData,
}));

import { GET } from "./route";

beforeEach(() => {
  mocks.getApiAuth.mockReset();
  mocks.exportUserData.mockReset();
  mocks.getApiAuth.mockResolvedValue({ userId: "user-1", client: {} });
  mocks.exportUserData.mockResolvedValue({
    schema_version: "manzana_user_export_v2",
    generated_at: "2026-07-23T00:00:00.000Z",
    profile: null,
    preferences: null,
    accounts: [],
    boxes: [],
    movements: [],
    debts: [],
    debt_payments: [],
    recurring_rules: [],
    recurring_occurrences: [],
    custom_subcategories: [],
    custom_tags: [],
    active_pending_items: [],
    nudge_preferences: [],
    learning_preferences: null,
    financial_memory: [],
    learning_candidates: [],
    learning_evidence: [],
    learning_history: [],
    conversation_memory: [],
    source_summary: { gmail: [], whatsapp_linked: false },
  });
});

describe("privacy export route", () => {
  it("entrega un JSON descargable sin secretos tecnicos", async () => {
    const response = await GET(
      new Request("http://localhost/api/v1/privacy/export"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toContain(
      "manzana-datos-2026-07-23.json",
    );
    const payload = await response.json();
    expect(payload.schema_version).toBe("manzana_user_export_v2");
    expect(JSON.stringify(payload)).not.toMatch(/refresh_token|access_token/i);
    expect(mocks.exportUserData).toHaveBeenCalledWith({}, "user-1");
  });

  it("rechaza exportar sin sesion", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const response = await GET(
      new Request("http://localhost/api/v1/privacy/export"),
    );
    expect(response.status).toBe(401);
    expect(mocks.exportUserData).not.toHaveBeenCalled();
  });
});
