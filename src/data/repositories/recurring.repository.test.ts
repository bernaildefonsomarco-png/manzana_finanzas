import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  createRecurringRule,
  listUpcomingCommitments,
} from "./recurring.repository";

describe("createRecurringRule", () => {
  it("AC-REC-12: la petición crea la regla, pero deja las ocurrencias al trabajo programado", async () => {
    const savedRule = {
      id: "11111111-1111-4111-8111-111111111111",
      user_id: "user-1",
      status: "active",
      name: "Internet",
      merchant_pattern: null,
      expected_amount: 89,
      amount_variability: "fixed",
      currency: "PEN",
      frequency: "monthly",
      day_of_month: 29,
      date_window_start_day: null,
      date_window_end_day: null,
      next_expected_date: "2026-08-29",
      category_id: null,
      subcategory_id: null,
      default_account_id: null,
      linked_box_id: null,
      linked_debt_id: null,
      source: "dashboard_manual",
      confidence: 1,
      requires_confirmation_for_payment: true,
      last_paid_at: null,
      last_paid_amount: null,
      created_at: "2026-07-29T12:00:00.000Z",
      updated_at: "2026-07-29T12:00:00.000Z",
      deleted_at: null,
      cancelled_at: null,
      metadata: {},
    };
    const single = vi.fn().mockResolvedValue({ data: savedRule, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn((table: string) => {
      if (table !== "recurring_rules") {
        throw new Error(`La petición intentó escribir ${table}`);
      }
      return { insert };
    });

    const result = await createRecurringRule(
      { from } as never,
      {
        userId: "user-1",
        name: "Internet",
        expectedAmount: 89,
        amountVariability: "fixed",
        currency: "PEN",
        frequency: "monthly",
        nextExpectedDate: "2026-08-29",
      }
    );

    expect(result).toEqual({ ...savedRule, occurrences: [] });
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("recurring_rules");
  });

  it("AC-REC-12: ni crear ni editar una regla materializa ocurrencias", () => {
    const source = readFileSync(
      new URL("./recurring.repository.ts", import.meta.url),
      "utf8"
    );
    const createSection = source.slice(
      source.indexOf("export async function createRecurringRule"),
      source.indexOf("export async function getRecurringRuleById")
    );
    const updateSection = source.slice(
      source.indexOf("export async function updateRecurringRule"),
      source.indexOf("export async function cancelRecurringRule")
    );

    expect(createSection).not.toContain("ensureOccurrence");
    expect(updateSection).not.toContain("ensureOccurrence");
  });

  it("repetir la creación con la misma key devuelve la misma regla sin otro insert", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T12:00:00.000-05:00"));
    let stored: Record<string, unknown> | null = null;
    const maybeSingle = vi.fn(async () => ({ data: stored, error: null }));
    const lookup = {
      eq: vi.fn(),
      maybeSingle,
    };
    lookup.eq.mockReturnValue(lookup);
    const single = vi.fn(async () => {
      stored = {
        ...baseSavedRule(),
        ...(pendingInsert as Record<string, unknown>),
      };
      return { data: stored, error: null };
    });
    const insertResult = { select: vi.fn(() => ({ single })) };
    let pendingInsert: unknown = null;
    const insert = vi.fn((payload: unknown) => {
      pendingInsert = payload;
      return insertResult;
    });
    const from = vi.fn(() => ({
      select: vi.fn(() => lookup),
      insert,
    }));
    const client = { from } as never;
    const input = {
      userId: "user-1",
      name: "Internet",
      expectedAmount: 89,
      amountVariability: "fixed" as const,
      currency: "PEN" as const,
      frequency: "monthly" as const,
      nextExpectedDate: "2026-08-29",
      idempotencyKey: "recurring-create-key-1",
    };

    const first = await createRecurringRule(client, input);
    vi.setSystemTime(new Date("2026-08-30T12:00:00.000-05:00"));
    const replay = await createRecurringRule(client, input);

    expect(replay.id).toBe(first.id);
    expect(insert).toHaveBeenCalledTimes(1);

    await expect(
      createRecurringRule(client, { ...input, expectedAmount: 99 })
    ).rejects.toThrow("RECURRING_RULE_IDEMPOTENCY_CONFLICT");
    vi.useRealTimers();
  });

  it("rechaza una fecha pasada antes de insertar una regla nueva", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T12:00:00.000-05:00"));
    const from = vi.fn();

    await expect(
      createRecurringRule(
        { from } as never,
        {
          userId: "user-1",
          name: "Internet vencido",
          expectedAmount: 89,
          amountVariability: "fixed",
          currency: "PEN",
          frequency: "monthly",
          nextExpectedDate: "2026-07-28",
        }
      )
    ).rejects.toThrow("RECURRING_RULE_NEXT_DATE_IN_PAST");
    expect(from).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("listUpcomingCommitments", () => {
  it("WEB-D207: variable sin estimacion aceptada no descuenta el monto viejo de una ocurrencia", async () => {
    const recurringRule = {
      ...baseSavedRule(),
      amount_variability: "variable",
      expected_amount: null,
      next_expected_date: "2026-08-10",
    };
    const occurrence = {
      id: "22222222-2222-4222-8222-222222222222",
      user_id: "user-1",
      recurring_rule_id: recurringRule.id,
      expected_date: "2026-08-10",
      expected_amount: 80,
      status: "expected",
      paid_at: null,
      paid_movement_id: null,
      metadata: {},
      created_at: "2026-07-29T12:00:00.000Z",
      updated_at: "2026-07-29T12:00:00.000Z",
    };
    const from = vi.fn((table: string) =>
      thenableQuery(table === "recurring_rules" ? [recurringRule] : [occurrence])
    );

    const result = await listUpcomingCommitments(
      { from } as never,
      "user-1",
      60,
      new Date("2026-07-29T12:00:00.000-05:00")
    );

    expect(result).toEqual([]);
  });
});

function baseSavedRule() {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "user-1",
    status: "active",
    name: "Internet",
    merchant_pattern: null,
    expected_amount: 89,
    amount_variability: "fixed",
    currency: "PEN",
    frequency: "monthly",
    day_of_month: 29,
    date_window_start_day: null,
    date_window_end_day: null,
    next_expected_date: "2026-08-29",
    category_id: null,
    subcategory_id: null,
    default_account_id: null,
    linked_box_id: null,
    linked_debt_id: null,
    source: "dashboard_manual",
    confidence: 1,
    requires_confirmation_for_payment: true,
    last_paid_at: null,
    last_paid_amount: null,
    created_at: "2026-07-29T12:00:00.000Z",
    updated_at: "2026-07-29T12:00:00.000Z",
    deleted_at: null,
    cancelled_at: null,
    metadata: {},
  };
}

function thenableQuery(data: unknown[]) {
  const result = { data, error: null };
  const query: Record<string, unknown> & PromiseLike<typeof result> = {
    then(onfulfilled, onrejected) {
      return Promise.resolve(result).then(onfulfilled, onrejected);
    },
  };
  for (const method of ["select", "eq", "is", "order", "in", "lte"]) {
    query[method] = vi.fn(() => query);
  }
  return query;
}
