// SCR-CAT-02/03 (`25` §8, migración 050): `count_movements_by_subcategory()`
// cuenta solo los movimientos propios del usuario (RLS via `auth.uid()`),
// excluye transferencias/asignaciones internas (RUL-CAT-11) y no ve los
// movimientos de otro usuario.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, crearUsuarioDePrueba, limpiarUsuariosDePrueba, type UsuarioDePrueba } from "./lib/entorno";

let userA: UsuarioDePrueba;
let userB: UsuarioDePrueba;
let subcategoryId: string;

beforeAll(async () => {
  userA = await crearUsuarioDePrueba("subcat-counts-a");
  userB = await crearUsuarioDePrueba("subcat-counts-b");

  const { data: account, error: accountError } = await admin
    .from("accounts")
    .insert({ user_id: userA.id, name: `Cuenta ${Date.now()}`, type: "banco", currency: "PEN" })
    .select("id")
    .single();
  expect(accountError).toBeNull();

  const { data: subcategory, error: subcategoryError } = await admin
    .from("user_subcategories")
    .insert({
      user_id: userA.id,
      category_id: "transporte",
      label: `Uber ${Date.now()}`,
      normalized_label: `uber_${Date.now()}`,
      created_by: "user",
    })
    .select("id")
    .single();
  expect(subcategoryError).toBeNull();
  subcategoryId = (subcategory as { id: string }).id;

  const accountId = (account as { id: string }).id;
  const movements = [
    { type: "gasto", amount: 10 },
    { type: "gasto", amount: 20 },
    { type: "transferencia", amount: 30 },
  ];
  for (const movement of movements) {
    const { error } = await admin.from("movements").insert({
      user_id: userA.id,
      type: movement.type,
      status: "confirmed",
      amount: movement.amount,
      currency: "PEN",
      occurred_at: new Date().toISOString(),
      category_id: "transporte",
      subcategory_id: subcategoryId,
      source: "dashboard_manual",
      idempotency_key: `subcat-count-${Date.now()}-${Math.random()}`,
      account_origin_id: accountId,
    });
    expect(error).toBeNull();
  }
});

afterAll(async () => {
  await limpiarUsuariosDePrueba();
});

describe("count_movements_by_subcategory()", () => {
  it("cuenta solo gasto (2), excluye la transferencia (RUL-CAT-11)", async () => {
    const { data, error } = await userA.client.rpc("count_movements_by_subcategory");

    expect(error).toBeNull();
    const row = (data as { subcategory_id: string; movement_count: number }[]).find(
      (r) => r.subcategory_id === subcategoryId
    );
    expect(row?.movement_count).toBe(2);
  });

  it("un usuario distinto no ve los movimientos de userA (RLS)", async () => {
    const { data, error } = await userB.client.rpc("count_movements_by_subcategory");

    expect(error).toBeNull();
    const row = (data as { subcategory_id: string; movement_count: number }[]).find(
      (r) => r.subcategory_id === subcategoryId
    );
    expect(row).toBeUndefined();
  });
});
