// AC-PEND-01 / RUL-PEND-01, 27 §4.2, migración 053. La propia base de datos
// impide que exista un pendiente activo (pending, sent_for_confirmation,
// user_edited — ACTIVE_PENDING_STATUSES en pending.repository.ts) marcado
// como confirmable sin un confirm_command que lo respalde. Contra el stack
// local de Supabase (no corre en `npm test`, `WEB-D158`): `npm run test:rls`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, crearUsuarioDePrueba, limpiarUsuariosDePrueba, type UsuarioDePrueba } from "./lib/entorno";

let user: UsuarioDePrueba;

beforeAll(async () => {
  user = await crearUsuarioDePrueba("confirmable");
});

afterAll(async () => {
  await limpiarUsuariosDePrueba();
});

async function intentarInsertarPendiente(status: string) {
  return admin.from("pending_items").insert({
    user_id: user.id,
    type: "ambiguous_movement",
    source: "ambiguous_movement",
    status,
    proposed_action: {},
    normalized_summary: {},
    confirmable: true,
    confirm_command: null,
  });
}

describe("pending_items_confirmable_has_command (AC-PEND-01, migración 053)", () => {
  it.each(["pending", "sent_for_confirmation", "user_edited"])(
    "rechaza confirmable=true sin confirm_command cuando status='%s'",
    async (status) => {
      const { error } = await intentarInsertarPendiente(status);
      expect(error).not.toBeNull();
      expect(error?.message ?? "").toContain("pending_items_confirmable_has_command");
    },
  );

  it.each(["user_confirmed", "discarded", "expired"])(
    "permite confirmable=true sin confirm_command en un estado terminal ('%s') — la regla es solo sobre activos",
    async (status) => {
      const { error } = await intentarInsertarPendiente(status);
      expect(error).toBeNull();
    },
  );

  it("permite confirmable=true con confirm_command en un pendiente activo", async () => {
    const { error } = await admin.from("pending_items").insert({
      user_id: user.id,
      type: "ambiguous_movement",
      source: "ambiguous_movement",
      status: "pending",
      proposed_action: {},
      normalized_summary: {},
      confirmable: true,
      confirm_command: { action: "record_generic_movement" },
    });
    expect(error).toBeNull();
  });
});
