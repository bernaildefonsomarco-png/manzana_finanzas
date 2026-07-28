// `AC-PRUEBA-01`, `AC-PRUEBA-10`, `AC-PRUEBA-12` (`51` §13).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generarMatriz } from "../../scripts/matriz/generar.ts";

describe("AC-PRUEBA-01: todo criterio con TEST tiene clase asignada antes de verificado", () => {
  it("ningún criterio marcado verificado en la matriz tiene TEST sin clase", () => {
    // Hoy ningún criterio llega a "verificado" en la matriz generada (ese
    // estado lo mueve CI al ver pasar un test real, RUL-TRAZ-06/§7); esta
    // prueba deja el invariante escrito para cuando existan: AC-HECHO-03 lo
    // exige y este test es su comprobación nominal, con nombre propio.
    const matriz = generarMatriz();
    const infractores = matriz.filas.filter(
      (f) => f.estado === "verificado" && f.nivel_evidencia?.includes("TEST") && !f.clase_prueba
    );
    expect(infractores).toEqual([]);
  });
});

describe("AC-PRUEBA-10: la suite por defecto no necesita red, credenciales ni base de datos", () => {
  it("tests/rls/ (la única que sí las necesita) está excluida del proyecto por defecto", () => {
    const vitestConfig = readFileSync(join(process.cwd(), "vitest.config.ts"), "utf8");
    expect(vitestConfig).toContain("exclude");
    expect(vitestConfig).toContain("tests/rls/**");
  });

  it("ningún fichero *.test.ts fuera de tests/rls/ crea un cliente de Supabase con URL real (no localhost)", () => {
    const RAIZ = join(process.cwd(), "src");
    const infractores: string[] = [];
    const recorrer = (dir: string) => {
      for (const entrada of readdirSync(dir)) {
        const ruta = join(dir, entrada);
        if (statSync(ruta).isDirectory()) {
          recorrer(ruta);
        } else if (entrada.endsWith(".test.ts") || entrada.endsWith(".test.tsx")) {
          const contenido = readFileSync(ruta, "utf8");
          if (/createClient\(\s*["']https:\/\//.test(contenido)) infractores.push(ruta);
        }
      }
    };
    recorrer(RAIZ);
    expect(infractores).toEqual([]);
  });
});

describe("AC-PRUEBA-12: las pruebas de WhatsApp no bloquean ningún corte de la fase web", () => {
  it("ningún script de humo de WhatsApp está en el include de vitest.config.ts", () => {
    const vitestConfig = readFileSync(join(process.cwd(), "vitest.config.ts"), "utf8");
    expect(vitestConfig).not.toMatch(/scripts\/smoke-whatsapp/);
  });

  it("los tests unitarios de src/adapters/whatsapp/ no dependen de variables de entorno (no son de humo)", () => {
    const RAIZ = join(process.cwd(), "src", "adapters", "whatsapp");
    const ficheros = readdirSync(RAIZ).filter((f) => f.endsWith(".test.ts"));
    expect(ficheros.length).toBeGreaterThan(0);
    const conEnv = ficheros.filter((f) => /process\.env\./.test(readFileSync(join(RAIZ, f), "utf8")));
    expect(conEnv).toEqual([]);
  });
});
