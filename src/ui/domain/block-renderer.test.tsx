import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Block } from "@/core/channel/types";
import { BlockRenderer, type BlockRendererHandlers } from "./block-renderer";

function handlers(overrides: Partial<BlockRendererHandlers> = {}): BlockRendererHandlers {
  return { onShowEvidence: vi.fn(), ...overrides };
}

describe("BlockRenderer", () => {
  it("texto: renderiza el parrafo tal cual", () => {
    const block: Block = { kind: "texto", text: "Este mes llevas gastado…" };
    render(<BlockRenderer block={block} handlers={handlers()} />);
    expect(screen.getByText("Este mes llevas gastado…")).toBeInTheDocument();
  });

  it("cifra: AC-ASI-12, la cifra lleva enlace de evidencia y al pulsarla lo dispara", () => {
    const onShowEvidence = vi.fn();
    const block: Block = {
      kind: "cifra",
      text: "en Alimentación, en 14 compras",
      amount: 318,
      currency: "PEN",
      references: [{ kind: "movement", id: "mov-1" }],
    };
    render(<BlockRenderer block={block} handlers={handlers({ onShowEvidence })} />);

    expect(screen.getByText("S/318.00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /1 referencia\)/ }));
    expect(onShowEvidence).toHaveBeenCalledWith(block.references);
  });

  it("lista: cada fila llama a onSelectListItem con su item", () => {
    const onSelectListItem = vi.fn();
    const block: Block = {
      kind: "lista",
      text: "Tus ultimas compras",
      items: [
        { label: "Rappi S/32.00", references: [] },
        { label: "Metro S/18.50", references: [] },
      ],
    };
    render(<BlockRenderer block={block} handlers={handlers({ onSelectListItem })} />);

    fireEvent.click(screen.getByRole("button", { name: "Rappi S/32.00" }));
    expect(onSelectListItem).toHaveBeenCalledWith(block.items[0]);
  });

  it("RUL-ASI-18: pregunta renderiza las opciones pulsables", () => {
    const onSelectOption = vi.fn();
    const block: Block = {
      kind: "pregunta",
      text: "¿Confirmas el gasto?",
      options: [
        { id: "si", label: "Sí" },
        { id: "no", label: "No" },
      ],
    };
    render(<BlockRenderer block={block} handlers={handlers({ onSelectOption })} />);

    fireEvent.click(screen.getByRole("button", { name: "Sí" }));
    expect(onSelectOption).toHaveBeenCalledWith(block.options[0]);
  });

  it("propuesta: sin resolver, muestra un esqueleto sin inventar contenido", () => {
    const block: Block = {
      kind: "propuesta",
      text: "Voy a registrar un gasto",
      commandId: "cmd-1",
      options: [],
    };
    render(<BlockRenderer block={block} handlers={handlers()} />);

    const title = screen.getByText("Voy a registrar un gasto");
    expect(title.closest("section")).toHaveAttribute("aria-busy", "true");
  });

  it("propuesta: con resolver, delega la tarjeta al resolver", () => {
    const block: Block = {
      kind: "propuesta",
      text: "Voy a registrar un gasto",
      commandId: "cmd-1",
      options: [],
    };
    render(
      <BlockRenderer
        block={block}
        handlers={handlers()}
        resolveProposal={() => <div>tarjeta resuelta</div>}
      />
    );

    expect(screen.getByText("tarjeta resuelta")).toBeInTheDocument();
    expect(screen.queryByText("Voy a registrar un gasto")).not.toBeInTheDocument();
  });

  it("previsualizacion: sin resolver, muestra un esqueleto; con resolver, lo delega", () => {
    const block: Block = {
      kind: "previsualizacion",
      text: "Voy a reclasificar 23 movimientos",
      count: 23,
      sample: ["Rappi S/32.00"],
      exclusions: [],
    };
    const { rerender } = render(<BlockRenderer block={block} handlers={handlers()} />);
    expect(screen.getByText("Voy a reclasificar 23 movimientos")).toBeInTheDocument();

    rerender(
      <BlockRenderer
        block={block}
        handlers={handlers()}
        resolveMassivePreview={() => <div>masiva resuelta</div>}
      />
    );
    expect(screen.getByText("masiva resuelta")).toBeInTheDocument();
  });

  it("AC-ASI-13: hallazgo distingue afirmacion de impresion, en el texto y en el estilo", () => {
    const afirmacion: Block = {
      kind: "hallazgo",
      text: "Gastaste más en julio que en junio.",
      level: "afirmacion",
      references: [{ kind: "movement", id: "mov-1" }],
    };
    const { unmount } = render(<BlockRenderer block={afirmacion} handlers={handlers()} />);
    expect(screen.queryByText("Impresión, no confirmada")).not.toBeInTheDocument();
    unmount();

    const impresion: Block = {
      kind: "hallazgo",
      text: "Me da la impresión de que gastas más los fines de semana.",
      level: "impresion",
      references: [],
    };
    render(<BlockRenderer block={impresion} handlers={handlers()} />);
    expect(screen.getByText("Impresión, no confirmada")).toBeInTheDocument();
  });

  it("RUL-ASI-10: mostrar acompaña la navegacion con la frase y dispara onFollowShow", () => {
    const onFollowShow = vi.fn();
    const block: Block = {
      kind: "mostrar",
      what: "movimientos",
      which: null,
      filters: { categoria: "Alimentación" },
      reason: "para que veas los 14 de Alimentación",
    };
    render(<BlockRenderer block={block} handlers={handlers({ onFollowShow })} />);

    expect(screen.getByText("para que veas los 14 de Alimentación")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /movimientos/ }));
    expect(onFollowShow).toHaveBeenCalledWith(block);
  });

  it("accion: nunca es del mismo peso visual que confirmar una propuesta (variant secundario)", () => {
    const onTriggerAction = vi.fn();
    const block: Block = { kind: "accion", text: "Exportar julio", commandId: "cmd-export" };
    render(<BlockRenderer block={block} handlers={handlers({ onTriggerAction })} />);

    const button = screen.getByRole("button", { name: "Exportar julio" });
    expect(button.className).not.toMatch(/bg-brand\b/);
    fireEvent.click(button);
    expect(onTriggerAction).toHaveBeenCalledWith(block);
  });

  it("AC-ASI-14: limite siempre trae su via manual cuando existe", () => {
    const onUseManualPath = vi.fn();
    const block: Block = {
      kind: "limite",
      text: "No te voy a decir qué deuda pagar primero.",
      manualPath: "/deudas",
    };
    render(<BlockRenderer block={block} handlers={handlers({ onUseManualPath })} />);

    expect(
      screen.getByText("No te voy a decir qué deuda pagar primero.")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Usar la vía manual" }));
    expect(onUseManualPath).toHaveBeenCalledWith("/deudas");
  });

  it("limite sin via manual no muestra boton", () => {
    const block: Block = { kind: "limite", text: "No puedo ayudarte con eso.", manualPath: null };
    render(<BlockRenderer block={block} handlers={handlers()} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
