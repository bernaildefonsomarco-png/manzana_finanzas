// RUL-CAT-05, AC-CAT-04/05 (`25` §6, tabla): normalizar antes de crear una
// subcategoria evita duplicados por grafia, sin asumir sinonimos.
import { describe, expect, it } from "vitest";
import { normalizeClassificationKey } from "./classification.repository";

describe("normalizeClassificationKey", () => {
  it.each([
    ["Café", "cafe"],
    ["cafe", "cafe"],
    ["CAFÉ", "cafe"],
    [" café ", "cafe"],
    ["Uber", "uber"],
    ["uber ", "uber"],
  ])("%s -> %s (reutiliza la existente)", (input, expected) => {
    expect(normalizeClassificationKey(input)).toBe(expected);
  });

  it("RUL-CAT-05: 'cafecito' no colapsa con 'cafe' — no se asumen sinonimos", () => {
    expect(normalizeClassificationKey("cafecito")).not.toBe(
      normalizeClassificationKey("cafe")
    );
    expect(normalizeClassificationKey("cafecito")).toBe("cafecito");
  });
});
