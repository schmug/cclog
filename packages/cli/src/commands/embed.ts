import { Command } from "commander";
import { openDatabase } from "../db/connection.js";
import { loadConfig } from "../config.js";
import { createProvider } from "../providers/factory.js";

interface SessionForEmbed {
  id: string;
  first_prompt: string;
  summary: string;
}

export const embedCommand = new Command("embed")
  .description("Generate and store embeddings for sessions that don't have them yet")
  .option("--db <path>", "path to SQLite database", "./timetravel.db")
  .option("--provider <name>", "LLM provider to use (e.g. ollama)")
  .option("--model <name>", "embedding model to use")
  .option("--batch-size <n>", "number of sessions to process per batch", "5")
  .action(async (options) => {
    const config = loadConfig();

    if (options.provider) {
      config.llm.provider = options.provider;
    }
    if (options.model) {
      config.llm.embeddingModel = options.model;
    }

    const provider = createProvider(config.llm);

    const available = await provider.isAvailable();
    if (!available) {
      console.error(
        `Error: LLM provider "${provider.name}" is not available. ` +
          `Check that the service is running at ${config.llm.ollamaUrl}`
      );
      process.exit(1);
    }

    const db = openDatabase(options.db);
    const batchSize = parseInt(options.batchSize, 10);

    try {
      const sessions = db
        .prepare(
          `SELECT s.id, s.first_prompt, s.summary
           FROM sessions s
           LEFT JOIN embeddings e
             ON e.session_id = s.id AND e.chunk_type = 'session_summary'
           WHERE e.id IS NULL`
        )
        .all() as SessionForEmbed[];

      if (sessions.length === 0) {
        console.log("All sessions already have embeddings.");
        return;
      }

      console.log(`Found ${sessions.length} sessions without embeddings.`);

      const insertEmbedding = db.prepare(
        `INSERT INTO embeddings (session_id, text_chunk, embedding, chunk_type)
         VALUES (?, ?, ?, 'session_summary')`
      );

      let processed = 0;
      for (let i = 0; i < sessions.length; i += batchSize) {
        const batch = sessions.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (session) => {
            const text =
              session.summary?.trim() || session.first_prompt?.trim() || "(no content)";
            try {
              const vector = await provider.generateEmbedding(text);
              const buffer = Buffer.from(new Float32Array(vector).buffer);
              insertEmbedding.run(session.id, text, buffer);
              processed++;
            } catch (err) {
              console.error(`  Failed for session ${session.id}: ${(err as Error).message}`);
            }
          })
        );
        console.log(
          `Progress: ${Math.min(i + batchSize, sessions.length)}/${sessions.length} sessions processed`
        );
      }

      console.log(`Done. ${processed} embeddings stored.`);
    } finally {
      db.close();
    }
  });
