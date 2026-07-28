import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./toast";

function Harness() {
  const { show } = useToast();
  return (
    <button
      type="button"
      onClick={() =>
        show({ message: "Movimiento eliminado", actionLabel: "Deshacer", onAction: () => undefined })
      }
    >
      Eliminar
    </button>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ToastProvider", () => {
  it("18 §6: un aviso con Deshacer permanece al menos 5s", () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(screen.getByText("Movimiento eliminado")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(screen.getByText("Movimiento eliminado")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(screen.queryByText("Movimiento eliminado")).not.toBeInTheDocument();
  });

  it("18 §6: no se cierra mientras el foco esta dentro", () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    const toast = screen.getByRole("status");
    fireEvent.focus(toast);

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText("Movimiento eliminado")).toBeInTheDocument();

    fireEvent.blur(toast);
    act(() => {
      vi.advanceTimersByTime(5001);
    });
    expect(screen.queryByText("Movimiento eliminado")).not.toBeInTheDocument();
  });
});
