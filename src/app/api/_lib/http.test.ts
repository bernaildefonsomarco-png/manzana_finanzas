import { afterEach, describe, expect, it } from "vitest";
import { z, ZodError } from "zod";
import { CoreError } from "@/core/finance/errors";
import {
  coreError,
  errorJson,
  getTraceId,
  okJson,
  unexpectedError,
  validationError,
} from "./http";

const META = { trace_id: "0f9c1e2a-1111-4111-8111-000000000000" };

describe("getTraceId", () => {
  it("usa x-trace-id si es un uuid valido", () => {
    const uuid = "0f9c1e2a-2222-4222-8222-000000000000";
    const request = new Request("https://manzana.app/api/v1/movements", {
      headers: { "x-trace-id": uuid },
    });
    expect(getTraceId(request)).toBe(uuid);
  });

  it("genera uno nuevo si falta o es invalido", () => {
    const request = new Request("https://manzana.app/api/v1/movements", {
      headers: { "x-trace-id": "no-es-un-uuid" },
    });
    expect(getTraceId(request)).not.toBe("no-es-un-uuid");
    expect(getTraceId(request)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });
});

describe("okJson / errorJson: forma del envelope (14 S3)", () => {
  it("exito trae ok:true, data y meta", async () => {
    const response = okJson({ foo: "bar" }, META);
    const body = await response.json();
    expect(body).toEqual({ ok: true, data: { foo: "bar" }, meta: META });
  });

  it("error trae ok:false y error.code/message/details", async () => {
    const response = errorJson("NOT_FOUND", "No encontrado.", META, 404, { x: 1 });
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: "No encontrado.", details: { x: 1 } },
      meta: META,
    });
  });
});

describe("validationError", () => {
  it("convierte un ZodError en VALIDATION_ERROR 400 con issues", async () => {
    let zodError: ZodError;
    try {
      z.object({ amount: z.number() }).parse({});
      throw new Error("no deberia llegar aqui");
    } catch (error) {
      zodError = error as ZodError;
    }
    const response = validationError(zodError, META);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(body.error.details.issues)).toBe(true);
  });
});

describe("coreError", () => {
  it("mapea codigos *_NOT_FOUND a 404/NOT_FOUND", async () => {
    const response = coreError(new CoreError("MOVEMENT_NOT_FOUND", "No existe."), META);
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("mapea codigos de conflicto a 409/CONFLICT", async () => {
    const response = coreError(
      new CoreError("MOVEMENT_ALREADY_INACTIVE", "Ya esta inactivo."),
      META
    );
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("CONFLICT");
  });

  it("cualquier otro codigo cae en 422/CORE_REJECTED", async () => {
    const response = coreError(
      new CoreError("DEBT_CREATION_INVALID_AMOUNT", "Monto invalido."),
      META
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("CORE_REJECTED");
  });
});

describe("unexpectedError (AC-API-08: nunca expone detalles internos en produccion)", () => {
  const originalEnv = process.env.APP_ENV;

  afterEach(() => {
    process.env.APP_ENV = originalEnv;
  });

  it("en local, muestra el mensaje real del error (para depurar)", async () => {
    process.env.APP_ENV = "local";
    const response = unexpectedError(
      new Error("SELECT * FROM movements WHERE fallo de sintaxis"),
      META
    );
    const body = await response.json();
    expect(body.error.message).toContain("fallo de sintaxis");
  });

  it("fuera de local (staging/production), nunca expone el mensaje real", async () => {
    process.env.APP_ENV = "production";
    const response = unexpectedError(
      new Error("SELECT * FROM movements WHERE fallo de sintaxis"),
      META
    );
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).not.toContain("SELECT");
    expect(body.error.message).not.toContain("fallo de sintaxis");
    expect(body.error.message).toBe("Ocurrio un error inesperado.");
  });

  it("sin APP_ENV configurado (indefinido), tambien oculta el detalle (fail-safe)", async () => {
    delete process.env.APP_ENV;
    const response = unexpectedError(new Error("detalle sensible"), META);
    const body = await response.json();
    expect(body.error.message).not.toContain("detalle sensible");
  });
});
