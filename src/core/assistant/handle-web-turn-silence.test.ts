import { describe, expect, it } from "vitest";
import type { Block } from "@/core/channel/types";
import { withoutActionBlocksForTests } from "./handle-web-turn";

const PROPUESTA: Block = {
  kind: "propuesta",
  text: "¿Creo la caja Carro?",
  commandId: "estr:abc",
  options: [
    { id: "estr:abc", label: "Sí, crear la caja" },
    { id: "estr:cancel", label: "No, cancelar" },
  ],
};

const TEXTO: Block = { kind: "texto", text: "Tienes S/427 libres." };

function plan(blocks: Block[]) {
  return { blocks, reason: "structure_needs_confirmation" } as never;
}

describe("AC-ASI-17: en solo_lectura no se emite la tarjeta, pero tampoco se calla", () => {
  it("un turno que era solo una propuesta declara el limite en vez de quedar mudo", () => {
    // Reproduccion del caso real: "crea una caja para esa meta" en grado
    // solo_lectura se quedaba en cero bloques y se guardaba un mensaje vacio.
    const resultado = withoutActionBlocksForTests(plan([PROPUESTA]));

    expect(resultado.blocks).toHaveLength(1);
    expect(resultado.blocks[0]).toMatchObject({ kind: "limite" });
  });

  it("si queda contenido real, no se agrega ningun relleno", () => {
    const resultado = withoutActionBlocksForTests(plan([TEXTO, PROPUESTA]));

    expect(resultado.blocks).toEqual([TEXTO]);
  });

  it("un plan sin tarjetas pasa intacto", () => {
    const resultado = withoutActionBlocksForTests(plan([TEXTO]));

    expect(resultado.blocks).toEqual([TEXTO]);
  });
});
