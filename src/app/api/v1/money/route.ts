import { z } from "zod";
import {
  getActiveAccounts,
  getActiveBoxes,
} from "@/data/repositories/accounts.repository";
import { listDebtInstallmentCommitments } from "@/data/repositories/debts.repository";
import { listUpcomingCommitments } from "@/data/repositories/recurring.repository";
import type { UpcomingCommitmentSummary } from "@/data/repositories/recurring.repository";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import type { Account, Box } from "@/shared/types/domain";
import type {
  AccountMoneySummary,
  BoxMoneySummary,
  MoneyDashboardResponse,
} from "@/shared/api/money-types";
import {
  calculateMoneyLayers,
  COMMITMENT_HORIZON_DAYS,
} from "@/core/finance/money-layers";

export const dynamic = "force-dynamic";
const MoneyQuerySchema = z.object({}).strict();

export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    MoneyQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries())
    );

    const [accounts, boxes, recurringCommitments, debtCommitments] = await Promise.all([
      getActiveAccounts(auth.client, auth.userId),
      getActiveBoxes(auth.client, auth.userId),
      listUpcomingCommitments(auth.client, auth.userId, COMMITMENT_HORIZON_DAYS),
      listDebtInstallmentCommitments(auth.client, auth.userId, COMMITMENT_HORIZON_DAYS),
    ]);
    const commitments = [...recurringCommitments, ...debtCommitments].sort(
      compareCommitments
    );

    return okJson(buildMoneyResponse(accounts, boxes, commitments), meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function buildMoneyResponse(
  accounts: Account[],
  boxes: Box[],
  commitments: UpcomingCommitmentSummary[]
): MoneyDashboardResponse {
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const boxesByAccount = new Map<string, Box[]>();
  for (const box of boxes) {
    const current = boxesByAccount.get(box.account_id) ?? [];
    current.push(box);
    boxesByAccount.set(box.account_id, current);
  }

  const accountSummaries: AccountMoneySummary[] = accounts.map((account) => {
    const accountBoxes = boxesByAccount.get(account.id) ?? [];
    const boxesTotal = roundMoney(
      accountBoxes.reduce((sum, box) => sum + Number(box.current_balance), 0)
    );
    const currentBalance = Number(account.current_balance);
    const freeBalance = roundMoney(currentBalance - boxesTotal);

    return {
      ...account,
      current_balance: roundMoney(currentBalance),
      initial_balance: roundMoney(Number(account.initial_balance)),
      boxes_total: boxesTotal,
      free_balance: freeBalance,
      box_count: accountBoxes.length,
      balance_status:
        currentBalance < 0 ? "negative" : freeBalance < 0 ? "overspent" : "ok",
    };
  });

  const boxSummaries: BoxMoneySummary[] = boxes.flatMap((box) => {
    const account = accountById.get(box.account_id);
    const currency = toSupportedCurrency(account?.currency);
    if (!account || !currency) return [];
    return [{
      ...box,
      current_balance: roundMoney(Number(box.current_balance)),
      target_amount:
        typeof box.target_amount === "number"
          ? roundMoney(Number(box.target_amount))
          : box.target_amount,
      account_name: account.name,
      currency,
    }];
  });

  const currencyLayers = {
    PEN: calculateLayersForCurrency("PEN", accounts, boxes, commitments),
    USD: calculateLayersForCurrency("USD", accounts, boxes, commitments),
  };
  const layers = currencyLayers.PEN;

  return {
    base_currency: "PEN",
    currency_layers: currencyLayers,
    total_balance: layers.total_balance,
    free_in_accounts: layers.free_in_accounts,
    operational_free_money: layers.operational_free_money,
    separated_in_boxes: layers.separated_in_boxes,
    upcoming_uncovered_commitments: layers.upcoming_uncovered_commitments,
    accounts: accountSummaries,
    boxes: boxSummaries,
    commitments,
    data_quality: {
      has_accounts: accounts.length > 0,
      has_boxes: boxes.length > 0,
      message:
        accounts.length > 0
          ? "Tus saldos salen de cuentas registradas. Las cajas se descuentan del dinero libre."
          : "Todavia no hay cuentas. Tus movimientos pueden existir, pero no calculamos saldos ni dinero libre.",
      warnings: buildWarnings(accountSummaries),
    },
    empty_state:
      accounts.length === 0
        ? {
            reason: "no_accounts",
            title: "Agrega tu primera cuenta",
            description:
              "Con una cuenta, Manzana puede distinguir saldo total, dinero separado y dinero libre sin inventar datos.",
          }
        : null,
  };
}

function buildWarnings(accounts: AccountMoneySummary[]): string[] {
  const warnings: string[] = [];

  if (accounts.some((account) => account.current_balance < 0)) {
    warnings.push(
      "Hay una cuenta con saldo negativo. Puede ser por datos incompletos o por un saldo inicial aproximado."
    );
  }

  if (accounts.some((account) => account.free_balance < 0)) {
    warnings.push(
      "Hay una cuenta con mas dinero separado en cajas que saldo disponible."
    );
  }

  if (accounts.some((account) => account.currency === "USD")) {
    warnings.push(
      "Las capas principales estan en soles. Los dolares se calculan por separado y nunca se convierten ni se suman sin un tipo de cambio."
    );
  }

  return warnings;
}

function calculateLayersForCurrency(
  currency: "PEN" | "USD",
  accounts: Account[],
  boxes: Box[],
  commitments: UpcomingCommitmentSummary[]
) {
  const currencyAccounts = accounts.filter(
    (account) => account.currency === currency
  );
  const accountIds = new Set(currencyAccounts.map((account) => account.id));
  const currencyBoxes = boxes.filter((box) => accountIds.has(box.account_id));
  return calculateMoneyLayers({
    accounts: currencyAccounts.map((account) => ({
      current_balance: Number(account.current_balance),
    })),
    boxes: currencyBoxes.map((box) => ({
      id: box.id,
      current_balance: Number(box.current_balance),
    })),
    commitments: commitments
      .filter((commitment) => commitment.currency === currency)
      .map((commitment) => ({
        id: commitment.id,
        amount: commitment.amount,
        linked_box_id: commitment.linked_box_id,
        due_at: commitment.due_at,
      })),
  });
}

function toSupportedCurrency(value: string | undefined): "PEN" | "USD" | null {
  return value === "PEN" || value === "USD" ? value : null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function compareCommitments(
  left: UpcomingCommitmentSummary,
  right: UpcomingCommitmentSummary
): number {
  return left.due_at.localeCompare(right.due_at);
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues)
  );
}
