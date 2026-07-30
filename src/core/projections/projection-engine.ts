import type {
  DebtDirection,
  InstallmentStatus,
  MovementStatus,
  MovementType,
} from "@/shared/types/domain";
import {
  addCalendarDays,
  daysInMonth,
  isoDateInLima,
  parseIsoDate,
  toIsoDate,
} from "@/shared/dates/lima";

const ACTIVE_MOVEMENT_STATUSES = new Set<MovementStatus>([
  "confirmed",
  "needs_review",
  "corrected",
]);
const SITUATION_SPEND_TYPES = new Set<MovementType>([
  "gasto",
  "pago_recurrente",
  "pago_deuda",
]);
const OPEN_INSTALLMENT_STATUSES = new Set<InstallmentStatus>([
  "pending",
  "due_soon",
  "overdue",
]);
const FORBIDDEN_VERDICT_WORDS =
  /\b(deberias|te conviene|mejor|recomiendo|no te alcanza|riesgo|peligro|malo)\b/i;

export type ProjectionMovement = {
  id: string;
  type: MovementType;
  amount_cents: number;
  currency: "PEN" | "USD";
  occurred_at: string;
  status: MovementStatus;
  deleted_at?: string | null;
  recurring_rule_id?: string | null;
  recurring_occurrence_id?: string | null;
  debt_id?: string | null;
};

export type ProjectionAssumption =
  | {
      kind: "commitments_already_discounted";
      amount_cents: number;
      refs: string[];
    }
  | {
      kind: "daily_pace";
      amount_cents: number;
      basis: "median_14_lima_calendar_days";
      refs: string[];
    }
  | {
      kind: "days_remaining";
      value: number;
      refs: [];
    }
  | {
      kind: "future_income";
      amount_cents: 0;
      basis: "not_available_v1";
      refs: [];
    };

export type ProjectionRange = {
  min_cents: number;
  max_cents: number;
};

export type PeriodProjection = {
  currency: "PEN";
  period_start: string;
  period_end: string;
  as_of: string;
  free_money_cents: number;
  uncovered_commitments_cents: number;
  observed_days: number;
  sample_start: string | null;
  sample_end: string;
  daily_spend_cents: number[];
  daily_pace_cents: number;
  q1_cents: number;
  q3_cents: number;
  iqr_cents: number;
  days_remaining: number;
  sufficient_data: boolean;
  insufficiency_reason: "no_movements" | "fewer_than_7_observable_days" | null;
  projection_cents: number | null;
  range: ProjectionRange | null;
  assumptions: ProjectionAssumption[];
};

export type SimulationPart =
  | {
      kind: "immediate_effect";
      free_money_before_cents: number;
      simulated_amount_cents: number;
      free_money_after_cents: number;
    }
  | {
      kind: "already_counted";
      uncovered_commitments_cents: number;
      refs: string[];
    }
  | {
      kind: "projected_close";
      available: boolean;
      projection_cents: number | null;
      range: ProjectionRange | null;
      assumptions: ProjectionAssumption[];
    };

export type ExpenseSimulation = {
  currency: "PEN";
  parts: [SimulationPart, SimulationPart, SimulationPart];
};

export type SituationBox = {
  id: string;
  current_balance_cents: number;
  currency: "PEN" | "USD";
  deleted_at?: string | null;
};

export type SituationInstallment = {
  id: string;
  direction: DebtDirection;
  status: InstallmentStatus;
  due_date: string;
};

type ComponentAvailability = "available" | "not_available";

export type MonthlySituation = {
  currency: "PEN";
  period_start: string;
  period_end: string;
  as_of: string;
  coverage: {
    availability: "available";
    uncovered_cents: number;
    covered: boolean;
    refs: string[];
  };
  spending_income: {
    availability: ComponentAvailability;
    spending_cents: number;
    income_cents: number;
    ratio_basis_points: number | null;
    refs: string[];
  };
  reserve: {
    availability: "available";
    total_cents: number;
    refs: string[];
  };
  debts: {
    availability: "available";
    overdue_count: number;
    due_this_month_count: number;
    refs: string[];
  };
  summary_facts: string[];
};

export function calculatePeriodProjection(input: {
  now: Date;
  freeMoneyCents: number;
  uncoveredCommitmentsCents: number;
  commitmentRefs?: string[];
  movements: ProjectionMovement[];
}): PeriodProjection {
  assertIntegerCents(input.freeMoneyCents, "freeMoneyCents");
  assertNonNegativeIntegerCents(
    input.uncoveredCommitmentsCents,
    "uncoveredCommitmentsCents",
  );

  const calendar = currentLimaMonth(input.now);
  const activePenMovements = input.movements.filter(
    (movement) =>
      isActiveMovement(movement) &&
      movement.currency === "PEN" &&
      localDateForMovement(movement) >= calendar.start &&
      localDateForMovement(movement) <= calendar.today,
  );
  const firstMovementDate = activePenMovements
    .map(localDateForMovement)
    .sort()[0] ?? null;
  const observedDays = firstMovementDate
    ? calendarDaysBetween(firstMovementDate, calendar.today) + 1
    : 0;
  const sampleStart = firstMovementDate
    ? maxIsoDate(
        firstMovementDate,
        calendar.start,
        addCalendarDays(calendar.today, -13),
      )
    : null;
  const spendByDate = new Map<string, number>();
  const paceRefs: string[] = [];

  if (sampleStart) {
    for (const movement of activePenMovements) {
      const movementDate = localDateForMovement(movement);
      if (
        movementDate < sampleStart ||
        !isCurrentSpendMovement(movement)
      ) {
        continue;
      }
      assertNonNegativeIntegerCents(
        movement.amount_cents,
        `movement ${movement.id} amount_cents`,
      );
      spendByDate.set(
        movementDate,
        (spendByDate.get(movementDate) ?? 0) + movement.amount_cents,
      );
      paceRefs.push(movement.id);
    }
  }

  const dailySpendCents = sampleStart
    ? isoDateRange(sampleStart, calendar.today).map(
        (date) => spendByDate.get(date) ?? 0,
      )
    : [];
  const q1Cents = quantileLinearCents(dailySpendCents, 0.25);
  const dailyPaceCents = quantileLinearCents(dailySpendCents, 0.5);
  const q3Cents = quantileLinearCents(dailySpendCents, 0.75);
  const iqrCents = q3Cents - q1Cents;
  const sufficientData = observedDays >= 7;
  const highDispersion =
    dailyPaceCents === 0
      ? iqrCents > 0
      : iqrCents * 2 > dailyPaceCents;
  const projectionCents =
    input.freeMoneyCents - dailyPaceCents * calendar.daysRemaining;
  const range = highDispersion
    ? {
        min_cents:
          input.freeMoneyCents - q3Cents * calendar.daysRemaining,
        max_cents:
          input.freeMoneyCents - q1Cents * calendar.daysRemaining,
      }
    : null;
  const commitmentRefs = unique(input.commitmentRefs ?? []);
  const assumptions: ProjectionAssumption[] = [
    {
      kind: "commitments_already_discounted",
      amount_cents: input.uncoveredCommitmentsCents,
      refs: commitmentRefs,
    },
    {
      kind: "daily_pace",
      amount_cents: dailyPaceCents,
      basis: "median_14_lima_calendar_days",
      refs: unique(paceRefs),
    },
    {
      kind: "days_remaining",
      value: calendar.daysRemaining,
      refs: [],
    },
    {
      kind: "future_income",
      amount_cents: 0,
      basis: "not_available_v1",
      refs: [],
    },
  ];

  return {
    currency: "PEN",
    period_start: calendar.start,
    period_end: calendar.end,
    as_of: calendar.today,
    free_money_cents: input.freeMoneyCents,
    uncovered_commitments_cents: input.uncoveredCommitmentsCents,
    observed_days: observedDays,
    sample_start: sampleStart,
    sample_end: calendar.today,
    daily_spend_cents: dailySpendCents,
    daily_pace_cents: dailyPaceCents,
    q1_cents: q1Cents,
    q3_cents: q3Cents,
    iqr_cents: iqrCents,
    days_remaining: calendar.daysRemaining,
    sufficient_data: sufficientData,
    insufficiency_reason:
      firstMovementDate === null
        ? "no_movements"
        : sufficientData
          ? null
          : "fewer_than_7_observable_days",
    projection_cents:
      sufficientData && !highDispersion ? projectionCents : null,
    range: sufficientData ? range : null,
    assumptions,
  };
}

export function simulateExpense(input: {
  projection: PeriodProjection;
  amountCents: number;
}): ExpenseSimulation {
  assertPositiveIntegerCents(input.amountCents, "amountCents");

  const projectedClose = input.projection.sufficient_data
    ? input.projection.range
      ? {
          projection_cents: null,
          range: {
            min_cents:
              input.projection.range.min_cents - input.amountCents,
            max_cents:
              input.projection.range.max_cents - input.amountCents,
          },
        }
      : {
          projection_cents:
            (input.projection.projection_cents ?? 0) - input.amountCents,
          range: null,
        }
    : { projection_cents: null, range: null };
  const commitmentAssumption = input.projection.assumptions.find(
    (assumption) => assumption.kind === "commitments_already_discounted",
  );

  return {
    currency: "PEN",
    parts: [
      {
        kind: "immediate_effect",
        free_money_before_cents: input.projection.free_money_cents,
        simulated_amount_cents: input.amountCents,
        free_money_after_cents:
          input.projection.free_money_cents - input.amountCents,
      },
      {
        kind: "already_counted",
        uncovered_commitments_cents:
          commitmentAssumption?.amount_cents ?? 0,
        refs: commitmentAssumption?.refs ?? [],
      },
      {
        kind: "projected_close",
        available: input.projection.sufficient_data,
        projection_cents: projectedClose.projection_cents,
        range: projectedClose.range,
        assumptions: input.projection.assumptions,
      },
    ],
  };
}

export function calculateMonthlySituation(input: {
  now: Date;
  uncoveredCommitmentsCents: number;
  commitmentRefs?: string[];
  boxes: SituationBox[];
  movements: ProjectionMovement[];
  installments: SituationInstallment[];
}): MonthlySituation {
  assertNonNegativeIntegerCents(
    input.uncoveredCommitmentsCents,
    "uncoveredCommitmentsCents",
  );
  const calendar = currentLimaMonth(input.now);
  const monthMovements = input.movements.filter((movement) => {
    if (!isActiveMovement(movement) || movement.currency !== "PEN") {
      return false;
    }
    const date = localDateForMovement(movement);
    return date >= calendar.start && date <= calendar.today;
  });
  const spendingMovements = monthMovements.filter((movement) =>
    SITUATION_SPEND_TYPES.has(movement.type),
  );
  const incomeMovements = monthMovements.filter(
    (movement) => movement.type === "ingreso",
  );
  const spendingCents = sumMovementCents(spendingMovements);
  const incomeCents = sumMovementCents(incomeMovements);
  const activePenBoxes = input.boxes.filter(
    (box) => box.currency === "PEN" && !box.deleted_at,
  );
  const reserveCents = activePenBoxes.reduce((total, box) => {
    assertNonNegativeIntegerCents(
      box.current_balance_cents,
      `box ${box.id} current_balance_cents`,
    );
    return total + box.current_balance_cents;
  }, 0);
  const relevantInstallments = input.installments.filter(
    (installment) =>
      installment.direction === "i_owe" &&
      OPEN_INSTALLMENT_STATUSES.has(installment.status) &&
      (installment.status === "overdue" ||
        (installment.due_date >= calendar.start &&
          installment.due_date <= calendar.end)),
  );
  const overdueCount = relevantInstallments.filter(
    (installment) =>
      installment.status === "overdue" ||
      installment.due_date < calendar.today,
  ).length;
  const dueThisMonthCount = relevantInstallments.filter(
    (installment) =>
      installment.due_date >= calendar.start &&
      installment.due_date <= calendar.end,
  ).length;
  const ratioBasisPoints =
    incomeCents > 0 ? Math.round((spendingCents * 10_000) / incomeCents) : null;
  const coverageRefs = unique(input.commitmentRefs ?? []);
  const movementRefs = unique(
    [...spendingMovements, ...incomeMovements].map((movement) => movement.id),
  );
  const installmentRefs = unique(
    relevantInstallments.map((installment) => installment.id),
  );
  const summaryFacts = [
    input.uncoveredCommitmentsCents === 0
      ? "Tus compromisos conocidos estan cubiertos."
      : `Faltan ${formatPenCents(input.uncoveredCommitmentsCents)} para cubrir tus compromisos conocidos.`,
    ratioBasisPoints === null
      ? "No hay ingresos confirmados este mes para calcular la relacion entre gasto e ingreso."
      : `Este mes llevas gastado ${formatBasisPoints(ratioBasisPoints)} de lo que te entro.`,
    reserveCents === 0
      ? "No tienes dinero apartado en cajas."
      : `Tienes ${formatPenCents(reserveCents)} apartados en cajas.`,
    overdueCount > 0
      ? `Tienes ${overdueCount} ${pluralize(overdueCount, "cuota vencida", "cuotas vencidas")}.`
      : dueThisMonthCount > 0
        ? `Tus ${dueThisMonthCount} ${pluralize(dueThisMonthCount, "cuota abierta de este mes no esta vencida", "cuotas abiertas de este mes no estan vencidas")}.`
        : "No tienes cuotas propias abiertas que venzan este mes.",
  ];

  if (summaryFacts.some((fact) => FORBIDDEN_VERDICT_WORDS.test(fact))) {
    throw new Error("La situacion mensual no puede contener un veredicto");
  }

  return {
    currency: "PEN",
    period_start: calendar.start,
    period_end: calendar.end,
    as_of: calendar.today,
    coverage: {
      availability: "available",
      uncovered_cents: input.uncoveredCommitmentsCents,
      covered: input.uncoveredCommitmentsCents === 0,
      refs: coverageRefs,
    },
    spending_income: {
      availability: incomeCents > 0 ? "available" : "not_available",
      spending_cents: spendingCents,
      income_cents: incomeCents,
      ratio_basis_points: ratioBasisPoints,
      refs: movementRefs,
    },
    reserve: {
      availability: "available",
      total_cents: reserveCents,
      refs: activePenBoxes.map((box) => box.id),
    },
    debts: {
      availability: "available",
      overdue_count: overdueCount,
      due_this_month_count: dueThisMonthCount,
      refs: installmentRefs,
    },
    summary_facts: summaryFacts,
  };
}

export function quantileLinearCents(
  values: number[],
  percentile: number,
): number {
  if (percentile < 0 || percentile > 1) {
    throw new Error("El percentil debe estar entre 0 y 1");
  }
  if (values.length === 0) return 0;
  for (const value of values) {
    assertNonNegativeIntegerCents(value, "quantile value");
  }
  const sorted = [...values].sort((left, right) => left - right);
  const position = percentile * (sorted.length - 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const fraction = position - lowerIndex;
  return Math.round(
    sorted[lowerIndex] +
      (sorted[upperIndex] - sorted[lowerIndex]) * fraction,
  );
}

function isActiveMovement(movement: ProjectionMovement): boolean {
  return (
    !movement.deleted_at &&
    ACTIVE_MOVEMENT_STATUSES.has(movement.status)
  );
}

function isCurrentSpendMovement(movement: ProjectionMovement): boolean {
  return (
    movement.type === "gasto" &&
    !movement.recurring_rule_id &&
    !movement.recurring_occurrence_id &&
    !movement.debt_id
  );
}

function localDateForMovement(movement: ProjectionMovement): string {
  const instant = new Date(movement.occurred_at);
  if (!Number.isFinite(instant.getTime())) {
    throw new Error(`Fecha invalida en movimiento ${movement.id}`);
  }
  return isoDateInLima(instant);
}

function currentLimaMonth(now: Date): {
  today: string;
  start: string;
  end: string;
  daysRemaining: number;
} {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("now debe ser una fecha valida");
  }
  const today = isoDateInLima(now);
  const parts = parseIsoDate(today);
  if (!parts) throw new Error("No se pudo resolver la fecha de Lima");
  const start = toIsoDate(parts.year, parts.month, 1);
  const end = toIsoDate(
    parts.year,
    parts.month,
    daysInMonth(parts.year, parts.month),
  );
  return {
    today,
    start,
    end,
    daysRemaining: calendarDaysBetween(today, end),
  };
}

function calendarDaysBetween(from: string, to: string): number {
  const fromParts = parseIsoDate(from);
  const toParts = parseIsoDate(to);
  if (!fromParts || !toParts) throw new Error("Rango de fechas invalido");
  const fromMs = Date.UTC(fromParts.year, fromParts.month, fromParts.day);
  const toMs = Date.UTC(toParts.year, toParts.month, toParts.day);
  return Math.round((toMs - fromMs) / 86_400_000);
}

function isoDateRange(from: string, to: string): string[] {
  const days = calendarDaysBetween(from, to);
  if (days < 0) return [];
  return Array.from({ length: days + 1 }, (_, index) =>
    addCalendarDays(from, index),
  );
}

function maxIsoDate(...dates: string[]): string {
  return [...dates].sort().at(-1) ?? dates[0];
}

function sumMovementCents(movements: ProjectionMovement[]): number {
  return movements.reduce((total, movement) => {
    assertNonNegativeIntegerCents(
      movement.amount_cents,
      `movement ${movement.id} amount_cents`,
    );
    return total + movement.amount_cents;
  }, 0);
}

function assertIntegerCents(value: number, field: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${field} debe estar expresado en centimos enteros`);
  }
}

function assertNonNegativeIntegerCents(value: number, field: string): void {
  assertIntegerCents(value, field);
  if (value < 0) throw new Error(`${field} no puede ser negativo`);
}

function assertPositiveIntegerCents(value: number, field: string): void {
  assertIntegerCents(value, field);
  if (value <= 0) throw new Error(`${field} debe ser mayor que cero`);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function formatPenCents(cents: number): string {
  return `S/${(cents / 100).toFixed(2)}`;
}

function formatBasisPoints(basisPoints: number): string {
  const percent = basisPoints / 100;
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(2)}%`;
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}
