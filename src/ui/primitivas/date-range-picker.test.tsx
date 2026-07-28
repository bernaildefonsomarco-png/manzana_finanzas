import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { DateRangePicker, type DateRange } from "./date-range-picker";

function Harness() {
  const [value, setValue] = useState<DateRange>({ from: "2026-07-10", to: "2026-07-20" });
  return <DateRangePicker value={value} onValueChange={setValue} />;
}

describe("DateRangePicker", () => {
  it("mover 'hasta' antes de 'desde' corrige 'desde', no invierte el rango en silencio", () => {
    render(<Harness />);
    const hasta = screen.getByLabelText("Hasta");
    fireEvent.change(hasta, { target: { value: "2026-07-05" } });

    expect(screen.getByLabelText("Desde")).toHaveValue("2026-07-05");
    expect(screen.getByLabelText("Hasta")).toHaveValue("2026-07-05");
  });

  it("mover 'desde' despues de 'hasta' corrige 'hasta'", () => {
    render(<Harness />);
    const desde = screen.getByLabelText("Desde");
    fireEvent.change(desde, { target: { value: "2026-07-25" } });

    expect(screen.getByLabelText("Hasta")).toHaveValue("2026-07-25");
  });

  it("un cambio dentro del rango valido no toca la otra fecha", () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-07-12" } });
    expect(screen.getByLabelText("Hasta")).toHaveValue("2026-07-20");
  });
});
