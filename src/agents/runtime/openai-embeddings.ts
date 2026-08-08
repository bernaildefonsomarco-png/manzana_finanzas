import { logger } from "@/shared/telemetry/logger";

/**
 * Cliente de embeddings de OpenAI.
 *
 * Sigue el mismo patron que `openai-agent-runtime.ts`: `fetch` a mano, sin SDK
 * nuevo, con la clave y el modelo inyectables para poder probarlo. La
 * diferencia de contrato es deliberada: el runtime de agentes **lanza** cuando
 * no puede trabajar, y este devuelve `null`. Un embedding es un indice de
 * recuperacion, no un hecho del turno: si falla, la memoria tiene que seguir
 * buscandose por tokens (`RUL-MEM-15`), nunca romper la conversacion.
 */

type Fetcher = typeof fetch;

const DEFAULT_ENDPOINT = "https://api.openai.com/v1/embeddings";

/**
 * `text-embedding-3-small` a su dimension nativa. Es el modelo actual de
 * OpenAI con mejor relacion calidad/costo para textos cortos y multilingues
 * (los recuerdos son frases en español de menos de 500 caracteres), y 1536
 * entra sobrado en el limite de 2000 dimensiones de los indices de pgvector.
 */
export const DEFAULT_MEMORY_EMBEDDING_MODEL = "text-embedding-3-small";

/** Contrato fijo con `vector(1536)` de `070_financial_memory_semantic_recall.sql`. */
export const MEMORY_EMBEDDING_DIMENSIONS = 1536;

/** Un embedding no puede costarle a nadie el turno: se corta antes que tarde. */
const DEFAULT_TIMEOUT_MS = 5_000;

/** El endpoint acepta mucho mas, pero un recuerdo largo ya es un recuerdo mal escrito. */
const MAX_INPUT_CHARS = 4_000;

export type MemoryEmbeddingConfig = {
  enabled: boolean;
  apiKey: string | null;
  modelName: string;
  endpoint: string;
  timeoutMs: number;
};

export type MemoryEmbedding = {
  vector: number[];
  model: string;
};

export function readMemoryEmbeddingConfig(
  env: Record<string, string | undefined> = process.env,
): MemoryEmbeddingConfig {
  return {
    enabled: readBoolean(env.MEMORY_EMBEDDING_ENABLED, true),
    apiKey:
      readString(env.OPENAI_API_KEY) ??
      readString(env.AGENT_RUNTIME_API_TOKEN),
    modelName:
      readString(env.MEMORY_EMBEDDING_MODEL) ?? DEFAULT_MEMORY_EMBEDDING_MODEL,
    endpoint: readString(env.MEMORY_EMBEDDING_URL) ?? DEFAULT_ENDPOINT,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
}

/**
 * Devuelve el vector del texto, o `null` si por cualquier motivo no se pudo
 * calcular: sin clave, apagado por configuracion, HTTP caido, timeout,
 * respuesta malformada o dimension distinta a la que espera la columna.
 * Ningun caso lanza.
 */
export async function createMemoryEmbedding(
  text: string,
  input: {
    config?: MemoryEmbeddingConfig;
    fetcher?: Fetcher;
  } = {},
): Promise<MemoryEmbedding | null> {
  const config = input.config ?? readMemoryEmbeddingConfig();
  const clean = text.trim().slice(0, MAX_INPUT_CHARS);
  if (!config.enabled || !config.apiKey || !clean) return null;

  const fetcher = input.fetcher ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetcher(config.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.modelName,
        input: clean,
        // Explicito y no por defecto: fija el contrato con `vector(1536)` aunque
        // alguien apunte `MEMORY_EMBEDDING_MODEL` a un modelo de otra dimension.
        dimensions: MEMORY_EMBEDDING_DIMENSIONS,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.warn("memory_embedding.http_error", {
        status: response.status,
        model: config.modelName,
      });
      return null;
    }

    const vector = readEmbeddingVector(await response.json());
    if (!vector) {
      logger.warn("memory_embedding.invalid_response", {
        model: config.modelName,
      });
      return null;
    }
    return { vector, model: config.modelName };
  } catch (error) {
    logger.warn("memory_embedding.request_failed", {
      error,
      model: config.modelName,
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Representacion textual que entiende pgvector por PostgREST: `[a,b,c]`.
 * Se envia como texto porque el driver no tiene tipo vector propio.
 */
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

function readEmbeddingVector(body: unknown): number[] | null {
  if (!body || typeof body !== "object") return null;
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data) || data.length === 0) return null;
  const first = data[0];
  if (!first || typeof first !== "object") return null;
  const embedding = (first as { embedding?: unknown }).embedding;
  if (!Array.isArray(embedding)) return null;
  if (embedding.length !== MEMORY_EMBEDDING_DIMENSIONS) return null;
  return embedding.every((value) => typeof value === "number" && Number.isFinite(value))
    ? (embedding as number[])
    : null;
}

function readString(value: string | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  return defaultValue;
}
