import { describe, expect, it } from "vitest";
import {
  buildMovementPrefillHref,
  isMovementDateFuture,
  movementDateFieldsFromPrefill,
  parseMovementPrefill,
} from "./movement-prefill";

describe("WEB-D238 movement prefill", () => {
  it("construye y lee el contrato canonico sin perder monto, categoria, fecha u origen", () => {
    const href = buildMovementPrefillHref({
      amount: 300,
      categoryId: "compras_personales",
      date: "2026-08-03",
      origin: "proyeccion",
    });

    expect(href).toBe(
      "/movimientos/nuevo?tipo=gasto&monto=300.00&categoria=compras_personales&fecha=2026-08-03&origen=proyeccion",
    );
    expect(parseMovementPrefill(new URL(href!, "http://localhost").searchParams)).toEqual({
      status: "valid",
      value: {
        type: "gasto",
        amount: "300.00",
        categoryId: "compras_personales",
        date: "2026-08-03",
        origin: "proyeccion",
      },
    });
  });

  it.each([
    ["monto con mas de dos decimales", "tipo=gasto&monto=10.001&categoria=alimentacion&fecha=2026-08-03&origen=descubrimiento"],
    ["monto cero", "tipo=gasto&monto=0&categoria=alimentacion&fecha=2026-08-03&origen=descubrimiento"],
    ["categoria no global", "tipo=gasto&monto=10&categoria=subcategoria-1&fecha=2026-08-03&origen=descubrimiento"],
    ["dia inexistente", "tipo=gasto&monto=10&categoria=alimentacion&fecha=2026-02-30&origen=descubrimiento"],
    ["tipo distinto", "tipo=ingreso&monto=10&categoria=alimentacion&fecha=2026-08-03&origen=descubrimiento"],
    ["origen distinto", "tipo=gasto&monto=10&categoria=alimentacion&fecha=2026-08-03&origen=email"],
    ["clave desconocida", "tipo=gasto&monto=10&categoria=alimentacion&fecha=2026-08-03&origen=descubrimiento&extra=1"],
    ["clave repetida", "tipo=gasto&monto=10&monto=11&categoria=alimentacion&fecha=2026-08-03&origen=descubrimiento"],
    ["clave ausente", "tipo=gasto&monto=10&categoria=alimentacion&fecha=2026-08-03"],
  ])("rechaza atomicamente %s", (_case, query) => {
    const result = parseMovementPrefill(new URLSearchParams(query));
    expect(result.status).toBe("invalid");
  });

  it("distingue una apertura normal sin parametros de un contrato roto", () => {
    expect(parseMovementPrefill(new URLSearchParams())).toEqual({ status: "empty" });
  });

  it("no construye enlaces parciales con monto, categoria o fecha invalidos", () => {
    expect(
      buildMovementPrefillHref({
        amount: "40.999",
        categoryId: "alimentacion",
        date: "2026-08-03",
        origin: "descubrimiento",
      }),
    ).toBeNull();
    expect(
      buildMovementPrefillHref({
        amount: "40.00",
        categoryId: "subcategoria-1",
        date: "2026-08-03",
        origin: "descubrimiento",
      }),
    ).toBeNull();
  });

  it("conserva la hora Lima para hoy y exige elegirla en un dia pasado", () => {
    const todayPrefill = validPrefill("2026-08-01");
    const pastPrefill = validPrefill("2026-07-30");

    expect(movementDateFieldsFromPrefill(todayPrefill, "2026-08-01T14:35")).toEqual({
      date: "2026-08-01",
      time: "14:35",
    });
    expect(movementDateFieldsFromPrefill(pastPrefill, "2026-08-01T14:35")).toEqual({
      date: "2026-07-30",
      time: "",
    });
    expect(isMovementDateFuture("2026-08-03", "2026-08-01")).toBe(true);
    expect(isMovementDateFuture("2026-08-01", "2026-08-01")).toBe(false);
  });
});

function validPrefill(date: string) {
  return {
    type: "gasto" as const,
    amount: "40.00",
    categoryId: "alimentacion" as const,
    date,
    origin: "descubrimiento" as const,
  };
}
