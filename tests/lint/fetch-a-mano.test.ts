// `AC-PAT-01` (`17` §2, `51` §6.4 `fetch-a-mano`): ninguna pantalla
// implementa a mano el patrón `useEffect` + bandera de cancelación para
// obtener datos — usa la librería de obtención de datos elegida en `W-07`
// (TanStack Query, `WEB-D165`/`WEB-D186`) en su lugar. Diferida por
// `WEB-D169` hasta que esa librería existiera; activa desde `W-07`.
// Excluye `src/features/**` (`REEMPLAZAR`, `WEB-D164`): el patrón
// `let active = true` / `active = false` ya vive en las pantallas
// condenadas y desaparece con ellas, no se arregla in situ.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ_SRC = join(process.cwd(), "src");
const EXCLUIDOS = [join(RAIZ_SRC, "features")];

// El idioma exacto de la bandera de cancelación que `17` §1 describe: una
// variable de "sigue activo" declarada y luego apagada en el cleanup de un
// efecto. Las dos partes juntas son la firma inequívoca del patrón a mano;
// cualquiera de las dos por separado tiene usos legítimos no relacionados.
const PATRON_DECLARACION = /\blet\s+(\w+)\s*=\s*true\s*;/g;

function usaBanderaDeCancelacion(contenido: string): boolean {
  let match: RegExpExecArray | null;
  PATRON_DECLARACION.lastIndex = 0;
  while ((match = PATRON_DECLARACION.exec(contenido))) {
    const nombre = match[1];
    const apagado = new RegExp(`\\b${nombre}\\s*=\\s*false\\s*;`);
    if (apagado.test(contenido) && /useEffect/.test(contenido)) {
      return true;
    }
  }
  return false;
}

function ficherosFuente(directorio: string, acumulado: string[]): string[] {
  for (const entrada of readdirSync(directorio)) {
    const ruta = join(directorio, entrada);
    if (EXCLUIDOS.some((ex) => ruta.startsWith(ex))) continue;
    if (statSync(ruta).isDirectory()) {
      ficherosFuente(ruta, acumulado);
    } else if (/\.tsx?$/.test(entrada) && !entrada.endsWith(".test.tsx") && !entrada.endsWith(".test.ts")) {
      acumulado.push(ruta);
    }
  }
  return acumulado;
}

describe("AC-PAT-01 (fetch-a-mano): nada fuera de src/features/ implementa a mano el patrón de datos", () => {
  const ficheros = ficherosFuente(RAIZ_SRC, []);

  it("ningún fichero combina useEffect con una bandera de cancelación manual", () => {
    const infractores = ficheros.filter((f) => usaBanderaDeCancelacion(readFileSync(f, "utf8")));
    expect(infractores.map((f) => relative(RAIZ_SRC, f))).toEqual([]);
  });
});
