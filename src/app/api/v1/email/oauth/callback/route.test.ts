import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  completeGmailOAuth: vi.fn(),
  createServiceClient: vi.fn(() => ({ service: true })),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/core/email/email-connection", () => ({
  completeGmailOAuth: mocks.completeGmailOAuth,
}));
vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));

import { GET } from "./route";

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockClear());
  mocks.getApiAuth.mockResolvedValue({ userId: "user-1", client: {} });
  mocks.completeGmailOAuth.mockResolvedValue({ id: "connection-1" });
});

describe("GET Gmail OAuth callback", () => {
  it("acepta state coincidente, conecta y destruye la cookie", async () => {
    const request = callbackRequest("state-1", "state-1");
    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("email=connected");
    expect(response.headers.get("set-cookie")).toContain(
      "manzana_gmail_oauth_state=",
    );
    expect(mocks.completeGmailOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        client: { service: true },
        userId: "user-1",
        code: "oauth-code",
      }),
    );
  });

  it("rechaza state distinto sin intercambiar el code", async () => {
    const response = await GET(callbackRequest("attacker", "expected"));
    expect(response.headers.get("location")).toContain("email=error");
    expect(response.headers.get("location")).toContain("state_invalid");
    expect(mocks.completeGmailOAuth).not.toHaveBeenCalled();
  });

  it("rechaza callback sin sesion", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const response = await GET(callbackRequest("state-1", "state-1"));
    expect(response.headers.get("location")).toContain("auth_required");
    expect(mocks.completeGmailOAuth).not.toHaveBeenCalled();
  });
});

function callbackRequest(state: string, cookie: string) {
  return new NextRequest(
    `https://manzana.website/api/v1/email/oauth/callback?code=oauth-code&state=${state}`,
    { headers: { Cookie: `manzana_gmail_oauth_state=${cookie}` } },
  );
}
