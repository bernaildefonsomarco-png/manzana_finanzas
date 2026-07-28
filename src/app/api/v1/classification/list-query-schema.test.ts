// `AC-API-04`: `categories`, `subcategories` y `tags` comparten
// `ListClassificationQuerySchema` (`14` §10, `paginateInMemory`).
import { describe, expect, it } from "vitest";
import { ListClassificationQuerySchema } from "./schemas";

describe("ListClassificationQuerySchema", () => {
  it("acepta ausencia de parametros", () => {
    expect(ListClassificationQuerySchema.safeParse({}).success).toBe(true);
  });

  it("acepta limit y cursor", () => {
    expect(
      ListClassificationQuerySchema.safeParse({ limit: "10", cursor: "abc" }).success
    ).toBe(true);
  });

  it("AC-API-04: un filtro desconocido no se ignora, falla la validacion", () => {
    const result = ListClassificationQuerySchema.safeParse({ filtro_inventado: "x" });
    expect(result.success).toBe(false);
  });
});
