import { describe, expect, it } from "vitest";
import { buildMovementsCsv, exportFileName } from "./csv-export";

describe("buildMovementsCsv (RUL-REP-10, AC-REP-08/09)", () => {
  it("empieza con BOM UTF-8 y usa CRLF entre líneas", () => {
    const csv = buildMovementsCsv([
      {
        fecha: "2026-07-14",
        tipo: "gasto",
        descripcion: "Netflix",
        monto: -44.9,
        moneda: "PEN",
        categoria: "Ocio y salidas",
        subcategoria: null,
        cuenta: "BCP",
        caja: null,
        etiquetas: [],
        origen: "dashboard_manual",
        estado: "confirmed",
        id_movimiento: "m1",
      },
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("\r\n");
    expect(csv).not.toContain("S/");
  });

  it("monto sin símbolo, con punto decimal y sin separador de miles", () => {
    const csv = buildMovementsCsv([
      {
        fecha: "2026-07-14",
        tipo: "gasto",
        descripcion: null,
        monto: -1234.5,
        moneda: "PEN",
        categoria: null,
        subcategoria: null,
        cuenta: null,
        caja: null,
        etiquetas: [],
        origen: "dashboard_manual",
        estado: "confirmed",
        id_movimiento: "m2",
      },
    ]);
    expect(csv).toContain("-1234.50");
  });

  it("escapa comas y comillas según RFC 4180", () => {
    const csv = buildMovementsCsv([
      {
        fecha: "2026-07-14",
        tipo: "gasto",
        descripcion: 'Almuerzo con "Ana", en el centro',
        monto: -20,
        moneda: "PEN",
        categoria: null,
        subcategoria: null,
        cuenta: null,
        caja: null,
        etiquetas: [],
        origen: "dashboard_manual",
        estado: "confirmed",
        id_movimiento: "m3",
      },
    ]);
    expect(csv).toContain('"Almuerzo con ""Ana"", en el centro"');
  });

  it("la cabecera va siempre, en español", () => {
    const csv = buildMovementsCsv([]);
    expect(csv).toContain("fecha,tipo,descripcion,monto,moneda,categoria,subcategoria,cuenta,caja,etiquetas,origen,estado,id_movimiento");
  });
});

describe("exportFileName", () => {
  it("nombra el archivo con el rango de fechas", () => {
    expect(exportFileName("movimientos", "2026-07-01", "2026-07-31")).toBe(
      "manzana-movimientos-2026-07-01-a-2026-07-31.csv",
    );
  });
  it("datos_completos siempre es json", () => {
    expect(exportFileName("datos_completos")).toBe("manzana-todos-mis-datos.json");
  });
});
