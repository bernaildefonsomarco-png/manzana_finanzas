import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailAdapter } from "@/adapters/email/contracts";
import { decryptEmailToken } from "@/adapters/email/token-crypto";

const mocks = vi.hoisted(() => ({
  commitGmailConnection: vi.fn(),
  disconnectGmailConnection: vi.fn(),
  listEmailConnectionsForUser: vi.fn(),
  listEmailConnectionsDueForWatchRenewal: vi.fn(),
  updateEmailConnectionState: vi.fn(),
}));

vi.mock("@/data/repositories/email.repository", async (original) => ({
  ...(await original()),
  ...mocks,
}));

import {
  completeGmailOAuth,
  disconnectGmail,
} from "./email-connection";

const key = Buffer.alloc(32, 7).toString("base64");
const configuration = {
  clientId: "client",
  clientSecret: "secret",
  redirectUri: "https://manzana.website/api/v1/email/oauth/callback",
  topicName: "projects/manzana/topics/gmail",
  tokenEncryptionKey: key,
  pubsubAudience: "https://manzana.website/api/webhooks/gmail-pubsub",
  pubsubServiceAccount: "push@project.iam.gserviceaccount.com",
};

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
});

describe("email connection", () => {
  it("conecta con readonly, cifra el refresh token y activa watch", async () => {
    const adapter = fakeAdapter();
    const persisted = { id: "connection-1" };
    mocks.commitGmailConnection.mockResolvedValue(persisted);

    await expect(
      completeGmailOAuth({
        client: {} as never,
        userId: "11111111-1111-4111-8111-111111111111",
        code: "oauth-code",
        traceId: "22222222-2222-4222-8222-222222222222",
        adapter,
        configuration,
      }),
    ).resolves.toBe(persisted);

    const saved = mocks.commitGmailConnection.mock.calls[0]?.[1];
    expect(saved.encryptedRefreshToken).not.toContain("refresh-secret");
    expect(decryptEmailToken(saved.encryptedRefreshToken, key)).toBe(
      "refresh-secret",
    );
    expect(saved.emailAddress).toBe("user@gmail.com");
    expect(saved.historyId).toBe("456");
  });

  it("rechaza OAuth sin refresh token antes de persistir", async () => {
    const adapter = fakeAdapter();
    vi.mocked(adapter.exchangeAuthorizationCode).mockResolvedValue({
      accessToken: "access",
      refreshToken: null,
      expiresIn: 3600,
      scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
    });

    await expect(
      completeGmailOAuth({
        client: {} as never,
        userId: "user",
        code: "code",
        traceId: "trace",
        adapter,
        configuration,
      }),
    ).rejects.toMatchObject({ code: "GMAIL_REFRESH_TOKEN_REQUIRED" });
    expect(mocks.commitGmailConnection).not.toHaveBeenCalled();
  });

  it("borra el token local aunque falle la revocacion remota", async () => {
    const adapter = fakeAdapter();
    vi.mocked(adapter.stopWatch).mockRejectedValue(new Error("remote down"));
    const { encryptEmailToken } = await import("@/adapters/email/token-crypto");
    mocks.listEmailConnectionsForUser.mockResolvedValue([{
      id: "connection-1",
      user_id: "user",
      encrypted_refresh_token: encryptEmailToken("refresh-secret", key),
    }]);
    mocks.disconnectGmailConnection.mockResolvedValue({ changed: true });

    await disconnectGmail({
      client: {} as never,
      userId: "user",
      traceId: "trace",
      adapter,
      configuration,
    });

    expect(mocks.disconnectGmailConnection).toHaveBeenCalledWith(
      {},
      "user",
      "trace",
      undefined,
    );
  });
});

function fakeAdapter(): EmailAdapter {
  return {
    buildAuthorizationUrl: vi.fn(() => "https://accounts.google.com"),
    exchangeAuthorizationCode: vi.fn(async () => ({
      accessToken: "access",
      refreshToken: "refresh-secret",
      expiresIn: 3600,
      scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
    })),
    refreshAccessToken: vi.fn(async () => "access"),
    getProfile: vi.fn(async () => ({
      emailAddress: "User@Gmail.com",
      historyId: "123",
    })),
    startWatch: vi.fn(async () => ({
      historyId: "456",
      expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })),
    stopWatch: vi.fn(async () => undefined),
    revokeToken: vi.fn(async () => undefined),
    listHistory: vi.fn(),
    listRecentMessages: vi.fn(),
    getMessageMetadata: vi.fn(),
    getMessageContent: vi.fn(),
  };
}
