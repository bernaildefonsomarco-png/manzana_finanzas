"use client";

import { useId } from "react";
import { useRouter } from "next/navigation";
import type { EvidenceReference } from "@/core/channel/types";
import { BlockRenderer, type BlockRendererHandlers } from "@/ui/domain/block-renderer";
import type { AssistantMessageWithBlocks } from "./assistant-types";
import { AssistantProposalCard } from "./assistant-proposal-card";

function firstPendingItemId(message: AssistantMessageWithBlocks): string | null {
  const action = message.proposed_action as { pending_item_ids?: unknown } | null;
  const ids = action?.pending_item_ids;
  return Array.isArray(ids) && typeof ids[0] === "string" ? ids[0] : null;
}

/** `RUL-ASI-21`: cada mensaje es un `article` con su autor en el encabezado. */
export function AssistantMessage({
  message,
  threadId,
}: {
  message: AssistantMessageWithBlocks;
  threadId: string | null;
}) {
  const router = useRouter();
  const headingId = useId();
  const isUser = message.role === "usuario";
  const pendingItemId = firstPendingItemId(message);

  const handlers: BlockRendererHandlers = {
    onShowEvidence: (references: EvidenceReference[]) => {
      const [first] = references;
      if (references.length === 1 && first.kind === "movement") {
        router.push(`/movimientos/${first.id}`);
      } else {
        router.push("/movimientos");
      }
    },
    onFollowShow: () => router.push("/movimientos"),
    onTriggerAction: () => undefined,
    onUseManualPath: (manualPath) => router.push(manualPath),
  };

  return (
    <article
      aria-labelledby={headingId}
      className={isUser ? "ml-auto max-w-[85%]" : "mr-auto max-w-[95%]"}
    >
      <h3 id={headingId} className="sr-only">
        {isUser ? "Tú" : "Manzana"}
      </h3>
      {isUser ? (
        <p className="rounded-xl bg-brand px-4 py-2.5 text-sm text-text-inverse">
          {message.content.map((block) => ("text" in block ? block.text : "")).join(" ")}
        </p>
      ) : (
        <div className="space-y-3">
          {message.content.map((block, index) =>
            block.kind === "propuesta" && pendingItemId ? (
              <AssistantProposalCard
                key={index}
                pendingItemId={pendingItemId}
                threadId={threadId}
              />
            ) : (
              <BlockRenderer key={index} block={block} handlers={handlers} />
            )
          )}
        </div>
      )}
    </article>
  );
}
