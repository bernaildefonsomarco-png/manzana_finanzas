// `19` `AC-OBS-02`/§4.1: ningún registro contiene montos, nombres de
// comercios ni de personas relacionadas, ni contenido de correos.
// Heurística de texto, no AST completo (mismo nivel de rigor que
// `tests/lint/asi-22-sin-contenido-en-telemetria.test.ts`, `W-17`): busca
// las claves financieras inequívocas como propiedad de un objeto pasado a
// `logger.*`. Deliberadamente estrecho —`amount`/`monto`/`merchant`/
// `comercio`— para no producir falsos positivos sobre palabras genéricas
// como "descripcion" de un error, que sí tienen usos legítimos ajenos a
// datos financieros.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ_SRC = join(process.cwd(), "src");
const CLAVES_PROHIBIDAS = [
  /\bamount\s*[,:]/,
  /\bmonto\s*[,:]/,
  /\bmerchant\s*[,:]/,
  /\bcomercio\s*[,:]/,
];

function ficherosFuente(directorio: string, acumulado: string[]): string[] {
  for (const entrada of readdirSync(directorio)) {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) {
      ficherosFuente(ruta, acumulado);
    } else if (/\.tsx?$/.test(entrada) && !/\.test\.tsx?$/.test(entrada)) {
      acumulado.push(ruta);
    }
  }
  return acumulado;
}

function llamadasALogger(contenido: string): string[] {
  return contenido.match(/logger\.\w+\([^;]*?\)\s*;/g) ?? [];
}

describe("AC-OBS-02: ningún registro contiene montos ni nombres de comercios", () => {
  const ficheros = ficherosFuente(RAIZ_SRC, []);
  const infractores: string[] = [];

  for (const ruta of ficheros) {
    const contenido = readFileSync(ruta, "utf8");
    for (const llamada of llamadasALogger(contenido)) {
      if (CLAVES_PROHIBIDAS.some((patron) => patron.test(llamada))) {
        infractores.push(relative(RAIZ_SRC, ruta));
      }
    }
  }

  it("ningún logger.* del proyecto pasa amount/monto/merchant/comercio como metadato", () => {
    expect([...new Set(infractores)]).toEqual([]);
  });

  it("RUL-HECHO-02: el patrón sí detecta un caso fabricado con 'monto:'", () => {
    const ejemploInfractor = 'logger.info("x", { monto: 500 });';
    expect(CLAVES_PROHIBIDAS.some((patron) => patron.test(ejemploInfractor))).toBe(true);
  });
});
