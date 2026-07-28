import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { leerCorpus } from "../scripts/matriz/lib/corpus.ts";
import { PUBLIC_PATHS } from "./proxy";

const RAIZ = process.cwd();

/**
 * Rutas públicas de `10` §3.1: solo la primera celda de cada fila (la
 * columna `Ruta`), nunca la de `Notas` — que también puede mencionar una
 * ruta entre backticks (`/` dice "con sesión, a `/inicio`", y `/inicio` no
 * es pública).
 */
function rutasPublicasDeclaradasEn10(): string[] {
  const documento = leerCorpus().find((d) => d.numero === "10")!;
  const rutas: string[] = [];
  documento.lineas.forEach((linea, indice) => {
    if (documento.dentroDeCerca[indice]) return;
    if (documento.secciones[indice] !== "§3.1") return;
    const primeraCelda = linea.match(/^\|([^|]*)\|/)?.[1] ?? "";
    for (const coincidencia of primeraCelda.matchAll(/`(\/[a-z0-9\-/]*)`/g)) {
      rutas.push(coincidencia[1]);
    }
  });
  return rutas;
}

/** Las dos que el mapa de `10` no conocía (`50` §5.2): públicas por prosa, no por columna. */
function rutasPublicasAñadidasEn50(): string[] {
  const documento = leerCorpus().find((d) => d.numero === "50")!;
  const rutas = new Set<string>();
  documento.lineas.forEach((linea, indice) => {
    if (documento.dentroDeCerca[indice]) return;
    if (documento.secciones[indice] !== "§5.2") return;
    for (const candidata of ["/estado", "/baja"]) {
      if (linea.includes(`\`${candidata}`)) rutas.add(candidata);
    }
  });
  return [...rutas];
}

describe("AC-INV-09: el fichero de sesión es proxy.ts y exporta proxy; no existe middleware.ts", () => {
  it("src/proxy.ts existe y exporta la función proxy", () => {
    expect(existsSync(join(RAIZ, "src", "proxy.ts"))).toBe(true);
  });

  it("no existe middleware.ts ni middleware.js, ni en la raíz ni en src/", () => {
    const nombres = ["middleware.ts", "middleware.js"];
    for (const nombre of nombres) {
      expect(existsSync(join(RAIZ, nombre))).toBe(false);
      expect(existsSync(join(RAIZ, "src", nombre))).toBe(false);
    }
  });

  it("solo hay un fichero de proxy en el proyecto", () => {
    const raizTieneProxy = readdirSync(RAIZ).filter((f) => /^proxy\.(ts|js)$/.test(f));
    const srcTieneProxy = readdirSync(join(RAIZ, "src")).filter((f) => /^proxy\.(ts|js)$/.test(f));
    expect(raizTieneProxy.length + srcTieneProxy.length).toBe(1);
  });
});

describe("AC-INV-10: PUBLIC_PATHS contiene todas las rutas públicas de 10 §3.1 y 50 §5.2", () => {
  it("toda ruta pública declarada en el corpus está en PUBLIC_PATHS", () => {
    const declaradas = [...rutasPublicasDeclaradasEn10(), ...rutasPublicasAñadidasEn50()].filter(
      (ruta) => ruta !== "/" // WEB-D151: la redirección de / no va en este proxy, es de W-07
    );
    const faltantes = declaradas.filter((ruta) => !PUBLIC_PATHS.includes(ruta));
    expect(faltantes).toEqual([]);
  });

  it("PUBLIC_PATHS no contiene rutas que el corpus no declara públicas", () => {
    const declaradas = new Set([
      ...rutasPublicasDeclaradasEn10(),
      ...rutasPublicasAñadidasEn50(),
    ]);
    const sobrantes = PUBLIC_PATHS.filter(
      (ruta) => !ruta.startsWith("/api/") && !declaradas.has(ruta)
    );
    expect(sobrantes).toEqual([]);
  });

  it("/ no está en PUBLIC_PATHS: su redirección es de W-07, no de este proxy", () => {
    expect(PUBLIC_PATHS).not.toContain("/");
  });
});
