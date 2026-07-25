import { describe, expect, it } from "vitest";
import { evaluateOutputGuard } from "./output-guard";

describe("OutputGuard", () => {
  it("permite detalle solicitado desde el WhatsApp vinculado", () => {
    const decision = evaluateOutputGuard({
      channel: "whatsapp",
      initiatedBySystem: false,
      authenticatedSession: false,
      verifiedRecipient: true,
      discreetMode: true,
      riskLevel: "sensitive",
      facts: { amount: 180, debt_name: "Tarjeta" },
      sensitiveFactKeys: ["amount", "debt_name"],
    });

    expect(decision.allowed).toBe(true);
    expect(decision.disclosure.level).toBe("detailed");
  });

  it("bloquea detalle sensible para un destinatario externo no verificado", () => {
    const decision = evaluateOutputGuard({
      channel: "email_notification",
      initiatedBySystem: false,
      authenticatedSession: false,
      verifiedRecipient: false,
      discreetMode: false,
      riskLevel: "sensitive",
      facts: { amount: 180, debt_name: "Tarjeta" },
      sensitiveFactKeys: ["amount", "debt_name"],
    });

    expect(decision.allowed).toBe(false);
    expect(decision.risk.reasons).toContain(
      "sensitive_read_outside_authenticated_session",
    );
  });

  it("fuerza resumen para una salida proactiva sensible con opt-in", () => {
    const decision = evaluateOutputGuard({
      channel: "whatsapp",
      initiatedBySystem: true,
      authenticatedSession: false,
      verifiedRecipient: true,
      discreetMode: false,
      riskLevel: "sensitive",
      applicableOptIn: true,
      facts: { amount: 180, debt_name: "Tarjeta", target_view: "debts" },
      sensitiveFactKeys: ["amount", "debt_name"],
    });

    expect(decision.allowed).toBe(true);
    expect(decision.disclosure.level).toBe("summary");
    expect(decision.disclosure.safe_facts).toEqual({ target_view: "debts" });
  });

  it("veta cualquier salida proactiva sin opt-in aunque el copy sea seguro", () => {
    const decision = evaluateOutputGuard({
      channel: "push",
      initiatedBySystem: true,
      authenticatedSession: false,
      verifiedRecipient: false,
      discreetMode: true,
      riskLevel: "medium",
      applicableOptIn: false,
      facts: { target_view: "pending" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.risk.reasons).toContain("proactive_opt_in_missing");
  });
});
