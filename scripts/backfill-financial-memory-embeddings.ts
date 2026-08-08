import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import {
  createMemoryEmbedding,
  readMemoryEmbeddingConfig,
  toVectorLiteral,
} from "@/agents/runtime/openai-embeddings";
import {
  buildEmbeddingInput,
  hashEmbeddingInput,
} from "@/data/repositories/financial-memory.repository";
import type { Database } from "@/data/supabase/types";

/**
 * Backfill de vectores para la memoria confirmada ya existente (`RUL-MEM-15`).
 *
 * `070_financial_memory_semantic_recall.sql` agrega la columna vacia: hasta que
 * este script corra, todos los recuerdos viejos siguen recuperandose por tokens.
 * No es una migracion de datos destructiva —solo rellena un indice de
 * recuperacion— asi que se puede correr las veces que haga falta: salta lo que
 * ya tiene vector del mismo modelo y del mismo texto.
 *
 * Uso:
 *   npm run memoria:backfill-embeddings -- --dry-run
 *   npm run memoria:backfill-embeddings
 *   npm run memoria:backfill-embeddings -- --user <uuid> --limit 50
 */

loadEnvConfig(process.cwd());

const PAGE_SIZE = 100;
/** Ritmo cortes con la API de embeddings; no es un limite de correctitud. */
const PAUSE_BETWEEN_ITEMS_MS = 60;

const options = readOptions(process.argv.slice(2));
const embeddingConfig = readMemoryEmbeddingConfig();
const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

if (!embeddingConfig.apiKey) {
  throw new Error(
    "Falta OPENAI_API_KEY: sin clave no hay embeddings que calcular.",
  );
}

const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

void main();

async function main(): Promise<void> {
  console.log(
    `[memoria] backfill con ${embeddingConfig.modelName}` +
      (options.dryRun ? " (dry-run: no escribe)" : ""),
  );

  let processed = 0;
  let written = 0;
  let skipped = 0;
  let failed = 0;
  let cursor: string | null = null;

  while (options.limit === null || processed < options.limit) {
    const page = await readPage(cursor);
    if (page.length === 0) break;

    for (const row of page) {
      cursor = row.id;
      if (options.limit !== null && processed >= options.limit) break;
      processed += 1;

      const text = buildEmbeddingInput(row);
      const hash = hashEmbeddingInput(text);
      if (
        !text ||
        (row.embedding !== null &&
          row.embedding_input_hash === hash &&
          row.embedding_model === embeddingConfig.modelName)
      ) {
        skipped += 1;
        continue;
      }

      if (options.dryRun) {
        written += 1;
        continue;
      }

      const embedding = await createMemoryEmbedding(text, {
        config: embeddingConfig,
      });
      if (!embedding) {
        failed += 1;
        console.warn(`[memoria] sin vector para ${row.id}`);
        continue;
      }

      const { error } = await admin
        .from("financial_memory_items")
        .update({
          embedding: toVectorLiteral(embedding.vector),
          embedding_model: embedding.model,
          embedding_input_hash: hash,
          embedding_generated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (error) {
        failed += 1;
        console.warn(`[memoria] no se pudo escribir ${row.id}: ${error.message}`);
        continue;
      }
      written += 1;
      await pause(PAUSE_BETWEEN_ITEMS_MS);
    }

    if (page.length < PAGE_SIZE) break;
  }

  console.log(
    `[memoria] revisados=${processed} escritos=${written} ` +
      `saltados=${skipped} fallidos=${failed}`,
  );
  if (failed > 0) {
    console.log(
      "[memoria] los fallidos siguen recuperandose por tokens: vuelve a correr el script.",
    );
  }
  process.exit(failed > 0 && written === 0 ? 1 : 0);
}

type BackfillRow = {
  id: string;
  summary: string;
  canonical_key: string;
  search_terms: string[];
  embedding: string | null;
  embedding_model: string | null;
  embedding_input_hash: string | null;
};

/**
 * Pagina por `id` y no por `offset`: la tabla puede recibir recuerdos nuevos
 * mientras esto corre y un `offset` se saltaria filas.
 */
async function readPage(cursor: string | null): Promise<BackfillRow[]> {
  let query = admin
    .from("financial_memory_items")
    .select(
      "id,summary,canonical_key,search_terms,embedding,embedding_model,embedding_input_hash",
    )
    .eq("confirmation_status", "confirmed")
    .in("lifecycle_status", ["confirmed", "suspended"])
    .order("id", { ascending: true })
    .limit(PAGE_SIZE);

  if (options.userId) query = query.eq("user_id", options.userId);
  if (cursor) query = query.gt("id", cursor);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

function readOptions(argv: string[]): {
  dryRun: boolean;
  userId: string | null;
  limit: number | null;
} {
  const limitValue = readFlagValue(argv, "--limit");
  return {
    dryRun: argv.includes("--dry-run"),
    userId: readFlagValue(argv, "--user"),
    limit: limitValue ? Number(limitValue) : null,
  };
}

function readFlagValue(argv: string[], flag: string): string | null {
  const index = argv.indexOf(flag);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : null;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name} para el backfill de memoria.`);
  return value;
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
