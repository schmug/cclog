import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { initializeDatabase } from "../db/schema.js";
import {
  insertSession,
  getSessionById,
  getDashboardStats,
  insertMessage,
  insertToolUse,
  getImportState,
  setImportState,
} from "../db/queries.js";
import type { SessionRow, MessageRow, ToolUseRow } from "@cclog/shared";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  initializeDatabase(db);
});

afterEach(() => {
  db.close();
});

describe("initializeDatabase", () => {
  it("creates all expected tables", () => {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      )
      .all() as { name: string }[];

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain("sessions");
    expect(tableNames).toContain("messages");
    expect(tableNames).toContain("tool_uses");
    expect(tableNames).toContain("insights");
    expect(tableNames).toContain("import_state");
  });

  it("creates the search_index FTS5 virtual table", () => {
    const result = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='search_index'"
      )
      .get() as { name: string } | undefined;
    expect(result).toBeDefined();
    expect(result?.name).toBe("search_index");
  });
});

describe("insertSession + getSessionById", () => {
  it("round-trips a SessionRow correctly", () => {
    const session: SessionRow = {
      id: "test-session-001",
      project_path: "/home/user/projects/myapp",
      project_name: "myapp",
      slug: "my-feature",
      git_branch: "main",
      first_prompt: "Hello, Claude",
      summary: "A test session",
      message_count: 5,
      total_input_tokens: 1000,
      total_output_tokens: 500,
      total_cache_read_tokens: 200,
      total_cache_creation_tokens: 100,
      total_cost: 0.025,
      model: "claude-3-5-sonnet-20241022",
      cc_version: "1.0.0",
      user_id: "user-abc",
      created_at: "2026-04-01T10:00:00.000Z",
      modified_at: "2026-04-01T11:00:00.000Z",
      duration_seconds: 3600,
    };

    insertSession(db, session);
    const retrieved = getSessionById(db, "test-session-001");

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(session.id);
    expect(retrieved?.project_path).toBe(session.project_path);
    expect(retrieved?.project_name).toBe(session.project_name);
    expect(retrieved?.slug).toBe(session.slug);
    expect(retrieved?.git_branch).toBe(session.git_branch);
    expect(retrieved?.first_prompt).toBe(session.first_prompt);
    expect(retrieved?.summary).toBe(session.summary);
    expect(retrieved?.message_count).toBe(session.message_count);
    expect(retrieved?.total_input_tokens).toBe(session.total_input_tokens);
    expect(retrieved?.total_output_tokens).toBe(session.total_output_tokens);
    expect(retrieved?.total_cache_read_tokens).toBe(
      session.total_cache_read_tokens
    );
    expect(retrieved?.total_cache_creation_tokens).toBe(
      session.total_cache_creation_tokens
    );
    expect(retrieved?.total_cost).toBeCloseTo(session.total_cost, 6);
    expect(retrieved?.model).toBe(session.model);
    expect(retrieved?.cc_version).toBe(session.cc_version);
    expect(retrieved?.user_id).toBe(session.user_id);
    expect(retrieved?.created_at).toBe(session.created_at);
    expect(retrieved?.modified_at).toBe(session.modified_at);
    expect(retrieved?.duration_seconds).toBe(session.duration_seconds);
  });

  it("returns undefined for a non-existent id", () => {
    const result = getSessionById(db, "does-not-exist");
    expect(result).toBeUndefined();
  });

  it("overwrites on duplicate id (INSERT OR REPLACE)", () => {
    const session: SessionRow = {
      id: "dup-session",
      project_path: "/path/a",
      project_name: "proj-a",
      slug: "",
      git_branch: "",
      first_prompt: "original",
      summary: "",
      message_count: 1,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_cache_read_tokens: 0,
      total_cache_creation_tokens: 0,
      total_cost: 0,
      model: "",
      cc_version: "",
      user_id: "",
      created_at: "2026-04-01T00:00:00.000Z",
      modified_at: "2026-04-01T00:00:00.000Z",
      duration_seconds: 0,
    };

    insertSession(db, session);
    insertSession(db, { ...session, first_prompt: "updated" });

    const result = getSessionById(db, "dup-session");
    expect(result?.first_prompt).toBe("updated");
  });
});

describe("getDashboardStats", () => {
  it("returns zeroes for an empty database", () => {
    const stats = getDashboardStats(db, {});
    expect(stats.sessions).toBe(0);
    expect(stats.messages).toBe(0);
    expect(stats.totalTokens).toBe(0);
    expect(stats.totalCost).toBe(0);
    expect(stats.avgDurationSeconds).toBe(0);
    expect(stats.sessionsTrend).toBe(0);
    expect(stats.messageTrend).toBe(0);
    expect(stats.tokensTrend).toBe(0);
    expect(stats.costTrend).toBe(0);
  });

  it("returns correct counts with data", () => {
    const base: SessionRow = {
      id: "s1",
      project_path: "/p",
      project_name: "proj",
      slug: "",
      git_branch: "",
      first_prompt: "",
      summary: "",
      message_count: 10,
      total_input_tokens: 500,
      total_output_tokens: 250,
      total_cache_read_tokens: 0,
      total_cache_creation_tokens: 0,
      total_cost: 0.05,
      model: "",
      cc_version: "",
      user_id: "",
      created_at: "2026-04-01T00:00:00.000Z",
      modified_at: "2026-04-01T01:00:00.000Z",
      duration_seconds: 120,
    };

    insertSession(db, base);
    insertSession(db, {
      ...base,
      id: "s2",
      total_input_tokens: 200,
      total_output_tokens: 100,
      total_cost: 0.02,
      duration_seconds: 60,
    });

    const stats = getDashboardStats(db, {});
    expect(stats.sessions).toBe(2);
    expect(stats.totalTokens).toBe(500 + 250 + 200 + 100);
    expect(stats.totalCost).toBeCloseTo(0.07, 6);
    expect(stats.avgDurationSeconds).toBe(90);
  });

  it("filters by projectPath", () => {
    const base: SessionRow = {
      id: "s1",
      project_path: "/project/a",
      project_name: "proj-a",
      slug: "",
      git_branch: "",
      first_prompt: "",
      summary: "",
      message_count: 5,
      total_input_tokens: 100,
      total_output_tokens: 50,
      total_cache_read_tokens: 0,
      total_cache_creation_tokens: 0,
      total_cost: 0.01,
      model: "",
      cc_version: "",
      user_id: "",
      created_at: "2026-04-01T00:00:00.000Z",
      modified_at: "2026-04-01T00:00:00.000Z",
      duration_seconds: 30,
    };

    insertSession(db, base);
    insertSession(db, {
      ...base,
      id: "s2",
      project_path: "/project/b",
      project_name: "proj-b",
    });

    const stats = getDashboardStats(db, { projectPath: "/project/a" });
    expect(stats.sessions).toBe(1);
  });
});

describe("import_state", () => {
  it("returns undefined for missing key", () => {
    expect(getImportState(db, "nonexistent")).toBeUndefined();
  });

  it("stores and retrieves a value", () => {
    setImportState(db, "last_run", "2026-04-01");
    expect(getImportState(db, "last_run")).toBe("2026-04-01");
  });

  it("overwrites existing value", () => {
    setImportState(db, "key1", "first");
    setImportState(db, "key1", "second");
    expect(getImportState(db, "key1")).toBe("second");
  });
});
