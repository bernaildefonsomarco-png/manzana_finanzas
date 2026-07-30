import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const surfaceDirectory = join(
  process.cwd(),
  "src",
  "features",
  "budgets"
);
const surface = readdirSync(surfaceDirectory)
  .filter((file) => file.endsWith(".tsx") && !file.includes(".test."))
  .sort()
  .map((file) => readFileSync(join(surfaceDirectory, file), "utf8"))
  .join("\n");

describe("superficie visible de Presupuestos W-12", () => {
  it("AC-PRES-06 no usa el léxico de fracaso prohibido", () => {
    const prohibited =
      /\b(fallaste|incumpliste|deberías|mal|fuera de control|alerta)\b/iu;

    expect(surface).not.toMatch(prohibited);
  });

  it("AC-PRES-13 no recomienda recortar o reducir gastos", () => {
    const reductionAdvice =
      /\b(?:te conviene|recomendamos?)\b[^.\n]{0,80}\b(?:gastar|reducir|recortar)\b|\b(?:reduce|recorta|gasta menos)\s+(?:tus?\s+)?gastos?\b/iu;

    expect(surface).not.toMatch(reductionAdvice);
  });

  it("AC-PRES-17 no compara con usuarios ni promedios externos", () => {
    const externalComparison =
      /\b(otros usuarios|otras personas|promedios? (?:del? )?mercado|lo que gasta la gente)\b/iu;

    expect(surface).not.toMatch(externalComparison);
  });
});
