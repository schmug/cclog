import { Command } from "commander";
import { existsSync, mkdirSync, copyFileSync, writeFileSync } from "fs";
import { join } from "path";
import Database from "better-sqlite3";
import { Redactor } from "../redaction/redactor.js";

interface MessageRow {
  id: string;
  content_text: string;
}

interface ToolUseRow {
  id: string;
  input_json: string;
  output_text: string;
}

interface SessionRow {
  id: string;
  first_prompt: string;
  summary: string;
}

export const exportCommand = new Command("export")
  .description("Export a redacted copy of the database")
  .requiredOption("--output <dir>", "directory to write export files")
  .option("--db <path>", "path to source SQLite database", "./timetravel.db")
  .option("--redact-tool-outputs", "redact all tool output text")
  .option("--redact-code", "redact fenced code blocks")
  .option("--redact-paths", "redact absolute file paths")
  .option(
    "--redact-pattern <regex>",
    "custom redaction pattern (repeatable)",
    (val: string, prev: string[]) => [...prev, val],
    [] as string[]
  )
  .option(
    "--user-id <name>",
    "user identifier to write into exported sessions",
    process.env.USER ?? "unknown"
  )
  .action(async (options) => {
    const dbPath: string = options.db;
    const outputDir: string = options.output;
    const userId: string = options.userId;

    // 1. Check source DB exists
    if (!existsSync(dbPath)) {
      console.error(`Error: database not found at ${dbPath}`);
      process.exit(1);
    }

    // 2. Build rules array from flags
    const rules: string[] = [];
    if (options.redactToolOutputs) rules.push("redact-tool-outputs");
    if (options.redactCode) rules.push("redact-code");
    if (options.redactPaths) rules.push("redact-paths");
    for (const pattern of options.redactPattern as string[]) {
      rules.push(`redact-pattern:${pattern}`);
    }

    // 3. Create Redactor
    const redactor = new Redactor(rules);

    // 4. mkdir output dir, copy source DB
    mkdirSync(outputDir, { recursive: true });
    const exportDbPath = join(outputDir, "timetravel-export.db");
    copyFileSync(dbPath, exportDbPath);

    // 5. Open the copy and apply redaction
    const db = new Database(exportDbPath);
    db.pragma("journal_mode = WAL");

    try {
      // Redact messages.content_text
      const messages = db
        .prepare("SELECT id, content_text FROM messages")
        .all() as MessageRow[];

      const updateMessage = db.prepare(
        "UPDATE messages SET content_text = ? WHERE id = ?"
      );
      const updateMessages = db.transaction(() => {
        for (const msg of messages) {
          const redacted = redactor.redactText(msg.content_text ?? "");
          updateMessage.run(redacted, msg.id);
        }
      });
      updateMessages();

      // Redact tool_uses.input_json and output_text
      const toolUses = db
        .prepare("SELECT id, input_json, output_text FROM tool_uses")
        .all() as ToolUseRow[];

      const updateToolUse = db.prepare(
        "UPDATE tool_uses SET input_json = ?, output_text = ? WHERE id = ?"
      );
      const updateToolUses = db.transaction(() => {
        for (const tu of toolUses) {
          const redactedInput = redactor.redactText(tu.input_json ?? "");
          const redactedOutput = redactor.redactToolOutput(tu.output_text ?? "");
          updateToolUse.run(redactedInput, redactedOutput, tu.id);
        }
      });
      updateToolUses();

      // Redact sessions.first_prompt and summary
      const sessions = db
        .prepare("SELECT id, first_prompt, summary FROM sessions")
        .all() as SessionRow[];

      const updateSession = db.prepare(
        "UPDATE sessions SET first_prompt = ?, summary = ? WHERE id = ?"
      );
      const updateSessions = db.transaction(() => {
        for (const s of sessions) {
          const redactedPrompt = redactor.redactText(s.first_prompt ?? "");
          const redactedSummary = redactor.redactText(s.summary ?? "");
          updateSession.run(redactedPrompt, redactedSummary, s.id);
        }
      });
      updateSessions();

      // Drop search_index and clear embeddings (contain unredacted content)
      db.exec("DROP TABLE IF EXISTS search_index");
      db.exec("DELETE FROM embeddings");

      // 6. Update all sessions user_id
      db.prepare("UPDATE sessions SET user_id = ?").run(userId);

      // 7. Write manifest.json
      const sessionCount = (
        db.prepare("SELECT COUNT(*) as count FROM sessions").get() as {
          count: number;
        }
      ).count;

      const manifest = {
        userId,
        exportDate: new Date().toISOString(),
        redactionRules: rules,
        sessionCount,
      };

      writeFileSync(
        join(outputDir, "manifest.json"),
        JSON.stringify(manifest, null, 2)
      );

      // 8. Print summary
      console.log(`Export complete:`);
      console.log(`  Output:    ${outputDir}`);
      console.log(`  DB:        ${exportDbPath}`);
      console.log(`  Sessions:  ${sessionCount}`);
      console.log(`  User ID:   ${userId}`);
      console.log(`  Rules:     ${rules.length > 0 ? rules.join(", ") : "(none)"}`);
    } finally {
      db.close();
    }
  });
