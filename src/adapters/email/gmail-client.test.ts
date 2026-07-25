import { describe, expect, it, vi } from "vitest";
import { GMAIL_READONLY_SCOPE } from "./contracts";
import { GmailClientError, GmailEmailAdapter } from "./gmail-client";

const configuration = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "https://manzana.website/api/v1/email/oauth/callback",
  topicName: "projects/manzana/topics/gmail",
  tokenEncryptionKey: "unused",
  pubsubAudience: "https://manzana.website/api/webhooks/gmail-pubsub",
  pubsubServiceAccount: "pubsub@manzana.iam.gserviceaccount.com",
};

describe("GmailEmailAdapter", () => {
  it("construye OAuth con scope minimo, offline y state", () => {
    const adapter = new GmailEmailAdapter(configuration, vi.fn() as never);
    const url = new URL(adapter.buildAuthorizationUrl({ state: "state-123" }));

    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("scope")).toBe(GMAIL_READONLY_SCOPE);
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("state")).toBe("state-123");
    expect(url.searchParams.get("redirect_uri")).toBe(configuration.redirectUri);
  });

  it("intercambia code sin exponer secretos en la respuesta", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        scope: GMAIL_READONLY_SCOPE,
      }),
    );
    const adapter = new GmailEmailAdapter(configuration, fetcher);

    await expect(adapter.exchangeAuthorizationCode("code")).resolves.toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 3600,
      scopes: [GMAIL_READONLY_SCOPE],
    });
    expect(String(fetcher.mock.calls[0]?.[1]?.body)).toContain(
      "client_secret=client-secret",
    );
  });

  it("inicia watch solo para INBOX y topic configurado", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({ historyId: "123", expiration: "1893456000000" }),
    );
    const adapter = new GmailEmailAdapter(configuration, fetcher);

    await expect(adapter.startWatch("access")).resolves.toEqual({
      historyId: "123",
      expiration: "1893456000000",
    });
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      topicName: configuration.topicName,
      labelIds: ["INBOX"],
      labelFilterBehavior: "INCLUDE",
    });
  });

  it("convierte un 404 de History API en checkpoint expirado", async () => {
    const adapter = new GmailEmailAdapter(
      configuration,
      vi.fn().mockResolvedValue(jsonResponse({}, 404)),
    );

    await expect(
      adapter.listHistory({ accessToken: "access", startHistoryId: "1" }),
    ).rejects.toMatchObject({ code: "GMAIL_HISTORY_EXPIRED" });
  });

  it("limita el backfill a INBOX y 30 dias", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({ messages: [{ id: "m1", threadId: "t1" }] }),
    );
    const adapter = new GmailEmailAdapter(configuration, fetcher);

    await expect(
      adapter.listRecentMessages({ accessToken: "access", newerThanDays: 90 }),
    ).resolves.toEqual({
      messageIds: [{ id: "m1", threadId: "t1" }],
      nextPageToken: null,
    });
    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(url.searchParams.get("q")).toBe("newer_than:30d");
    expect(url.searchParams.get("labelIds")).toBe("INBOX");
    expect(url.searchParams.get("includeSpamTrash")).toBe("false");
  });

  it("pide Authentication-Results junto con metadata antes del cuerpo", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        id: "message-1",
        threadId: "thread-1",
        internalDate: "1784541600000",
        payload: { mimeType: "text/plain", headers: [] },
      }),
    );
    const adapter = new GmailEmailAdapter(configuration, fetcher);

    await adapter.getMessageMetadata("access", "message-1");

    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(url.searchParams.get("format")).toBe("metadata");
    expect(url.searchParams.getAll("metadataHeaders")).toEqual([
      "From",
      "Subject",
      "Date",
      "Authentication-Results",
    ]);
  });

  it("falla cerrado cuando faltan credenciales", () => {
    const adapter = new GmailEmailAdapter(
      { ...configuration, clientId: "" },
      vi.fn() as never,
    );
    expect(() => adapter.buildAuthorizationUrl({ state: "state" })).toThrow(
      GmailClientError,
    );
  });
});

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
