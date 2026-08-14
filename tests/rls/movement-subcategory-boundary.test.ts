// `SEG-04` (`51` §10, migración `078`): la subcategoría de un movimiento es
// siempre del dueño del movimiento, y la frontera que ya protegía la
// clasificación desde la pantalla sigue exactamente igual de cerrada.
//
// Este fichero cubre las dos mitades de esa frontera:
//
//  1. **La ruta del usuario no quedó más débil.** `commit_movement_classification`
//     (migración `062`) es `security definer` y está concedida a
//     `authenticated`: su primera guarda, `auth.uid() is distinct from
//     p_user_id`, es lo único que impide que cualquier persona autenticada
//     reclasifique los movimientos de otra pasándole el `p_user_id` ajeno. Esa
//     guarda no se tocó, y aquí se comprueba pasándole a userB el id de userA.
//
//  2. **La columna también se defiende.** El asistente no pasa por ese RPC: el
//     camino conversacional escribe por `core_commit_movement_update`
//     (migración `008`), que solo está concedida a `service_role` y solo
//     comprueba que el movimiento sea del usuario, no de quién es la
//     subcategoría. El disparador de `078` cierra ese hueco en la tabla, de
//     modo que ni siquiera la clave de servicio puede enlazar el gasto de una
//     persona con la etiqueta privada de otra.
//
// Necesitan una base de datos real (el stack local de Supabase) y por eso no
// viven en `npm test`: viven en `npm run test:rls`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  crearUsuarioDePrueba,
  limpiarUsuariosDePrueba,
  type UsuarioDePrueba,
} from "./lib/entorno";

let userA: UsuarioDePrueba;
let userB: UsuarioDePrueba;
let movimientoDeA: string;
let subcategoriaDeA: string;
let subcategoriaDeB: string;

async function crearSubcategoria(userId: string, etiqueta: string): Promise<string> {
  const { data, error } = await admin
    .from("user_subcategories")
    .insert({
      user_id: userId,
      category_id: "vivienda_hogar",
      label: etiqueta,
      normalized_label: etiqueta.toLowerCase(),
      created_by: "user",
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  return (data as { id: string }).id;
}

beforeAll(async () => {
  userA = await crearUsuarioDePrueba("subcat-frontera-a");
  userB = await crearUsuarioDePrueba("subcat-frontera-b");

  subcategoriaDeA = await crearSubcategoria(userA.id, `animales_a_${Date.now()}`);
  subcategoriaDeB = await crearSubcategoria(userB.id, `animales_b_${Date.now()}`);

  const { data, error } = await admin
    .from("movements")
    .insert({
      user_id: userA.id,
      type: "gasto",
      status: "confirmed",
      amount: 45,
      currency: "PEN",
      occurred_at: new Date().toISOString(),
      description: "comida de los gatos",
      category_id: "vivienda_hogar",
      source: "dashboard_manual",
      idempotency_key: `subcat-frontera-${Date.now()}`,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  movimientoDeA = (data as { id: string }).id;
});

afterAll(async () => {
  await limpiarUsuariosDePrueba();
});

describe("la ruta autenticada de clasificación sigue igual de cerrada", () => {
  it("userB no puede reclasificar un movimiento de userA pasando su user_id", async () => {
    const { error } = await userB.client.rpc("commit_movement_classification", {
      p_user_id: userA.id,
      p_movement_id: movimientoDeA,
      p_category_id: "vivienda_hogar",
      p_subcategory_id: subcategoriaDeA,
      p_idempotency_key: `intruso-${Date.now()}`,
      p_trace_id: crypto.randomUUID(),
    });

    // La guarda contesta lo mismo que si el movimiento no existiera: desde
    // fuera, "no es tuyo" y "no existe" no se distinguen.
    expect(error?.message).toContain("MOVEMENT_NOT_FOUND");

    const { data } = await admin
      .from("movements")
      .select("subcategory_id")
      .eq("id", movimientoDeA)
      .single();
    expect((data as { subcategory_id: string | null }).subcategory_id).toBeNull();
  });

  it("userA sí puede clasificar lo suyo por esa misma ruta", async () => {
    const { error } = await userA.client.rpc("commit_movement_classification", {
      p_user_id: userA.id,
      p_movement_id: movimientoDeA,
      p_category_id: "vivienda_hogar",
      p_subcategory_id: subcategoriaDeA,
      p_idempotency_key: `propio-${Date.now()}`,
      p_trace_id: crypto.randomUUID(),
    });

    expect(error).toBeNull();

    const { data } = await admin
      .from("movements")
      .select("subcategory_id")
      .eq("id", movimientoDeA)
      .single();
    expect((data as { subcategory_id: string | null }).subcategory_id).toBe(
      subcategoriaDeA,
    );
  });
});

describe("migración 078: la subcategoría de un movimiento es del dueño", () => {
  it("ni la clave de servicio puede enlazarlo con la subcategoría de otra persona", async () => {
    const { error } = await admin
      .from("movements")
      .update({ subcategory_id: subcategoriaDeB })
      .eq("id", movimientoDeA);

    expect(error?.message).toContain("SUBCATEGORY_NOT_FOUND");

    const { data } = await admin
      .from("movements")
      .select("subcategory_id")
      .eq("id", movimientoDeA)
      .single();
    expect((data as { subcategory_id: string | null }).subcategory_id).toBe(
      subcategoriaDeA,
    );
  });

  it("una corrección que no toca la subcategoría no se ve afectada", async () => {
    // El disparador solo mira la columna cuando cambia: si revalidara en cada
    // escritura, cualquier corrección de monto podría morir por algo que no
    // cambió.
    const { error } = await admin
      .from("movements")
      .update({ amount: 50 })
      .eq("id", movimientoDeA);

    expect(error).toBeNull();
  });

  it("archivar la subcategoría no desengancha el movimiento ni bloquea escrituras", async () => {
    // `SCR-CAT-02`: archivar no es borrar, y los movimientos que ya la usan
    // conservan su referencia. Por eso el disparador comprueba pertenencia y
    // no actividad.
    await admin
      .from("user_subcategories")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", subcategoriaDeA);

    const { error } = await admin
      .from("movements")
      .update({ amount: 55 })
      .eq("id", movimientoDeA);

    expect(error).toBeNull();

    const { data } = await admin
      .from("movements")
      .select("subcategory_id")
      .eq("id", movimientoDeA)
      .single();
    expect((data as { subcategory_id: string | null }).subcategory_id).toBe(
      subcategoriaDeA,
    );
  });
});
