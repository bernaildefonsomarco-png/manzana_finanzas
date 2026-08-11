import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeLightAction } from "./light-action-executor";

const repos = vi.hoisted(() => ({
  snoozeReminder: vi.fn(),
  dismissReminder: vi.fn(),
  commitInsightInteraction: vi.fn(),
  setHomeBlockHidden: vi.fn(),
}));

// Los dobles de las dos clases de error viajan por `vi.hoisted` porque el
// modulo bajo prueba usa `instanceof` sobre ellas: si el mock devolviera otra
// clase, el ejecutor las trataria como errores desconocidos y este test
// aprobaria un camino que en produccion no existe.
const { FakeReminderError, FakeInsightError } = vi.hoisted(() => ({
  FakeReminderError: class extends Error {
    constructor(
      public readonly code:
        | "NOT_FOUND"
        | "CONFLICT"
        | "FORBIDDEN"
        | "INVALID_OPERATION",
      message: string,
    ) {
      super(message);
      this.name = "ReminderRepositoryError";
    }
  },
  FakeInsightError: class extends Error {
    constructor(readonly code: "INSIGHT_IDEMPOTENCY_CONFLICT") {
      super(code);
      this.name = "InsightOperationError";
    }
  },
}));

vi.mock("@/data/repositories/reminders.repository", () => ({
  snoozeReminder: repos.snoozeReminder,
  dismissReminder: repos.dismissReminder,
  ReminderRepositoryError: FakeReminderError,
}));
vi.mock("@/data/repositories/insights.repository", () => ({
  commitInsightInteraction: repos.commitInsightInteraction,
  InsightOperationError: FakeInsightError,
}));
vi.mock("@/data/repositories/home.repository", () => ({
  setHomeBlockHidden: repos.setHomeBlockHidden,
}));

const CLIENT = {} as never;
const USER = "user-1";
const OTRO_USUARIO = "user-2";
const ID = "11111111-2222-3333-4444-555555555555";
const NOW = "2026-08-10T15:00:00.000Z";

function run(command: Parameters<typeof executeLightAction>[0]["command"], userId = USER) {
  return executeLightAction({
    client: CLIENT,
    userId,
    command,
    traceId: "trace-1",
    now: NOW,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  repos.snoozeReminder.mockResolvedValue(undefined);
  repos.dismissReminder.mockResolvedValue(undefined);
  repos.commitInsightInteraction.mockResolvedValue({
    insight: { id: ID },
    idempotent: false,
  });
  repos.setHomeBlockHidden.mockResolvedValue(["pending"]);
});

describe("posponer_recordatorio", () => {
  it("caso feliz: aplaza el plazo pedido y dice que no lo borro", async () => {
    const result = await run({
      action: "posponer_recordatorio",
      reminderId: ID,
      days: 7,
    });

    expect(result.kind).toBe("applied");
    expect(result.text).toContain("en 7 días");
    expect(result.text).toMatch(/no lo borré/i);
    const [, userId, id, until] = repos.snoozeReminder.mock.calls[0];
    expect(userId).toBe(USER);
    expect(id).toBe(ID);
    // El plazo lo calcula el nucleo desde el instante del turno, no el modelo.
    expect(until).toBe("2026-08-17T15:00:00.000Z");
  });

  it("un recordatorio que no existe no se inventa: se dice y no cambia nada", async () => {
    repos.snoozeReminder.mockRejectedValue(
      new FakeReminderError("NOT_FOUND", "Ese recordatorio ya no está."),
    );

    const result = await run({
      action: "posponer_recordatorio",
      reminderId: ID,
      days: 1,
    });

    expect(result.kind).toBe("not_found");
    expect(result.text).toMatch(/no cambié nada/i);
  });

  it("aislamiento: el user_id que viaja es el del turno, nunca otro", async () => {
    await run({ action: "posponer_recordatorio", reminderId: ID, days: 1 }, OTRO_USUARIO);
    expect(repos.snoozeReminder).toHaveBeenCalledWith(
      CLIENT,
      OTRO_USUARIO,
      ID,
      expect.any(String),
    );
  });
});

describe("descartar_recordatorio", () => {
  it("caso feliz: descarta y aclara que no toco dinero", async () => {
    const result = await run({ action: "descartar_recordatorio", reminderId: ID });

    expect(result.kind).toBe("applied");
    expect(result.text).toMatch(/no cambié ningún movimiento ni saldo/i);
    expect(repos.dismissReminder).toHaveBeenCalledWith(CLIENT, USER, ID);
  });

  it("uno ya resuelto no se descarta dos veces ni se afirma que si", async () => {
    repos.dismissReminder.mockRejectedValue(
      new FakeReminderError("CONFLICT", "Eso ya está resuelto."),
    );

    const result = await run({ action: "descartar_recordatorio", reminderId: ID });

    expect(result.kind).toBe("not_found");
    expect(result.text).toMatch(/ya estaba resuelto/i);
  });

  it("aislamiento: el user_id del turno llega al repositorio", async () => {
    await run({ action: "descartar_recordatorio", reminderId: ID }, OTRO_USUARIO);
    expect(repos.dismissReminder).toHaveBeenCalledWith(CLIENT, OTRO_USUARIO, ID);
  });
});

describe("descartar_descubrimiento", () => {
  it("caso feliz: lo descarta y dice que no toco datos", async () => {
    const result = await run({ action: "descartar_descubrimiento", insightId: ID });

    expect(result.kind).toBe("applied");
    expect(result.text).toMatch(/no toqué ningún dato tuyo/i);
    expect(repos.commitInsightInteraction).toHaveBeenCalledWith(
      CLIENT,
      USER,
      expect.objectContaining({ insightId: ID, operation: "dismiss" }),
    );
  });

  it("un descubrimiento inexistente devuelve not_found, no un exito silencioso", async () => {
    repos.commitInsightInteraction.mockResolvedValue(null);

    const result = await run({ action: "descartar_descubrimiento", insightId: ID });

    expect(result.kind).toBe("not_found");
    expect(result.text).toMatch(/no cambié nada/i);
  });

  it("aislamiento: el descubrimiento se busca con el user_id del turno", async () => {
    await run({ action: "descartar_descubrimiento", insightId: ID }, OTRO_USUARIO);
    expect(repos.commitInsightInteraction).toHaveBeenCalledWith(
      CLIENT,
      OTRO_USUARIO,
      expect.anything(),
    );
  });
});

describe("marcar_descubrimiento", () => {
  it("caso feliz: registra el valor y ofrece cambiarlo", async () => {
    const result = await run({
      action: "marcar_descubrimiento",
      insightId: ID,
      value: "no_util",
    });

    expect(result.kind).toBe("applied");
    expect(result.text).toMatch(/no te sirvió/i);
    expect(result.text).toMatch(/lo contrario cuando quieras/i);
    expect(repos.commitInsightInteraction).toHaveBeenCalledWith(
      CLIENT,
      USER,
      expect.objectContaining({ operation: "feedback", value: "no_util" }),
    );
  });

  it("un descubrimiento inexistente no se marca", async () => {
    repos.commitInsightInteraction.mockResolvedValue(null);

    const result = await run({
      action: "marcar_descubrimiento",
      insightId: ID,
      value: "util",
    });

    expect(result.kind).toBe("not_found");
  });

  it("una clave repetida con otros datos no pisa lo ya registrado", async () => {
    repos.commitInsightInteraction.mockRejectedValue(
      new FakeInsightError("INSIGHT_IDEMPOTENCY_CONFLICT"),
    );

    const result = await run({
      action: "marcar_descubrimiento",
      insightId: ID,
      value: "util",
    });

    expect(result.kind).toBe("failed");
    expect(result.text).toMatch(/no lo pisé/i);
  });

  it("aislamiento: el user_id del turno llega al repositorio", async () => {
    await run(
      { action: "marcar_descubrimiento", insightId: ID, value: "util" },
      OTRO_USUARIO,
    );
    expect(repos.commitInsightInteraction).toHaveBeenCalledWith(
      CLIENT,
      OTRO_USUARIO,
      expect.anything(),
    );
  });
});

describe("ocultar_bloque_inicio / mostrar_bloque_inicio", () => {
  it("caso feliz: oculta y dice la frase exacta que lo devuelve", async () => {
    const result = await run({ action: "ocultar_bloque_inicio", block: "pending" });

    expect(result.kind).toBe("applied");
    expect(result.text).toContain("muestra el de pendientes");
    expect(repos.setHomeBlockHidden).toHaveBeenCalledWith(
      CLIENT,
      USER,
      "pending",
      true,
    );
  });

  it("mostrar vuelve a dejarlo visible", async () => {
    const result = await run({ action: "mostrar_bloque_inicio", block: "insight" });

    expect(result.kind).toBe("applied");
    expect(repos.setHomeBlockHidden).toHaveBeenCalledWith(
      CLIENT,
      USER,
      "insight",
      false,
    );
  });

  it("un fallo de escritura no se cuenta como hecho", async () => {
    repos.setHomeBlockHidden.mockRejectedValue(new Error("boom"));

    const result = await run({ action: "ocultar_bloque_inicio", block: "month" });

    expect(result.kind).toBe("failed");
    expect(result.text).toMatch(/no cambié nada/i);
  });

  it("aislamiento: la preferencia se escribe sobre el user_id del turno", async () => {
    await run({ action: "ocultar_bloque_inicio", block: "month" }, OTRO_USUARIO);
    expect(repos.setHomeBlockHidden).toHaveBeenCalledWith(
      CLIENT,
      OTRO_USUARIO,
      "month",
      true,
    );
  });
});

describe("ningun desenlace deja el turno sin nada que decir", () => {
  it("los tres tipos de resultado traen texto no vacio", async () => {
    const applied = await run({ action: "descartar_recordatorio", reminderId: ID });

    repos.dismissReminder.mockRejectedValue(
      new FakeReminderError("NOT_FOUND", "Ese recordatorio ya no está."),
    );
    const notFound = await run({ action: "descartar_recordatorio", reminderId: ID });

    repos.dismissReminder.mockRejectedValue(new Error("boom"));
    const failed = await run({ action: "descartar_recordatorio", reminderId: ID });

    for (const result of [applied, notFound, failed]) {
      expect(result.text.trim().length).toBeGreaterThan(0);
    }
    expect([applied.kind, notFound.kind, failed.kind]).toEqual([
      "applied",
      "not_found",
      "failed",
    ]);
  });
});
