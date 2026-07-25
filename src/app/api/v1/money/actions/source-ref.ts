import type { MoneyActionRequest } from "./schemas";

export function buildMoneyActionSourceRef(
  action: MoneyActionRequest["action"],
  idempotencyKey: string
): string {
  return `money-action:${action}:${idempotencyKey}`;
}
