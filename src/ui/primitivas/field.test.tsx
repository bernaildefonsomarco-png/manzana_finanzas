import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FieldShell, Input } from "./field";

describe("FieldShell", () => {
  it("18 §4: un error se enlaza al control con aria-describedby y aria-invalid", () => {
    render(
      <FieldShell label="Monto" htmlFor="monto" error="Ingresa un monto valido">
        <Input id="monto" />
      </FieldShell>
    );

    const input = screen.getByLabelText("Monto");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBe("monto-error");
    expect(document.getElementById(describedBy!)).toHaveTextContent(
      "Ingresa un monto valido"
    );
  });

  it("sin error, el hint se enlaza y aria-invalid no se declara", () => {
    render(
      <FieldShell label="Monto" htmlFor="monto" hint="En soles">
        <Input id="monto" />
      </FieldShell>
    );

    const input = screen.getByLabelText("Monto");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input.getAttribute("aria-describedby")).toBe("monto-hint");
  });

  it("required agrega el asterisco visual y el atributo al control", () => {
    render(
      <FieldShell label="Monto" htmlFor="monto" required>
        <Input id="monto" />
      </FieldShell>
    );

    expect(screen.getByLabelText(/Monto/)).toBeRequired();
    expect(screen.getByText("*")).toBeInTheDocument();
  });
});

describe("Input", () => {
  it("con prefix/suffix envuelve el control sin perder su valor", () => {
    render(<Input aria-label="Monto" prefix="S/" suffix="PEN" defaultValue="10" />);
    expect(screen.getByText("S/")).toBeInTheDocument();
    expect(screen.getByText("PEN")).toBeInTheDocument();
    expect(screen.getByLabelText("Monto")).toHaveValue("10");
  });
});
