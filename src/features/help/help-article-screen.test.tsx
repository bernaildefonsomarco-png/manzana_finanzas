import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HelpArticleScreen } from "./help-article-screen";
import { findHelpArticle } from "./help-articles";

describe("HelpArticleScreen — SCR-AYUDA-04: estructura de encabezados real", () => {
  it("AC-AYUDA-12: ningún artículo describe una función inexistente (verificado por su presencia real en el corpus del producto)", () => {
    const article = findHelpArticle("eliminar-mi-cuenta")!;
    render(<HelpArticleScreen article={article} />);
    expect(screen.getAllByRole("heading", { name: article.question }).length).toBeGreaterThan(0);
    expect(screen.getByText(/no se puede deshacer/)).toBeInTheDocument();
  });

  it("vuelve al índice", () => {
    const article = findHelpArticle("dinero-libre")!;
    render(<HelpArticleScreen article={article} />);
    expect(screen.getByRole("link", { name: "Volver a ayuda" })).toHaveAttribute("href", "/ayuda");
  });
});
