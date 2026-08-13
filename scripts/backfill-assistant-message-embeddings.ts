import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import {
  createMemoryEmbedding,
  readMemoryEmbeddingConfig,
  toVectorLiteral,
} from "@/agents/runtime/openai-embeddings";
import { readAssistantMessageText } from "@/data/repositories/assistant.repository";
import { hashAssistantMessageText } from "@/data/repositories/assistant-message-recall.repository";
import type { Database } from "@/data/supabase/types";

/**
 * Backfill de vectores para los hilos del asistente que ya existen (`077`).
 *
 * `077_assistant_message_semantic_recall.sql` agrega la columna vacia: hasta que
 * este script corra, ningun mensaje viejo es recuperable y los hilos largos
 * siguen comportandose como si nada anterior a los ultimos 20 turnos existiera.
 *
 * No es una migracion de datos destructiva —solo rellena un indice de
 * recuperacion— asi que se puede correr las veces que haga falta: salta lo que
 * ya tiene vector del mismo modelo y del mismo texto.
 *
 * Uso:
 *   npm run asistente:backfill-embeddings -- --dry-run
 *   npm run asistente:backfill-embeddings
 *   npm run asistente:backfill-embeddings -- --user <uuid> --limit 200
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
    `[asistente] backfill de hilos con ${embeddingConfig.modelName}` +
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

      const text = readAssistantMessageText(row.content);
      const hash = hashAssistantMessageText(text);
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
        console.warn(`[asistente] sin vector para ${row.id}`);
        continue;
      }

      const { error } = await admin
        .from("assistant_messages")
        .update({
          embedding: toVectorLiteral(embedding.vector),
          embedding_model: embedding.model,
          embedding_input_hash: hash,
          embedding_generated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (error) {
        failed += 1;
        console.warn(
          `[asistente] no se pudo escribir ${row.id}: ${error.message}`,
        );
        continue;
      }
      written += 1;
      await pause(PAUSE_BETWEEN_ITEMS_MS);
    }

    if (page.length < PAGE_SIZE) break;
  }

  console.log(
    `[asistente] revisados=${processed} escritos=${written} ` +
      `saltados=${skipped} fallidos=${failed}`,
  );
  if (failed > 0) {
    console.log(
      "[asistente] los fallidos siguen sin ser recuperables: vuelve a correr el script.",
    );
  }
  process.exit(failed > 0 && written === 0 ? 1 : 0);
}

type BackfillRow = {
  id: string;
  content: unknown;
  embedding: string | null;
  embedding_model: string | null;
  embedding_input_hash: string | null;
};

/**
 * Pagina por `id` y no por `offset`: los hilos siguen recibiendo mensajes
 * mientras esto corre y un `offset` se saltaria filas.
 *
 * Solo `usuario` y `asistente`: un mensaje de `sistema` no es conversacion de
 * nadie y la funcion de recuperacion tampoco lo mira.
 */
async function readPage(cursor: string | null): Promise<BackfillRow[]> {
  let query = admin
    .from("assistant_messages")
    .select("id,content,embedding,embedding_model,embedding_input_hash")
    .in("role", ["usuario", "asistente"])
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
  if (!value) throw new Error(`Falta ${name} para el backfill del asistente.`);
  return value;
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
