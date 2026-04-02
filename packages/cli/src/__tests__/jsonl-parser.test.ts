import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseSessionJournal, extractSessionData } from "../importers/jsonl-parser.js";
import { readSessionIndex } from "../importers/session-index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "fixtures");

describe("parseSessionJournal", () => {
  it("parses JSONL into typed entries", () => {
    const content = readFileSync(join(fixturesDir, "session-small.jsonl"), "utf-8");
    const entries = parseSessionJournal(content);

    expect(entries).toHaveLength(8);

    const userEntries = entries.filter((e) => e.type === "user");
    const assistantEntries = entries.filter((e) => e.type === "assistant");
    const systemEntries = entries.filter((e) => e.type === "system");

    expect(userEntries).toHaveLength(2);
    expect(assistantEntries).toHaveLength(2);
    expect(systemEntries).toHaveLength(1);
  });
});

describe("extractSessionData", () => {
  it("extracts session row, messages, and tool uses", () => {
    const content = readFileSync(join(fixturesDir, "session-small.jsonl"), "utf-8");
    const entries = parseSessionJournal(content);
    const { session, messages, toolUses } = extractSessionData("test-session-001", entries, "cory");

    // Session fields
    expect(session.id).toBe("test-session-001");
    expect(session.project_path).toBe("/Users/cory/myproject");
    expect(session.project_name).toBe("myproject");
    expect(session.slug).toBe("happy-coding-fox");
    expect(session.model).toBe("claude-opus-4-6");
    expect(session.user_id).toBe("cory");

    // Token totals
    expect(session.total_input_tokens).toBe(3000);
    expect(session.total_output_tokens).toBe(600);
    expect(session.total_cache_read_tokens).toBe(17500);
    expect(session.total_cache_creation_tokens).toBe(500);

    // Cost
    expect(session.total_cost).toBeGreaterThan(0);

    // Messages
    expect(messages).toHaveLength(4);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content_text).toBe("fix the auth bug");

    // Tool uses
    expect(toolUses).toHaveLength(2);
    const toolNames = toolUses.map((t) => t.tool_name);
    expect(toolNames).toContain("Read");
    expect(toolNames).toContain("Edit");
  });
});

describe("readSessionIndex", () => {
  it("reads sessions-index.json", () => {
    const index = readSessionIndex(join(fixturesDir, "sessions-index.json"));

    expect(index.version).toBe(1);
    expect(index.entries).toHaveLength(1);
    expect(index.entries[0].sessionId).toBe("test-session-001");
  });
});
