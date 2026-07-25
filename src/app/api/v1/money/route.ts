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
} from "@/app/api/_lib/http";
import type { Account, Box } from "@/shared/types/domain";
import type {
  AccountMoneySummary,
  BoxMoneySummary,
  MoneyDashboardResponse,
} from "@/features/money/money-types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const [accounts, boxes, recurringCommitments, debtCommitments] = await Promise.all([
      getActiveAccounts(auth.client, auth.userId),
      getActiveBoxes(auth.client, auth.userId),
      listUpcomingCommitments(auth.client, auth.userId),
      listDebtInstallmentCommitments(auth.client, auth.userId),
    ]);
    const commitments = [...recurringCommitments, ...debtCommitments].sort(
      compareCommitments
    );

    return okJson(buildMoneyResponse(accounts, boxes, commitments), meta);
  } catch (error) {
    return unexpectedError(error, meta);
  }
}

function buildMoneyResponse(
  accounts: Account[],
  boxes: Box[],
  commitments: UpcomingCommitmentSummary[]
): MoneyDashboardResponse {
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

  const boxSummaries: BoxMoneySummary[] = boxes.map((box) => ({
    ...box,
    current_balance: roundMoney(Number(box.current_balance)),
    target_amount:
      typeof box.target_amount === "number"
        ? roundMoney(Number(box.target_amount))
        : box.target_amount,
    account_name:
      accounts.find((account) => account.id === box.account_id)?.name ??
      "Cuenta",
  }));

  const totalBalance = roundMoney(
    accountSummaries.reduce((sum, account) => sum + account.current_balance, 0)
  );
  const separatedInBoxes = roundMoney(
    boxSummaries.reduce((sum, box) => sum + box.current_balance, 0)
  );
  const freeInAccounts = roundMoney(totalBalance - separatedInBoxes);
  const upcomingUncoveredCommitments = roundMoney(
    commitments
      .filter((commitment) => !commitment.linked_box_id)
      .reduce((sum, commitment) => sum + commitment.amount, 0)
  );

  return {
    total_balance: totalBalance,
    free_in_accounts: freeInAccounts,
    operational_free_money: roundMoney(freeInAccounts - upcomingUncoveredCommitments),
    separated_in_boxes: separatedInBoxes,
    upcoming_uncovered_commitments: upcomingUncoveredCommitments,
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

  return warnings;
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
