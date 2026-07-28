import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Pagination } from "./pagination";

describe("Pagination", () => {
  it("16 §4.2: los botones reales deshabilitan segun hasPrevious/hasNext", () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    render(
      <Pagination hasPrevious={false} hasNext onPrevious={onPrevious} onNext={onNext} />
    );

    expect(screen.getByRole("button", { name: /Anterior/ })).toBeDisabled();
    const next = screen.getByRole("button", { name: /Siguiente/ });
    expect(next).not.toBeDisabled();
    fireEvent.click(next);
    expect(onNext).toHaveBeenCalled();
  });
});
