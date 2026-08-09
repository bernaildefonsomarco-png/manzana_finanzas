"use client";

import type { ReactNode } from "react";
import type { Block, BlockOption } from "@/core/channel/types";
import { Button } from "@/ui/primitivas/button";
import { Card } from "@/ui/primitivas/card";
import { ProposalSkeleton } from "./proposal-skeleton";

type PropuestaBlock = Extract<Block, { kind: "propuesta" }>;

/**
 * `RUL-ASI-18`: el campo libre ("siempre se puede escribir otra cosa") es el
 * compositor, fuera de este bloque — igual que en `PreguntaBlockView`.
 *
 * Una propuesta con pending item correlacionado la resuelve `resolve` con su
 * tarjeta de confirmacion. Sin pending, se dibujan las opciones del propio
 * bloque: una correccion muta un movimiento que ya existe, asi que
 * `createPendingItemsForDataActionPlan` no le crea pendiente, y la propuesta
 * se quedaba en el esqueleto de forma permanente. El bloque siempre trajo sus
 * opciones —WhatsApp las materializa como botones desde el principio
 * (`response-shaper`)— y solo la web no las dibujaba, dejando el borrado
 * resoluble unicamente por texto.
 *
 * `option.id` ya es el comando (`corr:<accion>:<uuid>`, o `corr:cancel`), el
 * mismo payload que WhatsApp devuelve al pulsar. Enviarlo como turno deja un
 * unico camino de resolucion para los dos canales.
 *
 * El esqueleto queda para el caso que lo justifica: la propuesta que espera
 * datos que todavia no llegaron (`RUL-ASI-13`).
 */
export function PropuestaBlockView({
  block,
  resolve,
  onSelectOption,
  disabled,
}: {
  block: PropuestaBlock;
  resolve?: (block: PropuestaBlock) => ReactNode;
  onSelectOption?: (option: BlockOption) => void;
  disabled?: boolean;
}) {
  if (resolve) return <>{resolve(block)}</>;
  if (block.options.length === 0) return <ProposalSkeleton title={block.text} />;

  return (
    <Card className="space-y-3 p-5">
      <p className="text-sm text-text">{block.text}</p>
      <div className="flex flex-wrap gap-2">
        {block.options.map((option, index) => (
          <Button
            key={option.id}
            type="button"
            variant={index === 0 ? "primary" : "secondary"}
            size="sm"
            disabled={disabled}
            onClick={() => onSelectOption?.(option)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </Card>
  );
}
