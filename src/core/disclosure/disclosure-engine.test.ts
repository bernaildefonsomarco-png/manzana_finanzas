import { describe, expect, it } from "vitest";
import { evaluateDisclosure } from "./disclosure-engine";

describe("DisclosureEngine", () => {
  it("redacta montos, comercio y persona antes de un WhatsApp proactivo", () => {
    const decision = evaluateDisclosure({
      channel: "whatsapp",
      initiatedBySystem: true,
      authenticatedSession: false,
      discreetMode: true,
      facts: { amount: 180, merchant: "BCP", person_name: "Luis", due_date: "2026-07-19" },
    });
    expect(decision.safe_facts).toEqual({ due_date: "2026-07-19" });
    expect(decision.redaction_applied).toBe(true);
  });

  it("permite detalle solicitado por el usuario en WhatsApp", () => {
    const decision = evaluateDisclosure({
      channel: "whatsapp",
      initiatedBySystem: false,
      authenticatedSession: false,
      discreetMode: true,
      facts: { amount: 180, merchant: "BCP" },
    });
    expect(decision.safe_facts).toEqual({ amount: 180, merchant: "BCP" });
  });

  it("permite detalle en Dashboard autenticado", () => {
    const decision = evaluateDisclosure({
      channel: "dashboard",
      initiatedBySystem: true,
      authenticatedSession: true,
      discreetMode: true,
      facts: { balance: 500 },
    });
    expect(decision.level).toBe("detailed");
    expect(decision.redaction_applied).toBe(false);
  });

  it("fuerza resumen seguro para una salida proactiva sensible", () => {
    const decision = evaluateDisclosure({
      channel: "whatsapp",
      initiatedBySystem: true,
      authenticatedSession: false,
      discreetMode: false,
      riskLevel: "sensitive",
      facts: {
        debt_name: "Tarjeta privada",
        amount: 180,
        target_view: "debts",
      },
    });

    expect(decision.level).toBe("summary");
    expect(decision.safe_facts).toEqual({ target_view: "debts" });
    expect(decision.redacted_keys).toEqual(
      expect.arrayContaining(["debt_name", "amount"]),
    );
    expect(decision.reasons).toContain("sensitive_proactive_external_output");
  });
});
