import { describe, expect, it } from "vitest";
import { readIdempotencyKey } from "./idempotency";

function requestWithHeader(value: string | null): Request {
  const headers = new Headers();
  if (value !== null) headers.set("idempotency-key", value);
  return new Request("https://manzana.app/api/v1/movements", { headers });
}

describe("readIdempotencyKey (AC-API-05)", () => {
  it("devuelve null si falta la cabecera", () => {
    expect(readIdempotencyKey(requestWithHeader(null))).toBeNull();
  });

  it("devuelve null si esta vacia o es solo espacios", () => {
    expect(readIdempotencyKey(requestWithHeader(""))).toBeNull();
    expect(readIdempotencyKey(requestWithHeader("   "))).toBeNull();
  });

  it("devuelve null si tiene menos de 8 caracteres", () => {
    expect(readIdempotencyKey(requestWithHeader("1234567"))).toBeNull();
  });

  it("acepta exactamente 8 caracteres", () => {
    expect(readIdempotencyKey(requestWithHeader("12345678"))).toBe("12345678");
  });

  it("recorta espacios alrededor de una clave valida", () => {
    expect(readIdempotencyKey(requestWithHeader("  clave-valida-123  "))).toBe(
      "clave-valida-123"
    );
  });

  it("devuelve null si supera 180 caracteres", () => {
    expect(readIdempotencyKey(requestWithHeader("a".repeat(181)))).toBeNull();
  });

  it("acepta exactamente 180 caracteres", () => {
    const key = "a".repeat(180);
    expect(readIdempotencyKey(requestWithHeader(key))).toBe(key);
  });
});
