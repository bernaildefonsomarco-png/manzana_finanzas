import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProvenancePanel, type ProvenanceData } from "./provenance-panel";

const mocks = vi.hoisted(() => ({ useDiscreetMode: vi.fn(() => ({ discreet: false })) }));
vi.mock("@/shared/privacy/discreet-mode-context", () => ({ useDiscreetMode: mocks.useDiscreetMode }));

beforeEach(() => {
  mocks.useDiscreetMode.mockReturnValue({ discreet: false });
});

const sampleData: ProvenanceData = {
  title: "De dónde sale este S/318.00",
  countedLines: ["14 gastos de Alimentación", "Del 1 al 26 de julio"],
  notCounted: [
    { text: "2 transferencias entre tus cuentas" },
    { text: "1 pendiente del correo sin confirmar", actionLabel: "Revisar ese pendiente", actionHref: "/pendientes/abc" },
  ],
  rowsTitle: "Los 14 movimientos",
  rows: [
    { id: "1", label: "Rappi", detail: "26 jul", amount: 32, href: "/movimientos/1" },
    { id: "2", label: "Mercado", detail: "24 jul", amount: 58 },
  ],
};

describe("ProvenancePanel — SCR-AYUDA-01/RUL-AYUDA-02: qué conté y qué no conté", () => {
  it("muestra el título, las dos secciones y las filas navegables", () => {
    render(<ProvenancePanel data={sampleData} onClose={() => {}} />);

    expect(screen.getByRole("region", { name: "De dónde sale este S/318.00" })).toBeInTheDocument();
    expect(screen.getByText("14 gastos de Alimentación")).toBeInTheDocument();
    expect(screen.getByText("2 transferencias entre tus cuentas")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revisar ese pendiente" })).toHaveAttribute(
      "href",
      "/pendientes/abc",
    );
    expect(screen.getByRole("link", { name: /Rappi/ })).toHaveAttribute("href", "/movimientos/1");
  });

  it("48 §11, RUL-ASI-01: el panel nunca es un dialog modal — es un <section>, sin overlay ni trampa de foco", () => {
    render(<ProvenancePanel data={sampleData} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("region")).toBeInTheDocument();
  });

  it("Escape cierra el panel", () => {
    const onClose = vi.fn();
    render(<ProvenancePanel data={sampleData} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("el botón de cerrar llama a onClose", () => {
    const onClose = vi.fn();
    render(<ProvenancePanel data={sampleData} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("una fila sin href no es un enlace, pero sigue siendo un elemento de lista válido", () => {
    render(<ProvenancePanel data={sampleData} onClose={() => {}} />);
    expect(screen.getByText("Mercado")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Mercado/ })).not.toBeInTheDocument();
  });

  it("48 caso borde 10, AC-AYUDA-13: en modo discreto, el título y las líneas ocultan el monto, no el texto", () => {
    mocks.useDiscreetMode.mockReturnValue({ discreet: true });
    render(<ProvenancePanel data={sampleData} onClose={() => {}} />);
    expect(screen.getByRole("region", { name: "De dónde sale este ••••" })).toBeInTheDocument();
    expect(screen.queryByText("S/318.00", { exact: false })).not.toBeInTheDocument();
    expect(screen.getByText("14 gastos de Alimentación")).toBeInTheDocument();
  });

  it("RUL-HECHO-02: sin countedLines/notCounted/rows, esas secciones no se renderizan", () => {
    render(
      <ProvenancePanel
        data={{ title: "x", countedLines: [], notCounted: [], rowsTitle: "y", rows: [] }}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByText("Qué conté")).not.toBeInTheDocument();
    expect(screen.queryByText("Qué no conté")).not.toBeInTheDocument();
  });
});
