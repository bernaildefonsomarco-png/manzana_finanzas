import { describe, expect, it } from "vitest";
import { computeReminderStatus } from "./domain";

const NOW = new Date("2026-08-02T12:00:00Z");

function reminder(overrides: Partial<Parameters<typeof computeReminderStatus>[0]> = {}) {
  return {
    dismissed_at: null,
    resolved_at: null,
    snoozed_until: null,
    read_at: null,
    expires_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

describe("computeReminderStatus", () => {
  it("recién creado y sin tocar: en_bandeja", () => {
    expect(computeReminderStatus(reminder(), NOW)).toBe("en_bandeja");
  });

  it("leído sin resolver: leido", () => {
    expect(computeReminderStatus(reminder({ read_at: "2026-08-01T00:00:00Z" }), NOW)).toBe("leido");
  });

  it("pospuesto hasta el futuro: pospuesto", () => {
    expect(computeReminderStatus(reminder({ snoozed_until: "2026-08-05T00:00:00Z" }), NOW)).toBe("pospuesto");
  });

  it("descartado por el usuario: descartado, aunque también esté leído", () => {
    expect(
      computeReminderStatus(
        reminder({ dismissed_at: "2026-08-01T00:00:00Z", read_at: "2026-08-01T00:00:00Z" }),
        NOW,
      ),
    ).toBe("descartado");
  });

  it("RUL-NOTIF-10: un recordatorio pospuesto que se resuelve no vuelve — gana 'resuelto', no 'pospuesto'", () => {
    expect(
      computeReminderStatus(
        reminder({ snoozed_until: "2026-08-05T00:00:00Z", resolved_at: "2026-08-02T10:00:00Z" }),
        NOW,
      ),
    ).toBe("resuelto");
  });

  it("caducado cuando expires_at ya pasó, incluso si nunca se leyó", () => {
    expect(computeReminderStatus(reminder({ expires_at: "2026-08-01T00:00:00Z" }), NOW)).toBe("caducado");
  });

  it("resuelto tiene prioridad sobre caducado si ambos aplican", () => {
    expect(
      computeReminderStatus(
        reminder({ expires_at: "2026-08-01T00:00:00Z", resolved_at: "2026-07-30T00:00:00Z" }),
        NOW,
      ),
    ).toBe("resuelto");
  });
});
