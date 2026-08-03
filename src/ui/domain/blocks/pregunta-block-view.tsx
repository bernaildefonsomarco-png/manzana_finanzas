import type { Block, BlockOption } from "@/core/channel/types";
import { Button } from "@/ui/primitivas/button";

type PreguntaBlock = Extract<Block, { kind: "pregunta" }>;

/**
 * `RUL-ASI-18`: el campo libre ("siempre se puede escribir otra cosa") es
 * el compositor de mensajes, fuera de este bloque — no se duplica aqui.
 */
export function PreguntaBlockView({
  block,
  onSelectOption,
}: {
  block: PreguntaBlock;
  onSelectOption?: (option: BlockOption) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-text">{block.text}</p>
      <div className="flex flex-wrap gap-2">
        {block.options.map((option) => (
          <Button
            key={option.id}
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onSelectOption?.(option)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
