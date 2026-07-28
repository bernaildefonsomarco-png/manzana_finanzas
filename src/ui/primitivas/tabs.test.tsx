import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Tab, TabList, TabPanel, Tabs } from "./tabs";

function Harness() {
  const [value, setValue] = useState("resumen");
  return (
    <Tabs value={value} onValueChange={setValue}>
      <TabList>
        <Tab value="resumen">Resumen</Tab>
        <Tab value="detalle">Detalle</Tab>
        <Tab value="historial">Historial</Tab>
      </TabList>
      <TabPanel value="resumen">Contenido resumen</TabPanel>
      <TabPanel value="detalle">Contenido detalle</TabPanel>
      <TabPanel value="historial">Contenido historial</TabPanel>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("16 §4.2: ArrowRight activa la siguiente pestana de inmediato", () => {
    render(<Harness />);
    const resumen = screen.getByRole("tab", { name: "Resumen" });
    resumen.focus();
    fireEvent.keyDown(resumen, { key: "ArrowRight" });

    const detalle = screen.getByRole("tab", { name: "Detalle" });
    expect(document.activeElement).toBe(detalle);
    expect(detalle).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Contenido detalle")).toBeInTheDocument();
    expect(screen.queryByText("Contenido resumen")).not.toBeInTheDocument();
  });

  it("End va a la ultima pestana, Home a la primera", () => {
    render(<Harness />);
    const resumen = screen.getByRole("tab", { name: "Resumen" });
    resumen.focus();
    fireEvent.keyDown(resumen, { key: "End" });
    expect(screen.getByRole("tab", { name: "Historial" })).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    expect(screen.getByRole("tab", { name: "Resumen" })).toHaveAttribute("aria-selected", "true");
  });
});
