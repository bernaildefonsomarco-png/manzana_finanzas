import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DebtInstallmentsSection } from "./upcoming-screen";

describe("debt installments section", () => {
  it("abre detalle o pago seguro para la cuota accionable", () => {
    const onOpenDebt = vi.fn();

    render(
      <DebtInstallmentsSection
        items={[
          {
            id: "installment-1",
            debt_id: "debt-1",
            installment_id: "installment-1",
            title: "Cuota 1: Juan",
            amount: 100,
            currency: "PEN",
            direction: "i_owe",
            due_at: "2026-06-30",
            due_label: "Hoy",
            status_label: "Proxima",
            status_tone: "info",
            is_overdue: false,
            can_register_payment: true,
            payment_action_label: "Registrar pago",
          },
        ]}
        onOpenDebt={onOpenDebt}
      />
    );

    expect(screen.getByRole("heading", { name: "Cuotas de deuda" })).toBeTruthy();
    expect(screen.getByText("Cuota 1: Juan")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Marcar pagado" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Ver deuda" }));
    expect(onOpenDebt).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ debt_id: "debt-1" }),
      "detail"
    );

    fireEvent.click(screen.getByRole("button", { name: "Registrar pago" }));
    expect(onOpenDebt).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ installment_id: "installment-1" }),
      "pay"
    );
  });
});
