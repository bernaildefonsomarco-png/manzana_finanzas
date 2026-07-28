// `AC-EXP-05` (`08` §9, §13): no aparece ningún porcentaje de confianza
// numérico en superficies estándar — "82% de confianza" no es procedencia;
// "así clasificaste 8 de tus últimos 10 pedidos" sí lo es (`08` §4.1).
// Excluye `src/features/**` (`REEMPLAZAR`, `WEB-D164`).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ_SRC = join(process.cwd(), "src");
const EXCLUIDOS = [join(RAIZ_SRC, "features")];

// Un número seguido de "%" cerca de la palabra "confianza" (o su inglés,
// por si un componente nuevo copia el texto de un experimento) en JSX/texto
// visible — no en un comentario de código o un nombre de variable interno,
// que sí puede llamarse `confidence` sin mostrarse nunca al usuario.
const PATRON_CONFIANZA_NUMERICA =
  /\d{1,3}\s*%[^<]{0,20}confian|confian[^<]{0,20}\d{1,3}\s*%/i;

function ficherosTsx(directorio: string, acumulado: string[]): string[] {
  for (const entrada of readdirSync(directorio)) {
    const ruta = join(directorio, entrada);
    if (EXCLUIDOS.some((ex) => ruta.startsWith(ex))) continue;
    if (statSync(ruta).isDirectory()) {
      ficherosTsx(ruta, acumulado);
    } else if (entrada.endsWith(".tsx") && !entrada.endsWith(".test.tsx")) {
      acumulado.push(ruta);
    }
  }
  return acumulado;
}

describe("AC-EXP-05: ningún porcentaje de confianza numérico en superficies estándar", () => {
  const ficheros = ficherosTsx(RAIZ_SRC, []);

  it("ningún fichero fuera de src/features/ muestra un porcentaje junto a 'confianza'", () => {
    const infractores = ficheros.filter((f) =>
      PATRON_CONFIANZA_NUMERICA.test(readFileSync(f, "utf8"))
    );
    expect(infractores.map((f) => relative(RAIZ_SRC, f))).toEqual([]);
  });
});
