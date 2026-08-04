import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HelpIndexScreen } from "./help-index-screen";
import { HELP_ARTICLES } from "./help-articles";

describe("HelpIndexScreen — 48 RUL-AYUDA-08: nueve artículos, no noventa", () => {
  it("lista exactamente los nueve artículos, sin buscador ni categorías", () => {
    render(<HelpIndexScreen />);
    expect(HELP_ARTICLES).toHaveLength(9);
    for (const article of HELP_ARTICLES) {
      expect(screen.getByText(article.question)).toBeInTheDocument();
    }
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("enlaza a soporte", () => {
    render(<HelpIndexScreen />);
    expect(screen.getByRole("link", { name: "Escribir a soporte" })).toHaveAttribute(
      "href",
      "/ayuda/contacto",
    );
  });
});
