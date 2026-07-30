import { describe, expect, it } from "vitest";
import {
  CATEGORY_IDS,
  MOVEMENT_SOURCES,
  MOVEMENT_TYPES,
  PENDING_SOURCES,
  PENDING_STATUSES,
  PENDING_TYPES,
  type CategoryId,
  type MovementType,
} from "./domain";

describe("CategoryId", () => {
  it("contiene exactamente 12 categorias canonicas", () => {
    expect(CATEGORY_IDS).toHaveLength(12);
  });

  it("incluye las categorias sensibles definidas en el plan", () => {
    const sensitiveExpected: CategoryId[] = ["salud", "deudas", "familia_apoyo"];

    sensitiveExpected.forEach((category) => {
      expect(CATEGORY_IDS).toContain(category);
    });
  });

  it("'otros' existe como categoria y no existe 'sin_clasificar'", () => {
    expect(CATEGORY_IDS).toContain("otros");
    expect(CATEGORY_IDS).not.toContain("sin_clasificar" as CategoryId);
  });
});

describe("MovementType", () => {
  it("contiene exactamente 11 tipos canonicos de movimiento", () => {
    expect(MOVEMENT_TYPES).toHaveLength(11);
  });

  it("incluye los tipos financieros que no son gasto generico", () => {
    const expected: MovementType[] = [
      "pago_deuda",
      "transferencia",
      "asignacion_interna",
      "devolucion_recibida",
    ];

    expected.forEach((type) => {
      expect(MOVEMENT_TYPES).toContain(type);
    });
  });
});

describe("MovementSource", () => {
  it("usa solo fuentes para movimientos confirmados", () => {
    expect(MOVEMENT_SOURCES).toEqual([
      "whatsapp",
      "dashboard_manual",
      "email_confirmed",
      "recurring_confirmed",
      "backfill_confirmed",
      "system_adjustment",
    ]);
  });
});

describe("PendingStatus", () => {
  it("mantiene los estados canonicos completos de pending_items", () => {
    expect(PENDING_STATUSES).toEqual([
      "pending",
      "sent_for_confirmation",
      "user_confirmed",
      "user_edited",
      "discarded",
      "auto_resolved_duplicate",
      "already_registered",
      "expired",
      "archived",
    ]);
  });
});

describe("PendingSource", () => {
  it("separa fuentes pendientes de fuentes confirmadas", () => {
    expect(PENDING_SOURCES).toEqual([
      "email_pending",
      "backfill_pending",
      "recurring_candidate",
      "ambiguous_movement",
      "risk_confirmation",
    ]);
  });
});

describe("PendingType", () => {
  it("cubre los tipos definidos para la bandeja de pendientes", () => {
    expect(PENDING_TYPES).toEqual([
      "email_detected",
      "ambiguous_movement",
      "recurring_candidate",
      "backfill_item",
      "data_quality",
      "risk_confirmation",
    ]);
  });
});
