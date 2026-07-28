import { describe, expect, it } from "vitest";
import { isWriteMethod, usesBearerAuth, verifyOrigin } from "./csrf";

const APP_ORIGIN = "https://manzana.app";

function requestWith(input: {
  method?: string;
  origin?: string;
  referer?: string;
  authorization?: string;
}): Request {
  const headers = new Headers();
  if (input.origin) headers.set("origin", input.origin);
  if (input.referer) headers.set("referer", input.referer);
  if (input.authorization) headers.set("authorization", input.authorization);
  return new Request("https://manzana.app/api/v1/movements", {
    method: input.method ?? "POST",
    headers,
  });
}

describe("isWriteMethod", () => {
  it("GET y HEAD no son escritura", () => {
    expect(isWriteMethod("GET")).toBe(false);
    expect(isWriteMethod("HEAD")).toBe(false);
  });

  it("POST/PUT/PATCH/DELETE son escritura", () => {
    expect(isWriteMethod("POST")).toBe(true);
    expect(isWriteMethod("PUT")).toBe(true);
    expect(isWriteMethod("PATCH")).toBe(true);
    expect(isWriteMethod("DELETE")).toBe(true);
  });
});

describe("usesBearerAuth", () => {
  it("detecta Authorization: Bearer sin importar mayusculas", () => {
    expect(usesBearerAuth(requestWith({ authorization: "Bearer abc123" }))).toBe(true);
    expect(usesBearerAuth(requestWith({ authorization: "bearer abc123" }))).toBe(true);
  });

  it("no detecta bearer si falta la cabecera", () => {
    expect(usesBearerAuth(requestWith({}))).toBe(false);
  });
});

describe("verifyOrigin (AC-API-07)", () => {
  it("las lecturas nunca se verifican", () => {
    expect(
      verifyOrigin(requestWith({ method: "GET", origin: "https://evil.com" }), APP_ORIGIN)
    ).toBe(true);
  });

  it("Bearer nunca se verifica, aunque el origen sea otro", () => {
    expect(
      verifyOrigin(
        requestWith({ origin: "https://evil.com", authorization: "Bearer x" }),
        APP_ORIGIN
      )
    ).toBe(true);
  });

  it("escritura por cookie con Origin propio se acepta", () => {
    expect(verifyOrigin(requestWith({ origin: APP_ORIGIN }), APP_ORIGIN)).toBe(true);
  });

  it("escritura por cookie desde otro origen se rechaza (el caso central de AC-API-07)", () => {
    expect(verifyOrigin(requestWith({ origin: "https://evil.com" }), APP_ORIGIN)).toBe(
      false
    );
  });

  it("sin Origin, cae a Referer", () => {
    expect(
      verifyOrigin(requestWith({ referer: `${APP_ORIGIN}/movimientos` }), APP_ORIGIN)
    ).toBe(true);
    expect(
      verifyOrigin(requestWith({ referer: "https://evil.com/x" }), APP_ORIGIN)
    ).toBe(false);
  });

  it("sin Origin ni Referer, se rechaza por defecto", () => {
    expect(verifyOrigin(requestWith({}), APP_ORIGIN)).toBe(false);
  });

  it("si no se puede determinar el origen propio, se falla cerrado", () => {
    expect(verifyOrigin(requestWith({ origin: APP_ORIGIN }), null)).toBe(false);
  });
});
