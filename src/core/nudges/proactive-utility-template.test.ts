import { describe, expect, it } from "vitest";
import {
  buildCommitmentUtilityTemplateContract,
  COMMITMENT_UTILITY_TEMPLATE,
  renderCommitmentUtilityTemplatePreview,
  resolveCommitmentTiming,
} from "./proactive-utility-template";

describe("commitment utility template contract", () => {
  it.each([
    ["payment_due", 2, "para los próximos días"],
    ["overdue_payment", -1, "que sigue pendiente"],
    ["debt_due", 0, "para hoy"],
  ] as const)(
    "admite %s sin exponer datos financieros",
    (type, daysUntilDue, timing) => {
      const contract = buildCommitmentUtilityTemplateContract({
        type,
        metadata: {
          days_until_due: daysUntilDue,
          amount: 800,
          debt_name: "Dato que no debe salir",
          recurring_rule_name: "Dato que no debe salir",
        },
      });

      expect(contract).toEqual({
        name: "manzana_compromiso_financiero_v1",
        language: "es_PE",
        params: { "1": timing },
      });
      expect(JSON.stringify(contract)).not.toContain("800");
      expect(JSON.stringify(contract)).not.toContain("Dato que no debe salir");
    },
  );

  it("rechaza tipos que no pertenecen al contrato Utility", () => {
    expect(
      buildCommitmentUtilityTemplateContract({
        type: "insight_prompt",
        metadata: { days_until_due: 1 },
      }),
    ).toBeNull();
  });

  it("renderiza el preview exacto sin pasar por agentes", () => {
    const contract = buildCommitmentUtilityTemplateContract({
      type: "payment_due",
      metadata: { days_until_due: 1 },
    });

    expect(contract).not.toBeNull();
    expect(renderCommitmentUtilityTemplatePreview(contract!)).toBe(
      "Tienes un compromiso financiero en Manzana para mañana. Puedes revisarlo con calma y privacidad.",
    );
  });

  it("mantiene una salida segura cuando falta el vencimiento", () => {
    expect(resolveCommitmentTiming(null)).toBe("que conviene revisar");
  });

  it("mantiene fijo el contrato aprobado por producto", () => {
    expect(COMMITMENT_UTILITY_TEMPLATE).toMatchObject({
      name: "manzana_compromiso_financiero_v1",
      language: "es_PE",
      category: "UTILITY",
      parameter_format: "POSITIONAL",
    });
    expect(COMMITMENT_UTILITY_TEMPLATE.components).toHaveLength(3);
  });
});
