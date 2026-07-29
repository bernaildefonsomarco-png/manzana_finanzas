// RUL-CUENTAS-06/07/13, 24 §7.1, WEB-D migración 049. Invariantes a nivel de
// base de datos: una caja nunca queda con saldo negativo, el nombre de una
// cuenta es único por usuario sin distinguir mayúsculas, y como máximo una
// cuenta activa tiene `is_default = true`. Contra el stack local de Supabase
// (no corre en `npm test`, `WEB-D158`): `npm run test:rls`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, crearUsuarioDePrueba, limpiarUsuariosDePrueba, type UsuarioDePrueba } from "./lib/entorno";
import { createAccount, getActiveAccounts, setDefaultAccount } from "@/data/repositories/accounts.repository";

let user: UsuarioDePrueba;

beforeAll(async () => {
  user = await crearUsuarioDePrueba("invariantes");
});

afterAll(async () => {
  await limpiarUsuariosDePrueba();
});

describe("boxes.current_balance nunca negativo (RUL-CUENTAS-07)", () => {
  it("un update directo que dejaria el saldo en negativo es rechazado por el check de la base", async () => {
    const { data: account, error: accountError } = await admin
      .from("accounts")
      .insert({ user_id: user.id, name: `Cuenta invariante ${Date.now()}`, type: "banco", currency: "PEN" })
      .select("id")
      .single();
    expect(accountError).toBeNull();

    const { data: box, error: boxError } = await admin
      .from("boxes")
      .insert({
        user_id: user.id,
        account_id: (account as { id: string }).id,
        name: `Caja invariante ${Date.now()}`,
        type: "objetivo",
        current_balance: 10,
      })
      .select("id")
      .single();
    expect(boxError).toBeNull();

    const { error: updateError } = await admin
      .from("boxes")
      .update({ current_balance: -5 })
      .eq("id", (box as { id: string }).id);

    expect(updateError).not.toBeNull();
    expect(updateError?.message ?? "").toContain("boxes_current_balance_non_negative");
  });
});

describe("accounts.name único por usuario sin distinguir mayúsculas (24 §7.1)", () => {
  it("crear 'bcp' cuando ya existe 'BCP' para el mismo usuario es rechazado", async () => {
    const suffix = Date.now();
    const { error: firstError } = await admin
      .from("accounts")
      .insert({ user_id: user.id, name: `BCP-${suffix}`, type: "banco", currency: "PEN" });
    expect(firstError).toBeNull();

    const { error: secondError } = await admin
      .from("accounts")
      .insert({ user_id: user.id, name: `bcp-${suffix}`, type: "banco", currency: "PEN" });

    expect(secondError).not.toBeNull();
    expect(secondError?.code).toBe("23505");
  });

  it("dos cuentas archivadas con el mismo nombre no colisionan entre si", async () => {
    const name = `Archivada ${Date.now()}`;
    const now = new Date().toISOString();
    const { error: firstError } = await admin
      .from("accounts")
      .insert({ user_id: user.id, name, type: "banco", currency: "PEN", deleted_at: now });
    expect(firstError).toBeNull();

    const later = new Date(Date.now() + 1000).toISOString();
    const { error: secondError } = await admin
      .from("accounts")
      .insert({ user_id: user.id, name, type: "banco", currency: "PEN", deleted_at: later });

    expect(secondError).toBeNull();
  });
});

describe("AC-CUENTAS-12/RUL-CUENTAS-13: como maximo una cuenta por defecto activa", () => {
  it("setDefaultAccount desmarca la anterior al marcar una nueva", async () => {
    const suffix = Date.now();
    const first = await createAccount(admin, {
      userId: user.id,
      name: `Default A ${suffix}`,
      type: "banco",
      isDefault: true,
    });
    const second = await createAccount(admin, {
      userId: user.id,
      name: `Default B ${suffix}`,
      type: "banco",
      isDefault: false,
    });

    await setDefaultAccount(admin, user.id, second.id);

    const accounts = await getActiveAccounts(admin, user.id);
    const defaults = accounts.filter((account) => [first.id, second.id].includes(account.id) && account.is_default);
    expect(defaults.map((account) => account.id)).toEqual([second.id]);
  });
});
