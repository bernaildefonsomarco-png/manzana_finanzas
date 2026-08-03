import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EvidenceLink } from "./evidence-link";
import type { EvidenceReference } from "@/core/channel/types";

const REFS: EvidenceReference[] = [
  { kind: "movement", id: "mov-1" } as EvidenceReference,
  { kind: "movement", id: "mov-2" } as EvidenceReference,
];

describe("EvidenceLink", () => {
  it("AC-ASI-12: al pulsar la cifra, invoca onShowEvidence con las referencias", async () => {
    const onShowEvidence = vi.fn();
    render(
      <EvidenceLink references={REFS} onShowEvidence={onShowEvidence}>
        S/ 32.00
      </EvidenceLink>
    );

    fireEvent.click(screen.getByRole("button", { name: /2 referencias/ }));

    expect(onShowEvidence).toHaveBeenCalledWith(REFS);
  });

  it("usa el singular cuando hay una sola referencia", () => {
    render(
      <EvidenceLink references={[REFS[0]]} onShowEvidence={vi.fn()}>
        S/ 32.00
      </EvidenceLink>
    );

    expect(screen.getByRole("button", { name: /1 referencia\)/ })).toBeInTheDocument();
  });

  it("21 S5 regla 1: sin referencias, renderiza el contenido plano, sin boton", () => {
    render(
      <EvidenceLink references={[]} onShowEvidence={vi.fn()}>
        S/ 32.00
      </EvidenceLink>
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("S/ 32.00")).toBeInTheDocument();
  });
});
