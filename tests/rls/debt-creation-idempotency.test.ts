// `AC-API-05` (`14` §7, `WEB-D176`): `createDebt` con la misma
// `Idempotency-Key` no crea una deuda duplicada, incluso bajo dos llamadas
// concurrentes que compiten por el mismo `insert` (el caso que el indice
// unico de la migracion `043` existe para resolver). Contra Postgres real,
// no una tabla simulada.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, crearUsuarioDePrueba, limpiarUsuariosDePrueba, type UsuarioDePrueba } from "./lib/entorno";
import { createDebt } from "@/data/repositories/debts.repository";

let user: UsuarioDePrueba;

beforeAll(async () => {
  user = await crearUsuarioDePrueba("debt-idem");
});

afterAll(async () => {
  await limpiarUsuariosDePrueba();
});

describe("createDebt: idempotencia real (AC-API-05)", () => {
  it("repetir la misma clave devuelve la deuda original, no crea una segunda fila", async () => {
    const idempotencyKey = `debt-idem-${randomUUID()}`;
    const first = await createDebt(admin, {
      userId: user.id,
      direction: "i_owe",
      kind: "personal",
      name: "Prueba idempotencia",
      principalAmount: 100,
      currency: "PEN",
      idempotencyKey,
    });
    const second = await createDebt(admin, {
      userId: user.id,
      direction: "i_owe",
      kind: "personal",
      name: "Prueba idempotencia (segundo intento)",
      principalAmount: 999,
      currency: "PEN",
      idempotencyKey,
    });

    expect(first.idempotent).toBe(false);
    expect(second.idempotent).toBe(true);
    expect(second.debt.id).toBe(first.debt.id);
    expect(second.debt.name).toBe("Prueba idempotencia");

    const { count } = await admin
      .from("debts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("idempotency_key", idempotencyKey);
    expect(count).toBe(1);
  });

  it("dos llamadas concurrentes con la misma clave no duplican (choque real de indice unico)", async () => {
    const idempotencyKey = `debt-idem-concurrent-${randomUUID()}`;
    const [a, b] = await Promise.all([
      createDebt(admin, {
        userId: user.id,
        direction: "i_owe",
        kind: "personal",
        name: "Concurrente A",
        principalAmount: 50,
        currency: "PEN",
        idempotencyKey,
      }),
      createDebt(admin, {
        userId: user.id,
        direction: "i_owe",
        kind: "personal",
        name: "Concurrente B",
        principalAmount: 60,
        currency: "PEN",
        idempotencyKey,
      }),
    ]);

    expect(a.debt.id).toBe(b.debt.id);
    expect([a.idempotent, b.idempotent].filter((v) => v === false)).toHaveLength(1);

    const { count } = await admin
      .from("debts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("idempotency_key", idempotencyKey);
    expect(count).toBe(1);
  });

  it("sin Idempotency-Key, dos llamadas distintas crean dos deudas (comportamiento previo intacto)", async () => {
    const first = await createDebt(admin, {
      userId: user.id,
      direction: "i_owe",
      kind: "personal",
      name: "Sin clave A",
      principalAmount: 10,
      currency: "PEN",
    });
    const second = await createDebt(admin, {
      userId: user.id,
      direction: "i_owe",
      kind: "personal",
      name: "Sin clave B",
      principalAmount: 20,
      currency: "PEN",
    });

    expect(first.debt.id).not.toBe(second.debt.id);
    expect(first.idempotent).toBe(false);
    expect(second.idempotent).toBe(false);
  });
});
