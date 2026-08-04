import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MoneyWithProvenance } from "./money-with-provenance";
import type { ProvenanceData } from "./provenance-panel";

const data: ProvenanceData = {
  title: "De dónde sale este S/560.00",
  countedLines: ["3 cuentas"],
  notCounted: [],
  rowsTitle: "Las 3 cuentas",
  rows: [{ id: "1", label: "BCP", amount: 560 }],
};

describe("MoneyWithProvenance — RUL-AYUDA-01: toda cifra es navegable hasta sus filas", () => {
  it("no carga la procedencia hasta que se pulsa (evita costo en cada render)", () => {
    const loadProvenance = vi.fn().mockResolvedValue(data);
    render(
      <MoneyWithProvenance loadProvenance={loadProvenance} ariaLabel="Ver de dónde sale S/560.00">
        S/560.00
      </MoneyWithProvenance>,
    );
    expect(loadProvenance).not.toHaveBeenCalled();
  });

  it("camino feliz: al pulsar, carga y abre el panel con los datos reales", async () => {
    const loadProvenance = vi.fn().mockResolvedValue(data);
    render(
      <MoneyWithProvenance loadProvenance={loadProvenance} ariaLabel="Ver de dónde sale S/560.00">
        S/560.00
      </MoneyWithProvenance>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ver de dónde sale S/560.00" }));

    await waitFor(() => expect(screen.getByRole("region")).toBeInTheDocument());
    expect(screen.getByText("BCP")).toBeInTheDocument();
    expect(loadProvenance).toHaveBeenCalledTimes(1);
  });

  it("un fallo de carga se dice, sin fingir que la cifra no tiene procedencia", async () => {
    const loadProvenance = vi.fn().mockRejectedValue(new Error("network"));
    render(
      <MoneyWithProvenance loadProvenance={loadProvenance} ariaLabel="Ver de dónde sale S/560.00">
        S/560.00
      </MoneyWithProvenance>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ver de dónde sale S/560.00" }));

    await screen.findByRole("alert");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("cerrar el panel devuelve el foco al botón que lo abrió (48 §11)", async () => {
    const loadProvenance = vi.fn().mockResolvedValue(data);
    render(
      <MoneyWithProvenance loadProvenance={loadProvenance} ariaLabel="Ver de dónde sale S/560.00">
        S/560.00
      </MoneyWithProvenance>,
    );

    const trigger = screen.getByRole("button", { name: "Ver de dónde sale S/560.00" });
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole("region")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("region")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
