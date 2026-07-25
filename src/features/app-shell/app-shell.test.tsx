import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

describe("app shell natural search", () => {
  it("expone la barra global de busqueda natural con parametros seguros", () => {
    render(
      <AppShell
        title="Home"
        activeView="home"
        searchDefaultValue="taxi viernes"
      >
        <p>Contenido</p>
      </AppShell>
    );

    const input = screen.getByLabelText("Pregunta algo sobre tu dinero");
    expect(input).toHaveValue("taxi viernes");
    expect(screen.getAllByRole("button", { name: "Buscar" })).toHaveLength(2);
    expect(document.querySelector('input[name="view"]')).toHaveValue("search");
  });

  it("en mobile abre la vista de busqueda sin mutar datos", () => {
    const onNavigate = vi.fn();

    render(
      <AppShell title="Home" activeView="home" onNavigate={onNavigate}>
        <p>Contenido</p>
      </AppShell>
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Buscar" })[1]);

    expect(onNavigate).toHaveBeenCalledWith("search");
  });
});
