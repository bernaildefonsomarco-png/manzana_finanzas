import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MassivePreviewCard, type MassivePreviewItem } from "./massive-preview-card";

function makeItems(): MassivePreviewItem[] {
  return [
    { id: "1", label: "26 jul Rappi S/32.00", selected: true },
    { id: "2", label: "24 jul Rappi S/18.50", selected: true },
    { id: "3", label: "20 jul Rappi S/9.00", selected: true },
  ];
}

describe("MassivePreviewCard", () => {
  it("41 S6: muestra el conteo real en el encabezado del boton de confirmar", () => {
    render(
      <MassivePreviewCard
        title='Voy a reclasificar 23 movimientos de "Rappi" a Alimentación'
        totalCount={23}
        sampleItems={makeItems()}
        onToggleItem={vi.fn()}
        confirmActionLabel="Reclasificar"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "Reclasificar 23 movimientos" })
    ).toBeInTheDocument();
    expect(screen.getByText(/… y 20 más/)).toBeInTheDocument();
  });

  it("AC-ASI-09: al excluir un item de la muestra, el numero del boton baja en vivo", () => {
    const onToggleItem = vi.fn();
    const items = makeItems();
    const { rerender } = render(
      <MassivePreviewCard
        title="Voy a reclasificar 23 movimientos"
        totalCount={23}
        sampleItems={items}
        onToggleItem={onToggleItem}
        confirmActionLabel="Reclasificar"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText("26 jul Rappi S/32.00"));
    expect(onToggleItem).toHaveBeenCalledWith("1", false);

    const updated = items.map((item) => (item.id === "1" ? { ...item, selected: false } : item));
    rerender(
      <MassivePreviewCard
        title="Voy a reclasificar 23 movimientos"
        totalCount={23}
        sampleItems={updated}
        onToggleItem={onToggleItem}
        confirmActionLabel="Reclasificar"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "Reclasificar 22 movimientos" })
    ).toBeInTheDocument();
  });

  it("muestra las exclusiones explicadas cuando vienen", () => {
    render(
      <MassivePreviewCard
        title="Voy a reclasificar 23 movimientos"
        totalCount={23}
        sampleItems={makeItems()}
        onToggleItem={vi.fn()}
        confirmActionLabel="Reclasificar"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        exclusionsNote="No incluyo 2 que ya están en Alimentación."
      />
    );

    expect(
      screen.getByText("No incluyo 2 que ya están en Alimentación.")
    ).toBeInTheDocument();
  });

  it("sin excluidos aun no muestra 'y N mas' cuando la muestra cubre el total", () => {
    render(
      <MassivePreviewCard
        title="Voy a reclasificar 3 movimientos"
        totalCount={3}
        sampleItems={makeItems()}
        onToggleItem={vi.fn()}
        confirmActionLabel="Reclasificar"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.queryByText(/más/)).not.toBeInTheDocument();
  });

  it("desactiva el boton de confirmar cuando se excluye todo", () => {
    const items = makeItems().map((item) => ({ ...item, selected: false }));
    render(
      <MassivePreviewCard
        title="Voy a reclasificar 3 movimientos"
        totalCount={3}
        sampleItems={items}
        onToggleItem={vi.fn()}
        confirmActionLabel="Reclasificar"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Reclasificar 0 movimientos" })).toBeDisabled();
  });
});
