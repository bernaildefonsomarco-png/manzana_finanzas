import { describe, expect, it } from "vitest";
import type { PendingItem } from "@/shared/types/domain";
import {
  buildConfirmAriaLabel,
  buildProposalFields,
  buildProposalTitle,
  resolveConfirmationLevel,
} from "./resolve-proposal-card";

function makeItem(overrides: Partial<PendingItem> = {}): PendingItem {
  return {
    id: "pend-1",
    user_id: "user-1",
    type: "ambiguous_movement",
    status: "pending",
    source: "ambiguous_movement",
    source_ref: "dashboard:ext-1:accion-1",
    proposed_action: { action: "create_movement" },
    normalized_summary: {
      title: "Voy a registrar un gasto",
      subtitle: "Rappi",
      amount: 32,
      currency: "PEN",
      category_id: "alimentacion",
    },
    dedup_status: null,
    risk_level: "low",
    confirmable: true,
    confirm_command: null,
    expires_at: null,
    sent_for_confirmation_at: null,
    resolved_at: null,
    resolved_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: {},
    ...overrides,
  };
}

describe("resolveConfirmationLevel", () => {
  it("risk_level sensitive manda sobre todo lo demas: consentimiento", () => {
    const item = makeItem({ risk_level: "sensitive", confirmable: true });
    expect(resolveConfirmationLevel(item)).toBe("consentimiento");
  });

  it("risk_level high, sin ser sensitive: riesgo", () => {
    const item = makeItem({ risk_level: "high", confirmable: true });
    expect(resolveConfirmationLevel(item)).toBe("riesgo");
  });

  it("RUL-PEND-01: no confirmable todavia (le faltan datos): tarjeta_editable", () => {
    const item = makeItem({ risk_level: "low", confirmable: false });
    expect(resolveConfirmationLevel(item)).toBe("tarjeta_editable");
  });

  it("bajo riesgo y confirmable: tarjeta de solo lectura", () => {
    const item = makeItem({ risk_level: "low", confirmable: true });
    expect(resolveConfirmationLevel(item)).toBe("tarjeta");
  });

  it("nunca infravalora: sensitive gana aunque confirmable sea true", () => {
    const item = makeItem({ risk_level: "sensitive", confirmable: true });
    expect(resolveConfirmationLevel(item)).not.toBe("tarjeta");
  });
});

describe("buildProposalTitle", () => {
  it("RUL-ASI-04: en riesgo, el titulo nunca es el del summary sino 'Voy a eliminar'", () => {
    const item = makeItem({ risk_level: "high", normalized_summary: { title: "algo raro" } });
    expect(buildProposalTitle(item)).toBe("Voy a eliminar");
  });

  it("usa el titulo del resumen cuando no es riesgo", () => {
    const item = makeItem({ normalized_summary: { title: "Voy a registrar un gasto de S/32" } });
    expect(buildProposalTitle(item)).toBe("Voy a registrar un gasto de S/32");
  });

  it("cae a un titulo generico si el resumen no trae uno", () => {
    const item = makeItem({ normalized_summary: {} });
    expect(buildProposalTitle(item)).toBe("Voy a registrar");
  });
});

describe("buildProposalFields", () => {
  it("AC-ASI-06: el campo categoria viene resaltado como incierto cuando falta", () => {
    const item = makeItem({ normalized_summary: { amount: 32, category_id: null } });
    const fields = buildProposalFields(item, () => null);
    const category = fields.find((field) => field.key === "category");
    expect(category?.uncertain).toBe(true);
    expect(category?.value).toBe("Sin categoría");
  });

  it("resuelve la etiqueta real de categoria cuando el resolver la conoce", () => {
    const item = makeItem({ normalized_summary: { amount: 32, category_id: "alimentacion" } });
    const fields = buildProposalFields(item, (id) => (id === "alimentacion" ? "Alimentación" : null));
    const category = fields.find((field) => field.key === "category");
    expect(category?.value).toBe("Alimentación");
    expect(category?.uncertain).toBe(false);
  });

  it("omite campos que el resumen no trae (subtitle, account_hint, fecha)", () => {
    const item = makeItem({
      normalized_summary: { amount: 32, category_id: "alimentacion" },
    });
    const fields = buildProposalFields(item, () => "Alimentación");
    expect(fields.map((field) => field.key)).toEqual(["amount", "category"]);
  });
});

describe("buildConfirmAriaLabel", () => {
  it("18: nombra el monto y la categoria completos, nunca solo 'Registrar'", () => {
    const item = makeItem({ normalized_summary: { amount: 32, subtitle: "Alimentación" } });
    expect(buildConfirmAriaLabel(item)).toBe("Registrar de 32.00 soles en Alimentación");
  });

  it("en riesgo nombra el objeto a eliminar", () => {
    const item = makeItem({
      risk_level: "high",
      normalized_summary: { amount: 18, subtitle: "Transporte" },
    });
    expect(buildConfirmAriaLabel(item)).toBe("Eliminar gasto de 18.00 soles en Transporte");
  });
});
