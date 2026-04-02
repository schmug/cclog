import { Command } from "commander";
import { homedir } from "os";
import { openDatabase } from "../db/connection.js";
import { runFullImport } from "../importers/importer.js";

export const importCommand = new Command("import")
  .description("Import Claude Code session history into the database")
  .option("--db <path>", "path to SQLite database", "./timetravel.db")
  .option(
    "--claude-dir <path>",
    "path to Claude config directory",
    `${homedir()}/.claude`
  )
  .option("--project <name>", "filter by project path")
  .option("--since <date>", "only import sessions created after this ISO 8601 date")
  .option(
    "--user-id <name>",
    "user identifier to tag sessions",
    process.env.USER ?? "unknown"
  )
  .action(async (options) => {
    const db = openDatabase(options.db);
    try {
      const { imported, skipped } = await runFullImport(db, {
        claudeDir: options.claudeDir,
        dbPath: options.db,
        userId: options.userId,
        projectFilter: options.project,
        sinceDate: options.since,
      });
      console.log(`Import complete: ${imported} imported, ${skipped} skipped`);
    } finally {
      db.close();
    }
  });
