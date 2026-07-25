import { describe, expect, it } from "vitest";
import type { DedupDecision } from "@/core/dedup";
import {
  decidePendingDedupResolution,
  toMovementInputFromPending,
} from "./confirm-pending";
import type { PendingItem } from "@/shared/types/domain";

describe("pending confirmation dedup policy", () => {
  it("auto-resuelve solo una identidad exacta y trazable", () => {
    expect(
      decidePendingDedupResolution(
        decision({
          status: "exact_duplicate",
          matched_reference_id: "movement-1",
          requires_confirmation: false,
        }),
        false,
      ),
    ).toBe("auto_resolve_exact");
  });

  it("exige consentimiento adicional para una similitud probable", () => {
    expect(
      decidePendingDedupResolution(
        decision({
          status: "probable_duplicate",
          matched_reference_id: "movement-2",
          requires_confirmation: true,
        }),
        false,
      ),
    ).toBe("require_confirmation");
  });

  it("permite continuar cuando el usuario confirma conscientemente", () => {
    expect(
      decidePendingDedupResolution(
        decision({
          status: "possible_duplicate",
          matched_reference_id: "movement-3",
          requires_confirmation: true,
        }),
        true,
      ),
    ).toBe("commit");
  });

  it("no bloquea un movimiento sin evidencia de duplicado", () => {
    expect(decidePendingDedupResolution(null, false)).toBe("commit");
  });

  it("impide confirmar un pago de deuda como movimiento generico", () => {
    expect(() =>
      toMovementInputFromPending({
        id: "11111111-1111-4111-8111-111111111111",
        user_id: "22222222-2222-4222-8222-222222222222",
        type: "ambiguous_movement",
        source: "ambiguous_movement",
        source_ref: "whatsapp:event:action",
        status: "pending",
        proposed_action: { movement_type: "pago_deuda" },
        normalized_summary: {
          title: "Pago de deuda",
          amount: 30,
          currency: "PEN",
          category_id: "deudas",
        },
        risk_level: "medium",
        metadata: {},
        created_at: "2026-07-22T12:00:00.000Z",
        updated_at: "2026-07-22T12:00:00.000Z",
        resolved_at: null,
        expires_at: null,
      } as unknown as PendingItem)
    ).toThrow(/motor financiero especializado/);
  });

  it("preserva cuenta inferida y semantica de devolucion", () => {
    const movement = toMovementInputFromPending({
      id: "11111111-1111-4111-8111-111111111111",
      user_id: "22222222-2222-4222-8222-222222222222",
      type: "email_detected",
      source: "email_pending",
      source_ref: "gmail:message-1",
      status: "pending",
      proposed_action: {
        action: "create_movement",
        movement_type: "devolucion_recibida",
        movement_input: {
          type: "devolucion_recibida",
          amount: 30,
          currency: "PEN",
          occurred_at: "2026-07-22T12:00:00.000Z",
          description: "Devolucion",
          merchant: "Comercio",
          category_id: "otros",
          subcategory_id: null,
          account_origin_id: null,
          account_destination_id:
            "33333333-3333-4333-8333-333333333333",
          box_origin_id: null,
          box_destination_id: null,
          related_person_id: null,
          debt_id: null,
          recurring_rule_id: null,
          recurring_occurrence_id: null,
          source: "email_confirmed",
          source_ref: "gmail:message-1",
          confidence: 0.93,
          requires_review: true,
          metadata: { institution_key: "bank" },
        },
      },
      normalized_summary: {
        title: "Devolucion confirmada",
        amount: 30,
        currency: "PEN",
        category_id: "otros",
        occurred_at: "2026-07-22T12:00:00.000Z",
      },
      risk_level: "low",
      metadata: {},
      created_at: "2026-07-22T12:00:00.000Z",
      updated_at: "2026-07-22T12:00:00.000Z",
      resolved_at: null,
      expires_at: null,
    } as unknown as PendingItem);

    expect(movement).toMatchObject({
      type: "devolucion_recibida",
      account_destination_id: "33333333-3333-4333-8333-333333333333",
      source: "email_confirmed",
      requires_review: false,
    });
  });
});

function decision(
  overrides: Partial<DedupDecision> = {},
): DedupDecision {
  return {
    status: "distinct",
    fingerprint: "fingerprint",
    matched_reference_id: null,
    score: 0,
    reasons: [],
    requires_confirmation: false,
    ...overrides,
  };
}
