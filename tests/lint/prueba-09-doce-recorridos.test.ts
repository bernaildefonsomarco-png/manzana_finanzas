// `AC-PRUEBA-09` (`51` §6.3, `WEB-D154`): el conjunto E2E son los ocho
// recorridos de primer valor de `44` §5 más los cuatro flujos
// irreversibles — doce en total, ni uno más ni uno menos. Hoy existen
// declarados (`test.fixme`, Playwright instalado y corriendo sin
// advertencias) pero vacíos: los llenan los cortes de módulo que crean las
// rutas que necesitan (`W-08` en adelante). `AC-PRUEBA-09` no cierra en
// `W-03` —los doce no "pasan" todavía, están declarados— pero el arnés que
// exige sí existe.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("AC-PRUEBA-09 (arnés, W-03): los doce recorridos E2E están declarados", () => {
  it("ocho recorridos de primer valor en tests/e2e/recorridos/", () => {
    const ficheros = readdirSync(join(process.cwd(), "tests", "e2e", "recorridos")).filter((f) =>
      f.endsWith(".spec.ts")
    );
    expect(ficheros.length).toBe(8);
  });

  it("cuatro flujos irreversibles en tests/e2e/irreversibles/", () => {
    const ficheros = readdirSync(join(process.cwd(), "tests", "e2e", "irreversibles")).filter((f) =>
      f.endsWith(".spec.ts")
    );
    expect(ficheros.length).toBe(4);
  });

  it("playwright.config.ts existe y apunta a tests/e2e", () => {
    const config = readFileSync(join(process.cwd(), "playwright.config.ts"), "utf8");
    expect(config).toContain("./tests/e2e");
  });
});
