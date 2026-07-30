import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  admin,
  crearUsuarioDePrueba,
  limpiarUsuariosDePrueba,
  type UsuarioDePrueba,
} from "./lib/entorno";

let user: UsuarioDePrueba;

beforeAll(async () => {
  user = await crearUsuarioDePrueba("w11-recurring-create");
});

afterAll(async () => {
  await limpiarUsuariosDePrueba();
});

describe("W-11: contrato de creación recurrente", () => {
  it("ERR-REC-01: el nombre activo es unico por usuario sin distinguir mayusculas", async () => {
    const first = await admin.from("recurring_rules").insert({
      user_id: user.id,
      name: "Seguro Vehicular",
      amount_variability: "fixed",
      expected_amount: 120,
      currency: "PEN",
      frequency: "monthly",
      next_expected_date: "2026-08-15",
      requires_confirmation_for_payment: true,
    });
    expect(first.error).toBeNull();

    const duplicate = await admin.from("recurring_rules").insert({
      user_id: user.id,
      name: "  seguro vehicular  ",
      amount_variability: "fixed",
      expected_amount: 125,
      currency: "PEN",
      frequency: "monthly",
      next_expected_date: "2026-09-15",
      requires_confirmation_for_payment: true,
    });
    expect(duplicate.error).not.toBeNull();
    expect(duplicate.error?.message ?? "").toContain(
      "recurring_rules_user_active_name_unique"
    );
  });

  it("permite variable sin estimación, pero la base exige monto para fixed", async () => {
    const variable = await admin.from("recurring_rules").insert({
      user_id: user.id,
      name: "Luz",
      amount_variability: "variable",
      expected_amount: null,
      currency: "PEN",
      frequency: "monthly",
      next_expected_date: "2026-08-15",
      requires_confirmation_for_payment: true,
    });
    expect(variable.error).toBeNull();

    const fixed = await admin.from("recurring_rules").insert({
      user_id: user.id,
      name: "Internet",
      amount_variability: "fixed",
      expected_amount: null,
      currency: "PEN",
      frequency: "monthly",
      next_expected_date: "2026-08-20",
      requires_confirmation_for_payment: true,
    });
    expect(fixed.error).not.toBeNull();
    expect(fixed.error?.message ?? "").toContain(
      "recurring_rules_fixed_amount_required"
    );
  });

  it("la key de creación es única por usuario y el par key/hash es inseparable", async () => {
    const key = `recurring-${randomUUID()}`;
    const hash = createHash("sha256").update("payload").digest("hex");
    const first = await admin.from("recurring_rules").insert({
      user_id: user.id,
      name: "Streaming",
      amount_variability: "fixed",
      expected_amount: 44.9,
      currency: "PEN",
      frequency: "monthly",
      next_expected_date: "2026-08-14",
      requires_confirmation_for_payment: true,
      creation_idempotency_key: key,
      creation_request_hash: hash,
    });
    expect(first.error).toBeNull();

    const duplicate = await admin.from("recurring_rules").insert({
      user_id: user.id,
      name: "Streaming duplicado",
      amount_variability: "fixed",
      expected_amount: 99,
      currency: "PEN",
      frequency: "monthly",
      next_expected_date: "2026-08-14",
      requires_confirmation_for_payment: true,
      creation_idempotency_key: key,
      creation_request_hash: hash,
    });
    expect(duplicate.error).not.toBeNull();

    const incompletePair = await admin.from("recurring_rules").insert({
      user_id: user.id,
      name: "Par incompleto",
      amount_variability: "fixed",
      expected_amount: 10,
      currency: "PEN",
      frequency: "monthly",
      next_expected_date: "2026-08-14",
      requires_confirmation_for_payment: true,
      creation_idempotency_key: `recurring-${randomUUID()}`,
      creation_request_hash: null,
    });
    expect(incompletePair.error).not.toBeNull();
    expect(incompletePair.error?.message ?? "").toContain(
      "recurring_rules_creation_idempotency_pair"
    );
  });

  it("authenticated no puede insertar reglas saltándose el endpoint", async () => {
    const { error } = await user.client.from("recurring_rules").insert({
      user_id: user.id,
      name: "No autorizado",
      amount_variability: "fixed",
      expected_amount: 10,
      currency: "PEN",
      frequency: "monthly",
      next_expected_date: "2026-08-14",
      requires_confirmation_for_payment: true,
    });

    expect(error).not.toBeNull();
    expect(error?.message.toLowerCase() ?? "").toMatch(
      /row-level security|permission denied/
    );
  });
});
