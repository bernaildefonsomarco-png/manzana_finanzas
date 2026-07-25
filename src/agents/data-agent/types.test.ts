import { describe, expect, it } from "vitest";
import { ProposedActionSchema } from "./types";

const action = {
  action_id: "action_1",
  movement_type: "gasto",
  amount: 20,
  currency: "PEN",
  occurred_at: "2026-07-18T12:00:00.000-05:00",
  description: "desayuno",
  category_id: "alimentacion",
  subcategory_id: null,
  tags: [],
  account_origin_id: null,
  account_destination_id: null,
  box_origin_id: null,
  box_destination_id: null,
  debt_hint: null,
  recurring_hint: null,
  related_person_hint: null,
  source_evidence: [],
  confidence: 0.98,
};

describe("ProposedActionSchema", () => {
  it("acepta solo las categorias base canonicas", () => {
    expect(ProposedActionSchema.parse(action).category_id).toBe("alimentacion");

    expect(() =>
      ProposedActionSchema.parse({
        ...action,
        category_id: "cafes_creada_por_el_agente",
      }),
    ).toThrow();
  });
});
