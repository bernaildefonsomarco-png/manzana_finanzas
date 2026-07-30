// @vitest-environment jsdom

import { Suspense } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DeudaDetallePage from "./page";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => mocks.searchParams,
}));

vi.mock("@/shared/legacy-nav/legacy-view-routes", () => ({
  useLegacyNavigate: () => vi.fn(),
  useLegacySignOut: () => vi.fn(),
}));

vi.mock("@/features/debts/debts-screen", () => ({
  DebtsScreen: (props: {
    debtIntent: unknown;
    onDebtIntentConsumed: () => void;
    onDebtDetailClose: () => void;
  }) => (
    <div>
      <output aria-label="Intent de deuda">
        {JSON.stringify(props.debtIntent)}
      </output>
      <button type="button" onClick={props.onDebtIntentConsumed}>
        Consumir intención
      </button>
      <button type="button" onClick={props.onDebtDetailClose}>
        Cerrar detalle
      </button>
    </div>
  ),
}));

beforeEach(() => {
  mocks.replace.mockReset();
  mocks.searchParams = new URLSearchParams(
    "accion=pay&cuota=22222222-2222-4222-8222-222222222222"
  );
});

describe("DeudaDetallePage", () => {
  it("resuelve params Promise de Next 16 y monta el detalle real con intención", async () => {
    await act(async () => {
      render(
        <Suspense fallback={<p>Cargando ruta</p>}>
          <DeudaDetallePage
            params={Promise.resolve({
              id: "11111111-1111-4111-8111-111111111111",
            })}
          />
        </Suspense>
      );
    });

    expect(
      (await screen.findByLabelText("Intent de deuda")).textContent
    ).toBe(
      JSON.stringify({
        debtId: "11111111-1111-4111-8111-111111111111",
        installmentId: "22222222-2222-4222-8222-222222222222",
        action: "pay",
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Consumir intención" }));
    expect(mocks.replace).toHaveBeenCalledWith(
      "/deudas/11111111-1111-4111-8111-111111111111"
    );

    fireEvent.click(screen.getByRole("button", { name: "Cerrar detalle" }));
    expect(mocks.replace).toHaveBeenCalledWith("/deudas");
  });
});
