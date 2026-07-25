import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getActiveAccounts,
  linkEmailAccountHint,
} from "@/data/repositories/accounts.repository";
import { updatePendingSummary } from "@/data/repositories/pending.repository";
import type { Database } from "@/data/supabase/types";
import {
  CATEGORY_IDS,
  type Account,
  type CategoryId,
  type PendingItem,
} from "@/shared/types/domain";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;

export type PendingAccountReviewAction =
  | "review"
  | "assign_transfer"
  | "classify_expense"
  | "classify_income";

export type PendingAccountOption = Pick<
  Account,
  "id" | "name" | "institution" | "currency" | "is_default"
>;

export type PendingAccountReviewOutcome =
  | {
      kind: "reviewed";
      reason: "pending_account_options_proposed";
      pendingItem: PendingItem;
      accountOptions: PendingAccountOption[];
      learnedHints: string[];
      readyForConfirmation: false;
    }
  | {
      kind: "updated";
      reason:
        | "pending_ready_for_confirmation"
        | "pending_still_requires_details";
      pendingItem: PendingItem;
      accountOptions: PendingAccountOption[];
      learnedHints: string[];
      readyForConfirmation: boolean;
    }
  | {
      kind: "needs_clarification";
      reason:
        | "account_not_found"
        | "account_currency_mismatch"
        | "transfer_accounts_must_differ"
        | "pending_account_action_not_supported";
      pendingItem: PendingItem;
      accountOptions: PendingAccountOption[];
      learnedHints: string[];
      readyForConfirmation: false;
    };

export async function reviewOrUpdatePendingAccounts(params: {
  client: Client;
  userId: string;
  pendingItem: PendingItem;
  action: PendingAccountReviewAction;
  accountOriginId?: string | null;
  accountDestinationId?: string | null;
  categoryId?: CategoryId | null;
  learnAccountAliases?: boolean;
  userText?: string;
  traceId: string;
}): Promise<PendingAccountReviewOutcome> {
  const allAccounts = await getActiveAccounts(params.client, params.userId);
  const currency = params.pendingItem.normalized_summary.currency ?? "PEN";
  const compatibleAccounts = allAccounts.filter(
    (account) => account.currency === currency,
  );
  const accountOptions = compatibleAccounts.map(toAccountOption);

  if (params.action === "review") {
    const movementType =
      readString(params.pendingItem.proposed_action.movement_type) ??
      readString(params.pendingItem.metadata.suggested_movement_type);
    if (
      movementType === "pago_deuda" ||
      movementType === "pago_recurrente"
    ) {
      return clarification(
        "pending_account_action_not_supported",
        params.pendingItem,
        accountOptions,
      );
    }
    return {
      kind: "reviewed",
      reason: "pending_account_options_proposed",
      pendingItem: params.pendingItem,
      accountOptions,
      learnedHints: [],
      readyForConfirmation: false,
    };
  }

  if (!supportsAccountAction(params.pendingItem, params.action)) {
    return clarification(
      "pending_account_action_not_supported",
      params.pendingItem,
      accountOptions,
    );
  }

  const matchedFromText = matchAccountsFromText(
    params.userText ?? "",
    compatibleAccounts,
  );
  const origin = resolveSelectedAccount(
    params.accountOriginId,
    matchedFromText[0] ?? null,
    allAccounts,
  );
  const destination = resolveSelectedAccount(
    params.accountDestinationId,
    matchedFromText[
      params.action === "assign_transfer" ? 1 : 0
    ] ?? null,
    allAccounts,
  );

  if (origin === "not_found" || destination === "not_found") {
    return clarification(
      "account_not_found",
      params.pendingItem,
      accountOptions,
    );
  }
  if (
    (origin && origin.currency !== currency) ||
    (destination && destination.currency !== currency)
  ) {
    return clarification(
      "account_currency_mismatch",
      params.pendingItem,
      accountOptions,
    );
  }
  if (
    params.action === "assign_transfer" &&
    origin &&
    destination &&
    origin.id === destination.id
  ) {
    return clarification(
      "transfer_accounts_must_differ",
      params.pendingItem,
      accountOptions,
    );
  }

  const categoryId =
    params.action === "classify_expense" ||
    params.action === "classify_income"
      ? resolveCategoryId(
          params.categoryId ??
            params.pendingItem.normalized_summary.category_id ??
            "otros",
        )
      : params.pendingItem.normalized_summary.category_id ?? null;
  const proposedAction = buildProposedAction({
    pendingItem: params.pendingItem,
    action: params.action,
    origin,
    destination,
    categoryId,
  });
  const pendingItem = await updatePendingSummary(
    params.client,
    params.userId,
    params.pendingItem.id,
    {
      ...params.pendingItem.normalized_summary,
      category_id: categoryId,
      subtitle:
        params.action === "assign_transfer"
          ? "Cuentas revisadas por WhatsApp; falta confirmar"
          : "Reclasificado por WhatsApp; falta confirmar",
    },
    params.traceId,
    proposedAction,
  );
  const readyForConfirmation =
    params.action === "assign_transfer"
      ? Boolean(origin && destination && origin.id !== destination.id)
      : true;
  const learnedHints =
    params.learnAccountAliases && params.userText
      ? await learnExplicitAccountHints({
          client: params.client,
          userId: params.userId,
          pendingItem,
          origin,
          destination,
          userText: params.userText,
          traceId: params.traceId,
        })
      : [];

  return {
    kind: "updated",
    reason: readyForConfirmation
      ? "pending_ready_for_confirmation"
      : "pending_still_requires_details",
    pendingItem,
    accountOptions,
    learnedHints,
    readyForConfirmation,
  };
}

function buildProposedAction(input: {
  pendingItem: PendingItem;
  action: Exclude<PendingAccountReviewAction, "review">;
  origin: Account | null;
  destination: Account | null;
  categoryId: CategoryId | null;
}): Record<string, unknown> {
  const current = input.pendingItem.proposed_action;
  const movementInput = toRecord(current.movement_input);

  if (input.action === "assign_transfer") {
    return {
      ...current,
      action: "record_transfer",
      movement_type: "transferencia",
      account_id: null,
      account_origin_id: input.origin?.id ?? null,
      account_destination_id: input.destination?.id ?? null,
      debt_id: null,
      recurring_rule_id: null,
      recurring_occurrence_id: null,
      movement_input: {
        ...movementInput,
        type: "transferencia",
        category_id: null,
        subcategory_id: null,
        account_origin_id: input.origin?.id ?? null,
        account_destination_id: input.destination?.id ?? null,
        debt_id: null,
        recurring_rule_id: null,
        recurring_occurrence_id: null,
        requires_review: true,
      },
      conversational_resolution: "assign_transfer",
    };
  }

  const movementType =
    input.action === "classify_expense" ? "gasto" : "ingreso";
  const account =
    input.action === "classify_expense" ? input.origin : input.destination;
  return {
    ...current,
    action: "create_movement",
    movement_type: movementType,
    account_id: account?.id ?? null,
    account_origin_id:
      movementType === "gasto" ? account?.id ?? null : null,
    account_destination_id:
      movementType === "ingreso" ? account?.id ?? null : null,
    debt_id: null,
    recurring_rule_id: null,
    recurring_occurrence_id: null,
    movement_input: {
      ...movementInput,
      type: movementType,
      category_id: input.categoryId,
      subcategory_id: null,
      account_origin_id:
        movementType === "gasto" ? account?.id ?? null : null,
      account_destination_id:
        movementType === "ingreso" ? account?.id ?? null : null,
      debt_id: null,
      recurring_rule_id: null,
      recurring_occurrence_id: null,
      requires_review: true,
    },
    conversational_resolution:
      input.action === "classify_expense"
        ? "classify_expense"
        : "classify_income",
  };
}

async function learnExplicitAccountHints(input: {
  client: Client;
  userId: string;
  pendingItem: PendingItem;
  origin: Account | null;
  destination: Account | null;
  userText: string;
  traceId: string;
}): Promise<string[]> {
  const candidates = [
    {
      account: input.origin,
      hint: readString(input.pendingItem.metadata.account_origin_hint),
    },
    {
      account: input.destination,
      hint: readString(input.pendingItem.metadata.account_destination_hint),
    },
  ];
  const learned: string[] = [];

  for (const candidate of candidates) {
    if (
      !candidate.account ||
      !candidate.hint ||
      !isExplicitHintAssociation(
        input.userText,
        candidate.hint,
        candidate.account,
      )
    ) {
      continue;
    }
    try {
      const result = await linkEmailAccountHint(input.client, {
        userId: input.userId,
        accountId: candidate.account.id,
        hint: candidate.hint,
        traceId: input.traceId,
      });
      learned.push(candidate.hint);
      logger.info("pending.account_hint_linked", {
        user_id: input.userId,
        pending_item_id: input.pendingItem.id,
        account_id: candidate.account.id,
        idempotent: result.idempotent,
      });
    } catch (error) {
      logger.warn("pending.account_hint_link_failed", {
        error,
        user_id: input.userId,
        pending_item_id: input.pendingItem.id,
        account_id: candidate.account.id,
      });
    }
  }
  return learned;
}

function isExplicitHintAssociation(
  userText: string,
  hint: string,
  account: Account,
): boolean {
  const hintDigits = hint.replace(/\D/g, "");
  if (hintDigits.length < 4) return false;
  const normalizedText = normalize(userText);
  const mentionsAccount = normalizedText.includes(normalize(account.name));
  if (!mentionsAccount) return false;
  const mentionsHint = userText.replace(/\D/g, "").includes(hintDigits.slice(-4));
  const requestsMemory =
    /\b(recuerda|recordar|guardalo|asocia|asociar|vincula|vincular|siempre)\b/.test(
      normalizedText,
    );
  const mapsExplicitly =
    mentionsHint &&
    /\b(es|son|corresponde|pertenece|llama|pon|asigna)\b/.test(
      normalizedText,
    );
  return requestsMemory || mapsExplicitly;
}

function supportsAccountAction(
  pendingItem: PendingItem,
  action: Exclude<PendingAccountReviewAction, "review">,
): boolean {
  const movementType =
    readString(pendingItem.proposed_action.movement_type) ??
    readString(pendingItem.metadata.suggested_movement_type);
  if (action === "assign_transfer") {
    return movementType === "transferencia";
  }
  return movementType !== "pago_deuda" && movementType !== "pago_recurrente";
}

function matchAccountsFromText(
  userText: string,
  accounts: Account[],
): Account[] {
  const normalizedText = normalize(userText);
  const candidates = accounts
    .map((account) => {
      const name = normalize(account.name);
      const match = new RegExp(
        `(?:^|\\s)${escapeRegex(name)}(?=\\s|$)`,
      ).exec(normalizedText);
      if (!match) return null;
      const leadingSpace = match[0].startsWith(" ") ? 1 : 0;
      const start = match.index + leadingSpace;
      return {
        account,
        start,
        end: start + name.length,
        length: name.length,
      };
    })
    .filter(
      (
        candidate,
      ): candidate is {
        account: Account;
        start: number;
        end: number;
        length: number;
      } => Boolean(candidate),
    )
    .sort((left, right) => right.length - left.length);
  const selected: typeof candidates = [];
  for (const candidate of candidates) {
    const overlaps = selected.some(
      (current) =>
        candidate.start < current.end && current.start < candidate.end,
    );
    if (!overlaps) selected.push(candidate);
  }
  return selected
    .sort((left, right) => left.start - right.start)
    .map((candidate) => candidate.account);
}

function resolveSelectedAccount(
  requestedId: string | null | undefined,
  fallback: Account | null,
  accounts: Account[],
): Account | null | "not_found" {
  if (!requestedId) return fallback;
  return accounts.find((account) => account.id === requestedId) ?? "not_found";
}

function resolveCategoryId(value: string): CategoryId {
  return CATEGORY_IDS.includes(value as CategoryId)
    ? (value as CategoryId)
    : "otros";
}

function clarification(
  reason: Extract<
    PendingAccountReviewOutcome,
    { kind: "needs_clarification" }
  >["reason"],
  pendingItem: PendingItem,
  accountOptions: PendingAccountOption[],
): PendingAccountReviewOutcome {
  return {
    kind: "needs_clarification",
    reason,
    pendingItem,
    accountOptions,
    learnedHints: [],
    readyForConfirmation: false,
  };
}

function toAccountOption(account: Account): PendingAccountOption {
  return {
    id: account.id,
    name: account.name,
    institution: account.institution,
    currency: account.currency,
    is_default: account.is_default,
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
