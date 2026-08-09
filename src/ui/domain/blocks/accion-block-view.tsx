"use client";

import type { Block } from "@/core/channel/types";
import { Button } from "@/ui/primitivas/button";

type AccionBlock = Extract<Block, { kind: "accion" }>;

/** `21` §5: una `accion` es un solo boton que dispara el atajo que propone. */
export function AccionBlockView({
  block,
  onTriggerAction,
}: {
  block: AccionBlock;
  onTriggerAction?: (block: AccionBlock) => void;
}) {
  return (
    <Button type="button" variant="secondary" size="sm" onClick={() => onTriggerAction?.(block)}>
      {block.text}
    </Button>
  );
}
