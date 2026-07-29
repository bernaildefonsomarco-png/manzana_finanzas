// AC-CAT-03 (`25` §6 RUL-CAT-01, §14.4): las 12 categorías base no se
// pueden crear, editar ni eliminar desde ninguna vía, incluido el
// asistente. Se verifica por ausencia estructural: ninguna ruta ni comando
// las muta, no solo que hoy nadie lo haga.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("AC-CAT-03: las 12 categorías canónicas son inmutables", () => {
  it("GET /api/v1/categories no exporta POST/PATCH/PUT/DELETE", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "app", "api", "v1", "categories", "route.ts"),
      "utf8"
    );

    expect(source).toMatch(/export\s+async\s+function\s+GET/);
    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
      expect(source).not.toMatch(new RegExp(`export\\s+async\\s+function\\s+${method}\\b`));
    }
  });

  it("no existe src/app/api/v1/categories/[id] (ninguna ruta de detalle que editar/eliminar)", () => {
    const detailRoute = join(process.cwd(), "src", "app", "api", "v1", "categories", "[id]");
    expect(existsSync(detailRoute)).toBe(false);
  });

  it("ningún comando de clasificación crea, edita o archiva una categoría", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "core", "classification", "commands.ts"),
      "utf8"
    );
    const commandTypes = [...source.matchAll(/z\.literal\("([A-Za-z]+Command)"\)/g)].map(
      (match) => match[1]
    );

    expect(commandTypes.length).toBeGreaterThan(0);
    for (const type of commandTypes) {
      // Coincide con "CategoryCommand" pero no con "...SubcategoryCommand".
      expect(type).not.toMatch(/(?<!Sub)CategoryCommand$/);
    }
  });
});
