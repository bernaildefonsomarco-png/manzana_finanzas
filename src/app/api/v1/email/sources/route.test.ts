import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  createServiceClient: vi.fn(() => ({})),
  upsertUserEmailSource: vi.fn(),
  deleteUserEmailSource: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({
  getApiAuth: mocks.getApiAuth,
}));
vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock("@/data/repositories/email.repository", async (original) => ({
  ...(await original()),
  upsertUserEmailSource: mocks.upsertUserEmailSource,
  deleteUserEmailSource: mocks.deleteUserEmailSource,
}));

import { DELETE, PUT } from "./route";

const connectionId = "11111111-1111-4111-8111-111111111111";
const sourceId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.createServiceClient.mockReturnValue({});
  mocks.getApiAuth.mockResolvedValue({ userId: "user-1" });
  mocks.upsertUserEmailSource.mockResolvedValue({
    id: sourceId,
    user_id: "user-1",
    institution_key: "bcp",
    email_connection_id: connectionId,
    notification_sender: "notificaciones@notificacionesbcp.com.pe",
    status: "shadow",
    verification_status: "pending",
  });
  mocks.deleteUserEmailSource.mockResolvedValue({
    changed: true,
    archived_pending_count: 1,
    reason: "disabled",
  });
});

describe("email institution sources route", () => {
  it("normaliza y guarda banco, buzon y remitente exacto", async () => {
    const response = await PUT(
      request("PUT", {
        institution_key: "bcp",
        email_connection_id: connectionId,
        notification_sender: " NOTIFICACIONES@notificacionesbcp.com.pe ",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.upsertUserEmailSource).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        userId: "user-1",
        institutionKey: "bcp",
        connectionId,
        notificationSender: "notificaciones@notificacionesbcp.com.pe",
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      data: {
        source: {
          institution_key: "bcp",
          status: "shadow",
        },
      },
    });
  });

  it("deshabilita solo la fuente elegida", async () => {
    const response = await DELETE(
      request("DELETE", { source_id: sourceId }),
    );

    expect(response.status).toBe(200);
    expect(mocks.deleteUserEmailSource).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        userId: "user-1",
        sourceId,
      }),
    );
  });

  it("rechaza remitentes que no son correos exactos", async () => {
    const response = await PUT(
      request("PUT", {
        institution_key: "bcp",
        email_connection_id: connectionId,
        notification_sender: "*@notificacionesbcp.com.pe",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.upsertUserEmailSource).not.toHaveBeenCalled();
  });

  it("no permite mutaciones sin sesion", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await PUT(
      request("PUT", {
        institution_key: "bcp",
        email_connection_id: connectionId,
        notification_sender: "notificaciones@notificacionesbcp.com.pe",
      }),
    );

    expect(response.status).toBe(401);
  });
});

function request(method: "PUT" | "DELETE", body: unknown): Request {
  return new Request("http://localhost/api/v1/email/sources", {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-trace-id": "33333333-3333-4333-8333-333333333333",
    },
    body: JSON.stringify(body),
  });
}
