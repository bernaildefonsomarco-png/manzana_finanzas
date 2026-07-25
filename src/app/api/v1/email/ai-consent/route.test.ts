import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  createServiceClient: vi.fn(() => ({})),
  updateEmailAiExtractionConsent: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({
  getApiAuth: mocks.getApiAuth,
}));
vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock("@/data/repositories/email.repository", async (original) => ({
  ...(await original()),
  updateEmailAiExtractionConsent:
    mocks.updateEmailAiExtractionConsent,
}));

import { PUT } from "./route";

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.createServiceClient.mockReturnValue({});
  mocks.getApiAuth.mockResolvedValue({ userId: "user-1" });
  mocks.updateEmailAiExtractionConsent.mockResolvedValue({
    enabled: true,
    version: "email_ai_extraction_v1",
    updated_at: "2026-07-23T08:30:00.000Z",
  });
});

describe("email ai consent route", () => {
  it("guarda consentimiento explicito y versionado", async () => {
    const response = await PUT(
      new Request("http://localhost/api/v1/email/ai-consent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connection_id: "11111111-1111-4111-8111-111111111111",
          enabled: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateEmailAiExtractionConsent).toHaveBeenCalledWith(
      {},
      {
        userId: "user-1",
        connectionId: "11111111-1111-4111-8111-111111111111",
        enabled: true,
      },
    );
    await expect(response.json()).resolves.toMatchObject({
      data: {
        consent: {
          enabled: true,
          version: "email_ai_extraction_v1",
        },
      },
    });
  });

  it("rechaza acceso sin sesion", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const response = await PUT(
      new Request("http://localhost/api/v1/email/ai-consent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      }),
    );
    expect(response.status).toBe(401);
    expect(
      mocks.updateEmailAiExtractionConsent,
    ).not.toHaveBeenCalled();
  });
});
