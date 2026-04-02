import { Command } from "commander";
import { openDatabase } from "../db/connection.js";
import { loadConfig } from "../config.js";
import { createProvider } from "../providers/factory.js";

interface SessionForSummary {
  id: string;
  first_prompt: string;
  conversation: string;
}

export const summarizeCommand = new Command("summarize")
  .description("Generate summaries for sessions that don't have them yet")
  .option("--db <path>", "path to SQLite database", "./timetravel.db")
  .option("--provider <name>", "LLM provider to use (e.g. ollama)")
  .option("--model <name>", "completion model to use")
  .action(async (options) => {
    const config = loadConfig();

    if (options.provider) {
      config.llm.provider = options.provider;
    }
    if (options.model) {
      config.llm.completionModel = options.model;
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

    try {
      const sessions = db
        .prepare(
          `SELECT s.id, s.first_prompt, GROUP_CONCAT(m.content_text, '\n') as conversation
           FROM sessions s
           JOIN messages m ON m.session_id = s.id
           WHERE s.summary = '' OR s.summary IS NULL
           GROUP BY s.id
           LIMIT 100`
        )
        .all() as SessionForSummary[];

      if (sessions.length === 0) {
        console.log("All sessions already have summaries.");
        return;
      }

      console.log(`Found ${sessions.length} sessions without summaries.`);

      const updateSummary = db.prepare(
        `UPDATE sessions SET summary = ? WHERE id = ?`
      );
      const updateSearchIndex = db.prepare(
        `INSERT INTO search_index (session_id, content, content_type)
         VALUES (?, ?, 'summary')
         ON CONFLICT DO NOTHING`
      );

      let processed = 0;
      for (const session of sessions) {
        const conversation = (session.conversation ?? "").slice(0, 8000);
        const prompt =
          `You are summarizing a Claude Code AI assistant session.\n\n` +
          `First prompt: ${session.first_prompt ?? "(none)"}\n\n` +
          `Conversation excerpt:\n${conversation}\n\n` +
          `Write a concise 1-3 sentence summary of what was accomplished in this session. ` +
          `Focus on the main task, tools used, and outcome.`;

        try {
          const summary = await provider.generateCompletion(prompt, {
            maxTokens: 200,
            temperature: 0.3,
          });
          const trimmed = summary.trim();
          updateSummary.run(trimmed, session.id);
          updateSearchIndex.run(session.id, trimmed);
          processed++;
          console.log(`  [${processed}/${sessions.length}] Session ${session.id} summarized.`);
        } catch (err) {
          console.error(`  Failed for session ${session.id}: ${(err as Error).message}`);
        }
      }

      console.log(`Done. ${processed} summaries generated.`);
    } finally {
      db.close();
    }
  });
