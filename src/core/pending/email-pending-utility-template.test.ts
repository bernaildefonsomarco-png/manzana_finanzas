import { describe, expect, it } from "vitest";
import {
  buildEmailPendingUtilityTemplateContract,
  EMAIL_PENDING_UTILITY_TEMPLATE,
  renderEmailPendingUtilityTemplatePreview,
} from "./email-pending-utility-template";

describe("email pending Utility template contract", () => {
  it("mantiene un contrato estatico sin datos financieros", () => {
    expect(buildEmailPendingUtilityTemplateContract()).toEqual({
      name: "manzana_movimiento_por_confirmar_v1",
      language: "es_PE",
      params: {},
    });
    const preview = renderEmailPendingUtilityTemplatePreview();
    expect(preview).toContain("necesita tu revisión");
    expect(preview).not.toMatch(/S\/|USD|BCP|Yape|\d+[.,]\d{2}/i);
  });

  it("conserva categoria Utility y acceso directo a Pendientes", () => {
    expect(EMAIL_PENDING_UTILITY_TEMPLATE).toMatchObject({
      name: "manzana_movimiento_por_confirmar_v1",
      language: "es_PE",
      category: "UTILITY",
      parameter_format: "POSITIONAL",
    });
    expect(EMAIL_PENDING_UTILITY_TEMPLATE.components).toHaveLength(3);
    expect(
      JSON.stringify(EMAIL_PENDING_UTILITY_TEMPLATE),
    ).toContain("view=pending");
  });
});
