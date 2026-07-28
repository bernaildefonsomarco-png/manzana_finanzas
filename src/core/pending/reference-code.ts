import { createHash } from "node:crypto";
import type { PendingItem } from "@/shared/types/domain";

const CODE_LENGTH = 8;

export function buildPendingReferenceCode(input: {
  userId: string;
  pendingItemId: string;
}): string {
  const digest = createHash("sha256")
    .update(`${input.userId}:${input.pendingItemId}`, "utf8")
    .digest("hex")
    .slice(0, CODE_LENGTH)
    .toUpperCase();

  return `P-${digest}`;
}

export function buildPendingItemReferenceCode(item: PendingItem): string {
  return buildPendingReferenceCode({
    userId: item.user_id,
    pendingItemId: item.id,
  });
}

export function extractPendingReferenceCode(value: string): string | null {
  const match = value.toUpperCase().match(/\bP[\s-]*([A-F0-9]{8})\b/);
  return match ? `P-${match[1]}` : null;
}
