import { describe, expect, it } from "vitest";
import {
  buildReminderDrafts,
  priorityForKind,
  type ReminderEvaluatorInput,
} from "./reminder-engine";

const NOW = new Date("2026-08-02T15:00:00Z"); // domingo en America/Lima
const RECENT_ACTIVITY = "2026-08-02T10:00:00Z"; // hoy: evita ruido de sin_registrar

function evaluate(input: Omit<ReminderEvaluatorInput, "now">) {
  return buildReminderDrafts({
    now: NOW,
    lastMovementAt: RECENT_ACTIVITY,
    lastAssistantOrCorrectionAt: RECENT_ACTIVITY,
    ...input,
  });
}

describe("buildReminderDrafts", () => {
  it("genera pago_proximo para un compromiso que vence pronto", () => {
    const drafts = evaluate({
      recurringDue: [
        {
          ruleId: "rec_9f2",
          ruleName: "El alquiler",
          amount: 850,
          currency: "PEN",
          expectedDate: "2026-08-07",
          overdue: false,
        },
      ],
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.kind).toBe("pago_proximo");
    expect(drafts[0]!.subjectKey).toBe("compromiso:rec_9f2");
    expect(drafts[0]!.title).toContain("S/850.00");
  });

  it("genera pago_vencido en vez de pago_proximo cuando ya venció", () => {
    const drafts = evaluate({
      recurringDue: [
        {
          ruleId: "rec_1",
          ruleName: "Internet",
          amount: 120,
          currency: "PEN",
          expectedDate: "2026-07-20",
          overdue: true,
        },
      ],
    });
    expect(drafts[0]!.kind).toBe("pago_vencido");
  });

  it("RUL-NOTIF-07: no genera un segundo recordatorio para el mismo subject_key ya abierto", () => {
    const drafts = evaluate({
      recurringDue: [
        {
          ruleId: "rec_9f2",
          ruleName: "El alquiler",
          amount: 850,
          currency: "PEN",
          expectedDate: "2026-08-07",
          overdue: false,
        },
      ],
      existingOpenSubjectKeys: new Set(["compromiso:rec_9f2"]),
    });
    expect(drafts).toHaveLength(0);
  });

  it("cuota_proxima/cuota_vencida usan subject_key cuota:<debt>#<numero>", () => {
    const drafts = evaluate({
      debtInstallmentsDue: [
        {
          debtId: "debt_31c",
          debtName: "la laptop",
          number: 4,
          amount: 180,
          currency: "PEN",
          dueDate: "2026-07-15",
          overdue: true,
        },
      ],
    });
    expect(drafts[0]!.kind).toBe("cuota_vencida");
    expect(drafts[0]!.subjectKey).toBe("cuota:debt_31c#4");
  });

  it("pendientes_acumulados: umbral exacto de 5 (RUL-NOTIF-01)", () => {
    const withFour = evaluate({ openPendingCount: 4 });
    const withFive = evaluate({ openPendingCount: 5 });
    expect(withFour.some((d) => d.kind === "pendientes_acumulados")).toBe(false);
    expect(withFive.some((d) => d.kind === "pendientes_acumulados")).toBe(true);
  });

  it("RUL-NOTIF-07: pendientes_acumulados no se genera si resolvió pendientes en las últimas 24h", () => {
    const drafts = evaluate({
      openPendingCount: 6,
      pendingResolvedInLast24h: true,
    });
    expect(drafts.some((d) => d.kind === "pendientes_acumulados")).toBe(false);
  });

  it("sin_registrar: umbral exacto de 7 días sin registrar ni conversar", () => {
    const sixDays = buildReminderDrafts({
      now: NOW,
      lastMovementAt: "2026-07-27T10:00:00Z", // 6 días
      lastAssistantOrCorrectionAt: "2026-07-27T10:00:00Z",
    });
    const sevenDays = buildReminderDrafts({
      now: NOW,
      lastMovementAt: "2026-07-26T10:00:00Z", // 7 días
      lastAssistantOrCorrectionAt: "2026-07-26T10:00:00Z",
    });
    expect(sixDays.some((d) => d.kind === "sin_registrar")).toBe(false);
    expect(sevenDays.some((d) => d.kind === "sin_registrar")).toBe(true);
  });

  it("sin_registrar no se genera si el usuario conversó con el asistente aunque no registre (RUL-NOTIF-07)", () => {
    const drafts = buildReminderDrafts({
      now: NOW,
      lastMovementAt: "2026-06-01T10:00:00Z",
      lastAssistantOrCorrectionAt: "2026-08-01T10:00:00Z", // ayer
    });
    expect(drafts.some((d) => d.kind === "sin_registrar")).toBe(false);
  });

  it("correo_desconectado por cada buzón no saludable, con su propio subject_key", () => {
    const drafts = evaluate({
      unhealthyEmailSources: [
        { id: "src_1", label: "BCP", disconnectedSinceIso: "2026-07-20T00:00:00Z" },
        { id: "src_2", label: "Interbank", disconnectedSinceIso: null },
      ],
    });
    expect(drafts).toHaveLength(2);
    expect(drafts.map((d) => d.subjectKey).sort()).toEqual(["buzon:src_1", "buzon:src_2"]);
  });

  it("una pausa activa suprime toda creación nueva", () => {
    const drafts = evaluate({
      isPaused: true,
      openPendingCount: 20,
      recurringDue: [
        {
          ruleId: "rec_9f2",
          ruleName: "El alquiler",
          amount: 850,
          currency: "PEN",
          expectedDate: "2026-08-07",
          overdue: false,
        },
      ],
    });
    expect(drafts).toHaveLength(0);
  });

  it("RUL-NOTIF-08: se ordenan de mayor a menor prioridad (vencido antes que próximo)", () => {
    const drafts = evaluate({
      recurringDue: [
        {
          ruleId: "rec_a",
          ruleName: "Próximo",
          amount: 10,
          currency: "PEN",
          expectedDate: "2026-08-05",
          overdue: false,
        },
        {
          ruleId: "rec_b",
          ruleName: "Vencido",
          amount: 10,
          currency: "PEN",
          expectedDate: "2026-07-01",
          overdue: true,
        },
      ],
    });
    expect(drafts.map((d) => d.kind)).toEqual(["pago_vencido", "pago_proximo"]);
  });

  it("priorityForKind respeta el orden documentado de RUL-NOTIF-08", () => {
    expect(priorityForKind("descarga_lista")).toBeGreaterThan(priorityForKind("correo_desconectado"));
    expect(priorityForKind("correo_desconectado")).toBeGreaterThan(priorityForKind("pago_vencido"));
    expect(priorityForKind("pago_vencido")).toBeGreaterThan(priorityForKind("pago_proximo"));
    expect(priorityForKind("presupuesto_umbral")).toBeGreaterThan(priorityForKind("pendientes_acumulados"));
    expect(priorityForKind("pendientes_acumulados")).toBeGreaterThan(priorityForKind("sin_registrar"));
  });

  it("todo título y cuerpo respeta los límites de longitud y no usa exclamación (AC-NOTIF-18)", () => {
    const drafts = evaluate({
      recurringDue: [
        {
          ruleId: "rec_1",
          ruleName: "X".repeat(120),
          amount: 999999,
          currency: "PEN",
          expectedDate: "2026-08-07",
          overdue: false,
        },
      ],
    });
    for (const draft of drafts) {
      expect(draft.title.length).toBeLessThanOrEqual(80);
      expect(draft.body.length).toBeLessThanOrEqual(200);
      expect(draft.title).not.toContain("!");
    }
  });
});
