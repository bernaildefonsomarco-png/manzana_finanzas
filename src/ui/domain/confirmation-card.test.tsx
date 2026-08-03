import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmationCard, type ConfirmationCardField } from "./confirmation-card";

const mocks = vi.hoisted(() => ({ discreet: false }));
vi.mock("@/shared/privacy/discreet-mode-context", () => ({
  useDiscreetMode: () => ({ discreet: mocks.discreet, saving: false, setDiscreet: vi.fn() }),
}));

const FIELDS: ConfirmationCardField[] = [
  { key: "amount", label: "Monto", value: "32.00" },
  { key: "category", label: "Categoría", value: "Alimentación" },
];

describe("ConfirmationCard", () => {
  it("tarjeta: confirmar antes que cancelar, con aria-label completo (18)", () => {
    render(
      <ConfirmationCard
        level="tarjeta"
        title="Voy a registrar un gasto"
        fields={FIELDS}
        confirmLabel="Registrar"
        confirmAriaLabel="Registrar gasto de 32 soles en Alimentación"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveTextContent("Cancelar");
    expect(buttons[1]).toHaveAccessibleName(
      "Registrar gasto de 32 soles en Alimentación"
    );
  });

  it("RUL-ASI-05/06: tarjeta_editable renderiza inputs y el onConfirm/onCancel funcionan", () => {
    const onConfirm = vi.fn();
    const onFieldChange = vi.fn();
    render(
      <ConfirmationCard
        level="tarjeta_editable"
        title="Voy a registrar un gasto"
        fields={FIELDS}
        confirmLabel="Registrar"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
        onFieldChange={onFieldChange}
      />
    );

    const amountInput = screen.getByLabelText("Monto");
    expect(amountInput).toHaveValue("32.00");
    fireEvent.change(amountInput, { target: { value: "40.00" } });
    expect(onFieldChange).toHaveBeenCalledWith("amount", "40.00");

    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("RUL-ASI-06: con autoFocusUncertainField, el foco entra en el primer campo incierto al montar", () => {
    const fields: ConfirmationCardField[] = [
      { key: "amount", label: "Monto", value: "32.00" },
      { key: "category", label: "Categoría", value: "", uncertain: true },
    ];
    render(
      <ConfirmationCard
        level="tarjeta_editable"
        title="Voy a registrar un gasto"
        fields={fields}
        confirmLabel="Registrar"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onFieldChange={vi.fn()}
        autoFocusUncertainField
      />
    );

    expect(screen.getByLabelText("Categoría")).toHaveFocus();
  });

  it("RUL-ASI-22: por defecto (sin autoFocusUncertainField) NUNCA mueve el foco, ni con un campo incierto — llega como respuesta al mensaje que el usuario acaba de enviar", () => {
    const fields: ConfirmationCardField[] = [
      { key: "amount", label: "Monto", value: "32.00" },
      { key: "category", label: "Categoría", value: "", uncertain: true },
    ];
    render(
      <ConfirmationCard
        level="tarjeta_editable"
        title="Voy a registrar un gasto"
        fields={fields}
        confirmLabel="Registrar"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onFieldChange={vi.fn()}
      />
    );

    expect(document.body).toHaveFocus();
  });

  it("no mueve el foco cuando ningun campo es incierto, ni con autoFocusUncertainField", () => {
    render(
      <ConfirmationCard
        level="tarjeta_editable"
        title="Voy a registrar un gasto"
        fields={FIELDS}
        confirmLabel="Registrar"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onFieldChange={vi.fn()}
        autoFocusUncertainField
      />
    );

    expect(document.body).toHaveFocus();
  });

  it("nivel riesgo: el boton destructivo va primero, nombrado, y NO es 'primary'; 'No eliminar' es primary", () => {
    render(
      <ConfirmationCard
        level="riesgo"
        title="Voy a eliminar este gasto"
        fields={FIELDS}
        confirmLabel="Eliminar este gasto"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        undoNote="Podrás deshacerlo durante 30 días."
      />
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveTextContent("Eliminar este gasto");
    expect(buttons[0].className).not.toMatch(/bg-brand\b/);
    expect(buttons[1]).toHaveTextContent("No eliminar");
    expect(buttons[1].className).toMatch(/bg-brand\b/);
    expect(screen.getByText("Podrás deshacerlo durante 30 días.")).toBeInTheDocument();
  });

  it("nivel consentimiento: muestra que, frecuencia y como revocar", () => {
    render(
      <ConfirmationCard
        level="consentimiento"
        title="Voy a activar los recordatorios"
        fields={[]}
        confirmLabel="Activar"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        consentDetails={{
          what: "Enviar un recordatorio semanal",
          frequency: "Cada lunes a las 9am",
          revoke: "Apaga los recordatorios desde Ajustes",
        }}
      />
    );

    expect(screen.getByText("Enviar un recordatorio semanal")).toBeInTheDocument();
    expect(screen.getByText("Cada lunes a las 9am")).toBeInTheDocument();
    expect(screen.getByText("Apaga los recordatorios desde Ajustes")).toBeInTheDocument();
  });

  it("resalta un campo incierto no editable (tarjeta)", () => {
    const fields: ConfirmationCardField[] = [
      { key: "category", label: "Categoría", value: "¿Alimentación?", uncertain: true },
    ];
    render(
      <ConfirmationCard
        level="tarjeta"
        title="Voy a registrar un gasto"
        fields={fields}
        confirmLabel="Registrar"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("¿Alimentación?").closest("dd")?.className).toMatch(
      /bg-warning-subtle/
    );
  });

  it("RUL-ASI-17: un campo de dinero de solo lectura respeta el modo discreto", () => {
    mocks.discreet = true;
    const fields: ConfirmationCardField[] = [
      { key: "amount", label: "Monto", value: "32.00", moneyValue: 32 },
    ];
    render(
      <ConfirmationCard
        level="tarjeta"
        title="Voy a registrar un gasto"
        fields={fields}
        confirmLabel="Registrar"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.queryByText("32.00")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Monto oculto")).toBeInTheDocument();
    mocks.discreet = false;
  });

  it("sin modo discreto, un campo de dinero de solo lectura muestra el monto formateado", () => {
    const fields: ConfirmationCardField[] = [
      { key: "amount", label: "Monto", value: "32.00", moneyValue: 32 },
    ];
    render(
      <ConfirmationCard
        level="tarjeta"
        title="Voy a registrar un gasto"
        fields={fields}
        confirmLabel="Registrar"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("S/32.00")).toBeInTheDocument();
  });
});
