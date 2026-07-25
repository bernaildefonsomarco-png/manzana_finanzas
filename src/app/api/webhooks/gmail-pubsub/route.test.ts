import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyGmailPubSubRequest: vi.fn(),
  enqueueGmailHistoryNotification: vi.fn(),
  createServiceClient: vi.fn(() => ({ service: true })),
}));

vi.mock("@/adapters/email/pubsub-auth", async (original) => ({
  ...(await original()),
  verifyGmailPubSubRequest: mocks.verifyGmailPubSubRequest,
}));
vi.mock("@/data/repositories/email.repository", () => ({
  enqueueGmailHistoryNotification: mocks.enqueueGmailHistoryNotification,
}));
vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));

import { GmailPubSubAuthError } from "@/adapters/email/pubsub-auth";
import { POST } from "./route";

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockClear());
  mocks.verifyGmailPubSubRequest.mockResolvedValue({
    serviceAccount: "push@project.iam.gserviceaccount.com",
  });
  mocks.enqueueGmailHistoryNotification.mockResolvedValue({
    accepted: true,
    duplicate: false,
    reason: "enqueued",
  });
});

describe("POST Gmail Pub/Sub", () => {
  it("valida OIDC y encola metadata minima", async () => {
    const response = await POST(pubsubRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({ accepted: true, duplicate: false });
    expect(mocks.enqueueGmailHistoryNotification).toHaveBeenCalledWith(
      { service: true },
      expect.objectContaining({
        emailAddress: "user@gmail.com",
        pubsubMessageId: "pubsub-1",
        historyId: "12345",
      }),
    );
    const persisted = mocks.enqueueGmailHistoryNotification.mock.calls[0]?.[1];
    expect(persisted).not.toHaveProperty("data");
    expect(persisted.payloadHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("reconoce reintento idempotente", async () => {
    mocks.enqueueGmailHistoryNotification.mockResolvedValue({
      accepted: true,
      duplicate: true,
      reason: "already_enqueued",
    });
    const response = await POST(pubsubRequest());
    expect(response.status).toBe(200);
    expect((await response.json()).data.duplicate).toBe(true);
  });

  it("acepta el envelope v1 completo que entrega Pub/Sub", async () => {
    const body = {
      deliveryAttempt: 2,
      message: {
        attributes: { source: "gmail-api" },
        data: Buffer.from(
          JSON.stringify({
            emailAddress: "User@Gmail.com",
            historyId: "12346",
          }),
        ).toString("base64"),
        messageId: "pubsub-v1",
        message_id: "pubsub-v1",
        orderingKey: "",
        publishTime: "2026-07-22T15:00:00.000Z",
        publish_time: "2026-07-22T15:00:00.000Z",
      },
      subscription: "projects/manzana/subscriptions/gmail",
    };
    const response = await POST(
      new Request("https://manzana.website/api/webhooks/gmail-pubsub", {
        method: "POST",
        headers: { Authorization: "Bearer signed-token" },
        body: JSON.stringify(body),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.enqueueGmailHistoryNotification).toHaveBeenCalledWith(
      { service: true },
      expect.objectContaining({
        emailAddress: "user@gmail.com",
        pubsubMessageId: "pubsub-v1",
        historyId: "12346",
      }),
    );
  });

  it("acepta envelope legacy con message_id y metadata adicional", async () => {
    const body = {
      delivery_attempt: 3,
      message: {
        data: Buffer.from(
          JSON.stringify({
            emailAddress: "User@Gmail.com",
            historyId: "12349",
          }),
        ).toString("base64"),
        message_id: "pubsub-legacy",
        publish_time: "2026-07-22T15:02:00.000Z",
        futureMetadata: "ignored",
      },
      subscription: "projects/manzana/subscriptions/gmail",
      futureEnvelopeMetadata: true,
    };
    const response = await POST(
      new Request("https://manzana.website/api/webhooks/gmail-pubsub", {
        method: "POST",
        headers: { Authorization: "Bearer signed-token" },
        body: JSON.stringify(body),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.enqueueGmailHistoryNotification).toHaveBeenCalledWith(
      { service: true },
      expect.objectContaining({
        pubsubMessageId: "pubsub-legacy",
        publishTime: "2026-07-22T15:02:00.000Z",
        historyId: "12349",
      }),
    );
  });

  it("acepta payload unwrapped con metadata en headers", async () => {
    const response = await POST(
      new Request("https://manzana.website/api/webhooks/gmail-pubsub", {
        method: "POST",
        headers: {
          Authorization: "Bearer signed-token",
          "x-goog-pubsub-message-id": "pubsub-unwrapped-1",
          "x-goog-pubsub-publish-time": "2026-07-22T15:01:00.000Z",
          "x-goog-pubsub-subscription-name":
            "projects/manzana/subscriptions/gmail",
        },
        body: JSON.stringify({
          emailAddress: "User@Gmail.com",
          historyId: "12347",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.enqueueGmailHistoryNotification).toHaveBeenCalledWith(
      { service: true },
      expect.objectContaining({
        emailAddress: "user@gmail.com",
        pubsubMessageId: "pubsub-unwrapped-1",
        historyId: "12347",
        publishTime: "2026-07-22T15:01:00.000Z",
        subscription: "projects/manzana/subscriptions/gmail",
      }),
    );
  });

  it("deriva una clave idempotente estable si unwrapped omite metadata", async () => {
    const body = JSON.stringify({
      emailAddress: "User@Gmail.com",
      historyId: "12348",
    });
    const request = () =>
      new Request("https://manzana.website/api/webhooks/gmail-pubsub", {
        method: "POST",
        headers: { Authorization: "Bearer signed-token" },
        body,
      });

    expect((await POST(request())).status).toBe(200);
    expect((await POST(request())).status).toBe(200);
    const firstId =
      mocks.enqueueGmailHistoryNotification.mock.calls[0]?.[1].pubsubMessageId;
    const secondId =
      mocks.enqueueGmailHistoryNotification.mock.calls[1]?.[1].pubsubMessageId;
    expect(firstId).toMatch(/^body-sha256-[0-9a-f]{64}$/);
    expect(secondId).toBe(firstId);
  });

  it("normaliza historyId numerico seguro sin perder precision", async () => {
    const body = {
      message: {
        data: Buffer.from(
          JSON.stringify({
            emailAddress: "User@Gmail.com",
            historyId: 12350,
          }),
        ).toString("base64"),
        messageId: "pubsub-numeric-history",
      },
      subscription: "projects/manzana/subscriptions/gmail",
    };
    const response = await POST(
      new Request("https://manzana.website/api/webhooks/gmail-pubsub", {
        method: "POST",
        headers: { Authorization: "Bearer signed-token" },
        body: JSON.stringify(body),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.enqueueGmailHistoryNotification).toHaveBeenCalledWith(
      { service: true },
      expect.objectContaining({ historyId: "12350" }),
    );
  });

  it("rechaza historyId numerico que no puede representarse con exactitud", async () => {
    const body = {
      message: {
        data: Buffer.from(
          JSON.stringify({
            emailAddress: "User@Gmail.com",
            historyId: Number.MAX_SAFE_INTEGER + 1,
          }),
        ).toString("base64"),
        messageId: "pubsub-unsafe-history",
      },
      subscription: "projects/manzana/subscriptions/gmail",
    };
    const response = await POST(
      new Request("https://manzana.website/api/webhooks/gmail-pubsub", {
        method: "POST",
        headers: { Authorization: "Bearer signed-token" },
        body: JSON.stringify(body),
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.enqueueGmailHistoryNotification).not.toHaveBeenCalled();
  });

  it("rechaza antes de tocar DB si falta identidad valida", async () => {
    mocks.verifyGmailPubSubRequest.mockRejectedValue(
      new GmailPubSubAuthError(
        "GMAIL_PUBSUB_TOKEN_INVALID",
        "invalid",
      ),
    );
    const response = await POST(pubsubRequest());

    expect(response.status).toBe(401);
    expect(mocks.enqueueGmailHistoryNotification).not.toHaveBeenCalled();
  });

  it("rechaza payload Gmail invalido", async () => {
    const request = new Request(
      "https://manzana.website/api/webhooks/gmail-pubsub",
      {
        method: "POST",
        body: JSON.stringify({
          message: {
            data: Buffer.from(JSON.stringify({ emailAddress: "bad" })).toString(
              "base64url",
            ),
            messageId: "pubsub-1",
          },
        }),
      },
    );
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(mocks.enqueueGmailHistoryNotification).not.toHaveBeenCalled();
  });
});

function pubsubRequest() {
  const body = {
    message: {
      data: Buffer.from(
        JSON.stringify({ emailAddress: "User@Gmail.com", historyId: "12345" }),
      ).toString("base64url"),
      messageId: "pubsub-1",
      publishTime: "2026-07-22T15:00:00.000Z",
    },
    subscription: "projects/manzana/subscriptions/gmail",
  };
  return new Request("https://manzana.website/api/webhooks/gmail-pubsub", {
    method: "POST",
    headers: { Authorization: "Bearer signed-token" },
    body: JSON.stringify(body),
  });
}
