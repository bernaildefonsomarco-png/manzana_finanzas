"use client";

import type { ReactNode } from "react";
import type { Block, BlockOption, EvidenceReference } from "@/core/channel/types";
import { MoneyText } from "@/ui/primitivas/money";
import { cn } from "@/ui/primitivas/cn";
import { EvidenceLink } from "./evidence-link";
import { AccionBlockView } from "./blocks/accion-block-view";
import { conEnfasis } from "./blocks/enfasis";
import { HallazgoBlockView } from "./blocks/hallazgo-block-view";
import { LimiteBlockView } from "./blocks/limite-block-view";
import { ListaBlockView } from "./blocks/lista-block-view";
import { MostrarBlockView } from "./blocks/mostrar-block-view";
import { PreguntaBlockView } from "./blocks/pregunta-block-view";
import { PropuestaBlockView } from "./blocks/propuesta-block-view";
import { ProposalSkeleton } from "./blocks/proposal-skeleton";

export type ListaItem = { label: string; references: EvidenceReference[] };
type MostrarBlock = Extract<Block, { kind: "mostrar" }>;
type AccionBlock = Extract<Block, { kind: "accion" }>;
type PropuestaBlock = Extract<Block, { kind: "propuesta" }>;
type PrevisualizacionBlock = Extract<Block, { kind: "previsualizacion" }>;

export type BlockRendererHandlers = {
  onShowEvidence: (references: EvidenceReference[]) => void;
  onSelectListItem?: (item: ListaItem) => void;
  onSelectOption?: (option: BlockOption) => void;
  onFollowShow?: (block: MostrarBlock) => void;
  onTriggerAction?: (block: AccionBlock) => void;
  onUseManualPath?: (manualPath: string) => void;
};

export type BlockRendererProps = {
  block: Block;
  handlers: BlockRendererHandlers;
  /**
   * `propuesta`/`previsualizacion` no traen campos ni casillas: eso vive en el
   * pending item correlacionado por `source_ref` (`buildWebPresentTurn`,
   * `WEB-D263`), y quien monta la pantalla lo resuelve y devuelve la tarjeta
   * ya armada. Sin resolutor, `PropuestaBlockView` decide entre las opciones
   * del bloque y el esqueleto.
   */
  resolveProposal?: (block: PropuestaBlock) => ReactNode;
  resolveMassivePreview?: (block: PrevisualizacionBlock) => ReactNode;
  /** Apaga las opciones mientras hay un turno en vuelo: un clic, una confirmacion. */
  optionsDisabled?: boolean;
  className?: string;
};

/**
 * `41` §4: traduccion literal de los diez bloques de `21` §5, sin cambiar
 * su contenido, omitir un `limite`, ni presentar una `impresion` con el
 * mismo peso que una `afirmacion`.
 */
export function BlockRenderer({
  block,
  handlers,
  resolveProposal,
  resolveMassivePreview,
  optionsDisabled,
  className,
}: BlockRendererProps) {
  switch (block.kind) {
    case "texto":
      return <p className={cn("text-sm text-text", className)}>{conEnfasis(block.text)}</p>;

    case "cifra":
      return (
        <p className={cn("text-sm text-text", className)}>
          <EvidenceLink
            references={block.references}
            onShowEvidence={handlers.onShowEvidence}
            className="font-heading text-base font-medium"
          >
            <MoneyText value={block.amount} currency={block.currency} />
          </EvidenceLink>{" "}
          {block.text}
        </p>
      );

    case "lista":
      return (
        <div className={className}>
          <ListaBlockView block={block} onSelectListItem={handlers.onSelectListItem} />
        </div>
      );

    case "pregunta":
      return (
        <div className={className}>
          <PreguntaBlockView block={block} onSelectOption={handlers.onSelectOption} />
        </div>
      );

    case "propuesta":
      return (
        <div className={className}>
          <PropuestaBlockView
            block={block}
            resolve={resolveProposal}
            onSelectOption={handlers.onSelectOption}
            disabled={optionsDisabled}
          />
        </div>
      );

    case "previsualizacion":
      return (
        <div className={className}>
          {resolveMassivePreview?.(block) ?? <ProposalSkeleton title={block.text} />}
        </div>
      );

    case "hallazgo":
      return (
        <div className={className}>
          <HallazgoBlockView block={block} onShowEvidence={handlers.onShowEvidence} />
        </div>
      );

    case "mostrar":
      return (
        <div className={className}>
          <MostrarBlockView block={block} onFollowShow={handlers.onFollowShow} />
        </div>
      );

    case "accion":
      return (
        <div className={className}>
          <AccionBlockView block={block} onTriggerAction={handlers.onTriggerAction} />
        </div>
      );

    case "limite":
      return (
        <LimiteBlockView
          block={block}
          onUseManualPath={handlers.onUseManualPath}
          className={className}
        />
      );

    default:
      return null;
  }
}
