import { describe, expect, it, vi } from "vitest";
import { verifyGmailPubSubRequest } from "./pubsub-auth";

const configuration = {
  clientId: "client",
  clientSecret: "secret",
  redirectUri: "https://manzana.website/api/v1/email/oauth/callback",
  topicName: "projects/manzana/topics/gmail",
  tokenEncryptionKey: "key",
  pubsubAudience: "https://manzana.website/api/webhooks/gmail-pubsub",
  pubsubServiceAccount: "push@manzana.iam.gserviceaccount.com",
};

describe("verifyGmailPubSubRequest", () => {
  it("acepta solo el audience y service account esperados", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        aud: configuration.pubsubAudience,
        email: configuration.pubsubServiceAccount,
        email_verified: "true",
        exp: "1900000000",
        iss: "https://accounts.google.com",
      }),
    );
    const request = new Request(configuration.pubsubAudience, {
      headers: { Authorization: "Bearer signed-token" },
    });

    await expect(
      verifyGmailPubSubRequest(request, {
        configuration,
        fetcher,
        now: new Date("2026-01-01T00:00:00Z"),
      }),
    ).resolves.toEqual({
      serviceAccount: configuration.pubsubServiceAccount,
    });
    expect(String(fetcher.mock.calls[0]?.[0])).not.toContain("signed-token" + "&");
  });

  it.each([
    ["audience", { aud: "https://attacker.invalid" }],
    ["email", { email: "other@manzana.iam.gserviceaccount.com" }],
    ["verification", { email_verified: "false" }],
    ["expiration", { exp: "1" }],
  ])("rechaza claims invalidos: %s", async (_label, override) => {
    const request = new Request(configuration.pubsubAudience, {
      headers: { Authorization: "Bearer token" },
    });
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        aud: configuration.pubsubAudience,
        email: configuration.pubsubServiceAccount,
        email_verified: "true",
        exp: "1900000000",
        iss: "accounts.google.com",
        ...override,
      }),
    );

    await expect(
      verifyGmailPubSubRequest(request, {
        configuration,
        fetcher,
        now: new Date("2026-01-01T00:00:00Z"),
      }),
    ).rejects.toMatchObject({ code: "GMAIL_PUBSUB_TOKEN_INVALID" });
  });

  it("falla cerrado sin Bearer token", async () => {
    await expect(
      verifyGmailPubSubRequest(new Request(configuration.pubsubAudience), {
        configuration,
      }),
    ).rejects.toMatchObject({ code: "GMAIL_PUBSUB_AUTH_REQUIRED" });
  });
});

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
  });
}
