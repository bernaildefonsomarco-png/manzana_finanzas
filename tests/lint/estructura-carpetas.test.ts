// `AC-INV-08` (52 §11, 53 D-11, WEB-D163 hermano): de las diez carpetas con
// solo `.gitkeep` medidas el 26 de julio de 2026, seis no tenían destino y
// desaparecen; cuatro las va a llenar el diseño y se conservan como
// marcadores. Este test impide que las seis reaparezcan vacías y que las
// tres restantes desaparezcan por accidente. `src/shared/dates` era la
// cuarta: `W-07` la llenó con el módulo único de fecha (`AC-PAT-09`,
// `src/shared/dates/lima.ts`), así que sale de la lista de marcadores — ya
// cumplió su destino, no hay nada que proteger de que "reaparezca vacía".
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();

const CARPETAS_SIN_DESTINO = [
  "src/agents/insights",
  "src/app/(dashboard)",
  "src/workers/insights",
  "src/workers/pending",
  "src/workers/email",
  "src/workers/recurring",
];

const MARCADORES_QUE_EL_DISEÑO_LLENARA = [
  "src/core/commands",
  "src/core/engines",
  "src/core/validators",
];

describe("AC-INV-08: las diez carpetas con solo .gitkeep de 52 §11", () => {
  it.each(CARPETAS_SIN_DESTINO)("%s ha desaparecido", (ruta) => {
    expect(existsSync(join(RAIZ, ruta))).toBe(false);
  });

  it.each(MARCADORES_QUE_EL_DISEÑO_LLENARA)("%s se conserva como marcador con .gitkeep", (ruta) => {
    const contenido = readdirSync(join(RAIZ, ruta));
    expect(contenido).toEqual([".gitkeep"]);
  });
});
