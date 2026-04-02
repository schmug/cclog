import { readFileSync, statSync, existsSync } from "fs";
import { join } from "path";
import { readdirSync } from "fs";
import type Database from "better-sqlite3";
import { parseSessionJournal, extractSessionData } from "./jsonl-parser.js";
import { readSessionIndex } from "./session-index.js";
import {
  insertSession,
  insertMessage,
  insertToolUse,
  insertSearchEntry,
  getImportState,
  setImportState,
} from "../db/queries.js";

export interface ImportOptions {
  claudeDir: string;
  dbPath: string;
  userId: string;
  projectFilter?: string;
  sinceDate?: string;
}

/**
 * Imports a single session from a JSONL file into the database.
 * Deletes existing data for this session, then inserts fresh in a transaction.
 */
export function importSession(
  db: Database.Database,
  sessionId: string,
  jsonlPath: string,
  userId: string,
  summary?: string
): void {
  const content = readFileSync(jsonlPath, "utf-8");
  const entries = parseSessionJournal(content);
  const { session, messages, toolUses, searchTexts } = extractSessionData(
    sessionId,
    entries,
    userId
  );

  if (summary !== undefined) {
    session.summary = summary;
  }

  // Delete existing data in FK-safe order
  db.prepare("DELETE FROM search_index WHERE session_id = ?").run(sessionId);
  db.prepare(
    "DELETE FROM tool_uses WHERE session_id = ?"
  ).run(sessionId);
  db.prepare(
    "DELETE FROM messages WHERE session_id = ?"
  ).run(sessionId);
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);

  // Insert all data in a single transaction
  const doInsert = db.transaction(() => {
    insertSession(db, session);

    for (const message of messages) {
      insertMessage(db, message);
    }

    for (const toolUse of toolUses) {
      insertToolUse(db, toolUse);
    }

    for (const { content: text, contentType } of searchTexts) {
      insertSearchEntry(db, sessionId, text, contentType);
    }

    // Index first_prompt and summary in search_index
    if (session.first_prompt) {
      insertSearchEntry(db, sessionId, session.first_prompt, "first_prompt");
    }
    if (session.summary) {
      insertSearchEntry(db, sessionId, session.summary, "summary");
    }
  });

  doInsert();
}

/**
 * Scans claude projects directory and imports sessions not yet imported
 * (or changed since last import). Returns counts of imported and skipped sessions.
 */
export async function runFullImport(
  db: Database.Database,
  options: ImportOptions
): Promise<{ imported: number; skipped: number }> {
  const projectsDir = join(options.claudeDir, "projects");

  let imported = 0;
  let skipped = 0;

  let projectDirs: string[];
  try {
    projectDirs = readdirSync(projectsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => join(projectsDir, d.name));
  } catch {
    // projects directory doesn't exist or isn't readable
    return { imported, skipped };
  }

  for (const projectDir of projectDirs) {
    const indexPath = join(projectDir, "sessions-index.json");
    if (!existsSync(indexPath)) continue;

    let index;
    try {
      index = readSessionIndex(indexPath);
    } catch (err) {
      console.error(`Failed to read index at ${indexPath}:`, err);
      continue;
    }

    for (const entry of index.entries) {
      try {
        // Filter by project path if requested
        if (
          options.projectFilter &&
          entry.projectPath !== options.projectFilter
        ) {
          skipped++;
          continue;
        }

        // Filter by since date
        if (options.sinceDate && entry.created < options.sinceDate) {
          skipped++;
          continue;
        }

        // Skip sidechains
        if (entry.isSidechain) {
          skipped++;
          continue;
        }

        // Check if already imported at same or newer mtime
        const mtimeKey = `mtime:${entry.sessionId}`;
        const storedMtime = getImportState(db, mtimeKey);
        const entryMtime = String(entry.fileMtime);
        if (storedMtime !== undefined && storedMtime >= entryMtime) {
          skipped++;
          continue;
        }

        // Resolve JSONL file path
        let jsonlPath: string;
        if (entry.fullPath && existsSync(entry.fullPath)) {
          jsonlPath = entry.fullPath;
        } else {
          jsonlPath = join(projectDir, `${entry.sessionId}.jsonl`);
        }

        if (!existsSync(jsonlPath)) {
          console.error(`JSONL file not found for session ${entry.sessionId}`);
          skipped++;
          continue;
        }

        importSession(
          db,
          entry.sessionId,
          jsonlPath,
          options.userId,
          entry.summary
        );

        setImportState(db, mtimeKey, entryMtime);
        imported++;
      } catch (err) {
        console.error(
          `Error importing session ${entry.sessionId}:`,
          err
        );
        skipped++;
      }
    }
  }

  return { imported, skipped };
}
