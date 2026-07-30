import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  admin,
  crearUsuarioDePrueba,
  limpiarUsuariosDePrueba,
  type UsuarioDePrueba,
} from "./lib/entorno";

let owner: UsuarioDePrueba;
let intruder: UsuarioDePrueba;
let rolloverUser: UsuarioDePrueba;
let suggestionUser: UsuarioDePrueba;
let movementKindsUser: UsuarioDePrueba;
let extremeOverspendUser: UsuarioDePrueba;

beforeAll(async () => {
  owner = await crearUsuarioDePrueba("w12-owner");
  intruder = await crearUsuarioDePrueba("w12-intruder");
  rolloverUser = await crearUsuarioDePrueba("w12-rollover");
  suggestionUser = await crearUsuarioDePrueba("w12-suggestions");
  movementKindsUser = await crearUsuarioDePrueba("w12-movement-kinds");
  extremeOverspendUser = await crearUsuarioDePrueba("w12-extreme-overspend");
});

afterAll(async () => {
  await limpiarUsuariosDePrueba();
});

describe("W-12: Core y RLS de presupuestos", () => {
  it("crea por RPC autenticado, reintenta sin duplicar y oculta la fila a otro usuario", async () => {
    const accountId = randomUUID();
    const boxId = randomUUID();
    const accountInsert = await admin.from("accounts").insert({
      id: accountId,
      user_id: owner.id,
      name: "Cuenta que no cambia",
      type: "banco",
      currency: "PEN",
      initial_balance: 1000,
      current_balance: 1000,
      is_default: true,
    });
    const boxInsert = await admin.from("boxes").insert({
      id: boxId,
      user_id: owner.id,
      account_id: accountId,
      name: "Caja que no cambia",
      type: "objetivo",
      current_balance: 200,
      target_amount: 500,
    });
    expect(accountInsert.error).toBeNull();
    expect(boxInsert.error).toBeNull();

    const key = `budget-${randomUUID()}`;
    const first = await commitBudget(owner, {
      operation: "create",
      budgetId: null,
      key,
      payload: {
        amount: 300,
        category_id: null,
        period_kind: "mensual",
        kind: "presupuesto",
        date: "2026-07-10",
      },
    });
    const retry = await commitBudget(owner, {
      operation: "create",
      budgetId: null,
      key,
      payload: {
        amount: 300,
        category_id: null,
        period_kind: "mensual",
        kind: "presupuesto",
        date: "2026-07-10",
      },
    });

    expect(first.error).toBeNull();
    expect(first.data).toMatchObject({
      budget: {
        currency: "PEN",
        base_amount: 300,
        rollover_amount: 0,
        amount: 300,
        period_start: "2026-07-01",
        period_end: "2026-07-31",
      },
      idempotent: false,
    });
    expect(retry.error).toBeNull();
    expect(retry.data).toMatchObject({ idempotent: true });
    const [accountAfter, boxAfter] = await Promise.all([
      admin
        .from("accounts")
        .select("current_balance")
        .eq("id", accountId)
        .single(),
      admin
        .from("boxes")
        .select("current_balance")
        .eq("id", boxId)
        .single(),
    ]);
    expect(accountAfter.data?.current_balance).toBe(1000);
    expect(boxAfter.data?.current_balance).toBe(200);

    const budgetId = jsonRecord(jsonRecord(first.data).budget).id as string;
    const [ownRead, foreignRead, foreignMutation, directWrite, receiptRead] =
      await Promise.all([
        owner.client.from("budgets").select("id").eq("id", budgetId),
        intruder.client.from("budgets").select("id").eq("id", budgetId),
        commitBudget(intruder, {
          operation: "archive",
          budgetId,
          key: `foreign-${randomUUID()}`,
          payload: {},
        }),
        owner.client.from("budgets").insert({
          user_id: owner.id,
          category_id: "otros",
          period_kind: "mensual",
          period_start: "2026-07-01",
          period_end: "2026-07-31",
          base_amount: 10,
          amount: 10,
          kind: "presupuesto",
        }),
        owner.client
          .from("budget_operation_receipts")
          .select("id")
          .limit(1),
      ]);

    expect(ownRead.error).toBeNull();
    expect(ownRead.data).toHaveLength(1);
    expect(foreignRead.error).toBeNull();
    expect(foreignRead.data).toHaveLength(0);
    expect(foreignMutation.data).toBeNull();
    expect(foreignMutation.error?.message).toContain("BUDGET_NOT_FOUND");
    expect(directWrite.error).not.toBeNull();
    expect(receiptRead.error).not.toBeNull();

    const duplicate = await commitBudget(owner, {
      operation: "create",
      budgetId: null,
      key: `duplicate-${randomUUID()}`,
      payload: {
        amount: 500,
        category_id: null,
        period_kind: "mensual",
        kind: "presupuesto",
        date: "2026-07-20",
      },
    });
    expect(duplicate.data).toBeNull();
    expect(duplicate.error?.message).toContain("BUDGET_DUPLICATE");
  });

  it("RUL-PRES-06: la secuencia 72, 92, 86, 97, 110 y 119 emite solo 70/90/100", async () => {
    const created = await commitBudget(owner, {
      operation: "create",
      budgetId: null,
      key: `threshold-${randomUUID()}`,
      payload: {
        amount: 300,
        category_id: "transporte",
        period_kind: "mensual",
        kind: "limite_duro",
        date: "2026-07-05",
      },
    });
    expect(created.error).toBeNull();
    const budgetId = jsonRecord(jsonRecord(created.data).budget).id as string;

    const firstId = await insertMovement(owner.id, {
      amount: 197,
      categoryId: "transporte",
      date: "2026-07-05",
    });
    const removableId = await insertMovement(owner.id, {
      amount: 18,
      categoryId: "transporte",
      date: "2026-07-05",
    });
    expect(firstId).toBeTruthy();
    await runLifecycle(owner.id, "2026-07-05");

    await insertMovement(owner.id, {
      amount: 61,
      categoryId: "transporte",
      date: "2026-07-12",
    });
    await runLifecycle(owner.id, "2026-07-12");

    const removed = await admin
      .from("movements")
      .update({
        status: "deleted",
        deleted_at: "2026-07-14T17:00:00.000Z",
      })
      .eq("id", removableId);
    expect(removed.error).toBeNull();
    await runLifecycle(owner.id, "2026-07-14");

    await insertMovement(owner.id, {
      amount: 33,
      categoryId: "transporte",
      date: "2026-07-18",
    });
    await runLifecycle(owner.id, "2026-07-18");

    await insertMovement(owner.id, {
      amount: 39,
      categoryId: "transporte",
      date: "2026-07-26",
    });
    await runLifecycle(owner.id, "2026-07-26");

    await insertMovement(owner.id, {
      amount: 28,
      categoryId: "transporte",
      date: "2026-07-29",
    });
    await runLifecycle(owner.id, "2026-07-29");
    await runLifecycle(owner.id, "2026-07-29");

    const [budget, events, snapshots] = await Promise.all([
      admin
        .from("budgets")
        .select("alerted_thresholds")
        .eq("id", budgetId)
        .single(),
      admin
        .from("transactional_outbox")
        .select("payload")
        .eq("aggregate_id", budgetId)
        .eq("event_type", "budget_threshold_crossed")
        .order("created_at"),
      owner.client
        .from("budget_progress_snapshots")
        .select("as_of,spent,pct")
        .eq("budget_id", budgetId)
        .order("as_of"),
    ]);

    expect(budget.error).toBeNull();
    expect(budget.data?.alerted_thresholds).toEqual([70, 90, 100]);
    expect(events.error).toBeNull();
    expect(
      events.data?.map((event) => jsonRecord(event.payload).threshold)
    ).toEqual([70, 90, 100]);
    expect(snapshots.error).toBeNull();
    expect(snapshots.data?.at(-1)).toMatchObject({
      as_of: "2026-07-29",
      spent: 358,
    });

    const adjusted = await commitBudget(owner, {
      operation: "update",
      budgetId,
      key: `adjust-${randomUUID()}`,
      payload: { amount: 400 },
    });
    expect(adjusted.error).toBeNull();
    expect(
      jsonRecord(jsonRecord(adjusted.data).budget).alerted_thresholds
    ).toEqual([70, 90, 100]);

    await runLifecycle(owner.id, "2026-08-01");
    const renewed = await admin
      .from("budgets")
      .select("alerted_thresholds,status")
      .eq("user_id", owner.id)
      .eq("category_id", "transporte")
      .eq("period_start", "2026-08-01")
      .single();
    expect(renewed.error).toBeNull();
    expect(renewed.data).toMatchObject({
      alerted_thresholds: [],
      status: "activo",
    });
  });

  it("WEB-D219: solo los tres tipos financieros activos cuentan y pago_deuda exige categoria deudas", async () => {
    const general = await commitBudget(movementKindsUser, {
      operation: "create",
      budgetId: null,
      key: `kinds-general-${randomUUID()}`,
      payload: {
        amount: 1000,
        category_id: null,
        period_kind: "mensual",
        kind: "presupuesto",
        date: "2026-07-05",
      },
    });
    const debts = await commitBudget(movementKindsUser, {
      operation: "create",
      budgetId: null,
      key: `kinds-debts-${randomUUID()}`,
      payload: {
        amount: 1000,
        category_id: "deudas",
        period_kind: "mensual",
        kind: "presupuesto",
        date: "2026-07-05",
      },
    });
    expect(general.error).toBeNull();
    expect(debts.error).toBeNull();
    const generalId = jsonRecord(jsonRecord(general.data).budget).id as string;
    const debtsId = jsonRecord(jsonRecord(debts.data).budget).id as string;

    const allTypes = [
      "gasto",
      "ingreso",
      "transferencia",
      "asignacion_interna",
      "deuda_adquirida",
      "pago_deuda",
      "prestamo_dado",
      "prestamo_recibido",
      "devolucion_recibida",
      "pago_recurrente",
      "ajuste",
    ] as const;
    for (const [index, type] of allTypes.entries()) {
      const status =
        type === "gasto"
          ? "needs_review"
          : type === "pago_recurrente"
            ? "corrected"
            : "confirmed";
      const inserted = await admin.from("movements").insert({
        user_id: movementKindsUser.id,
        type,
        status,
        amount: 10,
        currency: "PEN",
        occurred_at: `2026-07-${String(index + 1).padStart(2, "0")}T17:00:00.000Z`,
        category_id: "deudas",
        source: "dashboard_manual",
        idempotency_key: `w12-kind-${type}-${randomUUID()}`,
      });
      expect(inserted.error).toBeNull();
    }
    for (const status of ["deleted", "reversed"] as const) {
      const inserted = await admin.from("movements").insert({
        user_id: movementKindsUser.id,
        type: "gasto",
        status,
        amount: 50,
        currency: "PEN",
        occurred_at: "2026-07-20T17:00:00.000Z",
        category_id: "deudas",
        source: "dashboard_manual",
        idempotency_key: `w12-inactive-${status}-${randomUUID()}`,
        deleted_at:
          status === "deleted" ? "2026-07-21T17:00:00.000Z" : null,
      });
      expect(inserted.error).toBeNull();
    }
    const outsideDebtPayment = await admin.from("movements").insert({
      user_id: movementKindsUser.id,
      type: "pago_deuda",
      status: "confirmed",
      amount: 40,
      currency: "PEN",
      occurred_at: "2026-07-22T17:00:00.000Z",
      category_id: "alimentacion",
      source: "dashboard_manual",
      idempotency_key: `w12-debt-outside-${randomUUID()}`,
    });
    expect(outsideDebtPayment.error).toBeNull();

    await runLifecycle(movementKindsUser.id, "2026-07-25");
    const snapshots = await admin
      .from("budget_progress_snapshots")
      .select("budget_id,spent")
      .in("budget_id", [generalId, debtsId]);
    expect(snapshots.error).toBeNull();
    expect(
      Object.fromEntries(
        (snapshots.data ?? []).map((snapshot) => [
          snapshot.budget_id,
          snapshot.spent,
        ])
      )
    ).toEqual({
      [generalId]: 30,
      [debtsId]: 30,
    });
  });

  it("los constraints cierran PEN y amount = base + rollover aun para service_role", async () => {
    const invalidCurrency = await admin.from("budgets").insert({
      user_id: movementKindsUser.id,
      category_id: "otros",
      currency: "USD",
      period_kind: "mensual",
      period_start: "2026-10-01",
      period_end: "2026-10-31",
      base_amount: 100,
      rollover_amount: 0,
      amount: 100,
      kind: "presupuesto",
      status: "pausado",
    });
    expect(invalidCurrency.error?.message).toContain("budgets_currency_pen");

    const invalidComposition = await admin.from("budgets").insert({
      user_id: movementKindsUser.id,
      category_id: "otros",
      currency: "PEN",
      period_kind: "mensual",
      period_start: "2026-10-01",
      period_end: "2026-10-31",
      base_amount: 100,
      rollover_amount: 20,
      amount: 100,
      kind: "presupuesto",
      status: "pausado",
    });
    expect(invalidComposition.error?.message).toContain(
      "budgets_amount_is_base_plus_rollover"
    );
  });

  it("AC-PRES-04: un limite duro no bloquea registrar un gasto", async () => {
    const created = await commitBudget(extremeOverspendUser, {
      operation: "create",
      budgetId: null,
      key: `hard-limit-${randomUUID()}`,
      payload: {
        amount: 10,
        category_id: "ocio_salidas",
        period_kind: "mensual",
        kind: "limite_duro",
        date: "2026-08-05",
      },
    });
    expect(created.error).toBeNull();

    const inserted = await admin.from("movements").insert({
      user_id: extremeOverspendUser.id,
      type: "gasto",
      status: "confirmed",
      amount: 100,
      currency: "PEN",
      occurred_at: "2026-08-10T17:00:00.000Z",
      category_id: "ocio_salidas",
      source: "dashboard_manual",
      idempotency_key: `w12-hard-limit-${randomUUID()}`,
    });
    expect(inserted.error).toBeNull();
  });

  it("WEB-D229: un gasto superior a diez veces el presupuesto no rompe el snapshot", async () => {
    const created = await commitBudget(extremeOverspendUser, {
      operation: "create",
      budgetId: null,
      key: `extreme-budget-${randomUUID()}`,
      payload: {
        amount: 10,
        category_id: "vivienda_hogar",
        period_kind: "mensual",
        kind: "presupuesto",
        date: "2026-07-05",
      },
    });
    expect(created.error).toBeNull();
    const budgetId = jsonRecord(jsonRecord(created.data).budget).id as string;
    await insertMovement(extremeOverspendUser.id, {
      amount: 150,
      categoryId: "vivienda_hogar",
      date: "2026-07-20",
    });

    await runLifecycle(extremeOverspendUser.id, "2026-07-25");
    const snapshot = await admin
      .from("budget_progress_snapshots")
      .select("spent,pct")
      .eq("budget_id", budgetId)
      .eq("as_of", "2026-07-25")
      .single();
    expect(snapshot.error).toBeNull();
    expect(snapshot.data).toMatchObject({ spent: 150, pct: 15 });
  });

  it("WEB-D220: el acarreo viejo caduca y solo pasa la base no consumida", async () => {
    const created = await commitBudget(rolloverUser, {
      operation: "create",
      budgetId: null,
      key: `rollover-${randomUUID()}`,
      payload: {
        amount: 400,
        category_id: "alimentacion",
        period_kind: "mensual",
        kind: "presupuesto",
        rollover: true,
        date: "2026-07-05",
      },
    });
    expect(created.error).toBeNull();

    await insertMovement(rolloverUser.id, {
      amount: 340,
      categoryId: "alimentacion",
      date: "2026-07-20",
    });
    await runLifecycle(rolloverUser.id, "2026-08-01");

    const august = await admin
      .from("budgets")
      .select("*")
      .eq("user_id", rolloverUser.id)
      .eq("category_id", "alimentacion")
      .eq("period_start", "2026-08-01")
      .single();
    expect(august.error).toBeNull();
    expect(august.data).toMatchObject({
      base_amount: 400,
      rollover_amount: 60,
      amount: 460,
      alerted_thresholds: [],
    });

    await runLifecycle(rolloverUser.id, "2026-09-01");
    const september = await admin
      .from("budgets")
      .select("base_amount,rollover_amount,amount")
      .eq("user_id", rolloverUser.id)
      .eq("category_id", "alimentacion")
      .eq("period_start", "2026-09-01")
      .single();
    expect(september.error).toBeNull();
    expect(september.data).toEqual({
      base_amount: 400,
      rollover_amount: 400,
      amount: 800,
    });
  });

  it("con auto_renew apagado archiva y no crea el periodo siguiente", async () => {
    const created = await commitBudget(rolloverUser, {
      operation: "create",
      budgetId: null,
      key: `no-renew-${randomUUID()}`,
      payload: {
        amount: 90,
        category_id: "servicios_suscripciones",
        period_kind: "mensual",
        kind: "presupuesto",
        auto_renew: false,
        date: "2026-07-05",
      },
    });
    expect(created.error).toBeNull();
    const budgetId = jsonRecord(jsonRecord(created.data).budget).id as string;

    await runLifecycle(rolloverUser.id, "2026-08-01");
    const [archived, next] = await Promise.all([
      admin.from("budgets").select("status").eq("id", budgetId).single(),
      admin
        .from("budgets")
        .select("id")
        .eq("user_id", rolloverUser.id)
        .eq("category_id", "servicios_suscripciones")
        .eq("period_start", "2026-08-01"),
    ]);
    expect(archived.data?.status).toBe("archivado");
    expect(next.data).toHaveLength(0);
  });
});

describe("W-12: metas y cajas objetivo", () => {
  it("el nombre es unico entre no archivadas sin distinguir mayusculas", async () => {
    const first = await commitGoal(movementKindsUser, {
      operation: "create",
      goalId: null,
      key: `goal-name-a-${randomUUID()}`,
      payload: {
        name: "Fondo familiar",
        target_amount: 1000,
        target_date: "2027-02-28",
      },
    });
    const duplicate = await commitGoal(movementKindsUser, {
      operation: "create",
      goalId: null,
      key: `goal-name-b-${randomUUID()}`,
      payload: {
        name: "fOnDo FaMiLiAr",
        target_amount: 1200,
        target_date: "2027-03-31",
      },
    });
    expect(first.error).toBeNull();
    expect(duplicate.data).toBeNull();
    expect(duplicate.error?.message).toContain("GOAL_DUPLICATE");
  });

  it("sincroniza objetivo/fecha, impide dos metas y desvincula al soft-delete", async () => {
    const { data: account, error: accountError } = await admin
      .from("accounts")
      .insert({
        user_id: owner.id,
        name: `Cuenta meta ${randomUUID()}`,
        type: "banco",
        currency: "PEN",
      })
      .select("id")
      .single();
    expect(accountError).toBeNull();

    const { data: box, error: boxError } = await admin
      .from("boxes")
      .insert({
        user_id: owner.id,
        account_id: account?.id,
        name: `Caja meta ${randomUUID()}`,
        type: "objetivo",
        current_balance: 100,
      })
      .select("id")
      .single();
    expect(boxError).toBeNull();

    const key = `goal-${randomUUID()}`;
    const created = await commitGoal(owner, {
      operation: "create",
      goalId: null,
      key,
      payload: {
        name: "Viaje a Cusco",
        target_amount: 2000,
        target_date: "2026-12-31",
        box_id: box?.id,
      },
    });
    const retry = await commitGoal(owner, {
      operation: "create",
      goalId: null,
      key,
      payload: {
        name: "Viaje a Cusco",
        target_amount: 2000,
        target_date: "2026-12-31",
        box_id: box?.id,
      },
    });
    expect(created.error).toBeNull();
    expect(retry.data).toMatchObject({ idempotent: true });
    const goalId = jsonRecord(jsonRecord(created.data).goal).id as string;

    const synced = await admin
      .from("boxes")
      .select("target_amount,target_date")
      .eq("id", box?.id)
      .single();
    expect(synced.data).toEqual({
      target_amount: 2000,
      target_date: "2026-12-31",
    });

    const otherGoal = await commitGoal(owner, {
      operation: "create",
      goalId: null,
      key: `goal-other-${randomUUID()}`,
      payload: {
        name: "Otra meta",
        target_amount: 500,
        target_date: "2026-11-30",
      },
    });
    expect(otherGoal.error).toBeNull();
    const otherGoalId = jsonRecord(jsonRecord(otherGoal.data).goal).id as string;
    const duplicateBox = await commitGoal(owner, {
      operation: "link_box",
      goalId: otherGoalId,
      key: `goal-link-${randomUUID()}`,
      payload: { box_id: box?.id },
    });
    expect(duplicateBox.data).toBeNull();
    expect(duplicateBox.error?.message).toContain("GOAL_BOX_ALREADY_LINKED");

    const updated = await commitGoal(owner, {
      operation: "update",
      goalId,
      key: `goal-update-${randomUUID()}`,
      payload: {
        target_amount: 2400,
        target_date: "2027-01-31",
      },
    });
    expect(updated.error).toBeNull();
    const resynced = await admin
      .from("boxes")
      .select("target_amount,target_date")
      .eq("id", box?.id)
      .single();
    expect(resynced.data).toEqual({
      target_amount: 2400,
      target_date: "2027-01-31",
    });

    const deleted = await admin
      .from("boxes")
      .update({ deleted_at: "2026-07-30T18:00:00.000Z" })
      .eq("id", box?.id);
    expect(deleted.error).toBeNull();
    const goalAfterDelete = await admin
      .from("goals")
      .select("box_id,status,deleted_at")
      .eq("id", goalId)
      .single();
    expect(goalAfterDelete.data).toEqual({
      box_id: null,
      status: "activa",
      deleted_at: null,
    });

    const hidden = await intruder.client
      .from("goals")
      .select("id")
      .eq("id", goalId);
    expect(hidden.error).toBeNull();
    expect(hidden.data).toHaveLength(0);
  });
});

describe("W-12: sugerencias deterministas", () => {
  it("usa mediana exacta, persiste solo la ventana y acepta por el mismo Core", async () => {
    for (const sample of [
      ["2026-04-10", 360],
      ["2026-05-10", 385],
      ["2026-06-10", 378],
    ] as const) {
      await insertMovement(suggestionUser.id, {
        amount: sample[1],
        categoryId: "alimentacion",
        date: sample[0],
      });
    }
    for (const sample of [
      ["2026-05-12", 100],
      ["2026-06-12", 100.01],
    ] as const) {
      await insertMovement(suggestionUser.id, {
        amount: sample[1],
        categoryId: "transporte",
        date: sample[0],
      });
    }

    const listed = await suggestionUser.client.rpc(
      "get_budget_suggestions",
      {
        p_period_kind: "mensual",
        p_as_of: "2026-07-30",
      }
    );
    expect(listed.error).toBeNull();
    const suggestions = listed.data as Array<Record<string, unknown>>;
    const food = suggestions.find(
      (suggestion) => suggestion.category_id === "alimentacion"
    );
    const transport = suggestions.find(
      (suggestion) => suggestion.category_id === "transporte"
    );
    expect(food).toMatchObject({
      suggestion_key:
        "bs_alimentacion_mensual_2026-04-01_2026-06-30",
      proposed_amount: 378,
      sample_count: 3,
    });
    expect(transport).toMatchObject({
      suggestion_key:
        "bs_transporte_mensual_2026-05-01_2026-06-30",
      proposed_amount: 100.01,
      sample_count: 2,
    });

    const dismissKey = `dismiss-${randomUUID()}`;
    const dismissed = await suggestionUser.client.rpc(
      "resolve_budget_suggestion",
      {
        p_suggestion_key: food?.suggestion_key as string,
        p_resolution: "dismissed",
        p_payload: { trace_id: randomUUID() },
        p_idempotency_key: dismissKey,
      }
    );
    const dismissRetry = await suggestionUser.client.rpc(
      "resolve_budget_suggestion",
      {
        p_suggestion_key: food?.suggestion_key as string,
        p_resolution: "dismissed",
        p_payload: { trace_id: randomUUID() },
        p_idempotency_key: dismissKey,
      }
    );
    expect(dismissed.error).toBeNull();
    expect(dismissed.data).toMatchObject({ idempotent: false });
    expect(dismissRetry.error).toBeNull();
    expect(dismissRetry.data).toMatchObject({ idempotent: true });

    const accepted = await suggestionUser.client.rpc(
      "resolve_budget_suggestion",
      {
        p_suggestion_key: transport?.suggestion_key as string,
        p_resolution: "accepted",
        p_payload: {
          amount: 110,
          rollover: false,
          auto_renew: true,
          trace_id: randomUUID(),
        },
        p_idempotency_key: `accept-${randomUUID()}`,
      }
    );
    expect(accepted.error).toBeNull();
    expect(accepted.data).toMatchObject({
      budget: {
        category_id: "transporte",
        base_amount: 110,
        amount: 110,
        source: "sugerido",
      },
      decision: {
        resolution: "accepted",
      },
      idempotent: false,
    });

    const relisted = await suggestionUser.client.rpc(
      "get_budget_suggestions",
      {
        p_period_kind: "mensual",
        p_as_of: "2026-07-30",
      }
    );
    expect(relisted.error).toBeNull();
    expect(relisted.data).toEqual([]);

    const ownDecisions = await suggestionUser.client
      .from("budget_suggestion_decisions")
      .select("suggestion_key");
    const foreignDecisions = await intruder.client
      .from("budget_suggestion_decisions")
      .select("suggestion_key");
    expect(ownDecisions.data).toHaveLength(2);
    expect(foreignDecisions.data).toHaveLength(0);
  });
});

async function runLifecycle(userId: string, asOf: string) {
  const result = await admin.rpc("run_budget_daily_lifecycle", {
    p_as_of: asOf,
    p_user_id: userId,
  });
  expect(result.error).toBeNull();
  return result;
}

async function insertMovement(
  userId: string,
  input: { amount: number; categoryId: string; date: string }
) {
  const id = randomUUID();
  const { error } = await admin.from("movements").insert({
    id,
    user_id: userId,
    type: "gasto",
    status: "confirmed",
    amount: input.amount,
    currency: "PEN",
    occurred_at: `${input.date}T17:00:00.000Z`,
    category_id: input.categoryId,
    source: "dashboard_manual",
    idempotency_key: `w12-movement-${randomUUID()}`,
  });
  expect(error).toBeNull();
  return id;
}

function commitBudget(
  user: UsuarioDePrueba,
  input: {
    operation: string;
    budgetId: string | null;
    payload: Record<string, unknown>;
    key: string;
  }
) {
  return user.client.rpc("commit_budget_operation", {
    p_operation: input.operation,
    p_budget_id: input.budgetId,
    p_payload: { ...input.payload, trace_id: randomUUID() },
    p_idempotency_key: input.key,
  });
}

function commitGoal(
  user: UsuarioDePrueba,
  input: {
    operation: string;
    goalId: string | null;
    payload: Record<string, unknown>;
    key: string;
  }
) {
  return user.client.rpc("commit_goal_operation", {
    p_operation: input.operation,
    p_goal_id: input.goalId,
    p_payload: { ...input.payload, trace_id: randomUUID() },
    p_idempotency_key: input.key,
  });
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
