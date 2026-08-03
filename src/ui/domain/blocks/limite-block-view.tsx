import type { Block } from "@/core/channel/types";
import { Button } from "@/ui/primitivas/button";
import { Card } from "@/ui/primitivas/card";
import { cn } from "@/ui/primitivas/cn";

type LimiteBlock = Extract<Block, { kind: "limite" }>;

/** `AC-ASI-14`: el bloque `limite` no se puede omitir, ni mostrarse sin su via manual cuando existe. */
export function LimiteBlockView({
  block,
  onUseManualPath,
  className,
}: {
  block: LimiteBlock;
  onUseManualPath?: (manualPath: string) => void;
  className?: string;
}) {
  return (
    <Card className={cn("space-y-2 border-warning-subtle bg-warning-subtle p-3", className)}>
      <p className="text-sm text-warning-on-subtle">{block.text}</p>
      {block.manualPath ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onUseManualPath?.(block.manualPath as string)}
        >
          Usar la vía manual
        </Button>
      ) : null}
    </Card>
  );
}
