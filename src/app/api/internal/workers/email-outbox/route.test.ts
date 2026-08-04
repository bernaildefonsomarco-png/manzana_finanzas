import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  createEmailSender: vi.fn(),
  claimPendingEmails: vi.fn(),
  isAddressSuppressed: vi.fn(),
  markEmailSent: vi.fn(),
  markEmailDiscarded: vi.fn(),
  markEmailDeferred: vi.fn(),
  markEmailFailed: vi.fn(),
  startWorkerJobRun: vi.fn(),
  finishWorkerJobRun: vi.fn(),
  getUserById: vi.fn(),
  send: vi.fn(),
}));

vi.mock("@/data/supabase/server", () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock("@/adapters/email/outbound-sender", () => ({ createEmailSender: mocks.createEmailSender }));
vi.mock("@/data/repositories/email-outbox.repository", () => ({
  claimPendingEmails: mocks.claimPendingEmails,
  isAddressSuppressed: mocks.isAddressSuppressed,
  markEmailSent: mocks.markEmailSent,
  markEmailDiscarded: mocks.markEmailDiscarded,
  markEmailDeferred: mocks.markEmailDeferred,
  markEmailFailed: mocks.markEmailFailed,
}));
vi.mock("@/data/repositories/worker-operations.repository", () => ({
  startWorkerJobRun: mocks.startWorkerJobRun,
  finishWorkerJobRun: mocks.finishWorkerJobRun,
}));

import { GET } from "./route";

const row = {
  id: "email-1",
  user_id: "user-1",
  kind: "transaccional" as const,
  template: "descarga_lista",
  subject: "Tu descarga está lista",
  idempotency_key: "descarga_lista·job-1·2026-08-03",
  scheduled_for: "2026-08-03T00:00:00Z",
  status: "pendiente" as const,
  attempts: 0,
};

function request(query = "") {
  return new Request(`http://localhost/api/internal/workers/email-outbox${query}`, {
    headers: { authorization: "Bearer test-worker-secret" },
  });
}

beforeEach(() => {
  vi.stubEnv("WORKER_SECRET", "test-worker-secret");
  Object.values(mocks).forEach((m) => m.mockReset?.());
  mocks.createServiceClient.mockReturnValue({
    auth: { admin: { getUserById: mocks.getUserById } },
  });
  mocks.createEmailSender.mockReturnValue({ send: mocks.send });
  mocks.claimPendingEmails.mockResolvedValue([row]);
  mocks.isAddressSuppressed.mockResolvedValue(false);
  mocks.getUserById.mockResolvedValue({ data: { user: { email: "marco@ejemplo.com" } } });
  mocks.send.mockResolvedValue({ ok: true, providerMessageId: "local-1" });
  mocks.startWorkerJobRun.mockResolvedValue({ id: "run-1" });
  mocks.finishWorkerJobRun.mockResolvedValue({});
});

describe("GET /api/internal/workers/email-outbox — 46 RUL-MAIL-02/07", () => {
  it("camino feliz: envía un transaccional y lo marca enviado", async () => {
    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ worker: "email_outbox_send", sent: 1, discarded: 0, deferred: 0, failed: 0 });
    expect(mocks.markEmailSent).toHaveBeenCalledWith(expect.anything(), "email-1");
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "marco@ejemplo.com", subject: "Tu descarga está lista" }),
    );
  });

  it("dirección suprimida: se descarta sin llamar al proveedor", async () => {
    mocks.isAddressSuppressed.mockResolvedValue(true);
    const response = await GET(request());
    const body = await response.json();

    expect(body.data.discarded).toBe(1);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.markEmailDiscarded).toHaveBeenCalledWith(
      expect.anything(),
      "email-1",
      "direccion_suprimida",
    );
  });

  it("sin sesión asociada al usuario (correo desconocido): se descarta", async () => {
    mocks.getUserById.mockResolvedValue({ data: { user: null } });
    const response = await GET(request());
    const body = await response.json();

    expect(body.data.discarded).toBe(1);
    expect(mocks.markEmailDiscarded).toHaveBeenCalledWith(expect.anything(), "email-1", "sin_direccion");
  });

  it("un fallo del proveedor marca fallido con backoff, no lanza sin control", async () => {
    mocks.send.mockResolvedValue({ ok: false, error: "smtp_timeout" });
    const response = await GET(request());
    const body = await response.json();

    expect(body.data.failed).toBe(1);
    expect(mocks.markEmailFailed).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "email-1" }),
      "smtp_timeout",
    );
  });

  it("sin autorización: 403, no procesa nada", async () => {
    const response = await GET(new Request("http://localhost/api/internal/workers/email-outbox"));
    expect(response.status).toBe(403);
    expect(mocks.claimPendingEmails).not.toHaveBeenCalled();
  });

  it("RUL-HECHO-02: si isAddressSuppressed no se llamara, el aserto de la ruta suprimida fallaría", async () => {
    mocks.isAddressSuppressed.mockResolvedValue(false);
    await GET(request());
    expect(mocks.isAddressSuppressed).toHaveBeenCalledWith(expect.anything(), "user-1");
  });
});
