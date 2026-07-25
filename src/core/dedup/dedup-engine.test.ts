import { describe, expect, it } from "vitest";
import { decideDedup, prefilterDedupCandidates } from "./dedup-engine";

const base = {
  reference_id: "incoming",
  movement_type: "gasto" as const,
  amount: 20,
  currency: "PEN" as const,
  occurred_at: "2026-07-18T10:00:00-05:00",
  description: "Desayuno",
  merchant: "Cafe Central",
  source: "whatsapp" as const,
  source_ref: "wamid-1",
};

describe("DedupEngine cross-channel", () => {
  it("resuelve como exacto un duplicado fuerte entre WhatsApp y email", () => {
    const candidates = prefilterDedupCandidates(base, [{
      ...base,
      reference_id: "movement-1",
      source: "email_confirmed",
      source_ref: "email-1",
    }]);
    const decision = decideDedup({ incoming: base, candidates });
    expect(decision.status).toBe("exact_duplicate");
    expect(decision.requires_confirmation).toBe(false);
    expect(decision.reasons).toContain("strict_cross_channel_match");
  });

  it("pide confirmacion cuando entre canales solo coincide la evidencia base", () => {
    const candidates = prefilterDedupCandidates(
      { ...base, description: "desayuno", merchant: null },
      [{
        ...base,
        reference_id: "movement-uncertain",
        description: "operacion bancaria",
        merchant: null,
        source: "email_confirmed",
        source_ref: "email-uncertain",
      }],
    );
    const decision = decideDedup({
      incoming: { ...base, description: "desayuno", merchant: null },
      candidates,
    });
    expect(decision.status).toBe("possible_duplicate");
    expect(decision.requires_confirmation).toBe(true);
  });

  it("no mezcla dos cafes separados en el tiempo solo por monto y comercio", () => {
    const candidates = prefilterDedupCandidates(base, [{
      ...base,
      reference_id: "movement-2",
      occurred_at: "2026-07-17T10:00:00-05:00",
      source_ref: "wamid-old",
    }]);
    const decision = decideDedup({ incoming: base, candidates });
    expect(decision.status).not.toBe("exact_duplicate");
    expect(decision.status).not.toBe("probable_duplicate");
  });

  it("ignora de forma exacta solo la misma referencia de la misma fuente", () => {
    const candidates = prefilterDedupCandidates(base, [{ ...base, reference_id: "movement-3" }]);
    expect(decideDedup({ incoming: base, candidates }).status).toBe("exact_duplicate");
  });
});
