import type { Block, EvidenceReference } from "@/core/channel/types";
import { Badge } from "@/ui/primitivas/badge";
import { cn } from "@/ui/primitivas/cn";
import { EvidenceLink } from "../evidence-link";

type HallazgoBlock = Extract<Block, { kind: "hallazgo" }>;

/**
 * `AC-ASI-13`: una `impresion` se distingue de una `afirmacion` en el
 * texto (badge) y en el estilo (borde punteado) — nunca solo con un
 * icono, porque el icono no se lee en voz alta (`41` §4, `RUL-ASI-21`).
 */
export function HallazgoBlockView({
  block,
  onShowEvidence,
}: {
  block: HallazgoBlock;
  onShowEvidence: (references: EvidenceReference[]) => void;
}) {
  const isImpresion = block.level === "impresion";

  return (
    <div
      className={cn(
        "space-y-1 rounded-md border p-3",
        isImpresion
          ? "border-dashed border-border-strong bg-bg-surface"
          : "border-border bg-bg-surface-raised"
      )}
    >
      {isImpresion ? <Badge tone="neutral">Impresión, no confirmada</Badge> : null}
      <p className="text-sm text-text">
        <EvidenceLink references={block.references} onShowEvidence={onShowEvidence}>
          {block.text}
        </EvidenceLink>
      </p>
    </div>
  );
}
