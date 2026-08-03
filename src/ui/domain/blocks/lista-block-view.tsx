import type { Block } from "@/core/channel/types";
import type { ListaItem } from "../block-renderer";

type ListaBlock = Extract<Block, { kind: "lista" }>;

/** `41` §4: cada fila lleva a su detalle (no es un enlace de evidencia). */
export function ListaBlockView({
  block,
  onSelectListItem,
}: {
  block: ListaBlock;
  onSelectListItem?: (item: ListaItem) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-text">{block.text}</p>
      <ul className="space-y-1">
        {block.items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            <button
              type="button"
              onClick={() => onSelectListItem?.(item)}
              className="w-full rounded-md border border-border bg-bg-surface-raised px-3 py-2 text-left text-sm text-text transition hover:border-border-strong hover:bg-bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
