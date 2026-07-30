import { describe, expect, it } from "vitest";
import type { MovementType } from "@/shared/types/domain";
import {
  calculateMonthlySituation,
  calculatePeriodProjection,
  quantileLinearCents,
  simulateExpense,
  type ProjectionMovement,
} from "./projection-engine";

const NOW = new Date("2026-07-26T17:00:00.000Z");

describe("Projection Engine", () => {
  it("WEB-D224: mediana y cuartiles usan interpolacion lineal sobre centimos", () => {
    expect(quantileLinearCents([0, 100, 200, 300], 0.25)).toBe(75);
    expect(quantileLinearCents([0, 100, 200, 300], 0.5)).toBe(150);
    expect(quantileLinearCents([0, 100, 200, 300], 0.75)).toBe(225);
  });

  it("AC-PROY-02/02b: 560 - 62 x 5 = 250 y no vuelve a restar 89 de compromisos", () => {
    const projection = calculatePeriodProjection({
      now: NOW,
      freeMoneyCents: 56_000,
      uncoveredCommitmentsCents: 8_900,
      commitmentRefs: ["internet-28"],
      movements: dailyMovements("2026-07-13", Array(14).fill(6_200)),
    });

    expect(projection.daily_pace_cents).toBe(6_200);
    expect(projection.days_remaining).toBe(5);
    expect(projection.projection_cents).toBe(25_000);
    expect(projection.projection_cents).not.toBe(16_100);
    expect(projection.assumptions[0]).toEqual({
      kind: "commitments_already_discounted",
      amount_cents: 8_900,
      refs: ["internet-28"],
    });
  });

  it("AC-PROY-03: usa 14 dias civiles Lima, incluye ceros y excluye compromisos", () => {
    const ordinary = dailyMovements(
      "2026-07-13",
      [1_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    );
    const linked = dailyMovements(
      "2026-07-13",
      Array(14).fill(10_000),
      "pago_recurrente",
      { recurring_rule_id: "internet" },
    );
    const projection = calculatePeriodProjection({
      now: NOW,
      freeMoneyCents: 56_000,
      uncoveredCommitmentsCents: 0,
      movements: [...ordinary, ...linked],
    });

    expect(projection.daily_spend_cents).toHaveLength(14);
    expect(projection.daily_spend_cents.filter((amount) => amount === 0)).toHaveLength(13);
    expect(projection.daily_pace_cents).toBe(0);
    expect(
      projection.assumptions.find((item) => item.kind === "daily_pace")?.refs,
    ).not.toContain("pago_recurrente-0");
  });

  it("WEB-D219/227: confirmed, needs_review y corrected son estados activos", () => {
    const movements = dailyMovements(
      "2026-07-20",
      Array(7).fill(100),
    );
    movements[0] = { ...movements[0], status: "needs_review" };
    movements[1] = { ...movements[1], status: "corrected" };
    movements[2] = { ...movements[2], status: "deleted" };
    const projection = calculatePeriodProjection({
      now: NOW,
      freeMoneyCents: 10_000,
      uncoveredCommitmentsCents: 0,
      movements,
    });
    const situation = calculateMonthlySituation({
      now: NOW,
      uncoveredCommitmentsCents: 0,
      boxes: [],
      movements,
      installments: [],
    });

    expect(projection.daily_spend_cents).toEqual([
      100,
      100,
      0,
      100,
      100,
      100,
      100,
    ]);
    expect(situation.spending_income.spending_cents).toBe(600);
  });

  it("AC-PROY-04: IQR alto produce rango Q3-Q1 ordenado, no cifra unica", () => {
    const projection = calculatePeriodProjection({
      now: NOW,
      freeMoneyCents: 10_000,
      uncoveredCommitmentsCents: 0,
      movements: dailyMovements(
        "2026-07-20",
        [100, 0, 0, 0, 1_000, 1_000, 1_000],
      ),
    });

    expect(projection).toMatchObject({
      sufficient_data: true,
      daily_pace_cents: 100,
      q1_cents: 0,
      q3_cents: 1_000,
      iqr_cents: 1_000,
      projection_cents: null,
      range: { min_cents: 5_000, max_cents: 10_000 },
    });
  });

  it("AC-PROY-05: antes de siete dias civiles observables no proyecta", () => {
    const projection = calculatePeriodProjection({
      now: NOW,
      freeMoneyCents: 10_000,
      uncoveredCommitmentsCents: 0,
      movements: dailyMovements("2026-07-21", [100, 100, 100, 100, 100, 100]),
    });

    expect(projection).toMatchObject({
      observed_days: 6,
      sufficient_data: false,
      insufficiency_reason: "fewer_than_7_observable_days",
      projection_cents: null,
      range: null,
    });
  });

  it("AC-PROY-06/07: simular devuelve tres partes neutrales y no escribe ni emite veredicto", () => {
    const projection = calculatePeriodProjection({
      now: NOW,
      freeMoneyCents: 56_000,
      uncoveredCommitmentsCents: 8_900,
      commitmentRefs: ["internet-28"],
      movements: dailyMovements("2026-07-13", Array(14).fill(6_200)),
    });
    const simulation = simulateExpense({
      projection,
      amountCents: 30_000,
    });

    expect(simulation.parts.map((part) => part.kind)).toEqual([
      "immediate_effect",
      "already_counted",
      "projected_close",
    ]);
    expect(simulation.parts[0]).toMatchObject({
      free_money_before_cents: 56_000,
      simulated_amount_cents: 30_000,
      free_money_after_cents: 26_000,
    });
    expect(simulation.parts[1]).toMatchObject({
      uncovered_commitments_cents: 8_900,
      refs: ["internet-28"],
    });
    expect(simulation.parts[2]).toMatchObject({
      available: true,
      projection_cents: -5_000,
    });
    expect(JSON.stringify(simulation)).not.toMatch(
      /verdict|deberias|te conviene|mejor|recomiendo|no te alcanza|riesgo|peligro|malo/i,
    );
  });

  it("AC-PROY-09/10/11: mismo estado y reloj explicito dan el mismo resultado, sin ingresos futuros", () => {
    const input = {
      now: NOW,
      freeMoneyCents: 56_000,
      uncoveredCommitmentsCents: 8_900,
      movements: dailyMovements("2026-07-13", Array(14).fill(6_200)),
    };

    const first = calculatePeriodProjection(input);
    const second = calculatePeriodProjection(input);

    expect(second).toEqual(first);
    expect(first.assumptions).toContainEqual({
      kind: "future_income",
      amount_cents: 0,
      basis: "not_available_v1",
      refs: [],
    });
  });
});

describe("situacion mensual", () => {
  it("WEB-D227: calcula cuatro componentes PEN observables con referencias y sin score", () => {
    const situation = calculateMonthlySituation({
      now: NOW,
      uncoveredCommitmentsCents: 8_900,
      commitmentRefs: ["internet"],
      boxes: [
        { id: "caja-pen", current_balance_cents: 50_000, currency: "PEN" },
        { id: "caja-usd", current_balance_cents: 99_000, currency: "USD" },
        {
          id: "caja-borrada",
          current_balance_cents: 20_000,
          currency: "PEN",
          deleted_at: "2026-07-20T00:00:00.000Z",
        },
      ],
      movements: [
        movement("gasto", 5_000, "2026-07-02"),
        movement("pago_recurrente", 10_000, "2026-07-03"),
        movement("pago_deuda", 15_000, "2026-07-04"),
        movement("ingreso", 40_000, "2026-07-05"),
        movement("transferencia", 90_000, "2026-07-06"),
        movement("gasto", 80_000, "2026-06-30"),
      ],
      installments: [
        {
          id: "vencida",
          direction: "i_owe",
          status: "overdue",
          due_date: "2026-06-20",
        },
        {
          id: "julio",
          direction: "i_owe",
          status: "pending",
          due_date: "2026-07-30",
        },
        {
          id: "a-favor",
          direction: "they_owe_me",
          status: "overdue",
          due_date: "2026-07-10",
        },
        {
          id: "agosto",
          direction: "i_owe",
          status: "pending",
          due_date: "2026-08-10",
        },
      ],
    });

    expect(situation.coverage).toEqual({
      availability: "available",
      uncovered_cents: 8_900,
      covered: false,
      refs: ["internet"],
    });
    expect(situation.spending_income).toMatchObject({
      availability: "available",
      spending_cents: 30_000,
      income_cents: 40_000,
      ratio_basis_points: 7_500,
    });
    expect(situation.reserve).toEqual({
      availability: "available",
      total_cents: 50_000,
      refs: ["caja-pen"],
    });
    expect(situation.debts).toEqual({
      availability: "available",
      overdue_count: 1,
      due_this_month_count: 1,
      refs: ["vencida", "julio"],
    });
    expect(JSON.stringify(situation)).not.toMatch(
      /score|puntua|letra|deberias|recomiendo|malo/i,
    );
  });

  it("sin ingresos confirmados no divide entre cero ni inventa proporcion", () => {
    const situation = calculateMonthlySituation({
      now: NOW,
      uncoveredCommitmentsCents: 0,
      boxes: [],
      movements: [movement("gasto", 5_000, "2026-07-02")],
      installments: [],
    });

    expect(situation.spending_income).toMatchObject({
      availability: "not_available",
      income_cents: 0,
      ratio_basis_points: null,
    });
  });
});

function dailyMovements(
  start: string,
  values: number[],
  type: MovementType = "gasto",
  links: Partial<ProjectionMovement> = {},
): ProjectionMovement[] {
  return values.flatMap((amount, index) =>
    amount === 0
      ? []
      : [
          {
            id: `${type}-${index}`,
            type,
            amount_cents: amount,
            currency: "PEN",
            occurred_at: `${addDays(start, index)}T17:00:00.000Z`,
            status: "confirmed",
            deleted_at: null,
            ...links,
          },
        ],
  );
}

function movement(
  type: MovementType,
  amountCents: number,
  date: string,
): ProjectionMovement {
  return {
    id: `${type}-${date}`,
    type,
    amount_cents: amountCents,
    currency: "PEN",
    occurred_at: `${date}T17:00:00.000Z`,
    status: "confirmed",
    deleted_at: null,
  };
}

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}
