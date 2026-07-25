import type { ParsedGmailMovement } from "@/adapters/email/gmail-parser";
import type {
  Account,
  Debt,
  MovementType,
  RecurringOccurrence,
  RecurringRule,
} from "@/shared/types/domain";

export type EmailRecurringContext = RecurringRule & {
  occurrences: RecurringOccurrence[];
};

export type EmailFinancialContext = {
  accounts: Account[];
  debts: Debt[];
  recurringRules: EmailRecurringContext[];
};

export type EmailAccountResolution = {
  accountId: string | null;
  confidence: "high" | "medium" | "none" | "ambiguous";
  candidateIds: string[];
};

export type EmailFinancialEnrichment = {
  suggestedAction:
    | "create_movement"
    | "record_transfer"
    | "record_debt_payment"
    | "record_recurring_payment"
    | "review_specialized";
  suggestedMovementType: MovementType;
  account: EmailAccountResolution;
  debtId: string | null;
  recurringRuleId: string | null;
  recurringOccurrenceId: string | null;
  transferOriginAccountId: string | null;
  transferDestinationAccountId: string | null;
  ambiguityReasons: string[];
  requiresSpecializedEngine: boolean;
};

export function enrichEmailFinancialMovement(
  parsed: ParsedGmailMovement,
  context: EmailFinancialContext,
): EmailFinancialEnrichment {
  const account = resolveEmailAccount(parsed, context.accounts);
  const debt = resolveDebtCandidate(parsed, context.debts);
  const recurring = resolveRecurringCandidate(parsed, context.recurringRules);
  const ambiguityReasons: string[] = [];

  if (account.confidence === "ambiguous") {
    ambiguityReasons.push("account_ambiguous");
  } else if (!account.accountId && parsed.accountHint) {
    ambiguityReasons.push("account_not_resolved");
  }

  if (parsed.operationHint === "debt_installment") {
    if (!debt) {
      ambiguityReasons.push("debt_not_resolved");
      return reviewSpecialized(parsed, account, ambiguityReasons);
    }
    return {
      suggestedAction: "record_debt_payment",
      suggestedMovementType:
        debt.direction === "i_owe" ? "pago_deuda" : "devolucion_recibida",
      account,
      debtId: debt.id,
      recurringRuleId: null,
      recurringOccurrenceId: null,
      transferOriginAccountId: null,
      transferDestinationAccountId: null,
      ambiguityReasons,
      requiresSpecializedEngine: true,
    };
  }

  if (recurring) {
    if (recurring.rule.linked_debt_id) {
      const linkedDebt = context.debts.find(
        (item) => item.id === recurring.rule.linked_debt_id,
      );
      if (linkedDebt) {
        return {
          suggestedAction: "record_debt_payment",
          suggestedMovementType:
            linkedDebt.direction === "i_owe"
              ? "pago_deuda"
              : "devolucion_recibida",
          account,
          debtId: linkedDebt.id,
          recurringRuleId: recurring.rule.id,
          recurringOccurrenceId: recurring.occurrence?.id ?? null,
          transferOriginAccountId: null,
          transferDestinationAccountId: null,
          ambiguityReasons,
          requiresSpecializedEngine: true,
        };
      }
    }
    if (!recurring.occurrence) ambiguityReasons.push("recurring_occurrence_missing");
    return {
      suggestedAction: recurring.occurrence
        ? "record_recurring_payment"
        : "review_specialized",
      suggestedMovementType: "pago_recurrente",
      account,
      debtId: null,
      recurringRuleId: recurring.rule.id,
      recurringOccurrenceId: recurring.occurrence?.id ?? null,
      transferOriginAccountId: null,
      transferDestinationAccountId: null,
      ambiguityReasons,
      requiresSpecializedEngine: true,
    };
  }

  if (
    parsed.operationHint === "transfer" ||
    (parsed.operationHint === "income" && parsed.parseMode === "generic_fallback")
  ) {
    const originResolution = parsed.accountOriginHint
      ? resolveEmailAccount(
          { ...parsed, accountHint: parsed.accountOriginHint },
          context.accounts,
        )
      : null;
    const destinationResolution = parsed.accountDestinationHint
      ? resolveEmailAccount(
          { ...parsed, accountHint: parsed.accountDestinationHint },
          context.accounts,
        )
      : null;
    const originAccountId =
      originResolution?.accountId ??
      (parsed.direction === "out" ? account.accountId : null);
    const destinationAccountId =
      destinationResolution?.accountId ??
      (parsed.direction === "in" ? account.accountId : null);
    if (!originAccountId) ambiguityReasons.push("transfer_origin_missing");
    if (!destinationAccountId) {
      ambiguityReasons.push("transfer_destination_missing");
    }
    if (
      originAccountId &&
      destinationAccountId &&
      originAccountId === destinationAccountId
    ) {
      ambiguityReasons.push("transfer_accounts_must_differ");
    }
    return {
      suggestedAction:
        originAccountId &&
        destinationAccountId &&
        originAccountId !== destinationAccountId
          ? "record_transfer"
          : "review_specialized",
      suggestedMovementType: "transferencia",
      account,
      debtId: null,
      recurringRuleId: null,
      recurringOccurrenceId: null,
      transferOriginAccountId: originAccountId,
      transferDestinationAccountId: destinationAccountId,
      ambiguityReasons,
      requiresSpecializedEngine: true,
    };
  }

  return {
    suggestedAction: "create_movement",
    suggestedMovementType:
      parsed.operationHint === "refund"
        ? "devolucion_recibida"
        : parsed.movementType,
    account,
    debtId: null,
    recurringRuleId: null,
    recurringOccurrenceId: null,
    transferOriginAccountId: null,
    transferDestinationAccountId: null,
    ambiguityReasons,
    requiresSpecializedEngine: false,
  };
}

export function resolveEmailAccount(
  parsed: ParsedGmailMovement,
  accounts: Account[],
): EmailAccountResolution {
  const compatible = accounts.filter(
    (account) =>
      account.currency === parsed.currency && account.deleted_at === null,
  );
  const institutionTerms = [
    parsed.institutionKey,
    ...parsed.institutionAliases,
  ]
    .map(normalizeText)
    .filter(Boolean);
  const institutionMatches = compatible.filter((account) => {
    const haystack = normalizeText(
      `${account.institution ?? ""} ${account.name}`,
    );
    return institutionTerms.some(
      (term) => haystack.includes(term) || term.includes(haystack),
    );
  });

  if (parsed.accountHint) {
    const hint = digits(parsed.accountHint);
    const hintMatches = hint
      ? compatible.filter((account) =>
          accountIdentifiers(account).some((identifier) =>
            digits(identifier).endsWith(hint),
          ),
        )
      : compatible.filter((account) => {
          const normalizedHint = normalizeText(parsed.accountHint ?? "");
          const normalizedName = normalizeText(account.name);
          const normalizedInstitution = normalizeText(
            account.institution ?? "",
          );
          return (
            normalizedHint.length >= 2 &&
            (normalizedName.includes(normalizedHint) ||
              normalizedInstitution === normalizedHint ||
              normalizedHint.includes(normalizedName))
          );
        });
    const exact = hintMatches.filter(
      (account) =>
        !hint ||
        institutionMatches.length === 0 ||
        institutionMatches.some((candidate) => candidate.id === account.id),
    );
    const candidates = exact.length > 0 ? exact : hintMatches;
    return candidates.length === 1
      ? {
          accountId: candidates[0]!.id,
          confidence: "high",
          candidateIds: [candidates[0]!.id],
        }
      : {
          accountId: null,
          confidence: candidates.length > 1 ? "ambiguous" : "none",
          candidateIds: candidates.map((account) => account.id),
        };
  }

  const candidates =
    institutionMatches.length > 0
      ? institutionMatches
      : compatible.length === 1
        ? compatible
        : [];
  return candidates.length === 1
    ? {
        accountId: candidates[0]!.id,
        confidence: "medium",
        candidateIds: [candidates[0]!.id],
      }
    : {
        accountId: null,
        confidence: candidates.length > 1 ? "ambiguous" : "none",
        candidateIds: candidates.map((account) => account.id),
      };
}

function resolveDebtCandidate(
  parsed: ParsedGmailMovement,
  debts: Debt[],
): Debt | null {
  const merchant = normalizeText(parsed.merchant ?? parsed.description);
  const candidates = debts
    .filter(
      (debt) =>
        ["active", "due_soon", "overdue"].includes(debt.status) &&
        debt.currency === parsed.currency &&
        parsed.amount <= debt.current_balance,
    )
    .map((debt) => {
      const nameMatches =
        merchant.length > 0 &&
        (merchant.includes(normalizeText(debt.name)) ||
          normalizeText(debt.name).includes(merchant));
      const installmentMatches =
        typeof debt.installment_amount === "number" &&
        moneyEqual(debt.installment_amount, parsed.amount);
      return {
        debt,
        score:
          (nameMatches ? 3 : 0) +
          (installmentMatches ? 3 : 0) +
          (parsed.operationHint === "debt_installment" ? 1 : 0),
      };
    })
    .filter((candidate) => candidate.score >= 3)
    .sort((left, right) => right.score - left.score);
  return candidates.length === 1 ||
    (candidates[0] && candidates[0].score > (candidates[1]?.score ?? 0))
    ? candidates[0]!.debt
    : null;
}

function resolveRecurringCandidate(
  parsed: ParsedGmailMovement,
  rules: EmailRecurringContext[],
): { rule: EmailRecurringContext; occurrence: RecurringOccurrence | null } | null {
  if (!parsed.merchant) return null;
  const merchant = normalizeText(parsed.merchant);
  const candidates = rules.filter((rule) => {
    if (
      rule.status !== "active" ||
      rule.currency !== parsed.currency ||
      rule.deleted_at !== null
    ) {
      return false;
    }
    const terms = [rule.merchant_pattern, rule.name]
      .filter((value): value is string => Boolean(value))
      .map(normalizeText);
    if (
      !terms.some(
        (term) => merchant.includes(term) || term.includes(merchant),
      )
    ) {
      return false;
    }
    const expected = rule.expected_amount;
    if (typeof expected !== "number") return true;
    const tolerance =
      rule.amount_variability === "fixed"
        ? 0.01
        : Math.max(0.5, expected * 0.2);
    return Math.abs(expected - parsed.amount) <= tolerance;
  });
  if (candidates.length !== 1) return null;
  const rule = candidates[0]!;
  const occurrence =
    rule.occurrences
      .filter((item) =>
        ["expected", "due_soon", "pending_confirmation", "overdue"].includes(
          item.status,
        ),
      )
      .sort((left, right) =>
        left.expected_date.localeCompare(right.expected_date),
      )[0] ?? null;
  return { rule, occurrence };
}

function reviewSpecialized(
  parsed: ParsedGmailMovement,
  account: EmailAccountResolution,
  ambiguityReasons: string[],
): EmailFinancialEnrichment {
  return {
    suggestedAction: "review_specialized",
    suggestedMovementType:
      parsed.operationHint === "debt_installment"
        ? "pago_deuda"
        : "transferencia",
    account,
    debtId: null,
    recurringRuleId: null,
    recurringOccurrenceId: null,
    transferOriginAccountId: null,
    transferDestinationAccountId: null,
    ambiguityReasons,
    requiresSpecializedEngine: true,
  };
}

function accountIdentifiers(account: Account): string[] {
  const metadata = account.metadata ?? {};
  return [
    account.name,
    readString(metadata.last_four),
    readString(metadata.last4),
    readString(metadata.account_hint),
    readString(metadata.masked_number),
    ...readStringArray(metadata.email_account_hints),
  ].filter((value): value is string => Boolean(value));
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function moneyEqual(left: number, right: number): boolean {
  return Math.abs(Math.round(left * 100) - Math.round(right * 100)) <= 1;
}
