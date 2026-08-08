import { describe, expect, it, vi } from "vitest";
import {
  createMemoryEmbedding,
  MEMORY_EMBEDDING_DIMENSIONS,
  readMemoryEmbeddingConfig,
  toVectorLiteral,
} from "./openai-embeddings";

/**
 * El contrato de este cliente es no lanzar nunca. Un embedding es un indice de
 * recuperacion (`RUL-MEM-15`), no un hecho del turno: cuando falla, la memoria
 * se busca por tokens y la conversacion sigue.
 */

const CONFIG = {
  enabled: true,
  apiKey: "sk-test",
  modelName: "text-embedding-3-small",
  endpoint: "https://api.openai.com/v1/embeddings",
  timeoutMs: 1_000,
};

function vector(value = 0.02): number[] {
  return Array.from({ length: MEMORY_EMBEDDING_DIMENSIONS }, () => value);
}

function respondWith(body: unknown, ok = true) {
  return vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
    void init;
    return {
      ok,
      status: ok ? 200 : 500,
      json: async () => body,
    } as unknown as Response;
  });
}

describe("createMemoryEmbedding", () => {
  it("pide la dimensión exacta que espera la columna vector(1536)", async () => {
    const fetcher = respondWith({ data: [{ embedding: vector() }] });

    const result = await createMemoryEmbedding("respuestas cortas", {
      config: CONFIG,
      fetcher,
    });

    expect(result?.vector).toHaveLength(MEMORY_EMBEDDING_DIMENSIONS);
    expect(result?.model).toBe("text-embedding-3-small");
    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(body.dimensions).toBe(MEMORY_EMBEDDING_DIMENSIONS);
    expect(body.model).toBe("text-embedding-3-small");
  });

  it("devuelve null sin clave, en vez de lanzar", async () => {
    const fetcher = respondWith({ data: [{ embedding: vector() }] });

    const result = await createMemoryEmbedding("hola", {
      config: { ...CONFIG, apiKey: null },
      fetcher,
    });

    expect(result).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("devuelve null cuando está apagado por configuración", async () => {
    const fetcher = respondWith({ data: [{ embedding: vector() }] });

    const result = await createMemoryEmbedding("hola", {
      config: { ...CONFIG, enabled: false },
      fetcher,
    });

    expect(result).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("devuelve null cuando el proveedor responde error", async () => {
    const result = await createMemoryEmbedding("hola", {
      config: CONFIG,
      fetcher: respondWith({ error: { message: "rate limit" } }, false),
    });

    expect(result).toBeNull();
  });

  it("devuelve null cuando el fetch revienta", async () => {
    const result = await createMemoryEmbedding("hola", {
      config: CONFIG,
      fetcher: vi.fn(async () => {
        throw new Error("ECONNRESET");
      }),
    });

    expect(result).toBeNull();
  });

  it("rechaza una dimensión distinta a la de la columna", async () => {
    const result = await createMemoryEmbedding("hola", {
      config: CONFIG,
      fetcher: respondWith({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
    });

    expect(result).toBeNull();
  });

  it("no llama al proveedor con texto vacío", async () => {
    const fetcher = respondWith({ data: [{ embedding: vector() }] });

    expect(
      await createMemoryEmbedding("   ", { config: CONFIG, fetcher }),
    ).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("readMemoryEmbeddingConfig", () => {
  it("tiene un modelo por defecto y acepta el override por entorno", () => {
    expect(readMemoryEmbeddingConfig({ OPENAI_API_KEY: "sk" }).modelName).toBe(
      "text-embedding-3-small",
    );
    expect(
      readMemoryEmbeddingConfig({
        OPENAI_API_KEY: "sk",
        MEMORY_EMBEDDING_MODEL: "text-embedding-3-large",
      }).modelName,
    ).toBe("text-embedding-3-large");
  });

  it("MEMORY_EMBEDDING_ENABLED=false es un interruptor de apagado", () => {
    expect(
      readMemoryEmbeddingConfig({
        OPENAI_API_KEY: "sk",
        MEMORY_EMBEDDING_ENABLED: "false",
      }).enabled,
    ).toBe(false);
  });
});

describe("toVectorLiteral", () => {
  it("usa la representación que entiende pgvector por PostgREST", () => {
    expect(toVectorLiteral([1, 0.5, -0.25])).toBe("[1,0.5,-0.25]");
  });
});
