import { fireEvent, render, screen, within } from "@testing-library/react";
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
    // AC-NAV-04 / AC-ARQ-01: la búsqueda navega a la ruta real `/buscar`,
    // nunca a un `?view=search` (W-07).
    expect(input.closest("form")).toHaveAttribute("action", "/buscar");
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

describe("app shell navegación (AC-NAV-06, AC-NAV-08, W-07)", () => {
  it("AC-NAV-08: el elemento activo se anuncia con aria-current, no solo con color", () => {
    render(
      <AppShell title="Movimientos" activeView="movements" onNavigate={vi.fn()}>
        <p>Contenido</p>
      </AppShell>
    );

    const activos = screen.getAllByText("Movimientos").map((el) => el.closest("button"));
    expect(activos.some((btn) => btn?.getAttribute("aria-current") === "page")).toBe(true);

    const inactivo = screen.getAllByText("Deudas")[0].closest("button");
    expect(inactivo).not.toHaveAttribute("aria-current");
  });

  it("AC-NAV-06: el menú 'Más' de móvil expone todas las secciones que no están en la barra inferior", () => {
    render(
      <AppShell title="Home" activeView="home" onNavigate={vi.fn()}>
        <p>Contenido</p>
      </AppShell>
    );

    fireEvent.click(screen.getByRole("button", { name: "Más" }));
    const menu = screen.getByRole("menu", { name: "Más secciones" });

    // Las cuatro fijas de la barra inferior (Home, Movimientos, Pendientes,
    // Mi Dinero) NO están aquí; las siete restantes más Configuración sí.
    for (const seccion of [
      "Deudas",
      "Pagos que vienen",
      "Descubrimientos",
      "Presupuestos",
      "Reportes",
      "Proyecciones",
      "Asistente",
      "Configuración",
    ]) {
      expect(within(menu).getByText(seccion)).toBeInTheDocument();
    }
  });
});
