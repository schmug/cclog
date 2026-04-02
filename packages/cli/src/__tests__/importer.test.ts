import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeDatabase } from "../db/schema.js";
import { importSession } from "../importers/importer.js";
import {
  getSessionById,
  getMessagesBySessionId,
  getToolUsesBySessionId,
} from "../db/queries.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "fixtures");
const sessionJsonlPath = join(fixturesDir, "session-small.jsonl");
const SESSION_ID = "test-session-001";
const USER_ID = "cory";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  initializeDatabase(db);
});

afterEach(() => {
  db.close();
});

describe("importSession", () => {
  it("imports a session file with correct data", () => {
    importSession(db, SESSION_ID, sessionJsonlPath, USER_ID);

    // Session exists with correct project_name
    const session = getSessionById(db, SESSION_ID);
    expect(session).toBeDefined();
    expect(session?.project_name).toBe("myproject");

    // Correct token totals from fixtures
    expect(session?.total_input_tokens).toBe(3000);
    expect(session?.total_output_tokens).toBe(600);
    expect(session?.total_cache_read_tokens).toBe(17500);
    expect(session?.total_cache_creation_tokens).toBe(500);

    // 4 messages (2 user + 2 assistant)
    const messages = getMessagesBySessionId(db, SESSION_ID);
    expect(messages).toHaveLength(4);

    // 2 tool uses (Read and Edit)
    const toolUses = getToolUsesBySessionId(db, SESSION_ID);
    expect(toolUses).toHaveLength(2);
    const toolNames = toolUses.map((t) => t.tool_name);
    expect(toolNames).toContain("Read");
    expect(toolNames).toContain("Edit");
  });

  it("is idempotent — importing twice still yields only 4 messages", () => {
    importSession(db, SESSION_ID, sessionJsonlPath, USER_ID);
    importSession(db, SESSION_ID, sessionJsonlPath, USER_ID);

    const messages = getMessagesBySessionId(db, SESSION_ID);
    expect(messages).toHaveLength(4);

    const toolUses = getToolUsesBySessionId(db, SESSION_ID);
    expect(toolUses).toHaveLength(2);
  });

  it("sets the summary when provided", () => {
    importSession(db, SESSION_ID, sessionJsonlPath, USER_ID, "Custom summary");

    const session = getSessionById(db, SESSION_ID);
    expect(session?.summary).toBe("Custom summary");
  });
});
