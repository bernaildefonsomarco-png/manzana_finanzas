import { describe, expect, it } from "vitest";
import { verifyBlocks, type Block } from "./types";

describe("AC-CANAL-03: un bloque cifra sin referencias no llega a ningun presentador", () => {
  it("descarta un bloque cifra con references vacio", () => {
    const blocks: Block[] = [
      { kind: "cifra", text: "S/170", amount: 170, currency: "PEN", references: [] },
    ];
    expect(verifyBlocks(blocks)).toEqual([]);
  });

  it("conserva un bloque cifra con al menos una referencia", () => {
    const blocks: Block[] = [
      {
        kind: "cifra",
        text: "S/170",
        amount: 170,
        currency: "PEN",
        references: [{ kind: "movimiento", id: "m-1" }],
      },
    ];
    expect(verifyBlocks(blocks)).toHaveLength(1);
  });
});

describe("AC-CANAL-04: un bloque propuesta sin comando ejecutable no llega a ningun presentador", () => {
  it("descarta un bloque propuesta con commandId vacio", () => {
    const blocks: Block[] = [
      { kind: "propuesta", text: "Registro 40 en super", commandId: "", options: [] },
    ];
    expect(verifyBlocks(blocks)).toEqual([]);
  });

  it("conserva un bloque propuesta con commandId no vacio", () => {
    const blocks: Block[] = [
      {
        kind: "propuesta",
        text: "Registro 40 en super",
        commandId: "corr:amount:1:40",
        options: [],
      },
    ];
    expect(verifyBlocks(blocks)).toHaveLength(1);
  });

  it("deja pasar bloques de otros tipos sin filtrar", () => {
    const blocks: Block[] = [{ kind: "texto", text: "Listo." }];
    expect(verifyBlocks(blocks)).toHaveLength(1);
  });
});
