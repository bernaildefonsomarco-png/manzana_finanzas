import { describe, expect, it } from "vitest";
import { isFramingSafe } from "./proactive-nudge-worker";

describe("proactive nudge framing guard", () => {
  const safeFacts = {
    title: "Tu gasto semanal cambio",
    amount: 120,
    change_percent: 20,
  };
  const baseText = "Tu gasto semanal cambio 20%. Total: S/120.";

  it("acepta framing que conserva solo hechos permitidos", () => {
    expect(
      isFramingSafe(
        {
          response_text: "Esta semana hubo un cambio de 20%. Total: S/120.",
          preserved_fact_keys: ["amount", "change_percent"],
        },
        safeFacts,
        baseText
      )
    ).toBe(true);
  });

  it("rechaza una cifra inventada por el agente", () => {
    expect(
      isFramingSafe(
        {
          response_text: "Podrias llegar a S/900.",
          preserved_fact_keys: ["amount"],
        },
        safeFacts,
        baseText
      )
    ).toBe(false);
  });

  it("rechaza claves que DisclosureEngine no autorizo", () => {
    expect(
      isFramingSafe(
        {
          response_text: baseText,
          preserved_fact_keys: ["merchant_name"],
        },
        safeFacts,
        baseText
      )
    ).toBe(false);
  });
});
