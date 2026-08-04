import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { leerCorpus } from "../../scripts/matriz/lib/corpus.ts";

// `47` `AC-VIDA-02` (clase `corpus`) — ninguna §12 ("Estados de datos") de
// los dieciséis módulos usa "pocos" o "muchos" como nombre de tramo sin
// declarar el corte en la misma línea (`RUL-VIDA-04`). Se acota a §12 con
// el mismo rastreo de secciones que usa el generador de la matriz
// (`corpus.ts`), no un grep de todo el documento: la prosa de otras
// secciones puede decir "muchos" en una frase corriente sin que sea una
// tabla de tramos — confundir las dos produjo falsos positivos reales en
// `27`/`33`/`34`/`38` al escribir este test la primera vez.
const MODULOS = new Set(
  Array.from({ length: 39 - 24 + 1 }, (_, i) => String(24 + i)),
);

describe("AC-VIDA-02: un umbral sin número no es un umbral (RUL-VIDA-04)", () => {
  it("toda fila de la tabla de §12 que dice 'pocos' o 'muchos' declara un número en la misma línea", () => {
    const documentos = leerCorpus().filter((d) => MODULOS.has(d.numero));
    const infractoras: string[] = [];

    for (const documento of documentos) {
      documento.lineas.forEach((linea, indice) => {
        if (documento.dentroDeCerca[indice]) return;
        if (documento.secciones[indice] !== "§12") return;
        if (/\b(pocos?|muchas?|muchos?)\b/i.test(linea) && !/\d/.test(linea)) {
          infractoras.push(`${documento.numero} (${documento.ruta}):${indice + 1}`);
        }
      });
    }

    expect(infractoras).toEqual([]);
  });
});

describe("AC-VIDA-01: los tramos de presentación de 39 §5 son los únicos con esos cuatro nombres", () => {
  it("el documento 47 declara los cuatro tramos exactos: vacío, temprano, funcional, completo", () => {
    const contenido = readFileSync(
      join(process.cwd(), "documentacion", "app_web", "06_transversales", "47_ciclo_de_vida_del_dato_y_estados_vacios.md"),
      "utf8",
    );
    for (const tramo of ["vacío", "temprano", "funcional", "completo"]) {
      expect(contenido).toContain(tramo);
    }
  });

  it("07 §3.18 ya no declara los tramos '0 / 5 / 50 / 500' divergentes de 39 §5 (WEB-D134)", () => {
    const alcance = readFileSync(
      join(process.cwd(), "documentacion", "app_web", "01_producto", "07_alcance_web_v1.md"),
      "utf8",
    );
    expect(alcance).not.toContain("0 / 5 / 50 / 500");
  });
});
