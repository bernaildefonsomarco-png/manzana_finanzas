// `AC-PRUEBA-08` (`51` §7, §13): los seis tests que fallan el build —no la
// suite— tienen mecanismo real, no solo declarado. Cuatro corren en
// `prebuild` (`npm run build` los ejecuta antes de compilar); `AC-RT-01` y
// `AC-REU-06` corren al arrancar el servidor (`src/instrumentation.ts`),
// que es un momento distinto y no le corresponde a `prebuild`. Cada uno se
// verificó a mano introduciendo su violación (ver el ledger `55`, entradas
// `W-02` y `W-03`); esta prueba comprueba que el enganche sigue existiendo,
// no repite las seis violaciones.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const GATES_DE_PREBUILD = [
  "scripts/gates/service-role-en-rutas.ts", // AC-SEG-01
  "scripts/gates/mapa-de-rutas.ts", // AC-TRAZ-05
  "scripts/gates/sin-tests-en-skip.ts", // AC-TRAZ-08
  "scripts/gates/sin-regresion-de-alcance.ts", // AC-TRAZ-09
];

describe("AC-PRUEBA-08: los seis gates de 51 §7 tienen mecanismo real", () => {
  it("prebuild invoca los cuatro que corren en tiempo de build", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    const prebuild: string = pkg.scripts.prebuild;
    for (const gate of GATES_DE_PREBUILD) {
      expect(prebuild, `falta ${gate} en prebuild`).toContain(gate);
    }
  });

  it("AC-RT-01 y AC-REU-06 tienen su gate en instrumentation-check.ts, no en prebuild", () => {
    expect(existsSync(join(process.cwd(), "src", "instrumentation.ts"))).toBe(true);
    expect(existsSync(join(process.cwd(), "src", "instrumentation.node.ts"))).toBe(true);
    const contenido = readFileSync(join(process.cwd(), "src", "instrumentation-check.ts"), "utf8");
    expect(contenido).toContain("AC-RT-01");
    expect(contenido).toContain("AC-REU-06");
  });
});
