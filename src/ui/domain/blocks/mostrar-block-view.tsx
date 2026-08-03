import type { Block } from "@/core/channel/types";
import { Button } from "@/ui/primitivas/button";

type MostrarBlock = Extract<Block, { kind: "mostrar" }>;

function mostrarLabel(what: MostrarBlock["what"]): string {
  switch (what) {
    case "movimientos":
      return "los movimientos";
    case "deuda":
      return "la deuda";
    case "presupuesto":
      return "el presupuesto";
    case "pago":
      return "el pago";
    case "descubrimiento":
      return "el descubrimiento";
    case "reporte":
      return "el reporte";
    default:
      return "el detalle";
  }
}

/** `RUL-ASI-10`: la navegacion va siempre acompañada de la frase que la explica. */
export function MostrarBlockView({
  block,
  onFollowShow,
}: {
  block: MostrarBlock;
  onFollowShow?: (block: MostrarBlock) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-text">{block.reason}</p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => onFollowShow?.(block)}
      >
        Ver {mostrarLabel(block.what)}
      </Button>
    </div>
  );
}
