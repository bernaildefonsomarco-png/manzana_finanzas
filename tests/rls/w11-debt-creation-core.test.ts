import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  admin,
  crearUsuarioDePrueba,
  limpiarUsuariosDePrueba,
  type UsuarioDePrueba,
} from "./lib/entorno";

let user: UsuarioDePrueba;

beforeAll(async () => {
  user = await crearUsuarioDePrueba("w11-debt-core");
});

afterAll(async () => {
  await limpiarUsuariosDePrueba();
});

describe("W-11: commit_debt_creation contra Postgres real", () => {
  it("crea atomicamente una deuda sin inventar una persona relacionada", async () => {
    const idempotencyKey = `w11-debt-without-person-${randomUUID()}`;
    const debtId = randomUUID();
    const result = await commitDebt({
      debtId,
      idempotencyKey,
      dueDate: "2026-09-15",
    });

    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({
      debt: {
        id: debtId,
        related_person_id: null,
        due_date: "2026-09-15",
      },
      idempotent: false,
    });

    const { data: rows, error } = await admin
      .from("debts")
      .select("id, related_person_id, due_date")
      .eq("user_id", user.id)
      .eq("idempotency_key", idempotencyKey);

    expect(error).toBeNull();
    expect(rows).toEqual([
      {
        id: debtId,
        related_person_id: null,
        due_date: "2026-09-15",
      },
    ]);
  });

  it("reintenta el mismo payload, pero rechaza reutilizar la clave con otro vencimiento", async () => {
    const idempotencyKey = `w11-debt-due-date-${randomUUID()}`;
    const first = await commitDebt({
      debtId: randomUUID(),
      idempotencyKey,
      dueDate: "2026-10-05",
      relatedPersonName: "Empresa Demo",
    });
    const retry = await commitDebt({
      debtId: randomUUID(),
      idempotencyKey,
      dueDate: "2026-10-05",
      relatedPersonName: "Empresa Demo",
    });
    const conflict = await commitDebt({
      debtId: randomUUID(),
      idempotencyKey,
      dueDate: "2026-10-06",
      relatedPersonName: "Empresa Demo",
    });

    expect(first.error).toBeNull();
    expect(first.data).toMatchObject({ idempotent: false });
    expect(retry.error).toBeNull();
    expect(retry.data).toMatchObject({
      debt: { id: debtIdOf(first.data) },
      idempotent: true,
    });
    expect(conflict.data).toBeNull();
    expect(conflict.error?.message).toContain(
      "DEBT_CREATION_IDEMPOTENCY_CONFLICT",
    );
  });
});

function commitDebt(input: {
  debtId: string;
  idempotencyKey: string;
  dueDate: string;
  relatedPersonName?: string;
}) {
  return admin.rpc("commit_debt_creation", {
    p_debt: {
      id: input.debtId,
      user_id: user.id,
      direction: "i_owe",
      kind: "service_or_bill",
      name: "Servicio sin persona",
      related_person_name: input.relatedPersonName ?? null,
      principal_amount: 180,
      currency: "PEN",
      opened_at: "2026-07-29",
      due_date: input.dueDate,
      first_due_date: null,
      installment_count: null,
      installment_amount: null,
      interest_notes: null,
      source: "dashboard_manual",
      idempotency_key: input.idempotencyKey,
      metadata: {
        account_id: null,
        movement_type: "deuda_adquirida",
      },
    },
    p_related_person_normalized_name:
      input.relatedPersonName?.toLowerCase() ?? null,
    p_installments: [],
    p_movement: null,
    p_movement_audit_logs: [],
    p_account_deltas: [],
    p_box_deltas: [],
    p_movement_outbox_events: [],
    p_debt_outbox_events: [],
  });
}

function debtIdOf(value: unknown): string {
  if (
    !value ||
    typeof value !== "object" ||
    !("debt" in value) ||
    !value.debt ||
    typeof value.debt !== "object" ||
    !("id" in value.debt) ||
    typeof value.debt.id !== "string"
  ) {
    throw new Error("commit_debt_creation devolvio una deuda invalida");
  }
  return value.debt.id;
}
