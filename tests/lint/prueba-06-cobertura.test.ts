// `AC-PRUEBA-06` (`51` §9, `WEB-D157`): la cobertura se mide sobre todo
// `src/`, con el proveedor instalado, y el informe se genera. Evidencia:
// `CODE` + `TEST`. Clase: `lint` — se decide leyendo la configuración, no
// ejecutando la aplicación (ejecutar `vitest --coverage` de verdad, con
// informe HTML generado, se comprobó a mano al escribir este test).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("AC-PRUEBA-06: cobertura real sobre todo src/", () => {
  it("@vitest/coverage-v8 está instalado", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    expect(pkg.devDependencies?.["@vitest/coverage-v8"]).toBeTruthy();
  });

  it("vitest.config.ts incluye todo src/, no solo core y shared", () => {
    const config = readFileSync(join(process.cwd(), "vitest.config.ts"), "utf8");
    expect(config).toMatch(/coverage:\s*\{[\s\S]*include:\s*\[\s*["']src\/\*\*["']/);
    expect(config).not.toMatch(/include:\s*\[\s*["']src\/core\/\*\*["']/);
  });

  it("el reporte incluye html, no solo texto", () => {
    const config = readFileSync(join(process.cwd(), "vitest.config.ts"), "utf8");
    expect(config).toMatch(/reporter:\s*\[[^\]]*["']html["']/);
  });
});
