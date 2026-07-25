import { describe, expect, it } from "vitest";
import type { PendingItem } from "@/shared/types/domain";
import { formatPendingAge, toPendingViewItem } from "./pending-view-model";

const basePending: PendingItem = {
  id: "pending-1",
  user_id: "user-1",
  type: "email_detected",
  status: "pending",
  source: "email_pending",
  source_ref: "email-1",
  proposed_action: {},
  normalized_summary: {
    title: "Netflix",
    subtitle: "Tarjeta terminada en 4092",
    amount: 15.49,
    currency: "PEN",
    category_id: "servicios_suscripciones",
  },
  dedup_status: null,
  risk_level: "low",
  expires_at: null,
  sent_for_confirmation_at: null,
  resolved_at: null,
  resolved_by: null,
  created_at: "2026-06-07T12:00:00.000Z",
  updated_at: "2026-06-07T12:00:00.000Z",
  metadata: {},
};

describe("formatPendingAge", () => {
  it("devuelve una edad humana para pendientes recientes", () => {
    expect(
      formatPendingAge(
        "2026-06-07T11:30:00.000Z",
        new Date("2026-06-07T12:00:00.000Z")
      )
    ).toBe("Hace 30 min");
  });
});

describe("toPendingViewItem", () => {
  it("marca como incompleto cuando falta categoria", () => {
    const viewItem = toPendingViewItem({
      ...basePending,
      normalized_summary: {
        ...basePending.normalized_summary,
        category_id: null,
      },
    });

    expect(viewItem.needsCompletion).toBe(true);
    expect(viewItem.reasonLabel).toBe("Falta categoría");
  });

  it("separa fuente pendiente de movimiento confirmado", () => {
    const viewItem = toPendingViewItem(basePending);

    expect(viewItem.sourceLabel).toBe("Email detectado");
    expect(viewItem.reasonLabel).toBe("Detectado, no registrado");
  });

  it("no exige categoria a un pago de deuda ya resuelto", () => {
    const viewItem = toPendingViewItem({
      ...basePending,
      proposed_action: {
        action: "record_debt_payment",
        debt_id: "11111111-1111-4111-8111-111111111111",
      },
      normalized_summary: {
        ...basePending.normalized_summary,
        category_id: null,
      },
    });

    expect(viewItem.needsCompletion).toBe(false);
    expect(viewItem.reasonLabel).toBe("Pago de deuda listo para validar");
  });

  it("mantiene transferencia incompleta hasta tener ambas cuentas", () => {
    const viewItem = toPendingViewItem({
      ...basePending,
      proposed_action: {
        action: "record_transfer",
        account_origin_id: "11111111-1111-4111-8111-111111111111",
        account_destination_id: null,
      },
      normalized_summary: {
        ...basePending.normalized_summary,
        category_id: null,
      },
    });

    expect(viewItem.needsCompletion).toBe(true);
    expect(viewItem.reasonLabel).toBe("Transferencia lista para validar");
  });
});
